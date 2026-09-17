'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const { createTrackerMissionExecutionRuntime } = require('./tracker-mission-execution-runtime.js');
const poi = require('./tracker-mission-poi-runtime.js');
const task = require('../mission-poi-task-core.js');
const execution = require('../mission-execution-core.js');
const { createMissionAuthorityManager } = require('./mission-authority-core.js');
const { createTrackerMissionExecutionAdapter } = require('./tracker-mission-execution-adapter.js');

function recipe(overrides = {}) {
  return { schema: poi.RECIPE_SCHEMA, version: 1, missionId: 'poi-test',
    taskDomain: 'media_photo', target: { lat: 0, lon: 0 }, home: { lat: 1, lon: 1 },
    strict: true, trackingActive: true,
    passenger: { targetRadiusNm: 1.5, targetAltFt: 3000, targetDwellMin: 2 }, ...overrides };
}
const sample = (observedAt, overrides = {}) => ({ observedAt, lat: 0, lon: .01, altFt: 3000,
  gsKts: 95, hdg: 270, onGround: false, ...overrides });
const facts = { active: true, trackingActive: true };

function fixture(t, options = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ga-poi-runtime-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const managerOptions = { storageFile: path.join(directory, 'authority.json'),
    idFactory: () => 'poi-run', executionAuthorityEnabled: true, poiExecutionEnabled: true, ...options };
  let manager = createMissionAuthorityManager(managerOptions);
  const bundle = { version: 2, missionId: 'poi-test', adapter: 'poi',
    descriptor: { primaryAdapter: 'poi' }, executionPoiRecipe: options.recipe || recipe(),
    missionState: { currentMissionData: { missionId: 'poi-test', missionType: 'poi', poiName: 'Testziel', ...options.mission } },
    runtime: { missionId: 'poi-test', startPhase: 'planned',
      lastLiveFlightData: { onGround: true, gsKts: 0 },
      runtime: { missionId: 'poi-test', phase: 'planned', active: false },
      cargoManifest: { version: 6, key: 'poi-empty', dispatchSignature: { scope: 'departure' }, items: [] } } };
  bundle.executionReplay = execution.createExecutionBundle(bundle);
  bundle.execution = execution.createReplayShadowEnvelope(bundle.executionReplay, { sourceRevision: 1, legacyBundle: bundle });
  const acquired = manager.acquire({ missionId: bundle.missionId, clientId: 'web-owner',
    stateHash: 'web-poi-initial', resumeBundle: bundle });
  const prepared = manager.prepareExecutionAuthority({ missionId: bundle.missionId, runId: acquired.activeRun.runId,
    clientId: 'web-owner', expectedRevision: acquired.activeRun.revision,
    expectedStateHash: acquired.activeRun.stateHash, expectedExecutionStateHash: execution.replay(bundle.executionReplay).stateHash });
  if (options.poiExecutionEnabled === false || options.expectRejected) return { manager, prepared };
  assert.equal(prepared.ok, true, JSON.stringify(prepared));
  const committed = manager.commitExecutionAuthority({ missionId: bundle.missionId, runId: prepared.activeRun.runId,
    clientId: 'web-owner', expectedRevision: prepared.activeRun.revision,
    expectedExecutionStateHash: prepared.activeRun.executionStateHash, handoffId: prepared.handoff.handoffId });
  assert.equal(committed.ok, true, JSON.stringify(committed));
  const apply = (type, payload = {}) => {
    const s = manager.getExecutionSnapshot();
    const result = manager.applyExecutionEvent({ missionId: s.missionId, runId: s.runId,
      expectedRevision: s.authorityRevision, expectedExecutionRevision: s.executionRevision,
      expectedExecutionStateHash: s.executionStateHash,
      event: { type, eventId: `fixture:${type}:${s.executionRevision}`, sequence: s.executionRevision + 1, occurredAt: 1000, payload } });
    assert.equal(result.ok, true, JSON.stringify(result));
    return result;
  };
  // Semantic ACK fixture: this tests authority persistence, not simulator/voice completion.
  apply('PREPARE_REQUESTED');
  apply('EFFECT_ACKNOWLEDGED', { effectId: manager.getExecutionSnapshot().state.effects[0].effectId, status: 'completed' });
  apply('BOARDING_STARTED');
  apply('BOARDING_CONFIRMED');
  apply('LOAD_CONFIRMED');
  apply('MISSION_STARTED');
  let adapter;
  let driver;
  const connect = () => {
    adapter = createTrackerMissionExecutionAdapter({ authorityManager: manager });
    driver = poi.createAuthorityDriver({ authorityManager: manager,
      applySystemEvent: request => adapter.applySystemEvent(request), getTaskItemState: options.getTaskItemState || (() => task.taskItemState({})) });
  };
  connect();
  return { get manager() { return manager; }, get adapter() { return adapter; }, get driver() { return driver; },
    apply, restart() { manager = createMissionAuthorityManager(managerOptions); connect(); } };
}

test('POI recipe is explicitly gated and rejects unsupported/ambiguous task data', t => {
  assert.equal(fixture(t, { poiExecutionEnabled: false }).prepared.error, 'mission_execution_recipe_not_enabled');
  for (const patch of [{ taskDomain: 'mapping_survey' }, { target: { lat: null, lon: 0 } },
    { strict: null }, { trackingActive: null }, { poiChain: {} }, { sarHeli: true },
    { passenger: { targetRadiusNm: 0, targetAltFt: 3000, targetDwellMin: 2 } }]) {
    assert.ok(poi.validateRecipe(recipe(patch)), JSON.stringify(patch));
  }
  assert.equal(poi.validateRecipe(recipe()), null);
});

test('tracker observes the shared task, ignores duplicates and pauses its clocks', () => {
  const r = recipe();
  let a = poi.observe(r, null, sample(1000), facts);
  assert.equal(a.state.detector.inRadius, true);
  assert.equal(a.state.detector.dwellSec, 0);
  a = poi.observe(r, a.state, sample(2000), facts);
  assert.ok(a.state.detector.dwellSec > 1);
  const before = structuredClone(a.state);
  for (const time of [1000, 2000]) assert.deepEqual(poi.observe(r, before, sample(time), facts).state, before);
  assert.equal(poi.observe(r, before, sample(3000, { altFt: NaN }), facts).changed, false);
  const paused = poi.observe(r, before, sample(3000, { simPaused: true }), facts);
  const resumed = poi.observe(r, paused.state, sample(3603000), facts);
  assert.equal(resumed.state.detector.dwellSec - before.detector.dwellSec, before.detector.dwellSec);
  assert.equal(before.detector.enteredAt, 1000, 'previous state must remain unchanged');
  assert.equal(resumed.state.detector.attempts, 0);
  assert.equal(poi.observe(r, resumed.state, sample(3604000), { ...facts, ending: true }).changed, false);
});

test('authority persists detector precision, clocks, effects and replay hash across restart', t => {
  const f = fixture(t);
  assert.equal(f.driver.observeTelemetry(sample(1000)).ok, true);
  assert.equal(f.driver.observeTelemetry(sample(2000)).ok, true);
  assert.equal(f.driver.flush().ok, true);
  const before = f.manager.getExecutionSnapshot();
  assert.ok(before.state.poiTask.detector.dwellSec > 1);
  const voiceIds = before.state.effects.filter(e => e.type === 'voice.poi').map(e => e.effectId);
  assert.equal(new Set(voiceIds).size, voiceIds.length);
  assert.ok(voiceIds.length >= 1);
  f.restart();
  assert.deepEqual(f.manager.getExecutionSnapshot().state.poiTask, before.state.poiTask);
  assert.equal(f.manager.getExecutionSnapshot().executionStateHash, before.executionStateHash);
  assert.equal(f.driver.observeTelemetry(sample(2000)).status, 'noop');
  assert.equal(f.driver.observeTelemetry(sample(3602000)).ok, true);
  const after = f.manager.getExecutionSnapshot();
  assert.equal(after.state.poiTask.detector.dwellSec, before.state.poiTask.detector.dwellSec, 'no offline task time');
  assert.deepEqual(after.state.effects.filter(e => e.type === 'voice.poi').map(e => e.effectId), voiceIds);
  const replay = execution.replay(f.manager.getActiveRun({ includeBundle: true }).resumeBundle.executionReplay);
  assert.equal(replay.ok, true);
  assert.equal(replay.stateHash, after.executionStateHash);
});

