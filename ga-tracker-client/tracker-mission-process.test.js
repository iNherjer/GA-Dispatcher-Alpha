'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const test = require('node:test');
const { setTimeout: delay } = require('node:timers/promises');
const executionCore = require('../mission-execution-core.js');
const { EFFECT_PLAN_SCHEMA } = require('./tracker-mission-simulator-effects.js');
const { createTrackerMissionProcess } = require('./tracker-mission-process.js');
const { difference, applyDifference } = require('./tracker-mission-ipc.js');
const { createTrackerEfbHttpServer, createTrackerEfbHttpHello } = require('./tracker-efb-http-server.js');
function aptBundle() {
  const bundle = {
    version: 2,
    missionId: 'mission-runtime-apt',
    adapter: 'apt',
    descriptor: { primaryAdapter: 'apt' },
    missionState: {
      currentMissionData: {
        missionId: 'mission-runtime-apt',
        missionType: 'apt',
        start: 'EDTW',
        dest: 'EDTL',
        aptArrivalPlan: { lat: 48.3, lon: 8.5 }
      }
    },
    runtime: {
      missionId: 'mission-runtime-apt',
      startPhase: 'planned',
      lastLiveFlightData: { onGround: true, gsKts: 0, simPaused: false, inMenuOrMap: false },
      runtime: { missionId: 'mission-runtime-apt', phase: 'planned', active: false },
      cargoManifest: {
        version: 6,
        key: 'empty-manifest',
        dispatchSignature: { scope: 'departure' },
        items: []
      }
    },
    executionEffectPlan: {
      schema: EFFECT_PLAN_SCHEMA,
      recipe: 'apt',
      missionId: 'mission-runtime-apt',
      effects: {
        'scene.prepare': {
          command: {
            type: 'mission_scene_spawn',
            sceneId: 'scene-mission-runtime-apt',
            items: [{ kind: 'person_boarder_1', objectTitle: 'Tarmac_Male' }]
          }
        },
        'scene.boarding': {
          command: {
            type: 'mission_scene_boarding',
            sceneId: 'scene-mission-runtime-apt',
            path: [{ forwardM: 16, rightM: -8 }, { forwardM: 4.5, rightM: 8.5 }]
          }
        }
      }
    }
  };
  bundle.executionReplay = executionCore.createExecutionBundle(bundle);
  bundle.execution = executionCore.createReplayShadowEnvelope(bundle.executionReplay, {
    sourceRevision: 1,
    legacyBundle: bundle
  });
  return bundle;
}

async function fixture(t, options = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ga-mission-process-test-'));
  const host = await createTrackerMissionProcess({
    authority: { storageFile: path.join(directory, 'authority.json'), executionAuthorityEnabled: true },
    enabled: true, pilotId: 'test', flightLogDirectory: directory,
    playBoardingVoice: () => ({ ok: true, status: 'completed' }),
    prepareBoardingVoice: () => ({ ok: true, status: 'completed' }),
    playFarewellVoice: () => ({ ok: true, status: 'completed' }),
    playComplianceVoice: () => ({ ok: true, status: 'completed' }),
    ...options
  });
  t.after(async () => { try { await host.close(); } catch (_) {} fs.rmSync(directory, { recursive: true, force: true }); });
  host.testDirectory = directory;
  return host;
}
async function activate(host, bundle = aptBundle()) {
  const manager = host.authorityManager;
  const acquired = await manager.acquire({ missionId: bundle.missionId, clientId: 'web-owner', stateHash: 'web-state', resumeBundle: bundle });
  assert.equal(acquired.ok, true);
  const run = acquired.activeRun;
  const prepared = await manager.prepareExecutionAuthority({ missionId: run.missionId, runId: run.runId,
    clientId: 'web-owner', expectedRevision: run.revision, expectedStateHash: run.stateHash,
    expectedExecutionStateHash: executionCore.replay(bundle.executionReplay).stateHash });
  assert.equal(prepared.ok, true, JSON.stringify(prepared));
  const committed = await manager.commitExecutionAuthority({ missionId: run.missionId, runId: run.runId,
    clientId: 'web-owner', expectedRevision: prepared.activeRun.revision,
    expectedExecutionStateHash: prepared.activeRun.executionStateHash, handoffId: prepared.handoff.handoffId });
  assert.equal(committed.ok, true, JSON.stringify(committed));
  assert.equal(manager.getActiveRun().executionAuthority, 'tracker');
}
async function until(predicate) {
  for (let n = 0; n < 200; n++) { if (predicate()) return; await delay(10); }
  assert.fail('condition did not become true');
}
function get(port, url) {
  return new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port, path: url }, response => {
      let body = ''; response.on('data', chunk => { body += chunk; });
      response.on('end', () => resolve({ status: response.statusCode, body }));
    }).on('error', reject);
  });
}

test('state deltas preserve deletions and do not resend an unchanged mission bundle', () => {
  const bundle = { large: 'x'.repeat(100000) };
  const before = { active: { resumeBundle: bundle, revision: 1, gone: true }, execution: { items: [1] } };
  const after = { active: { resumeBundle: bundle, revision: 2 }, execution: { items: [1, 2] } };
  const patch = difference(before, after);
  assert.ok(JSON.stringify(patch).length < 250);
  assert.deepEqual(applyDifference(before, patch), after);
});

