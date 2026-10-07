'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const boardingVoiceCore = require('../mission-boarding-voice-core.js');
const bushPickupVoiceCore = require('../mission-bush-pickup-voice-core.js');
const { createTrackerMissionBoardingVoice } = require('./tracker-mission-boarding-voice.js');

function run(recipe = {}) {
  return {
    missionId: 'mission-a',
    runId: 'run-a',
    executionAuthority: 'tracker',
    resumeBundle: {
      executionEffectPlan: {
        schema: 'ga.mission-apt-effect-plan.v1',
        effects: {
          'voice.boarding': {
            recipe: boardingVoiceCore.createRecipe({
              missionId: 'mission-a',
              hasPassenger: true,
              prompt: 'Sprich kurz zum Piloten.',
              fallbackText: 'Willkommen an Bord.',
              speaker: { name: 'Mara', gender: 'female' },
              ...recipe
            })
          }
        }
      }
    }
  };
}

function request() {
  return {
    commandId: 'mfx-boarding',
    missionId: 'mission-a',
    runId: 'run-a',
    effect: { effectId: 'mfx-boarding', type: 'voice.boarding' }
  };
}

test('Bush pickup voice dispatch validates the private Bush context and plays resolved stage recipe', async () => {
  const bush = { profileId: 'bush_pickup_strip', targetMode: 'strip_then_return', completionMode: 'return_home',
    requiresReturnHome: true, pickupKind: 'passenger', allowedEndLocations: ['home'] };
  const context = { schema: bushPickupVoiceCore.SCHEMA, version: 1, missionId: 'mission-a', pickupKind: 'passenger',
    targetMode: 'strip_then_return', requiresReturnHome: true, bush, baseContext: 'Bush pickup voice', speaker: { name: 'Mara' },
    passenger: { name: 'Mara' } };
  const prepared = boardingVoiceCore.createRecipe({ missionId: 'mission-a', hasPassenger: true, prompt: 'Pickup prompt.',
    playCue: false, cue: { id: 'none' }, audioEnabled: false, speaker: { name: 'Mara' } });
  const active = run();
  active.executionRecipe = 'apt';
  active.resumeBundle.executionBushRecipe = { kind: 'pickup_return' };
  active.resumeBundle.executionEffectPlan.bushPickup = { voiceContext: context };
  const calls = [];
  const handler = createTrackerMissionBoardingVoice({
    authorityManager: {
      getActiveRun: () => active,
      getExecutionSnapshot: () => ({ missionId: 'mission-a', runId: 'run-a', recipe: 'apt', state: {
        bushTask: { kind: 'pickup_return' }, flags: { active: true, closingPending: false, farewellStarted: false,
          farewellCompleted: false, unloadConfirmed: false }, effects: []
      } })
    },
    voiceService: { publicState: () => ({ configured: true }), request: value => calls.push(value),
      wait: async () => ({ status: 'ready', audioAvailable: false, text: 'Pickup words.', speaker: { name: 'Mara' } }) }
  });
  const result = await handler.dispatch({ missionId: 'mission-a', runId: 'run-a', commandId: 'bush-effect',
    effect: { effectId: 'bush-effect', type: 'voice.bush', payload: { stage: 'pickup_boarding', resolvedRecipe: prepared } } });
  assert.equal(result.ok, true, result.error || result.voiceStatus || JSON.stringify(result));
  assert.equal(calls.length, 1);
  assert.equal(calls[0].prompt, 'Pickup prompt.');
  assert.equal(result.voiceOutcome.text, 'Pickup words.');
});

test('tracker boarding handler creates one central job and does not wait without an audio instance', async () => {
  const calls = [];
  const voiceService = {
    publicState: () => ({ configured: true }),
    request: (value) => calls.push(value),
    wait: async () => ({
      effectId: 'mfx-boarding', status: 'ready', audioAvailable: true, text: 'Hallo.', speaker: {}, provider: 'gemini', model: 'tts', voiceName: 'Kore'
    }),
    waitForPlayback: async () => { throw new Error('must_not_wait'); }
  };
  const handler = createTrackerMissionBoardingVoice({
    authorityManager: { getActiveRun: () => run() },
    voiceService,
    getAudioPlaybackCandidates: () => 0
  });
  const result = await handler.dispatch(request());
  assert.equal(result.ok, true);
  assert.equal(result.voiceStatus, 'no_audio_instance');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].kind, 'boarding');
  assert.equal(calls[0].fallbackText, 'Willkommen an Bord.');
  assert.equal(calls[0].cue.id, 'boarding_pax');
});

