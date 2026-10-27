// PKM-4: live typing waits for the Mac to finish the previous piece, then sends everything typed meanwhile as one;
// text goes before a click; text typed while offline is dropped, never sent later.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LiveTyping } from '../js/textsync.js';
import { KeyRowStore } from '../js/keyrow.js';

function rig() {
  let value = '';
  let busy = 0;          // text pieces the Mac has not acked yet
  let online = true;
  const sent = [];
  const timers = [];
  const live = new LiveTyping({
    read: () => value,
    send: (ops, at) => { sent.push({ ...ops, at }); busy++; },
    canSend: (force) => online && (force || busy === 0),
    now: () => 1000,
    setTimer: (fn) => { timers.push(fn); return timers.length; },
    clearTimer: () => {},
  });
  const type = (s) => { value += s; live.input(false); while (timers.length) timers.shift()(); };
  return { live, sent, type, ack: () => { busy--; if (busy === 0) live.kick(); }, set: (v) => { value = v; }, offline: (v) => { online = !v; } };
}

test('keys typed while the Mac is still pasting the last one go together, once it is done', () => {
  const r = rig();
  r.type('a');
  assert.deepEqual(r.sent.map((s) => s.insert), ['a']);
  r.type('b');
  r.type('c');
  r.type('d');
  assert.equal(r.sent.length, 1, 'b c d wait: the Mac is busy with a');
  r.ack();
  assert.deepEqual(r.sent.map((s) => s.insert), ['a', 'bcd'], 'one paste instead of three');
  assert.equal(r.sent[1].at, 1000, 'stamped with when b was typed');
});

test('a click (or key, gesture) sends waiting text first, even while the Mac is busy', () => {
  const r = rig();
  r.type('a');
  r.type('b');
  r.live.flush(true);   // textFirst() before the click
  assert.deepEqual(r.sent.map((s) => s.insert), ['a', 'b']);
});

test('typed while offline: never sent later', () => {
  const r = rig();
  r.offline(true);
  r.type('lost');
  assert.equal(r.sent.length, 0);
  assert.equal(r.live.dirty, true);
  r.offline(false);
  const dropped = r.live.discardUnsent();
  assert.equal(dropped.insert, 'lost');
  r.live.kick();
  assert.equal(r.sent.length, 0, 'not sent after the link came back');
  assert.equal(r.live.dirty, false);
});

test('a saved key row with the old 🎤 key (or any unknown key) loads without it', () => {
  const store = new Map([['keyrow', JSON.stringify({ version: 1, items: ['k:escape', 'v:mic', 'mic', 'k:voice', 'k:tab'] })]]);
  const row = new KeyRowStore({ get: (k) => store.get(k) ?? null, set: (k, v) => store.set(k, v) });
  assert.deepEqual(row.ids, ['k:escape', 'k:tab']);
});
