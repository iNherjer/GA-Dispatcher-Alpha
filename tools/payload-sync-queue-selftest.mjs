#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const cargoSource = fs.readFileSync(new URL('../mission-cargo-core.js', import.meta.url), 'utf8');

const functionSource = (name) => {
    const asyncStart = cargoSource.indexOf(`async function ${name}(`);
    const regularStart = cargoSource.indexOf(`function ${name}(`);
    const functionStart = asyncStart >= 0 ? asyncStart : regularStart;
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

const context = {};
vm.runInNewContext([
    'const MISSION_CARGO_PAYLOAD_SYNC_DEBOUNCE_MS = 500;',
    'const MISSION_CARGO_PAYLOAD_SYNC_MAX_WAIT_MS = 2000;',
    functionSource('_missionCargoPayloadSyncDelayMs')
].join('\n'), context);

assert.equal(
    context._missionCargoPayloadSyncDelayMs(1000, 1000, 1000, false),
    500,
    'first change should wait for the short quiet window'
);
assert.equal(
    context._missionCargoPayloadSyncDelayMs(1500, 1000, 1500, false),
    500,
    'another change should restart the quiet window'
);
assert.equal(
    context._missionCargoPayloadSyncDelayMs(2900, 1000, 2900, false),
    100,
    'continuous changes must be capped by the two-second maximum'
);
assert.equal(
    context._missionCargoPayloadSyncDelayMs(3100, 1000, 3100, false),
    0,
    'an expired maximum window must flush immediately'
);
assert.equal(
    context._missionCargoPayloadSyncDelayMs(1200, 1000, 1200, true),
    0,
    'finalizing a load must bypass the debounce'
);

for (const contract of [
    'refreshAfter: false',
    'newer_payload_state_pending',
    'queue.revision > revision && queue.revision > queue.settledRevision',
    'MISSION_CARGO_PA24_VERIFY_DELAYS_MS = Object.freeze([350, 650])',
    "_missionCargoSyncPayloadToSim(reason, { immediate: true })"
]) {
    assert.ok(cargoSource.includes(contract), `payload sync queue contract missing: ${contract}`);
}

console.log('Payload sync latest-state queue selftest: ok');

let now = 1000;
let nextTimerId = 1;
const timers = new Map();
const runCalls = [];
const runResolvers = [];
class FakeDate extends Date {
    static now() {
        return now;
    }
}
const queueContext = {
    Date: FakeDate,
    Promise,
    Math,
    Number,
    String,
    clearTimeout: id => timers.delete(id),
    setTimeout: (callback, delayMs) => {
        const id = nextTimerId++;
        timers.set(id, { callback, delayMs });
        return id;
    },
    window: {
        simModeActive: false,
        liveTrackerConnected: true,
        trackerPayloadSet: () => {},
        missionCargoStatus: {
            payloadBaseline: null,
            payloadSyncRunning: false,
            payloadSyncQueued: '',
            payloadSyncScheduledAt: 0,
            payloadSyncRevision: 0,
            payloadNeedsSync: false
        }
    },
    _missionCargoEnsureManifest: () => null,
    _missionCargoNormalizePayloadSnapshot: () => null,
    _missionCargoBuildPayloadLayout: () => null,
    _missionCargoBuildPlanFromManifest: () => null,
    _missionCargoRunPayloadSync: (reason, revision) => {
        runCalls.push({ reason, revision });
        return new Promise(resolve => runResolvers.push(resolve));
    }
};
vm.runInNewContext([
    'const MISSION_CARGO_PAYLOAD_SYNC_DEBOUNCE_MS = 500;',
    'const MISSION_CARGO_PAYLOAD_SYNC_MAX_WAIT_MS = 2000;',
    `const _MISSION_CARGO_PAYLOAD_SYNC_QUEUE = ${JSON.stringify({
        timer: null,
        burstStartedAt: 0,
        lastRequestedAt: 0,
        pendingReason: '',
        revision: 0,
        settledRevision: 0,
        forceImmediate: false,
        waiters: [],
        lastResult: { status: 'idle' }
    })};`,
    functionSource('_missionCargoPayloadSyncDelayMs'),
    functionSource('_missionCargoPayloadSyncIsCurrentRevision'),
    functionSource('_missionCargoResolvePayloadSyncWaiters'),
    functionSource('_missionCargoWaitForPayloadSyncRevision'),
    functionSource('_missionCargoArmPayloadSyncQueue'),
    functionSource('_missionCargoFlushPayloadSyncQueue'),
    functionSource('_missionCargoSyncPayloadToSim')
].join('\n'), queueContext);

const first = queueContext._missionCargoSyncPayloadToSim('load-1');
assert.equal(timers.size, 1);
assert.equal([...timers.values()][0].delayMs, 500);

now = 1200;
const second = queueContext._missionCargoSyncPayloadToSim('unload-1');
assert.equal(timers.size, 1, 'a newer change must replace the previous timer');
assert.equal([...timers.values()][0].delayMs, 500);

now = 2900;
const third = queueContext._missionCargoSyncPayloadToSim('load-final');
assert.equal(timers.size, 1);
assert.equal([...timers.values()][0].delayMs, 100, 'the burst must flush at its hard deadline');

now = 3000;
const firstFlush = [...timers.values()][0];
timers.clear();
firstFlush.callback();
await Promise.resolve();
assert.equal(runCalls.length, 1);
assert.equal(runCalls[0].reason, 'load-final', 'only the latest state in the burst may be written');

now = 3050;
const duringRun = queueContext._missionCargoSyncPayloadToSim('unload-during-write');
assert.equal(timers.size, 0, 'a running write must remain single-flight');
runResolvers.shift()({ status: 'superseded' });
await Promise.resolve();
await Promise.resolve();
assert.equal(timers.size, 1, 'the latest state must be scheduled once after the running write');

await Promise.all([first, second, third]);
assert.equal(runCalls.length, 1);

now = 3550;
const secondFlush = [...timers.values()][0];
timers.clear();
secondFlush.callback();
await Promise.resolve();
assert.equal(runCalls.length, 2);
assert.equal(runCalls[1].reason, 'unload-during-write');
runResolvers.shift()({ status: 'ok' });
assert.equal((await duringRun).status, 'ok');
await Promise.resolve();
assert.equal(timers.size, 0, 'the queue must be empty after the latest revision succeeds');

console.log('Payload sync single-flight behavior selftest: ok');

const pa24CompareContext = {
    Number,
    Math,
    _missionCargoNormalizePayloadSnapshot: snapshot => snapshot
};
vm.runInNewContext(
    functionSource('_missionCargoComparePa24State'),
    pa24CompareContext
);
const pa24Target = {
    seats: { 2: 2, 3: 0, 4: 0 },
    characterWeights: { 2: 180, 3: 0, 4: 0 },
    baggageWeightLbs: 25
};
const lostOccupancy = pa24CompareContext._missionCargoComparePa24State({
    pa24: {
        seats: { 2: 0, 3: 0, 4: 0 },
        characterWeights: { 2: 180, 3: 0, 4: 0 },
        baggageWeightLbs: 25
    }
}, pa24Target, 1);
assert.equal(lostOccupancy.ok, false, 'matching weight must not hide a lost seat assignment');
assert.deepEqual(
    Array.from(lostOccupancy.mismatches, row => row.field),
    ['Seat2Character']
);
assert.equal(pa24CompareContext._missionCargoComparePa24State({
    pa24: {
        seats: { 2: 2, 3: 0, 4: 0 },
        characterWeights: { 2: 180, 3: 0, 4: 0 },
        baggageWeightLbs: 25
    }
}, pa24Target, 1).ok, true);

const seatWrites = [];
let seatRevisionCurrent = true;
const pa24ReassertContext = {
    Number,
    Math,
    Promise,
    setTimeout: callback => {
        callback();
        return 1;
    },
    window: {
        simModeActive: false,
        liveTrackerConnected: true,
        trackerDebugSetVar: async options => {
            seatWrites.push(options);
            return { status: 'ok' };
        }
    },
    _missionCargoPayloadSyncIsCurrentRevision: () => seatRevisionCurrent
};
vm.runInNewContext([
    'const MISSION_CARGO_PA24_SEAT_REASSERT_DELAY_MS = 220;',
    functionSource('_missionCargoReassertPa24Seats')
].join('\n'), pa24ReassertContext);
const reassertResult = await pa24ReassertContext._missionCargoReassertPa24Seats(pa24Target, {
    revision: 7,
    delayMs: 0
});
assert.equal(reassertResult.status, 'ok');
assert.deepEqual(
    seatWrites.map(write => [write.name, write.value, write.units]),
    [['L:Seat2Character', 2, 'enum']],
    'only occupied target seats may be reasserted'
);
seatRevisionCurrent = false;
assert.equal((await pa24ReassertContext._missionCargoReassertPa24Seats(pa24Target, {
    revision: 8,
    delayMs: 0
})).status, 'superseded');
assert.equal(seatWrites.length, 1, 'a stale revision must not restore an old occupant');

console.log('PA24 seat occupancy verification selftest: ok');
