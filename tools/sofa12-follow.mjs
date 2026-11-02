// SOFA-12 (4.5): the phone page follows the Mac app, and the versioned protocol. Headless Chrome (iPhone size, real
// touches) against a dry-run Mac that is restarted on the same address as another version: a debug build of the Mac
// app takes PKM_TEST_VERSION / PKM_TEST_PROTOCOL (release builds have no such switch) and serves a copy of web/ whose
// version.js says what the test needs.
//   - same version: no reload; ⚙︎ shows the same version for the page and the Mac
//   - the Mac is updated while the page is open: the page reloads once, by itself, and then matches; nothing came from
//     a cache (every file is no-store); a Batch draft stays in the box; no second reload
//   - a Mac whose page stays old after reloading (a cache): two reloads, then it stops and says so, and still works
//   - protocol: a newer Mac that no longer accepts this page, and an older one: a clear message (English and Chinese),
//     no login attempt, and the page picks up by itself once the Mac speaks its version again
//   - the Mac turns away a client that speaks an unknown version (auth_fail "protocol", close 4426), and still
//     accepts version 1: the real 4.4.0 page (git tag v4.4.0) pairs with this Mac
//   - screenshots: design/screenshots/sofa12/
import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startServer, ROOT, IPHONE_UA, INSETS } from './test-server.mjs';

