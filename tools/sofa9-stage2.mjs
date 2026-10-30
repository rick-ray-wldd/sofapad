// SOFA-9 追加 1／3／4: demo/playground.html in both languages and both modes, at the page level (no server).
//   full (default): 7 stages, stage 2 with four boxes; the English page's live sentence is English and checked word by
//     word, swipe typing allowed (a space after each word, a capital, a space or period at the end; a word picked
//     wrong is named); the Chinese page keeps its Chinese sentence, character by character.
//   video (?video=1, or the meta tag in a copy): stages 1, 2, 5, 6, 7 shown as 1–5; stage 2 = English live + dictation.
// Text goes in the way the Mac types what SofaPad sends: one key event per character, Backspace for a deletion.
//   node tools/sofa9-stage2.mjs   (screenshots: design/screenshots/v4/playground-{en,zh}.png for the READMEs and
//                                  sofa9-*.png; results: design/evidence/sofa9/stage2-check.json)
import { chromium } from 'playwright-core';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT } from './test-server.mjs';

const shots = join(ROOT, 'design/screenshots/v4');
const evDir = join(ROOT, 'design/evidence/sofa9');
mkdirSync(evDir, { recursive: true });
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok: !!ok, detail: String(detail) });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok ? '' : '  → ' + detail}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const file = join(ROOT, 'demo/playground.html');
const CJK = /[一-鿿]/;