test('tracker boarding handler waits for the selected cockpit playback instance', async () => {
  let waited = 0;
  const handler = createTrackerMissionBoardingVoice({
    authorityManager: { getActiveRun: () => run() },
    voiceService: {
      publicState: () => ({ configured: true }),
      request: () => ({}),
      wait: async () => ({ effectId: 'mfx-boarding', status: 'ready', audioAvailable: true, text: 'Hallo.', speaker: {} }),
      waitForPlayback: async () => { waited += 1; return { status: 'completed', completed: true }; }
    },
    getAudioPlaybackCandidates: () => 2
  });
  const result = await handler.dispatch(request());
  assert.equal(waited, 1);
  assert.equal(result.voiceStatus, 'completed');
});

test('tracker boarding handler releases the mission gate when no cockpit claims ready audio', async () => {
  let playbackWaits = 0;
  let cancelled = null;
  const handler = createTrackerMissionBoardingVoice({
    authorityManager: { getActiveRun: () => run() },
    voiceService: {
      publicState: () => ({ configured: true }),
      request: () => ({}),
      wait: async () => ({ effectId: 'mfx-boarding', status: 'ready', audioAvailable: true, text: 'Hallo.', speaker: {} }),
      waitForPlaybackClaim: async () => ({ status: 'timeout', claimed: false }),
      waitForPlayback: async () => { playbackWaits += 1; return { status: 'completed', completed: true }; },
      cancel: (effectId, reason) => { cancelled = { effectId, reason }; }
    },
    getAudioPlaybackCandidates: () => 2
  });
  const result = await handler.dispatch(request());
  assert.equal(playbackWaits, 0);
  assert.equal(result.ok, true);
  assert.equal(result.voiceStatus, 'no_audio_claim');
  assert.equal(result.voiceOutcome.status, 'warning');
  assert.equal(result.voiceOutcome.error, 'voice_playback_unclaimed');
  assert.deepEqual(cancelled, { effectId: 'mfx-boarding', reason: 'boarding_voice_unclaimed' });
});

test('a stalled boarding voice request times out, is cancelled and still releases the boarding gate', async () => {
  let cancelled = null;
  const handler = createTrackerMissionBoardingVoice({
    authorityManager: { getActiveRun: () => run() },
    voiceService: {
      publicState: () => ({ configured: true }),
      request: () => ({}),
      wait: () => new Promise(() => {}),
      cancel: (effectId, reason) => { cancelled = { effectId, reason }; }
    },
    generationTimeoutMs: 10
  });

  const result = await handler.dispatch(request());
  assert.equal(result.ok, true);
  assert.equal(result.status, 'completed');
  assert.equal(result.voiceStatus, 'boarding_voice_timeout');
  assert.equal(result.voiceOutcome.status, 'warning');
  assert.deepEqual(cancelled, { effectId: 'mfx-boarding', reason: 'boarding_voice_timeout' });
});

test('missing provider and disabled App voice preserve the best-effort boarding gate', async () => {
  const noProvider = createTrackerMissionBoardingVoice({
    authorityManager: { getActiveRun: () => run() },
    voiceService: { publicState: () => ({ configured: false }) }
  });
  assert.equal((await noProvider.dispatch(request())).voiceStatus, 'voice_not_configured');

  const muted = createTrackerMissionBoardingVoice({
    authorityManager: { getActiveRun: () => run({ audioEnabled: false }) },
    voiceService: {
      publicState: () => ({ configured: true }),
      request: () => ({}),
      wait: async () => ({ effectId: 'mfx-boarding', status: 'ready', audioAvailable: false, text: 'Willkommen an Bord.', speaker: {} })
    }
  });
  assert.equal((await muted.dispatch(request())).voiceStatus, 'audio_disabled');
});

test('APT approach uses live flight data and the selected passenger settings without a boarding cue', async () => {
  const active = run();
  active.resumeBundle.executionEffectPlan.effects['voice.approach'] = { context: {
    supported: true, mode: 'passenger', missionId: active.missionId, enabled: true, audioEnabled: false,
    baseContext: 'Passagier Mara.', dest: 'EDTL', passenger: { bankTolerance: 'niedrig' },
    briefingWeather: {}, speaker: { name: 'Mara', gender: 'female' }
  } };
  const calls = [];
  const handler = createTrackerMissionBoardingVoice({
    authorityManager: { getActiveRun: () => active, getExecutionSnapshot: () => ({ runId: active.runId, state: { phase: 'enroute', flags: { active: true } } }) },
    voiceService: {
      publicState: () => ({ configured: true }), request: value => calls.push(value),
      wait: async () => ({ status: 'ready', text: 'Wir sind gleich da.', speaker: { name: 'Mara' } })
    }
  });
  const result = await handler.dispatch({ ...request(), effect: { effectId: 'mfx-approach', type: 'voice.approach', payload: { flightData: { bankDeg: 38 } } } });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].kind, 'approach');
  assert.equal(calls[0].cue, null);
  assert.match(calls[0].prompt, /Wir nähern uns EDTL/);
  assert.match(calls[0].prompt, /Kurven haben mich/);
  assert.equal(result.voiceOutcome.kind, 'approach');
  assert.equal(result.voiceOutcome.text, 'Wir sind gleich da.');
});

