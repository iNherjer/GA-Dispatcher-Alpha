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
test('due charter offer without stay retrospective gets exactly one background attempt from the App',async()=>{
 const {createRequire}=await import('node:module');const require=createRequire(import.meta.url);
 const core=require('../mission-charter-continuation-core.js');
 const A={icao:'EDTW',name:'Winzeln',lat:48.27,lon:8.42},B={icao:'EDTE',name:'Eutingen',lat:48.48,lon:8.77},now=Date.now();
 const idea={schema:'charter-idea.v1',reason:'Eine Gruppe reist zum persönlichen Austausch.',background:'Der gemeinsame Aufenthalt bietet Zeit für die geplante Zusammenarbeit.',arrival:'Die Gruppe setzt ihre Reise nach der Ankunft zusammen fort.',passengerCount:1,groupLabel:'Gast',passenger:{name:'Ada',role:'Auftraggeberin',gender:'female',personality:'Offen'},luggageLabel:'Tasche',luggageWeightLbs:10,memory:'Eine Reise mit Gesprächen.',geoAnchors:[],narrativeEvents:[],route:{start:A,target:B},returnPlan:{offered:true,reason:'Rückreise gebucht.',stayHours:0,stayText:'Kurzer Aufenthalt'}};
 const md={missionId:'c1',mission:'Reise',charterIdea:idea,passenger:idea.passenger,departureAirport:A,destinationAirport:B};
 let req=core.request(md,{missionId:'c1',completionId:'d',endedAt:now-1000,result:'completed',privateOutingEvidence:{flown:true,atTarget:true,groundStill:true}},now);
 const draft={experience:'Ada hat den Aufenthalt genutzt und viele gute Gespräche geführt.',reason:'Nach dem Aufenthalt möchte Ada wieder nach Hause zurückkehren.',nextStep:'Zu Hause wird sie die Ergebnisse in Ruhe ordnen und weitergeben.',memory:'Die Gespräche des Aufenthalts bleiben ihr besonders in Erinnerung.',narrativeEvents:[],offerText:'Ada hat in Eutingen viel geredet und gelacht und bittet nun um den Rückflug nach Winzeln.'};
 let calls=0,renders=0,saves=[];
 const env={console:{info(){},warn(){}},localStorage:{getItem:()=>null},environment:{},getStatus:r=>r.status,nowMs:()=>now,render:()=>{renders++;},
  saveMutated:(fn,opts)=>{req=fn([req])[0];saves.push(opts);},
  saveCharterExperience:(id,d)=>{req={...req,charterContinuation:{...req.charterContinuation,experience:d}};return req.charterContinuation;},
  window:{MissionCharterContinuationCore:core,getSelectedAiApiKey:()=>'key',fetchGeminiJsonWithFallback:async()=>{calls++;return {parsed:draft};}}};
 vm.createContext(env);vm.runInContext(source.slice(source.indexOf('const charterRecapTried'),source.indexOf('function getProfileId(')),env);
 assert.equal(env.maybeWriteCharterRecap(req),true);
 assert.ok(req.recapAttemptedAt,'attempt is stored on the request');assert.equal(saves[0].cloud,true);
 assert.equal(env.maybeWriteCharterRecap(req),false,'never twice');
 await new Promise(resolve=>setImmediate(resolve));await new Promise(resolve=>setImmediate(resolve));
 assert.equal(calls,1);assert.equal(renders,1);
 assert.equal(core.offerPreview(core.context(req)),draft.offerText);
 // Another device/session: stored attempt or existing stay prevent a new call.
 const fresh={...env};vm.createContext(fresh);vm.runInContext(source.slice(source.indexOf('const charterRecapTried'),source.indexOf('function getProfileId(')),fresh);
 assert.equal(fresh.maybeWriteCharterRecap({...req,charterContinuation:{...req.charterContinuation,experience:null}}),false);
 fresh.localStorage={getItem:()=>'false'};
 assert.equal(fresh.maybeWriteCharterRecap({...req,id:'x',recapAttemptedAt:null,charterContinuation:{...req.charterContinuation,experience:null}}),false,'AI switched off');
});
