'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createMediaServer}=require('../lib/media-server');
const {createMediaBridge}=require('../../tracker-media-bridge');
test('private media bridge rejects missing auth and forwards valid runtime requests',async t=>{
 const calls=[];
 const server=createMediaServer({request:async payload=>{calls.push(payload);return {ok:true,title:'Track',playing:false,players:[]};}});
 const endpoint=await server.start();t.after(()=>server.close());
 const response=await fetch(`http://127.0.0.1:${endpoint.port}/media`,{method:'POST',body:'{}'});
 assert.equal(response.status,403);assert.equal(calls.length,0);
 const bridge=createMediaBridge({VFR_MULTITOOL_MEDIA_PORT:endpoint.port,VFR_MULTITOOL_MEDIA_TOKEN:endpoint.token});
 assert.equal(bridge.available,true);
 const result=await bridge.request({action:'snapshot',clientId:'web-1'});
 assert.equal(result.ok,true);assert.equal(result.title,'Track');assert.equal(result.revision,1);
 const watched=await bridge.request({action:'watch',after:0,clientId:'web-1'});
 assert.equal(watched.revision,1);assert.equal(calls.length,1,'cached revision returns without duplicate native polling');
 assert.equal((await bridge.request({action:'shell',clientId:'web-1'})).ok,false);
 assert.equal((await bridge.request({action:'next',clientId:'bad client'})).ok,false);
 assert.equal(calls.length,1);
});
test('unconfigured media bridge reports unavailable without network access',async()=>{
 const bridge=createMediaBridge({});assert.equal(bridge.available,false);
 assert.equal((await bridge.request({action:'next'})).error,'media_desktop_unavailable');
});
