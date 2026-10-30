// PKM-3-1 ②: the editable key row (what can go on it, saving, reordering, restoring the default).
// SOFA-8: three rows share the cells (input row, key row, landscape side panel); ⇧ 選取 and the cursor pad are cells;
// 4.2's saved row is converted.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS, V1_DEFAULT_ROW, LayoutStore, catalog, describe, comboId, MAX_ROW, MAX_CELLS } from '../js/keyrow.js';

const memory = () => { const m = new Map(); return { get: (k) => m.get(k) ?? null, set: (k, v) => m.set(k, v), m }; };
const labels = (r, row) => r.items(row).map((x) => x.label);

test('the default rows: box + cursor pad + ⏎; ⇧ 選取 esc tab ⌫ ← ↑ ↓ → ⌘ ⌥ ⌃ ⇧ space ⌦; landscape extras', () => {
  const r = new LayoutStore(memory());
  assert.deepEqual(labels(r, 'input'), ['◀ 游標 ▶', '⏎']);           // Enter right of the cursor pad (SOFA-8)
  assert.deepEqual(labels(r, 'keys'), ['⇧ 選取', 'esc', 'tab', '⌫', '←', '↑', '↓', '→', '⌘', '⌥', '⌃', '⇧', 'space', '⌦']);
  assert.deepEqual(r.items('keys').filter((x) => x.repeat).map((x) => x.k), ['backspace', 'left', 'up', 'down', 'right', 'forwarddelete']);
  assert.deepEqual(labels(r, 'side'), ['⌘C', '⌘V', '⌘X', '⌘Z', '⇧⌘Z', '⌘A', '⌘Tab', '⌃↑', '⌃←', '⌃→', '⌃⇧⌘4', '⌘S']);
  assert.ok(r.isDefault());
  assert.equal(describe('x:select').kind, 'select');
  assert.equal(describe('x:caret').kind, 'caret');
});

test('the reference list has what Ray named: esc, tab, ⌫, ↩, arrows, ⌘C／⌘V, screenshots, built-ins, his own, the cursor pad', () => {
  const mine = [{ id: 'a1', label: '截圖到剪貼簿', key: '4', mods: ['ctrl', 'shift', 'cmd'] }];
  const all = catalog(mine).flatMap((g) => g.items.map((i) => i.id));
  for (const id of ['k:escape', 'k:tab', 'k:backspace', 'k:enter', 'k:left', 'k:up', 'k:down', 'k:right', 'c:cmd+c', 'c:cmd+v',
    'c:shift,cmd+4', 'c:ctrl,shift,cmd+4', 'c:cmd+tab', 'u:a1', 'm:cmd', 'k:f5', 'x:caret', 'x:select']) assert.ok(all.includes(id), id);
  for (const row of Object.keys(DEFAULTS)) for (const id of DEFAULTS[row]) assert.ok(all.includes(id), `${row} ${id} is in the list`);
  const c = describe('c:cmd+c');
  assert.equal(c.label, '⌘C');
  assert.equal(c.name, '拷貝');
  assert.equal(describe('u:a1', mine).name, '截圖到剪貼簿');
  assert.equal(describe('u:a1', mine).label, '⌃⇧⌘4');
  assert.equal(comboId('4', ['cmd', 'shift']), 'c:shift,cmd+4');   // modifiers in Apple order, as in the catalog
});

test('add, remove, reorder (drag), saved, restore default', () => {
  const st = memory();
  const r = new LayoutStore(st);
  r.remove('keys', 'k:escape');
  assert.equal(r.add('keys', 'c:cmd+c'), true);
  assert.equal(r.add('keys', 'c:cmd+c'), '已經在按鍵列上');
  assert.equal(r.add('keys', 'k:nope'), '這個按鍵不能用');
  assert.ok(r.moveTo('keys', r.ids('keys').length - 1, 0));       // drag ⌘C to the front
  assert.equal(r.ids('keys')[0], 'c:cmd+c');
  assert.ok(r.move('keys', 'c:cmd+c', 1));
  assert.equal(r.ids('keys')[1], 'c:cmd+c');
  assert.equal(r.move('keys', 'x:select', -1), false);            // ⇧ 選取 is first again: nothing before it
  const again = new LayoutStore(st);                               // saved on the phone
  assert.deepEqual(again.rows, r.rows);
  assert.ok(!again.ids('keys').includes('k:escape'));
  again.reset();
  assert.ok(again.isDefault());
  assert.deepEqual(new LayoutStore(st).rows, DEFAULTS);
});

