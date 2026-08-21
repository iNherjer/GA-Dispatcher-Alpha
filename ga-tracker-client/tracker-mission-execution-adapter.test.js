'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const executionCore = require('../mission-execution-core.js');
const farewellVoiceCore = require('../mission-farewell-voice-core.js');
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
      lastLiveFlightData: {
        onGround: true,
        gsKts: 0,
        simPaused: false,
        inMenuOrMap: false
      },
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
    managerOptions,
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

function acknowledgePayloadCurrent(fixture, suffix = 'test') {
  return systemCurrent(fixture, 'LOAD_CONFIRMED', `payload-confirmed-${suffix}`);
}

function acknowledgeBoardingCurrent(fixture, suffix = 'test') {
  const scene = systemCurrent(fixture, 'BOARDING_SCENE_CONFIRMED', `boarding-scene-confirmed-${suffix}`);
  assert.equal(scene.ok, true, JSON.stringify(scene));
  const voicePending = fixture.manager.getExecutionSnapshot().state.effects.some(effect => (
    effect.type === 'voice.boarding' && effect.status === 'requested'
  ));
  return voicePending
    ? systemCurrent(fixture, 'BOARDING_CONFIRMED', `boarding-voice-confirmed-${suffix}`)
    : scene;
}

function acknowledgeFirstPendingEffect(fixture, suffix = 'test') {
  const snapshot = fixture.manager.getExecutionSnapshot();
  const effect = snapshot.state.effects.find(candidate => candidate.status === 'requested');
  assert.ok(effect, 'expected a pending mission effect');
  const result = fixture.manager.applyExecutionEvent({
    missionId: snapshot.missionId,
    runId: snapshot.runId,
    expectedRevision: snapshot.authorityRevision,
    expectedExecutionRevision: snapshot.executionRevision,
    expectedExecutionStateHash: snapshot.executionStateHash,
    event: {
      eventId: `${effect.effectId}:ack:${suffix}`,
      type: 'EFFECT_ACKNOWLEDGED',
      sequence: snapshot.executionRevision + 1,
      payload: { effectId: effect.effectId, status: 'completed' }
    }
  });
  assert.equal(result.ok, true);
  return result;
}

function beginBoarding(fixture, suffix = 'test') {
  acknowledgeFirstPendingEffect(fixture, `prepare-${suffix}`);
  return executeCurrent(fixture, 'start_boarding', `start-boarding-${suffix}`);
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

  const boarding = beginBoarding(fixture, 'semantic');
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
  assert.equal(loadConfirmed.effectsPending[0].type, 'payload.sync_before_start');
  assert.equal(acknowledgePayloadCurrent(fixture, 'semantic').ok, true);

  const boarded = acknowledgeBoardingCurrent(fixture, 'semantic');
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
    'EFFECT_ACKNOWLEDGED',
    'BOARDING_STARTED',
    'CARGO_STATE_CHANGED',
    'CARGO_STATE_CHANGED',
    'LOAD_CONFIRMATION_REQUESTED',
    'LOAD_CONFIRMED',
    'BOARDING_SCENE_CONFIRMED',
    'BOARDING_CONFIRMED',
    'MISSION_STARTED'
  ]);
});

