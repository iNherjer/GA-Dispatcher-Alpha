import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import core from '../mission-infra-briefing-core.js';
import shared from '../mission-poi-briefing-shared-core.js';
import charter from '../mission-charter-ideas-core.js';
import outcome from '../mission-infra-outcome-core.js';
import narrative from '../mission-poi-followup-narrative-core.js';
import mapping from '../mission-mapping-briefing-core.js';
import followup from '../ga-tracker-client/tracker-mission-followup.js';
import {extractOriginalFunction} from './extract-original-function.mjs';
const c={id:'poi:48.000000:8.000000',target:{name:'Testbrücke',lat:48,lon:8},targetCategory:'bridge',radiusM:5556,facts:[],targetFacts:[],coverage:[],supplements:[],terrain:{status:'missing'}};
const ideaInput={schema:core.IDEA_VERSION,targetId:c.id,targetName:c.target.name,taskDomain:'inspection_infra',client:{name:'Kommunaler Infrastrukturbetrieb',kind:'public_authority'},situation:'Der Betrieb plant ein Wartungsfenster.',scenarioDetails:['Ein Wartungstrupp meldet eine möglicherweise verschobene Randabdeckung.'],aerialAssessment:{visibleCue:'Größere verschobene Randbereiche',usefulConclusion:'Betroffenen Abschnitt eingrenzen',followup:'Befestigungen am Boden prüfen'},inspectionFocus:'Die Fachperson soll die sichtbaren Randbereiche einordnen.',decisionNeeded:'Welche Bereiche benötigen einen gezielten Bodencheck?',person:{name:'Ada Kurz',role:'Bauwerksprüferin'}};
const raw={targetId:c.id,title:'Vorbereitung des Wartungsfensters',story:'Der kommunale Betrieb beauftragt eine Sichtprüfung der Testbrücke. Ada Kurz prüft die sichtbaren Randbereiche und ordnet ein, wo ein Bodencheck nötig ist. Danach kehrt ihr zur Basis zurück.',greetingSpeaker:'Ada Kurz',greeting:'Hallo, ich möchte heute die Randbereiche für den Bodencheck eingrenzen.',usedFactIds:[],report:{orientationIds:[]}};
function storage(){const values=new Map();return {getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};}
function fixture(){const idea=core.validateIdea(ideaInput,c),written=core.validateWriter(raw,idea,c);Object.assign(written,shared.resolveWeather('',shared.prepareFlight({}).context));return core.mission(idea,written,c);}
function browser(writer=raw){const s=storage(),requests=[];const env={window:{MissionInfraBriefingCore:core,MissionPoiBriefingSharedCore:shared,MissionCharterIdeasCore:charter,MissionPoiBriefingSharedBrowser:{context:async()=>structuredClone(c),enrichSelected:async x=>x}},localStorage:s,getMissionAircraftCapabilitySnapshot:()=>({passengerCapacity:1}),getSelectedAiApiKey:()=>'',normalizeMissionProposalChoice:x=>x,missionProposalCompactTarget:x=>x,missionProposalFormatRoute:()=>({label:'10 NM'}),fetchGeminiJsonWithFallback:async prompt=>{requests.push(prompt);return {parsed:prompt.includes('RAHMEN=')?{ideas:[ideaInput]}:writer};}};vm.runInNewContext(fs.readFileSync('mission-infra-briefing-browser.js','utf8'),env);return {api:env.window.MissionInfraBriefingBrowser,s,requests};}
test('professional commission is structural; private clients, wrong domains and identities fail',()=>{
 const idea=core.validateIdea(ideaInput,c);assert.equal(idea.person.relationshipToPilot,'beauftragte Fachperson');
 for(const patch of [{client:{name:'Bekannter',kind:'private'}},{taskDomain:'media_photo'},{targetId:'other'}])assert.throws(()=>core.validateIdea({...ideaInput,...patch},c));
 assert.throws(()=>core.readIdea({ideas:[ideaInput,ideaInput]},c));
 assert.match(core.writerPrompt(c,idea,[],shared.prepareFlight({})),/fachliches Kurzfazit/);
 assert.doesNotMatch(core.writerPrompt(c,idea,[],shared.prepareFlight({})),/An Bord erfolgt keine Bewertung|Passagier macht Fotos oder Videos/);
});
test('initial single-target inspection is enabled by default and respects opt-out',()=>{
 const b=browser();assert.equal(b.api.enabled({profileId:'inspection_infra'}),true);b.s.setItem('ga_infra_briefing_v1','off');assert.equal(b.api.enabled({profileId:'inspection_infra'}),false);b.s.removeItem('ga_infra_briefing_v1');assert.equal(b.api.enabled({profileId:'inspection_infra'}),true);
 for(const patch of [{profileId:'media_photo'},{category:'chain'},{followup:true},{planning:true},{bush:true},{isPOI:false},{aiModeEnabled:false}])assert.equal(b.api.enabled({profileId:'inspection_infra',...patch}),false);
});
test('picker-selected professional idea goes to one writer, with unchanged target and decision',async()=>{
 const b=browser(),start={name:'Basis',lat:48.1,lon:8.1};
 const choices=await b.api.choices([{...c.target,poiCategory:'bridge'}],{start});
 const m=await b.api.story({start,dest:c.target,proposal:choices[0].infraProposal});
 assert.equal(b.requests.length,2);assert.equal(m.infraBriefing.idea.decisionNeeded,ideaInput.decisionNeeded);assert.equal(m.passenger.roleProfile,'technical_inspector_v1');
 assert.equal(m._missionContractV4.infraNarrativeHandoff.focus,ideaInput.inspectionFocus);assert.equal(m.inspectionOutcome,undefined);
 await assert.rejects(()=>b.api.story({start,dest:{...c.target,lat:49},proposal:choices[0].infraProposal}));
 await assert.rejects(()=>b.api.choices([{...c.target,poiChain:{points:[]}}],{start}));
 assert.equal(b.requests.length,2);
});
test('history preserves professional purpose and is bounded',()=>{const s=storage(),m=fixture();for(let i=0;i<20;i++)core.remember(s,'m'+i,m.infraBriefing);assert.equal(core.history(s).length,12);assert.equal(core.history(s).at(-1).decisionNeeded,ideaInput.decisionNeeded);});
test('existing finalizer and quota/cloud compaction preserve the new briefing and expert role',()=>{
 const env=vm.createContext({window:{MissionInfraBriefingCore:core},compactPoiChainForMission:x=>x});
 for(const [file,names] of [['app.js',['applyMissionTaskProfileToMission','missionMatchesTaskProfile','compactMissionObjectForQuotaStorage']],['sync.js',['_syncJsonClone','_syncCompactMissionObjectCore']]])for(const name of names)vm.runInContext(extractOriginalFunction(fs.readFileSync(file,'utf8'),name),env);
 const m=fixture();assert.equal(env.applyMissionTaskProfileToMission(m,true,'inspection_infra',m.pax,m.cargo).mission.s,m.s);assert.equal(env.missionMatchesTaskProfile(m,'inspection_infra',true),true);
 const saved=env.compactMissionObjectForQuotaStorage(m),download=env._syncCompactMissionObjectCore(saved);
 assert.deepEqual(JSON.parse(JSON.stringify(download.infraBriefing)),m.infraBriefing);assert.equal(download.passenger.roleProfile,'technical_inspector_v1');
});
test('existing inspection outcome service recognizes mission and creates a professional finding',()=>{
 const window={};outcome.createInfraOutcomeService({window,localStorage:storage(),document:{}});
 const m=fixture();assert.equal(window.missionInfraIsInspectionMission(m),true);
 const result=window.missionInfraEnsureInspectionOutcome(m,{outcome:'monitor'});
 assert.ok(result);assert.equal(result.followUpProfileId,'inspection_infra');
});

