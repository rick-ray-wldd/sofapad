// Shortcut catalogue (built-in + the user's own), with no DOM: key choices, labels, storage,
// validation and JSON import/export. Key names are the ones pkm-server's KeyMap understands.
// Labels are looked up when read (getters), so they follow a change of language (SOFA-10).
import { t } from './i18n.js';

const letters = 'abcdefghijklmnopqrstuvwxyz'.split('');
const digits = '0123456789'.split('');

const G = (id, keys) => ({ id, get label() { return t(`group.${id}`); }, keys });

/** Keys a custom shortcut can use, grouped for the picker. */
export const KEY_GROUPS = [
  G('letters', letters),
  G('digits', digits),
  G('symbols', ['-', '=', '[', ']', '\\', ';', "'", ',', '.', '/', '`']),
  G('arrows', ['left', 'right', 'up', 'down', 'home', 'end', 'pageup', 'pagedown']),
  G('special', ['space', 'enter', 'tab', 'escape', 'backspace', 'forwarddelete']),
  G('fkeys', Array.from({ length: 12 }, (_, i) => `f${i + 1}`)),
];
export const ALL_KEYS = KEY_GROUPS.flatMap((g) => g.keys);

/** Modifiers in Apple's display order (⌃⌥⇧⌘). */
export const MODIFIERS = [
  { id: 'ctrl', symbol: '⌃', name: 'Control' },
  { id: 'opt', symbol: '⌥', name: 'Option' },
  { id: 'shift', symbol: '⇧', name: 'Shift' },
  { id: 'cmd', symbol: '⌘', name: 'Command' },
];
const MOD_IDS = MODIFIERS.map((m) => m.id);

const KEY_SYMBOLS = {
  left: '←', right: '→', up: '↑', down: '↓', home: '↖', end: '↘', pageup: '⇞', pagedown: '⇟',
  space: 'Space', enter: '⏎', tab: 'Tab', escape: 'esc', backspace: '⌫', forwarddelete: '⌦',
  '-': '−',
};

export function keyLabel(key) {
  if (KEY_SYMBOLS[key]) return KEY_SYMBOLS[key];
  if (/^f\d+$/.test(key)) return key.toUpperCase();
  return key.length === 1 ? key.toUpperCase() : key;
}

export function comboLabel({ key, mods = [] }) {
  return MODIFIERS.filter((m) => mods.includes(m.id)).map((m) => m.symbol).join('') + keyLabel(key);
}

/** A built-in shortcut; `name` is its dictionary key (sc.<name>). */
const S = (name, key, mods, extra = {}) => ({ get label() { return t(`sc.${name}`); }, key, mods, ...extra });
const group = (id, items) => ({ id, get label() { return t(`group.${id}`); }, items });

/**
 * Built-in shortcuts (PKM-2 §2-2). `close`: the panel closes after sending, because the next thing the user
 * does is on the trackpad (pick a screenshot area, pick a window) or the screen changes completely.
 */
export const BUILTIN_GROUPS = [
  group('edit', [
    S('copy', 'c', ['cmd']), S('paste', 'v', ['cmd']), S('cut', 'x', ['cmd']),
    S('undo', 'z', ['cmd']), S('redo', 'z', ['shift', 'cmd']), S('selectAll', 'a', ['cmd']),
  ]),
  group('screenshot', [
    S('screenFile', '3', ['shift', 'cmd'], { close: true }),
    S('areaFile', '4', ['shift', 'cmd'], { close: true }),
    S('toolbar', '5', ['shift', 'cmd'], { close: true }),
    S('screenClip', '3', ['ctrl', 'shift', 'cmd'], { close: true }),
    S('areaClip', '4', ['ctrl', 'shift', 'cmd'], { close: true }),
  ]),
  group('system', [
    S('switchApp', 'tab', ['cmd'], { close: true }), S('spotlight', 'space', ['cmd'], { close: true }),
    S('missionControl', 'up', ['ctrl'], { close: true }), S('appExpose', 'down', ['ctrl'], { close: true }),
    S('spaceLeft', 'left', ['ctrl'], { close: true }), S('spaceRight', 'right', ['ctrl'], { close: true }),
  ]),
  group('more', [
    S('save', 's', ['cmd']), S('find', 'f', ['cmd']), S('newTab', 't', ['cmd']), S('close', 'w', ['cmd']),
    S('back', '[', ['cmd']), S('forward', ']', ['cmd']), S('zoomIn', '=', ['cmd']), S('zoomOut', '-', ['cmd']),
    S('lineStart', 'left', ['cmd']), S('lineEnd', 'right', ['cmd']), S('deleteWord', 'backspace', ['opt']),
  ]),
];

