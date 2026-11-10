// Crew live room: positions of crew aircraft for map display and traffic warnings.
// MSFS 2024 does not expose multiplayer aircraft via SimConnect, so every tracker
// sends its own position here and receives the others (field test 09.11.2026).
//
// Join with a ticket from ga-proxy (/api/crew-presence-v1/<crew>/live-ticket): HMAC-SHA256
// over the payload {v, crew, pid, nick, exp} with CREW_LIVE_SECRET. Identity (pid, nick)
// always comes from the ticket, never from a position message.
//
//   in  {type:'crew_join', ticket, role:'tracker'|'viewer', clientId}
//   in  {type:'crew_pos', p:{lat, lon, alt, hdg, gs, vs, gnd, agl, cs, k, ic}}   (trackers)
//   in  {type:'crew_off'}                                                    (tracker stops)
//   out {type:'crew_joined'} · {type:'crew_audience', members:[{pid, role}]}
//   out {type:'crew_pos', pid, nick, at, p} · {type:'crew_gone', pid}

const CREW_MAX_MESSAGE_BYTES = 2048;
const CREW_POS_INTERVAL_MS = 800;
const TAG = 'crew-live';

function text(message) {
    if (typeof message === 'string') return message;
    if (message instanceof ArrayBuffer) return new TextDecoder().decode(message);
    if (ArrayBuffer.isView(message)) return new TextDecoder().decode(message.buffer.slice(message.byteOffset, message.byteOffset + message.byteLength));
    return String(message || '');
}

function fromBase64Url(value) {
    const normalized = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
    const binary = atob(padded);
    return Uint8Array.from(binary, char => char.charCodeAt(0));
}

export async function crewRoomKey(crew) {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('crew:' + String(crew || '').trim().toUpperCase()));
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

// Returns the ticket payload or null.
export async function verifyCrewTicket(secret, ticket, now = Date.now()) {
    if (!secret || String(secret).length < 32 || typeof ticket !== 'string' || ticket.length > 1200) return null;
    const [body, signature] = ticket.split('.');
    if (!body || !signature) return null;
    try {
        const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
        if (!await crypto.subtle.verify('HMAC', key, fromBase64Url(signature), new TextEncoder().encode(body))) return null;
        const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(body)));
        if (payload?.v !== 1 || !payload.crew || !payload.pid || !(Number(payload.exp) > now)) return null;
        return payload;
    } catch (_) {
        return null;
    }
}

function num(value, min, max, digits = 0) {
    const n = Number(value);
    if (!Number.isFinite(n) || n < min || n > max) return null;
    const f = 10 ** digits;
    return Math.round(n * f) / f;
}

// Only known fields with plausible ranges go through.
export function cleanCrewPosition(p) {
    if (!p || typeof p !== 'object') return null;
    const lat = num(p.lat, -90, 90, 6), lon = num(p.lon, -180, 180, 6);
    if (lat === null || lon === null || (lat === 0 && lon === 0)) return null;
    const out = { lat, lon };
    const alt = num(p.alt, -2000, 60000), hdg = num(p.hdg, 0, 360), gs = num(p.gs, 0, 1000), vs = num(p.vs, -20000, 20000), agl = num(p.agl, -500, 60000);
    if (alt !== null) out.alt = alt;
    if (hdg !== null) out.hdg = hdg;
    if (gs !== null) out.gs = gs;
    if (vs !== null) out.vs = vs;
    if (agl !== null) out.agl = agl;
    if (p.gnd === 1 || p.gnd === true) out.gnd = 1;
    if (typeof p.cs === 'string' && p.cs.trim()) out.cs = p.cs.trim().slice(0, 12);
    if (typeof p.k === 'string' && /^[a-z]{1,8}$/.test(p.k)) out.k = p.k;
    if (typeof p.ic === 'string' && /^[a-z0-9_-]{1,24}$/.test(p.ic)) out.ic = p.ic;
    return out;
}

function attachmentOf(socket) {
    try { return socket.deserializeAttachment?.() || {}; } catch (_) { return {}; }
}

function sendJson(socket, data) {
    try { socket.send(JSON.stringify(data)); } catch (_) {}
}

function reject(socket, message) {
    sendJson(socket, { type: 'error', message });
    try { socket.close(1008, message.slice(0, 120)); } catch (_) {}
}

