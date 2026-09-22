'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const execution = require('../mission-execution-core.js');
const lifecycle = require('../mission-poi-lifecycle-core.js');
const voice = require('../mission-poi-voice-core.js');
const boarding = require('../mission-boarding-voice-core.js');
const poi = require('./tracker-mission-poi-runtime.js');
const { createMissionAuthorityManager } = require('./mission-authority-core.js');
const { createTrackerMissionExecutionRuntime } = require('./tracker-mission-execution-runtime.js');
const { buildCloudMissionCandidate } = require('./tracker-mission-cloud.js');
const { projectTrackerEfbMissionView } = require('./tracker-efb-mission-view-core.js');
const { createForCompletedRun } = require('./tracker-mission-followup.js');

const tick = () => new Promise(resolve => setImmediate(resolve));
const completed = () => ({ ok: true, status: 'completed' });
const chain = {
  schema: 'ga.poiChain.v1', key: 'integration-chain', label: 'Leitungsprüfung',
  overlay: { widthNm: 0.6, widthVersion: 2, trace: [{ lat: 48.3, lon: 8.5 }, { lat: 48.33, lon: 8.5 }] },
  corridor: { targetSegmentLengthNm: 2.5, minCoverage: 0.6, bins: 12, minGroundSpeedKts: 35, resetGraceSec: 2 },
  hiddenOutcome: { schema: 'ga.poiChainOutcome.v1', pointId: 'p2', pointIndex: 1, pointName: 'Mast Süd', outcome: 'monitor',
    followUpKind: 'infra_recheck', findingKind: 'corrosion', findingHint: 'Korrosion am Isolator', paxFindingText: 'Am zweiten Mast ist Korrosion sichtbar.' },
  points: [{ id: 'p1', lat: 48.3, lon: 8.5, triggerRadiusNm: 0.12 },
    { id: 'p2', name: 'Mast Süd', lat: 48.315, lon: 8.5, triggerRadiusNm: 0.12 },
    { id: 'p3', lat: 48.33, lon: 8.5, triggerRadiusNm: 0.12 }]
};

function bundle() {
  const passenger = { name: 'Mia', targetRadiusNm: 1, targetAltFt: 3000, targetDwellMin: 0, poiChain: chain };
  const context = { schema: voice.CONTEXT_SCHEMA, version: 1, missionId: 'chain-integration', taskDomain: 'infra_chain_recon',
    strict: true, audioEnabled: false, baseContext: 'Leitungsprüfung.', passenger, speaker: passenger, chainSpec: chain,
    chainAudioDefinitions: { photo: { gain: 1 }, scan_start: { gain: 1 }, handoff: { gain: 1 } } };
  const value = { version: 2, missionId: 'chain-integration', adapter: 'poi_chain', descriptor: { primaryAdapter: 'poi_chain' },
    executionPoiRecipe: { schema: poi.RECIPE_SCHEMA, version: 1, missionId: 'chain-integration', taskDomain: 'infra_chain_recon',
      missionSubType: 'poi_chain', target: { lat: 48.3, lon: 8.5 }, home: { lat: 48, lon: 8 }, passenger,
      strict: true, trackingActive: true, poiChain: chain, lifecycle: { schema: lifecycle.SCHEMA }, voiceContext: context },
    missionState: { currentMissionData: { missionId: 'chain-integration', missionType: 'poi', missionSubType: 'poi_chain', taskDomain: 'infra_chain_recon', poiChain: chain,
      poiName: 'Leitungskorridor Süd', targetName: 'Leitungskorridor Süd', _appliedProfile: 'infra_chain_recon', profileId: 'infra_chain_recon',
      start: 'HOME', startName: 'Heimatplatz', startLat: 48, startLon: 8, initialStartLat: 48, initialStartLon: 8, dest: 'Leitungskorridor Süd', passenger } },
    runtime: { missionId: 'chain-integration', startPhase: 'planned', lastLiveFlightData: { onGround: true, gsKts: 0 },
      runtime: { missionId: 'chain-integration', phase: 'planned', active: false }, cargoManifest: { version: 6, key: 'chain-manifest', pilotId: 'PILOT', items: [
        { id: 'camera', label: 'Kamera', itemType: 'cargo', required: true, status: 'pending', weightLbs: 15, healthPct: 100, deliverAtDestination: true }
      ] } },
    executionEffectPlan: { schema: 'ga.mission-poi-effect-plan.v1', recipe: 'poi', missionId: 'chain-integration', sceneId: 'chain-scene', cargoItemAssets: [], cargoPlacement: {}, effects: {
      'scene.prepare': { none: true }, 'scene.boarding': { none: true }, 'scene.deboarding': { none: true }, 'scene.target': { none: true },
      'voice.boarding': { recipe: boarding.createRecipe({ missionId: 'chain-integration', prompt: 'Bereit.', audioEnabled: false }) },
      'voice.approach': { context: { ...context, supported: true, mode: 'passenger', departure: { lat: 48, lon: 8 } } }, 'voice.farewell': { poiContextRef: true }
    } } };
  value.executionReplay = execution.createExecutionBundle(value);
  value.execution = execution.createReplayShadowEnvelope(value.executionReplay, { sourceRevision: 0, legacyBundle: value });
  return value;
}

