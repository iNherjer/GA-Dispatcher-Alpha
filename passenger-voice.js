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

// ─── LOG ─────────────────────────────────────────────────────────────────────
const _paxLogEntries = [];
const _PAX_LOG_MAX   = 120;

// type: 'event' | 'send' | 'recv' | 'audio' | 'warn' | 'state'
function _paxLog(msg, type = 'event') {
    const ts = new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    _paxLogEntries.unshift({ ts, msg, type });
    if (_paxLogEntries.length > _PAX_LOG_MAX) _paxLogEntries.length = _PAX_LOG_MAX;
    console.log(`[PaxVoice] ${msg}`);
    _paxLogRender();
}

function _paxLogRender() {
    const el = document.getElementById('paxLogBody');
    if (!el) return;
    const PREFIX = { event: '▶', send: '↑ SEND', recv: '↓ RECV', audio: '🔊', warn: '⚠', state: '·' };
    el.textContent = _paxLogEntries.map(e => `${e.ts}  ${(PREFIX[e.type] || '·').padEnd(6)}  ${e.msg}`).join('\n');
}

window.paxVoiceClearLog = function() { _paxLogEntries.length = 0; _paxLogRender(); };
window.paxVoiceOpenLog  = function() {
    const p = document.getElementById('paxLogPanel');
    if (!p) return;
    p.style.display = p.style.display === 'none' ? 'flex' : 'none';
    const lbl = document.getElementById('paxLogModeLabel');
    if (lbl) lbl.textContent = _paxStrictMode ? 'STRENG' : 'EASY';
    _paxLogRender();
};

// ─── MAP ZONES ────────────────────────────────────────────────────────────────
let _paxZonesLayer   = null;
let _paxZonesVisible = false;

window.paxVoiceToggleZones = function() {
    _paxZonesVisible = !_paxZonesVisible;
    const btn = document.getElementById('btnPaxZones');
    if (btn) btn.textContent = _paxZonesVisible ? 'Pax Zonen Ein' : 'Pax Zonen Aus';
    if (_paxZonesVisible) { _paxDrawZones(); }
    else if (_paxZonesLayer && typeof map !== 'undefined') { map.removeLayer(_paxZonesLayer); _paxZonesLayer = null; }
};

window.paxVoiceRefreshZones = function() { if (_paxZonesVisible) _paxDrawZones(); };

function _paxDrawZones() {
    if (typeof map === 'undefined' || !map || typeof L === 'undefined') return;
    if (_paxZonesLayer) map.removeLayer(_paxZonesLayer);
    _paxZonesLayer = L.layerGroup();

    const pax = window.activePassenger;
    const NM  = 1852; // metres per NM

    if (_isPOIMission()) {
        const dest = _getDestCoords();
        if (dest && pax) {
            const r = (pax.targetRadiusNm || 1.5) * NM;
            const label = `POI-Radius: ${pax.targetRadiusNm || 1.5} NM`
                + (pax.targetAltFt  ? ` · ${pax.targetAltFt} ft`  : '')
                + (pax.targetDwellMin ? ` · ${pax.targetDwellMin} min` : ' · Überflug');
            L.circle([dest.lat, dest.lon], { radius: r, color: '#4da6ff', weight: 2, opacity: 0.9,
                fillColor: '#4da6ff', fillOpacity: 0.08, dashArray: '10,7' })
             .bindTooltip(label, { permanent: false }).addTo(_paxZonesLayer);
            // Altitude ring label at centre
            if (pax.targetAltFt) {
                L.marker([dest.lat, dest.lon], { icon: L.divIcon({
                    className: '', html: `<div style="background:rgba(10,20,40,0.75);color:#4da6ff;font-size:11px;padding:2px 6px;border-radius:4px;white-space:nowrap;border:1px solid #2a5a9a;">${pax.targetAltFt} ft · ${pax.targetDwellMin || 0} min</div>`,
                    iconAnchor: [40, 0]
                }), interactive: false }).addTo(_paxZonesLayer);
            }
        }
    } else {
        // Airport approach ring
        const wps = (typeof routeWaypoints !== 'undefined') ? routeWaypoints : null;
        if (wps && wps.length >= 2) {
            const last = wps[wps.length - 1];
            L.circle([last.lat, last.lng ?? last.lon], { radius: 1.5 * NM, color: '#ffa040', weight: 2,
                opacity: 0.9, fillColor: '#ffa040', fillOpacity: 0.08, dashArray: '10,7' })
             .bindTooltip('At-Target: 1.5 NM vor Landung').addTo(_paxZonesLayer);
        }
    }
    _paxZonesLayer.addTo(map);
}

