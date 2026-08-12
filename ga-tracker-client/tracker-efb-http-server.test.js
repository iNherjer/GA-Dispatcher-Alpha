const assert = require('node:assert/strict');
const http = require('node:http');
const test = require('node:test');
const {
  MAX_EFB_CLIENT_LOG_BYTES,
  TRACKER_EFB_HTTP_CAPABILITIES,
  createTrackerEfbHttpHello,
  createTrackerEfbHttpServer
} = require('./tracker-efb-http-server');

function request(address, pathname, options = {}) {
  if (typeof options === 'string') options = { method: options };
  return new Promise((resolve, reject) => {
    const req = http.request({
      host: '127.0.0.1',
      port: address.port,
      path: pathname,
      method: options.method || 'GET',
      headers: options.headers || {}
    }, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => resolve({
        statusCode: response.statusCode,
        headers: response.headers,
        rawBody: Buffer.concat(chunks),
        body: Buffer.concat(chunks).toString('utf8')
      }));
    });
    req.on('error', reject);
    req.end(options.body || undefined);
  });
}

test('local EFB hello advertises snapshots, web client and bounded client diagnostics', () => {
  const hello = createTrackerEfbHttpHello({
    trackerVersion: 'v330',
    trackerVersionCode: 330,
    runtimeChannel: 'alpha',
    id: 'hello-test',
    timestamp: 1
  });
  assert.deepEqual(hello.payload.capabilities, TRACKER_EFB_HTTP_CAPABILITIES);
  assert.equal(hello.payload.transport, 'http-loopback-readonly');
  assert.equal(hello.payload.runtimeChannel, 'alpha');
  assert.equal(hello.payload.capabilities.includes('efb.web-client.v1'), true);
  assert.equal(hello.payload.capabilities.includes('efb.client-diagnostics.v1'), true);
});

test('loopback EFB server exposes versioned status, flight and mission snapshots read-only', async (t) => {
  const hello = createTrackerEfbHttpHello({
    trackerVersion: 'v324',
    trackerVersionCode: 324,
    runtimeChannel: 'alpha',
    id: 'hello-server-test',
    timestamp: 1
  });
  const logs = [];
  const server = createTrackerEfbHttpServer({
    host: '127.0.0.1',
    port: 0,
    hello,
    getStatus: () => ({ relayConnected: true, simulatorConnected: true }),
    getSnapshot: () => ({ capturedAt: 2, lat: 48.1, lon: 11.5, alt: 2500, hdg: 90 }),
    getMapSnapshot: () => ({
      schema: 'ga.map-snapshot.v1',
      version: 1,
      missionId: 'mission-42',
      route: { waypoints: [{ lat: 48.1, lon: 11.5 }, { lat: 48.2, lon: 11.6 }] }
    }),
    getMissionSnapshot: () => ({
      version: 1,
      missionId: 'mission-42',
      state: 'active',
      active: true,
      phase: 'active',
      title: 'Testflug',
      route: { start: 'EDDS', destination: 'EDTF', target: '' },
      cargo: { total: 2, required: 2, loaded: 2, unloaded: 0, pending: 0 }
    }),
    log: (line) => logs.push(line)
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

  const map = JSON.parse((await request(address, '/api/v1/map')).body);
  assert.equal(map.message.type, 'map.snapshot');
  assert.equal(map.message.payload.available, true);
  assert.equal(map.message.payload.schema, 'ga.map-snapshot.v1');
  assert.equal(map.message.payload.route.waypoints.length, 2);

  const webClient = await request(address, '/efb/v1/');
  assert.equal(webClient.statusCode, 200);
  assert.match(webClient.headers['content-type'], /^text\/html/);
  assert.match(webClient.body, /data-efb-view-version="4"/);
  assert.match(webClient.body, /id="mapTableOverlay"/);

  const hostScript = await request(address, '/efb/v1/assets/host.js');
  assert.equal(hostScript.statusCode, 200);
  assert.match(hostScript.headers['content-type'], /^text\/javascript/);
  assert.match(hostScript.body, /ga-efb-kartentisch/);

  const e6b = await request(address, '/efb/v1/e6b/e6b-flight-computer.html');
  assert.equal(e6b.statusCode, 200);
  assert.match(e6b.body, /E6B Flight Computer/);

  const clientLog = await request(address, '/api/v1/client-log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      level: 'error',
      event: 'host-init',
      stage: 'leaflet',
      sessionId: 'test-session',
      channel: 'test-channel',
      message: 'Zeile 1\nZeile 2',
      details: { reason: 'test' }
    })
  });
  assert.equal(clientLog.statusCode, 204);
  assert.equal(logs.some((line) => line.includes('EFB_CLIENT level=error event=host-init stage=leaflet')), true);
  assert.equal(logs.some((line) => line.includes('Zeile 1 Zeile 2')), true);
  assert.equal(logs.some((line) => line.includes('EFB_HTTP_PAGE')), true);
  assert.equal(logs.some((line) => line.includes('EFB_HTTP_ASSET path=/efb/v1/assets/host.js')), true);

  assert.equal((await request(address, '/api/v1/client-log', {
    method: 'POST', body: '{ungueltig'
  })).statusCode, 400);
  assert.equal((await request(address, '/api/v1/client-log', {
    method: 'POST', body: 'x'.repeat(MAX_EFB_CLIENT_LOG_BYTES + 1)
  })).statusCode, 413);

  const traversal = await request(address, '/efb/v1/e6b/%2e%2e/index.html');
  assert.equal(traversal.statusCode, 404);

  assert.equal((await request(address, '/api/v1/status', 'POST')).statusCode, 405);
  assert.equal((await request(address, '/unknown')).statusCode, 404);
});

