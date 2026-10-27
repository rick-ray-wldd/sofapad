// PKM-3-1 ②: the editable key row (what can go on it, saving, reordering, restoring the default).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_ROW, KeyRowStore, catalog, describe, comboId, MAX_ROW } from '../js/keyrow.js';

const memory = () => { const m = new Map(); return { get: (k) => m.get(k) ?? null, set: (k, v) => m.set(k, v), m }; };

test('the default row is the v2 row: esc tab ⌫ ⏎ ← ↑ ↓ → ⌘ ⌥ ⌃ ⇧ space ⌦', () => {
  const r = new KeyRowStore(memory());
  assert.deepEqual(r.items().map((x) => x.label), ['esc', 'tab', '⌫', '⏎', '←', '↑', '↓', '→', '⌘', '⌥', '⌃', '⇧', 'space', '⌦']);
  assert.deepEqual(r.items().filter((x) => x.repeat).map((x) => x.k), ['backspace', 'left', 'up', 'down', 'right', 'forwarddelete']);
  assert.ok(r.isDefault());
});

test('the reference list has what Ray named: esc, tab, ⌫, ↩, arrows, ⌘C／⌘V, screenshots, built-ins, his own', () => {
  const mine = [{ id: 'a1', label: '截圖到剪貼簿', key: '4', mods: ['ctrl', 'shift', 'cmd'] }];
  const all = catalog(mine).flatMap((g) => g.items.map((i) => i.id));
  for (const id of ['k:escape', 'k:tab', 'k:backspace', 'k:enter', 'k:left', 'k:up', 'k:down', 'k:right', 'c:cmd+c', 'c:cmd+v',
    'c:shift,cmd+4', 'c:ctrl,shift,cmd+4', 'c:cmd+tab', 'u:a1', 'm:cmd', 'k:f5']) assert.ok(all.includes(id), id);
  const c = describe('c:cmd+c');
  assert.equal(c.label, '⌘C');
  assert.equal(c.name, '拷貝');
  assert.equal(describe('u:a1', mine).name, '截圖到剪貼簿');
  assert.equal(describe('u:a1', mine).label, '⌃⇧⌘4');
  assert.equal(comboId('4', ['cmd', 'shift']), 'c:shift,cmd+4');   // modifiers in Apple order, as in the catalog
});

test('add, remove, reorder (drag), saved, restore default', () => {
  const st = memory();
  const r = new KeyRowStore(st);
  r.remove('k:escape');
  assert.equal(r.add('c:cmd+c'), true);
  assert.equal(r.add('c:cmd+c'), '已經在按鍵列上');
  assert.equal(r.add('k:nope'), '這個按鍵不能用');
  assert.ok(r.moveTo(r.ids.length - 1, 0));               // drag ⌘C to the front
  assert.equal(r.ids[0], 'c:cmd+c');
  assert.ok(r.move('c:cmd+c', 1));
  assert.equal(r.ids[1], 'c:cmd+c');
  assert.equal(r.move('k:tab', -1), false);               // tab is first again: nothing before it
  const again = new KeyRowStore(st);                       // saved on the phone
  assert.deepEqual(again.ids, r.ids);
  assert.ok(!again.ids.includes('k:escape'));
  again.reset();
  assert.ok(again.isDefault());
  assert.deepEqual(new KeyRowStore(st).ids, DEFAULT_ROW);
});

test('a deleted custom shortcut leaves the row; junk in storage is ignored', () => {
  let mine = [{ id: 'x9', label: '我的', key: 'k', mods: ['opt', 'cmd'] }];
  const st = memory();
  const r = new KeyRowStore(st, () => mine);
  r.add('u:x9');
  assert.equal(r.items().at(-1).label, '⌥⌘K');
  mine = [];
  r.prune();
  assert.ok(!r.ids.includes('u:x9'));
  st.set('keyrow', JSON.stringify({ version: 1, items: ['k:tab', 'k:tab', 'zzz', 42, 'm:hyper', 'c:cmd+'] }));
  assert.deepEqual(new KeyRowStore(st).ids, ['k:tab']);
  st.set('keyrow', '{broken');
  assert.deepEqual(new KeyRowStore(st).ids, DEFAULT_ROW);
  const full = new KeyRowStore(memory());
  for (const g of catalog([])) for (const it of g.items) full.add(it.id);
  assert.equal(full.ids.length, MAX_ROW);
});
