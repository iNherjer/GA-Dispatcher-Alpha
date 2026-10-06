'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const runtime=require('./tracker-mission-poi-runtime.js');
const {bundle}=require('./tracker-mission-sar-fixture.js');
function recipe(truth='incident') {
  const r=bundle().executionPoiRecipe;r.version=2;
  r.sarScenario={schema:'sar-search.v2',center:{lat:48.3,lon:8.5},radiusNm:1.5,minSearchSec:180,maxSearchSec:600,truth,
    ...(truth==='incident'?{source:{id:'source',label:'ein Fahrzeug',lat:48.306,lon:8.5,altFt:940}}:{})};
  return r;
}
function sample(at,patch={}){return {observedAt:at,lat:48.306,lon:8.5,altFt:3000,gsKts:85,onGround:false,...patch};}
const facts={active:true,trackingActive:true};
for(const truth of ['incident','no_contact'])for(const invalid of [{lat:null,lon:null},{altFt:null},{gsKts:null}]) {
  test(`SAR ${truth} data gap ${Object.keys(invalid).join('/')} earns no search, evidence or assessment`,()=>{
    const r=recipe(truth);let state=runtime.observe(r,null,sample(1000),facts).state;
    state=runtime.observe(r,state,sample(2000),facts).state;
    const before=structuredClone(state.sarSearchState);
    for(let now=3000;now<=7000;now+=1000)state=runtime.observe(r,state,sample(now,invalid),facts).state;
    assert.notEqual(state.suspendedAt,null);
    state=JSON.parse(JSON.stringify(state));
    const resumed=runtime.observe(r,state,sample(8000,{slewActive:true}),facts);state=resumed.state;
    for(const key of ['observedSec','evidenceSec','assessmentSec'])assert.equal(state.sarSearchState[key],before[key]);
    assert.equal(state.sarSearchState.found,null);
    assert.equal(resumed.effects.some(e=>e.voices?.some(v=>v.label==='Sichtkontakt')),false);
    state=runtime.observe(r,state,sample(9000,{slewActive:true}),facts).state;
    assert.equal(state.sarSearchState.observedSec,before.observedSec+1);
  });
}
test('SAR retains a confirmed contact and its earned assessment across missing telemetry',()=>{
  const r=recipe();let state;
  for(let now=1000;now<=11000;now+=1000)state=runtime.observe(r,state,sample(now),facts).state;
  assert.ok(state.sarSearchState.found);assert.ok(state.sarSearchState.assessmentSec>0);
  const before=structuredClone(state.sarSearchState);
  state=runtime.observe(r,state,sample(12000,{lat:null}),facts).state;
  state=runtime.observe(r,state,sample(60000),facts).state;
  assert.deepEqual(state.sarSearchState.found,before.found);
  assert.equal(state.sarSearchState.assessmentSec,before.assessmentSec);
  state=runtime.observe(r,state,sample(61000),facts).state;
  assert.equal(state.sarSearchState.assessmentSec,before.assessmentSec+1);
});

test('SAR driver checkpoints a buffered search before interruption and recovers without gap credit',()=>{
  const r=recipe();assert.equal(runtime.validateRecipe(r),null);
  let snapshot={recipe:'poi',missionId:r.missionId,runId:'sar-gap-run',executionAuthority:'tracker',authorityRevision:1,
    state:{flags:{active:true},poiTask:null}};
  const manager={getExecutionSnapshot:()=>structuredClone(snapshot),getExecutionPoiRecipe:()=>r,supportsExecutionRecipe:()=>true};
  let fail=false;
  const applySystemEvent=request=>{
    if(fail)return {ok:false,status:'error',error:'fixture-write-failure'};
    snapshot.state.poiTask=structuredClone(request.payload.poiTask);snapshot.authorityRevision++;
    return {ok:true,status:'applied',acceptedEvent:request};
  };
  const driver=()=>runtime.createAuthorityDriver({authorityManager:manager,applySystemEvent,getTaskItemState:()=>({blockingItems:[]})});
  let d=driver();assert.equal(d.observeTelemetry(sample(1000)).ok,true);
  d.observeTelemetry(sample(2000));assert.equal(snapshot.state.poiTask.sarSearchState.observedSec,0,'second valid second is still buffered');
  fail=true;assert.equal(d.observeTelemetry(sample(3000,{lat:null})).ok,false);
  assert.equal(d.observeTelemetry(sample(8000)).ok,false,'new sample cannot pass a failed checkpoint');
  fail=false;assert.equal(d.flush().ok,true);
  assert.equal(snapshot.state.poiTask.suspendedAt,3000);
  assert.equal(snapshot.state.poiTask.sarSearchState.observedSec,1,'earned buffered time survives the checkpoint');
  d=driver();assert.equal(d.observeTelemetry(sample(8000)).ok,true);
  assert.equal(snapshot.state.poiTask.sarSearchState.observedSec,1);
  assert.equal(snapshot.state.poiTask.sarSearchState.found,null);
  d.observeTelemetry(sample(9000));assert.equal(d.flush().ok,true);
  assert.equal(snapshot.state.poiTask.sarSearchState.observedSec,2);
});
