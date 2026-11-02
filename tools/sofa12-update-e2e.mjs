// SOFA-12 end-to-end update test, on this Mac, with test signing (nothing leaves 127.0.0.1):
//   - builds SofaPad 4.5.0 and a fake 4.5.1: debug builds with their own bundle id (…sofapad.update-test, so the
//     real SofaPad, its settings and its permissions are not touched), ad-hoc signed, with a throwaway EdDSA key made
//     for this run (the real key in the Keychain signs real releases only)
//   - packages 4.5.1 the way a release is packaged (tools/package.sh), signs the zip and the feed (Sparkle's
//     sign_update, tools/appcast.mjs), serves both on 127.0.0.1; the debug build reads that feed from its defaults
//   - installs 4.5.0 in dist/update-test/Applications and opens it. At launch Sparkle finds 4.5.1 and shows its
//     release notes; the test presses Install Update, then Install and Relaunch (through Accessibility, as a person
//     clicks). 4.5.0 quits, 4.5.1 is put in its place and opens again.
//   - the phone page (headless Chrome, paired with the 4.5.0 app) sees the new Mac version and reloads itself to 4.5.1
//   - a phone connected while an update is found: no window takes the keys, the update waits in the menu
//   - a tampered zip (one file of the 4.5.1 archive changed, the signed feed untouched) is rejected, 4.5.0 stays;
//     a feed changed after it was signed is refused
//   node tools/sofa12-update-e2e.mjs [--video | --video-only]
//     --video: a screen recording of the update window and the relaunch, next to the phone, in dist/sofa12/
//     --video-only: the first part alone (the update and the phone following), recorded; its results go to
//       update-e2e-video.json and its pictures to dist/sofa12/shots, so a full run's evidence stays as it is
//   node tools/sofa12-update-e2e.mjs --new-identity "Developer ID Application: … (TEAMID)"
//     the fake 4.5.1 is signed with that identity (hardened runtime, secure timestamp) instead of ad-hoc, and only the
//     first part runs: an ad-hoc 4.5.0, like the one released, updates itself to a Developer ID 4.5.1 (SOFA-451).
//     Its results go to design/evidence/sofa451/update-e2e-devid.json, its pictures to dist/sofa451/shots
//   Every command and wait has a time limit, and the whole run stops after 12 minutes (exit 3, with what it had).
import { chromium } from 'playwright-core';
import { execFileSync, spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { generateKeyPairSync } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync, statSync, copyFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { ROOT, IPHONE_UA, INSETS } from './test-server.mjs';
import { startScreencast } from './screencast.mjs';

const VIDEO_ONLY = process.argv.includes('--video-only');
const VIDEO = VIDEO_ONLY || process.argv.includes('--video');
const NEW_IDENTITY = process.argv.includes('--new-identity') ? process.argv[process.argv.indexOf('--new-identity') + 1] || '' : '';
const PART1_ONLY = VIDEO_ONLY || !!NEW_IDENTITY;
const E2E = join(ROOT, 'dist/update-test');
const FEED = join(E2E, 'feed');
const INSTALLED = join(E2E, 'Applications/SofaPad.app');
const STATE = join(E2E, 'state');
const BUNDLE = 'io.github.rick-ray-wldd.sofapad.update-test';
const LOG = join(homedir(), 'Library/Logs', BUNDLE + '.log');
const SPARKLE = join(ROOT, 'mac/.build/artifacts/sparkle/Sparkle/bin');
const AX = join(E2E, 'ax');
const shotsDir = join(ROOT, NEW_IDENTITY ? 'dist/sofa451/shots' : VIDEO_ONLY ? 'dist/sofa12/shots' : 'design/screenshots/sofa12');
const evDir = join(ROOT, NEW_IDENTITY ? 'design/evidence/sofa451' : 'design/evidence/sofa12');
const evFile = join(evDir, NEW_IDENTITY ? 'update-e2e-devid.json' : VIDEO_ONLY ? 'update-e2e-video.json' : 'update-e2e.json');
const videoDir = join(ROOT, 'dist/sofa12');
const FEED_PORT = 41000 + Math.floor(Math.random() * 1000);
const APP_PORT = 42000 + Math.floor(Math.random() * 1000);
const OLD = '4.5.0';
const NEW = '4.5.1';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok: !!ok, detail: ok ? '' : String(detail).slice(0, 600) });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok ? '' : '  → ' + String(detail).slice(0, 600)}`);
};
const until = async (fn, ms = 15000, step = 200) => {
  const end = Date.now() + ms;
  for (;;) {
    const v = await Promise.resolve().then(fn).catch(() => null);
    if (v) return v;
    if (Date.now() > end) return null;
    await sleep(step);
  }
};
// a command that runs past its limit is killed and throws, so none can hold the run
const sh = (cmd, args, opts = {}) => execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 120000, ...opts });
const t0 = Date.now();
const evidence = { feedPort: FEED_PORT, appPort: APP_PORT, steps: [] };
const step = (what, extra = {}) => { const e = { t: ((Date.now() - t0) / 1000).toFixed(1), what, ...extra }; evidence.steps.push(e); console.log(`  [${e.t}s] ${what}`); };

// ---------- clean start: only the test app's own things ----------
const reEscape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const appPid = () => {
  try { return Number(sh('pgrep', ['-f', '^' + reEscape(join(INSTALLED, 'Contents/MacOS/SofaPad'))]).trim().split('\n')[0]) || null; } catch { return null; }
};
async function quitApp() {
  const pid = appPid();
  if (!pid) return;
  try { process.kill(pid, 'SIGTERM'); } catch { /* gone */ }
  await until(() => !appPid(), 8000);
  const left = appPid();
  if (left) process.kill(left, 'SIGKILL');
}
function forgetTestApp() {
  try { sh('defaults', ['delete', BUNDLE]); } catch { /* none yet */ }
  for (const d of [join(homedir(), 'Library/Caches', BUNDLE), join(homedir(), 'Library/HTTPStorages', BUNDLE),
    join(homedir(), 'Library/HTTPStorages', BUNDLE + '.binarycookies')]) rmSync(d, { recursive: true, force: true });
}
await quitApp();
forgetTestApp();
for (const d of ['build-4.5.0', 'build-4.5.1', 'feed', 'Applications', 'state', 'logs', 'tampered']) rmSync(join(E2E, d), { recursive: true, force: true });
for (const d of [FEED, STATE, join(E2E, 'logs'), shotsDir, evDir]) mkdirSync(d, { recursive: true });
if (VIDEO) mkdirSync(videoDir, { recursive: true });
rmSync(LOG, { force: true });
sh('swiftc', ['-O', join(ROOT, 'tools/sofa12-ax.swift'), '-o', AX], { env: { ...process.env, DEVELOPER_DIR: process.env.DEVELOPER_DIR || '/Applications/Xcode.app/Contents/Developer' } });
// On the lock screen macOS shows no app windows, and Accessibility sees nothing: the test needs the Mac unlocked.
if (sh(AX, ['locked']).trim() === '1') {
  console.error('The Mac shows its lock screen: unlock it and run this again (the update windows must be on screen).');
  process.exit(2);
}

// ---------- a throwaway EdDSA key, the two builds, the 4.5.1 package and its feed ----------
const { publicKey, privateKey } = generateKeyPairSync('ed25519');
const PUB = Buffer.from(publicKey.export({ format: 'jwk' }).x, 'base64url').toString('base64');
const KEY = join(E2E, 'test-ed-key.txt');   // the seed, base64: sign_update's --ed-key-file format
writeFileSync(KEY, Buffer.from(privateKey.export({ format: 'jwk' }).d, 'base64url').toString('base64'), { mode: 0o600 });
const sign = (args) => sh(join(SPARKLE, 'sign_update'), ['--ed-key-file', '-', ...args], { input: readFileSync(KEY), stdio: ['pipe', 'pipe', 'pipe'] }).trim();

function build(version, identity = '') {
  const app = join(E2E, `build-${version}`, 'SofaPad.app');
  const out = sh(join(ROOT, 'tools/build-app.sh'), identity ? ['--identity', identity] : [], { env: { ...process.env, SOFAPAD_CONFIG: 'debug', SOFAPAD_APP: app,
    SOFAPAD_BUNDLE_ID: BUNDLE, SOFAPAD_VERSION: version, SOFAPAD_ED_KEY: PUB }, timeout: 600000 });
  writeFileSync(join(E2E, 'logs', `build-${version}.txt`), out);
  return app;
}
const plist = (app, key) => sh('/usr/libexec/PlistBuddy', ['-c', `Print :${key}`, join(app, 'Contents/Info.plist')]).trim();
const app450 = build(OLD);
await sleep(1100);   // the build number is to the second
const app451 = build(NEW, NEW_IDENTITY);
step(`built ${OLD} (${plist(app450, 'CFBundleVersion')}) and ${NEW} (${plist(app451, 'CFBundleVersion')})`);
check('the two test builds carry the test key and their versions', plist(app450, 'SUPublicEDKey') === PUB && plist(app451, 'CFBundleShortVersionString') === NEW
  && Number(plist(app451, 'CFBundleVersion')) > Number(plist(app450, 'CFBundleVersion')));

const notes = join(E2E, `notes-${NEW}.md`);
writeFileSync(notes, `# SofaPad ${NEW} (test build)

