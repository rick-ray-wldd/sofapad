import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pointerGain, TrackpadGestures, Momentum, MoveCoalescer } from '../js/pointer.js';

function fakeTimers() {
  const t = { list: [], set(fn, ms) { const id = t.list.length; t.list.push({ fn, ms, live: true }); return id; },
    clear(id) { if (t.list[id]) t.list[id].live = false; }, fire() { for (const x of t.list) if (x.live) { x.live = false; x.fn(); } } };
  return t;
}
function recorder(opts = {}) {
  const events = [];
  const timers = fakeTimers();
  const g = new TrackpadGestures((a) => events.push(a), opts, timers);
  return { g, events, timers };
}
const P = (x, y, id = 0) => ({ id, x, y });

test('gain grows with finger speed and respects sensitivity', () => {
  const slow = pointerGain(0.01, 1.5, 0.6);
  const mid = pointerGain(0.5, 1.5, 0.6);
  const fast = pointerGain(3, 1.5, 0.6);
  assert.ok(slow < mid && mid < fast);
  assert.equal(pointerGain(3, 1.5, 0), pointerGain(0.01, 1.5, 0), 'no acceleration = constant gain');
  assert.ok(Math.abs(pointerGain(0.01, 3, 0.6) / slow - 2) < 1e-9, 'sensitivity scales linearly');
});

test('one-finger tap is a left click', () => {
  const { g, events } = recorder();
  g.handle('start', [P(100, 100)], 0);
  g.handle('move', [P(103, 102)], 50); // under the tap threshold
  g.handle('end', [], 120);
  assert.deepEqual(events, [{ type: 'click', button: 'left' }]);
});

test('slow press is not a click', () => {
  const { g, events } = recorder({ longPressDrag: false });
  g.handle('start', [P(100, 100)], 0);
  g.handle('end', [], 400);
  assert.deepEqual(events, []);
});

test('one-finger drag moves the cursor with gain, no click', () => {
  const { g, events } = recorder();
  g.handle('start', [P(100, 100)], 0);
  g.handle('move', [P(120, 100)], 16);
  g.handle('move', [P(140, 110)], 32);
  g.handle('end', [], 48);
  const moves = events.filter((e) => e.type === 'move');
  assert.equal(moves.length, 2);
  assert.ok(moves.every((m) => m.dx > 0));
  assert.ok(moves[1].dy > 0);
  assert.ok(!events.some((e) => e.type === 'click'));
});

test('long press then drag = left button drag', () => {
  const { g, events, timers } = recorder();
  g.handle('start', [P(50, 50)], 0);
  timers.fire(); // long-press timer
  g.handle('move', [P(80, 60)], 500);
  g.handle('end', [], 600);
  assert.deepEqual(events.map((e) => e.type), ['down', 'dragStart', 'move', 'up', 'dragEnd']);
  assert.equal(events[0].button, 'left');
});

test('moving cancels the long press', () => {
  const { g, events, timers } = recorder();
  g.handle('start', [P(50, 50)], 0);
  g.handle('move', [P(90, 50)], 100);
  timers.fire();
  g.handle('end', [], 150);
  assert.ok(!events.some((e) => e.type === 'down'));
});

test('two-finger tap is a right click', () => {
  const { g, events } = recorder();
  g.handle('start', [P(100, 100, 1)], 0);
  g.handle('start', [P(100, 100, 1), P(150, 100, 2)], 20);
  g.handle('end', [P(150, 100, 2)], 120);
  g.handle('end', [], 130);
  assert.deepEqual(events, [{ type: 'click', button: 'right' }]);
});

test('two-finger drag scrolls with momentum and no clicks', () => {
  const { g, events } = recorder();
  g.handle('start', [P(100, 100, 1), P(150, 100, 2)], 0);
  for (let i = 1; i <= 5; i++) g.handle('move', [P(100, 100 + i * 20, 1), P(150, 100 + i * 20, 2)], i * 16);
  g.handle('end', [], 5 * 16 + 10);
  const scrolls = events.filter((e) => e.type === 'scroll');
  assert.ok(scrolls.length >= 4);
  assert.ok(scrolls.every((s) => s.dy > 0 && s.dx === 0));
  assert.equal(events.at(-1).type, 'momentum');
  assert.ok(!events.some((e) => e.type === 'click'));
});

test('leftover finger after a two-finger gesture does not move the cursor', () => {
  const { g, events } = recorder();
  g.handle('start', [P(100, 100, 1), P(150, 100, 2)], 0);
  g.handle('move', [P(100, 140, 1), P(150, 140, 2)], 16);
  g.handle('end', [P(100, 140, 1)], 30);
  g.handle('move', [P(160, 160, 1)], 40);
  g.handle('end', [], 300);
  assert.ok(!events.some((e) => e.type === 'move' || e.type === 'click'));
});

test('momentum decays to a stop', () => {
  const m = new Momentum(0, 2);
  let total = 0;
  let steps = 0;
  for (let d = m.step(16); d; d = m.step(16)) { total += d.dy; steps++; if (steps > 1000) break; }
  assert.ok(steps > 5 && steps < 200, `steps=${steps}`);
  assert.ok(total > 0);
});

test('coalescer sums and empties', () => {
  const c = new MoveCoalescer();
  assert.equal(c.take(), null);
  c.add(1.234, 2); c.add(0.5, -1);
  assert.deepEqual(c.take(), { dx: 1.73, dy: 1 });
  assert.equal(c.take(), null);
});

test('default timers work when called as methods (browser setTimeout needs the right this)', async () => {
  const events = [];
  const g = new TrackpadGestures((a) => events.push(a), { longPressMs: 20 });
  // Simulate the browser rule: setTimeout must not be called with a foreign `this`.
  const real = globalThis.setTimeout;
  globalThis.setTimeout = function (fn, ms) {
    if (this !== undefined && this !== globalThis) throw new TypeError('Illegal invocation');
    return real(fn, ms);
  };
  try {
    g.handle('start', [{ id: 0, x: 1, y: 1 }], 0);
  } finally {
    globalThis.setTimeout = real;
  }
  await new Promise((r) => real(r, 40));
  assert.deepEqual(events.map((e) => e.type), ['down', 'dragStart']);
});