// ─── TOGGLE ──────────────────────────────────────────────────────────────────
let _paxVoiceEnabled = (localStorage.getItem('awm_pax_voice') === '1');

window.paxVoiceSetEnabled = function(on) {
    _paxVoiceEnabled = !!on;
    localStorage.setItem('awm_pax_voice', on ? '1' : '0');
};

// ─── PER-MISSION STATE ───────────────────────────────────────────────────────
let _paxGreetingDone  = false;
let _paxAtTargetDone  = false;  // airport at-target done
let _paxFarewellDone  = false;

// POI dwell state machine
let _poiInRadius        = false;
let _poiEnteredAt       = null;
let _poiLastTickTime    = null;
let _poiDwellSec        = 0;
let _poiAttempts        = 0;
let _poiLastComplaintAt = null;
let _poiAltWasOk        = null;  // null=unknown, true/false
let _poiSatisfied       = false;
let _poiAborted         = false;
let _poiEntryDone       = false; // entry comment fired once on radius entry

window.paxVoiceResetMission = function() {
    _paxGreetingDone  = false;
    _paxAtTargetDone  = false;
    _paxFarewellDone  = false;
    _poiInRadius      = false;
    _poiEnteredAt     = null;
    _poiLastTickTime  = null;
    _poiDwellSec      = 0;
    _poiAttempts      = 0;
    _poiLastComplaintAt = null;
    _poiAltWasOk      = null;
    _poiSatisfied     = false;
    _poiAborted       = false;
    _poiEntryDone     = false;
};

// ─── STRICT / EASY MODE ──────────────────────────────────────────────────────
let _paxStrictMode = (localStorage.getItem('awm_pax_strict') === '1');

window.paxVoiceSetMode = function(strict) {
    _paxStrictMode = !!strict;
    localStorage.setItem('awm_pax_strict', strict ? '1' : '0');
    const el = document.getElementById('awmPaxModeSelect');
    if (el) el.value = strict ? 'strict' : 'easy';
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
    // click handled by _initPaxWidgetDrag (drag-aware)

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

    _initPaxWidgetDrag(widget, btn);
}

