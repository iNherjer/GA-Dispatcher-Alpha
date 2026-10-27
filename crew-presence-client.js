/* Crew presence in the web app: sharing switches, online status in the crew
 * roster, flight post-its of crew members and the NEU badge for new flights.
 * Rules and limits: crew-presence-core.js. Worker: tools/cloudflare-worker/crew-presence.mjs.
 *
 * Traffic: one status read every POLL_MS while the app is visible and the pilot is in a
 * crew (plus one when the crew board opens). The app sends its own status beat only
 * when no tracker is connected; a connected tracker reports for the pilot. */
(function () {
    'use strict';
    const core = window.GACrewPresenceCore;
    if (!core) return;

    const POLL_MS = 3 * 60 * 1000;
    const OPEN_REFRESH_MS = 30 * 1000;
    const TICK_MS = 30 * 1000;
    const BACKOFF_MS = 10 * 60 * 1000;
    const SHARE_KEY = 'ga_crew_share';
    const SEEN_KEY = 'ga_crew_seen_flights';
    const SEEN_MAX = 60;

    let members = [];
    let fetchedAt = 0;
    let fetchedGroup = '';
    let fetching = null;
    let blockedUntil = 0;
    let lastBeat = null;
    const freshUntil = new Map(); // NEU stays on a flight post-it for a minute after it was first seen

    const groupName = () => (typeof getGroupName === 'function' ? getGroupName() : '') || '';
    const pilotId = () => (typeof getSyncId === 'function' ? getSyncId() : '') || '';
    const pin = () => (typeof getSyncPin === 'function' ? getSyncPin() : '') || '';
    const baseUrl = () => String(typeof SYNC_URL === 'string' ? SYNC_URL : 'https://ga-proxy.einherjer.workers.dev/api/sync/')
        .replace(/\/sync\/?$/, '/crew-presence-v1/');
    const sameId = (a, b) => String(a || '').toLowerCase() === String(b || '').toLowerCase();
    const readJson = (key, fallback) => {
        try { const value = JSON.parse(localStorage.getItem(key) || 'null'); return value ?? fallback; } catch (_) { return fallback; }
    };

    function getShare() { return core.normalizeShare(readJson(SHARE_KEY, null)); }

    // Called by the profile sync with the cloud copy; the newer choice wins.
    function applyShareFromCloud(value) {
        if (!value || typeof value !== 'object') return;
        const incoming = core.normalizeShare(value);
        if (incoming.at > getShare().at) {
            try { localStorage.setItem(SHARE_KEY, JSON.stringify(incoming)); } catch (_) {}
        }
    }

    function sharePayload() {
        const stored = readJson(SHARE_KEY, null);
        return stored ? core.normalizeShare(stored) : null;
    }

    function canReach() {
        return !!(groupName() && pilotId() && pin()) && Date.now() >= blockedUntil;
    }

    function headers() {
        return { 'Content-Type': 'application/json', 'X-Pilot-ID': pilotId(), 'X-Pilot-PIN': pin() };
    }

    function handleStatus(status) {
        if (status === 401 || status === 403) blockedUntil = Date.now() + BACKOFF_MS;
    }

    async function refresh(reason = 'poll', options = {}) {
        if (options.fresh) blockedUntil = 0;
        if (!canReach()) return members;
        if (fetching) return fetching;
        const group = groupName();
        fetching = (async () => {
            try {
                const res = await fetch(baseUrl() + encodeURIComponent(group) + (options.fresh ? '?fresh=1' : ''), { headers: headers(), cache: 'no-store' });
                handleStatus(res.status);
                if (!res.ok) return members;
                const data = await res.json();
                if (group !== groupName()) return members;
                members = Array.isArray(data?.members) ? data.members : [];
                fetchedAt = Date.now();
                fetchedGroup = group;
                onChange(reason);
            } catch (_) {}
            return members;
        })().finally(() => { fetching = null; });
        return fetching;
    }

    async function beat(force = false) {
        if (!canReach()) return;
        const share = getShare();
        const trackerReports = window.liveTrackerConnected === true;
        // The tracker reports for the pilot; the app only passes on a changed choice.
        if (trackerReports && !force) return;
        const now = Date.now();
        const body = !share.online && !share.flight
            ? { offline: true }
            : { source: 'web', share };
        if (!force) {
            if (body.offline && lastBeat?.offline) return;
            if (!body.offline && !core.shouldBeat(lastBeat, null, now)) return;
        }
        try {
            const res = await fetch(baseUrl() + encodeURIComponent(groupName()), {
                method: 'POST', headers: headers(), body: JSON.stringify(body), keepalive: true
            });
            handleStatus(res.status);
            if (res.ok) lastBeat = { at: now, flight: null, offline: !!body.offline };
        } catch (_) {}
    }

    function setShare(partial) {
        const next = { ...getShare(), ...partial, at: Date.now() };
        try { localStorage.setItem(SHARE_KEY, JSON.stringify(core.normalizeShare(next))); } catch (_) {}
        try { triggerCloudSave(true); } catch (_) {}
        void beat(true).then(() => refresh('share-changed'));
        rerenderBoard();
    }

    // --- NEU badge for flights of other crew members ---
    const flightKey = (member) => `${String(member.pilotId).toLowerCase()}:${member.flight.id}`;
    function otherFlights() {
        if (fetchedGroup !== groupName()) return [];
        return members.filter(m => m.flight && !sameId(m.pilotId, pilotId()));
    }
    function hasNewFlight() {
        const seen = new Set(readJson(SEEN_KEY, []));
        return otherFlights().some(m => !m.flight.endedAt && !seen.has(flightKey(m)));
    }
    function markFlightsSeen() {
        const seen = readJson(SEEN_KEY, []);
        const keys = otherFlights().map(flightKey).filter(key => !seen.includes(key));
        if (!keys.length) return;
        keys.forEach(key => freshUntil.set(key, Date.now() + 60 * 1000));
        try { localStorage.setItem(SEEN_KEY, JSON.stringify(seen.concat(keys).slice(-SEEN_MAX))); } catch (_) {}
    }

    function boardShowsCrew() {
        return document.getElementById('pinboardOverlay')?.classList.contains('active')
            && typeof currentBoardMode !== 'undefined' && currentBoardMode === 'group';
    }
    function rerenderBoard() {
        if (boardShowsCrew() && typeof renderNotes === 'function') renderNotes();
    }
    function onChange() {
        if (boardShowsCrew()) rerenderBoard();
        if (typeof updateGroupBadgeUI === 'function') updateGroupBadgeUI();
    }

    // --- Roster status ---
    function statusFor(id) {
        if (sameId(id, pilotId())) {
            const share = getShare();
            return share.online ? { label: 'Online', cls: 'is-online' } : { label: 'Verborgen', cls: 'is-hidden' };
        }
        const member = members.find(m => sameId(m.pilotId, id));
        if (member?.flight && !member.flight.endedAt) return { label: '✈️ Fliegt', cls: 'is-flying' };
        if (member?.online) return { label: 'Online', cls: 'is-online' };
        return { label: 'Offline', cls: 'is-offline' };
    }

    // --- Post-its on the crew board ---
    function el(tag, cls, text) {
        const node = document.createElement(tag);
        if (cls) node.className = cls;
        if (text !== undefined && text !== null && text !== '') node.textContent = String(text);
        return node;
    }
    function placeNote(note, key, x, y, rot) {
        const saved = readJson('ga_group_positions', {})[key];
        note.style.left = `${saved?.x ?? x}%`;
        note.style.top = `${saved?.y ?? y}%`;
        note.style.transform = `rotate(${rot}deg)`;
        if (typeof makeDraggable === 'function') makeDraggable(note, key, true);
    }

    function homebaseShareState() {
        const me = (Array.isArray(window.homebaseGroupDirectory) ? window.homebaseGroupDirectory : [])
            .find(entry => sameId(entry?.pilotId, pilotId()));
        return me ? me.crewShareEnabled === true : null;
    }

    function toggleRow(label, on, onToggle, disabledText = '') {
        const row = el('button', 'crew-share-toggle' + (on ? ' is-on' : ''));
        row.type = 'button';
        row.append(el('span', 'crew-share-label', label), el('span', 'crew-share-state', disabledText || (on ? 'AN' : 'AUS')));
        row.setAttribute('aria-pressed', on ? 'true' : 'false');
        if (disabledText) row.disabled = true;
        else row.addEventListener('click', onToggle);
        return row;
    }

    function renderSettingsNote(board) {
        const share = getShare();
        const note = el('div', 'post-it crew-share-card');
        note.append(el('div', 'post-it-pin'), el('div', 'crew-share-title', '⚙️ MEINE FREIGABEN'));
        const homebase = homebaseShareState();
        note.append(
            toggleRow('🏠 Homebase', homebase === true, async (event) => {
                const button = event.currentTarget;
                button.disabled = true;
                const result = await window.homebaseSetCrewShare?.(homebase !== true);
                if (!result?.ok) alert(result?.message || 'Die Homebase-Freigabe konnte nicht geändert werden.');
                rerenderBoard();
            }, homebase === null ? 'KEINE' : ''),
            toggleRow('🟢 Online-Status', share.online, () => setShare({ online: !share.online })),
            toggleRow('✈️ Aktueller Flug', share.flight, () => setShare({ flight: !share.flight }))
        );
        placeNote(note, 'crew-share-settings', 80, 64, 2);
        board.appendChild(note);
    }

    function timeText(ms) {
        if (!ms) return '';
        try { return new Date(ms).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }); } catch (_) { return ''; }
    }

    // Thin bar; the side-view aircraft from the height profile marks flown | remaining.
    function progressBar(progress) {
        const pct = Math.round(Math.max(0, Math.min(1, progress)) * 100);
        const bar = el('div', 'crew-flight-progress');
        bar.setAttribute('role', 'progressbar');
        bar.setAttribute('aria-label', 'Flugfortschritt');
        bar.setAttribute('aria-valuenow', String(pct));
        bar.setAttribute('aria-valuemin', '0');
        bar.setAttribute('aria-valuemax', '100');
        const fill = el('div', 'crew-flight-progress-fill');
        fill.style.width = `${pct}%`;
        const plane = el('img', 'crew-flight-progress-plane');
        plane.src = 'assets/ui/plane-side.svg';
        plane.alt = '';
        plane.style.left = `${pct}%`;
        bar.append(fill, plane);
        return bar;
    }

    // --- Detail view: position at the time of the last report, route, map layers ---
    const LAYER_KEY = 'ga_crew_flight_map_layers_v1';
    let detailMap = null;

    function buildLayers() {
        const osm = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>';
        const topo = typeof createResilientOpenTopoLayer === 'function'
            ? createResilientOpenTopoLayer({ attribution: `${osm}, <a href="https://opentopomap.org" target="_blank" rel="noopener noreferrer">OpenTopoMap</a>` })
            : L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', { maxZoom: 17, subdomains: 'abc', attribution: `${osm}, OpenTopoMap` });
        const base = {
            '⛰️ Topografie': topo,
            '🗺️ Terrain': L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Shaded_Relief/MapServer/tile/{z}/{y}/{x}', { attribution: 'Tiles &copy; Esri' }),
            '🛰️ Satellit': L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { attribution: 'Tiles &copy; Esri' })
        };
        if (typeof window.createOpenFreeMapLayer === 'function') {
            try { base['📝 Hell'] = window.createOpenFreeMapLayer('positron'); base['🌑 Dunkel'] = window.createOpenFreeMapLayer('dark'); } catch (_) {}
        }
        const overlays = {
            '✈️ VFR-Overlay': L.tileLayer('https://nwy-tiles-api.prod.newaydata.com/tiles/{z}/{x}/{y}.png?path=latest/aero/latest', { attribution: 'AeroData / NewayData', opacity: 0.65, maxNativeZoom: 12 }),
            '🇩🇪 ICAO-Karte (DFS)': L.tileLayer('https://secais.dfs.de/static-maps/icao500/tiles/{z}/{x}/{y}.png', { attribution: '© DFS Deutsche Flugsicherung', maxNativeZoom: 11 })
        };
        return { base, overlays, topo };
    }

    function closeDetail() {
        if (detailMap) { try { detailMap.remove(); } catch (_) {} detailMap = null; }
        document.getElementById('crewFlightDetail')?.remove();
        document.removeEventListener('keydown', onDetailKey);
    }
    function onDetailKey(event) { if (event.key === 'Escape') closeDetail(); }

    function detailFacts(f) {
        const facts = [`Status: ${core.phaseLabel(f.phase) || '—'}`];
        if (f.takeoffAt) facts.push(`Start ${timeText(f.takeoffAt)}`);
        if (f.progress !== null && f.progress !== undefined) facts.push(`${Math.round(f.progress * 100)} % der Route`);
        if (f.pos) {
            if (Number.isFinite(f.pos.altFt)) facts.push(`${f.pos.altFt.toLocaleString('de-DE')} ft`);
            if (Number.isFinite(f.pos.gsKts)) facts.push(`GS ${f.pos.gsKts} kt`);
            if (Number.isFinite(f.pos.hdg)) facts.push(`Kurs ${String(f.pos.hdg).padStart(3, '0')}°`);
        }
        return facts.join(' · ');
    }

    // Tracker v597+ sends the mission gzip-compressed (base64); v596 sends it plain.
    async function missionFromResponse(data) {
        if (data?.state && typeof data.state === 'object') return data.state;
        if (data?.encoding !== 'gzip-base64' || typeof data.data !== 'string' || typeof DecompressionStream !== 'function') return null;
        try {
            const bytes = Uint8Array.from(atob(data.data), c => c.charCodeAt(0));
            const text = await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
            const state = JSON.parse(text);
            return state && typeof state === 'object' ? state : null;
        } catch (_) {
            return null;
        }
    }

    async function flyItYourself(member, button) {
        button.disabled = true;
        button.textContent = 'Lade Auftrag …';
        try {
            const res = await fetch(baseUrl() + encodeURIComponent(groupName()) + '/mission/' + encodeURIComponent(member.pilotId), { headers: headers(), cache: 'no-store' });
            handleStatus(res.status);
            const data = res.ok ? await res.json() : null;
            const state = await missionFromResponse(data);
            if (!state) {
                alert(data?.encoding && typeof DecompressionStream !== 'function'
                    ? 'Dieser Browser kann den Auftrag nicht entpacken. Bitte einen aktuellen Browser verwenden.'
                    : 'Für diesen Flug ist kein Auftrag verfügbar. Er wird geteilt, sobald der Tracker des Piloten (ab v597) den Flug meldet.');
                return;
            }
            const busy = typeof window.gaMissionDraftActive === 'function' && window.gaMissionDraftActive();
            const active = !!localStorage.getItem('ga_active_mission');
            if ((busy || active) && !confirm('Dein aktueller Auftrag wird durch diesen Auftrag ersetzt. Fortfahren?')) return;
            closeDetail();
            if (typeof pinboardRestoreFlightData === 'function') await pinboardRestoreFlightData(core.restoreSharedMissionState(state));
        } catch (_) {
            alert('Der Auftrag konnte nicht geladen werden.');
        } finally {
            button.disabled = false;
            button.textContent = '✈️ Diesen Auftrag selbst fliegen';
        }
    }

    function openDetail(id) {
        const member = members.find(m => sameId(m.pilotId, id));
        if (!member?.flight || typeof L === 'undefined') return;
        closeDetail();
        const f = member.flight;
        const overlay = el('div', 'crew-flight-detail');
        overlay.id = 'crewFlightDetail';
        overlay.addEventListener('click', event => { if (event.target === overlay) closeDetail(); });
        const panel = el('div', 'crew-flight-detail-panel');
        panel.setAttribute('role', 'dialog');
        panel.setAttribute('aria-modal', 'true');
        panel.setAttribute('aria-labelledby', 'crewFlightDetailTitle');
        const head = el('div', 'crew-flight-detail-head');
        const title = el('h2', 'crew-flight-detail-title', `✈️ ${member.nick || member.pilotId}: ${core.placeLabel(f.dep, f.depName)} ➔ ${core.placeLabel(f.dest, f.destName, f.kind === 'free' ? 'frei' : '—')}`);
        title.id = 'crewFlightDetailTitle';
        const close = el('button', 'crew-flight-detail-close', '×');
        close.type = 'button';
        close.setAttribute('aria-label', 'Schließen');
        close.addEventListener('click', closeDetail);
        head.append(title, close);
        const sub = el('div', 'crew-flight-detail-sub', f.title || (f.kind === 'free' ? 'Freier Flug' : 'Auftrag'));
        const facts = el('div', 'crew-flight-detail-facts', detailFacts(f));
        const mapBox = el('div', 'crew-flight-detail-map');
        const foot = el('div', 'crew-flight-detail-foot');
        foot.append(el('span', 'crew-flight-detail-time', f.pos?.at ? `Position von ${timeText(f.pos.at)} Uhr` : 'Keine Position gemeldet'));
        if (f.kind === 'mission' && !sameId(member.pilotId, pilotId())) {
            const fly = el('button', 'crew-flight-detail-fly', '✈️ Diesen Auftrag selbst fliegen');
            fly.type = 'button';
            fly.addEventListener('click', () => flyItYourself(member, fly));
            foot.append(fly);
        }
        panel.append(head, sub, facts, mapBox, foot);
        overlay.append(panel);
        document.body.append(overlay);
        document.addEventListener('keydown', onDetailKey);
        close.focus();

        const { base, overlays, topo } = buildLayers();
        const prefs = readJson(LAYER_KEY, {});
        const startBase = base[prefs.base] || topo;
        detailMap = L.map(mapBox, { layers: [startBase], zoomControl: true, attributionControl: true, maxZoom: 18 });
        (prefs.overlays || []).forEach(name => overlays[name]?.addTo(detailMap));
        L.control.layers(base, overlays, { collapsed: true }).addTo(detailMap);
        const savePrefs = () => {
            const active = Object.entries(base).find(([, layer]) => detailMap.hasLayer(layer))?.[0];
            const on = Object.entries(overlays).filter(([, layer]) => detailMap.hasLayer(layer)).map(([name]) => name);
            try { localStorage.setItem(LAYER_KEY, JSON.stringify({ base: active, overlays: on })); } catch (_) {}
        };
        detailMap.on('baselayerchange overlayadd overlayremove', savePrefs);

        // Set the view first: Leaflet adds markers to a map without a view only later,
        // and the heading rotation needs the marker element right away.
        const route = Array.isArray(f.route) ? f.route : [];
        const line = route.length >= 2 ? route.map(p => [p.lat, p.lon]) : [];
        const bounds = f.pos ? [...line, [f.pos.lat, f.pos.lon]] : line.slice();
        if (bounds.length >= 2) detailMap.fitBounds(bounds, { padding: [30, 30], maxZoom: 11 });
        else if (bounds.length === 1) detailMap.setView(bounds[0], 10);
        else detailMap.setView([51.1657, 10.4515], 6);

        if (line.length) {
            L.polyline(line, { color: '#ff00ff', weight: 3, opacity: 0.85 }).addTo(detailMap);
            route.forEach((p, i) => {
                const end = i === 0 || i === route.length - 1;
                const label = p.name || (i === 0 ? 'Start' : i === route.length - 1 ? 'Ziel' : `Wegpunkt ${i}`);
                L.circleMarker([p.lat, p.lon], end
                    ? { radius: 6, color: '#fff', weight: 2, fillColor: i ? '#c0392b' : '#1e7b34', fillOpacity: 1 }
                    : { radius: 4, color: '#ff00ff', weight: 2, fillColor: '#fff', fillOpacity: 1 })
                    .bindTooltip(el('span', '', label), { direction: 'top', offset: [0, -4] }).addTo(detailMap); // element, never HTML: names come from other pilots
            });
        }
        if (f.pos) {
            const html = window.GAMapLivePresentation?.aircraftHtml?.() || '<div class="crew-flight-detail-dot"></div>';
            const marker = L.marker([f.pos.lat, f.pos.lon], {
                icon: L.divIcon({ html, className: 'live-plane-marker crew-flight-detail-plane', iconSize: [0, 0], iconAnchor: [0, 0] }),
                interactive: false, keyboard: false, zIndexOffset: 1000
            });
            const rotate = () => {
                const svg = marker.getElement()?.querySelector('svg');
                if (svg && Number.isFinite(f.pos.hdg)) svg.style.transform = `rotate(${f.pos.hdg}deg)`;
            };
            marker.on('add', rotate);
            marker.addTo(detailMap);
            rotate();
        }
        setTimeout(() => detailMap?.invalidateSize(), 50);
    }

    function renderFlightNote(board, member, index, seen) {
        const f = member.flight;
        const ended = f.endedAt > 0;
        const note = el('div', 'post-it crew-flight-card' + (ended ? ' is-landed' : ''));
        const fresh = !seen.has(flightKey(member)) || (freshUntil.get(flightKey(member)) || 0) > Date.now();
        if (!ended && !sameId(member.pilotId, pilotId()) && fresh) note.append(el('div', 'post-it-new-badge', 'NEU'));
        note.append(el('div', 'post-it-pin'));
        const who = sameId(member.pilotId, pilotId()) ? `${member.nick || 'Ich'} (du)` : (member.nick || member.pilotId);
        note.append(el('div', 'crew-flight-who', `✈️ ${who}`));
        const dep = core.placeLabel(f.dep, f.depName);
        const dest = core.placeLabel(f.dest, f.destName, f.kind === 'free' ? 'frei' : '—');
        note.append(el('div', 'crew-flight-route', `${dep} ➔ ${dest}`));
        const title = f.title || (f.kind === 'free' ? 'Freier Flug' : 'Auftrag');
        note.append(el('div', 'crew-flight-title', title));
        const status = el('div', 'crew-flight-status');
        status.append(el('span', 'crew-flight-phase', core.phaseLabel(f.phase) || '—'));
        const time = f.takeoffAt ? `Start ${timeText(f.takeoffAt)}` : (f.startedAt ? `seit ${timeText(f.startedAt)}` : '');
        if (time) status.append(el('span', 'crew-flight-time', time));
        note.append(status);
        if (f.progress !== null && f.progress !== undefined) note.append(progressBar(f.progress));
        if (f.pos || f.route) {
            const details = el('button', 'crew-flight-detail-btn', '🗺️ Details');
            details.type = 'button';
            details.addEventListener('click', () => openDetail(member.pilotId));
            note.append(details);
        }
        // First row at the bottom, a second row (flights 4-6) in the middle of the board.
        placeNote(note, `crew-flight-${String(member.pilotId).toLowerCase()}`, 27 + (index % 3) * 18, index < 3 ? 60 : 33, index % 2 ? 2 : -2);
        board.appendChild(note);
    }

    function renderBoard(board) {
        if (!board || !groupName()) return;
        renderSettingsNote(board);
        const seen = new Set(readJson(SEEN_KEY, []));
        const flights = fetchedGroup === groupName() ? members.filter(m => m.flight) : [];
        flights.sort((a, b) => Number(!!a.flight.endedAt) - Number(!!b.flight.endedAt));
        flights.slice(0, 6).forEach((member, index) => renderFlightNote(board, member, index, seen));
        markFlightsSeen();
        if (Date.now() - fetchedAt >= OPEN_REFRESH_MS) void refresh('board-open');
    }

    function tick() {
        if (document.hidden || !groupName()) return;
        if (typeof window.gaShouldPauseNetwork === 'function' && window.gaShouldPauseNetwork('crew-presence')) return;
        void beat(false);
        if (Date.now() - fetchedAt >= POLL_MS) void refresh('poll');
    }

    function reset() {
        members = [];
        fetchedAt = 0;
        fetchedGroup = '';
        lastBeat = null;
        blockedUntil = 0;
    }

    setInterval(tick, TICK_MS);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });
    setTimeout(tick, 5000);

    window.gaCrewPresence = {
        statusFor, renderBoard, hasNewFlight, refresh, getShare, setShare, openDetail,
        beatNow: () => beat(true),
        applyShareFromCloud, sharePayload, reset
    };
})();
