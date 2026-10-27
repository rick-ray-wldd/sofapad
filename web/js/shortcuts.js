// Shortcut catalogue (built-in + the user's own), with no DOM: key choices, labels, storage,
// validation and JSON import/export. Key names are the ones pkm-server's KeyMap understands.

const letters = 'abcdefghijklmnopqrstuvwxyz'.split('');
const digits = '0123456789'.split('');

/** Keys a custom shortcut can use, grouped for the picker. */
export const KEY_GROUPS = [
  { label: '字母', keys: letters },
  { label: '數字', keys: digits },
  { label: '符號', keys: ['-', '=', '[', ']', '\\', ';', "'", ',', '.', '/', '`'] },
  { label: '方向和翻頁', keys: ['left', 'right', 'up', 'down', 'home', 'end', 'pageup', 'pagedown'] },
  { label: '特殊鍵', keys: ['space', 'enter', 'tab', 'escape', 'backspace', 'forwarddelete'] },
  { label: '功能鍵', keys: Array.from({ length: 12 }, (_, i) => `f${i + 1}`) },
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

const S = (label, key, mods, extra = {}) => ({ label, key, mods, ...extra });

/**
 * Built-in shortcuts (PKM-2 §2-2). `close`: the panel closes after sending, because the next thing the user
 * does is on the trackpad (pick a screenshot area, pick a window) or the screen changes completely.
 */
export const BUILTIN_GROUPS = [
  { id: 'edit', label: '編輯', items: [
    S('拷貝', 'c', ['cmd']), S('貼上', 'v', ['cmd']), S('剪下', 'x', ['cmd']),
    S('還原', 'z', ['cmd']), S('重做', 'z', ['shift', 'cmd']), S('全選', 'a', ['cmd']),
  ] },
  { id: 'screenshot', label: '截圖', items: [
    S('整個螢幕（存檔）', '3', ['shift', 'cmd'], { close: true }),
    S('選取範圍（存檔）', '4', ['shift', 'cmd'], { close: true }),
    S('截圖工具列', '5', ['shift', 'cmd'], { close: true }),
    S('整個螢幕（到剪貼簿）', '3', ['ctrl', 'shift', 'cmd'], { close: true }),
    S('選取範圍（到剪貼簿）', '4', ['ctrl', 'shift', 'cmd'], { close: true }),
  ] },
  { id: 'system', label: '切換', items: [
    S('切換 App', 'tab', ['cmd'], { close: true }), S('Spotlight', 'space', ['cmd'], { close: true }),
    S('Mission Control', 'up', ['ctrl'], { close: true }), S('App Exposé', 'down', ['ctrl'], { close: true }),
    S('左邊桌面', 'left', ['ctrl'], { close: true }), S('右邊桌面', 'right', ['ctrl'], { close: true }),
  ] },
  { id: 'more', label: '其他', items: [
    S('儲存', 's', ['cmd']), S('尋找', 'f', ['cmd']), S('新分頁', 't', ['cmd']), S('關閉', 'w', ['cmd']),
    S('上一頁', '[', ['cmd']), S('下一頁', ']', ['cmd']), S('放大', '=', ['cmd']), S('縮小', '-', ['cmd']),
    S('行首', 'left', ['cmd']), S('行尾', 'right', ['cmd']), S('刪一個詞', 'backspace', ['opt']),
  ] },
];

/** Trackpad gesture → Mac shortcut (D-15). Natural direction: swiping left brings in the space on the right. */
export function gestureShortcut(action) {
  if (action.type === 'zoom') return { key: action.dir === 'in' ? '=' : '-', mods: ['cmd'], label: action.dir === 'in' ? '放大' : '縮小' };
  if (action.type !== 'swipe') return null;
  if (action.fingers === 3) {
    return {
      // hotkey: the macOS setting it needs (pkm-server reports switched-off ones as `hotkeysOff`)
      left: { key: 'right', mods: ['ctrl'], label: '右邊桌面', hotkey: 'spaceRight' },
      right: { key: 'left', mods: ['ctrl'], label: '左邊桌面', hotkey: 'spaceLeft' },
      up: { key: 'up', mods: ['ctrl'], label: 'Mission Control', hotkey: 'missionControl' },
      down: { key: 'down', mods: ['ctrl'], label: 'App Exposé', hotkey: 'appWindows' },
    }[action.dir] || null;
  }
  if (action.fingers === 2) {
    return {
      right: { key: '[', mods: ['cmd'], label: '上一頁' },
      left: { key: ']', mods: ['cmd'], label: '下一頁' },
    }[action.dir] || null;
  }
  return null;
}

/** macOS shortcuts behind the three-finger swipes, and their names in System Settings (README §4). */
export const HOTKEYS = {
  spaceLeft: { combo: '⌃←', setting: '移到左邊的空間' },
  spaceRight: { combo: '⌃→', setting: '移到右邊的空間' },
  missionControl: { combo: '⌃↑', setting: 'Mission Control' },
  appWindows: { combo: '⌃↓', setting: '應用程式視窗' },
};
export const HOTKEY_SETTINGS_PATH = '系統設定 → 鍵盤 → 鍵盤快速鍵… → Mission Control';

/**
 * What to tell Ray after the Mac acks a ⌃-arrow shortcut (PKM-2-3): the shortcut is switched off, or there is
 * only one Space so left / right has nowhere to go. '' when there is nothing to say.
 */
export function hotkeyHint({ hotkey, hotkeyOff, spaces }) {
  const h = HOTKEYS[hotkey];
  if (!h) return '';
  if (hotkeyOff) {
    return `${h.combo} 在 Mac 上是關閉的，所以沒有反應。請在 Mac 打開：${HOTKEY_SETTINGS_PATH}，勾選「${h.setting}」（${h.combo}）。`;
  }
  if ((hotkey === 'spaceLeft' || hotkey === 'spaceRight') && spaces === 1) {
    return 'Mac 目前只有 1 個桌面，沒有地方可以切換。三指往上滑打開 Mission Control，在畫面最上方按「＋」新增桌面。';
  }
  return '';
}

/** The settings sheet's "Mac 快速鍵" lines. `off`: Set of switched-off HOTKEYS names; `spaces`: number or null. */
export function macStatusText(off, spaces) {
  const offKeys = Object.keys(HOTKEYS).filter((k) => off.has(k));
  const lines = [offKeys.length
    ? `三指手勢需要的 Mac 快速鍵有 ${offKeys.length} 個是關閉的：${offKeys.map((k) => HOTKEYS[k].combo).join(' ')}。請在 Mac 打開：${HOTKEY_SETTINGS_PATH}，勾選${offKeys.map((k) => `「${HOTKEYS[k].setting}」`).join('')}。`
    : '三指手勢需要的 Mac 快速鍵（⌃← ⌃→ ⌃↑ ⌃↓）都是打開的。'];
  if (spaces === 1) lines.push('Mac 目前只有 1 個桌面：三指左右滑沒有地方可以切換。三指往上滑打開 Mission Control，在畫面最上方按「＋」新增桌面。');
  else if (spaces > 1) lines.push(`Mac 目前有 ${spaces} 個空間（桌面＋全螢幕 App），三指左右滑可以切換。`);
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
    if (!s) return '這個組合鍵不能用';
    if (this.items.length >= MAX_CUSTOM) return `最多 ${MAX_CUSTOM} 個自訂快捷鍵`;
    const item = { id: newId(), ...s };
    this.items.push(item);
    this.save();
    return item;
  }

  update(id, raw) {
    const i = this.items.findIndex((x) => x.id === id);
    const s = normalizeShortcut(raw);
    if (i < 0) return '找不到這個快捷鍵';
    if (!s) return '這個組合鍵不能用';
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
    try { data = JSON.parse(text); } catch { return { added: 0, skipped: 0, error: '不是正確的 JSON' }; }
    const list = Array.isArray(data) ? data : data && Array.isArray(data.items) ? data.items : null;
    if (!list) return { added: 0, skipped: 0, error: '找不到快捷鍵清單（items）' };
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
