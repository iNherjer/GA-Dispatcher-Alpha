/* Web-App flight logbook: free flights from the cloud logbook and the flight path
 * (map + height profile) inside the flight debrief. Web only; the shared
 * flight-debrief.js (also used by the EFB) stays unchanged.
 * Concept: docs/Flugbuch Kruemelweg Konzept.md */
(function () {
'use strict';

const BASE_URL = 'https://ga-proxy.einherjer.workers.dev/api/flightlog-v1/';
const SHOW_FREE_KEY = 'ga_logbook_show_free';
const STALE_MS = 2 * 60 * 1000;
const MATCH_WINDOW_MS = 15 * 60 * 1000;
const state = { pilot: '', entries: [], revision: null, loadedAt: 0, inflight: null, cacheRead: false };
let activeMap = null;

// ---- small persistent cache (IndexedDB; falls back to memory) ----------------------------
const memoryCache = new Map();
let dbPromise = null;
function db() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(resolve => {
        try {
            const request = indexedDB.open('ga-flight-logbook', 1);
            request.onupgradeneeded = () => request.result.createObjectStore('kv');
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => resolve(null);
        } catch (_) { resolve(null); }
    });
    return dbPromise;
}
async function cacheGet(key) {
    if (memoryCache.has(key)) return memoryCache.get(key);
    const handle = await db();
    if (!handle) return undefined;
    return new Promise(resolve => {
        try {
            const request = handle.transaction('kv', 'readonly').objectStore('kv').get(key);
            request.onsuccess = () => { if (request.result !== undefined) memoryCache.set(key, request.result); resolve(request.result); };
            request.onerror = () => resolve(undefined);
        } catch (_) { resolve(undefined); }
    });
}
async function cacheSet(key, value) {
    memoryCache.set(key, value);
    const handle = await db();
    if (!handle) return;
    try { handle.transaction('kv', 'readwrite').objectStore('kv').put(value, key); } catch (_) {}
}

// ---- cloud access -------------------------------------------------------------------------
function credentials() {
    const pilot = typeof getSyncId === 'function' ? String(getSyncId() || '').trim() : '';
    const pin = typeof getSyncPin === 'function' ? String(getSyncPin() || '').trim() : '';
    return pilot && pin ? { pilot, pin } : null;
}
async function call(path, body) {
    const auth = credentials();
    if (!auth) throw new Error('not_signed_in');
    const response = await fetch(BASE_URL + path, {
        method: body ? 'POST' : 'GET',
        headers: { 'X-Pilot-ID': auth.pilot, 'X-Pilot-PIN': auth.pin, ...(body ? { 'Content-Type': 'application/json' } : {}) },
        body: body ? JSON.stringify(body) : undefined
    });
    let data = null;
    try { data = await response.json(); } catch (_) {}
    if (!response.ok) throw new Error(data?.error || `http_${response.status}`);
    return data;
}

function rerender() { try { window.renderLog?.(); } catch (_) {} }

// Loads the entry list (without tracks). Cheap when unchanged: the worker answers `unchanged`.
function refresh(options = {}) {
    const auth = credentials();
    if (!auth) { state.entries = []; state.pilot = ''; return Promise.resolve(false); }
    if (state.pilot !== auth.pilot) { state.pilot = auth.pilot; state.entries = []; state.revision = null; state.loadedAt = 0; state.cacheRead = false; }
    if (state.inflight) return state.inflight;
    if (!options.force && Date.now() - state.loadedAt < STALE_MS) return Promise.resolve(false);
    const key = 'list:' + auth.pilot.toUpperCase();
    state.inflight = (async () => {
        let changed = false;
        if (!state.cacheRead) {
            state.cacheRead = true;
            const cached = await cacheGet(key);
            if (cached && Array.isArray(cached.entries)) { state.entries = cached.entries; state.revision = cached.revision; changed = true; rerender(); }
        }
        try {
            const data = await call('list' + (state.revision != null ? `?since=${encodeURIComponent(state.revision)}` : ''));
            state.loadedAt = Date.now();
            if (!data?.unchanged && Array.isArray(data?.entries)) {
                state.entries = data.entries;
                state.revision = data.revision;
                await cacheSet(key, { revision: data.revision, entries: data.entries });
                changed = true;
                rerender();
            }
        } catch (error) {
            state.loadedAt = Date.now() - STALE_MS + 30000; // retry in 30 s
            try { console.warn('[Flugbuch] Cloud-Flugbuch nicht geladen:', error?.message || error); } catch (_) {}
        }
        return changed;
    })().finally(() => { state.inflight = null; });
    return state.inflight;
}

async function getTrack(runId) {
    const key = 'track:' + runId;
    const cached = await cacheGet(key);
    if (cached?.enc) return cached;
    const data = await call('track/' + encodeURIComponent(runId));
    if (data?.track?.enc) await cacheSet(key, data.track);
    return data?.track || null;
}

// ---- logbook entries ----------------------------------------------------------------------
function showFree() {
    try { return localStorage.getItem(SHOW_FREE_KEY) !== '0'; } catch (_) { return true; }
}
function setShowFree(value) {
    try { localStorage.setItem(SHOW_FREE_KEY, value ? '1' : '0'); } catch (_) {}
    rerender();
}

// Airport within 3 NM of the takeoff/landing point, otherwise coordinates (fields, strips).
let airportsRequested = false;
const labelCache = new Map(); // resolved labels; the airport list is large
function airportMap() {
    try { return typeof globalAirports === 'object' && globalAirports ? globalAirports : null; } catch (_) { return null; }
}
function placeLabel(position, fallback) {
    const lat = Number(position?.lat), lon = Number(position?.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return fallback;
    const coords = `${lat.toFixed(3)}, ${lon.toFixed(3)}`;
    const airports = airportMap();
    if (!airports) {
        if (!airportsRequested && typeof loadGlobalAirports === 'function') {
            airportsRequested = true;
            Promise.resolve(loadGlobalAirports()).then(() => { if (airportMap()) rerender(); }).catch(() => {});
        }
        return coords;
    }
    const key = `${lat.toFixed(4)},${lon.toFixed(4)}`;
    if (labelCache.has(key)) return labelCache.get(key);
    const cosLat = Math.cos(lat * Math.PI / 180);
    let best = '', bestNm = Infinity;
    for (const [icao, a] of Object.entries(airports)) {
        if (!a || !Number.isFinite(a.lat) || !Number.isFinite(a.lon)) continue;
        const nm = Math.hypot(a.lat - lat, (a.lon - lon) * cosLat) * 60;
        if (nm < bestNm) { bestNm = nm; best = icao; }
    }
    const label = best && bestNm <= 3 ? best : coords;
    labelCache.set(key, label);
    return label;
}

// Free flights in the shape of local logbook records.
function freeEntries() {
    return state.entries.filter(e => e?.kind === 'free').map(e => {
        const createdAt = Number(e.endTs || e.createdAt) || 0;
        return {
            ...e,
            kind: 'free',
            createdAt,
            date: createdAt ? new Date(createdAt).toLocaleString('de-DE') : '—',
            start: placeLabel(e.depPosition, 'START'),
            dest: placeLabel(e.arrPosition, 'LANDUNG'),
            ac: e.aircraft || e.ac || '',
            mission: 'Freier Flug',
            missionTitle: 'Freier Flug'
        };
    });
}

// Local mission logbook plus (optionally) free flights, newest first.
// Mission entries written by the tracker (full logbook record in the cloud flight logbook).
function cloudMissionEntries() {
    return state.entries.filter(e => e?.kind === 'mission' && e.hasLogbookRecord === true).map(e => {
        const createdAt = Number(e.createdAt || e.endedAt || e.endTs) || 0;
        return { ...e, kind: 'mission', createdAt, date: e.date || (createdAt ? new Date(createdAt).toLocaleString('de-DE') : '—') };
    });
}

// Cloud mission entries (tracker) + older local entries without a cloud counterpart + free flights.
function mergedEntries(missionEntries) {
    const cloud = cloudMissionEntries();
    const runIds = new Set(cloud.map(e => e.runId).filter(Boolean));
    const completionIds = new Set(cloud.map(e => e.completionId).filter(Boolean));
    const legacy = (Array.isArray(missionEntries) ? missionEntries : [])
        .filter(e => e && typeof e === 'object' && !e.deleted)
        .filter(e => !(e.runId && runIds.has(e.runId)) && !completionIds.has(e.completionId));
    const time = e => Number(e.createdAt || e.endedAt || e.endTs || 0) || 0;
    return cloud.concat(legacy, showFree() ? freeEntries() : []).sort((a, b) => time(b) - time(a));
}

function trackRunIdFor(entry) {
    if (entry?.kind === 'free') return entry.hasTrack === false ? '' : entry.runId;
    const missions = state.entries.filter(e => e?.kind === 'mission' && e.hasTrack !== false);
    if (entry?.runId) {
        const exact = missions.find(e => e.runId === entry.runId);
        if (exact) return exact.runId;
    }
    const ended = Number(entry?.createdAt || entry?.endedAt || 0);
    if (!entry?.missionId || !ended) return '';
    const candidates = missions.filter(e => e.missionId === entry.missionId && Math.abs(Number(e.endTs || 0) - ended) <= MATCH_WINDOW_MS);
    candidates.sort((a, b) => Math.abs(a.endTs - ended) - Math.abs(b.endTs - ended));
    return candidates[0]?.runId || '';
}

// ---- debrief with flight path --------------------------------------------------------------
function openEntry(entry) {
    if (typeof window.showFlightDebrief !== 'function') return;
    installDebriefGuard();
    if (activeMap) { try { activeMap.remove(); } catch (_) {} activeMap = null; }
    window.showFlightDebrief(entry, { awaitingCleanup: false });
    const body = document.getElementById('flightDebriefBody');
    if (!body) return;
    if (entry?.result === 'aborted') {
        const meta = body.querySelector('.flight-debrief-meta');
        if (meta) meta.textContent = `${entry.dateLabel || entry.date || ''} · ABGEBROCHEN`;
    }
    if (entry?.kind === 'free') {
        const meta = body.querySelector('.flight-debrief-meta');
        if (meta) meta.textContent = `${entry.date || ''} · FREIER FLUG`;
        // Passenger and cargo sections describe missions only.
        body.querySelectorAll('.flight-debrief-section').forEach(section => {
            if (/Passagierkomfort|Ladungssicherheit/.test(section.querySelector('h3')?.textContent || '')) section.remove();
        });
    }
    addDeleteButton(entry);
    renderOutcomeSection(body, entry);
    const runId = trackRunIdFor(entry);
    const section = document.createElement('section');
    section.className = 'flight-debrief-section flight-track-section';
    const heading = document.createElement('h3');
    heading.textContent = 'Flugweg';
    const status = document.createElement('p');
    status.className = 'flight-track-status';
    section.append(heading, status);
    const anchor = body.querySelector('.flight-outcome-section') || body.querySelector('.flight-debrief-metrics');
    if (anchor?.nextSibling) body.insertBefore(section, anchor.nextSibling); else body.appendChild(section);
    if (!runId) {
        status.textContent = state.loadedAt ? 'Für diesen Flug liegt kein Flugweg vor.' : 'Flugweg wird gesucht…';
        if (!state.loadedAt) refresh({ force: true }).then(() => { if (trackRunIdFor(entry) && section.isConnected) openEntry(entry); });
        return;
    }
    status.textContent = 'Flugweg wird geladen…';
    getTrack(runId).then(track => {
        if (!section.isConnected) return;
        if (!track) { status.textContent = 'Flugweg nicht gefunden.'; return; }
        renderTrack(section, status, track, runId);
    }).catch(error => {
        if (section.isConnected) status.textContent = `Flugweg konnte nicht geladen werden (${error?.message || error}).`;
    });
}

function fmt(n) { return Math.round(n).toLocaleString('de-DE'); }
function altitudeColor(t) {
    // low = blue, high = red
    const hue = Math.round(220 - 220 * Math.max(0, Math.min(1, t)));
    return `hsl(${hue}, 75%, 42%)`;
}

// ---- track coloring: altitude, ground speed or vertical speed -------------------------------
const COLOR_MODE_KEY = 'ga_logbook_track_color_v1';
const COLOR_MODES = Object.freeze({
    alt: { label: 'Höhe', unit: 'ft MSL' },
    gs: { label: 'Geschwindigkeit', unit: 'kt GS' },
    vs: { label: 'Steig-/Sinkrate', unit: 'ft/min' }
});
function readColorMode() {
    try { const v = localStorage.getItem(COLOR_MODE_KEY); return COLOR_MODES[v] ? v : 'alt'; } catch (_) { return 'alt'; }
}
function writeColorMode(mode) { try { localStorage.setItem(COLOR_MODE_KEY, mode); } catch (_) {} }
function percentile(values, q) {
    const list = values.filter(Number.isFinite).sort((a, b) => a - b);
    if (!list.length) return 0;
    return list[Math.min(list.length - 1, Math.max(0, Math.round((list.length - 1) * q)))];
}
// Per segment (point i-1 -> i): mean altitude, ground speed and vertical speed.
function segmentMetrics(points, codec) {
    const out = [];
    for (let i = 1; i < points.length; i++) {
        if (points[i].segmentStart) continue;
        const a = points[i - 1], b = points[i];
        const dt = b.sec - a.sec;
        out.push({ i, alt: (a.altFt + b.altFt) / 2,
            gs: dt > 0 ? codec.distanceM(a, b) / 1852 / (dt / 3600) : null,
            vs: dt > 0 ? (b.altFt - a.altFt) / dt * 60 : null });
    }
    return out;
}
// Scale per flight; robust against single outliers (95th percentile).
function colorScale(mode, segs, minAlt, maxAlt) {
    if (mode === 'gs') {
        const top = Math.max(20, Math.ceil(percentile(segs.map(s => s.gs), 0.95) / 10) * 10);
        return { mode, min: 0, max: top };
    }
    if (mode === 'vs') {
        const m = Math.max(300, Math.ceil(percentile(segs.map(s => Math.abs(s.vs)), 0.95) / 100) * 100);
        return { mode, min: -m, max: m };
    }
    return { mode, min: minAlt, max: Math.max(maxAlt, minAlt + 1) };
}
function colorFor(scale, value) {
    if (!Number.isFinite(value)) return '#94a3b8';
    if (scale.mode === 'vs') {
        // diverging: sink = blue, level = grey, climb = red
        const t = Math.max(-1, Math.min(1, value / scale.max));
        if (Math.abs(value) < 100) return 'hsl(220, 8%, 55%)';
        const strength = Math.abs(t);
        return t < 0 ? `hsl(215, ${40 + 45 * strength}%, ${62 - 22 * strength}%)` : `hsl(4, ${40 + 45 * strength}%, ${62 - 22 * strength}%)`;
    }
    return altitudeColor((value - scale.min) / (scale.max - scale.min));
}
function scaleTicks(scale) {
    const unitFmt = v => (scale.mode === 'vs' && v > 0 ? '+' : '') + fmt(v);
    if (scale.mode === 'vs') return [scale.min, 0, scale.max].map(unitFmt);
    return [scale.min, (scale.min + scale.max) / 2, scale.max].map(unitFmt);
}
function gradientFor(scale) {
    const stops = [0, 0.15, 0.35, 0.5, 0.65, 0.85, 1].map(t => colorFor(scale, scale.min + (scale.max - scale.min) * t));
    return `linear-gradient(90deg, ${stops.join(', ')})`;
}

// ---- map layers: same base maps, overlays and zoom rules as the main map ------------------
const LAYER_PREF_KEY = 'ga_logbook_map_layers_v1';
const AERO_TILE_URL = 'https://nwy-tiles-api.prod.newaydata.com/tiles/{z}/{x}/{y}.png?path=latest/aero/latest';
const AERO_HIDE_ZOOM = 15; // main map: VP_VFR_OVERLAY_AUTO_HIDE_ZOOM
function readLayerPrefs() {
    try { return JSON.parse(localStorage.getItem(LAYER_PREF_KEY) || 'null') || {}; } catch (_) { return {}; }
}
function writeLayerPrefs(prefs) {
    try { localStorage.setItem(LAYER_PREF_KEY, JSON.stringify(prefs)); } catch (_) {}
}
function buildBaseLayers() {
    const osm = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>';
    const topo = typeof createResilientOpenTopoLayer === 'function'
        ? createResilientOpenTopoLayer({ attribution: `${osm}, <a href="https://opentopomap.org" target="_blank" rel="noopener noreferrer">OpenTopoMap</a>` })
        : L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', { maxZoom: 17, subdomains: 'abc', attribution: `${osm}, OpenTopoMap` });
    const layers = {
        '⛰️ Topografie (Mit Text)': topo,
        '🗺️ Terrain (Ohne Text)': L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Shaded_Relief/MapServer/tile/{z}/{y}/{x}', { attribution: 'Tiles &copy; Esri' }),
        '🛰️ Satellit': L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { attribution: 'Tiles &copy; Esri' })
    };
    if (typeof window.createOpenFreeMapLayer === 'function') {
        try {
            layers['📝 Positron (Hell)'] = window.createOpenFreeMapLayer('positron');
            layers['🌑 Dark'] = window.createOpenFreeMapLayer('dark');
            layers['🌊 Fiord'] = window.createOpenFreeMapLayer('fiord');
        } catch (_) {}
    }
    return { layers, topo };
}

// ---- airspaces along the flown track ------------------------------------------------------
const AIRSPACE_SAMPLE_NM = 0.1;
const airspaceCache = new Map();
function limitText(limit) {
    if (!limit) return '?';
    const value = Number(limit.value);
    if (limit.referenceDatum === 0 && value === 0) return 'GND';
    if (limit.unit === 6) return `FL ${String(Math.round(value)).padStart(3, '0')}`;
    const ft = limit.unit === 0 ? Math.round(value * 3.28084) : Math.round(value);
    return `${fmt(ft)} ft ${limit.referenceDatum === 0 ? 'AGL' : 'MSL'}`;
}
function airspaceColor(as) {
    try { if (typeof getOpenAipOverlayStyle === 'function') return getOpenAipOverlayStyle(as); } catch (_) {}
    return { color: '#64748b', fillOpacity: 0.08, weight: 1.6 };
}
function airspaceName(as) {
    try { if (window.GANavigationWarningPresentation?.displayName) return window.GANavigationWarningPresentation.displayName(as); } catch (_) {}
    return String(as?.name || 'Luftraum');
}
function polygonsOf(as) {
    const g = as?.geometry;
    if (!g) return [];
    if (g.type === 'Polygon') return [g.coordinates[0]];
    if (g.type === 'MultiPolygon') return g.coordinates.map(p => p[0]);
    return [];
}
function bboxOf(polys) {
    let w = 180, s = 90, e = -180, n = -90;
    polys.forEach(poly => poly.forEach(([lon, lat]) => { if (lon < w) w = lon; if (lon > e) e = lon; if (lat < s) s = lat; if (lat > n) n = lat; }));
    return { w, s, e, n };
}

// Dense samples along the track (every ~0.1 NM) with interpolated altitude and terrain.
function densify(points, along) {
    const out = [];
    for (let i = 0; i < points.length; i++) {
        const p = points[i];
        if (i === 0 || p.segmentStart) { out.push({ ...p, x: along[i], idx: i }); continue; }
        const a = points[i - 1];
        const span = along[i] - along[i - 1];
        const steps = Math.min(40, Math.max(1, Math.ceil(span / AIRSPACE_SAMPLE_NM)));
        for (let k = 1; k <= steps; k++) {
            const f = k / steps;
            const gnd = a.gndFt !== null && p.gndFt !== null ? a.gndFt + (p.gndFt - a.gndFt) * f : (p.gndFt ?? a.gndFt);
            out.push({ lat: a.lat + (p.lat - a.lat) * f, lon: a.lon + (p.lon - a.lon) * f, altFt: a.altFt + (p.altFt - a.altFt) * f,
                gndFt: gnd, sec: a.sec + (p.sec - a.sec) * f, time: a.time + (p.time - a.time) * f, x: along[i - 1] + span * f,
                idx: f < 0.5 ? i - 1 : i, segmentStart: false, onGround: k === steps ? p.onGround : a.onGround && p.onGround });
        }
    }
    return out;
}

// Classifies each airspace whose footprint the track crosses: flown through (inside laterally and
// vertically) or only overflown/underflown. Uses the same preparation and vertical rules as the
// in-flight airspace warnings (navigation-warning-core.js).
function analyseAirspaces(items, samples) {
    const core = window.GANavigationWarnings;
    if (!core?.prepareAirspaces || !core.getAirspaceVerticalBandFt || !core.isPointInsideAirspace) return [];
    const prepared = core.prepareAirspaces(items);
    const results = [];
    prepared.forEach(as => {
        const polys = polygonsOf(as);
        if (!polys.length) return;
        const box = bboxOf(polys);
        const lateral = [], inside = [];
        let latRun = null, inRun = null, below = 0, above = 0;
        samples.forEach((s, k) => {
            if (s.segmentStart) { latRun = null; inRun = null; }
            const inBox = s.lon >= box.w && s.lon <= box.e && s.lat >= box.s && s.lat <= box.n;
            const isLateral = inBox && core.isPointInsideAirspace(as, s.lat, s.lon);
            const band = isLateral ? core.getAirspaceVerticalBandFt(as, s.gndFt ?? 0) : null;
            const isInside = !!band && s.altFt >= band.lowerFt && s.altFt <= band.upperFt;
            if (band && !isInside) { if (s.altFt < band.lowerFt) below++; else above++; }
            if (isLateral) { if (!latRun) lateral.push(latRun = { from: k, to: k }); else latRun.to = k; } else latRun = null;
            if (isInside) { if (!inRun) inside.push(inRun = { from: k, to: k }); else inRun.to = k; } else inRun = null;
        });
        if (!lateral.length) return;
        const style = airspaceColor(as);
        results.push({ as, name: airspaceName(as), style, lateral, inside,
            flownThrough: inside.length > 0, relation: below >= above ? 'unterflogen' : 'überflogen',
            limits: `${limitText(as.lowerLimit)} – ${limitText(as.upperLimit)}` });
    });
    return results;
}

async function loadAirspaces(runId, points) {
    if (airspaceCache.has(runId)) return airspaceCache.get(runId);
    if (typeof window.gaGetOpenAipRouteAirspaces !== 'function') throw new Error('airspace_data_unavailable');
    let w = 180, s = 90, e = -180, n = -90;
    points.forEach(p => { if (p.lon < w) w = p.lon; if (p.lon > e) e = p.lon; if (p.lat < s) s = p.lat; if (p.lat > n) n = p.lat; });
    const pad = 0.05;
    const items = await window.gaGetOpenAipRouteAirspaces({ west: w - pad, south: s - pad, east: e + pad, north: n + pad });
    const list = Array.isArray(items) ? items : [];
    airspaceCache.set(runId, list);
    return list;
}

function clockText(ms) { return new Date(ms).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }); }
function durationText(sec) {
    const s = Math.max(0, Math.round(sec));
    return s >= 60 ? `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, '0')} s` : `${s} s`;
}

