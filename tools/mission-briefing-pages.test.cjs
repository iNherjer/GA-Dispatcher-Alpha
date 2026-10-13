const {test}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const shared=require('../mission-poi-briefing-shared-core.js');
const photo=require('../mission-poi-briefing-core.js');
const charter=require('../mission-charter-ideas-core.js');
const flight=require('../mission-private-episode-v6.js');
const clone=x=>JSON.parse(JSON.stringify(x));
function environment(extra={}) {
 const window={MissionPoiBriefingSharedCore:shared,...extra};
 const env={window,console,AbortController,URLSearchParams,Response,setTimeout,clearTimeout};
 for(const f of ['mission-airport-information-core.js','mission-airport-information-browser.js'])vm.runInNewContext(fs.readFileSync(f,'utf8'),env);
 return {env,window,core:window.MissionAirportInformationCore,browser:window.MissionAirportInformationBrowser};
}
const start={icao:'EDAA',name:'Startplatz',lat:48,lon:8,elevation:900,runways:[{designator:'09',length:800,width:20,surface:'Gras'}]};
const dest={icao:'EDBB',name:'Zielplatz',lat:49,lon:8,elevation:1100};
function contexts(core){return {departureAirportInfoContext:core.context(start),airportInfoContext:core.context(dest,{wiki:{id:'wikipedia',kind:'wikipedia',title:'Zielplatz',url:'https://example.org/airport',extract:'Der Platz besitzt einen Hangar.'}})};}
const pageRaw={departureAirportInformation:{departureInfo:'Startplatz: Piste 09, 800 m Gras. Startleistung anhand der Flugzeugunterlagen planen.',sourceIds:[]},airportInformation:{flightBriefing:'Zielplatz: Platzhöhe 1100 ft MSL.',destinationInfo:'Der Zielplatz besitzt einen belegten Hangar.',sourceIds:['wikipedia']}};
test('APT and POI departure activation; POI never uses airport destination lookup',()=>{
 const {browser}=environment();
 for(const missionType of ['apt','poi','bush'])assert.equal(browser.enabled({missionType,aiModeEnabled:true,role:'departure',target:start}),true);
 assert.equal(browser.enabled({missionType:'poi',aiModeEnabled:true,target:dest}),false);
 assert.equal(browser.enabled({missionType:'apt',aiModeEnabled:false,target:dest}),false);
});
test('one writer request captures source-bound pages while leaving story/weather validation separate',async()=>{
 const {core,browser}=environment();const contract=contexts(core);let calls=0;
 const raw={...pageRaw,story:'Unveränderte Geschichte',flightBriefing:'[[start.wind]]'};
 const result=await browser.writePages('PROFILE WRITER',contract,null,async prompt=>{
  calls++;assert.match(prompt,/STARTPLATZREDAKTION/);assert.match(prompt,/PLATZREDAKTION/);assert.doesNotMatch(prompt,/BUSH-/);return raw;
 });
 assert.equal(calls,1);assert.deepEqual(clone(result),{story:raw.story,flightBriefing:raw.flightBriefing});
 assert.equal(contract.departureAirportInformation.generated,true);assert.equal(contract.airportInformation.generated,true);
 assert.equal(raw.airportInformation,pageRaw.airportInformation);
 core.acceptPages({...raw,departureAirportInformation:{departureInfo:'Unbelegt',sourceIds:['foreign']}},contract);
 assert.equal(contract.departureAirportInformation.generated,false);assert.match(contract.departureAirportInformation.departureInfo,/Startplatz/);
});
test('real Charter adapter preserves page data on its contract in the existing one-call path',async()=>{
 const club=require('../mission-club-ideas-core.js');
 const {core,env,window}=environment({MissionCharterIdeasCore:charter,MissionClubIdeasCore:club,MissionPrivateEpisodeV6:flight});
 Object.assign(env,{localStorage:{getItem:()=>null},getMissionAircraftCapabilitySnapshot:()=>({passengerCapacity:1}),missionTrackerSupportsGroupGeneration:()=>true,getSelectedAiApiKey:()=>''});
 const route={start:{name:'Startplatz',lat:48,lon:8},target:{name:'Zielplatz',lat:49,lon:8}};
 const input=charter.frame(route,1,[]);
 const idea=charter.validate({reason:'Ein gemeinsamer Projekttermin',background:'Der Kunde möchte die offenen Projektfragen persönlich besprechen.',arrival:'Nach der Landung fährt er zum vereinbarten Treffen.',passengerCount:1,groupLabel:'Projektkunde',passenger:{name:'Ada',role:'Kundin',gender:'female',personality:'ruhig und freundlich'},luggageLabel:'Reisegepäck',luggageWeightLbs:12,memory:'Projektbesprechung',narrativeEvents:[]},input);
 assert.ok(idea);
 let calls=0;env.fetchGeminiJsonWithFallback=async prompt=>{calls++;assert.match(prompt,/STARTPLATZREDAKTION/);return {parsed:{...pageRaw,title:'Zum Projekttermin',story:'Ada hat diesen Flug für den anstehenden Projekttermin gebucht. Die offenen Fragen möchte sie mit den Beteiligten persönlich besprechen und dabei die gemeinsame Arbeit vorbereiten. Du bringst sie zum Zielplatz. Nach der Landung fährt sie zum vereinbarten Treffen weiter.',greeting:'Guten Tag, ich bin bereit für unseren Flug.',memory:'Einstieg über das persönliche Treffen.',flightBriefing:''}};};
 vm.runInNewContext(fs.readFileSync('mission-charter-browser.js','utf8'),env);
 // Exercise the actual dispatch boundary from its compact Charter contract,
 // including a proposal adjustment that returns a new contract object.
 const app=fs.readFileSync('app.js','utf8');
 const helperStart=app.indexOf('function attachMissionBriefingContexts('),helperEnd=app.indexOf('\nasync function fetchPrivateReturnStory',helperStart);
 vm.runInNewContext(app.slice(helperStart,helperEnd),env);
 Object.assign(env,{missionContractV4:{status:'ready',profile:{taskDomain:'charter'}},missionProposalChoice:{},
  applyMissionProposalChoiceToMissionContractV4:contract=>({...contract}),isPOI:false,selectedPoiCategory:'all',selectedAptCategory:'charter',
  aiModeEnabled:true,isPlanningOnlyMode:false,...contexts(core),poiInformationContext:null});
 const boundaryStart=app.indexOf('    if (missionProposalChoice && missionContractV4 &&',app.indexOf('async function generateMission('));
 const boundaryEnd=app.indexOf("    setMissionGenerationProgress('mission_content');",boundaryStart);
 vm.runInNewContext(app.slice(boundaryStart,boundaryEnd),env);
 const contract=env.missionContractV4;
 Object.assign(contract,{route:{startName:'Startplatz',targetName:'Zielplatz',distanceNm:60},weather:{}});
 const m=await window.MissionCharterBrowser.story({start:route.start,dest:route.target,proposal:{schema:'charter-proposal.v1',input,idea},contract});
 assert.equal(calls,1);assert.equal(m._missionContractV4.departureAirportInformation.departureInfo,pageRaw.departureAirportInformation.departureInfo);
 assert.equal(m._missionContractV4.airportInformation.destinationInfo,pageRaw.airportInformation.destinationInfo);
 assert.equal(m.charterIdea.reason,idea.reason);assert.doesNotMatch(m.s,/belegten Hangar/);
});
function photoFixture(){const fixture=JSON.parse(fs.readFileSync('tools/fixtures/poi-briefing-replay.json'));const run=fixture.runs[0];const c=clone(fixture.cases.find(c=>c.id===run.id));return {run,c,idea:photo.validateIdea({...run.idea,schema:photo.IDEA_VERSION,taskDomain:'media_photo'},c)};}
test('actual photo writer adds independent target/start pages without replacing its task or report',async()=>{
 const {run,c,idea}=photoFixture();
 const {core,window,env}=environment({MissionPoiBriefingCore:photo,MissionCharterIdeasCore:charter,MissionPrivateEpisodeV6:flight,MissionPoiBriefingSharedBrowser:{enrichSelected:async c=>c}});
 let calls=0;Object.assign(env,{localStorage:{getItem:()=>null},getMissionAircraftCapabilitySnapshot:()=>({passengerCapacity:1}),getSelectedAiApiKey:()=>'',fetchGeminiJsonWithFallback:async prompt=>{calls++;assert.match(prompt,/POI-ZIELSEITE/);assert.match(prompt,/NAVIGATION/);return {parsed:{...run.writer,targetId:c.id,flightBriefing:'',departureAirportInformation:pageRaw.departureAirportInformation,poiInformation:{text:'Belegtes Zielobjekt. Die fotografische Aufgabe bleibt ein Überflugauftrag.'}}};}});
 vm.runInNewContext(fs.readFileSync('mission-poi-briefing-browser.js','utf8'),env);
 const contract={departureAirportInfoContext:core.context(start),profile:{id:'media_photo',taskDomain:'media_photo'},weather:{}};
 const m=await window.MissionPoiBriefingBrowser.story({start,dest:c.target,proposal:{schema:'poi-photo-proposal.v1',start:shared.point(start),context:c,idea},contract});
 assert.equal(calls,1);assert.equal(m.passenger.taskDomain,'media_photo');assert.equal(m._missionWriterV4Debug.rawAiStory,run.writer.story);
 assert.equal(m._missionContractV4.poiInformation.generated,true);assert.equal(m._missionContractV4.poiInformation.target.name,c.target.name);
 assert.equal(m._missionContractV4.departureAirportInformation.generated,true);
 assert.doesNotMatch(m.s,/Belegtes Zielobjekt/);
 core.acceptPages({poiInformation:{text:'[[invented]]'}},contract,c);
 assert.equal(contract.poiInformation.generated,false);assert.match(contract.poiInformation.text,/Hindernisse/);
});
test('local/cloud compact storage and restored renderer retain pages; moved destination cannot reuse POI text',()=>{
 const {c}=photoFixture();const {core,browser,window,env}=environment();
 const contract=contexts(core);core.acceptPages({...pageRaw,poiInformation:{text:'POI <img src=x onerror=alert(1)>\n\nÜberflug planen.'}},contract,c);
 for(const [file,name] of [['app.js','compactMissionObjectForQuotaStorage'],['sync.js','_syncCompactMissionObjectCore']]){const s=fs.readFileSync(file,'utf8'),a=s.indexOf('function '+name+'('),b=s.indexOf('\nfunction ',a+1);vm.runInNewContext(s.slice(a,b),env);}
 const m={missionType:'poi',initialTargetLat:c.target.lat,initialTargetLon:c.target.lon,departureAirportInfoContext:contract.departureAirportInfoContext,departureAirportInformation:contract.departureAirportInformation,poiInformation:contract.poiInformation};
 const restored=clone(env._syncCompactMissionObjectCore(env.compactMissionObjectForQuotaStorage(m)));
 assert.equal(restored.poiInformation.text,m.poiInformation.text);assert.equal(restored.departureAirportInformation.departureInfo,m.departureAirportInformation.departureInfo);
 const els={};for(const id of ['wikiDepDescText','wikiDestDescText','airportFlightBriefing','airportFlightBriefingHeading','airportFlightBriefingSources','airportDestinationInfoSources','airportDepartureInfoSources'])els[id]={textContent:'',hidden:false,replaceChildren(){this.textContent='';},append(){}};
 window.document={getElementById:id=>els[id],createElement:()=>({}),createTextNode:text=>({textContent:text})};
 assert.equal(browser.render(restored),true);assert.equal(els.wikiDestDescText.textContent,m.poiInformation.text);
 assert.equal(els.airportFlightBriefing.hidden,true);
 assert.equal(browser.render(restored,{lat:0,lon:0}),false);
 assert.equal(browser.renderDeparture(restored,start),true);
 assert.equal(browser.renderDeparture(restored,dest),false);
 const apt={missionType:'apt',initialTargetLat:dest.lat,initialTargetLon:dest.lon,...contexts(core),airportInformation:contract.airportInformation};
 assert.equal(browser.render(apt),true);assert.match(els.wikiDestDescText.textContent,/Hangar/);
});

