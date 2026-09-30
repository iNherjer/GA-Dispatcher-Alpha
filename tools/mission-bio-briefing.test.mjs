import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import core from '../mission-bio-briefing-core.js';
import shared from '../mission-poi-briefing-shared-core.js';
import charter from '../mission-charter-ideas-core.js';
import {extractOriginalFunction} from './extract-original-function.mjs';
const c={id:'poi:48:8',target:{name:'Studienziel',lat:48,lon:8,poiCategory:'forest'},targetCategory:'forest',radiusM:5556,facts:[],targetFacts:[],coverage:[],supplements:[],terrain:{status:'missing'}};
const idea={schema:core.IDEA_VERSION,targetId:c.id,targetName:c.target.name,taskDomain:'science_bio',client:{name:'Institut für Ökologie',kind:'research_institution'},situation:'Das Institut bereitet die nächste Feldkampagne vor.',scenarioDetails:['Eine frühere Stichprobe ließ die räumliche Verteilung offen.'],aerialObservation:{visibleCue:'Großflächige Vegetationsmuster',usefulObservation:'Zusammenhängende Muster für die Stichprobenauswahl einordnen',followup:'Am Boden Vegetation bestimmen'},studyFocus:'Wo ergänzen Stichproben die bisherige Studie?',outputUse:'Feldkampagne planen',person:{name:'Dr. Kim Berg',role:'Biologin'}};
const raw={targetId:c.id,title:'Die nächste Feldkampagne',story:'Kim Berg möchte die Vegetationsmuster für die Feldarbeit einordnen. Nach der Beobachtung kehrt ihr zurück.',greetingSpeaker:idea.person.name,greeting:'Hallo, ich möchte die Stichproben besser verteilen.',usedFactIds:[],report:{orientationIds:[]},memory:'Stichprobenauswahl durch Luftübersicht'};
function storage(){const m=new Map();return {getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v)};}
function fixture(){const i=core.validateIdea(idea,c),w=core.validateWriter(raw,i,c);Object.assign(w,shared.resolveWeather('',shared.prepareFlight({}).context));return core.mission(i,w,c);}
test('study identity and evidence references are bound; assessment remains biological',()=>{
 assert.throws(()=>core.validateIdea({...idea,taskDomain:'media_photo'},c));assert.throws(()=>core.validateIdea({...idea,targetId:'other'},c));
 assert.throws(()=>core.validateWriter({...raw,usedFactIds:['invented-forest']},idea,c));
 assert.match(core.writerPrompt(c,idea,[],shared.prepareFlight({})),/qualitative Einschätzung/);
 assert.match(core.voiceContext(fixture().bioBriefing),/Feldarbeit/);
});
test('selected idea is elaborated once; feature flag and route identity prevent accidental use',async()=>{
 const s=storage(),calls=[];const env={window:{MissionBioBriefingCore:core,MissionPoiBriefingSharedCore:shared,MissionCharterIdeasCore:charter,MissionPoiBriefingSharedBrowser:{context:async()=>structuredClone(c),enrichSelected:async x=>x}},localStorage:s,getMissionAircraftCapabilitySnapshot:()=>({passengerCapacity:1}),getSelectedAiApiKey:()=>'',normalizeMissionProposalChoice:x=>x,missionProposalCompactTarget:x=>x,missionProposalFormatRoute:()=>({label:'10 NM'}),fetchGeminiJsonWithFallback:async p=>{calls.push(p);return {parsed:p.includes('RAHMEN=')?{ideas:[idea]}:raw};}};
 vm.runInNewContext(fs.readFileSync('mission-bio-briefing-browser.js','utf8'),env);const b=env.window.MissionBioBriefingBrowser;
 assert.equal(b.enabled({profileId:'science_bio'}),true);s.setItem('ga_bio_briefing_v1','off');assert.equal(b.enabled({profileId:'science_bio'}),false);s.setItem('ga_bio_briefing_v1','on');assert.equal(b.enabled({profileId:'science_bio'}),true);assert.equal(b.enabled({profileId:'science_geo'}),false);assert.equal(b.enabled({profileId:'science_bio',followup:true}),false);
 const start={name:'Basis',lat:48.1,lon:8.1};const [choice]=await b.choices([c.target],{start});const m=await b.story({start,dest:c.target,proposal:choice.bioProposal});
 assert.equal(calls.length,2);assert.equal(m.bioBriefing.idea.studyFocus,idea.studyFocus);assert.equal(m.passenger.roleProfile,'science_field_v1');
 await assert.rejects(()=>b.story({start,dest:{...c.target,lat:49},proposal:choice.bioProposal}));assert.equal(calls.length,2);
});
test('real finalizer and cloud/quota storage preserve study and field role',()=>{
 const env=vm.createContext({window:{MissionBioBriefingCore:core},compactPoiChainForMission:x=>x});
 for(const [file,names] of [['app.js',['applyMissionTaskProfileToMission','missionMatchesTaskProfile','compactMissionObjectForQuotaStorage']],['sync.js',['_syncJsonClone','_syncCompactMissionObjectCore']]])for(const name of names)vm.runInContext(extractOriginalFunction(fs.readFileSync(file,'utf8'),name),env);
 const m=fixture();assert.equal(env.applyMissionTaskProfileToMission(m,true,'science_bio',m.pax,m.cargo).mission.s,m.s);assert.equal(env.missionMatchesTaskProfile(m,'science_bio',true),true);
 const restored=env._syncCompactMissionObjectCore(env.compactMissionObjectForQuotaStorage(m));assert.deepEqual(JSON.parse(JSON.stringify(restored.bioBriefing)),m.bioBriefing);assert.equal(restored.passenger.roleProfile,'science_field_v1');
});
test('history retains research question and air contribution with bounded unique IDs',()=>{
 const s=storage(),m=fixture();for(let i=0;i<20;i++)core.remember(s,'m'+i,m.bioBriefing);core.remember(s,'m19',m.bioBriefing);
 const rows=core.history(s);assert.equal(rows.length,12);assert.equal(rows.at(-1).studyFocus,idea.studyFocus);assert.deepEqual(rows.at(-1).aerialObservation,idea.aerialObservation);assert.ok(JSON.stringify(rows).length<=16000);
});

