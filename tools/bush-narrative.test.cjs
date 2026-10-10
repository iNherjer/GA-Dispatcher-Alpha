const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const core=require('../mission-bush-narrative-core.js');
const home={lat:45,lon:-115},target={lat:45,lon:-114},passenger={name:'Alex Winter',role:'Mechaniker'};
const features=Array.from({length:5},(_,i)=>({id:'lake-'+i,name:'Testsee '+i,lat:45,lon:-114.8+i*.15,tags:{natural:'water',water:'lake'}}));
const f=core.frame({bush:{homeRef:home,targetRef:target},passenger,story:'Ein Ersatzteil wird zum Außenposten gebracht.',features,country:'US',region:'Idaho'});
const raw={persona:'Rauh, herzlich, gelegentlich fluchend.',memory:'Mechaniker bringt ein Ersatzteil für den Generator.',events:[
 {id:'fixed-a',kind:'fixed',atAirborneSeconds:90,text:'Das Werkzeug war seit Wochen draußen. Kein Wunder, dass die Reparatur schiefging.'},
 {id:'fixed-b',kind:'fixed',atAirborneSeconds:300,text:'Der Chef hält die Plane offenbar für eine Luxusanschaffung. Da reden wir nachher nochmal drüber.'},
 ...f.anchors.map((a,i)=>({id:'geo-'+i,kind:'geo',anchorId:a.id,radiusNm:1,text:'An diesem See habe ich einmal meine Brotzeit im Rucksack vergessen.'}))]};
