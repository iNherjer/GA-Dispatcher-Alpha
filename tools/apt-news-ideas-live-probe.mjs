import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const core=require('../mission-apt-news-ideas-core.js'),charter=require('../mission-charter-ideas-core.js');
require('../mission-private-outing-core.js');
const flight=require('../mission-private-episode-v6.js'),club=require('../mission-club-ideas-core.js'),geo=require('../mission-private-context-core.js');
if(process.argv[2]!=='--run')throw Error('Use --run');
const output=process.argv.find(x=>x.startsWith('--out='))?.slice(6)||'analysis/apt-news-live-20261004.json';
if(fs.existsSync(output)&&!process.argv.includes('--resume'))throw Error('Output exists; do not repeat paid calls');
function key(){const keyDir=process.argv.find(x=>x.startsWith('--key-dir='))?.slice(10)||'.';if(process.env.GEMINI_API_KEY)return process.env.GEMINI_API_KEY;for(const name of ['key.env.local','.env.local','.env']){const file=keyDir+'/'+name;if(!fs.existsSync(file))continue;const lines=fs.readFileSync(file,'utf8').split(/\r?\n/).map(x=>x.trim()).filter(x=>x&&!x.startsWith('#'));const line=lines.find(x=>/^GEMINI_API_KEY\s*=/.test(x));if(line)return line.slice(line.indexOf('=')+1).trim().replace(/^(['"])(.*)\1$/,'$2');if(lines.length===1&&!lines[0].includes('='))return lines[0];}throw Error('Kein lokaler Gemini-Key');}

const apiKey=key(),memory=new Map(),storage={getItem:k=>memory.get(k),setItem:(k,v)=>memory.set(k,v)};
const airports=JSON.parse(fs.readFileSync('airports.json','utf8'));
const norm=id=>({...airports[id],icao:id,name:airports[id].n||airports[id].name||id});
const report=process.argv.includes('--resume')?JSON.parse(fs.readFileSync(output,'utf8')):{scope:'Requested sequential browser writer runs with application JSON parser and Gemini default generation configuration, isolated growing history, APT reporter transfer with one reporter; airport coordinates from repository; no geo anchors or live weather supplied.',requests:[],runs:[]};
for(const r of report.runs.filter(r=>r.mission))core.remember(storage,'cargo-probe-'+(r.number-1),r.mission.aptNewsIdea,{story:r.mission._missionWriterV4Debug.rawAiStory,memory:r.mission.aptNewsIdea.writerMemory});
const historyFile=process.argv.find(x=>x.startsWith('--history-from='))?.slice(15);
if(historyFile){
 const prior=JSON.parse(fs.readFileSync(historyFile,'utf8'));
 for(const r of prior.runs.filter(r=>r.mission))core.remember(storage,'prior-medical-'+r.number,r.mission.aptNewsIdea,{story:r.mission._missionWriterV4Debug.rawAiStory,memory:r.mission.aptNewsIdea.writerMemory});
 report.historySource=historyFile;
}
delete report.error;
const ideaFile=process.argv.find(x=>x.startsWith('--idea-from='))?.slice(12);
const reusedIdeas=ideaFile?JSON.parse(fs.readFileSync(ideaFile,'utf8')).runs.filter(r=>r.mission).map(r=>r.mission.aptNewsIdea):[];
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

async function request(prompt,spoken=false){
 const prior=report.requests.find(x=>x.prompt===prompt&&x.spoken===spoken&&x.raw);if(prior)return spoken?{text:prior.raw}:{parsed:parse(prior.raw)};
 const entry={prompt,spoken};report.requests.push(entry);save();
 const res=await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent',{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':apiKey},body:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:spoken?require('../mission-boarding-voice-core.js').geminiTextGenerationConfig('gemini-3-flash-preview',false):{response_mime_type:'application/json'}}),signal:AbortSignal.timeout(60000)});
 entry.status=res.status;if(!res.ok)throw Error('HTTP '+res.status);
 const body=await res.json();entry.raw=(body.candidates?.[0]?.content?.parts||[]).filter(x=>x.text&&!x.thought).map(x=>x.text).join('');save();
 return spoken?{text:entry.raw}:{parsed:parse(entry.raw)};
}
const continuation=require('../mission-charter-continuation-core.js'),voice=require('../mission-route-voice-core.js');
let savedReturn=null;
const context=vm.createContext({window:{liveTrackerCapabilities:[],MissionAptNewsIdeasCore:core,MissionCharterContinuationCore:continuation,missionFollowupSaveCharterExperience:(id,draft)=>{savedReturn={...savedReturn,experience:draft};return savedReturn;},MissionCharterIdeasCore:charter,MissionClubIdeasCore:club,MissionPrivateEpisodeV6:flight,MissionPrivateContextCore:{resolveBrowser:async()=>({places:[]})}},localStorage:storage,getMissionAircraftCapabilitySnapshot:()=>({name:'PA-24',maxPayloadKg:520,passengerCapacity:3}),missionTrackerSupportsGroupGeneration:()=>true,getSelectedAiApiKey:()=>'',fetchGeminiJsonWithFallback:request});
vm.runInContext(fs.readFileSync('mission-apt-news-browser.js','utf8'),context);
if(process.argv.includes('--picker')){
 for(const name of ['normalizeMissionProposalChoice','compactMissionProposalChoice']){
  const a=appSource.indexOf('function '+name+'('),b=appSource.indexOf('\nfunction ',a+1);
  vm.runInContext(appSource.slice(a,b),context);
 }
 context.missionProposalCompactTarget=x=>x;
 context.missionProposalFormatRoute=()=>({label:'Teststrecke'});
 const choices=await context.window.MissionAptNewsBrowser.choices(['LOIJ','EDTF','EDSH'].map(norm),{start:norm('EDSV')});
 report.scope='Live three-choice APT reporter picker through production browser adapter; isolated test history; no live weather.';
 report.choices=choices;report.accepted=choices.length===3;save();
 fs.writeFileSync(output.replace('.json','.md'),'# APT Reporter: Dreierauswahl\n\n'+choices.map((c,i)=>`## ${i+1}. ${c.title}\n\n${c.description}\n\n${c.paxText}; ${c.cargoText}\n`).join('\n'));
 console.log('Drei Picker-Angebote gespeichert.');process.exit(0);
}

