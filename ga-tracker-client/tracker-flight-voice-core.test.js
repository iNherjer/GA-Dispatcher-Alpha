'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { observeFlightVoice } = require('./tracker-flight-voice-core.js');
const context = { supported: true, mode: 'passenger', baseContext: 'Passenger reference', toneHint: ' Tone.', passenger: {}, start: 'EDTW' };
const facts = { active: true, greetingDone: true, departureDistanceNm: 5, flightData: { onGround: false, windKts: 50, gForce: 1, bankDeg: 0, vsFpm: 0 } };
test('the detector functions remain verbatim copies of the standalone implementation', () => {
  const source = fs.readFileSync(path.join(__dirname, '../passenger-voice.js'), 'utf8');
  const central = fs.readFileSync(path.join(__dirname, 'tracker-flight-voice-core.js'), 'utf8');
  for (const [start, end] of [['function _normLevel3(', 'function _inspectionMissionMeta('],
    ['const _PAX_COMFORT_MOTION_WINDOW_MS', 'function _farewellPrompt('],
    ['function _wrongLocationPrompt(', 'function _offDestinationLandingPrompt(']]) {
    assert(central.includes(source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)))));
  }
});
test('confirmed comfort, cooldown, maximum and restart produce the same event sequence', () => {
  let state = {}, restored = {}, events = [], resumedEvents = [];
  for (let now = 100000; now <= 380000; now += 250) {
    const tick = { ...facts, now };
    const a = observeFlightVoice(context, state, tick);
    const b = observeFlightVoice(context, JSON.parse(JSON.stringify(restored)), tick);
    state = a.state; restored = b.state;
    events.push(...a.effects.map(effect => ({ ...effect, at: now })));
    resumedEvents.push(...b.effects.map(effect => ({ ...effect, at: now })));
  }
  assert.deepEqual(resumedEvents, events);
  assert.equal(events.length, 3);
  assert.deepEqual(events.map(event => event.at), [101000, 191000, 281000]);
  assert(events.every(event => event.delayMs === 300 && event.kind === 'comfort'));
  assert.match(events[0].prompt, /NICHT den Piloten/);
});
test('brief spikes, ground, protected motion, approach and pending speech do not generate comfort calls', () => {
  for (const guard of [{ flightData: { ...facts.flightData, onGround: true } }, { motionProtectionEnabled: true },
    { approachDone: true }, { comfortPending: true }, { ending: true }, { departureDistanceNm: 3.99 }, { greetingDone: false }]) {
    let state = {};
    for (let now = 100000; now < 105000; now += 250) {
      const result = observeFlightVoice(context, state, { ...facts, now, ...guard });
      state = result.state;
      assert.equal(result.effects.length, 0, JSON.stringify(guard));
    }
  }
  let state = observeFlightVoice(context, {}, { ...facts, now: 100000 }).state;
  state = observeFlightVoice(context, state, { ...facts, now: 101000 }).state; // gap resets confirmation
  assert.equal(state.count, 0);
});
test('wrong-start follow-up uses the original ground and altitude-or-speed gate once', () => {
  let state = {};
  const tick = flightData => {
    const result = observeFlightVoice(context, state, { ...facts, greetingDone: false, now: 100000, wrongStartActive: true, flightData });
    state = result.state; return result.effects;
  };
  assert.equal(tick({ onGround: true, aglFt: 500, gsKts: 80 }).length, 0);
  assert.equal(tick({ onGround: false, aglFt: 119, gsKts: 59 }).length, 0);
  const effects = tick({ onGround: false, aglFt: 120, gsKts: 0 });
  assert.equal(effects[0].kind, 'wrong_start');
  assert.equal(effects[0].delayMs, 300);
  assert.equal(tick({ onGround: false, aglFt: 500, gsKts: 80 }).length, 0);
});

test('off-destination, landing-roll and required-cargo comments keep the original waits and text', () => {
  const extra = { ...context, hasAptArrivalRuntimePoint: true, afterLandingHint: 'Zum Empfangspunkt rollen.' };
  const first = observeFlightVoice(extra, {}, { ...facts, greetingDone: false, now: 100000, touchdown: true, offDestinationLanding: true, destinationDistanceNm: 12 });
  assert.deepEqual(first.effects.map(effect => [effect.kind, effect.delayMs]), [['off_destination', 300], ['landing_roll', 1000]]);
  assert.match(first.effects[0].prompt, /12.0 NM/);
  assert.match(first.effects[1].prompt, /Zum Empfangspunkt rollen/);
  const next = observeFlightVoice(extra, first.state, { ...facts, greetingDone: false, now: 101000, touchdown: true, offDestinationLanding: true, destinationDistanceNm: 12 });
  assert.equal(next.effects.length, 0);
  const dropped = observeFlightVoice(extra, {}, { cargoEvent: { type: 'dropped_required', item: { storyName: 'Kühlbox', required: true } } });
  assert.equal(dropped.effects[0].kind, 'cargo_event');
  assert.equal(dropped.effects[0].delayMs, 0);
  assert.match(dropped.effects[0].prompt, /Kühlbox wurde im Flug abgeworfen/);
});
