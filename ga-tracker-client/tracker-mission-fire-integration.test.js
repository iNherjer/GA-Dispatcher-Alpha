'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const execution = require('../mission-execution-core.js');
const lifecycle = require('../mission-poi-lifecycle-core.js');
const voice = require('../mission-poi-voice-core.js');
const boarding = require('../mission-boarding-voice-core.js');
const poi = require('./tracker-mission-poi-runtime.js');
const { createMissionAuthorityManager } = require('./mission-authority-core.js');
const { createTrackerMissionExecutionRuntime } = require('./tracker-mission-execution-runtime.js');
const { buildCloudMissionCandidate } = require('./tracker-mission-cloud.js');

const tick = () => new Promise(resolve => setImmediate(resolve));
const completed = () => ({ ok: true, status: 'completed', sideEffect: false });
const missionId = 'fire-watch-integration';

function scenario(truth = 'fire') {
  return {
    enabled: true, type: 'fire_watch', truth,
    target: { name: 'Waldkante Süd', lat: 48.3, lon: 8.5, altFt: 940 },
    targetAreaNm: 1.2, confirmRangeNm: 1.5, paxAwarenessRangeNm: 3,
    searchDwellSec: .001, assessmentDwellSec: .001,
    smoke: { objectTitle: 'Chimney_Smoke_V1', sites: [{ siteId: 'smoke-1', lat: 48.3, lon: 8.5, altFt: 940, count: 3, radiusM: 80 }] },
    fire: { enabled: true, objectTitle: 'VO_Fire_R1_40', sites: [{ siteId: 'fire-1', lat: 48.3002, lon: 8.5002, altFt: 942 }] }
  };
}

function bundle(truth = 'fire') {
  const fireScenario = scenario(truth);
  const passenger = { name: 'Mia', targetRadiusNm: 1.2, targetAltFt: 3000, targetDwellMin: 0 };
  const context = { schema: voice.CONTEXT_SCHEMA, version: 1, missionId, taskDomain: 'fire_watch', strict: true,
    audioEnabled: false, baseContext: 'Feuerwache im Zielgebiet.', passenger, speaker: passenger };
  const value = { version: 2, missionId, adapter: 'poi', descriptor: { primaryAdapter: 'poi' },
    executionPoiRecipe: { schema: poi.RECIPE_SCHEMA, version: 1, missionId, taskDomain: 'fire_watch',
      target: { lat: 48.3, lon: 8.5 }, home: { lat: 48, lon: 8 }, passenger, strict: true, trackingActive: true,
      fireScenario, lifecycle: { schema: lifecycle.SCHEMA }, voiceContext: context },
    missionState: { currentMissionData: { missionId, missionType: 'poi', taskDomain: 'fire_watch', fireScenario,
      poiName: 'Waldkante Süd', targetName: 'Waldkante Süd', start: 'HOME', startLat: 48, startLon: 8, dest: 'Waldkante Süd', passenger } },
    runtime: { missionId, startPhase: 'planned', lastLiveFlightData: { onGround: true, gsKts: 0 },
      runtime: { missionId, phase: 'planned', active: false }, cargoManifest: { version: 6, key: 'fire-manifest', items: [
        { id: 'camera', label: 'Kamera', itemType: 'cargo', required: true, status: 'pending', weightLbs: 2, healthPct: 100 }
      ] } },
    executionEffectPlan: { schema: 'ga.mission-poi-effect-plan.v1', recipe: 'poi', missionId, sceneId: 'fire-scene', effects: {
      'scene.prepare': { none: true }, 'scene.boarding': { none: true }, 'scene.deboarding': { none: true }, 'scene.target': { none: true },
      'voice.boarding': { recipe: boarding.createRecipe({ missionId, prompt: 'Bereit für die Feuerwache.', audioEnabled: false }) },
      'voice.approach': { context: { ...context, supported: true, mode: 'passenger', departure: { lat: 48, lon: 8 } } },
      'voice.farewell': { poiContextRef: true },
      ...(truth === 'fire' ? { 'smoke.spawn': { command: { type: 'mission_smoke_spawn', lat: 48.3, lon: 8.5, altFt: 940,
        objectTitle: fireScenario.smoke.objectTitle, fireObjectTitle: fireScenario.fire.objectTitle,
        sites: fireScenario.smoke.sites, fireSites: fireScenario.fire.sites } },
      'smoke.clear': { command: { type: 'mission_smoke_clear' } } } : {})
    } } };
  value.executionReplay = execution.createExecutionBundle(value);
  value.execution = execution.createReplayShadowEnvelope(value.executionReplay, { sourceRevision: 0, legacyBundle: value });
  return value;
}

