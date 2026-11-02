const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { createCrewFleetWatch, NOTICE_MS } = require('./tracker-crew-fleet-watch.js');

const KEY = 'tail:DEINA|A2A Piper PA-24-250 Comanche';
const record = (extra = {}) => ({ key: KEY, pos: { tail: 'DEINA', title: 'A2A Piper PA-24-250 Comanche', lat: 48.27, lon: 8.43 }, lastPilotId: 'ALICE', lastNick: 'Ali', ...extra });

function setup({ crew = { groupName: 'EDTW', fleetShow: true } } = {}) {
  let t = 1_000_000;
  const sockets = [];
  const calls = [];
  const server = { rev: 1, records: [record()] };
  class FakeSocket extends EventEmitter {
    constructor(url, options) { super(); this.url = url; this.options = options; this.sent = []; sockets.push(this); }
    send(message) { this.sent.push(message); }
    close() { this.emit('close'); }
  }
  const watch = createCrewFleetWatch({
    pilotId: 'ALICE', pin: '1234', WebSocket: FakeSocket, now: () => t,
    getCrew: () => crew,
    request: async (url) => {
      calls.push(url);
      const since = Number(new URL(url).searchParams.get('since'));
      const data = since === server.rev ? { ok: true, rev: server.rev, unchanged: true }
        : { ok: true, rev: server.rev, full: since === 0, records: server.records };
      return { ok: true, status: 200, json: async () => data };
    }
  });
  return { watch, sockets, calls, server, crew, advance: ms => { t += ms; } };
}

test('first load is silent; a change by another pilot shows a notice for 30 s', async () => {
  const s = setup();
  s.watch.tick();
  assert.equal(s.sockets.length, 1);
  assert.match(s.sockets[0].url, /^wss:\/\/.*crew-fleet-v1\/EDTW\/ws$/);
  assert.equal(s.sockets[0].options.headers['X-Pilot-ID'], 'ALICE');
  s.sockets[0].emit('open');
  await s.watch.load();
  assert.equal(s.watch.notice(), null, 'the first load is not a change');
  s.server.rev = 2;
  s.server.records = [record({ lock: { state: 'flying', pilotId: 'BOB', nick: 'Bob', since: 1_000_000 } })];
  s.sockets[0].emit('message', JSON.stringify({ type: 'fleet', rev: 2 }));
  await s.watch.load();
  const notice = s.watch.notice();
  assert.equal(notice.text, 'Vereinsflotte geändert: DEINA in der Luft (Bob). Bitte aktualisieren.');
  s.advance(NOTICE_MS + 1);
  assert.equal(s.watch.notice(), null);
});

test('own changes and pongs do not show a notice', async () => {
  const s = setup();
  s.watch.tick();
  s.sockets[0].emit('open');
  await s.watch.load();
  s.server.rev = 2;
  s.server.records = [record({ lock: { state: 'reserved', pilotId: 'alice', nick: 'Ali', since: 1_000_000 } })];
  s.sockets[0].emit('message', 'pong');
  s.sockets[0].emit('message', JSON.stringify({ type: 'fleet', rev: 2 }));
  await s.watch.load();
  assert.equal(s.watch.notice(), null);
});

test('no crew or crew fleet switched off: no connection; closing reconnects later', async () => {
  const off = setup({ crew: { groupName: 'EDTW', fleetShow: false } });
  off.watch.tick();
  assert.equal(off.sockets.length, 0);
  const s = setup();
  s.watch.tick();
  s.sockets[0].emit('close');
  s.watch.tick();
  assert.equal(s.sockets.length, 1, 'waits before reconnecting');
  s.advance(31 * 1000);
  s.watch.tick();
  assert.equal(s.sockets.length, 2);
});
