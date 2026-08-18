'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { createMissionTestLog } = require('./tracker-apt-mission-test-log.js');

function aptState(patch = {}) {
  return {
    recipe: 'apt',
    mode: 'event-replay',
    status: 'match',
    reason: 'shadow_replay_match',
    missionId: 'mission-apt-test',
    runId: 'run-apt-test',
    authorityRevision: 2,
    sourceRevision: 1,
    phase: 'planned',
    subphase: 'accepted',
    browserStateHash: 'mex1-equal',
    trackerStateHash: 'mex1-equal',
    driftFields: [],
    legacyDriftFields: [],
    eventTrace: [],
    observedAt: 1000,
    ...patch
  };
}

test('automatic mission test log records every redacted APT replay checkpoint and a passing release summary', () => {
  const lines = [];
  const logger = createMissionTestLog({ filename: '/tmp/unused-mission-test.txt', write: line => lines.push(line) });
  logger.start({ trackerVersion: 'v368', trackerVersionCode: 368, runtimeChannel: 'alpha' });
  logger.observe(aptState());
  logger.observe(aptState({
    authorityRevision: 3,
    sourceRevision: 2,
    phase: 'enroute',
    subphase: 'outbound_flight',
    eventTrace: [{ type: 'MISSION_STARTED', sequence: 4 }, { type: 'AIRBORNE', sequence: 5 }]
  }));
  logger.observe(aptState({
    authorityRevision: 4,
    sourceRevision: 3,
    phase: 'closed',
    subphase: 'closed',
    eventTrace: [{ type: 'MISSION_CLOSED', sequence: 12 }]
  }));
  logger.recordSystemLine('MISSION_PROTOCOL_RESULT type=mission_authority_release status=ok error=none mission=set run=set bundle=1 adapter=apt execution=1 replay=1');

  assert.equal(lines.filter(line => line.startsWith('MISSION_TEST_CHECKPOINT')).length, 3);
  assert.match(lines.join('\n'), /MISSION_TEST_END .*transport=PASS shadow=MATCH parity=PASS/);
  assert.match(lines.join('\n'), /events=4:MISSION_STARTED>5:AIRBORNE>12:MISSION_CLOSED/);
});

test('mission test log marks any earlier APT replay drift as failed and never records narrative payloads', () => {
  const lines = [];
  const logger = createMissionTestLog({ filename: '/tmp/unused-mission-test.txt', write: line => lines.push(line) });
  logger.observe(aptState({
    status: 'drift',
    reason: 'shadow_replay_drift',
    driftFields: ['phase'],
    privateStory: 'This private story must not be written.'
  }));
  logger.observe(aptState({ phase: 'closed', subphase: 'closed' }));
  logger.recordSystemLine('MISSION_PROTOCOL_RESULT type=mission_authority_release status=ok error=none mission=set run=set bundle=1 adapter=apt execution=1 replay=1');

  assert.match(lines.join('\n'), /MISSION_TEST_END .*shadow=DRIFT parity=FAIL/);
  assert.doesNotMatch(lines.join('\n'), /private story/i);
});

test('non-APT snapshot shadows receive transport and shadow results without claiming replay parity', () => {
  const lines = [];
  const logger = createMissionTestLog({ filename: '/tmp/unused-mission-test.txt', write: line => lines.push(line) });
  assert.equal(logger.observe(aptState({ recipe: 'poi', mode: 'snapshot-shadow', phase: 'on_task' })), true);
  logger.recordSystemLine('MISSION_PROTOCOL_RESULT type=mission_authority_release status=ok error=none mission=set run=set bundle=1 adapter=poi execution=1 replay=0');
  assert.equal(logger.recordSystemLine('SECRET apiKey=never-log'), false);
  assert.equal(logger.recordSystemLine('TRACKER_RELAY_OPEN relay=cloudflare channel=alpha'), true);
  assert.match(lines.join('\n'), /MISSION_TEST_BEGIN .*recipe=poi mode=snapshot-shadow/);
  assert.match(lines.join('\n'), /MISSION_TEST_END .*recipe=poi mode=snapshot-shadow transport=PASS shadow=MATCH parity=NOT_APPLICABLE/);
  assert.doesNotMatch(lines.join('\n'), /apiKey/);
});

