// SOFA-6 with real injection: the cursor pad and the text box, from a headless Chrome page (the phone) through
// SofaPad really typing — only into an untitled TextEdit window this script opens, behind the e2e guard (TextEdit
// in front AND its front window is the test window, or the event is dropped). Same rules as tools/pkm4/run.mjs:
// never while the Mac is locked or someone used it in the last 60 s; stops if the front app or the mouse changes;
// at most 2 minutes; TextEdit is closed without saving and the front goes back to the app that had it.
// No clicks or pointer moves are sent. Checks TextEdit's own text and selection (Accessibility) after each step.
//   node tools/sofa6-textedit.mjs
import { chromium } from 'playwright-core';
import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ROOT, IPHONE_UA } from './test-server.mjs';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const tewinBin = join(ROOT, 'tools/pkm4/.build/tewin');
const tewin = (...a) => JSON.parse(execFileSync(tewinBin, a.map(String)).toString().trim().split('\n').at(-1));
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok ? '' : '  → ' + detail}`);
};

// ---- preflight ----
const pre = tewin('front-info');
if (pre.locked) { console.log('Mac is locked: not testing'); process.exit(3); }
const idleSec = () => Number(/"HIDIdleTime" = (\d+)/.exec(execFileSync('ioreg', ['-c', 'IOHIDSystem']).toString())?.[1] || 0) / 1e9;
const stamp = join(tmpdir(), 'pkm4-last-run-end');
let lastEnd = 0;
try { lastEnd = Number(readFileSync(stamp, 'utf8')); } catch { /* first run */ }
const sinceLast = (Date.now() - lastEnd) / 1000;
if (idleSec() < 60 && !(lastEnd && idleSec() >= sinceLast - 1)) {
  console.log(`someone used this Mac ${idleSec().toFixed(0)} s ago: not testing`);
  process.exit(4);
}
const mouse0 = tewin('mouse');
const te = tewin('launch');                 // refuses if TextEdit was already running
const [A, B] = te.windows;
const startedAt = new Date().toISOString();
// The only extra window allowed: the Siri overlay macOS 27 puts above the documents (tewin launch: a titleless dialog
// with nothing but a "Siri Waveform Orb" button). It is never pressed; keys still go to the test window, and every step
// is checked by reading that window's own text. Anything else unknown on top: not testing.
// It appears a second or two after launch, empty at first and with its orb button a moment later: look again for up
// to 4 s, until it is recognised, before the guard's window list is fixed. Still unknown after that: not testing.
let ov = { overlays: [], unknown: [] };
for (let i = 0; i < 8; i++) {
  execFileSync('sleep', ['0.5']);
  ov = tewin('overlays');
  if (ov.overlays.length && !ov.unknown.length) break;
}
const overlays = ov.overlays;
if (ov.unknown.length) {
  console.log(`an unknown TextEdit window is open (${ov.unknown}): not testing`);
  tewin('close');
  if (pre.pid) tewin('activate', pre.pid);
  process.exit(5);
}
const allowed = [A, B, ...overlays];
console.log(`TextEdit pid ${te.pid}, test window ${A}${overlays.length ? `, Siri overlay ${overlays}` : ''}`);

const state = mkdtempSync(join(tmpdir(), 'sofa6-state-'));
const port = 31000 + Math.floor(Math.random() * 8000);
let serverLog = '';
const server = spawn(join(ROOT, 'mac/.build/debug/pkm-server'),
  ['--no-ui', '--bind', '127.0.0.1', '--port', String(port), '--state-dir', state, '--web-root', join(ROOT, 'web'),
    '--e2e-guard-pid', String(te.pid)],
  { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, PKM_E2E_WINDOWS: allowed.join(',') } });
server.stdout.on('data', (d) => { serverLog += d; });
server.stderr.on('data', (d) => { serverLog += d; });
let stopped = null;
const watchdog = setTimeout(() => { stopped = 'time limit (2 min)'; }, 120_000);
/** Still safe to inject? TextEdit's test window in front, nobody moved the mouse, the guard never had to drop anything. */
function safe() {
  if (stopped) return false;
  const f = tewin('front-info');
  const m = tewin('mouse');
  if (f.locked) stopped = 'Mac locked';
  else if (f.pid !== te.pid || !(f.textEditFront === A || overlays.includes(f.textEditFront))) { stopped = `front changed (${f.bundle}, window ${f.textEditFront}, test window ${A})`; out.windowsAtStop = tewin('wins').wins; }
  else if (Math.hypot(m.x - mouse0.x, m.y - mouse0.y) > 2) stopped = 'mouse moved';
  else if (/e2e guard: target is not the probe/.test(serverLog)) stopped = 'guard dropped an event';
  return !stopped;
}

const out = { startedAt, steps: [], overlays };
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const code = await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('no pairing code')), 10_000);
    const iv = setInterval(() => { const m = /配對碼：(\d{6})/.exec(serverLog); if (m) { clearTimeout(t); clearInterval(iv); resolve(m[1]); } }, 20);
  });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, userAgent: IPHONE_UA });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await page.goto(`http://127.0.0.1:${port}/#pair=${code}`);
  await page.waitForFunction(() => document.getElementById('dot').classList.contains('ready'), null, { timeout: 15_000 });
  await page.evaluate(() => { if (document.getElementById('modeBtn').textContent.trim() !== '即時') document.getElementById('modeBtn').click(); });
  // the test window in front; TextEdit opens the second window on top, and raising A can take a moment
  for (let i = 0; i < 4; i++) {
    const r = tewin('front', A);
    out.front = r;
    await sleep(400);
    const f = tewin('front-info');
    if (f.pid === te.pid && (f.textEditFront === A || overlays.includes(f.textEditFront))) break;
    out.frontTries = i + 1;
  }

  const type = async (s) => {
    await page.evaluate((s) => {
      const el = document.getElementById('input');
      el.focus();
      for (const ch of s) { el.setRangeText(ch, el.selectionStart, el.selectionEnd, 'end'); el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: ch })); }
    }, s);
    await sleep(1200);
  };
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((p) => ({ ...p, radiusX: 4, radiusY: 4, force: 1 })) });
  const drag = async (dx, dy, ms) => {
    const b = await page.locator('#caretPad').boundingBox();
    const x0 = b.x + b.width / 2;
    const y0 = b.y + b.height / 2;
    await touch('touchStart', [{ x: x0, y: y0, id: 1 }]);
    await sleep(380);
    const n = Math.max(1, Math.round(ms / 16));
    for (let i = 1; i <= n; i++) { await touch('touchMove', [{ x: x0 + (dx * i) / n, y: y0 + (dy * i) / n, id: 1 }]); await sleep(ms / n); }
    await touch('touchEnd', []);
    await sleep(500);
  };
  const step = async (name, fn, expect) => {
    if (!safe()) return;
    await fn();
    if (!safe()) return;
    const s = tewin('sel', A);
    const ok = expect(s);
    out.steps.push({ name, text: s.text, loc: s.loc, len: s.len, ok });
    check(name, ok, JSON.stringify(s));
  };

  await step('打字：「hello world」', () => type('hello world'), (s) => s.text === 'hello world' && s.loc === 11);
  await step('游標板往左 5 下，再打「X」→「hello Xworld」', async () => { await drag(-70, 0, 700); await type('X'); },
    (s) => s.text === 'hello Xworld' && s.loc === 7);
  await step('選取：Shift＋← 2 下，選到「 X」', async () => { await page.tap('#caretSelect'); await drag(-28, 0, 400); await page.tap('#caretSelect'); },
    (s) => s.text === 'hello Xworld' && s.loc === 5 && s.len === 2);
  await step('打「_」取代選取的字 →「hello_world」', () => type('_'), (s) => s.text === 'hello_world' && s.loc === 6 && s.len === 0);
  await step('快速甩向右：⌥→ 跳到字尾，再打「!」', async () => { await drag(260, 0, 140); await type('!'); },
    (s) => s.text === 'hello_world!' && s.len === 0);
  // ↑ keeps the cursor's x position, not its character column (proportional font): "^" lands somewhere in line 1
  await step('Enter 換行、打第二行，往上拖 1 下（游標回到第一行）再打「^」', async () => {
    await page.evaluate(() => document.getElementById('input').dispatchEvent(new InputEvent('beforeinput', { bubbles: true, cancelable: true, inputType: 'insertLineBreak' })));
    await sleep(600);
    await type('second');
    await drag(0, -30, 400);
    await type('^');
  }, (s) => { const [l1, l2] = s.text.split('\n'); return l2 === 'second' && l1.replace('^', '') === 'hello_world!' && l1.includes('^') && l1.at(-1) !== '^'; });
  out.box = await page.inputValue('#input');
} finally {
  clearTimeout(watchdog);
  await browser.close();
  server.kill('SIGTERM');
  await sleep(300);
  out.closed = tewin('close');
  if (pre.pid) tewin('activate', pre.pid);
  writeFileSync(stamp, String(Date.now()));
}
out.stopped = stopped;
out.results = results;
out.guardDropped = /e2e guard: target is not the probe/.test(serverLog);
out.guardLines = serverLog.split('\n').filter((l) => /e2e guard/.test(l)).slice(0, 10);   // event types only, no addresses
const passed = results.filter((r) => r.ok).length;
console.log(`${passed}/${results.length} PASS${stopped ? `  (stopped: ${stopped})` : ''}; TextEdit closed: ${out.closed.ok}`);
mkdirSync(join(ROOT, 'design/evidence/sofa6'), { recursive: true });
writeFileSync(join(ROOT, 'design/evidence/sofa6/textedit-real.json'), JSON.stringify(out, null, 1));
process.exitCode = passed === 6 && !stopped ? 0 : 1;
