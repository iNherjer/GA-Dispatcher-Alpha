import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import core from '../mission-fire-briefing-core.js';
import scene from '../mission-fire-scene-core.js';
import shared from '../mission-poi-briefing-shared-core.js';
import charter from '../mission-charter-ideas-core.js';
import {extractOriginalFunction} from './extract-original-function.mjs';
const c={id:'fire:48:8',target:{name:'Zielgebiet',lat:48,lon:8},targetFacts:[],environmentFacts:[{id:'forest',fact:'Wald kartiert',source:'map'}],facts:[],coverage:[],supplements:[],terrain:{status:'missing'}};
const i={schema:core.IDEA_VERSION,targetId:c.id,targetName:c.target.name,taskDomain:'fire_watch',alarmStatus:'unverified',alarm:{reportedBy:'Anrufer bei der Leitstelle',reportedObservation:'Unklarer aufsteigender Schleier',uncertainty:'Quelle und Bedeutung noch ungeklärt'},observationFocus:'Ursprung eingrenzen und Meldung abgleichen',reportingPurpose:'Leitstelle mit belastbarer Beobachtung versorgen',person:{name:'Kim',role:'Einsatzbeobachterin',gender:'female'},factIds:['forest']};
const w={targetId:c.id,title:'Feuermeldung prüfen',story:'Du klärst die Meldung mit Kim aus der Luft. Der Befund ist offen.',greetingSpeaker:'Kim',greeting:'Hallo, danke. Wir prüfen die Meldung.',memory:'Unklare Quelle eingrenzen',usedFactIds:[],report:{orientationIds:[]}};
function store(){const m=new Map();return {getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v)};}
function mission(){return core.mission(core.validateIdea(i,c),core.validateWriter(w,i,c),c,{});}
function fire(truth='fire'){return {enabled:true,type:'fire_watch',truth,extent:'multi_smoke',state:'enroute',target:{name:'Zielgebiet',lat:48,lon:8,altFt:1000},targetAreaNm:1.5,smoke:{objectTitle:'Chimney_Smoke_V1',sites:[{siteId:'smoke-1',lat:48,lon:8,altFt:1000,count:8,radiusM:35},{siteId:'smoke-2',lat:48.001,lon:8,altFt:1000,count:8,radiusM:35}]},fire:{enabled:true,sites:[{siteId:'fire-1',smokeSiteId:'smoke-1',objectTitle:'VO_Fire_R1_40',lat:48,lon:8,altFt:1000}]}};}
const placement={kind:'fire_watch',requirements:[{feature:'smoke_light',forwardM:120,rightM:0,count:1},{feature:'smoke_light',forwardM:-120,rightM:0,count:1}]};
test('alarm ideas bind identity and unverified state without post-editing prose',()=>{
 assert.throws(()=>core.validateIdea({...i,alarmStatus:'confirmed'},c));assert.throws(()=>core.validateIdea({...i,targetName:'Anderes Gebiet'},c));assert.throws(()=>core.validateIdea({...i,factIds:['made-up']},c));assert.throws(()=>core.readIdea({ideas:[i,i]},c));
 const normalized=core.validateIdea({...i,truth:'fire',extent:'major_fire',person:{...i.person,result:'fire'}},c);assert.equal(normalized.truth,undefined);assert.equal(normalized.person.result,undefined);
 const frame=core.frame({...c,fireScenario:fire(),missionTruth:{result:'major_fire'}});assert.doesNotMatch(JSON.stringify(frame),/major_fire|Chimney/);assert.match(core.writerPrompt(c,i,[],shared.prepareFlight({})),/vor dem Start/);
});
test('original finalizer and quota/cloud compact preserve the briefing and observer role',()=>{
 const env=vm.createContext({window:{MissionFireBriefingCore:core},compactPoiChainForMission:x=>x});
 for(const [file,names] of [['app.js',['applyMissionTaskProfileToMission','missionMatchesTaskProfile','compactMissionObjectForQuotaStorage']],['sync.js',['_syncJsonClone','_syncCompactMissionObjectCore']]])for(const n of names)vm.runInContext(extractOriginalFunction(fs.readFileSync(file,'utf8'),n),env);
 const m=mission();assert.equal(env.applyMissionTaskProfileToMission(m,true,'fire_watch',m.pax,m.cargo).mission.s,m.s);assert.equal(env.missionMatchesTaskProfile(m,'fire_watch',true),true);
 const restored=JSON.parse(JSON.stringify(env._syncCompactMissionObjectCore(env.compactMissionObjectForQuotaStorage(m))));assert.deepEqual(restored.fireBriefing,JSON.parse(JSON.stringify(m.fireBriefing)));assert.equal(restored.passenger.roleProfile,'fire_observer_ops_v1');assert.equal(restored.passenger.targetRadiusNm,1.5);
});
function browser(compose=async()=>({targetScene:placement})){const calls=[],storage=store();const env={window:{MissionFireBriefingCore:core,MissionFireSceneCore:scene,MissionPoiBriefingSharedCore:shared,MissionCharterIdeasCore:charter,MissionPoiBriefingSharedBrowser:{context:async()=>({...c,fireScenario:fire()}),enrichSelected:async x=>x}},localStorage:storage,getMissionAircraftCapabilitySnapshot:()=>({passengerCapacity:1}),getSelectedAiApiKey:()=>'',normalizeMissionProposalChoice:x=>x,missionProposalCompactTarget:x=>x,missionProposalFormatRoute:()=>({label:'20 NM'}),fetchGeminiJsonWithFallback:async prompt=>{calls.push(prompt);return {parsed:prompt.includes('RAHMEN=')?{ideas:[i]}:w};}};vm.runInNewContext(fs.readFileSync('mission-fire-briefing-browser.js','utf8'),env);return {api:env.window.MissionFireBriefingBrowser,calls,env,compose};}
test('picker selects and binds one alarm; writer gets no future finding',async()=>{
 const {api,calls}=browser(),start={name:'Basis',lat:48.1,lon:8.1};assert.equal(api.enabled({profileId:'fire_watch'}),true);assert.equal(api.enabled({profileId:'science_geo'}),false);
 const [choice]=await api.choices([c.target],{start});const m=await api.story({start,dest:c.target,proposal:choice.fireProposal});assert.equal(calls.length,2);assert.equal(m.passenger.name,'Kim');assert.doesNotMatch(calls.join('\n'),/Chimney|major_fire|fireScenario/);
 await assert.rejects(()=>api.story({start,dest:{...c.target,lon:9},proposal:choice.fireProposal}));assert.equal(calls.length,2);
});
test('private composition keeps truth and original particle counts while moving paired fire sites',()=>{
 const fs=fire(),packet=scene.planning(fs,mission(),{},mission().passenger);assert.equal(packet.missionData.heading,0);assert.equal(packet.missionData.missionTruth.sceneAnchor.lat,fs.target.lat);
 const next=scene.placement(fs,placement);assert.equal(next.truth,fs.truth);assert.equal(next.smoke.sites[0].count,8);assert.equal(next.fire.sites[0].lat,next.smoke.sites[0].lat);assert.notEqual(next.smoke.sites[0].lat,fs.smoke.sites[0].lat);assert.equal(fs.smoke.sites[0].lat,48);
 for(const invalid of [{requirements:[]},{requirements:[{feature:'smoke_light',forwardM:5000,rightM:0},placement.requirements[1]]},{requirements:[placement.requirements[0],placement.requirements[0]]},{requirements:[...placement.requirements,{feature:'people'}]}])assert.equal(scene.placement(fs,invalid),null);
 assert.equal(scene.planning(fire('false_alarm'),{},{}),null);assert.equal(scene.placement(fire('false_alarm'),placement),null);
});
test('scene composer runs privately once; false alarm stays empty and failed KI uses mapped placement',async()=>{
 const {api}=browser();let calls=0;const geo={status:'mapped',radiusM:2200,origin:{lat:48,lon:8},candidates:[{x:0,y:500},{x:0,y:-500}],shapes:[{type:'forest',closed:true,points:[{x:-2500,y:-2500},{x:2500,y:-2500},{x:2500,y:2500},{x:-2500,y:2500},{x:-2500,y:-2500}]}]}, valid={kind:'fire_watch',requirements:[{feature:'smoke_light',forwardM:500,rightM:0},{feature:'smoke_light',forwardM:-500,rightM:0}]};const input={geometry:geo,missionData:{...mission(),fireScenario:fire()},missionContract:{},passenger:mission().passenger,apiKey:'fixture',compose:async()=>{calls++;return {targetScene:valid};}};
 const result=await api.composeScene(input);assert.equal(calls,1);assert.equal(result.fireScenario.placement.source,'scene-composer');assert.deepEqual(JSON.parse(JSON.stringify(result.targetScene)),scene.publicScene());assert.doesNotMatch(JSON.stringify(result.debug),/truth|extent|smoke-|major_fire/);
 const falseAlarm=await api.composeScene({...input,missionData:{...input.missionData,fireScenario:fire('false_alarm')}});assert.equal(calls,1);assert.equal(falseAlarm.fireScenario,undefined);
 const failed=await api.composeScene({...input,compose:async()=>{throw Error('offline');}});assert.equal(failed.fireScenario.placement.source,'mapped-fallback');assert.equal(input.missionData.fireScenario.truth,'fire');
});
test('history remembers alarm uncertainty but not hidden truth or a past outcome',()=>{const s=store(),m=mission();for(let n=0;n<20;n++)core.remember(s,'m'+n,m.fireBriefing);assert.equal(core.history(s).length,12);assert.equal(core.history(s).at(-1).alarm.uncertainty,i.alarm.uncertainty);assert.doesNotMatch(JSON.stringify(core.history(s)),/fireScenario|truth/);});
test('real serializable passenger base context carries public alarm only',()=>{
 const source=fs.readFileSync('passenger-voice.js','utf8');assert.match(source,/MissionFireBriefingCore\?\.voiceContext/);const m=mission();assert.match(core.voiceContext(m.fireBriefing),/unbestätigt/);assert.doesNotMatch(core.voiceContext(m.fireBriefing),/Chimney|major_fire/);
});