test('conflicting commit does not consume a sample or advance the driver', t => {
  const f = fixture(t);
  let reject = true;
  const driver = poi.createAuthorityDriver({ authorityManager: f.manager, getTaskItemState: () => task.taskItemState({}),
    applySystemEvent: request => reject ? { ok: false, status: 'conflict' } : f.adapter.applySystemEvent(request) });
  assert.equal(driver.observeTelemetry(sample(1000)).ok, false);
  assert.equal(f.manager.getExecutionSnapshot().state.poiTask, undefined);
  reject = false;
  assert.equal(driver.observeTelemetry(sample(1000)).ok, true);
  assert.equal(f.manager.getExecutionSnapshot().state.poiTask.sequence, 1);
  const staleRevision = f.manager.getActiveRun().revision;
  assert.equal(driver.observeTelemetry(sample(2000)).ok, true);
  assert.equal(driver.flush().ok, true);
  const s = f.manager.getExecutionSnapshot();
  const rejected = f.adapter.applySystemEvent({ missionId: s.missionId, runId: s.runId,
    expectedRevision: staleRevision, eventId: 'second-controller', type: 'POI_TASK_OBSERVED',
    payload: { poiTask: { ...s.state.poiTask, sequence: 3 } } });
  assert.equal(rejected.error, 'mission_revision_conflict');
  assert.equal(f.manager.getExecutionSnapshot().executionStateHash, s.executionStateHash);
});

test('task completion survives event compaction and remains distinct from closing', t => {
  const f = fixture(t);
  // Explicit lifecycle flushes exercise compaction independently of regular cadence.
  for (let i = 1; i <= 500; i++) {
    assert.equal(f.driver.observeTelemetry(sample(1000 + i * 200)).ok, true);
    assert.equal(f.driver.flush().ok, true);
  }
  const done = f.manager.getExecutionSnapshot();
  assert.equal(done.state.poiTask.detector.satisfied, true);
  assert.equal(done.state.phase, 'return_leg');
  assert.equal(done.state.flags.active, true);
  assert.equal(done.state.flags.closed, false);
  assert.equal(done.state.flags.farewellStarted, false);
  f.restart();
  assert.equal(f.manager.getExecutionSnapshot().executionStateHash, done.executionStateHash);
  assert.equal(f.driver.observeTelemetry(sample(200000)).reason, 'poi_task_terminal');
  assert.equal(f.manager.getExecutionSnapshot().executionStateHash, done.executionStateHash);
});

test('all controllers receive a detached task projection of the same accepted revision', t => {
  const f = fixture(t);
  f.driver.observeTelemetry(sample(1000));
  f.driver.observeTelemetry(sample(2000));
  const app = f.manager.getPublicSnapshot().execution;
  const efb = f.manager.getPublicSnapshot().execution;
  assert.deepEqual(app, efb);
  assert.equal(app.poiTask.dwellSec, f.manager.getExecutionSnapshot().state.poiTask.detector.dwellSec);
  assert.equal(Object.hasOwn(app.poiTask, 'detector'), false);
  assert.equal(Object.hasOwn(app.poiTask, 'enteredAt'), false);
  assert.equal(Object.hasOwn(app, 'executionPoiRecipe'), false);
  app.poiTask.dwellSec = 99999;
  assert.deepEqual(f.manager.getPublicSnapshot().execution, efb);
  f.driver.observeTelemetry(sample(3000));
  assert.deepEqual(f.manager.getPublicSnapshot().execution, efb, 'buffer is private');
  f.driver.flush();
  const fresh = f.manager.getPublicSnapshot().execution;
  assert.ok(fresh.authorityRevision > efb.authorityRevision);
  assert.ok(fresh.poiTask.dwellSec > efb.poiTask.dwellSec);
});

test('malformed, stale and skipped detector transitions cannot enter the authority state', t => {
  const f = fixture(t);
  f.driver.observeTelemetry(sample(1000));
  const before = f.manager.getExecutionSnapshot();
  const valid = poi.observe(recipe(), before.state.poiTask, sample(2000), facts).state;
  for (const [index, patch] of [{ missionId: 'another-mission' }, { sequence: 100 }, { observedAt: 1000 },
    { detector: {} }, { detector: { ...valid.detector, dwellSec: '999' } },
    { detector: { ...valid.detector, dwellSec: -1 } }, { suspendedAt: 2001 }].entries()) {
    const result = f.adapter.applySystemEvent({ missionId: before.missionId, runId: before.runId,
      expectedRevision: before.authorityRevision, eventId: `bad-observation:${index}`, type: 'POI_TASK_OBSERVED',
      payload: { poiTask: { ...valid, ...patch } } });
    assert.equal(result.ok, false, JSON.stringify(patch));
    assert.equal(f.manager.getExecutionSnapshot().executionStateHash, before.executionStateHash);
  }
  assert.throws(() => poi.createState(recipe(), { ...valid, detector: {} }), /poi_runtime_state_invalid/);
});

test('leaving the work radius restores the outbound phase without losing dwell', t => {
  const f = fixture(t);
  f.driver.observeTelemetry(sample(1000));
  f.driver.observeTelemetry(sample(2000));
  f.driver.flush();
  const working = f.manager.getExecutionSnapshot();
  assert.equal(working.state.phase, 'on_task');
  f.driver.observeTelemetry(sample(3000, { lon: .1 }));
  const outside = f.manager.getPublicSnapshot().execution;
  assert.equal(outside.poiTask.stage, 'enroute');
  assert.equal(outside.phase, 'enroute');
  assert.equal(outside.poiTask.dwellSec, working.state.poiTask.detector.dwellSec);
  f.driver.observeTelemetry(sample(4000));
  assert.equal(f.manager.getExecutionSnapshot().state.phase, 'on_task');
});

test('pause signals work without position and remain suspended through invalid resume samples', t => {
  const f = fixture(t);
  f.driver.observeTelemetry(sample(1000, { altFt: 4000 }));
  f.apply('TOUCHDOWN');
  const beforePause = f.manager.getExecutionSnapshot().state;
  const paused = f.driver.observeTelemetry({ observedAt: 2000, simPaused: true });
  assert.equal(paused.ok, true);
  assert.equal(paused.reason, 'poi_task_suspended');
  assert.equal(f.manager.getExecutionSnapshot().state.poiTask.suspendedAt, 2000);
  assert.equal(f.manager.getExecutionSnapshot().state.phase, beforePause.phase);
  assert.equal(f.manager.getExecutionSnapshot().state.subphase, beforePause.subphase);
  f.restart();
  f.driver.observeTelemetry({ observedAt: 200000, simPaused: false });
  assert.equal(f.manager.getExecutionSnapshot().state.poiTask.suspendedAt, 2000);
  f.driver.observeTelemetry(sample(201000, { altFt: 4000 }));
  const resumed = f.manager.getExecutionSnapshot().state.poiTask;
  assert.equal(resumed.detector.attempts, 0, 'pause must not exhaust altitude grace');
  assert.equal(resumed.detector.dwellSec, 0);
  assert.equal(resumed.suspendedAt, null);
});

test('specialized task data inside the passenger cannot pass the standard POI gate', () => {
  for (const key of ['poiChain', 'surveyPattern', 'trainingProcedure', 'sarHeli', 'bush']) {
    assert.equal(poi.validateRecipe(recipe({ passenger: { ...recipe().passenger, [key]: {} } })),
      'poi_recipe_specialized_task_not_migrated', key);
  }
});

