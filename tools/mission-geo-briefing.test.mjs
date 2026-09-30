import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import core from '../mission-geo-briefing-core.js';
import shared from '../mission-poi-briefing-shared-core.js';
import charter from '../mission-charter-ideas-core.js';
import {extractOriginalFunction} from './extract-original-function.mjs';
const c={id:'poi:48:8',target:{name:'Studienziel',lat:48,lon:8,poiCategory:'mountain'},targetCategory:'mountain',radiusM:5556,facts:[],targetFacts:[],coverage:[],supplements:[],terrain:{status:'missing'}};
const idea={studyEvidence:{factIds:[],relevance:'Erkundende Übersicht am ausgewählten Geländeziel.'},schema:core.IDEA_VERSION,targetId:c.id,targetName:c.target.name,taskDomain:'science_geo',client:{name:'Institut für Geowissenschaften',kind:'research_institution'},situation:'Das Institut bereitet die nächste Feldkampagne vor.',scenarioDetails:['Eine frühere Stichprobe ließ die räumliche Verteilung offen.'],aerialObservation:{visibleCue:'Großflächige Geländeformen',usefulObservation:'Zusammenhängende Muster für die Stichprobenauswahl einordnen',followup:'Am Boden Formen im Gelände überprüfen'},studyFocus:'Wo ergänzen Stichproben die bisherige Studie?',outputUse:'Feldkampagne planen',person:{name:'Dr. Kim Berg',role:'Geologin',gender:'female'}};
const raw={targetId:c.id,title:'Die nächste Feldkampagne',story:'Kim Berg möchte die Geländeformen für die Feldarbeit einordnen. Nach der Beobachtung kehrt ihr zurück.',greetingSpeaker:idea.person.name,greeting:'Hallo, ich möchte die Stichproben besser verteilen.',usedFactIds:[],report:{orientationIds:[]},memory:'Stichprobenauswahl durch Luftübersicht'};
function storage(){const m=new Map();return {getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v)};}
function fixture(){const i=core.validateIdea(idea,c),w=core.validateWriter(raw,i,c);Object.assign(w,shared.resolveWeather('',shared.prepareFlight({}).context));return core.mission(i,w,c);}
test('study identity and evidence references are bound; assessment remains geological',()=>{
 assert.throws(()=>core.validateIdea({...idea,taskDomain:'media_photo'},c));assert.throws(()=>core.validateIdea({...idea,targetId:'other'},c));
 assert.throws(()=>core.validateWriter({...raw,usedFactIds:['invented-forest']},idea,c));
 assert.match(core.writerPrompt(c,idea,[],shared.prepareFlight({})),/qualitative Übersicht/);
 assert.match(core.voiceContext(fixture().geoBriefing),/Feldarbeit/);
});
test('selected idea is elaborated once; feature flag and route identity prevent accidental use',async()=>{
 const s=storage(),calls=[];const env={window:{MissionGeoBriefingCore:core,MissionPoiBriefingSharedCore:shared,MissionCharterIdeasCore:charter,MissionPoiBriefingSharedBrowser:{context:async()=>structuredClone(c),enrichSelected:async x=>x}},localStorage:s,getMissionAircraftCapabilitySnapshot:()=>({passengerCapacity:1}),getSelectedAiApiKey:()=>'',normalizeMissionProposalChoice:x=>x,missionProposalCompactTarget:x=>x,missionProposalFormatRoute:()=>({label:'10 NM'}),fetchGeminiJsonWithFallback:async p=>{calls.push(p);return {parsed:p.includes('RAHMEN=')?{ideas:[idea]}:raw};}};
 vm.runInNewContext(fs.readFileSync('mission-geo-briefing-browser.js','utf8'),env);const b=env.window.MissionGeoBriefingBrowser;
 assert.equal(b.enabled({profileId:'science_geo'}),true);s.setItem('ga_geo_briefing_v1','off');assert.equal(b.enabled({profileId:'science_bio'}),false);s.setItem('ga_geo_briefing_v1','on');assert.equal(b.enabled({profileId:'science_geo'}),true);assert.equal(b.enabled({profileId:'science_bio'}),false);assert.equal(b.enabled({profileId:'science_geo',followup:true}),false);
 const start={name:'Basis',lat:48.1,lon:8.1};const [choice]=await b.choices([c.target],{start});const m=await b.story({start,dest:c.target,proposal:choice.geoProposal});
 assert.equal(calls.length,2);assert.equal(m.geoBriefing.idea.studyFocus,idea.studyFocus);assert.equal(m.passenger.roleProfile,'science_field_v1');
 await assert.rejects(()=>b.story({start,dest:{...c.target,lat:49},proposal:choice.geoProposal}));assert.equal(calls.length,2);
});
test('real finalizer and cloud/quota storage preserve study and field role',()=>{
 const env=vm.createContext({window:{MissionGeoBriefingCore:core},compactPoiChainForMission:x=>x});
 for(const [file,names] of [['app.js',['applyMissionTaskProfileToMission','missionMatchesTaskProfile','compactMissionObjectForQuotaStorage']],['sync.js',['_syncJsonClone','_syncCompactMissionObjectCore']]])for(const name of names)vm.runInContext(extractOriginalFunction(fs.readFileSync(file,'utf8'),name),env);
 const m=fixture();assert.equal(env.applyMissionTaskProfileToMission(m,true,'science_geo',m.pax,m.cargo).mission.s,m.s);assert.equal(env.missionMatchesTaskProfile(m,'science_geo',true),true);
 const restored=env._syncCompactMissionObjectCore(env.compactMissionObjectForQuotaStorage(m));assert.deepEqual(JSON.parse(JSON.stringify(restored.geoBriefing)),m.geoBriefing);assert.equal(restored.passenger.roleProfile,'science_field_v1');
});
test('history retains research question and air contribution with bounded unique IDs',()=>{
 const s=storage(),m=fixture();for(let i=0;i<20;i++)core.remember(s,'m'+i,m.geoBriefing);core.remember(s,'m19',m.geoBriefing);
 const rows=core.history(s);assert.equal(rows.length,12);assert.equal(rows.at(-1).studyFocus,idea.studyFocus);assert.deepEqual(rows.at(-1).aerialObservation,idea.aerialObservation);assert.ok(JSON.stringify(rows).length<=16000);
});


