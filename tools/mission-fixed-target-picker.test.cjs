// Fester Zielplatz mit Picker: drei Vorschläge zum selben Platz; ein Event am Ziel wird ohne Taktung angeboten.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const charter=require('../mission-charter-ideas-core.js'),events=require('../mission-charter-events-core.js'),grounded=require('../mission-grounded-events-core.js'),club=require('../mission-club-ideas-core.js');
const start={n:'Winzeln',icao:'EDTW',lat:48.27,lon:8.42},dest={n:'Freiburg',icao:'EDTF',lat:48.0225,lon:7.8325,city:'Freiburg im Breisgau'};
const match={id:'scf',title:'SC Freiburg – Heimspiel',venue:'Europa-Park Stadion',kind:'hobby',lat:48.0213,lon:7.8297,startsOn:'2026-11-22',endsOn:'2026-11-22',visitorInfo:'Bundesliga-Heimspiel',verification:'supported',sourceDomains:['scfreiburg.com']};
function sandbox(recent){
 let searchArgs=null,frames=null;
 const store={getItem:k=>k===charter.HISTORY_KEY?JSON.stringify(recent):null,setItem(){}};
 const c=vm.createContext({console:{warn(){}},Date,Math,JSON,localStorage:store,
  window:{MissionCharterIdeasCore:charter,MissionGroundedEventsCore:grounded,MissionClubIdeasCore:club,
   MissionCharterEventsCore:{...events,search:async a=>{searchArgs=a;return {events:[match],queries:1,cacheHit:false};}},
   MissionPrivateContextCore:{resolveBrowser:async()=>({places:[]}),distanceKm:(a,b)=>Math.hypot(a.lat-b.lat,(a.lon-b.lon)*0.67)*111}},
  getMissionAircraftCapabilitySnapshot:()=>({passengerCapacity:4}),getSelectedAiProvider:()=>'gemini',getSelectedAiApiKey:()=>'k',
  fetchGeminiJsonWithFallback:async prompt=>{frames=JSON.parse(prompt.slice(prompt.lastIndexOf('RAHMEN: ')+8).split('\n')[0]);throw Error('stop');}});
 vm.runInContext(fs.readFileSync('mission-charter-browser.js','utf8'),c);
 return {c,args:()=>searchArgs,frames:()=>frames};
}
test('Charter-Picker mit festem Ziel: alle Veranstaltungsarten ohne Taktung, Event trägt eine passende Reiseart',async()=>{
 const s=sandbox([{occasion:'kultur',eventId:'vorher'}]); // letzter Charter hatte ein Event: Taktung würde sonst aussetzen
 await assert.rejects(()=>s.c.window.MissionCharterBrowser.choices([dest,dest,dest],{start,fixedTarget:dest}),/stop/);
 assert.equal(s.args().kinds.join(),events.KINDS.join(),'alle Arten am Ziel');assert.match(s.args().place.name,/Freiburg/);
 const f=s.frames();assert.equal(f.length,3);assert.ok(f.every(x=>x.route.target.icao==='EDTF'));
 assert.equal(f[0].event.id,'scf');assert.ok(events.FITS[f[0].occasion.id].includes('hobby'),'Reiseart passt zum Spiel');
 assert.equal(f.filter(x=>x.event).length,1);assert.equal(new Set(f.map(x=>x.occasion.id)).size,3,'drei verschiedene Reisearten');
 assert.equal(s.c.window.gaCharterEventSearch.mode,'fixed-target');
});
test('Charter direkt mit festem Ziel sucht das Event; ohne festes Ziel bleibt die Taktung',async()=>{
 let s=sandbox([]);
 await assert.rejects(()=>s.c.window.MissionCharterBrowser.story({start,dest,fixedTarget:true}),/stop/);
 assert.equal(s.frames()[0].event.id,'scf');
 s=sandbox([]);
 await assert.rejects(()=>s.c.window.MissionCharterBrowser.story({start,dest}),/stop/);
 assert.equal(s.args(),null);assert.equal(s.frames()[0].event,undefined);
});
test('Picker-Weiche: festes Ziel liefert dreimal denselben Platz an den Strang, auch ohne Dedupe',async()=>{
 const code=fs.readFileSync('app.js','utf8');let got=null;
 const c=vm.createContext({window:{MissionFragileCargoBrowser:{choices:async(a,ctx)=>{got={a,ctx};return [];}}},console,
  getMissionTaskProfile:()=>({}),getAirportData:async icao=>({n:'Freiburg',lat:48,lon:7.8,icao}),collectMissionProposalAirportCandidates:async()=>{throw Error('keine Umkreissuche bei festem Ziel');}});
 for(const name of ['missionProposalAptProfileConfig','missionProposalFixedTargetEligible','buildMissionProposalAptChoices']){const at=code.indexOf('function '+name+'('),b=code.slice(at-6,at)==='async '?at-6:at,end=code.indexOf('\nfunction ',at+1),end2=code.indexOf('\nasync function ',at+1);vm.runInContext(code.slice(b,Math.min(...[end,end2].filter(x=>x>0))),c);}
 await c.buildMissionProposalAptChoices({start,targetDest:'EDTF',aiModeEnabled:true,effectiveType:'apt',dispatchProfileId:'cargo_fragile'});
 assert.equal(got.a.length,3);assert.ok(got.a.every(x=>x.icao==='EDTF'));assert.equal(got.ctx.fixedTarget.icao,'EDTF');
 assert.equal(await c.buildMissionProposalAptChoices({start,targetDest:'EDTF',aiModeEnabled:false,effectiveType:'apt',dispatchProfileId:'cargo_fragile'}).then(r=>r.length),0,'ohne KI kein Picker mit festem Ziel');
});
test('Privat: festes Ziel hebt die Event-Taktung auf, sonst bleibt sie',async()=>{
 const code=fs.readFileSync('app.js','utf8'),at=code.indexOf('async function findPrivateMissionEvent('),end=code.indexOf('\nasync function ',at+1);
 let searched=0;const outing={eventWindowFor:()=>({arrivalDate:'2026-11-21',throughDate:'2026-11-22'})};
 const c=vm.createContext({console:{warn(){}},localStorage:{},getSelectedAiProvider:()=>'gemini',getSelectedAiApiKey:()=>'k',missionProposalCompactTarget:a=>({n:a.n,icao:a.icao,lat:a.lat,lon:a.lon}),
  window:{MissionCharterEventsCore:{...events,search:async()=>{searched++;return {events:[match],queries:1};}},MissionGroundedEventsCore:grounded,MissionPrivateOutingCore:outing,MissionPrivateContextCore:{distanceKm:()=>2}}});
 vm.runInContext(code.slice(at,end),c);
 const recent=[{eventId:'x'}];
 assert.equal(await c.findPrivateMissionEvent(dest,'2026-11-20',recent),null);assert.equal(searched,0,'Taktung greift ohne festes Ziel');
 const fact=await c.findPrivateMissionEvent(dest,'2026-11-20',recent,{fixedTarget:true});assert.equal(searched,1);assert.equal(fact.eventId,'scf');
});