test('real mission process commits authority and supports reverse simulator journaling without deadlock', async t => {
  const host = await fixture(t);
  assert.notEqual(host.runtime.publicState().processId, process.pid);
  await activate(host);
  const commands = [];
  host.runtime.attachSimulator({
    getLivePosition: () => ({ lat: 48, lon: 8, alt: 500, hdg: 90 }),
    async dispatchCommand(command) {
      // Production SimConnect boundary journals through the same reverse IPC.
      const lease = await host.authorityManager.beginExecutionEffectDispatch(command);
      assert.equal(lease.ok, true);
      commands.push(command);
      return { ok: true, status: 'completed', sideEffect: true };
    },
    syncPayloadBeforeStart: () => ({ ok: true, status: 'completed' }),
    syncPayloadManifestState: () => ({ ok: true, status: 'completed' }),
    cancelPayloadSync: () => true,
    cleanupMission: () => ({ ok: true, status: 'ok', payloadRestore: { status: 'warning' } })
  });
  await until(() => host.runtime.publicState().simulatorAttached);
  const run = host.authorityManager.getActiveRun();
  const result = await host.runtime.executeIntent({ commandId: 'prepare-test', intent: 'prepare_mission',
    missionId: run.missionId, runId: run.runId, expectedRevision: run.revision });
  assert.equal(result.ok, true, JSON.stringify(result));
  await until(() => commands.length > 0);
  assert.equal(commands[0].type, 'mission_scene_spawn');
  assert.equal(host.authorityManager.getExecutionSnapshot().state.phase, 'prepare');
  const copy = host.authorityManager.getActiveRun({ includeBundle: true });
  copy.resumeBundle.missionId = 'tampered';
  assert.notEqual(host.authorityManager.getActiveRun({ includeBundle: true }).resumeBundle.missionId, 'tampered');
  const current = host.authorityManager.getActiveRun();
  const aborted = await host.runtime.executeIntent({ commandId: 'abort-test', intent: 'abort_mission',
    missionId: current.missionId, runId: current.runId, expectedRevision: current.revision });
  assert.equal(aborted.ok, true, JSON.stringify(aborted));
  assert.equal(host.authorityManager.getActiveRun(), null);
});

test('stopped mission process cannot block local EFB HTTP or parent timers; telemetry backlog stays bounded',
  { skip: process.platform === 'win32' }, async t => {
    const host = await fixture(t);
    const server = createTrackerEfbHttpServer({ port: 0, host: '127.0.0.1', hello: createTrackerEfbHttpHello({ trackerVersion: 'v425', trackerVersionCode: 425 }), getMissionSnapshot: () => host.authorityManager.getPublicSnapshot() });
    const address = await server.start();
    t.after(() => server.stop());
    const pid = host.runtime.publicState().processId;
    process.kill(pid, 'SIGSTOP');
    t.after(() => { try { process.kill(pid, 'SIGCONT'); } catch (_) {} });
    let ticks = 0;
    const timer = setInterval(() => { ticks++; }, 10);
    t.after(() => clearInterval(timer));
    const pending = host.authorityManager.acquire({ missionId: 'paused-child', clientId: 'test' });
    for (let n = 0; n < 10000; n++) host.runtime.observeTelemetry({ observedAt: n, lat: 48, lon: 8, onGround: true });
    assert.equal(host.runtime.publicState().telemetry.inFlight, 1);
    assert.equal(host.runtime.publicState().telemetry.pending, 1);
    assert.equal(host.runtime.publicState().telemetry.coalesced, 9998);
    const response = await get(address.port, '/api/v1/hello');
    await delay(150);
    assert.equal(response.status, 200);
    assert.ok(ticks >= 5, 'parent event loop remains responsive while child is completely stopped');
    process.kill(pid, 'SIGCONT');
    assert.equal((await pending).ok, true);
  });

test('child death rejects in-flight operations and marks mission execution unavailable without replay',
  { skip: process.platform === 'win32' }, async t => {
    const host = await fixture(t);
    const pid = host.runtime.publicState().processId;
    process.kill(pid, 'SIGSTOP');
    const failed = assert.rejects(host.authorityManager.acquire({ missionId: 'never-committed', clientId: 'test' }), /mission_process_unavailable/);
    process.kill(pid, 'SIGKILL');
    await failed;
    await until(() => host.runtime.publicState().processAvailable === false);
    assert.equal(host.authorityManager.getActiveRun(), null);
    await assert.rejects(host.runtime.executeIntent({ intent: 'prepare_mission' }), /mission_process_unavailable/);
  });


test('restarting the mission process restores authority and never repeats an unconfirmed simulator command', async t => {
  const first = await fixture(t);
  await activate(first);
  const run = first.authorityManager.getActiveRun();
  const command = { type: 'mission_scene_object_spawn', commandId: 'unconfirmed-spawn', missionId: run.missionId, runId: run.runId };
  assert.equal((await first.authorityManager.beginExecutionEffectDispatch(command)).ok, true);
  await first.close();
  const second = await fixture(t, { authority: { storageFile: path.join(first.testDirectory, 'authority.json'), executionAuthorityEnabled: true } });
  assert.equal(second.authorityManager.getActiveRun().runId, run.runId);
  const retry = await second.authorityManager.beginExecutionEffectDispatch(command);
  assert.equal(retry.ok, false);
  assert.equal(retry.error, 'mission_effect_recovery_confirmation_required');
  assert.equal(retry.sideEffect, false);
  await second.close();
});

test('an old simulator connection cannot detach its replacement or deliver stale effect ACKs', async t => {
  const host = await fixture(t);
  const simulator = { getLivePosition: () => null, cancelPayloadSync: () => true };
  const oldBridge = host.runtime.attachSimulator(simulator);
  await until(() => host.runtime.publicState().simulatorAttached);
  host.runtime.detachSimulator(oldBridge);
  const newBridge = host.runtime.attachSimulator(simulator);
  assert.equal(host.runtime.detachSimulator(oldBridge), false);
  assert.equal(await oldBridge.handleAck({ commandId: 'old-connection' }), false);
  await until(() => host.runtime.publicState().simulatorAttached);
  assert.equal(host.runtime.detachSimulator(newBridge), true);
});
