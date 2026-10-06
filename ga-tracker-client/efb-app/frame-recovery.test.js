const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('./PackageSources/VfrMultitool/node_modules/typescript');

function harness() {
  const timers = new Map();
  const intervals = new Map(), modeMessages = [];
  let mode = 0, vrEvent = null, panel2d = false, surfaceEvent = null;
  let timerId = 0;
  const api = { AppView: class {}, App: class {}, AppBootMode: {}, AppSuspendMode: {}, Efb: { use() {} } };
  const sdk = { FSComponent: { createRef: () => ({ getOrDefault: () => null }) } };
  const source = fs.readFileSync(`${__dirname}/PackageSources/VfrMultitool/src/VfrMultitool.tsx`, 'utf8');
  const code = ts.transpileModule(source + '\nexport { VfrMultitoolView };', {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017, jsx: ts.JsxEmit.React }
  }).outputText;
  const context = {
    exports: {}, require: (name) => name === '@efb/efb-api' ? api : name === '@microsoft/msfs-sdk' ? sdk : name.includes('map-shell-core') ? { default: require('./map-shell-core') } : name.includes('HostSurface') ? { default: require('../toolbar-panel/PackageSources/html_ui/InGamePanels/VfrMultitool/HostSurface') } : name.includes('VrMode') ? { default: require('../toolbar-panel/PackageSources/html_ui/InGamePanels/VfrMultitool/VrMode') } : {},
    EFB_APP_VERSION: '0.4.13', TRACKER_API_URL: 'http://127.0.0.1:49880',
    setTimeout: (fn) => { timers.set(++timerId, fn); return timerId; },
    clearTimeout: (id) => timers.delete(id), window: {
      PanelInfo: { is2D: { get: () => panel2d, sub(fn) { surfaceEvent = fn; return { destroy() { surfaceEvent = null; } }; } } },
      SimVar: { GetSimVarValue: () => mode },
      Coherent: { on(name, fn) { vrEvent = fn; return { clear() { vrEvent = null; } }; } },
      setInterval(fn) { intervals.set(++timerId, fn); return timerId; }, clearInterval(id) { intervals.delete(id); },
      addEventListener() {}, removeEventListener() {}
    }, console
  };
  vm.runInNewContext(code, context);
  const view = new context.exports.VfrMultitoolView();
  const writes = [], events = [];
  let src = '';
  const frame = { contentWindow: { postMessage(data, origin) { modeMessages.push({ data, origin }); } }, get src() { return src; }, set src(value) { src = value; writes.push(value); } };
  view.serverFrameRef = { getOrDefault: () => frame };
  view.reportServerFrameEvent = (...args) => events.push(args);
  view.active = true;
  view.serverClientAvailable = true;
  view.bindDomInteractions();
  return {
    view, frame, writes, events, timers, intervals, modeMessages,
    setSurface(value) { panel2d = value; if (surfaceEvent) surfaceEvent(); },
    setVr(value) { mode = value ? 1 : 0; if (vrEvent) vrEvent(value); },
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

test('EFB host forwards native VR changes and stops detection while paused', () => {
  const h = harness();
  h.view.readPreferences = () => ({}); h.view.applyPreferencesToChrome = () => {};
  h.view.setScreen = () => {}; h.view.startClock = () => {}; h.view.stopClock = () => {};
  h.view.scheduleMapInitialization = () => {}; h.view.closeToolPanel = () => {};
  h.view.startPolling = () => { h.view.active = true; };
  h.setVr(true); h.view.activate(); h.view.startServerFrame(); h.ready();
  assert.equal(new URL(h.frame.src).searchParams.get('vr'), '1');
  assert.equal(h.modeMessages.at(-1).data.vr, true);
  assert.equal(h.modeMessages.at(-1).data.channel, h.view.serverFrameChannel);
  h.setVr(false); assert.equal(h.modeMessages.at(-1).data.vr, false);
  h.view.onPause(); assert.equal(h.intervals.size, 0);
  const messages = h.modeMessages.length; h.setVr(true);
  assert.equal(h.modeMessages.length, messages);
  h.view.onResume(); h.view.startServerFrame(); h.ready();
  assert.equal(h.modeMessages.at(-1).data.vr, true);
});

test('native physical/popout updates use existing channel without reloading the iframe', () => {
  const h = harness();
  h.view.startClock = () => {}; h.view.scheduleMapInitialization = () => {};
  h.view.startPolling = () => { h.view.active = true; };
  h.view.stopPolling = () => { h.view.active = false; };
  h.view.stopClock = () => {}; h.view.closeToolPanel = () => {};
  h.view.activate(); h.view.startServerFrame(); h.ready();
  assert.equal(new URL(h.frame.src).searchParams.get('surface'), 'physical');
  const writes = h.writes.length;
  h.setSurface(true);
  assert.equal(h.modeMessages.at(-1).data.surface, 'popout');
  h.setVr(true);
  assert.equal(h.modeMessages.at(-1).data.vr, true);
  assert.equal(h.modeMessages.at(-1).data.surface, 'popout');
  assert.equal(h.writes.length, writes);
  h.setSurface(false); assert.equal(h.modeMessages.at(-1).data.surface, 'physical');
  h.view.onPause(); const messages = h.modeMessages.length;
  h.setSurface(true); assert.equal(h.modeMessages.length, messages);
});
