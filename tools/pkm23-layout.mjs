// PKM-2-3 before / after (headless Chrome, dry-run server: nothing reaches the Mac):
//  - pad size with and without the mini-map: portrait 390×844 (iPhone 14), portrait 375×667 (iPhone SE), landscape 844×390;
//  - the key row (I-19): can a swipe that starts on a button scroll it, does that swipe press the button, and is
//    there a "more" hint. Screenshots at 390 and 375 px wide.
//   node tools/pkm23-layout.mjs --label before --web <web exported from 7552b51>   |   node tools/pkm23-layout.mjs --label after
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { startServer, ROOT, IPHONE_UA, INSETS } from './test-server.mjs';

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => (v.startsWith('--') ? [...a, [v.slice(2), arr[i + 1]]] : a), []));
const label = args.label || 'run';
const webRoot = args.web || join(ROOT, 'web');
const shotsDir = join(ROOT, 'design/screenshots/v2');
mkdirSync(shotsDir, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const DEVICES = [
  { name: 'portrait-390', viewport: { width: 390, height: 844 }, insets: INSETS.portrait },
  { name: 'portrait-375', viewport: { width: 375, height: 667 }, insets: { top: 20, bottom: 0, left: 0, right: 0 } }, // iPhone SE
  { name: 'landscape-844', viewport: { width: 844, height: 390 }, insets: INSETS.landscape },
];

const measure = () => {
  const box = (sel) => {
    const el = document.querySelector(sel);
    if (!el || el.closest('[hidden]') || getComputedStyle(el).display === 'none') return null;
    const b = el.getBoundingClientRect();
    return b.width && b.height ? { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) } : null;
  };
  const keys = document.getElementById('keyStrip');
  const wrap = document.getElementById('keysWrap');
  const buttons = keys ? [...keys.querySelectorAll('button')] : [];
  const kr = keys && keys.getBoundingClientRect();
  return {
    pad: box('#pad'), minimap: box('#minimap'), keys: box('#keyStrip'),
    keyCount: buttons.length,
    keysScrollable: keys ? keys.scrollWidth - keys.clientWidth : 0,
    // buttons whose right edge is past the row's right edge (out of sight until scrolled)
    hiddenKeys: kr ? buttons.filter((b) => b.getBoundingClientRect().right > kr.right + 1).map((b) => b.textContent.trim()) : [],
    moreHint: wrap ? { left: wrap.classList.contains('more-left'), right: wrap.classList.contains('more-right') } : null,
  };
};

