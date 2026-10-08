 'use strict';
const {normalize,differences}=require('../mission-weather-preset-core.js');
const weatherFields=['lat','lon','mslFt','tempC','windKts','visKm','precipState'];
const weatherSnapshot=fd=>Object.fromEntries(weatherFields.map(k=>[k,Number.isFinite(fd[k])?fd[k]:null]));
function describeWeather(before,after){
 const a=weatherSnapshot(before||{}),b=weatherSnapshot(after||{});
 const changes=differences(a,b);
 const measured=['tempC','windKts','visKm','precipState'].some(k=>a[k]!==null&&b[k]!==null);
 return {before:a,after:b,changes,thresholds:{tempC:8,windKts:12,visKm:5,precipState:'type_change'},
   measurement:changes.length?'threshold_met':measured?'below_threshold':'weather_data_missing'};
}
function createEnvironmentDiagnostics(log=()=>{}) {
 let presetKey,clock,lastPreset,lastWeather,weatherWindow;
 return {observe(fd={},facts={}) {
  const now=fd.observedAt;if(!Number.isFinite(now))return;
  const p=normalize(fd.weatherPreset),at=fd.weatherPreset?.receivedAt;
  const fresh=p&&Number.isFinite(at)&&now-at>=-1000&&now-at<=15000;
  const next=fresh?JSON.stringify(p):'unavailable';
  const voice=facts.hasMission?'mission_voice_gates_apply':'no_active_mission';
  if(next!==presetKey){log('SIM_ENV_PRESET data='+JSON.stringify({status:presetKey===undefined?'initial':next==='unavailable'?'unavailable':presetKey==='unavailable'?'available':'changed',before:presetKey&&presetKey!=='unavailable'?JSON.parse(presetKey):null,after:fresh?p:null,voice}));presetKey=next;}
  // Preserve the last valid preset across the short unavailable interval
  // during menu changes. Diagnostic windows never request a voice effect.
  if(fresh){
   if(lastPreset&&lastPreset.index!==p.index){
    weatherWindow={at:now,before:lastWeather,from:lastPreset,to:p,stage:-1};
   }
   lastPreset=p;lastWeather=weatherSnapshot(fd);
  }
  if(weatherWindow){
   const elapsedMs=now-weatherWindow.at;
   const stage=elapsedMs>=40000?3:elapsedMs>=10000?2:elapsedMs>=3000?1:0;
   if(stage!==weatherWindow.stage){
    weatherWindow.stage=stage;
    log('SIM_ENV_WEATHER data='+JSON.stringify({status:stage===3?'window_complete':'observing',
      elapsedMs,from:weatherWindow.from,to:weatherWindow.to,...describeWeather(weatherWindow.before,fd),
      paused:!!fd.simPaused,menu:!!fd.inMenuOrMap,voice}));
   }
   if(stage===3)weatherWindow=null;
  }
  const seconds=fd.simAbsoluteTimeSeconds,local=fd.simLocalTimeSeconds;
  if(!Number.isFinite(seconds)||seconds<=0){if(clock){log('SIM_ENV_TIME data='+JSON.stringify({status:'unavailable'}));clock=null;}return;}
  const rate=Number.isFinite(fd.simulationRate)&&fd.simulationRate>0&&fd.simulationRate<=128?fd.simulationRate:1;
  const current={at:now,seconds,local:Number.isFinite(local)&&local>=0&&local<86400?local:null,rate};
  if(!clock){log('SIM_ENV_TIME data='+JSON.stringify({status:'initial',absoluteSeconds:seconds,localSeconds:current.local}));clock=current;return;}
  if(fd.simPaused||fd.inMenuOrMap){if(now-clock.at>120000)clock=null;return;}
  const elapsed=(now-clock.at)/1000;
  if(elapsed>0&&elapsed<=120){const shift=seconds-clock.seconds-elapsed*Math.max(rate,clock.rate);if(Math.abs(shift)>3600)log('SIM_ENV_TIME data='+JSON.stringify({status:'jump',beforeLocalSeconds:clock.local,afterLocalSeconds:current.local,beforeAbsoluteSeconds:clock.seconds,afterAbsoluteSeconds:seconds,shiftSeconds:Math.round(shift),voice}));}
  clock=current;
 }};
}
module.exports={createEnvironmentDiagnostics,describeWeather};