test('planned animal groups reach the mission, contract and restored storage',()=>{
 const feature='animal_sheep',context={...c,sceneCapabilities:{features:{[feature]:{animal:true}}}};
 const intent={summary:'Schafgruppe beobachten',visibleIdeas:['Eine Schafherde'],densityHint:'normal',notes:'',animalGroups:[{feature,count:20,purpose:'Raumnutzung beobachten'}]};
 const selected=core.validateIdea({...idea,sceneIntent:intent},context),written=core.validateWriter(raw,selected,context),m=core.mission(selected,written,context);
 assert.deepEqual(m.sceneIntent,intent);assert.deepEqual(m._missionContractV4.sceneIntent,intent);
 const env=vm.createContext({window:{MissionBioBriefingCore:core},compactPoiChainForMission:x=>x});
 vm.runInContext(extractOriginalFunction(fs.readFileSync('app.js','utf8'),'compactMissionObjectForQuotaStorage'),env);
 assert.deepEqual(JSON.parse(JSON.stringify(env.compactMissionObjectForQuotaStorage(m).sceneIntent)),intent);
});
test('studies of vegetation, water habitats and connectivity remain complete without scene objects',()=>{
 const studies=[
  {studyFocus:'Wie ergänzen sich die Vegetationsflächen?',visibleCue:'Großflächige Vegetationsmuster',usefulObservation:'Zusammenhängende Flächen einordnen',followup:'Vegetation am Boden bestimmen'},
  {studyFocus:'Wo sollten Uferproben verteilt werden?',visibleCue:'Belegte Wasser- und Uferflächen',usefulObservation:'Stichproben räumlich einordnen',followup:'Sedimentproben entnehmen'},
  {studyFocus:'Welche Flächenverbindungen verdienen weitere Untersuchung?',visibleCue:'Belegte Übergänge kartierter Flächennutzungen',usefulObservation:'Mögliche Habitatverbindungen einordnen',followup:'Durchlässigkeit im Gelände prüfen'}
 ];
 const store=storage();for(const [n,study]of studies.entries()){
  const selected=core.validateIdea({...idea,studyFocus:study.studyFocus,aerialObservation:{visibleCue:study.visibleCue,usefulObservation:study.usefulObservation,followup:study.followup},sceneIntent:{summary:'Beobachtung der vorhandenen Landschaft',visibleIdeas:[],densityHint:'none',notes:'',animalGroups:[]}},c);
  const m=core.mission(selected,core.validateWriter(raw,selected,c),c);
  assert.equal(m.sceneIntent.densityHint,'none');assert.deepEqual(m.sceneIntent.animalGroups,[]);assert.equal(m.passenger.taskDomain,'science_bio');core.remember(store,'study'+n,m.bioBriefing);
 }
 assert.equal(core.history(store).length,3);assert.equal(new Set(core.history(store).map(r=>r.studyFocus)).size,3);
});
test('biology capabilities omit ambiguous animal pools and retain real geographic evidence',async()=>{
 const env={window:{MissionBioBriefingCore:core,MissionPoiBriefingSharedBrowser:{context:async()=>({...c,facts:[{id:'mapped-meadow',kind:'meadow',role:'environment',name:'',distM:100,bearingDeg:90,source:'map'}]}),enrichSelected:async x=>x}},localStorage:storage()};
 for(const file of ['data/mission-scene-assets.js','data/mission-animal-scene-assets.js','mission-bio-briefing-browser.js'])vm.runInNewContext(fs.readFileSync(file,'utf8'),env);
 const context=await env.window.MissionBioBriefingBrowser.context({...c.target,poiCategory:'forest'});
 for(const key of ['waterfowl','wildlife_animals','animal_herd'])assert.equal(context.sceneCapabilities.features[key],undefined);
 for(const feature of Object.values(context.sceneCapabilities.features))for(const role of feature.roles||[])assert.ok(Array.isArray(feature.modelsByRole[role]),'Writer receives concrete models for '+role);
 const animals=Object.values(context.sceneCapabilities.features).filter(f=>f.animal);assert.equal(animals.length,116);assert.ok(animals.every(f=>f.placementSurfaces.includes('ground')));
 const frame=core.frame(context);assert.ok(frame.geographicContext);assert.deepEqual(frame.targetFacts,context.targetFacts);
});
test('idea generation is independent of the animal catalogue; chosen writer resolves optional wishes',()=>{
 const feature='animal_sheep',context={...c,sceneCapabilities:{features:{[feature]:{animal:true,label:'Hausschafe',placementSurfaces:['ground']}}}};
 const frame=core.frame(context);assert.equal(frame.sceneCapabilities,undefined);assert.equal(frame.sceneTools.optionalObjects,true);assert.ok(!core.ideaPrompt([frame]).includes(feature));
 const wish={summary:'Schafgruppe beobachten',visibleIdeas:['20 Hausschafe für die Untersuchung der Raumnutzung'],densityHint:'normal',notes:'',animalGroups:[]};
 const selected=core.validateIdea({...idea,sceneIntent:wish},context),resolved={...wish,animalGroups:[{feature,count:20,purpose:'Raumnutzung beobachten'}]};
 assert.ok(core.writerPrompt(context,selected,[],shared.prepareFlight({})).includes(feature));
 const m=core.mission(selected,core.validateWriter({...raw,sceneIntent:resolved},selected,context),context);
 assert.deepEqual(m.sceneIntent,resolved);assert.deepEqual(m.bioBriefing.idea.sceneIntent,resolved);assert.equal(m.bioBriefing.idea.studyFocus,selected.studyFocus);
 assert.throws(()=>core.validateWriter({...raw,sceneIntent:{...resolved,animalGroups:[{feature:'waterfowl',count:20,purpose:'Beobachtung'}]}},selected,context));
});

