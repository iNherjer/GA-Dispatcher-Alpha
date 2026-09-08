'use strict';
// Offline integration probe. Compile the actual tracker unchanged except suppressing
// its interactive main() and exposing its simulator connection factory to this test.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Module = require('node:module');
const assert = require('node:assert/strict');
const { Simulator } = require('./simulator');
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ga-sim-integration-'));
const sim = new Simulator(); const simPath = require.resolve('node-simconnect');
require.cache[simPath].exports = { ...require(simPath), open: async () => sim.connect() };
const storagePath = require.resolve('../tracker-storage'); const storage = require(storagePath);
require.cache[storagePath].exports = { ...storage, prepareTrackerStorage: () => ({ dataDirectory: directory, migrated: [], events: [] }) };
process.env.VFR_MULTITOOL_TRACKER_CHANNEL = 'alpha'; process.env.VFR_MULTITOOL_APT_EXECUTION = '1';
const filename = require.resolve('../tracker.js'); const subject = new Module(filename, module); subject.filename = filename; subject.paths = Module._nodeModulePaths(path.dirname(filename));
const source = fs.readFileSync(filename, 'utf8'); assert.match(source, /\nmain\(\);\s*$/);
subject._compile(source.replace(/\nmain\(\);\s*$/, '\nmodule.exports = { connectSimConnect, createMissionSmokeController };'), filename);
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(check, label, timeout = 12000) { const end = Date.now() + timeout; while (Date.now() < end) { const value = check(); if (value) return value; await wait(50); } throw Error(`Timeout: ${label}`); }
async function run() {
  const packets = []; let handler; let state = {};
  const ws = { readyState: 1, send: text => packets.push(JSON.parse(text)) };
  subject.exports.connectSimConnect(() => ws, 'OFFLINE-TEST', '0000', value => { handler = value; }, null, null, null, null, patch => { state = { ...state, ...patch }; });
  await until(() => handler && state.snapshot, 'actual tracker telemetry');
  assert.equal(state.simulatorConnected, true);
  const controller = subject.exports.createMissionSmokeController(sim, () => ws, 'OFFLINE-TEST', '0000', () => ({ lat: 48.0208, lon: 7.8342, alt: 800, hdg: 0 }));
  const payload = await controller.refreshPayloadSnapshot(4); assert.ok(payload, 'real tracker decoded payload');
  const command = { type: 'mission_scene_spawn', commandId: 'probe-spawn', sceneId: 'probe', missionId: 'probe', lat: 48.0208, lon: 7.8342, altFt: 800, hdg: 0, items: [{ kind: 'cargo', objectTitle: 'Cardboard', forwardM: 5, rightM: 3 }] };
  assert.equal(handler(command), true);
  const spawn = await until(() => packets.find(p => p.trackerAck?.commandId === 'probe-spawn'), 'real scene spawn ACK');
  assert.equal(spawn.trackerAck.status, 'ok', JSON.stringify(spawn)); assert.ok(sim.objects.size > 0);
  assert.equal(handler({ type: 'mission_scene_clear', commandId: 'probe-clear', sceneId: 'probe', missionId: 'probe' }), true);
  await until(() => packets.find(p => p.trackerAck?.commandId === 'probe-clear'), 'real scene clear ACK');
  await until(() => sim.objects.size === 0, 'object removal');
  sim.control({ action: 'position', lat: 48.2, lon: 7.9, alt: 2800, agl: 2000, speed: 100, onGround: false });
  await until(() => packets.some(p => p.lat === 48.2 && p.flight?.onGround === false), 'airborne telemetry forwarded');
  fs.writeFileSync(path.join(directory, 'proof.json'), JSON.stringify({ payload, spawn: spawn.trackerAck, journal: sim.journal }, null, 2));
  console.log(`PASS: real tracker telemetry, payload decode, scene handler spawn/clear ACKs. Proof: ${directory}`);
}
(process.argv.includes('--mission') ? missionRun() : run()).then(() => process.exit(0), error => { console.error(error); process.exit(1); });
setTimeout(() => { console.error('Integration watchdog expired'); process.exit(1); }, 90000);

