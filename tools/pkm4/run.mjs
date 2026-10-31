// PKM-4 real-injection test bench (Ray P-23: "上一段話跳到下一個視窗"＋卡頓).
//   iPhone side: iOS Simulator Safari, typed through the real iOS keyboard by tools/pkm4/SimDriver (XCUITest).
//   Mac side:    SofaPad really injecting — only into two untitled TextEdit windows this script opens ("A" = Orca,
//                "B" = LINE). Every event goes through the e2e guard: TextEdit must be in front AND its front window
//                must be A or B, otherwise the event is dropped and the run stops. Never runs while the Mac is locked.
//                Each run stops after 2 minutes; TextEdit is closed without saving at the end.
//
//   node tools/pkm4/run.mjs <scenario> [--build new|old] [--rounds N] [--mode live|buffer] [--text-mode auto|paste]
//   scenarios: switch (送出→切窗→新視窗打一個字), reconnect (--kind stop|restart), latency, undo, zhuyin, background
import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ROOT, bootSim, openURL, startDriver, terminateSafari } from './sim.mjs';
import en from '../../web/js/lang/en.js';
import zh from '../../web/js/lang/zh.js';

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const scenario = argv[0];
const build = opt('build', 'new');
const rounds = Number(opt('rounds', 10));
const mode = opt('mode', 'live');
const textMode = opt('text-mode', 'paste');
const kind = opt('kind', 'stop');
const dry = argv.includes('--dry');   // harness check only: --dry-run Mac app, no TextEdit, nothing injected
const tag = opt('tag', `${scenario}-${build}-${mode}-${textMode}${scenario === 'reconnect' ? '-' + kind : ''}`);
const RUN_LIMIT_MS = 120_000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const OLD = process.env.PKM_OLD_SRC;   // folder with the pre-PKM-4 mac/ and web/ (git archive ec89c07)
const SRC = build === 'old' ? OLD : ROOT;
if (!SRC) throw new Error('set PKM_OLD_SRC for --build old');
const evidenceDir = join(ROOT, 'design/evidence/pkm4');
mkdirSync(evidenceDir, { recursive: true });

const tewinBin = join(ROOT, 'tools/pkm4/.build/tewin');
const tewinReal = (...a) => JSON.parse(execFileSync(tewinBin, a.map(String)).toString().trim().split('\n').at(-1));
const switches = [];
const tewin = dry ? (cmd, w) => {
  if (cmd === 'front-info') return { locked: false };
  if (cmd === 'launch') return { pid: 0, windows: [1, 2] };
  if (cmd === 'front') { switches.push({ w, t: Date.now() }); return { ok: true }; }
  if (cmd === 'text') return { text: '' };
  return { ok: true };
} : tewinReal;

// ---- preflight: unlocked Mac, TextEdit not in use ----
const pre = tewin('front-info');
if (pre.locked) { console.log('Mac is locked: not testing'); process.exit(3); }
// Someone is using this Mac: do not take the foreground (the test brings TextEdit to the front every round).
const idleSec = () => Number(/"HIDIdleTime" = (\d+)/.exec(execFileSync('ioreg', ['-c', 'IOHIDSystem']).toString())?.[1] || 0) / 1e9;
const minIdle = Number(process.env.PKM_MIN_IDLE || 60);
// The bench's own injected keys count as "use" too: no input since the previous run ended also means nobody is here.
const stamp = join(tmpdir(), 'pkm4-last-run-end');
let lastEnd = 0;
try { lastEnd = Number(readFileSync(stamp, 'utf8')); } catch { /* first run */ }
const sinceLast = (Date.now() - lastEnd) / 1000;
if (!dry && idleSec() < minIdle && !(lastEnd && idleSec() >= sinceLast - 1)) {
  console.log(`someone used this Mac ${idleSec().toFixed(0)} s ago (< ${minIdle} s, last run ended ${sinceLast.toFixed(0)} s ago): not testing`);
  process.exit(4);
}
const mouse0 = dry ? null : tewinReal('mouse');
const startedAt = new Date().toISOString();
const te = tewin('launch');                       // refuses if TextEdit was already running
const [A, B] = te.windows;
console.log(`TextEdit pid ${te.pid}, windows A=${A} B=${B}`);

