(function(root){
'use strict';
const core=()=>root.MissionKnowledgeBriefingCore;
function enabled({isPOI=true,profileId,aiModeEnabled=true,followup=false,planning=false,bush=false,category=''}={}){try{return localStorage.getItem('ga_knowledge_briefing_v1')!=='off'&&isPOI&&!!core().profiles[profileId]&&aiModeEnabled&&!followup&&!planning&&!bush&&category!=='chain';}catch{return false;}}
async function sightseeingPlaces(dest, target) {
 const place = dest?.tags?.place || dest?.place;
 const settlement = ['city','town','village','suburb'].includes(place) || dest?.poiCategory === 'city';
 if (!settlement || typeof _missionSightseeingFetchNearbyWikiLandmarks !== 'function' || typeof _fetchWikiExtractByTitle !== 'function') return [];
 // Reuse existing transport/ranking, but keep research inside the POI work area.
 let candidates;
 try { candidates = await _missionSightseeingFetchNearbyWikiLandmarks(target.lat, target.lon, target.name, {radiusM:5000,timeoutMs:3500}); } catch {return [];}
 const researched = await Promise.allSettled(candidates.filter(x=>x.title!==target.name).slice(0,3).map(async candidate=>{
  const wiki = await _fetchWikiExtractByTitle(candidate.title,{timeoutMs:3500});
  const coordinate = wiki?.page?.coordinates?.[0];
  if (!coordinate || !wiki.page.fullurl || root.MissionPoiBriefingSharedCore.relation(target,coordinate).distanceM > 5000) return null;
  const facts = _poiKnowledgePickFacts(wiki.extract,4,0).selected;
  const evidence = core().evidence({ok:true,status:'accept',title:wiki.title,exactTitle:wiki.title===candidate.title||wiki.title.startsWith(candidate.title+' ('),sourceUrl:wiki.page.fullurl,distanceKm:0,fetchedAt:new Date().toISOString(),facts}, {name:candidate.title});
  if (!evidence) return null;
  return {name:evidence.title,lat:coordinate.lat,lon:coordinate.lon,source:evidence.sourceUrl,facts:evidence.facts};
 }));
 return researched.flatMap(r=>r.status==='fulfilled'&&r.value?[r.value]:[]).slice(0,2);
}
async function context(dest,profileId,terrainEnvelope=null){
 let c=await root.MissionPoiBriefingSharedBrowser.context(dest,terrainEnvelope);
 c=await root.MissionPoiBriefingSharedBrowser.enrichSelected(c);
 let knowledge=core().evidence(dest.knowledgeContext,c.target);
 if(!knowledge&&typeof _fetchWikiExtractByTitle==='function'){
  const wiki=await _fetchWikiExtractByTitle(c.target.name,{timeoutMs:5000});
  const coordinate=wiki?.page?.coordinates?.[0];
  if(coordinate&&wiki.page.fullurl){
   const selected=_poiKnowledgePickFacts(wiki.extract,8,12);
   knowledge=core().evidence({ok:true,status:'accept',title:wiki.title,exactTitle:wiki.title===c.target.name||wiki.title.startsWith(c.target.name+' ('),sourceUrl:wiki.page.fullurl,fetchedAt:new Date().toISOString(),distanceKm:root.MissionPoiBriefingSharedCore.relation(c.target,coordinate).distanceM/1000,extract:wiki.extract,facts:selected.selected,extraFacts:selected.extra},c.target);
  }
 }
 if(!knowledge&&profileId!=='sightseeing_tour')throw Error('Für dieses Wissensziel fehlen eindeutig zugeordnete Quellenfakten. Bitte ein anderes Ziel wählen.');
 const observationPlaces = profileId==='sightseeing_tour' ? await sightseeingPlaces(dest,c.target) : [];
 const knowledgeFacts=[...(knowledge?.facts||[]),...(knowledge?.extraFacts||[])].map((f,i)=>({id:'knowledge-'+i,fact:f.text,topic:f.topic||'general',source:knowledge?.sourceUrl}));
 for (const [index,p] of observationPlaces.entries()) for (const [j,f] of p.facts.entries()) knowledgeFacts.push({id:`landmark-${index}-${j}`,fact:`${p.name}: ${f.text}`,topic:f.topic||'landmark',source:p.source});
 // The original Tracker facts queue consumes knowledgeContext as well as baseContext.
 // Store researched local facts there, with their own source, for tell-more/restore.
 if (observationPlaces.length) {
  const localFacts=observationPlaces.flatMap(p=>p.facts.map(f=>({...f,text:`${p.name}: ${f.text}`,source:p.source})));
  if (knowledge) knowledge={...knowledge,extraFacts:[...(knowledge.extraFacts||[]),...localFacts]};
 }
 return {...c,profileId,knowledgeContext:knowledge,knowledgeFacts,observationPlaces};
}
async function json(prompt){const result=await fetchGeminiJsonWithFallback(prompt,getSelectedAiApiKey(),{promptVersion:core().PROMPT_VERSION,timeoutMs:40000});if(!result?.parsed)throw(root.createAiJsonFailure?root.createAiJsonFailure(result,'Der Wissensflug'):Error('Der Wissensflug konnte nicht erstellt werden.'));return result.parsed;}
function capacity(){if(!(getMissionAircraftCapabilitySnapshot().passengerCapacity>=1))throw Error('Für den Wissensflug ist ein freier Passagierplatz nötig.');}
async function choices(candidates,dispatch){capacity();const profileId=dispatch.profileId||dispatch.profile?.id;const selected=candidates.slice(0,3);const results=await Promise.allSettled(selected.map(p=>context(p,profileId)));dispatch.ensureAlive?.();const available=results.flatMap((r,i)=>r.status==='fulfilled'?[{context:r.value,poi:selected[i]}]:[]);if(!available.length)throw Error('Für die ausgewählten Wissensziele fehlen eindeutig zugeordnete Quellenfakten.');const contexts=available.map(r=>r.context);const recent=core().history(localStorage),raw=await json(core().ideaPrompt(contexts.map(c=>core().frame(c,recent))));dispatch.ensureAlive?.();return contexts.map((c,i)=>{const idea=core().readIdea(raw,c),poi=available[i].poi;return normalizeMissionProposalChoice({id:c.id+'-'+Date.now(),mode:'poi',profileId,selectedCategory:poi.poiCategory||dispatch.selectedPoiCategory,requestedCategory:dispatch.requestedPoiCategory||dispatch.selectedPoiCategory,target:missionProposalCompactTarget(poi,'poi'),title:idea.focus,description:idea.situation,subtitle:idea.person.role,paxText:'1 PAX ('+idea.person.role+')',cargoText:'Kamera, Notizen und kleines Tagesgepäck (8 lbs)',routeLabel:missionProposalFormatRoute(dispatch.start,poi,'poi').label,knowledgeProposal:{schema:'knowledge-proposal.v1',start:root.MissionPoiBriefingSharedCore.point(dispatch.start),context:c,idea}});});}
async function story({start,dest,profileId,proposal,contract={},terrainEnvelope=null,ensureAlive}){capacity();let c,idea;
 if(proposal){if(proposal.schema!=='knowledge-proposal.v1'||proposal.context?.profileId!==profileId||!root.MissionPoiBriefingSharedCore.samePoint(proposal.start,start)||!root.MissionPoiBriefingSharedCore.samePoint(proposal.context?.target,dest))throw Error('Die Wissensidee passt nicht zur gewählten Route.');c={...proposal.context,terrainEnvelope};idea=core().validateIdea(proposal.idea,c);}else{c=await context(dest,profileId,terrainEnvelope);ensureAlive?.();idea=core().readIdea(await json(core().ideaPrompt([core().frame(c,core().history(localStorage))])),c);}
 const shared=root.MissionPoiBriefingSharedCore,flight=shared.prepareFlight(contract),recent=core().history(localStorage);const raw=await json(core().writerPrompt(c,idea,recent,flight));ensureAlive?.();const {flightBriefing:weatherTemplate,...narrative}=raw;const resolved=root.MissionCharterIdeasCore.resolveReferences(narrative,flight.bindings);if(!resolved)throw Error('Unbekannte Flugreferenz im Wissensbriefing.');const written=core().validateWriter(resolved,idea,c);Object.assign(written,shared.resolveWeather(weatherTemplate,flight.context));return core().mission(idea,written,c,contract);
}
root.MissionKnowledgeBriefingBrowser={enabled,context,choices,story};
})(window);
