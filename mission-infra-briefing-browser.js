(function(root){
'use strict';
const core=()=>root.MissionInfraBriefingCore;
const FLAG='ga_infra_briefing_v1';
function enabled({isPOI=true,profileId,category='',aiModeEnabled=true,followup=false,planning=false,bush=false}={}) {
 try{return localStorage.getItem(FLAG)!=='off'&&isPOI&&profileId==='inspection_infra'&&aiModeEnabled&&!followup&&!planning&&!bush&&category!=='chain';}catch{return false;}
}
async function context(dest,terrainEnvelope=null) {
 const base=await root.MissionPoiBriefingSharedBrowser.context(dest,terrainEnvelope);
 const c=await root.MissionPoiBriefingSharedBrowser.cachedEnvironment?.(base)||base;
 const category=String(dest.poiCategory||dest.category||'infrastructure');
 return {...c,targetCategory:category,targetFacts:[...c.targetFacts,{id:'target-selection-category',fact:'Ausgewählte Zielkategorie: '+category,source:dest.poiSource||'existing-poi-picker'}],task:{recipe:'poi_on_task',passengers:1,return:'home'}};
}
async function json(prompt) {
 const result=await fetchGeminiJsonWithFallback(prompt,getSelectedAiApiKey(),{promptVersion:core().PROMPT_VERSION,timeoutMs:40000});
 if(!result?.parsed)throw(root.createAiJsonFailure?root.createAiJsonFailure(result,'Der POI-Inspektionsauftrag'):Error('Der POI-Inspektionsauftrag konnte nicht erstellt werden. Bitte erneut versuchen.'));
 return result.parsed;
}
function capacity() {if(!(getMissionAircraftCapabilitySnapshot().passengerCapacity>=1))throw Error('Für den Inspektionsauftrag ist ein freier Passagierplatz erforderlich.');}
async function choices(candidates,dispatch) {
 capacity();
 if(candidates.some(p=>p.poiChain))throw Error('Ketten verwenden ihren bestehenden Inspektionsablauf.');
 const selected=candidates.slice(0,3);if(!selected.length)return [];
 const contexts=await Promise.all(selected.map(p=>context(p)));dispatch.ensureAlive?.();
 const recent=core().history(localStorage),raw=await json(core().ideaPrompt(contexts.map(c=>core().frame(c,recent))));dispatch.ensureAlive?.();
 return contexts.map((c,i)=>{
  const idea=core().readIdea(raw,c),poi=selected[i];
  return normalizeMissionProposalChoice({id:c.id+'-'+Date.now(),mode:'poi',profileId:'inspection_infra',selectedCategory:poi.poiCategory||dispatch.selectedPoiCategory,requestedCategory:dispatch.requestedPoiCategory||dispatch.selectedPoiCategory,target:missionProposalCompactTarget(poi,'poi'),title:idea.inspectionFocus,description:idea.situation,subtitle:idea.person.role,paxText:'1 PAX ('+idea.person.role+')',cargoText:'Inspektionskamera und Tablet (26 lbs)',routeLabel:missionProposalFormatRoute(dispatch.start,poi,'poi').label,infraProposal:{schema:'infra-proposal.v1',start:root.MissionPoiBriefingSharedCore.point(dispatch.start),context:c,idea}});
 });
}
async function story({start,dest,proposal,contract={},terrainEnvelope=null,ensureAlive}) {
 capacity();
 if(dest?.poiChain)throw Error('Ketten verwenden ihren bestehenden Inspektionsablauf.');
 let c,idea,environmentReady=false;
 if(proposal) {
  if(proposal.schema!=='infra-proposal.v1'||!root.MissionPoiBriefingSharedCore.samePoint(proposal.start,start)||!root.MissionPoiBriefingSharedCore.samePoint(proposal.context?.target,dest))throw Error('Die Inspektionsidee passt nicht mehr zur gewählten Route. Bitte neu auswählen.');
  c={...proposal.context,terrainEnvelope};idea=core().validateIdea(proposal.idea,c);
 }else{
  c=await context(dest,terrainEnvelope);ensureAlive?.();
  c=await root.MissionPoiBriefingSharedBrowser.enrichSelected(c,ensureAlive);environmentReady=true;
  const raw=await json(core().ideaPrompt([core().frame(c,core().history(localStorage))]));ensureAlive?.();
  idea=core().readIdea(raw,c);
 }
 // Enrich only the selected mission, not all three picker candidates.
 if(!environmentReady)c=await root.MissionPoiBriefingSharedBrowser.enrichSelected(c,ensureAlive);
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
root.MissionInfraBriefingBrowser={enabled,choices,story,context};
})(window);
