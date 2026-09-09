'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const { createTrackerMissionCargoAudio } = require('./tracker-mission-cargo-audio.js');
test('cargo sound queue batches waiting items once, with the standalone gain and seed', async () => {
  const requests = [], releases = [];
  const play = createTrackerMissionCargoAudio({
    authorityManager: { getActiveRun: () => ({ missionId: 'm', runId: 'r', resumeBundle: { executionEffectPlan: { cargoAudio: {
      enabled: true, sources: [], missionKey: 'm', missionAudioKey: ':m', catalog: { cargo_load: { gain: 0.62 }, boarding_cargo: { gain: 0.46 } }
    } } } }) }, getAudioPlaybackCandidates: () => 1,
    voiceService: { request: value => requests.push(value), wait: async () => ({ cue: { audioAvailable: true } }),
      waitForPlayback: () => new Promise(resolve => releases.push(resolve)) }
  });
  const request = id => ({ missionId: 'm', runId: 'r', commandId: `cue-${id}`, effect: { payload: { action: 'load', item: { id, itemType: 'cargo' } } } });
  const first = play(request('a')); const second = play(request('b')); const third = play(request('c'));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(requests.length, 1); assert.equal(requests[0].cue.id, 'cargo_load');
  releases.shift()({ status: 'completed' }); await first;
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(requests.length, 2); assert.equal(requests[1].cue.id, 'boarding_cargo');
  assert.equal(requests[1].cue.gain, 0.46);
  assert.match(requests[1].cue.variantSeed, /load_batch_2_b-c/);
  releases.shift()({ status: 'completed' }); await Promise.all([second, third]);
});

test('PC cargo effects use shared settings even if the source App had effects muted', async () => {
  const requests = [];
  const play = createTrackerMissionCargoAudio({
    authorityManager: { getActiveRun: () => ({ missionId: 'm', runId: 'r', resumeBundle: { executionEffectPlan: { cargoAudio: {
      enabled: false, sources: [], catalog: { cargo_load: { gain: 0.62 } }
    } } } }) }, getAudioSettings: () => ({ enabled: true, effectsEnabled: true }),
    voiceService: { request: value => requests.push(value), wait: async () => ({ cue: { audioAvailable: true } }), waitForPlayback: async () => ({ status: 'completed' }) }
  });
  await play({ missionId: 'm', runId: 'r', commandId: 'cue-pc', effect: { payload: { action: 'load', item: { id: 'box', itemType: 'cargo' } } } });
  assert.equal(requests.length, 1);
  assert.equal(requests[0].cue.gain, 0.62);
});

test('an unclaimed cue is cancelled and releases the following cargo batch without waiting for playback timeout', async () => {
  const requests = [], cancelled = [], claims = [];
  let releaseClaim;
  const play = createTrackerMissionCargoAudio({
    authorityManager: { getActiveRun: () => ({ missionId: 'm', runId: 'r', resumeBundle: { executionEffectPlan: { cargoAudio: {
      enabled: true, catalog: { cargo_load: {}, boarding_cargo: {} }
    } } } }) }, getAudioPlaybackCandidates: () => 1,
    voiceService: {
      request: value => requests.push(value), wait: async () => ({ cue: { audioAvailable: true } }),
      waitForPlaybackClaim: id => { claims.push(id); return claims.length === 1
        ? new Promise(resolve => { releaseClaim = resolve; }) : Promise.resolve({ claimed: true, status: 'completed' }); },
      waitForPlayback: () => { throw Error('must not wait for unclaimed or already completed audio'); },
      cancel: id => cancelled.push(id)
    }
  });
  const request = id => ({ missionId: 'm', runId: 'r', commandId: id, effect: { payload: { action: 'load', item: { id, itemType: 'cargo' } } } });
  const first = play(request('one')); const next = play(request('two'));
  await new Promise(resolve => setImmediate(resolve));
  releaseClaim({ claimed: false, status: 'timeout' });
  await Promise.all([first, next]);
  assert.deepEqual(cancelled, ['one']);
  assert.deepEqual(claims, ['one', 'two']);
  assert.equal(requests.length, 2);
});
