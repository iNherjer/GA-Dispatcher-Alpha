const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const core=require('../mission-apt-news-ideas-core.js'),charter=require('../mission-charter-ideas-core.js'),club=require('../mission-club-ideas-core.js');
require('../mission-private-outing-core.js');const flight=require('../mission-private-episode-v6.js');
const route={start:{name:'Start',lat:48,lon:8},target:{name:'Ziel',lat:49,lon:8}};
const input=core.frame(route,{name:'Testflugzeug',maxPayloadKg:400,passengerCapacity:3});
// Fixtures exercise identity and weight; these are never imported into production prompts.
const raw={urgency:'normal',purpose:'Ein Hangar wird zur offenen Werkstatt',background:'Eine fiktive Initiative plant ihren ersten gemeinsamen Werkstatttag.',angle:'Wie organisieren die Beteiligten die gemeinsame Nutzung?',groundPlan:'Nach dem Empfang mit dem Ansprechpartner zur Werkstatt gehen und die Beteiligten interviewen.',publication:'Eine kurze Reportage für das fiktive Stadtmagazin.',sender:'Fiktive Redaktion Blickpunkt',recipient:'Klara vom fiktiven Werkstattverein',arrival:'Klara übernimmt Mara am Abstellbereich und fährt mit ihr im Van zum vereinbarten Treffpunkt.',character:'Neugierig und menschlich',memory:'Gemeinschaftliche Nutzung statt große Eröffnung',passenger:{name:'Mara',role:'Lokalreporterin',gender:'female',personality:'Aufmerksam und heiter',connection:'Recherchiert für das Stadtmagazin.'},shipment:{label:'Kamera und Audiorecorder',weightLbs:22,packaging:'Gepolsterte Tasche',handling:'Vor Stößen schützen.'}};
const written={title:'Eine Werkstatt für mehrere Vereine',story:'Eine fiktive Initiative will ihre Werkstatt erstmals gemeinsam nutzen. Mara begleitet die Beteiligten für das Stadtmagazin Blickpunkt und möchte erfahren, wie sie die unterschiedlichen Bedürfnisse zusammenbringen. Du fliegst sie zum Zielplatz. Dort soll Klara sie am Abstellbereich empfangen und zum vereinbarten Treffpunkt fahren; die Interviews stehen erst danach an.',memory:'Einstieg über die gemeinsame Nutzung.',greeting:'Hallo, ich bin Mara. Mich interessiert heute besonders, wie die Beteiligten sich den Raum teilen.',pilotNotes:'Die gepolsterte Kameratasche vor Stößen schützen.'};
function extract(file,name,c){const code=fs.readFileSync(file,'utf8'),a=code.indexOf('function '+name+'('),b=code.indexOf('\nfunction ',a+1);assert.ok(a>=0);vm.runInContext(code.slice(a,b<0?undefined:b),c);}
function storage(){const map=new Map();return {getItem:k=>map.get(k),setItem:(k,v)=>map.set(k,v)};}
function browser(request){const c=vm.createContext({console,window:{MissionAptNewsIdeasCore:core,MissionCharterIdeasCore:charter,MissionClubIdeasCore:club,MissionPrivateEpisodeV6:flight},localStorage:storage(),getMissionAircraftCapabilitySnapshot:()=>({name:'Test',maxPayloadKg:400,passengerCapacity:3}),getSelectedAiApiKey:()=>'',fetchGeminiJsonWithFallback:request,missionProposalCompactTarget:x=>x,missionProposalFormatRoute:()=>({label:'Route'})});extract('app.js','normalizeMissionProposalChoice',c);extract('app.js','compactMissionProposalChoice',c);vm.runInContext(fs.readFileSync('mission-apt-news-browser.js','utf8'),c);return c;}
test('APT classification and legacy presentation keep narrator and needs intact',()=>{
 const c=vm.createContext({window:{}});for(const name of ['classifyAptMissionCategory','personalizeAptCharterMission','applyMissionTaskProfileToMission','synchronizeMissionPartyPresentation'])extract('app.js',name,c);
 const m=core.mission(core.validate(raw,input),written,'Wetter',{});m.s+=' Der Kunde benötigt die Sendung bald.';
 assert.equal(c.classifyAptMissionCategory(m),'std');assert.equal(c.personalizeAptCharterMission(m),m);assert.equal(c.synchronizeMissionPartyPresentation(m),m);assert.equal(c.applyMissionTaskProfileToMission(m,false,'news_coverage').mission.s,m.s);
});
test('quota/cloud/restart preserve the full report idea and delivery context',()=>{
 const c=vm.createContext({window:{}});extract('app.js','compactMissionObjectForQuotaStorage',c);extract('sync.js','_syncCompactMissionObjectCore',c);
 const idea=core.validate(raw,input),saved=c.compactMissionObjectForQuotaStorage({aptNewsIdea:idea,missionContract:{aptNewsIdea:idea},passengerCount:1});
 const restored=JSON.parse(JSON.stringify(c._syncCompactMissionObjectCore(saved)));assert.deepEqual(restored.aptNewsIdea,idea);assert.deepEqual(restored.missionContract.aptNewsIdea,idea);assert.equal(restored.passengerCount,1);
});
test('history is bounded, idempotent and remembers purpose rather than only cargo names',()=>{
 const s=storage(),idea=core.validate(raw,input);for(let i=0;i<30;i++)core.remember(s,'id'+i,idea,written);core.remember(s,'id29',idea,written);
 const rows=core.history(s);assert.ok(rows.length<=12);assert.equal(rows.filter(r=>r.id==='id29').length,1);assert.equal(rows.at(-1).purpose,raw.purpose);assert.equal(rows.at(-1).writerMemory,written.memory);assert.ok(JSON.stringify(rows).length<=12000);
});

