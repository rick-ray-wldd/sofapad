// Replays iOS keyboard dictation against the live-mode text sync, old (v2) and new (I-21), and checks what the Mac
// ends up with. Ray's P-19 / P-20 (process/USER-PROMPTS.md) are the real Mac-side results: the phone showed the
// right text, the Mac got 「然後然後」「鍵盤鍵盤鍵盤」 and one whole sentence twice.
//
// Two things in the model are hypotheses (I-21), not measurements from a real iPhone:
//  - dictation rewrites a word as two edits in one go — delete it, insert it again (longer) — not one replace;
//  - on Ray's Mac (Zhuyin input source → every text op is a clipboard paste) a ⌫ that lands right before a paste
//    can get lost in the receiving app. `lossyMac` drops a ⌫ message followed by text within `gapMs`.
// With those two, the v2 pipeline reproduces the P-19 / P-20 text character for character.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TextMirror, LiveTyping, InputLog, graphemes } from '../js/textsync.js';

function fakeClock() {
  let t = 0;
  let seq = 0;
  const timers = new Map();
  return {
    now: () => t,
    setTimer: (fn, ms) => { const id = ++seq; timers.set(id, { at: t + ms, fn }); return id; },
    clearTimer: (id) => { timers.delete(id); },
    advance(to) {
      for (;;) {
        let next = null;
        for (const [id, x] of timers) if (x.at <= to && (!next || x.at < next[1].at)) next = [id, x];
        if (!next) break;
        timers.delete(next[0]);
        t = next[1].at;
        next[1].fn();
      }
      t = to;
    },
  };
}

/** Messages the phone sent, as the Mac receives them: {t, bs} or {t, text}. */
function toMessages(ops, t, out) {
  if (ops.backspaces > 0) out.push({ t, bs: ops.backspaces });
  if (ops.insert) out.push({ t, text: ops.insert });
}

/** v2 (up to 2dadfc6): every input event → ops at once; 1.5 s after the last send a box over 200 chars is cleared. */
function runOld(trace) {
  const c = fakeClock();
  const m = new TextMirror();
  const msgs = [];
  let box = '';
  let trim = null;
  for (const step of trace) {
    c.advance(step.at);
    box = step.edit(box);
    const ops = m.update(box, false);
    if (!ops) continue;
    toMessages(ops, c.now(), msgs);
    c.clearTimer(trim);
    trim = c.setTimer(() => { if (box.length > 200) { box = ''; m.reset(); } }, 1500);
  }
  const shown = box;                                  // what the phone showed when Ray finished talking
  c.advance(1e9);
  return { msgs, box: shown };
}

/** Now: LiveTyping, the box is only cleared on blur. */
function runNew(trace) {
  const c = fakeClock();
  const msgs = [];
  let box = '';
  const live = new LiveTyping({ read: () => box, send: (ops) => toMessages(ops, c.now(), msgs), now: c.now, setTimer: c.setTimer, clearTimer: c.clearTimer });
  for (const step of trace) {
    c.advance(step.at);
    box = step.edit(box);
    live.input(false);
  }
  c.advance(1e9);
  return { msgs, box };
}

function faithfulMac(msgs) {
  let s = [];
  for (const m of msgs) {
    if (m.bs) s = s.slice(0, Math.max(0, s.length - m.bs));
    else s.push(...graphemes(m.text));
  }
  return s.join('');
}

function lossyMac(msgs, gapMs = 50) {
  return faithfulMac(msgs.filter((m, i) => !(m.bs && msgs[i + 1] && msgs[i + 1].text && msgs[i + 1].t - m.t < gapMs)));
}

// Dictation edits: append, and "rewrite the last word" = delete it, then insert the new tail, in the same task.
const append = (at, s) => ({ at, edit: (v) => v + s });
const rewrite = (at, oldTail, newTail) => [
  { at, edit: (v) => { assert.ok(v.endsWith(oldTail), `box should end with ${oldTail}: ${v}`); return v.slice(0, -oldTail.length); } },
  { at, edit: (v) => v + newTail },
];

// P-19, second clause. Ray said 「然後現在需要按步驟，先按鍵盤打開來，」; the Mac got the line in P19_MAC.
const P19_SAID = '然後現在需要按步驟，先按鍵盤打開來，';
const P19_MAC = '然後然後現在需要按按步驟，步驟，先按鍵盤鍵盤鍵盤打開來，';
const p19Trace = [
  append(0, '然後'),
  ...rewrite(320, '然後', '然後現在需要按'),
  ...rewrite(650, '按', '按步驟，'),
  ...rewrite(980, '步驟，', '步驟，先按鍵盤'),
  ...rewrite(1250, '鍵盤', '鍵盤'),              // same word put back (dictation settling on it)
  ...rewrite(1560, '鍵盤', '鍵盤打開來，'),
];

