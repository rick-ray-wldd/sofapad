// Cursor pad (SOFA-6): hold, then drag, to move the text cursor on the Mac with the arrow keys — like holding the
// space bar on the iPhone keyboard. iOS's own space-bar cursor only moves inside the phone's text box, which the Mac
// never sees, so the phone needs its own pad for this. No DOM here (web/test/caret.test.mjs).
//
// - Hold `holdMs` without moving more than `slopPx`: cursor mode (the phone gives a short buzz). Moving earlier
//   cancels the touch, so a swipe across the bar never moves the cursor by accident.
// - Drag: one arrow press per `stepX` px sideways or `stepY` px up/down. The axis with the bigger movement of each
//   move event wins, so a sideways drag does not jump lines.
// - Selecting (Shift + arrows): the 選取 switch, or a second finger tapping while dragging (for this drag only).
// - Fast sideways movement (over `wordSpeed` px/ms): Option + ←/→, a word per press.
// - At most `maxPerSec` presses a second. What the finger asks for beyond that waits in a backlog of at most
//   `maxBacklog` presses, the rest is dropped; lifting the finger drops the backlog at once, so the cursor never keeps
//   going after the finger stopped.

export class CaretPad {
  /**
   * @param {object} o
   * @param {(p: {k: 'left'|'right'|'up'|'down', mods: string[]}) => void} o.press  one arrow press for the Mac
   * @param {(on: boolean) => void} [o.onMode]  cursor mode started / ended
   * @param {(selecting: boolean) => void} [o.onSelect]  selecting turned on / off
   * @param {() => void} [o.buzz]
   */
  constructor({ press, onMode = () => {}, onSelect = () => {}, buzz = () => {}, now = () => performance.now(),
    setTimer = (fn, ms) => setTimeout(fn, ms), clearTimer = (id) => clearTimeout(id),
    holdMs = 300, slopPx = 10, stepX = 14, stepY = 28, wordSpeed = 1.5, maxPerSec = 30, maxBacklog = 2 }) {
    Object.assign(this, { press, onMode, onSelect, buzz, now, setTimer, clearTimer, holdMs, slopPx, stepX, stepY,
      wordSpeed, maxPerSec, maxBacklog });
    this.state = 'idle';       // idle → holding → active → idle
    this.sticky = false;       // 選取 switch
    this.temp = false;         // second-finger tap, this drag only
    this.holdTimer = null;
    this.drainTimer = null;
    this.backlog = [];
    this.nextAt = 0;
    this.sentCount = 0;
  }

  get active() { return this.state === 'active'; }
  get selecting() { return this.sticky || this.temp; }

  /** The 選取 switch. */
  setSelect(on) {
    const before = this.selecting;
    this.sticky = !!on;
    if (this.selecting !== before) this.onSelect(this.selecting);
  }

  start(x, y) {
    this.end();
    this.state = 'holding';
    this.origin = { x, y };
    this.holdTimer = this.setTimer(() => this.activate(), this.holdMs);
  }

  activate() {
    this.holdTimer = null;
    if (this.state !== 'holding') return;
    this.state = 'active';
    this.last = { ...this.origin, t: this.now() };
    this.acc = { x: 0, y: 0 };
    this.samples = [];
    this.buzz();
    this.onMode(true);
  }

  move(x, y) {
    if (this.state === 'holding') {
      if (Math.hypot(x - this.origin.x, y - this.origin.y) > this.slopPx) this.cancel();
      return;
    }
    if (this.state !== 'active') return;
    const t = this.now();
    const dx = x - this.last.x;
    const dy = y - this.last.y;
    this.last = { x, y, t };
    this.samples.push({ t, dx });
    while (this.samples.length && t - this.samples[0].t > 80) this.samples.shift();
    const span = this.samples.length > 1 ? t - this.samples[0].t : 0;
    const speed = span > 0 ? Math.abs(this.samples.reduce((s, m) => s + m.dx, 0)) / span : 0;   // px/ms sideways
    if (Math.abs(dx) >= Math.abs(dy)) { this.acc.x += dx; this.acc.y = 0; } else { this.acc.y += dy; this.acc.x = 0; }
    const word = speed > this.wordSpeed;
    const sx = word ? this.stepX * 3 : this.stepX;
    while (Math.abs(this.acc.x) >= sx) {
      const k = this.acc.x > 0 ? 'right' : 'left';
      this.acc.x -= Math.sign(this.acc.x) * sx;
      this.queue(k, word);
    }
    while (Math.abs(this.acc.y) >= this.stepY) {
      const k = this.acc.y > 0 ? 'down' : 'up';
      this.acc.y -= Math.sign(this.acc.y) * this.stepY;
      this.queue(k, false);
    }
  }

  /** Another finger touched down while dragging: select for the rest of this drag (tap again: stop selecting). */
  secondTap() {
    if (this.state !== 'active') return;
    const before = this.selecting;
    this.temp = !this.temp;
    if (this.selecting !== before) this.onSelect(this.selecting);
    this.buzz();
  }

  queue(k, word) {
    const mods = [];
    if (this.selecting) mods.push('shift');
    if (word && (k === 'left' || k === 'right')) mods.push('opt');
    const p = { k, mods };
    const t = this.now();
    if (this.backlog.length === 0 && t >= this.nextAt) { this.emit(p, t); return; }
    if (this.backlog.length < this.maxBacklog) this.backlog.push(p);
    if (this.drainTimer === null) this.drainTimer = this.setTimer(() => this.drain(), Math.max(0, this.nextAt - t));
  }

  emit(p, t) {
    this.nextAt = t + 1000 / this.maxPerSec;
    this.sentCount++;
    this.press(p);
  }

  drain() {
    this.drainTimer = null;
    if (this.state !== 'active' || this.backlog.length === 0) { this.backlog = []; return; }
    const t = this.now();
    if (t < this.nextAt) { this.drainTimer = this.setTimer(() => this.drain(), this.nextAt - t); return; }
    this.emit(this.backlog.shift(), t);
    if (this.backlog.length) this.drainTimer = this.setTimer(() => this.drain(), 1000 / this.maxPerSec);
  }

  /** Finger moved before the hold time: not a cursor drag. */
  cancel() {
    this.clearTimer(this.holdTimer);
    this.holdTimer = null;
    this.state = 'idle';
  }

  /** Finger lifted (or the touch was cancelled): stop at once, nothing left over. */
  end() {
    this.clearTimer(this.holdTimer);
    this.clearTimer(this.drainTimer);
    this.holdTimer = null;
    this.drainTimer = null;
    this.backlog = [];
    const was = this.state === 'active';
    this.state = 'idle';
    if (this.temp) {
      this.temp = false;
      if (!this.sticky) this.onSelect(false);
    }
    if (was) this.onMode(false);
  }
}
