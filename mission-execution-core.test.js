'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const core = require('./mission-execution-core.js');

test('tracker authority is available only for the explicitly gated Alpha field test', () => {
    assert.equal(core.TRACKER_AUTHORITY_READY, true);
    assert.deepEqual(core.TRACKER_AUTHORITY_PENDING, []);
    assert.deepEqual(core.TRACKER_AUTHORITY_FIELD_VALIDATION_PENDING, [
        'standard_apt_end_to_end',
        'app_efb_multi_instance',
        'reload_and_duplicate_intents',
        'voice_playback_lease',
        'abort_clear_new_mission',
        'forced_compliance'
    ]);
});

function makeLegacyBundle(overrides = {}) {
    const base = {
        version: 2,
        missionId: 'mission-shadow-apt',
        adapter: 'apt',
        missionState: { currentMissionData: { missionId: 'mission-shadow-apt', missionStory: 'Sensitive narrative' } },
        runtime: {
            version: 1,
            missionId: 'mission-shadow-apt',
            startPhase: 'planned',
            runtime: { missionId: 'mission-shadow-apt', phase: 'planned', active: false, closingPending: false },
            cargoManifest: {
                version: 6,
                key: 'manifest-shadow-apt',
                dispatchSignature: { scope: 'departure', by: 'Secret Pilot Name' },
                items: [
                    { id: 'mission-passenger', itemType: 'passenger', label: 'Secret Passenger Name', required: true, status: 'loaded', passengerCount: 2, weightLbs: 330, deliverAtDestination: true },
                    { id: 'cargo-docs', itemType: 'cargo', storyName: 'Sensitive Cargo Description', required: true, status: 'loaded', weightLbs: 4, deliverAtDestination: true }
                ]
            },
            complianceInspection: null,
            poiProgress: null,
            bushProgress: null,
            flightRecorder: null
        }
    };
    const result = JSON.parse(JSON.stringify(base));
    if (overrides.runtime) {
        const runtime = overrides.runtime;
        if (runtime.runtime) Object.assign(result.runtime.runtime, runtime.runtime);
        Object.keys(runtime).filter(key => key !== 'runtime').forEach(key => { result.runtime[key] = runtime[key]; });
    }
    Object.keys(overrides).filter(key => key !== 'runtime').forEach(key => { result[key] = overrides[key]; });
    return result;
}

test('legacy projection retains the exact manifest while excluding unrelated mission narrative', () => {
    const state = core.projectLegacyBundle(makeLegacyBundle({
        runtime: {
            runtime: { phase: 'boarding' },
            complianceInspection: { selected: true, phase: 'evidence_open', revision: 3, remediation: { required: true } }
        }
    }));
    assert.equal(state.phase, 'boarding');
    assert.equal(state.cargo.summary.requiredTotal, 2);
    assert.equal(state.cargo.summary.departureReady, true);
    assert.equal(state.cargo.signatureScope, 'departure');
    assert.equal(state.cargo.items[0].id, 'cargo-docs');
    assert.equal(state.workflows.complianceInspection.phase, 'evidence_open');
    assert.equal(state.workflows.complianceInspection.remediationRequired, true);
    assert.equal(state.manifest.dispatchSignature.by, 'Secret Pilot Name');
    assert.equal(state.manifest.items.find(item => item.id === 'mission-passenger').label, 'Secret Passenger Name');
    assert.equal(state.manifest.items.find(item => item.id === 'cargo-docs').storyName, 'Sensitive Cargo Description');
    const serialized = JSON.stringify(state);
    assert.doesNotMatch(serialized, /Sensitive narrative/);
    assert.doesNotMatch(JSON.stringify(core.deriveView(state)), /Secret Pilot|Secret Passenger|Sensitive Cargo|Sensitive narrative/);
    assert.equal(core.stateHash(state), core.stateHash(core.normalizeState(state)));
});

