// Shared data acquisition for POI briefings; one cache/provider policy for all consumers.
(function(root){
'use strict';
const core=()=>root.MissionPoiBriefingSharedCore;
async function tile(layer,key) {
 const source=`obstacles/${layer}-tiles/${key}.json.gz`;
 try {
  const response=await fetch(source,{signal:AbortSignal.timeout(5000)});
  if(!response.ok)throw Error('unavailable');
  const bytes=new Uint8Array(await response.arrayBuffer());
  // Servers may already decompress .gz responses through Content-Encoding.
  const text=bytes[0]===31&&bytes[1]===139
   ?await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text()
   :new TextDecoder().decode(bytes);
  const d=JSON.parse(text), rows=layer==='core'?[...(d.core?.obs||[]),...(d.core?.lin||[])]:d[layer]?.poi||[];
  return {source,status:d.meta?.dataStatus||'available',generatedAt:d.generatedAt||null,rows};
 }catch{return {source,status:'unavailable',rows:[]};}
}
const environmentCache=new Map(),environmentInflight=new Map(),environmentCooldown=new Map();
const ENVIRONMENT_CACHE_KEY='ga_poi_environment_v1';
async function environment(target) {
 const key=target.lat.toFixed(6)+','+target.lon.toFixed(6),now=Date.now();
 if(!environmentCache.size)try {
  const stored=JSON.parse(localStorage.getItem(ENVIRONMENT_CACHE_KEY)||'[]');
  if(Array.isArray(stored))for(const [k,v] of stored.slice(-32))if(v?.expires>now&&Array.isArray(v.facts))environmentCache.set(k,v);
 }catch{}
 const cached=environmentCache.get(key);
 if(cached&&cached.expires>now)return cached.facts;
 if(environmentInflight.has(key))return environmentInflight.get(key);
 const request=(async()=>{
  let facts=[],ok=false;
  try {
   if((environmentCooldown.get('overpass')||0)>Date.now())throw Error('cooldown');
   const response=await fetch('https://overpass-api.de/api/interpreter',{method:'POST',headers:{'Content-Type':'text/plain;charset=UTF-8'},body:core().environmentQuery(target),signal:AbortSignal.timeout(10000)});
   if([406,429,503,504].includes(response.status))environmentCooldown.set('overpass',Date.now()+60000);
   if(response.ok){const payload=await response.json();if(!payload.remark&&Array.isArray(payload.elements)){facts=core().environmentFacts(target,payload);ok=true;}}
  }catch{}
  // A small direct OSM extract supplies local geometry if Overpass is unavailable.
  // Its smaller extent is never treated as complete coverage of the 1 NM area.
  if(!ok)try {
   if((environmentCooldown.get('osm')||0)>Date.now())throw Error('cooldown');
   const dy=600/111320,dx=dy/Math.cos(target.lat*Math.PI/180);
   const bbox=[target.lon-dx,target.lat-dy,target.lon+dx,target.lat+dy].join(',');
   const response=await fetch('https://api.openstreetmap.org/api/0.6/map.json?bbox='+bbox,{signal:AbortSignal.timeout(8000)});
   if([429,503,504].includes(response.status))environmentCooldown.set('osm',Date.now()+60000);
   if(response.ok&&Number(response.headers.get('content-length')||0)<6000000){
    const text=await response.text();
    if(text.length<6000000){const payload=JSON.parse(text);if(Array.isArray(payload.elements)){facts=core().environmentFacts(target,payload);ok=true;}}
   }
  }catch{}
  if(environmentCache.size>=32)environmentCache.delete(environmentCache.keys().next().value);
  environmentCache.set(key,{facts,expires:Date.now()+(ok?12*3600000:60000)});
  if(ok)try{const stored=JSON.stringify([...environmentCache]);if(stored.length<131072)localStorage.setItem(ENVIRONMENT_CACHE_KEY,stored);}catch{}
  return facts;
 })();
 environmentInflight.set(key,request);
 try{return await request;}finally{environmentInflight.delete(key);}
}
async function context(dest,terrainEnvelope=null) {
 const target=core().point(dest),radiusM=5556;
 let tiles=[],coverage=[];
 try {const keys=core().tileKeys(target,radiusM);tiles=await Promise.all(keys.flatMap(key=>['poi','core','infra'].map(layer=>tile(layer,key))));}
 catch {coverage=[{status:'outside-alpha-data-area'}];}
 const data=core().selectFacts(target,tiles.flatMap(t=>t.rows.map(r=>({...r,source:t.source,generatedAt:t.generatedAt}))),radiusM);
 coverage.push(...tiles.map(({rows,...meta})=>meta));
 // Only exact local source target identity may supply a factual target description.
 const matched=tiles.flatMap(t=>t.rows.map(r=>({...r,source:t.source}))).find(r=>r.name===target.name&&typeof r.lat==='number'&&typeof r.lon==='number'&&core().relation(target,r).distanceM<30);
 const kind=matched?.tunnel==='yes'?'Straßentunnel':matched?.waterway==='dam'?'Staumauer':matched?.infra_type==='bridge'||matched?.man_made==='bridge'?'Brücke':matched?.historic==='castle'?'Burg oder Schloss':['monument','memorial'].includes(matched?.historic)?'Denkmal':null;
 const targetFacts=kind?[{id:'target-kind',fact:`${target.name} ist in der lokalen Datenbank als ${kind} kartiert.`,source:matched.source}]:[];
 if(matched?.tunnel==='yes'&&matched.ref)targetFacts.push({id:'target-road',fact:`Durch den Tunnel verlaufen die Straßen ${matched.ref.split(';').join(' und ')}. Der gespeicherte Zielpunkt beschreibt das Bauwerk, kein bestimmtes Portal.`,source:matched.source});
 // Reuse the APT context service; only evidence for this POI may enter its story.
 // Nearby towns/attractions remain outside the story frame (POI focus lock).
 let region=null;
 try {region=await root.MissionPrivateContextCore?.resolveBrowser(target);}catch{}
 for(const place of region?.places||[]) {
  const name=String(place.name||'');
  if(place.evidence!=='wikipedia-coordinate'||!place.description||!place.source
    || !(name===target.name||name.startsWith(target.name+' ('))
    || typeof place.lat!=='number'||typeof place.lon!=='number'||core().relation(target,place).distanceM>150)continue;
  targetFacts.push({id:'target-place-'+targetFacts.length,fact:`${place.name}: ${place.description}`,source:place.source});
 }
 let knowledge=dest.knowledgeContext;
 // Reuse the existing exact-title Wikipedia transport, without the unrelated
 // educational-profile eligibility gate (which excludes road/tunnel targets).
 if(!knowledge&&typeof _fetchWikiExtractByTitle==='function')try {
  const wiki=await _fetchWikiExtractByTitle(target.name,{timeoutMs:5000});
  const coordinate=wiki?.page?.coordinates?.[0];
  const title=wiki?.title||'';
  if(wiki?.extract&&wiki.page?.fullurl&&coordinate&&
    (title===target.name||title.startsWith(target.name+' ('))&&
    typeof coordinate.lat==='number'&&typeof coordinate.lon==='number'&&core().relation(target,coordinate).distanceM<=150)
    targetFacts.push({id:'target-extract',fact:wiki.extract.slice(0,1600),source:wiki.page.fullurl});
 }catch{}
 if(knowledge?.ok===true&&knowledge.status==='accept'&&knowledge.exactTitle===true
   &&typeof knowledge.distanceKm==='number'&&knowledge.distanceKm<=0.15&&knowledge.sourceUrl
   &&(knowledge.title===target.name||knowledge.title.startsWith(target.name+' ('))) {
  for(const fact of (knowledge.facts||[]).slice(0,3))if(typeof fact.text==='string'&&fact.text.trim())
   targetFacts.push({id:'target-known-'+targetFacts.length,fact:fact.text,source:knowledge.sourceUrl});
 }
 return {id:`poi:${target.lat.toFixed(6)}:${target.lon.toFixed(6)}`,target,radiusM,...data,coverage,targetFacts,supplements:[],terrain:{status:'missing'},terrainEnvelope};
}

async function enrichSelected(c,ensureAlive) {
 const surroundings=await environment(c.target);ensureAlive?.();
 return {...c,environmentFacts:surroundings,targetFacts:[...(c.targetFacts||[]).filter(f=>f.scope!=='target-environment'),...surroundings]};
}
root.MissionPoiBriefingSharedBrowser={context,enrichSelected};
})(window);
