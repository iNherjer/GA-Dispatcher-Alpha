import assert from 'node:assert/strict';
import trainingProcedure from '../mission-training-procedure.js';

const { tickState, createInitialState } = trainingProcedure._test;

function sample({ t, alt = 3000, agl = 2500, hdg = 0, bank = 0, pitch = 0, ias = 90, vs = 0, aoa = 4, stall = false, departure = 6 }) {
  return {
    nowMs: t * 1000,
    altFt: alt,
    aglFt: agl,
    headingDeg: ((hdg % 360) + 360) % 360,
    bankDeg: bank,
    pitchDeg: pitch,
    iasKts: ias,
    vsFpm: vs,
    aoaDeg: aoa,
    stallState: stall,
    gForce: 1.1,
    departureDistanceNm: departure,
    onGround: false
  };
}

function tick(recipe, state, s) {
  const result = tickState(recipe, state, s);
  return result.state;
}

function markReady(state) {
  state.departureGatePassed = true;
  state.ready = true;
  state.readyPrompted = true;
  return state;
}

function testTurn180() {
  const recipe = {
    schema: 'ga.trainingRecipe.v1',
    key: 'test-turn-180',
    exercises: [{
      id: 'turn_180_test',
      type: 'turn_180',
      label: '180 Test',
      targetBankDeg: 30,
      maxAltitudeDeltaFt: 50,
      stableSec: 1
    }]
  };
  let state = markReady(createInitialState(trainingProcedure.normalizeRecipe(recipe)));
  state = tick(recipe, state, sample({ t: 0, hdg: 0, bank: 0 }));
  for (let i = 1; i <= 18; i++) {
    state = tick(recipe, state, sample({ t: i, hdg: i * 10, bank: 30 }));
  }
  state = tick(recipe, state, sample({ t: 19, hdg: 180, bank: 5 }));
  state = tick(recipe, state, sample({ t: 21, hdg: 181, bank: 2 }));
  assert.equal(state.satisfied, true, '180-degree turn should complete');
}

function testTurn360UsesManualReference() {
  const recipe = {
    schema: 'ga.trainingRecipe.v1',
    key: 'test-turn-360-reference',
    exercises: [{
      id: 'turn_360_test',
      type: 'constant_bank_360',
      label: '360 Test',
      targetBankDeg: 30,
      maxAltitudeDeltaFt: 50,
      stableSec: 1
    }]
  };
  let state = markReady(createInitialState(trainingProcedure.normalizeRecipe(recipe)));
  state = tick(recipe, state, sample({ t: 0, alt: 3500, hdg: 270, bank: 0 }));
  assert.equal(state.active?.startHeadingDeg, 270, 'manual start tick must define the turn reference heading');
  assert.equal(state.active?.startAltFt, 3500, 'manual start tick must define the turn reference altitude');
  for (let i = 1; i <= 36; i++) {
    state = tick(recipe, state, sample({ t: i, alt: 3500, hdg: 270 + i * 10, bank: 30 }));
  }
  state = tick(recipe, state, sample({ t: 37, alt: 3500, hdg: 270, bank: 5 }));
  state = tick(recipe, state, sample({ t: 39, alt: 3500, hdg: 271, bank: 2 }));
  assert.equal(state.satisfied, true, '360-degree turn should finish on the manually captured reference heading');
}

function testStallBreakRecovery() {
  const recipe = {
    schema: 'ga.trainingRecipe.v1',
    key: 'test-stall',
    stallMinAglFt: 1500,
    exercises: [{
      id: 'stall_test',
      type: 'stall_recovery',
      label: 'Stall Test',
      setupStableSec: 1,
      recoveryStableSec: 1,
      targetAoaDeg: 12
    }]
  };
  let state = markReady(createInitialState(trainingProcedure.normalizeRecipe(recipe)));
  state = tick(recipe, state, sample({ t: 0, alt: 4000, agl: 3000, hdg: 90, pitch: 3, ias: 80, aoa: 5 }));
  state = tick(recipe, state, sample({ t: 2, alt: 4000, agl: 3000, hdg: 90, pitch: 4, ias: 78, aoa: 6 }));
  state = tick(recipe, state, sample({ t: 4, alt: 3995, agl: 2995, hdg: 90, pitch: 8, ias: 62, aoa: 12, stall: true }));
  state = tick(recipe, state, sample({ t: 5, alt: 3940, agl: 2940, hdg: 94, bank: 20, pitch: 2, ias: 58, vs: -900, aoa: 15, stall: true }));
  state = tick(recipe, state, sample({ t: 7, alt: 3880, agl: 2880, hdg: 94, bank: 6, pitch: 1, ias: 76, vs: -100, aoa: 8, stall: false }));
  state = tick(recipe, state, sample({ t: 9, alt: 3890, agl: 2890, hdg: 94, bank: 3, pitch: 2, ias: 82, vs: 100, aoa: 6, stall: false }));
  assert.equal(state.satisfied, true, 'stall recovery should complete after confirmed break and stable recovery');
  assert.ok(state.exercises[0].summary.heightLossFt >= 50, 'stall summary should include height loss');
}