function _initPaxWidgetDrag(widget, btn) {
    const STORAGE_KEY = 'ga_pax_widget_pos';

    function applyPos(top, left) {
        widget.style.top    = top + 'px';
        widget.style.left   = left + 'px';
        widget.style.bottom = 'auto';
        widget.style.right  = 'auto';
    }

    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
        try {
            const { top, left } = JSON.parse(saved);
            widget.style.top    = top;
            widget.style.left   = left;
            widget.style.bottom = 'auto';
            widget.style.right  = 'auto';
        } catch(e) {}
    }

    let _dragging = false, _startX, _startY, _startLeft, _startTop;

    btn.addEventListener('pointerdown', e => {
        const rect = widget.getBoundingClientRect();
        _startX    = e.clientX;
        _startY    = e.clientY;
        _startLeft = rect.left;
        _startTop  = rect.top;
        _dragging  = false;
        btn.setPointerCapture(e.pointerId);
    }, { passive: true });

    btn.addEventListener('pointermove', e => {
        if (!btn.hasPointerCapture(e.pointerId)) return;
        const dx = e.clientX - _startX;
        const dy = e.clientY - _startY;
        if (!_dragging && Math.sqrt(dx * dx + dy * dy) < 6) return;
        _dragging = true;
        const w = widget.offsetWidth  || 48;
        const h = widget.offsetHeight || 48;
        applyPos(
            Math.max(0, Math.min(window.innerHeight - h, _startTop  + dy)),
            Math.max(0, Math.min(window.innerWidth  - w, _startLeft + dx))
        );
    });

    btn.addEventListener('pointerup', e => {
        btn.releasePointerCapture(e.pointerId);
        if (_dragging) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ top: widget.style.top, left: widget.style.left }));
            _dragging = false;
            e.stopImmediatePropagation();
        }
    });

    // Override click to ignore drag-end
    btn.addEventListener('click', e => {
        if (_dragging) { e.stopImmediatePropagation(); return; }
        _togglePaxPanel();
    }, true);
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

    // Auto-open panel only in text-only mode (voice off)
    if (panel && !_paxVoiceEnabled) panel.style.display = 'block';
    if (badge) badge.style.display = 'block';
    if (btn) {
        btn.classList.add('pax-has-new');
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
    const btn   = document.getElementById('paxVoiceBtn');
    if (!panel) return;
    const isOpen = panel.style.display !== 'none';
    panel.style.display = isOpen ? 'none' : 'block';
    if (!isOpen) {
        if (badge) badge.style.display = 'none';
        if (btn) btn.classList.remove('pax-has-new');
    }
}

function _closePaxPanel() {
    const panel = document.getElementById('paxVoicePanel');
    const badge = document.getElementById('paxVoiceBadge');
    const btn   = document.getElementById('paxVoiceBtn');
    if (panel) panel.style.display = 'none';
    if (badge) badge.style.display = 'none';
    if (btn) btn.classList.remove('pax-has-new');
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
            _paxLog(`Textgen → ${model}`, 'send');
            const res = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
                opts
            );
            if (!res.ok) {
                _paxLog(`Textgen ${model} HTTP ${res.status}`, 'warn');
                continue;
            }
            const data = await res.json();
            const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
            if (text) {
                if (typeof incrementApiUsage === 'function') incrementApiUsage('flash');
                _paxLog(`Textgen OK (${text.length} Zeichen): "${text.slice(0, 80)}${text.length > 80 ? '…' : ''}"`, 'recv');
                return text;
            }
            _paxLog(`Textgen ${model} leere Antwort: ${JSON.stringify(data).slice(0, 120)}`, 'warn');
        } catch(e) { _paxLog(`Textgen ${model} Fehler: ${e.message}`, 'warn'); }
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
    if (!ctx) { _paxLog('AudioContext nicht verfügbar', 'warn'); return; }
    if (ctx.state === 'suspended') await ctx.resume().catch(() => {});

    const binary = atob(base64Audio);
    const bytes  = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

    let audioBuffer = bytes.buffer;
    if (!mimeType || mimeType.includes('pcm') || mimeType.includes('L16')) {
        const rateMatch = mimeType?.match(/rate=(\d+)/);
        const sampleRate = rateMatch ? parseInt(rateMatch[1]) : 24000;
        _paxLog(`PCM→WAV wrap | rate: ${sampleRate} Hz | mime: ${mimeType || 'unbekannt'}`, 'audio');
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
        _paxLog(`Intercom-Wiedergabe: ${buf.duration.toFixed(1)} s`, 'audio');
    } catch(e) {
        _paxLog(`Playback Fehler: ${e.message}`, 'warn');
    }
}