test('tracker execution checkpoints stay redacted and finalize the test without claiming browser parity', () => {
  const lines = [];
  const logger = createMissionTestLog({ filename: '/tmp/unused-mission-test.txt', write: line => lines.push(line) });
  logger.start({ trackerVersion: 'v369', trackerVersionCode: 369, runtimeChannel: 'alpha', executionRuntimeEnabled: true });
  logger.observe(aptState());
  logger.recordSystemLine('MISSION_EXECUTION_CHECKPOINT mission=mission-apt-test run=run-apt-test reason=intent:start_mission authorityRevision=9 executionRevision=7 phase=enroute stateHash=mex1-safe effectsRequested=0 effectsCompleted=2 effectsFailed=0');
  logger.recordSystemLine('MISSION_EXECUTION_FINALIZED mission=mission-apt-test run=run-apt-test');
  assert.match(lines.join('\n'), /executionRuntime=guarded/);
  assert.match(lines.join('\n'), /MISSION_TEST_SYSTEM MISSION_EXECUTION_CHECKPOINT .*phase=enroute/);
  assert.match(lines.join('\n'), /MISSION_TEST_END .*mode=tracker-execution .*parity=NOT_APPLICABLE .*completion=execution_finalized/);
  assert.doesNotMatch(lines.join('\n'), /briefing|apiKey|cargoText/);
});

test('repeating Render relay failures are summarized instead of flooding the test file', () => {
  const lines = [];
  let now = 1000;
  const logger = createMissionTestLog({
    filename: '/tmp/unused-mission-test.txt',
    write: line => lines.push(line),
    now: () => now,
    systemRepeatWindowMs: 60000
  });

  assert.equal(logger.recordSystemLine('TRACKER_RELAY_ERROR relay=render opened=no error=Unexpected server response: 503'), true);
  for (let index = 0; index < 10; index += 1) {
    now += 5000;
    assert.equal(logger.recordSystemLine('TRACKER_RELAY_ERROR relay=render opened=no error=Unexpected server response: 503'), false);
  }
  now = 61000;
  assert.equal(logger.recordSystemLine('TRACKER_RELAY_ERROR relay=render opened=no error=Unexpected server response: 503'), true);

  assert.equal(lines.length, 2);
  assert.match(lines[1], /^MISSION_TEST_SYSTEM_SUMMARY event=TRACKER_RELAY_ERROR relay=render repeats=11 windowMs=60000$/);
});

test('redacted mission protocol diagnostics are admitted to the dedicated file', () => {
  const lines = [];
  const logger = createMissionTestLog({ filename: '/tmp/unused-mission-test.txt', write: line => lines.push(line) });

  assert.equal(logger.recordSystemLine('MISSION_PROTOCOL_RECEIVED type=mission_authority_acquire mission=yes run=no adapter=apt execution=1 replay=1'), true);
  assert.equal(logger.recordSystemLine('MISSION_PROTOCOL_RESULT type=mission_authority_acquire status=ok error=none mission=yes run=yes bundle=1 adapter=apt execution=1 replay=1'), true);
  assert.equal(lines.length, 2);
});

test('ignored execution telemetry is admitted so field tests expose detector gating', () => {
  const lines = [];
  const logger = createMissionTestLog({ filename: '/tmp/unused-mission-test.txt', write: line => lines.push(line) });

  assert.equal(logger.recordSystemLine('MISSION_EXECUTION_TELEMETRY_IGNORED mission=set run=set phase=active reason=simulation_not_running onGround=1 gsKts=0.0 paused=0 menu=0 dialog=1'), true);
  assert.match(lines.join('\n'), /MISSION_TEST_SYSTEM MISSION_EXECUTION_TELEMETRY_IGNORED .*dialog=1/);
});

test('a rejected authority release keeps the run open for a successful retry', () => {
  const lines = [];
  const logger = createMissionTestLog({ filename: '/tmp/unused-mission-test.txt', write: line => lines.push(line) });
  logger.observe(aptState({ recipe: 'poi', mode: 'snapshot-shadow', phase: 'ready_to_close' }));
  logger.recordSystemLine('MISSION_PROTOCOL_RESULT type=mission_authority_release status=conflict error=mission_revision_conflict mission=set run=set bundle=1 adapter=poi execution=1 replay=0');
  assert.equal(lines.some(line => line.startsWith('MISSION_TEST_END')), false);
  logger.recordSystemLine('MISSION_PROTOCOL_RESULT type=mission_authority_release status=ok error=none mission=set run=set bundle=1 adapter=poi execution=1 replay=0');
  assert.equal(lines.filter(line => line.startsWith('MISSION_TEST_END')).length, 1);
});