test('tracker start chain cannot collapse scene, voice and payload ACKs', () => {
    let state = core.projectLegacyBundle(makeLegacyBundle());
    state = core.reduce(state, { eventId: 'start-prepare', type: 'PREPARE_REQUESTED', sequence: 1 });
    const prepareEffect = state.effects.find(effect => effect.type === 'scene.prepare');
    state = core.reduce(state, {
        eventId: 'start-prepare-ack', type: 'EFFECT_ACKNOWLEDGED', sequence: 2,
        payload: { effectId: prepareEffect.effectId, status: 'completed' }
    });
    state = core.reduce(state, { eventId: 'start-boarding', type: 'BOARDING_STARTED', sequence: 3 });
    state = core.reduce(state, { eventId: 'start-scene-ack', type: 'BOARDING_SCENE_CONFIRMED', sequence: 4 });
    assert.equal(state.flags.boardingSceneConfirmed, true);
    assert.equal(state.flags.boardingVoiceComplete, false);
    assert.equal(state.flags.boardingConfirmed, false);
    assert.equal(state.voice.boarding.status, 'pending');
    assert.equal(state.effects.at(-1).type, 'voice.boarding');

    state = core.reduce(state, { eventId: 'start-load-request', type: 'LOAD_CONFIRMATION_REQUESTED', sequence: 5 });
    assert.equal(state.flags.payloadSyncRequested, true);
    assert.equal(state.payload.status, 'pending');
    assert.equal(core.deriveView(state).payload.presentation.className, 'is-pending');
    assert.equal(state.flags.loadConfirmed, false);
    assert.equal(state.effects.at(-1).type, 'payload.sync_before_start');
    const firstPayloadEffect = state.effects.at(-1);
    state = core.reduce(state, {
        eventId: 'start-payload-failed', type: 'EFFECT_ACKNOWLEDGED', sequence: 6,
        payload: { effectId: firstPayloadEffect.effectId, status: 'failed' }
    });
    assert.equal(state.flags.payloadSyncRequested, false);
    assert.equal(core.allowedActions(state).includes('confirm_load'), true);
    state = core.reduce(state, { eventId: 'start-load-retry', type: 'LOAD_CONFIRMATION_REQUESTED', sequence: 7 });
    state = core.reduce(state, { eventId: 'start-payload-ack', type: 'LOAD_CONFIRMED', sequence: 8 });
    const retryPayloadEffect = state.effects.find(effect => effect.type === 'payload.sync_before_start' && effect.status === 'requested');
    state = core.reduce(state, {
        eventId: 'start-payload-result', type: 'EFFECT_ACKNOWLEDGED', sequence: 9, occurredAt: 900,
        payload: {
            effectId: retryPayloadEffect.effectId,
            status: 'completed',
            result: {
                schema: 'ga.mission-payload-outcome.v1',
                status: 'warning',
                override: true,
                error: 'payload_unstable_aircraft_override',
                plan: { missionWeightLbs: 334, stations: [{ index: 2, weightLbs: 180 }] },
                verification: { status: 'unstable', reason: 'station_mismatch' }
            }
        }
    });
    assert.equal(state.flags.loadConfirmed, true);
    assert.equal(state.phase, 'boarding');
    assert.equal(state.payload.status, 'warning');
    assert.equal(state.payload.updatedAt, 900);
    assert.match(core.deriveView(state).payload.presentation.message, /Missionszuladung: 334 lbs/);

    const voiceEffect = state.effects.find(effect => effect.type === 'voice.boarding');
    state = core.reduce(state, {
        eventId: 'start-voice-fallback', type: 'EFFECT_ACKNOWLEDGED', sequence: 10,
        payload: {
            effectId: voiceEffect.effectId,
            status: 'failed',
            result: {
                schema: 'ga.mission-voice-outcome.v1',
                kind: 'boarding',
                status: 'warning',
                text: 'Willkommen an Bord.',
                playback: 'not_played',
                error: 'voice_not_configured'
            }
        }
    });
    assert.equal(state.flags.boardingVoiceComplete, true);
    assert.equal(state.flags.boardingConfirmed, true);
    assert.equal(state.phase, 'boarded');
    assert.equal(state.voice.boarding.status, 'warning');
    assert.equal(state.voice.boarding.text, 'Willkommen an Bord.');
});

test('cargo-only departure requests the same loadmaster boarding voice as the App', () => {
    let state = core.projectLegacyBundle(makeLegacyBundle({
        runtime: {
            cargoManifest: {
                version: 6,
                key: 'manifest-cargo-only',
                dispatchSignature: { scope: 'departure' },
                items: [
                    { id: 'cargo-box', itemType: 'cargo', storyName: 'Kühlbox', required: true, status: 'loaded', weightLbs: 20, deliverAtDestination: true }
                ]
            }
        }
    }));
    state = core.reduce(state, { eventId: 'cargo-prepare', type: 'PREPARE_REQUESTED', sequence: 1 });
    state = core.reduce(state, {
        eventId: 'cargo-prepare-ack', type: 'EFFECT_ACKNOWLEDGED', sequence: 2,
        payload: { effectId: state.effects.find(effect => effect.type === 'scene.prepare').effectId, status: 'completed' }
    });
    state = core.reduce(state, { eventId: 'cargo-boarding', type: 'BOARDING_STARTED', sequence: 3 });
    state = core.reduce(state, { eventId: 'cargo-scene-ack', type: 'BOARDING_SCENE_CONFIRMED', sequence: 4 });
    assert.equal(state.effects.some(effect => effect.type === 'voice.boarding' && effect.status === 'requested'), true);
    assert.equal(state.flags.boardingVoiceComplete, false);
});

