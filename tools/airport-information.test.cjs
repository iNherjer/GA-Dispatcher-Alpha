const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const core=require('../mission-airport-information-core.js');
const u60={icao:'U60',faa:'U60',name:'Big Creek Airport',country:'US',lat:45.133202,lon:-115.321999,elevation:5743};
const wiki=(id='U60',language='en')=>({query:{pages:{1:{title:'Big Creek Airport (Idaho)',extract:'Big Creek Airport (FAA: '+id+') is in Idaho. It serves a lodge.',coordinates:[{lat:u60.lat,lon:u60.lon}],fullurl:'https://'+language+'.wikipedia.org/wiki/Big_Creek_Airport_(Idaho)',lastrevid:123}}}});
function browser(extra={}){const window={MissionAirportInformationCore:core,...extra};vm.runInNewContext(fs.readFileSync(require.resolve('../mission-airport-information-browser.js'),'utf8'),{window,URLSearchParams,AbortController,setTimeout,clearTimeout,Response,Date,Map});return window.MissionAirportInformationBrowser;}
test('strict airport identity prevents nearby Big Creek heliport and foreign namesake',()=>{const heli={...u60,icao:'54U',faa:'54U',lat:u60.lat+.0001};assert.equal(core.matchAirport(u60,[heli]),null);assert.equal(core.matchAirport(u60,[{...u60,lat:17}]),null);assert.equal(core.matchAirport(u60,[heli,u60]),u60);});
test('own runway dimensions/headings/surface outrank supplemental record; no null-to-zero elevation',()=>{const a={...u60,runways:[{designator:'01',trueHeading:27,dimension:{length:{value:1082,unit:0}},surface:{mainComposite:2}}]};const own=core.ownAirport(a,{runways:[{designator:'99',surface:'dirt'}]});assert.equal(own.runways[0].surface,'Gras');assert.equal(own.runways[0].trueHeadingDeg,27);assert.equal(core.ownAirport({...u60,elevation:null}).elevationFt,null);});
test('verified EN article, wrong-coordinate and disambiguation rejection',()=>{assert.equal(core.selectWiki(u60,wiki(),'en').language,'en');const bad=wiki();bad.query.pages[1].coordinates[0].lat=17;assert.equal(core.selectWiki(u60,bad,'en'),null);bad.query.pages[1].coordinates[0].lat=u60.lat;bad.query.pages[1].pageprops={disambiguation:''};assert.equal(core.selectWiki(u60,bad,'en'),null);});
test('FAA identity and airport location are both binding, including K-prefixed ICAO',()=>{const faa={ident:'U60',...core.location(u60),remarks:[],valid:true};assert.equal(core.acceptFaa(u60,faa),faa);assert.equal(core.acceptFaa(u60,{...faa,ident:'U61'}),null);assert.equal(core.acceptFaa({...u60,icao:'KBOI',faa:'BOI'},{...faa,ident:'BOI'}).ident,'BOI');assert.equal(core.acceptFaa(u60,{...faa,lat:10}),null);});
test('deadline retains successful EN/FAA while DE ignores AbortSignal; late responses cannot mutate context',async()=>{const b=browser();let release;const out=await b.load(u60,{budgetMs:45,persistent:false,fetch:async url=>url.includes('de.wikipedia')?new Promise(r=>release=()=>r(new Response(JSON.stringify(wiki('U60','de'))))):new Response(JSON.stringify(url.includes('/faa?')?{ident:'U60',lat:u60.lat,lon:u60.lon,remarks:['NO WINTER MAINTENANCE'],valid:true}:wiki()))});assert.ok(out.retrieval.elapsedMs<180);assert.equal(out.retrieval.sources['wikipedia-de'].status,'timeout');assert.ok(out.sources.some(s=>s.kind==='faa'));assert.equal(out.sources.find(s=>s.kind==='wikipedia').language,'en');const before=JSON.stringify(out);release();await new Promise(r=>setTimeout(r,10));assert.equal(JSON.stringify(out),before);});
test('source failure is optional and successful source cache is reused; negative wiki matching is cached',async()=>{let calls=0;const b=browser(),fetch=async url=>{calls++;if(url.includes('/faa?'))throw Error('HTTP 502');return new Response(JSON.stringify(url.includes('de.wikipedia')?{query:{pages:{}}}:wiki()));};const cold=await b.load(u60,{fetch,persistent:false});assert.equal(cold.retrieval.sources.faa.status,'unavailable');assert.equal(calls,4);await b.load(u60,{fetch,persistent:false});assert.equal(calls,5);});
test('non-US airports never request FAA',async()=>{const seen=[];await browser().load({...u60,country:'DE'},{persistent:false,fetch:async url=>{seen.push(url);return new Response('{}');}});assert.equal(seen.length,2);assert.ok(seen.every(url=>url.includes('wikipedia')));});
test('hung persistent cache respects shared deadline even before fetch starts',async()=>{const b=browser({caches:{open:()=>new Promise(()=>{})}});const c=await b.load(u60,{budgetMs:35,fetch:()=>{throw Error('must not run');}});assert.ok(c.retrieval.elapsedMs<180);assert.equal(c.sources.filter(s=>s.kind!=='pilot-handbook').length,0);});
test('writer addition validates structure/source IDs without rewriting generated prose',()=>{const c=core.context(u60,{wiki:core.selectWiki(u60,wiki(),'en')});const raw={airportInformation:{flightBriefing:'Eine möglicherweise weiche Piste.',destinationInfo:'Big Creek und deine Abholung.\n\nEin neuer Absatz.',sourceIds:['wikipedia']}};const m=core.attach({s:'Story'},raw,c);assert.equal(m.airportInformation.destinationInfo,raw.airportInformation.destinationInfo);assert.equal(m.s,'Story');assert.equal(m.airportInformation.generated,true);assert.equal(core.attach({}, {airportInformation:{...raw.airportInformation,sourceIds:['unknown']}},c).airportInformation.generated,false);assert.equal(core.writerPrompt(null),'');});
test('actual V4 and V5 request adapters use one model call and preserve optional information',async()=>{const source=fs.readFileSync(require.resolve('../app.js'),'utf8'),c=core.context(u60);for(const v of ['V4','V5']){let calls=0,prompt;const a=source.indexOf('async function fetchMissionWriter'+v+'('),b=source.indexOf('window.fetchMissionWriter'+v+' =',a),env={window:{MissionAirportInformationCore:core},getSelectedAiApiKey:()=> 'fixture',getSelectedAiProvider:()=> 'gemini',document:{getElementById:()=>({checked:true})},fetchGeminiJsonWithFallback:async p=>{calls++;prompt=p;return {parsed:{airportInformation:{flightBriefing:'Graspiste.',destinationInfo:'Abholung am Platz.',sourceIds:[]}}}}};env['buildMissionWriter'+v+'Prompt']=()=> 'BASE';env['sanitizeMissionWriter'+v+'Payload']=()=>({s:'PERSONAL STORY'});vm.runInNewContext(source.slice(a,b),env);const m=await env['fetchMissionWriter'+v]({missionType:'bush',missionContractV4:{status:'ready',airportInfoContext:c}});assert.equal(calls,1);assert.match(prompt,/airportInformation/);assert.equal(m.airportInformation.generated,true);await env['fetchMissionWriter'+v]({missionType:'apt',missionContractV4:{status:'ready'}});assert.equal(prompt,'BASE');}});
test('quota persistence whitelists keep common context and generated text in both save paths',()=>{for(const f of ['app.js','sync.js']){const s=fs.readFileSync(require.resolve('../'+f),'utf8');const a=s.indexOf(f==='app.js'?'function compactMissionObjectForQuotaStorage':'function _syncCompactMissionObjectCore'),b=s.indexOf('];',a);assert.match(s.slice(a,b),/'airportInfoContext'/);assert.match(s.slice(a,b),/'airportInformation'/);}});
test('render restores the right destination, clears on return-home target and uses textContent',()=>{const els={};const el=()=>({hidden:false,textContent:'',children:[],replaceChildren(){this.children=[];},append(...v){this.children.push(...v);}});for(const id of ['airportFlightBriefing','airportFlightBriefingText','wikiDestDescText','airportFlightBriefingSources','airportDestinationInfoSources'])els[id]=el();const document={getElementById:id=>els[id],createElement:el,createTextNode:text=>({textContent:text})},b=browser({document}),c=core.context(u60),m={missionType:'bush',airportInfoContext:c,airportInformation:core.fallback(c),targetLat:u60.lat,targetLon:u60.lon};assert.equal(b.render(m),true);assert.equal(els.airportFlightBriefing.hidden,false);assert.match(els.wikiDestDescText.textContent,/Big Creek/);assert.equal(b.render(m,{lat:44,lon:-115}),false);assert.equal(els.airportFlightBriefing.hidden,true);assert.equal(els.airportDestinationInfoSources.children.length,0);});

