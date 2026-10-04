// Bounded SAR ideas/writers probe with recorded or live target context and a labelled weather fixture.
// No live weather claim, no repair requests, no mutation of production data.
import fs from 'node:fs';
import vm from 'node:vm';
import core from '../mission-sar-briefing-core.js';
import sharedCore from '../mission-poi-briefing-shared-core.js';
import flightApi from '../mission-private-episode-v6.js';
import charter from '../mission-charter-ideas-core.js';
import scene from '../mission-sar-scene-core.js';
import sarSearch from '../mission-sar-search-core.js';
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
const localFetch=async(url,options)=>String(url).includes('/api/interpreter')&&process.env.SAR_GEOMETRY_FILE?new Response(fs.readFileSync(process.env.SAR_GEOMETRY_FILE)):String(url).startsWith('obstacles/')?fs.existsSync(url)?new Response(fs.readFileSync(url)):new Response('',{status:404}):fetch(url,options);
const region={fetch:localFetch,Response,Blob,DecompressionStream,AbortController,URLSearchParams,setTimeout,clearTimeout};
vm.runInNewContext(fs.readFileSync('mission-private-context-core.js','utf8'),region);
const env={window:{MissionSarBriefingCore:core,MissionSarSceneCore:scene,MissionPoiBriefingSharedCore:sharedCore,MissionPrivateEpisodeV6:flightApi,MissionCharterIdeasCore:charter,MissionPrivateContextCore:region.MissionPrivateContextCore},localStorage:historyStore,setTimeout,clearTimeout,AbortSignal,Response,Blob,DecompressionStream,TextDecoder,Uint8Array,fetch:async(url,options)=>{const res=await localFetch(url,options);if(String(url).includes('/api/interpreter')&&res.ok){const raw=await res.clone().json();const q=new URLSearchParams(options.body).get('data');const coords=q.match(/around:2200,([^,]+),([^)]*)/);if(coords){const geo=scene.geometry(raw,{lat:Number(coords[1]),lon:Number(coords[2])});console.log('GEO',coords.slice(1),geo.status,geo.sarCandidates.length);fs.writeFileSync('/tmp/sar-osm-'+coords[1]+'.json',JSON.stringify(raw));}}return res;},console,getSelectedAiApiKey:()=>'',normalizeMissionProposalChoice:x=>x,missionProposalCompactTarget:x=>x,missionProposalFormatRoute:()=>({label:'20.4 NM'}),getMissionAircraftCapabilitySnapshot:()=>({passengerCapacity:1}),fetchGeminiJsonWithFallback:async prompt=>{
 if(++requests>count*2+1)throw Error('One batch and one writer per mission only');report.prompts=report.prompts||[];report.prompts.push(prompt);save();
 const response=await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent',{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},body:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:{response_mime_type:'application/json'}}),signal:AbortSignal.timeout(40000)});
 report.httpStatus=response.status;save();if(!response.ok){const error=await response.json();report.error={status:response.status,message:error.error?.message};save();throw Error('Gemini HTTP '+response.status);}
 const body=await response.json();report.usage=body.usageMetadata;report.raw=body.candidates?.[0]?.content?.parts?.[0]?.text||'';report.rawResponses=report.rawResponses||[];report.rawResponses.push(report.raw);save();
 const parsed=parser._missionParseJsonTextDetailed(report.raw);report.parseMode=parsed.mode;return {parsed:parsed.parsed};
}};
vm.runInNewContext(fs.readFileSync('mission-poi-briefing-shared-browser.js','utf8'),env);
 if(process.argv[3]){
 const recorded=JSON.parse(fs.readFileSync(process.argv[3],'utf8'));
 for(const [i,m]of (recorded.missions||[]).entries())core.remember(historyStore,'previous-probe-'+i,m.sarBriefing);
 env.window.MissionPoiBriefingSharedBrowser={context:async dest=>structuredClone(recorded.choices.find(row=>sharedCore.samePoint(row.sarProposal.context.target,dest)).sarProposal.context),enrichSelected:async c=>c};
}
vm.runInNewContext(fs.readFileSync('data/mission-scene-assets.js','utf8'),env);
vm.runInNewContext(fs.readFileSync('mission-sar-briefing-browser.js','utf8'),env);
const api=env.window.MissionSarBriefingBrowser,start={name:'Winzeln-Schramberg Airport',lat:48.27917,lon:8.42833};
const targets=[
 {name:'Schönbuch',lat:48.57,lon:9.0,poiCategory:'mountain',poiLookup:{selectedTags:{natural:'peak'}}},
 {name:'Schönbuch-West',lat:48.568,lon:8.99,poiCategory:'mountain',poiLookup:{selectedTags:{natural:'peak'}}},
 {name:'Schönbuch',lat:48.57,lon:9.0,poiCategory:'nature',poiLookup:{selectedTags:{landuse:'forest'}}}
].slice(0,count);
report.scope='One Gemini batch and '+count+' writers. Shared target/map context (recorded if supplied), historical weather fixture; no live weather, scene placement, audio or simulator test. No repair calls.';
const resume=process.env.SAR_PROBE_RESUME?JSON.parse(fs.readFileSync(process.env.SAR_PROBE_RESUME,'utf8')):null;
report.recordedContext=process.argv[3]||null;report.missions=resume?.missions||[];report.choices=resume?.choices||await api.choices(targets,{start});save();
const raw={station:'EDTL',source:'METAR',observedAt:'2026-09-30T10:20:00.000Z',freshness:'recent',windKts:2,visKm:10,temperatureC:26};
if (resume && process.env.SAR_PROBE_REWRITE) report.missions=[];
for(const [i,dest]of (resume && !process.env.SAR_PROBE_REWRITE?[]:targets).entries()){
 const mission=await api.story({start,dest,proposal:report.choices[i].sarProposal,contract:{route:{startName:start.name,targetName:dest.name,startIcao:'EDTW',targetIcao:'POI',distanceNm:Math.round(sharedCore.relation(start,dest).distanceM/1852*10)/10},weather:{dep:{raw:{...raw,stationDistanceNm:25}},dest:{raw:{...raw,stationDistanceNm:30}}}}});
 if(resume?.scenes?.[i]) mission.sarScenario=resume.scenes[i].sarScenario;
 report.missions.push(mission);core.remember(historyStore,'probe-'+i,mission.sarBriefing);save();console.log('\n'+mission.t+'\n'+mission.s+'\nBegrüßung: '+mission.passenger.greetingText);
}
report.requests=requests;save();


