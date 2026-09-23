'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const runtime = require('./tracker-mission-training-runtime.js');
const { bundle } = require('./tracker-mission-training-fixture.js');
const trainingCore = require('../mission-training-core.js').create({}, { now: () => 0 });

function harness(exercises) {
  const recipe = structuredClone(bundle().executionPoiRecipe);
  if (exercises) {
    recipe.trainingRecipe = trainingCore.normalizeRecipe({
      schema: 'ga.trainingRecipe.v1', key: 'coaching-test', requiredCount: 1,
      minDepartureDistanceNm: 5, exercises
    });
    recipe.voiceContext.trainingRecipe = recipe.trainingRecipe;
    recipe.voiceContext.passenger.trainingRecipe = recipe.trainingRecipe;
  }
  let state = runtime.createState(recipe);
  let now = 10000;
  let last;
  const observe = (patch = {}, dt = 1000) => {
    now += dt;
    last = runtime.observe(recipe, state, {
      observedAt: now, lat: 48.3, lon: 8.5, altFt: 3000, aglFt: 3000,
      hdg: 90, bankDeg: 0, vsFpm: 0, iasKts: 90, gsKts: 90,
      gForce: 1.1, onGround: false, ...patch
    });
    state = last.state;
    return last;
  };
  const action = intent => { last = runtime.action(recipe, state, intent, ++now); state = last.state; return last; };
  const restore = () => { state = runtime.createState(recipe, structuredClone(state)); };
  const raw = () => state.checkpoint.procedureState.activeState;
  const row = id => state.guidance.rows.find(item => item.id === id);
  const spoken = result => result.voices.map(item => item.resolvedRecipe.fallbackText).filter(Boolean).join(' ');
  return { recipe, observe, action, restore, raw, row, spoken, get state() { return state; } };
}

test('preflight altitude and course rows revert to red and keep the initial reference', () => {
  const h = harness();
  h.observe();
  assert.equal(h.row('altitude').status, 'complete');
  assert.equal(h.row('heading').status, 'complete');
  const reference = structuredClone(h.state.coaching.reference);
  h.observe({ altFt: 3120, hdg: 99 }, 1000);
  assert.equal(h.row('altitude').status, 'error');
  assert.equal(h.row('heading').status, 'error');
  assert.equal(h.state.progress.startAvailable, false);
  h.restore();
  h.observe({ altFt: 3000, hdg: 90 }, 1000);
  assert.deepEqual(h.state.coaching.reference, reference);
  assert.equal(h.row('altitude').status, 'complete');
  assert.equal(h.row('heading').status, 'complete');
  assert.equal(h.state.progress.startAvailable, false, 'stable start gate must restart after deviation');
  h.observe({}, 3100);
  assert.equal(h.state.progress.startAvailable, true);
});

test('repeat instruction reads the persisted ordered plan after restore', () => {
  const h = harness();
  const first = h.observe();
  assert.match(h.spoken(first), /1\. Höhe/);
  assert.doesNotMatch(h.spoken(first), /Korrektur:|Werte passen/,
    'the initial exercise instruction must win over generic value feedback');
  const planned = h.state.guidance.instruction;
  assert.match(planned, /1\. Höhe .*2\. Kurs .*3\. Flügel .*4\. 180° .*5\. Ausleiten/);
  h.restore();
  const repeated = h.action('training_repeat_instruction');
  assert.match(h.spoken(repeated), /1\. Höhe .*2\. Kurs .*3\. Flügel .*4\. 180° .*5\. Ausleiten/);
  assert.equal(h.state.guidance.instruction, planned);
});

test('continuous hold clock resets on brief invalid values and survives restore', () => {
  const h = harness([{ id: 'hold', type: 'altitude_step_hold', direction: 'climb', holdSec: 5, altitudeStepFt: 500 }]);
  h.observe(); h.observe({}, 3100);
  assert.equal(h.raw().startAvailable, true);
  h.action('training_ready');
  h.observe({}, 100);
  assert.equal(h.raw().active.phase, 'hold_initial');
  h.observe({}, 2000);
  h.observe({}, 1000);
  assert.ok(h.row('hold_initial').progress > 0);
  h.observe({ altFt: 3070 }, 1000);
  assert.equal(h.row('hold_initial').status, 'error');
  assert.equal(h.row('hold_initial').progress, 0);
  h.restore();
  h.observe({}, 1000);
  assert.equal(h.raw().active.phase, 'hold_initial');
  h.observe({}, 4000);
  assert.equal(h.raw().active.phase, 'hold_initial', 'elapsed invalid time must not count toward hold');
  h.observe({}, 1200);
  assert.equal(h.raw().active.phase, 'altitude_change');
});

