'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const execution = require('../mission-execution-core.js');
const boarding = require('../mission-boarding-voice-core.js');
const farewell = require('../mission-farewell-voice-core.js');
const { createMissionAuthorityManager } = require('./mission-authority-core.js');
const { createTrackerMissionExecutionRuntime } = require('./tracker-mission-execution-runtime.js');
const { createTrackerMissionBoardingVoice } = require('./tracker-mission-boarding-voice.js');
const { createTrackerMissionFarewellVoice } = require('./tracker-mission-farewell-voice.js');
const { createTrackerMissionComplianceVoice } = require('./tracker-mission-compliance-voice.js');
const { createTrackerVoiceService } = require('./tracker-voice-service.js');
const { createMissionVoiceScopeGuard } = require('./tracker-mission-voice-scope.js');
const complete = () => ({ ok: true, status: 'completed' });
const tick = () => new Promise(resolve => setImmediate(resolve));
const response = async url => url.includes('chat/completions')
  ? { ok: true, json: async () => ({ choices: [{ message: { content: 'Gespräch zum Reiseziel.' } }] }) }
  : { ok: true, arrayBuffer: async () => Buffer.from('test-audio') };

async function harness(t, runtimeOptions = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ga-voice-lifetime-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const missionId = 'voice-lifetime';
  const bundle = { version: 2, missionId, adapter: 'apt', descriptor: { primaryAdapter: 'apt' },
    missionState: { currentMissionData: { missionId, missionType: 'apt', start: 'EDTW', dest: 'EDTL', aptArrivalPlan: { lat: 48.3, lon: 8.5 } } },
    runtime: { missionId, startPhase: 'planned', lastLiveFlightData: { onGround: true, gsKts: 0, simPaused: false, inMenuOrMap: false }, runtime: { missionId, phase: 'planned', active: false },
      cargoManifest: { version: 6, key: 'voice-lifetime', dispatchSignature: { scope: 'departure' }, items: [] } },
    executionEffectPlan: { schema: 'ga.mission-apt-effect-plan.v1', recipe: 'apt', missionId, effects: {
      'scene.prepare': { command: { type: 'mission_scene_spawn', sceneId: 'scene-voice', items: [{ kind: 'person_boarder_1', objectTitle: 'Tarmac_Male' }] } },
      'scene.deboarding': { command: { type: 'mission_scene_deboarding', sceneId: 'scene-voice', path: [{ forwardM: 4.5, rightM: 8.5 }, { forwardM: 16, rightM: -8 }] } },
      'scene.boarding': { command: { type: 'mission_scene_boarding', sceneId: 'scene-voice', path: [{ forwardM: 16, rightM: -8 }, { forwardM: 4.5, rightM: 8.5 }] } },
      'voice.boarding': { recipe: boarding.createRecipe({ missionId, hasPassenger: true, prompt: 'Begrüße den Piloten.', audioEnabled: true, playCue: false }) },
      'voice.approach': { context: { supported: true, mode: 'passenger', missionId, enabled: true, audioEnabled: true, speaker: { name: 'Mara' } } },
      'voice.farewell': { recipe: farewell.createRecipe({ missionId, text: 'Danke für den Flug.', audioEnabled: true, playCue: false }) }
    } } };
  bundle.executionReplay = execution.createExecutionBundle(bundle);
  bundle.execution = execution.createReplayShadowEnvelope(bundle.executionReplay, { sourceRevision: 1, legacyBundle: bundle });
  const managerOptions = { storageFile: path.join(directory, 'authority.json'), executionAuthorityEnabled: true, idFactory: () => 'voice-run' };
  const manager = createMissionAuthorityManager(managerOptions);
  const acquired = manager.acquire({ missionId, clientId: 'app', stateHash: 'web', resumeBundle: bundle });
  const prepared = manager.prepareExecutionAuthority({ missionId, runId: acquired.activeRun.runId, clientId: 'app',
    expectedRevision: acquired.activeRun.revision, expectedStateHash: acquired.activeRun.stateHash,
    expectedExecutionStateHash: execution.replay(bundle.executionReplay).stateHash });
  assert.equal(prepared.ok, true);
  assert.equal(manager.commitExecutionAuthority({ missionId, runId: acquired.activeRun.runId, clientId: 'app',
    expectedRevision: prepared.activeRun.revision, expectedExecutionStateHash: prepared.activeRun.executionStateHash,
    handoffId: prepared.handoff.handoffId }).ok, true);
  const runtime = createTrackerMissionExecutionRuntime({ authorityManager: manager, enabled: true, playBoardingVoice: complete, ...runtimeOptions });
  runtime.attachSimulator({ getLivePosition: () => ({ lat: 48.1, lon: 8.2 }), dispatchCommand: complete,
    syncPayloadBeforeStart: complete, syncPayloadManifestState: complete, cleanupMission: complete });
  let sequence = 0;
  async function intent(action) {
    const run = manager.getActiveRun();
    const result = await runtime.executeIntent({ missionId, runId: run.runId, expectedRevision: run.revision,
      commandId: 'control-' + ++sequence, intent: action });
    assert.equal(result.ok, true, JSON.stringify(result));
    for (let i = 0; i < 8; i++) await tick();
    return result;
  }
  async function start() {
    for (const action of ['prepare_mission', 'start_boarding', 'sign_manifest', 'confirm_load', 'start_mission'])
      if (manager.getExecutionSnapshot().view.allowedActions.includes(action)) await intent(action);
    assert.equal(manager.getExecutionSnapshot().state.flags.active, true);
  }
  const serviceOptions = { provider: 'openai', apiKey: 'test', audioCueDirectory: false,
    storageFile: path.join(directory, 'voice.json'), fetchRemote: response,
    isMissionPlaybackAllowed: createMissionVoiceScopeGuard(manager) };
  const request = type => ({ missionId, runId: manager.getActiveRun().runId, commandId: 'speech-' + type,
    effect: { effectId: 'speech-' + type, type, payload: { kind: 'route_story', prompt: 'Erzähle zum Ziel.', text: 'Kontrolle der Unterlagen.' } } });
  return { manager, managerOptions, runtime, intent, start, serviceOptions, request };
}

