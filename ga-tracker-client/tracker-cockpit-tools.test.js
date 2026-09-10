const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createCockpitTools } = require('./tracker-cockpit-tools');
const { createTrackerCockpitControl } = require('./tracker-cockpit-control-core');
const { buildRoute, selectStart } = require('../map-direct-to-core');

function fixture(extra = {}) {
  let run = null, time = 100000, connected = true;
  let flight = { lat: 48.36, lon: 7.83, alt: 500, capturedAt: time, flight: {gsKts: 80} };
  const tools = createCockpitTools({ now: () => time, getRun: () => run, getFlight: () => flight,
    isSimulatorConnected: () => connected, readPayload: async () => ({payloadWeightLbs: 240, stations:[{index:1,weightLbs:180}]}), openExternal: async () => {}, ...extra });
  return { tools, setRun: value => run = value, age: value => time += value, offline: () => connected = false };
}
const airport = { icao:'EDTO',name:'Offenburg',lat:48.45,lon:7.92 };
const direct = { intent:'airport_direct_to',expectedRevision:0,payload:{airport,forceGpsStart:true} };

test('Direct To uses the App route builder, persists navigation only and rejects active/stale/invalid requests', async t => {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'cockpit-tools-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const filename=path.join(dir,'route.json'), f=fixture({filename});
  const result=await f.tools.execute(direct);assert.equal(result.ok,true);
  const points=JSON.parse(fs.readFileSync(filename)).points;
  assert.deepEqual(points,buildRoute({lat:48.36,lng:7.83},airport,'Live GPS Position','GPS'));
  assert.equal(result.map.navigationOnly,true);assert.equal(result.map.missionId,'');assert.equal(result.map.runId,'');
  assert.equal(result.map.context.destinationIcao,'EDTO');assert.equal(result.map.route.waypoints.length,2);
  assert.equal(fixture({filename}).tools.snapshot().routeId,result.map.routeId);
  assert.equal((await f.tools.execute(direct)).error,'navigation_revision_conflict');
  f.setRun({missionId:'active'});assert.equal(f.tools.snapshot(),null);assert.equal((await f.tools.execute({...direct,expectedRevision:1})).error,'mission_authority_conflict');
  f.setRun(null);f.age(30001);assert.equal((await f.tools.execute({...direct,expectedRevision:1})).error,'live_position_required');
  assert.equal((await f.tools.execute({...direct,expectedRevision:1,payload:{airport,forceGpsStart:false}})).ok,true,'existing start remains usable offline');
  assert.equal((await f.tools.execute({...direct,payload:{airport:{...airport,lon:null}}})).error,'invalid_airport');
  f.tools.clear();assert.equal(f.tools.snapshot(),null);assert.equal(fs.existsSync(filename),false);
});
test('shared Direct To selection preserves existing start, GPS priority and no-position failure',()=>{
  const route=[{lat:1,lng:0},{lat:2,lon:3}],position={lat:4,lon:5};
  assert.deepEqual(selectStart({route,position,gpsLive:true}),{lat:1,lng:0,existing:true,elevationFt:undefined});
  assert.deepEqual(selectStart({route,position,gpsLive:true,forceGpsStart:true}),{lat:4,lng:5,existing:false});
  assert.equal(selectStart({route:[],gpsLive:false}),null);
});
test('payload reads coalesce, release after failure and never change mission state',async()=>{
  let calls=0,release;const f=fixture({readPayload:()=>{calls++;return new Promise(r=>release=r);}});f.setRun({missionId:'m'});
  const a=f.tools.execute({intent:'read_payload'}),b=f.tools.execute({intent:'read_payload'});await Promise.resolve();assert.equal(calls,1);
  release({stations:[],payloadWeightLbs:7});assert.deepEqual(await a,await b);assert.equal(f.tools.snapshot(),null);
  f.offline();assert.equal((await f.tools.execute({intent:'read_payload'})).error,'simulator_not_connected');
});
test('AIP external opening uses the original country routes and accepts no arbitrary URL',async()=>{
  const opened=[],f=fixture({openExternal:async url=>opened.push(url)});
  assert.equal((await f.tools.execute({intent:'open_airport_aip',payload:{icao:'EDTO'}})).ok,true);
  assert.deepEqual(opened,['https://aip.aero/de/en/vfr/?EDTO=']);
  assert.equal((await f.tools.execute({intent:'open_airport_aip',payload:{icao:'https://evil'}})).ok,false);
  assert.equal((await f.tools.execute({intent:'open_airport_aip',payload:{icao:'XXXX',country:'bad'}})).ok,false);
});
test('tool commands require a session, deduplicate inflight calls and stay out of mission intents',async()=>{
  let calls=0;const f=fixture();const control=createTrackerCockpitControl({executeTool:async request=>{calls++;return f.tools.execute(request);}});
  const request={...direct,commandId:'one'};
  assert.equal((await control.submitTool(request)).error,'cockpit_session_required');
  const auth=control.register({clientId:'efb',role:'efb'}),envelope={sessionId:auth.session.sessionId,sessionToken:auth.sessionToken};
  const [a,b]=await Promise.all([control.submitTool({...request,...envelope}),control.submitTool({...request,...envelope})]);
  assert.equal(a.ok,true);assert.deepEqual(a,b);assert.equal(calls,1);
  assert.equal((await control.submitTool({...request,...envelope,payload:{airport:{...airport,name:'changed'}}})).error,'command_id_conflict');
  assert.equal((await control.submitIntent({...request,...envelope})).error,'mission_intent_not_allowed');
  assert.equal((await control.submitTool({...request,...envelope,intent:'aircraft_payload_set'})).error,'cockpit_tool_not_allowed');
});

test('weather fallback opens only the fixed METAR page for a validated airport',async()=>{
  const opened=[],f=fixture({openExternal:async url=>opened.push(url)});
  assert.equal((await f.tools.execute({intent:'open_airport_weather',payload:{icao:'edtl',url:'file:///bad'}})).ok,true);
  assert.deepEqual(opened,['https://metar-taf.com/de/EDTL']);
  assert.equal((await f.tools.execute({intent:'open_airport_weather',payload:{icao:'EDTL/../../bad'}})).ok,false);
  assert.equal(opened.length,1);
});

test('Direct To keeps known departure and destination elevations including sea level',()=>{
  const start=selectStart({route:[{lat:48,lng:8,elevationFt:0},{lat:49,lng:9}]});
  const route=buildRoute(start,{icao:'TEST',name:'Mountain',lat:49,lon:9,elevation:5432},'Start','ZERO');
  assert.equal(route[0].elevationFt,0);assert.equal(route[1].elevationFt,5432);
});
