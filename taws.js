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
const TAWS_VOICE_COOLDOWN = 20000; // 20 Sekunden

// ── Audio-System (iOS-sicher via AudioContext) ────────────────────────────────
// speechSynthesis funktioniert im iOS-PWA-Modus nicht zuverlässig.
// Primärer Alert: AudioContext-Synthesizer (identisch zum Mini-Spiel → funktioniert).
// Sekundär: speechSynthesis als Desktop-Fallback.

let _tawsAudioCtx = null;
let _tawsAlertAudio = null;   // HTMLAudioElement für "Terrain terrain pull up"
let _tawsSpeechUnlocked = false;

function _tawsInitAudio() {
    // AudioContext für Whoop-Whoop-Ton
    if (!_tawsAudioCtx) {
        try {
            _tawsAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
        } catch(e) { _tawsAudioCtx = null; }
    }
    if (_tawsAudioCtx && _tawsAudioCtx.state === 'suspended') _tawsAudioCtx.resume();

    // HTMLAudioElement vorausladen – iOS entsperrt Audio nur bei User-Geste
    if (!_tawsAlertAudio) {
        _tawsAlertAudio = new Audio('./taws-alert.m4a');
        _tawsAlertAudio.preload = 'auto';
        // Stilles Play+Pause um iOS-Unlock auszulösen
        _tawsAlertAudio.volume = 0;
        const p = _tawsAlertAudio.play();
        if (p) p.then(() => { _tawsAlertAudio.pause(); _tawsAlertAudio.currentTime = 0; _tawsAlertAudio.volume = 1; }).catch(() => {});
    }
}

// "Whoop Whoop" – klassischer GPWS-Warntton (zwei aufsteigende Sweeps)
function _tawsPlayWhoopWhoop() {
    if (!_tawsAudioCtx) return;
    if (_tawsAudioCtx.state === 'suspended') _tawsAudioCtx.resume();
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
}

function _tawsUnlockAll() {
    _tawsInitAudio();
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
        const gs = window.smoothedGS || 0;
        const isLanding = gs > 5 && gs < 65;

        const now = Date.now();
        if (!isLanding && now - _tawsLastVoiceAlert > TAWS_VOICE_COOLDOWN) {
            _tawsLastVoiceAlert = now;
            // 1) Voraufgezeichnetes Sample (primär – funktioniert auf iOS PWA)
            if (_tawsAlertAudio) {
                _tawsAlertAudio.currentTime = 0;
                _tawsAlertAudio.volume = 1;
                _tawsAlertAudio.play().catch(() => {});
            }
            // 2) Whoop-Whoop-Ton via AudioContext (läuft parallel zum Sample)
            _tawsPlayWhoopWhoop();
        }
    }

    return results;
}
