import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {extractOriginalFunction} from './extract-original-function.mjs';
import core from '../mission-poi-briefing-core.js';
const require=createRequire(import.meta.url),clone=x=>JSON.parse(JSON.stringify(x));
require('../mission-private-outing-core.js');
const flightApi=require('../mission-private-episode-v6.js'),charter=require('../mission-charter-ideas-core.js');
const sources=JSON.parse(fs.readFileSync('tools/fixtures/poi-briefing-replay.json'));
const runs=sources.runs;
function fixture(run=runs[0]) {
 const c=clone(sources.cases.find(c=>c.id===run.id));
 // Explicit fixture migration: archived professional media examples were mislabeled
 // inspection_infra. No archive mutation, runtime classifier, or fresh live success claim.
 const idea=core.validateIdea({...run.idea,schema:core.IDEA_VERSION,taskDomain:'media_photo'},c);
 const written=core.validateWriter({...run.writer,targetId:c.id},idea,c);
 return {c,idea,written,m:core.mission(idea,written,c)};
}
const storage=()=>{const values=new Map();return {getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};};
for(const run of runs)test(`archived v18 media replay preserves story, speaker and factual report: ${run.id}`,()=>{
 const {c,idea,written,m}=fixture(run);
 assert.equal(written.story,run.writer.story);assert.equal(m.passenger.greetingText,run.writer.greeting);
 assert.equal(m.passenger.name,idea.person.name);assert.equal(m.passenger.taskDomain,'media_photo');
 const baseline=run.baseline;
 for(const field of ['obstacles','dataQuality'])assert.equal(written.report[field],baseline[field]);
 assert.ok(written.report.terrain.startsWith(baseline.terrain));
 if(c.facts.some(f=>f.role==='cover-nearby-only'&&!f.tags.man_made&&!f.tags.infra_type))assert.match(written.report.terrain,/keine Flächen-/);
 assert.ok(core.owns(m));assert.equal(m.poiBriefing.capture.evaluation,undefined);
 assert.equal(m._missionContractV4.poiBriefing,m.poiBriefing);
});
test('target, speaker and fact identities fail closed; old inspection schema is not accepted',()=>{
 const {c,idea}=fixture();
 for(const patch of [{schema:'poi-idea-pilot.v15'},{taskDomain:'inspection_infra'},{targetName:'Anderes Ziel'},{targetId:'other'}])assert.throws(()=>core.validateIdea({...idea,...patch},c));
 for(const patch of [{targetId:'other'},{greetingSpeaker:'Anderer Gast'},{usedFactIds:['invented']}])assert.throws(()=>core.validateWriter({...runs[0].writer,targetId:c.id,...patch},idea,c));
 for(const p of [{lat:null,lon:8},{lat:91,lon:8},{lat:48,lon:''}])assert.throws(()=>core.point({name:'Ziel',...p}));
});
test('history survives reload, deduplicates mission id, and is bounded',()=>{
 const s=storage(),{m}=fixture();for(let i=0;i<16;i++)core.remember(s,'m'+i,m.poiBriefing);
 core.remember(s,'m15',m.poiBriefing);assert.equal(core.history(s).length,12);
 assert.equal(core.history(s).at(-1).intent,m.poiBriefing.idea.intent);
 assert.match(core.ideaPrompt([core.frame(fixture().c,core.history(s))]),/recent/);
});
function browser(options={}) {
 const s=options.storage||storage(),requests=[];
 const globals={window:{MissionPoiBriefingCore:core,MissionPrivateEpisodeV6:flightApi,MissionCharterIdeasCore:charter,MissionPrivateContextCore:options.contextApi},localStorage:s,AbortSignal,Response,Blob,DecompressionStream,TextDecoder,Uint8Array,console,
 fetch:options.fetch||(()=>Promise.reject(Error('offline'))),getSelectedAiApiKey:()=>'',
 getMissionAircraftCapabilitySnapshot:()=>({passengerCapacity:options.capacity??1}),
 normalizeMissionProposalChoice:x=>x,missionProposalCompactTarget:x=>x,missionProposalFormatRoute:()=>({label:'10 NM'}),
 fetchGeminiJsonWithFallback:async(prompt)=>{requests.push(prompt);return {parsed:await options.ai?.(prompt,requests.length)};}};
 vm.runInNewContext(fs.readFileSync('mission-poi-briefing-browser.js','utf8'),globals);
 return {api:globals.window.MissionPoiBriefingBrowser,storage:s,requests};
}
test('enabled by default with explicit rollback; only photo profile, no chains, followups, planning or offline',()=>{
 const b=browser();assert.equal(b.api.enabled({profileId:'media_photo'}),true);b.storage.setItem('ga_poi_briefing_v1','off');
 assert.equal(b.api.enabled({profileId:'media_photo'}),false);b.storage.removeItem('ga_poi_briefing_v1');
 assert.equal(b.api.enabled({profileId:'media_photo'}),true);
 for(const p of [{profileId:'inspection_infra'},{profileId:'news_coverage'},{isPOI:false},{category:'chain'},{followup:true},{planning:true},{bush:true},{aiModeEnabled:false}])assert.equal(b.api.enabled({profileId:'media_photo',...p}),false);
});
test('real local tiles: data points supply orientation and hazards without invented verified heights',async()=>{
 const b=browser({fetch:async url=>new Response(fs.readFileSync(url))});
 const c=await b.api.context(sources.cases[0].target);
 assert.ok(c.coverage.some(t=>t.status!=='unavailable'));assert.ok(c.facts.some(f=>f.role==='hazard'));
 for(const f of c.facts)assert.equal(f.heightFt,null);
 const ids=core.writerContext(c).facts.filter(f=>f.role==='orientation').slice(0,2).map(f=>f.id);
 const report=core.renderStructuredReport({orientationIds:ids},c);
 assert.match(report.obstacles,/nicht verifiziert/);
});
test('picker to writer uses the chosen idea once; rejects changed route, no silent new story',async()=>{
 const home={name:'Home',lat:49,lon:8},target={name:'Ziel',lat:49.1,lon:8.1};
 const b=browser({ai:(prompt,n)=>{
  if(n===1){const frame=JSON.parse(prompt.split('RAHMEN=')[1])[0];return {[frame.id]:{schema:core.IDEA_VERSION,targetId:frame.id,targetName:frame.target,taskDomain:'media_photo',situation:'Ada plant eine kleine Ausstellung.',intent:'Sie möchte Fotos des Ziels zeigen.',person:{name:'Ada',role:'Fotografin',relationshipToPilot:'Kundin'}}};}
  return {targetId:'poi:49.100000:8.100000',title:'Bilder für Ada',story:'Ada möchte das Ziel für ihre Ausstellung fotografieren. Du fliegst, sie macht Fotos; danach kehrt ihr zurück.',greetingSpeaker:'Ada',greeting:'Hallo, ich freue mich auf die Fotos.',report:{orientationIds:[]},usedFactIds:[]};
 }});
 const choices=await b.api.choices([target],{start:home,selectedPoiCategory:'all'});
 const m=await b.api.story({start:home,dest:target,proposal:choices[0].poiProposal});
 assert.equal(b.requests.length,2);assert.equal(m.poiBriefing.idea.situation,choices[0].poiProposal.idea.situation);
 assert.match(m.s,/keine Geländehöhen/);assert.match(m.s,/weitere Hindernisse/);
 await assert.rejects(()=>b.api.story({start:home,dest:{...target,lat:49.2},proposal:choices[0].poiProposal}));
 assert.equal(b.requests.length,2);
});
test('DEM envelope is described as samples; null values never become zero heights',()=>{
 const {c,idea}=fixture();c.supplements=[];c.terrain={status:'missing'};
 c.terrainEnvelope={centerFt:null,maxFt:null};assert.match(core.validateWriter({...runs[0].writer,targetId:c.id},idea,c).report.terrain,/keine Geländehöhen/);
 c.terrainEnvelope={centerFt:500,maxFt:1200,sampleCount:25,radiusNm:1,source:'terrarium-area'};
 assert.match(core.validateWriter({...runs[0].writer,targetId:c.id},idea,c).report.terrain,/Höchster erfasster Modellpunkt/);
});
function harness(){
 const c=vm.createContext({window:{MissionPoiBriefingCore:core},compactPoiChainForMission:x=>x});
 for(const [file,names] of [
 ['app.js',['applyMissionTaskProfileToMission','missionMatchesTaskProfile','compactMissionObjectForQuotaStorage','slimMissionObjectForActiveState','compactRouteWaypointsForQuotaStorage','compactAltWaypointsForQuotaStorage','compactSegmentAltsForQuotaStorage','compactElevationDataForQuotaStorage','compactFreqCacheForQuotaStorage','compactTextForQuotaStorage','compactPassengerForQuotaStorage','compactActiveMissionStateForQuotaStorage']],
 ['sync.js',['_syncJsonClone','_syncCompactMissionObjectCore','_syncStripDeepMissionPlans','_syncCompactFlightDataState','_syncCompactActiveMission']]]){
  const source=fs.readFileSync(file,'utf8');for(const name of names)vm.runInContext(extractOriginalFunction(source,name),c);
 }return c;
}
test('real app finalizer preserves new narrative, greeting and report without regex repairs',()=>{
 const h=harness(),{m}=fixture();const result=h.applyMissionTaskProfileToMission(m,true,'media_photo','old pax','old cargo');
 assert.equal(result.mission.s,m.s);assert.equal(result.mission.passenger,m.passenger);
 assert.equal(h.missionMatchesTaskProfile(m,'media_photo',true),true);
});
test('local quota → all cloud levels → restore → actual tracker cloud candidate preserves contract',()=>{
 const h=harness(),{m}=fixture();
 const source=fs.readFileSync('ga-tracker-client/tracker-mission-poi-lifecycle.test.js','utf8');
 const sandbox=vm.createContext({execution:require('../mission-execution-core.js'),lifecycle:require('../mission-poi-lifecycle-core.js'),voice:require('../mission-poi-voice-core.js'),boarding:require('../mission-boarding-voice-core.js'),poi:require('../ga-tracker-client/tracker-mission-poi-runtime.js')});
 for(const name of ['replay','bundle'])vm.runInContext(extractOriginalFunction(source,name),sandbox);
 const b=clone(sandbox.bundle());
 Object.assign(b.missionState.currentMissionData,{poiBriefing:m.poiBriefing,missionStory:m.s,passenger:m.passenger});
 b.missionState.activeMissionContract={missionId:b.missionId,poiBriefing:m.poiBriefing,missionStory:m.s};b.missionState.mStory=m.s;
 const local=clone(h.compactActiveMissionStateForQuotaStorage(b.missionState));
 for(const level of [1,2,3]) {
  const downloaded=clone(h._syncCompactActiveMission(local,level));
  const restored=clone(h.compactActiveMissionStateForQuotaStorage(downloaded));
  assert.deepEqual(restored.currentMissionData.poiBriefing,m.poiBriefing);assert.deepEqual(restored.activeMissionContract.poiBriefing,m.poiBriefing);
  const app=fs.readFileSync('app.js','utf8'),a=app.indexOf('    state.mStory = (window.MissionPoiBriefingCore'),z=app.indexOf('\n    document.',a);
  const restoreContext={state:restored,window:{MissionPoiBriefingCore:core},_cleanupNarrativeArtifacts:()=>{throw Error('must not rewrite');}};
  vm.runInNewContext(app.slice(a,z),restoreContext);assert.equal(restoreContext.state.mStory,m.s);
  const profile={activeMission:restored,activeMissionTrackerSeed:{schema:'ga.tracker-cloud-mission-seed.v1',version:1,missionId:b.missionId,adapter:'poi',executionPoiRecipe:b.executionPoiRecipe,executionEffectPlan:b.executionEffectPlan}};
  const result=require('../ga-tracker-client/tracker-mission-cloud.js').buildCloudMissionCandidate(profile,{poiExecutionEnabled:true});
  assert.equal(result.status,'ready',JSON.stringify(result));
  assert.deepEqual(result.candidate.bundle.missionState.currentMissionData.poiBriefing,m.poiBriefing);
  assert.equal(result.candidate.bundle.missionState.currentMissionData.passenger.greetingText,m.passenger.greetingText);
  assert.ok(Buffer.byteLength(JSON.stringify(result.candidate.bundle))<384*1024);
 }
});

