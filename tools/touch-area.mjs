// Reproduces "the touch area gets tiny while typing" (PKM-2 §2-3) and measures it.
// Emulates what iOS does when the keyboard opens: the layout viewport stays 390×844, only the visual
// viewport shrinks (iOS ignores interactive-widget), and the safe-area insets stay (top 47, bottom 34).
// Starts its own pkm-server --dry-run on 127.0.0.1 (nothing is posted to the Mac) and stops it at the end.
//   node tools/touch-area.mjs --label before|after
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { startServer, ROOT, IPHONE_UA as UA, INSETS } from './test-server.mjs';
const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => (v.startsWith('--') ? [...a, [v.slice(2), arr[i + 1]]] : a), []));
const label = args.label || 'run';
const webRoot = args.web || join(ROOT, 'web'); // e.g. an older version exported with `git archive` for "before"
const shotsDir = join(ROOT, 'design/screenshots/v2');
mkdirSync(shotsDir, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Keyboard heights in CSS px on a 390×844 iPhone (see research/raw/v2-ios-keyboard.md):
// Zhuyin keyboard with its candidate bar ≈ 336 (incl. the 34 px home-indicator strip it covers);
// in a Safari tab the form accessory bar adds ≈ 44.
export const KEYBOARDS = { homeScreen: 336, safariTab: 380 };

/** Replaces window.visualViewport with one the test controls, like iOS: only the visual viewport shrinks. */
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
    // Grey stand-in for the iOS keyboard in screenshots (outside #app, does not take part in layout).
    let kb = document.getElementById('__kb');
    if (!kb) {
      kb = document.createElement('div');
      kb.id = '__kb';
      kb.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:99;background:#3b3f46;color:#c9ced6;font:14px -apple-system,sans-serif;display:flex;align-items:center;justify-content:center;pointer-events:none';
      document.body.append(kb);
    }
    kb.style.height = h + 'px';
    kb.style.display = h ? 'flex' : 'none';
    kb.textContent = `（模擬 iOS 注音鍵盤區域 ${h} px）`;
    for (const fn of listeners.resize || []) fn({ type: 'resize' });
  };
  addEventListener('resize', () => window.__setKeyboard(window.__keyboard));
};

const measure = () => {
  const r = (id) => {
    const el = document.getElementById(id);
    if (!el) return null;
    const b = el.getBoundingClientRect();
    const visible = b.width > 0 && b.height > 0 && getComputedStyle(el).display !== 'none' && !el.closest('[hidden]');
    return visible ? { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) } : null;
  };
  const pad = r('pad');
  const strip = r('strip');
  const vvh = window.visualViewport.height;
  const app = r('app');
  const usable = pad ? pad.w * pad.h - (strip ? strip.w * strip.h : 0) : 0;
  // Anything that overflows the app box is cut off (overflow hidden) or hidden behind the keyboard.
  const clipped = [...document.querySelectorAll('#controls > *, .bar')]
    .filter((el) => el.getBoundingClientRect().height > 0 && el.getBoundingClientRect().bottom > vvh + 0.5)
    .map((el) => el.id || el.className);
  return {
    viewport: { w: innerWidth, h: innerHeight, visualH: vvh, keyboard: window.__keyboard },
    app, bar: r('bar') || (document.querySelector('.bar') && (() => { const b = document.querySelector('.bar').getBoundingClientRect(); return { h: Math.round(b.height) }; })()),
    pad, strip, controls: r('controls'), buttons: document.querySelector('.buttons') ? Math.round(document.querySelector('.buttons').getBoundingClientRect().height) : 0,
    input: r('input'), keys: r('keyStrip'), shortcuts: r('shortcutPanel'),
    padUsableArea: usable, padShareOfVisible: Math.round((usable / (innerWidth * vvh)) * 1000) / 10, clipped,
  };
};

const server = await startServer({ webRoot });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = [];
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: UA });
  await ctx.addInitScript(fakeVisualViewport);
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: INSETS.portrait });
  await page.goto(server.url + '#pair=' + server.code);
  await page.waitForFunction(() => document.getElementById('dot').classList.contains('ready'));
  await sleep(300);

  const scene = async (name, note, setup) => {
    await setup();
    await sleep(250);
    const m = await page.evaluate(measure);
    await page.screenshot({ path: join(shotsDir, `${label}-${name}.png`) });
    results.push({ name, note, ...m });
  };

  await scene('portrait-no-keyboard', '直拿、鍵盤收起（基準）', async () => {});
  await scene('portrait-keyboard-homescreen', '直拿、點文字框、注音鍵盤彈出（主畫面 App：鍵盤＋選字列 336 px）', async () => {
    await page.focus('#input');
    await page.evaluate((h) => window.__setKeyboard(h), KEYBOARDS.homeScreen);
  });
  await scene('portrait-keyboard-safari', '同上，但在 Safari 分頁（再多表單輔助列 44 px）', async () => {
    await page.evaluate((h) => window.__setKeyboard(h), KEYBOARDS.safariTab);
  });
  await scene('portrait-keyboard-shortcuts', '鍵盤彈出（Safari）＋打開快捷鍵面板', async () => {
    await page.evaluate(() => {
      const b = document.getElementById('shortcutsBtn') || document.querySelector('[data-open="shortcuts"]');
      b.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
  });
  await scene('portrait-keyboard-multiline', '鍵盤彈出（Safari）＋整段模式打了三行字', async () => {
    await page.evaluate(() => {
      const s = document.getElementById('shortcutPanel') || document.getElementById('shortcuts');
      if (s && !s.hidden) document.getElementById('shortcutsBtn').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await page.evaluate(() => { document.getElementById('modeBtn').dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    await cdp.send('Input.insertText', { text: '第一行\n第二行\n第三行' });
  });
  // restore the mode setting so later runs start the same way
  await page.evaluate(() => { document.getElementById('modeBtn').dispatchEvent(new MouseEvent('click', { bubbles: true })); });
  await ctx.close();
} finally {
  await browser.close();
  await server.stop();
}
const out = join(ROOT, `design/evidence/v2-touch-area-${label}.json`);
writeFileSync(out, JSON.stringify(results, null, 1));
for (const r of results) {
  console.log(`${r.name.padEnd(32)} visual ${r.viewport.visualH}  pad ${r.pad ? r.pad.w + '×' + r.pad.h : '—'}  usable ${r.padUsableArea} px²  (${r.padShareOfVisible}% of visible)  clipped: ${r.clipped.join(',') || '—'}`);
}
