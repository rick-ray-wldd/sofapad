// The phone's editable rows (PKM-3-1 ②, D-28; SOFA-8, D-47). No DOM here: what can go on a row, its labels, and the
// saved order. Three rows share one list of cells, so a cell can be moved from one row to another:
//   input   the text box's row: the box takes half the width, these cells the other half (portrait and landscape)
//   keys    the key row under it, after 即時／整段 and ⌘ 快捷鍵 (always first, not editable); a grid in landscape
//   side    more cells for the landscape side panel only (shown after the key row there)
// Item ids stay readable and stable, so a saved row survives app updates:
//   k:<key>          a key — esc, tab, ⌫, arrows… (key names as in shortcuts.js / pkm-server KeyMap)
//   m:<mod>          a modifier to arm for the next key (⌘ ⌥ ⌃ ⇧)
//   c:<mods>+<key>   a key combination, e.g. c:cmd+c (the built-in shortcuts)
//   u:<id>           one of Ray's own shortcuts (ShortcutStore); dropped if he deletes it
//   x:caret          the cursor pad (SOFA-6); x:select its ⇧ 選取 switch. One of each, in one row at a time.
// Labels and names come from the dictionaries (SOFA-10) each time a row is described, so they follow the language.
import { BUILTIN_GROUPS, MODIFIERS, comboLabel, keyLabel, ALL_KEYS } from './shortcuts.js';
import { t } from './i18n.js';

export const ROWS = ['input', 'keys', 'side'];
/** The rows' names as used in sentences (「已加到按鍵列最後」, "added to the end of the key row"). */
export const ROW_NAMES = {
  get input() { return t('row.input'); },
  get keys() { return t('row.keys'); },
  get side() { return t('row.side'); },
};
export const DEFAULTS = {
  input: ['x:caret', 'k:enter'],
  keys: ['x:select', 'k:escape', 'k:tab', 'k:backspace', 'k:left', 'k:up', 'k:down', 'k:right',
    'm:cmd', 'm:opt', 'm:ctrl', 'm:shift', 'k:space', 'k:forwarddelete'],
  side: ['c:cmd+c', 'c:cmd+v', 'c:cmd+x', 'c:cmd+z', 'c:shift,cmd+z', 'c:cmd+a',
    'c:cmd+tab', 'c:ctrl+up', 'c:ctrl+left', 'c:ctrl+right', 'c:ctrl,shift,cmd+4', 'c:cmd+s'],
};
/** The key row up to 4.2 (saved as `keyrow`, version 1); ⇧ 選取 was fixed in front of it. */
export const V1_DEFAULT_ROW = [
  'k:escape', 'k:tab', 'k:backspace', 'k:enter', 'k:left', 'k:up', 'k:down', 'k:right',
  'm:cmd', 'm:opt', 'm:ctrl', 'm:shift', 'k:space', 'k:forwarddelete',
];
export const MAX_ROW = 40;
/** The input row shares its line with the text box: more than this and the cells get too narrow to hit. */
export const MAX_CELLS = { input: 6, keys: MAX_ROW, side: MAX_ROW };
/** Cells that exist once: adding one to a row takes it out of the row it was in. */
export const SINGLE = new Set(['x:caret', 'x:select']);
/** Keys that repeat while held (PKM-2-3). */
export const REPEAT_KEYS = new Set(['backspace', 'forwarddelete', 'left', 'right', 'up', 'down']);

const ROW_LABELS = { escape: 'esc', tab: 'tab', space: 'space', enter: '⏎' };
/** Keys with a name of their own in the editor (key.<name> in the dictionaries); the others show their symbol. */
const KEY_NAMES = new Set(['escape', 'tab', 'backspace', 'enter', 'space', 'forwarddelete',
  'left', 'right', 'up', 'down', 'home', 'end', 'pageup', 'pagedown']);
const SPECIAL = {
  'x:caret': { kind: 'caret', label: 'cell.caret', name: 'cell.caret.name' },
  'x:select': { kind: 'select', label: 'cell.select', name: 'cell.select.name' },
};
const MOD_IDS = MODIFIERS.map((m) => m.id);

export function comboId(key, mods = []) {
  const sorted = MOD_IDS.filter((m) => mods.includes(m));
  return `c:${sorted.join(',')}+${key}`;
}

/**
 * What an id means, or null when it cannot be shown (unknown key, deleted custom shortcut).
 * @returns {{id, kind:'key'|'mod'|'combo'|'custom'|'caret'|'select', label, name, k?, mods?, mod?, repeat?}|null}
 */
