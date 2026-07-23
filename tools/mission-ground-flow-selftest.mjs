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
const homebaseIntegration = read('homebase-integration.js');
const homebaseWorkbench = read('homebase/homebase-workbench.js');
const homebasePackageService = read('ga-tracker-client/homebase-package-service.js');
const trackerPackage = read('ga-tracker-client/package.json');

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

const movingTarmacCatalog = section(sync, 'const MISSION_SCENE_MOVING_TARMAC_PERSON_TITLES', 'const MISSION_SCENE_DEBUG_MAX_EVENTS');
const movingTarmacTitles = Array.from(movingTarmacCatalog.matchAll(/'((?:Tarmac)_(?:Male|Female)_(?:Summer|Winter)_(?:African|Arab|Asian|Caucasian|Hispanic|Indian))'/g), match => match[1]);
assert.equal(movingTarmacTitles.length, 24);
assert.equal(new Set(movingTarmacTitles).size, 24);
assert.equal(movingTarmacTitles.filter(title => title.includes('_Male_')).length, 12);
assert.equal(movingTarmacTitles.filter(title => title.includes('_Female_')).length, 12);
assert.doesNotMatch(movingTarmacCatalog, /Black|Tarmac_(?:Male|Female)_(?:Summer|Winter)'/i);
const movingPersonPool = section(sync, 'function _missionSceneMovingPersonPool', 'function _missionSceneHeadingOffsetBetween');
assert.match(movingPersonPool, /MISSION_SCENE_MOVING_TARMAC_PERSON_TITLES/);
assert.doesNotMatch(movingPersonPool, /Marshaller_/i);
const boardingSceneSpawn = section(sync, 'window.missionSceneSpawn = function', 'window.missionSceneClear = function');
assert.match(boardingSceneSpawn, /_missionSceneMovingPersonTitle\(primaryGender, 'boarding-primary'\)/);
assert.match(boardingSceneSpawn, /_missionSceneMovingPersonCandidates\(primaryGender, primaryPersonTitle\)/);
assert.match(boardingSceneSpawn, /_missionScenePersonTitle\(primaryGender, 'vehicle-idle'\)/);
const appDeboarding = section(sync, 'window.missionSceneDeboarding = function', 'window.missionSceneContinueDeboarding = function');
assert.match(appDeboarding, /_missionSceneMovingPersonTitle\(primaryGender, 'deboarding'\)/);
assert.match(appDeboarding, /_missionSceneMovingPersonCandidates\(primaryGender, personTitle\)/);
const aptArrivalItems = section(sync, 'function _missionAptArrivalSceneItems', 'window.missionAptArrivalEnsureSpawned = function');
assert.match(aptArrivalItems, /movingPickupPersonIndex/);
assert.match(aptArrivalItems, /movingPerson: index === movingPickupPersonIndex/);
const aptArrivalAsset = section(sync, 'function _missionAptArrivalAssetForItem', 'function _missionAptArrivalSceneItems');
assert.match(aptArrivalAsset, /options\.movingPerson === true[\s\S]*\^tarmac_/i);
const manualPax = section(cargo, 'function _missionCargoSendManualPassengerCommand', 'function _missionCargoVisibleKind');
assert.match(manualPax, /_missionSceneMovingPersonTitle/);
assert.match(manualPax, /_missionSceneMovingPersonCandidates/);

assert.doesNotMatch(index, /missionCargoAutoLoad|AUTO LOAD/);
assert.doesNotMatch(cargo, /missionCargoAutoLoad|MISSION_CARGO_AUTO_LOAD|cargo-auto-load/);
const cargoCueQueue = section(cargo, 'function _missionCargoPlayAudioCue(', 'function _missionCargoTrackManualPassengerCommand');
assert.doesNotMatch(cargoCueQueue, /commandId/);
const manualPaxCommand = section(cargo, 'function _missionCargoSendManualPassengerCommand', 'function _missionCargoVisibleKind');
assert.match(manualPaxCommand, /return commandId/);
assert.match(cargo, /manual-passenger-rollback/);
assert.match(cargo, /Via Boarding/);
assert.match(cargo, /const passengerUsesMainBoarding = isPassenger[\s\S]{0,180}item\.status !== 'unloaded'[\s\S]{0,120}!missionRuntime\.active/);
assert.match(cargo, /item\.pickupLocation !== 'target'[\s\S]{0,120}item\.status !== 'unloaded'[\s\S]{0,120}!missionRuntime\.active/);
assert.match(cargo, /function _missionCargoPassengerBusyLabel\(\)/);
assert.match(cargo, /Boarding läuft/);
assert.match(cargo, /Einsteigen läuft/);
assert.match(cargo, /Aussteigen läuft/);
assert.match(cargo, /passengerSceneBusy \? passengerSceneBusyLabel : \(passengerUsesMainBoarding/);
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
assert.match(tracker, /TRACKER_VERSION = 'v\d+'/);
assert.match(tracker, /HOMEBASE_ENABLED = true/);
const trackerVersionCode = Number(tracker.match(/TRACKER_VERSION_CODE = (\d+)/)?.[1]);
const minimumTrackerVersionCode = Number(sync.match(/MIN_TRACKER_VERSION_CODE = (\d+)/)?.[1]);
assert.ok(Number.isFinite(trackerVersionCode));
assert.equal(minimumTrackerVersionCode, trackerVersionCode);
assert.match(tracker, /stabilizeSceneGroundObject/);
assert.match(tracker, /SCENE_GROUND_STABILIZED/);
assert.doesNotMatch(sync, /function _missionSceneGroundAltOffsetForTitle/);
assert.match(serviceWorker, /ga-dispatcher-v\d+/);
assert.match(app, /sw\.js\?v=ga-dispatcher-v\d+/);
assert.match(index, /passenger-voice\.js\?v=[^"']+/);
assert.match(homebaseIntegration, /'\/api\/assets\/install': 'homebase_v1\.assets\.install'/);
assert.doesNotMatch(homebaseIntegration, /hb_test|hbTestHello/);
assert.doesNotMatch(homebaseWorkbench, /hb_test|hbTestHello|Test2/);
assert.match(homebaseWorkbench, /offerAssetPackageInstall/);
assert.match(homebaseWorkbench, /\/api\/assets\/update-install/);
assert.match(homebasePackageService, /HOMEBASE_ASSETS_INSTALLED/);
assert.match(homebasePackageService, /homebase-assets-install/);
assert.doesNotMatch(trackerPackage, /embedded-homebase-assets/);
assert.doesNotMatch(trackerPackage, /prebuild:tracker/);

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
