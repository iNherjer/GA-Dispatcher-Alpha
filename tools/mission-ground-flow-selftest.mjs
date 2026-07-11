import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const tracker = read('ga-tracker-client/tracker.js');
const sync = read('sync.js');
const runtime = read('mission-runtime-core.js');
const cargo = read('mission-cargo-core.js');
const voice = read('passenger-voice.js');
const index = read('index.html');
const app = read('app.js');
const serviceWorker = read('sw.js');

function section(source, start, end) {
    const from = source.indexOf(start);
    const to = source.indexOf(end, from + start.length);
    assert.ok(from >= 0, `section start missing: ${start}`);
    assert.ok(to > from, `section end missing: ${end}`);
    return source.slice(from, to);
}

function assertOrder(label, source, markers) {
    let cursor = -1;
    for (const marker of markers) {
        const next = source.indexOf(marker, cursor + 1);
        assert.ok(next > cursor, `${label}: missing/out-of-order marker ${marker}`);
        cursor = next;
    }
}

const boarding = section(tracker, 'const animateMissionSceneBoarding = async', 'const animateMissionSceneDeboarding = async');
assertOrder('boarding sequence', boarding, [
    "setUserAircraftDoor(true",
    'sendWaypointRoute',
    'handle.aIRemoveObject(plan.person.objectId',
    "stage: 'passenger_boarded'",
    "'boarding-close'",
    "type: 'mission_scene_boarding_ack'"
]);
assert.match(boarding, /boarderCount \?\? command\?\.passengerCount \?\? 1, 0, 3/);
assert.doesNotMatch(boarding, /fallbackPerson[\s\S]{0,220}tarmac/i);

const deboarding = section(tracker, 'const animateMissionSceneDeboarding = async', 'const clearScene = async');
assertOrder('deboarding sequence', deboarding, [
    "stage: 'cue'",
    "'deboarding-open'",
    "stage: 'door_open'",
    'await farewellGatePromise',
    'spawnSceneObjectFromPlan',
    "'deboarding-close-before-walk'",
    'sendWaypointRoute(person.objectId',
    'people.forEach(person => removeSceneObject(',
    'pickupVehicleDepartureMs = departVehicle',
    'await sleep(pickupVehicleDepartureMs)',
    "type: 'mission_scene_deboarding_ack'"
]);
assert.match(deboarding, /boarderCount \?\? command\?\.passengerCount \?\? 1, 0, 3/);
assert.match(deboarding, /stagedPickupVehicle/);
assert.match(deboarding, /boarding-finally-close|deboarding-finally-close/);

assert.doesNotMatch(index, /missionCargoAutoLoad|AUTO LOAD/);
assert.doesNotMatch(cargo, /missionCargoAutoLoad|MISSION_CARGO_AUTO_LOAD|cargo-auto-load/);
const cargoCueQueue = section(cargo, 'function _missionCargoPlayAudioCue(', 'function _missionCargoTrackManualPassengerCommand');
assert.doesNotMatch(cargoCueQueue, /commandId/);
const manualPaxCommand = section(cargo, 'function _missionCargoSendManualPassengerCommand', 'function _missionCargoVisibleKind');
assert.match(manualPaxCommand, /return commandId/);
assert.match(cargo, /manual-passenger-rollback/);
assert.match(cargo, /Via Boarding/);
assert.match(sync, /boarding-sim-passenger-sync/);
assert.match(sync, /showClose \|\| showDeboarding \|\| showEnd/);
assert.doesNotMatch(sync, /touchdown-farewell|flight-finalize-farewell/);
assert.match(cargo, /await _missionCargoSyncPayloadBeforeStart/);
assert.match(cargo, /item\.status !== 'loaded'\);/);
assert.match(voice, /Das Boarding ist abgeschlossen, die Tür ist geschlossen/);
assert.match(voice, /Die Flugzeugtür ist geöffnet; du sitzt noch an Bord/);
assert.match(voice, /die Tür ist geschlossen und ich bin jetzt an Bord/);
assert.match(sync, /boardingVoiceComplete/);
assert.match(sync, /const vehicleSupportEnabled = !aptPickupPoint/);
assert.match(sync, /tracker_v278_required/);
assert.match(sync, /missionInterruptedDeboardingRecovery/);
assert.match(sync, /cancel-interrupted-deboarding/);
assert.match(tracker, /TRACKER_VERSION = 'v278'/);
assert.match(sync, /MIN_TRACKER_VERSION_CODE = 278/);
assert.match(serviceWorker, /ga-dispatcher-v1452/);
assert.match(app, /sw\.js\?v=ga-dispatcher-v1452/);
assert.match(index, /payload-notice-20260711-01/);

