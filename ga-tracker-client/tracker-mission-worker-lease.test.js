'use strict';
// Verlade-Abkuerzung: Der Mission-Worker legt die Effekt-Freigabe (Journal)
// selbst an und ruft den Hauptprozess nur noch einmal auf.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { setTimeout: delay } = require('node:timers/promises');
const executionCore = require('../mission-execution-core.js');
const { EFFECT_PLAN_SCHEMA } = require('./tracker-mission-simulator-effects.js');
const { createTrackerMissionProcess } = require('./tracker-mission-process.js');
const { createMissionAuthorityManager } = require('./mission-authority-core.js');

function aptBundle() {
  const bundle = {
    version: 2, missionId: 'mission-lease', adapter: 'apt', descriptor: { primaryAdapter: 'apt' },
    missionState: { currentMissionData: { missionId: 'mission-lease', missionType: 'apt', start: 'EDTW', dest: 'EDTL', aptArrivalPlan: { lat: 48.3, lon: 8.5 } } },
    runtime: { missionId: 'mission-lease', startPhase: 'planned',
      lastLiveFlightData: { onGround: true, gsKts: 0, simPaused: false, inMenuOrMap: false },
      runtime: { missionId: 'mission-lease', phase: 'planned', active: false },
      cargoManifest: { version: 6, key: 'lease-manifest', dispatchSignature: { scope: 'departure' }, items: [] } },
    executionEffectPlan: { schema: EFFECT_PLAN_SCHEMA, recipe: 'apt', missionId: 'mission-lease', effects: {
      'scene.prepare': { command: { type: 'mission_scene_spawn', sceneId: 'scene-mission-lease', items: [{ kind: 'person_boarder_1', objectTitle: 'Tarmac_Male' }] } }
    } }
  };
  bundle.executionReplay = executionCore.createExecutionBundle(bundle);
  bundle.execution = executionCore.createReplayShadowEnvelope(bundle.executionReplay, { sourceRevision: 1, legacyBundle: bundle });
  return bundle;
}
async function until(predicate, label = 'condition') {
  for (let n = 0; n < 300; n++) { if (predicate()) return; await delay(10); }
  assert.fail(`${label} did not become true`);
}
async function startHost(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ga-worker-lease-'));
  const host = await createTrackerMissionProcess({
    authority: { storageFile: path.join(directory, 'authority.json'), executionAuthorityEnabled: true },
    enabled: true, pilotId: 'test', flightLogDirectory: directory,
    playBoardingVoice: () => ({ ok: true, status: 'completed' }), prepareBoardingVoice: () => ({ ok: true, status: 'completed' }),
    playFarewellVoice: () => ({ ok: true, status: 'completed' }), playComplianceVoice: () => ({ ok: true, status: 'completed' })
  });
  t.after(async () => { try { await host.close(); } catch (_) {} fs.rmSync(directory, { recursive: true, force: true }); });
  const bundle = aptBundle();
  const manager = host.authorityManager;
  const acquired = await manager.acquire({ missionId: bundle.missionId, clientId: 'web-owner', stateHash: 'web-state', resumeBundle: bundle });
  const run = acquired.activeRun;
  const prepared = await manager.prepareExecutionAuthority({ missionId: run.missionId, runId: run.runId, clientId: 'web-owner',
    expectedRevision: run.revision, expectedStateHash: run.stateHash,
    expectedExecutionStateHash: executionCore.replay(bundle.executionReplay).stateHash });
  const committed = await manager.commitExecutionAuthority({ missionId: run.missionId, runId: run.runId, clientId: 'web-owner',
    expectedRevision: prepared.activeRun.revision, expectedExecutionStateHash: prepared.activeRun.executionStateHash,
    handoffId: prepared.handoff.handoffId });
  assert.equal(committed.ok, true, JSON.stringify(committed));
  return host;
}
const simulatorBase = {
  getLivePosition: () => ({ lat: 48, lon: 8, alt: 500, hdg: 90 }),
  syncPayloadBeforeStart: () => ({ ok: true, status: 'completed' }),
  syncPayloadManifestState: () => ({ ok: true, status: 'completed' }),
  cancelPayloadSync: () => true,
  cleanupMission: () => ({ ok: true, status: 'ok' })
};
const prepare = async (host) => {
  const run = host.authorityManager.getActiveRun();
  return host.runtime.executeIntent({ intent: 'prepare_mission', commandId: `prepare-${Date.now()}`,
    missionId: run.missionId, runId: run.runId, expectedRevision: run.revision, deferEffects: true });
};

test('Worker legt die Freigabe vor dem Sim-Aufruf an und meldet sie mit', async t => {
  const host = await startHost(t);
  const calls = [];
  host.runtime.attachSimulator({ ...simulatorBase,
    dispatchCommand(command, options) {
      // Der Journal-Eintrag existiert bereits, bevor der Hauptprozess sendet.
      const effects = host.authorityManager.getActiveRun({ includeEffects: true }).effects || [];
      calls.push({ type: command.type, commandId: command.commandId, options, journaled: effects.some(effect => effect.commandId === command.commandId) });
      return { ok: true, status: 'completed', sideEffect: true };
    } });
  await until(() => host.runtime.publicState().simulatorAttached, 'simulator attached');
  assert.equal((await prepare(host)).ok, true);
  await until(() => calls.length > 0, 'scene dispatch');
  assert.equal(calls[0].type, 'mission_scene_spawn');
  assert.deepEqual(calls[0].options, { workerLease: true });
  assert.equal(calls[0].journaled, true);
});

