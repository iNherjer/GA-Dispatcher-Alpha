import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const core=require('../mission-medical-transfer-ideas-core.js'),charter=require('../mission-charter-ideas-core.js');
require('../mission-private-outing-core.js');
const flight=require('../mission-private-episode-v6.js'),club=require('../mission-club-ideas-core.js'),geo=require('../mission-private-context-core.js');
if(process.argv[2]!=='--run')throw Error('Use --run');
const output=process.argv.find(x=>x.startsWith('--out='))?.slice(6)||'analysis/medical-transfer-live-20261004.json';
if(fs.existsSync(output)&&!process.argv.includes('--resume'))throw Error('Output exists; do not repeat paid calls');
function key(){const keyDir=process.argv.find(x=>x.startsWith('--key-dir='))?.slice(10)||'.';if(process.env.GEMINI_API_KEY)return process.env.GEMINI_API_KEY;for(const name of ['key.env.local','.env.local','.env']){const file=keyDir+'/'+name;if(!fs.existsSync(file))continue;const lines=fs.readFileSync(file,'utf8').split(/\r?\n/).map(x=>x.trim()).filter(x=>x&&!x.startsWith('#'));const line=lines.find(x=>/^GEMINI_API_KEY\s*=/.test(x));if(line)return line.slice(line.indexOf('=')+1).trim().replace(/^(['"])(.*)\1$/,'$2');if(lines.length===1&&!lines[0].includes('='))return lines[0];}throw Error('Kein lokaler Gemini-Key');}

const apiKey=key(),memory=new Map(),storage={getItem:k=>memory.get(k),setItem:(k,v)=>memory.set(k,v)};
const airports=JSON.parse(fs.readFileSync('airports.json','utf8'));
const norm=id=>({...airports[id],icao:id,name:airports[id].n||airports[id].name||id});
const report=process.argv.includes('--resume')?JSON.parse(fs.readFileSync(output,'utf8')):{scope:'Requested sequential browser writer runs with application JSON parser and Gemini default generation configuration, isolated growing history, medical transfer with one escort; airport coordinates from repository; no geo anchors or live weather supplied.',requests:[],runs:[]};
for(const r of report.runs.filter(r=>r.mission))core.remember(storage,'cargo-probe-'+(r.number-1),r.mission.medicalTransferIdea,{story:r.mission._missionWriterV4Debug.rawAiStory,memory:r.mission.medicalTransferIdea.writerMemory});
const historyFile=process.argv.find(x=>x.startsWith('--history-from='))?.slice(15);
if(historyFile){
 const prior=JSON.parse(fs.readFileSync(historyFile,'utf8'));
 for(const r of prior.runs.filter(r=>r.mission))core.remember(storage,'prior-medical-'+r.number,r.mission.medicalTransferIdea,{story:r.mission._missionWriterV4Debug.rawAiStory,memory:r.mission.medicalTransferIdea.writerMemory});
 report.historySource=historyFile;
}
delete report.error;
const ideaFile=process.argv.find(x=>x.startsWith('--idea-from='))?.slice(12);
const reusedIdeas=ideaFile?JSON.parse(fs.readFileSync(ideaFile,'utf8')).runs.filter(r=>r.mission).map(r=>r.mission.medicalTransferIdea):[];
if(ideaFile)report.ideaSource=ideaFile;
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
 if(process.argv.includes('--patient')&&prompt.startsWith('Entwickle pro Rahmen'))prompt+='\nTESTVORGABE für diese fiktive Probe: Wähle patient_transfer, eine geplante sitzende Verlegung mit genau einem Patienten und einer medizinischen Begleitung. Nutze keine Notlage.';
 const prior=report.requests.find(x=>x.prompt===prompt&&x.raw);if(prior)return {parsed:parse(prior.raw)};
 const entry={prompt};report.requests.push(entry);save();
 const res=await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent',{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':apiKey},body:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:{response_mime_type:'application/json'}}),signal:AbortSignal.timeout(60000)});
 entry.status=res.status;if(!res.ok)throw Error('HTTP '+res.status);
 const body=await res.json();entry.raw=(body.candidates?.[0]?.content?.parts||[]).filter(x=>x.text&&!x.thought).map(x=>x.text).join('');save();
 return {parsed:parse(entry.raw)};
}
const context=vm.createContext({window:{liveTrackerCapabilities:process.argv.includes('--patient')?['mission.scene.group.v1','mission.scene.medical-group.v1']:[],MissionMedicalTransferIdeasCore:core,MissionCharterIdeasCore:charter,MissionClubIdeasCore:club,MissionPrivateEpisodeV6:flight,MissionPrivateContextCore:{resolveBrowser:async()=>({places:[]})}},localStorage:storage,getMissionAircraftCapabilitySnapshot:()=>({name:'PA-24',maxPayloadKg:520,passengerCapacity:3}),missionTrackerSupportsGroupGeneration:()=>true,getSelectedAiApiKey:()=>'',fetchGeminiJsonWithFallback:request});
vm.runInContext(fs.readFileSync('mission-medical-transfer-browser.js','utf8'),context);
if(process.argv.includes('--picker')){
 for(const name of ['normalizeMissionProposalChoice','compactMissionProposalChoice']){
  const a=appSource.indexOf('function '+name+'('),b=appSource.indexOf('\nfunction ',a+1);
  vm.runInContext(appSource.slice(a,b),context);
 }
 context.missionProposalCompactTarget=x=>x;
 context.missionProposalFormatRoute=()=>({label:'Teststrecke'});
 const choices=await context.window.MissionMedicalTransferBrowser.choices(['LOIJ','EDTF','EDSH'].map(norm),{start:norm('EDSV')});
 report.scope='Live three-choice medical transfer picker through production browser adapter; isolated test history; no live weather.';
 report.choices=choices;report.accepted=choices.length===3;save();
 fs.writeFileSync(output.replace('.json','.md'),'# Medizin-Transfer: Dreierauswahl\n\n'+choices.map((c,i)=>`## ${i+1}. ${c.title}\n\n${c.description}\n\n${c.paxText}; ${c.cargoText}\n`).join('\n'));
 console.log('Drei Picker-Angebote gespeichert.');process.exit(0);
}

