'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const executionCore = require('../mission-execution-core.js');
const { createMissionAuthorityManager } = require('./mission-authority-core.js');

function aptResumeBundle(overrides = {}) {
  const bundle = {
    version: 2,
    missionId: 'mission-apt-handoff',
    adapter: 'apt',
    descriptor: { primaryAdapter: 'apt' },
    missionState: {
      currentMissionData: {
        missionId: 'mission-apt-handoff',
        missionType: 'apt',
        start: 'EDTW',
        dest: 'EDTL'
      }
    },
    runtime: {
      version: 1,
      missionId: 'mission-apt-handoff',
      startPhase: 'planned',
      runtime: {
        missionId: 'mission-apt-handoff',
        phase: 'planned',
        active: false,
        closingPending: false
      },
      cargoManifest: {
        version: 6,
        key: 'manifest-apt-handoff',
        dispatchSignature: { scope: 'departure' },
        items: [
          {
            id: 'mission-passenger',
            itemType: 'passenger',
            required: true,
            status: 'loaded',
            passengerCount: 1,
            deliverAtDestination: true
          }
        ]
      }
    }
  };
  Object.assign(bundle, overrides);
  const executionReplay = executionCore.createExecutionBundle(bundle);
  const execution = executionCore.createReplayShadowEnvelope(executionReplay, {
    sourceRevision: 1,
    legacyBundle: bundle
  });
  return { ...bundle, executionReplay, execution };
}

function createFixture(t, options = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ga-execution-handoff-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const storageFile = path.join(directory, 'authority.json');
  let clock = 1000;
  let runCounter = 0;
  const managerOptions = {
    storageFile,
    now: () => ++clock,
    idFactory: () => `run-${++runCounter}`,
    ...options
  };
  return {
    storageFile,
    createManager(extra = {}) {
      return createMissionAuthorityManager({ ...managerOptions, ...extra });
    }
  };
}

function acquireApt(manager, bundle = aptResumeBundle()) {
  const replay = executionCore.replay(bundle.executionReplay);
  const acquired = manager.acquire({
    missionId: bundle.missionId,
    clientId: 'web-owner',
    stateHash: 'web-state-hash-1',
    resumeBundle: bundle
  });
  assert.equal(acquired.ok, true);
  return { acquired, bundle, replay };
}

function prepareRequest(run, replay, overrides = {}) {
  return {
    missionId: run.missionId,
    runId: run.runId,
    clientId: 'web-owner',
    expectedRevision: run.revision,
    expectedStateHash: run.stateHash,
    expectedExecutionStateHash: replay.stateHash,
    commandId: 'prepare-handoff-1',
    ...overrides
  };
}

test('APT execution handoff preparation requires exact run, revision and both state hashes', (t) => {
  const fixture = createFixture(t);
  const manager = fixture.createManager();
  const { acquired, replay } = acquireApt(manager);
  const run = acquired.activeRun;

  assert.equal(manager.prepareExecutionAuthority(prepareRequest(run, replay, {
    expectedRevision: run.revision - 1
  })).error, 'mission_revision_conflict');
  assert.equal(manager.prepareExecutionAuthority(prepareRequest(run, replay, {
    expectedStateHash: 'stale-web-state'
  })).error, 'mission_state_hash_conflict');
  assert.equal(manager.prepareExecutionAuthority(prepareRequest(run, replay, {
    expectedExecutionStateHash: 'stale-execution-state'
  })).error, 'mission_execution_state_hash_conflict');

  const prepared = manager.prepareExecutionAuthority(prepareRequest(run, replay));
  assert.equal(prepared.ok, true);
  assert.equal(prepared.sideEffect, false);
  assert.equal(prepared.executionAuthority, 'web');
  assert.equal(prepared.handoff.recipe, 'apt');
  assert.equal(prepared.handoff.phase, 'planned');
  assert.equal(prepared.activeRun.executionAuthority, 'web');
  assert.equal(prepared.activeRun.executionStateHash, replay.stateHash);
  assert.equal(prepared.activeRun.revision, run.revision + 1);
});