test('late generated landing-roll speech is cancelled when farewell starts', async () => {
  const active = run();
  active.resumeBundle.executionEffectPlan.effects['voice.approach'] = { context: { supported: true, audioEnabled: true } };
  const state = { runId: active.runId, state: { phase: 'active', flags: { active: true } } };
  let finishGeneration;
  let generatedRequest;
  let cancelled;
  const handler = createTrackerMissionBoardingVoice({
    authorityManager: { getActiveRun: () => active, getExecutionSnapshot: () => state },
    voiceService: { publicState: () => ({ configured: true }),
      request: value => { generatedRequest = value; },
      wait: () => new Promise(resolve => { finishGeneration = resolve; }),
      cancel: id => { cancelled = id; }, activatePlayback: () => { throw new Error('late playback'); } }
  });
  const pending = handler.dispatch({ ...request(), effect: { effectId: 'late-roll', type: 'voice.flight',
    payload: { kind: 'landing_roll', prompt: 'Ankunft', delayMs: 0 } } });
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(generatedRequest.deferPlayback, true);
  state.state.flags.farewellStarted = true;
  assert.equal(generatedRequest.isPlaybackAllowed(), false);
  finishGeneration({ status: 'ready', audioAvailable: true, text: 'Ankunft' });
  assert.equal((await pending).voiceStatus, 'mission_end');
  assert.equal(cancelled, 'late-roll');
});

test('fresh boarding uses current simulator position before mission telemetry is active', async () => {
  const active = run();
  active.resumeBundle.executionEffectPlan.effects['voice.approach'] = { context: { supported: true,
    departure: { lat: 48, lon: 8 }, passenger: {}, start: 'EDTW', baseContext: 'Passagier' } };
  let recipe;
  const handler = createTrackerMissionBoardingVoice({ authorityManager: { getActiveRun: () => active },
    voiceService: { publicState: () => ({ configured: true }), request: value => { recipe = value; },
      wait: async () => ({ status: 'ready', audioAvailable: true, text: 'Anderer Startort' }) } });
  const result = await handler.dispatch({ ...request(), livePosition: { lat: 49, lon: 8 } });
  assert.equal(result.voiceOutcome.wrongStartActive, true);
  assert.equal(recipe.cue, null);
  assert.match(recipe.prompt, /EDTW/);
});

test('tracker audio settings override a muted App recipe without changing the standalone recipe', async () => {
  const source = run({ audioEnabled: false }), requests = [];
  const original = JSON.stringify(source);
  const handler = createTrackerMissionBoardingVoice({ authorityManager: { getActiveRun: () => source },
    getAudioSettings: () => ({ enabled: true, paxEnabled: true, effectsEnabled: false }), getAudioPlaybackCandidates: () => 0,
    voiceService: { publicState: () => ({ configured: true }), request: value => requests.push(value),
      wait: async () => ({ status: 'ready', audioAvailable: true, text: 'Hallo.' }) } });
  await handler.dispatch(request());
  assert.equal(requests[0].synthesizeAudio, true);
  assert.equal(requests[0].cue, null);
  assert.equal(JSON.stringify(source), original);
});

test('boarding prewarm generates silently and reuses the same run job at playback', async () => {
  const jobs = new Map(), activated = [], waited = []; let generated = 0;
  const service = {
    publicState: () => ({configured:true}), get: id => jobs.get(id),
    request: value => {
      if (!jobs.has(value.effectId)) { generated++; jobs.set(value.effectId, {...value,status:'pending'}); }
      return jobs.get(value.effectId);
    },
    activatePlayback: id => activated.push(id),
    wait: async id => { waited.push(id); return {...jobs.get(id),status:'ready',audioAvailable:true,text:'Willkommen.'}; }
  };
  const handler = createTrackerMissionBoardingVoice({authorityManager:{getActiveRun:()=>run()},voiceService:service});
  await handler.prepare(request());
  await handler.prepare(request());
  assert.equal(generated,1);
  assert.deepEqual(activated,[]);
  assert.deepEqual(waited,[],'preparation does not wait for generation or playback');
  assert.equal(jobs.get('boarding-preload:run-a').deferPlayback,true);
  const result = await handler.dispatch(request());
  assert.equal(result.ok,true);
  assert.equal(generated,1,'boarding must reuse the in-flight generation');
  assert.deepEqual(activated,['boarding-preload:run-a']);
  assert.deepEqual(waited,['boarding-preload:run-a']);
});

