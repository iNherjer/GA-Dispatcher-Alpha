'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { createSlewTelemetry } = require('./tracker-slew-telemetry.js');

function harness() {
  const handle = new EventEmitter(), calls = [], logs = [];
  handle.addToDataDefinition = (...args) => { calls.push(['define', ...args]); return 100; };
  handle.requestDataOnSimObject = (...args) => { calls.push(['request', ...args]); return 101; };
  let at=10000;
  const reader=createSlewTelemetry({handle,definitionId:209,requestId:209,int32Type:1,period:2,
    now:()=>at,log:line=>logs.push(JSON.parse(line.slice(line.indexOf(' data=')+6)))});
  const receive=(value,patch={})=>handle.emit('simObjectData',{requestID:209,defineID:209,objectID:0,defineCount:1,
    data:{remaining:()=>4,readInt32:()=>value},...patch});
  return {handle,calls,logs,reader,receive,advance:dt=>at+=dt};
}

test('independent request explicitly reads one Bool as INT32 for the user aircraft',()=>{
  const h=harness();
  assert.deepEqual(h.calls,[['define',209,'IS SLEW ACTIVE','Bool',1],['request',209,209,0,2,0,0,3,0]]);
  assert.equal(h.reader.snapshot().active,null);
  h.receive(0);assert.equal(h.reader.snapshot().active,false);
  h.receive(1);assert.equal(h.reader.snapshot().active,true);
  h.receive(0);assert.equal(h.reader.snapshot().active,false);
});

test('shifted bulk weight cannot set Slew and produces a bounded mismatch diagnostic',()=>{
  const h=harness();h.receive(0);
  const sample=h.reader.diagnose(2000);
  assert.equal(sample.active,false);
  assert.equal(h.logs.at(-1).mismatch,true);
  assert.equal(h.logs.at(-1).raw,0);
  assert.equal(h.logs.at(-1).bulkRaw,2000);
  const count=h.logs.length;h.advance(500);h.receive(0);h.reader.diagnose(2010);
  assert.equal(h.logs.length,count);
  h.advance(30000);h.receive(0);h.reader.diagnose(2000);
  assert.equal(h.logs.length,count+1);
});

test('unrelated requests are ignored; malformed identity, packet length and read failures stay unknown',()=>{
  const h=harness();h.receive(0);
  h.receive(2000,{requestID:206});assert.equal(h.reader.snapshot().active,false);
  for(const patch of [{defineID:206},{objectID:88},{defineCount:2},
    {data:{remaining:()=>8,readInt32:()=>2000}},
    {data:{remaining:()=>4,readInt32:()=>{throw Error('short read');}}}]){
    h.receive(1,patch);assert.equal(h.reader.snapshot().status,'error');
    assert.equal(h.reader.snapshot().active,null);
    h.receive(0);assert.equal(h.reader.snapshot().active,false);
  }
});

test('server errors are correlated by send ID; stale and disconnect states never invent an off value',()=>{
  const h=harness();h.receive(1);
  h.handle.emit('exception',{sendId:500,exceptionName:'NAME_UNRECOGNIZED'});
  assert.equal(h.reader.snapshot().active,true);
  h.handle.emit('exception',{sendId:100,exceptionName:'NAME_UNRECOGNIZED'});
  assert.equal(h.reader.snapshot().active,null);
  assert.match(h.reader.snapshot().error,/definition:NAME_UNRECOGNIZED/);
  h.receive(0);h.advance(2501);assert.equal(h.reader.snapshot().status,'stale');
  assert.equal(h.reader.snapshot().active,null);
  h.reader.dispose();h.receive(0);
  assert.equal(h.reader.snapshot().status,'disconnected');
  assert.equal(h.reader.snapshot().active,null);
  assert.equal(h.handle.listenerCount('simObjectData'),0);
  assert.equal(harness().reader.snapshot().status,'waiting','reconnect starts without cached Slew state');
});

test('tracker mission observation is wired to the independent source without a bulk fallback',()=>{
  const fs=require('node:fs'),path=require('node:path');
  const source=fs.readFileSync(path.join(__dirname,'tracker.js'),'utf8');
  assert.match(source,/slewActive: slew\.active,\s+slewTelemetryStatus: slew\.status/);
  assert.doesNotMatch(source,/slewActive: Number\.isFinite\(raw\.slewActive\)/);
});


test('repeated invalid packets do not alternate missing/bulk comparison logs',()=>{
  const h=harness();h.receive(0);h.reader.diagnose(2000);
  const malformed={data:{remaining:()=>8,readInt32:()=>2000}};
  h.receive(1,malformed);h.reader.diagnose(2000);
  const count=h.logs.length;
  for(let i=0;i<20;i++){h.advance(100);h.receive(1,malformed);h.reader.diagnose(2000);}
  assert.equal(h.logs.length,count);
});