## What's new

- **A test build for the update test**, nothing new in it. It shows that SofaPad ${OLD} finds this version, shows these
  notes, downloads it, checks its EdDSA signature, puts it in its own place and opens again as ${NEW}.
- The phone page sees the new version and reloads itself.

---

# SofaPad ${NEW}（測試版）

## 這一版

- **給更新測試用的測試版**，沒有新功能：證明 SofaPad ${OLD} 會找到這一版、顯示這段說明、下載、檢查 EdDSA 簽章、換掉自己，再以 ${NEW} 打開。
- 手機網頁看到新版本，會自己重新載入。
`);
sh(join(ROOT, 'tools/package.sh'), ['--app', app451, '--version', NEW, '--out', FEED, '--notes', notes]);
const ZIP = join(FEED, `SofaPad-${NEW}-macOS.zip`);
const genuineZip = readFileSync(ZIP);
const zipSig = sign(['-p', ZIP]);
const feedURL = `http://127.0.0.1:${FEED_PORT}/appcast.xml`;
sh('node', [join(ROOT, 'tools/appcast.mjs'), 'write', '--version', NEW, '--build', plist(app451, 'CFBundleVersion'),
  '--url', `http://127.0.0.1:${FEED_PORT}/SofaPad-${NEW}-macOS.zip`, '--zip', ZIP, '--signature', zipSig, '--notes', notes,
  '--out', join(FEED, 'appcast.xml'), '--blob', 'https://github.com/rick-ray-wldd/sofapad/blob/main']);
