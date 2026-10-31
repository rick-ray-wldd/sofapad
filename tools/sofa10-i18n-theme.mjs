// SOFA-10 (4.4): the phone page in English and Chinese, light and dark. Headless Chrome with real touches (CDP), a
// dry-run Mac (its log lists what it would type).
//   - language: the browser's (zh… → Chinese, else English); switched in ⚙︎ at once on a live connection (no new
//     connection, the Mac still gets what is typed, a 整段 draft stays); remembered after a reload; <html lang> follows
//   - in English: no Chinese anywhere on screen (texts, aria-label, title, placeholder, the key list) in every sheet,
//     panel, banner and both orientations; only the language switch's own 中文 is Chinese
//   - theme: System follows prefers-color-scheme (also while open), Light, Dark; remembered; the very first frame
//     already has it (no flash); theme-color and the iOS status bar style follow
//   - contrast: every visible text against what is behind it, WCAG AA (4.5:1, large text 3:1), both themes and
//     languages, in each of those states
//   - screenshots (design/screenshots/sofa10): English / Chinese × light / dark × portrait / landscape, ⚙︎ open, the row
//     editor and the cursor pad held
//   node tools/sofa10-i18n-theme.mjs [--video DIR]   (--video: also records switching language and theme on a live
//                                                      connection, encoded at 60 fps by the system ffmpeg)
import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { startServer, ROOT, IPHONE_UA, INSETS } from './test-server.mjs';
import { startScreencast } from './screencast.mjs';

