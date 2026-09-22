'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const execution = require('../mission-execution-core');
const lifecycle = require('../mission-poi-lifecycle-core');
const voice = require('../mission-poi-voice-core');
const boarding = require('../mission-boarding-voice-core');
const poi = require('./tracker-mission-poi-runtime');
const { createMissionAuthorityManager } = require('./mission-authority-core');
const { createTrackerMissionExecutionRuntime } = require('./tracker-mission-execution-runtime');
const { createTrackerMissionExecutionAdapter } = require('./tracker-mission-execution-adapter');
const { createTrackerMissionFarewellVoice } = require('./tracker-mission-farewell-voice');
const { buildCloudMissionCandidate } = require('./tracker-mission-cloud');
const { projectTrackerEfbMissionView } = require('./tracker-efb-mission-view-core');
const tick = () => new Promise(resolve => setImmediate(resolve));
const completed = () => ({ ok: true, status: 'completed' });
function bundle() {
  const passenger = { name: 'Mia', role: 'Fotografin', targetRadiusNm: 1.5, targetAltFt: 3000, targetDwellMin: 0 };
  const context = { schema: voice.CONTEXT_SCHEMA, version: 1, missionId: 'full-poi', taskDomain: 'media_photo',
    strict: true, audioEnabled: false, baseContext: 'Fotografin am Arbeitsziel.', toneHint: ' Deutsch.',
    passenger, speaker: passenger, briefingWeather: {}, missionAudioKey: 'farewell:full-poi',
    flight: { depLabel: 'HOME', arrLabel: 'HOME' } };
  const value = { version: 2, missionId: 'full-poi', adapter: 'poi', descriptor: { primaryAdapter: 'poi' },
    executionPoiRecipe: { schema: poi.RECIPE_SCHEMA, version: 1, missionId: 'full-poi', taskDomain: 'media_photo',
      target: { lat: 48.3, lon: 8.5 }, home: { lat: 48, lon: 8 }, passenger,
      strict: true, trackingActive: true, voiceContext: context, lifecycle: { schema: lifecycle.SCHEMA } },
    missionState: { currentMissionData: { missionId: 'full-poi', missionType: 'poi', poiName: 'Brücke',
      start: 'HOME', dest: 'POI', passenger, routeWaypoints: [{ lat: 48, lng: 8 }, { lat: 48.3, lng: 8.5, isPOI: true }] } },
    runtime: { missionId: 'full-poi', startPhase: 'planned', lastLiveFlightData: { onGround: true, gsKts: 0 },
      runtime: { missionId: 'full-poi', phase: 'planned', active: false },
      cargoManifest: { version: 6, key: 'full-poi-manifest', items: [
        { id: 'camera', label: 'Kamera', itemType: 'cargo', required: true, status: 'pending', weightLbs: 15, healthPct: 100, deliverAtDestination: true }
      ] } },
    executionEffectPlan: { schema: 'ga.mission-poi-effect-plan.v1', recipe: 'poi', missionId: 'full-poi', sceneId: 'poi-scene',
      cargoItemAssets: [], cargoPlacement: {}, effects: {
        'scene.prepare': { command: { type: 'mission_scene_spawn', sceneId: 'poi-scene', items: [{ kind: 'person_boarder_1', objectTitle: 'Tarmac_Male' }] } },
        'scene.boarding': { command: { type: 'mission_scene_boarding', sceneId: 'poi-scene', path: [{ forwardM: 16, rightM: -8 }, { forwardM: 4, rightM: 8 }] } },
        'scene.deboarding': { none: true },
        'scene.target': { none: true },
        'voice.boarding': { recipe: boarding.createRecipe({ missionId: 'full-poi', prompt: 'Bereit.', audioEnabled: false }) },
        'voice.approach': { context: { ...context, supported: true, mode: 'passenger', departure: { lat: 48, lon: 8 }, hasAptArrivalRuntimePoint: false } },
        'voice.farewell': { poiContextRef: true }
      } } };
  return replay(value);
}
function replay(b) {
  b.executionReplay = execution.createExecutionBundle(b);
  b.execution = execution.createReplayShadowEnvelope(b.executionReplay, { sourceRevision: 0, legacyBundle: b });
  return b;
}
async function harness(t, options = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'poi-lifecycle-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const config = { storageFile: path.join(dir, 'authority.json'), executionAuthorityEnabled: true, poiExecutionEnabled: true, idFactory: () => 'poi-run' };
  let manager = createMissionAuthorityManager(config);
  const b = options.bundle || bundle();
  const acquired = manager.acquire({ missionId: b.missionId, clientId: 'app', stateHash: 'app', resumeBundle: b });
  const run = acquired.activeRun;
  const prepared = manager.prepareExecutionAuthority({ missionId: b.missionId, runId: run.runId, clientId: 'app',
    expectedRevision: run.revision, expectedStateHash: run.stateHash, expectedExecutionStateHash: execution.replay(b.executionReplay).stateHash });
  assert.equal(prepared.ok, true, JSON.stringify(prepared));
  assert.equal(manager.commitExecutionAuthority({ missionId: b.missionId, runId: run.runId, clientId: 'app', expectedRevision: prepared.activeRun.revision,
    expectedExecutionStateHash: prepared.activeRun.executionStateHash, handoffId: prepared.handoff.handoffId }).ok, true);
  const commands = [], farewell = [], payloads = [];
  let position = { lat: 48, lon: 8, altFt: 500, hdg: 90 };
  let runtime, adapter, bridge;
  function connect() {
    adapter = createTrackerMissionExecutionAdapter({ authorityManager: manager });
    const fv = createTrackerMissionFarewellVoice({ authorityManager: manager });
    const runtimeAuthority = { ...manager,
      ...(options.pauseFinalization ? { finalizeExecutionRun: () => ({ ok: false, status: 'interrupted' }) } : {}),
      recordExecutionRuntimeContext: request => options.blockRecorder?.(manager.getExecutionSnapshot())
        ? { ok: false, error: 'test_recorder_disk_failure' } : manager.recordExecutionRuntimeContext(request) };
    runtime = createTrackerMissionExecutionRuntime({ enabled: true, authorityManager: runtimeAuthority,
      fairEffectScheduling: options.workerScheduling === true, allowIntentRevisionRebase: options.workerScheduling === true,
      payloadSyncBeforeStart: completed, playBoardingVoice: options.voice || completed,
      playFarewellVoice: request => { farewell.push(request); return fv.dispatch(request); },
      prepareFarewellVoice: fv.prepare });
    bridge = runtime.attachSimulator({ getLivePosition: () => position,
      dispatchCommand: command => { commands.push(command); return options.dispatch ? options.dispatch(command) : completed(); },
      syncPayloadManifestState: request => { payloads.push(request); return completed(); },
      cleanupMission: options.cleanup || completed });
  }
  connect(); await tick();
  let sequence = 0;
  async function intent(intent, payload = {}) {
    const run = manager.getActiveRun();
    const result = await runtime.executeIntent({ intent, payload, commandId: `user-${++sequence}`, missionId: run.missionId, runId: run.runId, expectedRevision: run.revision });
    assert.equal(result.ok, true, JSON.stringify(result));
    for (let i = 0; i < 12; i++) await tick();
    return result;
  }
  function sample(at, patch = {}) {
    const sample = { observedAt: at, lat: 48.1, lon: 8.1, altFt: 3000, aglFt: 500, gsKts: 95, hdg: 90, onGround: false, ...patch };
    position = sample;
    const result = runtime.observeTelemetry(sample);
    assert.equal(result.ok, true, JSON.stringify(result));
    return result;
  }
  async function start() {
    await intent('prepare_mission'); await intent('start_boarding');
    await intent('set_manifest_item', { itemId: 'camera', action: 'load' });
    await intent('sign_manifest'); await intent('confirm_load'); await intent('start_mission');
  }
  return { b, commands, farewell, payloads, start, intent, sample,
    setLivePosition(value) { position = value; },
    get manager() { return manager; }, get runtime() { return runtime; }, get adapter() { return adapter; }, get bridge() { return bridge; },
    rawIntent: (intent, payload = {}) => { const run = manager.getActiveRun(); return runtime.executeIntent({ intent, payload, commandId: `raw-${++sequence}`, missionId: run.missionId, runId: run.runId, expectedRevision: run.revision }); },
    async restart() { runtime.detachSimulator(); options.pauseFinalization = false; manager = createMissionAuthorityManager(config); connect(); await tick(); } };
}

