'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const execution = require('../mission-execution-core.js');
const poiVoice = require('../mission-poi-voice-core.js');
const poiLifecycle = require('../mission-poi-lifecycle-core.js');
const boarding = require('../mission-boarding-voice-core.js');
const bushCore = require('../mission-bush-execution-core.js');
const { buildCloudMissionCandidate } = require('./tracker-mission-cloud.js');
const { createMissionAuthorityManager } = require('./mission-authority-core.js');
const { createTrackerMissionExecutionRuntime } = require('./tracker-mission-execution-runtime.js');

const tick = () => new Promise(resolve => setImmediate(resolve));
async function settle() { for (let i = 0; i < 16; i++) await tick(); }
const completed = () => ({ ok: true, status: 'completed' });
const home = { kind: 'airport', icao: 'XHOM', lat: 48, lon: 8, name: 'Heimatbasis' };
const target = { kind: 'airport', icao: 'XSTR', lat: 48.3, lon: 8.5, name: 'Remote Strip' };
const missionId = 'bush-recon-runtime';
const outcome = { schema: 'ga.bushReconOutcome.v1', outcome: 'minor_service', hiddenFromWriter: true,
  followUpKind: 'bush_supply_strip', followUpLabel: 'Materialflug', resultText: 'Ein kleiner Servicebedarf bleibt offen.', createdAt: 1000 };
const spec = { profileId: 'bush_recon_return', recipeId: 'poi_on_task_return',
  targetMode: 'area_then_return', completionMode: 'return_home', requiresReturnHome: true,
  allowedEndLocations: ['home'], homeRef: home, targetRef: target,
  areaRef: { lat: target.lat, lon: target.lon, radiusNm: 1.5 }, success: { minAreaTimeSec: 0, minAreaTrackNm: 0 } };
const passenger = { name: 'Mia', role: 'Technische Prüferin', taskDomain: 'inspection_infra',
  targetRadiusNm: 1.5, targetAltFt: 1000, targetDwellMin: 0 };
const voiceContext = { schema: poiVoice.CONTEXT_SCHEMA, version: 1, missionId,
  taskDomain: 'inspection_infra', strict: false, audioEnabled: false,
  baseContext: 'Technischer Erkundungsflug.', toneHint: 'Ruhig und sachlich.', passenger,
  speaker: { name: 'Mia', gender: 'female' }, start: 'Heimatbasis', dest: 'Heimatbasis',
  flight: { depLabel: 'Heimatbasis', arrLabel: 'Heimatbasis' }, bush: spec,
  bushReconOutcome: outcome, missionData: { missionType: 'bush', targetName: target.name,
    bush: spec, bushReconOutcome: outcome } };
function bundle() {
  const recipe = { schema: 'ga.mission-poi-execution-recipe.v1', version: 1, missionId,
    taskDomain: 'inspection_infra', target, home, strict: false, trackingActive: true,
    passenger, voiceContext, bush: spec, lifecycle: { schema: poiLifecycle.SCHEMA } };
  const value = { version: 2, missionId, adapter: 'bush_pickup', descriptor: { primaryAdapter: 'bush_pickup' },
    missionState: { currentMissionData: { missionId, missionType: 'bush', _appliedProfile: 'bush_recon_return',
      start: home.icao, dest: home.icao, targetName: target.name, targetLat: target.lat, targetLon: target.lon,
      bush: spec, bushReconOutcome: outcome, passenger, routeWaypoints: [home, { ...target, isPOI: true }] } },
    runtime: { missionId, startPhase: 'planned', lastLiveFlightData: { onGround: true, gsKts: 0 },
      runtime: { missionId, phase: 'planned', active: false }, cargoManifest: { version: 6,
        key: missionId + '-manifest', dispatchSignature: { scope: 'departure' }, items: [
          { id: 'camera', label: 'Dokumentationskamera', itemType: 'cargo', required: true, status: 'pending', weightLbs: 5, healthPct: 100, deliverAtDestination: false } ] } },
    executionBushRecipe: { schema: bushCore.SCHEMA, version: 1, kind: 'recon_return', missionId,
      spec, location: { missionTarget: target, arrivalPoint: target, policy: null } },
    executionPoiRecipe: recipe,
    executionEffectPlan: { schema: 'ga.mission-poi-effect-plan.v1', recipe: 'poi', missionId,
      sceneId: missionId + '-scene', effects: {
        'scene.prepare': { none: true }, 'scene.boarding': { none: true },
        'scene.deboarding': { none: true }, 'scene.target': { none: true },
        'voice.boarding': { recipe: boarding.createRecipe({ missionId, prompt: 'Bereit zum Start.', audioEnabled: false }) },
        'voice.approach': { context: { ...voiceContext, supported: true, mode: 'passenger',
          departure: home, hasAptArrivalRuntimePoint: false } },
        'voice.farewell': { poiContextRef: true }
      } } };
  value.executionReplay = execution.createExecutionBundle(value);
  value.execution = execution.createReplayShadowEnvelope(value.executionReplay, { sourceRevision: 1, legacyBundle: value });
  return value;
}

