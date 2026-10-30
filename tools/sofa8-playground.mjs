// SOFA-8: goes through every stage of demo/playground.html from the phone page, end to end, without touching the Mac.
// The phone page (headless Chrome, touch through CDP) talks to a dry-run Mac; a bridge replays what the dry-run Mac
// would post (its log: move, click, down/up, scroll, type, key) as browser input into the playground, open as a 1280×800
// "Mac screen". Text goes one character per key event, as the real app types it (TextPlanner, one UTF-16 unit).
// What only macOS itself does is simulated, and shown on the playground as「（模擬 macOS：…）」:
//   ⌃← ⌃→ (switch desktops) and ⌃↑ ⌃↓ (Mission Control): the page loses and gets back the focus;
//   ⌃⇧⌘4 then a drag: a screenshot of the dragged area goes to a clipboard of the bridge's own;
//   ⌘C / ⌘V: copy and paste events on that clipboard (the real clipboard of this Mac is never touched).
// The pointer moves are the dry-run's Mac pixels (a 2560-wide screen) halved. A cursor is drawn on the playground.
//   node tools/sofa8-playground.mjs [--lang en|zh] [--mode video] [--video DIR]
//     --lang: the page's language (SOFA-9; default en, the page's default). --mode video: the short recording version
//     (stages 1, 2, 5, 6, 7). --video: frames of both screens and an ffmpeg list each, see screencast.mjs.
//   The targets come from window.playground.texts, so the same run works in either language.
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { startServer, ROOT, IPHONE_UA, INSETS } from './test-server.mjs';
import { startScreencast } from './screencast.mjs';