test('handoff preparation rejects snapshot-only, drifted, non-APT and already-started runs', (t) => {
  const fixture = createFixture(t);
  const cases = [
    {
      name: 'snapshot-only',
      mutate(bundle) { delete bundle.executionReplay; },
      error: 'mission_execution_replay_required'
    },
    {
      name: 'drifted',
      mutate(bundle) { bundle.execution.stateHash = 'drifted'; },
      error: 'mission_execution_shadow_drift'
    },
    {
      name: 'poi',
      mutate(bundle) {
        bundle.adapter = 'poi';
        bundle.descriptor.primaryAdapter = 'poi';
        bundle.executionReplay.recipe = 'poi';
        bundle.executionReplay.initialState.recipe = 'poi';
        bundle.execution = executionCore.createReplayShadowEnvelope(bundle.executionReplay, {
          sourceRevision: 1,
          legacyBundle: bundle
        });
      },
      error: 'mission_execution_recipe_not_enabled'
    },
    {
      name: 'already-started',
      mutate(bundle) {
        const events = [
          { eventId: 'prepare', type: 'PREPARE_REQUESTED', sequence: 1 },
          { eventId: 'boarding', type: 'BOARDING_STARTED', sequence: 2 },
          { eventId: 'load', type: 'LOAD_CONFIRMED', sequence: 3, payload: { cargo: bundle.runtime.cargoManifest } },
          { eventId: 'boarded', type: 'BOARDING_CONFIRMED', sequence: 4, payload: { cargo: bundle.runtime.cargoManifest } },
          { eventId: 'started', type: 'MISSION_STARTED', sequence: 5 }
        ];
        bundle.executionReplay.events = events.map((event, index) => executionCore.normalizeEvent(event, index + 1));
        bundle.runtime.runtime.phase = 'active';
        bundle.runtime.runtime.active = true;
        bundle.execution = executionCore.createReplayShadowEnvelope(bundle.executionReplay, {
          sourceRevision: 1,
          legacyBundle: bundle
        });
      },
      error: 'mission_execution_handoff_phase_not_safe'
    }
  ];

  for (const item of cases) {
    const bundle = aptResumeBundle();
    item.mutate(bundle);
    const manager = fixture.createManager({ storageFile: path.join(path.dirname(fixture.storageFile), `${item.name}.json`) });
    const replay = bundle.executionReplay ? executionCore.replay(bundle.executionReplay) : { stateHash: 'missing' };
    const acquired = manager.acquire({
      missionId: bundle.missionId,
      clientId: 'web-owner',
      stateHash: `web-${item.name}`,
      resumeBundle: bundle
    });
    const result = manager.prepareExecutionAuthority(prepareRequest(acquired.activeRun, replay));
    assert.equal(result.error, item.error, item.name);
    assert.equal(result.activeRun.executionAuthority, 'web', item.name);
  }
});

test('prepared handoff survives restart while commit stays disabled by default', (t) => {
  const fixture = createFixture(t);
  const manager = fixture.createManager();
  const { acquired, replay } = acquireApt(manager);
  const prepared = manager.prepareExecutionAuthority(prepareRequest(acquired.activeRun, replay));

  const reloaded = fixture.createManager();
  const recovered = reloaded.getActiveRun();
  assert.equal(recovered.executionHandoff.handoffId, prepared.handoff.handoffId);
  assert.equal(recovered.executionAuthority, 'web');
  const blocked = reloaded.commitExecutionAuthority({
    missionId: recovered.missionId,
    runId: recovered.runId,
    clientId: 'web-owner',
    expectedRevision: recovered.revision,
    expectedExecutionStateHash: recovered.executionStateHash,
    handoffId: recovered.executionHandoff.handoffId
  });
  assert.equal(blocked.status, 'blocked');
  assert.equal(blocked.error, 'mission_execution_authority_not_enabled');
  assert.equal(blocked.sideEffect, false);
});

