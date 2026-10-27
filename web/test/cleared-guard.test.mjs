// I-24 (Ray's P-22): after 送出／Enter the box is emptied; if iOS dictation or the input method puts the text back,
// it must never go to the Mac again (Orca text ended up in LINE).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ClearedTextGuard } from '../js/textsync.js';

const SENT = '我在 Orca 說的私人內容，不要外流。';

test('the whole sent text coming back is taken out', () => {
  const g = new ClearedTextGuard();
  g.cleared(SENT);
  assert.equal(g.check('', SENT), '');                       // put back with an input event
  assert.equal(g.check('', SENT + 'x'), 'x');                // put back silently, found with the next keystroke
  assert.equal(g.check('', 'x' + SENT), 'x');
  assert.equal(g.check('LINE', 'LINE' + SENT), 'LINE');      // after something new was typed
});

test('dictation putting back only its last sentence is taken out too', () => {
  const g = new ClearedTextGuard();
  g.cleared('第一句話先說完。第二句是最後一句話。');
  assert.equal(g.check('', '第二句是最後一句話。'), '');
});

test('typing, word picks and new sentences go through', () => {
  const g = new ClearedTextGuard();
  g.cleared(SENT);
  assert.equal(g.check('', '我'), null);                     // one character typed
  assert.equal(g.check('我', '我在'), null);
  assert.equal(g.check('', '私人內容'), null);               // a Zhuyin phrase that also appears in the sent text (4 < 6, not its end)
  assert.equal(g.check('', '今天下午三點開會，記得帶電腦。'), null);  // a different sentence
  assert.equal(g.check('abc', 'abc'), null);
});

test('short replies are not guarded (「好的」 twice is on purpose)', () => {
  const g = new ClearedTextGuard();
  g.cleared('好的');
  assert.equal(g.check('', '好的'), null);
  g.cleared('ok  ');
  assert.equal(g.check('', 'ok  '), null);
});

test('closing the keyboard ends the guard', () => {
  const g = new ClearedTextGuard();
  g.cleared(SENT);
  g.forget();
  assert.equal(g.check('', SENT), null);
});