sign([join(FEED, 'appcast.xml')]);
const genuineFeed = readFileSync(join(FEED, 'appcast.xml'));
const verified = sh('node', [join(ROOT, 'tools/appcast.mjs'), 'verify', '--feed', join(FEED, 'appcast.xml'), '--zip', ZIP, '--key', PUB]);
check('the 4.5.1 zip and its feed are signed with the test key (checked with the public key alone)', /✓/.test(verified), verified);
step(`packaged ${NEW}: ${statSync(ZIP).size} bytes, feed signed`);

// ---------- the feed on 127.0.0.1 ----------
const requests = [];
const feedServer = createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const f = join(FEED, path);
  requests.push({ t: ((Date.now() - t0) / 1000).toFixed(1), path, ua: (req.headers['user-agent'] || '').split(' ')[0] });
  if (!f.startsWith(FEED + '/') || !existsSync(f)) { res.writeHead(404); res.end(); return; }
  const body = readFileSync(f);
  res.writeHead(200, { 'Content-Type': f.endsWith('.xml') ? 'application/xml' : 'application/zip', 'Content-Length': body.length });
  res.end(body);
});
await new Promise((r) => feedServer.listen(FEED_PORT, '127.0.0.1', r));

// ---------- the test app ----------
let logMark = 0;
const log = () => (existsSync(LOG) ? readFileSync(LOG, 'utf8') : '');
const freshLog = () => log().slice(logMark);
function install(app) {
  rmSync(INSTALLED, { recursive: true, force: true });
  mkdirSync(dirname(INSTALLED), { recursive: true });
  sh('ditto', [app, INSTALLED]);
}
function testDefaults(extra = []) {
  forgetTestApp();
  sh('defaults', ['write', BUNDLE, 'SofaPadTestFeedURL', feedURL]);
  sh('defaults', ['write', BUNDLE, 'SofaPadTestArguments', '-array', '--dry-run', '--bind', '127.0.0.1', '--port', String(APP_PORT), '--state-dir', STATE]);
  for (const [k, type, v] of extra) sh('defaults', ['write', BUNDLE, k, type, v]);
}
async function launch() {
  logMark = log().length;
  sh('open', ['-n', INSTALLED]);
  const pid = await until(appPid, 15000);
  await until(() => /配對碼：\d{6}/.test(freshLog()), 15000);
  return pid;
}
const ax = (...a) => sh(AX, a.map(String));
const tree = (pid) => JSON.parse(ax('tree', pid));
const windowWith = (t, button) => t.windows.find((w) => w.items.some((i) => i.role === 'AXButton' && i.title === button));
const texts = (w) => w.items.filter((i) => i.value || (i.role === 'AXStaticText' && (i.title || i.value))).map((i) => i.value || i.title);
/** A picture of one of the app's windows alone (nothing behind it), by its frame. */
function windowShot(pid, w, name) {
  const t = tree(pid);
  const id = t.ids.find((i) => Math.abs(i.x - w.frame.x) < 2 && Math.abs(i.y - w.frame.y) < 2 && Math.abs(i.w - w.frame.w) < 2)?.id;
  if (!id) return null;
  const path = join(shotsDir, name + '.png');
  sh('screencapture', ['-x', '-o', '-l', String(id), path]);
  return path;
}