let lastRendered = null; // model of the flight path currently shown, used by the PDF export
function renderTrack(section, status, track, runId) {
    const codec = window.GAFlightTrackCodecCore;
    let points;
    try { points = codec.decodeTrack(track); } catch (_) { status.textContent = 'Flugweg ist beschädigt.'; return; }
    if (points.length < 2) { status.textContent = 'Flugweg zu kurz.'; return; }
    const along = codec.alongTrackNm(points);
    const totalNm = along[along.length - 1];
    const alts = points.map(p => p.altFt);
    const grounds = points.map(p => p.gndFt).filter(v => v !== null);
    const minAlt = Math.min(...alts, ...(grounds.length ? grounds : alts));
    const maxAlt = Math.max(...alts);
    const segments = points.filter(p => p.segmentStart).length;
    status.textContent = `${points.length} Wegpunkte · Genauigkeit ±${track.tol?.[0] ?? 15} m / ±${track.tol?.[1] ?? 30} ft`
        + (segments > 1 ? ` · ${segments} Abschnitte (Pause oder Umsetzen)` : '');

    const mapEl = document.createElement('div');
    mapEl.className = 'flight-track-map';
    const profileWrap = document.createElement('div');
    profileWrap.className = 'flight-track-profile';
    const readout = document.createElement('div');
    readout.className = 'flight-track-readout';
    readout.textContent = 'Über das Profil oder die Linie fahren, um Werte zu sehen.';
    const airspaceBox = document.createElement('div');
    airspaceBox.className = 'flight-track-airspaces';
    airspaceBox.textContent = 'Lufträume werden geprüft…';
    // Color mode switch and legend (applies to map line and profile line).
    const segs = segmentMetrics(points, codec);
    let colorMode = readColorMode();
    let scale = colorScale(colorMode, segs, minAlt, maxAlt);
    const segValue = seg => seg[colorMode];
    const modeBar = document.createElement('div');
    modeBar.className = 'flight-track-colormode';
    modeBar.setAttribute('role', 'group');
    modeBar.setAttribute('aria-label', 'Linienfarbe');
    const modeLabel = document.createElement('span');
    modeLabel.textContent = 'Linienfarbe:';
    modeBar.appendChild(modeLabel);
    const modeButtons = Object.entries(COLOR_MODES).map(([mode, meta]) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = meta.label;
        button.dataset.mode = mode;
        button.addEventListener('click', () => setColorMode(mode));
        modeBar.appendChild(button);
        return button;
    });
    const legend = document.createElement('div');
    legend.className = 'flight-track-legend';
    let legendPointer = null, legendPointerLabel = null, lastSelection = null;
    // Places the pointer on the color scale at the value of the selected point.
    function showLegendValue(values) {
        lastSelection = values;
        if (!legendPointer) return;
        const value = values[colorMode];
        if (!Number.isFinite(value)) { legendPointer.hidden = true; return; }
        const t = Math.max(0, Math.min(1, (value - scale.min) / (scale.max - scale.min)));
        legendPointer.hidden = false;
        legendPointer.style.left = `${(t * 100).toFixed(1)}%`;
        legendPointer.style.setProperty('--pointer-color', colorFor(scale, value));
        const shown = colorMode === 'vs' ? Math.round(value / 10) * 10 : Math.round(value);
        legendPointerLabel.textContent = `${colorMode === 'vs' && shown > 0 ? '+' : ''}${fmt(shown)} ${COLOR_MODES[colorMode].unit}`
            + (value < scale.min || value > scale.max ? ' (außerhalb der Skala)' : '');
    }
    function renderLegend() {
        modeButtons.forEach(b => b.setAttribute('aria-pressed', b.dataset.mode === colorMode ? 'true' : 'false'));
        legend.replaceChildren();
        const ticks = scaleTicks(scale);
        const unit = COLOR_MODES[colorMode].unit;
        const low = document.createElement('span');
        low.textContent = colorMode === 'vs' ? `Sinken ${ticks[0]}` : ticks[0];
        const bar = document.createElement('span');
        bar.className = 'flight-track-legend-bar';
        bar.style.background = gradientFor(scale);
        const mid = document.createElement('span');
        mid.className = 'flight-track-legend-mid';
        mid.textContent = ticks[1];
        bar.appendChild(mid);
        const high = document.createElement('span');
        high.textContent = colorMode === 'vs' ? `${ticks[2]} ${unit} Steigen` : `${ticks[2]} ${unit}`;
        const note = document.createElement('span');
        note.className = 'flight-track-legend-note';
        note.textContent = colorMode === 'alt' ? 'Skala: tiefster bis höchster Punkt dieses Flugs'
            : colorMode === 'gs' ? 'Skala: 0 bis zur Reisegeschwindigkeit dieses Flugs (einzelne Spitzen gekappt)'
            : 'Skala: symmetrisch, Grau = nahezu Horizontalflug (< 100 ft/min)';
        // pointer for the value at the selected position
        legendPointer = document.createElement('span');
        legendPointer.className = 'flight-track-legend-pointer';
        legendPointer.hidden = true;
        legendPointerLabel = document.createElement('span');
        legendPointerLabel.className = 'flight-track-legend-pointer-label';
        legendPointer.appendChild(legendPointerLabel);
        bar.appendChild(legendPointer);
        legend.append(low, bar, high, note);
        if (lastSelection) showLegendValue(lastSelection);
    }
    section.append(modeBar, mapEl, legend, profileWrap, readout, airspaceBox);
    lastRendered = { runId, points, segs, minAlt, maxAlt, get samples() { return samples; }, get airspaces() { return airspaces; },
        get scale() { return scale; }, get colorMode() { return colorMode; }, profileWrap, track };

    const useTime = totalNm < 0.2;
    const samples = densify(points, along);
    let airspaces = [];      // analysis results
    let highlighted = null;  // result highlighted from the list

    // ---- map ----
    let marker = null, map = null, airspaceLayer = null;
    const airspacePolys = new Map();
    if (window.L) {
        map = L.map(mapEl, { zoomControl: true, attributionControl: true, scrollWheelZoom: true });
        activeMap = map;
        map.createPane('gaTrackAirspace').style.zIndex = 410;
        map.createPane('gaTrackLine').style.zIndex = 450;
        const prefs = readLayerPrefs();
        const base = buildBaseLayers();
        const aero = L.tileLayer(AERO_TILE_URL, { attribution: 'AeroData / NewayData', opacity: 0.65, maxNativeZoom: 12 });
        const dfs = L.tileLayer('https://secais.dfs.de/static-maps/icao500/tiles/{z}/{x}/{y}.png', { attribution: '© DFS Deutsche Flugsicherung', maxNativeZoom: 11, opacity: 1 });
        airspaceLayer = L.layerGroup();
        const overlays = { '🛩️ VFR Lufträume (Overlay)': aero, '🗺️ DFS ICAO Karte 1:500k': dfs, '🧭 Lufträume am Flugweg': airspaceLayer };
        const baseName = base.layers[prefs.base] ? prefs.base : '⛰️ Topografie (Mit Text)';
        base.layers[baseName].addTo(map);
        const activeOverlays = Array.isArray(prefs.overlays) ? prefs.overlays : ['🛩️ VFR Lufträume (Overlay)', '🧭 Lufträume am Flugweg'];
        Object.entries(overlays).forEach(([name, layer]) => { if (activeOverlays.includes(name)) layer.addTo(map); });
        L.control.layers(base.layers, overlays, { collapsed: true }).addTo(map);
        // Main map rule: topo is dimmed under the VFR overlay; the overlay hides from zoom 15.
        const applyZoomRules = () => {
            const aeroOn = map.hasLayer(aero), hidden = map.getZoom() >= AERO_HIDE_ZOOM;
            if (aeroOn) aero.setOpacity(hidden ? 0 : 0.65);
            if (map.hasLayer(base.topo) && typeof base.topo.setOpacity === 'function') base.topo.setOpacity(map.hasLayer(dfs) || !aeroOn || hidden ? 1 : 0.5);
        };
        const savePrefs = () => {
            const current = Object.entries(base.layers).find(([, layer]) => map.hasLayer(layer));
            writeLayerPrefs({ base: current ? current[0] : baseName, overlays: Object.entries(overlays).filter(([, layer]) => map.hasLayer(layer)).map(([name]) => name) });
            applyZoomRules();
        };
        map.on('baselayerchange overlayadd overlayremove', savePrefs);
        map.on('zoomend', applyZoomRules);

        segs.forEach(seg => {
            seg.line = L.polyline([[points[seg.i - 1].lat, points[seg.i - 1].lon], [points[seg.i].lat, points[seg.i].lon]],
                { pane: 'gaTrackLine', color: colorFor(scale, segValue(seg)), weight: 4, opacity: 0.95 }).addTo(map);
        });
        const dot = (p, color, title) => L.circleMarker([p.lat, p.lon], { pane: 'gaTrackLine', radius: 6, color: '#fff', weight: 2, fillColor: color, fillOpacity: 1 }).bindTooltip(title).addTo(map);
        dot(points[0], '#2e7d32', 'Start');
        dot(points[points.length - 1], '#c62828', 'Ende');
        (track.marks?.touchdowns || []).forEach(i => points[i] && dot(points[i], '#f9a825', 'Aufsetzen'));
        marker = L.circleMarker([points[0].lat, points[0].lon], { pane: 'gaTrackLine', radius: 7, color: '#111', weight: 2, fillColor: '#fff', fillOpacity: 1, opacity: 0 }).addTo(map);
        const bounds = L.latLngBounds(points.map(p => [p.lat, p.lon]));
        map.fitBounds(bounds, { padding: [18, 18] });
        applyZoomRules();
        setTimeout(() => { try { map.invalidateSize(); map.fitBounds(bounds, { padding: [18, 18] }); applyZoomRules(); } catch (_) {} }, 80);
        map.on('mousemove', event => {
            let best = -1, bestD = Infinity;
            for (let i = 0; i < points.length; i++) {
                const d = (points[i].lat - event.latlng.lat) ** 2 + ((points[i].lon - event.latlng.lng) * Math.cos(points[i].lat * Math.PI / 180)) ** 2;
                if (d < bestD) { bestD = d; best = i; }
            }
            const px = map.latLngToContainerPoint([points[best].lat, points[best].lon]).distanceTo(event.containerPoint);
            if (px <= 24) select(xsOf(best), points[best]);
        });
    } else {
        mapEl.textContent = 'Karte nicht verfügbar.';
    }

    function drawMapAirspaces() {
        if (!airspaceLayer) return;
        airspaceLayer.clearLayers();
        airspacePolys.clear();
        airspaces.forEach(r => {
            const strong = r.flownThrough;
            const layers = polygonsOf(r.as).map(ring => L.polygon(ring.map(([lon, lat]) => [lat, lon]), {
                pane: 'gaTrackAirspace', color: r.style.color, weight: strong ? r.style.weight + 1 : r.style.weight,
                fillColor: r.style.color, fillOpacity: strong ? Math.max(0.16, r.style.fillOpacity) : r.style.fillOpacity * 0.6,
                dashArray: r.style.dashArray || (strong ? null : '4,4'), interactive: true
            }).bindTooltip(`${r.name} · ${r.limits}${strong ? ' · durchflogen' : ` · ${r.relation}`}`, { sticky: true, className: 'airspace-tooltip' }));
            layers.forEach(layer => layer.addTo(airspaceLayer));
            airspacePolys.set(r, layers);
        });
    }

    // ---- profile ----
    const W = 640, H = 210, padL = 46, padR = 10, padT = 10, padB = 24;
    const xMax = Math.max(useTime ? points[points.length - 1].sec : totalNm, 1e-6);
    const xsOf = i => (useTime ? points[i].sec : along[i]);
    const sx = s => (useTime ? s.sec : s.x);
    let yMin = 0, yMax = 1000, X = () => 0, Y = () => 0, cursor = null, cursorDot = null, svg = null;
    const ns = 'http://www.w3.org/2000/svg';

    function drawProfile() {
        // Show the band directly above the flight (e.g. a TMA base) without flattening the flight.
        let ceiling = maxAlt + 500;
        airspaces.forEach(r => r.lateral.forEach(run => {
            for (let k = run.from; k <= run.to; k += 4) {
                const band = window.GANavigationWarnings.getAirspaceVerticalBandFt(r.as, samples[k].gndFt ?? 0);
                if (band && band.lowerFt > samples[k].altFt && band.lowerFt < maxAlt + 3000) ceiling = Math.max(ceiling, band.lowerFt + 400);
            }
        }));
        yMin = Math.max(0, Math.floor((minAlt - 100) / 100) * 100);
        yMax = Math.ceil(ceiling / 100) * 100;
        X = v => padL + (v / xMax) * (W - padL - padR);
        Y = v => H - padB - ((Math.max(yMin, Math.min(yMax, v)) - yMin) / (yMax - yMin)) * (H - padT - padB);
        profileWrap.replaceChildren();
        svg = document.createElementNS(ns, 'svg');
        svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
        svg.setAttribute('role', 'img');
        svg.setAttribute('aria-label', `Höhenprofil, ${fmt(yMin)} bis ${fmt(yMax)} ft`);
        const el = (name, attrs, parent = svg) => { const node = document.createElementNS(ns, name); Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, v)); parent.appendChild(node); return node; };
        const step = [100, 250, 500, 1000, 2000, 5000].find(s => (yMax - yMin) / s <= 6) || 5000;
        for (let v = Math.ceil(yMin / step) * step; v <= yMax; v += step) {
            el('line', { x1: padL, x2: W - padR, y1: Y(v), y2: Y(v), class: 'flight-track-grid', stroke: 'rgba(60,50,40,0.15)', 'stroke-width': 1 });
            el('text', { x: padL - 6, y: Y(v) + 4, 'text-anchor': 'end', class: 'flight-track-axis', fill: '#5a5246', 'font-size': 11, 'font-family': 'Helvetica, Arial, sans-serif' }).textContent = fmt(v);
        }
        el('text', { x: W - padR, y: H - 6, 'text-anchor': 'end', class: 'flight-track-axis', fill: '#5a5246', 'font-size': 11, 'font-family': 'Helvetica, Arial, sans-serif' }).textContent = useTime ? `${Math.round(xMax / 60)} min` : `${xMax.toFixed(1)} NM`;
        el('text', { x: padL, y: H - 6, class: 'flight-track-axis', fill: '#5a5246', 'font-size': 11, 'font-family': 'Helvetica, Arial, sans-serif' }).textContent = '0';
        // airspace bands: lower/upper limit along each lateral crossing (AGL limits follow terrain)
        const bandGroup = el('g', { class: 'flight-track-airspace-bands' });
        airspaces.forEach(r => {
            if (r.as.type === 33) return; // as in the route profile
            const strong = r.flownThrough || r === highlighted;
            r.lateral.forEach(run => {
                const top = [], bottom = [];
                for (let k = run.from; k <= run.to; k++) {
                    const band = window.GANavigationWarnings.getAirspaceVerticalBandFt(r.as, samples[k].gndFt ?? 0);
                    if (!band || band.lowerFt >= yMax) continue;
                    const x = X(sx(samples[k])).toFixed(1);
                    top.push(`${x},${Y(band.upperFt).toFixed(1)}`);
                    bottom.unshift(`${x},${Y(band.lowerFt).toFixed(1)}`);
                }
                if (top.length < 2) return;
                const poly = el('polygon', { points: top.concat(bottom).join(' '), fill: r.style.color, 'fill-opacity': strong ? 0.28 : 0.1,
                    stroke: r.style.color, 'stroke-width': r === highlighted ? 2.4 : 1, 'stroke-opacity': strong ? 0.9 : 0.45,
                    'stroke-dasharray': strong ? '' : '4 3' }, bandGroup);
                const title = document.createElementNS(ns, 'title');
                title.textContent = `${r.name} · ${r.limits}`;
                poly.appendChild(title);
                const width = X(sx(samples[run.to])) - X(sx(samples[run.from]));
                if (width > 70 && strong) {
                    const band = window.GANavigationWarnings.getAirspaceVerticalBandFt(r.as, samples[run.from].gndFt ?? 0);
                    const labelY = Math.max(padT + 10, Y(Math.min(yMax, band.upperFt)) + 12);
                    el('text', { x: X(sx(samples[run.from])) + 4, y: labelY, class: 'flight-track-band-label', fill: r.style.color, 'font-size': 10, 'font-weight': 700, 'font-family': 'Helvetica, Arial, sans-serif' }, bandGroup).textContent = r.name;
                }
            });
        });
        // terrain per segment
        let runs = [], run = [];
        points.forEach((p, i) => {
            if ((p.segmentStart && i > 0) || p.gndFt === null) { if (run.length > 1) runs.push(run); run = []; }
            if (p.gndFt !== null) run.push(i);
        });
        if (run.length > 1) runs.push(run);
        runs.forEach(r => {
            const top = r.map(i => `${X(xsOf(i)).toFixed(1)},${Y(points[i].gndFt).toFixed(1)}`).join(' ');
            el('polygon', { points: `${X(xsOf(r[0])).toFixed(1)},${H - padB} ${top} ${X(xsOf(r[r.length - 1])).toFixed(1)},${H - padB}`, class: 'flight-track-terrain', fill: '#c8b48a', 'fill-opacity': 0.75, stroke: '#9a8459', 'stroke-width': 1 });
        });
        // altitude line, colored like the map line
        const lineGroup = el('g', { class: 'flight-track-altitude' });
        segs.forEach(seg => {
            el('line', { 'stroke-width': 2.6, 'stroke-linecap': 'round', x1: X(xsOf(seg.i - 1)).toFixed(1), y1: Y(points[seg.i - 1].altFt).toFixed(1),
                x2: X(xsOf(seg.i)).toFixed(1), y2: Y(points[seg.i].altFt).toFixed(1), stroke: colorFor(scale, segValue(seg)) }, lineGroup);
        });
        cursor = el('line', { x1: 0, x2: 0, y1: padT, y2: H - padB, class: 'flight-track-cursor', visibility: 'hidden' });
        cursorDot = el('circle', { r: 4, class: 'flight-track-cursor-dot', visibility: 'hidden' });
        profileWrap.appendChild(svg);
        svg.addEventListener('pointermove', event => {
            const box = svg.getBoundingClientRect();
            const target = ((((event.clientX - box.left) / box.width) * W - padL) / (W - padL - padR)) * xMax;
            let best = 0;
            for (let k = 1; k < samples.length; k++) if (Math.abs(sx(samples[k]) - target) < Math.abs(sx(samples[best]) - target)) best = k;
            select(sx(samples[best]), samples[best], best);
        });
    }

    function speedAt(p) {
        const i = p.idx ?? points.indexOf(p);
        const a = points[Math.max(0, i - 1)], b = points[Math.min(points.length - 1, i + 1)];
        const dt = b.sec - a.sec;
        if (dt <= 0 || b.segmentStart) return null;
        return codec.distanceM(a, b) / 1852 / (dt / 3600);
    }
    function sampleIndexAt(x) {
        let best = 0;
        for (let k = 1; k < samples.length; k++) if (Math.abs(sx(samples[k]) - x) < Math.abs(sx(samples[best]) - x)) best = k;
        return best;
    }
    function select(x, p, k = null) {
        if (!cursor) return;
        cursor.setAttribute('x1', X(x)); cursor.setAttribute('x2', X(x)); cursor.setAttribute('visibility', 'visible');
        cursorDot.setAttribute('cx', X(x)); cursorDot.setAttribute('cy', Y(p.altFt)); cursorDot.setAttribute('visibility', 'visible');
        if (marker) { marker.setLatLng([p.lat, p.lon]); marker.setStyle({ opacity: 1 }); }
        const gs = speedAt(p);
        const parts = [`Höhe ${fmt(p.altFt)} ft`];
        if (p.gndFt !== null && p.gndFt !== undefined) parts.push(`über Grund ${fmt(Math.max(0, p.altFt - p.gndFt))} ft`);
        if (gs !== null && Number.isFinite(gs)) parts.push(`GS ${Math.round(gs)} kt`);
        const segAt = segs.find(seg => seg.i === Math.max(1, Math.min(points.length - 1, (p.idx ?? points.indexOf(p)) + 1))) || null;
        showLegendValue({ alt: p.altFt, gs: Number.isFinite(gs) ? gs : null, vs: segAt && Number.isFinite(segAt.vs) ? segAt.vs : null });
        if (segAt && Number.isFinite(segAt.vs)) parts.push(`${segAt.vs >= 0 ? '+' : ''}${fmt(Math.round(segAt.vs / 10) * 10)} ft/min`);
        parts.push(useTime ? `${Math.round(p.sec / 60)} min` : `${x.toFixed(1)} NM`);
        parts.push(`${clockText(p.time)} Uhr`);
        if (p.onGround) parts.push('am Boden');
        const index = k ?? sampleIndexAt(x);
        const inside = airspaces.filter(r => r.inside.some(run => index >= run.from && index <= run.to)).map(r => r.name);
        if (inside.length) parts.push(`in ${inside.join(', ')}`);
        readout.textContent = parts.join(' · ');
    }

    function renderAirspaceList() {
        airspaceBox.replaceChildren();
        const through = airspaces.filter(r => r.flownThrough && r.as.type !== 33);
        const passed = airspaces.filter(r => !r.flownThrough && r.as.type !== 33);
        const info = airspaces.filter(r => r.as.type === 33);
        const heading = document.createElement('h4');
        heading.textContent = through.length ? `Durchflogene Lufträume (${through.length})` : 'Keine Luftraumdurchflüge';
        airspaceBox.appendChild(heading);
        const list = (rows, kind) => {
            if (!rows.length) return;
            const ul = document.createElement('ul');
            ul.className = `flight-track-airspace-list is-${kind}`;
            rows.forEach(r => {
                const li = document.createElement('li');
                const button = document.createElement('button');
                button.type = 'button';
                const swatch = document.createElement('span');
                swatch.className = 'flight-track-swatch';
                swatch.style.background = r.style.color;
                const name = document.createElement('strong');
                name.textContent = r.name;
                const detail = document.createElement('span');
                detail.className = 'flight-track-airspace-detail';
                if (kind === 'through') {
                    const spans = r.inside.map(run => `${clockText(samples[run.from].time)}–${clockText(samples[run.to].time)} (${durationText(samples[run.to].sec - samples[run.from].sec)})`);
                    detail.textContent = `${r.limits} · ${spans.join(', ')}`;
                } else {
                    detail.textContent = `${r.limits} · ${r.relation}`;
                }
                button.append(swatch, name, detail);
                button.addEventListener('click', () => {
                    highlighted = highlighted === r ? null : r;
                    drawProfile();
                    const run = (r.inside[0] || r.lateral[0]);
                    select(sx(samples[run.from]), samples[run.from], run.from);
                    const layers = airspacePolys.get(r);
                    if (map && layers?.length) {
                        if (!map.hasLayer(airspaceLayer)) airspaceLayer.addTo(map);
                        map.fitBounds(L.featureGroup(layers).getBounds().extend(L.latLngBounds(points.map(p => [p.lat, p.lon]))), { padding: [18, 18] });
                        layers.forEach(layer => layer.openTooltip?.());
                    }
                    ul.querySelectorAll('button').forEach(b => b.classList.toggle('is-active', b === button && highlighted === r));
                });
                li.appendChild(button);
                ul.appendChild(li);
            });
            airspaceBox.appendChild(ul);
        };
        list(through, 'through');
        if (passed.length) {
            const sub = document.createElement('h4');
            sub.textContent = `Unter- oder überflogen (${passed.length})`;
            airspaceBox.appendChild(sub);
            list(passed, 'passed');
        }
        if (info.length) {
            const sub = document.createElement('p');
            sub.className = 'flight-track-airspace-note';
            sub.textContent = `Außerdem im Gebiet: ${info.map(r => r.name).join(', ')}`;
            airspaceBox.appendChild(sub);
        }
        const note = document.createElement('p');
        note.className = 'flight-track-airspace-note';
        note.textContent = 'Lufträume nach heutigem Datenstand (OpenAIP), nicht zum Flugzeitpunkt. Zeitlich aktivierte Gebiete sind ohne Aktivierungsstatus berücksichtigt.';
        airspaceBox.appendChild(note);
    }

    function setColorMode(mode) {
        if (!COLOR_MODES[mode] || mode === colorMode) return;
        colorMode = mode;
        writeColorMode(mode);
        scale = colorScale(mode, segs, minAlt, maxAlt);
        segs.forEach(seg => seg.line?.setStyle({ color: colorFor(scale, segValue(seg)) }));
        renderLegend();
        drawProfile();
    }

    renderLegend();
    drawProfile();
    loadAirspaces(runId, points).then(items => {
        if (!section.isConnected) return;
        airspaces = analyseAirspaces(items, samples);
        drawMapAirspaces();
        drawProfile();
        renderAirspaceList();
    }).catch(error => {
        if (section.isConnected) airspaceBox.textContent = `Lufträume nicht verfügbar (${error?.message || error}).`;
    });
}