test('writer cannot attach animals to a chosen study without additional objects',()=>{
 const feature='animal_sheep',context={...c,sceneCapabilities:{features:{[feature]:{animal:true}}}},selected=core.validateIdea(idea,context);
 assert.throws(()=>core.validateWriter({...raw,sceneIntent:{summary:'Neue Schafherde',visibleIdeas:['Schafe'],densityHint:'normal',animalGroups:[{feature,count:20,purpose:'Neu hinzugefügt'}]}},selected,context));
 const m=core.mission(selected,core.validateWriter(raw,selected,context),context);assert.equal(m.sceneIntent.densityHint,'none');
});
test('picker tags and mapped environment reach the idea before generation; names supply no habitat claims',async()=>{
 const mapped={id:'environment-way-42',fact:'An der Oberfläche am Zielpunkt ist Wasserfläche kartiert.',kind:'Wasserfläche',containsTarget:true,source:'https://www.openstreetmap.org/way/42'},calls=[];
 const env={window:{MissionBioBriefingCore:core,MissionPoiBriefingSharedCore:shared,MissionPoiBriefingSharedBrowser:{context:async()=>structuredClone(c),enrichSelected:async x=>{calls.push('map');return {...x,environmentFacts:[mapped],targetFacts:[...x.targetFacts,mapped]};}}},localStorage:storage(),getMissionAircraftCapabilitySnapshot:()=>({passengerCapacity:1}),getSelectedAiApiKey:()=>'',normalizeMissionProposalChoice:x=>x,missionProposalCompactTarget:x=>x,missionProposalFormatRoute:()=>({label:'10 NM'}),fetchGeminiJsonWithFallback:async prompt=>{calls.push('idea');assert.ok(prompt.includes('environment-way-42'));assert.ok(prompt.includes('"water":"pond"'));return {parsed:{ideas:[{...idea,studyEvidence:{factIds:[mapped.id],relevance:'Studienfrage betrifft die kartierte Wasserfläche.'}}]}};}};
 vm.runInNewContext(fs.readFileSync('mission-bio-briefing-browser.js','utf8'),env);
 const dest={...c.target,poiCategory:'water',poiLookup:{selectedTags:{natural:'water',water:'pond',name:'Alpenwald'}}};
 const [choice]=await env.window.MissionBioBriefingBrowser.choices([dest],{start:c.target});
 assert.deepEqual(calls,['map','idea']);const context=choice.bioProposal.context;
 assert.deepEqual(JSON.parse(JSON.stringify(context.targetSelection.tags)),{natural:'water',water:'pond'});assert.equal(context.targetSelection.category,'water');assert.deepEqual(JSON.parse(JSON.stringify(context.environmentFacts)),[mapped]);
 assert.equal(choice.bioProposal.idea.studyEvidence.factIds[0],mapped.id);
 await assert.rejects(()=>env.window.MissionBioBriefingBrowser.context({...dest,poiCategory:'industry'}));
});
test('study evidence binds geography to actual source IDs and survives history',()=>{
 const evidence={id:'mapped-forest',fact:'Wald am Zielpunkt',source:'map'},context={...c,targetFacts:[evidence]},studyEvidence={factIds:[evidence.id],relevance:'Waldstruktur am gewählten Ziel untersuchen.'};
 const selected=core.validateIdea({...idea,studyEvidence},context);assert.deepEqual(selected.studyEvidence,studyEvidence);
 assert.throws(()=>core.validateIdea({...idea,studyEvidence:{...studyEvidence,factIds:['invented-river-mouth']}},context));
 const m=core.mission(selected,core.validateWriter(raw,selected,context),context),store=storage();core.remember(store,'evidence-test',m.bioBriefing);assert.deepEqual(core.history(store)[0].studyEvidence,studyEvidence);
});