export class CrewLiveRoom {
    constructor(ctx, env) {
        this.ctx = ctx;
        this.env = env || {};
    }

    joined(except = null) {
        return this.ctx.getWebSockets(TAG).filter(socket => socket !== except && attachmentOf(socket).joined === true);
    }

    broadcast(data, except = null) {
        const serialized = JSON.stringify(data);
        for (const socket of this.joined(except)) { try { socket.send(serialized); } catch (_) {} }
    }

    audience(except = null) {
        const seen = new Set(), members = [];
        for (const socket of this.joined(except)) {
            const a = attachmentOf(socket), key = a.pid + '|' + a.role;
            if (seen.has(key)) continue;
            seen.add(key);
            members.push({ pid: a.pid, role: a.role });
        }
        this.broadcast({ type: 'crew_audience', members }, except);
    }

    async fetch(request) {
        if (String(request.headers.get('Upgrade') || '').toLowerCase() !== 'websocket') return new Response('WebSocket upgrade required', { status: 426 });
        const roomKey = new URL(request.url).searchParams.get('room') || '';
        if (!/^[a-f0-9]{64}$/.test(roomKey)) return new Response('Invalid room key', { status: 400 });
        const pair = new WebSocketPair();
        const server = pair[1];
        server.serializeAttachment({ joined: false, roomKey, role: 'unknown', pid: '', nick: '', lastPosAt: 0 });
        this.ctx.acceptWebSocket(server, [TAG]);
        sendJson(server, { type: 'relay_status', relay: 'cloudflare', room: 'crew', status: 'ready' });
        return new Response(null, { status: 101, webSocket: pair[0] });
    }

    async webSocketMessage(socket, message) {
        const raw = text(message);
        if (!raw || raw.length > CREW_MAX_MESSAGE_BYTES) { reject(socket, 'Crew-Nachricht ist zu groß.'); return; }
        let data;
        try { data = JSON.parse(raw); } catch (_) { reject(socket, 'Ungültige Crew-Nachricht.'); return; }
        const attachment = attachmentOf(socket);

        if (data?.type === 'crew_join') {
            const ticket = await verifyCrewTicket(this.env.CREW_LIVE_SECRET, data.ticket);
            if (!ticket || await crewRoomKey(ticket.crew) !== attachment.roomKey) { reject(socket, 'Ungültiges Crew-Ticket.'); return; }
            socket.serializeAttachment({
                ...attachment, joined: true,
                pid: String(ticket.pid).toLowerCase().slice(0, 160),
                nick: String(ticket.nick || ticket.pid).slice(0, 64),
                role: data.role === 'tracker' ? 'tracker' : 'viewer',
                clientId: String(data.clientId || '').slice(0, 160),
                exp: Number(ticket.exp)
            });
            sendJson(socket, { type: 'crew_joined' });
            this.audience();
            return;
        }
        if (attachment.joined !== true) { reject(socket, 'Crew-Beitritt fehlt.'); return; }
        if (data?.type === 'crew_pos') {
            if (attachment.role !== 'tracker') return;
            const now = Date.now();
            if (now - Number(attachment.lastPosAt || 0) < CREW_POS_INTERVAL_MS) return;
            const p = cleanCrewPosition(data.p);
            if (!p) return;
            socket.serializeAttachment({ ...attachment, lastPosAt: now, sending: true });
            this.broadcast({ type: 'crew_pos', pid: attachment.pid, nick: attachment.nick, at: now, p }, socket);
            return;
        }
        if (data?.type === 'crew_off' && attachment.role === 'tracker') {
            socket.serializeAttachment({ ...attachment, sending: false });
            this.broadcast({ type: 'crew_gone', pid: attachment.pid }, socket);
        }
    }

    webSocketClose(socket) { this.left(socket); }
    webSocketError(socket) { this.left(socket); }

    left(socket) {
        const attachment = attachmentOf(socket);
        if (attachment.joined !== true) return;
        if (attachment.role === 'tracker') this.broadcast({ type: 'crew_gone', pid: attachment.pid }, socket);
        this.audience(socket);
    }
}

export { CREW_POS_INTERVAL_MS, CREW_MAX_MESSAGE_BYTES };
