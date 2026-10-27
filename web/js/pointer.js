// Trackpad logic with no DOM: pointer acceleration, gesture recognition and scroll momentum.
// Coordinates are CSS pixels, time is milliseconds. Output deltas are Mac points.

/** Pointer gain for a finger speed in px/ms. Slow = precise, fast = covers a big virtual display. */
export function pointerGain(speed, sensitivity = 1.5, acceleration = 0.6) {
  const lo = 0.04;
  const hi = 1.2;
  const k = Math.min(1, Math.max(0, (speed - lo) / (hi - lo)));
  const smooth = k * k * (3 - 2 * k); // smoothstep
  const minGain = 0.7;
  const maxGain = minGain + 4 * acceleration;
  return sensitivity * (minGain + (maxGain - minGain) * smooth);
}

export const DEFAULT_GESTURE = {
  tapMaxMs: 220,
  tapMaxMove: 9,
  longPressMs: 450,
  twoFingerTapMaxMs: 300,
  sensitivity: 1.5,
  acceleration: 0.6,
  scrollSpeed: 1.0,
  longPressDrag: true,
  threeFingerSwipe: true,
  swipeMinMove: 40, // px the three-finger centroid must travel before a swipe fires
  pinchZoom: true,
  pinchDecide: 16, // px of spread change that can turn a two-finger touch into a pinch
  pinchStep: 1.25, // finger-spread ratio per zoom step
  navFlick: false, // two-finger fast horizontal flick = back / forward (off: clashes with horizontal scrolling)
  navFlickMinMove: 70,
  navFlickMaxMs: 260,
};

function centroid(touches) {
  let x = 0;
  let y = 0;
  for (const t of touches) {
    x += t.x;
    y += t.y;
  }
  return { x: x / touches.length, y: y / touches.length };
}

function spread(touches) {
  return Math.hypot(touches[0].x - touches[1].x, touches[0].y - touches[1].y);
}

/** Dominant direction of a move, or null when it is too short or too diagonal. */
function direction(dx, dy, min) {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  if (Math.max(ax, ay) < min) return null;
  if (ax >= ay * 1.3) return dx < 0 ? 'left' : 'right';
  if (ay >= ax * 1.3) return dy < 0 ? 'up' : 'down';
  return null;
}

/**
 * Gesture state machine for the trackpad area.
 *  - 1 finger drag: move the cursor (with acceleration)
 *  - 1 finger tap: left click
 *  - 1 finger long press, then drag: left-button drag (lift to drop)
 *  - 2 finger tap: right click
 *  - 2 finger drag: scroll (momentum after lift); optional fast horizontal flick: back / forward
 *  - 2 finger pinch: zoom steps
 *  - 3 finger swipe: one swipe per gesture (left / right / up / down)
 * Feed it `start/move/end` with the full list of current touches: [{id, x, y}].
 * It calls `emit(action)` with {type:'move'|'click'|'down'|'up'|'scroll'|'momentum'|'dragStart'|'dragEnd'
 * |'zoom'|'swipe', ...}; zoom has dir 'in'|'out', swipe has fingers 2|3 and dir 'left'|'right'|'up'|'down'.
 */
export class TrackpadGestures {
  // Wrapped: browsers throw "Illegal invocation" when setTimeout is called with another `this`.
  constructor(emit, options = {}, timers = { set: (fn, ms) => setTimeout(fn, ms), clear: (id) => clearTimeout(id) }) {
    this.emit = emit;
    this.opt = { ...DEFAULT_GESTURE, ...options };
    this.timers = timers;
    this.reset();
  }

  setOptions(options) {
    this.opt = { ...this.opt, ...options };
  }

  reset() {
    this.state = 'idle'; // idle | one | moving | drag | two | scrolling | pinch | three | wait
    this.start = null;
    this.last = null;
    this.startTime = 0;
    this.lastTime = 0;
    this.speed = 0;
    this.velocity = { x: 0, y: 0 };
    this.maxTouches = 0;
    this.cancelLongPress();
  }

  cancelLongPress() {
    if (this.longPressTimer != null) {
      this.timers.clear(this.longPressTimer);
      this.longPressTimer = null;
    }
  }

  start_(touches, t) {
    this.handle('start', touches, t);
  }

  handle(kind, touches, t) {
    if (kind === 'start') return this.onStart(touches, t);
    if (kind === 'move') return this.onMove(touches, t);
    return this.onEnd(touches, t, kind === 'cancel');
  }