for (const type of ['voice.flight', 'voice.boarding', 'voice.farewell', 'voice.compliance_request', 'voice.compliance_result'])
  test(`${type} provider response after actual abort cannot offer or claim stale audio`, async t => {
    const h = await harness(t); await h.start();
    let release, started;
    const blocked = new Promise(resolve => { release = resolve; });
    const providerStarted = new Promise(resolve => { started = resolve; });
    const service = createTrackerVoiceService({ ...h.serviceOptions, fetchRemote: async url => {
      if (!url.includes('chat/completions')) { started(); await blocked; }
      return response(url);
    } });
    const options = { authorityManager: h.manager, voiceService: service, getAudioPlaybackCandidates: () => 1 };
    const handler = type === 'voice.farewell' ? createTrackerMissionFarewellVoice(options)
      : type.startsWith('voice.compliance') ? createTrackerMissionComplianceVoice(options) : createTrackerMissionBoardingVoice(options);
    const waiting = handler.dispatch(h.request(type));
    await providerStarted;
    await h.intent('abort_mission'); release();
    const result = await waiting;
    assert.equal(result.voiceStatus, 'mission_end');
    assert.equal(h.manager.getActiveRun(), null);
    assert.equal(service.getNextPlayback('audio-device'), null);
    assert.equal(service.publicState().playbackAvailable, false);
    await service.flushPersistence();
  });

