import { chromium, devices } from 'playwright';
import fs from 'fs';
const LOG = process.argv[2];
const results = [];
function check(name, ok, info='') { results.push([name, ok, info]); console.log((ok?'PASS':'FAIL')+' '+name+(info?' — '+info:'')); }
const logLines = () => fs.readFileSync(LOG,'utf8').split('\n').filter(l=>l.includes('[dry-run]'));
const since = (n) => logLines().slice(n);
const sleep = ms => new Promise(r=>setTimeout(r,ms));
const fmt = ev => ev.map(l=>l.split('[dry-run] ')[1]).join(' | ');

const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['iPhone 13'] });
const page = await ctx.newPage();
page.on('pageerror', e => console.log('pageerror:', e.message));
await page.goto('http://127.0.0.1:8765/');
await page.waitForSelector('#pinSheet:not([hidden])');
await page.fill('#pin', '123456'); await page.click('#pinOk');
await page.waitForFunction(() => document.querySelector('#dot').classList.contains('ok'));
const cdp = await ctx.newCDPSession(page);
async function touch(type, pts) { await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((p,i)=>({x:p[0], y:p[1], id:i})) }); }
let box = await page.locator('#pad').boundingBox();
let cx = box.x + box.width*0.45, cy = box.y + box.height*0.5;
async function gesture(start, stepFn, steps=8) {
  await touch('touchStart', start);
  for (let i=1;i<=steps;i++){ await touch('touchMove', stepFn(i)); await sleep(16); }
  await touch('touchEnd', []);
}
let n, ev;

// pinch out / in
n = logLines().length;
await gesture([[cx-30,cy],[cx+30,cy]], i=>[[cx-30-i*8,cy],[cx+30+i*8,cy]]);
await sleep(150); ev = since(n);
check('two-finger pinch out => ⌘+ (zoom in), no scroll', ev.some(l=>l.includes('key cmd+=')) && !ev.some(l=>l.includes(' scroll ')), fmt(ev));
await sleep(300);
n = logLines().length;
await gesture([[cx-90,cy],[cx+90,cy]], i=>[[cx-90+i*8,cy],[cx+90-i*8,cy]]);
await sleep(150); ev = since(n);
check('two-finger pinch in => ⌘− (zoom out)', ev.some(l=>l.includes('key cmd+-')) && !ev.some(l=>l.includes(' scroll ')), fmt(ev));

// momentum after two-finger flick
await sleep(300);
n = logLines().length;
await gesture([[cx-20,cy-60],[cx+20,cy-60]], i=>[[cx-20,cy-60+i*14],[cx+20,cy-60+i*14]]);
const atLift = since(n).filter(l=>l.includes(' scroll ')).length;
await sleep(700);
ev = since(n);
const total = ev.filter(l=>l.includes(' scroll ')).length;
check('two-finger flick keeps scrolling after lift (momentum)', total > atLift + 5, `${atLift} scroll events while touching, ${total} total`);

// natural vs traditional
await sleep(800);
await page.evaluate(()=>{ window.__sofapad.cfg.invert = true; });
n = logLines().length;
await gesture([[cx-20,cy],[cx+20,cy]], i=>[[cx-20,cy+i*4],[cx+20,cy+i*4]]);
await sleep(100);
ev = since(n).filter(l=>l.includes(' scroll '));
let sy = ev.reduce((a,l)=>a+parseInt(l.trim().split(' ').pop()),0);
check('traditional direction flips scroll sign', sy < 0, `total dy ${sy} (natural gives positive)`);
await page.evaluate(()=>{ window.__sofapad.cfg.invert = false; });

// three-finger tap => look up
await sleep(800);
n = logLines().length;
await touch('touchStart', [[cx-40,cy],[cx,cy],[cx+40,cy]]); await sleep(60); await touch('touchEnd', []);
await sleep(120); ev = since(n);
check('three-finger tap => ⌃⌘D look up', ev.length===1 && ev[0].includes('key ctrl+cmd+d'), fmt(ev));

