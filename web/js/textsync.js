// Keeps the Mac in step with the phone's text box without a DOM.
//
// Live mode mirrors the text box: whatever the phone keyboard *commits* (after the IME finishes
// composing Zhuyin/Pinyin, after autocorrect replaces a word) is turned into "delete N, insert S".
// Text still being composed is never sent, so half-typed ㄋㄧˇ never reaches the Mac.

const segmenter =
  typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;

/** Grapheme clusters (an emoji family or é counts as one, like one Backspace on the Mac). */
export function graphemes(s) {
  if (!s) return [];
  if (segmenter) return Array.from(segmenter.segment(s), (x) => x.segment);
  return Array.from(s);
}

/** Minimal edit from `before` to `after` at the end of the text: {backspaces, insert}. */
export function textDiff(before, after) {
  const a = graphemes(before);
  const b = graphemes(after);
  let p = 0;
  while (p < a.length && p < b.length && a[p] === b[p]) p++;
  return { backspaces: a.length - p, insert: b.slice(p).join('') };
}

export class TextMirror {
  constructor() {
    this.sent = '';
    this.composing = false;
  }

  compositionStart() {
    this.composing = true;
  }

  /** Returns ops to apply, or null while composing / nothing changed. */
  compositionEnd(value) {
    this.composing = false;
    return this.update(value, false);
  }

  update(value, isComposing) {
    if (isComposing || this.composing) return null;
    const d = textDiff(this.sent, value);
    this.sent = value;
    if (d.backspaces === 0 && d.insert === '') return null;
    return d;
  }

  /** Text box was cleared on purpose (after Enter / 清空); the Mac keeps what it has. */
  reset() {
    this.sent = '';
    this.composing = false;
  }
}

/**
 * Live mode timing (I-21). Plain keyboard typing — the net change is one character in or one character out —
 * still goes to the Mac at once (next tick, so a delete and an insert from the same edit cancel out first).
 * Anything bigger — iOS dictation streaming and rewriting its words, QuickType, autocorrect — waits until the
 * box has been still for `settleMs` and goes as one net diff, and so does everything else typed in the
 * `burstMs` after it. Dictation deletes a word and types it again, longer, many times per sentence; sent one by
 * one, every rewrite became "⌫×N + text" on the Mac, and where the ⌫ got lost the old word stayed (疊字).
 */
export class LiveTyping {
  /**
   * @param {object} o
   * @param {() => string} o.read   current text box value
   * @param {(ops: {backspaces:number, insert:string}, at: number) => void} o.send  `at` = when the first of these
   *   changes was typed (Date.now clock)
   * @param {() => boolean} [o.canSend]  false while the Mac is still busy with the last change or the link is down
   *   (PKM-4): the changes wait and go as one when `kick()` is called — on a Mac with Zhuyin every piece of text is a
   *   clipboard paste, and sending each key at once piled them up there, seconds behind the phone (卡頓), still being
   *   typed after Ray had moved on to the next window.
   */
  constructor({ read, send, canSend = () => true, settleMs = 700, burstMs = 1500, now = () => Date.now(),
    setTimer = (fn, ms) => setTimeout(fn, ms), clearTimer = (id) => clearTimeout(id) }) {
    Object.assign(this, { read, send, canSend, settleMs, burstMs, now, setTimer, clearTimer });
    this.mirror = new TextMirror();
    this.timer = null;
    this.burstUntil = 0;
    this.since = null;     // when the oldest unsent change was typed
    this.waiting = false;  // a flush found canSend() false
  }

  get composing() { return this.mirror.composing; }
  get sent() { return this.mirror.sent; }

  /** After every `input` event (composition updates are ignored; compositionEnd sends the chosen characters). */
  input(isComposing = false) {
    if (isComposing || this.mirror.composing) return;
    const d = textDiff(this.mirror.sent, this.read());
    if (d.backspaces === 0 && d.insert === '') return;   // back to what the Mac already has; a pending flush finds nothing
    if (this.since === null) this.since = this.now();
    const n = graphemes(d.insert).length;
    const simple = (d.backspaces === 0 && n === 1) || (d.backspaces === 1 && n === 0);
    const t = this.now();
    if (!simple) this.burstUntil = t + this.burstMs;
    this.schedule(simple && t >= this.burstUntil ? 0 : this.settleMs);
  }

  schedule(ms) {
    this.clearTimer(this.timer);
    this.timer = this.setTimer(() => this.flush(), ms);
  }

  get pending() { return this.timer !== null || this.waiting; }

  /** True when the box holds changes the Mac has not been sent. */
  get dirty() {
    const d = textDiff(this.mirror.sent, this.read());
    return d.backspaces > 0 || d.insert !== '';
  }

  /**
   * Send the net change now (Enter, blur, ⌫ on an empty box, composition end). `force` skips the wait for the Mac
   * to finish the previous change — used right before a click, a key or a gesture, so text always reaches the Mac
   * before whatever comes after it (a click that switches windows must not overtake the text, PKM-4 (d)).
   */
  flush(force = false) {
    this.clearTimer(this.timer);
    this.timer = null;
    if (this.mirror.composing) return null;
    if (!this.canSend(force)) {
      this.waiting = this.dirty;
      return null;
    }
    this.waiting = false;
    const ops = this.mirror.update(this.read(), false);
    const at = this.since ?? this.now();
    this.since = null;
    if (ops) this.send(ops, at);
    return ops;
  }

