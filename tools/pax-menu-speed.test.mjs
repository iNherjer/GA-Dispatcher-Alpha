import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import core from '../mission-boarding-voice-core.js';
import serviceApi from '../ga-tracker-client/tracker-voice-service.js';
import poiVoice from '../ga-tracker-client/tracker-mission-poi-voice.js';
import clientApi from '../tracker-voice-client.js';
import boardingHandler from '../ga-tracker-client/tracker-mission-boarding-voice.js';
const source=fs.readFileSync(new URL('../passenger-voice.js',import.meta.url),'utf8');
function fn(name){const start=source.indexOf('async function '+name+'(')>=0?source.indexOf('async function '+name+'('):source.indexOf('function '+name+'(');assert.ok(start>=0);const code=source.slice(start,source.indexOf('\n}',start)+2);new vm.Script(code);return code;}
const speaker={name:'Mara',role:'Vereinskollegin',gender:'female',taskDomain:'club_utility'};
function appHarness(){const calls=[];const sandbox={window:{GAMissionBoardingVoiceCore:core,activePassenger:speaker},_lastSpokenSpeaker:null,_getAiProvider:()=> 'gemini',_getApiKey:()=> 'test-key',_getTrackerVoiceClient:()=>null,_paxAiTextModels:()=>core.GEMINI_TEXT_MODELS.map(m=>[m,m,'flash']),_paxLog:()=>{},_normSpeakerGender:()=> 'female',_ttsVoiceCandidatesForSpeaker:()=>['Kore'],_paxTtsModelPref:'auto',_paxTtsHedgeEnabled:()=>false,
fetch:async(url,options)=>{const payload=JSON.parse(options.body);calls.push({url,payload});return {ok:true,status:200,json:async()=>({candidates:[{content:{parts:payload.generationConfig.responseModalities?[{inlineData:{mimeType:'audio/wav',data:Buffer.from('RIFF-test').toString('base64')}}]:[{text:'Die Daten fehlen.'}]}}]})};}};vm.createContext(sandbox);vm.runInContext(fn('_generateSpokenText')+'\n'+fn('_requestTTSAudioForModel')+'\n'+fn('_requestTTSAudio'),sandbox);return {calls,sandbox};}

test('App menu uses 3.8 low and modern TTS metadata; automatic speech stays on old defaults',async()=>{
 const h=appHarness();
 await h.sandbox._generateSpokenText('test-key','Wetterfrage',{paxMenuRequest:true});
 await h.sandbox._requestTTSAudio('Die Daten fehlen.',speaker,{paxMenuRequest:true});
 assert.ok(h.calls[0].url.includes('gemini-3.8-flash:'));
 assert.equal(h.calls[0].payload.generationConfig.thinkingConfig.thinkingLevel,'low');
 assert.ok(h.calls[1].url.includes('gemini-3.8-flash-tts:'));
 assert.equal(h.calls[1].payload.contents[0].parts[0].text,'Die Daten fehlen.');
 assert.equal(h.calls[1].payload.contents[0].parts[0].speech_metadata.style,core.conversationalTtsStyle(speaker));
 await h.sandbox._generateSpokenText('test-key','Automatischer Kommentar');
 await h.sandbox._requestTTSAudio('Automatischer Kommentar.',speaker);
 assert.ok(h.calls[2].url.includes('gemini-3-flash-preview:'));
 assert.equal(h.calls[2].payload.generationConfig.thinkingConfig,undefined);
 assert.ok(h.calls[3].url.includes('gemini-3.1-flash-tts-preview:'));
 assert.equal(h.calls[3].payload.contents[0].parts[0].text,core.ttsInput('Automatischer Kommentar.',speaker));
});

test('only manual action recipes opt into menu policy, not automatic POI cues',()=>{
 const context={schema:'ga.mission-poi-voice-context.v1',version:1,strict:true,missionId:'test',taskDomain:'science_geo',baseContext:'Geologe.',toneHint:'Deutsch.',passenger:{},missionData:{poiName:'Hang'},speaker,audioEnabled:true,textModels:{gemini:core.GEMINI_TEXT_MODELS},ttsModels:core.GEMINI_TTS_MODELS};
 const manual=poiVoice.prepareAction(context,'poi_orientation',{}, {lat:48,lon:8,mslFt:3000},{lat:48.1,lon:8.1});
 assert.equal(manual.resolvedRecipe.paxMenuRequest,true);
 assert.ok(manual.resolvedRecipe.prompt.includes('ohne Live-Sichtbestaetigung weder Sichtung noch Nicht-Sichtung'));
 const auto=poiVoice.prepareCue(context,{prompt:'_poiEntryPrompt',args:[{mslFt:3000}],sample:{mslFt:3000},target:{lat:48.1,lon:8.1}},{});
 assert.equal(auto.cue.resolvedRecipe.paxMenuRequest,undefined);
});

