import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import core from '../mission-mapping-briefing-core.js';
import narrative from '../mission-poi-followup-narrative-core.js';
import shared from '../mission-poi-briefing-shared-core.js';
import charter from '../mission-charter-ideas-core.js';
import voice from '../mission-poi-voice-core.js';
import adapters from '../mission-resume-adapters-core.js';
import followup from '../ga-tracker-client/tracker-mission-followup.js';
import {extractOriginalFunction} from './extract-original-function.mjs';
const app=fs.readFileSync('app.js','utf8'),copy=x=>JSON.parse(JSON.stringify(x));
const c={id:'mapping:48:8',target:{name:'Arbeitsziel',lat:48,lon:8},targetCategory:'dam',radiusM:5556,targetSelection:{category:'dam',tags:{waterway:'dam'}},targetFacts:[],facts:[],coverage:[],supplements:[],terrain:{status:'missing'}};
const idea={schema:core.IDEA_VERSION,targetId:c.id,targetName:c.target.name,taskDomain:'mapping_survey',client:{name:'Planungsverband',kind:'organization'},commission:'Der Verband aktualisiert seine Planungsgrundlage.',purpose:'Zusammenhängende Ansichten für die Planung',captureFocus:'Systematische Abdeckung des Zielbereichs',outputUse:'Abgleich im Planungsteam',scenarioDetails:[],personnelContext:'Die Operatorin begleitet den Auftrag.',person:{name:'Kim Berg',role:'Aufnahmeoperatorin',gender:'female'}};
const memory={summary:'Systematische Erfassung als Planungsgrundlage.',participants:[{name:idea.person.name,role:idea.person.role}],client:idea.client,openQuestions:['Welche Bereiche brauchen anschließend ergänzende Aufnahmen?'],possibleContinuations:[]};
const raw={targetId:c.id,title:'Neue Planungsgrundlage',story:'Du fliegst Kim zum Zielbereich. Die geplanten Bahnen liefern zusammenhängende Ansichten für den Verband. Danach kehrt ihr zur Basis zurück.',greetingSpeaker:idea.person.name,greeting:'Hallo, die Planer brauchen zusammenhängende Ansichten.',usedFactIds:[],report:{orientationIds:[]},memory};
const storage=()=>{const m=new Map();return {getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,String(v))};};
function originalHelpers(env={}){
 vm.createContext(env);
 const a=app.indexOf('const MISSION_SURVEY_PATTERN_DEFAULTS ='),z=app.indexOf('function missionSurveyPatternTargetPoint',a);
 vm.runInContext(app.slice(a,z),env);
 for(const name of ['getDestinationPoint','resolvePoiAltitudeTerrainFt','missionPoiAltitudeToleranceFt','minimumPoiWorkAltitudeFt','roundPoiWorkAltitudeFt','getPoiTaskPassengerDefaults','enforcePoiPassengerAltitudeRule','missionSurveyPatternTargetPoint','missionSurveyPatternCategory','missionSurveyPatternTypeForTarget','buildMissionSurveyPatternScanLines','buildMissionSurveyPatternSpec'])vm.runInContext(extractOriginalFunction(app,name),env);
 return env;
}
function pattern(category='dam'){
 const e=originalHelpers();return copy(e.buildMissionSurveyPatternSpec({missionData:{isPOI:true,targetName:c.target.name,targetLat:48,targetLon:8,poiCategory:category},passenger:{taskDomain:'mapping_survey',targetAltFt:3500}}));
}
function fixture(){const i=core.validateIdea(idea,c),w=core.validateWriter(raw,i,c);return core.mission(i,w,c,{},pattern());}
function browserEnv(){
 const calls=[],env=originalHelpers({window:{MissionMappingBriefingCore:core,MissionPoiFollowupNarrativeCore:narrative,MissionPoiBriefingSharedCore:shared,MissionCharterIdeasCore:charter,MissionPoiBriefingSharedBrowser:{context:async()=>copy(c),enrichSelected:async x=>x}},localStorage:storage(),getMissionAircraftCapabilitySnapshot:()=>({passengerCapacity:1}),getSelectedAiApiKey:()=>'',normalizeMissionProposalChoice:x=>x,missionProposalCompactTarget:x=>x,missionProposalFormatRoute:()=>({label:'20 NM'}),fetchGeminiJsonWithFallback:async p=>{calls.push(p);return {parsed:p.includes('RAHMEN=')?{ideas:[idea]}:raw};}});
 vm.runInContext(fs.readFileSync('mission-mapping-briefing-browser.js','utf8'),env);return {env,calls,api:env.window.MissionMappingBriefingBrowser};
}
test('original geometry selects dam scan and bridge orbit; writer receives that exact pattern',()=>{
 const scan=pattern(),orbit=pattern('bridge');assert.equal(scan.type,'north_south_scan');assert.equal(scan.scan.lines.length,5);assert.equal(orbit.type,'orbit');assert.equal(orbit.orbit.requiredTurns,3);
 for(const spec of [scan,orbit])assert.ok(core.writerPrompt(c,idea,[],shared.prepareFlight({}),spec).includes(JSON.stringify(core.patternContext(spec))));
 assert.throws(()=>core.writerPrompt(c,idea,[],shared.prepareFlight({}),null));
});
test('selected proposal is elaborated once and has the same final work altitude and geometry',async()=>{
 const {api,calls,env}=browserEnv(),start={name:'Basis',lat:48.2,lon:8.2},dest={...c.target,poiCategory:'dam'};
 const [choice]=await api.choices([dest],{start});const m=await api.story({start,dest,proposal:choice.mappingProposal,poiTerrainFt:2100,poiTerrainMaxFt:2450});
 assert.equal(calls.length,2);assert.equal(m.mappingBriefing.idea.purpose,idea.purpose);assert.equal(m.passenger.targetAltFt,3500);
 const normalized=env.enforcePoiPassengerAltitudeRule(m.passenger,true,2450,env.getPoiTaskPassengerDefaults({mission:m,isPOI:true,poiTerrainFt:2100,poiTerrainMaxFt:2450}));
 const final=env.buildMissionSurveyPatternSpec({missionData:{...m,missionId:'actual-id',targetName:c.target.name,targetLat:48,targetLon:8,poiCategory:'dam'},passenger:normalized});
 assert.deepEqual(copy(core.patternContext(final)),copy(core.patternContext(m.surveyPattern)));
 await assert.rejects(()=>api.story({start,dest:{...dest,lat:49},proposal:choice.mappingProposal}));assert.equal(calls.length,2);
});
test('followup enters idea and writer, keeps client, and never disappears through an initial-only gate',async()=>{
 const {api,calls}=browserEnv();const req={id:'request',poiFollowUp:true,followUpProfileId:'mapping_survey',followUpKind:'infra_damage_mapping',route:{targetRef:{kind:'poi',name:c.target.name,lat:48,lon:8}},narrativeMemory:{followUpNarrative:narrative.draft(memory)},infraInspectionOutcome:{outcome:'minor_damage'},temporalContext:{stayDays:2}};
 assert.equal(api.enabled({profileId:'mapping_survey',followup:true}),true);
 const m=await api.story({start:c.target,dest:{...c.target,poiCategory:'dam'},followup:req,poiTerrainFt:2000});
 for(const p of calls){assert.ok(p.includes('infra_damage_mapping'));assert.ok(p.includes('minor_damage'));assert.ok(p.includes('Planungsverband'));}
 assert.equal(m.mappingBriefing.continuation.requestId,'request');
 assert.throws(()=>core.validateIdea({...idea,client:{name:'Neuer Auftraggeber',kind:'company'}},{...c,continuation:narrative.context(req)}));
});
test('identity, references, capacity and flags fail before unrequested generation',async()=>{
 assert.throws(()=>core.validateIdea({...idea,targetId:'other'},c));assert.throws(()=>core.validateWriter({...raw,usedFactIds:['invented']},idea,c));
 const {api,calls,env}=browserEnv();env.getMissionAircraftCapabilitySnapshot=()=>({passengerCapacity:0});await assert.rejects(()=>api.choices([c.target],{start:c.target}));assert.equal(calls.length,0);
 for(const patch of [{profileId:'science_geo'},{isPOI:false},{planning:true},{bush:true},{aiModeEnabled:false},{category:'chain'}])assert.equal(api.enabled({profileId:'mapping_survey',...patch}),false);
});
test('invalid optional memory does not reject mission and cannot replace known participants or client',()=>{
 for(const bad of [null,{...memory,summary:'x'.repeat(701)},{...memory,client:{name:'Other'}},{...memory,participants:[]}]){const w=core.validateWriter({...raw,memory:bad},idea,c);assert.equal(w.memory,null);assert.equal(core.mission(idea,w,c,{},pattern()).followUpNarrative,null);}
 const m=fixture();assert.equal(m.followUpNarrative.completion,null);assert.equal(m.followUpNarrative.memory.client.name,idea.client.name);
});
test('real finalizer, compact cloud and resume adapter retain narrative, pattern and continuation',()=>{
 const m=fixture();m.followUpContinuation={...narrative.continuationFields({chain:{id:'chain',step:'damage_mapping',depth:1},narrativeMemory:{followUpNarrative:narrative.draft(memory)}}),requestId:'req'};
 const env=vm.createContext({window:{MissionMappingBriefingCore:core,MissionPoiFollowupNarrativeCore:narrative},compactPoiChainForMission:x=>x});
 for(const [file,names] of [['app.js',['applyMissionTaskProfileToMission','missionMatchesTaskProfile','compactMissionObjectForQuotaStorage']],['sync.js',['_syncJsonClone','_syncCompactMissionObjectCore']]])for(const name of names)vm.runInContext(extractOriginalFunction(fs.readFileSync(file,'utf8'),name),env);
 assert.equal(env.applyMissionTaskProfileToMission(m,true,'mapping_survey',m.pax,m.cargo).mission.s,m.s);assert.equal(env.missionMatchesTaskProfile(m,'mapping_survey',true),true);
 const restored=copy(env._syncCompactMissionObjectCore(env.compactMissionObjectForQuotaStorage(m)));
 for(const k of ['mappingBriefing','surveyPattern','followUpNarrative','followUpContinuation'])assert.deepEqual(restored[k],copy(m[k]));
 assert.equal(adapters.createDescriptor({missionId:'m',runtime:{missionId:'m'}},{currentMissionData:{...restored,missionId:'m'}}).primaryAdapter,'survey_pattern');
 assert.match(app,/followupIsPoiTarget \? window.MissionPoiFollowupNarrativeCore\?\.continuationFields\(followupSeed\)/);
});
test('history remembers actual assignment cores; prompts have no scenario examples or catalogue anchors',()=>{
 const s=storage(),m=fixture();for(let i=0;i<20;i++)core.remember(s,'m'+i,m.mappingBriefing);core.remember(s,'m19',m.mappingBriefing);const recent=core.history(s);assert.equal(recent.length,12);assert.ok(JSON.stringify(recent).length<=16000);
 const framed=core.frame({...c,facts:[{name:'Nearby bridge'}],sceneCapabilities:{forcedExample:'Marker model'}},recent);assert.ok(!JSON.stringify(framed).includes('Nearby bridge'));assert.ok(!JSON.stringify(framed).includes('Marker model'));assert.ok(core.ideaPrompt([framed]).includes(idea.purpose));
});
test('optional scenes stay optional; writer cannot invent a scene after scene-free choice',()=>{
 const scene={summary:'Begleitteam',visibleIdeas:['Zwei Teammitglieder'],densityHint:'sparse',notes:''};
 assert.throws(()=>core.validateWriter({...raw,sceneIntent:scene},core.validateIdea(idea,c),c));
 const i=core.validateIdea({...idea,sceneIntent:scene},c),m=core.mission(i,core.validateWriter({...raw,sceneIntent:scene},i,c),c,{},pattern());assert.deepEqual(m.sceneIntent,scene);assert.equal(m.passenger.taskDomain,'mapping_survey');
});
test('confirmed headless chain preserves narrative, known finding and target across mapping and photo',()=>{
 const now=Date.now(),control={phase:'closed',flags:{closed:true,groundStill:true},cargo:{summary:{failed:false}},flight:{missionRecord:{createdAt:now,distanceNm:20,distanceSource:'gps',durationSec:600,telemetrySampleCount:100},destination:{atDestination:true}}};
 const md={missionId:'initial',missionType:'poi',isPOI:true,mission:'Initiale Inspektion',story:'Inspektion für den Planungsverband',start:'EDTW',dest:'POI',initialStartLat:48.27,initialStartLon:8.42,initialTargetName:c.target.name,initialTargetLat:48,initialTargetLon:8,poiName:c.target.name,poiCategory:'dam',_appliedProfile:'inspection_infra',passenger:{name:'Kim',role:'Prüferin',taskDomain:'inspection_infra'},infraInspectionOutcome:{outcome:'minor_damage',createdAt:now-10000},followUpNarrative:narrative.draft(memory)};
 const closed=m=>followup.createForCompletedRun({missionId:m.missionId,executionAuthority:'tracker',resumeBundle:{missionState:{currentMissionData:copy(m)}}},control,now);
 const first=closed(md).requests[0];assert.equal(first.followUpProfileId,'mapping_survey');assert.equal(first.narrativeMemory.followUpNarrative.completion.result,'completed');
 const mapping={...fixture(),missionId:'mapping',start:'EDTW',dest:'POI',poiName:c.target.name,poiCategory:'dam',followUpContinuation:{...narrative.continuationFields(first),requestId:first.id,sourceKind:first.sourceKind,followUpKind:first.followUpKind,targetRef:first.route.targetRef,returnHomeRef:first.route.homeRef}};
 const second=closed(mapping).requests[0];assert.equal(second.followUpKind,'infra_repair_photo');assert.equal(second.chain.depth,2);assert.equal(second.chain.id,first.chain.id);assert.equal(second.narrativeMemory.followUpNarrative.memory.client.name,idea.client.name);assert.equal(second.narrativeMemory.followUpNarrative.identity.sourceMissionId,'mapping');assert.equal(second.route.targetRef.lat,48);assert.equal(second.infraInspectionOutcome.outcome,'minor_damage');
 const base=followup.service([],now).buildDispatchMission(second).mission;
 const photo={...base,missionId:'photo',followUpNarrative:narrative.draft({...memory,summary:'Dokumentation der Arbeiten als nächster Auftrag.'})};
 const third=closed(photo).requests[0];assert.equal(third.followUpKind,'infra_final_review');assert.equal(third.chain.depth,3);assert.equal(third.narrativeMemory.followUpNarrative.memory.summary,'Dokumentation der Arbeiten als nächster Auftrag.');
 const failed={...control,cargo:{summary:{failed:true}}};assert.equal(followup.createForCompletedRun({missionId:mapping.missionId,executionAuthority:'tracker',resumeBundle:{missionState:{currentMissionData:mapping}}},failed,now).requests.length,0);
 assert.equal(closed({...fixture(),missionId:'standalone'}).requests.length,0,'writer memory cannot create an unauthorized standalone followup');
});
test('legacy App request gets completion evidence once without duplicate or scheduling changes',()=>{
 const now=Date.now(),api=followup.service([],now),md={missionId:'legacy',missionType:'poi',isPOI:true,start:'EDTW',dest:'POI',initialStartLat:48.2,initialStartLon:8.2,initialTargetLat:48,initialTargetLon:8,poiName:c.target.name,poiCategory:'dam',_appliedProfile:'inspection_infra',passenger:{name:'Kim',role:'Prüferin',taskDomain:'inspection_infra'},infraInspectionOutcome:{outcome:'minor_damage',createdAt:now-1000},followUpNarrative:narrative.draft(memory)};
 api.create(md,{failed:false});const initial=copy(api.requests()[0]);assert.equal(initial.narrativeMemory.followUpNarrative.completion,null);
 const opts={completionRecord:{missionId:'legacy',completionId:'done',result:'completed',endedAt:now}};api.create(md,{failed:false},opts);api.create(md,{failed:false},opts);const req=api.requests()[0];assert.equal(api.requests().length,1);assert.equal(req.id,initial.id);assert.equal(req.eligibleAt,initial.eligibleAt);assert.equal(req.narrativeMemory.followUpNarrative.identity.completionId,'done');
});
test('repair-photo writer uses locked base and continuation rather than rerolling an initial photo idea',async()=>{
 const {api,calls,env}=browserEnv(),req={id:'photo-req',poiFollowUp:true,followUpKind:'infra_repair_photo',followUpProfileId:'media_photo',route:{targetRef:{kind:'poi',name:c.target.name,lat:48,lon:8}},narrativeMemory:{followUpNarrative:narrative.draft(memory)},infraInspectionOutcome:{outcome:'minor_damage'}};
 const base={passenger:{...idea.person,taskDomain:'media_photo'},pax:'1 PAX (Aufnahmeoperatorin)',cargo:'Kamera (30 lbs)',followUpContext:{storyFrame:{focusSubject:'Dokumentation des bekannten Befunds'}}};
 const m=await api.continuation({req,base,dest:{...c.target,poiCategory:'dam'}});assert.equal(calls.length,1);assert.match(calls[0],/infra_repair_photo/);assert.equal(m.passenger.taskDomain,'media_photo');assert.equal(narrative.ownsContinuation(m),true);assert.ok(narrative.voiceContext(m.poiContinuationBriefing).includes('minor_damage'));
});
test('new scripts are offline assets in dependency order',()=>{
 const html=fs.readFileSync('index.html','utf8'),sw=fs.readFileSync('sw.js','utf8');
 for(const f of ['mission-poi-followup-narrative-core.js','mission-mapping-briefing-core.js','mission-mapping-briefing-browser.js']){assert.ok(html.includes(f));assert.ok(sw.includes(f));}
 assert.ok(html.indexOf('mission-poi-followup-narrative-core.js')<html.indexOf('mission-mapping-briefing-core.js'));
});

 test('damaged optional memory preserves legacy context; completion belongs to its source mission',()=>{
 const req={poiFollowUp:true,source:{story:'Bekannter Auftrag'},narrativeMemory:{followUpNarrative:{schema:narrative.SCHEMA,memory:{}}}};
 assert.equal(narrative.context(req).legacySummary,'Bekannter Auftrag');
 const cyclic={schema:narrative.SCHEMA};cyclic.self=cyclic;assert.equal(narrative.normalize(cyclic),null);
 assert.equal(narrative.complete({missionId:'current'},{},{result:'completed',missionId:'other'}),null);
 });
