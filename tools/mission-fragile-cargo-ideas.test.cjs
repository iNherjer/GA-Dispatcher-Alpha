const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const core=require('../mission-fragile-cargo-ideas-core.js'),charter=require('../mission-charter-ideas-core.js'),club=require('../mission-club-ideas-core.js');
require('../mission-private-outing-core.js');const flight=require('../mission-private-episode-v6.js');
const route={start:{name:'Start',lat:48,lon:8},target:{name:'Ziel',lat:49,lon:8}};
const input=core.frame(route,{name:'Testflugzeug',maxPayloadKg:400,passengerCapacity:3});
// Fixtures exercise identity and weight; these are never imported into production prompts.
const raw={passenger:{name:'Mara',role:'Versandbegleiterin',gender:'female',personality:'Praktisch und heiter',connection:'Hat die Sendung für das Team vorbereitet.'},purpose:'Nachschub für den laufenden Betrieb',background:'Die Empfänger haben eine zusätzliche Sendung disponiert.',sender:'Zentrale Versandstelle',recipient:'Warenannahme des Empfängers',arrival:'Der Zielkontakt nimmt die Sendung am Flugplatz entgegen und bringt sie ins Lager.',character:'Gewöhnliche betriebliche Versorgung',memory:'Routinebedarf, ohne Sonderanfertigung oder Zeitnot.',shipment:{label:'Versandkartons',weightLbs:76.5,packaging:'Geschlossene Kartons',handling:'Vor Stößen schützen.',fragility:'Dünne Wandung kann bei Stößen brechen.'}};
const written={title:'Nachschub zum Zielplatz',story:'Die Versandstelle hat eine weitere Sendung für den laufenden Betrieb zusammengestellt. Die Warenannahme hat den Zugang bereits eingeplant. Du bringst die Kartons zum Zielflugplatz, wo der örtliche Kontakt sie übernehmen und anschließend ins Lager bringen soll.',memory:'Direkter Einstieg über den eingeplanten Wareneingang.',greeting:'Hallo, ich habe die Sendung vorbereitet und begleite heute die Übergabe.',pilotNotes:'Die dünne Wandung verträgt keine Stöße.'};
function extract(file,name,c){const code=fs.readFileSync(file,'utf8'),a=code.indexOf('function '+name+'('),b=code.indexOf('\nfunction ',a+1);assert.ok(a>=0);vm.runInContext(code.slice(a,b<0?undefined:b),c);}
function storage(){const map=new Map();return {getItem:k=>map.get(k),setItem:(k,v)=>map.set(k,v)};}
function browser(request){const c=vm.createContext({console,window:{MissionFragileCargoIdeasCore:core,MissionCharterIdeasCore:charter,MissionClubIdeasCore:club,MissionPrivateEpisodeV6:flight},localStorage:storage(),getMissionAircraftCapabilitySnapshot:()=>({name:'Test',maxPayloadKg:400,passengerCapacity:3}),getSelectedAiApiKey:()=>'',fetchGeminiJsonWithFallback:request,missionProposalCompactTarget:x=>x,missionProposalFormatRoute:()=>({label:'Route'})});extract('app.js','normalizeMissionProposalChoice',c);extract('app.js','compactMissionProposalChoice',c);vm.runInContext(fs.readFileSync('mission-fragile-cargo-browser.js','utf8'),c);return c;}
test('cargo classification and legacy presentation keep narrator and needs intact',()=>{
 const c=vm.createContext({window:{}});for(const name of ['classifyAptMissionCategory','personalizeAptCharterMission','applyMissionTaskProfileToMission','synchronizeMissionPartyPresentation'])extract('app.js',name,c);
 const m=core.mission(core.validate(raw,input),written,'Wetter',{});m.s+=' Der Kunde benötigt die Sendung bald.';
 assert.equal(c.classifyAptMissionCategory(m),'cargo');assert.equal(c.personalizeAptCharterMission(m),m);assert.equal(c.synchronizeMissionPartyPresentation(m),m);assert.equal(c.applyMissionTaskProfileToMission(m,false,'cargo_fragile').mission.s,m.s);
});
test('quota/cloud/restart preserve the full cargo idea and delivery context',()=>{
 const c=vm.createContext({window:{}});extract('app.js','compactMissionObjectForQuotaStorage',c);extract('sync.js','_syncCompactMissionObjectCore',c);
 const idea=core.validate(raw,input),saved=c.compactMissionObjectForQuotaStorage({fragileCargoIdea:idea,missionContract:{fragileCargoIdea:idea},passengerCount:1});
 const restored=JSON.parse(JSON.stringify(c._syncCompactMissionObjectCore(saved)));assert.deepEqual(restored.fragileCargoIdea,idea);assert.deepEqual(restored.missionContract.fragileCargoIdea,idea);assert.equal(restored.passengerCount,1);
});
test('history is bounded, idempotent and remembers purpose rather than only cargo names',()=>{
 const s=storage(),idea=core.validate(raw,input);for(let i=0;i<30;i++)core.remember(s,'id'+i,idea,written);core.remember(s,'id29',idea,written);
 const rows=core.history(s);assert.ok(rows.length<=12);assert.equal(rows.filter(r=>r.id==='id29').length,1);assert.equal(rows.at(-1).purpose,raw.purpose);assert.equal(rows.at(-1).writerMemory,written.memory);assert.ok(JSON.stringify(rows).length<=12000);
});

