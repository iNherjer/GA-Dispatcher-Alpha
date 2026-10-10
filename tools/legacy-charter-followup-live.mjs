// Bounded API integration check. Executes production App functions in the existing
// dry-run VM; supplied geography/runway facts, no UI, automatic research or MSFS.
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import followup from '../ga-tracker-client/tracker-mission-followup.js';
import assert from 'node:assert/strict';
import {setupContext,loadScript,initUiForRun} from './mission-pipeline-dryrun.mjs';
import {assertClean} from './gemini-migration-harness.mjs';

const live=process.argv.includes('--live');
const resumeFile=process.argv.find(x=>x.startsWith('--resume-report='))?.slice(16)||'';
const resume=!!resumeFile;
const testSpeed=Number(process.argv.find(x=>x.startsWith('--speed='))?.slice(8)||110);
if(!Number.isFinite(testSpeed)||testSpeed<60||testSpeed>250)throw Error('Invalid test speed');
const profile=process.argv.find(x=>x.startsWith('--profile='))?.slice(10)||'apt_charter';
if(!['apt_charter'].includes(profile))throw Error('Unknown Bush profile');
const outcome=process.argv.find(x=>x.startsWith('--outcome='))?.slice(10)||'';
if(outcome&&!['minor_service','technician_needed'].includes(outcome))throw Error('Invalid controlled outcome');
const scenario=process.argv.find(x=>x.startsWith('--case='))?.slice(7)||'';
if(scenario&&!['missing','weather','missing-final','weather-final'].includes(scenario))throw Error('Unknown case');
const runSuffix=process.argv.find(x=>x.startsWith('--run='))?.slice(6)||'';
if(runSuffix&&!/^[a-z0-9-]{1,40}$/.test(runSuffix))throw Error('Invalid report suffix');
const attempt=runSuffix?'-'+runSuffix:process.argv.includes('--mast-proof')?'-mast-proof':process.argv.includes('--mast-info')?'-mast-info':process.argv.includes('--recon-info')?'-recon-info':process.argv.includes('--review-retry')?'-review-retry':process.argv.includes('--source-proof')?'-source-proof':process.argv.includes('--recon-review')?'-recon-review':process.argv.includes('--review')?'-review':process.argv.includes('--proof')?'-proof':resume?'-retry':process.argv.includes('--final')?'-final':process.argv.includes('--refined')?'-refined':'';
const output=`analysis/legacy-charter-followup-live-20261010/${profile}${outcome?'-'+outcome:''}${attempt}.json`;
if(live&&fs.existsSync(output))throw Error('Existing report; refusing repeated API usage');
let key=process.env.GEMINI_API_KEY||'';
if(live&&!key&&process.env.GA_GEMINI_KEY_FILE){
 const lines=fs.readFileSync(process.env.GA_GEMINI_KEY_FILE,'utf8').split(/\r?\n/).map(x=>x.trim()).filter(x=>x&&!x.startsWith('#'));
 const line=lines.find(x=>/^GEMINI_API_KEY\s*=/.test(x));
 key=line?line.slice(line.indexOf('=')+1).trim().replace(/^(['"])(.*)\1$/,'$2'):(lines.length===1&&!lines[0].includes('=')?lines[0]:'');
}
if(live&&!key)throw Error('Missing local key');
const report={createdAt:new Date().toISOString(),scope:'Real API production planner/contract/writer functions and validators in VM; no chapter, scene or voice calls. Supplied airport/runway fixtures; no automatic geo research, browser, simulator or audio playback.',requests:[]};
const save=()=>{if(live){fs.mkdirSync(output.slice(0,output.lastIndexOf('/')),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2));}};
if(resume){const prior=JSON.parse(fs.readFileSync(resumeFile,'utf8'));assert.equal(prior.planner?.status,'ready');assert.equal(prior.contract?.profile?.id,profile);Object.assign(report,{planner:prior.planner,contract:prior.contract,reusedFrom:resumeFile});}
const {context}=setupContext(20261007);
let simulationNow=Date.parse('2026-10-10T08:00:00Z');
context.Date=class extends Date{constructor(...a){super(...(a.length?a:[simulationNow]));}static now(){return simulationNow;}};
// Suppress UI/debug logs, including any accidental secret-bearing exception.
context.console={log(){},info(){},debug(){},warn(){},error(){}};
context.Response=Response;
let blocked=false;
const offlineFetch=context.fetch;
context.fetch=async(url,options={})=>{
 const parsed=new URL(String(url),'http://localhost');
 if(parsed.hostname!=='generativelanguage.googleapis.com')return offlineFetch(url,options);
 if(!live)throw Error('Preparation mode attempted network');
 if(blocked||report.requests.length>=8)throw Error('Live API request budget exhausted');
 const payload=JSON.parse(options.body);assertClean(payload.generationConfig||{});
 const entry={model:parsed.pathname.match(/models\/([^:]+)/)?.[1],config:payload.generationConfig,promptSha256:crypto.createHash('sha256').update(JSON.stringify(payload.contents)).digest('hex')};
 const requestBegan=Date.now();
 report.requests.push(entry);save();
 try{
  const response=await fetch(url,{...options,signal:options.signal?AbortSignal.any([options.signal,AbortSignal.timeout(60000)]):AbortSignal.timeout(60000)});
  const body=await response.clone().json();entry.durationMs=Date.now()-requestBegan;entry.status=response.status;entry.usage=body.usageMetadata;entry.finishReason=body.candidates?.[0]?.finishReason;entry.rawResponseText=(body.candidates?.[0]?.content?.parts||[]).filter(p=>!p.thought).map(p=>p.text||'').join('');
  if(!response.ok){entry.error=String(body.error?.message||'API error').replaceAll(key,'[redacted]').slice(0,600);if([400,401,403,429].includes(response.status))blocked=true;}
  save();return response;
 }catch(error){entry.durationMs=Date.now()-requestBegan;entry.error=String(error.message).replaceAll(key,'[redacted]');blocked=true;save();throw Error('Live network request failed');}
};
for(const file of ['datenbank.js','missions.js','data/mission-scene-assets.js','mission-private-context-core.js','mission-private-outing-core.js','mission-private-episode-v6.js','mission-poi-briefing-shared-core.js','mission-private-return-core.js','mission-definition-core.js','mission-variety-core.js','mission-arrival-core.js','mission-runtime-core.js','mission-cargo-core.js','mission-poi-chain.js','map-route-edit-core.js','map-navigation-geometry.js','map-navigation-client.js','map-live-presentation.js','sync.js','aircraft-mission-capability-core.js','aircraft-mission-profile-core.js','airport-weather.js','mission-airport-information-core.js','mission-airport-information-browser.js','mission-environment-core.js','mission-environment-browser.js','mission-bush-narrative-core.js','mission-bush-narrative-browser.js','mission-bush-pickup-voice-core.js','mission-bush-execution-core.js','mission-poi-followup-narrative-core.js','mission-infra-outcome-core.js','mission-legacy-charter-narrative-core.js','mission-followup.js','app.js'])loadScript(context,file);

initUiForRun(context,'apt:chr+apt_charter',{pipelineV4:true,apiKey:live?key:'PREPARATION_ONLY'});
context.__profile=profile;
vm.runInContext(`
 const __home={kind:'airport',icao:'EDTW',name:'Winzeln-Schramberg',n:'Winzeln-Schramberg',lat:48.2792,lon:8.42833,elevation:2231,country:'DE'};
 const __target={kind:'airport',icao:'EDMA',name:'Augsburg',n:'Augsburg',lat:48.4252,lon:10.9318,elevation:1515,country:'DE'};
 __plannerContext={start:__home,dest:__target,isPOI:false,missionType:'apt',dispatchProfileId:'apt_charter',missionPicker:{baseType:'apt',category:'charter',profile:'apt_charter'},dist:101,selectedCategory:'charter',requestedCategory:'charter',passengerCount:1,paxText:'1 PAX',cargoText:'Persönliches Gepäck (25 lbs)',aircraftCapability:{cruiseSpeedKts:130},environmentContext:MissionEnvironmentCore.context(__home,__target,[],new Date('2026-10-10T08:00:00Z'))};
`,context);
report.scope='Existing legacy APT Charter production Planner V4 / Contract V4 / Writer V5, then original tracker completion and legacy pickup generation. No modern charterIdea or new handoff. Airport-coordinate fixtures, simulated completion/time; no cloud writes, UI, simulator or audio.';
if(!live){console.log('Legacy APT preparation passed; no network');process.exit(0);}
const sourceReportPath=process.argv.find(x=>x.startsWith('--source-report='))?.slice(16);
const sourceReport=sourceReportPath?JSON.parse(fs.readFileSync(sourceReportPath,'utf8')):null;
if(sourceReport)report.reusedSource=sourceReportPath;
try {
 report.planner=sourceReport?.planner||await vm.runInContext('fetchMissionPlannerV4(__plannerContext)',context);save();assert.equal(report.planner.status,'ready');context.__plan=report.planner;
 report.contract=sourceReport?.contract||vm.runInContext('buildMissionContractV4({plannerContext:__plannerContext,plannerResult:__plan})',context);save();assert.equal(report.contract.status,'ready');assert.equal(report.contract.profile.pickerCategory,'charter');context.__contract=report.contract;
 const main=sourceReport?.steps?.[0]?.mission||await vm.runInContext('fetchMissionWriterV5({...__plannerContext,missionContractV4:__contract})',context);assert.ok(main?.s?.length>=100);assert.ok(main._missionWriterV4Debug?.rawAiStory);
 const source={...main,mission:main.t,story:main.s,paxText:main.pax,initialCargoText:main.cargo,missionId:'live-legacy-charter-'+Date.now(),missionType:'apt',start:'EDTW',dest:'EDMA',initialDest:'EDMA',initialStartLat:48.2792,initialStartLon:8.42833,initialTargetLat:48.4252,initialTargetLon:10.9318,initialTargetName:'Augsburg',initialDist:101,_appliedProfile:'apt_charter',missionContract:report.contract,cargoText:main.cargo};
 assert.ok(!source.charterIdea);report.steps=[{mission:source,planner:report.planner,contract:report.contract}];save();
 const close=m=>followup.createForCompletedRun({missionId:m.missionId,executionAuthority:'tracker',resumeBundle:{missionState:{currentMissionData:m}}},{phase:'closed',flags:{closed:true,groundStill:true},cargo:{summary:{failed:false}},flight:{missionRecord:{createdAt:simulationNow,durationSec:2400,distanceNm:101,distanceSource:'gps',telemetrySampleCount:100},destination:{atDestination:true}}},simulationNow);
 const completed=close(source);assert.equal(completed.requests.length,1);const req=completed.requests[0];assert.equal(req.followUpKind,'apt_charter_pickup');assert.ok(!req.charterContinuation);report.request=req;simulationNow=req.eligibleAt+3600000;context.__req=req;
 vm.runInContext(`__followContext=missionFollowupBuildPipelineContext(__req);__base=missionFollowupBuildDispatchMission(__req).mission;__nextPlanner={...__plannerContext,dispatchProfileId:'apt_charter_pickup',missionPicker:{baseType:'apt',category:'charter',profile:'apt_charter_pickup'},followUpContext:__followContext,missionTemporalContext:__req.temporalContext,passengerCount:1,paxText:__base.pax,cargoText:__base.cargo};`,context);
 report.pipelineContext=context.__followContext;report.dispatchBase=context.__base;save();
 const plan=await vm.runInContext('fetchMissionPlannerV4(__nextPlanner)',context);report.followupPlanner=plan;save();assert.equal(plan.status,'ready');context.__nextPlan=plan;
 const contract=vm.runInContext('buildMissionContractV4({plannerContext:__nextPlanner,plannerResult:__nextPlan})',context);report.followupContract=contract;save();assert.equal(contract.status,'ready');context.__nextContract=contract;
 const generated=await vm.runInContext('fetchMissionWriterV5({...__nextPlanner,missionContractV4:__nextContract,bushSpec:__base.bush})',context);assert.ok(generated?.s?.length>=100);assert.ok(generated._missionWriterV4Debug?.rawAiStory);
 const appSource=fs.readFileSync('app.js','utf8');
 const finalizerStart=appSource.indexOf("        if (!useCharterContinuation && m && followupDispatchMission?.mission && followupDispatchProfileId === 'apt_charter_pickup') {");
 const finalizerEnd=appSource.indexOf('        } else if',finalizerStart);assert.ok(finalizerStart>=0&&finalizerEnd>finalizerStart);
 context.__generated=generated;vm.runInContext(`__finalized=(function(m){const useCharterContinuation=false,followupDispatchMission={mission:__base},followupDispatchProfileId='apt_charter_pickup';let paxText='',cargoText='';${appSource.slice(finalizerStart,finalizerEnd)}\n}\nreturn m;})(__generated);`,context);
 report.writerBeforeFinalization=generated;
 const next={...context.__base,...context.__finalized,missionId:source.missionId+'-pickup',followUpRequestId:req.id,followUpContinuation:context.__base.followUpContinuation,missionContract:contract};
 report.steps.push({mission:next,planner:plan,contract});report.terminalRequests=close(next).requests;assert.equal(next.passenger.name,source.passenger.name);assert.equal(report.terminalRequests.length,0);report.technicalPassed=true;save();
 fs.writeFileSync(output.replace(/\.json$/,'.md'),`# Legacy APT Charter: Live-Baseline\n\n${report.scope}\n\n`+report.steps.map((x,i)=>`## ${i}: ${x.mission.t}\n\n${x.mission._missionWriterV4Debug.rawAiStory}\n\nPAX: ${x.mission.passenger.name}\n\nCargo: ${x.mission.cargo}\n\nBegrüßung: ${x.mission.passenger.greetingText}\n\n`).join('')+`## Vorhandene Übergabe\n\n${JSON.stringify(req.narrativeMemory,null,2)}\n`);
 console.log(JSON.stringify({technicalPassed:true,requests:report.requests.length,stayDays:req.temporalContext?.stayDays,steps:report.steps.map(x=>({title:x.mission.t,pax:x.mission.passenger.name})),report:output}));
}catch(error){report.technicalPassed=false;report.failure=String(error.message).replaceAll(key,'[redacted]');save();console.error(JSON.stringify({technicalPassed:false,failure:report.failure,requests:report.requests.length,report:output}));process.exitCode=1;}