test('a standard-looking recipe cannot override specialized mission data at handoff', t => {
  for (const key of ['poiChain', 'surveyPattern', 'trainingProcedure', 'sarHeli', 'bush']) {
    const f = fixture(t, { mission: { [key]: {} }, expectRejected: true });
    assert.equal(f.prepared.ok, false, key);
    assert.equal(f.prepared.error, 'mission_execution_recipe_not_enabled', key);
    assert.equal(f.manager.getActiveRun().executionAuthority, 'web');
  }
});

test('real persistence failure rolls back the sample and its effects before retry', t => {
  let fail = false;
  const f = fixture(t, { fs: { ...fs, writeFileSync(...args) {
    if (fail) throw new Error('simulated disk full');
    return fs.writeFileSync(...args);
  } } });
  f.driver.observeTelemetry(sample(1000, { lon: .1 }));
  const before = f.manager.getExecutionSnapshot();
  fail = true;
  assert.equal(f.driver.observeTelemetry(sample(2000)).ok, false);
  assert.deepEqual(f.manager.getExecutionSnapshot().state, before.state);
  fail = false;
  assert.equal(f.driver.observeTelemetry(sample(2000)).ok, true);
  const accepted = f.manager.getExecutionSnapshot();
  const entry = accepted.state.effects.filter(e => e.type === 'voice.poi' && e.payload.prompt === '_poiEntryPrompt');
  assert.equal(entry.length, 1);
  f.restart();
  assert.equal(f.manager.getExecutionSnapshot().executionStateHash, accepted.executionStateHash);
  assert.equal(f.driver.observeTelemetry(sample(2000)).status, 'noop');
});

test('5 Hz observations produce twelve regular checkpoints per minute', t => {
  let writes = 0;
  const f = fixture(t, { fs: { ...fs, writeFileSync(...args) {
    writes++;
    return fs.writeFileSync(...args);
  } } });
  writes = 0;
  for (let i = 0; i < 300; i++) {
    const result = f.driver.observeTelemetry(sample(1000 + i * 200, { lon: .2 }));
    assert.equal(result.ok, true);
    assert.deepEqual(result.poiTask, poi.project(f.manager.getExecutionSnapshot().state.poiTask));
  }
  assert.equal(writes, 12);
  assert.equal(f.manager.getExecutionSnapshot().state.poiTask.sequence, 12);
  assert.equal(f.driver.flush().ok, true);
  assert.equal(writes, 13, 'clean flush saves the trailing partial interval');
  f.driver.flush();
  f.driver.observeTelemetry(sample(60800, { lon: .2 }));
  assert.equal(writes, 13, 'duplicate samples and empty flushes do not write');
});

test('batching preserves every sample calculation and original voice descriptor', t => {
  for (const mode of ['completion', 'altitude', 'cargo', 'flyover']) {
    const r = recipe({ strict: mode !== 'altitude', passenger: {
      ...recipe().passenger, targetDwellMin: mode === 'flyover' ? 0 : mode === 'altitude' ? 20 : .5 } });
    let cargo = task.taskItemState({});
    const f = fixture(t, { recipe: r, getTaskItemState: () => cargo });
    let reference = null;
    const expectedVoice = [];
    for (let i = 0; i < 500; i++) {
      if (mode === 'cargo' && i === 40) cargo = { blockingItems: ['Camera'], reason: 'damaged' };
      const input = sample(1000 + i * 200, {
        lon: i < 10 || (i >= 30 && i < 35) ? .08 : .004 + (i % 7) * .002,
        altFt: mode === 'altitude' && (i < 220 || i > 280) ? 4000 : 3000
      });
      const expected = poi.observe(r, reference, input, { ...facts, taskItemState: cargo });
      reference = expected.state;
      expectedVoice.push(...expected.effects.filter(e => e.type === 'voice')
        .map(e => ({ ...e.value, detector: e.state })));
      const result = f.driver.observeTelemetry(input);
      assert.equal(result.ok, true, mode);
      const saved = f.manager.getExecutionSnapshot().state;
      if (saved.poiTask?.observedAt === reference.observedAt) {
        assert.deepEqual(saved.poiTask.detector, reference.detector, `${mode}:${i}`);
      }
      assert.deepEqual(saved.effects.filter(e => e.type === 'voice.poi').map(e => e.payload), expectedVoice,
        `${mode}:${i}: every voice cue must commit immediately`);
      if (reference.detector.satisfied || reference.detector.aborted) {
        assert.deepEqual(saved.poiTask.detector, reference.detector, 'terminal result cannot wait for cadence');
      }
    }
    assert.equal(f.driver.flush().ok, true);
    assert.deepEqual(f.manager.getExecutionSnapshot().state.poiTask.detector, reference.detector, mode);
  }
});

test('hard restart loses only the pending interval and never counts offline time', t => {
  const f = fixture(t);
  for (let i = 0; i < 50; i++) f.driver.observeTelemetry(sample(1000 + i * 200));
  const saved = f.manager.getExecutionSnapshot();
  assert.equal(saved.state.poiTask.observedAt, 6000);
  assert.ok(10800 - saved.state.poiTask.observedAt < poi.CHECKPOINT_INTERVAL_MS);
  f.restart();
  assert.equal(f.manager.getExecutionSnapshot().executionStateHash, saved.executionStateHash);
  f.driver.observeTelemetry(sample(3600000));
  assert.equal(f.manager.getExecutionSnapshot().state.poiTask.detector.dwellSec, saved.state.poiTask.detector.dwellSec);
});

test('disconnect flushes the precise buffer and suspends until fresh telemetry', t => {
  const f = fixture(t);
  f.driver.observeTelemetry(sample(1000));
  f.driver.observeTelemetry(sample(2000));
  assert.equal(f.driver.disconnect().ok, true);
  const saved = f.manager.getExecutionSnapshot();
  assert.ok(saved.state.poiTask.detector.dwellSec > 1);
  f.driver.observeTelemetry({ observedAt: 3000 });
  f.driver.observeTelemetry(sample(3600000));
  const resumed = f.manager.getExecutionSnapshot();
  assert.equal(resumed.state.poiTask.detector.dwellSec, saved.state.poiTask.detector.dwellSec);
  assert.deepEqual(resumed.state.effects, saved.state.effects);
});

test('failed periodic checkpoint is retained before newer samples can advance', t => {
  let fail = false;
  const f = fixture(t, { fs: { ...fs, writeFileSync(...args) {
    if (fail) throw new Error('disk full');
    return fs.writeFileSync(...args);
  } } });
  let reference = null;
  for (let i = 1; i <= 6; i++) {
    if (i === 6) fail = true;
    const input = sample(i * 1000);
    reference = poi.observe(recipe(), reference, input, facts).state;
    assert.equal(f.driver.observeTelemetry(input).ok, i !== 6);
  }
  const before = f.manager.getExecutionSnapshot();
  assert.equal(f.driver.observeTelemetry(sample(9000)).ok, false);
  assert.equal(f.manager.getExecutionSnapshot().executionStateHash, before.executionStateHash);
  fail = false;
  assert.equal(f.driver.flush().ok, true);
  assert.equal(f.manager.getExecutionSnapshot().state.poiTask.observedAt, 6000);
  assert.deepEqual(f.manager.getExecutionSnapshot().state.poiTask.detector, reference.detector);
});