/** Trackpad gesture → Mac shortcut (D-15). Natural direction: swiping left brings in the space on the right. */
export function gestureShortcut(action) {
  if (action.type === 'zoom') return { key: action.dir === 'in' ? '=' : '-', mods: ['cmd'], label: t(action.dir === 'in' ? 'sc.zoomIn' : 'sc.zoomOut') };
  if (action.type !== 'swipe') return null;
  if (action.fingers === 3) {
    return {
      // hotkey: the macOS setting it needs (pkm-server reports switched-off ones as `hotkeysOff`)
      left: { key: 'right', mods: ['ctrl'], label: t('sc.spaceRight'), hotkey: 'spaceRight' },
      right: { key: 'left', mods: ['ctrl'], label: t('sc.spaceLeft'), hotkey: 'spaceLeft' },
      up: { key: 'up', mods: ['ctrl'], label: t('sc.missionControl'), hotkey: 'missionControl' },
      down: { key: 'down', mods: ['ctrl'], label: t('sc.appExpose'), hotkey: 'appWindows' },
    }[action.dir] || null;
  }
  if (action.fingers === 2) {
    return {
      right: { key: '[', mods: ['cmd'], label: t('sc.back') },
      left: { key: ']', mods: ['cmd'], label: t('sc.forward') },
    }[action.dir] || null;
  }
  return null;
}

/** macOS shortcuts behind the three-finger swipes, and their names in System Settings (README §4). */
const hotkey = (name, combo) => ({ combo, get setting() { return t(`hotkey.${name}`); } });
export const HOTKEYS = {
  spaceLeft: hotkey('spaceLeft', '⌃←'),
  spaceRight: hotkey('spaceRight', '⌃→'),
  missionControl: hotkey('missionControl', '⌃↑'),
  appWindows: hotkey('appWindows', '⌃↓'),
};

/**
 * What to tell Ray after the Mac acks a ⌃-arrow shortcut (PKM-2-3): the shortcut is switched off, or there is
 * only one Space so left / right has nowhere to go. '' when there is nothing to say.
 */
export function hotkeyHint({ hotkey, hotkeyOff, spaces }) {
  const h = HOTKEYS[hotkey];
  if (!h) return '';
  if (hotkeyOff) return t('hotkey.off', { combo: h.combo, path: t('hotkey.path'), setting: h.setting });
  if ((hotkey === 'spaceLeft' || hotkey === 'spaceRight') && spaces === 1) return t('hotkey.oneSpace');
  return '';
}

/** The settings sheet's "Mac 快速鍵" lines. `off`: Set of switched-off HOTKEYS names; `spaces`: number or null. */
export function macStatusText(off, spaces) {
  const offKeys = Object.keys(HOTKEYS).filter((k) => off.has(k));
  const lines = [offKeys.length
    ? t('mac.off', {
      n: offKeys.length,
      combos: offKeys.map((k) => HOTKEYS[k].combo).join(' '),
      path: t('hotkey.path'),
      settings: offKeys.map((k) => t('mac.off.setting', { setting: HOTKEYS[k].setting })).join(t('mac.off.sep')),
    })
    : t('mac.allOn')];
  if (spaces === 1) lines.push(t('mac.oneSpace'));
  else if (spaces > 1) lines.push(t('mac.spaces', { n: spaces }));
  return { text: lines.join('\n'), bad: offKeys.length > 0 || spaces === 1 };
}

export const MAX_CUSTOM = 60;
const MAX_LABEL = 24;