const server = await startServer({ webRoot });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = [];
try {
  // One phone (a pairing code pairs one phone); each size is a resize + reload, the token stays in storage.
  const ctx = await browser.newContext({ viewport: DEVICES[0].viewport, deviceScaleFactor: 3, isMobile: true, hasTouch: true, locale: 'zh-TW', colorScheme: 'dark', userAgent: IPHONE_UA });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await page.goto(server.url + '#pair=' + server.code);
  await page.waitForFunction(() => document.getElementById('dot').classList.contains('ready'));
  for (const d of DEVICES) {
    await page.setViewportSize(d.viewport);
    await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: d.insets });
    await page.goto(server.url);
    await page.waitForFunction(() => document.getElementById('dot').classList.contains('ready'));
    await sleep(400);
    const r = { name: d.name, viewport: d.viewport, ...(await page.evaluate(measure)) };
    await page.screenshot({ path: join(shotsDir, `pkm23-${label}-${d.name}.png`) });

    if (d.name.startsWith('portrait')) {
      // Log what the page sends, then swipe the key row leftwards starting on its second button.
      await page.evaluate(() => {
        window.__sent = [];
        for (const fn of ['send', 'sendReliable']) {
          const orig = window.pkmLink[fn].bind(window.pkmLink);
          window.pkmLink[fn] = (m) => { window.__sent.push(m); return orig(m); };
        }
      });
      const b = await page.evaluate(() => {
        const el = document.querySelectorAll('#keyStrip button')[1].getBoundingClientRect();
        return { x: el.x + el.width / 2, y: el.y + el.height / 2, text: document.querySelectorAll('#keyStrip button')[1].textContent.trim() };
      });
      const pt = (x) => [{ x, y: b.y, id: 1, radiusX: 4, radiusY: 4, force: 1 }];
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(b.x) });
      for (let i = 1; i <= 12; i++) { await sleep(16); await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt(b.x - i * 20) }); }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await sleep(600);
      r.swipe = await page.evaluate((startButton) => ({
        startButton,
        scrollLeft: Math.round(document.getElementById('keyStrip').scrollLeft),
        sent: window.__sent.filter((m) => m.t !== 'ping'),
        panelOpened: !document.getElementById('shortcutPanel').hidden,
      }), b.text);
      r.afterSwipe = await page.evaluate(measure);
      await page.screenshot({ path: join(shotsDir, `pkm23-${label}-${d.name}-swiped.png`) });

      // A plain tap on a key that is in sight after the swipe must still send exactly that key, once.
      await page.evaluate(() => { window.__sent = []; });
      const key = await page.evaluate(() => {
        const row = document.getElementById('keyStrip').getBoundingClientRect();
        const el = [...document.querySelectorAll('#keyStrip button[data-k]')]
          .find((b) => { const r = b.getBoundingClientRect(); return r.left >= row.left + 36 && r.right <= row.right - 36; });
        const r = el.getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2, k: el.dataset.k };
      });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: key.x, y: key.y, id: 1 }] });
      await sleep(60);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await sleep(300);
      r.tapKey = { k: key.k, sent: await page.evaluate(() => window.__sent.filter((m) => m.t !== 'ping')) };
    }
    results.push(r);
  }
  await ctx.close();
} finally {
  await browser.close();
  await server.stop();
}
// The phone's hint after a three-finger swipe (I-18): a dry-run Mac that says ⌃← is off and has one Space.
let hints = null;
if (label === 'after') {
  const hintServer = await startServer({ webRoot, env: { PKM_DRY_HOTKEYS_OFF: 'spaceLeft', PKM_DRY_SPACES: '1' } });
  const b2 = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const ctx = await b2.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'zh-TW', colorScheme: 'dark', userAgent: IPHONE_UA });
    const page = await ctx.newPage();
    const cdp = await ctx.newCDPSession(page);
    await page.goto(hintServer.url + '#pair=' + hintServer.code);
    await page.waitForFunction(() => document.getElementById('dot').classList.contains('ready'));
    await sleep(300);
    const pad = await page.evaluate(() => { const r = document.getElementById('pad').getBoundingClientRect(); return { x: r.x + r.width * 0.45, y: r.y + r.height * 0.5 }; });
    const swipe = async (dx) => {
      const pts = (s) => [0, 1, 2].map((i) => ({ x: pad.x + i * 40 + s * dx, y: pad.y, id: i + 1 }));
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pts(0) });
      for (let s = 1; s <= 8; s++) { await sleep(16); await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pts(s / 8) }); }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await sleep(500);
      return page.evaluate(() => document.getElementById('banner').textContent);
    };
    hints = {
      status: await page.evaluate(() => document.getElementById('macStatus').textContent),
      swipeRight: await swipe(160), // ⌃← (left desktop): switched off on this dry-run Mac
      swipeLeft: await swipe(-160), // ⌃→ (right desktop): on, but only one Space
    };
    await page.screenshot({ path: join(shotsDir, 'pkm23-after-hint.png') });
    await ctx.close();
  } finally {
    await b2.close();
    await hintServer.stop();
  }
  console.log('hints', JSON.stringify(hints, null, 1));
}
if (hints) results.push({ name: 'hints', ...hints });
const out = join(ROOT, `design/evidence/pkm23-layout-${label}.json`);
writeFileSync(out, JSON.stringify(results, null, 1));
for (const r of results.filter((x) => x.name !== 'hints')) {
  const swipe = r.swipe ? `  swipe on "${r.swipe.startButton}": scrollLeft ${r.swipe.scrollLeft}, sent ${JSON.stringify(r.swipe.sent)}, panel ${r.swipe.panelOpened}` : '';
  const tapEsc = r.tapKey ? `  tap ${r.tapKey.k}: ${JSON.stringify(r.tapKey.sent)}` : '';
  console.log(`${r.name.padEnd(14)} pad ${r.pad ? r.pad.w + '×' + r.pad.h : '—'}  minimap ${r.minimap ? r.minimap.w + '×' + r.minimap.h : '—'}  keys ${r.keyCount} (scrollable ${r.keysScrollable} px, out of sight: ${r.hiddenKeys.join(' ') || '—'}) hint ${JSON.stringify(r.moreHint)}${swipe}${tapEsc}`);
}