test('only real cargo and passenger transitions request incremental payload sync', () => {
    const pendingBundle = makeLegacyBundle({
        runtime: {
            cargoManifest: {
                version: 6,
                key: 'manifest-payload-transitions',
                dispatchSignature: null,
                items: [
                    { id: 'pax', itemType: 'passenger', required: false, status: 'pending', passengerCount: 1, weightLbs: 180, deliverAtDestination: true },
                    { id: 'box', itemType: 'cargo', required: true, status: 'pending', weightLbs: 20, deliverAtDestination: true }
                ]
            }
        }
    });
    let state = core.projectLegacyBundle(pendingBundle);
    state = core.reduce(state, { eventId: 'payload-prepare', type: 'PREPARE_REQUESTED', sequence: 1 });
    const prepareEffect = state.effects.find(effect => effect.type === 'scene.prepare');
    state = core.reduce(state, {
        eventId: 'payload-prepare-ack', type: 'EFFECT_ACKNOWLEDGED', sequence: 2,
        payload: { effectId: prepareEffect.effectId, status: 'completed' }
    });
    state = core.reduce(state, { eventId: 'payload-board', type: 'BOARDING_STARTED', sequence: 3 });
    state = core.reduce(state, { eventId: 'payload-board-ack', type: 'BOARDING_SCENE_CONFIRMED', sequence: 4, occurredAt: 300 });
    const passengerEffect = state.effects.find(effect => effect.type === 'payload.sync_manifest_state');
    assert.ok(passengerEffect);
    assert.equal(passengerEffect.payload.transition.action, 'passenger_load');
    assert.equal(state.manifest.items.find(item => item.id === 'pax').status, 'loaded');

    const loadedManifest = core.normalizeManifest(state.manifest);
    loadedManifest.items.find(item => item.id === 'box').status = 'loaded';
    const beforeCargoEffects = state.effects.length;
    state = core.reduce(state, {
        eventId: 'payload-box-load',
        type: 'CARGO_STATE_CHANGED',
        sequence: 5,
        occurredAt: 400,
        payload: {
            manifest: loadedManifest,
            payloadTransition: { action: 'load', itemId: 'box' }
        }
    });
    assert.equal(state.effects.length, beforeCargoEffects + 1);
    assert.equal(state.effects.at(-1).type, 'payload.sync_manifest_state');
    assert.equal(state.effects.at(-1).payload.transition.itemId, 'box');

    const signedManifest = core.normalizeManifest(state.manifest);
    signedManifest.dispatchSignature = { scope: 'departure', by: 'Tracker', at: 500 };
    const beforeSignatureEffects = state.effects.length;
    state = core.reduce(state, {
        eventId: 'payload-signature-only',
        type: 'CARGO_STATE_CHANGED',
        sequence: 6,
        occurredAt: 500,
        payload: { manifest: signedManifest }
    });
    assert.equal(state.effects.length, beforeSignatureEffects);

    let arrivalState = core.projectLegacyBundle(makeLegacyBundle({
        runtime: {
            runtime: { phase: 'end_ready', active: true },
            cargoManifest: {
                version: 6,
                key: 'manifest-pax-arrival',
                dispatchSignature: { scope: 'arrival' },
                items: [
                    { id: 'pax', itemType: 'passenger', required: true, status: 'loaded', passengerCount: 1, weightLbs: 180, delivery: 'destination', deliverAtDestination: true }
                ]
            }
        }
    }));
    arrivalState.flags.groundStill = true;
    arrivalState.flags.unloadConfirmed = true;
    arrivalState = core.reduce(arrivalState, { eventId: 'payload-pax-close', type: 'CLOSE_REQUESTED', sequence: 1 });
    arrivalState = core.reduce(arrivalState, { eventId: 'payload-pax-deboard', type: 'PAX_DEBOARDING_CONFIRMED', sequence: 2, occurredAt: 600 });
    assert.equal(arrivalState.manifest.items[0].status, 'unloaded');
    assert.equal(arrivalState.effects.some(effect => effect.type === 'payload.sync_manifest_state'
        && effect.payload.transition.action === 'passenger_unload'), true);
});

