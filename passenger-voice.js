/* === Passenger Voice System (v2) ===
 * Two-step pipeline: Gemini text-gen → display in UI → Gemini TTS → play audio.
 * Events: greeting (engine start), at-target (POI/landing), farewell (debrief).
 * Works in both live and simulation mode.
 *
 * Requires:
 *   window._tawsAudioCtx, window._awmMasterGain  (taws.js)
 *   incrementApiUsage(type)                        (app.js)
 *   window.activePassenger, window.currentMissionData, window.routeWaypoints
 */

// ─── TOGGLE ──────────────────────────────────────────────────────────────────
let _paxVoiceEnabled = (localStorage.getItem('awm_pax_voice') === '1');

window.paxVoiceSetEnabled = function(on) {
    _paxVoiceEnabled = !!on;
    localStorage.setItem('awm_pax_voice', on ? '1' : '0');
};

// ─── PER-MISSION STATE ───────────────────────────────────────────────────────
let _paxGreetingDone  = false;
let _paxAtTargetDone  = false;
let _paxFarewellDone  = false;

window.paxVoiceResetMission = function() {
    _paxGreetingDone = false;
    _paxAtTargetDone = false;
    _paxFarewellDone = false;
};

// ─── INIT ─── called at bottom of file after all defs ───────────────────────

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function _getApiKey() {
    return document.getElementById('apiKeyInput')?.value.trim() || '';
}

function _isPOIMission() {
    if (typeof currentDestICAO !== 'undefined' && currentDestICAO === 'POI') return true;
    return document.getElementById('destRwyContainer')?.style.display === 'none';
}

function _getMissionStory() {
    return document.getElementById('mStory')?.innerText?.trim() || '';
}

function _getDestCoords() {
    const el = document.getElementById('mDestCoords');
    if (!el) return null;
    const parts = el.innerText.split(',').map(s => parseFloat(s.trim()));
    if (parts.length >= 2 && isFinite(parts[0]) && isFinite(parts[1])) return { lat: parts[0], lon: parts[1] };
    return null;
}

// ─── UI ──────────────────────────────────────────────────────────────────────
let _paxPanel = null;
let _paxBtn   = null;
let _lastPaxText = '';

function _injectPaxUI() {
    if (document.getElementById('paxVoiceWidget')) return;

    const widget = document.createElement('div');
    widget.id = 'paxVoiceWidget';
    widget.style.cssText = `
        position: fixed; bottom: 72px; right: 14px; z-index: 50000;
        display: none; flex-direction: column; align-items: flex-end; gap: 8px;
    `;

    // Indicator button
    const btn = document.createElement('button');
    btn.id = 'paxVoiceBtn';
    btn.title = 'Passagier-Nachricht';
    btn.style.cssText = `
        width: 40px; height: 40px; border-radius: 50%; border: none;
        background: #1a3a5c; color: #fff; font-size: 18px; cursor: pointer;
        box-shadow: 0 2px 10px rgba(0,0,0,0.5); transition: transform 0.15s;
        display: flex; align-items: center; justify-content: center;
        position: relative;
    `;
    btn.innerHTML = '🧑‍✈️';
    btn.onclick = () => _togglePaxPanel();

    // New-message badge
    const badge = document.createElement('span');
    badge.id = 'paxVoiceBadge';
    badge.style.cssText = `
        position: absolute; top: -3px; right: -3px; width: 11px; height: 11px;
        background: #4da6ff; border-radius: 50%; display: none;
        border: 2px solid #111;
    `;
    btn.appendChild(badge);

    // Message panel
    const panel = document.createElement('div');
    panel.id = 'paxVoicePanel';
    panel.style.cssText = `
        display: none; background: #0e1e30; border: 1px solid #2a4a6a;
        border-radius: 10px; padding: 12px 14px; max-width: 280px; min-width: 200px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.6); font-size: 13px; line-height: 1.5;
        color: #d0e8ff; position: relative;
    `;

    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '✕';
    closeBtn.style.cssText = `
        position: absolute; top: 6px; right: 8px; background: none; border: none;
        color: #888; cursor: pointer; font-size: 12px; padding: 0;
    `;
    closeBtn.onclick = () => _closePaxPanel();

    const nameEl = document.createElement('div');
    nameEl.id = 'paxVoiceName';
    nameEl.style.cssText = 'font-size: 11px; color: #4da6ff; margin-bottom: 6px; font-weight: bold;';

    const textEl = document.createElement('div');
    textEl.id = 'paxVoiceText';

    panel.appendChild(closeBtn);
    panel.appendChild(nameEl);
    panel.appendChild(textEl);

    widget.appendChild(panel);
    widget.appendChild(btn);
    document.body.appendChild(widget);

    _paxPanel = panel;
    _paxBtn   = btn;
}

