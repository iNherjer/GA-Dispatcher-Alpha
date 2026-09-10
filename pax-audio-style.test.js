'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { createPlayer } = require('./ga-tracker-client/tracker-audio-player');
for (const style of ['clear','intercom','intercom_noise']) test(`selected player applies standalone ${style} chain only to speech and cleans it up`, async t => {
  const nodes = [], errors = []; let offered = false, released;
  function node(kind, values = {}) {
    const n = { kind, connections: [], connect(target) { this.connections.push(target); }, disconnect() { this.disconnected = true; }, ...values };
    nodes.push(n); return n;
  }
  class Context {
    constructor() { this.state = 'running'; this.sampleRate = 1000; this.destination = {}; this.currentTime = 0; }
    async close() {}
    decodeAudioData(bytes, resolve) { resolve({ duration: .03 }); }
    createGain() { return node('gain', { gain: {} }); }
    createBiquadFilter() { return node('filter', { frequency: {}, Q: {} }); }
    createWaveShaper() { return node('shaper'); }
    createDynamicsCompressor() { return node('compressor', { threshold: {}, knee: {}, ratio: {}, attack: {}, release: {} }); }
    createBuffer(channels, length) { return { noise: true, getChannelData: () => new Float32Array(length) }; }
    createBufferSource() {
      return node('source', { start() { this.started = true; if (!this.buffer.noise) this.timer = setTimeout(() => { this.ctx.currentTime += .03; this.onended?.(); }, 30); },
        stop(at) { this.stopAt = at; if (at == null) { clearTimeout(this.timer); this.stopped = true; this.onended?.(); } }, ctx: this });
    }
  }
  const done = new Promise(resolve => { released = resolve; });
  const player = createPlayer({ deviceId: 'phone', clientId: 'tab', AudioContext: Context,
    fetchClip: async () => new ArrayBuffer(1), onError: error => errors.push(error),
    request: async request => {
      if (request.action === 'next') { if (offered) return {}; offered = true; return { job: { effectId: 'speech', kind: 'boarding', audioAvailable: true, cue: { audioAvailable: true } } }; }
      if (request.action === 'claim') return { claimed: true };
      if (request.action === 'release') { released(request); return { released: true }; }
      return { continued: true };
    } });
  t.after(() => player.stop());
  player.update({ revision: 1, target: { deviceId: 'phone' }, settings: { enabled: true, volume: .6, paxEnabled: true, effectsEnabled: true, audioStyle: style }, playback: { playbackAvailable: true } });
  const result = await done;
  assert.equal(result.completed, true); assert.deepEqual(errors, []);
  const filters = nodes.filter(n => n.kind === 'filter');
  assert.equal(filters.length, style === 'clear' ? 0 : 2, 'cue is always unfiltered');
  if (filters.length) {
    assert.deepEqual(filters.map(n => [n.type,n.frequency.value,n.Q.value]), [['highpass',300,.7],['lowpass',3400,.8]]);
    assert.equal(nodes.find(n => n.kind === 'shaper').curve.length, 512);
    assert.equal(nodes.find(n => n.kind === 'compressor').ratio.value, 8);
    assert.ok(filters.every(n => n.disconnected));
  }
  const noise = nodes.find(n => n.buffer?.noise);
  assert.equal(!!noise, style === 'intercom_noise');
  if (noise) { assert.equal(noise.started, true); assert.equal(noise.stopped, true); assert.equal(noise.disconnected, true); }
});