async function _speakAndShow(situationPrompt, eventLabel) {
    const apiKey = _getApiKey();
    if (!apiKey) { _paxLog('Kein API-Key', 'warn'); return; }

    _paxLog(`── ${eventLabel} ──`, 'event');
    _paxLog(`PROMPT: ${situationPrompt.replace(/\n+/g, ' ').slice(0, 200)}…`, 'send');
    const spokenText = await _generateSpokenText(apiKey, situationPrompt);
    if (!spokenText) { _paxLog('Kein Text von Gemini (API-Fehler oder leere Antwort)', 'warn'); return; }

    _showPaxMessage(spokenText, eventLabel);

    if (!_paxVoiceEnabled) {
        _paxLog('TTS übersprungen (Stimme deaktiviert)', 'state');
        return;
    }

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
        _paxLog(`TTS OK | mime: ${mimeType} | ${b64.length} chars base64`, 'recv');
        if (typeof incrementApiUsage === 'function') incrementApiUsage('flash');
        await _paxDecodeAndPlay(b64, mimeType);
    } catch(e) {
        _paxLog(`TTS Fehler: ${e.message}`, 'warn');
    }
}

// ─── PROMPT BUILDERS ─────────────────────────────────────────────────────────

function _baseContext() {
    const pax  = window.activePassenger;
    const md   = (typeof currentMissionData !== 'undefined' ? currentMissionData : null);
    const story = _getMissionStory();
    if (!pax || !md) return null;

    return `Du bist ${pax.name}, ${pax.role}. Persönlichkeit: ${pax.personality}.
Flug: ${md.start || '?'} → ${md.poiName || md.dest || '?'} (${md.dist || '?'} NM, ${md.ac || 'GA-Flugzeug'}).
${story ? `Auftrag: ${story}` : ''}
Antworte NUR mit dem exakten gesprochenen Text — keine Anführungszeichen, keine Regieanweisungen, kein Markdown.`;
}

function _poiEntryPrompt(flightData) {
    const ctx = _baseContext();
    const pax = window.activePassenger;
    if (!ctx || !pax) return null;
    const md    = (typeof currentMissionData !== 'undefined' ? currentMissionData : null);
    const altFt = Math.round(flightData?.mslFt || 0);
    const wx    = _weatherContext(flightData);
    const noReqs = !pax.targetAltFt && !pax.targetDwellMin;
    const reqHint = noReqs ? '' : ` Erinnere kurz an deine Anforderungen: ${pax.targetAltFt ? pax.targetAltFt + ' ft' : 'Höhe egal'}${pax.targetDwellMin ? ', ca. ' + pax.targetDwellMin + ' min' : ''}.`;
    return `${ctx}

Moment: Das Zielgebiet "${md?.poiName || 'Ziel'}" taucht gerade vor uns auf — wir sind auf ${altFt} ft.${wx ? ' ' + wx : ''}
Du siehst es zum ersten Mal aus der Luft. Zeig dem Piloten spontan was du erkennst.${reqHint}
1-2 Sätze, darf etwas begeisterter sein als sonst.${_TONE}`;
}

function _poiAltComplaintPrompt(flightData, altFt, targetAlt, attempt) {
    const ctx = _baseContext();
    const pax = window.activePassenger;
    if (!ctx || !pax) return null;
    const diff = altFt - targetAlt;
    const dir  = diff < 0 ? `${Math.abs(Math.round(diff))} ft zu niedrig` : `${Math.round(diff)} ft zu hoch`;
    const md   = (typeof currentMissionData !== 'undefined' ? currentMissionData : null);
    const isLast = attempt >= (_paxStrictMode ? 2 : 3);
    const wx = _weatherContext(flightData);
    return `${ctx}

Moment: Wir sind am Ziel "${md?.poiName || 'Ziel'}", aber die Höhe passt noch nicht.
Aktuell: ${altFt} ft (${dir} von meinen benötigten ${targetAlt} ft).${wx ? ' ' + wx : ''}${isLast ? ' Das ist mein letzter Versuch — danach müssen wir leider aufgeben.' : ''}
Bitte den Piloten freundlich aber klar, die Höhe anzupassen. 1-2 Sätze.${_TONE}`;
}

