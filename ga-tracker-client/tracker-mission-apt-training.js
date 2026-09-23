'use strict';
// APT owns destination/landing. Only the exercise procedure is shared with POI.
const training = require('./tracker-mission-training-runtime.js');
const {canonicalStringify} = require('../mission-execution-core.js');
const clone = value => JSON.parse(JSON.stringify(value));
function validateRecipe(recipe) {
  if (!recipe || recipe.schema !== 'ga.mission-training-execution-recipe.v1' || recipe.version !== 1
      || recipe.missionMode !== 'APT' || !training.DOMAINS.includes(recipe.taskDomain)) return 'apt_training_recipe_invalid';
  if (!recipe.missionId || ![recipe.home,recipe.target].every(p=>p && Number.isFinite(p.lat) && Number.isFinite(p.lon ?? p.lng))) return 'apt_training_location_invalid';
  const ctx=recipe.voiceContext;
  if(ctx?.schema!=='ga.mission-training-authority-context.v1'||ctx.version!==1||ctx.missionMode!=='APT'||ctx.missionId!==recipe.missionId||ctx.taskDomain!==recipe.taskDomain)return 'apt_training_context_invalid';
  return training.validate(recipe);
}
function validateBundle(bundle) {
  const md=bundle?.missionState?.currentMissionData || bundle?.missionState || {};
  const pax=bundle?.missionState?.activePassenger || md.passenger || {};
  const required=!!pax.trainingPlan || training.DOMAINS.includes(pax.taskDomain || md.taskDomain || md.missionContract?.taskDomain);
  const recipe=bundle?.executionTrainingRecipe;
  if(!recipe)return required?'apt_training_recipe_missing':null;
  if(recipe.missionId!==bundle.missionId)return 'apt_training_mission_mismatch';
  return validateRecipe(recipe);
}
function project(task) {
  return task ? {guidance:task.state.guidance,progress:task.state.progress,
    summary:training.summary(task.state.flight),suspended:task.suspended===true} : null;
}
function action(recipe,previous,intent,now) {
  if(!previous)throw Error('training_not_active');
  const task=clone(previous), result=training.action(recipe,task.state,intent,now);
  task.state=result.state;task.sequence++;task.observedAt=Math.max(now,task.observedAt+1);
  return {trainingTask:task,voiceEffects:result.voices.map(c=>({...c,aptTraining:true})),action:intent};
}
function createDriver({authorityManager,applySystemEvent}) {
  let runId=null,base=null,task=null,voices=[],dirty=false,recovered=false;
  const context=()=>{
    const snapshot=authorityManager.getExecutionSnapshot();
    const recipe=authorityManager.getExecutionTrainingRecipe?.();
    if(snapshot?.recipe!=='apt'||snapshot.executionAuthority!=='tracker'||!snapshot.state.flags.active
        ||snapshot.state.flags.closingPending||snapshot.state.flags.farewellStarted||!recipe){runId=null;task=null;dirty=false;voices=[];return null;}
    const error=validateRecipe(recipe);if(error)return {error};
    const token=canonicalStringify(snapshot.state.trainingTask || null);
    if(runId!==snapshot.runId||base!==token){
      const freshRun=runId!==snapshot.runId;
      task=snapshot.state.trainingTask?clone(snapshot.state.trainingTask):{schema:'ga.tracker-apt-training.v1',missionId:snapshot.missionId,sequence:0,observedAt:0,suspended:false,state:training.createState(recipe)};
      runId=snapshot.runId;base=token;voices=[];dirty=false;recovered=freshRun&&!!snapshot.state.trainingTask;
    }
    return {snapshot,recipe};
  };
  const flush=()=>{
    const ctx=context();if(!ctx)return {ok:true,status:'ignored'};if(ctx.error)return {ok:false,error:ctx.error};
    if(!dirty)return {ok:true,status:'noop'};
    const next=clone(task);next.sequence=Number(ctx.snapshot.state.trainingTask?.sequence||0)+1;
    next.observedAt=Math.max(next.observedAt,Number(ctx.snapshot.state.trainingTask?.observedAt||0)+1);
    const result=applySystemEvent({missionId:ctx.snapshot.missionId,runId:ctx.snapshot.runId,expectedRevision:ctx.snapshot.authorityRevision,
      type:'APT_TRAINING_OBSERVED',eventId:`apt-training:${next.sequence}:${next.observedAt}`,payload:{trainingTask:next,voiceEffects:voices}});
    if(result.ok){task=next;base=canonicalStringify(next);voices=[];dirty=false;}
    return result;
  };
  const observeTelemetry=sample=>{
    const ctx=context();if(!ctx)return {ok:true,status:'ignored'};if(ctx.error)return {ok:false,error:ctx.error};
    const at=Number(sample?.observedAt)||Date.now();
    if(at<=task.observedAt)return {ok:true,status:'ignored'};
    const normalized={...sample,observedAt:at,altFt:sample?.altFt??sample?.mslFt??sample?.alt,hdg:sample?.hdg??sample?.headingDeg};
    const suspended=sample?.simPaused===true||sample?.inMenuOrMap===true||sample?.onGround!==false
      ||sample?.slewActive===true||sample?.slewMode===true||sample?.isSlewActive===true
      ||!Number.isFinite(normalized.lat)||!Number.isFinite(normalized.lon)||!Number.isFinite(normalized.altFt);
    const previousSuspended=task.suspended;
    if(recovered){training.pause(ctx.recipe,task.state,at,'Tracker wieder verbunden. Aktuellen Durchgang neu stabilisieren und starten.');recovered=false;}
    if(suspended){training.pause(ctx.recipe,task.state,at);task.suspended=true;}
    else {const result=training.observe(ctx.recipe,task.state,normalized);task.state=result.state;task.suspended=false;voices.push(...result.voices.map(c=>({...c,aptTraining:true})));}
    task.observedAt=at;dirty=true;
    return voices.length||previousSuspended!==task.suspended||!ctx.snapshot.state.trainingTask||at-ctx.snapshot.state.trainingTask.observedAt>=1000
      ?flush():{ok:true,status:'buffered'};
  };
  return {flush,observeTelemetry,disconnect:()=>observeTelemetry({observedAt:Date.now(),simPaused:true})};
}
module.exports={validateRecipe,validateBundle,project,action,createDriver};
