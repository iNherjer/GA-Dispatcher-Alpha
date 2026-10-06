'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeMissionVoiceScope, missionVoiceScope, createMissionVoiceScopeGuard } = require('./tracker-mission-voice-scope.js');

function fixture() {
  let run = { missionId: 'mission', runId: 'run', executionAuthority: 'tracker' };
  let snapshot = { missionId: 'mission', runId: 'run', recipe: 'apt', state: { phase: 'enroute', flags: { active: true } } };
  const allowed = createMissionVoiceScopeGuard({ getActiveRun: () => run, getExecutionSnapshot: () => snapshot, supportsExecutionRecipe: () => true });
  return { allowed, scope: { missionId: 'mission', runId: 'run', policy: 'flight' },
    get snapshot() { return snapshot; }, set snapshot(value) { snapshot = value; },
    get run() { return run; }, set run(value) { run = value; } };
}

test('mission scope rejects missing runs, different owners and authority transfer', () => {
  const f = fixture(); assert.equal(f.allowed(f.scope), true);
  f.snapshot = null; assert.equal(f.allowed(f.scope), false);
  assert.equal(f.allowed({ ...f.scope, policy: 'run' }), true, 'boarding does not require an active flight snapshot');
  f.run.runId = 'replacement'; assert.equal(f.allowed({ ...f.scope, policy: 'run' }), false);
  f.run.runId = 'run'; f.run.missionId = 'other'; assert.equal(f.allowed(f.scope), false);
  f.run.missionId = 'mission'; f.run.executionAuthority = 'web'; assert.equal(f.allowed(f.scope), false);
  f.run = null; assert.equal(f.allowed({ ...f.scope, policy: 'run' }), false);
});

test('flight voices stop during closing while run-owned Farewell remains allowed', () => {
  const f = fixture();
  for (const flag of ['closingPending', 'farewellStarted', 'farewellCompleted', 'unloadConfirmed']) {
    f.snapshot.state.flags[flag] = true;
    assert.equal(f.allowed(f.scope), false, flag);
    assert.equal(f.allowed({ ...f.scope, policy: 'run' }), true, flag);
    delete f.snapshot.state.flags[flag];
  }
  f.snapshot.state.phase = 'closing'; assert.equal(f.allowed(f.scope), false);
  f.snapshot.state.phase = 'planned'; f.snapshot.state.flags.active = false;
  assert.equal(f.allowed(f.scope), false); assert.equal(f.allowed({ ...f.scope, policy: 'run' }), true);
});

test('POI interaction exception and Bush passenger phases stay bounded to their recipes', () => {
  const f = fixture();
  f.snapshot.recipe = 'poi'; f.snapshot.state.flags.active = false;
  const poi = { ...f.scope, policy: 'poi', allowInactive: true };
  assert.equal(f.allowed(poi), true);
  f.snapshot.state.flags.closingPending = true; assert.equal(f.allowed(poi), false);
  delete f.snapshot.state.flags.closingPending;
  f.snapshot.recipe = 'apt'; assert.equal(f.allowed(poi), false);
  f.snapshot.state.trainingTask = { state: {} }; assert.equal(f.allowed({ ...poi, aptTraining: true }), true);
  f.snapshot.state.bushTask = { kind: 'pickup_return' }; f.snapshot.state.flags.active = true;
  assert.equal(f.allowed({ ...f.scope, policy: 'bush' }), true);
  f.snapshot.state.bushTask.kind = 'recon'; assert.equal(f.allowed({ ...f.scope, policy: 'bush' }), false);
  assert.equal(missionVoiceScope({ missionId: 'mission', runId: 'run', effect: { payload: { action: 'status' } } }, 'flight').allowInactive, undefined);
});

test('restored training instructions only remain valid for the current exercise and attempt', () => {
  const f = fixture(); f.snapshot.state.trainingTask = { state: { checkpoint: { procedureState: { activeState: {
    activeIndex: 1, exercises: [{}, { attempts: 2 }], active: { phase: 'instruction' }
  } } } } };
  const scope = { ...f.scope, policy: 'poi', aptTraining: true, trainingScope: '1:2:instruction' };
  assert.equal(f.allowed(scope), true);
  const state = f.snapshot.state.trainingTask.state.checkpoint.procedureState.activeState;
  state.active.phase = 'active'; assert.equal(f.allowed(scope), false);
  state.active.phase = 'instruction'; state.exercises[1].attempts = 3; assert.equal(f.allowed(scope), false);
  state.exercises[1].attempts = 2; state.activeIndex = 0; assert.equal(f.allowed(scope), false);
});

test('restored Fire and SAR hints expire or stop after confirmation, silent preload stays run-owned', () => {
  const f = fixture(); f.snapshot.recipe = 'poi'; f.snapshot.state.poiTask = {};
  const scope = { ...f.scope, policy: 'poi', sarSearchHint: true, expiresAt: Date.now() + 60000 };
  assert.equal(f.allowed(scope), true);
  assert.equal(f.allowed({ ...scope, expiresAt: Date.now() - 1000 }), false);
  f.snapshot.state.poiTask.sarSearchState = { found: { id: 'contact' } }; assert.equal(f.allowed(scope), false);
  assert.equal(f.allowed({ ...scope, policy: 'run' }), true, 'silent preload has not yet become a timed hint');
  const fire = { ...f.scope, policy: 'poi', fireSearchHint: true, expiresAt: Date.now() + 60000 };
  for (const state of ['smoke_confirmed', 'assessment_complete', 'false_alarm_rtb']) {
    f.snapshot.state.poiTask.fireState = { scenario: { state } }; assert.equal(f.allowed(fire), false);
  }
});

test('persisted scope normalization remains bounded and rejects invalid ownership', () => {
  assert.equal(normalizeMissionVoiceScope({ missionId: '', runId: 'run', policy: 'run' }), null);
  assert.equal(normalizeMissionVoiceScope({ missionId: 'mission', runId: 'run', policy: 'unknown' }), null);
  const normalized = normalizeMissionVoiceScope({ missionId: 'mission', runId: 'run', policy: 'run', unused: 'untrusted', trainingScope: 'x'.repeat(150) });
  assert.equal(normalized.trainingScope.length, 100); assert.equal(normalized.unused, undefined);
});