async function missionRun() {
  const core = require('../../mission-execution-core');
  const { createMissionAuthorityManager } = require('../mission-authority-core');
  const { createTrackerMissionExecutionRuntime } = require('../tracker-mission-execution-runtime');
  const { EFFECT_PLAN_SCHEMA } = require('../tracker-mission-simulator-effects');
  const missionId = 'teststand-ab', sceneId = 'teststand-ab-scene';
  const bundle = {
    version: 2, missionId, adapter: 'apt', descriptor: { primaryAdapter: 'apt' },
    missionState: { currentMissionData: { missionId, missionType: 'apt', start: 'TEST-A', dest: 'TEST-B', aptArrivalPlan: { lat: 48.3693, lon: 7.8277 } } },
    runtime: { missionId, startPhase: 'planned', lastLiveFlightData: { onGround: true, gsKts: 0, simPaused: false, inMenuOrMap: false }, runtime: { missionId, phase: 'planned', active: false },
      cargoManifest: { version: 6, key: 'teststand-manifest', items: [{ id: 'box', itemType: 'cargo', required: true, status: 'pending', weightKg: 10, deliverAtDestination: true }] } },
    executionEffectPlan: { schema: EFFECT_PLAN_SCHEMA, recipe: 'apt', missionId, sceneId,
      effects: { 'scene.prepare': { command: { type: 'mission_scene_spawn', sceneId, lat: 48.0208, lon: 7.8342, altFt: 800, hdg: 0, items: [{ kind: 'cargo', objectTitle: 'Cardboard', forwardM: 5, rightM: 3 }, { kind: 'person_boarder_1', objectTitle: 'Tarmac_Male_Summer_Caucasian', forwardM: 5, rightM: 3 }] } },
        'scene.boarding': { command: { type: 'mission_scene_boarding', sceneId, path: [{ forwardM: 5, rightM: 3 }, { forwardM: 4, rightM: 3 }] } } } }
  };
  bundle.executionReplay = core.createExecutionBundle(bundle);
  bundle.execution = core.createReplayShadowEnvelope(bundle.executionReplay, { sourceRevision: 1, legacyBundle: bundle });
  const manager = createMissionAuthorityManager({ storageFile: path.join(directory, 'authority.json'), idFactory: () => 'teststand-run', executionAuthorityEnabled: true });
  const acquired = manager.acquire({ missionId, clientId: 'test-interface', stateHash: 'test-fixture', resumeBundle: bundle });
  const prepared = manager.prepareExecutionAuthority({ missionId, runId: acquired.activeRun.runId, clientId: 'test-interface', expectedRevision: acquired.activeRun.revision, expectedStateHash: acquired.activeRun.stateHash, expectedExecutionStateHash: core.replay(bundle.executionReplay).stateHash });
  assert.equal(prepared.ok, true, JSON.stringify(prepared));
  const committed = manager.commitExecutionAuthority({ missionId, runId: prepared.activeRun.runId, clientId: 'test-interface', expectedRevision: prepared.activeRun.revision, expectedExecutionStateHash: prepared.activeRun.executionStateHash, handoffId: prepared.handoff.handoffId });
  assert.equal(committed.ok, true);
  const phases = []; const packets = [];
  // Audio is disabled for this deterministic transport/mission test; no fake successful playback ACK.
  const runtime = createTrackerMissionExecutionRuntime({ authorityManager: manager, enabled: true, playBoardingVoice: require('../tracker-mission-boarding-voice').createTrackerMissionBoardingVoice({ authorityManager: manager }).dispatch, playFarewellVoice: require('../tracker-mission-farewell-voice').createTrackerMissionFarewellVoice({ authorityManager: manager }).dispatch, onAuthorityChanged: (reason, snapshot) => phases.push({ reason, phase: snapshot?.state?.phase }) });
  let state = {};
  const ws = { readyState: 1, send: text => packets.push(JSON.parse(text)) };
  subject.exports.connectSimConnect(() => ws, 'OFFLINE-TEST', '0000', null, null, null, null, null, patch => { state = { ...state, ...patch }; }, manager, null, runtime);
  await until(() => state.snapshot, 'initial ground telemetry');
  let seq = 0;
  async function intent(intent, payload) {
    await until(() => manager.getExecutionSnapshot()?.view?.allowedActions?.includes(intent), 'allowed ' + intent, 20000);
    const run = manager.getActiveRun();
    const result = await runtime.executeIntent({ commandId: 'test-intent-' + (++seq), intent, missionId, runId: run.runId, expectedRevision: run.revision, payload });
    assert.equal(result.ok, true, intent + ': ' + JSON.stringify(result));
    console.log('INTENT', intent, manager.getExecutionSnapshot()?.state?.phase);
    await wait(200);
  }
  await intent('prepare_mission');
  await intent('start_boarding');
  await until(() => manager.getExecutionSnapshot()?.state?.phase === 'boarding', 'boarding completed', 30000);
  await intent('set_manifest_item', { itemId: 'box', action: 'load' });
  await intent('sign_manifest');
  await intent('confirm_load');
  await intent('start_mission');
  sim.control({ action: 'position', lat: 48.1, lon: 7.83, alt: 2800, agl: 2000, speed: 90, onGround: false });
  await wait(3000);
  sim.control({ action: 'position', lat: 48.3693, lon: 7.8277, alt: 511, agl: 0, speed: 12, onGround: true });
  await wait(1500);
  sim.control({ action: 'position', lat: 48.3693, lon: 7.8277, alt: 511, agl: 0, speed: 0, onGround: true, parkingBrake: true });
  await wait(4500);
  await intent('set_manifest_item', { itemId: 'box', action: 'unload' });
  await intent('sign_manifest');
  await intent('confirm_unload');
  await until(() => manager.getPublicSnapshot()?.lastExecution?.phase === 'closed', 'mission closed', 15000);
  assert.equal(manager.getActiveRun(), null);
  assert.equal(manager.getPublicSnapshot().lastExecution.payload.status, 'ok');
  assert.ok(sim.journal.some(e => e.kind === 'applied' && e.operation === 'payload-write'));
  assert.ok(sim.journal.some(e => e.kind === 'removed'));
  fs.writeFileSync(path.join(directory, 'mission-proof.json'), JSON.stringify({ phases, execution: manager.getPublicSnapshot().lastExecution, simulator: sim.snapshot(), acks: packets.filter(p => p.trackerAck).map(p => p.trackerAck) }, null, 2));
  console.log('PASS: A-B cargo mission through real tracker SimConnect connection and real payload/scene handlers reached closed. Proof:', directory);
}
