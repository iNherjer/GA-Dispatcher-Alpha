const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require(process.env.GA_TEST_TYPESCRIPT_PATH || '../ga-tracker-client/efb-app/PackageSources/VfrMultitool/node_modules/typescript');
const source = fs.readFileSync(require.resolve('../ga-tracker-client/efb-app/PackageSources/VfrMultitool/src/VfrMultitool.tsx'), 'utf8');
const built = ts.transpileModule(source + '\nexport { VfrMultitoolView };', {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017, jsx: ts.JsxEmit.React }
});

// Shape derived from official weather.d.ts; not captured live simulator responses.
const preset = (index, sPresetName) => ({ __Type: 'WeatherPresetData', index, sPresetName });
function harness(options = {}) {
  let callback, ready, now = 100000, id = 0;
  const intervals = new Map(), calls = [], messages = [];
  const listener = {
    connected: options.connected !== false,
    on(name, fn) {
      assert.equal(name, 'UpdatePreset');
      if (options.subscribeFails) throw new Error('subscribe failed');
      callback = fn;
    },
    trigger(name) {
      calls.push(name);
      if (options.triggerFails) throw new Error('service failed');
    },
    unregister() { calls.push('unregister'); }
  };
  const api = { AppView: class { destroy() {} }, App: class {}, AppBootMode: {}, AppSuspendMode: {}, Efb: { use() {} } };
  const sdk = { FSComponent: { createRef: () => ({ getOrDefault: () => null }) } };
  const context = {
    exports: {}, require: name => name === '@efb/efb-api' ? api : name === '@microsoft/msfs-sdk' ? sdk
      : name.includes('map-shell-core') ? { default: require('../ga-tracker-client/efb-app/map-shell-core.js') } : {},
    window: {}, console, Date: class extends Date { static now() { return now; } },
    EFB_APP_VERSION: 'test', TRACKER_API_URL: 'http://127.0.0.1:49880',
    setInterval(fn, ms) { assert.equal(ms, 5000); intervals.set(++id, fn); return id; },
    clearInterval: key => intervals.delete(key)
  };
  if (options.withApi !== false) context.RegisterViewListener = (name, fn) => {
    assert.equal(name, 'JS_LISTENER_WEATHER');
    if (options.registerFails) throw new Error('register failed');
    ready = fn;
    return listener;
  };
  vm.runInNewContext(built.outputText, context);
  const view = new context.exports.VfrMultitoolView();
  view.serverFrameChannel = 'channel';
  view.serverFrameRef = { getOrDefault: () => ({ contentWindow: { postMessage: (msg, target) => messages.push({ msg, target }) } }) };
  view.reportServerFrameEvent = () => {};
  view.deactivate = () => {};
  return {
    view, calls, messages, intervals, listener,
    reply: value => callback(value), connect: () => { listener.connected = true; ready(); },
    lateReady: () => ready(), advance: ms => { now += ms; intervals.forEach(fn => fn()); }
  };
}

test('UpdatePreset maps sPresetName for Live to A to B to Live without weather writes', () => {
  const h = harness(); h.view.startWeatherPresetProbe();
  for (const [index, name] of [[0, 'TT:MENU.WEATHER_LIVE'], [2, 'Preset A'], [7, 'Preset B'], [0, 'TT:MENU.WEATHER_LIVE']]) {
    h.reply(preset(index, name));
    assert.equal(h.messages.at(-1).msg.preset.index, index);
    assert.equal(h.messages.at(-1).msg.preset.name, name);
    assert.equal(h.messages.at(-1).msg.channel, 'channel');
    assert.equal(h.messages.at(-1).target, 'http://127.0.0.1:49880');
  }
  assert.ok(h.calls.every(name => name === 'ASK_UPDATE_PRESET'));
});
test('unconnected listeners do not queue requests; readiness requests once', () => {
  const h = harness({ connected: false }); h.view.startWeatherPresetProbe();
  h.advance(15000); h.advance(15000);
  assert.equal(h.calls.length, 0); assert.equal(h.messages.at(-1).msg.preset, null);
  h.connect(); assert.deepEqual(h.calls, ['ASK_UPDATE_PRESET']);
  h.reply(preset(4, 'Ready')); assert.equal(h.messages.at(-1).msg.preset.index, 4);
});
test('no fresh response expires to unknown at the next five-second publication', () => {
  const h = harness(); h.view.startWeatherPresetProbe(); h.reply(preset(3, 'Clouds'));
  h.advance(10000); assert.equal(h.messages.at(-1).msg.preset.index, 3);
  h.advance(5000); assert.equal(h.messages.at(-1).msg.preset, null);
});
test('invalid or wrong-event payload clears a previous observation immediately', () => {
  const h = harness(); h.view.startWeatherPresetProbe();
  for (const invalid of [null, {}, { index: -1, sPresetName: 'Bad' }, { index: 1.5, sPresetName: 'Bad' },
    { index: 2, name: 'UIWeatherData is a different event' }, { index: 2, sPresetName: {} }]) {
    h.reply(preset(2, 'Before')); h.reply(invalid);
    assert.equal(h.messages.at(-1).msg.preset, null);
  }
});
test('lost connection and query failure both publish unknown', () => {
  const h = harness(); h.view.startWeatherPresetProbe(); h.reply(preset(2, 'Before'));
  h.listener.connected = false; h.advance(5000); assert.equal(h.messages.at(-1).msg.preset, null);
  const failed = harness({ triggerFails: true }); failed.view.startWeatherPresetProbe();
  failed.reply(preset(2, 'Before')); failed.advance(5000);
  assert.equal(failed.messages.at(-1).msg.preset, null);
});
test('registration or subscription failure is optional and releases a partial listener', () => {
  for (const options of [{ registerFails: true }, { subscribeFails: true }]) {
    const h = harness(options); assert.doesNotThrow(() => h.view.startWeatherPresetProbe());
    assert.equal(h.intervals.size, 0); assert.equal(h.messages.at(-1).msg.preset, null);
    if (options.subscribeFails) assert.deepEqual(h.calls, ['unregister']);
  }
});
test('repeated activation retains one timer and destroy stops it', () => {
  const h = harness(); h.view.startWeatherPresetProbe(); h.view.startWeatherPresetProbe();
  assert.equal(h.intervals.size, 1); assert.deepEqual(h.calls, ['ASK_UPDATE_PRESET']);
  h.view.destroy(); assert.equal(h.intervals.size, 0); assert.equal(h.calls.at(-1), 'unregister');
});
test('destroy blocks late readiness, replies, and reactivation', () => {
  const h = harness({ connected: false }); h.view.startWeatherPresetProbe(); h.view.destroy();
  const count = h.messages.length;
  h.lateReady(); h.reply(preset(3, 'Late')); h.view.startWeatherPresetProbe();
  assert.equal(h.messages.length, count); assert.deepEqual(h.calls, ['unregister']);
  assert.equal(h.intervals.size, 0);
});
test('two EFB instances retain independent channels and cleanup', () => {
  const a = harness(), b = harness(); b.view.serverFrameChannel = 'channel-b';
  a.view.startWeatherPresetProbe(); b.view.startWeatherPresetProbe();
  a.reply(preset(3, 'A')); b.reply(preset(7, 'B')); a.view.destroy(); b.advance(5000);
  assert.equal(a.intervals.size, 0); assert.equal(b.intervals.size, 1);
  assert.equal(b.messages.at(-1).msg.channel, 'channel-b');
  assert.equal(b.messages.at(-1).msg.preset.index, 7);
});
