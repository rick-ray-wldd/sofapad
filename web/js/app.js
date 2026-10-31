// Phone page: wires the trackpad, buttons, keyboard box and settings to the WebSocket link.
import { Link } from './connection.js';
import { TrackpadGestures, Momentum, MoveCoalescer } from './pointer.js';
import { LiveTyping, InputLog, ClearedTextGuard, shortcutFromInsert } from './textsync.js';
import { CaretPad } from './caret.js';
import { LayoutStore, ROWS, ROW_NAMES, catalog } from './keyrow.js';
import { VERSION, BUILD } from './version.js';
import { BUILTIN_GROUPS, KEY_GROUPS, MODIFIERS, ShortcutStore, comboLabel, keyLabel, gestureShortcut, hotkeyHint, macStatusText } from './shortcuts.js';
import { t, setLang, translate } from './i18n.js';

const $ = (id) => document.getElementById(id);

// Language and theme (SOFA-10): js/boot.js picked both before the page was drawn; every text comes from the
// dictionaries (js/lang/), and relabel() below redraws them all when the language changes in ⚙︎.
const prefs = window.pkmPrefs;
setLang(prefs.currentLang());
translate(document);

/** Tap handler that never takes focus away from the text box (so the phone keyboard stays up). */
function tap(el, fn) {
  el.addEventListener('touchstart', (e) => { e.preventDefault(); fn(e); }, { passive: false });
  el.addEventListener('click', (e) => { if (e.detail === 0 || !('ontouchstart' in window)) fn(e); });
}

/**
 * Tap for buttons inside a scrolling list: the list can still scroll when a swipe starts on a button.
 * Only a touch that ends where it started counts; cancelling its touchend suppresses the click, so focus
 * (and the phone keyboard) stays where it was.
 */
function tapScrollable(el, fn) {
  let start = null;
  el.addEventListener('touchstart', (e) => { const t = e.changedTouches[0]; start = { x: t.clientX, y: t.clientY }; }, { passive: true });
  el.addEventListener('touchmove', (e) => {
    const t = e.changedTouches[0];
    if (start && Math.hypot(t.clientX - start.x, t.clientY - start.y) > 10) start = null;
  }, { passive: true });
  el.addEventListener('touchend', (e) => {
    if (!start) return;
    start = null;
    if (e.cancelable) e.preventDefault();
    fn(e);
  }, { passive: false });
  el.addEventListener('click', (e) => { if (e.detail === 0 || !('ontouchstart' in window)) fn(e); });
}

/**
 * Buttons in the key row (PKM-2-3, I-19). The row scrolls sideways, so a swipe that starts on a button must
 * scroll it instead of pressing it: nothing is cancelled on touchstart, the key goes on touchend when the finger
 * stayed put, and a held `onRepeat` key starts repeating after 420 ms (first call gets `true`). Cancelling the
 * touchend keeps focus, and so the phone keyboard, where it was.
 */
function stripButton(el, { onTap, onRepeat = null }) {
  let start = null;
  let repeated = false;
  let repeatTimer = null;
  let repeatInterval = null;
  const stop = () => {
    clearTimeout(repeatTimer);
    clearInterval(repeatInterval);
    repeatTimer = repeatInterval = null;
    el.classList.remove('active');
  };
  el.addEventListener('touchstart', (e) => {
    const t = e.changedTouches[0];
    start = { x: t.clientX, y: t.clientY };
    repeated = false;
    el.classList.add('active');
    if (onRepeat) {
      repeatTimer = setTimeout(() => {
        if (!start) return;
        repeated = true;
        onRepeat(true);
        repeatInterval = setInterval(() => onRepeat(false), 70);
      }, 420);
    }
  }, { passive: true });
  el.addEventListener('touchmove', (e) => {
    const t = e.changedTouches[0];
    if (start && !repeated && Math.hypot(t.clientX - start.x, t.clientY - start.y) > 10) { start = null; stop(); }
  }, { passive: true });
  el.addEventListener('touchend', (e) => {
    const tapped = !!start && !repeated;
    const held = repeated;
    start = null;
    repeated = false;
    stop();
    if ((tapped || held) && e.cancelable) e.preventDefault();
    if (tapped) onTap(e);
  }, { passive: false });
  el.addEventListener('touchcancel', () => { start = null; repeated = false; stop(); });
  el.addEventListener('click', (e) => { if (e.detail === 0 || !('ontouchstart' in window)) onTap(e); });
}

// ---------- storage (private mode / blocked storage must not break the page) ----------
const store = {
  get(k) {
    try { return localStorage.getItem('pkm.' + k); } catch { return null; }
  },
  set(k, v) {
    try { localStorage.setItem('pkm.' + k, v); } catch { /* ignore */ }
  },
  del(k) {
    try { localStorage.removeItem('pkm.' + k); } catch { /* ignore */ }
  },
};

const DEFAULTS = {
  sens: 1.5, accel: 0.6, scroll: 1.0, reverse: false, lefty: false, longPress: true,
  hapticsOn: true, autocorrect: false, enterAfter: false, mode: 'live',
  threeFinger: true, pinch: true, navFlick: false, sidePanel: true,
};
let settings = { ...DEFAULTS };
try { settings = { ...DEFAULTS, ...JSON.parse(store.get('settings') || '{}') }; } catch { /* defaults */ }
const saveSettings = () => store.set('settings', JSON.stringify(settings));

// ---------- viewport: follow the visual viewport so the pad stays above the iOS keyboard ----------
const root = document.documentElement;
const appEl = $('app');
function fitViewport() {
  const vv = window.visualViewport;
  if (vv) {
    root.style.setProperty('--vvh', vv.height + 'px');
    root.style.setProperty('--vvtop', vv.offsetTop + 'px');
  }
  updateLayout();
}

/**
 * Layout mode (D-14): `typing` while the text box has focus (portrait: bar, mouse buttons and mini-map step
 * aside; landscape: the text row appears under the full-screen pad); `kbd` when the on-screen keyboard is
 * really up (focus + visual viewport clearly shorter than the layout viewport; iOS can leave a ~24 px
 * difference after the keyboard closes, S-105), so the bottom safe area it covers is dropped.
 */
function updateLayout() {
  const input = document.getElementById('input');
  const typing = !!input && document.activeElement === input;
  const vv = window.visualViewport;
  const kbd = typing && !!vv && vv.height < window.innerHeight - 120;
  appEl.classList.toggle('typing', typing);
  appEl.classList.toggle('kbd', kbd);
}
if (window.visualViewport) {
  visualViewport.addEventListener('resize', fitViewport);
  visualViewport.addEventListener('scroll', fitViewport);
}
window.addEventListener('orientationchange', () => setTimeout(fitViewport, 300));
fitViewport();

// ---------- haptics: iOS 18+ ticks when a switch checkbox toggles; Android has vibrate ----------
const hapticLabel = $('hapticLabel');
function haptic() {
  if (!settings.hapticsOn) return;
  if (navigator.vibrate) navigator.vibrate(8);
  else hapticLabel.click();
}

