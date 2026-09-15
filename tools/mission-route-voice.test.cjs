const {test}=require('node:test');const assert=require('node:assert/strict');
const core=require('../mission-route-voice-core.js');
const route=[{lat:48,lon:8},{lat:49,lon:8}];
const plan=[{atPercent:20,intent:'A'},{atPercent:50,intent:'B'},{atPercent:80,intent:'C'}];
const facts={now:100000,lat:48.3,lon:8,onGround:false,active:true,enabled:true};
test('optional bounded events reject malformed triggers',()=>{
 assert.deepEqual(core.events(undefined),[]);assert.deepEqual(core.events([]),[]);
 for(const p of [[{atPercent:0,intent:'x'}],[{atPercent:100,intent:'x'}],[{atPercent:'70',intent:'x'}],[...plan,plan[0]],[{atPercent:30,intent:''}]])assert.equal(core.events(p),null);
});
test('progress follows route legs; durable IDs, pause, queue and end gates',()=>{
 let out=core.observe(plan,route,{},facts);assert.equal(out.event.id,'route-story-0');
 assert.equal(core.observe(plan,route,JSON.parse(JSON.stringify(out.state)),facts).event,null);
 for(const gate of [{onGround:true},{paused:true},{slew:true},{ending:true},{active:false},{busy:true},{enabled:false},{lat:NaN}])assert.equal(core.observe(plan,route,{}, {...facts,...gate}).event,null);
 out=core.observe(plan,route,out.state,{...facts,lat:48.9,now:150000});assert.equal(out.event.intent,'B');
 assert.equal(core.observe(plan,route,out.state,{...facts,lat:48.9,now:151000}).event,null);
 out=core.observe(plan,route,out.state,{...facts,lat:48.9,now:200000});assert.equal(out.event.intent,'C');
 assert.equal(core.observe(plan,route,out.state,{...facts,lat:48.9,now:300000}).event,null);
});
test('route edits recalculate pending progress without clearing claimed events',()=>{
 const state=core.observe(plan,route,{},facts).state;
 const changed=[{lat:48,lon:8},{lat:48.5,lon:9},{lat:49,lon:8}];
 const out=core.observe(plan,changed,state,{...facts,now:200000});
 assert.ok(out.state.percent<50);assert.equal(out.event,null);assert.deepEqual(out.state.done,['route-story-0']);
});
test('actual app telemetry bridge commits before speaking and is disabled for tracker authority',()=>{
 const fs=require('node:fs'),vm=require('node:vm');const code=fs.readFileSync('sync.js','utf8');
 const start=code.indexOf('function _missionObserveRouteVoice('),end=code.indexOf('\nfunction ',start+1);
 let tracker=false,persist=true,calls=0;
 const c={window:{GAMissionRouteVoiceCore:core,paxVoiceRouteEventReady:()=>true,paxVoiceSpeakRouteEvent:()=>{assert.ok(c.missionRuntime.routeVoice.done.length);calls++;}},
 currentMissionData:{clubIdea:{narrativeEvents:plan}},routeWaypoints:route,missionRuntime:{active:true},Date:{now:()=>100000},
 _missionExecutionAuthorityIsTracker:()=>tracker,_persistMissionRuntimeSnapshot:()=>persist};
 vm.createContext(c);vm.runInContext(code.slice(start,end),c);
 const fd={onGround:false};tracker=true;c._missionObserveRouteVoice(48.3,8,fd);assert.equal(calls,0);
 tracker=false;persist=false;c._missionObserveRouteVoice(48.3,8,fd);assert.equal(calls,0);
 persist=true;c._missionObserveRouteVoice(48.3,8,fd);assert.equal(calls,1);
 c._missionObserveRouteVoice(48.3,8,fd);assert.equal(calls,1);
 c.missionRuntime.routeVoice=JSON.parse(JSON.stringify(c.missionRuntime.routeVoice));c._missionObserveRouteVoice(48.3,8,fd);assert.equal(calls,1);
});
test('geo trigger: radius entry, bypass, busy exit, restore and no route required',()=>{
 const p=[{geo:{lat:48.3,lon:8,radiusNm:1},intent:'Ort'}];
 assert.equal(core.observe(p,[],{}, {...facts,lat:48.1}).event,null);
 let out=core.observe(p,[],{}, facts);assert.equal(out.event.intent,'Ort');
 assert.equal(core.observe(p,[],JSON.parse(JSON.stringify(out.state)),{...facts,now:200000}).event,null);
 const busy=core.observe(p,route,{}, {...facts,busy:true});assert.equal(busy.event,null);
 assert.equal(core.observe(p,route,busy.state,{...facts,lat:48.5,now:200000}).event,null);
 for(const gate of [{onGround:true},{paused:true},{ending:true},{slew:true}])assert.equal(core.observe(p,route,{}, {...facts,...gate}).event,null);
});
test('mixed triggers retain stable IDs and reject ambiguous or malformed coordinates',()=>{
 const geo={lat:48.3,lon:8,radiusNm:1};
 for(const p of [[{geo,atPercent:20,intent:'x'}],[{intent:'x'}],[{geo:{...geo,lat:91},intent:'x'}],[{geo:{...geo,radiusNm:0},intent:'x'}],[{geo:{...geo,lon:'8'},intent:'x'}]])assert.equal(core.events(p),null);
 const p=[{atPercent:20,intent:'Route'},{geo,intent:'Ort'}];
 let out=core.observe(p,route,{},facts);assert.equal(out.event.id,'route-story-1');
 out=core.observe(p,route,out.state,{...facts,lat:48.5,now:200000});assert.equal(out.event.id,'route-story-0');
});
test('Sidequest claim changes narration state only, never supplied mission facts',()=>{
 const f={...facts,mission:{phase:'enroute',manifest:[{id:'pax',status:'loaded'}],success:false}};
 const before=JSON.stringify(f),beforePlan=JSON.stringify(plan);
 const out=core.observe(plan,route,{},f);
 assert.ok(out.event);assert.equal(JSON.stringify(f),before);assert.equal(JSON.stringify(plan),beforePlan);
 assert.equal(out.state.done.length,1);assert.equal(out.state.mission,undefined);
});