test('failed completion commits its original voice once before accepting newer samples', t => {
  let fail = false;
  const r = recipe({ passenger: { ...recipe().passenger, targetDwellMin: .05 } });
  const f = fixture(t, { recipe: r, fs: { ...fs, writeFileSync(...args) {
    if (fail) throw new Error('disk full');
    return fs.writeFileSync(...args);
  } } });
  f.driver.observeTelemetry(sample(1000));
  f.driver.observeTelemetry(sample(2000));
  fail = true;
  assert.equal(f.driver.observeTelemetry(sample(3000)).ok, false);
  assert.equal(f.manager.getExecutionSnapshot().state.poiTask.detector.satisfied, false);
  assert.equal(f.driver.observeTelemetry(sample(4000, { lon: .2 })).ok, false);
  fail = false;
  assert.equal(f.driver.observeTelemetry(sample(5000, { lon: .2 })).ok, true);
  const saved = f.manager.getExecutionSnapshot();
  assert.equal(saved.state.poiTask.detector.satisfied, true);
  assert.equal(saved.state.poiTask.observedAt, 3000);
  assert.equal(saved.state.effects.filter(e => e.type === 'voice.poi' && e.payload.prompt === '_poiSatisfiedPrompt').length, 1);
  f.driver.flush();
  assert.equal(f.manager.getExecutionSnapshot().executionStateHash, saved.executionStateHash);
});

test('unrelated authority revisions preserve buffered work and latest shared state', t => {
  const f = fixture(t);
  f.driver.observeTelemetry(sample(1000));
  f.driver.observeTelemetry(sample(2000));
  f.apply('TOUCHDOWN');
  const intermediate = f.manager.getExecutionSnapshot();
  f.driver.observeTelemetry(sample(3000));
  assert.equal(f.driver.flush().ok, true);
  const saved = f.manager.getExecutionSnapshot();
  let reference = null;
  for (const time of [1000, 2000, 3000]) reference = poi.observe(recipe(), reference, sample(time), facts).state;
  assert.deepEqual(saved.state.poiTask.detector, reference.detector);
  assert.deepEqual(saved.state.effects, intermediate.state.effects);
  assert.ok(saved.authorityRevision > intermediate.authorityRevision);
});

test('a foreign POI checkpoint invalidates buffered history before further observations', t => {
  const f = fixture(t);
  f.driver.observeTelemetry(sample(1000));
  f.driver.observeTelemetry(sample(2000));
  const other = poi.createAuthorityDriver({ authorityManager: f.manager,
    applySystemEvent: request => f.adapter.applySystemEvent(request), getTaskItemState: () => task.taskItemState({}) });
  other.observeTelemetry(sample(3000, { lon: .2 }));
  const foreign = f.manager.getExecutionSnapshot();
  assert.equal(f.driver.flush().status, 'noop');
  assert.equal(f.manager.getExecutionSnapshot().executionStateHash, foreign.executionStateHash);
  f.driver.observeTelemetry(sample(4000, { lon: .2 }));
  const saved = f.manager.getExecutionSnapshot();
  assert.equal(saved.state.poiTask.detector.dwellSec, foreign.state.poiTask.detector.dwellSec);
  assert.equal(saved.state.poiTask.sequence, foreign.state.poiTask.sequence + 1);
});


test('manifest task blockers match the original App outcome for all item states', () => {
  const source = fs.readFileSync(path.join(__dirname, '../mission-cargo-core.js'), 'utf8');
  const legacy = source.slice(source.indexOf('function _missionCargoEvaluateOutcome('),
    source.indexOf('function _missionCargoEvaluateFarewellOutcome('));
  assert.ok(legacy.includes('damagedRequired'));
  const context = vm.createContext({
    _missionCargoItemNeedsUnloadHere: item => item.deliverAtDestination !== false,
    _missionCargoIsPassengerItem: item => item.itemType === 'passenger'
  });
  vm.runInContext(legacy, context);
  for (const status of ['pending', 'loaded', 'unloaded', 'dropped', 'lost', 'handed_off']) {
    for (const healthPct of [undefined, null, 0, 34.9, 35, 35.1, 100]) {
      for (const required of [true, false]) for (const itemType of ['cargo', 'passenger']) {
        const manifest = { maxStressDamagePct: 80, items: [
          { id: 'item', required, status, healthPct, itemType, storyName: ' Camera ', label: 'Equipment' },
          { id: 'duplicate', required: true, status: 'dropped', storyName: 'Camera', healthPct: 100 },
          { id: 'optional', required: false, status: 'lost', label: 'Optional', healthPct: 0 }
        ] };
        const before = structuredClone(manifest);
        const expected = task.taskItemState(context._missionCargoEvaluateOutcome(manifest));
        assert.deepEqual(poi.taskItemStateFromManifest(manifest), expected,
          `${status}:${healthPct}:${required}:${itemType}`);
        assert.deepEqual(manifest, before, 'evaluating task items is read-only');
      }
    }
  }
});

test('real runtime drives POI checkpoints and publishes only accepted revisions', t => {
  const f = fixture(t);
  const notifications = [];
  const runtime = createTrackerMissionExecutionRuntime({ enabled: true, authorityManager: f.manager,
    onAuthorityChanged: (reason, snapshot) => notifications.push({ reason, snapshot }) });
  assert.equal(runtime.observeTelemetry(sample(1000)).ok, true);
  assert.equal(notifications.length, 1);
  const first = f.manager.getPublicSnapshot().execution;
  assert.equal(runtime.observeTelemetry(sample(2000)).status, 'buffered');
  assert.equal(notifications.length, 1);
  assert.deepEqual(f.manager.getPublicSnapshot().execution, first);
  assert.equal(runtime.flush().ok, true);
  assert.equal(notifications.length, 2);
  assert.ok(notifications[1].snapshot.state.poiTask.detector.dwellSec > 1);
  runtime.flush();
  assert.equal(notifications.length, 2);
  // Landing in the work area must not invoke the APT target/arrival path.
  for (let time = 3000; time <= 20000; time += 1000) {
    assert.equal(runtime.observeTelemetry(sample(time, { onGround: true, gsKts: 0, aglFt: 0 })).ok, true);
  }
  const state = f.manager.getExecutionSnapshot().state;
  assert.equal(state.phase, 'on_task');
  assert.equal(state.flags.closed, false);
  assert.equal(state.flags.farewellStarted, false);
  assert.equal(state.effects.some(e => ['voice.approach', 'scene.arrival', 'voice.farewell'].includes(e.type)), false);
});

test('runtime uses confirmed required equipment and commits cargo abort immediately', t => {
  for (const patch of [{ status: 'pending' }, { status: 'dropped' }, { status: 'loaded', healthPct: 35 }]) {
    const f = fixture(t);
    const runtime = createTrackerMissionExecutionRuntime({ enabled: true, authorityManager: f.manager });
    runtime.observeTelemetry(sample(1000));
    runtime.observeTelemetry(sample(2000));
    const manifest = { ...f.manager.getExecutionSnapshot().state.manifest, items: [
      { id: 'camera', label: 'Kamera', storyName: 'Arbeitskamera', itemType: 'cargo', required: true,
        pickup: 'departure', healthPct: 100, weightLbs: 5, ...patch }
    ] };
    f.apply('CARGO_STATE_CHANGED', { manifest });
    const cargo = f.manager.getExecutionSnapshot().state.manifest;
    const result = runtime.observeTelemetry(sample(2200));
    assert.equal(result.ok, true);
    const state = f.manager.getExecutionSnapshot().state;
    assert.equal(state.poiTask.detector.aborted, true);
    assert.equal(state.poiTask.observedAt, 2200);
    assert.deepEqual(state.manifest, cargo, 'task detector must not mutate cargo');
    const cue = state.effects.find(e => e.type === 'voice.poi' && e.payload.prompt === '_poiMissingCargoAbortPrompt');
    assert.deepEqual(cue.payload.args[1].blockingItems, ['Arbeitskamera']);
  }
});

test('runtime detach saves the buffer and reconnect does not accumulate offline dwell', t => {
  const f = fixture(t);
  let runtime = createTrackerMissionExecutionRuntime({ enabled: true, authorityManager: f.manager });
  runtime.observeTelemetry(sample(1000));
  runtime.observeTelemetry(sample(2000));
  assert.equal(runtime.detachSimulator(), true);
  const saved = f.manager.getExecutionSnapshot();
  assert.equal(saved.state.poiTask.observedAt, 2000);
  assert.ok(saved.state.poiTask.detector.dwellSec > 1);
  runtime.observeTelemetry(sample(3600000));
  assert.equal(f.manager.getExecutionSnapshot().state.poiTask.detector.dwellSec, saved.state.poiTask.detector.dwellSec);
  f.restart();
  runtime = createTrackerMissionExecutionRuntime({ enabled: true, authorityManager: f.manager });
  runtime.observeTelemetry(sample(7200000));
  assert.equal(f.manager.getExecutionSnapshot().state.poiTask.detector.dwellSec, saved.state.poiTask.detector.dwellSec);
});