const args = process.argv.slice(2);
const videoDir = args.includes('--video') ? args[args.indexOf('--video') + 1] : null;
const lang = args.includes('--lang') ? args[args.indexOf('--lang') + 1] : 'en';
const videoMode = args.includes('--mode') && args[args.indexOf('--mode') + 1] === 'video';
const evDir = join(ROOT, 'design/evidence/sofa8');
const shotsDir = join(ROOT, 'design/screenshots/v4');
mkdirSync(evDir, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const W = 1280;
const H = 800;
const SCALE = 0.5;

// macOS virtual key codes (pkm-server KeyMap) → Playwright key names
const KEYS = {
  0: 'KeyA', 1: 'KeyS', 2: 'KeyD', 3: 'KeyF', 4: 'KeyH', 5: 'KeyG', 6: 'KeyZ', 7: 'KeyX', 8: 'KeyC', 9: 'KeyV', 11: 'KeyB',
  12: 'KeyQ', 13: 'KeyW', 14: 'KeyE', 15: 'KeyR', 16: 'KeyY', 17: 'KeyT', 18: 'Digit1', 19: 'Digit2', 20: 'Digit3', 21: 'Digit4',
  22: 'Digit6', 23: 'Digit5', 24: 'Equal', 25: 'Digit9', 26: 'Digit7', 27: 'Minus', 28: 'Digit8', 29: 'Digit0', 30: 'BracketRight',
  31: 'KeyO', 32: 'KeyU', 33: 'BracketLeft', 34: 'KeyI', 35: 'KeyP', 36: 'Enter', 37: 'KeyL', 38: 'KeyJ', 40: 'KeyK', 45: 'KeyN',
  46: 'KeyM', 48: 'Tab', 49: 'Space', 51: 'Backspace', 53: 'Escape', 115: 'Home', 116: 'PageUp', 117: 'Delete', 119: 'End',
  121: 'PageDown', 123: 'ArrowLeft', 124: 'ArrowRight', 125: 'ArrowDown', 126: 'ArrowUp',
};
const MODS = { cmd: 'Meta', ctrl: 'Control', opt: 'Alt', shift: 'Shift' };

const server = await startServer();
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const simulated = [];
const macLog = [];
let out = {};
try {
  const macCtx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const phoneCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: IPHONE_UA });
  const mac = await macCtx.newPage();
  const phone = await phoneCtx.newPage();
  for (const [p, n] of [[mac, 'playground'], [phone, 'phone']]) p.on('pageerror', (e) => console.log(`PAGE ERROR (${n}) ${e.message}`));
  await mac.goto(pathToFileURL(join(ROOT, 'demo/playground.html')).href + `?rec=1&lang=${lang}${videoMode ? '&video=1' : ''}`);
  // a cursor, since a headless page has none
  await mac.evaluate(() => {
    const c = document.createElement('div');
    c.id = '__cursor';
    c.style.cssText = 'position:fixed;left:0;top:0;width:22px;height:22px;z-index:9999;pointer-events:none;transform:translate(640px,400px)';
    c.innerHTML = '<svg viewBox="0 0 22 22" width="22" height="22"><path d="M3 2l14 9-6.5 1.2L14 19l-2.6 1.2-3.4-6.6L3 18z" fill="#111" stroke="#fff" stroke-width="1.4" stroke-linejoin="round"/></svg>';
    document.body.append(c);
    const n = document.createElement('div');
    n.id = '__os';
    n.style.cssText = 'position:fixed;inset:0;z-index:9998;display:none;align-items:center;justify-content:center;background:rgba(15,23,42,.72);color:#fff;font:700 34px -apple-system,"PingFang TC",sans-serif;pointer-events:none';
    document.body.append(n);
  });
  const phoneCdp = await phoneCtx.newCDPSession(phone);
  await phoneCdp.send('Emulation.setSafeAreaInsetsOverride', { insets: INSETS.portrait });
  await phone.addInitScript(() => {
    // fingers drawn on the phone for the recording
    const dots = new Map();
    const show = (e) => { for (const t of e.changedTouches) { let d = dots.get(t.identifier); if (!d) { d = document.createElement('div'); d.style.cssText = 'position:fixed;width:38px;height:38px;margin:-19px 0 0 -19px;border-radius:50%;background:rgba(255,255,255,.35);border:2px solid rgba(255,255,255,.8);z-index:200;pointer-events:none'; document.documentElement.append(d); dots.set(t.identifier, d); } d.style.left = t.clientX + 'px'; d.style.top = t.clientY + 'px'; } };
    const hide = (e) => { for (const t of e.changedTouches) { dots.get(t.identifier)?.remove(); dots.delete(t.identifier); } };
    for (const [ty, fn] of [['touchstart', show], ['touchmove', show], ['touchend', hide], ['touchcancel', hide]]) addEventListener(ty, fn, { capture: true, passive: true });
  });
  await phone.goto(server.url + '#pair=' + server.code);
  await phone.waitForFunction(() => document.getElementById('dot').classList.contains('ready'));
  const t0 = Date.now() / 1000;
  const casts = videoDir ? {
    mac: await startScreencast(mac, join(videoDir, 'mac'), { t0, maxWidth: W, maxHeight: H }),
    phone: await startScreencast(phone, join(videoDir, 'phone'), { t0, maxWidth: 390, maxHeight: 844 }),
  } : null;
  await phone.evaluate(() => {
    if (document.getElementById('modeBtn').textContent.trim() !== '即時') document.getElementById('modeBtn').click();
    const el = document.getElementById('input');
    const ev = (type, init) => el.dispatchEvent(new InputEvent(type, { bubbles: true, cancelable: true, ...init }));
    window.__type = (s) => { el.focus(); for (const ch of s) { el.setRangeText(ch, el.selectionStart, el.selectionEnd, 'end'); ev('input', { inputType: 'insertText', data: ch }); } };
    window.__composeStart = (marked) => {
      el.focus();
      el.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true, data: '' }));
      el.setRangeText(marked, el.selectionStart, el.selectionEnd, 'select');
      ev('input', { inputType: 'insertCompositionText', data: marked, isComposing: true });
    };
    window.__composeEnd = (marked, chosen) => {
      const p = el.value.lastIndexOf(marked);
      el.setRangeText(chosen, p, p + marked.length, 'end');
      ev('input', { inputType: 'insertCompositionText', data: chosen, isComposing: true });
      el.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: chosen }));
    };
    window.__swipe = (w) => { el.focus(); const t = (el.value && !/\s$/.test(el.value) ? ' ' : '') + w; el.setRangeText(t, el.selectionStart, el.selectionEnd, 'end'); ev('input', { inputType: 'insertText', data: t }); };
    window.__dictate = (steps) => {
      el.focus();
      for (const [cut, add] of steps) {
        if (cut) { el.value = el.value.slice(0, -cut); ev('input', { inputType: 'deleteContentBackward' }); }
        if (add) { el.value += add; ev('input', { inputType: 'insertText', data: add }); }
      }
    };
  });

  // ---------------- the bridge: dry-run Mac log → input on the playground ----------------
  const mouse = { x: W / 2, y: H / 2 };
  let readLines = 0;
  let busy = Promise.resolve();
  let lastEventAt = Date.now();
  let capture = null;           // ⌃⇧⌘4 then a drag: the area
  const clip = { text: '', image: null };
  let away = false;
  let mission = false;
  const os = async (text, ms = 900) => {
    simulated.push(text);
    await mac.evaluate(([t, ms]) => { const n = document.getElementById('__os'); n.textContent = `（模擬 macOS：${t}）`; n.style.display = 'flex'; clearTimeout(window.__osT); window.__osT = setTimeout(() => { n.style.display = 'none'; }, ms); }, [text, ms]);
  };
  const setFocus = (on) => mac.evaluate((on) => window.dispatchEvent(new Event(on ? 'focus' : 'blur')), on);
  const drawCursor = () => mac.evaluate(([x, y]) => { document.getElementById('__cursor').style.transform = `translate(${x - 3}px,${y - 2}px)`; }, [mouse.x, mouse.y]);
  async function handle(line) {
    let m;
    macLog.push(line);
    lastEventAt = Date.now();
    if ((m = /^move (-?[\d.]+) (-?[\d.]+)$/.exec(line))) {
      mouse.x = Math.max(0, Math.min(W - 1, mouse.x + Number(m[1]) * SCALE));
      mouse.y = Math.max(0, Math.min(H - 1, mouse.y + Number(m[2]) * SCALE));
      if (!capture) await mac.mouse.move(mouse.x, mouse.y);
      await drawCursor();
    } else if ((m = /^scroll (-?[\d.]+) (-?[\d.]+)$/.exec(line))) {
      await mac.mouse.wheel(-Number(m[1]), -Number(m[2]));   // CGEvent wheel1 > 0 scrolls up; DOM deltaY > 0 scrolls down
    } else if ((m = /^click (left|right)$/.exec(line))) {
      await mac.mouse.click(mouse.x, mouse.y, { button: m[1] });
    } else if ((m = /^(down|up) left$/.exec(line))) {
      if (capture) {
        if (m[1] === 'down') capture.from = { ...mouse };
        else {
          const a = capture.from || mouse;
          const box = { x: Math.min(a.x, mouse.x), y: Math.min(a.y, mouse.y), width: Math.max(8, Math.abs(mouse.x - a.x)), height: Math.max(8, Math.abs(mouse.y - a.y)) };
          await mac.evaluate(() => { document.getElementById('__cursor').style.display = 'none'; });
          clip.image = await mac.screenshot({ clip: box });
          await mac.evaluate(() => { document.getElementById('__cursor').style.display = ''; });
          clip.text = '';
          capture = null;
          await os(`截圖 ${Math.round(box.width)}×${Math.round(box.height)} 存到剪貼簿`);
        }
      } else if (m[1] === 'down') await mac.mouse.down(); else await mac.mouse.up();
    } else if ((m = /^type (".*")$/.exec(line))) {
      for (const ch of JSON.parse(m[1])) {
        if (ch === '\n') await mac.keyboard.press('Enter'); else await mac.keyboard.insertText(ch);
      }
    } else if ((m = /^key (\d+) mods \[(.*)\]$/.exec(line))) {
      const mods = m[2] ? m[2].split(',').map((x) => JSON.parse(x.trim())) : [];
      const key = KEYS[m[1]];
      const has = (...xs) => xs.every((x) => mods.includes(x)) && mods.length === xs.length;
      if (has('ctrl') && (key === 'ArrowRight' || key === 'ArrowLeft')) {
        away = key === 'ArrowRight';
        await os(away ? '切到右邊的桌面' : '回到左邊的桌面（這一頁）', 700);
        await setFocus(!away);
      } else if (has('ctrl') && (key === 'ArrowUp' || key === 'ArrowDown')) {
        mission = key === 'ArrowUp' ? !mission : false;
        await os(mission ? 'Mission Control 打開' : 'Mission Control 收起', 800);
        await setFocus(!mission);
      } else if (has('ctrl', 'shift', 'cmd') && key === 'Digit4') {
        capture = {};
        await os('⌃⇧⌘4：拖一塊範圍截圖', 700);
      } else if (has('cmd') && key === 'KeyC') {
        clip.text = await mac.evaluate(() => {
          const a = document.activeElement;
          const t = a && typeof a.selectionStart === 'number' ? a.value.slice(a.selectionStart, a.selectionEnd) : String(getSelection());
          document.dispatchEvent(new ClipboardEvent('copy', { bubbles: true }));
          return t;
        });
        clip.image = null;
        simulated.push(`⌘C（拷貝「${clip.text}」到模擬剪貼簿）`);
      } else if (has('cmd') && key === 'KeyV') {
        if (clip.image) {
          await mac.evaluate(async (b64) => {
            const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
            const dt = new DataTransfer();
            dt.items.add(new File([bin], 'screenshot.png', { type: 'image/png' }));
            (document.activeElement || document.body).dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: dt }));
          }, clip.image.toString('base64'));
          simulated.push('⌘V（貼上模擬剪貼簿裡的截圖）');
        } else {
          await mac.evaluate((t) => {
            const dt = new DataTransfer();
            dt.setData('text/plain', t);
            const target = document.activeElement || document.body;
            const ok = target.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: dt }));
            if (ok) document.execCommand('insertText', false, t);
          }, clip.text);
          simulated.push(`⌘V（貼上模擬剪貼簿的「${clip.text}」）`);
        }
      } else if (key) {
        await mac.keyboard.press([...mods.map((x) => MODS[x]), key].join('+'));
      } else console.log('no key for', line);
    }
  }
  const pump = setInterval(() => {
    const lines = [...server.log().matchAll(/\[dry-run\] (.*)/g)].map((x) => x[1]);
    const fresh = lines.slice(readLines);
    readLines = lines.length;
    for (const l of fresh) busy = busy.then(() => handle(l)).catch((e) => console.log('bridge:', e.message));
  }, 15);
  /** Wait until the Mac side has been quiet for `ms`. */
  const settle = async (ms = 250) => { await sleep(60); while (Date.now() - lastEventAt < ms) await sleep(40); await busy; };

  // ---------------- the phone ----------------
  const touch = (type, points) => phoneCdp.send('Input.dispatchTouchEvent', { type, touchPoints: points.map((p, i) => ({ x: p.x, y: p.y, id: p.id ?? i, radiusX: 4, radiusY: 4, force: 1 })) });
  const box = (sel) => phone.evaluate((s) => { const r = document.querySelector(s).getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; }, sel);
  const padArea = async () => { const p = await box('#pad'); return { x0: p.x + 24, x1: p.x + p.w - 70, y0: p.y + 70, y1: p.y + p.h - 24 }; };
  const center = (a) => ({ x: (a.x0 + a.x1) / 2, y: (a.y0 + a.y1) / 2 });
  async function stroke(from, to, ms = 380, fingers = 1, hold = 0, flick = false) {
    const pts = (f) => Array.from({ length: fingers }, (_, i) => ({ x: f.x + i * 46, y: f.y + (i === 1 ? 10 : 0), id: i + 1 }));
    await touch('touchStart', pts(from));
    if (hold) await sleep(hold);
    const n = Math.max(4, Math.round(ms / 16));
    for (let i = 1; i <= n; i++) {
      await touch('touchMove', pts({ x: from.x + (to.x - from.x) * (i / n), y: from.y + (to.y - from.y) * (i / n) }));
      await sleep(16);
    }
    if (!flick) for (let i = 0; i < 6; i++) { await touch('touchMove', pts(to)); await sleep(20); }   // stop before lifting: no coasting
    await touch('touchEnd', []);
  }
  const clampTo = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  /** Long press (拖曳中), then steer the dragged thing onto `sel` without lifting the finger, aiming again after each part. */
  async function holdDragTo(sel, fx = 0.5, fy = 0.5) {
    const a = await padArea();
    const c = center(a);
    const t0 = await target(sel, fx, fy);
    let p = { x: clampTo(c.x - (t0.x - mouse.x) / gain / 2, a.x0, a.x1), y: clampTo(c.y - (t0.y - mouse.y) / gain / 2, a.y0, a.y1) };
    await touch('touchStart', [{ ...p, id: 1 }]);
    await sleep(650);
    await settle();
    for (let i = 0; i < 8; i++) {
      const t = await target(sel, fx, fy);
      const dx = t.x - mouse.x;
      const dy = t.y - mouse.y;
      if (Math.hypot(dx, dy) <= 8) break;
      const q = { x: clampTo(p.x + dx / gain, a.x0, a.x1), y: clampTo(p.y + dy / gain, a.y0, a.y1) };
      const n = 20;
      for (let k = 1; k <= n; k++) { await touch('touchMove', [{ x: p.x + ((q.x - p.x) * k) / n, y: p.y + ((q.y - p.y) * k) / n, id: 1 }]); await sleep(20); }
      for (let k = 0; k < 5; k++) { await touch('touchMove', [{ ...q, id: 1 }]); await sleep(20); }
      p = q;
      await settle();
    }
    await touch('touchEnd', []);
    await sleep(300);
    await settle();
  }
  async function tapPad(fingers = 1) {
    const c = center(await padArea());
    const pts = Array.from({ length: fingers }, (_, i) => ({ x: c.x + i * 40, y: c.y, id: i + 1 }));
    await touch('touchStart', pts);
    await sleep(70);
    await touch('touchEnd', []);
    await sleep(350);
    await settle();
  }
  async function tapPhone(sel) {
    const b = await box(sel);
    await touch('touchStart', [{ x: b.x + b.w / 2, y: b.y + b.h / 2, id: 1 }]);
    await sleep(70);
    await touch('touchEnd', []);
    await sleep(220);
  }
  /** Mac page point for a selector (centre, or `dx`/`dy` from the left/top edge as a fraction). */
  const target = (sel, fx = 0.5, fy = 0.5) => mac.evaluate(([s, fx, fy]) => { const r = document.querySelector(s).getBoundingClientRect(); return { x: r.x + r.width * fx, y: r.y + r.height * fy }; }, [sel, fx, fy]);
  let gain = 1.0;               // Mac page px per finger px, learnt as we go
  /** Move the Mac pointer onto `sel` with one-finger strokes on the phone, closing in like a person would. */
  async function pointAt(sel, fx = 0.5, fy = 0.5, tol = 6) {
    for (let i = 0; i < 14; i++) {
      const t = await target(sel, fx, fy);
      const dx = t.x - mouse.x;
      const dy = t.y - mouse.y;
      if (Math.hypot(dx, dy) <= tol) return true;
      const a = await padArea();
      const c = center(a);
      let fxp = dx / gain;
      let fyp = dy / gain;
      const k = Math.min(1, (a.x1 - a.x0 - 10) / Math.max(1, Math.abs(fxp)), (a.y1 - a.y0 - 10) / Math.max(1, Math.abs(fyp)));
      fxp *= k;
      fyp *= k;
      const before = { ...mouse };
      await stroke({ x: c.x - fxp / 2, y: c.y - fyp / 2 }, { x: c.x + fxp / 2, y: c.y + fyp / 2 }, Math.max(200, Math.min(600, Math.hypot(fxp, fyp) * 2.2)));
      await settle();
      const moved = Math.hypot(mouse.x - before.x, mouse.y - before.y);
      const finger = Math.hypot(fxp, fyp);
      if (finger > 25 && moved > 5 && Math.abs(mouse.x - before.x) < W - 2) gain = gain * 0.4 + (moved / finger) * 0.6;
    }
    console.log('pointAt gave up on', sel, mouse);
    return false;
  }
  const clickAt = async (sel, fx, fy) => { await pointAt(sel, fx, fy); await tapPad(); };
  const next = async () => { await mac.waitForSelector('#btn-next', { state: 'visible', timeout: 5000 }); await clickAt('#btn-next'); await sleep(500); };
  const typePhone = async (s, gap = 70) => { for (const ch of s) { await phone.evaluate((c) => window.__type(c), ch); await sleep(gap); } await sleep(300); await settle(); };
  const state = () => mac.evaluate(() => window.playground.state());
  const stageDone = async (n) => (await state()).stages[n].done;
  const report = async (n) => { const s = (await state()).stages[n]; console.log(`stage ${n} ${s.name}: ${s.done ? 'DONE' : 'not done'} ${JSON.stringify(s.checks)}`); };
  const caretDrag = async (dx, ms = 600) => {
    const b = await box('#caretPad');
    const p = { x: b.x + b.w / 2, y: b.y + b.h / 2, id: 1 };
    await touch('touchStart', [p]);
    await sleep(380);
    const n = Math.max(2, Math.round(ms / 16));
    for (let i = 1; i <= n; i++) { await touch('touchMove', [{ ...p, x: p.x + (dx * i) / n }]); await sleep(16); }
    await sleep(120);
    await touch('touchEnd', []);
    await sleep(250);
    await settle();
  };
  const sel4 = () => mac.evaluate(() => { const t = document.getElementById('s4-text'); return { a: t.selectionStart, b: t.selectionEnd, v: t.value }; });
  const panelTap = async (combo) => {
    if (await phone.evaluate(() => document.getElementById('shortcutPanel').hidden)) await tapPhone('#shortcutsBtn');
    const b = await phone.$(`#shortcutList button[data-combo="${combo}"]`);
    await b.scrollIntoViewIfNeeded();
    await sleep(150);
    await tapPhone(`#shortcutList button[data-combo="${combo}"]`);
    await settle();
  };
  const closePanel = async () => { if (!(await phone.evaluate(() => document.getElementById('shortcutPanel').hidden))) { await tapPhone('#closeShortcuts'); await sleep(200); } };

  await sleep(800);
  // ---- 1 觸控板 ----
  for (const [fx, fy] of [[0.2, 0.3], [0.8, 0.7], [0.3, 0.8], [0.7, 0.2]]) await pointAt('#stage-1', fx, fy, 30);
  await clickAt('#s1-click');
  await pointAt('#s1-rc');
  await tapPad(2);                                   // two-finger tap = right click
  await sleep(300);
  await clickAt('#s1-menu-like');
  await pointAt('#s1-list');
  for (let i = 0; i < 14 && !(await state()).stages['1'].checks.scroll; i++) {
    const c = center(await padArea());
    await stroke({ x: c.x - 20, y: c.y + 120 }, { x: c.x - 20, y: c.y - 120 }, 220, 2, 0, true);   // two fingers flick up: the list scrolls down
    await sleep(700);
    await settle();
  }
  console.log('list scrolled to', await mac.evaluate(() => { const l = document.getElementById('s1-list'); return `${Math.round(l.scrollTop)} / ${l.scrollHeight - l.clientHeight}`; }));
  // blue: long-press, then drag without lifting
  await pointAt('#s1-blue');
  await holdDragTo('#s1-drop-blue');
  // orange: 拖曳鎖定, then as many strokes as it takes, then release
  await pointAt('#s1-orange');
  await tapPhone('#btnLock');
  await pointAt('#s1-drop-orange', 0.5, 0.5, 10);
  await tapPhone('#btnLock');
  await settle();
  await report('1');
  await next();

  // ---- 2 打字 ----
  const texts = await mac.evaluate(() => window.playground.texts);
  out.texts = texts;
  await clickAt('#s2-live');
  if (texts.liveCheck === 'words') {
    // SOFA-9: iOS swipe typing, a whole word per input, the space before each next word; the third word picked
    // wrong first (its letters reversed), named by the page, then deleted and swiped again
    const swipe = async (words) => { for (const w of words) { await phone.evaluate((x) => window.__swipe(x), w); await sleep(450); } await sleep(1000); await settle(); };
    const words = texts.live.split(' ');
    const wrong = [...words[2]].reverse().join('');
    await swipe([...words.slice(0, 2), wrong]);
    out.stage2 = { wrongWord: await mac.textContent('#s2-live-status') };
    await phone.evaluate((n) => window.__dictate([[n, '']]), wrong.length + 1);
    await sleep(1000);
    await settle();
    await swipe(words.slice(2));
    out.stage2.live = await mac.textContent('#s2-live-status');
  } else {
    await typePhone(texts.live, 60);
  }
  if (!videoMode) {
    await clickAt('#s2-buffer');
    await tapPhone('#modeBtn');                      // 即時 → 整段
    await phone.evaluate((t) => window.__type(t), texts.buffer);
    await sleep(600);
    await tapPhone('#sendBtn');
    await sleep(400);
    await settle();
    await tapPhone('#modeBtn');                      // back to 即時
    await clickAt('#s2-zhuyin');
    for (const [marked, chosen] of [['ㄕㄚ ㄈㄚ', '沙發'], ['ㄕㄤˋ', '上'], ['ㄧㄝˇ ㄋㄥˊ', '也能'], ['ㄉㄚˇ', '打'], ['ㄓㄨㄥ ㄨㄣˊ', '中文']]) {
      await phone.evaluate((m) => window.__composeStart(m), marked);
      await sleep(450);
      await phone.evaluate(([m, c]) => window.__composeEnd(m, c), [marked, chosen]);
      await sleep(350);
    }
    await settle();
  }
  await clickAt('#s2-dictation');
  // iOS dictation: words appear and get rewritten as it listens (the pattern behind I-21)
  for (const steps of [[[0, '今天']], [[2, ''], [0, '今天天氣']], [[0, '很好，']], [[3, ''], [0, '很好，我們去']], [[3, ''], [0, '我們去公園']], [[0, '散步']]]) {
    await phone.evaluate((s) => window.__dictate(s), steps);
    await sleep(320);
  }
  await sleep(1200);                                 // the pause: the page sends the corrected sentence once
  await settle();
  await report('2');
  await next();

  if (!videoMode) {
  // ---- 3 送出後自動清空 ----
  await clickAt('#s3-input');
  await typePhone(texts.chat[0], 80);
  await clickAt('#s3-send');                          // a click on the Mac app's own send button: the phone box empties
  await typePhone(texts.chat[1], 80);
  await clickAt('#s3-send');
  await report('3');
  await next();

  // ---- 4 游標板 ----
  await clickAt('#s4-text', 0.5, 0.35);
  // a flick: ⌥→, a word at a time (fast enough that CDP's own delay between events still reads as > 1.5 px/ms)
  for (let i = 0; i < 3 && !(await state()).stages['4'].checks.word; i++) await caretDrag(320, 90);
  {
    const typo = (await mac.evaluate(() => window.playground.texts)).typo;   // read again: stage 4 may have started over
    const want = typo.at + typo.wrong.length;        // just after the wrong part
    for (let i = 0; i < 6; i++) {
      const s = await sel4();
      const d = s.a - want;
      if (d === 0 && (await state()).stages['4'].checks.arrows) break;
      if (d === 0) { await caretDrag(-28 * 2); continue; }   // not 3 presses yet: go further and come back
      await caretDrag(-14 * d - Math.sign(d) * 4, 300 + 90 * Math.abs(d));
    }
  }
  await tapPhone('#caretSelect');                    // ⇧ 選取 on
  const { wrong: bad, fix } = (await mac.evaluate(() => window.playground.texts)).typo;
  for (let i = 0; i < 6; i++) {
    const s = await sel4();
    const n = s.b - s.a;
    if (n === [...bad].length) break;
    await caretDrag(n < [...bad].length ? -14 * ([...bad].length - n) - 4 : 14 * (n - [...bad].length) + 4, 300);
  }
  await tapPhone('#caretSelect');                    // off again
  await typePhone(fix);
  await report('4');
  await next();
  }

  // ---- 5 快捷鍵 ----
  await clickAt('#s5-source');
  await panelTap('⌘A');
  await panelTap('⌘C');
  await closePanel();
  await clickAt('#s5-target');
  await panelTap('⌘V');
  await panelTap('⌘Z');
  await panelTap('⌃⇧⌘4');                            // closes the panel; then drag an area with a long press
  await sleep(300);
  await pointAt('#stage-5 .headline', 0.02, 0.1);
  await holdDragTo('#stage-5 .headline', 0.6, 0.95);
  await panelTap('⌘V');
  await closePanel();
  await report('5');
  await next();

  // ---- 6 縮放與桌面 ----
  {
    const c = center(await padArea());
    const pinch = async (from, to) => {
      const pts = (d) => [{ x: c.x - d, y: c.y, id: 1 }, { x: c.x + d, y: c.y + 6, id: 2 }];
      await touch('touchStart', pts(from));
      for (let i = 1; i <= 16; i++) { await touch('touchMove', pts(from + ((to - from) * i) / 16)); await sleep(18); }
      await touch('touchEnd', []);
      await sleep(600);
      await settle();
    };
    await pinch(30, 120);                            // spread: ⌘=
    await pinch(120, 30);                            // pinch: ⌘−
    const three = async (dx, dy) => { await stroke({ x: c.x - 40 - dx / 2, y: c.y - dy / 2 }, { x: c.x - 40 + dx / 2, y: c.y + dy / 2 }, 220, 3); await sleep(700); await settle(); };
    await three(-170, 0);                            // three fingers left: the desktop on the right
    await three(170, 0);                             // and back
    await three(0, -220);                            // up: Mission Control
    await three(0, -220);                            // again: closed
  }
  await clickAt('#chk-mission');
  await report('6');
  await next();

  // ---- 7 4.3 新排版 ----
  await clickAt('#s7-input');
  await typePhone(lang === 'zh' ? '4.3 的 ⏎ 在游標板右邊' : 'The 4.3 Enter key is next to the cursor pad', 50);
  await tapPhone('#inputCells [data-id="k:enter"]');
  await settle();
  // the phone's own layout: the editor, a real ≡ drag (the Mac cannot see this part; ticked by hand below)
  await phone.evaluate(() => document.getElementById('input').blur());
  await phone.evaluate(() => { const s = document.getElementById('keyStrip'); s.scrollLeft = s.scrollWidth; });
  await sleep(300);
  await tapPhone('#keyStrip .row-edit');
  await sleep(500);
  {
    const from = await box('#rowCurrent li[data-id="k:tab"] .handle');
    const to = await box('#rowCurrent li[data-id="x:select"]');
    await stroke({ x: from.x + from.w / 2, y: from.y + from.h / 2 }, { x: to.x + 40, y: to.y + to.h / 2 }, 500);
    await sleep(600);
  }
  await tapPhone('#rowDone');
  await sleep(400);
  for (const id of ['portrait', 'reorder', 'landscape']) await clickAt(`#chk-${id}`);
  await report('7');
  await next();
  await sleep(1500);

  const st = await state();
  await mac.screenshot({ path: join(shotsDir, 'sofa8-playground-summary.png') });
  clearInterval(pump);
  out = { ...out, state: st, simulated, macEvents: macLog.length, byKind: macLog.reduce((a, l) => { const k = l.split(' ')[0]; a[k] = (a[k] || 0) + 1; return a; }, {}) };
  console.log(`playground: ${st.total.done} / ${st.total.all} (${st.manual.length} of them ticked by hand on the page, as Ray would)`);
  console.log('simulated macOS parts:', simulated.length);
  if (casts) {
    const end = Date.now() / 1000;
    const lists = { mac: await casts.mac.stop(end), phone: await casts.phone.stop(end) };
    console.log('frame lists', JSON.stringify(lists));
    out.video = 'recorded (frames kept outside the repo)';   // no local paths in the evidence
  }
  await macCtx.close();
  await phoneCtx.close();
} finally {
  await browser.close();
  await server.stop();
}
writeFileSync(join(evDir, 'playground-dryrun.json'), JSON.stringify(out, null, 1));
process.exitCode = out.state && out.state.total.done === out.state.total.all ? 0 : 1;
