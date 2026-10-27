// v2 shortcuts (PKM-2 §2-2): catalogue, labels, gesture mapping, custom store, import / export.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  ALL_KEYS, BUILTIN_GROUPS, MODIFIERS, comboLabel, gestureShortcut, normalizeShortcut, ShortcutStore, MAX_CUSTOM,
  HOTKEYS, hotkeyHint, macStatusText,
} from '../js/shortcuts.js';

function memoryStore() {
  const m = new Map();
  return { get: (k) => (m.has(k) ? m.get(k) : null), set: (k, v) => m.set(k, v), del: (k) => m.delete(k), m };
}

test('every key the phone can send exists in the Mac key map (KeyMap.swift)', () => {
  const swift = readFileSync(new URL('../../mac/Sources/PKMCore/KeyMap.swift', import.meta.url), 'utf8');
  const named = new Set([...swift.matchAll(/"([a-z0-9]+)":\s*0x/g)].map((m) => m[1]));
  const chars = new Set([...swift.matchAll(/"(\\\\|.)":\s*0x/g)].map((m) => (m[1] === '\\\\' ? '\\' : m[1])));
  const known = (k) => named.has(k) || chars.has(k);
  const missing = ALL_KEYS.filter((k) => !known(k));
  assert.deepEqual(missing, []);
  for (const g of BUILTIN_GROUPS) for (const s of g.items) assert.ok(known(s.key), `${g.id}: ${s.label} uses ${s.key}`);
  const mods = new Set([...swift.matchAll(/case "(\w+)"(?:, "[^"]+")*: return \./g)].map((m) => m[1]));
  for (const m of MODIFIERS) assert.ok(mods.has(m.id), m.id);
});

test('built-ins include everything PKM-2 asks for, with the right combos', () => {
  const all = BUILTIN_GROUPS.flatMap((g) => g.items).map(comboLabel);
  for (const c of ['⌘C', '⌘V', '⌘X', '⌘Z', '⇧⌘Z', '⌘A', '⌘Tab', '⌘Space', '⇧⌘3', '⇧⌘4', '⇧⌘5', '⌃⇧⌘3', '⌃⇧⌘4', '⌃↑', '⌃↓', '⌃←', '⌃→']) {
    assert.ok(all.includes(c), c);
  }
  const shots = BUILTIN_GROUPS.find((g) => g.id === 'screenshot').items;
  assert.ok(shots.every((s) => s.close), 'screenshot shortcuts close the panel so the pad is free to pick an area');
});

test('combo labels use Apple modifier order regardless of input order', () => {
  assert.equal(comboLabel({ key: '4', mods: ['cmd', 'shift', 'ctrl'] }), '⌃⇧⌘4');
  assert.equal(comboLabel({ key: 'left', mods: ['ctrl'] }), '⌃←');
  assert.equal(comboLabel({ key: 'f5', mods: [] }), 'F5');
});

test('gestures map to the macOS shortcuts (natural direction)', () => {
  const k = (a) => { const s = gestureShortcut(a); return s && comboLabel(s); };
  assert.equal(k({ type: 'swipe', fingers: 3, dir: 'left' }), '⌃→');
  assert.equal(k({ type: 'swipe', fingers: 3, dir: 'right' }), '⌃←');
  assert.equal(k({ type: 'swipe', fingers: 3, dir: 'up' }), '⌃↑');
  assert.equal(k({ type: 'swipe', fingers: 3, dir: 'down' }), '⌃↓');
  assert.equal(k({ type: 'zoom', dir: 'in' }), '⌘=');
  assert.equal(k({ type: 'zoom', dir: 'out' }), '⌘−');
  assert.equal(k({ type: 'swipe', fingers: 2, dir: 'right' }), '⌘[');
  assert.equal(k({ type: 'swipe', fingers: 2, dir: 'left' }), '⌘]');
  assert.equal(gestureShortcut({ type: 'move', dx: 1, dy: 1 }), null);
});

test('normalize: rejects unknown keys / modifiers, dedupes and orders modifiers, default label', () => {
  assert.equal(normalizeShortcut({ key: 'f13', mods: [] }), null);
  assert.equal(normalizeShortcut({ key: 'a', mods: ['hyper'] }), null);
  assert.equal(normalizeShortcut({ key: 'a', mods: 'cmd' }), null);
  assert.deepEqual(normalizeShortcut({ key: 'A', mods: ['cmd', 'shift', 'cmd'] }), { label: '⇧⌘A', key: 'a', mods: ['shift', 'cmd'] });
  assert.equal(normalizeShortcut({ key: 'k', mods: ['cmd'], label: '  x'.repeat(20) }).label.length, 24);
});

test('custom store: add, edit, delete, reorder — and it survives a reload', () => {
  const mem = memoryStore();
  const s = new ShortcutStore(mem);
  const a = s.add({ label: '截圖到剪貼簿', key: '4', mods: ['ctrl', 'shift', 'cmd'] });
  const b = s.add({ key: 'k', mods: ['cmd', 'opt'] });
  const c = s.add({ label: '強制結束', key: 'escape', mods: ['cmd', 'opt'] });
  assert.equal(typeof s.add({ key: 'nope' }), 'string');
  assert.deepEqual(s.items.map((x) => x.label), ['截圖到剪貼簿', '⌥⌘K', '強制結束']);
  s.update(b.id, { label: '我的 ⌥⌘K', key: 'k', mods: ['opt', 'cmd'] });
  assert.equal(s.move(c.id, -1), true);
  assert.equal(s.move(a.id, -1), false, 'first item cannot move up');
  s.remove(a.id);
  const reloaded = new ShortcutStore(mem);
  assert.deepEqual(reloaded.items.map((x) => x.label), ['強制結束', '我的 ⌥⌘K']);
  assert.deepEqual(reloaded.items.map((x) => x.id), [c.id, b.id], 'ids survive a reload');
});

test('export → import round trip (into an empty phone), append skips duplicates, replace replaces', () => {
  const one = new ShortcutStore(memoryStore());
  one.add({ label: '截圖到剪貼簿', key: '4', mods: ['ctrl', 'shift', 'cmd'] });
  one.add({ key: 'k', mods: ['cmd', 'opt'] });
  const text = one.exportJSON();
  assert.deepEqual(JSON.parse(text).items[0], { label: '截圖到剪貼簿', key: '4', mods: ['ctrl', 'shift', 'cmd'] });

  const two = new ShortcutStore(memoryStore());
  assert.deepEqual(two.importJSON(text), { added: 2, skipped: 0 });
  assert.deepEqual(two.importJSON(text), { added: 0, skipped: 2 }, 'append skips combos that already exist');
  two.add({ key: 'q', mods: ['cmd'] });
  assert.deepEqual(two.importJSON(text, 'replace'), { added: 2, skipped: 0 });
  assert.equal(two.items.length, 2);
});

test('import rejects bad input without touching the saved list', () => {
  const s = new ShortcutStore(memoryStore());
  s.add({ key: 'k', mods: ['cmd'] });
  assert.equal(s.importJSON('not json').error, '不是正確的 JSON');
  assert.ok(s.importJSON('{"foo":1}', 'replace').error);
  const r = s.importJSON(JSON.stringify([{ key: 'a', mods: ['cmd', 'shift'] }, { key: '<script>', mods: [] }, { key: 'b', mods: ['root'] }]));
  assert.deepEqual(r, { added: 1, skipped: 2 });
  assert.equal(s.items.length, 2);
});

test('limits: at most MAX_CUSTOM items; corrupt storage loads as empty', () => {
  const mem = memoryStore();
  const s = new ShortcutStore(mem);
  for (let i = 0; i < MAX_CUSTOM; i++) assert.equal(typeof s.add({ key: 'a', mods: i % 2 ? ['cmd'] : ['opt'], label: String(i) }), 'object');
  assert.equal(typeof s.add({ key: 'b', mods: ['cmd'] }), 'string');
  mem.set('shortcuts', '{broken');
  assert.deepEqual(new ShortcutStore(mem).items, []);
});

// PKM-2-3: after a ⌃-arrow ack the phone says exactly why nothing happened on the Mac.
test('hotkey hint: switched-off shortcut names the setting and the combo', () => {
  const h = hotkeyHint({ hotkey: 'spaceLeft', hotkeyOff: true, spaces: 3 });
  assert.match(h, /⌃← 在 Mac 上是關閉的/);
  assert.match(h, /系統設定 → 鍵盤 → 鍵盤快速鍵… → Mission Control/);
  assert.match(h, /「移到左邊的空間」/);
  assert.match(hotkeyHint({ hotkey: 'missionControl', hotkeyOff: true }), /「Mission Control」（⌃↑）/);
});

test('hotkey hint: one Space → nowhere to switch; otherwise nothing to say', () => {
  assert.match(hotkeyHint({ hotkey: 'spaceRight', hotkeyOff: false, spaces: 1 }), /只有 1 個桌面/);
  assert.equal(hotkeyHint({ hotkey: 'missionControl', hotkeyOff: false, spaces: 1 }), '', 'Mission Control works with one desktop');
  assert.equal(hotkeyHint({ hotkey: 'spaceRight', hotkeyOff: false, spaces: 2 }), '');
  assert.equal(hotkeyHint({ hotkey: 'spaceRight', hotkeyOff: false }), '', 'unknown count: no guess');
  assert.equal(hotkeyHint({}), '');
});

test('Mac status text for the settings sheet', () => {
  const ok = macStatusText(new Set(), 4);
  assert.equal(ok.bad, false);
  assert.match(ok.text, /都是打開的/);
  assert.match(ok.text, /4 個空間/);
  const off = macStatusText(new Set(['spaceLeft', 'spaceRight']), 1);
  assert.equal(off.bad, true);
  assert.match(off.text, /2 個是關閉的：⌃← ⌃→/);
  assert.match(off.text, /只有 1 個桌面/);
  assert.equal(macStatusText(new Set(), null).text.includes('空間（'), false, 'unknown count is not shown');
  assert.deepEqual(Object.keys(HOTKEYS), ['spaceLeft', 'spaceRight', 'missionControl', 'appWindows'],
    'same names as the Mac (SystemShortcutCheck.watched)');
});
