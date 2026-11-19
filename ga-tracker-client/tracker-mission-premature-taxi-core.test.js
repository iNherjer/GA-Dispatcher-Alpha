'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createMissionStartReadiness } = require('./tracker-mission-start-readiness');
const core = require('./tracker-mission-premature-taxi-core');

function fixture(context = {}) {
  let at = 500000, lat = 48.0, phase = context.phase || 'boarding';
  const readiness = createMissionStartReadiness({ now: () => at });
  const watch = core.createPrematureTaxiWatch();
  const done = [];
  const packet = (patch = {}) => {
    const sample = { observedAt: at, simRunning: 1, simPaused: false, inMenuOrMap: false, slewActive: false, cameraState: 2,
      lat, lon: 8.0, altFt: 600, onGround: true, gsKts: 0, ...patch };
    const state = readiness.observe(sample);
    watch.observe(sample, state, { runId: 'run-1', phase, done });
    const due = watch.due();
    if (due) { done.push(due.stage); watch.settle(due.stage, true); }
    return { due, away: watch.snapshot() };
  };
  const stand = () => { for (let n = 0; n < 8; n++) { packet(); at += 500; } return packet(); };
  // 4 kt are ~2 m per second: lat steps of 0.00002 deg (~2.2 m).
  const roll = (gsKts = 4, patch = {}) => { at += 1000; lat += 0.00002 * gsKts / 4; return packet({ gsKts, ...patch }); };
  return { packet, stand, roll, done, setPhase: value => { phase = value; }, advance: ms => { at += ms; } };
}

test('rolling two packets away from the stand in boarding warns once', () => {
  const f = fixture(); f.stand();
  assert.equal(f.roll().due, null, 'one packet is not enough');
  const second = f.roll();
  assert.deepEqual(second.due && { stage: second.due.stage, phase: second.due.phase }, { stage: 'taxi', phase: 'boarding' });
  assert.equal(second.away.status, 'away');
  for (let n = 0; n < 6; n++) assert.equal(f.roll().due, null, 'continued rolling does not repeat');
  assert.deepEqual(f.done, ['taxi']);
});

test('jitter at the stand never warns: slow creep, single spikes, brake release without moving', () => {
  const f = fixture(); f.stand();
  for (let n = 0; n < 6; n++) { f.roll(1.5); }
  f.stand();
  for (let n = 0; n < 4; n++) { f.roll(6); f.advance(0); f.packet({ gsKts: 0.2 }); }
  f.stand();
  // Speed spikes while the position does not change (sim settling): under 5 m from the stand.
  for (let n = 0; n < 4; n++) { f.advance(1000); f.packet({ gsKts: 3 }); }
  assert.deepEqual(f.done, []);
});

test('a second warning needs a stop in between, lift-off warns once more, then silence', () => {
  const f = fixture(); f.stand(); f.roll(); f.roll();
  f.stand();
  assert.equal(f.roll().due, null);
  assert.equal(f.roll().due.stage, 'taxi_again');
  f.stand(); f.roll(); f.roll(); f.roll();
  assert.deepEqual(f.done, ['taxi', 'taxi_again'], 'no third ground warning');
  f.advance(1000); f.packet({ onGround: false, gsKts: 70 });
  const lifted = (f.advance(1000), f.packet({ onGround: false, gsKts: 72 }));
  assert.equal(lifted.due.stage, 'airborne'); assert.equal(lifted.away.airborne, true);
  for (let n = 0; n < 4; n++) { f.advance(1000); f.packet({ onGround: false, gsKts: 80 }); }
  assert.deepEqual(f.done, ['taxi', 'taxi_again', 'airborne']);
});

test('pause, menu and other phases never warn; prepare uses its own lines', () => {
  for (const phase of ['planned', 'boarded', 'active']) {
    const f = fixture({ phase }); f.stand(); for (let n = 0; n < 4; n++) f.roll();
    assert.deepEqual(f.done, [], phase);
  }
  const paused = fixture(); paused.stand();
  for (let n = 0; n < 4; n++) paused.roll(4, n % 2 ? { simPaused: true } : { inMenuOrMap: true });
  assert.deepEqual(paused.done, []);
  const prepare = fixture({ phase: 'prepare' }); prepare.stand(); prepare.roll();
  assert.equal(prepare.roll().due.phase, 'prepare');
  assert.equal(core.effectPayload({ stage: 'taxi', phase: 'prepare', role: 'passenger', context: {} }).fallbackText,
    'Halt, stopp! Ich bin doch noch gar nicht eingestiegen!');
});

test('speaker: local passenger with voice context, otherwise dispatcher radio', () => {
  const context = { supported: true, speaker: { name: 'Lena' }, baseContext: 'Du bist Lena.' };
  const pax = { items: [{ itemType: 'passenger', status: 'pending' }] };
  assert.equal(core.speakerRole(pax, context), 'passenger');
  assert.equal(core.speakerRole({ items: [{ itemType: 'cargo' }] }, context), 'dispatcher');
  assert.equal(core.speakerRole({ items: [{ itemType: 'passenger', pickupLocation: 'target' }] }, context), 'dispatcher', 'bush pickup waits at the target');
  assert.equal(core.speakerRole(pax, null), 'dispatcher');
  const passenger = core.effectPayload({ stage: 'taxi', phase: 'boarding', role: 'passenger', context });
  assert.equal(passenger.fallbackText, 'Halt, stopp! Wir haben das Verladen noch nicht abgeschlossen!');
  assert.match(passenger.prompt, /^Du bist Lena\./); assert.equal(passenger.ttsStyle, core.TTS_STYLE.passenger);
  const radio = core.effectPayload({ stage: 'airborne', phase: 'boarding', role: 'dispatcher', context });
  assert.equal(radio.prompt, ''); assert.match(radio.fallbackText, /^Dispatch an Piloten:.*Kehren Sie um/);
  assert.equal(core.ttsStyleForLanguage(radio.ttsStyle, 'en'), core.TTS_STYLE_EN.dispatcher);
  assert.equal(core.ttsStyleForLanguage(radio.ttsStyle, 'de'), radio.ttsStyle);
});