// ---------- link ----------
const deviceName = /iPhone/.test(navigator.userAgent) ? 'iPhone' : /Android/.test(navigator.userAgent) ? 'Android' : 'phone';
const wsURL = (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws';
const link = new Link({ url: wsURL, store, onState, onEvent, deviceName });
window.pkmLink = link; // for tests and the latency page

const dot = $('dot');
const hostEl = $('host');
const rttEl = $('rtt');
const banner = $('banner');
const pairSheet = $('pairSheet');
const pairMsg = $('pairMsg');
let bannerState = { perm: true, secure: false, locked: false, offline: false, replaced: false, note: null };
let hotkeysOff = new Set(); // macOS shortcuts the gestures need that are switched off on this Mac
let macSpaces = null;        // Spaces on the Mac (desktops + full-screen apps); null = unknown
let macKnown = false;        // ⚙︎ shows the Mac's version and shortcuts once it has said hello
function renderMacStatus() {
  const el = $('macStatus');
  if (!macKnown) { el.textContent = t('set.macStatus.waiting'); return; }
  const s = macStatusText(hotkeysOff, macSpaces);
  el.textContent = s.text;
  el.classList.toggle('bad', s.bad);
}

function renderBanner() {
  let text = '';
  let bad = false;
  if (bannerState.replaced) { text = t('banner.replaced'); bad = true; }
  else if (bannerState.offline) text = t('banner.offline');
  else if (bannerState.locked) { text = t('banner.locked'); bad = true; }
  else if (!bannerState.perm) { text = t('banner.perm'); bad = true; }
  else if (bannerState.secure) text = t('banner.secure');
  else if (bannerState.note) text = bannerState.note();
  banner.hidden = !text;
  banner.textContent = text;
  banner.classList.toggle('bad', bad);
}

/** The host line follows the link's state; kept so it can be said again in another language. */
let hostShown = { state: '', info: {} };
function renderHost() {
  const { state, info } = hostShown;
  if (state === 'ready') hostEl.textContent = info.host || link.host || 'Mac';
  else if (state === 'need_pair') hostEl.textContent = t('host.unpaired', { host: info.host || link.host || 'Mac' });
  else if (state === 'connecting') hostEl.textContent = info.attempt ? t('host.reconnecting', { n: info.attempt }) : t('host.connecting');
  else if (state === 'offline') hostEl.textContent = t('host.offline');
  else hostEl.textContent = t('host.finding');
}

function onState(state, info) {
  hostShown = { state, info };
  dot.className = 'dot ' + (state === 'ready' ? 'ready' : state === 'offline' ? '' : 'connecting');
  $('fabDot').className = dot.className;
  $('sideDot').className = dot.className;
  renderHost();
  if (state === 'ready') {
    renderVersion();
    // typed while the link was down: never sent later (D-30)
    if (settings.mode === 'live' && typeof live !== 'undefined') {
      const dropped = live.discardUnsent();
      if (dropped) {
        input.value = '';
        live.reset();
        lastSeen = '';
        autosize();
        note(() => t('note.dropped'), 6000);
      }
      else if (info.reconnected) note(() => t('note.reconnected'), 2000);
    } else if (info.reconnected) note(() => t('note.reconnected'), 2000);
    bannerState = { ...bannerState, offline: false, replaced: false, perm: info.perm !== false, secure: !!info.secure, locked: !!info.locked };
    pairSheet.hidden = true;
    if (info.screen && info.screen.w && info.screen.h) root.style.setProperty('--aspect', String(info.screen.w / info.screen.h));
    hotkeysOff = new Set(info.hotkeysOff || []);
    macSpaces = typeof info.spaces === 'number' ? info.spaces : null;
    macKnown = true;
    renderMacStatus();
  } else if (state === 'need_pair') {
    bannerState.offline = false;
    pairSheet.hidden = false;
  } else if (state === 'offline') {
    rttEl.textContent = '';
    if (info.reason === 'replaced') bannerState.replaced = true;
    else bannerState.offline = true;
    releaseLocalState();
  }
  renderBanner();
}

/** ⚙︎ shows this page's version and the Mac app's (PKM-4: tell an old page or an old app from the new one). */
function renderVersionLine() {
  const el = $('versionLine');
  if (!el) return;
  if (!macKnown) { el.textContent = t('set.version.loading'); return; }
  const mac = link.mac;
  const build = (b) => (b === 'dev' ? t('set.version.dev') : t('set.version.built', { time: b }));
  el.textContent = t('set.version', {
    page: t('set.version.build', { ver: VERSION, build: build(BUILD) }),
    mac: mac ? t('set.version.build', { ver: mac.ver, build: build(mac.build) }) : t('set.version.old'),
  });
  el.classList.toggle('bad', !mac || mac.ver !== VERSION);
}
function renderVersion() {
  macKnown = true;
  renderVersionLine();
  const mac = link.mac;
  if (!mac || mac.ver !== VERSION) note(() => t('note.versions'), 8000);
}

/** A short message in the banner. `text` is a function, so a message on screen follows a change of language. */
let noteTimer = null;
function note(text, ms = 4000) {
  bannerState.note = text;
  renderBanner();
  clearTimeout(noteTimer);
  noteTimer = setTimeout(() => { bannerState.note = null; renderBanner(); }, ms);
}

function onEvent(m) {
  switch (m.t) {
    case 'rtt':
      rttEl.textContent = Math.round(m.rtt) + ' ms';
      break;
    case 'status':
      bannerState.perm = m.perm !== false;
      bannerState.secure = !!m.secure;
      bannerState.locked = !!m.locked;
      renderBanner();
      break;
    case 'ack':
      if (m.ok === false && m.err === 'locked') { bannerState.locked = true; renderBanner(); }
      else if (m.ok === false && m.err === 'late') { /* reported as 'undelivered' */ }
      else if (m.ok === false) note(() => t('note.refused', { err: m.err || t('note.refused.unknown') }));
      else if (m.warn === 'secure_input') note(() => t('note.secureInput'));
      if (m.hotkey) {
        // ⌃←→↑↓: the Mac says, right now, whether the shortcut is on and how many Spaces there are (PKM-2-3)
        if (m.hotkeyOff) hotkeysOff.add(m.hotkey); else hotkeysOff.delete(m.hotkey);
        if (typeof m.spaces === 'number') macSpaces = m.spaces;
        macKnown = true;
        renderMacStatus();
        if (hotkeyHint(m)) note(() => hotkeyHint(m), 10000);
      }
      break;
    case 'drained':
      live.kick();   // the Mac caught up: what was typed meanwhile goes now, as one piece
      break;
    case 'undelivered': {
      // Sent just before the connection dropped and not typed on the Mac. Never sent again (D-30): another window
      // may be in front by now. Said here; in 整段 an empty box gets the text back so 送出 can send it on purpose.
      const text = m.items.filter((x) => x.t === 'text').map((x) => x.s).join('');
      const keys = m.items.filter((x) => x.t === 'key').length;
      const say = (key) => () => t(key, {
        what: text ? t('note.undelivered.text', { text: text.length > 24 ? text.slice(0, 24) + '…' : text }) : t('note.undelivered.keys', { n: keys }),
        why: m.restarted ? t('note.undelivered.restarted') : m.late ? t('note.undelivered.late', { s: (m.late / 1000).toFixed(1) }) : t('note.undelivered.dropped'),
      });
      inputLog.add('undelivered', { len: text.length, tail: text.slice(-16) });
      if (settings.mode === 'live') {
        // the box no longer matches what the Mac has: start clean (the Mac keeps what it typed)
        input.value = '';
        live.reset();
        lastSeen = '';
        autosize();
        note(say('note.undelivered.live'), 9000);
      } else if (text && !input.value) {
        input.value = text;
        lastSeen = text;
        guard.forget();
        autosize();
        note(say('note.undelivered.back'), 9000);
      } else {
        note(say('note.undelivered'), 9000);
      }
      break;
    }
    case 'notsent':
      if (m.msg.t === 'text' || m.msg.t === 'key') note(() => t('note.notsent'), 4000);
      break;
    case 'pairing':
      setPairMsg(() => t('pair.shown'));
      break;
    case 'auth_fail':
      setPairMsg(() => (PAIR_FAILS.includes(m.reason) ? t(`pair.fail.${m.reason}`, { s: m.retry || 30 }) : t('pair.fail')));
      break;
    case 'replaced':
      bannerState.replaced = true;
      renderBanner();
      break;
    default:
      break;
  }
}

$('statusBtn').addEventListener('click', () => {
  bannerState.replaced = false;
  link.reconnectNow();
});

// ---------- pairing ----------
const PAIR_FAILS = ['bad_code', 'pairing_closed', 'bad_token', 'locked', 'unauthenticated'];
let pairMsgText = null;
function setPairMsg(text) {
  pairMsgText = text;
  pairMsg.textContent = text ? text() : '';
}
const codeInput = $('codeInput');
function submitCode() {
  const code = codeInput.value.replace(/\D/g, '');
  if (code.length !== 6) {
    setPairMsg(() => t('pair.digits'));
    return;
  }
  setPairMsg(() => t('pair.pairing'));
  link.pair(code);
}
$('pairBtn').addEventListener('click', submitCode);
codeInput.addEventListener('input', () => {
  if (codeInput.value.replace(/\D/g, '').length === 6) submitCode();
});
$('requestBtn').addEventListener('click', () => {
  setPairMsg(() => t('pair.requested'));
  link.requestPairing();
});

const hashCode = /[#&]pair=(\d{6})/.exec(location.hash);
if (hashCode) {
  history.replaceState(null, '', location.pathname);
  link.pendingCode = hashCode[1];
}

// ---------- mouse sending ----------
const moves = new MoveCoalescer();
const scrolls = new MoveCoalescer();
let flushTimer = null;

function flushPointer() {
  flushTimer = null;
  const ws = link.ws;
  if (ws && ws.bufferedAmount > 8192) { // back-pressure: keep summing until the socket drains
    flushTimer = setTimeout(flushPointer, 8);
    return;
  }
  const m = moves.take();
  if (m) link.send({ t: 'move', dx: m.dx, dy: m.dy });
  const s = scrolls.take();
  if (s) link.send({ t: 'scroll', dx: s.dx, dy: s.dy });
}
function queueMove(dx, dy) {
  moves.add(dx, dy);
  if (!flushTimer) flushPointer();
}
function queueScroll(dx, dy) {
  const sign = settings.reverse ? -1 : 1;
  scrolls.add(dx * sign, dy * sign);
  if (!flushTimer) flushPointer();
}

let momentum = null;
let momentumFrame = 0;
function startMomentum(vx, vy) {
  momentum = new Momentum(vx, vy);
  let last = performance.now();
  cancelAnimationFrame(momentumFrame);
  const step = (now) => {
    if (!momentum) return;
    const d = momentum.step(now - last);
    last = now;
    if (!d) { momentum = null; return; }
    queueScroll(d.dx, d.dy);
    momentumFrame = requestAnimationFrame(step);
  };
  momentumFrame = requestAnimationFrame(step);
}
function stopMomentum() {
  momentum = null;
  cancelAnimationFrame(momentumFrame);
}

// ---------- trackpad ----------
const pad = $('pad');
const strip = $('strip');
const padHint = $('padHint');
const dragBadge = $('dragBadge');

const toastEl = $('toast');
let toastTimer = null;
function toast(text) {
  toastEl.textContent = text;
  toastEl.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastEl.hidden = true; }, 900);
}

