/* === TAWS - Terrain Awareness & Warning System (v1) === */
/* Nutzt kostenlose Terrarium RGB Tiles (AWS Open Data)    */
/* Kein API-Key, keine Rate-Limits                         */

const TAWS_TILE_ZOOM = 10;
const TAWS_MISSION_TERRAIN_ZOOM = 12;
const TAWS_TILE_URL = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';
const TAWS_SAFETY_RED = 500;     // ft - TERRAIN WARNING
const TAWS_SAFETY_AMBER = 1000;  // ft - TERRAIN CAUTION
const TAWS_CACHE_MAX = 50;

// Tile-Cache: Map<"z/x/y", { imageData, ts }>
const _tawsTileCache = new Map();
// Offscreen-Canvas fuer Pixel-Sampling
const _tawsCanvas = document.createElement('canvas');
_tawsCanvas.width = 256;
_tawsCanvas.height = 256;
const _tawsCtx = _tawsCanvas.getContext('2d', { willReadFrequently: true });

// Voice-Alert Cooldown (verhindert Spam)
let _tawsLastVoiceAlert = 0;
const TAWS_VOICE_COOLDOWN = 15000; // 15 Sekunden

// ── Audio-System (iOS-sicher via AudioContext) ────────────────────────────────
// speechSynthesis funktioniert im iOS-PWA-Modus nicht zuverlässig.
// Primärer Alert: AudioContext-Synthesizer (identisch zum Mini-Spiel → funktioniert).
// Sekundär: speechSynthesis als Desktop-Fallback.

let _tawsAudioCtx = null;
let _tawsSpeechUnlocked = false;

// Master-Lautstärke (0–1), persistent via localStorage
let _awmVolume = Math.min(1, Math.max(0, parseFloat(localStorage.getItem('awm_volume') ?? '1')));
let _awmMasterGain = null;

// Von index.html Slider aufgerufen
window.awmSetVolume = function(val) {
    _awmVolume = Math.min(1, Math.max(0, val / 100));
    if (_awmMasterGain) _awmMasterGain.gain.value = _awmVolume;
    localStorage.setItem('awm_volume', _awmVolume);
    const lbl = document.getElementById('awmVolumeLabel');
    if (lbl) lbl.textContent = Math.round(val) + '%';
};

function _tawsInitAudio() {
    if (!_tawsAudioCtx) {
        try {
            _tawsAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
        } catch(e) { _tawsAudioCtx = null; }
    }
    // Master-GainNode für Lautstärkeregelung aller Audio-Ausgaben
    if (_tawsAudioCtx && !_awmMasterGain) {
        _awmMasterGain = _tawsAudioCtx.createGain();
        _awmMasterGain.gain.value = _awmVolume;
        _awmMasterGain.connect(_tawsAudioCtx.destination);
        window._tawsAudioCtx = _tawsAudioCtx;
        window._awmMasterGain = _awmMasterGain;
    }
    // Alle Clips laden sobald AudioContext bereit — inkl. taws-alert (kein HTMLAudioElement mehr)
    if (!_awLoaded && !_awLoading) _awLoadClips();
}

// Intern: AudioContext aufwecken und danach callback ausführen
function _tawsResumeThen(fn) {
    if (!_tawsAudioCtx) return;
    if (_tawsAudioCtx.state === 'suspended' || _tawsAudioCtx.state === 'interrupted') {
        console.warn(`[TAWS] AudioContext noch ${_tawsAudioCtx.state} beim Playback — resume() ohne User-Gesture!`);
        _tawsAudioCtx.resume().then(fn).catch(() => {});
    } else {
        fn();
    }
}

// "Whoop Whoop" – klassischer GPWS-Warntton (zwei aufsteigende Sweeps).
// Der Ton ist ein normales Queue-Segment, damit er die Pax Voice ebenfalls
// respektiert und bei einer Unterbrechung spaeter erneut abgespielt werden kann.
function _tawsStartWhoopWhoop(onended) {
    if (!_tawsAudioCtx) return null;
    const nodes = [];
    let done = false;
    let timer = null;
    const finish = () => {
        if (done) return;
        done = true;
        if (timer) clearTimeout(timer);
        for (const { osc, gain } of nodes) {
            try { osc.onended = null; } catch (_) {}
            try { osc.disconnect(); } catch (_) {}
            try { gain.disconnect(); } catch (_) {}
        }
        if (typeof onended === 'function') onended();
    };
    const now = _tawsAudioCtx.currentTime + 0.05;
    for (let i = 0; i < 2; i++) {
        const osc  = _tawsAudioCtx.createOscillator();
        const gain = _tawsAudioCtx.createGain();
        osc.connect(gain);
        gain.connect(_awmMasterGain || _tawsAudioCtx.destination);
        osc.type = 'sine';
        const t = now + i * 0.65;
        osc.frequency.setValueAtTime(440, t);
        osc.frequency.linearRampToValueAtTime(920, t + 0.45);
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.85, t + 0.05);
        gain.gain.setValueAtTime(0.85, t + 0.40);
        gain.gain.linearRampToValueAtTime(0, t + 0.55);
        osc.start(t);
        osc.stop(t + 0.6);
        nodes.push({ osc, gain });
    }
    timer = setTimeout(finish, 1400);
    return {
        stop: () => {
            for (const { osc } of nodes) {
                try { osc.stop(0); } catch (_) {}
            }
            finish();
        }
    };
}

function _tawsUnlockAll() {
    _tawsInitAudio();
    // iOS PFLICHT: AudioContext.resume() MUSS aus einem User-Gesture-Handler heraus
    // aufgerufen werden. Danach bleibt der Context 'running' und kann jederzeit
    // per _tawsResumeThen() verwendet werden.
    if (_tawsAudioCtx && (_tawsAudioCtx.state === 'suspended' || _tawsAudioCtx.state === 'interrupted')) {
        _tawsAudioCtx.resume().catch(() => {});
    }
    if (!_tawsSpeechUnlocked && typeof speechSynthesis !== 'undefined') {
        _tawsSpeechUnlocked = true;
        const u = new SpeechSynthesisUtterance('');
        u.volume = 0;
        speechSynthesis.cancel();
        speechSynthesis.speak(u);
    }
}
window.awmEnsureAudioUnlocked = function(reason = 'manual') {
    _tawsUnlockAll();
    if (_tawsAudioCtx && (_tawsAudioCtx.state === 'suspended' || _tawsAudioCtx.state === 'interrupted')) {
        _tawsAudioCtx.resume().catch(() => {});
    }
    return {
        ctx: _tawsAudioCtx,
        gain: _awmMasterGain,
        state: _tawsAudioCtx?.state || 'none',
        volume: _awmVolume,
        reason
    };
};
document.addEventListener('touchstart', _tawsUnlockAll, { once: true, passive: true });
document.addEventListener('click',      _tawsUnlockAll, { once: true });