test('fragile cargo requires exactly one real escort and concrete fragility',()=>{
 const idea=core.validate(raw,input);assert.ok(idea);
 for(const patch of [{passenger:null},{passengerCount:0},{passengerCount:2},{narrativeEvents:[{atPercent:50}]},{shipment:{...raw.shipment,fragility:''}},{shipment:{...raw.shipment,weightLbs:320}}])assert.equal(core.validate({...raw,...patch},input),null);
 assert.equal(core.validate(raw,{...input,passengerCapacity:0}),null);
 const m=core.mission(idea,written,'Wetter',{});
 assert.equal(m.passengerCount,1);assert.equal(m.passenger.name,'Mara');assert.equal(m.passenger.greetingText,written.greeting);assert.equal(m.passenger.cargoSensitivity,'hoch');assert.equal(m.passenger.bankTolerance,'niedrig');assert.equal(m.passenger.urgencyPriority,'niedrig');assert.equal(m._missionPlanV2.plan.taskDomain,'cargo_fragile');
});
test('picker and acceptance preserve the escort and exact shipment',async()=>{
 let calls=0;const c=browser(async()=>({parsed:++calls===1?{ideas:[0,1,2].map(i=>({...raw,candidateId:'fragile-cargo-'+i}))}:{...written,flightBriefing:''}}));
 const choices=await c.window.MissionFragileCargoBrowser.choices([route.target,{...route.target,lat:50},{...route.target,lat:51}],{start:route.start});
 const choice=JSON.parse(JSON.stringify(c.compactMissionProposalChoice(choices[0])));
 const m=await c.window.MissionFragileCargoBrowser.story({start:route.start,dest:route.target,proposal:choice.fragileCargoProposal});
 assert.equal(calls,2);assert.equal(m.passenger.name,'Mara');assert.equal(m.fragileCargoIdea.shipment.label,raw.shipment.label);assert.equal(m._missionContractV4.profile.taskDomain,'cargo_fragile');assert.match(m.s,/keine verwertbaren Wetter/);
 c.getMissionAircraftCapabilitySnapshot=()=>({passengerCapacity:0,maxPayloadKg:400});await assert.rejects(()=>c.window.MissionFragileCargoBrowser.story({start:route.start,dest:route.target,proposal:choice.fragileCargoProposal}),/Flugzeug/);assert.equal(calls,2);
});
test('legacy fragile anchor cannot replace generated passenger or shipment',()=>{
 const c=vm.createContext({window:{}});extract('app.js','_syncCargoFragileStoryAnchor',c);extract('app.js','missionMatchesTaskProfile',c);
 const m=core.mission(core.validate(raw,input),written,'Wetter',{});
 assert.equal(c._syncCargoFragileStoryAnchor(m,{id:'cargo_fragile',cargoPool:['Other cargo']},'Other cargo').mission,m);
 assert.equal(c.missionMatchesTaskProfile(m,'cargo_fragile'),true);
});
test('fragile writer remains scoped to explicit profile and original delivery ownership',()=>{
 const line=fs.readFileSync('app.js','utf8').split('\n').find(l=>l.includes('const useFragileCargoIdeas ='));
 const base={isPOI:false,isBushDispatch:false,isPlanningOnlyMode:false,followupSeed:null,aiModeEnabled:true,dispatchProfileId:'cargo_fragile'};
 assert.equal(vm.runInNewContext(line+'\nuseFragileCargoIdeas;',base),true);
 for(const patch of [{dispatchProfileId:'auto'},{followupSeed:{}},{isPOI:true},{isBushDispatch:true},{isPlanningOnlyMode:true},{aiModeEnabled:false}])assert.equal(vm.runInNewContext(line+'\nuseFragileCargoIdeas;',{...base,...patch}),false);
 const c=vm.createContext({_missionCargoHasPassengerMission:()=>true});extract('mission-cargo-core.js','_missionCargoPrimaryTravelsWithPassenger',c);assert.equal(c._missionCargoPrimaryTravelsWithPassenger('cargo_fragile'),false);
});
test('generated cargo keeps original required delivery manifest and one escort and independent cargo delivery',()=>{
 const c=vm.createContext({window:{currentMissionData:{}},_missionCargoMissionKey:()=> 'test',_missionCargoAircraftSlot:()=> 'plane',_missionSceneTaskDomain:()=> 'cargo_fragile',_activeBushMissionSpec:()=>null,_missionCargoPrimaryText:()=> 'Versandkartons (76.5 lbs)',_missionCargoCleanLabel:x=>x,_missionCargoIsPoiMission:()=>false,_missionCargoHasPassengerMission:()=>true,_missionCargoPassengerCount:()=>1,_missionScenePassengerGender:()=> 'female',_missionScenePersonTitle:()=> 'Person',_missionCargoPassengerLabel:()=> 'Mara',_missionCargoPassengerTotalWeightLbs:()=>170,_missionScenePersonCandidates:()=> ['Person'],_missionSceneCargoAsset:()=>({title:'Cardboard',candidates:['Cardboard']}),_missionCargoPushItem:(items,item)=>items.push(item),_missionCargoExtractWeight:()=>76.5,_missionCargoPrimaryTravelsWithPassenger:()=>false,_missionCargoPersistentEquipmentDefinitions:()=>[],_missionCargoApplyStoredOnboardEquipment:()=>{},MISSION_SCENE_ASSET_POOLS:{cargo:['Cardboard'],palletCargo:['Pallet']}});
 extract('mission-cargo-core.js','_missionCargoGenerateManifest',c);
 const before=c._missionCargoGenerateManifest();c.window.currentMissionData.fragileCargoIdea=core.validate(raw,input);const after=c._missionCargoGenerateManifest();
 for(const items of [before.items,after.items]){assert.equal(items.some(x=>x.itemType==='passenger'),true);const p=items.find(x=>x.id==='primary-cargo');assert.equal(p.required,true);assert.equal(p.deliverAtDestination,true);assert.equal(p.deliverAtHome,false);assert.equal(p.handoffWithPassenger,false);assert.equal(p.weightLbs,76.5);}
 assert.deepEqual(after.items.map(x=>({id:x.id,required:x.required,deliverAtDestination:x.deliverAtDestination})),before.items.map(x=>({id:x.id,required:x.required,deliverAtDestination:x.deliverAtDestination})));
});
test('original arrival resolver retains cargo receiver at destination with escort aboard',()=>{
 const c=vm.createContext({normalizeMissionType:()=> 'apt'});extract('app.js','getMissionPlanV2Plan',c);extract('mission-definition-core.js','normalizeAptArrivalRole',c);
 const m=core.mission(core.validate(raw,input),written,'Wetter',{});
 const role=c.normalizeAptArrivalRole({mission:m,paxText:m.pax,cargoText:m.cargo,profileId:'cargo_fragile',missionPlanV2:m._missionPlanV2});assert.equal(role.role,'cargo_handoff');assert.equal(role.personRole,'person.ground_crew');
});

test('weather repair cannot rewrite the accepted cargo story or escort',async()=>{
 let calls=0;const c=browser(async()=>({parsed:++calls===1?{ideas:[{...raw,candidateId:'direct'}]}:calls===2?{...written,flightBriefing:'Wind 999 Knoten'}:{story:'Wrong story',greeting:'Wrong voice',flightBriefing:'Die Strecke beträgt [[route.distance]]. Wind bei [[start.station]]: [[start.wind]].'}}));
 const m=await c.window.MissionFragileCargoBrowser.story({start:route.start,dest:route.target,contract:{route:{distanceNm:60},weather:{dep:{raw:{station:'EDDS',windKts:7}}}}});
 assert.equal(calls,3);assert.equal(m._missionWriterV4Debug.rawAiStory,written.story);assert.equal(m.passenger.greetingText,written.greeting);assert.match(m.s,/7 Knoten/);assert.doesNotMatch(m.s,/Wrong|999|\[\[/);
});
