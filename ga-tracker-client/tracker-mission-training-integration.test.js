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
  const commands = [], farewells = [];
  const runtime = createTrackerMissionExecutionRuntime({ enabled: true, authorityManager: manager,
    payloadSyncBeforeStart: completed, playBoardingVoice: completed, playFarewellVoice: request => { farewells.push(request); return completed(); } });
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
  return { b, manager, runtime, commands, farewells, intent, sample, directory };
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
  const beforeRepeat = structuredClone(h.manager.getExecutionSnapshot().state.poiTask.trainingState.checkpoint);
  assert.equal((await h.intent('training_repeat_instruction')).ok, true);
  assert.deepEqual(h.manager.getExecutionSnapshot().state.poiTask.trainingState.checkpoint, beforeRepeat);
  assert.ok(h.manager.getExecutionSnapshot().state.effects.some(e => e.payload.trainingScope && e.payload.action === 'training_repeat_instruction'));
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
  const telemetry = async (observedAt, patch = {}) => {
    host.runtime.observeTelemetry({ observedAt, lat: 48.3, lon: 8.5, altFt: 3000, aglFt: 3000, gsKts: 85, hdg: 0, bankDeg: 0,
      vsFpm: 0, onGround: false, ...patch });
    await until(() => !host.runtime.publicState().telemetry.inFlight && !host.runtime.publicState().telemetry.pending);
    await host.runtime.flush();
  };
  const base = Date.now();
  await telemetry(base - 1000, { simPaused: true });
  assert.equal(host.authorityManager.getExecutionSnapshot().state.poiTask.trainingState.coaching.suspended, true);
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


test('unfinished training can unload and close away from home without inventing a cargo failure', async t => {
  const h = await harness(t); await start(h);
  const at=Date.now();
  await h.sample({observedAt:at,bankDeg:0,vsFpm:0});
  await h.sample({observedAt:at+3100,bankDeg:0,vsFpm:0});
  await h.sample({observedAt:at+4100,lat:49,lon:9,onGround:true,aglFt:0,gsKts:15,bankDeg:0,vsFpm:0});
  await h.sample({observedAt:at+5100,lat:49,lon:9,onGround:true,aglFt:0,gsKts:0,bankDeg:0,vsFpm:0});
  assert.equal(h.manager.getExecutionSnapshot().state.phase,'end_unloading');
  assert.equal((await h.intent('set_manifest_item',{itemId:'camera',action:'unload'})).ok,true);
  assert.equal((await h.intent('sign_manifest')).ok,true);
  assert.equal((await h.intent('confirm_unload')).ok,true);
  await until(()=>h.farewells.length===1);
  const result=h.farewells[0].farewellDynamicContext;
  assert.equal(result.missionFailed,true);
  assert.equal(result.record.poiNeedsRideHome,true);
  assert.deepEqual(result.cargoOutcome.notDeliveredRequired,[]);
  assert.deepEqual(result.cargoOutcome.taskFailureReasons,['Pflichtübungen wurden nicht abgeschlossen.']);
  await until(()=>!h.manager.getActiveRun());
});


