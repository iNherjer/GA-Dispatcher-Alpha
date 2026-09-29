import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import core from '../mission-news-briefing-core.js';
import shared from '../mission-poi-briefing-shared-core.js';
import charter from '../mission-charter-ideas-core.js';
import {extractOriginalFunction} from './extract-original-function.mjs';
const c={id:'poi:48.000000:8.000000',target:{name:'Teststraße',lat:48,lon:8},targetCategory:'road',radiusM:5556,facts:[],targetFacts:[],coverage:[],supplements:[],terrain:{status:'missing'}};
const ideaInput={schema:core.IDEA_VERSION,targetId:c.id,targetName:c.target.name,taskDomain:'news_coverage',outlet:'Lokaljournal',headline:'Eine Straße wird zum Gesprächsthema',situation:'Die Anwohner diskutieren eine ungewöhnliche Lichtaktion.',angle:'Wie prägt die Aktion den ganzen Ort?',airValue:'Das Übersichtsbild zeigt den räumlichen Zusammenhang.',deliverable:'Bilder und Einordnung für einen Lokalbeitrag.',person:{name:'Ada Kurz',role:'Lokalreporterin'}};
const raw={targetId:c.id,title:'Eine Lichtaktion im Ortsgespräch',story:'Eine ungewöhnliche Lichtaktion sorgt an der Teststraße für Gesprächsstoff. Ada Kurz will den Zusammenhang aus der Luft für ihren Lokalbeitrag festhalten. Danach kehrt ihr zur Basis zurück.',greetingSpeaker:'Ada Kurz',greeting:'Hallo, ich möchte die Lichtaktion im Ortsbild zeigen.',usedFactIds:[],report:{orientationIds:[]}};
function storage(){const values=new Map();return {getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};}
function fixture(){const idea=core.validateIdea(ideaInput,c),written=core.validateWriter(raw,idea,c);Object.assign(written,shared.resolveWeather('',shared.prepareFlight({}).context));return core.mission(idea,written,c);}
function browser(){const s=storage(),requests=[];const env={window:{MissionNewsBriefingCore:core,MissionPoiBriefingSharedCore:shared,MissionCharterIdeasCore:charter,MissionPoiBriefingSharedBrowser:{context:async()=>structuredClone(c),enrichSelected:async x=>x}},localStorage:s,getMissionAircraftCapabilitySnapshot:()=>({passengerCapacity:1}),getSelectedAiApiKey:()=>'',normalizeMissionProposalChoice:x=>x,missionProposalCompactTarget:x=>x,missionProposalFormatRoute:()=>({label:'10 NM'}),fetchGeminiJsonWithFallback:async prompt=>{requests.push(prompt);return {parsed:prompt.includes('RAHMEN=')?{ideas:[ideaInput]}:raw};}};vm.runInNewContext(fs.readFileSync('data/mission-scene-assets.js','utf8'),env);vm.runInNewContext(fs.readFileSync('data/mission-homebase-scene-assets.js','utf8'),env);vm.runInNewContext(fs.readFileSync('mission-news-briefing-browser.js','utf8'),env);return {api:env.window.MissionNewsBriefingBrowser,s,requests};}
test('reporter idea keeps target, editorial angle and aerial value',()=>{
 const idea=core.validateIdea(ideaInput,c);assert.equal(idea.angle,ideaInput.angle);
 for(const patch of [{angle:''},{airValue:''},{taskDomain:'media_photo'},{targetId:'other'}])assert.throws(()=>core.validateIdea({...ideaInput,...patch},c));
 assert.throws(()=>core.readIdea({ideas:[ideaInput,ideaInput]},c));
});
test('POI reporter is enabled by default with opt-out; APT and other profiles stay unchanged',()=>{
 const b=browser();assert.equal(b.api.enabled({profileId:'news_coverage'}),true);b.s.setItem('ga_news_briefing_v1','off');assert.equal(b.api.enabled({profileId:'news_coverage'}),false);b.s.removeItem('ga_news_briefing_v1');assert.equal(b.api.enabled({profileId:'news_coverage'}),true);
 for(const patch of [{profileId:'media_photo'},{profileId:'inspection_infra'},{category:'chain'},{followup:true},{planning:true},{bush:true},{isPOI:false},{aiModeEnabled:false}])assert.equal(b.api.enabled({profileId:'news_coverage',...patch}),false);
});
test('picker-selected reporter idea goes to one writer, with unchanged target and decision',async()=>{
 const b=browser(),start={name:'Basis',lat:48.1,lon:8.1};
 const choices=await b.api.choices([{...c.target,poiCategory:'road'}],{start});
 const m=await b.api.story({start,dest:c.target,proposal:choices[0].newsProposal});
 assert.equal(b.requests.length,2);assert.equal(m.newsBriefing.idea.angle,ideaInput.angle);assert.equal(m.passenger.roleProfile,'news_reporter_professional_v1');
 assert.equal(m._missionContractV4.storyFrame.keyQuestion,ideaInput.angle);assert.equal(m.inspectionOutcome,undefined);
 await assert.rejects(()=>b.api.story({start,dest:{...c.target,lat:49},proposal:choices[0].newsProposal}));
 await assert.rejects(()=>b.api.choices([{...c.target,poiChain:{points:[]}}],{start}));
 assert.equal(b.requests.length,2);
});
test('history preserves editorial purpose and is bounded',()=>{const s=storage(),m=fixture();for(let i=0;i<20;i++)core.remember(s,'m'+i,m.newsBriefing);assert.equal(core.history(s).length,12);assert.equal(core.history(s).at(-1).angle,ideaInput.angle);});
test('existing finalizer and quota/cloud compaction preserve the new briefing and reporter role',()=>{
 const env=vm.createContext({window:{MissionNewsBriefingCore:core},compactPoiChainForMission:x=>x});
 for(const [file,names] of [['app.js',['applyMissionTaskProfileToMission','missionMatchesTaskProfile','compactMissionObjectForQuotaStorage']],['sync.js',['_syncJsonClone','_syncCompactMissionObjectCore']]])for(const name of names)vm.runInContext(extractOriginalFunction(fs.readFileSync(file,'utf8'),name),env);
 const m=fixture();assert.equal(env.applyMissionTaskProfileToMission(m,true,'news_coverage',m.pax,m.cargo).mission.s,m.s);assert.equal(env.missionMatchesTaskProfile(m,'news_coverage',true),true);
 const saved=env.compactMissionObjectForQuotaStorage(m),download=env._syncCompactMissionObjectCore(saved);
 assert.deepEqual(JSON.parse(JSON.stringify(download.newsBriefing)),m.newsBriefing);assert.equal(download.passenger.roleProfile,'news_reporter_professional_v1');
});
test('reporter voice keeps the whole editorial idea without adding trigger events',()=>{
 const m=fixture();assert.ok(core.voiceContext(m.newsBriefing).includes(ideaInput.deliverable));
 assert.equal(m.narrativeEvents,undefined);assert.equal(m.inspectionOutcome,undefined);
});
test('writer accepts existing navigation evidence but rejects invented source IDs',()=>{
 const idea=core.validateIdea(ideaInput,c),context={...c,facts:[{id:'landmark-known',role:'orientation',name:'Bekannter Ort',tags:{place:'town'},relativeToTarget:{distanceM:500,direction:'Norden'},targetRelativeToFeature:{distanceM:500,direction:'Süden'}}]};
 assert.doesNotThrow(()=>core.validateWriter({...raw,usedFactIds:['landmark-known']},idea,context));
 assert.throws(()=>core.validateWriter({...raw,usedFactIds:['invented-detail']},idea,context));
});

