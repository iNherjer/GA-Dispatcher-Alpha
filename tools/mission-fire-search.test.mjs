import {test} from 'node:test';
import assert from 'node:assert/strict';
import fire from '../mission-fire-watch-core.js';
import voices from '../ga-tracker-client/tracker-mission-fire-voice.js';
const make=(truth='fire')=>({scenario:{enabled:true,type:'fire_watch',truth,state:'enroute',target:{lat:48,lon:8,name:'Gebiet'},targetAreaNm:1.5,searchDwellSec:180,assessmentDwellSec:240,smoke:{sites:truth==='fire'?[{lat:48.006,lon:7.995,siteId:'source'}]:[]},search:{schema:'fire-search.v2',thermalCamera:true,thermalAfterSec:45,hintAfterSec:75}},passenger:{targetRadiusNm:1.5},runtimeActive:true});
const sample={lat:48,lon:8,distNm:0,heading:90,mslFt:4000};
test('search awareness is neutral; camera and later suspected vector persist without auto-confirming a fire',()=>{
 const c=make();c.scenario.search.sceneMode='thermal_only';const first=fire.observe(c,fire.createState(c),sample,10000);assert.ok(first.voices.every(v=>!v.text.includes('da vorn ist etwas')));
 const thermal=fire.observe(c,first.state,sample,60000);assert.ok(thermal.voices.some(v=>v.label==='Wärmebild-Suche'));
 const hint=fire.observe(c,JSON.parse(JSON.stringify(thermal.state)),sample,100000);const v=hint.voices.find(v=>v.label==='Wärmestelle erkannt');assert.match(v.text,/nordwestlich des Suchgebietsmittelpunkts/);assert.match(v.text,/noch keinen gesicherten Brand/);assert.equal(hint.state.scenario.search.confirmationKind,'thermal');assert.equal(hint.state.satisfied,false);
 const restored=fire.observe(c,JSON.parse(JSON.stringify(hint.state)),{...sample,lat:48.001},150000);assert.equal(restored.voices.length,0);
});
test('false alarm never gets a fake thermal target and old centre confirmation no longer confirms a distant source',()=>{
 const c=make('false_alarm'),entry=fire.observe(c,fire.createState(c),sample,10000),next=fire.observe(c,entry.state,sample,100000),later=fire.observe(c,next.state,sample,140000);assert.ok([...next.voices,...later.voices].every(v=>v.label!=='Wärmestelle erkannt'));
 const real=make();real.scenario.smoke.sites=[{lat:48.02,lon:8}];const report=fire.action(real,fire.createState(real),'fire_smoke_visible',sample,20000);assert.equal(report.state.scenario.state,'reported_smoke_unconfirmed');
});
test('search vectors skip text generation and carry a finite playback deadline',()=>{
 const [v]=voices.prepareFireVoices({missionId:'m',audioEnabled:true},[{label:'Suchhinweis',text:'Verdacht nordwestlich der Gebietsmarkierung.'}],10000);assert.equal(v.resolvedRecipe.prompt,'');assert.equal(v.fireSearchHint,true);assert.equal(v.expiresAt,40000);
});

test('manual camera finding stays a thermal suspicion through observation and return',()=>{
 const c=make();c.scenario.search.sceneMode='thermal_only';const initial=fire.observe(c,fire.createState(c),sample,10000);
 const camera=fire.observe(c,initial.state,sample,60000);
 const hint=fire.observe(c,camera.state,sample,100000);
 const confirmed=fire.action(c,hint.state,'fire_smoke_visible',sample,110000);
 assert.equal(confirmed.state.scenario.search.confirmationKind,'thermal');
 assert.equal(confirmed.state.scenario.state,'smoke_confirmed');
 assert.match(confirmed.voices.map(v=>v.text).join(' '),/Wärmeverdacht/);
 assert.ok(confirmed.voices.every(v=>!v.text.includes('Rauchentwicklung')));
 const completed=fire.observe(c,JSON.parse(JSON.stringify(confirmed.state)),sample,360000);
 assert.equal(completed.state.scenario.state,'assessment_complete');
 assert.ok(completed.voices.every(v=>!v.text.includes('Rauchentwicklung')));
});

