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

const importCore = require('./flightplan-bridge-core');
function icao(type, ident, airport = '') { return { __Type: 'JS_ICAO', type, region: 'ED', airport, ident }; }
function leg(fields) {
  return Object.assign({ __Type: 'JS_EnrouteLeg', fixIcao: icao('', ''), via: '', isPpos: false, hasLatLon: false, lat: 0, lon: 0,
    hasPointBearingDistance: false, referenceIcao: icao('', ''), bearing: 0, distance: 0, altitude: null, name: '' }, fields);
}
const facilities = { EDTL: { lat: 48.3693, lon: 7.8277 }, EDTO: { lat: 48.4500, lon: 7.9200 }, KRH: { lat: 49.0, lon: 8.3 }, ANEKI: { lat: 48.6, lon: 8.1 } };
const resolveFacility = async (value) => facilities[value.ident] || null;

test('a simulator route becomes navigation points with airports, fixes, user points and bearing/distance fixes', async () => {
  const route = { __Type: 'JS_FlightPlanRoute', departureAirport: icao('A', 'EDTL'), destinationAirport: icao('A', 'EDTO'),
    departure: '', arrival: '', approach: { type: '' }, isVfr: true, cruiseAltitude: { altitude: 4500, isFlightLevel: false },
    enroute: [
      leg({ fixIcao: icao('V', 'KRH'), name: 'KRH' }),
      leg({ hasLatLon: true, lat: 48.7, lon: 8.2, name: 'Baden-Baden' }),
      leg({ hasPointBearingDistance: true, referenceIcao: icao('V', 'KRH'), bearing: 180, distance: 30, name: 'KRH180030' }),
      leg({ fixIcao: icao('W', 'ANEKI'), via: 'T104', name: 'ANEKI' })
    ] };
  const parsed = await importCore.parseRoute(route, resolveFacility, 'efb');
  assert.equal(parsed.plan.schema, 'ga.flightplan-import.v1');
  assert.equal(parsed.plan.departureIcao, 'EDTL');
  assert.equal(parsed.plan.destinationIcao, 'EDTO');
  assert.equal(parsed.plan.cruiseAltitudeFt, 4500);
  assert.deepEqual(parsed.plan.points.map((point) => point.name), ['EDTL', 'KRH', 'Baden-Baden', 'KRH180030', 'ANEKI', 'EDTO']);
  assert.equal(parsed.plan.points[0].icao, 'EDTL');
  assert.equal(parsed.plan.points[1].icao, '');
  // 30 nm due south of 49.0 N is 0.5 degrees of latitude.
  assert.ok(Math.abs(parsed.plan.points[3].lat - 48.5) < 0.001);
  assert.ok(Math.abs(parsed.plan.points[3].lon - 8.3) < 0.001);
  assert.deepEqual(parsed.warnings, ['airway_direct:T104']);
});

test('procedures and unknown fixes become warnings; a route without two points is rejected', async () => {
  const route = { __Type: 'JS_FlightPlanRoute', departureAirport: icao('A', 'EDTL'), destinationAirport: icao('A', 'EDTO'),
    departure: 'RILAX2B', arrival: 'BADSO1A', approach: { type: 'ILS' }, isVfr: false, cruiseAltitude: null,
    enroute: [leg({ fixIcao: icao('W', 'NOWHERE'), name: 'NOWHERE' }), leg({ isPpos: true })] };
  const parsed = await importCore.parseRoute(route, resolveFacility, 'atc');
  assert.deepEqual(parsed.plan.points.map((point) => point.name), ['EDTL', 'EDTO']);
  assert.deepEqual(parsed.warnings, ['procedure_skipped:SID RILAX2B', 'fix_unresolved:NOWHERE', 'ppos_skipped',
    'procedure_skipped:STAR BADSO1A', 'procedure_skipped:APPROACH']);
  await assert.rejects(importCore.parseRoute({ __Type: 'JS_FlightPlanRoute', departureAirport: icao('', ''), destinationAirport: icao('', ''), enroute: [] }, resolveFacility, 'efb'),
    /flightplan_import_empty/);
  await assert.rejects(importCore.parseRoute({ __Type: 'JS_FlightPlanRoute', departureAirport: icao('A', 'XXXX'), destinationAirport: icao('', ''), enroute: [] }, resolveFacility, 'efb'),
    /flightplan_import_unresolved/);
  // Without a facility database only coordinate legs survive.
  const noLookup = await importCore.parseRoute({ __Type: 'JS_FlightPlanRoute', departureAirport: icao('A', 'EDTL'), destinationAirport: icao('', ''),
    enroute: [leg({ hasLatLon: true, lat: 48.1, lon: 8.1, name: 'A' }), leg({ hasLatLon: true, lat: 48.2, lon: 8.2, name: 'B' })] }, undefined, 'efb');
  assert.deepEqual(noLookup.plan.points.map((point) => point.name), ['A', 'B']);
  assert.ok(noLookup.warnings.includes('facility_lookup_unavailable'));
});

test('fetchRoute reads the chosen source only and never writes to the simulator', async () => {
  const calls = [];
  const route = { __Type: 'JS_FlightPlanRoute', departureAirport: icao('A', 'EDTL'), destinationAirport: icao('A', 'EDTO'), enroute: [] };
  const manager = {
    getEfbRoute: async () => { calls.push('efb'); return route; },
    getAtcRoute: async () => { calls.push('atc'); return route; },
    readAvionicsRoute: async () => { calls.push('avionics'); return { route, via: 'request' }; },
    saveEfbRoute: async () => calls.push('WRITE'), sendRouteToEfb: async () => calls.push('WRITE'), sendRouteToAvionics: async () => calls.push('WRITE')
  };
  const bridge = importCore.create({ getManager: async () => manager, resolveFacility });
  for (const source of ['efb', 'atc', 'avionics']) {
    const result = await bridge.fetchRoute({ jobId: 'f-' + source, source });
    assert.equal(result.ok, true);
    assert.equal(result.plan.points.length, 2);
  }
  assert.deepEqual(calls, ['efb', 'atc', 'avionics']);
  assert.equal((await bridge.fetchRoute({ jobId: 'bad', source: 'fms' })).error, 'flightplan_request_invalid');
  const noAvionics = importCore.create({ getManager: async () => ({ getEfbRoute: manager.getEfbRoute }), resolveFacility });
  assert.equal((await noAvionics.fetchRoute({ jobId: 'n', source: 'avionics' })).error, 'flightplan_avionics_unavailable');
});
