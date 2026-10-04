// Bridge composed placement into the original private smoke contract, never into a second spawn path.
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./mission-reporter-scene-core.js'):root.MissionReporterSceneCore);if(typeof module==='object'&&module.exports)module.exports=api;else root.MissionFireSceneCore=api;})(typeof globalThis!=='undefined'?globalThis:this,function(placementCore){
'use strict';
const clone=x=>JSON.parse(JSON.stringify(x));
const publicScene=()=>({kind:'none',roles:[],requirements:[],features:[],density:'none',notes:'Feuerwache: Befund bleibt bis zur Beobachtung offen.'});
function planning(scenario,md,contract,pax,geo=null){
 if(scenario?.type!=='fire_watch'||scenario.truth!=='fire'||!scenario.smoke?.sites?.length)return null;
 const target=scenario.target;if(!Number.isFinite(target?.lat)||!Number.isFinite(target?.lon))return null;
 const anchor={name:target.name,lat:target.lat,lon:target.lon,altFt:target.altFt};
 const count=scenario.smoke.sites.length;
 const intent={summary:'Private Platzierung einer simulierten Rauchlage für den bestehenden Feuerwacht-Auftrag.',visibleIdeas:[`Genau ${count} getrennte Rauchgruppen auf geeigneten Oberflächen im Zielbereich. Pro Gruppe genau ein requirement mit feature smoke_light und individuellen forwardM/rightM zwischen 350 m und 2200 m vom Suchgebietsmittelpunkt auf einer gelieferten, passenden Fläche. Die Rauchemitter pro Gruppe werden separat vom vorhandenen Vertrag bestimmt.`],densityHint:'normal',notes:'Koordinaten beziehen sich ausschließlich auf den vorgegebenen sceneAnchor bei heading=0: forwardM=Norden, rightM=Osten. Keine Änderung von Wahrheit, Aufgabe, Anzahl der Gruppen oder Brandumfang. Keine weiteren Objekte. Rauchpositionen auf geeignete Flächen setzen, ohne Bodenbewuchs aus dem Ortsnamen abzuleiten. Falls kein passender Ort belegt ist, keine Platzierung erfinden.'};
 const truth={...(md.missionTruth||contract.missionTruth||{}),mainTarget:anchor,sceneAnchor:anchor};
 const plan={status:'ready',sceneKind:'fire_watch',sceneDensity:'normal',objectFamilies:['smoke_light'],plan:{sceneKind:'fire_watch',sceneDensity:'normal',objectFamilies:['smoke_light']}};
 return {missionData:{...clone(md),fireSearchScene:geo?{schema:'fire-search-scene.v2',origin:geo.origin,radiusM:geo.radiusM,candidates:geo.candidates,geometry:[...geo.shapes,...(geo.exclusions||[]).map(s=>({...s,type:'exclusion',blocked:true}))],task:'Mittelpunkt ist nur das Suchgebiet, nicht der bekannte Fundort. Rauchgruppen nur auf gelieferten Flächen, nie auf Wasser, Parkplatz, Straße oder Gebäude. Kandidaten dürfen individuell innerhalb geprüfter Geometrie verändert werden.'}:null,heading:0,sceneIntent:intent,missionTruth:truth,missionPlanV2:plan},missionContract:{...clone(contract),sceneIntent:intent,missionTruth:truth,missionPlanV2:plan},passenger:pax,fallback:{targetScene:publicScene(),aptArrivalPlan:null}};
}
function sceneSpec(raw){
 if(Array.isArray(raw)){if(raw.length!==1)return null;raw=raw[0];}
 const spec=raw?.targetScene||raw;
 return spec?.kind==='fire_watch'?spec:null;
}
function placement(scenario,scene,geo=null){
 scene=sceneSpec(scene);
 if(scenario?.truth!=='fire'||scenario?.type!=='fire_watch'||scene?.kind!=='fire_watch')return null;
 const smoke=(scene?.requirements||[]).filter(r=>['smoke_light','smoke_heavy'].includes(r.feature));
 const original=scenario.smoke?.sites||[];if(!original.length||smoke.length!==original.length)return null;
 if((scene.requirements||[]).some(r=>!['smoke_light','smoke_heavy'].includes(r.feature)))return null;
 const origin=scenario.target,limit=Math.min(geo?.radiusM||180,Number(scenario.targetAreaNm||1.5)*1852);
 if(!Number.isFinite(origin?.lat)||!Number.isFinite(origin?.lon)||Math.abs(origin.lat)>=85)return null;
 const sites=[];
 for(const [i,r] of smoke.entries()){
  if(!Number.isFinite(r.forwardM)||!Number.isFinite(r.rightM)||Math.hypot(r.forwardM,r.rightM)>limit)return null;
  if(sites.some(p=>Math.hypot(p.n-r.forwardM,p.e-r.rightM)<150))return null;
  if(geo&&surfaceError({x:r.rightM,y:r.forwardM},Math.max(40,Number(original[i].radiusM)||0),geo))return null;
  sites.push({n:r.forwardM,e:r.rightM,site:{...original[i],lat:origin.lat+r.forwardM/111320,lon:origin.lon+r.rightM/(111320*Math.cos(origin.lat*Math.PI/180))}});
 }
 const next=clone(scenario);next.smoke.sites=sites.map(p=>p.site);
 const byId=new Map(next.smoke.sites.map(p=>[p.siteId,p]));
 for(const fire of next.fire?.sites||[]){const source=byId.get(fire.smokeSiteId);if(!source)return null;Object.assign(fire,{lat:source.lat,lon:source.lon,altFt:source.altFt});}
 next.placement={schema:'fire-scene-placement.v1',source:'scene-composer',origin:{lat:origin.lat,lon:origin.lon},headingDeg:0};
 return next;
}
function relationRings(members){
 const same=(a,b)=>a&&b&&Math.abs(a.lat-b.lat)<1e-7&&Math.abs(a.lon-b.lon)<1e-7;
 const pending=members.map(m=>m.geometry).filter(g=>Array.isArray(g)&&g.length>=2).map(g=>g.slice()),rings=[];
 if(pending.length!==members.length)return null;
 while(pending.length){let ring=pending.shift();while(!same(ring[0],ring.at(-1))){const i=pending.findIndex(g=>same(ring.at(-1),g[0])||same(ring.at(-1),g.at(-1)));if(i<0)return null;let g=pending.splice(i,1)[0];if(!same(ring.at(-1),g[0]))g=g.reverse();ring.push(...g.slice(1));}if(ring.length<4)return null;rings.push(ring);}
 return rings;
}
function geometry(raw,origin,radiusM=2200){
 const elements=[...(raw.elements||[]).filter(e=>e.type!=='relation')],holes=[];let unclosedWater=false;
 for(const e of raw.elements||[]){if(e.type!=='relation')continue;const water=e.tags?.natural==='water'||e.tags?.waterway,land=e.tags?.landuse||e.tags?.natural==='wood';if(!water&&!land)continue;
  const rings=Array.isArray(e.geometry)?[e.geometry]:relationRings((e.members||[]).filter(m=>m.type==='way'&&m.role!=='inner'));
  const inner=relationRings((e.members||[]).filter(m=>m.type==='way'&&m.role==='inner'));
  if(!rings?.length||inner===null){if(water)unclosedWater=true;continue;}
  rings.forEach((geometry,i)=>elements.push({type:'way',id:`relation-${e.id}-${i}`,tags:e.tags,geometry}));
  if(!water)inner.forEach(geometry=>holes.push({type:'way',tags:{building:'yes'},geometry}));
 }
 const base=placementCore.geometry({...raw,elements},origin);
 const exclusions=placementCore.geometry({elements:holes},origin).shapes;
 const geo={...base,schema:'fire-search-geometry.v2',radiusM:Math.min(2200,radiusM),status:unclosedWater?'incomplete':base.status,candidates:[],exclusions};
 for(let y=-geo.radiusM;y<=geo.radiusM;y+=200)for(let x=-geo.radiusM;x<=geo.radiusM;x+=200)if(!surfaceError({x,y},70,geo))geo.candidates.push({x,y});
 // Distributed candidates, not the closest point under the POI marker.
 geo.candidates=geo.candidates.filter((p,i)=>i%Math.max(1,Math.floor(geo.candidates.length/80))===0).slice(0,80);
 return geo;
}
function surfaceError(p,r,geo){
 if(geo?.status!=='mapped'||Math.hypot(p.x,p.y)<350||Math.hypot(p.x,p.y)+r>geo.radiusM)return 'Keine geprüfte Fläche im Suchgebiet';
 const allowed=new Set(['forest','meadow','grass','farmland','orchard','vineyard','grassland']);
 const fits=s=>s.closed&&allowed.has(s.type)&&placementCore.inside(p,s.points)&&placementCore.edgeDistance(p,s.points)>r;
 if(!geo.shapes.some(fits))return 'Keine passende Vegetations-/Landfläche';
 for(const s of [...geo.shapes,...(geo.exclusions||[])])if(!allowed.has(s.type)&&(s.blocked||s.type==='parking'||s.type==='industrial'||s.type==='commercial')&&((s.closed&&placementCore.inside(p,s.points))||placementCore.edgeDistance(p,s.points)<r+(s.buffer||0)))return 'Wasser, Verkehrsfläche oder Gebäude im Bereich';
 return '';
}
function mappedFallback(scenario,geo){
 const reqs=[];
 for(const p of geo.candidates||[]){if(reqs.every(r=>Math.hypot(r.forwardM-p.y,r.rightM-p.x)>=150))reqs.push({feature:'smoke_light',forwardM:p.y,rightM:p.x});if(reqs.length===(scenario.smoke?.sites?.length||0))break;}
 const next=placement(scenario,{kind:'fire_watch',requirements:reqs},geo);if(next)next.placement.source='mapped-fallback';return next;
}
return {publicScene,planning,placement,geometry,surfaceError,mappedFallback,relationRings,sceneSpec};
});
