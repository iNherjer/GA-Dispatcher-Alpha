'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const executionCore = require('../mission-execution-core.js');
const farewellVoiceCore = require('../mission-farewell-voice-core.js');
const { createMissionAuthorityManager } = require('./mission-authority-core.js');
const { createTrackerMissionExecutionRuntime } = require('./tracker-mission-execution-runtime.js');
const { EFFECT_PLAN_SCHEMA } = require('./tracker-mission-simulator-effects.js');

function aptBundle() {
  const bundle = {
    version: 2,
    missionId: 'mission-runtime-apt',
    adapter: 'apt',
    descriptor: { primaryAdapter: 'apt' },
    missionState: {
      currentMissionData: {
        missionId: 'mission-runtime-apt',
        missionType: 'apt',
        start: 'EDTW',
        dest: 'EDTL',
        aptArrivalPlan: { lat: 48.3, lon: 8.5 }
      }
    },
    runtime: {
      missionId: 'mission-runtime-apt',
      startPhase: 'planned',
      lastLiveFlightData: { onGround: true, gsKts: 0, simPaused: false, inMenuOrMap: false },
      runtime: { missionId: 'mission-runtime-apt', phase: 'planned', active: false },
      cargoManifest: {
        version: 6,
        key: 'empty-manifest',
        dispatchSignature: { scope: 'departure' },
        items: []
      }
    },
    executionEffectPlan: {
      schema: EFFECT_PLAN_SCHEMA,
      recipe: 'apt',
      missionId: 'mission-runtime-apt',
      effects: {
        'scene.prepare': {
          command: {
            type: 'mission_scene_spawn',
            sceneId: 'scene-mission-runtime-apt',
            items: [{ kind: 'person_boarder_1', objectTitle: 'Tarmac_Male' }]
          }
        },
        'scene.boarding': {
          command: {
            type: 'mission_scene_boarding',
            sceneId: 'scene-mission-runtime-apt',
            path: [{ forwardM: 16, rightM: -8 }, { forwardM: 4.5, rightM: 8.5 }]
          }
        }
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

function committedManager(t, bundle = aptBundle()) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ga-execution-runtime-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const manager = createMissionAuthorityManager({
    storageFile: path.join(directory, 'authority.json'),
    idFactory: () => 'run-runtime-apt',
    executionAuthorityEnabled: true
  });
  const replay = executionCore.replay(bundle.executionReplay);
  const acquired = manager.acquire({
    missionId: bundle.missionId,
    clientId: 'web-owner',
    stateHash: 'web-state-runtime',
    resumeBundle: bundle
  });
  const prepared = manager.prepareExecutionAuthority({
    missionId: acquired.activeRun.missionId,
    runId: acquired.activeRun.runId,
    clientId: 'web-owner',
    expectedRevision: acquired.activeRun.revision,
    expectedStateHash: acquired.activeRun.stateHash,
    expectedExecutionStateHash: replay.stateHash
  });
  assert.equal(prepared.ok, true, JSON.stringify(prepared));
  const committed = manager.commitExecutionAuthority({
    missionId: prepared.activeRun.missionId,
    runId: prepared.activeRun.runId,
    clientId: 'web-owner',
    expectedRevision: prepared.activeRun.revision,
    expectedExecutionStateHash: prepared.activeRun.executionStateHash,
    handoffId: prepared.handoff.handoffId
  });
  assert.equal(committed.ok, true);
  return manager;
}

test('runtime acknowledges unload bookkeeping before closing the tracker run', async (t) => {
  const bundle = aptBundle();
  bundle.runtime.cargoManifest = {
    version: 6,
    key: 'arrival-manifest',
    items: [{
      id: 'medical-box',
      itemType: 'cargo',
      required: true,
      status: 'pending',
      deliverAtDestination: true
    }]
  };
  bundle.executionReplay = executionCore.createExecutionBundle(bundle);
  bundle.execution = executionCore.createReplayShadowEnvelope(bundle.executionReplay, {
    sourceRevision: 1,
    legacyBundle: bundle
  });
  const manager = committedManager(t, bundle);
  const farewellPrewarms = [];
  const farewellVoice = request => ({
    ok: true,
    status: 'completed',
    sideEffect: false,
    commandId: request.commandId
  });
  farewellVoice.prepare = request => {
    farewellPrewarms.push(request);
    return { ok: true, status: 'pending', sideEffect: true };
  };
  const authorityChanges = [];
  const runtime = createTrackerMissionExecutionRuntime({
    authorityManager: manager,
    enabled: true,
    onAuthorityChanged: (reason, snapshot) => authorityChanges.push({
      reason,
      phase: snapshot?.state?.phase || null
    }),
    payloadSyncBeforeStart: () => ({ ok: true, status: 'completed', sideEffect: false }),
    playBoardingVoice: request => ({
      ok: true,
      status: 'completed',
      sideEffect: false,
      commandId: request.commandId,
      voiceOutcome: {
        schema: 'ga.mission-voice-outcome.v1',
        kind: 'boarding',
        status: 'ok',
        text: 'Die Fracht ist verladen, wir sind bereit.',
        playback: 'audio_disabled'
      }
    }),
    playFarewellVoice: farewellVoice
  });
  runtime.attachSimulator({
    getLivePosition: () => ({ lat: 48.3, lon: 8.5, alt: 500, hdg: 90 }),
    dispatchCommand: () => ({ ok: true, status: 'completed', sideEffect: false }),
    syncPayloadManifestState: () => ({ ok: true, status: 'completed', sideEffect: false })
  });

  let run = manager.getActiveRun();
  assert.equal((await runtime.executeIntent({
    commandId: 'prepare-arrival-runtime',
    intent: 'prepare_mission',
    missionId: run.missionId,
    runId: run.runId,
    expectedRevision: run.revision
  })).ok, true);
  run = manager.getActiveRun();
  assert.equal((await runtime.executeIntent({
    commandId: 'start-boarding-arrival-runtime',
    intent: 'start_boarding',
    missionId: run.missionId,
    runId: run.runId,
    expectedRevision: run.revision
  })).ok, true);
  run = manager.getActiveRun();
  assert.equal((await runtime.executeIntent({
    commandId: 'load-arrival-runtime',
    intent: 'set_manifest_item',
    missionId: run.missionId,
    runId: run.runId,
    expectedRevision: run.revision,
    payload: { itemId: 'medical-box', action: 'load' }
  })).ok, true);
  run = manager.getActiveRun();
  assert.equal((await runtime.executeIntent({
    commandId: 'sign-departure-runtime',
    intent: 'sign_manifest',
    missionId: run.missionId,
    runId: run.runId,
    expectedRevision: run.revision
  })).ok, true);
  run = manager.getActiveRun();
  assert.equal((await runtime.executeIntent({
    commandId: 'confirm-load-runtime',
    intent: 'confirm_load',
    missionId: run.missionId,
    runId: run.runId,
    expectedRevision: run.revision
  })).ok, true);
  run = manager.getActiveRun();
  assert.equal((await runtime.executeIntent({
    commandId: 'start-arrival-runtime',
    intent: 'start_mission',
    missionId: run.missionId,
    runId: run.runId,
    expectedRevision: run.revision
  })).ok, true);
  runtime.observeTelemetry({ observedAt: 10000, lat: 48.1, lon: 8.2, onGround: false, gsKts: 60 });
  runtime.observeTelemetry({ observedAt: 12000, lat: 48.1, lon: 8.2, onGround: false, gsKts: 65 });
  assert.equal(farewellPrewarms.length, 0);
  const touchdown = runtime.observeTelemetry({ observedAt: 13000, lat: 48.3, lon: 8.5, onGround: true, gsKts: 20 });
  assert.equal(touchdown.acceptedEvent?.type, 'TOUCHDOWN', JSON.stringify(touchdown));
  assert.equal(farewellPrewarms.length, 1, JSON.stringify(touchdown));
  assert.equal(farewellPrewarms[0].missionId, bundle.missionId);
  assert.equal(farewellPrewarms[0].farewellContext, null);
  assert.equal(typeof farewellPrewarms[0].farewellDynamicContext?.record, 'object');
  runtime.observeTelemetry({ observedAt: 14000, lat: 48.3, lon: 8.5, onGround: true, gsKts: 0 });
  runtime.observeTelemetry({ observedAt: 17000, lat: 48.3, lon: 8.5, onGround: true, gsKts: 0 });
  run = manager.getActiveRun();
  assert.equal((await runtime.executeIntent({
    commandId: 'unload-arrival-runtime',
    intent: 'set_manifest_item',
    missionId: run.missionId,
    runId: run.runId,
    expectedRevision: run.revision,
    payload: { itemId: 'medical-box', action: 'unload' }
  })).ok, true);
  run = manager.getActiveRun();
  assert.equal((await runtime.executeIntent({
    commandId: 'sign-arrival-runtime',
    intent: 'sign_manifest',
    missionId: run.missionId,
    runId: run.runId,
    expectedRevision: run.revision
  })).ok, true);
  run = manager.getActiveRun();
  const confirmed = await runtime.executeIntent({
    commandId: 'confirm-arrival-runtime',
    intent: 'confirm_unload',
    missionId: run.missionId,
    runId: run.runId,
    expectedRevision: run.revision
  });
  assert.equal(confirmed.ok, true);
  assert.equal(confirmed.effectDispatch.pendingCount, 1, 'the 180-ms cargo object queue is still pending');
  assert.equal(await waitUntil(() => manager.getActiveRun() === null), true);
  const completed = manager.getPublicSnapshot().lastExecution;
  assert.equal(completed.payload.status, 'ok');
  assert.equal(completed.flags.unloadConfirmed, true);
  assert.equal(manager.getActiveRun(), null);
  assert.equal(completed.phase, 'closed');
  assert.equal(authorityChanges.some(change => change.reason === 'intent:sign_manifest'), true);
  assert.equal(authorityChanges.some(change => change.reason.startsWith('payload-ack:')), true);
  assert.equal(authorityChanges.some(change => change.reason.startsWith('finalized:')), true);
});

async function waitUntil(predicate, attempts = 40) {
  for (let index = 0; index < attempts; index += 1) {
    if (predicate()) return true;
    await new Promise(resolve => setTimeout(resolve, 5));
  }
  return false;
}

test('coordinated Farewell keeps the passenger loaded until voice, continuation and deboarding ACK finish', async (t) => {
  const bundle = aptBundle();
  bundle.runtime.lastLiveFlightData = { onGround: true, gsKts: 0, simPaused: false, inMenuOrMap: false };
  bundle.runtime.cargoManifest = {
    version: 6,
    key: 'farewell-manifest',
    dispatchSignature: { scope: 'arrival' },
    items: [{
      id: 'farewell-passenger',
      itemType: 'passenger',
      required: true,
      status: 'loaded',
      passengerCount: 1,
      deliverAtDestination: true
    }]
  };
  bundle.executionEffectPlan.effects['scene.deboarding'] = {
    command: {
      type: 'mission_scene_deboarding',
      sceneId: 'scene-mission-runtime-apt',
      path: [{ forwardM: 4.5, rightM: 8.5 }, { forwardM: 16, rightM: -8 }]
    }
  };
  const farewellContext = farewellVoiceCore.createContext({
    missionId: bundle.missionId,
    missionAudioKey: `farewell:${bundle.missionId}`,
    key: `farewell:${bundle.missionId}`,
    mode: 'passenger',
    baseContext: 'ROLLE: Mara (Passagier)\nAUSGABE: Nur gesprochener Text.',
    speaker: { name: 'Mara', role: 'Passagier', gender: 'female' },
    passenger: { role: 'Passagier' },
    flight: { depLabel: 'EDTW', arrLabel: 'EDTL' }
  });
  bundle.executionEffectPlan.effects['voice.farewell'] = {
    recipe: farewellVoiceCore.createRecipe({
      missionId: bundle.missionId,
      prompt: 'Veralteter Prompt aus dem Handoff.',
      speaker: farewellContext.speaker
    }),
    context: farewellContext
  };
  bundle.executionReplay = executionCore.createExecutionBundle(bundle);
  bundle.execution = executionCore.createReplayShadowEnvelope(bundle.executionReplay, {
    sourceRevision: 1,
    legacyBundle: bundle
  });

  const manager = committedManager(t, bundle);
  const importedBundle = JSON.parse(JSON.stringify(bundle));
  importedBundle.runtime.startPhase = 'end_ready';
  importedBundle.runtime.runtime = {
    missionId: bundle.missionId,
    phase: 'end_ready',
    active: true,
    startedAt: 1000
  };
  importedBundle.runtime.flightRecorder = { hadAirbornePhase: true };
  const importedSnapshot = manager.getExecutionSnapshot();
  const imported = manager.applyExecutionEvent({
    missionId: importedSnapshot.missionId,
    runId: importedSnapshot.runId,
    expectedRevision: importedSnapshot.authorityRevision,
    expectedExecutionRevision: importedSnapshot.executionRevision,
    expectedExecutionStateHash: importedSnapshot.executionStateHash,
    commandId: 'farewell-import-end-ready',
    reason: 'test:farewell-end-ready',
    event: {
      eventId: 'farewell-import-end-ready',
      type: 'AUTHORITATIVE_SNAPSHOT_IMPORTED',
      sequence: importedSnapshot.executionRevision + 1,
      occurredAt: 2000,
      payload: { resumeBundle: importedBundle }
    }
  });
  assert.equal(imported.ok, true);
  assert.equal(manager.getExecutionSnapshot().state.phase, 'end_ready');
  const commands = [];
  let releaseFarewell;
  let farewellCalls = 0;
  const farewellGate = new Promise(resolve => { releaseFarewell = resolve; });
  const runtime = createTrackerMissionExecutionRuntime({
    authorityManager: manager,
    enabled: true,
    playFarewellVoice: async request => {
      farewellCalls += 1;
      assert.equal(request.farewellRecipe?.prompt, 'Dynamischer App-Farewell zur Landung.');
      assert.equal(request.farewellContext?.schema, farewellVoiceCore.CONTEXT_SCHEMA);
      assert.equal(request.farewellContext?.flight.depLabel, 'EDTW');
      assert.equal(typeof request.farewellDynamicContext?.record, 'object');
      await farewellGate;
      return {
        ok: true,
        status: 'completed',
        sideEffect: true,
        commandId: request.commandId,
        voiceOutcome: {
          schema: 'ga.mission-voice-outcome.v1',
          kind: 'farewell',
          status: 'ok',
          text: 'Danke fuers Mitnehmen.',
          playback: 'completed'
        }
      };
    }
  });
  const bridge = runtime.attachSimulator({
    getLivePosition: () => ({ lat: 48.3, lon: 8.5, alt: 900, hdg: 180 }),
    dispatchCommand: command => {
      commands.push(command);
      return {
        ok: true,
        status: command.type === 'mission_scene_deboarding' ? 'pending' : 'completed',
        sideEffect: true
      };
    },
    syncPayloadManifestState: () => ({ ok: true, status: 'completed', sideEffect: false })
  });
  const run = manager.getActiveRun();
  const close = await runtime.executeIntent({
    commandId: 'farewell-close',
    intent: 'request_close',
    missionId: run.missionId,
    runId: run.runId,
    expectedRevision: run.revision,
    payload: {
      farewellVoiceRecipe: farewellVoiceCore.createRecipe({
        missionId: run.missionId,
        prompt: 'Dynamischer App-Farewell zur Landung.',
        speaker: { name: 'Mara', gender: 'female' },
        playCue: true,
        cueId: 'deboarding_pax'
      })
    }
  });
  assert.equal(close.ok, true);
  assert.equal(commands[0].type, 'mission_scene_deboarding');
  assert.equal(commands[0].coordinateFarewell, true);
  assert.equal(manager.getExecutionSnapshot().state.manifest.items[0].status, 'loaded');
  assert.doesNotMatch(JSON.stringify(manager.getPublicSnapshot()), /Dynamischer App-Farewell/);

  assert.equal(bridge.handleAck({
    type: 'mission_scene_deboarding_stage',
    commandId: commands[0].commandId,
    stage: 'cue',
    status: 'ok'
  }), true);
  assert.equal(await waitUntil(() => farewellCalls === 1), true);
  assert.equal(commands.length, 1, 'deboarding must not continue while Farewell is playing');
  assert.equal(manager.getExecutionSnapshot().state.manifest.items[0].status, 'loaded');

  releaseFarewell();
  assert.equal(await waitUntil(() => commands.some(command => command.type === 'mission_scene_deboarding_continue')), true);
  const continuation = commands.find(command => command.type === 'mission_scene_deboarding_continue');
  assert.equal(continuation.deboardingCommandId, commands[0].commandId);
  assert.equal(manager.getExecutionSnapshot().state.manifest.items[0].status, 'loaded');

  assert.equal(bridge.handleAck({
    type: 'mission_scene_deboarding_ack',
    commandId: commands[0].commandId,
    status: 'ok'
  }), true);
  assert.equal(await waitUntil(() => manager.getActiveRun() === null), true);
  assert.equal(manager.getPublicSnapshot().lastExecution.voice.farewell.text, 'Danke fuers Mitnehmen.');
  assert.equal(manager.getPublicSnapshot().lastExecution.phase, 'closed');
});

test('enabled runtime dispatches app-prepared APT scenes and advances only from simulator ACKs', async (t) => {
  const manager = committedManager(t);
  const commands = [];
  const runtimeLogs = [];
  let payloadSyncs = 0;
  const runtime = createTrackerMissionExecutionRuntime({
    authorityManager: manager,
    enabled: true,
    log: line => runtimeLogs.push(line)
  });
  const bridge = runtime.attachSimulator({
    getLivePosition: () => ({ lat: 48.01, lon: 8.02, alt: 1200, hdg: 180 }),
    syncPayloadBeforeStart: request => {
      payloadSyncs += 1;
      assert.equal(Array.isArray(request.manifest.items), true);
      return { ok: true, status: 'completed', sideEffect: false };
    },
    dispatchCommand: command => {
      commands.push(command);
      return { ok: true, status: 'pending', sideEffect: true };
    }
  });
  const run = manager.getActiveRun();
  const prepared = await runtime.executeIntent({
    commandId: 'intent-prepare',
    intent: 'prepare_mission',
    missionId: run.missionId,
    runId: run.runId,
    expectedRevision: run.revision
  });
  assert.equal(prepared.ok, true);
  assert.equal(commands.length, 1, JSON.stringify(prepared));
  assert.equal(commands[0].type, 'mission_scene_spawn');
  assert.equal(manager.getExecutionSnapshot().state.phase, 'prepare');

  bridge.handleAck({ type: 'mission_scene_spawn_ack', commandId: commands[0].commandId, status: 'ok' });
  assert.equal(
    await waitUntil(() => manager.getExecutionSnapshot().view.allowedActions.includes('start_boarding')),
    true,
    JSON.stringify({ commands, snapshot: manager.getExecutionSnapshot() })
  );
  const boardingStartRun = manager.getActiveRun();
  assert.equal((await runtime.executeIntent({
    commandId: 'intent-start-boarding',
    intent: 'start_boarding',
    missionId: boardingStartRun.missionId,
    runId: boardingStartRun.runId,
    expectedRevision: boardingStartRun.revision
  })).ok, true);
  assert.equal(await waitUntil(() => commands.length === 2), true);
  assert.equal(commands[1].type, 'mission_scene_boarding');
  assert.equal(manager.getExecutionSnapshot().state.phase, 'boarding');

  // App parity: payload finalization may complete while the independent
  // boarding animation still waits for its simulator ACK.
  const boardingRun = manager.getActiveRun();
  const loaded = await runtime.executeIntent({
    commandId: 'intent-confirm-load',
    intent: 'confirm_load',
    missionId: boardingRun.missionId,
    runId: boardingRun.runId,
    expectedRevision: boardingRun.revision
  });
  assert.equal(loaded.ok, true);
  assert.equal(payloadSyncs, 1);
  assert.equal(manager.getExecutionSnapshot().state.flags.loadConfirmed, true);
  assert.equal(manager.getExecutionSnapshot().state.phase, 'boarding');

  bridge.handleAck({ type: 'mission_scene_boarding_ack', commandId: commands[1].commandId, status: 'ok' });
  assert.equal(await waitUntil(() => manager.getExecutionSnapshot().state.effects.every(effect => effect.status === 'completed')), true);
  assert.equal(manager.getExecutionSnapshot().state.phase, 'boarded');
  assert.equal(manager.getExecutionSnapshot().state.effects.every(effect => effect.status === 'completed'), true);

  const startRun = manager.getActiveRun();
  assert.equal((await runtime.executeIntent({
    commandId: 'intent-start',
    intent: 'start_mission',
    missionId: startRun.missionId,
    runId: startRun.runId,
    expectedRevision: startRun.revision
  })).ok, true);
  runtime.observeTelemetry({ observedAt: 8000, lat: 48.1, lon: 8.2, onGround: true, gsKts: 0, simPaused: true, dialogMode: 1 });
  runtime.observeTelemetry({ observedAt: 8500, lat: 48.1, lon: 8.2, onGround: true, gsKts: 0, simPaused: true, dialogMode: 1 });
  assert.equal(runtimeLogs.filter(line => line.startsWith('MISSION_EXECUTION_TELEMETRY_IGNORED')).length, 1);
  assert.match(runtimeLogs.join('\n'), /reason=simulation_not_running .*paused=1 .*dialog=1/);
  runtime.observeTelemetry({ observedAt: 10000, lat: 48.1, lon: 8.2, onGround: false, gsKts: 60 });
  runtime.observeTelemetry({ observedAt: 12000, lat: 48.1, lon: 8.2, onGround: false, gsKts: 70 });
  runtime.observeTelemetry({ observedAt: 13000, lat: 48.3, lon: 8.5, onGround: true, gsKts: 20 });
  runtime.observeTelemetry({ observedAt: 14000, lat: 48.3, lon: 8.5, onGround: true, gsKts: 1 });
  runtime.observeTelemetry({ observedAt: 17000, lat: 48.3, lon: 8.5, onGround: true, gsKts: 0.5 });
  assert.equal(manager.getExecutionSnapshot().state.phase, 'end_ready');

  const closeRun = manager.getActiveRun();
  const closed = await runtime.executeIntent({
    commandId: 'intent-close',
    intent: 'request_close',
    missionId: closeRun.missionId,
    runId: closeRun.runId,
    expectedRevision: closeRun.revision
  });
  assert.equal(closed.ok, true);
  assert.equal(manager.getActiveRun(), null);
  assert.equal(manager.getPublicSnapshot().lastRun.state, 'completed');
  assert.equal(manager.getPublicSnapshot().lastRun.phase, 'closed');
});

test('simulator reconnect cancels payload work and immediately redrives persisted effects', async (t) => {
  const manager = committedManager(t);
  const runtime = createTrackerMissionExecutionRuntime({
    authorityManager: manager,
    enabled: true
  });
  let dispatches = 0;
  let cancellations = 0;
  const simulator = {
    getLivePosition: () => ({ lat: 48, lon: 8, alt: 1000, hdg: 90 }),
    dispatchCommand: () => {
      dispatches += 1;
      return { ok: true, status: 'pending', sideEffect: true };
    },
    cancelPayloadSync: () => {
      cancellations += 1;
      return { ok: true, status: 'cancelled' };
    }
  };
  const firstBridge = runtime.attachSimulator(simulator);
  let run = manager.getActiveRun();
  assert.equal((await runtime.executeIntent({
    commandId: 'prepare-before-reconnect',
    intent: 'prepare_mission',
    missionId: run.missionId,
    runId: run.runId,
    expectedRevision: run.revision
  })).ok, true);
  assert.equal(dispatches, 1);
  assert.equal(runtime.publicState().effects.awaitingAck.length, 1);
  assert.equal(runtime.detachSimulator(firstBridge), true);
  assert.equal(await waitUntil(() => cancellations === 1), true);
  assert.equal(runtime.publicState().effects.awaitingAck.length, 0);

  runtime.attachSimulator(simulator);
  assert.equal(await waitUntil(() => dispatches === 2
    && runtime.publicState().effects.awaitingAck.length === 1), true);
  assert.equal(manager.getExecutionSnapshot().state.effects.some(effect => effect.status === 'requested'), true);
});

test('tracker abort cleans simulator effects before atomically releasing the active run', async (t) => {
  const manager = committedManager(t);
  const cleanupCalls = [];
  const logs = [];
  const runtime = createTrackerMissionExecutionRuntime({ authorityManager: manager, enabled: true, log: line => logs.push(line) });
  runtime.attachSimulator({
    getLivePosition: () => null,
    dispatchCommand: () => ({ ok: true, status: 'noop', sideEffect: false }),
    cleanupMission: async request => {
      cleanupCalls.push(request);
      return { ok: true, status: 'ok', cleared: 3, sideEffect: true };
    }
  });
  const run = manager.getActiveRun();
  const aborted = await runtime.executeIntent({
    commandId: 'intent-abort',
    intent: 'abort_mission',
    missionId: run.missionId,
    runId: run.runId,
    expectedRevision: run.revision,
    payload: { reason: 'test-recovery' },
    controllerSession: { clientId: 'efb-test', role: 'efb' }
  });

  assert.equal(aborted.ok, true);
  assert.equal(aborted.outcome, 'aborted');
  assert.equal(cleanupCalls.length, 1);
  assert.equal(cleanupCalls[0].missionId, run.missionId);
  assert.equal(manager.getActiveRun(), null);
  assert.equal(manager.getPublicSnapshot().lastRun.state, 'aborted');
  assert.equal(manager.getPublicSnapshot().lastRun.phase, 'closed');
  assert.equal(manager.getPublicSnapshot().lastRun.lastCommandType, 'mission_execution_abort');
  assert.match(logs.join('\n'), /MISSION_EXECUTION_ABORTED .*cleared=3 .*source=efb/);
});

test('tracker abort retains authority when simulator cleanup fails', async (t) => {
  const manager = committedManager(t);
  const runtime = createTrackerMissionExecutionRuntime({ authorityManager: manager, enabled: true });
  runtime.attachSimulator({
    getLivePosition: () => null,
    dispatchCommand: () => ({ ok: true, status: 'noop', sideEffect: false }),
    cleanupMission: async () => ({ ok: false, status: 'error', error: 'sim_cleanup_failed', cleared: 0 })
  });
  const run = manager.getActiveRun();
  const aborted = await runtime.executeIntent({
    commandId: 'intent-abort-failed',
    intent: 'abort_mission',
    missionId: run.missionId,
    runId: run.runId,
    expectedRevision: run.revision
  });

  assert.equal(aborted.ok, false);
  assert.equal(aborted.error, 'sim_cleanup_failed');
  assert.equal(manager.getActiveRun().runId, run.runId);
});

test('tracker abort retains authority while a written payload still needs a connected simulator restore', async (t) => {
  const manager = committedManager(t);
  const run = manager.getActiveRun();
  const recoveryCredentials = { missionId: run.missionId, runId: run.runId };
  assert.equal(manager.recordExecutionPayloadRecovery({
    ...recoveryCredentials,
    action: 'capture',
    baseline: {
      payloadAdapter: 'msfs_payload_stations',
      payloadStationCount: 2,
      sampledStationCount: 2,
      stations: [{ index: 1, weightLbs: 170 }, { index: 2, weightLbs: 0 }]
    }
  }).ok, true);
  assert.equal(manager.recordExecutionPayloadRecovery({ ...recoveryCredentials, action: 'write_attempted' }).ok, true);
  const runtime = createTrackerMissionExecutionRuntime({ authorityManager: manager, enabled: true });
  const blocked = await runtime.executeIntent({
    commandId: 'intent-abort-without-simulator',
    intent: 'abort_mission',
    missionId: run.missionId,
    runId: run.runId,
    expectedRevision: run.revision
  });
  assert.equal(blocked.ok, false);
  assert.equal(blocked.status, 'blocked');
  assert.equal(blocked.error, 'mission_payload_restore_simulator_not_connected');
  assert.equal(manager.getActiveRun().runId, run.runId);
});

test('disabled runtime remains read-only and cannot attach simulator effects', () => {
  const manager = { getActiveRun: () => null };
  const runtime = createTrackerMissionExecutionRuntime({ authorityManager: manager, enabled: false });
  assert.equal(runtime.executionAuthority, 'web');
  assert.equal(runtime.executeIntent, null);
  assert.equal(runtime.attachSimulator({}), null);
  assert.equal(runtime.observeTelemetry({}).error, 'mission_execution_runtime_disabled');
});


for (const approachOnGround of [false, true]) {
test(`stalled voice does not block cargo; APT approach triggers once at 4 NM (onGround=${approachOnGround})`, async t => {
  const bundle = aptBundle();
  bundle.runtime.cargoManifest.items = [
    { id: 'pax', itemType: 'passenger', required: true, status: 'pending', passengerCount: 1, deliverAtDestination: true },
    { id: 'box', itemType: 'cargo', required: true, status: 'pending', deliverAtDestination: true }
  ];
  bundle.missionState.routeWaypoints = [{ lat: 48.1, lng: 8.2 }, { lat: 48.3, lng: 8.5 }];
  bundle.executionEffectPlan.effects['voice.approach'] = { context: { supported: true, mode: 'passenger' } };
  bundle.executionReplay = executionCore.createExecutionBundle(bundle);
  bundle.execution = executionCore.createReplayShadowEnvelope(bundle.executionReplay, { sourceRevision: 1, legacyBundle: bundle });
  const manager = committedManager(t, bundle);
  const originalGetActiveRun = manager.getActiveRun;
  manager.getActiveRun = options => {
    assert.notEqual(options?.includeBundle, true, 'runtime must not copy the mission seed for telemetry or effect dispatch');
    return originalGetActiveRun(options);
  };
  let releaseBoarding;
  const calls = [];
  const runtime = createTrackerMissionExecutionRuntime({ authorityManager: manager, enabled: true,
    playBoardingVoice: request => {
      calls.push(request.effect.type);
      if (request.effect.type === 'voice.boarding') return new Promise(resolve => { releaseBoarding = resolve; });
      return { ok: true, status: 'completed', voiceOutcome: { schema: 'ga.mission-voice-outcome.v1', kind: 'approach', status: 'ok', text: 'Anflug.', playback: 'completed' } };
    }
  });
  runtime.attachSimulator({
    getLivePosition: () => ({ lat: 48.1, lon: 8.2, alt: 500, hdg: 90 }),
    dispatchCommand: () => ({ ok: true, status: 'completed', sideEffect: false }),
    syncPayloadBeforeStart: () => ({ ok: true, status: 'completed', sideEffect: false }),
    syncPayloadManifestState: () => ({ ok: true, status: 'completed', sideEffect: false })
  });
  let seq = 0;
  const intent = async (name, payload = {}) => {
    const run = manager.getActiveRun();
    const result = await runtime.executeIntent({ missionId: run.missionId, runId: run.runId, expectedRevision: run.revision,
      commandId: `regression-${++seq}`, intent: name, payload });
    assert.equal(result.ok, true, JSON.stringify(result));
  };
  await intent('prepare_mission');
  await intent('start_boarding');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(typeof releaseBoarding, 'function');
  await intent('set_manifest_item', { itemId: 'box', action: 'load' });
  assert.equal(manager.getExecutionSnapshot().state.cargo.items.find(item => item.id === 'box').status, 'loaded');
  releaseBoarding({ ok: true, status: 'completed' });
  await new Promise(resolve => setImmediate(resolve));
  await intent('sign_manifest');
  await intent('confirm_load');
  await intent('start_mission');
  runtime.observeTelemetry({ observedAt: 10000, lat: 48.1, lon: 8.2, onGround: false, gsKts: 60 });
  runtime.observeTelemetry({ observedAt: 12000, lat: 48.1, lon: 8.2, onGround: false, gsKts: 65 });
  assert.equal(manager.getExecutionSnapshot().state.phase, 'enroute');
  assert.equal(calls.filter(type => type === 'voice.approach').length, 0);
  runtime.observeTelemetry({ observedAt: 14000, lat: 48.28, lon: 8.48, onGround: approachOnGround, gsKts: 65, simPaused: true });
  assert.equal(manager.getExecutionSnapshot().state.effects.filter(effect => effect.type === 'voice.approach').length, 0);
  runtime.observeTelemetry({ observedAt: 16000, lat: 48.28, lon: 8.48, onGround: approachOnGround, gsKts: 65 });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls.filter(type => type === 'voice.approach').length, 1);
  runtime.observeTelemetry({ observedAt: 18000, lat: 48.29, lon: 8.49, onGround: false, gsKts: 65 });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls.filter(type => type === 'voice.approach').length, 1);
  assert.equal(manager.getExecutionSnapshot().state.voice.approach.text, 'Anflug.');
});

}

test('central comfort trigger persists its cooldown and does not repeat after runtime recreation', async t => {
  const bundle = aptBundle();
  bundle.runtime.cargoManifest.items = [{ id: 'pax', itemType: 'passenger', status: 'pending', required: true, passengerCount: 1 }];
  bundle.missionState.routeWaypoints = [{ lat: 48.1, lng: 8.2 }, { lat: 48.3, lng: 8.5 }];
  bundle.executionEffectPlan.effects['voice.approach'] = { context: { supported: true, mode: 'passenger', passenger: {},
    baseContext: 'Passenger', departure: { lat: 48.1, lng: 8.2 } } };
  bundle.executionReplay = executionCore.createExecutionBundle(bundle);
  bundle.execution = executionCore.createReplayShadowEnvelope(bundle.executionReplay, { sourceRevision: 1, legacyBundle: bundle });
  const manager = committedManager(t, bundle);
  const calls = [];
  const options = { authorityManager: manager, enabled: true, playBoardingVoice: request => {
    calls.push(request.effect.type);
    return { ok: true, status: 'completed', voiceOutcome: { kind: request.effect.payload.kind || 'boarding', text: 'Komforttest', status: 'ok' } };
  } };
  let runtime = createTrackerMissionExecutionRuntime(options);
  const simulator = { getLivePosition: () => ({ lat: 48.1, lon: 8.2 }),
    dispatchCommand: () => ({ ok: true, status: 'completed' }), syncPayloadBeforeStart: () => ({ ok: true, status: 'completed' }),
    syncPayloadManifestState: () => ({ ok: true, status: 'completed' }) };
  runtime.attachSimulator(simulator);
  let seq = 0;
  for (const intent of ['prepare_mission', 'start_boarding', 'sign_manifest', 'confirm_load', 'start_mission']) {
    const run = manager.getActiveRun();
    const result = await runtime.executeIntent({ missionId: run.missionId, runId: run.runId, expectedRevision: run.revision,
      commandId: `flight-trigger-${++seq}`, intent });
    assert.equal(result.ok, true, JSON.stringify(result));
    await new Promise(resolve => setImmediate(resolve));
  }
  const tick = observedAt => runtime.observeTelemetry({ observedAt, lat: 48.2, lon: 8.3, onGround: false,
    gsKts: 70, aglFt: 2000, gForce: 1, bankDeg: 0, vsFpm: 0, windKts: 50 });
  for (let now = 100000; now <= 101500; now += 250) { tick(now); await new Promise(resolve => setImmediate(resolve)); }
  assert.equal(calls.filter(type => type === 'voice.flight').length, 1);
  assert.equal(manager.getExecutionSnapshot().state.voice.flight.kind, 'comfort');
  const run = manager.getActiveRun();
  assert.equal(manager.getExecutionRuntimeContext({ missionId: run.missionId, runId: run.runId }).flightVoiceState.count, 1);
  runtime.detachSimulator();
  runtime = createTrackerMissionExecutionRuntime(options); runtime.attachSimulator(simulator);
  for (let now = 102000; now < 106000; now += 250) { tick(now); await new Promise(resolve => setImmediate(resolve)); }
  assert.equal(calls.filter(type => type === 'voice.flight').length, 1);
  const snapshot = manager.getExecutionSnapshot();
  assert.equal(manager.applyExecutionEvent({ missionId: snapshot.missionId, runId: snapshot.runId,
    expectedRevision: snapshot.authorityRevision, expectedExecutionRevision: snapshot.executionRevision,
    expectedExecutionStateHash: snapshot.executionStateHash, commandId: 'pending-approach',
    event: { eventId: 'pending-approach', type: 'APT_APPROACH_VOICE_REQUESTED',
      sequence: snapshot.executionRevision + 1, occurredAt: 190000, payload: {} }
  }).ok, true);
  for (let now = 200000; now < 204000; now += 250) tick(now);
  assert.equal(manager.getExecutionSnapshot().state.effects.filter(effect => effect.type === 'voice.flight' && effect.payload.kind === 'comfort').length, 1,
    'a requested approach already blocks comfort, before any voice ACK');
});

// Run the real Standalone landing-fallback branch against the same trace.
const vm = require('node:vm');
const standaloneSync = fs.readFileSync(path.join(__dirname, '../sync.js'), 'utf8');
const fallbackStart = standaloneSync.indexOf('    if (!r.armed || !r.hadAirbornePhase) return;');
const fallbackEnd = standaloneSync.indexOf('        if ((now - r.lowSpeedSince) >= 5000)', fallbackStart);
assert.ok(fallbackStart >= 0 && fallbackEnd > fallbackStart);
const standaloneFallback = standaloneSync.slice(fallbackStart, fallbackEnd)
  + '\n} else { r.lowSpeedSince = 0; }';
for (const scenario of [
  { name: 'first slow candidate inside 4.5 NM', steps: [{}], expected: 1 },
  { name: 'slow candidate before ground contact', steps: [{ onGround: false }], expected: 1 },
  { name: 'no previous flight', airborne: false, steps: [{}], expected: 0 },
  { name: '18 kt boundary', steps: [{ gsKts: 18 }], expected: 0 },
  { name: '140 ft boundary', steps: [{ aglFt: 140 }], expected: 0 },
  { name: 'outside 4.5 NM', steps: [{ distance: 4.51 }], expected: 0 },
  { name: 'just inside 4.5 NM', steps: [{ distance: 4.499 }], expected: 1 },
  { name: 'continuous low speed entering radius does not retrigger', steps: [{ distance: 4.6 }, {}], expected: 0 },
  { name: 'new low speed candidate after acceleration', steps: [{ distance: 4.6 }, { gsKts: 20 }, {}], expected: 1 },
  { name: 'paused candidate does not consume trigger', steps: [{ simPaused: true }, {}], expected: 1 },
  { name: 'menu candidate does not consume trigger', steps: [{ inMenuOrMap: true }, {}], expected: 1 },
  { name: 'fallback and normal approach remain once-only', steps: [{}, {}, { distance: 3.8 }], expected: 1 }
]) test(`Standalone landing approach parity: ${scenario.name}`, async t => {
  const bundle = aptBundle();
  bundle.missionState.routeWaypoints = [{ lat: 48.38, lng: 8.5 }, { lat: 48.3, lng: 8.5 }];
  bundle.executionEffectPlan.effects['voice.approach'] = { context: { supported: true, mode: 'passenger' } };
  bundle.executionReplay = executionCore.createExecutionBundle(bundle);
  bundle.execution = executionCore.createReplayShadowEnvelope(bundle.executionReplay, { sourceRevision: 1, legacyBundle: bundle });
  const manager = committedManager(t, bundle);
  const runtime = createTrackerMissionExecutionRuntime({ authorityManager: manager, enabled: true,
    playBoardingVoice: () => ({ ok: true, status: 'completed' }) });
  t.after(() => runtime.detachSimulator());
  runtime.attachSimulator({
    dispatchCommand: () => ({ ok: true, status: 'completed' }),
    syncPayloadBeforeStart: () => ({ ok: true, status: 'completed' }),
    getLivePosition: () => ({ lat: 48.38, lon: 8.5, alt: 1500, hdg: 180 })
  });
  let seq = 0;
  for (const intent of ['prepare_mission', 'start_boarding', 'confirm_load', 'start_mission']) {
    const run = manager.getActiveRun();
    const result = await runtime.executeIntent({ missionId: run.missionId, runId: run.runId,
      expectedRevision: run.revision, commandId: `fallback-${++seq}`, intent });
    assert.equal(result.ok, true, JSON.stringify(result));
    await new Promise(resolve => setImmediate(resolve));
  }
  const airborne = scenario.airborne !== false;
  if (airborne) for (const observedAt of [10000, 14000, 18000]) runtime.observeTelemetry({
    observedAt, lat: 48.38, lon: 8.5, altFt: 2000, aglFt: 600, onGround: false, gsKts: 65
  });
  let expectedCalls = 0;
  const reference = { r: { armed: airborne, hadAirbornePhase: airborne, lowSpeedSince: 0 },
    missionRuntime: {}, smoothedVS: 0, lat: 0, lon: 0,
    _missionBushRequiresReturnHome: () => false,
    _distanceToMissionTargetNm: () => reference.distance,
    window: { lastLiveFlightData: {}, triggerPaxAtTarget() { expectedCalls = 1; } } };
  vm.createContext(reference);
  for (const [index, step] of scenario.steps.entries()) {
    const distance = step.distance ?? 4.4;
    const sample = { observedAt: 20000 + index * 1000, lon: 8.5,
      lat: 48.3 + distance / (6371 / 1.852 * Math.PI / 180),
      altFt: 1400, onGround: true, gsKts: 17, aglFt: 139, ...step };
    reference.now = sample.observedAt;
    reference.gs = sample.gsKts;
    reference.agl = sample.aglFt;
    reference.distance = distance;
    if (!sample.simPaused && !sample.inMenuOrMap) vm.runInContext(`(function(){${standaloneFallback}})()`, reference);
    runtime.observeTelemetry(sample);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(manager.getExecutionSnapshot().state.effects.filter(effect => effect.type === 'voice.approach').length,
      expectedCalls, `trace step ${index}`);
  }
  assert.equal(expectedCalls, scenario.expected);
});

test('off-destination cooldown can expire after GROUND_STILL, until the original recorder resets', async t => {
  const bundle = aptBundle();
  bundle.missionState.routeWaypoints = [{ lat: 48.1, lng: 8.2 }, { lat: 48.3, lng: 8.5 }];
  bundle.executionEffectPlan.effects['voice.approach'] = { context: { supported: true, mode: 'passenger',
    passenger: {}, departure: { lat: 48.1, lon: 8.2 }, baseContext: 'Passagier' } };
  bundle.executionReplay = executionCore.createExecutionBundle(bundle);
  bundle.execution = executionCore.createReplayShadowEnvelope(bundle.executionReplay, { sourceRevision: 1, legacyBundle: bundle });
  const manager = committedManager(t, bundle);
  const run = manager.getActiveRun();
  manager.recordExecutionRuntimeContext({ missionId: run.missionId, runId: run.runId,
    context: { flightVoiceState: { offDestLastAt: 104000 } } });
  const runtime = createTrackerMissionExecutionRuntime({ authorityManager: manager, enabled: true,
    playBoardingVoice: () => ({ ok: true, status: 'completed' }) });
  t.after(() => runtime.detachSimulator());
  runtime.attachSimulator({ dispatchCommand: () => ({ ok: true, status: 'completed' }),
    syncPayloadBeforeStart: () => ({ ok: true, status: 'completed' }),
    getLivePosition: () => ({ lat: 48.1, lon: 8.2 }) });
  for (const intent of ['prepare_mission', 'start_boarding', 'confirm_load', 'start_mission']) {
    const current = manager.getActiveRun();
    assert.equal((await runtime.executeIntent({ missionId: current.missionId, runId: current.runId,
      expectedRevision: current.revision, commandId: `offdest-${intent}`, intent })).ok, true);
    await new Promise(resolve => setImmediate(resolve));
  }
  const tick = (observedAt, ground) => runtime.observeTelemetry({ observedAt, lat: 48.1, lon: 8.2,
    onGround: ground, gsKts: ground ? 0 : 65, aglFt: ground ? 0 : 600, altFt: ground ? 1000 : 1600 });
  for (const at of [180000,184000,188000]) tick(at, false);
  tick(190000,true);tick(193000,true);
  const calls = () => manager.getExecutionSnapshot().state.effects.filter(effect => effect.type === 'voice.flight' && effect.payload.kind === 'off_destination');
  assert.equal(calls().length, 0);
  tick(194500,true);
  assert.equal(calls().length, 1, 'cooldown expired on a noop telemetry tick');
  tick(195001,true);tick(300000,true);
  assert.equal(calls().length, 1, 'stable landing reset does not invent repeated landing warnings');
});

test('long loading sessions checkpoint their journal and still confirm payload and restore', async t => {
  const bundle = aptBundle();
  bundle.runtime.cargoManifest.items = Array.from({ length: 35 }, (_, i) => ({
    id: `box-${i}`, itemType: 'cargo', required: true, status: 'loaded',
    label: `Equipment ${i} ${'description '.repeat(12)}`, weightLbs: 2, deliverAtDestination: true
  }));
  bundle.executionReplay = executionCore.createExecutionBundle(bundle);
  bundle.execution = executionCore.createReplayShadowEnvelope(bundle.executionReplay, { sourceRevision: 1, legacyBundle: bundle });
  const manager = committedManager(t, bundle);
  for (let index = 0; index < 190; index++) {
    const snapshot = manager.getExecutionSnapshot();
    const result = manager.applyExecutionEvent({
      missionId: snapshot.missionId, runId: snapshot.runId,
      expectedRevision: snapshot.authorityRevision, expectedExecutionRevision: snapshot.executionRevision,
      expectedExecutionStateHash: snapshot.executionStateHash,
      event: { type: index === 0 ? 'PREPARE_REQUESTED' : index === 2 ? 'BOARDING_STARTED' : (index === 1 || index === 3) ? 'EFFECT_ACKNOWLEDGED' : 'CARGO_STATE_CHANGED', eventId: `many-loads-${index}`, sequence: snapshot.executionRevision + 1,
        occurredAt: 10000 + index, payload: (index === 1 || index === 3)
          ? { effectId: snapshot.state.effects.at(-1).effectId, status: 'completed' } : { manifest: snapshot.state.manifest } }
    });
    assert.equal(result.ok, true, `event ${index}: ${JSON.stringify(result)}`);
  }
  const runtime = createTrackerMissionExecutionRuntime({ enabled: true, authorityManager: manager,
    payloadSyncBeforeStart: () => ({ ok: true, status: 'completed' }) });
  const run = manager.getActiveRun();
  assert.equal((await runtime.executeIntent({ intent: 'confirm_load', commandId: 'confirm-after-many-loads',
    missionId: run.missionId, runId: run.runId, expectedRevision: run.revision })).ok, true);
  const snapshot = manager.getExecutionSnapshot();
  assert.equal(snapshot.state.flags.loadConfirmed, true);
  const replay = executionCore.replay(manager.getActiveRun({ includeBundle: true }).resumeBundle.executionReplay);
  assert.equal(replay.stateHash, snapshot.executionStateHash);
  assert.equal(replay.state.cargo.items.length, 35);
  const saved = manager.getActiveRun({ includeBundle: true }).resumeBundle;
  const receipt = saved.executionEventReceipts.at(-1);
  const index = Number(receipt.eventId.split('-').at(-1));
  const duplicate = manager.applyExecutionEvent({ missionId: run.missionId, runId: run.runId,
    event: { type: 'CARGO_STATE_CHANGED', eventId: receipt.eventId, sequence: receipt.sequence,
      occurredAt: 10000 + index, payload: { manifest: snapshot.state.manifest } } });
  assert.equal(duplicate.duplicate, true, JSON.stringify(duplicate));
  const changedDuplicate = manager.applyExecutionEvent({ missionId: run.missionId, runId: run.runId,
    event: { type: 'CARGO_STATE_CHANGED', eventId: receipt.eventId, sequence: receipt.sequence,
      occurredAt: 10000 + index, payload: { manifest: {} } } });
  assert.equal(changedDuplicate.error, 'mission_execution_event_id_conflict');
});

test('cargo close is a shared run event and changes no mission flags or manifest', async t => {
  const manager = committedManager(t);
  const runtime = createTrackerMissionExecutionRuntime({ enabled: true, authorityManager: manager });
  const before = manager.getExecutionSnapshot().state;
  const run = manager.getActiveRun();
  const result = await runtime.executeIntent({ intent: 'close_cargo_window', commandId: 'close-on-phone',
    missionId: run.missionId, runId: run.runId, expectedRevision: run.revision });
  assert.equal(result.ok, true);
  const after = manager.getExecutionSnapshot().state;
  assert.match(after.cargoWindowCloseId, /close-on-phone/);
  assert.deepEqual(after.flags, before.flags);
  assert.deepEqual(after.manifest, before.manifest);
  assert.equal(manager.getPublicSnapshot().execution.cargoWindowCloseId, after.cargoWindowCloseId);
});

test('prepare mission prewarms boarding without waiting for voice generation', async t => {
  const manager=committedManager(t);const calls=[];
  const runtime=createTrackerMissionExecutionRuntime({authorityManager:manager,enabled:true,
    prepareBoardingVoice:request=>{calls.push(request);return new Promise(()=>{});} });
  runtime.attachSimulator({getLivePosition:()=>({lat:48.3,lon:8.5,alt:500,hdg:90}),
    dispatchCommand:()=>({ok:true,status:'completed',sideEffect:false})});
  const run=manager.getActiveRun();
  const result=await runtime.executeIntent({commandId:'prepare-prewarm',intent:'prepare_mission',
    missionId:run.missionId,runId:run.runId,expectedRevision:run.revision,deferEffects:true});
  await Promise.resolve();
  assert.equal(result.ok,true);
  assert.equal(calls.length,1);
  assert.equal(calls[0].runId,run.runId);
  assert.equal(calls[0].livePosition.lat,48.3);
});

test('deferred intent resolves its ACK before starting simulator effects', async t => {
  const manager = committedManager(t);
  const calls = [];
  const runtime = createTrackerMissionExecutionRuntime({ authorityManager: manager, enabled: true });
  runtime.attachSimulator({ getLivePosition: () => ({ lat: 48.3, lon: 8.5, alt: 500, hdg: 90 }),
    dispatchCommand: () => { calls.push('sim'); return { ok: true, status: 'completed', sideEffect: false }; } });
  const run = manager.getActiveRun();
  const result = await runtime.executeIntent({ commandId: 'deferred-prepare', intent: 'prepare_mission',
    missionId: run.missionId, runId: run.runId, expectedRevision: run.revision, deferEffects: true });
  calls.push('ack');
  assert.equal(result.ok, true);
  assert.deepEqual(calls, ['ack']);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls[1], 'sim');
});
