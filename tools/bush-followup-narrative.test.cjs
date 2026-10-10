const {test}=require('node:test'),assert=require('node:assert/strict');
const core=require('../mission-bush-narrative-core.js');
const follow=require('../ga-tracker-client/tracker-mission-followup.js');
const copy=x=>JSON.parse(JSON.stringify(x)),now=Date.now();
const home={kind:'airport',icao:'KMYL',name:'McCall',lat:44.89,lon:-116.1},target={kind:'airport',icao:'U60',name:'Big Creek',lat:45.13,lon:-115.32};
const memory=(kind,person={name:'Mara',role:'Adventure-Gast'})=>({summary:'Mara will ihren alten Wanderweg wiederfinden.',participants:[person],openQuestions:['Was wird aus dem Aufenthalt?'],betweenFlightsIdeas:[{followUpKind:kind,summary:'Nach dem Aufenthalt wartet Mara mit ihrer eigenen Geschichte wieder am Strip.'}]});
const md=(profile,kind)=>({missionId:'bush-'+profile,missionType:'bush',mission:'Bush-Auftrag',story:'Ein persönlicher Auftrag draußen.',start:'KMYL',dest:'U60',_appliedProfile:profile,passenger:{name:'Mara',role:'Adventure-Gast'},bush:{profileId:profile,homeRef:home,targetRef:target},bushFollowUpNarrative:core.followupDraft(memory(kind))});
const control={phase:'closed',flags:{closed:true,groundStill:true},cargo:{summary:{failed:false}},flight:{missionRecord:{createdAt:now}}};
const close=m=>follow.createForCompletedRun({missionId:m.missionId,executionAuthority:'tracker',resumeBundle:{missionState:{currentMissionData:copy(m)}}},control,now);
test('Charter, adventure and supply keep dynamic memory through tracker completion and sync merge',()=>{
 for(const [profile,kind] of [['bush_charter_strip','bush_pickup_strip'],['bush_scenic_hopper','bush_pickup_strip'],['bush_supply_strip','bush_pickup_cargo']]){
  const m=md(profile,kind),r=close(m);assert.equal(r.requests.length,1);const req=follow.mergeRequests([],copy(r.requests),now)[0];assert.equal(req.followUpKind,kind);
  const c=core.followupContext(req);assert.equal(c.memory.summary,m.bushFollowUpNarrative.memory.summary);assert.equal(c.completion.result,'completed');assert.equal(c.betweenFlights.summary,m.bushFollowUpNarrative.memory.betweenFlightsIdeas[0].summary);
  const pipeline=follow.service([req],now).buildPipelineContext(req);assert.ok(pipeline);assert.equal(pipeline.bushContinuation.betweenFlights.summary,c.betweenFlights.summary);
  if(kind==='bush_pickup_strip')assert.equal(req.passenger.name,'Mara');else assert.equal(req.passenger,null);
 }
});
test('Recon technician chain carries each current writer memory and terminates after pickup',()=>{
 const recon=md('bush_recon_return','bush_charter_strip');recon.bushReconOutcome={outcome:'technician_needed',createdAt:now};
 const req=close(recon).requests[0];assert.equal(req.followUpKind,'bush_charter_strip');assert.equal(req.chain.depth,1);
 const base={...md('bush_charter_strip','bush_pickup_strip'),passenger:req.passenger,followUpRequestId:req.id,followUpContinuation:{sourceKind:req.sourceKind,followUpKind:req.followUpKind,chain:req.chain,chainStep:req.chain.step,requestId:req.id,narrativeMemory:req.narrativeMemory,targetRef:req.route.targetRef,returnHomeRef:req.route.homeRef}};
 const technician=base.passenger;const raw=memory('bush_pickup_strip',technician);raw.summary='Der Techniker wird zum bekannten Befund gebracht.';raw.betweenFlightsIdeas[0].summary='Nach dem Abgleich am Boden packt der Techniker Werkzeug und seine Notizen für die Rückreise.';
 const drop={...base,missionId:'drop',bushFollowUpNarrative:core.followupDraft(raw)};
 const pickup=close(drop).requests[0];assert.equal(pickup.followUpKind,'bush_pickup_strip');assert.equal(pickup.chain.depth,2);assert.equal(pickup.passenger.name,technician.name);assert.equal(core.followupContext(pickup).memory.summary,raw.summary);
 assert.equal(core.followupContext(pickup).betweenFlights.summary,raw.betweenFlightsIdeas[0].summary);
 const end={...md('bush_pickup_strip','bush_pickup_strip'),missionId:'pickup',followUpRequestId:pickup.id,followUpContinuation:{sourceKind:pickup.sourceKind,followUpKind:pickup.followUpKind,chain:pickup.chain,chainStep:pickup.chain.step}};assert.equal(close(end).requests.length,0);
});
test('optional narrative cannot authorize a mission, invent a kind or survive failed completion',()=>{
 assert.equal(core.followupMemory({...memory('bush_pickup_strip'),betweenFlightsIdeas:[{followUpKind:'infra_final_review',summary:'wrong family'}]}),null);
 assert.equal(core.followupMemory({...memory('bush_pickup_strip'),summary:'x'.repeat(701)}),null);
 const m=md('bush_scenic_hopper','bush_pickup_strip');assert.equal(core.followupComplete(m,{result:'failed'},'bush_pickup_strip'),null);
 assert.equal(core.followupComplete(m,{result:'completed',missionId:'other'},'bush_pickup_strip'),null);
 assert.equal(close({...m,_appliedProfile:'unsupported',bush:null}).requests.length,0);
 assert.ok(close({...m,bushFollowUpNarrative:null}).requests.length,'legacy still creates its offer');
 assert.equal(core.followupContext({...close(m).requests[0],followUpKind:'bush_supply_strip'}).betweenFlights,null);
});
test('writer attaches optional memory only to Bush and keeps locked passenger identity',()=>{
 const context={missionType:'bush',missionContractV4:{}},m={passenger:{name:'Mara',role:'Adventure-Gast'}};
 core.attachFollowup(m,{bushContinuationMemory:memory('bush_pickup_strip')},context);assert.equal(m._missionWriterV4Debug.bushMemoryStatus,'accepted');assert.deepEqual(context.missionContractV4.bushFollowUpNarrative,m.bushFollowUpNarrative);
 core.attachFollowup(m,{bushContinuationMemory:memory('bush_pickup_strip',{name:'Other',role:'Adventure-Gast'})},context);assert.equal(m.bushFollowUpNarrative,null);
 const apt={};core.attachFollowup(apt,{bushContinuationMemory:memory('bush_pickup_strip')},{missionType:'apt'});assert.deepEqual(apt,{});
});

