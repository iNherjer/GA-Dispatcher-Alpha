(function(root){
'use strict';
const core=()=>root.MissionFireBriefingCore;
const FLAG='ga_fire_briefing_v1';
function enabled({isPOI=true,profileId,category='',aiModeEnabled=true,followup=false,planning=false,bush=false}={}){try{return localStorage.getItem(FLAG)!=='off'&&isPOI&&profileId==='fire_watch'&&aiModeEnabled&&String(getSelectedAiApiKey()||'').trim().length>0&&!followup&&!planning&&!bush&&category!=='chain';}catch{return false;}}
async function context(dest,terrainEnvelope=null){
 const initial=await root.MissionPoiBriefingSharedBrowser.context(dest,terrainEnvelope);
 const c=await root.MissionPoiBriefingSharedBrowser.enrichSelected(initial);
 // Explicit allowlist: no private fireScenario, truth, future scene or result reaches the writer.
 return {id:c.id,target:c.target,targetFacts:c.targetFacts||[],environmentFacts:c.environmentFacts||[],facts:c.facts||[],coverage:c.coverage||[],supplements:c.supplements||[],terrain:c.terrain,terrainEnvelope};
}
async function json(prompt) {
 const key=String(getSelectedAiApiKey()||'').trim();
 if(!key)throw Error('Für KI-Feuerwacht-Aufträge fehlt der API-Key des gewählten Providers. Bitte in den Einstellungen eintragen oder ohne KI neu dispatchen.');
 const result=await fetchGeminiJsonWithFallback(prompt,key,{promptVersion:core().PROMPT_VERSION,timeoutMs:40000});
 if(!result?.parsed)throw Error('Der POI-Einsatzauftrag konnte nicht erstellt werden. Bitte erneut versuchen.');
 return result.parsed;
}
function capacity() {if(!(getMissionAircraftCapabilitySnapshot().passengerCapacity>=1))throw Error('Für den Einsatzauftrag ist ein freier Passagierplatz erforderlich.');}
async function choices(candidates,dispatch) {
 capacity();
 if(candidates.some(p=>p.poiChain))throw Error('Ketten verwenden ihren bestehenden Studienablauf.');
 const selected=candidates.slice(0,3);if(!selected.length)return [];
 const contexts=await Promise.all(selected.map(p=>context(p)));dispatch.ensureAlive?.();
 const recent=core().history(localStorage),raw=await json(core().ideaPrompt(contexts.map(c=>core().frame(c,recent))));dispatch.ensureAlive?.();
 return contexts.map((c,i)=>{
  const idea=core().readIdea(raw,c),poi=selected[i];
  return normalizeMissionProposalChoice({id:c.id+'-'+Date.now(),mode:'poi',profileId:'fire_watch',selectedCategory:poi.poiCategory||dispatch.selectedPoiCategory,requestedCategory:dispatch.requestedPoiCategory||dispatch.selectedPoiCategory,target:missionProposalCompactTarget(poi,'poi'),title:idea.observationFocus,description:idea.alarm.reportedObservation,subtitle:idea.person.role,paxText:'1 PAX ('+idea.person.role+')',cargoText:'Wärmebildkamera mit Monitor, Karten und Funkgerät (18 lbs)',routeLabel:missionProposalFormatRoute(dispatch.start,poi,'poi').label,fireProposal:{schema:'fire-proposal.v1',start:root.MissionPoiBriefingSharedCore.point(dispatch.start),context:c,idea}});
 });
}
async function story({start,dest,proposal,contract={},terrainEnvelope=null,ensureAlive}) {
 capacity();
 if(dest?.poiChain)throw Error('Ketten verwenden ihren bestehenden Studienablauf.');
 let c,idea;
 if(proposal) {
  if(proposal.schema!=='fire-proposal.v1'||!root.MissionPoiBriefingSharedCore.samePoint(proposal.start,start)||!root.MissionPoiBriefingSharedCore.samePoint(proposal.context?.target,dest))throw Error('Die Einsatzidee passt nicht mehr zur gewählten Route. Bitte neu auswählen.');
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
 // The writer sees both navigation evidence and flight values; resolve exactly that union.
 const narrativeBindings={...shared.writerContext(c).bindings,...flight.bindings};
 const resolved=root.MissionCharterIdeasCore.resolveReferences(narrative,narrativeBindings);
 if(!resolved){
  const unknown=[...new Set(Object.values(narrative).filter(v=>typeof v==='string').flatMap(v=>[...v.matchAll(/\[\[([^\[\]]+)\]\]/g)].map(m=>m[1])).filter(id=>!Object.prototype.hasOwnProperty.call(narrativeBindings,id)))];
  throw Error('Das Einsatzbriefing enthält unbekannte Referenzen'+(unknown.length?': '+unknown.join(', '):'.'));
 }
 const written=core().validateWriter(resolved,idea,c);
 Object.assign(written,shared.resolveWeather(weatherTemplate,flightContext));
 const m=core().mission(idea,written,c,contract);
 m._missionWriterV4Debug.weatherSnapshot=flightContext.weather;
 m._missionWriterV4Debug.historyCount=recent.length;
 return m;
}
async function composeScene({missionData:md,missionContract:contract,passenger:pax,compose,apiKey,geometry:providedGeometry,terrain}) {
 const scene=root.MissionFireSceneCore;
 let geo=providedGeometry;
 if(!geo){
  const o=md.fireScenario.target,r=2200;
  const q=`[out:json][timeout:20];(way(around:${r},${o.lat},${o.lon})["natural"~"water|wood|grassland"];way(around:${r},${o.lat},${o.lon})["landuse"];way(around:${r},${o.lat},${o.lon})["waterway"];relation(around:${r},${o.lat},${o.lon})["natural"~"water|wood|grassland"];relation(around:${r},${o.lat},${o.lon})["landuse"];way(around:${r},${o.lat},${o.lon})["amenity"="parking"];way(around:${r},${o.lat},${o.lon})["highway"];way(around:${r},${o.lat},${o.lon})["building"];way(around:${r},${o.lat},${o.lon})["railway"];);out geom;`;
  let raw;
  for(const endpoint of ['https://overpass-api.de/api/interpreter','https://overpass.private.coffee/api/interpreter']) {
   try {const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8'},body:'data='+encodeURIComponent(q),signal:AbortSignal.timeout(25000)});if(response.ok){raw=await response.json();if(!raw.remark)break;raw=null;}}catch{}
  }
  if(!raw)throw Error('Suchgebietsflächen derzeit nicht abrufbar. Bitte erneut annehmen.');
  geo=scene.geometry(raw,o,r);
 }
 if(geo.status!=='mapped'||!geo.candidates?.length)throw Error('Für dieses Suchgebiet fehlen geprüfte Einsatzflächen. Keine ungeprüfte Szene platziert.');
 const packet=scene.planning(md.fireScenario,md,contract,pax,geo);
 let next=null;
 if(packet&&apiKey)try {
  const composed=await compose({...packet,apiKey});
  if(!composed.debug?.error)next=scene.placement(md.fireScenario,composed.debug?.aiRaw || composed.targetScene,geo);
 }catch{}
 if(packet&&!next)next=scene.mappedFallback(md.fireScenario,geo);
 if(packet&&!next)throw Error('Keine passende Platzierung für die vorbereitete Einsatzlage.');
 if(next&&terrain){
  for(const site of next.smoke.sites){const alt=await Promise.race([terrain(site.lat,site.lon),new Promise((_,reject)=>setTimeout(()=>reject(Error("Geländehöhenabruf überschreitet Zeitlimit")),6000))]);if(!Number.isFinite(alt))throw Error('Geländehöhe am Einsatzort nicht verfügbar.');site.altFt=alt;}
  for(const item of next.fire?.sites||[]){const source=next.smoke.sites.find(s=>s.siteId===item.smokeSiteId);item.altFt=source.altFt;}
 }
 // Failed KI planning uses only a geographically checked fallback, never the old blind offsets.
 return {targetScene:scene.publicScene(),aptArrivalPlan:null,...(next?{fireScenario:next}:{}),debug:{source:'fire-watch-private'}};
}
root.MissionFireBriefingBrowser={enabled,choices,story,context,composeScene};
})(window);
