import { chromium, devices } from 'playwright';
import fs from 'fs';
const LOG = process.argv[2];
const results = [];
function check(name, ok, info='') { results.push([name, ok, info]); console.log((ok?'PASS':'FAIL')+' '+name+(info?' — '+info:'')); }
const logLines = () => fs.readFileSync(LOG,'utf8').split('\n').filter(l=>l.includes('[dry-run]'));
const since = (n) => logLines().slice(n);
const sleep = ms => new Promise(r=>setTimeout(r,ms));

const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['iPhone 13'] });
const page = await ctx.newPage();
page.on('console', m => { if (m.type()==='error') console.log('console error:', m.text()); });
page.on('pageerror', e => console.log('pageerror:', e.message));
await page.goto('http://127.0.0.1:8765/');
await page.waitForSelector('#pinSheet:not([hidden])');
await page.fill('#pin', '000000'); await page.click('#pinOk');
await sleep(300);
check('wrong PIN rejected', (await page.textContent('#pinMsg')).includes('PIN 不對'));
await page.fill('#pin', '123456'); await page.click('#pinOk');
await page.waitForFunction(() => document.querySelector('#dot').classList.contains('ok'));
check('paired with correct PIN', true, await page.textContent('#statusText'));
await sleep(1200);
check('RTT shown', /ms/.test(await page.textContent('#statusText')), await page.textContent('#statusText'));
await page.screenshot({ path: 'pad.png' });

const cdp = await ctx.newCDPSession(page);
const box = await page.locator('#pad').boundingBox();
const cx = box.x + box.width*0.4, cy = box.y + box.height*0.5;
async function touch(type, pts) { await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((p,i)=>({x:p[0], y:p[1], id:i})) }); }

// 1. move
let n = logLines().length;
await touch('touchStart', [[cx,cy]]);
for (let i=1;i<=10;i++){ await touch('touchMove', [[cx+i*6, cy+i*3]]); await sleep(16); }
await touch('touchEnd', []);
await sleep(100);
let ev = since(n);
let moves = ev.filter(l=>l.includes(' move '));
let sumx = moves.reduce((a,l)=>a+parseFloat(l.split(' move ')[1].split(' ')[0]),0);
check('one-finger drag moves cursor', moves.length>0 && sumx>60 && !ev.some(l=>l.includes('click')), `${moves.length} move events, total dx ${sumx.toFixed(1)} for 60px finger`);

// 2. tap = left click
await sleep(400);
n = logLines().length;
await touch('touchStart', [[cx,cy]]); await sleep(60); await touch('touchEnd', []);
await sleep(100);
ev = since(n);
check('tap = left click', ev.some(l=>l.includes('click left')) && !ev.some(l=>l.includes(' move ')), ev.join(' | '));

// 3. long press = right click
await sleep(400);
n = logLines().length;
await touch('touchStart', [[cx,cy]]); await sleep(600); await touch('touchEnd', []);
await sleep(100);
ev = since(n);
check('long press = right click', ev.filter(l=>l.includes('click right')).length===1 && !ev.some(l=>l.includes('click left')), ev.join(' | '));

// 4. two-finger tap = right click
await sleep(400);
n = logLines().length;
await touch('touchStart', [[cx,cy],[cx+40,cy]]); await sleep(60); await touch('touchEnd', []);
await sleep(100);
ev = since(n);
check('two-finger tap = right click', ev.some(l=>l.includes('click right')), ev.join(' | '));

// 5. two-finger scroll
await sleep(400);
n = logLines().length;
await touch('touchStart', [[cx,cy],[cx+40,cy]]);
for (let i=1;i<=10;i++){ await touch('touchMove', [[cx, cy+i*8],[cx+40, cy+i*8]]); await sleep(16); }
await touch('touchEnd', []);
await sleep(100);
ev = since(n);
let sc = ev.filter(l=>l.includes(' scroll ')); let sy = sc.reduce((a,l)=>a+parseInt(l.trim().split(' ').pop()),0);
check('two-finger drag scrolls (finger down => positive)', sc.length>0 && sy>0 && !ev.some(l=>l.includes(' move ')), `${sc.length} scroll events, total dy ${sy}`);

