import fs from 'node:fs';
import { extractOriginalFunction } from './extract-original-function.mjs';
const source = fs.readFileSync(new URL('../passenger-voice.js', import.meta.url), 'utf8').replace(/    if \(window\.gaTrackerExecutionHandlesMission.*\n/g, '');
const names = ['_trainingProcedureAudioKey', '_trainingProcedureEventKind', '_trainingProcedureVoiceText', '_trainingProcedurePickEvent', '_handleTrainingProcedureEvents'];
const actions = ['paxTrainingProcedureReady', 'paxTrainingProcedureAbort', 'paxTrainingProcedureRequestExtra'];
const original = names.map(name => extractOriginalFunction(source, name)).concat(actions.map(name =>
  extractOriginalFunction(source.replace(`window.${name} = function(`, `function ${name}(`), name))).join('\n\n');
const output = `// Generated from original passenger-voice.js. Do not edit by hand.
'use strict';
function render(context = {}, input = {}) {
  const voices = [];
  const currentMissionData = null;
  const result = input.result || {};
  const window = { activePassenger: null, missionTrainingProcedure: {
    signalReady: () => result, abortExercise: () => result, requestOptionalExercise: () => result
  } };
  const _paxLog = () => {};
  const _refreshTrainingProcedureMenu = () => {};
  const _refreshPaxWidgetVisibility = () => {};
  const _speakerSnapshotForMissionVoice = () => context.speaker || null;
  const _paxMissionAudioKey = kind => kind + ':' + context.missionId;
  const _paxTryPlayStaticTrainingVoice = kind => kind;
  const _speakPreparedText = (key, text, speaker, label, options = {}) => {
    voices.push({ key, text, speaker, label, staticClipKey: options.tryStaticAudio?.(0) || null });
  };
  const _trainingProcedureControlSpeak = (text, label) => {
    const clean = String(text || '').replace(/\\s+/g, ' ').trim();
    if (clean) voices.push({ text: clean, label, speaker: context.speaker || null, staticClipKey: null });
  };
${original}
  if (input.action) {
    const action = { training_ready: paxTrainingProcedureReady, training_abort: paxTrainingProcedureAbort,
      training_extra: paxTrainingProcedureRequestExtra }[input.action];
    if (!action) throw new TypeError('training_action_invalid');
    action();
  } else _handleTrainingProcedureEvents(input.events || [], input.recipe || null);
  return voices;
}
module.exports = { render };
`;
const target = new URL('../mission-training-voice-core.js', import.meta.url);
if (process.argv.includes('--check')) {
  if (!fs.existsSync(target) || fs.readFileSync(target, 'utf8') !== output) throw new Error('Training voice core drift');
} else fs.writeFileSync(target, output);