test('nicht zugestellter Aufruf: Freigabe wird zurueckgenommen, Wiederholung sendet erneut', async t => {
  const host = await startHost(t);
  const calls = [];
  host.runtime.attachSimulator({ ...simulatorBase,
    dispatchCommand(command) {
      calls.push(command.commandId);
      // Erster Versuch: wie ein Verbindungswechsel vor der Ausfuehrung.
      if (calls.length === 1) throw Error('mission_simulator_connection_changed');
      return { ok: true, status: 'completed', sideEffect: true };
    } });
  await until(() => host.runtime.publicState().simulatorAttached, 'simulator attached');
  assert.equal((await prepare(host)).ok, true);
  await until(() => calls.length >= 1, 'first dispatch');
  // Der Effekt-Runner wiederholt nach 2 s beim naechsten Anstoss (hier eine Aktion).
  await delay(2200);
  const run = host.authorityManager.getActiveRun();
  await host.runtime.executeIntent({ intent: 'open_cargo_window', commandId: 'nudge', missionId: run.missionId, runId: run.runId,
    expectedRevision: run.revision, payload: { mode: 'load' }, deferEffects: true });
  await until(() => calls.length >= 2, 'retry after undelivered dispatch');
  assert.equal(calls[0], calls[1], 'derselbe Effekt wird erneut gesendet, nicht als laufend uebersprungen');
});

test('Kern: Zuruecknehmen nur fuer eigene, offene Freigaben', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ga-lease-core-'));
  try {
    const logs = [];
    const manager = createMissionAuthorityManager({ storageFile: path.join(directory, 'a.json'), executionAuthorityEnabled: true, log: line => logs.push(line) });
    const bundle = aptBundle();
    const run = manager.acquire({ missionId: bundle.missionId, clientId: 'web-owner', stateHash: 'h', resumeBundle: bundle }).activeRun;
    const prepared = manager.prepareExecutionAuthority({ missionId: run.missionId, runId: run.runId, clientId: 'web-owner',
      expectedRevision: run.revision, expectedStateHash: run.stateHash,
      expectedExecutionStateHash: executionCore.replay(bundle.executionReplay).stateHash });
    manager.commitExecutionAuthority({ missionId: run.missionId, runId: run.runId, clientId: 'web-owner',
      expectedRevision: prepared.activeRun.revision, expectedExecutionStateHash: prepared.activeRun.executionStateHash,
      handoffId: prepared.handoff.handoffId });
    const command = { type: 'mission_scene_object_spawn', commandId: 'mfx-1', missionId: run.missionId, runId: run.runId };
    assert.equal(manager.beginExecutionEffectDispatch(command).status, 'ok');
    assert.equal(manager.beginExecutionEffectDispatch(command).duplicate, true);
    assert.equal(manager.abandonExecutionEffectDispatch({ commandId: 'mfx-1', reason: 'test' }).status, 'ok');
    assert.equal(manager.beginExecutionEffectDispatch(command).status, 'ok', 'danach neu freigebbar');
    manager.recordEffectAck({ type: 'mission_scene_object_spawn_ack', commandId: 'mfx-1', missionId: run.missionId, runId: run.runId, status: 'ok' });
    assert.equal(manager.abandonExecutionEffectDispatch({ commandId: 'mfx-1' }).ok, false, 'bestaetigte Effekte bleiben');
    assert.equal(manager.abandonExecutionEffectDispatch({ commandId: 'unknown' }).status, 'noop');
    assert.match(logs.join('\n'), /MISSION_EFFECT_DISPATCH_ABANDONED command=mfx-1 reason=test/);
    manager.stopPersistence?.();
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

test('Hauptprozess ueberspringt die Rueckfrage nur auf dem internen Worker-Weg', () => {
  const source = fs.readFileSync(path.join(__dirname, 'tracker.js'), 'utf8');
  assert.match(source, /async dispatchExecutionCommand\(command, options = \{\}\)/);
  assert.match(source, /const dispatchLease = options\?\.workerLease === true\s*\? \{ ok: true, status: 'ok', sideEffect: false \}\s*: \(\(await missionAuthority\?\.beginExecutionEffectDispatch\?\.\(command\)\)/);
  assert.match(source, /dispatchCommand: \(command, options\) => missionSmokeController\.dispatchExecutionCommand\(command, options\)/);
  // Die Laufpruefung bleibt auch auf dem schnellen Weg.
  assert.match(source, /if \(!dispatchLease\.ok \|\| dispatchLease\.status === 'completed'\) return dispatchLease;\s*const currentRun = missionAuthority\?\.getActiveRun\?\.\(\);/);
});
