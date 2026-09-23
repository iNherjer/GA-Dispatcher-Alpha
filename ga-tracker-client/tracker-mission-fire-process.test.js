'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { setTimeout: delay } = require('node:timers/promises');
const execution = require('../mission-execution-core.js');
const lifecycle = require('../mission-poi-lifecycle-core.js');
const voice = require('../mission-poi-voice-core.js');
const boarding = require('../mission-boarding-voice-core.js');
const poi = require('./tracker-mission-poi-runtime.js');
const { createTrackerMissionProcess } = require('./tracker-mission-process.js');

const missionId = 'fire-watch-process';
function fireScenario() {
  return { enabled: true, type: 'fire_watch', truth: 'fire', target: { name: 'Waldkante Süd', lat: 48.3, lon: 8.5, altFt: 940 },
    targetAreaNm: 1.2, confirmRangeNm: 1.5, paxAwarenessRangeNm: 3, searchDwellSec: .001, assessmentDwellSec: .001,
    smoke: { objectTitle: 'Chimney_Smoke_V1', sites: [{ siteId: 'smoke-1', lat: 48.3, lon: 8.5, altFt: 940, count: 3, radiusM: 80 }] },
    fire: { enabled: true, objectTitle: 'VO_Fire_R1_40', sites: [{ siteId: 'fire-1', lat: 48.3002, lon: 8.5002, altFt: 942 }] } };
}
function bundle() {
  const fire = fireScenario();
  const passenger = { name: 'Mia', targetRadiusNm: 1.2, targetAltFt: 3000, targetDwellMin: 0 };
  const context = { schema: voice.CONTEXT_SCHEMA, version: 1, missionId, taskDomain: 'fire_watch', strict: true, audioEnabled: false,
    baseContext: 'Feuerwache im Zielgebiet.', passenger, speaker: passenger };
  const value = { version: 2, missionId, adapter: 'poi', descriptor: { primaryAdapter: 'poi' },
    executionPoiRecipe: { schema: poi.RECIPE_SCHEMA, version: 1, missionId, taskDomain: 'fire_watch', target: { lat: 48.3, lon: 8.5 }, home: { lat: 48, lon: 8 }, passenger,
      strict: true, trackingActive: true, fireScenario: fire, lifecycle: { schema: lifecycle.SCHEMA }, voiceContext: context },
    missionState: { currentMissionData: { missionId, missionType: 'poi', taskDomain: 'fire_watch', fireScenario: fire, poiName: 'Waldkante Süd', passenger } },
    runtime: { missionId, startPhase: 'planned', lastLiveFlightData: { onGround: true, gsKts: 0 }, runtime: { missionId, phase: 'planned', active: false },
      cargoManifest: { version: 6, key: 'fire-process-manifest', items: [{ id: 'camera', label: 'Kamera', itemType: 'cargo', required: true, status: 'pending', weightLbs: 2, healthPct: 100 }] } },
    executionEffectPlan: { schema: 'ga.mission-poi-effect-plan.v1', recipe: 'poi', missionId, sceneId: 'fire-process-scene', effects: {
      'scene.prepare': { none: true }, 'scene.boarding': { none: true }, 'scene.deboarding': { none: true }, 'scene.target': { none: true },
      'voice.boarding': { recipe: boarding.createRecipe({ missionId, prompt: 'Bereit.', audioEnabled: false }) },
      'voice.approach': { context: { ...context, supported: true, mode: 'passenger', departure: { lat: 48, lon: 8 } } }, 'voice.farewell': { poiContextRef: true },
      'smoke.spawn': { command: { type: 'mission_smoke_spawn', lat: 48.3, lon: 8.5, altFt: 940, objectTitle: fire.smoke.objectTitle, fireObjectTitle: fire.fire.objectTitle, sites: fire.smoke.sites, fireSites: fire.fire.sites } },
      'smoke.clear': { command: { type: 'mission_smoke_clear' } } } } };
  value.executionReplay = execution.createExecutionBundle(value);
  value.execution = execution.createReplayShadowEnvelope(value.executionReplay, { sourceRevision: 1, legacyBundle: value });
  return value;
}
async function until(predicate) { for (let index = 0; index < 300; index++) { if (predicate()) return; await delay(10); } assert.fail('condition did not become true'); }