test('tracker manifest follows the app toggle, signature reset and confirmation rules', (t) => {
  const fixture = createCommittedFixture(t);
  executeCurrent(fixture, 'prepare_mission', 'prepare-toggle');
  beginBoarding(fixture, 'toggle');

  assert.equal(executeCurrent(fixture, 'set_manifest_item', 'load-toggle', {
    itemId: 'medical-box', action: 'load'
  }).ok, true);
  assert.equal(executeCurrent(fixture, 'sign_manifest', 'sign-toggle').ok, true);
  assert.equal(executeCurrent(fixture, 'clear_manifest_signature', 'clear-toggle').ok, true);
  assert.equal(fixture.manager.getExecutionSnapshot().state.cargo.signatureScope, null);
  assert.equal(executeCurrent(fixture, 'set_manifest_item', 'unload-toggle', {
    itemId: 'medical-box', action: 'unload'
  }).ok, true);
  assert.equal(fixture.manager.getExecutionSnapshot().state.cargo.summary.departureMissing, 1);
  assert.equal(executeCurrent(fixture, 'set_manifest_item', 'reload-toggle', {
    itemId: 'medical-box', action: 'load'
  }).ok, true);
  assert.equal(executeCurrent(fixture, 'sign_manifest', 'resign-toggle').ok, true);
  assert.equal(executeCurrent(fixture, 'confirm_load', 'confirm-toggle').ok, true);
  assert.equal(acknowledgePayloadCurrent(fixture, 'toggle').ok, true);
  acknowledgeBoardingCurrent(fixture, 'toggle');
  assert.equal(executeCurrent(fixture, 'start_mission', 'start-toggle').ok, true);

  fixture.adapter.observeTelemetry({ observedAt: 10000, lat: 48.1, lon: 8.2, onGround: false, gsKts: 60 });
  fixture.adapter.observeTelemetry({ observedAt: 12000, lat: 48.1, lon: 8.2, onGround: false, gsKts: 65 });
  fixture.adapter.observeTelemetry({ observedAt: 13000, lat: 48.3001, lon: 8.5001, onGround: true, gsKts: 20 });
  fixture.adapter.observeTelemetry({ observedAt: 14000, lat: 48.3001, lon: 8.5001, onGround: true, gsKts: 0 });
  fixture.adapter.observeTelemetry({ observedAt: 17000, lat: 48.3001, lon: 8.5001, onGround: true, gsKts: 0 });

  assert.equal(executeCurrent(fixture, 'set_manifest_item', 'arrival-unload', {
    itemId: 'medical-box', action: 'unload'
  }).ok, true);
  assert.equal(executeCurrent(fixture, 'set_manifest_item', 'arrival-reload', {
    itemId: 'medical-box', action: 'load'
  }).ok, true);
  assert.equal(executeCurrent(fixture, 'set_manifest_item', 'arrival-unload-again', {
    itemId: 'medical-box', action: 'unload'
  }).ok, true);
  assert.equal(executeCurrent(fixture, 'sign_manifest', 'arrival-sign').ok, true);
  assert.equal(fixture.manager.getExecutionSnapshot().view.allowedActions.includes('request_close'), false);
  assert.equal(executeCurrent(fixture, 'clear_manifest_signature', 'arrival-clear').ok, true);
  assert.equal(fixture.manager.getExecutionSnapshot().view.allowedActions.includes('confirm_unload'), false);
  assert.equal(executeCurrent(fixture, 'sign_manifest', 'arrival-resign').ok, true);
  assert.equal(executeCurrent(fixture, 'confirm_unload', 'arrival-confirm').ok, true);
  assert.equal(fixture.manager.getExecutionSnapshot().state.flags.unloadConfirmed, true);
  assert.equal(fixture.manager.getExecutionSnapshot().view.allowedActions.includes('request_close'), true);
  assert.equal(executeCurrent(fixture, 'confirm_unload', 'arrival-confirm-duplicate').error, 'mission_intent_not_allowed_in_state');
});

test('airborne unload follows the App drop transition and requests the latest payload state', (t) => {
  const fixture = createCommittedFixture(t);
  executeCurrent(fixture, 'prepare_mission', 'prepare-drop');
  beginBoarding(fixture, 'drop');
  assert.equal(executeCurrent(fixture, 'set_manifest_item', 'load-drop', {
    itemId: 'medical-box', action: 'load'
  }).ok, true);
  assert.equal(executeCurrent(fixture, 'sign_manifest', 'sign-drop').ok, true);
  assert.equal(executeCurrent(fixture, 'confirm_load', 'confirm-drop').ok, true);
  assert.equal(acknowledgePayloadCurrent(fixture, 'drop').ok, true);
  acknowledgeBoardingCurrent(fixture, 'drop');
  assert.equal(executeCurrent(fixture, 'start_mission', 'start-drop').ok, true);

  fixture.adapter.observeTelemetry({ observedAt: 10000, lat: 48.1, lon: 8.2, altFt: 2500, onGround: false, gsKts: 60 });
  const airborne = fixture.adapter.observeTelemetry({ observedAt: 12000, lat: 48.11, lon: 8.21, altFt: 2600, onGround: false, gsKts: 65 });
  assert.equal(airborne.acceptedEvent.type, 'AIRBORNE');
  assert.equal(airborne.view.allowedActions.includes('set_manifest_item'), true);

  const dropped = executeCurrent(fixture, 'set_manifest_item', 'drop-box', {
    itemId: 'medical-box', action: 'unload'
  });
  assert.equal(dropped.ok, true);
  const snapshot = fixture.manager.getExecutionSnapshot();
  const item = snapshot.state.manifest.items.find(candidate => candidate.id === 'medical-box');
  assert.equal(item.status, 'dropped');
  assert.equal(item.droppedLat, 48.11);
  assert.equal(item.droppedLon, 8.21);
  assert.equal(item.droppedAltFt, 2600);
  assert.equal(item.healthPct, 0);
  assert.equal(snapshot.state.cargo.summary.failed, true);
  const payloadEffect = snapshot.state.effects.find(effect => effect.sourceEventId === `${snapshot.runId}:intent:drop-box`
    && effect.type === 'payload.sync_manifest_state');
  assert.ok(payloadEffect);
  assert.equal(payloadEffect.payload.transition.action, 'drop');
  assert.equal(executeCurrent(fixture, 'set_manifest_item', 'reload-dropped-box', {
    itemId: 'medical-box', action: 'load'
  }).error, 'mission_manifest_load_not_allowed');
});