function pageFetchFixture({generated=false,fail=false,alive=()=>true}={}){
 const {core,browser,window,env}=environment();const contract=contexts(core);
 const info=generated?{...pageRaw.airportInformation,generated:true}:core.fallback(contract.airportInfoContext);
 const m={missionType:'apt',initialTargetLat:dest.lat,initialTargetLon:dest.lon,airportInfoContext:contract.airportInfoContext,airportInformation:info};
 const els={};for(const id of ['wikiDestDescText','wikiDestImageContainer','wikiDestImage','airportFlightBriefing','airportFlightBriefingHeading','airportFlightBriefingText','airportFlightBriefingSources','airportDestinationInfoSources']){
  els[id]={textContent:'',style:{},hidden:false,replaceChildren(){},append(){}};
  Object.defineProperty(els[id],'innerText',{get(){return this.textContent;},set(v){this.textContent=v;}});
 }
 const document={getElementById:id=>els[id],createElement:()=>({}),createTextNode:text=>({textContent:text})};window.document=document;window.currentMissionData=m;
 Object.assign(env,{document,currentMissionData:m,_dispatchUiCommitAllowed:alive,buildAreaDescriptionPoiFallback:()=>'',getWikiTitleForAirport:async()=> 'Flugplatz Freiburg',fetch:async()=>{
  if(fail)throw Error('offline');
  return {json:async()=>({query:{pages:{1:{extract:'Der Flugplatz ist eng mit der regionalen Luftfahrtgeschichte verbunden.',thumbnail:{source:'https://example.org/airport-photo.jpg'}}}}})};
 }});
 const source=fs.readFileSync('app.js','utf8');const a=source.indexOf('async function fetchAreaDescription('),b=source.indexOf('\nconst wikiTitleCache',a);vm.runInNewContext(source.slice(a,b),env);
 return {core,browser,env,els,m,load:()=>env.fetchAreaDescription(dest.lat,dest.lon,'wikiDestDescText',null,'EDBB')};
}
test('APT own-data fallback cannot suppress the richer Wiki article and its photograph',async()=>{
 const f=pageFetchFixture();await f.load();
 assert.match(f.els.wikiDestDescText.textContent,/Luftfahrtgeschichte/);
 assert.doesNotMatch(f.els.wikiDestDescText.textContent,/Weitere Angaben/);
 assert.equal(f.els.wikiDestImageContainer.style.display,'block');
 assert.match(f.els.wikiDestImage.style.backgroundImage,/airport-photo/);
 assert.equal(f.els.airportFlightBriefing.hidden,true);
 // Subsequent restore renders must not overwrite a persisted Wiki paragraph with basic data.
 assert.equal(f.browser.render(f.m),false);
 assert.match(f.els.wikiDestDescText.textContent,/Luftfahrtgeschichte/);
});
test('accepted APT prose still loads a Wiki image; photo failure cannot replace the prose',async()=>{
 for(const fail of [false,true]){
  const f=pageFetchFixture({generated:true,fail});await f.load();
  assert.equal(f.els.wikiDestDescText.textContent,pageRaw.airportInformation.destinationInfo);
  if(!fail)assert.equal(f.els.wikiDestImageContainer.style.display,'block');
 }
});
test('cancelled article fetch cannot attach an old photo to a new mission',async()=>{
 let checks=0;const f=pageFetchFixture({generated:true,alive:()=>++checks<3});await f.load();
 assert.notEqual(f.els.wikiDestImageContainer.style.display,'block');
});
test('overview page prompts select local context and short paragraphs without changing Bush technical prompt',()=>{
 const {core}=environment(),contract=contexts(core);
 const overview=core.pagesPrompt(contract);
 assert.match(overview,/zwei bis drei kurzen Absätzen/);assert.match(overview,/keine vollständige Pistenaufzählung/i);
 assert.match(core.writerPrompt(contract.airportInfoContext,contract.departureAirportInfoContext),/Die vorhandenen Werte des Entwurfs bleiben vollständig enthalten/);
});


test('unavailable Wiki and own-data-only context show a short note, not a second runway wall',async()=>{
 const f=pageFetchFixture({fail:true});await f.load();
 assert.equal(f.els.wikiDestDescText.textContent,'Für diesen Platz liegen derzeit keine weiterführenden Ortsinformationen vor.');
 assert.equal(f.els.airportFlightBriefing.hidden,true);
});
