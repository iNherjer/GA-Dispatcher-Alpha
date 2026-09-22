const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const core=require('../mission-charter-ideas-core.js');require('../mission-private-outing-core.js');const flight=require('../mission-private-episode-v6.js');const club=require('../mission-club-ideas-core.js');
const route={start:{name:'Start',lat:48,lon:8},target:{name:'Ziel',lat:49,lon:8}};
const frame=core.frame(route,4,[]),raw={reason:'Abstimmung des gemeinsamen Projekts',background:'Der Auftraggeber möchte die Beteiligten persönlich zusammenbringen.',arrival:'Die Reisenden fahren nach der Landung gemeinsam zum vereinbarten Treffen.',passengerCount:3,groupLabel:'Projektgruppe',passenger:{name:'Ada',role:'Auftraggeberin',gender:'female',personality:'zugewandt und sachlich'},luggageLabel:'Reisegepäck',luggageWeightLbs:42,memory:'Gemeinsamer geschäftlicher Termin.',narrativeEvents:[{atPercent:50,intent:'Hintergrund der Zusammenarbeit erzählen.'}]};
const written={title:'Charter zum gemeinsamen Termin',story:'Der Auftraggeber hat diesen Flug für seine Projektgruppe gebucht. Ada koordiniert die Reise und freut sich darauf, die offenen Punkte persönlich mit den Beteiligten zu besprechen. Du übernimmst den Transport zum Zielplatz. Nach der Landung setzt die Gruppe ihre Reise gemeinsam zum vereinbarten Treffen fort.',greeting:'Guten Tag, wir sind vollständig und bereit für den Flug.',memory:'Einstieg über den Auftrag und die Zusammenarbeit.'};
test('capacity, zero/three voices, identity and baggage are explicit',()=>{
 assert.ok(core.validate(raw,frame));assert.equal(core.validate({...raw,passengerCount:5},frame),null);assert.equal(core.validate({...raw,passengerCount:0},frame),null);
 for(const n of [0,1,2,3])assert.equal(core.validate({...raw,narrativeEvents:Array.from({length:n},(_,i)=>({atPercent:20+i*20,intent:'Moment '+i}))},frame).narrativeEvents.length,n);
 assert.equal(core.validate({...raw,narrativeEvents:[{geo:{lat:49,lon:8,radiusNm:2,anchorId:'invented'},intent:'x'}]},frame),null);
 const m=core.mission(core.validate(raw,frame),written,'Wetterabsatz',{startName:'Start',targetName:'Ziel',distanceNm:60});
 assert.equal(m.passengerCount,3);assert.equal(m.party.count,3);assert.equal(m.passenger.name,'Ada');assert.match(m.cargo,/42 lbs/);assert.doesNotMatch(m.s,/Passagiere:|Gepäck:|nicht bilanziert/);assert.equal(m.passenger.narrativeSchema,core.VERSION);
});
test('writer and legacy presentation preserve professional customer story',()=>{
 const idea=core.validate(raw,frame);assert.ok(core.prose(written));assert.equal(core.prose({...written,greeting:''}),null);
 const prompt=core.writerPrompt(idea,{context:{},bindings:{}},[]);assert.match(prompt,/Auftraggeber/);assert.match(prompt,/HISTORY/);
 const c=vm.createContext({window:{}}),code=fs.readFileSync('app.js','utf8');
 for(const name of ['personalizeAptCharterMission','applyMissionTaskProfileToMission','synchronizeMissionPartyPresentation']){const a=code.indexOf('function '+name+'('),b=code.indexOf('\nfunction ',a+1);vm.runInContext(code.slice(a,b),c);}
 const m=core.mission(idea,written,'Wetter',{startName:'A',targetName:'B'});
 assert.equal(c.personalizeAptCharterMission(m),m);assert.equal(c.synchronizeMissionPartyPresentation(m,m.party),m);assert.equal(c.applyMissionTaskProfileToMission(m,false,'auto').mission.s,m.s);
});
test('picker acceptance keeps idea and fresh weather, rejects changed capacity',async()=>{
 let capacity=4,calls=0,prompt='';const idea=core.validate(raw,frame);
 const c=vm.createContext({window:{MissionCharterIdeasCore:core,MissionClubIdeasCore:club,MissionPrivateEpisodeV6:flight},localStorage:{getItem:()=>null},getMissionAircraftCapabilitySnapshot:()=>({passengerCapacity:capacity}),missionTrackerSupportsGroupGeneration:()=>true,getSelectedAiApiKey:()=>'',fetchGeminiJsonWithFallback:async p=>{calls++;prompt=p;return {parsed:{...written,flightBriefing:'Die Strecke beträgt [[route.distance]]. Am Start meldet [[start.station]] Wind mit [[start.wind]].'}};}});
 vm.runInContext(fs.readFileSync('mission-charter-browser.js','utf8'),c);
 const args={start:route.start,dest:route.target,proposal:{schema:'charter-proposal.v1',input:frame,idea},contract:{route:{startName:'Start',targetName:'Ziel',distanceNm:60},weather:{dep:{raw:{station:'EDDS',windKts:7}}}}};
 const m=await c.window.MissionCharterBrowser.story(args);assert.equal(calls,1);assert.match(m.s,/7 Knoten/);assert.equal(m.charterIdea.reason,raw.reason);assert.match(prompt,/60 NM/);
 capacity=2;await assert.rejects(()=>c.window.MissionCharterBrowser.story(args),/Kapazität/);assert.equal(calls,1);
});
test('charter contract survives local quota and cloud core roundtrip',()=>{
 const c=vm.createContext({});for(const [file,name] of [['app.js','compactMissionObjectForQuotaStorage'],['sync.js','_syncCompactMissionObjectCore']]){const s=fs.readFileSync(file,'utf8'),a=s.indexOf('function '+name+'('),b=s.indexOf('\nfunction ',a+1);vm.runInContext(s.slice(a,b),c);}
 const idea=core.validate(raw,frame);const saved=c.compactMissionObjectForQuotaStorage({charterIdea:idea,missionContract:{charterIdea:idea}});const restored=JSON.parse(JSON.stringify(c._syncCompactMissionObjectCore(saved)));
 assert.deepEqual(restored.charterIdea,idea);assert.deepEqual(restored.missionContract.charterIdea,idea);
});

