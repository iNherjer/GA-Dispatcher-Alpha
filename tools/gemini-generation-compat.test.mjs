import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import serviceApi from '../ga-tracker-client/tracker-voice-service.js';
import {weatherHarness,weatherRows,assessment,read,plain,assertClean,plannerHarness,draft,voiceCore,voiceHarness,speaker,voicePrompt} from './gemini-migration-harness.mjs';
// Pin the pre-migration baseline so tests remain meaningful after committing.
const baseline='23aa0d4f6e766544b1a57c96fa7401115b6a6187';
const before = file => execFileSync('git',['show',`${baseline}:${file}`],{encoding:'utf8',maxBuffer:16*1024*1024});
const success = {ok:true,status:200,json:async()=>({candidates:[{content:{parts:[{text:'Am Start VFR. Am Ziel fehlen Wetterdaten.'}]}}]})};
test('generated EFB weather asset differs only by removed sampling field',()=>{
  const original=before('ga-tracker-client/efb-web-assets/checklists.js');
  const expected=original.replace(/^[ \t]*temperature: 0\.25,\r?\n/m,'');
  assert.notEqual(expected,original);
  assert.equal(read('ga-tracker-client/efb-web-assets/checklists.js'),expected);
});
for(const menu of [false,true])test(`tracker shared voice config matches prior config minus sampling, menu=${menu}`,async()=>{
  const prior=voiceCore(before('mission-boarding-voice-core.js')),calls=[];
  const service=serviceApi.createTrackerVoiceService({provider:'gemini',apiKey:'test-key',fetchRemote:async(url,options)=>{
    const body=JSON.parse(options.body);calls.push({url,body});return success;
  }});
  service.request({effectId:`compat:${menu}`,kind:'boarding',prompt:voicePrompt,speaker,paxMenuRequest:menu,synthesizeAudio:false});
  const ready=await service.wait(`compat:${menu}`);
  assert.equal(ready.status,'ready');assert.equal(calls.length,1);
  const model=calls[0].url.match(/models\/([^:]+)/)[1];
  const expected=plain(prior.geminiTextGenerationConfig(model,menu));delete expected.temperature;delete expected.topP;
  assert.deepEqual(calls[0].body.generationConfig,expected);
  assert.deepEqual(calls[0].body.contents,[{parts:[{text:voicePrompt}]}]);assertClean(calls[0].body.generationConfig);
});
test('weather requests differ only by removed sampling on both fallback models',async()=>{
  const captures=[];
  for (const source of [before('checklists.js'),read('checklists.js')]) {
    const calls=[];
    const h=weatherHarness(source,async(url,options)=>{
      calls.push({url,body:JSON.parse(options.body)});
      return calls.length===1?{ok:false,status:503}:success;
    });
    const result=await h.fetchGeminiWeatherText(weatherRows,assessment);
    assert.equal(result.text,'Am Start VFR. Am Ziel fehlen Wetterdaten.');
    assert.equal(calls.length,2);
    captures.push(calls);
  }
  for(const call of captures[0]) delete call.body.generationConfig.temperature;
  assert.deepEqual(captures[1],captures[0]);
  for(const call of captures[1])assertClean(call.body.generationConfig);
});
for(const menu of [false,true])for(const missingCore of [false,true])test(`browser voice menu=${menu} missingCore=${missingCore}: primary and fallback payload equivalence`,async()=>{
  const captures=[];
  for(const old of [true,false]) {
    const calls=[],core=voiceCore(old?before('mission-boarding-voice-core.js'):read('mission-boarding-voice-core.js'));
    const h=voiceHarness(old?before('passenger-voice.js'):read('passenger-voice.js'),core,async(url,options)=>{
      calls.push({url,body:JSON.parse(options.body)});
      return url.includes('gemini-2.5-flash-lite:')?success:{ok:false,status:404};
    },'test-key',{missingCore});
    assert.equal(await h._generateSpokenText('test-key',voicePrompt,{paxMenuRequest:menu}),'Am Start VFR. Am Ziel fehlen Wetterdaten.');
    assert.equal(calls.length,menu?4:3);captures.push(calls);
  }
  for(const call of captures[0]){delete call.body.generationConfig.temperature;delete call.body.generationConfig.topP;}
  assert.deepEqual(captures[1],captures[0]);
  for(const call of captures[1])assertClean(call.body.generationConfig);
});
test('OpenAI voice text requests remain identical',async()=>{
  const captures=[];
  for(const old of [true,false]){
    const calls=[],core=voiceCore(old?before('mission-boarding-voice-core.js'):read('mission-boarding-voice-core.js'));
    const h=voiceHarness(old?before('passenger-voice.js'):read('passenger-voice.js'),core,async(url,options)=>{
      calls.push({url,body:JSON.parse(options.body)});return {ok:true,json:async()=>({choices:[{message:{content:'Das Zielwetter ist unbekannt.'}}]})};
    },'test-key',{provider:'openai'});
    assert.equal(await h._generateSpokenText('test-key',voicePrompt),'Das Zielwetter ist unbekannt.');captures.push(calls);
  }
  assert.deepEqual(captures[1],captures[0]);
});
for(const model of ['gemini-3.8-flash-tts','gemini-3.1-flash-tts-preview','gemini-2.5-flash-preview-tts'])test(`TTS ${model} retains exact payload and bytes`,async()=>{
  const captures=[];
  for(const old of [true,false]){
    const calls=[],core=voiceCore(old?before('mission-boarding-voice-core.js'):read('mission-boarding-voice-core.js'));
    const h=voiceHarness(old?before('passenger-voice.js'):read('passenger-voice.js'),core,async(url,options)=>{
      calls.push({url,body:JSON.parse(options.body)});
      return {ok:true,json:async()=>({candidates:[{content:{parts:[{inlineData:{mimeType:'audio/wav',data:'UklGRg=='}}]}}]})};
    });
    const result=await h._requestTTSAudioForModel('test-key',model,'Das Zielwetter ist unbekannt.',speaker,['Kore']);
    assert.equal(result.b64,'UklGRg==');captures.push(calls);
  }
  assert.deepEqual(captures[1],captures[0]);
});
for(const variant of ['mission','scene','reporter'])test(`${variant}: requests and tool round trips differ only by sampling removal`,async()=>{
  const captures=[];
  for(const source of [before('app.js'),read('app.js')]) {
    const calls=[],tool=variant==='mission'?'get_mission_context_bundle':'get_scene_context_bundle';
    const h=plannerHarness(source,async(url,options)=>{
      calls.push({url,body:JSON.parse(options.body)});
      const data=calls.length===1?{candidates:[{content:{role:'model',parts:[{functionCall:{name:tool,id:'call-1',args:{reason:'context'}},thoughtSignature:'opaque-signature'}]}}]}:
        {candidates:[{content:{parts:[{text:JSON.stringify({status:'ready',plan:draft,targetScene:{kind:'none'}})}]}}]};
      return {ok:true,status:200,json:async()=>data};
    },{reporter:variant==='reporter'});
    const result=variant==='mission'?await h._missionPipelineV3RunModel('gemini-3-flash-preview','test','flash',draft,{}):
      await h.composeMissionScenePlanV3WithGemini({missionData:{missionType:'bush'},missionContract:{},passenger:{},apiKey:'test-key'});
    assert.ok(result.parsed||result.targetScene);
    assert.equal(calls.length,2);
    assert.equal(calls[1].body.contents[1].parts[0].thoughtSignature,'opaque-signature');
    assert.equal(calls[1].body.contents[2].parts[0].functionResponse.id,'call-1');
    captures.push(calls);
  }
  for(const call of captures[0])delete call.body.generationConfig.temperature;
  assert.deepEqual(captures[1],captures[0]);
  for(const call of captures[1])assertClean(call.body.generationConfig);
});
test('weather signal and empty/error fallback behavior remain unchanged',async()=>{
  const results=[];
  for(const source of [before('checklists.js'),read('checklists.js')]) {
    const controller=new AbortController(),calls=[];
    const h=weatherHarness(source,async(url,options)=>{
      assert.equal(options.signal,controller.signal);calls.push(url);
      return {ok:true,status:200,json:async()=>({candidates:[]})};
    });
    results.push({result:plain(await h.fetchGeminiWeatherText(weatherRows,assessment,controller.signal)),calls});
    assert.equal(await h.fetchGeminiWeatherText([],assessment),null);
  }
  assert.deepEqual(results[1],results[0]);
});