test('P-19 replay: the phone box is right in both versions', () => {
  assert.equal(runOld(p19Trace).box, P19_SAID);
  assert.equal(runNew(p19Trace).box, P19_SAID);
});

test('P-19 replay, v2: correct if every ⌫ lands, but exactly Ray\'s 疊字 when the ⌫ before a paste is lost', () => {
  const { msgs } = runOld(p19Trace);
  assert.equal(faithfulMac(msgs), P19_SAID);
  assert.equal(lossyMac(msgs), P19_MAC);
  assert.equal(msgs.filter((m) => m.bs).length, 5); // five "⌫ + text" pairs, sent back to back
});

test('P-19 replay, now: rewrites inside the pause collapse to plain appends, so lost ⌫ cannot matter', () => {
  const { msgs } = runNew(p19Trace);
  assert.equal(msgs.filter((m) => m.bs).length, 0);
  assert.equal(faithfulMac(msgs), P19_SAID);
  assert.equal(lossyMac(msgs), P19_SAID);
  assert.ok(msgs.length < runOld(p19Trace).msgs.length);
});

// P-20: one whole sentence reached the Mac twice, back to back. The phone box held about 172 characters (under the
// 200 that the v2 auto-clear needs), so it is the same mechanism as P-19 at sentence size: when Ray stopped
// talking, dictation settled the sentence — deleted all of it and put it back — and the 71 ⌫ before the paste were lost.
const P20_BEFORE = '然後下面有一排可以橫移的一些快捷鍵，還有一些預設的像esc tab ... 這些方塊設定的，然後讓我去設定調配他們，還有新的客製化按鈕嗎？還要按那個進去，直接把一些像在工具列那個欄位，幫我參考列定選的。';
const P20_U = '然後去重新設計這個互動的方式，然後我現在在鍵盤這邊講話的時候我手機看到的是正確的文字內容，但是轉移到我Mac Mini上面就會有一些重複的疊字';
const P20_AFTER = '像你現在看到接收到的這樣就像你現在接收到是這樣請你幫我找出問題在哪然後進行優化和修正';
// What the Mac got for the end of P-20 (process/USER-PROMPTS.md), verbatim.
const P20_MAC_TAIL = '然後去重新設計這個互動的方式，然後我現在在鍵盤這邊講話的時候我手機看到的是正確的文字內容，但是轉移到我Mac Mini上面就會有一些重複的疊字然後去重新設計這個互動的方式，然後我現在在鍵盤這邊講話的時候我手機看到的是正確的文字內容，但是轉移到我Mac Mini上面就會有一些重複的疊字像你現在看到接收到的這樣就像你現在接收到是這樣請你幫我找出問題在哪然後進行優化和修正';
const p20Trace = [
  append(0, P20_BEFORE),
  append(700, P20_U.slice(0, 30)),
  append(1100, P20_U.slice(30, 60)),
  append(1500, P20_U.slice(60)),
  ...rewrite(2600, P20_U, P20_U),                    // Ray stops; dictation settles the sentence
  append(3900, P20_AFTER),
];

test('P-20 replay, v2: settling the sentence = ⌫71 + the sentence again; with the ⌫ lost, exactly what the Mac got', () => {
  assert.ok((P20_BEFORE + P20_U).length <= 200);    // the auto-clear did not fire here
  const { msgs, box } = runOld(p20Trace);
  assert.equal(box, P20_BEFORE + P20_U + P20_AFTER);
  assert.equal(faithfulMac(msgs), P20_BEFORE + P20_U + P20_AFTER);
  assert.ok(lossyMac(msgs).endsWith(P20_MAC_TAIL));
});

test('P-20 replay, now: the sentence put back unchanged sends nothing; the Mac gets it once', () => {
  const { msgs } = runNew(p20Trace);
  assert.equal(msgs.filter((m) => m.bs).length, 0);
  assert.equal(lossyMac(msgs), P20_BEFORE + P20_U + P20_AFTER);
});

