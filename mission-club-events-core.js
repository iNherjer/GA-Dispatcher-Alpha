(function(root){
'use strict';
const CACHE_KEY='ga_club_events_v3';
// Veranstaltungen der Flugsimulator-Szene (z. B. FS Conference am Flughafen Paderborn/Lippstadt) gehören
// zum Vereinsleben vieler Simmer und werden vor Fly-ins/Flugfesten angeboten (kind 'flightsim' vs. 'aviation').
const KINDS=['flightsim','aviation'];
// Veranstaltungsort höchstens 20 km vom Platz (Messe/Konferenz liegt oft in der Stadt, nicht am Vorfeld).
const MATCH_KM=20;
function kindOf(event){return String(event?.kind||'').trim().toLowerCase()==='flightsim'?'flightsim':'aviation';}
// Belegprüfung über mission-grounded-events-core.js (Textliste + groundingSupports pro Zeile); der frühere
// Abgleich sourceUrl gegen groundingChunks.uri konnte nie greifen, weil Google nur Weiterleitungs-URLs liefert.
function grounded(){return root.MissionGroundedEventsCore||(typeof module!=='undefined'?require('./mission-grounded-events-core.js'):null);}
function windowFor(date){const d=new Date(date+'T12:00:00Z');if(!Number.isFinite(+d))throw Error('Ungültiges Missionsdatum');d.setUTCDate(d.getUTCDate()+(7-d.getUTCDay())%7);return {from:date,through:d.toISOString().slice(0,10)};}
function prompt(start,maxNM,period){return `Recherchiere öffentlich angekündigte Veranstaltungen in der vom Startpunkt ${JSON.stringify(start)} bis ${maxNM} NM erreichbaren Region, Zeitraum ${period.from} bis ${period.through}, einschließlich mehrtägiger Veranstaltungen. Zwei Arten, beide gezielt suchen: (1) zuerst Veranstaltungen der Flugsimulator-Szene: Flugsimulator-Konferenzen, -Messen und -Community-Treffen mit Publikum, etwa Hersteller- und Entwicklertreffen, Simulator-Ausstellungen oder Flight-Sim-Events an Flughäfen und Messeorten; kind = flightsim. (2) danach Fly-ins und Flugfeste; kind = aviation. Suche regional breit. Nutze aktuelle Veranstalter- oder Flugplatzseiten, prüfe Jahr, Datum, Ort und Besuchsmöglichkeit. Keine Missionsideen, Personen oder Geschichten entwerfen. Keine Termine aus Vorjahren übernehmen. Liefere maximal 6 belegte Treffer, Flugsimulator-Veranstaltungen zuerst, sonst events:[]; keine Erfindung bei fehlenden Ergebnissen. kind ist genau flightsim oder aviation. sourceUrl ist die tatsächlich verwendete Quelle. Koordinaten beziehen sich auf den Veranstaltungsort. Keine Landeerlaubnis aus einer Veranstaltung ableiten.`;}
function validDate(value){return typeof value==='string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value+'T12:00:00Z')) && new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value;}
function parse(body,period){return grounded().parse(body,period,{kinds:null,keepKind:true,limit:6,lenient:true}).map(e=>({...e,kind:kindOf(e)}));}
async function search({start,maxNM,date,apiKey,storage,fetchImpl=fetch}){const period=windowFor(date),key=JSON.stringify([start.lat,start.lon,maxNM,period]);try{const cached=JSON.parse(storage?.getItem(CACHE_KEY)||'null');if(cached?.key===key&&Date.now()-cached.at<3600000)return {...cached,cacheHit:true};}catch{}
const body=await grounded().request({prompt:prompt(start,maxNM,period),apiKey,fetchImpl,maxOutputTokens:5000});const result={key,at:Date.now(),events:parse(body,period),usage:body.usageMetadata,cacheHit:false};try{storage?.setItem(CACHE_KEY,JSON.stringify(result));}catch{}return result;}
// Sim-Szene zuerst; innerhalb einer Art bleibt die Belegreihenfolge aus parse (belegte Treffer vorn).
function prioritized(events){return (Array.isArray(events)?events:[]).map((e,i)=>({e,i})).sort((a,b)=>(kindOf(a.e)==='flightsim'?0:1)-(kindOf(b.e)==='flightsim'?0:1)||a.i-b.i).map(x=>x.e);}
function match(events,airports,distanceKm){for(const event of prioritized(events)){const candidates=airports.map(airport=>({airport,km:distanceKm(event,airport)})).filter(x=>x.km<=MATCH_KM).sort((a,b)=>a.km-b.km);if(candidates.length)return {event,airport:candidates[0].airport};}return null;}
const api={KINDS,MATCH_KM,kindOf,prioritized,windowFor,prompt,parse,search,match};root.MissionClubEventsCore=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
