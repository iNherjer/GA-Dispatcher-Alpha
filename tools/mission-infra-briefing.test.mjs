import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import core from '../mission-infra-briefing-core.js';
import shared from '../mission-poi-briefing-shared-core.js';
import charter from '../mission-charter-ideas-core.js';
import outcome from '../mission-infra-outcome-core.js';
import {extractOriginalFunction} from './extract-original-function.mjs';
const c={id:'poi:48.000000:8.000000',target:{name:'Testbrücke',lat:48,lon:8},targetCategory:'bridge',radiusM:5556,facts:[],targetFacts:[],coverage:[],supplements:[],terrain:{status:'missing'}};
const ideaInput={schema:core.IDEA_VERSION,targetId:c.id,targetName:c.target.name,taskDomain:'inspection_infra',client:{name:'Kommunaler Infrastrukturbetrieb',kind:'public_authority'},situation:'Der Betrieb plant ein Wartungsfenster.',scenarioDetails:['Ein Wartungstrupp meldet eine möglicherweise verschobene Randabdeckung.'],aerialAssessment:{visibleCue:'Größere verschobene Randbereiche',usefulConclusion:'Betroffenen Abschnitt eingrenzen',followup:'Befestigungen am Boden prüfen'},inspectionFocus:'Die Fachperson soll die sichtbaren Randbereiche einordnen.',decisionNeeded:'Welche Bereiche benötigen einen gezielten Bodencheck?',person:{name:'Ada Kurz',role:'Bauwerksprüferin'}};
const raw={targetId:c.id,title:'Vorbereitung des Wartungsfensters',story:'Der kommunale Betrieb beauftragt eine Sichtprüfung der Testbrücke. Ada Kurz prüft die sichtbaren Randbereiche und ordnet ein, wo ein Bodencheck nötig ist. Danach kehrt ihr zur Basis zurück.',greetingSpeaker:'Ada Kurz',greeting:'Hallo, ich möchte heute die Randbereiche für den Bodencheck eingrenzen.',usedFactIds:[],report:{orientationIds:[]}};
function storage(){const values=new Map();return {getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};}
function fixture(){const idea=core.validateIdea(ideaInput,c),written=core.validateWriter(raw,idea,c);Object.assign(written,shared.resolveWeather('',shared.prepareFlight({}).context));return core.mission(idea,written,c);}
function browser(){const s=storage(),requests=[];const env={window:{MissionInfraBriefingCore:core,MissionPoiBriefingSharedCore:shared,MissionCharterIdeasCore:charter,MissionPoiBriefingSharedBrowser:{context:async()=>structuredClone(c),enrichSelected:async x=>x}},localStorage:s,getMissionAircraftCapabilitySnapshot:()=>({passengerCapacity:1}),getSelectedAiApiKey:()=>'',normalizeMissionProposalChoice:x=>x,missionProposalCompactTarget:x=>x,missionProposalFormatRoute:()=>({label:'10 NM'}),fetchGeminiJsonWithFallback:async prompt=>{requests.push(prompt);return {parsed:prompt.includes('RAHMEN=')?{ideas:[ideaInput]}:raw};}};vm.runInNewContext(fs.readFileSync('mission-infra-briefing-browser.js','utf8'),env);return {api:env.window.MissionInfraBriefingBrowser,s,requests};}
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
