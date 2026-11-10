import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CrewLiveRoom, crewRoomKey, verifyCrewTicket, cleanCrewPosition } from './crew-live-room.js';
import { signCrewLiveTicket } from '../cloudflare-worker/crew-presence.mjs';

const SECRET = 's'.repeat(40);

class MockSocket {
    constructor() { this.attachment = {}; this.messages = []; this.closed = null; }
    serializeAttachment(value) { this.attachment = structuredClone(value); }
    deserializeAttachment() { return structuredClone(this.attachment); }
    send(value) { this.messages.push(JSON.parse(String(value))); }
    close(code, reason) { this.closed = { code, reason }; }
}
class MockContext {
    constructor() { this.sockets = []; }
    getWebSockets() { return this.sockets; }
}

async function setup(crew = 'EDTW') {
    const ctx = new MockContext();
    const room = new CrewLiveRoom(ctx, { CREW_LIVE_SECRET: SECRET });
    const roomKey = await crewRoomKey(crew);
    async function connect(pid, role, ticketCrew = crew, secret = SECRET) {
        const socket = new MockSocket();
        socket.serializeAttachment({ joined: false, roomKey, role: 'unknown', pid: '', nick: '', lastPosAt: 0 });
        ctx.sockets.push(socket);
        const ticket = await signCrewLiveTicket(secret, { v: 1, crew: ticketCrew, pid, nick: pid + '-nick', exp: Date.now() + 60000 });
        await room.webSocketMessage(socket, JSON.stringify({ type: 'crew_join', ticket, role, clientId: pid + role }));
        return socket;
    }
    return { ctx, room, connect };
}
const last = (socket, type) => socket.messages.filter(m => m.type === type).pop();

test('ticket from ga-proxy verifies; wrong secret, other crew and expiry are refused', async () => {
    const ticket = await signCrewLiveTicket(SECRET, { v: 1, crew: 'EDTW', pid: 'ALICE', nick: 'Ali', exp: Date.now() + 1000 });
    assert.equal((await verifyCrewTicket(SECRET, ticket)).pid, 'ALICE');
    assert.equal(await verifyCrewTicket('t'.repeat(40), ticket), null);
    assert.equal(await verifyCrewTicket(SECRET, ticket, Date.now() + 5000), null, 'expired');
    assert.equal(await verifyCrewTicket(SECRET, ticket.slice(0, -2) + 'AA'), null, 'tampered signature');
    const s = await setup('EDTW');
    const other = await s.connect('EVE', 'tracker', 'EDFE');
    assert.ok(other.closed, 'ticket for another crew cannot join this room');
    const forged = await s.connect('MALLORY', 'tracker', 'EDTW', 'm'.repeat(40));
    assert.ok(forged.closed, 'forged ticket refused');
});

test('positions go to the others with identity from the ticket, throttled, viewers cannot send', async () => {
    const s = await setup();
    const alice = await s.connect('ALICE', 'tracker');
    const bob = await s.connect('BOB', 'tracker');
    const viewer = await s.connect('CARL', 'viewer');
    assert.deepEqual(last(viewer, 'crew_audience').members.map(m => m.pid + ':' + m.role).sort(), ['alice:tracker', 'bob:tracker', 'carl:viewer']);
    await s.room.webSocketMessage(alice, JSON.stringify({ type: 'crew_pos', pid: 'bob', nick: 'fake', p: { lat: 47.3, lon: 12.8, alt: 5000, hdg: 270, gs: 120, cs: 'D-EABC', k: 'single', evil: '<x>' } }));
    const got = last(bob, 'crew_pos');
    assert.equal(got.pid, 'alice'); assert.equal(got.nick, 'ALICE-nick');
    assert.deepEqual(got.p, { lat: 47.3, lon: 12.8, alt: 5000, hdg: 270, gs: 120, cs: 'D-EABC', k: 'single' });
    assert.equal(alice.messages.filter(m => m.type === 'crew_pos').length, 0, 'not echoed to the sender');
    await s.room.webSocketMessage(alice, JSON.stringify({ type: 'crew_pos', p: { lat: 47.31, lon: 12.8 } }));
    assert.equal(bob.messages.filter(m => m.type === 'crew_pos').length, 1, 'second packet inside 800 ms dropped');
    await s.room.webSocketMessage(viewer, JSON.stringify({ type: 'crew_pos', p: { lat: 1, lon: 1 } }));
    assert.equal(bob.messages.filter(m => m.type === 'crew_pos').length, 1, 'viewers do not send positions');
    s.room.webSocketClose(alice);
    s.ctx.sockets = s.ctx.sockets.filter(x => x !== alice);
    assert.equal(last(bob, 'crew_gone').pid, 'alice');
    assert.deepEqual(last(viewer, 'crew_audience').members.map(m => m.pid).sort(), ['bob', 'carl']);
});

test('unjoined sockets and oversize messages are closed; invalid positions are dropped', async () => {
    const s = await setup();
    const loose = new MockSocket(); loose.serializeAttachment({ joined: false, roomKey: 'x' }); s.ctx.sockets.push(loose);
    await s.room.webSocketMessage(loose, JSON.stringify({ type: 'crew_pos', p: { lat: 1, lon: 1 } }));
    assert.ok(loose.closed);
    const alice = await s.connect('ALICE', 'tracker');
    await s.room.webSocketMessage(alice, 'x'.repeat(5000));
    assert.ok(alice.closed);
    assert.equal(cleanCrewPosition({ lat: 0, lon: 0 }), null);
    assert.equal(cleanCrewPosition({ lat: 95, lon: 1 }), null);
    assert.deepEqual(cleanCrewPosition({ lat: 1, lon: 2, alt: 'x', gnd: true, ic: 'heli' }), { lat: 1, lon: 2, gnd: 1, ic: 'heli' });
});
