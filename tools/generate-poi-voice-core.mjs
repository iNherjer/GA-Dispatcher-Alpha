import { extractOriginalFunction } from './extract-original-function.mjs';
import fs from 'node:fs';
const source = fs.readFileSync(new URL('../passenger-voice.js', import.meta.url), 'utf8');
export const promptNames = ['_poiEntryPrompt', '_poiInSightPrompt', '_poiAltComplaintPrompt',
  '_poiAltCorrectedPrompt', '_poiSatisfiedPrompt', '_poiAbortPrompt', '_poiMissingCargoAbortPrompt'];
export const helperNames = ['_poiMemoryCompact', '_capturePoiNarrativeMemory', '_poiNoRepeatHint',
  '_poiNarrativeMemoryText', '_poiMemoryHasCue', '_factKeywords', '_poiMemoryHasSimilarFact',
  '_getPoiInspectionOutcome', '_inspectionEntryHint', '_inspectionResultHint', '_professionalTaskHint',
  '_domainDriftGuard', '_targetFactHint', '_paxMemoryMentionsLandmark', '_paxApproachLandmarkCueLine',
  '_paxCardinalGerman', '_weatherContext', '_professionalLandingToneHint'];
export const knowledgeNames = ['_poiKnowledgeCleanFactText', '_poiKnowledgeContextIdentity', '_poiKnowledgeSyncContext', '_poiKnowledgeFactCandidates', '_poiKnowledgeFactKey', '_poiKnowledgeStageScore', '_poiKnowledgeStageMinIndex', '_poiKnowledgeFactHint', '_poiKnowledgeRichFactCount', '_poiKnowledgeFactSequenceHint', '_poiKnowledgeManualFactCandidates', '_poiKnowledgeTellMoreAvailable', '_poiKnowledgeFreshFactCount', '_poiKnowledgeManualFactClip', '_poiKnowledgeNextManualFact', '_poiKnowledgeTargetName'];
const actionNames = ['_missionActionContext', '_missionVectorText', '_missionOrientationFactLine', '_missionStatusFacts', '_paxNearLandmarkOrientationLine', '_poiMissionStatusAction', '_poiMissionOrientationAction'];
const farewellNames = ['_farewellPrompt', '_failedMissionFarewellFallback', '_farewellPreparedContext'];
export function extract(name, text = source) { return extractOriginalFunction(text, name); }
const header = `// Generated from original passenger-voice.js functions by tools/generate-poi-voice-core.mjs.
// Do not hand-edit prompt text or rules; update the App source and verify parity.
(function(root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./mission-poi-task-core.js') : root.GAMissionPoiTaskCore);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.GAMissionPoiVoiceCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function(taskCore) {
'use strict';
const CONTEXT_SCHEMA = 'ga.mission-poi-voice-context.v1';
const DOMAINS = Object.freeze(['media_photo', 'inspection_infra', 'news_coverage', 'science_bio', 'science_geo', 'science_general', 'sightseeing_tour', 'poi_learning_guide']);
const PROMPTS = Object.freeze(${JSON.stringify(promptNames)});
const clone = value => JSON.parse(JSON.stringify(value));
function normalizeMemory(value = {}) {
  return { pre: String(value?.pre || '').slice(0, 180), entry: String(value?.entry || '').slice(0, 180),
    done: String(value?.done || '').slice(0, 180), inspectionOutcome: String(value?.inspectionOutcome || '').slice(0, 40) || null,
    ...(Array.isArray(value?.knowledgeManual) && value.knowledgeManual.length ? { knowledgeManual: value.knowledgeManual.filter(x => typeof x === 'string').slice(-512) } : {}),
    ...(value?.knowledgeSpoken ? { knowledgeSpoken: String(value.knowledgeSpoken).slice(-4000) } : {}) };
}
function validateContext(context, missionId = context?.missionId) {
  if (context?.schema !== CONTEXT_SCHEMA || context.version !== 1 || !missionId || context.missionId !== missionId)
    return 'poi_voice_context_identity_invalid';
  if (!DOMAINS.includes(context.taskDomain) || typeof context.strict !== 'boolean'
      || !context.passenger || Array.isArray(context.passenger) || typeof context.baseContext !== 'string' || !context.baseContext.trim()
      || typeof context.audioEnabled !== 'boolean') return 'poi_voice_context_invalid';
  if (['trainingPlan', 'trainingProcedure', 'poiChain', 'surveyPattern', 'sarHeli', 'bush'].some(key => context.passenger[key])) return 'poi_voice_specialized_context_not_migrated';
  try {
    if (encodeURIComponent(JSON.stringify(context)).replace(/%[A-F0-9]{2}/g, 'x').length > 65536)
      return 'poi_voice_context_too_large';
  } catch (_) { return 'poi_voice_context_invalid'; }
  return null;
}
function original(context = {}, previous = {}, cue = {}, randomValue = 0.5) {
  const window = { activePassenger: context.passenger, lastLiveGpsPos: cue.sample || {}, lastLiveFlightData: cue.sample || cue.dynamic?.liveWeather,
    paxVoiceGetPoiMissionProgress: () => cue.dynamic?.poiProgress || {}, missionRuntimeIsActive: () => cue.active !== false };
  const _paxDebugMotionProtectionEnabled = () => context.motionProtectionEnabled === true;
  const _consumeWeatherMismatchEasteregg = () => cue.dynamic?.weatherMismatchHint || '';
  const _bushPickupNarrativeHint = () => '';
  const _followUpDeboardingHintLine = () => context.followUpDeboardingHint || '';
  const _activeMissionStoryFrame = () => ({ focusSubject: context.storyFocusSubject });
  const _poiAborted = (cue.detector || cue.dynamic?.poiProgress)?.aborted === true;
  const _poiSatisfied = cue.detector?.satisfied === true;
  const _poiInRadius = cue.detector?.inRadius === true;
  const _activeMissionData = () => context.missionData || {};
  const _getDestCoords = () => cue.target || null;
  const _haversineNm = (...args) => taskCore.distanceNm(...args);
  const _bearingDeg = (...args) => taskCore.bearingDeg(...args);
  const _relativeClockPos = (...args) => taskCore.relativeClockPos(...args);
  const _poiChainActiveSpec = () => null;
  const _poiChainProgressSummary = () => '';
  const _paxCityDatasetAvailable = () => true;
  const _paxMapPlaceOrientationLine = () => context.mapPlaceOrientationLine || '';
  let actionResult = null;
  const _missionActionSpeak = (prompt, label, fallbackText) => { actionResult = { prompt: prompt || '', label, fallbackText }; };
  const _paxSpeakTextDirect = (text, label) => _missionActionSpeak('', label, text);
  const _missionHasPax = () => true;
  const _speakerSnapshotForActivePax = () => context.speaker;
  const _paxMissionAudioKey = kind => kind + ':' + context.missionId;
  const currentMissionData = context.missionData || {};
  const document = { getElementById: id => id === 'wikiDestDescText' ? { innerText: context.wikiText || '' } : null };
  const Math = Object.create(globalThis.Math);
  Math.random = () => randomValue;
  const _baseContext = () => context.baseContext;
  const _toneHint = () => context.toneHint || '';
  const _activeTaskDomain = () => context.taskDomain;
  const _isPOIMission = () => true;
  const _activeAptTrainingPlan = () => null;
  const _activePoiKnowledgeContext = () => {
    const knowledge = context.knowledgeContext;
    const status = String(knowledge?.status || '').toLowerCase();
    return knowledge && Array.isArray(knowledge.facts) && knowledge.facts.length && (!status || status === 'accept')
      ? knowledge : (context.captureKnowledge ? {} : null);
  };
  const _activeBushReconOutcome = () => null;
  const _bushReconOutcomeHintLine = () => '';
  const _sarResultHint = () => '';
  const _inspectionMissionMeta = () => context.inspectionMeta || null;
  const _activeInfraInspectionOutcome = () => context.infraOutcome || null;
  const _professionalRoleMeta = () => context.professionalMeta || null;
  const _targetContextFactCandidates = () => context.targetFacts || [];
  const _paxApproachLandmarkPolicy = () => context.landmarkPolicy || null;
  const _paxConfirmedVisualLandmarks = () => context.visualLandmarks || [];
  const _paxTargetGeoContext = () => context.targetGeoContext || null;
  const _paxStrictMode = context.strict;
  const _poiDwellSec = Number(cue.detector?.dwellSec || 0);
  const _poiNarrativeMemory = normalizeMemory(previous);
  let _poiKnowledgeSpokenMemory = String(previous.knowledgeSpoken || '').slice(-4000);
  let _poiKnowledgeManualFactIndices = new Set(previous.knowledgeManual || []);
  const _refreshPoiKnowledgeGuideMenu = () => {};
  let _poiKnowledgeContextKey = _poiKnowledgeContextIdentity(_activePoiKnowledgeContext());
  let _poiInspectionOutcome = _poiNarrativeMemory.inspectionOutcome;
`;
const footer = `
  if (cue.availability) return _poiKnowledgeTellMoreAvailable();
  if (cue.action) {
    if (cue.action === 'poi_tell_more') {
      if (!_poiKnowledgeTellMoreAvailable()) throw new TypeError('poi_knowledge_not_available');
      paxKnowledgeTellMore();
      return { ...actionResult, memory: normalizeMemory({ ...previous, knowledgeManual: [..._poiKnowledgeManualFactIndices] }) };
    }
    if (cue.action === 'poi_status') _poiMissionStatusAction(); else _poiMissionOrientationAction(true);
    return actionResult;
  }
  let prompt = null;
  if (cue.prompt) prompt = ({ ${promptNames.join(', ')} })[cue.prompt](...cue.args);
  if (cue.farewell) {
    const prepared = _farewellPreparedContext(cue.dynamic?.record);
    return { prompt: prepared?.prompt || '', text: prepared?.text || '', fallbackText: '' };
  }
  if (cue.capture) _capturePoiNarrativeMemory(cue.capture.label, cue.capture.text);
  return { prompt, memory: normalizeMemory({ ..._poiNarrativeMemory, inspectionOutcome: _poiInspectionOutcome, knowledgeSpoken: _poiKnowledgeSpokenMemory }) };
}
function render(context, cue, previous = {}, randomValue = 0.5) {
  const error = validateContext(context);
  if (error) throw new TypeError(error);
  if (!PROMPTS.includes(cue?.prompt) || !Array.isArray(cue.args) || cue.args.length > 5)
    throw new TypeError('poi_voice_cue_invalid');
  if (!Number.isFinite(randomValue) || randomValue < 0 || randomValue >= 1) throw new TypeError('poi_voice_random_invalid');
  const result = original(clone(context), clone(previous), clone(cue), randomValue);
  if (result.prompt && result.prompt.length > 24000) throw new TypeError('poi_voice_prompt_too_large');
  return result;
}
function captureMemory(previous, label, text, taskDomain = 'media_photo') {
  return original({ taskDomain, captureKnowledge: ['sightseeing_tour', 'poi_learning_guide'].includes(taskDomain) }, previous, { capture: { label, text } }).memory;
}
function renderFarewell(context, dynamic = {}, previous = {}) {
  const error = validateContext(context);
  if (error) throw new TypeError(error);
  const result = original(clone(context), clone(previous), { farewell: true, dynamic: clone(dynamic) });
  if (result.prompt && result.prompt.length > 24000) throw new TypeError('poi_voice_prompt_too_large');
  return result;
}
function renderAction(context, action, detector, sample, target, previous = {}) {
  const error = validateContext(context);
  if (error) throw new TypeError(error);
  if (!['poi_status', 'poi_orientation', 'poi_tell_more'].includes(action)) throw new TypeError('poi_action_invalid');
  const result = original(clone(context), clone(previous), { action, detector: clone(detector || {}), sample: clone(sample || {}), target: clone(target) });
  if (result.prompt.length > 24000) throw new TypeError('poi_voice_prompt_too_large');
  return result;
}
function knowledgeAvailable(context, memory = {}, active = true) {
  return original(context || {}, memory || {}, { availability: true, active });
}
return Object.freeze({ knowledgeAvailable, renderAction, renderFarewell, CONTEXT_SCHEMA, DOMAINS, PROMPTS, validateContext, normalizeMemory, render, captureMemory });
});
`;
const result = header + [...helperNames, ...knowledgeNames, ...promptNames, ...farewellNames, ...actionNames].map(name => extract(name)).join('\n\n') + '\n' + extract('paxKnowledgeTellMore', source.replace('window.paxKnowledgeTellMore = function(', 'function paxKnowledgeTellMore(')).replace(/    if \(window\.gaTrackerExecutionHandlesMission.*\n/g, '') + footer;
const target = new URL('../mission-poi-voice-core.js', import.meta.url);
if (process.argv.includes('--check')) {
  if (fs.readFileSync(target, 'utf8') !== result) throw new Error('POI voice core drifted from App source');
} else fs.writeFileSync(target, result);