// ---------- the phone (headless Chrome, iPhone size) ----------
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
  userAgent: IPHONE_UA, locale: 'en-US', colorScheme: 'light' });
const page = await ctx.newPage();
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(e.message));
const navs = [];
page.on('request', (r) => { if (r.isNavigationRequest() && r.frame() === page.mainFrame()) navs.push({ t: ((Date.now() - t0) / 1000).toFixed(1), url: r.url() }); });
const cdp = await ctx.newCDPSession(page);
await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: INSETS.portrait });
const phone = () => page.evaluate(() => ({ link: window.pkmLink?.state, version: document.getElementById('versionLine')?.textContent,
  banner: document.getElementById('banner').hidden ? '' : document.getElementById('banner').textContent })).catch(() => ({}));
const settingsOpen = async (open) => {
  await page.evaluate((o) => { document.getElementById('settingsSheet').hidden = !o; }, open);
  await sleep(200);
};

// ---------- the recording (--video) ----------
let stage = null;
let recorder = null;
let recorderExit = null;
let cast = null;
let castStarted = 0;
let castList = null;
const STAGE = { x: 940, y: 150, w: 980, h: 780 };   // where the update window shows on this display (2560×1080)
// The Mac's screen is recorded by ffmpeg's own screen capture, stopped with q, which it answers by finishing the file.
// (screencapture -v leaves no file when a signal stops it, and its -V time did not always end it: I-57.)
const MAC_FPS = 30;
const macRaw = join(videoDir, 'mac-raw.mp4');
const caption = (line) => { if (VIDEO) writeFileSync(join(videoDir, 'caption.txt'), line); };
async function startRecording() {
  caption(`SofaPad update test · ${OLD} → ${NEW} · feed on 127.0.0.1, test signing`);
  stage = spawn(AX, ['stage', STAGE.x, STAGE.y, STAGE.w, STAGE.h, join(videoDir, 'caption.txt'), BUNDLE].map(String), { stdio: 'ignore' });
  await sleep(1200);
  rmSync(macRaw, { force: true });
  recorder = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-nostats', '-progress', 'pipe:1', '-f', 'avfoundation', '-capture_cursor', '1',
    '-framerate', String(MAC_FPS), '-pixel_format', 'uyvy422', '-i', 'Capture screen 0',
    '-vf', `crop=${STAGE.w}:${STAGE.h}:${STAGE.x}:${STAGE.y},format=yuv420p`, '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '18', macRaw],
  { stdio: ['pipe', 'pipe', 'pipe'] });
  let errors = '';
  recorder.stderr.on('data', (d) => { errors += d; });
  recorderExit = new Promise((r) => recorder.once('exit', (code, signal) => r({ code, signal, errors: errors.trim().slice(-400) })));
  // wait for the first frames (ffmpeg reports how many it has encoded, every half second) before anything happens
  recorder.stdout.on('data', (d) => {
    const n = Number(/frame=(\d+)/.exec(String(d))?.[1] || 0);
    if (n > 0 && !evidence.recordingStarted) evidence.recordingStarted = Date.now() - (n * 1000) / MAC_FPS;
  });
  await until(() => evidence.recordingStarted, 10000);
  evidence.recordingStarted ??= Date.now();
  await sleep(1000);
}
/** Ends the recording (the phone's ends at the same moment) and waits for ffmpeg to finish the file. Once only. */
async function stopRecording() {
  if (!recorder) return;
  const rec = recorder;
  recorder = null;
  evidence.recordingLength = (Date.now() - evidence.recordingStarted) / 1000;
  evidence.recordingStopped = Date.now();
  rec.stdin.end('q');
  if (cast) castList = await cast.stop();
  cast = null;
  evidence.recorder = await Promise.race([recorderExit, sleep(15000).then(() => 'did not finish within 15 s: killed')]);
  if (typeof evidence.recorder === 'string') rec.kill('SIGKILL');
  caption('quit');
  await sleep(500);
  stage?.kill();
  stage = null;
}