test('structured target id permits natural German inflection without silently changing destination',()=>{
 const {c,idea}=fixture(runs.find(r=>r.id==='heidelberg'));
 const raw={...runs.find(r=>r.id==='heidelberg').writer,targetId:c.id,story:'Heute macht ihr Fotos von der Alten Brücke.'};
 assert.equal(core.validateWriter(raw,idea,c).story,raw.story);
 assert.throws(()=>core.validateWriter({...raw,targetId:'other'},idea,c));
});

test('same APT weather helpers reach POI writer, render bindings and preserve missing memory',async()=>{
 const {c,idea}=fixture(),start={name:'Home',lat:48,lon:8};
 const contract={route:{startName:'Home',targetName:c.target.name,distanceNm:42},weather:{dep:{raw:{station:'EDXX',raw:'METAR',freshness:'stale',windKts:10,gustKts:18,observedAt:'2026-09-28T10:00Z'}},dest:{raw:{station:'EDYY',windKts:5,gustKts:9}}}};
 const template='Die Strecke beträgt [[route.distance]]. Ältere Startmeldung von [[start.station]] mit Böen von [[start.gust]]; am Ziel meldet [[target.station]] Böen von [[target.gust]].';
 const b=browser({ai:prompt=>{assert.ok(prompt.includes('WERTE='));assert.ok(prompt.includes('stale'));return {...runs[0].writer,targetId:c.id,flightBriefing:template,memory:'Ein direkter Einstieg über den Kundenwunsch; Abschluss mit dem vorgesehenen Bildzweck.'};}});
 const proposal={schema:'poi-photo-proposal.v1',start,context:c,idea};
 const m=await b.api.story({start,dest:c.target,proposal,contract});
 assert.equal(m.poiBriefing.flightBriefing,flightApi.resolveFlightBriefing(template,flightApi.flightContext(contract)));
 assert.match(m.s,/18 Knoten/);assert.equal(m.poiBriefing.flightBriefingStatus,'accepted-bindings');
 core.remember(b.storage,'flight',m.poiBriefing);
 assert.equal(core.history(b.storage)[0].writerMemory,m.poiBriefing.writerMemory);
 assert.equal(core.history(b.storage)[0].openingExcerpt,runs[0].writer.story.slice(0,180));
});
test('invalid optional flight/report/memory cannot replace an accepted idea or story',async()=>{
 const {c,idea}=fixture(),start={name:'Home',lat:48,lon:8};
 const b=browser({ai:()=>({...runs[0].writer,targetId:c.id,flightBriefing:'Wind 25 Knoten garantiert.',memory:{invalid:true},report:{orientationIds:['foreign']}})});
 const m=await b.api.story({start,dest:c.target,proposal:{schema:'poi-photo-proposal.v1',start,context:c,idea}});
 assert.equal(m._missionWriterV4Debug.rawAiStory,runs[0].writer.story);
 assert.equal(m.poiBriefing.flightBriefingStatus,'no-observations');assert.equal(m.poiBriefing.writerMemory,null);
 assert.equal(m.poiBriefing.reportStatus,'source-selection-fallback');assert.equal(b.requests.length,1);
 assert.ok(!m.s.includes('25 Knoten'));assert.ok(!m.s.includes('foreign'));
});
test('APT place service reused, surrounding landmarks never become primary target evidence',async()=>{
 const target={name:'Alte Brücke',lat:49.41423,lon:8.70953};let calls=0;
 const contextApi={resolveBrowser:async p=>{calls++;assert.deepEqual(p,target);return {places:[
 {name:'Alte Brücke (Heidelberg)',lat:p.lat,lon:p.lon,description:'Brücke über den Neckar',source:'https://de.wikipedia.org/wiki/Alte_Brücke_(Heidelberg)',evidence:'wikipedia-coordinate'},
 {name:'Schloss',lat:p.lat,lon:p.lon,description:'Nachbarbauwerk',source:'https://example.test/schloss',evidence:'wikipedia-coordinate'},
 {name:'Alte Brücke',lat:50,lon:8,description:'Anderer Ort',source:'https://example.test/anders',evidence:'wikipedia-coordinate'}]};}};
 const b=browser({contextApi});const c=await b.api.context(target);
 assert.equal(calls,1);assert.equal(c.targetFacts.length,1);assert.match(c.targetFacts[0].fact,/Neckar/);
 const prompt=core.ideaPrompt([core.frame(c)]);assert.ok(!prompt.includes('Nachbarbauwerk'));assert.ok(!prompt.includes('Anderer Ort'));
});
test('direct dispatch uses same idea/writer and existing weather path, with no planner or runtime calls',async()=>{
 const start={name:'Home',lat:48,lon:8},dest={name:'Ziel',lat:49,lon:8};
 const b=browser({ai:(prompt,n)=>{
 if(n===1){const f=JSON.parse(prompt.split('RAHMEN=')[1])[0];return {[f.id]:{schema:core.IDEA_VERSION,targetId:f.id,targetName:f.target,taskDomain:'media_photo',situation:'Ada braucht Bilder.',intent:'Eine Ausstellung vorbereiten.',person:{name:'Ada',role:'Fotografin',relationshipToPilot:'Kundin'}}};}
 return {targetId:'poi:49.000000:8.000000',title:'Ada und ihre Bilder',story:'Ada möchte Fotos für eine Ausstellung machen.',greetingSpeaker:'Ada',greeting:'Hallo!',usedFactIds:[],report:{orientationIds:[]},flightBriefing:'Es liegen keine Wetterbeobachtungen vor.'};
 }});
 const m=await b.api.story({start,dest});assert.equal(b.requests.length,2);assert.equal(m.poiBriefing.idea.person.name,'Ada');assert.equal(m.passengerCount,1);
});

