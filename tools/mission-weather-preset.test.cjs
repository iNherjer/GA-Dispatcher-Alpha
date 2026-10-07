const test=require('node:test'),assert=require('node:assert/strict');
const core=require('../mission-weather-preset-core.js');
const {createTrackerCockpitControl}=require('../ga-tracker-client/tracker-cockpit-control-core.js');
function sim(index,now,temp=10){return {lat:45,lon:-115,mslFt:5000,tempC:temp,windKts:3,visKm:10,weatherPreset:index==null?null:{index,name:'Preset',receivedAt:now,source:'efb-1'}};}
const facts=now=>({now,active:true,onboard:true});
function cycle(index=1){let state={},now=100000;for(let i=0;i<10;i++){const result=core.observe(state,sim(index,now),facts(now));state=result.state;now+=1000;}return {state,now};}
test('preset-to-preset and live-to-preset react only after real changes settle',()=>{
 for(const initial of [0,1]){let {state,now}=cycle(initial),reactions=[];for(let i=0;i<5;i++){const result=core.observe(state,sim(2,now,30),facts(now));state=result.state;if(result.reaction)reactions.push(result.reaction);now+=1000;}assert.equal(reactions.length,1);assert.match(reactions[0].prompt,/anderen Wetter-Preset/);}
});
test('preset identity change with the same weather stays silent',()=>{let {state,now}=cycle();for(let i=0;i<45;i++){const r=core.observe(state,sim(2,now),facts(now));assert.equal(r.reaction,null);state=r.state;now+=1000;}});
test('cooldown is exactly two minutes and survives state serialization',()=>{
 let {state,now}=cycle();const step=(index,temp)=>{let reaction;for(let i=0;i<5;i++){const r=core.observe(state,sim(index,now,temp),facts(now));state=r.state;reaction ||= r.reaction;now+=1000;}return reaction;};
 assert.ok(step(2,30));assert.equal(step(3,-12),null);state=JSON.parse(JSON.stringify(state));
 for(let i=0;i<125;i++){state=core.observe(state,sim(3,now,-12),facts(now)).state;now+=1000;}
 assert.ok(step(4,30));
});
test('without EFB/API, tracker weather changes remain observable without attributing a preset switch',()=>{
 let {state,now}=cycle(null),reaction;for(let i=0;i<6;i++){const r=core.observe(state,sim(null,now,30),facts(now));state=r.state;reaction ||= r.reaction;now+=1000;}
 assert.ok(reaction);assert.match(reaction.prompt,/Ursache.*unbekannt/);assert.doesNotMatch(reaction.prompt,/Simulator meldete einen anderen/);
 assert.doesNotThrow(()=>core.observe({}, {},facts(now)));
});
test('first sample, stale status, changed source session, pause and large altitude changes cannot masquerade as preset switches',()=>{
 assert.equal(core.observe({},sim(2,100000,30),facts(100000)).reaction,null);
 let {state,now}=cycle();const fd=sim(2,now,30);fd.mslFt=7000;
 for(let i=0;i<5;i++){const r=core.observe(state,fd,facts(now+i*1000));state=r.state;assert.equal(r.reaction,null);}
 const paused=core.observe(state,{...sim(3,now),simPaused:true},facts(now));assert.equal(paused.reaction,null);
 const stale=core.observe({}, {...sim(1,now),weatherPreset:{index:1,receivedAt:now-60000}},facts(now));assert.equal(stale.state.source,'telemetry');
});
test('only authenticated EFB capability reports are accepted, expire, and conflicting observers yield unknown',()=>{
 let now=100000,n=0;const control=createTrackerCockpitControl({now:()=>now,idFactory:()=>`session-${++n}`,tokenFactory:()=>`token-${n}`});
 const register=(role,caps)=>{const r=control.register({clientId:`client-${n}`,role,capabilities:caps});return {sessionId:r.session.sessionId,sessionToken:r.sessionToken};};
 const efb=register('efb',['sim.weather-preset.v1']),web=register('web',['sim.weather-preset.v1']);
 control.heartbeat({...web,weatherPreset:{index:5}});assert.equal(control.weatherPreset(),null);
 control.heartbeat({...efb,sessionToken:'wrong',weatherPreset:{index:2}});assert.equal(control.weatherPreset(),null);
 control.heartbeat({...efb,weatherPreset:{index:0}});assert.equal(control.weatherPreset().index,0);
 const other=register('efb',['sim.weather-preset.v1']);control.heartbeat({...other,weatherPreset:{index:3}});assert.equal(control.weatherPreset(),null);
 control.heartbeat({...other,weatherPreset:null});assert.equal(control.weatherPreset().index,0);
 now+=16000;assert.equal(control.weatherPreset(),null);
});