function _showPaxMessage(text, eventLabel) {
    const widget = document.getElementById('paxVoiceWidget');
    const panel  = document.getElementById('paxVoicePanel');
    const nameEl = document.getElementById('paxVoiceName');
    const textEl = document.getElementById('paxVoiceText');
    const badge  = document.getElementById('paxVoiceBadge');
    const btn    = document.getElementById('paxVoiceBtn');

    if (!widget) return;
    _lastPaxText = text;

    const pax = window.activePassenger;
    if (nameEl) nameEl.textContent = pax ? `${pax.name} · ${eventLabel}` : eventLabel;
    if (textEl) textEl.textContent = text;

    widget.style.display = 'flex';

    // Auto-open panel on new message
    if (panel) panel.style.display = 'block';
    if (badge) badge.style.display = 'block';
    if (btn) {
        btn.style.transform = 'scale(1.15)';
        setTimeout(() => { if (btn) btn.style.transform = 'scale(1)'; }, 300);
    }

    // Auto-close panel after 18 seconds
    clearTimeout(widget._autoClose);
    widget._autoClose = setTimeout(_closePaxPanel, 18000);
}

function _togglePaxPanel() {
    const panel = document.getElementById('paxVoicePanel');
    const badge = document.getElementById('paxVoiceBadge');
    if (!panel) return;
    const isOpen = panel.style.display !== 'none';
    panel.style.display = isOpen ? 'none' : 'block';
    if (!isOpen && badge) badge.style.display = 'none';
}

function _closePaxPanel() {
    const panel = document.getElementById('paxVoicePanel');
    const badge = document.getElementById('paxVoiceBadge');
    if (panel) panel.style.display = 'none';
    if (badge) badge.style.display = 'none';
}

// ─── TWO-STEP PIPELINE ───────────────────────────────────────────────────────

async function _generateSpokenText(apiKey, situationPrompt) {
    const payload = {
        contents: [{ parts: [{ text: situationPrompt }] }],
        generationConfig: { response_mime_type: 'text/plain' }
    };
    const opts = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) };

    for (const model of ['gemini-2.5-flash', 'gemini-2.5-flash-lite']) {
        try {
            const res = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
                opts
            );
            if (!res.ok) {
                console.warn('[PaxVoice] Textgen', model, 'HTTP', res.status);
                continue;
            }
            const data = await res.json();
            const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
            if (text) {
                if (typeof incrementApiUsage === 'function') incrementApiUsage('flash');
                return text;
            }
            console.warn('[PaxVoice] Textgen', model, 'leere Antwort:', JSON.stringify(data).slice(0, 200));
        } catch(e) { console.warn('[PaxVoice] Textgen', model, 'Fehler:', e.message); }
    }
    return null;
}

function _pcmToWav(pcmBuffer, sampleRate, numChannels, bitDepth) {
    const wav = new ArrayBuffer(44 + pcmBuffer.byteLength);
    const v   = new DataView(wav);
    const str = (off, s) => { for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i)); };
    const bps = sampleRate * numChannels * (bitDepth / 8);
    str(0,  'RIFF'); v.setUint32(4,  36 + pcmBuffer.byteLength, true);
    str(8,  'WAVE'); str(12, 'fmt '); v.setUint32(16, 16, true);
    v.setUint16(20, 1, true);                         // PCM
    v.setUint16(22, numChannels, true);
    v.setUint32(24, sampleRate, true);
    v.setUint32(28, bps, true);
    v.setUint16(32, numChannels * (bitDepth / 8), true);
    v.setUint16(34, bitDepth, true);
    str(36, 'data'); v.setUint32(40, pcmBuffer.byteLength, true);
    new Uint8Array(wav, 44).set(new Uint8Array(pcmBuffer));
    return wav;
}

