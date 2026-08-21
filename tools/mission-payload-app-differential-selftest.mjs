#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import payloadCore from '../mission-payload-core.js';

const cargoSource = fs.readFileSync(new URL('../mission-cargo-core.js', import.meta.url), 'utf8');

function functionSource(name) {
    const start = cargoSource.indexOf(`function ${name}(`);
    assert.ok(start >= 0, `missing ${name}`);
    const open = cargoSource.indexOf(') {', start) + 2;
    let depth = 0;
    let quote = '';
    let escaped = false;
    for (let index = open; index < cargoSource.length; index += 1) {
        const char = cargoSource[index];
        if (escaped) {
            escaped = false;
            continue;
        }
        if (char === '\\') {
            escaped = true;
            continue;
        }
        if (quote) {
            if (char === quote) quote = '';
            continue;
        }
        if (char === "'" || char === '"' || char === '`') {
            quote = char;
            continue;
        }
        if (char === '{') depth += 1;
        if (char === '}') {
            depth -= 1;
            if (depth === 0) return cargoSource.slice(start, index + 1);
        }
    }
    throw new Error(`unterminated ${name}`);
}

const executable = [
    "const MISSION_CARGO_PA24_ADAPTER = 'pa24_accusim';",
    'const MISSION_CARGO_PA24_BAGGAGE_MAX_LBS = 200;',
    'const MISSION_CARGO_PA24_SEAT_MAX_LBS = 300;',
    'const MISSION_CARGO_PAYLOAD_SYNC_DEBOUNCE_MS = 500;',
    'const MISSION_CARGO_PAYLOAD_SYNC_MAX_WAIT_MS = 2000;',
    functionSource('_missionCargoNormalizePayloadSnapshot'),
    functionSource('_missionCargoBuildPayloadLayout'),
    functionSource('_missionCargoItemIsBulky'),
    functionSource('_missionCargoAllocateWeightToStations'),
    functionSource('_missionCargoBuildMissionExtraPlan'),
    functionSource('_missionCargoDetachInheritedEquipmentFromBaseline'),
    functionSource('_missionCargoPa24StateFromSnapshot'),
    functionSource('_missionCargoBuildPa24PlanFromManifest'),
    functionSource('_missionCargoBuildPlanFromManifest'),
    functionSource('_missionCargoEstimateResetStationsFromSnapshot'),
    functionSource('_missionCargoEstimatePersistentStationsFromBaseline'),
    functionSource('_missionCargoBuildPayloadRestorePlan'),
    functionSource('_missionCargoComparePayloadStations'),
    functionSource('_missionCargoComparePa24State'),
    functionSource('_missionCargoPayloadRequestedWeights'),
    functionSource('_missionCargoPayloadSyncDelayMs')
].join('\n\n');

const baseline = {
    payloadAdapter: 'msfs_payload_stations',
    aircraft: { title: 'Standard test aircraft' },
    totalWeightLbs: 2100,
    emptyWeightLbs: 1450,
    payloadWeightLbs: 170,
    payloadStationCount: 6,
    sampledStationCount: 8,
    stations: [
        { index: 1, weightLbs: 170 },
        { index: 2, weightLbs: 0 },
        { index: 3, weightLbs: 5 },
        { index: 4, weightLbs: 0 },
        { index: 5, weightLbs: 12 },
        { index: 6, weightLbs: 0 }
    ]
};