/**
 * Live text still waiting on the phone goes out before a click, key or gesture (PKM-4 (d)): the Mac handles
 * messages in order, so text typed before switching windows always lands in the window it was typed for.
 */
function textFirst() {
  if (settings.mode === 'live' && typeof live !== 'undefined') live.flush(true);
}

/** Sends a Mac shortcut (key + modifiers) as a reliable, acked message. */
function sendCombo(s) {
  textFirst();
  commitLive('shortcut');
  link.sendReliable({ t: 'key', k: s.key, mods: s.mods, at: Date.now() });
  haptic();
}

const gestures = new TrackpadGestures((a) => {
  switch (a.type) {
    case 'move': queueMove(a.dx, a.dy); break;
    case 'scroll': queueScroll(a.dx, a.dy); break;
    case 'momentum': startMomentum(a.vx, a.vy); break;
    case 'click': commitLive('click'); link.send({ t: 'click', b: a.button }); haptic(); break;
    case 'down': commitLive('down'); link.send({ t: 'down', b: a.button }); break;
    case 'up': link.send({ t: 'up', b: a.button }); break;
    case 'dragStart': pad.classList.add('dragging'); dragBadge.hidden = false; haptic(); break;
    case 'dragEnd': pad.classList.remove('dragging'); dragBadge.hidden = !dragLocked; break;
    case 'swipe':
    case 'zoom': {
      // Native gestures become the matching macOS shortcuts (D-15); no private gesture events.
      const s = gestureShortcut(a);
      if (s) {
        sendCombo(s);
        toast(t('toast.combo', { name: s.label, combo: comboLabel(s) })); // if the Mac cannot do it, the ack brings a hint (hotkeyHint)
      }
      break;
    }
    default: break;
  }
});

function applyGestureSettings() {
  gestures.setOptions({
    sensitivity: settings.sens,
    acceleration: settings.accel,
    scrollSpeed: settings.scroll,
    longPressDrag: settings.longPress,
    threeFingerSwipe: settings.threeFinger,
    pinchZoom: settings.pinch,
    navFlick: settings.navFlick,
  });
}

/** Touches on the scroll strip, the floating buttons or the shortcut panel are not trackpad touches. */
const notPad = (el) => !!(el && el.closest && el.closest('.strip, .fab, .panel'));

function padTouches(e) {
  const out = [];
  for (const t of e.touches) {
    if (notPad(t.target)) continue;
    out.push({ id: t.identifier, x: t.clientX, y: t.clientY });
  }
  return out;
}

function onPadTouch(kind) {
  return (e) => {
    if (notPad(e.target)) return;
    e.preventDefault(); // keeps the iOS keyboard open and stops page scrolling/zooming
    if (kind === 'start') {
      textFirst();
      stopMomentum();
      padHint.classList.add('faded');
    }
    pad.classList.toggle('touching', e.touches.length > 0);
    gestures.handle(kind, padTouches(e), performance.now());
  };
}
pad.addEventListener('touchstart', onPadTouch('start'), { passive: false });
pad.addEventListener('touchmove', onPadTouch('move'), { passive: false });
pad.addEventListener('touchend', onPadTouch('end'), { passive: false });
pad.addEventListener('touchcancel', onPadTouch('cancel'), { passive: false });

// One-thumb scroll strip.
let stripLast = null;
let stripVel = 0;
function stripTouch(kind) {
  return (e) => {
    e.preventDefault();
    e.stopPropagation();
    const t = e.changedTouches[0];
    const now = performance.now();
    if (kind === 'start') {
      textFirst();
      stopMomentum();
      stripLast = { y: t.clientY, time: now };
      stripVel = 0;
      strip.classList.add('active');
      return;
    }
    if (!stripLast) return;
    if (kind === 'move') {
      const dy = (t.clientY - stripLast.y) * 1.6 * settings.scroll;
      const dt = Math.max(1, now - stripLast.time);
      stripVel = stripVel * 0.5 + (dy / dt) * 0.5;
      stripLast = { y: t.clientY, time: now };
      if (dy) queueScroll(0, dy);
      return;
    }
    strip.classList.remove('active');
    if (kind === 'end' && now - stripLast.time < 80 && Math.abs(stripVel) > 0.15) startMomentum(0, stripVel);
    stripLast = null;
  };
}
strip.addEventListener('touchstart', stripTouch('start'), { passive: false });
strip.addEventListener('touchmove', stripTouch('move'), { passive: false });
strip.addEventListener('touchend', stripTouch('end'), { passive: false });
strip.addEventListener('touchcancel', stripTouch('cancel'), { passive: false });

// ---------- mouse buttons ----------
function holdButton(el, button) {
  const down = (e) => {
    e.preventDefault();
    textFirst();
    commitLive('button');
    el.classList.add('active');
    link.send({ t: 'down', b: button });
    haptic();
  };
  const up = (e) => {
    e.preventDefault();
    if (!el.classList.contains('active')) return;
    el.classList.remove('active');
    link.send({ t: 'up', b: button });
  };
  el.addEventListener('touchstart', down, { passive: false });
  el.addEventListener('touchend', up, { passive: false });
  el.addEventListener('touchcancel', up, { passive: false });
  el.addEventListener('mousedown', down);
  el.addEventListener('mouseup', up);
  el.addEventListener('mouseleave', up);
}
holdButton($('btnLeft'), 'left');
holdButton($('btnRight'), 'right');

const btnLock = $('btnLock');
let dragLocked = false;
function setDragLock(on, notify = true) {
  if (on === dragLocked) return;
  dragLocked = on;
  btnLock.setAttribute('aria-pressed', String(on));
  for (const id of ['fabLock', 'sideLock']) $(id).setAttribute('aria-pressed', String(on));
  renderLock();
  dragBadge.hidden = !on;
  pad.classList.toggle('dragging', on);
  if (notify) link.send({ t: on ? 'down' : 'up', b: 'left' });
  haptic();
}
function renderLock() {
  btnLock.textContent = t(dragLocked ? 'btn.release' : 'btn.lock');
  for (const id of ['fabLock', 'sideLock']) $(id).textContent = t(dragLocked ? 'fab.release' : 'fab.lock');
}
tap(btnLock, () => setDragLock(!dragLocked));
tap($('fabLock'), () => setDragLock(!dragLocked));
tap($('sideLock'), () => setDragLock(!dragLocked));

/** Connection lost or page hidden: forget local "held" state (the Mac side releases on its own). */
function releaseLocalState() {
  setDragLock(false, false);
  for (const id of ['btnLeft', 'btnRight']) $(id).classList.remove('active');
  stopMomentum();
  gestures.reset();
  pad.classList.remove('dragging', 'touching');
  dragBadge.hidden = true;
}

