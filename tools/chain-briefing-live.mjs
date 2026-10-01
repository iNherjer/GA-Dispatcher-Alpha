// Bounded infrastructure-chain ideas/writers probe using existing local OSM chains.
// No pilot data, live weather claim, audio generation or mutation of production data.
import fs from 'node:fs';
import vm from 'node:vm';
import {gunzipSync} from 'node:zlib';
import chainCore from '../mission-poi-chain.js';
import core from '../mission-chain-briefing-core.js';
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
const env={window:{MissionChainBriefingCore:core,MissionPoiBriefingSharedCore:sharedCore,MissionPrivateEpisodeV6:flightApi,MissionCharterIdeasCore:charter,MissionPrivateContextCore:region.MissionPrivateContextCore},localStorage:historyStore,AbortSignal,Response,Blob,DecompressionStream,TextDecoder,Uint8Array,fetch:localFetch,console,getSelectedAiApiKey:()=>'',normalizeMissionProposalChoice:x=>x,missionProposalCompactTarget:x=>x,missionProposalFormatRoute:()=>({label:'20.4 NM'}),getMissionAircraftCapabilitySnapshot:()=>({passengerCapacity:1}),fetchGeminiJsonWithFallback:async prompt=>{
 if(++requests>4)throw Error('One idea and one writer per mission only');report.prompts=report.prompts||[];report.prompts.push(prompt);save();
 const response=await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent',{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},body:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:{response_mime_type:'application/json'}}),signal:AbortSignal.timeout(40000)});
 report.httpStatus=response.status;save();if(!response.ok)throw Error('Gemini HTTP '+response.status);
 const body=await response.json();report.usage=body.usageMetadata;report.raw=body.candidates?.[0]?.content?.parts?.[0]?.text||'';report.rawResponses=report.rawResponses||[];report.rawResponses.push(report.raw);save();
 const parsed=parser._missionParseJsonTextDetailed(report.raw);report.parseMode=parsed.mode;return {parsed:parsed.parsed};
}};
vm.runInNewContext(fs.readFileSync('mission-poi-briefing-shared-browser.js','utf8'),env);
vm.runInNewContext(fs.readFileSync('data/mission-scene-assets.js','utf8'),env);
vm.runInNewContext(fs.readFileSync('mission-chain-briefing-browser.js','utf8'),env);
const api=env.window.MissionChainBriefingBrowser,start={name:'Winzeln-Schramberg Airport',lat:48.27917,lon:8.42833};
const allTiles=[];
for(let i=330;i<=332;i++)for(let j=451;j<=452;j++)for(const layer of ['core','infra','poi']){
 const path=`obstacles/${layer}-tiles/${i}/${j}.json.gz`;
 if(fs.existsSync(path))allTiles.push(JSON.parse(gunzipSync(fs.readFileSync(path))));
}
const prospects=chainCore.buildPoiChainProspects({dispatchStartLat:start.lat,dispatchStartLon:start.lon,minNM:5,maxNM:80,profileId:'infra_chain_recon',category:'all',maxGroupsPerTheme:4,stopAfterProspects:8,minPoints:3,maxPoints:3},{allTiles}).prospects;
const chains=[prospects.find(p=>p.chain.label==='Brückenkette Murg').chain,prospects.find(p=>p.chain.label==='Verkehrskorridor A 81').chain];
report.scope='Two live Gemini idea/writer runs through production browser adapter; original chain builder with local OSM tiles; no weather, audio or simulator test.';report.missions=[];
for(const chain of chains){
 const p=chain.points[0],dest={name:chain.label,lat:p.lat,lon:p.lon,poiChain:chain};
 env.window.MissionPoiBriefingSharedBrowser={context:async()=>({id:'live-'+chain.label,target:dest,facts:[],targetFacts:[],coverage:[],supplements:[],environmentFacts:[],terrain:{status:'missing'}})};
 const mission=await api.story({start,dest,contract:{route:{startName:start.name,targetName:dest.name,startIcao:'EDTW',targetIcao:'POI',distanceNm:Math.round(sharedCore.relation(start,dest).distanceM/1852*10)/10}}});
 report.missions.push(mission);core.remember(historyStore,'probe-'+chain.label,mission.chainBriefing);save();console.log('Completed '+chain.label);
}
report.requests=requests;save();
