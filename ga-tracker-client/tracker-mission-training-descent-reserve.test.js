'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const runtime=require('./tracker-mission-training-runtime.js');
const core=require('../mission-training-core.js').create({}, {now:()=>0});
const {bundle}=require('./tracker-mission-training-fixture.js');
function harness(mode='POI', raw={}) {
  const recipe=structuredClone(bundle().executionPoiRecipe);
  recipe.missionMode=mode;
  recipe.trainingRecipe=core.normalizeRecipe({schema:'ga.trainingRecipe.v1',key:'descent-reserve',requiredCount:1,
    exercises:[{id:'descent',type:'altitude_step_hold',direction:'descent',altitudeStepFt:500,holdSec:5,stableSec:1}],...raw});
  recipe.voiceContext.trainingRecipe=recipe.trainingRecipe;
  recipe.voiceContext.passenger.trainingRecipe=recipe.trainingRecipe;
  let state=runtime.createState(recipe),now=10000;
  const observe=(patch={},dt=1000)=>{
    now+=dt;
    const result=runtime.observe(recipe,state,{observedAt:now,lat:48.3,lon:8.5,altFt:3000,aglFt:1750,
      hdg:90,bankDeg:0,vsFpm:0,iasKts:90,gsKts:90,gForce:1.1,onGround:false,...patch});
    state=result.state;return result;
  };
  const action=intent=>{const result=runtime.action(recipe,state,intent,++now);state=result.state;return result;};
  return {recipe,observe,action,restore(){state=runtime.createState(recipe,structuredClone(state));},
    get state(){return state;},get raw(){return state.checkpoint.procedureState.activeState;}};
}
test('descent readiness includes the step and published altitude tolerance, even with an old lower gate',()=>{
  const h=harness('POI',{readyMinAglFt:1200});
  assert.equal(h.recipe.trainingRecipe.readyMinAglFt,1750);
  const custom=harness('POI',{minAglFt:1500,exercises:[{id:'d',type:'altitude_step_hold',direction:'descent',altitudeStepFt:1000,maxAltitudeDeltaFt:100}]});
  assert.equal(custom.recipe.trainingRecipe.readyMinAglFt,2600);
});
for(const mode of ['POI','APT']) {
  test(`${mode} low descent stays locked and voice/banner share the reserve`,()=>{
    const h=harness(mode);
    const first=h.observe({aglFt:1400});h.observe({aglFt:1400},3100);
    assert.equal(h.state.progress.startAvailable,false);
    assert.equal(h.raw.active,null);
    assert.match(h.state.guidance.rows.find(r=>r.id==='altitude').label,/1750 ft AGL/);
    assert.match(first.voices.map(v=>v.resolvedRecipe.fallbackText).join(' '),/1750 ft AGL/);
    h.action('training_ready');assert.equal(h.raw.active,null);
  });
  test(`${mode} descent at the reserve completes after restore with Slew and the allowed low edge`,()=>{
    const h=harness(mode);const slew={slewActive:true,slewMode:true,isSlewActive:true};
    h.observe(slew);h.observe(slew,3100);assert.equal(h.state.guidance.canStart,true);
    h.action('training_ready');assert.equal(h.raw.active.targetAltFt,2500);
    h.restore();
    for(let i=0;i<7;i++)h.observe(slew);
    assert.equal(h.raw.active.phase,'altitude_change');
    h.observe({...slew,altFt:2500,aglFt:1250});h.observe({...slew,altFt:2500,aglFt:1250});
    assert.equal(h.raw.active.phase,'hold_final');
    for(let i=0;i<7;i++)h.observe({...slew,altFt:2450,aglFt:1200});
    assert.equal(h.state.progress.requiredComplete,true);
  });
  test(`${mode} an optional descent gets its own start reserve without raising a turn's gate`,()=>{
    const h=harness(mode,{exercises:[{id:'turn',type:'turn_180'},{id:'descent',type:'altitude_step_hold',direction:'descent',altitudeStepFt:500}]});
    assert.equal(h.recipe.trainingRecipe.readyMinAglFt,1200);
    h.raw.activeIndex=1;h.raw.requiredComplete=true;h.raw.satisfied=true;h.raw.exercises[0].status='complete';
    h.state.progress=core._test.snapshotState(h.raw);
    h.action('training_extra');h.observe({aglFt:1400});h.observe({aglFt:1400},3100);
    assert.equal(h.state.progress.startAvailable,false);
    h.observe();h.observe({},3100);assert.equal(h.state.progress.startAvailable,true);
    h.action('training_ready');assert.equal(h.raw.active.targetAltFt,2500);
  });
}
test('climb, turn and stall gates keep their existing minima',()=>{
  for(const [type,direction,expected] of [['altitude_step_hold','climb',1200],['turn_180','either',1200],['stall_recovery','either',2500]]) {
    assert.equal(harness('POI',{exercises:[{id:type,type,direction}]}).recipe.trainingRecipe.readyMinAglFt,expected);
  }
});

for(const mode of ['POI','APT']) {
  test(`${mode} losing the descent reserve before the click revokes a prepared start`,()=>{
    const h=harness(mode);h.observe();h.observe({},3100);assert.equal(h.state.guidance.canStart,true);
    h.observe({aglFt:1749});assert.equal(h.state.guidance.canStart,false);
    h.action('training_ready');assert.equal(h.raw.active,null);
    h.observe();h.observe({},3100);assert.equal(h.state.guidance.canStart,true);
  });
  test(`${mode} restores an old recipe without permitting its former low start gate`,()=>{
    const h=harness(mode);h.recipe.trainingRecipe.readyMinAglFt=1200;
    h.raw.recipe.readyMinAglFt=1200;h.restore();
    h.observe({aglFt:1400});h.observe({aglFt:1400},3100);
    assert.equal(h.state.progress.startAvailable,false);
    assert.match(h.state.guidance.rows.find(r=>r.id==='altitude').label,/1750 ft AGL/);
    h.observe();h.observe({},3100);assert.equal(h.state.guidance.canStart,true);
  });
}
