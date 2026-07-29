#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../mission-cargo-core.js', import.meta.url), 'utf8');
const start = source.indexOf("const MISSION_CARGO_ONBOARD_EQUIPMENT_STORAGE_KEY");
const end = source.indexOf('function _missionCargoPlayAudioCueNow', start);
assert.ok(start >= 0 && end > start, 'persistent-equipment implementation block missing');

const storage = new Map();
const context = {
    window: { selectedAC: 'C172' },
    localStorage: {
        getItem: key => storage.has(key) ? storage.get(key) : null,
        setItem: (key, value) => storage.set(key, String(value))
    },
    document: {
        getElementById: id => id === 'syncToggle' ? { checked: false } : null
    },
    setTimeout,
    clearTimeout,
    Date,
    JSON,
    Object,
    Number,
    String,
    Array,
    Math
};
vm.runInNewContext(source.slice(start, end), context);

const cloudState = {
    version: 1,
    updatedAt: 100,
    aircraft: {
        C172: {
            updatedAt: 100,
            items: {
                bordbuch: {
                    onboard: true,
                    loadedAt: 90,
                    expiresAt: '',
                    updatedAt: 100
                },
                unknown_item: {
                    onboard: true,
                    loadedAt: 90,
                    expiresAt: '',
                    updatedAt: 100
                }
            }
        }
    }
};
assert.equal(context.window.missionCargoApplyOnboardEquipmentFromSync(cloudState), true);

const items = [
    { id: 'bordbuch', persistentEquipment: true, status: 'pending', loadedAt: 0 },
    { id: 'first-aid', persistentEquipment: true, status: 'pending', loadedAt: 0 },
    { id: 'mission-cargo', persistentEquipment: false, status: 'pending', loadedAt: 0 }
];
context._missionCargoApplyStoredOnboardEquipment(items, 'C172');
assert.equal(items[0].status, 'loaded');
assert.equal(items[0].persistentEquipmentInherited, true);
assert.equal(items[1].status, 'pending');
assert.equal(items[2].status, 'pending');

const normalized = context.window.missionCargoGetOnboardEquipmentForSync();
assert.equal(normalized.aircraft.C172.items.bordbuch.onboard, true);
assert.equal(normalized.aircraft.C172.items.unknown_item, undefined);

items[0].status = 'unloaded';
assert.equal(context._missionCargoPersistOnboardEquipment({
    aircraftSlot: 'C172',
    items
}), true);
assert.equal(context.window.missionCargoGetOnboardEquipmentForSync().aircraft.C172.items.bordbuch.onboard, false);

const secondAircraftItems = [
    { id: 'bordbuch', persistentEquipment: true, status: 'pending', loadedAt: 0 }
];
context._missionCargoApplyStoredOnboardEquipment(secondAircraftItems, 'PA-24');
assert.equal(secondAircraftItems[0].status, 'pending');

for (const requiredText of [
    'VFR Multitool Mission Aircraft Logbook Cargo',
    'VFR Multitool Homebase Fire Extinguisher',
    'VFR Multitool Homebase First Aid Case',
    'VFR Multitool Homebase Aircraft Wheel Chocks',
    "persistentEquipment: true"
]) {
    assert.ok(source.includes(requiredText), `missing cargo descriptor ${requiredText}`);
}

const syncSource = fs.readFileSync(new URL('../sync.js', import.meta.url), 'utf8');
assert.ok(syncSource.includes('onboardEquipment: _syncOnboardEquipmentPayload()'), 'cloud payload omits onboard equipment');
assert.ok(syncSource.includes('_syncApplyOnboardEquipmentFromCloud(data);'), 'cloud pull omits onboard equipment');

const functionSource = (name) => {
    const functionStart = source.indexOf(`function ${name}(`);
    assert.ok(functionStart >= 0, `missing function ${name}`);
    const open = source.indexOf(') {', functionStart) + 2;
    assert.ok(open > functionStart, `missing function body ${name}`);
    let depth = 0;
    for (let i = open; i < source.length; i += 1) {
        if (source[i] === '{') depth += 1;
        if (source[i] === '}') depth -= 1;
        if (depth === 0) return source.slice(functionStart, i + 1);
    }
    throw new Error(`unterminated function ${name}`);
};

const payloadContext = {
    window: {},
    _missionCargoIsPassengerItem: item => item?.itemType === 'passenger',
    _missionCargoBoardedPaxCount: () => 0,
    _missionCargoPaxWeightLbs: () => 180,
    Map,
    Set,
    Number,
    Math,
    Array
};
vm.runInNewContext([
    functionSource('_missionCargoNormalizePayloadSnapshot'),
    functionSource('_missionCargoBuildPayloadLayout'),
    functionSource('_missionCargoItemIsBulky'),
    functionSource('_missionCargoAllocateWeightToStations'),
    functionSource('_missionCargoBuildMissionExtraPlan'),
    functionSource('_missionCargoEstimateResetStationsFromSnapshot'),
    functionSource('_missionCargoEstimatePersistentStationsFromBaseline')
].join('\n'), payloadContext);

const baseline = {
    payloadStationCount: 5,
    sampledStationCount: 5,
    stations: [
        { index: 1, weightLbs: 170 },
        { index: 2, weightLbs: 0 },
        { index: 3, weightLbs: 0 },
        { index: 4, weightLbs: 0 },
        { index: 5, weightLbs: 0 }
    ]
};
const manifestWithPersistent = {
    items: [
        {
            id: 'bordbuch',
            itemType: 'cargo',
            status: 'loaded',
            weightLbs: 3,
            persistentEquipment: true,
            persistentEquipmentInherited: false
        },
        {
            id: 'mission-cargo',
            itemType: 'cargo',
            status: 'loaded',
            weightLbs: 10,
            persistentEquipment: false
        }
    ]
};
const persistentTarget = payloadContext._missionCargoEstimatePersistentStationsFromBaseline(
    manifestWithPersistent,
    baseline
);
assert.equal(persistentTarget.find(row => row.index === 5)?.weightLbs, 3);

const currentSnapshot = {
    ...baseline,
    stations: baseline.stations.map(row => ({
        ...row,
        weightLbs: row.index === 5 ? 13 : row.weightLbs
    }))
};
const resetTarget = payloadContext._missionCargoEstimateResetStationsFromSnapshot(
    manifestWithPersistent,
    currentSnapshot
);
assert.equal(resetTarget.find(row => row.index === 5)?.weightLbs, 3);

manifestWithPersistent.items[0].persistentEquipmentInherited = true;
const layout = payloadContext._missionCargoBuildPayloadLayout(baseline);
const nextMissionPlan = payloadContext._missionCargoBuildMissionExtraPlan(manifestWithPersistent, layout);
assert.equal(nextMissionPlan.missionByStation.get(5), 10, 'inherited equipment was counted twice');

console.log('mission cargo persistence selftest: ok');
