'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { setTimeout: delay } = require('node:timers/promises');
const execution = require('../mission-execution-core.js');
const poi = require('./tracker-mission-poi-runtime.js');
const { createMissionAuthorityManager } = require('./mission-authority-core.js');
const { createTrackerMissionExecutionRuntime } = require('./tracker-mission-execution-runtime.js');
const { createTrackerMissionProcess } = require('./tracker-mission-process.js');
const { buildCloudMissionCandidate } = require('./tracker-mission-cloud.js');
const { missionId, bundle } = require('./tracker-mission-training-fixture.js');

const tick = () => new Promise(resolve => setImmediate(resolve));
const completed = () => ({ ok: true, status: 'completed', sideEffect: false });

async function harness(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'training-integration-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const b = bundle();
  const manager = createMissionAuthorityManager({ storageFile: path.join(directory, 'authority.json'), executionAuthorityEnabled: true,
    poiExecutionEnabled: true, poiLifecycleRequired: true, idFactory: () => 'training-run' });
  const acquired = manager.acquire({ missionId, clientId: 'app', stateHash: 'app', resumeBundle: b });
  const prepared = manager.prepareExecutionAuthority({ missionId, runId: acquired.activeRun.runId, clientId: 'app',
    expectedRevision: acquired.activeRun.revision, expectedStateHash: acquired.activeRun.stateHash,
    expectedExecutionStateHash: execution.replay(b.executionReplay).stateHash });
  assert.equal(prepared.ok, true, JSON.stringify(prepared));
  assert.equal(manager.commitExecutionAuthority({ missionId, runId: prepared.activeRun.runId, clientId: 'app',
    expectedRevision: prepared.activeRun.revision, expectedExecutionStateHash: prepared.activeRun.executionStateHash,
    handoffId: prepared.handoff.handoffId }).ok, true);
  const commands = [];
  const runtime = createTrackerMissionExecutionRuntime({ enabled: true, authorityManager: manager,
    payloadSyncBeforeStart: completed, playBoardingVoice: completed, playFarewellVoice: completed });
  runtime.attachSimulator({ getLivePosition: () => ({ lat: 48.3, lon: 8.5, altFt: 940, hdg: 0 }),
    dispatchCommand: command => { commands.push(command); return completed(); }, syncPayloadManifestState: completed, cleanupMission: completed });
  await tick();
  let serial = 0;
  async function intent(name, payload = {}, fixedCommandId = '', options = {}) {
    const run = manager.getActiveRun();
    const result = await runtime.executeIntent({ intent: name, payload, commandId: fixedCommandId || `training-${++serial}`,
      missionId: run.missionId, runId: run.runId, expectedRevision: options.expectedRevision ?? run.revision });
    for (let i = 0; i < 8; i++) await tick();
    return result;
  }
  async function sample(patch = {}) {
    const result = runtime.observeTelemetry({ observedAt: Date.now(), lat: 48.3, lon: 8.5, altFt: 3000, aglFt: 3000,
      gsKts: 85, hdg: 0, onGround: false, ...patch });
    assert.equal(result.ok, true, JSON.stringify(result));
    for (let i = 0; i < 5; i++) await tick();
    await runtime.flush();
  }
  return { b, manager, runtime, commands, intent, sample, directory };
}

async function start(h) {
  assert.equal((await h.intent('prepare_mission')).ok, true);
  assert.equal((await h.intent('start_boarding')).ok, true);
  assert.equal((await h.intent('start_mission')).ok, false, 'real cargo gate remains active');
  assert.equal((await h.intent('set_manifest_item', { itemId: 'camera', action: 'load' })).ok, true);
  assert.equal((await h.intent('sign_manifest')).ok, true);
  assert.equal((await h.intent('confirm_load')).ok, true);
  assert.equal((await h.intent('start_mission')).ok, true);
}

test('Training cloud gate requires the complete original recipe', () => {
  const b = bundle();
  assert.equal(poi.validateBundle(b), null);
  const profile = { activeMission: b.missionState, activeMissionTrackerSeed: { schema: 'ga.tracker-cloud-mission-seed.v1', version: 1,
    missionId, adapter: 'poi', executionPoiRecipe: b.executionPoiRecipe, executionEffectPlan: b.executionEffectPlan } };
  assert.equal(buildCloudMissionCandidate(profile, { poiExecutionEnabled: true }).status, 'ready');
  delete b.executionPoiRecipe.trainingRecipe;
  assert.equal(poi.validateBundle(b), 'training_recipe_invalid');
});