// ── Airspace Warning Module (AWM) ─────────────────────────────────────────────
// Spielt dynamisch zusammengesetzte Ansagen via AudioContext ab (iOS-sicher).
// Standard-Clips: audio-warnings/aw-*.m4a (Anna de_DE).
// Voice-Packs: audio-warnings/voices/<pack>/aw-*.mp3 (z.B. Ava EN).

const _AWM_CLIPS = [
    'aw-achtung','aw-in',
    'aw-ctr','aw-charlie','aw-delta','aw-rmz','aw-tmz','aw-edr','aw-para',
    'aw-1min','aw-2min','aw-3min','aw-4min','aw-5min',
    'aw-6min','aw-7min','aw-8min','aw-9min','aw-10min',
    // Frequenz-/Squawk-Ansage
    'aw-freq','aw-sqwk','aw-komma',
    'aw-d0','aw-d1','aw-d2','aw-d3','aw-d4',
    'aw-d5','aw-d6','aw-d7','aw-d8','aw-d9',
    // Optional: separates "zwo"-Snippet (falls vorhanden, sonst Fallback auf aw-d2)
    'aw-zwo',
    // Wegpunkt-Ansage
    'aw-wp-erreicht','aw-neuer-kurs','aw-grad','aw-fuer','aw-meilen',
    'taws-alert'
];

// Frequenz-Ansage an/aus (default: an), persistent
let _awmReadFreq = (localStorage.getItem('awm_read_freq') !== '0');
let _awmTerrainWarn = (localStorage.getItem('awm_warn_terrain') !== '0');
let _awmAirspaceWarn = (localStorage.getItem('awm_warn_airspace') !== '0');
window.awmSetReadFreq = function(on) {
    _awmReadFreq = !!on;
    localStorage.setItem('awm_read_freq', on ? '1' : '0');
};
window.awmSetTerrainWarn = function(on) {
    _awmTerrainWarn = !!on;
    localStorage.setItem('awm_warn_terrain', on ? '1' : '0');
};
window.awmSetAirspaceWarn = function(on) {
    _awmAirspaceWarn = !!on;
    localStorage.setItem('awm_warn_airspace', on ? '1' : '0');
    if (!_awmAirspaceWarn) {
        const banner = document.getElementById('awmFreqBanner');
        if (banner) {
            banner.querySelectorAll('[data-askey]').forEach(entry => entry.remove());
            banner.style.display = Array.from(banner.children).some(child => child.hidden !== true) ? 'block' : 'none';
        }
    }
};

// Wegpunkt-Ansage an/aus (beim automatischen Wegpunkt-Advance), persistent
let _awmWpAlert = (localStorage.getItem('awm_warn_wp') !== '0');
window.awmSetWpAlert = function(on) {
    _awmWpAlert = !!on;
    localStorage.setItem('awm_warn_wp', on ? '1' : '0');
};

// Aufgerufen aus sync.js wenn Auto-Advance ausgelöst wird
// brng = Kurs zum nächsten WP, distNM = Distanz in NM
function _awDigitClip(digit) {
    const d = Number(digit);
    if (!Number.isInteger(d) || d < 0 || d > 9) return null;
    if (d === 2) return _awBuffers['aw-zwo'] ? 'aw-zwo' : 'aw-d2';
    return `aw-d${d}`;
}

function _awDigitsToClips(numStr) {
    return String(numStr).split('').map(ch => _awDigitClip(parseInt(ch, 10))).filter(Boolean);
}

window.awmAnnounceWpAdvance = function(brng, distNM) {
    if (!_awmWpAlert) return;
    // Kurs: 3-stellig, Ziffer für Ziffer
    const crsDigits = _awDigitsToClips(String(Math.round(brng)).padStart(3, '0'));
    // Distanz: gerundet, Ziffer für Ziffer
    const distDigits = _awDigitsToClips(String(Math.round(distNM)));
    const clips = [
        'aw-wp-erreicht',
        'aw-neuer-kurs', ...crsDigits, 'aw-grad',
        'aw-fuer',       ...distDigits, 'aw-meilen'
    ];
    _awEnqueue(clips);
};

// Frequenz-/Squawk-String → Clip-Keys (mit "Zwo" für 2)
function _awFreqToClips(valueStr, isSquawk) {
    const prefix = isSquawk ? 'aw-sqwk' : 'aw-freq';
    const clips = [prefix];
    // Trailing-Nullen nach dem Komma entfernen (130.000 → 130)
    let s = valueStr.toString().trim().replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
    for (const ch of s) {
        if (ch >= '0' && ch <= '9') clips.push(_awDigitClip(parseInt(ch, 10)));
        else if (ch === '.' || ch === ',') clips.push('aw-komma');
        // Sonstige Zeichen (Leerzeichen, Bindestrich) überspringen
    }
    return clips.filter(Boolean);
}

// Primäre Frequenz/Squawk eines Luftraums als Clip-Sequenz
function _awGetFreqClips(as) {
    if (!_awmReadFreq || !as.frequencies || !as.frequencies.length) return [];
    const primary = as.frequencies.find(f => f.primary) || as.frequencies[0];
    if (!primary || !primary.value) return [];
    const nm = (primary.name || '').toUpperCase();
    const isSquawk = /XPDR|SQK|SQUAWK|TRANSP/.test(nm);
    return _awFreqToClips(primary.value, isSquawk);
}
const _awBuffers   = {};           // key → AudioBuffer
let   _awLoaded    = false;
let   _awLoading   = false;

// Voice-Pack: '' = Anna (Standard), weitere Packs via audio-warnings/voices/catalog.json
let _awmVoicePack = localStorage.getItem('awm_voice_pack') || '';
window.awmSetVoice = function(pack) {
    _awmVoicePack = pack;
    localStorage.setItem('awm_voice_pack', pack);
    // Clips neu laden
    _awLoaded  = false;
    _awLoading = false;
    for (const k of Object.keys(_awBuffers)) delete _awBuffers[k];
    _tawsInitAudio();
    _awLoadClips();
};

