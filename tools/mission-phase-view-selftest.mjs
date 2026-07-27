import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const runtimeCode = fs.readFileSync(path.join(root, 'mission-runtime-core.js'), 'utf8');

const context = {
    window: {
        lastLiveGpsPos: { lat: 48, lon: 8 },
        lastLiveFlightData: { onGround: false, gsKts: 95, aglFt: 2500 },
        activePassenger: { taskDomain: 'charter', targetRadiusNm: 0, targetDwellMin: 0 }
    },
    currentMissionData: {
        start: 'EDTW',
        dest: 'EDTF',
        passenger: { taskDomain: 'charter' }
    },
    missionRuntime: { active: true, phase: 'active', closingPending: false },
    console,
    Date,
    Math,
    JSON,
    Number,
    String,
    Boolean,
    Array,
    Object,
    Set,
    Map,
    setTimeout: () => 0,
    clearTimeout: () => {}
};
vm.createContext(context);
vm.runInContext(runtimeCode, context, { filename: 'mission-runtime-core.js' });

context._missionRuntimePhaseSnapshot = () => context.missionRuntime.closingPending
    ? 'closing'
    : context.missionRuntime.phase;
context._activeMissionRuntimeId = () => 'test-mission';
context._activeBushMissionSpec = () => null;
context._activeBushMissionProgress = () => null;
context._missionSceneIsBushMission = () => false;
context._missionSceneIsPoiMission = () => false;
context._missionHasReachedEndEligibleFlightPhase = () => true;
context._missionRuntimeRouteWaypoints = () => [
    { lat: 48, lon: 8 },
    { lat: 48.4, lon: 8.4 }
];
context._distanceToMissionHomeNm = () => 25;
context._distanceToMissionTargetNm = () => 12;
context._missionEndReadiness = () => ({
    groundStill: false,
    atTarget: false,
    dMissionNm: 12,
    dArrivalNm: null
});
context._missionRuntimeGroundEndReady = () => false;
context._haversineNmLocal = (lat1, lon1, lat2, lon2) => Math.hypot(lat2 - lat1, lon2 - lon1) * 60;

let snapshot = context.window.missionRuntimeGetPhaseSnapshot();
assert.equal(snapshot.missionType, 'apt');
assert.equal(snapshot.currentPhase, 'enroute');
assert.deepEqual(
    Array.from(snapshot.stages, stage => stage.id),
    ['preparation', 'enroute', 'arrival', 'complete']
);

context._distanceToMissionTargetNm = () => 3.8;
snapshot = context.window.missionRuntimeGetPhaseSnapshot();
assert.equal(snapshot.currentPhase, 'arrival', 'APT approach must use the central arrival phase');

context._missionEndReadiness = () => ({
    groundStill: true,
    atTarget: true,
    dMissionNm: 0.1,
    dArrivalNm: 0.05
});
context._missionRuntimeGroundEndReady = () => true;
snapshot = context.window.missionRuntimeGetPhaseSnapshot();
assert.equal(snapshot.currentPhase, 'arrival', 'APT end-ready must remain arrival until mission closing');
assert.notEqual(snapshot.currentPhase, 'preparation', 'APT landing must never fall back to preparation');

context.missionRuntime = { active: false, phase: 'closing', closingPending: true };
snapshot = context.window.missionRuntimeGetPhaseSnapshot();
assert.equal(snapshot.currentPhase, 'complete');

