 'use strict';
const {normalize}=require('../mission-weather-preset-core.js');
function createEnvironmentDiagnostics(log=()=>{}) {
 let presetKey,clock;
 return {observe(fd={},facts={}) {
  const now=fd.observedAt;if(!Number.isFinite(now))return;
  const p=normalize(fd.weatherPreset),at=fd.weatherPreset?.receivedAt;
  const fresh=p&&Number.isFinite(at)&&now-at>=-1000&&now-at<=15000;
  const next=fresh?JSON.stringify(p):'unavailable';
  const voice=facts.hasMission?'mission_voice_gates_apply':'no_active_mission';
  if(next!==presetKey){log('SIM_ENV_PRESET data='+JSON.stringify({status:presetKey===undefined?'initial':next==='unavailable'?'unavailable':presetKey==='unavailable'?'available':'changed',before:presetKey&&presetKey!=='unavailable'?JSON.parse(presetKey):null,after:fresh?p:null,voice}));presetKey=next;}
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
module.exports={createEnvironmentDiagnostics};
