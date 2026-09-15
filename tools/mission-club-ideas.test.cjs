const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');
const core=require('../mission-club-ideas-core.js');const events=require('../mission-club-events-core.js');
const route={start:{name:'A',lat:48,lon:8},target:{name:'B',lat:49,lon:8}};
const input=core.frame(route,[],null,'2026-09-15');
const raw={occasion:'Ein gemeinsamer Besuch.',clubConnection:'Beide sind im selben Verein.',pilotIntent:'Gemeinsam teilnehmen.',passengerIntent:'Die Kollegen treffen.',groundPlan:'Am Clubheim treffen.',passenger:{name:'Ada',role:'Vereinskollegin',gender:'female',personality:'gesellig'},luggage:{label:'Persönliche Tasche',weightLbs:5},delivery:null,eventId:null,memory:'Gemeinsamer Besuch bei Kollegen.'};
const prose={title:'Zu den Kollegen',story:'Ihr habt euch mit euren Kollegen verabredet und fliegt gemeinsam zum Nachbarplatz. Ada freut sich auf das Wiedersehen, und du hast ebenfalls Zeit für die Runde eingeplant. Nach dem Abstellen geht ihr gemeinsam zum vereinbarten Treffpunkt.',greeting:'Ich freue mich auf die Runde.'};
const storage=()=>{const map=new Map();return {getItem:k=>map.get(k),setItem:(k,v)=>map.set(k,v)}};
test('Persönliche Sachen verlangen keine Lieferung; echte Sendung bleibt separat erforderlich',()=>{const idea=core.validate(raw,input);assert.ok(idea);const item={id:'primary-cargo',required:true,objectTitle:'Cardboard'};let result=core.manifestItems([item],idea);assert.equal(result[0].required,false);assert.equal(result[0].deliverAtDestination,false);assert.equal(result[0].handoffWithPassenger,true);idea.delivery={label:'Teil',weightLbs:20,receiver:'Empfänger',purpose:'Reparatur'};result=core.manifestItems([item],idea);assert.equal(result.length,2);assert.equal(result[0].required,true);assert.equal(result[0].handoffWithPassenger,false);assert.equal(result[1].required,false);assert.deepEqual(core.manifestItems([item],null),[item]);});
test('Route und Event werden geprüft; auch eine Lieferung benötigt den Vereinskollegen',()=>{assert.equal(core.sameRoute(route,{...route,target:{lat:0,lon:0}}),false);assert.equal(core.validate({...raw,eventId:'invented'},input),null);assert.equal(core.validate({...raw,passenger:null,passengerIntent:'',delivery:{label:'Teil',weightLbs:8,receiver:'Kollege',purpose:'Reparatur'}},input),null);assert.equal(core.validate({...raw,passenger:null,delivery:null},input),null);});
test('History wird begrenzt, ersetzt IDs und bleibt nur Erinnerung',()=>{const s=storage();for(let i=0;i<20;i++)core.remember(s,'m'+i,core.validate(raw,input),prose);assert.equal(core.history(s).length,12);core.remember(s,'m19',core.validate(raw,input),prose);assert.equal(core.history(s).length,12);assert.match(core.ideaPrompt([{candidateId:'x',...input}]),/kein Fluglogbuch/);assert.doesNotMatch(core.ideaPrompt([{candidateId:'x',...input}]),/Grillwurst|Segelflug|Stammtisch|Mappe/);});
test('Eventdaten benötigen Grounding-Quelle und passenden Zeitraum',()=>{const period=events.windowFor('2026-09-15');const event={id:'e',title:'Fest',visitorInfo:'Besucher willkommen',lat:48,lon:8,startsOn:'2026-09-19',endsOn:'2026-09-20',sourceUrl:'https://example.org/event'};const body=e=>({candidates:[{content:{parts:[{text:JSON.stringify({events:[e]})}]},groundingMetadata:{groundingChunks:[{web:{uri:event.sourceUrl}}]}}]});assert.equal(events.parse(body(event),period).length,1);assert.equal(events.parse(body({...event,startsOn:'2025-09-19',endsOn:'2025-09-20'}),period).length,0);assert.equal(events.parse(body({...event,sourceUrl:'https://invented.test'}),period).length,0);});
test('Browser-Auswahl überspringt Seeds, erhält Idee und schreibt nur einmal',async()=>{const s=storage(),requests=[];const ctx={window:{MissionClubIdeasCore:core,MissionClubEventsCore:{search:async()=>({events:[]}),match:()=>null},MissionPrivateContextCore:{}},localStorage:s,console,Date,getSelectedAiProvider:()=> 'gemini',getSelectedAiApiKey:()=> 'test',missionProposalFormatRoute:()=>({label:'Route'}),missionProposalCompactTarget:x=>x,normalizeMissionProposalChoice:x=>x,fetchGeminiJsonWithFallback:async(prompt)=>{requests.push(prompt);return {parsed:prompt.includes('RAHMEN:')?{ideas:[0,1,2].map(i=>({...raw,candidateId:'club-'+i}))}:{...prose,greeting:{speaker:'passenger',speakerName:'Ada',location:'onboard',text:prose.greeting}}};}};vm.createContext(ctx);vm.runInContext(fs.readFileSync('mission-club-browser.js','utf8'),ctx);const airports=[0,1,2].map(i=>({n:'B'+i,lat:49+i/10,lon:8}));const choices=await ctx.window.MissionClubBrowser.choices(airports,{start:route.start,searchMax:150});assert.equal(choices.length,3);assert.equal(requests.length,1);const mission=await ctx.window.MissionClubBrowser.story({start:route.start,dest:airports[0],proposal:choices[0].clubProposal});assert.equal(requests.length,2);assert.equal(mission.s,prose.story);assert.equal(mission.passenger.name,'Ada');assert.equal(mission.clubIdea.occasion,raw.occasion);await assert.rejects(()=>ctx.window.MissionClubBrowser.story({start:route.start,dest:airports[1],proposal:choices[0].clubProposal}),/Route/);});
test('App Profilprüfung und -anwendung behalten neuen Vertrag ohne Textumbau',()=>{const code=fs.readFileSync('app.js','utf8');const ctx={window:{},console};vm.createContext(ctx);for(const name of ['applyMissionTaskProfileToMission','missionMatchesTaskProfile']){const start=code.indexOf('function '+name+'('),end=code.indexOf('\nfunction ',start+1);vm.runInContext(code.slice(start,end),ctx);}const mission=core.mission(core.validate(raw,input),prose);assert.equal(ctx.missionMatchesTaskProfile(mission,'club_utility',false),true);assert.equal(ctx.applyMissionTaskProfileToMission(mission,false,'club_utility','OLD','OLD').mission.s,prose.story);});
test('Event außerhalb der ersten drei Ziele bekommt genau einen Picker-Platz; Suchfehler lässt drei freie Ideen zu',async()=>{
 const airports=[0,1,2,3].map(i=>({n:'Platz '+i,lat:48+i/10,lon:8}));const event={id:'beleg',title:'Termin',startsOn:'2099-01-01',endsOn:'2099-01-02'};
 let fail=false,inputs;
 const ctx={window:{MissionClubIdeasCore:core,MissionClubEventsCore:{search:async()=>{if(fail)throw Error('offline');return {events:[event]};},match:()=>({event,airport:airports[3]})},MissionPrivateContextCore:{}},localStorage:storage(),Date,console:{warn(){}},getSelectedAiProvider:()=> 'gemini',getSelectedAiApiKey:()=> 'test',missionProposalFormatRoute:()=>({label:'Route'}),missionProposalCompactTarget:x=>x,normalizeMissionProposalChoice:x=>x,fetchGeminiJsonWithFallback:async prompt=>{inputs=JSON.parse(prompt.split('RAHMEN: ')[1]);return {parsed:{ideas:inputs.map(f=>({...raw,candidateId:f.candidateId,eventId:f.event?.id||null}))}};}};
 vm.createContext(ctx);vm.runInContext(fs.readFileSync('mission-club-browser.js','utf8'),ctx);
 let choices=await ctx.window.MissionClubBrowser.choices(airports,{start:route.start,searchMax:150});assert.equal(choices.length,3);assert.equal(choices[0].target.n,'Platz 3');assert.equal(inputs.filter(f=>f.event).length,1);
 fail=true;choices=await ctx.window.MissionClubBrowser.choices(airports,{start:route.start,searchMax:150});assert.equal(choices.length,3);assert.equal(inputs.filter(f=>f.event).length,0);
});
test('Writer erhält konkrete Situation ohne auszuformulierende Vereinsbegründung',()=>{
 const idea=core.validate({...raw,clubConnection:'CONNECTION_SENTINEL',memory:'MEMORY_SENTINEL'},input);
 const prompt=core.writerPrompt(idea);
 assert.doesNotMatch(prompt,/CONNECTION_SENTINEL|MEMORY_SENTINEL/);
 assert.ok(prompt.includes(idea.occasion));
});
test('Nur der benannte Mitflieger darf die Bordbegrüßung sprechen',()=>{
 const idea=core.validate(raw,input);
 const greeting={speaker:'passenger',speakerName:'Ada',location:'onboard',text:prose.greeting};
 assert.equal(core.prose({...prose,greeting},idea).greeting,prose.greeting);
 assert.equal(core.prose({...prose,greeting:{...greeting,location:'destination'}},idea),null);
 assert.equal(core.prose({...prose,greeting:{...greeting,speakerName:'Zielkontakt'}},idea),null);
 const solo={...core.validate(raw,input),passenger:null}; // Previously saved solo contract.
 const written=core.prose({...prose,greeting},solo);
 assert.equal(written.greeting,null);
 assert.equal(core.mission(solo,written).passenger,null);
 assert.equal(core.voicePlan(solo).boarding,null);
 solo.delivery={label:'Teil',weightLbs:8,receiver:'Zielkontakt',purpose:'Reparatur'};
 assert.deepEqual(core.voicePlan(solo).arrival,{speaker:'receiver',speakerName:'Zielkontakt',location:'destination'});
 assert.equal(core.voicePlan(solo).boarding,null);
});
test('Solo-Vereinsbesuch wird im Voice-Pfad nicht zum Frachtflug',()=>{
 const code=fs.readFileSync('passenger-voice.js','utf8');
 const start=code.indexOf('function _cargoMissionFocus()');
 const end=code.indexOf('\nfunction ',start+1);
 let md={clubIdea:{...core.validate(raw,input),passenger:null}};
 const ctx={_activeMissionData:()=>md,_activeTaskDomain:()=> 'club_utility',_activeCargoText:()=> 'Persönliche Tasche',_activePaxText:()=> '0 PAX'};
 vm.createContext(ctx);vm.runInContext(code.slice(start,end),ctx);
 assert.equal(ctx._cargoMissionFocus(),false);
 md.clubIdea.delivery={label:'Teil',receiver:'Kontakt'};
 assert.equal(ctx._cargoMissionFocus(),true);
 md={cat:'club'};
 assert.equal(ctx._cargoMissionFocus(),true);
});