// Other callers of showFlightDebrief (mission end) must not show the logbook delete button.
let debriefGuardInstalled = false;
function installDebriefGuard() {
    if (debriefGuardInstalled || typeof window.showFlightDebrief !== 'function') return;
    debriefGuardInstalled = true;
    const original = window.showFlightDebrief;
    window.showFlightDebrief = function (...args) {
        document.querySelector('#flightDebriefOverlay .flight-debrief-delete')?.remove();
        return original.apply(this, args);
    };
}

// ---- delete a single entry ----------------------------------------------------------------
function closeDebrief() {
    if (activeMap) { try { activeMap.remove(); } catch (_) {} activeMap = null; }
    const overlay = document.getElementById('flightDebriefOverlay');
    if (overlay) overlay.style.display = 'none';
}
function addDeleteButton(entry) {
    const actions = document.querySelector('#flightDebriefOverlay .flight-debrief-actions');
    if (!actions) return;
    actions.querySelector('.flight-debrief-delete')?.remove();
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'flight-debrief-btn secondary flight-debrief-delete';
    button.textContent = 'Eintrag löschen';
    button.addEventListener('click', () => deleteEntry(entry, button));
    actions.insertBefore(button, actions.firstChild);
}
async function deleteEntry(entry, button) {
    const label = entry?.kind === 'free' ? 'diesen freien Flug' : 'diesen Missionseintrag';
    if (!confirm(`Möchtest du ${label} samt Flugweg aus dem Flugbuch löschen? Das gilt für alle Geräte.`)) return;
    if (button) button.disabled = true;
    const runId = trackRunIdFor(entry);
    try {
        // Older entries also live in the local/profile logbook; tracker entries only in the cloud.
        if (entry?.kind !== 'free' && typeof window.deleteMissionLogbookEntry === 'function') {
            window.deleteMissionLogbookEntry(entry.completionId || entry.id);
        }
        if (runId && credentials()) await call('delete', { runIds: [runId] });
        state.entries = state.entries.filter(e => e.runId !== runId);
        const auth = credentials();
        if (auth) await cacheSet('list:' + auth.pilot.toUpperCase(), { revision: null, entries: state.entries });
        state.revision = null; state.loadedAt = 0;
        closeDebrief();
        rerender();
        refresh({ force: true });
    } catch (error) {
        if (button) button.disabled = false;
        alert(`Löschen in der Cloud fehlgeschlagen (${error?.message || error}). Bitte später erneut versuchen.`);
    }
}

