'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('./map-shell-core');

test('map layer catalog keeps stable unique ids and secure endpoints', () => {
  const layers = [...core.BASE_LAYERS, ...core.REGIONAL_BASE_LAYERS, ...core.OVERLAY_LAYERS];
  assert.equal(new Set(layers.map((layer) => layer.id)).size, layers.length);
  for (const layer of layers) {
    assert.match(layer.id, /^[a-z][a-z0-9-]*$/);
    // Desktop-rendered maps exist only behind the tracker (no remote source).
    if (layer.desktopRender === true) {
      assert.equal(layer.proxyOnly, true);
      assert.equal(layer.url, layer.localUrl);
    } else assert.match(layer.url, /^https:\/\//);
    if (layer.fallbackUrl) assert.match(layer.fallbackUrl, /^https:\/\//);
    if (layer.localUrl) assert.match(layer.localUrl, /^\/api\/v1\/map-tile\/[a-z][a-z0-9-]*\/\{z\}\/\{x\}\/\{y\}\.png$/);
    assert.ok(layer.label);
  }
});

test('map preferences reject unknown layers and keep the Alpha default overlay', () => {
  assert.deepEqual(core.normalizePreferences(), {
    baseLayer: 'topo',
    overlays: ['aero'],
    regionalBases: [],
    baseDimPercent: 50,
    tileCache: true,
    vectorStyle: { ...core.VECTOR_STYLE_DEFAULTS },
    follow: true,
    theme: 'classic',
    toolbarCollapsed: false,
    profileVisible: true
  });
  assert.deepEqual(core.normalizePreferences({
    baseLayer: 'missing',
    overlays: ['dfs', 'missing', 'dfs'],
    follow: false
  }), {
    baseLayer: 'topo',
    overlays: ['dfs'],
    regionalBases: [],
    baseDimPercent: 50,
    tileCache: true,
    vectorStyle: { ...core.VECTOR_STYLE_DEFAULTS },
    follow: false,
    theme: 'classic',
    toolbarCollapsed: false,
    profileVisible: true
  });
});

test('EFB preferences always use the single Modern design and preserve chrome visibility', () => {
  assert.deepEqual(core.THEMES, [{ id: 'classic', label: 'Modern' }]);
  const preferences = core.normalizePreferences({
    theme: 'ops1940',
    toolbarCollapsed: true,
    profileVisible: false
  });
  assert.equal(preferences.theme, 'classic');
  assert.equal(preferences.toolbarCollapsed, true);
  assert.equal(preferences.profileVisible, false);
  assert.equal(core.normalizePreferences({ theme: 'unknown' }).theme, 'classic');
});

test('aero overlay subdues the basemap like the original Kartentisch', () => {
  assert.equal(core.baseLayerOpacity({ overlays: ['aero'] }), 0.5);
  assert.equal(core.OVERLAY_LAYERS.find((layer) => layer.id === 'aero')?.options?.opacity, 0.65);
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
    gsKts: 12.6,
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
  assert.equal(core.formatCoordinateLine(snapshot), '48.27836, 8.42969 | 2207 ft | 235 deg');
  assert.equal(core.formatFlightLine(snapshot), 'GS 0 kt | IAS 0 kt | Am Boden');
});

test('versioned map snapshots are bounded before entering the renderer', () => {
  const snapshot = core.normalizeTrackerMapSnapshot({
    schema: 'ga.map-snapshot.v1',
    version: 1,
    missionId: 'mission-42',
    runId: 'run-42',
    revision: 7,
    route: {
      totalDistanceNm: 20,
      waypoints: [
        { id: 'a', name: 'EDTW', lat: 48.279, lon: 8.428, elevationFt: 2201 },
        { id: 'b', name: 'Target', lat: 48.4, lon: 8.7 }
      ]
    },
    navigation: { activeLegIndex: 0, bearingToNextDeg: -5, progress: 0.25 },
    profile: {
      mode: 'planned-only',
      totalDistanceNm: 20,
      cruiseAltitudeFt: 4500,
      points: [{ lat: 48.279, lon: 8.428, distanceNm: 0, terrainFt: 2201, plannedAltFt: 2201 }],
      obstacles: [{ distanceNm: 5, heightFt: 420, type: 'mast' }],
      airspaces: [{ name: 'CTR Test', startDistanceNm: 2, endDistanceNm: 8, lowerFt: 2500, upperFt: 4500, frequencies: ['118.100'] }]
    },
    context: { currentPosition: '0.3 NM E Pattonville', position: '0.2 NM SE EDTW', frequency: 'FIS 128.950', frequencySource: 'Offenes Gebiet' },
    missionGeometry: { target: { id: 'target', name: 'Ziel', lat: 48.4, lon: 8.7 }, poiChain: [] }
  });
  assert.equal(snapshot.missionId, 'mission-42');
  assert.equal(snapshot.route.waypoints.length, 2);
  assert.equal(snapshot.navigation.bearingToNextDeg, 355);
  assert.equal(snapshot.navigation.progress, 0.25);
  assert.equal(snapshot.profile.points[0].lat, 48.279);
  assert.equal(snapshot.profile.obstacles[0].heightFt, 420);
  assert.equal(snapshot.profile.airspaces[0].frequencies[0], '118.100');
  assert.equal(snapshot.context.currentPosition, '0.3 NM E Pattonville');
  assert.equal(snapshot.context.frequency, 'FIS 128.950');
  assert.equal(core.normalizeTrackerMapSnapshot({ schema: 'ga.map-snapshot.v2', version: 2 }), null);
});

test('calculator evaluates arithmetic locally without dynamic code execution', () => {
  assert.equal(core.evaluateCalculatorExpression('(12+3)*2'), 30);
  assert.equal(core.evaluateCalculatorExpression('50%+1'), 1.5);
  assert.equal(core.evaluateCalculatorExpression('9÷3'), 3);
  assert.throws(() => core.evaluateCalculatorExpression('2/0'));
  assert.throws(() => core.evaluateCalculatorExpression('globalThis'));
});


test('EFB overlay zoom limits match the standalone map', () => {
 const fs=require('node:fs');
 const standalone=fs.readFileSync(require.resolve('../../map.js'),'utf8');
 const host=fs.readFileSync(require.resolve('../tracker-efb-kartentisch-host.js'),'utf8');
 const faa=core.OVERLAY_LAYERS.find(x=>x.id==='faa');
 assert.equal(faa.options.minZoom,Number(standalone.match(/const USA_VFR_OVERLAY_MIN_ZOOM = (\d+)/)[1]));
 assert.equal(faa.options.minNativeZoom,8);assert.equal(faa.options.maxNativeZoom,12);
 assert.equal(core.OVERLAY_LAYERS.find(x=>x.id==='aero').options.maxNativeZoom,12);
 assert.equal(core.OVERLAY_LAYERS.find(x=>x.id==='dfs').options.maxNativeZoom,11);
 assert.match(host,/maxZoom: 18/);
});

test('regional base maps keep activation order, drop unknown ids and outrank by priority', () => {
  const preferences = core.normalizePreferences({ regionalBases: ['SWISSTOPO', 'missing', 'basemap-de', 'swisstopo'] });
  assert.deepEqual(preferences.regionalBases, ['swisstopo', 'basemap-de']);
  const priority = Object.fromEntries(core.REGIONAL_BASE_LAYERS.map((layer) => [layer.id, layer.priority]));
  assert.ok(priority['basemap-de'] > priority.swisstopo, 'basemap.de must always lie above swisstopo');
  for (const layer of core.REGIONAL_BASE_LAYERS) {
    assert.equal(layer.options.bounds.length, 2);
    assert.ok(layer.localUrl, 'regional maps keep the tracker proxy as last fallback');
  }
  assert.ok(core.BASE_LAYERS.some((layer) => layer.id === 'esri-topo'));
});

test('base dim strength is clamped, stepped in the menu and drives the aero base opacity', () => {
  assert.equal(core.normalizePreferences({ baseDimPercent: 140 }).baseDimPercent, core.BASE_DIM_MAX_PERCENT);
  assert.equal(core.normalizePreferences({ baseDimPercent: -5 }).baseDimPercent, 0);
  assert.equal(core.normalizePreferences({ baseDimPercent: 'x' }).baseDimPercent, core.BASE_DIM_DEFAULT_PERCENT);
  assert.equal(core.baseLayerOpacity({ overlays: ['aero'], baseDimPercent: 80 }), 0.2);
  assert.equal(core.baseLayerOpacity({ overlays: ['aero'], baseDimPercent: 0 }), 1);
  assert.equal(core.baseLayerOpacity({ overlays: ['dfs'], baseDimPercent: 80 }), 1);
  assert.equal(core.BASE_DIM_MAX_PERCENT % core.BASE_DIM_STEP_PERCENT, 0);
});

test('map tile cache is on by default and can be switched off', () => {
  assert.equal(core.normalizePreferences().tileCache, true);
  assert.equal(core.normalizePreferences({ tileCache: false }).tileCache, false);
  assert.equal(core.normalizePreferences({ tileCache: 'no' }).tileCache, true);
});

test('OSM community maps are proxy-only and every proxied layer is known to the tracker proxy', () => {
  const proxy = require('../tracker-efb-tile-proxy');
  const layers = [...core.BASE_LAYERS, ...core.REGIONAL_BASE_LAYERS, ...core.OVERLAY_LAYERS];
  for (const id of ['osm', 'osm-de', 'osm-swiss', 'cyclosm']) {
    const layer = core.BASE_LAYERS.find((entry) => entry.id === id);
    assert.equal(layer.proxyOnly, true, id + ' must never be fetched directly by Coherent');
    assert.ok(layer.localUrl);
  }
  for (const layer of layers) {
    if (!layer.localUrl) continue;
    const id = layer.localUrl.split('/')[4];
    assert.ok(proxy.TILE_SOURCES[id], 'proxy source for ' + id);
  }
  assert.match(proxy.TILE_USER_AGENT, /^VFR-Multitool-Tracker-EFB\/[0-9.]+ \(\+https:\/\//);
  assert.equal(proxy.parseTrackerEfbTilePath('/api/v1/map-tile/nasa-night/9/1/1.png'), null, 'NASA tiles stop at zoom 8');
  assert.ok(proxy.parseTrackerEfbTilePath('/api/v1/map-tile/nasa-night/8/1/1.png'));
});

test('the desktop-rendered vector map is proxy-only and known to the tracker proxy', () => {
  const proxy = require('../tracker-efb-tile-proxy');
  const layer = core.BASE_LAYERS.find((entry) => entry.id === 'vfr-vector');
  assert.ok(layer);
  assert.equal(layer.desktopRender, true);
  assert.equal(proxy.TILE_SOURCES['vfr-vector'].desktopRender, 'vfr');
  assert.equal(core.normalizePreferences({ baseLayer: 'vfr-vector' }).baseLayer, 'vfr-vector');
});

test('vector map colours are stored locally, clamped and encoded for the tile URL', () => {
  assert.equal(core.encodeVectorStyle({}), '');
  const style = core.normalizeVectorStyle({ wood: '#6AA35A', hillshade: 999, labelSize: 10, water: 'blue' });
  assert.equal(style.wood, '#6aa35a');
  assert.equal(style.hillshade, 200);
  assert.equal(style.labelSize, 60);
  assert.equal(style.water, core.VECTOR_STYLE_DEFAULTS.water);
  assert.equal(core.encodeVectorStyle(style), 'f2cf4a.100.6aa35a.100.9cc3ee.d9472b.ee7a3c.555555.200.60');
  for (const key of Object.keys(core.VECTOR_STYLE_PALETTES)) assert.equal(core.VECTOR_STYLE_PALETTES[key][0], core.VECTOR_STYLE_DEFAULTS[key]);
  assert.deepEqual(core.normalizePreferences({ vectorStyle: { rail: '#222222' } }).vectorStyle.rail, '#222222');
});