test('spoken history is bounded, deduplicated and changes no mission decisions',()=>{
 let rows=[];for(let i=0;i<20;i++)rows=core.rememberSpeech(rows,String(i),'A'.repeat(900));
 assert.ok(rows.length<=12);assert.ok(rows.reduce((n,r)=>n+r.text.length,0)<=4000);
 rows=core.rememberSpeech(rows,'19','Neue Aussage');assert.equal(rows.filter(r=>r.id==='19').length,1);
 assert.match(core.conversationPrompt('Kontext',rows),/Neue Aussage/);
 assert.equal(core.conversationPrompt('Kontext',[]),'Kontext');
});
test('standalone remembers only completed local playback, not muted or cancelled clips',async()=>{
 const fs=require('node:fs'),vm=require('node:vm'),code=fs.readFileSync('passenger-voice.js','utf8');
 const start=code.indexOf('async function _paxPlayResolvedTtsAudio('),end=code.indexOf('\nconst _PAX_TTS_VOICE_POOL',start);
 let enabled=true,played=true,current=true;const spoken=[];
 const c={window:{awmShouldPlayOnThisDevice:()=>enabled,missionRecordClubSpeech:t=>spoken.push(t)},_paxMissionEpoch:1,_paxLog:()=>{},_paxEpochCurrent:()=>current,_paxDecodeAndPlay:async(_a,_m,_e,_s,completed)=>{if(played&&current)completed();return played;}};
 vm.createContext(c);vm.runInContext(code.slice(start,end),c);
 const audio={b64:'audio'};
 enabled=false;await c._paxPlayResolvedTtsAudio(audio,1,'Voice','stumm');
 enabled=true;played=false;await c._paxPlayResolvedTtsAudio(audio,1,'Voice','abgebrochen');
 played=true;current=false;await c._paxPlayResolvedTtsAudio(audio,1,'Voice','alter Lauf');
 current=true;await c._paxPlayResolvedTtsAudio(audio,1,'Voice','gehört');
 assert.deepEqual(spoken,['gehört']);
});

test('audio completion hook excludes stop, error and watchdog despite legacy queue success',async()=>{
 const fs=require('node:fs'),vm=require('node:vm'),code=fs.readFileSync('passenger-voice.js','utf8');
 const start=code.indexOf('async function _paxDecodeAudioBufferAndPlay('),end=code.indexOf('\nasync function _paxDecodeAndPlay',start);
 for(const mode of ['ended','error','stop','watchdog']){
  let onWatchdog,heard=0;
  const ctx={state:'running',currentTime:0,destination:{},decodeAudioData:async()=>({duration:1}),createBufferSource:()=>({connect(){},disconnect(){},stop(){this.onended?.();},start(){if(mode==='ended')this.onended();else if(mode==='error')this.onerror();else if(mode==='stop')c._paxCurrentPlayback.stop();else onWatchdog();}})};
  const c={window:{_tawsAudioCtx:ctx},_paxMissionEpoch:1,_paxCurrentPlayback:null,_paxEpochCurrent:()=>true,_paxLog(){},_paxStopCurrentPlayback(){},_normalizePaxAudioStyle:()=> 'clear',_paxAudioStyle:'clear',_paxAudioStyleLabel:()=>'',_paxAudioWarnedAt:0,setTimeout:f=>{onWatchdog=f;return 1;},clearTimeout(){},Date};
  vm.createContext(c);vm.runInContext(code.slice(start,end),c);
  await c._paxDecodeAudioBufferAndPlay(new ArrayBuffer(1),'audio/wav',1,'Test',()=>heard++);
  assert.equal(heard,mode==='ended'?1:0,mode);
 }
});
