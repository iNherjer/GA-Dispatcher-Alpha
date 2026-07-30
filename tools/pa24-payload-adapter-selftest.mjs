#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const cargoSource = fs.readFileSync(new URL('../mission-cargo-core.js', import.meta.url), 'utf8');
const trackerSource = fs.readFileSync(new URL('../ga-tracker-client/tracker.js', import.meta.url), 'utf8');
const syncSource = fs.readFileSync(new URL('../sync.js', import.meta.url), 'utf8');
const stylesSource = fs.readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

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

const trackerFunctionSource = (name) => {
    const functionStart = trackerSource.indexOf(`function ${name}(`);
    assert.ok(functionStart >= 0, `missing tracker function ${name}`);
    const open = trackerSource.indexOf(') {', functionStart) + 2;
    assert.ok(open > functionStart, `missing tracker function body ${name}`);
    let depth = 0;
    for (let index = open; index < trackerSource.length; index += 1) {
        if (trackerSource[index] === '{') depth += 1;
        if (trackerSource[index] === '}') depth -= 1;
        if (depth === 0) return trackerSource.slice(functionStart, index + 1);
    }
    throw new Error(`unterminated tracker function ${name}`);
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
    functionSource('_missionCargoBuildPa24PlanFromManifest'),
    functionSource('_missionCargoPayloadRequestedWeights'),
    functionSource('_missionCargoPa24PayloadTableRows'),
    functionSource('_missionCargoMergeFuelIntoPayloadBaseline'),
    functionSource('_missionCargoMergeFuelIntoCurrentSnapshot')
].join('\n'), context);

const trackerFuelContext = {};
vm.runInNewContext([
    'const PA24_DEFAULT_FUEL_WEIGHT_PER_GALLON_LBS = 6;',
    `const PA24_FUEL_TANK_LVARS = ${JSON.stringify([
        { key: 'FuelLeftWingTank', name: 'L:FuelLeftWingTank' },
        { key: 'FuelRightWingTank', name: 'L:FuelRightWingTank' },
        { key: 'FuelLeftTipTank', name: 'L:FuelLeftTipTank' },
        { key: 'FuelRightTipTank', name: 'L:FuelRightTipTank' }
    ])};`,
    trackerFunctionSource('resolveFuelWeightData')
].join('\n'), trackerFuelContext);

const accusimFuel = trackerFuelContext.resolveFuelWeightData(0, 0, {
    FuelLeftWingTank: 30,
    FuelRightWingTank: 30,
    FuelLeftTipTank: 15,
    FuelRightTipTank: 15
}, true);
assert.equal(accusimFuel.fuelTotalGallons, 90);
assert.equal(accusimFuel.fuelWeightPerGallonLbs, 6);
assert.equal(accusimFuel.fuelWeightLbs, 540);
assert.equal(accusimFuel.fuelSource, 'pa24_accusim');
assert.equal(trackerFuelContext.resolveFuelWeightData(123.4, 0, {}, false).fuelWeightLbs, 123.4);

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

context.window.missionCargoStatus = {
    payloadBaseline: JSON.parse(JSON.stringify(baseline)),
    payloadLayout: null
};
context.window.aircraftPayloadStatus = {
    snapshot: JSON.parse(JSON.stringify(baseline))
};
const fuelBaseline = context._missionCargoMergeFuelIntoPayloadBaseline({ fuelWeightLbs: 520 });
assert.equal(fuelBaseline.fuelWeightLbs, 520);
assert.equal(fuelBaseline.totalWeightLbs, 2425, 'fuel delta must update frozen baseline total');
assert.equal(fuelBaseline.pa24.totalWeightLbs, 2435, 'fuel delta must update PA24 baseline total');
assert.equal(fuelBaseline.stations[4].weightLbs, 10, 'fuel update must not rebaseline mission payload');
assert.equal(
    context._missionCargoMergeFuelIntoPayloadBaseline({ fuelWeightLbs: 520 }).totalWeightLbs,
    2425,
    'same live fuel must not be applied twice'
);
const fuelSnapshot = context._missionCargoMergeFuelIntoCurrentSnapshot({ fuelWeightLbs: 510 });
assert.equal(fuelSnapshot.fuelWeightLbs, 510);
assert.equal(fuelSnapshot.totalWeightLbs, 2415, 'live fuel delta must update current payload snapshot');
assert.equal(fuelSnapshot.pa24.totalWeightLbs, 2425);

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

