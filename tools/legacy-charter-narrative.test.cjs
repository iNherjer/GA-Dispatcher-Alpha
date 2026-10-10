const {test}=require('node:test'),assert=require('node:assert/strict');
const core=require('../mission-legacy-charter-narrative-core.js'),follow=require('../ga-tracker-client/tracker-mission-followup.js');
const person={name:'Mara',role:'Chartergast',gender:'female',taskDomain:'charter'};
const memory={summary:'Mara besucht einen alten Freund.',person:{name:person.name,role:person.role},stayIdea:'Nach dem Wiedersehen möchte Mara die unerwartete Einladung ihrer Familie erzählen.'};
const md={missionId:'legacy-personal',missionType:'apt',mission:'Ein Wiedersehen',story:memory.summary,start:'EDTW',dest:'EDMA',initialStartLat:48.2792,initialStartLon:8.42833,initialTargetLat:48.4252,initialTargetLon:10.9318,initialTargetName:'Augsburg',_appliedProfile:'apt_charter',passenger:person};
const close=m=>follow.createForCompletedRun({missionId:m.missionId,executionAuthority:'tracker',resumeBundle:{missionState:{currentMissionData:m}}},{phase:'closed',flags:{closed:true,groundStill:true},cargo:{summary:{failed:false}},flight:{missionRecord:{createdAt:Date.now()}}});
test('legacy personal memory survives tracker completion and pipeline; scheduling and identity remain unchanged',()=>{
 const source={...md,legacyCharterNarrative:{schema:core.SCHEMA,memory}};const req=close(source).requests[0];assert.equal(req.followUpKind,'apt_charter_pickup');assert.equal(req.passenger.name,person.name);assert.equal(req.status,'pending');assert.ok(req.eligibleAt>req.createdAt);
 const pipeline=follow.service([req]).buildPipelineContext(req);assert.equal(pipeline.legacyCharterContinuation.memory.stayIdea,memory.stayIdea);assert.equal(pipeline.storyFrame.incidentContext,memory.stayIdea);
 assert.equal(close({...md,legacyCharterNarrative:null}).requests.length,1);
});
test('optional memory rejects wrong identities, failed completion and oversized data without changing modern families',()=>{
 const source={...md,legacyCharterNarrative:{schema:core.SCHEMA,memory}};
 assert.equal(core.complete(source,{result:'failed',missionId:md.missionId}),null);assert.equal(core.complete(source,{result:'completed',missionId:'other'}),null);assert.equal(core.memory({...memory,stayIdea:'x'.repeat(701)}),null);
 assert.equal(core.prompt({missionType:'bush',passenger:person}), '');assert.equal(core.prompt({missionType:'apt',passenger:person,charterIdea:{schema:'charter-idea.v1'}}),'');
 const req=close(source).requests[0];assert.equal(core.context({...req,charterContinuation:{schema:'charter-continuation.v1'}}),null);assert.equal(core.context({...req,passenger:{...person,name:'Other'}}).memory,null);
});
test('actual App pickup finalizer keeps the guest and personal greeting, cargo stays locked',()=>{
 const fs=require('node:fs'),vm=require('node:vm');const app=fs.readFileSync(require.resolve('../app.js'),'utf8');const start=app.indexOf("        if (!useCharterContinuation && m && followupDispatchMission?.mission && followupDispatchProfileId === 'apt_charter_pickup') {");const end=app.indexOf('        } else if',start);assert.ok(start>0&&end>start);
 const m={passenger:{...person,greetingText:'Schön, dich zu sehen – mein Freund hat eine Überraschung für uns!'}};
 core.attach(m,{legacyCharterMemory:memory,passenger:m.passenger},{missionType:'apt',passenger:person});
 const locked={passenger:{...person,greetingText:'Standard'},cargo:'-',pax:'0 PAX am Start · 1 PAX Pickup',bush:{profileId:'apt_charter_pickup'}};
 const env=vm.createContext({window:{MissionLegacyCharterNarrativeCore:core},m,followupDispatchMission:{mission:locked},useCharterContinuation:false,followupDispatchProfileId:'apt_charter_pickup',paxText:'',cargoText:''});vm.runInContext(app.slice(start,end)+'\n}',env);
 assert.equal(env.m.passenger.name,person.name);assert.match(env.m.passenger.greetingText,/Überraschung/);assert.equal(env.m.cargo,'-');assert.equal(env.m.bush.profileId,locked.bush.profileId);assert.equal(env.m.bush.pickupStory.whyThere,memory.summary);
 assert.equal(core.pickupPassenger(locked.passenger,{...m,legacyCharterNarrative:null}),locked.passenger);
 assert.equal(core.pickupBush(locked.bush,locked.passenger,{...m,passenger:{...m.passenger,name:'Other'}}),locked.bush);
});
test('actual quota/cloud projections preserve legacy memory and followup identity',async()=>{
 const fs=require('node:fs'),vm=require('node:vm');const {extractOriginalFunction}=await import('./extract-original-function.mjs');const env=vm.createContext({window:{MissionLegacyCharterNarrativeCore:core},compactPoiChainForMission:x=>x});
 for(const [file,names]of [['app.js',['compactMissionObjectForQuotaStorage']],['sync.js',['_syncJsonClone','_syncCompactMissionObjectCore']]])for(const n of names)vm.runInContext(extractOriginalFunction(fs.readFileSync(require.resolve('../'+file),'utf8'),n),env);
 const m={...md,legacyCharterNarrative:{schema:core.SCHEMA,memory},followUpRequestId:'req',followUpContinuation:{narrativeMemory:{legacyCharterNarrative:{schema:core.SCHEMA,memory}}}};const saved=JSON.parse(JSON.stringify(env._syncCompactMissionObjectCore(env.compactMissionObjectForQuotaStorage(m))));assert.deepEqual(saved.legacyCharterNarrative,m.legacyCharterNarrative);assert.equal(saved.followUpRequestId,m.followUpRequestId);assert.deepEqual(saved.followUpContinuation,m.followUpContinuation);
});
