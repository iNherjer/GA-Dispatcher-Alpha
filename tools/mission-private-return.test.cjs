const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
global.MissionPrivateOutingCore=require('../mission-private-outing-core.js');
global.MissionPrivateEpisodeV6=require('../mission-private-episode-v6.js');
const core=require('../mission-private-return-core.js');
const clone=x=>JSON.parse(JSON.stringify(x));
const home={icao:'EDTW',name:'Winzeln',lat:48.27,lon:8.42};
const target={icao:'EDTF',name:'Freiburg',lat:48.02,lon:7.83};
function fixture(){
 const md={missionId:'outbound',mission:'Zusammen unterwegs',missionType:'apt',start:home.icao,dest:target.icao,departureAirport:home,destinationAirport:target,
  passenger:{name:'Sina',role:'Schwester',gender:'female',personality:'neugierig',roleProfile:'general_passenger_v1',taskDomain:'private_outing'},
  privateOuting:{schema:'private-outing.v1',taskDomain:'private_outing',occasion:'Ihr möchtet gemeinsam eine Ausstellung besuchen.',personalReason:'Beide interessiert die Malerei.',companion:{name:'Sina',relationship:'Schwester',gender:'female',personality:'neugierig'},luggage:{label:'Tagesrucksack',weightLbs:9},episode:{sharedIntent:'Gemeinsam die Bilder ansehen'},groundPlan:{intent:'Ausstellungsbesuch'},eventVisit:null}};
 const record={missionId:'outbound',completionId:'outbound-finish',result:'completed',failed:false,endedAt:Date.now(),privateOutingEvidence:{flown:true,atTarget:true,groundStill:true}};
 return {md,record};
}
function extract(c,file,names){
 const src=fs.readFileSync(require.resolve('../'+file),'utf8');
 for(const name of names){const at=src.indexOf('function '+name+'(');assert.ok(at>=0,name);const begin=src.slice(at-6,at)==='async '?at-6:at;vm.runInContext(src.slice(begin,src.indexOf('\n}',at)+2),c);}
}
function followupSandbox(){
 const store=new Map();const c={console,Date,Math,Map,Set,JSON,Number,String,Array,Object,Promise,
  localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,String(v))},
  document:{readyState:'loading',addEventListener(){},getElementById:()=>null},
  setTimeout:()=>0,alert(){},MissionPrivateReturnCore:core};c.window=c;vm.createContext(c);
 vm.runInContext(fs.readFileSync(require.resolve('../mission-followup.js'),'utf8'),c);
 return c;
}
function raw(){return {title:'Mit den Bildern im Kopf',story:'Sina und du habt lange vor dem großen Gemälde gestanden. Nun bereitet ihr mit diesen Eindrücken den Rückflug vor.',experienceRecap:{summary:'Gemeinsamer Ausstellungsbesuch',moments:['Lange vor einem Gemälde gestanden'],companionReaction:'Sina hat besonders die Farben in Erinnerung.'},greeting:{speaker:'companion',addressee:'pilot',text:'Die Farben gehen mir noch durch den Kopf.'},flightBriefing:'Die Rückflugstrecke beträgt [[route.distance]]. Am Ziel weht der Wind mit [[target.wind]], in Böen mit [[target.gust]].'};}
const contract=()=>({route:{startName:target.name,targetName:home.name,distanceNm:31},weather:{dest:{raw:{windKts:8,gustKts:14}}}});
test('private offer requires completed source flight and canonical target evidence; no draft, failure, diversion or chain',()=>{
 const {md,record}=fixture();assert.ok(core.request(md,record));
 for(const change of [r=>r.result='failed',r=>r.failed=true,r=>r.missionId='different',r=>delete r.completionId,r=>r.privateOutingEvidence.flown=false,r=>r.privateOutingEvidence.atTarget=false,r=>r.privateOutingEvidence.groundStill=false]){const r=clone(record);change(r);assert.equal(core.request(md,r),null);}
 assert.equal(core.request(md,{...record,endedAt:Date.now()-15*86400000}),null);
 assert.equal(core.request(md,null),null);assert.equal(core.request({...md,followUpRequestId:'earlier'},record),null);
 assert.equal(core.request({...md,missionFailed:true},record),null);
 const req=core.request(md,record);assert.equal(core.request({...md,privateReturn:req.privateReturn},record),null);
 assert.equal(req.eligibleAt,req.createdAt);assert.equal(req.passenger.name,md.passenger.name);assert.ok(!JSON.stringify(req).includes('writerMemory'));
});
test('follow-up adapter deduplicates, sync round trip retains contract; old charter/bush routing remains unchanged',()=>{
 const c=followupSandbox(),{md,record}=fixture();
 assert.equal(c.missionFollowupMaybeCreateFromCompletedMission(md,{failed:false}).created,false);
 assert.equal(c.missionFollowupMaybeCreateFromCompletedMission(md,{failed:false},{completionRecord:record}).created,true);
 assert.equal(c.missionFollowupMaybeCreateFromCompletedMission(md,{failed:false},{completionRecord:record}).created,false);
 const requests=clone(c.missionFollowupGetForSync());assert.equal(requests.length,1);
 const other=followupSandbox();other.missionFollowupApplyFromSync(requests);
 assert.deepEqual(clone(other.missionFollowupGetForSync()[0].privateReturn),requests[0].privateReturn);
 for(const kind of ['apt_charter_pickup','bush_pickup_strip']){
  const req={id:'old',followUpKind:kind,route:{homeRef:home,targetRef:target}};
  const onsite=c.missionFollowupBuildPipelineContext(req,{start:target,dest:home});
  assert.equal(onsite.acceptanceMode,'onsite_to_home');assert.equal(onsite.effectiveProfileId,kind==='apt_charter_pickup'?'apt_charter':'bush_charter_strip');
  const pickup=c.missionFollowupBuildPipelineContext(req,{start:home,dest:target});assert.equal(pickup.acceptanceMode,'pickup_from_home');
 }
});
test('private return stays onsite A-B, rejects mismatched start/destination, preserves person and luggage',()=>{
 const {md,record}=fixture(),req=core.request(md,record);
 assert.equal(core.acceptance(req,home),null);assert.equal(core.pipeline(req,{start:target,dest:target}),null);
 const a=core.acceptance(req,target);assert.equal(a.dispatchProfileId,'private_return');
 const m=core.mission({...req,acceptance:a},{start:target,dest:home}).mission;
 assert.equal(m.bush,undefined);assert.equal(m.passenger.taskDomain,'private_return');assert.equal(m.cargo,'Tagesrucksack (9 lbs)');
 assert.equal(m.privateReturn.voiceIdentity,'Sina|Schwester|general_passenger_v1|private_outing');
});
test('one return writer call produces shared recap and bound fresh weather; invalid response preserves retryable request',async()=>{
 const {md,record}=fixture(),req=core.request(md,record);let calls=0;
 const c={window:{MissionPrivateReturnCore:core},getSelectedAiApiKey:()=> 'TEST',getSelectedAiProvider:()=> 'gemini',
 fetchGeminiJsonWithFallback:async(p,k,o)=>{calls++;assert.ok(p.includes('"gustKts":14'));assert.equal(o.promptVersion,'mission-private-return-'+core.REVISION);return {parsed:raw()};}};
 vm.createContext(c);extract(c,'app.js',['fetchPrivateReturnStory']);
 const m=await c.fetchPrivateReturnStory({missionContractV4:contract(),followupSeed:req,start:target,dest:home,aiModeEnabled:true});
 assert.equal(calls,1);assert.equal(m.privateReturn.experienceRecap.summary,'Gemeinsamer Ausstellungsbesuch');
 assert.equal(m.passenger.privateReturn,m.privateReturn);assert.equal(m._missionContractV4.privateReturn,m.privateReturn);
 assert.ok(m.s.includes('31 NM'));assert.ok(m.s.includes('14 Knoten'));assert.equal(req.status,'pending');assert.equal(req.privateReturn.experienceRecap,null);
 c.fetchGeminiJsonWithFallback=async()=>({parsed:{...raw(),experienceRecap:null}});
 await assert.rejects(()=>c.fetchPrivateReturnStory({missionContractV4:contract(),followupSeed:req,start:target,dest:home,aiModeEnabled:true}),/Erlebnisrückblick/);
 assert.equal(core.prose({...raw(),flightBriefing:'Die Strecke beträgt 31 NM.'},req.privateReturn,contract()),null);
});
test('return voice uses recap for all A-B phases, keeps both provider voices and passes original outing through unchanged',()=>{
 const {md,record}=fixture(),req=core.request(md,record);const r=core.prose(raw(),req.privateReturn,contract());
 const m=core.mission(req,{start:target,dest:home},r).mission;m.missionId='return';
 const c={window:{MissionPrivateReturnCore:core,currentMissionData:m,activePassenger:m.passenger},
 _activeTaskDomain:()=> 'private_return',_normSpeakerGender:p=>p.gender,_hashStable:s=>[...s].reduce((a,x)=>a+x.charCodeAt(0),0),
 _PAX_TTS_VOICE_POOL:{female:['A','B','C']},_PAX_OPENAI_TTS_VOICE_POOL:{female:['a','b','c']}};
 vm.createContext(c);vm.runInContext("let _privateReturnSpoken = {missionId:'',lines:[]};",c);
 extract(c,'passenger-voice.js',['_privateReturnVoiceContext','_capturePrivateReturnNarrative','_privateReturnNarrativeHint','_aptArrivalContextLine','_aptArrivalApproachHint','_aptArrivalAfterLandingHint','_aptArrivalFarewellHint','_greetingMissionGuidance','_ttsVoiceCandidatesForSpeaker','_openAiTtsVoiceCandidatesForSpeaker']);
 for(const fn of ['_aptArrivalContextLine','_aptArrivalApproachHint','_aptArrivalAfterLandingHint','_aptArrivalFarewellHint']){
  const hint=c[fn]();assert.ok(hint.includes('Gemeinsamer Ausstellungsbesuch'));assert.ok(!hint.includes('Vorfreude'));
 }
 c._capturePrivateReturnNarrative('Die Farben haben mich beeindruckt.');assert.ok(c._aptArrivalApproachHint().includes('Die Farben haben mich beeindruckt.'));
 for(const fn of ['_ttsVoiceCandidatesForSpeaker','_openAiTtsVoiceCandidatesForSpeaker']) assert.deepEqual(clone(c[fn](md.passenger)),clone(c[fn](m.passenger)));
 c.window.currentMissionData={missionId:'other'};c.window.activePassenger=null;assert.equal(c._privateReturnNarrativeHint(), '');
});
test('deep cloud compaction retains private episode, recap and voice identity',()=>{
 const {md,record}=fixture(),req=core.request(md,record),p=core.prose(raw(),req.privateReturn,contract());
 const m=core.mission(req,{start:target,dest:home},p).mission;
 const c={};vm.createContext(c);extract(c,'sync.js',['_syncCompactMissionObjectCore','_syncStripDeepMissionPlans']);
 const compact=c._syncStripDeepMissionPlans(c._syncCompactMissionObjectCore(m));
 assert.deepEqual(clone(compact.privateReturn),m.privateReturn);assert.equal(compact.passenger.privateReturn.experienceRecap.summary,p.continuity.experienceRecap.summary);
});
test('completion evidence rejects absent telemetry, planned distance and wrong/end-flight location',()=>{
 const flight={durationSec:600,telemetrySampleCount:120,distanceNm:30,distanceSource:'gps'};
 assert.deepEqual(core.completionEvidence(flight,{atTarget:true,groundStill:true}),{flown:true,atTarget:true,groundStill:true});
 for(const f of [{},{...flight,distanceSource:'planned'},{...flight,telemetrySampleCount:0}]) assert.equal(core.completionEvidence(f,{}).flown,false);
 assert.equal(core.completionEvidence(flight,{atTarget:false,groundStill:true}).atTarget,false);
});
test('delivered speaker snapshots and shared boarding voice preserve original voice seed',()=>{
 const {md,record}=fixture(),req=core.request(md,record),m=core.mission(req,{start:target,dest:home}).mission;
 const c={window:{activePassenger:m.passenger}};vm.createContext(c);extract(c,'passenger-voice.js',['_speakerSnapshotForActivePax']);
 const speaker=clone(c._speakerSnapshotForActivePax());assert.equal(speaker.voiceIdentity,req.privateReturn.voiceIdentity);
 const voice=require('../mission-boarding-voice-core.js');
 for(const provider of ['gemini','openai']) assert.deepEqual(voice.voiceCandidates(provider,md.passenger),voice.voiceCandidates(provider,speaker));
});
test('dismissed return tombstones survive sync and suppress duplicate completion hooks',()=>{
 const c=followupSandbox(),{md,record}=fixture();const req=core.request(md,record);
 c.missionFollowupApplyFromSync([{...req,status:'dismissed',updatedAt:Date.now()-60000}]);
 assert.equal(c.missionFollowupGetForSync().length,1);
 assert.equal(c.missionFollowupMaybeCreateFromCompletedMission(md,null,{completionRecord:record}).created,false);
});
test('APT normalizer keeps the new task domain and return has no outbound arrival scene',()=>{
 const {md,record}=fixture(),req=core.request(md,record),m=core.mission(req,{start:target,dest:home}).mission;
 const c={window:{MissionPrivateReturnCore:core}};vm.createContext(c);extract(c,'app.js',['enforcePoiPassengerAltitudeRule']);extract(c,'mission-arrival-core.js',['buildAptArrivalPlan']);
 const p=c.enforcePoiPassengerAltitudeRule(m.passenger,false);assert.equal(p.taskDomain,'private_return');assert.equal(p.privateReturn,m.privateReturn);
 assert.equal(c.buildAptArrivalPlan({mission:m,dest:home,profileId:'private_return'}),null);
});

