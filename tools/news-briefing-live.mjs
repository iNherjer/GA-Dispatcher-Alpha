// One bounded reporter mission probe (one idea and one writer), using the reported target and explicitly reconstructed weather fixture.
// No live weather claim, no repair requests, no mutation of production data.
import fs from 'node:fs';
import vm from 'node:vm';
import core from '../mission-news-briefing-core.js';
import sharedCore from '../mission-poi-briefing-shared-core.js';
import flightApi from '../mission-private-episode-v6.js';
import charter from '../mission-charter-ideas-core.js';
import {extractOriginalFunction} from './extract-original-function.mjs';
const alternateTarget=process.env.NEWS_PROBE_TARGET?JSON.parse(process.env.NEWS_PROBE_TARGET):null;
const previousRuns=process.argv.slice(3).map(p=>JSON.parse(fs.readFileSync(p,'utf8')));
const historyStore={getItem:()=>null,setItem:()=>{}};
const historyValues=new Map();historyStore.getItem=k=>historyValues.get(k)||null;historyStore.setItem=(k,v)=>historyValues.set(k,v);
previousRuns.forEach((r,i)=>core.remember(historyStore,'probe-'+i,r.mission?.newsBriefing));
const output=process.argv[2];if(!output||fs.existsSync(output))throw Error('Pass a fresh output filename');
let key=process.env.GEMINI_API_KEY;
for(const path of ['/Users/jofaist/Desktop/GA dispatcher alpha/key.env.local','/Users/jofaist/Desktop/GA dispatcher alpha/.env.local']){
 if(key||!fs.existsSync(path))continue;const lines=fs.readFileSync(path,'utf8').split(/\r?\n/).map(x=>x.trim()).filter(x=>x&&!x.startsWith('#'));
 const line=lines.find(x=>/^GEMINI_API_KEY\s*=/.test(x));if(line)key=line.slice(line.indexOf('=')+1).trim().replace(/^(['"])(.*)\1$/,'$2');else if(lines.length===1&&!lines[0].includes('='))key=lines[0];
}
if(!key)throw Error('Missing key');
const report={promptVersion:core.PROMPT_VERSION,target:alternateTarget||{name:'Sommerbergtunnel',lat:48.28977,lon:8.17377,poiCategory:'road'},historyCount:core.history(historyStore).length,scope:alternateTarget?'One idea and one writer using local tiles; no weather, terrain or environment polygon fixture. No full browser or simulator test.':'One idea and one writer using local tiles and recorded OSM environment. Weather and terrain reconstructed from user report, not freshly fetched. No full browser or simulator test.'};
const save=()=>fs.writeFileSync(output,JSON.stringify(report,null,2));
let requests=0;const parser=vm.createContext({}),app=fs.readFileSync('app.js','utf8');
for(const n of ['_missionExtractBalancedJsonObjectText','_missionParseJsonTextDetailed'])vm.runInContext(extractOriginalFunction(app,n),parser);
const localFetch=async(url,options)=>String(url).startsWith('obstacles/')?fs.existsSync(url)?new Response(fs.readFileSync(url)):new Response('',{status:404}):fetch(url,options);
const region={fetch:localFetch,Response,Blob,DecompressionStream,AbortController,URLSearchParams,setTimeout,clearTimeout};
vm.runInNewContext(fs.readFileSync('mission-private-context-core.js','utf8'),region);
const env={window:{MissionNewsBriefingCore:core,MissionPoiBriefingSharedCore:sharedCore,MissionPrivateEpisodeV6:flightApi,MissionCharterIdeasCore:charter,MissionPrivateContextCore:null},localStorage:{getItem:key=>key==='ga_poi_environment_v1'?JSON.stringify([[(alternateTarget?alternateTarget.lat.toFixed(6)+','+alternateTarget.lon.toFixed(6):'48.289770,8.173770'),{facts:alternateTarget?[]:JSON.parse(fs.readFileSync('tools/fixtures/poi-environment-map-evidence.json')).cases[0].expected,expires:Date.now()+3600000}]]):historyStore.getItem(key),setItem:()=>{}},AbortSignal,Response,Blob,DecompressionStream,TextDecoder,Uint8Array,fetch:localFetch,console,getSelectedAiApiKey:()=>'',normalizeMissionProposalChoice:x=>x,missionProposalCompactTarget:x=>x,missionProposalFormatRoute:()=>({label:'20.4 NM'}),getMissionAircraftCapabilitySnapshot:()=>({passengerCapacity:1}),fetchGeminiJsonWithFallback:async prompt=>{
 if(++requests>2)throw Error('At most one idea and one writer');report.requests=requests;report.stage=requests===1?'idea':'writer';report.prompts=report.prompts||[];report.prompts.push(prompt);save();
 const response=await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent',{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},body:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:{response_mime_type:'application/json'}}),signal:AbortSignal.timeout(40000)});
 report.httpStatus=response.status;save();if(!response.ok)throw Error('Gemini HTTP '+response.status);
 const body=await response.json();report.usage=body.usageMetadata;report.raw=body.candidates?.[0]?.content?.parts?.[0]?.text||'';report.rawResponses=report.rawResponses||[];report.rawResponses.push(report.raw);save();
 const parsed=parser._missionParseJsonTextDetailed(report.raw);report.parseMode=parsed.mode;return {parsed:parsed.parsed};
}};
vm.runInNewContext(fs.readFileSync('data/mission-scene-assets.js','utf8'),env);vm.runInNewContext(fs.readFileSync('data/mission-homebase-scene-assets.js','utf8'),env);
vm.runInNewContext(fs.readFileSync('mission-poi-briefing-shared-browser.js','utf8'),env);
 vm.runInNewContext(fs.readFileSync('mission-news-briefing-browser.js','utf8'),env);
const api=env.window.MissionNewsBriefingBrowser,start={name:'Winzeln-Schramberg Airport',lat:48.27917,lon:8.42833},dest=alternateTarget||{name:'Sommerbergtunnel',lat:48.28977,lon:8.17377,poiCategory:'road'};
const choices=await api.choices([dest],{start,selectedPoiCategory:dest.poiCategory||'road'});report.target=dest;report.alternateTargetWithoutWeatherOrEnvironment=!!alternateTarget;report.idea=choices[0].newsProposal.idea;report.context=choices[0].newsProposal.context;
const raw={station:'EDTL',source:'METAR',observedAt:'2026-09-28T19:50:00.000Z',freshness:'recent',windKts:2,visKm:10,cloudBaseFtAgl:18000};
report.mission=await api.story({start,dest,proposal:choices[0].newsProposal,terrainEnvelope:alternateTarget?null:{centerFt:976,maxFt:1736,radiusNm:1,sampleCount:100,source:'terrarium-area'},contract:{route:{startName:start.name,targetName:dest.name,startIcao:'EDTW',targetIcao:'POI',distanceNm:alternateTarget?null:20.4},weather:alternateTarget?{}:{dep:{raw:{...raw,stationDistanceNm:24.6}},dest:{raw:{...raw,stationDistanceNm:14.6}}}}});
report.requests=requests;save();console.log(report.mission.s);