function _poiAltCorrectedPrompt(flightData) {
    const ctx = _baseContext();
    if (!ctx) return null;
    const altFt = Math.round(flightData?.mslFt || 0);
    return `${ctx}

Moment: Höhe passt jetzt — wir sind auf ${altFt} ft im Zielgebiet. Sag dem Piloten kurz, dass es jetzt stimmt und du anfangen kannst. 1 Satz.${_TONE}`;
}

function _poiSatisfiedPrompt(flightData) {
    const ctx = _baseContext();
    const pax = window.activePassenger;
    if (!ctx || !pax) return null;
    const dwell = Math.round(_poiDwellSec / 60 * 10) / 10;
    const wx = _weatherContext(flightData);
    return `${ctx}

Moment: Ich bin fertig am Ziel (${dwell} Minuten).${wx ? ' ' + wx : ''}
Sag dem Piloten kurz, dass du fertig bist und wir weiterfliegen können. 1-2 Sätze.${_TONE}`;
}

function _poiAbortPrompt(flightData) {
    const ctx = _baseContext();
    const pax = window.activePassenger;
    if (!ctx || !pax) return null;
    const wx = _weatherContext(flightData);
    return `${ctx}

Moment: Trotz mehrfacher Bitte war die Höhe nicht erreichbar — ich kann unter diesen Bedingungen nicht arbeiten.${wx ? ' ' + wx : ''}
Erkläre dem Piloten verständnisvoll, dass wir die Mission abbrechen und zurückfliegen müssen. Kein Vorwurf — manchmal passt es einfach nicht. 2 Sätze.${_TONE}`;
}

// Shared tone instruction appended to every prompt
const _TONE = `
Sprich den Piloten direkt an (per Du, kein Erzähler-Stil). Ton: persönlich, warmherzig und grundsätzlich positiv — auch wenn etwas nicht ideal läuft, bleib konstruktiv und ermutigend. Ich-Form. Auf Deutsch.`;

function _weatherContext(fd) {
    if (!fd) return '';
    const parts = [];
    if (fd.windKts != null) {
        const desc = fd.windKts > 20 ? ' (kräftig)' : fd.windKts > 10 ? ' (mäßig)' : ' (schwach)';
        parts.push(`Wind ${fd.windKts} kts aus ${fd.windDeg ?? '?'}°${desc}`);
    }
    if (fd.tempC   != null) parts.push(`${fd.tempC}°C`);
    if (fd.visKm   != null) {
        const desc = fd.visKm < 3 ? ' (sehr schlecht)' : fd.visKm < 8 ? ' (eingeschränkt)' : fd.visKm > 20 ? ' (ausgezeichnet)' : '';
        parts.push(`Sicht ${fd.visKm} km${desc}`);
    }
    return parts.length ? `Wetter: ${parts.join(', ')}.` : '';
}

function _greetingPrompt() {
    const ctx = _baseContext();
    const pax = window.activePassenger;
    if (!ctx || !pax) return null;
    const wx = _weatherContext(window.lastLiveFlightData);
    const dwellReq = pax.targetDwellMin > 0
        ? `Ich brauche etwa ${pax.targetDwellMin} Minuten am Ziel.`
        : `Ein Überflug reicht mir — kein fixer Zeitbedarf.`;
    return `${ctx}

Moment: Wir starten gleich — Motor läuft an oder das Flugzeug setzt sich in Bewegung.${wx ? ' ' + wx : ''}
Basistextt für deine Begrüßung (frei adaptieren): "${pax.greetingText}"
Bitte auch kurz deine Anforderungen nennen: ${pax.targetAltFt ? `am liebsten um die ${pax.targetAltFt} ft` : 'Höhe nach Absprache'}. ${dwellReq}
Max 3 Sätze.${_TONE}`;
}

