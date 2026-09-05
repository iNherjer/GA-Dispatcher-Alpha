'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  EFFECT_PLAN_SCHEMA,
  createTrackerMissionSimulatorEffects
} = require('./tracker-mission-simulator-effects.js');

function runWithPlan(overrides = {}) {
  return {
    missionId: 'mission-apt-1',
    runId: 'run-1',
    executionAuthority: 'tracker',
    resumeBundle: {
      executionEffectPlan: {
        schema: EFFECT_PLAN_SCHEMA,
        recipe: 'apt',
        missionId: 'mission-apt-1',
        sceneId: 'scene-mission-apt-1',
        cargoPlacement: { forwardM: 4, rightM: 5, altOffsetFt: 0.2 },
        effects: {
          'scene.prepare': {
            command: {
              type: 'mission_scene_spawn',
              sceneId: 'scene-mission-apt-1',
              lat: 1,
              lon: 2,
              altFt: 3,
              hdg: 4,
              items: [{ kind: 'person_boarder_1', objectTitle: 'Tarmac_Male' }]
            }
          },
          'scene.boarding': {
            command: {
              type: 'mission_scene_boarding',
              sceneId: 'scene-mission-apt-1',
              path: [
                { forwardM: 16, rightM: -8 },
                { forwardM: 4.5, rightM: 8.5 }
              ]
            }
          },
          'scene.deboarding': {
            command: {
              type: 'mission_scene_deboarding',
              sceneId: 'scene-mission-apt-1',
              path: [
                { forwardM: 4.5, rightM: 8.5 },
                { forwardM: 16, rightM: -8 }
              ]
            }
          },
          'scene.compliance_visit': {
            command: {
              type: 'mission_scene_ground_visit',
              sceneId: 'scene-mission-apt-1-authority-inspection',
              vehicleArrivalPath: [
                { forwardM: -24, rightM: 18 },
                { forwardM: 22, rightM: 12 }
              ],
              visitorPaths: [
                { id: 'one', path: [{ forwardM: 21, rightM: 11 }, { forwardM: 4.5, rightM: 8.5 }] },
                { id: 'two', path: [{ forwardM: 22, rightM: 13 }, { forwardM: 4.9, rightM: 4.5 }] }
              ]
            }
          }
        }
      }
    },
    ...overrides
  };
}

test('cargo transitions remove loaded objects and spawn unloaded objects through the tracker scene bridge', async () => {
  const activeRun = runWithPlan();
  const commands = [];
  const bridge = createTrackerMissionSimulatorEffects({
    authorityManager: { getActiveRun: () => activeRun },
    getLivePosition: () => ({ lat: 48.1, lon: 7.9, alt: 510, hdg: 90 }),
    dispatchCommand: command => {
      commands.push(command);
      return { ok: true, status: 'pending' };
    },
    acknowledgeEffect: () => ({ ok: true })
  });
  const item = {
    id: 'club-bag',
    itemType: 'cargo',
    sceneKind: 'cargo',
    label: 'Clubtasche',
    objectTitle: 'Cardboard',
    forwardM: 1,
    rightM: -2
  };
  const loaded = await bridge.dispatch({
    commandId: 'cargo-load-effect',
    missionId: activeRun.missionId,
    runId: activeRun.runId,
    effect: { type: 'scene.cargo_item_transition', payload: { action: 'load', itemId: item.id, manifestKey: 'manifest-a', item } }
  });
  assert.equal(loaded.status, 'pending');
  assert.equal(commands[0].type, 'mission_scene_object_remove');
  assert.equal(commands[0].allScenes, true);
  assert.equal(commands[0].itemIds[0], 'club-bag');
  bridge.handleAck({ type: 'mission_scene_object_remove_ack', commandId: 'cargo-load-effect', status: 'ok' });

  const unloaded = await bridge.dispatch({
    commandId: 'cargo-unload-effect',
    missionId: activeRun.missionId,
    runId: activeRun.runId,
    effect: { type: 'scene.cargo_item_transition', payload: { action: 'unload', itemId: item.id, manifestKey: 'manifest-a', item } }
  });
  assert.equal(unloaded.status, 'pending');
  assert.equal(commands[1].type, 'mission_scene_object_spawn');
  assert.equal(commands[1].sceneId, 'scene-mission-apt-1-cargo-unload');
  assert.equal(commands[1].items[0].forwardM, 5);
  assert.equal(commands[1].items[0].rightM, 3);
});

