'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const executionCore = require('../mission-execution-core.js');
const payloadCore = require('../mission-payload-core.js');
const { createMissionAuthorityManager } = require('./mission-authority-core.js');
const { createTrackerMissionExecutionAdapter } = require('./tracker-mission-execution-adapter.js');
const { APT_EFFECT_FOLLOW_UPS, createTrackerMissionEffectRunner } = require('./tracker-mission-effect-runner.js');

test('APT scene effects advance boarding and deboarding only through their simulator ACKs', () => {
  assert.equal(APT_EFFECT_FOLLOW_UPS['scene.boarding'], 'BOARDING_SCENE_CONFIRMED');
  assert.equal(APT_EFFECT_FOLLOW_UPS['voice.boarding'], 'BOARDING_CONFIRMED');
  assert.equal(APT_EFFECT_FOLLOW_UPS['voice.farewell'], 'FAREWELL_COMPLETED');
  assert.equal(APT_EFFECT_FOLLOW_UPS['payload.sync_before_start'], 'LOAD_CONFIRMED');
  assert.equal(APT_EFFECT_FOLLOW_UPS['scene.deboarding'], 'PAX_DEBOARDING_CONFIRMED');
});

test('failed coordinated deboarding falls back through Farewell and cannot hard-lock close', async (t) => {
  const fixture = createCommittedFixture(t);
  const importedBundle = aptResumeBundle();
  importedBundle.runtime.startPhase = 'end_ready';
  importedBundle.runtime.lastLiveFlightData = { onGround: true, gsKts: 0, simPaused: false, inMenuOrMap: false };
  importedBundle.runtime.flightRecorder = { hadAirbornePhase: true };
  importedBundle.runtime.runtime = {
    missionId: importedBundle.missionId,
    phase: 'end_ready',
    active: true,
    startedAt: 100
  };
  importedBundle.runtime.cargoManifest = {
    version: 6,
    key: 'manifest-failed-deboarding',
    dispatchSignature: { scope: 'arrival' },
    items: [{
      id: 'failed-deboarding-pax',
      itemType: 'passenger',
      required: true,
      status: 'loaded',
      passengerCount: 1,
      deliverAtDestination: true
    }]
  };
  let snapshot = fixture.manager.getExecutionSnapshot();
  assert.equal(fixture.manager.applyExecutionEvent({
    missionId: snapshot.missionId,
    runId: snapshot.runId,
    expectedRevision: snapshot.authorityRevision,
    expectedExecutionRevision: snapshot.executionRevision,
    expectedExecutionStateHash: snapshot.executionStateHash,
    commandId: 'import-failed-deboarding',
    reason: 'test:failed-deboarding',
    event: {
      eventId: 'import-failed-deboarding',
      type: 'AUTHORITATIVE_SNAPSHOT_IMPORTED',
      sequence: snapshot.executionRevision + 1,
      occurredAt: 200,
      payload: { resumeBundle: importedBundle }
    }
  }).ok, true);
  assert.equal(executeCurrent(fixture, 'request_close', 'close-failed-deboarding').ok, true);

  const dispatches = [];
  const runner = createTrackerMissionEffectRunner({
    authorityManager: fixture.manager,
    applySystemEvent: request => fixture.adapter.applySystemEvent(request),
    handlers: {
      'scene.deboarding': request => {
        dispatches.push(request.effect.type);
        return { ok: false, status: 'error', error: 'vehicle_spawn_failed', terminal: true };
      },
      'voice.farewell': request => {
        dispatches.push(request.effect.type);
        return {
          ok: true,
          status: 'completed',
          voiceOutcome: {
            schema: 'ga.mission-voice-outcome.v1',
            kind: 'farewell',
            status: 'warning',
            text: 'Danke fuers Mitnehmen.',
            playback: 'not_played'
          }
        };
      },
      'payload.sync_manifest_state': request => {
        dispatches.push(request.effect.type);
        return { ok: true, status: 'completed' };
      },
      'mission.close_requested': request => {
        dispatches.push(request.effect.type);
        return { ok: true, status: 'completed' };
      }
    }
  });
  const drained = await runner.drain();
  assert.equal(drained.ok, true);
  snapshot = fixture.manager.getExecutionSnapshot();
  assert.equal(snapshot.state.phase, 'closed');
  assert.equal(snapshot.state.manifest.items[0].status, 'unloaded');
  assert.equal(snapshot.state.flags.farewellCompleted, false);
  assert.deepEqual(dispatches, [
    'scene.deboarding',
    'voice.farewell',
    'payload.sync_manifest_state',
    'mission.close_requested'
  ]);
});

