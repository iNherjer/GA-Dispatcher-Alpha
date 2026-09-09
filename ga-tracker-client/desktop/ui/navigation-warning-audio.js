(function(root, factory) {
    var api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.GANavigationWarningAudio = api;
})(typeof window !== 'undefined' ? window : null, function() {
'use strict';
function assetPath(key, pack = '') {
    if (key === 'taws-alert') return 'taws-alert.m4a';
    if (!/^aw-(?:achtung|in|ctr|charlie|delta|rmz|tmz|edr|para|[1-9]min|10min|freq|sqwk|komma|d[0-9]|zwo|wp-erreicht|neuer-kurs|grad|fuer|meilen)$/.test(key)
        || !/^[a-zA-Z0-9_-]*$/.test(pack)) throw new Error('invalid_warning_clip');
    return pack ? `audio-warnings/voices/${pack}/${key}.mp3` : `audio-warnings/${key}.m4a`;
}
// Same two 440->920 Hz sweeps/envelope as the standalone oscillator, encoded
// locally so the shared leased player can pause/resume it like every other clip.
function whoopWav() {
    const rate = 24000, frames = Math.round(1.4 * rate), bytes = new ArrayBuffer(44 + frames * 2), view = new DataView(bytes);
    function ascii(offset, text) { for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i)); }
    ascii(0, 'RIFF'); view.setUint32(4, 36 + frames * 2, true); ascii(8, 'WAVEfmt ');
    view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
    view.setUint32(24, rate, true); view.setUint32(28, rate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
    ascii(36, 'data'); view.setUint32(40, frames * 2, true);
    for (let i = 0; i < frames; i++) {
        const time = i / rate - 0.05, t = time < 0.65 ? time : time - 0.65;
        if (t < 0 || t >= 0.55) continue;
        const gain = t < 0.05 ? 0.85 * t / 0.05 : t <= 0.4 ? 0.85 : 0.85 * (0.55 - t) / 0.15;
        const phase = t <= 0.45 ? 440 * t + 480 / 0.9 * t * t : 306 + 920 * (t - 0.45);
        view.setInt16(44 + 2 * i, Math.round(Math.sin(2 * Math.PI * phase) * gain * 32767), true);
    }
    return bytes;
}
return { assetPath: assetPath, whoopWav: whoopWav };
});