// the whole run has a limit too: past it, say where it was, write what it has and leave
const RUN_LIMIT_MS = 12 * 60 * 1000;
function writeEvidence(extra = {}) {
  const passed = results.filter((r) => r.ok).length;
  // the repository is public: the app's log names its folder, which is under the home folder; the identity's
  // name stays out too (the team id is enough)
  let json = JSON.stringify({ when: new Date().toISOString(), passed, total: results.length, ...extra, results, ...evidence,
    requests, phoneNavigations: navs }, null, 2).replaceAll(homedir(), '~');
  if (NEW_IDENTITY) json = json.replaceAll(NEW_IDENTITY, 'the --new-identity');
  writeFileSync(evFile, json);
  return passed;
}
setTimeout(() => {
  const at = evidence.steps.at(-1)?.what ?? 'before the first step';
  console.log(`TIMEOUT after ${RUN_LIMIT_MS / 60000} min; the last step was: ${at}`);
  for (const p of [recorder, stage]) p?.kill('SIGKILL');
  const pid = appPid();
  if (pid) try { process.kill(pid, 'SIGKILL'); } catch { /* gone */ }
  forgetTestApp();
  writeEvidence({ timedOut: at });
  process.exit(3);
}, RUN_LIMIT_MS).unref();

run: try {
  // ===== 1. 4.5.0 finds 4.5.1, shows the notes, installs it and opens again as 4.5.1 =====
  install(app450);
  const signature = (app) => {
    const d = sh('/bin/sh', ['-c', 'codesign -dv --verbose=2 "$0" 2>&1', app]);
    return { signature: /^Signature=(.*)$/m.exec(d)?.[1] || (/^Authority=Developer ID Application/m.test(d) ? 'Developer ID Application' : ''),
      team: /^TeamIdentifier=(.*)$/m.exec(d)?.[1] || '', runtime: /flags=.*\(.*runtime.*\)/.test(d), timestamp: /^Timestamp=/m.test(d) };
  };
  if (NEW_IDENTITY) evidence.signatureBefore = signature(INSTALLED);
  testDefaults();
  if (VIDEO) await startRecording();
  const pid450 = await launch();
  step(`opened ${OLD} (pid ${pid450})`);
  caption(`SofaPad ${OLD} running (pid ${pid450}) · checking ${feedURL}`);
  const alert = await until(() => windowWith(tree(pid450), 'Install Update'), 30000, 300);
  step('the update window is up');
  check('at launch, 4.5.0 checks the feed and offers 4.5.1 in its update window', !!alert, freshLog());
  const alertText = alert ? texts(alert).join('\n') : '';
  evidence.updateWindow = { frame: alert?.frame, texts: alert ? texts(alert) : [], buttons: alert?.items.filter((i) => i.role === 'AXButton').map((i) => i.title) };
  check('the window says 4.5.1 is available and that this is 4.5.0', /SofaPad 4\.5\.1 is now available—you have 4\.5\.0/.test(alertText), alertText);
  check('it shows the release notes (English on this Mac)', /A test build for the update test/.test(alertText) && /The phone page sees the new version/.test(alertText), alertText);
  check('Sparkle did not offer to install updates silently (SUAllowsAutomaticUpdates is off)',
    !alert?.items.some((i) => /Automatically download and install/.test(i.title || '')), JSON.stringify(evidence.updateWindow.buttons));
  check('the feed was read from 127.0.0.1', requests.some((r) => r.path === '/appcast.xml'), JSON.stringify(requests));
  if (alert) windowShot(pid450, alert, 'update-1-window');

  // the phone pairs with 4.5.0 (after the window is up: with a phone connected the update would wait in the menu)
  const code = /配對碼：(\d{6})/.exec(freshLog())[1];
  await page.goto(`http://127.0.0.1:${APP_PORT}/#pair=${code}`);
  await until(async () => (await phone()).link === 'ready', 10000);
  if (VIDEO) {
    rmSync(join(videoDir, 'phone'), { recursive: true, force: true });
    castStarted = Date.now();
    cast = await startScreencast(page, join(videoDir, 'phone'), { t0: castStarted / 1000, maxWidth: 780, maxHeight: 1688 });
  }
  await settingsOpen(true);
  let ph = await phone();
  check(`the phone is paired with ${OLD}: page ${OLD} and Mac app ${OLD}`, ph.link === 'ready' && new RegExp(`^Web page ${OLD} \\(build .*\\) · Mac app ${OLD} \\(build .*\\)$`).test(ph.version), JSON.stringify(ph));
  await page.screenshot({ path: join(shotsDir, 'update-0-phone-before.png') });
  await settingsOpen(false);
  await sleep(1500);

  ax('press', pid450, 'Install Update');
  step('pressed Install Update');
  const ready = await until(() => windowWith(tree(pid450), 'Install and Relaunch'), 30000, 250);
  check('it downloads 4.5.1 and checks it: "Install and Relaunch"', !!ready, freshLog());
  check('the zip was downloaded from 127.0.0.1', requests.some((r) => r.path === `/SofaPad-${NEW}-macOS.zip`), JSON.stringify(requests));
  if (ready) {
    evidence.readyWindow = { frame: ready.frame, texts: texts(ready) };
    windowShot(pid450, ready, 'update-2-ready');
  }
  await sleep(1500);
  caption(`SofaPad ${OLD} (pid ${pid450}) · Install and Relaunch`);
  // the app quits while it answers this press, so Accessibility may report an error: what counts is what follows
  try { ax('press', pid450, 'Install and Relaunch'); } catch { evidence.relaunchPressError = 'the app quit before answering'; }
  step('pressed Install and Relaunch');
  const gone = await until(() => { try { process.kill(pid450, 0); return false; } catch { return true; } }, 20000);
  step(`${OLD} quit`);
  caption(`SofaPad ${OLD} quit · Sparkle puts ${NEW} in its place…`);
  const pid451 = await until(() => { const p = appPid(); return p && p !== pid450 ? p : null; }, 30000);
  step(`opened again (pid ${pid451})`);
  const installedVersion = plist(INSTALLED, 'CFBundleShortVersionString');
  caption(`SofaPad ${installedVersion} running (pid ${pid451}) · the phone follows`);
  check('4.5.0 quit and the app opened again by itself', gone && !!pid451, `gone ${gone}, new pid ${pid451}`);
  const signedOK = (() => { try { execFileSync('codesign', ['--verify', '--deep', '--strict', INSTALLED], { stdio: 'ignore' }); return true; } catch { return false; } })();
  check('the app in its place is now 4.5.1, validly signed', installedVersion === NEW && signedOK, `${installedVersion}, signature ${signedOK}`);
  check('the running process is the app in that place', sh('ps', ['-o', 'comm=', '-p', String(pid451)]).trim() === join(INSTALLED, 'Contents/MacOS/SofaPad'));
  if (NEW_IDENTITY) {
    const team = /\(([A-Z0-9]{10})\)$/.exec(NEW_IDENTITY)?.[1];
    evidence.signatureAfter = signature(INSTALLED);
    const b = evidence.signatureBefore, a = evidence.signatureAfter;
    check(`${OLD} was signed ad-hoc and ${NEW} in its place is signed with the Developer ID (team ${team}, hardened runtime, timestamp)`,
      b.signature === 'adhoc' && b.team === 'not set' && a.signature === 'Developer ID Application' && a.team === team && a.runtime && a.timestamp,
      JSON.stringify({ before: b, after: a }));
  }
  // the new app's own first line ("安裝新版本 4.5.1", written by the old one, has the same words in it)
  await until(() => /版本 4\.5\.1（建置/.test(log()), 10000);
  const L = log();
  check('its log: found 4.5.1, installed it, started as 4.5.1', /有新版本：4\.5\.1/.test(L) && /安裝新版本 4\.5\.1，接著重新開啟 SofaPad/.test(L) && /版本 4\.5\.1（建置/.test(L), L.slice(-1200));
  const upToDate = await until(() => /檢查更新：已是最新版 4\.5\.1/.test(log()), 20000);
  check('4.5.1 checks at its launch too, and is up to date', !!upToDate, log().slice(-600));

  // the phone follows
  const followed = await until(async () => { const p = await phone(); return p.link === 'ready' && /4\.5\.1/.test(p.banner) ? p : null; }, 20000);
  step('the phone page reloaded itself');
  check('the phone page reloaded itself once and says so', !!followed && navs.length === 2, JSON.stringify({ navs, followed }));
  await page.screenshot({ path: join(shotsDir, 'update-3-phone-followed.png') });
  await settingsOpen(true);
  ph = await phone();
  check(`the phone shows the same version as the Mac: page ${NEW}, Mac app ${NEW}`, new RegExp(`^Web page ${NEW} \\(build .*\\) · Mac app ${NEW} \\(build .*\\)$`).test(ph.version), ph.version);
  await page.screenshot({ path: join(shotsDir, 'update-4-phone-settings.png') });
  await settingsOpen(false);
  if (pid451) {
    const items = JSON.parse(ax('menushot', pid451, join(shotsDir, 'update-4-menu-after.png')));
    evidence.menuAfter = items;
    check('the menu bar says 4.5.1 and has 檢查更新…', /^SofaPad 4\.5\.1（建置 /.test(items[0] || '') && items.includes('檢查更新…'), JSON.stringify(items));
  }
  await sleep(2500);
  if (VIDEO) await stopRecording();
  await quitApp();
  if (PART1_ONLY) break run;

  // ===== 2. a phone is connected when the update is found: nothing takes the keys, it waits in the menu =====
  install(app450);
  testDefaults([['SULastCheckTime', '-date', new Date().toISOString().replace('T', ' ').slice(0, 19) + ' +0000'],
    ['SofaPadTestCheckDelay', '-float', '6']]);
  const front0 = Number(ax('front'));
  const pidG = await launch();
  const reconnected = await until(async () => (await phone()).link === 'ready' && /^Web page 4\.5\.0/.test((await phone()).version || '') ? true : null, 20000);
  step('gentle: the phone is connected to 4.5.0 again');
  const waiting = await until(() => /手機連線中，先放在選單列/.test(freshLog()), 20000);
  await sleep(1500);
  const tG = tree(pidG);
  const front1 = Number(ax('front'));
  check('a phone connected: the found update opens no window', reconnected && waiting && !windowWith(tG, 'Install Update'), JSON.stringify({ reconnected, waiting, windows: tG.windows.map((w) => w.title) }));
  check('and SofaPad did not take the keyboard focus', front1 !== pidG, `front ${front0} → ${front1}, app ${pidG}`);
  const menu = JSON.parse(ax('menushot', pidG, join(shotsDir, 'update-5-menu-waiting.png')));
  evidence.menuWaiting = menu;
  check('the menu offers it: ⬆︎ 安裝新版本 4.5.1…', menu.includes('⬆︎ 安裝新版本 4.5.1…'), JSON.stringify(menu));
  ax('menu', pidG, '⬆︎ 安裝新版本 4.5.1…');
  const fromMenu = await until(() => windowWith(tree(pidG), 'Install Update'), 15000, 300);
  check('choosing it opens the update window', !!fromMenu);
  if (fromMenu) {
    windowShot(pidG, fromMenu, 'update-5-from-menu');
    ax('press', pidG, 'Remind Me Later');
  }
  await quitApp();

  // ===== 3. a tampered zip: rejected, 4.5.0 stays =====
  const tdir = join(E2E, 'tampered');
  mkdirSync(tdir, { recursive: true });
  sh('ditto', ['-x', '-k', ZIP, tdir]);
  const victim = join(tdir, `SofaPad-${NEW}`, 'SofaPad.app/Contents/Resources/web/index.html');
  writeFileSync(victim, readFileSync(victim, 'utf8') + '\n<!-- changed after signing -->\n');
  rmSync(ZIP);
  sh('ditto', ['-c', '-k', '--sequesterRsrc', '--keepParent', join(tdir, `SofaPad-${NEW}`), ZIP]);
  check('the tampered zip is a different file', !readFileSync(ZIP).equals(genuineZip));
  install(app450);
  testDefaults();
  const pidT = await launch();
  const alertT = await until(() => windowWith(tree(pidT), 'Install Update'), 30000, 300);
  if (alertT) ax('press', pidT, 'Install Update');
  const error = await until(() => tree(pidT).windows.find((w) => w.items.some((i) => i.role === 'AXButton' && i.title === 'Cancel Update')), 30000, 300);
  const errText = error ? texts(error).join(' ') : '';
  evidence.tamperedZip = { texts: error ? texts(error) : [], log: freshLog().split('\n').filter((l) => /更新|update/i.test(l)) };
  check('tampered zip: Sparkle refuses it ("improperly signed")', /improperly signed and could not be validated/.test(errText), errText + ' | ' + freshLog().slice(-500));
  if (error) {
    windowShot(pidT, error, 'update-6-tampered-zip');
    ax('press', pidT, 'Cancel Update');
  }
  await sleep(2000);
  check('tampered zip: the app is still 4.5.0 and still running', plist(INSTALLED, 'CFBundleShortVersionString') === OLD && appPid() === pidT,
    `${plist(INSTALLED, 'CFBundleShortVersionString')} pid ${appPid()} (was ${pidT})`);
  check('tampered zip: the log says why', /更新中止：.*(improperly signed|could not be validated)/.test(freshLog()), freshLog().slice(-500));
  await quitApp();

  // ===== 4. a feed changed after it was signed: refused =====
  writeFileSync(ZIP, genuineZip);
  writeFileSync(join(FEED, 'appcast.xml'), genuineFeed.toString('utf8').replace('A test build for the update test', 'A test build for the update test (changed)'));
  testDefaults();
  const pidF = await launch();
  const refused = await until(() => /更新中止：/.test(freshLog()) && freshLog(), 20000);
  await sleep(1500);
  evidence.tamperedFeed = { log: (refused || '').split('\n').filter((l) => /更新/.test(l)) };
  check('a feed changed after signing: no update offered, the log says the feed failed its check',
    !!refused && !windowWith(tree(pidF), 'Install Update') && !/有新版本/.test(freshLog()), freshLog().slice(-600));
  writeFileSync(join(FEED, 'appcast.xml'), genuineFeed);
  await quitApp();
} finally {
  if (VIDEO) await stopRecording().catch(() => {});
  await quitApp();
  await browser.close();
  feedServer.close();
  if (existsSync(LOG)) copyFileSync(LOG, join(E2E, 'logs', 'app.log'));
  forgetTestApp();
  rmSync(LOG, { force: true });
}

