// Phone page: wires the trackpad, buttons, keyboard box and settings to the WebSocket link.
import { Link } from './connection.js';
import { TrackpadGestures, Momentum, MoveCoalescer } from './pointer.js';
import { LiveTyping, InputLog, ClearedTextGuard, shortcutFromInsert } from './textsync.js';
import { CaretPad } from './caret.js';
import { KeyRowStore, catalog } from './keyrow.js';
import { VERSION, BUILD } from './version.js';
import { BUILTIN_GROUPS, KEY_GROUPS, MODIFIERS, ShortcutStore, comboLabel, keyLabel, gestureShortcut, hotkeyHint, macStatusText } from './shortcuts.js';

const $ = (id) => document.getElementById(id);

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
  threeFinger: true, pinch: true, navFlick: false,
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
let bannerState = { perm: true, secure: false, locked: false, offline: false, replaced: false, note: '' };
let hotkeysOff = new Set(); // macOS shortcuts the gestures need that are switched off on this Mac
let macSpaces = null;        // Spaces on the Mac (desktops + full-screen apps); null = unknown
function renderMacStatus() {
  const el = $('macStatus');
  const s = macStatusText(hotkeysOff, macSpaces);
  el.textContent = s.text;
  el.classList.toggle('bad', s.bad);
}

function renderBanner() {
  let text = '';
  let bad = false;
  if (bannerState.replaced) { text = '另一支手機已經接手控制。點上方的狀態列重新連線。'; bad = true; }
  else if (bannerState.offline) text = '和 Mac 的連線中斷，正在重新連線…（Mac 上的 SofaPad 要開著，手機和 Mac 要在同一個 Wi-Fi）。斷線時打的字不會補送。';
  else if (bannerState.locked) { text = 'Mac 目前是鎖定畫面，為了安全，手機的輸入暫停。請先解鎖 Mac（用 Mac Virtual Display 之前本來就要先解鎖）。'; bad = true; }
  else if (!bannerState.perm) { text = 'Mac 還沒開「輔助使用」權限，所以游標和打字不會動。請在 Mac 上打開：系統設定 → 隱私權與安全性 → 輔助使用 → 允許 SofaPad（舊名 Phone KeyMouse 的那一項可以移除）。'; bad = true; }
  else if (bannerState.secure) text = 'Mac 正在輸入密碼（安全輸入模式），這時候文字打不進去，滑鼠還可以用。';
  else if (bannerState.note) text = bannerState.note;
  banner.hidden = !text;
  banner.textContent = text;
  banner.classList.toggle('bad', bad);
}

function onState(state, info) {
  dot.className = 'dot ' + (state === 'ready' ? 'ready' : state === 'offline' ? '' : 'connecting');
  $('fabDot').className = dot.className;
  if (state === 'ready') {
    hostEl.textContent = info.host || link.host || 'Mac';
    renderVersion();
    // typed while the link was down: never sent later (D-30)
    if (settings.mode === 'live' && typeof live !== 'undefined') {
      const dropped = live.discardUnsent();
      if (dropped) {
        input.value = '';
        live.reset();
        lastSeen = '';
        autosize();
        note('斷線時打的字沒有送到 Mac（連上以後也不補送，以免打進別的視窗）。輸入框清空了，從 Mac 上現在的位置繼續打。', 6000);
      }
      else if (info.reconnected) note('已重新連上 Mac。', 2000);
    } else if (info.reconnected) note('已重新連上 Mac。', 2000);
    bannerState = { ...bannerState, offline: false, replaced: false, perm: info.perm !== false, secure: !!info.secure, locked: !!info.locked };
    pairSheet.hidden = true;
    if (info.screen && info.screen.w && info.screen.h) root.style.setProperty('--aspect', String(info.screen.w / info.screen.h));
    hotkeysOff = new Set(info.hotkeysOff || []);
    macSpaces = typeof info.spaces === 'number' ? info.spaces : null;
    renderMacStatus();
  } else if (state === 'need_pair') {
    hostEl.textContent = (info.host || link.host || 'Mac') + '（未配對）';
    bannerState.offline = false;
    pairSheet.hidden = false;
  } else if (state === 'connecting') {
    hostEl.textContent = info.attempt ? `重新連線中…（第 ${info.attempt} 次）` : '連線中…';
  } else if (state === 'offline') {
    hostEl.textContent = '未連線';
    rttEl.textContent = '';
    if (info.reason === 'replaced') bannerState.replaced = true;
    else bannerState.offline = true;
    releaseLocalState();
  }
  renderBanner();
}

