/* Shared POI placement contract. Historical filename retained for saved reporter fixtures. */
(function(root){
'use strict';
const VERSION='poi-placement.v3';
const enabled=(md={},contract={})=>(md.newsBriefing||contract.newsBriefing)?.schema==='news-briefing.v1'||md.poiScenePlacementVersion===VERSION||contract.poiScenePlacementVersion===VERSION;
function enroll(md={},contract={},pax={}) {
 const mode=String(md.missionType||contract.missionType||'').toLowerCase();
 const task=pax.taskDomain||contract.taskDomain;
 if(!(md.isPOI||md.poiName||md.poiSource)||mode==='bush'||mode==='apt'||task==='fire_watch')return false;
 md.poiScenePlacementVersion=contract.poiScenePlacementVersion=VERSION;
 return true;
}
function surfaces(spec={},req={}) {
 const allowed=spec.placementSurfaces||['ground'];
 return req.surface ? (allowed.includes(req.surface)?[req.surface]:[]) : [allowed[0]];
}
function radius(spec={},feature='') {return Number(spec.placementRadiusM)||({people:1.5,missing_person:1.5,pavilion:3,road_vehicles:5,generator:3,pallet_stack:2,cones:1}[feature])||5;}

const local=(p,o)=>({x:(p.lon-o.lon)*111320*Math.cos(o.lat*Math.PI/180),y:(p.lat-o.lat)*111320});
function inside(p,poly){let yes=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)yes=!yes;}return yes;}
function edgeDistance(p,poly){let best=Infinity;for(let i=1;i<poly.length;i++){const a=poly[i-1],b=poly[i],dx=b.x-a.x,dy=b.y-a.y;const t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));best=Math.min(best,Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy));}return best;}
function geometry(raw,origin){
 const shapes=[],anchors=[];
 for(const el of raw.elements||[]){const t=el.tags||{},g=el.geometry;if(!Array.isArray(g)||g.length<2||g.some(p=>!Number.isFinite(p.lat)||!Number.isFinite(p.lon)))continue;
 const closed=g.length>=4&&g[0].lat===g.at(-1).lat&&g[0].lon===g.at(-1).lon;
 let type='',blocked=false,buffer=0;
 if(t.tunnel==='yes'&&t.highway&&['primary','secondary','tertiary','trunk','motorway'].includes(t.highway)){
  const points=g.map(p=>local(p,origin));
  if(edgeDistance({x:0,y:0},points)<60) for(const [i,p] of [points[0],points.at(-1)].entries()) anchors.push({id:`${el.type}/${el.id}/end-${i}`,type:'tunnel_end',sourceId:`${el.type}/${el.id}`,x:Math.round(p.x),y:Math.round(p.y),note:'Kartiertes Ende des unterirdischen Straßenverlaufs; Portalfläche selbst nicht vermessen.'});
  continue;
 }
 if(t.building&&t.building!=='no'){type='building';blocked=true;}
 else if(t.natural==='water'||t.waterway||t.landuse==='reservoir'){type='water';blocked=true;buffer=8;}
 else if(t.natural==='wood'||t.landuse==='forest'){type='forest';blocked=true;}
 else if(t.highway&&t.area!=='yes'&&t.tunnel!=='yes'){type='road';blocked=true;buffer=t.highway==='service'||t.highway==='footway'||t.highway==='path'?2:7;}
 else if(t.railway){type='railway';blocked=true;buffer=5;}
 else if(closed&&(t.amenity==='parking'||t.landuse==='industrial'||t.landuse==='commercial'||t.landuse==='grass'||t.landuse==='meadow'||t.landuse==='farmland'||t.landuse==='orchard'||t.landuse==='vineyard'||t.natural==='grassland'||t.highway==='pedestrian'))type=t.amenity||t.landuse||t.natural||t.highway;
 if(!type)continue;
 if(!closed&&!['road','water','railway'].includes(type))continue;
 const points=g.map(p=>{const v=local(p,origin);return {x:Math.round(v.x*10)/10,y:Math.round(v.y*10)/10};});
 const width=Number(t.width);
 shapes.push({surface:t.surface||'unknown',access:t.access||'unknown',bounds:{minX:Math.min(...points.map(p=>p.x)),maxX:Math.max(...points.map(p=>p.x)),minY:Math.min(...points.map(p=>p.y)),maxY:Math.max(...points.map(p=>p.y))},widthM: Number.isFinite(width)&&width>0&&width<100?width:null, id:`${el.type}/${el.id}`,type,closed,blocked,buffer,points});
 }
 const complete=!raw.remark&&shapes.reduce((n,s)=>n+s.points.length,0)<=30000;
 const containing=shapes.filter(s=>!s.blocked&&s.closed&&inside({x:0,y:0},s.points)).map(s=>s.id);
 const result={targetSurfaceIds:containing,schema:VERSION,anchors,origin,headingDeg:0,status:complete?'mapped':'incomplete',shapes:complete?shapes:[],note:'OSM-Flächennutzung und Ausschlussgeometrie; nicht kartierte Hindernisse und Belegung bleiben unbekannt. x=Osten/rechts, y=Norden/vorwärts, Meter.'};
 result.candidates=[];
 if(complete)for(let y=-100;y<=100;y+=20)for(let x=-100;x<=100;x+=20){const p={x,y};if(!placementError(p,9,result))result.candidates.push(p);}
 result.candidates.sort((a,b)=>Math.hypot(a.x,a.y)-Math.hypot(b.x,b.y));result.candidates=result.candidates.slice(0,36);
 result.surfaceCandidates={ground:result.candidates};
 for(const surface of ['water','forest','road']){
  const candidates=[];
  for(let y=-160;y<=160;y+=10)for(let x=-160;x<=160;x+=10){const p={x,y};if(!placementError(p,surface==='forest'?1.5:5,result,surface))candidates.push(p);}
  result.surfaceCandidates[surface]=candidates.sort((a,b)=>Math.hypot(a.x,a.y)-Math.hypot(b.x,b.y)).slice(0,36);
 }
 result.sites=complete?siteOptions(result):[];
 return result;
}
function placementError(p,r,geo,surface='ground',siteId=null){
 if(!geo||geo.status!=='mapped')return 'Keine vollständige lokale Stellflächengeometrie';
 const usable=s=>(!siteId||s.id===siteId)&&(surface==='ground'?!s.blocked&&s.closed&&(siteId||!geo.targetSurfaceIds?.length||geo.targetSurfaceIds.includes(s.id)):s.type===surface&&(surface==='road'?!!s.widthM:s.closed));
 const fits=s=>surface!=='road'?inside(p,s.points)&&edgeDistance(p,s.points)>r:edgeDistance(p,s.points)+r<s.widthM/2;
 if(!geo.shapes.some(s=>usable(s)&&fits(s)))return `Keine passende kartierte Fläche (${surface}) oder zu nah am Rand`;
 for(const s of geo.shapes)if(s.blocked&&(!s.bounds||p.x>=s.bounds.minX-r-s.buffer&&p.x<=s.bounds.maxX+r+s.buffer&&p.y>=s.bounds.minY-r-s.buffer&&p.y<=s.bounds.maxY+r+s.buffer)&&!usable(s)&&!(surface==='water'&&s.type==='water')&&((s.closed&&inside(p,s.points))||edgeDistance(p,s.points)<r+s.buffer))return `Abstand zu ${s.type} ${s.id} zu klein`;
 return '';
}
// Local planning pockets prevent a large land-use polygon from scattering one activity.
// This is a sampled map-clear connection, not a claim about real paths or occupancy.
function workAreas(slots,geo,surface,siteId){
 const areas=[];
 for(const center of slots){
  if(areas.some(a=>Math.hypot(a.center.x-center.x,a.center.y-center.y)<90))continue;
  const nearby=slots.filter(p=>Math.hypot(p.x-center.x,p.y-center.y)<=60).filter(p=>{
   const steps=Math.max(1,Math.ceil(Math.hypot(p.x-center.x,p.y-center.y)/5));
   for(let i=0;i<=steps;i++)if(placementError({x:center.x+(p.x-center.x)*i/steps,y:center.y+(p.y-center.y)*i/steps},1.5,geo,surface,siteId))return false;
   return true;
  });
  const chosen=[];for(const p of nearby)if(chosen.every(q=>Math.hypot(p.x-q.x,p.y-q.y)>=8)){chosen.push(p);if(chosen.length===12)break;}
  if(chosen.length<2)continue;
  areas.push({center:{x:center.x,y:center.y},slots:chosen});if(areas.length===3)break;
 }
 return areas;
}
// Candidate capacity derives from polygon/line clearance, never from feature names.
function siteOptions(geo){
 const sites=[];
 for(const shape of geo.shapes){
  if(shape.type==='road'&&shape.widthM){
   const slots=[];
   for(let i=1;i<shape.points.length;i++){
    const a=shape.points[i-1],b=shape.points[i],length=Math.hypot(b.x-a.x,b.y-a.y);
    for(let d=5;d<length;d+=15){const p={x:Math.round(a.x+(b.x-a.x)*d/length),y:Math.round(a.y+(b.y-a.y)*d/length)};
     if(Math.abs(p.x)>750||Math.abs(p.y)>750)continue;
     const clearance=shape.widthM/2-0.3;
     if(clearance>=1.6&&!placementError(p,clearance,geo,'road',shape.id))slots.push({...p,clearanceM:Math.floor(clearance*10)/10});
    }
   }
   slots.sort((a,b)=>Math.hypot(a.x,a.y)-Math.hypot(b.x,b.y));
   if(slots.length)sites.push({id:shape.id,usage:'road',surface:shape.surface,access:shape.access,medium:'road',nearAnchors:geo.anchors.map(a=>({id:a.id,distanceM:Math.round(Math.min(...slots.map(p=>Math.hypot(p.x-a.x,p.y-a.y))))})).filter(a=>a.distanceM<=120),slots:slots.slice(0,16),distanceM:Math.round(Math.hypot(slots[0].x,slots[0].y))});
   continue;
  }
  if(!shape.closed||shape.type==='building'||shape.type==='railway'||shape.type==='road')continue;
  const surface=shape.type==='water'?'water':shape.type==='forest'?'forest':'ground';
  const b=shape.bounds;if(!b||b.minX>750||b.maxX< -750||b.minY>750||b.maxY< -750)continue;
  const slots=[];
  const scan=step=>{
   for(let y=Math.ceil(Math.max(-750,b.minY)/step)*step;y<=Math.min(750,b.maxY);y+=step)for(let x=Math.ceil(Math.max(-750,b.minX)/step)*step;x<=Math.min(750,b.maxX);x+=step){
    const point={x,y};if(!inside(point,shape.points))continue;
    let clearance=Math.min(25,edgeDistance(point,shape.points));
    if(clearance<1.6)continue;
    for(const obstacle of geo.shapes){
     if(!obstacle.blocked||obstacle.id===shape.id||surface==='water'&&obstacle.type==='water')continue;
     const q=obstacle.bounds;
     if(q&&(x<q.minX-clearance-obstacle.buffer||x>q.maxX+clearance+obstacle.buffer||y<q.minY-clearance-obstacle.buffer||y>q.maxY+clearance+obstacle.buffer))continue;
     clearance=Math.min(clearance,obstacle.closed&&inside(point,obstacle.points)?0:edgeDistance(point,obstacle.points)-obstacle.buffer);
     if(clearance<1.6)break;
    }
    if(clearance>=1.6)slots.push({x,y,clearanceM:Math.floor(clearance*10)/10});
   }
  };
  scan(20);if(slots.length<6)scan(5);
  slots.sort((a,b)=>b.clearanceM-a.clearanceM||Math.hypot(a.x,a.y)-Math.hypot(b.x,b.y));
  const chosen=[];for(const slot of slots)if(chosen.every(p=>Math.hypot(p.x-slot.x,p.y-slot.y)>=8)){chosen.push(slot);if(chosen.length===16)break;}
  if(!chosen.length)continue;
  const nearAnchors=geo.anchors.map(a=>({id:a.id,distanceM:Math.round(Math.min(...chosen.map(p=>Math.hypot(p.x-a.x,p.y-a.y))))})).filter(a=>a.distanceM<=120);
  sites.push({id:shape.id,usage:shape.type,surface:shape.surface,access:shape.access,medium:surface,nearAnchors,slots:chosen,workAreas:workAreas(slots,geo,surface,shape.id),distanceM:Math.round(Math.min(...chosen.map(p=>Math.hypot(p.x,p.y))))});
 }
 return sites.sort((a,b)=>(b.nearAnchors.length>0)-(a.nearAnchors.length>0)||a.distanceM-b.distanceM).slice(0,18);
}
function siteError(scene,req,p,geo){
 const site=geo.shapes.find(s=>s.id===req.siteId);if(!site)return 'siteId einer belegten Fläche erforderlich';
 const intent=scene.placementIntent;
 const usage={industrial_site:['industrial','commercial','parking'],settlement_space:['parking','pedestrian'],portal_access:['parking','pedestrian','road'],open_field:['grass','meadow','grassland','farmland'],nature:['forest','water','grass','meadow','grassland','orchard','vineyard'],water_scene:['water','parking','grass','meadow'],road_scene:['road','parking','pedestrian']};
 if(!usage[intent?.use]?.includes(site.type))return `Nutzung ${site.type} passt nicht zu ${intent?.use||'fehlendem placementIntent.use'}`;
 if(intent.use==='portal_access'){
  const anchor=geo.anchors.find(a=>a.id===intent.anchorId&&a.type==='tunnel_end');
  if(!anchor||Math.hypot(p.x-anchor.x,p.y-anchor.y)>120)return 'Portalbezug fehlt oder liegt weiter als 120 m entfernt';
 }
 if(intent?.requiresPaved===true&&!['asphalt','concrete','paved','paving_stones','sett'].includes(site.surface))return 'Befestigte Oberfläche nicht belegt';
 return '';
}
function hasPlacementSite(intent,geo){
 if(!intent?.use||!geo?.sites)return null;
 return geo.sites.some(site=>site.slots.some(p=>p.clearanceM>1.5&&!siteError({placementIntent:intent},{siteId:site.id},p,geo)&&!placementError(p,1.5,geo,site.medium,site.id)));
}
function offsets(req){const f=Number(req.forwardM),r=Number(req.rightM),spacing=Number(req.spacingM)||10;const pattern=[[0,0],[1,0],[0,1],[1,1],[-1,0],[0,-1]];return Array.from({length:req.count},(_,i)=>({x:r+(req.arrangement==='line'?i*spacing:(pattern[i]?.[1]||0)*spacing),y:f+(req.arrangement==='line'?0:(pattern[i]?.[0]||0)*spacing)}));}
// Give the composer verified local alternatives; never move saved or generated items silently.
function correctionOptions(scene,geo,catalog){
 if(!geo||geo.status!=='mapped')return [];
 const reqs=scene?.requirements||[],result=[];
 for(const [index,req] of reqs.entries()){
  const spec=catalog.targetSceneFeatures?.[req.feature];if(!spec||!Number.isFinite(req.forwardM)||!Number.isFinite(req.rightM)||!Number.isInteger(req.count)||req.count<1||req.count>6)continue;
  const r=radius(spec,req.feature),surface=surfaces(spec,req)[0];if(!surface)continue;
  const others=reqs.flatMap((q,i)=>i===index||!Number.isInteger(q.count)||q.count<1||q.count>6?[]:offsets(q).map(p=>({...p,r:radius(catalog.targetSceneFeatures?.[q.feature]||{},q.feature)})));
  const fits=q=>{const points=offsets(q);return points.every((p,i)=>!siteError(scene,q,p,geo)&&!placementError(p,r,geo,surface,q.siteId)&&others.every(o=>Math.hypot(p.x-o.x,p.y-o.y)>=r+o.r+1)&&points.every((o,j)=>i===j||Math.hypot(p.x-o.x,p.y-o.y)>=2*r+1));};
  if(fits(req))continue;
  const spacingM=Math.max(Number(req.spacingM)||10,2*r+1),candidates=[];
  for(let dy=-60;dy<=60;dy+=5)for(let dx=-60;dx<=60;dx+=5){const q={...req,spacingM,forwardM:req.forwardM+dy,rightM:req.rightM+dx};if(fits(q))candidates.push({forwardM:q.forwardM,rightM:q.rightM,spacingM,distance:Math.hypot(dx,dy)});}
  candidates.sort((a,b)=>a.distance-b.distance);
  result.push({requirement:index+1,siteId:req.siteId,count:req.count,arrangement:req.arrangement,minimumSpacingM:2*r+1,alternatives:candidates.slice(0,3).map(({distance,...p})=>p),note:'Alternativen gelten relativ zu den übrigen unveränderten Gruppen. Einzeln übernehmen und erneut prüfen; keine neue Nutzung.'});
 }
 return result;
}
function validate(scene,geo,catalog){
 const errors=[],points=[];if(scene?.kind==='none')return errors;
 if(scene.placementVersion===VERSION&&scene.placementRequirement&&(scene.placementIntent?.use!==scene.placementRequirement.use||(scene.placementIntent?.requiresPaved===true)!==scene.placementRequirement.requiresPaved))return ['Räumlicher Zweck ist verbindlich: '+JSON.stringify(scene.placementRequirement)+'. Nicht auf andere Nutzung ausweichen; bei fehlender geeigneter Fläche kind=none mit Begründung.'];
 const reqs=scene?.requirements||[];if(!reqs.length||reqs.length>18)return ['1 bis 18 requirements erforderlich'];
 for(const [i,r] of reqs.entries()){
 const spec=catalog.targetSceneFeatures?.[r.feature];
 if(!spec||!spec.roles?.includes(r.role)||!catalog.roles?.[r.role]?.length){errors.push(`Requirement ${i+1}: gültige feature/role-Kombination wählen`);continue;}
 if(!Number.isInteger(r.count)||r.count<1||r.count>6||!Number.isFinite(r.forwardM)||!Number.isFinite(r.rightM)||Math.abs(r.forwardM)>(scene.placementVersion===VERSION?750:180)||Math.abs(r.rightM)>(scene.placementVersion===VERSION?750:180)){errors.push(`Requirement ${i+1}: Anzahl/Offsets ungültig`);continue;}
 if(r.count>1&&!['cluster','line'].includes(r.arrangement)){errors.push(`Requirement ${i+1}: cluster oder line verwenden; komplexe Form mit count=1 planen`);continue;}
 const size=radius(spec,r.feature),allowed=surfaces(spec,r);
 if(!allowed.length){errors.push(`Requirement ${i+1}: unzulässige Oberfläche`);continue;}
 if(spec.primaryRole&&r.role!==spec.primaryRole){errors.push(`Requirement ${i+1}: Suchziel benötigt ${spec.primaryRole}`);continue;}
 for(const p of offsets(r)){const issue=(scene.placementVersion===VERSION?siteError(scene,r,p,geo):'')||placementError(p,size,geo,allowed[0],scene.placementVersion===VERSION?r.siteId:null);if(issue)errors.push(`Requirement ${i+1} (${p.y},${p.x}): ${issue}`);for(const prev of points)if(Math.hypot(p.x-prev.x,p.y-prev.y)<size+prev.radius+1)errors.push(`Requirements ${prev.req+1}/${i+1}: Objektabstand zu klein (mindestens ${size+prev.radius+1} m)`);points.push({...p,radius:size,req:i});}
 }
 const budget=scene.density==='busy'?18:scene.density==='sparse'?9:14;if(points.length>budget)errors.push(`Objektbudget ${budget} überschritten (${points.length})`);
 return [...new Set(errors)].slice(0,12);
}
const api={VERSION,correctionOptions,workAreas,hasPlacementSite,siteOptions,siteError,enroll,surfaces,radius,enabled,local,inside,edgeDistance,geometry,placementError,offsets,validate};root.MissionPoiScenePlacementCore=api;root.MissionReporterSceneCore=api;if(typeof module==='object')module.exports=api;
})(typeof window==='object'?window:globalThis);
