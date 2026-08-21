'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const core = require('./mission-farewell-voice-core.js');

test('farewell recipe keeps the App-prepared prompt, speaker and cue contract', () => {
  const recipe = core.createRecipe({
    missionId: 'apt-1',
    prompt: 'Exakter App-Farewell-Prompt',
    speaker: { name: 'Dana', role: 'Passagier', gender: 'female', taskDomain: 'transport' },
    cueId: 'deboarding_pax',
    missionAudioKey: 'farewell:apt-1',
    audioEnabled: true
  });
  assert.equal(recipe.schema, core.RECIPE_SCHEMA);
  assert.equal(recipe.kind, 'farewell');
  assert.equal(recipe.prompt, 'Exakter App-Farewell-Prompt');
  assert.equal(recipe.cue.id, 'deboarding_pax');
  assert.equal(recipe.cue.gain, 0.38);
  assert.match(recipe.cue.variantSeed, /apt-1/);
  assert.equal(core.normalizeRecipe(recipe).speaker.name, 'Dana');
});

test('direct failure farewell text is retained without a generation prompt', () => {
  const recipe = core.createRecipe({
    missionId: 'apt-failed',
    text: 'Danke fuers Mitnehmen. Der Auftrag ist heute nicht abgeschlossen.',
    playCue: false,
    audioEnabled: false
  });
  assert.equal(recipe.enabled, true);
  assert.equal(recipe.prompt, '');
  assert.match(recipe.text, /nicht abgeschlossen/);
  assert.equal(recipe.cue.id, 'none');
});

function authorityContext(overrides = {}) {
  return core.createContext({
    missionId: 'apt-context',
    missionAudioKey: 'farewell:apt-context',
    key: 'farewell:apt-context',
    mode: 'passenger',
    baseContext: 'ROLLE: Mara (Fotografin)\nAUSGABE: Nur gesprochener Text.',
    taskDomain: 'charter',
    speaker: { name: 'Mara', role: 'Fotografin', gender: 'female', taskDomain: 'charter' },
    passenger: { role: 'Fotografin', gTolerance: 'niedrig', bankTolerance: 'niedrig' },
    aptFarewellHint: 'Wir stehen am Vorfeld; dort wartet der Abholer.',
    professionalLandingHint: ' Ton bei Landung: sachlich.',
    farewellDriftGuard: ' Drift-Guard.',
    followUpDeboardingHint: '\nANSCHLUSS-HINWEIS: Der Gast bleibt zwei Tage.',
    toneHint: '\nDu-Form, nie mit Namen.',
    playCue: true,
    cueId: 'deboarding_pax',
    briefingWeather: { windKts: 5, windDeg: 20, visKm: 20 },
    ...overrides
  });
}

test('tracker-owned passenger context combines current flight, weather and App text guards', () => {
  const recipe = core.createRecipeFromContext(authorityContext(), {
    record: {
      durationSec: 1800,
      distanceNm: 82.14,
      maxAltFt: 6500,
      maxBankDeg: 39.2,
      maxGForce: 1.71,
      maxDescentFpm: -1650,
      touchdownVsFpm: -160
    },
    liveWeather: { windKts: 18, windDeg: 120, visKm: 10 }
  });
  assert.equal(recipe.enabled, true);
  assert.match(recipe.prompt, /30 min, 82\.1 NM, max 6500 ft/);
  assert.match(recipe.prompt, /Etwas viel G/);
  assert.match(recipe.prompt, /Kurven waren schon sportlich/);
  assert.match(recipe.prompt, /Landung war richtig sanft/);
  assert.match(recipe.prompt, /Wetter fühlt sich gerade deutlich anders an/);
  assert.match(recipe.prompt, /ANSCHLUSS-HINWEIS/);
  assert.equal(recipe.cue.id, 'deboarding_pax');
});

test('tracker-owned failed context uses the exact direct App fallback and no generated success prompt', () => {
  const recipe = core.createRecipeFromContext(authorityContext({ storyFocusSubject: 'die Fotodokumentation' }), {
    record: {
      missionFailed: true,
      missionCargoOutcome: { status: 'failed', failed: true, damagedRequired: ['Kamera'] }
    }
  });
  assert.equal(recipe.prompt, '');
  assert.match(recipe.text, /Fotodokumentation/);
  assert.match(recipe.text, /Kamera/);
  assert.match(recipe.text, /zweiten Anlauf/);
});

test('tracker-owned cargo context retains recipient perspective and current outcome', () => {
  const context = authorityContext({
    mode: 'cargo',
    key: 'farewell-cargo:apt-context',
    playCue: false,
    taskDomain: 'general',
    speaker: { name: 'Werkstatt', role: 'Frachtkontakt', gender: 'male' },
    cargo: {
      receiver: 'Werkstattmeister',
      start: 'EDTW',
      dest: 'EDTL',
      dist: '42',
      paxText: '0 PAX',
      cargoText: 'Ersatzteile',
      cargoName: 'Hydraulikpumpe',
      story: 'Ersatzteilflug zur Werft.',
      taskDomain: 'cargo_fragile',
      arrivalLocation: 'bei den Hangars',
      arrivalCue: 'der Werkstattwagen'
    }
  });
  const recipe = core.createRecipeFromContext(context, {
    record: { durationSec: 1200, distanceNm: 40.04 },
    cargoOutcome: { status: 'completed', failed: false }
  });
  assert.equal(recipe.cargoOnly, true);
  assert.equal(recipe.cue.id, 'none');
  assert.match(recipe.prompt, /Werkstattmeister/);
  assert.match(recipe.prompt, /20 min, 40\.0 NM/);
  assert.match(recipe.prompt, /Hydraulikpumpe/);
  assert.match(recipe.prompt, /TASK-DOMAIN: cargo_fragile/);
});

test('unsupported special context fails closed instead of inventing a hosted-EFB prompt', () => {
  const recipe = core.createRecipeFromContext(authorityContext({
    supported: false,
    unsupportedReason: 'farewell_context_training_not_migrated'
  }), {});
  assert.equal(recipe.enabled, false);
  assert.equal(recipe.skipReason, 'farewell_context_training_not_migrated');
  assert.equal(recipe.prompt, '');
});
