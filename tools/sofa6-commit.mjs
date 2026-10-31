// SOFA-6 in a real page: headless Chrome, dry-run Mac (nothing is injected; the Mac's log lists what it would type).
// Ray (2026-10-29): "I typed, didn't press Enter — clicked the send button somewhere else (on the Mac, with the trackpad) —
// the words stayed in the box, and next time, somewhere else, it got stuck or the old words jumped out."
// Each scenario: type a sentence, end it some way other than (or as well as) Enter, then go on typing "somewhere
// else" — with the caret placed in the box the way a tap in it (or iOS's own space-bar cursor) would. Checks the box
// and the exact sequence the Mac received: the first sentence once, nothing of it again, the new text arriving.
//   node tools/sofa6-commit.mjs --label before --web <web of 4.1>   |   node tools/sofa6-commit.mjs --label after
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { startServer, ROOT, IPHONE_UA, INSETS } from './test-server.mjs';

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => (v.startsWith('--') ? [...a, [v.slice(2), arr[i + 1]]] : a), []));
const label = args.label || 'run';
const webRoot = args.web || join(ROOT, 'web');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const FIRST = '第一句話寫給A';
const NEXT = '新';

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok ? '' : '  → ' + detail}`);
};

const server = await startServer({ webRoot });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const out = { label, scenarios: {} };
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'zh-TW', colorScheme: 'dark', userAgent: IPHONE_UA });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('PAGE ERROR ' + e.message));
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: INSETS.portrait });
  await page.goto(server.url + '#pair=' + server.code);
  await page.waitForFunction(() => document.getElementById('dot').classList.contains('ready'));
  const helpers = () => page.evaluate(() => {
    const el = document.getElementById('input');
    const ev = (type, o = {}) => el.dispatchEvent(new InputEvent(type, { bubbles: true, cancelable: type === 'beforeinput', ...o }));
    // typing at the caret, the way a keyboard does it
    window.__type = (s) => {
      for (const ch of s) {
        const p = el.selectionStart;
        el.setRangeText(ch, p, el.selectionEnd, 'end');
        ev('input', { inputType: 'insertText', data: ch });
      }
    };
    // Zhuyin: marked text while composing, then the picked character. `order`: 'spec' (input, then compositionend:
    // Chrome) or 'webkit' (compositionend, then a non-composing input); `end: false` = compositionend never comes.
    window.__composeStart = (marked) => {
      el.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true, data: '' }));
      const p = el.selectionStart;
      el.setRangeText(marked, p, el.selectionEnd, 'select');
      ev('input', { inputType: 'insertCompositionText', data: marked, isComposing: true });
    };
    window.__composeEnd = (marked, chosen, order = 'spec') => {
      // the page may have emptied the box meanwhile: iOS then commits the choice into it at the caret
      let p = el.value.lastIndexOf(marked);
      if (p < 0) { p = el.selectionStart; marked = ''; }
      if (order === 'spec') {
        el.setRangeText(chosen, p, p + marked.length, 'end');
        ev('input', { inputType: 'insertCompositionText', data: chosen, isComposing: true });
        el.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: chosen }));
      } else {
        el.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: chosen }));
        el.setRangeText(chosen, p, p + marked.length, 'end');
        ev('input', { inputType: 'insertFromComposition', data: chosen, isComposing: false });
      }
    };
    window.__enter = () => ev('beforeinput', { inputType: 'insertLineBreak' });
    window.__caret = (pos) => { el.setSelectionRange(pos, pos); };
    window.__hide = (hidden) => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (hidden ? 'hidden' : 'visible') });
      document.dispatchEvent(new Event('visibilitychange'));
    };
  });
  await helpers();

  let mark = 0;
  /** What the Mac did since the last call, from its dry-run log: text, ⌫, ⏎, click. */
  const macSince = () => {
    const lines = [...server.log().matchAll(/\[dry-run\] (.*)/g)].map((m) => m[1]);
    const fresh = lines.slice(mark);
    mark = lines.length;
    const seq = [];
    for (const l of fresh) {
      let m;
      if ((m = /^type (".*")$/.exec(l))) seq.push(JSON.parse(m[1]));
      else if ((m = /^key 51 mods \[\]$/.exec(l))) seq.push('⌫');
      else if ((m = /^key 36 mods \[\]$/.exec(l))) seq.push('⏎');
      else if ((m = /^click (\w+)$/.exec(l))) seq.push('click');
      else if ((m = /^key (\d+) mods \[(.*)\]$/.exec(l))) seq.push(`key${m[1]}[${m[2]}]`);
    }
    return seq;
  };
  const box = () => page.inputValue('#input');
  const mode = () => page.evaluate(() => document.getElementById('modeBtn').textContent.trim());
  const setMode = async (want) => { for (let i = 0; i < 2 && (await mode()) !== want; i++) { await page.tap('#modeBtn'); await sleep(150); } };
  const focus = () => page.evaluate(() => document.getElementById('input').focus());
  const padTap = async () => { const b = await page.locator('#pad').boundingBox(); await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 3); };

  async function scenario(key, name, { batch = false, typeFirst, end, then, expect }) {
    // a fresh page each time (same paired phone): nothing left over from the scenario before
    await page.reload();
    await page.waitForFunction(() => document.getElementById('dot').classList.contains('ready'));
    await helpers();
    await setMode(batch ? '整段' : '即時');
    await sleep(300);
    await focus();
    await sleep(100);
    macSince();
    if (typeFirst) await typeFirst(); else await page.evaluate((s) => window.__type(s), FIRST);
    await sleep(900);
    await end();
    await sleep(700);
    const boxAfter = await box();
    const macFirst = macSince();
    await then();
    await sleep(1300);
    const boxLater = await box();
    const macLater = macSince();
    const r = { name, boxAfter, macFirst, boxLater, macLater };
    out.scenarios[key] = r;
    console.log(`${key} ${name}\n    box after: ${JSON.stringify(boxAfter)} | Mac: ${JSON.stringify(macFirst)}\n    then box: ${JSON.stringify(boxLater)} | Mac: ${JSON.stringify(macLater)}`);
    expect(r);
  }

  const joined = (seq) => seq.filter((x) => x.length && !['⌫', '⏎', 'click'].includes(x) && !x.startsWith('key')).join('');
  const noOldText = (r) => !joined(r.macLater).includes('第一') && !joined(r.macLater).includes('寫給') && !r.macLater.includes('⌫');
  const typeNextAtStart = async () => { await focus(); await page.evaluate(() => window.__caret(0)); await page.evaluate((s) => window.__type(s), NEXT); };

  // --- live mode ---
  await scenario('S1', '即時：按 Enter，然後在別的視窗打字', {
    end: () => page.evaluate(() => window.__enter()),
    then: typeNextAtStart,
    expect: (r) => {
      check('S1 Enter：輸入框清空', r.boxAfter === '', r.boxAfter);
      check('S1 Enter：Mac 收到第一句一次、再按 Enter', joined(r.macFirst) === FIRST && r.macFirst.at(-1) === '⏎', JSON.stringify(r.macFirst));
      check('S1 之後只送新字', joined(r.macLater) === NEXT && noOldText(r), JSON.stringify(r.macLater));
    },
  });
  await scenario('S2', '即時：不按 Enter，用觸控板點 Mac 上的「傳送」，然後游標放在輸入框開頭打字', {
    end: padTap,
    then: typeNextAtStart,
    expect: (r) => {
      check('S2 點擊：Mac 先收到第一句、再點擊', joined(r.macFirst) === FIRST && r.macFirst.at(-1) === 'click', JSON.stringify(r.macFirst));
      check('S2 點擊後輸入框清空', r.boxAfter === '', r.boxAfter);
      check('S2 之後只送新字，舊字沒有再送、沒有 ⌫', joined(r.macLater) === NEXT && noOldText(r), JSON.stringify(r.macLater));
    },
  });
  await scenario('S3', '即時：點到別處（收起鍵盤），回來在中間打字', {
    end: () => page.evaluate(() => document.getElementById('input').blur()),
    then: async () => { await focus(); await page.evaluate(() => window.__caret(2)); await page.evaluate((s) => window.__type(s), NEXT); },
    expect: (r) => {
      check('S3 收起鍵盤：Mac 收到第一句一次', joined(r.macFirst) === FIRST, JSON.stringify(r.macFirst));
      check('S3 收起鍵盤後輸入框清空', r.boxAfter === '', r.boxAfter);
      check('S3 之後只送新字', joined(r.macLater) === NEXT && noOldText(r), JSON.stringify(r.macLater));
    },
  });
  await scenario('S4', '即時：切到別的 App 再回來', {
    end: async () => { await page.evaluate(() => { window.__hide(true); document.getElementById('input').blur(); }); await sleep(200); await page.evaluate(() => window.__hide(false)); },
    then: typeNextAtStart,
    expect: (r) => {
      check('S4 切 App：Mac 收到第一句一次', joined(r.macFirst) === FIRST, JSON.stringify(r.macFirst));
      check('S4 切 App 回來輸入框是空的', r.boxAfter === '', r.boxAfter);
      check('S4 之後只送新字', joined(r.macLater) === NEXT && noOldText(r), JSON.stringify(r.macLater));
    },
  });
  await scenario('S5', '即時：注音選字到一半就點觸控板（compositionend 晚到），之後打字', {
    typeFirst: async () => { await page.evaluate((s) => window.__type(s), FIRST); await sleep(900); await page.evaluate(() => window.__composeStart('ㄋㄧˇ')); },
    end: async () => { await padTap(); await sleep(300); await page.evaluate(() => window.__composeEnd('ㄋㄧˇ', '你', 'webkit')); },
    then: typeNextAtStart,
    expect: (r) => {
      check('S5 組字中點擊：注音符號不送到 Mac', !r.macFirst.join('').includes('ㄋ') && !r.macLater.join('').includes('ㄋ'), JSON.stringify([r.macFirst, r.macLater]));
      check('S5 第一句一次；選好的「你」送一次', joined(r.macFirst).split(FIRST).length === 2 && (joined(r.macFirst) + joined(r.macLater)).split('你').length === 2, JSON.stringify([r.macFirst, r.macLater]));
      check('S5 選完字後輸入框清空', r.boxAfter === '', r.boxAfter);
      check('S5 之後只送新字', joined(r.macLater) === NEXT && noOldText(r), JSON.stringify(r.macLater));
    },
  });
  await scenario('S6', '即時：注音組字中收起鍵盤，iOS 沒送 compositionend（卡住）', {
    typeFirst: async () => { await page.evaluate((s) => window.__type(s), FIRST); await sleep(900); await page.evaluate(() => window.__composeStart('ㄋㄧˇ')); },
    end: () => page.evaluate(() => { const el = document.getElementById('input'); el.value = el.value.replace('ㄋㄧˇ', '你'); el.blur(); }),
    then: typeNextAtStart,
    expect: (r) => {
      check('S6 沒有 compositionend：「你」照樣送出', (joined(r.macFirst) + joined(r.macLater)).includes('你'), JSON.stringify([r.macFirst, r.macLater]));
      check('S6 之後的字沒有卡住', joined(r.macLater).endsWith(NEXT), JSON.stringify(r.macLater));
      check('S6 舊字沒有再送、沒有 ⌫', noOldText(r), JSON.stringify(r.macLater));
    },
  });
  await scenario('S7', '即時：按鍵列的方向鍵（Mac 游標移走了），然後打字', {
    end: () => page.evaluate(() => { const b = [...document.querySelectorAll('#keyStrip button')].find((x) => x.dataset.k === 'left'); b.click(); }),
    then: typeNextAtStart,
    expect: (r) => {
      check('S7 按鍵：Mac 先收到第一句', joined(r.macFirst) === FIRST, JSON.stringify(r.macFirst));
      check('S7 按鍵後輸入框清空', r.boxAfter === '', r.boxAfter);
      check('S7 之後只送新字', joined(r.macLater) === NEXT && noOldText(r), JSON.stringify(r.macLater));
    },
  });
  await scenario('S8', '即時：注音選字中點觸控板，事件是 Chrome 的順序（input 再 compositionend）', {
    typeFirst: async () => { await page.evaluate((s) => window.__type(s), FIRST); await sleep(900); await page.evaluate(() => window.__composeStart('ㄋㄧˇ')); },
    end: async () => { await padTap(); await sleep(300); await page.evaluate(() => window.__composeEnd('ㄋㄧˇ', '你', 'spec')); },
    then: typeNextAtStart,
    expect: (r) => {
      check('S8 第一句一次、「你」一次、沒有注音符號', (joined(r.macFirst) + joined(r.macLater)) === FIRST + '你' + NEXT, JSON.stringify([r.macFirst, r.macLater]));
      check('S8 選完字後輸入框清空，之後只送新字', r.boxAfter === '' && noOldText(r), JSON.stringify([r.boxAfter, r.macLater]));
    },
  });
  await scenario('S9', '即時：注音組字中收起鍵盤，compositionend 在 blur 之後 0.1 秒才到', {
    typeFirst: async () => { await page.evaluate((s) => window.__type(s), FIRST); await sleep(900); await page.evaluate(() => window.__composeStart('ㄋㄧˇ')); },
    end: async () => { await page.evaluate(() => document.getElementById('input').blur()); await sleep(100); await page.evaluate(() => window.__composeEnd('ㄋㄧˇ', '你', 'webkit')); },
    then: typeNextAtStart,
    expect: (r) => {
      check('S9 晚到的「你」照樣送一次（blur 後的 input 沒被丟掉）', joined(r.macFirst) === FIRST + '你', JSON.stringify(r.macFirst));
      check('S9 輸入框清空，之後只送新字', r.boxAfter === '' && joined(r.macLater) === NEXT && noOldText(r), JSON.stringify([r.boxAfter, r.macLater]));
    },
  });
  await scenario('S10', '即時：收起鍵盤清空後，iOS 不發事件把字放回框裡，回來再打字', {
    end: async () => { await page.evaluate(() => document.getElementById('input').blur()); await sleep(200); await page.evaluate((s) => { document.getElementById('input').value = s; }, FIRST); },
    then: async () => { await focus(); await page.evaluate(() => { const el = document.getElementById('input'); el.setSelectionRange(el.value.length, el.value.length); }); await page.evaluate((s) => window.__type(s), NEXT); },
    expect: (r) => {
      check('S10 放回來的舊字沒有送出', noOldText(r) && joined(r.macLater) === NEXT, JSON.stringify(r.macLater));
    },
  });
  // --- batch mode ---
  await scenario('B1', '整段：注音選字中按畫面上的「送出」（compositionend 在按鈕之後才到）', {
    batch: true,
    typeFirst: async () => { await page.evaluate((s) => window.__type(s), FIRST); await page.evaluate(() => window.__composeStart('ㄋㄧˇ')); },
    end: async () => { await page.tap('#sendBtn'); await sleep(30); await page.evaluate(() => window.__composeEnd('ㄋㄧˇ', '你', 'webkit')); },
    then: async () => { await focus(); await page.evaluate((s) => window.__type(s), NEXT); await page.tap('#sendBtn'); },
    expect: (r) => {
      check('B1 送出的是整句（含選好的「你」），沒有注音符號', r.macFirst.length === 1 && r.macFirst[0] === FIRST + '你', JSON.stringify(r.macFirst));
      check('B1 送出後輸入框清空（「你」沒有留在框裡）', r.boxAfter === '', r.boxAfter);
      check('B1 下一次只送新字', JSON.stringify(r.macLater) === JSON.stringify([NEXT]), JSON.stringify(r.macLater));
    },
  });
  await scenario('B4', '整段：注音選字中按「送出」，事件是 Chrome 的順序', {
    batch: true,
    typeFirst: async () => { await page.evaluate((s) => window.__type(s), FIRST); await page.evaluate(() => window.__composeStart('ㄋㄧˇ')); },
    end: async () => { await page.tap('#sendBtn'); await sleep(30); await page.evaluate(() => window.__composeEnd('ㄋㄧˇ', '你', 'spec')); },
    then: async () => { await focus(); await page.evaluate((s) => window.__type(s), NEXT); await page.tap('#sendBtn'); },
    expect: (r) => {
      check('B4 送出整句含「你」一次，框清空，下一次只送新字', JSON.stringify(r.macFirst) === JSON.stringify([FIRST + '你']) && r.boxAfter === '' && JSON.stringify(r.macLater) === JSON.stringify([NEXT]), JSON.stringify([r.macFirst, r.boxAfter, r.macLater]));
    },
  });
  await scenario('B2', '整段：按鍵盤的「傳送」鍵（Enter），然後再打一段', {
    batch: true,
    end: () => page.evaluate(() => window.__enter()),
    then: async () => { await page.evaluate((s) => window.__type(s), NEXT); await page.evaluate(() => window.__enter()); },
    expect: (r) => {
      check('B2 Enter 送出整句一次並清空', JSON.stringify(r.macFirst) === JSON.stringify([FIRST]) && r.boxAfter === '', JSON.stringify([r.macFirst, r.boxAfter]));
      check('B2 下一次只送新字', JSON.stringify(r.macLater) === JSON.stringify([NEXT]), JSON.stringify(r.macLater));
    },
  });
  await scenario('B3', '整段：打完沒送就收起鍵盤（草稿）', {
    batch: true,
    end: () => page.evaluate(() => document.getElementById('input').blur()),
    then: async () => { await focus(); await page.tap('#sendBtn'); },
    expect: (r) => {
      check('B3 收起鍵盤不送出、草稿留著', r.macFirst.length === 0 && r.boxAfter === FIRST, JSON.stringify([r.macFirst, r.boxAfter]));
      check('B3 之後按「送出」才送一次', JSON.stringify(r.macLater) === JSON.stringify([FIRST]) && r.boxLater === '', JSON.stringify([r.macLater, r.boxLater]));
    },
  });
  out.keyboardAfterSend = await page.evaluate(() => document.activeElement && document.activeElement.id);
} finally {
  await browser.close();
  await server.stop();
}
out.results = results;
const passed = results.filter((r) => r.ok).length;
console.log(`${passed}/${results.length} PASS`);
mkdirSync(join(ROOT, 'design/evidence/sofa6'), { recursive: true });
writeFileSync(join(ROOT, `design/evidence/sofa6/commit-${label}.json`), JSON.stringify(out, null, 1));
process.exitCode = passed === results.length ? 0 : 1;
