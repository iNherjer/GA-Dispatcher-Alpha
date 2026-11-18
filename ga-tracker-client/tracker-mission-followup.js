'use strict';
// Same service and domain functions as the App, with explicit non-UI hosts.
const {createFollowupService}=require('../mission-followup.js');
const {createInfraOutcomeService}=require('../mission-infra-outcome-core.js');
const privateReturn=require('../mission-private-return-core.js');
const charterContinuation=require('../mission-charter-continuation-core.js');
const routeVoice=require('../mission-route-voice-core.js');
const clone=value=>JSON.parse(JSON.stringify(value));
function service(requests=[],now=Date.now()) {
 const storage=new Map([['ga_followup_requests_v1',JSON.stringify(requests)]]);
 const window={MissionCharterContinuationCore:charterContinuation,MissionPrivateReturnCore:{...privateReturn,request:(mission,record)=>privateReturn.request(mission,record,now)}};
 class Clock extends Date { constructor(...args){super(...(args.length?args:[now]));} static now(){return now;} }
 const environment={window,Date:Clock,headless:true,document:{getElementById:()=>null},localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,String(value))}};
 createInfraOutcomeService(environment);
 return createFollowupService(environment);
}
function createForCompletedRun(run,control,now=Date.now()) {
 if(run?.executionAuthority!=='tracker'||control?.phase!=='closed'||!control.flags?.closed) throw Error('followup_completion_unconfirmed');
 const root=run.resumeBundle?.missionState||{};
 const mission=clone(root.currentMissionData||root);
 const flight=control.flight?.missionRecord||{};
 const failed=flight.missionFailed===true||flight.missionCargoOutcome?.failed===true||control.cargo?.summary?.failed===true;
 const endedAt=Number(flight.createdAt||flight.endTs)||now;
 const record={missionId:run.missionId,completionId:`${run.missionId}-${Math.round(endedAt)}`,endedAt,
  result:failed?'failed':'completed',failed,cargo:flight.missionCargoOutcome||{failed},
  privateOutingEvidence:privateReturn.completionEvidence(flight,{atTarget:control.flight?.destination?.atDestination===true,groundStill:control.flags.groundStill===true})};
 mission.charterHeardSpeech=control.voice?.clubHistory || [];
 const api=service([],now);
 const result=api.create(mission,record.cargo,{source:'tracker-confirmed-completion',completionRecord:record});
 return {result,requests:api.requests()};
}
// A charter/reporter return offer without a stored stay gets its retrospective written by the tracker.
function needsRecap(req) {const c=charterContinuation.context(req);return !!c&&req.status==='pending'&&!charterContinuation.validateDraft(c.experience,c);}
// Prewrite while deboarding: same request id as the later real offer. Only the stay text is
// written early; whether an offer exists is still decided by createForCompletedRun at close.
// Touchdown near the target is reported by the same trigger that prewarms the farewell voice.
const RECAP_PREVIEW_PHASES=/^(end_unloading|end_ready|closing)$/;
const RECAP_TOUCHDOWN_PHASES=/^(active|enroute|on_task|return_leg|end_unloading|end_ready|closing)$/;
function previewRecapRequest(run,control,now=Date.now(),hint={}) {
 if(run?.executionAuthority!=='tracker'||control?.cargo?.summary?.failed===true)return null;
 const phase=String(control?.phase||'');
 if(hint.touchdown===true?!RECAP_TOUCHDOWN_PHASES.test(phase):(!RECAP_PREVIEW_PHASES.test(phase)||control.flight?.destination?.atDestination!==true))return null;
 const root=run.resumeBundle?.missionState||{};
 const mission=clone(root.currentMissionData||root);
 // The prewarmed farewell is the last thing the passenger says on arrival: continuity for the stay.
 const farewell=typeof hint.farewellText==='string'?hint.farewellText.trim().slice(0,600):'';
 mission.charterHeardSpeech=farewell?routeVoice.rememberSpeech(control.voice?.clubHistory||[],'arrival-farewell',farewell):(control.voice?.clubHistory||[]);
 const req=charterContinuation.request(mission,{missionId:run.missionId,completionId:`${run.missionId}-preview`,endedAt:now,result:'completed',
  privateOutingEvidence:{flown:true,atTarget:true,groundStill:true}},now);
 return req&&needsRecap(req)?req:null;
}
function mergeRequests(remote,incoming,now=Date.now()) {const api=service(remote,now);api.merge(incoming);return api.requests();}
module.exports={createForCompletedRun,mergeRequests,needsRecap,previewRecapRequest,service};
