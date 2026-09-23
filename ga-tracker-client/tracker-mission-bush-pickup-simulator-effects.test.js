'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const sceneCore = require('../mission-bush-pickup-scene-core.js');
const { EFFECT_PLAN_SCHEMA, createTrackerMissionSimulatorEffects } = require('./tracker-mission-simulator-effects.js');

function runWithBushPlan(overrides = {}) {
  return {
    missionId: 'bush-pickup-1', runId: 'run-bush-1', executionAuthority: 'tracker',
    resumeBundle: { executionEffectPlan: {
      schema: EFFECT_PLAN_SCHEMA, recipe: 'apt', missionId: 'bush-pickup-1', sceneId: 'home-scene',
      bushPickup: { voiceContext: { schema: 'ga.mission-bush-pickup-voice-context.v1', missionId: 'bush-pickup-1' }, pickupBoarding: {
        sceneId: 'pickup-strip-scene',
        personPoint: { worldLat: 48.0007, worldLon: 8.0012 },
        boardingConfig: { spawn: { forwardM: 16, rightM: -8, altOffsetFt: 0 }, target: { forwardM: 4.5, rightM: 8.5, altOffsetFt: 0 } },
        commonFields: { profile: 'app_preset', aircraftSlot: 'PA-24' }
      } },
      effects: {
        'scene.prepare': { none: true },
        'scene.boarding': { none: true },
        'scene.deboarding': { command: {
          type: 'mission_scene_deboarding', sceneId: 'home-scene', path: [{ forwardM: 5, rightM: 8 }, { forwardM: 15, rightM: -8 }],
          vehicleDeparture: true, vehicleArrival: true, vehicleReturn: true
        } },
        'scene.bush_pickup_clear': { command: {
          type: 'mission_scene_clear', sceneId: 'pickup-strip-scene', reason: 'pickup-confirmed'
        } }
      }
    } },
    ...overrides
  };
}

function request(run, commandId, type, payload = {}) {
  return { commandId, missionId: run.missionId, runId: run.runId, effect: { type, payload } };
}

test('Bush pickup alone permits explicit empty prepare and boarding effects', async () => {
  const run = runWithBushPlan();
  const commands = [];
  const bridge = createTrackerMissionSimulatorEffects({
    authorityManager: { getActiveRun: () => run },
    dispatchCommand: command => { commands.push(command); return { ok: true, status: 'pending' }; }
  });
  for (const [id, type] of [['empty-prepare', 'scene.prepare'], ['empty-board', 'scene.boarding']]) {
    const result = await bridge.dispatch(request(run, id, type));
    assert.equal(result.status, 'completed');
    assert.equal(result.sideEffect, false);
    assert.equal(result.sceneStatus, 'explicit_empty_scene');
  }
  assert.deepEqual(commands, []);
  const offlineBridge = createTrackerMissionSimulatorEffects({ authorityManager: { getActiveRun: () => run } });
  assert.equal((await offlineBridge.dispatch(request(run, 'offline-empty', 'scene.prepare'))).status, 'completed');

  delete run.resumeBundle.executionEffectPlan.bushPickup;
  const rejected = await bridge.dispatch(request(run, 'unlicensed-empty', 'scene.prepare'));
  assert.equal(rejected.error, 'mission_apt_effect_command_invalid');
});