for (const workerScheduling of [false, true]) test(`full POI flight/task/away-end with autonomous close; worker scheduling=${workerScheduling}`, async t => {
  const h = await harness(t, { workerScheduling }); await h.start();
  h.sample(10000); h.sample(12000);
  h.sample(14000, { lat: 48.3, lon: 8.5 });
  assert.equal(h.manager.getExecutionSnapshot().state.progress.targetSatisfied, true);
  assert.equal(h.manager.getExecutionSnapshot().state.phase, 'return_leg');
  h.sample(16000, { lat: 49, lon: 9, onGround: true, aglFt: 0, gsKts: 20 });
  h.sample(17000, { lat: 49, lon: 9, onGround: true, aglFt: 0, gsKts: 0 });
  assert.equal(h.manager.getExecutionSnapshot().state.phase, 'end_unloading');
  assert.equal(h.manager.getExecutionSnapshot().state.poiLifecycle.needsRideHome, true);
  await h.restart();
  assert.equal(h.adapter.getFarewellDynamicContext().record.poiNeedsRideHome, true);
  await h.intent('set_manifest_item', { itemId: 'camera', action: 'unload' });
  await h.intent('sign_manifest'); await h.intent('confirm_unload');
  for (let i = 0; i < 100 && h.manager.getActiveRun(); i++) await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(h.manager.getActiveRun(), null);
  assert.equal(h.farewell.length, 1);
  assert.equal(h.farewell[0].farewellDynamicContext.missionFailed, false);
  assert.equal(h.farewell[0].farewellDynamicContext.record.poiNeedsRideHome, true);
  assert.ok(h.payloads.length >= 2);
  assert.ok(h.commands.some(c => c.type === 'mission_scene_spawn'));
});

test('unfinished task closes as failed after flight; invalid telemetry and pauses do not open the gate', async t => {
  const h = await harness(t); await h.start();
  h.sample(10000, { lat: null, onGround: true, gsKts: 0 });
  assert.equal(h.manager.getExecutionSnapshot().state.poiLifecycle, undefined);
  h.sample(12000); h.sample(14000); h.sample(15000);
  h.sample(16000, { lat: 49, lon: 9, onGround: true, aglFt: 0, gsKts: 0, simPaused: true });
  assert.equal(h.manager.getExecutionSnapshot().state.poiLifecycle.canEndHere, false);
  h.sample(18000, { lat: 49, lon: 9, onGround: true, aglFt: 0, gsKts: 10 });
  h.sample(20000, { lat: 49, lon: 9, onGround: true, aglFt: 0, gsKts: 0 });
  await h.intent('set_manifest_item', { itemId: 'camera', action: 'unload' });
  await h.intent('sign_manifest'); await h.intent('confirm_unload');
  for (let i = 0; i < 100 && h.manager.getActiveRun(); i++) await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(h.manager.getActiveRun(), null);
  assert.equal(h.farewell[0].farewellDynamicContext.missionFailed, true);
  assert.ok(h.farewell[0].farewellDynamicContext.cargoOutcome.notDeliveredRequired.includes('POI-Auftrag wurde nicht abgeschlossen.'));
});

test('full seed is opt-in, validated, and bounded with a large voice context', () => {
  const b = bundle();
  const profile = { activeMission: b.missionState, activeMissionTrackerSeed: { schema: 'ga.tracker-cloud-mission-seed.v1', version: 1,
    missionId: b.missionId, adapter: 'poi', executionPoiRecipe: b.executionPoiRecipe, executionEffectPlan: b.executionEffectPlan } };
  assert.equal(buildCloudMissionCandidate(profile).status, 'unsupported');
  const result = buildCloudMissionCandidate(profile, { poiExecutionEnabled: true });
  assert.equal(result.status, 'ready', JSON.stringify(result));
  b.executionPoiRecipe.voiceContext.wikiText = 'ä'.repeat(18000);
  assert.equal(poi.validateBundle(b), null);
  assert.ok(Buffer.byteLength(JSON.stringify(b)) < 384 * 1024);
  assert.ok(Buffer.byteLength(JSON.stringify(profile)) < 256 * 1024);
  delete b.executionEffectPlan.effects['scene.boarding'];
  assert.equal(poi.validateBundle(b), 'poi_lifecycle_scene_plan_missing');
});

function passengerBundle() {
  const b = bundle();
  b.runtime.cargoManifest.items.push({ id: 'pax', itemType: 'passenger', passengerCount: 1, weightLbs: 180, required: true, status: 'pending', deliverAtDestination: true });
  b.executionEffectPlan.effects['scene.deboarding'] = { command: { type: 'mission_scene_deboarding', sceneId: 'poi-scene',
    path: [{ forwardM: 4, rightM: 8 }, { forwardM: 16, rightM: -8 }] } };
  b.executionEffectPlan.manualPassengerCommands = ['unload', 'reload'].map(operation => ({ itemId: 'pax', operation,
    command: { type: 'mission_scene_manual_pax', sceneId: 'poi-scene', action: operation === 'reload' ? 'load' : 'unload',
      doorOpenWaitMs: 2000, doorCloseWaitMs: 1000, boardingPoint: { forwardM: 4, rightM: 8 },
      personKind: 'unloaded_pax', personTitle: 'Tarmac_Female' } }));
  return replay(b);
}

