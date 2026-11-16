// Live-Probe der Veranstaltungssuche in Verein und Privat (höchstens zwei Tests je Strang).
// Verein: echte Suche ab Start + Zuordnung; nur bei Treffer der echte choices()-Ideenaufruf.
// Privat A: echter Picker (findPrivateMissionEvent + buildPrivateMissionProposalChoices) und Writer für Platz 1.
// Privat B: direkter Dispatch (findPrivateMissionEvent + fetchPrivateOutingStory) ohne Picker.
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const grounded=require('../mission-grounded-events-core.js'),clubEvents=require('../mission-club-events-core.js'),charterEvents=require('../mission-charter-events-core.js');
const v5=require('../mission-private-outing-core.js'),v6=require('../mission-private-episode-v6.js'),club=require('../mission-club-ideas-core.js'),geo=require('../mission-private-context-core.js');
if(process.argv[2]!=='--run')throw Error('Use --run');
const output=process.argv.find(x=>x.startsWith('--out='))?.slice(6)||'analysis/events-strands-live-20261116.json';
if(fs.existsSync(output))throw Error('Output exists; do not repeat paid calls');
function key(){if(process.env.GEMINI_API_KEY)return process.env.GEMINI_API_KEY;for(const file of ['key.env.local','.env.local','.env']){if(!fs.existsSync(file))continue;const lines=fs.readFileSync(file,'utf8').split(/\r?\n/).map(x=>x.trim()).filter(x=>x&&!x.startsWith('#'));const line=lines.find(x=>/^GEMINI_API_KEY\s*=/.test(x));if(line)return line.slice(line.indexOf('=')+1).trim().replace(/^(['"])(.*)\1$/,'$2');if(lines.length===1&&!lines[0].includes('='))return lines[0];}throw Error('Kein lokaler Gemini-Key');}
const apiKey=key(),A=JSON.parse(fs.readFileSync('airports.json','utf8')),src=fs.readFileSync('app.js','utf8');
const norm=id=>({...A[id],icao:id,name:A[id].name||id,n:A[id].name||id,lat:Number(A[id].lat),lon:Number(A[id].lon)});
const report={date:new Date().toLocaleDateString('en-CA'),requests:0,club:[],private:[]},save=()=>fs.writeFileSync(output,JSON.stringify(report,null,2));
const realReq=grounded.request;grounded.request=async o=>{report.requests++;return realReq(o);};
function parse(raw){return JSON.parse(raw.replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,''));}
async function gemini(prompt){report.requests++;const res=await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent',{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':apiKey},body:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:{response_mime_type:'application/json',maxOutputTokens:8000,thinkingConfig:{thinkingLevel:'low'}}})});if(!res.ok)throw Error('HTTP '+res.status);const body=await res.json();report.raw=(report.raw||[]);report.raw.push((body.candidates?.[0]?.content?.parts||[]).filter(x=>x.text&&!x.thought).map(x=>x.text).join('').slice(0,12000));try{return {parsed:parse((body.candidates?.[0]?.content?.parts||[]).filter(x=>x.text&&!x.thought).map(x=>x.text).join('')),source:'live'};}catch{return {parsed:null};}}
const store=()=>{const m=new Map();return {getItem:k=>m.get(k),setItem:(k,v)=>m.set(k,v)};};
const near=(start,min,max,n)=>Object.keys(A).filter(id=>id!==start.icao&&Number.isFinite(Number(A[id].lat))).map(norm).map(a=>({a,nm:geo.distanceKm(start,a)/1.852})).filter(x=>x.nm>=min&&x.nm<=max).sort((x,y)=>x.nm-y.nm).slice(0,n).map(x=>x.a);
const geoStub={...geo,resolveBrowser:async t=>({airport:{name:t.name,lat:t.lat,lon:t.lon},radiusKm:50,places:[],stats:{probe:true}})};
function sandbox(localStorage){
 const c={console,Date,Math,JSON,AbortSignal,window:{MissionPrivateEpisodeV6:v6,MissionPrivateOutingCore:v5,MissionPrivateContextCore:geoStub,MissionCharterEventsCore:charterEvents,MissionGroundedEventsCore:grounded,MissionClubEventsCore:clubEvents,MissionClubIdeasCore:club},
  localStorage,currentStartICAO:globalThis.PROBE_START||'',getSelectedAiApiKey:()=>apiKey,getSelectedAiProvider:()=>'gemini',normalizeAirportIdent:x=>x,normalizeMissionText:x=>String(x).toLowerCase(),
  missionProposalCompactTarget:t=>({...t,n:t.n||t.name}),missionProposalAirportLocationLabel:t=>t.n,missionProposalFormatRoute:(s,a)=>({label:(s.icao||'')+' → '+a.icao,nav:{dist:Math.round(geo.distanceKm(s,a)/1.852)}}),
  normalizeMissionProposalChoice:x=>x,getMissionTaskProfile:()=>({}),fetchGeminiJsonWithFallback:gemini};
 vm.createContext(c);
 for(const name of ['findPrivateMissionEvent','buildPrivateMissionProposalChoices','fetchPrivateOutingStory','compactMissionObjectForQuotaStorage','_sanitizePrivateOutingNarrative']){const at=src.indexOf('function '+name+'(');const begin=src.slice(at-6,at)==='async '?at-6:at;vm.runInContext(src.slice(begin,src.indexOf('\n}',at)+2),c);}
 return c;
}
const contractFor=(start,dest)=>({privateRegionContext:{airport:{name:dest.n,lat:dest.lat,lon:dest.lon},radiusKm:50,places:[]},status:'ready',profile:{id:'private_outing',taskDomain:'private_outing'},target:{name:dest.n,lat:dest.lat,lon:dest.lon},route:{startIcao:start.icao,startName:start.n,targetIcao:dest.icao,targetName:dest.n,distanceNm:Math.round(geo.distanceKm(start,dest)/1.852*10)/10},missionPlan:{plan:{}},weather:{}});
const brief=m=>({title:m.t||m.title||m.mission,story:m.missionStory||m.s,event:m.privateOuting?.eventVisit||null,occasion:m.privateOuting?.occasion,companion:m.privateOuting?.companion});
const ONLY=process.argv.find(x=>x.startsWith('--only='))?.slice(7)||'club,picker,direct';
// --- Verein
for(const startId of ONLY.includes('club')?['EDTF','EDHE']:[]){
 const start=norm(startId),t={start:startId};report.club.push(t);
 try{
  const s=store(),r=await clubEvents.search({start:{name:start.n,lat:start.lat,lon:start.lon},maxNM:100,date:report.date,apiKey,storage:s});
  const airports=near(start,15,100,100),m=clubEvents.match(r.events,airports,geo.distanceKm);
  Object.assign(t,{events:r.events.map(e=>({title:e.title,startsOn:e.startsOn,venue:e.venue,verification:e.verification,domains:e.sourceDomains})),match:m&&{event:m.event.title,airport:m.airport.icao}});
  console.log(`Verein ${startId}: ${r.events.length} Treffer, Zuordnung ${m?m.event.title+' @ '+m.airport.icao:'keine'}`);
  for(const e of t.events)console.log('   ',e.verification,e.startsOn,e.title,'|',e.venue);
  if(m){const c=sandbox(s);vm.runInContext(fs.readFileSync('mission-club-browser.js','utf8'),c);
   const choices=await c.window.MissionClubBrowser.choices(airports,{start,searchMax:100});
   t.choices=choices.map(x=>({target:x.target.icao,title:x.title,subtitle:x.subtitle,event:x.clubProposal?.idea?.event?.title||null}));
   for(const x of t.choices)console.log('   →',x.target,'|',x.subtitle,'|',x.title);}
 }catch(e){t.error=String(e.message).replaceAll(apiKey,'[redacted]');console.log('Verein',startId,'Fehler',t.error);}
 save();
}
// --- Privat A: Picker
if(ONLY.includes('picker')){const start=norm('EDTW'),dest=norm('EDTF'),others=near(start,20,60,2),t={test:'picker',start:'EDTW',dest:'EDTF'};report.private.push(t);
 try{globalThis.PROBE_START=start.icao;const c=sandbox(store());const choices=await c.buildPrivateMissionProposalChoices([dest,...others],{start});
  t.search=JSON.parse(JSON.stringify(c.window.gaPrivateEventSearch||null));
  t.choices=choices.map(x=>({target:x.target.icao,title:x.title,description:x.description,eventVisit:x.privateProposal.idea.eventVisit}));
  console.log(`\nPrivat Picker EDTW → EDTF: Suche ${t.search?.status}, Ortsfakt ${t.search?.matchedTitle||'keiner'}`);
  for(const x of t.choices)console.log('   ',x.target,x.eventVisit?'[EVENT '+x.eventVisit.title+' '+x.eventVisit.eventDate+']':'','|',x.title);
  const contract={...contractFor(start,dest),privateProposal:choices[0].privateProposal,knowledgeContext:{status:'accept',facts:choices[0].privateProposal.input.facts.map(f=>f.value)}};
  const m=await c.fetchPrivateOutingStory({missionContractV4:contract});t.mission=brief(m);
  console.log('   Writer:',t.mission.title,'| Event:',t.mission.event?.title||'-');
 }catch(e){t.error=String(e.message).replaceAll(apiKey,'[redacted]');console.log('Privat Picker Fehler',t.error);}
 save();}
// --- Privat B: direkter Dispatch
if(ONLY.includes('direct')){const start=norm('EDHL'),dest=norm('EDDH'),t={test:'direct',start:'EDHL',dest:'EDDH'};report.private.push(t);
 try{const s=store(),c=sandbox(s);const fact=await c.findPrivateMissionEvent(dest,report.date,v6.recent(s));
  t.search=JSON.parse(JSON.stringify(c.window.gaPrivateEventSearch||null));
  console.log(`\nPrivat direkt EDHL → EDDH: Suche ${t.search?.status}, Ortsfakt ${fact?.title||'keiner'} ${fact?.eventDate||''}`);
  const contract={...contractFor(start,dest),knowledgeContext:{status:fact?'accept':'reject',facts:fact?[fact]:[]}};
  const m=await c.fetchPrivateOutingStory({missionContractV4:contract});t.mission=brief(m);
  console.log('   Writer:',t.mission.title,'| Event:',t.mission.event?.title||'-');
 }catch(e){t.error=String(e.message).replaceAll(apiKey,'[redacted]');console.log('Privat direkt Fehler',t.error);}
 save();}
console.log('\nKI-Abrufe gesamt:',report.requests);save();