test('tracker telemetry requires stable evidence and drives APT landing and close flow', (t) => {
  const fixture = createCommittedFixture(t);
  executeCurrent(fixture, 'prepare_mission', 'prepare');
  beginBoarding(fixture, 'telemetry');
  executeCurrent(fixture, 'set_manifest_item', 'load-box', { itemId: 'medical-box', action: 'load' });
  executeCurrent(fixture, 'sign_manifest', 'sign-departure');
  executeCurrent(fixture, 'confirm_load', 'confirm-load');
  acknowledgePayloadCurrent(fixture, 'telemetry');
  acknowledgeBoardingCurrent(fixture, 'telemetry');
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
  assert.equal(closing.view.phase, 'end_ready');
  assert.equal(closing.view.nextStep, 'await_farewell');
  assert.equal(closing.effectsPending[0].type, 'voice.farewell');
  const farewellComplete = systemCurrent(fixture, 'FAREWELL_COMPLETED', 'farewell-complete');
  assert.equal(farewellComplete.ok, true);
  assert.equal(farewellComplete.view.phase, 'closing');
  assert.equal(farewellComplete.effectsPending.some(effect => effect.type === 'mission.close_requested'), true);
  const closed = systemCurrent(fixture, 'MISSION_CLOSED', 'mission-closed');
  assert.equal(closed.ok, true);
  assert.equal(closed.view.phase, 'closed');
  for (const pendingEffect of fixture.manager.getExecutionSnapshot().state.effects.filter(effect => effect.status === 'requested')) {
    const effectSnapshot = fixture.manager.getExecutionSnapshot();
    const acknowledged = fixture.manager.applyExecutionEvent({
      missionId: effectSnapshot.missionId,
      runId: effectSnapshot.runId,
      expectedRevision: effectSnapshot.authorityRevision,
      expectedExecutionRevision: effectSnapshot.executionRevision,
      expectedExecutionStateHash: effectSnapshot.executionStateHash,
      event: {
        eventId: `${pendingEffect.effectId}:ack:test`,
        type: 'EFFECT_ACKNOWLEDGED',
        sequence: effectSnapshot.executionRevision + 1,
        payload: { effectId: pendingEffect.effectId, status: 'completed' }
      }
    });
    assert.equal(acknowledged.ok, true);
  }
  const finalized = fixture.manager.finalizeExecutionRun({ commandId: 'finalize-test' });
  assert.equal(finalized.ok, true);
  const authority = fixture.manager.getPublicSnapshot();
  assert.equal(authority.activeRun, null);
  assert.equal(authority.execution, null);
  assert.equal(authority.lastRun.runId, finalized.releasedRun.runId);
  assert.equal(authority.lastExecution.phase, 'closed');
  assert.equal(authority.lastExecution.flags.closed, true);
});