test('Teamkollege bleibt bei Pilotinitiative und Lieferung derselbe Bordsprecher',()=>{
 const idea=core.validate({...raw,pilotIntent:'Ich möchte die Kollegen besuchen.',passengerIntent:'Gemeinsam dabei sein.',delivery:{label:'Teil',weightLbs:8,receiver:'Kontakt am Ziel',purpose:'Vereinshilfe'}},input);
 assert.ok(idea);
 const written=core.prose({...prose,greeting:{speaker:'passenger',speakerName:'Ada',location:'onboard',text:prose.greeting}},idea);
 const mission=core.mission(idea,written);
 assert.equal(mission.pax,'1 PAX (Vereinskollegin)');
 assert.equal(mission.passenger.name,'Ada');
 assert.equal(mission.passenger.greetingText,prose.greeting);
 assert.equal(mission.clubIdea.pilotIntent,idea.pilotIntent);
 assert.equal(mission.clubIdea.voicePlan.boarding.speakerName,'Ada');
 assert.equal(mission.clubIdea.voicePlan.arrival.speakerName,'Kontakt am Ziel');
 assert.equal(core.validate({...raw,passenger:undefined},input),null);
 assert.equal(core.validate({...raw,passenger:[raw.passenger,raw.passenger]},input),null);
 assert.equal(core.validate({...raw,passengerIntent:null},input),null);
});
test('KI Geo-Ereignis muss an belegte Koordinate gebunden sein',()=>{
 const geo={anchorId:'destination',lat:49,lon:8,radiusNm:5};
 const idea=core.validate({...raw,narrativeEvents:[{geo,intent:'Ankunftsumgebung'}]},input);
 assert.ok(idea);assert.equal(idea.narrativeEvents[0].geo.anchorId,'destination');
 assert.equal(core.validate({...raw,narrativeEvents:[{geo:{...geo,lat:48.8},intent:'x'}]},input),null);
 assert.equal(core.validate({...raw,narrativeEvents:[{geo:{...geo,anchorId:'invented'},intent:'x'}]},input),null);
});
test('Erzählerische Sidequests verändern weder Flugauftrag noch Manifest-Pflichten',()=>{
 const base=core.validate(raw,input);
 const expanded=core.validate({...raw,narrativeEvents:[{atPercent:60,intent:'Eine fachliche Tätigkeit im Gespräch begleiten.'}]},input);
 const ordinary=core.mission(base,prose),story=core.mission(expanded,prose);
 for(const key of ['profileId','cat','missionType','pax','cargo','targetScene','sceneIntent'])assert.deepEqual(story[key],ordinary[key]);
 const items=[{id:'primary-cargo',required:true},{id:'pax',itemType:'passenger',required:true}];
 assert.deepEqual(core.manifestItems(items,expanded),core.manifestItems(items,base));
 assert.deepEqual(expanded.route,base.route);
 assert.equal(expanded.narrativeEvents.length,1);
});
test('Null, zwei und drei Sidequests bleiben vollständig und ihre Bögen gehen in die History',()=>{
 for(const count of [0,2,3]){
  const narrativeEvents=Array.from({length:count},(_,i)=>({atPercent:20+i*25,intent:'Eigener Gesprächsfaden '+i}));
  const idea=core.validate({...raw,narrativeEvents},input);assert.ok(idea);assert.equal(idea.narrativeEvents.length,count);
  const s=storage();core.remember(s,'m',idea,prose);
  assert.deepEqual(core.history(s)[0].narrativeIntents,narrativeEvents.map(e=>e.intent));
 }
});
test('Lockere TTS-Regie ist auf Vereinskollegen begrenzt und lässt den Wortlaut intakt',()=>{
 const voice=require('../mission-boarding-voice-core.js');const text='Das schauen wir uns nachher an.';
 const club=voice.normalizeSpeaker({name:'Ada',taskDomain:'club_utility'});
 assert.ok(voice.conversationalTtsStyle(club));assert.ok(voice.ttsInput(text,club).endsWith(text));
 for(const taskDomain of ['training','private_return','medical_transfer','']){
  assert.equal(voice.conversationalTtsStyle({taskDomain}),'');assert.equal(voice.ttsInput(text,{taskDomain}),text);
 }
});

