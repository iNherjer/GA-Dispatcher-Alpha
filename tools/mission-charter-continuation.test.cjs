const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const core=require('../mission-charter-continuation-core.js');
const {service,mergeRequests,createForCompletedRun}=require('../ga-tracker-client/tracker-mission-followup.js');
const now=Date.now(),A={icao:'EDTW',name:'Winzeln',lat:48.27,lon:8.42},B={icao:'EDTE',name:'Eutingen',lat:48.48,lon:8.77},C={icao:'EDDS',name:'Drittplatz',lat:48.69,lon:9.22};
const idea={schema:'charter-idea.v1',reason:'Eine Gruppe reist zum persönlichen Austausch.',background:'Der gemeinsame Aufenthalt bietet Zeit für die geplante Zusammenarbeit.',arrival:'Die Gruppe setzt ihre Reise nach der Ankunft zusammen fort.',passengerCount:3,groupLabel:'Reisegruppe',passenger:{name:'Ada',role:'Auftraggeberin',gender:'female',personality:'Offen und zugewandt'},luggageLabel:'Reisetaschen',luggageWeightLbs:42,memory:'Eine gemeinsame Reise mit persönlichen Gesprächen.',geoAnchors:[],narrativeEvents:[],route:{start:A,target:B},returnPlan:{offered:true,reason:'Die Gruppe hat auch die gemeinsame Rückreise gebucht.',stayHours:2,stayText:'Zwei Stunden Aufenthalt'}};
const md={missionId:'charter-one',mission:'Reise',charterIdea:idea,passenger:{...idea.passenger,narrativeSchema:idea.schema},departureAirport:A,destinationAirport:B};
const record={missionId:md.missionId,completionId:'done',endedAt:now,result:'completed',privateOutingEvidence:{flown:true,atTarget:true,groundStill:true}};
const draft={experience:'Die Gruppe hat ihren geplanten Aufenthalt gemeinsam verbracht und sich ausgetauscht.',reason:'Nach dem gemeinsamen Aufenthalt ist die Gruppe bereit für die gebuchte Rückreise.',nextStep:'Nach der Ankunft fahren die Reisenden gemeinsam zu ihrem ursprünglichen Ausgangspunkt.',memory:'Der Rückblick knüpft an die Zusammenarbeit und die persönlichen Gespräche an.',narrativeEvents:[{atPercent:65,intent:'Ein persönliches Detail aus dem gespeicherten Aufenthalt erzählen.'}]};
function request(){return core.request(md,record,now);}
const clone=x=>JSON.parse(JSON.stringify(x));
test('only booked returns after proven successful completion; no chains',()=>{
 assert.ok(request());
 for(const patch of [{result:'failed'},{missionId:'other'},{privateOutingEvidence:{flown:false,atTarget:true,groundStill:true}},{privateOutingEvidence:{flown:true,atTarget:false,groundStill:true}},{cargo:{failed:true}}])assert.equal(core.request(md,{...record,...patch},now),null);
 assert.equal(core.request({...md,charterIdea:{...idea,returnPlan:{offered:false,reason:'Nur der Hinflug wurde gebucht.'}}},record,now),null);
 assert.equal(core.request({...md,followUpRequestId:'previous'},record,now),null);
 const api=service([],now);api.create(md,{}, {completionRecord:record});api.create(md,{}, {completionRecord:record});assert.equal(api.requests().length,1);
});
test('direct, home pickup and third-place pickup retain original home, group and luggage',()=>{
 const api=service([],now);
 for(const start of [A,B,C]){
  const req=request();req.acceptance=api.buildAcceptance(req,start);
  assert.equal(req.acceptance.returnHomeRef.icao,A.icao);
  const base=api.buildDispatchMission(req,{start,dest:start===B?A:B});assert.ok(base);
  req.charterContinuation.experience=draft;req.charterContinuation.pickupRequired=start!==B;
  const m=core.applyMission(req,base.mission,{passenger:md.passenger,s:'Text'});
  assert.equal(m.passenger.name,'Ada');assert.equal(m.plannedPassengerCount,3);assert.equal(m.party.count,3);
  assert.equal(m.charterIdea.luggageWeightLbs,42);assert.equal(m.charterIdea.returnPlan.offered,false);
  assert.equal(m.passengerCount,start===B?3:0);
  if(start!==B){assert.equal(m.bush.homeRef.icao,A.icao);assert.equal(m.bush.pickupPassengerCount,3);}
 }
});
test('saved stay survives reload and cloud metadata merge; terminal requests stay terminal',()=>{
 const req=request(),api=service([req],now);const saved=api.saveCharterExperience(req.id,draft);assert.ok(saved);
 assert.deepEqual(api.saveCharterExperience(req.id,{...draft,experience:'A different stay that must never replace the original stored experience.'}),saved);
 const restarted=service(api.requests(),now+1);assert.deepEqual(restarted.requests()[0].charterContinuation.experience,saved.experience);
 const stale={...req,updatedAt:now+100};const merged=mergeRequests(restarted.requests(),[stale],now+101);
 assert.deepEqual(merged[0].charterContinuation.experience,saved.experience);
 assert.equal(mergeRequests([{...req,status:'accepted',updatedAt:now}],merged,now+102)[0].status,'accepted');
});
test('pickup voices measure only occupied leg, preserving edited waypoints',()=>{
 const req=request();req.charterContinuation.experience=draft;req.charterContinuation.pickupRequired=true;const ci=core.continuationIdea(req);
 const mid={lat:48.35,lon:8.6},route=[C,B,mid,A];
 assert.equal(core.voiceLeg(ci,route,{},false).ready,false);
 assert.equal(core.voiceLeg(ci,route,{pickupCompleted:true},false).ready,false);
 assert.deepEqual(core.voiceLeg(ci,route,{pickupCompleted:true},true),{ready:true,route:[B,mid,A]});
 assert.equal(core.voiceLeg(ci,[C,A],{pickupCompleted:true},true).ready,false);
});
test('tracker completion uses same charter contract and requires measured flight',()=>{
 const run={missionId:md.missionId,executionAuthority:'tracker',resumeBundle:{missionState:{currentMissionData:md}}};
 const c={phase:'closed',flags:{closed:true,groundStill:true},cargo:{summary:{failed:false}},flight:{missionRecord:{createdAt:now,durationSec:600,telemetrySampleCount:100,distanceNm:20,distanceSource:'gps'},destination:{atDestination:true}}};
 const r=createForCompletedRun(run,c,now);assert.equal(r.requests.length,1);assert.equal(r.requests[0].charterContinuation.original.passengerCount,3);
 c.flight.missionRecord.distanceSource='planned';assert.equal(createForCompletedRun(run,c,now).requests.length,0);
});
test('continuation and event plan survive compact local/cloud storage',()=>{
 const c=vm.createContext({});for(const [file,name] of [['app.js','compactMissionObjectForQuotaStorage'],['sync.js','_syncCompactMissionObjectCore']]){const s=fs.readFileSync(file,'utf8'),a=s.indexOf('function '+name+'('),b=s.indexOf('\nfunction ',a+1);vm.runInContext(s.slice(a,b),c);}
 const req=request();req.charterContinuation.experience=draft;const ci=core.continuationIdea(req);
 const saved=c.compactMissionObjectForQuotaStorage({charterIdea:ci,missionContract:{charterIdea:ci}});
 assert.deepEqual(clone(c._syncCompactMissionObjectCore(saved)).charterIdea,ci);
});
test('writer failure reuses saved experience on retry, capacity failure makes no AI request',async()=>{
 const charter=require('../mission-charter-ideas-core.js');require('../mission-private-outing-core.js');const flight=require('../mission-private-episode-v6.js');
 let capacity=4,draftCalls=0,writerCalls=0,fail=true;
 const req=request();req.acceptance=service([],now).buildAcceptance(req,B);const api=service([req],now);
 const base=api.buildDispatchMission(req,{start:B,dest:A}).mission;
 const story='Nach ihrem gemeinsamen Aufenthalt ist Ada mit ihrer Reisegruppe bereit für den gebuchten Rückflug. Die Gespräche vor Ort haben ihnen neue Einblicke gegeben, die sie auf der Heimreise noch beschäftigen. Du bringst dieselben Reisenden und ihre Reisetaschen wieder zum ursprünglichen Ausgangsplatz zurück.';
 const c=vm.createContext({console,window:{MissionCharterIdeasCore:charter,MissionCharterContinuationCore:core,MissionPrivateEpisodeV6:flight,missionFollowupSaveCharterExperience:api.saveCharterExperience},localStorage:{getItem:()=>null},getMissionAircraftCapabilitySnapshot:()=>({passengerCapacity:capacity}),missionTrackerSupportsGroupGeneration:()=>true,getSelectedAiApiKey:()=>'',fetchGeminiJsonWithFallback:async prompt=>{
  if(prompt.startsWith('Entwickle die Fortsetzung')){draftCalls++;return {parsed:draft};}
  writerCalls++;if(fail)throw Error('offline');return {parsed:{title:'Gebuchter Rückflug',story,greeting:'Guten Tag, wir sind bereit für die Rückreise.',memory:draft.memory,flightBriefing:''}};
 }});vm.runInContext(fs.readFileSync('mission-charter-browser.js','utf8'),c);
 const args=()=>({req:clone(api.requests()[0]),base,contract:{route:{startName:B.name,targetName:A.name,distanceNm:20}}});
 await assert.rejects(()=>c.window.MissionCharterBrowser.continuation(args()),/offline/);assert.equal(draftCalls,1);
 fail=false;const m=await c.window.MissionCharterBrowser.continuation(args());assert.equal(draftCalls,1);assert.equal(m.charterIdea.background,draft.experience);assert.equal(m.party.count,3);
 capacity=2;const before=writerCalls;await assert.rejects(()=>c.window.MissionCharterBrowser.continuation(args()),/Kapazität/);assert.equal(writerCalls,before);
});
test('pickup manifest preserves group, target loading and exact optional baggage including zero',()=>{
 const src=fs.readFileSync('mission-cargo-core.js','utf8');const names=['_missionCargoGenerateManifest','_missionCargoManifestMatchesMissionRecipe','_missionCargoUpgradeBushPickupCompanionCargo'];
 for(const weight of [0,42,400]){
  const ci={...idea,luggageWeightLbs:weight,continuation:{schema:core.SCHEMA}};
  const c=vm.createContext({window:{currentMissionData:{charterIdea:ci}},_missionCargoMissionKey:()=> 'test',_missionCargoAircraftSlot:()=> 'plane',_missionSceneTaskDomain:()=> 'charter',_activeBushMissionSpec:()=>({targetMode:'strip_then_return',pickupKind:'passenger',pickupPassengerCount:3}),_missionCargoPrimaryText:()=> 'Reisetaschen',_missionCargoCleanLabel:x=>x,_missionCargoIsPoiMission:()=>false,_missionCargoHasPassengerMission:()=>false,_missionScenePassengerGender:()=> 'female',_missionScenePersonTitle:()=> 'Person',_missionScenePersonCandidates:()=>[],_missionCargoPaxWeightLbs:()=>170,_missionCargoPushItem:(items,item)=>items.push(item),_missionCargoBushPickupCompanionItem:()=>({id:'pickup-companion-cargo',pickupLocation:'target',weightLbs:18,required:true,deliverAtHome:true}),_missionCargoPersistentEquipmentDefinitions:()=>[],_missionCargoApplyStoredOnboardEquipment:()=>{}});
  for(const name of names){const a=src.indexOf('function '+name+'('),b=src.indexOf('\nfunction ',a+1);vm.runInContext(src.slice(a,b),c);}
  const manifest=c._missionCargoGenerateManifest();assert.equal(manifest.items[0].passengerCount,3);assert.equal(manifest.items[0].pickupLocation,'target');
  const luggage=manifest.items.find(x=>x.id==='pickup-companion-cargo');
  if(weight){assert.equal(luggage.weightLbs,weight);assert.equal(luggage.label,idea.luggageLabel);assert.equal(luggage.required,false);assert.equal(luggage.handoffWithPassenger,true);}else assert.equal(luggage,undefined);
  assert.equal(c._missionCargoManifestMatchesMissionRecipe(manifest),true);assert.equal(c._missionCargoUpgradeBushPickupCompanionCargo(manifest),false);
 }
});
test('new generation requires explicit return decision; older ideas remain valid',()=>{
 const charter=require('../mission-charter-ideas-core.js');const frame=charter.frame(idea.route,4,[]);const legacy={...idea};delete legacy.returnPlan;
 assert.ok(charter.validate(legacy,frame));assert.equal(charter.validate(legacy,{...frame,requireReturnPlan:true}),null);
 assert.ok(charter.validate({...idea,returnPlan:{offered:false,reason:'Der Auftrag enthält ausschließlich den Hinflug.'}},{...frame,requireReturnPlan:true}));
});
test('map route includes original home after third-place pickup and capacity keeps deferred group',()=>{
 const source=fs.readFileSync('map.js','utf8'),a=source.indexOf('function updateMap('),b=source.indexOf('\nasync function updateMapFromInputs',a);
 const c=vm.createContext({map:{},currentSName:'',currentDName:'',currentStartICAO:C.icao,currentDestICAO:B.icao,routeWaypoints:[],currentMissionData:{charterIdea:{continuation:{pickupRequired:true}},bush:{homeRef:A}},window:{},document:{getElementById:()=>null},_syncCurrentMissionRouteFromMap(){},renderMainRoute(){}});
 vm.runInContext(source.slice(a,b),c);c.updateMap(C.lat,C.lon,B.lat,B.lon,C.name,B.name);
 assert.deepEqual(clone(c.routeWaypoints).map(p=>p.icao),[C.icao,B.icao,A.icao]);
 const capability=require('../aircraft-mission-capability-core.js');const p=capability.resolveMissionPassengerPlan({paxText:'0 PAX am Start · 3 PAX Pickup (Reisegruppe)',passengerCount:0,pickupPassengerCount:3,passengerCapacity:4,maxPartySize:4});
 assert.equal(p.passengerCount,0);assert.equal(p.plannedPassengerCount,3);
});
test('structured return completion does not generate a new legacy followup',()=>{
 const req=request();req.charterContinuation.experience=draft;
 const api=service([],now);const accepted={...md,charterIdea:core.continuationIdea(req),followUpRequestId:req.id,followUpContinuation:{requestId:req.id},_appliedProfile:'apt_charter'};
 api.create(accepted,{}, {completionRecord:record});assert.equal(api.requests().length,0);
});
test('pickup weather briefs keep separate departure and return station bindings',async()=>{
 const charter=require('../mission-charter-ideas-core.js');require('../mission-private-outing-core.js');const flight=require('../mission-private-episode-v6.js');
 const req=request();req.acceptance=service([],now).buildAcceptance(req,C);req.charterContinuation.experience=draft;
 const base=service([],now).buildDispatchMission(req,{start:C,dest:B}).mission;let calls=0;
 const story='Die Reisegruppe hat ihren Aufenthalt beendet und die Rückreise gebucht. Ada hat die gemeinsamen Eindrücke noch gut in Erinnerung. Du fliegst zunächst ohne Gäste zum vereinbarten Flugplatz und nimmst dort alle Reisenden mit ihren Taschen auf. Anschließend bringst du sie zum ursprünglichen Ausgangsplatz zurück.';
 const c=vm.createContext({console,window:{MissionCharterIdeasCore:charter,MissionCharterContinuationCore:core,MissionPrivateEpisodeV6:flight},localStorage:{getItem:()=>null},getMissionAircraftCapabilitySnapshot:()=>({passengerCapacity:4}),missionTrackerSupportsGroupGeneration:()=>true,getSelectedAiApiKey:()=>'',fetchGeminiJsonWithFallback:async prompt=>{
  calls++;const brief='Die Strecke beträgt [[route.distance]]. Wind bei [[start.station]]: [[start.wind]].';
  if(calls===1)return {parsed:{title:'Gebuchte Rückreise',story,greeting:'Guten Tag, wir sind bereit.',memory:draft.memory,flightBriefing:brief}};
  assert.match(prompt,/besetzten Charter-Rückflug/);return {parsed:{flightBriefing:brief}};
 }});vm.runInContext(fs.readFileSync('mission-charter-browser.js','utf8'),c);
 const contract={route:{distanceNm:20},weather:{dep:{raw:{station:'EDDS',windKts:7}}},returnFlight:{route:{distanceNm:30},weather:{dep:{raw:{station:'EDTE',windKts:4}}}}};
 const m=await c.window.MissionCharterBrowser.continuation({req,base,contract});assert.equal(calls,2);
 assert.match(m.s,/Leerflug zur Abholung:.*20 NM.*EDDS.*7 Knoten/s);assert.match(m.s,/Besetzter Rückflug:.*30 NM.*EDTE.*4 Knoten/s);
});
