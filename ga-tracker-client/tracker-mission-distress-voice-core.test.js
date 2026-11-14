'use strict';
const assert = require('assert');
const core = require('./tracker-mission-distress-voice-core.js');

const ready = { speakerReady: true, airborne: true };
const context = { baseContext: 'Du bist Anna, Passagierin.', toneHint: '' };

// Passenger stages: below 50 queasy, below 30 sick, each once.
assert.strictEqual(core.paxStage(50), null);
assert.strictEqual(core.paxStage(49), 'queasy');
assert.strictEqual(core.paxStage(29), 'sick');
let r = core.observe(null, { ...ready, now: 100000, comfortScore: 45 });
assert.deepStrictEqual(r.event, { kind: 'pax_distress', stage: 'queasy' });
let again = core.observe(r.state, { ...ready, now: 200000, comfortScore: 44 });
assert.strictEqual(again.event, null, 'queasy speaks once');
let sick = core.observe(r.state, { ...ready, now: 110000, comfortScore: 20 });
assert.strictEqual(sick.event, null, 'minimum spacing between remarks');
sick = core.observe(r.state, { ...ready, now: 130000, comfortScore: 20 });
assert.deepStrictEqual(sick.event, { kind: 'pax_distress', stage: 'sick' });
// A jump straight to sick marks queasy done too.
const jump = core.observe(null, { ...ready, now: 100000, comfortScore: 10 });
assert.strictEqual(jump.event.stage, 'sick');
assert.strictEqual(jump.state.pax.queasy, true);
// Not ready / on ground: nothing is spent.
const busy = core.observe(null, { ...ready, speakerReady: false, now: 100000, comfortScore: 10 });
assert.strictEqual(busy.event, null);
assert.strictEqual(busy.state.pax.sick, false);
assert.strictEqual(core.observe(null, { ...ready, airborne: false, now: 100000, comfortScore: 10 }).event, null);
// Committed effects (resume) count as done.
assert.strictEqual(core.observe(null, { ...ready, now: 100000, comfortScore: 40, committed: [{ kind: 'pax_distress', stage: 'queasy' }] }).event, null);

// Cargo condition: same stress formula as the arrival check, loaded cargo only.
const manifest = { items: [
  { id: 'box', label: 'Ersatzteilkiste', itemType: 'cargo', required: true, status: 'loaded', healthPct: 100 },
  { id: 'net', label: 'Netz', itemType: 'cargo', persistentEquipment: true, status: 'loaded', healthPct: 100 },
  { id: 'pax', itemType: 'passenger', status: 'loaded' },
  { id: 'open', label: 'Offen', itemType: 'cargo', status: 'pending', healthPct: 100 }
] };
assert.strictEqual(core.cargoCondition({ items: [] }, {}), null);
const calm = core.cargoCondition(manifest, { maxGForce: 1.3 });
assert.strictEqual(calm.conditionPct, 100);
// (3.65 - 1.45) * 22 = 48.4 -> 48 damage -> 52 %; 3.75 g -> 51 damage -> 49 %.
assert.strictEqual(core.cargoCondition(manifest, { maxGForce: 3.65 }).conditionPct, 52);
const hit = core.cargoCondition(manifest, { maxGForce: 3.75 });
assert.strictEqual(hit.conditionPct, 49);
assert.deepStrictEqual(hit.worstItems, ['Ersatzteilkiste']);
assert.strictEqual(core.cargoStage(hit), 'damaged');
const broken = core.cargoCondition(manifest, { maxGForce: 4.4 });
assert.ok(broken.conditionPct <= 35);
assert.deepStrictEqual(broken.requiredBroken, ['Ersatzteilkiste']);
assert.strictEqual(core.cargoStage(broken), 'broken');
assert.strictEqual(core.cargoCondition(manifest, { maxGForce: 4.4 }, { motionProtectionEnabled: true }).conditionPct, 100);
// Cargo remarks also on the ground (hard landing); broken required cargo goes before nausea.
const both = core.observe(null, { speakerReady: true, airborne: false, now: 100000, comfortScore: 20, cargo: broken });
assert.deepStrictEqual(both.event, { kind: 'cargo_distress', stage: 'broken' });

// Prompts and delivery.
const pax = core.effectPayload(context, { kind: 'pax_distress', stage: 'sick' }, { comfortScore: 22, pilotEvents: 2, weatherEvents: 0 });
assert.ok(/Spucktüte/.test(pax.prompt) && /landet/.test(pax.prompt));
assert.ok(/elend/.test(pax.ttsStyle));
const weatherOnly = core.effectPayload(context, { kind: 'pax_distress', stage: 'queasy' }, { comfortScore: 45, pilotEvents: 0, weatherEvents: 3 });
assert.ok(/keine Schuld/.test(weatherOnly.prompt));
const cargo = core.effectPayload(context, { kind: 'cargo_distress', stage: 'broken' }, null, broken);
assert.ok(/Pflichtladung/.test(cargo.prompt) && /Problem/.test(cargo.prompt));
assert.strictEqual(cargo.ttsStyle, undefined);
assert.strictEqual(core.effectPayload({}, { kind: 'pax_distress', stage: 'sick' }, {}), null, 'no context, no remark');

// EFB rows without a passenger.
assert.deepStrictEqual(core.feedbackRows(calm), []);
assert.strictEqual(core.feedbackRows(hit)[0].label, 'Ladung beschädigt');
assert.strictEqual(core.feedbackRows(broken)[0].tone, 'danger');

// The delivery style reaches both TTS paths; without it the speaker style stays.
const boarding = require('../mission-boarding-voice-core.js');
assert.strictEqual(boarding.conversationalTtsStyle({ taskDomain: 'club_utility' }, core.TTS_STYLE.sick), core.TTS_STYLE.sick);
assert.ok(/Vereinskollegen/.test(boarding.conversationalTtsStyle({ taskDomain: 'club_utility' })));
assert.deepStrictEqual(boarding.geminiTtsPart('gemini-3.8-flash-tts', 'Tüte!', {}, core.TTS_STYLE.sick).speech_metadata, { style: core.TTS_STYLE.sick });
assert.ok(boarding.geminiTtsPart('gemini-2.5-flash-preview-tts', 'Tüte!', {}, core.TTS_STYLE.sick).text.startsWith(core.TTS_STYLE.sick));
assert.deepStrictEqual(boarding.geminiTtsPart('gemini-3.8-flash-tts', 'Hallo', {}), { text: 'Hallo' });

console.log('tracker-mission-distress-voice-core tests passed');
