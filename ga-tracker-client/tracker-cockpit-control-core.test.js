'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { createTrackerCockpitControl } = require('./tracker-cockpit-control-core');

function fixture(options = {}) {
  let clock = 1000;
  let sequence = 0;
  let activeRun = {
    missionId: 'mission-a',
    runId: 'run-a',
    authority: 'tracker',
    revision: 7,
    phase: 'boarding',
    updatedAt: 900
  };
  const control = createTrackerCockpitControl({
    now: () => clock,
    sessionTtlMs: 15000,
    idFactory: prefix => `${prefix}-${++sequence}`,
    tokenFactory: () => `secret-${sequence}`,
    getMissionRun: () => activeRun,
    ...options
  });
  return {
    control,
    advance(ms) { clock += ms; },
    setRun(value) { activeRun = value; }
  };
}

test('cockpit sessions are short lived, role scoped and never expose their token publicly', () => {
  const app = fixture();
  const registered = app.control.register({
    clientId: 'toolbar-one',
    role: 'toolbar',
    appVersion: '0.1.0',
    capabilities: ['mission.snapshot.v2', 'bad capability'],
    audioPlaybackEnabled: true
  });
  assert.equal(registered.ok, true);
  assert.equal(registered.session.audioPlaybackEnabled, true);
  assert.equal(registered.sessionToken, 'secret-1');
  assert.deepEqual(registered.session.capabilities, ['mission.snapshot.v2']);
  assert.doesNotMatch(JSON.stringify(app.control.publicState()), /secret-1/);
  assert.equal(app.control.publicState().audioPlaybackCandidates, 1);

  const heartbeat = app.control.heartbeat({
    sessionId: registered.session.sessionId,
    sessionToken: registered.sessionToken,
    audioPlaybackEnabled: false
  });
  assert.equal(heartbeat.ok, true);
  assert.equal(app.control.publicState().audioPlaybackCandidates, 0);

  app.advance(16000);
  assert.equal(app.control.publicState().activeCount, 0);
  assert.equal(app.control.heartbeat({
    sessionId: registered.session.sessionId,
    sessionToken: registered.sessionToken
  }).error, 'cockpit_session_required');
});

test('mission intents require session, allowlist, run and exact revision while migration stays read-only', async () => {
  const app = fixture();
  const registered = app.control.register({ clientId: 'efb-one', role: 'efb' });
  const base = {
    sessionId: registered.session.sessionId,
    sessionToken: registered.sessionToken,
    commandId: 'cmd-1',
    intent: 'confirm_load',
    missionId: 'mission-a',
    runId: 'run-a',
    expectedRevision: 7,
    payload: { cargoId: 'cargo-1' }
  };
  const blocked = await app.control.submitIntent(base);
  assert.equal(blocked.error, 'mission_intents_read_only');
  assert.equal(blocked.executionAuthority, 'web');
  assert.equal(blocked.sideEffect, false);

  const duplicate = await app.control.submitIntent(base);
  assert.equal(duplicate.duplicate, true);
  assert.equal(duplicate.error, 'mission_intents_read_only');
  assert.equal((await app.control.submitIntent({ ...base, payload: { cargoId: 'cargo-2' } })).error, 'command_id_conflict');
  assert.equal((await app.control.submitIntent({ ...base, commandId: 'cmd-2', expectedRevision: 6 })).error, 'mission_revision_conflict');
  assert.equal((await app.control.submitIntent({ ...base, commandId: 'cmd-3', intent: 'set_phase' })).error, 'mission_intent_not_allowed');
});

test('an enabled tracker executor receives only the normalized intent and controller session', async () => {
  const executed = [];
  const app = fixture({
    executionAuthority: 'tracker',
    executeIntent: async intent => {
      executed.push(intent);
      return { ok: true, status: 'ok', sideEffect: true, activeRun: { missionId: 'mission-a', runId: 'run-a', revision: 8 } };
    }
  });
  const registered = app.control.register({ clientId: 'web-one', role: 'web' });
  const result = await app.control.submitIntent({
    sessionId: registered.session.sessionId,
    sessionToken: registered.sessionToken,
    commandId: 'cmd-start',
    intent: 'start_mission',
    missionId: 'mission-a',
    runId: 'run-a',
    expectedRevision: 7,
    payload: { ignoredTopLevel: true }
  });
  assert.equal(result.ok, true);
  assert.equal(executed.length, 1);
  assert.equal(executed[0].controllerSession.role, 'web');
  assert.equal(executed[0].expectedRevision, 7);
  assert.equal(app.control.publicState().missionIntentsEnabled, true);
});

test('one cockpit session cannot flood mission intents', async () => {
  const app = fixture();
  const registered = app.control.register({ clientId: 'web-rate', role: 'web' });
  const base = {
    sessionId: registered.session.sessionId,
    sessionToken: registered.sessionToken,
    intent: 'confirm_load',
    missionId: 'mission-a',
    runId: 'run-a',
    expectedRevision: 7
  };
  for (let index = 0; index < 60; index += 1) {
    assert.equal((await app.control.submitIntent({ ...base, commandId: `rate-${index}` })).error, 'mission_intents_read_only');
  }
  const limited = await app.control.submitIntent({ ...base, commandId: 'rate-overflow' });
  assert.equal(limited.status, 'rate_limited');
  assert.equal(limited.error, 'mission_intent_rate_limited');
  assert.equal(limited.sideEffect, false);
});