  onStart(touches, t) {
    this.maxTouches = Math.max(this.maxTouches, touches.length);
    if (this.state === 'idle' && touches.length === 1) {
      this.state = 'one';
      this.start = { ...touches[0] };
      this.last = { ...touches[0] };
      this.startTime = t;
      this.lastTime = t;
      this.speed = 0;
      if (this.opt.longPressDrag) {
        this.longPressTimer = this.timers.set(() => {
          this.longPressTimer = null;
          if (this.state === 'one') {
            this.state = 'drag';
            this.emit({ type: 'down', button: 'left' });
            this.emit({ type: 'dragStart' });
          }
        }, this.opt.longPressMs);
      }
      return;
    }
    if ((this.state === 'one' || this.state === 'idle' || this.state === 'two') && touches.length >= 3
        && this.opt.threeFingerSwipe) {
      // A third finger joined before anything moved: three-finger swipe (fingers rarely land together).
      this.cancelLongPress();
      this.state = 'three';
      this.start = centroid(touches.slice(0, 3));
      this.startTime = t;
      return;
    }
    if ((this.state === 'one' || this.state === 'idle') && touches.length >= 2) {
      // A second finger joined before the first one moved: two-finger gesture.
      this.cancelLongPress();
      this.state = 'two';
      const c = centroid(touches.slice(0, 2));
      this.start = c;
      this.last = c;
      this.startTime = t;
      this.lastTime = t;
      this.velocity = { x: 0, y: 0 };
      this.startSpread = spread(touches);
      return;
    }
    if (this.state === 'moving' && touches.length >= 2) {
      // Moving with one finger and a second lands: switch to scrolling from here.
      this.state = 'scrolling';
      const c = centroid(touches.slice(0, 2));
      this.last = c;
      this.lastTime = t;
      this.velocity = { x: 0, y: 0 };
    }
  }

  onMove(touches, t) {
    if (touches.length === 0) return;
    const dt = Math.max(1, t - this.lastTime);
    if (this.state === 'one' || this.state === 'moving' || this.state === 'drag') {
      if (touches.length !== 1) return;
      const p = touches[0];
      const dx = p.x - this.last.x;
      const dy = p.y - this.last.y;
      if (this.state === 'one') {
        const total = Math.hypot(p.x - this.start.x, p.y - this.start.y);
        if (total <= this.opt.tapMaxMove) return; // still a tap candidate; don't move yet
        this.cancelLongPress();
        this.state = 'moving';
      }
      const inst = Math.hypot(dx, dy) / dt;
      this.speed = this.speed === 0 ? inst : this.speed * 0.6 + inst * 0.4;
      const g = pointerGain(this.speed, this.opt.sensitivity, this.opt.acceleration);
      this.last = { ...p };
      this.lastTime = t;
      if (dx !== 0 || dy !== 0) this.emit({ type: 'move', dx: dx * g, dy: dy * g });
      return;
    }
    if (this.state === 'three') {
      if (touches.length < 3) return;
      const c = centroid(touches.slice(0, 3));
      const dir = direction(c.x - this.start.x, c.y - this.start.y, this.opt.swipeMinMove);
      if (dir) {
        this.emit({ type: 'swipe', fingers: 3, dir });
        this.state = 'wait'; // one swipe per gesture; the rest is ignored until all fingers lift
      }
      return;
    }
    if (this.state === 'pinch') {
      if (touches.length < 2) return;
      // One zoom step each time the finger spread changes by pinchStep since the last step.
      let ratio = spread(touches) / this.pinchAnchor;
      while (ratio >= this.opt.pinchStep) {
        this.emit({ type: 'zoom', dir: 'in' });
        this.pinchAnchor *= this.opt.pinchStep;
        ratio /= this.opt.pinchStep;
      }
      while (ratio <= 1 / this.opt.pinchStep) {
        this.emit({ type: 'zoom', dir: 'out' });
        this.pinchAnchor /= this.opt.pinchStep;
        ratio *= this.opt.pinchStep;
      }
      return;
    }
    if (this.state === 'two' || this.state === 'scrolling') {
      if (touches.length < 2) return;
      const c = centroid(touches.slice(0, 2));
      if (this.state === 'two') {
        const moved = Math.hypot(c.x - this.start.x, c.y - this.start.y);
        const spreadChange = Math.abs(spread(touches) - this.startSpread);
        if (this.opt.pinchZoom && spreadChange > this.opt.pinchDecide && spreadChange > moved * 1.2) {
          // Fingers move apart / together while their middle stays put: pinch, not scroll.
          this.state = 'pinch';
          this.pinchAnchor = this.startSpread;
          this.onMove(touches, t);
          return;
        }
        if (moved <= this.opt.tapMaxMove) return;
        this.state = 'scrolling';
        this.scrollStart = { ...this.start, t: this.startTime };
      }
      const dx = (c.x - this.last.x) * this.opt.scrollSpeed;
      const dy = (c.y - this.last.y) * this.opt.scrollSpeed;
      this.velocity = { x: this.velocity.x * 0.5 + (dx / dt) * 0.5, y: this.velocity.y * 0.5 + (dy / dt) * 0.5 };
      this.last = c;
      this.lastTime = t;
      if (dx !== 0 || dy !== 0) this.emit({ type: 'scroll', dx, dy });
    }
  }

