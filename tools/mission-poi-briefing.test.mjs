import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {extractOriginalFunction} from './extract-original-function.mjs';
import core from '../mission-poi-briefing-core.js';
import sharedCore from '../mission-poi-briefing-shared-core.js';
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
 for(const f of core.writerContext(c).facts.filter(f=>f.role==='hazard'))if(f.name!==f.kind)assert.ok(written.report.obstacles.includes(f.name));
 assert.match(written.report.dataQuality,/weitere Hindernisse/);
 assert.ok(written.report.terrain.length>0);
 if(c.facts.some(f=>f.role==='cover-nearby-only'&&!f.tags.man_made&&!f.tags.infra_type))assert.match(written.report.situation,/In der Umgebung ist/);
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
 const globals={window:{MissionPoiBriefingCore:core,MissionPoiBriefingSharedCore:sharedCore,MissionPrivateEpisodeV6:flightApi,MissionCharterIdeasCore:charter,MissionPrivateContextCore:options.contextApi},localStorage:s,AbortSignal,Response,Blob,DecompressionStream,TextDecoder,Uint8Array,console,
 fetch:options.fetch||(()=>Promise.reject(Error('offline'))),getSelectedAiApiKey:()=>'',
 getMissionAircraftCapabilitySnapshot:()=>({passengerCapacity:options.capacity??1}),
 normalizeMissionProposalChoice:x=>x,missionProposalCompactTarget:x=>x,missionProposalFormatRoute:()=>({label:'10 NM'}),
 fetchGeminiJsonWithFallback:async(prompt)=>{requests.push(prompt);return {parsed:await options.ai?.(prompt,requests.length)};}};
 vm.runInNewContext(fs.readFileSync('mission-poi-briefing-shared-browser.js','utf8'),globals);
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
 assert.match(m.s,/keine Geländehöhen/);assert.match(m.s,/nicht, dass die Umgebung hindernisfrei/);
 await assert.rejects(()=>b.api.story({start:home,dest:{...target,lat:49.2},proposal:choices[0].poiProposal}));
 assert.equal(b.requests.length,2);
});
test('DEM envelope is described as samples; null values never become zero heights',()=>{
 const {c,idea}=fixture();c.supplements=[];c.terrain={status:'missing'};
 c.terrainEnvelope={centerFt:null,maxFt:null};assert.match(core.validateWriter({...runs[0].writer,targetId:c.id},idea,c).report.terrain,/keine Geländehöhen/);
 c.terrainEnvelope={centerFt:500,maxFt:1200,sampleCount:25,radiusNm:1,source:'terrarium-area'};
 assert.match(core.validateWriter({...runs[0].writer,targetId:c.id},idea,c).report.terrain,/höchste erfasste Punkt/);
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
 assert.match(w.report.obstacles,/Wasserturm.*550 m westlich/);
 assert.match(w.report.obstacles,/Wasserturm.*700 m östlich/);
 assert.match(w.report.situation,/Kläranlage.*750 m nördlich/);
 assert.doesNotMatch(w.report.obstacles,/Bauwerksreferenzpunkt/);
 assert.doesNotMatch(w.report.terrain,/17358|Industriefläche/);
 assert.doesNotMatch(w.report.terrain,/Höhenmodell|Hangneigung|Hänge|Stichproben/);assert.match(w.report.terrain,/2163 ft MSL/);assert.match(w.report.terrain,/1 NM.*2202 ft MSL/);
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
 for(const pattern of [/EDDS/,/Wind 0 kt/,/ältere Meldung/,/28.9.2026, 15:00 UTC/,/22,2 NM/,/Ceiling 1800 ft über Grund/,/Zielgebiet – EDSB/,/Böen 17 kt/,/Wolkenbasis 1200 ft über Grund/,/Beobachtungszeit unbekannt/])assert.match(text,pattern);
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
 assert.equal(report.orientation,'Zur Orientierung hilft dir Pfalzgrafenweiler: Das Ziel liegt etwa 1 km nordwestlich davon. Ein weiterer Bezugspunkt ist Durrweiler; das Ziel liegt etwa 1,1 km nördlich davon.');
 assert.doesNotMatch(report.orientation,/Kartenpunkt|1898|1087/);
 const {m}=fixture();for(const label of ['Lage und Orientierung','Geländehöhen','Hindernisse'])assert.ok(m.s.includes(label+'\n'));assert.doesNotMatch(m.s,/Datengrundlage/);
});

