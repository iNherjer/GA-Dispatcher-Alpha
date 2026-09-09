'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { createPlayer } = require('./tracker-audio-player');
const { createAudioControl } = require('./tracker-audio-control-core');
const { createTrackerVoiceService } = require('./tracker-voice-service');
const { handleVoiceRelay } = require('./tracker-voice-relay-core');
const sleep = ms => new Promise(r => setTimeout(r, ms));
function audio() {
  const starts = [], live = new Set();
  class Context {
    constructor() { this.origin = Date.now(); this.state = 'running'; this.destination = {}; }
    get currentTime() { return (Date.now() - this.origin) / 1000; }
    async close() {} async resume() {}
    decodeAudioData(bytes, resolve) { resolve({ duration: .12, label: bytes.label }); }
    createGain() { return { gain: {}, connect() {}, disconnect() {} }; }
    createBufferSource() {
      const ctx = this; let timer, lease;
      const source = { connect() {}, disconnect() {}, start(_when, offset) {
        assert.equal(live.size, 0, 'warning must never overlap voice/another device'); live.add(source);
        starts.push({ label: source.buffer.label, offset }); timer = setTimeout(() => source.stop(), Math.max(0, 120 - offset * 1000));
      }, stop(at) {
        clearTimeout(lease);
        if (at != null) { lease = setTimeout(() => source.stop(), (at - ctx.currentTime) * 1000); return; }
        clearTimeout(timer); live.delete(source); source.onended?.();
      } };
      return source;
    }
  }
  return { Context, starts, live };
}
test('warning sequence is local, queued, interrupted by passenger voice, and then resumed', async t => {
  const control = createAudioControl(), fake = audio(), calls = [];
  const service = createTrackerVoiceService({ audioControl: control, provider: 'openai', apiKey: 'test',
    fetchRemote: async () => new Response(new Uint8Array([1]), { headers: { 'content-type': 'audio/mpeg' } }) });
  service.enqueueWarning({ effectId: 'warning-1', kind: 'airspace', text: 'CTR', clips: ['aw-achtung','aw-ctr','aw-in'] });
  const player = createPlayer({ deviceId: 'pc', clientId: 'pc-tab', AudioContext: fake.Context,
    request: async command => { calls.push(command); return handleVoiceRelay(service, command, control); },
    fetchClip: async (job, stage) => { const bytes = new ArrayBuffer(1); bytes.label = job.effectId + ':' + stage; return bytes; } });
  t.after(async () => { await player.stop(); control.close(); });
  const update = () => player.update({ ...control.snapshot(), playback: service.publicState() });
  update(); await sleep(30); assert.equal(fake.starts.length, 1);
  service.request({ effectId: 'voice-1', text: 'Hallo' }); await service.wait('voice-1');
  update(); await sleep(700);
  const labels = fake.starts.map(s => s.label);
  assert.deepEqual(labels, ['warning-1:warning:0','voice-1:audio','warning-1:warning:0','warning-1:warning:1','warning-1:warning:2']);
  assert.ok(fake.starts[2].offset > 0, 'interrupted warning resumes at saved position');
  assert.ok(!calls.some(c => c.action === 'audio' || c.action === 'cue'), 'no warning bytes go through the relay');
  assert.equal(service.get('warning-1').playback.status, 'completed');
});
test('warnings need no TTS key, obey category/target, expire and never jump ahead of voice', () => {
  let now = 10000;
  const control = createAudioControl(), service = createTrackerVoiceService({ audioControl: control, now: () => now });
  service.enqueueWarning({ effectId: 'warning-1', kind: 'airspace', text: 'CTR', clips: ['aw-ctr'], expiresAt: 12000 });
  service.request({ effectId: 'cargo-1', kind: 'cargo', cue: { id: 'cargo_load' } });
  assert.equal(service.getNextPlayback('tab', 'pc').effectId, 'cargo-1');
  assert.equal(service.getNextPlayback('phone', 'phone'), null);
  now = 13000;
  assert.equal(service.claimPlayback({ effectId: 'warning-1', clientId: 'tab', deviceId: 'pc' }).reason, 'expired');
  control.update({ expectedRevision: 0, settings: { terrain: false } });
  service.enqueueWarning({ effectId: 'warning-2', kind: 'terrain', text: 'Terrain', clips: ['taws-whoop','taws-alert'] });
  assert.equal(service.claimPlayback({ effectId: 'warning-2', clientId: 'tab', deviceId: 'pc' }).reason, 'audio_device_not_selected');
  control.close();
});
