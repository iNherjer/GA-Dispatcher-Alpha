const { test } = require('node:test');
const assert = require('node:assert/strict');
const core = require('./map-route-edit-core');
const { create } = require('./map-navigation-client');
const points = [{lat:48,lng:0,name:'Start'}, {lat:49,lng:1,name:'Ziel'}];
const tick = () => new Promise(resolve => setImmediate(resolve));
test('shared editing chooses original shortest detour leg, protects anchors and preserves zero longitude', () => {
    const next = core.apply(points, {action:'insert',index:1,point:{lat:48.3,lng:0.3}});
    assert.equal(core.insertionIndex(next,{lat:48.2,lng:0.2},(a,b)=>Math.hypot(a.lat-b.lat,a.lng-b.lng)),1);
    assert.equal(next[0].lon,0);
    assert.throws(()=>core.apply(next,{action:'move',index:0,point:points[1]}),/endpoint_locked/);
    assert.throws(()=>core.apply(next,{action:'remove',index:2}),/endpoint_locked/);
    assert.throws(()=>core.apply(next,{action:'insert',index:1,point:{lat:NaN,lng:0}}),/point_invalid/);
    assert.deepEqual(core.apply(next,{action:'remove',index:1}),core.normalize(points));
    assert.equal(core.popup('<script>',1).includes('<script>'),false);
});
test('rapid insert/move/remove shows immediately and sends revisions in order', async () => {
    let server={id:'route',revision:0,points,editable:true}, replies=[], requests=[], visible;
    const client=create({request:(intent,payload,revision)=>new Promise(resolve=>{requests.push({payload,revision});replies.push(()=>{
        assert.equal(revision,server.revision);server={...server,points:core.apply(server.points,payload.edit),revision:revision+1};resolve({ok:true,navigation:server});
    });}),render:nav=>visible=nav,error:e=>{throw e;}});
    client.receive(server);
    client.edit({action:'insert',index:1,point:{lat:48.2,lng:0.2}});
    client.edit({action:'move',index:1,point:{lat:48.4,lng:0.4}});
    assert.equal(visible.points[1].lat,48.4);assert.equal(requests.length,1);
    replies.shift()();await tick();assert.equal(requests[1].revision,1);
    replies.shift()();await tick();assert.equal(client.snapshot().points[1].lat,48.4);
    client.edit({action:'remove',index:1});replies.shift()();await tick();assert.equal(visible.points.length,2);
});
test('foreign newer revision rejects queued edits and delayed old snapshots cannot roll back',async()=>{
    let resolve, errors=0,visible;
    const client=create({request:()=>new Promise(r=>resolve=r),render:n=>visible=n,error:()=>errors++});
    client.receive({id:'r',revision:1,points,editable:true});
    client.edit({action:'insert',index:1,point:{lat:48.2,lng:0.2}});
    client.edit({action:'remove',index:1});
    const foreign={id:'r',revision:3,points,editable:true};
    resolve({ok:false,error:'navigation_revision_conflict',navigation:foreign});await tick();
    assert.equal(errors,1);assert.equal(visible.revision,3);assert.equal(client.pending(),false);
    client.receive({...foreign,revision:2});assert.equal(visible.revision,3);
});
test('timeout restores confirmed route without replaying unknown commands',async()=>{
    let visible,refresh=0;
    const client=create({request:async()=>{throw Error('timeout');},render:n=>visible=n,error:()=>{},refresh:()=>refresh++});
    client.receive({id:'r',revision:1,points,editable:true});
    client.edit({action:'insert',index:1,point:{lat:48.2,lng:0.2}});assert.equal(visible.points.length,3);
    await tick();assert.equal(visible.points.length,2);assert.equal(refresh,1);
});

test('out-of-order polls during an edit preserve the newest revision and drop obsolete queued edits',async()=>{
    let reply, visible, errors=0, requests=0;
    const client=create({request:()=>{requests++;return new Promise(r=>reply=r);},render:n=>visible=n,error:()=>errors++});
    client.receive({id:'r',revision:1,points,editable:true});
    client.edit({action:'insert',index:1,point:{lat:48.2,lng:0.2}});
    client.edit({action:'remove',index:1});
    client.receive({id:'r',revision:5,points,editable:true});
    client.receive({id:'r',revision:3,points,editable:true});
    reply({ok:true,navigation:{id:'r',revision:2,points:core.apply(points,{action:'insert',index:1,point:{lat:48.2,lng:0.2}}),editable:true}});
    await tick();assert.equal(visible.revision,5);assert.equal(requests,1);assert.equal(errors,1);
});
test('failed ACK cannot discard a newer confirmed snapshot received during the request',async()=>{
    let reply, visible;
    const client=create({request:()=>new Promise(r=>reply=r),render:n=>visible=n,error:()=>{}});
    client.receive({id:'r',revision:1,points,editable:true});
    client.edit({action:'insert',index:1,point:{lat:48.2,lng:0.2}});
    client.receive({id:'r',revision:5,points,editable:false});
    reply({ok:false,error:'conflict',navigation:{id:'r',revision:4,points,editable:true}});
    await tick();assert.equal(visible.revision,5);assert.equal(visible.editable,false);assert.equal(client.pending(),false);
});
