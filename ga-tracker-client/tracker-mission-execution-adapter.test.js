'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const executionCore = require('../mission-execution-core.js');
const { createMissionAuthorityManager } = require('./mission-authority-core.js');
const { createTrackerMissionExecutionAdapter } = require('./tracker-mission-execution-adapter.js');

function aptResumeBundle() {
  const bundle = {
    version: 2,
    missionId: 'mission-apt-adapter',
    adapter: 'apt',
    descriptor: { primaryAdapter: 'apt' },
    missionState: {
      currentMissionData: {
        missionId: 'mission-apt-adapter',
        missionType: 'apt',
        start: 'EDTW',
        dest: 'EDTL',
        aptArrivalPlan: {
          lat: 48.3001,
          lon: 8.5001
        },
        routeWaypoints: [
          { lat: 48, lon: 8, name: 'EDTW' },
          { lat: 48.3, lon: 8.5, name: 'EDTL' }
        ]
      }
    },
    runtime: {
      version: 1,
      missionId: 'mission-apt-adapter',
      startPhase: 'planned',
      runtime: {
        missionId: 'mission-apt-adapter',
        phase: 'planned',
        active: false,
        closingPending: false
      },
      cargoManifest: {
        version: 6,
        key: 'manifest-apt-adapter',
        items: [
          {
            id: 'medical-box',
            itemType: 'cargo',
            required: true,
            status: 'pending',
            weightLbs: 42,
            deliverAtDestination: true
          }
        ]
      }
    }
  };
  bundle.executionReplay = executionCore.createExecutionBundle(bundle);
  bundle.execution = executionCore.createReplayShadowEnvelope(bundle.executionReplay, {
    sourceRevision: 1,
    legacyBundle: bundle
  });
  return bundle;
}

function createCommittedFixture(t, options = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ga-tracker-execution-adapter-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  let clock = 1000;
  const managerOptions = {
    storageFile: path.join(directory, 'authority.json'),
    now: () => clock,
    idFactory: () => 'run-adapter-1',
    executionAuthorityEnabled: true
  };
  const manager = createMissionAuthorityManager(managerOptions);
  const bundle = options.bundle || aptResumeBundle();
  const replay = executionCore.replay(bundle.executionReplay);
  const acquired = manager.acquire({
    missionId: bundle.missionId,
    clientId: 'web-owner',
    stateHash: 'web-state-hash',
    resumeBundle: bundle
  });
  const prepared = manager.prepareExecutionAuthority({
    missionId: acquired.activeRun.missionId,
    runId: acquired.activeRun.runId,
    clientId: 'web-owner',
    expectedRevision: acquired.activeRun.revision,
    expectedStateHash: acquired.activeRun.stateHash,
    expectedExecutionStateHash: replay.stateHash,
    commandId: 'prepare-handoff'
  });
  const committed = manager.commitExecutionAuthority({
    missionId: prepared.activeRun.missionId,
    runId: prepared.activeRun.runId,
    clientId: 'web-owner',
    expectedRevision: prepared.activeRun.revision,
    expectedExecutionStateHash: prepared.activeRun.executionStateHash,
    handoffId: prepared.handoff.handoffId,
    commandId: 'commit-handoff'
  });
  assert.equal(committed.ok, true);
  return {
    manager,
    adapter: createTrackerMissionExecutionAdapter({ authorityManager: manager, now: () => clock }),
    setClock(value) { clock = value; }
  };
}

function executeCurrent(fixture, intent, commandId, payload = {}) {
  const run = fixture.manager.getActiveRun();
  return fixture.adapter.executeIntent({
    commandId,
    intent,
    missionId: run.missionId,
    runId: run.runId,
    expectedRevision: run.revision,
    payload
  });
}

function systemCurrent(fixture, type, eventId) {
  const run = fixture.manager.getActiveRun();
  return fixture.adapter.applySystemEvent({
    type,
    eventId,
    missionId: run.missionId,
    runId: run.runId,
    expectedRevision: run.revision
  });
}

