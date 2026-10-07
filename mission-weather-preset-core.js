(function(root,factory){const precipitationCore=typeof module==='object'&&module.exports?require('./mission-precipitation-core.js'):root.GAMissionPrecipitationCore;const api=factory(precipitationCore);if(typeof module==='object'&&module.exports)module.exports=api;else root.GAWeatherPresetCore=api;})(typeof globalThis!=='undefined'?globalThis:this,function(precipitationCore){
 'use strict';
 const COOLDOWN_MS=120000;
 const finite=v=>typeof v==='number'&&Number.isFinite(v);
 function normalize(p){return p&&Number.isSafeInteger(p.index)&&p.index>=0&&p.index<=1000000?{index:p.index,name:String(p.name||'').slice(0,120)}:null;}
 function snapshot(fd,at){const out={at};for(const key of ['lat','lon','mslFt','altFt','tempC','windKts','windDeg','visKm','precipState'])out[key]=finite(fd[key])?fd[key]:null;return out;}
 function differences(before,after){
  if(!before||!after)return [];
  const fields=[['tempC',8,'Temperatur','Grad'],['windKts',12,'Wind','Knoten'],['visKm',5,'Sichtweite','km']];
  const changes=fields.filter(([key,threshold])=>finite(before[key])&&finite(after[key])&&Math.abs(before[key]-after[key])>=threshold)
   .map(([key,,label,unit])=>`${label}: vorher ${Math.round(before[key]*10)/10}, jetzt ${Math.round(after[key]*10)/10} ${unit}`);
  // The SDK specifies a precipitation bitmask, but no hourly timebase for RATE.
  const from=precipitationCore.observe(before).precipLabel,to=precipitationCore.observe(after).precipLabel;
  if(from&&to&&from!==to)changes.push(`Niederschlag: vorher ${from}, jetzt ${to}`);
  return changes.slice(0,2);
 }
 function observeWeather(previous,fd={},facts={}){
  const now=finite(facts.now)?facts.now:Date.now(),state={...previous, pending:previous?.pending?{...previous.pending}:undefined};
  const reported=normalize(fd.weatherPreset),at=fd.weatherPreset?.receivedAt;
  const confirmed=!!reported&&finite(at)&&now-at<=15000&&at<=now+1000;
  const preset=confirmed?reported:{index:-1};
  const eligible=facts.active===true&&facts.onboard===true&&facts.ending!==true;
  if(!eligible||fd.simRunning===0||fd.slewActive===true||fd.slewMode===true||fd.isSlewActive===true){
   return {state:{lastReactionAt:state.lastReactionAt||0},reaction:null};
  }
  if(fd.simPaused===true||fd.paused===true||fd.isPaused===true||fd.inMenuOrMap===true){
   return {state:finite(state.lastAt)&&now>=state.lastAt&&now-state.lastAt<=120000?{...state,interrupted:true}:{lastReactionAt:state.lastReactionAt||0},reaction:null};
  }
  const current=snapshot(fd,now),source=confirmed?'preset': 'telemetry';
  const resumed=state.interrupted===true&&finite(state.lastAt)&&now>state.lastAt&&now-state.lastAt<=120000;
  const beforeMenu=resumed?(state.history||[]).slice(-1)[0]:null;
  const gap=!finite(state.lastAt)||now<=state.lastAt||now-state.lastAt>10000;
  if((!resumed&&(gap||state.source!==source))||state.index==null){return {state:{index:preset.index,source,lastAt:now,history:[current],lastReactionAt:state.lastReactionAt||0},reaction:null};}
  const history=(state.history||[]).filter(row=>now-row.at<=15000).concat(current).slice(-32);
  const baseline=beforeMenu||history.find(row=>now-row.at>=7000)||history[0];
  const telemetryChange=differences(baseline,current).length>0;
  if(resumed){delete state.pending;delete state.interrupted;}
  if((state.source===source&&state.index!==preset.index) || (!state.pending && telemetryChange)){
   state.pending={before:baseline,startedAt:now,changedAt:0,signatures:0,index:preset.index,presetChanged:confirmed&&state.source==='preset'&&state.index!==preset.index};
  }
  state.index=preset.index;
  state.source=source;state.lastAt=now;state.history=history;
  const pending=state.pending;
  if(!pending)return {state,reaction:null};
  if(now-pending.startedAt>40000){delete state.pending;return {state,reaction:null};}
  const before=pending.before;
  if(finite(before.lat)&&finite(before.lon)&&finite(current.lat)&&finite(current.lon)){
   const distance=Math.hypot((before.lat-current.lat)*60,(before.lon-current.lon)*60*Math.cos(current.lat*Math.PI/180));
   const bAlt=before.mslFt??before.altFt,aAlt=current.mslFt??current.altFt;
   if(distance>2||(finite(bAlt)&&finite(aAlt)&&Math.abs(bAlt-aAlt)>1000)){delete state.pending;return {state,reaction:null};}
  }else{delete state.pending;return {state,reaction:null};}
  const changes=differences(before,current);
  if(!changes.length){pending.changedAt=0;pending.signatures=0;return {state,reaction:null};}
  if(!pending.changedAt)pending.changedAt=now;
  pending.signatures++;
  if(now-pending.changedAt<2000||pending.signatures<3||facts.busy===true)return {state,reaction:null};
  delete state.pending;
  if(state.lastReactionAt&&now-state.lastReactionAt<COOLDOWN_MS)return {state,reaction:null};
  state.lastReactionAt=now;
  return {state,reaction:{index:preset.index,changes,text:'Hoppla, das Wetter hat sich gerade deutlich verändert.',prompt:`WETTERWECHSEL: ${confirmed&&pending.presetChanged?'Der Simulator meldete einen anderen Wetter-Preset.':'Die Ursache der Änderung ist unbekannt. Beschreibe ausschließlich die beobachtete Wetteränderung aus Sicht des Passagiers, etwa stärkeren Wind oder nachlassende Sicht. Auch wenn der übrige Missionskontext Simulator-Humor enthält: kein Hinweis auf Simulator, Presets, Wetterregler, Spieler oder künstliche Eingriffe.'} Die Telemetrie bestätigt diese Änderung: ${changes.join('; ')}. Reagiere als die bekannte Person spontan, kurz überrascht und gern mit einem Augenzwinkern. Höchstens zwei Sätze. Keine ungemessenen Wolken, Sonne, Schnee oder Flugzeuggefahren erfinden. Keine Anweisung, den Simulator zu bedienen.`}};
 }
 function observeTime(previous={},fd={},facts={}){
  const now=finite(facts.now)?facts.now:Date.now();
  const state={...previous,pending:previous.pending?{...previous.pending}:undefined};
  const seconds=fd.simAbsoluteTimeSeconds,rate=finite(fd.simulationRate)&&fd.simulationRate>0&&fd.simulationRate<=128?fd.simulationRate:1;
  const current={at:now,seconds,rate,local:finite(fd.simLocalTimeSeconds)&&fd.simLocalTimeSeconds>=0&&fd.simLocalTimeSeconds<86400?fd.simLocalTimeSeconds:null};
  if(facts.active!==true||facts.onboard!==true||facts.ending===true||fd.simRunning===0||fd.slewActive===true||fd.slewMode===true||fd.isSlewActive===true||!finite(seconds)||seconds<=0)return {state:{},reaction:null};
  // A short weather/time menu visit may be precisely where the clock changed.
  // Keep its pre-menu baseline; do not speak while the sim is paused or in a menu.
  if(fd.simPaused===true||fd.paused===true||fd.isPaused===true||fd.inMenuOrMap===true){
   return {state:state.last&&now-state.last.at<=120000?{...state,interrupted:true}:{},reaction:null};
  }
  const last=state.last,elapsed=last?(now-last.at)/1000:0;
  if(!last||elapsed<=0||elapsed>(state.interrupted?120:10))return {state:{last:current},reaction:null};
  const jump=seconds-last.seconds-elapsed*Math.max(rate,last.rate);
  if(!state.pending&&Math.abs(jump)>3600){state.pending={before:last,startedAt:now,shift:jump,samples:0};}
  state.last=current;delete state.interrupted;
  const pending=state.pending;
  if(!pending)return {state,reaction:null};
  const shift=seconds-pending.before.seconds-(now-pending.before.at)/1000*Math.max(rate,pending.before.rate);
  if(now-pending.startedAt>40000||Math.abs(shift)<=3600||Math.abs(shift-pending.shift)>120){delete state.pending;return {state,reaction:null};}
  pending.samples++;
  if(now-pending.startedAt<2000||pending.samples<3||facts.busy===true)return {state,reaction:null};
  delete state.pending;
  if(facts.cooldownBlocked===true)return {state,reaction:null};
  const clock=value=>value==null?'unbekannt':`${String(Math.floor(value/3600)).padStart(2,'0')}:${String(Math.floor(value%3600/60)).padStart(2,'0')}`;
  const direction=shift>0?'vorwärts':'rückwärts',minutes=Math.round(Math.abs(shift)/60);
  return {state,reaction:{kind:'time_shift',label:'Zeitsprung',text:'Moment, die Uhr hat gerade einen ordentlichen Sprung gemacht.',prompt:`ZEITSPRUNG: Die gemessene Simulatorzeit ist abrupt um etwa ${minutes} Minuten ${direction} gesprungen, nach Abzug des normalen Zeitablaufs. Lokale Sim-Uhrzeit vorher ${clock(pending.before.local)}, jetzt ${clock(current.local)}. Reagiere als die bekannte Person kurz überrascht und gern humorvoll, höchstens zwei Sätze. Eine scherzhafte Zeitreise- oder Uhr-Anspielung ist erlaubt. Keine konkrete Ursache als Tatsache behaupten. Erfinde keine Sonne, Dunkelheit, Sonnenuntergänge, Wetteränderungen oder Terminprobleme; die Uhrzeit allein belegt das nicht. Keine Bedienanweisung und keine Missionsaufgabe ändern.`}};
 }
 function observe(previous={},fd={},facts={}){
  const now=finite(facts.now)?facts.now:Date.now();
  const time=observeTime(previous.time,fd,{...facts,now,cooldownBlocked:!!previous.lastReactionAt&&now-previous.lastReactionAt<COOLDOWN_MS});
  const weather=observeWeather(time.reaction?{...previous,lastReactionAt:now}:previous,fd,{...facts,now,busy:facts.busy===true||!!time.reaction});
  weather.state.time=time.state;
  if(time.reaction){weather.state.lastReactionAt=now;weather.reaction=time.reaction;}
  if(weather.reaction&&!weather.reaction.kind){weather.reaction.kind='weather_preset';weather.reaction.label='Wetterwechsel';}
  return weather;
 }
 return {COOLDOWN_MS,normalize,differences,observeTime,observe};
});