test('map endpoint reports an unavailable snapshot without inventing route data', async (t) => {
  const hello = createTrackerEfbHttpHello({ trackerVersion: 'v326', trackerVersionCode: 326 });
  const server = createTrackerEfbHttpServer({ host: '127.0.0.1', port: 0, hello });
  t.after(() => server.stop());
  const address = await server.start();
  const map = JSON.parse((await request(address, '/api/v1/map')).body);
  assert.deepEqual(map.message.payload, { available: false });
});

test('mission endpoint reports an unavailable snapshot without inventing mission state', async (t) => {
  const hello = createTrackerEfbHttpHello({ trackerVersion: 'v324', trackerVersionCode: 324 });
  const server = createTrackerEfbHttpServer({ host: '127.0.0.1', port: 0, hello });
  t.after(() => server.stop());
  const address = await server.start();
  const mission = JSON.parse((await request(address, '/api/v1/mission')).body);
  assert.deepEqual(mission.message.payload, { available: false });
});

test('map tiles are fetched once through the bounded loopback proxy and then cached', async (t) => {
  const hello = createTrackerEfbHttpHello({ trackerVersion: 'v333', trackerVersionCode: 333 });
  const logs = [];
  const requests = [];
  const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const server = createTrackerEfbHttpServer({
    host: '127.0.0.1',
    port: 0,
    hello,
    fetchRemote: async (url) => {
      requests.push(url);
      return {
        ok: true,
        status: 200,
        headers: { get: () => 'image/png' },
        arrayBuffer: async () => png
      };
    },
    log: (line) => logs.push(line)
  });
  t.after(() => server.stop());
  const address = await server.start();
  const first = await request(address, '/api/v1/map-tile/topo/8/133/88.png');
  const second = await request(address, '/api/v1/map-tile/topo/8/133/88.png');
  assert.equal(first.statusCode, 200);
  assert.equal(first.headers['content-type'], 'image/png');
  assert.equal(first.headers['x-efb-tile-cache'], 'miss');
  assert.equal(second.headers['x-efb-tile-cache'], 'hit');
  assert.deepEqual(first.rawBody, png);
  assert.equal(requests.length, 1);
  assert.match(requests[0], /^https:\/\/[abc]\.tile\.opentopomap\.org\/8\/133\/88\.png$/);
  assert.equal(logs.some((line) => line.includes('EFB_TILE_PROXY_READY layer=topo')), true);
  assert.equal((await request(address, '/api/v1/map-tile/unknown/8/133/88.png')).statusCode, 404);
});

test('EFB HTTP server rejects non-loopback bind addresses', () => {
  const hello = createTrackerEfbHttpHello({ trackerVersion: 'v324', trackerVersionCode: 324 });
  assert.throws(() => createTrackerEfbHttpServer({ host: '0.0.0.0', hello }), /Loopback/);
});