// State pro Luftraum: { t5, t2, t5in, t2in, firstSeen5, firstSeen2 }
const _awState = new Map();
// Gleiche-Klasse Ketten-Unterdrückung: typeKey → { lastActiveMs, warnedAt }
// Wenn der Pilot durch mehrere aufeinanderfolgende D-Sektoren fliegt ohne Unterbrechung,
// wird nur der erste angesagt.
const _awTypeChain = new Map(); // typeKey → { lastActiveMs, warnedAt }
const _AW_CHAIN_GAP = 45000;   // 45 s offener Luftraum → Kette zurückgesetzt
// Serielle Abspielqueue: verhindert gleichzeitige Ansagen und laesst eine
// laufende Pax Voice immer vor. Priority-Tokens vermeiden, dass ein spaetes
// onended einer alten Wiedergabe eine neuere Pax Voice versehentlich freigibt.
let _awQueueBusy = false;
const _awQueue = [];
const _awPriorityAudioTokens = new Set();
let _awPriorityAudioSerial = 0;
let _awCurrentPlayback = null;
const _awQueueStats = {
    enqueued: 0,
    waypointEnqueued: 0,
    segmentsStarted: 0,
    lastEnqueuedAt: 0,
    lastEnqueuedKey: '',
    lastStartedAt: 0,
    lastStartedKey: ''
};

function _awPriorityAudioActive() {
    return _awPriorityAudioTokens.size > 0;
}

function _awInterruptCurrentPlayback() {
    const playback = _awCurrentPlayback;
    if (!playback || playback.interrupted) return;
    playback.interrupted = true;
    if (playback.nextTimer) clearTimeout(playback.nextTimer);
    playback.nextTimer = null;

    const repeatCurrent = playback.currentSegment ? 1 : 0;
    const remainingStart = Math.max(0, playback.nextIndex - repeatCurrent);
    const remaining = playback.segments.slice(remainingStart);
    if (remaining.length) _awQueue.unshift(remaining);

    const current = playback.currentSegment;
    playback.currentSegment = null;
    if (current) {
        try { current.onended = null; } catch (_) {}
        try { current.stop?.(); } catch (_) {}
        try { current.disconnect?.(); } catch (_) {}
    }
    if (_awCurrentPlayback === playback) _awCurrentPlayback = null;
    _awQueueBusy = false;
}

window.awmBeginPriorityAudio = function(label = 'priority-audio') {
    const token = `${++_awPriorityAudioSerial}:${String(label || 'priority-audio')}`;
    _awPriorityAudioTokens.add(token);
    _awInterruptCurrentPlayback();
    return token;
};

window.awmEndPriorityAudio = function(token) {
    if (token) _awPriorityAudioTokens.delete(token);
    if (!_awPriorityAudioActive() && _awQueue.length && !_awQueueBusy) {
        _awDrainQueue();
    }
};

function _awEnqueue(keys) {
    if (!Array.isArray(keys) || !keys.length) return;
    _awQueue.push(keys);
    _awQueueStats.enqueued += 1;
    if (keys[0] === 'aw-wp-erreicht') _awQueueStats.waypointEnqueued += 1;
    _awQueueStats.lastEnqueuedAt = Date.now();
    _awQueueStats.lastEnqueuedKey = String(keys[0] || '');
    if (!_tawsAudioCtx) _tawsInitAudio();
    else if (!_awLoaded && !_awLoading) _awLoadClips();
    if (!_awQueueBusy && !_awPriorityAudioActive()) _awDrainQueue();
}

function _awDrainQueue() {
    if (!_awQueue.length) { _awQueueBusy = false; return; }
    if (_awPriorityAudioActive()) { _awQueueBusy = false; return; }
    // Queue-Eintraege niemals entfernen, solange AudioContext oder Clips noch
    // nicht bereit sind. Besonders auf Quest kann das Laden des Voice-Packs
    // laenger dauern als eine Pax-Ansage; der alte Ablauf verlor dann den WP.
    if (!_tawsAudioCtx) {
        _awQueueBusy = false;
        _tawsInitAudio();
        return;
    }
    if (!_awLoaded) {
        _awQueueBusy = false;
        if (!_awLoading) _awLoadClips();
        return;
    }
    _awQueueBusy = true;
    const keys = _awQueue.shift();

    // Null-Keys (kein Luftraumtyp) herausfiltern; fehlende Buffer warnen
    const valid = keys.filter(k => {
        if (!k) return false;
        if (k === 'taws-whoop') return true;
        if (!_awBuffers[k]) { console.warn('[AWM] Buffer fehlt:', k); return false; }
        return true;
    });
    if (!valid.length) { setTimeout(_awDrainQueue, 0); return; }

    // Clips via onended ketten statt mit fixen Timestamps vorausplanen.
    // Das verhindert dass Chrome/Quest-3 Clips verwirft wenn der AudioContext
    // kurz suspended war und der geplante Startzeitpunkt bereits vergangen ist.
    _tawsResumeThen(() => {
        if (_awPriorityAudioActive()) {
            _awQueue.unshift(valid);
            _awQueueBusy = false;
            return;
        }
        const playback = {
            segments: valid,
            nextIndex: 0,
            currentSegment: null,
            nextTimer: null,
            interrupted: false
        };
        _awCurrentPlayback = playback;
        function next() {
            playback.nextTimer = null;
            if (playback.interrupted) return;
            if (_awPriorityAudioActive()) {
                _awInterruptCurrentPlayback();
                return;
            }
            if (playback.nextIndex >= valid.length) {
                if (_awCurrentPlayback === playback) _awCurrentPlayback = null;
                _awDrainQueue();
                return;
            }
            const key = valid[playback.nextIndex++];
            _awQueueStats.segmentsStarted += 1;
            _awQueueStats.lastStartedAt = Date.now();
            _awQueueStats.lastStartedKey = String(key || '');
            if (key === 'taws-whoop') {
                const controller = _tawsStartWhoopWhoop(() => {
                    if (playback.interrupted) return;
                    playback.currentSegment = null;
                    playback.nextTimer = setTimeout(next, 80);
                });
                if (!controller) {
                    playback.nextTimer = setTimeout(next, 0);
                    return;
                }
                playback.currentSegment = controller;
                return;
            }
            const buf = _awBuffers[key];
            const src = _tawsAudioCtx.createBufferSource();
            src.buffer = buf;
            src.connect(_awmMasterGain || _tawsAudioCtx.destination);
            src.onended = () => {
                if (playback.interrupted) return;
                playback.currentSegment = null;
                playback.nextTimer = setTimeout(next, 80);
            };
            playback.currentSegment = src;
            src.start(_tawsAudioCtx.currentTime + 0.05);
        }
        next();
    });
}