test('Hausach remains available beside river and explicitly identified bridges, not road labels alone',async()=>{
 const b=browser({fetch:async url=>new Response(fs.readFileSync(url))});
 const c=await b.api.context({name:'Sommerbergtunnel',lat:48.28977,lon:8.17377});
 const nav=core.writerContext(c),city=nav.facts.find(f=>f.name==='Hausach'),bridge=nav.facts.find(f=>f.name==='Straßenbrücke B 33 / B 294');
 assert.ok(city);assert.ok(bridge);assert.ok(nav.facts.some(f=>f.name==='Fluss Kinzig'));
 assert.match(c.targetFacts.map(f=>f.fact).join(' '),/Straßentunnel.*B 33 und B 294/);
 const selection={orientationIds:[city.id,bridge.id],orientationText:`Hausach hilft dir bei der Orientierung: Das Ziel liegt [[${city.id}.targetLocation]]. Einen weiteren Bezug bietet die Bundesstraßenbrücke; von ihr aus liegt das Ziel [[${bridge.id}.targetLocation]].`};
 const report=core.renderStructuredReport(selection,c);
 assert.match(report.orientation,/hilft dir Hausach/);assert.match(report.orientation,/700 m nördlich davon/);assert.match(report.orientation,/Straßenbrücke B 33 \/ B 294/);
 for(const orientationText of ['100 m südlich von Hausach', 'Am [[foreign.name]].',`Bei [[${city.id}.name]].`]){
  const fallback=core.renderStructuredReport({...selection,orientationText},c).orientation;
  assert.match(fallback,/Das Ziel liegt etwa/);assert.doesNotMatch(fallback,/foreign|100 m südlich/);
 }
});

test('same station and same observation can use one gust binding and one readable weather summary',()=>{
 const raw={station:'EDTL',source:'METAR',observedAt:'2026-09-28T19:50:00.000Z',freshness:'recent',windKts:2,gustKts:8,visKm:10,cloudBaseFtAgl:18000};
 const flight=flightApi.flightContext({route:{distanceNm:20.4},weather:{dep:{raw:{...raw,stationDistanceNm:24.6}},dest:{raw:{...raw,stationDistanceNm:14.6}}}});
 assert.equal(flightApi.sameWeatherObservation(...flight.weather),true);
 assert.match(flightApi.resolveFlightBriefing('Die Strecke ist [[route.distance]] lang. Für Start und Ziel meldet [[start.station]] um [[start.observedAt]] Böen bis [[start.gust]].',flight),/19:50 UTC/);
 const text=flightApi.weatherFallback(flight,{targetLabel:'Zielgebiet'});
 assert.equal(text.split('EDTL').length-1,1);assert.equal(text.split('Wind 2 kt').length-1,1);
 assert.match(text,/dieselbe Meldung/);assert.match(text,/24,6 NM vom Start, 14,6 NM vom Ziel/);assert.doesNotMatch(text,/2026-09-28T|Ceiling/);
 for(const patch of [{observedAt:'2026-09-28T19:20Z'},{windKts:7},{station:'EDDS'},{freshness:'stale'},{observedAt:null}]){
  const other=structuredClone(flight);Object.assign(other.weather[1],patch);
  assert.equal(flightApi.sameWeatherObservation(...other.weather),false);
  assert.doesNotMatch(flightApi.weatherFallback(other),/dieselbe Meldung/);
  assert.equal(flightApi.resolveFlightBriefing('[[route.distance]] [[start.gust]]',other),'');
 }
});

