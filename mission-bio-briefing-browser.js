(function(root){
'use strict';
const core=()=>root.MissionBioBriefingCore;
const FLAG='ga_bio_briefing_v1';
function sceneCapabilities(){
 const c=root.MISSION_SCENE_ASSETS;if(!c)return null;
 const genericAnimals=new Set(['waterfowl','wildlife_animals','animal_herd']);
 return {animalAvailabilityPolicy:c.animalAvailabilityPolicy,features:Object.fromEntries(Object.entries(c.targetSceneFeatures||{}).filter(([id])=>!genericAnimals.has(id)).map(([id,s])=>[id,{label:s.label,roles:s.roles,placementSurfaces:s.placementSurfaces,modelsByRole:Object.fromEntries((s.roles||[]).map(role=>[role,c.roles?.[role]||[]])),...(s.animal?{animal:true,maxGroupCount:20,speciesName:s.speciesName,sourceNotes:s.sourceNotes}:{})}]))};
}
function enabled({isPOI=true,profileId,category='',aiModeEnabled=true,followup=false,planning=false,bush=false}={}) {
 try{return localStorage.getItem(FLAG)!=='off'&&isPOI&&profileId==='science_bio'&&aiModeEnabled&&!followup&&!planning&&!bush&&category!=='chain';}catch{return false;}
}
async function context(dest,terrainEnvelope=null) {
 const initial=await root.MissionPoiBriefingSharedBrowser.context(dest,terrainEnvelope);
 const category=String(dest.poiCategory||dest.category||'nature').toLowerCase();
 if(!['water','forest','mountain'].includes(category))throw Error('Der Biologie-Pfad benötigt ein naturbezogenes Ziel aus dem bestehenden POI-Pool.');
 const c=await root.MissionPoiBriefingSharedBrowser.enrichSelected(initial);
 const tags=dest.poiLookup?.selectedTags||dest.tags||{};
 const explicitTags=Object.fromEntries(['natural','landuse','water','waterway','wetland','leisure','tourism','zoo','boundary','protect_class'].filter(k=>typeof tags[k]==='string'&&tags[k].trim()).map(k=>[k,tags[k].trim()]));
 const targetSelection={category,source:dest.poiSource||'existing-poi-picker',tags:explicitTags,evidence:Object.keys(explicitTags).length?'picker-category-and-explicit-tags':'category-only'};
 return {...c,targetSelection,sceneCapabilities:sceneCapabilities(),targetCategory:category,targetFacts:[...c.targetFacts,...(Object.keys(explicitTags).length?[{id:'target-selection-tags',fact:'Explizite Tags am ausgewählten POI: '+JSON.stringify(explicitTags),source:targetSelection.source}]:[]),{id:'target-selection-category',fact:'Ausgewählte Zielkategorie: '+category,source:dest.poiSource||'existing-poi-picker'}],task:{recipe:'poi_on_task',passengers:1,return:'home'}};
}
async function json(prompt) {
 const result=await fetchGeminiJsonWithFallback(prompt,getSelectedAiApiKey(),{promptVersion:core().PROMPT_VERSION,timeoutMs:40000});
 if(!result?.parsed)throw Error(root.formatAiJsonFailure?root.formatAiJsonFailure(result,'Der POI-Studienauftrag'):'Der POI-Studienauftrag konnte nicht erstellt werden. Bitte erneut versuchen.');
 return result.parsed;
}
function capacity() {if(!(getMissionAircraftCapabilitySnapshot().passengerCapacity>=1))throw Error('Für den Studienauftrag ist ein freier Passagierplatz erforderlich.');}
async function choices(candidates,dispatch) {
 capacity();
 if(candidates.some(p=>p.poiChain))throw Error('Ketten verwenden ihren bestehenden Studienablauf.');
 const selected=candidates.slice(0,3);if(!selected.length)return [];
 const contexts=await Promise.all(selected.map(p=>context(p)));dispatch.ensureAlive?.();
 const recent=core().history(localStorage),raw=await json(core().ideaPrompt(contexts.map(c=>core().frame(c,recent))));dispatch.ensureAlive?.();
 return contexts.map((c,i)=>{
  const idea=core().readIdea(raw,c),poi=selected[i];
  return normalizeMissionProposalChoice({id:c.id+'-'+Date.now(),mode:'poi',profileId:'science_bio',selectedCategory:poi.poiCategory||dispatch.selectedPoiCategory,requestedCategory:dispatch.requestedPoiCategory||dispatch.selectedPoiCategory,target:missionProposalCompactTarget(poi,'poi'),title:idea.studyFocus,description:idea.situation,subtitle:idea.person.role,paxText:'1 PAX ('+idea.person.role+')',cargoText:'Kamera, Feldnotizen und Tablet (18 lbs)',routeLabel:missionProposalFormatRoute(dispatch.start,poi,'poi').label,bioProposal:{schema:'bio-proposal.v1',start:root.MissionPoiBriefingSharedCore.point(dispatch.start),context:c,idea}});
 });
}
async function story({start,dest,proposal,contract={},terrainEnvelope=null,ensureAlive}) {
 capacity();
 if(dest?.poiChain)throw Error('Ketten verwenden ihren bestehenden Studienablauf.');
 let c,idea;
 if(proposal) {
  if(proposal.schema!=='bio-proposal.v1'||!root.MissionPoiBriefingSharedCore.samePoint(proposal.start,start)||!root.MissionPoiBriefingSharedCore.samePoint(proposal.context?.target,dest))throw Error('Die Studienidee passt nicht mehr zur gewählten Route. Bitte neu auswählen.');
  c={...proposal.context,terrainEnvelope};idea=core().validateIdea(proposal.idea,c);
 }else{
  c=await context(dest,terrainEnvelope);ensureAlive?.();
  const raw=await json(core().ideaPrompt([core().frame(c,core().history(localStorage))]));ensureAlive?.();
  idea=core().readIdea(raw,c);
 }
 // Refresh the selected evidence through the shared cache; ideas already saw the mapped environment.
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
root.MissionBioBriefingBrowser={enabled,choices,story,context};
})(window);
