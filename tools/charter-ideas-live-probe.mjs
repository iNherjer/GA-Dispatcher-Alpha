import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const core=require('../mission-charter-ideas-core.js');
require('../mission-private-outing-core.js');
const flight=require('../mission-private-episode-v6.js'),club=require('../mission-club-ideas-core.js'),geo=require('../mission-private-context-core.js');
if(process.argv[2]!=='--run')throw Error('Use --run');
const output=process.argv.find(x=>x.startsWith('--out='))?.slice(6)||'analysis/charter-four-live-20260922.json';
if(fs.existsSync(output)&&!process.argv.includes('--resume'))throw Error('Output exists; do not repeat paid calls');
function key(){if(process.env.GEMINI_API_KEY)return process.env.GEMINI_API_KEY;for(const file of ['key.env.local','.env.local','.env']){if(!fs.existsSync(file))continue;const lines=fs.readFileSync(file,'utf8').split(/\r?\n/).map(x=>x.trim()).filter(x=>x&&!x.startsWith('#'));const line=lines.find(x=>/^GEMINI_API_KEY\s*=/.test(x));if(line)return line.slice(line.indexOf('=')+1).trim().replace(/^(['"])(.*)\1$/,'$2');if(lines.length===1&&!lines[0].includes('='))return lines[0];}throw Error('Kein lokaler Gemini-Key');}

const apiKey=key(),memory=new Map(),storage={getItem:k=>memory.get(k),setItem:(k,v)=>memory.set(k,v)};
const airports=JSON.parse(fs.readFileSync('airports.json','utf8'));
const norm=id=>({...airports[id],icao:id,name:airports[id].n||airports[id].name||id});
const report=process.argv.includes('--resume')?JSON.parse(fs.readFileSync(output,'utf8')):{scope:'Four sequential production browser writer runs, isolated growing history, capacity 3; airport coordinates from repository; no geo anchors or live weather supplied.',requests:[],runs:[]};
for(const r of report.runs.filter(r=>r.mission))core.remember(storage,'charter-probe-'+(r.number-1),r.mission.charterIdea,{story:r.mission._missionWriterV4Debug.rawAiStory,memory:r.mission.charterIdea.writerMemory});
delete report.error;
const save=()=>fs.writeFileSync(output,JSON.stringify(report,null,2));
function parse(raw){const clean=raw.replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,'');try{return JSON.parse(clean);}catch(e){if(clean.trim().endsWith('}')){try{return JSON.parse(clean.trim().slice(0,-1));}catch{}}throw e;}}
async function request(prompt){
 const prior=report.requests.find(x=>x.prompt===prompt&&x.raw);if(prior)return {parsed:parse(prior.raw)};
 const entry={prompt};report.requests.push(entry);save();
 const res=await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent',{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':apiKey},body:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:{response_mime_type:'application/json',maxOutputTokens:6000,thinkingConfig:{thinkingLevel:'low'}}}),signal:AbortSignal.timeout(60000)});
 entry.status=res.status;if(!res.ok)throw Error('HTTP '+res.status);
 const body=await res.json();entry.raw=(body.candidates?.[0]?.content?.parts||[]).filter(x=>x.text&&!x.thought).map(x=>x.text).join('');save();
 return {parsed:parse(entry.raw)};
}
const context=vm.createContext({window:{MissionCharterIdeasCore:core,MissionClubIdeasCore:club,MissionPrivateEpisodeV6:flight,MissionPrivateContextCore:{resolveBrowser:async()=>({places:[]})}},localStorage:storage,getMissionAircraftCapabilitySnapshot:()=>({passengerCapacity:3}),missionTrackerSupportsGroupGeneration:()=>true,getSelectedAiApiKey:()=>'',fetchGeminiJsonWithFallback:request});
// --english: simulate the English UI (phase 4 output language).
if(process.argv.includes('--english')){context.window.MissionOutputLanguage=(()=>{const out=require('../mission-output-language.js');return {...out,language:()=>'en',directive:()=>out.DIRECTIVE,wrap:p=>typeof p==='string'?p+out.DIRECTIVE:p,text:(de,en)=>typeof en==='string'?en:de,locale:()=>'en-GB',decimal:v=>String(v)};})();process.env.GA_MISSION_OUTPUT_LANGUAGE='en';}
vm.runInContext(fs.readFileSync('mission-charter-browser.js','utf8'),context);
try{
 for(const [i,id] of ['LOIJ','EDTF','EDSH','EDNY'].slice(0,Number(process.argv.find(x=>x.startsWith('--count='))?.slice(8)||4)).entries()){
  if(i<report.runs.length)continue;
  console.log('Durchgang '+(i+1)+' gestartet');
  const start=norm('EDSV'),dest=norm(id),route={startName:start.name,targetName:dest.name,distanceNm:Math.round(geo.distanceKm(start,dest)/1.852*10)/10};
  try {
  const m=await context.window.MissionCharterBrowser.story({start,dest,contract:{route,weather:{}}});
  report.runs.push({number:i+1,historyCount:core.history(storage).length,mission:m});
  core.remember(storage,'charter-probe-'+i,m.charterIdea,{story:m._missionWriterV4Debug.rawAiStory,memory:m.charterIdea.writerMemory});save();
  console.log('Durchgang '+(i+1)+' gespeichert: '+m.t);
  } catch(e){report.runs.push({number:i+1,error:String(e.message).replaceAll(apiKey,'[redacted]')});save();console.log('Durchgang '+(i+1)+' abgelehnt');}
 }
 report.accepted=report.runs.every(r=>r.mission);save();
 fs.writeFileSync(output.replace('.json','.md'),'# Vier Charter-Durchgänge\n\nKeine Live-Wetterdaten; isolierte fortgeschriebene History; drei freie PAX-Plätze.\n\n'+report.runs.filter(r=>r.mission).map(r=>`## ${r.number}. ${r.mission.t}\n\n${r.mission.s}\n\n**An Bord:** ${r.mission.pax}; ${r.mission.cargo}\n\n**Begrüßung:** ${r.mission.passenger.greetingText}\n\n**Zusatzansagen:** ${JSON.stringify(r.mission.charterIdea.narrativeEvents)}\n`).join('\n'));
}catch(e){report.error=String(e.message).replaceAll(apiKey,'[redacted]');save();throw Error(report.error);}
