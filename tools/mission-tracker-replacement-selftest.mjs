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

for (const trackerMission of [false,true]) {
    const scenario = await runOverwriteScenario({localMission:true,trackerMission});
    assert.equal(scenario.result,true);
    assert.deepEqual(scenario.calls,[], 'a follow-up preview must leave the accepted run intact');
}
const draftContext={window:{gaMissionDraftActive:()=>true},confirm:()=>false};
vm.runInNewContext(`${overwriteSource}\nthis.run = confirmMissionOverwriteIfNeeded;`,draftContext);
assert.equal(await draftContext.run(),false);
draftContext.confirm=()=>true;
assert.equal(await draftContext.run(),true);
draftContext.window.gaMissionDraftPhase=()=> 'committing';
assert.equal(await draftContext.run(),false);

const resetSource = functionSource(appSource, 'resetApp', 'async function');
const resetCalls = [];
const resetContext = {
    _dispatchRunId: 1,
    _abortDispatchRun: reason => resetCalls.push(['cancel-generation', reason]),
    window: { gaClearSharedMission: async () => { resetCalls.push(['shared-clear']); return {ok:true}; } },
    confirm: () => true,
    alert: () => { throw Error('unexpected error'); },
    clearAppMissionState: () => { throw Error('clear must use the shared coordinator'); }
};
vm.runInNewContext(`${resetSource}\nthis.run = resetApp;`, resetContext);
assert.equal(await resetContext.run(), true);
assert.deepEqual(resetCalls.map(call=>call[0]), ['cancel-generation','shared-clear']);
assert.equal(resetContext._dispatchRunId, 2);
resetContext.window.gaClearSharedMission=async()=>({ok:false,error:'offline'});
let errorMessage='';resetContext.alert=message=>{errorMessage=message;};
assert.equal(await resetContext.run(),false);
assert.match(errorMessage,/offline/);

assert.match(appSource, /missionDraftSession\(\)\.begin\(/);
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

const trackerTelemetryCalls = [...trackerSource.matchAll(/missionExecutionRuntime\.observeTelemetry\(\{[\s\S]*?\}\);/gi)]
    .map(match => match[0]).filter(call => /\blat\s*[:,]/.test(call) && /\blon\s*[:,]/.test(call) && /\bonGround\s*:/.test(call));
assert.equal(trackerTelemetryCalls.length, 1, 'one full flight sample must coexist with pause-only telemetry');
const trackerTelemetryCall = trackerTelemetryCalls[0];
for (const field of [
    'altFt', 'aglFt', 'hdg', 'bankDeg', 'gForce', 'vsFpm', 'touchdownFpm',
    'windKts', 'windDeg', 'windGustKts', 'tempC', 'visKm',
    'inCloud', 'turbulencePct', 'parkingBrake'
]) {
    assert.match(trackerTelemetryCall, new RegExp(`\\b${field}\\s*:`), `tracker Farewell telemetry missing ${field}`);
}

assert.match(trackerTelemetryCall, /\.\.\.precipitation/, 'shared precipitation observation must reach the worker');
assert.match(trackerSource, /precipitationCore\.observe\(raw\)/, 'SDK bitmask must be normalized before worker and relay samples');
console.log('Mission tracker replacement selftest passed');
