'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { createStartReadinessSource, FIELDS } = require('./tracker-start-readiness-source');
const { createMissionStartReadiness } = require('./tracker-mission-start-readiness');

async function fixture() {
  let at = 10000, send = 0;
  const handles = [], calls = [], samples = [], retries = new Map();
  const gate = createMissionStartReadiness({now:()=>at});
  const open = async () => {
    const handle = new EventEmitter(); handle.close = () => {handle.closed=true;handle.emit('close');};
    for (const method of ['addToDataDefinition','requestSystemState','subscribeToSystemEvent','requestDataOnSimObject'])
      handle[method] = (...args) => {calls.push([method,...args]);return ++send;};
    handles.push(handle);return {handle};
  };
  const source = createStartReadinessSource({open,float64Type:4,secondPeriod:4,now:()=>at,
    onSample:s=>{samples.push(s);gate.observe(s);},
    schedule:fn=>{const id={};retries.set(id,fn);return id;},cancel:id=>retries.delete(id)});
  await new Promise(resolve=>setImmediate(resolve));
  const frame = (values=[2,0,48.1,8.2,600,1,0], patch={}, handle=handles.at(-1)) => {
    if (values.length === 7) values = [...values, 123];
    let n=0;handle.emit('simObjectData',{requestID:1,defineID:1,objectID:540672,defineCount:FIELDS.length,entryNumber:1,outOf:1,
      data:{remaining:()=>FIELDS.length*8,readFloat64:()=>values[n++]},...patch});
  };
  const event = (clientEventId,data,handle=handles.at(-1)) => handle.emit('event',{clientEventId,data});
  const running = () => {handles.at(-1).emit('systemState',{requestID:2,dataInteger:1});event(3,0);};
  return {source,gate,handles,calls,samples,retries,frame,event,running,advance:ms=>at+=ms};
}
test('one coherent required packet proves readiness without a GPS/relay stream',async()=>{
  const f=await fixture();
  assert.equal(f.calls.filter(c=>c[0]==='addToDataDefinition').length,FIELDS.length);
  assert.deepEqual(f.calls.at(-1),['requestDataOnSimObject',1,1,0,4,0,0,0,0]);
  f.frame();assert.equal(f.gate.snapshot().ready,false,'missing Sim/Pause evidence cannot authorize start');
  f.running();f.frame();for(let n=0;n<3;n++){f.advance(1000);f.frame();}
  assert.equal(f.gate.snapshot().ready,true);assert.deepEqual(f.source.position(),{lat:48.1,lon:8.2,alt:600,hdg:123});
  f.source.stop();assert.equal(f.gate.snapshot().ready,false);assert.equal(f.source.position(),null);
});
test('pause, menu, airborne, movement and bad packets revoke the permission',async()=>{
  const f=await fixture();f.running();
  const ready=()=>{for(let n=0;n<4;n++){f.advance(1000);f.frame();}assert.equal(f.gate.snapshot().ready,true);};
  ready();f.event(3,1);assert.equal(f.gate.snapshot().ready,false);assert.equal(f.source.position(),null);f.event(3,0);
  for(const values of [[12,0,48.1,8.2,600,1,0],[2,1,48.1,8.2,600,1,0],[2,0,48.1,8.2,600,0,0],
    [2,0,48.1,8.2,600,1,2],[2,0,0,0,600,1,0],[35,0,48.1,8.2,600,1,0]]){
    ready();f.advance(1000);f.frame(values);assert.equal(f.gate.snapshot().ready,false);
  }
  for(const patch of [{defineID:2},{objectID:-1},{defineCount:6},{entryNumber:2},{data:{remaining:()=>48}}]){
    ready();f.frame(undefined,patch);assert.equal(f.gate.snapshot().ready,false);assert.equal(f.source.position(),null);
  }
  ready();f.event(5,0);assert.equal(f.gate.snapshot().ready,false);f.source.stop();
});
test('system events never renew old position evidence; reconnect and retired handles start untrusted',async()=>{
  const f=await fixture();f.running();for(let n=0;n<4;n++){f.advance(1000);f.frame();}
  assert.equal(f.gate.snapshot().ready,true);f.advance(6100);f.event(3,0);
  assert.equal(f.gate.snapshot().ready,false);assert.equal(f.source.position(),null);
  const old=f.handles[0];old.emit('close');assert.equal(f.retries.size,1);
  const reconnect=[...f.retries.values()][0];f.retries.clear();reconnect();await new Promise(resolve=>setImmediate(resolve));
  f.frame();assert.equal(f.gate.snapshot().ready,false,'new connection needs its own system state');
  f.running();for(let n=0;n<4;n++){f.advance(1000);f.frame();}
  assert.equal(f.gate.snapshot().ready,true);f.event(5,0,old);f.frame([12,1,0,0,600,1,0],{},old);
  assert.equal(f.gate.snapshot().ready,true);f.source.stop();assert.equal(f.retries.size,0);
});

test('stop during connection setup retires the late handle without subscribing or publishing',async()=>{
 let resolveOpen;const calls=[],samples=[],handle=new EventEmitter();handle.close=()=>calls.push('close');
 const source=createStartReadinessSource({open:()=>new Promise(resolve=>resolveOpen=resolve),float64Type:4,secondPeriod:4,
   onSample:s=>samples.push(s)});
 source.stop();resolveOpen({handle});await new Promise(resolve=>setImmediate(resolve));
 assert.deepEqual(calls,['close']);assert.deepEqual(samples,[null]);assert.equal(source.position(),null);
});
