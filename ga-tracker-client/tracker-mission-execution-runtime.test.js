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
  const runtime = createTrackerMissionExecutionRuntime({
    authorityManager: manager,
    enabled: true,
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
    })
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
  runtime.observeTelemetry({ observedAt: 13000, lat: 48.3, lon: 8.5, onGround: true, gsKts: 20 });
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
  assert.equal(await waitUntil(() => manager.getExecutionSnapshot().state.effects.every(effect => effect.status === 'completed')), true);
  assert.equal(manager.getExecutionSnapshot().state.payload.status, 'ok');
  assert.equal(confirmed.effectDispatch.pendingCount, 0);
  assert.equal(manager.getExecutionSnapshot().state.flags.unloadConfirmed, true);
  assert.equal(manager.getExecutionSnapshot().state.effects.every(effect => effect.status === 'completed'), true);

  run = manager.getActiveRun();
  const closed = await runtime.executeIntent({
    commandId: 'close-arrival-runtime',
    intent: 'request_close',
    missionId: run.missionId,
    runId: run.runId,
    expectedRevision: run.revision
  });
  assert.equal(closed.ok, true);
  assert.equal(manager.getActiveRun(), null);
  assert.equal(manager.getPublicSnapshot().lastExecution.phase, 'closed');
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
