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
  assert.equal((await app.control.submitIntent({ ...base, commandId: 'cmd-4', intent: 'request_voice_playback' })).error, 'mission_intent_not_allowed');
  assert.equal((await app.control.submitIntent({ ...base, commandId: 'cmd-5', intent: 'reset_mission' })).error, 'mission_intent_not_allowed');
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

test('a PIN-validated relay controller uses the same revision, dedupe and rate-limited intent path', async () => {
  const executed = [];
  const app = fixture({
    executionAuthority: 'tracker',
    executeIntent: async intent => {
      executed.push(intent);
      return { ok: true, status: 'ok', sideEffect: true, activeRun: { missionId: 'mission-a', runId: 'run-a', revision: 8 } };
    }
  });
  const request = {
    commandId: 'relay-start',
    intent: 'start_mission',
    missionId: 'mission-a',
    runId: 'run-a',
    expectedRevision: 7,
    deferEffects: true
  };
  const result = await app.control.submitTrustedIntent(request, {
    clientId: 'web-relay-one',
    role: 'web',
    appVersion: 'origin'
  });
  assert.equal(result.ok, true);
  assert.equal(executed.length, 1);
  assert.equal(executed[0].controllerSession.clientId, 'web-relay-one');
  assert.equal(executed[0].controllerSession.role, 'web');
  assert.equal(executed[0].deferEffects, true);
  assert.equal(app.control.publicState().roles.web, 1);

  const duplicate = await app.control.submitTrustedIntent(request, {
    clientId: 'web-relay-one',
    role: 'web'
  });
  assert.equal(duplicate.duplicate, true);
  assert.equal(executed.length, 1);
  assert.equal((await app.control.submitTrustedIntent({ ...request, commandId: 'relay-stale', expectedRevision: 6 }, {
    clientId: 'web-relay-one',
    role: 'web'
  })).error, 'mission_revision_conflict');
});

test('relay App and local EFB serialize against one authoritative run revision', async () => {
  let sessionSequence = 0;
  let run = {
    missionId: 'mission-shared',
    runId: 'run-shared',
    authority: 'tracker',
    executionAuthority: 'tracker',
    revision: 12,
    phase: 'boarding'
  };
  const control = createTrackerCockpitControl({
    now: () => 2000,
    idFactory: prefix => `${prefix}-shared-${++sessionSequence}`,
    tokenFactory: () => 'secret-shared',
    executionAuthority: 'tracker',
    getMissionRun: () => run,
    executeIntent: async request => {
      run = { ...run, revision: run.revision + 1, phase: request.intent === 'start_mission' ? 'active' : run.phase };
      return { ok: true, status: 'ok', sideEffect: true, activeRun: run };
    }
  });
  const efb = control.register({ clientId: 'efb-shared', role: 'efb' });
  const appResult = await control.submitTrustedIntent({
    commandId: 'app-start',
    intent: 'start_mission',
    missionId: run.missionId,
    runId: run.runId,
    expectedRevision: 12
  }, { clientId: 'app-shared', role: 'web' });
  assert.equal(appResult.activeRun.revision, 13);
  assert.equal(control.publicState().activeCount, 2);

  const staleEfb = await control.submitIntent({
    sessionId: efb.session.sessionId,
    sessionToken: efb.sessionToken,
    commandId: 'efb-stale',
    intent: 'confirm_load',
    missionId: run.missionId,
    runId: run.runId,
    expectedRevision: 12
  });
  assert.equal(staleEfb.error, 'mission_revision_conflict');
  const currentEfb = await control.submitIntent({
    sessionId: efb.session.sessionId,
    sessionToken: efb.sessionToken,
    commandId: 'efb-current',
    intent: 'confirm_load',
    missionId: run.missionId,
    runId: run.runId,
    expectedRevision: 13
  });
  assert.equal(currentEfb.ok, true);
  assert.equal(currentEfb.activeRun.revision, 14);
});

test('an EFB session can activate an exact cloud candidate when no run exists', async () => {
  let activeRun = null;
  const activated = [];
  const control = createTrackerCockpitControl({
    now: () => 1000,
    idFactory: () => 'cockpit-cloud',
    tokenFactory: () => 'secret-cloud',
    getMissionRun: () => activeRun,
    activateMission: async request => {
      activated.push(request);
      activeRun = { missionId: request.missionId, runId: 'run-cloud', revision: 4, authority: 'tracker' };
      return { ok: true, status: 'ok', sideEffect: true, activeRun };
    }
  });
  const registered = control.register({ clientId: 'efb-cloud', role: 'efb' });
  const result = await control.submitIntent({
    sessionId: registered.session.sessionId,
    sessionToken: registered.sessionToken,
    commandId: 'activate-1',
    intent: 'activate_cloud_mission',
    missionId: 'mission-cloud',
    runId: 'cloud-pending',
    expectedRevision: 0
  });
  assert.equal(result.ok, true);
  assert.equal(result.activeRun.runId, 'run-cloud');
  assert.equal(activated[0].controllerSession.role, 'efb');
  assert.equal(control.publicState().missionIntentsEnabled, true);
});

test('cockpit presence reports the current run authority instead of a startup constant', () => {
  let authority = 'web';
  const app = fixture({
    executionAuthority: 'tracker',
    getExecutionAuthority: () => authority,
    executeIntent: async () => ({ ok: true })
  });
  assert.equal(app.control.publicState().executionAuthority, 'web');
  authority = 'tracker';
  assert.equal(app.control.publicState().executionAuthority, 'tracker');
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
