(function(root){
 'use strict';
 const memory=new Map(),cooldown=new Map(),MAX=16,CACHE='ga-airport-information-v1',TTL={wikipedia:7*86400000,faa:12*3600000};
 async function load(target,options={}){
  const core=root.MissionAirportInformationCore,loc=core.location(target);if(loc.lat===null||loc.lon===null)return null;
  const now=options.now||Date.now(),began=Date.now(),budget=Math.max(0,Math.min(3000,Number.isFinite(options.budgetMs)?options.budgetMs:3000)),fetcher=options.fetch||root.fetch.bind(root),controller=new AbortController(),parts={retrieval:{budgetMs:budget,sources:{}}};let closed=false,timer;
  const key=core.identifiers(target).join('-')+':'+loc.lat.toFixed(4)+','+loc.lon.toFixed(4);
  const valid=(entry,kind)=>entry&&now>=entry.at&&now-entry.at<TTL[kind]&&!(kind==='faa'&&entry.data?.effectiveUntil&&now>=Date.parse(entry.data?.effectiveUntil));
  async function cached(kind,operation,suffix=''){const k=kind+':'+key+suffix;let entry=memory.get(k);if(!valid(entry,kind)&&options.persistent!==false&&root.caches){try{const c=await root.caches.open(CACHE),r=await c.match('https://ga-airport-cache.invalid/'+encodeURIComponent(k));if(r)entry=await r.json();}catch(_){}}
   if(valid(entry,kind))return entry.data?{...entry.data,cached:true}:null;
   const pause=cooldown.get(kind)||0;if(Date.now()<pause)throw new Error('source_cooldown_until_'+new Date(pause).toISOString());
   const data=await operation();if(closed)return data;entry={at:now,data};memory.delete(k);memory.set(k,entry);while(memory.size>MAX)memory.delete(memory.keys().next().value);
   if(options.persistent!==false&&root.caches)(async()=>{try{const c=await root.caches.open(CACHE);await c.put('https://ga-airport-cache.invalid/'+encodeURIComponent(k),new Response(JSON.stringify(entry),{headers:{'Content-Type':'application/json'}}));const keys=await c.keys();for(const r of keys.slice(0,Math.max(0,keys.length-MAX)))await c.delete(r);}catch(_){}})();return data;
  }
  async function json(url){const wiki=url.includes('.wikipedia.org/'),kind=wiki?'wikipedia':'faa';
   const r=await fetcher(url,{signal:controller.signal,...(wiki?{headers:{'Api-User-Agent':'VFRMultitool/1.0 (https://github.com/iNherjer/GA-Dispatcher-Alpha)'}}:{})});
   if(!r.ok){if(r.status===429||r.status===503){const raw=r.headers.get('Retry-After'),seconds=Number(raw);const wait=raw?(Number.isFinite(seconds)?seconds*1000:Date.parse(raw)-Date.now()):60000;cooldown.set(kind,Date.now()+Math.max(5000,Number.isFinite(wait)?wait:60000));}let reason='';if(!wiki)try{reason=String((await r.json()).error||'').slice(0,100);}catch(_){}throw new Error('HTTP '+r.status+(reason?': '+reason:''));}
   const data=await r.json();if(data?.error)throw new Error('upstream_api_error');return data;
  }
  function task(name,op,commit){parts.retrieval.sources[name]={status:'pending'};const ts=Date.now();return Promise.resolve().then(op).then(value=>{if(closed)return;if(value){commit(value);parts.retrieval.sources[name]={status:'available',ms:Date.now()-ts,cached:!!value.cached};}else parts.retrieval.sources[name]={status:'no_match',ms:Date.now()-ts};}).catch(e=>{if(!closed)parts.retrieval.sources[name]={status:'unavailable',ms:Date.now()-ts,reason:String(e.message||e).slice(0,100)};});}
  const tasks=['de','en'].map(language=>task('wikipedia-'+language,()=>cached('wikipedia',async()=>{
   const q=new URLSearchParams({action:'query',generator:'geosearch',ggscoord:loc.lat+'|'+loc.lon,ggsradius:'4000',ggslimit:'10',prop:'extracts|coordinates|pageprops|info',explaintext:'1',exintro:'1',exchars:'1200',exlimit:'max',inprop:'url',format:'json',origin:'*'});
   const selected=core.selectWiki(target,await json('https://'+language+'.wikipedia.org/w/api.php?'+q),language);
   if(!selected)return null;
   // Keep the verified intro if the full-article request exceeds the shared deadline.
   if(!closed&&(language==='de'||!parts.wiki))parts.wiki=selected;
   const article=new URLSearchParams({action:'query',titles:selected.title,prop:'extracts|coordinates|pageprops|info',explaintext:'1',exlimit:'1',inprop:'url',format:'json',origin:'*'});
   const full=core.selectWiki(target,await json('https://'+language+'.wikipedia.org/w/api.php?'+article),language);
   return full?.extract?full:selected;
  },':'+language),v=>{if(language==='de'||!parts.wiki)parts.wiki=v;}));
  const own=options.snapshots||root.gaAirportDetailsHost?.snapshots||root.getOpenAipSnapshotsForBounds;
  if(target.runways?.length)parts.own=target;
  else if(own)tasks.push(task('ownAirport',async()=>{const bounds={west:loc.lon-.03,east:loc.lon+.03,south:loc.lat-.03,north:loc.lat+.03};const payloads=await own(bounds,'airports');return core.matchAirport(target,(Array.isArray(payloads)?payloads:[payloads]).flatMap(p=>p?.airports||[]));},v=>parts.own=v));
  const country=String(target.country||target.isoCountry||'').toUpperCase();const faaId=String(target.faa||target.altIdentifier||target.localCode||target.ident||target.icao||'').toUpperCase().replace(/^K(?=[A-Z]{3}$)/,'');
  if(country==='US'&&/^[A-Z0-9]{2,5}$/.test(faaId))tasks.push(task('faa',()=>cached('faa',async()=>core.acceptFaa(target,await json((options.faaBase||'https://ga-proxy.einherjer.workers.dev')+'/api/airport-context/faa?ident='+encodeURIComponent(faaId)))),v=>parts.faa=v));
  if(options.terrain)parts.terrain=options.terrain;else if(options.terrainLoader)tasks.push(task('terrain',()=>options.terrainLoader(loc.lat,loc.lon),v=>parts.terrain=v));
  await Promise.race([Promise.all(tasks),new Promise(resolve=>{timer=setTimeout(resolve,budget);})]);closed=true;clearTimeout(timer);controller.abort();
  for(const s of Object.values(parts.retrieval.sources))if(s.status==='pending'){s.status='timeout';s.ms=Date.now()-began;}
  parts.retrieval.elapsedMs=Date.now()-began;parts.retrieval.partial=Object.values(parts.retrieval.sources).some(s=>s.status==='timeout'||s.status==='unavailable');
  return core.context(target,parts);
 }
 // Local opt-in API: no production caller until the extra request is approved.
 async function generate(context={},options={}){
  const core=root.MissionAirportInformationCore,c=context.airportInfoContext;
  if(context.missionType!=='bush'||!c?.airport||!Array.isArray(c.sources)||typeof options.request!=='function')return {parsed:null,status:'not_applicable'};
  const budget=Math.max(0,Math.min(16000,Number.isFinite(options.budgetMs)?options.budgetMs:14000));let timer;
  try{return await Promise.race([
   Promise.resolve().then(()=>options.request(core.informationPrompt(c,context.environmentContext||null))).then(r=>({parsed:r?.parsed||null,status:r?.parsed?'ready':'unavailable'})).catch(()=>({parsed:null,status:'unavailable'})),
   new Promise(resolve=>{timer=setTimeout(()=>resolve({parsed:null,status:'timeout'}),budget);})
  ]);}finally{clearTimeout(timer);}
 }
 function clear(){const block=root.document?.getElementById('airportFlightBriefing');if(block)block.hidden=true;for(const id of ['airportFlightBriefingSources','airportDestinationInfoSources']){const el=root.document?.getElementById(id);if(el)el.replaceChildren();}}
 function render(m,point){const core=root.MissionAirportInformationCore,c=m?.airportInfoContext,info=m?.airportInformation;clear();if(!c?.airport||!Array.isArray(c.sources)||!info||typeof info.flightBriefing!=='string'||typeof info.destinationInfo!=='string'||!Array.isArray(info.sourceIds)||m.missionType!=='bush'||core.distance(c.airport,point||{lat:m.targetLat??m.initialTargetLat,lon:m.targetLon??m.initialTargetLon})>.15)return false;
  const doc=root.document,b=doc?.getElementById('airportFlightBriefing'),t=doc?.getElementById('airportFlightBriefingText'),d=doc?.getElementById('wikiDestDescText');if(b&&t){t.textContent=info.flightBriefing;b.hidden=false;}if(d){const arrival=core.arrivalNote(m,c);d.textContent=info.destinationInfo+(arrival?'\n\n'+arrival:'');}
  for(const id of ['airportFlightBriefingSources','airportDestinationInfoSources']){const el=doc?.getElementById(id);if(!el)continue;const label=doc.createElement('span');label.textContent='Grundlage: eigene Flugplatzdaten';el.append(label);for(const s of c.sources.filter(s=>info.sourceIds.includes(s.id)||(info.generated&&['wikipedia','faa'].includes(s.kind)))){if(!/^https:\/\//.test(s.url||s.sourceUrl||''))continue;el.append(doc.createTextNode(' · '));const a=doc.createElement('a');a.href=s.url||s.sourceUrl;a.target='_blank';a.rel='noopener noreferrer';a.textContent=s.kind==='faa'?'FAA ('+(s.effectiveFrom||'Datenzyklus')+')':s.title;el.append(a);}}
  return true;
 }
 root.MissionAirportInformationBrowser={load,generate,render,clear,clearCache:()=>memory.clear()};
})(typeof window!=='undefined'?window:globalThis);
