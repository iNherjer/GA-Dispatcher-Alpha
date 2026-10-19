'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createFavoriteAirports } = require('./tracker-favorite-airports');
const core = require('../cloud-sync-core');
const { createTrackerEfbHttpServer, createTrackerEfbHttpHello } = require('./tracker-efb-http-server');

const EDDS = { code: 'EDDS', displayCode: 'EDDS', name: 'Stuttgart Airport', lat: 48.6899, lon: 9.22196, apt: { icao: 'EDDS' } };

// Minimal Sync-v2 head/chunk responder backed by a packed profile.
async function fakeCloud(profile) {
  const packed = profile ? await core.pack(profile) : null;
  let reads = 0;
  const request = async url => {
    reads++;
    if (url.includes('/head')) return { ok: true, status: 200, json: async () => (packed ? { revision: 3, manifest: packed.manifest } : { revision: 0, manifest: null }) };
    const chunk = url.match(/chunk\/([a-f0-9]{64})/);
    if (chunk) return { ok: true, status: 200, json: async () => ({ data: packed.chunks[chunk[1]] }) };
    if (url.includes('/api/sync/')) return { ok: true, status: 200, json: async () => ({ favoriteAirports: [EDDS] }) };
    return { ok: false, status: 404, json: async () => ({}) };
  };
  return { request, reads: () => reads };
}

test('reads only the favorites field and strips cached airport records', async () => {
  const cloud = await fakeCloud({ activeMission: null, activeMissionTrackerSeed: null, favoriteAirports: [EDDS, { code: 'BAD' }] });
  let clock = 1000;
  const favorites = createFavoriteAirports({ pilotId: 'Pilot', pin: '1234', request: cloud.request, now: () => clock });
  const state = await favorites.refresh();
  assert.equal(state.available, true);
  assert.deepEqual(state.airports, [{ code: 'EDDS', displayCode: 'EDDS', name: 'Stuttgart Airport', lat: 48.6899, lon: 9.22196 }]);
  const before = cloud.reads();
  clock += 1000;
  await favorites.refresh();
  assert.equal(cloud.reads(), before, 'refresh is throttled');
});

test('falls back to the legacy profile and keeps stars while offline', async () => {
  const cloud = await fakeCloud(null);
  let fail = false, clock = 0;
  const favorites = createFavoriteAirports({ pilotId: 'Pilot', pin: '1234', now: () => clock, request: async (url, init) => {
    if (fail) throw new Error('offline');
    return cloud.request(url, init);
  } });
  assert.equal((await favorites.refresh()).airports[0].code, 'EDDS');
  fail = true; clock += 60000;
  assert.equal((await favorites.refresh()).airports[0].code, 'EDDS');
});

test('without credentials the endpoint stays empty instead of inventing data', async (t) => {
  const favorites = createFavoriteAirports({});
  const hello = createTrackerEfbHttpHello({ trackerVersion: 'v567', trackerVersionCode: 567 });
  const server = createTrackerEfbHttpServer({ host: '127.0.0.1', port: 0, hello, favoriteAirports: favorites });
  t.after(() => server.stop());
  const address = await server.start();
  const base = `http://127.0.0.1:${address.port}`;
  const response = await fetch(base + '/api/v1/favorite-airports');
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { airports: [], available: false });
  assert.equal((await fetch(base + '/api/v1/favorite-airports', { method: 'POST', body: '{}' })).status, 405);
  assert.equal((await fetch(base + '/api/v1/favorite-airports', { headers: { Origin: 'https://example.com' } })).status, 403);
});

test('EFB star script is served and packaged into the Tracker EXE', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const { getTrackerEfbWebClientAsset, createTrackerEfbWebClientPage } = require('./tracker-efb-web-client');
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
  assert.ok(pkg.pkg.assets.includes('efb-web-assets/map-favorite-airports.js'));
  assert.match(String(getTrackerEfbWebClientAsset('/efb/v1/assets/map-favorite-airports.js').body), /GAFavoriteAirportsCore/);
  assert.match(createTrackerEfbWebClientPage(), /map-favorite-airports\.js\?v=/);
});
