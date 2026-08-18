'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { createAptMissionTestLog } = require('./tracker-apt-mission-test-log.js');

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

test('automatic APT test log records every redacted checkpoint and a passing terminal summary', () => {
  const lines = [];
  const logger = createAptMissionTestLog({ filename: '/tmp/unused-apt-test.txt', write: line => lines.push(line) });
  logger.start({ trackerVersion: 'v366', trackerVersionCode: 366, runtimeChannel: 'alpha' });
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

  assert.equal(lines.filter(line => line.startsWith('APT_TEST_CHECKPOINT')).length, 3);
  assert.match(lines.join('\n'), /APT_TEST_END .*parity=PASS/);
  assert.match(lines.join('\n'), /events=4:MISSION_STARTED>5:AIRBORNE>12:MISSION_CLOSED/);
});

test('APT test log marks any earlier drift as failed and never records narrative payloads', () => {
  const lines = [];
  const logger = createAptMissionTestLog({ filename: '/tmp/unused-apt-test.txt', write: line => lines.push(line) });
  logger.observe(aptState({
    status: 'drift',
    reason: 'shadow_replay_drift',
    driftFields: ['phase'],
    privateStory: 'This private story must not be written.'
  }));
  logger.observe(aptState({ phase: 'closed', subphase: 'closed' }));

  assert.match(lines.join('\n'), /APT_TEST_END .*parity=FAIL/);
  assert.doesNotMatch(lines.join('\n'), /private story/i);
});

test('non-APT shadows and unapproved system lines stay outside the dedicated file', () => {
  const lines = [];
  const logger = createAptMissionTestLog({ filename: '/tmp/unused-apt-test.txt', write: line => lines.push(line) });
  assert.equal(logger.observe(aptState({ recipe: 'poi' })), false);
  assert.equal(logger.recordSystemLine('SECRET apiKey=never-log'), false);
  assert.equal(logger.recordSystemLine('TRACKER_RELAY_OPEN relay=cloudflare channel=alpha'), true);
  assert.deepEqual(lines, ['APT_TEST_SYSTEM TRACKER_RELAY_OPEN relay=cloudflare channel=alpha']);
});
