import { CrewLiveRoom } from './crew-live-room.js';

const MAX_MESSAGE_BYTES = 512 * 1024;
const TELEMETRY_INTERVAL_MS = 450;
const PIN_OK_CACHE_MS = 10 * 60 * 1000;
const PIN_REJECT_CACHE_MS = 60 * 1000;
const PIN_VERIFY_TIMEOUT_MS = 4000;
const WRONG_PIN_MESSAGE = 'Falscher PIN für diesen Tracker-Raum.';
const PIN_LIMITED_MESSAGE = 'Falscher PIN für diesen Tracker-Raum: zu viele Versuche, bitte später erneut.';

// Asks the account worker whether syncId+PIN belong together.
// 'ok' and 'invalid' are answers; 'unavailable' means no answer (no binding,
// no account behind this ID, timeout, server error) and keeps the old rule.
async function verifyAccountPin(env, syncId, pin, clientIp) {
    if (!env || !env.GA_PROXY || typeof env.GA_PROXY.fetch !== 'function') return 'unavailable';
    if (!syncId || !pin) return 'invalid';
    const headers = { 'Content-Type': 'application/json' };
    if (clientIp) headers['CF-Connecting-IP'] = clientIp;
    let timer = null;
    try {
        const response = await Promise.race([
            env.GA_PROXY.fetch('https://ga-proxy.internal/api/auth/verify', {
                method: 'POST',
                headers,
                body: JSON.stringify({ pilotId: syncId, pin })
            }),
            new Promise(resolve => { timer = setTimeout(() => resolve(null), PIN_VERIFY_TIMEOUT_MS); })
        ]);
        if (!response) return 'unavailable';
        if (response.status === 200) return 'ok';
        if (response.status === 429) return 'limited';
        if (response.status === 401) return 'invalid';
        return 'unavailable';
    } catch (_) {
        return 'unavailable';
    } finally {
        if (timer) clearTimeout(timer);
    }
}

function normalizeSyncId(value) {
    return String(value || '').trim().toUpperCase();
}