// ---------- keys ----------
const armed = new Set();
function armedList() { return Array.from(armed); }
function clearArmed() {
  armed.clear();
  for (const b of document.querySelectorAll('.controls [data-mod]')) b.classList.remove('armed');
}

function sendKey(k, mods = []) {
  textFirst();
  commitLive('key');
  const all = Array.from(new Set([...mods, ...armedList()]));
  link.sendReliable({ t: 'key', k, mods: all, at: Date.now() });
  clearArmed();
}

function bindModButton(b) {
  stripButton(b, { onTap: () => {
    const m = b.dataset.mod;
    if (armed.has(m)) armed.delete(m); else armed.add(m);
    for (const x of document.querySelectorAll(`.controls [data-mod="${m}"]`)) x.classList.toggle('armed', armed.has(m));
    haptic();
  } });
}

function bindKeyButton(b) {
  const k = b.dataset.k;
  const mods = b.dataset.mods ? b.dataset.mods.split(',') : [];
  stripButton(b, {
    onTap: () => { sendKey(k, mods); haptic(); },
    // held: the first press takes the armed modifiers, the repeats are the bare key (as before)
    onRepeat: b.hasAttribute('data-repeat') ? (first) => { if (first) { sendKey(k, mods); haptic(); } else link.sendReliable({ t: 'key', k, mods }); } : null,
  });
}

// ‹ › at the ends of the key row while there is more to scroll to (I-19)
const keyStrip = $('keyStrip');
const keysWrap = $('keysWrap');
function updateKeysHint() {
  const max = keyStrip.scrollWidth - keyStrip.clientWidth;
  keysWrap.classList.toggle('more-left', keyStrip.scrollLeft > 4);
  keysWrap.classList.toggle('more-right', keyStrip.scrollLeft < max - 4);
}
keyStrip.addEventListener('scroll', updateKeysHint, { passive: true });
if (window.ResizeObserver) new ResizeObserver(updateKeysHint).observe(keyStrip);

// The rows (PKM-3-1 ②, D-28; SOFA-8, D-47): the input row's cells next to the box, the key row (即時／整段 and
// ⌘ 快捷鍵 stay first, ✎ edits) and, in landscape, the side panel's extra cells. All three come from the saved layout;
// the cursor pad and ⇧ 選取 are cells too, so they can be moved or taken out like any key.
const customShortcuts = new ShortcutStore(store);
const layout = new LayoutStore(store, () => customShortcuts.items);
const inputCells = $('inputCells');
const sideCells = $('sideCells');
function cellButton(it) {
  const b = document.createElement('button');
  b.className = 'row-item';
  b.textContent = it.label;
  b.title = it.name;
  b.dataset.id = it.id;
  if (it.kind === 'select') {
    // ⇧ 選取 (SOFA-6): the cursor pad selects (Shift + arrows) until it is pressed again
    b.id = 'caretSelect';
    b.classList.add('caret-select');
    b.setAttribute('aria-label', t('caret.select.aria'));
    b.setAttribute('aria-pressed', String(caretPad.sticky));
    stripButton(b, { onTap: () => { caretPad.setSelect(!caretPad.sticky); haptic(); renderCaret(); } });
  } else if (it.kind === 'mod') {
    b.dataset.mod = it.mod;
    b.classList.add('mod');
    b.classList.toggle('armed', armed.has(it.mod));
    bindModButton(b);
  } else {
    b.dataset.k = it.k;
    if (it.mods.length) b.dataset.mods = it.mods.join(',');
    if (it.repeat) b.setAttribute('data-repeat', '');
    bindKeyButton(b);
  }
  return b;
}
function fillRow(container, row) {
  for (const it of layout.items(row)) container.append(it.kind === 'caret' ? caretPadEl : cellButton(it));
}
function editButton() {
  const edit = document.createElement('button');
  edit.className = 'row-edit';
  edit.textContent = t('keys.edit');
  edit.setAttribute('aria-label', t('keys.edit.aria'));
  stripButton(edit, { onTap: () => openRowEditor('keys') });
  return edit;
}
function renderRows() {
  layout.prune();
  // the cursor pad is one element, moved to the row it is in; taken out of every row, a drag on it ends
  if (!layout.where('x:caret')) { caretTouch = null; caretPad.end(); caretPadEl.remove(); }
  if (!layout.where('x:select') && caretPad.sticky) caretPad.setSelect(false);
  inputCells.textContent = '';
  fillRow(inputCells, 'input');
  for (const b of keyStrip.querySelectorAll('.row-item, .row-edit')) b.remove();
  fillRow(keyStrip, 'keys');
  keyStrip.append(editButton());
  sideCells.textContent = '';
  fillRow(sideCells, 'side');
  sideCells.append(editButton());
  renderCaret();
  updateKeysHint();
}

// ---------- row editor ----------
const rowSheet = $('rowSheet');
const rowCurrent = $('rowCurrent');
const rowCatalog = $('rowCatalog');
let rowAddCustomPending = false;
let editRow = 'keys';
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

function openRowEditor(row = 'keys') {
  input.blur();
  editRow = row;
  $('rowMsg').textContent = '';
  renderRowEditor();
  rowSheet.hidden = false;
}
function rowChanged(msg) {
  renderRowEditor();
  renderRows();
  if (msg != null) $('rowMsg').textContent = msg;
}
function renderRowEditor() {
  layout.prune();
  for (const t of $('rowTabs').querySelectorAll('[data-row]')) t.setAttribute('aria-selected', String(t.dataset.row === editRow));
  $('rowNote').textContent = t('rowed.note', { row: t(`rowed.note.${editRow}`) });
  rowCurrent.textContent = '';
  const items = layout.items(editRow);
  items.forEach((it, i) => {
    const li = el('li');
    li.dataset.id = it.id;
    const handle = el('span', 'handle', '≡');
    handle.setAttribute('aria-label', t('rowed.drag.aria', { label: it.label }));
    const small = (text, label, fn, disabled) => {
      const b = el('button', '', text);
      b.type = 'button';
      b.setAttribute('aria-label', label);
      b.disabled = disabled;
      b.addEventListener('click', fn);
      return b;
    };
    li.append(handle, el('span', 'lbl', it.label), el('span', 'nm', it.name),
      small('↑', t('rowed.earlier'), () => { layout.move(editRow, it.id, -1); rowChanged(''); }, i === 0),
      small('↓', t('rowed.later'), () => { layout.move(editRow, it.id, 1); rowChanged(''); }, i === items.length - 1),
      small('✕', t('rowed.remove'), () => { layout.remove(editRow, it.id); rowChanged(t('rowed.removed', { row: ROW_NAMES[editRow], label: it.label })); }, false));
    rowCurrent.append(li);
  });
  if (!items.length) rowCurrent.append(el('li', 'empty', t('rowed.empty')));
  rowCatalog.textContent = '';
  for (const g of catalog(customShortcuts.items)) {
    const chips = el('div', 'chips');
    if (!g.items.length) chips.append(el('p', 'empty', t('rowed.noCustom')));
    for (const it of g.items) {
      const b = el('button');
      b.type = 'button';
      b.dataset.id = it.id;
      b.setAttribute('aria-pressed', String(layout.has(editRow, it.id)));
      b.append(document.createTextNode(it.label));
      const elsewhere = it.id.startsWith('x:') && layout.where(it.id) && layout.where(it.id) !== editRow ? layout.where(it.id) : null;
      if (it.name !== it.label || elsewhere) b.append(el('small', '', elsewhere ? t('rowed.in', { row: ROW_NAMES[elsewhere] }) : it.name));
      b.addEventListener('click', () => {
        if (layout.has(editRow, it.id)) { layout.remove(editRow, it.id); rowChanged(t('rowed.removed', { row: ROW_NAMES[editRow], label: it.label })); return; }
        const from = layout.where(it.id);
        const r = layout.add(editRow, it.id);
        rowChanged(r !== true ? r : it.id.startsWith('x:') && from
          ? t('rowed.moved', { label: it.label, from: ROW_NAMES[from], to: ROW_NAMES[editRow] })
          : t('rowed.added', { row: ROW_NAMES[editRow], label: it.label, name: it.name }));
      });
      chips.append(b);
    }
    rowCatalog.append(el('h3', '', g.label), chips);
  }
}
for (const t of $('rowTabs').querySelectorAll('[data-row]')) {
  t.addEventListener('click', () => { editRow = t.dataset.row; $('rowMsg').textContent = ''; renderRowEditor(); });
}
// Drag ≡ to reorder: the item jumps to the place nearest the finger (works for the list and the wrapped
// landscape layout alike).
let rowDrag = null;
rowCurrent.addEventListener('pointerdown', (e) => {
  const handle = e.target.closest('.handle');
  if (!handle) return;
  const li = handle.closest('li');
  rowDrag = { id: li.dataset.id, pointer: e.pointerId };
  rowCurrent.setPointerCapture(e.pointerId);
  li.classList.add('dragging');
  e.preventDefault();
});
rowCurrent.addEventListener('pointermove', (e) => {
  if (!rowDrag || e.pointerId !== rowDrag.pointer) return;
  // near the top or bottom of the editor, scroll it so a long list can be dragged end to end
  const card = rowCurrent.closest('.sheet-card');
  const cr = card.getBoundingClientRect();
  if (e.clientY < cr.top + 48) card.scrollTop -= 16;
  else if (e.clientY > cr.bottom - 48) card.scrollTop += 16;
  const lis = [...rowCurrent.querySelectorAll('li[data-id]')];
  let best = -1;
  let bestD = Infinity;
  lis.forEach((li, i) => {
    const r = li.getBoundingClientRect();
    const d = Math.hypot(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2));
    if (d < bestD) { bestD = d; best = i; }
  });
  const from = layout.ids(editRow).indexOf(rowDrag.id);
  if (best >= 0 && layout.moveTo(editRow, from, best)) {
    renderRowEditor();
    const moved = [...rowCurrent.querySelectorAll('li[data-id]')].find((li) => li.dataset.id === rowDrag.id);
    if (moved) moved.classList.add('dragging');
  }
});
const endRowDrag = () => { if (!rowDrag) return; rowDrag = null; rowChanged(''); };
rowCurrent.addEventListener('pointerup', endRowDrag);
rowCurrent.addEventListener('pointercancel', endRowDrag);
$('rowDone').addEventListener('click', () => { rowSheet.hidden = true; });
$('rowReset').addEventListener('click', () => { layout.reset(); rowChanged(t('rowed.wasReset')); });
$('rowEditBtn').addEventListener('click', () => { $('settingsSheet').hidden = true; openRowEditor('input'); });

