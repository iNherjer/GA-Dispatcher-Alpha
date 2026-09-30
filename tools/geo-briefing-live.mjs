// Bounded geology ideas/writers probe with recorded or live target context and a labelled weather fixture.
// No live weather claim, no repair requests, no mutation of production data.
import fs from 'node:fs';
import vm from 'node:vm';
import core from '../mission-geo-briefing-core.js';
import sharedCore from '../mission-poi-briefing-shared-core.js';
import flightApi from '../mission-private-episode-v6.js';
import charter from '../mission-charter-ideas-core.js';
import {extractOriginalFunction} from './extract-original-function.mjs';
const historyValues=new Map();const historyStore={getItem:k=>historyValues.get(k)||null,setItem:(k,v)=>historyValues.set(k,v)};
const output=process.argv[2];if(!output||fs.existsSync(output))throw Error('Pass a fresh output filename');
let key=process.env.GEMINI_API_KEY;
for(const path of ['/Users/jofaist/Desktop/GA dispatcher alpha/key.env.local','/Users/jofaist/Desktop/GA dispatcher alpha/.env.local']){
 if(key||!fs.existsSync(path))continue;const lines=fs.readFileSync(path,'utf8').split(/\r?\n/).map(x=>x.trim()).filter(x=>x&&!x.startsWith('#'));
 const line=lines.find(x=>/^GEMINI_API_KEY\s*=/.test(x));if(line)key=line.slice(line.indexOf('=')+1).trim().replace(/^(['"])(.*)\1$/,'$2');else if(lines.length===1&&!lines[0].includes('='))key=lines[0];
}
if(!key)throw Error('Missing key');
const count=Number(process.argv[4]||3);if(![2,3].includes(count))throw Error('Use two or three missions');
const report={promptVersion:core.PROMPT_VERSION};
const save=()=>fs.writeFileSync(output,JSON.stringify(report,null,2));
let requests=0;const parser=vm.createContext({}),app=fs.readFileSync('app.js','utf8');
for(const n of ['_missionExtractBalancedJsonObjectText','_missionParseJsonTextDetailed'])vm.runInContext(extractOriginalFunction(app,n),parser);
const localFetch=async(url,options)=>String(url).startsWith('obstacles/')?fs.existsSync(url)?new Response(fs.readFileSync(url)):new Response('',{status:404}):fetch(url,options);
const region={fetch:localFetch,Response,Blob,DecompressionStream,AbortController,URLSearchParams,setTimeout,clearTimeout};
vm.runInNewContext(fs.readFileSync('mission-private-context-core.js','utf8'),region);
const env={window:{MissionGeoBriefingCore:core,MissionPoiBriefingSharedCore:sharedCore,MissionPrivateEpisodeV6:flightApi,MissionCharterIdeasCore:charter,MissionPrivateContextCore:region.MissionPrivateContextCore},localStorage:historyStore,AbortSignal,Response,Blob,DecompressionStream,TextDecoder,Uint8Array,fetch:localFetch,console,getSelectedAiApiKey:()=>'',normalizeMissionProposalChoice:x=>x,missionProposalCompactTarget:x=>x,missionProposalFormatRoute:()=>({label:'20.4 NM'}),getMissionAircraftCapabilitySnapshot:()=>({passengerCapacity:1}),fetchGeminiJsonWithFallback:async prompt=>{
 if(++requests>count+1)throw Error('One batch and one writer per mission only');report.prompts=report.prompts||[];report.prompts.push(prompt);save();
 const response=await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent',{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},body:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:{response_mime_type:'application/json'}}),signal:AbortSignal.timeout(40000)});
 report.httpStatus=response.status;save();if(!response.ok)throw Error('Gemini HTTP '+response.status);
 const body=await response.json();report.usage=body.usageMetadata;report.raw=body.candidates?.[0]?.content?.parts?.[0]?.text||'';report.rawResponses=report.rawResponses||[];report.rawResponses.push(report.raw);save();
 const parsed=parser._missionParseJsonTextDetailed(report.raw);report.parseMode=parsed.mode;return {parsed:parsed.parsed};
}};
vm.runInNewContext(fs.readFileSync('mission-poi-briefing-shared-browser.js','utf8'),env);
 if(process.argv[3]){
 const recorded=JSON.parse(fs.readFileSync(process.argv[3],'utf8'));
 for(const [i,m]of (recorded.missions||[]).entries())core.remember(historyStore,'previous-probe-'+i,m.geoBriefing);
 env.window.MissionPoiBriefingSharedBrowser={context:async dest=>structuredClone(recorded.choices.find(row=>sharedCore.samePoint(row.geoProposal.context.target,dest)).geoProposal.context),enrichSelected:async c=>c};
}
vm.runInNewContext(fs.readFileSync('data/mission-scene-assets.js','utf8'),env);
vm.runInNewContext(fs.readFileSync('mission-geo-briefing-browser.js','utf8'),env);
const api=env.window.MissionGeoBriefingBrowser,start={name:'Winzeln-Schramberg Airport',lat:48.27917,lon:8.42833};
const targets=[
 {name:'Feldberg',lat:47.873,lon:8.004,poiCategory:'mountain',poiLookup:{selectedTags:{natural:'peak'}}},
 {name:'Titisee',lat:47.899,lon:8.151,poiCategory:'water',poiLookup:{selectedTags:{natural:'water',water:'lake'}}},
 {name:'Schwarzenbachtalsperre',lat:48.657,lon:8.328,poiCategory:'dam',poiLookup:{selectedTags:{water:'reservoir'}}}
].slice(0,count);
report.scope='One Gemini batch and '+count+' writers. Shared target/map context (recorded if supplied), historical weather fixture; no live weather, scene placement, audio or simulator test. No repair calls.';
report.recordedContext=process.argv[3]||null;report.missions=[];report.choices=await api.choices(targets,{start});save();
const raw={station:'EDTL',source:'METAR',observedAt:'2026-09-30T10:20:00.000Z',freshness:'recent',windKts:2,visKm:10,temperatureC:26};
for(const [i,dest]of targets.entries()){
 const mission=await api.story({start,dest,proposal:report.choices[i].geoProposal,contract:{route:{startName:start.name,targetName:dest.name,startIcao:'EDTW',targetIcao:'POI',distanceNm:Math.round(sharedCore.relation(start,dest).distanceM/1852*10)/10},weather:{dep:{raw:{...raw,stationDistanceNm:25}},dest:{raw:{...raw,stationDistanceNm:30}}}}});
 report.missions.push(mission);core.remember(historyStore,'probe-'+i,mission.geoBriefing);save();console.log('\n'+mission.t+'\n'+mission.s+'\nBegrüßung: '+mission.passenger.greetingText);
}
report.requests=requests;save();
