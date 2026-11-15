const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const core = require('./tracker-mission-boarding-layout-core');
const { createMissionAuthorityManager } = require('./mission-authority-core');

const oldSpawn = { forwardM: 16, rightM: -8, altOffsetFt: 0 };
const oldCargo = { forwardM: 4, rightM: 4, altOffsetFt: 0 };
const oldTarget = { forwardM: 4.5, rightM: 8.5, altOffsetFt: 0 };

function plan() {
  const walk = { path: [oldSpawn, oldCargo, oldTarget], cargoPathIndex: 1, spawnPoint: oldSpawn, targetPoint: oldTarget,
    aircraftSlot: 'PA-24', walkSpeedKts: 3.1, openDoor: true };
  return {
    schema: 'ga.mission-apt-effect-plan.v1', version: 1, recipe: 'apt', missionId: 'm', sceneId: 'scene-m',
    cargoPlacement: { ...oldCargo },
    manualPassengerCommands: [{ itemId: 'pax', operation: 'load', command: { type: 'mission_scene_manual_pax', ...walk,
      boardingPoint: { ...oldTarget }, targetPoint: { ...oldTarget } } }],
    effects: {
      'scene.prepare': { command: { type: 'mission_scene_spawn', sceneId: 'scene-m', items: [
        { kind: 'vehicle', objectTitle: 'Van', forwardM: 22, rightM: -12 },
        { kind: 'cargo', cargoItemId: 'box', objectTitle: 'Cardboard', forwardM: 4, rightM: 4, altOffsetFt: 0 },
        { kind: 'cargo_extra_1', cargoItemId: 'bag', objectTitle: 'Bag', forwardM: 4.6, rightM: 4.4, altOffsetFt: 0 },
        { kind: 'person_boarder_1', objectTitle: 'tarmac_a', forwardM: 16, rightM: -8, altOffsetFt: 0 },
        { kind: 'person_boarder_2', objectTitle: 'tarmac_b', forwardM: 19.5, rightM: -14, altOffsetFt: 0 },
        { kind: 'person_idle_2', objectTitle: 'tarmac_c', forwardM: 19, rightM: -11.5, altOffsetFt: 0 }
      ] } },
      'scene.boarding': { command: { type: 'mission_scene_boarding', sceneId: 'scene-m', durationMs: 18000, ...walk } },
      'scene.deboarding': { command: { type: 'mission_scene_deboarding', sceneId: 'scene-m', ...walk } }
    }
  };
}

const newSpawn = { forwardM: 14, rightM: -6, altOffsetFt: 0 };
const newCargo = { forwardM: 2, rightM: 6, altOffsetFt: 0 };
const newTarget = { forwardM: 4.5, rightM: 8.5, altOffsetFt: 0 };
const layout = (extra = {}) => ({ aircraftSlot: 'PA-24', spawn: newSpawn, cargo: newCargo, target: newTarget,
  path: [newSpawn, newCargo, newTarget], cargoIndex: 1, walkSpeedKts: 3.1, durationMs: 18000, openDoor: true, ...extra });

test('layout moves cargo and waiting boarders, keeps vehicle, crew and titles', () => {
  const result = core.applyLayout(plan(), layout());
  assert.equal(result.ok, true);
  assert.equal(result.changed, true);
  const items = Object.fromEntries(result.plan.effects['scene.prepare'].command.items.map(item => [item.kind, item]));
  assert.deepEqual([items.cargo.forwardM, items.cargo.rightM], [2, 6]);
  assert.deepEqual([items.cargo_extra_1.forwardM, items.cargo_extra_1.rightM], [2.6, 6.4]);
  assert.deepEqual([items.person_boarder_1.forwardM, items.person_boarder_1.rightM], [14, -6]);
  assert.deepEqual([items.person_boarder_2.forwardM, items.person_boarder_2.rightM], [19.5, -14]);
  assert.deepEqual([items.vehicle.forwardM, items.person_idle_2.forwardM], [22, 19]);
  assert.equal(items.person_boarder_1.objectTitle, 'tarmac_a');
  const boarding = result.plan.effects['scene.boarding'].command;
  assert.deepEqual(boarding.path, [newSpawn, newCargo, newTarget]);
  assert.deepEqual(boarding.spawnPoint, newSpawn);
  assert.deepEqual(result.plan.effects['scene.deboarding'].command.path, [newSpawn, newCargo, newTarget]);
  assert.deepEqual(result.plan.cargoPlacement, newCargo);
  assert.equal(result.plan.boardingLayoutRevision, 1);
  assert.deepEqual(core.planLayout(result.plan).cargo, newCargo);
});

test('manual passenger recipe follows a moved boarding point', () => {
  const target = { forwardM: 3, rightM: 9, altOffsetFt: 0 };
  const result = core.applyLayout(plan(), layout({ target, path: [newSpawn, newCargo, target] }));
  const command = result.plan.manualPassengerCommands[0].command;
  assert.deepEqual(command.boardingPoint, target);
  assert.deepEqual(command.targetPoint, target);
});