test('manual POI passenger unload/reload uses original scene commands, rollback invalidates signature, busy survives reconnect', async t => {
  let mode = 'fail';
  const h = await harness(t, { bundle: passengerBundle(), dispatch: command => command.type === 'mission_scene_manual_pax'
    ? (mode === 'fail' ? { ok: false, error: 'door_failed' } : mode === 'pending' ? { ok: true, status: 'pending' } : completed()) : completed() });
  await h.start();
  assert.equal(h.manager.getExecutionSnapshot().state.manifest.items.find(i => i.id === 'pax').status, 'loaded');
  await h.intent('request_pax_interaction', { itemId: 'pax', action: 'unload' });
  let s = h.manager.getExecutionSnapshot();
  assert.equal(s.state.manifest.items.find(i => i.id === 'pax').status, 'loaded');
  assert.notEqual(s.state.cargo.signatureScope, 'departure');
  const command = h.commands.find(c => c.type === 'mission_scene_manual_pax');
  assert.equal(command.doorOpenWaitMs, 2000); assert.equal(command.doorCloseWaitMs, 1000);
  mode = 'pending';
  await h.intent('request_pax_interaction', { itemId: 'pax', action: 'unload' });
  assert.equal((await h.rawIntent('request_pax_interaction', { itemId: 'pax', action: 'load' })).ok, false);
  await h.restart();
  assert.equal((await h.rawIntent('request_pax_interaction', { itemId: 'pax', action: 'load' })).ok, false);
  // A real simulator sends the acknowledgement; test its timeout/rollback via the same bridge in the shared bridge tests.
  h.runtime.detachSimulator();
});

test('POI original stress affects required task equipment before target evaluation and preserves debug protection', async t => {
  const h = await harness(t); await h.start();
  h.sample(10000, { gForce: 4, bankDeg: 80, vsFpm: -2000 });
  const manifest = h.manager.getExecutionSnapshot().state.manifest;
  assert.equal(manifest.maxStressDamagePct, 77);
  assert.equal(manifest.items[0].healthPct, 23);
  const control = h.manager.getPublicSnapshot().execution;
  const view = projectTrackerEfbMissionView(h.manager.getActiveRun({includeBundle:true}), null, null, control);
  assert.equal(view.manifest.items[0].healthPct, 23);
  assert.equal(view.view.cargo.conditionPct, 23);
  assert.equal(view.view.cargo.requiredLoaded, 1);
  assert.match(view.view.cargo.state, /^1 geladen/);
  assert.ok(control.comfort.comfortScore < 100);
  assert.ok(view.view.feedback.some(row => row.label === 'Pflichtladung beschädigt'));
  assert.equal(view.view.comfort.score, control.comfort.comfortScore);
  const comfortBeforePause = h.manager.getExecutionRuntimeContext().comfort;
  h.sample(10000, { gForce: 4, bankDeg: 80 });
  h.sample(16000, { gForce: 4, bankDeg: 80, simPaused: true });
  assert.deepEqual(h.manager.getExecutionRuntimeContext().comfort, comfortBeforePause);
  await h.restart();
  assert.deepEqual(h.manager.getPublicSnapshot().execution.comfort, control.comfort);
  h.sample(22000, { gForce: 4, bankDeg: 80, vsFpm: -2000 });
  assert.equal(h.manager.getPublicSnapshot().execution.comfort.pilotEvents, control.comfort.pilotEvents,
    'continuing the same event after restore must not count a second rising edge');

  const b = bundle(); b.executionPoiRecipe.voiceContext.motionProtectionEnabled = true; replay(b);
  const protectedRun = await harness(t, { bundle: b }); await protectedRun.start();
  protectedRun.sample(10000, { gForce: 4, bankDeg: 80, vsFpm: -2000 });
  assert.equal(protectedRun.manager.getExecutionSnapshot().state.manifest.items[0].healthPct, 100);
  assert.equal(protectedRun.manager.getPublicSnapshot().execution.comfort.comfortScore, 100);
  assert.equal(protectedRun.manager.getPublicSnapshot().execution.comfort.debugMotionProtection, true);
});

test('POI route revision leaves task anchors and execution hash intact across restart', async t => {
  const h = await harness(t);
  const before = h.manager.getExecutionSnapshot();
  const recipe = h.manager.getExecutionPoiRecipe();
  assert.equal(h.manager.editNavigationRoute({ routeId: 'poi-run', expectedRevision: 0,
    edit: { action: 'insert', index: 1, point: { lat: 48.1, lng: 8.15 } } }).ok, true);
  assert.equal(h.manager.getExecutionSnapshot().executionStateHash, before.executionStateHash);
  assert.deepEqual(h.manager.getExecutionPoiRecipe(), recipe);
  assert.equal(h.manager.editNavigationRoute({ routeId: 'poi-run', expectedRevision: 0, edit: { action: 'reset' } }).error, 'navigation_revision_conflict');
  await h.restart(); assert.equal(h.manager.getActiveRun().navigationRevision, 1);
});

test('POI cleanup failure retains authoritative run and retry releases only after cleanup', async t => {
  let attempts = 0;
  const h = await harness(t, { cleanup: () => ++attempts === 1 ? { ok: false, error: 'payload_restore_failed' } : completed() });
  await h.start();
  assert.equal((await h.rawIntent('abort_mission')).error, 'payload_restore_failed');
  assert.ok(h.manager.getActiveRun());
  assert.equal((await h.rawIntent('abort_mission')).ok, true);
  assert.equal(h.manager.getActiveRun(), null); assert.equal(attempts, 2);
});

test('POI canonical status, failure and text appear identically on two EFB projections', async t => {
  const h = await harness(t); await h.start(); h.sample(10000); h.sample(14000, { lat: 48.3, lon: 8.5 });
  const snapshot = h.manager.getExecutionSnapshot();
  const pending = snapshot.state.effects.find(e => e.type === 'voice.poi');
  // Text-ready is committed independently of audio, as in the voice service.
  const result = h.manager.applyExecutionEvent({ missionId: snapshot.missionId, runId: snapshot.runId,
    expectedRevision: snapshot.authorityRevision, expectedExecutionRevision: snapshot.executionRevision, expectedExecutionStateHash: snapshot.executionStateHash,
    event: { eventId: 'text-ready-ui', type: 'POI_VOICE_TEXT_READY', sequence: snapshot.executionRevision + 1, occurredAt: Date.now(),
      payload: { effectId: pending.effectId, text: 'Die Aufnahmen sind im Kasten.' } } });
  assert.equal(result.ok, true);
  const control = h.manager.getPublicSnapshot().execution;
  const run = h.manager.getActiveRun({ includeBundle: true });
  const first = projectTrackerEfbMissionView(run, null, null, control);
  const second = projectTrackerEfbMissionView(JSON.parse(JSON.stringify(run)), null, null, JSON.parse(JSON.stringify(control)));
  assert.deepEqual(first, second);
  assert.equal(first.ui.schema, 'ga.mission-poi-ui.v1');
  assert.equal(first.voice.text, 'Die Aufnahmen sind im Kasten.');
  assert.match(first.view.detail, /erfüllt/);
  assert.equal(first.ui.banner, null);
});

