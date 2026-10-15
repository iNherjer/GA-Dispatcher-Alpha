'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {normalizeMediaCommand,createMediaRelay,mediaStateChanged}=require('./tracker-media-core');
test('media operations validate numeric volume and never accept executable instructions',()=>{
 for(const action of ['exec','shell','download'])assert.throws(()=>normalizeMediaCommand({action}));
 for(const volume of [-1,2,Infinity,'0.5'])assert.throws(()=>normalizeMediaCommand({action:'volume',volume}));
 assert.deepEqual(normalizeMediaCommand({action:'pause',shell:'injected'}),{action:'pause'});
});
test('duplicate relay deliveries execute transport controls once and reject conflicting IDs',async()=>{
 let calls=0;const execute=createMediaRelay(async payload=>{calls++;return {ok:true,action:payload.action};});
 const command={clientId:'web-1',commandId:'cmd-1',payload:{action:'next'}};
 const results=await Promise.all([execute(command),execute(command)]);
 assert.equal(calls,1);assert.ok(results.every(r=>r.ok));
 assert.equal((await execute({...command,payload:{action:'previous'}})).error,'command_id_conflict');
 assert.equal((await execute({...command,clientId:''})).error,'media_command_invalid');
});
test('predicted time does not create a state update every second; changes and seeks do',()=>{
 const base={ok:true,playing:true,title:'Track',positionSeconds:20,sampledAt:1000,volume:0.5};
 for(let second=1;second<15;second++)assert.equal(mediaStateChanged(base,{...base,positionSeconds:20+second,sampledAt:1000+second*1000},1000,1000+second*1000),false);
 assert.equal(mediaStateChanged(base,{...base,positionSeconds:35},1000,16000),true);
 assert.equal(mediaStateChanged(base,{...base,title:'New track'},1000,2000),true);
 assert.equal(mediaStateChanged(base,{...base,positionSeconds:90},1000,2000),true);
 assert.equal(mediaStateChanged(base,{...base,playing:false},1000,2000),true);
 const reordered={volume:0.5,sampledAt:2000,positionSeconds:21,title:'Track',playing:true,ok:true};
 assert.equal(mediaStateChanged(base,reordered,1000,2000),false);
});
test('unavailable playback time and paused playback need no periodic full update',()=>{
 for(const playing of [true,false]){
  const base={ok:true,playing,title:'Track',positionSeconds:null};
  assert.equal(mediaStateChanged(base,{...base},1000,16000),false);
 }
});
test('position becoming available or disappearing publishes immediately, without a duration',()=>{
 const base={ok:true,playing:false,positionSeconds:null,durationSeconds:null};
 assert.equal(mediaStateChanged(base,{...base,positionSeconds:0},1000,1001),true);
 assert.equal(mediaStateChanged({...base,positionSeconds:0},base,1000,1001),true);
});