test('fictional construction details survive selection and storage without becoming geographic evidence',async()=>{
 const b=browser(),start={name:'Basis',lat:48.1,lon:8.1};
 const [choice]=await b.api.choices([{...c.target,poiCategory:'bridge'}],{start});
 const m=await b.api.story({start,dest:c.target,proposal:choice.infraProposal});
 assert.deepEqual(m.infraBriefing.idea.scenarioDetails,ideaInput.scenarioDetails);
 assert.deepEqual(m.infraBriefing.idea.aerialAssessment,ideaInput.aerialAssessment);
 assert.throws(()=>core.validateIdea({...ideaInput,aerialAssessment:{visibleCue:""}},c));
 assert.equal(m.inspectionOutcome,undefined);
 assert.throws(()=>core.validateIdea({...ideaInput,scenarioDetails:['']},c));
 assert.throws(()=>core.validateWriter({...raw,usedFactIds:['scenarioDetails']},m.infraBriefing.idea,c));
 const s=storage();core.remember(s,'fiction',m.infraBriefing);
 assert.deepEqual(core.history(s)[0].scenarioDetails,ideaInput.scenarioDetails);
 assert.deepEqual(core.history(s)[0].aerialAssessment,ideaInput.aerialAssessment);
});
test('writer accepts existing navigation evidence but rejects invented source IDs',()=>{
 const idea=core.validateIdea(ideaInput,c),context={...c,facts:[{id:'landmark-known',role:'orientation',name:'Bekannter Ort',tags:{place:'town'},relativeToTarget:{distanceM:500,direction:'Norden'},targetRelativeToFeature:{distanceM:500,direction:'Süden'}}]};
 assert.doesNotThrow(()=>core.validateWriter({...raw,usedFactIds:['landmark-known']},idea,context));
 assert.throws(()=>core.validateWriter({...raw,usedFactIds:['invented-detail']},idea,context));
});

