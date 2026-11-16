// Live-Probe Charter-Veranstaltungssuche: je Start --runs ungecachte Suchläufe (Standard 1), danach höchstens
// ein Picker-Ideenaufruf mit dem ersten passenden Event. Keine Writer-Aufrufe. Ergebnis in analysis/.
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const grounded=require('../mission-grounded-events-core.js');require('../mission-club-events-core.js');
const events=require('../mission-charter-events-core.js'),core=require('../mission-charter-ideas-core.js'),geo=require('../mission-private-context-core.js');
if(process.argv[2]!=='--run')throw Error('Use --run');
const output=process.argv.find(x=>x.startsWith('--out='))?.slice(6)||'analysis/charter-events-live-20261116.json';
if(fs.existsSync(output))throw Error('Output exists; do not repeat paid calls');
function key(){if(process.env.GEMINI_API_KEY)return process.env.GEMINI_API_KEY;for(const file of ['key.env.local','.env.local','.env']){if(!fs.existsSync(file))continue;const lines=fs.readFileSync(file,'utf8').split(/\r?\n/).map(x=>x.trim()).filter(x=>x&&!x.startsWith('#'));const line=lines.find(x=>/^GEMINI_API_KEY\s*=/.test(x));if(line)return line.slice(line.indexOf('=')+1).trim().replace(/^(['"])(.*)\1$/,'$2');if(lines.length===1&&!lines[0].includes('='))return lines[0];}throw Error('Kein lokaler Gemini-Key');}
const apiKey=key(),airports=JSON.parse(fs.readFileSync('airports.json','utf8')),date=new Date().toLocaleDateString('en-CA');
const norm=id=>({...airports[id],icao:id,name:airports[id].n||airports[id].name||id,lat:Number(airports[id].lat),lon:Number(airports[id].lon)});
const NM=1.852,report={date,window:events.windowFor(date),starts:[]},save=()=>fs.writeFileSync(output,JSON.stringify(report,null,2));
const STARTS=(process.argv.find(x=>x.startsWith('--starts='))?.slice(9)||'EDTF,EDHE').split(',');
for(const startId of STARTS){
 const start=norm(startId),cands=Object.keys(airports).map(norm).filter(a=>Number.isFinite(a.lat)&&a.icao!==startId).map(a=>({...a,nm:geo.distanceKm(start,a)/NM})).filter(a=>a.nm>=20&&a.nm<=120);
 const entry={start:startId,candidates:cands.length,runs:[]};report.starts.push(entry);
 const RUNS=Number(process.argv.find(x=>x.startsWith('--runs='))?.slice(7)||1);
 for(let i=0;i<RUNS;i++){
  const t0=Date.now();
  try{const period=events.windowFor(date),body=await grounded.request({prompt:events.prompt({name:start.name,lat:start.lat,lon:start.lon},120,period),apiKey}),c=body.candidates?.[0],r={usage:body.usageMetadata,events:events.parse(body,period)};const rawText=(c?.content?.parts||[]).filter(x=>x.text&&!x.thought).map(x=>x.text).join(''),meta=c?.groundingMetadata||{};
   const m=events.match(r.events,cands,geo.distanceKm,[]);
   entry.runs.push({ms:Date.now()-t0,usage:r.usage,rawText,chunks:(meta.groundingChunks||[]).map(x=>x.web?.title),supports:(meta.groundingSupports||[]).length,urlMeta:(c?.urlContextMetadata?.urlMetadata||[]).map(m=>[m.retrievedUrl,m.urlRetrievalStatus]),queries:meta.webSearchQueries||[],events:r.events,match:m&&{event:m.event.title,kind:m.event.kind,airport:m.airport.icao,km:m.km}});
  }catch(e){entry.runs.push({ms:Date.now()-t0,error:String(e.message).replaceAll(apiKey,'[redacted]')});}
  save();console.log(startId,'Suche',i+1,':',entry.runs.at(-1).error||entry.runs.at(-1).events.length+' Treffer, Match '+(entry.runs.at(-1).match?.event||'-'));
 }
 const hit=entry.runs.find(r=>r.match);
 if(hit){
  const m=events.match(hit.events,cands,geo.distanceKm,[]),others=cands.filter(a=>a!==m.airport).sort(()=>Math.random()-0.5).slice(0,2);
  const occ=core.OCCASIONS.find(o=>o.id===m.event.kind),occs=[occ,...core.pickOccasions([],2,Math.random,[occ.id])];
  const frames=[m.airport,...others].map((a,i)=>({candidateId:'charter-'+i,...core.frame({start:{name:start.name,icao:start.icao,lat:start.lat,lon:start.lon},target:{name:a.name,icao:a.icao,lat:a.lat,lon:a.lon}},3,[],[],occs[i],i===0?events.anchor(m.event):null,date),requireReturnPlan:true}));
  const res=await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent',{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':apiKey},body:JSON.stringify({contents:[{parts:[{text:core.ideaPrompt(frames)}]}],generationConfig:{response_mime_type:'application/json'}})});
  const body=await res.json(),raw=(body.candidates?.[0]?.content?.parts||[]).filter(x=>x.text&&!x.thought).map(x=>x.text).join('');
  let ideas=[];try{ideas=JSON.parse(raw).ideas||[];}catch{}
  entry.picker=frames.map((f,i)=>{const r=ideas.find(x=>x.candidateId===f.candidateId),v=r&&core.validate(r,f);return {target:f.route.target.icao,occasion:f.occasion.id,event:f.event?.title||null,valid:!!v,reason:r?.reason,background:r?.background,role:r?.passenger?.role,returnPlan:r?.returnPlan};});
  save();console.log(startId,'Picker:',entry.picker.map(p=>p.occasion+(p.event?'@'+p.event:'')+(p.valid?'':' (ungültig)')).join(' | '));
 }
}
