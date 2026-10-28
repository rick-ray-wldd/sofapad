// PKM-4 in a real page (headless Chrome, dry-run Mac — nothing is injected): no 🎤 anywhere, the version line,
// undo/redo blocked in the box, text typed while the Mac does not answer is never sent later, the link notices a
// silent connection and reconnects, 整段 keeps the text when offline.
//   node tools/pkm4-browser.mjs
import { chromium } from 'playwright-core';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { startServer, ROOT, IPHONE_UA, INSETS } from './test-server.mjs';

const shots = join(ROOT, 'design/screenshots/v4');
mkdirSync(shots, { recursive: true });
mkdirSync(join(ROOT, 'design/evidence/pkm4'), { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok ? '' : '  → ' + detail}`);
};

const server = await startServer();
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: IPHONE_UA });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('PAGE ERROR ' + e.message));
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: INSETS.portrait });
  await page.goto(server.url + '#pair=' + server.code);
  await page.waitForFunction(() => document.getElementById('dot').classList.contains('ready'));
  await page.evaluate(() => {
    window.__sent = [];
    const orig = window.pkmLink.raw.bind(window.pkmLink);
    window.pkmLink.raw = (m) => { if (m.t !== 'ping') window.__sent.push(m); return orig(m); };
  });
  const texts = () => page.evaluate(() => window.__sent.filter((m) => m.t === 'text').map((m) => m.s));
  const banner = () => page.evaluate(() => document.getElementById('banner').textContent);

  check('沒有 🎤 語音鍵（直拿、橫拿浮動列都沒有），也沒有語音預覽框', await page.evaluate(() =>
    !document.getElementById('micBtn') && !document.getElementById('fabMic') && !document.getElementById('voiceSheet') && !document.body.textContent.includes('語音')));

  await page.tap('#settingsBtn');
  await sleep(200);
  const ver = await page.textContent('#versionLine');
  const v = readFileSync(join(ROOT, 'VERSION'), 'utf8').trim();
  check('⚙︎ 最上面顯示網頁和 Mac App 的版本、建置時間', ver.includes(`網頁 ${v}（開發版）・Mac App ${v}（開發版）`), ver);
  await page.screenshot({ path: join(shots, 'pkm4-settings-version.png') });
  await page.tap('#closeSettings');

  // undo / redo in the box: blocked, nothing goes to the Mac again
  await page.focus('#input');
  await page.keyboard.type('hello orca ');
  await sleep(300);
  await page.keyboard.press('Enter');
  await sleep(300);
  await page.evaluate(() => { window.__sent = []; });
  const undone = await page.evaluate(() => { document.getElementById('input').focus(); document.execCommand('undo'); document.execCommand('redo'); return document.getElementById('input').value; });
  await sleep(500);
  check('送出（Enter）後按還原／重做：輸入框不會回來舊字、Mac 什麼都沒收到', undone === '' && (await texts()).length === 0, JSON.stringify({ undone, sent: await texts() }));
  check('還原被擋時，手機上方說明原因', /不能「還原／重做」/.test(await banner()), await banner());

  // the Mac stops answering (paused): the phone notices within ~4.5 s, says it is reconnecting
  await page.evaluate(() => { window.__sent = []; });
  server.pause();
  const t0 = Date.now();
  await page.waitForFunction(() => !document.getElementById('dot').classList.contains('ready'), null, { timeout: 10000 });
  const noticed = Date.now() - t0;
  check('Mac 不回應（連線卡住）：手機 6 秒內發現、顯示重新連線中', noticed < 6500, `${noticed} ms`);
  await page.screenshot({ path: join(shots, 'pkm4-reconnecting.png') });
  // typing while it is down: stays on the phone, never sent later
  await page.keyboard.type('lost while offline');
  await sleep(300);
  server.resume();
  await page.waitForFunction(() => document.getElementById('dot').classList.contains('ready'), null, { timeout: 10000 });
  const back = Date.now() - t0;
  await sleep(800);
  const after = await texts();
  check('Mac 恢復後自動連上，斷線時打的字沒有補送', !after.some((s) => s.includes('lost')), JSON.stringify(after));
  check('連上後告訴 Ray：斷線時打的字沒送到、輸入框清空', /沒有送到 Mac/.test(await banner()) && (await page.inputValue('#input')) === '', await banner());
  await page.screenshot({ path: join(shots, 'pkm4-reconnected-not-sent.png') });
  results.push({ name: 'timing', noticedMs: noticed, readyAgainMs: back });

  // 整段 + 送出 while offline: the text stays in the box
  await page.tap('#modeBtn');
  await sleep(200);
  await page.fill('#input', '整段離線測試');
  server.pause();
  await page.waitForFunction(() => !document.getElementById('dot').classList.contains('ready'), null, { timeout: 10000 });
  await page.evaluate(() => { window.__sent = []; });
  await page.tap('#sendBtn');
  await sleep(300);
  check('整段模式、沒連上時按送出：字留在輸入框，什麼都不送', (await page.inputValue('#input')) === '整段離線測試' && (await texts()).length === 0, await page.inputValue('#input'));
  server.resume();
  await page.waitForFunction(() => document.getElementById('dot').classList.contains('ready'), null, { timeout: 10000 });
  await sleep(500);
  check('連上後也不會自己送出（要 Ray 再按一次送出）', (await texts()).length === 0, JSON.stringify(await texts()));
  await page.tap('#sendBtn');
  await sleep(300);
  check('再按送出才送', JSON.stringify(await texts()) === JSON.stringify(['整段離線測試']), JSON.stringify(await texts()));
  await ctx.close();
} finally {
  await browser.close();
  await server.stop();
}
writeFileSync(join(ROOT, 'design/evidence/pkm4/pkm4-browser.json'), JSON.stringify(results, null, 1));
console.log(`${results.filter((r) => r.ok).length}/${results.filter((r) => 'ok' in r).length} PASS`);