/** Checks and cleans one shortcut; returns null when it cannot be used. */
export function normalizeShortcut(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const key = typeof raw.key === 'string' ? raw.key.toLowerCase() : '';
  if (!ALL_KEYS.includes(key)) return null;
  if (raw.mods != null && !Array.isArray(raw.mods)) return null;
  const mods = [];
  for (const m of raw.mods || []) {
    if (!MOD_IDS.includes(m)) return null;
    if (!mods.includes(m)) mods.push(m);
  }
  mods.sort((a, b) => MOD_IDS.indexOf(a) - MOD_IDS.indexOf(b));
  const label = (typeof raw.label === 'string' ? raw.label.trim() : '').slice(0, MAX_LABEL) || comboLabel({ key, mods });
  return { label, key, mods };
}

const sameCombo = (a, b) => a.key === b.key && a.mods.join() === b.mods.join();

function newId() {
  const b = new Uint8Array(6);
  globalThis.crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}

/** The user's own shortcuts, kept on the phone (`store` is the page's localStorage wrapper). */
export class ShortcutStore {
  constructor(store, key = 'shortcuts') {
    this.store = store;
    this.key = key;
    this.items = [];
    this.load();
  }

  load() {
    let data = null;
    try { data = JSON.parse(this.store.get(this.key) || 'null'); } catch { data = null; }
    const list = Array.isArray(data) ? data : data && Array.isArray(data.items) ? data.items : [];
    this.items = list.map((x) => {
      const s = normalizeShortcut(x);
      return s && { id: typeof x.id === 'string' ? x.id : newId(), ...s };
    }).filter(Boolean).slice(0, MAX_CUSTOM);
  }

  save() {
    this.store.set(this.key, JSON.stringify({ version: 1, items: this.items }));
  }

  /** @returns the new item, or an error string */
  add(raw) {
    const s = normalizeShortcut(raw);
    if (!s) return t('sc.err.combo');
    if (this.items.length >= MAX_CUSTOM) return t('sc.err.max', { n: MAX_CUSTOM });
    const item = { id: newId(), ...s };
    this.items.push(item);
    this.save();
    return item;
  }

  update(id, raw) {
    const i = this.items.findIndex((x) => x.id === id);
    const s = normalizeShortcut(raw);
    if (i < 0) return t('sc.err.missing');
    if (!s) return t('sc.err.combo');
    this.items[i] = { id, ...s };
    this.save();
    return this.items[i];
  }

  remove(id) {
    this.items = this.items.filter((x) => x.id !== id);
    this.save();
  }

  /** Moves an item up (-1) or down (+1). */
  move(id, delta) {
    const i = this.items.findIndex((x) => x.id === id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= this.items.length) return false;
    [this.items[i], this.items[j]] = [this.items[j], this.items[i]];
    this.save();
    return true;
  }

  exportJSON() {
    return JSON.stringify({
      app: 'sofapad', type: 'shortcuts', version: 1,
      items: this.items.map(({ label, key, mods }) => ({ label, key, mods })),
    }, null, 1);
  }

  /**
   * Imports shortcuts from JSON text (our export, or a bare array). mode 'append' skips combos that already
   * exist; 'replace' replaces the whole list. Invalid entries are skipped and counted.
   * @returns {{added:number, skipped:number, error?:string}}
   */
  importJSON(text, mode = 'append') {
    let data;
    try { data = JSON.parse(text); } catch { return { added: 0, skipped: 0, error: t('sc.err.json') }; }
    const list = Array.isArray(data) ? data : data && Array.isArray(data.items) ? data.items : null;
    if (!list) return { added: 0, skipped: 0, error: t('sc.err.items') };
    const next = mode === 'replace' ? [] : [...this.items];
    let added = 0;
    let skipped = 0;
    for (const raw of list) {
      const s = normalizeShortcut(raw);
      if (!s || next.some((x) => sameCombo(x, s)) || next.length >= MAX_CUSTOM) { skipped++; continue; }
      next.push({ id: newId(), ...s });
      added++;
    }
    this.items = next;
    this.save();
    return { added, skipped };
  }
}
