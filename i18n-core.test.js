const test = require('node:test');
const assert = require('node:assert/strict');
const i18n = require('./i18n-core');

test.beforeEach(() => i18n._resetForTests());

test('German is the default and unknown languages fall back to German', () => {
    assert.equal(i18n.getLanguage(), 'de');
    assert.equal(i18n.normalizeLanguage('EN'), 'en');
    assert.equal(i18n.normalizeLanguage('fr'), 'de');
    assert.equal(i18n.normalizeLanguage(null), 'de');
});

test('lookup goes selected language, then German, then fallback, then key', () => {
    i18n.register('de', { 'a': 'Deutsch A', 'b': 'Deutsch B' });
    i18n.register('en', { 'a': 'English A' });
    i18n._setLanguageForTests('en');
    assert.equal(i18n.t('a'), 'English A');
    assert.equal(i18n.t('b'), 'Deutsch B');
    assert.equal(i18n.t('c', null, 'Rückfall'), 'Rückfall');
    assert.equal(i18n.t('c'), 'c');
});

test('placeholders are filled and unknown ones are kept', () => {
    i18n.register('de', { 'x': 'Update {version} von {who}' });
    assert.equal(i18n.t('x', { version: '1.2' }), 'Update 1.2 von {who}');
    assert.equal(i18n.t('x', { version: 0, who: '' }), 'Update 0 von ');
});

// Minimal DOM stand-in: enough for apply() and setLanguage().
function fakeDom(nodes) {
    const els = nodes.map(n => {
        const attrs = { ...n.attrs };
        return {
            textContent: n.text || '',
            getAttribute: k => (k in attrs ? attrs[k] : null),
            setAttribute: (k, v) => { attrs[k] = String(v); },
            hasAttribute: k => k in attrs,
            attrs
        };
    });
    const html = { attrs: {}, setAttribute(k, v) { this.attrs[k] = v; } };
    html.querySelectorAll = sel => {
        const m = /^\[([a-z0-9-]+)\]$/.exec(sel);
        return m ? els.filter(e => e.hasAttribute(m[1])) : [];
    };
    const store = {};
    const win = {
        document: { readyState: 'complete', documentElement: html, querySelectorAll: () => [] },
        localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = v; } },
        CustomEvent: function (type, init) { this.type = type; this.detail = init.detail; },
        setTimeout: fn => fn(),
        dispatchEvent() {}
    };
    return { els, html, win, store };
}

test('German without a switch leaves the markup untouched', () => {
    const { els, win } = fakeDom([{ text: 'Darstellung', attrs: { 'data-i18n': 'k' } }]);
    i18n.register('en', { k: 'Appearance' });
    i18n.install(win);
    assert.equal(els[0].textContent, 'Darstellung');
    assert.equal(els[0].hasAttribute('data-i18n-orig'), false);
});

test('switching to English and back restores the original German text and attributes', () => {
    const { els, html, win, store } = fakeDom([
        { text: 'Darstellung', attrs: { 'data-i18n': 'k' } },
        { text: '?', attrs: { 'data-i18n-aria-label': 'h', 'aria-label': 'Hilfe' } },
        { text: 'Bleibt', attrs: { 'data-i18n': 'missing' } }
    ]);
    i18n.register('en', { k: 'Appearance', h: 'Help' });
    i18n.install(win);
    i18n.setLanguage('en');
    assert.equal(els[0].textContent, 'Appearance');
    assert.equal(els[1].getAttribute('aria-label'), 'Help');
    assert.equal(els[2].textContent, 'Bleibt', 'unknown keys keep the German text');
    assert.equal(html.attrs.lang, 'en');
    assert.equal(store[i18n.STORAGE_KEY], 'en');
    i18n.setLanguage('de');
    assert.equal(els[0].textContent, 'Darstellung');
    assert.equal(els[1].getAttribute('aria-label'), 'Hilfe');
    assert.equal(html.attrs.lang, 'de');
});