test('recorded Hausach writer replay cannot move the bridge or turn one station into route-wide weather',async()=>{
 const saved=JSON.parse(fs.readFileSync('tools/fixtures/poi-hausach-writer-v13.json'));
 const start={name:'Winzeln-Schramberg Airport',lat:48.27917,lon:8.42833};
 const b=browser({ai:()=>saved.raw});
 const raw={station:'EDTL',source:'METAR',observedAt:'2026-09-28T19:50:00.000Z',freshness:'recent',windKts:2,visKm:10,cloudBaseFtAgl:18000};
 const m=await b.api.story({start,dest:saved.context.target,proposal:{schema:'poi-photo-proposal.v1',start,context:saved.context,idea:saved.idea},contract:{route:{distanceNm:20.4},weather:{dep:{raw:{...raw,stationDistanceNm:24.6}},dest:{raw:{...raw,stationDistanceNm:14.6}}}}});
 assert.equal(m._missionWriterV4Debug.rawAiStory,saved.raw.story);
 assert.match(m.poiBriefing.report.orientation,/Hausach: Das Ziel liegt etwa 700 m nördlich davon/);
 assert.match(m.poiBriefing.report.orientation,/Straßenbrücke B 33 \/ B 294; das Ziel liegt etwa 600 m östlich davon/);
 assert.doesNotMatch(m.poiBriefing.report.orientation,/etwa etwa|die etwa/);
 assert.equal(m.poiBriefing.flightBriefingStatus,'shared-observation');
 assert.equal(m.poiBriefing.flightBriefing.split('EDTL').length-1,1);
 assert.doesNotMatch(m.poiBriefing.flightBriefing,/weht ruhig|über die Distanz|ist die Sicht gut/);
 assert.match(m.poiBriefing.flightBriefing,/Böen/);assert.equal(b.requests.length,1);
});

test('landmark choice generalizes across names and regions and preserves bridge types',()=>{
 const rows=[
  {name:'Ort A',place:'town',lat:48.005,lon:8},
  {name:'Fluss B',waterway:'river',lat:48,lon:8.008},
  {name:'Route C',infra_type:'bridge',highway:'primary',lat:47.995,lon:8},
  {name:'Weg D',infra_type:'bridge',highway:'footway',lat:48,lon:7.995},
  {name:'Bauwerk E',infra_type:'bridge',lat:48.005,lon:8.008}
 ];
 const original=core.selectFacts({name:'Motiv',lat:48,lon:8},rows);
 const renamed=core.selectFacts({name:'Anderes Motiv',lat:38,lon:18},rows.map((r,i)=>({...r,name:'Unbekannt '+i,lat:r.lat-10,lon:r.lon+10})));
 assert.equal(original.facts.length,5);assert.equal(renamed.facts.length,5);
 assert.deepEqual(original.facts.map(f=>f.tags).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))),renamed.facts.map(f=>f.tags).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))));
 const c={target:{name:'Motiv',lat:48,lon:8},radiusM:5556,coverage:[],supplements:[],facts:original.facts};
 const names=core.writerContext(c).facts.map(f=>f.name);
 assert.ok(names.includes('Straßenbrücke Route C'));
 assert.ok(names.includes('Fuß- oder Radwegbrücke Weg D'));
 assert.ok(names.includes('Brücke Bauwerk E'));
});

