import fs from 'node:fs';
import vm from 'node:vm';
import sightseeing from '../mission-knowledge-briefing-core.js';
import {gunzipSync} from 'node:zlib';
const source=fs.readFileSync('app.js','utf8');
const store=new Map();
const env={window:{MissionKnowledgeBriefingCore:sightseeing},fetch,URLSearchParams,AbortController,setTimeout,clearTimeout,console,Date,Math,Map,Set,performance,localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)},document:{getElementById:()=>null}};
vm.createContext(env);
function extract(name){let p=source.indexOf('function '+name+'(');if(p<0)throw Error('Missing '+name);const async=source.slice(p-6,p)==='async ';let e=source.indexOf('\n}',p);while(e>=0){let s=(async?'async ':'')+source.slice(p,e+2);try{new vm.Script(s);return s;}catch{}e=source.indexOf('\n}',e+2);}throw Error('Invalid '+name);}
const names=[...source.matchAll(/^(?:async )?function (\w+)\(/gm)].map(m=>m[1]);const installed=new Set(); function load(n){if(installed.has(n))return;installed.add(n);const code=extract(n);for(const dep of names)if(dep!==n&&new RegExp('\\b'+dep+'\\b').test(code))load(dep);vm.runInContext(code,env);}
load('findTaggedTilePOI');load('_poiParseTilePayload');
function constant(name){let m=source.match(new RegExp('(?:const|let) '+name+'\\s*='));if(!m)throw Error('Missing constant '+name);let p=m.index,e=source.indexOf(';',p);while(e>=0){let s=source.slice(p,e+1);try{new vm.Script(s);vm.runInContext(s,env);return;}catch(x){if(!(x instanceof SyntaxError)&&x.name!=='SyntaxError')throw x;}e=source.indexOf(';',e+1);}throw Error(name);}
for(const n of ['POI_TILE_EDGE_NM','POI_TILE_STEP_LAT','POI_TILE_STEP_LON','POI_TILE_FETCH_PARALLEL','POI_TILE_MAX_KEYS'])constant(n);
for(const n of [...source.matchAll(/^(?:const|let) (POI_KNOWLEDGE_\w+)\s*=/gm)].map(m=>m[1]))constant(n);
for(const n of ['_poiKnowledgeWikiCooldownUntil','_poiEducationalContextCache'])constant(n);
const parsed=[];const tileCache=new Map();
env._poiFetchTileFeatures=async(key,opt)=>{const cacheKey=key+'|'+opt.includeCore+'|'+opt.includeInfra;if(tileCache.has(cacheKey))return tileCache.get(cacheKey);const [i,j]=key.split('|');let rows=[];for(const layer of ['poi',...(opt.includeCore?['core']:[]),...(opt.includeInfra?['infra']:[])]){let p=`obstacles/${layer}-tiles/${i}/${j}.json.gz`;if(fs.existsSync(p)){rows.push(...env._poiParseTilePayload(JSON.parse(gunzipSync(fs.readFileSync(p)))).map(f=>({...f,fetchSource:'local-'+layer+'-split'})));}}tileCache.set(cacheKey,rows);return rows;};
// Read-only data transport adapter; production classification, scoring and history are unchanged.
const output=process.argv[2]||'/tmp/poi-sightseeing-discovery.json';
const categories=process.argv[3]?process.argv[3].split(','):['all','all','all'];
for(let round=0;round<categories.length;round++){
 for(let tries=0;tries<50;tries++)try{const result=await env.findTaggedTilePOI(48.27917,8.42833,15,65,'any',categories[round],'sightseeing_tour');parsed.push(result);console.log('Round',round+1,result?.n,result?(result.knowledgeContext?.sourceUrl||'settlement / personal possible'):'no supported target');break;}catch(e){let m=e.message.match(/^(\w+) is not defined$/);if(!m)throw e;console.log('Loading',m[1]);constant(m[1]);}
}
fs.writeFileSync(output,JSON.stringify({start:'EDTW',distanceNm:[15,65],scope:'Existing POI sightseeing finder, actual local tiles, persistent history within three calls; no seeded destinations, no Gemini choice or new group logic',categories,targets:parsed},null,2));console.log(parsed.map(p=>({name:p?.n,category:p?.poiCategory,lat:p?.lat,lon:p?.lon,distance:p?.poiLookup?.selectedDistNm})));