test('429 honours Retry-After across both wiki languages and allows own data/cache to continue',async()=>{let calls=0;const b=browser(),fetch=async url=>{calls++;return url.includes('wikipedia')?new Response('{}',{status:429,headers:{'Retry-After':'120'}}):new Response(JSON.stringify({ident:'U60',lat:u60.lat,lon:u60.lon,remarks:[],valid:true}));};await b.load(u60,{fetch,persistent:false});const before=calls;const second=await b.load(u60,{fetch,persistent:false});assert.equal(calls,before);assert.match(second.retrieval.sources['wikipedia-en'].reason,/source_cooldown/);assert.equal(second.retrieval.sources.faa.status,'available');});
test('a same-name heliport mentioning the nearby airport is not accepted as its article',()=>{const p=wiki();p.query.pages[1].title='Big Creek Heliport';assert.equal(core.selectWiki(u60,p,'en'),null);});

test('missing/corrupt restored metadata and out-of-range coordinates stay optional',()=>{assert.equal(core.distance(u60,null),Infinity);assert.equal(core.location({lat:405,lon:1}).lat,null);assert.equal(browser().render({missionType:'bush',airportInfoContext:{},airportInformation:{}}),false);assert.equal(core.ownAirport({...u60,runways:'invalid'}).runways.length,0);});

