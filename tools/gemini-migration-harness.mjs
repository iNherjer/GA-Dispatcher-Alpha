import fs from 'node:fs';
import vm from 'node:vm';

// Compile declaration boundaries without running the full UI or rewriting prompts.
export function declaration(source, name) {
  const match = new RegExp(`(?:async )?function ${name}\\(`).exec(source);
  if (!match) throw Error(`Missing function: ${name}`);
  const tail = source.slice(match.index);
  for (const end of tail.matchAll(/\n[ \t]*}/g)) {
    const code = tail.slice(0, end.index + end[0].length);
    try { new vm.Script(code); return code; } catch (error) {
      if (!(error instanceof SyntaxError)) throw error;
    }
  }
  throw Error(`Cannot extract: ${name}`);
}
export function load(env, source, names) {
  const context = vm.createContext(env);
  for (const name of names) vm.runInContext(declaration(source, name), context);
  return context;
}
export const read = file => fs.readFileSync(file, 'utf8');
export const plain = value => JSON.parse(JSON.stringify(value));
export const weatherRows = [
  {label:'Start',name:'Test-Startplatz',source:'METAR-Testfixture',station:'TEST',wind:'240 Grad, 8 kt',vis:'10 km',clouds:'SCT 3500 ft',wx:'kein Niederschlag gemeldet',cat:'VFR'},
  {label:'Ziel',name:'Test-Zielplatz',source:'keine',station:'-',wind:'unbekannt',vis:'unbekannt',clouds:'unbekannt',wx:'unbekannt',cat:'unbekannt'}
];
export const assessment = {label:'Teilweise Daten',text:'Am Start VFR; am Ziel fehlen aktuelle Wetterdaten.'};
export function weatherHarness(source, fetch, key='test-key') {
  return load({fetch,getGeminiApiKey:()=>key,incrementApiUsage:()=>{}}, source,
    ['weatherAiPrompt','fetchGeminiWeatherText']);
}
export function assertClean(config) {
  for (const field of ['temperature','topP','topK','top_p','top_k','thinkingBudget','thinking_budget']) {
    if (Object.hasOwn(config,field)) throw Error(`Deprecated parameter: ${field}`);
  }
  if(config.thinkingConfig)assertClean(config.thinkingConfig);
}

export const draft = {missionType:'bush',targetLabel:'Test-Strip',targetCategory:'cargo',taskDomain:'cargo',roleProfile:'cargo_pilot',primaryObjective:'Eine Werkzeugkiste am Zielstrip an den Bodenhelfer übergeben.'};
export const plannerFixture = {missionType:'bush',target:{name:'Test-Strip',lat:48,lon:8},
  missionTruth:{primaryObjective:draft.primaryObjective},allowedTaskDomains:['cargo'],allowedRoleProfiles:['cargo_pilot'],
  weather:{dep:null,dest:null},targetGeoContext:null,
  missionPlan:{plan:{...draft}},sceneIntent:{summary:'Frachtübergabe am Strip, keine POI-Zielszene'},
  aptArrivalPlan:{role:'bush_strip_dropoff',roleLabel:'Frachtübergabe',expectedBy:'Bodenhelfer',items:[]},
  note:'Synthetic API test data, no real location claims. Missing geo/weather remains unknown.'};
export function plannerHarness(source,fetch,{reporter=false}={}) {
  const parse=text=>{try{return {parsed:JSON.parse(String(text).replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,''))}}catch{return {parsed:null}}};
  return load({fetch,AbortController,setTimeout,clearTimeout,window:{MissionReporterSceneCore:{enabled:()=>reporter}},
    normalizeMissionType:(mode,isPOI)=>mode||(isPOI?'poi':'bush'),sanitizeMissionSceneIntentSpec:x=>x,
    getSelectedAiModelProfile:()=> 'auto',incrementApiUsage:()=>{},MISSION_SCENE_PLANNER_V3_VERSION:'test',
    scenePlannerV3ExecuteTool:async()=>plannerFixture,_missionPipelineV3ExecuteTool:async()=>plannerFixture,
    _missionParseJsonTextDetailed:parse,sanitizeScenePlannerV3Result:parsed=>parsed},source,
    ['scenePlannerV3Prompt','scenePlannerV3ToolDeclarations','_missionPipelineV3Prompt','_missionPipelineV3ToolDeclarations',
      '_missionPipelineV3ExtractFunctionCalls','_missionPipelineV3ExtractText','_missionPipelineV3ParseJsonText',
      'composeMissionScenePlanV3WithGemini','_missionPipelineV3RunModel']);
}

export function voiceCore(source) {
  const env=vm.createContext({});vm.runInContext(source,env);return env.GAMissionBoardingVoiceCore;
}
export const speaker={name:'Mara',role:'Vereinskollegin',gender:'female',taskDomain:'club_utility'};
export const voicePrompt='Du bist Mara, eine Vereinskollegin im Flugsimulator. Antworte auf Deutsch in höchstens zwei kurzen Sätzen auf die Wetterfrage. Es gibt keine aktuellen Wetterdaten am Ziel. Sage ausdrücklich, dass das Zielwetter unbekannt ist. Erfinde weder Sicht, Wind noch Wolken. Keine Markdown-Formatierung.';
export function voiceHarness(source,core,fetch,key='test-key',{missingCore=false,provider='gemini'}={}) {
  return load({window:{GAMissionBoardingVoiceCore:missingCore?undefined:core,activePassenger:speaker},
    fetch,_getAiProvider:()=>provider,_getApiKey:()=>key,_getTrackerVoiceClient:()=>null,
    _paxAiTextModels:()=>provider==='gemini'?core.GEMINI_TEXT_MODELS.map(m=>[m,m,'flash']):[['gpt-4.1-mini','OpenAI','openaiText']],
    _paxLog:()=>{},_normSpeakerGender:()=> 'female',_ttsVoiceCandidatesForSpeaker:()=>['Kore'],
    _lastSpokenSpeaker:null,_paxTtsModelPref:'auto',_paxTtsHedgeEnabled:()=>false},source,
    ['_generateSpokenText','_requestTTSAudioForModel','_requestTTSAudio']);
}
