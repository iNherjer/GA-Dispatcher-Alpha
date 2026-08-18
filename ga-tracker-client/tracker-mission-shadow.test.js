'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const executionCore = require('../mission-execution-core.js');
const shadowJournal = require('../mission-execution-shadow-journal.js');
const { createTrackerMissionShadow } = require('./tracker-mission-shadow.js');

function resumeBundle() {
  return {
    version: 2,
    missionId: 'mission-shadow-a',
    adapter: 'apt',
    missionState: {
      currentMissionData: {
        missionId: 'mission-shadow-a',
        missionStory: 'This text must never enter the shadow diagnostic log.'
      }
    },
    runtime: {
      version: 1,
      missionId: 'mission-shadow-a',
      startPhase: 'boarding',
      runtime: {
        missionId: 'mission-shadow-a',
        phase: 'boarding',
        active: false,
        closingPending: false
      },
      cargoManifest: {
        version: 6,
        key: 'manifest-shadow-a',
        dispatchSignature: { scope: 'departure', by: 'Private Pilot' },
        items: [
          { id: 'mission-passenger', label: 'Private Passenger', itemType: 'passenger', required: true, status: 'loaded', passengerCount: 1 },
          { id: 'cargo-one', storyName: 'Private Cargo Label', itemType: 'cargo', required: true, status: 'loaded', weightLbs: 12 }
        ]
      },
      complianceInspection: null
    }
  };
}

test('tracker shadow independently projects an accepted browser envelope and reports a match', () => {
  const logs = [];
  let clock = 1000;
  const shadow = createTrackerMissionShadow({ now: () => ++clock, log: line => logs.push(line) });
  const bundle = resumeBundle();
  bundle.execution = executionCore.createShadowEnvelope(bundle, { sourceRevision: 4 });
  const status = shadow.observe({
    missionId: bundle.missionId,
    runId: 'run-shadow-a',
    authorityRevision: 5,
    resumeBundle: bundle
  });
  assert.equal(status.status, 'match');
  assert.equal(status.sideEffects, false);
  assert.equal(status.mode, 'snapshot-shadow');
  assert.equal(status.sourceRevision, 4);
  assert.equal(status.authorityRevision, 5);
  assert.equal(status.browserStateHash, status.trackerStateHash);
  assert.deepEqual(status.driftFields, []);
  assert.equal(logs.some(line => line.includes('MISSION_SHADOW_MATCH')), true);
  assert.doesNotMatch(logs.join('\n'), /Private Pilot|Private Passenger|Private Cargo|never enter/);
});

test('tracker independently replays the transported APT event bundle', () => {
  const planned = resumeBundle();
  planned.runtime.startPhase = 'planned';
  planned.runtime.runtime.phase = 'planned';
  planned.runtime.cargoManifest.dispatchSignature = null;
  planned.runtime.cargoManifest.items.forEach(item => { item.status = 'pending'; });
  const current = resumeBundle();
  const advanced = shadowJournal.advance(shadowJournal.create(planned), current, { occurredAt: 1200 });
  current.executionReplay = advanced.bundle;
  current.execution = executionCore.createReplayShadowEnvelope(advanced.bundle, {
    sourceRevision: 6,
    legacyBundle: current
  });
  const shadow = createTrackerMissionShadow();
  const status = shadow.observe({
    missionId: current.missionId,
    runId: 'run-event-replay',
    authorityRevision: 7,
    resumeBundle: current
  });
  assert.equal(status.status, 'match');
  assert.equal(status.mode, 'event-replay');
  assert.deepEqual(status.driftFields, []);
  assert.deepEqual(status.legacyDriftFields, []);
  assert.deepEqual(status.eventTrace.map(event => event.type), [
    'PREPARE_REQUESTED',
    'BOARDING_STARTED',
    'CARGO_STATE_CHANGED'
  ]);
});

test('tracker reports event replay drift from the current legacy authority projection separately', () => {
  const current = resumeBundle();
  const replayBundle = executionCore.createExecutionBundle(current);
  current.runtime.runtime.phase = 'active';
  current.runtime.runtime.active = true;
  current.runtime.runtime.startedAt = 1234;
  current.executionReplay = replayBundle;
  current.execution = executionCore.createReplayShadowEnvelope(replayBundle, {
    sourceRevision: 8,
    legacyBundle: current
  });
  const shadow = createTrackerMissionShadow();
  const status = shadow.observe({ missionId: current.missionId, runId: 'run-legacy-drift', authorityRevision: 9, resumeBundle: current });
  assert.equal(status.status, 'drift');
  assert.equal(status.reason, 'shadow_legacy_projection_drift');
  assert.equal(status.mode, 'event-replay');
  assert.equal(status.legacyDriftFields.includes('phase'), true);
  assert.equal(status.driftFields.includes('legacy:phase'), true);
  assert.equal(status.browserStateHash, status.trackerStateHash);
});