test('runtime validates the original intent revision before flush and preserves buffered work on abort failure', async t => {
  let fail = false;
  const f = fixture(t, { fs: { ...fs, writeFileSync(...args) {
    if (fail) throw new Error('disk full');
    return fs.writeFileSync(...args);
  } } });
  const logs = [];
  const runtime = createTrackerMissionExecutionRuntime({ enabled: true, authorityManager: f.manager, log: value => logs.push(value) });
  runtime.observeTelemetry(sample(1000));
  runtime.observeTelemetry(sample(2000));
  const snapshot = f.manager.getExecutionSnapshot();
  const request = { commandId: 'abort-poi', intent: 'abort_mission', missionId: snapshot.missionId,
    runId: snapshot.runId, expectedRevision: snapshot.authorityRevision };
  const stale = await runtime.executeIntent({ ...request, expectedRevision: snapshot.authorityRevision - 1 });
  assert.equal(stale.error, 'mission_revision_conflict');
  assert.equal(f.manager.getExecutionSnapshot().executionStateHash, snapshot.executionStateHash);
  fail = true;
  assert.equal((await runtime.executeIntent(request)).ok, false);
  assert.equal(f.manager.getExecutionSnapshot().executionStateHash, snapshot.executionStateHash);
  assert.ok(logs.some(value => value.includes('MISSION_POI_CHECKPOINT_ERROR')));
  fail = false;
  const aborted = await runtime.executeIntent(request);
  assert.equal(aborted.ok, true, JSON.stringify(aborted));
  assert.equal(f.manager.getExecutionSnapshot(), null);
  const lastRun = f.manager.getPublicSnapshot().lastRun;
  assert.ok(lastRun, 'aborted run must remain available');
});

test('runtime POI routing cannot bypass the recipe opt-in', t => {
  const f = fixture(t);
  const manager = { ...f.manager, supportsExecutionRecipe: () => false };
  const runtime = createTrackerMissionExecutionRuntime({ enabled: true, authorityManager: manager });
  const before = f.manager.getExecutionSnapshot();
  assert.equal(runtime.observeTelemetry(sample(1000)).status, 'ignored');
  assert.equal(runtime.flush().status, 'ignored');
  assert.equal(f.manager.getExecutionSnapshot().executionStateHash, before.executionStateHash);
  const disabled = createTrackerMissionExecutionRuntime({ enabled: false, authorityManager: f.manager });
  assert.equal(disabled.observeTelemetry(sample(2000)).ok, false);
  assert.equal(disabled.flush().status, 'ignored');
  assert.equal(f.manager.getExecutionSnapshot().executionStateHash, before.executionStateHash);
});

test('a notification-side revision change cannot be absorbed into the POI intent rebase', async t => {
  const f = fixture(t);
  const runtime = createTrackerMissionExecutionRuntime({ enabled: true, authorityManager: f.manager,
    onAuthorityChanged: reason => { if (reason === 'poi:intent') f.apply('TOUCHDOWN'); } });
  runtime.observeTelemetry(sample(1000));
  runtime.observeTelemetry(sample(2000));
  const snapshot = f.manager.getExecutionSnapshot();
  const result = await runtime.executeIntent({ commandId: 'abort-with-competing-event', intent: 'abort_mission',
    missionId: snapshot.missionId, runId: snapshot.runId, expectedRevision: snapshot.authorityRevision });
  assert.equal(result.error, 'mission_revision_conflict');
  assert.equal(f.manager.getExecutionSnapshot().state.poiTask.observedAt, 2000, 'own checkpoint is saved');
  assert.equal(f.manager.getActiveRun().runId, snapshot.runId, 'competing revision prevents abort');
});

const poiVoice = require('../mission-poi-voice-core.js');
const { createTrackerMissionBoardingVoice } = require('./tracker-mission-boarding-voice.js');
const { createTrackerVoiceService } = require('./tracker-voice-service.js');
const { createTrackerMissionEffectRunner } = require('./tracker-mission-effect-runner.js');
function voiceContext(overrides = {}) {
  return { schema: poiVoice.CONTEXT_SCHEMA, version: 1, missionId: 'poi-test',
    taskDomain: 'media_photo', strict: true, audioEnabled: false,
    baseContext: 'Du fotografierst das Zielobjekt.', toneHint: ' Keine neue Begrüßung.',
    passenger: recipe().passenger, missionData: { poiName: 'Testobjekt' },
    inspectionMeta: null, infraOutcome: null, professionalMeta: null,
    targetFacts: ['Die Vegetation zeigt besondere regionale Merkmale.'], wikiText: '',
    landmarkPolicy: null, visualLandmarks: [], targetGeoContext: {},
    speaker: { name: 'Mara', gender: 'female' }, textModels: { openai: ['gpt-4o-mini'] },
    ttsModels: [], ...overrides };
}
function speechFixture(t, options = {}) {
  const f = fixture(t, { ...options, recipe: recipe({ voiceContext: voiceContext(options.voice) }) });
  f.driver.observeTelemetry(sample(1000, { lon: .04 }));
  return f;
}
const speechRequest = (f, effect) => ({ missionId: 'poi-test', runId: f.manager.getActiveRun().runId,
  commandId: effect.effectId, effect });
const waitUntil = async predicate => {
  for (let i = 0; i < 500; i++) { if (predicate()) return; await new Promise(resolve => setTimeout(resolve, 10)); }
  assert.fail('async voice operation did not settle');
};

test('voice context rejects mismatches, specialized tasks and oversized seeds', () => {
  for (const context of [voiceContext({ missionId: 'other' }), voiceContext({ strict: false }),
    voiceContext({ taskDomain: 'training' }), voiceContext({ baseContext: 'x'.repeat(65536) }),
    voiceContext({ passenger: { ...recipe().passenger, trainingPlan: { mode: 'airwork' } } })]) {
    assert.ok(poi.validateRecipe(recipe({ voiceContext: context })));
  }
  assert.throws(() => poiVoice.render(voiceContext(), { prompt: 'eval', args: [] }), /cue_invalid/);
  assert.throws(() => poiVoice.render(voiceContext({ baseContext: 'x'.repeat(24000) }),
    { prompt: '_poiEntryPrompt', args: [{}] }), /prompt_too_large/);
});

test('task commit saves original prompts, detector timing and inspection choice before dispatch', t => {
  const f = fixture(t, { recipe: recipe({ taskDomain: 'inspection_infra', passenger: { ...recipe().passenger, targetDwellMin: .01 },
    voiceContext: voiceContext({ taskDomain: 'inspection_infra', passenger: { ...recipe().passenger, targetDwellMin: .01 },
      inspectionMeta: { objectName: 'Brücke' } }) }) });
  f.driver.observeTelemetry(sample(1000, { windKts: 22 }));
  f.driver.observeTelemetry(sample(2000, { windKts: 22 }));
  const before = f.manager.getExecutionSnapshot();
  const cues = before.state.effects.filter(e => e.type === 'voice.poi');
  assert.ok(cues.every(e => e.payload.resolvedRecipe?.prompt));
  for (const e of cues) assert.equal(e.payload.resolvedRecipe.prompt, poiVoice.render(
    f.manager.getExecutionPoiRecipe().voiceContext, e.payload,
    { inspectionOutcome: before.state.voice.poiMemory?.inspectionOutcome }).prompt);
  assert.ok(before.state.voice.poiMemory.inspectionOutcome);
  f.restart();
  assert.deepEqual(f.manager.getExecutionSnapshot().state.effects, before.state.effects);
  assert.equal(execution.replay(f.manager.getActiveRun({ includeBundle: true }).resumeBundle.executionReplay).stateHash,
    before.executionStateHash);
});