const payloadRows = context._missionCargoPa24PayloadTableRows(baseline, plan);
assert.deepEqual(
    Array.from(payloadRows, row => row.index),
    [2, 3, 4, 5],
    'Comanche summary must expose only seats 2-4 and baggage'
);
assert.equal(payloadRows[0].currentCharacter, 0);
assert.equal(payloadRows[0].targetCharacter, 2);
assert.equal(payloadRows[0].targetWeightLbs, 180);
assert.equal(payloadRows[2].targetWeightLbs, 65);
assert.equal(payloadRows[3].currentWeightLbs, 10);
assert.equal(payloadRows[3].targetWeightLbs, 45);

const occupiedRows = context._missionCargoPa24PayloadTableRows({
    ...baseline,
    pa24: {
        ...baseline.pa24,
        seats: { 1: 1, 2: 2, 3: 3, 4: 4 },
        characterWeights: { 1: 170, 2: 180, 3: 180, 4: 180 },
        baggageWeightLbs: 94
    }
}, { payloadAdapter: 'pa24_accusim', error: 'pa24_no_free_seat' });
assert.equal(occupiedRows.length, 4);
assert.deepEqual(Array.from(occupiedRows.slice(0, 3), row => row.currentCharacter), [2, 3, 4]);
assert.equal(occupiedRows[3].currentWeightLbs, 94);
assert.ok(occupiedRows.every(row => row.targetWeightLbs === null));

const requestedWeights = context._missionCargoPayloadRequestedWeights({
    items: [
        { itemType: 'passenger', status: 'loaded', passengerCount: 2, weightLbs: 360 },
        { itemType: 'cargo', status: 'loaded', weightLbs: 10 }
    ]
});
assert.equal(requestedWeights.paxWeightLbs, 360);
assert.equal(requestedWeights.cargoWeightLbs, 10);
assert.equal(requestedWeights.missionWeightLbs, 370);

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
    "const TRACKER_VERSION = 'v319';",
    "const TRACKER_VERSION_CODE = 319;",
    "const PA24_PAYLOAD_ADAPTER = 'pa24_accusim';",
    'const PA24_PAYLOAD_SEAT_SETTLE_MS = 220;',
    'applyPa24PayloadState(pa24State, before?.pa24)',
    "name: 'L:FuelLeftWingTank'",
    "name: 'L:FuelRightWingTank'",
    "name: 'L:FuelLeftTipTank'",
    "name: 'L:FuelRightTipTank'",
    "'FUEL WEIGHT PER GALLON'",
    "fuelSource: 'pa24_accusim'",
    "units: 'number'",
    "name: 'L:BaggageWeight', units: 'pounds'",
    'pa24_adapter_aircraft_mismatch',
    'pa24_adapter_state_required'
]) {
    assert.ok(trackerSource.includes(required), `tracker contract missing: ${required}`);
}
assert.ok(trackerSource.includes('previousState.seats[seat] !== state.seats[seat]'));
assert.ok(syncSource.includes("const MIN_TRACKER_VERSION_CODE = 319;"));
assert.ok(syncSource.includes("const MIN_TRACKER_VERSION_LABEL = 'v319';"));
assert.ok(syncSource.includes('window.missionCargoHandleLiveFuelUpdate?.(data.flight);'));
assert.ok(cargoSource.includes('class="mission-cargo-payload-table"'));
assert.ok(stylesSource.includes('.mission-cargo-payload-table'));

console.log('PA24 production payload adapter selftest: ok');