// The v2 auto-clear (box over 200 characters, 1.5 s after the last send) could also fire in a dictation pause.
// If dictation then puts its sentence back into the emptied box, the Mac gets it again. Now the box is only
// cleared on blur, when the keyboard (and dictation) is gone.
test('auto-clear risk: v2 clears the box mid-dictation and resends the sentence; now it does not', () => {
  const long = P20_BEFORE + P20_BEFORE;
  const finish = (at) => ({ at, edit: (v) => (v.endsWith(P20_U) ? v.slice(0, -P20_U.length) : v) + P20_U });
  const trace = [append(0, long), append(700, P20_U), finish(2600), append(3200, P20_AFTER)];
  assert.equal(faithfulMac(runOld(trace).msgs), long + P20_U + P20_U + P20_AFTER);
  assert.equal(faithfulMac(runNew(trace).msgs), long + P20_U + P20_AFTER);
});

// ---- LiveTyping behaviour that plain typing depends on ----

function liveRig() {
  const c = fakeClock();
  const sent = [];
  let box = '';
  const live = new LiveTyping({ read: () => box, send: (ops) => sent.push({ t: c.now(), ...ops }), now: c.now, setTimer: c.setTimer, clearTimer: c.clearTimer });
  return { c, sent, live, type: (v, comp = false) => { box = v; live.input(comp); }, set: (v) => { box = v; } };
}

test('keyboard typing still goes at once: one character in or out → sent on the next tick', () => {
  const r = liveRig();
  r.type('h'); r.c.advance(1);
  r.type('hi'); r.c.advance(2);
  r.type('h'); r.c.advance(3);
  assert.deepEqual(r.sent.map(({ backspaces, insert }) => [backspaces, insert]), [[0, 'h'], [0, 'i'], [1, '']]);
  assert.deepEqual(r.sent.map((s) => s.t), [0, 1, 2]);
});

test('several characters at once (dictation, QuickType) wait for a 0.7 s pause, and so does typing right after', () => {
  const r = liveRig();
  r.type('今天'); r.c.advance(300);
  r.type('今天開會'); r.c.advance(600);
  assert.equal(r.sent.length, 0);
  r.c.advance(1300);
  assert.deepEqual(r.sent.map((s) => s.insert), ['今天開會']);
  r.type('今天開會。'); r.c.advance(1400);           // within 1.5 s of the burst: still held
  assert.equal(r.sent.length, 1);
  r.c.advance(2100);
  assert.deepEqual(r.sent.map((s) => s.insert), ['今天開會', '。']);
  r.c.advance(5000);
  r.type('今天開會。O'); r.c.advance(5001);           // burst over: immediate again
  assert.equal(r.sent.at(-1).insert, 'O');
});

test('a delete and an insert in the same tick cancel out before anything is sent', () => {
  const r = liveRig();
  r.type('鍵盤'); r.c.advance(1000);
  assert.equal(r.sent.length, 1);
  r.c.advance(5000);
  r.type('鍵'); r.type('鍵盤'); r.c.advance(5001);
  assert.equal(r.sent.length, 1);
});

test('Zhuyin: nothing while composing; the picked word goes at once; a pending burst is sent before composing starts', () => {
  const r = liveRig();
  r.type('Hello world'); r.c.advance(100);
  assert.equal(r.sent.length, 0);
  r.live.compositionStart();                          // pending burst flushed first
  assert.deepEqual(r.sent.map((s) => s.insert), ['Hello world']);
  r.type('Hello worldㄋ', true); r.type('Hello worldㄋㄧˇ', true);
  r.set('Hello world你');
  r.live.compositionEnd();
  assert.deepEqual(r.sent.map((s) => s.insert), ['Hello world', '你']);
  r.c.advance(10000);
  assert.equal(r.sent.length, 2);
});

test('flush() sends what is pending now (Enter, blur, ⌫ on an empty box) and only once', () => {
  const r = liveRig();
  r.type('說完了');
  assert.deepEqual(r.live.flush(), { backspaces: 0, insert: '說完了' });
  r.c.advance(5000);
  assert.equal(r.sent.length, 1);
  assert.equal(r.live.flush(), null);
});

test('input log: rows, ring buffer, readable text', () => {
  let t = 1000;
  const log = new InputLog(3, () => t);
  log.add('input', { type: 'insertText', data: '鍵盤', len: 2, tail: '鍵盤' });
  t += 5; log.add('input', { type: 'deleteContentBackward', data: null, len: 0, tail: '' });
  t += 5; log.add('send', { ops: { backspaces: 0, insert: '鍵盤' } });
  t += 5; log.add('compstart', { len: 2, comp: true });
  assert.equal(log.rows.length, 3);
  const text = log.text();
  assert.match(text, /^\s+5 input deleteContentBackward len=0/);
  assert.match(text, /send ⌫0\+"鍵盤"/);
  assert.match(text, /compstart len=2 composing/);
});
