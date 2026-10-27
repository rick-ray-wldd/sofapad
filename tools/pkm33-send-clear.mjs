// PKM-3-3 (I-24, Ray's P-22) in a real page: headless Chrome, dry-run Mac (nothing is injected).
// 「聽寫 → 送出 → 再輸入／切模式」: after the text is sent, iOS puts it back into the box (with or without an input
// event, as dictation / an input method can); then Ray, now in LINE on the Mac, types or switches mode.
// Records every text the page sends after the first send. Old web (v2) vs current:
//   node tools/pkm33-send-clear.mjs --label before --web <web from 69a5626>   |   node tools/pkm33-send-clear.mjs --label after
import { chromium } from 'playwright-core';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { startServer, ROOT, IPHONE_UA, INSETS } from './test-server.mjs';

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => (v.startsWith('--') ? [...a, [v.slice(2), arr[i + 1]]] : a), []));
const label = args.label || 'run';
const webRoot = args.web || join(ROOT, 'web');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SECRET = '我在 Orca 說的私人內容，不要外流。';

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok ? '' : '  → ' + detail}`);
};

const server = await startServer({ webRoot });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const out = { label, scenarios: {} };
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: IPHONE_UA });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('PAGE ERROR ' + e.message));
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: INSETS.portrait });
  await page.goto(server.url + '#pair=' + server.code);
  await page.waitForFunction(() => document.getElementById('dot').classList.contains('ready'));
  await page.evaluate(() => {
    window.__sent = [];
    for (const fn of ['send', 'sendReliable']) {
      const orig = window.pkmLink[fn].bind(window.pkmLink);
      window.pkmLink[fn] = (m) => { if (m.t !== 'ping') window.__sent.push(m); return orig(m); };
    }
    const el = document.getElementById('input');
    window.__type = (s) => { el.value += s; el.dispatchEvent(new InputEvent('input', { inputType: 'insertText', data: s, bubbles: true })); };
    // dictation: the sentence grows a few words at a time, last word rewritten (I-21 pattern)
    window.__dictate = (s) => {
      for (let i = 4; i < s.length; i += 4) {
        el.value = s.slice(0, i - 2); el.dispatchEvent(new InputEvent('input', { inputType: 'deleteContentBackward', bubbles: true }));
        el.value = s.slice(0, i); el.dispatchEvent(new InputEvent('input', { inputType: 'insertText', data: s.slice(i - 2, i), bubbles: true }));
      }
      el.value = s; el.dispatchEvent(new InputEvent('input', { inputType: 'insertText', data: s.slice(-2), bubbles: true }));
    };
    window.__enter = () => el.dispatchEvent(new InputEvent('beforeinput', { inputType: 'insertLineBreak', bubbles: true, cancelable: true }));
    window.__ghost = (s, withEvent) => { el.value = s; if (withEvent) el.dispatchEvent(new InputEvent('input', { inputType: 'insertText', data: s, bubbles: true })); };
  });
  const texts = () => page.evaluate(() => window.__sent.filter((m) => m.t === 'text').map((m) => m.s));
  const reset = () => page.evaluate(() => { window.__sent = []; });
  const mode = () => page.evaluate(() => document.getElementById('modeBtn').textContent.trim());
  const setMode = async (want) => { if ((await mode()) !== want) await page.tap('#modeBtn'); await sleep(100); if ((await mode()) !== want) await page.tap('#modeBtn'); await sleep(100); };

  async function scenario(key, name, { buffer, ghostEvent, then }) {
    await page.evaluate(() => { const el = document.getElementById('input'); el.blur(); });
    await setMode(buffer ? '整段' : '即時');
    await page.evaluate(() => { const el = document.getElementById('input'); el.value = ''; el.focus(); });
    await page.evaluate((s) => window.__dictate(s), SECRET);
    await sleep(900);
    if (buffer) await page.tap('#sendBtn'); else await page.evaluate(() => window.__enter());
    await sleep(300);
    const first = await texts();
    await reset();
    await page.evaluate(([s, ev]) => window.__ghost(s, ev), [SECRET, ghostEvent]);
    await sleep(900);
    const boxAfterGhost = await page.inputValue('#input');
    await then();
    await sleep(1200);
    const later = await texts();
    const leaked = later.some((t) => t.includes('私人內容'));
    out.scenarios[key] = { name, first, boxAfterGhost, later, leaked };
    console.log(`${key}: first ${JSON.stringify(first)} | box after ghost ${JSON.stringify(boxAfterGhost)} | later ${JSON.stringify(later)}`);
    await reset();
    return { first, later, leaked, boxAfterGhost };
  }

  const r1 = await scenario('S1', '即時：Enter 送出 → 文字被放回（有 input 事件）→ 到 LINE 打一個字',
    { buffer: false, ghostEvent: true, then: () => page.evaluate(() => window.__type('L')) });
  const r2 = await scenario('S2', '即時：Enter 送出 → 文字被悄悄放回（沒有事件）→ 到 LINE 打一個字',
    { buffer: false, ghostEvent: false, then: () => page.evaluate(() => window.__type('L')) });
  const r3 = await scenario('S3', '整段：送出 → 文字被放回 → 切成即時',
    { buffer: true, ghostEvent: true, then: () => page.tap('#modeBtn') });
  const r4 = await scenario('S4', '整段：送出 → 文字被悄悄放回 → 到 LINE 打新訊息再按送出',
    { buffer: true, ghostEvent: false, then: async () => { await page.evaluate(() => { document.getElementById('input').focus(); window.__type('LINE'); }); await page.tap('#sendBtn'); } });

  for (const [k, r] of [['S1', r1], ['S2', r2], ['S3', r3], ['S4', r4]]) {
    check(`${k} 第一次送出：私人內容送到 Orca 一次`, r.first.join('') .includes('私人內容'), JSON.stringify(r.first));
    if (label === 'before') check(`${k} v2：之後又把私人內容送出去（重現 P-22）`, r.leaked, JSON.stringify(r.later));
    else check(`${k} 現在：之後不會再送出私人內容`, !r.leaked, JSON.stringify(r.later));
  }
  if (label !== 'before') {
    check('S1 現在：送到 LINE 的只有新打的字', JSON.stringify(r1.later) === '["L"]', JSON.stringify(r1.later));
    check('S4 現在：送到 LINE 的只有新訊息', JSON.stringify(r4.later) === '["LINE"]', JSON.stringify(r4.later));
    check('S1 現在：放回來的字當下就從輸入框拿掉', r1.boxAfterGhost === '', JSON.stringify(r1.boxAfterGhost));
    check('S2、S4 現在：悄悄放回來的字，不到 1 秒也從輸入框拿掉', r2.boxAfterGhost === '' && r4.boxAfterGhost === '', JSON.stringify([r2.boxAfterGhost, r4.boxAfterGhost]));
    // short replies typed again on purpose still go
    await setMode('即時');
    await page.evaluate(() => { const el = document.getElementById('input'); el.value = ''; el.focus(); window.__type('好的'); });
    await sleep(900);
    await page.evaluate(() => window.__enter());
    await sleep(200);
    await reset();
    await page.evaluate(() => window.__type('好的'));
    await sleep(900);
    check('短回覆「好的」再打一次照樣送出（不會被誤擋）', JSON.stringify(await texts()) === '["好的"]', JSON.stringify(await texts()));
  }
  await ctx.close();
} finally {
  await browser.close();
  await server.stop();
}
out.results = results;
writeFileSync(join(ROOT, `design/evidence/pkm33-send-clear-${label}.json`), JSON.stringify(out, null, 1));
console.log(`${results.filter((r) => r.ok).length}/${results.length} PASS`);
