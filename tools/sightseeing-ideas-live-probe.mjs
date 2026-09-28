import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const core=require('../mission-sightseeing-ideas-core.js'),charter=require('../mission-charter-ideas-core.js');
require('../mission-private-outing-core.js');
const flight=require('../mission-private-episode-v6.js'),club=require('../mission-club-ideas-core.js'),geo=require('../mission-private-context-core.js');
if(process.argv[2]!=='--run')throw Error('Use --run');
const output=process.argv.find(x=>x.startsWith('--out='))?.slice(6)||'analysis/sightseeing-live-20260928.json';
if(fs.existsSync(output)&&!process.argv.includes('--resume'))throw Error('Output exists; do not repeat paid calls');
function key(){const keyDir=process.argv.find(x=>x.startsWith('--key-dir='))?.slice(10)||'.';if(process.env.GEMINI_API_KEY)return process.env.GEMINI_API_KEY;for(const name of ['key.env.local','.env.local','.env']){const file=keyDir+'/'+name;if(!fs.existsSync(file))continue;const lines=fs.readFileSync(file,'utf8').split(/\r?\n/).map(x=>x.trim()).filter(x=>x&&!x.startsWith('#'));const line=lines.find(x=>/^GEMINI_API_KEY\s*=/.test(x));if(line)return line.slice(line.indexOf('=')+1).trim().replace(/^(['"])(.*)\1$/,'$2');if(lines.length===1&&!lines[0].includes('='))return lines[0];}throw Error('Kein lokaler Gemini-Key');}

const apiKey=key(),memory=new Map(),storage={getItem:k=>memory.get(k),setItem:(k,v)=>memory.set(k,v)};
const airports=JSON.parse(fs.readFileSync('airports.json','utf8'));
const norm=id=>({...airports[id],icao:id,name:airports[id].n||airports[id].name||id});
const report=process.argv.includes('--resume')?JSON.parse(fs.readFileSync(output,'utf8')):{scope:'Sightseeing production adapter with real geographic Wikipedia discovery and extracts, isolated history and application JSON parser; no live weather supplied.',requests:[],runs:[]};
for(const r of report.runs.filter(r=>r.mission))core.remember(storage,'cargo-probe-'+(r.number-1),r.mission.sightseeingIdea,{story:r.mission._missionWriterV4Debug.rawAiStory,memory:r.mission.sightseeingIdea.writerMemory});
delete report.error;
const replayFile=process.argv.find(x=>x.startsWith('--proposal-from='))?.slice(16);
let replayProposal;
if(replayFile){const prior=JSON.parse(fs.readFileSync(replayFile,'utf8'));const request=prior.requests.find(r=>r.prompt.includes('RAHMEN: '));const input=JSON.parse(request.prompt.slice(request.prompt.indexOf('RAHMEN: ')+8))[0];const idea=core.validate(parseReplay(request.raw).ideas[0],input);if(!idea)throw Error('Replay proposal invalid');replayProposal={schema:'sightseeing-proposal.v1',input,idea};report.requests=prior.requests;}
function parseReplay(raw){return JSON.parse(raw.replace(/^```json\s*|\s*```$/g,''));}

const save=()=>fs.writeFileSync(output,JSON.stringify(report,null,2));
// Use the application's JSON parser, including fenced/balanced response recovery.
const parserContext=vm.createContext({});
const appSource=fs.readFileSync('app.js','utf8');
for(const name of ['_missionExtractBalancedJsonObjectText','_missionParseJsonTextDetailed']){
 const a=appSource.indexOf('function '+name+'('),b=appSource.indexOf('\nfunction ',a+1);
 vm.runInContext(appSource.slice(a,b),parserContext);
}
function parse(raw){const result=parserContext._missionParseJsonTextDetailed(raw);if(!result.parsed)throw Error('Ungültiges Antwort-JSON');return result.parsed;}

async function request(prompt){
 const prior=report.requests.find(x=>x.prompt===prompt&&x.raw);if(prior)return {parsed:parse(prior.raw)};
 const entry={prompt};report.requests.push(entry);save();
 const res=await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent',{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':apiKey},body:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:{response_mime_type:'application/json'}}),signal:AbortSignal.timeout(60000)});
 entry.status=res.status;if(!res.ok)throw Error('HTTP '+res.status);
 const body=await res.json();entry.raw=(body.candidates?.[0]?.content?.parts||[]).filter(x=>x.text&&!x.thought).map(x=>x.text).join('');save();
 return {parsed:parse(entry.raw)};
}
const context=vm.createContext({window:{fetch, MissionSightseeingContextCore:require('../mission-sightseeing-context-core.js'),MissionCargoIdeasCore:require('../mission-cargo-ideas-core.js'),MissionSightseeingIdeasCore:core,MissionCharterIdeasCore:charter,MissionClubIdeasCore:club,MissionPrivateEpisodeV6:flight,MissionPrivateContextCore:{resolveBrowser:async()=>({places:[]})}},localStorage:storage,getMissionAircraftCapabilitySnapshot:()=>({name:'PA-24',maxPayloadKg:520,passengerCapacity:3}),missionTrackerSupportsGroupGeneration:()=>true,getSelectedAiApiKey:()=>'',fetchGeminiJsonWithFallback:request});
vm.runInContext(fs.readFileSync('mission-sightseeing-browser.js','utf8'),context);
if(process.argv.includes('--picker')){
 for(const name of ['normalizeMissionProposalChoice','compactMissionProposalChoice']){
  const a=appSource.indexOf('function '+name+'('),b=appSource.indexOf('\nfunction ',a+1);
  vm.runInContext(appSource.slice(a,b),context);
 }
 context.missionProposalCompactTarget=x=>x;
 context.missionProposalFormatRoute=()=>({label:'Teststrecke'});
 const choices=await context.window.MissionSightseeingBrowser.choices(['LOIJ','EDTF','EDSH'].map(norm),{start:norm('EDSV')});
 report.scope='Live Sightseeing picker with sourced ground visits; isolated history, no weather.';
 report.choices=choices;report.accepted=choices.length===3;save();
 fs.writeFileSync(output.replace('.json','.md'),'# Sightseeing: Dreierauswahl\n\n'+choices.map((c,i)=>`## ${i+1}. ${c.title}\n\n${c.description}\n\n${c.paxText}; ${c.cargoText}\n`).join('\n'));
 console.log('Drei Picker-Angebote gespeichert.');process.exit(0);
}

