// Generated from i18n-core.js by sync-efb-web-assets.js. Do not edit.
// UI language support (see docs/English Translation Plan.md).
// German stays the default and the fallback. With German selected and never switched,
// apply() changes nothing: static German text lives in the HTML, not in a dictionary.
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;else {
    root.GAI18n = api;
    api.install(root);
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var STORAGE_KEY = 'ga_language_v1';
  var PREVIEW_KEY = 'ga_i18n_preview';
  var LANGUAGES = Object.freeze(['de', 'en']);
  var DEFAULT_LANGUAGE = 'de';
  // Attributes that can carry a key: data-i18n -> textContent, the others -> that attribute.
  var ATTRS = Object.freeze({
    'data-i18n-title': 'title',
    'data-i18n-aria-label': 'aria-label',
    'data-i18n-placeholder': 'placeholder',
    // Language-specific images (e.g. the embossed settings roll): key -> image path.
    'data-i18n-src': 'src',
    'data-i18n-alt': 'alt',
    // Language-specific links (e.g. the English guide): key -> URL.
    'data-i18n-href': 'href'
  });
  var dictionaries = {
    de: {},
    en: {}
  };
  var listeners = new Set();
  var current = DEFAULT_LANGUAGE;
  var applied = false;
  var win = null;
  function normalizeLanguage(value) {
    var v = String(value || '').toLowerCase();
    return LANGUAGES.includes(v) ? v : DEFAULT_LANGUAGE;
  }
  function register(language, entries) {
    var lang = normalizeLanguage(language);
    if (!entries || typeof entries !== 'object') return;
    Object.assign(dictionaries[lang], entries);
  }
  function fill(template, vars) {
    return String(template).replace(/\{([a-zA-Z0-9_]+)\}/g, (match, name) => vars && Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : match);
  }
  function has(key) {
    var language = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : current;
    return Object.prototype.hasOwnProperty.call(dictionaries[normalizeLanguage(language)], key);
  }

  // Lookup order: selected language -> German -> fallback argument -> key.
  function t(key, vars, fallback) {
    var k = String(key || '');
    var text = has(k, current) ? dictionaries[current][k] : has(k, 'de') ? dictionaries.de[k] : fallback !== undefined ? fallback : k;
    return fill(text, vars);
  }

  // Phrases: whole German sentences mapped to a translation, for status messages that are
  // passed around as finished text (e.g. updateSyncStatus('PIN falsch')). Callers stay
  // untouched; only the display translates. No exact match = German text stays.
  var phrases = {
    en: {}
  };
  function registerPhrases(language, entries) {
    var lang = normalizeLanguage(language);
    if (lang === DEFAULT_LANGUAGE || !entries || typeof entries !== 'object') return;
    Object.assign(phrases[lang], entries);
  }
  function phrase(text) {
    if (current === DEFAULT_LANGUAGE || typeof text !== 'string') return text;
    var table = phrases[current];
    return table && Object.prototype.hasOwnProperty.call(table, text) ? table[text] : text;
  }
  function getLanguage() {
    return current;
  }

  // Translate static markup. The original (German) text is remembered on first touch so
  // switching back to German restores it exactly. Unknown keys leave the element alone.
  function apply(scope) {
    var doc = win && win.document;
    var rootEl = scope || doc && doc.documentElement;
    if (!rootEl || !rootEl.querySelectorAll) return 0;
    if (current === DEFAULT_LANGUAGE && !applied) return 0;
    var changed = 0;
    rootEl.querySelectorAll('[data-i18n]').forEach(el => {
      var key = el.getAttribute('data-i18n');
      if (!el.hasAttribute('data-i18n-orig')) el.setAttribute('data-i18n-orig', el.textContent);
      var next = current === DEFAULT_LANGUAGE ? el.getAttribute('data-i18n-orig') : has(key, current) ? dictionaries[current][key] : el.getAttribute('data-i18n-orig');
      if (el.textContent !== next) {
        el.textContent = next;
        changed++;
      }
    });
    Object.keys(ATTRS).forEach(dataAttr => {
      var target = ATTRS[dataAttr];
      var origAttr = `${dataAttr}-orig`;
      rootEl.querySelectorAll(`[${dataAttr}]`).forEach(el => {
        var key = el.getAttribute(dataAttr);
        if (!el.hasAttribute(origAttr)) el.setAttribute(origAttr, el.getAttribute(target) || '');
        var next = current === DEFAULT_LANGUAGE ? el.getAttribute(origAttr) : has(key, current) ? dictionaries[current][key] : el.getAttribute(origAttr);
        if (el.getAttribute(target) !== next) {
          el.setAttribute(target, next);
          changed++;
        }
      });
    });
    // Status fields that JavaScript overwrites later: only the German start text is swapped
    // (via the phrase table). Once code has written something else, the element is left alone.
    rootEl.querySelectorAll('[data-i18n-initial]').forEach(el => {
      if (!el.hasAttribute('data-i18n-orig')) el.setAttribute('data-i18n-orig', el.textContent);
      var orig = el.getAttribute('data-i18n-orig');
      var key = orig.trim();
      var translations = Object.keys(phrases).map(lang => phrases[lang][key]).filter(Boolean);
      var untouched = el.textContent === orig || translations.includes(el.textContent);
      if (!untouched) return;
      var next = current === DEFAULT_LANGUAGE ? orig : phrases[current] && Object.prototype.hasOwnProperty.call(phrases[current], key) ? phrases[current][key] : orig;
      if (el.textContent !== next) {
        el.textContent = next;
        changed++;
      }
    });
    applied = true;
    return changed;
  }
  function syncControls() {
    var doc = win && win.document;
    if (!doc) return;
    doc.documentElement.setAttribute('lang', current);
    doc.querySelectorAll('[data-language-option]').forEach(btn => {
      btn.setAttribute('aria-pressed', btn.dataset.languageOption === current ? 'true' : 'false');
    });
  }
  function setLanguage(language) {
    var next = normalizeLanguage(language);
    try {
      win && win.localStorage.setItem(STORAGE_KEY, next);
    } catch (_) {}
    if (next === current) {
      syncControls();
      return current;
    }
    current = next;
    apply();
    syncControls();
    listeners.forEach(fn => {
      try {
        fn(current);
      } catch (_) {}
    });
    try {
      win && win.dispatchEvent(new win.CustomEvent('ga:languagechange', {
        detail: {
          language: current
        }
      }));
    } catch (_) {}
    return current;
  }
  function onChange(fn) {
    if (typeof fn !== 'function') return () => {};
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  // Locale for numbers and dates shown in the UI. Stored values stay German.
  function locale() {
    return current === 'en' ? 'en-GB' : 'de-DE';
  }
  function formatNumber(value, options) {
    try {
      return new Intl.NumberFormat(locale(), options).format(value);
    } catch (_) {
      return String(value);
    }
  }

  // The switch stays hidden for testers until the UI translation is far enough along:
  // visible on local dev hosts, or with localStorage ga_i18n_preview = '1'.
  function previewEnabled() {
    if (!win) return false;
    if (win.__gaLocalDevNoSw) return true;
    try {
      return win.localStorage.getItem(PREVIEW_KEY) === '1';
    } catch (_) {
      return false;
    }
  }
  function install(w) {
    if (!w || !w.document) return;
    win = w;
    var stored = DEFAULT_LANGUAGE;
    try {
      stored = normalizeLanguage(w.localStorage.getItem(STORAGE_KEY));
    } catch (_) {}
    current = stored;
    var ready = () => {
      var doc = w.document;
      doc.querySelectorAll('[data-i18n-preview-only]').forEach(el => {
        el.style.display = previewEnabled() ? '' : 'none';
      });
      apply();
      syncControls();
      // Started in another language: let views built from translated markup redraw once,
      // after the app's own start handlers. Never runs for German.
      if (current !== DEFAULT_LANGUAGE) {
        w.setTimeout(() => listeners.forEach(fn => {
          try {
            fn(current);
          } catch (_) {}
        }), 0);
      }
    };
    if (w.document.readyState === 'loading') w.document.addEventListener('DOMContentLoaded', ready);else ready();
  }
  function _resetForTests() {
    dictionaries.de = {};
    dictionaries.en = {};
    phrases.en = {};
    current = DEFAULT_LANGUAGE;
    applied = false;
    win = null;
    listeners.clear();
  }
  return {
    LANGUAGES,
    DEFAULT_LANGUAGE,
    STORAGE_KEY,
    t,
    has,
    register,
    registerPhrases,
    phrase,
    getLanguage,
    setLanguage,
    onChange,
    apply,
    install,
    formatNumber,
    locale,
    normalizeLanguage,
    previewEnabled,
    dictionaries,
    phrases,
    _resetForTests,
    _setLanguageForTests(lang) {
      current = normalizeLanguage(lang);
    }
  };
});