async function harness(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'poi-chain-integration-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const b = bundle();
  let manager = createMissionAuthorityManager({ storageFile: path.join(dir, 'authority.json'), executionAuthorityEnabled: true, poiExecutionEnabled: true, idFactory: () => 'chain-run' });
  const acquired = manager.acquire({ missionId: b.missionId, clientId: 'app', stateHash: 'app', resumeBundle: b });
  let run = acquired.activeRun;
  const prepared = manager.prepareExecutionAuthority({ missionId: b.missionId, runId: run.runId, clientId: 'app', expectedRevision: run.revision, expectedStateHash: run.stateHash, expectedExecutionStateHash: execution.replay(b.executionReplay).stateHash });
  assert.equal(prepared.ok, true, JSON.stringify(prepared));
  assert.equal(manager.commitExecutionAuthority({ missionId: b.missionId, runId: run.runId, clientId: 'app', expectedRevision: prepared.activeRun.revision, expectedExecutionStateHash: prepared.activeRun.executionStateHash, handoffId: prepared.handoff.handoffId }).ok, true);
  const runtime = createTrackerMissionExecutionRuntime({ enabled: true, authorityManager: manager, payloadSyncBeforeStart: completed, playBoardingVoice: completed, playFarewellVoice: completed });
  runtime.attachSimulator({ getLivePosition: () => ({ lat: 48, lon: 8, altFt: 500, hdg: 0 }), dispatchCommand: completed, syncPayloadManifestState: completed, cleanupMission: completed });
  await tick();
  let serial = 0;
  async function intent(name, payload = {}) {
    run = manager.getActiveRun();
    const out = await runtime.executeIntent({ intent: name, payload, commandId: `chain-${++serial}`, missionId: run.missionId, runId: run.runId, expectedRevision: run.revision });
    for (let i = 0; i < 8; i++) await tick();
    return out;
  }
  async function sample(observedAt, patch = {}) {
    const out = runtime.observeTelemetry({ observedAt, lat: 48.3, lon: 8.5, altFt: 3000, aglFt: 600, gsKts: 85, hdg: 0, headingDeg: 0, onGround: false, ...patch });
    assert.equal(out.ok, true, JSON.stringify(out));
    for (let i = 0; i < 5; i++) await tick();
    await runtime.flush();
  }
  return { b, manager: () => manager, runtime, intent, sample, dir };
}

