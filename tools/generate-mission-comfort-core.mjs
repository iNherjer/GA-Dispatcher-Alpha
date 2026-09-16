import fs from 'node:fs';
import {extractOriginalFunction} from './extract-original-function.mjs';
const source=fs.readFileSync(new URL('../passenger-voice.js',import.meta.url),'utf8');
const names=['_createMissionComfortScore','_missionComfortScoreState','_cargoMissionFocus','_missionScoreRegisterEvent','_recordMissionComfortSample','_missionComfortSummary'];
const functions=names.map(name=>extractOriginalFunction(source,name)).join('\n');
const output=`// Generated from passenger-voice.js by tools/generate-mission-comfort-core.mjs.
// Original scoring and event-edge rules; no independent Tracker approximation.
'use strict';
function evaluate(previous, sample, context = {}, now = 0) {
 const Date = {now: () => now};
 let _missionComfortScore = previous ? JSON.parse(JSON.stringify(previous)) : null;
 const _activeMissionData = () => context.missionData || {};
 const _activeTaskDomain = () => context.taskDomain || '';
 const _activeCargoText = () => String(context.cargoText || '');
 const _activePaxText = () => String(context.paxText || '');
 const _paxDebugMotionProtectionEnabled = () => context.motionProtectionEnabled === true;
 ${functions}
 if (sample) _recordMissionComfortSample(sample);
 return {state: _missionComfortScoreState(), summary: _missionComfortSummary(), cargoFocus: _cargoMissionFocus()};
}
module.exports = {evaluate};
`;
const target=new URL('../mission-comfort-core.js',import.meta.url);
if(process.argv.includes('--check')) {if(fs.readFileSync(target,'utf8')!==output) throw Error('Comfort core drift');}
else fs.writeFileSync(target,output);