// ---- the Mac app, really injecting, guarded ----
const state = mkdtempSync(join(tmpdir(), 'pkm4-state-'));
const port = 31000 + Math.floor(Math.random() * 8000);
let server = null;
let serverLog = '';
function startMac() {
  const args = ['--no-ui', '--bind', '127.0.0.1', '--port', String(port), '--state-dir', state,
    '--web-root', join(SRC, 'web'), '--text-mode', textMode, '--pairing-window', '900'];
  if (dry) args.push('--dry-run'); else args.push('--e2e-guard-pid', String(te.pid));
  if (build === 'old') args.push('--no-https');
  const p = spawn(join(SRC, 'mac/.build/debug/pkm-server'), args,
    { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, PKM_E2E_WINDOWS: `${A},${B}`, PKM_E2E_TIMING: '1' } });
  p.stdout.on('data', (d) => { serverLog += d; });
  p.stderr.on('data', (d) => { serverLog += d; });
  server = p;
  return p;
}
async function waitLog(re, from = 0, ms = 15000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const m = re.exec(serverLog.slice(from));
    if (m) return m;
    await sleep(20);
  }
  throw new Error(`timeout waiting for ${re} in server log`);
}
const guardTripped = () => /e2e guard: target is not the probe/.test(serverLog);

const results = { scenario, build, mode, textMode, kind, tag, startedAt, rounds: [], notes: [] };
let drv = null;
try {
  startMac();
  const code = (await waitLog(/配對碼：(\d{6})/))[1];
  bootSim();
  terminateSafari();
  drv = await startDriver({ dir: join(tmpdir(), `pkm4-ipc-${process.pid}`) });
  tewin('front', A);
  const runStart = Date.now();
  openURL(`http://127.0.0.1:${port}/#pair=${code}`);
  await waitLog(/authenticated /, 0, 30000);
  await drv.cmd('activate');
  await sleep(1200);
  // SOFA-10: the page is in the simulator's language (an older build is always Chinese); the buttons are found by name
  const L = (await drv.cmd('exists', { label: zh['mode.aria'], timeout: 2 })).exists ? zh : en;
  const box = { kind: 'textView', label: '' };
  if (mode === 'buffer') {
    await drv.cmd('tap', { kind: 'button', label: L['mode.aria'] });
    await sleep(300);
  }
  const front = (w) => { const r = tewin('front', w); if (!r.ok) throw new Error(`could not bring window ${w} to the front`); };
  // Before taking the foreground again: TextEdit must still be in front (we leave it there) and the mouse where it
  // was (the test never moves it). Otherwise someone is using the Mac: stop at once.
  const stillOurs = () => {
    if (dry) return;
    const f = tewinReal('front-info');
    const m = tewinReal('mouse');
    if (f.locked) throw new Error('Mac locked during the run: stopped');
    if (f.bundle !== 'com.apple.TextEdit') throw new Error(`front app changed to ${f.bundle}: someone is using the Mac, stopped`);
    if (Math.hypot(m.x - mouse0.x, m.y - mouse0.y) > 2) throw new Error('the mouse moved: someone is using the Mac, stopped');
  };
  const timeLeft = () => RUN_LIMIT_MS - (Date.now() - runStart);
  const textOf = (w) => tewin('text', w).text;

  if (scenario === 'switch' || scenario === 'background') {
    // Ray's flow: type in "Orca" (A), send, switch to "LINE" (B), type one character there.
    for (let k = 1; k <= rounds; k++) {
      if (timeLeft() < 15000) { results.notes.push(`stopped after ${k - 1} rounds: 2-minute limit`); break; }
      if (guardTripped()) throw new Error('e2e guard tripped: something else came to the front');
      if (k > 1) stillOurs();
      const label = `r${String(k).padStart(2, '0')}`;
      const text = `${label} orca line ${k}`;
      front(A);
      await drv.cmd('tap', box);
      await drv.cmd('type', { text });
      const sentAt = Date.now();
      if (mode === 'buffer') await drv.cmd('tap', { kind: 'button', label: L['input.send'] });
      else await drv.cmd('type', { text: '\n' });
      if (scenario === 'background') {            // Safari to the background and back, like switching apps on the phone
        await drv.cmd('home');
        await sleep(1500);
        await drv.cmd('activate');
      }
      await sleep(400);                           // a person needs at least this long to switch windows
      front(B);
      const switchedAt = Date.now();
      await drv.cmd('tap', box);
      await drv.cmd('type', { text: 'x' });
      if (mode === 'buffer') await drv.cmd('tap', { kind: 'button', label: L['input.send'] });
      await sleep(900);
      results.rounds.push({ k, label, sentToSwitchMs: switchedAt - sentAt });
    }
    await sleep(1500);
  } else if (scenario === 'reconnect') {
    // Disconnect 20 times: "stop" = pause the Mac app (half-open connection, like Wi-Fi going to sleep),
    // "restart" = quit and start it again. Text typed during the outage must never show up later in the new window.
    for (let k = 1; k <= rounds; k++) {
      if (timeLeft() < 20000) { results.notes.push(`stopped after ${k - 1} rounds: 2-minute limit`); break; }
      if (guardTripped()) throw new Error('e2e guard tripped');
      if (k > 1) stillOurs();
      const label = `d${String(k).padStart(2, '0')}`;
      front(A);
      await drv.cmd('tap', box);
      await drv.cmd('type', { text: `${label} ok ` });
      await sleep(700);
      const mark = serverLog.length;
      const outageAt = Date.now();
      if (kind === 'stop') server.kill('SIGSTOP');
      else { server.kill('SIGKILL'); await new Promise((r) => server.once('exit', r)); }
      await drv.cmd('type', { text: `${label} lost ` });   // typed while the Mac does not answer
      await sleep(kind === 'stop' ? 6000 : 1500);   // longer than the phone's 4.5 s heartbeat limit
      front(B);                                            // Ray moves on (Vision Pro / the Mac's own mouse)
      const resumeAt = Date.now();
      if (kind === 'stop') server.kill('SIGCONT');
      else startMac();
      let back = null;
      try { await waitLog(/authenticated /, mark, 15000); back = Date.now(); } catch { /* not back */ }
      await sleep(600);
      await drv.cmd('type', { text: 'x' });
      await sleep(900);
      await drv.cmd('type', { text: '\n' });       // Enter: the line ends, the phone's box is emptied
      await sleep(300);
      results.rounds.push({ k, label, reconnected: back != null, reconnectMs: back ? back - resumeAt : null, outageMs: resumeAt - outageAt });
      front(A);
      await sleep(300);
    }
  } else if (scenario === 'latency') {
    // ordinary typing, one key at a time, into A; the Mac logs when each piece was posted (e2e-timing)
    front(A);
    await drv.cmd('tap', box);
    const words = 'the quick brown fox jumps over the lazy dog ';
    const r1 = await drv.cmd('typeEach', { text: words.repeat(2), gapMs: 0 });
    results.typeTimes = r1.times;
    await sleep(1500);
  } else if (scenario === 'undo') {
    // after 送出 / Enter the box is empty; ⌘Z (iOS undo: shake, three-finger swipe) must not bring the text back to the Mac
    for (let k = 1; k <= rounds; k++) {
      const label = `u${String(k).padStart(2, '0')}`;
      front(A);
      await drv.cmd('tap', box);
      await drv.cmd('type', { text: `${label} undo test ` });
      if (mode === 'buffer') await drv.cmd('tap', { kind: 'button', label: L['input.send'] });
      else await drv.cmd('type', { text: '\n' });
      await sleep(400);
      front(B);
      await drv.cmd('tap', box);
      await drv.cmd('typeKey', { key: 'z', mods: ['cmd'] });
      await sleep(300);
      await drv.cmd('typeKey', { key: 'z', mods: ['cmd', 'shift'] });
      await sleep(300);
      await drv.cmd('type', { text: 'x' });
      if (mode === 'buffer') await drv.cmd('tap', { kind: 'button', label: L['input.send'] });
      await sleep(900);
      results.rounds.push({ k, label });
    }
  } else if (scenario === 'zhuyin') {
    // Zhuyin on the phone keyboard: ㄋㄧˇ → 你, ㄏㄠˇ → 好, picked from the candidates
    front(A);
    await drv.cmd('tap', box);
    // the keyboard remembers the last one used: switch until the Zhuyin keys are there
    let kb = { err: 'no Zhuyin keyboard' };
    for (let i = 0; i < 3; i++) {
      if ((await drv.cmd('exists', { label: 'ㄅ', timeout: 1 })).exists) { kb = {}; break; }
      await drv.cmd('tap', { kind: 'any', label: 'Next keyboard' });
      await sleep(500);
    }
    const d = await drv.cmd('dump');
    writeFileSync(join(tmpdir(), 'pkm4-zhuyin-tree.txt'), d.tree);
    for (const [keys, pick] of [[['ㄋ', 'ㄧ', '三聲、'], '你'], [['ㄏ', 'ㄠ', '三聲、'], '好']]) {
      await drv.cmd('keys', { keys });
      await sleep(300);
      await drv.cmd('tap', { kind: 'any', label: pick, timeout: 3 });
      await sleep(500);
    }
    await sleep(1000);
    results.kb = kb.err || 'ok';
  }

  // ---- what ended up in the two windows ----
  results.textA = textOf(A);
  results.textB = textOf(B);
  results.guardTripped = guardTripped();
} catch (e) {
  results.error = String(e.message || e).slice(0, 2000);
  console.log('ERROR', results.error);
} finally {
  try { if (server && server.exitCode == null) { server.kill('SIGCONT'); server.kill('SIGTERM'); } } catch { /* gone */ }
  if (drv) await drv.stop();
  terminateSafari();
  try { results.closed = tewin('close'); } catch (e) { results.closed = String(e.message); }
  if (!dry && pre.pid) { try { tewinReal('activate', pre.pid); } catch { /* that app is gone */ } }
  if (!dry) writeFileSync(stamp, String(Date.now()));
}

