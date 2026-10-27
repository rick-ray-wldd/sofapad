// PKM-3-1 ① (I-21) in a real page: headless Chrome, dry-run Mac (nothing is injected). Replays the iOS-dictation
// edit pattern behind Ray's P-19 — delete the last word and insert it again longer, both in one task — into the
// text box, and records what the page sends. Run against the v2 web (exported from git) and the current one:
//   node tools/pkm31-dictation.mjs --label before --web <web from 69a5626>   |   node tools/pkm31-dictation.mjs --label after
// Also: keyboard typing still goes at once; a long box is not cleared while focused; the input log in ⚙︎.
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { startServer, ROOT, IPHONE_UA, INSETS } from './test-server.mjs';

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => (v.startsWith('--') ? [...a, [v.slice(2), arr[i + 1]]] : a), []));
const label = args.label || 'run';
const webRoot = args.web || join(ROOT, 'web');
const shotsDir = join(ROOT, 'design/screenshots/v3');
mkdirSync(shotsDir, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const P19_SAID = '然後現在需要按步驟，先按鍵盤打開來，';
const P19_MAC = '然後然後現在需要按按步驟，步驟，先按鍵盤鍵盤鍵盤打開來，';
// [ms after start, [[cut from the end, text to add], …] in one task]
const TRACE = [
  [0, [[0, '然後']]],
  [320, [[2, ''], [0, '然後現在需要按']]],
  [650, [[1, ''], [0, '按步驟，']]],
  [980, [[3, ''], [0, '步驟，先按鍵盤']]],
  [1250, [[2, ''], [0, '鍵盤']]],
  [1560, [[2, ''], [0, '鍵盤打開來，']]],
];

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok ? '' : '  → ' + detail}`);
};

/** The Mac side if every ⌫ lands, and if a ⌫ followed by text within 50 ms is lost (I-21 hypothesis). */
function macText(msgs, lossy) {
  let s = [];
  msgs.forEach((m, i) => {
    if (m.t === 'key' && m.k === 'backspace') {
      const next = msgs[i + 1];
      if (lossy && next && next.t === 'text' && next.at - m.at < 50) return;
      s = s.slice(0, Math.max(0, s.length - (m.n || 1)));
    } else if (m.t === 'text') s.push(...Array.from(new Intl.Segmenter().segment(m.s), (x) => x.segment));
  });
  return s.join('');
}

const server = await startServer({ webRoot });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const out = { label };
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: IPHONE_UA });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('PAGE ERROR ' + e.message));
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: INSETS.portrait });
  await page.goto(server.url + '#pair=' + server.code);
  await page.waitForFunction(() => document.getElementById('dot').classList.contains('ready'));
  await page.evaluate(() => {
    window.__sent = [];
    const t0 = performance.now();
    for (const fn of ['send', 'sendReliable']) {
      const orig = window.pkmLink[fn].bind(window.pkmLink);
      window.pkmLink[fn] = (m) => { if (m.t !== 'ping') window.__sent.push({ ...m, at: Math.round(performance.now() - t0) }); return orig(m); };
    }
    window.__edit = (steps) => {
      const el = document.getElementById('input');
      for (const [cut, add] of steps) {
        if (cut) { el.value = el.value.slice(0, -cut); el.dispatchEvent(new InputEvent('input', { inputType: 'deleteContentBackward', bubbles: true })); }
        if (add) { el.value += add; el.dispatchEvent(new InputEvent('input', { inputType: 'insertText', data: add, bubbles: true })); }
      }
    };
  });
  await page.focus('#input');

  // 1. P-19 dictation pattern
  const start = Date.now();
  for (const [at, steps] of TRACE) {
    await sleep(Math.max(0, at - (Date.now() - start)));
    await page.evaluate((s) => window.__edit(s), steps);
  }
  await sleep(1500);
  const msgs = await page.evaluate(() => window.__sent.splice(0));
  const box = await page.inputValue('#input');
  out.p19 = { box, messages: msgs, mac: macText(msgs, false), macLossy: macText(msgs, true) };
  console.log('P-19 messages:', msgs.map((m) => (m.t === 'text' ? `text「${m.s}」@${m.at}` : `⌫${m.n}@${m.at}`)).join(' | '));
  check('P-19 聽寫樣式：手機輸入框是對的', box === P19_SAID, box);
  if (label === 'before') {
    check('v2：⌫ 和重打的字一起送（5 組）', msgs.filter((m) => m.k === 'backspace').length === 5, JSON.stringify(msgs));
    check('v2：⌫ 沒生效時，Mac 上正好是 Ray 看到的疊字', out.p19.macLossy === P19_MAC, out.p19.macLossy);
  } else {
    check('現在：改寫在停頓前就合併，沒有送任何 ⌫', !msgs.some((m) => m.k === 'backspace'), JSON.stringify(msgs));
    check('現在：就算 ⌫ 會掉，Mac 上也是正確的句子', out.p19.macLossy === P19_SAID && out.p19.mac === P19_SAID, out.p19.macLossy);
  }

  // 2. keyboard typing after the dictation pause (burst over): one character goes at once
  await sleep(200);
  await page.evaluate(() => window.__sent.splice(0));
  await page.evaluate(() => window.__edit([[0, 'x']]));
  const tSingle = Date.now();
  await page.waitForFunction(() => window.__sent.some((m) => m.t === 'text' && m.s === 'x'), null, { timeout: 2000 }).catch(() => {});
  const singleMs = Date.now() - tSingle;
  check('一般打字：一個字 100 ms 內送出', singleMs < 100, `${singleMs} ms`);
  out.singleCharMs = singleMs;
  await page.evaluate((n) => window.__edit([[n, '']]), P19_SAID.length + 1);   // clear the box (the Mac follows)
  await sleep(1800);
  await page.evaluate(() => window.__sent.splice(0));

  // 3. a box over 200 characters stays while focused (v2 cleared it 1.5 s after the last send)
  await page.evaluate(() => window.__edit([[0, '長'.repeat(230)]]));
  await sleep(2600);
  const keptLen = (await page.inputValue('#input')).length;
  out.longBoxAfter2600ms = keptLen;
  if (label === 'before') check('v2：輸入框超過 200 字、1.5 秒後在打字中被清空', keptLen === 0, String(keptLen));
  else {
    check('現在：打字（聽寫）中不清空輸入框', keptLen === 230, String(keptLen));
    await page.evaluate(() => document.getElementById('input').blur());
    await sleep(200);
    check('現在：收起鍵盤（blur）後才清空', (await page.inputValue('#input')).length === 0);
  }

  // 4. input log in ⚙︎ (after only)
  if (label !== 'before') {
    await page.tap('#settingsBtn').catch(async () => page.evaluate(() => { document.getElementById('settingsSheet').hidden = false; }));
    await sleep(200);
    await page.evaluate(() => { const d = document.getElementById('inputLogBox'); d.open = true; d.scrollIntoView(); });
    await sleep(200);
    const logText = await page.inputValue('#inputLogText');
    check('⚙︎ 輸入紀錄：看得到 input／send 紀錄', /input deleteContentBackward/.test(logText) && /send ⌫0\+"然後現在需要按步驟，先按鍵盤打開來，"/.test(logText), logText.slice(0, 300));
    out.inputLogSample = logText.split('\n').slice(0, 14);
    await page.screenshot({ path: join(shotsDir, 'pkm31-input-log.png') });
  }
  await ctx.close();
} finally {
  await browser.close();
  await server.stop();
}
out.results = results;
writeFileSync(join(ROOT, `design/evidence/pkm31-dictation-${label}.json`), JSON.stringify(out, null, 1));
console.log(`${results.filter((r) => r.ok).length}/${results.length} PASS`);