test('inspection history reaches both stages with original purpose and deduplicated IDs',async()=>{
 const b=browser(),m=fixture(),start={name:'Basis',lat:48.1,lon:8.1};
 m.infraBriefing.writerMemory='Wartungsplanung durch räumliche Eingrenzung der Auffälligkeit.';
 core.remember(b.s,'previous',m.infraBriefing);core.remember(b.s,'previous',m.infraBriefing);
 const choices=await b.api.choices([{...c.target,poiCategory:'bridge'}],{start});
 await b.api.story({start,dest:c.target,proposal:choices[0].infraProposal});
 for(const rows of [JSON.parse(b.requests[0].split('RAHMEN=')[1])[0].recent,JSON.parse(b.requests[1].split('HISTORY=')[1])]){
  assert.equal(rows.length,1);assert.equal(rows[0].inspectionFocus,ideaInput.inspectionFocus);
  assert.equal(rows[0].decisionNeeded,ideaInput.decisionNeeded);assert.deepEqual(rows[0].aerialAssessment,ideaInput.aerialAssessment);
  assert.equal(rows[0].memory,m.infraBriefing.writerMemory);
 }
});


const continuationMemory={summary:'Der Infrastrukturbetrieb plant ein Wartungsfenster. Ada grenzt aus der Luft die gemeldete Auffälligkeit an der Testbrücke ein; der Befund steht noch aus.',participants:[{name:ideaInput.person.name,role:ideaInput.person.role}],client:ideaInput.client,openQuestions:[ideaInput.decisionNeeded],possibleContinuations:['Bei einem beobachtungswürdigen Befund dieselben Bereiche nach einigen Tagen erneut prüfen.']};
test('initial writer prepares structured continuity in its existing response without confirming a result',async()=>{
 const b=browser({...raw,memory:'Wartungsfenster vorbereiten.',continuationMemory}),start={name:'Basis',lat:48.1,lon:8.1};
 const [choice]=await b.api.choices([{...c.target,poiCategory:'bridge'}],{start});
 const m=await b.api.story({start,dest:c.target,proposal:choice.infraProposal});
 assert.equal(b.requests.length,2);assert.match(b.requests[1],/continuationMemory/);
 assert.equal(m.infraBriefing.writerMemory,'Wartungsfenster vorbereiten.');
 assert.deepEqual(m.followUpNarrative.memory,continuationMemory);
 assert.equal(m.followUpNarrative.completion,null);assert.equal(m.followUpNarrative.nextAssignment,null);
 assert.equal(m._missionContractV4.followUpNarrative,m.followUpNarrative);
 assert.equal(m._missionWriterV4Debug.memoryStatus,'accepted');
});
test('optional damaged or inconsistent memory preserves the accepted mission and uses legacy context',()=>{
 const idea=core.validateIdea(ideaInput,c);
 for(const value of [undefined,{...continuationMemory,summary:'x'.repeat(701)},{...continuationMemory,client:{...ideaInput.client,name:'Andere Firma'}},{...continuationMemory,participants:[{name:'Andere Person',role:ideaInput.person.role}]},{...continuationMemory,participants:[{name:ideaInput.person.name,role:'Fotografin'}]}]){
  const written=core.validateWriter({...raw,continuationMemory:value},idea,c),m=core.mission(idea,written,c);
  assert.equal(written.story,raw.story);assert.equal(m.followUpNarrative,null);assert.equal(written.memoryStatus,'invalid-optional-memory');
  const legacy=narrative.complete({...m,missionId:'legacy'},{followUpKind:'infra_recheck'},{missionId:'legacy',result:'completed'});
  assert.equal(legacy.status,'legacy-context');assert.equal(legacy.memory.client.name,ideaInput.client.name);
 }
});
test('inspection memory survives real compaction, confirmed Tracker completion and one recheck writer',async()=>{
 const idea=core.validateIdea(ideaInput,c),written=core.validateWriter({...raw,continuationMemory:{...continuationMemory,participants:[{name:'Disposition',role:'Auftraggeber'},...continuationMemory.participants]}},idea,c);
 const m=core.mission(idea,written,c);Object.assign(m,{missionId:'infra-first',start:'EDTW',initialStartLat:48.1,initialStartLon:8.1,initialTargetLat:48,initialTargetLon:8,poiName:c.target.name,poiCategory:'bridge'});
 const env=vm.createContext({window:{MissionInfraBriefingCore:core},compactPoiChainForMission:x=>x});
 for(const [file,names] of [['app.js',['compactMissionObjectForQuotaStorage']],['sync.js',['_syncJsonClone','_syncCompactMissionObjectCore']]])for(const name of names)vm.runInContext(extractOriginalFunction(fs.readFileSync(file,'utf8'),name),env);
 const saved=JSON.parse(JSON.stringify(env._syncCompactMissionObjectCore(env.compactMissionObjectForQuotaStorage(m))));
 assert.deepEqual(saved.followUpNarrative,m.followUpNarrative);
 const window={};outcome.createInfraOutcomeService({window,localStorage:storage(),document:{}});
 window.missionInfraEnsureInspectionOutcome(saved,{outcome:'monitor'});
 const run={missionId:saved.missionId,executionAuthority:'tracker',resumeBundle:{missionState:{currentMissionData:saved}}};
 const control={phase:'closed',flags:{closed:true,groundStill:true},cargo:{summary:{failed:false}},flight:{missionRecord:{createdAt:Date.now(),missionFailed:false}}};
 const result=followup.createForCompletedRun(run,control),req=result.requests[0];
 assert.equal(req.followUpKind,'infra_recheck');assert.equal(req.narrativeMemory.followUpNarrative.status,'writer-memory');
 assert.equal(req.narrativeMemory.followUpNarrative.identity.sourceMissionId,saved.missionId);
 assert.ok(req.narrativeMemory.followUpNarrative.identity.completionId);
 assert.equal(req.narrativeMemory.followUpNarrative.completion.result,'completed');
 assert.equal(req.infraInspectionOutcome.outcome,'monitor');
 assert.equal(followup.createForCompletedRun(run,{...control,cargo:{summary:{failed:true}}}).requests.length,0);
 const base=window.missionInfraBuildDispatchMission(req,{start:{icao:'EDTW',name:'Basis'}}).mission;
 assert.equal(base.passenger.name,ideaInput.person.name);assert.equal(base.passenger.role,ideaInput.person.role);assert.equal(base.passenger.roleProfile,'technical_inspector_v1');
 const legacyBase=window.missionInfraBuildDispatchMission({...req,narrativeMemory:{}},{}).mission;
 assert.equal(legacyBase.passenger.name,'Martin Seidel');
 const calls=[],writerEnv={window:{MissionMappingBriefingCore:mapping,MissionPoiFollowupNarrativeCore:narrative,MissionPoiBriefingSharedCore:shared,MissionCharterIdeasCore:charter,MissionPoiBriefingSharedBrowser:{context:async()=>structuredClone(c),enrichSelected:async x=>x}},localStorage:storage(),getSelectedAiApiKey:()=>'',fetchGeminiJsonWithFallback:async prompt=>{calls.push(prompt);return {parsed:{...raw,memory:continuationMemory}};}};
 vm.runInNewContext(fs.readFileSync('mission-mapping-briefing-browser.js','utf8'),writerEnv);
 const next=await writerEnv.window.MissionMappingBriefingBrowser.continuation({req,base,dest:{...c.target,poiCategory:'bridge'}});
 assert.equal(calls.length,1);assert.match(calls[0],/infra_recheck/);assert.ok(calls[0].includes(continuationMemory.summary));assert.ok(calls[0].includes(ideaInput.client.name));
 assert.equal(next.poiContinuationBriefing.continuation.knownFinding.outcome,'monitor');
 assert.equal(next.passenger.name,ideaInput.person.name);assert.equal(next.passenger.taskDomain,'inspection_infra');
 assert.equal(next.followUpNarrative.completion,null,'the next mission is not completed by its predecessor');
 assert.equal(next.followUpNarrative.memory.client.name,ideaInput.client.name);
});
test('browser loads shared narrative before the initial inspection writer',()=>{
 const html=fs.readFileSync('index.html','utf8');assert.ok(html.indexOf('mission-poi-followup-narrative-core.js')<html.indexOf('mission-infra-briefing-core.js'));
});