test('text is persisted before playback and influences later task prompts', async t => {
  const f = speechFixture(t);
  const effect = f.manager.getExecutionSnapshot().state.effects.find(e => e.type === 'voice.poi');
  let activated = false;
  const handler = createTrackerMissionBoardingVoice({ authorityManager: f.manager,
    voiceService: { publicState: () => ({ configured: true }), request: request => assert.equal(request.deferPlayback, true),
      wait: async () => ({ status: 'ready', text: 'Die Vegetation zeigt besondere regionale Merkmale.', audioAvailable: true }),
      activatePlayback: () => {
        assert.equal(f.manager.getExecutionSnapshot().state.voice.poiMemory.pre, 'Die Vegetation zeigt besondere regionale Merkmale');
        activated = true;
      } } });
  const result = await handler.dispatch(speechRequest(f, effect));
  assert.equal(result.ok, true); assert.equal(activated, true);
  const recorded = f.manager.getExecutionSnapshot();
  assert.equal(recorded.state.effects.find(e => e.effectId === effect.effectId).status, 'requested', 'text-ready is not playback ACK');
  const prompt = poiVoice.render(voiceContext(), { prompt: '_poiEntryPrompt', args: [{}] }, recorded.state.voice.poiMemory).prompt;
  assert.match(prompt, /Bereits genannt/);
  assert.equal(prompt.includes('Sachlicher Ziel-/Umfeld-Fakt'), false);
  f.restart();
  assert.deepEqual(f.manager.getExecutionSnapshot().state.voice.poiMemory, recorded.state.voice.poiMemory);
});

test('failed text persistence holds playback and retries the same generated result', async t => {
  let fail = false, requests = 0, activated = 0;
  const f = speechFixture(t, { fs: { ...fs, writeFileSync(...args) {
    if (fail) throw new Error('disk full'); return fs.writeFileSync(...args);
  } } });
  const effect = f.manager.getExecutionSnapshot().state.effects.find(e => e.type === 'voice.poi');
  const handler = createTrackerMissionBoardingVoice({ authorityManager: f.manager,
    voiceService: { publicState: () => ({ configured: true }), request: () => requests++,
      wait: async () => ({ status: 'ready', text: 'Dort liegt die Eisenbahn.' }), activatePlayback: () => activated++ } });
  fail = true;
  assert.equal((await handler.dispatch(speechRequest(f, effect))).status, 'pending');
  assert.equal(activated, 0);
  assert.equal(f.manager.getExecutionSnapshot().state.voice.poiMemory, undefined);
  fail = false;
  assert.equal((await handler.dispatch(speechRequest(f, effect))).ok, true);
  assert.equal(activated, 1);
  assert.equal(requests, 2, 'service receives the same immutable effect ID on retry');
  assert.equal(f.manager.getExecutionSnapshot().state.voice.poiMemory.pre, 'Dort liegt die Eisenbahn');
});

test('slow POI voice preserves speech order while cargo intents and telemetry advance', async t => {
  const f = speechFixture(t);
  let releaseFirst;
  const calls = [];
  const runtime = createTrackerMissionExecutionRuntime({ enabled: true, authorityManager: f.manager,
    playBoardingVoice: request => {
      calls.push(request.effect.effectId);
      if (calls.length === 1) return new Promise(resolve => { releaseFirst = resolve; });
      return { ok: true, status: 'completed', voiceOutcome: { schema: 'ga.mission-voice-outcome.v1', text: 'Erledigt.' } };
    } });
  runtime.observeTelemetry(sample(2000));
  await waitUntil(() => calls.length === 1);
  runtime.observeTelemetry(sample(3000));
  assert.equal(calls.length, 1, 'second POI cue waits for durable ACK');
  const s = f.manager.getExecutionSnapshot();
  const opened = await runtime.executeIntent({ commandId: 'cargo-during-poi-voice', intent: 'open_cargo_window',
    missionId: s.missionId, runId: s.runId, expectedRevision: s.authorityRevision });
  assert.equal(opened.ok, true);
  assert.equal(f.manager.getExecutionSnapshot().state.poiTask.observedAt, 3000);
  releaseFirst({ ok: true, status: 'completed', voiceOutcome: { schema: 'ga.mission-voice-outcome.v1', text: 'Objekt voraus.' } });
  await waitUntil(() => f.manager.getExecutionSnapshot().state.effects.filter(e => e.type === 'voice.poi').every(e => e.status === 'completed'));
  assert.equal(calls.length, 2);
});

test('ready POI job and exclusive playback lease survive restart without provider repetition', async t => {
  const f = speechFixture(t, { voice: { audioEnabled: true } });
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'poi-voice-service-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  let providerCalls = 0;
  const options = { provider: 'openai', apiKey: 'test-key', storageFile: path.join(directory, 'voice.json'),
    fetchRemote: async url => { providerCalls++; return { ok: true, status: 200,
      json: async () => ({ choices: [{ message: { content: 'Das Ziel liegt vor uns.' } }] }),
      arrayBuffer: async () => Buffer.from('test-audio') }; } };
  let service = createTrackerVoiceService(options);
  const effect = f.manager.getExecutionSnapshot().state.effects.find(e => e.type === 'voice.poi');
  let handler = createTrackerMissionBoardingVoice({ authorityManager: f.manager, voiceService: service });
  assert.equal((await handler.dispatch(speechRequest(f, effect))).ok, true);
  assert.equal(service.get(effect.effectId).kind, 'poi');
  const claim = service.claimPlayback({ effectId: effect.effectId, clientId: 'efb-a' });
  assert.equal(claim.claimed, true);
  assert.equal(service.claimPlayback({ effectId: effect.effectId, clientId: 'app-b' }).claimed, false);
  service.releasePlayback({ effectId: effect.effectId, clientId: 'efb-a', completed: true });
  assert.equal(await service.flushPersistence(), true);
  const calls = providerCalls;
  f.restart(); service = createTrackerVoiceService(options);
  assert.equal(service.get(effect.effectId).kind, 'poi', 'cache restore must preserve the POI kind');
  handler = createTrackerMissionBoardingVoice({ authorityManager: f.manager, voiceService: service,
    getAudioPlaybackCandidates: () => 2 });
  const saved = f.manager.getExecutionSnapshot().state.effects.find(e => e.effectId === effect.effectId);
  assert.equal((await handler.dispatch(speechRequest(f, saved))).voiceStatus, 'completed');
  assert.equal(providerCalls, calls);
  assert.equal(await service.flushPersistence(), true);
});

test('POI commits text before slow TTS and later triggers use that memory', async t => {
  const f = speechFixture(t, { voice: { audioEnabled: true } });
  const effect = f.manager.getExecutionSnapshot().state.effects.find(e => e.type === 'voice.poi');
  let finishAudio, audioStarted = false;
  const text = 'Die Vegetation zeigt besondere regionale Merkmale.';
  const service = createTrackerVoiceService({ provider: 'openai', apiKey: 'test-key', fetchRemote: async url => {
    if (!url.includes('/audio/speech')) return { ok: true, json: async () => ({ choices: [{ message: { content: text } }] }) };
    assert.equal(f.manager.getExecutionSnapshot().state.voice.poiMemory.pre, text.slice(0, -1));
    audioStarted = true;
    return new Promise(resolve => { finishAudio = () => resolve({ ok: true, arrayBuffer: async () => Buffer.from('audio') }); });
  } });
  const handler = createTrackerMissionBoardingVoice({ authorityManager: f.manager, voiceService: service });
  const pending = handler.dispatch(speechRequest(f, effect));
  await waitUntil(() => audioStarted);
  const saved = f.manager.getExecutionSnapshot();
  assert.equal(saved.state.effects.find(e => e.effectId === effect.effectId).payload.resolvedText, text);
  assert.equal(saved.state.effects.find(e => e.effectId === effect.effectId).status, 'requested');
  assert.equal(service.claimPlayback({ effectId: effect.effectId, clientId: 'early-client' }).claimed, false);
  f.driver.observeTelemetry(sample(2000));
  const entry = f.manager.getExecutionSnapshot().state.effects.find(e => e.type === 'voice.poi' && e.payload.label === 'Zielgebiet');
  assert.match(entry.payload.resolvedRecipe.prompt, /Bereits genannt/);
  assert.equal(entry.payload.resolvedRecipe.prompt.includes('Sachlicher Ziel-/Umfeld-Fakt'), false);
  finishAudio();
  assert.equal((await pending).ok, true);
});