test('completed exercises survive away landing and public final outcome projection', async t => {
  const h=await harness(t); await start(h);
  let at=Date.now();
  const fly=async(hdg=0,bankDeg=0)=>h.sample({observedAt:(at+=1000),hdg,bankDeg,vsFpm:0,gForce:1.1});
  await fly(); await fly(); await fly(); await fly();
  assert.equal((await h.intent('training_ready')).ok,true);
  await fly();
  for(let hdg=10;hdg<=180;hdg+=10)await fly(hdg,30);
  await fly(180); await fly(180); await fly(180);
  const completedState = h.manager.getExecutionSnapshot().state;
  assert.equal(completedState.poiTask.trainingState.progress.requiredComplete,true);
  assert.match(completedState.poiTask.trainingState.guidance.instruction, /Rückkehr frei/);
  assert.ok(completedState.effects.some(effect => /Rückkehr frei/.test(
    effect.payload?.resolvedRecipe?.fallbackText || '')), 'POI completion voice must keep the return instruction');
  await h.sample({observedAt:(at+=1000),lat:49,lon:9,onGround:true,aglFt:0,gsKts:15,bankDeg:0,vsFpm:0});
  await h.sample({observedAt:(at+=1000),lat:49,lon:9,onGround:true,aglFt:0,gsKts:0,bankDeg:0,vsFpm:0});
  assert.equal((await h.intent('set_manifest_item',{itemId:'camera',action:'unload'})).ok,true);
  assert.equal((await h.intent('sign_manifest')).ok,true);
  assert.equal((await h.intent('confirm_unload')).ok,true);
  await until(()=>!h.manager.getActiveRun());
  assert.equal(h.farewells[0].farewellDynamicContext.missionFailed,false);
  const final=h.manager.getPublicSnapshot().lastExecution;
  assert.equal(final.poiOutcome.failed,false);
  assert.deepEqual(final.poiOutcome.taskFailureReasons,[]);
  assert.equal(final.flight.missionRecord.missionFailed,false);
  assert.equal(final.poiLifecycle.needsRideHome,true);
});

test('training resumes from ground suspension with fresh airborne telemetry', async t => {
  const h = await harness(t); await start(h);
  const base = Date.now();
  await h.sample({ observedAt: base, onGround: true, gsKts: 0, aglFt: 0, bankDeg: 0, vsFpm: 0 });
  await h.sample({ observedAt: base + 1000, bankDeg: 0, vsFpm: 0 });
  await h.sample({ observedAt: base + 4100, bankDeg: 0, vsFpm: 0 });
  const task = h.manager.getExecutionSnapshot().state.poiTask.trainingState;
  assert.equal(task.coaching.suspended, false);
  assert.equal(task.guidance.canStart, true);
});

test('training accepts airborne samples without optional ground speed', async t => {
  const h = await harness(t); await start(h);
  const base = Date.now();
  await h.sample({ observedAt: base, onGround: true, gsKts: 0, aglFt: 0, bankDeg: 0, vsFpm: 0 });
  await h.sample({ observedAt: base + 1000, gsKts: null, bankDeg: 0, vsFpm: 0 });
  await h.sample({ observedAt: base + 4100, gsKts: null, bankDeg: 0, vsFpm: 0 });
  const task = h.manager.getExecutionSnapshot().state.poiTask.trainingState;
  assert.equal(task.coaching.suspended, false);
  assert.equal(task.guidance.canStart, true);
  assert.equal(task.coaching.sample.aglFt, 3000);
  assert.ok(task.coaching.sample.departureDistanceNm >= 5);
});

test('training still suspends for missing position, altitude or maneuver safety values', async t => {
  const h = await harness(t); await start(h);
  let at = Date.now();
  for (const field of ['lat', 'lon', 'altFt', 'aglFt', 'hdg', 'bankDeg', 'vsFpm']) {
    await h.sample({ observedAt: (at += 1000), gsKts: null, bankDeg: 0, vsFpm: 0 });
    await h.sample({ observedAt: (at += 3100), gsKts: null, bankDeg: 0, vsFpm: 0 });
    assert.equal(h.manager.getExecutionSnapshot().state.poiTask.trainingState.guidance.canStart, true, field);
    await h.sample({ observedAt: (at += 1000), gsKts: null, bankDeg: 0, vsFpm: 0, [field]: null });
    const task = h.manager.getExecutionSnapshot().state.poiTask.trainingState;
    assert.equal(task.coaching.suspended, true, field);
    assert.equal(task.guidance.canStart, false, field);
  }
});


test('suspended training publishes received gate values without unlocking the exercise', async t => {
  const h = await harness(t); await start(h);
  const base = Date.now();
  await h.sample({ observedAt: base, simPaused: true, aglFt: 1300 });
  let task = h.manager.getExecutionSnapshot().state.poiTask.trainingState;
  assert.equal(task.coaching.suspended, true);
  assert.equal(task.coaching.sample.aglFt, 1300);
  assert.ok(task.coaching.sample.departureDistanceNm >= 5);
  assert.match(task.guidance.rows.find(row => row.id === 'altitude').detail, /1300/);
  assert.doesNotMatch(task.guidance.notice, /Position\/Entfernung.*nicht verfügbar/);
  assert.notEqual(task.guidance.canStart, true);
  await h.sample({ observedAt: base + 1100, simPaused: true, aglFt: 2400 });
  task = h.manager.getExecutionSnapshot().state.poiTask.trainingState;
  assert.equal(task.coaching.sample.aglFt, 2400);
  assert.match(task.guidance.rows.find(row => row.id === 'altitude').detail, /2400/);
  assert.equal(task.progress.startAvailable, false);
});