function _buildIntercomChain(ctx, destination, durationSec) {
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

    // Static noise layer
    const noiseLen = Math.ceil(ctx.sampleRate * (durationSec + 0.5));
    const noiseBuf = ctx.createBuffer(1, noiseLen, ctx.sampleRate);
    const nd = noiseBuf.getChannelData(0);
    for (let i = 0; i < noiseLen; i++) nd[i] = (Math.random() * 2 - 1) * 0.018;
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuf;

    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.4;

    // Chain: hp → lp → ws → comp → destination
    hp.connect(lp); lp.connect(ws); ws.connect(comp); comp.connect(destination);
    // Noise goes through the same bandpass so it sounds like intercom hiss
    noise.connect(hp);
    noise.connect(noiseGain); noiseGain.connect(destination);

    return { input: hp, noise };
}

async function _paxDecodeAndPlay(base64Audio, mimeType) {
    const ctx = window._tawsAudioCtx;
    if (!ctx) { console.warn('[PaxVoice] AudioContext nicht verfügbar'); return; }
    if (ctx.state === 'suspended') await ctx.resume().catch(() => {});

    const binary = atob(base64Audio);
    const bytes  = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

    // Gemini TTS returns raw PCM — wrap in WAV so decodeAudioData can handle it
    let audioBuffer = bytes.buffer;
    if (!mimeType || mimeType.includes('pcm') || mimeType.includes('L16')) {
        const rateMatch = mimeType?.match(/rate=(\d+)/);
        const sampleRate = rateMatch ? parseInt(rateMatch[1]) : 24000;
        console.log('[PaxVoice] PCM → WAV wrap, rate:', sampleRate, 'mimeType:', mimeType);
        audioBuffer = _pcmToWav(bytes.buffer, sampleRate, 1, 16);
    }

    try {
        const buf = await ctx.decodeAudioData(audioBuffer);
        const dest = window._awmMasterGain || ctx.destination;
        const { input, noise } = _buildIntercomChain(ctx, dest, buf.duration);

        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.connect(input);

        const t = ctx.currentTime + 0.1;
        src.start(t);
        noise.start(t);
        noise.stop(t + buf.duration + 0.3);
        console.log('[PaxVoice] Intercom-Wiedergabe, Dauer:', buf.duration.toFixed(1), 's');
    } catch(e) {
        console.warn('[PaxVoice] Playback Fehler:', e);
    }
}

async function _speakAndShow(situationPrompt, eventLabel) {
    const apiKey = _getApiKey();
    if (!apiKey) { console.warn('[PaxVoice] Kein API-Key — bitte im Einstellungen eintragen'); return; }

    console.log('[PaxVoice] Textgenerierung läuft für:', eventLabel);
    const spokenText = await _generateSpokenText(apiKey, situationPrompt);
    if (!spokenText) { console.warn('[PaxVoice] Kein Text von Gemini erhalten (API-Fehler oder leere Antwort)'); return; }
    console.log('[PaxVoice] Text erhalten:', spokenText.slice(0, 80), '...');

    _showPaxMessage(spokenText, eventLabel);

    const pax = window.activePassenger;
    const voiceName = (pax?.gender === 'male') ? 'Charon' : 'Kore';
    const ttsPayload = {
        contents: [{ role: 'user', parts: [{ text: spokenText }] }],
        generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } }
        }
    };

    try {
        const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}`,
            { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(ttsPayload) }
        );
        if (!res.ok) throw new Error(`TTS HTTP ${res.status}`);
        const data     = await res.json();
        const part     = data?.candidates?.[0]?.content?.parts?.[0];
        const b64      = part?.inlineData?.data;
        const mimeType = part?.inlineData?.mimeType || '';
        if (!b64) throw new Error('Keine Audio-Daten');
        console.log('[PaxVoice] TTS mimeType:', mimeType, '| Datengröße:', b64.length);
        if (typeof incrementApiUsage === 'function') incrementApiUsage('flash');
        await _paxDecodeAndPlay(b64, mimeType);
    } catch(e) {
        console.warn('[PaxVoice] TTS Fehler:', e);
    }
}

// ─── PROMPT BUILDERS ─────────────────────────────────────────────────────────

function _baseContext() {
    const pax  = window.activePassenger;
    const md   = (typeof currentMissionData !== 'undefined' ? currentMissionData : null);
    const story = _getMissionStory();
    if (!pax || !md) return null;

    return `Du spielst ${pax.name}, ${pax.role}. Persönlichkeit: ${pax.personality}.
