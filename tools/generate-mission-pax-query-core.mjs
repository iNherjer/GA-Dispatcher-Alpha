import fs from 'node:fs';
import {extractOriginalFunction} from './extract-original-function.mjs';
const source=fs.readFileSync(new URL('../passenger-voice.js',import.meta.url),'utf8');
const names=['paxAptWellbeingReport','paxCargoConditionReport','paxWeatherReactionReport'];
const functions=names.map(name=>extractOriginalFunction(source.replace(`window.${name} = function(`,`function ${name}(`),name).replace(/    if \(window\.gaTrackerExecutionHandlesMission\?\.\(\)\).*\n/g,'')).join('\n');
const output=`// Generated from original passenger-voice.js manual queries; do not edit.
'use strict';
const comfortCore=require('./mission-comfort-core.js');
const weatherCore=require('./mission-farewell-voice-core.js');
${extractOriginalFunction(source,'_missionWeatherReactionLine')}
function available(context={},fd={}) {
 const focus=comfortCore.evaluate(null,null,context).cargoFocus;
 return [...(!context.isPoi && context.hasPassenger && !focus ? ['pax_wellbeing']:[]),
 ...(!context.isPoi && focus ? ['pax_cargo']:[]),
 ...(_missionWeatherReactionLine(fd) && (context.hasPassenger||focus) ? ['pax_weather']:[])];
}
function render(action,context={},facts={}) {
 if(!available(context,facts.flightData||{}).includes(action)) return null;
 const _missionActionContext=()=>({fd:facts.flightData||{}});
 const _missionComfortSummary=()=>comfortCore.evaluate(facts.comfortState,null,context).summary;
 const _baseContext=()=>context.baseContext||'';
 const _toneHint=()=>context.toneHint||'';
 const _weatherContext=weatherCore.weatherContext;
 const _activeCargoText=()=>context.cargoText||'';
 const _isPOIMission=()=>context.isPoi===true;
 const _aptMissingRequiredCargoItems=()=>facts.missingRequired||[];
 const _activeMissionData=()=>context.missionData||{};
 let result=null;
 const _missionActionSpeak=(prompt,label,fallbackText)=>{result={kind:'pax_query',action,prompt,label,fallbackText,delayMs:0};};
 ${functions}
 ({pax_wellbeing:paxAptWellbeingReport,pax_cargo:paxCargoConditionReport,pax_weather:paxWeatherReactionReport})[action]();
 return result;
}
module.exports={available,render};
`;
const target=new URL('../mission-pax-query-core.js',import.meta.url);
if(process.argv.includes('--check')) {if(fs.readFileSync(target,'utf8')!==output)throw Error('PAX query core drift');}
else fs.writeFileSync(target,output);