test('tracker records the App flight facts privately and restores the Farewell context after restart', (t) => {
  const bundle = aptResumeBundle();
  bundle.executionEffectPlan = {
    schema: 'ga.mission-apt-effect-plan.v1',
    recipe: 'apt',
    missionId: bundle.missionId,
    effects: {
      'voice.farewell': {
        recipe: farewellVoiceCore.createRecipe({
          missionId: bundle.missionId,
          prompt: 'Veralteter Prompt aus dem Handoff.',
          speaker: { name: 'Mara', role: 'Fotografin', gender: 'female' }
        }),
        context: farewellVoiceCore.createContext({
          missionId: bundle.missionId,
          missionAudioKey: `farewell:${bundle.missionId}`,
          key: `farewell:${bundle.missionId}`,
          mode: 'passenger',
          baseContext: 'ROLLE: Mara (Fotografin)\nAUSGABE: Nur gesprochener Text.',
          taskDomain: 'charter',
          speaker: { name: 'Mara', role: 'Fotografin', gender: 'female', taskDomain: 'charter' },
          passenger: { role: 'Fotografin', gTolerance: 'niedrig', bankTolerance: 'niedrig' },
          flight: { depLabel: 'EDTW', arrLabel: 'EDTL' }
        })
      }
    }
  };
  const fixture = createCommittedFixture(t, { bundle });
  executeCurrent(fixture, 'prepare_mission', 'prepare-flight-record');
  beginBoarding(fixture, 'flight-record');
  executeCurrent(fixture, 'set_manifest_item', 'load-flight-record', { itemId: 'medical-box', action: 'load' });
  executeCurrent(fixture, 'sign_manifest', 'sign-flight-record');
  executeCurrent(fixture, 'confirm_load', 'confirm-flight-record');
  acknowledgePayloadCurrent(fixture, 'flight-record');
  acknowledgeBoardingCurrent(fixture, 'flight-record');
  executeCurrent(fixture, 'start_mission', 'start-flight-record');

  fixture.adapter.observeTelemetry({
    observedAt: 7000, lat: 48, lon: 8, altFt: 1200, aglFt: 0,
    onGround: true, gsKts: 10, bankDeg: 0, gForce: 1, vsFpm: 0
  });
  fixture.adapter.observeTelemetry({
    observedAt: 9000, lat: 48.001, lon: 8.001, altFt: 1210, aglFt: 0,
    onGround: true, gsKts: 12, bankDeg: 1, gForce: 1, vsFpm: 0
  });
  fixture.adapter.observeTelemetry({
    observedAt: 10000, lat: 48.01, lon: 8.02, altFt: 1800, aglFt: 600,
    onGround: false, gsKts: 75, bankDeg: 12, gForce: 1.1, vsFpm: 700
  });
  fixture.adapter.observeTelemetry({
    observedAt: 12000, lat: 48.05, lon: 8.1, altFt: 3200, aglFt: 1900,
    onGround: false, gsKts: 105, bankDeg: 31.5, gForce: 1.42, vsFpm: 450
  });
  fixture.adapter.observeTelemetry({
    observedAt: 30000, lat: 48.2, lon: 8.35, altFt: 5100, aglFt: 3600,
    onGround: false, gsKts: 115, bankDeg: 4, gForce: 1.02, vsFpm: 0,
    windKts: 18, windDeg: 240, windGustKts: 25, tempC: 12.5, visKm: 9,
    precipRateMmH: 0.8, precipActive: true, inCloud: true, turbulencePct: 38
  });
  fixture.adapter.observeTelemetry({
    observedAt: 32000, lat: 48.2, lon: 8.35, altFt: 5100, aglFt: 3600,
    onGround: false, gsKts: 115, bankDeg: 4, gForce: 1.02, vsFpm: -4000,
    windKts: 18, windDeg: 240, windGustKts: 25, tempC: 12.5, visKm: 9,
    precipRateMmH: 0.8, precipActive: true, inCloud: true, turbulencePct: 38
  });

  const revisionBeforeContextRead = fixture.manager.getActiveRun().revision;
  const dynamic = fixture.adapter.getFarewellDynamicContext();
  assert.equal(dynamic.record.depLabel, 'EDTW');
  assert.equal(dynamic.record.arrLabel, 'EDTL');
  assert.equal(dynamic.record.durationSec, 23);
  assert.equal(dynamic.record.maxAltFt, 5100);
  assert.equal(dynamic.record.maxBankDeg, 31.5);
  assert.equal(dynamic.record.maxGForce, 1.42);
  assert.equal(dynamic.liveWeather.windKts, 18);
  assert.equal(dynamic.liveWeather.inCloud, true);
  assert.equal(dynamic.record.maxDescentFpm, 0, 'flight record must use the App GPS-smoothed VS');
  assert.equal(dynamic.cargoOutcome.stressDamagePct, 22, 'cargo stress must also include the App live VS fallback');
  assert.equal(fixture.manager.getActiveRun().revision, revisionBeforeContextRead);
  assert.doesNotMatch(JSON.stringify(fixture.manager.getPublicSnapshot()), /flightRecorder|windKts|5100|31\.5/);

  fixture.adapter.observeTelemetry({
    observedAt: 38000, lat: 48.28, lon: 8.47, altFt: 5100, aglFt: 500,
    onGround: false, gsKts: 80, bankDeg: 4, gForce: 1.02, vsFpm: 0,
    windKts: 12, windDeg: 250, visKm: 14
  });
  fixture.adapter.observeTelemetry({
    observedAt: 40000, lat: 48.3001, lon: 8.5001, altFt: 5100, aglFt: 0,
    onGround: true, gsKts: 20, bankDeg: 0, gForce: 1, vsFpm: 0, touchdownFpm: -180,
    windKts: 12, windDeg: 250, visKm: 14
  });
  fixture.adapter.observeTelemetry({
    observedAt: 41000, lat: 48.3001, lon: 8.5001, altFt: 5100, aglFt: 0,
    onGround: true, gsKts: 0.5, bankDeg: 0, gForce: 1, vsFpm: 0,
    windKts: 12, windDeg: 250, visKm: 14
  });
  fixture.adapter.observeTelemetry({
    observedAt: 47000, lat: 48.3001, lon: 8.5001, altFt: 5100, aglFt: 0,
    onGround: true, gsKts: 0.1, bankDeg: 0, gForce: 1, vsFpm: 0,
    windKts: 12, windDeg: 250, visKm: 14
  });
  const publicBeforeArrivalRead = fixture.manager.getPublicSnapshot();
  const arrivalDynamic = fixture.adapter.getFarewellDynamicContext();
  assert.equal(arrivalDynamic.record.durationSec, 31, 'Farewell facts must freeze at the App touchdown snapshot');
  assert.equal(arrivalDynamic.record.touchdownVsFpm, -180);
  assert.equal(arrivalDynamic.liveWeather.windKts, 12, 'weather remains current even when flight facts freeze at touchdown');
  assert.deepEqual(fixture.manager.getPublicSnapshot(), publicBeforeArrivalRead);
  assert.doesNotMatch(JSON.stringify(publicBeforeArrivalRead), /arrivalFlightRecord|recorderLowSpeedSince/);
  const revisionBeforeRestart = fixture.manager.getActiveRun().revision;

  const restartedManager = createMissionAuthorityManager(fixture.managerOptions);
  const restartedAdapter = createTrackerMissionExecutionAdapter({
    authorityManager: restartedManager,
    now: fixture.managerOptions.now
  });
  const restored = restartedAdapter.getFarewellDynamicContext();
  assert.equal(restored.record.durationSec, arrivalDynamic.record.durationSec);
  assert.equal(restored.record.distanceNm, arrivalDynamic.record.distanceNm);
  assert.equal(restored.record.maxAltFt, arrivalDynamic.record.maxAltFt);
  assert.equal(restored.record.maxBankDeg, arrivalDynamic.record.maxBankDeg);
  assert.equal(restored.record.touchdownVsFpm, -180);
  assert.equal(restored.liveWeather.windKts, 12);
  assert.equal(restartedManager.getActiveRun().revision, revisionBeforeRestart);
});