test('APT event replay is deterministic, gated, idempotent and creates stable declarative effects', () => {
    const executionBundle = core.createExecutionBundle(makeLegacyBundle());
    const unloadedCargo = {
        version: 6,
        key: 'manifest-shadow-apt',
        dispatchSignature: { scope: 'arrival' },
        items: [
            { id: 'mission-passenger', itemType: 'passenger', required: true, status: 'unloaded', passengerCount: 2, deliverAtDestination: true },
            { id: 'cargo-docs', itemType: 'cargo', required: true, status: 'unloaded', weightLbs: 4, deliverAtDestination: true }
        ]
    };
    const events = [
        { eventId: 'evt-01', type: 'PREPARE_REQUESTED', sequence: 1, occurredAt: 100 },
        { eventId: 'evt-02', type: 'EFFECT_ACKNOWLEDGED', sequence: 2, occurredAt: 105, payload: { effectId: 'mfx-' + core.hashValue({ missionId: 'mission-shadow-apt', eventId: 'evt-01', type: 'scene.prepare' }), status: 'completed' } },
        { eventId: 'evt-03', type: 'BOARDING_STARTED', sequence: 3, occurredAt: 110 },
        { eventId: 'evt-04', type: 'LOAD_CONFIRMED', sequence: 4, occurredAt: 120 },
        { eventId: 'evt-05', type: 'BOARDING_CONFIRMED', sequence: 5, occurredAt: 130 },
        { eventId: 'evt-06', type: 'MISSION_STARTED', sequence: 6, occurredAt: 140 },
        { eventId: 'evt-07', type: 'AIRBORNE', sequence: 7, occurredAt: 150 },
        { eventId: 'evt-08', type: 'TARGET_ENTERED', sequence: 8, occurredAt: 160 },
        { eventId: 'evt-09', type: 'TOUCHDOWN', sequence: 9, occurredAt: 170 },
        { eventId: 'evt-10', type: 'GROUND_STILL', sequence: 10, occurredAt: 180 },
        { eventId: 'evt-11', type: 'UNLOAD_CONFIRMED', sequence: 11, occurredAt: 190, payload: { cargo: unloadedCargo } },
        { eventId: 'evt-12', type: 'CLOSE_REQUESTED', sequence: 12, occurredAt: 200 },
        { eventId: 'evt-13', type: 'FAREWELL_COMPLETED', sequence: 13, occurredAt: 205 },
        { eventId: 'evt-14', type: 'MISSION_CLOSED', sequence: 14, occurredAt: 210 },
        { eventId: 'evt-14', type: 'MISSION_CLOSED', sequence: 14, occurredAt: 210 }
    ];
    const first = core.replay(executionBundle, events);
    const second = core.replay(JSON.parse(JSON.stringify(executionBundle)), JSON.parse(JSON.stringify(events)));
    assert.equal(first.ok, true);
    assert.equal(first.state.phase, 'closed');
    assert.equal(first.state.flags.closed, true);
    assert.equal(first.state.revision, 14);
    assert.equal(first.rejectedEvents.at(-1).reason, 'duplicate_event');
    assert.equal(first.stateHash, second.stateHash);
    assert.deepEqual(first.effects, second.effects);
    assert.equal(new Set(first.effects.map(effect => effect.effectId)).size, first.effects.length);
    assert.equal(first.effects.some(effect => effect.type === 'mission.close_requested'), true);
    assert.equal(first.effects.some(effect => effect.type === 'voice.farewell'), true);
    assert.equal(first.effects.find(effect => effect.type === 'scene.prepare').status, 'completed');
    assert.equal(first.effects.filter(effect => effect.type !== 'scene.prepare').every(effect => effect.status === 'requested'), true);
});

test('farewell gates coordinated passenger deboarding and commits handoff only after the scene ACK', () => {
    let state = core.projectLegacyBundle(makeLegacyBundle());
    state.phase = 'end_ready';
    state.flags.active = true;
    state.flags.started = true;
    state.flags.onGround = true;
    state.flags.groundStill = true;
    state.flags.unloadConfirmed = true;
    state.manifest = core.normalizeManifest({
        version: 1,
        dispatchSignature: { scope: 'arrival' },
        items: [{
            id: 'farewell-pax',
            itemType: 'passenger',
            required: true,
            status: 'loaded',
            passengerCount: 1,
            deliverAtDestination: true
        }]
    });
    state = core.normalizeState(state);

    state = core.reduce(state, { eventId: 'farewell-close', type: 'CLOSE_REQUESTED', sequence: 1, occurredAt: 100 });
    const scene = state.effects.find(effect => effect.type === 'scene.deboarding');
    assert.equal(scene.payload.coordinateFarewell, true);
    assert.equal(state.flags.farewellStarted, false);
    assert.equal(state.manifest.items[0].status, 'loaded');

    state = core.reduce(state, { eventId: 'farewell-cue', type: 'FAREWELL_STARTED', sequence: 2, occurredAt: 110 });
    assert.equal(state.flags.farewellStarted, true);
    assert.equal(state.effects.some(effect => effect.type === 'voice.farewell'), true);

    state = core.reduce(state, { eventId: 'farewell-spoken', type: 'FAREWELL_COMPLETED', sequence: 3, occurredAt: 120 });
    assert.equal(state.flags.farewellCompleted, true);
    const continuation = state.effects.find(effect => effect.type === 'scene.deboarding_continue');
    assert.equal(continuation.payload.deboardingEffectId, scene.effectId);
    assert.equal(state.phase, 'end_ready');
    assert.equal(state.manifest.items[0].status, 'loaded');

    state = core.reduce(state, { eventId: 'farewell-handoff', type: 'PAX_DEBOARDING_CONFIRMED', sequence: 4, occurredAt: 130 });
    assert.equal(state.manifest.items[0].status, 'unloaded');
    assert.equal(state.flags.deboardingCompleted, false);
    assert.equal(state.phase, 'closing');
    assert.equal(state.effects.some(effect => effect.type === 'mission.close_requested'), true);
});