test('real passenger context survives serialization and never includes private fire layout',()=>{
 const m=mission(),env={window:{activePassenger:m.passenger,MissionFireBriefingCore:core},currentMissionData:{...m,fireScenario:fire()},localStorage:{getItem:()=>null},document:{getElementById:()=>({innerText:''})},_getMissionStory:()=>m.story,_sanitizePaxSoftPoiStory:x=>x,_activeTaskDomain:()=> 'fire_watch',_isPOIMission:()=>true,_normUrgencyPriority:()=> 'mittel',_missionHasPax:()=>true,_personaNarrativeSeedAllowed:()=>true};
 for(const n of ['_activeBushPickupPassengerContract','_roleStyleHint','_personaPersonalityLabel','_personaSpeechSignature','_activeAptTrainingPlan','_aptArrivalContextLine','_poiSightseeingKnowledgeContextLine','_paxTargetProminenceLine','_paxVisualLandmarksLine','_activeMissionStoryFrame','_bushVoiceToneLine','_bushPickupPassengerPerspectiveLine'])env[n]=()=>null;
 vm.createContext(env);vm.runInContext(extractOriginalFunction(fs.readFileSync('passenger-voice.js','utf8'),'_baseContext'),env);
 const restored=JSON.parse(JSON.stringify({baseContext:env._baseContext()}));assert.ok(restored.baseContext.includes(i.alarm.uncertainty));assert.doesNotMatch(restored.baseContext,/Chimney|multi_smoke|smoke-1|VO_Fire/);
});
test('complete local and cloud states preserve the public briefing and private composer placement',()=>{
 const env=vm.createContext({window:{},compactPoiChainForMission:x=>x});
 for(const [file,names]of [['app.js',['compactMissionObjectForQuotaStorage','slimMissionObjectForActiveState','compactRouteWaypointsForQuotaStorage','compactAltWaypointsForQuotaStorage','compactSegmentAltsForQuotaStorage','compactElevationDataForQuotaStorage','compactFreqCacheForQuotaStorage','compactTextForQuotaStorage','compactPassengerForQuotaStorage','compactActiveMissionStateForQuotaStorage']],['sync.js',['_syncJsonClone','_syncCompactMissionObjectCore','_syncStripDeepMissionPlans','_syncCompactFlightDataState','_syncCompactActiveMission']]])for(const n of names)vm.runInContext(extractOriginalFunction(fs.readFileSync(file,'utf8'),n),env);
 const m=mission(),scenario=scene.placement(fire(),placement),state={currentMissionData:{id:'fire-test',fireBriefing:m.fireBriefing,fireScenario:scenario,targetScene:scene.publicScene(),missionStory:m.story},activeMissionContract:{id:'fire-test',fireBriefing:m.fireBriefing},routeWaypoints:[{lat:48,lon:8},{lat:48.1,lon:8.1}]};
 for(const level of [1,2,3]){
  const local=env.compactActiveMissionStateForQuotaStorage(state),cloud=env._syncCompactActiveMission(local,level),restored=JSON.parse(JSON.stringify(env.compactActiveMissionStateForQuotaStorage(cloud)));
  assert.deepEqual(restored.currentMissionData.fireBriefing,JSON.parse(JSON.stringify(m.fireBriefing)));assert.deepEqual(restored.activeMissionContract.fireBriefing,JSON.parse(JSON.stringify(m.fireBriefing)));assert.deepEqual(restored.currentMissionData.fireScenario,scenario);assert.equal(restored.currentMissionData.targetScene.kind,'none');
 }
});
test('restoration does not normalize public unknown fire status into a visible smoke scene',()=>{
 const m=mission(),env=vm.createContext({window:{MissionFireBriefingCore:core,MissionFireSceneCore:scene},MISSION_PIPELINE_V3_VERSION:"fixture",missionUsesPoiPresentation:()=>true,sanitizeMissionTargetSceneSpec:()=>{throw Error('must not materialize preflight smoke');},sanitizeMissionSceneIntentSpec:x=>x,attachAptArrivalPlanToMissionTruth:x=>x});
 vm.runInContext(extractOriginalFunction(fs.readFileSync('app.js','utf8'),'restoreMissionV3Context'),env);
 const restored=env.restoreMissionV3Context({...m,missionTruth:{visibleCues:[]},fireScenario:fire()}, {},m.passenger,m._missionContractV4);
 assert.equal(restored.missionData.targetScene.kind,'none');assert.equal(restored.missionContract.targetScene.kind,'none');assert.equal(restored.missionData.fireScenario.truth,'fire');
});


