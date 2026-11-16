(function(root){
'use strict';
const CACHE_KEY='ga_club_events_v2';
// Belegprüfung über mission-grounded-events-core.js (Textliste + groundingSupports pro Zeile); der frühere
// Abgleich sourceUrl gegen groundingChunks.uri konnte nie greifen, weil Google nur Weiterleitungs-URLs liefert.
function grounded(){return root.MissionGroundedEventsCore||(typeof module!=='undefined'?require('./mission-grounded-events-core.js'):null);}
function windowFor(date){const d=new Date(date+'T12:00:00Z');if(!Number.isFinite(+d))throw Error('Ungültiges Missionsdatum');d.setUTCDate(d.getUTCDate()+(7-d.getUTCDay())%7);return {from:date,through:d.toISOString().slice(0,10)};}
function prompt(start,maxNM,period){return `Recherchiere öffentlich angekündigte Fly-ins und Flugfeste in der vom Startpunkt ${JSON.stringify(start)} bis ${maxNM} NM erreichbaren Region. Zeitraum ${period.from} bis ${period.through}, einschließlich mehrtägiger Veranstaltungen. Suche regional breit. Nutze aktuelle Veranstalter- oder Flugplatzseiten, prüfe Jahr, Datum, Ort und Besuchsmöglichkeit. Keine Missionsideen, Personen oder Geschichten entwerfen. Keine Termine aus Vorjahren übernehmen. Liefere maximal 5 belegte Treffer, sonst events:[]; keine Erfindung bei fehlenden Ergebnissen. Das Feld kind bleibt leer. sourceUrl ist die tatsächlich verwendete Quelle. Koordinaten beziehen sich auf den Veranstaltungsort. Keine Landeerlaubnis aus einer Veranstaltung ableiten.`;}
function validDate(value){return typeof value==='string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value+'T12:00:00Z')) && new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value;}
function parse(body,period){return grounded().parse(body,period,{kinds:null,limit:5,lenient:true});}
async function search({start,maxNM,date,apiKey,storage,fetchImpl=fetch}){const period=windowFor(date),key=JSON.stringify([start.lat,start.lon,maxNM,period]);try{const cached=JSON.parse(storage?.getItem(CACHE_KEY)||'null');if(cached?.key===key&&Date.now()-cached.at<3600000)return {...cached,cacheHit:true};}catch{}
const body=await grounded().request({prompt:prompt(start,maxNM,period),apiKey,fetchImpl,maxOutputTokens:5000});const result={key,at:Date.now(),events:parse(body,period),usage:body.usageMetadata,cacheHit:false};try{storage?.setItem(CACHE_KEY,JSON.stringify(result));}catch{}return result;}
function match(events,airports,distanceKm){for(const event of events){const candidates=airports.map(airport=>({airport,km:distanceKm(event,airport)})).filter(x=>x.km<=10).sort((a,b)=>a.km-b.km);if(candidates.length)return {event,airport:candidates[0].airport};}return null;}
const api={windowFor,prompt,parse,search,match};root.MissionClubEventsCore=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
