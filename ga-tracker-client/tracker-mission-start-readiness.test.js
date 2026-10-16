'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { createMissionStartReadiness, projectStartReadiness } = require('./tracker-mission-start-readiness');
function fixture() {
  let at = 100000;
  const guard = createMissionStartReadiness({ now: () => at });
  const sample = (patch = {}) => guard.observe({ observedAt: at, simRunning: 1, simPaused: false, inMenuOrMap: false,
    slewActive: false, cameraState: 2, lat: 51.5, lon: 7, altFt: 600, onGround: true, gsKts: 0, ...patch });
  const tick = (ms = 500, patch = {}) => { at += ms; return sample(patch); };
  const ready = () => { sample(); for (let n=0;n<6;n++) tick(); return guard.snapshot(); };
  return { guard, sample, tick, ready, at: () => at, advance: ms => { at += ms; } };
}
test('foreign airport is ready only after three seconds of fresh stationary ground evidence', () => {
  const f=fixture(); assert.equal(f.guard.snapshot().ready,false); f.sample();
  for(let n=0;n<5;n++) assert.equal(f.tick().ready,false);
  assert.equal(f.tick().ready,true);
});
for(const patch of [{simRunning:0},{simRunning:null},{simPaused:true},{inMenuOrMap:true},{cameraState:9},{cameraState:10},
  {cameraState:11},{cameraState:13},{cameraState:27},{cameraState:null},{lat:0,lon:0},{lat:0,lon:90},
  {lat:null},{lat:NaN},{lat:95},{onGround:false},{onGround:null},{gsKts:0.6},{gsKts:2},{gsKts:null},{slewActive:true},{slewActive:null}])
 test(`menu/loading/airborne/moving/unknown data revoke readiness immediately: ${JSON.stringify(patch)}`,()=>{
   const f=fixture();assert.equal(f.ready().ready,true);assert.equal(f.tick(500,patch).ready,false);
   assert.equal(f.tick().ready,false);for(let n=0;n<4;n++)f.tick();assert.equal(f.tick().ready,false);assert.equal(f.tick().ready,true);
 });
test('external live views work, but DialogMode does not masquerade as main menu',()=>{
  const f=fixture();f.sample({cameraState:3,dialogMode:1});for(let n=0;n<6;n++)f.tick(500,{cameraState:3,dialogMode:1});assert.equal(f.guard.snapshot().ready,true);
});
test('telemetry silence, teleport, backward clock and detach never retain the start action',()=>{
  const f=fixture();f.ready();f.advance(2501);assert.equal(f.guard.snapshot().ready,false);
  assert.equal(f.sample().ready,false);f.ready();assert.equal(f.tick(500,{lat:52}).ready,false);
  f.ready();assert.equal(f.sample({observedAt:f.at()-500}).ready,false);f.guard.reset();assert.equal(f.guard.snapshot().ready,false);
});
test('projection hides every start action and expires even without new telemetry',()=>{
 const f=fixture();const control={phase:'planned',nextStep:'prepare_mission',allowedActions:['abort_mission','prepare_mission','start_boarding','confirm_load','start_mission']};
 const blocked=projectStartReadiness(control,f.guard.snapshot(),f.at());assert.deepEqual(blocked.allowedActions,['abort_mission']);assert.equal(blocked.nextStep,null);
 const ready=f.ready();assert.deepEqual(projectStartReadiness(control,ready,f.at()).allowedActions,control.allowedActions);
 assert.deepEqual(projectStartReadiness(control,ready,f.at()+2501).allowedActions,['abort_mission']);
 assert.equal(control.allowedActions.length,5);
});
