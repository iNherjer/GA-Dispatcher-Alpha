'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const ts=require(process.env.GA_EFB_TEST_TYPESCRIPT || './PackageSources/VfrMultitool/node_modules/typescript');
const adapter=require('./native-flightplan-bridge');
function fixture(listenerAvailable=true) {
  const sent=[],calls=[],frameWindow={postMessage:(value,origin)=>sent.push({value,origin})};let saved={__Type:'JS_FlightPlanRoute'},channel='c',active=true;
  const listener={call:async (name,route)=>{calls.push(name);if(name==='GET_EFB_ROUTE')return saved;if(name==='SAVE_EFB_ROUTE')saved=route;}};
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
  f.bridge.handle(f.event('ga-flightplan-probe'));await f.flush();assert.deepEqual(f.calls,['GET_EFB_ROUTE']);
  assert.equal(f.sent[0].value.ready,true);assert.equal(f.sent[0].value.host,'toolbar');assert.equal(f.sent[0].origin,'http://127.0.0.1:49880');
  f.pause();f.bridge.handle(f.event('ga-flightplan-probe'));await f.flush();assert.equal(f.calls.length,1);
});
test('native wrapper executes one authorized job and reports separate MSFS and avionics results',async()=>{
  const f=fixture();f.bridge.handle(f.event('ga-flightplan-probe'));await f.flush();
  const job={jobId:'j',target:'avionics',plan:{schema:'ga.flightplan-export.v1',routeHash:'hash',points:[{lat:48,lon:8},{lat:49,lon:9}]}};
  f.bridge.handle(f.event('ga-flightplan-send',{job}));await f.flush();
  const result=f.sent.find(item=>item.value.type==='ga-flightplan-result').value.result;
  assert.equal(result.msfs,'confirmed');assert.equal(result.avionics,'sent');assert.equal(result.routeHash,'hash');
  assert.deepEqual(f.calls,['GET_EFB_ROUTE','SAVE_EFB_ROUTE','SEND_ROUTE_TO_EFB','GET_EFB_ROUTE','SEND_ROUTE_TO_AVIONICS']);
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
