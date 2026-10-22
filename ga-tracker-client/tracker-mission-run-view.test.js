'use strict';
// Die EFB fragt den Missionsstand alle 300-550 ms ab. Der Hauptprozess liefert
// dafuer eine eingefrorene, gecachte Ansicht statt jedes Mal das komplette
// Resume-Paket (bis 1,2 MB) zu kopieren. getActiveRun bleibt eine freie Kopie.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { setTimeout: delay } = require('node:timers/promises');
const executionCore = require('../mission-execution-core.js');
const { EFFECT_PLAN_SCHEMA } = require('./tracker-mission-simulator-effects.js');
const { createTrackerMissionProcess } = require('./tracker-mission-process.js');
const { projectTrackerEfbMissionView } = require('./tracker-efb-mission-view-core.js');
const { projectTrackerMapSnapshot } = require('./tracker-efb-map-snapshot-core.js');
const { missionRouteEnds } = require('./tracker-flightplan-export.js');
const { createTrackerMissionShadow } = require('./tracker-mission-shadow.js');

function aptBundle() {
  const bundle = {
    version: 2, missionId: 'mission-view-apt', adapter: 'apt', descriptor: { primaryAdapter: 'apt' },
    missionState: { currentMissionData: { missionId: 'mission-view-apt', missionType: 'apt', start: 'EDTW', dest: 'EDTL',
      aptArrivalPlan: { lat: 48.3, lon: 8.5 }, story: 'x'.repeat(200000) } },
    runtime: {
      missionId: 'mission-view-apt', startPhase: 'planned',
      lastLiveFlightData: { onGround: true, gsKts: 0, simPaused: false, inMenuOrMap: false },
      runtime: { missionId: 'mission-view-apt', phase: 'planned', active: false },
      cargoManifest: { version: 6, key: 'view-manifest', dispatchSignature: { scope: 'departure' },
        items: [{ id: 'box', itemType: 'cargo', required: true, status: 'pending', weightLbs: 10, deliverAtDestination: true }] }
    },
    executionEffectPlan: { schema: EFFECT_PLAN_SCHEMA, recipe: 'apt', missionId: 'mission-view-apt', effects: {} }
  };
  bundle.executionReplay = executionCore.createExecutionBundle(bundle);
  bundle.execution = executionCore.createReplayShadowEnvelope(bundle.executionReplay, { sourceRevision: 1, legacyBundle: bundle });
  return bundle;
}
async function until(predicate) {
  for (let n = 0; n < 300; n++) { if (predicate()) return; await delay(10); }
  assert.fail('condition did not become true');
}
async function startHost(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ga-run-view-test-'));
  const host = await createTrackerMissionProcess({
    authority: { storageFile: path.join(directory, 'authority.json'), executionAuthorityEnabled: true },
    enabled: true, pilotId: 'test', flightLogDirectory: directory,
    playBoardingVoice: () => ({ ok: true, status: 'completed' }), prepareBoardingVoice: () => ({ ok: true, status: 'completed' }),
    playFarewellVoice: () => ({ ok: true, status: 'completed' }), playComplianceVoice: () => ({ ok: true, status: 'completed' })
  });
  t.after(async () => { try { await host.close(); } catch (_) {} fs.rmSync(directory, { recursive: true, force: true }); });
  return host;
}
async function activate(host, bundle) {
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
}
const sameContent = (host, options) => assert.deepEqual(
  JSON.parse(JSON.stringify(host.authorityManager.getActiveRunView(options))),
  host.authorityManager.getActiveRun(options));

