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

viewer.attachment.clientId = 'audio-phone';
otherViewer.attachment.clientId = 'observer';
const beforeTargeted = otherViewer.messages.length;
await room.webSocketMessage(tracker, JSON.stringify({ type: 'gps', commandAckOnly: true, audioRecipientClientId: 'audio-phone', trackerAck: { type: 'mission_voice_playback_ack', payload: { data: 'audio' } } }));
assert.equal(viewer.messages.at(-1).trackerAck.payload.data, 'audio');
assert.equal(otherViewer.messages.length, beforeTargeted, 'audio bytes go only to the requesting socket');

// PIN check on join against the account worker (17.11.2026).
{
    const accountPins = { 'PILOT-7': '4321' };
    let verifyCalls = 0;
    const env = { GA_PROXY: { fetch: async (_url, init) => {
        verifyCalls += 1;
        const body = JSON.parse(init.body);
        if (!(body.pilotId in accountPins)) return new Response('{}', { status: 404 });
        return new Response('{}', { status: accountPins[body.pilotId] === body.pin ? 200 : 401 });
    } } };
    const pilotRoom = await sha256Hex('PILOT-7');
    const freshSocket = () => { const s = new MockSocket(); s.serializeAttachment({ joined: false, roomKey: pilotRoom, role: 'unknown', pinHash: '', lastTelemetryAt: 0 }); return s; };

    // An old tab with a wrong PIN joined first under the old rule.
    const staleTab = joinedSocket({ roomKey: pilotRoom, role: 'viewer', pinHash: await sha256Hex('0000') });
    const trackerJoin = freshSocket();
    const joinCtx = new MockContext([staleTab, trackerJoin]);
    const joinRoom = new RelayRoom(joinCtx, env);
    await joinRoom.webSocketMessage(trackerJoin, JSON.stringify({ type: 'join', syncId: 'pilot-7', pin: '4321', relayRole: 'tracker' }));
    assert.equal(trackerJoin.closed, null, 'the account PIN gets in although another PIN was first');
    assert.equal(trackerJoin.attachment.pinVerified, true);
    assert.match(staleTab.closed?.reason || '', /Falscher PIN/, 'the stale wrong-PIN tab is dropped');

    const wrongJoin = freshSocket();
    joinCtx.sockets.push(wrongJoin);
    await joinRoom.webSocketMessage(wrongJoin, JSON.stringify({ type: 'join', syncId: 'pilot-7', pin: '9999', relayRole: 'viewer' }));
    assert.match(wrongJoin.closed?.reason || '', /Falscher PIN/, 'a wrong PIN cannot join even into an empty-looking room');

    const callsBefore = verifyCalls;
    const secondViewer = freshSocket();
    joinCtx.sockets.push(secondViewer);
    await joinRoom.webSocketMessage(secondViewer, JSON.stringify({ type: 'join', syncId: 'PILOT-7', pin: '4321', relayRole: 'viewer' }));
    assert.equal(secondViewer.closed, null);
    assert.equal(verifyCalls, callsBefore, 'a confirmed PIN is cached, reconnects do not ask again');

    // Without an account answer (no binding / no account) the previous rule stays.
    const noAccountRoom = await sha256Hex('SIM-ONLY');
    const first = new MockSocket(); first.serializeAttachment({ joined: false, roomKey: noAccountRoom, role: 'unknown', pinHash: '', lastTelemetryAt: 0 });
    const second = new MockSocket(); second.serializeAttachment({ joined: false, roomKey: noAccountRoom, role: 'unknown', pinHash: '', lastTelemetryAt: 0 });
    const fallbackRoom = new RelayRoom(new MockContext([first, second]), env);
    await fallbackRoom.webSocketMessage(first, JSON.stringify({ type: 'join', syncId: 'sim-only', pin: '1111', relayRole: 'tracker' }));
    await fallbackRoom.webSocketMessage(second, JSON.stringify({ type: 'join', syncId: 'sim-only', pin: '2222', relayRole: 'viewer' }));
    assert.equal(first.closed, null);
    assert.match(second.closed?.reason || '', /Falscher PIN/);

    const unboundRoom = new RelayRoom(new MockContext([]));
    assert.equal(await unboundRoom.checkPin('X', '1', 'h', ''), 'unavailable');
    console.log('relay PIN check on join ok');
}

// A message that arrives while the join PIN check is still running waits for the join
// instead of "Relay-Beitritt fehlt." (the app resends 300 ms after its join, 26.11.2026).
{
    let releaseVerify;
    const env = { GA_PROXY: { fetch: () => new Promise(resolve => { releaseVerify = () => resolve(new Response('{}', { status: 200 })); }) } };
    const room = await sha256Hex('SLOW-1');
    const viewer = new MockSocket();
    viewer.serializeAttachment({ joined: false, roomKey: room, role: 'unknown', pinHash: '', lastTelemetryAt: 0 });
    const slowRoom = new RelayRoom(new MockContext([viewer]), env);
    const join = slowRoom.webSocketMessage(viewer, JSON.stringify({ type: 'join', syncId: 'slow-1', pin: '1234', relayRole: 'viewer' }));
    const early = slowRoom.webSocketMessage(viewer, JSON.stringify({ type: 'gps', syncId: 'slow-1', trackerStatusOnly: true }));
    await new Promise(resolve => setTimeout(resolve, 10));
    assert.equal(viewer.closed, null, 'nothing is rejected while the join check runs');
    releaseVerify();
    await Promise.all([join, early]);
    assert.equal(viewer.closed, null, 'the early message is handled after the join');
    assert.equal(viewer.attachment.joined, true);

    const stranger = new MockSocket();
    stranger.serializeAttachment({ joined: false, roomKey: room, role: 'unknown', pinHash: '', lastTelemetryAt: 0 });
    await slowRoom.webSocketMessage(stranger, JSON.stringify({ type: 'gps', syncId: 'slow-1' }));
    assert.match(stranger.closed?.reason || '', /Relay-Beitritt fehlt/, 'without any join the rule stays');
    console.log('relay join queue ok');
}
