/* Geographic source discovery for APT ground visits; no scenario catalogue. */
(function(root){
'use strict';
const VERSION='sightseeing-sources.v1',RADIUS_KM=30;
const geo=typeof module!=='undefined'&&module.exports?require('./mission-private-context-core.js'):root.MissionPrivateContextCore;
const clean=(v,n)=>typeof v==='string'?v.replace(/\s+/g,' ').trim().slice(0,n):'';
function url(target,near=false){
 const q=new URLSearchParams({action:'query',prop:'coordinates|description|info',colimit:'max',inprop:'url',format:'json',origin:'*'});
 if(near){q.set('generator','geosearch');q.set('ggscoord',`${target.lat}|${target.lon}`);q.set('ggsradius','10000');q.set('ggslimit','100');}
 else{q.set('generator','search');q.set('gsrsearch',`nearcoord:30km,${target.lat},${target.lon}`);q.set('gsrlimit','100');}
 return `https://de.wikipedia.org/w/api.php?${q}`;
}
function candidates(raw,target){
 return Object.values(raw?.query?.pages||{}).flatMap(p=>{
  const c=p.coordinates?.[0],name=clean(p.title,180);
  if(!c||!name||!Number.isInteger(p.pageid)||p.pageid<=0||geo.distanceKm(target,c)>RADIUS_KM)return [];
  return [{id:'wiki-'+p.pageid,pageid:p.pageid,name,lat:c.lat,lon:c.lon,distanceKm:Math.round(geo.distanceKm(target,c)*10)/10,description:clean(p.description,250),source:`https://de.wikipedia.org/?curid=${p.pageid}`}];
 });
}
function places(raw,target,at=new Date().toISOString()){
 const rows=candidates(raw,target),pages=raw?.query?.pages||{};
 return rows.flatMap(row=>{const description=clean(pages[row.pageid]?.extract,2200);return description.length>=80?[{...row,retrievedAt:at,facts:[{id:row.id+'-intro',text:description}]}]:[];}).slice(0,8);
}
const memory=new Map(),pending=new Map();
async function discover(target,fetcher){
 const key=target.lat.toFixed(4)+','+target.lon.toFixed(4),cached=memory.get(key);
 if(cached&&Date.now()-cached.at<86400000)return cached.rows;
 if(pending.has(key))return pending.get(key);
 const job=(async()=>{const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),8000);
 try{const results=await Promise.allSettled([false,true].map(async near=>{const res=await fetcher(url(target,near),{signal:abort.signal});if(!res.ok)throw Error('Ortsrecherche nicht erreichbar.');return candidates(await res.json(),target);}));const byId=new Map();for(const r of results)if(r.status==='fulfilled')for(const p of r.value)byId.set(p.id,p);const rows=[...byId.values()];if(!rows.length)throw Error('Keine belegten Ortskandidaten innerhalb von 30 km gefunden.');memory.set(key,{at:Date.now(),rows});while(memory.size>16)memory.delete(memory.keys().next().value);return rows;}finally{clearTimeout(timer);pending.delete(key);}})();pending.set(key,job);return job;
}
async function resolve(target,fetcher=root.fetch,select){
 if(!Number.isFinite(target?.lat)||Math.abs(target.lat)>90||!Number.isFinite(target?.lon)||Math.abs(target.lon)>180)throw Error('Ungültiger Zielflugplatz.');
 const pool=await discover(target,fetcher);
 // The model chooses what to research from real geocoded names; no invented POI enters the fact stage.
 const ids=await select(pool);
 if(!Array.isArray(ids)||!ids.length||ids.length>8||new Set(ids).size!==ids.length||ids.some(id=>!pool.some(p=>p.id===id)))throw Error('Die Ortsauswahl enthält unbekannte Quellen.');
 const q=new URLSearchParams({action:'query',pageids:ids.map(id=>pool.find(p=>p.id===id).pageid).join('|'),prop:'coordinates|extracts|info',colimit:'max',exintro:'1',explaintext:'1',exsentences:'8',exlimit:'max',inprop:'url',format:'json',origin:'*'});
 const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),8000);
 try{const res=await fetcher(`https://de.wikipedia.org/w/api.php?${q}`,{signal:abort.signal});if(!res.ok)throw Error('Ortsbeschreibungen nicht erreichbar.');const rows=places(await res.json(),target).filter(p=>ids.includes(p.id));if(!rows.length)throw Error('Keine ausreichend beschriebenen Besuchsziele gefunden.');return rows;}finally{clearTimeout(timer);}
}
const api={VERSION,RADIUS_KM,url,candidates,places,resolve};root.MissionSightseeingContextCore=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
