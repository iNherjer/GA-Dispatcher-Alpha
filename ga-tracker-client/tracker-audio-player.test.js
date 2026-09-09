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
      if (!reachable) throw new Error('offline');
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

// Exercise completion and preparation failures, not just lease acquisition.
function shortAudio() {
  class Context {
    constructor() { this.state = 'running'; this.destination = {}; this.origin = Date.now(); }
    get currentTime() { return (Date.now() - this.origin) / 1000; }
    resume() { throw new Error('running context must not be resumed again'); }
    async close() {}
    decodeAudioData(bytes, resolve) { resolve({ duration: 0.025 }); }
    createGain() { return { gain: {}, connect() {}, disconnect() {} }; }
    createBufferSource() {
      let timer;
      return { connect() {}, disconnect() {}, start() { timer = setTimeout(() => this.onended?.(), 30); },
        stop(when) { if (when == null) { clearTimeout(timer); this.onended?.(); } } };
    }
  }
  return Context;
}
for (const failure of ['cue', 'audio']) test(`stalled ${failure} download releases the queue without waiting for mission timeout`, async t => {
  const commands = [], errors = [], stages = []; let offered = false, cancelled = false;
  const player = createPlayer({ deviceId: 'phone', clientId: 'phone-tab', AudioContext: shortAudio(), preparationTimeoutMs: 40,
    request: async command => {
      commands.push(command);
      if (command.action === 'next') { if (offered) return {}; offered = true; return { job: { effectId: 'boarding', kind: 'boarding', cue: { audioAvailable: true }, audioAvailable: true } }; }
      if (command.action === 'claim') return { claimed: true };
      return { released: true };
    },
    fetchClip: async (_, stage, signal) => {
      stages.push(stage);
      if (stage === failure) { signal.addEventListener('abort', () => { cancelled = true; }); return new Promise(() => {}); }
      return new ArrayBuffer(1);
    }, onError: error => errors.push(error)
  });
  t.after(() => player.stop());
  player.update({ revision: 1, target: { deviceId: 'phone' }, settings: { enabled: true, effectsEnabled: true, paxEnabled: true, volume: 1 }, playback: { notification: 'ready', playbackAvailable: true } });
  await wait(140);
  const release = commands.find(command => command.action === 'release');
  assert.ok(release);
  assert.equal(release.completed, failure === 'cue', 'a failed cue must not suppress the generated voice');
  assert.equal(release.retryable, false);
  assert.equal(cancelled, true);
  assert.deepEqual(stages, ['cue', 'audio']);
  assert.ok(errors.includes(failure + '_download_timeout'));
  assert.equal(player.active, false);
  assert.ok(commands.filter(command => command.action === 'next').length >= 2, 'queue continues after completion or failure');
});

for (const stage of ['audio', 'cue']) test(`audio-thread lease stop preserves a retryable ${stage} cursor`, async t => {
  class ExpiringAudio extends shortAudio() {
    decodeAudioData(_bytes, resolve) { resolve({ duration: 10 }); }
  }
  const commands = []; let offered = false;
  const player = createPlayer({ deviceId: 'phone', clientId: 'phone-tab', AudioContext: ExpiringAudio,
    request: async command => {
      commands.push(command);
      if (command.action === 'next') {
        if (offered) return {}; offered = true;
        return { job: { effectId: 'boarding', kind: 'boarding', audioAvailable: true, cue: stage === 'cue' ? { audioAvailable: true } : null } };
      }
      if (command.action === 'claim') return { claimed: true };
      return { released: true };
    }, fetchClip: async () => new ArrayBuffer(1)
  });
  t.after(() => player.stop());
  player.update({ revision: 1, target: { deviceId: 'phone' },
    settings: { enabled: true, effectsEnabled: true, paxEnabled: true, volume: 1 },
    playback: { notification: 'ready', playbackAvailable: true } });
  await wait(100);
  const release = commands.find(command => command.action === 'release');
  assert.equal(release.error, 'audio_lease_expired');
  assert.equal(release.completed, false);
  assert.equal(release.retryable, true);
  assert.equal(release.position.stage, stage);
  assert.ok(release.position.offset > 0);
});
