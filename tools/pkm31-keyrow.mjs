// PKM-3-1 ② the editable key row, in a real page (headless Chrome, dry-run Mac — nothing is injected):
// open the editor from ✎, remove a key, add ⌘C from the list, drag it to the front with a real touch drag,
// use it, add a new custom button, reload (saved), restore the default; portrait and landscape; pad size unchanged.
//   node tools/pkm31-keyrow.mjs
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { startServer, ROOT, IPHONE_UA, INSETS } from './test-server.mjs';

const shotsDir = join(ROOT, 'design/screenshots/v3');
mkdirSync(shotsDir, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok ? '' : '  → ' + detail}`);
};

const server = await startServer();
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, locale: 'zh-TW', colorScheme: 'dark', userAgent: IPHONE_UA });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('PAGE ERROR ' + e.message));
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: INSETS.portrait });
  await page.goto(server.url + '#pair=' + server.code);
  await page.waitForFunction(() => document.getElementById('dot').classList.contains('ready'));
  const record = () => page.evaluate(() => {
    window.__sent = [];
    for (const fn of ['send', 'sendReliable']) {
      const orig = window.pkmLink[fn].bind(window.pkmLink);
      window.pkmLink[fn] = (m) => { if (m.t !== 'ping') window.__sent.push(m); return orig(m); };
    }
  });
  await record();
  const row = () => page.evaluate(() => [...document.querySelectorAll('#keyStrip button')].map((b) => b.textContent.trim()));
  const padSize = () => page.evaluate(() => { const r = document.getElementById('pad').getBoundingClientRect(); return `${Math.round(r.width)}×${Math.round(r.height)}`; });
  const padBefore = await padSize();

  // SOFA-8 (D-47): ⏎ moved next to the cursor pad in the input row; ⇧ 選取 is the first (editable) key
  check('預設：即時、⌘ 快捷鍵、⇧ 選取、esc…⌦（⏎ 在輸入列），最後是 ✎ 編輯', JSON.stringify(await row()) === JSON.stringify(['即時', '⌘ 快捷鍵', '⇧ 選取', 'esc', 'tab', '⌫', '←', '↑', '↓', '→', '⌘', '⌥', '⌃', '⇧', 'space', '⌦', '✎ 編輯']), JSON.stringify(await row()));

  // open from ✎ at the end of the row (scroll there first, like Ray would)
  await page.evaluate(() => { const s = document.getElementById('keyStrip'); s.scrollLeft = s.scrollWidth; });
  await sleep(150);
  await page.tap('#keyStrip .row-edit');
  await sleep(200);
  check('按鍵列最後的 ✎ 打開編輯畫面', await page.evaluate(() => !document.getElementById('rowSheet').hidden));
  await page.screenshot({ path: join(shotsDir, 'pkm31-keyrow-editor-portrait.png') });

  // remove esc, add ⌘C (拷貝) and ⇧⌘4 (截圖) from the list
  await page.click('#rowCurrent li[data-id="k:escape"] button[aria-label="移除"]');
  await page.click('#rowCatalog button[data-id="c:cmd+c"]');
  await page.click('#rowCatalog button[data-id="c:shift,cmd+4"]');
  await sleep(100);
  let ids = await page.evaluate(() => [...document.querySelectorAll('#rowCurrent li[data-id]')].map((li) => li.dataset.id));
  check('移除 esc、從清單加 ⌘C 和 ⇧⌘4（加在最後）', !ids.includes('k:escape') && ids.at(-2) === 'c:cmd+c' && ids.at(-1) === 'c:shift,cmd+4', JSON.stringify(ids));
  check('清單裡已經在按鍵列上的鍵標成已選', await page.evaluate(() => document.querySelector('#rowCatalog button[data-id="c:cmd+c"]').getAttribute('aria-pressed') === 'true'));

  // drag ⌘C's ≡ to the top with a real touch drag: from where it is on screen up to the editor's top edge, and
  // hold there while the list scrolls (auto-scroll)
  await page.evaluate(() => document.querySelector('#rowCurrent li[data-id="c:cmd+c"]').scrollIntoView({ block: 'center' }));
  await sleep(100);
  const pt = async (sel) => page.evaluate((s) => { const r = document.querySelector(s).getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }, sel);
  const from = await pt('#rowCurrent li[data-id="c:cmd+c"] .handle');
  const top = await page.evaluate(() => document.querySelector('#rowSheet .sheet-card').getBoundingClientRect().top + 20);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: from.x, y: from.y, id: 1 }] });
  for (let i = 1; i <= 20; i++) {
    await sleep(16);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: from.x, y: from.y + (top - from.y) * (i / 20), id: 1 }] });
  }
  for (let i = 0; i < 80; i++) {
    await sleep(16);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: from.x, y: top + (i % 2), id: 1 }] });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await sleep(200);
  ids = await page.evaluate(() => [...document.querySelectorAll('#rowCurrent li[data-id]')].map((li) => li.dataset.id));
  check('按住 ≡ 拖曳：⌘C 拖到最前面', ids[0] === 'c:cmd+c', JSON.stringify(ids));

  // new custom button from here (reuses the custom shortcut editor), goes straight onto the row
  await page.click('#rowAddCustom');
  await sleep(150);
  await page.fill('#scLabel', '我的放大');
  for (const m of ['opt', 'cmd']) {   // the form may start with ⌘ already picked
    const on = await page.getAttribute(`#shortcutForm button[data-pick="${m}"]`, 'aria-pressed');
    if (on !== 'true') await page.click(`#shortcutForm button[data-pick="${m}"]`);
  }
  await page.selectOption('#scKey', 'k');
  await page.click('#scSave');
  await sleep(200);
  ids = await page.evaluate(() => [...document.querySelectorAll('#rowCurrent li[data-id]')].map((li) => li.dataset.id));
  const msg = await page.textContent('#rowMsg');
  check('「＋ 新增自訂按鈕」：沿用自訂快捷鍵的編輯器，存好就加到按鍵列', ids.at(-1).startsWith('u:') && /⌥⌘K/.test(msg) && await page.evaluate(() => document.getElementById('editorSheet').hidden), JSON.stringify({ ids, msg }));
  await page.screenshot({ path: join(shotsDir, 'pkm31-keyrow-editor-edited.png') });
  await page.click('#rowDone');
  await sleep(150);
  const edited = await row();
  // SOFA-8: the fixed keys are 即時 and ⌘ 快捷鍵 only, so the first edited key is at [2]
  check('按鍵列照編輯的順序：⌘C 在固定鍵後面第一個，esc 不見，最後是 ⌥⌘K 和 ✎', edited[2] === '⌘C' && !edited.includes('esc') && edited.at(-2) === '⌥⌘K' && edited.at(-1) === '✎ 編輯', JSON.stringify(edited));
  await page.screenshot({ path: join(shotsDir, 'pkm31-keyrow-row-edited.png') });

  // use the new buttons
  await page.evaluate(() => { window.__sent = []; document.getElementById('keyStrip').scrollLeft = 0; });
  await page.tap('#keyStrip button[data-id="c:cmd+c"]');
  await sleep(150);
  await page.evaluate(() => { const s = document.getElementById('keyStrip'); s.scrollLeft = s.scrollWidth; });
  await sleep(150);
  await page.tap('#keyStrip button[data-id^="u:"]');
  await sleep(200);
  const sent = await page.evaluate(() => window.__sent.filter((m) => m.t === 'key').map((m) => `${m.mods.join('+')}+${m.k}`));
  check('點新的鍵：⌘C 送 cmd+c、⌥⌘K 送 opt+cmd+k', JSON.stringify(sent) === '["cmd+c","opt+cmd+k"]', JSON.stringify(sent));

  // saved on the phone
  await page.reload();
  await page.waitForFunction(() => document.getElementById('dot').classList.contains('ready'));
  check('重新整理後按鍵列還是編輯過的樣子（存在手機）', JSON.stringify(await row()) === JSON.stringify(edited), JSON.stringify(await row()));

  // landscape: the row editor is usable and the pad keeps its size while typing
  await page.setViewportSize({ width: 844, height: 390 });
  await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: INSETS.landscape });
  await sleep(300);
  // SOFA-8 (D-48): landscape opens with the side panel; collapsed (‹) it is the full-screen pad checked here
  await page.tap('#sideClose');
  await sleep(200);
  const padLand = await padSize();
  check('橫拿：觸控板仍是全螢幕（按鍵列改過不影響）', padLand === '844×390', padLand);
  await page.tap('#fabKeyboard');
  await sleep(300);
  const typingPad = await padSize();
  const rowBox = await page.evaluate(() => { const r = document.getElementById('keyStrip').getBoundingClientRect(); const p = document.getElementById('pad').getBoundingClientRect(); return { rowRight: Math.round(r.right), rowTop: Math.round(r.top), padLeft: Math.round(p.left), padBottom: Math.round(p.bottom) }; });
  // SOFA-8: the key row is in the side panel next to the pad now (was: under it)
  check('橫拿打字：按鍵列在側欄，不蓋住觸控板', rowBox.rowRight <= rowBox.padLeft, JSON.stringify({ typingPad, ...rowBox }));
  await page.tap('#sideCells .row-edit');   // SOFA-8: in landscape ✎ is at the end of the side panel's grid
  await sleep(250);
  const landOK = await page.evaluate(() => { const c = document.querySelector('#rowSheet .sheet-card').getBoundingClientRect(); return !document.getElementById('rowSheet').hidden && c.width > 600; });
  check('橫拿：編輯畫面打開、用寬版排列', landOK);
  await page.screenshot({ path: join(shotsDir, 'pkm31-keyrow-editor-landscape.png') });

  // restore the default
  await page.click('#rowReset');
  await sleep(150);
  await page.click('#rowDone');
  await sleep(150);
  const back = await row();
  check('恢復預設：回到預設的按鍵列（4.3：⏎ 在輸入列；自訂快捷鍵本身還在）', back.slice(3, 16).join(' ') === 'esc tab ⌫ ← ↑ ↓ → ⌘ ⌥ ⌃ ⇧ space ⌦' && await page.evaluate(() => JSON.parse(localStorage.getItem('pkm.shortcuts') || localStorage.getItem('shortcuts') || '{"items":[]}').items?.length !== 0), JSON.stringify(back));
  await page.setViewportSize({ width: 390, height: 844 });
  await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: INSETS.portrait });
  await sleep(300);
  check('直拿：觸控板大小和改之前一樣', (await padSize()) === padBefore, `${padBefore} → ${await padSize()}`);
  await ctx.close();
} finally {
  await browser.close();
  await server.stop();
}
writeFileSync(join(ROOT, 'design/evidence/pkm31-keyrow.json'), JSON.stringify(results, null, 1));
console.log(`${results.filter((r) => r.ok).length}/${results.length} PASS`);
