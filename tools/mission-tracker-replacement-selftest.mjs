#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const appSource = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const syncSource = fs.readFileSync(new URL('../sync.js', import.meta.url), 'utf8');
const followupSource = fs.readFileSync(new URL('../mission-followup.js', import.meta.url), 'utf8');
const trackerSource = fs.readFileSync(new URL('../ga-tracker-client/tracker.js', import.meta.url), 'utf8');

function functionSource(source, name, declaration = 'function') {
    const start = source.indexOf(`${declaration} ${name}(`);
    assert.ok(start >= 0, `missing function ${name}`);
    const open = source.indexOf(') {', start) + 2;
    assert.ok(open > start, `missing function body ${name}`);
    let depth = 0;
    for (let index = open; index < source.length; index += 1) {
        if (source[index] === '{') depth += 1;
        if (source[index] === '}') depth -= 1;
        if (depth === 0) return source.slice(start, index + 1);
    }
    throw new Error(`unterminated function ${name}`);
}

const overwriteSource = functionSource(appSource, 'confirmMissionOverwriteIfNeeded', 'async function');

async function runOverwriteScenario({ localMission = true, trackerMission = false, confirmed = true, abortOk = true } = {}) {
    const calls = [];
    const context = {
        window: {
            gaTrackerExecutionHandlesMission: () => trackerMission,
            missionRuntimeResumeConflict: null,
            gaAbortTrackerMission: async options => {
                calls.push({ type: 'abort', options });
                await Promise.resolve();
                return { ok: abortOk };
            },
            missionRuntimeReset: options => {
                calls.push({ type: 'reset', options });
                return true;
            }
        },
        isAcceptedOrActiveMissionPresent: () => localMission,
        confirm: message => {
            calls.push({ type: 'confirm', message });
            return confirmed;
        },
        alert: message => calls.push({ type: 'alert', message })
    };
    vm.runInNewContext(`${overwriteSource}\nthis.run = confirmMissionOverwriteIfNeeded;`, context);
    return { result: await context.run(), calls };
}

let scenario = await runOverwriteScenario({ localMission: false, trackerMission: false });
assert.equal(scenario.result, true);
assert.deepEqual(scenario.calls, []);

scenario = await runOverwriteScenario({ localMission: true, trackerMission: false });
assert.equal(scenario.result, true);
assert.deepEqual(scenario.calls.map(call => call.type), ['confirm', 'reset']);

scenario = await runOverwriteScenario({ localMission: false, trackerMission: true });
assert.equal(scenario.result, true);
assert.deepEqual(scenario.calls.map(call => call.type), ['confirm', 'abort']);
assert.equal(scenario.calls[1].options.skipConfirm, true);
assert.equal(scenario.calls[1].options.forceLocalCleanup, true);
assert.equal(scenario.calls[1].options.reason, 'new-mission-replacement');

scenario = await runOverwriteScenario({ localMission: true, trackerMission: true, abortOk: false });
assert.equal(scenario.result, false);
assert.deepEqual(scenario.calls.map(call => call.type), ['confirm', 'abort']);

scenario = await runOverwriteScenario({ localMission: true, trackerMission: true, confirmed: false });
assert.equal(scenario.result, false);
assert.deepEqual(scenario.calls.map(call => call.type), ['confirm']);

const resetSource = functionSource(appSource, 'resetApp', 'async function');
const resetCalls = [];
const resetContext = {
    window: {
        gaTrackerExecutionHandlesMission: () => true,
        gaAbortTrackerMission: async options => {
            resetCalls.push(options);
            return { ok: true };
        }
    },
    confirm: () => true,
    clearAppMissionState: () => {
        throw new Error('tracker reset must not clear before abort ACK');
    }
};
vm.runInNewContext(`${resetSource}\nthis.run = resetApp;`, resetContext);
assert.equal(await resetContext.run(), true);
assert.equal(resetCalls.length, 1);
assert.equal(resetCalls[0].forceLocalCleanup, true);

assert.match(appSource, /!await confirmMissionOverwriteIfNeeded\(\)/);
assert.match(followupSource, /!await window\.confirmMissionOverwriteIfNeeded\(\)/);
assert.match(syncSource, /forceLocalCleanup = options\?\.forceLocalCleanup === true/);
assert.match(syncSource, /forceLocalCleanup: options\.forceLocalCleanup === true,[\s\S]*?preserveMission: options\.preserveMission === true/);
assert.match(syncSource, /tracker-mission-reset-to-planned/);
assert.match(syncSource, /window\.missionCargoResetPromise = _missionCargoResetForMissionReset/);
assert.match(appSource, /function clearAppMissionState[\s\S]*?gaAbortTrackerMission\?\.\(\{[\s\S]*?forceLocalCleanup: true/);
assert.match(appSource, /if \(!trackerExecutionReplacement && window\.missionComplianceBlockReset\?\.\(\)\)/);
assert.match(syncSource, /mission_local_cleanup_failed/);

const farewellPrepareSource = functionSource(syncSource, '_missionPrepareFarewellVoice');
let localFarewellPrepares = 0;
const farewellPrepareContext = {
    _missionExecutionAuthorityIsTracker: () => true,
    window: {
        paxVoicePrepareFarewell: () => { localFarewellPrepares += 1; }
    },
    missionRuntime: { active: true, waitingFarewellDeboarding: false, closingPending: false }
};
vm.runInNewContext(`${farewellPrepareSource}\nthis.run = _missionPrepareFarewellVoice;`, farewellPrepareContext);
assert.equal(farewellPrepareContext.run({}, 'tracker-authority-test'), false);
assert.equal(localFarewellPrepares, 0, 'tracker authority must not start a second App Farewell job');

const trackerTelemetryCall = trackerSource.match(/missionExecutionRuntime\.observeTelemetry\(\{[\s\S]*?\n\s*\}\);/i)?.[0] || '';
for (const field of [
    'altFt', 'aglFt', 'hdg', 'bankDeg', 'gForce', 'vsFpm', 'touchdownFpm',
    'windKts', 'windDeg', 'windGustKts', 'tempC', 'visKm', 'precipRateMmH',
    'precipActive', 'inCloud', 'turbulencePct', 'parkingBrake'
]) {
    assert.match(trackerTelemetryCall, new RegExp(`\\b${field}\\s*:`), `tracker Farewell telemetry missing ${field}`);
}

console.log('Mission tracker replacement selftest passed');
