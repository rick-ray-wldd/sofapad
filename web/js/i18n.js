// The page's two languages (SOFA-10): one dictionary per language (lang/en.js, lang/zh.js) with the same keys. Which
// one the page starts in is decided before it is drawn (js/boot.js: the saved choice, else the browser's language);
// app.js passes it to setLang(). Until then t() answers in Chinese, the language of 4.3.0 (the unit tests rely on it).
import en from './lang/en.js';
import zh from './lang/zh.js';

export const DICTIONARIES = { en, zh };
let current = 'zh';

export function setLang(lang) {
  if (DICTIONARIES[lang]) current = lang;
  return current;
}

export function lang() { return current; }

/**
 * The text for `key` in the current language; `{name}` takes params.name. A key missing in one language falls back to
 * the other one rather than showing the key (the unit tests make sure none is missing).
 */
export function t(key, params = {}) {
  const v = DICTIONARIES[current][key] ?? DICTIONARIES[current === 'en' ? 'zh' : 'en'][key];
  if (typeof v === 'function') return v(params);
  if (typeof v !== 'string') return key;
  return v.replace(/\{(\w+)\}/g, (m, name) => (name in params ? String(params[name]) : m));
}

/**
 * Fills the markup's texts: data-i18n → text, data-i18n-aria → aria-label, data-i18n-title → title,
 * data-i18n-placeholder → placeholder.
 */
export function translate(root) {
  for (const el of root.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
  for (const el of root.querySelectorAll('[data-i18n-aria]')) el.setAttribute('aria-label', t(el.dataset.i18nAria));
  for (const el of root.querySelectorAll('[data-i18n-title]')) el.title = t(el.dataset.i18nTitle);
  for (const el of root.querySelectorAll('[data-i18n-placeholder]')) el.placeholder = t(el.dataset.i18nPlaceholder);
}