vm.runInContext(extractOriginalFunction(app,'scenePlannerV3Prompt'),parser);parser.normalizeMissionType=()=> 'poi';
report.scenes=resume?.scenes||[];
for(const [index,m]of report.missions.entries()){
 if(process.env.SAR_SCENE_INDEX!==undefined&&index!==Number(process.env.SAR_SCENE_INDEX))continue;
 m.sarScenario.truth='incident';
 const result=await api.composeScene({missionData:m,missionContract:m._missionContractV4,passenger:m.passenger,apiKey:'process-key',compose:async p=>{
  report.scenePacket=p.missionData.sarSearchScene;save();
  const prompt=parser.scenePlannerV3Prompt({isPOI:true,missionMode:'poi'})+scene.composerInstructions(p.missionData.sarSearchScene)+'\nDer Tool-Kontext liegt hier vollständig vor, keine weiteren Tool-Aufrufe:\n'+JSON.stringify({missionData:p.missionData,missionContract:p.missionContract,passenger:p.passenger,assetCatalog:env.window.MISSION_SCENE_ASSETS});
  const raw=(await env.fetchGeminiJsonWithFallback(prompt)).parsed;report.composerRaw=raw;save();return {targetScene:raw.targetScene||raw,debug:{aiRaw:raw}};
 },terrain:async(lat,lon)=>{const res=await fetch(`https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lon}`,{signal:AbortSignal.timeout(8000)});if(!res.ok)throw Error('Terrain HTTP '+res.status);return (await res.json()).elevation[0]*3.28084;}});
 const sc=result.sarScenario;report.scenes[index]=result;report.runtimeVoices=[];let state=sarSearch.create(sc);
 const dx=sc.source.lon-sc.center.lon,dy=sc.source.lat-sc.center.lat,scale=.012/Math.max(Math.hypot(dx,dy),.001);const searching={lat:sc.center.lat-dy*scale,lon:sc.center.lon-dx*scale};
 for(let now=0;now<=260000;now+=1000){const observed=sarSearch.observe(sc,state,{...(now<210000?searching:sc.source),onGround:false},now);state=observed.state;report.runtimeVoices.push(...observed.voices);}
 if(report.runtimeVoices.map(v=>v.label).join(',')!=='Suchgebiet,Suchhinweis,Sichtkontakt,Suchabschluss')throw Error('Unexpected delayed-search voice sequence');
 if(!state.complete)throw Error('Search did not complete');save();console.log(JSON.stringify({incident:m.sarBriefing.idea.incident,source:sc.source,offsetNm:sarSearch.distance(sc.center,sc.source),reference:result.debug.placementReference,voices:report.runtimeVoices},null,2));
}
report.requests=requests;report.scope='Authorized fictitious live SAR cases: Gemini ideas, writers and composer with public OSM geography and terrain. Historical labelled weather fixture; simulated telemetry; no MSFS visual flight test.';save();
