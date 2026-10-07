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

test('UI preferences survive restart, initialize only missing fields and merge concurrent views', () => {
  let writes = 0, config = { private: 'preserved' };
  const options = { readConfig: () => structuredClone(config), writeConfig(next) { writes++; config = next; return true; } };
  let control = createDisplaySettingsControl(options);
  assert.equal(control.update({initializeUi:{telemetry:false,currentInfo:false,profileVisible:false,profileMode:'ROUTE'}}).ok,true);
  const revision = control.snapshot().uiRevision;
  control.update({initializeUi:{telemetry:true,currentInfo:true,profileVisible:true,profileMode:'AUTO'}});
  assert.equal(writes,1);assert.equal(control.snapshot().uiRevision,revision);
  control.update({ui:{nextLeg:false,profileAltitudeFt:5500,profileRateFpm:600}});control.update({mode:'vr',fontScale:2});
  control=createDisplaySettingsControl(options);
  assert.deepEqual(control.snapshot().ui,{telemetry:false,currentInfo:false,nextLeg:false,profileVisible:false,profileAltitudeFt:5500,profileRateFpm:600,profileMode:'ROUTE'});
  assert.equal(control.snapshot().fontScaleVr,2);assert.equal(config.private,'preserved');
  for(const ui of [{telemetry:'false'},{token:false},{profileMode:'wrong'},{telemetry:false,private:true},{profileAltitudeFt:14000},{profileRateFpm:'600'},[]])assert.equal(control.update({ui}).ok,false);
});


test('UI initialization cannot swallow the independent legacy scale migration', () => {
  let config = {};
  const control = createDisplaySettingsControl({ readConfig: () => config, writeConfig(next) { config = next; return true; } });
  control.update({initializeUi:{telemetry:false}});
  assert.equal(control.snapshot().uiScaleVersion,0);
  control.update({initialize:{fontScale2d:1.3,fontScaleVr:1.8}});
  assert.equal(control.snapshot().fontScale2d,1.3);assert.equal(control.snapshot().fontScaleVr,1.8);
  assert.equal(control.snapshot().ui.telemetry,false);
});


test('status polling uses RAM; a successful control update refreshes the shared snapshot', () => {
  let reads = 0, config = {};
  const control = createDisplaySettingsControl({ readConfig() { reads++; return config; }, writeConfig(next) { config = next; return true; } });
  for (let i = 0; i < 100; i++) control.publicState();
  assert.equal(reads,1);
  control.update({ui:{telemetry:false}});
  const afterUpdate = reads;
  for (let i = 0; i < 100; i++) assert.equal(control.publicState().ui.telemetry,false);
  assert.equal(reads,afterUpdate);
});
