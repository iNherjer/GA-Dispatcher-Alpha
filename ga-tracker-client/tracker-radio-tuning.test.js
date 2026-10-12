'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events');
const {createRadioTuning}=require('./tracker-radio-tuning'),{createRadioRelay}=require('./tracker-radio-relay');
const core=require('../radio-tuning-core');
const api={SimConnectDataType:{FLOAT64:4},SimConnectPeriod:{ONCE:1},SimConnectConstants:{OBJECT_ID_USER:0},EventFlag:{EVENT_FLAG_GROUPID_IS_PRIORITY:16}};
function fixture(readValue) {
 const handle=new EventEmitter(),writes=[],defs=[],events=[];
 handle.addToDataDefinition=(...args)=>defs.push(args);
 handle.mapClientEventToSimEvent=(...args)=>events.push(args);
 handle.transmitClientEvent=(...args)=>writes.push(args);
 handle.requestDataOnSimObject=(id)=>setImmediate(()=>handle.emit('simObjectData',{requestID:id,data:{readFloat64:()=>readValue()}}));
 return {driver:createRadioTuning(handle,api,{settleMs:0,readTimeout:30}),handle,writes,defs,events};
}
test('writes once and confirms exact target with actual SimConnect event flag',async()=>{
 const f=fixture(()=>123450000);
 const result=await f.driver.execute({kind:'COM',value:'123.450',index:2,slot:'standby'});
 assert.equal(result.confirmed,true);assert.equal(f.writes.length,1);assert.equal(f.writes[0][4],16);
 assert.equal(f.events[0][1],'COM2_STBY_RADIO_SET_HZ');assert.equal(f.defs[0][1],'COM STANDBY FREQUENCY:2');
});
test('unsupported/readback mismatch is never acknowledged as success and never retried as a write',async()=>{
 const f=fixture(()=>118000000);
 assert.equal((await f.driver.execute({kind:'COM',value:'123.450'})).error,'radio_not_confirmed');assert.equal(f.writes.length,1);
 assert.equal((await f.driver.execute({kind:'TACAN',value:'42'})).ok,false);assert.equal(f.writes.length,1);
});
test('ADF packed Hz and squawk readback preserve their units without mode/IDENT/swap commands',async()=>{
 for(const input of [{kind:'ADF',value:'350.5',index:2,slot:'standby'},{kind:'XPDR',value:'0042'}]) {
  const spec=core.normalize(input),f=fixture(()=>spec.expected);
  assert.equal((await f.driver.execute(input)).confirmed,true);assert.equal(f.writes[0][2],spec.encoded);assert.equal(f.defs[0][2],spec.unit);
  assert.equal(f.events.length,1);assert.equal(f.events[0][1],core.event(spec));
 }
});
test('concurrent intents cannot race readback; close rejects pending requests',async()=>{
 const f=fixture(()=>123450000);f.handle.requestDataOnSimObject=()=>{};
 const first=f.driver.execute({kind:'COM',value:'123.450'});
 assert.equal((await f.driver.execute({kind:'COM',value:'124.450'})).error,'radio_busy');
 await new Promise(resolve=>setTimeout(resolve,4));f.handle.emit('close');
 assert.equal((await first).error,'simulator_not_connected');assert.equal(f.writes.length,1);
});
test('relay duplicate/inflight/changed payload and rate limiting prevent repeated writes',async()=>{
 let writes=0;const relay=createRadioRelay(async()=>{writes++;return {ok:true};},()=>1000);
 const request={clientId:'web',commandId:'1',payload:{kind:'XPDR',value:'7000'}};
 await Promise.all([relay(request),relay(request)]);assert.equal(writes,1);
 assert.equal((await relay({...request,payload:{kind:'XPDR',value:'0042'}})).error,'command_id_conflict');
 for(let i=2;i<=60;i++) await relay({...request,commandId:String(i)});
 assert.equal((await relay({...request,commandId:'61'})).error,'radio_rate_limited');assert.equal(writes,60);
});
test('authenticated EFB tool deduplicates radio commands independently of mission authority',async()=>{
 const {createTrackerCockpitControl}=require('./tracker-cockpit-control-core');
 const {createCockpitTools}=require('./tracker-cockpit-tools');
 let calls=0;
 const tools=createCockpitTools({getRun:()=>null,isSimulatorConnected:()=>true,tuneRadio:async()=>{calls++;return {ok:true,confirmed:true};}});
 const control=createTrackerCockpitControl({executeTool:request=>tools.execute(request)});
 const request={commandId:'radio1',intent:'radio_tune',payload:{kind:'COM',value:'123.450'}};
 assert.equal((await control.submitTool(request)).error,'cockpit_session_required');
 const auth=control.register({clientId:'efb',role:'efb'}),envelope={sessionId:auth.session.sessionId,sessionToken:auth.sessionToken};
 const results=await Promise.all([control.submitTool({...request,...envelope}),control.submitTool({...request,...envelope})]);
 assert.equal(results[0].confirmed,true);assert.equal(calls,1);
 assert.equal((await control.submitTool({...request,...envelope,payload:{kind:'COM',value:'124.450'}})).error,'command_id_conflict');
 const offline=createCockpitTools({getRun:()=>null,isSimulatorConnected:()=>false,tuneRadio:async()=>{throw Error('must not write');}});
 assert.equal((await offline.execute(request)).error,'simulator_not_connected');
});
test('radio relay requires an explicit matching PIN even on an existing relay connection',()=>{
 const {hasRadioPin}=require('./tracker-radio-relay');
 assert.equal(hasRadioPin({}, {}, '1234'),false);
 assert.equal(hasRadioPin({}, {pin:'9999'}, '1234'),false);
 assert.equal(hasRadioPin({}, {pin:'1234'}, '1234'),true);
 assert.equal(hasRadioPin({pin:'1234'}, {}, '1234'),true);
});
