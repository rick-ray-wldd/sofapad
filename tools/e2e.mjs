// End-to-end driver: the real phone page in headless Chrome (iPhone-sized, touch) → pkm-server → CGEvent → pkm-probe.
// Run through tools/e2e.sh, which starts the probe and the guarded server and checks the result.
import { chromium } from 'playwright-core';

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => (v.startsWith('--') ? [...a, [v.slice(2), arr[i + 1]]] : a), []));
const url = args.url;
const code = args.code;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, locale: 'zh-TW', colorScheme: 'dark',
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
});
// v2: record every key message the page sends, to prove no whole-Mac shortcut was ever sent.
await context.addInitScript(() => {
  window.__keys = [];
  const orig = WebSocket.prototype.send;
  WebSocket.prototype.send = function (data) {
    try { const m = JSON.parse(data); if (m.t === 'key') window.__keys.push({ k: m.k, mods: m.mods || [] }); } catch { /* ignore */ }
    return orig.call(this, data);
  };
});
const page = await context.newPage();
const log = [];
page.on('console', (m) => log.push(m.text()));
page.on('pageerror', (e) => log.push('PAGEERROR ' + e.message));
const cdp = await context.newCDPSession(page);

async function touch(type, points) {
  await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points.map((p, i) => ({ x: p[0], y: p[1], id: i + 1 })) });
}
async function tap(x, y, hold = 40) { await touch('touchStart', [[x, y]]); await sleep(hold); await touch('touchEnd', []); }
async function rect(sel) { return page.evaluate((s) => { const r = document.querySelector(s).getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; }, sel); }

const t0 = Date.now();
await page.goto(url + '#pair=' + code);
await page.waitForFunction(() => document.getElementById('dot').classList.contains('ready'), null, { timeout: 8000 });
const steps = [{ step: 'paired', ms: Date.now() - t0 }];

// Count acks and their latency from inside the page.
await page.evaluate(() => {
  window.__acks = [];
  const orig = window.pkmLink.onEvent;
  window.pkmLink.onEvent = (m) => { if (m.t === 'ack') window.__acks.push(m); orig(m); };
});

const pad = await rect('#pad');
const cx = pad.x + pad.w * 0.4;
const cy = pad.y + pad.h * 0.5;

// 1. cursor to the middle of the display (the probe window is centred there). The phone no longer has a
//    mini-map (PKM-2-3); the server still takes the absolute `jump` message, so the driver sends it directly.
await page.evaluate(() => window.pkmLink.send({ t: 'jump', x: 0.5, y: 0.5 }));
await sleep(250);
steps.push({ step: 'jump-center' });

// 2. one-finger move right
await touch('touchStart', [[cx, cy]]);
for (let i = 1; i <= 8; i++) { await sleep(16); await touch('touchMove', [[cx + i * 6, cy]]); }
await touch('touchEnd', []);
await sleep(200);
steps.push({ step: 'move-right' });

// 3. tap = left click; 4. double tap = double click
await tap(cx, cy); await sleep(700);
await tap(cx, cy); await sleep(90); await tap(cx, cy); await sleep(700);
steps.push({ step: 'click+double' });

// 5. two-finger tap = right click
await touch('touchStart', [[cx, cy], [cx + 50, cy]]); await sleep(60); await touch('touchEnd', []);
await sleep(400);
steps.push({ step: 'right-click' });

// 6. two-finger drag down = scroll
await touch('touchStart', [[cx, cy - 60], [cx + 50, cy - 60]]);
for (let i = 1; i <= 6; i++) { await sleep(16); await touch('touchMove', [[cx, cy - 60 + i * 15], [cx + 50, cy - 60 + i * 15]]); }
await sleep(200); // stop before lifting: no momentum
await touch('touchEnd', []);
await sleep(300);
steps.push({ step: 'scroll' });

// 7. long press, then drag
await touch('touchStart', [[cx, cy]]); await sleep(600);
for (let i = 1; i <= 6; i++) { await sleep(16); await touch('touchMove', [[cx - i * 5, cy + i * 3]]); }
await touch('touchEnd', []);
await sleep(400);
steps.push({ step: 'long-press-drag' });

// 8. Typing: Zhuyin-style composition (nothing must be sent while composing), then commit.
await page.focus('#input');
await cdp.send('Input.imeSetComposition', { text: 'ㄋㄧˇ', selectionStart: 3, selectionEnd: 3 });
await sleep(150);
const sentWhileComposing = await page.evaluate(() => window.pkmLink.pending.length + window.__acks.length);
await cdp.send('Input.insertText', { text: '你' });
await sleep(150);
await cdp.send('Input.imeSetComposition', { text: 'ㄏㄠˇ', selectionStart: 3, selectionEnd: 3 });
await sleep(150);
await cdp.send('Input.insertText', { text: '好' });
await sleep(100);
await cdp.send('Input.insertText', { text: '，' });
await page.keyboard.type(' Hello');
await cdp.send('Input.insertText', { text: '😀' });
await sleep(300);
// ⌫ key on the key strip deletes on the Mac (the emoji)
const bs = await rect('button[data-k="backspace"]');
await tap(bs.x + bs.w / 2, bs.y + bs.h / 2);
await sleep(200);
await page.keyboard.press('Enter');
await sleep(300);
// a second line in "整段" (buffered) mode: nothing is sent until 送出
const mode = await rect('#modeBtn');
await tap(mode.x + mode.w / 2, mode.y + mode.h / 2);
await page.focus('#input');
await cdp.send('Input.insertText', { text: '整段送出測試 OK' });
await sleep(200);
const ackBeforeSend = await page.evaluate(() => window.__acks.length);
const send = await rect('#sendBtn');
await tap(send.x + send.w / 2, send.y + send.h / 2);
await sleep(500);
const ackAfterSend = await page.evaluate(() => window.__acks.length);
steps.push({ step: 'typing' });