test('terminal release replay compares browser and tracker without treating pre-release closing as drift', () => {
  const current = resumeBundle();
  current.runtime.startPhase = 'boarded';
  current.runtime.runtime.phase = 'closing';
  current.runtime.runtime.active = false;
  current.runtime.runtime.closingPending = true;
  current.runtime.runtime.startedAt = 1234;
  current.runtime.cargoManifest.dispatchSignature = { scope: 'arrival' };
  current.runtime.cargoManifest.items.forEach(item => { item.status = 'unloaded'; });
  const replayBundle = executionCore.createExecutionBundle(current, {
    events: [{ eventId: 'terminal-close', type: 'MISSION_CLOSED', sequence: 1, occurredAt: 2000 }]
  });
  current.executionReplay = replayBundle;
  current.execution = executionCore.createReplayShadowEnvelope(replayBundle, {
    sourceRevision: 10,
    legacyComparison: 'terminal_release'
  });
  const shadow = createTrackerMissionShadow();
  const status = shadow.observe({ missionId: current.missionId, runId: 'run-terminal', authorityRevision: 11, resumeBundle: current });
  assert.equal(status.status, 'match');
  assert.equal(status.mode, 'event-replay');
  assert.equal(status.phase, 'closed');
  assert.deepEqual(status.legacyDriftFields, []);
});

test('tracker shadow reports field-level drift without executing or copying browser effects', () => {
  const logs = [];
  const shadow = createTrackerMissionShadow({ log: line => logs.push(line) });
  const bundle = resumeBundle();
  const browserEnvelope = executionCore.createShadowEnvelope(bundle, { sourceRevision: 9 });
  browserEnvelope.phase = 'closed';
  browserEnvelope.stateHash = 'mex1-browser-corrupt';
  browserEnvelope.effects = [{ effectId: 'do-not-run', type: 'mission.close_requested', status: 'requested', payload: { secret: 'never-log' } }];
  bundle.execution = browserEnvelope;
  const status = shadow.observe({ missionId: bundle.missionId, runId: 'run-shadow-a', authorityRevision: 10, resumeBundle: bundle });
  assert.equal(status.status, 'drift');
  assert.equal(status.sideEffects, false);
  assert.deepEqual(status.driftFields, ['phase', 'effects', 'stateHash']);
  assert.equal(logs.some(line => line.includes('fields=phase,effects,stateHash')), true);
  assert.doesNotMatch(JSON.stringify(status), /do-not-run|never-log/);
  assert.doesNotMatch(logs.join('\n'), /do-not-run|never-log/);
});

test('legacy snapshots remain available to the tracker while shadow comparison is unavailable', () => {
  const shadow = createTrackerMissionShadow();
  const status = shadow.observe({ missionId: 'mission-shadow-a', runId: 'run-legacy', authorityRevision: 2, resumeBundle: resumeBundle() });
  assert.equal(status.status, 'unavailable');
  assert.equal(status.reason, 'browser_shadow_envelope_missing');
  assert.equal(status.sideEffects, false);
  assert.equal(status.comparisonCount, 1);
});

test('stale, conflicting or rejected authority results cannot advance shadow diagnostics', () => {
  const shadow = createTrackerMissionShadow();
  const bundle = resumeBundle();
  bundle.execution = executionCore.createShadowEnvelope(bundle, { sourceRevision: 1 });
  const run = { missionId: bundle.missionId, runId: 'run-shadow-a', revision: 2, resumeBundle: bundle };
  assert.equal(shadow.observeAuthorityResult({ ok: true, status: 'noop', reason: 'stale_snapshot' }, run).status, 'idle');
  assert.equal(shadow.observeAuthorityResult({ ok: false, status: 'conflict' }, run).status, 'idle');
  assert.equal(shadow.observeAuthorityResult({ ok: true, status: 'ok' }, run).status, 'match');
  const count = shadow.publicState().comparisonCount;
  assert.equal(shadow.observeAuthorityResult({ ok: true, status: 'noop' }, run).comparisonCount, count);
});

test('shadow history is bounded and public trace is redacted', () => {
  let clock = 0;
  const shadow = createTrackerMissionShadow({ historyLimit: 4, now: () => ++clock });
  for (let index = 0; index < 7; index += 1) {
    const bundle = resumeBundle();
    bundle.execution = executionCore.createShadowEnvelope(bundle, {
      sourceRevision: index,
      events: [
        { eventId: `raw-sensitive-event-${index}`, type: 'AUTHORITATIVE_SNAPSHOT_IMPORTED', sequence: index + 1, occurredAt: 100 + index, payload: { resumeBundle: bundle } }
      ]
    });
    shadow.observe({ missionId: bundle.missionId, runId: 'run-shadow-a', authorityRevision: index + 1, resumeBundle: bundle });
  }
  assert.equal(shadow.getHistory().length, 4);
  const status = shadow.publicState();
  assert.equal(status.comparisonCount, 4);
  assert.equal(status.eventTrace.length, 1);
  assert.equal(status.eventTrace[0].type, 'AUTHORITATIVE_SNAPSHOT_IMPORTED');
  assert.match(status.eventTrace[0].traceId, /^mex1-/);
  assert.doesNotMatch(JSON.stringify(status), /raw-sensitive-event/);
});