// ---- mission outcome (from the logbook record) -----------------------------------------------
function listText(list) {
    return (Array.isArray(list) ? list : []).map(item => String(item?.label || item?.name || item || '').trim()).filter(Boolean).join(', ');
}
// Rows describing how the mission ended. Only facts recorded in the logbook entry.
function missionOutcome(record) {
    if (!record || record.kind === 'free') return null;
    const rows = [];
    const failed = record.failed === true || record.result === 'failed';
    const reasons = [];
    const cargo = record.cargo || null;
    if (cargo) {
        if (listText(cargo.missingRequired)) reasons.push(`nicht geladen: ${listText(cargo.missingRequired)}`);
        if (listText(cargo.droppedRequired)) reasons.push(`abgeworfen/verloren: ${listText(cargo.droppedRequired)}`);
        if (listText(cargo.notDeliveredRequired)) reasons.push(`nicht abgeliefert: ${listText(cargo.notDeliveredRequired)}`);
        if (listText(cargo.damagedRequired)) reasons.push(`beschädigt: ${listText(cargo.damagedRequired)}`);
    }
    const aborted = record.result === 'aborted';
    rows.push({ label: 'Ergebnis', value: aborted ? 'Abgebrochen' : (failed ? 'Nicht erfüllt' : 'Erfüllt'), tone: failed ? 'bad' : 'good' });
    if (failed && reasons.length) rows.push({ label: 'Grund', value: reasons.join(' · '), tone: 'bad' });
    else if (aborted) rows.push({ label: 'Grund', value: 'Mission vor dem Abschluss abgebrochen', tone: 'bad' });
    else if (failed) rows.push({ label: 'Grund', value: 'Auftrag nicht vollständig abgeschlossen', tone: 'bad' });
    const planned = String(record.plannedDest || '').trim();
    const landed = String(record.dest || record.arrLabel || '').trim();
    if (landed) {
        const differs = planned && planned !== landed && planned !== 'POI';
        rows.push({ label: 'Landung', value: differs ? `${landed} (geplant: ${planned})` : `${landed}${planned ? ' wie geplant' : ''}`, tone: differs ? 'warn' : '' });
    }
    if (cargo && Number(cargo.requiredTotal) > 0) {
        const condition = Number.isFinite(Number(cargo.conditionPct)) ? ` · Zustand ${Math.round(Number(cargo.conditionPct))} %` : '';
        rows.push({ label: 'Ladung', value: `${cargo.requiredLoaded}/${cargo.requiredTotal} Pflichtteile${condition}`, tone: cargo.failed ? 'bad' : '' });
    }
    const sar = record.sarSearchSummary;
    if (sar?.text || sar?.outcome) rows.push({ label: 'Suche', value: String(sar.text || sar.outcome), tone: '' });
    if (record.simulated) rows.push({ label: 'Hinweis', value: 'Im Sim-Modus geflogen', tone: '' });
    const comfort = record.comfort || null;
    const score = Number(comfort?.score);
    const passenger = comfort && Number.isFinite(score)
        ? { mood: String(comfort.mood || ''), score: Math.round(score), stars: Math.max(0, Math.min(5, Math.round(score / 20))) }
        : null;
    return { rows, passenger, failed };
}