async function _awLoadClips() {
    if (_awLoaded || _awLoading || !_tawsAudioCtx) return;
    _awLoading = true;
    const pack = _awmVoicePack;
    const optionalClips = new Set(['aw-zwo']);
    await Promise.all(_AWM_CLIPS.map(async key => {
        let url;
        if (key === 'taws-alert') {
            url = './taws-alert.m4a';
        } else if (pack) {
            url = `./audio-warnings/voices/${pack}/${key}.mp3`;
        } else {
            url = `./audio-warnings/${key}.m4a`;
        }
        try {
            const r  = await fetch(url);
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            const ab = await r.arrayBuffer();
            _awBuffers[key] = await _tawsAudioCtx.decodeAudioData(ab);
        } catch(e) {
            if (!optionalClips.has(key)) console.warn('[AWM] Clip laden fehlgeschlagen:', key, e);
        }
    }));
    // Wenn kein eigenes "zwo"-Snippet vorhanden ist, auf bestehendes "2"-Snippet zurückfallen.
    if (!_awBuffers['aw-zwo'] && _awBuffers['aw-d2']) _awBuffers['aw-zwo'] = _awBuffers['aw-d2'];
    _awLoaded  = true;
    _awLoading = false;
    console.log(`[AWM] Clips geladen (${pack || 'anna'}):`, Object.keys(_awBuffers).length);
    if (_awQueue.length && !_awQueueBusy && !_awPriorityAudioActive()) {
        setTimeout(_awDrainQueue, 0);
    }
}

// Ansage in serielle Queue einreihen
function _awPlaySequence(keys) {
    _awEnqueue(keys);
}

window.awmGetAudioQueueDebugState = function() {
    return {
        wpEnabled: !!_awmWpAlert,
        airspaceEnabled: !!_awmAirspaceWarn,
        frequencyEnabled: !!_awmReadFreq,
        terrainEnabled: !!_awmTerrainWarn,
        audioContextState: _tawsAudioCtx?.state || 'unavailable',
        clipsLoaded: !!_awLoaded,
        clipsLoading: !!_awLoading,
        loadedClipCount: Object.keys(_awBuffers).length,
        queueDepth: _awQueue.length,
        queueBusy: !!_awQueueBusy,
        priorityHolds: _awPriorityAudioTokens.size,
        playbackActive: !!_awCurrentPlayback,
        enqueuedCount: _awQueueStats.enqueued,
        waypointEnqueuedCount: _awQueueStats.waypointEnqueued,
        segmentsStartedCount: _awQueueStats.segmentsStarted,
        lastEnqueuedAt: _awQueueStats.lastEnqueuedAt || null,
        lastEnqueuedKey: _awQueueStats.lastEnqueuedKey || null,
        lastStartedAt: _awQueueStats.lastStartedAt || null,
        lastStartedKey: _awQueueStats.lastStartedKey || null
    };
};

// Luftraum-Typ → Audio-Key (null = kein Alert für diesen Typ)
function _awTypeKey(as) {
    const t = as.type, cls = as.icaoClass;
    if (t === 4)                return 'aw-ctr';      // CTR (Kontrollzone)
    if (cls === 2)              return 'aw-charlie';  // Class C
    if (cls === 3 || t === 0)   return 'aw-delta';    // Class D
    if (t === 7 || t === 26)    return 'aw-ctr';      // TMA / CTA → wie CTR ansagen
    if (t === 5 || t === 27)    return 'aw-tmz';      // TMZ
    if ((t === 6 || t === 28) && /\bPARA\b/i.test(as.name || '')) return 'aw-para'; // Fallschirmgebiet
    if (t === 6 || t === 28)    return 'aw-rmz';      // RMZ
    if (t === 1)                return 'aw-edr';      // ED-R Restricted (Buchstaben E-D-R)
    return null;   // Danger/Prohibited/FIS → kein Sprach-Alert
}

function _awTypeClips(as) {
    const key = _awTypeKey(as);
    return key ? [key] : [];
}

// Minuten-Zahl → Audio-Key
function _awMinKey(min) {
    const n = Math.round(min);
    const k = ['','aw-1min','aw-2min','aw-3min','aw-4min','aw-5min',
                  'aw-6min','aw-7min','aw-8min','aw-9min','aw-10min'];
    return (n >= 1 && n <= 10) ? k[n] : null;
}

// Luftraum 3× auf Karte aufblinken lassen
function _awPulseOnMap(as, color) {
    if (!as.geometry || typeof L === 'undefined' || typeof map === 'undefined') return;
    const polys = [];
    if (as.geometry.type === 'Polygon')
        polys.push(as.geometry.coordinates[0]);
    else if (as.geometry.type === 'MultiPolygon')
        as.geometry.coordinates.forEach(mc => polys.push(mc[0]));

    polys.forEach(poly => {
        const latlngs = poly.map(c => [c[1], c[0]]);  // GeoJSON [lon,lat] → Leaflet [lat,lon]
        const flash = L.polygon(latlngs, {
            color, weight: 4, opacity: 0,
            fillColor: color, fillOpacity: 0,
            interactive: false
        }).addTo(map);
        let tick = 0;
        const id = setInterval(() => {
            tick++;
            const on = (tick % 2 === 1);
            flash.setStyle({ opacity: on ? 1 : 0, fillOpacity: on ? 0.3 : 0 });
            if (tick >= 6) { clearInterval(id); if (map.hasLayer(flash)) map.removeLayer(flash); }
        }, 450);
    });
}