test('references in narrative fields resolve or reject, special notes remain optional',()=>{
 const resolved=core.resolveReferences({...written,story:written.story+' Distanz [[route.distance]].',pilotNotes:'Das mitgeführte Gerät benötigt die vereinbarte behutsame Handhabung.'},{'route.distance':'162,1 NM'});
 assert.match(resolved.story,/162,1 NM/);assert.doesNotMatch(resolved.story,/\[\[/);
 assert.equal(core.resolveReferences({...written,greeting:'Hallo [[unknown]]'},{}),null);
 assert.equal(core.resolveReferences({...written,title:'Offen [[route.distance'},{}),null);
 const m=core.mission(core.validate(raw,frame),core.prose(resolved),'Wetter',{startName:'A',targetName:'B'});
 assert.match(m.s,/Besondere Hinweise:/);assert.doesNotMatch(m.s,/Passagiere:/);
});

test('travel character is free-form and survives history, legacy ideas remain valid',()=>{
 const idea=core.validate({...raw,travelCharacter:'Geschäftlich, vertraulicher persönlicher Auftrag'},frame);
 assert.equal(core.validate(idea,frame).travelCharacter,idea.travelCharacter);
 const data=new Map(),storage={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)};
 core.remember(storage,'test',idea,written);
 assert.equal(core.history(storage)[0].travelCharacter,idea.travelCharacter);
 assert.ok(core.validate(core.validate(raw,frame),frame));
});

test('weather-only repair cannot replace an accepted charter story',async()=>{
 let calls=0;const idea=core.validate(raw,frame);
 const c=vm.createContext({console,window:{MissionCharterIdeasCore:core,MissionClubIdeasCore:club,MissionPrivateEpisodeV6:flight},localStorage:{getItem:()=>null},getMissionAircraftCapabilitySnapshot:()=>({passengerCapacity:4}),missionTrackerSupportsGroupGeneration:()=>true,getSelectedAiApiKey:()=>'',fetchGeminiJsonWithFallback:async prompt=>{
  calls++;if(calls===1)return {parsed:{...written,flightBriefing:'Wind 99 Knoten'}};
  assert.match(prompt,/ausschließlich den Wetterabsatz/);
  return {parsed:{story:'MUST NOT REPLACE',flightBriefing:'Die Strecke beträgt [[route.distance]]. Wind bei [[start.station]]: [[start.wind]].'}};
 }});
 vm.runInContext(fs.readFileSync('mission-charter-browser.js','utf8'),c);
 const m=await c.window.MissionCharterBrowser.story({start:route.start,dest:route.target,proposal:{schema:'charter-proposal.v1',input:frame,idea},contract:{route:{startName:'Start',targetName:'Ziel',distanceNm:60},weather:{dep:{raw:{station:'EDDS',windKts:7}}}}});
 assert.equal(calls,2);assert.equal(m._missionWriterV4Debug.rawAiStory,written.story);assert.match(m.s,/7 Knoten/);assert.doesNotMatch(m.s,/MUST NOT REPLACE/);
});
