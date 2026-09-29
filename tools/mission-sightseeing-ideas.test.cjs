const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const core=require('../mission-sightseeing-ideas-core'),sources=require('../mission-sightseeing-context-core'),voice=require('../mission-route-voice-core'),club=require('../mission-club-ideas-core');
require('../mission-private-outing-core');const flight=require('../mission-private-episode-v6');
const route={start:{name:'Start',lat:48,lon:8},target:{name:'Ziel',lat:49,lon:8}};
// Synthetic fixtures never enter production prompts or real source lookup.
const places=[1,2,3].map(i=>({id:'wiki-'+i,pageid:i,name:'Testort '+i,lat:49+i/100,lon:8,source:'https://de.wikipedia.org/?curid='+i,retrievedAt:'2026-09-28',facts:[{id:'fact-'+i,text:'Belegte Beschreibung des Testortes mit eigenständigen historischen Merkmalen für den geplanten Besuch.'}]}));
const input=core.frame(route,3,places),raw={theme:'Besuch in der Zielregion',summary:'Die Gruppe besucht die ausgewählten Orte nach der Landung.',groundPlan:'Nach der Landung setzen sie ihren Besuch am Boden fort.',passengerCount:2,groupLabel:'Reisegruppe',passenger:{name:'Ada',role:'Reisende',gender:'female',personality:'Neugierig und heiter'},luggageLabel:'Tagesgepäck',luggageWeightLbs:14,memory:'Orte und ihre Besonderheiten stehen im Vordergrund.',visits:places.map(p=>({placeId:p.id,factIds:p.facts.map(f=>f.id),interest:'Den Ort und seine Geschichte kennenlernen.'})),narrativeEvents:[]};
const written={title:'Zu den Besuchszielen',intro:'Ada und ihre Begleitung möchten die Orte kennenlernen.',outro:'Du bringst sie zum Zielflugplatz; anschließend beginnt der Besuch am Boden.',greeting:'Hallo, wir freuen uns auf unseren Besuch nach der Landung.',memory:'Die Besonderheiten der Orte verbinden die Absätze.',visitSections:places.map(p=>({placeId:p.id,factIds:p.facts.map(f=>f.id),text:'Die Beschreibung dieses Testortes stellt seine historischen Merkmale in den Mittelpunkt. Die Reisenden möchten diese nach der Ankunft am Boden genauer kennenlernen.'})),flightBriefing:''};
const clone=x=>JSON.parse(JSON.stringify(x));
function extract(file,name,c){const code=fs.readFileSync(file,'utf8'),a=code.indexOf('function '+name+'('),b=code.indexOf('\nfunction ',a+1);assert.ok(a>=0);vm.runInContext(code.slice(a,b<0?undefined:b),c);}
function storage(){const map=new Map();return {getItem:k=>map.get(k),setItem:(k,v)=>map.set(k,v)};}
function browser(request){let lookups=0;const c=vm.createContext({console,window:{MissionSightseeingIdeasCore:core,MissionSightseeingContextCore:{resolve:async()=>{lookups++;return places;}},MissionClubIdeasCore:club,MissionPrivateEpisodeV6:flight,MissionCargoIdeasCore:require('../mission-cargo-ideas-core')},localStorage:storage(),getMissionAircraftCapabilitySnapshot:()=>({passengerCapacity:3}),missionTrackerSupportsGroupGeneration:()=>true,getSelectedAiApiKey:()=>'',fetchGeminiJsonWithFallback:request,missionProposalCompactTarget:x=>x,missionProposalFormatRoute:()=>({label:'Route'})});extract('app.js','normalizeMissionProposalChoice',c);extract('app.js','compactMissionProposalChoice',c);vm.runInContext(fs.readFileSync('mission-sightseeing-browser.js','utf8'),c);c.lookups=()=>lookups;return c;}
test('one to three evidence-backed places, exact radius and bounded passengers',()=>{
 for(const count of [1,2,3]){const idea=core.validate({...raw,visits:raw.visits.slice(0,count)},input);assert.ok(idea);assert.ok(core.prose({...written,visitSections:written.visitSections.slice(0,count)},idea));}
 for(const visits of [[],[...raw.visits,raw.visits[0]],[null],[{...raw.visits[0],placeId:'invented'}],[{...raw.visits[0],factIds:['invented']}]])assert.equal(core.validate({...raw,visits},input),null);
 assert.equal(core.validate(raw,{...input,maxPassengers:1}),null);
 assert.equal(core.frame(route,3,[{...places[0],lat:49.3}]).places.length,0);
 assert.equal(core.validate(raw,{...input,places:places.map(p=>({...p,lat:49.3}))}),null);
});
test('zero to three optional events use only selected facts and exact geo anchors',()=>{
 for(const count of [0,1,2,3]){const narrativeEvents=places.slice(0,count).map((p,i)=>({intent:'Gedanke zum geplanten Besuch '+i,placeIds:[p.id],factIds:[p.facts[0].id],atPercent:20+i*25}));assert.equal(core.validate({...raw,narrativeEvents},input).narrativeEvents.length,count);}
 const geo={anchorId:places[0].id,lat:places[0].lat,lon:places[0].lon,radiusNm:2},e={intent:'Vorfreude',placeIds:['wiki-1'],factIds:['fact-1'],geo};
 assert.ok(core.validate({...raw,narrativeEvents:[e]},input));
 for(const patch of [{factIds:['fact-2']},{placeIds:['invented']},{geo:{...geo,lat:49.2}},{atPercent:20}])assert.equal(core.validate({...raw,narrativeEvents:[{...e,...patch}]},input),null);
});
test('writer requires every selected place exactly once and rejects unresolved placeholders',()=>{
 const idea=core.validate(raw,input);assert.ok(core.prose(written,idea));
 for(const patch of [{visitSections:written.visitSections.slice(0,2)},{visitSections:[written.visitSections[0],written.visitSections[0],written.visitSections[2]]},{intro:'[[missing]]'},{visitSections:[null,...written.visitSections.slice(1)]}])assert.equal(core.prose({...written,...patch},idea),null);
});
test('legacy APT rewrite cannot replace sourced visit story, title or greeting',()=>{
 const c=vm.createContext({window:{}});for(const name of ['classifyAptMissionCategory','personalizeAptCharterMission','applyMissionTaskProfileToMission','synchronizeMissionPartyPresentation','_sanitizeSightseeingTourNarrative','_missionPipelineV4FinalizeStory','_missionPipelineV4FinalizeGreeting'])extract('app.js',name,c);
 const idea=core.validate(raw,input),m=core.mission(idea,core.prose(written,idea),'Wetter',{}),contract={sightseeingIdea:idea};
 assert.equal(c.classifyAptMissionCategory(m),'std');assert.equal(c.personalizeAptCharterMission(m),m);assert.equal(c.synchronizeMissionPartyPresentation(m),m);assert.equal(c._sanitizeSightseeingTourNarrative(m,false),m);assert.equal(c.applyMissionTaskProfileToMission(m,false,'sightseeing_tour').mission.s,m.s);assert.equal(c._missionPipelineV4FinalizeStory(m.s,contract),m.s);assert.equal(c._missionPipelineV4FinalizeGreeting(m.passenger,contract).greetingText,written.greeting);
 const line=fs.readFileSync('app.js','utf8').split('\n').find(l=>l.includes('const useSightseeingIdeas ='));
 const base={isPOI:false,isBushDispatch:false,isPlanningOnlyMode:false,followupSeed:null,aiModeEnabled:true,dispatchProfileId:'sightseeing_tour'};
 assert.equal(vm.runInNewContext(line+'\nuseSightseeingIdeas;',base),true);
 for(const patch of [{isPOI:true},{followupSeed:{}},{isBushDispatch:true},{aiModeEnabled:false},{dispatchProfileId:'auto'}])assert.equal(vm.runInNewContext(line+'\nuseSightseeingIdeas;',{...base,...patch}),false);
});
test('picker selection survives compacting, reuses facts and refreshes weather only',async()=>{
 let calls=0;const c=browser(async()=>({parsed:++calls===1?{ideas:[0,1,2].map(i=>({...raw,candidateId:'sightseeing-'+i}))}:{...written,flightBriefing:'Die Strecke beträgt [[route.distance]]. Wind bei [[start.station]]: [[start.wind]].'}}));
 const rows=await c.window.MissionSightseeingBrowser.choices([route.target,route.target,route.target],{start:route.start}),choice=clone(c.compactMissionProposalChoice(rows[0]));assert.equal(c.lookups(),3);
 const args={start:route.start,dest:route.target,proposal:choice.sightseeingProposal,contract:{route:{distanceNm:60},weather:{dep:{raw:{station:'EDDS',windKts:7}}}}};
 const m=await c.window.MissionSightseeingBrowser.story(args);assert.equal(calls,2);assert.equal(c.lookups(),3);assert.deepEqual(m.sightseeingIdea.visits,core.validate(raw,input).visits);assert.match(m.s,/7 Knoten/);assert.equal(m.passengerCount,2);
 c.getMissionAircraftCapabilitySnapshot=()=>({passengerCapacity:1});await assert.rejects(()=>c.window.MissionSightseeingBrowser.story(args),/Reisegruppe/);assert.equal(calls,2);
 await assert.rejects(()=>c.window.MissionSightseeingBrowser.story({...args,dest:{...route.target,lat:50}}),/Route/);
});
test('direct generation and weather repair preserve selected facts and prose',async()=>{
 let calls=0;const c=browser(async()=>({parsed:++calls===1?{ideas:[{...raw,candidateId:'direct'}]}:calls===2?{...written,flightBriefing:'Wind 999 Knoten'}:{intro:'Wrong',flightBriefing:'Die Strecke beträgt [[route.distance]]. Wind bei [[start.station]]: [[start.wind]].'}}));
 const m=await c.window.MissionSightseeingBrowser.story({start:route.start,dest:route.target,contract:{route:{distanceNm:60},weather:{dep:{raw:{station:'EDDS',windKts:7}}}}});assert.equal(calls,3);assert.equal(c.lookups(),1);assert.match(m.s,/7 Knoten/);assert.doesNotMatch(m.s,/Wrong|999|\[\[/);assert.equal(m.sightseeingIdea.visitSections.length,3);
});
test('source resolver rejects out-of-range coordinates, unknown selection and missing extracts',async()=>{
 const target={lat:41,lon:7},page={pageid:101,title:'Testort',coordinates:[{lat:41.01,lon:7}],extract:'Eine belegte Beschreibung des Testortes. '.repeat(5)};
 const response=p=>({ok:true,json:async()=>({query:{pages:{[p.pageid]:p}}})});
 let count=0;const fetcher=async()=>{count++;return response(page);};
 const rows=await sources.resolve(target,fetcher,p=>[p[0].id]);assert.equal(rows.length,1);assert.equal(count,3);assert.match(rows[0].source,/curid=101/);
 assert.equal(sources.places({query:{pages:{101:{...page,coordinates:[{lat:42,lon:7}]}}}},target).length,0);
 await assert.rejects(()=>sources.resolve(target,fetcher,()=>['wiki-invented']),/unbekannte/);
 await assert.rejects(()=>sources.resolve(target,async()=>response({...page,extract:''}),p=>[p[0].id]),/beschriebenen/);
});
test('history remembers factual targets and angles without forcing event count',()=>{const s=storage(),idea=core.validate(raw,input),prose=core.prose(written,idea);for(let i=0;i<30;i++)core.remember(s,'m'+i,idea,prose);assert.ok(core.history(s).length<=12);assert.deepEqual(core.history(s).at(-1).places,places.map(p=>p.name));assert.deepEqual(core.history(s).at(-1).eventIntents,[]);});

test('app Sim telemetry uses sightseeing plan, commits before speaking and defers to tracker authority',()=>{
 let tracker=false,calls=0;
 const c=vm.createContext({window:{GAMissionRouteVoiceCore:voice,paxVoiceRouteEventReady:()=>true,paxVoiceSpeakRouteEvent:()=>{assert.equal(c.missionRuntime.routeVoice.done.length,1);calls++;}},currentMissionData:{sightseeingIdea:{schema:core.VERSION,narrativeEvents:[{atPercent:20,intent:'Ort'}]}},routeWaypoints:[route.start,route.target],missionRuntime:{active:true},Date:{now:()=>100000},_missionExecutionAuthorityIsTracker:()=>tracker,_persistMissionRuntimeSnapshot:()=>true});
 extract('sync.js','_missionObserveRouteVoice',c);tracker=true;c._missionObserveRouteVoice(48.3,8,{onGround:false});assert.equal(calls,0);tracker=false;c._missionObserveRouteVoice(48.3,8,{onGround:false});assert.equal(calls,1);c.missionRuntime.routeVoice=clone(c.missionRuntime.routeVoice);c._missionObserveRouteVoice(48.3,8,{onGround:false});assert.equal(calls,1);
});
test('speaker schema survives authority handoff and completed local speech enters durable history',()=>{
 const c=vm.createContext({window:{activePassenger:{...raw.passenger,narrativeSchema:core.VERSION},GAMissionRouteVoiceCore:voice},currentMissionData:{sightseeingIdea:{schema:core.VERSION}},missionRuntime:{},_missionExecutionAuthorityIsTracker:()=>false,_persistMissionRuntimeSnapshot:()=>true});
 extract('passenger-voice.js','_speakerSnapshotForActivePax',c);assert.equal(c._speakerSnapshotForActivePax().narrativeSchema,core.VERSION);
 const code=fs.readFileSync('sync.js','utf8'),a=code.indexOf('window.missionRecordClubSpeech ='),b=code.indexOf('\n};',a)+3;vm.runInContext(code.slice(a,b),c);
 c.window.missionRecordClubSpeech('Schon erzählter Ortsaspekt');assert.equal(c.missionRuntime.routeVoice.spoken[0].text,'Schon erzählter Ortsaspekt');
});
test('named guest marker survives boarding recipes and enables conversational TTS',()=>{
 const boarding=require('../mission-boarding-voice-core');const speaker=boarding.normalizeSpeaker({...raw.passenger,taskDomain:'sightseeing_tour',narrativeSchema:core.VERSION});assert.equal(speaker.narrativeSchema,core.VERSION);assert.match(boarding.ttsInput('Guten Morgen.',speaker),/Mitreisender/);
 assert.equal(boarding.normalizeSpeaker({taskDomain:'sightseeing_tour',narrativeSchema:'unknown'}).narrativeSchema,undefined);
});
test('repair identifies a missing destination paragraph without replacing source facts',()=>{
 const idea=core.validate(raw,input),errors=core.proseErrors({...written,visitSections:written.visitSections.slice(1)},idea);assert.match(errors.join(' '),/wiki-1/);
 assert.match(core.validationErrors({...raw,narrativeEvents:[{atPercent:50,placeIds:['other'],factIds:['fact-1'],intent:'Gedanke'}]},input).join(' '),/kein gewähltes/);
});

test('invalid weather prose falls back to supplied observations without changing visit story',async()=>{
 let calls=0;const c=browser(async()=>({parsed:++calls===1?{ideas:[{...raw,candidateId:'direct'}]}:{...written,flightBriefing:'Wind 999 Knoten'}}));
 const m=await c.window.MissionSightseeingBrowser.story({start:route.start,dest:route.target,contract:{route:{distanceNm:60},weather:{dep:{raw:{station:'EDDS',windKts:0,gustKts:12,visKm:10,freshness:'stale',observedAt:'2026-09-28T10:00:00Z'}},dest:{raw:null}}}});
 assert.equal(calls,3);assert.equal(m._missionWriterV4Debug.weatherBriefingStatus,'observations-fallback');
 assert.match(m.s,/EDDS.*ältere Meldung.*Wind 0 kt, Böen 12 kt, Sicht 10 km/);
 assert.match(m.s,/Ziel: keine verwertbare Wetterbeobachtung/);assert.doesNotMatch(m.s,/999|\[\[|Der Wetterabsatz konnte/);
 assert.ok(m.s.startsWith(core.prose(written,core.validate(raw,input)).story));
});
test('weather instructions expose required route and gust bindings; fallback preserves missing data',()=>{
 const context=flight.flightContext({route:{distanceNm:60},weather:{dep:{raw:{station:'EDDS',windKts:5,gustKts:9}}}});
 const prompt=core.weatherPrompt({context,bindings:flight.flightBindings(context)});
 assert.match(prompt,/VERBINDLICHE REFERENZEN: \[\[route.distance\]\], \[\[start.gust\]\]/);
 const fallback=core.weatherFallback(context);assert.match(fallback,/Aktualität unbekannt/);assert.match(fallback,/Zu Sicht, Wolkenhöhe fehlen Angaben/);assert.doesNotMatch(fallback,/windstill|böenfrei/);
});