test('Tracker generates menu text with low and keeps returned WAV bytes unchanged',async()=>{
 const calls=[],wav=serviceApi.pcmToWav(Buffer.from([0,0,0,0]));
 const service=serviceApi.createTrackerVoiceService({provider:'gemini',apiKey:'test-key',fetchRemote:async(url,options)=>{const payload=JSON.parse(options.body);calls.push({url,payload});return {ok:true,status:200,json:async()=>({candidates:[{content:{parts:payload.generationConfig.responseModalities?[{inlineData:{data:wav.toString('base64'),mimeType:'audio/wav'}}]:[{text:'Steuerkurs 090, zwölf Meilen.'}]}}]})};}});
 service.request({effectId:'test:menu',prompt:'Orientierung',speaker,paxMenuRequest:true});
 const ready=await service.wait('test:menu');
 assert.equal(ready.textModel,'gemini-3.8-flash');assert.equal(ready.model,'gemini-3.8-flash-tts');
 assert.equal(calls[0].payload.generationConfig.thinkingConfig.thinkingLevel,'low');
 assert.equal(calls[1].payload.contents[0].parts[0].text,ready.text);
 assert.equal(calls[1].payload.contents[0].parts[0].speech_metadata.style,core.conversationalTtsStyle(speaker));
 assert.deepEqual(service.getAudio('test:menu').body,wav);
 const old=serviceApi.normalizeVoiceRequest({effectId:'test:auto',prompt:'Automatisch'});
 assert.equal(old.paxMenuRequest,false);assert.equal(old.textModels.gemini[0],'gemini-3-flash-preview');assert.equal(old.ttsModels[0],'gemini-3.1-flash-tts-preview');
 assert.equal(serviceApi.normalizeVoiceRequest({effectId:'test:menu2',text:'Test',paxMenuRequest:true}).ttsHedgeEnabled,false);
});

test('3.8 provider failures fall back to old models and old TTS prompt format',async()=>{
 const calls=[];
 const service=serviceApi.createTrackerVoiceService({provider:'gemini',apiKey:'test-key',fetchRemote:async(url,options)=>{const payload=JSON.parse(options.body);calls.push({url,payload});if(url.includes('gemini-3.8'))return {ok:false,status:404};return {ok:true,status:200,json:async()=>({candidates:[{content:{parts:payload.generationConfig.responseModalities?[{inlineData:{mimeType:'audio/l16;rate=24000',data:'AAAAAA=='}}]:[{text:'Wetterdaten fehlen.'}]}}]})};}});
 service.request({effectId:'test:fallback',prompt:'Wetter',speaker,paxMenuRequest:true});
 const ready=await service.wait('test:fallback');assert.equal(ready.textModel,'gemini-3-flash-preview');assert.equal(ready.model,'gemini-3.1-flash-tts-preview');
 const textFallback=calls.find(c=>c.url.includes('gemini-3-flash-preview'));
 assert.equal(textFallback.payload.generationConfig.thinkingConfig,undefined);
 const ttsFallback=calls.find(c=>c.url.includes('gemini-3.1-flash-tts-preview'));
 assert.equal(ttsFallback.payload.contents[0].parts[0].text,core.ttsInput(ready.text,speaker));assert.equal(ttsFallback.payload.contents[0].parts[0].speech_metadata,undefined);
});

test('App forwards menu policy through shared tracker audio client',async()=>{
 const h=appHarness();let captured;
 h.sandbox._getTrackerVoiceClient=()=>({requestAudio:async value=>{captured=value;return {b64:'AAAA',model:'gemini-3.8-flash-tts'};}});
 h.sandbox._paxTrackerVoiceEffectId=()=> 'test:shared';
 await h.sandbox._requestTTSAudio('Wetterdaten fehlen.',speaker,{paxMenuRequest:true});
 assert.equal(captured.paxMenuRequest,true);assert.equal(h.calls.length,0);
 let body;
 const client=clientApi.createTrackerVoiceClient({fetchRemote:async(_url,options)=>{body=JSON.parse(options.body);return {ok:false,status:503,json:async()=>({})};}});
 await client.requestAudio(captured);assert.equal(body.paxMenuRequest,true);
});

