// One paid batch maximum. No writer/retry/search calls; geography uses the production resolver.
import fs from 'node:fs';
import path from 'node:path';
import {gunzipSync} from 'node:zlib';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url);
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const geo=require('../mission-private-context-core.js');
require('../mission-private-outing-core.js');
const core=require('../mission-private-episode-v6.js');
const out=path.join(root,process.argv.find(x=>x.startsWith('--out='))?.slice(6)||'analysis/private-picker-v6-3-live.json');
if(process.argv[2]!=='--run'){console.log('One batch of three private ideas; maximum one paid request, no retry. Use --run explicitly.');process.exit(0);}
if(fs.existsSync(out))throw Error('Report exists; refusing to repeat paid request.');
const airports=JSON.parse(fs.readFileSync(path.join(root,'airports.json'),'utf8'));
const start=airports.EDTL;
const targets=['EDTW','EDTF','EDSH'];
// No local mission/history/person data is sent in this live probe.
const recent=[];
const candidates=await Promise.all(targets.map(async(icao,index)=>{
 const target=airports[icao];if(!target)throw Error('Missing airport '+icao);
 const region=await geo.resolve(target,{
  readTile:async key=>{const [lat,lon]=key.split('|');const file=path.join(root,'obstacles/poi-tiles',lat,lon+'.json.gz');return fs.existsSync(file)?JSON.parse(gunzipSync(fs.readFileSync(file))):null;},
  fetchJson:async(url,signal)=>{const res=await fetch(url,{signal});if(!res.ok)throw Error('Geography HTTP '+res.status);return res.json();}
 });
 const input=core.frame({target:{name:target.name,lat:target.lat,lon:target.lon},route:{startIcao:'EDTL',startName:start.name,targetIcao:icao,targetName:target.name,distanceNm:Math.round(geo.distanceKm(start,target)/1.852*10)/10},knowledgeContext:geo.knowledge(region),privateRegionContext:region},recent);
 return {id:`private-${index+1}`,icao,target:{name:target.name,lat:target.lat,lon:target.lon},input,stats:region.stats};
}));
// --english: the English UI appends the phase 4 output-language directive.
const prompt=core.proposalPrompt(candidates,recent)+(process.argv.includes('--english')?require('../mission-output-language.js').DIRECTIVE:'');
function key(){if(process.env.GEMINI_API_KEY)return process.env.GEMINI_API_KEY;for(const name of ['key.env.local','.env.local','.env']){const f=path.join(root,name);if(!fs.existsSync(f))continue;const lines=fs.readFileSync(f,'utf8').split(/\r?\n/).map(s=>s.trim()).filter(s=>s&&!s.startsWith('#'));const line=lines.find(s=>/^GEMINI_API_KEY\s*=/.test(s));if(line)return line.slice(line.indexOf('=')+1).trim().replace(/^(['"])(.*)\1$/,'$2');if(lines.length===1&&!lines[0].includes('='))return lines[0];}throw Error('No local key');}
const report={revision:core.PROMPT_REVISION,model:'gemini-3-flash-preview',requests:1,createdAt:new Date().toISOString(),historySource:'Empty: public airport/geography context only; history handoff tested offline.',candidates,recent,prompt};
const save=()=>fs.writeFileSync(out,JSON.stringify(report,null,2));
const apiKey=key();save();
try{
 const started=Date.now();
 const res=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${report.model}:generateContent`,{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':apiKey},body:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:{response_mime_type:'application/json',maxOutputTokens:6000,thinkingConfig:{thinkingLevel:'low'}}}),signal:AbortSignal.timeout(40000)});
 const body=await res.json();report.elapsedMs=Date.now()-started;report.httpStatus=res.status;report.usage=body.usageMetadata;
 if(!res.ok)throw Error('Gemini HTTP '+res.status);
 report.rawText=(body.candidates?.[0]?.content?.parts||[]).filter(p=>p.text&&!p.thought).map(p=>p.text).join('');
 report.parsed=JSON.parse(report.rawText.replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,''));
 report.proposals=core.proposals(report.parsed,candidates);report.accepted=!!report.proposals;
 save();console.log(JSON.stringify({accepted:report.accepted,requests:1,elapsedMs:report.elapsedMs,usage:report.usage,proposals:report.proposals},null,2));
}catch(error){report.error=String(error.message).replaceAll(apiKey,'[redacted]');save();throw Error(report.error);}