let _awProfilePulseTimer = null;
function _awPulseOnProfileBand(as) {
    if (!as || typeof activeAirspaces === 'undefined' || !Array.isArray(activeAirspaces)) return;
    const idx = activeAirspaces.findIndex(a => a === as || (a && as && a._id && as._id && a._id === as._id));
    if (idx < 0) return;

    const prevIdx = (typeof vpHighlightPulseIdx === 'number') ? vpHighlightPulseIdx : -1;
    vpHighlightPulseIdx = idx;

    if (typeof vpStartHighlightPulse === 'function') vpStartHighlightPulse();
    else {
        if (typeof renderMapProfile === 'function') renderMapProfile();
        if (document.getElementById('verticalProfileCanvas') && typeof renderVerticalProfile === 'function') {
            renderVerticalProfile('verticalProfileCanvas');
        }
    }

    if (_awProfilePulseTimer) clearTimeout(_awProfilePulseTimer);
    _awProfilePulseTimer = setTimeout(() => {
        if (typeof vpHighlightPulseIdx !== 'undefined') {
            vpHighlightPulseIdx = (prevIdx >= 0 && activeAirspaces[prevIdx]) ? prevIdx : -1;
        }
        if (typeof vpStopHighlightPulse === 'function') vpStopHighlightPulse();
        if (typeof renderMapProfile === 'function') renderMapProfile();
        if (document.getElementById('verticalProfileCanvas') && typeof renderVerticalProfile === 'function') {
            renderVerticalProfile('verticalProfileCanvas');
        }
    }, 6000);
}

/**
 * Frequenz/Squawk-Banner am oberen Kartenrand anzeigen.
 * Bleibt stehen bis der Pilot tippt/klickt — kein Auto-Dismiss.
 */
function _awConsumeFreqBannerEvent(ev, options = {}) {
    if (!ev) return;
    if (typeof ev.stopPropagation === 'function') ev.stopPropagation();
    if (options.preventDefault !== false && ev.cancelable && typeof ev.preventDefault === 'function') ev.preventDefault();
}

function _awInstallFreqBannerBarrier(banner) {
    if (!banner || banner.__awmFreqBarrierInstalled) return;
    banner.__awmFreqBarrierInstalled = true;
    const consume = (ev) => _awConsumeFreqBannerEvent(ev, {
        preventDefault: !/^(pointerdown|mousedown|touchstart)$/i.test(String(ev?.type || ''))
    });
    ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click', 'dblclick', 'touchstart', 'touchend']
        .forEach(type => banner.addEventListener(type, consume, { passive: false }));
}

function _awShowFreqBanner(as, col) {
    if (!as.frequencies || as.frequencies.length === 0) return;
    const banner = document.getElementById('awmFreqBanner');
    if (!banner) return;
    _awInstallFreqBannerBarrier(banner);

    // Gleichen Luftraum nicht doppelt anzeigen
    const asKey = `${as.type}_${as.name || as._id || 'x'}`;
    const escaped = asKey.replace(/[^a-zA-Z0-9_-]/g, '_');
    if (banner.querySelector(`[data-askey="${escaped}"]`)) return;

    // Alle Frequenzen/Squawks aufbereiten
    const t = as.type;
    const freqParts = [];
    for (const f of (as.frequencies || [])) {
        if (!f.value) continue;
        const nm = (f.name || '').toUpperCase();
        const isSquawk = /XPDR|SQK|SQUAWK|TRANSP/.test(nm);
        const icon  = isSquawk ? '🔲' : '📻';
        const label = isSquawk ? (nm || 'XPDR')
                    : (t === 5 || t === 27) ? (nm || 'FREQ')
                    : (t === 6 || t === 28 || t === 33) ? (nm || 'INFO')
                    : (nm || 'TWR');
        freqParts.push(`${icon}\u202F${label}: <b>${f.value}</b>`);
    }
    if (!freqParts.length) return;

    const displayName = (typeof getAirspaceDisplayName === 'function')
        ? getAirspaceDisplayName(as) : (as.name || '?');

    // Farbe für Frequenz-Label
    let freqColor = col || '#ffffff';
    if (t === 5 || t === 27)          freqColor = '#9966ff'; // TMZ
    else if (t === 6 || t === 28 || t === 33) freqColor = '#66cccc'; // RMZ/FIS

    const entry = document.createElement('div');
    entry.dataset.askey = escaped;
    entry.className = 'awm-freq-entry';
    entry.style.borderTopColor = col || '#888';

    const valsHtml = freqParts
        .map(p => `<span class="awm-freq-val" style="color:${freqColor};">${p}</span>`)
        .join('<span style="color:#444;margin:0 4px;">·</span>');

    entry.innerHTML =
        `<span style="flex:1;min-width:0;display:flex;align-items:baseline;flex-wrap:wrap;gap:6px;">` +
        `<span class="awm-freq-name" style="color:${col};">${displayName}</span>` +
        `<span style="color:#555;font-size:10px;">·</span>` +
        `<span class="awm-freq-vals">${valsHtml}</span>` +
        `</span>` +
        `<button class="awm-freq-dismiss" type="button">✕</button>`;

    // Antippen / Klick → Eintrag entfernen, Banner verstecken wenn leer
    const dismiss = (ev) => {
        _awConsumeFreqBannerEvent(ev);
        if (!entry.isConnected) return;
        entry.remove();
        if (!Array.from(banner.children).some(child => child.hidden !== true)) banner.style.display = 'none';
    };
    const consumeOnly = (ev) => _awConsumeFreqBannerEvent(ev, { preventDefault: false });
    const dismissBtn = entry.querySelector('.awm-freq-dismiss');
    ['pointerdown', 'mousedown', 'touchstart'].forEach(type => {
        entry.addEventListener(type, consumeOnly, { passive: false });
        if (dismissBtn) dismissBtn.addEventListener(type, consumeOnly, { passive: false });
    });
    ['pointerup', 'click', 'touchend'].forEach(type => {
        entry.addEventListener(type, dismiss, { passive: false });
        if (dismissBtn) dismissBtn.addEventListener(type, dismiss, { passive: false });
    });

    banner.appendChild(entry);
    banner.style.display = 'block';
}

/**
 * Vorhersage-Punkte gegen aktive Lufträume prüfen und ggf. Ansage abspielen.
 * Nearest-first: nur der nächste noch nicht eingetretene Luftraum wird angesagt.
 */