test('authoritative POI dispatch passes the manual policy into its central voice job',async()=>{
 const effect={effectId:'test:poi-menu',type:'voice.poi',payload:{action:'poi_orientation',resolvedRecipe:{schema:'ga.mission-poi-voice-recipe.v1',missionId:'test',kind:'poi',enabled:true,audioEnabled:true,prompt:'Orientierung',speaker,paxMenuRequest:true}}};
 const snapshot={missionId:'test',runId:'run',state:{flags:{active:true},effects:[effect]}};
 let job;
 const handler=boardingHandler.createTrackerMissionBoardingVoice({authorityManager:{getActiveRun:()=>({missionId:'test',runId:'run',executionAuthority:'tracker',executionRecipe:'poi'}),getExecutionSnapshot:()=>snapshot,supportsExecutionRecipe:()=>true},voiceService:{publicState:()=>({configured:true}),request:value=>{job=value;},wait:async()=>({effectId:effect.effectId,status:'ready',audioAvailable:true,text:'Orientierung',speaker}),cancel:()=>{}},getAudioPlaybackCandidates:()=>0});
 const result=await handler.dispatch({missionId:'test',runId:'run',effect});
 assert.equal(result.ok,true);assert.equal(job.paxMenuRequest,true);assert.equal(job.kind,'poi');
 assert.equal(typeof job.confirmTextReady,'function');
});

test('App menu tags reach generation and audio, while direct automatic replies stay untagged',async()=>{
 const calls=[];const s={_paxMissionEpoch:1,_paxVoiceEnabled:true,_paxSpeechQueue:Promise.resolve(),_normalizeSpokenText:x=>x,_speakerSnapshotForActivePax:()=>speaker,_capturePoiNarrativeMemory:()=>{},_showPaxMessage:()=>{},_refreshMissionActionMenu:()=>{},_getApiKey:()=> 'test-key',_speakAndShow:(...args)=>calls.push(args),_playTextAsTTS:async(...args)=>calls.push(args),_paxLog:()=>{}};
 vm.createContext(s);vm.runInContext(fn('_missionActionSpeak')+'\n'+fn('_paxSpeakTextDirect'),s);
 s._missionActionSpeak('Prompt','Wetter','Fallback');assert.equal(calls[0][3].paxMenuRequest,true);
 s._paxSpeakTextDirect('Automatisch','Mission');await s._paxSpeechQueue;assert.equal(calls[1][3].paxMenuRequest,undefined);
 s._getApiKey=()=>null;s._missionActionSpeak('Prompt','Wetter','Fallback');await s._paxSpeechQueue;assert.equal(calls[2][3].paxMenuRequest,true);
});

test('authoritative flight queries use menu policy while automatic comfort speech stays unchanged',async()=>{
 for (const kind of ['pax_query','comfort']) {
  let job;
  const effect={effectId:`test:${kind}`,type:'voice.flight',payload:{kind,prompt:'Wetterfrage',fallbackText:'Wind 24 kt.'}};
  const active={missionId:'test',runId:'run',executionAuthority:'tracker',resumeBundle:{executionEffectPlan:{effects:{'voice.boarding':{recipe:core.createRecipe({missionId:'test',hasPassenger:true,prompt:'Boarding',speaker})},'voice.approach':{context:{supported:true,speaker}}}}}};
  const snapshot={missionId:'test',runId:'run',state:{flags:{active:true},effects:[effect]}};
  const handler=boardingHandler.createTrackerMissionBoardingVoice({authorityManager:{getActiveRun:()=>active,getExecutionSnapshot:()=>snapshot,supportsExecutionRecipe:()=>true},voiceService:{publicState:()=>({configured:true}),request:value=>{job=value;},wait:async()=>({effectId:effect.effectId,status:'ready',audioAvailable:true,text:'Wind 24 kt.',speaker}),cancel:()=>{}},getAudioPlaybackCandidates:()=>0});
  assert.equal((await handler.dispatch({missionId:'test',runId:'run',effect})).ok,true);
  assert.equal(job.paxMenuRequest,kind==='pax_query'?true:undefined);
 }
});
