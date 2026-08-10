'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('./map-shell-core');

test('map layer catalog keeps stable unique ids and secure endpoints', () => {
  const layers = [...core.BASE_LAYERS, ...core.OVERLAY_LAYERS];
  assert.equal(new Set(layers.map((layer) => layer.id)).size, layers.length);
  for (const layer of layers) {
    assert.match(layer.id, /^[a-z][a-z0-9-]*$/);
    assert.match(layer.url, /^https:\/\//);
    if (layer.fallbackUrl) assert.match(layer.fallbackUrl, /^https:\/\//);
    assert.ok(layer.label);
  }
});

test('map preferences reject unknown layers and keep the Alpha default overlay', () => {
  assert.deepEqual(core.normalizePreferences(), {
    baseLayer: 'topo',
    overlays: ['aero'],
    follow: true
  });
  assert.deepEqual(core.normalizePreferences({
    baseLayer: 'missing',
    overlays: ['dfs', 'missing', 'dfs'],
    follow: false
  }), {
    baseLayer: 'topo',
    overlays: ['dfs'],
    follow: false
  });
});

test('aero overlay dims the base map like the web map table', () => {
  assert.equal(core.baseLayerOpacity({ overlays: ['aero'] }), 0.5);
  assert.equal(core.baseLayerOpacity({ overlays: ['dfs'] }), 1);
  assert.equal(core.baseLayerOpacity({ overlays: [] }), 1);
});

test('mission display keeps confirmed truth across short empty snapshot gaps', () => {
  const initialEmpty = core.advanceMissionDisplay({ available: false }, {}, 1000);
  assert.equal(initialEmpty.mode, 'pending');

  const confirmed = core.advanceMissionDisplay({
    available: true,
    missionId: 'mission-42',
    state: 'active',
    phase: 'prepare'
  }, initialEmpty, 2000);
  assert.equal(confirmed.mode, 'mission');
  assert.equal(confirmed.snapshot.missionId, 'mission-42');

  const transientGap = core.advanceMissionDisplay({ available: false }, confirmed, 6000);
  assert.equal(transientGap.mode, 'mission');
  assert.equal(transientGap.snapshot.missionId, 'mission-42');

  const expiredGap = core.advanceMissionDisplay({ available: false }, transientGap, 15001);
  assert.equal(expiredGap.mode, 'pending');
  const stableEmpty = core.advanceMissionDisplay({ available: false }, expiredGap, 18002);
  assert.equal(stableEmpty.mode, 'empty');
  assert.equal(stableEmpty.snapshot, null);
});

test('terminal mission snapshots replace active state immediately', () => {
  const active = core.advanceMissionDisplay({ available: true, missionId: 'mission-42', state: 'active' }, {}, 1000);
  const ended = core.advanceMissionDisplay({ available: true, missionId: 'mission-42', state: 'ended' }, active, 1100);
  assert.equal(ended.mode, 'mission');
  assert.equal(ended.snapshot.state, 'ended');
});

test('flight snapshots are range checked and normalized for the map renderer', () => {
  assert.equal(core.normalizeFlightSnapshot({ available: false }), null);
  assert.equal(core.normalizeFlightSnapshot({ available: true, lat: 91, lon: 8 }), null);
  assert.deepEqual(core.normalizeFlightSnapshot({
    available: true,
    capturedAt: 1234,
    lat: 48.27836,
    lon: 8.42969,
    alt: 2207.4,
    hdg: -5,
    flight: { gsKts: 12.6, iasKts: -1, onGround: true }
  }), {
    lat: 48.27836,
    lon: 8.42969,
    altFt: 2207,
    headingDeg: 355,
    gsKts: 13,
    iasKts: 0,
    onGround: true,
    capturedAt: 1234
  });
});

test('map flight labels remain deterministic', () => {
  const snapshot = core.normalizeFlightSnapshot({
    available: true,
    lat: 48.27836,
    lon: 8.42969,
    alt: 2207,
    hdg: 235,
    flight: { gsKts: 0, iasKts: 0, onGround: true }
  });
  assert.equal(core.formatCoordinateLine(snapshot), '48.27836, 8.42969 · 2207 ft · 235°');
  assert.equal(core.formatFlightLine(snapshot), 'GS 0 kt · IAS 0 kt · Am Boden');
});
