'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events');
const {createCameraTelemetry}=require('./tracker-camera-telemetry');
function fixture(){let at=10000;const handle=new EventEmitter(),calls=[],logs=[];
 handle.addToDataDefinition=(...args)=>{calls.push(args);return 100;};handle.requestDataOnSimObject=(...args)=>{calls.push(args);return 101;};
 const camera=createCameraTelemetry({handle,definitionId:211,requestId:211,int32Type:1,period:2,now:()=>at,log:s=>logs.push(s)});
 const receive=(value,patch={})=>handle.emit('simObjectData',{requestID:211,defineID:211,defineCount:1,objectID:0,data:{remaining:()=>4,readInt32:()=>value},...patch});
 return{handle,calls,logs,camera,receive,advance:ms=>at+=ms};}
test('camera request is an isolated one-field INT32 enum and expires without fresh samples',()=>{
 const f=fixture();assert.deepEqual(f.calls,[ [211,'CAMERA STATE','Enum',1], [211,211,0,2,0,0,3,0] ]);
 assert.equal(f.camera.snapshot(),null);f.receive(2);assert.equal(f.camera.snapshot(),2);f.advance(2501);assert.equal(f.camera.snapshot(),null);
 f.receive(10);assert.equal(f.camera.snapshot(),10);f.camera.dispose();f.receive(2);assert.equal(f.camera.snapshot(),null);assert.equal(f.handle.listenerCount('simObjectData'),0);
});
test('malformed, unrelated, shifted packets and SimConnect exceptions cannot manufacture a cockpit',()=>{
 const f=fixture();f.receive(2);f.receive(27,{requestID:777});assert.equal(f.camera.snapshot(),2);
 for(const patch of [{defineID:777},{defineCount:2},{objectID:-1},{entryNumber:2},{data:{remaining:()=>8,readInt32:()=>2}}]){
   f.receive(2,patch);assert.equal(f.camera.snapshot(),null);f.receive(2);
 }
 f.handle.emit('exception',{sendId:100,exceptionName:'NAME_UNRECOGNIZED'});assert.equal(f.camera.snapshot(),null);
 f.receive(2000);assert.equal(f.camera.snapshot(),null);const n=f.logs.length;f.receive(2000);assert.equal(f.logs.length,n);
 assert.match(f.logs.at(-1),/"rawValue":2000/);
});
test('concrete user aircraft IDs are accepted; an invalid transition cannot retain cockpit readiness',()=>{
 const f=fixture();f.receive(2,{objectID:540672,entryNumber:1,outOf:1});assert.equal(f.camera.snapshot(),2);
 f.receive(-1,{objectID:540672});assert.equal(f.camera.snapshot(),null);
 assert.match(f.logs.at(-1),/"objectId":540672/);
 f.receive(2,{objectID:540672});assert.equal(f.camera.snapshot(),2);
});
test('camera changes are logged once per change with a readable name',()=>{
 const f=fixture();f.receive(12);f.receive(12);f.receive(11);f.receive(2);f.receive(2);f.receive(27);
 assert.deepEqual(f.logs.filter(line=>line.startsWith('SIM_CAMERA_STATE')),[
  'SIM_CAMERA_STATE from=none to=12=world_map','SIM_CAMERA_STATE from=12=world_map to=11=waiting',
  'SIM_CAMERA_STATE from=11=waiting to=2=cockpit','SIM_CAMERA_STATE from=2=cockpit to=27=unknown']);
});