test('training releases each telemetry suspension after fresh airborne values and stable preparation', async t => {
  const interruptions = {
    ground: { onGround: true, aglFt: 3, gsKts: 0 },
    pause: { simPaused: true },
    menu: { inMenuOrMap: true },
    slew: { slewActive: true },
    missingPosition: { lat: null },
    missingAgl: { aglFt: null }
  };
  for (const [label, interruption] of Object.entries(interruptions)) {
    await t.test(label, async t => {
      const h = await harness(t); await start(h);
      const base = Date.now();
      await h.sample({ observedAt: base, bankDeg: 0, vsFpm: 0, ...interruption });
      assert.equal(h.manager.getExecutionSnapshot().state.poiTask.trainingState.coaching.suspended, true);
      const resumed = { lat: 48.1, lon: 8, altFt: 5736, aglFt: 3791,
        hdg: 249, bankDeg: 0, vsFpm: 0, onGround: false, gsKts: 85,
        simPaused: false, inMenuOrMap: false, slewActive: false };
      await h.sample({ observedAt: base + 1100, ...resumed });
      await h.sample({ observedAt: base + 4300, ...resumed });
      const snapshot = h.manager.getExecutionSnapshot();
      const task = snapshot.state.poiTask.trainingState;
      assert.equal(task.coaching.suspended, false);
      assert.equal(task.guidance.canStart, true);
      assert.equal(task.coaching.sample.aglFt, 3791);
      assert.ok(execution.allowedActions(snapshot.state).includes('training_ready'));
      assert.doesNotMatch(task.guidance.notice || '', /unterbrochen|pausiert|unvollständig/);
      assert.equal((await h.intent('training_ready')).ok, true);
      await h.sample({ observedAt: base + 4400, ...resumed });
      assert.equal(h.manager.getExecutionSnapshot().state.poiTask.trainingState.progress.activeExercise.status, 'active');
    });
  }
});


test('training can prepare and manually start after simulator disconnect and reconnect', async t => {
  const h = await harness(t); await start(h);
  const base = Date.now();
  await h.sample({ observedAt: base, bankDeg: 0, vsFpm: 0 });
  await h.sample({ observedAt: base + 3100, bankDeg: 0, vsFpm: 0 });
  assert.equal((await h.intent('training_ready')).ok, true);
  await h.sample({ observedAt: base + 3200, bankDeg: 0, vsFpm: 0 });
  h.runtime.detachSimulator();
  h.runtime.attachSimulator({ getLivePosition: () => ({ lat: 48.3, lon: 8.5, altFt: 3000, hdg: 249 }),
    dispatchCommand: completed, syncPayloadManifestState: completed, cleanupMission: completed });
  await tick();
  await h.sample({ observedAt: base + 9200, hdg: 249, bankDeg: 0, vsFpm: 0 });
  await h.sample({ observedAt: base + 12400, hdg: 249, bankDeg: 0, vsFpm: 0 });
  const snapshot = h.manager.getExecutionSnapshot();
  assert.equal(snapshot.state.poiTask.trainingState.coaching.suspended, false);
  assert.equal(snapshot.state.poiTask.trainingState.guidance.canStart, true);
  assert.ok(snapshot.view.allowedActions.includes('training_ready'));
  assert.equal((await h.intent('training_ready')).ok, true);
  await h.sample({ observedAt: base + 12500, hdg: 249, bankDeg: 0, vsFpm: 0 });
  assert.equal(h.manager.getExecutionSnapshot().state.poiTask.trainingState.progress.activeExercise.status, 'active');
});