test('invalid event order cannot bypass the universal start gates', () => {
    const executionBundle = core.createExecutionBundle(makeLegacyBundle());
    const replay = core.replay(executionBundle, [
        { eventId: 'too-early-start', type: 'MISSION_STARTED', sequence: 1, occurredAt: 1 },
        { eventId: 'too-early-close', type: 'CLOSE_REQUESTED', sequence: 2, occurredAt: 2 }
    ]);
    assert.equal(replay.state.phase, 'planned');
    assert.equal(replay.state.revision, 0);
    assert.deepEqual(replay.rejectedEvents.map(event => event.reason), ['transition_blocked', 'transition_blocked']);
    assert.deepEqual(core.allowedActions(replay.state), ['abort_mission', 'prepare_mission']);
});

test('cargo signatures, unload completion and compliance remain hard reducer gates', () => {
    const unsigned = makeLegacyBundle();
    unsigned.runtime.cargoManifest.dispatchSignature = null;
    const prepared = core.replay(core.createExecutionBundle(unsigned), [
        { eventId: 'gate-prepare', type: 'PREPARE_REQUESTED', sequence: 1 },
        { eventId: 'gate-board', type: 'BOARDING_STARTED', sequence: 2 },
        { eventId: 'gate-load', type: 'LOAD_CONFIRMED', sequence: 3 }
    ]);
    assert.equal(prepared.state.flags.loadConfirmed, false);
    assert.equal(prepared.rejectedEvents.at(-1).reason, 'transition_blocked');

    const closingState = core.projectLegacyBundle(makeLegacyBundle({
        runtime: {
            runtime: { phase: 'end_ready', active: true },
            cargoManifest: {
                version: 6,
                key: 'manifest-shadow-apt',
                dispatchSignature: { scope: 'arrival' },
                items: [
                    { id: 'cargo-docs', itemType: 'cargo', required: true, status: 'unloaded', deliverAtDestination: true }
                ]
            },
            complianceInspection: { selected: true, phase: 'evidence_open', remediation: { required: false } }
        }
    }));
    const blockedClose = core.reduce(closingState, { eventId: 'gate-close', type: 'CLOSE_REQUESTED', sequence: 4 });
    assert.equal(blockedClose.phase, 'end_ready');
    assert.equal(blockedClose.revision, closingState.revision);
    assert.equal(core.deriveView(blockedClose).blockingReasons.includes('compliance_inspection_active'), true);
});

test('forced App compliance follows visit, farewell, evidence, result, departure and release in exact order', () => {
    const flightId = 'manifest-compliance|100';
    const loadedManifest = {
        version: 6,
        key: 'manifest-compliance',
        flightEvents: { flightId, startAt: 100, landingAt: 200 },
        items: [
            { id: 'bordbuch', label: 'Bordbuch', itemType: 'cargo', status: 'loaded', persistentEquipment: true, deliverAtDestination: false, log: { flightId, startAt: 100, landingAt: 200 } },
            { id: 'fire-extinguisher', label: 'Feuerloescher', itemType: 'cargo', status: 'loaded', persistentEquipment: true, deliverAtDestination: false, expiresAt: '2099-12-31' },
            { id: 'first-aid', label: 'Verbandzeug', itemType: 'cargo', status: 'loaded', persistentEquipment: true, deliverAtDestination: false, expiresAt: '2099-12-31' }
        ]
    };
    let state = core.normalizeState({
        missionId: 'mission-compliance',
        recipe: 'apt',
        phase: 'enroute',
        subphase: 'outbound_flight',
        flags: { started: true, active: true, onGround: false },
        progress: { airborneSeen: true },
        manifest: loadedManifest,
        flightEvents: loadedManifest.flightEvents,
        workflows: {
            complianceInspection: {
                missionKey: 'mission-compliance',
                flightId,
                selected: true,
                forced: true,
                phase: 'selected'
            }
        }
    });
    let sequence = 0;
    const apply = (type, payload = {}) => {
        sequence += 1;
        state = core.reduce(state, {
            eventId: `compliance-${sequence}-${type}`,
            type,
            sequence,
            occurredAt: 1000 + sequence,
            payload
        });
        return state;
    };

    apply('GROUND_STILL', { atDestination: true, complianceRoll: 0.8 });
    assert.equal(state.workflows.complianceInspection.phase, 'approach_started');
    assert.equal(state.workflows.complianceInspection.snapshot.items.every(item => item.status === 'loaded'), true);
    assert.equal(state.effects.at(-1).type, 'scene.compliance_visit');

    apply('COMPLIANCE_INSPECTORS_WAITING');
    assert.equal(state.workflows.complianceInspection.phase, 'inspectors_waiting');
    assert.equal(state.effects.some(effect => effect.type === 'voice.compliance_request'), false);

    apply('CLOSE_REQUESTED', { position: { lat: 48, lon: 8 } });
    assert.equal(state.effects.at(-1).type, 'voice.farewell');
    apply('FAREWELL_COMPLETED');
    assert.equal(state.workflows.complianceInspection.farewellComplete, true);
    assert.equal(state.workflows.complianceInspection.phase, 'request_playing');
    assert.equal(state.effects.at(-1).type, 'voice.compliance_request');

    apply('COMPLIANCE_REQUEST_COMPLETED');
    assert.equal(state.workflows.complianceInspection.phase, 'evidence_open');
    assert.equal(state.subphase, 'inspection_evidence');

    const unloadedManifest = JSON.parse(JSON.stringify(loadedManifest));
    unloadedManifest.items.forEach(item => { item.status = 'unloaded'; });
    apply('CARGO_STATE_CHANGED', { manifest: unloadedManifest });
    const result = {
        ready: true,
        blockingUnload: [],
        missingLogFields: [],
        offences: [],
        equipment: [
            { id: 'bordbuch', label: 'Bordbuch', status: 'logged', log: { flightId, startAt: 100, landingAt: 200 } },
            { id: 'fire-extinguisher', label: 'Feuerloescher', status: 'valid', expiresAt: '2099-12-31' },
            { id: 'first-aid', label: 'Verbandzeug', status: 'valid', expiresAt: '2099-12-31' }
        ],
        completedAt: 1010,
        warningCount: 0,
        entryCount: 0
    };
    apply('COMPLIANCE_EVENT', {
        action: 'evidence_complete',
        state: {
            ...state.workflows.complianceInspection,
            phase: 'result_playing',
            result,
            resultText: 'Exakter Ergebnistext'
        }
    });
    assert.equal(state.workflows.complianceInspection.phase, 'result_playing');
    assert.equal(state.effects.at(-1).type, 'voice.compliance_result');

    apply('COMPLIANCE_RESULT_COMPLETED');
    assert.equal(state.workflows.complianceInspection.phase, 'departing');
    assert.equal(state.effects.at(-1).type, 'scene.compliance_departure');
    apply('COMPLIANCE_RELEASED');
    assert.equal(state.workflows.complianceInspection.phase, 'released');
    assert.equal(state.phase, 'closing');
    assert.equal(state.effects.at(-1).type, 'mission.close_requested');
});

