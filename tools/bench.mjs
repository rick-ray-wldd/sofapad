// Latency bench from inside the real phone page (headless Chrome, iPhone size) against a running pkm-server.
//   node tools/bench.mjs --url http://HOST:PORT/ --code 123456
import { chromium } from 'playwright-core';

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => (v.startsWith('--') ? [...a, [v.slice(2), arr[i + 1]]] : a), []));
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'zh-TW', colorScheme: 'dark' });
const page = await ctx.newPage();
await page.goto(args.url + '#pair=' + args.code);
await page.waitForFunction(() => document.getElementById('dot').classList.contains('ready'));

const result = await page.evaluate(async () => {
  const ws = window.pkmLink.ws;
  const stats = (xs) => {
    const s = [...xs].sort((a, b) => a - b);
    const q = (p) => s[Math.min(s.length - 1, Math.floor(p * s.length))];
    return { n: s.length, p50: +q(0.5).toFixed(3), p95: +q(0.95).toFixed(3), p99: +q(0.99).toFixed(3), max: +s[s.length - 1].toFixed(3) };
  };
  const waitFor = (pred) => new Promise((resolve) => {
    const h = (ev) => { const m = JSON.parse(ev.data); if (pred(m)) { ws.removeEventListener('message', h); resolve(m); } };
    ws.addEventListener('message', h);
  });
  const out = {};

  // 1. ping → pong round trip (no injection)
  const rtt = [], srvPing = [];
  for (let i = 0; i < 300; i++) {
    const ts = performance.now() + i * 1e-6;
    const p = waitFor((m) => m.t === 'pong' && m.ts === ts);
    ws.send(JSON.stringify({ t: 'ping', ts }));
    const m = await p;
    rtt.push(performance.now() - ts);
    srvPing.push(m.us / 1000);
  }
  out.ping_rtt_ms = stats(rtt);

  // 2. text "你好" → CGEvents built (4 events) → ack
  const tl = [], srvText = [];
  for (let i = 0; i < 200; i++) {
    const id = 100000 + i;
    const t0 = performance.now();
    const p = waitFor((m) => m.t === 'ack' && m.id === id);
    ws.send(JSON.stringify({ t: 'text', id, s: '你好' }));
    const m = await p;
    tl.push(performance.now() - t0);
    srvText.push(m.us / 1000);
  }
  out.text_ack_ms = stats(tl);
  out.text_server_ms = stats(srvText);

  // 3. key ⌘C (includes the 2 × 12 ms modifier pauses by design)
  const kl = [];
  for (let i = 0; i < 20; i++) {
    const id = 200000 + i;
    const t0 = performance.now();
    const p = waitFor((m) => m.t === 'ack' && m.id === id);
    ws.send(JSON.stringify({ t: 'key', id, k: 'c', mods: ['cmd'] }));
    await p;
    kl.push(performance.now() - t0);
  }
  out.shortcut_ack_ms = stats(kl);

  // 4. burst: 1000 moves back-to-back, then a ping; time until it comes back = drain time
  const t0 = performance.now();
  for (let i = 0; i < 1000; i++) ws.send(JSON.stringify({ t: 'move', dx: 0.5, dy: 0 }));
  const ts = performance.now();
  const p = waitFor((m) => m.t === 'pong' && m.ts === ts);
  ws.send(JSON.stringify({ t: 'ping', ts }));
  await p;
  const drain = performance.now() - t0;
  out.burst_1000_moves = { total_ms: +drain.toFixed(2), per_move_us: +((drain * 1000) / 1000).toFixed(1), moves_per_s: Math.round(1000 / (drain / 1000)) };
  return out;
});
console.log(JSON.stringify({ url: args.url, ...result }, null, 1));
await browser.close();
