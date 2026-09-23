import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { ORIGINAL_BUSH_FUNCTIONS } from '../tools/fixtures/bush-runtime-legacy-20260923.js';

const require=createRequire(import.meta.url);
const core=require('../mission-bush-task-core.js');
function haversineNm(a,b,c,d){const p=Math.PI/180,x=(c-a)*p,y=(d-b)*p,q=Math.sin(x/2)**2+Math.cos(a*p)*Math.cos(c*p)*Math.sin(y/2)**2;return 2*Math.atan2(Math.sqrt(q),Math.sqrt(1-q))*3440.065;}
function reference(input) {
  let progress={...input.progress};
  const window={lastLiveGpsPos:input.position};
  const context={window,Date,Number,Math,JSON,isFinite,flightRecorder:input.recorder||{hadAirbornePhase:true}};
  context._missionSceneIsBushMission=()=>true;
  context._activeBushMissionSpec=()=>input.spec;
  context._activeBushMissionProgress=()=>progress;
  context._persistBushMissionProgress=p=>{progress=p;};
  context._missionEndReadiness=()=>input.endReady;
  context._missionCargoEnsureManifest=()=>input.manifest||{items:[]};
  context._missionCargoIsPassengerItem=item=>String(item?.itemType||'').toLowerCase()==='passenger';
  context._isAtMissionHome=()=>input.atHome===true;
  context._isAtAptArrivalPoint=()=>input.atArrivalPoint===true;
  context._missionHasReachedEndEligibleFlightPhase=()=>input.endEligibleFlightPhase===true;
  context._missionPoiTaskProgressState=()=>input.poiProgress||null;
  context._haversineNmLocal=haversineNm;
  vm.runInNewContext(ORIGINAL_BUSH_FUNCTIONS,context);
  context._missionBushUpdateProgress(input.position?.lat??null,input.position?.lon??null,input.now);
  const pickupReady=context._missionBushPickupReadyForAction();
  const canEndHere=context._missionBushGroundEndReady(input.endReady);
  return {progress,canEndHere,pickupReady};
}
function compare(input) {
  const actual=core.evaluate(input), expected=reference(input);
  assert.equal(actual.canEndHere,expected.canEndHere);
  assert.equal(actual.pickupReady,expected.pickupReady);
  assert.deepEqual({...actual.progress},{...expected.progress});
}

const pos={lat:45,lon:7};
test('passenger pickup with required companion cargo remains loading and actionable',()=>{
  compare({spec:{targetMode:'strip_then_return',pickupKind:'passenger',requiresReturnHome:true},progress:{status:'pickup_ready'},
    manifest:{items:[{pickupLocation:'target',required:true,itemType:'passenger',status:'loaded'},{pickupLocation:'target',required:true,itemType:'cargo',status:'pending'}]},
    position:pos,endReady:{atTarget:true,groundStill:true},atHome:false,atArrivalPoint:true,now:10000});
});
test('cargo pickup waits for confirmation and computes action and end gates',()=>{
  compare({spec:{targetMode:'strip_then_return',pickupKind:'cargo',requiresReturnHome:true},progress:{status:'pickup_loading',pickupConfirmed:false},
    manifest:{items:[{pickupLocation:'target',required:true,itemType:'cargo',status:'loaded'}]},position:pos,
    endReady:{atTarget:true,groundStill:true},atHome:false,atArrivalPoint:true,now:10000,endEligibleFlightPhase:true});
});
test('each strip-target completion profile uses original end readiness',()=>{
  for(const [profileId,completionMode] of [['bush_supply_strip','unload_at_target'],['bush_charter_strip','passenger_dropoff'],['bush_scenic_hopper','land_at_target']]) {
    const input={spec:{profileId,targetMode:'strip',completionMode},progress:{status:'ready_to_close'},manifest:{items:[]},position:pos,
      endReady:{atTarget:true,groundStill:true},atHome:false,atArrivalPoint:false,now:10000,endEligibleFlightPhase:false};
    compare(input);
    assert.equal(core.isProductionSupported(input.spec),true);
  }
});
test('area_then_return POI task remains differentially faithful and is production enabled',()=>{
  const input={spec:{profileId:'bush_recon_return',targetMode:'area_then_return',completionMode:'return_home',requiresReturnHome:true},
    progress:{status:'on_task'},manifest:{items:[]},position:pos,endReady:{atTarget:true,groundStill:false},atHome:false,atArrivalPoint:false,
    poiProgress:{trackingActive:true,satisfied:true,dwellSec:37,trackNm:1.25},now:10000};
  compare(input);
  assert.equal(core.isProductionSupported(input.spec),true);
});