test('fire search geometry excludes water, parking, roads, buildings and unknown data',()=>{
 const origin={lat:48,lon:8},ll=(x,y)=>({lat:48+y/111320,lon:8+x/(111320*Math.cos(48*Math.PI/180))});
 const way=(id,tags,points)=>({id,type:'way',tags,geometry:points.map(p=>ll(...p))});
 const raw={elements:[way(1,{landuse:'forest'},[[-2400,-2400],[2400,-2400],[2400,2400],[-2400,2400],[-2400,-2400]]),way(2,{natural:'water'},[[300,300],[700,300],[700,700],[300,700],[300,300]]),way(3,{amenity:'parking'},[[-700,300],[-300,300],[-300,700],[-700,700],[-700,300]]),way(4,{building:'yes'},[[300,-700],[700,-700],[700,-300],[300,-300],[300,-700]]),way(5,{highway:'primary'},[[-2000,-1000],[2000,-1000]])]};
 const geo=scene.geometry(raw,origin);assert.equal(geo.status,'mapped');assert.ok(geo.candidates.length>10);
 for(const p of [{x:0,y:0},{x:500,y:500},{x:-500,y:500},{x:500,y:-500},{x:0,y:-1000},{x:2200,y:0}])assert.ok(scene.surfaceError(p,70,geo));
 assert.equal(scene.surfaceError({x:-1200,y:500},70,geo),'');assert.ok(scene.surfaceError({x:-1200,y:500},70,scene.geometry({...raw,remark:'partial'},origin)));
 const fallback=scene.mappedFallback(fire(),geo);assert.equal(fallback.placement.source,'mapped-fallback');assert.ok(fallback.smoke.sites.every(s=>Math.hypot((s.lat-48)*111320,(s.lon-8)*111320*Math.cos(48*Math.PI/180))>=350));
});


