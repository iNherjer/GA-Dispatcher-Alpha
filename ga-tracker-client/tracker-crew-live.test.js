'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { createCrewLive, crewRoomKey, extrapolate, FAST_MS, SLOW_MS } = require('./tracker-crew-live');

function ticketFor(pid, crew = 'EDTW') {
  const body = Buffer.from(JSON.stringify({ v: 1, crew, pid, nick: pid, exp: Date.now() + 3600000 })).toString('base64url');
  return `${body}.sig`;
}

function harness({ crew = 'EDTW', share = true } = {}) {
  let t = 1000;
  const sockets = [], requests = [];
  class FakeSocket extends EventEmitter {
    constructor(url) { super(); this.url = url; this.sent = []; sockets.push(this); }
    send(raw) { this.sent.push(JSON.parse(raw)); }
    close() { this.closed = true; }
  }
  const state = { crew, share };
  const live = createCrewLive({
    pilotId: 'Alice', pin: '1', WebSocketImpl: FakeSocket, now: () => t,
    getCrew: () => state.crew, getShareFlight: () => state.share,
    request: async (url, init) => { requests.push({ url, init }); return { ok: true, status: 200, json: async () => ({ ticket: ticketFor('alice', state.crew), exp: Date.now() + 3600000 }) }; }
  });
  const flush = () => new Promise(resolve => setImmediate(resolve));
  const relay = (socket, data) => socket.emit('message', JSON.stringify(data));
  return { live, sockets, requests, state, flush, relay, advance: ms => { t += ms; }, now: () => t };
}
const own = { lat: 47.3, lon: 12.8, altFt: 5000, hdg: 270, gsKts: 120, vsFpm: 0, onGround: false, callsign: 'D-EABC', iconKind: 'single' };

test('joins the crew room with a ticket and sends only at the rate the audience needs', async () => {
  const h = harness();
  h.live.maintain(); await h.flush();
  assert.equal(h.requests[0].url, 'https://ga-proxy.einherjer.workers.dev/api/crew-presence-v1/EDTW/live-ticket');
  assert.equal(h.requests[0].init.headers['X-Pilot-ID'], 'Alice');
  const ws = h.sockets[0];
  assert.equal(ws.url, `wss://ga-relay.einherjer.workers.dev/crew?room=${crewRoomKey('EDTW')}`);
  ws.emit('open');
  assert.equal(ws.sent[0].type, 'crew_join'); assert.equal(ws.sent[0].role, 'tracker');
  h.relay(ws, { type: 'crew_joined' });
  h.relay(ws, { type: 'crew_audience', members: [{ pid: 'alice', role: 'tracker' }, { pid: 'alice', role: 'viewer' }] });
  h.live.observe(own);
  assert.equal(ws.sent.filter(m => m.type === 'crew_pos').length, 0, 'nobody else listens: nothing sent');
  h.relay(ws, { type: 'crew_audience', members: [{ pid: 'alice', role: 'tracker' }, { pid: 'carl', role: 'viewer' }] });
  h.live.observe(own); h.advance(SLOW_MS - 100); h.live.observe(own);
  assert.equal(ws.sent.filter(m => m.type === 'crew_pos').length, 1, 'viewers only: every 5 s');
  h.relay(ws, { type: 'crew_audience', members: [{ pid: 'alice', role: 'tracker' }, { pid: 'bob', role: 'tracker' }] });
  h.advance(FAST_MS); h.live.observe(own);
  const pos = ws.sent.filter(m => m.type === 'crew_pos');
  assert.equal(pos.length, 2, 'another crew tracker: every 2 s');
  assert.deepEqual(pos[1].p, { lat: 47.3, lon: 12.8, alt: 5000, hdg: 270, gs: 120, vs: 0, cs: 'D-EABC', ic: 'single', k: 'single' });
  h.state.share = false; h.live.observe(own);
  assert.equal(ws.sent.at(-1).type, 'crew_off', 'sharing switched off: stop and say so');
});

test('received crew aircraft become traffic contacts, extrapolated and dropped after 15 s', async () => {
  const h = harness();
  h.live.maintain(); await h.flush();
  const ws = h.sockets[0]; ws.emit('open'); h.relay(ws, { type: 'crew_joined' });
  h.relay(ws, { type: 'crew_pos', pid: 'bob', nick: 'Bob', p: { lat: 47.3, lon: 12.8, alt: 5000, hdg: 0, gs: 120, cs: 'D-HGSR', k: 'heli', ic: 'heli' } });
  h.relay(ws, { type: 'crew_pos', pid: 'alice', nick: 'me', p: { lat: 1, lon: 1 } });
  const list = h.live.contacts(h.now() + 10000);
  assert.equal(list.length, 1, 'own position is never a contact');
  assert.equal(list[0].id, 'crew:bob'); assert.equal(list[0].crew, 1); assert.equal(list[0].cs, 'D-HGSR'); assert.equal(list[0].k, 'heli');
  assert.ok(Math.abs(list[0].lat - (47.3 + (1 / 3) / 60)) < 1e-4, '10 s at 120 kt north is 1/3 NM (extrapolation is capped at 10 s)');
  h.relay(ws, { type: 'crew_gone', pid: 'bob' });
  assert.equal(h.live.contacts().length, 0);
  h.relay(ws, { type: 'crew_pos', pid: 'bob', nick: 'Bob', p: { lat: 47.3, lon: 12.8 } });
  h.advance(16000);
  assert.equal(h.live.contacts().length, 0, 'stale contacts disappear');
});

test('crew change reconnects to the new room; closed socket retries with backoff', async () => {
  const h = harness();
  h.live.maintain(); await h.flush();
  h.state.crew = 'EDFE'; h.live.maintain(); await h.flush();
  assert.equal(h.sockets[0].closed, true);
  assert.equal(h.sockets[1].url.endsWith(crewRoomKey('EDFE')), true);
  h.sockets[1].emit('close');
  h.live.maintain(); await h.flush();
  assert.equal(h.sockets.length, 2, 'no immediate reconnect');
  h.advance(6000); h.live.maintain(); await h.flush();
  assert.equal(h.sockets.length, 3, 'reconnects after the backoff');
  assert.equal(extrapolate({ lat: 1, lon: 1, gnd: 1, gs: 50, hdg: 90 }, 10000).lon, 1, 'ground contacts are not moved');
});
