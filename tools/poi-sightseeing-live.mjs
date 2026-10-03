// Bounded knowledge ideas/writers probe with fresh public article facts.
// No pilot data, live weather claim, audio generation or mutation of production data.
import fs from 'node:fs';
import vm from 'node:vm';
import core from '../mission-knowledge-briefing-core.js';
import sharedCore from '../mission-poi-briefing-shared-core.js';
import flightApi from '../mission-private-episode-v6.js';
import charter from '../mission-charter-ideas-core.js';
import voice from '../mission-poi-voice-core.js';
import {extractOriginalFunction} from './extract-original-function.mjs';
const historyValues=new Map();const historyStore={getItem:k=>historyValues.get(k)||null,setItem:(k,v)=>historyValues.set(k,v)};
const output=process.argv[2];if(!output||fs.existsSync(output))throw Error('Pass a fresh output filename');
let key=process.env.GEMINI_API_KEY;
for(const path of ['/Users/jofaist/Desktop/GA dispatcher alpha/key.env.local','/Users/jofaist/Desktop/GA dispatcher alpha/.env.local']){
 if(key||!fs.existsSync(path))continue;const lines=fs.readFileSync(path,'utf8').split(/\r?\n/).map(x=>x.trim()).filter(x=>x&&!x.startsWith('#'));
 const line=lines.find(x=>/^GEMINI_API_KEY\s*=/.test(x));if(line)key=line.slice(line.indexOf('=')+1).trim().replace(/^(['"])(.*)\1$/,'$2');else if(lines.length===1&&!lines[0].includes('='))key=lines[0];
}
if(!key)throw Error('Missing key');
const report={promptVersion:core.PROMPT_VERSION};
const save=()=>fs.writeFileSync(output,JSON.stringify(report,null,2));
let requests=0;const parser=vm.createContext({}),app=fs.readFileSync('app.js','utf8');
for(const n of ['_missionExtractBalancedJsonObjectText','_missionParseJsonTextDetailed'])vm.runInContext(extractOriginalFunction(app,n),parser);
const localFetch=async(url,options)=>String(url).startsWith('obstacles/')?fs.existsSync(url)?new Response(fs.readFileSync(url)):new Response('',{status:404}):fetch(url,options);
const region={fetch:localFetch,Response,Blob,DecompressionStream,AbortController,URLSearchParams,setTimeout,clearTimeout};
vm.runInNewContext(fs.readFileSync('mission-private-context-core.js','utf8'),region);
const env={window:{MissionKnowledgeBriefingCore:core,MissionPoiBriefingSharedCore:sharedCore,MissionPrivateEpisodeV6:flightApi,MissionCharterIdeasCore:charter,MissionPrivateContextCore:region.MissionPrivateContextCore},localStorage:historyStore,AbortSignal,Response,Blob,DecompressionStream,TextDecoder,Uint8Array,fetch:localFetch,console,getSelectedAiApiKey:()=>'',normalizeMissionProposalChoice:x=>x,missionProposalCompactTarget:x=>x,missionProposalFormatRoute:()=>({label:'20.4 NM'}),getMissionAircraftCapabilitySnapshot:()=>({passengerCapacity:1}),fetchGeminiJsonWithFallback:async prompt=>{
 if(++requests>24)throw Error('One idea and one writer per mission only');report.prompts=report.prompts||[];report.prompts.push(prompt);save();
 const response=await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent',{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},body:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:{response_mime_type:'application/json'}}),signal:AbortSignal.timeout(40000)});
 report.httpStatus=response.status;save();if(!response.ok)throw Error('Gemini HTTP '+response.status);
 const body=await response.json();report.usage=body.usageMetadata;report.raw=body.candidates?.[0]?.content?.parts?.[0]?.text||'';report.rawResponses=report.rawResponses||[];report.rawResponses.push(report.raw);save();
 const parsed=parser._missionParseJsonTextDetailed(report.raw);report.parseMode=parsed.mode;return {parsed:parsed.parsed};
}};
vm.runInNewContext(fs.readFileSync('mission-poi-briefing-shared-browser.js','utf8'),env);
vm.runInNewContext(fs.readFileSync('data/mission-scene-assets.js','utf8'),env);
vm.runInNewContext(fs.readFileSync('mission-knowledge-briefing-browser.js','utf8'),env);
const api=env.window.MissionKnowledgeBriefingBrowser,start={name:'Winzeln-Schramberg Airport',lat:48.27917,lon:8.42833};
for(const name of ['_poiKnowledgeCleanWikiText','_poiKnowledgeProtectSentenceDots','_poiKnowledgeSplitFacts','_poiKnowledgeFactTopics','_poiKnowledgePickFacts'])vm.runInContext(extractOriginalFunction(app,name),parser);

// Original nearby Wikipedia ranking/transport, confined to the existing work zone.
Object.assign(env,{URLSearchParams,POI_KNOWLEDGE_WIKI_TIMEOUT_MS:5000,APT_SIGHTSEEING_LANDMARK_LIMIT:3,_poiKnowledgeCooldownRemainingMs:()=>0,_poiKnowledgeApplyRateLimitCooldown:()=>{},_poiKnowledgeFetchJson:(url,ms)=>fetch(url,{signal:AbortSignal.timeout(ms)})});
env.normalizeMissionText=x=>String(x||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/ä/g,'ae').replace(/ö/g,'oe').replace(/ü/g,'ue').replace(/ß/g,'ss');
for(const name of ['_missionSightseeingAptLandmarkScore','_missionSightseeingAptLandmarkTopic','_missionSightseeingFetchNearbyWikiLandmarks']) {
 const start=app.indexOf('function '+name+'('), async=app.slice(start-6,start)==='async ';let installed=false;
 for(let end=app.indexOf('\n}',start);end>=0;end=app.indexOf('\n}',end+2)){const code=(async?'async ':'')+app.slice(start,end+2);try{new vm.Script(code);vm.runInNewContext(code,env);installed=true;break;}catch(e){if(e.name!=='SyntaxError')throw e;}}
 if(!installed)throw Error('Could not extract '+name);
 }
env._fetchWikiExtractByTitle=async title=>{
 const url='https://de.wikipedia.org/w/api.php?'+new URLSearchParams({action:'query',format:'json',redirects:'1',prop:'extracts|coordinates|info',inprop:'url',explaintext:'1',titles:title});
 const r=await fetch(url,{signal:AbortSignal.timeout(15000)});if(!r.ok)return null;
 const page=Object.values((await r.json()).query.pages)[0];return {title:page.title,extract:page.extract||'',page};
};
env._poiKnowledgePickFacts=(...args)=>parser._poiKnowledgePickFacts(...args);
const paxSource=fs.readFileSync('passenger-voice.js','utf8');
function voiceContext(mission,dest){
 const e={window:{activePassenger:mission.passenger,MissionKnowledgeBriefingCore:core},currentMissionData:{...mission,poiName:dest.name,mission:mission.t,missionContract:mission._missionContractV4},localStorage:{getItem:()=>null},document:{getElementById:()=>({innerText:''})},_getMissionStory:()=>mission.story,_sanitizePaxSoftPoiStory:x=>x,_activeTaskDomain:()=> 'sightseeing_tour',_isPOIMission:()=>true,_normUrgencyPriority:()=> 'niedrig',_missionHasPax:()=>true,_personaNarrativeSeedAllowed:()=>true};
 for(const name of ['_activeBushPickupPassengerContract','_roleStyleHint','_personaPersonalityLabel','_personaSpeechSignature','_activeAptTrainingPlan','_aptArrivalContextLine','_poiSightseeingKnowledgeContextLine','_paxTargetProminenceLine','_paxVisualLandmarksLine','_activeMissionStoryFrame','_bushVoiceToneLine','_bushPickupPassengerPerspectiveLine','_poiKnowledgeQueueContextLine'])e[name]=()=>'';
 vm.createContext(e);for(const name of ['_baseContext','_inspectionMissionMeta','_domainDriftGuard'])vm.runInContext(extractOriginalFunction(paxSource,name),e);
 return JSON.parse(JSON.stringify({schema:voice.CONTEXT_SCHEMA,version:1,missionId:'live-sightseeing',taskDomain:'sightseeing_tour',strict:false,audioEnabled:false,baseContext:e._baseContext(),passenger:mission.passenger,missionData:{poiName:dest.name},knowledgeContext:mission.knowledgeContext,inspectionMeta:null,targetFacts:[],wikiText:''}));
}
async function speech(prompt){
 if(++requests>24)throw Error('Bounded live request limit');
 const r=await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent',{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},body:JSON.stringify({contents:[{parts:[{text:prompt}]}]}),signal:AbortSignal.timeout(40000)});
 if(!r.ok)throw Error('Gemini voice HTTP '+r.status);const d=await r.json();return d.candidates?.[0]?.content?.parts?.[0]?.text||'';
}
let observation=null;
try {
 const r=await fetch('https://aviationweather.gov/api/data/metar?ids=EDTL&format=json',{signal:AbortSignal.timeout(8000)});
 if(r.ok){const metar=(await r.json())[0];if(metar?.rawOb)observation={station:metar.icaoId,raw:metar.rawOb,source:'METAR',observedAt:new Date(metar.obsTime*1000).toISOString(),fetchedAt:new Date().toISOString(),freshness:'unknown',windDeg:typeof metar.wdir==='number'?metar.wdir:null,windKts:metar.wspd,gustKts:metar.wgst,visKm:typeof metar.visib==='number'?metar.visib*1.609344:null};}
}catch{}
report.scope='Four live ideas/writers and twelve live voice texts, current Wikipedia and optional METAR. Original browser adapter and serialized original voice prompts. No TTS, production mission mutation or simulator flight.';
report.weather=observation;report.missions=[];
const specs=[['Freiburg im Breisgau','city','group'],['Mainau','landmark','single'],['Schluchsee','water','lake'],['Gutmadingen','city','personal-no-sources']];
for(const [title,poiCategory,kind] of specs.filter(s=>!process.argv[3]||process.argv[3].split(',').includes(s[0]))){
 try {
  const wiki=await env._fetchWikiExtractByTitle(title),page=wiki?.page,p=page?.coordinates?.[0];if(!p)throw Error('Article coordinate missing '+title);
  const picked=parser._poiKnowledgePickFacts(wiki.extract,8,12),dest={name:page.title,lat:p.lat,lon:p.lon,poiCategory,tags:poiCategory==='city'?{place:kind==='group'?'city':'village'}:{},knowledgeContext:kind==='personal-no-sources'?null:{ok:true,status:'accept',title:page.title,exactTitle:true,sourceUrl:page.fullurl,distanceKm:0,fetchedAt:new Date().toISOString(),facts:picked.selected,extraFacts:picked.extra}};
  const savedWiki=env._fetchWikiExtractByTitle,savedNear=env._missionSightseeingFetchNearbyWikiLandmarks;
  if(kind==='personal-no-sources'){env._fetchWikiExtractByTitle=async()=>null;env._missionSightseeingFetchNearbyWikiLandmarks=async()=>[];}
  env.window.MissionPoiBriefingSharedBrowser={context:async()=>({id:'live-'+title,target:dest,facts:[],targetFacts:[],coverage:[],supplements:[],environmentFacts:[],terrain:{status:'missing'}}),enrichSelected:async c=>c};
  let mission;
  try {mission=await api.story({start,dest,profileId:'sightseeing_tour',contract:{route:{startName:start.name,targetName:dest.name,startIcao:'EDTW',targetIcao:'POI',distanceNm:Math.round(sharedCore.relation(start,dest).distanceM/1852*10)/10},weather:observation?{dep:{raw:observation},dest:{raw:observation}}:{}}});}
  finally {env._fetchWikiExtractByTitle=savedWiki;env._missionSightseeingFetchNearbyWikiLandmarks=savedNear;}
  const context=voiceContext(mission,dest);const row={kind,target:dest,mission,voices:[]};report.missions.push(row);save();
  for(const prompt of ['_poiInSightPrompt','_poiEntryPrompt','_poiSatisfiedPrompt']){
   const rendered=voice.render(context,{prompt,args:prompt==='_poiInSightPrompt'?[{mslFt:3500},3,4,'12 Uhr']:[{mslFt:3500}],detector:{dwellSec:240}});
   const text=await speech(rendered.prompt);row.voices.push({phase:prompt,prompt:rendered.prompt,text});
   context.baseContext+='\nBereits im Flug erzählt (nicht wiederholen): '+text;
   save();
  }
  core.remember(historyStore,'probe-'+title,mission.knowledgeBriefing);save();console.log('Completed '+kind+' / '+title+' / local places '+mission.knowledgeBriefing.observationPlaces.length);
 }catch(error){report.errors=report.errors||[];report.errors.push({title,error:String(error)});save();console.log('Failed '+title+': '+error);}
}
report.requests=requests;save();
