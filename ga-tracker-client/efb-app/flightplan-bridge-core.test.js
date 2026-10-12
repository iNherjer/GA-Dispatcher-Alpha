'use strict';
const test=require('node:test'), assert=require('node:assert/strict');
const core=require('./flightplan-bridge-core');
const plan={schema:'ga.flightplan-export.v1',missionId:'m',runId:'r',routeHash:'hash',departureIcao:'EDTW',destinationIcao:'EDTO',
  cruiseAltitudeFt:4500,points:[{lat:48,lon:8,name:'Start',elevationFt:800},{lat:48.5,lon:8.5,name:'POI'}, {lat:49,lon:9,name:'Ziel'}]};
const job={jobId:'j',target:'avionics',plan};
function fixture(extra={}) {
  const calls=[];let saved;
  const manager={saveEfbRoute:async r=>{calls.push('save');saved=r;},sendRouteToEfb:async()=>{calls.push('efb');},
    getEfbRoute:async()=>{calls.push('read');return saved;},sendRouteToAvionics:async()=>{calls.push('avionics');}};
  const bridge=core.create({getManager:async()=>manager,timeoutMs:30,...extra});
  return {calls,manager,bridge};
}
test('route conversion preserves custom endpoints and POI order, never exports terrain as leg altitude',async()=>{
  const built=await core.buildRoute(plan);
  assert.equal(built.route.enroute.length,3);assert.equal(built.route.enroute[0].altitude,null);
  assert.equal(built.route.cruiseAltitude.altitude,4500);
  const airports=await core.buildRoute(plan,async ident=>({__Type:'JS_ICAO',type:'A',region:'',airport:'',ident}));
  assert.equal(airports.route.enroute.length,1);assert.equal(airports.route.enroute[0].name,'POI');
});
test('save, delivery, readback and avionics use the same route; duplicate requests do not write again',async()=>{
  const f=fixture();const [a,b]=await Promise.all([f.bridge.execute(job),f.bridge.execute(job)]);
  assert.deepEqual(a,b);assert.equal(a.msfs,'confirmed');assert.equal(a.avionics,'sent');
  assert.deepEqual(f.calls,['save','efb','read','avionics']);
  assert.equal((await f.bridge.execute({...job,target:'msfs'})).error,'flightplan_job_conflict');
});
test('partial avionics error preserves confirmed MSFS success',async()=>{
  const f=fixture();f.manager.sendRouteToAvionics=async()=>{throw new Error('sim_rejected');};
  const result=await f.bridge.execute(job);assert.equal(result.ok,false);assert.equal(result.msfs,'confirmed');assert.equal(result.error,'sim_rejected');
});
test('readback mismatch stops avionics and reports uncertainty instead of false success',async()=>{
  const f=fixture();f.manager.getEfbRoute=async()=>({__Type:'JS_FlightPlanRoute',enroute:[]});
  const result=await f.bridge.execute(job);assert.equal(result.error,'flightplan_readback_mismatch');assert.equal(result.avionics,'not_sent');
  assert.equal(f.calls.includes('avionics'),false);
});
test('timeout cannot continue to later writes when the old promise eventually resolves',async()=>{
  let finish;const f=fixture();f.manager.saveEfbRoute=()=>new Promise(resolve=>{finish=resolve;});
  const result=await f.bridge.execute(job);assert.equal(result.error,'flightplan_timeout');finish();
  await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(f.calls,[]);
  assert.equal((await f.bridge.execute({...job,jobId:'retry'})).error,'flightplan_busy');
});
test('closed host prevents any simulator write',async()=>{
  const f=fixture({isActive:()=>false});assert.equal((await f.bridge.execute(job)).error,'flightplan_host_closed');assert.deepEqual(f.calls,[]);
});
test('mission replacement cancels remaining writes without undoing the mission or previous simulator writes',async()=>{
  let finish;const f=fixture();f.manager.saveEfbRoute=()=>new Promise(resolve=>{finish=resolve;});
  const pending=f.bridge.execute(job);await new Promise(resolve=>setImmediate(resolve));
  f.bridge.cancel(job.jobId);finish();const result=await pending;
  assert.equal(result.error,'flightplan_host_closed');assert.equal(f.calls.includes('avionics'),false);assert.equal(f.calls.includes('efb'),false);
});
test('unknown avionics timeout retains MSFS success and marks delivery unconfirmed',async()=>{
  const f=fixture();f.manager.sendRouteToAvionics=()=>new Promise(()=>{});
  const result=await f.bridge.execute(job);assert.equal(result.msfs,'confirmed');assert.equal(result.avionics,'unconfirmed');
  assert.equal(result.stage,'send_avionics');assert.equal(result.error,'flightplan_timeout');
});