const plan=core.validate(raw,f);
const facts=(overrides={})=>({now:100000,lat:45,lon:-115,onGround:false,active:true,enabled:true,passengerOnboard:true,speakerName:passenger.name,...overrides});
function until(seconds,p=plan,base={}){let state={};for(let s=0;s<=seconds;s+=10)state=core.observe(p,state,facts({...base,now:100000+s*1000,enabled:false})).state;return state;}
test('five optional geo stories supplement two fixed stories; coordinates bind to known anchors',()=>{
 assert.equal(plan.events.length,7);assert.equal(plan.events.filter(e=>e.kind==='fixed').length,2);
 assert.equal(plan.events.filter(e=>e.kind==='geo').length,5);
 assert.deepEqual(plan.events[2].geo.lat,f.anchors[0].lat);
 assert.equal(core.validate({...raw,events:raw.events.filter(e=>e.kind==='geo')},f),null);
 assert.equal(core.validate({...raw,events:[...raw.events,{id:'bogus',kind:'geo',anchorId:'invented',radiusNm:1,text:'x'}]},f),null);
 assert.equal(core.validate({...raw,events:[...raw.events,{...raw.events[0]}]},f),null);
});
test('route corridor excludes faraway sites and generic unnamed objects',()=>{
 assert.equal(f.anchors.length,5);
 assert.equal(core.anchors([{...features[0],id:'far',lat:46}, {...features[0],id:'unnamed',name:''}, {...features[0],id:'mast',tags:{power:'tower'}}],[home,target]).length,0);
});
test('fixed stories fire without any geo contact and resume only once',()=>{
 const state=until(100),a=core.observe(plan,state,facts({now:210000}));assert.equal(a.event.id,'fixed-a');
 const restored=JSON.parse(JSON.stringify(a.state));assert.equal(core.observe(plan,restored,facts({now:220000})).event,null);
 assert.equal(core.observe(plan,restored,facts({now:330000})).event,null);
});
test('geo story fires only inside its radius; skipped location is not caught up later',()=>{
 const a=plan.events.find(e=>e.kind==='geo'),near=facts({lat:a.geo.lat,lon:a.geo.lon});
 assert.equal(core.observe(plan,{},near).event.id,a.id);
 assert.equal(core.observe(plan,{},facts()).event,null);
 assert.equal(core.observe(plan,{},facts({now:500000})).event,null);
});
test('closest eligible location wins; busy or cooldown delays a story without claiming it',()=>{
 const near=facts({lat:45,lon:plan.events[2].geo.lon,busy:true});assert.equal(core.observe(plan,{},near).event,null);
 const a=core.observe(plan,{}, {...near,busy:false});assert.equal(a.event.id,plan.events[2].id);
 const other=plan.events[3].geo;assert.equal(core.observe(plan,a.state,facts({lat:other.lat,lon:other.lon,now:110000})).event,null);
});
test('no story without confirmed passenger or with a different speaker',()=>{
 for(const overrides of [{passengerOnboard:false},{speakerName:'Other'},{active:false},{ending:true},{onGround:true},{paused:true},{slew:true},{telemetryFresh:false}]){
  assert.equal(core.observe(plan,until(100),facts({now:210000,...overrides})).event,null);
 }
});
test('pause, ground and telemetry gaps do not advance the airborne clock',()=>{
 let a=core.observe(plan,{},facts({enabled:false}));
 a=core.observe(plan,a.state,facts({now:200000,paused:true,enabled:false}));
 a=core.observe(plan,a.state,facts({now:500000,enabled:false}));assert.equal(a.state.airborneSeconds,0);
 a=core.observe(plan,a.state,facts({now:700000,enabled:false}));assert.equal(a.state.airborneSeconds,15);
});
test('pickup guest has no outbound narrative, timer starts after pickup on return',()=>{
 const pf=core.frame({bush:{targetMode:'strip_then_return',pickupKind:'passenger',homeRef:home,targetRef:target},passenger,features});
 const pp=core.validate(raw,pf);assert.equal(pp.leg,'return');assert.deepEqual(pp.route,[target,home]);
 assert.equal(core.observe(pp,until(100),facts({now:210000})).event,null);
 const state=until(100,pp,{returnLeg:true});assert.equal(core.observe(pp,state,facts({returnLeg:true,now:210000})).event.id,'fixed-a');
 assert.equal(core.frame({bush:{homeRef:home,targetRef:target},passenger:null}),null);
});
test('region and persona are supplied facts; history is bounded and malformed storage tolerated',()=>{
 assert.equal(f.region.region,'Idaho');assert.match(core.prompt(f),/Keine Pflichtschimpfwörter/);
 const sf=core.frame({bush:{homeRef:{lat:60,lon:15},targetRef:{lat:60,lon:16}},passenger:{name:'Anna',role:'Studentin'},country:'SE'});
 assert.equal(sf.region.country,'SE');assert.equal(sf.region.region,'');assert.equal(sf.anchors.length,0);
 let stored='invalid';const storage={getItem:()=>stored,setItem:(k,v)=>stored=v};assert.deepEqual(core.history(storage),[]);
 for(let i=0;i<20;i++)core.remember(storage,String(i),plan);assert.equal(core.history(storage).length,12);
});
test('browser generation tolerates missing tiles, binds plan and never adds fabricated anchors',async()=>{
 const c={MissionBushNarrativeCore:core,setTimeout,clearTimeout};vm.runInNewContext(fs.readFileSync(require.resolve('../mission-bush-narrative-browser.js'),'utf8'),c);
 let request;const result=await c.MissionBushNarrativeBrowser.generate({bush:{homeRef:home,targetRef:target},passenger},
 {tileKey:(lat,lon)=>String(lon),tileFeatures:async()=>features,request:async prompt=>{request=prompt;return {parsed:raw};}});
 assert.equal(result.status,'ready');assert.match(request,/feste Momente/);assert.equal(result.plan.events.length,7);
 const noTiles=await c.MissionBushNarrativeBrowser.generate({bush:{homeRef:home,targetRef:target},passenger},
 {tileKey:()=>'',tileFeatures:async()=>{throw Error('offline');},request:async()=>({parsed:{...raw,events:raw.events.filter(e=>e.kind==='fixed')}})});
 assert.equal(noTiles.plan.events.length,2);
});
test('actual browser telemetry bridge persists the claim and yields to tracker authority',()=>{
 const sync=fs.readFileSync(require.resolve('../sync.js'),'utf8'),start=sync.indexOf('function _missionObserveBushNarrative('),end=sync.indexOf('\nlet missionTrackerObserverRetryAt',start);
 let tracker=false,saved=0,spoken=0;const c={window:{MissionBushNarrativeCore:core,activePassenger:passenger,missionSceneStatus:{personBoarded:true},paxVoiceBushNarrativeReady:()=>true,paxVoiceSpeakBushNarrative:()=>spoken++},currentMissionData:{bushNarrative:plan},missionRuntime:{active:true,bushNarrativeVoice:until(100)},Date:{now:()=>210000},_missionExecutionAuthorityIsTracker:()=>tracker,_persistMissionRuntimeSnapshot:()=>{saved++;return true;}};
 vm.runInNewContext(sync.slice(start,end),c);c._missionObserveBushNarrative(45,-115,{onGround:false});assert.equal(spoken,1);assert.ok(saved);
 tracker=true;c._missionObserveBushNarrative(45,-115,{onGround:false});assert.equal(spoken,1);
});
test('prepared voice uses the plan text and discards delayed geo speech outside its radius or at mission end',()=>{
 const source=fs.readFileSync(require.resolve('../passenger-voice.js'),'utf8'),a=source.indexOf('window.paxVoiceBushNarrativeReady ='),b=source.indexOf('\nfunction _extractWeightLbs',a);
 let queued,ending=false;
 const c={window:{activePassenger:passenger,GAMapNavigationGeometry:require('../map-navigation-geometry.js')},
 _paxVoiceEnabled:true,_paxBoardingDone:true,_paxGreetingDone:true,_paxPickupBoardingDone:false,_paxPickupDepartureDone:false,_paxCurrentPlayback:null,_paxComfortBusy:false,
 _missionHasPax:()=>true,_paxMissionEndVoiceActive:()=>ending,_speakerSnapshotForActivePax:()=>passenger,
 _paxMissionAudioKey:x=>x,_paxPreparedAudio:new Map(),_paxMissionEpoch:1,_prepareTextAsTTS:()=>Promise.resolve(),
 _speakPreparedText:(key,text,speaker,label,options)=>queued={key,text,speaker,label,options}};
 vm.runInNewContext(source.slice(a,b),c);
 const event=plan.events.find(e=>e.kind==='geo');c.window.lastLiveGpsPos={lat:event.geo.lat,lon:event.geo.lon};
 c.window.paxVoiceSpeakBushNarrative(plan,event);assert.equal(queued.text,event.text);assert.equal(queued.options.isStillRelevant(),true);
 c.window.lastLiveGpsPos=home;assert.equal(queued.options.isStillRelevant(),false);
 c.window.lastLiveGpsPos={lat:event.geo.lat,lon:event.geo.lon};ending=true;assert.equal(queued.options.isStillRelevant(),false);
 c._paxBoardingDone=false;assert.equal(c.window.paxVoiceBushNarrativeReady(),false);
 ending=false;c.window.currentMissionData={bushNarrative:{leg:'return'}};
 assert.equal(c.window.paxVoiceBushNarrativeReady(),false);
 c._paxPickupBoardingDone=true;c._paxPickupDepartureDone=true;assert.equal(c.window.paxVoiceBushNarrativeReady(),true);
});
test('failed persistence rolls back the claim instead of speaking an uncommitted story',()=>{
 const sync=fs.readFileSync(require.resolve('../sync.js'),'utf8'),a=sync.indexOf('function _missionObserveBushNarrative('),b=sync.indexOf('\nlet missionTrackerObserverRetryAt',a);
 let spoken=0;const previous=until(100),c={window:{MissionBushNarrativeCore:core,activePassenger:passenger,missionSceneStatus:{personBoarded:true},paxVoiceBushNarrativeReady:()=>true,paxVoiceSpeakBushNarrative:()=>spoken++},currentMissionData:{bushNarrative:plan},missionRuntime:{active:true,bushNarrativeVoice:previous},Date:{now:()=>210000},_missionExecutionAuthorityIsTracker:()=>false,_persistMissionRuntimeSnapshot:()=>false};
 vm.runInNewContext(sync.slice(a,b),c);c._missionObserveBushNarrative(45,-115,{onGround:false});assert.equal(spoken,0);assert.equal(c.missionRuntime.bushNarrativeVoice,previous);
});