// ---------- v2 (PKM-2): pinch zoom, shortcut panel, custom shortcut, landscape full-screen pad ----------
// Never sent here: three-finger swipes, ⌃arrows, ⌘Tab, Spotlight, screenshots (whole-Mac actions, PKM-2 §2-5).
const v2 = !!args.v2;
if (v2) {
  await page.evaluate(() => document.activeElement.blur());
  await sleep(200);
  const p2 = await rect('#pad');
  const mx = p2.x + p2.w * 0.45;
  const my = p2.y + p2.h * 0.5;
  // 9. pinch out (zoom in) then pinch in (zoom out)
  await touch('touchStart', [[mx - 50, my]]); await sleep(12);
  await touch('touchStart', [[mx - 50, my], [mx + 50, my]]);
  for (let i = 1; i <= 10; i++) { await sleep(16); await touch('touchMove', [[mx - 50 - i * 5, my], [mx + 50 + i * 5, my]]); }
  await touch('touchEnd', []); await sleep(300);
  await touch('touchStart', [[mx - 100, my]]); await sleep(12);
  await touch('touchStart', [[mx - 100, my], [mx + 100, my]]);
  for (let i = 1; i <= 10; i++) { await sleep(16); await touch('touchMove', [[mx - 100 + i * 5, my], [mx + 100 - i * 5, my]]); }
  await touch('touchEnd', []); await sleep(300);
  steps.push({ step: 'pinch' });
  // 10. shortcut panel: 全選 ⌘A (selects everything typed so far in the probe)
  const sb = await rect('#shortcutsBtn');
  await tap(sb.x + sb.w / 2, sb.y + sb.h / 2); await sleep(200);
  const all = await rect('[data-group="edit"] button[data-combo="⌘A"]');
  await tap(all.x + all.w / 2, all.y + all.h / 2); await sleep(300);
  const close = await rect('#closeShortcuts');
  await tap(close.x + close.w / 2, close.y + close.h / 2); await sleep(150);
  steps.push({ step: 'panel-select-all' });
  // 11. live mode again, type over the selection
  const m2 = await rect('#modeBtn');
  await tap(m2.x + m2.w / 2, m2.y + m2.h / 2); await sleep(100);
  await page.focus('#input');
  await cdp.send('Input.insertText', { text: 'v2 OK' });
  await sleep(500);
  await page.evaluate(() => document.activeElement.blur());
  steps.push({ step: 'replace-selection' });
  // 12. custom shortcut made in the editor: ⌥⌘K
  await tap(sb.x + sb.w / 2, sb.y + sb.h / 2); await sleep(200);
  await page.click('#editShortcuts');
  await page.click('#addShortcut');
  await page.click('[data-pick="opt"]');
  await page.selectOption('#scKey', 'k');
  await page.click('#scSave');
  await page.click('#closeEditor');
  await sleep(150);
  const mine = await rect('[data-group="mine"] button[data-combo="⌥⌘K"]');
  await tap(mine.x + mine.w / 2, mine.y + mine.h / 2); await sleep(400);
  steps.push({ step: 'custom-shortcut' });
  // 13. landscape: full-screen pad, one tap = left click on the probe (the cursor is still over it)
  await page.setViewportSize({ width: 844, height: 390 });
  await sleep(400);
  const pl = await rect('#pad');
  steps.push({ step: 'landscape', pad: { w: pl.w, h: pl.h } });
  await tap(pl.x + pl.w * 0.5, pl.y + pl.h * 0.5); await sleep(500);
  await page.setViewportSize({ width: 390, height: 844 });
  await sleep(300);
  steps.push({ step: 'landscape-tap' });
}
const keysSent = await page.evaluate(() => window.__keys);
const systemWide = keysSent.filter((k) => (k.mods.includes('ctrl') && !k.mods.includes('cmd') && ['left', 'right', 'up', 'down'].includes(k.k))
  || (k.mods.includes('cmd') && ['tab', 'space'].includes(k.k)) || (k.mods.includes('cmd') && k.mods.includes('shift') && ['3', '4', '5'].includes(k.k)));

const acks = await page.evaluate(() => window.__acks.map((a) => ({ id: a.id, ok: a.ok, via: a.via, us: a.us, latency: a.latency })));
console.log(JSON.stringify({ v2, steps, sentWhileComposing, ackBeforeSend, ackAfterSend, acks, keysSent, systemWideSent: systemWide.length, console: log.slice(-20), ms: Date.now() - t0 }));
await browser.close();
