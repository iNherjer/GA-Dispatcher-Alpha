#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync(new URL('../mission-cargo-core.js', import.meta.url), 'utf8');
const section = (a, b) => source.slice(source.indexOf(a), source.indexOf(b, source.indexOf(a)));
let captured;
const item = { id: 'pax', itemType: 'passenger', storyName: 'Mara', label: 'Gast', sceneKind: 'person_1', objectTitle: 'Tarmac_Female' };
const sandbox = { window: { liveTrackerConnected: true, missionCargoStatus: {}, missionSceneStatus: {}, sendTrackerCommand: command => { captured = command; return 'cmd'; } },
  Date: { now: () => 100000 },
  _missionCargoGetManifest: () => ({ items: [item] }), _missionCargoIsPassengerItem: i => i.itemType === 'passenger',
  _missionScenePassengerGender: () => 'female', _missionSceneCommonSceneCommandFields: () => ({ missionId: 'm', groundOffsetFt: 2 }),
  _missionCargoPassengerBoardingPoint: () => ({ forwardM: 3, rightM: 8 }),
  _missionSceneMovingPersonCandidates: () => ['Tarmac_Female', 'Tarmac_Female_2'],
  _missionCargoSceneId: () => 'scene-m', _missionCargoUnloadSceneId: () => 'scene-m-cargo-unload',
  _missionCargoManualPassengerSceneBusy: () => false,
  _missionCargoCommandBasePos: () => ({ lat: 48, lon: 8, altFt: 600, hdg: 90 })
};
vm.createContext(sandbox);
vm.runInContext(section('function _missionCargoManualPassengerLoadOptions(', 'function _missionCargoMarkPassengerLoaded(')
  + section('function _missionCargoSendManualPassengerCommand(', 'function _missionCargoVisibleKind('), sandbox);
for (const recipe of sandbox.window.missionCargoBuildManualPassengerEffectPlan()) {
  const options = recipe.operation === 'unload' ? {} : sandbox._missionCargoManualPassengerLoadOptions(item, recipe.operation === 'reload');
  sandbox._missionCargoSendManualPassengerCommand(item, recipe.operation === 'unload' ? 'unload' : 'load', options);
  for (const key of ['lat', 'lon', 'altFt', 'hdg']) delete captured[key];
  assert.equal(JSON.stringify(recipe.command), JSON.stringify(captured), recipe.operation);
}
console.log('PASS manual PAX load/reload/unload recipes match the untouched standalone simulator command exactly.');

const manifestCore = (await import('../mission-manifest-core.js')).default;
for (const action of ['load', 'unload']) {
  const initial = { key: 'm', items: [{ ...item, status: action === 'load' ? 'unloaded' : 'loaded', loadedAt: 500 }],
    dispatchSignature: { scope: 'departure', at: 900, by: 'Pilot' } };
  const standalone = structuredClone(initial), central = structuredClone(initial);
  const legacy = { ...sandbox, window: { missionSceneStatus: {}, missionCargoStatus: {} },
    _missionCargoEnsureManifest: () => standalone,
    _missionCargoIsPassengerHandoffLocked: () => false, _missionCargoItemCanLoadAtCurrentStage: () => true,
    _missionCargoPersistManifest() {}, _missionCargoManifestCore: () => manifestCore,
    _missionCargoPlayAudioCue() {}, _missionCargoSyncPayloadToSim: () => Promise.resolve(true)
  };
  vm.createContext(legacy);
  vm.runInContext(section('function _missionCargoInvalidateDispatchSignature(', 'function _missionCargoSignatureScope(')
    + section('function _missionCargoMarkPassengerLoaded(', 'function _missionCargoCompletePassengerHandoff('), legacy);
  const ok = action === 'load' ? legacy._missionCargoMarkPassengerLoaded() : legacy._missionCargoMarkPassengerUnloaded();
  assert.equal(ok, true);
  const plan = manifestCore.planItemTransition(central, { itemId: item.id, action }, { now: 100000,
    groundHandlingAllowed: true, complianceAllowed: true, reloadAllowed: true, skipPassengerEffect: true,
    effectAcknowledged: action === 'load' ? 'passenger.board' : 'passenger.deboard', position: { lat: 48, lon: 8, altFt: 600 } });
  assert.equal(manifestCore.commitItemTransition(central, plan).ok, true);
  assert.deepEqual(central, standalone);
}
console.log('PASS manual passenger manifest transitions and signature invalidation match standalone.');
