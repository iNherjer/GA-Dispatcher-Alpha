import assert from 'node:assert/strict';
import trainingProcedure from '../mission-training-procedure.js';

const { tickState, createInitialState } = trainingProcedure._test;

function sample({ t, alt = 3000, agl = 2500, hdg = 0, bank = 0, pitch = 0, ias = 90, vs = 0, aoa = 4, stall = false }) {
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
    onGround: false
  };
}

function tick(recipe, state, s) {
  const result = tickState(recipe, state, s);
  return result.state;
}

function markReady(state) {
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
  let result = tickState(recipe, state, sample({ t: 0, hdg: 0, bank: 0 }));
  assert.equal(result.state.readyPrompted, true, 'training should wait for pilot ready at altitude');
  assert.equal(result.state.active, null, 'no exercise should start before ready');
  state = markReady(result.state);
  state = tick(recipe, state, sample({ t: 1, hdg: 0, bank: 0 }));
  for (let i = 2; i <= 19; i++) state = tick(recipe, state, sample({ t: i, hdg: (i - 1) * 10, bank: 30 }));
  state = tick(recipe, state, sample({ t: 20, hdg: 180, bank: 5 }));
  state = tick(recipe, state, sample({ t: 22, hdg: 181, bank: 2 }));
  assert.equal(state.requiredComplete, true, 'required part should complete after first exercise');
  assert.equal(state.satisfied, true, 'mission should be satisfied after required exercises');
  assert.equal(state.activeIndex, 1, 'optional exercise should remain pending');
  state.optionalRequested = true;
  result = tickState(recipe, state, sample({ t: 24, hdg: 181, bank: 0 }));
  assert.equal(result.state.active?.exerciseId, 'turn_180_optional', 'optional exercise should start only after request');
}

testTurn180();
testStallBreakRecovery();
testRequiredGateAndOptionalRequest();
console.log('[ok] training procedure selftest');
