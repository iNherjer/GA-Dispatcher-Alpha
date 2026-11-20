/* Charter: optionale Suche nach öffentlich angekündigten Veranstaltungen am Zielort als Anker.
   Die Suche fragt gezielt nach einem Ort und Zeitraum (wie eine normale Google-Suche
   "Veranstaltungen <Ort> diese Woche"), nicht nach einer ganzen Region; regional breite Fragen
   lieferten Großmessen weit vom Ziel (Live-Probe 16.11.2026). Belegprüfung und Stufen über
   mission-grounded-events-core.js. Ohne passenden Treffer bleibt der Charter frei erfunden. */
(function(root){
'use strict';
const CACHE_KEY='ga_charter_events_v4',CACHE_MS=3*3600000,WINDOW_DAYS=14,MATCH_KM=20;
// Taktung je Strang (siehe MissionGroundedEventsCore.eventDue): Charter höchstens jeder zweite, Privat jeder dritte Flug.
const EVENT_EVERY={charter:2,private:3};
// Privat: Ausflugsarten, keine Messen.
const PRIVATE_KINDS=['kultur','genuss','hobby','erlebnis'];
// Art der Veranstaltung; das Suchergebnis ordnet jeden Treffer genau einer zu.
const KINDS=['kultur','genuss','hobby','erlebnis','beruf'];
// Welche Veranstaltungsarten zu welcher Charter-Reiseart passen. Reisearten ohne Eintrag suchen nicht.
const FITS={kultur:['kultur'],genuss:['genuss'],hobby:['hobby'],erlebnis:['erlebnis','hobby'],beruf:['beruf'],vip:['kultur','hobby','beruf'],urlaub:['kultur','genuss','erlebnis'],paar:['kultur','genuss'],ueberraschung:['kultur','erlebnis','genuss']};
// Reihenfolge mehrerer passender Treffer (Auswertung der Live-Suchen 16.11.2026: auch werktags gibt es
// Spitzenkonzerte, am Wochenende nicht systematisch Besseres; Dauerangebote wie Märkte, Ausstellungen oder
// Volksfeste laufen wochenlang und sind weniger besonders): belegt vor nur gesucht, kurze Termine vor
// Dauerangeboten (über 14 Tage), dann der effektiv nächste Tag (laufende zählen ab heute), dann die kürzere Laufzeit, dann die Nähe.
const LONG_RUNNING_DAYS=14;
function today(){return new Date().toLocaleDateString('en-CA');}
function days(a,b){return Math.round((Date.parse(b+'T12:00:00Z')-Date.parse(a+'T12:00:00Z'))/86400000);}
function rank(a,b,now){const v=x=>x.e.verification==='supported'?0:1,l=x=>days(x.e.startsOn,x.e.endsOn)>LONG_RUNNING_DAYS?1:0,d=x=>x.e.startsOn<now?now:x.e.startsOn;return v(a)-v(b)||l(a)-l(b)||String(d(a)).localeCompare(String(d(b)))||days(a.e.startsOn,a.e.endsOn)-days(b.e.startsOn,b.e.endsOn)||a.km-b.km;}
function windowFor(date){const d=new Date(date+'T12:00:00Z');if(!Number.isFinite(+d))throw Error('Ungültiges Missionsdatum');d.setUTCDate(d.getUTCDate()+WINDOW_DAYS);return {from:date,through:d.toISOString().slice(0,10)};}
function placeName(airport){return String(airport?.city||airport?.municipality||airport?.name||airport?.n||'').trim();}
function prompt(place,period,kinds){return `Suche nach Veranstaltungen in ${place.name} und direkter Umgebung (höchstens ${MATCH_KM} km um ${place.lat.toFixed(3)}, ${place.lon.toFixed(3)}) vom ${period.from} bis ${period.through}, einschließlich mehrtägiger Veranstaltungen, die in diesen Zeitraum fallen. Gesucht sind öffentliche Veranstaltungen, die für auswärtige Besucher interessant sind und zu einer dieser Arten gehören: ${kinds.map(k=>({kultur:'Konzert, Theater, Ausstellung, Fest',genuss:'Kulinarik, Wein, Markt',hobby:'Sportveranstaltung zum Zuschauen oder Mitmachen, ausdrücklich auch Heimspiele und Wettkämpfe von Profi- und Spitzenvereinen am Ort, Freizeitleidenschaft',erlebnis:'besonderes Erlebnisangebot mit festem Termin',beruf:'Fachmesse, Kongress'})[k]).join('; ')}. Nur Veranstaltungen, die tatsächlich an einem Ort in ${place.name} oder direkter Umgebung stattfinden. Keine Missionsideen, Personen oder Geschichten. Keine Termine aus Vorjahren. Maximal 8 möglichst verschiedenartige Treffer; decke jede gesuchte Art mit mindestens einem Treffer ab, wenn es dafür einen belegten Termin gibt. kind ist genau einer von ${kinds.join(', ')}. visitorInfo nennt kurz, was Besucher erwartet, mit Uhrzeit nur, wenn sie in der Quelle steht. sourceUrl ist die tatsächlich verwendete Quelle. Keine Landeerlaubnis aus einer Veranstaltung ableiten.`;}
function grounded(){return root.MissionGroundedEventsCore||(typeof module!=='undefined'?require('./mission-grounded-events-core.js'):null);}
function parse(body,period,kinds=KINDS){return grounded().parse(body,period,{kinds,limit:8,lenient:true});}
async function search({place,date,period:fixed=null,kinds=KINDS,apiKey,storage,fetchImpl=fetch,useCache=true}){
 const period=fixed||windowFor(date),key=JSON.stringify([place.name,Math.round(place.lat*100)/100,Math.round(place.lon*100)/100,period,kinds]);
 let cache={};try{cache=JSON.parse(storage?.getItem(CACHE_KEY)||'{}')||{};}catch{}
 const hit=cache[key];if(useCache&&hit&&Date.now()-hit.at<CACHE_MS)return {...hit,cacheHit:true};
 const body=await grounded().request({prompt:prompt(place,period,kinds),apiKey,fetchImpl});
 const result={at:Date.now(),place:place.name,period,events:parse(body,period,kinds),queries:(body.candidates?.[0]?.groundingMetadata?.webSearchQueries||[]).length,usage:body.usageMetadata,cacheHit:false};
 try{const fresh=Object.fromEntries(Object.entries(cache).filter(([,v])=>Date.now()-v.at<CACHE_MS).slice(-5));fresh[key]=result;storage?.setItem(CACHE_KEY,JSON.stringify(fresh));}catch{}
 return result;
}
// Bester Treffer nahe dem Zielflugplatz zu einer der Arten (Privat: alle Ausflugsarten).
function pickKinds(events,airport,kinds,distanceKm,recent=[]){const used=new Set((Array.isArray(recent)?recent:[]).map(r=>r&&r.eventId).filter(Boolean));const ok=events.filter(e=>kinds.includes(e.kind)&&!used.has(e.id)).map(e=>({e,km:distanceKm(e,airport)})).filter(x=>Number.isFinite(x.km)&&x.km<=MATCH_KM);ok.sort((a,b)=>rank(a,b,today()));return ok[0]?{event:ok[0].e,km:Math.round(ok[0].km)}:null;}
// Privat-Ortsfakt aus einem Event: Tag innerhalb des Fensters (mehrtägig: erster Tag im Fenster).
function privateFact(event,window,airport,distanceKm){if(!event||!window)return null;if(event.endsOn<window.arrivalDate||event.startsOn>window.throughDate)return null;const day=event.startsOn<window.arrivalDate?window.arrivalDate:event.startsOn;return {kind:'event',topic:'event',eventId:event.id,name:event.title,title:event.title,venue:event.venue,lat:event.lat,lon:event.lon,eventDate:day,startsOn:event.startsOn,endsOn:event.endsOn,source:event.sourceUrl||(event.sourceDomains||[])[0]||'Websuche',verification:event.verification||null,distanceKm:Math.round(distanceKm(airport,event)*10)/10,text:`${event.title} (${event.venue||'Ort laut Quelle'}), ${event.startsOn===event.endsOn?event.startsOn:event.startsOn+' bis '+event.endsOn}: ${event.visitorInfo} Recherchierte öffentliche Veranstaltung; eine Möglichkeit, keine Pflicht. Uhrzeiten und Programm nur, soweit hier genannt.`};}
// Bester Treffer nahe dem Zielflugplatz, passend zur Reiseart; belegte Treffer vor nur gesuchten,
// zuletzt genutzte Veranstaltungen überspringen.
function pick(events,airport,occasionId,distanceKm,recent=[]){
 const fits=FITS[occasionId]||[],used=new Set((Array.isArray(recent)?recent:[]).map(r=>r&&r.eventId).filter(Boolean));
 const ok=events.filter(e=>fits.includes(e.kind)&&!used.has(e.id)).map(e=>({e,km:distanceKm(e,airport)})).filter(x=>Number.isFinite(x.km)&&x.km<=MATCH_KM);
 // Belegte zuerst, dann die zeitlich nächste Veranstaltung (ein Charter fliegt heute), dann die nächstgelegene.
 ok.sort((a,b)=>rank(a,b,today()));
 return ok[0]?{event:ok[0].e,km:Math.round(ok[0].km)}:null;
}
// Der Picker sucht für den ersten Platz, dessen Reiseart eine Veranstaltung tragen kann.
function searchSlot(occasions){return occasions.findIndex(o=>o&&FITS[o.id]);}
// Kompakter Datensatz für Frame, Idee und Vertrag.
function anchor(event){return event?{id:event.id,title:event.title,venue:event.venue,lat:event.lat,lon:event.lon,startsOn:event.startsOn,endsOn:event.endsOn,sourceUrl:event.sourceUrl,sourceDomains:event.sourceDomains||[],verification:event.verification||null,visitorInfo:event.visitorInfo,kind:event.kind}:null;}
const api={rank,LONG_RUNNING_DAYS,KINDS,FITS,EVENT_EVERY,PRIVATE_KINDS,pickKinds,privateFact,WINDOW_DAYS,MATCH_KM,windowFor,placeName,prompt,parse,search,pick,searchSlot,anchor};root.MissionCharterEventsCore=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
