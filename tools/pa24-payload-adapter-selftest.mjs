#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const cargoSource = fs.readFileSync(new URL('../mission-cargo-core.js', import.meta.url), 'utf8');
const trackerSource = fs.readFileSync(new URL('../ga-tracker-client/tracker.js', import.meta.url), 'utf8');
const syncSource = fs.readFileSync(new URL('../sync.js', import.meta.url), 'utf8');

const functionSource = (name) => {
    const functionStart = cargoSource.indexOf(`function ${name}(`);
    assert.ok(functionStart >= 0, `missing function ${name}`);
    const open = cargoSource.indexOf(') {', functionStart) + 2;
    assert.ok(open > functionStart, `missing function body ${name}`);
    let depth = 0;
    for (let index = open; index < cargoSource.length; index += 1) {
        if (cargoSource[index] === '{') depth += 1;
        if (cargoSource[index] === '}') depth -= 1;
        if (depth === 0) return cargoSource.slice(functionStart, index + 1);
    }
    throw new Error(`unterminated function ${name}`);
};

const context = {
    window: { lastLiveFlightData: {} },
    _missionCargoIsPassengerItem: item => item?.itemType === 'passenger',
    _missionCargoBoardedPaxCount: () => 0,
    _missionCargoPaxWeightLbs: () => 180,
    JSON,
    Map,
    Set,
    Number,
    String,
    Array,
    Math
};

vm.runInNewContext([
    "const MISSION_CARGO_PA24_ADAPTER = 'pa24_accusim';",
    'const MISSION_CARGO_PA24_BAGGAGE_MAX_LBS = 200;',
    'const MISSION_CARGO_PA24_SEAT_MAX_LBS = 300;',
    functionSource('_missionCargoNormalizePayloadSnapshot'),
    functionSource('_missionCargoBuildPayloadLayout'),
    functionSource('_missionCargoItemIsBulky'),
    functionSource('_missionCargoPa24StateFromSnapshot'),
    functionSource('_missionCargoBuildPa24PlanFromManifest')
].join('\n'), context);

const baseline = {
    payloadAdapter: 'pa24_accusim',
    aircraft: { title: 'A2A Piper PA-24-250 Comanche' },
    totalWeightLbs: 2400,
    emptyWeightLbs: 1735,
    fuelWeightLbs: 495,
    payloadWeightLbs: 170,
    payloadStationCount: 20,
    sampledStationCount: 20,
    stations: Array.from({ length: 20 }, (_, index) => ({
        index: index + 1,
        weightLbs: index === 0 ? 170 : (index === 4 ? 10 : 0)
    })),
    pa24: {
        seats: { 1: 1, 2: 0, 3: 0, 4: 0 },
        characterWeights: { 1: 170, 2: 170, 3: 162, 4: 170 },
        baggageWeightLbs: 10,
        payloadWeightLbs: 180,
        totalWeightLbs: 2410,
        emptyWeightLbs: 1735,
        grossWeightLbs: 3000
    }
};

const manifest = {
    items: [
        { id: 'passenger', itemType: 'passenger', status: 'loaded', passengerCount: 1, weightLbs: 180 },
        { id: 'docs', itemType: 'cargo', status: 'loaded', weightLbs: 20, label: 'Unterlagen' },
        { id: 'camera', itemType: 'cargo', status: 'loaded', weightLbs: 15, label: 'Kameratasche' },
        { id: 'crate', itemType: 'cargo', status: 'loaded', weightLbs: 65, label: 'Grosse Kiste' }
    ]
};
const plan = context._missionCargoBuildPa24PlanFromManifest(manifest, baseline);
assert.equal(plan.error, undefined);
assert.equal(plan.payloadAdapter, 'pa24_accusim');
assert.equal(plan.pa24State.seats[2], 2, 'passenger must occupy seat 2');
assert.equal(plan.pa24State.characterWeights[2], 180);
assert.equal(plan.pa24State.seats[4], 4, 'large cargo must use seat 4 first');
assert.equal(plan.pa24State.characterWeights[4], 65);
assert.equal(plan.pa24State.baggageWeightLbs, 45, 'small cargo must be summed into baggage');
assert.equal(plan.stations.find(row => row.index === 2)?.weightLbs, 180);
assert.equal(plan.stations.find(row => row.index === 4)?.weightLbs, 65);
assert.equal(plan.stations.find(row => row.index === 5)?.weightLbs, 45);
assert.equal(plan.missionWeightLbs, 280);