async function harness(t, truth = 'fire') {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'fire-watch-integration-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const b = bundle(truth);
  const manager = createMissionAuthorityManager({ storageFile: path.join(directory, 'authority.json'), executionAuthorityEnabled: true,
    poiExecutionEnabled: true, poiLifecycleRequired: true, idFactory: () => 'fire-run' });
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
  async function intent(name, payload = {}, fixedCommandId = '') {
    const run = manager.getActiveRun();
    const result = await runtime.executeIntent({ intent: name, payload, commandId: fixedCommandId || `fire-${++serial}`, missionId: run.missionId,
      runId: run.runId, expectedRevision: run.revision });
    for (let i = 0; i < 8; i++) await tick();
    return result;
  }
  async function sample(patch = {}) {
    const result = runtime.observeTelemetry({ observedAt: Date.now(), lat: 48.3, lon: 8.5, altFt: 3000, aglFt: 600,
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

test('fire-watch crosses the cloud and authority gates without exposing truth in the control projection', async t => {
  const b = bundle();
  const profile = { activeMission: b.missionState, activeMissionTrackerSeed: { schema: 'ga.tracker-cloud-mission-seed.v1', version: 1,
    missionId, adapter: 'poi', executionPoiRecipe: b.executionPoiRecipe, executionEffectPlan: b.executionEffectPlan } };
  assert.equal(buildCloudMissionCandidate(profile, { poiExecutionEnabled: false }).code, 'cloud_mission_recipe_not_enabled');
  assert.equal(buildCloudMissionCandidate(profile, { poiExecutionEnabled: true }).status, 'ready');
  const h = await harness(t);
  await start(h); await h.sample();
  const control = h.manager.getPublicSnapshot().execution;
  assert.equal(control.poiTask.satisfied, false);
  assert.equal(JSON.stringify(control).includes('"truth"'), false);
  assert.equal(JSON.stringify(control).includes('smoke-1'), false);
});

test('confirmed fire reports use fresh in-range telemetry, serialize across reload and sequence smoke spawn', async t => {
  const h = await harness(t);
  await start(h);
  const stale = await h.intent('fire_position');
  assert.equal(stale.ok, false, 'actions cannot complete from missing/stale telemetry');
  await h.sample();
  const positioned = await h.intent('fire_position');
  assert.equal(positioned.ok, true, JSON.stringify(positioned));
  await new Promise(resolve => setTimeout(resolve, 15));
  await h.sample();
  const visible = await h.intent('fire_smoke_visible', {}, 'fire-visible');
  assert.equal(visible.ok, true, JSON.stringify(visible));
  await new Promise(resolve => setTimeout(resolve, 15));
  await h.sample();
  const state = h.manager.getExecutionSnapshot().state.poiTask;
  assert.equal(state.fireState.satisfied, true, JSON.stringify(state.fireState));
  assert.equal(h.commands.filter(command => command.type === 'mission_smoke_spawn').length, 1);
  for (let index = 0; index < 12; index++) await tick();
  const beforeReplay = execution.replay(h.manager.getActiveRun({ includeBundle: true }).resumeBundle.executionReplay);
  const beforeFire = h.manager.getExecutionSnapshot().state.poiTask.fireState;
  const beforeEffects = h.manager.getExecutionSnapshot().state.effects.map(effect => effect.effectId);
  const duplicate = await h.intent('fire_smoke_visible', {}, 'fire-visible');
  // A reused command id with a freshly evaluated payload is an authority
  // conflict, rather than a retry.  It must have no second state, voice, or
  // simulator effect.
  assert.equal(duplicate.ok, false);
  assert.equal(duplicate.error, 'mission_execution_event_id_conflict');
  assert.deepEqual(h.manager.getExecutionSnapshot().state.poiTask.fireState, beforeFire);
  assert.deepEqual(h.manager.getExecutionSnapshot().state.effects.map(effect => effect.effectId), beforeEffects);
  assert.equal(h.commands.filter(command => command.type === 'mission_smoke_spawn').length, 1);

  await h.sample({ lat: 48, lon: 8, onGround: true, aglFt: 0, gsKts: 20 });
  await h.sample({ lat: 48, lon: 8, onGround: true, aglFt: 0, gsKts: 0 });
  assert.equal(h.manager.getExecutionSnapshot().state.phase, 'end_unloading');
  assert.equal((await h.intent('set_manifest_item', { itemId: 'camera', action: 'unload' })).ok, true);
  assert.equal((await h.intent('sign_manifest')).ok, true);
  assert.equal((await h.intent('confirm_unload')).ok, true);
  for (let index = 0; index < 20; index++) await tick();
  assert.equal(h.manager.getExecutionSnapshot().state.phase, 'closed');
  assert.equal(h.commands.filter(command => command.type === 'mission_smoke_clear').length, 1);
  assert.equal(beforeReplay.ok, true);
  const restored = createMissionAuthorityManager({ storageFile: path.join(h.directory, 'authority.json'), executionAuthorityEnabled: true,
    poiExecutionEnabled: true, poiLifecycleRequired: true });
  assert.equal(restored.getExecutionSnapshot().state.poiTask.fireState.satisfied, true);
  assert.equal(restored.getExecutionSnapshot().state.phase, 'closed');
});

test('false-alarm completion accepts no-smoke, but never creates a smoke scene', async t => {
  const h = await harness(t, 'false_alarm');
  await start(h); await h.sample();
  assert.equal((await h.intent('fire_position')).ok, true);
  await new Promise(resolve => setTimeout(resolve, 15));
  await h.sample();
  const noSmoke = await h.intent('fire_no_smoke');
  assert.equal(noSmoke.ok, true, JSON.stringify(noSmoke));
  await h.sample();
  assert.equal(h.manager.getExecutionSnapshot().state.poiTask.fireState.satisfied, true);
  assert.equal(h.commands.some(command => command.type === 'mission_smoke_spawn'), false);
});

test('reconnecting the simulator rebuilds fire objects without resetting task or replaying PAX speech', async t => {
  const h = await harness(t); await start(h); await h.sample();
  const before = h.manager.getExecutionSnapshot().state;
  h.runtime.detachSimulator();
  h.runtime.attachSimulator({getLivePosition:()=>({lat:48.3,lon:8.5,altFt:3000}),
    dispatchCommand:command=>{h.commands.push(command);return completed();},syncPayloadManifestState:completed,cleanupMission:completed});
  for(let n=0;n<20;n++) await tick();
  const after = h.manager.getExecutionSnapshot().state;
  assert.equal(h.commands.filter(command=>command.type==='mission_smoke_spawn').length,2);
  assert.deepEqual(after.poiTask,before.poiTask);
  assert.deepEqual(after.effects.filter(effect=>effect.type==='voice.poi'),before.effects.filter(effect=>effect.type==='voice.poi'));
});
