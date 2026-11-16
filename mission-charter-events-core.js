/* Charter: optionale Suche nach öffentlich angekündigten Veranstaltungen am Zielort als Anker.
   Die Suche fragt gezielt nach einem Ort und Zeitraum (wie eine normale Google-Suche
   "Veranstaltungen <Ort> diese Woche"), nicht nach einer ganzen Region; regional breite Fragen
   lieferten Großmessen weit vom Ziel (Live-Probe 16.11.2026). Belegprüfung und Stufen über
   mission-grounded-events-core.js. Ohne passenden Treffer bleibt der Charter frei erfunden. */
(function(root){
'use strict';
const CACHE_KEY='ga_charter_events_v3',CACHE_MS=3*3600000,WINDOW_DAYS=14,MATCH_KM=20;
// Art der Veranstaltung; das Suchergebnis ordnet jeden Treffer genau einer zu.
const KINDS=['kultur','genuss','hobby','erlebnis','beruf'];
// Welche Veranstaltungsarten zu welcher Charter-Reiseart passen. Reisearten ohne Eintrag suchen nicht.
const FITS={kultur:['kultur'],genuss:['genuss'],hobby:['hobby'],erlebnis:['erlebnis','hobby'],beruf:['beruf'],vip:['kultur','hobby','beruf'],urlaub:['kultur','genuss','erlebnis'],paar:['kultur','genuss'],ueberraschung:['kultur','erlebnis','genuss']};
function windowFor(date){const d=new Date(date+'T12:00:00Z');if(!Number.isFinite(+d))throw Error('Ungültiges Missionsdatum');d.setUTCDate(d.getUTCDate()+WINDOW_DAYS);return {from:date,through:d.toISOString().slice(0,10)};}
function placeName(airport){return String(airport?.city||airport?.municipality||airport?.name||airport?.n||'').trim();}
function prompt(place,period,kinds){return `Suche nach Veranstaltungen in ${place.name} und direkter Umgebung (höchstens ${MATCH_KM} km um ${place.lat.toFixed(3)}, ${place.lon.toFixed(3)}) vom ${period.from} bis ${period.through}, einschließlich mehrtägiger Veranstaltungen, die in diesen Zeitraum fallen. Gesucht sind öffentliche Veranstaltungen, die für auswärtige Besucher interessant sind und zu einer dieser Arten gehören: ${kinds.map(k=>({kultur:'Konzert, Theater, Ausstellung, Fest',genuss:'Kulinarik, Wein, Markt',hobby:'Sportveranstaltung zum Zuschauen oder Mitmachen, Freizeitleidenschaft',erlebnis:'besonderes Erlebnisangebot mit festem Termin',beruf:'Fachmesse, Kongress'})[k]).join('; ')}. Nur Veranstaltungen, die tatsächlich an einem Ort in ${place.name} oder direkter Umgebung stattfinden. Keine Missionsideen, Personen oder Geschichten. Keine Termine aus Vorjahren. Maximal 8 möglichst verschiedenartige Treffer. kind ist genau einer von ${kinds.join(', ')}. visitorInfo nennt kurz, was Besucher erwartet, mit Uhrzeit nur, wenn sie in der Quelle steht. sourceUrl ist die tatsächlich verwendete Quelle. Keine Landeerlaubnis aus einer Veranstaltung ableiten.`;}
function grounded(){return root.MissionGroundedEventsCore||(typeof module!=='undefined'?require('./mission-grounded-events-core.js'):null);}
function parse(body,period,kinds=KINDS){return grounded().parse(body,period,{kinds,limit:8,lenient:true});}
async function search({place,date,kinds=KINDS,apiKey,storage,fetchImpl=fetch,useCache=true}){
 const period=windowFor(date),key=JSON.stringify([place.name,Math.round(place.lat*100)/100,Math.round(place.lon*100)/100,period,kinds]);
 let cache={};try{cache=JSON.parse(storage?.getItem(CACHE_KEY)||'{}')||{};}catch{}
 const hit=cache[key];if(useCache&&hit&&Date.now()-hit.at<CACHE_MS)return {...hit,cacheHit:true};
 const body=await grounded().request({prompt:prompt(place,period,kinds),apiKey,fetchImpl});
 const result={at:Date.now(),place:place.name,period,events:parse(body,period,kinds),queries:(body.candidates?.[0]?.groundingMetadata?.webSearchQueries||[]).length,usage:body.usageMetadata,cacheHit:false};
 try{const fresh=Object.fromEntries(Object.entries(cache).filter(([,v])=>Date.now()-v.at<CACHE_MS).slice(-5));fresh[key]=result;storage?.setItem(CACHE_KEY,JSON.stringify(fresh));}catch{}
 return result;
}
// Bester Treffer nahe dem Zielflugplatz, passend zur Reiseart; belegte Treffer vor nur gesuchten,
// zuletzt genutzte Veranstaltungen überspringen.
function pick(events,airport,occasionId,distanceKm,recent=[]){
 const fits=FITS[occasionId]||[],used=new Set((Array.isArray(recent)?recent:[]).map(r=>r&&r.eventId).filter(Boolean));
 const ok=events.filter(e=>fits.includes(e.kind)&&!used.has(e.id)).map(e=>({e,km:distanceKm(e,airport)})).filter(x=>Number.isFinite(x.km)&&x.km<=MATCH_KM);
 ok.sort((a,b)=>(a.e.verification==='supported'?0:1)-(b.e.verification==='supported'?0:1)||a.km-b.km);
 return ok[0]?{event:ok[0].e,km:Math.round(ok[0].km)}:null;
}
// Der Picker sucht für den ersten Platz, dessen Reiseart eine Veranstaltung tragen kann.
function searchSlot(occasions){return occasions.findIndex(o=>o&&FITS[o.id]);}
// Kompakter Datensatz für Frame, Idee und Vertrag.
function anchor(event){return event?{id:event.id,title:event.title,venue:event.venue,lat:event.lat,lon:event.lon,startsOn:event.startsOn,endsOn:event.endsOn,sourceUrl:event.sourceUrl,sourceDomains:event.sourceDomains||[],verification:event.verification||null,visitorInfo:event.visitorInfo,kind:event.kind}:null;}
const api={KINDS,FITS,WINDOW_DAYS,MATCH_KM,windowFor,placeName,prompt,parse,search,pick,searchSlot,anchor};root.MissionCharterEventsCore=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
