/* Lossless, bounded relay transport. Mission authority remains the only state writer. */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory(require('crypto').webcrypto);
    else root.GAMissionTransfer = factory(root.crypto);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (crypto) {
    'use strict';
    const CHUNK = 48 * 1024, MAX_BYTES = 16 * 1024 * 1024, TTL = 90000;
    const TYPE = 'mission_transfer_v1';
    const encoder = new TextEncoder();
    const hash = async bytes => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2, '0')).join('');
    function base64(bytes) {
        if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64');
        let s = ''; for (const b of bytes) s += String.fromCharCode(b); return btoa(s);
    }
    function unbase64(s) {
        if (typeof s !== 'string' || s.length > CHUNK * 4 / 3 || !/^[A-Za-z0-9+/]*={0,2}$/.test(s)) throw Error('mission_transfer_invalid');
        return typeof Buffer !== 'undefined' ? new Uint8Array(Buffer.from(s, 'base64')) : Uint8Array.from(atob(s), c => c.charCodeAt(0));
    }
    function create({ role, peer, sendFrame, onError = () => {}, now = Date.now, retryMs = 1500, ttl = TTL }) {
        const outgoing = new Map(), incoming = new Map(), completed = new Map();
        let closed = false;
        const send = packet => { try { return sendFrame({ type: TYPE, ...packet }) !== false; } catch (_) { return false; } };
        function fail(id, error) {
            const tx = outgoing.get(id); if (!tx) return;
            outgoing.delete(id); onError(tx.commandId, error, tx.messageType);
        }
        function tick() {
            const t = now(); let allowance = 4;
            for (const [id, tx] of outgoing) {
                if (t - tx.started > ttl) { fail(id, 'mission_transfer_timeout'); continue; }
                if (!tx.bytes) continue;
                let pending = 0;
                for (let i = 0; i < tx.count; i++) {
                    if (tx.acked.has(i)) continue;
                    if (tx.sent.has(i) && t - tx.sent.get(i) < retryMs) { pending++; continue; }
                    if (!allowance || pending >= 4) break;
                    if (send({ ...tx.meta, kind: 'chunk', index: i, data: base64(tx.bytes.subarray(i * CHUNK, (i + 1) * CHUNK)) })) {
                        tx.sent.set(i, t); pending++; allowance--;
                    }
                }
                // A lost final receipt must not replay the mission action.
                if (tx.acked.size === tx.count && t - tx.probed >= retryMs && allowance) {
                    send({ ...tx.meta, kind: 'probe' }); tx.probed = t; allowance--;
                }
            }
            for (const [id, rx] of incoming) if (t - rx.started > ttl) incoming.delete(id);
            for (const [id, done] of completed) if (t - done.at > ttl * 2) completed.delete(id);
        }
        const timer = setInterval(tick, 100); timer.unref?.();
        function enqueue(message, targetPeer) {
            if (closed || outgoing.size >= 2) return false;
            const bytes = encoder.encode(JSON.stringify(message));
            if (bytes.length > MAX_BYTES) { onError(message.trackerCommand?.commandId || message.trackerAck?.commandId, 'mission_transfer_too_large', message.trackerAck?.type || message.trackerCommand?.type); return false; }
            if ([...outgoing.values()].reduce((n, tx) => n + tx.size, 0) + bytes.length > MAX_BYTES) return false;
            const id = Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('');
            const tx = { started: now(), size: bytes.length, commandId: message.trackerCommand?.commandId || message.trackerAck?.commandId,
                messageType: message.trackerAck?.type || message.trackerCommand?.type, count: Math.ceil(bytes.length / CHUNK), sent: new Map(), acked: new Set(), probed: 0 };
            outgoing.set(id, tx);
            hash(bytes).then(digest => {
                if (closed || !outgoing.has(id)) return;
                tx.meta = { id, peer: targetPeer, direction: role === 'app' ? 'to-tracker' : 'to-app', bytes: bytes.length, count: tx.count, hash: digest };
                tx.bytes = bytes; tick();
            }).catch(() => fail(id, 'mission_transfer_invalid'));
            return true;
        }
        async function receive(packet) {
            if (packet?.type !== TYPE) return { handled: false };
            const handled = { handled: true };
            if (closed || typeof packet.peer !== 'string' || !packet.peer || packet.peer.length > 200 || (role === 'app' && packet.peer !== peer)) return handled;
            if (!/^[a-f0-9]{32}$/.test(packet.id || '')) return handled;
            const tx = outgoing.get(packet.id);
            if (packet.kind === 'ack' || packet.kind === 'done' || packet.kind === 'reject') {
                if (!tx || packet.peer !== tx.meta?.peer || packet.hash !== tx.meta?.hash || packet.direction !== tx.meta?.direction) return handled;
                if (packet.kind === 'reject') fail(packet.id, 'mission_transfer_invalid');
                else if (packet.kind === 'done') outgoing.delete(packet.id);
                else if (Number.isInteger(packet.index) && packet.index >= 0 && packet.index < tx.count) tx.acked.add(packet.index);
                return handled;
            }
            if (packet.direction !== (role === 'app' ? 'to-app' : 'to-tracker')) return handled;
            const done = completed.get(packet.id);
            if (done) { if (packet.peer === done.meta.peer && packet.hash === done.meta.hash) send({ ...done.meta, kind: 'done' }); return handled; }
            if (packet.kind !== 'chunk') return handled;
            if (!Number.isInteger(packet.bytes) || packet.bytes < 1 || packet.bytes > MAX_BYTES || packet.count !== Math.ceil(packet.bytes / CHUNK)
                || !Number.isInteger(packet.index) || packet.index < 0 || packet.index >= packet.count || !/^[a-f0-9]{64}$/.test(packet.hash || '')) return handled;
            let rx = incoming.get(packet.id);
            const meta = { id: packet.id, peer: packet.peer, direction: packet.direction, bytes: packet.bytes, count: packet.count, hash: packet.hash };
            if (!rx) {
                if (incoming.size >= 2 || completed.size >= 128 || [...incoming.values()].reduce((n, value) => n + value.meta.bytes, 0) + packet.bytes > MAX_BYTES) return handled;
                rx = { meta, started: now(), parts: new Map(), verifying: false }; incoming.set(packet.id, rx);
            }
            if (JSON.stringify(rx.meta) !== JSON.stringify(meta) || rx.verifying) return handled;
            try {
                const part = unbase64(packet.data);
                if (part.length !== Math.min(CHUNK, packet.bytes - packet.index * CHUNK)) throw Error();
                if (!rx.parts.has(packet.index)) rx.parts.set(packet.index, part);
                send({ ...meta, kind: 'ack', index: packet.index });
                if (rx.parts.size !== packet.count) return handled;
                rx.verifying = true;
                const bytes = new Uint8Array(packet.bytes);
                for (const [index, value] of rx.parts) bytes.set(value, index * CHUNK);
                if (await hash(bytes) !== packet.hash) throw Error();
                const message = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
                const body = role === 'app' ? message.trackerAck : message.trackerCommand;
                if (!body || !/^mission_/.test(body.type || '') || body.type === TYPE || body.missionTransferPeer !== packet.peer) throw Error();
                if (closed || incoming.get(packet.id) !== rx) return handled;
                incoming.delete(packet.id); completed.set(packet.id, { meta, at: now() });
                send({ ...meta, kind: 'done' });
                return { handled: true, message };
            } catch (_) { incoming.delete(packet.id); send({ ...meta, kind: 'reject' }); return handled; }
        }
        return { enqueue, receive, tick, close() { closed = true; clearInterval(timer); outgoing.clear(); incoming.clear(); completed.clear(); } };
    }
    return { create, TYPE, MAX_BYTES, CHUNK };
});