try{
 for(const [i,id] of ['EDTF','EDSH','EDNY'].slice(0,Number(process.argv.find(x=>x.startsWith('--count='))?.slice(8)||1)).entries()){
  if(i<report.runs.length)continue;
  console.log('Durchgang '+(i+1)+' gestartet');
  const start=norm('EDSV'),dest=norm(id),route={startName:start.name,targetName:dest.name,distanceNm:Math.round(geo.distanceKm(start,dest)/1.852*10)/10};
  try {
  const m=await context.window.MissionSightseeingBrowser.story({start,dest,proposal:replayProposal,contract:{route,weather:{}}});
  report.runs.push({number:i+1,historyCount:core.history(storage).length,mission:m});
  core.remember(storage,'cargo-probe-'+i,m.sightseeingIdea,{story:m._missionWriterV4Debug.rawAiStory,memory:m.sightseeingIdea.writerMemory});save();
  console.log('Durchgang '+(i+1)+' gespeichert: '+m.t);
  } catch(e){report.runs.push({number:i+1,error:String(e.message).replaceAll(apiKey,'[redacted]')});save();console.log('Durchgang '+(i+1)+' abgelehnt');}
 }
 report.accepted=report.runs.every(r=>r.mission);save();
 fs.writeFileSync(output.replace('.json','.md'),'# Sightseeing: Live-Durchgang\n\nKeine Live-Wetterdaten; isolierte fortgeschriebene History; belegte Besuchsorte nach der Landung.\n\n'+report.runs.filter(r=>r.mission).map(r=>`## ${r.number}. ${r.mission.t}\n\n${r.mission.s}\n\n**An Bord:** ${r.mission.pax}; ${r.mission.cargo}\n\n**Besuchsorte:** ${r.mission.sightseeingIdea.visits.map(v=>v.place.name).join(", ")}\n\n**Begrüßung:** ${r.mission.passenger.greetingText}\n\n**Zusatzansagen:** ${JSON.stringify(r.mission.sightseeingIdea.narrativeEvents)}\n`).join('\n'));
}catch(e){report.error=String(e.message).replaceAll(apiKey,'[redacted]');save();throw Error(report.error);}
