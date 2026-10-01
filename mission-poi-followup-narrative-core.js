// Additive narrative memory. Existing outcome rules remain the sole follow-up authority.
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MissionPoiFollowupNarrativeCore=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const SCHEMA='ga.followup-narrative.v1';
const validText=(s,n)=>typeof s==='string'&&s.trim().length>0&&s.length<=n;
const clone=x=>x==null?null:JSON.parse(JSON.stringify(x));
function memory(raw){
 if(!raw||!validText(raw.summary,700)||!Array.isArray(raw.participants)||raw.participants.length>6||raw.participants.some(p=>!validText(p.name,120)||!validText(p.role,160))||!Array.isArray(raw.openQuestions)||raw.openQuestions.length>4||raw.openQuestions.some(s=>!validText(s,220))||!Array.isArray(raw.possibleContinuations)||raw.possibleContinuations.length>3||raw.possibleContinuations.some(s=>!validText(s,220)))return null;
 const out={summary:raw.summary.trim(),participants:raw.participants.map(p=>({name:p.name.trim(),role:p.role.trim()})),client:raw.client&&validText(raw.client.name,160)?{name:raw.client.name.trim(),kind:validText(raw.client.kind,80)?raw.client.kind:''}:null,openQuestions:raw.openQuestions.map(s=>s.trim()),possibleContinuations:raw.possibleContinuations.map(s=>s.trim())};
 return JSON.stringify(out).length<=4000?out:null;
}
function normalize(raw){
 if(raw?.schema!==SCHEMA)return null;
 try{if(JSON.stringify(raw).length>8000)return null;}catch(_){return null;}
 const m=memory(raw.memory);if(!m)return null;
 return {schema:SCHEMA,status:raw.status==='writer-memory'?'writer-memory':'legacy-context',memory:m,identity:clone(raw.identity||null),completion:clone(raw.completion||null),nextAssignment:clone(raw.nextAssignment||null)};
}
function forWriter(raw){const n=normalize(raw);return n?{status:n.status,memory:n.memory,identity:n.identity,completion:n.completion,nextAssignment:n.nextAssignment}:null;}
function draft(raw,missionId=null){const m=memory(raw);return m?{schema:SCHEMA,status:'writer-memory',identity:{sourceMissionId:missionId},memory:m,completion:null,nextAssignment:null}:null;}
function complete(md,config,record,refs={}){
 // Caller is the existing confirmed-completion path. This memory cannot authorize a request.
 if(record&&(record.failed===true||record.result!=='completed'||(md?.missionId&&record.missionId&&md.missionId!==record.missionId)))return null;
 const stored=normalize(md?.followUpNarrative||md?.missionContract?.followUpNarrative||md?.missionContractV4?.followUpNarrative);
 const inherited=normalize(md?.followUpContinuation?.narrativeMemory?.followUpNarrative);
 const previous=stored;
 const fallback={client:md?.mappingBriefing?.idea?.client||md?.infraBriefing?.idea?.client||md?.poiBriefing?.idea?.client||inherited?.memory?.client||null,summary:String(md?.infraBriefing?.writerMemory||md?.poiBriefing?.writerMemory||md?.story||md?.missionStory||'').slice(0,700),participants:md?.passenger?.name?[{name:md.passenger.name,role:md.passenger.role||'Fachperson'}]:[],openQuestions:[],possibleContinuations:[]};
 const m=previous?.memory||memory(fallback);if(!m)return null;
 return {schema:SCHEMA,status:previous?.status||'legacy-context',memory:clone(m),identity:{sourceMissionId:md.missionId||record?.missionId||null,completionId:record?.completionId||null,chainId:config.chain?.id||null,parentRequestId:md.followUpRequestId||null,step:config.chain?.previousStep||md.followUpContinuation?.chain?.step||null},completion:record?{result:'completed',endedAt:record.endedAt||null,cargoFailed:false}:null,nextAssignment:{profileId:config.followUpProfileId||null,kind:config.followUpKind||null,purpose:config.followUpLabel||null,targetRef:clone(refs.targetRef||config.targetRef||null),temporalContext:clone(config.temporalContext||null)}};
}
function context(req){
 if(!req?.poiFollowUp&&req?.route?.targetRef?.kind!=='poi')return null;
 const accepted=forWriter(req.narrativeMemory?.followUpNarrative);
 return {requestId:req.id||null,sourceMissionId:req.sourceMissionId||null,chain:clone(req.chain||null),targetRef:clone(req.route?.targetRef||null),temporalContext:clone(req.temporalContext||null),assignment:{profileId:req.followUpProfileId||null,kind:req.followUpKind||null,label:req.followUpLabel||null},knownFinding:clone(req.infraInspectionOutcome||req.narrativeMemory?.infraInspectionOutcome||null),narrative:accepted,legacySummary:accepted?null:String(req.source?.story||req.narrativeMemory?.sourceOutcomeText||'').slice(0,700)};
}
function continuationFields(req){return {chain:clone(req?.chain||null),chainStep:req?.chain?.step||null,narrativeMemory:clone(req?.narrativeMemory||null),temporalContext:clone(req?.temporalContext||null)};}
function ownsContinuation(m){return m?.poiContinuationBriefing?.schema==='poi-continuation-briefing.v1'&&['inspection_infra','media_photo'].includes(m.passenger?.taskDomain);}
function voiceContext(b){if(b?.schema!=='poi-continuation-briefing.v1')return '';return `POI-FOLGEAUFTRAG: ${JSON.stringify(b.continuation)}. AUFTRAGSGEDÄCHTNIS: ${JSON.stringify(b.writerMemory||null)}. Die bekannte Geschichte wird fortgesetzt. Vergangener Befund und neuer Auftrag bleiben getrennt. Keine erfundene Reparatur, Auswertung oder erfolgreiche Flugleistung vor dem zugehörigen Abschluss. Die bestehenden Aufgaben und Ergebnisregeln bleiben zuständig; die mögliche Fortsetzung im Gedächtnis ist keine Freigabe.`;}
return {SCHEMA,memory,normalize,forWriter,draft,complete,context,continuationFields,ownsContinuation,voiceContext};
});