test('changed boarding recipe discards prewarm and uses the current effect', async () => {
  const sent = [], cancelled = []; let prepared = false;
  const service = {
    publicState:()=>({configured:true}),get:()=>prepared ? {status:'ready'} : null,
    request: value => { if (prepared && value.effectId.startsWith('boarding-preload:')) throw Object.assign(new Error('changed'),{code:'effect_id_conflict'}); sent.push(value);prepared=true; },
    cancel:(id)=>cancelled.push(id),
    wait:async id=>({effectId:id,status:'ready',audioAvailable:true,text:'Aktueller Text.'})
  };
  const handler=createTrackerMissionBoardingVoice({authorityManager:{getActiveRun:()=>run()},voiceService:service});
  await handler.prepare(request());
  const result=await handler.dispatch(request());
  assert.equal(result.ok,true);
  assert.deepEqual(cancelled,['boarding-preload:run-a']);
  assert.equal(sent[1].effectId,'mfx-boarding');
  assert.equal(sent[1].deferPlayback,false);
});

test('late generated route-event speech is cancelled when farewell starts', async () => {
  const active = run();
  active.resumeBundle.executionEffectPlan.effects['voice.approach'] = { context: { supported: true, audioEnabled: true } };
  const state = { runId: active.runId, state: { phase: 'active', flags: { active: true } } };
  let finishGeneration;
  let generatedRequest;
  let cancelled;
  const handler = createTrackerMissionBoardingVoice({
    authorityManager: { getActiveRun: () => active, getExecutionSnapshot: () => state },
    voiceService: { publicState: () => ({ configured: true }),
      request: value => { generatedRequest = value; },
      wait: () => new Promise(resolve => { finishGeneration = resolve; }),
      cancel: id => { cancelled = id; }, activatePlayback: () => { throw new Error('late playback'); } }
  });
  const pending = handler.dispatch({ ...request(), effect: { effectId: 'late-roll', type: 'voice.flight',
    payload: { kind: 'route_story', prompt: 'Ankunft', delayMs: 0 } } });
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(generatedRequest.deferPlayback, true);
  state.state.flags.farewellStarted = true;
  assert.equal(generatedRequest.isPlaybackAllowed(), false);
  finishGeneration({ status: 'ready', audioAvailable: true, text: 'Ankunft' });
  assert.equal((await pending).voiceStatus, 'mission_end');
  assert.equal(cancelled, 'late-roll');
});

test('club voice uses the restored spoken transcript in the central generation prompt',async()=>{
 const calls=[];
 const active=run({taskDomain:'club_utility',speaker:{name:'Mara',gender:'female',taskDomain:'club_utility'}});
 const handler=createTrackerMissionBoardingVoice({
  authorityManager:{getActiveRun:()=>active,getExecutionSnapshot:()=>({state:{voice:{clubHistory:[{id:'old',text:'Den Vereinsabend habe ich schon erwähnt.'}]}}})},
  voiceService:{publicState:()=>({configured:true}),request:v=>calls.push(v),wait:async()=>({status:'ready',audioAvailable:true,text:'Neuer Gedanke.',speaker:{taskDomain:'club_utility'}})},
  getAudioPlaybackCandidates:()=>0
 });
 await handler.dispatch(request());
 assert.match(calls[0].prompt,/Den Vereinsabend habe ich schon erwähnt/);
 assert.match(calls[0].prompt,/BEREITS GESPROCHEN/);
});

test('private return voice carries confirmed earlier speech into generation',async()=>{
 const calls=[];
 const active=run({taskDomain:'private_return',speaker:{name:'Mara',gender:'female',taskDomain:'private_return'}});
 const handler=createTrackerMissionBoardingVoice({
  authorityManager:{getActiveRun:()=>active,getExecutionSnapshot:()=>({state:{voice:{privateReturnHistory:[{id:'old',text:'Die Farben in der Ausstellung habe ich schon erwähnt.'}]}}})},
  voiceService:{publicState:()=>({configured:true}),request:v=>calls.push(v),wait:async()=>({status:'ready',audioAvailable:true,text:'Neuer Gedanke.',speaker:{taskDomain:'private_return'}})},
  getAudioPlaybackCandidates:()=>0
 });
 await handler.dispatch(request());
 assert.match(calls[0].prompt,/Die Farben in der Ausstellung habe ich schon erwähnt/);
});

test('cargo manual query uses cargo farewell context when passenger approach context is absent',async()=>{
 const active=run();
 active.resumeBundle.executionEffectPlan.effects['voice.farewell']={context:{supported:true,mode:'cargo',taskDomain:'cargo_fragile',speaker:{name:'Lademeister',taskDomain:'cargo_fragile'},audioEnabled:true}};
 const calls=[];
 const handler=createTrackerMissionBoardingVoice({authorityManager:{getActiveRun:()=>active},
  voiceService:{publicState:()=>({configured:true}),request:v=>calls.push(v),wait:async()=>({status:'ready',audioAvailable:true,text:'Ladung sitzt.',speaker:{taskDomain:'cargo_fragile'}})},getAudioPlaybackCandidates:()=>0});
 await handler.dispatch({...request(),effect:{effectId:'query',type:'voice.flight',payload:{kind:'pax_query',prompt:'Ladungszustand?',fallbackText:'Ladung prüfen.'}}});
 assert.equal(calls[0].prompt,'Ladungszustand?');
});

