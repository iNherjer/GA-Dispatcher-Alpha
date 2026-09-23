'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const voice = require('../mission-poi-voice-core.js');

// Tracker action contract: pass poiTask.voiceMemory into renderSarReport and
// commit its returned memory alongside the cue, so a manual found report wins
// over the later automatic SAR completion/farewell outcome.

const context = {
  schema: voice.CONTEXT_SCHEMA, version: 1, missionId: 'sar-poi-voice', taskDomain: 'search_and_rescue',
  strict: true, audioEnabled: false,
  baseContext: 'ROLLE: Einsatzleiterin Mara\nAUSGABE: Nur gesprochener Text.',
  passenger: { name: 'Mara', role: 'Einsatzleiterin', taskDomain: 'search_and_rescue' },
  speaker: { name: 'Mara', role: 'Einsatzleiterin', gender: 'female', taskDomain: 'search_and_rescue' },
  storyFrame: { focusSubject: 'der verletzte Wanderer', subjectDetail: 'der verletzte Wanderer',
    lastSeenContext: 'am Nordhang', probableScenario: 'ist gestuerzt', soughtOutcome: 'eine Verletzung festgestellt',
    visibleClueCandidates: ['roter Rucksack'] },
  missionData: { poiName: 'Nordhang' }
};

test('SAR domain is additive and specialized helicopter validation stays closed', () => {
  assert.equal(voice.validateContext(context), null);
  assert.equal(voice.validateContext({ ...context, passenger: { ...context.passenger, sarHeli: true } }), 'poi_voice_specialized_context_not_migrated');
  assert.throws(() => voice.renderSarReport({ ...context, taskDomain: 'media_photo' }, { nearEnough: true }), /poi_sar_report_domain_invalid/);
});

test('automatic SAR outcome is seeded once into memory and keeps the original 0.38 probability', () => {
  const found = voice.render(context, { prompt: '_poiSatisfiedPrompt', args: [{}] }, {}, 0.37);
  assert.equal(found.memory.sarSearchOutcome, 'found');
  assert.match(found.prompt, /verwertbaren Treffer/);
  const continued = voice.render(context, { prompt: '_poiSatisfiedPrompt', args: [{}] }, found.memory, 0.9);
  assert.equal(continued.memory.sarSearchOutcome, 'found');
  const notFound = voice.render(context, { prompt: '_poiSatisfiedPrompt', args: [{}] }, {}, 0.38);
  assert.equal(notFound.memory.sarSearchOutcome, 'not_found');
  assert.match(notFound.prompt, /noch keinen Treffer/);
});

test('manual SAR reports preserve original prompt and fallback and accepted reports lock found outcome', () => {
  const reportContext = { nearEnough: true, hasPosition: true, confirmDistNm: 0.18, confirmRangeNm: 0.5,
    confirmCoords: { lat: 47.2, lon: 11.4, name: 'Nordhang' }, targetName: 'Nordhang' };
  const accepted = voice.renderSarReport(context, reportContext, { inRadius: true }, {}, 0.9);
  assert.equal(accepted.label, 'Fund bestaetigt');
  assert.equal(accepted.memory.sarSearchOutcome, 'found');
  assert.match(accepted.prompt, /klaren positiven Sichtbestaetigung/);
  assert.match(accepted.fallbackText, /bestaetige den Fund/);
  const completion = voice.render(context, { prompt: '_poiSatisfiedPrompt', args: [{}] }, accepted.memory, 0.9);
  assert.match(completion.prompt, /verwertbaren Treffer/);
  const farewell = voice.renderFarewell(context, {}, accepted.memory);
  assert.equal(farewell.memory.sarSearchOutcome, 'found');

  const declined = voice.renderSarReport(context, { ...reportContext, nearEnough: false, confirmDistNm: 1.2 }, {}, accepted.memory, 0.2);
  assert.equal(declined.label, 'Weiter suchen');
  assert.equal(declined.memory.sarSearchOutcome, 'found');
  assert.match(declined.prompt, /noch keinen positiven Sichtkontakt/);
  assert.match(declined.fallbackText, /noch etwa 1.2 NM zu weit/);
});

test('generated voice core matches the original app functions', () => {
  execFileSync(process.execPath, ['tools/generate-poi-voice-core.mjs', '--check'], { cwd: path.join(__dirname, '..') });
});