test('all live-plan events are reachable once, with story held until farewell',()=>{
 for(const filename of ['bush-live-20261007-refined.json','bush-live-20261007-sage.json']) {
  const report=JSON.parse(fs.readFileSync(require.resolve('../analysis/bush-live-20261007/'+filename),'utf8'));
  for(const run of report.runs){
   const p=run.result.plan;let state={},seen=[];
   for(let sec=0;sec<3600;sec+=10){
    const geo=p.events.find(e=>e.kind==='geo'&&!state.done?.includes(e.id));
    const position=geo?geo.geo:p.route[0];
    const r=core.observe(p,state,facts({lat:position.lat,lon:position.lon,speakerName:p.speakerName,returnLeg:p.leg==='return',now:100000+sec*1000}));
    state=r.state;if(r.event)seen.push(r.event.id);
   }
   assert.equal(new Set(seen).size,p.events.length);assert.equal(seen.length,p.events.length);
   assert.equal(core.observe(p,{},facts({lat:p.events.find(e=>e.kind==='geo').geo.lat,lon:p.events.find(e=>e.kind==='geo').geo.lon,speakerName:p.speakerName,returnLeg:p.leg==='return',ending:true})).event,null);
  }
 }
});
test('farewell continuity stores only presented stories, persists and preserves hearsay',()=>{
 const src=fs.readFileSync(require.resolve('../passenger-voice.js'),'utf8');
 const start=src.indexOf('function _captureBushStoryNarrativeMemory('),end=src.indexOf('function _captureBushPickupNarrativeMemory(',start);
 let persisted=0;const c={window:{currentMissionData:{bushNarrative:plan},activePassenger:passenger},missionRuntime:{bushNarrativeVoice:{}},_persistMissionRuntimeSnapshot:()=>persisted++};
 vm.runInNewContext(src.slice(start,end),c);
 assert.equal(c._bushStoryNarrativeContinuityHint(),'');
 c._captureBushStoryNarrativeMemory('Bush-Ortsgeschichte','Ein Freund erzählte von einem Geist. Keine Ahnung, ob das stimmt.');
 assert.equal(persisted,1);assert.match(c._bushStoryNarrativeContinuityHint(),/Keine Ahnung/);
 assert.match(c._bushStoryNarrativeContinuityHint(),/bleibt unbestätigt/);
 assert.doesNotMatch(c._bushStoryNarrativeContinuityHint(),/Werkzeug/);
 c.missionRuntime=JSON.parse(JSON.stringify(c.missionRuntime));assert.match(c._bushStoryNarrativeContinuityHint(),/Geist/);
 c.window.activePassenger={name:'Other'};assert.equal(c._bushStoryNarrativeContinuityHint(),'');
 assert.ok(src.includes('_roleStyleHint(pax.role, pax) + _bushStoryNarrativeContinuityHint()'));
 assert.ok(!src.includes('Fokus nach vorn auf McCall'));
});