test('internal execution snapshot is normalized and contains no resume or owner payload', (t) => {
  const fixture = createCommittedFixture(t);
  const snapshot = fixture.manager.getExecutionSnapshot();

  assert.equal(snapshot.schema, 'ga.mission-execution-authority-snapshot.v1');
  assert.equal(snapshot.executionAuthority, 'tracker');
  assert.equal(snapshot.recipe, 'apt');
  assert.equal(snapshot.state.phase, 'planned');
  assert.deepEqual(snapshot.location, {
    schema: 'ga.mission-location.apt.v1',
    arrivalPoint: { lat: 48.3001, lon: 8.5001 },
    missionTarget: { lat: 48.3, lon: 8.5 },
    policy: {
      schema: 'ga.mission-location-policy.apt.v1',
      source: 'default',
      arrivalRadiusNm: 0.16,
      airportFallbackRadiusNm: 0.35,
      missionTargetRadiusNm: 1.2
    }
  });
  assert.deepEqual(snapshot.view.allowedActions, ['abort_mission', 'prepare_mission', 'reset_mission']);
  assert.equal(Object.hasOwn(snapshot, 'resumeBundle'), false);
  assert.equal(Object.hasOwn(snapshot, 'ownerClientId'), false);
  assert.equal(Object.hasOwn(snapshot.state, 'missionState'), false);
  snapshot.state.phase = 'closed';
  assert.equal(fixture.manager.getExecutionSnapshot().state.phase, 'planned');
});

test('authority snapshot accepts only a complete bounded APT location policy', (t) => {
  const customBundle = aptResumeBundle();
  customBundle.missionState.currentMissionData.executionLocationPolicy = {
    schema: 'ga.mission-location-policy.apt.v1',
    arrivalRadiusNm: 0.25,
    airportFallbackRadiusNm: 0.5,
    missionTargetRadiusNm: 1.5
  };
  const custom = createCommittedFixture(t, { bundle: customBundle }).manager.getExecutionSnapshot();
  assert.equal(custom.location.policy.source, 'mission');
  assert.equal(custom.location.policy.arrivalRadiusNm, 0.25);

  const invalidBundle = aptResumeBundle();
  invalidBundle.missionState.currentMissionData.executionLocationPolicy = {
    schema: 'ga.mission-location-policy.apt.v1',
    arrivalRadiusNm: 20,
    airportFallbackRadiusNm: 20,
    missionTargetRadiusNm: 20
  };
  const invalid = createCommittedFixture(t, { bundle: invalidBundle }).manager.getExecutionSnapshot();
  assert.equal(invalid.location.policy.source, 'default');
  assert.equal(invalid.location.policy.arrivalRadiusNm, 0.16);
});

test('APT intents and system acknowledgements create only gated semantic core events', (t) => {
  const fixture = createCommittedFixture(t);

  const prepared = executeCurrent(fixture, 'prepare_mission', 'prepare');
  assert.equal(prepared.ok, true);
  assert.equal(prepared.view.phase, 'prepare');
  assert.equal(prepared.effectsPending[0].type, 'scene.prepare');

  const freeSystemEvent = systemCurrent(fixture, 'MISSION_STARTED', 'free-start');
  assert.equal(freeSystemEvent.error, 'mission_system_event_not_allowed');

  const boarding = systemCurrent(fixture, 'BOARDING_STARTED', 'scene-boarding-started');
  assert.equal(boarding.ok, true);
  assert.equal(boarding.view.phase, 'boarding');

  const earlyLoad = executeCurrent(fixture, 'confirm_load', 'early-load');
  assert.equal(earlyLoad.error, 'mission_intent_not_allowed_in_state');

  const loaded = executeCurrent(fixture, 'set_manifest_item', 'load-box', {
    itemId: 'medical-box',
    action: 'load'
  });
  assert.equal(loaded.ok, true);
  assert.equal(loaded.view.cargo.departureMissing, 0);
  assert.equal(fixture.manager.getExecutionSnapshot().state.cargo.signatureScope, null);

  const signed = executeCurrent(fixture, 'sign_manifest', 'sign-departure');
  assert.equal(signed.ok, true);
  assert.equal(fixture.manager.getExecutionSnapshot().state.cargo.signatureScope, 'departure');

  const loadConfirmed = executeCurrent(fixture, 'confirm_load', 'confirm-load');
  assert.equal(loadConfirmed.ok, true);
  assert.equal(loadConfirmed.view.phase, 'boarding');

  const boarded = systemCurrent(fixture, 'BOARDING_CONFIRMED', 'scene-boarding-confirmed');
  assert.equal(boarded.ok, true);
  assert.equal(boarded.view.phase, 'boarded');

  const started = executeCurrent(fixture, 'start_mission', 'start');
  assert.equal(started.ok, true);
  assert.equal(started.view.phase, 'active');

  const deferred = executeCurrent(fixture, 'request_voice_playback', 'voice');
  assert.equal(deferred.error, 'mission_intent_not_migrated');
  assert.equal(deferred.sideEffect, false);

  const replay = executionCore.replay(fixture.manager.getActiveRun({ includeBundle: true }).resumeBundle.executionReplay);
  assert.equal(replay.ok, true);
  assert.equal(replay.stateHash, fixture.manager.getActiveRun().executionStateHash);
  assert.deepEqual(replay.acceptedEvents.map(event => event.type), [
    'PREPARE_REQUESTED',
    'BOARDING_STARTED',
    'CARGO_STATE_CHANGED',
    'CARGO_STATE_CHANGED',
    'LOAD_CONFIRMED',
    'BOARDING_CONFIRMED',
    'MISSION_STARTED'
  ]);
});