test('fire-only multipolygon assembly handles reversed edges and excludes holes',()=>{
 const origin={lat:48,lon:8},ll=(x,y)=>({lat:48+y/111320,lon:8+x/(111320*Math.cos(48*Math.PI/180))});
 const edges=[[[200,200],[200,1200]],[[1200,1200],[200,1200]],[[1200,1200],[1200,200]],[[1200,200],[200,200]]].map(points=>({type:'way',role:'outer',geometry:points.map(p=>ll(...p))}));
 edges.push({type:'way',role:'inner',geometry:[[450,450],[750,450],[750,750],[450,750],[450,450]].map(p=>ll(...p))});
 const raw={elements:[{id:1,type:'relation',tags:{landuse:'forest'},members:edges}]};const geo=scene.geometry(raw,origin);
 assert.equal(geo.status,'mapped');assert.ok(geo.candidates.length);assert.ok(scene.surfaceError({x:600,y:600},35,geo));assert.equal(scene.surfaceError({x:1000,y:600},35,geo),'');
 const water=scene.geometry({elements:[{id:2,type:'relation',tags:{natural:'water'},members:edges.slice(0,4)}]},origin);assert.equal(water.status,'mapped');assert.ok(scene.surfaceError({x:600,y:600},35,water));
 assert.equal(scene.geometry({elements:[{id:2,type:'relation',tags:{natural:'water'},members:edges.slice(0,3)}]},origin).status,'incomplete');
});