test('writer addition transmits the complete bounded sources even when V5 omits the full contract',()=>{const c=core.context(u60,{wiki:core.selectWiki(u60,wiki(),'en'),terrain:{centerFt:5743,maxFt:8328,radiusNm:1}});const marker='AIRPORT_INFO_CONTEXT (Daten): ';const p=core.writerPrompt(c);assert.deepEqual(JSON.parse(p.slice(p.indexOf(marker)+marker.length).trim()),core.writerContext(c));assert.match(p,/It serves a lodge/);});

test('wiki separates multi-page introductions from the selected full article within the same deadline',async()=>{const urls=[];const c=await browser().load({...u60,country:'DE'},{persistent:false,fetch:async url=>{urls.push(url);const q=new URL(url).searchParams;const d=wiki();if(q.has('titles'))d.query.pages[1].extract+=' Full selected article with operational notes.';return new Response(JSON.stringify(d));}});assert.equal(urls.length,4);assert.ok(urls.filter(url=>new URL(url).searchParams.has('generator')).every(url=>new URL(url).searchParams.get('exintro')==='1'));assert.match(c.sources.find(s=>s.kind==='wikipedia').extract,/Full selected article/);});
test('verified wiki introduction survives a stalled full article request',async()=>{const c=await browser().load({...u60,country:'DE'},{persistent:false,budgetMs:40,fetch:async url=>new URL(url).searchParams.has('titles')?new Promise(()=>{}):new Response(JSON.stringify(wiki()))});assert.ok(c.sources.some(s=>s.kind==='wikipedia'&&s.extract.includes('serves a lodge')));assert.equal(c.retrieval.partial,true);});


test('arrival note uses the current matching scene plan and only resolved named positions',()=>{
 const c=core.context(u60),plan={icao:'U60',airportLat:u60.lat,airportLon:u60.lon,expectedBy:'Freundin',items:[{kind:'arrival_vehicle',label:'weißer Kleinwagen'}],snapStatus:{status:'resolved'},osmPlacement:{name:'Hangar Nord'}};
 assert.equal(core.arrivalNote({aptArrivalPlan:plan},c),'Geplante Ankunft: Empfang durch Freundin; Fahrzeug: weißer Kleinwagen; Treffpunkt bei Hangar Nord.');
 const unknownPlace={...plan,snapStatus:{status:'fallback'},items:[{kind:'arrival_vehicle',label:'Abholfahrzeug'}]};
 assert.equal(core.arrivalNote({aptArrivalPlan:unknownPlace},c),'Geplante Ankunft: Empfang durch Freundin; Fahrzeug: Abholfahrzeug.');
 assert.equal(core.arrivalNote({aptArrivalPlan:{...plan,icao:'KMYL'}},c),'');
 assert.equal(core.arrivalNote({aptArrivalPlan:{...plan,airportLat:44}},c),'');
 assert.equal(core.arrivalNote({aptArrivalPlan:null,missionContract:{aptArrivalPlan:plan}},c),'');
 assert.equal(core.arrivalNote({},c),'');
 assert.equal(core.arrivalNote({missionContract:{aptArrivalPlan:plan}},c),core.arrivalNote({aptArrivalPlan:plan},c));
});


