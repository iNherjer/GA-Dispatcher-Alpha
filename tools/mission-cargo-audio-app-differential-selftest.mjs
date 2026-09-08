#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import audio from '../ga-tracker-client/tracker-mission-cargo-audio.js';
import cues from '../mission-boarding-voice-core.js';
const cargo = fs.readFileSync(new URL('../mission-cargo-core.js', import.meta.url), 'utf8');
const pax = fs.readFileSync(new URL('../passenger-voice.js', import.meta.url), 'utf8');
const section = (s, a, b) => s.slice(s.indexOf(a), s.indexOf(b, s.indexOf(a)));
let call = null;
const sandbox = { window: { paxPlayAudioCue: (id, options) => { call = { id, options }; return Promise.resolve(true); } },
  _missionCargoMissionKey: () => 'mission-test', sources: [],
  _paxMissionAudioCueSourceCandidates: () => sandbox.sources, _paxMissionAudioKey: kind => `${kind}:audio-test` };
vm.createContext(sandbox);
vm.runInContext(section(pax, 'const _PAX_AUDIO_CUE_CATALOG', 'const _paxStaticVoiceCatalogPromises')
  + section(pax, 'function _paxNormalizeAudioCueId(', 'function _paxAudioCueStemVariants(')
  + section(pax, 'function _paxFindMissionAudioCueOverride(', 'window.paxPlayAudioCue =')
  + section(cargo, 'function _missionCargoAudioCueId(', 'const _MISSION_CARGO_AUDIO_QUEUE')
  + section(cargo, 'function _missionCargoPlayAudioCueNow(', 'function _missionCargoFlushAudioCueQueue('), sandbox);
const catalog = vm.runInContext('_PAX_AUDIO_CUE_CATALOG', sandbox);
let scenarios = 0;
for (const itemType of ['cargo', 'passenger']) for (const action of ['load', 'reload', 'unload', 'drop']) {
  if (itemType === 'passenger' && action === 'drop') continue;
  for (const sources of [[], [{ 'cargo.load': false }], [{ cargo: 'boarding_cargo' }]]) {
    const payload = { action, item: { id: 'item', itemType, label: 'Item', pickupLocation: 'departure' } };
    const entry = audio.cueEntry(payload);
    sandbox.sources = sources; call = null;
    await sandbox._missionCargoPlayAudioCueNow(entry.fallback, entry.item, entry.event, entry.gain == null ? {} : { gain: entry.gain });
    const recipe = audio.cueRecipe({ sources, catalog, missionKey: 'mission-test', missionAudioKey: ':audio-test' }, entry);
    assert.equal(recipe?.id || null, call?.id || null);
    if (recipe) {
      assert.equal(recipe.gain, call.options.gain ?? catalog[call.id].gain);
      assert.equal(recipe.variantSeed, `cue-variant-${call.id}:audio-test|${call.options.seed}|${call.id}`);
      const names = cues.audioCueCandidateNames(recipe.id, 8);
      assert.equal(cues.selectAudioCueAsset(recipe, names), names[cues.stableHash(recipe.variantSeed) % names.length]);
    }
    scenarios++;
  }
}
console.log(`PASS ${scenarios} cargo/PAX cue IDs, gains and variant seeds match standalone.`);
