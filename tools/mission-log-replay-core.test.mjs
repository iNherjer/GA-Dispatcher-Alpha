import assert from 'node:assert/strict';
import test from 'node:test';
import replayCore from './mission-log-replay-core.js';

const fixtureLog = [
  '[2026-08-18T12:49:14.715Z] MISSION_TEST_BEGIN mission=mission-log run=run-log recipe=apt mode=event-replay',
  '[2026-08-18T12:49:15.209Z] MISSION_TEST_SYSTEM MISSION_EXECUTION_CHECKPOINT mission=mission-log run=run-log reason=intent:prepare_mission authorityRevision=7 executionRevision=1 phase=prepare stateHash=hash-1 effectsRequested=1 effectsCompleted=0 effectsFailed=0',
  '[2026-08-18T12:51:41.872Z] MISSION_TEST_SYSTEM MISSION_EXECUTION_CHECKPOINT mission=mission-log run=run-log reason=intent:start_mission authorityRevision=16 executionRevision=9 phase=active stateHash=hash-2 effectsRequested=0 effectsCompleted=2 effectsFailed=0',
  '[2026-08-18T12:52:03.746Z] MISSION_TEST_SYSTEM MISSION_EXECUTION_CHECKPOINT mission=mission-log run=run-log reason=telemetry:AIRBORNE authorityRevision=17 executionRevision=10 phase=enroute stateHash=hash-3 effectsRequested=0 effectsCompleted=2 effectsFailed=0',
  '[2026-08-18T12:53:14.059Z] MISSION_TEST_SYSTEM MISSION_EXECUTION_CHECKPOINT mission=mission-log run=run-log reason=telemetry:TOUCHDOWN authorityRevision=18 executionRevision=11 phase=enroute stateHash=hash-4 effectsRequested=0 effectsCompleted=2 effectsFailed=0',
  '[2026-08-18T12:53:17.286Z] MISSION_TEST_SYSTEM MISSION_EXECUTION_CHECKPOINT mission=mission-log run=run-log reason=telemetry:GROUND_STILL authorityRevision=19 executionRevision=12 phase=end_unloading stateHash=hash-5 effectsRequested=0 effectsCompleted=2 effectsFailed=0',
  '[2026-08-18T12:53:47.473Z] MISSION_TEST_SYSTEM MISSION_EXECUTION_CHECKPOINT mission=mission-log run=run-log reason=intent:set_manifest_item authorityRevision=20 executionRevision=13 phase=end_unloading stateHash=hash-6 effectsRequested=0 effectsCompleted=2 effectsFailed=0',
  '[2026-08-18T12:55:40.160Z] MISSION_TEST_SYSTEM MISSION_EXECUTION_CHECKPOINT mission=mission-log run=run-log reason=intent:confirm_unload authorityRevision=31 executionRevision=22 phase=end_ready stateHash=hash-7 effectsRequested=5 effectsCompleted=3 effectsFailed=0',
  '[2026-08-18T12:55:51.016Z] MISSION_TEST_SYSTEM MISSION_EXECUTION_CHECKPOINT mission=mission-log run=run-log reason=intent:request_close authorityRevision=32 executionRevision=23 phase=closing stateHash=hash-8 effectsRequested=6 effectsCompleted=3 effectsFailed=0'
].join('\n');

test('mission test log parser extracts a monotonic recorded APT profile', () => {
  const parsed = replayCore.parseMissionTestLog(fixtureLog);
  const run = replayCore.selectReplayRun(parsed);
  const analysis = replayCore.analyzeRun(run);
  assert.equal(run.missionId, 'mission-log');
  assert.equal(run.checkpoints.length, 8);
  assert.equal(analysis.recipe, 'apt');
  assert.equal(analysis.lastPhase, 'closing');
  assert.deepEqual(analysis.missingReasons, []);
  assert.deepEqual(analysis.revisionRegressions, []);
  assert.equal(analysis.recordedCompliance, false);
  assert.equal(analysis.recordedTerminal, false);
});

test('recorded timing anchors drive the current compliance tail without effects or restart drift', () => {
  const run = replayCore.selectReplayRun(replayCore.parseMissionTestLog(fixtureLog));
  const report = replayCore.simulateComplianceReplay(run);
  assert.equal(report.simulation.finalPhase, 'closed');
  assert.equal(report.simulation.finalCompliancePhase, 'released');
  assert.equal(report.simulation.requestedEffects, 0);
  assert.equal(report.simulation.uiParity, true);
  assert.equal(report.simulation.restartChecks, report.simulation.eventCount);
  assert.equal(report.simulation.duplicateChecks, report.simulation.eventCount);
  assert.deepEqual(report.simulation.effectDispatches.map(entry => entry.type), [
    'cargo.unload_confirmed',
    'voice.farewell',
    'voice.compliance_request',
    'voice.compliance_result',
    'scene.compliance_departure',
    'scene.compliance_visit',
    'mission.close_requested'
  ]);
  assert.ok(report.limitations.includes('compliance_branch_is_synthetic_force'));
  assert.ok(report.limitations.includes('source_recording_ends_before_terminal_close'));
});