test('stable intermediate landing resets only the segment recorder and keeps the mission debrief aggregate', (t) => {
  const fixture = createCommittedFixture(t);
  executeCurrent(fixture, 'prepare_mission', 'prepare-multi-leg');
  beginBoarding(fixture, 'multi-leg');
  executeCurrent(fixture, 'set_manifest_item', 'load-multi-leg', { itemId: 'medical-box', action: 'load' });
  executeCurrent(fixture, 'sign_manifest', 'sign-multi-leg');
  executeCurrent(fixture, 'confirm_load', 'confirm-multi-leg');
  acknowledgePayloadCurrent(fixture, 'multi-leg');
  acknowledgeBoardingCurrent(fixture, 'multi-leg');
  executeCurrent(fixture, 'start_mission', 'start-multi-leg');

  const observe = (observedAt, values) => fixture.adapter.observeTelemetry({ observedAt, ...values });
  observe(1000, { lat: 48, lon: 8, altFt: 1200, aglFt: 0, onGround: true, gsKts: 10 });
  observe(3000, { lat: 48.001, lon: 8.001, altFt: 1200, aglFt: 0, onGround: true, gsKts: 10 });
  observe(7000, { lat: 48.03, lon: 8.04, altFt: 2400, aglFt: 1200, onGround: false, gsKts: 95 });
  observe(10000, { lat: 48.08, lon: 8.1, altFt: 2600, aglFt: 1400, onGround: false, gsKts: 105 });
  observe(23000, { lat: 48.12, lon: 8.16, altFt: 1300, aglFt: 0, onGround: true, gsKts: 12 });
  observe(29000, { lat: 48.12, lon: 8.16, altFt: 1300, aglFt: 0, onGround: true, gsKts: 0 });

  const afterStop = fixture.adapter.getMissionFlightRecord();
  assert.equal(afterStop.segmentCount, 1);
  assert.equal(afterStop.arrLabel, 'ZWISCHENLANDUNG');

  observe(32000, { lat: 48.12, lon: 8.16, altFt: 1300, aglFt: 0, onGround: true, gsKts: 10 });
  observe(34000, { lat: 48.121, lon: 8.161, altFt: 1300, aglFt: 0, onGround: true, gsKts: 11 });
  observe(38000, { lat: 48.18, lon: 8.28, altFt: 3000, aglFt: 1700, onGround: false, gsKts: 110 });
  observe(42000, { lat: 48.24, lon: 8.4, altFt: 3400, aglFt: 2100, onGround: false, gsKts: 118 });
  observe(55000, { lat: 48.3001, lon: 8.5001, altFt: 900, aglFt: 0, onGround: true, gsKts: 10 });

  const finalRecord = fixture.adapter.getMissionFlightRecord();
  assert.equal(finalRecord.segmentCount, 2);
  assert.equal(finalRecord.depLabel, 'EDTW');
  assert.equal(finalRecord.arrLabel, 'EDTL');
  assert.ok(finalRecord.durationSec > afterStop.durationSec);
  assert.ok(finalRecord.distanceNm > afterStop.distanceNm);
});