test('boarding before takeoff and Farewell in closing remain playable', async t => {
  let farewellHandler;
  const h = await harness(t, { playFarewellVoice: request => farewellHandler.dispatch(request) });
  const service = createTrackerVoiceService(h.serviceOptions);
  const options = { authorityManager: h.manager, voiceService: service, getAudioPlaybackCandidates: () => 0 };
  assert.equal(h.manager.getExecutionSnapshot().state.flags.active, false);
  await createTrackerMissionBoardingVoice(options).dispatch(h.request('voice.boarding'));
  assert.equal(service.getNextPlayback('device').kind, 'boarding');
  const first = service.getNextPlayback('device');
  assert.equal(service.claimPlayback({ effectId: first.effectId, clientId: 'device' }).claimed, true);
  service.releasePlayback({ effectId: first.effectId, clientId: 'device', completed: true });
  await h.start();
  farewellHandler = createTrackerMissionFarewellVoice({ ...options, getAudioPlaybackCandidates: () => 1 });
  h.runtime.observeTelemetry({ observedAt: 10000, lat: 48.1, lon: 8.2, onGround: false, gsKts: 60 });
  h.runtime.observeTelemetry({ observedAt: 12000, lat: 48.1, lon: 8.2, onGround: false, gsKts: 65 });
  h.runtime.observeTelemetry({ observedAt: 13000, lat: 48.3, lon: 8.5, onGround: true, gsKts: 20 });
  h.runtime.observeTelemetry({ observedAt: 14000, lat: 48.3, lon: 8.5, onGround: true, gsKts: 0 });
  h.runtime.observeTelemetry({ observedAt: 17000, lat: 48.3, lon: 8.5, onGround: true, gsKts: 0 });
  await h.intent('request_close');
  for (let i = 0; i < 40 && !service.getNextPlayback('device'); i++) await tick();
  assert.equal(h.manager.getExecutionSnapshot().state.flags.farewellStarted, true);
  const last = service.getNextPlayback('device');
  assert.equal(last.kind, 'farewell');
  assert.equal(service.claimPlayback({ effectId: last.effectId, clientId: 'device' }).claimed, true);
  service.releasePlayback({ effectId: last.effectId, clientId: 'device', completed: true });
  for (let i = 0; i < 40 && h.manager.getActiveRun(); i++) await tick();
  assert.equal(h.manager.getActiveRun(), null, 'closing finalizes after the actual Farewell playback');
  await service.flushPersistence();
});

test('valid cache restart retains audio, playback position, deduplication and blocks a later aborted run', async t => {
  const h = await harness(t); await h.start();
  const service = createTrackerVoiceService(h.serviceOptions);
  await createTrackerMissionBoardingVoice({ authorityManager: h.manager, voiceService: service, getAudioPlaybackCandidates: () => 0 }).dispatch(h.request('voice.flight'));
  const job = service.getNextPlayback('device'); assert.ok(job);
  service.claimPlayback({ effectId: job.effectId, clientId: 'device' });
  service.renewPlayback({ effectId: job.effectId, clientId: 'device', position: { stage: 'tts', offset: 12 } });
  await service.flushPersistence();
  const restoredManager = createMissionAuthorityManager(h.managerOptions);
  let providerCalls = 0;
  const restoredOptions = { ...h.serviceOptions, isMissionPlaybackAllowed: createMissionVoiceScopeGuard(restoredManager),
    fetchRemote: async url => { providerCalls++; return response(url); } };
  const restored = createTrackerVoiceService(restoredOptions);
  assert.equal(restored.getNextPlayback('new-device').effectId, job.effectId);
  assert.equal(restored.getNextPlayback('new-device').playback.position.offset, 12);
  assert.equal(restored.claimPlayback({ effectId: job.effectId, clientId: 'new-device' }).claimed, true);
  restored.releasePlayback({ effectId: job.effectId, clientId: 'new-device', completed: true });
  await restored.flushPersistence();
  const completed = createTrackerVoiceService(restoredOptions);
  assert.equal(completed.getNextPlayback('new-device'), null);
  assert.equal(providerCalls, 0, 'restore reuses the existing audio');
  // Restore a still-unplayed copy, then remove its owner before first polling.
  const run = restoredManager.getActiveRun();
  assert.equal(restoredManager.abortExecutionRun({ missionId: run.missionId, runId: run.runId, expectedRevision: run.revision }).ok, true);
  // Original service index had an uncompleted clip, recreated for this negative case.
  await service.flushPersistence();
  const persisted = JSON.parse(fs.readFileSync(h.serviceOptions.storageFile, 'utf8'));
  persisted.records[0].playback.status = 'available';
  fs.writeFileSync(h.serviceOptions.storageFile, JSON.stringify(persisted));
  const stale = createTrackerVoiceService(restoredOptions);
  assert.equal(stale.getNextPlayback('new-device'), null);
  assert.equal(stale.getAudio(job.effectId), null);
  await stale.flushPersistence();
});

