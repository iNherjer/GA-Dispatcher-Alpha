(function(root){
'use strict';
const core=()=>root.MissionPoiBriefingCore;
const FLAG='ga_poi_briefing_v1';
function enabled({isPOI=true,profileId,category='',aiModeEnabled=true,followup=false,planning=false,bush=false}={}) {
 try{return localStorage.getItem(FLAG)!=='off'&&isPOI&&profileId==='media_photo'&&aiModeEnabled&&!followup&&!planning&&!bush&&category!=='chain';}catch{return false;}
}
async function context(dest,terrainEnvelope=null) {
 return {...await root.MissionPoiBriefingSharedBrowser.context(dest,terrainEnvelope),task:{recipe:'poi_on_task',passengers:1,return:'home'}};
}
async function json(prompt) {
 const result=await fetchGeminiJsonWithFallback(prompt,getSelectedAiApiKey(),{promptVersion:core().PROMPT_VERSION,timeoutMs:40000});
 if(!result?.parsed)throw(root.createAiJsonFailure?root.createAiJsonFailure(result,'Der POI-Fotoauftrag'):Error('Der POI-Fotoauftrag konnte nicht erstellt werden. Bitte erneut versuchen.'));
 return result.parsed;
}
function capacity() {if(!(getMissionAircraftCapabilitySnapshot().passengerCapacity>=1))throw Error('Für den Fotoauftrag ist ein freier Passagierplatz erforderlich.');}
async function choices(candidates,dispatch) {
 capacity();
 const selected=candidates.slice(0,3);if(!selected.length)return [];
 const contexts=await Promise.all(selected.map(p=>context(p)));dispatch.ensureAlive?.();
 const recent=core().history(localStorage),raw=await json(core().ideaPrompt(contexts.map(c=>core().frame(c,recent))));dispatch.ensureAlive?.();
 return contexts.map((c,i)=>{
  const idea=core().readIdea(raw,c),poi=selected[i];
  return normalizeMissionProposalChoice({id:c.id+'-'+Date.now(),mode:'poi',profileId:'media_photo',selectedCategory:poi.poiCategory||dispatch.selectedPoiCategory,requestedCategory:dispatch.requestedPoiCategory||dispatch.selectedPoiCategory,target:missionProposalCompactTarget(poi,'poi'),title:idea.intent,description:idea.situation,subtitle:idea.person.role,paxText:'1 PAX ('+idea.person.role+')',cargoText:'Foto-/Videoausrüstung (12 lbs)',routeLabel:missionProposalFormatRoute(dispatch.start,poi,'poi').label,poiProposal:{schema:'poi-photo-proposal.v1',start:core().point(dispatch.start),context:c,idea}});
 });
}
async function story({start,dest,proposal,contract={},terrainEnvelope=null,ensureAlive}) {
 capacity();
 let c,idea;
 if(proposal) {
  if(proposal.schema!=='poi-photo-proposal.v1'||!core().samePoint(proposal.start,start)||!core().samePoint(proposal.context?.target,dest))throw Error('Die Fotoidee passt nicht mehr zur gewählten Route. Bitte neu auswählen.');
  c={...proposal.context,terrainEnvelope};idea=core().validateIdea(proposal.idea,c);
 }else{
  c=await context(dest,terrainEnvelope);ensureAlive?.();
  const raw=await json(core().ideaPrompt([core().frame(c,core().history(localStorage))]));ensureAlive?.();
  idea=core().readIdea(raw,c);
 }
 // Enrich only the selected mission, not all three picker candidates.
 c=await root.MissionPoiBriefingSharedBrowser.enrichSelected(c,ensureAlive);
 const shared=root.MissionPoiBriefingSharedCore,flight=shared.prepareFlight(contract),flightContext=flight.context,recent=core().history(localStorage);
 const raw=await json(core().writerPrompt(c,idea,recent,flight));ensureAlive?.();
 // Weather validation must never discard a valid narrative.
 const {flightBriefing:weatherTemplate,...narrative}=raw;
 const resolved=root.MissionCharterIdeasCore.resolveReferences(narrative,flight.bindings);
 if(!resolved)throw Error('Das POI-Briefing enthält unbekannte Flugreferenzen.');
 const written=core().validateWriter(resolved,idea,c);
 Object.assign(written,shared.resolveWeather(weatherTemplate,flightContext));
 const m=core().mission(idea,written,c,contract);
 m._missionWriterV4Debug.weatherSnapshot=flightContext.weather;
 m._missionWriterV4Debug.historyCount=recent.length;
 return m;
}
root.MissionPoiBriefingBrowser={enabled,choices,story,context};
})(window);