test('chain recipe crosses shared authority lifecycle, retains cargo gate, projects progress, and ends only after return', async t => {
  const h = await harness(t);
  assert.equal(poi.validateBundle(h.b), null);
  assert.equal((await h.intent('prepare_mission')).ok, true);
  assert.equal((await h.intent('start_boarding')).ok, true);
  // The real lifecycle refuses activation until the required physical item is loaded and signed.
  assert.equal((await h.intent('start_mission')).ok, false);
  assert.equal((await h.intent('set_manifest_item', { itemId: 'camera', action: 'load' })).ok, true);
  assert.equal((await h.intent('sign_manifest')).ok, true);
  assert.equal((await h.intent('confirm_load')).ok, true);
  assert.equal((await h.intent('start_mission')).ok, true);
  assert.equal(h.manager().getExecutionSnapshot().state.flags.active, true);

  for (let i = 0; i <= 30; i++) await h.sample(10000 + i * 1000, { lat: 48.3 + i * .001, lon: 8.5 });
  let control = h.manager().getPublicSnapshot().execution;
  assert.equal(control.poiTask.poiChain.satisfied, true);
  assert.equal(control.poiTask.satisfied, true);
  assert.equal(h.manager().getExecutionSnapshot().state.phase, 'return_leg');
  const view = projectTrackerEfbMissionView(h.manager().getActiveRun({ includeBundle: true }), null, null, control);
  assert.ok(view.view.progress.some(row => row.label === 'Kettenpunkte' && /3\/3/.test(row.detail)));

  await h.sample(50000, { lat: 48, lon: 8, onGround: true, aglFt: 0, gsKts: 20 });
  await h.sample(51000, { lat: 48, lon: 8, onGround: true, aglFt: 0, gsKts: 0 });
  assert.equal(h.manager().getExecutionSnapshot().state.phase, 'end_unloading');
  const completedRun = h.manager().getActiveRun({ includeBundle: true });
  assert.equal((await h.intent('set_manifest_item', { itemId: 'camera', action: 'unload' })).ok, true);
  assert.equal((await h.intent('sign_manifest')).ok, true);
  assert.equal((await h.intent('confirm_unload')).ok, true);
  for (let i = 0; i < 80 && h.manager().getActiveRun(); i++) await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(h.manager().getActiveRun(), null);
  const closed = h.manager().getPublicSnapshot().lastExecution;
  assert.equal(closed.phase, 'closed');
  assert.equal(closed.flags.closed, true);
  assert.equal(closed.flight.missionRecord.missionFailed, false);
  // Follow-up creation receives only the committed closed projection, never a
  // plausible-but-unconfirmed in-flight state.
  const followup = createForCompletedRun(completedRun, closed, Date.now());
  assert.equal(followup.requests.length, 1);
  assert.equal(followup.requests[0].followUpKind, 'infra_recheck');
  assert.equal(followup.requests[0].route.targetRef.name, 'Mast Süd');
  assert.equal(followup.requests[0].infraInspectionOutcome.outcome, 'monitor');
});

test('cloud gate accepts only a valid matching POI-chain recipe and restart keeps bounded worker continuity', async t => {
  const b = bundle();
  const profile = { activeMission: b.missionState, activeMissionTrackerSeed: { schema: 'ga.tracker-cloud-mission-seed.v1', version: 1,
    missionId: b.missionId, adapter: 'poi_chain', executionPoiRecipe: b.executionPoiRecipe, executionEffectPlan: b.executionEffectPlan } };
  assert.equal(buildCloudMissionCandidate(profile, { poiExecutionEnabled: true }).status, 'ready');
  const wrongDomain = JSON.parse(JSON.stringify(profile)); wrongDomain.activeMissionTrackerSeed.executionPoiRecipe.taskDomain = 'media_photo';
  assert.equal(buildCloudMissionCandidate(wrongDomain, { poiExecutionEnabled: true }).status, 'invalid');
  const badSpec = JSON.parse(JSON.stringify(profile)); badSpec.activeMissionTrackerSeed.executionPoiRecipe.poiChain.points = [{ id: 'only', lat: 48, lon: 8 }];
  assert.equal(buildCloudMissionCandidate(badSpec, { poiExecutionEnabled: true }).status, 'invalid');

  const h = await harness(t);
  for (const name of ['prepare_mission', 'start_boarding']) assert.equal((await h.intent(name)).ok, true);
  await h.intent('set_manifest_item', { itemId: 'camera', action: 'load' }); await h.intent('sign_manifest'); await h.intent('confirm_load'); await h.intent('start_mission');
  for (let i = 0; i <= 6; i++) await h.sample(10000 + i * 1000, { lat: 48.3 + i * .001 });
  const before = h.manager().getPublicSnapshot().execution.poiTask.poiChain;
  assert.ok(before.corridor.activeCoverage > 0);
  const restored = poi.createState(h.b.executionPoiRecipe, JSON.parse(JSON.stringify(h.manager().getExecutionSnapshot().state.poiTask)));
  assert.equal(poi.project(restored).poiChain.corridor.activeSegmentId, before.corridor.activeSegmentId);
  assert.equal(poi.project(restored).poiChain.completedCount, before.completedCount);
  // Missing GPS goes through the real POI runtime suspension path; it cannot bridge work after the next valid sample.
  await h.sample(18000, { lat: null, lon: null });
  const interrupted = h.manager().getPublicSnapshot().execution.poiTask.poiChain;
  assert.equal(interrupted.corridor.activeSegmentId, '');
  assert.equal(interrupted.completedCount, before.completedCount);
});