test('geology ideas contain only geological target evidence, not navigation anchors or seeded scenarios',()=>{
 const context={...c,targetFacts:[{id:'peak',fact:'Kartierter Gipfel',source:'map'}],facts:[{id:'nearby',name:'Nebenbrücke'}]};
 assert.ok(!JSON.stringify(core.frame(context)).includes('Nebenbrücke'));
 assert.throws(()=>core.validateIdea({...idea,studyEvidence:{factIds:['nearby'],relevance:'Brücke'}},context));
 assert.throws(()=>core.readIdea({ideas:[idea,idea]},c));
 const p=core.ideaPrompt([core.frame(context)]);assert.ok(!p.includes('Dr. Mira Hahn'));assert.match(p,/keine vorgegebenen Studienbeispiele/);
});
test('selected geology context preserves tags and allows only existing target categories',async()=>{
 const env={window:{MissionGeoBriefingCore:core,MissionPoiBriefingSharedBrowser:{context:async()=>structuredClone(c),enrichSelected:async x=>x}},localStorage:storage()};
 vm.runInNewContext(fs.readFileSync('mission-geo-briefing-browser.js','utf8'),env);
 for(const category of ['mountain','dam','water']){const context=await env.window.MissionGeoBriefingBrowser.context({...c.target,poiCategory:category,poiLookup:{selectedTags:{natural:'peak',ele:'1200',name:'Not an evidence'}}});assert.equal(context.targetSelection.category,category);assert.equal(context.targetSelection.tags.ele,'1200');assert.equal(context.targetSelection.tags.name,undefined);}
 await assert.rejects(()=>env.window.MissionGeoBriefingBrowser.context({...c.target,poiCategory:'industry'}));
});
test('offline assets and load order include geology after shared dependencies',()=>{
 const html=fs.readFileSync('index.html','utf8'),sw=fs.readFileSync('sw.js','utf8');
 for(const file of ['mission-geo-briefing-core.js','mission-geo-briefing-browser.js']){assert.ok(html.includes(file));assert.ok(sw.includes(file));assert.ok(html.indexOf('mission-poi-briefing-shared-core.js')<html.indexOf(file));}
});