function _atTargetPrompt(flightData) {
    const ctx = _baseContext();
    const pax = window.activePassenger;
    if (!ctx || !pax) return null;

    const altFt = Math.round(flightData?.mslFt || 0);
    const aglFt = Math.round(flightData?.aglFt || 0);
    const bank  = Math.abs(flightData?.bankDeg || 0).toFixed(1);
    const gf    = (flightData?.gForce || 1.0).toFixed(2);
    const isPOI = _isPOIMission();
    const wx    = _weatherContext(flightData);

    const situation = isPOI
        ? `Wir sind am Ziel "${(typeof currentMissionData !== 'undefined' ? currentMissionData : null)?.poiName || 'Ziel'}". Höhe: ${altFt} ft MSL / ${aglFt} ft AGL.`
        : `Wir nähern uns ${(typeof currentMissionData !== 'undefined' ? currentMissionData : null)?.dest || 'dem Flughafen'} — Landung gleich.`;

    let notes = '';
    if (pax.gTolerance === 'niedrig' && parseFloat(gf) > 1.3) notes += ` Die G-Belastung vorhin war spürbar für mich.`;
    if (pax.bankTolerance === 'niedrig' && parseFloat(bank) > 20) notes += ` Die Kurven haben mich etwas mitgenommen.`;
    if (isPOI && altFt > 0 && pax.targetAltFt) {
        const diff = altFt - pax.targetAltFt;
        if (Math.abs(diff) > 300) notes += ` Wir sind noch ${diff > 0 ? diff + ' ft zu hoch' : Math.abs(diff) + ' ft zu niedrig'} für meine Arbeit.`;
    }
    if (wx) notes += ` ${wx}`;

    return `${ctx}

Moment: ${situation}${notes}
Reagiere spontan auf diesen Augenblick — was siehst du, was geht dir durch den Kopf? Wenn Wetter oder Bedingungen nicht ideal sind, erwähne es kurz aber bleib positiv. Max 2-3 Sätze.${_TONE}`;
}

function _farewellPrompt(record) {
    const ctx = _baseContext();
    const pax = window.activePassenger;
    if (!ctx || !pax) return null;

    const min  = Math.round(record.durationSec / 60);
    const td   = record.touchdownVsFpm != null ? `${Math.abs(record.touchdownVsFpm)} ft/min` : null;
    const bank = (record.maxBankDeg || 0).toFixed(1);
    const maxG = (record.maxGForce  || 1.0).toFixed(2);
    const wx   = _weatherContext(window.lastLiveFlightData);

    let highlights = '';
    if (pax.gTolerance === 'niedrig' && (record.maxGForce || 1) > 1.5) highlights += ' Etwas viel G für mich, aber okay.';
    if (pax.bankTolerance === 'niedrig' && (record.maxBankDeg || 0) > 30) highlights += ' Die Kurven waren schon sportlich.';
    if (td && Math.abs(record.touchdownVsFpm) < 200) highlights += ' Die Landung war richtig sanft — Kompliment!';
    if (td && Math.abs(record.touchdownVsFpm) > 500) highlights += ` Die Landung mit ${Math.abs(record.touchdownVsFpm)} ft/min war etwas holprig.`;
    if (wx) highlights += ` ${wx}`;

    return `${ctx}

Moment: Wir sind gelandet, Flug beendet.
Fakten: ${min} min, ${record.distanceNm} NM, max ${record.maxAltFt} ft, max Bank ${bank}°, max G ${maxG}g.${highlights ? '\n' + highlights : ''}
Verabschiede dich persönlich beim Piloten und gib dein Fazit zum Flug — aus deiner Sicht als ${pax.role}. Auch wenn etwas nicht perfekt war, schließ positiv ab. Max 3 Sätze.${_TONE}`;
}

// ─── PUBLIC TRIGGERS ─────────────────────────────────────────────────────────