test('legacy unscoped cache waits for an exact dispatcher rebind without regenerating audio', async t => {
  const h = await harness(t); await h.start();
  let providerCalls = 0;
  const options = { ...h.serviceOptions, isMissionPlaybackAllowed: undefined,
    fetchRemote: async url => { providerCalls++; return response(url); } };
  const request = { effectId: 'legacy-job', text: 'Bereits erzeugter Text.', kind: 'route_story' };
  const legacy = createTrackerVoiceService(options); legacy.request(request); await legacy.wait(request.effectId); await legacy.flushPersistence();
  const oldIndex = JSON.parse(fs.readFileSync(options.storageFile, 'utf8'));
  delete oldIndex.records[0].missionScope;
  fs.writeFileSync(options.storageFile, JSON.stringify(oldIndex));
  let restored = createTrackerVoiceService({ ...options, isMissionPlaybackAllowed: h.serviceOptions.isMissionPlaybackAllowed });
  assert.equal(restored.getNextPlayback('device'), null);
  assert.equal(restored.getAudio(request.effectId), null);
  restored.request({ effectId: 'independent-text', text: 'Separater Text.', synthesizeAudio: false });
  await restored.wait('independent-text');
  await restored.flushPersistence();
  restored = createTrackerVoiceService({ ...options, isMissionPlaybackAllowed: h.serviceOptions.isMissionPlaybackAllowed });
  assert.equal(restored.getAudio(request.effectId), null, 'rewriting the cache cannot turn unknown legacy ownership into independent audio');
  assert.equal(restored.claimPlayback({ effectId: request.effectId, clientId: 'device' }).claimed, false);
  const scope = { missionId: 'voice-lifetime', runId: 'voice-run', policy: 'flight' };
  restored.request({ ...request, missionScope: scope, isPlaybackAllowed: () => h.serviceOptions.isMissionPlaybackAllowed(scope) });
  assert.equal(restored.getNextPlayback('device').effectId, request.effectId);
  assert.equal(providerCalls, 1, 'the scoped rebind must preserve the fingerprint');
  assert.throws(() => restored.request({ ...request, missionScope: { ...scope, runId: 'other-run' }, isPlaybackAllowed: () => false }), { code: 'effect_id_conflict' });
  assert.equal(restored.getNextPlayback('device').effectId, request.effectId, 'a rejected foreign scope cannot replace the valid guard');
  assert.throws(() => restored.request({ ...request, text: 'Anderer Inhalt.', missionScope: scope, isPlaybackAllowed: () => false }), { code: 'effect_id_conflict' });
  assert.equal(restored.getNextPlayback('device').effectId, request.effectId, 'a rejected content fingerprint cannot replace the valid guard');
  await restored.flushPersistence();
});

test('navigational warnings and explicit non-mission audio survive mission abort', async t => {
  const h = await harness(t); await h.start();
  const service = createTrackerVoiceService(h.serviceOptions);
  service.request({ effectId: 'independent-demo', kind: 'direct', text: 'Audio-Vorschau.' });
  await service.wait('independent-demo');
  service.enqueueWarning({ effectId: 'navigation-warning', kind: 'terrain', clips: ['taws-whoop'], text: 'Terrain.' });
  await h.intent('abort_mission');
  await service.flushPersistence();
  const restored = createTrackerVoiceService(h.serviceOptions);
  assert.equal(restored.getNextPlayback('restored-device').effectId, 'independent-demo', 'explicit independent scope survives cache recovery');
  const audio = service.getNextPlayback('device'); assert.equal(audio.effectId, 'independent-demo');
  service.claimPlayback({ effectId: audio.effectId, clientId: 'device' });
  service.releasePlayback({ effectId: audio.effectId, clientId: 'device', completed: true });
  const warning = service.getNextPlayback('device'); assert.equal(warning.effectId, 'navigation-warning');
  assert.equal(service.claimPlayback({ effectId: warning.effectId, clientId: 'device' }).claimed, true);
  await service.flushPersistence();
});


test('abort revokes a claimed mission clip on renewal, including after a run replacement', async t => {
  const h = await harness(t); await h.start();
  const service = createTrackerVoiceService(h.serviceOptions);
  await createTrackerMissionBoardingVoice({ authorityManager: h.manager, voiceService: service, getAudioPlaybackCandidates: () => 0 }).dispatch(h.request('voice.flight'));
  const job = service.getNextPlayback('device');
  assert.equal(service.claimPlayback({ effectId: job.effectId, clientId: 'device' }).claimed, true);
  assert.ok(service.getAudio(job.effectId));
  await h.intent('abort_mission');
  const replacement = h.manager.acquire({ missionId: 'other-mission', clientId: 'other-app', stateHash: 'other' });
  assert.equal(replacement.ok, true);
  assert.equal(service.renewPlayback({ effectId: job.effectId, clientId: 'device' }).continued, false);
  assert.equal(service.getAudio(job.effectId), null);
  assert.equal(service.getNextPlayback('device'), null);
  await service.flushPersistence();
});
