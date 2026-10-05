const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const core=require('../mission-animal-transport-ideas-core.js'),charter=require('../mission-charter-ideas-core.js'),club=require('../mission-club-ideas-core.js');
require('../mission-private-outing-core.js');const flight=require('../mission-private-episode-v6.js');
const route={start:{name:'Start',lat:48,lon:8},target:{name:'Ziel',lat:49,lon:8}};
const input=core.frame(route,{name:'Testflugzeug',maxPayloadKg:400,passengerCapacity:3});
// Fixtures exercise identity and weight; these are never imported into production prompts.
const raw={passenger:{name:'Mara',role:'Tierpflegerin',gender:'female',personality:'Praktisch und heiter',connection:'Betreut die beiden Igel und begleitet ihre Übergabe.'},purpose:'Aufnahme zweier Igel in einer Pflegestelle',background:'Zwei fiktive Pflegestellen haben den betreuten Standortwechsel vereinbart.',sender:'Fiktive Pflegestelle Waldhof',recipient:'Fiktive Pflegestelle Wiesenhof',arrival:'Der Zielkontakt nimmt die Box am Flugplatz entgegen und bringt sie zur Pflegestelle.',character:'Gewöhnliche betriebliche Versorgung',memory:'Routinebedarf, ohne Sonderanfertigung oder Zeitnot.',shipment:{kind:'live_animal',species:'Igel',animalCount:2,label:'Igel in Transportbox',weightLbs:8.5,packaging:'Geschlossene belüftete Transportbox',handling:'Sanft absetzen und gegen Verrutschen sichern.',fragility:'Ruhige Handhabung ohne Stöße.'}};
const written={title:'Betreuter Wechsel zur Pflegestelle',story:'Die beiden fiktiven Pflegestellen haben die Aufnahme zweier Igel vereinbart. Mara betreut die Tiere und begleitet ihre Übergabe am Zielflugplatz. Die belüftete Transportbox ist für die Verladung vorbereitet. Der örtliche Kontakt soll die Tiere anschließend zur neuen Pflegestelle bringen.',memory:'Direkter Einstieg über den eingeplanten Wareneingang.',greeting:'Hallo, ich habe die Sendung vorbereitet und begleite heute die Übergabe.',pilotNotes:'Die vorbereitete Box sanft absetzen und die Lüftungsöffnungen freihalten.'};
function extract(file,name,c){const code=fs.readFileSync(file,'utf8'),a=code.indexOf('function '+name+'('),b=code.indexOf('\nfunction ',a+1);assert.ok(a>=0);vm.runInContext(code.slice(a,b<0?undefined:b),c);}
function storage(){const map=new Map();return {getItem:k=>map.get(k),setItem:(k,v)=>map.set(k,v)};}
function browser(request){const c=vm.createContext({console,window:{MissionAnimalTransportIdeasCore:core,MissionCharterIdeasCore:charter,MissionClubIdeasCore:club,MissionPrivateEpisodeV6:flight},localStorage:storage(),getMissionAircraftCapabilitySnapshot:()=>({name:'Test',maxPayloadKg:400,passengerCapacity:3}),getSelectedAiApiKey:()=>'',fetchGeminiJsonWithFallback:request,missionProposalCompactTarget:x=>x,missionProposalFormatRoute:()=>({label:'Route'})});extract('app.js','normalizeMissionProposalChoice',c);extract('app.js','compactMissionProposalChoice',c);vm.runInContext(fs.readFileSync('mission-animal-transport-browser.js','utf8'),c);return c;}
test('cargo classification and legacy presentation keep narrator and needs intact',()=>{
 const c=vm.createContext({window:{}});for(const name of ['classifyAptMissionCategory','personalizeAptCharterMission','applyMissionTaskProfileToMission','synchronizeMissionPartyPresentation'])extract('app.js',name,c);
 const m=core.mission(core.validate(raw,input),written,'Wetter',{});m.s+=' Der Kunde benötigt die Sendung bald.';
 assert.equal(c.classifyAptMissionCategory(m),'cargo');assert.equal(c.personalizeAptCharterMission(m),m);assert.equal(c.synchronizeMissionPartyPresentation(m),m);assert.equal(c.applyMissionTaskProfileToMission(m,false,'animal_transport').mission.s,m.s);
});
test('quota/cloud/restart preserve the full cargo idea and delivery context',()=>{
 const c=vm.createContext({window:{}});extract('app.js','compactMissionObjectForQuotaStorage',c);extract('sync.js','_syncCompactMissionObjectCore',c);
 const idea=core.validate(raw,input),saved=c.compactMissionObjectForQuotaStorage({animalTransportIdea:idea,missionContract:{animalTransportIdea:idea},passengerCount:1});
 const restored=JSON.parse(JSON.stringify(c._syncCompactMissionObjectCore(saved)));assert.deepEqual(restored.animalTransportIdea,idea);assert.deepEqual(restored.missionContract.animalTransportIdea,idea);assert.equal(restored.passengerCount,1);
});
test('history is bounded, idempotent and remembers purpose rather than only cargo names',()=>{
 const s=storage(),idea=core.validate(raw,input);for(let i=0;i<30;i++)core.remember(s,'id'+i,idea,written);core.remember(s,'id29',idea,written);
 const rows=core.history(s);assert.ok(rows.length<=12);assert.equal(rows.filter(r=>r.id==='id29').length,1);assert.equal(rows.at(-1).purpose,raw.purpose);assert.equal(rows.at(-1).writerMemory,written.memory);assert.ok(JSON.stringify(rows).length<=12000);
});

