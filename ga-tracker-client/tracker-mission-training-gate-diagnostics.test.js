'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const executionCore = require('../mission-execution-core.js');
const { createMissionAuthorityManager } = require('./mission-authority-core.js');
const { createTrackerMissionExecutionRuntime } = require('./tracker-mission-execution-runtime.js');
const trainingFixture = require('./tracker-mission-training-fixture.js');
const { EFFECT_PLAN_SCHEMA } = require('./tracker-mission-simulator-effects.js');

function activeManager(t, bundle, id) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'training-gate-diagnostic-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const manager = createMissionAuthorityManager({ storageFile: path.join(directory, 'authority.json'),
    idFactory: () => id, executionAuthorityEnabled: true, poiExecutionEnabled: true });
  const replay = executionCore.replay(bundle.executionReplay);
  const acquired = manager.acquire({ missionId: bundle.missionId, clientId: 'web-owner', stateHash: `web-${id}`, resumeBundle: bundle });
  const prepared = manager.prepareExecutionAuthority({ missionId: acquired.activeRun.missionId, clientId: 'web-owner',
    runId: acquired.activeRun.runId, expectedRevision: acquired.activeRun.revision,
    expectedStateHash: acquired.activeRun.stateHash, expectedExecutionStateHash: replay.stateHash });
  assert.equal(prepared.ok, true, JSON.stringify(prepared));
  const committed = manager.commitExecutionAuthority({ missionId: prepared.activeRun.missionId, clientId: 'web-owner',
    runId: prepared.activeRun.runId, expectedRevision: prepared.activeRun.revision,
    expectedExecutionStateHash: prepared.activeRun.executionStateHash, handoffId: prepared.handoff.handoffId });
  assert.equal(committed.ok, true, JSON.stringify(committed));
  return manager;
}

async function activate(runtime, manager, id) {
  for (const [intent, payload] of [['prepare_mission', {}], ['start_boarding', {}],
    ['set_manifest_item', { itemId: 'camera', action: 'load' }], ['sign_manifest', {}],
    ['confirm_load', {}], ['start_mission', {}]]) {
    const run = manager.getActiveRun();
    const result = await runtime.executeIntent({ intent, payload, commandId: `${id}-${intent}`,
      missionId: run.missionId, runId: run.runId, expectedRevision: run.revision });
    assert.equal(result.ok, true, JSON.stringify(result));
    await new Promise(resolve => setImmediate(resolve));
  }
  assert.equal(manager.getExecutionSnapshot().state.flags.active, true);
}

function nonTrainingBundle() {
  const missionId = 'training-gate-non-training';
  const passenger = { name: 'Alex', taskDomain: 'charter', roleProfile: 'charter_professional_neutral_v1' };
  const bundle = {
    version: 2, missionId, adapter: 'apt', descriptor: { primaryAdapter: 'apt' },
    missionState: { currentMissionData: { missionId, missionType: 'apt', start: 'EDTW', dest: 'EDTL', passenger } },
    runtime: { missionId, startPhase: 'planned', lastLiveFlightData: { onGround: true, gsKts: 0 },
      runtime: { missionId, phase: 'planned', active: false },
      cargoManifest: { version: 6, key: 'non-training-pax-manifest', dispatchSignature: { scope: 'departure' },
        items: [{ id: 'pax', itemType: 'passenger', required: true, status: 'pending', passengerCount: 1 }] } },
    executionEffectPlan: { schema: EFFECT_PLAN_SCHEMA, recipe: 'apt', missionId, effects: {
      'scene.prepare': { none: true }, 'scene.boarding': { none: true }, 'scene.deboarding': { none: true },
      'scene.target': { none: true }, 'voice.boarding': { none: true }, 'voice.approach': { none: true },
      'voice.farewell': { none: true }
    } }
  };
  bundle.executionReplay = executionCore.createExecutionBundle(bundle);
  bundle.execution = executionCore.createReplayShadowEnvelope(bundle.executionReplay, { sourceRevision: 1, legacyBundle: bundle });
  return bundle;
}