test('POI boarding voice awaits the remote authority text commit before activating playback', async () => {
  const effect = { effectId: 'poi-text', type: 'voice.poi', payload: { action: 'status', resolvedRecipe: {
    schema: 'ga.mission-poi-voice-recipe.v1', missionId: 'mission-a', enabled: true,
    prompt: 'Status', audioEnabled: false, kind: 'poi'
  } } };
  const snapshot = { missionId: 'mission-a', runId: 'run-a', recipe: 'poi', state: {
    phase: 'active', flags: { active: true }, effects: [effect]
  } };
  let commitFinished = false, submitted;
  const handler = createTrackerMissionBoardingVoice({
    authorityManager: {
      getActiveRun: () => ({ ...run(), executionRecipe: 'poi' }),
      getExecutionSnapshot: () => snapshot, supportsExecutionRecipe: () => true,
      async recordGeneratedText() { await new Promise(resolve => setImmediate(resolve)); commitFinished = true; return { ok: true }; }
    },
    voiceService: {
      publicState: () => ({ configured: true }),
      request: value => { submitted = value; },
      wait: async () => {
        assert.equal((await submitted.confirmTextReady('Status gespeichert.')).ok, true);
        commitFinished = false;
        return { status: 'ready', text: 'Status gespeichert.', audioAvailable: false };
      },
      activatePlayback: () => assert.equal(commitFinished, true)
    }
  });
  const result = await handler.dispatch({ ...request(), effect });
  assert.equal(result.ok, true);
  assert.equal(result.status, 'completed');
});

test('POI Training bridge dispatches packaged Stall audio without a remote provider', async () => {
  const calls=[];
  const active={...run(),executionRecipe:'poi'};
  const recipe={schema:'ga.mission-poi-voice-recipe.v1',missionId:'mission-a',kind:'poi',taskDomain:'training',
    enabled:true,audioEnabled:true,prompt:'',fallbackText:'Stall erkannt.',staticClipKey:'stall_break_detected',speaker:{}};
  const handler=createTrackerMissionBoardingVoice({
    authorityManager:{getActiveRun:()=>active,supportsExecutionRecipe:()=>true,
      getExecutionSnapshot:()=>({runId:'run-a',state:{flags:{active:true},effects:[]}})},
    voiceService:{publicState:()=>({configured:false}),supportsStaticTraining:r=>r.staticClipKey==='stall_break_detected',
      request:r=>calls.push(r),wait:async()=>({status:'ready',audioAvailable:true,text:''})},
    getAudioPlaybackCandidates:()=>0
  });
  const result=await handler.dispatch({...request(),effect:{effectId:'training-stall',type:'voice.poi',payload:{resolvedRecipe:recipe}}});
  assert.equal(result.ok,true);
  assert.equal(calls.length,1);
  assert.equal(calls[0].staticClipKey,'stall_break_detected');
  assert.notEqual(result.voiceStatus,'voice_not_configured');
});

test('Training phase scope prevents stale instructions before synthesis and playback', async () => {
  const effect = {effectId:'training-phase',type:'voice.poi',payload:{trainingScope:'0:1:turning',resolvedRecipe:{
    schema:'ga.mission-poi-voice-recipe.v1',missionId:'mission-a',kind:'poi',enabled:true,audioEnabled:true,fallbackText:'Kurve fliegen.'}}};
  const activeState={activeIndex:0,exercises:[{attempts:1}],active:{phase:'rollout'}};
  const snapshot={missionId:'mission-a',runId:'run-a',recipe:'poi',state:{flags:{active:true},effects:[effect],
    poiTask:{trainingState:{checkpoint:{procedureState:{activeState}}}}}};
  let generated;
  const handler=createTrackerMissionBoardingVoice({authorityManager:{
    getActiveRun:()=>({...run(),executionRecipe:'poi'}),getExecutionSnapshot:()=>snapshot,supportsExecutionRecipe:()=>true,recordGeneratedText:()=>({ok:true})},
    voiceService:{publicState:()=>({configured:true}),request:v=>{generated=v;},wait:async()=>({status:'ready',text:'Kurve fliegen.',audioAvailable:false})}});
  assert.equal((await handler.dispatch({...request(),effect})).voiceStatus,'training_phase_superseded');
  assert.equal(generated,undefined);
  activeState.active.phase='turning';
  await handler.dispatch({...request(),effect});
  assert.equal(generated.isPlaybackAllowed(),true);
  activeState.active.phase='rollout';
  assert.equal(generated.isPlaybackAllowed(),false);
});

