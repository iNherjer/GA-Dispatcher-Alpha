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
          }
        }
      }
    },
    ...overrides
  };
}

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