// 6. double-tap-and-drag
await sleep(500);
n = logLines().length;
await touch('touchStart', [[cx,cy]]); await sleep(50); await touch('touchEnd', []);
await sleep(120);
await touch('touchStart', [[cx,cy]]);
for (let i=1;i<=8;i++){ await touch('touchMove', [[cx+i*5, cy]]); await sleep(16); }
await touch('touchEnd', []);
await sleep(100);
ev = since(n);
const iDown = ev.findIndex(l=>l.includes('button down')), iUp = ev.findIndex(l=>l.includes('button up'));
check('double-tap + hold + drag = drag', iDown>=0 && iUp>iDown && ev.slice(iDown,iUp).some(l=>l.includes(' move ')), ev.map(l=>l.split('[dry-run] ')[1]).join(' | '));

// 7. scroll strip
await sleep(500);
const sb = await page.locator('#strip').boundingBox();
const sx0 = sb.x+sb.width/2, sy0 = sb.y+sb.height*0.3;
n = logLines().length;
await touch('touchStart', [[sx0,sy0]]);
for (let i=1;i<=8;i++){ await touch('touchMove', [[sx0, sy0+i*10]]); await sleep(16); }
await touch('touchEnd', []);
await sleep(800);
ev = since(n);
sc = ev.filter(l=>l.includes(' scroll '));
check('thumb scroll strip scrolls with inertia', sc.length>8 && !ev.some(l=>l.includes(' move ')||l.includes('click')), `${sc.length} scroll events`);

// 7b. three-finger swipes
for (const [name, dx, dy, expect] of [['left', -12, 0, 'key ctrl+right'], ['right', 12, 0, 'key ctrl+left'], ['up', 0, -12, 'key ctrl+up'], ['down', 0, 12, 'key ctrl+down']]) {
  await sleep(400);
  n = logLines().length;
  const pts = [[cx-40,cy],[cx,cy],[cx+40,cy]];
  await touch('touchStart', pts);
  for (let i=1;i<=8;i++){ await touch('touchMove', pts.map(p=>[p[0]+dx*i, p[1]+dy*i])); await sleep(16); }
  await touch('touchEnd', []);
  await sleep(120);
  ev = since(n);
  const keys = ev.filter(l=>l.includes(' key '));
  check(`three-finger swipe ${name} => ${expect.slice(4)} (once, no click/scroll)`, keys.length===1 && keys[0].includes(expect) && !ev.some(l=>/ click | scroll /.test(l+' ')), ev.map(l=>l.split('[dry-run] ')[1]).join(' | '));
}
// short three-finger touch should do nothing
await sleep(400);
n = logLines().length;
await touch('touchStart', [[cx-40,cy],[cx,cy],[cx+40,cy]]); await sleep(60); await touch('touchEnd', []);
await sleep(120);
ev = since(n);
check('three-finger tap does nothing', ev.length===0, ev.join(' | '));

// 8. buttons
n = logLines().length;
await page.tap('#leftBtn'); await page.tap('#rightBtn');
await page.tap('[data-combo="cmd+tab"]'); await page.tap('[data-combo="ctrl+left"]'); await page.tap('[data-combo="ctrl+right"]');
await sleep(150);
ev = since(n);
check('buttons: left, right, ⌘Tab, ◀桌面, 桌面▶', ev.some(l=>l.includes('click left')) && ev.some(l=>l.includes('click right')) && ev.some(l=>l.includes('key cmd+tab')) && ev.some(l=>l.includes('key ctrl+left')) && ev.some(l=>l.includes('key ctrl+right')), ev.map(l=>l.split('[dry-run] ')[1]).join(' | '));

// 9. typing ascii
await page.tap('#kbBtn');
await sleep(200);
check('keyboard mode opens and textarea focused', await page.evaluate(()=>document.body.classList.contains('typing') && document.activeElement.id==='ta'));
n = logLines().length;
await page.keyboard.type('hi');
await sleep(150);
await page.keyboard.press('Backspace');
await sleep(150);
ev = since(n);
check('type "hi" then backspace', ev.filter(l=>l.includes('text h')).length===1 && ev.some(l=>l.includes('text i')) && ev.some(l=>l.includes('key backspace')), ev.map(l=>l.split('[dry-run] ')[1]).join(' | '));

// 10. IME composition: only committed text is sent
n = logLines().length;
await cdp.send('Input.imeSetComposition', { text: 'ㄋ', selectionStart: 1, selectionEnd: 1 });
await cdp.send('Input.imeSetComposition', { text: 'ㄋㄧˇ', selectionStart: 3, selectionEnd: 3 });
await cdp.send('Input.imeSetComposition', { text: '你', selectionStart: 1, selectionEnd: 1 });
await sleep(100);
const mid = since(n).length;
await cdp.send('Input.insertText', { text: '你好' });
await sleep(200);
ev = since(n);
check('IME: nothing sent while composing', mid===0, `${mid} events during composition`);
check('IME: committed text sent once', ev.filter(l=>l.includes('text 你好')).length===1 && !ev.some(l=>l.includes('ㄋ')), ev.map(l=>l.split('[dry-run] ')[1]).join(' | '));

