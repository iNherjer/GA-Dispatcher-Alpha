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
 const c=vm.createContext({window:{}});for(const [file,name] of [['app.js','compactMissionObjectForQuotaStorage'],['sync.js','_syncCompactMissionObjectCore']]){const s=fs.readFileSync(file,'utf8'),a=s.indexOf('function '+name+'('),b=s.indexOf('\nfunction ',a+1);vm.runInContext(s.slice(a,b),c);}
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
test('companions: role and gender per fellow traveller, tolerant when missing or mismatched, writer bound to them',()=>{
 const flightStub={context:{},bindings:{}};
 const withCompanions=core.validate({...raw,companions:[{role:'Kollege aus dem Projektteam',gender:'male'},{role:'Assistentin',gender:'female'}]},frame);
 assert.deepEqual(withCompanions.companions,[{role:'Kollege aus dem Projektteam',gender:'male'},{role:'Assistentin',gender:'female'}]);
 assert.match(core.writerPrompt(withCompanions,flightStub,[]),/companions legt Rolle und Geschlecht/);
 for(const companions of [undefined,[],[{role:'Kollege',gender:'male'}],[{role:'Kollege',gender:'divers'},{role:'B',gender:'male'}]]){
  const idea=core.validate({...raw,companions},frame);assert.ok(idea,'Idee bleibt gültig');assert.deepEqual(idea.companions,[]);
  assert.doesNotMatch(core.writerPrompt(idea,flightStub,[]),/companions legt Rolle/);
 }
 assert.match(core.ideaPrompt([{candidateId:'a',...frame}]),/companions: Liste aller weiteren Mitreisenden/);
});
test('occasions rotate in code: distinct per picker, recent ones damped, model cannot override',()=>{
 const ids=core.OCCASIONS.map(o=>o.id);assert.ok(ids.includes('urlaub')&&ids.includes('vip')&&ids.includes('beruf'));
 let n=0;const seq=()=>((n=(n*9301+49297)%233280)/233280);
 const three=core.pickOccasions([],3,seq);assert.equal(new Set(three.map(o=>o.id)).size,3);
 const recent=[{occasion:'urlaub'},{occasion:'vip'},{occasion:'fest'}];let hits=0;
 for(let i=0;i<300;i++)if(['urlaub','vip','fest'].includes(core.pickOccasions(recent,1,Math.random)[0].id))hits++;
 assert.ok(hits<90,'zuletzt genutzte Anlässe bleiben selten: '+hits);
 const f=core.frame(route,4,[],[],{id:'vip'});assert.equal(f.occasion.id,'vip');assert.match(f.occasion.essence,/Diskretion/);
 assert.equal(core.frame(route,4,[],[],{id:'erfunden'}).occasion,undefined);
 const idea=core.validate({...raw,occasion:{id:'beruf',label:'x'}},f);assert.deepEqual(idea.occasion,{id:'vip',label:'VIP-Charter'});
 assert.equal(core.validate(raw,frame).occasion,undefined);
 assert.match(core.ideaPrompt([{candidateId:'a',...f}]),/legt mit occasion die Reiseart/);
 assert.match(core.writerPrompt(idea,{context:{},bindings:{}},[]),/nicht eine Arbeitsaufgabe/);
 const data=new Map(),storage={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)};
 core.remember(storage,'x',idea,written);assert.equal(core.history(storage)[0].occasion,'vip');
});
test('charter events: grounded sources, two-week window, kind, match within reach, event carried into idea',()=>{
 const ev=require('../mission-charter-events-core.js');
 assert.deepEqual(ev.windowFor('2026-11-16'),{from:'2026-11-16',through:'2026-11-30'});
 const period=ev.windowFor('2026-11-16');
 const good={id:'e1',title:'Jazznacht',venue:'Konzerthaus',lat:48.0,lon:7.85,startsOn:'2026-11-20',endsOn:'2026-11-21',sourceUrl:'https://a.example/x',visitorInfo:'Tickets online',kind:'kultur'};
 const body=(events,supported=true)=>{const text='Hier die Liste:\n'+events.map(e=>['EVENT',e.id,e.title,e.venue,e.lat,e.lon,e.startsOn,e.endsOn,e.kind,e.sourceUrl,e.visitorInfo].join(' | ')).join('\n');return {candidates:[{content:{parts:[{text}]},groundingMetadata:{groundingChunks:[{web:{uri:'https://vertexaisearch.cloud.google.com/grounding-api-redirect/y',title:'a.example'}}],groundingSupports:supported?text.split('\n').slice(1).map(l=>({segment:{text:l.slice(0,40)},groundingChunkIndices:[0]})):[]}}]};};
 assert.equal(ev.parse(body([good]),period).length,1);
 assert.equal(ev.parse(body([good],false),period).length,0,'ohne Beleg und ohne ausgeführte Suche kein Treffer');const searched=b=>{b.candidates[0].groundingMetadata.webSearchQueries=['Veranstaltungen Freiburg'];return b;};const loose=ev.parse(searched(body([good],false)),period);assert.equal(loose.length,1);assert.equal(loose[0].verification,'search');assert.equal(ev.parse(searched(body([good])),period)[0].verification,'supported');assert.equal(ev.parse(body([{...good,sourceUrl:'https://erfunden.example'}]),period)[0].sourceUrl,'https://a.example','unbelegte Modell-URL wird durch Belegdomain ersetzt');
 assert.equal(ev.parse(body([{...good,kind:'party'}]),period).length,0,'unbekannte Reiseart');
 assert.equal(ev.parse(body([{...good,startsOn:'2026-12-20',endsOn:'2026-12-21'}]),period).length,0,'außerhalb des Fensters');
 const dist=(a,b)=>Math.hypot(a.lat-b.lat,(a.lon-b.lon)*0.67)*111;
 const edtf={icao:'EDTF',lat:48.02,lon:7.83};
 assert.equal(ev.pick([good],edtf,'kultur',dist).event.id,'e1');
 assert.equal(ev.pick([good],edtf,'vip',dist).event.id,'e1','Kultur passt auch zu VIP');
 assert.equal(ev.pick([good],edtf,'genuss',dist),null,'Kulturtermin passt nicht zu Genussreise');
 assert.equal(ev.pick([good],edtf,'fest',dist),null,'Familienfest sucht keine Veranstaltung');
 assert.equal(ev.pick([good],{icao:'FAR',lat:49.5,lon:7.85},'kultur',dist),null,'mehr als 20 km vom Ziel');
 assert.equal(ev.pick([good],edtf,'kultur',dist,[{eventId:'e1'}]),null,'zuletzt genutzte Veranstaltung übersprungen');
 assert.equal(ev.searchSlot([{id:'fest'},{id:'urlaub'},{id:'vip'}]),1);assert.equal(ev.searchSlot([{id:'fest'},{id:'wiedersehen'}]),-1);
 assert.match(ev.prompt({name:'Freiburg im Breisgau',lat:48.02,lon:7.83},period,['kultur']),/Veranstaltungen in Freiburg im Breisgau und direkter Umgebung/);
 const f=core.frame(route,4,[],[],{id:'kultur'},ev.anchor(good),'2026-11-16');
 assert.equal(f.event.title,'Jazznacht');assert.equal(f.missionDate,'2026-11-16');assert.ok(f.geoAnchors.some(a=>a.id==='event'&&a.lat===48.0));
 const idea=core.validate(raw,f);assert.equal(idea.event.id,'e1');
 assert.match(core.ideaPrompt([{candidateId:'a',...f}]),/recherchierte öffentliche Veranstaltung, die zu seiner Reiseart passt/);
 assert.match(core.writerPrompt(idea,{context:{},bindings:{}},[]),/Uhrzeit, Programm oder Mitwirkende nur, soweit/);
 assert.equal(core.validate(raw,core.frame(route,4,[],[],{id:'kultur'})).event,undefined);
 const two=core.pickOccasions([],2,Math.random,['kultur']);assert.equal(two.length,2);assert.ok(two.every(o=>o.id!=='kultur'));
});