function checkAirspaceWarnings(predPoints) {
    if (!_awmAirspaceWarn) {
        const banner = document.getElementById('awmFreqBanner');
        if (banner) {
            banner.querySelectorAll('[data-askey]').forEach(entry => entry.remove());
            banner.style.display = Array.from(banner.children).some(child => child.hidden !== true) ? 'block' : 'none';
        }
        return;
    }
    if (!_awLoaded) { _awLoadClips(); return; }
    if (!_tawsAudioCtx) return;
    if (typeof activeAirspaces === 'undefined' || !activeAirspaces.length) return;
    if (typeof getAirspaceVerticalBandFt === 'undefined' || typeof isPointInsideAirspace === 'undefined') return;

    const now = Date.now();
    const PERSIST = 5000;
    const STICKY  = 3000;
    const lastTerrainFt = Number(window.lastLiveTerrainFt) || 0;
    const getTerrainForPoint = (pt) => Number(pt?.terrainFt ?? lastTerrainFt) || 0;

    // ── Pass 1: Schnittstellen für alle Lufträume berechnen ───────────────────
    const crossings = [];
    for (const as of activeAirspaces) {
        if (!as.geometry) continue;
        if (as.type === 33) continue;

        const typeKey = _awTypeKey(as) || 'aw-ctr';
        const bandBase = getAirspaceVerticalBandFt(as, 0);
        if (!bandBase) continue;
        const lowerFt = bandBase.baseLowerFt;
        const upperFt = bandBase.baseUpperFt;
        const lowerIsAgl = bandBase.isLowerAgl;
        const upperIsAgl = bandBase.isUpperAgl;

        let earliest5 = null, earliest2 = null, insideNow = false;

        // insideNow: Flugzeug befindet sich JETZT in diesem Luftraum (GPS-Position, nicht Prediction)
        // Nur so wird sichergestellt, dass der zweite Luftraum erst angesagt wird wenn der erste
        // tatsächlich durchflogen wird — nicht schon 1 Minute vorher.
        const _gps = window.lastLiveGpsPos;
        if (_gps && _gps.alt !== undefined && _gps.lat !== undefined) {
            const bandNow = getAirspaceVerticalBandFt(as, getTerrainForPoint(_gps));
            if (!bandNow) continue;
            const _gAlt = _gps.alt; // bereits in Feet (sync.js)
            if (_gAlt >= bandNow.lowerFt - 200 && _gAlt <= bandNow.upperFt + 200) {
                if (isPointInsideAirspace(as, _gps.lat, _gps.lon)) insideNow = true;
            }
        }

        for (const pt of predPoints) {
            const bandPt = getAirspaceVerticalBandFt(as, getTerrainForPoint(pt));
            if (!bandPt) continue;
            if (pt.alt < bandPt.lowerFt - 500 || pt.alt > bandPt.upperFt + 300) continue;
            if (!isPointInsideAirspace(as, pt.lat, pt.lon)) continue;
            if (pt.min <= 5 && (earliest5 === null || pt.min < earliest5)) earliest5 = pt.min;
            if (pt.min <= 2 && (earliest2 === null || pt.min < earliest2)) earliest2 = pt.min;
        }

        if (earliest5 === null && earliest2 === null && !insideNow) continue;

        const asKey = `${as.type}_${as.name || 'x'}_${Math.round(lowerFt)}`;
        crossings.push({ as, typeKey, lowerFt, upperFt, lowerIsAgl, upperIsAgl, earliest5, earliest2, insideNow, asKey });
    }

    // ── Pass 2: Nächsten noch nicht eingetretenen Luftraum bestimmen ──────────
    // Lufträume in denen man schon drin ist dürfen weiterhin passieren.
    // Von den noch nicht eingetretenen: nur den nächsten warnen (blockiert weiter entfernte).
    const unentered = crossings
        .filter(c => !c.insideNow)
        .sort((a, b) => Math.min(a.earliest5 ?? 99, a.earliest2 ?? 99)
                      - Math.min(b.earliest5 ?? 99, b.earliest2 ?? 99));
    const nearestKey = unentered.length > 0 ? unentered[0].asKey : null;

    // Gleiche-Klasse Ketten-Update:
    // • Alle aktuell sichtbaren typeKeys als aktiv markieren
    // • Falls das Flugzeug gerade in einer ANDEREN Klasse ist → Kette der restlichen Klassen brechen
    const insideTypeKeys = new Set(crossings.filter(c => c.insideNow && c.typeKey).map(c => c.typeKey));
    for (const c of crossings) {
        if (!c.typeKey) continue;
        if (!_awTypeChain.has(c.typeKey)) _awTypeChain.set(c.typeKey, { lastActiveMs: 0, warnedAt: 0 });
        _awTypeChain.get(c.typeKey).lastActiveMs = now;
    }
    // Wenn drin in einer Klasse, breche Ketten aller anderen (bereits-gewarnte) Klassen
    if (insideTypeKeys.size > 0) {
        for (const [tk, ch] of _awTypeChain) {
            if (!insideTypeKeys.has(tk) && ch.warnedAt > 0) {
                ch.warnedAt = 0; // Kette unterbrochen durch andere Klasse
            }
        }
    }

    // ── Pass 3: Warnungen ausspielen ──────────────────────────────────────────
    for (const c of crossings) {
        const { as, typeKey, earliest5, earliest2, insideNow, asKey } = c;
        const in5 = earliest5 !== null;
        const in2 = earliest2 !== null;

        // Gleiche-Klasse Ketten-Unterdrückung:
        // Wenn wir bereits für diesen typeKey gewarnt haben UND die Kette noch aktiv ist
        // (kein langer Gap ohne Luftraum dieser Klasse), die Warnung unterdrücken.
        let chainSuppressed = false;
        if (!insideNow && typeKey) {
            const ch = _awTypeChain.get(typeKey);
            if (ch && ch.warnedAt > 0 && (now - ch.lastActiveMs) < _AW_CHAIN_GAP) {
                chainSuppressed = true;
            }
        }

        // Nur warnen wenn: bereits drin ODER nächster uneingetretener Luftraum UND nicht Ketten-unterdrückt
        const allowed = (insideNow || asKey === nearestKey) && !chainSuppressed;

        if (!_awState.has(asKey))
            _awState.set(asKey, { t5: false, t2: false, firstSeen5: 0, firstSeen2: 0, lastSeen5: 0, lastSeen2: 0 });
        const st = _awState.get(asKey);

        if (!allowed) {
            // Timer zurücksetzen damit Warnung feuert sobald Luftraum als nächstes drankommt
            if (st.lastSeen5 && (now - st.lastSeen5) > STICKY) { st.t5 = false; st.firstSeen5 = 0; st.lastSeen5 = 0; }
            if (st.lastSeen2 && (now - st.lastSeen2) > STICKY) { st.t2 = false; st.firstSeen2 = 0; st.lastSeen2 = 0; }
            continue;
        }

        // 2-min Warnung
        if (in2) {
            st.lastSeen2 = now;
            if (!st.firstSeen2) st.firstSeen2 = now;
            if (!st.t2 && (now - st.firstSeen2) >= PERSIST) {
                st.t2 = true;
                const col = (typeof getAirspaceStyle === 'function') ? getAirspaceStyle(as).color : '#ffffff';
                _awPulseOnMap(as, col);
                _awPulseOnProfileBand(as);
                window.vpBgNeedsUpdate = true;
                console.log(`[AWM] ✈ ${as.name} (${typeKey}) in ${Math.round(earliest2)} min`);
                _awPlaySequence(['aw-achtung', ..._awTypeClips(as), 'aw-in', _awMinKey(Math.round(earliest2)) || 'aw-2min', ..._awGetFreqClips(as)]);
                _awShowFreqBanner(as, col);
                // Kette starten: gleiche Klasse dahinter nicht nochmals ansagen
                if (typeKey && _awTypeChain.has(typeKey)) _awTypeChain.get(typeKey).warnedAt = now;
            }
        } else if (st.lastSeen2 && (now - st.lastSeen2) > STICKY) {
            st.t2 = false; st.firstSeen2 = 0; st.lastSeen2 = 0;
        }

        // 5-min Warnung (nur wenn kein 2-min Schnitt aktiv)
        if (in5 && !in2) {
            st.lastSeen5 = now;
            if (!st.firstSeen5) st.firstSeen5 = now;
            if (!st.t5 && (now - st.firstSeen5) >= PERSIST) {
                st.t5 = true;
                const col = (typeof getAirspaceStyle === 'function') ? getAirspaceStyle(as).color : '#ffffff';
                _awPulseOnMap(as, col);
                _awPulseOnProfileBand(as);
                window.vpBgNeedsUpdate = true;
                console.log(`[AWM] ✈ ${as.name} (${typeKey}) in ${Math.round(earliest5)} min`);
                _awPlaySequence(['aw-achtung', ..._awTypeClips(as), 'aw-in', _awMinKey(Math.round(earliest5)) || 'aw-5min', ..._awGetFreqClips(as)]);
                _awShowFreqBanner(as, col);
                // Kette starten: gleiche Klasse dahinter nicht nochmals ansagen
                if (typeKey && _awTypeChain.has(typeKey)) _awTypeChain.get(typeKey).warnedAt = now;
            }
        } else if (!in2 && st.lastSeen5 && (now - st.lastSeen5) > STICKY) {
            st.t5 = false; st.firstSeen5 = 0; st.lastSeen5 = 0;
        }
    }
}