// ---- verdicts ----
const timing = serverLog.split('\n').filter((l) => l.includes('e2e-timing ')).map((l) => JSON.parse(l.slice(l.indexOf('{'))));
results.timing = timing;
results.late = serverLog.split('\n').filter((l) => /late by|guard/.test(l));
const A_ = results.textA || '';
const B_ = results.textB || '';
for (const r of results.rounds) {
  if (r.label) {
    const inA = A_.split(r.label).length - 1;
    const inB = B_.split(r.label).length - 1;
    Object.assign(r, { inA, inB });
  }
}
if (scenario === 'switch' || scenario === 'background' || scenario === 'undo') {
  // B ("LINE") must hold only the x's typed there: anything else — a label, the tail of a line, the Enter that
  // ended it — came from A ("Orca"). A round leaked when B has its label or the end of its line ("line 7", "test").
  results.leakedChars = B_.replace(/x/g, '').length;
  const tests = (B_.match(/test/g) || []).length;
  results.rounds.forEach((r, i) => {
    r.pieceInB = scenario === 'undo' ? i < tests : new RegExp(`e ${r.k}(?![0-9])`).test(B_);
  });
  results.leaks = results.rounds.filter((r) => r.inB > 0 || r.pieceInB).length;
  results.dupes = results.rounds.filter((r) => r.inA > (scenario === 'undo' ? 1 : 1)).length;
  results.missing = results.rounds.filter((r) => r.inA === 0).length;
  results.bOnlyX = /^[x\s]*$/.test(B_);
}
if (scenario === 'reconnect') {
  const lost = (s) => s.split(/(d\d\d lost)/).filter((x) => /^d\d\d lost$/.test(x));
  results.lostInA = lost(A_).length;
  results.lostInB = lost(B_).length;
  results.okTwice = results.rounds.filter((r) => (A_ + B_).split(`${r.label} ok`).length - 1 > 1).length;
  results.reconnects = results.rounds.filter((r) => r.reconnected).length;
  const ms = results.rounds.filter((r) => r.reconnectMs != null).map((r) => r.reconnectMs);
  results.reconnectMeanMs = ms.length ? Math.round(ms.reduce((a, b) => a + b, 0) / ms.length) : null;
  results.reconnectMaxMs = ms.length ? Math.max(...ms) : null;
}
if (timing.some((t) => t.at)) {
  const lat = timing.filter((t) => t.at).map((t) => t.done - t.at).sort((a, b) => a - b);
  const pct = (p) => lat[Math.min(lat.length - 1, Math.floor(p * lat.length))];
  results.latency = { n: lat.length, p50: Math.round(pct(0.5)), p95: Math.round(pct(0.95)), max: Math.round(lat.at(-1)) };
}
results.switches = switches;
const file = join(dry ? tmpdir() : evidenceDir, `${tag}${dry ? '-dry' : ''}.json`);
writeFileSync(file, JSON.stringify({ ...results, serverLog: serverLog.split('\n').filter((l) => !l.includes('e2e-timing')).slice(-60) }, null, 1));
const summary = { tag, error: results.error, leaks: results.leaks, leakedChars: results.leakedChars, dupes: results.dupes, missing: results.missing, bOnlyX: results.bOnlyX,
  lostInA: results.lostInA, lostInB: results.lostInB, okTwice: results.okTwice, reconnects: results.reconnects,
  reconnectMeanMs: results.reconnectMeanMs, latency: results.latency, rounds: results.rounds.length, guard: results.guardTripped,
  B: B_.slice(0, 300) };
console.log(JSON.stringify(summary));