/** ⚙︎ shows this page's version and the Mac app's (PKM-4: tell an old page or an old app from the new one). */
function renderVersion() {
  const mac = link.mac;
  const el = $('versionLine');
  if (!el) return;
  el.textContent = `網頁 ${VERSION}（${BUILD === 'dev' ? '開發版' : '建置 ' + BUILD}）・Mac App ${mac ? `${mac.ver}（${mac.build === 'dev' ? '開發版' : '建置 ' + mac.build}）` : '舊版（沒有版本資訊）'}`;
  const mismatch = mac && mac.ver !== VERSION;
  el.classList.toggle('bad', !mac || !!mismatch);
  if (!mac || mismatch) note('網頁和 Mac 上的 App 版本不同：請把 Mac 上的 SofaPad 換成新版，再重新整理這頁（主畫面 App 要關掉重開）。', 8000);
}

let noteTimer = null;
function note(text, ms = 4000) {
  bannerState.note = text;
  renderBanner();
  clearTimeout(noteTimer);
  noteTimer = setTimeout(() => { bannerState.note = ''; renderBanner(); }, ms);
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
      else if (m.ok === false) note('Mac 沒有接受這個指令：' + (m.err || '未知錯誤'));
      else if (m.warn === 'secure_input') note('Mac 正在輸入密碼（安全輸入），剛剛的文字可能沒打進去。');
      if (m.hotkey) {
        // ⌃←→↑↓: the Mac says, right now, whether the shortcut is on and how many Spaces there are (PKM-2-3)
        if (m.hotkeyOff) hotkeysOff.add(m.hotkey); else hotkeysOff.delete(m.hotkey);
        if (typeof m.spaces === 'number') macSpaces = m.spaces;
        renderMacStatus();
        const hint = hotkeyHint(m);
        if (hint) note(hint, 10000);
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
      const what = text ? `「${text.length > 24 ? text.slice(0, 24) + '…' : text}」` : `${keys} 個按鍵`;
      const why = m.restarted ? 'Mac 上的 App 重新啟動過，' : m.late ? `連線卡住 ${(m.late / 1000).toFixed(1)} 秒，` : '連線中斷，';
      inputLog.add('undelivered', { len: text.length, tail: text.slice(-16) });
      if (settings.mode === 'live') {
        // the box no longer matches what the Mac has: start clean (the Mac keeps what it typed)
        input.value = '';
        live.reset();
        lastSeen = '';
        autosize();
        note(`${why}${what}沒有打到 Mac，也不會自動補送（以免打進別的視窗）。輸入框清空了，從 Mac 上現在的位置繼續打。`, 9000);
      } else if (text && !input.value) {
        input.value = text;
        lastSeen = text;
        guard.forget();
        autosize();
        note(`${why}${what}沒有打到 Mac，也不會自動補送（以免打進別的視窗）。字放回輸入框了，確認 Mac 上要打的視窗後再按「送出」。`, 9000);
      } else {
        note(`${why}${what}沒有打到 Mac，也不會自動補送（以免打進別的視窗）。`, 9000);
      }
      break;
    }
    case 'notsent':
      if (m.msg.t === 'text' || m.msg.t === 'key') note('還沒連上 Mac，這個字沒有送出（連上以後也不會補送）。', 4000);
      break;
    case 'pairing':
      pairMsg.textContent = 'Mac 螢幕上已經跳出新的配對碼（2 分鐘內有效）。';
      break;
    case 'auth_fail':
      pairMsg.textContent = {
        bad_code: '配對碼不對，請再看一次 Mac 螢幕。',
        pairing_closed: 'Mac 目前沒有開放配對。請按「請 Mac 顯示配對碼」。',
        bad_token: '這支手機的配對已失效，請重新配對。',
        locked: `錯太多次了，請等 ${m.retry || 30} 秒再試。`,
        unauthenticated: '請先配對。',
      }[m.reason] || '配對失敗。';
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
const codeInput = $('codeInput');
function submitCode() {
  const code = codeInput.value.replace(/\D/g, '');
  if (code.length !== 6) {
    pairMsg.textContent = '配對碼是 6 位數字。';
    return;
  }
  pairMsg.textContent = '配對中…';
  link.pair(code);
}
$('pairBtn').addEventListener('click', submitCode);
codeInput.addEventListener('input', () => {
  if (codeInput.value.replace(/\D/g, '').length === 6) submitCode();
});
$('requestBtn').addEventListener('click', () => {
  pairMsg.textContent = '已請 Mac 顯示配對碼…';
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
        toast(`${s.label}　${comboLabel(s)}`); // if the Mac cannot do it, the ack brings a hint (hotkeyHint)
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
  btnLock.textContent = on ? '放開' : '拖曳鎖定';
  $('fabLock').setAttribute('aria-pressed', String(on));
  $('fabLock').textContent = on ? '放' : '鎖';
  dragBadge.hidden = !on;
  pad.classList.toggle('dragging', on);
  if (notify) link.send({ t: on ? 'down' : 'up', b: 'left' });
  haptic();
}
tap(btnLock, () => setDragLock(!dragLocked));
tap($('fabLock'), () => setDragLock(!dragLocked));

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
  for (const b of document.querySelectorAll('.keys .mod')) b.classList.remove('armed');
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
    b.classList.toggle('armed', armed.has(m));
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

// The key row (PKM-3-1 ②, D-28): 即時／整段 and ⌘ 快捷鍵 stay first; the rest is Ray's saved list; ✎ edits it.
const customShortcuts = new ShortcutStore(store);
const keyRow = new KeyRowStore(store, () => customShortcuts.items);
function renderKeyRow() {
  keyRow.prune();
  for (const b of keyStrip.querySelectorAll('.row-item, .row-edit')) b.remove();
  for (const it of keyRow.items()) {
    const b = document.createElement('button');
    b.className = 'row-item';
    b.textContent = it.label;
    b.title = it.name;
    b.dataset.id = it.id;
    if (it.kind === 'mod') {
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
    keyStrip.append(b);
  }
  const edit = document.createElement('button');
  edit.className = 'row-edit';
  edit.textContent = '✎ 編輯';
  edit.setAttribute('aria-label', '編輯按鍵列');
  stripButton(edit, { onTap: openRowEditor });
  keyStrip.append(edit);
  updateKeysHint();
}
renderKeyRow();

// ---------- key row editor ----------
const rowSheet = $('rowSheet');
const rowCurrent = $('rowCurrent');
const rowCatalog = $('rowCatalog');
let rowAddCustomPending = false;
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

function openRowEditor() {
  input.blur();
  $('rowMsg').textContent = '';
  renderRowEditor();
  rowSheet.hidden = false;
}
function rowChanged(msg) {
  renderRowEditor();
  renderKeyRow();
  if (msg != null) $('rowMsg').textContent = msg;
}
function renderRowEditor() {
  keyRow.prune();
  rowCurrent.textContent = '';
  const items = keyRow.items();
  items.forEach((it, i) => {
    const li = el('li');
    li.dataset.id = it.id;
    const handle = el('span', 'handle', '≡');
    handle.setAttribute('aria-label', `拖曳調整 ${it.label} 的位置`);
    const small = (text, label, fn, disabled) => {
      const b = el('button', '', text);
      b.type = 'button';
      b.setAttribute('aria-label', label);
      b.disabled = disabled;
      b.addEventListener('click', fn);
      return b;
    };
    li.append(handle, el('span', 'lbl', it.label), el('span', 'nm', it.name),
      small('↑', '往前移', () => { keyRow.move(it.id, -1); rowChanged(''); }, i === 0),
      small('↓', '往後移', () => { keyRow.move(it.id, 1); rowChanged(''); }, i === items.length - 1),
      small('✕', '移除', () => { keyRow.remove(it.id); rowChanged(`已移除 ${it.label}`); }, false));
    rowCurrent.append(li);
  });
  if (!items.length) rowCurrent.append(el('li', 'empty', '（空的：從下面的清單點選要放的鍵）'));
  rowCatalog.textContent = '';
  for (const g of catalog(customShortcuts.items)) {
    const chips = el('div', 'chips');
    if (!g.items.length) chips.append(el('p', 'empty', '還沒有自訂快捷鍵：按下面的「＋ 新增自訂按鈕」。'));
    for (const it of g.items) {
      const b = el('button');
      b.type = 'button';
      b.dataset.id = it.id;
      b.setAttribute('aria-pressed', String(keyRow.has(it.id)));
      b.append(document.createTextNode(it.label));
      if (it.name !== it.label) b.append(el('small', '', it.name));
      b.addEventListener('click', () => {
        if (keyRow.has(it.id)) { keyRow.remove(it.id); rowChanged(`已移除 ${it.label}`); return; }
        const r = keyRow.add(it.id);
        rowChanged(r === true ? `已加到最後：${it.label}（${it.name}）` : r);
      });
      chips.append(b);
    }
    rowCatalog.append(el('h3', '', g.label), chips);
  }
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
  const from = keyRow.ids.indexOf(rowDrag.id);
  if (best >= 0 && keyRow.moveTo(from, best)) {
    renderRowEditor();
    const moved = [...rowCurrent.querySelectorAll('li[data-id]')].find((li) => li.dataset.id === rowDrag.id);
    if (moved) moved.classList.add('dragging');
  }
});
const endRowDrag = () => { if (!rowDrag) return; rowDrag = null; rowChanged(''); };
rowCurrent.addEventListener('pointerup', endRowDrag);
rowCurrent.addEventListener('pointercancel', endRowDrag);
$('rowDone').addEventListener('click', () => { rowSheet.hidden = true; });
$('rowReset').addEventListener('click', () => { keyRow.reset(); rowChanged(`已恢復預設（${keyRow.ids.length} 個鍵）`); });
$('rowEditBtn').addEventListener('click', () => { $('settingsSheet').hidden = true; openRowEditor(); });

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
    toast(`${s.label}　${comboLabel(s)}`);
    if (closeAfter) setPanel(false);
  });
  return b;
}