// ---------- shortcut panel (built-in + "我的") and the custom shortcut editor ----------
const panel = $('shortcutPanel');
const shortcutList = $('shortcutList');

function shortcutButton(s, closeAfter) {
  const b = document.createElement('button');
  const combo = document.createElement('span');
  combo.className = 'combo';
  combo.textContent = comboLabel(s);
  const name = document.createElement('span');
  name.className = 'name';
  name.textContent = s.label;
  b.append(combo, name);
  b.dataset.combo = comboLabel(s);
  tapScrollable(b, () => {
    sendCombo(s);
    toast(t('toast.combo', { name: s.label, combo: comboLabel(s) }));
    if (closeAfter) setPanel(false);
  });
  return b;
}

function renderPanel() {
  shortcutList.textContent = '';
  const groups = [{ id: 'mine', label: t('panel.mine'), items: customShortcuts.items }, ...BUILTIN_GROUPS];
  for (const g of groups) {
    const section = document.createElement('section');
    section.className = 'sc-group';
    section.dataset.group = g.id;
    const h = document.createElement('h3');
    h.textContent = g.label;
    section.append(h);
    if (g.id === 'mine' && g.items.length === 0) {
      const p = document.createElement('p');
      p.className = 'sc-empty';
      p.textContent = t('panel.mine.empty');
      section.append(p);
    } else {
      const grid = document.createElement('div');
      grid.className = 'sc-grid';
      // Custom ones close the panel (usually a one-off); editing ones keep it open for copy → paste.
      for (const s of g.items) grid.append(shortcutButton(s, g.id === 'mine' || !!s.close));
      section.append(grid);
    }
    shortcutList.append(section);
  }
}

function setPanel(open) {
  if (open) renderPanel();
  panel.hidden = !open;
  $('fabShortcuts').setAttribute('aria-pressed', String(open));
}
stripButton($('shortcutsBtn'), { onTap: () => setPanel(panel.hidden) });
tap($('fabShortcuts'), () => setPanel(panel.hidden));
tap($('closeShortcuts'), () => setPanel(false));

// Editor
const editorSheet = $('editorSheet');
const customList = $('customList');
const form = $('shortcutForm');
const scKey = $('scKey');
let editingId = null;
let picked = new Set();

function renderKeyOptions() {
  const value = scKey.value;
  scKey.textContent = '';
  for (const g of KEY_GROUPS) {
    const og = document.createElement('optgroup');
    og.label = g.label;
    for (const k of g.keys) {
      const o = document.createElement('option');
      o.value = k;
      o.textContent = k.length > 1 && keyLabel(k) !== k ? t('key.option', { label: keyLabel(k), key: k }) : keyLabel(k);
      og.append(o);
    }
    scKey.append(og);
  }
  if (value) scKey.value = value;
}
renderKeyOptions();
for (const m of MODIFIERS) {
  const b = document.createElement('button');
  b.type = 'button';
  b.dataset.pick = m.id;
  b.setAttribute('aria-pressed', 'false');
  b.textContent = `${m.symbol} ${m.name}`;
  $('modPicks').append(b);
}

function formValue() {
  return { label: $('scLabel').value, key: scKey.value, mods: MODIFIERS.map((m) => m.id).filter((m) => picked.has(m)) };
}
function renderPreview() {
  $('scPreview').textContent = comboLabel(formValue());
  for (const b of form.querySelectorAll('[data-pick]')) b.setAttribute('aria-pressed', String(picked.has(b.dataset.pick)));
}
function openForm(item) {
  editingId = item ? item.id : null;
  picked = new Set(item ? item.mods : ['cmd']);
  $('scLabel').value = item ? item.label : '';
  scKey.value = item ? item.key : 'a';
  $('scMsg').textContent = '';
  form.hidden = false;
  renderPreview();
}
for (const b of form.querySelectorAll('[data-pick]')) {
  b.addEventListener('click', () => {
    const m = b.dataset.pick;
    if (picked.has(m)) picked.delete(m); else picked.add(m);
    renderPreview();
  });
}
scKey.addEventListener('change', renderPreview);
$('scLabel').addEventListener('input', renderPreview);
form.addEventListener('submit', (e) => {
  e.preventDefault();
  const v = formValue();
  if (v.mods.length === 0 && /^[a-z0-9]$/.test(v.key)) {
    $('scMsg').textContent = t('ed.needMod');
    return;
  }
  const wasNew = !editingId;
  const r = editingId ? customShortcuts.update(editingId, v) : customShortcuts.add(v);
  if (typeof r === 'string') { $('scMsg').textContent = r; return; }
  form.hidden = true;
  renderCustomList();
  if (rowAddCustomPending && wasNew) {
    // came from the key row editor's「＋ 新增自訂按鈕」: put it on the row and go back there
    rowAddCustomPending = false;
    layout.add(editRow, `u:${r.id}`);
    editorSheet.hidden = true;
    rowChanged(t('rowed.customAdded', { row: ROW_NAMES[editRow], combo: comboLabel(r), label: r.label }));
  }
});
$('scCancel').addEventListener('click', () => {
  form.hidden = true;
  if (rowAddCustomPending) { rowAddCustomPending = false; editorSheet.hidden = true; }
});
$('rowAddCustom').addEventListener('click', () => {
  rowAddCustomPending = true;
  renderCustomList();
  $('ioMsg').textContent = '';
  editorSheet.hidden = false;
  openForm(null);
});

