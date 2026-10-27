// The bottom key row, made editable (PKM-3-1 ②, D-28). No DOM here: what can go on the row, its labels,
// and the saved order. The row is 即時／整段 and ⌘ 快捷鍵 (always first, not editable), then this list.
// Item ids stay readable and stable, so a saved row survives app updates:
//   k:<key>          a key — esc, tab, ⌫, arrows… (key names as in shortcuts.js / pkm-server KeyMap)
//   m:<mod>          a modifier to arm for the next key (⌘ ⌥ ⌃ ⇧)
//   c:<mods>+<key>   a key combination, e.g. c:cmd+c (the built-in shortcuts)
//   u:<id>           one of Ray's own shortcuts (ShortcutStore); dropped if he deletes it
import { BUILTIN_GROUPS, MODIFIERS, comboLabel, keyLabel, ALL_KEYS } from './shortcuts.js';

export const DEFAULT_ROW = [
  'k:escape', 'k:tab', 'k:backspace', 'k:enter', 'k:left', 'k:up', 'k:down', 'k:right',
  'm:cmd', 'm:opt', 'm:ctrl', 'm:shift', 'k:space', 'k:forwarddelete',
];
export const MAX_ROW = 40;
/** Keys that repeat while held (PKM-2-3). */
export const REPEAT_KEYS = new Set(['backspace', 'forwarddelete', 'left', 'right', 'up', 'down']);

const ROW_LABELS = { escape: 'esc', tab: 'tab', space: 'space', enter: '⏎' };
const KEY_NAMES = {
  escape: 'Esc', tab: 'Tab', backspace: '刪除（⌫）', enter: 'Enter（⏎）', space: '空白', forwarddelete: '往後刪（⌦）',
  left: '左', right: '右', up: '上', down: '下', home: 'Home', end: 'End', pageup: '上一頁', pagedown: '下一頁',
};
const MOD_IDS = MODIFIERS.map((m) => m.id);

export function comboId(key, mods = []) {
  const sorted = MOD_IDS.filter((m) => mods.includes(m));
  return `c:${sorted.join(',')}+${key}`;
}

/**
 * What an id means, or null when it cannot be shown (unknown key, deleted custom shortcut).
 * @returns {{id, kind:'key'|'mod'|'combo'|'custom', label, name, k?, mods?, mod?, repeat?}|null}
 */
export function describe(id, customItems = []) {
  if (typeof id !== 'string') return null;
  if (id.startsWith('k:')) {
    const k = id.slice(2);
    if (!ALL_KEYS.includes(k)) return null;
    return { id, kind: 'key', k, mods: [], label: ROW_LABELS[k] || keyLabel(k), name: KEY_NAMES[k] || keyLabel(k), repeat: REPEAT_KEYS.has(k) };
  }
  if (id.startsWith('m:')) {
    const m = MODIFIERS.find((x) => x.id === id.slice(2));
    return m ? { id, kind: 'mod', mod: m.id, label: m.symbol, name: `${m.name}（先按，再按下一個鍵）` } : null;
  }
  if (id.startsWith('c:')) {
    const plus = id.lastIndexOf('+');
    const mods = id.slice(2, plus).split(',').filter(Boolean);
    const k = id.slice(plus + 1);
    if (plus < 2 || !ALL_KEYS.includes(k) || mods.some((m) => !MOD_IDS.includes(m))) return null;
    const builtin = BUILTIN_GROUPS.flatMap((g) => g.items).find((s) => comboId(s.key, s.mods) === id);
    return { id, kind: 'combo', k, mods, label: comboLabel({ key: k, mods }), name: builtin ? builtin.label : comboLabel({ key: k, mods }) };
  }
  if (id.startsWith('u:')) {
    const s = customItems.find((x) => x.id === id.slice(2));
    return s ? { id, kind: 'custom', k: s.key, mods: s.mods, label: comboLabel(s), name: s.label } : null;
  }
  return null;
}

/** The reference list in the editor: everything that can go on the row, grouped. */
export function catalog(customItems = []) {
  const keys = (list) => list.map((k) => `k:${k}`);
  const groups = [
    { id: 'keys', label: '常用按鍵', ids: keys(['escape', 'tab', 'backspace', 'enter', 'space', 'forwarddelete']) },
    { id: 'arrows', label: '方向和翻頁', ids: keys(['left', 'up', 'down', 'right', 'home', 'end', 'pageup', 'pagedown']) },
    { id: 'mods', label: '修飾鍵（先按，再按下一個鍵）', ids: MOD_IDS.slice().reverse().map((m) => `m:${m}`) },
    ...BUILTIN_GROUPS.map((g) => ({ id: g.id, label: g.label, ids: g.items.map((s) => comboId(s.key, s.mods)) })),
    { id: 'mine', label: '我的快捷鍵', ids: customItems.map((s) => `u:${s.id}`) },
    { id: 'fkeys', label: '功能鍵', ids: keys(Array.from({ length: 12 }, (_, i) => `f${i + 1}`)) },
  ];
  return groups.map((g) => ({ ...g, items: g.ids.map((id) => describe(id, customItems)).filter(Boolean) }));
}

/** The saved row (`store` is the page's localStorage wrapper). */
export class KeyRowStore {
  constructor(store, customItems = () => [], key = 'keyrow') {
    this.store = store;
    this.customItems = customItems;
    this.key = key;
    this.load();
  }

  load() {
    let data = null;
    try { data = JSON.parse(this.store.get(this.key) || 'null'); } catch { data = null; }
    const list = data && Array.isArray(data.items) ? data.items : null;
    this.ids = list ? this.clean(list) : DEFAULT_ROW.slice();
  }

  clean(list) {
    const seen = new Set();
    return list.filter((id) => !seen.has(id) && seen.add(id) && describe(id, this.customItems())).slice(0, MAX_ROW);
  }

  save() {
    this.store.set(this.key, JSON.stringify({ version: 1, items: this.ids }));
  }

  /** Drops ids that no longer mean anything (a custom shortcut deleted since). */
  prune() {
    const c = this.clean(this.ids);
    if (c.join() !== this.ids.join()) { this.ids = c; this.save(); }
  }

  /** The buttons to draw (a deleted custom shortcut disappears from the row). */
  items() {
    return this.ids.map((id) => describe(id, this.customItems())).filter(Boolean);
  }

  has(id) { return this.ids.includes(id); }

  /** @returns true, or a reason it was not added */
  add(id) {
    if (this.ids.includes(id)) return '已經在按鍵列上';
    if (!describe(id, this.customItems())) return '這個按鍵不能用';
    if (this.ids.length >= MAX_ROW) return `按鍵列最多 ${MAX_ROW} 個`;
    this.ids.push(id);
    this.save();
    return true;
  }

  remove(id) {
    this.ids = this.ids.filter((x) => x !== id);
    this.save();
  }

  /** Moves the item at `from` to position `to` (drag and drop). */
  moveTo(from, to) {
    if (from < 0 || from >= this.ids.length || to < 0 || to >= this.ids.length || from === to) return false;
    const [id] = this.ids.splice(from, 1);
    this.ids.splice(to, 0, id);
    this.save();
    return true;
  }

  move(id, delta) {
    const i = this.ids.indexOf(id);
    return this.moveTo(i, i + delta);
  }

  reset() {
    this.ids = DEFAULT_ROW.slice();
    this.save();
  }

  isDefault() {
    return this.ids.join() === DEFAULT_ROW.join();
  }
}