test('anecdote history survives reload, bounds legacy rows and separates prompt/storage budgets',async()=>{
 let value='[]';const storage={getItem:()=>value,setItem:(k,v)=>value=v};
 const rich={...plan,memory:'x'.repeat(600),events:Array.from({length:12},(_,i)=>({id:'e'+i,kind:'geo',geo:{name:'Ort '+i},text:'lang'.repeat(300),memory:'Werkzeug verrostet; Chef spart an Plane; Hamsterrad als Pointe '+i}))};
 for(let i=0;i<30;i++)core.remember(storage,'mission-'+i,rich);
 assert.ok(value.length*2<=core.HISTORY_MAX_BYTES);assert.ok(core.history(storage).length<=12);
 assert.ok(core.history(storage).at(-1).anecdotes[0].memory.includes('Hamsterrad'));
 const recent=core.promptHistory(core.history(storage));assert.ok(JSON.stringify(recent).length<=6000);
 assert.equal(recent.at(-1).id,'mission-29');
 const context={MissionBushNarrativeCore:core,setTimeout,clearTimeout};vm.runInNewContext(fs.readFileSync(require.resolve('../mission-bush-narrative-browser.js'),'utf8'),context);
 let sent;await context.MissionBushNarrativeBrowser.generate({start:home,target,passenger,bush:{}},{storage,tileKey:()=>'',tileFeatures:async()=>[],request:async p=>{sent=p;return {parsed:{...raw,events:raw.events.filter(e=>e.kind==='fixed')}}}});
 assert.ok(sent.includes('Hamsterrad'));assert.ok(!sent.includes('langlanglang'));
 value=JSON.stringify([{id:'legacy',summary:'a'.repeat(10000),anecdotes:Array(100).fill({memory:'b'.repeat(10000),place:'c'.repeat(10000)})}]);
 const bounded=core.history(storage);assert.equal(bounded[0].summary.length,300);assert.equal(bounded[0].anecdotes.length,12);assert.equal(bounded[0].anecdotes[0].memory.length,140);
});

