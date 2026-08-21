'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const core = require('./mission-boarding-voice-core.js');

test('boarding preparation keeps the App pickup suppression and cargo-only path', () => {
  assert.deepEqual(core.derivePreparationPolicy({
    contract: { bush: { targetMode: 'strip_then_return', pickupKind: 'passenger' } },
    hasPassenger: true
  }), { prepare: false, reason: 'outbound_pickup_boarding_suppressed' });
  assert.deepEqual(core.derivePreparationPolicy({ hasCargoContext: true }), { prepare: true, reason: null });
  assert.deepEqual(core.derivePreparationPolicy({}), { prepare: false, reason: 'boarding_voice_context_missing' });
});

test('boarding fallback is deterministic and keeps cargo-only loadmaster wording', () => {
  const facts = {
    missionSeed: 'mission-a',
    paxText: '1 PAX',
    cargoText: 'Kameratasche (12 lbs)',
    targetName: 'Freiburg',
    hasPaxMission: true,
    speaker: { name: 'Mara', role: 'Fotografin', gender: 'female' },
    requiredItems: ['Kameratasche (12 lbs)']
  };
  assert.equal(core.buildBoardingText(facts), core.buildBoardingText(facts));
  assert.match(core.buildBoardingText(facts), /Mara|wir sind/);
  assert.doesNotMatch(core.buildBoardingText(facts), /12 lbs/);
  assert.equal(core.buildBoardingText({
    cargoOnly: true,
    cargoText: 'Medikamente',
    requiredItems: ['Kühlbox'],
    destination: 'EDTL'
  }), 'Moin. Wir laden heute Kühlbox fuer EDTL. Bitte sauber sichern und am Ziel erst nach vollem Stillstand zur Uebergabe freigeben.');
});

test('training output validator uses the exact App fallback rules', () => {
  const fallbackText = 'Hallo, ich bin dein Instruktor. Heute fliegen wir zwei Uebungen.';
  assert.equal(core.finalizeBoardingText({
    taskDomain: 'training',
    generatedText: 'Verstanden, ich werde keine Markdown-Formatierung nutzen.',
    fallbackText
  }), fallbackText);
  assert.equal(core.finalizeBoardingText({
    taskDomain: 'training',
    generatedText: 'Die erste Übung beginnt erst nach der Freigabe.',
    fallbackText
  }), 'Die erste Übung beginnt erst nach der Freigabe.');
  assert.equal(core.finalizeBoardingText({
    taskDomain: 'charter',
    generatedText: 'Hallo — wir sind bereit... ',
    fallbackText
  }), 'Hallo, wir sind bereit.');
});

test('speaker voice rotation matches the App pools deterministically', () => {
  const speaker = { name: 'Mara', role: 'Fotografin', gender: 'female', roleProfile: 'reporter', taskDomain: 'reporter' };
  const gemini = core.voiceCandidates('gemini', speaker);
  const openai = core.voiceCandidates('openai', speaker);
  assert.deepEqual(new Set(gemini), new Set(['Kore', 'Leda', 'Aoede']));
  assert.deepEqual(new Set(openai), new Set(['nova', 'shimmer', 'coral']));
  assert.deepEqual(core.voiceCandidates('gemini', speaker), gemini);
  assert.equal(core.voiceCandidates('openai', speaker, 'alloy')[0], 'alloy');
});

test('boarding cue selection uses the App candidate order and exact mission seed recipe', () => {
  const variantSeed = core.boardingCueVariantSeed('boarding_pax', 'boarding:mission-a');
  assert.equal(variantSeed, 'cue-variant-boarding_pax:mission-a|boarding:mission-a|boarding-cue|boarding_pax');
  assert.deepEqual(core.audioCueCandidateNames('boarding_pax').filter(name => [
    'boarding_pax.mp3',
    'boarding_pax1.mp3',
    'boarding_pax2.mp3'
  ].includes(name)), ['boarding_pax.mp3', 'boarding_pax1.mp3', 'boarding_pax2.mp3']);
  const selected = core.selectAudioCueAsset({ id: 'boarding_pax', variantSeed }, [
    'boarding_pax.mp3',
    'boarding_pax1.mp3',
    'boarding_pax2.mp3'
  ]);
  assert.equal(selected, [
    'boarding_pax.mp3',
    'boarding_pax1.mp3',
    'boarding_pax2.mp3'
  ][core.stableHash(variantSeed) % 3]);
});

test('voice recipe round-trips without public credentials', () => {
  const recipe = core.createRecipe({
    missionId: 'mission-a',
    hasPassenger: true,
    prompt: 'Sprich kurz zum Piloten.',
    fallbackText: 'Willkommen an Bord.',
    speaker: { name: 'Mara', gender: 'female' },
    taskDomain: 'charter',
    cueId: 'boarding_pax',
    missionAudioKey: 'boarding:mission-a'
  });
  assert.equal(recipe.enabled, true);
  assert.equal(recipe.cue.id, 'boarding_pax');
  assert.deepEqual(core.normalizeRecipe(recipe), recipe);
  assert.doesNotMatch(JSON.stringify(recipe), /api.?key/i);
});
