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
const missionDefinition = read('mission-definition-core.js');
const missionArrival = read('mission-arrival-core.js');
const missionLocation = read('mission-location-core.js');
const simRoute = read('sim-route.js');
const mapSource = read('map.js');
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
    'for (let index = 0; index < personPlans.length; index++)',
    'await sleep(groupPlan.boardingStaggerMs)',
    'spawnSceneObjectFromPlan',
    'sendWaypointRoute(obj.objectId',
    'SCENE_DEBOARDING_PERSON_START',
    "'deboarding-close-after-last-exit'",
    'people.forEach(person => removeSceneObject(',
    "stage: boardedPickup ? 'passenger_vehicle_boarded' : 'passenger_handoff_complete'",
    'pickupVehicleDepartureMs = departVehicle',
    'await sleep(pickupVehicleDepartureMs)',
    "type: 'mission_scene_deboarding_ack'"
]);
assert.match(deboarding, /if \(groupPlan\.enabled && index > 0\) await sleep\(groupPlan\.boardingStaggerMs\)/);
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
const boardingScenePlan = section(sync, 'function _missionSceneBuildSpawnEffectCommand', 'function _missionSceneBuildBoardingEffectCommand');
assert.match(boardingScenePlan, /_missionSceneMovingPersonTitle\(primaryGender, 'boarding-primary'\)/);
assert.match(boardingScenePlan, /_missionSceneMovingPersonCandidates\(primaryGender, primaryPersonTitle\)/);
assert.match(boardingScenePlan, /_missionScenePersonTitle\(primaryGender, 'vehicle-idle'\)/);
const boardingSceneSpawn = section(sync, 'window.missionSceneSpawn = function', 'window.missionSceneClear = function');
assert.match(boardingSceneSpawn, /_missionSceneBuildSpawnEffectCommand\(reason, pos\)/);
assert.match(boardingSceneSpawn, /no_departure_scene_items/);
assert.match(boardingSceneSpawn, /scene_spawn_skipped/);
const appDeboarding = section(sync, 'window.missionSceneDeboarding = function', 'window.missionSceneContinueDeboarding = function');
assert.match(appDeboarding, /_missionSceneMovingPersonTitle\(primaryGender, 'deboarding'\)/);
assert.match(appDeboarding, /_missionSceneMovingPersonCandidates\(primaryGender, personTitle\)/);
const aptArrivalItems = section(sync, 'function _missionAptArrivalSceneItems', 'window.missionAptArrivalEnsureSpawned = function');
assert.match(aptArrivalItems, /movingPickupPersonIndex/);
assert.match(aptArrivalItems, /movingPerson: isMovingPickupPerson/);
assert.match(aptArrivalItems, /kind: isMovingPickupPerson \? 'person_boarder_1' : item\.kind/);
const aptArrivalAsset = section(sync, 'function _missionAptArrivalAssetForItem', 'function _missionAptArrivalSceneItems');
assert.match(aptArrivalAsset, /options\.movingPerson === true[\s\S]*\^tarmac_/i);
const aptArrivalLifecycle = section(sync, 'window.missionAptArrivalEnsureSpawned = function', 'window.missionAptArrivalClear = function');
assert.match(aptArrivalLifecycle, /bush_pickup_scene_retired/);
assert.match(aptArrivalLifecycle, /distanceNm > 5/);
assert.match(aptArrivalLifecycle, /missionAptArrivalClear\('bush-pickup-scene-retired'\)/);
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
assert.match(cargo, /const passengerEndReleased = signatureReady[\s\S]{0,160}requiredUnloadBlockingMissing === 0/);
assert.match(cargo, /Pflichtfracht zuerst/);
assert.match(cargo, /finishMissionCargoUnloadAndEnd\(\{ source: 'passenger-row', skipConfirm: true \}\)/);
assert.match(cargo, /function _missionCargoPassengerWaitsForFarewellDeboarding/);
assert.match(cargo, /Der Passagier steigt nach Verabschiedung und Deboarding-Sequenz aus/);
assert.match(cargo, /id: 'pickup-companion-cargo'/);
assert.match(cargo, /const usesManifestSheet = isLoad \|\| isUnload \|\| isPickup \|\| isEquipment/);
assert.match(cargo, /else if \(isPickup\) \{[\s\S]{0,650}mode: 'pickup'/);
assert.match(cargo, /const manifestGates = _missionCargoManifestGateState\(manifest\)/);
assert.match(cargo, /manifestGates\.requiredPickupMissingItems/);
assert.match(cargo, /pickupItems\.filter\(item => item\.required && item\.status !== 'loaded'\)/);
assert.match(cargo, /if \(normalizedMode === 'pickup'\) return 'pickup'/);
assert.match(cargo, /const signatureMode = isUnload \? 'unload' : \(isPickup \? 'pickup' : 'load'\)/);
assert.match(cargo, /const signaturePanel = \(isLoad \|\| isUnload \|\| isPickup\)/);
assert.match(cargo, /const pickupItemsComplete = isPickup && requiredPickupMissing === 0 && visibleItems\.length > 0/);
assert.match(cargo, /_missionCargoSignatureMatchesMode\(manifest\.dispatchSignature, 'pickup'\)/);
assert.match(cargo, /function _missionCargoUpgradeBushPickupCompanionCargo/);
assert.match(cargo, /passengerItem\.status === 'loaded'[\s\S]{0,180}companion\.status = 'loaded'/);
assert.match(missionDefinition, /equipmentRole: pickupKind === 'cargo' \? 'cargo\.small_box' : 'cargo\.equipment_case'/);
assert.match(missionArrival, /explicitEquipmentLabel \|\| 'Uebergabeausruestung'/);
assert.match(app, /'cargo\.equipment_case'/);
assert.match(app, /const isBushPickupRole = String\(basePlan\.role \|\| ''\)\.toLowerCase\(\) === 'bush_strip_pickup'/);
assert.match(app, /requiredPickupCargo[\s\S]{0,650}if \(!alreadyIncluded\) sourceItems = \[\.\.\.sourceItems, fallbackItem\]/);
assert.match(app, /const runwaySidePlacement = String\(basePlan\.source \|\| ''\)\.toLowerCase\(\) === 'osm_runway_side'/);
assert.match(app, /rightM: runwaySidePlacement[\s\S]{0,160}runwaySideSign \* Math\.abs/);
assert.match(sync, /item\?\.pickupLocation === 'target'[\s\S]{0,100}!_missionCargoIsPassengerItem\(item\)/);
assert.match(cargo, /function _missionCargoCompletePassengerHandoff\(/);
assert.match(cargo, /handoffComplete/);
assert.match(runtime, /stage === 'passenger_vehicle_boarded'/);
assert.match(runtime, /missionCargoCompletePassengerHandoff/);
assert.doesNotMatch(runtime, /passengerOnly|missionRuntimeStartPassengerDeboarding/);
assert.match(cargo, /passengerSceneBusy \? passengerSceneBusyLabel : \(passengerUsesMainBoarding/);
assert.match(sync, /boarding-sim-passenger-sync/);
assert.match(sync, /showClose \|\| showDeboarding \|\| showEnd/);
assert.doesNotMatch(sync, /touchdown-farewell|flight-finalize-farewell/);
assert.doesNotMatch(sync, /missionCargoMaybeOpenArrivalDialog\?\.\('runtime-ground-end-ready'\)/);
assert.doesNotMatch(cargo, /window\.missionCargoMaybeOpenArrivalDialog\s*=/);
const manualMissionEndSection = section(sync, 'window.manualMissionEnd = function', 'window.completeMissionClose = function');
assert.match(manualMissionEndSection, /groundAction\.action === 'unload'/);
assert.match(manualMissionEndSection, /!endReady\.atTarget && !poiGroundEndReady && !bushGroundEndReady && !runtimeGroundEndReady/);
assert.doesNotMatch(manualMissionEndSection, /groundAction\.action === 'unload' \|\| poiGroundEndReady/);
assert.doesNotMatch(simRoute, /mode: '(?:unload|pickup)', trigger: 'sim:end_hold'/);
assert.match(simRoute, /groundAction\?\.action === 'unload'[\s\S]{0,220}openMissionCargoDialog\('unload'\)[\s\S]{0,100}return false/);
assert.match(sync, /function _prepareFreshMissionRuntimeStart\(/);
assert.match(sync, /function _missionAuthorityShouldSuppressFreshStartRestore\(/);
assert.match(sync, /missionRuntimeResumeSuppressedFor === missionId[\s\S]{0,220}options\.authorityConfirmed !== true/);
assert.match(sync, /_missionAuthorityShouldSuppressFreshStartRestore\(snapId, options\)[\s\S]{0,260}state: 'fresh-start'/);
assert.match(sync, /const shouldBeActive = !!runtime\.active \|\| \['active', 'end_ready'\]\.includes\(phase\)/);
assert.doesNotMatch(sync, /const shouldBeActive = trackerActive \|\|/);
const startBannerAction = section(sync, 'window.handleMissionStartBannerAction = async function', '// --- LIVE TRAFFIC ---');
const freshStartBranch = section(startBannerAction, "if (phase === 'planned')", "if (phase === 'prepare')");
assertOrder('fresh mission start', freshStartBranch, [
    "_prepareFreshMissionRuntimeStart('mission-start-prepare')",
    "_setMissionStartPhase('prepare')",
    "_missionSceneHandleFlightTick(window.lastLiveFlightData || {}, 'mission-start-prepare')"
]);
assert.match(cargo, /await _missionCargoSyncPayloadBeforeStart/);
assert.match(cargo, /item\.status !== 'loaded'\);/);
assert.doesNotMatch(cargo, /if \(manifest\.isPoi\) return false/);
assert.match(cargo, /function _missionCargoNeedsArrivalWorkflow\(/);
assert.match(cargo, /deliverAtDestination: !isBushReturnHomeRecon/);
assert.match(runtime, /function _missionBushReturnHomeIsCurrentDestination\(/);
assert.match(runtime, /source: 'bush_return_home'/);
assert.match(mapSource, /window\.reconcileMissionGroundState\('mission-map-open'\)/);
assert.match(mapSource, /window\.requestTrackerTelemetryWake\('mission-map-open'\)/);
assert.match(missionArrival, /source: 'osm_runway_side'/);
assert.match(missionArrival, /bush_strip_runway_axis_side_clearance/);
const runtimeGroundEndSection = section(runtime, 'function _missionRuntimeGroundEndReady', 'function _missionPoiEndedAtHome');
assertOrder('bush ground gate before POI ground gate', runtimeGroundEndSection, [
    'if (_missionSceneIsBushMission())',
    'if (_missionSceneIsPoiMission())'
]);
assert.match(voice, /Das Boarding ist abgeschlossen, die Tür ist geschlossen/);
assert.match(voice, /Die Flugzeugtür ist geöffnet; du sitzt noch an Bord/);
assert.match(voice, /die Tür ist geschlossen und ich bin jetzt an Bord/);
assert.match(voice, /function _paxSpeechCanceledByMissionEnd/);
assert.match(voice, /nach TTS verworfen: Farewell\/Missionsende aktiv/);
assert.match(voice, /_speakAndShow\(prompt, label, null, \{ cancelWhenMissionEnd: true \}\)/);
assert.match(voice, /_speakAndShow\(prompt, 'Nach der Landung', null, \{ cancelWhenMissionEnd: true \}\)/);
assert.match(sync, /boardingVoiceComplete/);
assert.match(sync, /const vehicleSupportEnabled = !aptPickupPoint/);
assert.match(sync, /tracker_\$\{MIN_TRACKER_VERSION_LABEL\}_required/);
assert.match(sync, /missionInterruptedDeboardingRecovery/);
assert.match(sync, /cancel-interrupted-deboarding/);
assert.match(tracker, /TRACKER_VERSION = 'v\d+'/);
assert.match(tracker, /HOMEBASE_ENABLED = true/);
const trackerVersionCode = Number(tracker.match(/TRACKER_VERSION_CODE = (\d+)/)?.[1]);
const minimumTrackerVersionCode = Number(sync.match(/MIN_TRACKER_VERSION_CODE = (\d+)/)?.[1]);
assert.ok(Number.isFinite(trackerVersionCode));
assert.equal(minimumTrackerVersionCode, 320);
assert.ok(trackerVersionCode >= minimumTrackerVersionCode);
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
assert.match(trackerPackage, /"prebuild:tracker": "node sync-efb-web-assets\.js"/);

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

vm.runInContext(missionLocation, context, { filename: 'mission-location-core.js' });
context.window.GAMissionLocationCore = context.GAMissionLocationCore;
context.currentMissionData = {
    aptArrivalPlan: { lat: 44.91156, lon: -115.48552 }
};
context._missionSceneIsPoiMission = () => false;
context._missionBushIsPickupMission = () => true;
context._activeBushMissionProgress = () => ({ pickupCompleted: true, pickupConfirmed: true, status: 'return_leg' });
context._missionHomePointForRuntime = () => ({ lat: 44.88970, lon: -116.10100 });
context._targetPointForMission = () => ({ lat: 44.91156, lon: -115.48552 });
context.window.lastLiveGpsPos = { lat: 44.886576, lon: -116.101005 };
context.window.lastLiveFlightData = { onGround: true, gsKts: 0, aglFt: 0 };
readiness = context._missionEndReadiness();
assert.equal(readiness.ready, true, 'Bush pickup return must use home instead of the stale pickup arrival anchor');
assert.equal(readiness.reason, 'apt_airport_fallback');
assert.ok(readiness.dArrivalNm < 0.2, 'KMYL test position must be near the home arrival point');
assert.ok(readiness.dMissionNm < 0.2, 'airport fallback must also use the Bush home point');

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

let latchedPickupProgress = {
    pickupCompleted: true,
    pickupConfirmed: true,
    returnHomeQualified: false,
    groundStopQualified: false,
    status: 'return_leg'
};
let pickupReadiness = { groundStill: true, gs: 0, agl: 0, onGround: true, parkingBrakeSet: false };
context._activeBushMissionSpec = () => ({ requiresReturnHome: true });
context._activeBushMissionProgress = () => latchedPickupProgress;
context._persistBushMissionProgress = next => {
    latchedPickupProgress = { ...next };
    return latchedPickupProgress;
};
context._missionCargoEnsureManifest = () => ({
    items: [{ id: 'pickup-pax', required: true, pickupLocation: 'target', itemType: 'passenger', status: 'loaded' }]
});
context._missionCargoIsPassengerItem = item => item?.itemType === 'passenger';
context._missionBushPickupAtTargetNow = () => false;
context._missionEndReadiness = () => pickupReadiness;
context._isAtMissionHome = () => true;
context._missionBushUpdateProgress(44.88, -116.1, Date.now());
assert.equal(latchedPickupProgress.returnHomeQualified, true, 'first valid home stop must qualify the return');
assert.equal(latchedPickupProgress.status, 'home_unloading');

pickupReadiness = { groundStill: false, gs: 0, agl: 0, onGround: false, parkingBrakeSet: false };
context._missionBushUpdateProgress(44.88, -116.1, Date.now());
assert.equal(
    latchedPickupProgress.status,
    'home_unloading',
    'a single on-ground telemetry dropout must not regress the qualified return to return_leg'
);
context._missionHasReachedEndEligibleFlightPhase = () => false;
assert.equal(
    context._missionBushGroundEndReady(pickupReadiness),
    true,
    'a qualified home arrival must keep its action while the aircraft remains stationary'
);
pickupReadiness = { groundStill: false, gs: 24, agl: 0, onGround: false, parkingBrakeSet: false };
assert.equal(
    context._missionBushGroundEndReady(pickupReadiness),
    false,
    'the qualified arrival must not expose ground actions while the aircraft is moving'
);

context._missionSceneIsPoiMission = () => true;
context._missionSceneIsBushMission = () => true;
assert.equal(
    context._missionPoiGroundEndReady({ groundStill: true, ready: false }),
    false,
    'Bush recon must never inherit the unrestricted POI landing gate'
);
context._missionBushGroundEndReady = () => false;
assert.equal(
    context._missionRuntimeGroundEndReady({ groundStill: true, ready: false }),
    false,
    'POI task presentation must not bypass the stricter Bush return-home gate'
);
context._missionBushGroundEndReady = () => true;
assert.equal(
    context._missionRuntimeGroundEndReady({ groundStill: true, ready: false }),
    true,
    'Bush recon must become end-ready when its own return-home gate succeeds'
);

context._missionSceneIsBushMission = () => false;
context._missionSceneIsPoiMission = () => true;
context._missionRuntimeGroundEndReady = () => false;
context._missionEndDeboardingBusy = () => false;
context._missionBushPickupReadyForAction = () => false;
context._activeBushMissionProgress = () => null;
context._missionCargoNeedsUnload = () => true;
context._missionCargoNeedsArrivalWorkflow = () => true;
context._missionCargoGroundHandlingAllowed = () => true;
context._missionPhaseDebugState = () => ({ lastGroundActionSig: '' });
context._missionPhaseDebugSummarizeGroundAction = value => value;
context._missionPhaseDebugPush = () => {};
let poiGroundAction = context._missionResolveGroundAction({
    active: true,
    endReady: { groundStill: true, ready: false, atTarget: false }
});
assert.notEqual(
    poiGroundAction.action,
    'unload',
    'POI cargo must not enter arrival unloading before the flight is end-ready'
);
context._missionRuntimeGroundEndReady = () => true;
poiGroundAction = context._missionResolveGroundAction({
    active: true,
    endReady: { groundStill: true, ready: false, atTarget: false }
});
assert.equal(
    poiGroundAction.action,
    'unload',
    'end-ready POI flights must enter the central arrival loading window'
);
context._missionCargoGroundHandlingAllowed = () => false;
poiGroundAction = context._missionResolveGroundAction({
    active: true,
    endReady: { groundStill: false, ready: false, atTarget: false }
});
assert.equal(
    poiGroundAction.action,
    'unload',
    'an end-ready mission must retain its required unload action through transient ground-telemetry loss'
);
context._missionSceneIsPoiMission = () => false;
context._missionCargoNeedsArrivalWorkflow = options => options?.ignorePassenger !== true;
poiGroundAction = context._missionResolveGroundAction({
    active: true,
    endReady: { groundStill: true, ready: true, atTarget: true }
});
assert.equal(
    poiGroundAction.action,
    'end',
    'after cargo and arrival signature are complete, a remaining passenger must proceed to farewell instead of reopening unloading'
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
context._missionCargoGetManifest = () => ({ items: [{ type: 'passenger', status: 'loaded', handoffComplete: true, handedOffAt: Date.now() }] });
assert.equal(
    context._missionRuntimeHasPassengerForDeboarding(),
    false,
    'a passenger handed to the arrival vehicle must never deboard or board again'
);

let passengerHandoffCalls = 0;
context.window.missionSceneStatus = { personBoarded: true };
context.window.missionCargoCompletePassengerHandoff = () => {
    passengerHandoffCalls += 1;
    return { changed: true, cargoIds: ['primary-cargo'] };
};
context._missionPhaseDebugPush = () => {};
context.missionRuntime.waitingFarewellDeboarding = true;
context.missionRuntime.endDeboardingCommandId = 'deboard-1';
assert.equal(
    context._missionRuntimeHandleDeboardingStage({
        type: 'mission_scene_deboarding_stage',
        commandId: 'deboard-1',
        stage: 'passenger_vehicle_boarded'
    }),
    true,
    'vehicle-boarded stage must complete the passenger handoff'
);
assert.equal(passengerHandoffCalls, 1);
assert.equal(context.window.missionSceneStatus.personBoarded, false);
context.missionRuntime.waitingFarewellDeboarding = false;

const memoryStore = {
    length: 0,
    key: () => null,
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {}
};
const arrivalContext = {
    window: {},
    localStorage: memoryStore,
    sessionStorage: memoryStore,
    console,
    Date,
    Math,
    JSON,
    Number,
    String,
    Boolean,
    Array,
    Object,
    Map,
    AbortController,
    setTimeout,
    clearTimeout
};
vm.createContext(arrivalContext);
vm.runInContext(missionArrival, arrivalContext, { filename: 'mission-arrival-core.js' });
const runwayContext = {
    parkingPositions: [],
    aprons: [],
    avoidZones: [{
        type: 'runway',
        name: '17/35',
        center: { lat: 44.9110, lon: -115.4855 },
        line: [
            { lat: 44.9060, lon: -115.4855 },
            { lat: 44.9160, lon: -115.4855 }
        ],
        polygon: [],
        bufferM: 45,
        distM: 0
    }]
};
const runwayPlan = {
    role: 'bush_strip_pickup',
    lat: 44.9110,
    lon: -115.4853,
    airportLat: 44.9110,
    airportLon: -115.4855,
    hdg: 87,
    items: [
        { kind: 'arrival_vehicle', forwardM: 6, rightM: 8 },
        { kind: 'arrival_person_1', forwardM: 0, rightM: 5 },
        { kind: 'arrival_equipment_1', forwardM: -2, rightM: 10 }
    ]
};
const runwayPlacement = arrivalContext.pickAptArrivalBushRunwaySidePlacement(runwayContext, runwayPlan);
assert.equal(runwayPlacement?.source, 'osm_runway_side');
assert.ok(Math.min(Math.abs(runwayPlacement.hdg), Math.abs(runwayPlacement.hdg - 180), Math.abs(runwayPlacement.hdg - 360)) < 2);
const runwayScenePoints = [runwayPlacement.point].concat(runwayPlacement.items.map(item => (
    arrivalContext.offsetAptArrivalLatLon(
        runwayPlacement.point.lat,
        runwayPlacement.point.lon,
        runwayPlacement.hdg,
        item.forwardM,
        item.rightM
    )
)));
runwayScenePoints.forEach(point => {
    assert.equal(arrivalContext.aptArrivalBlockedZone(runwayContext, point), null, 'Bush pickup scene item must remain outside the runway buffer');
});

context._missionPhaseDebugPush = () => {};
context._missionCargoNeedsArrivalWorkflow = () => true;
context.window.triggerPaxFarewell = () => false;
assert.equal(
    context._triggerPaxFarewellAndWaitForDeboard(null, 'normal-mission-end'),
    false,
    'normal mission end must remain blocked while required cargo still needs unloading'
);

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