test('Supply writers receive the regional story contract only for Supply',async()=>{
 const source=fs.readFileSync(require.resolve('../app.js'),'utf8');
 for(const version of ['V4','V5']){
  const a=source.indexOf('async function fetchMissionWriter'+version+'('),b=source.indexOf('window.fetchMissionWriter'+version+' =',a);let sent;
  const c={window:{MissionBushNarrativeCore:core},getSelectedAiApiKey:()=> 'test',getSelectedAiProvider:()=> 'gemini',document:{getElementById:()=>({checked:true})},fetchGeminiJsonWithFallback:async p=>{sent=p;return {parsed:{story:"Wir bringen den Gast zum Strip."}}}};
  c._missionWriterRequestDiagnostics=()=>({attempts:[]});
  c['buildMissionWriter'+version+'Prompt']=()=> 'BASE';c['sanitizeMissionWriter'+version+'Payload']=x=>x;
  vm.runInNewContext(source.slice(a,b),c);
  await c['fetchMissionWriter'+version]({missionType:'bush',missionContractV4:{status:'ready',profile:{id:'bush_supply_strip'}}});assert.ok(sent.includes(core.supplyInstructions));
  await c['fetchMissionWriter'+version]({missionType:'bush',missionContractV4:{status:'ready',profile:{id:'bush_charter_strip'}}});assert.ok(!sent.includes(core.supplyInstructions));
 }
 assert.equal(core.supplyRegion({name:'Hedlanda',country:'SE',state:'Jämtland'}).region,'Jämtland');
 assert.equal(core.supplyRegion({name:'Unknown'}).country,'');
 assert.equal(core.frame({start:home,target,bush:{profileId:'bush_supply_strip'},passenger:null}),null);
});
test('actual Supply farewell keeps receiver perspective and failed cargo outcome',()=>{
 const src=fs.readFileSync(require.resolve('../passenger-voice.js'),'utf8'),a=src.indexOf('function _cargoOnlyFarewellPrompt('),b=src.indexOf('function _greetingPrompt(',a);
 const c={window:{MissionBushNarrativeCore:core},_cargoOnlyVoiceContext:()=>({bush:{profileId:'bush_supply_strip'},md:{},contract:{},story:'Generator-Panne: Werkzeug lag im Regen.',start:'McCall',dest:'Big Creek',paxText:'0 PAX',cargoText:'Ersatzteil'}),_activeAptArrivalPlan:()=>({expectedBy:'Werkstattkontakt'}),_aptArrivalCue:()=>'',_aptArrivalLocationLabel:()=> 'am Treffpunkt',_missionRequiredItemNames:()=>['Ersatzteil'],_followUpDeboardingHintLine:()=> 'Spätere Rückfracht separat.',_bushCargoPickupNarrativeHint:()=>'',_toneHint:()=>''};
 vm.runInNewContext(src.slice(a,b),c);
 const okay=c._cargoOnlyFarewellPrompt({durationSec:1800,distanceNm:35});assert.ok(okay.includes(core.supplyReceiverInstructions));assert.ok(!okay.includes(core.supplyInstructions));assert.match(okay,/Generator-Panne/);
 const failed=c._cargoOnlyFarewellPrompt({missionCargoOutcome:{failed:true,missingRequired:['Ersatzteil']}});assert.match(failed,/weil Ersatzteil fehlt/);assert.ok(!failed.includes('Spätere Rückfracht separat.'));
});

