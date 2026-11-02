/* Crew fleet on the crew board: aircraft the crew parked with the MSFS mod
 * "Where I Left It" (shared by the tracker desktop app), their status and a map.
 * Status rules (reserved / flying / landed, 12 h each): wili-fleet-core.js.
 * Worker: tools/cloudflare-worker/crew-fleet.mjs.
 *
 * Traffic: no own polling. The crew presence poll (every 3 min while visible) carries the
 * fleet revision; the fleet is loaded only when it changed, when the board opens (at most
 * every 30 s, answered "unchanged" when nothing happened) and with the 🔄 button.
 * Switched off under "Meine Freigaben" (crewShare.fleet): no note, no requests. */
(function () {
    'use strict';
    const core = window.GAWiliFleetCore;
    if (!core) return;

    const OPEN_REFRESH_MS = 30 * 1000;
    const BACKOFF_MS = 10 * 60 * 1000;

    let records = new Map();
    let rev = 0;
    let fetchedAt = 0;
    let fetchedGroup = '';
    let fetching = null;
    let blockedUntil = 0;
    let busyKey = '';

    const groupName = () => (typeof getGroupName === 'function' ? getGroupName() : '') || '';
    const pilotId = () => (typeof getSyncId === 'function' ? getSyncId() : '') || '';
    const pin = () => (typeof getSyncPin === 'function' ? getSyncPin() : '') || '';
    const baseUrl = () => String(typeof SYNC_URL === 'string' ? SYNC_URL : 'https://ga-proxy.einherjer.workers.dev/api/sync/')
        .replace(/\/sync\/?$/, '/crew-fleet-v1/');
    const sameId = (a, b) => String(a || '').toLowerCase() === String(b || '').toLowerCase();
    const enabled = () => window.gaCrewPresence?.getShare?.().fleet !== false;
    const headers = () => ({ 'Content-Type': 'application/json', 'X-Pilot-ID': pilotId(), 'X-Pilot-PIN': pin() });
    const readJson = (key, fallback) => {
        try { const value = JSON.parse(localStorage.getItem(key) || 'null'); return value ?? fallback; } catch (_) { return fallback; }
    };

    function canReach() {
        return enabled() && !!(groupName() && pilotId() && pin()) && Date.now() >= blockedUntil;
    }

    function reset() {
        records = new Map();
        rev = 0;
        fetchedAt = 0;
        fetchedGroup = '';
    }

    async function refresh(reason = 'poll', options = {}) {
        if (options.force) blockedUntil = 0;
        if (!canReach()) return;
        if (fetching) return fetching;
        const group = groupName();
        if (group !== fetchedGroup) reset();
        fetching = (async () => {
            try {
                const res = await fetch(baseUrl() + encodeURIComponent(group) + '?since=' + rev, { headers: headers(), cache: 'no-store' });
                if (res.status === 401 || res.status === 403) blockedUntil = Date.now() + BACKOFF_MS;
                if (!res.ok || group !== groupName()) return;
                const data = await res.json();
                fetchedAt = Date.now();
                fetchedGroup = group;
                if (data?.unchanged) return;
                if (data?.full) records = new Map();
                for (const record of Array.isArray(data?.records) ? data.records : []) {
                    if (core.validKey(record?.key)) records.set(record.key, record);
                }
                rev = Number(data?.rev) || 0;
                rerender(reason);
            } catch (_) {}
        })().finally(() => { fetching = null; });
        return fetching;
    }

    // Called by the crew presence poll with the fleet revision it saw.
    function noteRev(next) {
        if (!Number.isSafeInteger(next) || !canReach()) return;
        if (next !== rev || fetchedGroup !== groupName()) void refresh('presence');
    }

    function boardShowsCrew() {
        return document.getElementById('pinboardOverlay')?.classList.contains('active')
            && typeof currentBoardMode !== 'undefined' && currentBoardMode === 'group';
    }
    function rerender() {
        updateOpenMap();
        if (boardShowsCrew() && typeof renderNotes === 'function') renderNotes();
    }

    async function lockAction(key, action) {
        if (busyKey) return;
        busyKey = key;
        rerender();
        try {
            const res = await fetch(baseUrl() + encodeURIComponent(groupName()) + '/' + action, {
                method: 'POST', headers: headers(), body: JSON.stringify({ key })
            });
            const data = await res.json().catch(() => null);
            if (res.status === 409) alert(`Diese Maschine ist gerade ${core.LOCK_LABEL[data?.holder?.state]?.toLowerCase() || 'belegt'} (${data?.holder?.nick || 'Crew'}).`);
            else if (!res.ok) alert('Die Maschine konnte nicht geändert werden. Bitte später erneut versuchen.');
        } catch (_) {
            alert('Die Crew-Cloud ist gerade nicht erreichbar.');
        } finally {
            busyKey = '';
            await refresh('lock-action', { force: true });
            rerender();
        }
    }

    // --- Helpers for the view ---
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
    function ageText(ms) {
        if (!ms) return '';
        const minutes = Math.max(0, Math.round((Date.now() - ms) / 60000));
        if (minutes < 60) return `vor ${minutes} min`;
        const hours = Math.round(minutes / 60);
        return hours < 48 ? `vor ${hours} h` : `vor ${Math.round(hours / 24)} T`;
    }
    function placeText(pos) {
        const lat = Number(pos?.lat), lon = Number(pos?.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return '';
        return typeof nearestAirportLabel === 'function' ? nearestAirportLabel(lat, lon) : `${lat.toFixed(3)}, ${lon.toFixed(3)}`;
    }
    function view(record) {
        const lock = core.activeLock(record.lock);
        return {
            key: record.key,
            tail: record.pos?.tail || String(record.key).replace(/^tail:/, '').split('|')[0] || '',
            title: record.pos?.title || core.titleFromKey(record.key),
            pos: record.pos,
            state: lock?.state || 'free',
            holder: lock?.nick || '',
            mine: Boolean(lock) && sameId(lock.pilotId, pilotId()),
            until: lock?.until || 0,
            owner: record.ownerNick || '',
            last: record.lastNick || '',
            conflict: record.conflict?.nick && lock ? record.conflict.nick : ''
        };
    }
    function sortedViews() {
        const order = { flying: 0, landed: 1, reserved: 2, free: 3 };
        return [...records.values()].map(view)
            .sort((a, b) => order[a.state] - order[b.state] || a.tail.localeCompare(b.tail));
    }
    function statusText(v) {
        if (v.state === 'free') return core.LOCK_LABEL.free;
        return `${core.LOCK_LABEL[v.state]} · ${v.mine ? 'du' : (v.holder || 'Crew')}`;
    }
    function untilText(ms) {
        try { return new Date(ms).toLocaleString('de-DE', { weekday: 'short', hour: '2-digit', minute: '2-digit' }); } catch (_) { return ''; }
    }

    function aircraftRow(v) {
        const row = el('div', `crew-fleet-row is-${v.state}`);
        const head = el('div', 'crew-fleet-row-head');
        head.append(el('span', 'crew-fleet-tail', v.tail || v.title), el('span', `crew-fleet-chip is-${v.state}`, statusText(v)));
        row.append(head);
        row.append(el('div', 'crew-fleet-type', v.title));
        const facts = [];
        const place = placeText(v.pos);
        if (place) facts.push(`📍 ${place}`);
        if (v.state !== 'free' && v.until) facts.push(`bis ${untilText(v.until)}`);
        else if (v.last) facts.push(`zuletzt ${v.last}`);
        if (facts.length) row.append(el('div', 'crew-fleet-facts', facts.join(' · ')));
        if (v.conflict) row.append(el('div', 'crew-fleet-conflict', `⚠️ auch von ${v.conflict} geflogen – zählt nicht`));
        let action = null;
        if (v.state === 'free') action = ['reserve', 'Reservieren'];
        else if (v.mine) action = ['release', 'Freigeben'];
        if (action) {
            const button = el('button', 'crew-fleet-btn', busyKey === v.key ? '…' : action[1]);
            button.type = 'button';
            button.disabled = Boolean(busyKey);
            button.addEventListener('click', event => { event.stopPropagation(); void lockAction(v.key, action[0]); });
            row.append(button);
        }
        return row;
    }

    function renderBoard(board) {
        if (!board || !groupName() || !enabled()) return;
        if (Date.now() - fetchedAt >= OPEN_REFRESH_MS) void refresh('board-open');
        if (fetchedGroup !== groupName() || !records.size) return;
        const views = sortedViews();
        const note = el('div', 'post-it crew-fleet-card');
        note.append(el('div', 'post-it-pin'));
        const title = el('div', 'crew-fleet-title');
        title.append(el('span', '', `🛩️ VEREINSFLOTTE (${views.length})`));
        const mapButton = el('button', 'crew-fleet-map-btn', '🗺️');
        mapButton.type = 'button';
        mapButton.title = 'Alle Maschinen auf der Karte';
        mapButton.setAttribute('aria-label', 'Alle Maschinen auf der Karte');
        mapButton.addEventListener('click', event => { event.stopPropagation(); openMap(); });
        title.append(mapButton);
        const list = el('div', 'crew-fleet-list');
        // Scrolling the list must not start dragging the note.
        ['mousedown', 'touchstart', 'pointerdown'].forEach(type => list.addEventListener(type, event => event.stopPropagation(), { passive: true }));
        views.forEach(v => list.append(aircraftRow(v)));
        note.append(title, list);
        placeNote(note, 'crew-fleet', 62, 33, -1.5);
        board.appendChild(note);
    }

    // --- Map of all aircraft ---
    let map = null;
    let mapLayer = null;
    const STATE_COLOR = { free: '#1e7b34', reserved: '#b4650b', flying: '#1a5fb4', landed: '#666' };

    function closeMap() {
        if (map) { try { map.remove(); } catch (_) {} map = null; mapLayer = null; }
        document.getElementById('crewFleetMap')?.remove();
        document.removeEventListener('keydown', onMapKey);
    }
    function onMapKey(event) { if (event.key === 'Escape') closeMap(); }

    function drawMarkers(fit) {
        if (!map) return;
        mapLayer.clearLayers();
        const points = [];
        for (const v of sortedViews()) {
            const lat = Number(v.pos?.lat), lon = Number(v.pos?.lon);
            if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
            points.push([lat, lon]);
            const tip = el('div', 'crew-fleet-tip');
            tip.append(el('strong', '', v.tail || v.title), el('div', '', v.title), el('div', '', statusText(v)));
            if (v.owner) tip.append(el('div', '', `Halter ${v.owner}`));
            L.circleMarker([lat, lon], { radius: 7, color: '#fff', weight: 2, fillColor: STATE_COLOR[v.state], fillOpacity: 1 })
                .bindTooltip(tip, { direction: 'top', offset: [0, -6] }).addTo(mapLayer); // element, never HTML: names come from other pilots
        }
        if (!fit) return;
        if (points.length >= 2) map.fitBounds(points, { padding: [30, 30], maxZoom: 11 });
        else if (points.length === 1) map.setView(points[0], 11);
        else map.setView([51.1657, 10.4515], 6);
    }

    function openMap() {
        if (typeof L === 'undefined') return;
        closeMap();
        const overlay = el('div', 'crew-flight-detail');
        overlay.id = 'crewFleetMap';
        overlay.addEventListener('click', event => { if (event.target === overlay) closeMap(); });
        const panel = el('div', 'crew-flight-detail-panel');
        panel.setAttribute('role', 'dialog');
        panel.setAttribute('aria-modal', 'true');
        panel.setAttribute('aria-labelledby', 'crewFleetMapTitle');
        const head = el('div', 'crew-flight-detail-head');
        const title = el('h2', 'crew-flight-detail-title', `🛩️ Vereinsflotte ${groupName()}`);
        title.id = 'crewFleetMapTitle';
        const close = el('button', 'crew-flight-detail-close', '×');
        close.type = 'button';
        close.setAttribute('aria-label', 'Schließen');
        close.addEventListener('click', closeMap);
        head.append(title, close);
        const legend = el('div', 'crew-fleet-legend');
        for (const state of ['free', 'reserved', 'flying', 'landed']) {
            const item = el('span', '');
            const dot = el('span', 'crew-fleet-legend-dot');
            dot.style.background = STATE_COLOR[state];
            item.append(dot, document.createTextNode(core.LOCK_LABEL[state]));
            legend.append(item);
        }
        const mapBox = el('div', 'crew-flight-detail-map');
        panel.append(head, legend, mapBox);
        overlay.append(panel);
        document.body.append(overlay);
        document.addEventListener('keydown', onMapKey);
        close.focus();
        const layers = window.gaCrewPresence?.buildLayers?.();
        map = L.map(mapBox, { layers: [layers?.topo || L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '&copy; OpenStreetMap' })], maxZoom: 18 });
        if (layers) L.control.layers(layers.base, layers.overlays, { collapsed: true }).addTo(map);
        mapLayer = L.layerGroup().addTo(map);
        drawMarkers(true);
        setTimeout(() => map?.invalidateSize(), 50);
    }
    function updateOpenMap() { drawMarkers(false); }

    window.gaCrewFleet = { renderBoard, refresh, noteRev, reset, openMap };
})();