test('thermal-only never confirms an invented smoke report before camera localization',()=>{
 const c=make();c.scenario.search.sceneMode='thermal_only';
 const early=fire.action(c,fire.createState(c),'fire_smoke_visible',sample,10000);
 assert.notEqual(early.state.scenario.state,'smoke_confirmed');assert.match(early.voices[0].text,/keine belastbare Wärmestelle/);
 const entry=fire.observe(c,early.state,sample,20000),camera=fire.observe(c,entry.state,sample,70000),hint=fire.observe(c,camera.state,sample,110000);
 const check=fire.action(c,JSON.parse(JSON.stringify(hint.state)),'fire_smoke_visible',sample,120000);
 assert.equal(check.state.scenario.search.confirmationKind,'thermal');
 assert.equal(check.state.scenario.state,'smoke_confirmed');
});

test('observer identifies nearest smoke first and reveals only observed locations across restore',()=>{
 const c=make();c.scenario.smoke.sites=[{siteId:'far',lat:48.008,lon:8},{siteId:'near',lat:48.001,lon:8}];
 let result=fire.observe(c,fire.createState(c),sample,10000);
 result=fire.observe(c,result.state,sample,31000);
 assert.equal(result.state.scenario.search.findings.length,1);
 assert.equal(result.state.scenario.search.findings[0].id,'near');
 assert.equal(result.state.scenario.search.confirmationKind,'smoke');
 assert.equal(result.state.scenario.state,'smoke_confirmed');
 assert.match(result.voices[0].text,/Kreuz/);
 result=fire.observe(c,JSON.parse(JSON.stringify(result.state)),sample,32000);
 result=fire.observe(c,result.state,sample,54000);
 assert.deepEqual(result.state.scenario.search.findings.map(p=>p.id),['near','far']);
 assert.equal(result.state.satisfied,false);
 result=fire.observe(c,result.state,sample,300000);
 assert.equal(result.state.scenario.state,'assessment_complete');
 assert.match(result.voices.map(v=>v.text).join(' '),/2 erkannte Stellen/);
});
test('time outside search area does not complete false alarm or confirmed assessment',()=>{
 const outside={...sample,lat:49};
 const c=make('false_alarm');let result=fire.observe(c,fire.createState(c),sample,10000);
 result=fire.action(c,result.state,'fire_no_smoke',sample,20000);
 result=fire.observe(c,result.state,outside,30000);
 result=fire.observe(c,result.state,outside,900000);
 result=fire.observe(c,result.state,sample,910000);
 assert.equal(result.state.satisfied,false);assert.equal(result.state.scenario.search.observedSec,10);
 result=fire.observe(c,result.state,sample,1080000);assert.equal(result.state.satisfied,true);
 const positive=make();let report=fire.action(positive,fire.createState(positive),'fire_smoke_visible',sample,10000);
 report=fire.observe(positive,report.state,outside,30000);
 report=fire.observe(positive,report.state,outside,900000);
 report=fire.observe(positive,report.state,sample,910000);
 assert.equal(report.state.satisfied,false);assert.equal(report.state.scenario.search.assessmentSec||0,0);
 report=fire.observe(positive,report.state,sample,1160000);assert.equal(report.state.satisfied,true);
});
test('visible smoke stays smoke even after camera suspicion',()=>{
 const c=make();let initial=fire.createState(c);initial.scenario.search.hintDone=true;initial.scenario.search.hintSourceId='source';
 const result=fire.action(c,initial,'fire_smoke_visible',sample,10000);
 assert.equal(result.state.scenario.search.confirmationKind,'smoke');
 assert.equal(result.state.scenario.search.findings[0].kind,'smoke');
});

