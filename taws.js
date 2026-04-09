/* === TAWS - Terrain Awareness & Warning System (v1) === */
/* Nutzt kostenlose Terrarium RGB Tiles (AWS Open Data)    */
/* Kein API-Key, keine Rate-Limits                         */

const TAWS_TILE_ZOOM = 10;
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

function _tawsInitAudio() {
    if (!_tawsAudioCtx) {
        try {
            _tawsAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
        } catch(e) { _tawsAudioCtx = null; }
    }
    // Alle Clips laden sobald AudioContext bereit — inkl. taws-alert (kein HTMLAudioElement mehr)
    if (!_awLoaded && !_awLoading) _awLoadClips();
}

// Intern: AudioContext aufwecken und danach callback ausführen
function _tawsResumeThen(fn) {
    if (!_tawsAudioCtx) return;
    if (_tawsAudioCtx.state === 'suspended') {
        console.warn('[TAWS] AudioContext noch suspended beim Playback — resume() ohne User-Gesture!');
        _tawsAudioCtx.resume().then(fn).catch(() => {});
    } else {
        fn();
    }
}

// "Whoop Whoop" – klassischer GPWS-Warntton (zwei aufsteigende Sweeps)
function _tawsPlayWhoopWhoop() {
    if (!_tawsAudioCtx) return;
    _tawsResumeThen(() => {
        const now = _tawsAudioCtx.currentTime;
        for (let i = 0; i < 2; i++) {
            const osc  = _tawsAudioCtx.createOscillator();
            const gain = _tawsAudioCtx.createGain();
            osc.connect(gain);
            gain.connect(_tawsAudioCtx.destination);
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
        }
    });
}