/**
 * Tile-Koordinaten aus lat/lon berechnen (Slippy Map)
 */
function _tawsLatLonToTile(lat, lon, zoom) {
    const n = Math.pow(2, zoom);
    const xTile = Math.floor((lon + 180) / 360 * n);
    const latRad = lat * Math.PI / 180;
    const yTile = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n);
    return { x: xTile, y: yTile };
}

/**
 * Pixel-Position innerhalb eines 256x256 Tiles
 */
function _tawsLatLonToPixel(lat, lon, zoom) {
    const n = Math.pow(2, zoom);
    const xFloat = (lon + 180) / 360 * n;
    const latRad = lat * Math.PI / 180;
    const yFloat = (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n;

    const tile = { x: Math.floor(xFloat), y: Math.floor(yFloat) };
    const px = Math.floor((xFloat - tile.x) * 256);
    const py = Math.floor((yFloat - tile.y) * 256);

    return { tile, px: Math.min(px, 255), py: Math.min(py, 255) };
}

/**
 * Einzelnes Tile laden und als ImageData cachen
 */
function _tawsLoadTile(tileX, tileY, zoom) {
    const key = `${zoom}/${tileX}/${tileY}`;
    if (_tawsTileCache.has(key)) return Promise.resolve(_tawsTileCache.get(key));

    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            _tawsCtx.clearRect(0, 0, 256, 256);
            _tawsCtx.drawImage(img, 0, 0, 256, 256);
            const imageData = _tawsCtx.getImageData(0, 0, 256, 256);

            // Cache-Eviction: aelteste Eintraege entfernen
            if (_tawsTileCache.size >= TAWS_CACHE_MAX) {
                const oldest = _tawsTileCache.keys().next().value;
                _tawsTileCache.delete(oldest);
            }
            _tawsTileCache.set(key, imageData);
            resolve(imageData);
        };
        img.onerror = () => reject(new Error(`TAWS tile load failed: ${key}`));
        img.src = TAWS_TILE_URL.replace('{z}', zoom).replace('{x}', tileX).replace('{y}', tileY);
    });
}

function _tawsDecodeElevationFt(imageData, px, py) {
    if (!imageData?.data) return null;
    const safePx = Math.max(0, Math.min(255, Math.floor(Number(px) || 0)));
    const safePy = Math.max(0, Math.min(255, Math.floor(Number(py) || 0)));
    const idx = (safePy * 256 + safePx) * 4;
    const r = imageData.data[idx];
    const g = imageData.data[idx + 1];
    const b = imageData.data[idx + 2];
    if (![r, g, b].every(Number.isFinite)) return null;
    const elevM = (r * 256 + g + b / 256) - 32768;
    return Math.round(elevM * 3.28084);
}

async function sampleTerrainElevationAtZoom(lat, lon, zoom = TAWS_TILE_ZOOM) {
    const { tile, px, py } = _tawsLatLonToPixel(lat, lon, zoom);
    const imageData = await _tawsLoadTile(tile.x, tile.y, zoom);
    return _tawsDecodeElevationFt(imageData, px, py);
}

/**
 * Terrain-Hoehe an einem Punkt abtasten (in Fuss)
 * @param {number} lat
 * @param {number} lon
 * @returns {Promise<number>} Elevation in feet MSL
 */
async function sampleTerrainElevation(lat, lon) {
    return sampleTerrainElevationAtZoom(lat, lon, TAWS_TILE_ZOOM);
}

/**
 * Hoechsten topographischen Punkt in einem kreisfoermigen Arbeitsgebiet bestimmen.
 * Die Missionsplanung nutzt dafuer bewusst eine feinere Kachelstufe als das Live-TAWS.
 * @returns {Promise<{centerFt:number,maxFt:number,radiusNm:number,zoom:number,sampleCount:number}>}
 */
