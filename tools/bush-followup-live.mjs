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
const profile=process.argv.find(x=>x.startsWith('--profile='))?.slice(10)||'bush_scenic_hopper';
if(!['bush_charter_strip','bush_supply_strip','bush_scenic_hopper','bush_pickup_strip','bush_pickup_cargo','bush_recon_return'].includes(profile))throw Error('Unknown Bush profile');
const outcome=process.argv.find(x=>x.startsWith('--outcome='))?.slice(10)||'';
if(outcome&&!['minor_service','technician_needed'].includes(outcome))throw Error('Invalid controlled outcome');
const scenario=process.argv.find(x=>x.startsWith('--case='))?.slice(7)||'';
if(scenario&&!['missing','weather','missing-final','weather-final'].includes(scenario))throw Error('Unknown case');
const runSuffix=process.argv.find(x=>x.startsWith('--run='))?.slice(6)||'';
if(runSuffix&&!/^[a-z0-9-]{1,40}$/.test(runSuffix))throw Error('Invalid report suffix');
const attempt=runSuffix?'-'+runSuffix:process.argv.includes('--mast-proof')?'-mast-proof':process.argv.includes('--mast-info')?'-mast-info':process.argv.includes('--recon-info')?'-recon-info':process.argv.includes('--review-retry')?'-review-retry':process.argv.includes('--source-proof')?'-source-proof':process.argv.includes('--recon-review')?'-recon-review':process.argv.includes('--review')?'-review':process.argv.includes('--proof')?'-proof':resume?'-retry':process.argv.includes('--final')?'-final':process.argv.includes('--refined')?'-refined':'';
const output=`analysis/bush-followup-live-20261010/${profile}${outcome?'-'+outcome:''}${attempt}.json`;
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
for(const file of ['datenbank.js','missions.js','data/mission-scene-assets.js','mission-private-context-core.js','mission-private-outing-core.js','mission-private-episode-v6.js','mission-poi-briefing-shared-core.js','mission-private-return-core.js','mission-definition-core.js','mission-variety-core.js','mission-arrival-core.js','mission-runtime-core.js','mission-cargo-core.js','mission-poi-chain.js','map-route-edit-core.js','map-navigation-geometry.js','map-navigation-client.js','map-live-presentation.js','sync.js','aircraft-mission-capability-core.js','aircraft-mission-profile-core.js','airport-weather.js','mission-airport-information-core.js','mission-airport-information-browser.js','mission-environment-core.js','mission-environment-browser.js','mission-bush-narrative-core.js','mission-bush-narrative-browser.js','mission-bush-pickup-voice-core.js','mission-bush-execution-core.js','mission-poi-followup-narrative-core.js','mission-infra-outcome-core.js','mission-followup.js','app.js'])loadScript(context,file);
initUiForRun(context,'bush:all+'+profile,{pipelineV4:true,apiKey:live?key:'PREPARATION_ONLY'});
context.__key=key;
context.__scenario=scenario;
context.__profile=profile;
context.__mast=process.argv.includes('--mast-info')||process.argv.includes('--mast-proof');
context.__testSpeed=testSpeed;
context.__sourceProof=process.argv.includes('--source-proof');
await vm.runInContext(`(async()=>{
 const start={icao:'KMYL',n:'McCall Municipal Airport',lat:44.8897,lon:-116.101,elevation:5024,country:'US'};
 const dest=__mast?{n:'Test-Funkmast',name:'Test-Funkmast',lat:45.133202,lon:-115.321999,country:'US',man_made:'communications_tower'}:buildAirportDispatchRecord('U60',{ident:'U60',name:'Big Creek Airport',lat:45.133202,lon:-115.321999,elevation:5743,country:'US'});
 const airportInfoContext=__mast?null:await MissionAirportInformationBrowser.load(dest,{persistent:false,snapshots:async()=>[{airports:[{...dest,runways:[{designator:'01/19',length:1082,width:34,surface:'Gras'}]}]}],fetch:async()=>new Response('{}')});
 if(__sourceProof)airportInfoContext.sources.push({id:'supplied-test-notes',kind:'own-airport',title:'Gelieferte Testnotizen, keine externe Livequelle',extract:'Piste 01/19, 1082 Meter lang und 34 Meter breit, Gras. Platzhöhe 5743 Fuß MSL. Keine belegten Hindernis- oder lokalen Verfahrensangaben in dieser Testgrundlage.'});
 const departureAirportInfoContext=await MissionAirportInformationBrowser.load(start,{persistent:false,snapshots:async()=>[{airports:[{...start,runways:[{designator:'16/34',length:1864,width:23,surface:'Asphalt'}]}]}],fetch:async()=>new Response('{}')});
 const rows=__scenario.startsWith('weather')?[start,dest].map(p=>({location:{name:p.n,lat:p.lat,lon:p.lon},status:'available',source:'Open-Meteo-shaped TEST FIXTURE, no live observation',units:{temperature_2m:'°C',wind_speed_10m:'kn',cloud_cover:'%'},current:{validAt:'2026-10-08T08:00:00Z',values:{temperature_2m:14,wind_speed_10m:8,cloud_cover:75,precipitation:null,wind_direction_10m:null}},forecastNext6Hours:null,forecastNext72Hours:null})):[];
 const environmentContext=MissionEnvironmentCore.context(start,dest,rows,new Date('2026-10-08T08:30:00Z'));
 const envelope=buildBushMissionEnvelope({profileId:__profile,startAirport:start,destAirport:dest,distNm:36});
 __plannerContext={aircraftCapability:{cruiseSpeedKts:__testSpeed},start,dest,isPOI:false,missionType:'bush',dispatchProfileId:__profile,missionPicker:{baseType:'bush',profile:__profile},dist:36,selectedCategory:'all',requestedCategory:'all',passengerCount:envelope.mission.passenger?1:0,paxText:envelope.paxText,cargoText:envelope.cargoText,airportInfoContext:MissionAirportInformationBrowser.enabled({missionType:'bush',aiModeEnabled:true,isPOI:false,profileId:__profile,target:dest})?airportInfoContext:null,departureAirportInfoContext,environmentContext};
 if(__profile==='bush_recon_return')__plannerContext.bushReconContext={id:'test-recon-u60',target:{name:dest.n||dest.name,lat:dest.lat,lon:dest.lon},radiusM:5556,facts:[],targetFacts:__mast?[{id:'mast-purpose',fact:'Der Test-Funkmast dient der Funkversorgung eines fiktiven Arbeitsgebietes.',source:'supplied-test-fixture'}]:[],coverage:[{status:'fixture-only'}],supplements:[],terrain:{status:'missing'},airportInfoContext};
 __bush=envelope.mission.bush;
})()`,context);
assert.equal(context.__bush.profileId,profile);
if(!live){console.log('Preparation passed: production VM, Bush spec and supplied airport/environment context loaded; no API calls.');process.exit(0);}
report.scenario=scenario||'original';report.suppliedSourceBasis=context.MissionBushNarrativeCore.sourceBasis(context.__plannerContext);save();
try{
 if(!resume)report.planner=await vm.runInContext('fetchMissionPlannerV4(__plannerContext)',context);save();
 assert.equal(report.planner?.status,'ready','Production planner rejected output');context.__plan=report.planner;
 if(!resume)report.contract=vm.runInContext('buildMissionContractV4({plannerContext:__plannerContext,plannerResult:__plan})',context);save();
 assert.equal(report.contract.status,'ready');assert.equal(report.contract.profile.id,profile);context.__contract=report.contract;
 report.mission=await vm.runInContext('fetchMissionWriterV5({...__plannerContext,missionContractV4:__contract,bushSpec:__bush})',context);save();
 if(profile==='bush_recon_return'){assert.ok(report.contract.bushReconPlan,'Planner omitted Recon game plan');assert.equal(report.mission.bush?.success.minAreaTimeSec,report.contract.bushReconPlan.observationSeconds);assert.equal(report.mission.passenger?.targetDwellMin*60,report.contract.bushReconPlan.observationSeconds);}
 assert.ok(report.mission?.s?.length>=100,'Missing production writer story');
 // Cargo-only intentionally has no passenger speaker.
 assert.ok(!String(report.mission._source||'').includes('Local Fallback'),'Writer fell back');
 assert.ok(report.mission._missionWriterV4Debug.rawAiStory,'No actual AI writer story');

 if(profile!=='bush_recon_return'){assert.ok(report.mission.airportInformation?.flightBriefing,'Missing approach briefing');assert.ok(report.mission.airportInformation?.destinationInfo,'Missing destination field');}else {assert.ok(!report.mission.airportInformation,'Recon must not receive a landing destination field');assert.ok(report.mission.bushReconInfo?.text,'Missing recon information');}
 assert.ok(report.mission.departureAirportInformation?.departureInfo,'Missing departure field');

 const home={kind:'airport',icao:'KMYL',name:'McCall Municipal Airport',lat:44.8897,lon:-116.101};
 const target={kind:'airport',icao:'U60',name:'Big Creek Airport',lat:45.133202,lon:-115.321999};
 const decorate=(m,i)=>({...m,missionId:'live-bush-'+profile+'-'+outcome+'-'+Date.now()+'-'+i,missionType:'bush',start:'KMYL',dest:'U60',initialDest:'U60',initialStartLat:home.lat,initialStartLon:home.lon,initialTargetLat:target.lat,initialTargetLon:target.lon,initialTargetName:target.name,initialDist:36,bush:{...m.bush,homeRef:home,targetRef:target},missionContract:{...report.contract,bush:m.bush,bushFollowUpNarrative:m.bushFollowUpNarrative}});
 let current=decorate(report.mission,0);
 if(profile==='bush_recon_return')current.bushReconOutcome={outcome:outcome||'minor_service',createdAt:simulationNow};
 report.scope='Live production Planner → Contract → V5 Writer, plus original Tracker completion/follow-up domain functions. Public airport/runway fixtures; invented people and missions. Flight completions, Recon outcome and waiting periods simulated locally. No Cloud profiles, simulator, scene or audio playback.';
 report.steps=[{mission:current,planner:report.planner,contract:report.contract}];save();
 const close=m=>followup.createForCompletedRun({missionId:m.missionId,executionAuthority:'tracker',resumeBundle:{missionState:{currentMissionData:m}}},{phase:'closed',flags:{closed:true,groundStill:true},cargo:{summary:{failed:false}},flight:{missionRecord:{createdAt:simulationNow,durationSec:900,distanceNm:36,distanceSource:'gps',telemetrySampleCount:100},destination:{atDestination:true}}},simulationNow);
 const expectedSteps=profile==='bush_recon_return'&&outcome==='technician_needed'?2:1;
 for(let i=1;i<=expectedSteps;i++){
  const completed=close(current);
  assert.equal(completed.requests.length,1,'Missing expected follow-up '+i);
  const req=completed.requests[0];simulationNow=req.eligibleAt+3600000;
  context.__req=req;context.__step=i;
  vm.runInContext(`
   __followContext=missionFollowupBuildPipelineContext(__req);
   __base=missionFollowupBuildDispatchMission(__req).mission;
   __nextProfile=__req.followUpKind;
   __nextPlanner={...__plannerContext,dispatchProfileId:__nextProfile,missionPicker:{baseType:'bush',profile:__nextProfile},followUpContext:__followContext,missionTemporalContext:__req.temporalContext,passengerCount:__base.passenger?1:0,paxText:__base.pax,cargoText:__base.cargo};
   delete __nextPlanner.bushReconContext;
  `,context);
  report.pendingStep={i,request:req,pipelineContext:context.__followContext};save();
  const plan=await vm.runInContext('fetchMissionPlannerV4(__nextPlanner)',context);report.pendingStep.planner=plan;save();
  assert.equal(plan.status,'ready','Follow-up planner rejected step '+i);context.__nextPlan=plan;
  const contract=vm.runInContext('buildMissionContractV4({plannerContext:__nextPlanner,plannerResult:__nextPlan})',context);report.pendingStep.contract=contract;save();assert.equal(contract.status,'ready');context.__nextContract=contract;
  const generated=await vm.runInContext('fetchMissionWriterV5({...__nextPlanner,missionContractV4:__nextContract,bushSpec:__base.bush})',context);assert.ok(generated?.s?.length>=100,'Missing follow-up story');
  const continuation={...context.__base.followUpContinuation,chain:req.chain,narrativeMemory:req.narrativeMemory,temporalContext:req.temporalContext};
  current=decorate({...context.__base,...generated,followUpRequestId:req.id,followUpContinuation:continuation},i);
  current.missionContract={...contract,bush:current.bush,bushFollowUpNarrative:current.bushFollowUpNarrative};
  report.steps.push({request:req,pipelineContext:context.__followContext,planner:plan,contract,mission:current,simulatedFlightAt:simulationNow});delete report.pendingStep;save();
 }
 report.terminalRequests=close(current).requests;assert.equal(report.terminalRequests.length,0,'Unexpected extra follow-up');
 report.technicalPassed=true;save();
 fs.writeFileSync(output.replace(/\.json$/,'.md'),`# Bush-Live-Kette: ${profile} ${outcome}\n\n${report.scope}\n\n`+report.steps.map((x,i)=>`## ${i}: ${x.mission.t}\n\n${x.mission._missionWriterV4Debug?.rawAiStory||x.mission.s}\n\nPAX: ${x.mission.passenger?.name||'Kein Mitflieger'}\n\nBegrüßung: ${x.mission.passenger?.greetingText||'Keine'}\n\nZwischenentwicklung: ${x.pipelineContext?.bushContinuation?.betweenFlights?.summary||'Keine vorgelieferte Idee'}\n\nÜbergabe: ${JSON.stringify(x.mission.bushFollowUpNarrative?.memory||null)}\n\n`).join(''));
 console.log(JSON.stringify({technicalPassed:true,profile,outcome,requests:report.requests.length,steps:report.steps.map(x=>({title:x.mission.t,pax:x.mission.passenger?.name||null,memoryStatus:x.mission._missionWriterV4Debug?.bushMemoryStatus,followUpKind:x.request?.followUpKind})),terminalRequests:report.terminalRequests.length,report:output}));
}catch(error){report.technicalPassed=false;report.releaseEligible=false;report.failure=String(error.message).replaceAll(key,'[redacted]');save();console.error(JSON.stringify({technicalPassed:false,failure:report.failure,requests:report.requests.length,report:output}));process.exitCode=1;}