Flug: ${md.start || '?'} → ${md.poiName || md.dest || '?'} (${md.dist || '?'} NM, ${md.ac || 'GA-Flugzeug'}).
${story ? `Missionsauftrag: ${story}` : ''}
Antworte NUR mit dem exakten Text den du sprichst — keine Anführungszeichen, keine Erzählerhinweise, kein Markdown.`;
}

function _greetingPrompt() {
    const ctx = _baseContext();
    const pax = window.activePassenger;
    if (!ctx || !pax) return null;
    return `${ctx}

Situation: Der Motor läuft gerade an / das Flugzeug setzt sich in Bewegung. Du bist soeben eingestiegen.
Begrüße den Piloten herzlich — passend zu deiner Rolle und Mission. Basiere dich auf: "${pax.greetingText}"
Gib kurz an was du dir von diesem Flug erhoffst oder erwartest. Max 2-3 Sätze. Auf Deutsch.`;
}

function _atTargetPrompt(flightData) {
    const ctx = _baseContext();
    const pax = window.activePassenger;
    if (!ctx || !pax) return null;

    const altFt = Math.round(flightData?.mslFt || 0);
    const aglFt = Math.round(flightData?.aglFt || 0);
    const bank  = Math.abs(flightData?.bankDeg || 0).toFixed(1);
    const gf    = (flightData?.gForce || 1.0).toFixed(2);
    const vs    = Math.round(flightData?.vsFpm || 0);
    const isPOI = _isPOIMission();

    const situation = isPOI
        ? `Ihr habt "${currentMissionData?.poiName || 'das Ziel'}" erreicht. Aktuelle Höhe: ${altFt} ft MSL / ${aglFt} ft AGL. Flugneigung: ${bank}°.`
        : `Ihr seid gerade auf ${currentMissionData?.dest || 'dem Zielflugplatz'} gelandet. Sinkrate: ${vs} ft/min.`;

    let comfort = '';
    if (pax.gTolerance === 'niedrig' && parseFloat(gf) > 1.3) comfort += ' Die G-Belastung war für dich spürbar. ';
    if (pax.bankTolerance === 'niedrig' && parseFloat(bank) > 20) comfort += ' Die Kurvenneigung hat dich etwas beschäftigt. ';
    if (isPOI && altFt > 0 && pax.targetAltFt) {
        const diff = altFt - pax.targetAltFt;
        if (Math.abs(diff) > 300) comfort += ` Deine optimale Arbeitshöhe wären ${pax.targetAltFt} ft — aktuell ${diff > 0 ? diff + ' ft zu hoch' : Math.abs(diff) + ' ft zu niedrig'}. `;
    }

    return `${ctx}

Situation: ${situation}${comfort}
Reagiere spontan und in deiner Rolle auf diesen Moment. Kommentiere was du siehst, was du tust oder was jetzt passiert. Max 2-3 Sätze. Auf Deutsch.`;
}

function _farewellPrompt(record) {
    const ctx = _baseContext();
    const pax = window.activePassenger;
    if (!ctx || !pax) return null;

    const min  = Math.round(record.durationSec / 60);
    const td   = record.touchdownVsFpm != null ? `${Math.abs(record.touchdownVsFpm)} ft/min` : 'unbekannt';
    const bank = (record.maxBankDeg || 0).toFixed(1);
    const maxG = (record.maxGForce  || 1.0).toFixed(2);
    const avgG = (record.avgGForce  || 1.0).toFixed(2);

    let assessment = '';
    if (pax.gTolerance === 'niedrig' && (record.maxGForce || 1) > 1.5) assessment += ' Die G-Belastung war zu hoch für meinen Geschmack. ';
    if (pax.bankTolerance === 'niedrig' && (record.maxBankDeg || 0) > 30) assessment += ' Die Kurvenlagen haben mich Überwindung gekostet. ';
    if (record.touchdownVsFpm && Math.abs(record.touchdownVsFpm) < 200) assessment += ' Die Landung war ausgesprochen sanft. ';
    if (record.touchdownVsFpm && Math.abs(record.touchdownVsFpm) > 500) assessment += ' Die Landung war etwas hart. ';

    return `${ctx}