async function harness(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'bush-recon-runtime-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  let now = 100000;
  const manager = createMissionAuthorityManager({ storageFile: path.join(directory, 'authority.json'),
    idFactory: () => 'bush-recon-run', executionAuthorityEnabled: true, poiExecutionEnabled: true, now: () => now });
  const b = bundle();
  assert.equal(bushCore.validateBundle(b), null);
  const acquired = manager.acquire({ missionId, clientId: 'app', stateHash: 'app-state', resumeBundle: b });
  assert.ok(acquired.activeRun, JSON.stringify(acquired));
  const prepared = manager.prepareExecutionAuthority({ missionId, runId: acquired.activeRun.runId, clientId: 'app',
    expectedRevision: acquired.activeRun.revision, expectedStateHash: acquired.activeRun.stateHash,
    expectedExecutionStateHash: execution.replay(b.executionReplay).stateHash });
  assert.equal(prepared.ok, true, JSON.stringify(prepared));
  const committed = manager.commitExecutionAuthority({ missionId, runId: acquired.activeRun.runId, clientId: 'app',
    expectedRevision: prepared.activeRun.revision, expectedExecutionStateHash: prepared.activeRun.executionStateHash,
    handoffId: prepared.handoff.handoffId });
  assert.equal(committed.ok, true, JSON.stringify(committed));
  const commands = [], farewells = [];
  const runtime = createTrackerMissionExecutionRuntime({ enabled: true, authorityManager: manager, getPilotId: () => 'BUSH-PILOT',
    poiExecutionEnabled: true, now: () => now, random: () => 0.5, payloadSyncBeforeStart: completed,
    playBoardingVoice: completed, playFarewellVoice: request => { farewells.push(request); return completed(); } });
  runtime.attachSimulator({ getLivePosition: () => ({ lat: home.lat, lon: home.lon, altFt: 500, hdg: 90 }),
    dispatchCommand: command => { commands.push(command); return completed(); }, syncPayloadManifestState: completed,
    cleanupMission: completed });
  await settle();
  let serial = 0;
  async function intent(name, payload = {}) {
    const active = manager.getActiveRun();
    const result = await runtime.executeIntent({ intent: name, payload, commandId: `recon-${++serial}`,
      missionId, runId: active.runId, expectedRevision: active.revision });
    await settle();
    return result;
  }
  function sample(lat, lon, patch = {}) {
    now += 1000;
    const result = runtime.observeTelemetry({ observedAt: now, lat, lon, altFt: 1500, aglFt: 1000,
      hdg: 90, gsKts: 85, onGround: false, ...patch });
    assert.equal(result.ok, true, JSON.stringify(result));
    return result;
  }
  return { b, manager, runtime, intent, sample, commands, farewells };
}

test('Bush Recon cloud seed preserves Bush+POI recipes and validates both cores', () => {
  const b = bundle();
  const profile = { activeMission: b.missionState, activeMissionTrackerSeed: {
    schema: 'ga.tracker-cloud-mission-seed.v1', version: 1, missionId, adapter: 'bush_pickup',
    executionBushRecipe: b.executionBushRecipe, executionPoiRecipe: b.executionPoiRecipe,
    executionEffectPlan: b.executionEffectPlan } };
  const result = buildCloudMissionCandidate(profile, { poiExecutionEnabled: true });
  assert.equal(result.status, 'ready', JSON.stringify(result));
  assert.equal(result.candidate.bundle.executionPoiRecipe.bush.profileId, 'bush_recon_return');
  assert.equal(result.candidate.bundle.executionBushRecipe.kind, 'recon_return');
  const blocked = buildCloudMissionCandidate(profile, { poiExecutionEnabled: false });
  assert.equal(blocked.status, 'unsupported');
});

test('Bush Recon acquires authority, qualifies its POI task, requires return home, and closes only at home', async t => {
  const h = await harness(t);
  h.sample(home.lat, home.lon, { onGround: true, aglFt: 0, gsKts: 0 });
  for (const action of ['prepare_mission', 'start_boarding']) {
    const result = await h.intent(action);
    assert.equal(result.ok, true, `${action}: ${JSON.stringify(result)}`);
  }
  assert.equal((await h.intent('set_manifest_item', { itemId: 'camera', action: 'load' })).ok, true);
  for (const action of ['sign_manifest', 'confirm_load', 'start_mission']) {
    const result = await h.intent(action);
    assert.equal(result.ok, true, `${action}: ${JSON.stringify(result)}`);
  }
  let state = h.manager.getExecutionSnapshot().state;
  assert.equal(state.recipe, 'poi');
  assert.equal(state.bushTask.kind, 'recon_return');
  for (let i = 0; i < 5; i++) h.sample(target.lat, target.lon);
  state = h.manager.getExecutionSnapshot().state;
  assert.equal(state.poiTask.detector.satisfied, true);
  assert.equal(state.bushTask.progress.status, 'return_leg');
  assert.equal(state.bushTask.canEndHere, false);

  h.sample(49, 9, { onGround: true, aglFt: 0, gsKts: 0 });
  state = h.manager.getExecutionSnapshot().state;
  assert.equal(state.poiLifecycle.canEndHere, false, 'an away ground stop remains blocked');
  assert.equal(state.bushTask.canEndHere, false);
  assert.equal((await h.intent('request_close')).ok, false);
  assert.ok(h.manager.getActiveRun(), 'the mission remains active away from home');

  h.sample(home.lat, home.lon, { onGround: true, aglFt: 0, gsKts: 0 });
  state = h.manager.getExecutionSnapshot().state;
  assert.equal(state.bushTask.progress.status, 'ready_to_close');
  assert.equal(state.bushTask.canEndHere, true);
  assert.equal(state.poiLifecycle.canEndHere, true);
  const closed = await h.intent('request_close');
  assert.equal(closed.ok, true, JSON.stringify(closed));
  for (let i = 0; i < 100 && h.manager.getActiveRun(); i++) await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(h.manager.getActiveRun(), null);
  assert.equal(h.manager.getPublicSnapshot().lastExecution.phase, 'closed');
  assert.equal(h.manager.getFollowupOutbox('BUSH-PILOT').length, 1, 'Recon follow-up is produced on close');
});
