'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createPlayer } = require('./tracker-audio-player');
const { createAudioControl } = require('./tracker-audio-control-core');
const { createTrackerVoiceService } = require('./tracker-voice-service');
const { handleVoiceRelay } = require('./tracker-voice-relay-core');

function fakeAudio() {
  const running = new Set(), starts = [];
  class Context {
    constructor() { this.origin = Date.now(); this.state = 'running'; this.destination = {}; this.sinkId = ''; }
    get currentTime() { return (Date.now() - this.origin) / 1000; }
    async resume() {} async close() {} async setSinkId(id) { this.sinkId = id; }
    decodeAudioData(_bytes, resolve) { resolve({ duration: 10 }); }
    createGain() { return { gain: {}, connect() {}, disconnect() {} }; }
    createBufferSource() {
      const ctx = this; let timer;
      const source = { connect() {}, disconnect() {}, start(_when, offset) {
        starts.push(offset); running.add(source);
        assert.ok(running.size <= 1, 'two outputs must never play simultaneously');
      }, stop(when) {
        clearTimeout(timer);
        if (when != null) { timer = setTimeout(() => source.stop(), Math.max(0, (when - ctx.currentTime) * 1000)); return; }
        running.delete(source); if (source.onended) source.onended();
      } };
      return source;
    }
  }
  return { Context, running, starts };
}
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
test('PC to App switch stops the old output and resumes the same effect at its position', async t => {
  const audioControl = createAudioControl();
  const service = createTrackerVoiceService({ audioControl });
  const job = service.request({ effectId: 'cargo:switch', kind: 'cargo', cue: { id: 'cargo_load' } });
  assert.equal(job.status, 'ready');
  const fake = fakeAudio();
  const calls = [];
  function player(deviceId) { return createPlayer({ deviceId, clientId: deviceId + '-session', AudioContext: fake.Context,
    request: async command => { calls.push(command); return handleVoiceRelay(service, command, audioControl); },
    fetchClip: async () => new ArrayBuffer(1) }); }
  const pc = player('pc'), phone = player('phone');
  t.after(async () => { await pc.stop(); await phone.stop(); audioControl.close(); });
  const snapshot = () => ({ ...audioControl.snapshot(), playback: service.publicState() });
  pc.update(snapshot()); phone.update(snapshot());
  await wait(50); assert.equal(fake.running.size, 1);
  audioControl.update({ expectedRevision: 0, target: { mode: 'app', deviceId: 'phone' } });
  pc.update(snapshot()); phone.update(snapshot());
  await wait(20); phone.update(snapshot()); await wait(30);
  assert.equal(fake.running.size, 1);
  assert.equal(service.get('cargo:switch').playback.ownerClientId, 'phone-session');
  assert.equal(fake.starts.length, 2);
  assert.ok(fake.starts[1] > 0, 'resume must preserve progress');
  assert.equal(calls.filter(command => command.action === 'release' && command.deviceSwitch).length, 1);
});
test('an unreachable tracker stops audio before the lease can move to another output', async t => {
  const fake = fakeAudio(); let reachable = true;
  const pc = createPlayer({ deviceId: 'pc', clientId: 'pc-session', AudioContext: fake.Context,
    request: async command => {
      if (!reachable && command.action === 'renew') throw new Error('offline');
      if (command.action === 'next') return { job: { effectId: 'voice', audioAvailable: true } };
      if (command.action === 'claim') return { claimed: true };
      return { released: true };
    }, fetchClip: async () => new ArrayBuffer(1) });
  t.after(() => pc.stop());
  pc.update({ revision: 1, target: { deviceId: 'pc' }, settings: { enabled: true, paxEnabled: true, volume: 1 }, playback: { notification: 'ready', playbackAvailable: true } });
  await wait(30); reachable = false;
  assert.equal(fake.running.size, 1);
  await wait(4100);
  assert.equal(fake.running.size, 0);
});
test('unselected devices cannot claim jobs; expired owners cannot renew', () => {
  let now = 100;
  const audioControl = createAudioControl();
  const service = createTrackerVoiceService({ audioControl, now: () => now });
  service.request({ effectId: 'cargo:lease', kind: 'cargo', cue: { id: 'cargo_load' } });
  assert.equal(service.getNextPlayback('phone-tab', 'phone'), null);
  assert.equal(service.claimPlayback({ effectId: 'cargo:lease', clientId: 'phone-tab', deviceId: 'phone' }).claimed, false);
  assert.equal(service.claimPlayback({ effectId: 'cargo:lease', clientId: 'pc-tab', deviceId: 'pc', leaseMs: 5000 }).claimed, true);
  now = 5200;
  assert.equal(service.renewPlayback({ effectId: 'cargo:lease', clientId: 'pc-tab', deviceId: 'pc' }).continued, false);
});