function renderCustomList() {
  customList.textContent = '';
  customShortcuts.items.forEach((s, i) => {
    const li = document.createElement('li');
    const combo = document.createElement('span');
    combo.className = 'combo';
    combo.textContent = comboLabel(s);
    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = s.label;
    const btn = (text, label, fn, disabled = false) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = text;
      b.setAttribute('aria-label', label);
      b.disabled = disabled;
      b.addEventListener('click', fn);
      return b;
    };
    li.append(combo, name,
      btn('↑', t('ed.up'), () => { customShortcuts.move(s.id, -1); renderCustomList(); }, i === 0),
      btn('↓', t('ed.down'), () => { customShortcuts.move(s.id, 1); renderCustomList(); }, i === customShortcuts.items.length - 1),
      btn('✎', t('ed.edit'), () => openForm(s)),
      btn('✕', t('ed.delete'), () => { customShortcuts.remove(s.id); renderCustomList(); }));
    customList.append(li);
  });
  if (!panel.hidden) renderPanel();
  renderRows();                         // a renamed or deleted custom shortcut changes the rows too
  if (!rowSheet.hidden) renderRowEditor();
}

$('editShortcuts').addEventListener('click', () => {
  input.blur();
  renderCustomList();
  form.hidden = true;
  $('ioMsg').textContent = '';
  editorSheet.hidden = false;
});
$('addShortcut').addEventListener('click', () => openForm(null));
$('closeEditor').addEventListener('click', () => { rowAddCustomPending = false; editorSheet.hidden = true; renderPanel(); });
$('exportBtn').addEventListener('click', () => {
  const io = $('ioText');
  io.value = customShortcuts.exportJSON();
  io.focus();
  io.select();
  let copied = false;
  try { copied = document.execCommand('copy'); } catch { copied = false; }
  $('ioMsg').textContent = copied ? t('io.copied', { n: customShortcuts.items.length }) : t('io.selected');
});
function doImport(mode) {
  const r = customShortcuts.importJSON($('ioText').value, mode);
  $('ioMsg').textContent = r.error ? t('io.failed', { error: r.error }) : t('io.imported', r);
  renderCustomList();
}
$('importAppend').addEventListener('click', () => doImport('append'));
const renderImportReplace = () => { const b = $('importReplace'); b.textContent = t(b.dataset.armed === '1' ? 'io.replace.again' : 'io.replace'); };
$('importReplace').addEventListener('click', () => {
  // Two-step confirm without a blocking dialog.
  const b = $('importReplace');
  if (b.dataset.armed !== '1') {
    b.dataset.armed = '1';
    renderImportReplace();
    setTimeout(() => { b.dataset.armed = ''; renderImportReplace(); }, 3000);
    return;
  }
  b.dataset.armed = '';
  renderImportReplace();
  doImport('replace');
});

// ---------- floating buttons (landscape full screen; typing in portrait) ----------
function fabKeyboard(e) {
  e.preventDefault();
  if (document.activeElement === input) {
    input.blur();
  } else {
    appEl.classList.add('typing'); // makes the text row visible in landscape before focusing it
    input.focus();
  }
  updateLayout();
}
// touchend (not touchstart): iOS only opens the keyboard for focus() inside a user-activation event.
for (const id of ['fabKeyboard', 'sideKeyboard']) {
  $(id).addEventListener('touchend', fabKeyboard, { passive: false });
  $(id).addEventListener('click', (e) => { if (e.detail === 0 || !('ontouchstart' in window)) fabKeyboard(e); });
}
for (const id of ['fabStatus', 'sideStatus']) tap($(id), () => { bannerState.replaced = false; link.reconnectNow(); });
for (const id of ['fabSettings', 'sideSettings']) $(id).addEventListener('click', () => $('settingsBtn').click());
// Landscape side panel (SOFA-8, D-48): ‹ collapses it (full-screen pad, as in 4.2), › on the floating buttons opens it.
// Collapsed, it still comes back while typing, since it has the text box.
function setSidePanel(open) {
  settings.sidePanel = open;
  saveSettings();
  applyAll();
  haptic();
}
tap($('sideClose'), () => setSidePanel(false));
tap($('fabSide'), () => setSidePanel(true));
const fsEnabled = document.fullscreenEnabled || document.webkitFullscreenEnabled;
if (fsEnabled) {
  // Only where the Fullscreen API really works (Android, iPad); iPhone Safari has none (D-16, S-109).
  $('fabFullscreen').hidden = false;
  $('fabFullscreen').addEventListener('click', () => {
    const el = document.documentElement;
    if (document.fullscreenElement || document.webkitFullscreenElement) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    else (el.requestFullscreen || el.webkitRequestFullscreen).call(el);
  });
}

// ---------- typing ----------
const input = $('input');
const sendBtn = $('sendBtn');
const modeBtn = $('modeBtn');
const inputLog = new InputLog();
// Live text waits while the Mac is still typing the previous piece, then goes as one (PKM-4); never while offline.
const live = new LiveTyping({
  read: () => input.value,
  send: applyOps,
  // SOFA-6: an ack that never comes must not hold the typing forever (卡住): after 3 s the next piece goes anyway
  canSend: (force) => link.state === 'ready' && (force || link.inFlight === 0 || stalled()),
});
function stalled() {
  const stuck = link.oldestPendingMs > 3000;
  if (stuck) inputLog.add('stall', { len: link.inFlight });
  return stuck;
}

function applyTypingSettings() {
  const live = settings.mode === 'live';
  modeBtn.textContent = t(live ? 'mode.live' : 'mode.buffer');
  appEl.classList.toggle('buffer', !live);
  sendBtn.hidden = live;
  input.setAttribute('autocorrect', settings.autocorrect ? 'on' : 'off');
  input.setAttribute('autocomplete', settings.autocorrect ? 'on' : 'off');
  input.setAttribute('enterkeyhint', live ? 'enter' : 'send');
  // short enough for one line in the half-width box (a wrapped placeholder makes the box, and the page, taller)
  input.placeholder = t(live ? 'input.placeholder.live' : 'input.placeholder.buffer');
}

function autosize() {
  input.style.height = 'auto';
  input.style.height = Math.min(input.scrollHeight, 110) + 'px';
}

function applyOps(ops, at = Date.now()) {
  if (!ops) return;
  inputLog.add('send', { ops });
  const shortcut = ops.backspaces === 0 ? shortcutFromInsert(ops.insert, armedList()) : null;
  if (shortcut) {
    // ⌘ armed + typed "c" → ⌘C; take the letter back out of the box.
    const keep = input.value.slice(0, input.value.length - ops.insert.length);
    input.value = keep;
    live.mirror.sent = keep;
    link.sendReliable({ t: 'key', k: shortcut.k, mods: shortcut.mods, at });
    clearArmed();
    queueMicrotask(() => commitLive('shortcut'));   // ⌘A, ⌘V… move the Mac's cursor too (SOFA-6)
    return;
  }
  if (ops.backspaces > 0) {
    let n = ops.backspaces;
    while (n > 0) {
      const chunk = Math.min(n, 200);
      link.sendReliable({ t: 'key', k: 'backspace', n: chunk, at });
      n -= chunk;
    }
  }
  if (ops.insert) link.sendReliable({ t: 'text', s: ops.insert, at });
}

const clip = (s) => (s == null ? s : s.slice(0, 24));

// Text that was just sent must never go out again (I-24): the guard takes it back out if iOS puts it back into the
// box, `lastSeen` is the box value the guard compares against (updated whenever it is not mid-composition).
const guard = new ClearedTextGuard();
let lastSeen = '';
function checkGhost() {
  const fixed = guard.check(lastSeen, input.value);
  if (fixed !== null) {
    inputLog.add('ghost', { len: input.value.length - fixed.length, tail: input.value.slice(-16) });
    input.value = fixed;
    autosize();
    note(() => t('note.ghost'), 5000);
  }
  lastSeen = input.value;
}
// Text can come back without any event (S2/S4 in tools/pkm33-send-clear.mjs): look again a few times a second,
// only while something was just sent (until the keyboard next closes).
setInterval(() => {
  if (guard.text && !live.composing) checkGhost();
}, 400);
/** Empty the box after `sent` went to the Mac; the Mac keeps it, the phone must not send it again. */
function clearSent(sent) {
  input.value = '';
  live.reset();
  guard.cleared(sent);
  lastSeen = '';
  autosize();
}

/**
 * SOFA-6 (Ray, 2026-10-29): in live mode the box only mirrors the Mac while the Mac's text cursor is where the typing left
 * it. A click, a key, a gesture, the cursor pad, closing the keyboard or leaving the page can move it — Ray clicks the
 * Mac app's own send button with the trackpad instead of pressing Enter — so each of them ends the piece: what is
 * still waiting goes to the Mac first, then the box is emptied and the next diff starts from nothing. Before, the old
 * text stayed in the box, and the next edit in it (a tap in the middle of it, iOS's space-bar cursor, a candidate
 * replacing a word) sent ⌫ and part of the old text again, into whatever was in front by then (跳出之前的字).
 * Never while the input method is still composing (emptying the box under an open IME brings the marked text back):
 * then the box is emptied when the composition ends. Text the Mac has not got (link down) stays in the box.
 * 整段 mode: the box is a draft that has not been sent; it stays.
 * Returns true when something was cleared.
 */