const shotsDir = join(ROOT, 'design/screenshots/sofa12');
const evDir = join(ROOT, 'design/evidence/sofa12');
mkdirSync(shotsDir, { recursive: true });
mkdirSync(evDir, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok: !!ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok ? '' : '  → ' + detail}`);
};
const until = async (fn, ms = 10000, step = 100) => {
  const end = Date.now() + ms;
  for (;;) {
    const v = await fn().catch(() => null);
    if (v) return v;
    if (Date.now() > end) return null;
    await sleep(step);
  }
};

/** A copy of web/ that says it is `version` (what a Mac app of that version serves). */
function webAs(version) {
  const dir = mkdtempSync(join(tmpdir(), `sofa12-web-${version}-`));
  cpSync(join(ROOT, 'web'), dir, { recursive: true });
  const f = join(dir, 'js/version.js');
  writeFileSync(f, readFileSync(f, 'utf8').replace(/export const VERSION = '[^']*';/, `export const VERSION = '${version}';`));
  return dir;
}
const ver = JSON.parse(execFileSync('node', ['-e', `import('${join(ROOT, 'web/js/version.js')}').then(m => console.log(JSON.stringify(m.VERSION)))`]).toString());
// the versions the Mac is "updated" to: the next two after this source's own (so the test holds whatever VERSION says)
const bump = (v) => v.replace(/\d+$/, (n) => String(Number(n) + 1));
const NEXT = bump(ver);
const NEXT2 = bump(NEXT);
const esc = (v) => v.replaceAll('.', '\\.');

/** In the page: WebSocket connections and what was sent on them (message types only). */
const instrument = () => {
  window.__wsOpens = 0;
  window.__sent = [];
  const WS = window.WebSocket;
  window.WebSocket = class extends WS {
    constructor(...a) { super(...a); window.__wsOpens++; }
    send(d) { try { window.__sent.push(JSON.parse(d).t); } catch { /* not ours */ } return super.send(d); }
  };
};

const state = { port: 30000 + Math.floor(Math.random() * 10000), dir: mkdtempSync(join(tmpdir(), 'sofa12-state-')) };
let server = null;
async function mac({ version = null, protocol = null, web = null } = {}) {
  if (server) await server.stop();
  const env = {};
  if (version) env.PKM_TEST_VERSION = version;
  if (protocol != null) env.PKM_TEST_PROTOCOL = String(protocol);
  server = await startServer({ port: state.port, state: state.dir, env, webRoot: web || join(ROOT, 'web') });
  return server;
}

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
  userAgent: IPHONE_UA, locale: 'en-US', colorScheme: 'light' });
await ctx.addInitScript(instrument);
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const navs = [];   // documents loaded (not the address being tidied with history.replaceState)
page.on('request', (r) => { if (r.isNavigationRequest() && r.frame() === page.mainFrame()) navs.push(r.url()); });
const cdp = await ctx.newCDPSession(page);
await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: INSETS.portrait });
await cdp.send('Network.enable');
const responses = [];
cdp.on('Network.responseReceived', (e) => responses.push({ url: e.response.url, disk: !!e.response.fromDiskCache,
  sw: !!e.response.fromServiceWorker, cache: e.response.headers['Cache-Control'] || e.response.headers['cache-control'] || '' }));
let servedFromCache = 0;
cdp.on('Network.requestServedFromCache', () => { servedFromCache++; });

const touch = (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points.map((p, i) => ({ x: p.x, y: p.y, id: i, radiusX: 4, radiusY: 4, force: 1 })) });
const tap = async (sel) => {
  const c = await page.evaluate((s) => {
    const e = document.querySelector(s);
    if (!e || e.closest('[hidden]') || !e.getClientRects().length) return null;
    e.scrollIntoView({ block: 'nearest' });
    const r = e.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }, sel);
  if (!c) throw new Error('not visible: ' + sel);
  await touch('touchStart', [c]);
  await sleep(40);
  await touch('touchEnd', []);
  await sleep(150);
};
const look = () => page.evaluate(() => ({
  link: window.pkmLink.state, host: document.getElementById('host').textContent,
  banner: document.getElementById('banner').hidden ? '' : document.getElementById('banner').textContent,
  bad: document.getElementById('banner').classList.contains('bad'),
  version: document.getElementById('versionLine').textContent, search: location.search,
  input: document.getElementById('input').value, mode: document.getElementById('modeBtn').textContent,
  opens: window.__wsOpens, sent: window.__sent,
}));
const shot = async (name) => page.screenshot({ path: join(shotsDir, name + '.png') });
const settings = async (open) => {
  const hidden = await page.evaluate(() => document.getElementById('settingsSheet').hidden);
  if (open === hidden) await tap(open ? '#settingsBtn' : '#closeSettings');
  if (open) await page.evaluate(() => { document.querySelector('#settingsSheet .sheet-body, #settingsSheet').scrollTop = 0; });
  await sleep(200);
};
const lang = async (l) => { await settings(true); await tap(`[data-lang="${l}"]`); await settings(false); };

// ---- 1. same version
await mac();
await page.goto(server.url + '#pair=' + server.code);
await until(() => page.evaluate(() => window.pkmLink.state === 'ready'));
await sleep(500);
let s = await look();
check('same version: connected, no reload', s.link === 'ready' && navs.length === 1, JSON.stringify({ navs, link: s.link }));
check(`same version: ⚙︎ shows the page and the Mac at ${ver}`,
  s.version === `Web page ${ver} (development) · Mac app ${ver} (development)`, s.version);
check('every page file comes with Cache-Control: no-store', responses.length > 5 && responses.every((r) => r.cache === 'no-store'),
  JSON.stringify(responses.filter((r) => r.cache !== 'no-store').slice(0, 3)));
await settings(true);
await shot('en-1-same-version-settings');
await settings(false);

// a Batch draft in the box when the Mac is updated
await tap('#modeBtn');
await page.evaluate((text) => {   // typed the way the iOS keyboard does it (insertText input events)
  const el = document.getElementById('input');
  el.focus();
  for (const ch of text) {
    el.setRangeText(ch, el.selectionStart, el.selectionEnd, 'end');
    el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: ch }));
  }
}, 'draft kept');
s = await look();
check('Batch mode with a draft in the box', s.mode === 'Batch' && s.input === 'draft kept', JSON.stringify(s));

// ---- 2. the Mac app is updated to the next version while the page is open
const before = responses.length;
const servedBefore = servedFromCache;
const webNext = webAs(NEXT);
await mac({ version: NEXT, web: webNext });
const followed = await until(async () => (navs.length >= 2 && (await look()).link === 'ready' ? look() : null), 15000);
await sleep(3000);   // a loop would show here
s = await look();
check('Mac updated: the page reloaded by itself, once', navs.length === 2, JSON.stringify(navs));
check('the reload went to the address with the mark, and the mark came off', new RegExp(`[?&]follow=1~${esc(NEXT)}\\+dev$`).test(decodeURIComponent(navs[1] || '')) && s.search === '',
  JSON.stringify({ navs, search: s.search }));
check('after the reload: connected again (same pairing), no pairing sheet', followed && s.link === 'ready', JSON.stringify(s));
check(`the version shown on the phone matches the Mac: ${NEXT} and ${NEXT}`,
  s.version === `Web page ${NEXT} (development) · Mac app ${NEXT} (development)`, s.version);
check('a note says the page followed the Mac', new RegExp(`SofaPad on the Mac was updated: this page reloaded itself and is now ${esc(NEXT)}`).test(s.banner), s.banner);
const after = responses.slice(before);
check('nothing after the reload came from a cache (disk, memory or service worker)',
  after.length > 5 && after.every((r) => !r.disk && !r.sw) && servedFromCache === servedBefore,
  JSON.stringify({ n: after.length, cached: after.filter((r) => r.disk || r.sw).map((r) => r.url), servedFromCache }));
check(`the new page files are the ${NEXT} ones`, await page.evaluate(() => import('./js/version.js').then((m) => m.VERSION)) === NEXT);
check('the Batch draft is still in the box', s.input === 'draft kept' && s.mode === 'Batch', JSON.stringify({ input: s.input, mode: s.mode }));
await shot('en-2-followed-note');
await page.evaluate(() => window.pkmLink.dropDead('test'));   // a dropped connection after following
await until(async () => (await look()).link === 'ready', 8000);
await sleep(600);
s = await look();
check('a reconnect afterwards does not say "updated" again, and does not reload', !/was updated/.test(s.banner) && navs.length === 2, JSON.stringify({ banner: s.banner, navs: navs.length }));
await settings(true);
await shot('en-3-followed-settings');
await settings(false);

// ---- 3. a Mac whose page stays old after reloading (what a cache would do): two reloads, then stop
const navsBefore = navs.length;
await mac({ version: NEXT2, web: webNext });
const stuck = await until(async () => ((await look()).banner.includes('reloading didn’t bring') ? look() : null), 20000);
await sleep(6000);
s = await look();
check('a page that stays old: exactly two reloads, then it stops', navs.length - navsBefore === 2, JSON.stringify(navs.slice(navsBefore)));
check('it says so, plainly, and stays connected (it still works)', stuck && s.bad && s.link === 'ready'
  && s.banner === `This page is ${NEXT}, SofaPad on the Mac is ${NEXT2}, and reloading didn’t bring the new page. Close this page and open it again (on the Home Screen: close the app and reopen it).`, JSON.stringify(s));
await shot('en-4-stuck');
await lang('zh');
s = await look();
check('the same in Chinese', s.banner === `這個頁面是 ${NEXT}，Mac 上的 SofaPad 是 ${NEXT2}，重新載入也沒有拿到新頁面。請把這頁關掉再重新打開（主畫面 App 要關掉重開）。`, s.banner);
await shot('zh-4-stuck');
await lang('en');

// ---- 4. protocol: a newer Mac that no longer accepts this page (protocol 4, accepts 3–4)
let sentBefore = (await look()).sent.length;
await mac({ version: NEXT, web: webNext, protocol: 4 });
const inc = await until(async () => ((await look()).link === 'incompatible' ? look() : null), 10000);
await sleep(6000);   // it looks again every 5 s, without trying to log in
s = await look();
const sentSince = s.sent.slice(sentBefore);
check('a Mac that no longer accepts this page: "incompatible", no login attempt', inc && s.link === 'incompatible'
  && !sentSince.includes('auth') && !sentSince.includes('pair_request'), JSON.stringify({ link: s.link, sentSince }));
check('it keeps looking, slowly (every 5 s)', s.opens - inc.opens >= 1 && s.opens - inc.opens <= 3, `${inc?.opens} → ${s.opens}`);
check('no login reached the Mac', !/authenticated/.test(server.log()), server.log().slice(-300));
check('the message says what to do (English)', s.bad && s.banner === 'This page is older than SofaPad on the Mac and can’t connect (this page speaks protocol 2, the Mac 4). Close this page and open it again (on the Home Screen: close the app and reopen it).', s.banner);
check('the status line says so too', s.host === '127.0.0.1 (versions don’t fit)' || /versions don’t fit/.test(s.host), s.host);
await shot('en-5-protocol-page-old');
await lang('zh');
s = await look();
check('the message in Chinese', s.banner === '這個頁面比 Mac 上的 SofaPad 舊，沒辦法連線（這頁的協定是 2，Mac 是 4）。請把這頁關掉再重新打開（主畫面 App 要關掉重開）。', s.banner);
await shot('zh-5-protocol-page-old');
await lang('en');

// the Mac is updated to one that speaks 2 again: the page picks up by itself
await mac({ version: NEXT, web: webNext });
const back = await until(async () => ((await look()).link === 'ready' ? look() : null), 12000);
check('the Mac speaks 2 again: the page connects by itself, the message goes', back && !back.bad, JSON.stringify(back));

// an older Mac (protocol 0)
sentBefore = (await look()).sent.length;
await mac({ version: NEXT, web: webNext, protocol: 0 });
await until(async () => ((await look()).link === 'incompatible' ? look() : null), 10000);
s = await look();
check('an older Mac: "update SofaPad on the Mac" (English)', s.banner === 'SofaPad on the Mac is too old for this page and can’t connect (the Mac speaks protocol 0, this page 2). Update SofaPad on the Mac (its menu-bar menu ⌨︎🖱 has the update item), then open this page again.'
  && !s.sent.slice(sentBefore).includes('auth'), s.banner);
await shot('en-6-protocol-mac-old');
await lang('zh');
s = await look();
check('an older Mac (Chinese)', s.banner === 'Mac 上的 SofaPad 太舊，這個頁面沒辦法和它連線（Mac 的協定是 0，這頁是 2）。請從 Mac 選單列 ⌨︎🖱 的「檢查更新…」更新 SofaPad，再重新打開這頁。', s.banner);
await shot('zh-6-protocol-mac-old');
await lang('en');

// ---- 5. the Mac's side: an unknown version is turned away; version 1 (the 4.4.0 page) still pairs
await mac({ version: NEXT, web: webNext });
await until(async () => ((await look()).link === 'ready' ? look() : null), 12000);
const raw = await page.evaluate(() => new Promise((resolve) => {
  const ws = new WebSocket(`ws://${location.host}/ws`);
  const got = [];
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    got.push(m);
    if (m.t === 'hello') ws.send(JSON.stringify({ t: 'auth', code: '000000', device: 'future', sid: 'x', v: 9 }));
  };
  ws.onclose = (e) => resolve({ got, code: e.code });
  setTimeout(() => resolve({ got, code: 'timeout' }), 4000);
}));
const hello = raw.got.find((m) => m.t === 'hello') || {};
const fail = raw.got.find((m) => m.t === 'auth_fail') || {};
check('hello carries the protocol version: v 2, vmin 1, next to the app version', hello.v === 2 && hello.vmin === 1 && hello.ver === NEXT, JSON.stringify(hello));
check('a client speaking version 9: auth_fail "protocol" (v 2, vmin 1), then close 4426',
  fail.reason === 'protocol' && fail.v === 2 && fail.vmin === 1 && raw.code === 4426, JSON.stringify(raw));
