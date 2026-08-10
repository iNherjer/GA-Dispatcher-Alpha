const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createMissionAuthorityManager } = require('./mission-authority-core.js');

const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'ga-mission-authority-'));
const storageFile = path.join(tempDirectory, 'authority.json');
let clock = 1000;
let runCounter = 0;
const createManager = () => createMissionAuthorityManager({
  storageFile,
  now: () => ++clock,
  idFactory: () => `run-${++runCounter}`
});

const manager = createManager();
const first = manager.acquire({ missionId: 'mission-a', clientId: 'app-a', resumeBundle: { adapter: 'poi', runtime: { phase: 'prepare' } } });
assert.equal(first.ok, true);
assert.equal(first.activeRun.runId, 'run-1');

const conflict = manager.acquire({ missionId: 'mission-b', clientId: 'app-b' });
assert.equal(conflict.ok, false);
assert.equal(conflict.status, 'conflict');
assert.equal(conflict.activeRun.missionId, 'mission-a');

const rejectedEffect = manager.validate({
  type: 'mission_scene_spawn',
  missionId: 'mission-b',
  runId: 'run-other',
  clientId: 'app-b',
});
assert.equal(rejectedEffect.ok, false);

const acceptedEffect = {
  type: 'mission_scene_boarding',
  commandId: 'cmd-board-1',
  missionId: 'mission-a',
  runId: first.activeRun.runId,
  clientId: 'app-a',
  missionPhase: 'boarding'
};
assert.equal(manager.validate(acceptedEffect).ok, true);
assert.equal(manager.validate({ type: 'mission_lifecycle', missionId: 'mission-a', clientId: 'app-a', state: 'active' }).ok, true);
assert.equal(manager.validate({ type: 'mission_lifecycle', missionId: 'mission-a', clientId: 'app-b', state: 'active' }).ok, false);
assert.equal(manager.validate({ type: 'mission_lifecycle', missionId: 'mission-a', state: 'active' }).ok, false);
manager.recordCommand(acceptedEffect);
manager.recordEffectAck({ type: 'mission_scene_boarding_ack', commandId: 'cmd-board-1', status: 'ok', boarded: 1 });
assert.equal(manager.getActiveRun({ includeEffects: true }).effects[0].status, 'ok');
const duplicateEffect = manager.validate(acceptedEffect);
assert.equal(duplicateEffect.ok, false);
assert.equal(duplicateEffect.status, 'ok');
assert.equal(duplicateEffect.effect.status, 'ok');

const snapOne = manager.updateSnapshot({
  missionId: 'mission-a',
  runId: first.activeRun.runId,
  clientId: 'app-a',
  snapshotSequence: 2,
  phase: 'enroute',
  resumeBundle: { adapter: 'poi_chain', runtime: { index: 3 } }
});
assert.equal(snapOne.ok, true);
const stale = manager.updateSnapshot({
  missionId: 'mission-a',
  runId: first.activeRun.runId,
  clientId: 'app-a',
  snapshotSequence: 1,
  resumeBundle: { adapter: 'poi_chain', runtime: { index: 1 } }
});
assert.equal(stale.status, 'noop');
assert.equal(manager.requestSnapshot({ missionId: 'mission-a', runId: first.activeRun.runId }).resumeBundle.runtime.index, 3);

const interruptedEffect = {
  type: 'mission_smoke_spawn',
  commandId: 'cmd-smoke-interrupted',
  missionId: 'mission-a',
  runId: first.activeRun.runId,
  clientId: 'app-a'
};
assert.equal(manager.validate(interruptedEffect).ok, true);
manager.recordCommand(interruptedEffect);
assert.equal(manager.validate(interruptedEffect).status, 'requested');

const reloaded = createManager();
assert.equal(reloaded.getActiveRun().missionId, 'mission-a');
assert.equal(reloaded.requestSnapshot({ missionId: 'mission-a' }).resumeBundle.runtime.index, 3);
assert.equal(reloaded.validate(interruptedEffect).effectRetry, true);

const takeover = reloaded.takeover({
  missionId: 'mission-a',
  runId: first.activeRun.runId,
  clientId: 'app-b',
  expectedRevision: reloaded.getActiveRun().revision,
  reason: 'device-handoff'
});
assert.equal(takeover.ok, true);
assert.equal(takeover.activeRun.ownerClientId, 'app-b');

const oldOwnerRelease = reloaded.release({
  missionId: 'mission-a',
  runId: first.activeRun.runId,
  clientId: 'app-a',
  outcome: 'reset'
});
assert.equal(oldOwnerRelease.ok, false);

const released = reloaded.release({
  missionId: 'mission-a',
  runId: first.activeRun.runId,
  clientId: 'app-b',
  outcome: 'completed'
});
assert.equal(released.ok, true);
assert.equal(reloaded.getActiveRun(), null);
assert.equal(reloaded.getPublicSnapshot().lastRun.state, 'completed');

const legacy = reloaded.validate({ type: 'mission_scene_spawn', commandId: 'legacy-1', missionId: 'mission-legacy' });
assert.equal(legacy.ok, true);
assert.equal(reloaded.getActiveRun().missionId, 'mission-legacy');
assert.equal(reloaded.validate({ type: 'mission_scene_spawn', missionId: 'foreign-legacy' }).ok, false);
const legacyWithoutSnapshot = reloaded.requestSnapshot({ missionId: 'mission-legacy' });
assert.equal(legacyWithoutSnapshot.status, 'noop');
assert.equal(legacyWithoutSnapshot.resumeBundle, null);
const legacyRecoveryTakeover = reloaded.takeover({
  missionId: 'mission-legacy',
  runId: reloaded.getActiveRun().runId,
  clientId: 'app-recovery',
  expectedRevision: reloaded.getActiveRun().revision,
  reason: 'explicit-legacy-recovery'
});
assert.equal(legacyRecoveryTakeover.ok, true);
assert.equal(legacyRecoveryTakeover.previousOwnerClientId, 'legacy-client');
const recoverySeed = reloaded.updateSnapshot({
  missionId: 'mission-legacy',
  runId: legacyRecoveryTakeover.activeRun.runId,
  clientId: 'app-recovery',
  snapshotSequence: 1,
  phase: 'planned',
  resumeBundle: {
    version: 2,
    missionId: 'mission-legacy',
    missionState: { currentMissionData: { missionId: 'mission-legacy' } },
    runtime: { missionId: 'mission-legacy', startPhase: 'planned' },
    adapter: 'apt'
  }
});
assert.equal(recoverySeed.ok, true);
assert.equal(reloaded.requestSnapshot({ missionId: 'mission-legacy' }).status, 'ok');
assert.equal(reloaded.release({
  missionId: 'mission-legacy',
  runId: legacyRecoveryTakeover.activeRun.runId,
  clientId: 'app-recovery',
  outcome: 'reset'
}).ok, true);
assert.equal(reloaded.getActiveRun(), null);

console.log('mission-authority-core tests: ok');
