const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('./PackageSources/VfrMultitool/node_modules/typescript');

function harness() {
  const timers = new Map();
  let timerId = 0;
  const api = { AppView: class {}, App: class {}, AppBootMode: {}, AppSuspendMode: {}, Efb: { use() {} } };
  const sdk = { FSComponent: { createRef: () => ({ getOrDefault: () => null }) } };
  const source = fs.readFileSync(`${__dirname}/PackageSources/VfrMultitool/src/VfrMultitool.tsx`, 'utf8');
  const code = ts.transpileModule(source + '\nexport { VfrMultitoolView };', {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017, jsx: ts.JsxEmit.React }
  }).outputText;
  const context = {
    exports: {}, require: (name) => name === '@efb/efb-api' ? api : name === '@microsoft/msfs-sdk' ? sdk : name.includes('map-shell-core') ? { default: require('./map-shell-core') } : {},
    EFB_APP_VERSION: '0.4.13', TRACKER_API_URL: 'http://127.0.0.1:49880',
    setTimeout: (fn) => { timers.set(++timerId, fn); return timerId; },
    clearTimeout: (id) => timers.delete(id), window: {}, console
  };
  vm.runInNewContext(code, context);
  const view = new context.exports.VfrMultitoolView();
  const writes = [], events = [];
  let src = '';
  const frame = { contentWindow: {}, get src() { return src; }, set src(value) { src = value; writes.push(value); } };
  view.serverFrameRef = { getOrDefault: () => frame };
  view.reportServerFrameEvent = (...args) => events.push(args);
  view.active = true;
  view.serverClientAvailable = true;
  view.bindDomInteractions();
  return {
    view, frame, writes, events, timers,
    expire() { const pending = [...timers.values()]; timers.clear(); pending.forEach((fn) => fn()); },
    ready(channel = view.serverFrameChannel) { view.onWindowMessage({ source: frame.contentWindow, data: { type: 'ga-efb-kartentisch', state: 'ready', channel } }); }
  };
}

test('real iframe reload with old channel recovers without a lifecycle callback', () => {
  const h = harness();
  h.view.startServerFrame(); h.ready(); h.frame.onload();
  assert.equal(h.timers.size, 0, 'ready before initial load is valid');
  const old = h.view.serverFrameChannel;
  h.frame.onload(); h.expire();
  assert.equal(h.writes.length, 2);
  assert.notEqual(h.view.serverFrameChannel, old);
  h.ready(old);
  assert.equal(h.view.serverFrameReady, false, 'stale WindowProxy message cannot acknowledge new channel');
  h.ready(); h.expire();
  assert.equal(h.writes.length, 2);
});

test('unready document has two retries, repeated load and polls cannot create an endless loop', () => {
  const h = harness(); h.view.startServerFrame();
  for (let i = 0; i < 10; i++) { h.frame.onload(); h.view.startServerFrame(); h.expire(); }
  assert.equal(h.writes.length, 3);
  assert.ok(h.events.some((e) => e[1] === 'exhausted'));
});

test('onOpen and onResume both renew the iframe and reset the bounded retry budget', () => {
  const h = harness();
  h.view.activate = () => { h.view.active = true; h.view.startServerFrame(); };
  h.view.onOpen(); const first = h.view.serverFrameChannel;
  h.view.onResume(); assert.notEqual(h.view.serverFrameChannel, first);
  h.view.onOpen(); assert.equal(h.writes.length, 3);
  assert.deepEqual(h.events.filter((e) => e[0] === 'lifecycle').map((e) => e[1]), ['open', 'resume', 'open']);
});

test('pause cancels recovery and inactive iframe load cannot restart it', () => {
  const h = harness(); h.view.startServerFrame();
  h.view.stopPolling = () => { h.view.active = false; };
  h.view.stopClock = () => {}; h.view.closeToolPanel = () => {};
  h.view.onPause(); h.frame.onload(); h.expire();
  assert.equal(h.timers.size, 0); assert.equal(h.writes.length, 1);
});
