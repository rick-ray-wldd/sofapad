// Browser-level tests for v2 (PKM-2): multi-touch gestures, shortcut panel and editor, persistence,
// import/export, portrait ↔ landscape rotation (full-screen pad, state kept), plus v2 screenshots.
// Real page in headless Chrome (iPhone size, touch, safe areas) against pkm-server --dry-run on 127.0.0.1:
// nothing is posted to the Mac. Writes design/evidence/v2-browser.json and design/screenshots/v2/*.png.
//   node tools/v2-browser.mjs
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { startServer, ROOT, IPHONE_UA, INSETS } from './test-server.mjs';

const shotsDir = join(ROOT, 'design/screenshots/v2');
mkdirSync(shotsDir, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const shots = [];
function check(name, ok, detail = '') {
  results.push({ name, ok: !!ok, detail: ok ? undefined : detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok || !detail ? '' : '  → ' + detail}`);
}

// Records every message the page sends to the Mac (parsed), without auth secrets.
const recordSends = () => {
  window.__sent = [];
  const orig = WebSocket.prototype.send;
  WebSocket.prototype.send = function (data) {
    try {
      const m = JSON.parse(data);
      if (m.t !== 'auth' && m.t !== 'ping') window.__sent.push(m);
    } catch { /* binary */ }
    return orig.call(this, data);
  };
};
// Same stand-in as tools/touch-area.mjs: iOS only shrinks the visual viewport when the keyboard opens.
const fakeVisualViewport = () => {
  const listeners = {};
  const vv = { width: innerWidth, height: innerHeight, offsetTop: 0, offsetLeft: 0, pageTop: 0, pageLeft: 0, scale: 1,
    addEventListener(t, f) { (listeners[t] ||= []).push(f); }, removeEventListener() {} };
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
    kb.textContent = `（模擬 iOS 鍵盤區域 ${h} px）`;
    for (const f of listeners.resize || []) f({ type: 'resize' });
  };
  addEventListener('resize', () => window.__setKeyboard(window.__keyboard));
};

const server = await startServer();
const browser = await chromium.launch({ channel: 'chrome', headless: true });

async function phone({ fresh = true } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: IPHONE_UA });
  await ctx.addInitScript(recordSends);
  await ctx.addInitScript(fakeVisualViewport);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('PAGE ERROR ' + e.message));
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: INSETS.portrait });
  return { ctx, page, cdp, fresh };
}
async function ready(page, url) {
  await page.goto(url);
  await page.waitForFunction(() => document.getElementById('dot').classList.contains('ready'));
  await sleep(200);
}
const rect = (page, sel) => page.evaluate((s) => {
  const el = document.querySelector(s);
  if (!el) return null;
  const b = el.getBoundingClientRect();
  const shown = b.width > 0 && b.height > 0 && getComputedStyle(el).display !== 'none' && getComputedStyle(el).visibility !== 'hidden';
  return { x: b.x, y: b.y, w: b.width, h: b.height, shown };
}, sel);
const sent = (page) => page.evaluate(() => window.__sent.splice(0));
const keys = (msgs) => msgs.filter((m) => m.t === 'key').map((m) => `${(m.mods || []).slice().sort().join('+')}${m.mods && m.mods.length ? '+' : ''}${m.k}`);

/** Multi-finger touch on the pad: paths = [[{x,y}…] per finger] in pad-relative px; steps interpolate. */
async function fingers(page, cdp, paths, { stagger = 12, stepMs = 16, holdMs = 0 } = {}) {
  const pad = await rect(page, '#pad');
  const at = (p) => ({ x: pad.x + p.x, y: pad.y + p.y });
  const n = paths[0].length;
  // fingers land one after another, like real hands
  for (let f = 1; f <= paths.length; f++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: paths.slice(0, f).map((p, i) => ({ ...at(p[0]), id: i + 1 })) });
    await sleep(stagger);
  }
  if (holdMs) await sleep(holdMs);
  for (let s = 1; s < n; s++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: paths.map((p, i) => ({ ...at(p[s]), id: i + 1 })) });
    await sleep(stepMs);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await sleep(150);
}
const line = (x0, y0, x1, y1, steps = 8) => Array.from({ length: steps + 1 }, (_, i) => ({ x: x0 + ((x1 - x0) * i) / steps, y: y0 + ((y1 - y0) * i) / steps }));
const threeFinger = (cx, cy, dx, dy) => [-40, 0, 40].map((o, i) => line(cx + o, cy + (i === 1 ? 10 : 0), cx + o + dx, cy + dy + (i === 1 ? 10 : 0)));
async function shot(page, name, note) {
  await page.screenshot({ path: join(shotsDir, `${name}.png`) });
  shots.push({ name, note });
}

try {
  // ---------------- gestures (portrait) ----------------
  {
    const { ctx, page, cdp } = await phone();
    await ready(page, server.url + '#pair=' + server.code);
    await shot(page, 'v2-01-portrait-main', '直拿主畫面：提示多了捏合和三指手勢');
    await sent(page);

    for (const [dir, dx, dy, want] of [['左', -90, 0, 'ctrl+right'], ['右', 90, 0, 'ctrl+left'], ['上', 0, -90, 'ctrl+up'], ['下', 0, 90, 'ctrl+down']]) {
      await fingers(page, cdp, threeFinger(185, 230, dx, dy));
      const m = await sent(page);
      check(`三指${dir}滑 → 只送一次 ${want}，沒有捲動或點擊`, keys(m).join() === want && !m.some((x) => x.t === 'scroll' || x.t === 'click' || x.t === 'move'), JSON.stringify(m));
    }
    await fingers(page, cdp, [line(140, 230, 90, 230, 10), line(230, 230, 280, 230, 10)]);
    let m = await sent(page);
    check('雙指張開（捏合放大）→ 送 ⌘=，沒有捲動', keys(m).length >= 1 && keys(m).every((k) => k === 'cmd+=') && !m.some((x) => x.t === 'scroll'), JSON.stringify(m));
    await fingers(page, cdp, [line(80, 230, 150, 230, 10), line(290, 230, 220, 230, 10)]);
    m = await sent(page);
    check('雙指捏合（縮小）→ 送 ⌘−', keys(m).length >= 1 && keys(m).every((k) => k === 'cmd+-'), JSON.stringify(m));
    await fingers(page, cdp, [line(150, 150, 150, 300), line(210, 150, 210, 300)]);
    m = await sent(page);
    check('雙指往下滑 → 捲動，沒有送任何按鍵', m.some((x) => x.t === 'scroll') && keys(m).length === 0, JSON.stringify(m.slice(0, 3)));
    await fingers(page, cdp, [[{ x: 150, y: 200 }], [{ x: 210, y: 200 }]], { stagger: 10 });
    m = await sent(page);
    check('雙指點 → 右鍵（v1 行為不變）', m.some((x) => x.t === 'click' && x.b === 'right') && keys(m).length === 0, JSON.stringify(m));
    await fingers(page, cdp, [line(150, 200, 230, 200, 6)], { holdMs: 600 });
    m = await sent(page);
    const types = m.map((x) => x.t);
    check('長按再拖 → down → move → up（v1 行為不變）', types[0] === 'down' && types.includes('move') && types[types.length - 1] === 'up', types.join());
    await sleep(400);
    const acks = await page.evaluate(() => window.pkmLink.pending.length);
    check('手勢送出的按鍵都被 Mac 端確認（沒有待補送的訊息）', acks === 0, `pending ${acks}`);

    // ---------------- shortcut panel ----------------
    const padBefore = await rect(page, '#pad');
    await page.tap('#shortcutsBtn');
    await sleep(150);
    const panelR = await rect(page, '#shortcutPanel');
    const padAfter = await rect(page, '#pad');
    check('快捷鍵面板蓋在觸控板上，不會把觸控板擠小', panelR.shown && Math.abs(padAfter.h - padBefore.h) < 1 && Math.abs(panelR.h - padBefore.h) < 2, JSON.stringify({ padBefore, padAfter, panelR }));
    await shot(page, 'v2-03-portrait-shortcut-panel', '快捷鍵面板：我的、編輯、截圖、切換、其他（蓋在觸控板上）');
    await page.tap('[data-group="edit"] button[data-combo="⌘C"]');
    await sleep(100);
    m = await sent(page);
    check('面板：⌘C 拷貝 → 送 cmd+c，面板保持打開（方便接著貼上）', keys(m).join() === 'cmd+c' && !(await page.isHidden('#shortcutPanel')), JSON.stringify(m));
    await page.tap('[data-group="screenshot"] button[data-combo="⌃⇧⌘4"]');
    await sleep(100);
    m = await sent(page);
    check('面板：⌃⇧⌘4 選取範圍到剪貼簿 → 送 ctrl+shift+cmd+4，面板自動關（觸控板接著拉範圍）', keys(m).join() === 'cmd+ctrl+shift+4' && await page.isHidden('#shortcutPanel'), JSON.stringify(m));

    // ---------------- custom shortcut editor ----------------
    await page.tap('#shortcutsBtn');
    await page.click('#editShortcuts');
    await page.click('#addShortcut');
    await page.click('[data-pick="ctrl"]');
    await page.click('[data-pick="shift"]');
    await page.selectOption('#scKey', '4');
    await page.fill('#scLabel', '截圖到剪貼簿');
    const preview = await page.textContent('#scPreview');
    check('自訂：用選的組合鍵，預覽顯示 ⌃⇧⌘4', preview === '⌃⇧⌘4', preview);
    await shot(page, 'v2-04-portrait-editor', '自訂快捷鍵：修飾鍵用按的、按鍵用選的，下方即時預覽');
    await page.click('#scSave');
    await page.click('#addShortcut');
    await page.click('[data-pick="opt"]');
    await page.selectOption('#scKey', 'k');
    await page.click('#scSave');
    const list1 = await page.$$eval('#customList .combo', (els) => els.map((e) => e.textContent));
    check('自訂：新增兩個 → 清單 ⌃⇧⌘4、⌥⌘K', list1.join() === '⌃⇧⌘4,⌥⌘K', list1.join());
    await page.click('#customList li:nth-child(2) button[aria-label="往上移"]');
    const list2 = await page.$$eval('#customList .combo', (els) => els.map((e) => e.textContent));
    check('自訂：排序（往上移）', list2.join() === '⌥⌘K,⌃⇧⌘4', list2.join());
    await page.click('#customList li:nth-child(1) button[aria-label="編輯"]');
    await page.fill('#scLabel', '我的 K');
    await page.click('#scSave');
    const names = await page.$$eval('#customList .name', (els) => els.map((e) => e.textContent));
    check('自訂：編輯名稱', names[0] === '我的 K', names.join());
    await page.click('.io summary'); // the export / import box is folded away by default
    await page.click('#exportBtn');
    const exported = await page.inputValue('#ioText');
    check('自訂：匯出 JSON 有兩個項目', JSON.parse(exported).items.length === 2, exported.slice(0, 80));
    await page.click('#closeEditor');
    const mine = await page.$$eval('[data-group="mine"] button', (els) => els.map((e) => e.dataset.combo));
    check('面板「我的」出現自訂的兩個', mine.join() === '⌥⌘K,⌃⇧⌘4', mine.join());
    await page.tap('[data-group="mine"] button[data-combo="⌃⇧⌘4"]');
    await sleep(100);
    m = await sent(page);
    check('點自訂的 ⌃⇧⌘4 → 送 ctrl+shift+cmd+4', keys(m).join() === 'cmd+ctrl+shift+4', JSON.stringify(m));

    // persistence across a reload
    await ready(page, server.url);
    await page.tap('#shortcutsBtn');
    const mineAfter = await page.$$eval('[data-group="mine"] button', (els) => els.map((e) => e.dataset.combo));
    check('重新整理後自訂快捷鍵還在（存在手機的 localStorage）', mineAfter.join() === '⌥⌘K,⌃⇧⌘4', mineAfter.join());
    await page.tap('#closeShortcuts');

    // delete one
    await page.tap('#shortcutsBtn');
    await page.click('#editShortcuts');
    await page.click('#customList li:nth-child(1) button[aria-label="刪除"]');
    const list3 = await page.$$eval('#customList .combo', (els) => els.map((e) => e.textContent));
    check('自訂：刪除', list3.join() === '⌃⇧⌘4', list3.join());
    await page.click('#closeEditor');
    await page.tap('#closeShortcuts');

    // import into a brand-new phone (empty storage)
    {
      // A pairing code pairs one phone only (v1 security design), so the second phone reuses the first phone's
      // token; its storage is otherwise empty (no custom shortcuts).
      const token = await page.evaluate(() => localStorage.getItem('pkm.token'));
      const other = await phone();
      await other.ctx.addInitScript((t) => { if (!localStorage.getItem('pkm.token')) localStorage.setItem('pkm.token', t); }, token);
      await ready(other.page, server.url);
      check('另一支手機一開始沒有自訂快捷鍵', (await other.page.evaluate(() => localStorage.getItem('pkm.shortcuts'))) === null);
      await other.page.tap('#shortcutsBtn');
      await other.page.click('#editShortcuts');
      await other.page.click('.io summary');
      await other.page.fill('#ioText', exported);
      await other.page.click('#importAppend');
      const msg = await other.page.textContent('#ioMsg');
      const got = await other.page.$$eval('#customList .combo', (els) => els.map((e) => e.textContent));
      check('匯入到另一支（空的）手機：兩個都進來', got.join() === '⌥⌘K,⌃⇧⌘4' && /匯入 2 個/.test(msg), `${got.join()} / ${msg}`);
      await other.page.fill('#ioText', '{"items": [{"key": "<img>", "mods": []}]');
      await other.page.click('#importAppend');
      check('匯入壞掉的 JSON → 顯示錯誤、清單不變', /匯入失敗/.test(await other.page.textContent('#ioMsg'))
        && (await other.page.$$eval('#customList li', (els) => els.length)) === 2);
      await other.ctx.close();
      // the first phone was replaced by the second one (one controller at a time): reconnect it
      await page.evaluate(() => window.pkmLink.reconnectNow());
      await page.waitForFunction(() => document.getElementById('dot').classList.contains('ready'), null, { timeout: 5000 }).catch(() => {});
    }

    // ---------------- typing in portrait: keyboard mode (T1) ----------------
    await page.focus('#input');
    await page.evaluate(() => window.__setKeyboard(380));
    await sleep(200);
    const padKbd = await rect(page, '#pad');
    const bar = await rect(page, '.bar');
    const btns = await rect(page, '.buttons');
    check('直拿打字（Safari，可視 464 px）：觸控板高度 ≥ 290 px（v1 是 155）', padKbd.h >= 290, JSON.stringify(padKbd));
    check('直拿打字：狀態列、左右鍵收起，浮動按鈕出現', !bar.shown && !btns.shown && (await rect(page, '#fab')).shown);
    await shot(page, 'v2-02-portrait-typing-keyboard', '直拿打字（鍵盤彈出）：觸控板 305 px；狀態點、收鍵盤、快捷鍵、拖曳鎖定變成觸控板上的小按鈕');
    await page.tap('#fabKeyboard');
    await page.evaluate(() => window.__setKeyboard(0));
    await sleep(150);
    check('浮動「⌄」收起鍵盤 → 回到一般版面', !(await page.evaluate(() => document.getElementById('app').classList.contains('typing'))) && (await rect(page, '.bar')).shown);

    // ---------------- rotation (T4) ----------------
    await page.tap('#btnLock'); // drag lock on (sends left down)
    await page.tap('#modeBtn'); // buffered mode
    await page.focus('#input');
    await cdpInsert(cdp, '轉向不能掉字');
    await page.evaluate(() => document.activeElement.blur());
    await sleep(100);
    m = await sent(page);
    check('轉向前：拖曳鎖定（送 left down）、整段模式打的字還沒送出', m.filter((x) => x.t === 'down').length === 1 && !m.some((x) => x.t === 'text'), JSON.stringify(m));

    await rotate(page, cdp, 'landscape');
    // SOFA-8 (D-48): landscape opens with the side panel now; ‹ collapses it into the full-screen pad these checks are
    // about (tools/sofa8-layout.mjs checks the panel itself).
    await page.tap('#sideClose');
    await sleep(150);
    const padL = await rect(page, '#pad');
    check('轉橫：觸控板全螢幕 844×390', Math.round(padL.w) === 844 && Math.round(padL.h) === 390, JSON.stringify(padL));
    check('轉橫：其他控制項收起，只剩浮動按鈕列', !(await rect(page, '.controls')).shown && !(await rect(page, '.bar')).shown && (await rect(page, '#fab')).shown);
    check('轉橫：拖曳鎖定還在（浮動「放」亮著）、文字還在',
      (await page.getAttribute('#fabLock', 'aria-pressed')) === 'true' && (await page.inputValue('#input')) === '轉向不能掉字');
    await shot(page, 'v2-05-landscape-fullscreen', '橫拿：觸控板全螢幕；左邊浮動按鈕列（連線、鍵盤、快捷鍵、拖曳鎖定、設定），右邊捲動條');
    await fingers(page, cdp, threeFinger(420, 200, -120, 0));
    m = await sent(page);
    check('轉橫後三指左滑一樣能用 → ctrl+right', keys(m).join() === 'ctrl+right', JSON.stringify(m));

    await page.tap('#fabKeyboard');
    await page.evaluate(() => window.__setKeyboard(200));
    await sleep(200);
    const ctl = await rect(page, '.controls');
    // SOFA-8 (D-48): the text box comes back in the side panel next to the pad (was: a row under it)
    check('橫拿點「⌨︎」→ 側欄（文字框和按鍵）出現在觸控板旁邊，文字框有焦點、內容還在',
      ctl.shown && (await page.evaluate(() => document.activeElement.id)) === 'input' && (await page.inputValue('#input')) === '轉向不能掉字', JSON.stringify(ctl));
    const padLk = await rect(page, '#pad');
    check('橫拿打字（可視 190 px）：觸控板高度用滿 190（4.2 是 ≥ 120 的整個寬度）、寬 ≥ 370', Math.round(padLk.h) === 190 && padLk.w >= 370, JSON.stringify(padLk));
    await shot(page, 'v2-06-landscape-typing', '橫拿打字：側欄（文字框＋游標板＋⏎、按鍵格）在左，觸控板在右，鍵盤在最下面');
    await page.tap('#sideKeyboard');   // SOFA-8: while typing the side panel is back, its ⌄ closes the keyboard
    await page.evaluate(() => window.__setKeyboard(0));
    await sleep(150);
    check('再點一次 → 收鍵盤，回到全螢幕觸控板', Math.round((await rect(page, '#pad')).h) === 390 && !(await rect(page, '.controls')).shown);

    await page.tap('#fabShortcuts');
    await sleep(100);
    check('橫拿：浮動「⌘」叫出快捷鍵面板（蓋滿觸控板）', (await rect(page, '#shortcutPanel')).shown);
    await shot(page, 'v2-07-landscape-shortcut-panel', '橫拿：快捷鍵面板');
    await page.tap('#closeShortcuts');

    await page.evaluate(() => document.getElementById('app').classList.add('lefty'));
    await sleep(100);
    await shot(page, 'v2-08-landscape-lefthand', '橫拿＋左手模式：浮動按鈕在右邊、捲動條在左邊');
    const fabR = await rect(page, '#fab');
    check('左手模式：浮動按鈕換到右邊', fabR.x > 700, JSON.stringify(fabR));
    await page.evaluate(() => document.getElementById('app').classList.remove('lefty'));

    await rotate(page, cdp, 'portrait');
    check('轉回直：拖曳鎖定還在、文字還在、版面恢復',
      (await page.getAttribute('#btnLock', 'aria-pressed')) === 'true' && (await page.inputValue('#input')) === '轉向不能掉字'
      && (await rect(page, '.buttons')).shown && Math.round((await rect(page, '#pad')).h) < 600);
    m = await sent(page);
    check('轉向過程沒有多送放開或按下（拖曳不會中斷）', !m.some((x) => x.t === 'down' || x.t === 'up' || x.t === 'release_all'), JSON.stringify(m));
    await page.tap('#sendBtn');
    await sleep(200);
    m = await sent(page);
    check('轉回來後按「送出」→ 整段文字送出', m.some((x) => x.t === 'text' && x.s === '轉向不能掉字'), JSON.stringify(m));
    await page.tap('#btnLock');
    await page.tap('#modeBtn');
    await ctx.close();
  }
} finally {
  await browser.close();
  await server.stop();
}

async function cdpInsert(cdp, text) {
  await cdp.send('Input.insertText', { text });
}
async function rotate(page, cdp, to) {
  const size = to === 'landscape' ? { width: 844, height: 390 } : { width: 390, height: 844 };
  await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: INSETS[to] });
  await page.setViewportSize(size);
  await page.evaluate(() => { window.dispatchEvent(new Event('orientationchange')); });
  await sleep(450);
}

const out = { at: new Date().toISOString(), passed: results.filter((r) => r.ok).length, total: results.length, results, shots };
writeFileSync(join(ROOT, 'design/evidence/v2-browser.json'), JSON.stringify(out, null, 1));
console.log(`${out.passed}/${out.total} PASS`);
process.exit(out.passed === out.total ? 0 : 1);