test('wrong direction and telemetry gaps retry only the active exercise', () => {
  const h = harness();
  h.observe(); h.observe({}, 3100); h.action('training_ready');
  h.observe({}, 100); // setup -> entry
  h.observe({ hdg: 100, bankDeg: 30 }, 100); // entry -> turning, right
  h.observe({ hdg: 110, bankDeg: 30 }, 100);
  assert.equal(h.raw().active.phase, 'turning');
  // The source detector allows a ten-second grace period for a sustained reversal.
  for (let i = 0; i < 12 && h.raw().active; i++) h.observe({ hdg: 95 - i * 10, bankDeg: 30 }, 1000);
  assert.equal(h.raw().exercises[0].status, 'repeat');
  assert.equal(h.raw().active, null);
  const before = h.state.coaching.history.length;
  const gap = h.observe({}, 7000);
  assert.match(h.spoken(gap), /unterbrochen|neu ansetzen/i);
  assert.ok(h.state.coaching.history.length > before);
});

test('stalled rollout requires a retry instead of waiting indefinitely', () => {
  const h = harness();
  h.observe(); h.observe({}, 3100); h.action('training_ready');
  h.observe({}, 100); // setup -> entry
  h.observe({ hdg: 100, bankDeg: 30 }, 100); // entry -> turning
  for (let heading = 110; heading <= 270; heading += 10) h.observe({ hdg: heading, bankDeg: 30 }, 1000);
  assert.equal(h.raw().active.phase, 'rollout');
  for (let i = 0; i < 48 && h.raw().active; i++) h.observe({ hdg: 260, bankDeg: 0 }, 1000);
  assert.equal(h.raw().exercises[0].status, 'repeat');
  assert.equal(h.raw().active, null);
  assert.match(h.state.guidance.notice, /Fortschritt|neu ansetzen/i);
});

test('a completed required exercise remains complete when optional work is interrupted', () => {
  const h = harness([
    { id: 'required_turn', type: 'turn_180', targetBankDeg: 30, stableSec: 1 },
    { id: 'optional_turn', type: 'turn_180', targetBankDeg: 30, stableSec: 1 }
  ]);
  h.observe(); h.observe({}, 3100); h.action('training_ready');
  h.observe({}, 100);
  h.observe({ hdg: 100, bankDeg: 30 }, 100);
  for (let heading = 110; heading <= 270; heading += 10) h.observe({ hdg: heading, bankDeg: 30 }, 1000);
  h.observe({ hdg: 270, bankDeg: 0 }, 1000);
  h.observe({ hdg: 270, bankDeg: 0 }, 1100);
  assert.equal(h.raw().exercises[0].status, 'complete');
  assert.equal(h.state.progress.requiredComplete, true);
  h.action('training_extra');
  h.observe({ hdg: 270 }, 1000);
  h.observe({ hdg: 270 }, 3100);
  assert.equal(h.raw().startAvailable, true);
  h.action('training_ready');
  h.observe({ hdg: 270 }, 100);
  assert.equal(h.raw().exercises[1].status, 'active');
  h.observe({ hdg: 270 }, 7000);
  assert.equal(h.raw().exercises[0].status, 'complete');
  assert.equal(h.state.progress.completedCount, 1);
  assert.equal(h.state.progress.requiredComplete, true);
  assert.equal(h.raw().exercises[1].status, 'repeat');
});

test('start uses the announced reference even within preparation tolerance', () => {
  const h=harness();h.observe();h.observe({},3100);h.action('training_ready');
  h.observe({altFt:3020,hdg:92},100);
  assert.equal(h.raw().active.startAltFt,3000);
  assert.equal(h.raw().active.startHeadingDeg,90);
  assert.equal(h.raw().active.targetHeadingDeg,270);
});

test('rollout cannot pass outside the altitude band even with correct heading', () => {
  const h=harness();h.observe();h.observe({},3100);h.action('training_ready');h.observe({},100);
  h.observe({hdg:100,bankDeg:30},100);
  for(let hdg=110;hdg<=270;hdg+=10)h.observe({hdg,bankDeg:30});
  for(let i=0;i<8;i++)h.observe({hdg:270,altFt:3100,bankDeg:0});
  assert.equal(h.raw().active.phase,'rollout');
  assert.equal(h.row('rollout').status,'error');
  assert.equal(h.state.progress.completedCount,0);
});
