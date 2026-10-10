import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {extractOriginalFunction} from './extract-original-function.mjs';
const source=fs.readFileSync(new URL('../mission-followup.js',import.meta.url),'utf8').replace(/^    /gm,'');
test('successful preview and failed generation release the offer lock without accepting it',async()=>{
 const req={id:'offer',status:'pending',poiFollowUp:true,route:{homeRef:{icao:'EDTW'},targetRef:{kind:'poi'}}};
 let generations=0,finish;
 const env={acceptingIds:new Set(),getRequests:()=>[req],getStatus:r=>r.status,duePendingRequests:()=>[req],airportFromRef:r=>r,normalizeRef:r=>r,promptAcceptanceStartRef:async()=>({icao:'EDTW'}),buildAcceptance:()=>({startRef:{icao:'EDTW'},targetRef:{kind:'poi'},dispatchProfileId:'inspection_infra'}),acceptanceDestRef:a=>a.targetRef,pickerValueForProfile:()=> 'inspection_infra',document:{getElementById:()=>null},render:()=>{},localStorage:{},alert:msg=>{throw Error(msg);},window:{generateMission:()=>{generations++;return new Promise(resolve=>{finish=resolve;});}}};
 vm.createContext(env);vm.runInContext(source.slice(source.indexOf('async function acceptRequest('),source.indexOf('function markAccepted(')),env);
 const first=env.acceptRequest('offer');await new Promise(resolve=>setImmediate(resolve));
 assert.equal(env.acceptingIds.has('offer'),true);
 assert.equal(await env.acceptRequest('offer'),false,'duplicate click while generating is blocked');
 finish(true);assert.equal(await first,true);assert.equal(req.status,'pending');assert.equal(env.acceptingIds.size,0);
 // Discarding the preview makes no change to this pending offer; another click works.
 const second=env.acceptRequest('offer');await new Promise(resolve=>setImmediate(resolve));finish(false);assert.equal(await second,false);assert.equal(generations,2);assert.equal(env.acceptingIds.size,0);
 env.window.generateMission=async()=>{throw Error('provider failure');};
 await assert.rejects(env.acceptRequest('offer'),/provider failure/);assert.equal(env.acceptingIds.size,0);assert.equal(req.status,'pending');
});
test('availability refresh reaches due time, reschedules expiry and handles sleep without cloud calls',()=>{
 let now=1000,timer,cleared=0,renders=0;
 const req={status:'pending',eligibleAt:121000,expiresAt:181000};
 const env={availabilityTimer:null,environment:{setTimeout:(callback,delay)=>{timer={callback,delay};return 1;},clearTimeout:()=>{cleared++;}},nowMs:()=>now,getRequests:()=>[req],getStatus:r=>r.status,writeRequests:(_,opts)=>{assert.equal(opts.cloud,false);renders++;env.scheduleAvailabilityRefresh();}};
 vm.createContext(env);vm.runInContext(extractOriginalFunction(source,'scheduleAvailabilityRefresh'),env);
 env.scheduleAvailabilityRefresh();assert.equal(timer.delay,60000);
 now=61000;timer.callback();assert.equal(timer.delay,60000);
 now=121000;timer.callback();assert.equal(renders,2);assert.equal(timer.delay,60000);
 now=181001;timer.callback();assert.equal(env.availabilityTimer,null);
 now=1000;env.scheduleAvailabilityRefresh();env.scheduleAvailabilityRefresh();assert.equal(cleared,1,'only one refresh timer remains');
 now=200000;timer.callback();assert.equal(env.availabilityTimer,null,'wake after expiry leaves no stale timer');
 env.environment.headless=true;timer=null;env.scheduleAvailabilityRefresh();assert.equal(timer,null,'tracker schedules no UI work');
});