window.triggerPaxGreeting = async function() {
    _paxLog(`triggerPaxGreeting | tts:${_paxVoiceEnabled} done:${_paxGreetingDone} pax:${!!window.activePassenger} key:${!!_getApiKey()}`, 'state');
    if (_paxGreetingDone || !window.activePassenger) return;
    _paxGreetingDone = true;
    const prompt = _greetingPrompt();
    if (!prompt) { _paxGreetingDone = false; _paxLog('Greeting: kein Prompt (Mission-Daten fehlen?)', 'warn'); return; }
    _paxLog('Greeting → API-Call', 'event');
    await _speakAndShow(prompt, 'Begrüßung');
};

window.triggerPaxAtTarget = async function(flightData) {
    _paxLog(`triggerPaxAtTarget | tts:${_paxVoiceEnabled} done:${_paxAtTargetDone} pax:${!!window.activePassenger} alt:${flightData?.mslFt||0}ft`, 'state');
    if (_paxAtTargetDone || !window.activePassenger) return;
    _paxAtTargetDone = true;
    const prompt = _atTargetPrompt(flightData);
    if (!prompt) { _paxAtTargetDone = false; _paxLog('AtTarget: kein Prompt', 'warn'); return; }
    _paxLog('At-Target → API-Call in 2s', 'event');
    setTimeout(() => _speakAndShow(prompt, _isPOIMission() ? 'Am Ziel' : 'Landung'), 2000);
};

window.triggerPaxFarewell = async function(record) {
    _paxLog(`triggerPaxFarewell | tts:${_paxVoiceEnabled} done:${_paxFarewellDone} pax:${!!window.activePassenger}`, 'state');
    if (_paxFarewellDone || !window.activePassenger) return;
    _paxFarewellDone = true;
    const prompt = _farewellPrompt(record);
    if (!prompt) { _paxFarewellDone = false; _paxLog('Farewell: kein Prompt', 'warn'); return; }
    _paxLog('Farewell → API-Call in 3s', 'event');
    setTimeout(() => _speakAndShow(prompt, 'Verabschiedung'), 3000);
};

function _haversineNm(lat1, lon1, lat2, lon2) {
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2
            + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 3440.065;
}

// Called each GPS tick from sync.js + sim-route.js
window.checkPaxPoiProximity = function(lat, lon, flightData) {
    if (!window.activePassenger) return;

    if (_isPOIMission()) {
        if (!_poiSatisfied && !_poiAborted) _tickPoiDwell(lat, lon, flightData);
    } else {
        // Airport: simple 1.5 NM approach trigger (live mode fallback)
        if (_paxAtTargetDone) return;
        const wps = (typeof routeWaypoints !== 'undefined') ? routeWaypoints : null;
        if (!wps || wps.length < 2) return;
        const last = wps[wps.length - 1];
        const distNm = _haversineNm(lat, lon, last.lat, last.lng ?? last.lon);
        if (distNm <= 1.5) {
            _paxLog(`Airport in Reichweite: ${distNm.toFixed(2)} NM`, 'state');
            window.triggerPaxAtTarget(flightData);
        }
    }
};

