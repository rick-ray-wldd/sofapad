import { test } from 'node:test';
import assert from 'node:assert/strict';
import { textDiff, TextMirror, graphemes, shortcutFromInsert } from '../js/textsync.js';

test('diff: append, delete, replace at end', () => {
  assert.deepEqual(textDiff('', 'hello'), { backspaces: 0, insert: 'hello' });
  assert.deepEqual(textDiff('hello', 'help'), { backspaces: 2, insert: 'p' });
  assert.deepEqual(textDiff('teh ', 'the '), { backspaces: 3, insert: 'he ' }); // autocorrect
  assert.deepEqual(textDiff('abc', ''), { backspaces: 3, insert: '' });
});

test('graphemes keep emoji families and accents together', () => {
  assert.equal(graphemes('👨‍👩‍👧‍👦a').length, 2);
  assert.equal(graphemes('é').length, 1);
  assert.deepEqual(textDiff('hi👍🏽', 'hi'), { backspaces: 1, insert: '' });
});

test('Zhuyin composition: nothing is sent until a character is chosen', () => {
  const m = new TextMirror();
  m.compositionStart();
  assert.equal(m.update('ㄋ', true), null);
  assert.equal(m.update('ㄋㄧˇ', true), null);
  assert.deepEqual(m.compositionEnd('你'), { backspaces: 0, insert: '你' });
  m.compositionStart();
  assert.equal(m.update('你ㄏㄠˇ', true), null);
  assert.deepEqual(m.compositionEnd('你好'), { backspaces: 0, insert: '好' });
  // input event after compositionend with the same value: nothing new
  assert.equal(m.update('你好', false), null);
  // association word picked from the candidate bar (插入「嗎」) and a full-width comma
  assert.deepEqual(m.update('你好嗎，', false), { backspaces: 0, insert: '嗎，' });
  // user deletes one character in the phone box
  assert.deepEqual(m.update('你好嗎', false), { backspaces: 1, insert: '' });
});

test('mixed Chinese/English phrase sent as committed segments', () => {
  const m = new TextMirror();
  const sent = [];
  for (const [v, comp] of [['今天', false], ['今天 meeting', false], ['今天 meeting 改到', false], ['今天 meeting 改到3點', false]]) {
    const d = m.update(v, comp);
    if (d) sent.push(d.insert);
  }
  assert.equal(sent.join(''), '今天 meeting 改到3點');
});

test('reset keeps Mac text, starts a fresh box', () => {
  const m = new TextMirror();
  m.update('line one', false);
  m.reset();
  assert.deepEqual(m.update('two', false), { backspaces: 0, insert: 'two' });
});

test('armed modifier + one letter = shortcut', () => {
  assert.deepEqual(shortcutFromInsert('c', ['cmd']), { k: 'c', mods: ['cmd'] });
  assert.deepEqual(shortcutFromInsert('C', ['cmd', 'shift']), { k: 'c', mods: ['cmd', 'shift'] });
  assert.equal(shortcutFromInsert('c', []), null);
  assert.equal(shortcutFromInsert('你', ['cmd']), null);
  assert.equal(shortcutFromInsert('ab', ['cmd']), null);
});
