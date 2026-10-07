(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MissionEnvironmentCore=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const VERSION='mission-environment.v1';
 const fields={temperature_2m:'°C',precipitation:'mm',rain:'mm',snowfall:'cm',snow_depth:'m',wind_speed_10m:'kn',wind_gusts_10m:'kn',cloud_cover:'%',weather_code:'wmo code'};
 const instructions='UMGEBUNGSKONTEXT: Nutze Datum, regionale Lage und Wetter nach eigenem erzählerischem Ermessen als Inspiration für Anlass, Erinnerungen oder Hintergrund. Es gibt keine Quote und keine Zuordnung von Wetter zu bestimmten Geschichten. Die Daten sind ein optionales Reservoir, keine Liste abzuarbeitender Briefing-Punkte. Entwickle zuerst einen eigenständigen Anlass und wähle dann die dafür interessanten Kontextinformationen. Optionale Wetterinformationen nicht in mustMention umwandeln. Wenn ein Feld 0–3 Hinweise verlangt, ist eine leere Liste ebenfalls vollständig. Auch vorhandene weatherHooks sind Angebote und müssen nicht in den Erzähltext übernommen werden; leere weatherHooks sind gültig. Wetter darf auch beiläufig als angenehmer oder herausfordernder Flugrahmen im Briefing auftauchen, ohne den Anlass zu bestimmen; eine positive Bemerkung über passende Bedingungen ist willkommen, wenn die gelieferten Daten sie tragen. Auch ohne Wetterbezug ist der Auftrag vollständig. Baue keinen standardisierten Wetterabsatz und keine meteorologische Checkliste in jedes Briefing ein. Beachte die mitgelieferte History auch beim eigentlichen Anlass: nicht dieselbe Wetterrettung oder Vorsorgegeschichte lediglich mit anderen Orten und Personen wiederholen. Persönliche Pläne, Versorgung, Begegnungen und andere wetterunabhängige Anlässe dürfen die Geschichte ebenso tragen. Profil, Ziel und TaskDomain bleiben bindend. createdLocal ist die lokale Gerätezeit bei der Erstellung, kein bestätigter Abflugzeitpunkt. Nur tatsächlich gelieferte meteorologische Größen sind belegt: Temperatur, Niederschlag, Schnee, Windgeschwindigkeit/Böen und Bewölkung. Windrichtung, Luftdruck/Hochdrucklage, Sichtweite und Wolkenuntergrenze sind ohne zusätzliche Daten unbekannt. Aus diesen Modellwerten allein folgen keine VFR-Eignung, Flugfreigabe, freie Bergpässe, Schneefreiheit oder Pistenbeschaffenheit. Wetter ist zeitlich und räumlich zugeordnetes Modellwissen, keine bestätigte Sicht im Simulator. Rückblick, aktueller Stundenwert und die Prognosen forecastNext6Hours / forecastNext72Hours sind getrennt; Prognosen dürfen als erwartete Entwicklung mit Bezug auf ihre Gültigkeitszeiten in die Geschichte eingehen, nicht als sichere Zukunft oder Live-Beobachtung. Eine erwartete Lage in den nächsten Tagen darf auch einen vorbeugenden Anlass inspirieren; keine Pflicht zum Wetterauftrag. Die Drei-Tage-Fenster sind rollende 24-Stunden-Zeiträume mit konkreten UTC-Grenzen, keine lokalen Kalendertage. Prognosen sind Modellvorhersagen, keine amtlichen Warnungen und keine Gewissheit. Zeitpunkt des tatsächlichen Fluges bleibt unbekannt. snow_depth bezeichnet die vorhandene Schneehöhe in Metern, snowfall den neu gefallenen Schnee in Zentimetern pro Stunde; die Rückblicksumme ist kein Maß für die aktuelle Schneedecke. Aus Min/Max-Werten allein ergibt sich keine zeitliche Richtung; aus Datenlücken keine Trockenheit ableiten. Fiktive persönliche Ereignisse dürfen daraus entstehen; Wetterverläufe, sichtbare Schneedecken oder durchgehend anhaltende Stürme nicht als belegt ausgeben, wenn die Daten dies nicht tragen. Follow-ups dürfen den neuen Kontext nutzen und bewahren die bisherige Geschichte.';
 const finite=v=>typeof v==='number'&&Number.isFinite(v);
 const round=v=>Math.round(v*100)/100;
 function location(p){if(!p||!finite(p.lat)||!finite(p.lon)||Math.abs(p.lat)>90||Math.abs(p.lon)>180)return null;return {name:String(p.n||p.name||'').slice(0,140),lat:p.lat,lon:p.lon};}
 function temporal(date=new Date()){
  const pad=n=>String(n).padStart(2,'0');
  return {source:'user-device-local',createdAt:date.toISOString(),createdLocal:`${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`,utcOffsetMinutes:-date.getTimezoneOffset(),timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone,departureTimeKnown:false};
 }
 function summarize(data,p,now=new Date()){
  const h=data?.hourly,u=data?.hourly_units||{};
  if(!h||!Array.isArray(h.time)||data.utc_offset_seconds!==0)return {location:location(p),status:'unavailable',reason:'invalid_time_basis'};
  const end=Math.floor(now.getTime()/3600000)*3600000,start=end-72*3600000;
  const times=h.time.map(t=>Date.parse(/Z$|[+-]\d\d:\d\d$/.test(t)?t:t+'Z'));
  const indices=times.map((t,i)=>t>=start&&t<end?i:-1).filter(i=>i>=0);
  const unique=new Set(indices.map(i=>times[i]));
  const i=times.indexOf(end);
  const value=(k,j)=>u[k]===fields[k]&&finite(h[k]?.[j])?h[k][j]:null;
  const current={};for(const k of Object.keys(fields))current[k]=i>=0?value(k,i):null;
  const forecastHours=Array.from({length:6},(_,offset)=>{
   const at=end+(offset+1)*3600000,index=times.indexOf(at),values={};
   for(const k of Object.keys(fields))values[k]=index>=0?value(k,index):null;
   return {validAt:new Date(at).toISOString(),values};
  });
  const forecast={from:new Date(end+3600000).toISOString(),to:new Date(end+6*3600000).toISOString(),expectedHours:6,availableHours:forecastHours.filter(row=>Object.values(row.values).some(finite)).length,hours:forecastHours};
  const outlookKeys=['temperature_2m','precipitation','rain','snowfall','snow_depth','wind_speed_10m','wind_gusts_10m','cloud_cover'];
  const outlookWindows=Array.from({length:3},(_,day)=>{
   const slots=Array.from({length:24},(_,j)=>end+(day*24+j+1)*3600000);
   const js=slots.map(at=>times.filter(t=>t===at).length===1?times.indexOf(at):-1);
   const statistics={};
   for(const k of outlookKeys){
    const vs=js.map(j=>j>=0?value(k,j):null),valid=vs.filter(finite);
    const stat={availableHours:valid.length};
    if(['precipitation','rain','snowfall'].includes(k))stat.total=valid.length===24?round(valid.reduce((a,b)=>a+b,0)):null;
    else{stat.max=valid.length?round(Math.max(...valid)):null;if(!['wind_speed_10m','wind_gusts_10m'].includes(k))stat.min=valid.length?round(Math.min(...valid)):null;}
    statistics[k]=stat;
   }
   return {fromExclusive:new Date(end+day*24*3600000).toISOString(),toInclusive:new Date(end+(day+1)*24*3600000).toISOString(),expectedHours:24,availableHours:js.filter(j=>j>=0).length,statistics};
  });
  const outlook={expectedHours:72,availableHours:outlookWindows.reduce((n,w)=>n+w.availableHours,0),windows:outlookWindows};
  const stats={};
  for(const k of Object.keys(fields)){
   const vs=indices.map(j=>value(k,j)),valid=vs.filter(finite),complete=unique.size===72&&indices.length===72&&valid.length===72;
   stats[k]={availableHours:valid.length,min:valid.length?round(Math.min(...valid)):null,max:valid.length?round(Math.max(...valid)):null};
   if(['precipitation','rain','snowfall'].includes(k))stats[k].total=complete?round(valid.reduce((a,b)=>a+b,0)):null;
  }
  return {location:location(p),status:i>=0&&Object.values(current).some(finite)?'available':'partial',source:'Open-Meteo best_match / model data including archived forecasts',retrievedAt:now.toISOString(),units:fields,current:{validAt:new Date(end).toISOString(),values:current},forecastNext6Hours:forecast,forecastNext72Hours:outlook,past72Hours:{from:new Date(start).toISOString(),toExclusive:new Date(end).toISOString(),expectedHours:72,availableHours:unique.size,complete:unique.size===72&&indices.length===72,statistics:stats}};
 }
 function context(start,target,rows=[],date=new Date()){return {schema:VERSION,time:temporal(date),start:rows[0]||{location:location(start),status:'unavailable'},target:rows[1]||{location:location(target),status:'unavailable'}};}
 function prompt(c){return c?.schema===VERSION?'\n'+instructions+'\nENVIRONMENT_CONTEXT (Daten): '+JSON.stringify(c):'';}
 return {VERSION,fields,instructions,location,temporal,summarize,context,prompt};
});