test('runtime logs training gate inputs on changes and at most every 30s while blocked', async t => {
  const bundle = trainingFixture.bundle();
  const manager = activeManager(t, bundle, 'training-gate-run');
  const lines = [];
  const runtime = createTrackerMissionExecutionRuntime({ authorityManager: manager, enabled: true, log: line => lines.push(line),
    playBoardingVoice: request => ({ ok: true, status: 'completed', commandId: request.commandId }),
    playFarewellVoice: request => ({ ok: true, status: 'completed', commandId: request.commandId }) });
  runtime.attachSimulator({ getLivePosition: () => ({ lat: 48, lon: 8, alt: 3000, hdg: 90 }),
    dispatchCommand: request => ({ ok: true, status: 'completed', commandId: request.commandId }),
    syncPayloadBeforeStart: () => ({ ok: true, status: 'completed' }), syncPayloadManifestState: () => ({ ok: true, status: 'completed' }) });
  await activate(runtime, manager, 'training-gate-run');

  const base = Date.now();
  const sample = (offset, lat, aglFt) => runtime.observeTelemetry({ observedAt: base + offset, lat, lon: 8,
    altFt: 3000, aglFt, gsKts: 85, hdg: 90, bankDeg: 0, vsFpm: 0, onGround: false,
    simPaused: false, inMenuOrMap: false });
  sample(0, 48.05, 1000); // under both departure and ready-altitude gates
  sample(10000, 48.05, 1000); // same blocked gate state: suppressed
  sample(30000, 48.05, 1000); // blocked heartbeat
  sample(31000, 48.12, 2000); // distance and altitude gates pass; briefing is issued
  sample(34000, 48.12, 2000); // stable interval makes start available

  const diagnostics = () => lines.filter(line => line.startsWith('MISSION_TRAINING_GATE_DIAGNOSTIC data='))
    .map(line => JSON.parse(line.slice(line.indexOf(' data=') + 6)));
  const entries = diagnostics();
  assert.equal(entries.length, 4, lines.join('\n'));
  assert.equal(entries[0].domain, 'training');
  assert.equal(entries[0].distanceGate, false);
  assert.equal(entries[0].altitudeGate, false);
  assert.deepEqual(entries[0].missingTelemetry, []);
  assert.equal(entries[1].distanceGate, false, 'blocked heartbeat retains failed distance gate');
  assert.equal(entries[2].distanceGate, true);
  assert.equal(entries[2].altitudeGate, true);
  assert.equal(entries[2].readyPrompted, true);
  assert.equal(entries[3].startAvailable, true);
  assert.equal(entries[0].onGround, false);
  assert.equal(entries[0].simPaused, false);
  assert.equal(entries[0].inMenuOrMap, false);
  assert.equal(entries[0].gsKts, 85);
  assert.equal(entries[0].slewActive, false);
});

test('runtime emits no training gate diagnostics for a non-training mission', async t => {
  const bundle = nonTrainingBundle();
  const manager = activeManager(t, bundle, 'non-training-gate-run');
  const lines = [];
  const runtime = createTrackerMissionExecutionRuntime({ authorityManager: manager, enabled: true, log: line => lines.push(line) });
  runtime.attachSimulator({ getLivePosition: () => ({ lat: 48, lon: 8, alt: 3000, hdg: 90 }),
    dispatchCommand: request => ({ ok: true, status: 'completed', commandId: request.commandId }),
    syncPayloadBeforeStart: () => ({ ok: true, status: 'completed' }), syncPayloadManifestState: () => ({ ok: true, status: 'completed' }) });
  runtime.observeTelemetry({ observedAt: Date.now(), lat: 48.12, lon: 8, altFt: 3000, aglFt: 2000,
    gsKts: 80, hdg: 90, bankDeg: 0, vsFpm: 0, onGround: false, simPaused: false, inMenuOrMap: false });
  assert.equal(lines.some(line => line.startsWith('MISSION_TRAINING_GATE_DIAGNOSTIC ')), false, lines.join('\n'));
});
