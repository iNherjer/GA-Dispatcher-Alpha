import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {extractOriginalFunction} from './extract-original-function.mjs';
const require=createRequire(import.meta.url),source=fs.readFileSync('app.js','utf8');
const sar=require('../mission-sar-scene-core.js');
function ai(fetch,models=[['primary','Primary','flash'],['fallback','Fallback','flash']]){
 const env=vm.createContext({fetch,AbortController,window:{},normalizeAiProvider:x=>x,getSelectedAiProvider:()=> 'gemini',getSelectedAiApiKey:()=> 'test-key',getSelectedAiModelProfile:()=> 'auto',getAiTextModelCandidatesForPrompt:()=>models,incrementApiUsage:()=>{},_missionParseJsonTextDetailed:text=>{try{return {parsed:JSON.parse(text)}}catch{return {parsed:null}}},setTimeout:(fn,ms)=>ms===750?setTimeout(fn,0):setTimeout(fn,ms),clearTimeout});
 vm.runInContext(extractOriginalFunction(source,'geminiQuotaDetails'),env);
 vm.runInContext(source.slice(source.indexOf('async function fetchAiJsonWithFallback'),source.indexOf('window.fetchAiJsonWithFallback')),env);
 vm.runInContext(extractOriginalFunction(source,'formatAiJsonFailure'),env);vm.runInContext(extractOriginalFunction(source,'createAiJsonFailure'),env);return env;
}
const response=(status,body)=>({ok:status===200,status,json:async()=>body,headers:{get:()=>null},text:async()=>JSON.stringify(body)});
const success={candidates:[{content:{parts:[{text:'internal reasoning',thought:true},{text:'{"ideas":'},{text:'[]}' }]}}]};
test('transient Gemini overload retries same model once and joins non-thinking output',async()=>{
 const calls=[],env=ai(async url=>{calls.push(url);return calls.length===1?response(503,{error:{status:'UNAVAILABLE'}}):response(200,success)});
 const result=await env.fetchAiJsonWithFallback('prompt',{apiKey:'test-key'});assert.equal(result.parsed.ideas.length,0);assert.equal(calls.length,2);assert.equal(calls[0],calls[1]);assert.equal(result.attempts[0].apiStatus,'UNAVAILABLE');
});
test('retry is bounded then uses available fallback; 404 is never retried',async()=>{
 const calls=[],env=ai(async url=>{calls.push(url);return response(calls.length<3?503:200,calls.length<3?{}:success)});
 assert.ok((await env.fetchAiJsonWithFallback('prompt')).parsed);assert.equal(calls.length,3);assert.match(calls[2],/fallback/);
 let n=0;const notFound=ai(async()=>response(++n===1?404:200,n===1?{}:success));assert.ok((await notFound.fetchAiJsonWithFallback('prompt')).parsed);assert.equal(n,2);
});
test('quota survives later model failures; auth stops immediately; no fabricated empty JSON on missing text',async()=>{
 let n=0;const env=ai(async()=>response(++n===1?429:404,{error:{status:'RESOURCE_EXHAUSTED'}}));const result=await env.fetchAiJsonWithFallback('prompt');assert.equal(n,2);assert.match(env.formatAiJsonFailure(result),/Tokenlimit.*429/);
 n=0;const auth=ai(async()=>{n++;return response(403,{})});await auth.fetchAiJsonWithFallback('prompt');assert.equal(n,1);
 const empty=ai(async()=>response(200,{candidates:[]}));assert.equal((await empty.fetchAiJsonWithFallback('prompt')).parsed,null);
});
test('error messages distinguish overload, unavailable model, timeout and missing key',()=>{
 const env=ai(()=>{});for(const [status,pattern] of [['http_503',/vorübergehend/],['http_404',/Modelle/],['timeout',/Zeitlimit/]])assert.match(env.formatAiJsonFailure({attempts:[{status}]}),pattern);
 assert.match(env.formatAiJsonFailure({error:'missing_api_key'}),/API-Key fehlt/);
});
test('current shared Gemini profiles have available modern fallbacks without duplicate model ids',()=>{
 const env=vm.createContext({});vm.runInContext(source.slice(source.indexOf('const AI_TEXT_MODEL_PROFILES'),source.indexOf('const AI_COST_ESTIMATE_COPY'))+'\nglobalThis.profiles=AI_TEXT_MODEL_PROFILES;',env);
 for(const rows of Object.values(env.profiles.gemini)){assert.equal(new Set(rows.map(r=>r[0])).size,rows.length);assert.ok(rows.some(r=>r[0]==='gemini-3.5-flash'));assert.ok(rows.every(r=>!r[0].startsWith('gemini-2.5')));}
});
const target={name:'Suchraum',lat:48.01369,lon:10.02912};
const coords=[[-.03,-.03],[-.03,.03],[.03,.03],[.03,-.03]].map(([lat,lon],i)=>({type:'node',id:i+1,lat:target.lat+lat,lon:target.lon+lon}));
const osmPayload={elements:[...coords,{type:'way',id:1,nodes:[1,2,3,4,1],tags:{landuse:'meadow'}}]};
function browser(fetch,extra={}){
 const w={MissionSarSceneCore:sar,MissionPoiBriefingSharedCore:{point:x=>x},...extra.window};const env={window:w,fetch,AbortSignal,console,...extra};env.window=w;
 vm.runInNewContext(fs.readFileSync('mission-sar-briefing-browser.js','utf8'),env);return w.MissionSarBriefingBrowser;
}
test('OSM node/member references preserve full polygons and reject incomplete water/building exclusions',()=>{
 const raw=sar.osmGeometry(osmPayload);assert.equal(raw.elements.at(-1).geometry.length,5);assert.ok(sar.geometry(raw,target).sarCandidates.length);
 assert.throws(()=>sar.osmGeometry({elements:[...osmPayload.elements,{type:'way',id:2,nodes:[1,999],tags:{building:'yes'}}]}),/incomplete/);
 assert.throws(()=>sar.osmGeometry({elements:[...osmPayload.elements,{type:'relation',id:3,tags:{natural:'water'},members:[{type:'way',ref:999,role:'outer'}]}]}),/incomplete/);
 const relation=sar.osmGeometry({elements:[...osmPayload.elements,{type:'relation',id:3,tags:{landuse:'meadow'},members:[{type:'way',ref:1,role:'outer'}]}]});assert.equal(relation.elements.at(-1).members[0].geometry.length,5);
 assert.throws(()=>sar.osmGeometry({remark:'runtime error',elements:[]}),/invalid/);
});
test('both Overpass failures recover through bounded-area OSM, inflight joins and success cache',async()=>{
 const calls=[],api=browser(async url=>{calls.push(url);return url.includes('map.json')?response(200,osmPayload):response(504,{})});
 const [a,b]=await Promise.all([api.geometry(target),api.geometry(target)]);assert.equal(a,b);assert.match(a.source,/openstreetmap/);assert.ok(a.sarCandidates.length);assert.equal(calls.length,3);
 const bbox=calls[2].split('bbox=')[1].split(',').map(Number);assert.ok((bbox[3]-bbox[1])*111320>2399);assert.equal(a.radiusM,1200);
 await api.geometry(target);assert.equal(calls.length,3);
 await api.geometry({...target,lat:target.lat+.001});assert.equal(calls.length,4); // failed providers paused
});
test('network failure, unsuitable terrain and incomplete OSM geometry produce distinct safe failures',async()=>{
 const unavailable=browser(async()=>response(504,{}));await assert.rejects(()=>unavailable.geometry(target),/nicht vollständig abrufbar/);
 const unsuitable=browser(async()=>response(200,{elements:[]}));await assert.rejects(()=>unsuitable.geometry(target),/geeignete geprüfte/);
 const partial=browser(async url=>url.includes('map.json')?response(200,{elements:[...osmPayload.elements,{type:'way',id:2,nodes:[999,1],tags:{natural:'water'}}]}):response(504,{}));await assert.rejects(()=>partial.geometry(target),/nicht vollständig abrufbar/);
 const remarked=browser(async()=>response(200,{remark:'partial query result',elements:sar.osmGeometry(osmPayload).elements}));await assert.rejects(()=>remarked.geometry(target),/nicht vollständig abrufbar/);
});
test('a failed SAR candidate cannot discard a valid offer or shift target/context associations',async()=>{
 const candidates=[{...target,name:'Failed',id:'failed'},{...target,name:'Valid',id:'valid'}];let seen=[];
 const api=browser(async()=>response(200,osmPayload),{window:{MissionSarBriefingCore:{history:()=>[],ideaPrompt:contexts=>{seen=contexts;return 'prompt'},validateIdea:idea=>idea},MissionPoiBriefingSharedBrowser:{context:async p=>{if(p.id==='failed')throw Error('unavailable');return {id:p.id,target:p,targetFacts:[],environmentFacts:[]}},enrichSelected:async c=>c}},getMissionAircraftCapabilitySnapshot:()=>({passengerCapacity:1}),localStorage:{},fetchGeminiJsonWithFallback:async()=>({parsed:{ideas:[{targetId:'valid',person:{role:'Beobachter'},searchFocus:'Suche',alarm:'Alarm'}]}}),getSelectedAiApiKey:()=> 'test',normalizeMissionProposalChoice:x=>x,missionProposalCompactTarget:x=>x,missionProposalFormatRoute:()=>({label:'route'})});
 const offers=await api.choices(candidates,{start:target});assert.equal(offers.length,1);assert.equal(offers[0].target.id,'valid');assert.equal(offers[0].sarProposal.context.id,'valid');assert.equal(seen.length,1);
});
test('OSM parent area relations load complete members; non-area river relations do not require distant river segments',async()=>{
 const partial={elements:[...osmPayload.elements,{type:'relation',id:2,tags:{type:'multipolygon',landuse:'meadow'},members:[{type:'way',ref:2,role:'outer'}]},{type:'relation',id:3,tags:{type:'waterway',waterway:'river'},members:[{type:'way',ref:999,role:''}]}]};
 const complete={elements:[...coords.map(n=>({...n,id:n.id+10})),{type:'way',id:2,nodes:[11,12,13,14,11],tags:{}},partial.elements.at(-2)]};
 assert.deepEqual(sar.missingOsmRelations(partial),[2]);const calls=[];
 const api=browser(async url=>{calls.push(url);return url.includes('/relation/')?response(200,complete):url.includes('map.json')?response(200,partial):response(504,{})});
 const geo=await api.geometry(target);assert.equal(geo.status,'mapped');assert.ok(geo.sarCandidates.length);assert.equal(calls.filter(u=>u.includes('/relation/')).length,1);
 const rejected=browser(async url=>url.includes('/relation/')?response(504,{}):url.includes('map.json')?response(200,partial):response(504,{}));await assert.rejects(()=>rejected.geometry(target),/nicht vollständig abrufbar/);
});
test('confirmed daily token quota survives later 404 and tells the pilot to return tomorrow or upgrade API plan',async()=>{
 const details=[{'@type':'type.googleapis.com/google.rpc.QuotaFailure',violations:[{quotaId:'GenerateContentInputTokensPerModelPerDay-FreeTier'}]}];
 let calls=0;const env=ai(async()=>response(++calls===1?429:404,{error:{status:'RESOURCE_EXHAUSTED',details}}));
 const result=await env.fetchAiJsonWithFallback('prompt');assert.equal(result.attempts[0].quotaPeriod,'day');assert.equal(result.attempts[0].quotaKind,'tokens');
 assert.match(env.formatAiJsonFailure(result),/Tokenlimit für heute.*morgen.*bezahlten API-Plan/);assert.equal(calls,2);
});
test('daily request quota and minute quota have accurate, distinct instructions',async()=>{
 for(const [quotaId,expected,excluded] of [['GenerateRequestsPerDayPerProjectPerModel-FreeTier',/tägliches Limit für KI-Anfragen.*morgen.*bezahlten API-Plan/,/Tokenlimit für heute/],['GenerateContentInputTokensPerModelPerMinute-FreeTier',/kurzfristige.*warte kurz/,/morgen|für heute/]]){
  const env=ai(async()=>response(429,{error:{status:'RESOURCE_EXHAUSTED',details:[{violations:[{quotaId}]}]}}));const result=await env.fetchAiJsonWithFallback('prompt');const message=env.formatAiJsonFailure(result);assert.match(message,expected);assert.doesNotMatch(message,excluded);
 }
 const env=ai(()=>{});assert.match(env.formatAiJsonFailure({attempts:[{status:'http_429'}]}),/Bei ausgeschöpfter Tagesquote/);
});
test('a usable fallback prevents a false daily-quota failure notice',async()=>{
 let calls=0;const env=ai(async()=>response(++calls===1?429:200,calls===1?{error:{details:[{violations:[{quotaId:'GenerateContentInputTokensPerModelPerDay-FreeTier'}]}]}}:success));
 const result=await env.fetchAiJsonWithFallback('prompt');assert.ok(result.parsed);assert.equal(result.model,'fallback');
});
for(const file of fs.readdirSync('.').filter(name=>/^mission-.*-browser\.js$/.test(name))){
 const adapter=fs.readFileSync(file,'utf8');const start=adapter.indexOf('async function json(');if(start<0||!adapter.includes('createAiJsonFailure'))continue;
 test(file+' preserves the confirmed daily quota message',async()=>{
  const env=ai(()=>{});const context=vm.createContext({root:{createAiJsonFailure:env.createAiJsonFailure},core:()=>({PROMPT_VERSION:'test'}),getSelectedAiApiKey:()=> 'test',fetchGeminiJsonWithFallback:async()=>({parsed:null,attempts:[{status:'http_429',quotaPeriod:'day',quotaKind:'tokens'}]})});
  let compiled=false;for(let end=adapter.indexOf('}',start);end>=0;end=adapter.indexOf('}',end+1)){
   const candidate=adapter.slice(start,end+1);try{new vm.Script(candidate);}catch{continue;}vm.runInContext(candidate,context);compiled=true;break;
  }
  assert.equal(compiled,true);await assert.rejects(()=>context.json('prompt','version'),error=>error.code==='AI_QUOTA_LIMIT'&&/Tokenlimit für heute.*morgen.*bezahlten API-Plan/.test(error.message));
 });
}

test('Dispatch displays quota notice in indicator and dialog; ordinary errors stay on their existing path',()=>{
 const env=ai(()=>{}),indicator={innerText:''},dialogs=[];
 const ui=vm.createContext({document:{getElementById:()=>indicator},alert:message=>dialogs.push(message)});
 vm.runInContext(extractOriginalFunction(source,'showDispatchQuotaFailure'),ui);
 const error=env.createAiJsonFailure({attempts:[{status:'http_429',quotaPeriod:'day',quotaKind:'tokens'}]});
 assert.equal(ui.showDispatchQuotaFailure(error),true);assert.equal(indicator.innerText,error.message);assert.deepEqual(dialogs,[error.message]);
 assert.equal(ui.showDispatchQuotaFailure(new Error('other')),false);assert.equal(dialogs.length,1);
 assert.match(source,/const quotaShown = showDispatchQuotaFailure\(e\)/);
});