for (const crash of ['after-confirm', 'after-close-ack']) test(`POI recovers ${crash} exactly once`, async t => {
  const h = await harness(t, { pauseFinalization: crash === 'after-close-ack' }); await h.start();
  for (let at = 10000; at <= 35000; at += 1000) h.sample(at);
  h.sample(36000, { onGround: true, aglFt: 0, gsKts: 20 });
  h.sample(37000, { onGround: true, aglFt: 0, gsKts: 0 });
  await h.intent('set_manifest_item', { itemId: 'camera', action: 'unload' }); await h.intent('sign_manifest');
  for (let i = 0; i < 60 && h.runtime.publicState().effects.pendingEffects.length; i++) await new Promise(resolve => setTimeout(resolve, 20));
  if (crash === 'after-confirm') {
    h.runtime.detachSimulator();
    const s = h.manager.getExecutionSnapshot();
    assert.equal(h.adapter.executeIntent({ intent: 'confirm_unload', commandId: 'crash-confirm', missionId: s.missionId, runId: s.runId, expectedRevision: s.authorityRevision }).ok, true);
    assert.equal(h.farewell.length, 0);
  } else {
    await h.intent('confirm_unload');
    for (let i = 0; i < 60 && h.manager.getExecutionSnapshot()?.state.phase !== 'closed'; i++) await new Promise(resolve => setTimeout(resolve, 20));
    assert.equal(h.manager.getExecutionSnapshot().state.phase, 'closed');
    assert.equal(h.farewell.length, 1);
  }
  await h.restart();
  for (let i = 0; i < 100 && h.manager.getActiveRun(); i++) await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(h.manager.getActiveRun(), null); assert.equal(h.farewell.length, 1);
  const finished = h.manager.getPublicSnapshot().lastExecution;
  assert.equal(finished.flags.unloadConfirmed, true);
  assert.equal(finished.poiOutcome.failed, true);
  assert.equal(finished.flight.missionRecord?.missionFailed, true);
  await h.restart(); assert.equal(h.farewell.length, 1);
});

test('large POI seed compacts a long journal while retaining pending speech and duplicate receipts', async t => {
  const b = bundle(); b.executionPoiRecipe.voiceContext.wikiText = 'Kontext '.repeat(6500);
  replay(b);
  const h = await harness(t, { bundle: b, voice: request => request.effect.type === 'voice.poi' ? { ok: true, status: 'pending' } : completed() });
  await h.start(); h.sample(10000); h.sample(14000, { lat: 48.3, lon: 8.5 });
  await tick();
  const pending = h.manager.getExecutionSnapshot().state.effects.find(e => e.type === 'voice.poi');
  assert.equal(pending.status, 'requested');
  let lastRequest;
  for (let i = 0; i < 340; i++) {
    const s = h.manager.getExecutionSnapshot();
    lastRequest = { missionId: s.missionId, runId: s.runId, expectedRevision: s.authorityRevision,
      expectedExecutionRevision: s.executionRevision, expectedExecutionStateHash: s.executionStateHash,
      event: { eventId: `long-poi-${i}`, type: i % 2 ? 'CARGO_WINDOW_CLOSED' : 'CARGO_WINDOW_OPENED',
        sequence: s.executionRevision + 1, occurredAt: 20000 + i, payload: { mode: 'load' } } };
    assert.equal(h.manager.applyExecutionEvent(lastRequest).ok, true);
  }
  const run = h.manager.getActiveRun({ includeBundle: true });
  assert.ok(run.resumeBundle.executionReplay.events.length <= 160);
  assert.ok(Buffer.byteLength(JSON.stringify(run.resumeBundle)) < 384 * 1024);
  assert.equal(h.manager.getExecutionSnapshot().state.effects.find(e => e.effectId === pending.effectId).status, 'requested');
  assert.equal(h.manager.applyExecutionEvent(lastRequest).duplicate, true);
  await h.restart();
  assert.equal(h.manager.getExecutionSnapshot().state.effects.find(e => e.effectId === pending.effectId).status, 'requested');
});

test('App POI seed uses original builders, carries target scene and fails closed for unresolved terrain/specializations', () => {
  const source = fs.readFileSync(path.join(__dirname, '../sync.js'), 'utf8');
  const extract = name => { const start = source.indexOf(`function ${name}(`); const end = source.indexOf('\nfunction ', start + 1); const block = source.slice(start, end < 0 ? undefined : end); return block.slice(0, block.lastIndexOf('\n}') + 2); };
  const b = bundle(); let terrainRequests = 0, terrainReady = true;
  const sandbox = { currentMissionData: b.missionState.currentMissionData,
    window: { activePassenger: b.executionPoiRecipe.passenger, paxVoiceBuildPoiAuthorityContext: () => b.executionPoiRecipe.voiceContext,
      paxVoiceGetPoiMissionProgress: () => ({ trackingActive: true }), liveTrackerCapabilities: ['mission.intent.v1'] },
    _activeMissionRuntimeId: () => b.missionId, _targetPointForMission: () => b.executionPoiRecipe.target,
    _missionHomePointForRuntime: () => b.executionPoiRecipe.home,
    _buildMissionAptExecutionEffectPlan: recipe => { assert.equal(recipe, 'poi'); return JSON.parse(JSON.stringify(b.executionEffectPlan)); },
    _missionTargetSceneKind: () => 'survey_context', _missionTargetSceneItems: () => [{ kind: 'marker', objectTitle: 'Original scene asset' }],
    _missionTargetScenePoint: () => terrainReady ? { lat: 48.3, lon: 8.5, altFt: 800, hdg: 90 } : null,
    _missionTargetSceneId: () => 'original-target', _missionTargetSceneRequestTerrain: () => terrainRequests++,
    _missionSceneIsPoiMission: () => true, _trackerSupportsMissionIntents: () => sandbox.window.liveTrackerCapabilities.includes('mission.intent.v1'),
    missionExecutionRequestedMissionId: '' };
  vm.createContext(sandbox); vm.runInContext(extract('_buildMissionPoiExecutionSeed') + '\n' + extract('_missionStartUsesTrackerExecution'), sandbox);
  const seed = sandbox._buildMissionPoiExecutionSeed();
  assert.equal(seed.executionEffectPlan.effects['scene.target'].command.lat, 48.3);
  assert.equal(seed.executionEffectPlan.effects['voice.farewell'].poiContextRef, true);
  assert.equal(poi.validateBundle({ ...b, ...JSON.parse(JSON.stringify(seed)) }), null);
  assert.equal(sandbox._missionStartUsesTrackerExecution(), false);
  sandbox.window.liveTrackerCapabilities.push('mission.poi.v1'); assert.equal(sandbox._missionStartUsesTrackerExecution(), true);
  sandbox.window.liveTrackerCapabilities = []; assert.equal(sandbox._missionStartUsesTrackerExecution(), true);
  terrainReady = false; assert.equal(sandbox._buildMissionPoiExecutionSeed(), null); assert.equal(terrainRequests, 1);
  terrainReady = true; sandbox.currentMissionData.poiChain = {}; assert.equal(sandbox._buildMissionPoiExecutionSeed(), null);
});

test('POI validates physical plans before handoff and spawns the work scene at its fixed original anchor', async t => {
  const b = bundle();
  b.executionEffectPlan.effects['scene.target'] = { command: { type: 'mission_scene_spawn', sceneId: 'original-target',
    lat: 48.3, lon: 8.5, altFt: 800, hdg: 135, items: [{ kind: 'marker', objectTitle: 'Original asset' }] } };
  const h = await harness(t, { bundle: replay(b) }); await h.start();
  const command = h.commands.find(c => c.sceneId === 'original-target');
  assert.ok(command); assert.equal(command.lat, 48.3); assert.equal(command.lon, 8.5); assert.equal(command.altFt, 800);
  assert.equal(h.commands.filter(c => c.sceneId === 'original-target').length, 1);
  await h.restart(); assert.equal(h.commands.filter(c => c.sceneId === 'original-target').length, 1);
  b.executionEffectPlan.effects['scene.target'].command.altFt = null;
  assert.equal(poi.validateBundle(b), 'poi_lifecycle_target_position_invalid');
  b.executionEffectPlan.effects['scene.target'] = { none: true };
  b.executionEffectPlan.effects['scene.boarding'].command.path = [];
  assert.equal(poi.validateBundle(b), 'poi_lifecycle_scene_plan_invalid');
  b.executionEffectPlan.effects['scene.boarding'] = { none: true };
  b.executionEffectPlan.effects['voice.boarding'].recipe.missionId = 'other';
  assert.equal(poi.validateBundle(b), 'poi_lifecycle_voice_plan_invalid');
});