async function sampleTerrainEnvelope(lat, lon, radiusNm = 1, options = {}) {
    const centerLat = Number(lat);
    const centerLon = Number(lon);
    if (!Number.isFinite(centerLat) || !Number.isFinite(centerLon)) throw new Error('invalid-terrain-center');

    const safeRadiusNm = Math.max(0.1, Math.min(5, Number(radiusNm) || 1));
    const radiusM = safeRadiusNm * 1852;
    const zoom = Math.max(8, Math.min(13, Math.round(Number(options.zoom) || TAWS_MISSION_TERRAIN_ZOOM)));
    const cosLat = Math.max(0.15, Math.cos(centerLat * Math.PI / 180));
    const rasterM = 156543.03392 * cosLat / Math.pow(2, zoom);
    const stepM = Math.max(25, Math.min(80, Number(options.stepM) || rasterM));
    const latMetersPerDeg = 111320;
    const lonMetersPerDeg = latMetersPerDeg * cosLat;
    const points = [{ lat: centerLat, lon: centerLon, center: true }];

    for (let northM = -radiusM; northM <= radiusM; northM += stepM) {
        const halfWidthM = Math.sqrt(Math.max(0, radiusM * radiusM - northM * northM));
        for (let eastM = -halfWidthM; eastM <= halfWidthM; eastM += stepM) {
            points.push({
                lat: centerLat + northM / latMetersPerDeg,
                lon: centerLon + eastM / lonMetersPerDeg,
                center: false
            });
        }
    }

    // Der Rand gehoert zum Arbeitsgebiet und wird unabhaengig vom quadratischen Raster erfasst.
    const ringSamples = Math.max(24, Math.ceil((2 * Math.PI * radiusM) / stepM));
    for (let i = 0; i < ringSamples; i++) {
        const angle = (i / ringSamples) * Math.PI * 2;
        const northM = Math.cos(angle) * radiusM;
        const eastM = Math.sin(angle) * radiusM;
        points.push({
            lat: centerLat + northM / latMetersPerDeg,
            lon: centerLon + eastM / lonMetersPerDeg,
            center: false
        });
    }

    const tileRefs = new Map();
    for (const point of points) {
        const pixel = _tawsLatLonToPixel(point.lat, point.lon, zoom);
        point.pixel = pixel;
        const key = `${zoom}/${pixel.tile.x}/${pixel.tile.y}`;
        if (!tileRefs.has(key)) tileRefs.set(key, pixel.tile);
    }

    const loaded = await Promise.all([...tileRefs.entries()].map(async ([key, tile]) => {
        const imageData = await _tawsLoadTile(tile.x, tile.y, zoom);
        return [key, imageData];
    }));
    const imageByTile = new Map(loaded);
    let centerFt = null;
    let maxFt = -Infinity;
    let sampleCount = 0;
    for (const point of points) {
        const { tile, px, py } = point.pixel;
        const imageData = imageByTile.get(`${zoom}/${tile.x}/${tile.y}`);
        const elevFt = _tawsDecodeElevationFt(imageData, px, py);
        if (!Number.isFinite(elevFt)) continue;
        if (point.center) centerFt = elevFt;
        if (elevFt > maxFt) maxFt = elevFt;
        sampleCount += 1;
    }
    if (!Number.isFinite(centerFt) || !Number.isFinite(maxFt)) throw new Error('terrain-envelope-empty');
    return {
        centerFt: Math.round(centerFt),
        maxFt: Math.round(maxFt),
        radiusNm: safeRadiusNm,
        zoom,
        sampleCount
    };
}

window.sampleTerrainEnvelope = sampleTerrainEnvelope;

/**
 * Terrain entlang eines Pfades pruefen (Prediction-Punkte)
 * @param {Array<{lat, lon, alt, min}>} points - Prediction-Punkte mit projizierter Hoehe
 * @returns {Promise<Array<{lat, lon, terrainFt, aircraftFt, threat}>>}
 */
async function checkTerrainAlongPath(points) {
    if (!points || points.length === 0) return [];

    // Alle benoetigten Tiles vorladen (oft nur 1-2 verschiedene)
    const tileKeys = new Set();
    const tilePromises = [];
    for (const p of points) {
        const { tile } = _tawsLatLonToPixel(p.lat, p.lon, TAWS_TILE_ZOOM);
        const key = `${TAWS_TILE_ZOOM}/${tile.x}/${tile.y}`;
        if (!tileKeys.has(key)) {
            tileKeys.add(key);
            tilePromises.push(_tawsLoadTile(tile.x, tile.y, TAWS_TILE_ZOOM).catch(() => null));
        }
    }
    await Promise.all(tilePromises);

    // Jetzt synchron sampeln (alles im Cache)
    const results = [];
    let hasImmediateThreat = false;  // Nur Punkte ≤ 1 Minute → Voice-Alert

    for (const p of points) {
        try {
            const terrainFt = await sampleTerrainElevation(p.lat, p.lon);
            const aircraftFt = p.alt;
            const clearance = aircraftFt - terrainFt;

            let threat = 'green';
            if (clearance < TAWS_SAFETY_RED) {
                threat = 'red';
                // Voice nur wenn Kollision in ≤ 15 Sekunden
                if ((p.min ?? 99) <= 0.25) hasImmediateThreat = true;
            } else if (clearance < TAWS_SAFETY_AMBER) {
                threat = 'amber';
            }

            results.push({ lat: p.lat, lon: p.lon, terrainFt, aircraftFt, threat });
        } catch (e) {
            results.push({ lat: p.lat, lon: p.lon, terrainFt: 0, aircraftFt: p.alt, threat: 'green' });
        }
    }

    // Voice-Alert: nur bei unmittelbarer Gefahr, nicht beim Landen
    if (hasImmediateThreat) {
        if (!_awmTerrainWarn) return results;
        // Landing-Suppression: GS < 65 kts → Landephase, kein Alert
        const gs = (window.lastLiveGpsPos && window.lastLiveGpsPos.gs) || 0;
        const isLanding = gs > 5 && gs < 75;

        const now = Date.now();
        if (!isLanding && now - _tawsLastVoiceAlert > TAWS_VOICE_COOLDOWN) {
            _tawsLastVoiceAlert = now;
            // Whoop-Whoop und Sprachsample gemeinsam einreihen. So warten beide
            // auf eine laufende Pax Voice und bleiben als eine Warnung zusammen.
            _awPlaySequence(['taws-whoop', 'taws-alert']);
        }
    }

    return results;
}
