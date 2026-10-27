// v2 gestures (PKM-2): three-finger swipes, pinch zoom, optional two-finger back/forward flick,
// and that none of them disturb taps, two-finger scrolling or long-press drag.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TrackpadGestures } from '../js/pointer.js';

function recorder(opts = {}) {
  const events = [];
  const timers = { list: [], set(fn) { this.list.push(fn); return this.list.length - 1; }, clear(id) { this.list[id] = null; },
    fire() { for (const [i, fn] of this.list.entries()) if (fn) { this.list[i] = null; fn(); } } };
  const g = new TrackpadGestures((a) => events.push(a), opts, timers);
  return { g, events, timers };
}
const P = (x, y, id) => ({ id, x, y });
/** Three fingers side by side, centred on (x, y). */
const three = (x, y) => [P(x - 40, y, 1), P(x, y + 10, 2), P(x + 40, y, 3)];
const types = (events) => events.map((e) => e.type);

for (const [dir, dx, dy] of [['left', -60, 0], ['right', 60, 0], ['up', 0, -60], ['down', 0, 60]]) {
  test(`three-finger swipe ${dir} fires exactly one swipe`, () => {
    const { g, events } = recorder();
    g.handle('start', [P(160, 200, 1)], 0);
    g.handle('start', [P(160, 200, 1), P(200, 210, 2)], 15);
    g.handle('start', three(200, 200), 30);
    for (let i = 1; i <= 6; i++) g.handle('move', three(200 + (dx * i) / 6, 200 + (dy * i) / 6), 30 + i * 16);
    g.handle('move', three(200 + dx * 2, 200 + dy * 2), 150); // keeps going: still one swipe
    g.handle('end', [], 200);
    assert.deepEqual(events, [{ type: 'swipe', fingers: 3, dir }]);
  });
}

test('three fingers that barely move, or move diagonally, do nothing (no click, no scroll)', () => {
  const { g, events } = recorder();
  g.handle('start', three(200, 200), 0);
  g.handle('move', three(215, 210), 40);
  g.handle('move', three(235, 232), 80); // diagonal: neither axis dominates
  g.handle('end', [], 150);
  assert.deepEqual(events, []);
});

test('three-finger swipe can be switched off; then three fingers are ignored like before', () => {
  const { g, events } = recorder({ threeFingerSwipe: false });
  g.handle('start', [P(100, 100, 1), P(140, 100, 2)], 0);
  g.handle('start', three(120, 100), 10);
  for (let i = 1; i <= 4; i++) g.handle('move', three(120 - i * 20, 100), 10 + i * 16);
  g.handle('end', [], 100);
  assert.ok(!events.some((e) => e.type === 'swipe'));
});

test('a third finger landing during a two-finger scroll does not turn it into a swipe', () => {
  const { g, events } = recorder();
  g.handle('start', [P(100, 100, 1), P(140, 100, 2)], 0);
  g.handle('move', [P(100, 130, 1), P(140, 130, 2)], 16);
  g.handle('start', [P(100, 130, 1), P(140, 130, 2), P(180, 130, 3)], 30);
  g.handle('move', [P(30, 130, 1), P(70, 130, 2), P(110, 130, 3)], 46);
  g.handle('end', [], 300);
  assert.ok(events.every((e) => e.type === 'scroll'), JSON.stringify(events));
});

test('pinch out zooms in step by step, pinch in zooms out; no scroll, no right click', () => {
  const { g, events } = recorder();
  g.handle('start', [P(150, 300, 1), P(250, 300, 2)], 0); // spread 100
  for (let i = 1; i <= 10; i++) g.handle('move', [P(150 - i * 5, 300, 1), P(250 + i * 5, 300, 2)], i * 16); // spread → 200
  g.handle('end', [], 400);
  // 100 → 200 is 2×: 1.25^3 = 1.95 → three steps
  assert.deepEqual(events, [{ type: 'zoom', dir: 'in' }, { type: 'zoom', dir: 'in' }, { type: 'zoom', dir: 'in' }]);

  const r = recorder();
  r.g.handle('start', [P(100, 300, 1), P(300, 300, 2)], 0); // spread 200
  for (let i = 1; i <= 10; i++) r.g.handle('move', [P(100 + i * 5, 300, 1), P(300 - i * 5, 300, 2)], i * 16); // → 100
  r.g.handle('end', [], 400);
  assert.deepEqual(types(r.events), ['zoom', 'zoom', 'zoom']);
  assert.ok(r.events.every((e) => e.dir === 'out'));
});