test('isolated production Legacy request and response carry the Bush airport addition, while APT stays unchanged',async()=>{
 const source=fs.readFileSync(require.resolve('../app.js'),'utf8');
const fn=source.slice(source.indexOf('async function fetchGeminiMission('),source.indexOf('/* =========================================================\n   6. HAUPT-LOGIK',source.indexOf('async function fetchGeminiMission(')));
const airport=core,env=require('../mission-environment-core.js'),bush=require('../mission-bush-narrative-core.js');
const target={name:'Test strip',icao:'U60',country:'US',lat:45,lon:-115,elevation:5743},airportInfoContext=airport.context(target);let sent;
const parsed={title:'Eigene Geschichte',story:'Wir bringen Nora zum Ziel.',pax:'1 PAX',cargo:'Kamera',passenger:{name:'Nora',role:'Fotografin',taskDomain:'bush_adventure',greetingText:'Hallo!'},airportInformation:{flightBriefing:'Platzhöhe 5743 ft.',destinationInfo:'Ein eigenständiger Zieltext.',sourceIds:[]}};
const c={window:{MissionAirportInformationCore:airport,MissionEnvironmentCore:env,MissionBushNarrativeCore:bush},document:{getElementById:()=>({checked:true,value:'bush',innerText:''})},console,localStorage:{getItem:()=>null},getSelectedAiApiKey:()=> 'test',normalizeMissionType:s=>s,getMissionTaskProfile:()=>({id:'bush_scenic_hopper',taskDomain:'bush_adventure',roleProfile:'bush_adventure_guest_v1'}),missionIsSarHeliProfileId:()=>false,buildBushMissionSpec:()=>({profileId:'bush_scenic_hopper',targetMode:'strip',completionMode:'land_at_target'}),sanitizePassengerProfile:x=>x,sanitizeSoftPoiNarrativeLandmarks:x=>x||'',sanitizeMissionSceneIntentSpec:()=>({summary:'',environment:'',notes:'',visibleIdeas:[]}),enrichPassengerGreetingText:p=>p,sanitizeMissionTargetSceneSpec:()=>({kind:'none'}),sanitizeMissionPayloadText:x=>x,enforceMedicalTransferPayload:x=>x,enforceCharterPayload:x=>x,enforceTrainingInstructorPayload:x=>x,fetchAiJsonWithFallback:async prompt=>{sent=prompt;return {parsed,source:'fixture'};}};
const builtins=new Set(['String','Number','Array','Object','Date','Boolean','Set','Map','Error','JSON','RegExp','Math','parseInt','parseFloat','isFinite']);
for(const m of fn.matchAll(/(?<![.\w])([A-Za-z_]\w*)\s*\(/g)){const name=m[1];if(!builtins.has(name)&&!c[name]&&!['if','for','while','switch','catch','function'].includes(name))c[name]=()=>undefined;}

 vm.createContext(c);vm.runInContext(fn,c);
 const meta={startAirport:{...target,lon:-116},destAirport:target,airportInfoContext};
 const call=kind=>c.fetchGeminiMission('Start','Test strip',50,false,'1 PAX','Kamera',null,null,{baseType:kind,profile:kind==='bush'?'bush_scenic_hopper':'auto',category:'all'},null,meta);
 let result=await call('bush');assert.ok(sent.includes('AIRPORT_INFO_CONTEXT'));assert.equal(result.airportInformation.generated,true);assert.equal(result.airportInformation.destinationInfo,parsed.airportInformation.destinationInfo);
 delete parsed.airportInformation;result=await call('bush');assert.equal(result.airportInformation.generated,false);assert.match(result.airportInformation.destinationInfo,/5743/);
 result=await call('apt');assert.ok(!sent.includes('AIRPORT_INFO_CONTEXT'));assert.equal(result.airportInformation,undefined);
});


test('Bush information keeps verified OpenAIP surface codes including zero, explicit labels and unknowns',()=>{
 const surface=v=>core.ownAirport({...u60,runways:[{surface:v}]}).runways[0].surface;
 for(const [code,label] of [[0,'Asphalt'],[1,'Beton'],[2,'Gras'],[4,'Wasser'],[12,'Kies'],[13,'Erde'],[14,'Eis'],[15,'Schnee']])assert.equal(surface({mainComposite:code}),label);
 assert.equal(surface({mainComposite:'0'}),'Asphalt');
 assert.equal(surface({mainComposite:0,mainCompositeName:'Asphalt / Beton'}),'Asphalt / Beton');
 assert.equal(surface('Schotter'),'Schotter');
 for(const value of [null,{},false,{mainComposite:null},{mainComposite:''},{mainComposite:false},{mainComposite:22},{mainComposite:99},{mainComposite:-1},{mainComposite:1.5}])assert.equal(surface(value),null);
 const c=core.context({...u60,runways:[{designator:'06',surface:{mainComposite:0}}]});
 assert.match(core.writerPrompt(c),/Asphalt/);assert.match(core.fallback(c).destinationInfo,/Asphalt/);
});


test('airport writing basis separates local evidence, handbook applicability and unknown current conditions',()=>{
 const c=core.context(u60),basis=core.writingBasis(c);
 assert.deepEqual(basis.own.airport,c.airport);assert.equal(basis.localSources.length,0);
 assert.equal(basis.terrainSample,null);assert.equal(basis.limits.currentRunwayCondition,'nicht beobachtet');
 assert.equal(basis.limits.aircraftPerformance,'nicht berechnet');
 assert.ok(basis.generalKnowledge.applicability['valley-wind'].includes('örtliche Quelle'));
 const sourced=core.context(u60,{wiki:core.selectWiki(u60,wiki(),'en'),terrain:{maxFt:8328,radiusNm:1}});
 const b=core.writingBasis(sourced);assert.equal(b.localSources.length,1);assert.equal(b.localSources[0].kind,'wikipedia');
 assert.equal(b.terrainSample.maxFt,8328);assert.match(b.limits.terrainShape,/keine klassifizierte/);
 assert.equal(c.sources.length,4); // Projection does not mutate cached sources.
});


test('standalone place editor excludes fictional passenger/story while preserving bounded sources and weather',async()=>{
 const c=core.context(u60,{wiki:core.selectWiki(u60,wiki(),'en')}),weather={schema:'fixture',start:{temperatureC:12}};
 let sent,calls=0;const result=await browser().generate({missionType:'bush',airportInfoContext:c,environmentContext:weather,story:'SECRET FICTION',passenger:{name:'SECRET PERSON'}},{request:async prompt=>{calls++;sent=prompt;return {parsed:{airportInformation:{flightBriefing:'Gras.',destinationInfo:'Platzdaten.',sourceIds:['wikipedia']}}};}});
 assert.equal(result.status,'ready');assert.equal(calls,1);assert.ok(!sent.includes('SECRET'));assert.match(sent,/It serves a lodge/);assert.ok(sent.includes(JSON.stringify(weather)));
 assert.equal(core.attach({},result.parsed,c).airportInformation.generated,true);
 assert.equal((await browser().generate({missionType:'apt',airportInfoContext:c},{request:()=>{throw Error('must not call');}})).status,'not_applicable');
});

test('optional standalone place editor errors and deadline retain own-data fallback, ignoring late response',async()=>{
 const c=core.context(u60),b=browser();let release;
 const result=await b.generate({missionType:'bush',airportInfoContext:c},{budgetMs:30,request:()=>new Promise(r=>release=r)});
 assert.equal(result.status,'timeout');assert.equal(core.attach({},result.parsed,c).airportInformation.generated,false);
 release({parsed:{airportInformation:{flightBriefing:'late',destinationInfo:'late',sourceIds:[]}}});await new Promise(r=>setTimeout(r,5));assert.equal(result.parsed,null);
 const failed=await b.generate({missionType:'bush',airportInfoContext:c},{request:async()=>{throw Error('API unavailable');}});assert.equal(failed.status,'unavailable');
 assert.equal(core.attach({},failed.parsed,c).airportInformation.generated,false);
});


test('Bush writer material preserves local evidence and cached context while general lessons use known data',()=>{
 const c=core.context({...u60,runways:[{designator:'01',surface:'Gras',length:1082,width:34}]},{wiki:core.selectWiki(u60,wiki(),'en'),faa:{ident:'U60',remarks:['LAND SOUTH, TAKEOFF NORTH'],effectiveFrom:'2026-10-01'}});
 const before=JSON.stringify(c),out=core.writerContext(c);
 assert.equal(JSON.stringify(c),before);assert.deepEqual(out.airport,c.airport);
 assert.deepEqual(out.sources.filter(s=>s.kind!=='pilot-handbook'),c.sources.filter(s=>s.kind!=='pilot-handbook'));
 assert.deepEqual(out.pilotHints.map(h=>h.id),['density-altitude','surface-condition']);
 assert.ok(out.sources.filter(s=>s.kind==='pilot-handbook').every(s=>out.pilotHints.some(h=>h.source===s.id)));
 const unknown=core.writerContext(core.context({...u60,elevation:null,runways:[]}));assert.equal(unknown.pilotHints.length,0);
 const draft=core.factualDraft(out);assert.ok(draft.flightBriefing.includes('1082'));assert.ok(draft.flightBriefing.includes('34'));assert.ok(draft.flightBriefing.includes('5743'));
});