context.missionRuntime = { active: true, phase: 'active', closingPending: false };
context.currentMissionData = {
    start: 'EDTW',
    dest: 'EDTW',
    poiName: 'Testmast',
    passenger: {
        taskDomain: 'mapping_survey',
        targetRadiusNm: 2,
        targetDwellMin: 3
    }
};
context.window.activePassenger = context.currentMissionData.passenger;
context.window.missionPoiRecipeId = () => 'poi_on_task';
context._missionSceneIsPoiMission = () => true;
context._missionRuntimeRouteWaypoints = () => [
    { lat: 48, lon: 8 },
    { lat: 48.2, lon: 8.2, isPOI: true },
    { lat: 48, lon: 8 }
];
context._distanceToMissionHomeNm = () => 10;
context._distanceToMissionTargetNm = () => 0.8;
context._missionEndReadiness = () => ({
    groundStill: false,
    atTarget: true,
    dMissionNm: 0.8,
    dArrivalNm: null
});
context._missionRuntimeGroundEndReady = () => false;
context._missionPoiRuntimeStatus = () => ({
    stage: 'survey_working',
    nextStep: 'Nächster Schritt: offene Linie abfliegen'
});
context.window.missionSurveyPattern = {
    getActiveSpec: () => ({
        type: 'orbit',
        orbit: { requiredTurns: 3 }
    })
};
context.window.paxVoiceGetPoiMissionProgress = () => ({
    hasSignal: true,
    trackingActive: true,
    satisfied: false,
    aborted: false,
    surveyPattern: {
        startedAt: 1,
        satisfied: false,
        orbit: { completedTurns: 1, activeCoverage: 0.5 }
    }
});

snapshot = context.window.missionRuntimeGetPhaseSnapshot();
assert.equal(snapshot.missionType, 'survey');
assert.equal(snapshot.requiresReturnHome, true, 'A-POI-A route must be recognized as return-home');
assert.equal(snapshot.currentPhase, 'work');
assert.equal(snapshot.nextStep, 'offene Linie abfliegen');
assert.deepEqual(
    Array.from(snapshot.stages, stage => stage.id),
    ['preparation', 'outbound', 'work', 'return_leg', 'landing', 'complete']
);
assert.equal(snapshot.workProgress[0].id, 'survey_orbits');
assert.equal(snapshot.workProgress[0].completed, 1);
assert.equal(snapshot.workProgress[0].total, 3);
assert.equal(snapshot.workProgress[0].activePct, 50);

context.window.paxVoiceGetPoiMissionProgress = () => ({
    hasSignal: true,
    trackingActive: true,
    satisfied: true,
    aborted: false,
    surveyPattern: {
        startedAt: 1,
        satisfied: true,
        orbit: { completedTurns: 3, activeCoverage: 0 }
    }
});
context._missionPoiRuntimeStatus = () => ({
    stage: 'return_leg',
    nextStep: 'Nächster Schritt: zum Heimatplatz zurückkehren'
});
snapshot = context.window.missionRuntimeGetPhaseSnapshot();
assert.equal(snapshot.currentPhase, 'return_leg');
assert.equal(snapshot.workProgress[0].completed, 3);
assert.equal(snapshot.workProgress[0].satisfied, true);

context._distanceToMissionHomeNm = () => 0.1;
context._missionEndReadiness = () => ({
    groundStill: true,
    atTarget: false,
    dMissionNm: 15,
    dArrivalNm: null
});
context._missionRuntimeGroundEndReady = () => true;
snapshot = context.window.missionRuntimeGetPhaseSnapshot();
assert.equal(snapshot.currentPhase, 'landing', 'POI return at the common start/destination must become landing');
assert.equal(snapshot.flags.atHome, true);

context._missionRuntimeGroundEndReady = () => false;
context._missionEndReadiness = () => ({
    groundStill: false,
    atTarget: true,
    dMissionNm: 0.8,
    dArrivalNm: null
});
context._distanceToMissionHomeNm = () => 10;
context.window.missionSurveyPattern = {
    getActiveSpec: () => ({
        type: 'north_south_scan',
        scan: {
            lineCount: 4,
            lines: [{ id: 'L1' }, { id: 'L2' }, { id: 'L3' }, { id: 'L4' }]
        }
    })
};
context.window.paxVoiceGetPoiMissionProgress = () => ({
    hasSignal: true,
    trackingActive: true,
    satisfied: false,
    aborted: false,
    surveyPattern: {
        startedAt: 1,
        satisfied: false,
        scan: {
            completedLineIds: ['L1', 'L2'],
            activeCoverage: 0.25
        }
    }
});
snapshot = context.window.missionRuntimeGetPhaseSnapshot();
assert.equal(snapshot.workProgress[0].id, 'survey_sectors');
assert.equal(snapshot.workProgress[0].completed, 2);
assert.equal(snapshot.workProgress[0].total, 4);
assert.equal(snapshot.workProgress[0].activePct, 25);

