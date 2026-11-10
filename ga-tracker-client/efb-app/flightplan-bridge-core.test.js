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
test('ATC transfer files once and confirms the filed route without starting mission or sending avionics',async()=>{
 const f=fixture({timeoutMs:1000});let filed,reads=0;f.manager.fileRouteWithAtc=async route=>{f.calls.push('atc');filed=route;};
 f.manager.getAtcRoute=async()=>{f.calls.push('read-atc');return ++reads===1?null:filed;};
 const result=await f.bridge.execute({...job,jobId:'atc',target:'atc'});
 assert.equal(result.ok,true);assert.equal(result.msfs,'confirmed');assert.equal(result.atc,'confirmed');assert.equal(result.avionics,'not_requested');
 assert.deepEqual(f.calls,['save','efb','read','atc','read-atc','read-atc']);
 assert.equal((await f.bridge.execute({...job,jobId:'atc',target:'atc'})).atc,'confirmed');assert.equal(f.calls.filter(c=>c==='atc').length,1);
});
test('ATC write scheduling is not confirmation, and missing ATC support causes no simulator write',async()=>{
 const f=fixture();let result=await f.bridge.execute({...job,target:'atc'});assert.equal(result.error,'flightplan_atc_unavailable');assert.deepEqual(f.calls,[]);
 const g=fixture();g.manager.fileRouteWithAtc=()=>new Promise(()=>{});g.manager.getAtcRoute=async()=>null;
 result=await g.bridge.execute({...job,target:'atc'});assert.equal(result.msfs,'confirmed');assert.equal(result.atc,'unconfirmed');assert.equal(result.stage,'file_atc');
});
test('ATC readback: rounding within 50 m confirms; a reordered route is logged with what the simulator returned',async()=>{
  const f=fixture({timeoutMs:8000});let filed;f.manager.fileRouteWithAtc=async route=>{filed=route;};
  f.manager.getAtcRoute=async()=>({...filed,enroute:filed.enroute.map(leg=>({...leg,lat:Math.round(leg.lat*1000)/1000+0.0002,lon:leg.lon-0.0003}))});
  assert.equal((await f.bridge.execute({...job,jobId:'round',target:'atc'})).atc,'confirmed');
  const g=fixture({timeoutMs:8000});let filed2;g.manager.fileRouteWithAtc=async route=>{filed2=route;};
  g.manager.getAtcRoute=async()=>({...filed2,enroute:filed2.enroute.slice().reverse()});
  const started=Date.now();
  const result=await g.bridge.execute({...job,jobId:'reorder',target:'atc'});
  assert.equal(result.error,'flightplan_atc_readback_mismatch');assert.equal(result.atc,'unconfirmed');
  assert.ok(Date.now()-started>=4500,'waits about 5 s for a slow ATC before giving up');
  assert.equal(result.atcReadback.expectedCount,3);assert.equal(result.atcReadback.got.count,3);
  assert.equal(result.atcReadback.got.legs[0][0],'Ziel');assert.equal(result.atcReadback.got.dep,'');
});
test('ATC variant: airports as airport fixes, other points as unique user waypoints; EFB route unchanged',async()=>{
  const alps={...plan,departureIcao:'LOWZ',destinationIcao:'EDTW',points:[{lat:47.29,lon:12.79,name:'LOWZ',icao:'LOWZ'},{lat:47.22,lon:11.9,name:'WP 2'},
    {lat:47.40,lon:11.84},{lat:47.26,lon:11.35,name:'APT LOJO'},{lat:47.31,lon:11.05,name:'APT LOIN',icao:''},{lat:48.28,lon:8.43,name:'Winzeln',icao:'EDTW'}]};
  const resolve=async ident=>['LOWZ','EDTW','LOJO'].includes(ident)?{__Type:'JS_ICAO',type:'A',region:'',airport:'',ident}:null;
  const built=await core.buildRoute(alps,resolve);
  assert.equal(built.route.enroute.length,4);
  assert.ok(built.route.enroute.every(leg=>leg.hasLatLon===true&&leg.fixIcao.ident===''),'EFB/avionics route stays plain lat/lon');
  const atc=await core.buildAtcRoute(built,resolve);
  assert.deepEqual(atc.enroute.map(leg=>[leg.hasLatLon,leg.fixIcao.type,leg.fixIcao.ident]),
    [[true,'U','WP01'],[true,'U','WP02'],[false,'A','LOJO'],[true,'U','WP03']],'LOIN not found: user waypoint, numbering stays unique');
  assert.ok(core.matchesAtc(atc,atc));
  assert.ok(!core.matchesAtc(atc,{...atc,enroute:[]}),'ATC without legs is a mismatch');
  const f=fixture({timeoutMs:8000,resolveAirport:resolve});let filed;f.manager.fileRouteWithAtc=async route=>{filed=route;};f.manager.getAtcRoute=async()=>filed;
  const result=await f.bridge.execute({jobId:'alps',target:'atc',plan:alps});
  assert.equal(result.atc,'confirmed');assert.equal(filed.enroute[2].fixIcao.ident,'LOJO');
});
