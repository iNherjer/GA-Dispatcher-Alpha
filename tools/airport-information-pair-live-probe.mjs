// Public read-only source probe; no model calls, keys or existing mission state.
import fs from 'node:fs';import vm from 'node:vm';import path from 'node:path';import {fileURLToPath} from 'node:url';import {webcrypto} from 'node:crypto';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');await import(root+'/mission-airport-information-core.js');
const core=globalThis.MissionAirportInformationCore,local=JSON.parse(fs.readFileSync(path.join(root,'data/faa-local-airports.json'))).airports,db=JSON.parse(fs.readFileSync(path.join(root,'data/airports-backup-pre-openaip-20260815.json')));
const requests=[],window={MissionAirportInformationCore:core};
const publicFetch=async(url,opts={})=>{const row={url:String(url),at:Date.now()};requests.push(row);try{const r=await fetch(url,{...opts,signal:AbortSignal.any([...(opts.signal?[opts.signal]:[]),AbortSignal.timeout(3000)]),headers:{...opts.headers,...(String(url).includes('wikipedia.org')?{'User-Agent':'VFRMultitool/1.0 (https://github.com/iNherjer/GA-Dispatcher-Alpha)'}:{})}});row.status=r.status;row.ms=Date.now()-row.at;return r;}catch(e){row.status=e.name;row.ms=Date.now()-row.at;throw e;}};
window.fetch=publicFetch;
const env={window,fetch:publicFetch,AbortController,setTimeout,clearTimeout,URL,URLSearchParams,TextDecoder,Uint8Array,DataView,ArrayBuffer,crypto:webcrypto,Response,Date,Map};
for(const f of ['aviation-data-hosted.js','mission-airport-information-browser.js'])vm.runInNewContext(fs.readFileSync(path.join(root,f),'utf8'),env);
const snapshots=async bounds=>[await window.gaHostedAviationData.fetchSnapshot(bounds,{collections:['airports']})];
const options={persistent:false,budgetMs:3000,fetch:publicFetch,snapshots};const results=[];
for(const [from,to] of [['KMYL','U60'],['EDTW','EDTO']]){
 const a=local[from]||db[from],b=local[to]||db[to];
 for(const mode of ['cold','warm']){const offset=requests.length,ts=Date.now(),contexts=await window.MissionAirportInformationBrowser.loadPair(a,b,{departure:options,target:options});
 const row={from,to,mode,elapsedMs:Date.now()-ts,requests:requests.slice(offset),contexts};results.push(row);
 console.log(JSON.stringify({from,to,mode,elapsedMs:row.elapsedMs,requests:row.requests.map(r=>({kind:r.url.includes('wikipedia')?'wiki':r.url.includes('/faa?')?'faa':'hosted',status:r.status})),places:Object.values(contexts).map(c=>({ident:c.airport.ident,runways:c.airport.runways.length,retrieval:c.retrieval}))}));}
}
fs.writeFileSync(process.env.GA_AIRPORT_PAIR_PROBE_OUT||'/tmp/ga-start-context-live-report.json',JSON.stringify({scope:'Production Wiki/FAA proxy and hosted packs, Node read-only; no terrain, model calls or browser CORS test',results},null,2));
