const assert = require('node:assert/strict');
const core = require('./tracker-mission-offline-command-core.js');

const intent = name => ({ type: 'mission_execution_intent', intent: name, commandId: `intent-${name}` });

// Abort and closing the cargo window need no simulator and must run immediately.
assert.deepEqual(core.classifyMissionCommandWithoutSimulator(intent('abort_mission')), { action: 'execute_intent', intent: 'abort_mission' });
assert.deepEqual(core.classifyMissionCommandWithoutSimulator(intent('close_cargo_window')), { action: 'execute_intent', intent: 'close_cargo_window' });
// Resuming only records the decision; the rebuild waits for a running cockpit.
assert.deepEqual(core.classifyMissionCommandWithoutSimulator(intent('resume_mission')), { action: 'execute_intent', intent: 'resume_mission' });
assert.equal(core.classifyMissionCommandWithoutSimulator({ type: 'MISSION_EXECUTION_INTENT', intent: ' Abort_Mission ' }).action, 'execute_intent');

// Everything else is rejected now instead of being replayed at the next simulator launch.
for (const name of ['clear_manifest_signature', 'set_manifest_item', 'prepare_mission', 'open_cargo_window', 'request_close', 'training_abort', 'resume_teleport', '']) {
  assert.deepEqual(core.classifyMissionCommandWithoutSimulator(intent(name)),
    { action: 'reject_intent', intent: name, error: 'simulator_disconnected' }, name);
}

// Snapshot reads are answered from the authority; other commands keep their buffering.
assert.deepEqual(core.classifyMissionCommandWithoutSimulator({ type: 'mission_snapshot_request' }), { action: 'snapshot' });
for (const type of ['mission_authority_acquire', 'mission_snapshot_update', 'homebase_v1.crew.set', 'aircraft_payload_set', '']) {
  assert.deepEqual(core.classifyMissionCommandWithoutSimulator({ type }), { action: 'buffer' }, type);
}
assert.deepEqual(core.classifyMissionCommandWithoutSimulator(null), { action: 'buffer' });

// Intent ACK matches the SimConnect relay ACK shape.
const run = { missionId: 'm1', runId: 'r1', revision: 7 };
const okAck = core.buildMissionIntentAck({ commandId: 'c1', intent: 'abort_mission', missionId: 'm1', runId: 'r1' },
  { ok: true, status: 'ok', releasedRun: run }, { activeRun: null }, 123);
assert.deepEqual(okAck, {
  source: 'tracker', type: 'mission_execution_intent_ack', commandId: 'c1', missionId: 'm1', runId: 'r1',
  intent: 'abort_mission', ok: true, status: 'ok', error: '', sideEffect: false, activeRun: null,
  releasedRun: run, duplicate: false, at: 123
});
const rejected = core.buildMissionIntentAck({ commandId: 'c2', intent: 'set_manifest_item' },
  { ok: false, status: 'blocked', error: 'simulator_disconnected' }, { activeRun: run }, 5);
assert.equal(rejected.ok, false);
assert.equal(rejected.status, 'blocked');
assert.equal(rejected.error, 'simulator_disconnected');
assert.deepEqual(rejected.activeRun, run, 'falls back to the published authority run');
assert.equal(core.buildMissionIntentAck({ commandId: 'c3' }, { ok: false, activeRun: run }, null, 5).missionId, 'm1');

// Snapshot ACK matches the authority ACK fields read by the Web app.
const bundle = { schema: 'x' };
const snapshotAck = core.buildAuthorityAck('mission_snapshot_request',
  { commandId: 's1', reason: 'device-handoff-preview', missionTransferPeer: 'peer-1' },
  { ok: true, status: 'ok', activeRun: { ...run, executionAuthority: 'tracker' }, resumeBundle: bundle });
assert.equal(snapshotAck.type, 'mission_snapshot_request_ack');
assert.equal(snapshotAck.status, 'ok');
assert.equal(snapshotAck.missionId, 'm1');
assert.equal(snapshotAck.runId, 'r1');
assert.equal(snapshotAck.reason, 'device-handoff-preview');
assert.equal(snapshotAck.executionAuthority, 'tracker');
assert.equal(snapshotAck.missionTransferPeer, 'peer-1');
assert.equal(snapshotAck.resumeBundle, bundle);
assert.equal(snapshotAck.authoritativeRun.runId, 'r1');
const noRun = core.buildAuthorityAck('mission_snapshot_request', { commandId: 's2' },
  { ok: false, status: 'noop', error: 'no_active_run', activeRun: null, resumeBundle: null });
assert.equal(noRun.status, 'noop');
assert.equal(noRun.authoritativeRun, null);
assert.equal(noRun.resumeBundle, undefined);

// Tracker wiring: mission commands are classified before the SimConnect buffer.
const trackerSource = require('node:fs').readFileSync(require('node:path').join(__dirname, 'tracker.js'), 'utf8');
const offlineCall = trackerSource.indexOf('if (handleMissionCommandWithoutSimulator(command)) return;');
const bufferPush = trackerSource.indexOf('_pendingTrackerCommands.push(command);');
assert.ok(offlineCall > 0 && offlineCall < bufferPush, 'mission commands are answered before buffering');
const handler = trackerSource.slice(trackerSource.indexOf('const handleMissionCommandWithoutSimulator'), trackerSource.indexOf('const dispatchTrackerCommand'));
assert.match(handler, /missionAuthorityManager\.requestSnapshot\(command\)/);
assert.match(handler, /trackerCockpitControl\.submitTrustedIntent\(\{ \.\.\.command, deferEffects: true \}/);
assert.match(handler, /role: 'web'/, 'relay intents keep the web controller role');

console.log('tracker-mission-offline-command-core tests passed');