test('orientation points cannot become ecological evidence or a replacement study target',()=>{
 const context={...c,facts:[{id:'hill-anchor',name:'Nebenberg',role:'orientation',tags:{natural:'peak'},relativeToTarget:{distanceM:2000,direction:'Osten'}}]};
 const frame=core.frame(context);assert.equal(frame.geographicContext.facts,undefined);assert.ok(!JSON.stringify(frame).includes('Nebenberg'));
 assert.throws(()=>core.validateIdea({...idea,studyEvidence:{factIds:['hill-anchor'],relevance:'Steiler Hangwald am See'}},context));
 const generic=core.validateIdea(idea,context);assert.deepEqual(generic.studyEvidence.factIds,[]);
});

test('nature selection retains explicit zoo context and marks empty tags as category-only',async()=>{
 const env={window:{MissionBioBriefingCore:core,MissionPoiBriefingSharedBrowser:{context:async()=>structuredClone(c),enrichSelected:async x=>x}},localStorage:storage()};
 vm.runInNewContext(fs.readFileSync('mission-bio-briefing-browser.js','utf8'),env);
 const zoo=await env.window.MissionBioBriefingBrowser.context({...c.target,poiLookup:{selectedTags:{tourism:'zoo',natural:'',landuse:''}}});
 assert.deepEqual(JSON.parse(JSON.stringify(zoo.targetSelection.tags)),{tourism:'zoo'});assert.equal(zoo.targetSelection.evidence,'picker-category-and-explicit-tags');assert.ok(zoo.targetFacts.some(f=>f.id==='target-selection-tags'&&f.fact.includes('zoo')));
 const unknown=await env.window.MissionBioBriefingBrowser.context({...c.target,poiLookup:{selectedTags:{natural:'',water:''}}});
 assert.equal(unknown.targetSelection.evidence,'category-only');assert.ok(!unknown.targetFacts.some(f=>f.id==='target-selection-tags'));
});
