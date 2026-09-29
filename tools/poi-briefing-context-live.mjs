// One bounded writer probe, using the reported target and explicitly reconstructed weather fixture.
// No new idea, no live weather claim, no repair requests, no mutation of production data.
import fs from 'node:fs';
import vm from 'node:vm';
import core from '../mission-poi-briefing-core.js';
import sharedCore from '../mission-poi-briefing-shared-core.js';
import flightApi from '../mission-private-episode-v6.js';
import charter from '../mission-charter-ideas-core.js';
import {extractOriginalFunction} from './extract-original-function.mjs';
const output=process.argv[2];if(!output||fs.existsSync(output))throw Error('Pass a fresh output filename');
let key=process.env.GEMINI_API_KEY;
for(const path of ['/Users/jofaist/Desktop/GA dispatcher alpha/key.env.local','/Users/jofaist/Desktop/GA dispatcher alpha/.env.local']){
 if(key||!fs.existsSync(path))continue;const lines=fs.readFileSync(path,'utf8').split(/\r?\n/).map(x=>x.trim()).filter(x=>x&&!x.startsWith('#'));
 const line=lines.find(x=>/^GEMINI_API_KEY\s*=/.test(x));if(line)key=line.slice(line.indexOf('=')+1).trim().replace(/^(['"])(.*)\1$/,'$2');else if(lines.length===1&&!lines[0].includes('='))key=lines[0];
}
if(!key)throw Error('Missing key');
const report={promptVersion:core.PROMPT_VERSION,scope:'One writer; reported Sommerbergtunnel target with real local tiles. Weather reconstructed from user report, not freshly fetched. Existing app transport JSON parser. No complete app UI or simulator test.'};
const save=()=>fs.writeFileSync(output,JSON.stringify(report,null,2));
let requests=0;const parser=vm.createContext({}),app=fs.readFileSync('app.js','utf8');
for(const n of ['_missionExtractBalancedJsonObjectText','_missionParseJsonTextDetailed'])vm.runInContext(extractOriginalFunction(app,n),parser);
const localFetch=async(url,options)=>String(url).startsWith('obstacles/')?fs.existsSync(url)?new Response(fs.readFileSync(url)):new Response('',{status:404}):fetch(url,options);
const region={fetch:localFetch,Response,Blob,DecompressionStream,AbortController,URLSearchParams,setTimeout,clearTimeout};
vm.runInNewContext(fs.readFileSync('mission-private-context-core.js','utf8'),region);
const env={window:{MissionPoiBriefingCore:core,MissionPoiBriefingSharedCore:sharedCore,MissionPrivateEpisodeV6:flightApi,MissionCharterIdeasCore:charter,MissionPrivateContextCore:region.MissionPrivateContextCore},localStorage:{getItem:()=>null},AbortSignal,Response,Blob,DecompressionStream,TextDecoder,Uint8Array,fetch:localFetch,console,getSelectedAiApiKey:()=>'',getMissionAircraftCapabilitySnapshot:()=>({passengerCapacity:1}),fetchGeminiJsonWithFallback:async prompt=>{
 if(++requests>1)throw Error('One request only');report.prompt=prompt;save();
 const response=await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent',{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},body:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:{response_mime_type:'application/json'}}),signal:AbortSignal.timeout(40000)});
 report.httpStatus=response.status;save();if(!response.ok)throw Error('Gemini HTTP '+response.status);
 const body=await response.json();report.usage=body.usageMetadata;report.raw=body.candidates?.[0]?.content?.parts?.[0]?.text||'';save();
 const parsed=parser._missionParseJsonTextDetailed(report.raw);report.parseMode=parsed.mode;return {parsed:parsed.parsed};
}};
vm.runInNewContext(fs.readFileSync('mission-poi-briefing-shared-browser.js','utf8'),env);
 vm.runInNewContext(fs.readFileSync('mission-poi-briefing-browser.js','utf8'),env);
const api=env.window.MissionPoiBriefingBrowser,start={name:'Winzeln-Schramberg Airport',lat:48.27917,lon:8.42833},dest={name:'Sommerbergtunnel',lat:48.28977,lon:8.17377};
const c=await api.context(dest);report.context=c;
const idea=core.validateIdea({schema:core.IDEA_VERSION,targetId:c.id,targetName:dest.name,taskDomain:'media_photo',situation:'Lukas bereitet eine Reportage über Verkehrswege im Schwarzwald für sein Online-Magazin vor.',intent:'Er möchte Übersichtsfotos der sichtbaren Einfahrtsbereiche für das Titelbild seiner Reportage machen.',person:{name:'Lukas Meerstein',role:'Regionaler Online-Journalist',relationshipToPilot:'Schulfreund'}},c);
const raw={station:'EDTL',source:'METAR',observedAt:'2026-09-28T19:50:00.000Z',freshness:'recent',windKts:2,visKm:10,cloudBaseFtAgl:18000};
report.mission=await api.story({start,dest,proposal:{schema:'poi-photo-proposal.v1',start,context:c,idea},terrainEnvelope:{centerFt:976,maxFt:1736,radiusNm:1,sampleCount:100,source:'terrarium-area'},contract:{route:{startName:start.name,targetName:dest.name,startIcao:'EDTW',targetIcao:'POI',distanceNm:20.4},weather:{dep:{raw:{...raw,stationDistanceNm:24.6}},dest:{raw:{...raw,stationDistanceNm:14.6}}}}});
report.requests=requests;save();console.log(report.mission.s);