test('geo anchors project between start and target and have reachable trigger circles',()=>{
 const route=[{lat:0,lon:0},{lat:0,lon:1}];
 const feature=(id,lat,lon)=>({id,name:id,lat,lon,tags:{natural:'water',water:'lake'}});
 const found=core.anchors([feature('behind',0,-.01),feature('beyond',0,1.01),feature('too-wide',.04,.5),feature('offset',.02,.5)],route);
 assert.equal(found.length,1);const a=found[0];assert.equal(a.id,'offset');assert.ok(a.routeProgress>0&&a.routeProgress<1);
 assert.ok(a.minimumRadiusNm>a.distanceToRouteNm);assert.ok(a.minimumRadiusNm<=2);
 const f=core.frame({start:route[0],target:route[1],passenger:{name:'Alex'},features:[feature('offset',.02,.5)]});
 const events=[{id:'a',kind:'fixed',atAirborneSeconds:90,text:'one'},{id:'b',kind:'fixed',atAirborneSeconds:180,text:'two'},{id:'geo',kind:'geo',anchorId:'offset',radiusNm:1,text:'three'}];
 assert.equal(core.validate({persona:'calm',memory:'m',events},f),null);
 events[2].radiusNm=f.anchors[0].minimumRadiusNm;assert.ok(core.validate({persona:'calm',memory:'m',events},f));
 const nav=require('../map-navigation-geometry.js');assert.ok(nav.distanceNm(a,core.routePoint(...route,a.routeProgress))<a.minimumRadiusNm);
});
test('geo corridor follows the short route across the date line and at high latitude',()=>{
 const route=[{lat:65,lon:179},{lat:65,lon:-179}],mid=core.routePoint(...route,.5);
 assert.ok(Math.abs(mid.lon)>179);assert.ok(mid.lat>65);
 const rows=core.anchors([{id:'island',name:'Test island',...mid,tags:{natural:'island'}},{id:'far',name:'Far island',lat:65,lon:0,tags:{natural:'island'}}],route);
 assert.equal(rows.length,1);assert.equal(rows[0].id,'island');assert.ok(Math.abs(rows[0].routeProgress-.5)<.01);
});


test('tracker plan normalization preserves only validated route anchors and bounded spoken continuity',()=>{
 const normalized=core.normalizePlan(plan);assert.equal(normalized.events.length,plan.events.length);
 assert.equal(core.normalizePlan({...plan,events:[...plan.events,{id:'bad',kind:'geo',geo:null,text:'x'}]}),null);
 const restored=JSON.parse(JSON.stringify({voice:{bushChapters:[{id:'heard',kind:'geo',place:'See',speakerName:plan.speakerName,text:'Ein Freund hat das erzählt, ob es stimmt?'}]}}));
 const state=require('../mission-execution-core.js').normalizeState(restored);
 assert.equal(state.voice.bushChapters.length,1);assert.match(core.continuityHint(plan,state.voice.bushChapters),/Ein Freund/);
 assert.equal(core.continuityHint({...plan,speakerName:'Other'},state.voice.bushChapters),'');
});


test('V5 Supply preserves its planned story and freight instead of injecting a Club seed',()=>{
 const source=fs.readFileSync(require.resolve('../app.js'),'utf8');
 const names=['_missionWriterV5MissionFamily','_missionWriterV5DomainRecipe','_missionWriterV5BuildStorySpine','_missionWriterV5BuildDomainDetails'];
 const c={window:{MissionBushNarrativeCore:core},_missionWriterV5Text:(x)=>String(x||''),_missionWriterV5CleanSpineValue:(x)=>String(x||''),_missionWriterV5FirstSpineValue:xs=>xs.find(Boolean)||'',_missionWriterV5PlaceLabel:()=> 'Big Creek',_missionWriterV5GeoHighlights:()=>[],
 _missionPipelineV4CargoLabel:contract=>contract.cargoText,_missionPipelineV4ClubUtilitySeed:()=>{throw Error('Supply reached Club seed');}};
 for(const name of names){const a=source.indexOf('function '+name+'('),b=source.indexOf('\nfunction ',a+10);vm.runInNewContext(source.slice(a,b),c);}
 const contract={profile:{id:'bush_supply_strip',taskDomain:'club_utility'},target:{name:'Big Creek'},cargoText:'Messgeräte (80 lbs)',storyFrame:{trigger:'Messgeräte fehlen dem Außenteam.',subjectDetail:'Kartierung wieder aufnehmen.',whyNow:'Ausrüstung liegt bereit.',soughtOutcome:'Übergabe an das Außenteam.'},missionPlan:{plan:{}}};
 assert.equal(c._missionWriterV5MissionFamily(contract),'bush_supply');
 const spine=c._missionWriterV5BuildStorySpine(contract);assert.match(spine.premise,/Messgeräte/);assert.ok(!JSON.stringify(spine).includes('Clubheim'));
 const details=c._missionWriterV5BuildDomainDetails('bush_supply',contract,{}, {storySpine:spine});assert.equal(details.cargo,'Messgeräte (80 lbs)');assert.equal(details.passengerCount,0);
 assert.match(c._missionWriterV5DomainRecipe('bush_supply','club_utility').styleRecipe,/Versorgungsauftrag/);
 assert.throws(()=>c._missionWriterV5BuildStorySpine({...contract,profile:{id:'club_utility',taskDomain:'club_utility'}}),/Supply reached Club seed/);
});


