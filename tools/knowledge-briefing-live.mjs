// Bounded knowledge ideas/writers probe with fresh public article facts.
// No pilot data, live weather claim, audio generation or mutation of production data.
import fs from 'node:fs';
import vm from 'node:vm';
import core from '../mission-knowledge-briefing-core.js';
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
const report={promptVersion:core.PROMPT_VERSION};
const save=()=>fs.writeFileSync(output,JSON.stringify(report,null,2));
let requests=0;const parser=vm.createContext({}),app=fs.readFileSync('app.js','utf8');
for(const n of ['_missionExtractBalancedJsonObjectText','_missionParseJsonTextDetailed'])vm.runInContext(extractOriginalFunction(app,n),parser);
const localFetch=async(url,options)=>String(url).startsWith('obstacles/')?fs.existsSync(url)?new Response(fs.readFileSync(url)):new Response('',{status:404}):fetch(url,options);
const region={fetch:localFetch,Response,Blob,DecompressionStream,AbortController,URLSearchParams,setTimeout,clearTimeout};
vm.runInNewContext(fs.readFileSync('mission-private-context-core.js','utf8'),region);
const env={window:{MissionKnowledgeBriefingCore:core,MissionPoiBriefingSharedCore:sharedCore,MissionPrivateEpisodeV6:flightApi,MissionCharterIdeasCore:charter,MissionPrivateContextCore:region.MissionPrivateContextCore},localStorage:historyStore,AbortSignal,Response,Blob,DecompressionStream,TextDecoder,Uint8Array,fetch:localFetch,console,getSelectedAiApiKey:()=>'',normalizeMissionProposalChoice:x=>x,missionProposalCompactTarget:x=>x,missionProposalFormatRoute:()=>({label:'20.4 NM'}),getMissionAircraftCapabilitySnapshot:()=>({passengerCapacity:1}),fetchGeminiJsonWithFallback:async prompt=>{
 if(++requests>8)throw Error('One idea and one writer per mission only');report.prompts=report.prompts||[];report.prompts.push(prompt);save();
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
const specs=[['historian_guided_tour','Burg Hohenzollern'],['historian_guided_tour','Heuneburg'],['tour_guide_knowledge','Stuttgarter Fernsehturm'],['tour_guide_knowledge','Schwarzenbachtalsperre']];
report.scope='Four live Gemini ideas and writers using newly fetched Wikipedia extracts and article coordinates; weather deliberately unavailable; no audio or simulator test.';report.missions=[];
for(const [profileId,title] of specs){
 const url='https://de.wikipedia.org/w/api.php?'+new URLSearchParams({action:'query',format:'json',redirects:'1',prop:'extracts|coordinates|info',inprop:'url',explaintext:'1',titles:title});
 const r=await fetch(url,{signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error('Wikipedia HTTP '+r.status);const page=Object.values((await r.json()).query.pages)[0];const p=page.coordinates?.[0];if(!p)throw Error('Article coordinate missing: '+title);
 const selected=parser._poiKnowledgePickFacts(page.extract,8,12),dest={name:page.title,lat:p.lat,lon:p.lon,knowledgeContext:{ok:true,status:'accept',title:page.title,exactTitle:true,sourceUrl:page.fullurl,distanceKm:0,fetchedAt:new Date().toISOString(),facts:selected.selected,extraFacts:selected.extra}};
 env.window.MissionPoiBriefingSharedBrowser={context:async()=>({id:'live-'+title,target:dest,facts:[],targetFacts:[],coverage:[],supplements:[],environmentFacts:[],terrain:{status:'missing'}}),enrichSelected:async c=>c};
 const mission=await api.story({start,dest,profileId,contract:{route:{startName:start.name,targetName:dest.name,startIcao:'EDTW',targetIcao:'POI',distanceNm:Math.round(sharedCore.relation(start,dest).distanceM/1852*10)/10}}});
 report.missions.push(mission);core.remember(historyStore,'probe-'+title,mission.knowledgeBriefing);save();console.log('Completed '+profileId+' / '+title);
}
report.requests=requests;save();
