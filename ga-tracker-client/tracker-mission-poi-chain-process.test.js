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

const chain = { schema: 'ga.poiChain.v1', key: 'process-chain', label: 'Prozesskette',
  overlay: { widthNm: .6, widthVersion: 2, trace: [{ lat: 48.3, lon: 8.5 }, { lat: 48.33, lon: 8.5 }] },
  corridor: { targetSegmentLengthNm: 2.5, minCoverage: .6, bins: 12, minGroundSpeedKts: 35 },
  points: [{ id: 'p1', lat: 48.3, lon: 8.5, triggerRadiusNm: .12 }, { id: 'p2', lat: 48.315, lon: 8.5, triggerRadiusNm: .12 }, { id: 'p3', lat: 48.33, lon: 8.5, triggerRadiusNm: .12 }] };

function bundle() {
  const passenger = { name: 'Mia', targetRadiusNm: 1, targetAltFt: 3000, targetDwellMin: 0, poiChain: chain };
  const context = { schema: voice.CONTEXT_SCHEMA, version: 1, missionId: 'process-chain', taskDomain: 'infra_chain_recon', strict: true,
    audioEnabled: false, baseContext: 'Kettenprüfung.', passenger, speaker: passenger, chainSpec: chain,
    chainAudioDefinitions: { photo: { gain: 1 }, scan_start: { gain: 1 }, handoff: { gain: 1 } } };
  const b = { version: 2, missionId: 'process-chain', adapter: 'poi_chain', descriptor: { primaryAdapter: 'poi_chain' },
    missionState: { currentMissionData: { missionId: 'process-chain', missionType: 'poi', missionSubType: 'poi_chain', taskDomain: 'infra_chain_recon', poiChain: chain, passenger } },
    runtime: { missionId: 'process-chain', startPhase: 'planned', lastLiveFlightData: { onGround: true, gsKts: 0 }, runtime: { missionId: 'process-chain', phase: 'planned', active: false },
      cargoManifest: { version: 6, key: 'process-chain-manifest', items: [{ id: 'camera', label: 'Kamera', itemType: 'cargo', required: true, status: 'pending', weightLbs: 15, healthPct: 100 }] } },
    executionPoiRecipe: { schema: poi.RECIPE_SCHEMA, version: 1, missionId: 'process-chain', taskDomain: 'infra_chain_recon', missionSubType: 'poi_chain',
      target: { lat: 48.3, lon: 8.5 }, home: { lat: 48, lon: 8 }, passenger, strict: true, trackingActive: true, poiChain: chain, lifecycle: { schema: lifecycle.SCHEMA }, voiceContext: context },
    executionEffectPlan: { schema: 'ga.mission-poi-effect-plan.v1', recipe: 'poi', missionId: 'process-chain', sceneId: 'process-chain-scene', cargoItemAssets: [], cargoPlacement: {}, effects: {
      'scene.prepare': { none: true }, 'scene.boarding': { none: true }, 'scene.deboarding': { none: true }, 'scene.target': { none: true },
      'voice.boarding': { recipe: boarding.createRecipe({ missionId: 'process-chain', prompt: 'Bereit.', audioEnabled: false }) },
      'voice.approach': { context: { ...context, supported: true, mode: 'passenger', departure: { lat: 48, lon: 8 } } }, 'voice.farewell': { poiContextRef: true } } } };
  b.executionReplay = execution.createExecutionBundle(b); b.execution = execution.createReplayShadowEnvelope(b.executionReplay, { sourceRevision: 1, legacyBundle: b });
  return b;
}
async function until(predicate) { for (let n = 0; n < 250; n++) { if (predicate()) return; await delay(10); } assert.fail('condition did not become true'); }

test('POI-chain telemetry is evaluated in the real mission child process and commits bounded progress', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'poi-chain-process-'));
  const host = await createTrackerMissionProcess({ enabled: true, pilotId: 'test', flightLogDirectory: dir,
    authority: { storageFile: path.join(dir, 'authority.json'), executionAuthorityEnabled: true, poiExecutionEnabled: true },
    playBoardingVoice: () => ({ ok: true, status: 'completed' }), playFarewellVoice: () => ({ ok: true, status: 'completed' }) });
  t.after(async () => { await host.close(); fs.rmSync(dir, { recursive: true, force: true }); });
  assert.notEqual(host.runtime.publicState().processId, process.pid);
  const b = bundle(); const acquired = await host.authorityManager.acquire({ missionId: b.missionId, clientId: 'owner', stateHash: 'web', resumeBundle: b });
  let run = acquired.activeRun;
  const prepared = await host.authorityManager.prepareExecutionAuthority({ missionId: b.missionId, runId: run.runId, clientId: 'owner', expectedRevision: run.revision, expectedStateHash: run.stateHash, expectedExecutionStateHash: execution.replay(b.executionReplay).stateHash });
  assert.equal(prepared.ok, true); assert.equal((await host.authorityManager.commitExecutionAuthority({ missionId: b.missionId, runId: run.runId, clientId: 'owner', expectedRevision: prepared.activeRun.revision, expectedExecutionStateHash: prepared.activeRun.executionStateHash, handoffId: prepared.handoff.handoffId })).ok, true);
  host.runtime.attachSimulator({ getLivePosition: () => ({ lat: 48.3, lon: 8.5, altFt: 3000, hdg: 0 }), dispatchCommand: () => ({ ok: true, status: 'completed' }), syncPayloadBeforeStart: () => ({ ok: true, status: 'completed' }), syncPayloadManifestState: () => ({ ok: true, status: 'completed' }) });
  await until(() => host.runtime.publicState().simulatorAttached);
  for (const [intent, payload] of [['prepare_mission', {}], ['start_boarding', {}], ['set_manifest_item', { itemId: 'camera', action: 'load' }], ['sign_manifest', {}], ['confirm_load', {}], ['start_mission', {}]]) {
    run = host.authorityManager.getActiveRun(); const result = await host.runtime.executeIntent({ intent, payload, commandId: `process-${intent}`, missionId: run.missionId, runId: run.runId, expectedRevision: run.revision });
    assert.equal(result.ok, true, JSON.stringify(result));
    // Wait for actual asynchronous effect ACKs before binding the next intent
    // to a revision; a fixed delay races the original cargo queue.
    await until(() => !host.authorityManager.getExecutionSnapshot().state.effects.some(effect => effect.status === 'requested'));
  }
  await until(() => host.authorityManager.getExecutionSnapshot().state.flags.active);
  const base = Date.now();
  for (let index = 0; index <= 30; index++) {
    const observedAt = base + index * 1000;
    host.runtime.observeTelemetry({ observedAt, lat: 48.3 + index * .001, lon: 8.5, altFt: 3000, alt: 3000, aglFt: 600, gsKts: 85, hdg: 0, headingDeg: 0, onGround: false });
    await until(() => !host.runtime.publicState().telemetry.inFlight && !host.runtime.publicState().telemetry.pending);
    await host.runtime.flush();
  }
  const progress = host.authorityManager.getPublicSnapshot().execution.poiTask.poiChain;
  assert.equal(progress.satisfied, true);
  assert.deepEqual(progress.completedPointIds, ['p1', 'p2', 'p3']);
  assert.equal(host.authorityManager.getExecutionSnapshot().state.phase, 'return_leg');
});
