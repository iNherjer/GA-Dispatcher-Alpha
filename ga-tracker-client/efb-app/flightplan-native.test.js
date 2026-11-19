'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const ts=require(process.env.GA_EFB_TEST_TYPESCRIPT || './PackageSources/VfrMultitool/node_modules/typescript');
const adapter=require('./native-flightplan-bridge');
function fixture(listenerAvailable=true) {
  const sent=[],calls=[],frameWindow={postMessage:(value,origin)=>sent.push({value,origin})};let saved={__Type:'JS_FlightPlanRoute'},filed={__Type:'JS_FlightPlanRoute'},channel='c',active=true;
  const listener={call:async (name,route)=>{calls.push(name);if(name==='GET_EFB_ROUTE')return saved;if(name==='GET_ATC_ROUTE')return filed;if(name==='FILE_ROUTE_WITH_ATC')filed=route;if(name==='SAVE_EFB_ROUTE')saved=route;}};
  const sdk={EventBus:class{},FacilityRepository:{getRepository:()=>({})},FacilitySearchType:{Airport:1},
    FacilityLoader:class{async findNearestFacilitiesByIdent(){return [];}}};
  const source=fs.readFileSync(__dirname+'/PackageSources/VfrMultitool/src/FlightPlanBridge.ts','utf8');
  const context={exports:{},Promise,Map,Error,String,JSON,Date,setTimeout,clearTimeout,
    require:name=>name==='@microsoft/msfs-sdk'?sdk:{default:adapter},
    RegisterViewListener:listenerAvailable ? (name,callback)=>{assert.equal(name,'JS_LISTENER_PLANNEDROUTE');queueMicrotask(callback);return listener;} : undefined};
  vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2017}}).outputText,context);
  const bridge=context.exports.createNativeFlightPlanBridge({host:'toolbar',getFrame:()=>({contentWindow:frameWindow}),
    getChannel:()=>channel,isActive:()=>active,trackerOrigin:'http://127.0.0.1:49880',log:()=>{}});
  // Match the actual WindowProxy used by the trust check.
  const event=(type,data={})=>({source:null,origin:'http://127.0.0.1:49880',data:{type,channel:'c',...data}});
  return {bridge,event,sent,calls,frameWindow,setChannel:value=>{channel=value;},pause:()=>{active=false;},
    flush:()=>new Promise(resolve=>setImmediate(resolve))};
}
test('toolbar bridge advertises only after native route read succeeds; wrong origin/channel never reaches simulator',async()=>{
  const f=fixture();f.bridge.handle({...f.event('ga-flightplan-probe'),origin:'https://evil.test'});await f.flush();assert.equal(f.calls.length,0);
  f.bridge.handle(f.event('ga-flightplan-probe',{channel:'old'}));await f.flush();assert.equal(f.calls.length,0);
  f.bridge.handle(f.event('ga-flightplan-probe'));await f.flush();assert.deepEqual(f.calls,['GET_EFB_ROUTE','GET_ATC_ROUTE']);
  assert.equal(f.sent[0].value.ready,true);assert.equal(f.sent[0].value.host,'toolbar');assert.equal(f.sent[0].origin,'http://127.0.0.1:49880');
  f.pause();f.bridge.handle(f.event('ga-flightplan-probe'));await f.flush();assert.equal(f.calls.length,2);
});
test('native wrapper executes one authorized job and reports separate MSFS and avionics results',async()=>{
  const f=fixture();f.bridge.handle(f.event('ga-flightplan-probe'));await f.flush();
  const job={jobId:'j',target:'avionics',plan:{schema:'ga.flightplan-export.v1',routeHash:'hash',points:[{lat:48,lon:8},{lat:49,lon:9}]}};
  f.bridge.handle(f.event('ga-flightplan-send',{job}));await f.flush();
  const result=f.sent.find(item=>item.value.type==='ga-flightplan-result').value.result;
  assert.equal(result.msfs,'confirmed');assert.equal(result.avionics,'sent');assert.equal(result.routeHash,'hash');
  assert.deepEqual(f.calls,['GET_EFB_ROUTE','GET_ATC_ROUTE','SAVE_EFB_ROUTE','SEND_ROUTE_TO_EFB','GET_EFB_ROUTE','SEND_ROUTE_TO_AVIONICS']);
});
test('missing simulator listener disables export without breaking native host construction',async()=>{
  const f=fixture(false);f.bridge.handle(f.event('ga-flightplan-probe'));await f.flush();
  assert.equal(f.sent[0].value.ready,false);assert.equal(f.calls.length,0);
});
test('known child WindowProxy tolerates Coherent null origin, but foreign windows remain rejected',async()=>{
  const f=fixture();f.bridge.handle({...f.event('ga-flightplan-probe'),source:{}});await f.flush();assert.equal(f.calls.length,0);
  f.bridge.handle({...f.event('ga-flightplan-probe'),source:f.frameWindow,origin:'https://evil.test'});await f.flush();assert.equal(f.calls.length,0);
  f.bridge.handle({...f.event('ga-flightplan-probe'),source:f.frameWindow,origin:'null'});await f.flush();assert.equal(f.sent[0].value.ready,true);
});
test('ATC transfer advertises a separate read-verified capability and uses official file/read calls',async()=>{
 const f=fixture();f.bridge.handle(f.event('ga-flightplan-probe'));await f.flush();assert.equal(f.sent.at(-1).value.atcReady,true);
 const job={jobId:'atc',target:'atc',plan:{schema:'ga.flightplan-export.v1',routeHash:'h',points:[{lat:48,lon:8},{lat:49,lon:9}]}};
 f.bridge.handle(f.event('ga-flightplan-send',{job}));await f.flush();
 const result=f.sent.find(item=>item.value.type==='ga-flightplan-result').value.result;assert.equal(result.atc,'confirmed');
 assert.deepEqual(f.calls,['GET_EFB_ROUTE','GET_ATC_ROUTE','SAVE_EFB_ROUTE','SEND_ROUTE_TO_EFB','GET_EFB_ROUTE','FILE_ROUTE_WITH_ATC','GET_ATC_ROUTE']);
});
function fetchFixture({ avionicsReplies = true, synced = null } = {}) {
  const sent = [], calls = [], handlers = {}, frameWindow = { postMessage: (value) => sent.push(value) };
  const ident = (type, value) => ({ __Type: 'JS_ICAO', type, region: 'ED', airport: '', ident: value });
  const route = { __Type: 'JS_FlightPlanRoute', departureAirport: ident('A', 'EDTL'), destinationAirport: ident('A', 'EDTO'), isVfr: true,
    enroute: [{ __Type: 'JS_EnrouteLeg', fixIcao: ident('V', 'KRH'), via: '', isPpos: false, hasLatLon: false, lat: 0, lon: 0,
      hasPointBearingDistance: false, referenceIcao: ident('', ''), bearing: 0, distance: 0, altitude: null, name: 'KRH' }] };
  const listener = {
    on: (name, handler) => { handlers[name] = handler; },
    call: async (name) => {
      calls.push(name);
      if (name === 'GET_EFB_ROUTE' || name === 'GET_ATC_ROUTE') return route;
      if (name === 'REQUEST_AVIONICS_ROUTE') {
        if (avionicsReplies) setTimeout(() => handlers.AvionicsRouteRequestResponse(route, 7), 5);
        return 7;
      }
    }
  };
  const facilities = { EDTL: [48.3693, 7.8277], EDTO: [48.45, 7.92], KRH: [49.0, 8.3] };
  const sdk = { EventBus: class {}, FacilityRepository: { getRepository: () => ({}) }, FacilitySearchType: { Airport: 1 },
    FacilityType: { Airport: 'LOADAIRPORT', VOR: 'LOADVOR', NDB: 'LOADNDB', Intersection: 'LOADINTERSECTION' },
    FacilityLoader: class { async findNearestFacilitiesByIdent() { return []; }
      async getFacility(type, value) { calls.push('facility:' + type + ':' + value.ident); const at = facilities[value.ident]; return at && { lat: at[0], lon: at[1] }; } } };
  const bridge = adapter.create({ host: 'efb', getFrame: () => ({ contentWindow: frameWindow }), getChannel: () => 'c', isActive: () => true,
    trackerOrigin: 'http://127.0.0.1:49880', log: () => {}, sdk, avionicsTimeoutMs: 60,
    registerViewListener: (name, callback) => { queueMicrotask(callback); return listener; } });
  const event = (type, data = {}) => ({ source: null, origin: 'http://127.0.0.1:49880', data: { type, channel: 'c', ...data } });
  return { bridge, event, sent, calls, handlers, route, synced, wait: (ms) => new Promise((resolve) => setTimeout(resolve, ms)) };
}
test('fetching routes reads EFB, ATC and avionics without writing; capabilities announce the fetch support', async () => {
  const f = fetchFixture();
  f.bridge.handle(f.event('ga-flightplan-probe')); await f.wait(20);
  const caps = f.sent.filter((value) => value.type === 'ga-flightplan-capabilities').at(-1);
  assert.equal(caps.fetch, true); assert.equal(caps.avionicsFetch, true); assert.equal(caps.facilities, true);
  for (const source of ['efb', 'atc', 'avionics']) {
    f.bridge.handle(f.event('ga-flightplan-fetch', { job: { jobId: 'f-' + source, source } })); await f.wait(40);
  }
  const results = f.sent.filter((value) => value.type === 'ga-flightplan-fetched').map((value) => value.result);
  assert.deepEqual(results.map((result) => [result.source, result.ok, result.plan.points.map((point) => point.name).join('>')]),
    [['efb', true, 'EDTL>KRH>EDTO'], ['atc', true, 'EDTL>KRH>EDTO'], ['avionics', true, 'EDTL>KRH>EDTO']]);
  assert.equal(results[2].via, 'request');
  assert.ok(f.calls.includes('facility:LOADVOR:KRH'));
  assert.ok(!f.calls.some((name) => /^(SAVE|SEND|FILE)_/.test(name)), 'fetch never writes to the simulator');
});
test('silent avionics fall back to the last synced route, otherwise the fetch reports no reply', async () => {
  const quiet = fetchFixture({ avionicsReplies: false });
  quiet.bridge.handle(quiet.event('ga-flightplan-probe')); await quiet.wait(20);
  quiet.bridge.handle(quiet.event('ga-flightplan-fetch', { job: { jobId: 'a1', source: 'avionics' } })); await quiet.wait(120);
  assert.equal(quiet.sent.find((value) => value.type === 'ga-flightplan-fetched').result.error, 'flightplan_avionics_no_reply');
  quiet.handlers.AvionicsRouteSync(quiet.route);
  quiet.bridge.handle(quiet.event('ga-flightplan-fetch', { job: { jobId: 'a2', source: 'avionics' } })); await quiet.wait(120);
  const synced = quiet.sent.filter((value) => value.type === 'ga-flightplan-fetched').at(-1).result;
  assert.equal(synced.ok, true); assert.equal(synced.via, 'sync');
});