test('tracker telemetry requires stable evidence and drives APT landing and close flow', (t) => {
  const fixture = createCommittedFixture(t);
  executeCurrent(fixture, 'prepare_mission', 'prepare');
  systemCurrent(fixture, 'BOARDING_STARTED', 'boarding-started');
  executeCurrent(fixture, 'set_manifest_item', 'load-box', { itemId: 'medical-box', action: 'load' });
  executeCurrent(fixture, 'sign_manifest', 'sign-departure');
  executeCurrent(fixture, 'confirm_load', 'confirm-load');
  systemCurrent(fixture, 'BOARDING_CONFIRMED', 'boarding-confirmed');
  executeCurrent(fixture, 'start_mission', 'start');

  let result = fixture.adapter.observeTelemetry({ observedAt: 10000, lat: 48.1, lon: 8.2, onGround: false, gsKts: 55 });
  assert.equal(result.status, 'pending');
  assert.equal(result.reason, 'airborne_evidence');
  result = fixture.adapter.observeTelemetry({ observedAt: 11999, lat: 48.1, lon: 8.2, onGround: false, gsKts: 70 });
  assert.equal(result.status, 'pending');
  result = fixture.adapter.observeTelemetry({ observedAt: 12000, lat: 48.1, lon: 8.2, onGround: false, gsKts: 75 });
  assert.equal(result.ok, true);
  assert.equal(result.acceptedEvent.type, 'AIRBORNE');
  assert.equal(result.view.phase, 'enroute');

  result = fixture.adapter.observeTelemetry({ observedAt: 13000, lat: 48, lon: 8, onGround: true, gsKts: 28 });
  assert.equal(result.acceptedEvent.type, 'TOUCHDOWN');
  assert.equal(result.view.phase, 'enroute');

  result = fixture.adapter.observeTelemetry({ observedAt: 14000, lat: 48, lon: 8, onGround: true, gsKts: 0.5, atDestination: true });
  assert.equal(result.status, 'pending');
  result = fixture.adapter.observeTelemetry({ observedAt: 17000, lat: 48, lon: 8, onGround: true, gsKts: 0.2, atDestination: true });
  assert.equal(result.acceptedEvent.type, 'GROUND_STILL');
  assert.equal(result.destination.atDestination, false);
  assert.equal(result.view.phase, 'enroute');

  result = fixture.adapter.observeTelemetry({ observedAt: 18000, lat: 48.05, lon: 8.1, onGround: false, gsKts: 50 });
  assert.equal(result.status, 'pending');
  result = fixture.adapter.observeTelemetry({ observedAt: 20000, lat: 48.1, lon: 8.2, onGround: false, gsKts: 65 });
  assert.equal(result.acceptedEvent.type, 'AIRBORNE');
  result = fixture.adapter.observeTelemetry({ observedAt: 21000, lat: 48.3001, lon: 8.5001, onGround: true, gsKts: 28 });
  assert.equal(result.acceptedEvent.type, 'TOUCHDOWN');

  result = fixture.adapter.observeTelemetry({ observedAt: 22000, lat: 48.3001, lon: 8.5001, onGround: true, gsKts: 0.5 });
  assert.equal(result.status, 'pending');
  result = fixture.adapter.observeTelemetry({
    observedAt: 26000,
    lat: 48.3001,
    lon: 8.5001,
    onGround: true,
    gsKts: 0.2,
    simPaused: true
  });
  assert.equal(result.status, 'ignored');
  result = fixture.adapter.observeTelemetry({ observedAt: 27000, lat: 48.3001, lon: 8.5001, onGround: true, gsKts: 0.2 });
  assert.equal(result.status, 'pending');
  result = fixture.adapter.observeTelemetry({ observedAt: 30000, lat: 48.3001, lon: 8.5001, onGround: true, gsKts: 0.1 });
  assert.equal(result.acceptedEvent.type, 'GROUND_STILL');
  assert.equal(result.destination.reason, 'apt_arrival_point');
  assert.equal(result.view.phase, 'end_unloading');

  const unloaded = executeCurrent(fixture, 'set_manifest_item', 'unload-box', {
    itemId: 'medical-box',
    action: 'unload'
  });
  assert.equal(unloaded.ok, true);
  assert.equal(unloaded.view.cargo.destinationRemaining, 0);
  assert.equal(fixture.manager.getExecutionSnapshot().state.cargo.signatureScope, null);

  assert.equal(executeCurrent(fixture, 'sign_manifest', 'sign-arrival').ok, true);
  const unloadConfirmed = executeCurrent(fixture, 'confirm_unload', 'confirm-unload');
  assert.equal(unloadConfirmed.ok, true);
  assert.equal(unloadConfirmed.view.phase, 'end_ready');

  const prematureCloseAck = systemCurrent(fixture, 'MISSION_CLOSED', 'premature-close');
  assert.equal(prematureCloseAck.error, 'mission_close_not_requested');

  const closing = executeCurrent(fixture, 'request_close', 'close');
  assert.equal(closing.ok, true);
  assert.equal(closing.view.phase, 'closing');
  assert.equal(closing.effectsPending[0].type, 'mission.close_requested');
  const closed = systemCurrent(fixture, 'MISSION_CLOSED', 'mission-closed');
  assert.equal(closed.ok, true);
  assert.equal(closed.view.phase, 'closed');
});