const pa24Baseline = {
    ...baseline,
    payloadAdapter: 'pa24_accusim',
    aircraft: { title: 'A2A Piper PA-24-250 Comanche' },
    totalWeightLbs: 2400,
    emptyWeightLbs: 1735,
    payloadWeightLbs: 180,
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

const manifests = [
    {
        name: 'standard pax/cargo/bulky',
        baseline,
        manifest: { items: [
            { id: 'pax', itemType: 'passenger', status: 'loaded', passengerCount: 2, weightLbs: 330 },
            { id: 'docs', itemType: 'cargo', status: 'loaded', weightLbs: 8, label: 'Unterlagen' },
            { id: 'crate', itemType: 'cargo', status: 'loaded', weightLbs: 60, label: 'Grosse Kiste' },
            { id: 'ignored', itemType: 'cargo', status: 'pending', weightLbs: 99 }
        ] }
    },
    {
        name: 'fallback pax',
        baseline,
        manifest: { items: [
            { id: 'pax', itemType: 'passenger', status: 'loaded', passengerCount: 2, weightLbs: 0 },
            { id: 'bag', itemType: 'cargo', status: 'loaded', weightLbs: 12 }
        ] }
    },
    {
        name: 'standard persistent reset',
        baseline,
        manifest: { items: [
            { id: 'kit', itemType: 'cargo', status: 'loaded', weightLbs: 20, persistentEquipment: true },
            { id: 'box', itemType: 'cargo', status: 'loaded', weightLbs: 42 }
        ] }
    },
    {
        name: 'PA24 allocation',
        baseline: pa24Baseline,
        manifest: { items: [
            { id: 'pax', itemType: 'passenger', status: 'loaded', passengerCount: 1, weightLbs: 165 },
            { id: 'docs', itemType: 'cargo', status: 'loaded', weightLbs: 20, label: 'Unterlagen' },
            { id: 'crate', itemType: 'cargo', status: 'loaded', weightLbs: 65, label: 'Kiste' }
        ] }
    },
    {
        name: 'PA24 gross weight error',
        baseline: { ...pa24Baseline, totalWeightLbs: 2980 },
        manifest: { items: [
            { id: 'pax', itemType: 'passenger', status: 'loaded', passengerCount: 1, weightLbs: 165 }
        ] }
    }
];

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

function run(coreEnabled, scenario) {
    const context = {
        window: {
            lastLiveFlightData: { fuelWeightLbs: 321 },
            missionCargoStatus: { payloadBaseline: clone(scenario.baseline), payloadLayout: null, payloadPlan: null },
            aircraftPayloadStatus: { snapshot: clone(scenario.baseline) }
        },
        _missionCargoPayloadCore: () => coreEnabled ? payloadCore : null,
        _missionCargoPayloadCoreOptions: options => ({
            ...(options || {}),
            fuelWeightLbs: 321,
            fallbackPaxCount: 2,
            fallbackPaxWeightLbs: 165,
            isPassengerItem: item => item?.itemType === 'passenger'
        }),
        _missionCargoIsPassengerItem: item => item?.itemType === 'passenger',
        _missionCargoBoardedPaxCount: () => 2,
        _missionCargoPaxWeightLbs: () => 165,
        Map,
        Set,
        Number,
        String,
        Array,
        Math,
        JSON,
        Object
    };
    vm.runInNewContext(executable, context, { filename: 'mission-cargo-payload-differential.js' });
    const plan = context._missionCargoBuildPlanFromManifest(clone(scenario.manifest), clone(scenario.baseline));
    const currentSnapshot = clone(scenario.baseline);
    if (Array.isArray(currentSnapshot.stations) && Array.isArray(plan?.stations)) {
        currentSnapshot.stations = currentSnapshot.stations.map(row => ({
            ...row,
            weightLbs: plan.stations.find(target => Number(target.index) === Number(row.index))?.weightLbs ?? row.weightLbs
        }));
    }
    if (currentSnapshot.pa24 && plan?.pa24State) {
        currentSnapshot.pa24 = {
            ...currentSnapshot.pa24,
            seats: { ...currentSnapshot.pa24.seats, ...plan.pa24State.seats },
            characterWeights: { ...currentSnapshot.pa24.characterWeights, ...plan.pa24State.characterWeights },
            baggageWeightLbs: plan.pa24State.baggageWeightLbs
        };
    }
    const exactSnapshot = plan?.snapshot || scenario.baseline;
    const mismatchSnapshot = clone(exactSnapshot);
    if (Array.isArray(mismatchSnapshot.stations) && mismatchSnapshot.stations[1]) {
        mismatchSnapshot.stations[1].weightLbs = Number(mismatchSnapshot.stations[1].weightLbs || 0) + 4;
    }
    const inheritedEquipment = {
        id: 'inherited-kit',
        itemType: 'cargo',
        label: 'Inherited Kit',
        status: 'loaded',
        weightLbs: 20,
        persistentEquipment: true,
        persistentEquipmentInherited: true
    };
    const detached = context._missionCargoDetachInheritedEquipmentFromBaseline(inheritedEquipment);
    return clone({
        plan,
        restore: context._missionCargoBuildPayloadRestorePlan(
            clone(scenario.manifest),
            clone(scenario.baseline),
            currentSnapshot
        ),
        requested: context._missionCargoPayloadRequestedWeights(clone(scenario.manifest)),
        exactStations: context._missionCargoComparePayloadStations(exactSnapshot, plan?.stations || [], 1),
        mismatchStations: context._missionCargoComparePayloadStations(mismatchSnapshot, plan?.stations || [], 1),
        pa24: plan?.pa24State
            ? context._missionCargoComparePa24State(exactSnapshot, plan.pa24State, 1)
            : null,
        detached: {
            changed: detached,
            inherited: inheritedEquipment.persistentEquipmentInherited,
            baseline: context.window.missionCargoStatus.payloadBaseline
        },
        queueDelays: [
            context._missionCargoPayloadSyncDelayMs(1000, 1000, 1000, false),
            context._missionCargoPayloadSyncDelayMs(2900, 1000, 2900, false),
            context._missionCargoPayloadSyncDelayMs(1200, 1000, 1200, true)
        ]
    });
}

for (const scenario of manifests) {
    assert.deepEqual(run(true, scenario), run(false, scenario), `shared payload core drifted: ${scenario.name}`);
}

console.log(`mission payload/app differential selftest: ok (${manifests.length} scenarios)`);