check('no errors on the phone page', pageErrors.length === 0, pageErrors.join(' | '));

// the video: the Mac's screen (the update window, the relaunch) on the right, the phone on the left, at 60 fps
if (VIDEO && existsSync(macRaw) && castList) {
  const ff = (a) => sh('ffmpeg', ['-y', '-loglevel', 'error', ...a], { timeout: 600000 });
  const mac = join(videoDir, 'sofa12-update-mac.mp4');
  const phoneMp4 = join(videoDir, 'sofa12-update-phone.mp4');
  const both = join(videoDir, 'sofa12-update.mp4');
  const probe = (f) => sh('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,r_frame_rate,nb_frames:format=duration', '-of', 'json', f]);
  // The Mac's recording is placed by its end, when q reached ffmpeg: it began its own length before that (the frame
  // count ffmpeg reports at the start comes after the encoder's delay, about a second late). The phone's video starts
  // `lead` seconds into it and ends with it. Both are counted in frames; the phone's last picture has no time of its
  // own, so it is held (tpad) and the count ends it.
  const length = Number(JSON.parse(probe(macRaw)).format.duration);
  const lead = Math.max(0, (castStarted - (evidence.recordingStopped - length * 1000)) / 1000).toFixed(2);
  const frames = (s) => String(Math.round(s * 60));
  const hold = `tpad=stop_mode=clone:stop_duration=${Math.ceil(length)}`;
  ff(['-i', macRaw, '-vf', `fps=60,${hold},format=yuv420p`, '-frames:v', frames(length), '-c:v', 'libx264', '-crf', '20', mac]);
  ff(['-f', 'concat', '-safe', '0', '-i', castList, '-vf', `fps=60,scale=-2:${STAGE.h},${hold},format=yuv420p`,
    '-frames:v', frames(length - lead), '-c:v', 'libx264', '-crf', '20', phoneMp4]);
  ff(['-i', mac, '-i', phoneMp4, '-filter_complex', `[1:v]tpad=start_duration=${lead}:color=0x17191f[p];[p][0:v]hstack=inputs=2[v]`,
    '-map', '[v]', '-r', '60', '-frames:v', frames(length), '-c:v', 'libx264', '-crf', '20', '-pix_fmt', 'yuv420p', both]);
  evidence.video = { mac: JSON.parse(probe(mac)), phone: JSON.parse(probe(phoneMp4)), both: JSON.parse(probe(both)), phoneLead: Number(lead) };
  check('the recording was made: the Mac screen and the phone side by side', statSync(both).size > 100000, JSON.stringify(evidence.video));
} else if (VIDEO) {
  check('the recording was made: the Mac screen and the phone side by side', false,
    JSON.stringify({ macRecording: existsSync(macRaw), phoneFrames: !!castList, recorder: evidence.recorder }));
}
const passed = writeEvidence();
console.log(`\nsofa12-update-e2e${VIDEO_ONLY ? ' (video only)' : ''}: ${passed}/${results.length} PASS`);
process.exit(passed === results.length ? 0 : 1);