test('debug button creates explicit test return without fabricating logbook, landing or normal flight proof',()=>{
 const {md,record}=fixture(),c=followupSandbox();c.currentMissionData=clone(md);
 const buttons={btnDebugFollowupForce:{},btnDebugFollowupComplete:{}};
 c.document.getElementById=id=>buttons[id]||null;
 c.localStorage.setItem('last_icao_dest','OTHER');c.localStorage.setItem('ga_logbook','[]');
 assert.equal(c.missionFollowupDebugCompleteCurrentMission(),true);
 assert.equal(buttons.btnDebugFollowupComplete.disabled,false);
 assert.equal(buttons.btnDebugFollowupComplete.textContent,'Heimreise testen');
 const list=c.missionFollowupGetForSync(),req=list[0];
 assert.equal(list.length,1);assert.equal(req.privateReturn.debugCompletion,true);assert.ok(req.ui.title.startsWith('Debug:'));
 assert.equal(c.localStorage.getItem('last_icao_dest'),'OTHER');assert.equal(c.localStorage.getItem('ga_logbook'),'[]');
 assert.equal(c.currentMissionData.missionCompletionState,undefined);
 assert.equal(c.missionFollowupDebugCompleteCurrentMission(),false);assert.equal(c.missionFollowupGetForSync().length,1);
 assert.equal(core.request(md,{...record,privateOutingEvidence:null,debugGenerated:true}),null);
 assert.ok(core.request(md,record));assert.notEqual(core.request(md,record).id,req.id);
 assert.equal(core.debugRequest({...md,privateReturn:req.privateReturn}),null);
 const restored=followupSandbox();restored.missionFollowupApplyFromSync(list);
 assert.equal(restored.missionFollowupGetForSync()[0].privateReturn.debugCompletion,true);
});