test('selected writer receives sourced environment facts, with bounded fallback and cache reuse',async()=>{
 const record=JSON.parse(fs.readFileSync('tools/fixtures/poi-environment-map-evidence.json')).cases[0];
 const calls=[];const {c:base,idea:oldIdea}=fixture();
 const c={...base,target:record.target,id:'poi:environment-test'};
 const idea=core.validateIdea({...oldIdea,targetId:c.id,targetName:c.target.name},c),start={name:'Start',lat:48.2,lon:8.2};
 const b=browser({fetch:async url=>{calls.push(url);return String(url).includes('overpass')?new Response('',{status:406}):new Response(JSON.stringify(record.payload));},ai:prompt=>{
  const facts=JSON.parse(prompt.split('STORY_FACTS=')[1].split('\nNAVIGATION=')[0]);
  assert.ok(facts.some(f=>f.evidence==='osm-tags-and-polygon'&&f.source.startsWith('https://www.openstreetmap.org/')));
  return {...runs[0].writer,targetId:c.id,greetingSpeaker:idea.person.name,usedFactIds:[],report:{orientationIds:[]}};
 }});
 const args={start,dest:c.target,proposal:{schema:'poi-photo-proposal.v1',start,context:c,idea}};
 const m=await b.api.story(args);await b.api.story(args);
 assert.equal(calls.length,2);assert.equal(b.requests.length,2);
 assert.equal(m.poiBriefing.sourceContext.environmentFacts.length,4);
 assert.match(m.poiBriefing.report.situation,/Wiesenfläche/);
 assert.doesNotMatch(m.s,/Datengrundlage/);
});

test('environment provider cooldown also protects a second selected destination',async()=>{
 const {c,idea}=fixture(),start={name:'Start',lat:48.2,lon:8.2};const calls=[];
 const b=browser({fetch:async url=>{calls.push(url);return new Response('',{status:429});},ai:()=>({...runs[0].writer,targetId:c.id,greetingSpeaker:idea.person.name,usedFactIds:[],report:{orientationIds:[]}})});
 await b.api.story({start,dest:c.target,proposal:{schema:'poi-photo-proposal.v1',start,context:c,idea}});
 const next={...c,target:{...c.target,lat:c.target.lat+.01}};
 await b.api.story({start,dest:next.target,proposal:{schema:'poi-photo-proposal.v1',start,context:next,idea}});
 assert.equal(calls.length,2);
});

test('photo history reaches the next picker and writer without becoming a new chosen idea',async()=>{
 const previous=fixture().m,store=storage(),home={name:'Home',lat:49,lon:8},target={name:'Ziel',lat:49.1,lon:8.1};
 previous.poiBriefing.writerMemory='Eigenständiger persönlicher Verwendungszweck der Fotos.';
 core.remember(store,'previous',previous.poiBriefing);core.remember(store,'previous',previous.poiBriefing);
 const b=browser({storage:store,ai:(prompt,n)=>{
  if(n===1){const f=JSON.parse(prompt.split('RAHMEN=')[1])[0];return {ideas:[{schema:core.IDEA_VERSION,targetId:f.id,targetName:f.target,taskDomain:'media_photo',situation:'Ada plant eine kleine Ausstellung.',intent:'Sie möchte Fotos des Ziels zeigen.',person:{name:'Ada',role:'Fotografin',relationshipToPilot:'Kundin'}}]};}
  return {targetId:'poi:49.100000:8.100000',title:'Bilder für Ada',story:'Ada möchte das Ziel für ihre Ausstellung fotografieren. Danach kehrt ihr zurück.',greetingSpeaker:'Ada',greeting:'Hallo, ich freue mich auf die Fotos.',report:{orientationIds:[]},usedFactIds:[]};
 }});
 const choices=await b.api.choices([target],{start:home,selectedPoiCategory:'all'});
 const m=await b.api.story({start:home,dest:target,proposal:choices[0].poiProposal});
 for(const rows of [JSON.parse(b.requests[0].split('RAHMEN=')[1])[0].recent,JSON.parse(b.requests[1].split('HISTORY=')[1])]){
  assert.equal(rows.length,1);assert.equal(rows[0].intent,previous.poiBriefing.idea.intent);
  assert.equal(rows[0].relationship,previous.poiBriefing.idea.person.relationshipToPilot);
  assert.equal(rows[0].writerMemory,previous.poiBriefing.writerMemory);
 }
 assert.equal(m.poiBriefing.idea.intent,'Sie möchte Fotos des Ziels zeigen.');
});
