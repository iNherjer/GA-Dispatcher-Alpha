// Bounded API integration check. Executes production App functions in the existing
// dry-run VM; supplied geography/runway facts, no UI, automatic research or MSFS.
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {setupContext,loadScript,initUiForRun} from './mission-pipeline-dryrun.mjs';
import {assertClean} from './gemini-migration-harness.mjs';

const live=process.argv.includes('--live');
const resume=process.argv.includes('--resume-validated-writer');
const output='analysis/gemini-parameter-migration/full-bush-release.json';
if(live&&fs.existsSync(output))throw Error('Existing report; refusing repeated API usage');
let key=process.env.GEMINI_API_KEY||'';
if(live&&!key&&process.env.GA_GEMINI_KEY_FILE){
 const lines=fs.readFileSync(process.env.GA_GEMINI_KEY_FILE,'utf8').split(/\r?\n/).map(x=>x.trim()).filter(x=>x&&!x.startsWith('#'));
 const line=lines.find(x=>/^GEMINI_API_KEY\s*=/.test(x));
 key=line?line.slice(line.indexOf('=')+1).trim().replace(/^(['"])(.*)\1$/,'$2'):(lines.length===1&&!lines[0].includes('=')?lines[0]:'');
}
if(live&&!key)throw Error('Missing local key');
const report={createdAt:new Date().toISOString(),scope:'Real API, complete production planner/contract/writer/chapter/scene functions and validators in VM. Supplied airport/runway fixtures; no automatic geo research, browser, simulator or audio playback.',requests:[]};
const save=()=>{if(live){fs.mkdirSync('analysis/gemini-parameter-migration',{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2));}};
if(resume){
 const prior=JSON.parse(fs.readFileSync('analysis/gemini-parameter-migration/full-bush-release-harness-error.json','utf8'));
 assert.equal(prior.planner?.status,'ready');assert.equal(prior.contract?.status,'ready');assert.equal(prior.mission?._missionWriterV4Debug?.writerAccepted,true);
 Object.assign(report,{planner:prior.planner,contract:prior.contract,mission:prior.mission,requests:prior.requests,reusedFrom:'full-bush-release-harness-error.json'});
}
const {context}=setupContext(20261007);
// Suppress UI/debug logs, including any accidental secret-bearing exception.
context.console={log(){},info(){},debug(){},warn(){},error(){}};
context.Response=Response;
let blocked=false;
const offlineFetch=context.fetch;
context.fetch=async(url,options={})=>{
 const parsed=new URL(String(url),'http://localhost');
 if(parsed.hostname!=='generativelanguage.googleapis.com')return offlineFetch(url,options);
 if(!live)throw Error('Preparation mode attempted network');
 if(blocked||report.requests.length>=10)throw Error('Live API request budget exhausted');
 const payload=JSON.parse(options.body);assertClean(payload.generationConfig||{});
 const entry={model:parsed.pathname.match(/models\/([^:]+)/)?.[1],config:payload.generationConfig,promptSha256:crypto.createHash('sha256').update(JSON.stringify(payload.contents)).digest('hex')};
 report.requests.push(entry);save();
 try{
  const response=await fetch(url,{...options,signal:options.signal?AbortSignal.any([options.signal,AbortSignal.timeout(60000)]):AbortSignal.timeout(60000)});
  const body=await response.clone().json();entry.status=response.status;entry.usage=body.usageMetadata;entry.finishReason=body.candidates?.[0]?.finishReason;
  if(!response.ok){entry.error=String(body.error?.message||'API error').replaceAll(key,'[redacted]').slice(0,600);if([400,401,403,429].includes(response.status))blocked=true;}
  save();return response;
 }catch(error){entry.error=String(error.message).replaceAll(key,'[redacted]');blocked=true;save();throw Error('Live network request failed');}
};
for(const file of ['datenbank.js','missions.js','data/mission-scene-assets.js','mission-private-context-core.js','mission-private-outing-core.js','mission-private-episode-v6.js','mission-private-return-core.js','mission-definition-core.js','mission-variety-core.js','mission-arrival-core.js','mission-runtime-core.js','mission-cargo-core.js','mission-poi-chain.js','map-route-edit-core.js','map-navigation-geometry.js','map-navigation-client.js','map-live-presentation.js','sync.js','aircraft-mission-capability-core.js','aircraft-mission-profile-core.js','airport-weather.js','mission-airport-information-core.js','mission-airport-information-browser.js','mission-environment-core.js','mission-environment-browser.js','mission-bush-narrative-core.js','mission-bush-narrative-browser.js','mission-bush-pickup-voice-core.js','mission-bush-execution-core.js','app.js'])loadScript(context,file);
initUiForRun(context,'bush:charter+bush_charter_strip',{pipelineV4:true,apiKey:live?key:'PREPARATION_ONLY'});
context.__key=key;
await vm.runInContext(`(async()=>{
 const start={icao:'KMYL',n:'McCall Municipal Airport',lat:44.8897,lon:-116.101,elevation:5024,country:'US'};
 const dest=buildAirportDispatchRecord('U60',{ident:'U60',name:'Big Creek Airport',lat:45.133202,lon:-115.321999,elevation:5743,country:'US'});
 const airportInfoContext=await MissionAirportInformationBrowser.load(dest,{persistent:false,snapshots:async()=>[{airports:[{...dest,runways:[{designator:'01/19',length:1082,width:34,surface:'Gras'}]}]}],fetch:async()=>new Response('{}')});
 const environmentContext=MissionEnvironmentCore.context(start,dest,[],new Date('2026-10-07T18:00Z'));
 __plannerContext={start,dest,isPOI:false,missionType:'bush',dispatchProfileId:'bush_charter_strip',missionPicker:{baseType:'bush',profile:'bush_charter_strip'},dist:36,selectedCategory:'charter',requestedCategory:'charter',passengerCount:1,paxText:'1 PAX',cargoText:'Karten und Markierungsband (25 lbs)',airportInfoContext,environmentContext};
 __bush=buildBushMissionSpec({profileId:'bush_charter_strip',startAirport:start,destAirport:dest,distNm:36});
})()`,context);
assert.equal(context.__bush.profileId,'bush_charter_strip');
if(!live){console.log('Preparation passed: production VM, Bush spec and supplied airport/environment context loaded; no API calls.');process.exit(0);}
save();
try{
 if(!resume)report.planner=await vm.runInContext('fetchMissionPlannerV4(__plannerContext)',context);save();
 assert.equal(report.planner?.status,'ready','Production planner rejected output');context.__plan=report.planner;
 if(!resume)report.contract=vm.runInContext('buildMissionContractV4({plannerContext:__plannerContext,plannerResult:__plan})',context);save();
 assert.equal(report.contract.status,'ready');assert.equal(report.contract.profile.id,'bush_charter_strip');context.__contract=report.contract;
 if(!resume)report.mission=await vm.runInContext('fetchMissionWriterV5({...__plannerContext,missionContractV4:__contract,bushSpec:__bush})',context);save();
 assert.ok(report.mission?.s?.length>=100,'Missing production writer story');
 assert.ok(report.mission.passenger?.name,'Missing charter passenger');
 assert.ok(!String(report.mission._source||'').includes('Local Fallback'),'Writer fell back');
 assert.ok(report.mission._missionWriterV4Debug.rawAiStory,'No actual AI writer story');
 context.__mission={...report.mission,bush:context.__bush,missionType:'bush',initialTargetLat:context.__plannerContext.dest.lat,initialTargetLon:context.__plannerContext.dest.lon};
 report.chapters=await vm.runInContext(`MissionBushNarrativeBrowser.generate({bush:__bush,passenger:__mission.passenger,start:__plannerContext.start,target:__plannerContext.dest,story:__mission.s,airportInfoContext:__plannerContext.airportInfoContext,environmentContext:__plannerContext.environmentContext},{tileKey:()=> 'fixture',tileFeatures:async()=>[],request:prompt=>fetchGeminiJsonWithFallback(prompt,__key,{promptVersion:'bush-narrative-release-live',timeoutMs:26000})})`,context);save();
 assert.equal(report.chapters.status,'ready','Production chapter validator rejected output');assert.ok(report.chapters.plan.events.length>=2);
 report.scene=await vm.runInContext(`composeMissionScenePlanV3WithGemini({missionData:__mission,missionContract:__contract,passenger:__mission.passenger,apiKey:__key,fallback:{targetScene:{kind:'none',features:[],requirements:[],roles:[],density:'none'},aptArrivalPlan:null}})`,context);save();
 assert.ok(!report.scene.debug?.error,'Production scene planner failed');
 assert.equal(report.scene.targetScene.kind,'none','Charter created unintended target scene');
 assert.equal(report.scene.targetScene.features?.length||0,0);
 assert.ok(report.requests.every(x=>x.status===200),'Unsuccessful API attempt');
 // Structural validation cannot prove prose geography/weather claims. Manual
 // factual review remains required; this result alone never authorizes release.
 report.technicalPassed=true;report.releaseEligible=null;save();console.log(JSON.stringify({technicalPassed:true,releaseEligible:null,requests:report.requests.length,model:report.requests.map(x=>x.model),planner:report.planner.status,profile:report.contract.profile.id,chapterCount:report.chapters.plan.events.length,sceneKind:report.scene.targetScene.kind,report:output}));
}catch(error){report.technicalPassed=false;report.releaseEligible=false;report.failure=String(error.message).replaceAll(key,'[redacted]');save();console.error(JSON.stringify({technicalPassed:false,failure:report.failure,requests:report.requests.length,report:output}));process.exitCode=1;}