const voicesFile=process.argv.find(x=>x.startsWith('--voices-from='))?.slice(14);
if(voicesFile){
 report.scope='Three fictional reporter scenarios: one outbound and one return voice each, using the production Gemini text configuration; no TTS playback or simulator.';
 report.runs=JSON.parse(fs.readFileSync(voicesFile,'utf8')).runs.filter(r=>r.mission&&!r.error);
 await Promise.all(report.runs.map(async run=>{
  const idea=run.mission.aptNewsIdea,event=idea.narrativeEvents?.[0];run.routeVoices=[];run.returnVoices=[];
  if(event){const answer=await request(voice.prompt(core.voiceContext(idea),event,[],idea.schema),true);if(!answer.text?.trim())throw Error('Leere Hinflug-Voice');run.routeVoices.push({id:event.id,text:answer.text.trim()});save();}
  const back=run.returnMission?.aptNewsIdea,re=back?.narrativeEvents?.[0];
  if(re){back.continuation.heardOutbound=run.routeVoices;const answer=await request(voice.prompt(core.voiceContext(back),re,[],back.schema),true);if(!answer.text?.trim())throw Error('Leere Rückflug-Voice');run.returnVoices.push({id:re.id,text:answer.text.trim()});save();}
 }));
 report.accepted=true;report.voiceSamplePerLeg=1;save();
 fs.writeFileSync(output.replace('.json','.md'),'# APT Reporter: Drei Gemini-Textproben\n\nFiktive Aufträge. Pro Strecke eine zusätzliche Voice mit der normalen Gemini-Textkonfiguration; keine TTS- oder Simulator-Abnahme.\n\n'+report.runs.map(r=>`## ${r.number}. ${r.mission.t}\n\n${r.mission.s}\n\n**Begrüßung:** ${r.mission.passenger.greetingText}\n\n**Hinflug-Voice:** ${r.routeVoices.map(v=>v.text).join('\n\n')}\n\n**Rückflug:** ${r.returnMission?.s||'Kein Rückauftrag'}\n\n**Rückflug-Voice:** ${r.returnVoices.map(v=>v.text).join('\n\n')}\n`).join('\n'));
 console.log('Normale Voice-Textkonfiguration geprüft: '+report.runs.length+' Szenarien.');process.exit(0);
}

