import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import { extractOriginalFunction } from './extract-original-function.mjs';

// Arrival voice hints must match what stands in the sim: a waiting, visible
// reception only with a checked stand; otherwise the pickup comes to the aircraft.
const source = fs.readFileSync(new URL('../passenger-voice.js', import.meta.url), 'utf8');
const names = ['_aptArrivalHasStaticScene', '_aptArrivalPickupContact', '_aptArrivalCue', '_aptArrivalLocationLabel',
  '_aptArrivalContextLine', '_aptArrivalApproachHint', '_aptArrivalAfterLandingHint', '_aptArrivalFarewellHint'];

function load(plan, taskDomain = 'charter') {
  const context = {
    window: {},
    _activeAptArrivalPlan: () => plan,
    _activeTaskDomain: () => taskDomain,
    _privateReturnNarrativeHint: () => '',
    _privateOutingStoryContext: () => null
  };
  vm.createContext(context);
  vm.runInContext(names.map(name => extractOriginalFunction(source, name)).join('\n'), context);
  return context;
}

const base = { roleLabel: 'Charter-Abholung', expectedBy: 'Shuttle oder lokaler Empfangskontakt',
  visibleCue: 'kleines Shuttle- oder Abholfahrzeug', source: 'airport-representative-offset' };
const noScene = { ...base, snapStatus: { status: 'fallback', spawnAllowed: false, reason: 'no_safe_osm_parking_or_apron_candidate' } };
const withScene = { ...base, source: 'osm_hangar_front', semantic: 'safe_osm_hangar_front',
  snapStatus: { status: 'resolved', spawnAllowed: true } };

test('without a checked stand nobody is described as waiting or visible', () => {
  const v = load(noScene);
  assert.equal(v._aptArrivalHasStaticScene(noScene), false);
  assert.equal(v._aptArrivalCue(noScene), '');
  assert.equal(v._aptArrivalLocationLabel(noScene), 'am Abstellplatz');
  const texts = [v._aptArrivalContextLine(), v._aptArrivalApproachHint(), v._aptArrivalAfterLandingHint(), v._aptArrivalFarewellHint()];
  for (const text of texts) {
    assert.ok(text.includes('Shuttle oder lokaler Empfangskontakt'), text);
    assert.ok(!/erkennbar an|dort wartet|wartet am Ziel/.test(text), text);
  }
  assert.match(texts[1], /nach dem Abstellen zum Flugzeug/);
  assert.match(texts[3], /noch nicht zu sehen/);
});

test('old plans without status on the raw airport offset count as no scene', () => {
  const legacy = { ...base };
  const v = load(legacy);
  assert.equal(v._aptArrivalHasStaticScene(legacy), false);
  assert.ok(!v._aptArrivalApproachHint().includes('erkennbar an'));
});

test('a checked stand keeps the waiting reception wording', () => {
  const v = load(withScene);
  assert.equal(v._aptArrivalHasStaticScene(withScene), true);
  assert.equal(v._aptArrivalCue(withScene), 'Shuttle oder lokaler Empfangskontakt, erkennbar an kleines Shuttle- oder Abholfahrzeug');
  assert.equal(v._aptArrivalLocationLabel(withScene), 'bei den Hangars');
  assert.match(v._aptArrivalApproachHint(), /am Ziel Shuttle oder lokaler Empfangskontakt, erkennbar an/);
  assert.match(v._aptArrivalFarewellHint(), /Wir stehen jetzt bei den Hangars; dort wartet/);
});

test('private outings without a scene keep the outing focus', () => {
  const v = load(noScene, 'private_outing');
  assert.match(v._aptArrivalApproachHint(), /danach beginnt der Ausflug/);
  assert.match(v._aptArrivalAfterLandingHint(), /danach beginnt der private Ausflug/);
  assert.match(v._aptArrivalFarewellHint(), /privaten Ausflug|private Ausflug/);
});
