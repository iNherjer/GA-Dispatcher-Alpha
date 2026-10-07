// Public read-only sources; no keys, no existing missions, no paid model calls.
import fs from 'node:fs';import vm from 'node:vm';import path from 'node:path';import {fileURLToPath} from 'node:url';import {webcrypto} from 'node:crypto';
import {handleAirportContextFaa} from './cloudflare-worker/airport-context-faa.mjs';
import '../mission-airport-information-core.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),core=globalThis.MissionAirportInformationCore;
const local=JSON.parse(fs.readFileSync(path.join(root,'data/faa-local-airports.json'))).airports,europe=JSON.parse(fs.readFileSync(path.join(root,'data/airports-backup-pre-openaip-20260815.json')));
const ids=['U60','3U2','U87','S81','EDTW','EDTO','EDSH','ESSA'],results=[];
const networkCooldown=new Map();
const runRounds=Number(process.env.GA_AIRPORT_PROBE_ROUNDS)||2;
for(let round=1;round<=runRounds;round++)for(const id of ids){
 const target=local[id]||europe[id],requests=[],workerEntries=new Map(),workerCache={match:async k=>workerEntries.get(k.url)?.clone(),put:async(k,r)=>{workerEntries.set(k.url,r.clone());}};
 const publicFetch=async(url,opts={})=>{const ts=Date.now(),entry={url:String(url)};requests.push(entry);const wiki=String(url).includes('.wikipedia.org/');if(wiki&&Date.now()<(networkCooldown.get('wikipedia')||0)){entry.status='probe_cooldown';return new Response('{}',{status:429,headers:{'Retry-After':String(Math.ceil((networkCooldown.get('wikipedia')-Date.now())/1000))}});}try{const signal=AbortSignal.any([...(opts.signal?[opts.signal]:[]),AbortSignal.timeout(3000)]),r=await fetch(url,{...opts,signal,headers:{...opts.headers,...(wiki?{'User-Agent':'VFRMultitool/1.0 (https://github.com/iNherjer/GA-Dispatcher-Alpha)'}:{})}});entry.status=r.status;entry.retryAfter=r.headers.get('Retry-After');if(wiki&&r.status===429){networkCooldown.set('wikipedia',Date.now()+Math.max(5000,Number(entry.retryAfter)*1000||60000));}entry.headersMs=Date.now()-ts;return r;}catch(e){entry.status='error';entry.reason=e.name;entry.headersMs=Date.now()-ts;throw e;}};
 const window={MissionAirportInformationCore:core};const env={window,fetch:publicFetch,AbortController,setTimeout,clearTimeout,URL,URLSearchParams,TextDecoder,Uint8Array,DataView,ArrayBuffer,crypto:webcrypto,Response,Date,Map};
 vm.runInNewContext(fs.readFileSync(path.join(root,'aviation-data-hosted.js'),'utf8'),env);
 vm.runInNewContext(fs.readFileSync(path.join(root,'mission-airport-information-browser.js'),'utf8'),env);
 const sourceFetch=(url,opts)=>String(url).includes('/api/airport-context/faa?')?handleAirportContextFaa(new Request(url),{fetcher:publicFetch,cache:workerCache}):publicFetch(url,opts);
 const snapshots=async bounds=>[await window.gaHostedAviationData.fetchSnapshot(bounds,{collections:['airports']})];
 for(const mode of ['cold','warm']){
  const c=await window.MissionAirportInformationBrowser.load(target,{fetch:sourceFetch,snapshots,budgetMs:3000,persistent:false});
  const row={round,id,mode,retrieval:c.retrieval,runways:c.airport.runways.length,externalSources:c.sources.filter(s=>s.kind!=='pilot-handbook').map(s=>({id:s.id,title:s.title,language:s.language,remarks:s.remarks?.length})),context:c};results.push(row);
  console.log(JSON.stringify({round,id,mode,ms:c.retrieval.elapsedMs,partial:c.retrieval.partial,runways:row.runways,sources:row.externalSources,states:c.retrieval.sources}));
 }
 results[results.length-1].requests=requests;
}
const times=mode=>results.filter(r=>r.mode===mode).map(r=>r.retrieval.elapsedMs).sort((a,b)=>a-b),stats=mode=>{const t=times(mode),rows=results.filter(r=>r.mode===mode);return {count:t.length,minMs:t[0],medianMs:t[Math.floor(t.length/2)],maxMs:t.at(-1),withinBudget:rows.filter(r=>r.retrieval.elapsedMs<=3050).length,withoutDeadline:rows.filter(r=>!Object.values(r.retrieval.sources).some(s=>s.status==='timeout')).length,withExternalFacts:rows.filter(r=>r.externalSources.length).length,withOwnRunways:rows.filter(r=>r.runways).length};};
const report={createdAt:new Date().toISOString(),scope:'Live public Wikipedia, live FAA via LOCAL unpublished Worker handler, live hosted own airport packs. No browser CORS/production edge/terrain/AI latency claim.',cold:stats('cold'),warm:stats('warm'),results};
const out=process.env.GA_AIRPORT_PROBE_OUT||'/tmp/ga-airport-information-live-report.json';fs.writeFileSync(out,JSON.stringify(report,null,2));console.log(JSON.stringify({report:out,cold:report.cold,warm:report.warm}));