const context = {
    window: {
        lastLiveGpsPos: { lat: 48, lon: 8 },
        lastLiveFlightData: {}
    },
    missionRuntime: { active: true },
    console,
    Date,
    Math,
    JSON,
    Number,
    String,
    Boolean,
    Array,
    Object,
    setTimeout: () => 0,
    clearTimeout: () => {}
};
vm.createContext(context);
vm.runInContext(runtime, context, { filename: 'mission-runtime-core.js' });

context._hasAptArrivalRuntimePoint = () => false;
context._distanceToMissionTargetNm = () => 0;
context._distanceToAptArrivalNm = () => null;
let readiness = context._missionEndReadiness(48, 8);
assert.equal(readiness.groundStill, false, 'missing ground telemetry must not imply stopped-on-ground');

context.window.lastLiveFlightData = { onGround: true, gsKts: 0, aglFt: 0 };
readiness = context._missionEndReadiness(48, 8);
assert.equal(readiness.ready, true, 'explicit stopped-on-ground telemetry should allow end readiness');

context._missionSceneIsBushMission = () => true;
context._missionBushIsPickupMission = () => true;
context._activeBushMissionProgress = () => ({ pickupCompleted: true, pickupConfirmed: false, status: 'home_unloading' });
context._isAtMissionHome = () => true;
context._missionHasReachedEndEligibleFlightPhase = () => true;
assert.equal(
    context._missionBushGroundEndReady({ groundStill: true }),
    false,
    'pickup return must still require confirmation from the loading window'
);
context._activeBushMissionProgress = () => ({ pickupCompleted: true, pickupConfirmed: true, status: 'home_unloading' });
assert.equal(
    context._missionBushGroundEndReady({ groundStill: true }),
    true,
    'pickup return must become unload/end-ready before passenger deboarding'
);

context.window.activePassenger = { name: 'Testgast' };
context._missionCargoIsPassengerItem = item => item?.type === 'passenger';
context._missionCargoGetManifest = () => ({ items: [{ type: 'passenger', status: 'unloaded' }] });
assert.equal(
    context._missionRuntimeHasPassengerForDeboarding(),
    false,
    'an already unloaded manifest passenger must not spawn again'
);
context._missionCargoGetManifest = () => ({ items: [{ type: 'passenger', status: 'loaded' }] });
assert.equal(context._missionRuntimeHasPassengerForDeboarding(), true, 'a loaded manifest passenger must deboard');

let pickupDepartureCalls = 0;
context.window.triggerPaxPickupDeparture = () => { pickupDepartureCalls += 1; };
context.window.missionPickupDepartureVoicePending = { kind: 'passenger', armedAt: Date.now() - 2000 };
assert.equal(
    context.window.missionMaybeTriggerPickupDepartureVoice({ onGround: false, gsKts: 0, aglFt: 0 }),
    false,
    'a lone onGround=false glitch must not trigger pickup departure voice'
);
assert.equal(
    context.window.missionMaybeTriggerPickupDepartureVoice({ onGround: false, gsKts: 15, aglFt: 20 }),
    true,
    'corroborated airborne telemetry must trigger pickup departure voice'
);
assert.equal(pickupDepartureCalls, 1);

console.log('[ok] mission ground flow selftest');
