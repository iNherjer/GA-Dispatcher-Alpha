'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {EventEmitter}=require('node:events');
const {createClockTelemetry}=require('./tracker-clock-telemetry');
function fixture(){
 const handle=new EventEmitter(),definitions=[],rows=[];let at=1000,id=0;
 handle.addToDataDefinition=(...args)=>{definitions.push(args);return ++id;};
 handle.requestDataOnSimObject=()=>++id;
 const clock=createClockTelemetry({handle,definitionId:210,requestId:210,float64Type:4,period:3,now:()=>at,log:x=>rows.push(x)});
 const receive=(values,extra={})=>{let i=0;handle.emit('simObjectData',{requestID:210,defineID:210,objectID:0,defineCount:3,data:{remaining:()=>24,readFloat64:()=>values[i++]},...extra});};
 return {handle,clock,definitions,rows,receive,setAt:value=>at=value};
}
test('independent clock ignores aircraft packet and reports bulk mismatch once',()=>{
 const f=fixture();assert.deepEqual(f.definitions.map(x=>x[1]),['ABSOLUTE TIME','LOCAL TIME','SIMULATION RATE']);
 assert.ok(f.definitions.every(x=>x[3]===4));
 f.receive([63900000000,43200,1]);
 f.handle.emit('simObjectData',{requestID:206,data:{readFloat64(){throw Error('must not decode');}}});
 const sample=f.clock.diagnose({simAbsoluteTimeSeconds:1,simLocalTimeSeconds:0});
 assert.equal(sample.simAbsoluteTimeSeconds,63900000000);assert.equal(sample.simLocalTimeSeconds,43200);
 f.clock.diagnose({simAbsoluteTimeSeconds:1});assert.equal(f.rows.length,1);assert.match(f.rows[0],/"mismatch":true/);
 f.setAt(4000);assert.equal(f.clock.diagnose().status,'stale');assert.equal(f.clock.snapshot().simAbsoluteTimeSeconds,null);
 f.receive([63900000003,43203,2]);assert.equal(f.clock.snapshot().status,'ok');
 f.clock.dispose();assert.equal(f.handle.listenerCount('simObjectData'),0);assert.equal(f.clock.snapshot().simAbsoluteTimeSeconds,null);
});
test('wrong identity, short packet, bogus clock and asynchronous definition error fail closed and recover',()=>{
 const f=fixture();
 for(const extra of [{defineCount:2},{objectID:-1},{defineID:206},{data:{remaining:()=>16}}]){
  f.receive([63900000000,0,1],extra);assert.equal(f.clock.snapshot().status,'error');assert.equal(f.clock.snapshot().simAbsoluteTimeSeconds,null);
 }
 for(const values of [[1,0,1],[63900000000,86400,1],[63900000000,1,0],[NaN,1,1]]){
  f.receive(values);assert.equal(f.clock.snapshot().status,'error');
 }
 f.receive([63900000000,0,0.0625]);assert.equal(f.clock.snapshot().status,'ok');
 f.handle.emit('exception',{sendId:1,exceptionName:'NAME_UNRECOGNIZED'});
 assert.match(f.clock.snapshot().error,/ABSOLUTE TIME:NAME_UNRECOGNIZED/);
 f.receive([63900000001,1,1]);assert.equal(f.clock.snapshot().status,'ok');
});

test('real node-simconnect decoder accepts concrete user aircraft ID and preserves time shift',()=>{
 const {RawBuffer}=require('node-simconnect/dist/RawBuffer');
 const {RecvSimObjectData}=require('node-simconnect/dist/recv/RecvSimObjectData');
 const f=fixture();
 const packet=(seconds,local)=>{
  const b=Buffer.alloc(52);
  [210,1,210,0,1,1,3].forEach((v,i)=>b.writeInt32LE(v,i*4));
  [seconds,local,1].forEach((v,i)=>b.writeDoubleLE(v,28+i*8));
  f.handle.emit('simObjectData',new RecvSimObjectData(new RawBuffer(b)));
 };
 packet(63900000000,43200);assert.equal(f.clock.snapshot().status,'ok');
 const rows=[],d=require('./tracker-environment-diagnostics').createEnvironmentDiagnostics(x=>rows.push(x));
 d.observe({observedAt:1000,...f.clock.snapshot()});
 f.setAt(2000);packet(63900007201,50401);d.observe({observedAt:2000,...f.clock.snapshot()});
 assert.ok(rows.some(x=>x.includes('"status":"jump"')&&x.includes('"shiftSeconds":7200')));
});
