(function(root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.GAPaxAudioStyle = api;
})(typeof window !== 'undefined' ? window : null, function() {
'use strict';
// The standalone signal chain, shared with the selected tracker audio player.
function _buildIntercomChain(ctx, destination, durationSec, options = {}) {
    const withNoise = options.noise !== false;
    // Bandpass: 300 Hz – 3 400 Hz (telephone/intercom range)
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 300; hp.Q.value = 0.7;

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 3400; lp.Q.value = 0.8;

    // Soft saturation — WaveShaper
    const ws = ctx.createWaveShaper();
    const curve = new Float32Array(512);
    const amt = 30;
    for (let i = 0; i < 512; i++) {
        const x = (i * 2) / 512 - 1;
        curve[i] = (Math.PI + amt) * x / (Math.PI + amt * Math.abs(x));
    }
    ws.curve = curve; ws.oversample = '2x';

    // Compressor — limits dynamic range like a real intercom
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18; comp.knee.value = 6;
    comp.ratio.value = 8; comp.attack.value = 0.003; comp.release.value = 0.15;

    // Chain: hp → lp → ws → comp → destination
    hp.connect(lp); lp.connect(ws); ws.connect(comp); comp.connect(destination);
    const nodes = [hp, lp, ws, comp];
    const disconnect = () => nodes.forEach(node => { try { node.disconnect(); } catch (_) {} });
    if (!withNoise) return { input: hp, noise: null, disconnect };

    // Static noise layer
    const noiseLen = Math.ceil(ctx.sampleRate * (durationSec + 0.5));
    const noiseBuf = ctx.createBuffer(1, noiseLen, ctx.sampleRate);
    const nd = noiseBuf.getChannelData(0);
    for (let i = 0; i < noiseLen; i++) nd[i] = (Math.random() * 2 - 1) * 0.018;
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuf;

    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.4;

    // Noise goes through the same bandpass so it sounds like intercom hiss
    noise.connect(hp);
    noise.connect(noiseGain); noiseGain.connect(destination);

    nodes.push(noise, noiseGain);
    return { input: hp, noise, disconnect };
}

return { buildIntercomChain: _buildIntercomChain };
});
