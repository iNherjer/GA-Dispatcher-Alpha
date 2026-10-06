const test = require('node:test');
const assert = require('node:assert/strict');
const { createDisplaySettingsControl } = require('./tracker-efb-display-settings');
const vr = require('./toolbar-panel/PackageSources/html_ui/InGamePanels/VfrMultitool/VrMode');

test('display settings preserve other config fields, merge modes and survive controller restart', () => {
  let config = { syncId: 'test-pilot', protectedPin: 'private', arbitrary: { unchanged: true } };
  const options = { readConfig: () => structuredClone(config), writeConfig: next => { config = next; return true; } };
  let control = createDisplaySettingsControl(options);
  assert.equal(control.snapshot().configured, false);
  assert.equal(control.update({ initialize: { fontScale2d: 1.3, fontScaleVr: 1.3 } }).ok, true);
  control.update({ mode: 'vr', fontScale: 3 });
  control.update({ mode: '2d', fontScale: 0.9 });
  control = createDisplaySettingsControl(options);
  assert.deepEqual(control.snapshot(), { fontScale2d: 0.9, fontScaleVr: 3, uiScaleVersion: 1, configured: true });
  control.update({ initialize: { fontScale2d: 1, fontScaleVr: 1 } });
  assert.equal(control.snapshot().fontScaleVr, 3);
  assert.equal(config.protectedPin, 'private');
  assert.deepEqual(config.arbitrary, { unchanged: true });
  assert.equal(Object.hasOwn(control.snapshot(), 'protectedPin'), false);
  for (const fontScale of [0.8, 3.1, NaN, Infinity, '1.5', null]) assert.equal(control.update({ mode: 'vr', fontScale }).ok, false);
  assert.equal(control.update({ mode: 'unknown', fontScale: 1 }).ok, false);
});

test('write failures do not pretend settings were persisted', () => {
  const control = createDisplaySettingsControl({ readConfig: () => ({}), writeConfig: () => false });
  assert.equal(control.update({ mode: 'vr', fontScale: 3 }).error, 'display_settings_write_failed');
  assert.equal(control.snapshot().configured, false);
});

test('native VR reader detects initial VR, events and missed changes; stop removes work', () => {
  let mode = 1, tick, event, stopped = false, cleared = false;
  const changes = [];
  const runtime = { SimVar: { GetSimVarValue(name, unit) { assert.equal(name, 'E:IS IN VR'); assert.equal(unit, 'boolean'); return mode; } },
    Coherent: { on(name, callback) { assert.equal(name, 'SwitchVRModeState'); event = callback; return { clear() { cleared = true; } }; } },
    setInterval(callback) { tick = callback; return 7; }, clearInterval(id) { assert.equal(id, 7); stopped = true; } };
  const watcher = vr.watch(runtime, value => changes.push(value));
  assert.deepEqual(changes, [true]);
  mode = 0; event(false); tick();
  assert.deepEqual(changes, [true, false]);
  mode = 1; tick();
  assert.deepEqual(changes, [true, false, true]);
  event('false'); assert.equal(changes.length, 3);
  watcher.stop(); mode = 0; event(false); tick();
  assert.equal(changes.length, 3); assert.equal(stopped && cleared, true);
  assert.equal(vr.read({}), null);
  assert.equal(vr.read({ globalVars: { vrMode: true } }), true);
});
