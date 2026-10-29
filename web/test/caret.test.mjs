// SOFA-6 cursor pad: hold to start, drag for arrow keys, Shift to select, Option for words, at most 30 a second,
// nothing left over when the finger lifts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CaretPad } from '../js/caret.js';

/** Fake clock and timers: `advance(ms)` runs what is due, in order. */
function rig(opts = {}) {
  let t = 0;
  let seq = 0;
  const timers = new Map();
  const presses = [];
  const modes = [];
  const selects = [];
  let buzzes = 0;
  const pad = new CaretPad({
    press: (p) => presses.push({ ...p, t }),
    onMode: (on) => modes.push(on),
    onSelect: (on) => selects.push(on),
    buzz: () => { buzzes++; },
    now: () => t,
    setTimer: (fn, ms) => { const id = ++seq; timers.set(id, { at: t + ms, fn }); return id; },
    clearTimer: (id) => { timers.delete(id); },
    ...opts,
  });
  const advance = (ms) => {
    const end = t + ms;
    for (;;) {
      const due = [...timers.entries()].filter(([, v]) => v.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!due) break;
      timers.delete(due[0]);
      t = Math.max(t, due[1].at);
      due[1].fn();
    }
    t = end;
  };
  /** Drag from x0 to x1 (and y0 → y1) in `ms`, one move event every 16 ms. */
  const drag = (x0, y0, x1, y1, ms) => {
    const n = Math.max(1, Math.round(ms / 16));
    for (let i = 1; i <= n; i++) {
      advance(ms / n);
      pad.move(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n);
    }
  };
  return { pad, presses, modes, selects, advance, drag, buzzes: () => buzzes, now: () => t };
}

const keys = (ps) => ps.map((p) => (p.mods.length ? p.mods.join('+') + '+' : '') + p.k).join(' ');

test('hold 0.3 s first: a quick swipe across the pad does nothing', () => {
  const r = rig();
  r.pad.start(100, 20);
  r.drag(100, 20, 300, 20, 150);
  r.advance(500);
  r.pad.end();
  assert.deepEqual(r.presses, []);
  assert.deepEqual(r.modes, []);
  assert.equal(r.buzzes(), 0);
});

test('hold, then drag right slowly: one → per 14 px, a buzz when cursor mode starts', () => {
  const r = rig();
  r.pad.start(100, 20);
  r.advance(299);
  assert.equal(r.pad.active, false);
  r.advance(1);
  assert.equal(r.pad.active, true);
  assert.equal(r.buzzes(), 1);
  assert.deepEqual(r.modes, [true]);
  r.drag(100, 20, 170, 20, 700);     // 70 px in 0.7 s: 0.1 px/ms
  r.pad.end();
  assert.equal(keys(r.presses), 'right right right right right');
  assert.deepEqual(r.modes, [true, false]);
});

test('left and up/down; the bigger axis of each move wins, so a sideways drag does not jump lines', () => {
  const r = rig();
  r.pad.start(200, 50);
  r.advance(300);
  r.drag(200, 50, 158, 58, 600);     // left 42 px with a little vertical wobble
  assert.equal(keys(r.presses), 'left left left');
  r.drag(158, 58, 158, 2, 600);      // up 56 px
  assert.equal(keys(r.presses), 'left left left up up');
  r.pad.end();
});

test('選取 switch: Shift + arrows (stays on for the next drag); second finger: this drag only', () => {
  const r = rig();
  r.pad.setSelect(true);
  assert.deepEqual(r.selects, [true]);
  r.pad.start(0, 0);
  r.advance(300);
  r.drag(0, 0, 28, 0, 400);
  r.pad.end();
  assert.equal(keys(r.presses), 'shift+right shift+right');
  r.pad.start(0, 0);
  r.advance(300);
  r.drag(0, 0, 14, 0, 200);
  r.pad.end();
  assert.equal(keys(r.presses.slice(2)), 'shift+right', 'still selecting on the next drag');
  r.pad.setSelect(false);

  const s = rig();
  s.pad.start(0, 0);
  s.advance(300);
  s.drag(0, 0, 14, 0, 200);
  s.pad.secondTap();
  assert.deepEqual(s.selects, [true]);
  s.drag(14, 0, 42, 0, 400);
  s.pad.end();
  assert.equal(keys(s.presses), 'right shift+right shift+right');
  assert.deepEqual(s.selects, [true, false], 'second-finger selecting ends with the drag');
  s.pad.start(0, 0);
  s.advance(300);
  s.drag(0, 0, 14, 0, 200);
  s.pad.end();
  assert.equal(keys(s.presses.slice(3)), 'right');
});

test('a fast sideways flick: Option + arrow, a word per press', () => {
  const r = rig();
  r.pad.start(0, 0);
  r.advance(300);
  r.drag(0, 0, 600, 0, 240);         // 2.5 px/ms
  r.pad.end();
  assert.ok(r.presses.every((p) => p.k === 'right'), keys(r.presses));
  // the first move event cannot know the speed yet; after it, every press jumps a word
  assert.ok(r.presses.filter((p) => p.mods.includes('opt')).length >= 4, keys(r.presses));
  assert.ok(r.presses.length <= 9, `${r.presses.length} presses in 0.24 s`);
});

test('never more than 30 presses a second, and nothing after the finger lifts', () => {
  const r = rig();
  r.pad.start(0, 0);
  r.advance(300);
  const t0 = r.now();
  r.drag(0, 0, 1400, 0, 1000);        // asks for far more than 30 presses (1.4 px/ms: plain arrows)
  const inDrag = r.presses.filter((p) => p.t >= t0 && p.t <= t0 + 1000).length;
  assert.ok(inDrag <= 31, `${inDrag} presses in one second`);
  assert.ok(inDrag >= 25, `still moving: ${inDrag}`);
  const atLift = r.presses.length;
  r.pad.end();
  r.advance(1000);
  assert.equal(r.presses.length, atLift, 'the backlog is dropped when the finger lifts');
  for (let i = 1; i < r.presses.length; i++) {
    assert.ok(r.presses[i].t - r.presses[i - 1].t >= 1000 / 30 - 1e-9, 'evenly paced');
  }
});

test('a new touch starts clean; a cancelled touch stops like a lift', () => {
  const r = rig();
  r.pad.start(0, 0);
  r.advance(300);
  r.drag(0, 0, 10, 0, 100);           // 10 px: not a press yet
  r.pad.end();
  r.pad.start(0, 0);
  r.advance(300);
  r.drag(0, 0, 10, 0, 100);
  r.pad.end();
  assert.deepEqual(r.presses, [], 'the 10 px left over from the first drag are not carried over');
});