test('POI final passenger deboarding waits for scene cue, farewell and physical ACK before payload release', async t => {
  const h = await harness(t, { bundle: passengerBundle(), dispatch: command => ({ ok: true,
    status: command.type === 'mission_scene_deboarding' ? 'pending' : 'completed' }) });
  await h.intent('prepare_mission'); await h.intent('start_boarding');
  await h.intent('set_manifest_item', { itemId: 'camera', action: 'load' });
  assert.equal(h.manager.getExecutionSnapshot().state.manifest.items.find(i => i.id === 'pax').status, 'loaded');
  await h.intent('sign_manifest'); await h.intent('confirm_load'); await h.intent('start_mission');
  for (let at = 10000; at <= 35000; at += 1000) h.sample(at);
  h.sample(36000, { onGround: true, aglFt: 0, gsKts: 20 });
  h.sample(37000, { onGround: true, aglFt: 0, gsKts: 0 });
  await h.intent('set_manifest_item', { itemId: 'camera', action: 'unload' });
  await h.intent('sign_manifest'); await h.intent('confirm_unload');
  for (let i = 0; i < 80 && !h.commands.some(c => c.type === 'mission_scene_deboarding'); i++) await new Promise(resolve => setTimeout(resolve, 10));
  const command = h.commands.find(c => c.type === 'mission_scene_deboarding');
  assert.ok(command); assert.equal(command.coordinateFarewell, true); assert.equal(h.farewell.length, 0);
  const pax = () => h.manager.getExecutionSnapshot().state.manifest.items.find(i => i.id === 'pax');
  assert.equal(pax().status, 'loaded');
  assert.equal(h.bridge.handleAck({ type: 'mission_scene_deboarding_stage', commandId: command.commandId, stage: 'cue', status: 'ok' }), true);
  for (let i = 0; i < 80 && !h.commands.some(c => c.type === 'mission_scene_deboarding_continue'); i++) await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(h.farewell.length, 1);
  assert.ok(h.commands.some(c => c.type === 'mission_scene_deboarding_continue' && c.deboardingCommandId === command.commandId));
  assert.equal(pax().status, 'loaded');
  assert.equal(h.bridge.handleAck({ type: 'mission_scene_deboarding_ack', commandId: command.commandId, status: 'ok' }), true);
  for (let i = 0; i < 80 && h.manager.getActiveRun(); i++) await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(h.manager.getActiveRun(), null);
  assert.equal(h.manager.getPublicSnapshot().lastExecution.phase, 'closed');
  assert.equal(h.farewell.length, 1);
});

for (const recovery of ['restart', 'next-telemetry']) test(`POI preserves a failed recorder checkpoint and recovers via ${recovery} without repeating farewell`, async t => {
  let blocked = true;
  const h = await harness(t, { blockRecorder: snapshot => blocked && snapshot.state.phase === 'closed' });
  await h.start();
  for (let at = 10000; at <= 35000; at += 1000) h.sample(at);
  h.sample(36000, { onGround: true, aglFt: 0, gsKts: 20 });
  h.sample(37000, { onGround: true, aglFt: 0, gsKts: 0 });
  await h.intent('set_manifest_item', { itemId: 'camera', action: 'unload' });
  await h.intent('sign_manifest'); await h.intent('confirm_unload');
  for (let i = 0; i < 80 && h.manager.getExecutionSnapshot()?.state.phase !== 'closed'; i++) await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(h.manager.getExecutionSnapshot().state.phase, 'closed');
  assert.equal(h.farewell.length, 1); assert.ok(h.manager.getActiveRun());
  blocked = false;
  if (recovery === 'restart') await h.restart(); else h.sample(38000);
  for (let i = 0; i < 80 && h.manager.getActiveRun(); i++) await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(h.manager.getActiveRun(), null); assert.equal(h.farewell.length, 1);
  assert.equal(h.manager.getPublicSnapshot().lastExecution.flight.missionRecord.missionFailed, true);
});

for (const missingPosition of [false, true]) test(`full POI pause preserves dwell and complaint clocks; missing position=${missingPosition}`, async t => {
  const b = bundle(); b.executionPoiRecipe.passenger.targetDwellMin = 2;
  b.executionPoiRecipe.voiceContext.passenger.targetDwellMin = 2;
  const h = await harness(t, { bundle: replay(b) }); await h.start();
  h.sample(10000, { lat: 48.3, lon: 8.5 }); h.sample(12000, { lat: 48.3, lon: 8.5 }); h.runtime.flush();
  const before = h.manager.getExecutionSnapshot().state.poiTask.detector;
  h.sample(13000, { simPaused: true, ...(missingPosition ? { lat: null, lon: null, altFt: null, gsKts: null, onGround: null } : {}) });
  assert.equal(h.manager.getExecutionSnapshot().state.poiTask.suspendedAt, 13000);
  h.sample(133000, { lat: 48.3, lon: 8.5 }); h.runtime.flush();
  const after = h.manager.getExecutionSnapshot().state.poiTask.detector;
  assert.equal(after.dwellSec, before.dwellSec + 2);
  assert.equal(after.enteredAt, before.enteredAt + 120000);
  assert.equal(after.attempts, 0);
  h.runtime.detachSimulator();
});

test('Tracker POI projection preserves outside-radius and entry flags, legacy resume retains its heuristic', () => {
  const source = fs.readFileSync(path.join(__dirname, '../passenger-voice.js'), 'utf8');
  const start = source.indexOf('window.paxVoiceRestorePoiMissionProgress = function(');
  const end = source.indexOf('\n};', start) + 3;
  let projection;
  const sandbox = { window: { GAMissionPoiTaskCore: require('../mission-poi-task-core') }, _poiEnteredAt: null,
    _applyPoiTaskDetectorState: state => { projection = state; }, _paxLog: () => {}, _refreshPaxWidgetVisibility: () => {} };
  vm.createContext(sandbox); vm.runInContext(source.slice(start, end), sandbox);
  const progress = { dwellSec: 4, inRadius: false, entryDone: true, sightCallDone: true, attempts: 1 };
  sandbox.window.paxVoiceRestorePoiMissionProgress(progress, 'tracker-projection');
  assert.equal(projection.inRadius, false); assert.equal(projection.entryDone, true); assert.equal(projection.attempts, 1);
  sandbox.window.paxVoiceRestorePoiMissionProgress(progress, 'mission-resume');
  assert.equal(sandbox._poiInRadius, true);
});