test('available weather with invalid optional paragraph is diagnosed without replacing story',async()=>{
 const {c,idea}=fixture(),start={name:'Home',lat:48,lon:8};
 const b=browser({ai:()=>({...runs[0].writer,targetId:c.id,flightBriefing:'[[invented.wind]]'})});
 const m=await b.api.story({start,dest:c.target,proposal:{schema:'poi-photo-proposal.v1',start,context:c,idea},contract:{weather:{dep:{raw:{windKts:5}}}}});
 assert.equal(m.poiBriefing.flightBriefingStatus,'observations-fallback');assert.match(m.poiBriefing.flightBriefing,/Wind 5 kt/);assert.equal(m._missionWriterV4Debug.rawAiStory,runs[0].writer.story);
 assert.equal(b.requests.length,1);
});

test('APT ideas envelope and equivalent transport forms preserve identity, rejecting duplicate or absent targets',()=>{
 const {c,idea}=fixture();
 for(const raw of [{ideas:[idea]},[idea],{[c.id]:idea}])assert.deepEqual(core.readIdea(raw,c),idea);
 for(const raw of [{ideas:[idea,idea]},{ideas:[{...idea,targetId:'other'}]},[]])assert.throws(()=>core.readIdea(raw,c));
});

test('reported Pfalzgrafenweiler target keeps its coordinates and yields concrete local object names',async()=>{
 const target={name:'1898 1998 SWV Pfalzgrafenweiler e.V.',lat:48.52983,lon:8.55261};
 const b=browser({fetch:async url=>new Response(fs.readFileSync(url))});
 const c=await b.api.context(target,{centerFt:2163,maxFt:2202,sampleCount:17358,radiusNm:1,source:'terrarium-area'});
 assert.deepEqual(c.target,target);assert.match(c.targetFacts[0].fact,/Denkmal/);
 const idea=core.validateIdea({...fixture().idea,targetId:c.id,targetName:target.name},c);
 const w=core.validateWriter({...runs[0].writer,targetId:c.id,greetingSpeaker:idea.person.name,usedFactIds:[],report:{orientationIds:[]}},idea,c);
 assert.match(w.report.obstacles,/Wasserturm.*573 m westlich/);
 assert.match(w.report.obstacles,/Wasserturm.*717 m östlich/);
 assert.match(w.report.terrain,/Kläranlage.*740 m nördlich/);
 assert.doesNotMatch(w.report.obstacles,/Bauwerksreferenzpunkt/);
 assert.doesNotMatch(w.report.terrain,/17358|Industriefläche/);
 assert.match(w.report.terrain,/2163 ft MSL/);assert.match(w.report.terrain,/1 NM: 2202 ft MSL/);
});

