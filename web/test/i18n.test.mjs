// SOFA-10: the page in English and Chinese, and the theme. Every text is in both dictionaries; nothing in English mode is
// Chinese; the markup and the code hold no UI text of their own; js/boot.js picks the language and theme before drawing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import en from '../js/lang/en.js';
import zh from '../js/lang/zh.js';
import { t, setLang, lang, translate } from '../js/i18n.js';
import { BUILTIN_GROUPS, KEY_GROUPS, HOTKEYS, hotkeyHint, macStatusText, gestureShortcut, ShortcutStore } from '../js/shortcuts.js';
import { LayoutStore, catalog, describe, DEFAULTS, ROWS, ROW_NAMES } from '../js/keyrow.js';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
// Han, Bopomofo, CJK punctuation（「」、：）and full-width forms（（）＋）: what a leftover Chinese text would bring
const CJK = /[　-〿㄀-ㄯ㐀-䶿一-鿿＀-￯]/;
// The language's own name stays in its own script on the English page (that is how a Chinese reader finds it).
const ENDONYMS = new Set(['lang.zh']);
const SAMPLE = { n: 2, s: 30, added: 3, skipped: 1, host: 'Mac', text: 'hello', what: 'x', why: 'y', row: 'r', label: 'l', name: 'n',
  combo: '⌘C', combos: '⌃←', path: 'p', setting: 's', settings: 's', err: 'e', error: 'e', page: 'p', mac: 'm', ver: '4', build: 'b',
  time: 't', from: 'f', to: 't', key: 'k' };