test('independent smoke clocks speed up nearby and survive checkpoint restoration',()=>{
 const c=make();c.scenario.smoke.sites=[{siteId:'far',lat:48.009,lon:8},{siteId:'near',lat:48.001,lon:8}];
 let r=fire.observe(c,fire.createState(c),sample,10000);
 r=fire.observe(c,JSON.parse(JSON.stringify(r.state)),sample,15000);
 assert.deepEqual(r.state.scenario.search.findings.map(p=>p.id),['near']);
 const timers=r.state.scenario.search.sourceTimers;
 assert.ok(timers.near.smokeSec>20);assert.ok(timers.far.smokeSec>0 && timers.far.smokeSec<10);
 r=fire.observe(c,r.state,{...sample,lat:49},16000);
 const paused=r.state.scenario.search.sourceTimers.far.smokeSec;
 r=fire.observe(c,JSON.parse(JSON.stringify(r.state)),{...sample,lat:49},100000);
 r=fire.observe(c,r.state,sample,101000);
 assert.equal(r.state.scenario.search.sourceTimers.far.smokeSec,paused);
});
test('camera heat clocks accelerate individually without revealing the other sources',()=>{
 const c=make();c.scenario.search.sceneMode='thermal_only';c.scenario.smoke.sites=[{siteId:'far',lat:48.018,lon:8},{siteId:'near',lat:48.001,lon:8}];
 let r=fire.observe(c,fire.createState(c),sample,10000);
 r=fire.observe(c,r.state,sample,56000);assert.equal(r.state.scenario.search.thermalChecked,true);
 r=fire.observe(c,JSON.parse(JSON.stringify(r.state)),sample,62000);
 assert.deepEqual(r.state.scenario.search.findings.map(p=>p.id),['near']);
 assert.equal(r.state.scenario.search.findings[0].kind,'heat_suspicion');
 assert.ok(r.state.scenario.search.sourceTimers.far.heatSec<10);
 assert.equal(r.state.scenario.search.confirmationKind,'thermal');assert.equal(r.state.satisfied,false);
});

test('completion matrix: all observed, partial, none, heat and smoke; no hidden-count leak before landing',()=>{
 for(const mode of ['smoke','thermal_only']) for(const count of [1,3]) for(const found of [0,1,count]) {
  const c=make();c.scenario.search.sceneMode=mode;c.scenario.smoke.sites=Array.from({length:count},(_,i)=>({siteId:'s'+i,lat:48.01+i*.001,lon:8}));
  const state=fire.createState(c);const fs=state.scenario;fs.state=found?'smoke_confirmed':'searching';fs.smokeConfirmedAt=found?10000:null;
  fs.search.confirmationKind=mode==='thermal_only'?'thermal':'smoke';
  fs.search.findings=fs.smoke.sites.slice(0,found).map(p=>({id:p.siteId,lat:p.lat,lon:p.lon,kind:mode==='thermal_only'?'heat_suspicion':'smoke'}));
  fs.search.observedSec=180;fs.search.assessmentSec=240;
  const early=fire.observe(c,state,{...sample,lat:47.99},10000);
  assert.equal(early.state.satisfied,found===count,`${mode}/${count}/${found}`);
  if(found<count){
   early.state.scenario.search.observedSec=600;
   const complete=fire.observe(c,early.state,{...sample,lat:47.99},11000);
   assert.equal(complete.state.satisfied,true);
   const summary=fire.completionSummary(complete.state.scenario);
   assert.equal(summary.groundAdditional,count-found);assert.equal(summary.outcome,found?'partial':'unconfirmed');
   const text=complete.voices.map(v=>v.text).join(' ');
   assert.ok(!text.includes('Bodenkräfte'));assert.ok(!text.includes(`${count-found} weitere`));
  }
 }
});
test('first finding never ends search and every source gets its own persisted voice confirmation',()=>{
 const c=make();c.scenario.smoke.sites=[{siteId:'a',lat:48.001,lon:8},{siteId:'b',lat:48.002,lon:8}];
 let r=fire.observe(c,fire.createState(c),sample,10000);
 r=fire.observe(c,r.state,sample,16000);
 assert.equal(r.state.satisfied,false);assert.match(r.voices[0].text,/Einzelbefund/);assert.ok(!r.voices[0].text.includes('freigegeben'));
 const first=r.voices[0].text;
 r=fire.observe(c,JSON.parse(JSON.stringify(r.state)),sample,17000);
 assert.match(r.voices[0].text,/Rauchquelle 2/);assert.notEqual(r.voices[0].text,first);
 r=fire.observe(c,JSON.parse(JSON.stringify(r.state)),sample,18000);assert.equal(r.voices.length,0);
});