test('same preset can have significant natural weather changes without attributing a switch',()=>{
 let {state,now}=cycle(0),reaction;for(let i=0;i<6;i++){const r=core.observe(state,sim(0,now,30),facts(now));state=r.state;reaction ||= r.reaction;now+=1000;}
 assert.ok(reaction);assert.match(reaction.prompt,/ausschließlich die beobachtete Wetteränderung/);assert.doesNotMatch(reaction.prompt,/Simulator meldete einen anderen/);
});
test('after EFB disconnect, wind and visibility changes still trigger an observational comment',()=>{
 let {state,now}=cycle(1);
 for(let i=0;i<10;i++){state=core.observe(state,sim(null,now),facts(now)).state;now+=1000;}
 let reaction;for(let i=0;i<6;i++){const fd={...sim(null,now),windKts:20,visKm:2};const r=core.observe(state,fd,facts(now));state=r.state;reaction ||= r.reaction;now+=1000;}
 assert.ok(reaction);assert.equal(reaction.changes.length,2);assert.match(reaction.prompt,/kein Hinweis auf Simulator/);assert.match(reaction.prompt,/Auch wenn der übrige Missionskontext/);
});
test('one transient weather spike without EFB stays silent and does not mutate earlier state',()=>{
 let {state,now}=cycle(null);const r=core.observe(state,sim(null,now,30),facts(now));assert.equal(r.reaction,null);
 const saved=JSON.stringify(r.state);core.observe(r.state,sim(null,now+1000,30),facts(now+1000));assert.equal(JSON.stringify(r.state),saved);state=r.state;now+=1000;
 for(let i=0;i<10;i++){const next=core.observe(state,sim(null,now),facts(now));assert.equal(next.reaction,null);state=next.state;now+=1000;}
});

