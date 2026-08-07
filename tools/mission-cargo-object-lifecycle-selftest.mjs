#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const cargoSource = fs.readFileSync(new URL('../mission-cargo-core.js', import.meta.url), 'utf8');
const trackerSource = fs.readFileSync(new URL('../ga-tracker-client/tracker.js', import.meta.url), 'utf8');

const functionSource = (name) => {
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
};

let timerSeq = 0;
const timers = new Map();
const commands = [];
const context = {
    window: {
        selectedAC: 'PA-24',
        simModeActive: false,
        liveTrackerConnected: true,
        missionCargoStatus: {},
        sendTrackerCommand: command => {
            const commandId = `test-command-${commands.length + 1}`;
            commands.push({ ...command, commandId });
            return commandId;
        }
    },
    MISSION_CARGO_OBJECT_ACTION_DEBOUNCE_MS: 180,
    MISSION_SCENE_ASSET_POOLS: { cargo: ['Cardboard'] },
    _MISSION_CARGO_OBJECT_ACTION_QUEUE: new Map(),
    missionCargoObjectActionRevision: 0,
    _missionCargoGetManifest: () => ({ key: 'mission-42', aircraftSlot: 'PA-24' }),
    _missionCargoMissionKey: () => 'mission-42',
    _missionCargoAircraftSlot: value => String(value || 'PA-24').toUpperCase(),
    _missionCargoIsPassengerItem: item => item?.itemType === 'passenger',
    _missionCargoSceneId: () => 'scene-mission-42',
    _missionCargoUnloadSceneId: () => 'scene-mission-42-cargo-unload',
    _missionCargoCommandBasePos: () => ({ lat: 48.1, lon: 8.1, altFt: 1000, hdg: 90 }),
    _missionCargoGroundSpawnPlacement: () => ({ forwardM: 4, rightM: 3, altOffsetFt: 0 }),
    _sceneAssetCandidates: (title, candidates) => [title, ...(candidates || [])],
    setTimeout: callback => {
        const id = ++timerSeq;
        timers.set(id, { callback, cancelled: false });
        return id;
    },
    clearTimeout: id => {
        const timer = timers.get(id);
        if (timer) timer.cancelled = true;
    },
    Date,
    JSON,
    Object,
    Number,
    String,
    Array,
    Map,
    Math
};

vm.runInNewContext([
    functionSource('_missionCargoStableObjectKey'),
    functionSource('_missionCargoVisibleKind'),
    functionSource('_missionCargoVisibleSelectors'),
    functionSource('_missionCargoRemoveVisibleItem'),
    functionSource('_missionCargoSpawnVisibleItem'),
    functionSource('_missionCargoFlushVisibleItemState'),
    functionSource('_missionCargoQueueVisibleItemState')
].join('\n'), context);

const cargoItem = {
    id: 'camera-bag',
    itemType: 'cargo',
    sceneKind: 'cargo',
    label: 'Kameratasche',
    storyName: 'Kameratasche',
    objectTitle: 'VFR Multitool Mission Camera Equipment Cargo',
    titleCandidates: ['VFR Multitool Mission Camera Equipment Cargo']
};

assert.equal(context._missionCargoStableObjectKey(cargoItem), 'mission-cargo:mission-42:camera-bag');
assert.equal(
    context._missionCargoStableObjectKey({ ...cargoItem, id: 'chocks', persistentEquipment: true }),
    'aircraft-equipment:PA-24:chocks'
);

assert.equal(context._missionCargoQueueVisibleItemState(cargoItem, true, {
    sceneId: 'scene-mission-42-cargo-unload',
    unloaded: true
}), true);
assert.equal(context._missionCargoQueueVisibleItemState(cargoItem, false, {
    sceneId: 'scene-mission-42',
    unloaded: false
}), true);

for (const timer of timers.values()) {
    if (!timer.cancelled) timer.callback();
}

assert.equal(commands.length, 1, 'rapid visible/hidden changes must coalesce into one tracker command');
assert.equal(commands[0].type, 'mission_scene_object_remove');
assert.equal(commands[0].allScenes, true);
assert.deepEqual(Array.from(commands[0].objectKeys), ['mission-cargo:mission-42:camera-bag']);
assert.ok(Number(commands[0].objectRevision) >= 2);

assert.ok(trackerSource.includes('const sceneObjectOperationStates = new Map();'));
assert.ok(trackerSource.includes('SCENE_OBJECT_COMMAND_SUPERSEDED'));
assert.ok(trackerSource.includes('command?.allScenes === true'));
assert.ok(trackerSource.includes('command?.replaceExisting === true'));
assert.ok(trackerSource.includes('SCENE_LATE_ASSIGN_DISCARDED'));
const trackerVersionCode = Number(trackerSource.match(/const TRACKER_VERSION_CODE = (\d+);/)?.[1]);
assert.ok(Number.isFinite(trackerVersionCode) && trackerVersionCode >= 320);

console.log('mission cargo object lifecycle selftest: ok');