test('manual POI requests use confirmed task state, serialize across controllers and recover the prepared original prompt', async t => {
  const b = bundle(); b.executionPoiRecipe.passenger.targetDwellMin = 2;
  b.executionPoiRecipe.voiceContext.passenger.targetDwellMin = 2;
  b.executionPoiRecipe.voiceContext.missionData = { poiName: 'Brücke' };
  b.executionPoiRecipe.voiceContext.mapPlaceOrientationLine = 'GROBER KARTENBEZUG: Brücke liegt etwa 5 NM nördlich von Stadt.';
  const h = await harness(t, { bundle: replay(b), voice: request => request.effect.type === 'voice.poi' ? { ok: true, status: 'pending' } : completed() });
  await h.start(); h.sample(10000, { lat: 48.3, lon: 8.5 }); h.sample(12000, { lat: 48.3, lon: 8.5 });
  h.sample(14000, { lat: 48, lon: 8 });
  h.setLivePosition({ lat: 48, lon: 8, alt: 4100, hdg: 90 });
  await h.intent('poi_status');
  const snapshot = h.manager.getExecutionSnapshot();
  const action = snapshot.state.effects.find(e => e.type === 'voice.poi' && e.payload.action === 'poi_status');
  assert.ok(action); assert.match(action.payload.resolvedRecipe.prompt, /noch im Anflug/);
  assert.doesNotMatch(action.payload.resolvedRecipe.prompt, /Datenaufnahme laeuft/);
  assert.match(action.payload.resolvedRecipe.prompt, /1100 ft zu hoch gegen Ziel 3000 ft/);
  assert.equal((await h.rawIntent('poi_orientation')).ok, false, 'second controller cannot queue another manual answer while pending');
  const prompt = action.payload.resolvedRecipe.prompt;
  await h.restart();
  assert.equal(h.manager.getExecutionSnapshot().state.effects.find(e => e.effectId === action.effectId).payload.resolvedRecipe.prompt, prompt);
  h.runtime.detachSimulator();
});

test('manual POI orientation runs before takeoff without a provider and publishes the original fallback to both clients', async t => {
  const { createTrackerMissionBoardingVoice } = require('./tracker-mission-boarding-voice');
  const h = await harness(t, { voice: request => createTrackerMissionBoardingVoice({ authorityManager: h.manager }).dispatch(request) });
  await h.intent('poi_orientation');
  for (let i = 0; i < 80 && !h.manager.getPublicSnapshot().execution.voice.poi?.text; i++) await new Promise(resolve => setTimeout(resolve, 10));
  const control = h.manager.getPublicSnapshot().execution;
  assert.match(control.voice.poi.text, /Steuerkurs .*Entfernung/);
  assert.equal(control.voice.poi.label, 'Orientierung');
  assert.equal(control.phase, 'planned');
  const run = h.manager.getActiveRun({ includeBundle: true });
  assert.deepEqual(projectTrackerEfbMissionView(run, null, null, control), projectTrackerEfbMissionView(JSON.parse(JSON.stringify(run)), null, null, JSON.parse(JSON.stringify(control))));
});

test('full runtime receives high-rate local motion while mission telemetry stays at 500 ms', async t => {
  const h = await harness(t); await h.start();
  let maxSamples = 0, detected = false;
  for (let at = 100000; at <= 110000; at += 100) {
    const wave = Math.sin((at - 100000) / 180);
    const sample = { observedAt: at, gForce: 1 + wave * .25, bankDeg: wave * 8, vsFpm: wave * 500, pitchDeg: wave * 3 };
    h.runtime.observeMotionTelemetry(sample);
    if (at % 500 === 0) {
      h.sample(at, { ...sample, turbulencePct: 90 });
      const analysis = h.manager.getExecutionRuntimeContext()?.flightVoiceState?.motionAnalysis;
      maxSamples = Math.max(maxSamples, analysis?.samples || 0); detected ||= analysis?.detected === true;
      await tick();
    }
  }
  h.runtime.flush();
  assert.ok(maxSamples >= 12); assert.equal(detected, true);
  h.runtime.detachSimulator();
});

test('Web and EFB cockpit sessions reach manual POI intents with revision, duplicate and abort guards', async t => {
  const { createTrackerCockpitControl } = require('./tracker-cockpit-control-core');
  const h = await harness(t, { voice: request => request.effect.type === 'voice.poi' ? { ok: true, status: 'pending' } : completed() });
  const cockpit = createTrackerCockpitControl({ getMissionRun: () => h.manager.getActiveRun(),
    executionAuthority: 'tracker', executeIntent: request => h.runtime.executeIntent(request) });
  const efb = cockpit.register({ clientId: 'efb', role: 'efb' });
  const web = cockpit.register({ clientId: 'web', role: 'web' });
  const run = h.manager.getActiveRun();
  const req = { sessionId: efb.session.sessionId, sessionToken: efb.sessionToken, commandId: 'poi-session-1',
    missionId: run.missionId, runId: run.runId, expectedRevision: run.revision, intent: 'poi_orientation' };
  assert.equal((await cockpit.submitIntent(req)).ok, true);
  assert.equal((await cockpit.submitIntent(req)).duplicate, true);
  assert.equal(h.manager.getExecutionSnapshot().state.effects.filter(e => e.payload.action === 'poi_orientation').length, 1);
  const stale = await cockpit.submitIntent({ ...req, sessionId: web.session.sessionId, sessionToken: web.sessionToken, commandId: 'other', intent: 'poi_status' });
  assert.equal(stale.error, 'mission_revision_conflict');
  await h.intent('abort_mission');
  assert.equal((await cockpit.submitIntent({ ...req, commandId: 'late' })).error, 'no_active_run');
});

test('App manual POI buttons route through Tracker authority and retain original standalone dispatch', () => {
  const source = fs.readFileSync(path.join(__dirname, '../passenger-voice.js'), 'utf8');
  const start = source.indexOf('window.paxMissionStatusReport = function()');
  const end = source.indexOf("window.addEventListener('missioncontrolchange'", start);
  let owned = true, status = 0, orientation = 0; const sent = [];
  const sandbox = { window: { gaTrackerExecutionHandlesMission: () => owned, gaTrackerExecutionSubmitIntent: intent => sent.push(intent) },
    _poiMissionStatusAction: () => status++, _poiMissionOrientationAction: () => orientation++ };
  vm.createContext(sandbox); vm.runInContext(source.slice(start, end), sandbox);
  sandbox.window.paxMissionStatusReport(); sandbox.window.paxMissionOrientationHelp();
  assert.deepEqual(sent, ['poi_status', 'poi_orientation']); assert.equal(status + orientation, 0);
  owned = false; sandbox.window.paxMissionStatusReport(); sandbox.window.paxMissionOrientationHelp();
  assert.equal(status, 1); assert.equal(orientation, 1);
});

test('full POI runtime checkpoints steady enroute telemetry without rewriting equal lifecycle flags', async t => {
  const f = await harness(t); await f.start();
  const baseline = f.manager.getExecutionSnapshot().executionRevision;
  for (let i = 0; i < 120; i++) { f.sample(1789538100000 + i * 500); await tick(); }
  const state = f.manager.getExecutionSnapshot().state;
  const events = f.manager.getActiveRun({ includeBundle: true }).resumeBundle.executionReplay.events;
  assert.equal(events.filter(e => e.type === 'POI_TASK_OBSERVED').length, 12);
  assert.equal(events.filter(e => e.type === 'POI_LIFECYCLE_OBSERVED').length, 2);
  assert.ok(state.revision - baseline <= 16, 'no per-sample lifecycle journal writes');
  assert.equal(execution.replay(f.manager.getActiveRun({ includeBundle: true }).resumeBundle.executionReplay).stateHash,
    f.manager.getExecutionSnapshot().executionStateHash);
});