test('APT simulator effects reuse the prepared app command and force live tracker position plus stable IDs', async () => {
  let activeRun = runWithPlan();
  const commands = [];
  const acknowledgements = [];
  const bridge = createTrackerMissionSimulatorEffects({
    authorityManager: {
      getActiveRun: () => activeRun
    },
    getLivePosition: () => ({ lat: 48.123, lon: 11.456, alt: 1730, hdg: 271 }),
    dispatchCommand: command => {
      commands.push(command);
      return { ok: true, status: 'pending' };
    },
    acknowledgeEffect: request => {
      acknowledgements.push(request);
      return { ok: true };
    }
  });

  const dispatched = await bridge.dispatch({
    commandId: 'run-1:effect:prepare',
    missionId: activeRun.missionId,
    runId: activeRun.runId,
    effect: { type: 'scene.prepare' }
  });
  assert.equal(dispatched.status, 'pending');
  assert.equal(commands.length, 1);
  assert.deepEqual({
    type: commands[0].type,
    commandId: commands[0].commandId,
    missionId: commands[0].missionId,
    runId: commands[0].runId,
    lat: commands[0].lat,
    lon: commands[0].lon,
    altFt: commands[0].altFt,
    hdg: commands[0].hdg
  }, {
    type: 'mission_scene_spawn',
    commandId: 'run-1:effect:prepare',
    missionId: 'mission-apt-1',
    runId: 'run-1',
    lat: 48.123,
    lon: 11.456,
    altFt: 1730,
    hdg: 271
  });
  assert.equal(commands[0].items[0].kind, 'person_boarder_1');
  assert.equal(bridge.pendingCount(), 1);

  assert.equal(bridge.handleAck({
    type: 'mission_scene_spawn_ack',
    commandId: 'run-1:effect:prepare',
    status: 'ok'
  }), true);
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(acknowledgements, [{
    effectId: 'run-1:effect:prepare',
    status: 'completed',
    simulatorAck: {
      type: 'mission_scene_spawn_ack',
      status: 'ok',
      error: null
    }
  }]);
  assert.equal(bridge.pendingCount(), 0);
});

test('boarding failures are terminal acknowledgements while unrelated ACKs remain untouched', async () => {
  const acknowledgements = [];
  const bridge = createTrackerMissionSimulatorEffects({
    authorityManager: { getActiveRun: () => runWithPlan() },
    getLivePosition: () => ({ lat: 48, lon: 11, altFt: 1500, hdg: 90 }),
    dispatchCommand: () => ({ ok: true, status: 'pending' }),
    acknowledgeEffect: request => acknowledgements.push(request)
  });
  await bridge.dispatch({
    commandId: 'effect-boarding',
    missionId: 'mission-apt-1',
    runId: 'run-1',
    effect: { type: 'scene.boarding' }
  });
  assert.equal(bridge.handleAck({ type: 'mission_scene_spawn_ack', commandId: 'effect-boarding', status: 'ok' }), false);
  assert.equal(bridge.pendingCount(), 1);
  assert.equal(bridge.handleAck({
    type: 'mission_scene_boarding_ack',
    commandId: 'effect-boarding',
    status: 'noop',
    error: 'no_scene'
  }), true);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(acknowledgements[0].status, 'failed');
  assert.equal(acknowledgements[0].simulatorAck.error, 'no_scene');
});

test('deboarding uses the planned path with the current tracker position', async () => {
  const commands = [];
  const bridge = createTrackerMissionSimulatorEffects({
    authorityManager: { getActiveRun: () => runWithPlan() },
    getLivePosition: () => ({ lat: 48.3, lon: 8.5, altFt: 900, hdg: 180 }),
    dispatchCommand: command => {
      commands.push(command);
      return { ok: true, status: 'pending' };
    }
  });
  const result = await bridge.dispatch({
    commandId: 'effect-deboarding',
    missionId: 'mission-apt-1',
    runId: 'run-1',
    effect: { type: 'scene.deboarding' }
  });
  assert.equal(result.status, 'pending');
  assert.equal(commands.length, 1);
  assert.equal(commands[0].type, 'mission_scene_deboarding');
  assert.equal(commands[0].lat, 48.3);
  assert.equal(commands[0].lon, 8.5);
  assert.equal(commands[0].altFt, 900);
  assert.equal(commands[0].hdg, 180);
  assert.equal(commands[0].commandId, 'effect-deboarding');
});

test('coordinated deboarding forwards the cue stage and continues only with the original effect id', async () => {
  const commands = [];
  const stages = [];
  const bridge = createTrackerMissionSimulatorEffects({
    authorityManager: { getActiveRun: () => runWithPlan() },
    getLivePosition: () => ({ lat: 48.3, lon: 8.5, altFt: 900, hdg: 180 }),
    dispatchCommand: command => {
      commands.push(command);
      return { ok: true, status: command.type === 'mission_scene_deboarding' ? 'pending' : 'completed', sideEffect: true };
    },
    onStage: stage => stages.push(stage)
  });
  await bridge.dispatch({
    commandId: 'effect-deboarding-farewell',
    missionId: 'mission-apt-1',
    runId: 'run-1',
    effect: { type: 'scene.deboarding', payload: { coordinateFarewell: true } }
  });
  assert.equal(commands[0].coordinateFarewell, true);
  assert.equal(bridge.handleAck({
    type: 'mission_scene_deboarding_stage',
    commandId: 'effect-deboarding-farewell',
    stage: 'cue',
    status: 'ok'
  }), true);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(stages.length, 1);
  assert.equal(stages[0].coordinateFarewell, true);
  assert.equal(stages[0].stage, 'cue');
  assert.equal(bridge.pendingCount(), 1);

  const continued = await bridge.dispatch({
    commandId: 'effect-farewell-continue',
    missionId: 'mission-apt-1',
    runId: 'run-1',
    effect: {
      type: 'scene.deboarding_continue',
      payload: { deboardingEffectId: 'effect-deboarding-farewell' }
    }
  });
  assert.equal(continued.status, 'completed');
  assert.equal(commands[1].type, 'mission_scene_deboarding_continue');
  assert.equal(commands[1].deboardingCommandId, 'effect-deboarding-farewell');
  assert.equal(commands[1].sceneId, 'scene-mission-apt-1');
});