const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('pageerror', (e) => check('no page error', false, e.message));
  // through a blank page each time: the same URL with only the hash changed would not reload
  const open = async (q, f = pathToFileURL(file).href) => { await page.goto('about:blank'); await page.goto(f + q); };
  const where = () => { const u = new URL(page.url()); return u.search + u.hash; };   // no local paths in the results
  const state = () => page.evaluate(() => window.playground.state());
  const texts = () => page.evaluate(() => window.playground.texts);
  const statusOf = (sel) => page.$eval(sel, (e) => e.textContent);
  const typeInto = async (sel, text) => {
    await page.click(sel);
    await page.keyboard.press('End');   // the Mac types where its cursor is: at the end of what came before
    for (const ch of text) await page.keyboard.insertText(ch);
    await sleep(80);
  };
  const backspace = async (n) => { for (let i = 0; i < n; i++) await page.keyboard.press('Backspace'); await sleep(80); };
  const clear = (sel) => page.$eval(sel, (e) => { e.value = ''; e.dispatchEvent(new InputEvent('input', { bubbles: true })); });
  const visibleText = () => page.evaluate(() => {
    const out = [];
    const walk = (n) => {
      if (n.nodeType === 3) { if (n.parentElement && n.parentElement.offsetParent !== null) out.push(n.textContent); return; }
      if (n.nodeType === 1 && getComputedStyle(n).display === 'none') return;
      for (const c of n.childNodes) walk(c);
    };
    walk(document.body);
    return out.join(' ');
  });

  // ---- full, English (the default) ----
  await open('#stage=2');
  let st = await state();
  check('預設英文、完整版', st.lang === 'en' && st.mode === 'full' && (await page.getAttribute('html', 'lang')) === 'en', `${st.lang} ${st.mode}`);
  check('完整版：7 關、第 2 關四格（即時、整段、注音、聽寫），共 30 項', Object.keys(st.stages).length === 7 && JSON.stringify(Object.keys(st.stages['2'].checks)) === '["live","buffer","zhuyin","dictation"]' && st.total.all === 30, JSON.stringify(st.total));
  let tx = await texts();
  check('英文版：即時是英文句、逐字比對', tx.liveCheck === 'words' && /^[A-Za-z ]+$/.test(tx.live), tx.live);
  const words = tx.live.split(' ');
  await typeInto('#s2-live', `${words[0]} ${words[1]} tyre `);
  const wrong = await statusOf('#s2-live-status');
  check('滑錯字：說出第 3 個字、打成 tyre、應該是哪個字', /3/.test(wrong) && /tyre/.test(wrong) && wrong.includes(words[2]) && !(await state()).stages['2'].checks.live, wrong);
  check('滑錯字：目標句裡那個字標紅', (await page.$$eval('#s2-live-target .miss', (e) => e.map((x) => x.textContent))).join() === words[2]);
  await page.screenshot({ path: join(shots, 'sofa9-stage2-en-wrong-word.png') });
  await backspace(5);
  await typeInto('#s2-live', `${words.slice(2).join(' ')} `);
  check('滑動輸入（每個字後自動空格、句尾空格）：打勾', (await state()).stages['2'].checks.live, await statusOf('#s2-live-status'));
  for (const [label, text] of [['全部小寫、句尾句點', tx.live.toLowerCase() + '.'], ['多個空格、中間大寫', tx.live.replace(' ', '  ').replace('sofa', 'Sofa')]]) {
    await open('?x=1#stage=2');
    await typeInto('#s2-live', text);
    check(`容忍：${label}`, (await state()).stages['2'].checks.live, await statusOf('#s2-live-status'));
  }
  await open('?x=2#stage=2');
  await typeInto('#s2-dictation', "It is a nice day, let's go for a walk in the park");
  check('英文聽寫：打勾', (await state()).stages['2'].checks.dictation, await statusOf('#s2-dictation-status'));
  await clear('#s2-dictation');
  await typeInto('#s2-dictation', 'it is a nice day it is a nice day');
  const dbl = await statusOf('#s2-dictation-status');
  check('英文疊字：抓得到，說出重複的那一段', /it is a/.test(dbl), dbl);
  for (const sid of ['1', '2', '3', '4', '5', '6', '7', 'summary']) {
    await page.evaluate((n) => window.playground.go(n), sid);
    await sleep(120);
    const cjk = [...(await visibleText())].filter((c) => CJK.test(c)).join('');
    // allowed on the English page: the Zhuyin box's Chinese target and the phone app's own Chinese labels
    check(`英文版第 ${sid} 關：畫面上的中文只剩刻意保留的（≤ 40 字）`, cjk.length <= 40, cjk);
  }

  // ---- full, Chinese ----
  await open('?lang=zh#stage=2');
  st = await state();
  tx = await texts();
  check('?lang=zh：中文、完整版 30 項', st.lang === 'zh' && st.mode === 'full' && st.total.all === 30, `${st.lang} ${st.total.all}`);
  check('中文版：即時是原本的中文句、逐字元比對', tx.liveCheck === 'chars' && CJK.test(tx.live), tx.live);
  await typeInto('#s2-live', tx.live);
  check('中文版即時：打對了', (await state()).stages['2'].checks.live, await statusOf('#s2-live-status'));
  await typeInto('#s2-dictation', '今天天氣很好，我們去公園散步');
  check('中文聽寫：打勾', (await state()).stages['2'].checks.dictation);
  check('中文版第 4 關錯字句是中文，wrong 就在 at 的位置', CJK.test(tx.typo.sentence) && tx.typo.sentence.slice(tx.typo.at, tx.typo.at + tx.typo.wrong.length) === tx.typo.wrong, JSON.stringify(tx.typo));
  await page.click('#btn-lang');
  await sleep(200);
  const en = await texts();
  check('語言按鈕：換成英文、網址拿掉 lang、第 4 關錯字句換成英文', (await state()).lang === 'en' && !new URL(page.url()).searchParams.has('lang') && !CJK.test(en.typo.sentence) && en.typo.sentence.slice(en.typo.at, en.typo.at + en.typo.wrong.length) === en.typo.wrong, `${where()} ${JSON.stringify(en.typo)}`);
  check('換語言後進度還在', (await state()).stages['2'].checks.live);

  // ---- video mode ----
  for (const lang of ['en', 'zh']) {
    await open(`?video=1&lang=${lang}&rec=1#stage=2`);
    st = await state();
    tx = await texts();
    const ids = Object.keys(st.stages);
    check(`精簡版（${lang}）：第 1、2、5、6、7 關，畫面編號 1–5`, JSON.stringify(ids) === '["1","2","5","6","7"]' && JSON.stringify(ids.map((i) => st.stages[i].no)) === '[1,2,3,4,5]', JSON.stringify(ids.map((i) => [i, st.stages[i].no])));
    check(`精簡版（${lang}）：第 2 關只有即時和聽寫，即時是英文句`, JSON.stringify(Object.keys(st.stages['2'].checks)) === '["live","dictation"]' && tx.liveCheck === 'words', tx.live);
    check(`精簡版（${lang}）：總數只算這 5 關（21 項）`, st.total.all === 21, String(st.total.all));
    check(`精簡版（${lang}）：整段、注音不在畫面上；聽寫標 ②`, !(await page.isVisible('#s2-buffer')) && !(await page.isVisible('#s2-zhuyin')) && (await page.textContent('#s2-dictation-no')).trim() === '②');
    const badge = await page.textContent('#rec-badge');
    check(`精簡版（${lang}）：錄影標籤寫第 2 關`, /2/.test(badge), badge);
    await typeInto('#s2-live', tx.live + ' ');
    await typeInto('#s2-dictation', lang === 'zh' ? '今天天氣很好，我們去公園散步' : "It is a nice day, let's go for a walk in the park");
    check(`精簡版（${lang}）：兩項做完，「下一關」出現`, (await state()).stages['2'].done && await page.isVisible('#btn-next'));
    await page.screenshot({ path: join(shots, `sofa9-video-stage2-${lang}.png`) });
    await page.evaluate(() => window.playground.go('5'));
    await sleep(100);
    const badge5 = await page.textContent('#rec-badge');
    check(`精簡版（${lang}）：第 5 關（快捷鍵）畫面上是第 3 關`, /3/.test(badge5) && !/5/.test(badge5), badge5);
    check(`精簡版（${lang}）：去不了第 3、4 關`, !(await page.evaluate(() => window.playground.go('3'))) && !(await page.evaluate(() => window.playground.go('4'))));
  }
  await open('?video=1&rec=1');
  await page.click('#btn-lang');
  await sleep(150);
  check('精簡版換語言：網址保留 video=1 和 rec=1', new URL(page.url()).searchParams.get('video') === '1' && new URL(page.url()).searchParams.get('rec') === '1', where());
  // a copy with the meta tag flipped opens in video mode (what the test kit and the zip get)
  const copy = join(tmpdir(), 'sofapad-playground-video-copy.html');
  writeFileSync(copy, readFileSync(file, 'utf8').replace('<meta name="playground-mode" content="full">', '<meta name="playground-mode" content="video">'));
  await open('', pathToFileURL(copy).href);
  check('meta 改成 video 的副本：一打開就是精簡版', (await state()).mode === 'video');
  await open('?video=0', pathToFileURL(copy).href);
  check('副本加 ?video=0：回到完整版', (await state()).mode === 'full');

  // ---- README screenshots: recording mode, stage 1 with some checks ticked by real mouse events ----
  for (const lang of ['en', 'zh']) {
    await open(`?rec=1${lang === 'zh' ? '&lang=zh' : ''}#stage=1`);
    await page.mouse.move(200, 400);
    for (let i = 0; i < 40; i++) await page.mouse.move(i % 2 ? 200 : 1000, 300 + i * 4, { steps: 4 });
    await page.click('#s1-click');
    await page.click('#s1-rc', { button: 'right' });
    await sleep(150);
    if (await page.isVisible('#s1-menu-like')) await page.click('#s1-menu-like');
    await page.mouse.move(1200, 780);
    await sleep(300);
    const done = Object.values((await state()).stages['1'].checks).filter(Boolean).length;
    check(`README 截圖（${lang}）：第 1 關亮了 3 個以上的勾`, done >= 3, String(done));
    await page.screenshot({ path: join(shots, `playground-${lang}.png`) });
  }
} finally {
  await browser.close();
}
const failed = results.filter((r) => !r.ok).length;
writeFileSync(join(evDir, 'stage2-check.json'), JSON.stringify(results, null, 1));
console.log(`${results.length - failed}/${results.length} ${failed ? 'FAIL' : 'PASS'}`);
process.exitCode = failed ? 1 : 0;