let commitAfterComposition = null;
function commitLive(reason) {
  if (settings.mode !== 'live') return false;
  if (live.composing) { commitAfterComposition = reason; return false; }
  checkGhost();
  live.flush(true);
  if (!input.value || live.dirty) return false;
  inputLog.add('commit', { type: reason, len: input.value.length });
  clearSent(input.value);
  return true;
}

/**
 * The keyboard closed (送出 button, tap elsewhere, app switch) while the input method was composing. iOS commits the
 * marked text then, but its compositionend and input may come after the blur — or not at all, and the phone then
 * waited for a composition end that never came (卡住). Wait for them up to 300 ms, accepting their input although
 * the box no longer has focus; after that, take the box as it is.
 */
let closing = null;
function closeComposition(fn, why) {
  if (!live.composing) { fn(); return; }
  if (closing) clearTimeout(closing.timer);
  inputLog.add('comp-closing', { type: why });
  closing = { fn, timer: setTimeout(() => finishComposition('timeout'), 300) };
}
function finishComposition(why) {
  const c = closing;
  closing = null;
  if (c) clearTimeout(c.timer);
  if (live.composing) {
    inputLog.add('comp-force', { type: why, len: input.value.length });
    live.mirror.composing = false;
  }
  if (c) c.fn();
}

input.addEventListener('focus', updateLayout);
input.addEventListener('blur', () => {
  updateLayout();
  inputLog.add('blur', { len: input.value.length });
  checkGhost();
  // Live: closing the keyboard (tapping elsewhere, switching apps) ends the piece — sent, box emptied (SOFA-6). Only
  // once the keyboard is gone: emptying the box while iOS dictation still listened made it write its sentence back
  // (I-21). The guard stays on after such a clear, so text iOS puts back now is not sent either.
  if (settings.mode === 'live') {
    if (live.composing) closeComposition(() => { if (!commitLive('blur')) guard.forget(); }, 'blur');
    else if (!commitLive('blur')) guard.forget();
  } else if (!closing) {
    guard.forget();   // keyboard gone: no dictation or input method session can put anything back now
  }
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && settings.mode === 'live') { checkGhost(); commitLive('hidden'); }
});
input.addEventListener('compositionstart', () => {
  inputLog.add('compstart', { len: input.value.length });
  checkGhost();
  if (settings.mode === 'live') live.compositionStart();
  else live.mirror.compositionStart();
});
let compEnding = false;
input.addEventListener('compositionend', (e) => {
  inputLog.add('compend', { data: clip(e.data), len: input.value.length });
  compEnding = true;
  // Let the final input event land first, then send once.
  setTimeout(() => {
    compEnding = false;
    if (settings.mode === 'live') { live.mirror.composing = false; checkGhost(); live.compositionEnd(); }
    else { live.mirror.composing = false; checkGhost(); }
    if (closing) finishComposition('compend');
    // a click / key came while composing: the piece ends now that the chosen characters are on the Mac (SOFA-6)
    if (commitAfterComposition && !live.composing) { const r = commitAfterComposition; commitAfterComposition = null; commitLive(r); }
  }, 0);
});
/**
 * iOS undo / redo in the box (shake, three-finger swipe or double tap — the same fingers that switch windows on the
 * pad — or ⌘Z on a keyboard) put text that was already sent and cleared back into the box, and it went to the Mac
 * again, into whatever window was in front by then (PKM-4, reproduced in the Simulator). The Mac never mirrors an
 * undo anyway, so the box has none: ⌘Z for the Mac is on the key row.
 */
const isHistory = (e) => e.inputType === 'historyUndo' || e.inputType === 'historyRedo';
function undoBlocked(e) {
  inputLog.add('undo-blocked', { type: e.inputType, len: input.value.length });
  note(() => t('note.undo'), 5000);
}
input.addEventListener('input', (e) => {
  autosize();
  inputLog.add('input', { type: e.inputType, data: clip(e.data), len: input.value.length, comp: e.isComposing, tail: input.value.slice(-16) });
  if (isHistory(e) || (document.activeElement !== input && !closing)) {
    // undo/redo that could not be cancelled, or text arriving while the keyboard is closed (nobody typed it):
    // put the box back the way it was, send nothing
    if (!isHistory(e)) inputLog.add('ghost-blurred', { len: input.value.length });
    else undoBlocked(e);
    input.value = lastSeen;
    autosize();
    return;
  }
  // An input that is not part of a composition, while a composition looked open and no compositionend is on its way:
  // the compositionend was lost. Without this the phone kept waiting for it and sent nothing more (卡住, SOFA-6).
  if (live.composing && !e.isComposing && !compEnding && !/Composition/.test(e.inputType || '')) {
    inputLog.add('comp-heal', { type: e.inputType });
    live.mirror.composing = false;
  }
  if (e.isComposing || live.composing) return;
  checkGhost();
  if (settings.mode === 'live') live.input(false);
});
function enterLive() {
  checkGhost();
  live.flush();
  const sent = live.sent;
  sendKey('enter');      // a key: the piece ends there (commitLive)
  clearSent(sent);       // and the guard keeps what was sent, for text iOS puts back (I-24)
}
input.addEventListener('beforeinput', (e) => {
  if (isHistory(e)) { e.preventDefault(); undoBlocked(e); return; }
  const isEnter = e.inputType === 'insertLineBreak' || e.inputType === 'insertParagraph';
  if (!isEnter || e.isComposing || live.composing) return;
  e.preventDefault();
  if (settings.mode === 'live') enterLive();
  else sendBuffered();
});
input.addEventListener('keydown', (e) => {
  if (e.isComposing || live.composing) return;
  if (e.key === 'Backspace' && input.value === '' && settings.mode === 'live') {
    e.preventDefault();
    live.flush();
    sendKey('backspace');
  }
  // Some Android keyboards send Enter only as keydown.
  if (e.key === 'Enter' && e.keyCode === 13 && settings.mode === 'live' && !e.shiftKey) {
    e.preventDefault();
    enterLive();
  }
});

function sendBuffered() {
  checkGhost();
  const text = input.value;
  if (link.state !== 'ready') {
    // never kept for later (D-30): the text stays here, Ray presses 送出 again once the dot is green
    if (text) note(() => t('note.bufferOffline'), 5000);
    return;
  }
  if (text) link.sendReliable({ t: 'text', s: text, at: Date.now() });
  if (settings.enterAfter) link.sendReliable({ t: 'key', k: 'enter', mods: [], at: Date.now() });
  clearSent(text);
  haptic();
}
// The 送出 button also closes the keyboard first: that ends iOS dictation, so it cannot put the text back (I-24).
// While the input method is composing, the characters picked are only in the box once it has committed them: wait for
// that (SOFA-6). Before, the button sent the marked Zhuyin (ㄋㄧˇ) and lost the character.
tap(sendBtn, () => {
  const composing = live.composing;
  if (document.activeElement === input) input.blur();
  if (composing) closeComposition(() => { sendBuffered(); guard.forget(); }, 'send');
  else sendBuffered();
});

