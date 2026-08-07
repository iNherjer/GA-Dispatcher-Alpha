const assert = require('node:assert/strict');
const http = require('node:http');
const test = require('node:test');
const {
  TRACKER_EFB_HTTP_CAPABILITIES,
  createTrackerEfbHttpHello,
  createTrackerEfbHttpServer
} = require('./tracker-efb-http-server');

function request(address, pathname, method = 'GET') {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port: address.port, path: pathname, method }, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => resolve({
        statusCode: response.statusCode,
        headers: response.headers,
        body: Buffer.concat(chunks).toString('utf8')
      }));
    });
    req.on('error', reject);
    req.end();
  });
}

test('local EFB hello advertises only implemented read-only capabilities', () => {
  const hello = createTrackerEfbHttpHello({
    trackerVersion: 'v324',
    trackerVersionCode: 324,
    runtimeChannel: 'alpha',
    id: 'hello-test',
    timestamp: 1
  });
  assert.deepEqual(hello.payload.capabilities, TRACKER_EFB_HTTP_CAPABILITIES);
  assert.equal(hello.payload.transport, 'http-loopback-readonly');
  assert.equal(hello.payload.runtimeChannel, 'alpha');
});

test('loopback EFB server exposes versioned status, flight and mission snapshots read-only', async (t) => {
  const hello = createTrackerEfbHttpHello({
    trackerVersion: 'v324',
    trackerVersionCode: 324,
    runtimeChannel: 'alpha',
    id: 'hello-server-test',
    timestamp: 1
  });
  const server = createTrackerEfbHttpServer({
    host: '127.0.0.1',
    port: 0,
    hello,
    getStatus: () => ({ relayConnected: true, simulatorConnected: true }),
    getSnapshot: () => ({ capturedAt: 2, lat: 48.1, lon: 11.5, alt: 2500, hdg: 90 }),
    getMissionSnapshot: () => ({
      version: 1,
      missionId: 'mission-42',
      state: 'active',
      active: true,
      phase: 'active',
      title: 'Testflug',
      route: { start: 'EDDS', destination: 'EDTF', target: '' },
      cargo: { total: 2, required: 2, loaded: 2, unloaded: 0, pending: 0 }
    })
  });
  t.after(() => server.stop());
  const address = await server.start();

  const status = await request(address, '/api/v1/status');
  assert.equal(status.statusCode, 200);
  assert.equal(status.headers['access-control-allow-origin'], '*');
  const statusBody = JSON.parse(status.body);
  assert.equal(statusBody.message.type, 'tracker.status');
  assert.equal(statusBody.message.payload.relayConnected, true);
  assert.equal(statusBody.hello.payload.trackerVersionCode, 324);

  const snapshot = JSON.parse((await request(address, '/api/v1/snapshot')).body);
  assert.equal(snapshot.message.type, 'flight.snapshot');
  assert.equal(snapshot.message.payload.available, true);
  assert.equal(snapshot.message.payload.lat, 48.1);

  const mission = JSON.parse((await request(address, '/api/v1/mission')).body);
  assert.equal(mission.message.type, 'mission.snapshot');
  assert.equal(mission.message.payload.available, true);
  assert.equal(mission.message.payload.missionId, 'mission-42');
  assert.equal(mission.message.payload.route.destination, 'EDTF');

  assert.equal((await request(address, '/api/v1/status', 'POST')).statusCode, 405);
  assert.equal((await request(address, '/unknown')).statusCode, 404);
});

test('mission endpoint reports an unavailable snapshot without inventing mission state', async (t) => {
  const hello = createTrackerEfbHttpHello({ trackerVersion: 'v324', trackerVersionCode: 324 });
  const server = createTrackerEfbHttpServer({ host: '127.0.0.1', port: 0, hello });
  t.after(() => server.stop());
  const address = await server.start();
  const mission = JSON.parse((await request(address, '/api/v1/mission')).body);
  assert.deepEqual(mission.message.payload, { available: false });
});

test('EFB HTTP server rejects non-loopback bind addresses', () => {
  const hello = createTrackerEfbHttpHello({ trackerVersion: 'v324', trackerVersionCode: 324 });
  assert.throws(() => createTrackerEfbHttpServer({ host: '0.0.0.0', hello }), /Loopback/);
});