  onEnd(touches, t, cancelled) {
    const remaining = touches.length;
    if (this.state === 'one') {
      this.cancelLongPress();
      if (!cancelled && t - this.startTime <= this.opt.tapMaxMs) this.emit({ type: 'click', button: 'left' });
      this.finish(remaining);
      return;
    }
    if (this.state === 'moving') {
      this.finish(remaining);
      return;
    }
    if (this.state === 'drag') {
      if (remaining === 0) {
        this.emit({ type: 'up', button: 'left' });
        this.emit({ type: 'dragEnd' });
        this.reset();
      }
      return;
    }
    if (this.state === 'two') {
      if (!cancelled && t - this.startTime <= this.opt.twoFingerTapMaxMs) this.emit({ type: 'click', button: 'right' });
      this.finish(remaining);
      return;
    }
    if (this.state === 'scrolling') {
      // Optional: a short, fast, clearly horizontal two-finger flick means back / forward instead.
      const s = this.scrollStart;
      if (this.opt.navFlick && !cancelled && s && remaining <= 1 && t - s.t <= this.opt.navFlickMaxMs) {
        const dx = this.last.x - s.x;
        const dy = this.last.y - s.y;
        if (Math.abs(dx) >= this.opt.navFlickMinMove && Math.abs(dx) >= Math.abs(dy) * 2.5) {
          this.emit({ type: 'swipe', fingers: 2, dir: dx < 0 ? 'left' : 'right' });
          this.finish(remaining);
          return;
        }
      }
      // Momentum only if the fingers were still moving when lifted.
      if (!cancelled && t - this.lastTime < 80) {
        const v = this.velocity;
        if (Math.hypot(v.x, v.y) > 0.15) this.emit({ type: 'momentum', vx: v.x, vy: v.y });
      }
      this.finish(remaining);
      return;
    }
    if (this.state === 'pinch' || this.state === 'three' || this.state === 'wait') this.finish(remaining);
  }

  /** After a gesture ends, ignore leftover fingers until all are lifted. */
  finish(remaining) {
    if (remaining === 0) this.reset();
    else {
      this.cancelLongPress();
      this.state = 'wait';
    }
  }
}

/** Exponential decay of a scroll fling. Call step(dtMs) each frame until it returns null. */
export class Momentum {
  constructor(vx, vy, { friction = 0.94, minSpeed = 0.03 } = {}) {
    this.vx = vx;
    this.vy = vy;
    this.friction = friction;
    this.minSpeed = minSpeed;
  }

  step(dt) {
    const decay = Math.pow(this.friction, dt / 16.67);
    this.vx *= decay;
    this.vy *= decay;
    if (Math.hypot(this.vx, this.vy) < this.minSpeed) return null;
    return { dx: this.vx * dt, dy: this.vy * dt };
  }
}

/** Accumulates move deltas between animation frames so we send at most one move per frame. */
export class MoveCoalescer {
  constructor() {
    this.dx = 0;
    this.dy = 0;
  }
  add(dx, dy) {
    this.dx += dx;
    this.dy += dy;
  }
  take() {
    if (this.dx === 0 && this.dy === 0) return null;
    const out = { dx: Math.round(this.dx * 100) / 100, dy: Math.round(this.dy * 100) / 100 };
    this.dx = 0;
    this.dy = 0;
    return out;
  }
}
