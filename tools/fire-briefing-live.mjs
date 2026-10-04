// Bounded Fire-Watch ideas/writers probe with recorded or live target context and a labelled weather fixture.
// No live weather claim, no repair requests, no mutation of production data.
import fs from 'node:fs';
import vm from 'node:vm';
import core from '../mission-fire-briefing-core.js';
import sharedCore from '../mission-poi-briefing-shared-core.js';
import flightApi from '../mission-private-episode-v6.js';
import charter from '../mission-charter-ideas-core.js';
import scene from '../mission-fire-scene-core.js';
import fireCore from '../mission-fire-watch-core.js';
import {extractOriginalFunction} from './extract-original-function.mjs';
const historyValues=new Map();const historyStore={getItem:k=>historyValues.get(k)||null,setItem:(k,v)=>historyValues.set(k,v)};
const output=process.argv[2];if(!output||fs.existsSync(output))throw Error('Pass a fresh output filename');
let key=process.env.GEMINI_API_KEY;
for(const path of ['/Users/jofaist/Desktop/GA dispatcher alpha/key.env.local','/Users/jofaist/Desktop/GA dispatcher alpha/.env.local']){
 if(key||!fs.existsSync(path))continue;const lines=fs.readFileSync(path,'utf8').split(/\r?\n/).map(x=>x.trim()).filter(x=>x&&!x.startsWith('#'));
 const line=lines.find(x=>/^GEMINI_API_KEY\s*=/.test(x));if(line)key=line.slice(line.indexOf('=')+1).trim().replace(/^(['"])(.*)\1$/,'$2');else if(lines.length===1&&!lines[0].includes('='))key=lines[0];
}
if(!key)throw Error('Missing key');
const count=Number(process.argv[4]||3);if(![1,2,3].includes(count))throw Error('Use one to three missions');
const report={promptVersion:core.PROMPT_VERSION};
const save=()=>fs.writeFileSync(output,JSON.stringify(report,null,2));
let requests=0;const parser=vm.createContext({}),app=fs.readFileSync('app.js','utf8');
for(const n of ['_missionExtractBalancedJsonObjectText','_missionParseJsonTextDetailed'])vm.runInContext(extractOriginalFunction(app,n),parser);
const localFetch=async(url,options)=>String(url).includes('/api/interpreter')&&process.env.FIRE_GEOMETRY_FILE?new Response(fs.readFileSync(process.env.FIRE_GEOMETRY_FILE)):String(url).startsWith('obstacles/')?fs.existsSync(url)?new Response(fs.readFileSync(url)):new Response('',{status:404}):fetch(url,options);
const region={fetch:localFetch,Response,Blob,DecompressionStream,AbortController,URLSearchParams,setTimeout,clearTimeout};
vm.runInNewContext(fs.readFileSync('mission-private-context-core.js','utf8'),region);
const env={window:{MissionFireBriefingCore:core,MissionFireSceneCore:scene,MissionPoiBriefingSharedCore:sharedCore,MissionPrivateEpisodeV6:flightApi,MissionCharterIdeasCore:charter,MissionPrivateContextCore:region.MissionPrivateContextCore},localStorage:historyStore,setTimeout,clearTimeout,AbortSignal,Response,Blob,DecompressionStream,TextDecoder,Uint8Array,fetch:localFetch,console,getSelectedAiApiKey:()=>'',normalizeMissionProposalChoice:x=>x,missionProposalCompactTarget:x=>x,missionProposalFormatRoute:()=>({label:'20.4 NM'}),getMissionAircraftCapabilitySnapshot:()=>({passengerCapacity:1}),fetchGeminiJsonWithFallback:async prompt=>{
 if(++requests>(count===1?3:count+1))throw Error('One batch and one writer per mission only');report.prompts=report.prompts||[];report.prompts.push(prompt);save();
 const response=await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent',{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},body:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:{response_mime_type:'application/json'}}),signal:AbortSignal.timeout(40000)});
 report.httpStatus=response.status;save();if(!response.ok)throw Error('Gemini HTTP '+response.status);
 const body=await response.json();report.usage=body.usageMetadata;report.raw=body.candidates?.[0]?.content?.parts?.[0]?.text||'';report.rawResponses=report.rawResponses||[];report.rawResponses.push(report.raw);save();
 const parsed=parser._missionParseJsonTextDetailed(report.raw);report.parseMode=parsed.mode;return {parsed:parsed.parsed};
}};
vm.runInNewContext(fs.readFileSync('mission-poi-briefing-shared-browser.js','utf8'),env);
 if(process.argv[3]){
 const recorded=JSON.parse(fs.readFileSync(process.argv[3],'utf8'));
 for(const [i,m]of (recorded.missions||[]).entries())core.remember(historyStore,'previous-probe-'+i,m.fireBriefing);
 env.window.MissionPoiBriefingSharedBrowser={context:async dest=>structuredClone(recorded.choices.find(row=>sharedCore.samePoint(row.fireProposal.context.target,dest)).fireProposal.context),enrichSelected:async c=>c};
}
vm.runInNewContext(fs.readFileSync('data/mission-scene-assets.js','utf8'),env);
vm.runInNewContext(fs.readFileSync('mission-fire-briefing-browser.js','utf8'),env);
const api=env.window.MissionFireBriefingBrowser,start={name:'Winzeln-Schramberg Airport',lat:48.27917,lon:8.42833};
const targets=[
 {name:'Feldberg',lat:47.873,lon:8.004,poiCategory:'mountain',poiLookup:{selectedTags:{natural:'peak'}}},
 {name:'Hornisgrinde',lat:48.606,lon:8.201,poiCategory:'mountain',poiLookup:{selectedTags:{natural:'peak'}}},
 {name:'Schönbuch',lat:48.57,lon:9.0,poiCategory:'nature',poiLookup:{selectedTags:{landuse:'forest'}}}
].slice(count===1?2:0,count===1?3:count);
report.scope='One Gemini batch and '+count+' writers. Shared target/map context (recorded if supplied), historical weather fixture; no live weather, scene placement, audio or simulator test. No repair calls.';
const resume=process.env.FIRE_PROBE_RESUME?JSON.parse(fs.readFileSync(process.env.FIRE_PROBE_RESUME,'utf8')):null;
report.recordedContext=process.argv[3]||null;report.missions=resume?.missions||[];report.choices=resume?.choices||await api.choices(targets,{start});save();
const raw={station:'EDTL',source:'METAR',observedAt:'2026-09-30T10:20:00.000Z',freshness:'recent',windKts:2,visKm:10,temperatureC:26};
for(const [i,dest]of (resume?[]:targets).entries()){
 const mission=await api.story({start,dest,proposal:report.choices[i].fireProposal,contract:{route:{startName:start.name,targetName:dest.name,startIcao:'EDTW',targetIcao:'POI',distanceNm:Math.round(sharedCore.relation(start,dest).distanceM/1852*10)/10},weather:{dep:{raw:{...raw,stationDistanceNm:25}},dest:{raw:{...raw,stationDistanceNm:30}}}}});
 report.missions.push(mission);core.remember(historyStore,'probe-'+i,mission.fireBriefing);save();console.log('\n'+mission.t+'\n'+mission.s+'\nBegrüßung: '+mission.passenger.greetingText);
}
report.requests=requests;save();

if(count===1){
 const m=report.missions[0],dest=targets[0];
 const build=vm.createContext({window:{fireMissionTruthOverride:()=> 'fire',fireMissionExtentOverride:()=> 'multi_smoke'},Math,Date,normalizeMissionText:x=>x,getDestinationPoint:(lat,lon,distanceNm,bearing)=>{const d=distanceNm*1852,a=bearing*Math.PI/180;return {lat:lat+d*Math.cos(a)/111320,lon:lon+d*Math.sin(a)/(111320*Math.cos(lat*Math.PI/180))};}});
 for(const n of ['missionAllowsFireWatchScenario','pickFireWatchExtent','fireWatchSiteCountForExtent','buildFireWatchSmokeSites','buildFireWatchFireSites','buildFireWatchScenario'])vm.runInContext(extractOriginalFunction(app,n),build);
 const scenario=build.buildFireWatchScenario({isPOI:true,mission:m,passenger:m.passenger,dest,poiTerrainFt:1000});
 scenario.search={schema:'fire-search.v2',sceneMode:'smoke',thermalCamera:true,thermalAfterSec:45,hintAfterSec:75};
 vm.runInContext(extractOriginalFunction(app,'scenePlannerV3Prompt'),parser);parser.normalizeMissionType=()=> 'poi';
 let packet;
 const result=await api.composeScene({missionData:{...m,fireScenario:scenario},missionContract:m._missionContractV4,passenger:m.passenger,apiKey:'process-key',compose:async p=>{
  packet=p;report.scenePacket=p.missionData.fireSearchScene;save();
  const prompt=parser.scenePlannerV3Prompt({isPOI:true,missionMode:'poi'})+'\nDer Tool-Kontext wurde für diese Probe bereits bereitgestellt; nutze dieses get_scene_context_bundle Ergebnis ohne erneuten Tool-Aufruf:\n'+JSON.stringify({missionData:p.missionData,missionContract:p.missionContract,passenger:p.passenger});
  const raw=process.env.FIRE_COMPOSER_RESUME?JSON.parse(fs.readFileSync(process.env.FIRE_COMPOSER_RESUME,'utf8')).composerRaw:(await env.fetchGeminiJsonWithFallback(prompt)).parsed;report.composerRaw=raw;save();return {targetScene:scene.sceneSpec(raw),debug:{aiRaw:raw}};
 },terrain:async(lat,lon)=>{const res=await fetch(`https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lon}`,{signal:AbortSignal.timeout(5500)});if(!res.ok)throw Error('Terrain HTTP '+res.status);return (await res.json()).elevation[0]*3.28084;}});
 report.scene=result.fireScenario;report.sceneSource=result.fireScenario?.placement?.source;save();
 if(report.sceneSource!=='scene-composer')throw Error('Composer placement rejected; report contains mapped fallback, not accepted KI');
 report.coordinates=report.scene.smoke.sites.map(s=>({siteId:s.siteId,lat:s.lat,lon:s.lon,altFt:s.altFt,sourceDistanceNm:sharedCore.relation(dest,s).distanceM/1852,fireSites:report.scene.fire.sites.filter(f=>f.smokeSiteId===s.siteId)}));
 for(const f of report.scene.fire.sites){const s=report.scene.smoke.sites.find(s=>s.siteId===f.smokeSiteId);if(['lat','lon','altFt'].some(k=>f[k]!==s[k]))throw Error('Fire and smoke mismatch');}
 const source=report.scene.smoke.sites[0],sample={lat:source.lat,lon:source.lon,heading:90,mslFt:4000};
 const ctx={scenario:report.scene,passenger:m.passenger,runtimeActive:true};let r=fireCore.observe(ctx,fireCore.createState(ctx),sample,10000);report.runtimeVoices=[...r.voices];
 for(const now of [60000,100000]){r=fireCore.observe(ctx,r.state,sample,now);report.runtimeVoices.push(...r.voices);}
 const checked=fireCore.action(ctx,r.state,'fire_smoke_visible',sample,110000);report.runtimeVoices.push(...checked.voices);report.confirmed=checked.state.scenario.state;save();
 const text=report.runtimeVoices.find(v=>v.label==='Suchhinweis')?.text;
 if(text){const started=Date.now();const response=await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-tts-preview:generateContent',{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},body:JSON.stringify({contents:[{parts:[{text:'Sprich als ruhiger Einsatzbeobachter knapp und klar: '+text}]}],generationConfig:{responseModalities:['AUDIO'],speechConfig:{voiceConfig:{prebuiltVoiceConfig:{voiceName:m.passenger.gender==='female'?'Kore':'Puck'}}}}}),signal:AbortSignal.timeout(40000)});const body=await response.json(),part=body.candidates?.[0]?.content?.parts?.find(p=>p.inlineData)?.inlineData;report.tts={model:'gemini-3.1-flash-tts-preview',status:response.status,elapsedMs:Date.now()-started,audioBytes:part?Buffer.from(part.data,'base64').length:0,mimeType:part?.mimeType};save();}
 report.requests=requests;report.scope='One Gemini idea and briefing, one Scene Planner V3 prompt with supplied real OSM context, actual terrain at sources, deterministic tracker detector probe and one real TTS latency probe. No simulator playback.';save();
 console.log(JSON.stringify({sceneSource:report.sceneSource,coordinates:report.coordinates,voices:report.runtimeVoices,tts:report.tts},null,2));
}