function clockSim(now,shift=0,rate=1){return {...sim(null,now),simAbsoluteTimeSeconds:64000000000+(now-100000)/1000*rate+shift,simulationRate:rate,simLocalTimeSeconds:((86395+(now-100000)/1000*rate+shift)%86400+86400)%86400};}
function clockCycle(){let state={},now=100000;for(let i=0;i<10;i++){state=core.observe(state,clockSim(now),facts(now)).state;now+=1000;}return {state,now};}
test('forward and backward clock shifts are confirmed without EFB',()=>{
 for(const shift of [7200,-7200]){let {state,now}=clockCycle(),reaction;for(let i=0;i<5;i++){const r=core.observe(state,clockSim(now,shift),facts(now));state=r.state;reaction ||= r.reaction;now+=1000;}assert.equal(reaction?.kind,'time_shift');assert.match(reaction.prompt,shift>0?/vorwärts/:/rückwärts/);assert.match(reaction.prompt,/120 Minuten/);}
});
test('midnight, normal accelerated time and exactly sixty minutes do not count as clock jumps',()=>{
 for(const [rate,shift] of [[1,0],[128,0],[1,3600]]){let state={};for(let now=100000;now<120000;now+=1000){const r=core.observe(state,clockSim(now,now>=110000?shift:0,rate),facts(now));state=r.state;assert.equal(r.reaction,null);}}
});
test('short time menu retains baseline and confirms shift only after returning',()=>{
 let {state,now}=clockCycle();const paused=core.observe(state,{...clockSim(now,7200),inMenuOrMap:true},facts(now));assert.equal(paused.reaction,null);state=paused.state;now+=30000;
 let reaction;for(let i=0;i<5;i++){const r=core.observe(state,clockSim(now,7200),facts(now));state=r.state;reaction ||= r.reaction;now+=1000;}assert.equal(reaction?.kind,'time_shift');
});
test('missing time, long telemetry gaps, new missions and reverted spikes stay silent',()=>{
 let {state,now}=clockCycle();const spike=core.observe(state,clockSim(now,7200),facts(now));assert.equal(spike.reaction,null);state=spike.state;now+=1000;
 for(let i=0;i<5;i++){const r=core.observe(state,clockSim(now),facts(now));state=r.state;assert.equal(r.reaction,null);now+=1000;}
 assert.equal(core.observe(state,clockSim(now+30000,7200),facts(now+30000)).reaction,null);
 assert.equal(core.observe(state,sim(null,now),facts(now)).reaction,null);
 assert.equal(core.observe({},clockSim(now,7200),facts(now)).reaction,null);
 assert.equal(core.observe(state,clockSim(now,7200),{...facts(now),ending:true}).reaction,null);
});
test('weather and clock share cooldown and busy voices defer the clock comment',()=>{
 let {state,now}=clockCycle();for(let i=0;i<4;i++){const r=core.observe(state,clockSim(now,7200),{...facts(now),busy:true});assert.equal(r.reaction,null);state=r.state;now+=1000;}
 const release=core.observe(state,clockSim(now,7200),facts(now));assert.equal(release.reaction?.kind,'time_shift');state=JSON.parse(JSON.stringify(release.state));now+=1000;
 for(let i=0;i<10;i++){const fd={...clockSim(now,7200),tempC:30};const r=core.observe(state,fd,facts(now));assert.equal(r.reaction,null);state=r.state;now+=1000;}
 for(let i=0;i<130;i++){state=core.observe(state,{...clockSim(now,7200),tempC:30},facts(now)).state;now+=1000;}
 let reaction;for(let i=0;i<5;i++){const r=core.observe(state,{...clockSim(now,14400),tempC:30},facts(now));state=r.state;reaction ||= r.reaction;now+=1000;}assert.equal(reaction?.kind,'time_shift');
});

test('a short weather menu visit retains the comparison and reacts only after return',()=>{
 let {state,now}=cycle(0),reaction;
 state=core.observe(state,{...sim(2,now,30),inMenuOrMap:true},facts(now)).state;now+=30000;
 for(let i=0;i<6;i++){const r=core.observe(state,sim(2,now,30),facts(now));state=r.state;reaction ||= r.reaction;now+=1000;}
 assert.ok(reaction);assert.match(reaction.prompt,/anderen Wetter-Preset/);
});
test('slew, stopped sim and pause aliases cannot trigger weather or time reactions',()=>{
 for(const flag of ['slewActive','slewMode','isSlewActive','paused','isPaused','simRunning']){
  let {state,now}=clockCycle();for(let i=0;i<6;i++){const r=core.observe(state,{...clockSim(now,7200),tempC:30,[flag]:flag==='simRunning'?0:true},facts(now));state=r.state;assert.equal(r.reaction,null,flag);now+=1000;}
 }
});
test('precipitation comments use confirmed rain/snow state and never claim an unverified hourly rate',()=>{
 assert.deepEqual(core.differences({precipRateMmH:0},{precipRateMmH:20}),[]);
 assert.deepEqual(core.differences({precipState:2},{precipState:4}),['Niederschlag: vorher kein Niederschlag, jetzt Regen']);
 assert.deepEqual(core.differences({precipState:null},{precipState:8}),[]);
 let state={},now=100000,reaction;
 for(let i=0;i<16;i++){const r=core.observe(state,{...sim(null,now),precipState:i<10?2:8},facts(now));state=r.state;reaction ||= r.reaction;now+=1000;}
 assert.ok(reaction);assert.match(reaction.prompt,/jetzt Schnee/);assert.doesNotMatch(reaction.prompt,/mm\/h/);
});
