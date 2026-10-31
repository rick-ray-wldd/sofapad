// SOFA-6 cursor pad in a real page: headless Chrome with touch events (CDP), dry-run Mac — its log lists the keys it
// would press. Hold → drag → arrow keys; second finger / 選取 → Shift; a quick swipe without holding → nothing; at most
// 30 presses a second; nothing after the finger lifts; the typed text is sent and the box emptied first.
//   node tools/sofa6-caret.mjs
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { startServer, ROOT, IPHONE_UA, INSETS } from './test-server.mjs';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok ? '' : '  → ' + detail}`);
};
const NAMES = { 123: 'left', 124: 'right', 125: 'down', 126: 'up' };

const server = await startServer();
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const out = { runs: {} };
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'zh-TW', colorScheme: 'dark', userAgent: IPHONE_UA });
  // SOFA-10 (I-53): count the cursor-pad presses the page sends, so "at lift" can wait for the Mac's log to have them all
  await ctx.addInitScript(() => {
    window.__caretSent = 0;
    const send = WebSocket.prototype.send;
    WebSocket.prototype.send = function (d) { try { if (JSON.parse(d).t === 'caret') window.__caretSent++; } catch { /* not JSON */ } return send.call(this, d); };
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('PAGE ERROR ' + e.message));
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: INSETS.portrait });
  await page.goto(server.url + '#pair=' + server.code);
  await page.waitForFunction(() => document.getElementById('dot').classList.contains('ready'));
  await page.evaluate(() => { if (document.getElementById('modeBtn').textContent.trim() !== '即時') document.getElementById('modeBtn').click(); });

  let mark = 0;
  /** Mac's dry-run log since the last call: text, click, arrows as "shift+right" … */
  const macSince = () => {
    const lines = [...server.log().matchAll(/\[dry-run\] (.*)/g)].map((m) => m[1]);
    const fresh = lines.slice(mark);
    mark = lines.length;
    return fresh.map((l) => {
      let m;
      if ((m = /^type (".*")$/.exec(l))) return JSON.parse(m[1]);
      if ((m = /^click (\w+)$/.exec(l))) return 'click';
      if ((m = /^key (\d+) mods \[(.*)\]$/.exec(l))) {
        const mods = m[2] ? m[2].split(',').map((x) => JSON.parse(x.trim())) : [];
        return (mods.length ? mods.join('+') + '+' : '') + (NAMES[m[1]] || 'key' + m[1]);
      }
      return l;
    });
  };
  const touch = (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points.map((p, i) => ({ x: p.x, y: p.y, id: p.id ?? i, radiusX: 4, radiusY: 4, force: 1 })) });
  const typing = async (s) => {
    await page.evaluate((s) => {
      const el = document.getElementById('input');
      el.focus();
      for (const ch of s) { el.setRangeText(ch, el.selectionStart, el.selectionEnd, 'end'); el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: ch })); }
    }, s);
    await sleep(300);
  };
  const box = async () => page.locator('#caretPad').boundingBox();
  /** Hold `holdMs` at the pad's centre, then drag `dx`, `dy` in `ms` (16 ms steps). `second`: a second finger taps mid-way. */
  const macKeys = () => [...server.log().matchAll(/\[dry-run\] key /g)].length;
  async function drag({ holdMs = 350, dx = 0, dy = 0, ms = 600, second = null, liftWait = 600 }) {
    const sent0 = await page.evaluate(() => window.__caretSent);
    const keys0 = macKeys();
    const b = await box();
    const x0 = b.x + b.width / 2;
    const y0 = b.y + b.height / 2;
    await touch('touchStart', [{ x: x0, y: y0, id: 1 }]);
    await sleep(holdMs);
    const n = Math.max(1, Math.round(ms / 16));
    const t0 = Date.now();
    for (let i = 1; i <= n; i++) {
      const p = { x: x0 + (dx * i) / n, y: y0 + (dy * i) / n, id: 1 };
      if (second && i === Math.round(n / 2)) {
        const s = { x: second.x, y: second.y, id: 2 };
        await touch('touchStart', [p, s]);
        await sleep(40);
        await touch('touchEnd', [s]);      // CDP: the points listed are the ones lifted
      }
      await touch('touchMove', [p]);
      await sleep(Math.max(0, t0 + (ms * i) / n - Date.now()));
    }
    const dragMs = Date.now() - t0;
    await touch('touchEnd', []);
    // A press sent in the same moment as the lift can reach the Mac's log a few ms after this point; wait (≤ 0.5 s) until
    // the log has every press the page sent before the lift. One sent after the lift still shows up in `after`.
    const sentAtLift = (await page.evaluate(() => window.__caretSent)) - sent0;
    for (let w = 0; w < 50 && macKeys() - keys0 < sentAtLift; w++) await sleep(10);
    const atLift = macSince();
    await sleep(liftWait);
    return { atLift, after: macSince(), dragMs };
  }
  const arrows = (seq) => seq.filter((x) => /(left|right|up|down)$/.test(x));

  // 1. type, then hold and drag left: the text goes first, the box empties, then ←×N
  macSince();
  await typing('hello');
  macSince();
  await page.evaluate(() => { const el = document.getElementById('input'); el.focus(); });
  await sleep(200);
  const visible = await page.isVisible('#caretPad');
  check('游標板在輸入框右邊', visible);
  await typing(' world');
  const r1 = await drag({ dx: -70, ms: 700 });
  out.runs.left = r1;
  const firstArrow = r1.atLift.findIndex((k) => /left$/.test(k));
  check('開始拖之前，等待中的字先送到 Mac', firstArrow > 0 && r1.atLift.slice(0, firstArrow).join('').endsWith('world') && !r1.atLift.slice(firstArrow).some((k) => /world/.test(k)), JSON.stringify(r1.atLift.slice(0, 3)));
  check('慢慢往左拖 70 px：← 約 5 下', arrows(r1.atLift).length >= 4 && arrows(r1.atLift).length <= 6 && arrows(r1.atLift).every((k) => k === 'left'), JSON.stringify(r1.atLift));
  check('拖完後輸入框是空的', (await page.inputValue('#input')) === '', await page.inputValue('#input'));
  check('放開後不再送任何鍵', r1.after.length === 0, JSON.stringify(r1.after));

  // 2. up / down
  const r2 = await drag({ dy: 70, ms: 600 });
  check('往下拖 70 px：↓ 2 下', JSON.stringify(arrows(r2.atLift)) === '["down","down"]', JSON.stringify(r2.atLift));

  // 3. quick swipe without holding: nothing
  const r3 = await drag({ holdMs: 30, dx: 120, ms: 200 });
  check('沒按住就滑過去：不送任何鍵', r3.atLift.length === 0 && r3.after.length === 0, JSON.stringify(r3));

  // 4. second finger mid-drag: Shift from then on, this drag only
  const pad = await page.locator('#pad').boundingBox();
  const r4 = await drag({ dx: 84, ms: 900, second: { x: pad.x + pad.width / 2, y: pad.y + 80 } });
  out.runs.second = r4;
  const a4 = arrows(r4.atLift);
  const firstShift = a4.findIndex((k) => k.startsWith('shift+'));
  check('第二指點一下後改成 Shift＋→（選取）', firstShift > 0 && a4.slice(firstShift).every((k) => k === 'shift+right') && a4.slice(0, firstShift).every((k) => k === 'right'), JSON.stringify(a4));
  check('第二指沒有在觸控板上點擊', !r4.atLift.includes('click') && !r4.after.includes('click'), JSON.stringify(r4));
  const r4b = await drag({ dx: 28, ms: 400 });
  check('下一次拖曳不再選取', JSON.stringify(arrows(r4b.atLift)) === '["right","right"]', JSON.stringify(r4b.atLift));

  // 5. 選取 switch
  await page.tap('#caretSelect');
  const pressed = await page.getAttribute('#caretSelect', 'aria-pressed');
  const r5 = await drag({ dx: -28, ms: 400 });
  check('按「選取」：Shift＋←', pressed === 'true' && JSON.stringify(arrows(r5.atLift)) === '["shift+left","shift+left"]', JSON.stringify([pressed, r5.atLift]));
  await page.tap('#caretSelect');

  // 6. a flick: ⌥→ (a word at a time)
  const r6 = await drag({ dx: 300, ms: 150 });
  check('快速甩動：⌥→（一次一個字詞）', arrows(r6.atLift).some((k) => k === 'opt+right') && arrows(r6.atLift).every((k) => k.endsWith('right')), JSON.stringify(r6.atLift));

  // 7. far more than 30 a second asked for: capped, and it stops when the finger lifts
  const r7 = await drag({ dx: 1300, ms: 1000, liftWait: 800 });
  out.runs.fast = r7;
  const n7 = arrows(r7.atLift).length;
  const rate = (n7 * 1000) / r7.dragMs;
  out.runs.fast.rate = rate;
  check('拖很快也最多每秒約 30 下', rate <= 31.5 && rate >= 20, `${n7} presses in ${r7.dragMs} ms = ${rate.toFixed(1)}/s`);
  check('放開手指立刻停（之後 0.8 秒沒有鍵）', r7.after.length === 0, JSON.stringify(r7.after));

  await page.screenshot({ path: join(ROOT, 'design/screenshots/v4/sofa6-caret-bar.png') });
  // the pad in cursor mode, selecting
  {
    const b = await box();
    await page.tap('#caretSelect');
    await touch('touchStart', [{ x: b.x + b.width / 2, y: b.y + b.height / 2, id: 1 }]);
    await sleep(400);
    await page.screenshot({ path: join(ROOT, 'design/screenshots/v4/sofa6-caret-selecting.png'), clip: { x: 0, y: b.y - 120, width: 390, height: 190 } });
    await touch('touchEnd', []);
    await page.tap('#caretSelect');
  }
  // the Mac refuses anything but arrows with Shift / Option
  macSince();
  await page.evaluate(() => {
    for (const m of [{ k: 'a' }, { k: 'enter' }, { k: 'left', mods: ['cmd'] }, { k: 'left', mods: ['ctrl'] }, { k: 'left', n: 50 }]) window.pkmLink.send({ t: 'caret', mods: [], n: 1, ...m });
  });
  await sleep(400);
  const refused = macSince();
  check('Mac 不接受方向鍵以外的鍵或 ⌘／⌃（游標板白名單）', refused.length === 0, JSON.stringify(refused));
} finally {
  await browser.close();
  await server.stop();
}
out.results = results;
const passed = results.filter((r) => r.ok).length;
console.log(`${passed}/${results.length} PASS`);
mkdirSync(join(ROOT, 'design/evidence/sofa6'), { recursive: true });
writeFileSync(join(ROOT, 'design/evidence/sofa6/caret-browser.json'), JSON.stringify(out, null, 1));
process.exitCode = passed === results.length ? 0 : 1;