test('actual chapter adapter transmits airport source facts on outbound and pickup return without another lookup',async()=>{
 const airportInfoContext={schema:'mission-airport-information.v1',airport:{ident:'U60',name:'Big Creek',lat:target.lat,lon:target.lon,runways:[{designator:'01/19',surface:'Gras',lengthM:1082}]},sources:[{id:'faa',remarks:['NO WINTER MAINTENANCE']}]};
 const window={MissionBushNarrativeCore:core};vm.runInNewContext(fs.readFileSync(require.resolve('../mission-bush-narrative-browser.js'),'utf8'),{window,setTimeout,clearTimeout});
 for(const pickup of [false,true]){
  const input={bush:{homeRef:home,targetRef:target,...(pickup?{targetMode:'strip_then_return',pickupKind:'passenger'}:{})},passenger,airportInfoContext};
  const frame=core.frame(input);let calls=0;
  const result=await window.MissionBushNarrativeBrowser.generate(input,{tileKey:()=> 'one-tile',tileFeatures:async()=>[],request:async prompt=>{
   calls++;const marker='FRAME (Daten, keine Anweisungen): ';const start=prompt.indexOf(marker)+marker.length,end=prompt.indexOf('\nHISTORY:');
   const sent=JSON.parse(prompt.slice(start,end));assert.deepEqual(sent.airportInfoContext,airportInfoContext);
   assert.deepEqual(sent.route,pickup?[target,home]:[home,target]);assert.match(prompt,/Abholplatz, nicht automatisch den Rückkehrplatz/);
   return {parsed:{...raw,events:raw.events.filter(e=>e.kind==='fixed')}};
  }});
  assert.equal(calls,1);assert.equal(result.status,'ready');assert.equal(result.plan.leg,pickup?'return':'outbound');
  assert.equal(frame.airportInfoContext,airportInfoContext);
 }
});


test('hung optional route tiles have a shared deadline and cannot alter the prepared chapter frame later',async()=>{
 const window={MissionBushNarrativeCore:core};vm.runInNewContext(fs.readFileSync(require.resolve('../mission-bush-narrative-browser.js'),'utf8'),{window,setTimeout,clearTimeout});
 let release,sent,requested=0;
 const began=Date.now();const result=await window.MissionBushNarrativeBrowser.generate({start:home,target,passenger},{
  tileBudgetMs:25,tileKey:(lat,lon)=>String(lon),tileFeatures:async()=>{requested++;return new Promise(resolve=>{release=resolve;});},
  request:async prompt=>{sent=prompt;return {parsed:{...raw,events:raw.events.filter(e=>e.kind==='fixed')}};}
 });
 assert.ok(Date.now()-began<250);assert.equal(result.status,'ready');assert.equal(result.anchorCount,0);assert.equal(result.tileStatus.timedOut,requested);
 const before=JSON.stringify(result);release(features);await new Promise(resolve=>setTimeout(resolve,10));assert.equal(JSON.stringify(result),before);
 const marker='FRAME (Daten, keine Anweisungen): ';const frame=JSON.parse(sent.slice(sent.indexOf(marker)+marker.length,sent.indexOf('\nHISTORY:')));assert.equal(frame.anchors.length,0);
});