check('the Mac logs it', /protocol version 9 from .* not accepted \(this Mac: 1–2\)/.test(server.log()), server.log().slice(-400));

const old = mkdtempSync(join(tmpdir(), 'sofa12-web-4.4.0-'));
execFileSync('/bin/sh', ['-c', `git -C "${ROOT}" archive v4.4.0 web | tar -x -C "${old}"`]);
await mac({ web: join(old, 'web') });
const ctx44 = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
  userAgent: IPHONE_UA, locale: 'en-US', colorScheme: 'light' });
const p44 = await ctx44.newPage();
await p44.goto(server.url + '#pair=' + server.code);
const paired44 = await until(() => p44.evaluate(() => window.pkmLink && window.pkmLink.state === 'ready'), 10000);
const v44 = await p44.evaluate(() => import('./js/version.js').then((m) => m.VERSION));
check('the real 4.4.0 page (protocol 1, no v) pairs with this Mac', paired44 && v44 === '4.4.0' && /authenticated .* \(new pairing\)/.test(server.log()),
  JSON.stringify({ paired44, v44 }));
await ctx44.close();

check('no page errors', errors.length === 0, errors.join(' | '));
await browser.close();
await server.stop();
const passed = results.filter((r) => r.ok).length;
writeFileSync(join(evDir, 'follow.json'), JSON.stringify({ when: new Date().toISOString(), passed, total: results.length, results }, null, 2));
console.log(`\n${passed}/${results.length} PASS`);
process.exit(passed === results.length ? 0 : 1);
