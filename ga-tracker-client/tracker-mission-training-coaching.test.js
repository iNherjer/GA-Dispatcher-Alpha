'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const runtime = require('./tracker-mission-training-runtime.js');
const coaching = require('./tracker-mission-training-coaching.js');
const { bundle } = require('./tracker-mission-training-fixture.js');
const trainingCore = require('../mission-training-core.js').create({}, { now: () => 0 });

function harness(exercises, requiredCount = 1, minDepartureDistanceNm = 5, options = {}) {
  const recipe = structuredClone(bundle().executionPoiRecipe);
  recipe.missionMode = options.mode || 'POI';
  recipe.taskDomain = options.domain || 'training';
  recipe.voiceContext.taskDomain = recipe.taskDomain;
  recipe.voiceContext.passenger.taskDomain = recipe.taskDomain;
  if (exercises) {
    recipe.trainingRecipe = trainingCore.normalizeRecipe({
      schema: 'ga.trainingRecipe.v1', key: 'coaching-test', requiredCount,
      minDepartureDistanceNm, exercises
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

test('altitude change previews live references and freezes them at manual start', () => {
  const h = harness([{id:'hold',type:'altitude_step_hold',altitudeStepFt:500}]);
  h.observe();
  h.observe({ altFt: 3120, hdg: 99 }, 1000);
  assert.equal(h.state.coaching.reference.altFt,3120);
  assert.equal(h.state.coaching.reference.headingDeg,99);
  h.observe({altFt:3120,hdg:99},3100);
  assert.equal(h.state.guidance.canStart,true);
  h.action('training_ready');
  h.observe({altFt:3120,hdg:99},100);
  assert.equal(h.state.coaching.reference.altFt,3120);
  assert.equal(h.state.checkpoint.procedureState.activeState.active.targetAltFt,3620);
  assert.equal(h.state.guidance.canAbort,true);
  h.restore();
  h.observe({altFt:3140,hdg:101},100);
  assert.equal(h.state.coaching.reference.altFt,3120);
  assert.equal(h.state.coaching.reference.headingDeg,99);
});

test('pre-instruction guidance stays visible and uses the core required altitude gate', () => {
  const h = harness([
    { id: 'required_turn', type: 'turn_180', targetBankDeg: 30 },
    { id: 'required_stall', type: 'stall_recovery' }
  ], 2);
  h.observe({ aglFt: 1200 });
  assert.equal(h.state.guidance.visible, true);
  assert.equal(h.state.guidance.instruction, 'Vor der Einweisung müssen Entfernung und Sicherheitshöhe passen.');
  assert.equal(h.row('distance').status, 'complete');
  assert.match(h.row('altitude').label, /3000 ft AGL/,
    'ready altitude must match the core gate when a required stall exercise is present');
  assert.equal(h.row('altitude').status, 'error');
  assert.equal(h.state.progress.readyPrompted, false);
  h.observe({ aglFt: 2999 });
  assert.equal(h.row('altitude').status, 'error');
  h.observe({ aglFt: 3000 });
  assert.equal(h.state.progress.readyPrompted, true);
  assert.equal(h.state.coaching.reference.exerciseId, 'required_turn');
  h.observe({ aglFt: 1500 });
  assert.equal(h.state.progress.startAvailable, false,
    'falling below the core ready gate before the ready intent must keep the start locked');
  assert.match(h.row('ready').label, /3000 ft AGL/);
  assert.equal(h.row('ready').status, 'error');
  assert.match(h.state.guidance.notice, /3000 ft AGL/);
});

test('completed guidance keeps POI return wording and sends APT training to its destination', () => {
  const poi = harness();
  poi.raw().requiredComplete = true;
  poi.raw().satisfied = true;
  poi.raw().activeIndex = 1;
  const poiGuidance = coaching.project(poi.recipe, poi.state);
  assert.match(poiGuidance.instruction, /Rückkehr frei/);

  const apt = harness();
  apt.recipe.missionMode = 'APT';
  apt.raw().requiredComplete = true;
  apt.raw().satisfied = true;
  apt.raw().activeIndex = 1;
  const aptGuidance = coaching.project(apt.recipe, apt.state);
  assert.match(aptGuidance.instruction, /Weiter zum Zielflugplatz/);
  assert.match(aptGuidance.instruction, /gemäß Flugplan landen/);
  assert.doesNotMatch(aptGuidance.instruction, /Rückkehr frei/);
});

test('turn-only readiness opens at 1200 AGL after three stable seconds', () => {
  const h = harness([{ id: 'turn', type: 'turn_180', targetBankDeg: 30 }]);
  h.observe({ aglFt: 1199 });
  assert.equal(h.state.guidance.visible, true);
  assert.equal(h.row('altitude').status, 'error');
  assert.match(h.row('altitude').label, /1200 ft AGL/);
  assert.equal(h.state.progress.readyPrompted, false);
  h.observe({ aglFt: 1200 });
  assert.equal(h.state.progress.readyPrompted, true);
  h.observe({ aglFt: 1200 }, 3100);
  assert.equal(h.state.progress.startAvailable, true);
});

test('explicit zero departure distance remains a zero gate', () => {
  const h = harness([{ id: 'turn', type: 'turn_180', targetBankDeg: 30 }], 1, 0);
  h.observe({ lat: null, lon: null, aglFt: 1199 });
  assert.equal(h.row('distance').status, 'complete');
  assert.equal(h.row('distance').progress, 1);
  assert.match(h.row('distance').label, /0\.0 NM/);
  assert.equal(h.state.progress.departureGatePassed, true);
  assert.equal(h.state.progress.readyPrompted, false, 'AGL gate remains independent of zero departure distance');
});

test('pre-instruction guidance reports unavailable position, AGL and suspension without completing gates', () => {
  const h = harness();
  h.observe({ lat: null, lon: null, aglFt: null });
  assert.equal(h.state.guidance.visible, true);
  assert.equal(h.row('distance').status, 'pending');
  assert.equal(h.row('altitude').status, 'pending');
  assert.match(h.state.guidance.notice, /Position\/Entfernung/);
  assert.match(h.state.guidance.notice, /AGL-Höhe/);
  assert.equal(h.state.progress.readyPrompted, false);
  const paused = harness();
  runtime.pause(paused.recipe, paused.state, 14000, 'Simulator pausiert.');
  paused.state.guidance = require('./tracker-mission-training-coaching.js').project(paused.recipe, paused.state);
  assert.equal(paused.state.guidance.visible, true);
  assert.match(paused.state.guidance.notice, /Simulator pausiert/);
  assert.notEqual(paused.row('distance').status, 'complete');
  assert.notEqual(paused.row('altitude').status, 'complete');
});

test('repeat instruction stays brief while the persisted ordered plan remains visible', () => {
  const h = harness();
  const first = h.observe();
  assert.match(h.spoken(first), /Als Nächstes.*Kursumkehr/);
  assert.doesNotMatch(h.spoken(first), /Korrektur:|Werte passen/,
    'the initial exercise instruction must win over generic value feedback');
  const planned = h.state.guidance.instruction;
  assert.match(planned, /1\. Starthöhen-Vorschau .*2\. Startkurs .*3\. Flügel .*4\. 180° .*5\. Zielkurs-Vorschau/);
  h.restore();
  const repeated = h.action('training_repeat_instruction');
  assert.match(h.spoken(repeated), /Als Nächstes.*Kursumkehr/);
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
  h.observe({ altFt: 3120 }, 1000);
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
  h.observe({ hdg: 100, bankDeg: -30 }, 100); // entry -> turning, right
  h.observe({ hdg: 110, bankDeg: -30 }, 100);
  assert.equal(h.raw().active.phase, 'turning');
  // The source detector allows a ten-second grace period for a sustained reversal.
  for (let i = 0; i < 12 && h.raw().active; i++) h.observe({ hdg: 95 - i * 10, bankDeg: -30 }, 1000);
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
  h.observe({ hdg: 100, bankDeg: -30 }, 100); // entry -> turning
  for (let heading = 110; heading <= 270; heading += 10) h.observe({ hdg: heading, bankDeg: -30 }, 1000);
  assert.equal(h.raw().active.phase, 'rollout');
  for (let i = 0; i < 48 && h.raw().active; i++) h.observe({ hdg: 250, bankDeg: 0 }, 1000);
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
  h.observe({ hdg: 100, bankDeg: -30 }, 100);
  for (let heading = 110; heading <= 270; heading += 10) h.observe({ hdg: heading, bankDeg: -30 }, 1000);
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
  h.observe({hdg:100,bankDeg: -30},100);
  for(let hdg=110;hdg<=270;hdg+=10)h.observe({hdg,bankDeg: -30});
  for(let i=0;i<8;i++)h.observe({hdg:270,altFt:3150,bankDeg: 0});
  assert.equal(h.raw().active.phase,'rollout');
  assert.equal(h.row('rollout').status,'error');
  assert.equal(h.state.progress.completedCount,0);
});

for (const type of ['constant_bank_360','turn_180']) for (const direction of ['left','right','either']) for (const targetBankDeg of [30,45]) {
  test(`guidance completes ${type}, ${direction}, bank ${targetBankDeg} with the original detector`, () => {
    const h=harness([{id:'turn',type,direction,targetBankDeg,stableSec:1}]);
    h.observe();h.observe({},3100);h.action('training_ready');h.observe({},100);
    const sign=direction==='left'?-1:1,target=type==='turn_180'?180:360;
    for(let arc=10;arc<=target;arc+=10)h.observe({hdg:(90+sign*arc+360)%360,bankDeg:-sign*targetBankDeg},1000);
    assert.equal(h.raw().active.phase,'rollout');
    assert.equal(h.row('turn').status,'complete');
    assert.equal(h.row('turn').progress,1);
    assert.match(h.row('turn').label,new RegExp(`${target}° ${sign<0?'links':'rechts'}`));
    const hdg=(90+target)%360;
    h.observe({hdg,bankDeg: 0});h.observe({hdg,bankDeg: 0},1100);
    assert.equal(h.state.progress.requiredComplete,true);
    assert.equal(h.state.guidance.visible,false);
  });
}
for(const direction of ['climb','descent']) test(`height and speed guidance covers ${direction} with custom recipe values`,()=>{
  const h=harness([{id:'step',type:'altitude_step_hold',direction,holdSec:7,altitudeStepFt:700,speedToleranceKts:12,maxVsFpm:600}]);
  h.observe();h.observe({},3100);h.action('training_ready');h.observe({},100);
  assert.match(h.row('hold_initial').label,/7 s.*IAS 90 ±12 kt/);
  assert.match(h.row('altitude_change').label,/850 ft\/min/);
  const target=direction==='climb'?3700:2300;
  assert.match(h.row('altitude_change').label,new RegExp(`${target} ft`));
  h.observe({iasKts:106});
  assert.equal(h.row('hold_initial').status,'error');
  assert.match(h.row('hold_initial').detail,/IAS 106 kt/);
  for(let i=0;i<9;i++)h.observe();
  assert.equal(h.raw().active.phase,'altitude_change');
  h.observe({altFt:target,vsFpm:900});
  assert.equal(h.row('altitude_change').status,'error');
  for(let i=0;i<14&&!h.state.progress.requiredComplete;i++)h.observe({altFt:target});
  assert.equal(h.state.progress.requiredComplete,true);
});
test('stall banner follows stabilize, approach, break and timed recovery with matching errors',()=>{
  const h=harness([{id:'stall',type:'stall_recovery',setupStableSec:2,recoveryStableSec:3,targetAoaDeg:14,maxRecoveryBankDeg:10}]);
  h.observe();h.observe({},3100);h.action('training_ready');h.observe({},100);
  assert.equal(h.raw().active.phase,'stabilize');
  h.observe({bankDeg: -10});assert.equal(h.row('stabilize').status,'error');
  h.observe();h.observe();assert.ok(h.row('stabilize').progress>0);
  h.restore();h.observe();assert.equal(h.raw().active.phase,'approach');
  assert.equal(h.row('stabilize').status,'complete');
  h.observe({bankDeg: -16});assert.equal(h.row('approach').status,'error');
  h.observe({iasKts:70,aoaDeg:14});assert.equal(h.raw().active.phase,'hold_to_break');
  assert.equal(h.row('approach').status,'complete');
  h.observe({iasKts:70,aoaDeg:14,vsFpm:-700,altFt:2960});
  assert.equal(h.raw().active.phase,'recovery');
  assert.equal(h.row('hold_to_break').status,'complete');
  assert.match(h.row('recovery').label,/AOA ≤12°/);
  assert.equal(h.row('recovery').status,'error');
  h.observe({aoaDeg:11,altFt:2960});h.observe({aoaDeg:11,altFt:2960});
  assert.ok(h.row('recovery').progress>0&&h.row('recovery').progress<1);
  h.restore();h.observe({aoaDeg:11,altFt:2960});h.observe({aoaDeg:11,altFt:2960});
  assert.equal(h.state.progress.requiredComplete,true);
});
test('turn banner marks excessive G as an error before the detector grace period expires',()=>{
  const h=harness();h.observe();h.observe({},3100);h.action('training_ready');h.observe({},100);
  h.observe({hdg:100,bankDeg: -30});h.observe({hdg:110,bankDeg: -30,gForce:3});
  assert.equal(h.row('turn').status,'error');assert.match(h.row('turn').detail,/3.0 G/);
});

test('inflight maneuver tip remains visible without lengthening the spoken instruction',()=>{const tip='Beim Ausleiten die Leistung wieder anpassen, damit die Geschwindigkeit stabil bleibt.';const h=harness([{id:'turn-tip',type:'constant_bank_360',targetBankDeg:45,inflightTip:tip}]);const first=h.observe();assert.match(h.state.guidance.instruction,/Beim Ausleiten die Leistung/);assert.doesNotMatch(h.spoken(first),/Beim Ausleiten die Leistung/);h.restore();assert.doesNotMatch(h.spoken(h.action('training_repeat_instruction')),/Beim Ausleiten die Leistung/);assert.match(h.state.guidance.instruction,/Beim Ausleiten die Leistung/);assert.equal(h.raw().requiredComplete,false);});

test('180 turn previews the chosen heading until manual start, then freezes through restore',()=>{const h=harness([{id:'turn',type:'turn_180',targetBankDeg:30}]);h.observe({hdg:90});h.observe({hdg:120,bankDeg: -20});assert.equal(h.state.coaching.reference.headingDeg,120);assert.equal(h.state.progress.startAvailable,false);h.observe({hdg:140});h.observe({hdg:140},3100);assert.equal(h.state.progress.startAvailable,true);assert.match(h.row('heading').label,/bei „Übung starten“/);assert.match(h.row('rollout').label,/320°/);h.action('training_ready');h.observe({hdg:141});assert.equal(h.raw().active.startHeadingDeg,140);assert.equal(h.raw().active.targetHeadingDeg,320);h.restore();h.observe({hdg:150,bankDeg: -30});assert.equal(h.state.coaching.reference.headingDeg,140);assert.match(h.row('rollout').label,/Ausleiten auf 320°/);});

for(const bank of [30,45])test(`full circle ${bank} degrees fixes the chosen start course only at manual release`,()=>{const h=harness([{id:'circle',type:'constant_bank_360',targetBankDeg:bank}]);h.observe({hdg:90});h.observe({hdg:200,bankDeg: -20});assert.equal(h.state.progress.startAvailable,false);h.observe({hdg:210});h.observe({hdg:210},3100);assert.equal(h.state.progress.startAvailable,true);assert.match(h.row('rollout').label,/Vorschau 210°/);h.action('training_ready');h.observe({hdg:211});assert.equal(h.raw().active.startHeadingDeg,210);assert.equal(h.raw().active.targetHeadingDeg,210);h.restore();h.observe({hdg:220,bankDeg:bank});assert.equal(h.state.coaching.reference.headingDeg,210);assert.match(h.row('rollout').label,/Ausleiten auf 210°/);});


test('training distinguishes telemetry interruption reasons and updates a changing blocker', () => {
  const h = harness();
  const base = { observedAt: 11000, lat:48.3, lon:8.5, altFt:5700, aglFt:3000,
    hdg:90, bankDeg: 0, vsFpm:0, onGround:false, simPaused:false, inMenuOrMap:false };
  runtime.pause(h.recipe, h.state, 11000, undefined, {...base,lat:null});
  assert.match(h.state.guidance.notice, /Flugdaten unterbrochen oder unvollständig/);
  assert.doesNotMatch(h.state.guidance.notice, /Simulator pausiert|Slew/);
  assert.equal(h.state.guidance.canStart, undefined);
  assert.match(h.state.guidance.rows.find(r=>r.id==='altitude').detail, /3000/);
  const historySize=h.state.coaching.history.length;
  runtime.pause(h.recipe, h.state, 12000, undefined, {...base,lat:null});
  assert.equal(h.state.coaching.history.length, historySize, 'identical blocker does not flood history');
  runtime.pause(h.recipe, h.state, 13000, undefined, {...base,simPaused:true,slewActive:false});
  assert.match(h.state.guidance.notice, /Simulator pausiert/);
  assert.doesNotMatch(h.state.guidance.notice, /Slew/);
  runtime.pause(h.recipe, h.state, 14000, undefined, {...base,inMenuOrMap:true});
  assert.match(h.state.guidance.notice, /Simulator im Menü/);
  runtime.pause(h.recipe, h.state, 15000, undefined, {...base,onGround:true});
  assert.match(h.state.guidance.notice, /Flugzeug am Boden/);
  runtime.pause(h.recipe, h.state, 16000, 'Expliziter Wiederaufnahmehinweis.', base);
  assert.equal(h.state.coaching.notice, 'Expliziter Wiederaufnahmehinweis.');
});


for (const type of ['turn_180', 'constant_bank_360']) test(`${type} starts at the click before the first banked sample`, () => {
  const h = harness([{id:'turn', type, targetBankDeg:30}]);
  h.observe({altFt:3120, hdg:140}); h.observe({altFt:3120, hdg:140}, 3100);
  const started = h.action('training_ready');
  assert.equal(h.raw().active.phase, 'entry');
  assert.equal(h.raw().exercises[0].attempts, 1);
  assert.equal(h.state.guidance.canAbort, true);
  assert.equal(h.raw().active.startAltFt, 3120);
  assert.equal(h.raw().active.startHeadingDeg, 140);
  assert.equal(h.raw().active.targetHeadingDeg, type==='turn_180'?320:140);
  assert.match(h.spoken(started), /beginne jetzt/);
  assert.doesNotMatch(h.spoken(started), /nächsten Messwert/);
  assert.ok(started.voices.every(v=>v.trainingScope===runtime.scope(h.state)));
  h.restore();
  h.observe({altFt:3130, hdg:146, bankDeg: -25}, 1000);
  assert.equal(h.raw().active.phase, 'turning');
  assert.equal(h.raw().exercises[0].attempts, 1);
  assert.equal(h.raw().active.startHeadingDeg, 140);
  assert.equal(h.raw().active.startAltFt, 3120);
  assert.equal(h.raw().active.progressDeg, 6);
});

test('manual start captures IAS immediately and permits abort before the next measurement', () => {
  const h = harness([{id:'step', type:'altitude_step_hold', altitudeStepFt:500}]);
  h.observe({altFt:3120, hdg:140, iasKts:90});
  h.observe({altFt:3120, hdg:140, iasKts:90}, 3100);
  h.action('training_ready');
  assert.equal(h.raw().active.phase, 'hold_initial');
  assert.equal(h.raw().active.refIasKts, 90);
  assert.equal(h.raw().active.targetAltFt, 3620);
  h.observe({altFt:3120, hdg:140, iasKts:101});
  assert.equal(h.raw().active.refIasKts, 90);
  assert.equal(h.row('hold_initial').status, 'error');
  h.action('training_abort');
  assert.equal(h.raw().active, null);
  h.observe({altFt:3200, hdg:160, iasKts:100}, 5000);
  h.observe({altFt:3200, hdg:160, iasKts:100}, 3100);
  h.action('training_ready');
  assert.equal(h.raw().active.startAltFt, 3200);
  assert.equal(h.raw().active.startHeadingDeg, 160);
  assert.equal(h.raw().active.refIasKts, 100);
  assert.equal(h.raw().exercises[0].attempts, 2);
  h.action('training_abort');
  assert.equal(h.raw().active, null, 'abort also works immediately after the click');
});

test('banking without a manual start keeps the exercise inactive', () => {
  const h = harness(); h.observe(); h.observe({},3100);
  assert.equal(h.state.guidance.canStart,true);
  h.observe({bankDeg: -25,hdg:96});
  assert.equal(h.raw().active,null);
  assert.equal(h.raw().exercises[0].attempts,0);
  assert.equal(h.state.guidance.canStart,false);
});

// Live MSFS convention: positive bank turns left, negative bank turns right.
for (const mode of ['POI','APT']) for (const domain of ['training','club_training_basic','club_training_advanced'])
for (const [type,bank] of [['turn_180',30],['constant_bank_360',30],['constant_bank_360',45]])
for (const choice of ['left','right','either-left','either-right']) {
  test(`${mode}/${domain} ${type}/${bank} ${choice} uses MSFS signs and forgiving legacy limits`,()=>{
    const sign=choice.endsWith('left')?-1:1, target=type==='turn_180'?180:360;
    const h=harness([{id:'live',type,targetBankDeg:bank,direction:choice.startsWith('either')?'either':choice,
      maxAltitudeDeltaFt:50,bankToleranceDeg:6,rolloutHeadingToleranceDeg:5,stableSec:1}],1,5,{mode,domain});
    // An existing mission can still carry the old serialized values.
    Object.assign(h.recipe.trainingRecipe.exercises[0],{maxAltitudeDeltaFt:50,bankToleranceDeg:6,rolloutHeadingToleranceDeg:5});
    h.observe({hdg:5});h.observe({hdg:5},3100);
    assert.match(h.spoken(h.action('training_repeat_instruction')),type==='turn_180'?/Kursumkehr/:/Vollkreis/);
    h.action('training_ready');
    for(let arc=5;arc<=target;arc+=5) {
      h.observe({hdg:(5+sign*arc+720)%360,bankDeg:-sign*(bank+8),altFt:3075});
      assert.ok(h.raw().active, 'within the new limits must not abort after 15 or 30 seconds');
      if(arc===80)h.restore();
    }
    assert.equal(h.raw().active.phase,'rollout');
    assert.equal(h.raw().active.direction,sign);
    assert.match(h.row('turn').label,new RegExp(sign<0?'links':'rechts'));
    assert.match(h.row('turn').label,/±10°.*±100 ft.*30 s/);
    assert.match(h.row('rollout').label,/±10°/);
    const targetHeading=(5+target)%360;
    h.observe({hdg:(targetHeading+8)%360,bankDeg:0,altFt:3075});
    h.observe({hdg:(targetHeading+8)%360,bankDeg:0,altFt:3075},1100);
    assert.equal(h.state.progress.requiredComplete,true);
  });
}

for(const type of ['turn_180','constant_bank_360']) test(`${type} permits correction for 30 seconds and resets the deviation clock`,()=>{
  const h=harness([{id:'grace',type}]);
  h.observe();h.observe({},3100);h.action('training_ready');
  h.observe({hdg:91,bankDeg:-30});
  let hdg=91;
  for(let i=0;i<30;i++)h.observe({hdg:++hdg,bankDeg:-30,altFt:3150});
  assert.ok(h.raw().active,'29 seconds outside the height band are tolerated');
  h.observe({hdg:++hdg,bankDeg:-30,altFt:3000});
  for(let i=0;i<30;i++)h.observe({hdg:++hdg,bankDeg:-30,altFt:3150});
  assert.ok(h.raw().active,'returning inside the limits resets the clock');
  h.observe({hdg:++hdg,bankDeg:-30,altFt:3150});
  assert.equal(h.raw().active,null);
  assert.match(h.state.coaching.notice,/30 Sekunden/);
});

for(const direction of ['left','right']) test(`fixed ${direction} turn does not accept the opposite bank`,()=>{
  const h=harness([{id:'fixed',type:'constant_bank_360',direction}]);
  h.observe();h.observe({},3100);h.action('training_ready');
  const sign=direction==='left'?-1:1;
  h.observe({hdg:90-sign*5,bankDeg:sign*30});
  assert.equal(h.raw().active.phase,'entry');
  assert.equal(h.raw().active.progressDeg,0);
  h.observe({hdg:90+sign*5,bankDeg:-sign*30});
  assert.equal(h.raw().active.phase,'turning');
  assert.equal(h.raw().active.direction,sign);
  assert.equal(h.raw().active.progressDeg,5);
});

test('an old in-flight turn is restarted once on restore while completed work survives',()=>{
  const h=harness([{id:'required',type:'turn_180',stableSec:1},{id:'optional',type:'constant_bank_360'}]);
  h.observe();h.observe({},3100);h.action('training_ready');
  for(let arc=10;arc<=180;arc+=10)h.observe({hdg:90+arc,bankDeg:-30});
  h.observe({hdg:270});h.observe({hdg:270},1100);
  assert.equal(h.state.progress.requiredComplete,true);
  h.action('training_extra');
  h.observe({hdg:270},5000);h.observe({hdg:270},3100);h.action('training_ready');
  h.observe({hdg:280,bankDeg:-30});
  assert.equal(h.raw().active.phase,'turning');
  delete h.raw().active.turnDirectionConvention;
  h.restore();
  assert.equal(h.raw().active,null);
  assert.equal(h.raw().exercises[0].status,'complete');
  assert.equal(h.raw().exercises[1].status,'repeat');
  assert.equal(h.state.progress.requiredComplete,true);
  assert.match(h.state.coaching.notice,/Kurvenauswertung aktualisiert/);
  h.observe({hdg:280},5000);h.observe({hdg:280},3100);h.action('training_ready');
  h.observe({hdg:290,bankDeg:-30});h.restore();
  assert.equal(h.raw().active.phase,'turning','new convention resumes without another reset');
});

for(const mode of ['POI','APT']) for(const domain of ['training','club_training_basic','club_training_advanced']) {
  test(`${mode}/${domain} stall uses the real MSFS pitch sign and preserves recovery after restore`,()=>{
    const h=harness([{id:'stall',type:'stall_recovery',setupStableSec:1,recoveryStableSec:2}],1,5,{mode,domain});
    h.observe({pitchDeg:-3});h.observe({pitchDeg:-3},3100);h.action('training_ready');
    h.observe({pitchDeg:-3});h.observe({pitchDeg:-3});
    h.observe({pitchDeg:-10,iasKts:65,stallState:true,aoaDeg:12});
    assert.equal(h.raw().active.phase,'hold_to_break');
    h.observe({pitchDeg:-16,iasKts:65,stallState:true,aoaDeg:12});
    assert.equal(h.raw().active.phase,'hold_to_break','raising the nose must not earn a break');
    h.restore();
    const drop=h.observe({pitchDeg:-4,iasKts:65,stallState:true,aoaDeg:12,altFt:3000,aglFt:3000});
    assert.equal(h.raw().active.phase,'recovery');
    assert.match(h.spoken(drop),/Abkippen erkannt/);
    for(let i=0;i<4;i++)h.observe({altFt:2900,aglFt:2900,aoaDeg:8,stallState:false,vsFpm:-100});
    assert.equal(h.state.progress.requiredComplete,true);
  });
  test(`${mode}/${domain} stall start reserve is shown, revoked on descent and enforced on old recipes`,()=>{
    const h=harness([{id:'stall',type:'stall_recovery',setupStableSec:1}],1,5,{mode,domain});
    h.recipe.trainingRecipe.readyMinAglFt=2500;
    delete h.recipe.trainingRecipe.exercises[0].startReserveFt;
    const waiting=h.observe({aglFt:2500});h.observe({aglFt:2500},3100);
    assert.equal(h.state.guidance.canStart,undefined);
    assert.match(h.spoken(waiting),/mehr Höhe/);
    assert.match(h.row('altitude').label,/3000 ft AGL.*500 ft Startreserve/);
    h.observe();h.observe({},3100);assert.equal(h.state.guidance.canStart,true);
    assert.match(h.spoken(h.action('training_repeat_instruction')),/Stallübung/);
    h.observe({aglFt:2999});assert.equal(h.state.guidance.canStart,false);
    h.action('training_ready');assert.equal(h.raw().active,null);
    h.observe();h.observe({},3100);h.action('training_ready');
    h.observe({aglFt:2500});assert.ok(h.raw().active,'the flight minimum remains 2500, not the start minimum');
    h.observe({aglFt:2499});assert.equal(h.raw().active,null);
    assert.match(h.state.coaching.notice,/mindestens 2500 ft AGL/);
  });
}

for(const mode of ['POI','APT']) for(const direction of ['climb','descent'])
for(const [name,invalid] of [['heading',{hdg:101}],['bank',{bankDeg:11}],['speed',{iasKts:101}],['height',{altOffset:101}],['vertical speed',{vsFpm:351}]]) {
  test(`${mode} ${direction} leveloff checks ${name} continuously with matching guidance`,()=>{
    const h=harness([{id:'step',type:'altitude_step_hold',direction,holdSec:5,stableSec:2}],1,5,{mode});
    h.observe();h.observe({},3100);h.action('training_ready');
    while(h.raw().active.phase==='hold_initial')h.observe();
    const sign=direction==='climb'?1:-1,target=3000+sign*500;
    for(let i=1;i<50;i++)h.observe({altFt:3000+sign*i*10,vsFpm:sign*600});
    const {altOffset=0,...badValues}=invalid;
    h.observe({altFt:target+altOffset,...badValues});
    h.observe({altFt:target+altOffset,...badValues},2100);
    assert.equal(h.raw().active.phase,'altitude_change');
    assert.notEqual(h.row('altitude_change').status,'complete');
    if(name!=='height')assert.equal(h.row('altitude_change').status,'error');
    h.restore();
    h.observe({altFt:target});h.observe({altFt:target},1000);
    assert.equal(h.raw().active.phase,'altitude_change');
    h.observe({altFt:target+altOffset,...badValues},100);
    assert.equal(h.raw().active.stableSince,0,'a bad sample must reset stabilization');
    h.observe({altFt:target});h.observe({altFt:target},2100);
    assert.equal(h.raw().active.phase,'hold_final');
    assert.equal(h.row('altitude_change').status,'complete');
    for(let i=0;i<7;i++)h.observe({altFt:target});
    assert.equal(h.state.progress.requiredComplete,true);
  });
}

for(const mode of ['POI','APT']) test(`${mode} old straight-flight limits use the new shared bands and 30-second grace`,()=>{
  const h=harness([{id:'step',type:'altitude_step_hold',holdSec:60}],1,5,{mode});
  Object.assign(h.recipe.trainingRecipe.exercises[0],{maxAltitudeDeltaFt:50,maxHeadingDeltaDeg:5,maxBankDeg:8,speedToleranceKts:7});
  h.observe({bankDeg:9});h.observe({bankDeg:9},3100);
  assert.equal(h.state.guidance.canStart,true,'entry gate agrees with displayed 10-degree bank limit');
  h.action('training_ready');
  for(let i=0;i<25;i++)h.observe({altFt:3075,hdg:98,bankDeg:9,iasKts:99});
  h.restore();
  assert.equal(h.raw().active.phase,'hold_initial');
  assert.match(h.row('hold_initial').label,/±100 ft.*±10°.*≤10°.*±10 kt.*30 s/);
  assert.match(h.spoken(h.action('training_repeat_instruction')),/Kurs und Höhe/);
  for(let i=0;i<30;i++)h.observe({altFt:3150});
  assert.ok(h.raw().active,'29 seconds outside the height band remain correctable');
  assert.equal(h.row('hold_initial').progress,0);
  h.observe({altFt:3075});
  for(let i=0;i<30;i++)h.observe({altFt:3150});
  assert.ok(h.raw().active,'valid values reset the grace clock');
  h.observe({altFt:3150});assert.equal(h.raw().active,null);
  assert.match(h.state.coaching.notice,/30 Sekunden/);
});

for(const type of ['stall_recovery','altitude_step_hold']) test(`legacy ${type} attempt restarts once and keeps completed exercises`,()=>{
  const h=harness([{id:'first',type:'turn_180'},{id:'next',type}],1);
  h.raw().activeIndex=1;h.raw().requiredComplete=true;h.raw().satisfied=true;h.raw().exercises[0].status='complete';
  h.state.progress=trainingCore._test.snapshotState(h.raw());h.action('training_extra');
  h.observe();h.observe({},3100);h.action('training_ready');
  assert.ok(h.raw().active);
  if(type==='stall_recovery')delete h.raw().active.stallPitchConvention;
  else delete h.raw().active.altitudeStepRulesVersion;
  h.restore();assert.equal(h.raw().active,null);
  assert.equal(h.raw().exercises[0].status,'complete');assert.equal(h.raw().requiredComplete,true);
  assert.match(h.state.coaching.notice,/auswertung aktualisiert/);
  h.observe({},5000);h.observe({},3100);h.action('training_ready');h.restore();
  assert.ok(h.raw().active,'updated attempts resume normally');
});

test('optional stall start reserve does not raise the completed required turn gate',()=>{
  const h=harness([{id:'first',type:'turn_180'},{id:'stall',type:'stall_recovery'}]);
  assert.equal(h.recipe.trainingRecipe.readyMinAglFt,1200);
  h.raw().activeIndex=1;h.raw().requiredComplete=true;h.raw().satisfied=true;h.raw().exercises[0].status='complete';
  h.state.progress=trainingCore._test.snapshotState(h.raw());h.action('training_extra');
  h.observe({aglFt:2500});h.observe({aglFt:2500},3100);
  assert.notEqual(h.state.guidance.canStart,true);
  h.observe();h.observe({},3100);assert.equal(h.state.guidance.canStart,true);
});

test('custom larger stall reserve is preserved in the normalized recipe and guidance',()=>{
  const h=harness([{id:'stall',type:'stall_recovery',startReserveFt:750}]);
  assert.equal(h.recipe.trainingRecipe.readyMinAglFt,3250);
  h.observe({aglFt:3000});assert.match(h.row('altitude').label,/3250 ft AGL.*750 ft Startreserve/);
});
