#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import core from '../mission-manifest-core.js';
import { extractOriginalFunction } from './extract-original-function.mjs';
const source = fs.readFileSync(new URL('../mission-cargo-core.js', import.meta.url), 'utf8');
const start = source.indexOf('window.missionCargoHandleAircraftMovement = function');
const end = source.indexOf('window.missionCargoStageSimEquipmentAtAircraft', start);
assert.ok(start >= 0 && end > start);
const ids = ['bordbuch', 'first-aid', 'fire-extinguisher', 'chocks'];
function fixture({ previous = true, tracker = false } = {}) {
    const manifest = { key: 'current', aircraftSlot: 'C172', items: ids.map(id => ({ id, persistentEquipment: true,
        status: 'unloaded', unloadManifestKey: previous ? 'previous' : 'current', unloadLat: 48, unloadLon: 8 })) };
    const writes = [];
    const context = { window: { missionCargoStatus: { groundUiKey: 'ground:still' }, lastLiveGpsPos: { lat: 49, lon: 8 } },
        missionRuntime: { active: false }, missionCargoGroundInventoryManifest: null,
        _missionCargoGetManifest: () => manifest, _missionCargoManifestCore: () => core,
        _missionCargoPersistManifest: value => writes.push(structuredClone(value)),
        _missionCargoQueueVisibleItemState: () => {}, _missionCargoUnloadSceneId: () => 'scene',
        _missionExecutionAuthorityIsTracker: () => tracker,
        _missionCargoAircraftSlot: () => 'C172', _missionCargoReadOnboardEquipmentState: () => ({ aircraft: {} }),
        MISSION_CARGO_PERSISTENT_EQUIPMENT_IDS: ids, setTimeout: () => 1, Date, Number, Array, Set };
    vm.createContext(context);
    vm.runInContext(extractOriginalFunction(source, '_missionCargoLivePos') + '\n' + source.slice(start, end), context);
    return { context, manifest, writes, observe: sample => context.window.missionCargoHandleAircraftMovement(sample) };
}
for (const sample of [{ onGround: true, gsKts: 0 }, { onGround: false, gsKts: 80 }]) {
    const f = fixture();
    f.observe(sample);
    assert.ok(f.manifest.items.every(item => item.status === 'lost'));
    assert.equal(f.writes.length, 1);
    f.observe(sample);
    assert.equal(f.writes.length, 1, 'repeated telemetry does not rewrite loss');
}
const same = fixture({ previous: false });
same.observe({ onGround: true, gsKts: 0 });
assert.ok(same.manifest.items.every(item => item.status === 'unloaded'));
same.observe({ onGround: false, gsKts: 80 });
assert.ok(same.manifest.items.every(item => item.status === 'lost'));
for (const position of [{}, { lat: null, lon: 8 }, { lat: '', lon: 8 }, { lat: NaN, lon: 8 }]) {
    const f = fixture(); f.context.window.lastLiveGpsPos = position;
    f.observe({ onGround: true, gsKts: 0 });
    assert.equal(f.writes.length, 0, 'unknown current position cannot abandon inventory');
}
const near = fixture(); near.context.window.lastLiveGpsPos = { lat: 48, lon: 8 };
near.observe({ onGround: true, gsKts: 0 }); assert.equal(near.writes.length, 0);
for (const sample of [{ onGround: false, simPaused: true }, { onGround: true, inMenuOrMap: true }]) {
    const f = fixture(); f.observe(sample); assert.equal(f.writes.length, 0);
}
const owned = fixture({ tracker: true }); owned.observe({ onGround: false, gsKts: 80 });
assert.equal(owned.writes.length, 0, 'App must not compete with tracker authority');
console.log('mission equipment loss/app selftest: ok');

// Execute the actual projection, including its unchanged-snapshot fast path.
const syncSource = fs.readFileSync(new URL('../sync.js', import.meta.url), 'utf8');
const projected = { items: [] };
const inventoryWrites = [];
const projection = { window: { missionCargoStatus: {} }, currentMissionData: {}, missionRuntime: {},
    missionExecutionProjectionSignature: '', _normalizeMissionRuntimeId: value => value, _activeMissionRuntimeId: () => 'm',
    _applyTrackerPayloadControl: () => {}, _missionCargoEnsureManifest: () => projected,
    _missionCargoPersistOnboardEquipment: value => inventoryWrites.push(structuredClone(value)),
    _missionPhaseDebugPush: () => {}, _updateMissionRuntimeUi: () => {}, document: { getElementById: () => null } };
vm.createContext(projection);
vm.runInContext(extractOriginalFunction(syncSource, '_applyTrackerExecutionControl'), projection);
const control = { missionId: 'm', runId: 'r', executionAuthority: 'tracker', phase: 'prepare', flags: {},
    manifest: { key: 'current', aircraftSlot: 'C172', items: [{ id: 'chocks', persistentEquipment: true, status: 'lost' }] } };
assert.equal(projection._applyTrackerExecutionControl(control), true);
assert.equal(inventoryWrites.length, 1);
assert.equal(inventoryWrites[0].items[0].status, 'lost');
assert.equal(projection._applyTrackerExecutionControl(control), true);
assert.equal(inventoryWrites.length, 1, 'unchanged snapshot does not write inventory again');
assert.equal(projection._applyTrackerExecutionControl({ ...control, missionId: 'other' }), false);
assert.equal(inventoryWrites.length, 1, 'another mission cannot overwrite inventory');
console.log('mission equipment loss/tracker projection selftest: ok');