// four-finger spread / pinch
await sleep(400);
const four = r => [[cx-r,cy-r],[cx+r,cy-r],[cx-r,cy+r],[cx+r,cy+r]];
n = logLines().length;
await gesture(four(30), i=>four(30+i*8));
await sleep(150); ev = since(n);
check('four-finger spread => F11 show desktop (once)', ev.filter(l=>l.includes(' key ')).length===1 && ev.some(l=>l.includes('key f11')), fmt(ev));
await sleep(400);
n = logLines().length;
await gesture(four(90), i=>four(90-i*8));
await sleep(150); ev = since(n);
check('four-finger pinch => Launchpad/Apps', ev.some(l=>l.includes('app launchpad')) && !ev.some(l=>l.includes(' key ')), fmt(ev));
await sleep(400);
n = logLines().length;
await gesture(four(40), i=>four(40).map(p=>[p[0]-i*8,p[1]]));
await sleep(150); ev = since(n);
check('four-finger swipe left => next Space (like 3 fingers)', ev.some(l=>l.includes('key ctrl+right')), fmt(ev));

// shortcut sheet
await page.tap('#keysBtn'); await sleep(150);
check('shortcut sheet opens', await page.isVisible('#keysSheet'));
await page.screenshot({ path: 'keys.png' });
n = logLines().length;
await page.tap('#keysSheet [data-combo="cmd+c"]'); await page.tap('#keysSheet [data-combo="shift+cmd+z"]');
await page.tap('#keysSheet [data-combo="ctrl+cmd+space"]'); await page.tap('#keysSheet [data-app="launchpad"]');
await page.tap('#keysSheet [data-combo="f11"]');
await sleep(150); ev = since(n);
check('sheet shortcuts send correct keys', ['key cmd+c','key shift+cmd+z','key ctrl+cmd+space','app launchpad','key f11'].every(k=>ev.some(l=>l.includes(k))), fmt(ev));
await page.tap('#keysClose'); await sleep(100);
check('shortcut sheet closes', !(await page.isVisible('#keysSheet')));

// full-screen pad
await page.tap('#fullBtn'); await sleep(150);
const fullState = await page.evaluate(()=>({ bar: getComputedStyle(document.querySelector('.bar')).display, side: getComputedStyle(document.querySelector('#side')).display, padH: document.querySelector('#pad').getBoundingClientRect().height, vh: innerHeight }));
check('full-screen mode: only the trackpad', fullState.bar==='none' && fullState.side==='none' && fullState.padH > fullState.vh*0.9, JSON.stringify(fullState));
await page.screenshot({ path: 'full.png' });
box = await page.locator('#pad').boundingBox(); cx = box.x+box.width/2; cy = box.y+box.height/2;
n = logLines().length;
await touch('touchStart', [[cx,cy]]); await sleep(50); await touch('touchEnd', []); await sleep(120);
ev = since(n);
check('tap still clicks in full-screen mode', ev.some(l=>l.includes('click left')), fmt(ev));
await page.tap('#exitFull'); await sleep(150);
check('exit full-screen restores controls', await page.isVisible('#leftBtn'));

// landscape layout
await page.setViewportSize({ width: 844, height: 390 }); await sleep(300);
const land = await page.evaluate(()=>{ const p=document.querySelector('#pad').getBoundingClientRect(), s=document.querySelector('#side').getBoundingClientRect(); return { padW:p.width, padH:p.height, sideX:s.x, padRight:p.right, overflowX: document.documentElement.scrollWidth > innerWidth }; });
check('landscape: wide trackpad left, controls column right, no overflow', land.padW > 450 && land.sideX >= land.padRight - 1 && !land.overflowX && land.padH > 250, JSON.stringify(land));
await page.screenshot({ path: 'landscape.png' });
await page.tap('#fullBtn'); await sleep(200);
await page.screenshot({ path: 'landscape-full.png' });
const lf = await page.evaluate(()=>document.querySelector('#pad').getBoundingClientRect().width);
check('landscape full-screen pad fills width', lf > 800, `pad width ${lf}`);
await page.tap('#exitFull');

await browser.close();
const fails = results.filter(r=>!r[1]).length;
console.log(`\n${results.length-fails}/${results.length} passed`);