test('reporter needs one identity and concrete equipment',()=>{
 const idea=core.validate(raw,input);assert.ok(idea);
 for(const patch of [{passenger:null},{passengerCount:0},{passengerCount:2},{narrativeEvents:[{atPercent:50}]},{shipment:{...raw.shipment,handling:''}},{shipment:{...raw.shipment,weightLbs:320}}])assert.equal(core.validate({...raw,...patch},input),null);
 assert.equal(core.validate(raw,{...input,passengerCapacity:0}),null);
 const m=core.mission(idea,written,'Wetter',{});
 assert.equal(m.passengerCount,1);assert.equal(m.passenger.name,'Mara');assert.equal(m.passenger.greetingText,written.greeting);assert.equal(m.passenger.cargoSensitivity,'mittel');assert.equal(m.passenger.bankTolerance,'mittel');assert.equal(m.passenger.urgencyPriority,'niedrig');assert.equal(m._missionPlanV2.plan.taskDomain,'news_coverage');
});
test('picker and acceptance preserve the reporter and exact shipment',async()=>{
 let calls=0;const c=browser(async()=>({parsed:++calls===1?{ideas:[0,1,2].map(i=>({...raw,candidateId:'apt-news-'+i}))}:{...written,flightBriefing:''}}));
 const choices=await c.window.MissionAptNewsBrowser.choices([route.target,{...route.target,lat:50},{...route.target,lat:51}],{start:route.start});
 const choice=JSON.parse(JSON.stringify(c.compactMissionProposalChoice(choices[0])));
 const m=await c.window.MissionAptNewsBrowser.story({start:route.start,dest:route.target,proposal:choice.aptNewsProposal});
 assert.equal(calls,2);assert.equal(m.passenger.name,'Mara');assert.equal(m.aptNewsIdea.shipment.label,raw.shipment.label);assert.equal(m._missionContractV4.profile.taskDomain,'news_coverage');assert.match(m.s,/keine verwertbaren Wetter/);
 c.getMissionAircraftCapabilitySnapshot=()=>({passengerCapacity:0,maxPayloadKg:400});await assert.rejects(()=>c.window.MissionAptNewsBrowser.story({start:route.start,dest:route.target,proposal:choice.aptNewsProposal}),/Flugzeug/);assert.equal(calls,2);
});
test('new APT contract survives legacy profile matching without affecting POI ownership',()=>{
 const c=vm.createContext({window:{}});extract('app.js','missionMatchesTaskProfile',c);
 const m=core.mission(core.validate(raw,input),written,'Wetter',{});
 assert.equal(c.missionMatchesTaskProfile(m,'news_coverage',false),true);
});
test('APT reporter remains scoped and equipment travels with passenger',()=>{
 const line=fs.readFileSync('app.js','utf8').split('\n').find(l=>l.includes('const useAptNewsIdeas ='));
 const base={isPOI:false,isBushDispatch:false,isPlanningOnlyMode:false,followupSeed:null,aiModeEnabled:true,dispatchProfileId:'news_coverage'};
 assert.equal(vm.runInNewContext(line+'\nuseAptNewsIdeas;',base),true);
 for(const patch of [{dispatchProfileId:'auto'},{followupSeed:{}},{isPOI:true},{isBushDispatch:true},{isPlanningOnlyMode:true},{aiModeEnabled:false}])assert.equal(vm.runInNewContext(line+'\nuseAptNewsIdeas;',{...base,...patch}),false);
 const c=vm.createContext({_missionCargoHasPassengerMission:()=>true});extract('mission-cargo-core.js','_missionCargoPrimaryTravelsWithPassenger',c);assert.equal(c._missionCargoPrimaryTravelsWithPassenger('news_coverage'),true);
});
test('manifest retains reporter-owned equipment and original passenger handoff',()=>{
 const c=vm.createContext({window:{currentMissionData:{}},_missionCargoMissionKey:()=> 'test',_missionCargoAircraftSlot:()=> 'plane',_missionSceneTaskDomain:()=> 'news_coverage',_activeBushMissionSpec:()=>null,_missionCargoPrimaryText:()=> 'Kamera und Audiorecorder (22 lbs)',_missionCargoCleanLabel:x=>x,_missionCargoIsPoiMission:()=>false,_missionCargoHasPassengerMission:()=>true,_missionCargoPassengerCount:()=>1,_missionScenePassengerGender:()=> 'female',_missionScenePersonTitle:()=> 'Person',_missionCargoPassengerLabel:()=> 'Mara',_missionCargoPassengerTotalWeightLbs:()=>170,_missionScenePersonCandidates:()=> ['Person'],_missionSceneCargoAsset:()=>({title:'Cardboard',candidates:['Cardboard']}),_missionCargoPushItem:(items,item)=>items.push(item),_missionCargoExtractWeight:()=>22,_missionCargoPrimaryTravelsWithPassenger:()=>true,_missionCargoPersistentEquipmentDefinitions:()=>[],_missionCargoApplyStoredOnboardEquipment:()=>{},MISSION_SCENE_ASSET_POOLS:{cargo:['Cardboard'],palletCargo:['Pallet']}});
 extract('mission-cargo-core.js','_missionCargoGenerateManifest',c);
 const before=c._missionCargoGenerateManifest();c.window.currentMissionData.aptNewsIdea=core.validate(raw,input);const after=c._missionCargoGenerateManifest();
 for(const items of [before.items,after.items]){assert.equal(items.some(x=>x.itemType==='passenger'),true);const p=items.find(x=>x.id==='primary-cargo');assert.equal(p.required,true);assert.equal(p.deliverAtDestination,true);assert.equal(p.deliverAtHome,false);assert.equal(p.handoffWithPassenger,true);assert.equal(p.weightLbs,22);}
 assert.deepEqual(after.items.map(x=>({id:x.id,required:x.required,deliverAtDestination:x.deliverAtDestination})),before.items.map(x=>({id:x.id,required:x.required,deliverAtDestination:x.deliverAtDestination})));
});
test('arrival resolver retains planned media contact',()=>{
 const c=vm.createContext({normalizeMissionType:()=> 'apt'});extract('app.js','getMissionPlanV2Plan',c);extract('mission-definition-core.js','normalizeAptArrivalRole',c);
 const m=core.mission(core.validate(raw,input),written,'Wetter',{});
 const role=c.normalizeAptArrivalRole({mission:m,paxText:m.pax,cargoText:m.cargo,profileId:'news_coverage',missionPlanV2:m._missionPlanV2});assert.equal(role.role,'media_pickup');assert.equal(role.personRole,'person.ground_crew');assert.equal(role.expectedBy,raw.recipient);assert.equal(role.narrativeHint,raw.arrival);assert.equal(role.vehicleRole,'vehicle.van');
});