test('POI keeps generated text and memory when all TTS attempts fail', async t => {
  const f = speechFixture(t, { voice: { audioEnabled: true } });
  const text = 'Die Vegetation zeigt besondere regionale Merkmale.';
  const service = createTrackerVoiceService({ provider: 'openai', apiKey: 'test-key', fetchRemote: async url =>
    url.includes('/audio/speech') ? { ok: false, status: 503 }
      : { ok: true, json: async () => ({ choices: [{ message: { content: text } }] }) } });
  const handler = createTrackerMissionBoardingVoice({ authorityManager: f.manager, voiceService: service });
  const runner = createTrackerMissionEffectRunner({ authorityManager: f.manager,
    handlers: { 'voice.poi': request => handler.dispatch(request) } });
  await runner.drain();
  const saved = f.manager.getExecutionSnapshot();
  const effect = saved.state.effects.find(e => e.type === 'voice.poi');
  assert.equal(effect.status, 'completed', 'audio failure remains best effort');
  assert.equal(effect.payload.resolvedText, text);
  assert.equal(saved.state.voice.poi.text, text);
  assert.equal(saved.state.voice.poi.error, 'voice_provider_error');
  assert.equal(saved.state.voice.poiMemory.pre, text.slice(0, -1));
  f.restart();
  assert.deepEqual(f.manager.getExecutionSnapshot().state.voice, saved.state.voice);
});

test('POI text write failure prevents TTS and retries without another text request', async t => {
  let fail = false, textCalls = 0, audioCalls = 0;
  const f = speechFixture(t, { voice: { audioEnabled: true }, fs: { ...fs, writeFileSync(...args) {
    if (fail) throw new Error('disk full'); return fs.writeFileSync(...args);
  } } });
  const effect = f.manager.getExecutionSnapshot().state.effects.find(e => e.type === 'voice.poi');
  const service = createTrackerVoiceService({ provider: 'openai', apiKey: 'test-key', fetchRemote: async url => {
    if (url.includes('/audio/speech')) { audioCalls++; return { ok: true, arrayBuffer: async () => Buffer.from('audio') }; }
    textCalls++; return { ok: true, json: async () => ({ choices: [{ message: { content: 'Dort liegt die Eisenbahn.' } }] }) };
  } });
  const handler = createTrackerMissionBoardingVoice({ authorityManager: f.manager, voiceService: service });
  fail = true;
  assert.equal((await handler.dispatch(speechRequest(f, effect))).status, 'pending');
  assert.equal(service.get(effect.effectId).status, 'text_blocked');
  assert.equal(audioCalls, 0);
  assert.equal(f.manager.getExecutionSnapshot().state.voice.poiMemory, undefined);
  fail = false;
  assert.equal((await handler.dispatch(speechRequest(f, effect))).ok, true);
  assert.equal(textCalls, 1);
  assert.equal(audioCalls, 1);
  assert.equal(f.manager.getExecutionSnapshot().state.voice.poiMemory.pre, 'Dort liegt die Eisenbahn');
});

test('POI restarts between text and audio using the authority text and original effect ID', async t => {
  const f = speechFixture(t, { voice: { audioEnabled: true } });
  const effect = f.manager.getExecutionSnapshot().state.effects.find(e => e.type === 'voice.poi');
  let finishOldAudio, audioStarted = false, textCalls = 0;
  const text = 'Der Fluss verläuft neben der Bahnlinie.';
  const oldService = createTrackerVoiceService({ provider: 'openai', apiKey: 'test-key', fetchRemote: async url => {
    if (!url.includes('/audio/speech')) { textCalls++; return { ok: true, json: async () => ({ choices: [{ message: { content: text } }] }) }; }
    audioStarted = true;
    return new Promise(resolve => { finishOldAudio = () => resolve({ ok: true, arrayBuffer: async () => Buffer.from('old-audio') }); });
  } });
  const oldHandler = createTrackerMissionBoardingVoice({ authorityManager: f.manager, voiceService: oldService });
  const pending = oldHandler.dispatch(speechRequest(f, effect));
  await waitUntil(() => audioStarted);
  oldService.cancel(effect.effectId, 'test-process-stop');
  f.restart();
  const restored = f.manager.getExecutionSnapshot().state.effects.find(e => e.effectId === effect.effectId);
  assert.equal(restored.payload.resolvedText, text);
  const service = createTrackerVoiceService({ provider: 'openai', apiKey: 'test-key', fetchRemote: async (url, options) => {
    assert.ok(url.includes('/audio/speech'), 'confirmed text must not be regenerated');
    assert.equal(JSON.parse(options.body).input, text);
    return { ok: true, arrayBuffer: async () => Buffer.from('new-audio') };
  } });
  const handler = createTrackerMissionBoardingVoice({ authorityManager: f.manager, voiceService: service });
  assert.equal((await handler.dispatch(speechRequest(f, restored))).ok, true);
  assert.equal(service.get(effect.effectId).text, text);
  assert.equal(textCalls, 1);
  finishOldAudio(); await pending;
});

test('late POI text after abort cannot commit memory or start TTS', async t => {
  const f = speechFixture(t, { voice: { audioEnabled: true } });
  const effect = f.manager.getExecutionSnapshot().state.effects.find(e => e.type === 'voice.poi');
  let finishText, textStarted = false, audioCalls = 0;
  const service = createTrackerVoiceService({ provider: 'openai', apiKey: 'test-key', fetchRemote: async url => {
    if (url.includes('/audio/speech')) { audioCalls++; return { ok: false, status: 503 }; }
    textStarted = true;
    return new Promise(resolve => { finishText = () => resolve({ ok: true,
      json: async () => ({ choices: [{ message: { content: 'Verspäteter Text.' } }] }) }); });
  } });
  const handler = createTrackerMissionBoardingVoice({ authorityManager: f.manager, voiceService: service });
  const pending = handler.dispatch(speechRequest(f, effect));
  await waitUntil(() => textStarted);
  const s = f.manager.getExecutionSnapshot();
  assert.equal(f.manager.abortExecutionRun({ missionId: s.missionId, runId: s.runId,
    expectedRevision: s.authorityRevision, commandId: 'abort-before-text' }).ok, true);
  finishText();
  assert.equal((await pending).voiceStatus, 'mission_end');
  assert.equal(audioCalls, 0);
  assert.equal(f.manager.getExecutionSnapshot(), null);
});

test('muted POI speech commits text without an audio request', async t => {
  const f = speechFixture(t);
  const effect = f.manager.getExecutionSnapshot().state.effects.find(e => e.type === 'voice.poi');
  const service = createTrackerVoiceService({ provider: 'openai', apiKey: 'test-key', fetchRemote: async url => {
    assert.equal(url.includes('/audio/speech'), false);
    return { ok: true, json: async () => ({ choices: [{ message: { content: 'Das Ziel liegt voraus.' } }] }) };
  } });
  const handler = createTrackerMissionBoardingVoice({ authorityManager: f.manager, voiceService: service });
  const result = await handler.dispatch(speechRequest(f, effect));
  assert.equal(result.voiceStatus, 'audio_disabled');
  assert.equal(f.manager.getExecutionSnapshot().state.voice.poiMemory.pre, 'Das Ziel liegt voraus');
  assert.equal(service.get(effect.effectId).audioAvailable, false);
});