// ---------- cursor pad (SOFA-6) ----------
// iOS's own space-bar cursor only moves the cursor inside the phone's box, which the Mac never sees: this pad moves the
// Mac's text cursor with arrow keys instead (js/caret.js). Starting it ends the typed piece first (commitLive), like
// any other key. Each press is one unacked `caret` message (at most 30 a second; the Mac only takes ←→↑↓ with ⇧ / ⌥).
// SOFA-8: one element, put by renderRows() into the row that has the `x:caret` cell (by default the input row, ⏎ to its right).
const caretPadEl = document.createElement('div');
caretPadEl.id = 'caretPad';
caretPadEl.className = 'caret-pad';
caretPadEl.setAttribute('role', 'slider');
caretPadEl.setAttribute('aria-label', t('caret.aria'));
const caretLabel = document.createElement('span');
caretLabel.id = 'caretLabel';
caretPadEl.append(caretLabel);
function renderCaret() {
  const on = caretPad.active;
  caretPadEl.classList.toggle('active', on);
  caretPadEl.classList.toggle('selecting', caretPad.selecting);
  $('caretSelect')?.setAttribute('aria-pressed', String(caretPad.sticky));
  caretLabel.textContent = t(!on ? (caretPad.sticky ? 'caret.idle.select' : 'caret.idle') : caretPad.selecting ? 'caret.selecting' : 'caret.moving');
}
const caretPad = new CaretPad({
  press: (p) => { link.send({ t: 'caret', k: p.k, mods: p.mods, n: 1 }); inputLog.add('caret', { data: (p.mods.length ? p.mods.join('+') + '+' : '') + p.k }); },
  onMode: (on) => {
    if (on) { textFirst(); commitLive('caret'); }
    renderCaret();
  },
  onSelect: renderCaret,
  buzz: haptic,
});
let caretTouch = null;   // the finger that drags
caretPadEl.addEventListener('touchstart', (e) => {
  e.preventDefault();   // keeps the keyboard up; no text selection or callout
  for (const t of e.changedTouches) {
    if (caretTouch === null) { caretTouch = t.identifier; caretPad.start(t.clientX, t.clientY); } else caretPad.secondTap();
  }
}, { passive: false });
caretPadEl.addEventListener('touchmove', (e) => {
  e.preventDefault();
  for (const t of e.changedTouches) if (t.identifier === caretTouch) caretPad.move(t.clientX, t.clientY);
}, { passive: false });
const caretLift = (e) => {
  for (const t of e.changedTouches) {
    if (t.identifier === caretTouch) { caretTouch = null; caretPad.end(); }
  }
};
caretPadEl.addEventListener('touchend', (e) => { e.preventDefault(); caretLift(e); }, { passive: false });
caretPadEl.addEventListener('touchcancel', caretLift);
// A second finger anywhere on the screen while dragging: select. Its whole touch is kept from the rest of the page,
// so it does not also click or start a gesture on the trackpad.
const swallowed = new Set();
document.addEventListener('touchstart', (e) => {
  if (caretTouch === null || e.target.closest?.('#caretPad')) return;
  e.preventDefault();
  e.stopPropagation();
  for (const t of e.changedTouches) swallowed.add(t.identifier);
  caretPad.secondTap();
}, { capture: true, passive: false });
for (const type of ['touchmove', 'touchend', 'touchcancel']) {
  document.addEventListener(type, (e) => {
    const ids = [...e.changedTouches].map((t) => t.identifier);
    if (!ids.length || !ids.every((id) => swallowed.has(id))) return;
    e.preventDefault();
    e.stopPropagation();
    if (type !== 'touchmove') for (const id of ids) swallowed.delete(id);
  }, { capture: true, passive: false });
}
document.addEventListener('visibilitychange', () => { if (document.hidden) { caretTouch = null; caretPad.end(); } });
renderRows();
if (layout.migrated === 'kept') note(() => t('note.migrated.kept'), 9000);
else if (layout.migrated === 'default') note(() => t('note.migrated.default'), 7000);

let discardArmed = 0;
stripButton(modeBtn, { onTap: () => {
  checkGhost();
  if (settings.mode === 'live') {
    // what was typed in live mode is already on the Mac (or goes now); it must not be sent again by 送出
    live.flush();
    if (input.value) clearSent(input.value);
  } else if (input.value.trim()) {
    // 整段 → 即時 never sends what is in the box (v2 did, I-24). Ask once; a second tap throws it away.
    if (Date.now() > discardArmed) {
      discardArmed = Date.now() + 6000;
      note(() => t('note.modeDiscard'), 6000);
      return;
    }
    input.value = '';
    lastSeen = '';
    autosize();
    note(() => t('note.modeDiscarded'));
  }
  discardArmed = 0;
  settings.mode = settings.mode === 'live' ? 'buffer' : 'live';
  saveSettings();
  live.reset();
  applyTypingSettings();
} });

// ---------- settings sheet ----------
const settingsSheet = $('settingsSheet');
const sliders = { sens: 'sensOut', accel: 'accelOut', scroll: 'scrollOut' };
const toggles = ['reverse', 'lefty', 'longPress', 'threeFinger', 'pinch', 'navFlick', 'hapticsOn', 'autocorrect', 'enterAfter', 'sidePanel'];

function applyAll() {
  applyGestureSettings();
  applyTypingSettings();
  appEl.classList.toggle('lefty', !!settings.lefty);
  appEl.classList.toggle('side-closed', !settings.sidePanel);
  $('sideClose').textContent = settings.lefty ? '›' : '‹';   // points the way the panel goes
  $('fabSide').textContent = settings.lefty ? '‹' : '›';
  updateKeysHint();
}

$('settingsBtn').addEventListener('click', () => {
  for (const [k, out] of Object.entries(sliders)) {
    $(k).value = settings[k];
    $(out).textContent = Number(settings[k]).toFixed(2);
  }
  for (const k of toggles) $(k).checked = !!settings[k];
  settingsSheet.hidden = false;
});
for (const [k, out] of Object.entries(sliders)) {
  $(k).addEventListener('input', () => {
    settings[k] = Number($(k).value);
    $(out).textContent = settings[k].toFixed(2);
    saveSettings();
    applyAll();
  });
}
for (const k of toggles) {
  $(k).addEventListener('change', () => {
    settings[k] = $(k).checked;
    saveSettings();
    applyAll();
  });
}
$('closeSettings').addEventListener('click', () => { settingsSheet.hidden = true; });
// Input log (PKM-3-1): rendered when opened; selecting is enough to copy on iOS (no clipboard API on http).
const inputLogText = $('inputLogText');
const renderInputLog = () => { inputLogText.value = inputLog.text() || t('set.log.empty'); };
$('inputLogBox').addEventListener('toggle', () => { if ($('inputLogBox').open) renderInputLog(); });
$('inputLogSelect').addEventListener('click', () => { renderInputLog(); inputLogText.focus(); inputLogText.select(); inputLogText.setSelectionRange(0, inputLogText.value.length); });
$('inputLogClear').addEventListener('click', () => { inputLog.clear(); renderInputLog(); });
$('forgetBtn').addEventListener('click', () => {
  link.forget();
  settingsSheet.hidden = true;
  link.stop();
  link.connect();
});

// ---------- language and theme (SOFA-10) ----------
function renderPrefs() {
  for (const b of $('langSeg').querySelectorAll('[data-lang]')) b.setAttribute('aria-checked', String(b.dataset.lang === prefs.lang()));
  for (const b of $('themeSeg').querySelectorAll('[data-theme-choice]')) b.setAttribute('aria-checked', String(b.dataset.themeChoice === prefs.theme()));
}
/** Every text on the page in the current language: the markup's, then everything drawn from code. */
function relabel() {
  setLang(prefs.currentLang());
  translate(document);
  renderHost();
  renderBanner();
  renderVersionLine();
  renderMacStatus();
  renderLock();
  applyTypingSettings();
  caretPadEl.setAttribute('aria-label', t('caret.aria'));
  renderRows();
  renderKeyOptions();
  renderImportReplace();
  if (pairMsgText) pairMsg.textContent = pairMsgText();
  if (!panel.hidden) renderPanel();
  if (!rowSheet.hidden) renderRowEditor();
  if (!editorSheet.hidden) renderCustomList();
  if ($('inputLogBox').open) renderInputLog();
  renderPrefs();
}
// Applied at once, without a reload: the link and what is typed stay as they are.
for (const b of $('langSeg').querySelectorAll('[data-lang]')) b.addEventListener('click', () => { prefs.setLang(b.dataset.lang); relabel(); });
for (const b of $('themeSeg').querySelectorAll('[data-theme-choice]')) b.addEventListener('click', () => { prefs.setTheme(b.dataset.themeChoice); renderPrefs(); });
window.addEventListener('languagechange', () => { if (prefs.lang() === 'auto') { prefs.refreshLang(); relabel(); } });

// ---------- lifecycle ----------
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    link.send({ t: 'release_all' });
    releaseLocalState();
  } else {
    link.reconnectNow();
  }
});
window.addEventListener('pagehide', () => link.send({ t: 'release_all' }));
document.addEventListener('gesturestart', (e) => e.preventDefault()); // iOS pinch-zoom

applyAll();
relabel();
prefs.ready();
link.connect();