test('compliance visit uses the App plan, forwards inspector arrival and releases the same visit', async () => {
  const commands = [];
  const stages = [];
  const acknowledgements = [];
  const bridge = createTrackerMissionSimulatorEffects({
    authorityManager: { getActiveRun: () => runWithPlan() },
    getLivePosition: () => ({ lat: 48.3, lon: 8.5, altFt: 900, hdg: 180 }),
    dispatchCommand: command => {
      commands.push(command);
      return { ok: true, status: command.type === 'mission_scene_ground_visit' ? 'pending' : 'completed', sideEffect: true };
    },
    onStage: stage => stages.push(stage),
    acknowledgeEffect: request => acknowledgements.push(request)
  });
  const visit = await bridge.dispatch({
    commandId: 'effect-compliance-visit',
    missionId: 'mission-apt-1',
    runId: 'run-1',
    effect: { type: 'scene.compliance_visit' }
  });
  assert.equal(visit.status, 'pending');
  assert.equal(commands[0].type, 'mission_scene_ground_visit');
  assert.equal(commands[0].lat, 48.3);
  assert.equal(commands[0].visitorPaths.length, 2);
  assert.equal(bridge.handleAck({
    type: 'mission_scene_ground_visit_stage',
    commandId: 'effect-compliance-visit',
    stage: 'visitors_at_aircraft',
    status: 'ok'
  }), true);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(stages[0].stage, 'visitors_at_aircraft');
  assert.equal(acknowledgements.length, 0);

  const departure = await bridge.dispatch({
    commandId: 'effect-compliance-departure',
    missionId: 'mission-apt-1',
    runId: 'run-1',
    effect: { type: 'scene.compliance_departure' }
  });
  assert.equal(departure.status, 'completed');
  assert.equal(commands[1].type, 'mission_scene_ground_visit_release');
  assert.equal(commands[1].visitCommandId, 'effect-compliance-visit');
  assert.equal(commands[1].sceneId, 'scene-mission-apt-1-authority-inspection');

  assert.equal(bridge.handleAck({
    type: 'mission_scene_ground_visit_ack',
    commandId: 'effect-compliance-visit',
    status: 'ok'
  }), true);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(acknowledgements[0].effectId, 'effect-compliance-visit');
  assert.equal(acknowledgements[0].status, 'completed');
});

test('unavailable compliance scene follows the App logical fallback instead of hard-locking', async () => {
  const activeRun = runWithPlan({ resumeBundle: {} });
  const bridge = createTrackerMissionSimulatorEffects({
    authorityManager: { getActiveRun: () => activeRun },
    getLivePosition: () => null
  });
  const result = await bridge.dispatch({
    commandId: 'effect-compliance-fallback',
    missionId: 'mission-apt-1',
    runId: 'run-1',
    effect: { type: 'scene.compliance_visit' }
  });
  assert.equal(result.ok, true);
  assert.equal(result.status, 'completed');
  assert.equal(result.logicalFallback, true);
});

test('invalid or missing effect plans never reach the simulator handler', async () => {
  let dispatchCount = 0;
  let activeRun = runWithPlan({ resumeBundle: {} });
  const bridge = createTrackerMissionSimulatorEffects({
    authorityManager: { getActiveRun: () => activeRun },
    getLivePosition: () => ({ lat: 48, lon: 11 }),
    dispatchCommand: () => {
      dispatchCount += 1;
      return { ok: true };
    }
  });
  const missing = await bridge.dispatch({
    commandId: 'effect-1',
    missionId: 'mission-apt-1',
    runId: 'run-1',
    effect: { type: 'scene.prepare' }
  });
  assert.equal(missing.error, 'mission_apt_effect_plan_missing');

  activeRun = runWithPlan();
  activeRun.resumeBundle.executionEffectPlan.effects['scene.prepare'].command.type = 'mission_scene_clear_all';
  const invalid = await bridge.dispatch({
    commandId: 'effect-2',
    missionId: 'mission-apt-1',
    runId: 'run-1',
    effect: { type: 'scene.prepare' }
  });
  assert.equal(invalid.error, 'mission_apt_effect_command_invalid');
  assert.equal(dispatchCount, 0);
});

test('close effect completes without a simulator scene command', async () => {
  const bridge = createTrackerMissionSimulatorEffects({
    authorityManager: { getActiveRun: () => runWithPlan() }
  });
  assert.deepEqual(await bridge.dispatch({
    commandId: 'effect-close',
    missionId: 'mission-apt-1',
    runId: 'run-1',
    effect: { type: 'mission.close_requested' }
  }), {
    ok: true,
    status: 'completed',
    sideEffect: false,
    commandId: 'effect-close'
  });
});