const args = process.argv.slice(2);
const videoDir = args.includes('--video') ? resolve(args[args.indexOf('--video') + 1]) : null;   // absolute: ffmpeg's list is read from its own folder
const shotsDir = join(ROOT, 'design/screenshots/sofa10');
const evDir = join(ROOT, 'design/evidence/sofa10');
mkdirSync(shotsDir, { recursive: true });
mkdirSync(evDir, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok: !!ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok ? '' : '  → ' + detail}`);
};
const BG = { light: 'rgb(242, 243, 245)', dark: 'rgb(14, 16, 19)' };   // --bg
const BAR = { light: '#f2f3f5', dark: '#0e1013' };

/** In the page, before its own scripts: counts WebSocket connections, notes every frame, and the two scans. */
const instrument = () => {
  window.__wsOpens = 0;
  const WS = window.WebSocket;
  window.WebSocket = class extends WS { constructor(...a) { super(...a); window.__wsOpens++; } };
  window.__frames = [];
  const tick = () => {
    const root = document.documentElement;
    window.__frames.push({
      theme: root.getAttribute('data-theme'), lang: root.getAttribute('lang'), pending: root.classList.contains('i18n-pending'),
      bg: document.body ? getComputedStyle(document.body).backgroundColor : null,
      mode: document.getElementById('modeBtn')?.textContent || '',
    });
    if (window.__frames.length < 30) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  const CJK = /[　-〿㄀-ㄯ㐀-䶿一-鿿＀-￯]/;
  const name = (el) => (el.id ? '#' + el.id : el.tagName.toLowerCase() + [...el.classList].map((c) => '.' + c).join(''))
    + (el.parentElement && !el.id ? ' in ' + (el.parentElement.id ? '#' + el.parentElement.id : el.parentElement.tagName.toLowerCase()) : '');
  const opacity = (el) => { let o = 1; for (let e = el; e && e.nodeType === 1; e = e.parentElement) o *= Number(getComputedStyle(e).opacity); return o; };
  const visible = (el) => !!el.getClientRects().length && getComputedStyle(el).visibility === 'visible' && !el.closest('[hidden]') && opacity(el) > 0.05;
  const texts = (root) => {
    const out = [];
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) if (n.textContent.trim() && n.parentElement && visible(n.parentElement)) out.push(n);
    return out;
  };
  /** Chinese on screen. An element in another language on purpose (lang="zh-Hant": the switch's 中文) does not count. */
  window.__cjk = () => {
    const own = document.documentElement.getAttribute('lang');
    const elsewhere = (el) => { const l = el.closest('[lang]'); return !!l && l !== document.documentElement && l.getAttribute('lang') !== own; };
    const bad = [];
    for (const n of texts(document.body)) if (CJK.test(n.textContent) && !elsewhere(n.parentElement)) bad.push(`${name(n.parentElement)}: ${n.textContent.trim().slice(0, 50)}`);
    for (const el of document.querySelectorAll('*')) {
      for (const a of ['aria-label', 'title', 'placeholder', 'alt']) {
        const v = el.getAttribute(a);
        if (v && CJK.test(v) && !elsewhere(el)) bad.push(`${name(el)} [${a}]: ${v.slice(0, 50)}`);
      }
    }
    for (const o of document.querySelectorAll('option, optgroup')) if (CJK.test(o.label || o.textContent)) bad.push(`${o.tagName.toLowerCase()}: ${o.label || o.textContent}`);
    if (CJK.test(document.title)) bad.push('title: ' + document.title);
    return bad;
  };
  /** WCAG contrast of every visible text (and empty fields' placeholders) against what is painted behind it. */
  window.__contrast = () => {
    const parse = (c) => { const m = /rgba?\(([^)]+)\)/.exec(c || ''); if (!m) return null; const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]; };
    const over = (top, under) => [0, 1, 2].map((i) => top[i] * top[3] + under[i] * (1 - top[3])).concat(1);
    const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
    const ratio = (a, b) => { const x = lum(a); const y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
    const behind = (el) => {
      const chain = [];
      for (let e = el; e && e.nodeType === 1; e = e.parentElement) chain.unshift(e);
      let c = [255, 255, 255, 1];
      for (const e of chain) { const b = parse(getComputedStyle(e).backgroundColor); if (b && b[3] > 0) c = over([b[0], b[1], b[2], b[3] * opacity(e)], c); }
      return c;
    };
    const measure = (el, color, label) => {
      const cs = getComputedStyle(el);
      const fg = parse(color);
      const bg = behind(el);
      const r = ratio(over([fg[0], fg[1], fg[2], fg[3] * opacity(el)], bg), bg);
      const size = parseFloat(cs.fontSize);
      const need = size >= 24 || (size >= 18.66 && Number(cs.fontWeight) >= 700) ? 3 : 4.5;
      return { text: label.slice(0, 40), el: name(el), ratio: Math.round(r * 100) / 100, need };
    };
    // with a sheet open, only the sheet is on screen to read (the rest is under the scrim)
    const root = document.querySelector('.sheet:not([hidden])') || document.body;
    const seen = new Set();
    const out = [];
    for (const n of texts(root)) {
      const el = n.parentElement;
      if (seen.has(el) || el.closest('button:disabled, .haptic, #__mac')) continue;
      seen.add(el);
      out.push(measure(el, getComputedStyle(el).color, n.textContent.trim()));
    }
    for (const el of root.querySelectorAll('input[placeholder], textarea[placeholder]')) {
      if (visible(el) && !el.value && el.placeholder) out.push(measure(el, getComputedStyle(el, '::placeholder').color, '(placeholder) ' + el.placeholder));
    }
    return out;
  };
};

/** For the recording only: a ring where each finger is, visible on both themes. */
const drawTouches = () => {
  const dots = new Map();
  const show = (e) => {
    for (const t of e.changedTouches) {
      let d = dots.get(t.identifier);
      if (!d) {
        d = document.createElement('div');
        d.style.cssText = 'position:fixed;width:38px;height:38px;margin:-19px 0 0 -19px;border-radius:50%;background:rgba(128,128,128,.3);border:2px solid rgba(255,255,255,.9);box-shadow:0 0 0 2px rgba(0,0,0,.45);z-index:200;pointer-events:none';
        document.documentElement.append(d);
        dots.set(t.identifier, d);
      }
      d.style.left = t.clientX + 'px';
      d.style.top = t.clientY + 'px';
    }
  };
  const hide = (e) => { for (const t of e.changedTouches) { const d = dots.get(t.identifier); dots.delete(t.identifier); if (d) setTimeout(() => d.remove(), 120); } };
  addEventListener('touchstart', show, { capture: true, passive: true });
  addEventListener('touchmove', show, { capture: true, passive: true });
  addEventListener('touchend', hide, { capture: true, passive: true });
};

const server = await startServer();
const browser = await chromium.launch({ channel: 'chrome', headless: true });
// A pairing code pairs one phone only (v1 security design): later phones reuse the first one's token (as v2-browser).
let token = null;
let mark = 0;
/** What the dry-run Mac typed since the last call. */
const macTyped = () => {
  const lines = [...server.log().matchAll(/\[dry-run\] (.*)/g)].map((m) => m[1]);
  const fresh = lines.slice(mark);
  mark = lines.length;
  return fresh.map((l) => /^type (".*")$/.exec(l)).filter(Boolean).map((m) => JSON.parse(m[1])).join('');
};

async function phone({ locale = 'en-US', scheme = 'light', landscape = false, stored = null, pair = true, record = null, scale = 3 } = {}) {
  const size = landscape ? { width: 844, height: 390 } : { width: 390, height: 844 };
  const ctx = await browser.newContext({ viewport: size, deviceScaleFactor: scale, isMobile: true, hasTouch: true, userAgent: IPHONE_UA, locale, colorScheme: scheme });
  await ctx.addInitScript(instrument);
  if (record) await ctx.addInitScript(drawTouches);
  if (pair && token) await ctx.addInitScript((t) => { if (!localStorage.getItem('pkm.token')) localStorage.setItem('pkm.token', t); }, token);
  if (stored) await ctx.addInitScript((s) => { if (!sessionStorage.getItem('__seeded')) { for (const [k, v] of Object.entries(s)) localStorage.setItem('pkm.' + k, v); sessionStorage.setItem('__seeded', '1'); } }, stored);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const cdp = await ctx.newCDPSession(page);
  const insets = async (land) => cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: land ? INSETS.landscape : INSETS.portrait });
  await insets(landscape);
  await page.goto(server.url + (pair && !token ? '#pair=' + server.code : ''));
  if (pair) {
    await page.waitForFunction(() => document.getElementById('dot').classList.contains('ready'));
    token ||= await page.evaluate(() => localStorage.getItem('pkm.token'));
  } else {
    await page.waitForFunction(() => !document.getElementById('pairSheet').hidden);
  }
  await sleep(250);
  const cast = record ? await startScreencast(page, record, { maxWidth: size.width * 2, maxHeight: size.height * 2 }) : null;
  const touch = (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points.map((p, i) => ({ x: p.x, y: p.y, id: i, radiusX: 4, radiusY: 4, force: 1 })) });
  const center = (sel) => page.evaluate((s) => {
    const e = document.querySelector(s);
    if (!e || e.closest('[hidden]') || !e.getClientRects().length) return null;
    e.scrollIntoView({ block: 'nearest' });   // a button further down a sheet: scrolled to first, as a finger would
    const r = e.getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight) return null;
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }, sel);
  /** A real touch at the element's centre. */
  const tap = async (sel, hold = 0) => {
    const c = await center(sel);
    if (!c) throw new Error('not visible: ' + sel);
    await touch('touchStart', [c]);
    await sleep(hold || 40);
    await touch('touchEnd', []);
    await sleep(record ? 450 : 120);
  };
  const state = () => page.evaluate(() => ({
    lang: document.documentElement.getAttribute('lang'), theme: document.documentElement.getAttribute('data-theme'),
    bar: document.querySelector('meta[name="theme-color"]').content,
    status: document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]').content,
    mode: document.getElementById('modeBtn').textContent, title: document.querySelector('#settingsSheet h2').textContent,
    host: document.getElementById('host').textContent, link: window.pkmLink.state, opens: window.__wsOpens,
    bg: getComputedStyle(document.body).backgroundColor, input: document.getElementById('input').value,
    stored: { lang: localStorage.getItem('pkm.lang'), theme: localStorage.getItem('pkm.theme') },
  }));
  /** Typing at the caret the way the iOS keyboard does it (insertText input events, as tools/sofa6-commit.mjs). */
  const type = (text) => page.evaluate((s) => {
    const el = document.getElementById('input');
    el.focus();
    for (const ch of s) {
      el.setRangeText(ch, el.selectionStart, el.selectionEnd, 'end');
      el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: ch }));
    }
  }, text);
  const rotate = async (land) => {
    await page.setViewportSize(land ? { width: 844, height: 390 } : { width: 390, height: 844 });
    await insets(land);
    await page.evaluate(() => dispatchEvent(new Event('resize')));
    await sleep(250);
  };
  return { ctx, page, cdp, tap, touch, center, state, type, rotate, errors, cast };
}

// ---------- 1. the language the page starts in, and the first frame's theme ----------
{
  const starts = [
    ['en-US', 'light', null, 'en', 'light'], ['zh-TW', 'dark', null, 'zh-Hant', 'dark'], ['zh-CN', 'light', null, 'zh-Hant', 'light'],
    ['fr-FR', 'dark', null, 'en', 'dark'], ['ja-JP', 'light', null, 'en', 'light'],
    ['en-US', 'light', { theme: 'dark' }, 'en', 'dark'], ['zh-TW', 'dark', { theme: 'light' }, 'zh-Hant', 'light'],
    ['en-US', 'dark', { lang: 'zh' }, 'zh-Hant', 'dark'], ['zh-TW', 'light', { lang: 'en', theme: 'dark' }, 'en', 'dark'],
  ];
  for (const [locale, scheme, stored, wantLang, wantTheme] of starts) {
    const p = await phone({ locale, scheme, stored });
    const frames = await p.page.evaluate(() => window.__frames);
    const s = await p.state();
    const label = `${locale}, system ${scheme}${stored ? ', saved ' + JSON.stringify(stored) : ''}`;
    check(`start (${label}): lang=${wantLang}, theme ${wantTheme}`, s.lang === wantLang && s.theme === wantTheme && s.bar === BAR[wantTheme], JSON.stringify(s));
    const wrong = frames.filter((f) => f.theme !== wantTheme || f.bg !== BG[wantTheme] || f.lang !== wantLang);
    const empty = frames.filter((f) => !f.pending && !f.mode);
    check(`start (${label}): every frame from the first is ${wantTheme} (${frames.length} frames), no frame shows empty buttons`,
      frames.length > 0 && !wrong.length && !empty.length, JSON.stringify({ first: frames[0], wrong: wrong[0], empty: empty[0] }));
    check(`start (${label}): no page error`, !p.errors.length, p.errors.join(' | '));
    await p.ctx.close();
  }
}

// ---------- 2. switching on a live connection ----------
{
  const p = await phone({ locale: 'en-US', scheme: 'light' });
  const { page, tap, state, type } = p;
  macTyped();
  await type('one ');
  await sleep(1100);   // several characters at once go after the 0.7 s pause, as dictation does
  const before = await state();
  check('live: English, light; the Mac types "one "', before.lang === 'en' && before.theme === 'light' && before.mode === 'Live' && macTyped() === 'one ', JSON.stringify(before));
  await page.evaluate(() => document.getElementById('input').blur());
  await tap('#settingsBtn');
  const aria = await page.evaluate(() => [...document.querySelectorAll('#langSeg [role=radio], #themeSeg [role=radio]')].map((b) => b.getAttribute('aria-checked')).join());
  check('⚙︎: Auto and System are the chosen ones at first', aria === 'true,false,false,true,false,false', aria);
  const t0 = Date.now();
  await tap('#langSeg [data-lang="zh"]');
  let s = await state();
  check('tap 中文: the page is Chinese at once (html lang, ⚙︎ title, mode, host), no reload', s.lang === 'zh-Hant' && s.title === '設定' && s.mode === '即時' && s.stored.lang === 'zh', JSON.stringify(s));
  check('… on the same connection (no new WebSocket, still ready)', s.opens === before.opens && s.link === 'ready', `${before.opens} → ${s.opens}, ${s.link}`);
  await tap('#themeSeg [data-theme-choice="dark"]');
  s = await state();
  check('tap 深色: dark at once; theme-color and the status bar style follow; saved', s.theme === 'dark' && s.bg === BG.dark && s.bar === BAR.dark && s.status === 'black-translucent' && s.stored.theme === 'dark', JSON.stringify(s));
  await page.emulateMedia({ colorScheme: 'light' });
  await sleep(150);
  check('a picked theme stays when the system changes', (await state()).theme === 'dark');
  await tap('#closeSettings');
  await type('two ');
  await sleep(1100);
  check('after switching: the Mac still types what the phone types ("two ")', macTyped() === 'two ' && (await state()).opens === before.opens);
  // a 整段 draft stays in the box while the language and theme change
  await page.evaluate(() => document.getElementById('input').blur());
  await tap('#modeBtn');
  await type('draft');
  await page.evaluate(() => document.getElementById('input').blur());
  await tap('#settingsBtn');
  await tap('#langSeg [data-lang="en"]');
  await tap('#themeSeg [data-theme-choice="light"]');
  await tap('#closeSettings');
  s = await state();
  check('a Batch draft stays in the box (not sent) while switching; the mode says Batch', s.input === 'draft' && s.mode === 'Batch' && s.lang === 'en' && s.theme === 'light' && macTyped() === '', JSON.stringify(s));
  await tap('#sendBtn');
  await sleep(300);
  check('… and Send sends it', macTyped() === 'draft');
  await tap('#modeBtn');
  // System follows the system, also while the page is open
  await tap('#settingsBtn');
  await tap('#themeSeg [data-theme-choice="system"]');
  await page.emulateMedia({ colorScheme: 'dark' });
  await sleep(150);
  s = await state();
  check('System: follows the system going dark while open', s.theme === 'dark' && s.bar === BAR.dark && s.stored.theme === 'system', JSON.stringify(s));
  await page.emulateMedia({ colorScheme: 'light' });
  await sleep(150);
  check('System: and back to light', (await state()).theme === 'light');
  // remembered after a reload
  await tap('#langSeg [data-lang="zh"]');
  await tap('#themeSeg [data-theme-choice="dark"]');
  await tap('#closeSettings');
  await page.reload();
  await page.waitForFunction(() => document.getElementById('dot').classList.contains('ready'));
  await sleep(200);
  s = await state();
  const frames = await page.evaluate(() => window.__frames);
  check('reload: still Chinese and dark (saved on the phone), from the first frame', s.lang === 'zh-Hant' && s.theme === 'dark' && s.mode === '即時' && frames.every((f) => f.theme === 'dark' && f.bg === BG.dark), JSON.stringify({ s, first: frames[0] }));
  await tap('#settingsBtn');
  await tap('#langSeg [data-lang="auto"]');
  s = await state();
  check('Auto: back to the browser\'s language (English here)', s.lang === 'en' && s.title === 'Settings' && s.stored.lang === 'auto', JSON.stringify(s));
  check(`the whole run on one connection per page load; no page error (switch took ${Date.now() - t0} ms of test time)`, !p.errors.length, p.errors.join(' | '));
  await p.ctx.close();
}

// ---------- 3. every state, both languages × both themes: no Chinese in English, contrast, screenshots ----------
const contrast = {};
const cjkFound = {};
const shots = [];
async function visit(lang, theme) {
  const tag = `${lang}-${theme}`;
  const p = await phone({ locale: lang === 'en' ? 'en-US' : 'zh-TW', scheme: theme });
  const { page, tap, touch, center, rotate } = p;
  const measured = [];
  const scan = async (stateName) => {
    const c = await page.evaluate(() => window.__contrast());
    measured.push(...c.map((x) => ({ ...x, state: stateName })));
    if (lang === 'en') {
      const bad = await page.evaluate(() => window.__cjk());
      if (bad.length) cjkFound[`${tag} ${stateName}`] = bad;
    }
  };
  const shot = async (name) => {
    const file = join(shotsDir, `${tag}-${name}.png`);
    await page.screenshot({ path: file });
    shots.push(`design/screenshots/sofa10/${tag}-${name}.png`);
  };
  // first the clean screens for the screenshots: portrait, ⚙︎, landscape
  await scan('main');
  await shot('portrait');
  await tap('#settingsBtn');
  await scan('settings');
  await shot('settings');
  await page.click('#inputLogBox summary');
  await scan('settings, input log');
  await tap('#closeSettings');
  await rotate(true);
  await scan('landscape');
  await shot('landscape');
  await tap('#sideClose');
  await scan('landscape, panel closed');
  await tap('#fabShortcuts');
  await scan('landscape, shortcut panel');
  await tap('#closeShortcuts');
  await tap('#fabSide');
  await rotate(false);
  // pressed and active keys
  await tap('#btnLock');
  await scan('drag lock on');
  await tap('#btnLock');
  await tap('#keyStrip [data-mod="cmd"]');
  await scan('⌘ armed');
  await tap('#keyStrip [data-mod="cmd"]');
  await tap('#caretSelect');
  await scan('⇧ Select on');
  await tap('#caretSelect');
  // the cursor pad held: active
  const c = await center('#caretPad');
  await touch('touchStart', [c]);
  await sleep(450);
  await scan('cursor pad held');
  await shot('caret');
  await touch('touchEnd', []);
  await sleep(150);
  // 整段 with a draft, then the banner's question (warning colours), and a red one
  await tap('#modeBtn');
  await page.fill('#input', 'x');
  await scan('Batch');
  await tap('#modeBtn');
  await scan('banner (warning)');
  await tap('#modeBtn');
  await page.evaluate(() => document.getElementById('input').blur());
  await sleep(150);
  await page.evaluate(() => window.pkmLink.onEvent({ t: 'status', perm: true, locked: true }));
  await scan('banner (bad)');
  await page.evaluate(() => window.pkmLink.onEvent({ t: 'status', perm: true, locked: false }));
  // shortcut panel, a shortcut (toast), the custom shortcut editor
  await tap('#shortcutsBtn');
  await scan('shortcut panel');
  await tap('#shortcutList [data-group="edit"] button');
  await scan('toast');
  await tap('#editShortcuts');
  await scan('custom shortcuts');
  await page.click('#addShortcut');
  await scan('custom shortcut form');
  await page.click('#scSave');
  await page.click('.io summary');
  await page.click('#exportBtn');
  await scan('custom shortcuts, exported');
  await page.click('#closeEditor');
  await tap('#closeShortcuts');
  // the row editor's three tabs
  await tap('#settingsBtn');
  await page.click('#rowEditBtn');
  await scan('row editor: text row');
  await page.click('#rowTabs [data-row="keys"]');
  await page.evaluate(() => { document.querySelector('#rowSheet .sheet-card').scrollTop = 0; });
  await shot('row-editor');
  await page.click('#rowCatalog button[data-id="k:home"]');
  await scan('row editor: key row');
  await page.click('#rowTabs [data-row="side"]');
  await scan('row editor: landscape panel');
  await page.click('#rowReset');
  await page.click('#rowDone');
  const s = await p.state();
  check(`${tag}: walked every state on one connection, no page error`, s.link === 'ready' && s.opens === 1 && !p.errors.length, JSON.stringify({ opens: s.opens, link: s.link, errors: p.errors }));
  await p.ctx.close();
  // the pairing sheet, with a wrong code's message
  const q = await phone({ locale: lang === 'en' ? 'en-US' : 'zh-TW', scheme: theme, pair: false });
  await q.page.fill('#codeInput', '00000');
  await q.page.click('#pairBtn');
  const pairBad = lang === 'en' ? await q.page.evaluate(() => window.__cjk()) : [];
  if (pairBad.length) cjkFound[`${tag} pairing`] = pairBad;
  measured.push(...(await q.page.evaluate(() => window.__contrast())).map((x) => ({ ...x, state: 'pairing' })));
  await q.page.screenshot({ path: join(shotsDir, `${tag}-pairing.png`) });
  shots.push(`design/screenshots/sofa10/${tag}-pairing.png`);
  await q.ctx.close();
  const fails = measured.filter((m) => m.ratio < m.need);
  const min = measured.reduce((a, m) => (m.ratio < a.ratio ? m : a), { ratio: Infinity });
  contrast[tag] = { texts: measured.length, min, fails };
  check(`${tag}: WCAG AA for every text (${measured.length} measured over 22 states; lowest ${min.ratio}:1 "${min.text}" ${min.el})`, !fails.length, JSON.stringify(fails.slice(0, 6)));
  if (lang === 'en') check(`${tag}: no Chinese on screen in any state (texts, aria-label, title, placeholder, key list)`, !Object.keys(cjkFound).some((k) => k.startsWith(tag)), JSON.stringify(Object.entries(cjkFound).filter(([k]) => k.startsWith(tag)).slice(0, 3)));
}
for (const lang of ['en', 'zh']) for (const theme of ['light', 'dark']) await visit(lang, theme);

// ---------- 4. the recording: switching language and theme on a live connection ----------
let video = null;
if (videoDir) {
  const frames = join(videoDir, 'frames');
  const p = await phone({ locale: 'en-US', scheme: 'light', record: frames, scale: 2 });
  const { page, tap } = p;
  const typeOne = p.type;
  // the dry-run Mac's log, drawn on the page for the recording only: what the Mac types arrives while switching
  let all = '';
  const macLine = async () => {
    const typed = macTyped();
    all += typed;
    if (typed) await page.evaluate((x) => {
      let n = document.getElementById('__mac');
      if (!n) {
        n = document.createElement('div');
        n.id = '__mac';
        n.style.cssText = 'position:fixed;left:12px;right:12px;top:52%;z-index:150;padding:8px 12px;border-radius:10px;background:rgba(20,24,31,.82);color:#e9ecf1;font:13px ui-monospace,Menlo,monospace;pointer-events:none';
        document.body.append(n);
        n.dataset.all = '';
      }
      n.dataset.all += x;
      n.textContent = `Mac (dry run) typed: ${n.dataset.all}`;
    }, typed);
  };
  macTyped();
  await sleep(600);
  const type = async (text) => { for (const ch of text) { await typeOne(ch); await sleep(90); } await sleep(500); await macLine(); await page.evaluate(() => document.getElementById('input').blur()); await sleep(400); };
  await type('Hello ');
  await tap('#settingsBtn');
  await sleep(300);
  await tap('#langSeg [data-lang="zh"]');
  await sleep(500);
  await tap('#themeSeg [data-theme-choice="dark"]');
  await sleep(700);
  await tap('#closeSettings');
  await type('沙發 ');
  await tap('#settingsBtn');
  await sleep(300);
  await tap('#langSeg [data-lang="en"]');
  await sleep(500);
  await tap('#themeSeg [data-theme-choice="light"]');
  await sleep(500);
  await tap('#themeSeg [data-theme-choice="system"]');
  await sleep(700);
  await tap('#closeSettings');
  await type('again');
  await sleep(800);
  const s = await p.state();
  const list = await p.cast.stop();
  check('recording: one connection the whole time, the Mac typed "Hello 沙發 again"', s.opens === 1 && s.link === 'ready' && all === 'Hello 沙發 again', JSON.stringify({ all, opens: s.opens, link: s.link }));
  const ft = JSON.parse(readFileSync(join(frames, 'frames.json'), 'utf8')).t;
  const gaps = ft.slice(1).map((x, i) => x - ft[i]);
  const out = join(videoDir, 'sofa10-language-theme.mp4');
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-vf', 'fps=60,scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p', '-r', '60', '-c:v', 'libx264', '-crf', '20', '-movflags', '+faststart', out]);
  const probe = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,r_frame_rate,avg_frame_rate,nb_frames,duration', '-of', 'json', out]).toString()).streams[0];
  const [n, d] = probe.avg_frame_rate.split('/').map(Number);
  video = { file: out, ...probe, fps: n / d, chromeFrames: ft.length, chromeFramesUnder20ms: gaps.filter((g) => g < 0.02).length };
  check(`recording: ${probe.width}×${probe.height}, ${(n / d).toFixed(1)} fps, ${Number(probe.duration).toFixed(1)} s`, n / d >= 50, JSON.stringify(probe));
  await p.ctx.close();
}

await browser.close();
await server.stop();
const passed = results.filter((r) => r.ok).length;
writeFileSync(join(evDir, 'i18n-theme.json'), JSON.stringify({ results, contrast, cjkFound, screenshots: shots, video: video && { ...video, file: undefined } }, null, 1));
console.log(`\n${passed}/${results.length} ${passed === results.length ? 'PASS' : 'FAIL'}`);
process.exit(passed === results.length ? 0 : 1);