const say = (v, p = SAMPLE) => (typeof v === 'function' ? v(p) : v);
const holes = (v) => (typeof v === 'string' ? [...v.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort() : null);
const memoryStore = () => { const m = new Map(); return { get: (k) => (m.has(k) ? m.get(k) : null), set: (k, v) => m.set(k, v), del: (k) => m.delete(k) }; };

test('both dictionaries have the same keys, and every value is text', () => {
  assert.deepEqual(Object.keys(en).sort(), Object.keys(zh).sort());
  for (const [k, v] of [...Object.entries(en), ...Object.entries(zh)]) {
    assert.equal(typeof say(v), 'string', k);
    assert.ok(say(v).length > 0 || k === 'mac.off.sep', `${k} is empty`);
    if (typeof v === 'function') assert.equal(typeof say(v, { ...SAMPLE, n: 1, added: 1, skipped: 0 }), 'string', k);
  }
});

test('a text takes the same {placeholders} in both languages', () => {
  for (const k of Object.keys(en)) {
    const a = holes(en[k]);
    const b = holes(zh[k]);
    if (a && b) assert.deepEqual(a, b, k);
  }
});

test('no Chinese in the English dictionary (only the name 中文 itself)', () => {
  for (const [k, v] of Object.entries(en)) {
    if (ENDONYMS.has(k)) continue;
    for (const p of [SAMPLE, { ...SAMPLE, n: 1, added: 1, skipped: 0 }]) assert.ok(!CJK.test(say(v, p)), `${k}: ${say(v, p)}`);
  }
  assert.equal(en['lang.zh'], '中文');
  assert.equal(zh['lang.en'], 'English');
});

test('t(): fills {names}, falls back to the other language, says which key when there is none', () => {
  setLang('en');
  assert.equal(lang(), 'en');
  assert.equal(t('host.reconnecting', { n: 3 }), 'Reconnecting… (try 3)');
  assert.equal(t('io.copied', { n: 1 }), 'Copied the JSON of 1 shortcut.');
  assert.equal(t('io.copied', { n: 2 }), 'Copied the JSON of 2 shortcuts.');
  assert.equal(t('no.such.key'), 'no.such.key');
  setLang('zh');
  assert.equal(t('host.reconnecting', { n: 3 }), '重新連線中…（第 3 次）');
  assert.equal(t('io.imported', { added: 2, skipped: 1 }), '匯入 2 個，略過 1 個（重複或不能用）。');
  assert.equal(setLang('fr'), 'zh', 'an unknown language changes nothing');
});

test('the markup has no text of its own: every word comes from a data-i18n key that exists', () => {
  const html = readFileSync(join(WEB, 'index.html'), 'utf8').replace(/<!--[\s\S]*?-->/g, '');
  const body = html.slice(html.indexOf('<body>'));
  const keys = [...body.matchAll(/data-i18n(?:-aria|-title|-placeholder)?="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(keys.length > 90, `only ${keys.length} keys in the markup`);
  for (const k of keys) assert.ok(k in en && k in zh, `missing key ${k}`);
  assert.ok(!CJK.test(html), 'Chinese in index.html');
  // text between tags: symbols only (⚙︎ ✕ ‹ › ⛶ ⌘ ⇵), and "Aa", the keyboard button's glyph
  const words = body.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]*>/g, ' ').match(/\p{L}+/gu) || [];
  assert.deepEqual(words.filter((w) => w !== 'Aa'), [], 'words in the markup');
  // labels and hints are data-i18n-* too, never written out
  for (const attr of ['aria-label', 'title', 'placeholder']) {
    for (const m of body.matchAll(new RegExp(`\\s${attr}="([^"]*)"`, 'g'))) assert.ok(!/\p{L}/u.test(m[1]), `${attr}="${m[1]}"`);
  }
});

test('the code holds no Chinese text outside comments (it is all in lang/zh.js)', () => {
  const files = [...readdirSync(join(WEB, 'js')).filter((f) => f.endsWith('.js')).map((f) => join('js', f)),
    ...readdirSync(join(WEB, 'js/lang')).map((f) => join('js/lang', f))].filter((f) => f !== join('js/lang/zh.js'));
  for (const f of files) {
    const src = readFileSync(join(WEB, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    src.split('\n').forEach((line, i) => {
      const code = line.replace(/(^|\s)\/\/.*$/, '');
      if (CJK.test(code) && !(f === join('js/lang/en.js') && code.includes("'lang.zh'"))) assert.fail(`${f}:${i + 1}: ${code.trim()}`);
    });
  }
  const css = readFileSync(join(WEB, 'style.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.ok(!CJK.test(css), 'Chinese in style.css outside comments');
});

test('every key the code asks for exists (t(\'…\') with a fixed key)', () => {
  for (const f of ['app.js', 'keyrow.js', 'shortcuts.js']) {
    const src = readFileSync(join(WEB, 'js', f), 'utf8');
    for (const m of src.matchAll(/\bt\('([\w.]+)'/g)) assert.ok(m[1] in en, `${f}: ${m[1]}`);
  }
});

test('the catalogue, rows and Mac hints in English: named, and no Chinese', () => {
  setLang('en');
  try {
    const texts = [];
    for (const g of [...BUILTIN_GROUPS, ...KEY_GROUPS]) {
      texts.push(g.label);
      for (const s of g.items || []) texts.push(s.label);
    }
    for (const g of catalog([])) { texts.push(g.label); for (const it of g.items) texts.push(it.label, it.name); }
    for (const r of ROWS) texts.push(ROW_NAMES[r]);
    for (const h of Object.keys(HOTKEYS)) texts.push(HOTKEYS[h].setting, hotkeyHint({ hotkey: h, hotkeyOff: true }));
    texts.push(hotkeyHint({ hotkey: 'spaceLeft', spaces: 1 }));
    texts.push(macStatusText(new Set(['spaceLeft', 'appWindows']), 1).text, macStatusText(new Set(), 3).text);
    for (const a of [{ type: 'zoom', dir: 'in' }, { type: 'swipe', fingers: 3, dir: 'left' }, { type: 'swipe', fingers: 2, dir: 'right' }]) texts.push(gestureShortcut(a).label);
    for (const s of texts) {
      assert.equal(typeof s, 'string');
      assert.ok(s && !/^(sc|group|hotkey|cat|key|cell|row)\./.test(s), `untranslated: ${s}`);
      assert.ok(!CJK.test(s), s);
    }
    assert.equal(describe('x:caret').label, '◀ Cursor ▶');
    assert.equal(describe('x:select').label, '⇧ Select');
    assert.equal(describe('c:cmd+c').name, 'Copy');
    assert.equal(describe('k:backspace').name, 'Delete (⌫)');
    assert.match(macStatusText(new Set(['spaceLeft']), null).text, /^1 of the Mac shortcuts .* is turned off: ⌃←\. .* check “Move left a space”\.$/);
    assert.match(macStatusText(new Set(['spaceLeft', 'spaceRight']), null).text, /2 of .* are turned off: ⌃← ⌃→\. .* check “Move left a space”, “Move right a space”\.$/);
    const r = new LayoutStore(memoryStore());
    assert.equal(r.add('keys', 'k:escape'), 'Already on the key row');
    for (const k of ['k:tab', 'k:left', 'k:right', 'k:up', 'k:down']) r.add('input', k);
    assert.equal(r.add('input', 'k:home'), 'The text row holds at most 6');
    const s = new ShortcutStore(memoryStore());
    assert.equal(s.add({ key: 'nope' }), 'This key combination can’t be used');
    assert.equal(s.importJSON('{').error, 'This isn’t valid JSON');
    // and back in Chinese, the 4.3.0 words
    setLang('zh');
    assert.equal(describe('x:caret').label, '◀ 游標 ▶');
    assert.equal(BUILTIN_GROUPS[0].items[0].label, '拷貝');
    assert.deepEqual(DEFAULTS.input, ['x:caret', 'k:enter']);
  } finally {
    setLang('zh');
  }
});

test('translate(): fills text, aria-label, title and placeholder from the keys', () => {
  const el = (data) => ({ dataset: data, textContent: '', title: '', placeholder: '', attrs: {}, setAttribute(k, v) { this.attrs[k] = v; } });
  const a = el({ i18n: 'mode.live' });
  const b = el({ i18nAria: 'pad.aria' });
  const c = el({ i18nTitle: 'done' });
  const d = el({ i18nPlaceholder: 'io.placeholder' });
  const root = { querySelectorAll: (sel) => ({ '[data-i18n]': [a], '[data-i18n-aria]': [b], '[data-i18n-title]': [c], '[data-i18n-placeholder]': [d] })[sel] };
  setLang('en');
  translate(root);
  assert.deepEqual([a.textContent, b.attrs['aria-label'], c.title, d.placeholder], ['Live', 'Trackpad', 'Done', en['io.placeholder']]);
  setLang('zh');
  translate(root);
  assert.deepEqual([a.textContent, b.attrs['aria-label'], c.title], ['即時', '觸控板', '完成']);
});

/** Runs js/boot.js the way the page does, in a sandbox with the browser parts it touches. */
function boot({ languages = ['en-US'], systemDark = false, stored = {}, storageThrows = false } = {}) {
  const attrs = {};
  const classes = new Set();
  const metas = { 'theme-color': { content: '#0e1013' }, 'apple-mobile-web-app-status-bar-style': { content: 'black-translucent' } };
  for (const m of Object.values(metas)) m.setAttribute = function (k, v) { this[k] = v; };
  const listeners = [];
  const data = new Map(Object.entries(stored).map(([k, v]) => ['pkm.' + k, v]));
  const media = { matches: systemDark, addEventListener: (type, fn) => listeners.push(fn) };
  const ctx = {
    document: {
      documentElement: { setAttribute: (k, v) => { attrs[k] = v; }, getAttribute: (k) => attrs[k] ?? null, classList: { add: (c) => classes.add(c), remove: (c) => classes.delete(c) } },
      querySelector: (sel) => metas[/name="([^"]+)"/.exec(sel)[1]] || null,
    },
    localStorage: {
      getItem: (k) => { if (storageThrows) throw new Error('SecurityError'); return data.has(k) ? data.get(k) : null; },
      setItem: (k, v) => { if (storageThrows) throw new Error('SecurityError'); data.set(k, String(v)); },
    },
    navigator: { languages, language: languages[0] },
    matchMedia: () => media,
    setTimeout: () => 0,
  };
  ctx.window = ctx;
  vm.runInNewContext(readFileSync(join(WEB, 'js/boot.js'), 'utf8'), ctx);
  return { prefs: ctx.pkmPrefs, attrs, classes, metas, data, media, flip(dark) { media.matches = dark; listeners.forEach((f) => f()); } };
}

test('boot.js: the language is the browser\'s (zh… → Chinese, anything else → English) until one is picked', () => {
  const cases = [[['zh-TW'], 'zh'], [['zh'], 'zh'], [['zh-Hant-TW'], 'zh'], [['zh-CN'], 'zh'], [['ZH-hk'], 'zh'],
    [['en-US'], 'en'], [['ja-JP'], 'en'], [['fr'], 'en'], [['en-TW', 'zh-Hant-TW'], 'en'], [['zhx'], 'en'], [[''], 'en'], [[], 'en']];
  for (const [languages, want] of cases) {
    const b = boot({ languages });
    assert.equal(b.prefs.currentLang(), want, JSON.stringify(languages));
    assert.equal(b.attrs.lang, want === 'zh' ? 'zh-Hant' : 'en');
    assert.equal(b.prefs.lang(), 'auto');
  }
  const picked = boot({ languages: ['en-US'], stored: { lang: 'zh' } });
  assert.equal(picked.prefs.currentLang(), 'zh');
  assert.equal(picked.attrs.lang, 'zh-Hant');
  assert.equal(boot({ languages: ['zh-TW'], stored: { lang: 'nonsense' } }).prefs.lang(), 'auto', 'a bad saved value is ignored');
});

test('boot.js: the theme before the first frame — the saved one, else the system\'s; bar colours follow', () => {
  const light = boot({ systemDark: false });
  assert.equal(light.attrs['data-theme'], 'light');
  assert.equal(light.metas['theme-color'].content, '#f2f3f5');
  assert.equal(light.metas['apple-mobile-web-app-status-bar-style'].content, 'default');
  const dark = boot({ systemDark: true });
  assert.equal(dark.attrs['data-theme'], 'dark');
  assert.equal(dark.metas['theme-color'].content, '#0e1013');
  assert.equal(dark.metas['apple-mobile-web-app-status-bar-style'].content, 'black-translucent');
  assert.equal(boot({ systemDark: true, stored: { theme: 'light' } }).attrs['data-theme'], 'light');
  assert.equal(boot({ systemDark: false, stored: { theme: 'dark' } }).attrs['data-theme'], 'dark');
  assert.ok(light.classes.has('i18n-pending'), 'hidden until the texts are in');
  light.prefs.ready();
  assert.ok(!light.classes.has('i18n-pending'));
});

test('boot.js: System follows the system live; a picked theme does not; choices are saved', () => {
  const b = boot({ systemDark: false });
  b.flip(true);
  assert.equal(b.attrs['data-theme'], 'dark');
  assert.equal(b.prefs.setTheme('light'), 'light');
  assert.equal(b.data.get('pkm.theme'), 'light');
  b.flip(false);
  b.flip(true);
  assert.equal(b.attrs['data-theme'], 'light', 'Light stays light when the system goes dark');
  b.prefs.setTheme('system');
  assert.equal(b.attrs['data-theme'], 'dark');
  b.prefs.setTheme('purple');
  assert.equal(b.prefs.theme(), 'system', 'an unknown theme changes nothing');
  assert.equal(b.prefs.setLang('zh'), 'zh');
  assert.equal(b.data.get('pkm.lang'), 'zh');
  assert.equal(b.attrs.lang, 'zh-Hant');
  assert.equal(b.prefs.setLang('auto'), 'en');
});

test('boot.js: blocked storage (private mode) is no error: defaults, nothing kept', () => {
  const b = boot({ storageThrows: true, languages: ['zh-TW'], systemDark: true });
  assert.equal(b.prefs.currentLang(), 'zh');
  assert.equal(b.attrs['data-theme'], 'dark');
  assert.equal(b.prefs.setTheme('light'), 'light');
  assert.equal(b.prefs.setLang('en'), 'en');
});