test('fire-watch recipe gates reject an invalid scenario and a missing smoke plan', () => {
  const value = bundle();
  assert.equal(poi.validateRecipe({ ...value.executionPoiRecipe, fireScenario: { ...value.executionPoiRecipe.fireScenario, enabled: false } }), 'fire_watch_scenario_invalid');
  const withoutSmoke = structuredClone(value); delete withoutSmoke.executionEffectPlan.effects['smoke.spawn'];
  assert.equal(poi.validateBundle(withoutSmoke), 'fire_watch_smoke_plan_invalid');
});

test('fire-watch telemetry and PAX smoke intent run in the real mission child process', async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'fire-watch-process-'));
  const commands = [];
  const host = await createTrackerMissionProcess({ enabled: true, pilotId: 'test', flightLogDirectory: directory,
    authority: { storageFile: path.join(directory, 'authority.json'), executionAuthorityEnabled: true, poiExecutionEnabled: true },
    playBoardingVoice: () => ({ ok: true, status: 'completed' }), playFarewellVoice: () => ({ ok: true, status: 'completed' }) });
  t.after(async () => { await host.close(); fs.rmSync(directory, { recursive: true, force: true }); });
  assert.notEqual(host.runtime.publicState().processId, process.pid);
  const value = bundle();
  const acquired = await host.authorityManager.acquire({ missionId, clientId: 'owner', stateHash: 'web', resumeBundle: value });
  let run = acquired.activeRun;
  const prepared = await host.authorityManager.prepareExecutionAuthority({ missionId, runId: run.runId, clientId: 'owner', expectedRevision: run.revision, expectedStateHash: run.stateHash, expectedExecutionStateHash: execution.replay(value.executionReplay).stateHash });
  assert.equal(prepared.ok, true, JSON.stringify(prepared));
  const committed = await host.authorityManager.commitExecutionAuthority({ missionId, runId: run.runId, clientId: 'owner', expectedRevision: prepared.activeRun.revision, expectedExecutionStateHash: prepared.activeRun.executionStateHash, handoffId: prepared.handoff.handoffId });
  assert.equal(committed.ok, true, JSON.stringify(committed));
  host.runtime.attachSimulator({ getLivePosition: () => ({ lat: 48.3, lon: 8.5, altFt: 3000, hdg: 0 }), dispatchCommand: command => { commands.push(command); return { ok: true, status: 'completed' }; }, syncPayloadBeforeStart: () => ({ ok: true, status: 'completed' }), syncPayloadManifestState: () => ({ ok: true, status: 'completed' }) });
  await until(() => host.runtime.publicState().simulatorAttached);
  for (const [intent, payload] of [['prepare_mission', {}], ['start_boarding', {}], ['set_manifest_item', { itemId: 'camera', action: 'load' }], ['sign_manifest', {}], ['confirm_load', {}], ['start_mission', {}]]) {
    run = host.authorityManager.getActiveRun(); const result = await host.runtime.executeIntent({ intent, payload, commandId: `fire-process-${intent}`, missionId: run.missionId, runId: run.runId, expectedRevision: run.revision });
    assert.equal(result.ok, true, JSON.stringify(result)); await delay(40);
  }
  await until(() => host.authorityManager.getExecutionSnapshot().state.flags.active);
  const telemetry = async () => { host.runtime.observeTelemetry({ observedAt: Date.now(), lat: 48.3, lon: 8.5, altFt: 3000, aglFt: 600, gsKts: 85, hdg: 0, onGround: false }); await until(() => !host.runtime.publicState().telemetry.inFlight && !host.runtime.publicState().telemetry.pending); await host.runtime.flush(); };
  await telemetry();
  assert.ok(host.authorityManager.getExecutionSnapshot().state.poiTask.fireState, 'child committed fire state after target telemetry');
  run = host.authorityManager.getActiveRun();
  const smoke = await host.runtime.executeIntent({ intent: 'fire_smoke_visible', payload: {}, commandId: 'fire-process-smoke', missionId: run.missionId, runId: run.runId, expectedRevision: run.revision });
  assert.equal(smoke.ok, true, JSON.stringify(smoke));
  await delay(15); await telemetry();
  await until(() => host.authorityManager.getExecutionSnapshot().state.poiTask.fireState.satisfied === true);
  assert.equal(commands.filter(command => command.type === 'mission_smoke_spawn').length, 1);
  const projection = host.authorityManager.getPublicSnapshot().execution;
  assert.equal(JSON.stringify(projection).includes('"truth"'), false);
  assert.equal(JSON.stringify(projection).includes('smoke-1'), false);
});