test('sightseeing voice uses the restored spoken transcript in the central generation prompt',async()=>{
 const calls=[];
 const active=run({taskDomain:'sightseeing_tour',narrativeSchema:'sightseeing-idea.v1',speaker:{name:'Mara',gender:'female',taskDomain:'sightseeing_tour',narrativeSchema:'sightseeing-idea.v1'}});
 const handler=createTrackerMissionBoardingVoice({
  authorityManager:{getActiveRun:()=>active,getExecutionSnapshot:()=>({state:{voice:{clubHistory:[{id:'old',text:'Den Ortsaspekt habe ich schon erwähnt.'}]}}})},
  voiceService:{publicState:()=>({configured:true}),request:v=>calls.push(v),wait:async()=>({status:'ready',audioAvailable:true,text:'Neuer Gedanke.',speaker:{taskDomain:'sightseeing_tour',narrativeSchema:'sightseeing-idea.v1'}})},
  getAudioPlaybackCandidates:()=>0
 });
 await handler.dispatch(request());
 assert.match(calls[0].prompt,/Den Ortsaspekt habe ich schon erwähnt/);
 assert.match(calls[0].prompt,/BEREITS GESPROCHEN/);
});

test('expired Fire search hints cannot activate late TTS playback', async()=>{
 const effect={effectId:'fire-hint',type:'voice.poi',payload:{fireSearchHint:true,expiresAt:Date.now()-1,resolvedRecipe:{schema:'ga.mission-poi-voice-recipe.v1',missionId:'mission-a',kind:'poi',enabled:true,audioEnabled:true,prompt:'',fallbackText:'Verdacht nordwestlich der Gebietsmarkierung.'}}};
 const snapshot={missionId:'mission-a',runId:'run-a',recipe:'poi',state:{phase:'active',flags:{active:true},effects:[effect],poiTask:{fireState:{scenario:{state:'searching'}}}}};
 let submitted,played=false;
 const handler=createTrackerMissionBoardingVoice({authorityManager:{getActiveRun:()=>({...run(),executionRecipe:'poi'}),getExecutionSnapshot:()=>snapshot,supportsExecutionRecipe:()=>true},voiceService:{publicState:()=>({configured:true}),request:v=>{submitted=v;},wait:async()=>({status:'ready',audioAvailable:true,text:'Verdacht nordwestlich der Gebietsmarkierung.'}),activatePlayback:()=>{played=true;},cancel:()=>{}}});
 const result=await handler.dispatch({...request(),effect});assert.equal(submitted.isPlaybackAllowed(),false);assert.equal(played,false);assert.equal(result.status,'completed');
});

test('SAR hint prewarms silently, reuses audio and cannot play after a contact',async()=>{
 const active=run({audioEnabled:true});active.executionRecipe='poi';
 const scenario={schema:'sar-search.v2',truth:'incident',center:{lat:48,lon:8},source:{lat:48,lon:7.98}};
 const context={missionId:'mission-a',audioEnabled:true,speaker:{name:'Mara'}};
 active.resumeBundle.executionPoiRecipe={sarScenario:scenario,voiceContext:context};
 const jobs=new Map(),activated=[],cancelled=[];let found=null;
 const handler=createTrackerMissionBoardingVoice({authorityManager:{getActiveRun:()=>active,supportsExecutionRecipe:()=>true,getExecutionSnapshot:()=>({missionId:'mission-a',runId:'run-a',recipe:'poi',state:{flags:{active:true},phase:'in_flight',effects:[],poiTask:{sarSearchState:{found}}}})},voiceService:{publicState:()=>({configured:true}),get:id=>jobs.get(id),request:value=>{jobs.set(value.effectId,{...value,status:'ready'});},activatePlayback:id=>activated.push(id),cancel:(id,reason)=>cancelled.push({id,reason}),wait:async id=>({...jobs.get(id),audioAvailable:false,text:jobs.get(id).fallbackText})}});
 await handler.prepare(request());assert.equal(jobs.size,2);const prepared=jobs.get('sar-hint-preload:run-a');assert.equal(prepared.deferPlayback,true);assert.equal(prepared.synthesizeAudio,true);assert.equal(prepared.missionScope.policy,'run');assert.equal(prepared.isPlaybackAllowed(),true);assert.deepEqual(activated,[]);
 const cue=require('./tracker-mission-sar-search-task.js').voices(context,[require('../mission-sar-search-core.js').hint(scenario)],Date.now())[0];
 const effect={effectId:'sar-hint-live',type:'voice.poi',payload:cue};await handler.dispatch({...request(),effect});assert.deepEqual(activated,['sar-hint-preload:run-a']);assert.equal(jobs.has('sar-hint-live'),false);
 found={id:'contact'};const result=await handler.dispatch({...request(),effect});assert.equal(result.voiceStatus,'sar_hint_stale');assert.equal(activated.length,1);assert.ok(cancelled.some(c=>c.reason==='sar_hint_stale'));
});

