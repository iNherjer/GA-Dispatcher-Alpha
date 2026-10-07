(function(root){
'use strict';
const core=()=>root.MissionMappingBriefingCore;
const FLAG='ga_mapping_briefing_v1';
function sceneCapabilities(){
 const catalog=root.MISSION_SCENE_ASSETS;if(!catalog)return null;
 return {features:Object.fromEntries(Object.entries(catalog.targetSceneFeatures||{}).filter(([,spec])=>!spec.animal).map(([id,spec])=>[id,{label:spec.label,roles:spec.roles,placementSurfaces:spec.placementSurfaces,modelsByRole:Object.fromEntries((spec.roles||[]).map(role=>[role,catalog.roles?.[role]||[]]))}]))};
}
function enabled({isPOI=true,profileId,category='',aiModeEnabled=true,followup=false,planning=false,bush=false}={}) {
 try{return localStorage.getItem(FLAG)!=='off'&&isPOI&&profileId==='mapping_survey'&&aiModeEnabled&&!planning&&!bush&&category!=='chain';}catch{return false;}
}
async function context(dest,terrainEnvelope=null) {
 const initial=await root.MissionPoiBriefingSharedBrowser.context(dest,terrainEnvelope);
 const category=String(dest.poiCategory||dest.category||'infrastructure').toLowerCase();
 if(!['infrastructure','industry','rail','road','bridge','dam','telecom','powerline','tower','wind','wind_turbine'].includes(category))throw Error('Der Mapping-Pfad benötigt ein Ziel aus dem bestehenden POI-Pool.');
 const c=await root.MissionPoiBriefingSharedBrowser.enrichSelected(initial);
 const tags=dest.poiLookup?.selectedTags||dest.tags||{};
 const explicitTags=Object.fromEntries(['natural','landuse','water','waterway','man_made','building','bridge','highway','railway','industrial','ele'].filter(k=>typeof tags[k]==='string'&&tags[k].trim()).map(k=>[k,tags[k].trim()]));
 const targetSelection={category,source:dest.poiSource||'existing-poi-picker',tags:explicitTags,evidence:Object.keys(explicitTags).length?'picker-category-and-explicit-tags':'category-only'};
 return {...c,targetSelection,sceneCapabilities:sceneCapabilities(),targetCategory:category,targetFacts:[...c.targetFacts,...(Object.keys(explicitTags).length?[{id:'target-selection-tags',fact:'Explizite Tags am ausgewählten POI: '+JSON.stringify(explicitTags),source:targetSelection.source}]:[]),{id:'target-selection-category',fact:'Ausgewählte Zielkategorie: '+category,source:dest.poiSource||'existing-poi-picker'}],task:{recipe:'survey_pattern',passengers:1,return:'home'}};
}
async function json(prompt) {
 const result=await fetchGeminiJsonWithFallback(prompt,getSelectedAiApiKey(),{promptVersion:core().PROMPT_VERSION,timeoutMs:40000});
 if(!result?.parsed)throw(root.createAiJsonFailure?root.createAiJsonFailure(result,'Der POI-Mapping-Auftrag'):Error('Der POI-Mapping-Auftrag konnte nicht erstellt werden. Bitte erneut versuchen.'));
 return result.parsed;
}
function capacity() {if(!(getMissionAircraftCapabilitySnapshot().passengerCapacity>=1))throw Error('Für den Mapping-Auftrag ist ein freier Passagierplatz erforderlich.');}
async function choices(candidates,dispatch) {
 capacity();
 if(candidates.some(p=>p.poiChain))throw Error('Ketten verwenden ihren bestehenden Aufnahmeablauf.');
 const selected=candidates.slice(0,3);if(!selected.length)return [];
 const contexts=await Promise.all(selected.map(p=>context(p)));dispatch.ensureAlive?.();
 const recent=core().history(localStorage),raw=await json(core().ideaPrompt(contexts.map(c=>core().frame(c,recent))));dispatch.ensureAlive?.();
 return contexts.map((c,i)=>{
  const idea=core().readIdea(raw,c),poi=selected[i];
  return normalizeMissionProposalChoice({id:c.id+'-'+Date.now(),mode:'poi',profileId:'mapping_survey',selectedCategory:poi.poiCategory||dispatch.selectedPoiCategory,requestedCategory:dispatch.requestedPoiCategory||dispatch.selectedPoiCategory,target:missionProposalCompactTarget(poi,'poi'),title:idea.purpose,description:idea.commission,subtitle:idea.person.role,paxText:'1 PAX ('+idea.person.role+')',cargoText:'Aufnahmekamera, Datenlogger und Missions-Tablet (36 lbs)',routeLabel:missionProposalFormatRoute(dispatch.start,poi,'poi').label,mappingProposal:{schema:'mapping-proposal.v1',start:root.MissionPoiBriefingSharedCore.point(dispatch.start),context:c,idea}});
 });
}
async function story({start,dest,proposal,contract={},terrainEnvelope=null,poiTerrainFt=null,poiTerrainMaxFt=null,missionTruth=null,followup=null,ensureAlive}) {
 capacity();
 if(dest?.poiChain)throw Error('Ketten verwenden ihren bestehenden Aufnahmeablauf.');
 let c,idea;
 if(proposal) {
  if(proposal.schema!=='mapping-proposal.v1'||!root.MissionPoiBriefingSharedCore.samePoint(proposal.start,start)||!root.MissionPoiBriefingSharedCore.samePoint(proposal.context?.target,dest))throw Error('Die Aufnahmeidee passt nicht mehr zur gewählten Route. Bitte neu auswählen.');
  c={...proposal.context,terrainEnvelope};idea=core().validateIdea(proposal.idea,c);
 }else{
  c=await context(dest,terrainEnvelope);ensureAlive?.();
  c={...c,continuation:root.MissionPoiFollowupNarrativeCore.context(followup)};
  const raw=await json(core().ideaPrompt([core().frame(c,core().history(localStorage))]));ensureAlive?.();
  idea=core().readIdea(raw,c);
 }
 // Refresh the selected evidence through the shared cache; ideas already saw the mapped environment.
 c=await root.MissionPoiBriefingSharedBrowser.enrichSelected(c,ensureAlive);
 c={...c,sceneCapabilities:sceneCapabilities(),continuation:root.MissionPoiFollowupNarrativeCore.context(followup)};
 const shared=root.MissionPoiBriefingSharedCore,flight=shared.prepareFlight(contract),flightContext=flight.context,recent=core().history(localStorage);
 // Resolve the exact same defaults and pattern builder used after dispatch.
 const passenger=enforcePoiPassengerAltitudeRule({...idea.person,taskDomain:'mapping_survey',roleProfile:'photogrammetry_precision_v1'},true,resolvePoiAltitudeTerrainFt(poiTerrainFt,poiTerrainMaxFt),getPoiTaskPassengerDefaults({mission:{missionType:'poi'},isPOI:true,poiTerrainFt,poiTerrainMaxFt}));
 const spec=buildMissionSurveyPatternSpec({missionData:{isPOI:true,targetName:dest.n||dest.name,poiName:dest.n||dest.name,targetLat:dest.lat,targetLon:dest.lon,poiCategory:c.targetCategory,missionTruth},missionContract:{...contract,missionTruth},passenger});
 // Mapping-specific factual binding; no inference or text repair.
 flight.bindings={...flight.bindings,targetAltFt:String(spec.targetAltFt)};
 const raw=await json(core().writerPrompt(c,idea,recent,flight,spec));ensureAlive?.();
 // Weather validation must never discard a valid narrative.
 const {flightBriefing:weatherTemplate,...narrative}=raw;
 const resolved=root.MissionCharterIdeasCore.resolveReferences(narrative,flight.bindings);
 if(!resolved)throw Error('Das POI-Briefing enthält unbekannte Flugreferenzen.');
 const written=core().validateWriter(resolved,idea,c);
 Object.assign(written,shared.resolveWeather(weatherTemplate,flightContext));
 if(followup?.narrativeMemory?.cargoText)c.cargoText=followup.narrativeMemory.cargoText;
 const m=core().mission(idea,written,c,contract,spec);
 Object.assign(m.passenger,{targetAltFt:passenger.targetAltFt,targetRadiusNm:passenger.targetRadiusNm,targetDwellMin:passenger.targetDwellMin});
 m._missionWriterV4Debug.weatherSnapshot=flightContext.weather;
 m._missionWriterV4Debug.historyCount=recent.length;
 return m;
}
// Other infrastructure follow-up profiles reuse their locked technical base and narrative memory.
async function continuation({req,base,contract={},dest,terrainEnvelope=null,ensureAlive}) {
 if(!base||!['media_photo','inspection_infra'].includes(base.passenger?.taskDomain))throw Error('Unpassender POI-Folgeauftrag.');
 const shared=root.MissionPoiBriefingSharedCore,n=root.MissionPoiFollowupNarrativeCore;
 let c=await context(dest,terrainEnvelope);ensureAlive?.();
 c={...c,continuation:n.context(req)};
 const flight=shared.prepareFlight(contract),person=base.passenger;
 const prompt=`Schreibe einen professionellen POI-Folgeauftrag im Erzählerstil: du für den Piloten, die Fachperson mit Namen, ihr für beide. Etwa 100–150 Wörter. Die Aufgabe, Person, Rolle, Ziel und fachliche Grundlage aus BASE sind verbindlich. CONTINUATION erklärt die Vorgeschichte und den bekannten Befund. Auftraggeber und bekannte Beteiligte bleiben erhalten. Unbekannte Ergebnisse der Nachprüfung oder Reparatur nicht als schon erfolgt erzählen. Erzähle den konkreten nächsten Auftrag statt eine unabhängige Geschichte zu erfinden. Daten und Befund gehen nach der Rückkehr an das zuständige Team; keine neue Interaktion oder Abschlussbedingung. Eine neue Inspektion bewertet weiterhin den vom Missionssystem vorgegebenen Befund. Fotos dokumentieren und ersetzen keine Inspektion. Ortsmerkmale nur aus STORY_FACTS; NAVIGATION nur im separaten Lagebericht. Gruß als direkte Ich-Rede von ${JSON.stringify(person.name)}. Zusätzliche Szenen sind optional. Ohne Zusatzobjekte densityHint=none und visibleIdeas=[]; mit Bedarf nur darstellbare Objektwünsche, keine erfundene Messfähigkeit oder behaupteter realer Bestand. Kein neues Ziel, keine Flugparameter oder Suchmuster. memory beschreibt diesen nächsten Auftrag, nicht erfundene Flugleistungen. Freie offene Fragen und mögliche Fortsetzungen dürfen leer bleiben; sie autorisieren keinen Folgeauftrag.
${shared.navigationInstructions}
${shared.weatherInstructions(flight)}
JSON: {targetId,title,story,greetingSpeaker,greeting,flightBriefing,sceneIntent:{summary,visibleIdeas:[],densityHint,notes},report:{orientationIds:[]},usedFactIds:[],memory:{summary,participants:[{name,role}],client:{name,kind},openQuestions:[],possibleContinuations:[]}}.
BASE=${JSON.stringify({target:c.target,taskDomain:person.taskDomain,person,assignment:base.followUpContext?.storyFrame,cargo:base.cargo})}
CONTINUATION=${JSON.stringify(c.continuation)}
STORY_FACTS=${JSON.stringify(c.targetFacts||[])}
NAVIGATION=${JSON.stringify(shared.writerContext(c))}
SCENE_CAPABILITIES=${JSON.stringify(c.sceneCapabilities)}
FLUGDATEN=${JSON.stringify(flight.context)}
WERTE=${JSON.stringify(flight.bindings)}
TARGET_ID=${JSON.stringify(c.id)}`;
 const raw=await json(prompt);ensureAlive?.();
 const {flightBriefing:weatherTemplate,...prose}=raw,resolved=root.MissionCharterIdeasCore.resolveReferences(prose,flight.bindings);
 const client=c.continuation?.narrative?.memory?.client||resolved?.memory?.client;
 const idea={person,client:client||{name:'',kind:''},sceneIntent:core().sceneIntent(resolved?.sceneIntent)};
 const written=core().validateWriter(resolved,idea,c);Object.assign(written,shared.resolveWeather(weatherTemplate,flight.context));
 const story=[written.story,written.flightBriefing,shared.formatReport(written.report)].filter(Boolean).join('\n\n');
 const m={...base,t:written.title,s:story,story,missionStory:story,passenger:{...person,greetingText:written.greeting},targetScene:null,sceneIntent:written.sceneIntent,followUpNarrative:n.draft(written.memory),poiContinuationBriefing:{schema:'poi-continuation-briefing.v1',continuation:c.continuation,writerMemory:written.memory,report:written.report,sourceContext:shared.sourceSnapshot(c)},_source:'POI-Fortsetzungswriter + V4 Contract',_missionWriterV4Debug:{writerMode:'poi-continuation-briefing.v1',writerAccepted:true,rawAiStory:written.story,writerStory:story,memoryStatus:written.memoryStatus,flightBriefing:written.flightBriefing,flightBriefingStatus:written.flightBriefingStatus}};
 Object.assign(contract,{...base._missionContractV4,passenger:m.passenger,sceneIntent:m.sceneIntent,followUpNarrative:m.followUpNarrative,poiContinuationBriefing:m.poiContinuationBriefing,missionStory:story});m._missionContractV4=contract;return m;
}
root.MissionMappingBriefingBrowser={enabled,choices,story,context,continuation};
})(window);