test('explicitly enabled commit is atomic, blocks web snapshots and permits zero-event rollback', (t) => {
  const fixture = createFixture(t, { executionAuthorityEnabled: true });
  const manager = fixture.createManager();
  const { acquired, bundle, replay } = acquireApt(manager);
  const prepared = manager.prepareExecutionAuthority(prepareRequest(acquired.activeRun, replay));
  const committed = manager.commitExecutionAuthority({
    missionId: prepared.activeRun.missionId,
    runId: prepared.activeRun.runId,
    clientId: 'web-owner',
    expectedRevision: prepared.activeRun.revision,
    expectedExecutionStateHash: replay.stateHash,
    handoffId: prepared.handoff.handoffId,
    commandId: 'commit-handoff-1'
  });
  assert.equal(committed.ok, true);
  assert.equal(committed.executionAuthority, 'tracker');
  assert.equal(committed.activeRun.stateHash, replay.stateHash);

  const rejectedSnapshot = manager.updateSnapshot({
    missionId: committed.activeRun.missionId,
    runId: committed.activeRun.runId,
    clientId: 'web-owner',
    snapshotSequence: 2,
    stateHash: 'web-newer',
    resumeBundle: bundle
  });
  assert.equal(rejectedSnapshot.error, 'mission_execution_authority_tracker');

  const rolledBack = manager.rollbackExecutionAuthority({
    missionId: committed.activeRun.missionId,
    runId: committed.activeRun.runId,
    clientId: 'web-owner',
    expectedRevision: committed.activeRun.revision,
    expectedStateHash: committed.activeRun.stateHash,
    commandId: 'rollback-handoff-1'
  });
  assert.equal(rolledBack.ok, true);
  assert.equal(rolledBack.executionAuthority, 'web');
  assert.equal(rolledBack.activeRun.stateHash, 'web-state-hash-1');

  const acceptedSnapshot = manager.updateSnapshot({
    missionId: rolledBack.activeRun.missionId,
    runId: rolledBack.activeRun.runId,
    clientId: 'web-owner',
    snapshotSequence: 2,
    stateHash: 'web-state-hash-2',
    resumeBundle: bundle
  });
  assert.equal(acceptedSnapshot.ok, true);
  assert.equal(acceptedSnapshot.activeRun.executionAuthority, 'web');
});

test('an intervening web snapshot invalidates a prepared handoff', (t) => {
  const fixture = createFixture(t, { executionAuthorityEnabled: true });
  const manager = fixture.createManager();
  const { acquired, bundle, replay } = acquireApt(manager);
  const prepared = manager.prepareExecutionAuthority(prepareRequest(acquired.activeRun, replay));
  const refreshed = manager.updateSnapshot({
    missionId: prepared.activeRun.missionId,
    runId: prepared.activeRun.runId,
    clientId: 'web-owner',
    snapshotSequence: 2,
    stateHash: 'web-state-hash-2',
    resumeBundle: bundle
  });
  assert.equal(refreshed.ok, true);
  assert.equal(refreshed.activeRun.executionHandoff, null);
  const commit = manager.commitExecutionAuthority({
    missionId: refreshed.activeRun.missionId,
    runId: refreshed.activeRun.runId,
    clientId: 'web-owner',
    expectedRevision: refreshed.activeRun.revision,
    expectedExecutionStateHash: replay.stateHash,
    handoffId: prepared.handoff.handoffId
  });
  assert.equal(commit.error, 'mission_execution_handoff_conflict');
});