test('landing voice reports additional ground findings precisely without AI text generation',async()=>{
 const {default:poiVoice}=await import('../mission-poi-voice-core.js');
 const context={schema:poiVoice.CONTEXT_SCHEMA,version:1,missionId:'fire-landing',taskDomain:'fire_watch',strict:true,audioEnabled:true,baseContext:'Beobachter im Einsatz.',passenger:{name:'Mia',role:'Beobachterin'},speaker:{name:'Mia'}};
 for (const mode of ['smoke','thermal_only']) {
  const c=make();c.scenario.search.sceneMode=mode;c.scenario.smoke.sites=[{siteId:'a',lat:48,lon:8},{siteId:'b',lat:48.01,lon:8}];
  c.scenario.search.findings=[{id:'a',lat:48,lon:8,kind:mode==='smoke'?'smoke':'heat_suspicion'}];c.scenario.assessmentComplete=true;
  const summary=fire.completionSummary(c.scenario);
  const rendered=poiVoice.renderFarewell(context,{record:{fireWatchSummary:summary},liveWeather:{onGround:true}},{});
  assert.equal(rendered.prompt,'');assert.match(rendered.text,/Bodenkräfte/);assert.match(rendered.text,/1 weitere/);
  assert.match(rendered.text,mode==='smoke'?/Rauchquelle/:/Wärmestelle/);
  const early=poiVoice.renderFarewell(context,{record:{},liveWeather:{onGround:false}},{});
  assert.ok(!`${early.prompt} ${early.text}`.includes('Bodenkräfte'));
 }
});

test('false alarm requires a no-smoke report from the searched area, not an enroute report',()=>{
 const c=make('false_alarm');let r=fire.action(c,fire.createState(c),'fire_no_smoke',{...sample,lat:49},10000);
 r=fire.observe(c,r.state,sample,20000);r=fire.observe(c,r.state,sample,220000);
 assert.equal(r.state.satisfied,false);
 r=fire.action(c,r.state,'fire_no_smoke',sample,221000);assert.equal(r.state.satisfied,true);
 assert.equal(fire.completionSummary(r.state.scenario).groundAdditional,0);
});

test('completed smoke, thermal and false alarm branches cannot reopen search through repeated pilot reports',()=>{
 for(const truth of ['fire','false_alarm']) for(const mode of ['smoke','thermal_only']) {
  const c=make(truth);c.scenario.search.sceneMode=mode;
  const state=fire.createState(c);state.scenario.state=truth==='fire'?'assessment_complete':'false_alarm_rtb';state.scenario.assessmentComplete=true;state.satisfied=true;
  for(const action of ['fire_smoke_visible','fire_no_smoke','fire_position']) {
   const r=fire.action(c,JSON.parse(JSON.stringify(state)),action,sample,10000);
   assert.equal(r.state.satisfied,true);assert.equal(r.state.scenario.state,state.scenario.state);
   assert.ok(!r.voices.map(v=>v.text).join(' ').includes('Halte den Orbit'));
  }
 }
});
