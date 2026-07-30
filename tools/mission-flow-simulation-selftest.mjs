#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const runtimeSource = fs.readFileSync(new URL('../mission-runtime-core.js', import.meta.url), 'utf8');
const cargoSource = fs.readFileSync(new URL('../mission-cargo-core.js', import.meta.url), 'utf8');
const syncSource = fs.readFileSync(new URL('../sync.js', import.meta.url), 'utf8');

function functionSource(source, name) {
    const start = source.indexOf(`function ${name}(`);
    assert.ok(start >= 0, `missing function ${name}`);
    const open = source.indexOf(') {', start) + 2;
    assert.ok(open > start, `missing function body ${name}`);
    let depth = 0;
    for (let i = open; i < source.length; i += 1) {
        if (source[i] === '{') depth += 1;
        if (source[i] === '}') depth -= 1;
        if (depth === 0) return source.slice(start, i + 1);
    }
    throw new Error(`unterminated function ${name}`);
}

const context = {
    window: {
        lastLiveGpsPos: { lat: 48, lon: 8, gs: 0 },
        lastLiveFlightData: { onGround: true, gsKts: 0, aglFt: 0 }
    },
    missionRuntime: {
        active: true,
        phase: 'active',
        closingPending: false
    },
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
vm.runInContext(runtimeSource, context, { filename: 'mission-runtime-core.js' });

const state = {
    kind: 'poi',
    meaningfulFlight: false,
    atTarget: false,
    atHome: true,
    onGround: true,
    gsKts: 0,
    signatureScope: 'departure',
    manifest: [],
    bushSpec: null,
    bushProgress: null,
    poiProgress: null
};

function isPassenger(item) {
    return String(item?.itemType || '').toLowerCase() === 'passenger';
}

function itemNeedsUnloadHere(item) {
    if (item?.deliverAtHome === true) return state.atHome;
    return item?.deliverAtDestination !== false;
}

function cargoNeedsUnload(options = {}) {
    return state.manifest.some(item => {
        if (item?.status !== 'loaded' || !itemNeedsUnloadHere(item)) return false;
        return !(options.ignorePassenger === true && isPassenger(item));
    });
}

function arrivalWorkflowOpen(options = {}) {
    return cargoNeedsUnload(options) || state.signatureScope !== 'arrival';
}

function isBush() {
    return state.kind.startsWith('bush_');
}

function isPoi() {
    return state.kind === 'poi' || state.kind === 'bush_recon';
}

function setTelemetry({ onGround, atTarget, atHome, meaningfulFlight, gsKts = null }) {
    if (typeof onGround === 'boolean') state.onGround = onGround;
    if (typeof atTarget === 'boolean') state.atTarget = atTarget;
    if (typeof atHome === 'boolean') state.atHome = atHome;
    if (typeof meaningfulFlight === 'boolean') state.meaningfulFlight = meaningfulFlight;
    state.gsKts = Number.isFinite(Number(gsKts)) ? Number(gsKts) : (state.onGround ? 0 : 95);
    context.window.lastLiveFlightData = {
        onGround: state.onGround,
        gsKts: state.gsKts,
        aglFt: state.onGround ? 0 : 2200
    };
    context.window.lastLiveGpsPos = {
        lat: state.atHome ? 48 : (state.atTarget ? 48.25 : 48.5),
        lon: state.atHome ? 8 : (state.atTarget ? 8.25 : 8.5),
        gs: state.gsKts
    };
}

function resetScenario(kind, options = {}) {
    state.kind = kind;
    state.meaningfulFlight = false;
    state.atTarget = false;
    state.atHome = true;
    state.onGround = true;
    state.gsKts = 0;
    state.signatureScope = 'departure';
    state.manifest = Array.isArray(options.manifest)
        ? options.manifest.map(item => ({ ...item }))
        : [];
    state.bushSpec = options.bushSpec ? { ...options.bushSpec } : null;
    state.bushProgress = options.bushProgress ? { ...options.bushProgress } : null;
    state.poiProgress = options.poiProgress ? { ...options.poiProgress } : null;
    context.missionRuntime.active = true;
    context.missionRuntime.phase = 'active';
    context.missionRuntime.closingPending = false;
    setTelemetry({ onGround: true, atTarget: false, atHome: true, meaningfulFlight: false });
}

function updateBush() {
    const next = context._missionBushUpdateProgress(
        context.window.lastLiveGpsPos.lat,
        context.window.lastLiveGpsPos.lon,
        Date.now()
    );
    if (next) state.bushProgress = { ...next };
    return next;
}

function groundAction() {
    return context._missionResolveGroundAction({
        active: true,
        endReady: context._missionEndReadiness()
    });
}

function assertAction(expectedAction, expectedEndReady, label) {
    const action = groundAction();
    assert.equal(action.action, expectedAction, `${label}: action`);
    assert.equal(action.endReady, expectedEndReady, `${label}: endReady`);
    return action;
}

context._missionPhaseDebugState = () => ({ lastGroundActionSig: '' });
context._missionPhaseDebugSummarizeGroundAction = value => value;
context._missionPhaseDebugPush = () => {};
context._missionRuntimePhaseSnapshot = () => context.missionRuntime.phase;
context._missionEndDeboardingBusy = () => false;
context._missionSceneIsPoiMission = isPoi;
context._missionSceneIsBushMission = isBush;
context._activeBushMissionSpec = () => state.bushSpec;
context._activeBushMissionProgress = () => state.bushProgress;
context._persistBushMissionProgress = next => {
    state.bushProgress = { ...next };
    return state.bushProgress;
};
context._missionPoiTaskProgressState = () => state.poiProgress;
context._missionHasReachedEndEligibleFlightPhase = () => state.meaningfulFlight;
context._missionCargoGroundHandlingAllowed = () => state.onGround && state.gsKts <= 5;
context._missionCargoNeedsUnload = cargoNeedsUnload;
context._missionCargoNeedsArrivalWorkflow = arrivalWorkflowOpen;
context._missionCargoIsPassengerItem = isPassenger;
context._missionCargoEnsureManifest = () => ({ items: state.manifest });
context._missionBushPickupAtTargetNow = () => state.atTarget && state.onGround && state.gsKts <= 5;
context._isAtMissionHome = () => state.atHome;
context._bushRecipeIdFromSpec = bush => (
    bush?.targetMode === 'strip_then_return'
        ? 'pickup_return'
        : (bush?.targetMode === 'area_then_return' && bush?.completionMode === 'return_home'
            ? 'poi_on_task_return'
            : 'strip_target')
);
context._missionEndReadiness = () => {
    const groundStill = state.onGround && state.gsKts <= 5;
    return {
        groundStill,
        atTarget: state.atTarget,
        ready: groundStill && state.atTarget && state.meaningfulFlight,
        reason: state.atTarget ? 'mission_target' : (state.atHome ? 'mission_home' : 'not_at_target'),
        hasAptArrival: false,
        dMissionNm: state.atTarget ? 0.05 : 12,
        dArrivalNm: null
    };
};

// Start gate: loading alone is insufficient; boarding interaction and voice must both finish.
let simulatedStartPhase = 'boarding';
let simulatedRuntimePhase = 'boarding';
let simulatedStartUiUpdates = 0;
const startContext = {
    window: {
        simModeActive: false,
        missionCargoStatus: {
            loadConfirmed: false,
            error: null
        },
        missionSceneStatus: {
            boardingVoiceComplete: false
        }
    },
    document: {
        getElementById: () => null
    },
    _missionCargoEnsureManifest: () => ({
        dispatchSignature: {
            scope: 'departure',
            at: 1
        }
    }),
    _missionCargoLoadInteractionReady: () => false,
    _missionStartPhase: () => simulatedStartPhase,
    _setMissionStartPhase: phase => {
        simulatedStartPhase = phase;
    },
    _setMissionRuntimePhase: phase => {
        simulatedRuntimePhase = phase;
    },
    _updateMissionRuntimeUi: () => {
        simulatedStartUiUpdates += 1;
    },
    _missionCargoRenderDialog: () => {},
    Number,
    String,
    Object
};
vm.runInNewContext(functionSource(syncSource, '_missionCargoMaybePromoteStartReady'), startContext);
assert.equal(startContext._missionCargoMaybePromoteStartReady('unsigned'), false);
startContext.window.missionCargoStatus.loadConfirmed = true;
assert.equal(startContext._missionCargoMaybePromoteStartReady('boarding-running'), false);
startContext._missionCargoLoadInteractionReady = () => true;
assert.equal(startContext._missionCargoMaybePromoteStartReady('voice-running'), false);
startContext.window.missionSceneStatus.boardingVoiceComplete = true;
assert.equal(startContext._missionCargoMaybePromoteStartReady('all-ready'), true);
assert.equal(simulatedStartPhase, 'boarded');
assert.equal(simulatedRuntimePhase, 'boarded');
assert.equal(startContext._missionCargoMaybePromoteStartReady('repeat-click'), true);
assert.ok(simulatedStartUiUpdates >= 1);

// An empty outbound pickup leg still uses the central load signature/confirmation gate.
assert.doesNotMatch(
    syncSource,
    /_missionPrepareEmptyPickupStart|missionPrepareEmptyPickupStart/,
    'sync must not bypass the central load gate for empty outbound pickup legs'
);
assert.doesNotMatch(
    cargoSource,
    /missionPrepareEmptyPickupStart/,
    'cargo completion must not bypass its own departure signature gate'
);

// POI: no unload before a meaningful flight, then cargo -> signature -> farewell/end.
resetScenario('poi', {
    manifest: [
        { id: 'primary-cargo', itemType: 'cargo', required: true, status: 'loaded', deliverAtDestination: true },
        { id: 'mission-passenger', itemType: 'passenger', required: true, status: 'loaded', deliverAtDestination: true }
    ]
});
assertAction('end', false, 'POI before departure');
setTelemetry({ onGround: false, atTarget: true, atHome: false, meaningfulFlight: true });
assertAction('end', false, 'POI airborne on task');
setTelemetry({ onGround: true, atTarget: false, atHome: false, meaningfulFlight: true });
assertAction('unload', true, 'POI landed after task');
state.manifest[0].status = 'unloaded';
assertAction('unload', true, 'POI cargo unloaded but unsigned');
state.signatureScope = 'arrival';
assertAction('end', true, 'POI signed with PAX awaiting farewell');
assertAction('end', true, 'POI repeated end action remains stable');

// Empty POI manifests still pass through the arrival signature instead of skipping the window.
resetScenario('poi');
setTelemetry({ onGround: true, atTarget: false, atHome: true, meaningfulFlight: true });
assertAction('unload', true, 'empty POI requires arrival signature');
state.signatureScope = 'arrival';
assertAction('end', true, 'empty POI releases after arrival signature');

// Bush supply: target stop -> required unload -> signature -> end.
resetScenario('bush_supply', {
    bushSpec: {
        profileId: 'bush_supply_strip',
        targetMode: 'strip',
        completionMode: 'unload_at_target',
        requiresReturnHome: false,
        pickupKind: ''
    },
    bushProgress: { status: 'enroute' },
    manifest: [
        { id: 'primary-cargo', itemType: 'cargo', required: true, status: 'loaded', deliverAtDestination: true }
    ]
});
setTelemetry({ onGround: true, atTarget: true, atHome: false, meaningfulFlight: true });
updateBush();
assert.equal(state.bushProgress.status, 'ready_to_close');
assertAction('unload', true, 'Bush supply target unload');
state.manifest[0].status = 'unloaded';
state.signatureScope = 'arrival';
assertAction('end', true, 'Bush supply signed completion');

// Bush recon: POI task may qualify the work, but only home can unlock unload/end.
resetScenario('bush_recon', {
    bushSpec: {
        profileId: 'bush_recon_return',
        targetMode: 'area_then_return',
        completionMode: 'return_home',
        requiresReturnHome: true,
        pickupKind: ''
    },
    bushProgress: {
        status: 'enroute',
        areaQualified: false,
        returnHomeQualified: false
    },
    poiProgress: {
        trackingActive: true,
        satisfied: false,
        aborted: false,
        dwellSec: 20,
        trackNm: 1.2
    },
    manifest: [
        { id: 'primary-cargo', itemType: 'cargo', required: true, status: 'loaded', deliverAtDestination: false, deliverAtHome: true }
    ]
});
setTelemetry({ onGround: true, atTarget: false, atHome: false, meaningfulFlight: true });
updateBush();
assertAction('end', false, 'Bush recon unrelated landing');
state.poiProgress = {
    trackingActive: true,
    satisfied: true,
    aborted: false,
    dwellSec: 90,
    trackNm: 4.5
};
setTelemetry({ onGround: false, atTarget: true, atHome: false, meaningfulFlight: true });
updateBush();
assert.equal(state.bushProgress.areaQualified, true);
assert.equal(state.bushProgress.status, 'return_leg');
setTelemetry({ onGround: true, atTarget: false, atHome: false, meaningfulFlight: true });
updateBush();
assertAction('end', false, 'Bush recon task complete but away from home');
setTelemetry({ onGround: true, atTarget: false, atHome: true, meaningfulFlight: true });
updateBush();
assert.equal(state.bushProgress.status, 'ready_to_close');
assertAction('unload', true, 'Bush recon home unload');
state.manifest[0].status = 'unloaded';
state.signatureScope = 'arrival';
assertAction('end', true, 'Bush recon signed home completion');

// Passenger pickup: pickup list, dedicated pickup signature, explicit confirmation,
// return, arrival signature, then farewell.
resetScenario('bush_pickup_passenger', {
    bushSpec: {
        profileId: 'bush_pickup_strip',
        targetMode: 'strip_then_return',
        completionMode: 'return_home',
        requiresReturnHome: true,
        pickupKind: 'passenger'
    },
    bushProgress: {
        status: 'outbound_empty',
        pickupReady: false,
        pickupCompleted: false,
        pickupConfirmed: false
    },
    manifest: [
        {
            id: 'pickup-passenger',
            itemType: 'passenger',
            required: true,
            status: 'pending',
            pickupLocation: 'target',
            deliverAtDestination: false,
            deliverAtHome: true
        },
        {
            id: 'pickup-companion-cargo',
            itemType: 'cargo',
            required: true,
            status: 'pending',
            pickupLocation: 'target',
            deliverAtDestination: false,
            deliverAtHome: true
        }
    ]
});
setTelemetry({ onGround: true, atTarget: true, atHome: false, meaningfulFlight: true });
updateBush();
assertAction('pickup', false, 'passenger pickup ready');
state.manifest[0].status = 'loaded';
updateBush();
const pickupLoadingAction = assertAction('pickup', false, 'passenger loaded while companion cargo remains open');
assert.equal(pickupLoadingAction.pickupConfirmOnly, false);
assert.equal(state.bushProgress.pickupCompleted, false);
assert.equal(state.bushProgress.status, 'pickup_loading');
assert.equal(
    state.manifest.filter(item => item.required && item.pickupLocation === 'target' && item.status !== 'loaded').length,
    1,
    'passenger alone must not complete the central pickup loading list'
);
state.manifest[1].status = 'loaded';
updateBush();
const pickupConfirmAction = assertAction('pickup', false, 'passenger and companion cargo loaded but unconfirmed');
assert.equal(pickupConfirmAction.pickupConfirmOnly, true);
assert.equal(state.bushProgress.pickupCompleted, true);
assert.equal(state.bushProgress.status, 'pickup_complete');
assert.equal(
    state.manifest.filter(item => item.required && item.pickupLocation === 'target' && item.status !== 'loaded').length,
    0,
    'passenger and companion cargo together complete the central pickup loading list'
);
assert.notEqual(
    state.signatureScope,
    'pickup',
    'the departure signature must not release pickup confirmation'
);
state.signatureScope = 'pickup';
assert.equal(state.signatureScope, 'pickup', 'pickup receives its own signature before confirmation');
state.bushProgress.pickupConfirmed = true;
state.bushProgress.status = 'return_leg';
setTelemetry({ onGround: false, atTarget: false, atHome: false, meaningfulFlight: true });
updateBush();
assertAction('end', false, 'passenger pickup return flight');
setTelemetry({ onGround: true, atTarget: false, atHome: true, meaningfulFlight: true });
updateBush();
assert.equal(state.bushProgress.status, 'home_unloading');
assertAction('unload', true, 'passenger pickup home signature');
state.manifest[1].status = 'unloaded';
assertAction('unload', true, 'companion cargo unloaded but arrival signature still missing');
state.signatureScope = 'arrival';
assertAction('end', true, 'passenger pickup releases farewell after signature');

// A missed pickup confirmation is recoverable even after returning home.
state.signatureScope = 'departure';
state.bushProgress.pickupConfirmed = false;
state.bushProgress.pickupCompleted = true;
state.bushProgress.status = 'home_unloading';
const lateConfirmAction = assertAction('pickup', false, 'late passenger pickup confirmation recovery');
assert.equal(lateConfirmAction.pickupConfirmOnly, true);
assert.notEqual(state.signatureScope, 'pickup', 'late recovery still requires a fresh pickup signature');
state.signatureScope = 'pickup';
state.bushProgress.pickupConfirmed = true;
updateBush();
assertAction('unload', true, 'late pickup confirmation returns to home handoff');

// Cargo pickup: home unload remains mandatory before the arrival signature can release end.
resetScenario('bush_pickup_cargo', {
    bushSpec: {
        profileId: 'bush_pickup_strip',
        targetMode: 'strip_then_return',
        completionMode: 'return_home',
        requiresReturnHome: true,
        pickupKind: 'cargo'
    },
    bushProgress: {
        status: 'outbound_empty',
        pickupReady: false,
        pickupCompleted: false,
        pickupConfirmed: false
    },
    manifest: [
        {
            id: 'pickup-cargo',
            itemType: 'cargo',
            required: true,
            status: 'pending',
            pickupLocation: 'target',
            deliverAtDestination: false,
            deliverAtHome: true
        }
    ]
});
setTelemetry({ onGround: true, atTarget: true, atHome: false, meaningfulFlight: true });
updateBush();
assertAction('pickup', false, 'cargo pickup ready');
state.manifest[0].status = 'loaded';
updateBush();
assert.notEqual(state.signatureScope, 'pickup', 'cargo pickup cannot reuse the departure signature');
state.signatureScope = 'pickup';
state.bushProgress.pickupConfirmed = true;
state.bushProgress.status = 'return_leg';
setTelemetry({ onGround: true, atTarget: false, atHome: true, meaningfulFlight: true });
updateBush();
assertAction('unload', true, 'cargo pickup home unload');
state.manifest[0].status = 'unloaded';
assertAction('unload', true, 'cargo pickup unloaded but unsigned');
state.signatureScope = 'arrival';
assertAction('end', true, 'cargo pickup signed completion');

// Final passenger handoff: arrival work blocks farewell; live deboarding waits for
// door/farewell/ACK, while Sim mode reaches the same close state without animation.
let arrivalWorkBlocked = true;
let passengerHandoffCalls = 0;
let passengerHandoffChanges = 0;
let closePendingCalls = 0;
let deboardingContinueCalls = 0;

context._missionCargoNeedsArrivalWorkflow = () => arrivalWorkBlocked;
context._missionRuntimePassengerHandoffComplete = () => false;
context._missionRuntimeHasPassengerForDeboarding = () => true;
context._missionSceneIsBushMission = () => false;
context._persistMissionRuntimeSnapshot = () => {};
context._updateMissionRuntimeUi = () => {};
context._missionCargoFinalizeMissionOutcome = () => ({ status: 'complete', failed: false });
context._missionOutcomeApplyPoiProgress = outcome => outcome;
context._missionPoiEndedAtHome = () => true;
context._missionPoiGroundEndReady = () => true;
context.window.triggerPaxFarewell = () => Promise.resolve();
context.window.missionCargoCompletePassengerHandoff = () => {
    passengerHandoffCalls += 1;
    const changed = passengerHandoffChanges === 0;
    if (changed) passengerHandoffChanges += 1;
    return { changed };
};
context._setMissionClosePending = ({ reason, outcome }) => {
    closePendingCalls += 1;
    context.missionRuntime.closingPending = true;
    context.missionRuntime.waitingFarewellDeboarding = false;
    context.missionRuntime.pendingFarewellReason = reason;
    context.missionRuntime.pendingCargoOutcome = outcome;
};

function resetFinalFlow({ simMode }) {
    context.missionRuntime.closingPending = false;
    context.missionRuntime.waitingFarewellDeboarding = false;
    context.missionRuntime.deboardingAfterFarewellStarted = false;
    context.missionRuntime.farewellSpeechStarted = false;
    context.missionRuntime.farewellSpeechComplete = false;
    context.missionRuntime.farewellDoorReady = false;
    context.missionRuntime.endDeboardingAnimationExpected = false;
    context.missionRuntime.endDeboardingCompleted = false;
    context.missionRuntime.endDeboardingCommandId = '';
    context.window.simModeActive = simMode;
    context.window.liveTrackerConnected = !simMode;
}

resetFinalFlow({ simMode: false });
assert.equal(
    context._triggerPaxFarewellAndWaitForDeboard(null, 'simulation-blocked-arrival'),
    false,
    'farewell must stay blocked while arrival cargo/signature work is open'
);
assert.equal(context.missionRuntime.waitingFarewellDeboarding, false);
assert.equal(closePendingCalls, 0);

arrivalWorkBlocked = false;
context.window.missionSceneDeboarding = () => 'simulation-deboarding-command';
context.window.missionSceneContinueDeboarding = commandId => {
    assert.equal(commandId, 'simulation-deboarding-command');
    deboardingContinueCalls += 1;
    return true;
};
assert.equal(
    context._triggerPaxFarewellAndWaitForDeboard(null, 'simulation-live-farewell'),
    true,
    'live farewell/deboarding should start'
);
assert.equal(context.missionRuntime.endDeboardingAnimationExpected, true);
assert.equal(context.missionRuntime.farewellSpeechStarted, false);
assert.equal(
    context.window.missionRuntimeHandleDeboardingStage({
        commandId: 'wrong-command',
        stage: 'door_open'
    }),
    false,
    'foreign deboarding stages must be ignored'
);
assert.equal(
    context.window.missionRuntimeHandleDeboardingStage({
        commandId: 'simulation-deboarding-command',
        stage: 'door_open'
    }),
    true,
    'door-open stage should release farewell voice'
);
assert.equal(context.missionRuntime.farewellSpeechStarted, true);
assert.equal(
    context.window.missionSceneStartDeboardingAfterFarewell('simulation-live-voice-complete'),
    true,
    'farewell completion should continue live deboarding'
);
assert.equal(deboardingContinueCalls, 1);
assert.equal(closePendingCalls, 0, 'mission must wait for the live deboarding ACK');
assert.equal(
    context.window.missionRuntimeHandleDeboardingAck({
        commandId: 'simulation-deboarding-command',
        status: 'ok',
        at: Date.now()
    }),
    true,
    'successful deboarding ACK should close the mission'
);
assert.equal(passengerHandoffChanges, 1, 'passenger handoff may only change state once');
assert.ok(passengerHandoffCalls >= 1, 'passenger handoff must be persisted');
assert.equal(closePendingCalls, 1);
assert.equal(context.missionRuntime.closingPending, true);
assert.equal(
    context.window.missionSceneStartDeboardingAfterFarewell('simulation-duplicate-voice-complete'),
    false,
    'duplicate farewell completion must be ignored after close'
);
assert.equal(closePendingCalls, 1);

resetFinalFlow({ simMode: true });
assert.equal(
    context._triggerPaxFarewellAndWaitForDeboard(null, 'simulation-sim-farewell'),
    true,
    'Sim mode farewell should start without a tracker animation'
);
assert.equal(context.missionRuntime.endDeboardingAnimationExpected, false);
assert.equal(context.missionRuntime.farewellSpeechStarted, true);
assert.ok(
    context.window.missionSceneStartDeboardingAfterFarewell('simulation-sim-voice-complete'),
    'Sim mode farewell completion should close without an ACK'
);
assert.equal(closePendingCalls, 2);
assert.equal(context.missionRuntime.closingPending, true);

console.log('[ok] mission flow simulation selftest');