try{
 for(const [i,id] of ['LOIJ','EDTF','EDSH','EDNY'].slice(0,Number(process.argv.find(x=>x.startsWith('--count='))?.slice(8)||2)).entries()){
  const existingRun=report.runs.find(r=>r.number===i+1);
  if(existingRun){
   if(!existingRun.error||!process.argv.includes('--retry-failed'))continue;
   report.failedAttempts=[...(report.failedAttempts||[]),existingRun];
   report.runs=report.runs.filter(r=>r!==existingRun);save();
  }
  console.log('Durchgang '+(i+1)+' gestartet');
  const start=norm('EDSV'),dest=norm(id),route={startName:start.name,targetName:dest.name,distanceNm:Math.round(geo.distanceKm(start,dest)/1.852*10)/10};
  try {
  const previousIdea=reusedIdeas[i];
  const proposal=previousIdea?{schema:'apt-news-proposal.v1',input:{route:previousIdea.route},idea:previousIdea}:undefined;
  const m=await context.window.MissionAptNewsBrowser.story({start,dest,proposal,contract:{route,weather:{}}});
  const run={number:i+1,historyCount:core.history(storage).length,mission:m,routeVoices:[]};
  report.runs.push(run);
  if(process.argv.includes('--roundtrip')){
   async function voices(idea){const rows=[];for(const event of idea.narrativeEvents||[]){const answer=await request(voice.prompt(voice.conversationPrompt(core.voiceContext(idea),rows),event,[],idea.schema),true);if(!answer.text?.trim())throw Error('Leere Route-Voice');rows.push({id:event.id,text:answer.text.trim()});}return rows;}
   run.routeVoices=await voices(m.aptNewsIdea);save();
   const md={...m,missionId:'fictional-reporter-probe-'+i,charterHeardSpeech:run.routeVoices},now=Date.now();
   const req=continuation.request(md,{missionId:md.missionId,completionId:'fictional-test-completion',endedAt:now,result:'completed',privateOutingEvidence:{flown:true,atTarget:true,groundStill:true}},now);
   if(req){savedReturn=req.charterContinuation;const back=await context.window.MissionAptNewsBrowser.continuation({req,base:{followUpContinuation:{},_appliedProfile:'apt_charter'},contract:{route:{startName:dest.name,targetName:start.name,distanceNm:route.distanceNm},weather:{}},aiEnabled:true});run.returnMission=back;run.returnVoices=await voices(back.aptNewsIdea);save();}
  }
  core.remember(storage,'cargo-probe-'+i,m.aptNewsIdea,{story:m._missionWriterV4Debug.rawAiStory,memory:m.aptNewsIdea.writerMemory});save();
  console.log('Durchgang '+(i+1)+' gespeichert: '+m.t);
  } catch(e){const error=String(e.message).replaceAll(apiKey,'[redacted]'),existing=report.runs.find(r=>r.number===i+1);if(existing)existing.error=error;else report.runs.push({number:i+1,error});save();console.log('Durchgang '+(i+1)+' abgelehnt');}
 }
 report.accepted=report.runs.every(r=>r.mission&&!r.error);save();
 fs.writeFileSync(output.replace('.json','.md'),'# APT Reporter: Live-Durchgänge\n\nKeine Live-Wetterdaten; isolierte fortgeschriebene History; ein Reporter mit eigener Ausrüstung; journalistische Arbeit erst nach der Ankunft.\n\n'+report.runs.filter(r=>r.mission).map(r=>`## ${r.number}. ${r.mission.t}\n\n${r.mission.s}\n\n**An Bord:** ${r.mission.pax}; ${r.mission.cargo}\n\n**Empfangskontakt:** ${r.mission.aptNewsIdea.recipient}\n\n**Begrüßung:** ${r.mission.passenger.greetingText}\n\n**Zusatzansagen:** ${(r.routeVoices||[]).map(v=>v.text).join("\n\n")}\n\n**Rückflug:** ${r.returnMission?.s||"Kein Rückflug in dieser Probe"}\n\n**Rückfluggespräche:** ${(r.returnVoices||[]).map(v=>v.text).join("\n\n")}\n`).join('\n'));
}catch(e){report.error=String(e.message).replaceAll(apiKey,'[redacted]');save();throw Error(report.error);}
