/* Crew fleet on the crew board: aircraft the crew parked with the MSFS mod
 * "Where I Left It" (shared by the tracker desktop app), their status and a map.
 * Status rules (reserved / flying / landed, 12 h each): wili-fleet-core.js.
 * Worker: tools/cloudflare-worker/crew-fleet.mjs.
 *
 * Traffic: no own polling. The crew presence poll (every 3 min while visible) carries the
 * fleet revision; the fleet is loaded only when it changed, when the board opens (at most
 * every 30 s, answered "unchanged" when nothing happened) and with the 🔄 button.
 * Switched off under "Meine Freigaben" (crewShare.fleet): no note, no requests.
 * When another pilot changes the fleet, a notice shows for 30 s (closable). */
(function () {
    'use strict';
    const core = window.GAWiliFleetCore;
    if (!core) return;

    const OPEN_REFRESH_MS = 30 * 1000;
    const NOTICE_MS = 30 * 1000;
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
                const changed = (Array.isArray(data?.records) ? data.records : []).filter(record => core.validKey(record?.key));
                // The first load after opening the app is not a change.
                if (rev > 0) showNotice(core.noticeText(core.changeNotes(records, changed, pilotId())));
                if (data?.full) records = new Map();
                // Removed by its owner: gone from the note and the map.
                for (const record of changed) {
                    if (core.isRemoved(record)) records.delete(record.key);
                    else records.set(record.key, record);
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

    async function removeAircraft(v) {
        if (busyKey) return;
        if (!confirm(tr('fleet.remove.confirm', '{tail} {title} endgültig aus der Vereinsflotte löschen?\n\nBei den anderen wird sie im Mod ausgeblendet und als „entfernt“ markiert. In deinem eigenen Hangar bleibt sie.', { tail: v.tail || '', title: v.title }))) return;
        busyKey = v.key;
        rerender();
        try {
            const res = await fetch(baseUrl() + encodeURIComponent(groupName()) + '/remove', { method: 'POST', headers: headers(), body: JSON.stringify({ key: v.key }) });
            const data = await res.json().catch(() => null);
            if (res.status === 409) alert(tr('fleet.remove.inUse', 'Die Maschine wird gerade genutzt ({nick}). Löschen geht, wenn sie frei ist.', { nick: data?.holder?.nick || 'Crew' }));
            else if (res.status === 403) alert(tr('fleet.remove.notOwner', 'Nur der Halter kann eine Maschine aus der Vereinsflotte löschen.'));
            else if (!res.ok) alert(tr('fleet.remove.failed', 'Die Maschine konnte nicht gelöscht werden. Bitte später erneut versuchen.'));
        } catch (_) {
            alert(tr('fleet.remove.offline', 'Die Crew-Cloud ist gerade nicht erreichbar.'));
        } finally {
            busyKey = '';
            await refresh('remove', { force: true });
            rerender();
        }
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
            if (res.status === 409) alert(tr('fleet.alert.locked', 'Diese Maschine ist gerade {state} ({nick}).', { state: lockText(data?.holder?.state)?.toLowerCase() || tr('fleet.alert.lockedFallback', 'belegt'), nick: data?.holder?.nick || 'Crew' }));
            else if (!res.ok) alert(tr('fleet.alert.failed', 'Die Maschine konnte nicht geändert werden. Bitte später erneut versuchen.'));
        } catch (_) {
            alert(tr('fleet.alert.offline', 'Die Crew-Cloud ist gerade nicht erreichbar.'));
        } finally {
            busyKey = '';
            await refresh('lock-action', { force: true });
            rerender();
        }
    }

    // --- UI language (i18n-core.js) ---
    // wili-fleet-core.js is shared with the tracker and the worker and stays German
    // (LOCK_LABEL, noticeText); only the display here is translated.
    function tr(key, german, vars) {
        if (window.GAI18n) return window.GAI18n.t(key, vars, german);
        return String(german).replace(/\{([a-zA-Z0-9_]+)\}/g, (m, n) => (vars && Object.prototype.hasOwnProperty.call(vars, n) ? String(vars[n]) : m));
    }
    function lockText(state) { const german = core.LOCK_LABEL[state]; return german ? tr(`fleet.lock.${state}`, german) : german; }

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
        if (minutes < 60) return tr('fleet.age.minutes', 'vor {n} min', { n: minutes });
        const hours = Math.round(minutes / 60);
        return hours < 48 ? tr('fleet.age.hours', 'vor {n} h', { n: hours }) : tr('fleet.age.days', 'vor {n} T', { n: Math.round(hours / 24) });
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
            owned: sameId(record.ownerPilotId, pilotId()),
            moved: Number(record.pos?.savedAt) || Number(record.updatedAt) || 0,
            until: lock?.until || 0,
            owner: record.ownerNick || '',
            last: record.lastNick || '',
            conflict: record.conflict?.nick && lock ? record.conflict.nick : '',
            conflictFlown: record.conflict?.event === 'takeoff'
        };
    }
    function sortedViews() {
        // The most recently moved aircraft on top; the note shows four, the rest scrolls.
        return [...records.values()].map(view)
            .sort((a, b) => b.moved - a.moved || a.tail.localeCompare(b.tail));
    }
    function statusText(v) {
        if (v.state === 'free') return lockText('free');
        return `${lockText(v.state)} · ${v.mine ? tr('fleet.you', 'du') : (v.holder || 'Crew')}`;
    }
    function untilText(ms) {
        const locale = window.GAI18n && window.GAI18n.getLanguage() === 'en' ? 'en-GB' : 'de-DE';
        try { return new Date(ms).toLocaleString(locale, { weekday: 'short', hour: '2-digit', minute: '2-digit' }); } catch (_) { return ''; }
    }

    function aircraftRow(v) {
        const row = el('div', `crew-fleet-row is-${v.state}`);
        const head = el('div', 'crew-fleet-row-head');
        // One line: tail, status right next to it, the action at the right edge.
        head.append(el('span', 'crew-fleet-tail', v.tail || v.title), el('span', `crew-fleet-chip is-${v.state}`, statusText(v)));
        row.append(head);
        row.append(el('div', 'crew-fleet-type', v.title));
        const facts = [];
        const place = placeText(v.pos);
        if (place) facts.push(`📍 ${place}`);
        if (v.state !== 'free' && v.until) facts.push(tr('fleet.until', 'bis {time}', { time: untilText(v.until) }));
        else if (v.last) facts.push(tr('fleet.last', 'zuletzt {nick}', { nick: v.last }));
        if (facts.length) row.append(el('div', 'crew-fleet-facts', facts.join(' · ')));
        if (v.conflict) row.append(el('div', 'crew-fleet-conflict', v.conflictFlown
            ? tr('fleet.conflictFlown', '⚠️ auch von {nick} geflogen – zählt nicht', { nick: v.conflict })
            : tr('fleet.conflictUsed', '⚠️ auch von {nick} genutzt – zählt nicht', { nick: v.conflict })));
        let action = null;
        if (v.state === 'free') action = ['reserve', tr('fleet.reserve', 'Reservieren')];
        else if (v.mine) action = ['release', tr('fleet.release', 'Freigeben')];
        if (action) {
            const button = el('button', 'crew-fleet-btn', busyKey === v.key ? '…' : action[1]);
            button.type = 'button';
            button.disabled = Boolean(busyKey);
            button.addEventListener('click', event => { event.stopPropagation(); void lockAction(v.key, action[0]); });
            head.append(button);
        }
        // The owner may take his aircraft out of the fleet for good.
        if (v.owned && (v.state === 'free' || v.mine)) {
            const remove = el('button', 'crew-fleet-del', '🗑');
            remove.type = 'button';
            remove.title = tr('fleet.remove.title', 'Aus der Vereinsflotte löschen');
            remove.setAttribute('aria-label', tr('fleet.remove.aria', '{name} aus der Vereinsflotte löschen', { name: v.tail || v.title }));
            remove.disabled = Boolean(busyKey);
            remove.addEventListener('click', event => { event.stopPropagation(); void removeAircraft(v); });
            head.append(remove);
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
        title.append(el('span', '', tr('fleet.boardTitle', '🛩️ VEREINSFLOTTE ({count})', { count: views.length })));
        const mapButton = el('button', 'crew-fleet-map-btn', '🗺️');
        mapButton.type = 'button';
        mapButton.title = tr('fleet.mapButton', 'Alle Maschinen auf der Karte');
        mapButton.setAttribute('aria-label', tr('fleet.mapButton', 'Alle Maschinen auf der Karte'));
        mapButton.addEventListener('click', event => { event.stopPropagation(); openMap(); });
        title.append(mapButton);
        const list = el('div', 'crew-fleet-list');
        // Scrolling the list must not start dragging the note.
        ['mousedown', 'touchstart', 'pointerdown'].forEach(type => list.addEventListener(type, event => event.stopPropagation(), { passive: true }));
        views.forEach(v => list.append(aircraftRow(v)));
        note.append(title, list);
        placeNote(note, 'crew-fleet', 62, 33, -1.5);
        board.appendChild(note);
        // Room for four aircraft; more scroll inside the note. Measured once laid out (fonts) and
        // again when the rows change size.
        const fit = () => {
            const rows = list.children;
            if (!list.isConnected || rows.length <= 4) return;
            list.style.maxHeight = `${rows[3].offsetTop + rows[3].offsetHeight - rows[0].offsetTop + 2}px`;
        };
        requestAnimationFrame(fit);
        if (typeof ResizeObserver === 'function') new ResizeObserver(fit).observe(list.children[0] || list);
    }

    // --- Map of all aircraft ---
    let map = null;
    let mapLayer = null;
    const STATE_COLOR = { free: '#1e7b34', reserved: '#b4650b', busy: '#6b3fa0', flying: '#1a5fb4', landed: '#666' };

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
            if (v.owner) tip.append(el('div', '', tr('fleet.owner', 'Halter {nick}', { nick: v.owner })));
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
        const title = el('h2', 'crew-flight-detail-title', tr('fleet.mapTitle', '🛩️ Vereinsflotte {crew}', { crew: groupName() }));
        title.id = 'crewFleetMapTitle';
        const close = el('button', 'crew-flight-detail-close', '×');
        close.type = 'button';
        close.setAttribute('aria-label', tr('crew.detail.close', 'Schließen'));
        close.addEventListener('click', closeMap);
        head.append(title, close);
        const legend = el('div', 'crew-fleet-legend');
        for (const state of ['free', 'reserved', 'busy', 'flying', 'landed']) {
            const item = el('span', '');
            const dot = el('span', 'crew-fleet-legend-dot');
            dot.style.background = STATE_COLOR[state];
            item.append(dot, document.createTextNode(lockText(state)));
            legend.append(item);
        }
        const mapBox = el('div', 'crew-flight-detail-map');
        panel.append(head, legend, mapBox);
        overlay.append(panel);
        document.body.append(overlay);
        document.addEventListener('keydown', onMapKey);
        close.focus();
        const layers = window.gaCrewPresence?.buildLayers?.();
        // Same layer choice and shading as the crew flight detail map (shared preference key).
        const prefs = readJson('ga_crew_flight_map_layers_v1', {});
        const start = layers ? (layers.base[prefs.base] || layers.topo) : L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '&copy; OpenStreetMap' });
        map = L.map(mapBox, { layers: [start], maxZoom: 18 });
        if (layers) {
            (prefs.overlays || []).forEach(name => layers.overlays[name]?.addTo(map));
            L.control.layers(layers.base, layers.overlays, { collapsed: true }).addTo(map);
            map.on('baselayerchange overlayadd overlayremove', () => {
                const active = Object.entries(layers.base).find(([, layer]) => map.hasLayer(layer))?.[0];
                const on = Object.entries(layers.overlays).filter(([, layer]) => map.hasLayer(layer)).map(([name]) => name);
                try { localStorage.setItem('ga_crew_flight_map_layers_v1', JSON.stringify({ base: active, overlays: on })); } catch (_) {}
            });
            // With the VFR overlay the topo map fades to 50 % so the airspaces stand out;
            // from zoom 15 the overlay hides and the topo map is full again.
            const vfr = layers.overlays['✈️ VFR-Overlay'];
            const dfs = layers.overlays['🇩🇪 ICAO-Karte (DFS)'];
            const shade = () => {
                if (!map) return;
                const hidden = map.getZoom() >= 15;
                const vfrOn = vfr && map.hasLayer(vfr);
                if (vfrOn) vfr.setOpacity(hidden ? 0 : 0.65);
                if (map.hasLayer(layers.topo)) layers.topo.setOpacity(vfrOn && !hidden && !(dfs && map.hasLayer(dfs)) ? 0.5 : 1);
            };
            map.on('baselayerchange overlayadd overlayremove zoomend', shade);
            map.whenReady(shade);
        }
        mapLayer = L.layerGroup().addTo(map);
        drawMarkers(true);
        setTimeout(() => map?.invalidateSize(), 50);
    }
    function updateOpenMap() { drawMarkers(false); }

    // --- Notice: another pilot changed the fleet ---
    let noticeTimer = null;
    function hideNotice() {
        clearTimeout(noticeTimer);
        document.getElementById('crewFleetNotice')?.remove();
    }
    function openCrewBoard() {
        hideNotice();
        if (!document.getElementById('pinboardOverlay')?.classList.contains('active') && typeof togglePinboard === 'function') togglePinboard();
        if (typeof switchPinboardMode === 'function') switchPinboardMode('group');
    }
    function showNotice(text) {
        if (!text) return;
        hideNotice();
        const box = el('div', 'crew-fleet-notice');
        box.id = 'crewFleetNotice';
        box.setAttribute('role', 'status');
        const open = el('button', 'crew-fleet-notice-open', tr('fleet.notice.open', 'Pinnwand'));
        open.type = 'button';
        open.addEventListener('click', openCrewBoard);
        const close = el('button', 'crew-fleet-notice-close', '×');
        close.type = 'button';
        close.setAttribute('aria-label', tr('fleet.notice.close', 'Hinweis schließen'));
        close.addEventListener('click', hideNotice);
        box.append(el('span', 'crew-fleet-notice-text', `🛩️ ${text}`), open, close);
        document.body.append(box);
        noticeTimer = setTimeout(hideNotice, NOTICE_MS);
    }

    window.gaCrewFleet = { renderBoard, refresh, noteRev, reset, openMap, showNotice };
})();
