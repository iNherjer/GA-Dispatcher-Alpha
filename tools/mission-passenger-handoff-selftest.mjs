#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const cargoSource = fs.readFileSync(new URL('../mission-cargo-core.js', import.meta.url), 'utf8');
const runtimeSource = fs.readFileSync(new URL('../mission-runtime-core.js', import.meta.url), 'utf8');
const trackerSource = fs.readFileSync(new URL('../ga-tracker-client/tracker.js', import.meta.url), 'utf8');

function functionSource(name) {
    const start = cargoSource.indexOf(`function ${name}(`);
    assert.ok(start >= 0, `missing function ${name}`);
    const open = cargoSource.indexOf(') {', start) + 2;
    assert.ok(open > start, `missing function body ${name}`);
    let depth = 0;
    for (let i = open; i < cargoSource.length; i += 1) {
        if (cargoSource[i] === '{') depth += 1;
        if (cargoSource[i] === '}') depth -= 1;
        if (depth === 0) return cargoSource.slice(start, i + 1);
    }
    throw new Error(`unterminated function ${name}`);
}

const manifest = {
    key: 'mission-handoff-1',
    taskDomain: 'private_outing',
    dispatchSignature: { scope: 'arrival', at: 1234 },
    items: [
        {
            id: 'mission-passenger',
            itemType: 'passenger',
            status: 'loaded',
            loadedAt: 1200,
            handoffComplete: false,
            handedOffAt: 0
        },
        {
            id: 'primary-cargo',
            itemType: 'cargo',
            required: true,
            status: 'unloaded',
            handoffWithPassenger: true,
            unloadLat: 48.1,
            unloadLon: 8.1,
            unloadAltFt: 1000
        },
        {
            id: 'cargo-docs',
            itemType: 'cargo',
            required: true,
            status: 'unloaded',
            handoffWithPassenger: false,
            unloadLat: 48.1,
            unloadLon: 8.1,
            unloadAltFt: 1000
        }
    ]
};
const visibilityCalls = [];
let persistCalls = 0;
let payloadCalls = 0;
const context = {
    window: {
        simModeActive: false,
        liveTrackerConnected: true,
        missionSceneStatus: { personBoarded: true },
        missionCargoStatus: {},
        gaMissionPhaseDebugRecord: () => {}
    },
    _missionCargoEnsureManifest: () => manifest,
    _missionCargoIsPassengerItem: item => item?.itemType === 'passenger',
    _missionCargoIsPassengerHandoffLocked: item => item?.handoffComplete === true || Number(item?.handedOffAt || 0) > 0,
    _missionCargoIsPassengerHandoffItem: item => item?.handoffWithPassenger === true,
    _missionCargoPersistManifest: () => { persistCalls += 1; },
    _missionCargoQueueVisibleItemState: (item, visible, options) => {
        visibilityCalls.push({ itemId: item.id, visible, options });
        return true;
    },
    _missionCargoUnloadSceneId: () => 'scene-mission-handoff-1-cargo-unload',
    _missionCargoSyncPayloadToSim: () => {
        payloadCalls += 1;
        return Promise.resolve({ status: 'ok' });
    },
    Date,
    Number,
    String,
    Array,
    Object,
    Math
};
vm.createContext(context);
vm.runInContext(functionSource('_missionCargoCompletePassengerHandoff'), context, {
    filename: 'mission-cargo-core.js'
});

const result = context._missionCargoCompletePassengerHandoff({
    reason: 'test-vehicle-boarded',
    commandId: 'deboard-1',
    handedOffAt: 2000
});

assert.equal(result.changed, true);
assert.deepEqual(Array.from(result.passengerIds), ['mission-passenger']);
assert.deepEqual(Array.from(result.cargoIds), ['primary-cargo']);
assert.equal(manifest.items[0].status, 'unloaded');
assert.equal(manifest.items[0].handoffComplete, true);
assert.equal(manifest.items[0].handedOffAt, 2000);
assert.equal(manifest.items[1].handoffComplete, true);
assert.equal(manifest.items[1].handedOffAt, 2000);
assert.equal(manifest.items[1].unloadLat, null);
assert.equal(manifest.items[2].handoffComplete, undefined);
assert.equal(manifest.dispatchSignature.at, 1234, 'passenger handoff must not invalidate the arrival signature');
assert.equal(context.window.missionSceneStatus.personBoarded, false);
assert.equal(persistCalls, 1);
assert.equal(payloadCalls, 1);
assert.equal(visibilityCalls.length, 1);
assert.deepEqual(JSON.parse(JSON.stringify(visibilityCalls[0])), {
    itemId: 'primary-cargo',
    visible: false,
    options: {
        sceneId: 'scene-mission-handoff-1-cargo-unload',
        reason: 'test-vehicle-boarded-cargo-taken',
        unloaded: true,
        immediate: true
    }
});

const secondResult = context._missionCargoCompletePassengerHandoff({
    reason: 'test-final-ack',
    commandId: 'deboard-1',
    handedOffAt: 2200
});
assert.equal(secondResult.changed, false, 'final ACK fallback must be idempotent after vehicle-boarded stage');
assert.equal(visibilityCalls.length, 1, 'idempotent fallback must not send another cargo remove');

context._missionCargoStoredEquipmentItems = () => ({});
vm.runInContext(functionSource('_missionCargoResetManifestState'), context, {
    filename: 'mission-cargo-core.js'
});
assert.equal(
    context._missionCargoResetManifestState(manifest),
    true,
    'starting the next mission must clear passenger handoff state'
);
assert.ok(manifest.items.every(item => item.handoffComplete === false));
assert.ok(manifest.items.every(item => item.handedOffAt === 0));
assert.equal(manifest.items[0].status, 'pending');
assert.equal(manifest.items[1].status, 'pending');

const loadSection = cargoSource.slice(
    cargoSource.indexOf('window.missionCargoLoadItem = function'),
    cargoSource.indexOf('window.missionCargoToggleItemLoadState = function')
);
const unloadSection = cargoSource.slice(
    cargoSource.indexOf('window.missionCargoUnloadItem = function'),
    cargoSource.indexOf('window.missionCargoSetBoardBookTime = function')
);
assert.match(loadSection, /_missionCargoIsPassengerHandoffLocked\(item\)/);
assert.ok(
    loadSection.indexOf('_missionCargoQueueVisibleItemState(item, false') < loadSection.indexOf("_missionCargoSyncPayloadToSim(wasUnloaded ? 'cargo-reload-item'"),
    'loading must request immediate scene removal before payload/final confirmation'
);
assert.ok(
    unloadSection.indexOf('_missionCargoQueueVisibleItemState(item, true') < unloadSection.indexOf("_missionCargoSyncPayloadToSim('cargo-unload-item'"),
    'unloading must request immediate scene spawn before signature/final confirmation'
);
assert.match(runtimeSource, /stage === 'passenger_vehicle_boarded'/);
assert.match(runtimeSource, /_missionRuntimeCommitPassengerHandoff/);
assert.match(trackerSource, /stage: boardedPickup \? 'passenger_vehicle_boarded' : 'passenger_handoff_complete'/);
const trackerVersionCode = Number(trackerSource.match(/const TRACKER_VERSION_CODE = (\d+);/)?.[1]);
assert.ok(Number.isFinite(trackerVersionCode) && trackerVersionCode >= 320);

console.log('mission passenger handoff selftest: ok');
