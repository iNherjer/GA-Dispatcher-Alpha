// Crew live traffic in the web app (viewer only): MSFS 2024 hides multiplayer aircraft,
// so crew trackers share their positions through the crew room on the Cloudflare relay
// (tools/cloudflare-relay/crew-live-room.js). The app only listens:
// - connected only while the app is visible and the map table or a crew flight detail is open,
// - crew aircraft are merged into the map traffic (green, call sign, see traffic-map-layer.js),
// - the crew board detail view follows the pilot live (crew-presence-client.js).
(function() {
    'use strict';
    const TICKET_URL = 'https://ga-proxy.einherjer.workers.dev/api/crew-presence-v1/';
    const RELAY_URL = 'wss://ga-relay.einherjer.workers.dev/crew';
    const CONTACT_TTL_MS = 15000;
    const RENDER_MS = 2000;
    const TICKET_MARGIN_MS = 5 * 60 * 1000;

    let socket = null, joined = false, crew = '', ownPid = '', ticket = null, connecting = false;
    let retryAt = 0, retryMs = 5000;
    const contacts = new Map();
    // Diagnostics for the debug console (profile.js): own short history, so the entries are not
    // pushed out of the shared console buffer. Never contains ID, PIN or ticket.
    const history = [];
    let joinedAt = 0, roomTrackers = -1, roomViewers = -1, lastError = '';
    const seenPilots = new Set();
    function note(msg, level = 'info') {
        history.push({ at: Date.now(), level, msg });
        if (history.length > 20) history.shift();
        if (level === 'warn') lastError = msg;
        try { console[level]('[CrewLive] ' + msg); } catch (_) {}
    }

    function groupName() { try { return typeof getGroupName === 'function' ? String(getGroupName() || '').trim().toUpperCase() : ''; } catch (_) { return ''; } }
    function credentials() {
        try { return { id: typeof getSyncId === 'function' ? getSyncId() : '', pin: typeof getSyncPin === 'function' ? getSyncPin() : '' }; } catch (_) { return { id: '', pin: '' }; }
    }
    function mapOpen() { const board = document.getElementById('mapTableOverlay'); return !!(board && board.classList.contains('active')); }
    function detailPilot() { return window.gaCrewPresence?.liveDetailPilot?.() || null; }
    function wanted() { return !document.hidden && !!groupName() && (mapOpen() || !!detailPilot()); }

    async function sha256Hex(text) {
        const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
        return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
    }
    function ticketPid(value) {
        try {
            const body = String(value).split('.')[0].replace(/-/g, '+').replace(/_/g, '/');
            return String(JSON.parse(atob(body + '='.repeat((4 - body.length % 4) % 4))).pid || '').toLowerCase();
        } catch (_) { return ''; }
    }

    async function connect() {
        if (connecting || socket) return;
        const { id, pin } = credentials();
        if (!id || !pin) {
            if (lastError !== 'Keine Pilot-ID/PIN – Zuschauer-Anmeldung nicht möglich') note('Keine Pilot-ID/PIN – Zuschauer-Anmeldung nicht möglich', 'warn');
            retryAt = Date.now() + 30000;
            return;
        }
        connecting = true;
        const forCrew = crew;
        try {
            note('Verbinde als Zuschauer mit Crew ' + forCrew + ' …');
            if (!ticket || ticket.crew !== forCrew || ticket.exp - Date.now() < TICKET_MARGIN_MS) {
                const res = await fetch(TICKET_URL + encodeURIComponent(forCrew) + '/live-ticket', { headers: { 'X-Pilot-ID': id, 'X-Pilot-PIN': pin }, cache: 'no-store' });
                if (!res.ok) throw new Error('Ticket abgelehnt (HTTP ' + res.status + (res.status === 403 ? ', kein Crew-Mitglied' : '') + ')');
                const body = await res.json();
                ticket = { value: body.ticket, exp: Number(body.exp) || 0, crew: forCrew };
                ownPid = ticketPid(body.ticket);
            }
            if (forCrew !== crew || !wanted()) { note('Abgebrochen: Karte/Detail inzwischen geschlossen'); return; }
            const ws = new WebSocket(RELAY_URL + '?room=' + await sha256Hex('crew:' + forCrew));
            socket = ws;
            ws.onopen = () => { try { ws.send(JSON.stringify({ type: 'crew_join', ticket: ticket.value, role: 'viewer', clientId: 'web-' + ownPid })); } catch (_) {} };
            ws.onmessage = event => onMessage(ws, event.data);
            ws.onclose = event => {
                if (socket !== ws) return;
                const wasJoined = joined;
                socket = null; joined = false; joinedAt = 0; roomTrackers = roomViewers = -1;
                retryAt = Date.now() + retryMs;
                note((wasJoined ? 'Verbindung getrennt' : 'Verbindung vor der Anmeldung getrennt')
                    + ' (Code ' + (event?.code ?? '?') + (event?.reason ? ', ' + event.reason : '') + '), neuer Versuch in ' + Math.round(retryMs / 1000) + ' s', 'warn');
                retryMs = Math.min(120000, retryMs * 2);
            };
            ws.onerror = () => {};
        } catch (error) {
            retryAt = Date.now() + retryMs;
            note('Anmeldung fehlgeschlagen: ' + (error?.message || error) + ', neuer Versuch in ' + Math.round(retryMs / 1000) + ' s', 'warn');
            retryMs = Math.min(120000, retryMs * 2);
        } finally {
            connecting = false;
        }
    }
    function disconnect() {
        const old = socket;
        const wasJoined = joined;
        socket = null; joined = false; joinedAt = 0; roomTrackers = roomViewers = -1; contacts.clear(); seenPilots.clear();
        if (old) { try { old.onclose = null; old.close(1000, 'hidden'); } catch (_) {} }
        if (old && wasJoined) note('Als Zuschauer abgemeldet (Karte/Detail geschlossen oder App im Hintergrund)');
        render();
    }
    function onMessage(ws, raw) {
        if (ws !== socket) return;
        let data;
        try { data = JSON.parse(raw); } catch (_) { return; }
        if (data.type === 'crew_joined') {
            joined = true; retryMs = 5000; joinedAt = Date.now(); lastError = '';
            note('Erfolgreich als Zuschauer angemeldet (Crew ' + crew + ')');
        } else if (data.type === 'crew_audience' && Array.isArray(data.members)) {
            const others = data.members.filter(m => String(m?.pid || '').toLowerCase() !== ownPid);
            const trackers = others.filter(m => m?.role === 'tracker').length, viewers = others.length - trackers;
            if (trackers !== roomTrackers || viewers !== roomViewers) {
                roomTrackers = trackers; roomViewers = viewers;
                note('Im Crew-Raum: ' + trackers + ' Tracker, ' + viewers + ' weitere Zuschauer');
            }
        } else if (data.type === 'error') {
            note('Relay meldet: ' + String(data.message || '').slice(0, 120), 'warn');
        } else if (data.type === 'crew_pos' && data.pid && data.p && data.pid !== ownPid) {
            const nick = String(data.nick || data.pid).slice(0, 64);
            if (!seenPilots.has(data.pid)) { seenPilots.add(data.pid); note('Erste Live-Position von ' + nick); }
            contacts.set(data.pid, { nick, p: data.p, at: Date.now() });
            window.gaCrewPresence?.liveDetailPosition?.(data.pid, data.p);
        } else if (data.type === 'crew_gone' && data.pid) {
            if (contacts.has(data.pid)) note('Live-Position beendet: ' + (contacts.get(data.pid)?.nick || data.pid));
            contacts.delete(data.pid); seenPilots.delete(data.pid);
        }
    }

    // Crew aircraft as traffic contacts (same format as the tracker's crew contacts).
    function list() {
        const out = [], now = Date.now();
        for (const [pid, c] of contacts) {
            if (now - c.at > CONTACT_TTL_MS) { contacts.delete(pid); continue; }
            const p = c.p, ac = { id: 'crew:' + pid, crew: 1, nick: c.nick, lat: p.lat, lon: p.lon };
            ['alt', 'hdg', 'gs', 'vs', 'agl'].forEach(key => { if (Number.isFinite(p[key])) ac[key] = p[key]; });
            if (p.gnd) ac.gnd = 1;
            ac.cs = String(p.cs || c.nick || pid).slice(0, 12);
            if (p.k) ac.k = p.k;
            out.push(ac);
        }
        return out;
    }
    // Tracker list plus the viewer's own crew contacts (fresher ones win by id).
    function merge(trackerList) {
        const own = list();
        if (!own.length) return trackerList;
        const ids = new Set(own.map(ac => ac.id));
        return own.concat((Array.isArray(trackerList) ? trackerList : []).filter(ac => !ids.has(String(ac?.id))));
    }
    let lastRenderedCount = 0;
    function render() {
        const own = list();
        if (!own.length && !lastRenderedCount) return;
        lastRenderedCount = own.length;
        if (typeof window.gaRenderCrewLiveTraffic === 'function') window.gaRenderCrewLiveTraffic();
    }

    function maintain() {
        const next = groupName();
        if (next !== crew) { disconnect(); crew = next; ticket = null; retryAt = 0; retryMs = 5000; }
        if (!wanted()) { if (socket) disconnect(); return; }
        if (!socket && !connecting && Date.now() >= retryAt) void connect();
    }
    setInterval(maintain, 3000);
    setInterval(render, RENDER_MS);
    document.addEventListener('visibilitychange', maintain);

    window.gaCrewLive = {
        merge, contacts: list, maintain,
        state: () => ({
            crew, connected: !!socket, joined, joinedAt, contacts: contacts.size, wanted: wanted(),
            mapOpen: mapOpen(), detailOpen: !!detailPilot(), trackers: roomTrackers, viewers: roomViewers,
            retryAt: socket || connecting ? 0 : retryAt, lastError, history: history.slice()
        })
    };
})();
