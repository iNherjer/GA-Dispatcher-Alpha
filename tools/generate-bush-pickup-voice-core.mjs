import fs from 'node:fs';
import { extractOriginalFunction } from './extract-original-function.mjs';

const source = fs.readFileSync(new URL('../passenger-voice.js', import.meta.url), 'utf8');
const runtimeSource = fs.readFileSync(new URL('../mission-runtime-core.js', import.meta.url), 'utf8');
const names = [
  '_bushPickupStageProgression', '_bushPickupNarrativeHint', '_captureBushPickupNarrativeMemory',
  '_bushCargoPickupNarrativeHint', '_captureBushCargoPickupNarrativeMemory',
  '_activeBushPickupPassengerContract', '_activeBushPickupCargoContract',
  '_pickupBoardingPrompt', '_pickupDeparturePrompt', '_pickupCargoBoardingPrompt', '_pickupCargoDeparturePrompt'
];
const original = names.map(name => extractOriginalFunction(source, name)).join('\n\n');
const departureGuard = extractOriginalFunction(runtimeSource.replace(
  'window.missionMaybeTriggerPickupDepartureVoice = function(flightData = {})',
  'function _originalDepartureGuard(flightData = {})'), '_originalDepartureGuard');
const output = `// Generated from original passenger-voice.js functions by tools/generate-bush-pickup-voice-core.mjs.
// Do not hand-edit prompt text or rules; update the App source and verify parity.
(function(root, factory) { 'use strict'; var api = factory(); if (typeof module === 'object' && module.exports) module.exports = api; if (root && typeof root === 'object') root.GAMissionBushPickupVoiceCore = api; }(typeof globalThis !== 'undefined' ? globalThis : this, function() {
'use strict';
const SCHEMA = 'ga.mission-bush-pickup-voice-context.v1';
const MAX_MEMORY = 4;
${extractOriginalFunction(source, '_weatherContext')}
function text(value, max = 4000) { return String(value == null ? '' : value).trim().slice(0, max); }
function normalizeMemory(value = {}) {
  const fields = (source, keys) => Object.fromEntries(keys.map(key => [key, text(source?.[key], 180)]));
  return { passenger: fields(value.passenger, ['boarding','departure','arrival','farewell']),
    cargo: fields(value.cargo, ['boarding','departure','farewell']) };
}
function validateContext(context, missionId = context?.missionId) {
  if (context?.schema !== SCHEMA || context.version !== 1 || !missionId || context.missionId !== missionId)
    return 'bush_pickup_voice_context_identity_invalid';
  if (!['passenger','cargo'].includes(context.pickupKind) || context.targetMode !== 'strip_then_return'
      || context.requiresReturnHome !== true || !context.bush || context.bush.pickupKind !== context.pickupKind
      || (context.pickupKind === 'passenger' && !context.baseContext) || !context.speaker)
    return 'bush_pickup_voice_context_invalid';
  const expectedProfile = context.pickupKind === 'passenger' ? 'bush_pickup_strip' : 'bush_pickup_cargo';
  if (context.bush.profileId !== expectedProfile || context.bush.targetMode !== 'strip_then_return'
      || context.bush.completionMode !== 'return_home' || context.bush.requiresReturnHome !== true
      || !Array.isArray(context.bush.allowedEndLocations) || context.bush.allowedEndLocations.length !== 1
      || context.bush.allowedEndLocations[0] !== 'home') return 'bush_pickup_voice_context_invalid';
  if (context.pickupKind === 'passenger' && !context.passenger) return 'bush_pickup_voice_passenger_missing';
  if (context.pickupKind === 'cargo' && !context.cargoContext) return 'bush_pickup_voice_cargo_missing';
  try { if (encodeURIComponent(JSON.stringify(context)).replace(/%[A-F0-9]{2}/g, 'x').length > 65536) return 'bush_pickup_voice_context_too_large'; }
  catch (_) { return 'bush_pickup_voice_context_invalid'; }
  return null;
}
function render(context = {}, input = {}) {
  const error = validateContext(context);
  if (error) throw new TypeError(error);
  const stage = String(input.stage || '').toLowerCase();
  const stageMap = context.pickupKind === 'passenger'
    ? { pickup_boarding: ['passenger','boarding','_pickupBoardingPrompt','Pickup'], pickup_departure: ['passenger','departure','_pickupDeparturePrompt','Rueckflug'] }
    : { cargo_pickup_boarding: ['cargo','boarding','_pickupCargoBoardingPrompt','Pickup'], cargo_pickup_departure: ['cargo','departure','_pickupCargoDeparturePrompt','Rueckflug'] };
  const selected = stageMap[stage];
  if (!selected) throw new TypeError('bush_pickup_voice_stage_invalid');
  const previous = normalizeMemory(input.previous);
  const memory = normalizeMemory(previous);
  const contract = { bush: context.bush, ...(context.contract || {}) };
  const currentMissionData = { ...(context.missionData || {}), missionContract: contract, bush: context.bush,
    ...(context.charterContinuation ? {charterIdea:{continuation:true}} : {}) };
  const window = { activePassenger: context.pickupKind === 'passenger' ? context.passenger : null,
    activeMissionContract: contract, currentMissionData,
    missionCargoGetManifestSnapshot: () => context.manifest || null };
  const localStorage = { getItem: key => key === 'ga_active_mission_contract' ? JSON.stringify(contract) : null };
  const _bushPickupNarrativeMemory = memory.passenger;
  const _bushCargoPickupNarrativeMemory = memory.cargo;
  const _baseContext = () => text(context.baseContext, 24000);
  const _toneHint = () => String(context.toneHint || '').slice(0, 4000);
  const _weatherContext = () => text(input.weatherText || context.weatherText, 1200);
  const _bushPickupStoryData = () => context.storyData || {};
  const _bushPickupStoryAnchorLine = () => text(context.storyAnchorLine, 2400);
  const _bushPickupBetweenFlightsLine = () => text(context.betweenFlightsLine, 2400);
  const _bushCargoPickupLabel = () => text(context.cargoLabel, 1200) || 'Rueckholfracht';
  const _bushCargoPickupFollowUpLine = () => text(context.cargoFollowUpLine, 2400);
  const _cargoOnlyVoiceContext = () => context.cargoContext || null;
  const _normUrgencyPriority = value => String(value || '').toLowerCase() === 'hoch' ? 'hoch' : 'normal';
  const _poiMemoryCompact = value => String(value || '').replace(/\\s+/g, ' ').replace(/\\b(äh|aeh|halt|quasi|sozusagen)\\b/gi, '').trim().slice(0,180);
${original}
  let prompt = null;
  if (selected[0] === 'passenger') prompt = selected[2] === '_pickupBoardingPrompt' ? _pickupBoardingPrompt() : _pickupDeparturePrompt();
  else prompt = selected[2] === '_pickupCargoBoardingPrompt' ? _pickupCargoBoardingPrompt() : _pickupCargoDeparturePrompt();
  if (!prompt) throw new TypeError('bush_pickup_voice_prompt_unavailable');
  if (input.spokenText) {
    if (selected[0] === 'passenger') _captureBushPickupNarrativeMemory(selected[1] === 'boarding' ? 'Pickup' : 'Rueckflug', input.spokenText);
    else _captureBushCargoPickupNarrativeMemory(selected[1] === 'boarding' ? 'Pickup' : 'Rueckflug', input.spokenText);
  }
  const next = normalizeMemory(memory);
  return { prompt, label: selected[3], stage, speaker: context.speaker, memory: next };
}
function evaluateDeparture(pending, sample = {}, now = Date.now(), pickupKind = 'passenger') {
  let triggered = false;
  const state = { missionPickupDepartureVoicePending: pending && typeof pending === 'object' ? { ...pending } : null };
  const window = { get missionPickupDepartureVoicePending() { return state.missionPickupDepartureVoicePending; },
    set missionPickupDepartureVoicePending(value) { state.missionPickupDepartureVoicePending = value; },
    activePassenger: pickupKind === 'passenger' ? {} : null,
    triggerPaxCargoPickupDeparture: () => { triggered = true; }, triggerPaxPickupDeparture: () => { triggered = true; } };
  const NativeDate = globalThis.Date;
  class Clock extends NativeDate { static now() { return now; } }
  const Date = Clock;
${departureGuard}
  const result = _originalDepartureGuard(sample);
  return { result, triggered, pending: state.missionPickupDepartureVoicePending };
}
function continuityHint(context = {}, previous = {}, stage = 'farewell') {
  const memory = normalizeMemory(previous);
  const contract = { bush: context.bush, ...(context.contract || {}) };
  const window = { activeMissionContract: contract };
  const localStorage = { getItem: () => JSON.stringify(contract) };
  const _activeBushPickupPassengerContract = () => context.pickupKind === 'passenger' ? { contract, bush: context.bush } : null;
  const _activeBushPickupCargoContract = () => context.pickupKind === 'cargo' ? { contract, bush: context.bush } : null;
  const _bushPickupNarrativeMemory = memory.passenger;
  const _bushCargoPickupNarrativeMemory = memory.cargo;
${extractOriginalFunction(source, '_bushPickupStageProgression')}
${extractOriginalFunction(source, '_bushPickupNarrativeHint')}
${extractOriginalFunction(source, '_bushCargoPickupNarrativeHint')}
  return context.pickupKind === 'passenger' ? _bushPickupNarrativeHint(stage) : _bushCargoPickupNarrativeHint(stage);
}
function captureMemory(context = {}, previous = {}, stage = '', spokenText = '') {
  const memory = normalizeMemory(previous);
  const contract = { bush: context.bush, ...(context.contract || {}) };
  const window = { activeMissionContract: contract };
  const localStorage = { getItem: () => JSON.stringify(contract) };
  const _activeBushPickupPassengerContract = () => context.pickupKind === 'passenger' ? { contract, bush: context.bush } : null;
  const _activeBushPickupCargoContract = () => context.pickupKind === 'cargo' ? { contract, bush: context.bush } : null;
  const _poiMemoryCompact = value => String(value || '').replace(/\\s+/g, ' ').replace(/\\b(äh|aeh|halt|quasi|sozusagen)\\b/gi, '').trim().slice(0,180);
  const _bushPickupNarrativeMemory = memory.passenger;
  const _bushCargoPickupNarrativeMemory = memory.cargo;
${extractOriginalFunction(source, '_captureBushPickupNarrativeMemory')}
${extractOriginalFunction(source, '_captureBushCargoPickupNarrativeMemory')}
  const label = stage.includes('departure') ? 'Rueckflug' : stage === 'arrival' ? 'Anflug' : stage === 'farewell' ? 'Verabschiedung' : 'Pickup';
  if (context.pickupKind === 'passenger') _captureBushPickupNarrativeMemory(label, spokenText);
  else _captureBushCargoPickupNarrativeMemory(label, spokenText);
  return normalizeMemory(memory);
}
return Object.freeze({ weatherContext: _weatherContext, SCHEMA, MAX_MEMORY, normalizeMemory, validateContext, render, continuityHint, captureMemory, evaluateDeparture });
}));
`;
const target = new URL('../mission-bush-pickup-voice-core.js', import.meta.url);
if (process.argv.includes('--check')) {
  if (!fs.existsSync(target) || fs.readFileSync(target, 'utf8') !== output) throw new Error('Bush Pickup voice core drift');
} else fs.writeFileSync(target, output);