test('weather repair cannot rewrite the accepted cargo story or reporter',async()=>{
 let calls=0;const c=browser(async()=>({parsed:++calls===1?{ideas:[{...raw,candidateId:'direct'}]}:calls===2?{...written,flightBriefing:'Wind 999 Knoten'}:{story:'Wrong story',greeting:'Wrong voice',flightBriefing:'Die Strecke beträgt [[route.distance]]. Wind bei [[start.station]]: [[start.wind]].'}}));
 const m=await c.window.MissionAptNewsBrowser.story({start:route.start,dest:route.target,contract:{route:{distanceNm:60},weather:{dep:{raw:{station:'EDDS',windKts:7}}}}});
 assert.equal(calls,3);assert.equal(m._missionWriterV4Debug.rawAiStory,written.story);assert.equal(m.passenger.greetingText,written.greeting);assert.match(m.s,/7 Knoten/);assert.doesNotMatch(m.s,/Wrong|999|\[\[/);
});

test('reportage fields and urgency survive contract while history remains separate',()=>{
 for(const k of ['angle','groundPlan','publication'])assert.equal(core.validate({...raw,[k]:''},input),null);
 assert.equal(core.validate({...raw,urgency:'emergency'},input),null);
 assert.equal(core.validate({...raw,urgency:'time_sensitive'},input).urgency,'time_sensitive');
 const m=core.mission(core.validate(raw,input),written,'',{});assert.equal(m.passenger.narrativeSchema,core.VERSION);assert.match(core.voiceContext(m.aptNewsIdea),/Bodenrecherche/);assert.equal(m.aptNewsIdea.groundPlan,raw.groundPlan);
 for(const path of ['../mission-medical-transfer-ideas-core.js','../mission-news-briefing-core.js'])assert.notEqual(require(path).HISTORY_KEY,core.HISTORY_KEY);
});

test('actual passenger voice context retains the full planned ground report after restore',()=>{
 const m=core.mission(core.validate(raw,input),written,'',{});
 const c=vm.createContext({window:{activePassenger:m.passenger,MissionAptNewsIdeasCore:core},currentMissionData:{missionContract:{aptNewsIdea:m.aptNewsIdea}},localStorage:{getItem:()=>null},document:{getElementById:()=>({innerText:''})},_getMissionStory:()=>m.s,_sanitizePaxSoftPoiStory:x=>x,_activeTaskDomain:()=> 'news_coverage',_isPOIMission:()=>false,_normUrgencyPriority:()=> 'niedrig',_missionHasPax:()=>true,_personaNarrativeSeedAllowed:()=>true});
 for(const name of ['_activeBushPickupPassengerContract','_roleStyleHint','_personaPersonalityLabel','_personaSpeechSignature','_activeAptTrainingPlan','_aptArrivalContextLine','_poiSightseeingKnowledgeContextLine','_paxTargetProminenceLine','_paxVisualLandmarksLine','_activeMissionStoryFrame','_bushVoiceToneLine','_bushPickupPassengerPerspectiveLine'])c[name]=()=>null;
 extract('passenger-voice.js','_bushStoryNarrativeContinuityHint',c);
 extract('passenger-voice.js','_baseContext',c);
 const restored=JSON.parse(JSON.stringify({baseContext:c._baseContext()}));
 assert.ok(restored.baseContext.includes(raw.angle));assert.ok(restored.baseContext.includes(raw.publication));assert.ok(restored.baseContext.includes(raw.groundPlan));assert.match(restored.baseContext,/keine Luftaufnahme oder Suche/);
});

test('reporter route plan is bounded, optional and never creates flight tasks',()=>{
 const v=require('../mission-route-voice-core.js');
 const idea=core.validate({...raw,narrativeEvents:[{atPercent:25,intent:'Ein Gespräch über unterschiedliche Erwartungen.'},{atPercent:60,intent:'Eine offene Frage an die Beteiligten.'}]},input);
 assert.equal(idea.narrativeEvents.length,2);assert.equal(core.validate({...raw,narrativeEvents:[{intent:'x',geo:{lat:48,lon:8,radiusNm:2}}]},input),null);
 assert.match(v.prompt(core.voiceContext(idea),idea.narrativeEvents[0],[],idea.schema),/drei bis fünf/);
 const facts={now:100000,lat:48.6,lon:8,onGround:false,active:true,enabled:true};
 const once=v.observe(idea.narrativeEvents,[route.start,route.target],{},facts);assert.ok(once.event);
 assert.equal(v.observe(idea.narrativeEvents,[route.start,route.target],once.state,{...facts,now:101000}).event,null);
 assert.equal(v.observe(idea.narrativeEvents,[route.start,route.target],{}, {...facts,onGround:true}).event,null);
});
test('confirmed reporter arrival creates optional return with original identity and heard speech',()=>{
 const c=require('../mission-charter-continuation-core.js'),now=Date.now();
 const idea=core.validate({...raw,returnPlan:{offered:true,reason:'Rückreise nach den Interviews.',stayHours:3,stayText:'Drei Stunden für Gespräche und Bilder.'}}, {...input,route:{start:{...route.start,icao:'EDAA'},target:{...route.target,icao:'EDBB'}}});
 const md={aptNewsIdea:idea,missionId:'news-test',passenger:core.mission(idea,written,'',{}).passenger,charterHeardSpeech:[{text:'Die Beteiligten haben unterschiedliche Erwartungen.'}]};
 const record={missionId:md.missionId,completionId:'done',endedAt:now,result:'completed',privateOutingEvidence:{flown:true,atTarget:true,groundStill:true}};
 assert.equal(c.request(md,{...record,result:'failed'},now),null);
 const req=c.request(md,record,now);assert.ok(req);assert.equal(req.passenger.taskDomain,'news_coverage');assert.equal(req.eligibleAt,now+3*3600000);assert.equal(req.charterContinuation.original.passenger.name,raw.passenger.name);assert.equal(req.charterContinuation.heardOutbound.length,1);
 assert.match(c.draftPrompt(req.charterContinuation),/fiktiven Aufenthalt/);
 const draft={experience:'Die Reporterperson hat beide Vereine interviewt und ihre unterschiedlichen Wünsche aufgenommen.',reason:'Die Gespräche sind beendet und die Reporterperson möchte zur Redaktion zurückkehren.',nextStep:'Die Reporterperson sichtet dort ihre Aufnahmen und schreibt die gemeinsame Reportage.',memory:'Unterschiedliche Wünsche werden nach den Gesprächen zu einer konkreten menschlichen Reportage.',narrativeEvents:[{atPercent:35,intent:'Die unterschiedlichen Wünsche der beiden Vereine erzählen.'}]};
 req.charterContinuation.experience=c.validateDraft(draft,req.charterContinuation);
 const back=c.continuationIdea(req);assert.equal(back.schema,core.VERSION);assert.equal(back.route.target.icao,'EDAA');assert.equal(back.shipment.weightLbs,22);assert.match(core.voiceContext(back),/bereits geschehen/);
 assert.equal(c.source({aptNewsIdea:back}),false);
 const mission=c.applyMission(req,{followUpContinuation:{},_appliedProfile:'apt_charter'},core.mission(back,written,'',{}));assert.equal(mission.passenger.taskDomain,'news_coverage');assert.equal(mission.charterIdea,null);assert.equal(mission.aptNewsIdea.schema,core.VERSION);
 const svc=require('../ga-tracker-client/tracker-mission-followup.js').service([],now);assert.equal(svc.create(md,null,{completionRecord:record}).created,true);assert.equal(svc.create(md,null,{completionRecord:record}).created,false);
 const saved=svc.saveCharterExperience(req.id,draft);assert.ok(saved);assert.deepEqual(svc.saveCharterExperience(req.id,{...draft,experience:'Another unrelated version with a different outcome entirely.'}).experience,saved.experience);
});
test('reporter return browser reuses saved stay, keeps equipment and accepts a detailed retrospective',async()=>{
 const continuation=require('../mission-charter-continuation-core.js');let calls=0;
 const c=browser(async()=>{calls++;return {parsed:{...written,story:'Die fiktive Recherche liegt hinter Mara. Sie hat unterschiedliche Interessen der Vereine kennengelernt und kehrt nun zur Redaktion zurück. Dort möchte sie Bildmaterial und Interviews sichten, offene Aussagen prüfen und ihre Reportage schreiben. Du übernimmst den Rückflug zum ursprünglichen Ausgangsplatz.',flightBriefing:''}};});
 c.window.MissionCharterContinuationCore=continuation;
 const now=Date.now(),idea=core.validate({...raw,returnPlan:{offered:true,reason:'Nach der Recherche zurück zur Redaktion.',stayHours:2,stayText:'Zwei Stunden für Gespräche.'}}, {...input,route:{start:{...route.start,icao:'EDAA'},target:{...route.target,icao:'EDBB'}}});
 const req=continuation.request({aptNewsIdea:idea,missionId:'return-browser'},{missionId:'return-browser',completionId:'done',endedAt:now,result:'completed',privateOutingEvidence:{flown:true,atTarget:true,groundStill:true}},now);
 req.charterContinuation.experience={experience:'Mara hat die unterschiedlichen Wünsche der fiktiven Vereine dokumentiert. '.repeat(11),reason:'Die Gespräche sind beendet und Mara möchte ihre gesammelten Aufnahmen zur Redaktion bringen.',nextStep:'Mara sichtet ihr Material und arbeitet danach an einer Reportage über die gemeinsame Nutzung.',memory:'Die unterschiedlichen Raumwünsche zeigen die menschliche Seite des gemeinsamen Projekts.',narrativeEvents:[{atPercent:40,intent:'Von den unterschiedlichen Wünschen berichten.'}]};
 const args={req,base:{followUpContinuation:{},_appliedProfile:'apt_charter'},contract:{route:{distanceNm:60}},aiEnabled:true};
 const m=await c.window.MissionAptNewsBrowser.continuation(args);assert.equal(calls,1);assert.equal(m.aptNewsIdea.background,req.charterContinuation.experience.experience.trim());assert.equal(m.passenger.name,raw.passenger.name);assert.equal(m.passenger.taskDomain,'news_coverage');assert.equal(m.aptNewsIdea.shipment.weightLbs,22);assert.equal(m.aptNewsIdea.narrativeEvents.length,1);
 await assert.rejects(()=>c.window.MissionAptNewsBrowser.continuation({...args,aiEnabled:false}),/KI aktivieren/);assert.equal(calls,1);
});
test('later reporter pickup retains original home on the map and withholds return narration until boarding',()=>{
 const continuation=require('../mission-charter-continuation-core.js');
 const A={lat:48,lng:8,lon:8,icao:'EDAA',name:'Heimat'},B={lat:49,lng:8,lon:8,icao:'EDBB',name:'Rechercheort'},C={lat:48.5,lng:9,lon:9,icao:'EDCC',name:'Drittplatz'};
 const source=fs.readFileSync('map.js','utf8'),a=source.indexOf('function updateMap('),b=source.indexOf('\nasync function updateMapFromInputs',a);
 const c=vm.createContext({map:{},currentSName:'',currentDName:'',currentStartICAO:C.icao,currentDestICAO:B.icao,routeWaypoints:[],currentMissionData:{aptNewsIdea:{schema:core.VERSION,continuation:{pickupRequired:true}},bush:{homeRef:A}},window:{},document:{getElementById:()=>null},_syncCurrentMissionRouteFromMap(){},renderMainRoute(){}});
 vm.runInContext(source.slice(a,b),c);c.updateMap(C.lat,C.lon,B.lat,B.lon,C.name,B.name);
 assert.deepEqual(JSON.parse(JSON.stringify(c.routeWaypoints)).map(p=>p.icao),[C.icao,B.icao,A.icao]);
 const idea={continuation:{pickupRequired:true,visited:B}};
 assert.equal(continuation.voiceLeg(idea,[C,B,A],{},false).ready,false);
 assert.deepEqual(continuation.voiceLeg(idea,[C,B,A],{pickupConfirmed:true},true).route,[B,A]);
});

test('reporter speech excludes author history notes while retaining recorded stay memories',()=>{
 const idea={...core.validate(raw,input),memory:'AUTHOR_ONLY_INITIAL',writerMemory:'AUTHOR_ONLY_WRITER',continuation:{original:{...raw,memory:'AUTHOR_ONLY_ORIGINAL',writerMemory:'AUTHOR_ONLY_ORIGINAL_WRITER'},experience:{experience:'Recorded stay incident',memory:'Recorded personal recollection'}}};
 const before=JSON.stringify(idea),context=core.voiceContext(idea);
 assert.doesNotMatch(context,/AUTHOR_ONLY/);
 assert.match(context,/Recorded stay incident/);
 assert.match(context,/Recorded personal recollection/);
 assert.match(context,/Neugierig und menschlich/);
 assert.equal(JSON.stringify(idea),before);
});

test('reporter offer retries a mismatched candidate ID before accepting a route-bound idea',async()=>{
 let calls=0;
 const c=browser(async()=>({parsed:++calls===1?{ideas:[{...raw,candidateId:'invented-story-name'}]}:calls===2?{ideas:[{...raw,candidateId:'direct'}]}:{...written,flightBriefing:''}}));
 const mission=await c.window.MissionAptNewsBrowser.story({start:route.start,dest:route.target});
 assert.equal(calls,3);
 assert.equal(mission.aptNewsIdea.passenger.name,raw.passenger.name);
 assert.equal(mission.aptNewsIdea.route.target.name,route.target.name);
});