test('Training uses common loading, ready intent, stale revision protection and abort in live authority', async t => {
  const h = await harness(t); await start(h);
  const base = Date.now();
  await h.sample({ observedAt: base, aglFt: 3000, bankDeg: 0, vsFpm: 0 });
  await h.sample({ observedAt: base + 3100, aglFt: 3000, bankDeg: 0, vsFpm: 0 });
  assert.ok(h.manager.getExecutionSnapshot().state.poiTask.trainingState.progress.startAvailable);
  assert.ok(h.manager.getExecutionSnapshot().view.allowedActions.includes('training_ready'));
  const staleRevision = h.manager.getActiveRun().revision;
  assert.equal((await h.intent('training_ready')).ok, true);
  const stale = await h.intent('training_abort', {}, 'training-stale-abort', { expectedRevision: staleRevision });
  assert.equal(stale.error, 'mission_revision_conflict', JSON.stringify(stale));
  await h.sample({ observedAt: base + 3200, aglFt: 3000, bankDeg: 0, vsFpm: 0 });
  assert.equal(h.manager.getExecutionSnapshot().state.poiTask.trainingState.progress.activeExercise.status, 'active');
  assert.equal((await h.intent('training_abort')).ok, true);
  assert.equal(h.manager.getExecutionSnapshot().state.poiTask.trainingState.progress.activeExercise.status, 'repeat');
  const snap = h.manager.getExecutionSnapshot();
  assert.ok(snap.state.effects.some(e => e.type === 'voice.poi' && e.payload.action === 'training_abort'));
});

test('Original turn completion allows optional exercise after shared POI satisfaction; gaps reset only active work', () => {
  const recipe = bundle().executionPoiRecipe;
  let state = null, time = 10000;
  const sample = (heading = 0, bank = 0, increment = 1000) => { time += increment; return { observedAt: time,
    lat: 48.3, lon: 8.5, altFt: 3000, aglFt: 3000, hdg: heading, bankDeg: bank, vsFpm: 0, gsKts: 90,
    gForce: 1.1, onGround: false }; };
  const tickPoi = (hdg = 0, bank = 0, dt = 1000) => {
    const result = poi.observe(recipe, state, sample(hdg, bank, dt), { active: true, trackingActive: true });
    assert.equal(result.changed, true, result.reason); state = result.state; return result;
  };
  tickPoi(); tickPoi(); tickPoi(); tickPoi();
  state = poi.trainingAction(recipe, state, 'training_ready', ++time).poiTask;
  tickPoi(); for (let hdg = 10; hdg <= 180; hdg += 10) tickPoi(hdg, 30);
  tickPoi(180, 0); tickPoi(180, 0); tickPoi(180, 0);
  assert.equal(state.detector.satisfied, true);
  assert.equal(state.trainingState.progress.requiredComplete, true);
  state = poi.trainingAction(recipe, state, 'training_extra', ++time).poiTask;
  tickPoi(180); tickPoi(180); tickPoi(180); tickPoi(180);
  assert.equal(state.trainingState.progress.startAvailable, true);
  state = poi.trainingAction(recipe, state, 'training_ready', ++time).poiTask; tickPoi(180);
  assert.equal(state.trainingState.progress.activeExercise.status, 'active');
  tickPoi(190, 30, 7000);
  assert.equal(state.trainingState.progress.completedCount, 1);
  assert.equal(state.detector.satisfied, true);
  assert.equal(state.trainingState.progress.activeExercise.status, 'repeat');
  const restored = poi.createState(recipe, JSON.parse(JSON.stringify(state)));
  assert.deepEqual(restored.trainingState, state.trainingState);
});

async function until(predicate) {
  for (let index = 0; index < 300; index++) { if (predicate()) return; await delay(10); }
  assert.fail('condition did not become true');
}