test('real compact mission/cloud functions preserve bounded Bush memory and current continuation',async()=>{
 const fs=require('node:fs'),vm=require('node:vm');
 const {extractOriginalFunction}=await import('./extract-original-function.mjs');
 const env=vm.createContext({window:{GAMissionBushExecutionCore:require('../mission-bush-execution-core.js')},compactPoiChainForMission:x=>x});
 for(const [file,names] of [['app.js',['compactMissionObjectForQuotaStorage']],['sync.js',['_syncJsonClone','_syncCompactMissionObjectCore']]])for(const n of names)vm.runInContext(extractOriginalFunction(fs.readFileSync(require.resolve('../'+file),'utf8'),n),env);
 const m=md('bush_scenic_hopper','bush_pickup_strip');m.missionContract={bushFollowUpNarrative:m.bushFollowUpNarrative};m.followUpContinuation={narrativeMemory:{bushFollowUpNarrative:m.bushFollowUpNarrative},chain:{depth:1}};
 const saved=copy(env._syncCompactMissionObjectCore(env.compactMissionObjectForQuotaStorage(m)));
 assert.deepEqual(saved.bushFollowUpNarrative,m.bushFollowUpNarrative);
 assert.deepEqual(saved.missionContract.bushFollowUpNarrative,m.bushFollowUpNarrative);
 assert.deepEqual(saved.followUpContinuation,m.followUpContinuation);
});


test('Adventure stays span 7–30 days and retain old booked stays and exact cloud eligibility',()=>{
 for(let i=0;i<80;i++){
  const req=close(md('bush_scenic_hopper','bush_pickup_strip')).requests[0];
  assert.ok(req.stayDays>=7&&req.stayDays<=30);
 }
 for(const days of [2,7,30]){
  const m=md('bush_scenic_hopper','bush_pickup_strip'),eligibleAt=now+days*86400000;
  m.missionTemporalContext={sourceKind:'bush_scenic_hopper',stayDays:days,followUpEligibleAt:eligibleAt};
  const req=close(m).requests[0];assert.equal(req.stayDays,days);assert.equal(req.eligibleAt,eligibleAt);
  const restored=follow.mergeRequests([],copy([req]),now)[0];assert.equal(restored.stayDays,days);
  const pipeline=follow.service([restored],now).buildPipelineContext(restored);
  assert.equal(pipeline.temporalContext.stayDays,days);assert.equal(pipeline.bushContinuation.temporalContext.stayDays,days);
  assert.match(core.followupPrompt({missionType:'bush',followUpContext:pipeline}),new RegExp('"stayDays":'+days));
 }
 for(const profile of ['bush_charter_strip','bush_supply_strip']){
  const req=close(md(profile,profile==='bush_supply_strip'?'bush_pickup_cargo':'bush_pickup_strip')).requests[0];
  assert.ok(req.stayDays>=1&&req.stayDays<=7);
 }
});