// The passenger's spoken farewell (stored by the tracker with the mission track, Tracker v594+).
function farewellFor(record) {
    if (!record || record.kind === 'free') return null;
    const runId = trackRunIdFor(record);
    const entry = record.farewellText ? record : (runId ? state.entries.find(e => e.runId === runId) : null);
    const text = String(entry?.farewellText || '').trim();
    if (!text) return null;
    const who = [entry.farewellSpeaker, entry.farewellRole].map(v => String(v || '').trim()).filter(Boolean).join(', ');
    return { text, who };
}

function starText(stars) { return '★★★★★'.slice(0, stars) + '☆☆☆☆☆'.slice(0, 5 - stars); }

function renderOutcomeSection(body, record) {
    const outcome = missionOutcome(record);
    if (!outcome) return;
    const section = document.createElement('section');
    section.className = `flight-debrief-section flight-outcome-section${outcome.failed ? ' is-failed' : ''}`;
    const heading = document.createElement('h3');
    heading.textContent = 'Missionsergebnis';
    section.appendChild(heading);
    const list = document.createElement('dl');
    list.className = 'flight-outcome-rows';
    outcome.rows.forEach(row => {
        const dt = document.createElement('dt');
        dt.textContent = row.label;
        const dd = document.createElement('dd');
        dd.textContent = row.value;
        if (row.tone) dd.className = `is-${row.tone}`;
        list.append(dt, dd);
    });
    if (outcome.passenger) {
        const dt = document.createElement('dt');
        dt.textContent = 'Passagier';
        const dd = document.createElement('dd');
        const stars = document.createElement('span');
        stars.className = 'flight-outcome-stars';
        stars.textContent = starText(outcome.passenger.stars);
        stars.setAttribute('aria-label', `${outcome.passenger.stars} von 5 Sternen`);
        dd.append(stars, ` ${outcome.passenger.mood || 'bewertet'} · Komfort ${outcome.passenger.score}/100`);
        list.append(dt, dd);
    }
    section.appendChild(list);
    const farewell = farewellFor(record);
    if (farewell) {
        const quote = document.createElement('blockquote');
        quote.className = 'flight-outcome-farewell';
        const words = document.createElement('p');
        words.textContent = `„${farewell.text}“`;
        quote.appendChild(words);
        if (farewell.who) {
            const cite = document.createElement('cite');
            cite.textContent = `– ${farewell.who}`;
            quote.appendChild(cite);
        }
        section.appendChild(quote);
    }
    const grid = body.querySelector('.flight-debrief-metrics');
    if (grid?.nextSibling) body.insertBefore(section, grid.nextSibling); else body.appendChild(section);
}

