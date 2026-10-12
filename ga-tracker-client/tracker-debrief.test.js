'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const core = require('../mission-execution-core');
const { createMissionAuthorityManager } = require('./mission-authority-core');
const { createTrackerCockpitControl } = require('./tracker-cockpit-control-core');
const { createTrackerMissionExecutionRuntime } = require('./tracker-mission-execution-runtime');
function fixture(t, patch = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ga-debrief-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const storageFile = path.join(dir, 'authority.json');
  const executionState = core.normalizeState({ missionId: 'finished', recipe: 'apt', manifest: { items: [] } });
  executionState.phase = 'closed'; executionState.flags.closed = true;
  const run = { missionId: 'finished', runId: 'finished-run', executionAuthority: 'tracker', executionRecipe: 'apt',
    phase: 'closed', state: 'completed', active: false, revision: 17, updatedAt: 60000, executionState,
    resumeBundle: { missionState: { currentMissionData: { start: 'EDTW', dest: 'EDTL', mission: '<b>Test flight</b>' } } },
    executionRuntimeContext: { schema: 'ga.mission-runtime-context.v1', version: 1,
      missionId: 'finished', runId: 'finished-run', missionFlightRecord: { createdAt: 60000, durationSec: 60, distanceNm: 4, maxGForce: 1.2 } }, ...patch };
  fs.writeFileSync(storageFile, JSON.stringify({ schema: 'ga.mission-authority.v1', version: 1, activeRun: null, lastRun: run, events: [] }));
  const create = extra => createMissionAuthorityManager({ storageFile, now: () => 70000, ...extra });
  return { manager: create(), create, storageFile };
}
const request = { intent: 'close_debrief', commandId: 'close', missionId: 'finished', runId: 'finished-run', expectedRevision: 17 };
test('terminal debrief acknowledgement survives restart and preserves all execution and recovery data', t => {
  const f = fixture(t), before = f.manager.getPublicSnapshot();
  assert.equal(before.debrief.record.distanceNm, 4);
  assert.equal(before.debrief.record.missionTitle, '<b>Test flight</b>');
  assert.equal(f.manager.closeExecutionDebrief(request).ok, true);
  const after = f.create().getPublicSnapshot();
  assert.equal(after.debrief.closedAt, 70000);
  assert.deepEqual(after.lastExecution, before.lastExecution);
  assert.equal(after.lastRun.revision, 17);
  assert.equal(f.manager.closeExecutionDebrief(request).status, 'noop');
});
test('debrief rejects wrong run, stale revision, unfinished and web runs', t => {
  const f = fixture(t);
  assert.equal(f.manager.closeExecutionDebrief({ ...request, runId: 'other' }).error, 'mission_run_conflict');
  assert.equal(f.manager.closeExecutionDebrief({ ...request, expectedRevision: 16 }).error, 'mission_revision_conflict');
  assert.equal(f.manager.getPublicSnapshot().debrief.closedAt, null);
  for (const patch of [{ phase: 'aborted' }, { executionAuthority: 'web' }]) {
    const other = fixture(t, patch).manager;
    assert.equal(other.getPublicSnapshot().debrief, null);
    assert.equal(other.closeExecutionDebrief(request).error, 'mission_debrief_unavailable');
  }
});
test('an old debrief cannot close or mutate a newly acquired run', t => {
  const f = fixture(t);
  const acquired = f.manager.acquire({ missionId: 'new', clientId: 'app' });
  assert.equal(acquired.ok, true);
  const before = f.manager.getPublicSnapshot();
  assert.equal(before.debrief, null);
  assert.equal(f.manager.closeExecutionDebrief(request).error, 'mission_authority_conflict');
  assert.deepEqual(f.manager.getPublicSnapshot(), before);
});
test('disk failure retains an open debrief for retry', t => {
  const f = fixture(t);
  const io = Object.create(fs); io.renameSync = () => { throw new Error('disk full'); };
  const failing = f.create({ fs: io });
  assert.equal(failing.closeExecutionDebrief(request).error, 'mission_debrief_persist_failed');
  assert.equal(failing.getPublicSnapshot().debrief.closedAt, null);
  assert.equal(f.create().getPublicSnapshot().debrief.closedAt, null);
});
test('authenticated EFB and App close the same terminal run through the runtime without simulator effects', async t => {
  const f = fixture(t); let notified = 0;
  const runtime = createTrackerMissionExecutionRuntime({ authorityManager: f.manager, enabled: true, onAuthorityChanged: () => notified++ });
  const cockpit = createTrackerCockpitControl({ getMissionRun: () => f.manager.getActiveRun(), executeIntent: runtime.executeIntent });
  const session = cockpit.register({ clientId: 'efb-test', role: 'efb' });
  const auth = { sessionId: session.session.sessionId, sessionToken: session.sessionToken };
  assert.equal((await cockpit.submitIntent(request)).ok, false);
  const result = await cockpit.submitIntent({ ...request, ...auth });
  assert.equal(result.ok, true); assert.equal(notified, 1);
  assert.equal((await cockpit.submitIntent({ ...request, ...auth })).duplicate, true);
  assert.equal((await cockpit.submitTrustedIntent({ ...request, commandId: 'app-close' }, { clientId: 'app', role: 'web' })).ok, true);
  assert.equal(f.manager.getPublicSnapshot().debrief.closedAt, 70000);
});

