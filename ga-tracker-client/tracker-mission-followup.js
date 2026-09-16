'use strict';
// Same service and domain functions as the App, with explicit non-UI hosts.
const {createFollowupService}=require('../mission-followup.js');
const {createInfraOutcomeService}=require('../mission-infra-outcome-core.js');
const privateReturn=require('../mission-private-return-core.js');
const clone=value=>JSON.parse(JSON.stringify(value));
function service(requests=[],now=Date.now()) {
 const storage=new Map([['ga_followup_requests_v1',JSON.stringify(requests)]]);
 const window={MissionPrivateReturnCore:{...privateReturn,request:(mission,record)=>privateReturn.request(mission,record,now)}};
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
 const api=service([],now);
 const result=api.create(mission,record.cargo,{source:'tracker-confirmed-completion',completionRecord:record});
 return {result,requests:api.requests()};
}
function mergeRequests(remote,incoming,now=Date.now()) {const api=service(remote,now);api.merge(incoming);return api.requests();}
module.exports={createForCompletedRun,mergeRequests,service};