function _tickPoiDwell(lat, lon, flightData) {
    const pax  = window.activePassenger;
    const dest = _getDestCoords();
    if (!dest) return;

    const distNm   = _haversineNm(lat, lon, dest.lat, dest.lon);
    const radius   = pax.targetRadiusNm || 1.5;
    const inRadius = distNm <= radius;
    const now      = Date.now();

    const strict               = _paxStrictMode;
    const altTolerance         = strict ? 200  : 600;
    const dwellRequired        = pax.targetDwellMin > 0 ? pax.targetDwellMin * 60 * (strict ? 1.0 : 0.5) : 0;
    const maxAttempts          = strict ? 2 : 3;
    const graceSec             = strict ? 15  : 25;
    const complaintIntervalSec = strict ? 30 : 45;

    if (!inRadius) {
        _poiInRadius     = false;
        _poiLastTickTime = null;
        return;
    }

    if (!_poiInRadius) {
        _poiInRadius     = true;
        _poiLastTickTime = now;
        if (!_poiEnteredAt) _poiEnteredAt = now;
        _paxLog(`POI-Radius betreten | dist: ${distNm.toFixed(2)} NM | dwell: ${dwellRequired.toFixed(0)}s | altReq: ${pax.targetAltFt || 'keins'}`, 'state');

        // Entry comment — spontane erste Reaktion beim Einflug
        if (!_poiEntryDone) {
            _poiEntryDone = true;
            const p = _poiEntryPrompt(flightData);
            if (p) setTimeout(() => _speakAndShow(p, 'Zielgebiet'), 800);
        }

        // Flyover (targetDwellMin=0): Entry genügt → satisfied nach kurzem Delay
        if (dwellRequired === 0) {
            _poiSatisfied    = true;
            _paxAtTargetDone = true;
            _paxLog('Flyover-Mission — Überflug genügt, satisfied', 'event');
            return;
        }
    }

    const dt = Math.min((now - _poiLastTickTime) / 1000, 5);
    _poiLastTickTime = now;

    const altFt     = flightData?.mslFt || 0;
    const targetAlt = pax.targetAltFt || 0;
    const altOk     = targetAlt === 0 || Math.abs(altFt - targetAlt) <= altTolerance;
    const inRadiusForSec   = (now - (_poiEnteredAt || now)) / 1000;
    const lastComplaintSec = _poiLastComplaintAt ? (now - _poiLastComplaintAt) / 1000 : Infinity;

    if (altOk) {
        _poiDwellSec += dt;

        if (_poiAltWasOk === false) {
            _paxLog('Höhe korrigiert → Bestätigung', 'event');
            const p = _poiAltCorrectedPrompt(flightData);
            if (p) setTimeout(() => _speakAndShow(p, 'Höhe ok'), 500);
        }
        _poiAltWasOk = true;

        if (_poiDwellSec >= dwellRequired) {
            _paxLog(`Verweilzeit erfüllt (${_poiDwellSec.toFixed(0)}s) → zufrieden`, 'event');
            _poiSatisfied    = true;
            _paxAtTargetDone = true;
            const p = _poiSatisfiedPrompt(flightData);
            if (p) setTimeout(() => _speakAndShow(p, 'Ziel erfüllt'), 500);
        }
    } else {
        _poiAltWasOk = false;

        const canComplain = inRadiusForSec >= graceSec && lastComplaintSec >= complaintIntervalSec;
        if (canComplain) {
            if (_poiAttempts < maxAttempts) {
                _poiAttempts++;
                _poiLastComplaintAt = now;
                _paxLog(`Höhen-Reklamation #${_poiAttempts} | ${altFt} ft statt ${targetAlt} ft`, 'event');
                const p = _poiAltComplaintPrompt(flightData, altFt, targetAlt, _poiAttempts);
                if (p) setTimeout(() => _speakAndShow(p, `Höhe (${_poiAttempts}/${maxAttempts})`), 500);
            } else {
                _paxLog('Max. Versuche erreicht → Abbruch', 'event');
                _poiAborted      = true;
                _paxAtTargetDone = true;
                const p = _poiAbortPrompt(flightData);
                if (p) setTimeout(() => _speakAndShow(p, 'Abbruch'), 1000);
            }
        }
    }
}

// ─── BOOT ─────────────────────────────────────────────────────────────────────
// All function declarations above are now defined — safe to init
(function() {
    const chk = document.getElementById('awmPaxVoiceCheck');
    if (chk) chk.checked = _paxVoiceEnabled;
    const modeEl = document.getElementById('awmPaxModeSelect');
    if (modeEl) modeEl.value = _paxStrictMode ? 'strict' : 'easy';

    if (!window.activePassenger) {
        const saved = localStorage.getItem('ga_active_passenger');
        if (saved) try { window.activePassenger = JSON.parse(saved); } catch(e) {}
    }

    _injectPaxUI();
    _paxLog('System bereit', 'state');
}());