test('manual Bush pickup dispatches core boarding command and settles through boarding ACK with 65-second timeout', async () => {
  const run = runWithBushPlan();
  const commands = [], acknowledgements = [];
  const timers = [];
  const position = { lat: 48, lon: 8, altFt: 1250, hdg: 90 };
  const bridge = createTrackerMissionSimulatorEffects({
    authorityManager: { getActiveRun: () => run },
    getLivePosition: () => position,
    now: () => 100000,
    setTimeout: (callback, delay) => { timers.push({ callback, delay }); return timers.length; },
    clearTimeout: () => {},
    dispatchCommand: command => { commands.push(command); return { ok: true, status: 'pending' }; },
    acknowledgeEffect: ack => { acknowledgements.push(ack); return { ok: true }; }
  });
  const requestData = request(run, 'pickup-board', 'scene.manual_pax', {
    bushPickup: true, requestedAt: 100000
  });
  assert.equal((await bridge.dispatch(requestData)).status, 'pending');
  await bridge.dispatch(requestData);
  assert.equal(commands.length, 1, 'duplicate dispatch must not replay boarding');
  const { commandId, missionId, runId, ...actualCommand } = commands[0];
  assert.deepEqual(actualCommand, sceneCore.buildCommand(
    run.resumeBundle.executionEffectPlan.bushPickup.pickupBoarding,
    { ...position, alt: position.altFt }
  ));
  assert.deepEqual([commandId, missionId, runId], ['pickup-board', run.missionId, run.runId]);
  assert.equal(timers[0].delay, 65000);
  assert.equal(bridge.handleAck({ type: 'mission_scene_boarding_ack', commandId, status: 'noop' }), true);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(acknowledgements[0].status, 'completed');
  assert.equal(acknowledgements[0].simulatorAck.type, 'mission_scene_boarding_ack');

  const timeoutRun = runWithBushPlan();
  const timeoutAcks = [];
  const timeoutBridge = createTrackerMissionSimulatorEffects({
    authorityManager: { getActiveRun: () => timeoutRun }, getLivePosition: () => position, now: () => 100000,
    setTimeout: (callback, delay) => { assert.equal(delay, 65000); timers.push({ callback, delay }); return 10; },
    clearTimeout: () => {}, dispatchCommand: () => ({ ok: true, status: 'pending' }),
    acknowledgeEffect: ack => { timeoutAcks.push(ack); return { ok: true }; }
  });
  await timeoutBridge.dispatch(request(timeoutRun, 'pickup-board-timeout', 'scene.manual_pax', {
    bushPickup: true, requestedAt: 100000
  }));
  timers.at(-1).callback();
  assert.equal(timeoutAcks[0].status, 'failed');
  assert.equal(timeoutAcks[0].simulatorAck.error, 'bush_pickup_boarding_timeout');
});

test('Bush pickup clear uses the planned command and accepts a noop ACK', async () => {
  const run = runWithBushPlan();
  const commands = [], acknowledgements = [];
  const bridge = createTrackerMissionSimulatorEffects({
    authorityManager: { getActiveRun: () => run },
    getLivePosition: () => null,
    dispatchCommand: command => { commands.push(command); return { ok: true, status: 'pending' }; },
    acknowledgeEffect: ack => { acknowledgements.push(ack); return { ok: true }; }
  });
  const dispatched = await bridge.dispatch(request(run, 'pickup-clear', 'scene.bush_pickup_clear'));
  assert.equal(dispatched.status, 'pending');
  assert.equal(commands[0].type, 'mission_scene_clear');
  assert.equal(commands[0].sceneId, 'pickup-strip-scene');
  assert.equal(commands[0].commandId, 'pickup-clear');
  assert.equal(bridge.handleAck({ type: 'mission_scene_clear_ack', commandId: 'pickup-clear', status: 'noop' }), true);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(acknowledgements[0].status, 'completed');
});

test('Bush return deboarding does not inherit the pickup-arrival vehicle suppression', async () => {
  const run = runWithBushPlan();
  const commands = [];
  const bridge = createTrackerMissionSimulatorEffects({
    authorityManager: {
      getActiveRun: () => run,
      getExecutionSnapshot: () => ({ state: { effects: [{ type: 'scene.arrival', status: 'completed' }] } })
    },
    getLivePosition: () => ({ lat: 48.3, lon: 8.5, altFt: 900, hdg: 180 }),
    dispatchCommand: command => { commands.push(command); return { ok: true, status: 'pending' }; }
  });
  await bridge.dispatch(request(run, 'bush-return-deboard', 'scene.deboarding', { coordinateFarewell: true }));
  assert.equal(commands[0].sceneId, 'home-scene');
  assert.equal(commands[0].coordinateFarewell, true);
  assert.equal(commands[0].deboardingPickupSceneId, undefined);
  assert.equal(commands[0].vehicleDeparture, true);
  assert.equal(commands[0].vehicleArrival, true);
  assert.equal(commands[0].vehicleReturn, true);
});