function _tawsUnlockAll() {
    _tawsInitAudio();
    // iOS PFLICHT: AudioContext.resume() MUSS aus einem User-Gesture-Handler heraus
    // aufgerufen werden. Danach bleibt der Context 'running' und kann jederzeit
    // per _tawsResumeThen() verwendet werden.
    if (_tawsAudioCtx && _tawsAudioCtx.state === 'suspended') {
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
document.addEventListener('touchstart', _tawsUnlockAll, { once: true, passive: true });
document.addEventListener('click',      _tawsUnlockAll, { once: true });

// ── Airspace Warning Module (AWM) ─────────────────────────────────────────────
// Spielt dynamisch zusammengesetzte Ansagen via AudioContext ab (iOS-sicher).
// Clips: audio-warnings/aw-*.m4a — erzeugt mit Anna Premium de_DE.

const _AWM_CLIPS = [
    'aw-achtung','aw-in',
    'aw-ctr','aw-charlie','aw-delta','aw-rmz','aw-tmz',
    'aw-1min','aw-2min','aw-3min','aw-4min','aw-5min',
    'aw-6min','aw-7min','aw-8min','aw-9min','aw-10min',
    'taws-alert'
];
const _awBuffers   = {};           // key → AudioBuffer
let   _awLoaded    = false;
let   _awLoading   = false;

// State pro Luftraum: { t5, t2, t5in, t2in, firstSeen5, firstSeen2 }
const _awState = new Map();
// Serielle Abspielqueue: verhindert gleichzeitige Ansagen
let _awQueueBusy = false;
const _awQueue = [];

function _awEnqueue(keys) {
    _awQueue.push(keys);
    if (!_awQueueBusy) _awDrainQueue();
}

function _awDrainQueue() {
    if (!_awQueue.length) { _awQueueBusy = false; return; }
    _awQueueBusy = true;
    const keys = _awQueue.shift();
    if (!_tawsAudioCtx || !_awLoaded) { _awDrainQueue(); return; }
    _tawsResumeThen(() => {
        let t = _tawsAudioCtx.currentTime + 0.15;
        let totalDur = 0;
        for (const key of keys) {
            const buf = _awBuffers[key];
            if (!buf) { console.warn('[AWM] Buffer fehlt:', key); continue; }
            const src = _tawsAudioCtx.createBufferSource();
            src.buffer = buf;
            src.connect(_tawsAudioCtx.destination);
            src.start(t);
            totalDur += buf.duration + 0.08;
            t += buf.duration + 0.08;
        }
        // Nächste Ansage erst nach Ende dieser starten
        setTimeout(_awDrainQueue, Math.max(0, totalDur * 1000));
    });
}

async function _awLoadClips() {
    if (_awLoaded || _awLoading || !_tawsAudioCtx) return;
    _awLoading = true;
    await Promise.all(_AWM_CLIPS.map(async key => {
        // taws-alert liegt im Root, alle anderen in audio-warnings/
        const url = key === 'taws-alert'
            ? './taws-alert.m4a'
            : './audio-warnings/' + key + '.m4a';
        try {
            const r  = await fetch(url);
            const ab = await r.arrayBuffer();
            _awBuffers[key] = await _tawsAudioCtx.decodeAudioData(ab);
        } catch(e) { console.warn('[AWM] Clip laden fehlgeschlagen:', key, e); }
    }));
    _awLoaded  = true;
    _awLoading = false;
    console.log('[AWM] Alle Clips geladen:', Object.keys(_awBuffers).join(', '));
}

// Ansage in serielle Queue einreihen
function _awPlaySequence(keys) {
    if (!_tawsAudioCtx || !_awLoaded) return;
    _awEnqueue(keys);
}

// Luftraum-Typ → Audio-Key (null = kein Alert für diesen Typ)
function _awTypeKey(as) {
    const t = as.type, cls = as.icaoClass;
    if (t === 4)                return 'aw-ctr';      // CTR (Kontrollzone)
    if (cls === 2)              return 'aw-charlie';  // Class C
    if (cls === 3 || t === 0)   return 'aw-delta';    // Class D
    if (t === 7 || t === 26)    return 'aw-ctr';      // TMA / CTA → wie CTR ansagen
    if (t === 5 || t === 27)    return 'aw-tmz';      // TMZ
    if (t === 6 || t === 28)    return 'aw-rmz';      // RMZ
    return null;   // Restricted/Danger/FIS → kein Sprach-Alert
}

// Minuten-Zahl → Audio-Key
function _awMinKey(min) {
    const n = Math.round(min);
    const k = ['','aw-1min','aw-2min','aw-3min','aw-4min','aw-5min',
                  'aw-6min','aw-7min','aw-8min','aw-9min','aw-10min'];
    return (n >= 1 && n <= 10) ? k[n] : null;
}

/**
 * Vorhersage-Punkte gegen aktive Lufträume prüfen und ggf. Ansage abspielen.
 * Vereinfachte Version: Sobald irgendein predPoint im Luftraum liegt → "Achtung [Typ]".
 * Kein Zeitmarker, 30s Cooldown pro Luftraum.
 */
function checkAirspaceWarnings(predPoints) {
    if (!_awLoaded) { _awLoadClips(); return; }
    if (!_tawsAudioCtx) return;
    if (typeof activeAirspaces === 'undefined' || !activeAirspaces.length) return;
    if (typeof vpPointInPoly === 'undefined' || typeof airspaceLimitToFt === 'undefined') return;
    // Hinweis: GS-Check entfällt — outer block in sync.js ruft uns nur bei GS > 30 auf,
    // und window.smoothedGS wäre ohnehin undefined (let-Variable in sync.js).

    for (const as of activeAirspaces) {
        if (!as.geometry) continue;
        if (as.type === 33) continue;  // FIS: kein Alert

        const typeKey = _awTypeKey(as) || 'aw-ctr';

        // Höhengrenzen (mit großzügigem Puffer — fehlende Limits werden toleriert)
        let effLower = 0, effUpper = 99999;
        if (as.lowerLimit && as.upperLimit && typeof airspaceLimitToFt === 'function') {
            const lo = airspaceLimitToFt(as.lowerLimit);
            const hi = airspaceLimitToFt(as.upperLimit);
            if (lo !== null) effLower = (as.lowerLimit.referenceDatum === 0) ? 0 : lo;
            if (hi !== null) effUpper = hi;
        }

        // Polygone
        const polys = [];
        if (as.geometry.type === 'Polygon')
            polys.push(as.geometry.coordinates[0]);
        else if (as.geometry.type === 'MultiPolygon')
            as.geometry.coordinates.forEach(mc => polys.push(mc[0]));
        if (!polys.length) continue;

        // Stabiler State-Key
        const asKey = `${as.type}_${as.name || 'x'}_${Math.round(effLower)}`;
        if (!_awState.has(asKey)) _awState.set(asKey, { t5: false, t2: false, firstSeen5: 0, firstSeen2: 0 });
        const st = _awState.get(asKey);

        // Frühesten Schnittpunkt ≤5 min und ≤2 min finden
        let earliest5 = null, earliest2 = null;
        for (const pt of predPoints) {
            if (pt.min > 5) continue;
            // Höhencheck ±1500 ft Puffer
            if (pt.alt < effLower - 1500 || pt.alt > effUpper + 1500) continue;
            let inside = false;
            for (const poly of polys) {
                if (vpPointInPoly({ lat: pt.lat, lon: pt.lon }, poly)) { inside = true; break; }
            }
            if (!inside) continue;
            if (earliest5 === null || pt.min < earliest5) earliest5 = pt.min;
            if (pt.min <= 2 && (earliest2 === null || pt.min < earliest2)) earliest2 = pt.min;
        }

        const in5 = earliest5 !== null;
        const in2 = earliest2 !== null;
        const PERSIST = 5000; // ms Persistenz vor Auslösung

        // 2-min Warnung
        if (in2) {
            if (!st.firstSeen2) st.firstSeen2 = now;   // Eintrittszeit setzen
            if (!st.t2 && (now - st.firstSeen2) >= PERSIST) {
                st.t2 = true;
                console.log(`[AWM] ✈ ${as.name} (${typeKey}) ≤2 min`);
                _awPlaySequence(['aw-achtung', typeKey, 'aw-in', 'aw-2min']);
            }
        } else {
            st.t2 = false;
            st.firstSeen2 = 0;
        }

        // 5-min Warnung (nur wenn kein 2-min Schnitt)
        if (in5 && !in2) {
            if (!st.firstSeen5) st.firstSeen5 = now;
            if (!st.t5 && (now - st.firstSeen5) >= PERSIST) {
                st.t5 = true;
                console.log(`[AWM] ✈ ${as.name} (${typeKey}) ≤5 min`);
                _awPlaySequence(['aw-achtung', typeKey, 'aw-in', 'aw-5min']);
            }
        } else {
            st.t5 = false;
            st.firstSeen5 = 0;
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

/**
 * Terrain-Hoehe an einem Punkt abtasten (in Fuss)
 * @param {number} lat
 * @param {number} lon
 * @returns {Promise<number>} Elevation in feet MSL
 */
async function sampleTerrainElevation(lat, lon) {
    const { tile, px, py } = _tawsLatLonToPixel(lat, lon, TAWS_TILE_ZOOM);
    const imageData = await _tawsLoadTile(tile.x, tile.y, TAWS_TILE_ZOOM);

    const idx = (py * 256 + px) * 4;
    const r = imageData.data[idx];
    const g = imageData.data[idx + 1];
    const b = imageData.data[idx + 2];

    // Terrarium encoding: elevation_m = (R * 256 + G + B / 256) - 32768
    const elevM = (r * 256 + g + b / 256) - 32768;
    return Math.round(elevM * 3.28084); // -> feet
}

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
                // Voice nur wenn Kollision in ≤ 60 Sekunden
                if ((p.min ?? 99) <= 1) hasImmediateThreat = true;
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
        // Landing-Suppression: GS < 65 kts → Landephase, kein Alert
        const gs = (window.lastLiveGpsPos && window.lastLiveGpsPos.gs) || 0;
        const isLanding = gs > 5 && gs < 75;

        const now = Date.now();
        if (!isLanding && now - _tawsLastVoiceAlert > TAWS_VOICE_COOLDOWN) {
            _tawsLastVoiceAlert = now;
            // Whoop-Whoop + Sprachsample via AudioContext (kein HTMLAudioElement mehr)
            _tawsPlayWhoopWhoop();
            _awPlaySequence(['taws-alert']);
        }
    }

    return results;
}