test('animal transport requires exactly one real escort and concrete fragility',()=>{
 const idea=core.validate(raw,input);assert.ok(idea);
 for(const patch of [{passenger:null},{passengerCount:0},{passengerCount:2},{narrativeEvents:[{atPercent:50}]},{shipment:{...raw.shipment,fragility:''}},{shipment:{...raw.shipment,weightLbs:320}}])assert.equal(core.validate({...raw,...patch},input),null);
 assert.equal(core.validate(raw,{...input,passengerCapacity:0}),null);
 const m=core.mission(idea,written,'Wetter',{});
 assert.equal(m.passengerCount,1);assert.equal(m.passenger.name,'Mara');assert.equal(m.passenger.greetingText,written.greeting);assert.equal(m.passenger.cargoSensitivity,'hoch');assert.equal(m.passenger.bankTolerance,'niedrig');assert.equal(m.passenger.urgencyPriority,'niedrig');assert.equal(m._missionPlanV2.plan.taskDomain,'animal_transport');
});
test('picker and acceptance preserve the escort and exact shipment',async()=>{
 let calls=0;const c=browser(async()=>({parsed:++calls===1?{ideas:[0,1,2].map(i=>({...raw,candidateId:'animal-transport-'+i}))}:{...written,flightBriefing:''}}));
 const choices=await c.window.MissionAnimalTransportBrowser.choices([route.target,{...route.target,lat:50},{...route.target,lat:51}],{start:route.start});
 const choice=JSON.parse(JSON.stringify(c.compactMissionProposalChoice(choices[0])));
 const m=await c.window.MissionAnimalTransportBrowser.story({start:route.start,dest:route.target,proposal:choice.animalTransportProposal});
 assert.equal(calls,2);assert.equal(m.passenger.name,'Mara');assert.equal(m.animalTransportIdea.shipment.label,raw.shipment.label);assert.equal(m._missionContractV4.profile.taskDomain,'animal_transport');assert.match(m.s,/keine verwertbaren Wetter/);
 c.getMissionAircraftCapabilitySnapshot=()=>({passengerCapacity:0,maxPayloadKg:400});await assert.rejects(()=>c.window.MissionAnimalTransportBrowser.story({start:route.start,dest:route.target,proposal:choice.animalTransportProposal}),/Flugzeug/);assert.equal(calls,2);
});
test('animal writer remains scoped to explicit profile and original delivery ownership',()=>{
 const line=fs.readFileSync('app.js','utf8').split('\n').find(l=>l.includes('const useAnimalTransportIdeas ='));
 const base={isPOI:false,isBushDispatch:false,isPlanningOnlyMode:false,followupSeed:null,aiModeEnabled:true,dispatchProfileId:'animal_transport'};
 assert.equal(vm.runInNewContext(line+'\nuseAnimalTransportIdeas;',base),true);
 for(const patch of [{dispatchProfileId:'auto'},{followupSeed:{}},{isPOI:true},{isBushDispatch:true},{isPlanningOnlyMode:true},{aiModeEnabled:false}])assert.equal(vm.runInNewContext(line+'\nuseAnimalTransportIdeas;',{...base,...patch}),false);
 const c=vm.createContext({_missionCargoHasPassengerMission:()=>true});extract('mission-cargo-core.js','_missionCargoPrimaryTravelsWithPassenger',c);assert.equal(c._missionCargoPrimaryTravelsWithPassenger('animal_transport'),false);
});
test('weather repair cannot rewrite the accepted cargo story or escort',async()=>{
 let calls=0;const c=browser(async()=>({parsed:++calls===1?{ideas:[{...raw,candidateId:'direct'}]}:calls===2?{...written,flightBriefing:'Wind 999 Knoten'}:{story:'Wrong story',greeting:'Wrong voice',flightBriefing:'Die Strecke beträgt [[route.distance]]. Wind bei [[start.station]]: [[start.wind]].'}}));
 const m=await c.window.MissionAnimalTransportBrowser.story({start:route.start,dest:route.target,contract:{route:{distanceNm:60},weather:{dep:{raw:{station:'EDDS',windKts:7}}}}});
 assert.equal(calls,3);assert.equal(m._missionWriterV4Debug.rawAiStory,written.story);assert.equal(m.passenger.greetingText,written.greeting);assert.match(m.s,/7 Knoten/);assert.doesNotMatch(m.s,/Wrong|999|\[\[/);
});

test('animal and material contracts cannot be conflated',()=>{
 assert.equal(core.validate({...raw,shipment:{...raw.shipment,animalCount:0}},input),null);
 assert.equal(core.validate({...raw,shipment:{...raw.shipment,species:''}},input),null);
 assert.equal(core.validate({...raw,shipment:{...raw.shipment,kind:'veterinary_material'}},input),null);
 const material=core.validate({...raw,shipment:{...raw.shipment,kind:'veterinary_material',species:'',animalCount:null,label:'Tierarztmaterial'}},input);
 assert.ok(material);assert.equal(core.mission(material,written,'',{}).animalTransportIdea.shipment.animalCount,null);
});
test('structured handover preserves the recipient rather than a random species template',async()=>{
 let calls=0;const c=browser(async()=>({parsed:++calls===1?{ideas:[{...raw,candidateId:'direct'}]}:{...written,flightBriefing:''}}));
 const m=await c.window.MissionAnimalTransportBrowser.story({start:route.start,dest:route.target});
 assert.equal(m._missionContractV4.animalTransportBrief.receivingContact,raw.recipient);
 assert.equal(m._missionContractV4.animalTransportBrief.nextCareStep,raw.arrival);
 assert.equal(m._missionContractV4.animalTransportBrief.cargoText,m.cargo);
 const x=vm.createContext({window:{}});extract('app.js','applyMissionTaskProfileToMission',x);
 const finalized=x.applyMissionTaskProfileToMission(m,false,'animal_transport','Other','Other');
 assert.equal(finalized.mission.passenger.name,m.passenger.name);assert.equal(finalized.cargoText,m.cargo);assert.equal(finalized.mission.s,m.s);
});
test('actual arrival role uses structured receiver and does not infer animals from material story',()=>{
 const definition=vm.createContext({normalizeMissionType:()=> 'apt'});
 const app=fs.readFileSync('app.js','utf8');vm.runInContext(app.slice(app.indexOf('const ANIMAL_TRANSPORT_SCENE_OPTIONS ='),app.indexOf('function getMissionPlanV2Plan(')),definition);
 extract('app.js','getMissionPlanV2Plan',definition);extract('mission-definition-core.js','normalizeAptArrivalRole',definition);
 for(const shipment of [raw.shipment,{...raw.shipment,kind:'veterinary_material',species:'',animalCount:null,label:'Tierarztmaterial'}]){
  const idea=core.validate({...raw,shipment},input),m=core.mission(idea,written,'',{});
  const role=definition.normalizeAptArrivalRole({mission:m,paxText:m.pax,cargoText:m.cargo,profileId:'animal_transport',missionPlanV2:m._missionPlanV2});
  assert.equal(role.role,'animal_handoff');assert.equal(role.expectedBy,raw.recipient);assert.equal(role.narrativeHint,raw.arrival);if(shipment.kind==='veterinary_material')assert.equal(role.animalSpec.visible,false);
 }
});
test('loading asset keeps species/count label and material never selects a random animal',()=>{
 const c=vm.createContext({window:{},currentMissionData:null,_missionSceneTaskDomain:()=> 'animal_transport',MISSION_SCENE_ASSET_POOLS:{animalTransportBoxes:['VFR Multitool Mission Pet Carrier Cargo','Cardboard'],smallCargo:['Cardboard']},_sceneAssetCandidates:(title,pool)=>[title,...pool]});
 extract('sync.js','_missionSceneAnimalTransportSpec',c);extract('sync.js','_missionSceneCargoAsset',c);
 for(const shipment of [raw.shipment,{...raw.shipment,kind:'live_animal',species:'Alpensalamander',animalCount:12,label:'12 Alpensalamander in Thermobox'},{...raw.shipment,kind:'veterinary_material',species:'',animalCount:null,label:'Tierarztmaterial'}]){
  c.currentMissionData={animalTransportIdea:core.validate({...raw,shipment},input)};
  const asset=c._missionSceneAnimalTransportSpec();assert.equal(asset.visible,false);assert.equal(asset.cargoLabel,shipment.label);
  assert.equal(asset.cargoTitle,shipment.kind==='live_animal'?'VFR Multitool Mission Pet Carrier Cargo':'Cardboard');assert.equal(asset.title,undefined);const cargo=c._missionSceneCargoAsset();assert.equal(cargo.title,asset.cargoTitle);assert.equal(cargo.semanticAsset,true);assert.equal(cargo.cargoWeightLbs,shipment.weightLbs);
 }
});
test('manifest preserves even a light animal carrier and requires delivery separately from escort',()=>{
 const c=vm.createContext({window:{},currentMissionData:null,_missionCargoMissionKey:()=> 'test',_missionCargoAircraftSlot:()=> 'plane',_missionSceneTaskDomain:()=> 'animal_transport',_activeBushMissionSpec:()=>null,_missionCargoPrimaryText:()=>c.currentMissionData.cargo,_missionCargoCleanLabel:x=>x,_missionCargoIsPoiMission:()=>false,_missionCargoHasPassengerMission:()=>true,_missionCargoPassengerCount:()=>1,_missionScenePassengerGender:()=> 'female',_missionScenePersonTitle:()=> 'Person',_missionCargoPassengerLabel:()=> 'Mara',_missionCargoPassengerTotalWeightLbs:()=>170,_missionScenePersonCandidates:()=> ['Person'],_missionCargoPushItem:(items,item)=>items.push(item),_missionCargoExtractWeight:()=>c.currentMissionData.animalTransportIdea.shipment.weightLbs,_missionCargoPersistentEquipmentDefinitions:()=>[],_missionCargoApplyStoredOnboardEquipment:()=>{},_sceneAssetCandidates:(title,pool)=>[title,...pool],MISSION_SCENE_ASSET_POOLS:{animalTransportBoxes:['VFR Multitool Mission Pet Carrier Cargo','Cardboard'],smallCargo:['Cardboard'],cargo:['Cardboard'],palletCargo:['Pallet01_03']}});
 for(const name of ['_missionSceneAnimalTransportSpec','_missionSceneCargoAsset','_missionSceneCargoLooksLikeSmallLoosePayload'])extract('sync.js',name,c);
 for(const name of ['_missionCargoPrimaryTravelsWithPassenger','_missionCargoGenerateManifest'])extract('mission-cargo-core.js',name,c);
 for(const kind of ['live_animal','veterinary_material']){
  const shipment={...raw.shipment,kind,weightLbs:4,species:kind==='live_animal'?'Igel':'',animalCount:kind==='live_animal'?2:null,label:kind==='live_animal'?'2 Igel in belüfteter Kleinbox':'Tierarztmaterial'};
  c.currentMissionData=core.mission(core.validate({...raw,shipment},input),written,'',{});
  const manifest=c._missionCargoGenerateManifest(c._missionSceneCargoAsset()),load=manifest.items.find(x=>x.id==='primary-cargo');
  assert.equal(load.label,shipment.label);assert.equal(load.weightLbs,4);assert.equal(load.objectTitle,kind==='live_animal'?'VFR Multitool Mission Pet Carrier Cargo':'Cardboard');
  assert.equal(load.required,true);assert.equal(load.deliverAtDestination,true);assert.equal(load.handoffWithPassenger,false);assert.equal(manifest.items.filter(x=>x.itemType==='passenger').length,1);
 }
});
