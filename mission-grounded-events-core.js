/* Gemeinsame Belegprüfung für Veranstaltungssuchen mit Gemini + Google Search (Charter, Verein).
   Hintergrund (Live-Diagnose 16.11.2026): groundingChunks liefern nur verschleierte Weiterleitungs-
   URLs (vertexaisearch.../grounding-api-redirect/...) und als title die Domain. Ein Abgleich der vom
   Modell genannten sourceUrl gegen chunk.uri schlägt daher immer fehl. Bei JSON-Antworten hängt
   Google zudem kaum Belege an. Deshalb antwortet die Suche als Textliste, eine Veranstaltung pro
   Zeile; groundingSupports ordnen Textabschnitte ihren Belegen zu. Eine Zeile gilt nur, wenn
   mindestens ein Beleg genau diese Zeile stützt. Die Belegdomains werden mitgeführt. */
(function(root){
'use strict';
const FIELDS=['id','title','venue','lat','lon','startsOn','endsOn','kind','sourceUrl','visitorInfo'];
const FORMAT=`Nutze für diese Aufgabe zwingend die Google-Suche und führe mehrere Suchanfragen aus. Öffne für jede Veranstaltung die angegebene Quellseite und prüfe dort Titel und Termin in diesem Jahr; nenne nur Veranstaltungen, die du so bestätigt hast. Wissen ohne Suchergebnis zählt nicht. Antworte ausschließlich als Textliste, eine Veranstaltung pro Zeile, ohne Einleitung, Markdown oder JSON, in genau diesem Format:\nEVENT | ${FIELDS.join(' | ')}\nlat/lon als Dezimalzahlen, startsOn/endsOn als JJJJ-MM-TT, sourceUrl als vollständige https-Adresse der Quelle, kein senkrechter Strich innerhalb der Felder. Ohne belegte Treffer genau eine Zeile: KEINE`;
function validDate(v){return typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v+'T12:00:00Z'))&&new Date(v+'T12:00:00Z').toISOString().slice(0,10)===v;}
function normUrl(u){try{const x=new URL(String(u||'').trim());return (x.hostname.replace(/^www\./,'')+x.pathname.replace(/\/+$/,'')).toLowerCase();}catch{return '';}}
function host(url){try{return new URL(url).hostname.toLowerCase().replace(/^www\./,'');}catch{return '';}}
function sameDomain(a,b){a=String(a||'').toLowerCase().replace(/^www\./,'');b=String(b||'').toLowerCase().replace(/^www\./,'');return !!a&&!!b&&(a===b||a.endsWith('.'+b)||b.endsWith('.'+a));}
function textOf(candidate){return (candidate?.content?.parts||[]).filter(x=>x.text&&!x.thought).map(x=>x.text).join('');}
// Zeilen mit Zeichenbereich; Belege werden über den Text ihres Abschnitts der Zeile zugeordnet.
function lines(raw){const out=[];let pos=0;for(const line of raw.split('\n')){out.push({line,from:pos,to:pos+line.length});pos+=line.length+1;}return out;}
function supportsByLine(raw,meta){
 const chunks=meta?.groundingChunks||[],rows=lines(raw),map=new Map();
 for(const s of meta?.groundingSupports||[]){
  const seg=String(s?.segment?.text||'');if(seg.trim().length<8)continue;
  let at=raw.indexOf(seg);if(at<0)continue;const end=at+seg.length;
  const domains=(s.groundingChunkIndices||[]).map(i=>chunks[i]?.web?.title||host(chunks[i]?.web?.uri)).filter(Boolean);
  if(!domains.length)continue;
  rows.forEach((r,i)=>{if(at<r.to&&end>r.from){const set=map.get(i)||new Set();domains.forEach(d=>set.add(String(d).toLowerCase()));map.set(i,set);}});
 }
 return {rows,map};
}
// Liefert geprüfte Veranstaltungen im Zeitraum; kinds optional (null = Feld wird ignoriert).
// Stufen: verification 'supported' = Zeile durch Suchbeleg gestützt oder Quellseite abgerufen;
// 'search' (nur mit lenient) = Suche lief nachweislich, die Zeile selbst ist nicht einzeln belegt.
// Gemini hängt über die Schnittstelle nur wenige Belege an (Live 16.11.2026: 2 von 8 lokalen Treffern),
// deshalb nutzen Charter und Verein die gestufte Annahme; belegte Treffer werden bevorzugt.
function parse(body,period,{kinds=null,limit=8,lenient=false}={}){
 const candidate=body?.candidates?.[0],raw=textOf(candidate);if(!raw)return [];
 const {rows,map}=supportsByLine(raw,candidate?.groundingMetadata);
 const fetchedUrls=new Set((candidate?.urlContextMetadata?.urlMetadata||candidate?.url_context_metadata?.url_metadata||[]).filter(m=>/SUCCESS/i.test(String(m.urlRetrievalStatus||m.url_retrieval_status||''))).map(m=>normUrl(m.retrievedUrl||m.retrieved_url)));
 const searched=(candidate?.groundingMetadata?.webSearchQueries||[]).length>0;
 const out=[];
 rows.forEach((r,i)=>{
  const t=r.line.trim().replace(/^[-*•]\s*/,'');if(!t.includes('|'))return;
  let cells=t.split('|').map(x=>x.trim());
  // Modelle ersetzen das Kennwort EVENT gelegentlich durch einen Namen; dann eine Spalte zu viel.
  if(/^EVENT$/i.test(cells[0])||cells.length===FIELDS.length+1)cells=cells.slice(1);
  if(cells.length<FIELDS.length)return;
  const e=Object.fromEntries(FIELDS.map((k,j)=>[k,cells[j]]));e.lat=Number(e.lat);e.lon=Number(e.lon);
  const fetched=fetchedUrls.has(normUrl(cells[FIELDS.indexOf('sourceUrl')]));
  const domains=[...(map.get(i)||[])];
  if(fetched)domains.unshift(host(cells[FIELDS.indexOf('sourceUrl')]));
  const supported=domains.length>0;
  if(!supported&&!(lenient&&searched))return; // weder belegt noch (gelockert) aus einer tatsächlich ausgeführten Suche
  if(!e.id||!e.title||!e.visitorInfo||!Number.isFinite(e.lat)||!Number.isFinite(e.lon)||Math.abs(e.lat)>90||Math.abs(e.lon)>180)return;
  if(!validDate(e.startsOn)||!validDate(e.endsOn)||e.startsOn>e.endsOn||e.endsOn<period.from||e.startsOn>period.through)return;
  if(kinds&&!kinds.includes(e.kind))return;
  const matched=domains.find(d=>sameDomain(d,host(e.sourceUrl)));
  // Die Modell-URL bleibt nur, wenn ihre Domain belegt ist; sonst gilt die belegende Domain als Quelle.
  out.push({id:e.id,title:e.title,venue:e.venue||'',lat:e.lat,lon:e.lon,startsOn:e.startsOn,endsOn:e.endsOn,...(kinds?{kind:e.kind}:{}),sourceUrl:(matched||!supported)&&/^https:\/\//.test(e.sourceUrl)?e.sourceUrl:supported?'https://'+domains[0]:'',sourceDomains:domains,sourceMatch:!!matched,sourceFetched:fetched,verification:supported?'supported':'search',visitorInfo:e.visitorInfo,retrievedAt:new Date().toISOString()});
 });
 out.sort((a,b)=>(a.verification==='supported'?0:1)-(b.verification==='supported'?0:1));
 return out.slice(0,limit);
}
async function request({prompt,apiKey,fetchImpl=fetch,maxOutputTokens=6000}){
 const res=await fetchImpl('https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent',{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':apiKey},body:JSON.stringify({contents:[{parts:[{text:prompt+'\n'+FORMAT}]}],tools:[{google_search:{}},{url_context:{}}],generationConfig:{maxOutputTokens,thinkingConfig:{thinkingLevel:'low'}}}),signal:AbortSignal.timeout(40000)});
 if(!res.ok)throw Error('Veranstaltungssuche HTTP '+res.status);
 return res.json();
}
const api={FIELDS,FORMAT,parse,request,sameDomain,host,normUrl,validDate};root.MissionGroundedEventsCore=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
