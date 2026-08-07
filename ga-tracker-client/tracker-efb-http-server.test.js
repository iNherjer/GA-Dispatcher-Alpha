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
    trackerVersion: 'v323',
    trackerVersionCode: 323,
    runtimeChannel: 'alpha',
    id: 'hello-test',
    timestamp: 1
  });
  assert.deepEqual(hello.payload.capabilities, TRACKER_EFB_HTTP_CAPABILITIES);
  assert.equal(hello.payload.transport, 'http-loopback-readonly');
  assert.equal(hello.payload.runtimeChannel, 'alpha');
});

test('loopback EFB server exposes versioned status and flight snapshots read-only', async (t) => {
  const hello = createTrackerEfbHttpHello({
    trackerVersion: 'v323',
    trackerVersionCode: 323,
    runtimeChannel: 'alpha',
    id: 'hello-server-test',
    timestamp: 1
  });
  const server = createTrackerEfbHttpServer({
    host: '127.0.0.1',
    port: 0,
    hello,
    getStatus: () => ({ relayConnected: true, simulatorConnected: true }),
    getSnapshot: () => ({ capturedAt: 2, lat: 48.1, lon: 11.5, alt: 2500, hdg: 90 })
  });
  t.after(() => server.stop());
  const address = await server.start();

  const status = await request(address, '/api/v1/status');
  assert.equal(status.statusCode, 200);
  assert.equal(status.headers['access-control-allow-origin'], '*');
  const statusBody = JSON.parse(status.body);
  assert.equal(statusBody.message.type, 'tracker.status');
  assert.equal(statusBody.message.payload.relayConnected, true);
  assert.equal(statusBody.hello.payload.trackerVersionCode, 323);

  const snapshot = JSON.parse((await request(address, '/api/v1/snapshot')).body);
  assert.equal(snapshot.message.type, 'flight.snapshot');
  assert.equal(snapshot.message.payload.available, true);
  assert.equal(snapshot.message.payload.lat, 48.1);

  assert.equal((await request(address, '/api/v1/status', 'POST')).statusCode, 405);
  assert.equal((await request(address, '/unknown')).statusCode, 404);
});

test('EFB HTTP server rejects non-loopback bind addresses', () => {
  const hello = createTrackerEfbHttpHello({ trackerVersion: 'v323', trackerVersionCode: 323 });
  assert.throws(() => createTrackerEfbHttpServer({ host: '0.0.0.0', hello }), /Loopback/);
});