test('inspection ideas carry bounded source geography with directions and surface scope intact',()=>{
 const geography={...c,facts:[{id:'cover-west',role:'cover-nearby-only',tags:{landuse:'forest'},relativeToTarget:{distanceM:200,direction:'Westen'},targetRelativeToFeature:{distanceM:200,direction:'Osten'},source:'local-tile'}],environmentFacts:[{id:'surface',fact:'Wiesenfläche am Zielpunkt',scope:'target-environment',source:'recorded-osm',coversTarget:true,distanceM:0}],terrainEnvelope:{centerFt:976,maxFt:1736,radiusNm:1,sampleCount:100,source:'terrarium-area'}};
 const framed=core.frame(geography);assert.deepEqual(framed.geography,shared.sourceSnapshot(geography));
 assert.equal(framed.geography.facts[0].relativeToTarget.direction,'Westen');
 assert.equal(framed.geography.environmentFacts[0].coversTarget,true);
 assert.match(core.ideaPrompt([framed]),/Geltungsbereich/);
 assert.ok(core.writerPrompt(geography,core.validateIdea(ideaInput,c),[],shared.prepareFlight({})).includes(core.writerRules()));
 assert.match(core.writerPrompt(geography,core.validateIdea(ideaInput,c),[],shared.prepareFlight({})),/räumlichen Annahmen aus IDEE anhand von STORY_FACTS/);
 assert.deepEqual(core.frame(c).geography.environmentFacts,[]);
});
test('direct inspection enriches the selected target before its idea without enriching picker candidates',async()=>{
 const requests=[],enrich=[],store=storage(),window={MissionInfraBriefingCore:core,MissionPoiBriefingSharedCore:shared,MissionCharterIdeasCore:charter,MissionPoiBriefingSharedBrowser:{context:async()=>structuredClone(c),enrichSelected:async ctx=>{enrich.push(ctx.id);return {...ctx,environmentFacts:[{id:'surface',fact:'Wiese am Ziel',scope:'target-environment',source:'fixture'}],targetFacts:[...ctx.targetFacts,{id:'surface',fact:'Wiese am Ziel',scope:'target-environment',source:'fixture'}]};}}};
 const env={window,localStorage:store,getMissionAircraftCapabilitySnapshot:()=>({passengerCapacity:1}),getSelectedAiApiKey:()=>'',normalizeMissionProposalChoice:x=>x,missionProposalCompactTarget:x=>x,missionProposalFormatRoute:()=>({label:'10 NM'}),fetchGeminiJsonWithFallback:async p=>{requests.push(p);return {parsed:p.includes('RAHMEN=')?{ideas:[ideaInput]}:raw};}};
 vm.runInNewContext(fs.readFileSync('mission-infra-briefing-browser.js','utf8'),env);
 await window.MissionInfraBriefingBrowser.choices([{...c.target,poiCategory:'bridge'}],{start:{name:'Basis',lat:48.1,lon:8.1}});assert.equal(enrich.length,0);requests.length=0;
 await window.MissionInfraBriefingBrowser.story({start:{name:'Basis',lat:48.1,lon:8.1},dest:{...c.target,poiCategory:'bridge'}});
 const frames=JSON.parse(requests[0].split('RAHMEN=')[1]);assert.equal(frames[0].geography.environmentFacts[0].fact,'Wiese am Ziel');assert.equal(requests.length,2);assert.equal(enrich.length,1);
});