test('App seed keeps the original normalized chain and the map renders tracker progress without local ticking', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'sync.js'), 'utf8');
  const start = source.indexOf('function _buildMissionPoiExecutionSeed(');
  const next = source.indexOf('\nfunction ', start + 1);
  const buildSeed = source.slice(start, next).replace(/\n}\s*$/, '\n}');
  const normalized = require('../mission-poi-chain-core.js').normalizeSpec(chain);
  const passenger = { targetRadiusNm: 1, targetAltFt: 3000, targetDwellMin: 0 };
  const context = { schema: voice.CONTEXT_SCHEMA, version: 1, missionId: 'chain-seed', taskDomain: 'infra_chain_recon', strict: true,
    audioEnabled: false, baseContext: 'Leitungsprüfung.', passenger, speaker: passenger, chainSpec: normalized };
  const sandbox = { currentMissionData: { missionId: 'chain-seed', poiChain: chain }, window: {
    activePassenger: { ...passenger, poiChain: chain }, paxVoiceBuildPoiAuthorityContext: () => context,
    paxVoiceGetPoiMissionProgress: () => ({ trackingActive: true }), missionPoiChainRuntime: { getActiveSpec: () => normalized } },
    _activeMissionRuntimeId: () => 'chain-seed', _targetPointForMission: () => ({ lat: 48.3, lon: 8.5 }),
    _missionHomePointForRuntime: () => ({ lat: 48, lon: 8 }), _buildMissionAptExecutionEffectPlan: () => ({ effects: { 'scene.prepare': {}, 'scene.boarding': {}, 'scene.deboarding': {} } }),
    _missionTargetSceneKind: () => '', _missionTargetSceneItems: () => [], _missionTargetScenePoint: () => null,
    _missionTargetSceneRequestTerrain: () => { throw Error('unexpected terrain request'); } };
  vm.createContext(sandbox); vm.runInContext(buildSeed, sandbox);
  const seed = JSON.parse(JSON.stringify(sandbox._buildMissionPoiExecutionSeed()));
  assert.deepEqual(seed.executionPoiRecipe.poiChain, normalized);
  assert.deepEqual(seed.executionPoiRecipe.voiceContext.chainSpec, normalized);

  const layers = [], group = { addTo() { return this; }, clearLayers() { layers.length = 0; } };
  const mapSandbox = { console, module: { exports: {} }, window: {}, L: {
    layerGroup: () => group, polyline: (points, options) => ({ addTo() { layers.push({ points, options }); return this; }, bindTooltip() { return this; } }),
    circle: (point, options) => ({ addTo() { layers.push({ point, options }); return this; }, bindTooltip() { return this; } }),
    circleMarker: (point, options) => ({ addTo() { layers.push({ point, options }); return this; }, bindTooltip() { return this; } }),
    divIcon: options => options, marker: () => ({ addTo() { return this; } }) }, map: { hasLayer: () => false, removeLayer() {}, getPane: () => null, createPane: () => ({ style: {} }) } };
  mapSandbox.window.L = mapSandbox.L;
  vm.createContext(mapSandbox); vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'mission-poi-chain-runtime.js'), 'utf8'), mapSandbox);
  const api = mapSandbox.module.exports;
  const before = api.snapshot();
  api.renderAuthorityProjection(normalized, { completedPointIds: ['p1'], currentIndex: 1, areaEntered: true, satisfied: false,
    corridor: { completedSegmentIds: ['C1'], currentSegmentIndex: 1, activeSegmentId: 'C2', activeCoverage: .5, totalSegments: 3, satisfied: false } });
  assert.deepEqual(api.snapshot(), before);
  assert.ok(layers.some(layer => layer.options?.color === '#24d26b'));
});
