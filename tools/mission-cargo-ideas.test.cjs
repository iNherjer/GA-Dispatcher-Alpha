const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const core=require('../mission-cargo-ideas-core.js'),charter=require('../mission-charter-ideas-core.js'),club=require('../mission-club-ideas-core.js');
require('../mission-private-outing-core.js');const flight=require('../mission-private-episode-v6.js');
const route={start:{name:'Start',lat:48,lon:8},target:{name:'Ziel',lat:49,lon:8}};
const input=core.frame(route,{name:'Testflugzeug',maxPayloadKg:400});
// Fixtures exercise identity and weight; these are never imported into production prompts.
const raw={purpose:'Nachschub für den laufenden Betrieb',background:'Die Empfänger haben eine zusätzliche Sendung disponiert.',sender:'Zentrale Versandstelle',recipient:'Warenannahme des Empfängers',arrival:'Der Zielkontakt nimmt die Sendung am Flugplatz entgegen und bringt sie ins Lager.',character:'Gewöhnliche betriebliche Versorgung',memory:'Routinebedarf, ohne Sonderanfertigung oder Zeitnot.',shipment:{label:'Versandkartons',weightLbs:76.5,packaging:'Geschlossene Kartons',handling:''}};
const written={title:'Nachschub zum Zielplatz',story:'Die Versandstelle hat eine weitere Sendung für den laufenden Betrieb zusammengestellt. Die Warenannahme hat den Zugang bereits eingeplant. Du bringst die Kartons zum Zielflugplatz, wo der örtliche Kontakt sie übernehmen und anschließend ins Lager bringen soll.',memory:'Direkter Einstieg über den eingeplanten Wareneingang.',pilotNotes:''};
function extract(file,name,c){const code=fs.readFileSync(file,'utf8'),a=code.indexOf('function '+name+'('),b=code.indexOf('\nfunction ',a+1);assert.ok(a>=0);vm.runInContext(code.slice(a,b<0?undefined:b),c);}
function storage(){const map=new Map();return {getItem:k=>map.get(k),setItem:(k,v)=>map.set(k,v)};}
function browser(request){const c=vm.createContext({console,window:{MissionCargoIdeasCore:core,MissionCharterIdeasCore:charter,MissionClubIdeasCore:club,MissionPrivateEpisodeV6:flight},localStorage:storage(),getMissionAircraftCapabilitySnapshot:()=>({name:'Test',maxPayloadKg:400}),getSelectedAiApiKey:()=>'',fetchGeminiJsonWithFallback:request,missionProposalCompactTarget:x=>x,missionProposalFormatRoute:()=>({label:'Route'})});extract('app.js','normalizeMissionProposalChoice',c);extract('app.js','compactMissionProposalChoice',c);vm.runInContext(fs.readFileSync('mission-cargo-browser.js','utf8'),c);return c;}
test('freight has positive bounded shipment, zero passengers and no airborne voices',()=>{
 const idea=core.validate(raw,input);assert.ok(idea);
 for(const patch of [{passengerCount:1},{passenger:{name:'Person'}},{greeting:'Hallo'},{narrativeEvents:[{atPercent:50,intent:'X'}]},{shipment:{...raw.shipment,weightLbs:320}},{shipment:{...raw.shipment,weightLbs:0}}])assert.equal(core.validate({...raw,...patch},input),null);
 const m=core.mission(idea,core.prose(written,idea),'Wetter',{});assert.equal(m.passenger,null);assert.equal(m.passengerCount,0);assert.equal(m.pax,'0 PAX');assert.match(m.cargo,/76.5 lbs/);assert.equal(core.prose({...written,pilotNotes:'Immer vorsichtig fliegen.'},idea),null);
});
test('picker compact roundtrip and acceptance retain shipment, refreshed weather and zero passengers',async()=>{
 let calls=0;const c=browser(async()=>({parsed:++calls===1?{ideas:[0,1,2].map(i=>({...raw,candidateId:'cargo-'+i}))}:{...written,flightBriefing:'Die Strecke beträgt [[route.distance]]. Am Start meldet [[start.station]] Wind mit [[start.wind]].'}}));
 const choices=await c.window.MissionCargoBrowser.choices([route.target,{...route.target,lat:50},{...route.target,lat:51}],{start:route.start});
 const choice=JSON.parse(JSON.stringify(c.compactMissionProposalChoice(choices[0])));
 const m=await c.window.MissionCargoBrowser.story({start:route.start,dest:route.target,proposal:choice.cargoProposal,contract:{route:{distanceNm:60},weather:{dep:{raw:{station:'EDDS',windKts:7}}}}});
 assert.equal(calls,2);assert.equal(m.cargoIdea.shipment.label,raw.shipment.label);assert.match(m.s,/7 Knoten/);assert.doesNotMatch(m.s,/\[\[/);assert.equal(m.passenger,null);
 await assert.rejects(()=>c.window.MissionCargoBrowser.story({start:route.start,dest:{...route.target,lat:51},proposal:choice.cargoProposal}),/Route/);
 c.getMissionAircraftCapabilitySnapshot=()=>({maxPayloadKg:10});await assert.rejects(()=>c.window.MissionCargoBrowser.story({start:route.start,dest:route.target,proposal:choice.cargoProposal}),/Flugzeug/);assert.equal(calls,2);
});
test('invalid idea repairs once; weather repair cannot change story or cargo',async()=>{
 let calls=0;const c=browser(async()=>{calls++;return {parsed:calls===1?{ideas:[{...raw,candidateId:'direct',passengerCount:1}]}:calls===2?{ideas:[{...raw,candidateId:'direct'}]}:calls===3?{...written,flightBriefing:'Wind 999 Knoten'}:{story:'MUST NOT REPLACE',flightBriefing:'Die Strecke beträgt [[route.distance]]. Wind bei [[start.station]]: [[start.wind]].'}};});
 const m=await c.window.MissionCargoBrowser.story({start:route.start,dest:route.target,contract:{route:{distanceNm:60},weather:{dep:{raw:{station:'EDDS',windKts:7}}}}});assert.equal(calls,4);assert.equal(m._missionWriterV4Debug.rawAiStory,written.story);assert.doesNotMatch(m.s,/MUST NOT|999/);assert.match(m.s,/7 Knoten/);
});
test('cargo classification and legacy presentation keep narrator and needs intact',()=>{
 const c=vm.createContext({window:{}});for(const name of ['classifyAptMissionCategory','personalizeAptCharterMission','applyMissionTaskProfileToMission','synchronizeMissionPartyPresentation'])extract('app.js',name,c);
 const m=core.mission(core.validate(raw,input),written,'Wetter',{});m.s+=' Der Kunde benötigt die Sendung bald.';
 assert.equal(c.classifyAptMissionCategory(m),'cargo');assert.equal(c.personalizeAptCharterMission(m),m);assert.equal(c.synchronizeMissionPartyPresentation(m),m);assert.equal(c.applyMissionTaskProfileToMission(m,false,'auto').mission.s,m.s);
});
test('quota/cloud/restart preserve the full cargo idea and delivery context',()=>{
 const c=vm.createContext({window:{}});extract('app.js','compactMissionObjectForQuotaStorage',c);extract('sync.js','_syncCompactMissionObjectCore',c);
 const idea=core.validate(raw,input),saved=c.compactMissionObjectForQuotaStorage({cargoIdea:idea,missionContract:{cargoIdea:idea},passengerCount:0});
 const restored=JSON.parse(JSON.stringify(c._syncCompactMissionObjectCore(saved)));assert.deepEqual(restored.cargoIdea,idea);assert.deepEqual(restored.missionContract.cargoIdea,idea);assert.equal(restored.passengerCount,0);
});
test('history is bounded, idempotent and remembers purpose rather than only cargo names',()=>{
 const s=storage(),idea=core.validate(raw,input);for(let i=0;i<30;i++)core.remember(s,'id'+i,idea,written);core.remember(s,'id29',idea,written);
 const rows=core.history(s);assert.ok(rows.length<=12);assert.equal(rows.filter(r=>r.id==='id29').length,1);assert.equal(rows.at(-1).purpose,raw.purpose);assert.equal(rows.at(-1).writerMemory,written.memory);assert.ok(JSON.stringify(rows).length<=12000);
});
test('generated cargo keeps original required delivery manifest and no passenger-owned handoff',()=>{
 const c=vm.createContext({window:{currentMissionData:{}},_missionCargoMissionKey:()=> 'test',_missionCargoAircraftSlot:()=> 'plane',_missionSceneTaskDomain:()=> 'cargo',_activeBushMissionSpec:()=>null,_missionCargoPrimaryText:()=> 'Versandkartons (76.5 lbs)',_missionCargoCleanLabel:x=>x,_missionCargoIsPoiMission:()=>false,_missionCargoHasPassengerMission:()=>false,_missionSceneCargoAsset:()=>({title:'Cardboard',candidates:['Cardboard']}),_missionCargoPushItem:(items,item)=>items.push(item),_missionCargoExtractWeight:()=>76.5,_missionCargoPrimaryTravelsWithPassenger:()=>false,_missionCargoPersistentEquipmentDefinitions:()=>[],_missionCargoApplyStoredOnboardEquipment:()=>{},MISSION_SCENE_ASSET_POOLS:{cargo:['Cardboard'],palletCargo:['Pallet']}});
 extract('mission-cargo-core.js','_missionCargoGenerateManifest',c);
 const before=c._missionCargoGenerateManifest();c.window.currentMissionData.cargoIdea=core.validate(raw,input);const after=c._missionCargoGenerateManifest();
 for(const items of [before.items,after.items]){assert.equal(items.some(x=>x.itemType==='passenger'),false);const p=items.find(x=>x.id==='primary-cargo');assert.equal(p.required,true);assert.equal(p.deliverAtDestination,true);assert.equal(p.deliverAtHome,false);assert.equal(p.handoffWithPassenger,false);assert.equal(p.weightLbs,76.5);}
 assert.deepEqual(after.items.map(x=>({id:x.id,required:x.required,deliverAtDestination:x.deliverAtDestination})),before.items.map(x=>({id:x.id,required:x.required,deliverAtDestination:x.deliverAtDestination})));
});
test('original arrival resolver retains cargo receiver at destination despite zero PAX',()=>{
 const c=vm.createContext({normalizeMissionType:()=> 'apt'});extract('app.js','getMissionPlanV2Plan',c);extract('mission-definition-core.js','normalizeAptArrivalRole',c);
 const m=core.mission(core.validate(raw,input),written,'Wetter',{});
 const role=c.normalizeAptArrivalRole({mission:m,paxText:m.pax,cargoText:m.cargo,profileId:'auto',missionPlanV2:m._missionPlanV2});assert.equal(role.role,'cargo_handoff');assert.equal(role.personRole,'person.ground_crew');
});
test('new writer gate excludes fragile, followups, POI, Bush, planning and offline',()=>{
 const src=fs.readFileSync('app.js','utf8'),line=src.split('\n').find(l=>l.includes('const useCargoIdeas ='));
 const base={isPOI:false,isBushDispatch:false,isPlanningOnlyMode:false,followupSeed:null,aiModeEnabled:true,selectedAptCategory:'cargo',dispatchProfileId:'auto'};
 function enabled(patch){return vm.runInNewContext(line+'\nuseCargoIdeas;', {...base,...patch});}
 assert.equal(enabled({}),true);for(const patch of [{dispatchProfileId:'cargo_fragile'},{followupSeed:{}},{isPOI:true},{isBushDispatch:true},{isPlanningOnlyMode:true},{aiModeEnabled:false},{selectedAptCategory:'charter'}])assert.equal(enabled(patch),false);
});