function aptResumeBundle() {
  const bundle = {
    version: 2,
    missionId: 'mission-apt-effects',
    adapter: 'apt',
    descriptor: { primaryAdapter: 'apt' },
    missionState: {
      currentMissionData: {
        missionId: 'mission-apt-effects',
        missionType: 'apt',
        start: 'EDTW',
        dest: 'EDTL',
        aptArrivalPlan: { lat: 48.3001, lon: 8.5001 },
        routeWaypoints: [
          { lat: 48, lon: 8, name: 'EDTW' },
          { lat: 48.3, lon: 8.5, name: 'EDTL' }
        ]
      }
    },
    runtime: {
      version: 1,
      missionId: 'mission-apt-effects',
      startPhase: 'planned',
      runtime: {
        missionId: 'mission-apt-effects',
        phase: 'planned',
        active: false,
        closingPending: false
      },
      cargoManifest: {
        version: 6,
        key: 'manifest-apt-effects',
        dispatchSignature: { scope: 'departure' },
        items: [
          {
            id: 'medical-box',
            itemType: 'cargo',
            required: true,
            status: 'loaded',
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

function createCommittedFixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ga-tracker-effect-runner-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  let clock = 1000;
  const managerOptions = {
    storageFile: path.join(directory, 'authority.json'),
    now: () => clock,
    idFactory: () => 'run-effects-1',
    executionAuthorityEnabled: true
  };
  const manager = createMissionAuthorityManager(managerOptions);
  const bundle = aptResumeBundle();
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
  const createAdapter = activeManager => createTrackerMissionExecutionAdapter({
    authorityManager: activeManager,
    now: () => clock
  });
  return {
    manager,
    managerOptions,
    adapter: createAdapter(manager),
    createAdapter,
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

test('APT effect runner persists ACKs, advances system events and closes the replay', async (t) => {
  const fixture = createCommittedFixture(t);
  const dispatches = [];
  const handlers = Object.fromEntries([
    'scene.prepare',
    'scene.boarding',
    'voice.boarding',
    'voice.farewell',
    'scene.deboarding_continue',
    'scene.cargo_item_transition',
    'payload.sync_manifest_state',
    'payload.sync_before_start',
    'cargo.unload_confirmed',
    'mission.close_requested'
  ].map(type => [type, async request => {
    assert.deepEqual(Object.keys(request).sort(), ['commandId', 'effect', 'missionId', 'runId', 'schema']);
    dispatches.push({ type, commandId: request.commandId });
    if (type === 'payload.sync_before_start') {
      return {
        ok: true,
        status: 'ok',
        payloadOutcome: payloadCore.normalizeOutcome({
          status: 'warning',
          override: true,
          adapter: 'msfs_payload_stations',
          error: 'payload_unstable_aircraft_override',
          plan: { missionWeightLbs: 42, stations: [{ index: 5, weightLbs: 42 }] },
          verification: { status: 'unstable', reason: 'station_mismatch' }
        })
      };
    }
    if (type === 'voice.boarding') {
      return {
        ok: true,
        status: 'ok',
        voiceOutcome: {
          schema: 'ga.mission-voice-outcome.v1',
          kind: 'boarding',
          status: 'ok',
          text: 'Die Kühlbox ist an Bord, wir sind bereit.',
          speaker: { name: 'Loadmaster', gender: 'male' },
          playback: 'completed'
        }
      };
    }
    if (type === 'voice.farewell') {
      return {
        ok: true,
        status: 'ok',
        voiceOutcome: {
          schema: 'ga.mission-voice-outcome.v1',
          kind: 'farewell',
          status: 'ok',
          text: 'Danke fuers Mitnehmen.',
          speaker: { name: 'Loadmaster', gender: 'male' },
          playback: 'completed'
        }
      };
    }
    return { ok: true, status: 'ok' };
  }]));
  const runner = createTrackerMissionEffectRunner({
    authorityManager: fixture.manager,
    applySystemEvent: request => fixture.adapter.applySystemEvent(request),
    handlers,
    now: () => 1000
  });

  assert.equal(executeCurrent(fixture, 'prepare_mission', 'prepare').ok, true);
  const startEffects = await runner.drain();
  assert.equal(startEffects.ok, true);
  assert.equal(startEffects.pendingCount, 0);
  assert.deepEqual(dispatches.map(item => item.type), ['scene.prepare']);
  assert.equal(executeCurrent(fixture, 'start_boarding', 'start-boarding').ok, true);
  assert.equal((await runner.drain()).pendingCount, 0);
  assert.deepEqual(dispatches.map(item => item.type), ['scene.prepare', 'scene.boarding', 'voice.boarding']);
  assert.equal(new Set(dispatches.map(item => item.commandId)).size, 3);
  let snapshot = fixture.manager.getExecutionSnapshot();
  assert.equal(snapshot.state.phase, 'boarding');
  assert.equal(snapshot.state.flags.boardingConfirmed, true);
  assert.deepEqual(snapshot.state.effects.map(effect => effect.status), ['completed', 'completed', 'completed']);
  assert.equal(snapshot.state.voice.boarding.text, 'Die Kühlbox ist an Bord, wir sind bereit.');
  assert.equal(fixture.manager.getPublicSnapshot().execution.voice.boarding.playback, 'completed');

  assert.equal(executeCurrent(fixture, 'confirm_load', 'confirm-load').ok, true);
  assert.equal((await runner.drain()).pendingCount, 0);
  snapshot = fixture.manager.getExecutionSnapshot();
  assert.equal(snapshot.state.payload.status, 'warning');
  assert.equal(snapshot.state.payload.override, true);
  assert.match(snapshot.view.payload.presentation.message, /Missionszuladung: 42 lbs/);
  const publicPayload = fixture.manager.getPublicSnapshot().execution.payload;
  assert.equal(publicPayload.status, 'warning');
  assert.doesNotMatch(JSON.stringify(publicPayload), /snapshot|assignments|mismatches/);
  assert.equal(executeCurrent(fixture, 'start_mission', 'start').ok, true);
  fixture.adapter.observeTelemetry({ observedAt: 10000, lat: 48.1, lon: 8.2, onGround: false, gsKts: 60 });
  assert.equal(fixture.adapter.observeTelemetry({
    observedAt: 12000,
    lat: 48.1,
    lon: 8.2,
    onGround: false,
    gsKts: 70
  }).acceptedEvent.type, 'AIRBORNE');
  assert.equal(fixture.adapter.observeTelemetry({
    observedAt: 13000,
    lat: 48.3001,
    lon: 8.5001,
    onGround: true,
    gsKts: 25
  }).acceptedEvent.type, 'TOUCHDOWN');
  fixture.adapter.observeTelemetry({ observedAt: 14000, lat: 48.3001, lon: 8.5001, onGround: true, gsKts: 0.5 });
  assert.equal(fixture.adapter.observeTelemetry({
    observedAt: 17000,
    lat: 48.3001,
    lon: 8.5001,
    onGround: true,
    gsKts: 0.2
  }).view.phase, 'end_unloading');
  assert.equal(executeCurrent(fixture, 'set_manifest_item', 'unload', {
    itemId: 'medical-box',
    action: 'unload'
  }).ok, true);
  assert.equal(executeCurrent(fixture, 'sign_manifest', 'sign-arrival').ok, true);
  assert.equal(executeCurrent(fixture, 'confirm_unload', 'confirm-unload').ok, true);
  assert.equal((await runner.drain()).pendingCount, 0);
  assert.equal(executeCurrent(fixture, 'request_close', 'close').ok, true);
  const closeEffects = await runner.drain();
  assert.equal(closeEffects.ok, true);
  assert.equal(closeEffects.pendingCount, 0);

  snapshot = fixture.manager.getExecutionSnapshot();
  assert.equal(snapshot.state.phase, 'closed');
  assert.equal(snapshot.state.flags.closed, true);
  assert.equal(snapshot.state.voice.farewell.text, 'Danke fuers Mitnehmen.');
  assert.equal(snapshot.state.effects.every(effect => effect.status === 'completed'), true);
  const replay = executionCore.replay(fixture.manager.getActiveRun({ includeBundle: true }).resumeBundle.executionReplay);
  assert.equal(replay.ok, true);
  assert.equal(replay.stateHash, fixture.manager.getActiveRun().executionStateHash);

  const reloaded = createMissionAuthorityManager(fixture.managerOptions);
  let restartDispatches = 0;
  const restartedRunner = createTrackerMissionEffectRunner({
    authorityManager: reloaded,
    applySystemEvent: request => fixture.createAdapter(reloaded).applySystemEvent(request),
    handlers: {
      'scene.prepare': () => { restartDispatches += 1; return { ok: true }; },
      'scene.boarding': () => { restartDispatches += 1; return { ok: true }; },
      'voice.boarding': () => { restartDispatches += 1; return { ok: true }; },
      'voice.farewell': () => { restartDispatches += 1; return { ok: true }; },
      'scene.deboarding_continue': () => { restartDispatches += 1; return { ok: true }; },
      'payload.sync_manifest_state': () => { restartDispatches += 1; return { ok: true }; },
      'payload.sync_before_start': () => { restartDispatches += 1; return { ok: true }; },
      'cargo.unload_confirmed': () => { restartDispatches += 1; return { ok: true }; },
      'mission.close_requested': () => { restartDispatches += 1; return { ok: true }; }
    }
  });
  assert.equal((await restartedRunner.drain()).status, 'noop');
  assert.equal(restartDispatches, 0);
  assert.equal(reloaded.getExecutionSnapshot().state.phase, 'closed');
});

test('pending effects are recovered after restart with the same deterministic command id', async (t) => {
  const fixture = createCommittedFixture(t);
  assert.equal(executeCurrent(fixture, 'prepare_mission', 'prepare').ok, true);
  const firstIds = [];
  const firstRunner = createTrackerMissionEffectRunner({
    authorityManager: fixture.manager,
    applySystemEvent: request => fixture.adapter.applySystemEvent(request),
    handlers: {
      'scene.prepare': request => {
        firstIds.push(request.commandId);
        return { ok: true, status: 'pending' };
      }
    },
    now: () => 1000
  });
  assert.equal((await firstRunner.pump()).status, 'pending');
  assert.equal((await firstRunner.pump()).status, 'pending');
  assert.equal(firstIds.length, 1);
  assert.equal(firstRunner.releasePending(), 1);
  assert.equal((await firstRunner.pump()).status, 'pending');
  assert.equal(firstIds.length, 2);
  assert.equal(firstIds[0], firstIds[1]);

  const reloaded = createMissionAuthorityManager(fixture.managerOptions);
  const reloadedAdapter = fixture.createAdapter(reloaded);
  const recoveredIds = [];
  const recoveredRunner = createTrackerMissionEffectRunner({
    authorityManager: reloaded,
    applySystemEvent: request => reloadedAdapter.applySystemEvent(request),
    handlers: {
      'scene.prepare': request => {
        recoveredIds.push(request.commandId);
        return { ok: true, status: 'ok' };
      }
    },
    now: () => 2000
  });
  const recovered = await recoveredRunner.pump();
  assert.equal(recovered.ok, true);
  assert.deepEqual(recoveredIds, [firstIds[0]]);
  const snapshot = reloaded.getExecutionSnapshot();
  assert.equal(snapshot.state.phase, 'prepare');
  assert.equal(snapshot.state.effects.find(effect => effect.type === 'scene.prepare').status, 'completed');
  assert.equal(snapshot.view.allowedActions.includes('start_boarding'), true);
});