const overflowPlan = context._missionCargoBuildPa24PlanFromManifest({
    items: [{ id: 'overflow', itemType: 'cargo', status: 'loaded', weightLbs: 15, label: 'Kleinteil' }]
}, {
    ...baseline,
    stations: baseline.stations.map(row => ({ ...row, weightLbs: row.index === 5 ? 190 : row.weightLbs })),
    pa24: { ...baseline.pa24, baggageWeightLbs: 190 }
});
assert.equal(overflowPlan.pa24State.baggageWeightLbs, 190, 'overflow item must remain whole');
assert.equal(overflowPlan.pa24State.seats[4], 4, 'overflow item must use seat 4');
assert.equal(overflowPlan.pa24State.characterWeights[4], 15);

const fullSeatPlan = context._missionCargoBuildPa24PlanFromManifest({
    items: [{ id: 'crate', itemType: 'cargo', status: 'loaded', weightLbs: 65, label: 'Kiste' }]
}, {
    ...baseline,
    pa24: {
        ...baseline.pa24,
        seats: { 1: 1, 2: 2, 3: 3, 4: 4 }
    }
});
assert.equal(fullSeatPlan.error, 'pa24_no_free_seat');

const inheritedPlan = context._missionCargoBuildPa24PlanFromManifest({
    items: [{
        id: 'first-aid',
        itemType: 'cargo',
        status: 'loaded',
        weightLbs: 5,
        persistentEquipment: true,
        persistentEquipmentInherited: true
    }]
}, baseline);
assert.equal(inheritedPlan.pa24State.baggageWeightLbs, 10, 'inherited equipment must not be counted twice');

context._missionCargoBoardedPaxCount = () => 2;
const persistentResetPlan = context._missionCargoBuildPa24PlanFromManifest({
    items: [{
        id: 'medical-kit',
        itemType: 'cargo',
        status: 'loaded',
        weightLbs: 12,
        label: 'Medizinset',
        persistentEquipment: true
    }]
}, baseline, { persistentOnly: true });
assert.equal(persistentResetPlan.boardedPaxCount, 0, 'reset plan must not re-add boarded passengers');
assert.equal(persistentResetPlan.pa24State.seats[2], 0);
assert.equal(persistentResetPlan.pa24State.baggageWeightLbs, 22);
context._missionCargoBoardedPaxCount = () => 0;

const overweightPlan = context._missionCargoBuildPa24PlanFromManifest({
    items: [{ id: 'heavy', itemType: 'cargo', status: 'loaded', weightLbs: 250, label: 'Schwere Kiste' }]
}, {
    ...baseline,
    totalWeightLbs: 2850,
    pa24: { ...baseline.pa24, totalWeightLbs: 2850 }
});
assert.equal(overweightPlan.error, 'pa24_gross_weight_exceeded');

for (const required of [
    "const TRACKER_VERSION = 'v315';",
    "const TRACKER_VERSION_CODE = 315;",
    "const PA24_PAYLOAD_ADAPTER = 'pa24_accusim';",
    "units: 'number'",
    "name: 'L:BaggageWeight', units: 'pounds'",
    'pa24_adapter_aircraft_mismatch',
    'pa24_adapter_state_required'
]) {
    assert.ok(trackerSource.includes(required), `tracker contract missing: ${required}`);
}
assert.ok(syncSource.includes("const MIN_TRACKER_VERSION_CODE = 315;"));
assert.ok(syncSource.includes("const MIN_TRACKER_VERSION_LABEL = 'v315';"));

console.log('PA24 production payload adapter selftest: ok');
