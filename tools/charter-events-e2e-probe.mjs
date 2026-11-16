// End-to-end-Probe des echten Charter-Picker-Pfads mit Veranstaltungssuche am Ziel:
// MissionCharterBrowser.choices (eine Suche am Ziel + ein Ideenaufruf für drei Plätze),
// danach story() für den Platz am Testziel (ein Writer-Aufruf). Drei KI-Abrufe je Test.
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const grounded=require('../mission-grounded-events-core.js'),events=require('../mission-charter-events-core.js'),realCore=require('../mission-charter-ideas-core.js');
require('../mission-private-outing-core.js');
const flight=require('../mission-private-episode-v6.js'),club=require('../mission-club-ideas-core.js'),geo=require('../mission-private-context-core.js');
if(process.argv[2]!=='--run')throw Error('Use --run');
const output=process.argv.find(x=>x.startsWith('--out='))?.slice(6)||'analysis/charter-events-e2e-20261116.json';
if(fs.existsSync(output))throw Error('Output exists; do not repeat paid calls');
function key(){if(process.env.GEMINI_API_KEY)return process.env.GEMINI_API_KEY;for(const file of ['key.env.local','.env.local','.env']){if(!fs.existsSync(file))continue;const lines=fs.readFileSync(file,'utf8').split(/\r?\n/).map(x=>x.trim()).filter(x=>x&&!x.startsWith('#'));const line=lines.find(x=>/^GEMINI_API_KEY\s*=/.test(x));if(line)return line.slice(line.indexOf('=')+1).trim().replace(/^(['"])(.*)\1$/,'$2');if(lines.length===1&&!lines[0].includes('='))return lines[0];}throw Error('Kein lokaler Gemini-Key');}
const apiKey=key(),A=JSON.parse(fs.readFileSync('airports.json','utf8'));
const norm=id=>({...A[id],icao:id,name:A[id].name||id,n:A[id].name||id,lat:Number(A[id].lat),lon:Number(A[id].lon)});
const report={date:new Date().toLocaleDateString('en-CA'),tests:[],requests:0},save=()=>fs.writeFileSync(output,JSON.stringify(report,null,2));
function parse(raw){const clean=raw.replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,'');return JSON.parse(clean);}
async function request(prompt){report.requests++;const res=await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent',{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':apiKey},body:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:{response_mime_type:'application/json',maxOutputTokens:8000,thinkingConfig:{thinkingLevel:'low'}}})});if(!res.ok)throw Error('HTTP '+res.status);const body=await res.json();return {parsed:parse((body.candidates?.[0]?.content?.parts||[]).filter(x=>x.text&&!x.thought).map(x=>x.text).join(''))};}
// Suchabrufe über grounded.request zählen
const realReq=grounded.request;grounded.request=async o=>{report.requests++;return realReq(o);};
// Reihenfolge der Reisearten so, dass der erste Platz (Testziel) eine eventfähige Reiseart hat.
const core={...realCore,pickOccasions:(...a)=>{const o=realCore.pickOccasions(...a);const i=o.findIndex(x=>events.FITS[x.id]);if(i>0)[o[0],o[i]]=[o[i],o[0]];return o;}};
const memory=new Map(),storage={getItem:k=>memory.get(k),setItem:(k,v)=>memory.set(k,v)};
const context=vm.createContext({console,Date,Math,JSON,AbortSignal,window:{MissionCharterIdeasCore:core,MissionCharterEventsCore:events,MissionGroundedEventsCore:grounded,MissionClubIdeasCore:club,MissionPrivateEpisodeV6:flight,MissionPrivateContextCore:{distanceKm:geo.distanceKm,resolveBrowser:async()=>({places:[]})}},localStorage:storage,getSelectedAiProvider:()=>'gemini',getSelectedAiApiKey:()=>apiKey,getMissionAircraftCapabilitySnapshot:()=>({passengerCapacity:3}),missionTrackerSupportsGroupGeneration:()=>true,fetchGeminiJsonWithFallback:request,normalizeMissionProposalChoice:x=>x,missionProposalCompactTarget:a=>({icao:a.icao,n:a.name,lat:a.lat,lon:a.lon}),missionProposalFormatRoute:(s,a)=>({label:(s.icao||'')+' → '+a.icao})});
vm.runInContext(fs.readFileSync('mission-charter-browser.js','utf8'),context);
const win=context.window;
for(const [startId,destId] of [['EDTF','EDTW'],['EDTW','EDTF'],['EDHL','EDDH']]){
 const start=norm(startId),dest=norm(destId);
 const others=Object.keys(A).filter(id=>id!==startId&&id!==destId&&Number.isFinite(Number(A[id].lat))).map(norm).map(a=>({a,nm:geo.distanceKm(start,a)/1.852})).filter(x=>x.nm>=20&&x.nm<=90).sort(()=>Math.random()-0.5).slice(0,2).map(x=>x.a);
 const t={start:startId,dest:destId};report.tests.push(t);
 try{
  const choices=await win.MissionCharterBrowser.choices([dest,...others],{start,searchMax:120});
  t.search=JSON.parse(JSON.stringify(win.gaCharterEventSearch||null));
  t.picker=choices.map(c=>({target:c.target.icao,occasion:c.charterProposal.idea.occasion?.id,event:c.charterProposal.idea.event?.title||null,title:c.title,subtitle:c.subtitle,role:c.charterProposal.idea.passenger.role,pax:c.paxText}));
  save();console.log(`\n${startId} → ${destId}: Suche ${t.search?.status} (${t.search?.place||'-'}, ${t.search?.count??0} Treffer) Anker: ${t.search?.matchedTitle||'keiner'}`);
  for(const p of t.picker)console.log('  ',p.target,p.occasion,'|',p.subtitle,'|',p.title);
  const chosen=choices[0];
  const m=await win.MissionCharterBrowser.story({start,dest,proposal:chosen.charterProposal,contract:{route:{startName:start.name,targetName:dest.name,distanceNm:Math.round(geo.distanceKm(start,dest)/1.852*10)/10},weather:{}}});
  t.mission={title:m.t,story:m._missionWriterV4Debug.rawAiStory,greeting:m.passenger.greetingText,pax:m.pax,cargo:m.cargo,event:m.charterIdea.event||null,returnPlan:m.charterIdea.returnPlan};
  save();console.log('  Writer:',m.t,'('+t.mission.story.length+' Zeichen)');
 }catch(e){t.error=String(e.message).replaceAll(apiKey,'[redacted]');save();console.log(`\n${startId} → ${destId}: Fehler ${t.error}`);}
}
console.log('\nKI-Abrufe gesamt:',report.requests);save();