test('return accepts the actual companion name and reports rejected fields without weakening flight bindings',()=>{
 const {md,record}=fixture(),c=core.request(md,record).privateReturn;
 const reply=raw();reply.greeting.speaker='Sina';
 assert.equal(core.validateProse(reply,c,contract()).accepted,true);
 reply.greeting.speaker='Someone else';
 assert.ok(core.validateProse(reply,c,contract()).errors.includes('greeting.speaker:invalid'));
 reply.greeting.speaker='companion';reply.flightBriefing='Der Flug dauert 31 NM.';
 const invalid=core.validateProse(reply,c,contract());
 assert.equal(invalid.prose,null);
 assert.deepEqual(invalid.errors,['flightBriefing:invalid_bindings_or_length']);
 reply.flightBriefing=raw().flightBriefing;reply.experienceRecap.summary='';
 assert.deepEqual(core.validateProse(reply,c,contract()).errors,['experienceRecap.summary:missing_or_length']);
 assert.ok(core.prompt(c,contract()).includes('Außerhalb dieser Referenzen keine Ziffern'));
});

test('private departure waits for climb, speaks once and never arms for outbound or closing',()=>{
 const {md,record}=fixture();const ret=core.mission(core.request(md,record),{start:target,dest:home}).mission;ret.missionId='return';
 let now=0,calls=0,enabled=true;
 const c={window:{currentMissionData:ret,MissionPrivateReturnCore:core,triggerPaxPrivateReturnDeparture:()=>{if(!enabled)return false;calls++;return true;}},Date:{now:()=>now},Number};
 vm.createContext(c);const src=fs.readFileSync(require.resolve('../mission-runtime-core.js'),'utf8');
 const at=src.indexOf('window.missionMaybeTriggerPrivateReturnDepartureVoice =');
 vm.runInContext(src.slice(at,src.indexOf('\n};',at)+3),c);
 const tick=(agl,onGround=false,r={active:true})=>c.window.missionMaybeTriggerPrivateReturnDepartureVoice({aglFt:agl,onGround},r);
 assert.equal(tick(0,true),false);assert.equal(tick(60),false);
 now=59999;assert.equal(tick(500),false);now=60000;assert.equal(tick(499),false);
 enabled=false;assert.equal(tick(500),false);enabled=true;
 assert.equal(tick(500),true);assert.equal(tick(500),false);assert.equal(calls,1);
 c.window.missionPrivateReturnDepartureVoice=null;
 assert.equal(tick(500,false,{active:false,closing:true}),false);
 c.window.currentMissionData=md;assert.equal(tick(500),false);
 c.window.currentMissionData=ret;assert.equal(tick(500),false);
 now+=10000;tick(0,true);now+=25000;assert.equal(tick(500),false);
 assert.equal(calls,1);
});