test('POI effect runner leaves scene effects gated and duplicate ACKs do not change memory', async t => {
  const f = speechFixture(t);
  const runner = createTrackerMissionEffectRunner({ authorityManager: f.manager,
    handlers: { 'voice.poi': () => ({ ok: true, status: 'completed', voiceOutcome: {
      schema: 'ga.mission-voice-outcome.v1', text: 'Ein klarer Blick auf das Ziel.' } }) } });
  await runner.drain();
  const before = f.manager.getExecutionSnapshot();
  const voice = before.state.effects.find(e => e.type === 'voice.poi');
  assert.equal(voice.status, 'completed');
  assert.equal((await runner.acknowledge({ effectId: voice.effectId, status: 'completed', result: {
    schema: 'ga.mission-voice-outcome.v1', text: 'Falsche Wiederholung.' } })).status, 'noop');
  assert.equal(f.manager.getExecutionSnapshot().executionStateHash, before.executionStateHash);
  const scene = before.state.effects.find(e => e.type.startsWith('scene.'));
  assert.equal((await runner.acknowledge({ effectId: scene.effectId, status: 'completed' })).error, 'mission_execution_recipe_not_enabled');
});

test('POI follows APT no-claim recovery instead of waiting for a nonexistent playback owner', async t => {
  const f = speechFixture(t, { voice: { audioEnabled: true } });
  const effect = f.manager.getExecutionSnapshot().state.effects.find(e => e.type === 'voice.poi');
  let cancelled = '';
  const handler = createTrackerMissionBoardingVoice({ authorityManager: f.manager, getAudioPlaybackCandidates: () => 2,
    voiceService: { publicState: () => ({ configured: true }), request: () => {},
      wait: async () => ({ status: 'ready', text: 'Das Objekt liegt voraus.', audioAvailable: true }),
      activatePlayback: () => {}, waitForPlaybackClaim: async () => ({ claimed: false }),
      waitForPlayback: async () => assert.fail('no client claimed audio'),
      cancel: (_id, reason) => { cancelled = reason; } } });
  const result = await handler.dispatch(speechRequest(f, effect));
  assert.equal(result.voiceStatus, 'no_audio_claim');
  assert.equal(result.voiceOutcome.status, 'warning');
  assert.equal(cancelled, 'boarding_voice_unclaimed', 'shared APT delivery policy');
  assert.equal(f.manager.getExecutionSnapshot().state.voice.poiMemory.pre, 'Das Objekt liegt voraus');
});

test('late POI generation cannot activate playback after the mission was removed', async t => {
  const f = speechFixture(t);
  const effect = f.manager.getExecutionSnapshot().state.effects.find(e => e.type === 'voice.poi');
  let requested = null, resolveGeneration, activations = 0;
  const handler = createTrackerMissionBoardingVoice({ authorityManager: f.manager,
    voiceService: { publicState: () => ({ configured: true }), request: value => { requested = value; },
      wait: () => new Promise(resolve => { resolveGeneration = resolve; }),
      activatePlayback: () => activations++, cancel: () => {} } });
  const running = handler.dispatch(speechRequest(f, effect));
  await waitUntil(() => requested);
  const s = f.manager.getExecutionSnapshot();
  assert.equal(f.manager.abortExecutionRun({ missionId: s.missionId, runId: s.runId,
    expectedRevision: s.authorityRevision, commandId: 'abort-during-generation' }).ok, true);
  resolveGeneration({ status: 'ready', text: 'Verspätete Ansage.', audioAvailable: true });
  assert.equal((await running).voiceStatus, 'mission_end');
  assert.equal(activations, 0);
  assert.equal(requested.isPlaybackAllowed(), false);
});

test('failed task persistence retains the prepared inspection choice through retry', t => {
  let fail = false;
  const random = t.mock.method(Math, 'random', () => .01);
  const pax = { ...recipe().passenger, targetDwellMin: .01 };
  const f = fixture(t, { recipe: recipe({ taskDomain: 'inspection_infra', passenger: pax,
    voiceContext: voiceContext({ taskDomain: 'inspection_infra', passenger: pax, inspectionMeta: { objectName: 'Brücke' } }) }),
    fs: { ...fs, writeFileSync(...args) { if (fail) throw new Error('disk full'); return fs.writeFileSync(...args); } } });
  f.driver.observeTelemetry(sample(1000));
  fail = true;
  assert.equal(f.driver.observeTelemetry(sample(2000)).ok, false);
  random.mock.mockImplementation(() => .99);
  fail = false;
  assert.equal(f.driver.observeTelemetry(sample(2000)).ok, true);
  assert.equal(f.manager.getExecutionSnapshot().state.voice.poiMemory.inspectionOutcome, 'clear');
  const cue = f.manager.getExecutionSnapshot().state.effects.find(e => e.payload.prompt === '_poiSatisfiedPrompt');
  assert.match(cue.payload.resolvedRecipe.prompt, /keinen relevanten Schaden/);
});

test('browser and tracker replay the same POI text memory and resolved prompt hash', async t => {
  const f = speechFixture(t);
  const effect = f.manager.getExecutionSnapshot().state.effects.find(e => e.type === 'voice.poi');
  f.apply('POI_VOICE_TEXT_READY', { effectId: effect.effectId, text: 'Die Eisenbahn liegt neben dem Ziel.' });
  const bundle = f.manager.getActiveRun({ includeBundle: true }).resumeBundle.executionReplay;
  const browser = vm.createContext({});
  for (const filename of ['mission-manifest-core.js', 'mission-start-core.js', 'mission-payload-core.js',
    'mission-compliance-domain-core.js', 'mission-poi-task-core.js', 'mission-poi-voice-core.js', 'mission-execution-core.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', filename), 'utf8'), browser);
  }
  const replay = browser.GAMissionExecutionCore.replay(bundle);
  assert.equal(replay.ok, true);
  assert.equal(replay.stateHash, f.manager.getExecutionSnapshot().executionStateHash);
  assert.equal(replay.state.voice.poiMemory.pre, 'Die Eisenbahn liegt neben dem Ziel');
});

for (const domain of ['sightseeing_tour', 'poi_learning_guide']) test(`${domain} spoken knowledge survives disk restore and browser replay before audio ACK`, t => {
  const context = voiceContext({ taskDomain: domain, knowledgeContext: { status: 'accept', title: 'Brücke', facts: [
    { topic: 'history', text: 'Die Brücke wurde im neunzehnten Jahrhundert als regionales Bauwerk errichtet.' },
    { topic: 'structure', text: 'An der Brücke sind mehrere markante Turmbauten aus der Umgebung deutlich erkennbar.' }
  ] } });
  const f = fixture(t, { recipe: recipe({ taskDomain: domain, voiceContext: context }) });
  f.driver.observeTelemetry(sample(1000, { lon: .04 }));
  const effect = f.manager.getExecutionSnapshot().state.effects.find(e => e.type === 'voice.poi');
  assert.ok(effect);
  f.apply('POI_VOICE_TEXT_READY', { effectId: effect.effectId, text: context.knowledgeContext.facts[0].text });
  const before = f.manager.getExecutionSnapshot();
  assert.match(before.state.voice.poiMemory.knowledgeSpoken, /neunzehnten Jahrhundert/);
  f.restart();
  assert.deepEqual(f.manager.getExecutionSnapshot().state.voice.poiMemory, before.state.voice.poiMemory);
  const browser = vm.createContext({});
  for (const filename of ['mission-manifest-core.js', 'mission-start-core.js', 'mission-payload-core.js',
    'mission-compliance-domain-core.js', 'mission-poi-task-core.js', 'mission-poi-voice-core.js', 'mission-execution-core.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', filename), 'utf8'), browser);
  }
  const result = browser.GAMissionExecutionCore.replay(f.manager.getActiveRun({ includeBundle: true }).resumeBundle.executionReplay);
  assert.equal(result.stateHash, before.executionStateHash);
});
