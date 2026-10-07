// Explicitly bounded live API validation. Never changes mission or simulator state.
import fs from 'node:fs';
import crypto from 'node:crypto';
import serviceApi from '../ga-tracker-client/tracker-voice-service.js';
import {weatherHarness,weatherRows,assessment,read,assertClean,plannerHarness,draft,voiceCore,voiceHarness,speaker,voicePrompt} from './gemini-migration-harness.mjs';
const stage=process.argv[2];
if(!['weather','planners','scene','voice','voice-tracker'].includes(stage))throw Error('Supported stage: weather, planners, scene, voice, voice-tracker');
const output=`analysis/gemini-parameter-migration/${stage}.json`;
if(fs.existsSync(output))throw Error('Report exists; refusing automatic repeated API usage.');
let key=process.env.GEMINI_API_KEY;
if(!key&&process.env.GA_GEMINI_KEY_FILE){
  const lines=fs.readFileSync(process.env.GA_GEMINI_KEY_FILE,'utf8').split(/\r?\n/).map(x=>x.trim()).filter(x=>x&&!x.startsWith('#'));
  const line=lines.find(x=>/^GEMINI_API_KEY\s*=/.test(x));
  key=line?line.slice(line.indexOf('=')+1).trim().replace(/^(['"])(.*)\1$/,'$2'):(lines.length===1&&!lines[0].includes('=')?lines[0]:'');
}
if(!key)throw Error('Missing local Gemini key; no API requests sent.');
const report={stage,createdAt:new Date().toISOString(),scope:'Real API through extracted production functions; synthetic fixtures/tool context, no browser, tracker or simulator test. Production prompts are unchanged; scene sanitizer is stubbed to inspect raw output.',requests:[]};
fs.mkdirSync('analysis/gemini-parameter-migration',{recursive:true});
const save=()=>fs.writeFileSync(output,JSON.stringify(report,null,2));
let blocked=false;
const realFetch=async(url,options)=>{
  if(blocked||report.requests.length>=({weather:2,planners:4,scene:3,voice:4,'voice-tracker':2}[stage]))throw Error('Live request budget stopped');
  const payload=JSON.parse(options.body);assertClean(payload.generationConfig);
  const entry={model:url.match(/models\/([^:]+)/)[1],config:payload.generationConfig,promptSha256:crypto.createHash('sha256').update(JSON.stringify(payload.contents)).digest('hex')};
  report.requests.push(entry);save();
  const start=Date.now();
  try{
    const response=await fetch(url,{...options,signal:AbortSignal.timeout(60000)});
    const body=await response.json();entry.ms=Date.now()-start;entry.status=response.status;
    entry.usage=body.usageMetadata||null;entry.finishReason=body.candidates?.[0]?.finishReason||null;
    if(!response.ok){entry.error=String(body.error?.message||'API error').replaceAll(key,'[redacted]').slice(0,1000);if([400,401,403,429].includes(response.status))blocked=true;}
    save();return {ok:response.ok,status:response.status,json:async()=>body,text:async()=>JSON.stringify(body).replaceAll(key,'[redacted]')};
  }catch(error){entry.error=String(error.message).replaceAll(key,'[redacted]');blocked=true;save();throw Error('Live network failure');}
};
save();
if(stage==='weather'){
  const h=weatherHarness(read('checklists.js'),realFetch,key);
  report.result=await h.fetchGeminiWeatherText(weatherRows,assessment);
  report.passed=!!report.result?.text;
}else if(stage==='voice-tracker'){
  const service=serviceApi.createTrackerVoiceService({provider:'gemini',apiKey:key,fetchRemote:realFetch});
  service.request({effectId:'migration:tracker-live',kind:'boarding',prompt:voicePrompt,speaker,synthesizeAudio:false});
  const ready=await service.wait('migration:tracker-live');
  report.result={status:ready.status,text:ready.text,textModel:ready.textModel};
  report.passed=ready.status==='ready'&&!!ready.text&&report.requests.some(r=>r.status===200);
}else if(stage==='voice'){
  const core=voiceCore(read('mission-boarding-voice-core.js'));
  const h=voiceHarness(read('passenger-voice.js'),core,realFetch,key);
  report.text=await h._generateSpokenText(key,voicePrompt,{paxMenuRequest:true});
  if(report.text&&!blocked){
    const audio=await h._requestTTSAudio(report.text,speaker,{paxMenuRequest:true});
    if(audio?.b64){
      report.audio={model:audio.model,mimeType:audio.mimeType,bytes:Buffer.from(audio.b64,'base64').length};
      fs.writeFileSync('analysis/gemini-parameter-migration/voice-audio.bin',Buffer.from(audio.b64,'base64'));
    }
  }
  report.passed=!!report.text&&report.audio?.bytes>0;
}else if(stage==='scene'){
  const h=plannerHarness(read('app.js'),realFetch);
  report.scene=await h.composeMissionScenePlanV3WithGemini({missionData:{missionType:'bush'},missionContract:{},passenger:{},apiKey:key});
  report.passed=report.scene?.targetScene?.kind==='none';
}else{
  const h=plannerHarness(read('app.js'),realFetch);
  report.mission=await h._missionPipelineV3RunModel('gemini-3-flash-preview','live','flash',draft,{apiKey:key});
  if(report.mission.parsed&&!blocked)report.scene=await h.composeMissionScenePlanV3WithGemini({missionData:{missionType:'bush'},missionContract:{},passenger:{},apiKey:key});
  report.passed=!!report.mission.parsed?.plan && report.scene?.targetScene?.kind==='none';
}
report.completedAt=new Date().toISOString();save();
console.log(JSON.stringify(report,null,2));
if(!report.passed)process.exitCode=1;