test('browser-global and Node exports replay the same bundle to the same state hash', () => {
    const payloadSource = fs.readFileSync(path.join(__dirname, 'mission-payload-core.js'), 'utf8');
    const complianceSource = fs.readFileSync(path.join(__dirname, 'mission-compliance-domain-core.js'), 'utf8');
    const source = fs.readFileSync(path.join(__dirname, 'mission-execution-core.js'), 'utf8');
    const context = vm.createContext({ console, setTimeout, clearTimeout });
    vm.runInContext(payloadSource, context, { filename: 'mission-payload-core.js' });
    vm.runInContext(complianceSource, context, { filename: 'mission-compliance-domain-core.js' });
    vm.runInContext(source, context, { filename: 'mission-execution-core.js' });
    const browserCore = context.GAMissionExecutionCore;
    assert.ok(browserCore);
    const bundle = core.createExecutionBundle(makeLegacyBundle());
    const events = [
        { eventId: 'browser-1', type: 'PREPARE_REQUESTED', sequence: 1, occurredAt: 1000 },
        { eventId: 'browser-2', type: 'BOARDING_STARTED', sequence: 2, occurredAt: 1010 },
        { eventId: 'browser-3', type: 'LOAD_CONFIRMED', sequence: 3, occurredAt: 1020 },
        { eventId: 'browser-4', type: 'BOARDING_CONFIRMED', sequence: 4, occurredAt: 1030 }
    ];
    const nodeResult = core.replay(bundle, events);
    const browserResult = browserCore.replay(JSON.parse(JSON.stringify(bundle)), JSON.parse(JSON.stringify(events)));
    assert.equal(browserResult.stateHash, nodeResult.stateHash);
    assert.equal(browserCore.canonicalStringify(browserResult.state), core.canonicalStringify(nodeResult.state));
    assert.equal(browserCore.createShadowEnvelope(makeLegacyBundle(), { sourceRevision: 7 }).stateHash,
        core.createShadowEnvelope(makeLegacyBundle(), { sourceRevision: 7 }).stateHash);
});

test('versioned state serialization and snapshot import survive recovery without side effects', () => {
    const initial = core.projectLegacyBundle(makeLegacyBundle());
    const restored = core.deserializeState(core.serializeState(initial));
    assert.equal(core.stateHash(restored), core.stateHash(initial));
    assert.equal(core.deserializeState('{"version":999}'), null);

    const activeBundle = makeLegacyBundle({
        runtime: {
            runtime: { phase: 'enroute', active: true, startedAt: 1234 },
            flightRecorder: { hadAirbornePhase: true, airborneEvidenceSec: 45 }
        }
    });
    const imported = core.reduce(initial, {
        eventId: 'snapshot-import-1',
        type: 'AUTHORITATIVE_SNAPSHOT_IMPORTED',
        sequence: 1,
        occurredAt: 2000,
        payload: { resumeBundle: activeBundle }
    });
    assert.equal(imported.phase, 'enroute');
    assert.equal(imported.flags.active, true);
    assert.equal(imported.progress.airborneSeen, true);
    assert.equal(imported.effects.length, 0);
    assert.equal(imported.revision, 1);
});

