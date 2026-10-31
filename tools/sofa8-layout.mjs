// SOFA-8 (4.3) in a real page: headless Chrome with touch (CDP), dry-run Mac — its log lists what it would type and press.
// Portrait: the box is half the row, the cursor pad and ⏎ the other half; ⏎ goes after the typed text; the I-13 height
// while typing. The editor: three rows, drag ≡ (a real touch drag), ⇧ 選取 and the cursor pad as cells, moved and taken
// out (a second finger still selects), saved, 全部恢復預設; a 4.2 phone's saved row is converted. Landscape: the side
// panel and the trackpad's size (D-48), typing, collapsing, 左手模式, other phone sizes.
//   node tools/sofa8-layout.mjs [--video DIR]     (--video: also records each phone screen as frames + an ffmpeg list,
//                                                  with the touches drawn; see screencast.mjs)
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { startServer, ROOT, IPHONE_UA, INSETS } from './test-server.mjs';
import { startScreencast } from './screencast.mjs';

const args = process.argv.slice(2);
const videoDir = args.includes('--video') ? args[args.indexOf('--video') + 1] : null;
const shotsDir = join(ROOT, 'design/screenshots/v4');
const evDir = join(ROOT, 'design/evidence/sofa8');
mkdirSync(shotsDir, { recursive: true });
mkdirSync(evDir, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const measures = {};
const check = (name, ok, detail = '') => {
  results.push({ name, ok: !!ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok ? '' : '  → ' + detail}`);
};
const NAMES = { 123: 'left', 124: 'right', 125: 'down', 126: 'up', 36: 'enter', 51: 'backspace', 8: 'c' };
const MODS = { command: 'cmd', control: 'ctrl', option: 'opt', shift: 'shift' };
// iOS keyboard heights in CSS px (research/raw/v2-ios-keyboard.md): portrait Zhuyin in a Safari tab 380 (I-13);
// landscape ≈ 200 with the candidate bar, ≈ 240 with Safari's form bar too.
const KBD = { portraitSafari: 380, landscape: 200, landscapeSafari: 240 };

/** Like iOS: the keyboard only shrinks the visual viewport (copied from tools/touch-area.mjs). */
const fakeVisualViewport = () => {
  const listeners = {};
  const vv = {
    width: innerWidth, height: innerHeight, offsetTop: 0, offsetLeft: 0, pageTop: 0, pageLeft: 0, scale: 1,
    addEventListener(type, fn) { (listeners[type] ||= []).push(fn); },
    removeEventListener(type, fn) { listeners[type] = (listeners[type] || []).filter((f) => f !== fn); },
  };
  Object.defineProperty(window, 'visualViewport', { value: vv, configurable: true });
  window.__keyboard = 0;
  window.__setKeyboard = (h) => {
    window.__keyboard = h;
    vv.width = innerWidth;
    vv.height = innerHeight - h;
    let kb = document.getElementById('__kb');
    if (!kb) {
      kb = document.createElement('div');
      kb.id = '__kb';
      kb.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:99;background:#3b3f46;color:#c9ced6;font:14px -apple-system,sans-serif;display:flex;align-items:center;justify-content:center;pointer-events:none';
      document.body.append(kb);
    }
    kb.style.height = h + 'px';
    kb.style.display = h ? 'flex' : 'none';
    kb.textContent = `（模擬 iOS 鍵盤 ${h} px）`;
    for (const fn of listeners.resize || []) fn({ type: 'resize' });
  };
  addEventListener('resize', () => window.__setKeyboard(window.__keyboard));
};
/** For the recording only: a circle where each finger is. */
const drawTouches = () => {
  const dots = new Map();
  const show = (e) => {
    for (const t of e.changedTouches) {
      let d = dots.get(t.identifier);
      if (!d) {
        d = document.createElement('div');
        d.style.cssText = 'position:fixed;width:38px;height:38px;margin:-19px 0 0 -19px;border-radius:50%;background:rgba(255,255,255,.35);border:2px solid rgba(255,255,255,.8);z-index:200;pointer-events:none';
        document.documentElement.append(d);
        dots.set(t.identifier, d);
      }
      d.style.left = t.clientX + 'px';
      d.style.top = t.clientY + 'px';
    }
  };
  const hide = (e) => { for (const t of e.changedTouches) { dots.get(t.identifier)?.remove(); dots.delete(t.identifier); } };
  addEventListener('touchstart', show, { capture: true, passive: true });
  addEventListener('touchmove', show, { capture: true, passive: true });
  addEventListener('touchend', hide, { capture: true, passive: true });
  addEventListener('touchcancel', hide, { capture: true, passive: true });
};

const server = await startServer();
const browser = await chromium.launch({ channel: 'chrome', headless: true });
let mark = 0;
// A pairing code pairs one phone only (v1 security design): later phones reuse the first one's token (as v2-browser).
let token = null;
const videoLists = [];
/** Mac's dry-run log since the last call: "hello" for text, "enter", "shift+left", "cmd+c" … */
const macSince = () => {
  const lines = [...server.log().matchAll(/\[dry-run\] (.*)/g)].map((m) => m[1]);
  const fresh = lines.slice(mark);
  mark = lines.length;
  return fresh.map((l) => {
    let m;
    if ((m = /^type (".*")$/.exec(l))) return JSON.parse(m[1]);
    if ((m = /^key (\d+) mods \[(.*)\]$/.exec(l))) {
      const mods = m[2] ? m[2].split(',').map((x) => MODS[JSON.parse(x.trim())] || JSON.parse(x.trim())) : [];
      return (mods.length ? mods.join('+') + '+' : '') + (NAMES[m[1]] || 'key' + m[1]);
    }
    return l;
  }).filter((x) => !/^(move|scroll|release all)/.test(x));
};

async function phone({ width, height, insets, name }) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, locale: 'zh-TW', colorScheme: 'dark', userAgent: IPHONE_UA });
  await ctx.addInitScript(fakeVisualViewport);
  if (videoDir) await ctx.addInitScript(drawTouches);
  if (token) await ctx.addInitScript((t) => { if (!localStorage.getItem('pkm.token')) localStorage.setItem('pkm.token', t); }, token);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log(`PAGE ERROR (${name}) ${e.message}`));
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets });
  await page.goto(server.url + (token ? '' : '#pair=' + server.code));
  await page.waitForFunction(() => document.getElementById('dot').classList.contains('ready'));
  token ||= await page.evaluate(() => localStorage.getItem('pkm.token'));
  if (videoDir) {
    const cast = await startScreencast(page, join(videoDir, name), { maxWidth: Math.max(width, height), maxHeight: Math.max(width, height) });
    const close = ctx.close.bind(ctx);
    ctx.close = async () => { videoLists.push(await cast.stop()); return close(); };
  }
  await sleep(300);
  const touch = (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points.map((p, i) => ({ x: p.x, y: p.y, id: p.id ?? i, radiusX: 4, radiusY: 4, force: 1 })) });
  const box = (sel) => page.evaluate((s) => {
    const e = document.querySelector(s);
    if (!e || e.closest('[hidden]') || !e.getClientRects().length) return null;
    const r = e.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), r: Math.round(r.right), b: Math.round(r.bottom) };
  }, sel);
  const texts = (sel) => page.evaluate((s) => [...document.querySelectorAll(s)].map((b) => b.textContent.trim()), sel);
  /** A tap with a real touch at the element's centre. */
  const tapEl = async (sel) => {
    const b = await box(sel);
    if (!b) throw new Error('not visible: ' + sel);
    await touch('touchStart', [{ x: b.x + b.w / 2, y: b.y + b.h / 2, id: 1 }]);
    await sleep(60);
    await touch('touchEnd', []);
    await sleep(120);
  };
  const type = async (s) => {
    await page.evaluate((s) => {
      const el = document.getElementById('input');
      el.focus();
      for (const ch of s) { el.setRangeText(ch, el.selectionStart, el.selectionEnd, 'end'); el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: ch })); }
    }, s);
    await sleep(300);
  };
  /** Hold the cursor pad, then drag dx/dy; `second`: another finger taps half-way. Returns the Mac's keys. */
  const caretDrag = async ({ dx = 0, dy = 0, ms = 600, second = null }) => {
    const b = await box('#caretPad');
    const x0 = b.x + b.w / 2;
    const y0 = b.y + b.h / 2;
    macSince();
    await touch('touchStart', [{ x: x0, y: y0, id: 1 }]);
    await sleep(380);
    const n = Math.max(1, Math.round(ms / 16));
    for (let i = 1; i <= n; i++) {
      const p = { x: x0 + (dx * i) / n, y: y0 + (dy * i) / n, id: 1 };
      if (second && i === Math.round(n / 2)) {
        await touch('touchStart', [p, { ...second, id: 2 }]);
        await sleep(40);
        await touch('touchEnd', [{ ...second, id: 2 }]);
      }
      await touch('touchMove', [p]);
      await sleep(16);
    }
    await sleep(150);
    await touch('touchEnd', []);
    await sleep(300);
    return macSince().filter((k) => /(left|right|up|down)$/.test(k));
  };
  /** Drag an editor row's ≡ with a real touch drag onto the row with id `toId`. */
  const dragHandle = async (id, toId) => {
    const pt = async (sel) => { const b = await box(sel); return { x: b.x + b.w / 2, y: b.y + b.h / 2 }; };
    await page.evaluate((id) => document.querySelector(`#rowCurrent li[data-id="${id}"]`).scrollIntoView({ block: 'center' }), id);
    await sleep(100);
    const from = await pt(`#rowCurrent li[data-id="${id}"] .handle`);
    const to = await pt(`#rowCurrent li[data-id="${toId}"]`);
    await touch('touchStart', [{ x: from.x, y: from.y, id: 1 }]);
    for (let i = 1; i <= 16; i++) {
      await sleep(20);
      await touch('touchMove', [{ x: from.x + (to.x - from.x) * (i / 16), y: from.y + (to.y - from.y) * (i / 16), id: 1 }]);
    }
    await sleep(80);
    await touch('touchEnd', []);
    await sleep(250);
  };
  const editorIds = () => page.evaluate(() => [...document.querySelectorAll('#rowCurrent li[data-id]')].map((li) => li.dataset.id));
  const setKeyboard = async (h) => { await page.evaluate((h) => window.__setKeyboard(h), h); await sleep(250); };
  return { ctx, page, cdp, touch, box, texts, tapEl, type, caretDrag, dragHandle, editorIds, setKeyboard };
}

const KEYROW_DEFAULT = ['即時', '⌘ 快捷鍵', '⇧ 選取', 'esc', 'tab', '⌫', '←', '↑', '↓', '→', '⌘', '⌥', '⌃', '⇧', 'space', '⌦', '✎ 編輯'];
try {
  // ---------------- portrait, 390 × 844 ----------------
  {
    const P = await phone({ width: 390, height: 844, insets: INSETS.portrait, name: 'portrait' });
    const { page } = P;
    await page.evaluate(() => { if (document.getElementById('modeBtn').textContent.trim() !== '即時') document.getElementById('modeBtn').click(); });
    const input = await P.box('#input');
    const caret = await P.box('#inputCells #caretPad');
    const enter = await P.box('#inputCells [data-id="k:enter"]');
    measures.portrait390 = { input, caret, enter, pad: await P.box('#pad') };
    check('直拿 390：輸入框約手機寬度的一半（42–52%）', input && input.w / 390 >= 0.42 && input.w / 390 <= 0.52, JSON.stringify(input));
    check('直拿 390：另一半是游標板，⏎ 在游標板右邊、靠右邊緣', caret && enter && caret.x > input.r && enter.x >= caret.r && Math.abs(enter.r - 380) <= 2 && caret.y === enter.y, JSON.stringify({ caret, enter }));
    check('直拿：游標板比 4.2 寬（4.2 是 76 px）', caret.w > 76, JSON.stringify(caret));
    check('按鍵列：即時、⌘ 快捷鍵、⇧ 選取（現在是一般按鍵）、esc…⌦、✎ 編輯', JSON.stringify(await P.texts('#keyStrip button')) === JSON.stringify(KEYROW_DEFAULT), JSON.stringify(await P.texts('#keyStrip button')));
    await page.screenshot({ path: join(shotsDir, 'sofa8-portrait-390.png') });

    // ⏎ next to the cursor pad: the typed text first, then Enter; the box empties
    macSince();
    await P.type('hello');
    await P.tapEl('#inputCells [data-id="k:enter"]');
    await sleep(300);
    const sentEnter = macSince();
    check('打 hello 再點輸入列的 ⏎：Mac 先打 hello 再按 Enter，輸入框清空', sentEnter.join('|').endsWith('enter') && sentEnter.join('').includes('hello') && sentEnter.indexOf('enter') > sentEnter.findIndex((x) => x.includes('o')) && (await page.inputValue('#input')) === '', JSON.stringify(sentEnter));
    check('點 ⏎ 後鍵盤還在（可以接著打）', await page.evaluate(() => document.activeElement === document.getElementById('input')));
    const left = await P.caretDrag({ dx: -42 });
    check('輸入列的游標板：按住往左拖 42 px → ← 約 3 下', left.length >= 2 && left.length <= 4 && left.every((k) => k === 'left'), JSON.stringify(left));

    // I-13: typing with the Safari-tab keyboard
    await P.type('打字中');
    await P.setKeyboard(KBD.portraitSafari);
    const padKbd = await P.box('#pad');
    const rowKbd = await P.box('.typing');
    const vvh = await page.evaluate(() => window.visualViewport.height);
    measures.portraitTyping = { pad: padKbd, typingRow: rowKbd, visible: vvh };
    check('直拿打字（Safari 鍵盤，可視 464 px）：觸控板高度 ≥ 290 px（I-13）', padKbd.h >= 290, JSON.stringify(padKbd));
    check('直拿打字：輸入列（框、游標板、⏎）都在鍵盤上面', rowKbd.b <= vvh + 0.5 && (await P.box('#inputCells [data-id="k:enter"]')).b <= vvh + 0.5, JSON.stringify({ rowKbd, vvh }));
    await page.screenshot({ path: join(shotsDir, 'sofa8-portrait-typing.png') });
    // the half-width box wraps after about 9 characters: live mode stays one line, so the pad keeps its height
    await P.type('這一句比較長，在半寬的輸入框裡會換到第二行');
    const padLong = await P.box('#pad');
    measures.portraitTypingLong = { pad: padLong, input: await P.box('#input') };
    check('即時模式打長句（半寬的框會換行）：輸入框維持一行，觸控板 ≥ 290 px', padLong.h >= 290 && measures.portraitTypingLong.input.h <= 46, JSON.stringify(measures.portraitTypingLong));
    await page.evaluate(() => document.getElementById('input').blur());
    await P.setKeyboard(0);
    macSince();

    // the editor: ⇧ 選取 is an ordinary cell
    await page.evaluate(() => { const s = document.getElementById('keyStrip'); s.scrollLeft = s.scrollWidth; });
    await sleep(150);
    await P.tapEl('#keyStrip .row-edit');
    await sleep(200);
    check('✎ 打開編輯畫面，在「按鍵列」分頁', await page.evaluate(() => !document.getElementById('rowSheet').hidden && document.querySelector('#rowTabs [aria-selected="true"]').dataset.row === 'keys'));
    await P.dragHandle('x:select', 'k:backspace');
    let ids = await P.editorIds();
    check('按住 ≡ 拖曳：⇧ 選取 拖到 ⌫ 的位置（⌫ 往前一格）', ids.indexOf('x:select') === 3 && ids[2] === 'k:backspace' && ids[0] === 'k:escape', JSON.stringify(ids));
    await page.screenshot({ path: join(shotsDir, 'sofa8-editor-keys.png') });
    await page.click('#rowCurrent li[data-id="x:select"] button[aria-label="移除"]');
    await sleep(100);
    check('✕ 拿掉 ⇧ 選取；清單裡「⇧ 選取」變成沒選', !(await P.editorIds()).includes('x:select') && (await page.getAttribute('#rowCatalog button[data-id="x:select"]', 'aria-pressed')) === 'false');

    // the input row tab: ⏎ before the cursor pad, add ⌫
    await page.click('#rowTabs [data-row="input"]');
    await sleep(100);
    check('「輸入列」分頁：游標板、⏎', JSON.stringify(await P.editorIds()) === '["x:caret","k:enter"]', JSON.stringify(await P.editorIds()));
    await P.dragHandle('k:enter', 'x:caret');
    await page.click('#rowCatalog button[data-id="k:backspace"]');
    await sleep(100);
    ids = await P.editorIds();
    check('輸入列：⏎ 拖到游標板前面，從清單加 ⌫', JSON.stringify(ids) === '["k:enter","x:caret","k:backspace"]', JSON.stringify(ids));
    await page.screenshot({ path: join(shotsDir, 'sofa8-editor-input.png') });
    await page.click('#rowDone');
    await sleep(200);
    const order = await page.evaluate(() => [...document.querySelectorAll('#inputCells > *')].map((e) => [e.dataset.id || e.id, Math.round(e.getBoundingClientRect().x)]));
    check('畫面上的輸入列照編輯的順序：⏎、游標板、⌫', JSON.stringify(order.map((o) => o[0])) === '["k:enter","caretPad","k:backspace"]' && order[0][1] < order[1][1] && order[1][1] < order[2][1], JSON.stringify(order));
    check('按鍵列上沒有 ⇧ 選取了', !(await P.texts('#keyStrip button')).includes('⇧ 選取'));
    await page.screenshot({ path: join(shotsDir, 'sofa8-portrait-edited.png') });

    // ⇧ 選取 gone: a second finger still selects (SOFA-6)
    const padBox = await P.box('#pad');
    const sel = await P.caretDrag({ dx: 84, ms: 900, second: { x: padBox.x + padBox.w / 2, y: padBox.y + 80 } });
    const firstShift = sel.findIndex((k) => k.startsWith('shift+'));
    check('拿掉 ⇧ 選取 以後：拖曳時第二指點一下，照樣改成 Shift＋→ 選取', firstShift > 0 && sel.slice(firstShift).every((k) => k === 'shift+right'), JSON.stringify(sel));

    // the cursor pad moved to the key row
    await page.evaluate(() => { const s = document.getElementById('keyStrip'); s.scrollLeft = s.scrollWidth; });
    await sleep(150);
    await P.tapEl('#keyStrip .row-edit');
    await page.click('#rowCatalog button[data-id="x:caret"]');
    await sleep(100);
    const msg = await page.textContent('#rowMsg');
    await page.click('#rowDone');
    await sleep(200);
    check('游標板從輸入列移到按鍵列（只有一個）', /從輸入列移到按鍵列/.test(msg) && !!(await P.box('#keyStrip #caretPad')) && !(await page.$('#inputCells #caretPad')), msg);
    await page.evaluate(() => document.getElementById('caretPad').scrollIntoView({ inline: 'center' }));
    await sleep(200);
    const inKeys = await P.caretDrag({ dx: 42 });
    check('游標板在按鍵列也能用：往右拖 42 px → → 約 3 下', inKeys.length >= 2 && inKeys.length <= 4 && inKeys.every((k) => k === 'right'), JSON.stringify(inKeys));

    // saved on the phone, then 全部恢復預設
    await page.reload();
    await page.waitForFunction(() => document.getElementById('dot').classList.contains('ready'));
    await sleep(300);
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('pkm.layout')));
    check('重新整理後還是編輯過的樣子（存在手機）', JSON.stringify(saved.input) === '["k:enter","k:backspace"]' && saved.keys.at(-1) === 'x:caret' && !!(await page.$('#keyStrip #caretPad')), JSON.stringify(saved));
    await page.evaluate(() => { const s = document.getElementById('keyStrip'); s.scrollLeft = s.scrollWidth; });
    await sleep(150);
    await P.tapEl('#keyStrip .row-edit');
    await page.click('#rowReset');
    await page.click('#rowDone');
    await sleep(200);
    check('全部恢復預設：輸入列＝游標板＋⏎，按鍵列＝預設', JSON.stringify(await P.texts('#keyStrip button')) === JSON.stringify(KEYROW_DEFAULT) && !!(await page.$('#inputCells #caretPad + [data-id="k:enter"]')), JSON.stringify(await P.texts('#keyStrip button')));

    // 375 wide (iPhone SE / mini)
    await page.setViewportSize({ width: 375, height: 667 });
    await sleep(300);
    const c375 = await P.box('#inputCells');
    const e375 = await P.box('#inputCells [data-id="k:enter"]');
    measures.portrait375 = { cells: c375, enter: e375, caret: await P.box('#caretPad'), input: await P.box('#input') };
    check('直拿 375：輸入列放得下（⏎ 不超出畫面），游標板 ≥ 76 px', e375.r <= 375 - 9 && measures.portrait375.caret.w >= 76, JSON.stringify(measures.portrait375));
    await page.screenshot({ path: join(shotsDir, 'sofa8-portrait-375.png') });
    await P.ctx.close();
  }

  // ---------------- a 4.2 phone's saved key row ----------------
  {
    const P = await phone({ width: 390, height: 844, insets: INSETS.portrait, name: 'migrate' });
    const { page } = P;
    const edited = ['c:cmd+c', 'k:tab', 'k:enter', 'm:cmd'];
    await page.evaluate((items) => { localStorage.removeItem('pkm.layout'); localStorage.setItem('pkm.keyrow', JSON.stringify({ version: 1, items })); }, edited);
    await page.reload();
    await page.waitForFunction(() => document.getElementById('dot').classList.contains('ready'));
    await sleep(400);
    const row = await P.texts('#keyStrip button');
    const banner = await page.textContent('#banner');
    const stored = await page.evaluate(() => ({ v1: localStorage.getItem('pkm.keyrow'), v2: JSON.parse(localStorage.getItem('pkm.layout')) }));
    check('4.2 改過的按鍵列：升級後一個都沒少，⇧ 選取在前面（4.2 固定的位置）', JSON.stringify(row) === JSON.stringify(['即時', '⌘ 快捷鍵', '⇧ 選取', '⌘C', 'tab', '⏎', '⌘', '✎ 編輯']), JSON.stringify(row));
    check('升級時跳出說明；輸入列是游標板＋⏎', /已更新到 4\.3/.test(banner) && !!(await page.$('#inputCells #caretPad + [data-id="k:enter"]')), banner);
    check('存成 layout version 2；4.2 的 keyrow 沒動（裝回 4.2 也還在）', stored.v2.version === 2 && stored.v1 === JSON.stringify({ version: 1, items: edited }), JSON.stringify(stored));
    await page.screenshot({ path: join(shotsDir, 'sofa8-migrated.png') });
    await page.evaluate(() => { localStorage.removeItem('pkm.layout'); localStorage.setItem('pkm.keyrow', JSON.stringify({ version: 1, items: ['k:escape', 'k:tab', 'k:backspace', 'k:enter', 'k:left', 'k:up', 'k:down', 'k:right', 'm:cmd', 'm:opt', 'm:ctrl', 'm:shift', 'k:space', 'k:forwarddelete'] })); });
    await page.reload();
    await page.waitForFunction(() => document.getElementById('dot').classList.contains('ready'));
    await sleep(300);
    check('4.2 沒改過的按鍵列：升級成新的預設', JSON.stringify(await P.texts('#keyStrip button')) === JSON.stringify(KEYROW_DEFAULT));
    await P.ctx.close();
  }

  // ---------------- landscape, 844 × 390 ----------------
  {
    const P = await phone({ width: 844, height: 390, insets: INSETS.landscape, name: 'landscape' });
    const { page } = P;
    const pad = await P.box('#pad');
    const panel = await P.box('#controls');
    const portraitPad = measures.portrait390.pad;
    measures.landscape844 = { pad, panel, strip: await P.box('#strip'), input: await P.box('#input'), caret: await P.box('#caretPad'), enter: await P.box('#inputCells [data-id="k:enter"]') };
    check('橫拿：側欄在左、觸控板在右，觸控板高度用滿（390）', panel.x === 0 && pad.x === panel.r && pad.h === 390 && pad.r === 844, JSON.stringify({ panel, pad }));
    check('橫拿：觸控板寬度 ≥ 直拿觸控板的寬度（370）且 ≥ 螢幕寬度的一半', pad.w >= portraitPad.w && pad.w >= 422, `${pad.w} vs ${portraitPad.w}`);
    const l = measures.landscape844;
    check('橫拿側欄：輸入框、游標板、⏎ 一列', l.input && l.caret && l.enter && l.input.y === l.caret.y && l.caret.y === l.enter.y && l.enter.x >= l.caret.r, JSON.stringify(l));
    check('橫拿側欄有按鍵格（按鍵列＋⌘C、⌘V、Mission Control…）', (await P.texts('#sideCells button')).slice(0, 3).join(' ') === '⌘C ⌘V ⌘X' && (await P.texts('#keyStrip button')).includes('esc'));
    check('橫拿：側欄打開時浮動按鈕收起來（不佔觸控板）', !(await P.box('#fab')), JSON.stringify(await P.box('#fab')));
    await page.screenshot({ path: join(shotsDir, 'sofa8-landscape-panel.png') });
    macSince();
    await P.tapEl('#sideCells [data-id="c:cmd+c"]');
    await page.evaluate(() => document.querySelector('#sideCells [data-id="c:ctrl+up"]').scrollIntoView({ block: 'center' }));
    await sleep(150);
    await P.tapEl('#sideCells [data-id="c:ctrl+up"]');
    await sleep(200);
    const grid = macSince();
    check('點側欄的 ⌘C、⌃↑：送 cmd+c、ctrl+up', JSON.stringify(grid) === '["cmd+c","ctrl+up"]', JSON.stringify(grid));

    // typing in landscape: the panel has the box, the pad keeps the full visible height
    await P.tapEl('#sideKeyboard');
    await P.setKeyboard(KBD.landscape);
    const padT = await P.box('#pad');
    const vvh = await page.evaluate(() => window.visualViewport.height);
    const enterT = await P.box('#inputCells [data-id="k:enter"]');
    measures.landscapeTyping = { pad: padT, visible: vvh, enter: enterT, keyArea: await P.box('#keyArea') };
    // 4.2, measured the same way: the pad was 844×128 under the text row (844×120, its minimum, with a 240 px keyboard)
    check(`橫拿打字（鍵盤 ${KBD.landscape} px）：觸控板高度＝整個可視高度（4.2 是 128）`, padT.h === Math.round(vvh) && padT.w === pad.w, JSON.stringify({ padT, vvh }));
    check('橫拿打字：輸入框、游標板、⏎ 在鍵盤上面', enterT && enterT.b <= vvh, JSON.stringify(enterT));
    await P.type('ok');
    await P.tapEl('#inputCells [data-id="k:enter"]');
    await sleep(300);
    const t = macSince();
    check('橫拿：打 ok 再點 ⏎ → Mac 打 ok、按 Enter', t.join('').includes('ok') && t.at(-1) === 'enter', JSON.stringify(t));
    const lc = await P.caretDrag({ dx: -42 });
    check('橫拿：側欄的游標板往左拖 42 px → ← 約 3 下', lc.length >= 2 && lc.length <= 4 && lc.every((k) => k === 'left'), JSON.stringify(lc));
    await P.type('橫拿打字');
    await page.screenshot({ path: join(shotsDir, 'sofa8-landscape-typing.png') });
    await P.setKeyboard(KBD.landscapeSafari);
    const padS = await P.box('#pad');
    const enterS = await P.box('#inputCells [data-id="k:enter"]');
    measures.landscapeTypingSafari = { pad: padS, enter: enterS };
    check(`橫拿打字（Safari 分頁，鍵盤 ${KBD.landscapeSafari} px）：輸入列還在、觸控板 ${padS.h} px 高（4.2 是 120）`, enterS && enterS.b <= 390 - KBD.landscapeSafari && padS.h === 390 - KBD.landscapeSafari, JSON.stringify({ padS, enterS }));
    await page.evaluate(() => document.getElementById('input').blur());
    await P.setKeyboard(0);

    // collapse: the full-screen pad of 4.2; the panel comes back while typing; › opens it again
    await P.tapEl('#sideClose');
    await sleep(200);
    const full = await P.box('#pad');
    check('按 ‹ 收起側欄：觸控板全螢幕 844×390，浮動按鈕有 ›', full.w === 844 && full.h === 390 && !!(await P.box('#fabSide')) && !(await P.box('#controls')), JSON.stringify(full));
    await page.screenshot({ path: join(shotsDir, 'sofa8-landscape-collapsed.png') });
    await P.tapEl('#fabKeyboard');
    await P.setKeyboard(KBD.landscape);
    const back = await P.box('#controls');
    check('收起時點 Aa 打字：側欄（有輸入框）回來', !!back && !!(await P.box('#input')), JSON.stringify(back));
    await page.evaluate(() => document.getElementById('input').blur());
    await P.setKeyboard(0);
    await sleep(200);
    check('收起鍵盤：側欄又收起來，觸控板全螢幕', (await P.box('#pad')).w === 844 && !(await P.box('#controls')));
    await page.reload();
    await page.waitForFunction(() => document.getElementById('dot').classList.contains('ready'));
    await sleep(300);
    check('收起的狀態存在手機（重新整理後還是收起）', (await P.box('#pad')).w === 844);
    await P.tapEl('#fabSide');
    await page.waitForFunction(() => !document.getElementById('app').classList.contains('side-closed'), null, { timeout: 1500 }).catch(() => {});
    await sleep(200);
    const reopened = { panel: await P.box('#controls'), pad: await P.box('#pad') };
    // (not the width: with the recorder's CDP session attached, the reload can drop the safe-area override)
    check('按 › 打開側欄：側欄＋觸控板佔滿寬度', !!reopened.panel && reopened.pad.x === reopened.panel.r && reopened.pad.r === 844, JSON.stringify(reopened));

    // 左手模式: the panel on the right, the strip on the left
    await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('pkm.settings') || '{}'); s.lefty = true; localStorage.setItem('pkm.settings', JSON.stringify(s)); });
    await page.reload();
    await page.waitForFunction(() => document.getElementById('dot').classList.contains('ready'));
    await sleep(300);
    const lp = await P.box('#controls');
    const lpad = await P.box('#pad');
    const lstrip = await P.box('#strip');
    check('左手模式：側欄在右、觸控板在左、捲動條在觸控板左邊', lp.r === 844 && lpad.x === 0 && lstrip.x < lpad.x + 100, JSON.stringify({ lp, lpad, lstrip }));
    await page.screenshot({ path: join(shotsDir, 'sofa8-landscape-lefty.png') });
    await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('pkm.settings') || '{}'); s.lefty = false; localStorage.setItem('pkm.settings', JSON.stringify(s)); });

    // other phones (portrait pad width as the floor)
    for (const [w, h, ins, label] of [[667, 375, { top: 0, bottom: 0, left: 0, right: 0 }, 'iPhone SE 667×375'], [932, 430, { top: 0, bottom: 21, left: 59, right: 59 }, 'iPhone Pro Max 932×430']]) {
      await page.setViewportSize({ width: w, height: h });
      await P.cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: ins });
      await page.reload();
      await page.waitForFunction(() => document.getElementById('dot').classList.contains('ready'));
      await sleep(300);
      const pb = await P.box('#pad');
      const eb = await P.box('#inputCells [data-id="k:enter"]');
      measures[`landscape-${w}`] = { pad: pb, panel: await P.box('#controls'), enter: eb };
      check(`${label}：觸控板 ${pb.w}×${pb.h}（寬 ≥ 360、高用滿），輸入列放得下、⏎ ≥ 44 px 寬`, pb.w >= 360 && pb.h === h && eb && eb.r <= w && eb.w >= 44, JSON.stringify(measures[`landscape-${w}`]));
    }
    await P.ctx.close();
  }
} finally {
  await browser.close();
  await server.stop();
}
const passed = results.filter((r) => r.ok).length;
console.log(`${passed}/${results.length} PASS`);
if (videoDir) console.log('frame lists', JSON.stringify(videoLists));
writeFileSync(join(evDir, 'layout-browser.json'), JSON.stringify({ results, measures }, null, 1));
process.exitCode = passed === results.length ? 0 : 1;