test('Bush return approach uses restored pickup speech from the execution snapshot with a public run DTO', async () => {
  const active = run({ audioEnabled: false });
  active.state = 'active';
  active.executionRecipe = 'apt';
  active.resumeBundle.executionBushRecipe = { kind: 'pickup_return' };
  const plan = active.resumeBundle.executionEffectPlan;
  plan.bushPickup = { voiceContext: {
    missionId: 'mission-a', pickupKind: 'passenger',
    bush: { profileId: 'bush_pickup_strip', targetMode: 'strip_then_return', requiresReturnHome: true }
  } };
  plan.effects['voice.approach'] = { context: { supported: true, missionId: 'mission-a', mode: 'passenger',
    baseContext: 'ROLLE: Mara, abgeholte Passagierin.', audioEnabled: false, dest: 'Heimatplatz' } };
  const snapshot = JSON.parse(JSON.stringify({ missionId: 'mission-a', runId: 'run-a', recipe: 'apt', state: {
    phase: 'enroute', flags: { active: true }, effects: [], bushTask: { kind: 'pickup_return' },
    voice: { bushMemory: { passenger: {
      boarding: 'Die Proben aus dem oberen Tal sind verstaut.',
      departure: 'Morgen werden die Proben in der Basis ausgewertet.'
    } } }
  } }));
  const originalPlan = JSON.stringify(plan);
  const calls = [];
  const handler = createTrackerMissionBoardingVoice({
    authorityManager: { getActiveRun: () => active, getExecutionSnapshot: () => snapshot },
    voiceService: { publicState: () => ({ configured: true }), request: value => calls.push(value),
      wait: async () => ({ status: 'ready', audioAvailable: false, text: 'Gleich sind wir wieder zu Hause.' }) }
  });
  const result = await handler.dispatch({ ...request(), effect: { effectId: 'bush-approach', type: 'voice.approach' } });
  assert.equal(result.ok, true);
  assert.equal(calls.length, 1);
  assert.match(calls[0].prompt, /Die Proben aus dem oberen Tal sind verstaut/);
  assert.match(calls[0].prompt, /Morgen werden die Proben in der Basis ausgewertet/);
  assert.match(calls[0].prompt, /Story-Stufe Anflug/);
  assert.equal(calls[0].kind, 'approach');
  assert.equal(calls[0].isPlaybackAllowed(), true);
  assert.equal(JSON.stringify(plan), originalPlan, 'runtime memory must not mutate the handoff context');
});

test('boarding weather uses the current local ground baseline, ignores outlook and stale/remote data', () => {
  const now = Date.now(), validAt = new Date(now).toISOString();
  const cold = { lat: 45, lon: -115, tempC: -12, windKts: 2, validAt };
  const live = { lat: 45, lon: -115, onGround: true, tempC: 30, windKts: 2 };
  const react = (rows, fd = live) => boardingVoiceCore.boardingWeatherReaction(rows, fd, now);
  assert.match(react([cold]), /-12 Grad.*30 Grad/);
  assert.equal(react([{ ...cold, tempC: 25 }]), '');
  assert.equal(react([cold], { ...live, onGround: false }), '');
  assert.equal(react([cold], { ...live, tempC: null }), '');
  assert.equal(react([{ ...cold, lat: 46 }]), '');
  assert.equal(react([{ ...cold, validAt: new Date(now - 3 * 3600000).toISOString() }]), '');
  assert.equal(react([{ ...cold, validAt: 'bad' }]), '');
  assert.equal(react([{ lat: 45, lon: -115, forecastNext72Hours: { tempC: -12 } }]), '');
  assert.equal(react([{ ...cold, tempC: null, windDeg: 270 }], { ...live, windDeg: 90, tempC: null }), '');
  assert.match(react([{ ...cold, tempC: null, windKts: 35, visKm: 2 }], { ...live, tempC: null, visKm: 10 }), /Wetterregler/);
  assert.match(react([{ ...cold, lat: 46 }, cold]), /Wetterregler/);
});

