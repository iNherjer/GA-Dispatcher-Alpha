const MAX_MESSAGE_BYTES = 512 * 1024;
const TELEMETRY_INTERVAL_MS = 450;

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
    constructor(ctx) {
        this.ctx = ctx;
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
        server.serializeAttachment({ joined: false, roomKey, role: 'unknown', pinHash: '', lastTelemetryAt: 0 });
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
            const incomingPinHash = await sha256Hex(String(data.pin || ''));
            const joinedSockets = this.ctx.getWebSockets('ga-relay')
                .filter(candidate => candidate !== socket)
                .map(candidate => safeAttachment(candidate))
                .filter(candidate => candidate.joined === true);
            const roomPinHash = joinedSockets.find(candidate => candidate.pinHash)?.pinHash || '';
            if (roomPinHash && roomPinHash !== incomingPinHash) {
                closeWithError(socket, 'Falscher PIN für diesen Tracker-Raum.');
                return;
            }
            socket.serializeAttachment({
                ...attachment,
                joined: true,
                role: data.relayRole === 'tracker' ? 'tracker' : (data.relayRole === 'viewer' ? 'viewer' : 'unknown'),
                pinHash: incomingPinHash
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
        const id = env.RELAY_ROOMS.idFromName(roomKey);
        return env.RELAY_ROOMS.get(id).fetch(request);
    }
};

export {
    MAX_MESSAGE_BYTES,
    TELEMETRY_INTERVAL_MS,
    isRealtimeTelemetry,
    messageKind,
    normalizeSyncId,
    recipientAccepts,
    sha256Hex
};
