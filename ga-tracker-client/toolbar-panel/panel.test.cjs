const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, 'PackageSources/html_ui/InGamePanels/VfrMultitool/Panel.js'), 'utf8');
function fixture() {
  const events = {}, timers = new Map(), requests = [];
  let clock = 1000, next = 0, observer;
  const panel = { active: false, visible: true, minimized: false, addEventListener(n, fn) { events[n] = fn; }, closePanel() { this.active = false; events.panelInactive(); } };
  const container = { children: [], appendChild(f) { this.children.push(f); }, removeChild(f) { this.children.splice(this.children.indexOf(f), 1); } };
  const elements = { VfrMultitoolPanel: panel, 'vfr-frame-container': container, 'vfr-status': {}, 'vfr-statusbar': { style: {} }, 'vfr-offline': { style: {} }, 'vfr-retry': {}, 'vfr-close': {} };
  const document = { hidden: false, getElementById: id => elements[id], createElement: () => ({ contentWindow: {} }), addEventListener(n, fn) { events[n] = fn; } };
  vm.runInNewContext(source, { document, window: { addEventListener(n, fn) { events[n] = fn; } }, console: { log() {} }, Date: { now: () => clock }, Math,
    MutationObserver: function (fn) { observer = fn; this.observe = () => {}; },
    setTimeout(fn) { const id = ++next; timers.set(id, fn); return id; }, clearTimeout(id) { timers.delete(id); },
    XMLHttpRequest: function () { this.open = (method, url) => { this.method = method; this.url = url; }; this.send = () => requests.push(this); this.abort = () => { this.aborted = true; }; }
  });
  return { panel, container, elements, events, requests, timers, document,
    open() { panel.active = true; events.panelActive(); },
    tick(ms = 4000) { clock += ms; const pending = [...timers.values()]; timers.clear(); pending.forEach(fn => fn()); },
    reply(ok = true) { const xhr = requests[requests.length - 1]; xhr.status = ok ? 200 : 503; xhr.onload(); },
    minimize(value) { panel.minimized = value; observer(); },
    message(data, origin = 'http://127.0.0.1:49880', sender = container.children[0]?.contentWindow) { events.message({ data: { channel: new URL(container.children[0].src).searchParams.get('channel'), ...data }, origin, source: sender }); }
  };
}
test('only visible panel performs GETs; close aborts and stale response cannot recreate frame', () => {
  const f = fixture(); assert.equal(f.requests.length, 0); f.open();
  assert.equal(f.requests[0].method, 'GET'); f.elements['vfr-close'].onclick();
  assert.equal(f.requests[0].aborted, true); f.reply();
  assert.equal(f.container.children.length, 0); assert.equal(f.timers.size, 0);
});
test('shared cockpit URL and strict sender/origin/channel validation', () => {
  const f = fixture(); f.open(); f.reply();
  assert.equal(new URL(f.container.children[0].src).pathname, '/efb/v1/');
  assert.equal(new URL(f.container.children[0].src).searchParams.get('host'), 'toolbar');
  f.message({ type: 'ga-efb-kartentisch', state: 'ready' }, 'http://evil.invalid');
  assert.notEqual(f.elements['vfr-offline'].style.display, 'none');
  f.message({ type: 'ga-efb-kartentisch', state: 'ready' }, undefined, {});
  assert.notEqual(f.elements['vfr-offline'].style.display, 'none');
  f.message({ type: 'ga-efb-kartentisch', state: 'ready', channel: 'old-channel' });
  assert.notEqual(f.elements['vfr-offline'].style.display, 'none');
  f.message({ type: 'ga-efb-kartentisch', state: 'ready' });
  assert.equal(f.elements['vfr-offline'].style.display, 'none');
});
test('trusted UI-close also works before ready; missing Coherent source requires channel and origin', () => {
  const f = fixture(); f.open(); f.reply();
  f.message({ type: 'ga-efb-kartentisch', state: 'close', channel: 'foreign' }, undefined, null);
  assert.equal(f.panel.active, true);
  f.message({ type: 'ga-efb-kartentisch', state: 'close' }, undefined, null);
  assert.equal(f.panel.active, false); assert.equal(f.container.children.length, 0);
});
test('ready before initial load stays valid; later navigation must become ready again', () => {
  const f = fixture(); f.open(); f.reply(); const frame = f.container.children[0];
  f.message({ type: 'ga-efb-kartentisch', state: 'ready' }); frame.onload();
  f.tick(21000); f.reply(); assert.equal(f.timers.size, 1);
  frame.onload(); f.tick(21000);
  assert.equal(f.timers.size, 0); assert.match(f.elements['vfr-status'].textContent, /antwortet nicht/);
});
test('short outage preserves frame; minimize unloads and restore uses fresh frame', () => {
  const f = fixture(); f.open(); f.reply(); const old = f.container.children[0];
  f.tick(); f.reply(false); assert.equal(f.container.children[0], old);
  f.minimize(true); assert.equal(f.container.children.length, 0); assert.equal(f.timers.size, 0);
  f.minimize(false); f.reply(); assert.notEqual(f.container.children[0], old);
  assert.notEqual(f.container.children[0].src, old.src);
});
test('offline start retries; missing probe readiness stops automatic boot attempts', () => {
  const f = fixture(); f.open(); f.reply(false); assert.equal(f.container.children.length, 0);
  f.tick(); f.reply(); assert.equal(f.container.children.length, 1);
  f.tick(21000); assert.equal(f.timers.size, 0);
  assert.match(f.elements['vfr-status'].textContent, /antwortet nicht/);
  f.elements['vfr-retry'].onclick(); f.reply(); assert.equal(f.container.children.length, 1);
});