test('both stages receive remembered study cores and aircraft capacity blocks calls',async()=>{
 const store=storage(),calls=[];core.remember(store,'previous',fixture().geoBriefing);
 const env={window:{MissionGeoBriefingCore:core,MissionPoiBriefingSharedCore:shared,MissionCharterIdeasCore:charter,MissionPoiBriefingSharedBrowser:{context:async()=>structuredClone(c),enrichSelected:async x=>x}},localStorage:store,getMissionAircraftCapabilitySnapshot:()=>({passengerCapacity:1}),getSelectedAiApiKey:()=>'',normalizeMissionProposalChoice:x=>x,missionProposalCompactTarget:x=>x,missionProposalFormatRoute:()=>({label:'10 NM'}),fetchGeminiJsonWithFallback:async p=>{calls.push(p);assert.ok(p.includes(idea.studyFocus));return {parsed:p.includes('RAHMEN=')?{ideas:[idea]}:raw};}};
 vm.runInNewContext(fs.readFileSync('mission-geo-briefing-browser.js','utf8'),env);const b=env.window.MissionGeoBriefingBrowser;
 const m=await b.story({start:c.target,dest:c.target});assert.equal(calls.length,2);assert.equal(m.geoBriefing.idea.studyFocus,idea.studyFocus);
 assert.match(calls[0],/"recent":\[\{/);assert.match(calls[1],/HISTORY=\[\{/);
 env.getMissionAircraftCapabilitySnapshot=()=>({passengerCapacity:0});await assert.rejects(()=>b.choices([c.target],{start:c.target}));assert.equal(calls.length,2);
 for(const options of [{planning:true},{bush:true},{followup:true},{aiModeEnabled:false},{category:'chain'},{isPOI:false}])assert.equal(b.enabled({profileId:'science_geo',...options}),false);
});

test('optional study scene survives selected idea, writer, mission and compact cloud restore',()=>{
 const scene={summary:'Feldteam ergänzt die gemeinsame Studie.',visibleIdeas:['Zwei Feldmitarbeiter bei einem Lieferwagen'],densityHint:'sparse',notes:'Unterstützt die geplante Feldarbeit, kein zusätzlicher Auftrag.'};
 const selected=core.validateIdea({...idea,sceneIntent:scene},c),written=core.validateWriter({...raw,sceneIntent:scene},selected,c),m=core.mission(selected,written,c);
 assert.deepEqual(m.sceneIntent,scene);assert.deepEqual(m.geoBriefing.idea.sceneIntent,scene);assert.deepEqual(m._missionContractV4.sceneIntent,scene);
 const env=vm.createContext({window:{MissionGeoBriefingCore:core},compactPoiChainForMission:x=>x});
 for(const [file,names]of [['app.js',['compactMissionObjectForQuotaStorage']],['sync.js',['_syncJsonClone','_syncCompactMissionObjectCore']]])for(const name of names)vm.runInContext(extractOriginalFunction(fs.readFileSync(file,'utf8'),name),env);
 const restored=env._syncCompactMissionObjectCore(env.compactMissionObjectForQuotaStorage(m));assert.deepEqual(JSON.parse(JSON.stringify(restored.geoBriefing.idea.sceneIntent)),scene);
 assert.equal(m.passenger.taskDomain,'science_geo');assert.match(core.voiceContext(m.geoBriefing),/keine zusätzliche Aufgabe/);
});
test('writer may reduce optional unsupported objects but cannot add scene to landscape-only idea',()=>{
 const scene={summary:'Feldteam',visibleIdeas:['Feldmitarbeiter'],densityHint:'sparse',notes:''},selected=core.validateIdea({...idea,sceneIntent:scene},c);
 assert.equal(core.validateWriter({...raw,sceneIntent:core.sceneIntent(null)},selected,c).sceneIntent.densityHint,'none');
 assert.throws(()=>core.validateWriter({...raw,sceneIntent:scene},core.validateIdea(idea,c),c));
 assert.throws(()=>core.sceneIntent({...scene,densityHint:'none'}));assert.throws(()=>core.sceneIntent({...scene,visibleIdeas:[]}));
});
test('idea sees optional scene possibility without catalogue anchors; writer sees concrete assets',async()=>{
 const env={window:{MissionGeoBriefingCore:core,MissionPoiBriefingSharedBrowser:{context:async()=>structuredClone(c),enrichSelected:async x=>x}},localStorage:storage()};
 for(const file of ['data/mission-scene-assets.js','mission-geo-briefing-browser.js'])vm.runInNewContext(fs.readFileSync(file,'utf8'),env);
 const context=await env.window.MissionGeoBriefingBrowser.context(c.target);
 assert.ok(Object.keys(context.sceneCapabilities.features).length>0);
 const id=Object.keys(context.sceneCapabilities.features)[0];assert.ok(!core.ideaPrompt([core.frame(context)]).includes('modelsByRole'));assert.equal(core.frame(context).sceneTools.optionalObjects,true);
 assert.ok(core.writerPrompt(context,core.validateIdea(idea,c),[],shared.prepareFlight({})).includes(id));
 for(const spec of Object.values(context.sceneCapabilities.features))for(const role of spec.roles||[])assert.ok(Array.isArray(spec.modelsByRole[role]));
});
test('existing shared composer receives geology idea and enrolls without a new mission recipe',()=>{
 const env=vm.createContext({window:{},compactSceneComposerStory:x=>x,compactMissionPlanV2ForPrompt:x=>x,missionPlanV2SceneDirective:()=>null});
 vm.runInContext(fs.readFileSync('mission-reporter-scene-core.js','utf8'),env);
 vm.runInContext(extractOriginalFunction(fs.readFileSync('app.js','utf8'),'scenePlannerV3ReporterContext'),env);
 const scene={summary:'Feldteam',visibleIdeas:['Feldmitarbeiter'],densityHint:'sparse',notes:''};
 const selected=core.validateIdea({...idea,sceneIntent:scene},c);const m=core.mission(selected,core.validateWriter(raw,selected,c),c);
 assert.equal(env.window.MissionReporterSceneCore.enroll(m,m._missionContractV4,m.passenger),true);
 const context=env.scenePlannerV3ReporterContext(m,m._missionContractV4);assert.equal(context.reporterScene.idea.studyFocus,idea.studyFocus);assert.equal(context.reporterScene.sceneIntent.densityHint,'sparse');
});