test('tracker computes the weather comment at playback, not prewarm; stale boarding audio is discarded', async () => {
  const baseline = { lat: 45, lon: -115, tempC: -12, validAt: new Date().toISOString() };
  const activeRun = run({ boardingWeather: [baseline] });
  const calls = [], cancelled = [];
  const voiceService = {
    publicState: () => ({ configured: true }),
    get: () => ({ status: 'ready' }),
    request: value => {
      calls.push(value);
      if (value.effectId.startsWith('boarding-preload:') && value.prompt.includes('Wetterregler')) {
        const error = new Error('changed'); error.code = 'effect_id_conflict'; throw error;
      }
    },
    cancel: (...args) => cancelled.push(args),
    activatePlayback: () => {},
    wait: async () => ({ status: 'ready', text: 'Hier ist es wärmer als im Briefing.', speaker: {}, audioAvailable: true })
  };
  const handler = createTrackerMissionBoardingVoice({
    authorityManager: { getActiveRun: () => activeRun, getExecutionRuntimeContext: () => ({ latestTelemetry: { lat: 45, lon: -115, onGround: true, tempC: 30 } }) },
    voiceService, getAudioPlaybackCandidates: () => 0
  });
  await handler.dispatch({ ...request(), prepareOnly: true });
  assert.doesNotMatch(calls[0].prompt, /Wetterregler/);
  const result = await handler.dispatch(request());
  assert.equal(result.voiceOutcome.weatherMismatchUsed, true);
  assert.match(calls.at(-1).prompt, /Wetterregler/);
  assert.equal(calls.at(-1).effectId, 'mfx-boarding');
  assert.equal(cancelled[0][1], 'boarding_preload_stale');
});


test('weather consumption survives normalized snapshot and resume', () => {
  const execution = require('../mission-execution-core.js');
  const state = execution.normalizeState({ voice: { boarding: { status: 'ok', text: 'Wetterhinweis', weatherMismatchUsed: true } } });
  const restored = execution.normalizeState(JSON.parse(JSON.stringify(state)));
  assert.equal(restored.voice.boarding.weatherMismatchUsed, true);
  assert.equal(execution.deriveView(restored).voice.boarding.weatherMismatchUsed, true);
});


test('Bush chapters prewarm without claiming a location and reject delayed audio after leaving the geo radius',async()=>{
 const core=require('../mission-bush-narrative-core.js'),home={lat:45,lon:-115},target={lat:45,lon:-114};
 const frame=core.frame({start:home,target,passenger:{name:'Mara'},features:[{id:'lake',name:'See',kind:'lake',lat:45,lon:-114.5}]});
 const plan=core.validate({persona:'Herzlich',memory:'Fahrt',events:[{id:'a',kind:'fixed',atAirborneSeconds:90,text:'Geschichte eins.'},{id:'b',kind:'fixed',atAirborneSeconds:300,text:'Geschichte zwei.'},{id:'geo',kind:'geo',anchorId:'lake',radiusNm:1,text:'Ein Freund erzählte mir von diesem See.'}]},frame);
 const active=run();active.resumeBundle.executionEffectPlan.effects['voice.approach']={context:{supported:true,mode:'passenger',speaker:{name:'Mara'},passenger:{name:'Mara'},bushNarrative:plan}};
 const state={flags:{active:true},effects:[]};let telemetry={...home,onGround:true};
 const calls=[],cancelled=[],cache=new Map();let leave=false;
 const handler=createTrackerMissionBoardingVoice({authorityManager:{getActiveRun:()=>active,getExecutionSnapshot:()=>({runId:'run-a',state}),getExecutionRuntimeContext:()=>({latestTelemetry:telemetry})},
 voiceService:{publicState:()=>({configured:true}),get:id=>cache.get(id),request:q=>{calls.push(q);cache.set(q.effectId,{status:'ready'});},activatePlayback:()=>{},cancel:(id)=>cancelled.push(id),
 wait:async()=>{if(leave)telemetry={...home,onGround:false};return {status:'ready',audioAvailable:false,text:plan.events[2].text,speaker:{name:'Mara'}};}}});
 const req={...request(),effect:{type:'voice.flight',effectId:'geo-effect',payload:{kind:'bush_story',narrativeEventId:'geo',narrativeKind:'geo',geo:plan.events[2].geo,fallbackText:plan.events[2].text}}};
 await handler.prepare(req);assert.equal(calls.length,1);assert.equal(calls[0].deferPlayback,true);assert.equal(calls[0].isPlaybackAllowed(),true);assert.equal(calls[0].fallbackText,plan.events[2].text);
 telemetry={...plan.events[2].geo,onGround:false};leave=true;
 const result=await handler.dispatch(req);assert.equal(result.voiceStatus,'mission_end');assert.ok(cancelled.length);assert.equal(calls[1].effectId,calls[0].effectId);
 const guard=calls[1].isPlaybackAllowed;telemetry={...plan.events[2].geo,onGround:false,simPaused:true};assert.equal(guard(),false);
 telemetry={...plan.events[2].geo,onGround:false,slewActive:true};assert.equal(guard(),false);
 telemetry={...plan.events[2].geo,onGround:false};assert.equal(guard(),true);
});