test('browser shell and tracker wire the shared core additively behind existing authority snapshots', () => {
    const indexSource = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
    const syncSource = fs.readFileSync(path.join(__dirname, 'sync.js'), 'utf8');
    const serviceWorkerSource = fs.readFileSync(path.join(__dirname, 'sw.js'), 'utf8');
    const appSource = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');
    const cargoSource = fs.readFileSync(path.join(__dirname, 'mission-cargo-core.js'), 'utf8');
    const trackerSource = fs.readFileSync(path.join(__dirname, 'ga-tracker-client', 'tracker.js'), 'utf8');
    assert.ok(indexSource.indexOf('mission-location-core.js') < indexSource.indexOf('mission-runtime-core.js'));
    assert.ok(indexSource.indexOf('mission-manifest-core.js') < indexSource.indexOf('mission-cargo-core.js'));
    assert.ok(indexSource.indexOf('mission-start-core.js') < indexSource.indexOf('mission-execution-core.js'));
    assert.ok(indexSource.indexOf('mission-execution-core.js') < indexSource.indexOf('mission-execution-shadow-journal.js'));
    assert.ok(indexSource.indexOf('mission-execution-shadow-journal.js') < indexSource.indexOf('sync.js?v='));
    assert.match(serviceWorkerSource, /ga-dispatcher-v1702/);
    assert.match(serviceWorkerSource, /\.\/mission-manifest-core\.js/);
    assert.match(serviceWorkerSource, /\.\/mission-start-core\.js/);
    assert.match(serviceWorkerSource, /\.\/mission-location-core\.js/);
    assert.match(serviceWorkerSource, /\.\/mission-execution-core\.js/);
    assert.match(serviceWorkerSource, /\.\/mission-execution-shadow-journal\.js/);
    assert.match(cargoSource, /core\.planItemTransition\(manifest/);
    assert.match(cargoSource, /core\.commitItemTransition\(manifest, plan\)/);
    assert.match(cargoSource, /core\.planSignatureTransition\(manifest/);
    assert.match(cargoSource, /core\.commitSignatureTransition\(manifest, signaturePlan\)/);
    assert.match(syncSource, /GAMissionExecutionCore\.createShadowEnvelope/);
    assert.match(syncSource, /GAMissionExecutionCore\.createReplayShadowEnvelope/);
    assert.match(syncSource, /bundle\.executionReplay = advanced\.bundle/);
    assert.match(syncSource, /bundle\.execution = envelope/);
    assert.match(syncSource, /ga\.mission-apt-effect-plan\.v1/);
    assert.match(syncSource, /executionEffectPlan: adapter === 'apt'/);
    assert.match(syncSource, /activeMissionTrackerSeed: _syncTrackerMissionSeedPayload\(activeMission\)/);
    assert.match(appSource, /missionRuntimeReset\(\);[\s\S]*?queueActiveMissionCloudSave\('mission-accepted-tracker-seed', \{ delayMs: 0 \}\)/);
    assert.match(syncSource, /function _trackerMissionBannerModel\(control = null\)/);
    assert.match(syncSource, /activate_cloud_mission/);
    const authorityCommandClassifierSource = syncSource.match(/function _isMissionAuthorityProtocolCommandType\(commandType = ''\) \{[\s\S]*?\n\}/)?.[0];
    assert.ok(authorityCommandClassifierSource);
    const isMissionAuthorityProtocolCommandType = new Function(`return (${authorityCommandClassifierSource});`)();
    assert.equal(isMissionAuthorityProtocolCommandType('mission_authority_acquire'), true);
    assert.equal(isMissionAuthorityProtocolCommandType('mission_snapshot_update'), true);
    assert.equal(isMissionAuthorityProtocolCommandType('mission_execution_authority_prepare'), true);
    assert.equal(isMissionAuthorityProtocolCommandType('mission_execution_authority_commit'), true);
    assert.equal(isMissionAuthorityProtocolCommandType('mission_execution_authority_rollback'), true);
    assert.equal(isMissionAuthorityProtocolCommandType('mission_scene_spawn'), false);
    assert.match(syncSource, /const missionAuthorityProtocol = _isMissionAuthorityProtocolCommandType\(commandType\)/);
    assert.match(syncSource, /if \(missionScopedCommand \|\| missionAuthorityProtocol\) \{\s*_rememberMissionAuthorityLocalCommand\(commandId, commandType\);/);
    assert.match(syncSource, /_missionSceneBuildSpawnEffectCommand/);
    assert.match(syncSource, /_missionSceneBuildBoardingEffectCommand/);
    assert.match(cargoSource, /function _missionCargoTrackerIntentAllowed\(intent = ''\)/);
    assert.match(cargoSource, /GAMissionManifestCore/);
    assert.match(cargoSource, /deriveGateState/);
    assert.match(cargoSource, /if \(!_missionCargoTrackerIntentAllowed\('set_manifest_item'\)\)[\s\S]*?gaTrackerExecutionSubmitIntent/);
    assert.match(cargoSource, /if \(!_missionCargoTrackerIntentAllowed\(trackerIntent\)\)[\s\S]*?gaTrackerExecutionSubmitIntent/);
    assert.match(cargoSource, /window\.missionCargoToggleItemLoadState[\s\S]*?window\.gaTrackerExecutionHandlesMission/);
    assert.match(cargoSource, /mission-cargo-tracker-lock/);
    assert.match(cargoSource, /trackerPrimaryAllowed/);
    assert.match(syncSource, /window\.gaAbortTrackerMission = async function/);
    assert.match(syncSource, /_applyTrackerExecutionAbortLocally/);
    assert.match(syncSource, /skipAuthorityRelease/);
    assert.match(syncSource, /_missionSceneBuildDeboardingEffectCommand/);
    assert.match(trackerSource, /createTrackerMissionShadow/);
    assert.match(trackerSource, /observeAuthorityResult/);
    assert.match(trackerSource, /executionShadow: trackerMissionShadow\.publicState\(\)/);
    assert.match(trackerSource, /VFR_MULTITOOL_APT_EXECUTION/);
    assert.match(trackerSource, /missionExecutionCore\.TRACKER_AUTHORITY_READY === true/);
    assert.match(trackerSource, /createTrackerMissionExecutionRuntime/);
    assert.match(trackerSource, /missionExecutionRuntime\.observeTelemetry/);
    assert.match(trackerSource, /fetchTrackerCloudMission/);
    assert.match(trackerSource, /activateCloudMission/);
});

test('remote Origin handoff uses the tracker relay without requiring a loopback cockpit session', async () => {
    const syncSource = fs.readFileSync(path.join(__dirname, 'sync.js'), 'utf8');
    const relaySelectorSource = syncSource.match(/function _trackerExecutionUsesRelayController\(\) \{[\s\S]*?\n\}/)?.[0];
    const handoffSource = syncSource.match(/async function _ensureTrackerExecutionAuthority\(reason = 'apt-ui-intent'\) \{[\s\S]*?\n\}\n\nfunction _publishMissionControlIntentStatus/)?.[0]
        .replace(/\n\nfunction _publishMissionControlIntentStatus$/, '');
    assert.ok(relaySelectorSource);
    assert.ok(handoffSource);

    let loopbackStarts = 0;
    const authorityCommands = [];
    const window = {
        simModeActive: false,
        liveTrackerConnected: true,
        sendTrackerCommand() {},
        gaCockpitSessionClient: {
            async start() {
                loopbackStarts += 1;
                throw new Error('Quest darf den PC-Loopback nicht erreichen');
            },
            async submitIntent() {}
        },
        lastTrackerMissionAuthority: null,
        lastTrackerMissionStatus: null
    };
    const seededRun = {
        missionId: 'mission-quest-apt',
        runId: 'run-quest-apt',
        revision: 20,
        stateHash: 'state-20',
        executionStateHash: 'execution-20'
    };
    const context = vm.createContext({
        window,
        missionExecutionHandoffPromise: null,
        _missionExecutionAuthorityIsTracker: () => false,
        _trackerSupportsMissionIntents: () => true,
        _missionStartPhase: () => 'planned',
        _ensureMissionAuthorityForStart: async () => true,
        _pushMissionAuthoritySnapshotForExecutionHandoff: async () => ({
            status: 'ok',
            authoritativeRun: seededRun
        }),
        _missionAuthorityClientId: () => 'quest-origin-client',
        _sendMissionAuthorityRequest: async command => {
            authorityCommands.push(command.type);
            if (command.type === 'mission_execution_authority_prepare') {
                return {
                    status: 'ok',
                    handoff: { handoffId: 'handoff-quest' },
                    authoritativeRun: { ...seededRun, revision: 21 }
                };
            }
            return {
                status: 'ok',
                authoritativeRun: { ...seededRun, revision: 22, executionAuthority: 'tracker' }
            };
        },
        _refreshTrackerExecutionControl: async () => null,
        Date
    });
    vm.runInContext(`${relaySelectorSource}\n${handoffSource}\nthis.ensureTrackerAuthority = _ensureTrackerExecutionAuthority;`, context);

    assert.equal(await context.ensureTrackerAuthority('quest-start'), true);
    assert.equal(loopbackStarts, 0);
    assert.deepEqual(authorityCommands, [
        'mission_execution_authority_prepare',
        'mission_execution_authority_commit'
    ]);
    assert.equal(window.lastTrackerMissionStatus.executionAuthority, 'tracker');
});