for (const domain of ['sightseeing_tour', 'poi_learning_guide']) for (const withKnowledge of [true, false]) test(`${domain} completes and restores with optional knowledge=${withKnowledge}`, async t => {
  const b = bundle();
  b.executionPoiRecipe.taskDomain = domain;
  const context = b.executionPoiRecipe.voiceContext;
  context.taskDomain = domain;
  context.knowledgeContext = { status: 'accept', title: 'Brücke', facts: [
    { topic: 'history', text: 'Die Brücke wurde im neunzehnten Jahrhundert als regionales Bauwerk errichtet.' },
    { topic: 'structure', text: 'An der Brücke sind mehrere markante Turmbauten aus der Umgebung deutlich erkennbar.' }
  ] };
  if (!withKnowledge) {
    delete context.knowledgeContext;
    b.missionState.currentMissionData.largeContext = 'Geo-Daten ä '.repeat(50000);
  }
  replay(b);
  assert.equal(poi.validateBundle(b), null);
  const invalid = JSON.parse(JSON.stringify(b));
  delete invalid.executionPoiRecipe.voiceContext.knowledgeContext;
  assert.equal(poi.validateBundle(invalid), null);
  const h = await harness(t, { bundle: b });
  await h.start(); h.sample(10000); h.sample(12000);
  await h.restart();
  assert.deepEqual(h.manager.requestSnapshot({ missionId: b.missionId }).resumeBundle.executionPoiRecipe.voiceContext.knowledgeContext, context.knowledgeContext);
  h.sample(14000, { lat: 48.3, lon: 8.5 });
  assert.equal(h.manager.getExecutionSnapshot().state.progress.targetSatisfied, true);
  h.sample(16000, { lat: 49, lon: 9, onGround: true, aglFt: 0, gsKts: 20 });
  h.sample(17000, { lat: 49, lon: 9, onGround: true, aglFt: 0, gsKts: 0 });
  await h.intent('set_manifest_item', { itemId: 'camera', action: 'unload' });
  await h.intent('sign_manifest'); await h.intent('confirm_unload');
  for (let i = 0; i < 100 && h.manager.getActiveRun(); i++) await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(h.manager.getActiveRun(), null);
  assert.equal(h.farewell.length, 1);
  assert.equal(h.farewell[0].farewellDynamicContext.missionFailed, false);
});

for (const workerScheduling of [false, true]) test(`Learning guide reserves original manual facts across restart; worker=${workerScheduling}`, async t => {
  const b = bundle();
  b.executionPoiRecipe.taskDomain = b.executionPoiRecipe.voiceContext.taskDomain = 'poi_learning_guide';
  b.executionPoiRecipe.voiceContext.knowledgeContext = { status: 'accept', title: 'Brücke', facts: [
    { text: 'Die alte Brücke besteht aus mehreren historischen steinernen Rundbögen über dem Fluss.' },
    { text: 'Eine Eisenbahnstrecke verbindet die benachbarten Ortschaften seit dem neunzehnten Jahrhundert.' }
  ], extraFacts: [{ text: 'Am östlichen Ufer befindet sich ein ausgedehntes Schutzgebiet für seltene Wasservögel.' }] };
  const h = await harness(t, { bundle: replay(b), workerScheduling });
  assert.equal(h.manager.getPublicSnapshot().execution.allowedActions.includes('poi_tell_more'), false);
  await h.start(); h.sample(10000);
  assert.equal(h.manager.getPublicSnapshot().execution.allowedActions.includes('poi_tell_more'), true);
  await h.intent('poi_tell_more');
  assert.deepEqual(h.manager.getExecutionSnapshot().state.voice.poiMemory.knowledgeManual, ['core:0']);
  const first = h.manager.getExecutionSnapshot().state.effects.find(e => e.payload.action === 'poi_tell_more');
  assert.match(first.payload.resolvedRecipe.fallbackText, /Klar. Noch ein Punkt: Die alte Brücke/);
  assert.equal(first.payload.resolvedRecipe.prompt, ''); // original direct speech, no invented AI facts
  await h.restart(); h.sample(12000);
  await h.intent('poi_tell_more');
  assert.deepEqual(h.manager.getExecutionSnapshot().state.voice.poiMemory.knowledgeManual, ['core:0', 'core:1']);
  await h.intent('poi_tell_more');
  assert.deepEqual(h.manager.getExecutionSnapshot().state.voice.poiMemory.knowledgeManual, ['core:0', 'core:1', 'extra:0']);
  await h.intent('poi_tell_more');
  const last = h.manager.getExecutionSnapshot().state.effects.filter(e => e.payload.action === 'poi_tell_more').at(-1);
  assert.match(last.payload.resolvedRecipe.fallbackText, /Mehr weiß ich dazu leider auch nicht/);
});

test('Learning guide without accepted knowledge runs but exposes no tell-more action', async t => {
  const b = bundle(); b.executionPoiRecipe.taskDomain = b.executionPoiRecipe.voiceContext.taskDomain = 'poi_learning_guide';
  const h = await harness(t, { bundle: replay(b) }); await h.start(); h.sample(10000);
  assert.equal(h.manager.getPublicSnapshot().execution.allowedActions.includes('poi_tell_more'), false);
  assert.equal((await h.rawIntent('poi_tell_more')).ok, false);
});

