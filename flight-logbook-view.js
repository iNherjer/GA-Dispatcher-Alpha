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
function mergedEntries(missionEntries) {
    const list = (Array.isArray(missionEntries) ? missionEntries : []).filter(e => e && typeof e === 'object');
    if (!showFree()) return list;
    const time = e => Number(e.createdAt || e.endedAt || e.endTs || 0) || 0;
    return list.concat(freeEntries()).sort((a, b) => time(b) - time(a));
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
    if (activeMap) { try { activeMap.remove(); } catch (_) {} activeMap = null; }
    window.showFlightDebrief(entry, { awaitingCleanup: false });
    const body = document.getElementById('flightDebriefBody');
    if (!body) return;
    if (entry?.kind === 'free') {
        const meta = body.querySelector('.flight-debrief-meta');
        if (meta) meta.textContent = `${entry.date || ''} · FREIER FLUG`;
        // Passenger and cargo sections describe missions only.
        body.querySelectorAll('.flight-debrief-section').forEach(section => {
            if (/Passagierkomfort|Ladungssicherheit/.test(section.querySelector('h3')?.textContent || '')) section.remove();
        });
    }
    const runId = trackRunIdFor(entry);
    const section = document.createElement('section');
    section.className = 'flight-debrief-section flight-track-section';
    const heading = document.createElement('h3');
    heading.textContent = 'Flugweg';
    const status = document.createElement('p');
    status.className = 'flight-track-status';
    section.append(heading, status);
    const grid = body.querySelector('.flight-debrief-metrics');
    if (grid?.nextSibling) body.insertBefore(section, grid.nextSibling); else body.appendChild(section);
    if (!runId) {
        status.textContent = state.loadedAt ? 'Für diesen Flug liegt kein Flugweg vor.' : 'Flugweg wird gesucht…';
        if (!state.loadedAt) refresh({ force: true }).then(() => { if (trackRunIdFor(entry) && section.isConnected) openEntry(entry); });
        return;
    }
    status.textContent = 'Flugweg wird geladen…';
    getTrack(runId).then(track => {
        if (!section.isConnected) return;
        if (!track) { status.textContent = 'Flugweg nicht gefunden.'; return; }
        renderTrack(section, status, track);
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

function renderTrack(section, status, track) {
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
    section.append(mapEl, profileWrap, readout);

    // Map
    let marker = null;
    if (window.L) {
        const map = L.map(mapEl, { zoomControl: true, attributionControl: true, scrollWheelZoom: true });
        activeMap = map;
        L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
            maxZoom: 17, subdomains: 'abc',
            attribution: 'Karte: © <a href="https://opentopomap.org" target="_blank" rel="noopener">OpenTopoMap</a> (CC-BY-SA), Daten: © OpenStreetMap'
        }).addTo(map);
        for (let i = 1; i < points.length; i++) {
            if (points[i].segmentStart) continue;
            const t = maxAlt > minAlt ? ((points[i - 1].altFt + points[i].altFt) / 2 - minAlt) / (maxAlt - minAlt) : 0;
            L.polyline([[points[i - 1].lat, points[i - 1].lon], [points[i].lat, points[i].lon]],
                { color: altitudeColor(t), weight: 4, opacity: 0.9 }).addTo(map);
        }
        const dot = (p, color, title) => L.circleMarker([p.lat, p.lon], { radius: 6, color: '#fff', weight: 2, fillColor: color, fillOpacity: 1 }).bindTooltip(title).addTo(map);
        dot(points[0], '#2e7d32', 'Start');
        dot(points[points.length - 1], '#c62828', 'Ende');
        (track.marks?.touchdowns || []).forEach(i => points[i] && dot(points[i], '#f9a825', 'Aufsetzen'));
        marker = L.circleMarker([points[0].lat, points[0].lon], { radius: 7, color: '#111', weight: 2, fillColor: '#fff', fillOpacity: 1, opacity: 0 }).addTo(map);
        map.fitBounds(L.latLngBounds(points.map(p => [p.lat, p.lon])), { padding: [18, 18] });
        setTimeout(() => { try { map.invalidateSize(); map.fitBounds(L.latLngBounds(points.map(p => [p.lat, p.lon])), { padding: [18, 18] }); } catch (_) {} }, 80);
        map.on('mousemove', event => {
            let best = -1, bestD = Infinity;
            for (let i = 0; i < points.length; i++) {
                const d = (points[i].lat - event.latlng.lat) ** 2 + ((points[i].lon - event.latlng.lng) * Math.cos(points[i].lat * Math.PI / 180)) ** 2;
                if (d < bestD) { bestD = d; best = i; }
            }
            const px = map.latLngToContainerPoint([points[best].lat, points[best].lon]).distanceTo(event.containerPoint);
            if (px <= 24) select(best);
        });
    } else {
        mapEl.textContent = 'Karte nicht verfügbar.';
    }

    // Height profile
    const W = 640, H = 190, padL = 46, padR = 10, padT = 10, padB = 24;
    const useTime = totalNm < 0.2;
    const xs = points.map((p, i) => useTime ? p.sec : along[i]);
    const xMax = Math.max(xs[xs.length - 1], 1e-6);
    const yMin = Math.max(0, Math.floor((minAlt - 100) / 100) * 100);
    const yMax = Math.ceil((maxAlt + 200) / 100) * 100;
    const X = v => padL + (v / xMax) * (W - padL - padR);
    const Y = v => H - padB - ((v - yMin) / (yMax - yMin)) * (H - padT - padB);
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', `Höhenprofil, ${fmt(yMin)} bis ${fmt(yMax)} ft`);
    const el = (name, attrs) => { const node = document.createElementNS(ns, name); Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, v)); svg.appendChild(node); return node; };
    // grid
    const step = [100, 250, 500, 1000, 2000, 5000].find(s => (yMax - yMin) / s <= 6) || 5000;
    for (let v = Math.ceil(yMin / step) * step; v <= yMax; v += step) {
        el('line', { x1: padL, x2: W - padR, y1: Y(v), y2: Y(v), class: 'flight-track-grid' });
        el('text', { x: padL - 6, y: Y(v) + 4, 'text-anchor': 'end', class: 'flight-track-axis' }).textContent = fmt(v);
    }
    el('text', { x: W - padR, y: H - 6, 'text-anchor': 'end', class: 'flight-track-axis' }).textContent = useTime ? `${Math.round(xMax / 60)} min` : `${xMax.toFixed(1)} NM`;
    el('text', { x: padL, y: H - 6, class: 'flight-track-axis' }).textContent = '0';
    // terrain per segment
    let runs = [], run = [];
    points.forEach((p, i) => {
        if ((p.segmentStart && i > 0) || p.gndFt === null) { if (run.length > 1) runs.push(run); run = []; }
        if (p.gndFt !== null) run.push(i);
    });
    if (run.length > 1) runs.push(run);
    runs.forEach(r => {
        const top = r.map(i => `${X(xs[i]).toFixed(1)},${Y(Math.max(yMin, points[i].gndFt)).toFixed(1)}`).join(' ');
        el('polygon', { points: `${X(xs[r[0]]).toFixed(1)},${H - padB} ${top} ${X(xs[r[r.length - 1]]).toFixed(1)},${H - padB}`, class: 'flight-track-terrain' });
    });
    // altitude per segment
    let line = [];
    const flush = () => { if (line.length > 1) el('polyline', { points: line.join(' '), class: 'flight-track-altitude' }); line = []; };
    points.forEach((p, i) => { if (p.segmentStart && i > 0) flush(); line.push(`${X(xs[i]).toFixed(1)},${Y(p.altFt).toFixed(1)}`); });
    flush();
    const cursor = el('line', { x1: 0, x2: 0, y1: padT, y2: H - padB, class: 'flight-track-cursor', visibility: 'hidden' });
    const cursorDot = el('circle', { r: 4, class: 'flight-track-cursor-dot', visibility: 'hidden' });
    profileWrap.appendChild(svg);

    function speedAt(i) {
        const a = points[Math.max(0, i - 1)], b = points[Math.min(points.length - 1, i + 1)];
        const dt = b.sec - a.sec;
        if (dt <= 0 || b.segmentStart) return null;
        return codec.distanceM(a, b) / 1852 / (dt / 3600);
    }
    function select(i) {
        const p = points[i];
        cursor.setAttribute('x1', X(xs[i])); cursor.setAttribute('x2', X(xs[i])); cursor.setAttribute('visibility', 'visible');
        cursorDot.setAttribute('cx', X(xs[i])); cursorDot.setAttribute('cy', Y(p.altFt)); cursorDot.setAttribute('visibility', 'visible');
        if (marker) { marker.setLatLng([p.lat, p.lon]); marker.setStyle({ opacity: 1 }); }
        const gs = speedAt(i);
        const parts = [`Höhe ${fmt(p.altFt)} ft`];
        if (p.gndFt !== null) parts.push(`über Grund ${fmt(Math.max(0, p.altFt - p.gndFt))} ft`);
        if (gs !== null && Number.isFinite(gs)) parts.push(`GS ${Math.round(gs)} kt`);
        parts.push(useTime ? `${Math.round(p.sec / 60)} min` : `${along[i].toFixed(1)} NM`);
        parts.push(new Date(p.time).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) + ' Uhr');
        if (p.onGround) parts.push('am Boden');
        readout.textContent = parts.join(' · ');
    }
    svg.addEventListener('pointermove', event => {
        const box = svg.getBoundingClientRect();
        const vx = ((event.clientX - box.left) / box.width) * W;
        const target = ((vx - padL) / (W - padL - padR)) * xMax;
        let best = 0;
        for (let i = 1; i < xs.length; i++) if (Math.abs(xs[i] - target) < Math.abs(xs[best] - target)) best = i;
        select(best);
    });
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

window.GAFlightLogbook = Object.freeze({ refresh, mergedEntries, freeEntries, showFree, setShowFree, openEntry, trackRunIdFor, clearCloud, getTrack });
})();