function testRequiredGateAndOptionalRequest() {
  const recipe = {
    schema: 'ga.trainingRecipe.v1',
    key: 'test-required-gate',
    requiredCount: 1,
    exercises: [{
      id: 'turn_180_required',
      type: 'turn_180',
      label: '180 Required',
      targetBankDeg: 30,
      stableSec: 1
    }, {
      id: 'turn_180_optional',
      type: 'turn_180',
      label: '180 Optional',
      targetBankDeg: 30,
      stableSec: 1
    }]
  };
  let state = createInitialState(trainingProcedure.normalizeRecipe(recipe));
  let result = tickState(recipe, state, sample({ t: 0, hdg: 0, bank: 0, departure: 4.9 }));
  assert.equal(result.state.departureGatePassed, false, 'training must remain locked inside five nautical miles');
  assert.equal(result.events.length, 0, 'departure gate must suppress premature altitude warnings and instructions');
  result = tickState(recipe, result.state, sample({ t: 1, hdg: 0, bank: 0, departure: 5.1 }));
  assert.equal(result.state.readyPrompted, true, 'training should wait for pilot ready at altitude');
  assert.equal(result.state.active, null, 'no exercise should start before ready');
  result = tickState(recipe, result.state, sample({ t: 4, hdg: 0, bank: 0, departure: 5.2 }));
  assert.equal(result.state.startAvailable, true, 'start button should unlock only after a stable setup');
  state = markReady(result.state);
  state = tick(recipe, state, sample({ t: 5, hdg: 0, bank: 0 }));
  for (let i = 6; i <= 23; i++) state = tick(recipe, state, sample({ t: i, hdg: (i - 5) * 10, bank: 30 }));
  state = tick(recipe, state, sample({ t: 24, hdg: 180, bank: 5 }));
  state = tick(recipe, state, sample({ t: 26, hdg: 181, bank: 2 }));
  assert.equal(state.requiredComplete, true, 'required part should complete after first exercise');
  assert.equal(state.satisfied, true, 'mission should be satisfied after required exercises');
  assert.equal(state.activeIndex, 1, 'optional exercise should remain pending');
  state.optionalRequested = true;
  state.ready = false;
  state.readyPrompted = true;
  state.startAvailable = true;
  state = markReady(state);
  result = tickState(recipe, state, sample({ t: 28, hdg: 181, bank: 0 }));
  assert.equal(result.state.active?.exerciseId, 'turn_180_optional', 'optional exercise should start only after request');
}

function testFeedbackThrottleAndFailureReset() {
  const recipe = trainingProcedure.normalizeRecipe({
    schema: 'ga.trainingRecipe.v1',
    key: 'test-feedback-reset',
    exercises: [{
      id: 'turn_feedback',
      type: 'constant_bank_360',
      label: 'Feedback turn',
      targetBankDeg: 30,
      stableSec: 1
    }]
  });
  let state = markReady(createInitialState(recipe));
  let result = tickState(recipe, state, sample({ t: 0, hdg: 20, bank: 0, alt: 3200 }));
  state = result.state;
  result = tickState(recipe, state, sample({ t: 1, hdg: 25, bank: 30, alt: 3200 }));
  state = result.state;
  result = tickState(recipe, state, sample({ t: 2, hdg: 35, bank: 30, alt: 3200 }));
  assert.ok(result.events.some(event => event.type === 'training_values_correct'), 'reaching target values should be confirmed once');
  state = result.state;
  result = tickState(recipe, state, sample({ t: 3, hdg: 45, bank: 20, alt: 3200 }));
  assert.ok(result.events.some(event => event.type === 'training_values_deviation'), 'leaving target values should be announced immediately');
  state = result.state;
  result = tickState(recipe, state, sample({ t: 8, hdg: 55, bank: 20, alt: 3200 }));
  assert.ok(!result.events.some(event => event.type === 'training_values_deviation'), 'deviation feedback must not repeat inside ten seconds');
  state = result.state;
  result = tickState(recipe, state, sample({ t: 13, hdg: 65, bank: 20, alt: 3200 }));
  assert.ok(result.events.some(event => event.type === 'training_values_deviation'), 'persistent deviation may repeat after ten seconds');
  state = result.state;
  result = tickState(recipe, state, sample({ t: 14, hdg: 75, bank: 65, alt: 3450 }));
  state = result.state;
  result = tickState(recipe, state, sample({ t: 25, hdg: 85, bank: 65, alt: 3450 }));
  assert.equal(result.state.active, null, 'an out-of-control exercise should stop instead of looping');
  assert.equal(result.state.ready, false, 'a failed exercise must require a new manual start');
  assert.equal(result.state.readyPrompted, false, 'a failed exercise must return to a fresh briefing/setup gate');
}

function testManualStartAndAbortApi() {
  trainingProcedure.reset();
  const passenger = {
    taskDomain: 'training',
    trainingRecipe: {
      key: 'test-api-abort',
      requiredCount: 1,
      exercises: [{ id: 'api_turn', type: 'turn_180', label: 'API turn', targetBankDeg: 30 }]
    }
  };
  const missionData = { passenger };
  const input = (t) => ({
    missionData,
    passenger,
    departureDistanceNm: 6,
    nowMs: t * 1000,
    flightData: { mslFt: 3200, aglFt: 2500, hdg: 45, bankDeg: 0, vsFpm: 0, onGround: false }
  });
  trainingProcedure.tick(input(1));
  trainingProcedure.tick(input(5));
  const started = trainingProcedure.signalReady(missionData, passenger);
  assert.equal(started.ok, true, 'manual start API should accept a stable prepared exercise');
  trainingProcedure.tick(input(6));
  assert.equal(trainingProcedure.snapshot()?.active?.exerciseId, 'api_turn', 'manual start should capture and activate exactly one exercise');
  const aborted = trainingProcedure.abortExercise(missionData, passenger);
  assert.equal(aborted.ok, true, 'active exercise should be abortable');
  assert.equal(aborted.state.active, null, 'abort should clear the active attempt');
  assert.equal(aborted.state.ready, false, 'abort should require a fresh stable manual start');
}

testTurn180();
testTurn360UsesManualReference();
testStallBreakRecovery();
testRequiredGateAndOptionalRequest();
testFeedbackThrottleAndFailureReset();
testManualStartAndAbortApi();
console.log('[ok] training procedure selftest');
