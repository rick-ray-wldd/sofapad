// Phone-size screenshots of the real page served by pkm-server (run the server with --dry-run).
//   node tools/screenshots.mjs --url http://127.0.0.1:PORT/ --code 123456 --out design/screenshots
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => (v.startsWith('--') ? [...a, [v.slice(2), arr[i + 1]]] : a), []));
const out = args.out;
mkdirSync(out, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const shots = [];

async function phone(width, height) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, locale: 'zh-TW', colorScheme: 'dark', userAgent: UA });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  return { ctx, page, cdp };
}
async function shot(page, name, note) {
  const path = `${out}/${name}.png`;
  await page.screenshot({ path });
  shots.push({ name, note });
}

// 1. Pairing sheet (first visit, no token)
{
  const { ctx, page } = await phone(390, 844);
  await page.goto(args.url);
  await page.waitForSelector('#pairSheet:not([hidden])');
  await page.fill('#codeInput', '12');
  await shot(page, '01-portrait-pairing', '第一次打開：輸入 Mac 上的 6 位數配對碼，或請 Mac 顯示配對碼');
  await ctx.close();
}

// 2–6. Paired, portrait and landscape
{
  const { ctx, page, cdp } = await phone(390, 844);
  await page.goto(args.url + '#pair=' + args.code);
  await page.waitForFunction(() => document.getElementById('dot').classList.contains('ready'));
  await sleep(2300); // first RTT sample
  await shot(page, '02-portrait-main', '直拿：觸控板（右側捲動條）＋迷你地圖＋左鍵／拖曳鎖定／右鍵＋文字框＋特殊鍵');

  // touching + long-press drag state
  const pad = await page.evaluate(() => { const r = document.getElementById('pad').getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: pad.x + pad.w * 0.4, y: pad.y + pad.h * 0.5, id: 1 }] });
  await sleep(600);
  await shot(page, '03-portrait-long-press-drag', '長按 450 ms 後進入拖曳（藍框＋「拖曳中」）');
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await sleep(200);

  // typing: composition shown in the box, sticky ⌘ armed, shortcuts open
  await page.focus('#input');
  await cdp.send('Input.imeSetComposition', { text: '今天ㄏㄨㄟˋ', selectionStart: 6, selectionEnd: 6 });
  await page.evaluate(() => document.querySelector('button[data-mod="cmd"]').classList.add('armed'));
  await page.evaluate(() => { document.getElementById('shortcutPanel').hidden = false; });
  await shot(page, '04-portrait-typing-shortcuts', '打字：注音組字中（還沒送出）、⌘ 已預備、快捷鍵面板展開');
  await cdp.send('Input.insertText', { text: '今天會議' });
  await page.evaluate(() => { document.getElementById('shortcutPanel').hidden = true; document.querySelector('button[data-mod="cmd"]').classList.remove('armed'); });

  // simulated phone keyboard: shrink the viewport like iOS does
  await page.setViewportSize({ width: 390, height: 844 - 336 });
  await sleep(300);
  await shot(page, '05-portrait-keyboard-open', '手機鍵盤打開時（模擬可視區縮成 508 px）：觸控板仍可用，迷你地圖暫時隱藏');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => document.activeElement.blur());

  // settings
  await page.click('#settingsBtn');
  await shot(page, '06-portrait-settings', '設定：游標速度、加速度、捲動速度、反向捲動、左手模式、長按拖曳、迷你地圖、觸覺回饋');
  await page.click('#closeSettings');

  // landscape
  await page.setViewportSize({ width: 844, height: 390 });
  await sleep(400);
  await shot(page, '07-landscape-main', '橫拿：左邊控制區、右邊大觸控板');
  await page.evaluate(() => { document.getElementById('app').classList.add('lefty'); });
  await sleep(200);
  await shot(page, '08-landscape-lefthand', '橫拿＋左手模式：觸控板和捲動條換到左邊');
  await page.evaluate(() => { document.getElementById('app').classList.remove('lefty'); });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => { window.pkmLink.stop(); window.pkmLink.setState('offline', {}); });
  await sleep(300);
  await shot(page, '09-portrait-offline', '斷線時：紅點＋提示，自動重連');
  await page.evaluate(() => { window.pkmLink.setState('ready', { host: 'Mac mini', perm: false }); });
  await sleep(200);
  await shot(page, '10-portrait-no-permission', 'Mac 還沒開輔助使用權限：紅色提示＋開權限路徑');
  await ctx.close();
}

// app icon for "Add to Home Screen"
{
  const ctx = await browser.newContext({ viewport: { width: 180, height: 180 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.goto(args.url + 'icon.svg');
  await page.screenshot({ path: args.icon || 'web/icon-180.png', omitBackground: true });
  await ctx.close();
}
await browser.close();
console.log(JSON.stringify(shots, null, 1));