test('cached environment access keeps exact target and expiry without any provider call or cache write',async()=>{
 const facts=[{id:'surface',fact:'Wiese am Zielpunkt',scope:'target-environment',source:'recorded-osm'}],key=c.target.lat.toFixed(6)+','+c.target.lon.toFixed(6);let calls=0,writes=0;
 const cached=[[key,{facts,expires:Date.now()+60000}],['49.000000,8.000000',{facts:[{id:'wrong-target',fact:'Wald'}],expires:Date.now()+60000}],['47.000000,8.000000',{facts,expires:Date.now()-1}]];
 const env={window:{MissionPoiBriefingSharedCore:shared},localStorage:{getItem:()=>JSON.stringify(cached),setItem:()=>{writes++;}},fetch:()=>{calls++;throw Error('No requests allowed');}};
 vm.runInNewContext(fs.readFileSync('mission-poi-briefing-shared-browser.js','utf8'),env);
 const api=env.window.MissionPoiBriefingSharedBrowser,enriched=await api.cachedEnvironment(c);
 assert.deepEqual(JSON.parse(JSON.stringify(enriched.environmentFacts)),facts);assert.equal(enriched.targetFacts[0].id,'surface');
 for(const lat of [47,46]){const missing={...c,target:{...c.target,lat}};assert.equal(await api.cachedEnvironment(missing),missing);}
 assert.equal(calls,0);assert.equal(writes,0);assert.deepEqual(c.targetFacts,[]);
});