try{
 for(const [i,id] of ['LOIJ','EDTF','EDSH','EDNY'].slice(0,Number(process.argv.find(x=>x.startsWith('--count='))?.slice(8)||4)).entries()){
  if(i<report.runs.length)continue;
  console.log('Durchgang '+(i+1)+' gestartet');
  const start=norm('EDSV'),dest=norm(id),route={startName:start.name,targetName:dest.name,distanceNm:Math.round(geo.distanceKm(start,dest)/1.852*10)/10};
  try {
  const previousIdea=reusedIdeas[i];
  const proposal=previousIdea?{schema:'medical-transfer-proposal.v1',input:{route:previousIdea.route},idea:previousIdea}:undefined;
  const m=await context.window.MissionMedicalTransferBrowser.story({start,dest,proposal,contract:{route,weather:{}}});
  report.runs.push({number:i+1,historyCount:core.history(storage).length,mission:m});
  core.remember(storage,'cargo-probe-'+i,m.medicalTransferIdea,{story:m._missionWriterV4Debug.rawAiStory,memory:m.medicalTransferIdea.writerMemory});save();
  console.log('Durchgang '+(i+1)+' gespeichert: '+m.t);
  } catch(e){report.runs.push({number:i+1,error:String(e.message).replaceAll(apiKey,'[redacted]')});save();console.log('Durchgang '+(i+1)+' abgelehnt');}
 }
 report.accepted=report.runs.every(r=>r.mission);save();
 fs.writeFileSync(output.replace('.json','.md'),'# Medizin-Transfer: Live-Durchgänge\n\nKeine Live-Wetterdaten; isolierte fortgeschriebene History; ein Frachtbegleiter, unveränderte Frachtübergabe.\n\n'+report.runs.filter(r=>r.mission).map(r=>`## ${r.number}. ${r.mission.t}\n\n${r.mission.s}\n\n**An Bord:** ${r.mission.pax}; ${r.mission.cargo}\n\n**Empfänger:** ${r.mission.medicalTransferIdea.recipient}\n\n**Begrüßung:** ${r.mission.passenger.greetingText}\n\n**Zusatzansagen:** bestehende Begleiteransagen; keine neuen Route-Events\n`).join('\n'));
}catch(e){report.error=String(e.message).replaceAll(apiKey,'[redacted]');save();throw Error(report.error);}
