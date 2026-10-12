const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const artwork = require('./efb-fonts/symbols.json');
test('drawer arrows and separators are replaced by artwork on first render', () => {
  for (const symbol of ['›', '·', '•', '⌃', '↗']) {
    const node = { nodeType: 3, nodeValue: symbol };
    let replacement;
    function element(tag) { return { nodeType: 1, tagName: tag.toUpperCase(), namespaceURI: 'http://www.w3.org/1999/xhtml', style: {}, classList: { contains() { return false; } }, childNodes: [], hasAttribute() { return false; }, appendChild(n) { this.childNodes.push(n); }, setAttribute() {} }; }
    const body = element('div'); body.childNodes = [node]; node.parentNode = body;
    body.replaceChild = fragment => { replacement = fragment; };
    const document = { body, createElement: element,
      createTextNode: text => ({ nodeType: 3, nodeValue: text }),
      createDocumentFragment: () => ({ childNodes: [], appendChild(n) { this.childNodes.push(n); } }) };
    const window = { gaEfbSymbolPattern: () => /[›·•⌃↗]/g,
      gaEfbSymbolImage(text) { assert.ok(artwork[text]); return { cloneNode: () => element('img') }; } };
    vm.runInNewContext(fs.readFileSync(require.resolve('./tracker-efb-emoji-text'), 'utf8'), { window, document, getComputedStyle: () => ({ color: '#2288ff' }) });
    assert.ok(replacement, 'unhandled ' + symbol);
    assert.equal(replacement.childNodes[1].className, 'ga-efb-symbol');
    assert.equal(replacement.childNodes[1].childNodes[1].tagName, 'IMG');
  }
});
test('floating layout schedules initial measurement without click or resize', () => {
  const handlers = {}, ready = {}; let queued = 0;
  const window = { GAEfbUiScale: { state: () => ({ surface: 'popout' }) },
    addEventListener(k, fn) { handlers[k] = fn; }, requestAnimationFrame() { queued++; } };
  const document = { addEventListener(k, fn) { ready[k] = fn; } };
  vm.runInNewContext(fs.readFileSync(require.resolve('./tracker-efb-floating-layout'), 'utf8'), { window, document });
  assert.equal(queued, 1);
  assert.equal(typeof handlers.load, 'function');
  assert.equal(typeof ready.DOMContentLoaded, 'function');
});