test('Ansicht ist eingefroren, wird wiederverwendet und folgt jeder Aenderung', async t => {
  const host = await startHost(t);
  await activate(host, aptBundle());
  const options = { includeBundle: true, includeEffects: true };
  const first = host.authorityManager.getActiveRunView(options);
  assert.equal(Object.isFrozen(first.resumeBundle), true);
  assert.equal(Object.isFrozen(first.resumeBundle.missionState.currentMissionData), true);
  assert.throws(() => { first.resumeBundle.missionState.currentMissionData.dest = 'XXXX'; }, TypeError);
  const second = host.authorityManager.getActiveRunView(options);
  assert.equal(second.resumeBundle, first.resumeBundle, 'unveraenderte Ansicht wird nicht neu kopiert');
  assert.notEqual(second, first, 'Kopfdaten bleiben pro Aufruf frisch');
  sameContent(host, options);

  // Die freie Kopie bleibt veraenderbar und beruehrt die Ansicht nicht.
  const copy = host.authorityManager.getActiveRun(options);
  copy.resumeBundle.missionState.currentMissionData.dest = 'tampered';
  assert.equal(host.authorityManager.getActiveRunView(options).resumeBundle.missionState.currentMissionData.dest, 'EDTL');

  host.runtime.attachSimulator({ getLivePosition: () => ({ lat: 48, lon: 8, altFt: 500 }),
    dispatchCommand: () => ({ ok: true, status: 'completed' }),
    syncPayloadBeforeStart: () => ({ ok: true, status: 'completed' }),
    syncPayloadManifestState: () => ({ ok: true, status: 'completed' }),
    cancelPayloadSync: () => true,
    cleanupMission: () => ({ ok: true, status: 'ok' }) });
  await until(() => host.runtime.publicState().simulatorAttached);
  const run = host.authorityManager.getActiveRun();
  const result = await host.runtime.executeIntent({ intent: 'prepare_mission', commandId: 'view-prepare',
    missionId: run.missionId, runId: run.runId, expectedRevision: run.revision, deferEffects: true });
  assert.equal(result.ok, true, JSON.stringify(result));
  await until(() => host.authorityManager.getActiveRun().revision > run.revision);
  const after = host.authorityManager.getActiveRunView(options);
  assert.notEqual(after.resumeBundle, first.resumeBundle, 'geaenderte Teile ergeben eine neue Ansicht');
  assert.equal(after.resumeBundle.missionState, first.resumeBundle.missionState, 'statische Missionsdaten bleiben geteilt');
  assert.notDeepEqual(after.resumeBundle.executionReplay, first.resumeBundle.executionReplay);
  sameContent(host, options);
  sameContent(host, { includeBundle: true });

  // Hintergrund-Effekte koennen die Revision zwischen Lesen und Senden erhoehen.
  let aborted = null;
  for (let attempt = 0; attempt < 5 && aborted?.ok !== true; attempt++) {
    aborted = await host.runtime.executeIntent({ intent: 'abort_mission', commandId: `view-abort-${attempt}`,
      missionId: run.missionId, runId: run.runId, expectedRevision: host.authorityManager.getActiveRun().revision });
    if (aborted?.error === 'mission_revision_conflict') await delay(50);
  }
  assert.equal(aborted.ok, true, JSON.stringify(aborted));
  assert.equal(host.authorityManager.getActiveRunView(options), null);
});

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

test('lesende Projektionen funktionieren mit eingefrorenem Lauf und liefern dasselbe Ergebnis', () => {
  const bundle = aptBundle();
  const run = { missionId: bundle.missionId, runId: 'run-view', executionAuthority: 'tracker', executionRecipe: 'apt',
    state: 'active', active: true, phase: 'boarding', revision: 3, navigationRevision: 0, resumeBundle: bundle, navigationRoute: null };
  const flight = { lat: 48.27, lon: 8.43, altFt: 2200, onGround: true };
  const control = { executionAuthority: 'tracker', phase: 'boarding', manifest: bundle.runtime.cargoManifest, allowedActions: [] };
  const frozen = deepFreeze(JSON.parse(JSON.stringify(run)));
  const plain = JSON.parse(JSON.stringify(run));
  assert.deepEqual(projectTrackerEfbMissionView(frozen, { flight }, null, control, null, { pilotId: 'DEINA' }),
    projectTrackerEfbMissionView(plain, { flight }, null, control, null, { pilotId: 'DEINA' }));
  assert.deepEqual(projectTrackerMapSnapshot(frozen, { flight }), projectTrackerMapSnapshot(plain, { flight }));
  assert.deepEqual(projectTrackerMapSnapshot({ ...frozen, navigationRoute: null }, { flight }),
    projectTrackerMapSnapshot({ ...plain, navigationRoute: null }, { flight }));
  assert.deepEqual(missionRouteEnds(frozen), missionRouteEnds(plain));
  const shadow = createTrackerMissionShadow({ log() {} });
  assert.doesNotThrow(() => shadow.observeAuthorityResult({ ok: true, activeRun: frozen }, frozen, 'test'));
});

const realFile = process.env.GA_MISSION_AUTHORITY_SAMPLE;
test('echte Missionsdatei: Projektionen mit eingefrorenem Lauf', { skip: !realFile && 'GA_MISSION_AUTHORITY_SAMPLE nicht gesetzt' }, () => {
  const stored = JSON.parse(fs.readFileSync(realFile, 'utf8'));
  for (const run of [stored.activeRun, stored.lastRun].filter(Boolean)) {
    const frozen = deepFreeze(JSON.parse(JSON.stringify(run)));
    const plain = JSON.parse(JSON.stringify(run));
    const flight = { lat: 48.2769, lon: 8.4309, altFt: 2202, onGround: true };
    const control = { executionAuthority: 'tracker', phase: plain.phase, manifest: plain.executionState?.manifest, allowedActions: [] };
    assert.deepEqual(projectTrackerEfbMissionView(frozen, { flight }, null, control, null, { pilotId: 'DEINA' }),
      projectTrackerEfbMissionView(plain, { flight }, null, control, null, { pilotId: 'DEINA' }));
    assert.deepEqual(projectTrackerMapSnapshot(frozen, { flight }), projectTrackerMapSnapshot(plain, { flight }));
    assert.deepEqual(missionRouteEnds(frozen), missionRouteEnds(plain));
    const shadow = createTrackerMissionShadow({ log() {} });
    assert.doesNotThrow(() => shadow.observeAuthorityResult({ ok: true, activeRun: frozen }, frozen, 'real-file'));
  }
});