test('fire scene accepts a single transport envelope but never ambiguous multiple scenes',()=>{const f=fire();assert.ok(scene.placement(f,[{targetScene:placement}]));assert.equal(scene.placement(f,[{targetScene:placement},{targetScene:placement}]),null);});

 test('Fire browser resolves supplied navigation and terrain references without relaxing unknown-reference rejection',async()=>{
 const {api,env}=browser(),start={name:'Basis',lat:48.1,lon:8.1};
 const context={...c,facts:[{id:'orientation-village',role:'orientation',name:'Testdorf',tags:{place:'village'},relativeToTarget:{distanceM:500,direction:'Westen'},targetRelativeToFeature:{distanceM:500,direction:'Osten'}}],terrain:{status:'sampled',minSampleM:300,maxSampleM:450,sampleCount:5,highestSample:{offsetM:500,direction:'Nordosten'},limitations:[]}};
 env.window.MissionPoiBriefingSharedBrowser.context=async()=>context;
 const navigation=shared.writerContext(context);
 const written={...w,story:w.story+' Das Suchgebiet liegt [[orientation-village.targetLocation]]. Die Höhenstichproben reichen von [[terrain.range]].',usedFactIds:['orientation-village']};
 env.fetchGeminiJsonWithFallback=async prompt=>({parsed:prompt.includes('RAHMEN=')?{ideas:[i]}:written});
 const m=await api.story({start,dest:c.target});
 assert.ok(m.story.includes(navigation.bindings['orientation-village.targetLocation']));
 assert.ok(m.story.includes(navigation.bindings['terrain.range']));
 assert.doesNotMatch(m.story,/\[\[/);
 written.story=w.story+' [[invented.location]]';
 await assert.rejects(()=>api.story({start,dest:c.target}),/unbekannte Referenzen: invented.location/);
 });
