// Runs in <head> before the page is drawn (SOFA-10), so it never shows the wrong theme: puts data-theme (light / dark)
// and lang on <html>, sets the browser's bar colour and the iOS status bar to match, and keeps #app hidden until app.js
// has put the texts in (removed after 3 s anyway). A classic script, not a module: a module runs only once the page is
// parsed, when it may already have been drawn. The page's CSP allows no inline script, hence a file.
// app.js changes theme and language through window.pkmPrefs; both are kept on the phone as pkm.theme and pkm.lang.
(function () {
  'use strict';
  var root = document.documentElement;
  var BAR = { light: '#f2f3f5', dark: '#0e1013' };   // --bg of each theme in style.css
  var THEMES = ['system', 'light', 'dark'];
  var LANGS = ['auto', 'en', 'zh'];

  function get(k) { try { return localStorage.getItem('pkm.' + k); } catch (e) { return null; } }
  function set(k, v) { try { localStorage.setItem('pkm.' + k, v); } catch (e) { /* private mode: not kept */ } }

  /** The language to show: the one picked in ⚙︎, else the browser's first language (zh… → Chinese, else English). */
  function pickLang(choice, languages) {
    if (choice === 'en' || choice === 'zh') return choice;
    return /^zh(?![a-z])/i.test((languages && languages[0]) || '') ? 'zh' : 'en';
  }

  /** 'light' or 'dark': the one picked in ⚙︎, else the system's. */
  function resolveTheme(choice, systemDark) {
    if (choice === 'light' || choice === 'dark') return choice;
    return systemDark ? 'dark' : 'light';
  }

  var stored = { theme: get('theme'), lang: get('lang') };
  var prefs = {
    theme: THEMES.indexOf(stored.theme) >= 0 ? stored.theme : 'system',
    lang: LANGS.indexOf(stored.lang) >= 0 ? stored.lang : 'auto',
  };
  var systemDark = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  function applyTheme() {
    var theme = resolveTheme(prefs.theme, !!(systemDark && systemDark.matches));
    root.setAttribute('data-theme', theme);
    var bar = document.querySelector('meta[name="theme-color"]');
    if (bar) bar.setAttribute('content', BAR[theme]);
    // On the Home Screen: white status bar text over the dark page, dark text on a light bar. iOS reads it when the
    // app opens, so after a switch there the status bar follows on the next start.
    var status = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
    if (status) status.setAttribute('content', theme === 'dark' ? 'black-translucent' : 'default');
    return theme;
  }

  function browserLanguages() {
    return navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || ''];
  }

  function applyLang() {
    var lang = pickLang(prefs.lang, browserLanguages());
    root.setAttribute('lang', lang === 'zh' ? 'zh-Hant' : 'en');
    return lang;
  }

  applyTheme();
  applyLang();
  root.classList.add('i18n-pending');
  setTimeout(function () { root.classList.remove('i18n-pending'); }, 3000);
  // the system switches between light and dark (at sunset, in Control Centre): follow it while the choice is System
  if (systemDark) {
    var follow = function () { if (prefs.theme === 'system') applyTheme(); };
    if (systemDark.addEventListener) systemDark.addEventListener('change', follow);
    else if (systemDark.addListener) systemDark.addListener(follow);
  }

  window.pkmPrefs = {
    THEMES: THEMES,
    LANGS: LANGS,
    pickLang: pickLang,
    resolveTheme: resolveTheme,
    theme: function () { return prefs.theme; },
    lang: function () { return prefs.lang; },
    /** The language shown now ('en' or 'zh'). */
    currentLang: function () { return pickLang(prefs.lang, browserLanguages()); },
    /** The theme shown now ('light' or 'dark'). */
    currentTheme: function () { return root.getAttribute('data-theme'); },
    setTheme: function (choice) {
      if (THEMES.indexOf(choice) < 0) return applyTheme();
      prefs.theme = choice;
      set('theme', choice);
      return applyTheme();
    },
    setLang: function (choice) {
      if (LANGS.indexOf(choice) < 0) return applyLang();
      prefs.lang = choice;
      set('lang', choice);
      return applyLang();
    },
    /** For a browser language change while the choice is Auto. */
    refreshLang: applyLang,
    ready: function () { root.classList.remove('i18n-pending'); },
  };
})();