test('tracker-authority applies ordered semantic events idempotently and persists their state', (t) => {
  const fixture = createFixture(t, { executionAuthorityEnabled: true });
  const manager = fixture.createManager();
  const { acquired, replay } = acquireApt(manager);
  const prepared = manager.prepareExecutionAuthority(prepareRequest(acquired.activeRun, replay));
  const committed = manager.commitExecutionAuthority({
    missionId: prepared.activeRun.missionId,
    runId: prepared.activeRun.runId,
    clientId: 'web-owner',
    expectedRevision: prepared.activeRun.revision,
    expectedExecutionStateHash: replay.stateHash,
    handoffId: prepared.handoff.handoffId
  });
  const baseEventRequest = {
    missionId: committed.activeRun.missionId,
    runId: committed.activeRun.runId,
    expectedRevision: committed.activeRun.revision,
    expectedExecutionRevision: committed.activeRun.executionRevision,
    expectedExecutionStateHash: committed.activeRun.executionStateHash,
    commandId: 'execution-event-prepare'
  };

  const outOfOrder = manager.applyExecutionEvent({
    ...baseEventRequest,
    event: { eventId: 'evt-out-of-order', type: 'PREPARE_REQUESTED', sequence: 2 }
  });
  assert.equal(outOfOrder.error, 'mission_execution_event_sequence_conflict');

  const transitionBlocked = manager.applyExecutionEvent({
    ...baseEventRequest,
    event: { eventId: 'evt-start-too-early', type: 'MISSION_STARTED', sequence: 1 }
  });
  assert.equal(transitionBlocked.error, 'mission_execution_transition_blocked');

  const applied = manager.applyExecutionEvent({
    ...baseEventRequest,
    event: { eventId: 'evt-prepare', type: 'PREPARE_REQUESTED', sequence: 1, occurredAt: 1200 }
  });
  assert.equal(applied.ok, true);
  assert.equal(applied.stateChanged, true);
  assert.equal(applied.externalSideEffect, false);
  assert.equal(applied.activeRun.executionRevision, 1);
  assert.equal(applied.activeRun.phase, 'prepare');
  assert.equal(applied.effects.length, 1);
  assert.equal(applied.effects[0].type, 'scene.prepare');

  const duplicate = manager.applyExecutionEvent({
    ...baseEventRequest,
    event: { eventId: 'evt-prepare', type: 'PREPARE_REQUESTED', sequence: 1, occurredAt: 1200 }
  });
  assert.equal(duplicate.ok, true);
  assert.equal(duplicate.status, 'noop');
  assert.equal(duplicate.duplicate, true);
  assert.equal(duplicate.stateChanged, false);

  const duplicateConflict = manager.applyExecutionEvent({
    ...baseEventRequest,
    event: { eventId: 'evt-prepare', type: 'BOARDING_STARTED', sequence: 1, occurredAt: 1200 }
  });
  assert.equal(duplicateConflict.status, 'conflict');
  assert.equal(duplicateConflict.error, 'mission_execution_event_id_conflict');

  const reloaded = fixture.createManager({ executionAuthorityEnabled: true });
  const recovered = reloaded.getActiveRun({ includeBundle: true });
  assert.equal(recovered.executionAuthority, 'tracker');
  assert.equal(recovered.executionRevision, 1);
  assert.equal(recovered.phase, 'prepare');
  assert.equal(recovered.resumeBundle.executionReplay.events.at(-1).eventId, 'evt-prepare');
  assert.equal(executionCore.replay(recovered.resumeBundle.executionReplay).stateHash, recovered.executionStateHash);

  const rollback = reloaded.rollbackExecutionAuthority({
    missionId: recovered.missionId,
    runId: recovered.runId,
    clientId: 'web-owner',
    expectedRevision: recovered.revision,
    expectedStateHash: recovered.stateHash
  });
  assert.equal(rollback.status, 'blocked');
  assert.equal(rollback.error, 'mission_execution_rollback_not_safe');
});

test('persistence failure cannot acknowledge or retain a prepared handoff', () => {
  const logs = [];
  const manager = createMissionAuthorityManager({
    storageFile: '/virtual/authority.json',
    fs: {
      existsSync() { return false; },
      mkdirSync() {},
      writeFileSync() { throw new Error('disk-full'); },
      renameSync() {}
    },
    now: (() => {
      let clock = 1000;
      return () => ++clock;
    })(),
    idFactory: () => 'run-persist-failure',
    log: line => logs.push(line)
  });
  const { acquired, replay } = acquireApt(manager);
  const failed = manager.prepareExecutionAuthority(prepareRequest(acquired.activeRun, replay));
  assert.equal(failed.ok, false);
  assert.equal(failed.error, 'mission_execution_persist_failed');
  assert.equal(failed.sideEffect, false);
  assert.equal(failed.activeRun.revision, acquired.activeRun.revision);
  assert.equal(failed.activeRun.executionHandoff, null);
  assert.equal(manager.getActiveRun().executionHandoff, null);
  assert.equal(logs.some(line => line.includes('MISSION_AUTHORITY_PERSIST_ERROR disk-full')), true);
});