async function sha256Hex(value) {
    const bytes = new TextEncoder().encode(String(value || ''));
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

function textMessage(message) {
    if (typeof message === 'string') return message;
    if (message instanceof ArrayBuffer) return new TextDecoder().decode(message);
    if (ArrayBuffer.isView(message)) {
        return new TextDecoder().decode(message.buffer.slice(message.byteOffset, message.byteOffset + message.byteLength));
    }
    return String(message || '');
}

function isRealtimeTelemetry(data) {
    return data?.type === 'gps'
        && data.commandOnly !== true
        && !data.trackerCommand
        && data.commandAckOnly !== true
        && data.trackerStatusOnly !== true;
}

function messageKind(data) {
    if (data?.target === 'tracker' || data?.trackerCommand || data?.commandOnly === true) return 'tracker-command';
    if (data?.trackerAck || data?.commandAckOnly === true) return 'viewer-data';
    if (data?.type === 'gps' || data?.type === 'traffic') return 'viewer-data';
    return 'broadcast';
}

function recipientAccepts(data, attachment) {
    if (data?.audioRecipientClientId && data.audioRecipientClientId !== attachment?.clientId) return false;
    const role = String(attachment?.role || 'unknown');
    const kind = messageKind(data);
    if (kind === 'tracker-command') return role === 'tracker' || role === 'unknown';
    if (kind === 'viewer-data') return role !== 'tracker';
    return true;
}

function safeAttachment(socket) {
    try {
        return socket.deserializeAttachment?.() || {};
    } catch (_) {
        return {};
    }
}

function closeWithError(socket, message, code = 1008) {
    try { socket.send(JSON.stringify({ type: 'error', message })); } catch (_) {}
    try { socket.close(code, message.slice(0, 120)); } catch (_) {}
}

export class RelayRoom {
    constructor(ctx, env) {
        this.ctx = ctx;
        this.env = env;
        this.pinChecks = new Map();
    }

    async checkPin(syncId, pin, pinHash, clientIp) {
        const now = Date.now();
        const cached = this.pinChecks.get(pinHash);
        if (cached && cached.until > now) return cached.result;
        const result = await verifyAccountPin(this.env, syncId, pin, clientIp);
        if (result === 'ok') this.pinChecks.set(pinHash, { result, until: now + PIN_OK_CACHE_MS });
        else if (result === 'invalid' || result === 'limited') this.pinChecks.set(pinHash, { result, until: now + PIN_REJECT_CACHE_MS });
        if (this.pinChecks.size > 32) this.pinChecks.delete(this.pinChecks.keys().next().value);
        return result;
    }

    async fetch(request) {
        if (String(request.headers.get('Upgrade') || '').toLowerCase() !== 'websocket') {
            return new Response('WebSocket upgrade required', { status: 426 });
        }
        const roomKey = new URL(request.url).searchParams.get('room') || '';
        if (!/^[a-f0-9]{64}$/.test(roomKey)) return new Response('Invalid room key', { status: 400 });

        const pair = new WebSocketPair();
        const client = pair[0];
        const server = pair[1];
        const clientIp = String(request.headers.get('CF-Connecting-IP') || '').slice(0, 64);
        server.serializeAttachment({ joined: false, roomKey, role: 'unknown', pinHash: '', pinVerified: false, clientIp, lastTelemetryAt: 0 });
        this.ctx.acceptWebSocket(server, ['ga-relay']);
        server.send(JSON.stringify({ type: 'relay_status', relay: 'cloudflare', status: 'ready' }));
        return new Response(null, { status: 101, webSocket: client });
    }

    async webSocketMessage(socket, message) {
        const raw = textMessage(message);
        if (!raw || new TextEncoder().encode(raw).byteLength > MAX_MESSAGE_BYTES) {
            closeWithError(socket, 'Relay-Nachricht ist zu groß.', 1009);
            return;
        }

        let data;
        try {
            data = JSON.parse(raw);
        } catch (_) {
            closeWithError(socket, 'Ungültige Relay-Nachricht.');
            return;
        }

        const attachment = safeAttachment(socket);
        if (data?.type === 'join') {
            const normalizedSyncId = normalizeSyncId(data.syncId);
            if (!normalizedSyncId || await sha256Hex(normalizedSyncId) !== attachment.roomKey) {
                closeWithError(socket, 'Ungültiger Tracker-Raum.');
                return;
            }
            const pin = String(data.pin || '');
            const incomingPinHash = await sha256Hex(pin);
            const check = await this.checkPin(normalizedSyncId, pin, incomingPinHash, attachment.clientIp);
            if (check === 'invalid' || check === 'limited') {
                closeWithError(socket, check === 'limited' ? PIN_LIMITED_MESSAGE : WRONG_PIN_MESSAGE);
                return;
            }
            const others = this.ctx.getWebSockets('ga-relay')
                .filter(candidate => candidate !== socket)
                .map(candidate => ({ candidate, attachment: safeAttachment(candidate) }))
                .filter(entry => entry.attachment.joined === true);
            if (check === 'ok') {
                // The account confirmed this PIN: earlier joins with another PIN
                // (an old tab, a stale tracker) no longer hold the room.
                for (const entry of others) {
                    if (entry.attachment.pinHash !== incomingPinHash) closeWithError(entry.candidate, WRONG_PIN_MESSAGE);
                }
            } else {
                // No answer from the account worker: keep the previous rule, but a
                // confirmed PIN in the room outranks unconfirmed ones.
                const verified = others.find(entry => entry.attachment.pinVerified === true && entry.attachment.pinHash);
                const first = others.find(entry => entry.attachment.pinHash);
                const roomPinHash = (verified || first) ? (verified || first).attachment.pinHash : '';
                if (roomPinHash && roomPinHash !== incomingPinHash) {
                    closeWithError(socket, WRONG_PIN_MESSAGE);
                    return;
                }
            }
            socket.serializeAttachment({
                ...attachment,
                joined: true,
                clientId: String(data.clientId || '').slice(0, 160),
                role: data.relayRole === 'tracker' ? 'tracker' : (data.relayRole === 'viewer' ? 'viewer' : 'unknown'),
                pinHash: incomingPinHash,
                pinVerified: check === 'ok'
            });
            return;
        }

        if (attachment.joined !== true) {
            closeWithError(socket, 'Relay-Beitritt fehlt.');
            return;
        }
        if (normalizeSyncId(data?.syncId) && await sha256Hex(normalizeSyncId(data.syncId)) !== attachment.roomKey) {
            closeWithError(socket, 'Ungültiger Tracker-Raum.');
            return;
        }
        if (data?.type !== 'gps' && data?.type !== 'traffic') return;

        if (isRealtimeTelemetry(data)) {
            const now = Date.now();
            const carriesOneShotTraffic = Array.isArray(data.traffic) && data.traffic.length > 0;
            if (!carriesOneShotTraffic && (now - Number(attachment.lastTelemetryAt || 0)) < TELEMETRY_INTERVAL_MS) return;
            socket.serializeAttachment({ ...attachment, lastTelemetryAt: now });
        }

        const serialized = JSON.stringify(data);
        for (const recipient of this.ctx.getWebSockets('ga-relay')) {
            if (recipient === socket) continue;
            const recipientAttachment = safeAttachment(recipient);
            if (recipientAttachment.joined !== true || !recipientAccepts(data, recipientAttachment)) continue;
            try { recipient.send(serialized); } catch (_) {}
        }
    }

    webSocketClose() {}
    webSocketError() {}
}

export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        if (String(request.headers.get('Upgrade') || '').toLowerCase() !== 'websocket') {
            return Response.json({ service: 'ga-relay', relay: 'cloudflare', status: 'ready' });
        }
        const roomKey = String(url.searchParams.get('room') || '').toLowerCase();
        if (!/^[a-f0-9]{64}$/.test(roomKey)) return new Response('Invalid room key', { status: 400 });
        // Crew live room (positions of crew aircraft), separate from the pilot rooms.
        if (url.pathname === '/crew') {
            if (!env.CREW_LIVE_ROOMS) return new Response('Crew live unavailable', { status: 503 });
            return env.CREW_LIVE_ROOMS.get(env.CREW_LIVE_ROOMS.idFromName('crew:' + roomKey)).fetch(request);
        }
        const id = env.RELAY_ROOMS.idFromName(roomKey);
        return env.RELAY_ROOMS.get(id).fetch(request);
    }
};

export { CrewLiveRoom };

export {
    MAX_MESSAGE_BYTES,
    TELEMETRY_INTERVAL_MS,
    isRealtimeTelemetry,
    messageKind,
    normalizeSyncId,
    recipientAccepts,
    verifyAccountPin,
    sha256Hex
};
