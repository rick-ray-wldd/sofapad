// PKM-4 test bench, phone half: the iOS Simulator (iPhone 18 Pro) with Safari, driven through the real iOS keyboard
// by tools/pkm4/SimDriver (an XCUITest that runs commands written to a folder). Nothing here touches the Mac's own
// keyboard, mouse or windows; settings changed are the simulated iPhone's own (keyboards), never the Mac's.
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
export const UDID = process.env.PKM_SIM || 'B4797567-7850-460A-9DDD-905BCAD1CFAA';   // iPhone 18 Pro, iOS 27.0
const DEV = { ...process.env, DEVELOPER_DIR: '/Applications/Xcode.app/Contents/Developer' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const simctl = (...a) => execFileSync('xcrun', ['simctl', ...a], { env: DEV, stdio: ['ignore', 'pipe', 'pipe'] }).toString();

export function simState() {
  const line = simctl('list', 'devices').split('\n').find((l) => l.includes(UDID)) || '';
  return /\(Booted\)/.test(line) ? 'Booted' : 'Shutdown';
}

/** Boot once; add the Zhuyin keyboard to the simulated iPhone (its own settings, not the Mac's). */
export function bootSim() {
  if (simState() !== 'Booted') simctl('boot', UDID);
  simctl('bootstatus', UDID, '-b');
  try {
    simctl('spawn', UDID, 'defaults', 'write', '-g', 'AppleKeyboards', '-array',
      'en_US@sw=QWERTY;hw=Automatic', 'zh_Hant-Zhuyin@sw=Zhuyin;hw=Automatic');
    simctl('spawn', UDID, 'defaults', 'write', '-g', 'AppleKeyboardsExpanded', '-bool', 'YES');
  } catch (e) { console.log('keyboard prefs:', e.message); }
}

export function openURL(url) { simctl('openurl', UDID, url); }
export function terminateSafari() { try { simctl('terminate', UDID, 'com.apple.mobilesafari'); } catch { /* not running */ } }

/** Starts the XCUITest hand. Returns {cmd(op, args) → result, stop()}. */
export async function startDriver({ dir, maxSeconds = 1800, log = () => {} } = {}) {
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const dd = process.env.PKM_SIM_DD || join(ROOT, 'tools/pkm4/.build');
  const project = join(ROOT, 'tools/pkm4/SimDriver/SimDriver.xcodeproj');
  if (!existsSync(join(dd, 'Build/Products'))) {
    execFileSync('xcodebuild', ['build-for-testing', '-project', project, '-scheme', 'SimDriverUITests',
      '-destination', `id=${UDID}`, '-derivedDataPath', dd, '-quiet'], { env: DEV, stdio: 'inherit' });
  }
  const proc = spawn('xcodebuild', ['test-without-building', '-project', project, '-scheme', 'SimDriverUITests',
    '-destination', `id=${UDID}`, '-derivedDataPath', dd],
  { env: { ...DEV, TEST_RUNNER_PKM_IPC: dir, TEST_RUNNER_PKM_MAX_SECONDS: String(maxSeconds) }, stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '';
  proc.stdout.on('data', (d) => { out += d; });
  proc.stderr.on('data', (d) => { out += d; });
  let n = 0;
  async function cmd(op, args = {}, timeoutMs = 60000) {
    n += 1;
    const tmp = join(dir, `cmd-${n}.tmp`);
    writeFileSync(tmp, JSON.stringify({ op, ...args }));
    renameSync(tmp, join(dir, `cmd-${n}.json`));
    const res = join(dir, `res-${n}.json`);
    const t0 = Date.now();
    while (!existsSync(res)) {
      if (proc.exitCode != null) throw new Error(`driver exited: ${out.slice(-1500)}`);
      if (Date.now() - t0 > timeoutMs) throw new Error(`driver timeout on ${op}: ${out.slice(-800)}`);
      await sleep(10);
    }
    const r = JSON.parse(readFileSync(res, 'utf8'));
    log(op, r);
    if (r.err && !args.allowFail) throw new Error(`${op} ${JSON.stringify(args)}: ${r.err}`);
    return r;
  }
  return {
    cmd,
    output: () => out,
    async stop() {
      try { await cmd('done', {}, 15000); } catch { /* already gone */ }
      await new Promise((r) => { if (proc.exitCode != null) return r(); const t = setTimeout(() => { proc.kill('SIGTERM'); r(); }, 20000); proc.once('exit', () => { clearTimeout(t); r(); }); });
    },
  };
}
