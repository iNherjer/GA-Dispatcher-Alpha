/* Charter: optionale Suche nach öffentlich angekündigten Veranstaltungen als belegter Anker.
   Gleiches Muster wie mission-club-events-core.js (ein Gemini-Aufruf mit Google Search, Beleg-
   prüfung pro Zeile über mission-grounded-events-core.js, Kalenderprüfung), aber mit Publikumsveranstaltungen und
   zwei Wochen Zeitfenster. Ohne Treffer bleibt der Charter frei erfunden. */
(function(root){
'use strict';
const CACHE_KEY='ga_charter_events_v2',CACHE_MS=3*3600000,WINDOW_DAYS=14,MATCH_KM=25;
// Reisearten, die eine Veranstaltung tragen kann; das Suchergebnis ordnet jeden Treffer genau einer zu.
const KINDS=['kultur','genuss','hobby','erlebnis','beruf'];
function windowFor(date){const d=new Date(date+'T12:00:00Z');if(!Number.isFinite(+d))throw Error('Ungültiges Missionsdatum');d.setUTCDate(d.getUTCDate()+WINDOW_DAYS);return {from:date,through:d.toISOString().slice(0,10)};}
function prompt(start,maxNM,period){return `Recherchiere öffentlich angekündigte Veranstaltungen mit Publikum in der vom Startpunkt ${JSON.stringify(start)} bis ${maxNM} NM erreichbaren Region, zu denen Gäste gezielt anreisen. Gesucht sind Kultur- und Musikveranstaltungen, Feste und Märkte, kulinarische Veranstaltungen, Sportereignisse zum Zuschauen oder Mitmachen, besondere Freizeit- und Erlebnisangebote mit festem Termin sowie Fachmessen und Kongresse. Zeitraum ${period.from} bis ${period.through}, einschließlich mehrtägiger Veranstaltungen. Suche regional breit und bevorzuge größere Städte und Urlaubsregionen. Nutze aktuelle Veranstalter-, Stadt- oder Tourismusseiten, prüfe Jahr, Datum, Ort und Besuchsmöglichkeit. Keine Missionsideen, Personen oder Geschichten entwerfen. Keine Termine aus Vorjahren übernehmen. Liefere maximal 8 belegte, möglichst verschiedenartige Treffer, sonst events:[]; keine Erfindung bei fehlenden Ergebnissen. kind ist genau einer von ${KINDS.join(', ')}: kultur für Kultur, Musik, Theater, Ausstellung, Fest; genuss für Kulinarik, Wein, Markt; hobby für Sport und Freizeitleidenschaften; erlebnis für besondere einmalige Erlebnisangebote; beruf für Fachmessen und Kongresse. sourceUrl ist die tatsächlich verwendete Quelle. Koordinaten beziehen sich auf den Veranstaltungsort. Keine Landeerlaubnis aus einer Veranstaltung ableiten.`;}
function grounded(){return root.MissionGroundedEventsCore||(typeof module!=='undefined'?require('./mission-grounded-events-core.js'):null);}
function parse(body,period){return grounded().parse(body,period,{kinds:KINDS,limit:8});}
async function search({start,maxNM,date,apiKey,storage,fetchImpl=fetch,useCache=true}){
 const period=windowFor(date),key=JSON.stringify([Math.round(start.lat*10)/10,Math.round(start.lon*10)/10,maxNM,period]);
 if(useCache){try{const cached=JSON.parse(storage?.getItem(CACHE_KEY)||'null');if(cached?.key===key&&Date.now()-cached.at<CACHE_MS)return {...cached,cacheHit:true};}catch{}}
 const body=await grounded().request({prompt:prompt(start,maxNM,period),apiKey,fetchImpl});
 const result={key,at:Date.now(),period,events:parse(body,period),usage:body.usageMetadata,cacheHit:false};
 try{storage?.setItem(CACHE_KEY,JSON.stringify(result));}catch{}
 return result;
}
// Erster Treffer mit einem Kandidatenflugplatz in Reichweite; zuletzt genutzte Veranstaltungen überspringen.
function match(events,airports,distanceKm,recent=[]){
 const used=new Set((Array.isArray(recent)?recent:[]).map(r=>r&&r.eventId).filter(Boolean));
 for(const event of events){if(used.has(event.id))continue;const c=airports.map(airport=>({airport,km:distanceKm(event,airport)})).filter(x=>Number.isFinite(x.km)&&x.km<=MATCH_KM).sort((a,b)=>a.km-b.km);if(c.length)return {event,airport:c[0].airport,km:Math.round(c[0].km)};}
 return null;
}
// Kompakter Datensatz für Frame, Idee und Vertrag.
function anchor(event){return event?{id:event.id,title:event.title,venue:event.venue,lat:event.lat,lon:event.lon,startsOn:event.startsOn,endsOn:event.endsOn,sourceUrl:event.sourceUrl,sourceDomains:event.sourceDomains||[],visitorInfo:event.visitorInfo,kind:event.kind}:null;}
const api={KINDS,WINDOW_DAYS,MATCH_KM,windowFor,prompt,parse,search,match,anchor};root.MissionCharterEventsCore=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