Situation: Der Flug ist beendet. Fakten:
• Dauer: ${min} min, ${record.distanceNm} NM, Max-Höhe: ${record.maxAltFt} ft
• Landung: ${td} Sinkrate | Max Neigung: ${bank}° | Max G: ${maxG}g | Ø G: ${avgG}g
${assessment}
Verabschiede dich beim Piloten und gib ein ehrliches, persönliches Fazit über den Flug — aus deiner Perspektive als ${pax.role}. Max 3 Sätze. Auf Deutsch.`;
}

// ─── PUBLIC TRIGGERS ─────────────────────────────────────────────────────────

window.triggerPaxGreeting = async function() {
    console.log('[PaxVoice] triggerPaxGreeting aufgerufen | enabled:', _paxVoiceEnabled, '| done:', _paxGreetingDone, '| pax:', !!window.activePassenger, '| apiKey:', !!_getApiKey());
    if (!_paxVoiceEnabled || _paxGreetingDone || !window.activePassenger) return;
    _paxGreetingDone = true;
    const prompt = _greetingPrompt();
    if (!prompt) { _paxGreetingDone = false; console.warn('[PaxVoice] Greeting: kein Prompt (Mission-Daten fehlen?)'); return; }
    console.log('[PaxVoice] Greeting → API-Call gestartet');
    await _speakAndShow(prompt, 'Begrüßung');
};

window.triggerPaxAtTarget = async function(flightData) {
    console.log('[PaxVoice] triggerPaxAtTarget aufgerufen | enabled:', _paxVoiceEnabled, '| done:', _paxAtTargetDone, '| pax:', !!window.activePassenger, '| flightData:', JSON.stringify(flightData));
    if (!_paxVoiceEnabled || _paxAtTargetDone || !window.activePassenger) return;
    _paxAtTargetDone = true;
    const prompt = _atTargetPrompt(flightData);
    if (!prompt) { _paxAtTargetDone = false; console.warn('[PaxVoice] AtTarget: kein Prompt'); return; }
    console.log('[PaxVoice] At-Target → API-Call in 2s');
    setTimeout(() => _speakAndShow(prompt, _isPOIMission() ? 'Am Ziel' : 'Landung'), 2000);
};

window.triggerPaxFarewell = async function(record) {
    console.log('[PaxVoice] triggerPaxFarewell aufgerufen | enabled:', _paxVoiceEnabled, '| done:', _paxFarewellDone, '| pax:', !!window.activePassenger);
    if (!_paxVoiceEnabled || _paxFarewellDone || !window.activePassenger) return;
    _paxFarewellDone = true;
    const prompt = _farewellPrompt(record);
    if (!prompt) { _paxFarewellDone = false; console.warn('[PaxVoice] Farewell: kein Prompt'); return; }
    console.log('[PaxVoice] Farewell → API-Call in 3s');
    setTimeout(() => _speakAndShow(prompt, 'Verabschiedung'), 3000);
};

// Called each GPS tick from sync.js + sim-route.js — POI proximity check
window.checkPaxPoiProximity = function(lat, lon, flightData) {
    if (!_paxVoiceEnabled || _paxAtTargetDone || !window.activePassenger) return;
    if (!_isPOIMission()) return;

    // Use actual dest coords from DOM (reliable for both live and sim)
    const dest = _getDestCoords();
    if (!dest) return;

    const dLat  = (dest.lat - lat) * Math.PI / 180;
    const dLonR = (dest.lon - lon) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2
            + Math.cos(lat * Math.PI / 180) * Math.cos(dest.lat * Math.PI / 180) * Math.sin(dLonR / 2) ** 2;
    const distNm = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 3440.065;

    const radius = window.activePassenger.targetRadiusNm || 1.5;
    if (distNm <= radius) {
        console.log(`[PaxVoice] POI in Reichweite: ${distNm.toFixed(2)} NM`);
        window.triggerPaxAtTarget(flightData);
    }
};

// ─── BOOT ─────────────────────────────────────────────────────────────────────
// All function declarations above are now defined — safe to init
(function() {
    const chk = document.getElementById('awmPaxVoiceCheck');
    if (chk) chk.checked = _paxVoiceEnabled;

    if (!window.activePassenger) {
        const saved = localStorage.getItem('ga_active_passenger');
        if (saved) try { window.activePassenger = JSON.parse(saved); } catch(e) {}
    }

    _injectPaxUI();
    console.log('[PaxVoice] System bereit.');
}());