context.currentMissionData = {
    start: 'EDTW',
    dest: 'EDTW',
    poiName: 'Testmast',
    passenger: {
        taskDomain: 'inspection_infra',
        targetRadiusNm: 2,
        targetDwellMin: 2
    }
};
context.window.activePassenger = context.currentMissionData.passenger;
context.window.missionSurveyPattern = { getActiveSpec: () => null };
context._missionRuntimeRouteWaypoints = () => [
    { lat: 48, lon: 8 },
    { lat: 48.2, lon: 8.2, isPOI: true }
];
context.window.paxVoiceGetPoiMissionProgress = () => ({
    hasSignal: true,
    trackingActive: true,
    satisfied: false,
    aborted: false,
    dwellSec: 30
});
snapshot = context.window.missionRuntimeGetPhaseSnapshot();
assert.equal(snapshot.missionType, 'poi');
assert.equal(snapshot.requiresReturnHome, false);
assert.equal(snapshot.workProgress[0].id, 'poi_work_time');
assert.equal(snapshot.workProgress[0].completedSec, 30);
assert.equal(snapshot.workProgress[0].requiredSec, 60, 'normal mode must use the same 50% dwell success threshold as passenger voice');
assert.equal(snapshot.workProgress[0].percent, 50);

let activeBushSpec = {
    profileId: 'bush_pickup_strip',
    targetMode: 'strip_then_return',
    completionMode: 'return_home',
    requiresReturnHome: true,
    pickupKind: 'passenger'
};
let activeBushProgress = {
    status: 'pickup_ready',
    pickupReady: true,
    pickupCompleted: false,
    pickupConfirmed: false
};
context.currentMissionData = {
    start: 'EDTW',
    dest: 'BUSH',
    bush: activeBushSpec,
    passenger: { taskDomain: 'bush_pickup_return' }
};
context.window.activePassenger = context.currentMissionData.passenger;
context._missionSceneIsPoiMission = () => false;
context._missionSceneIsBushMission = () => true;
context._activeBushMissionSpec = () => activeBushSpec;
context._activeBushMissionProgress = () => activeBushProgress;
context._missionRuntimeRouteWaypoints = () => [
    { lat: 48, lon: 8 },
    { lat: 48.3, lon: 8.3 },
    { lat: 48, lon: 8 }
];
context.window.paxVoiceGetPoiMissionProgress = () => null;
snapshot = context.window.missionRuntimeGetPhaseSnapshot();
assert.equal(snapshot.missionType, 'bush_pickup');
assert.equal(snapshot.currentPhase, 'pickup');
assert.deepEqual(
    Array.from(snapshot.stages, stage => stage.id),
    ['preparation', 'outbound', 'pickup', 'return_leg', 'handoff', 'complete']
);

activeBushProgress = {
    status: 'return_leg',
    pickupReady: false,
    pickupCompleted: true,
    pickupConfirmed: true
};
snapshot = context.window.missionRuntimeGetPhaseSnapshot();
assert.equal(snapshot.currentPhase, 'return_leg');

activeBushProgress = {
    status: 'home_unloading',
    pickupReady: false,
    pickupCompleted: true,
    pickupConfirmed: true
};
snapshot = context.window.missionRuntimeGetPhaseSnapshot();
assert.equal(snapshot.currentPhase, 'handoff');

activeBushSpec = {
    profileId: 'bush_supply_strip',
    targetMode: 'strip',
    completionMode: 'unload_at_target',
    requiresReturnHome: false,
    pickupKind: ''
};
activeBushProgress = { status: 'enroute' };
snapshot = context.window.missionRuntimeGetPhaseSnapshot();
assert.equal(snapshot.missionType, 'bush_target');
assert.equal(snapshot.currentPhase, 'target', 'at-target bush supply must enter its target/unload phase');
assert.equal(snapshot.stages[2].label, 'Entladen');

console.log('[ok] mission phase view selftest');