test('App learning menu follows authority updates without using local fact counters', () => {
  const source = fs.readFileSync(path.join(__dirname, '../passenger-voice.js'), 'utf8');
  const menu = { style: {} }, button = {};
  let update;
  const sandbox = { document: { getElementById: id => id === 'paxKnowledgeGuideMenu' ? menu : button },
    _refreshMissionActionMenu: () => {},
    window: { gaTrackerExecutionHandlesMission: () => true, gaTrackerExecutionControl: { allowedActions: [] },
      addEventListener: (_, fn) => { update = fn; } } };
  vm.createContext(sandbox);
  vm.runInContext(source.slice(source.indexOf('function _refreshPoiKnowledgeGuideMenu()'), source.indexOf('function _activeBushMissionSpec()')), sandbox);
  vm.runInContext(source.match(/window\.addEventListener\('missioncontrolchange'.*\n/)[0], sandbox);
  update(); assert.equal(menu.style.display, 'none'); assert.equal(button.disabled, true);
  sandbox.window.gaTrackerExecutionControl.allowedActions = ['poi_tell_more'];
  update(); assert.equal(menu.style.display, 'grid'); assert.equal(button.disabled, false);
  sandbox.window.gaMissionControlIntentPending = true;
  update(); assert.equal(button.disabled, true);
});

function mappingBundle(type = 'north_south_scan') {
  const b = bundle();
  const spec = require('../mission-survey-core.js').normalizeSpec({ taskDomain: 'mapping_survey', type,
    center: b.executionPoiRecipe.target, targetAltFt: 3000,
    scan: { lineCount: 2, lineLengthNm: .4, bins: 16 }, orbit: { requiredTurns: 1, minTurnSec: 45 } });
  b.adapter = b.descriptor.primaryAdapter = 'survey_pattern';
  b.missionState.currentMissionData.surveyPattern = spec;
  b.executionPoiRecipe.taskDomain = 'mapping_survey';
  b.executionPoiRecipe.surveyPattern = spec;
  Object.assign(b.executionPoiRecipe.voiceContext, { taskDomain: 'mapping_survey', surveySpec: spec });
  return replay(b);
}

for (const type of ['north_south_scan', 'orbit']) test(`Mapping ${type}: cloud gate, original task, status, EFB progress and normal return`, async t => {
  const b = mappingBundle(type), spec = b.executionPoiRecipe.surveyPattern;
  const cloud = buildCloudMissionCandidate({ activeMission: b.missionState,
    activeMissionTrackerSeed: { schema: 'ga.tracker-cloud-mission-seed.v1', version: 1, missionId: b.missionId,
      adapter: b.adapter, executionPoiRecipe: b.executionPoiRecipe, executionEffectPlan: b.executionEffectPlan } }, { poiExecutionEnabled: true });
  assert.equal(cloud.status, 'ready', JSON.stringify(cloud));
  assert.equal(cloud.candidate.bundle.executionReplay.recipe, 'poi');
  const h = await harness(t, { bundle: b }); await h.start();
  const core = require('../mission-survey-core.js');
  let at = 10000;
  h.sample(at, { lat: 48.1, lon: 8.1 }); at += 1000;
  if (type === 'orbit') {
    for (let degree = 0; degree <= 360; degree += 5) {
      const point = core.destinationPoint(spec.center.lat, spec.center.lon, spec.orbit.radiusNm, degree);
      h.sample(at, { ...point, hdg: (degree + 90) % 360 }); at += 1000;
    }
  } else {
    for (const line of spec.scan.lines) {
      for (let i = 0; i <= 24; i++) {
        h.sample(at, { ...core.interpolateLine(line, i / 24), hdg: 180 }); at += 1000;
        if (line.id === spec.scan.lines[0].id && i === 8) {
          const partial = h.manager.getPublicSnapshot().execution.poiTask.surveyPattern;
          await h.intent('poi_status');
          const afterVoiceRevision = h.manager.getPublicSnapshot().execution.poiTask.surveyPattern;
          assert.equal(afterVoiceRevision.scan.activeLineId, partial.scan.activeLineId);
          assert.ok(afterVoiceRevision.scan.activeCoverage >= partial.scan.activeCoverage);
          const spoken = h.manager.getExecutionSnapshot().state.effects.findLast(e => e.payload.action === 'poi_status');
          assert.match(spoken.payload.resolvedRecipe.fallbackText, /aktiv bei \d+%/);
        }
      }
      await h.restart();
    }
  }
  assert.equal(h.manager.getExecutionSnapshot().state.poiTask.detector.satisfied, true);
  assert.equal(h.manager.getExecutionSnapshot().state.phase, 'return_leg');
  await h.intent('poi_status');
  const status = h.manager.getExecutionSnapshot().state.effects.findLast(e => e.payload.action === 'poi_status');
  assert.match(status.payload.resolvedRecipe.fallbackText, /Survey.*abgeschlossen/);
  const control = h.manager.getPublicSnapshot().execution;
  const view = projectTrackerEfbMissionView(h.manager.getActiveRun({ includeBundle: true }), null, null, control);
  // The authority control is the single progress source for all viewers.
  assert.equal(control.poiTask.surveyPattern.satisfied, true);
  assert.equal(view.view.progress[0].label, type === 'orbit' ? 'Survey-Kreise' : 'Survey-Linien');
  assert.equal(view.view.progress[0].percent, 100);
  assert.match(view.view.progress[0].detail, type === 'orbit' ? /1\/1 abgeschlossen/ : /2\/2 abgeschlossen/);
  h.sample(at + 2000, { lat: 48, lon: 8, onGround: true, gsKts: 0, aglFt: 0 });
  h.sample(at + 3000, { lat: 48, lon: 8, onGround: true, gsKts: 0, aglFt: 0 });
  await h.intent('set_manifest_item', { itemId: 'camera', action: 'unload' });
  await h.intent('sign_manifest'); await h.intent('confirm_unload');
  for (let i = 0; i < 100 && h.manager.getActiveRun(); i++) await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(h.manager.getActiveRun(), null);
  assert.equal(h.farewell[0].farewellDynamicContext.missionFailed, false);
});

test('Mapping pause/restart drops an unfinished scan segment without inventing its remaining coverage', async t => {
  const b = mappingBundle(), spec = b.executionPoiRecipe.surveyPattern;
  const h = await harness(t, { bundle: b }); await h.start();
  const core = require('../mission-survey-core.js');
  const line = spec.scan.lines[0]; let at = 10000;
  for (let i = 0; i <= 8; i++) { h.sample(at, { ...core.interpolateLine(line, i / 24), hdg: 180 }); at += 1000; }
  assert.ok(h.manager.getPublicSnapshot().execution.poiTask.surveyPattern.scan.activeCoverage > 0);
  h.sample(at, { simPaused: true }); at += 1000;
  await h.restart();
  for (let i = 9; i <= 24; i++) { h.sample(at, { ...core.interpolateLine(line, i / 24), hdg: 180 }); at += 1000; }
  const survey = h.manager.getPublicSnapshot().execution.poiTask.surveyPattern;
  assert.equal(survey.scan.completedCount, 0);
  assert.equal(survey.satisfied, false);
});

test('Mapping required cargo damage aborts the original task before Survey success', async t => {
  const b = mappingBundle(), spec = b.executionPoiRecipe.surveyPattern;
  const h = await harness(t, { bundle: b }); await h.start();
  const core = require('../mission-survey-core.js');
  h.sample(10000, { ...core.interpolateLine(spec.scan.lines[0], 0), hdg: 180, gForce: 4, bankDeg: 80, vsFpm: -2000 });
  const execution = h.manager.getPublicSnapshot().execution;
  assert.equal(execution.poiTask.aborted, true);
  assert.equal(execution.poiTask.surveyPattern.satisfied, false);
  assert.equal(execution.progress.taskAborted, true);
});

for (const missing of ['altFt', 'lat', 'gsKts']) test(`Mapping missing ${missing} interrupts geometric coverage through the full runtime`, async t => {
  const b = mappingBundle(), spec = b.executionPoiRecipe.surveyPattern;
  const h = await harness(t, { bundle: b }); await h.start();
  const core = require('../mission-survey-core.js'), line = spec.scan.lines[0];
  for (let i = 0; i <= 8; i++) h.sample(10000 + i * 1000, { ...core.interpolateLine(line, i / 24), hdg: 180 });
  assert.ok(h.manager.getPublicSnapshot().execution.poiTask.surveyPattern.scan.activeCoverage > 0);
  h.sample(19000, { ...core.interpolateLine(line, 9 / 24), [missing]: null });
  assert.equal(h.manager.getPublicSnapshot().execution.poiTask.surveyPattern.scan.activeLineId, '');
  for (let i = 10; i <= 24; i++) h.sample(10000 + i * 1000, { ...core.interpolateLine(line, i / 24), hdg: 180 });
  assert.equal(h.manager.getPublicSnapshot().execution.poiTask.surveyPattern.scan.completedCount, 0);
});
