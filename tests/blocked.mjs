import { chromium, devices } from 'playwright';
const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['iPhone 13'] });
let ok = true;
for (const [port, expectWarn] of [[8766,true],[8765,false]]) {
  const page = await ctx.newPage();
  await page.goto(`http://127.0.0.1:${port}/`);
  await page.waitForSelector('#pinSheet:not([hidden])');
  await page.fill('#pin','123456'); await page.click('#pinOk');
  await page.waitForFunction(() => document.querySelector('#dot').classList.contains('ok'));
  await page.waitForTimeout(200);
  const shown = await page.isVisible('#axWarn');
  const pass = shown === expectWarn; ok = ok && pass;
  console.log((pass?'PASS':'FAIL')+` port ${port}: warning ${shown?'shown':'hidden'} (expected ${expectWarn?'shown':'hidden'})`);
  if (port===8766) await page.screenshot({path:'blocked.png'});
  if (port===8766) { await page.tap('#axRetry'); await page.waitForTimeout(300); const still = await page.isVisible('#axWarn'); console.log((still?'PASS':'FAIL')+' retry keeps warning while still blocked'); ok = ok && still; }
}
await browser.close();
console.log(ok?'blocked-banner tests passed':'blocked-banner tests FAILED');