export function describe(id, customItems = []) {
  if (typeof id !== 'string') return null;
  if (SPECIAL[id]) {
    const x = SPECIAL[id];
    return { id, kind: x.kind, label: t(x.label), name: t(x.name) };
  }
  if (id.startsWith('k:')) {
    const k = id.slice(2);
    if (!ALL_KEYS.includes(k)) return null;
    return { id, kind: 'key', k, mods: [], label: ROW_LABELS[k] || keyLabel(k), name: KEY_NAMES.has(k) ? t(`key.${k}`) : keyLabel(k), repeat: REPEAT_KEYS.has(k) };
  }
  if (id.startsWith('m:')) {
    const m = MODIFIERS.find((x) => x.id === id.slice(2));
    return m ? { id, kind: 'mod', mod: m.id, label: m.symbol, name: t('cell.mod.name', { name: m.name }) } : null;
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

/** The reference list in the editor: everything that can go on a row, grouped. */
export function catalog(customItems = []) {
  const keys = (list) => list.map((k) => `k:${k}`);
  const groups = [
    { id: 'caret', label: t('cat.caret'), ids: ['x:caret', 'x:select'] },
    { id: 'keys', label: t('cat.keys'), ids: keys(['escape', 'tab', 'backspace', 'enter', 'space', 'forwarddelete']) },
    { id: 'arrows', label: t('cat.arrows'), ids: keys(['left', 'up', 'down', 'right', 'home', 'end', 'pageup', 'pagedown']) },
    { id: 'mods', label: t('cat.mods'), ids: MOD_IDS.slice().reverse().map((m) => `m:${m}`) },
    ...BUILTIN_GROUPS.map((g) => ({ id: g.id, label: g.label, ids: g.items.map((s) => comboId(s.key, s.mods)) })),
    { id: 'mine', label: t('cat.mine'), ids: customItems.map((s) => `u:${s.id}`) },
    { id: 'fkeys', label: t('cat.fkeys'), ids: keys(Array.from({ length: 12 }, (_, i) => `f${i + 1}`)) },
  ];
  return groups.map((g) => ({ ...g, items: g.ids.map((id) => describe(id, customItems)).filter(Boolean) }));
}

const copyDefaults = () => Object.fromEntries(ROWS.map((r) => [r, DEFAULTS[r].slice()]));

/**
 * The saved rows (`store` is the page's localStorage wrapper), as `layout` version 2. A phone that still has 4.2's
 * `keyrow` (version 1) is converted once: an untouched row becomes the new default; an edited one keeps every key in
 * its order, with ⇧ 選取 in front where 4.2 had it fixed, and gets the default input and side rows. `keyrow` itself
 * is left as it was, so going back to 4.2 still finds it.
 */
export class LayoutStore {
  constructor(store, customItems = () => [], key = 'layout') {
    this.store = store;
    this.customItems = customItems;
    this.key = key;
    this.load();
  }

  load() {
    const read = (k) => { try { return JSON.parse(this.store.get(k) || 'null'); } catch { return null; } };
    const data = read(this.key);
    this.migrated = false;
    if (data && data.version === 2) {
      this.rows = this.clean(Object.fromEntries(ROWS.map((r) => [r, Array.isArray(data[r]) ? data[r] : DEFAULTS[r]])));
      return;
    }
    const v1 = read('keyrow');
    if (v1 && Array.isArray(v1.items)) {
      const kept = this.cleanRow(v1.items.filter((id) => !SINGLE.has(id)));
      const untouched = kept.join() === V1_DEFAULT_ROW.join();
      this.rows = untouched ? copyDefaults() : this.clean({ ...copyDefaults(), keys: ['x:select', ...kept] });
      this.migrated = untouched ? 'default' : 'kept';
      this.save();
      return;
    }
    this.rows = copyDefaults();
  }

  cleanRow(list, taken = new Set()) {
    const seen = new Set();
    return list.filter((id) => {
      if (seen.has(id) || taken.has(id) || !describe(id, this.customItems())) return false;
      seen.add(id);
      if (SINGLE.has(id)) taken.add(id);
      return true;
    });
  }

  /** Unknown and repeated ids out; a single cell stays in the first row that has it. */
  clean(rows) {
    const taken = new Set();
    return Object.fromEntries(ROWS.map((r) => [r, this.cleanRow(rows[r] || [], taken).slice(0, MAX_CELLS[r])]));
  }

  save() {
    this.store.set(this.key, JSON.stringify({ version: 2, ...this.rows }));
  }

  /** Drops ids that no longer mean anything (a custom shortcut deleted since). */
  prune() {
    const c = this.clean(this.rows);
    if (ROWS.some((r) => c[r].join() !== this.rows[r].join())) { this.rows = c; this.save(); }
  }

  ids(row) { return this.rows[row]; }

  /** The cells to draw (a deleted custom shortcut disappears from the row). */
  items(row) {
    return this.rows[row].map((id) => describe(id, this.customItems())).filter(Boolean);
  }

  has(row, id) { return this.rows[row].includes(id); }

  /** The row a cell is in (the first one, for keys that are in several), or null. */
  where(id) { return ROWS.find((r) => this.rows[r].includes(id)) || null; }

  /** @returns true, or a reason it was not added. A single cell moves here from the row it was in. */
  add(row, id) {
    if (this.rows[row].includes(id)) return t('row.err.there', { row: ROW_NAMES[row] });
    if (!describe(id, this.customItems())) return t('row.err.key');
    if (this.rows[row].length >= MAX_CELLS[row]) return t('row.err.full', { row: ROW_NAMES[row], n: MAX_CELLS[row] });
    if (SINGLE.has(id)) for (const r of ROWS) this.rows[r] = this.rows[r].filter((x) => x !== id);
    this.rows[row].push(id);
    this.save();
    return true;
  }

  remove(row, id) {
    this.rows[row] = this.rows[row].filter((x) => x !== id);
    this.save();
  }

  /** Moves the item at `from` to position `to` (drag and drop). */
  moveTo(row, from, to) {
    const ids = this.rows[row];
    if (from < 0 || from >= ids.length || to < 0 || to >= ids.length || from === to) return false;
    const [id] = ids.splice(from, 1);
    ids.splice(to, 0, id);
    this.save();
    return true;
  }

  move(row, id, delta) {
    const i = this.rows[row].indexOf(id);
    return this.moveTo(row, i, i + delta);
  }

  /** All three rows back to the default. */
  reset() {
    this.rows = copyDefaults();
    this.save();
  }

  isDefault() {
    return ROWS.every((r) => this.rows[r].join() === DEFAULTS[r].join());
  }
}