test('stored narrative history reaches the next idea and writer and deduplicates mission IDs',async()=>{
 const b=browser(),m=fixture(),start={name:'Basis',lat:48.1,lon:8.1};
 m.newsBriefing.writerMemory='Eigenwillige Lichtaktion als Anlass einer freundlichen Ortsdebatte.';
 core.remember(b.s,'previous',m.newsBriefing);core.remember(b.s,'previous',m.newsBriefing);
 assert.equal(core.history(b.s).length,1);
 const choices=await b.api.choices([{...c.target,poiCategory:'road'}],{start});
 await b.api.story({start,dest:c.target,proposal:choices[0].newsProposal});
 const frames=JSON.parse(b.requests[0].split('RAHMEN=')[1]);
 const writerHistory=JSON.parse(b.requests[1].split('HISTORY=')[1]);
 for(const rows of [frames[0].recent,writerHistory]){
  assert.equal(rows.length,1);assert.equal(rows[0].situation,ideaInput.situation);
  assert.equal(rows[0].angle,ideaInput.angle);assert.equal(rows[0].memory,m.newsBriefing.writerMemory);
 }
});

test('chosen scene intent survives writer, contract, compact storage and the existing scene sanitizer',async()=>{
 const intent={summary:'Anlieferung zur Montage am bestehenden Werk.',visibleIdeas:['Zwei Lastwagen als Gruppe neben einem Kran','Materialpaletten nahe den Arbeitsfahrzeugen'],densityHint:'busy',notes:'Sichtbarer Hintergrund für die Reportage über den Montagebeginn.'};
 const idea=core.validateIdea({...ideaInput,sceneIntent:intent},c);
 intent.visibleIdeas.push('Nachträgliche Änderung');assert.equal(idea.sceneIntent.visibleIdeas.length,2);
 const written=core.validateWriter(raw,idea,c),m=core.mission(idea,written,c);
 const env=vm.createContext({window:{MissionNewsBriefingCore:core},compactPoiChainForMission:x=>x});
 for(const n of ['sanitizeMissionSceneIntentSpec','compactMissionObjectForQuotaStorage'])vm.runInContext(extractOriginalFunction(fs.readFileSync('app.js','utf8'),n),env);
 const saved=env.compactMissionObjectForQuotaStorage(m);
 assert.deepEqual(JSON.parse(JSON.stringify(saved.sceneIntent)),idea.sceneIntent);
 assert.deepEqual(m._missionContractV4.sceneIntent,idea.sceneIntent);
 const sanitized=env.sanitizeMissionSceneIntentSpec(saved.sceneIntent,{isPOI:true,taskDomain:'news_coverage'});
 assert.deepEqual(Array.from(sanitized.visibleIdeas),idea.sceneIntent.visibleIdeas);assert.equal(sanitized.densityHint,'busy');
 for(const sceneIntent of [{...intent,densityHint:'unknown'},{...intent,visibleIdeas:['x'.repeat(101)]},{...intent,densityHint:'none'}])assert.throws(()=>core.validateIdea({...ideaInput,sceneIntent},c));
 assert.equal(core.validateIdea(ideaInput,c).sceneIntent.densityHint,'none');
});
test('idea receives the actual scene catalogue as capabilities without concrete asset titles',async()=>{
 const b=browser();await b.api.choices([{...c.target,poiCategory:'road'}],{start:{name:'Basis',lat:48,lon:8}});
 const capabilities=JSON.parse(b.requests[0].split('RAHMEN=')[1])[0].sceneCapabilities;
 assert.ok(capabilities.kinds.construction_site.roles.includes('construction.crane'));
 assert.ok(capabilities.features.construction_crane);
 assert.deepEqual(capabilities.features.pavilion.roles,['event.pavilion']);
 assert.ok(capabilities.features.people.roles.includes('person.ground_crew'));
 assert.equal(capabilities.kinds.sar_land,undefined);
 assert.doesNotMatch(JSON.stringify(capabilities),/Microsoft_Car_EUR/);
});

test('pavilion feature normalizes through the existing catalogue-driven scene path and uses an actual pack title',()=>{
 const env=vm.createContext({window:{}});vm.runInContext(fs.readFileSync('data/mission-scene-assets.js','utf8'),env);
 for(const n of ['missionSceneTargetFeatureCatalog','normalizeMissionTargetSceneFeature'])vm.runInContext(extractOriginalFunction(fs.readFileSync('app.js','utf8'),n),env);
 assert.equal(env.normalizeMissionTargetSceneFeature('pavilion'),'pavilion');
 const pack=JSON.parse(fs.readFileSync('homebase/assets/catalog.json','utf8'));
 assert.ok(JSON.stringify(pack).includes(env.window.MISSION_SCENE_ASSETS.roles['event.pavilion'][0]));
});