test('two-finger scroll with fingers wobbling apart a little stays a scroll (not a pinch)', () => {
  const { g, events } = recorder();
  g.handle('start', [P(150, 300, 1), P(220, 300, 2)], 0);
  for (let i = 1; i <= 8; i++) g.handle('move', [P(150 - (i % 2) * 3, 300 + i * 12, 1), P(220 + (i % 2) * 4, 300 + i * 12, 2)], i * 16);
  g.handle('end', [], 300);
  assert.ok(events.length > 3 && events.every((e) => e.type === 'scroll'), JSON.stringify(types(events)));
});

test('pinch can be switched off: spreading fingers then scrolls', () => {
  const { g, events } = recorder({ pinchZoom: false });
  g.handle('start', [P(150, 300, 1), P(250, 300, 2)], 0);
  for (let i = 1; i <= 6; i++) g.handle('move', [P(150 - i * 8, 300 + i * 3, 1), P(250 + i * 8, 300 + i * 3, 2)], i * 16);
  g.handle('end', [], 300);
  assert.ok(!events.some((e) => e.type === 'zoom'));
});

test('two-finger tap is still a right click; one-finger tap still a left click', () => {
  const a = recorder();
  a.g.handle('start', [P(100, 100, 1), P(150, 100, 2)], 0);
  a.g.handle('move', [P(102, 101, 1), P(151, 102, 2)], 50);
  a.g.handle('end', [], 120);
  assert.deepEqual(a.events, [{ type: 'click', button: 'right' }]);
  const b = recorder();
  b.g.handle('start', [P(100, 100, 1)], 0);
  b.g.handle('end', [], 100);
  assert.deepEqual(b.events, [{ type: 'click', button: 'left' }]);
});

test('long-press drag is unaffected by the new gestures', () => {
  const { g, events, timers } = recorder();
  g.handle('start', [P(100, 100, 1)], 0);
  timers.fire(); // long press
  g.handle('move', [P(140, 100, 1)], 500);
  g.handle('end', [], 600);
  assert.deepEqual(types(events), ['down', 'dragStart', 'move', 'up', 'dragEnd']);
});

test('two-finger flick: off by default (just scrolls); when on, a fast horizontal flick is back / forward', () => {
  const flick = (opts) => {
    const r = recorder(opts);
    r.g.handle('start', [P(100, 300, 1), P(150, 300, 2)], 0);
    for (let i = 1; i <= 5; i++) r.g.handle('move', [P(100 + i * 25, 302, 1), P(150 + i * 25, 302, 2)], i * 20);
    r.g.handle('end', [], 110);
    return r.events;
  };
  assert.ok(!flick({}).some((e) => e.type === 'swipe'), 'default: no navigation');
  const on = flick({ navFlick: true });
  assert.deepEqual(on.filter((e) => e.type === 'swipe'), [{ type: 'swipe', fingers: 2, dir: 'right' }]);
  assert.ok(!on.some((e) => e.type === 'momentum'), 'a flick that navigates does not also fling-scroll');

  // slow horizontal scroll with the option on: still a scroll
  const r = recorder({ navFlick: true });
  r.g.handle('start', [P(100, 300, 1), P(150, 300, 2)], 0);
  for (let i = 1; i <= 10; i++) r.g.handle('move', [P(100 + i * 12, 300, 1), P(150 + i * 12, 300, 2)], i * 60);
  r.g.handle('end', [], 700);
  assert.ok(!r.events.some((e) => e.type === 'swipe'));
});
