#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import recorderCore from '../mission-flight-recorder-core.js';

const syncSource = fs.readFileSync(new URL('../sync.js', import.meta.url), 'utf8');
const cargoSource = fs.readFileSync(new URL('../mission-cargo-core.js', import.meta.url), 'utf8');

function functionSourceFrom(sourceText, name) {
    const marker = `function ${name}(`;
    const start = sourceText.indexOf(marker);
    assert.ok(start >= 0, `missing ${name}`);
    const open = sourceText.indexOf('{', start);
    let depth = 0;
    let quote = '';
    let escaped = false;
    for (let index = open; index < sourceText.length; index += 1) {
        const char = sourceText[index];
        if (escaped) { escaped = false; continue; }
        if (char === '\\') { escaped = true; continue; }
        if (quote) {
            if (char === quote) quote = '';
            continue;
        }
        if (char === "'" || char === '"' || char === '`') { quote = char; continue; }
        if (char === '{') depth += 1;
        if (char === '}' && --depth === 0) return sourceText.slice(start, index + 1);
    }
    throw new Error(`unterminated ${name}`);
}

const source = functionSourceFrom(syncSource, '_buildFlightRecordSnapshot');

function run(shared, recorder) {
    class FixedDate {
        static now() { return 1710000000000; }
        toLocaleString() { return '09.03., 16:00'; }
    }
    const context = {
        window: { GAMissionFlightRecorderCore: shared ? recorderCore : null },
        flightRecorder: structuredClone(recorder),
        currentStartICAO: 'EDTW',
        currentDestICAO: 'EDTL',
        currentMissionData: { cargoOutcome: { status: 'completed', failed: false } },
        compactFlightTrackForStorage: track => structuredClone(track),
        nearestAirportLabel: () => 'APT',
        Date: FixedDate,
        Math,
        Number,
        String,
        JSON,
        Object,
        Array,
        isFinite
    };
    context.window.window = context.window;
    vm.runInNewContext(source, context, { filename: 'sync.js#flight-record-differential' });
    return JSON.parse(JSON.stringify(context._buildFlightRecordSnapshot(21000)));
}

const base = {
    active: true,
    startTs: 1000,
    hadAirbornePhase: true,
    airborneEvidenceSec: 50,
    maxAglFt: 1800,
    maxAltFt: 4300,
    distNm: 38.47,
    maxGs: 128.26,
    sumGs: 1234.6,
    gsSamples: 12,
    touchdownVsFpm: -188.2,
    track: [[48.1, 8.1, 900, 0], [48.5, 7.8, 840, 1200]],
    maxBankDeg: 34.45,
    bankSamples: 10,
    maxGForce: 1.436,
    sumGForce: 11.26,
    gForceSamples: 10,
    maxClimbFpm: 987.8,
    maxDescentFpm: -1234.2,
    minEnrouteAglFt: 744.6,
    enrouteSamples: 40,
    aglSamples: 36,
    levelAltSamples: 12,
    levelAltMeanFt: 4012.4,
    levelAltM2: 16000,
    levelAltMinFt: 3900,
    levelAltMaxFt: 4170,
    levelAltDurationSec: 98.7
};

assert.deepEqual(run(true, base), run(false, base));
assert.equal(run(true, { ...base, hadAirbornePhase: false, airborneEvidenceSec: 0, maxAglFt: 10 }), null);
assert.equal(run(false, { ...base, hadAirbornePhase: false, airborneEvidenceSec: 0, maxAglFt: 10 }), null);

const stressRecord = { maxGForce: 1.52, maxBankDeg: 47, maxDescentFpm: -1400, touchdownVsFpm: -470 };
const liveRecorder = { maxGForce: 1.63, maxBankDeg: 52, maxDescentFpm: -1550, touchdownVsFpm: -510 };
const latestFlight = { gForce: 1.74, bankDeg: -58, vsFpm: -1720, touchdownFpm: -560 };
const stressContext = {
    window: { lastLiveFlightData: latestFlight },
    flightRecorder: liveRecorder,
    _missionDebugMotionProtectionEnabled: () => false,
    Math,
    Number
};
stressContext.window.window = stressContext.window;
vm.runInNewContext(functionSourceFrom(cargoSource, '_missionCargoStressDamage'), stressContext, {
    filename: 'mission-cargo-core.js#stress-differential'
});
const combinedStressRecord = {
    maxGForce: Math.max(stressRecord.maxGForce, liveRecorder.maxGForce, latestFlight.gForce),
    maxBankDeg: Math.max(Math.abs(stressRecord.maxBankDeg), Math.abs(liveRecorder.maxBankDeg), Math.abs(latestFlight.bankDeg)),
    maxDescentFpm: Math.min(stressRecord.maxDescentFpm, liveRecorder.maxDescentFpm, latestFlight.vsFpm),
    touchdownVsFpm: stressRecord.touchdownVsFpm || liveRecorder.touchdownVsFpm || latestFlight.touchdownFpm
};
assert.equal(
    recorderCore.stressDamage(combinedStressRecord),
    stressContext._missionCargoStressDamage(stressRecord),
    'standard APT cargo stress drift'
);

const manifest = {
    version: 6,
    maxStressDamagePct: 0,
    items: [
        { id: 'pax', itemType: 'passenger', required: true, status: 'loaded', weightLbs: 180, healthPct: 100, deliverAtDestination: true },
        { id: 'box', itemType: 'cargo', required: true, status: 'unloaded', weightLbs: 42, healthPct: 88, deliverAtDestination: true },
        { id: 'bag', itemType: 'cargo', required: false, status: 'loaded', weightLbs: 8, healthPct: 100, deliverAtDestination: false }
    ]
};
const outcomeContext = {
    window: {},
    _missionCargoEnsureManifest: () => structuredClone(manifest),
    _missionCargoIsPassengerItem: item => item?.itemType === 'passenger',
    _missionCargoItemNeedsUnloadHere: item => item?.deliverAtDestination !== false,
    Date: class FixedDate { static now() { return 1710000000000; } },
    Math,
    Number,
    String,
    JSON,
    Object,
    Array
};
outcomeContext.window.window = outcomeContext.window;
vm.runInNewContext([
    functionSourceFrom(cargoSource, '_missionCargoEvaluateOutcome'),
    functionSourceFrom(cargoSource, '_missionCargoEvaluateFarewellOutcome')
].join('\n\n'), outcomeContext, { filename: 'mission-cargo-core.js#farewell-outcome-differential' });
assert.deepEqual(
    JSON.parse(JSON.stringify(recorderCore.evaluateFarewellOutcome(manifest, {}, {}))),
    JSON.parse(JSON.stringify(outcomeContext._missionCargoEvaluateFarewellOutcome())),
    'standard APT Farewell cargo outcome drift'
);

console.log('mission flight recorder/app differential selftest: ok');
