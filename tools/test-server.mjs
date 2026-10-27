// Starts pkm-server --dry-run on 127.0.0.1 for browser tests (nothing is posted to the Mac).
// The caller must `await server.stop()`; the port closes with the process.
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

export async function startServer({ webRoot = join(ROOT, 'web'), env = {} } = {}) {
  const state = mkdtempSync(join(tmpdir(), 'pkm-test-'));
  const port = 30000 + Math.floor(Math.random() * 10000);
  const proc = spawn(join(ROOT, 'mac/.build/debug/pkm-server'),
    ['--dry-run', '--no-ui', '--bind', '127.0.0.1', '--port', String(port), '--state-dir', state, '--web-root', webRoot],
    { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, ...env } });
  let log = '';
  const code = await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('server did not print a pairing code')), 8000);
    const on = (d) => {
      log += d;
      const m = /配對碼：(\d{6})/.exec(log);
      if (m) { clearTimeout(t); resolve(m[1]); }
    };
    proc.stdout.on('data', on);
    proc.stderr.on('data', on);
  });
  return {
    url: `http://127.0.0.1:${port}/`, code, port, state,
    log: () => log,
    pause: () => proc.kill('SIGSTOP'),    // the Mac stops answering (half-open connection), PKM-4
    resume: () => proc.kill('SIGCONT'),
    stop: () => new Promise((r) => { if (proc.exitCode != null) return r(); proc.once('exit', r); proc.kill('SIGCONT'); proc.kill('SIGTERM'); }),
  };
}

export const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
// iPhone 14 safe areas (S-104): portrait top 47 / bottom 34; landscape left/right 47, bottom 21.
export const INSETS = { portrait: { top: 47, bottom: 34, left: 0, right: 0 }, landscape: { top: 0, bottom: 21, left: 47, right: 47 } };