test('periodic worker checkpoint holds close presentation until durable write and rolls back a failed marker', async t => {
  const f = fixture(t); let releaseWrite;
  const io = Object.create(fs.promises);
  io.writeFile = (...args) => new Promise(resolve => { releaseWrite = () => resolve(fs.promises.writeFile(...args)); });
  let reader;
  const manager = f.create({ periodicCheckpoint: true, checkpointIo: io, onPublicationReader: value => { reader = value; } });
  t.after(() => manager.stopPersistence());
  const pending = manager.closeExecutionDebrief(request);
  while (!releaseWrite) await new Promise(resolve => setImmediate(resolve));
  assert.equal(reader().public.debrief.closedAt, null);
  releaseWrite(); assert.equal((await pending).ok, true);
  assert.equal(reader().public.debrief.closedAt, 70000);
  assert.equal(f.create().getPublicSnapshot().debrief.closedAt, 70000);
  const failingFixture = fixture(t);
  const failedIo = Object.create(fs.promises); failedIo.rename = async () => { throw Error('disk full'); };
  const failing = failingFixture.create({ periodicCheckpoint: true, checkpointIo: failedIo });
  t.after(() => failing.stopPersistence());
  assert.equal((await failing.closeExecutionDebrief(request)).error, 'mission_debrief_persist_failed');
  assert.equal(failing.getPublicSnapshot().debrief.closedAt, null);
});
test('terminal debrief close crosses the real mission worker and survives worker restart', async t => {
  const f = fixture(t);
  const { createTrackerMissionProcess } = require('./tracker-mission-process');
  const options = { authority: { storageFile: f.storageFile, executionAuthorityEnabled: true }, enabled: true,
    pilotId: 'test', flightLogDirectory: path.dirname(f.storageFile) };
  const host = await createTrackerMissionProcess(options);
  try {
    assert.equal(host.authorityManager.getPublicSnapshot().debrief.closedAt, null);
    assert.equal((await host.runtime.executeIntent(request)).ok, true);
    assert.ok(host.authorityManager.getPublicSnapshot().debrief.closedAt);
    assert.ok(f.create().getPublicSnapshot().debrief.closedAt);
  } finally { await host.close(); }
  const restarted = await createTrackerMissionProcess(options);
  try { assert.ok(restarted.authorityManager.getPublicSnapshot().debrief.closedAt); }
  finally { await restarted.close(); }
});