test('⇧ 選取 is an ordinary cell: reorder, remove, add back; the input row reorders the same way', () => {
  const st = memory();
  const r = new LayoutStore(st);
  assert.ok(r.move('keys', 'x:select', 3));
  assert.equal(r.ids('keys')[3], 'x:select');
  r.remove('keys', 'x:select');
  assert.equal(r.where('x:select'), null);
  assert.equal(r.add('keys', 'x:select'), true);
  assert.equal(r.ids('keys').at(-1), 'x:select');
  // the input row: Enter left of the cursor pad, add ⌫ after them, take the cursor pad out
  assert.ok(r.moveTo('input', 1, 0));
  assert.deepEqual(r.ids('input'), ['k:enter', 'x:caret']);
  assert.equal(r.add('input', 'k:backspace'), true);
  r.remove('input', 'x:caret');
  assert.deepEqual(new LayoutStore(st).ids('input'), ['k:enter', 'k:backspace']);
  assert.ok(r.has('keys', 'k:backspace'), 'an ordinary key can be in two rows');
  // the input row shares its line with the box: at most 6 cells
  for (const id of ['k:tab', 'k:escape', 'k:left', 'k:right', 'k:up']) r.add('input', id);
  assert.equal(r.ids('input').length, MAX_CELLS.input);
  assert.equal(r.add('input', 'k:down'), '輸入列最多 6 個');
});

test('the cursor pad and ⇧ 選取 are in one row at a time: adding one elsewhere moves it', () => {
  const st = memory();
  const r = new LayoutStore(st);
  assert.equal(r.add('side', 'x:caret'), true);
  assert.equal(r.where('x:caret'), 'side');
  assert.ok(!r.has('input', 'x:caret'));
  assert.equal(r.add('input', 'x:select'), true);
  assert.ok(!r.has('keys', 'x:select'));
  // a saved layout that has one twice (edited by hand) keeps the first
  st.set('layout', JSON.stringify({ version: 2, input: ['x:caret'], keys: ['x:caret', 'k:tab'], side: [] }));
  const l = new LayoutStore(st);
  assert.deepEqual(l.rows, { input: ['x:caret'], keys: ['k:tab'], side: [] });
});

test('4.2 phones: an untouched row becomes the new default; an edited one keeps every key, ⇧ 選取 in front', () => {
  const st = memory();
  st.set('keyrow', JSON.stringify({ version: 1, items: V1_DEFAULT_ROW }));
  const a = new LayoutStore(st);
  assert.equal(a.migrated, 'default');
  assert.ok(a.isDefault());
  const st2 = memory();
  const edited = ['c:cmd+c', 'k:tab', 'k:enter', 'm:cmd', 'c:shift,cmd+4', 'k:f5'];
  st2.set('keyrow', JSON.stringify({ version: 1, items: edited }));
  const b = new LayoutStore(st2);
  assert.equal(b.migrated, 'kept');
  assert.deepEqual(b.ids('keys'), ['x:select', ...edited]);
  assert.deepEqual(b.ids('input'), DEFAULTS.input);
  assert.deepEqual(b.ids('side'), DEFAULTS.side);
  assert.equal(st2.get('keyrow'), JSON.stringify({ version: 1, items: edited }), '4.2’s key is left as it was');
  const c = new LayoutStore(st2);                                   // converted once, then read as version 2
  assert.equal(c.migrated, false);
  assert.deepEqual(c.rows, b.rows);
});

test('a deleted custom shortcut leaves the row; junk in storage is ignored', () => {
  let mine = [{ id: 'x9', label: '我的', key: 'k', mods: ['opt', 'cmd'] }];
  const st = memory();
  const r = new LayoutStore(st, () => mine);
  r.add('keys', 'u:x9');
  r.add('side', 'u:x9');
  assert.equal(r.items('keys').at(-1).label, '⌥⌘K');
  mine = [];
  r.prune();
  assert.ok(!r.ids('keys').includes('u:x9') && !r.ids('side').includes('u:x9'));
  const st2 = memory();
  st2.set('keyrow', JSON.stringify({ version: 1, items: ['k:tab', 'k:tab', 'zzz', 42, 'm:hyper', 'c:cmd+'] }));
  assert.deepEqual(new LayoutStore(st2).ids('keys'), ['x:select', 'k:tab']);
  const st3 = memory();
  st3.set('keyrow', '{broken');
  assert.deepEqual(new LayoutStore(st3).rows, DEFAULTS);
  st3.set('layout', '{broken');
  assert.deepEqual(new LayoutStore(st3).rows, DEFAULTS);
  st3.set('layout', JSON.stringify({ version: 2, input: 'x', keys: [7, 'k:tab'] }));
  assert.deepEqual(new LayoutStore(st3).rows, { input: DEFAULTS.input, keys: ['k:tab'], side: DEFAULTS.side });
  const full = new LayoutStore(memory());
  for (const g of catalog([])) for (const it of g.items) full.add('keys', it.id);
  assert.equal(full.ids('keys').length, MAX_ROW);
});