// ---- PDF export: second page with flight path, profile, airspaces and outcome ----------------
function svgToPng(svg, width, height) {
    return new Promise(resolve => {
        try {
            const clone = svg.cloneNode(true);
            clone.querySelectorAll('.flight-track-cursor, .flight-track-cursor-dot').forEach(node => node.remove());
            clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
            clone.setAttribute('width', width);
            clone.setAttribute('height', height);
            const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml' }));
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = width * 2; canvas.height = height * 2;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#fdf5e6'; ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                URL.revokeObjectURL(url);
                resolve({ data: canvas.toDataURL('image/png'), width, height });
            };
            img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
            img.src = url;
        } catch (_) { resolve(null); }
    });
}

function mercator(lat, lon, zoom) {
    const x = ((lon + 180) / 360) * Math.pow(2, zoom) * 256;
    const r = lat * Math.PI / 180;
    const y = ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * Math.pow(2, zoom) * 256;
    return { x, y };
}
function loadTile(url) {
    return new Promise(resolve => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = url;
    });
}

async function renderMapImage(model) {
    const W = 900, H = 560, pad = 40;
    const lats = model.points.map(p => p.lat), lons = model.points.map(p => p.lon);
    const n = Math.max(...lats), s = Math.min(...lats), e = Math.max(...lons), w = Math.min(...lons);
    let zoom = 1;
    for (let z = 14; z >= 1; z--) {
        const a = mercator(n, w, z), b = mercator(s, e, z);
        if (Math.abs(b.x - a.x) < W - 2 * pad && Math.abs(b.y - a.y) < H - 2 * pad) { zoom = z; break; }
    }
    const centre = mercator((n + s) / 2, (e + w) / 2, zoom);
    const px = (lat, lon) => { const p = mercator(lat, lon, zoom); return { x: p.x - centre.x + W / 2, y: p.y - centre.y + H / 2 }; };
    const canvas = document.createElement('canvas');
    canvas.width = W * 2; canvas.height = H * 2;
    const ctx = canvas.getContext('2d');
    ctx.scale(2, 2);
    ctx.fillStyle = '#ebe4d4'; ctx.fillRect(0, 0, W, H);
    const tiles = [];
    const tx0 = Math.floor((centre.x - W / 2) / 256), tx1 = Math.floor((centre.x + W / 2) / 256);
    const ty0 = Math.floor((centre.y - H / 2) / 256), ty1 = Math.floor((centre.y + H / 2) / 256);
    for (let tx = tx0; tx <= tx1; tx++) for (let ty = ty0; ty <= ty1; ty++) {
        const sub = 'abc'[(tx + ty + 3) % 3];
        tiles.push(loadTile(`https://${sub}.tile.opentopomap.org/${zoom}/${tx}/${ty}.png`).then(img => {
            if (img) { ctx.globalAlpha = 0.75; ctx.drawImage(img, tx * 256 - centre.x + W / 2, ty * 256 - centre.y + H / 2, 256, 256); ctx.globalAlpha = 1; }
        }));
    }
    await Promise.race([Promise.all(tiles), new Promise(r => setTimeout(r, 8000))]);
    // airspaces (same styles as on screen)
    (model.airspaces || []).forEach(r => {
        polygonsOf(r.as).forEach(ring => {
            ctx.beginPath();
            ring.forEach(([lon, lat], i) => { const p = px(lat, lon); if (i) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y); });
            ctx.closePath();
            ctx.globalAlpha = r.flownThrough ? 0.18 : 0.08; ctx.fillStyle = r.style.color; ctx.fill();
            ctx.globalAlpha = r.flownThrough ? 0.9 : 0.5; ctx.strokeStyle = r.style.color; ctx.lineWidth = r.flownThrough ? 2.4 : 1.2;
            ctx.setLineDash(r.flownThrough ? [] : [5, 4]); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
        });
    });
    // track in the chosen coloring
    ctx.lineCap = 'round'; ctx.lineWidth = 4;
    model.segs.forEach(seg => {
        const a = px(model.points[seg.i - 1].lat, model.points[seg.i - 1].lon), b = px(model.points[seg.i].lat, model.points[seg.i].lon);
        ctx.strokeStyle = colorFor(model.scale, seg[model.colorMode]);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    });
    const dot = (p, color) => { const q = px(p.lat, p.lon); ctx.beginPath(); ctx.arc(q.x, q.y, 6, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke(); };
    dot(model.points[0], '#2e7d32');
    dot(model.points[model.points.length - 1], '#c62828');
    ctx.font = '11px Helvetica, Arial, sans-serif'; ctx.fillStyle = 'rgba(40,40,40,.75)';
    ctx.fillText('Karte © OpenTopoMap (CC-BY-SA), Daten © OpenStreetMap, Lufträume OpenAIP', 8, H - 8);
    try { return { data: canvas.toDataURL('image/jpeg', 0.88), width: W, height: H }; } catch (_) { return null; }
}

