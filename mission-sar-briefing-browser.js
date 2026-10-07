(function(root){
'use strict';
const core=()=>root.MissionSarBriefingCore;
function enabled({isPOI=true,profileId,aiModeEnabled=true,followup=false,planning=false,bush=false,category=''}={}){return isPOI&&profileId==='search_and_rescue'&&aiModeEnabled&&!followup&&!planning&&!bush&&category!=='chain';}
async function json(prompt){const r=await fetchGeminiJsonWithFallback(prompt,getSelectedAiApiKey(),{promptVersion:'sar-briefing-v2',timeoutMs:40000});if(!r?.parsed)throw Error(root.formatAiJsonFailure?root.formatAiJsonFailure(r,'Der SAR-Auftrag'):'Der SAR-Auftrag konnte nicht erstellt werden. Bitte erneut versuchen.');return r.parsed;}
const geometryCache=new Map(),geometryInflight=new Map(),geometryCooldown=new Map();
async function geometry(dest){
 const o=root.MissionPoiBriefingSharedCore.point(dest),r=2200,key=o.lat.toFixed(6)+','+o.lon.toFixed(6),cached=geometryCache.get(key);
 if(cached&&Date.now()-cached.at<1800000)return cached.geo;
 if(geometryInflight.has(key))return geometryInflight.get(key);
 const request=loadGeometry(o,r).then(geo=>{geometryCache.set(key,{at:Date.now(),geo});if(geometryCache.size>10)geometryCache.delete(geometryCache.keys().next().value);return geo;});
 geometryInflight.set(key,request);
 try{return await request;}finally{geometryInflight.delete(key);}
}
async function loadGeometry(o,r){
 const q=`[out:json][timeout:20];(way(around:${r},${o.lat},${o.lon})["natural"~"water|wood|grassland"];way(around:${r},${o.lat},${o.lon})["landuse"];relation(around:${r},${o.lat},${o.lon})["natural"~"water|wood"];relation(around:${r},${o.lat},${o.lon})["landuse"];way(around:${r},${o.lat},${o.lon})["waterway"];way(around:${r},${o.lat},${o.lon})["amenity"="parking"];way(around:${r},${o.lat},${o.lon})["highway"];way(around:${r},${o.lat},${o.lon})["building"];way(around:${r},${o.lat},${o.lon})["railway"];);out geom;`;
 let unsuitable=false;
 const accept=(raw,source,radiusM=r)=>{
  if(raw?.remark||!Array.isArray(raw?.elements))throw Error('sar_geometry_payload_invalid');
  const geo=root.MissionSarSceneCore.geometry(raw,o,radiusM/1852);
  if(geo.status!=='mapped')throw Error('sar_geometry_incomplete');
  if(!geo.sarCandidates.length){unsuitable=true;return null;}
  return {...geo,source};
 };
 for(const url of ['https://overpass-api.de/api/interpreter','https://overpass.private.coffee/api/interpreter']){
  if((geometryCooldown.get(url)||0)>Date.now())continue;
  try{
   const res=await fetch(url,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:'data='+encodeURIComponent(q),signal:AbortSignal.timeout(25000)});
   if([429,502,503,504].includes(res.status))geometryCooldown.set(url,Date.now()+60000);
   if(res.ok){const raw=await res.json();if(raw.remark)geometryCooldown.set(url,Date.now()+60000);const geo=accept(raw,url);if(geo)return geo;}
  }catch{geometryCooldown.set(url,Date.now()+60000);}
 }
 // A bounded placement subarea keeps the direct API extract manageable.
 // Its entire circle is verified; the public search radius stays unchanged.
 const osm='https://api.openstreetmap.org/api/0.6/map.json';
 if((geometryCooldown.get(osm)||0)<=Date.now())try{
  const placementRadiusM=1200,dy=placementRadiusM/111320,dx=dy/Math.cos(o.lat*Math.PI/180),bbox=[o.lon-dx,o.lat-dy,o.lon+dx,o.lat+dy];
  if(bbox[0]<-180||bbox[2]>180||bbox[1]<-85||bbox[3]>85)throw Error('sar_geometry_bounds_invalid');
  const res=await fetch(osm+'?bbox='+bbox.join(','),{signal:AbortSignal.timeout(8000)});
  if([429,502,503,504].includes(res.status))geometryCooldown.set(osm,Date.now()+60000);
  if(res.ok&&Number(res.headers.get('content-length')||0)<6000000){
   const text=await res.text();if(text.length>=6000000)throw Error('sar_geometry_payload_too_large');
   const complete=await completeOsmAreas(JSON.parse(text));
   const raw=root.MissionSarSceneCore.osmGeometry(complete),geo=accept(raw,osm,placementRadiusM);if(geo)return geo;
  }
 }catch{geometryCooldown.set(osm,Date.now()+60000);}
 if(unsuitable)throw Error('Für diesen SAR-Suchraum fehlen geeignete geprüfte geografische Einsatzflächen. Bitte einen anderen Suchraum wählen.');
 throw Error('Die geografischen Daten für diesen SAR-Suchraum sind derzeit nicht vollständig abrufbar. Bitte später erneut versuchen.');
}
async function completeOsmAreas(raw){
 const missing=root.MissionSarSceneCore.missingOsmRelations(raw);
 // map.json includes parent relations even when their polygons extend outside
 // the bbox. Complete those areas, preserving holes and all exclusions.
 if(missing.length>8)throw Error('sar_geometry_too_many_incomplete_areas');
 const elements=new Map(raw.elements.map(e=>[e.type+'/'+e.id,e]));
 let bytes=0;
 for(const id of missing){
  if(!Number.isSafeInteger(id)||id<=0)throw Error('sar_geometry_relation_invalid');
  const res=await fetch('https://api.openstreetmap.org/api/0.6/relation/'+id+'/full.json',{signal:AbortSignal.timeout(8000)});
  if(!res.ok)throw Error('sar_geometry_relation_unavailable');
  if(Number(res.headers.get('content-length')||0)>=6000000)throw Error('sar_geometry_payload_too_large');
  const text=await res.text();bytes+=text.length;if(text.length>=6000000||bytes>=12000000)throw Error('sar_geometry_payload_too_large');
  const extra=JSON.parse(text);if(extra.remark||!Array.isArray(extra.elements))throw Error('sar_geometry_payload_invalid');
  for(const e of extra.elements)elements.set(e.type+'/'+e.id,e);
 }
 return {...raw,elements:[...elements.values()]};
}
async function context(dest,terrainEnvelope=null){const c=await root.MissionPoiBriefingSharedBrowser.enrichSelected(await root.MissionPoiBriefingSharedBrowser.context(dest,terrainEnvelope)),geo=await geometry(dest);const allowedIncidents=[...new Set(geo.sarCandidates.map(p=>p.incident))];const roadFacts=geo.roads.filter(r=>geo.sarCandidates.some(p=>p.roadId===r.id)).slice(0,8).map(r=>({id:'sar-'+r.id,fact:`Kartierte Straße ${r.name} mit geeigneter Fläche daneben im Suchraum.`,source:'OSM-Geometrie'}));return {...c,environmentFacts:[...(c.environmentFacts||[]),...roadFacts],allowedIncidents,terrainEnvelope};}
async function choices(candidates,dispatch){
 if(getMissionAircraftCapabilitySnapshot().passengerCapacity<1)throw Error('SAR benötigt einen Beobachterplatz.');
 const selected=[],contexts=[],errors=[];
 // Avoid simultaneous large Overpass queries. Failed candidates do not discard
 // successfully checked targets; keep the original target/context association.
 for(const poi of candidates.slice(0,3)){
  dispatch.ensureAlive?.();
  try{const c=await context(poi);selected.push(poi);contexts.push(c);}catch(error){errors.push(error);}
  dispatch.ensureAlive?.();
 }
 if(!contexts.length)throw errors[0]||Error('Keine SAR-Suchräume verfügbar.');
 const raw=await json(core().ideaPrompt(contexts.map(c=>({id:c.id,target:c.target.name,allowedIncidents:c.allowedIncidents,targetFacts:c.targetFacts,environmentFacts:c.environmentFacts})),core().history(localStorage)));
 dispatch.ensureAlive?.();
 if(!Array.isArray(raw.ideas)||raw.ideas.length!==contexts.length||contexts.some(c=>raw.ideas.filter(i=>i.targetId===c.id).length!==1))throw Error('SAR-Auswahl enthält keine eindeutigen Einsatzideen.');
 return contexts.map((c,i)=>{const idea=core().validateIdea(raw.ideas?.find(x=>x.targetId===c.id),c),poi=selected[i];return normalizeMissionProposalChoice({id:c.id+'-'+Date.now(),mode:'poi',profileId:'search_and_rescue',selectedCategory:poi.poiCategory||dispatch.selectedPoiCategory,requestedCategory:dispatch.requestedPoiCategory,title:idea.searchFocus,description:idea.alarm,subtitle:idea.person.role,target:missionProposalCompactTarget(poi,'poi'),paxText:'1 PAX ('+idea.person.role+')',cargoText:'Beobachter-Fernglas, Karten und Funkgerät (12 lbs)',routeLabel:missionProposalFormatRoute(dispatch.start,poi,'poi').label,sarProposal:{schema:'sar-proposal.v2',start:root.MissionPoiBriefingSharedCore.point(dispatch.start),context:c,idea}});});
}
async function story({start,dest,proposal,contract={},terrainEnvelope,ensureAlive}){const shared=root.MissionPoiBriefingSharedCore;let c,i;if(proposal){if(proposal.schema!=='sar-proposal.v2'||!shared.samePoint(proposal.start,start)||!shared.samePoint(proposal.context?.target,dest))throw Error('SAR-Idee passt nicht mehr zur Route.');c={...proposal.context,terrainEnvelope};i=core().validateIdea(proposal.idea,c);}else{c=await context(dest,terrainEnvelope);ensureAlive?.();const r=await json(core().ideaPrompt([{id:c.id,target:c.target.name,allowedIncidents:c.allowedIncidents,targetFacts:c.targetFacts,environmentFacts:c.environmentFacts}],core().history(localStorage)));i=core().validateIdea(r.ideas?.find(x=>x.targetId===c.id),c);}
 const flight=shared.prepareFlight(contract),raw=await json(core().writerPrompt(c,i,flight,core().history(localStorage)));ensureAlive?.();const {flightBriefing,...narrative}=raw,w=root.MissionCharterIdeasCore.resolveReferences(narrative,{...shared.writerContext(c).bindings,...flight.bindings});if(!w)throw Error('Unbekannte Referenz im SAR-Briefing.');Object.assign(w,shared.resolveWeather(flightBriefing,flight.context));const m=core().mission(i,w,c,contract);m.sarScenario={schema:'sar-search.v2',center:c.target,radiusNm:1.5,minSearchSec:180,maxSearchSec:600,truth:Math.random()<0.75?'incident':'no_contact',pending:true};return m;}
async function composeScene({missionData:md,missionContract:contract,passenger,compose,apiKey,geometry:provided,terrain}){const i=md.sarBriefing.idea,s=md.sarScenario,geo=provided||await geometry(s.center);if(!geo.sarCandidates.some(c=>c.incident===i.incident))throw Error('Geografie unterstützt diese SAR-Einsatzlage nicht mehr.');if(s.truth==='no_contact')return {targetScene:{kind:'none',requirements:[],features:[],density:'none'},sarScenario:{...s,pending:false},debug:{source:'sar-private'}};
 const referencedRoads=i.incident==='road_vehicle'?geo.roads.filter(r=>i.factIds.includes('sar-'+r.id)):geo.roads;const checkedGeo={...geo,roads:referencedRoads};
 const candidates=geo.sarCandidates.filter(p=>p.incident===i.incident&&(i.incident!=='road_vehicle'||referencedRoads.some(r=>r.id===p.roadId)));if(!candidates.length)throw Error('Keine geprüfte Fundfläche am Straßenbezug des SAR-Auftrags.');const def=root.MissionSarSceneCore.definition(i.incident),features=[def.primary];const intent={summary:i.alarm,visibleIdeas:[`Private simulierte Suchlage ${i.incident}; baue einen glaubwürdigen Sichtkontakt aus ${features.join(', ')}. Die vermutete Lage steht in der Einsatzidee. ${i.incident==='road_vehicle'?'Fahrzeug abseits der im Auftrag belegten Straße, nie auf der Fahrbahn.':i.incident==='overdue_boat'?'Boot ausschließlich auf belegter Wasserfläche, nie am Ufer oder auf Inseln.':i.incident==='missing_aircraft'?'Wrack ausschließlich auf belegter offener Landfläche.':'Person auf belegter Land-/Vegetationsfläche.'} Keine Rettungskräfte am bereits gefundenen Patienten.`],densityHint:'sparse',notes:'Alle Koordinaten vom Suchgebietsmittelpunkt, heading=0: forwardM Norden, rightM Osten. Nutze belegte Kandidaten und Flächen; ein zusammenhängender Fundort. Genau ein Primärobjekt, count=1, optionale Hinweise nahebei. Keine Verletzungen oder Rettungserfolg behaupten.'};const kind=def.kind,plan={status:'ready',plan:{sceneKind:kind,sceneDensity:'sparse',objectFamilies:features}};
 const {poiScenePlacementVersion:unusedPlacement,...sceneData}=md;const {poiScenePlacementVersion:unusedContractPlacement,...sceneContract}=contract;
 const result=await compose({missionData:{...sceneData,heading:0,sceneIntent:intent,missionTruth:{mainTarget:s.center,sceneAnchor:s.center},missionPlanV2:plan,sarSearchScene:{schema:'sar-scene.v2',incident:i.incident,outputContract:{kind,primaryFeature:features[0],allowedFeatures:def.allowed,countPerRequirement:1,maxRequirements:4,minObjectSeparationM:8,maxPrimaryDistanceM:35,coordinates:'forwardM=candidate.y, rightM=candidate.x, heading=0; primary must use an exact candidate. Optional items only on verified adjacent surface; no invented feature names or multiple counts.'},candidates,roads:referencedRoads.map(r=>({...r,points:r.points.filter((p,index)=>index===0||index===r.points.length-1||index%Math.max(1,Math.ceil(r.points.length/20))===0)})),placementEvidence:'Kandidaten anhand vollständiger OSM-Polygone vorgeprüft: Landfläche, mindestens 8m Abstand von Wasser/Gebäuden/Verkehrsflächen; Straßenkandidaten mit belegtem Straßenbezug. Primärobjekt auf einen Kandidaten setzen. Der finale Plan wird erneut gegen vollständige Geometrie geprüft.',story:i}},missionContract:{...sceneContract,sceneIntent:intent,missionPlanV2:plan},passenger,apiKey,fallback:{targetScene:{kind:'none'}}});
 const placed=!result.debug?.error&&root.MissionSarSceneCore.accept(result.debug?.aiRaw||result.targetScene,i,checkedGeo,root.MISSION_SCENE_ASSETS);if(!placed)throw Error('SAR-Szene passt nicht zur belegten Geografie. Auftrag bleibt Entwurf.');const altFt=await terrain(placed.source.lat,placed.source.lon);if(!Number.isFinite(altFt))throw Error('SAR-Fundstellenhöhe fehlt.');return {targetScene:placed.scene,sarScenario:{...s,source:{...placed.source,altFt},pending:false,sceneAnchor:s.center,scenePrimaryFeature:features[0]},debug:{source:'sar-private',placementReference:placed.reference}};}
root.MissionSarBriefingBrowser={enabled,choices,story,composeScene,geometry};
})(window);
