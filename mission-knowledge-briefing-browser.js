(function(root){
'use strict';
const core=()=>root.MissionKnowledgeBriefingCore;
function enabled({isPOI=true,profileId,aiModeEnabled=true,followup=false,planning=false,bush=false,category=''}={}){try{return localStorage.getItem('ga_knowledge_briefing_v1')!=='off'&&isPOI&&!!core().profiles[profileId]&&aiModeEnabled&&!followup&&!planning&&!bush&&category!=='chain';}catch{return false;}}
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
 if(!knowledge)throw Error('Für dieses Wissensziel fehlen eindeutig zugeordnete Quellenfakten. Bitte ein anderes Ziel wählen.');
 const knowledgeFacts=[...knowledge.facts,...knowledge.extraFacts].map((f,i)=>({id:'knowledge-'+i,fact:f.text,topic:f.topic||'general',source:knowledge.sourceUrl}));
 return {...c,profileId,knowledgeContext:knowledge,knowledgeFacts};
}
async function json(prompt){const result=await fetchGeminiJsonWithFallback(prompt,getSelectedAiApiKey(),{promptVersion:core().PROMPT_VERSION,timeoutMs:40000});if(!result?.parsed)throw Error('Der Wissensflug konnte nicht erstellt werden.');return result.parsed;}
function capacity(){if(!(getMissionAircraftCapabilitySnapshot().passengerCapacity>=1))throw Error('Für den Wissensflug ist ein freier Passagierplatz nötig.');}
async function choices(candidates,dispatch){capacity();const profileId=dispatch.profileId||dispatch.profile?.id;const selected=candidates.slice(0,3);const results=await Promise.allSettled(selected.map(p=>context(p,profileId)));dispatch.ensureAlive?.();const available=results.flatMap((r,i)=>r.status==='fulfilled'?[{context:r.value,poi:selected[i]}]:[]);if(!available.length)throw Error('Für die ausgewählten Wissensziele fehlen eindeutig zugeordnete Quellenfakten.');const contexts=available.map(r=>r.context);const recent=core().history(localStorage),raw=await json(core().ideaPrompt(contexts.map(c=>core().frame(c,recent))));dispatch.ensureAlive?.();return contexts.map((c,i)=>{const idea=core().readIdea(raw,c),poi=available[i].poi;return normalizeMissionProposalChoice({id:c.id+'-'+Date.now(),mode:'poi',profileId,selectedCategory:poi.poiCategory||dispatch.selectedPoiCategory,requestedCategory:dispatch.requestedPoiCategory||dispatch.selectedPoiCategory,target:missionProposalCompactTarget(poi,'poi'),title:idea.focus,description:idea.situation,subtitle:idea.person.role,paxText:'1 PAX ('+idea.person.role+')',cargoText:'Kamera, Notizen und kleines Tagesgepäck (8 lbs)',routeLabel:missionProposalFormatRoute(dispatch.start,poi,'poi').label,knowledgeProposal:{schema:'knowledge-proposal.v1',start:root.MissionPoiBriefingSharedCore.point(dispatch.start),context:c,idea}});});}
async function story({start,dest,profileId,proposal,contract={},terrainEnvelope=null,ensureAlive}){capacity();let c,idea;
 if(proposal){if(proposal.schema!=='knowledge-proposal.v1'||proposal.context?.profileId!==profileId||!root.MissionPoiBriefingSharedCore.samePoint(proposal.start,start)||!root.MissionPoiBriefingSharedCore.samePoint(proposal.context?.target,dest))throw Error('Die Wissensidee passt nicht zur gewählten Route.');c={...proposal.context,terrainEnvelope};idea=core().validateIdea(proposal.idea,c);}else{c=await context(dest,profileId,terrainEnvelope);ensureAlive?.();idea=core().readIdea(await json(core().ideaPrompt([core().frame(c,core().history(localStorage))])),c);}
 const shared=root.MissionPoiBriefingSharedCore,flight=shared.prepareFlight(contract),recent=core().history(localStorage);const raw=await json(core().writerPrompt(c,idea,recent,flight));ensureAlive?.();const {flightBriefing:weatherTemplate,...narrative}=raw;const resolved=root.MissionCharterIdeasCore.resolveReferences(narrative,flight.bindings);if(!resolved)throw Error('Unbekannte Flugreferenz im Wissensbriefing.');const written=core().validateWriter(resolved,idea,c);Object.assign(written,shared.resolveWeather(weatherTemplate,flight.context));return core().mission(idea,written,c,contract);
}
root.MissionKnowledgeBriefingBrowser={enabled,context,choices,story};
})(window);