  /** The Mac caught up (or the link is back): send what waited, as one change. */
  kick() {
    if (this.waiting && this.timer === null) this.flush();
  }

  /**
   * Forget unsent changes without sending them (typed while the link was down, PKM-4 D-30). Returns the change that
   * was dropped, or null.
   */
  discardUnsent() {
    this.clearTimer(this.timer);
    this.timer = null;
    this.waiting = false;
    this.since = null;
    if (this.mirror.composing) return null;
    const d = textDiff(this.mirror.sent, this.read());
    this.mirror.sent = this.read();
    return d.backspaces > 0 || d.insert !== '' ? d : null;
  }

  compositionStart() {
    this.flush();
    this.mirror.compositionStart();
  }

  /** The IME committed (Zhuyin candidate picked): send right away, like a typed key. */
  compositionEnd() {
    this.mirror.composing = false;
    return this.flush();
  }

  /** Text box cleared on purpose; the Mac keeps what it has. */
  reset() {
    this.clearTimer(this.timer);
    this.timer = null;
    this.waiting = false;
    this.since = null;
    this.mirror.reset();
  }
}

/**
 * Keeps text that was just sent from going out a second time (I-24, Ray's P-22). After 送出／Enter the box is
 * emptied, but iOS dictation (or an input method) can put its own copy back — with or without an input event —
 * and the next keystroke, 送出 or mode switch then sent it again, to whatever app was in front on the Mac by then
 * (Orca text into LINE). Until the keyboard closes, a bulk insertion that is (part of) the text just cleared is
 * taken back out of the box instead of being sent.
 */
export class ClearedTextGuard {
  // Short texts (「好的」) are not guarded: they are often typed again on purpose and say little.
  constructor({ minLength = 4, pieceLength = 6 } = {}) {
    this.minLength = minLength;
    this.pieceLength = pieceLength;
    this.text = '';
  }

  /** The box was just emptied after sending `text`. */
  cleared(text) {
    this.text = graphemes(text.trim()).length >= this.minLength ? text : '';
  }

  /** Keyboard closed (dictation and input method sessions end with it). */
  forget() {
    this.text = '';
  }

  /**
   * `before` = box value last seen, `after` = value now. Returns the value with the returning text removed, or
   * null when there is nothing to remove. Typing and picking a word (a few characters at a time) never match.
   */
  check(before, after) {
    if (!this.text || after === before) return null;
    // what this edit inserted: the part of `after` between the common prefix and the common suffix
    let p = 0;
    while (p < before.length && p < after.length && before[p] === after[p]) p++;
    let q = 0;
    while (q < before.length - p && q < after.length - p && before[before.length - 1 - q] === after[after.length - 1 - q]) q++;
    const inserted = after.slice(p, after.length - q);
    const head = after.slice(0, p);
    const tail = after.slice(after.length - q);
    // the whole text that was sent, possibly with what was typed in the same edit around it
    const i = inserted.indexOf(this.text);
    if (i >= 0) return head + inserted.slice(0, i) + inserted.slice(i + this.text.length) + tail;
    // dictation putting back only its last sentence: the end of the sent text, at least `pieceLength` long
    const piece = inserted.trim();
    if (graphemes(piece).length >= this.pieceLength && this.text.trimEnd().endsWith(piece)) return head + tail;
    return null;
  }
}

/**
 * Local-only record of what the phone keyboard did to the text box and what was sent (PKM-3-1). Kept in memory,
 * shown in ⚙︎ 設定 so a real iOS dictation sequence can be looked at; never uploaded.
 */
export class InputLog {
  constructor(max = 400, now = () => Date.now()) {
    this.max = max;
    this.now = now;
    this.rows = [];
    this.t0 = null;
  }

  add(ev, f = {}) {
    const t = this.now();
    if (this.t0 === null) this.t0 = t;
    this.rows.push({ ms: t - this.t0, ev, ...f });
    if (this.rows.length > this.max) this.rows.splice(0, this.rows.length - this.max);
  }

  clear() {
    this.rows = [];
    this.t0 = null;
  }

  text() {
    const q = (s) => JSON.stringify(s);
    return this.rows.map((r) => {
      const parts = [String(r.ms).padStart(6), r.ev];
      if (r.type) parts.push(r.type);
      if (r.data != null) parts.push('data=' + q(r.data));
      if (r.len != null) parts.push('len=' + r.len);
      if (r.comp) parts.push('composing');
      if (r.tail != null) parts.push('…' + q(r.tail));
      if (r.ops) parts.push(`⌫${r.ops.backspaces}+${q(r.ops.insert)}`);
      return parts.join(' ');
    }).join('\n');
  }
}

/**
 * With a modifier armed (⌘ ⌥ ⌃), a single typed ASCII character becomes a shortcut instead of text:
 * arm ⌘, type "c" on the phone keyboard → ⌘C on the Mac.
 */
export function shortcutFromInsert(insert, armedMods) {
  if (!armedMods || armedMods.length === 0) return null;
  if (graphemes(insert).length !== 1) return null;
  const ch = insert.toLowerCase();
  if (!/^[a-z0-9`\-=[\]\\;',./ ]$/.test(ch)) return null;
  return { k: ch === ' ' ? 'space' : ch, mods: armedMods.slice() };
}
