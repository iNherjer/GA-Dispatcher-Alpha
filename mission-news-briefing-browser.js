(function(root){
'use strict';
const core=()=>root.MissionNewsBriefingCore;
const FLAG='ga_news_briefing_v1';
function sceneCapabilities(){
 const catalog=root.MISSION_SCENE_ASSETS;if(!catalog)return null;
 const compact=rows=>Object.fromEntries(Object.entries(rows||{}).map(([id,spec])=>[id,{label:spec.label,roles:Array.isArray(spec.roles)?[...spec.roles]:[],...(Array.isArray(spec.missionTags)?{tags:[...spec.missionTags]}:{})}]));
 return {version:catalog.version,kinds:compact(Object.fromEntries(Object.entries(catalog.targetSceneKinds||{}).filter(([,v])=>v.useFor?.includes('news_coverage')))),features:compact(catalog.targetSceneFeatures)};
}
function enabled({isPOI=true,profileId,category='',aiModeEnabled=true,followup=false,planning=false,bush=false}={}) {
 try{return localStorage.getItem(FLAG)!=='off'&&isPOI&&profileId==='news_coverage'&&aiModeEnabled&&!followup&&!planning&&!bush&&category!=='chain';}catch{return false;}
}
async function context(dest,terrainEnvelope=null) {
 const c=await root.MissionPoiBriefingSharedBrowser.context(dest,terrainEnvelope);
 const category=String(dest.poiCategory||dest.category||'road');
 return {...c,sceneCapabilities:sceneCapabilities(),targetCategory:category,targetFacts:[...c.targetFacts,{id:'target-selection-category',fact:'Ausgewählte Zielkategorie: '+category,source:dest.poiSource||'existing-poi-picker'}],task:{recipe:'poi_on_task',passengers:1,return:'home'}};
}
async function json(prompt) {
 const result=await fetchGeminiJsonWithFallback(prompt,getSelectedAiApiKey(),{promptVersion:core().PROMPT_VERSION,timeoutMs:40000});
 if(!result?.parsed)throw Error('Der POI-Reporterauftrag konnte nicht erstellt werden. Bitte erneut versuchen.');
 return result.parsed;
}
function capacity() {if(!(getMissionAircraftCapabilitySnapshot().passengerCapacity>=1))throw Error('Für den Reporterauftrag ist ein freier Passagierplatz erforderlich.');}
async function choices(candidates,dispatch) {
 capacity();
 if(candidates.some(p=>p.poiChain))throw Error('Ketten verwenden ihren bestehenden Ablauf.');
 const selected=candidates.slice(0,3);if(!selected.length)return [];
 const contexts=await Promise.all(selected.map(p=>context(p)));dispatch.ensureAlive?.();
 const recent=core().history(localStorage),raw=await json(core().ideaPrompt(contexts.map(c=>core().frame(c,recent))));dispatch.ensureAlive?.();
 return contexts.map((c,i)=>{
  const idea=core().readIdea(raw,c),poi=selected[i];
  return normalizeMissionProposalChoice({id:c.id+'-'+Date.now(),mode:'poi',profileId:'news_coverage',selectedCategory:poi.poiCategory||dispatch.selectedPoiCategory,requestedCategory:dispatch.requestedPoiCategory||dispatch.selectedPoiCategory,target:missionProposalCompactTarget(poi,'poi'),title:idea.headline,description:idea.situation,subtitle:idea.person.role,paxText:'1 PAX ('+idea.person.role+')',cargoText:'Kamera- und Audio-Set (32 lbs)',routeLabel:missionProposalFormatRoute(dispatch.start,poi,'poi').label,newsProposal:{schema:'news-proposal.v1',start:root.MissionPoiBriefingSharedCore.point(dispatch.start),context:c,idea}});
 });
}
async function story({start,dest,proposal,contract={},terrainEnvelope=null,ensureAlive}) {
 capacity();
 if(dest?.poiChain)throw Error('Ketten verwenden ihren bestehenden Ablauf.');
 let c,idea;
 if(proposal) {
  if(proposal.schema!=='news-proposal.v1'||!root.MissionPoiBriefingSharedCore.samePoint(proposal.start,start)||!root.MissionPoiBriefingSharedCore.samePoint(proposal.context?.target,dest))throw Error('Die Reporteridee passt nicht mehr zur gewählten Route. Bitte neu auswählen.');
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
root.MissionNewsBriefingBrowser={enabled,choices,story,context};
})(window);