// 11. backspace on "empty" field still deletes on Mac
n = logLines().length;
await page.keyboard.press('Backspace'); await sleep(80);
await page.keyboard.press('Backspace'); await sleep(80);
await page.keyboard.press('Backspace'); await sleep(150);
ev = since(n);
const bs = ev.filter(l=>l.includes('key backspace')).length;
check('backspace keeps working past start of field', bs===3, `${bs} backspaces for 3 presses`);

// 12. Enter -> return key
n = logLines().length;
await page.keyboard.type('ok'); await page.keyboard.press('Enter'); await sleep(150);
ev = since(n);
check('Enter sends Return key', ev.some(l=>l.includes('key return')), ev.map(l=>l.split('[dry-run] ')[1]).join(' | '));

// 13. autocorrect-style replacement: "teh" -> "the"
n = logLines().length;
await page.keyboard.type('teh'); await sleep(100);
await page.evaluate(()=>{ const ta=document.getElementById('ta'); ta.value = ta.value.replace(/teh$/,'the'); ta.dispatchEvent(new InputEvent('input',{inputType:'insertReplacementText'})); });
await sleep(150);
ev = since(n);
// replay events into a simulated Mac text buffer
let buf = [];
for (const l of ev) { const e = l.split('[dry-run] ')[1];
  if (e.startsWith('text ')) buf.push(...Array.from(e.slice(5)));
  else if (e === 'key backspace') buf.pop(); }
check('replacement "teh"→"the" ends as "the" on Mac', buf.join('') === 'the', 'events: ' + ev.map(l=>l.split('[dry-run] ')[1]).join(' | ') + ' => "' + buf.join('') + '"');

// 14. sticky ⌘ then "c" -> cmd+c
n = logLines().length;
await page.tap('[data-mod="cmd"]'); await sleep(50);
await page.keyboard.type('c'); await sleep(150);
ev = since(n);
check('sticky ⌘ + c => cmd+c (not text)', ev.some(l=>l.includes('key cmd+c')) && !ev.some(l=>l.includes('text c')), ev.map(l=>l.split('[dry-run] ')[1]).join(' | '));
check('shortcut letter removed from field', !(await page.inputValue('#ta')).endsWith('c'), JSON.stringify(await page.inputValue('#ta')));
n = logLines().length;
await page.keyboard.press('Backspace'); await sleep(120);
ev = since(n);
check('backspace after shortcut deletes real text only', ev.filter(l=>l.includes('key backspace')).length===1, ev.map(l=>l.split('[dry-run] ')[1]).join(' | '));
check('preview mirrors Mac text', (await page.textContent('#last')).endsWith('th'), await page.textContent('#last'));
check('⌘ released after use', !(await page.evaluate(()=>document.querySelector('[data-mod=cmd]').classList.contains('on'))));
await page.screenshot({ path: 'typing.png' });

// 15. emoji (surrogate pair) + delete
n = logLines().length;
await cdp.send('Input.insertText', { text: '👍' }); await sleep(100);
await page.keyboard.press('Backspace'); await sleep(150);
ev = since(n);
check('emoji sent, one backspace deletes it', ev.some(l=>l.includes('text 👍')) && ev.filter(l=>l.includes('key backspace')).length===1, ev.map(l=>l.split('[dry-run] ')[1]).join(' | '));

// 16. draft mode
await page.tap('#modeBtn'); await sleep(150);
n = logLines().length;
await page.focus('#ta');
await cdp.send('Input.insertText', { text: '明天下午開會' }); await sleep(150);
const before = since(n).length;
await page.tap('#sendDraft'); await sleep(150);
ev = since(n);
check('draft mode: nothing sent until 送出', before===0 && ev.some(l=>l.includes('text 明天下午開會')), ev.map(l=>l.split('[dry-run] ')[1]).join(' | '));
await page.screenshot({ path: 'draft.png' });
await page.tap('#modeBtn');

// 17. reconnect & auto re-auth after reload
await page.reload();
await page.waitForFunction(() => document.querySelector('#dot').classList.contains('ok'), null, { timeout: 5000 });
check('remembered PIN after reload', true);

await browser.close();
const fails = results.filter(r=>!r[1]).length;
console.log(`\n${results.length-fails}/${results.length} passed`);
fs.writeFileSync('results.json', JSON.stringify(results,null,1));