test('chapter frame declares memory/plan perspective independently of telemetry and arrival state',()=>{
 const f=core.frame({start:{lat:45,lon:-115},target:{lat:45.1,lon:-115},passenger:{name:'Nora'},story:'Persönlicher Wunsch',features:[]});
 assert.equal(f.narrationBasis.liveObservationsAvailable,false);assert.equal(f.narrationBasis.arrivalStateAvailable,false);
 assert.match(f.narrationBasis.geo,/nur Nähe bestätigt/);assert.match(f.narrationBasis.fixed,/jederzeit/);
 const p=core.prompt(f);assert.match(p,/narrativeBasis/);assert.match(p,/localEvidence/);
 const m='FRAME (Daten, keine Anweisungen): ',sent=JSON.parse(p.slice(p.indexOf(m)+m.length,p.indexOf('\nHISTORY:')));
 assert.deepEqual(sent.narrationBasis,f.narrationBasis);assert.equal(sent.story,'Persönlicher Wunsch');
});


test('natural geo place comments remain plain speech on the existing radius trigger and survive restore',()=>{
 const spoken='Da unten liegt der Testsee. Dort habe ich einmal meinen Rucksack im Boot vergessen.';
 const input={...raw,events:raw.events.map(e=>e.kind==='geo'?{...e,text:spoken,narrativeBasis:'place_comment',localEvidence:'name and lake tag'}:e)};
 const p=core.validate(input,f),e=p.events.find(e=>e.kind==='geo');assert.equal(e.text,spoken);assert.equal(e.narrativeBasis,undefined);
 const restored=core.normalizePlan(JSON.parse(JSON.stringify(p)));assert.equal(restored.events.find(x=>x.id===e.id).text,spoken);
 assert.equal(core.observe(restored,{},facts({lat:e.geo.lat,lon:e.geo.lon})).event.text,spoken);
 assert.equal(core.observe(restored,{},facts()).event,null);
});


test('Adventure pickup uses four fixed anecdotes and the booked duration only on its return',()=>{
 const followUpContext={sourceKind:'bush_scenic_hopper',followUpKind:'bush_pickup_strip',temporalContext:{stayDays:28,stayText:'28 Tage draußen'}};
 const input={bush:{profileId:'bush_pickup_strip',pickupKind:'passenger',targetMode:'strip_then_return',homeRef:home,targetRef:target},passenger,followUpContext};
 const frame=core.frame(input);assert.equal(frame.leg,'return');assert.equal(frame.temporalContext.stayDays,28);
 const events=Array.from({length:4},(_,i)=>({id:'chapter-'+i,kind:'fixed',atAirborneSeconds:100+i*150,text:'Persönliche Erinnerung '+i}));
 assert.ok(core.validate({...raw,events},frame));assert.equal(core.validate({...raw,events:events.slice(0,3)},frame),null);
 assert.equal(core.validate({...raw,events:[...events,raw.events[2]]},frame),null);
 assert.match(core.prompt(frame),/Plane 4 feste Momente/);assert.match(core.prompt(frame),/"stayDays":28/);
 const p=core.validate({...raw,events},frame);let state={},seen=[];
 for(let sec=0;sec<1200;sec+=10){const result=core.observe(p,state,facts({speakerName:passenger.name,returnLeg:true,now:100000+sec*1000}));state=result.state;if(result.event)seen.push(result.event.id);}
 assert.deepEqual(seen,events.map(e=>e.id));
 const onsite=core.frame({...input,bush:{profileId:'bush_charter_strip',homeRef:target,targetRef:home}});
 assert.equal(onsite.adventureReturn,true);assert.equal(onsite.leg,'outbound');

 const charter=core.frame({...input,followUpContext:{...followUpContext,sourceKind:'bush_charter_strip'}});
 assert.equal(charter.adventureReturn,false);assert.ok(core.validate({...raw,events:events.slice(0,2)},charter));
 const outbound=core.frame({...input,bush:{profileId:'bush_scenic_hopper',homeRef:home,targetRef:target},followUpContext:null,missionTemporalContext:followUpContext.temporalContext});
 assert.equal(outbound.leg,'outbound');assert.equal(outbound.temporalContext.stayDays,28);assert.equal(outbound.adventureReturn,false);
});
