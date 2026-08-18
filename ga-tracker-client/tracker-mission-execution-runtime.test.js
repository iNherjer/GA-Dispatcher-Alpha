'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const executionCore = require('../mission-execution-core.js');
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

function committedManager(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ga-execution-runtime-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const manager = createMissionAuthorityManager({
    storageFile: path.join(directory, 'authority.json'),
    idFactory: () => 'run-runtime-apt',
    executionAuthorityEnabled: true
  });
  const bundle = aptBundle();
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

async function waitUntil(predicate, attempts = 40) {
  for (let index = 0; index < attempts; index += 1) {
    if (predicate()) return true;
    await new Promise(resolve => setTimeout(resolve, 5));
  }
  return false;
}

test('enabled runtime dispatches app-prepared APT scenes and advances only from simulator ACKs', async (t) => {
  const manager = committedManager(t);
  const commands = [];
  const runtimeLogs = [];
  const runtime = createTrackerMissionExecutionRuntime({ authorityManager: manager, enabled: true, log: line => runtimeLogs.push(line) });
  const bridge = runtime.attachSimulator({
    getLivePosition: () => ({ lat: 48.01, lon: 8.02, alt: 1200, hdg: 180 }),
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
    await waitUntil(() => commands.length === 2),
    true,
    JSON.stringify({ commands, snapshot: manager.getExecutionSnapshot() })
  );
  assert.equal(commands[1].type, 'mission_scene_boarding');
  assert.equal(manager.getExecutionSnapshot().state.phase, 'boarding');

  bridge.handleAck({ type: 'mission_scene_boarding_ack', commandId: commands[1].commandId, status: 'ok' });
  assert.equal(await waitUntil(() => manager.getExecutionSnapshot().state.effects.every(effect => effect.status === 'completed')), true);
  assert.equal(manager.getExecutionSnapshot().state.phase, 'boarding');
  const boardingRun = manager.getActiveRun();
  const loaded = await runtime.executeIntent({
    commandId: 'intent-confirm-load',
    intent: 'confirm_load',
    missionId: boardingRun.missionId,
    runId: boardingRun.runId,
    expectedRevision: boardingRun.revision
  });
  assert.equal(loaded.ok, true);
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

test('disabled runtime remains read-only and cannot attach simulator effects', () => {
  const manager = { getActiveRun: () => null };
  const runtime = createTrackerMissionExecutionRuntime({ authorityManager: manager, enabled: false });
  assert.equal(runtime.executionAuthority, 'web');
  assert.equal(runtime.executeIntent, null);
  assert.equal(runtime.attachSimulator({}), null);
  assert.equal(runtime.observeTelemetry({}).error, 'mission_execution_runtime_disabled');
});