function renderPanel() {
  shortcutList.textContent = '';
  const groups = [{ id: 'mine', label: '我的', items: customShortcuts.items }, ...BUILTIN_GROUPS];
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
      p.textContent = '還沒有自訂快捷鍵。按右上角「自訂…」新增，例如 ⌃⇧⌘4。';
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

for (const g of KEY_GROUPS) {
  const og = document.createElement('optgroup');
  og.label = g.label;
  for (const k of g.keys) {
    const o = document.createElement('option');
    o.value = k;
    o.textContent = keyLabel(k) + (k.length > 1 && keyLabel(k) !== k ? `（${k}）` : '');
    og.append(o);
  }
  scKey.append(og);
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
    $('scMsg').textContent = '單獨一個字母或數字會直接打字，請至少選一個修飾鍵。';
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
    keyRow.add(`u:${r.id}`);
    editorSheet.hidden = true;
    rowChanged(`已新增並加到按鍵列：${comboLabel(r)}（${r.label}）`);
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
      btn('↑', '往上移', () => { customShortcuts.move(s.id, -1); renderCustomList(); }, i === 0),
      btn('↓', '往下移', () => { customShortcuts.move(s.id, 1); renderCustomList(); }, i === customShortcuts.items.length - 1),
      btn('✎', '編輯', () => openForm(s)),
      btn('✕', '刪除', () => { customShortcuts.remove(s.id); renderCustomList(); }));
    customList.append(li);
  });
  if (!panel.hidden) renderPanel();
  renderKeyRow();                       // a renamed or deleted custom shortcut changes the row too
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
  const t = $('ioText');
  t.value = customShortcuts.exportJSON();
  t.focus();
  t.select();
  let copied = false;
  try { copied = document.execCommand('copy'); } catch { copied = false; }
  $('ioMsg').textContent = copied ? `已拷貝 ${customShortcuts.items.length} 個快捷鍵的 JSON。` : '已選取 JSON，請長按拷貝。';
});
function doImport(mode) {
  const r = customShortcuts.importJSON($('ioText').value, mode);
  $('ioMsg').textContent = r.error ? '匯入失敗：' + r.error : `匯入 ${r.added} 個${r.skipped ? `，略過 ${r.skipped} 個（重複或不能用）` : ''}。`;
  renderCustomList();
}
$('importAppend').addEventListener('click', () => doImport('append'));
$('importReplace').addEventListener('click', () => {
  // Two-step confirm without a blocking dialog.
  const b = $('importReplace');
  if (b.dataset.armed !== '1') {
    b.dataset.armed = '1';
    b.textContent = '再按一次：取代全部';
    setTimeout(() => { b.dataset.armed = ''; b.textContent = '匯入（取代全部）'; }, 3000);
    return;
  }
  b.dataset.armed = '';
  b.textContent = '匯入（取代全部）';
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
$('fabKeyboard').addEventListener('touchend', fabKeyboard, { passive: false });
$('fabKeyboard').addEventListener('click', (e) => { if (e.detail === 0 || !('ontouchstart' in window)) fabKeyboard(e); });
tap($('fabStatus'), () => { bannerState.replaced = false; link.reconnectNow(); });
$('fabSettings').addEventListener('click', () => $('settingsBtn').click());
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
  modeBtn.textContent = live ? '即時' : '整段';
  sendBtn.hidden = live;
  input.setAttribute('autocorrect', settings.autocorrect ? 'on' : 'off');
  input.setAttribute('autocomplete', settings.autocorrect ? 'on' : 'off');
  input.setAttribute('enterkeyhint', live ? 'enter' : 'send');
  // short enough for one line next to the cursor pad (a wrapped placeholder makes the box, and the page, taller)
  input.placeholder = live ? '點這裡打字，直接打到 Mac' : '打完整段再按「送出」';
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
    note('剛送出的字又跑回輸入框：已擋下，沒有再送一次。', 5000);
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
  note('手機輸入框不能「還原／重做」（會把送出過的字又送一次）。要還原 Mac 上的字，用按鍵列的 ⌘Z。', 5000);
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
    if (text) note('還沒連上 Mac：字留在輸入框裡，等上方變綠點再按「送出」。', 5000);
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
const caretPadEl = $('caretPad');
const caretLabel = $('caretLabel');
const caretSelectBtn = $('caretSelect');
const CARET_IDLE = '◀ 游標 ▶';
function renderCaret() {
  const on = caretPad.active;
  caretPadEl.classList.toggle('active', on);
  caretPadEl.classList.toggle('selecting', caretPad.selecting);
  caretSelectBtn.setAttribute('aria-pressed', String(caretPad.sticky));
  caretLabel.textContent = !on ? (caretPad.sticky ? '◀ 選取 ▶' : CARET_IDLE) : caretPad.selecting ? '⇧ 選取中' : '移動中';
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
stripButton(caretSelectBtn, { onTap: () => { caretPad.setSelect(!caretPad.sticky); haptic(); renderCaret(); } });
renderCaret();

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
      note('輸入框裡還有沒送出的字：要送請按「送出」；6 秒內再點一次「整段」會清掉它（不送出）並切成即時。', 6000);
      return;
    }
    input.value = '';
    lastSeen = '';
    autosize();
    note('已清掉沒送出的字（沒有送到 Mac），改成即時模式。');
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
const toggles = ['reverse', 'lefty', 'longPress', 'threeFinger', 'pinch', 'navFlick', 'hapticsOn', 'autocorrect', 'enterAfter'];

function applyAll() {
  applyGestureSettings();
  applyTypingSettings();
  document.getElementById('app').classList.toggle('lefty', !!settings.lefty);
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
const renderInputLog = () => { inputLogText.value = inputLog.text() || '（還沒有紀錄：關掉設定，在輸入框打字或聽寫後再回來看）'; };
$('inputLogBox').addEventListener('toggle', () => { if ($('inputLogBox').open) renderInputLog(); });
$('inputLogSelect').addEventListener('click', () => { renderInputLog(); inputLogText.focus(); inputLogText.select(); inputLogText.setSelectionRange(0, inputLogText.value.length); });
$('inputLogClear').addEventListener('click', () => { inputLog.clear(); renderInputLog(); });
$('forgetBtn').addEventListener('click', () => {
  link.forget();
  settingsSheet.hidden = true;
  link.stop();
  link.connect();
});

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
link.connect();