test('training telemetry and intents run in the real mission child process', async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'training-process-'));
  const host = await createTrackerMissionProcess({ enabled: true, pilotId: 'test', flightLogDirectory: directory,
    authority: { storageFile: path.join(directory, 'authority.json'), executionAuthorityEnabled: true, poiExecutionEnabled: true },
    playBoardingVoice: completed, playFarewellVoice: completed });
  t.after(async () => { await host.close(); fs.rmSync(directory, { recursive: true, force: true }); });
  assert.notEqual(host.runtime.publicState().processId, process.pid);
  const value = bundle();
  const acquired = await host.authorityManager.acquire({ missionId, clientId: 'owner', stateHash: 'web', resumeBundle: value });
  let run = acquired.activeRun;
  const prepared = await host.authorityManager.prepareExecutionAuthority({ missionId, runId: run.runId, clientId: 'owner',
    expectedRevision: run.revision, expectedStateHash: run.stateHash, expectedExecutionStateHash: execution.replay(value.executionReplay).stateHash });
  assert.equal(prepared.ok, true, JSON.stringify(prepared));
  const committed = await host.authorityManager.commitExecutionAuthority({ missionId, runId: run.runId, clientId: 'owner',
    expectedRevision: prepared.activeRun.revision, expectedExecutionStateHash: prepared.activeRun.executionStateHash,
    handoffId: prepared.handoff.handoffId });
  assert.equal(committed.ok, true, JSON.stringify(committed));
  host.runtime.attachSimulator({ getLivePosition: () => ({ lat: 48.3, lon: 8.5, altFt: 3000, hdg: 0 }),
    dispatchCommand: () => completed(), syncPayloadBeforeStart: completed, syncPayloadManifestState: completed });
  await until(() => host.runtime.publicState().simulatorAttached);
  for (const [intent, payload] of [['prepare_mission', {}], ['start_boarding', {}], ['set_manifest_item', { itemId: 'camera', action: 'load' }],
    ['sign_manifest', {}], ['confirm_load', {}], ['start_mission', {}]]) {
    run = host.authorityManager.getActiveRun();
    const result = await host.runtime.executeIntent({ intent, payload, commandId: `training-process-${intent}`,
      missionId: run.missionId, runId: run.runId, expectedRevision: run.revision });
    assert.equal(result.ok, true, JSON.stringify(result));
    if (intent === 'set_manifest_item') {
      await until(() => host.authorityManager.getActiveRun()?.lastReason === 'effect:scene.cargo_item_transition:completed');
    }
    await until(() => host.runtime.publicState().effects.pendingEffects.length === 0);
  }
  await until(() => host.authorityManager.getExecutionSnapshot().state.flags.active);
  const telemetry = async observedAt => {
    host.runtime.observeTelemetry({ observedAt, lat: 48.3, lon: 8.5, altFt: 3000, aglFt: 3000, gsKts: 85, hdg: 0, bankDeg: 0,
      vsFpm: 0, onGround: false });
    await until(() => !host.runtime.publicState().telemetry.inFlight && !host.runtime.publicState().telemetry.pending);
    await host.runtime.flush();
  };
  const base = Date.now();
  await telemetry(base);
  await telemetry(base + 3100);
  let snapshot = host.authorityManager.getExecutionSnapshot();
  assert.equal(snapshot.state.poiTask.trainingState.progress.startAvailable, true);
  assert.ok(snapshot.view.allowedActions.includes('training_ready'));
  run = host.authorityManager.getActiveRun();
  const ready = await host.runtime.executeIntent({ intent: 'training_ready', commandId: 'training-process-ready',
    missionId: run.missionId, runId: run.runId, expectedRevision: run.revision });
  assert.equal(ready.ok, true, JSON.stringify(ready));
  await telemetry(base + 3200);
  snapshot = host.authorityManager.getExecutionSnapshot();
  assert.equal(snapshot.state.poiTask.trainingState.progress.activeExercise.status, 'active');
  run = host.authorityManager.getActiveRun();
  const abort = await host.runtime.executeIntent({ intent: 'training_abort', commandId: 'training-process-abort',
    missionId: run.missionId, runId: run.runId, expectedRevision: run.revision });
  assert.equal(abort.ok, true, JSON.stringify(abort));
  snapshot = host.authorityManager.getExecutionSnapshot();
  assert.equal(snapshot.state.poiTask.trainingState.progress.activeExercise.status, 'repeat');
});