test('adapter rejects web authority, stale revisions and passenger cargo mutation', (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ga-tracker-execution-web-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const manager = createMissionAuthorityManager({
    storageFile: path.join(directory, 'authority.json'),
    now: () => 1000,
    idFactory: () => 'run-web'
  });
  const bundle = aptResumeBundle();
  const acquired = manager.acquire({
    missionId: bundle.missionId,
    clientId: 'web-owner',
    stateHash: 'web-state-hash',
    resumeBundle: bundle
  });
  const adapter = createTrackerMissionExecutionAdapter({ authorityManager: manager, now: () => 1000 });
  const blocked = adapter.executeIntent({
    commandId: 'prepare',
    intent: 'prepare_mission',
    missionId: acquired.activeRun.missionId,
    runId: acquired.activeRun.runId,
    expectedRevision: acquired.activeRun.revision
  });
  assert.equal(blocked.error, 'mission_execution_authority_web');

  const fixture = createCommittedFixture(t);
  const stale = fixture.adapter.executeIntent({
    commandId: 'stale',
    intent: 'prepare_mission',
    missionId: fixture.manager.getActiveRun().missionId,
    runId: fixture.manager.getActiveRun().runId,
    expectedRevision: fixture.manager.getActiveRun().revision - 1
  });
  assert.equal(stale.status, 'conflict');
  assert.equal(stale.error, 'mission_revision_conflict');

  executeCurrent(fixture, 'prepare_mission', 'prepare');
  systemCurrent(fixture, 'BOARDING_STARTED', 'boarding-started');
  const snapshot = fixture.manager.getExecutionSnapshot();
  snapshot.state.cargo.items.push({
    id: 'passenger-one',
    itemType: 'passenger',
    status: 'pending',
    required: false,
    pickup: 'departure',
    delivery: 'destination',
    passengerCount: 1,
    weightLbs: 180,
    healthPct: 100
  });
  const injected = fixture.manager.applyExecutionEvent({
    missionId: snapshot.missionId,
    runId: snapshot.runId,
    expectedRevision: snapshot.authorityRevision,
    expectedExecutionRevision: snapshot.executionRevision,
    expectedExecutionStateHash: snapshot.executionStateHash,
    event: {
      eventId: 'test-passenger-state',
      type: 'CARGO_STATE_CHANGED',
      sequence: snapshot.executionRevision + 1,
      payload: { cargo: snapshot.state.cargo }
    }
  });
  assert.equal(injected.ok, true);
  const passenger = executeCurrent(fixture, 'set_manifest_item', 'load-passenger', {
    itemId: 'passenger-one',
    action: 'load'
  });
  assert.equal(passenger.error, 'mission_manifest_item_scene_required');
});