test('regional anchors remain grounded and survive proposal acceptance without a second lookup',async()=>{
 const place={name:'Ortsanker',lat:48.4,lon:8.1,source:'osm-poi-tile:1|1',description:'natural=peak'};
 const frame=core.frame(route,[],null,'2026-09-15',[place,place,{...place,source:''}]);
 assert.equal(frame.geoAnchors.length,3);
 const idea=core.validate({...raw,narrativeEvents:[{intent:'Gespräch am Ort',geo:{anchorId:'region-0',lat:place.lat,lon:place.lon,radiusNm:2}}]},frame);
 assert.ok(idea);assert.equal(idea.geoAnchors[2].source,place.source);
 let lookups=0;
 const ctx={window:{MissionClubIdeasCore:core,MissionPrivateContextCore:{resolveBrowser:()=>{lookups++;throw Error('not needed')}}},localStorage:{getItem:()=>null},getSelectedAiApiKey:()=>'',fetchGeminiJsonWithFallback:async()=>({parsed:{...prose,greeting:{speaker:'passenger',speakerName:'Ada',location:'onboard',text:'Hallo zusammen.'}}})};
 vm.createContext(ctx);vm.runInContext(fs.readFileSync('mission-club-browser.js','utf8'),ctx);
 const mission=await ctx.window.MissionClubBrowser.story({start:route.start,dest:route.target,proposal:{schema:'club-proposal.v1',input:frame,idea}});
 assert.equal(lookups,0);assert.equal(mission.clubIdea.narrativeEvents[0].geo.anchorId,'region-0');
});
