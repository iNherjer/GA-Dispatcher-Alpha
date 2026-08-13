import assert from 'node:assert/strict';
import {
    RelayRoom,
    TELEMETRY_INTERVAL_MS,
    isRealtimeTelemetry,
    messageKind,
    recipientAccepts,
    sha256Hex
} from './relay-worker.js';

class MockSocket {
    constructor() {
        this.attachment = {};
        this.messages = [];
        this.closed = null;
    }
    serializeAttachment(value) { this.attachment = structuredClone(value); }
    deserializeAttachment() { return structuredClone(this.attachment); }
    send(value) { this.messages.push(JSON.parse(String(value))); }
    close(code, reason) { this.closed = { code, reason }; }
}

class MockContext {
    constructor(sockets = []) { this.sockets = sockets; }
    getWebSockets() { return this.sockets; }
}

function joinedSocket({ roomKey, role, pinHash }) {
    const socket = new MockSocket();
    socket.serializeAttachment({ joined: true, roomKey, role, pinHash, lastTelemetryAt: 0 });
    return socket;
}

assert.equal(isRealtimeTelemetry({ type: 'gps', lat: 1 }), true);
assert.equal(isRealtimeTelemetry({ type: 'gps', trackerStatusOnly: true }), false);
assert.equal(messageKind({ type: 'gps', commandOnly: true, trackerCommand: {} }), 'tracker-command');
assert.equal(recipientAccepts({ type: 'gps', commandOnly: true }, { role: 'tracker' }), true);
assert.equal(recipientAccepts({ type: 'gps', commandOnly: true }, { role: 'viewer' }), false);

const roomKey = await sha256Hex('PILOT-42');
const pinHash = await sha256Hex('1234');
const tracker = joinedSocket({ roomKey, role: 'tracker', pinHash });
const viewer = joinedSocket({ roomKey, role: 'viewer', pinHash });
const otherViewer = joinedSocket({ roomKey, role: 'viewer', pinHash });
const ctx = new MockContext([tracker, viewer, otherViewer]);
const room = new RelayRoom(ctx);

await room.webSocketMessage(tracker, JSON.stringify({ type: 'gps', syncId: 'pilot-42', pin: '1234', lat: 1, lon: 2 }));
assert.equal(viewer.messages.length, 1);
assert.equal(otherViewer.messages.length, 1);
assert.equal(tracker.messages.length, 0);

await room.webSocketMessage(viewer, JSON.stringify({
    type: 'gps', syncId: 'pilot-42', pin: '1234', commandOnly: true,
    trackerCommand: { type: 'mission_snapshot_request' }
}));
assert.equal(tracker.messages.length, 1);
assert.equal(otherViewer.messages.length, 1, 'commands are not copied to other viewers');

tracker.attachment.lastTelemetryAt = Date.now();
await room.webSocketMessage(tracker, JSON.stringify({
    type: 'gps', syncId: 'pilot-42', pin: '1234', lat: 3, lon: 4,
    traffic: [{ id: 'traffic-1' }]
}));
assert.equal(viewer.messages.length, 2, 'one-shot traffic bypasses the throttle window');
assert.deepEqual(viewer.messages.at(-1).traffic, [{ id: 'traffic-1' }]);

tracker.attachment.lastTelemetryAt = Date.now() - TELEMETRY_INTERVAL_MS - 1;
await room.webSocketMessage(tracker, JSON.stringify({ type: 'gps', syncId: 'pilot-42', pin: '1234', lat: 5, lon: 6 }));
assert.equal(viewer.messages.length, 3);
assert.equal(viewer.messages.at(-1).traffic, undefined);

const intruder = new MockSocket();
intruder.serializeAttachment({ joined: false, roomKey, role: 'unknown', pinHash: '', lastTelemetryAt: 0 });
ctx.sockets.push(intruder);
await room.webSocketMessage(intruder, JSON.stringify({
    type: 'join', syncId: 'pilot-42', pin: 'wrong', relayRole: 'viewer'
}));
assert.equal(intruder.closed?.code, 1008);
assert.match(intruder.messages[0]?.message || '', /Falscher PIN/);

console.log('cloudflare relay tests passed');
