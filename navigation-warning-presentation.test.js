'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), vm = require('node:vm'), fs = require('node:fs');
function fixture() {
  const listeners = {}, intervals = [];
  const banner = { children: [], style: {}, addEventListener() {}, appendChild(entry) { this.children.push(entry); entry.isConnected = true; }, querySelector(selector) { return this.children.find(e => selector.includes(e.dataset.askey)); } };
  const document = { getElementById: () => banner, createElement: () => ({ dataset: {}, style: {}, addEventListener(type, action) { listeners[type] = action; }, querySelector: () => ({ addEventListener() {} }), remove() { banner.children.splice(banner.children.indexOf(this),1); this.isConnected = false; } }) };
  const window = {};
  vm.runInNewContext(fs.readFileSync('navigation-warning-presentation.js','utf8'), { window, document, setInterval: fn => { intervals.push(fn); return 1; }, clearInterval() {} });
  return { api: window.GANavigationWarningPresentation, banner, listeners, intervals };
}
test('standalone frequency markup, colors, squawk and dismissal are shared; external labels are escaped', () => {
  const f = fixture(), space = { type: 27, name: 'TMZ Test <img>', frequencies: [{ name: 'XPDR', value: '7000' }, { name: 'INFO', value: '123.450' }] };
  assert.equal(f.api.style(space).color, '#9966ff');
  assert.equal(f.api.displayName(space), 'Test <img> [TMZ]');
  f.api.showFrequency(space, '#9966ff'); f.api.showFrequency(space, '#9966ff');
  assert.equal(f.banner.children.length, 1);
  const row = f.banner.children[0];
  assert.equal(row.className, 'awm-freq-entry'); assert.match(row.innerHTML, /Test &lt;img&gt; \[TMZ\]/);
  assert.match(row.innerHTML, /🔲.*XPDR.*7000/); assert.match(row.innerHTML, /📻.*INFO.*123.450/);
  f.listeners.click({ stopPropagation() {}, preventDefault() {}, cancelable: true });
  assert.equal(f.banner.children.length, 0); assert.equal(f.banner.style.display, 'none');
  f.api.showFrequency({ ...space, frequencies: [] }); assert.equal(f.banner.children.length, 0);
});
test('exact polygon rings pulse three times on either map and are removed afterwards', () => {
  const f = fixture(), layers = [], styles = [], removed = [];
  const L = { polygon(points, options) { const layer = { points, options, addTo() { layers.push(this); return this; }, setStyle(value) { styles.push(value); } }; return layer; } };
  const map = { hasLayer: () => true, removeLayer: layer => removed.push(layer) };
  f.api.pulseOnMap({ geometry: { type: 'Polygon', coordinates: [[[8,48],[9,48],[9,49],[8,48]]] } }, '#f2c12e', map, L);
  assert.equal(JSON.stringify(layers[0].points), '[[48,8],[48,9],[49,9],[48,8]]');
  for (let i=0;i<6;i++) f.intervals[0]();
  assert.deepEqual(styles.map(s => s.opacity), [1,0,1,0,1,0]); assert.equal(removed.length, 1);
  assert.doesNotThrow(() => f.api.pulseOnMap({}, '#fff', null, null));
});