test('unchanged layout is a noop, invalid or foreign layouts are refused', () => {
  const same = core.applyLayout(plan(), layout({ spawn: oldSpawn, cargo: oldCargo, target: oldTarget, path: [oldSpawn, oldCargo, oldTarget] }));
  assert.equal(same.ok, true);
  assert.equal(same.changed, false);
  assert.equal(core.applyLayout(plan(), layout({ aircraftSlot: 'C172' })).error, 'boarding_layout_aircraft_mismatch');
  assert.equal(core.applyLayout(plan(), layout({ cargo: { forwardM: 99, rightM: 0 } })).error, 'boarding_layout_point_invalid');
  assert.equal(core.applyLayout(plan(), layout({ cargoIndex: 2 })).error, 'boarding_layout_path_mismatch');
  const bush = plan();
  bush.effects['scene.prepare'] = { none: true };
  assert.equal(core.applyLayout(bush, layout()).error, 'boarding_layout_not_supported');
});

test('marker scene uses the plan scene and every boarding point', () => {
  const items = core.buildMarkerItems(core.applyLayout(plan(), layout()).plan);
  assert.equal(core.markerSceneId(plan()), 'scene-m-boarding-markers');
  assert.equal(core.isMarkerSceneId('scene-m-boarding-markers'), true);
  assert.equal(core.isMarkerSceneId('scene-m'), false);
  assert.deepEqual(items.map(item => [item.label, item.forwardM, item.rightM]),
    [['Boarding Spawn Marker', 14, -6], ['Boarding Cargo Marker', 2, 6], ['Boarding Boarding Marker', 4.5, 8.5]]);
});

function authorityFixture(t, executionState) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'boarding-layout-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const storageFile = path.join(dir, 'mission.json');
  fs.writeFileSync(storageFile, JSON.stringify({ schema: 'ga.mission-authority.v1', version: 1, events: [], activeRun: {
    missionId: 'm', runId: 'run1', ownerClientId: 'app1', executionAuthority: 'tracker', executionRecipe: 'apt',
    state: 'active', phase: executionState.phase, revision: 7, stateHash: 'x', executionStateHash: 'x', executionState,
    resumeBundle: { adapter: 'apt', missionState: { currentMissionData: { missionId: 'm' } }, executionEffectPlan: plan() }
  } }));
  return { manager: createMissionAuthorityManager({ storageFile }), reload: () => createMissionAuthorityManager({ storageFile }) };
}

test('authority stores the layout before boarding and keeps it across a restart', t => {
  const f = authorityFixture(t, { phase: 'prepare', flags: {}, effects: [{ type: 'scene.prepare', status: 'completed' }],
    manifest: { items: [{ id: 'box', status: 'pending' }, { id: 'kit', status: 'loaded', persistentEquipment: true }] } });
  const result = f.manager.updateExecutionBoardingLayout({ missionId: 'm', runId: 'run1', layout: layout() });
  assert.equal(result.ok, true);
  assert.equal(result.changed, true);
  assert.equal(result.activeRun.revision, 8);
  assert.deepEqual(f.reload().getExecutionEffectPlan().cargoPlacement, newCargo);
  assert.equal(f.manager.updateExecutionBoardingLayout({ missionId: 'm', runId: 'run1', layout: layout() }).status, 'noop');
  assert.equal(f.manager.updateExecutionBoardingLayout({ missionId: 'm', runId: 'other', layout: layout() }).error, 'mission_run_conflict');
});

test('authority refuses the layout once boarding began or cargo moved', t => {
  for (const [state, error] of [
    [{ phase: 'boarding', flags: {}, effects: [{ type: 'scene.boarding', status: 'requested' }] }, 'boarding_layout_locked'],
    [{ phase: 'prepare', flags: { boardingSceneConfirmed: true }, effects: [] }, 'boarding_layout_locked'],
    [{ phase: 'prepare', flags: {}, effects: [], manifest: { items: [{ id: 'box', status: 'loaded' }] } }, 'boarding_layout_cargo_moved']
  ]) {
    const f = authorityFixture(t, state);
    assert.equal(f.manager.updateExecutionBoardingLayout({ missionId: 'm', runId: 'run1', layout: layout() }).error, error);
    assert.deepEqual(f.manager.getExecutionEffectPlan().cargoPlacement, oldCargo);
  }
});

const executionCore = require('../mission-execution-core.js');
const { createTrackerMissionExecutionRuntime } = require('./tracker-mission-execution-runtime.js');

function runtimeBundle() {
  const missionId = 'mission-layout';
  const effectPlan = plan();
  effectPlan.missionId = missionId;
  const bundle = {
    version: 2, missionId, adapter: 'apt', descriptor: { primaryAdapter: 'apt' },
    missionState: { currentMissionData: { missionId, missionType: 'apt', start: 'EDTW', dest: 'EDTL', aptArrivalPlan: { lat: 48.3, lon: 8.5 } } },
    runtime: { missionId, startPhase: 'planned',
      lastLiveFlightData: { onGround: true, gsKts: 0, simPaused: false, inMenuOrMap: false },
      runtime: { missionId, phase: 'planned', active: false },
      cargoManifest: { version: 6, key: 'layout-manifest', dispatchSignature: { scope: 'departure' },
        items: [{ id: 'box', itemType: 'cargo', status: 'pending' }, { id: 'pax', itemType: 'passenger', status: 'pending', passengerCount: 1 }] } },
    executionEffectPlan: effectPlan
  };
  bundle.executionReplay = executionCore.createExecutionBundle(bundle);
  bundle.execution = executionCore.createReplayShadowEnvelope(bundle.executionReplay, { sourceRevision: 1, legacyBundle: bundle });
  return bundle;
}

