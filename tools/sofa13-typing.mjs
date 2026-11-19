// SOFA-13: Ray's iPhone (iOS 27 beta), held upright, typing: the page drew its landscape layout squeezed into the top
// of the screen, the "Tap here to type" hint broke onto a cut-off second line, the last key row was cut in half, and
// a big empty band sat above the keyboard. This replays the keyboard the way the browser handles the page's own
// viewport meta, and checks the layout:
//   - interactive-widget=resizes-content (4.5.1's meta; WebKit implements it from iOS 27.3 beta, bug 259770; Chrome
//     on Android too): the keyboard shrinks the layout viewport → setViewportSize to the visible part.
//   - resizes-visual / none: only the visual viewport shrinks (fake window.visualViewport), and innerHeight shrinks
//     with it as on iOS 27 (the layout viewport, documentElement.clientHeight, stays).
// Sizes: iPhone 17e in a Safari tab, measured in the iOS 27.0 simulator: page 390×699 with the keyboard down,
// 390×363 visible with the Zhuyin keyboard, its form bar and Safari's address pill up.
// Real page in headless Chrome against pkm-server --dry-run on 127.0.0.1 (nothing is posted to the Mac).
//   node tools/sofa13-typing.mjs [--label after|before] [--web <folder with an older web/>]
// Writes design/evidence/sofa13-typing-<label>.json and design/screenshots/sofa13/<label>-*.png; exit 1 on a FAIL.
import { chromium } from 'playwright-core';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { startServer, ROOT, IPHONE_UA } from './test-server.mjs';

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => (v.startsWith('--') ? [...a, [v.slice(2), arr[i + 1]]] : a), []));
const label = args.label || 'after';
const webRoot = args.web || join(ROOT, 'web');
const shotsDir = join(ROOT, 'design/screenshots/sofa13');
mkdirSync(shotsDir, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PAGE = { width: 390, height: 699 };      // Safari tab, keyboard down
const VISIBLE = 363;                  // keyboard up (portrait)
const LAND = { w: 844, h: 390, visible: 170 };
const UA = IPHONE_UA.replace(/OS 18_0/, 'OS 27_3').replace(/Version\/18\.0/, 'Version/27.3');

const meta = /<meta name="viewport" content="([^"]*)"/.exec(readFileSync(join(webRoot, 'index.html'), 'utf8'))[1];
const resizesContent = /interactive-widget=resizes-content/.test(meta);

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok: !!ok, detail: ok ? undefined : detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok || !detail ? '' : '  → ' + detail}`);
}

/** The visual viewport and innerHeight under the test's control (iOS 27: innerHeight follows the visual viewport). */
const fakeViewport = () => {
  const listeners = {};
  const real = Object.getOwnPropertyDescriptor(window, 'innerHeight');
  let visible = null;   // null = keyboard down
  const vv = { width: innerWidth, height: innerHeight, offsetTop: 0, offsetLeft: 0, pageTop: 0, pageLeft: 0, scale: 1,
    addEventListener(t, f) { (listeners[t] ||= []).push(f); }, removeEventListener() {} };
  Object.defineProperty(window, 'visualViewport', { value: vv, configurable: true });
  Object.defineProperty(window, 'innerHeight', { configurable: true, get: () => (visible == null ? real.get.call(window) : Math.min(visible, real.get.call(window))) });
  const sync = () => {
    vv.width = innerWidth;
    vv.height = innerHeight;
    const kb = document.getElementById('__kb');
    const below = document.documentElement.clientHeight - vv.height;
    if (kb) { kb.style.height = below + 'px'; kb.style.display = below > 0 ? 'flex' : 'none'; }
    for (const f of listeners.resize || []) f({ type: 'resize' });
  };
  window.__setVisible = (h) => {
    visible = h;
    let kb = document.getElementById('__kb');
    if (!kb) {
      kb = document.createElement('div');
      kb.id = '__kb';
      kb.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:99;background:#3b3f46;color:#c9ced6;font:14px -apple-system,sans-serif;display:flex;align-items:center;justify-content:center;pointer-events:none';
      kb.textContent = 'iOS keyboard (stand-in)';
      document.body.append(kb);
    }
    sync();
  };
  addEventListener('resize', sync);
};

const measure = () => {
  const r = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const b = el.getBoundingClientRect();
    const shown = b.width > 0 && b.height > 0 && getComputedStyle(el).display !== 'none' && !el.closest('[hidden]');
    return shown ? { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height), bottom: Math.round(b.bottom) } : null;
  };
  const input = document.getElementById('input');
  return {
    layout: { w: document.documentElement.clientWidth, h: document.documentElement.clientHeight },
    innerHeight, visualH: visualViewport.height,
    landscape: matchMedia('(orientation: landscape)').matches,
    appClass: document.getElementById('app').className,
    app: r('#app'), pad: r('#pad'), controls: r('#controls'), input: r('#input'), keys: r('#keyStrip'), bar: r('.bar'),
    sideHead: r('.side-head'),
    // the hint on one line: its text is narrower than the box's content area (an empty textarea's scrollHeight says
    // nothing about the placeholder)
    inputWraps: (() => {
      const cs = getComputedStyle(input);
      const ctx = document.createElement('canvas').getContext('2d');
      ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      const room = input.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      return ctx.measureText(input.placeholder).width > room;
    })(),
  };
};

const server = await startServer({ webRoot });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const scenes = [];
try {
  const ctx = await browser.newContext({ viewport: PAGE, deviceScaleFactor: 3, isMobile: true, hasTouch: true, locale: 'en-US', colorScheme: 'dark', userAgent: UA });
  await ctx.addInitScript(fakeViewport);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('PAGE ERROR ' + e.message));
  await page.goto(server.url + '#pair=' + server.code);
  await page.waitForFunction(() => document.getElementById('dot').classList.contains('ready'));
  await sleep(300);
  console.log(`page meta: ${meta}\nkeyboard model: ${resizesContent ? 'resizes-content → the layout viewport shrinks' : 'resizes-visual → only the visual viewport shrinks'}`);

  // the keyboard as the browser applies it to this page
  const keyboard = async (size, visible) => {
    if (visible == null) {
      await page.setViewportSize(size);
      await page.evaluate(() => window.__setVisible(null));
    } else if (resizesContent) {
      await page.setViewportSize({ width: size.width, height: visible });
      await page.evaluate((h) => window.__setVisible(h), visible);
    } else {
      await page.setViewportSize(size);
      await page.evaluate((h) => window.__setVisible(h), visible);
    }
    await sleep(300);
  };
  const scene = async (name) => {
    const m = await page.evaluate(measure);
    await page.screenshot({ path: join(shotsDir, `${label}-${name}.png`) });
    scenes.push({ name, ...m });
    return m;
  };
  const upright = { ...PAGE };

  // 1. upright, keyboard down (baseline)
  await keyboard(upright, null);
  let m = await scene('portrait-keyboard-down');
  check('直拿、鍵盤收起：直式版面（上方狀態列、觸控板在上、控制區在下）', !m.landscape && m.bar && m.pad && m.controls && m.pad.bottom <= m.controls.y, JSON.stringify(m));

  // 2. upright, tap the box, keyboard up (Ray's screenshot)
  await page.focus('#input');
  await keyboard(upright, VISIBLE);
  m = await scene('portrait-keyboard-up');
  const kbTop = m.visualH;
  check('直拿打字：還是直式版面，不是橫式側欄（orientation portrait、沒有側欄標頭）', !m.landscape && !m.sideHead, `landscape=${m.landscape} layout=${m.layout.w}×${m.layout.h} sideHead=${JSON.stringify(m.sideHead)}`);
  check('直拿打字：觸控板全寬、在控制區上面', m.pad && m.controls && m.pad.w >= 360 && m.pad.bottom <= m.controls.y, `pad=${JSON.stringify(m.pad)} controls=${JSON.stringify(m.controls)}`);
  check('直拿打字：頁面高度＝鍵盤上方可見的高度', m.app && m.app.y === 0 && Math.abs(m.app.h - kbTop) <= 1, `app=${JSON.stringify(m.app)} visible=${kbTop}`);
  check('直拿打字：控制區貼齊鍵盤上緣（最下排按鍵和鍵盤之間 ≤ 12 px）', m.keys && kbTop - m.keys.bottom >= 0 && kbTop - m.keys.bottom <= 12, `keys=${JSON.stringify(m.keys)} keyboard top=${kbTop}`);
  check('直拿打字：最下排按鍵完整（不被切、不在鍵盤後面）', m.keys && m.keys.h >= 40 && m.keys.bottom <= kbTop, `keys=${JSON.stringify(m.keys)} keyboard top=${kbTop}`);
  check('直拿打字：「Tap here to type」一行放得下，沒有換行', m.input && !m.inputWraps && m.input.h <= 46, `input=${JSON.stringify(m.input)} wraps=${m.inputWraps}`);
  check('直拿打字：觸控板高度至少 230 px（控制區只佔一排文字框＋一排按鍵）', m.pad && m.pad.h >= 230, `pad=${JSON.stringify(m.pad)}`);
  check('直拿打字：看得出鍵盤開著（#app.kbd，下方安全區域不留白）', /\bkbd\b/.test(m.appClass) && /\btyping\b/.test(m.appClass), `class="${m.appClass}" innerHeight=${m.innerHeight} layout=${m.layout.h}`);

  // 3. keyboard down again, still focused (the ✓ in the form bar closes it in Safari only through blur; S-105 leaves
  //    a small difference)
  await keyboard(upright, PAGE.height - 24);
  m = await scene('portrait-keyboard-closing');
  check('直拿、鍵盤收起剩 24 px 差（S-105）：不算鍵盤開著', !m.landscape && !/\bkbd\b/.test(m.appClass), `class="${m.appClass}"`);
  await page.evaluate(() => document.activeElement.blur());
  await keyboard(upright, null);
  m = await scene('portrait-after');
  check('收起鍵盤後回到一開始的直式版面', !m.landscape && m.bar && !/\btyping|kbd\b/.test(m.appClass) && m.pad.h === scenes[0].pad.h, `class="${m.appClass}" pad=${JSON.stringify(m.pad)} before=${JSON.stringify(scenes[0].pad)}`);

  // 4. landscape, keyboard up: the landscape layout stays (side panel + pad)
  const side = { width: LAND.w, height: LAND.h };
  await keyboard(side, null);
  m = await scene('landscape-keyboard-down');
  check('橫拿、鍵盤收起：橫式版面（側欄＋觸控板）', m.landscape && m.sideHead && m.controls && m.pad && m.controls.x < m.pad.x, JSON.stringify(m));
  await page.focus('#input');
  await keyboard(side, LAND.visible);
  m = await scene('landscape-keyboard-up');
  check('橫拿打字：還是橫式版面，高度＝鍵盤上方可見的高度', m.landscape && m.sideHead && Math.abs(m.app.h - m.visualH) <= 1, `landscape=${m.landscape} app=${JSON.stringify(m.app)} visible=${m.visualH}`);
  await page.evaluate(() => document.activeElement.blur());
  await keyboard(upright, null);
  await ctx.close();
} finally {
  await browser.close();
  await server.stop();
}
const failed = results.filter((r) => !r.ok).length;
writeFileSync(join(ROOT, `design/evidence/sofa13-typing-${label}.json`), JSON.stringify({ label, meta, resizesContent, results, scenes }, null, 1));
console.log(`${failed ? 'FAIL' : 'PASS'} sofa13-typing ${label}: ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