test('passenger deboarding is a scene-backed intent and only its system ACK unloads the PAX', (t) => {
  const bundle = aptResumeBundle();
  bundle.runtime.cargoManifest.dispatchSignature = { scope: 'departure' };
  bundle.runtime.cargoManifest.items = [{
    id: 'passenger-one',
    itemType: 'passenger',
    required: true,
    status: 'loaded',
    passengerCount: 1,
    deliverAtDestination: true
  }];
  bundle.executionReplay = executionCore.createExecutionBundle(bundle);
  bundle.execution = executionCore.createReplayShadowEnvelope(bundle.executionReplay, {
    sourceRevision: 1,
    legacyBundle: bundle
  });
  const fixture = createCommittedFixture(t, { bundle });
  executeCurrent(fixture, 'prepare_mission', 'prepare-pax');
  beginBoarding(fixture, 'pax');
  executeCurrent(fixture, 'confirm_load', 'confirm-load-pax');
  acknowledgePayloadCurrent(fixture, 'pax');
  acknowledgeBoardingCurrent(fixture, 'pax');
  executeCurrent(fixture, 'start_mission', 'start-pax');

  fixture.adapter.observeTelemetry({ observedAt: 10000, lat: 48.1, lon: 8.2, onGround: false, gsKts: 60 });
  fixture.adapter.observeTelemetry({ observedAt: 12000, lat: 48.1, lon: 8.2, onGround: false, gsKts: 65 });
  fixture.adapter.observeTelemetry({ observedAt: 13000, lat: 48.3001, lon: 8.5001, onGround: true, gsKts: 20 });
  fixture.adapter.observeTelemetry({ observedAt: 14000, lat: 48.3001, lon: 8.5001, onGround: true, gsKts: 0 });
  fixture.adapter.observeTelemetry({ observedAt: 17000, lat: 48.3001, lon: 8.5001, onGround: true, gsKts: 0 });
  // PAX are released by the scene-backed deboarding flow and do not block the
  // cargo unload gate in the original App implementation.
  assert.equal(fixture.manager.getExecutionSnapshot().state.phase, 'end_ready');

  const requested = executeCurrent(fixture, 'request_pax_interaction', 'deboard-pax', { action: 'deboard' });
  assert.equal(requested.ok, true);
  assert.equal(requested.effectsPending[0].type, 'scene.deboarding');
  assert.equal(fixture.manager.getExecutionSnapshot().state.cargo.items[0].status, 'loaded');
  assert.equal(fixture.manager.getExecutionSnapshot().view.allowedActions.includes('request_pax_interaction'), false);
  assert.equal(
    executeCurrent(fixture, 'request_pax_interaction', 'deboard-pax-again', { action: 'deboard' }).error,
    'mission_intent_not_allowed_in_state'
  );

  const confirmed = systemCurrent(fixture, 'PAX_DEBOARDING_CONFIRMED', 'deboarding-confirmed-pax');
  assert.equal(confirmed.ok, true);
  assert.equal(confirmed.view.phase, 'end_ready');
  assert.equal(fixture.manager.getExecutionSnapshot().state.cargo.items[0].status, 'unloaded');
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
  beginBoarding(fixture, 'passenger-reject');
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

test('tracker owns board-book writes and expiry-equipment replacement through manifest intents', (t) => {
  const bundle = aptResumeBundle();
  bundle.runtime.cargoManifest.items.push(
    {
      id: 'bordbuch', label: 'Bordbuch / Dispatch-Mappe', itemType: 'cargo', status: 'loaded',
      persistentEquipment: true, deliverAtDestination: false, weightLbs: 3, log: {}
    },
    {
      id: 'first-aid', label: 'Verbandzeug', itemType: 'cargo', status: 'unloaded',
      persistentEquipment: true, deliverAtDestination: false, weightLbs: 2,
      equipmentType: 'expiry', expiresAt: '1969-12-31', serialId: 'OLD'
    }
  );
  bundle.executionReplay = executionCore.createExecutionBundle(bundle);
  bundle.execution = executionCore.createReplayShadowEnvelope(bundle.executionReplay, {
    sourceRevision: 1, legacyBundle: bundle
  });
  const fixture = createCommittedFixture(t, { bundle });
  let snapshot = fixture.manager.getExecutionSnapshot();
  assert.equal(snapshot.view.allowedActions.includes('set_boardbook_time'), true);
  assert.equal(snapshot.view.allowedActions.includes('replace_equipment'), true);

  const logged = executeCurrent(fixture, 'set_boardbook_time', 'log-start', {
    itemId: 'bordbuch', field: 'start'
  });
  assert.equal(logged.ok, true, JSON.stringify(logged));
  snapshot = fixture.manager.getExecutionSnapshot();
  const boardBook = snapshot.state.manifest.items.find(item => item.id === 'bordbuch');
  assert.equal(boardBook.log.startAt, 1000);
  assert.equal(boardBook.log.origin, 'EDTW');
  assert.equal(boardBook.log.flightId, `${bundle.runtime.cargoManifest.key}|flight`);

  fixture.setClock(2000);
  const replaced = executeCurrent(fixture, 'replace_equipment', 'replace-first-aid', { itemId: 'first-aid' });
  assert.equal(replaced.ok, true, JSON.stringify(replaced));
  snapshot = fixture.manager.getExecutionSnapshot();
  const firstAid = snapshot.state.manifest.items.find(item => item.id === 'first-aid');
  assert.equal(firstAid.status, 'unloaded');
  assert.notEqual(firstAid.serialId, 'OLD');
  assert.match(firstAid.expiresAt, /^\d{4}-\d{2}-\d{2}$/);
});

test('tracker compliance evidence uses the shared App rules for unload, remediation and result text', (t) => {
  const makeBundle = ({ boardBookLog, fireStatus = 'unloaded' } = {}) => {
    const bundle = aptResumeBundle();
    const flightId = 'manifest-apt-adapter|flight';
    bundle.runtime.cargoManifest.items = [
      {
        id: 'bordbuch', label: 'Bordbuch', itemType: 'cargo', status: 'unloaded',
        persistentEquipment: true, deliverAtDestination: false,
        log: boardBookLog || { flightId, startAt: 100, landingAt: 200 }
      },
      {
        id: 'fire-extinguisher', label: 'Feuerloescher', itemType: 'cargo', status: fireStatus,
        persistentEquipment: true, deliverAtDestination: false, equipmentType: 'expiry',
        expiresAt: '2099-12-31', serialId: 'FIRE-1'
      },
      {
        id: 'first-aid', label: 'Verbandzeug', itemType: 'cargo', status: 'unloaded',
        persistentEquipment: true, deliverAtDestination: false, equipmentType: 'expiry',
        expiresAt: '2099-12-31', serialId: 'FIRST-1'
      }
    ];
    bundle.runtime.complianceInspection = {
      missionKey: bundle.missionId,
      flightId,
      selected: true,
      phase: 'evidence_open',
      revision: 3,
      farewellComplete: true,
      snapshot: {
        at: 900,
        flightId,
        aircraftSlot: 'D-EINA',
        items: bundle.runtime.cargoManifest.items.map(item => ({
          id: item.id,
          label: item.label,
          status: 'loaded',
          expiresAt: item.expiresAt || '',
          serialId: item.serialId || ''
        }))
      },
      remediation: { required: false, missingFields: [] }
    };
    bundle.executionReplay = executionCore.createExecutionBundle(bundle);
    bundle.execution = executionCore.createReplayShadowEnvelope(bundle.executionReplay, {
      sourceRevision: 1, legacyBundle: bundle
    });
    return bundle;
  };

  const blockedFixture = createCommittedFixture(t, { bundle: makeBundle({ fireStatus: 'loaded' }) });
  assert.equal(blockedFixture.manager.getExecutionSnapshot().view.allowedActions.includes('submit_compliance_evidence'), true);
  const blocked = executeCurrent(blockedFixture, 'submit_compliance_evidence', 'compliance-loaded');
  assert.equal(blocked.error, 'mission_compliance_items_still_loaded');
  assert.deepEqual(blocked.blockingUnload, ['Feuerloescher']);
  assert.equal(blocked.message, 'Fuer die Kontrolle noch ausladen: Feuerloescher.');

  const remediationFixture = createCommittedFixture(t, {
    bundle: makeBundle({ boardBookLog: { flightId: 'manifest-apt-adapter|flight', startAt: 100 } })
  });
  const remediation = executeCurrent(remediationFixture, 'submit_compliance_evidence', 'compliance-remediation');
  assert.equal(remediation.ok, true, JSON.stringify(remediation));
  assert.equal(remediation.status, 'remediation_required');
  assert.deepEqual(remediation.missingLogFields, ['landing']);
  assert.deepEqual(remediationFixture.manager.getExecutionSnapshot().state.workflows.complianceInspection.remediation, {
    required: true,
    missingFields: ['landing']
  });

  const completedFixture = createCommittedFixture(t, { bundle: makeBundle() });
  const completed = executeCurrent(completedFixture, 'submit_compliance_evidence', 'compliance-complete');
  assert.equal(completed.ok, true, JSON.stringify(completed));
  const compliance = completedFixture.manager.getExecutionSnapshot().state.workflows.complianceInspection;
  assert.equal(compliance.phase, 'result_playing');
  assert.equal(compliance.result.entryCount, 0);
  assert.equal(compliance.result.warningCount, 0);
  assert.equal(compliance.resultText, 'Danke. Der aktuelle Flug ist im Bordbuch vollstaendig eingetragen, Feuerloescher gueltig bis 2099-12-31 und Verbandzeug gueltig bis 2099-12-31. Die Kontrolle ist ohne Beanstandung abgeschlossen. Gute Weiterreise.');
});

test('cargo pickup confirmation uses the existing gated PICKUP_CONFIRMED reducer event', (t) => {
  const bundle = aptResumeBundle();
  bundle.runtime.cargoManifest.items.push({
    id: 'pickup-box', itemType: 'cargo', required: true, status: 'pending', weightLbs: 18,
    pickupLocation: 'target', deliverAtDestination: false, deliverAtHome: true
  });
  bundle.executionReplay = executionCore.createExecutionBundle(bundle);
  bundle.execution = executionCore.createReplayShadowEnvelope(bundle.executionReplay, {
    sourceRevision: 1, legacyBundle: bundle
  });
  const fixture = createCommittedFixture(t, { bundle });
  executeCurrent(fixture, 'prepare_mission', 'prepare-pickup');
  beginBoarding(fixture, 'pickup');
  executeCurrent(fixture, 'set_manifest_item', 'load-departure-pickup', { itemId: 'medical-box', action: 'load' });
  executeCurrent(fixture, 'sign_manifest', 'sign-departure-pickup');
  executeCurrent(fixture, 'confirm_load', 'confirm-departure-pickup');
  acknowledgePayloadCurrent(fixture, 'pickup');
  acknowledgeBoardingCurrent(fixture, 'pickup');
  executeCurrent(fixture, 'start_mission', 'start-pickup');

  let snapshot = fixture.manager.getExecutionSnapshot();
  const targetEntered = fixture.manager.applyExecutionEvent({
    missionId: snapshot.missionId,
    runId: snapshot.runId,
    expectedRevision: snapshot.authorityRevision,
    expectedExecutionRevision: snapshot.executionRevision,
    expectedExecutionStateHash: snapshot.executionStateHash,
    event: {
      eventId: 'pickup-target-entered', type: 'TARGET_ENTERED',
      sequence: snapshot.executionRevision + 1, occurredAt: 5000, payload: {}
    }
  });
  assert.equal(targetEntered.ok, true);
  assert.equal(executeCurrent(fixture, 'set_manifest_item', 'load-pickup-box', {
    itemId: 'pickup-box', action: 'load'
  }).ok, true);
  assert.equal(executeCurrent(fixture, 'sign_manifest', 'sign-pickup').ok, true);
  const confirmed = executeCurrent(fixture, 'confirm_pickup', 'confirm-pickup');
  assert.equal(confirmed.ok, true, JSON.stringify(confirmed));
  snapshot = fixture.manager.getExecutionSnapshot();
  assert.equal(snapshot.state.phase, 'return_leg');
  assert.equal(snapshot.state.progress.pickupCompleted, true);
  assert.equal(snapshot.state.effects.some(effect => effect.type === 'cargo.pickup_confirmed'), true);
});