function pdfText(value) {
    // jsPDF standard fonts: keep umlauts, drop symbols they cannot draw
    return String(value ?? '').replace(/[★☆]/g, '*').replace(/[–—]/g, '-').replace(/[^\x20-\x7E -ÿ]/g, '');
}

// Called by the PDF export (board.js) before page 1 is drawn. Returns null when there is nothing to add.
async function preparePdf(record) {
    const outcome = missionOutcome(record);
    const runId = trackRunIdFor(record);
    const model = lastRendered && runId && lastRendered.runId === runId ? lastRendered : null;
    if (!model && !outcome) return null;
    const [mapImage, profileImage] = model ? await Promise.all([
        renderMapImage(model),
        model.profileWrap.querySelector('svg') ? svgToPng(model.profileWrap.querySelector('svg'), 640, 210) : null
    ]) : [null, null];
    return {
        pages: model ? 1 : 0,
        // Page 1, after the other debrief texts: mission outcome and the passenger's words.
        drawOutcome(doc, y, helpers = {}) {
            if (!outcome) return y;
            doc.setFont('Helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(11, 31, 101);
            doc.text('Missionsergebnis', 32, y); y += 6;
            const rows = outcome.rows.filter(row => row.label !== 'Ergebnis');
            if (outcome.passenger) rows.push({ label: 'Passagier', value: `${outcome.passenger.stars}/5 Sterne · ${outcome.passenger.mood} · Komfort ${outcome.passenger.score}/100` });
            rows.forEach(row => {
                doc.setFont('Helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(115, 85, 55);
                doc.text(pdfText(row.label), 32, y);
                doc.setFont('Helvetica', 'normal'); doc.setFontSize(9.5);
                doc.setTextColor(row.tone === 'bad' ? 150 : 45, row.tone === 'bad' ? 45 : 45, row.tone === 'bad' ? 35 : 40);
                const lines = doc.splitTextToSize(pdfText(row.value), 125);
                doc.text(lines, 62, y);
                y += Math.max(1, lines.length) * 5.2;
            });
            y += 4;
            const farewell = farewellFor(record);
            if (farewell) {
                const text = `"${farewell.text}"${farewell.who ? ` - ${farewell.who}` : ''}`;
                y = typeof helpers.section === 'function'
                    ? helpers.section(doc, 'Worte des Passagiers', pdfText(text), y)
                    : y;
            }
            return y;
        },
        draw(doc, helpers = {}) {
            if (!model) return;
            doc.addPage();
            if (typeof helpers.background === 'function') helpers.background(doc, 2, 2);
            let y = 28;
            doc.setFont('Helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(11, 31, 101);
            doc.text('FLUGWEG & LUFTRAEUME', 32, y); y += 4;
            doc.setDrawColor(11, 31, 101); doc.setLineWidth(0.5); doc.line(32, y, 190, y); y += 6;
            if (mapImage) {
                const w = 158, h = w * mapImage.height / mapImage.width;
                doc.addImage(mapImage.data, 'JPEG', 32, y, w, h);
                doc.setDrawColor(160, 155, 140); doc.setLineWidth(0.3); doc.rect(32, y, w, h);
                y += h + 5;
            }
            if (model) {
                const ticks = scaleTicks(model.scale);
                const unit = COLOR_MODES[model.colorMode].unit;
                doc.setFont('Helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(60, 60, 60);
                doc.text(pdfText(`Linienfarbe: ${COLOR_MODES[model.colorMode].label}`), 32, y + 3);
                const barX = 80, barW = 60;
                for (let i = 0; i < 30; i++) {
                    const value = model.scale.min + (model.scale.max - model.scale.min) * (i + 0.5) / 30;
                    const rgb = colorToRgb(colorFor(model.scale, value));
                    doc.setFillColor(rgb[0], rgb[1], rgb[2]); doc.rect(barX + i * barW / 30, y, barW / 30 + 0.1, 3.5, 'F');
                }
                doc.text(pdfText(ticks[0]), barX - 1, y + 3, { align: 'right' });
                doc.text(pdfText(`${ticks[2]} ${unit}`), barX + barW + 1, y + 3);
                y += 8;
            }
            if (profileImage) {
                const w = 158, h = w * profileImage.height / profileImage.width;
                doc.addImage(profileImage.data, 'PNG', 32, y, w, h);
                y += h + 4;
            }
            const line = (label, value, bold = false) => {
                doc.setFont('Helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(115, 85, 55);
                doc.text(pdfText(label), 32, y);
                doc.setFont('Helvetica', bold ? 'bold' : 'normal'); doc.setTextColor(40, 40, 40);
                const lines = doc.splitTextToSize(pdfText(value), 128);
                doc.text(lines, 62, y);
                y += Math.max(1, lines.length) * 4.2 + 0.8;
            };
            if (model) {
                const through = (model.airspaces || []).filter(r => r.flownThrough && r.as.type !== 33);
                const passed = (model.airspaces || []).filter(r => !r.flownThrough && r.as.type !== 33);
                doc.setFont('Helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(11, 31, 101);
                doc.text(pdfText(through.length ? `Durchflogene Luftraeume (${through.length})` : 'Keine Luftraumdurchfluege'), 32, y); y += 5;
                through.forEach(r => {
                    const spans = r.inside.map(run => `${clockText(model.samples[run.from].time)}-${clockText(model.samples[run.to].time)}`).join(', ');
                    line(r.name, `${r.limits} · ${spans}`);
                });
                if (passed.length) line('Unter-/ueberflogen', passed.map(r => `${r.name} (${r.limits}, ${r.relation})`).join('; '));
                y += 2;
            }
        }
    };
}
function colorToRgb(css) {
    const probe = document.createElement('canvas').getContext('2d');
    probe.fillStyle = css;
    const hex = probe.fillStyle; // normalised to #rrggbb
    const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
    return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [100, 100, 100];
}

// Deleting the whole logbook also clears the cloud logbook (free flights and tracks).
async function clearCloud() {
    if (!credentials()) return;
    try {
        await call('delete', { kind: 'free' });
        await call('delete', { kind: 'mission' });
    } catch (error) { try { console.warn('[Flugbuch] Cloud-Flugbuch nicht gelöscht:', error?.message || error); } catch (_) {} }
    state.entries = []; state.loadedAt = 0;
    refresh({ force: true });
}

window.GAFlightLogbook = Object.freeze({ refresh, mergedEntries, freeEntries, showFree, setShowFree, openEntry, trackRunIdFor, clearCloud, getTrack, missionOutcome, preparePdf });
})();