async function waitUntil(predicate, attempts = 60) {
  for (let index = 0; index < attempts; index += 1) {
    if (predicate()) return true;
    await new Promise(resolve => setTimeout(resolve, 5));
  }
  return false;
}

test('runtime rebuilds the start scene with the new layout, places markers and clears them at boarding', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'boarding-layout-runtime-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const bundle = runtimeBundle();
  const manager = createMissionAuthorityManager({ storageFile: path.join(dir, 'authority.json'), idFactory: () => 'run-layout', executionAuthorityEnabled: true });
  const replay = executionCore.replay(bundle.executionReplay);
  const acquired = manager.acquire({ missionId: bundle.missionId, clientId: 'web', stateHash: 'web-state', resumeBundle: bundle });
  const prepared = manager.prepareExecutionAuthority({ missionId: bundle.missionId, runId: acquired.activeRun.runId, clientId: 'web',
    expectedRevision: acquired.activeRun.revision, expectedStateHash: acquired.activeRun.stateHash, expectedExecutionStateHash: replay.stateHash });
  assert.equal(manager.commitExecutionAuthority({ missionId: bundle.missionId, runId: prepared.activeRun.runId, clientId: 'web',
    expectedRevision: prepared.activeRun.revision, expectedExecutionStateHash: prepared.activeRun.executionStateHash,
    handoffId: prepared.handoff.handoffId }).ok, true);
  const commands = [];
  const runtime = createTrackerMissionExecutionRuntime({ authorityManager: manager, enabled: true,
    playBoardingVoice: () => ({ ok: true, status: 'completed', sideEffect: false }), log: () => {} });
  const bridge = runtime.attachSimulator({
    getLivePosition: () => ({ lat: 48.01, lon: 8.02, alt: 1200, hdg: 180 }),
    syncPayloadBeforeStart: () => ({ ok: true, status: 'completed', sideEffect: false }),
    dispatchCommand: command => { commands.push(command); return { ok: true, status: 'pending', sideEffect: true }; }
  });
  const intent = async (name, payload = {}) => {
    const run = manager.getActiveRun();
    return runtime.executeIntent({ commandId: `intent-${name}-${commands.length}-${Math.random()}`, intent: name,
      missionId: run.missionId, runId: run.runId, expectedRevision: run.revision, payload });
  };
  assert.equal((await intent('prepare_mission')).ok, true);
  assert.equal(commands[0].type, 'mission_scene_spawn');
  bridge.handleAck({ type: 'mission_scene_spawn_ack', commandId: commands[0].commandId, status: 'ok' });
  assert.equal(await waitUntil(() => manager.getExecutionSnapshot().view.allowedActions.includes('start_boarding')), true);

  const updated = await intent('update_boarding_layout', { layout: layout(), markers: true });
  assert.equal(updated.ok, true, JSON.stringify(updated));
  assert.deepEqual(updated.boardingLayout, { changed: true, layoutRevision: 1, scene: 'respawned', markers: 'spawned' });
  assert.equal(await waitUntil(() => commands.length === 3), true, JSON.stringify(commands.map(c => c.type)));
  const respawn = commands.find(command => command.sceneId === 'scene-m' && command !== commands[0]);
  assert.deepEqual(respawn.items.find(item => item.kind === 'cargo').forwardM, 2);
  assert.equal(Number.isFinite(respawn.lat), true);
  const markers = commands.find(command => command.sceneId === 'scene-m-boarding-markers');
  assert.equal(markers.type, 'mission_scene_spawn');
  assert.equal(markers.items.length, 3);
  assert.equal(manager.getExecutionSnapshot().state.effects.filter(effect => effect.type === 'scene.prepare').length, 1,
    'the rebuild must not add an effect to the execution state');

  assert.equal((await intent('start_boarding')).ok, true);
  assert.equal(await waitUntil(() => commands.some(command => command.type === 'mission_scene_clear')), true);
  assert.equal(commands.find(command => command.type === 'mission_scene_clear').sceneId, 'scene-m-boarding-markers');
  assert.equal(await waitUntil(() => commands.some(command => command.type === 'mission_scene_boarding')), true, JSON.stringify({ types: commands.map(c => c.type + ':' + c.sceneId), effects: manager.getExecutionSnapshot().state.effects.map(e => e.type + ':' + e.status) }));
  assert.deepEqual(commands.find(command => command.type === 'mission_scene_boarding').path, [newSpawn, newCargo, newTarget]);
  assert.equal((await intent('update_boarding_layout', { layout: layout({ spawn: oldSpawn, path: [oldSpawn, newCargo, newTarget] }) })).error,
    'boarding_layout_locked');
});