test('shared POI category uses historic tags: memorials cannot become castles through their names',()=>{
 const src=fs.readFileSync('app.js','utf8'),h=vm.createContext({}),loaded=new Set();
 function load(name){
  if(loaded.has(name))return;loaded.add(name);
  const code=extractOriginalFunction(src,name);
  for(const candidate of new Set(code.match(/\b[_a-zA-Z]\w*(?=\()/g)))if(src.includes('function '+candidate+'('))load(candidate);
  vm.runInContext(code,h);
 }
 load('_poiFeatureMatchesCategory');load('_poiInferCategoryFromFeature');
 for(const historic of ['monument','memorial'])for(const name of ['1898 1998 SWV Pfalzgrafenweiler e.V.','Denkmal an der Burg']){
  const f={name,tags:{historic}};assert.equal(h._poiFeatureMatchesCategory(f,'castle'),false);assert.equal(h._poiInferCategoryFromFeature(f),'generic');
 }
 for(const historic of ['castle','ruins','fort'])assert.equal(h._poiFeatureMatchesCategory({name:'Historischer Ort',tags:{historic}},'castle'),true);
 assert.notEqual(h.classifyPOITitleCategory('Vereinsdenkmal Monument'),'castle');
 for(const [tags,category] of [[{infra_type:'bridge',historic:'monument'},'bridge'],[{place:'village'},'city'],[{waterway:'dam'},'dam']])assert.equal(h._poiInferCategoryFromFeature({name:'Ort',tags}),category);
});

for(const flightBriefing of [undefined,'Wind 12 Knoten.','[[invented.wind]]','[[start.wind]]'])test(`weather fallback preserves observations when model output is ${String(flightBriefing)}`,async()=>{
 const {c,idea}=fixture(),start={name:'Home',lat:48,lon:8};
 const b=browser({ai:()=>({...runs[0].writer,targetId:c.id,flightBriefing})});
 const contract={route:{startName:'Home',targetName:c.target.name,distanceNm:33,targetIcao:'EDTW'},weather:{dep:{raw:{station:'EDDS',windKts:0,gustKts:null,visKm:10,ceilingFtAgl:1800,observedAt:'2026-09-28T15:00Z',freshness:'stale',stationDistanceNm:22.24}},dest:{raw:{station:'EDSB',windKts:8,gustKts:17,cloudBaseFtAgl:1200,stationDistanceNm:14,observedAt:null}}}};
 const m=await b.api.story({start,dest:c.target,proposal:{schema:'poi-photo-proposal.v1',start,context:c,idea},contract});
 const text=m.poiBriefing.flightBriefing;
 assert.equal(m.poiBriefing.flightBriefingStatus,'observations-fallback');
 for(const pattern of [/EDDS/,/Wind 0 kt/,/ältere Meldung/,/2026-09-28T15:00Z/,/22,2 NM/,/Ceiling 1800 ft über Grund/,/Zielgebiet – EDSB/,/Böen 17 kt/,/Wolkenbasis 1200 ft über Grund/,/Beobachtungszeit unbekannt/])assert.match(text,pattern);
 assert.doesNotMatch(text,/EDTW|böenfrei|kein gültiger Wetterabsatz|invented/);
 assert.equal(m._missionWriterV4Debug.rawAiStory,runs[0].writer.story);assert.equal(b.requests.length,1);
});

test('gust-only and raw-only observations are retained; missing destination stays unknown',async()=>{
 for(const raw of [{gustKts:22},{raw:'METAR EDDS 281500Z VRB02KT CAVOK'}]){
  const {c,idea}=fixture(),start={name:'Home',lat:48,lon:8};
  const b=browser({ai:()=>({...runs[0].writer,targetId:c.id,flightBriefing:'invalid 123'})});
  const m=await b.api.story({start,dest:c.target,proposal:{schema:'poi-photo-proposal.v1',start,context:c,idea},contract:{weather:{dep:{raw}}}});
  assert.equal(m.poiBriefing.flightBriefingStatus,'observations-fallback');
  assert.match(m.poiBriefing.flightBriefing,raw.raw?/METAR EDDS/:/Böen 22 kt/);
  assert.match(m.poiBriefing.flightBriefing,/Zielgebiet: keine verwertbare Wetterbeobachtung/);
 }
});


test('POI writer flight frame identifies the target as POI, not the return airport',()=>{
 const src=fs.readFileSync('app.js','utf8');
 const start=src.indexOf('if (usePoiPhotoIdeas) {\n            missionContractV4');
 assert.ok(start>0);
 const stop=src.indexOf('} else if',start);
 assert.match(src.slice(start,stop),/targetIcao:'POI'/);
});


test('orientation uses short target-first wording, rounded distances and no repeated long target name',async()=>{
 const b=browser({fetch:async url=>new Response(fs.readFileSync(url))});
 const c=await b.api.context({name:'1898 1998 SWV Pfalzgrafenweiler e.V.',lat:48.52983,lon:8.55261});
 const orientationIds=['Pfalzgrafenweiler','Durrweiler'].map(name=>c.facts.find(f=>f.name===name).id);
 const report=core.renderStructuredReport({orientationIds},c);
 assert.equal(report.orientation,'Das Ziel liegt etwa 1 km nordwestlich von „Pfalzgrafenweiler“ und 1,1 km nördlich von „Durrweiler“.');
 assert.doesNotMatch(report.orientation,/Kartenpunkt|1898|1087/);
 const {m}=fixture();for(const label of ['Ziel finden','Gelände und Umgebung','Hindernisse','Datengrundlage'])assert.ok(m.s.includes(label+'\n'));
});
