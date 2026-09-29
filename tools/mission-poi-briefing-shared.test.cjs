const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const shared=require('../mission-poi-briefing-shared-core.js'),photo=require('../mission-poi-briefing-core.js');
const archive=require('./fixtures/poi-briefing-replay.json'),baseline=require('./fixtures/poi-shared-extraction-baseline.json');
test('extraction preserves complete released photo texts and reports',()=>{
 for(const expected of baseline.cases){
  const run=archive.runs.find(r=>r.id===expected.id),c=archive.cases.find(c=>c.id===run.id);
  const idea=photo.validateIdea({...run.idea,schema:photo.IDEA_VERSION,taskDomain:'media_photo'},c);
  const written=photo.validateWriter({...run.writer,targetId:c.id},idea,c);
  assert.equal(require('node:crypto').createHash('sha256').update(photo.writerPrompt(c,idea,[])).digest('hex'),expected.writerPromptSha256);
  assert.deepEqual(written.report,expected.report);assert.equal(photo.mission(idea,written,c).s,expected.story);
 }
});
test('shared report supports arbitrary POI consumers without manufacturing a photo or passenger contract',()=>{
 const c=structuredClone(archive.cases[0]);
 for(const profile of ['inspection_infra','news_coverage','science_survey']){
  const input={...c,profile};const before=JSON.stringify(input);
  const {report,reportStatus}=shared.buildReport(undefined,input);
  assert.equal(reportStatus,'source-selection-fallback');assert.match(shared.formatReport(report),/Lage und Orientierung/);
  assert.equal(JSON.stringify(input),before);assert.equal(report.passenger,undefined);assert.equal(report.taskDomain,undefined);
 }
});
test('common weather handles identical, different and absent observations independently of narrative',()=>{
 const observation={station:'EDTL',source:'METAR',observedAt:'2026-09-28T19:50:00.000Z',windKts:2,visKm:10};
 const contract={weather:{dep:{raw:{...observation,stationDistanceNm:24.6}},dest:{raw:{...observation,stationDistanceNm:14.6}}}};
 const flight=shared.prepareFlight(contract);const result=shared.resolveWeather('[[unknown]]',flight.context);
 assert.equal(result.flightBriefingStatus,'shared-observation');assert.equal((result.flightBriefing.match(/EDTL/g)||[]).length,1);
 assert.match(result.flightBriefing,/24,6 NM vom Start, 14,6 NM vom Ziel/);
 contract.weather.dest.raw.station='EDDS';
 const other=shared.resolveWeather('[[unknown]]',shared.prepareFlight(contract).context);
 assert.equal(other.flightBriefingStatus,'observations-fallback');assert.match(other.flightBriefing,/EDDS/);
 assert.equal(shared.resolveWeather('',shared.prepareFlight({}).context).flightBriefingStatus,'no-observations');
 assert.equal(result.story,undefined);
});
test('browser script order and offline asset manifest load the shared APIs before photo adapter',()=>{
 const html=fs.readFileSync('index.html','utf8'),sw=fs.readFileSync('sw.js','utf8');
 const files=['mission-private-context-core.js','mission-private-outing-core.js','mission-private-episode-v6.js','mission-poi-briefing-shared-core.js','mission-poi-briefing-shared-browser.js','mission-poi-briefing-core.js','mission-poi-briefing-browser.js'];
 const context=vm.createContext({console});vm.runInContext('window=globalThis;',context);
 for(const file of files)vm.runInContext(fs.readFileSync(file,'utf8'),context,{filename:file});
 for(const file of files.slice(3,5)){assert.ok(html.indexOf(file)<html.indexOf('mission-poi-briefing-core.js'));assert.ok(sw.includes("'./"+file+"'"));}
 assert.equal(typeof context.MissionPoiBriefingSharedCore.resolveWeather,'function');
 assert.equal(typeof context.MissionPoiBriefingSharedBrowser.enrichSelected,'function');
 assert.equal(typeof context.MissionPoiBriefingBrowser.story,'function');
 assert.equal(context.MissionPoiBriefingSharedCore.prepareFlight({}).context.sharedWeatherObservation,false);
});