test('a stored English choice is applied on start', () => {
    const { els, win, store } = fakeDom([{ text: 'Darstellung', attrs: { 'data-i18n': 'k' } }]);
    store[i18n.STORAGE_KEY] = 'en';
    i18n.register('en', { k: 'Appearance' });
    i18n.install(win);
    assert.equal(i18n.getLanguage(), 'en');
    assert.equal(els[0].textContent, 'Appearance');
});

test('onChange listeners hear language changes', () => {
    const { win } = fakeDom([]);
    i18n.install(win);
    const heard = [];
    const off = i18n.onChange(lang => heard.push(lang));
    i18n.setLanguage('en');
    i18n.setLanguage('en');
    off();
    i18n.setLanguage('de');
    assert.deepEqual(heard, ['en']);
});

test('phrases translate exact German sentences only, and never in German', () => {
    i18n.registerPhrases('en', { 'PIN falsch': 'Wrong PIN' });
    i18n.registerPhrases('de', { 'PIN falsch': 'ignored' });
    assert.equal(i18n.phrase('PIN falsch'), 'PIN falsch');
    i18n._setLanguageForTests('en');
    assert.equal(i18n.phrase('PIN falsch'), 'Wrong PIN');
    assert.equal(i18n.phrase('PIN falsch!'), 'PIN falsch!');
    assert.equal(i18n.phrase(''), '');
    assert.equal(i18n.phrase(null), null);
    assert.equal(i18n.phrase('toString'), 'toString');
});

test('German fallback templates are filled when no dictionary entry exists', () => {
    assert.equal(i18n.t('sync.readyAs', { id: 'JF{x}' }, 'Bereit ({id})'), 'Bereit (JF{x})');
});

test('initial status texts switch only while JavaScript has not overwritten them', () => {
    const { els, win } = fakeDom([
        { text: 'Warte auf Login', attrs: { 'data-i18n-initial': '' } },
        { text: 'Warte auf Login', attrs: { 'data-i18n-initial': '' } }
    ]);
    i18n.registerPhrases('en', { 'Warte auf Login': 'Waiting for login' });
    i18n.install(win);
    i18n.setLanguage('en');
    assert.equal(els[0].textContent, 'Waiting for login');
    els[1].textContent = 'Bereit (JF)';
    i18n.setLanguage('de');
    assert.equal(els[0].textContent, 'Warte auf Login');
    i18n.setLanguage('en');
    assert.equal(els[1].textContent, 'Bereit (JF)', 'text written by code is never replaced');
});

test('a start in English notifies listeners once; a start in German does not', () => {
    const de = fakeDom([]);
    const heard = [];
    i18n.onChange(lang => heard.push(lang));
    i18n.install(de.win);
    assert.deepEqual(heard, []);
    i18n._resetForTests();
    const en = fakeDom([]);
    en.store[i18n.STORAGE_KEY] = 'en';
    i18n.onChange(lang => heard.push(lang));
    i18n.install(en.win);
    assert.deepEqual(heard, ['en']);
});

test('number and date locale follows the UI language', () => {
    assert.equal(i18n.locale(), 'de-DE');
    assert.equal(i18n.formatNumber(5000), '5.000');
    i18n._setLanguageForTests('en');
    assert.equal(i18n.locale(), 'en-GB');
    assert.equal(i18n.formatNumber(5000), '5,000');
});

test('language-specific images swap src and restore the German original', () => {
    const { els, win } = fakeDom([{ attrs: { 'data-i18n-src': 'roll.image', src: 'de.webp' } }]);
    i18n.register('en', { 'roll.image': 'en.webp' });
    i18n.install(win);
    assert.equal(els[0].getAttribute('src'), 'de.webp', 'German start leaves the image alone');
    i18n.setLanguage('en');
    assert.equal(els[0].getAttribute('src'), 'en.webp');
    i18n.setLanguage('de');
    assert.equal(els[0].getAttribute('src'), 'de.webp');
});
