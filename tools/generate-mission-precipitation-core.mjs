import fs from 'node:fs';
import { extractOriginalFunction } from './extract-original-function.mjs';
const source = fs.readFileSync(new URL('../passenger-voice.js', import.meta.url), 'utf8');
const output = `// Generated from passenger-voice.js by tools/generate-mission-precipitation-core.mjs. Do not edit.
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.GAMissionPrecipitationCore=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
${extractOriginalFunction(source, '_precipitationObservation')}
return Object.freeze({observe:_precipitationObservation});
});
`;
const target = new URL('../mission-precipitation-core.js', import.meta.url);
if (process.argv.includes('--check')) { if (fs.readFileSync(target, 'utf8') !== output) throw Error('Precipitation core drift'); }
else fs.writeFileSync(target, output);
