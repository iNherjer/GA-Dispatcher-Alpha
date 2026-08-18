'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const core = require('./mission-execution-core.js');

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

test('legacy projection keeps only deterministic mission, cargo and workflow facts', () => {
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
    const serialized = JSON.stringify(state);
    assert.doesNotMatch(serialized, /Secret Pilot|Secret Passenger|Sensitive Cargo|Sensitive narrative/);
    assert.equal(core.stateHash(state), core.stateHash(core.normalizeState(state)));
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
        { eventId: 'evt-02', type: 'BOARDING_STARTED', sequence: 2, occurredAt: 110 },
        { eventId: 'evt-03', type: 'LOAD_CONFIRMED', sequence: 3, occurredAt: 120 },
        { eventId: 'evt-04', type: 'BOARDING_CONFIRMED', sequence: 4, occurredAt: 130 },
        { eventId: 'evt-05', type: 'MISSION_STARTED', sequence: 5, occurredAt: 140 },
        { eventId: 'evt-06', type: 'AIRBORNE', sequence: 6, occurredAt: 150 },
        { eventId: 'evt-07', type: 'TARGET_ENTERED', sequence: 7, occurredAt: 160 },
        { eventId: 'evt-08', type: 'TOUCHDOWN', sequence: 8, occurredAt: 170 },
        { eventId: 'evt-09', type: 'GROUND_STILL', sequence: 9, occurredAt: 180 },
        { eventId: 'evt-10', type: 'UNLOAD_CONFIRMED', sequence: 10, occurredAt: 190, payload: { cargo: unloadedCargo } },
        { eventId: 'evt-11', type: 'CLOSE_REQUESTED', sequence: 11, occurredAt: 200 },
        { eventId: 'evt-12', type: 'MISSION_CLOSED', sequence: 12, occurredAt: 210 },
        { eventId: 'evt-12', type: 'MISSION_CLOSED', sequence: 12, occurredAt: 210 }
    ];
    const first = core.replay(executionBundle, events);
    const second = core.replay(JSON.parse(JSON.stringify(executionBundle)), JSON.parse(JSON.stringify(events)));
    assert.equal(first.ok, true);
    assert.equal(first.state.phase, 'closed');
    assert.equal(first.state.flags.closed, true);
    assert.equal(first.state.revision, 12);
    assert.equal(first.rejectedEvents.at(-1).reason, 'duplicate_event');
    assert.equal(first.stateHash, second.stateHash);
    assert.deepEqual(first.effects, second.effects);
    assert.equal(new Set(first.effects.map(effect => effect.effectId)).size, first.effects.length);
    assert.equal(first.effects.some(effect => effect.type === 'mission.close_requested'), true);
    assert.equal(first.effects.every(effect => effect.status === 'requested'), true);
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
    assert.deepEqual(core.allowedActions(replay.state), ['abort_mission', 'prepare_mission', 'reset_mission']);
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

test('browser-global and Node exports replay the same bundle to the same state hash', () => {
    const source = fs.readFileSync(path.join(__dirname, 'mission-execution-core.js'), 'utf8');
    const context = vm.createContext({ console, setTimeout, clearTimeout });
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
    const trackerSource = fs.readFileSync(path.join(__dirname, 'ga-tracker-client', 'tracker.js'), 'utf8');
    assert.ok(indexSource.indexOf('mission-execution-core.js') < indexSource.indexOf('mission-execution-shadow-journal.js'));
    assert.ok(indexSource.indexOf('mission-execution-shadow-journal.js') < indexSource.indexOf('sync.js?v=mission-shadow'));
    assert.match(serviceWorkerSource, /ga-dispatcher-v1682/);
    assert.match(serviceWorkerSource, /\.\/mission-execution-core\.js/);
    assert.match(serviceWorkerSource, /\.\/mission-execution-shadow-journal\.js/);
    assert.match(syncSource, /GAMissionExecutionCore\.createShadowEnvelope/);
    assert.match(syncSource, /GAMissionExecutionCore\.createReplayShadowEnvelope/);
    assert.match(syncSource, /bundle\.executionReplay = advanced\.bundle/);
    assert.match(syncSource, /bundle\.execution = envelope/);
    assert.match(trackerSource, /createTrackerMissionShadow/);
    assert.match(trackerSource, /observeAuthorityResult/);
    assert.match(trackerSource, /executionShadow: trackerMissionShadow\.publicState\(\)/);
});
