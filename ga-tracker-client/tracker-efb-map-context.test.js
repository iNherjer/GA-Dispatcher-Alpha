const assert = require('node:assert/strict');
const test = require('node:test');
const {
  MAP_CONTEXT_SCHEMA,
  createTrackerEfbMapContextProvider,
  parseTrackerEfbMapContextQuery,
  stableAviationBounds
} = require('./tracker-efb-map-context');

function jsonResponse(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

test('map-context query accepts bounded coordinates and rejects invalid values', () => {
  assert.deepEqual(parseTrackerEfbMapContextQuery(new URLSearchParams('lat=49.01303&lon=8.8385&radiusNm=4.25')), {
    lat: 49.01303,
    lon: 8.8385,
    radiusNm: 4.25
  });
  assert.equal(parseTrackerEfbMapContextQuery(new URLSearchParams('lat=91&lon=8')), null);
  assert.equal(parseTrackerEfbMapContextQuery(new URLSearchParams('lat=x&lon=8')), null);
  assert.equal(parseTrackerEfbMapContextQuery(new URLSearchParams('lat=49&lon=8&radiusNm=99')).radiusNm, 12);
});

test('aviation requests use stable half-degree coverage keys', () => {
  assert.deepEqual(stableAviationBounds({ lat: 49.01303, lon: 8.8385, radiusNm: 3 }), {
    west: 8.5,
    south: 48.5,
    east: 9.5,
    north: 49.5
  });
  assert.deepEqual(
    stableAviationBounds({ lat: 49.02, lon: 8.81, radiusNm: 3 }),
    stableAviationBounds({ lat: 49.01303, lon: 8.8385, radiusNm: 3 })
  );
});

test('map-context provider resolves terrain, weather, containing airspace and only nearby aviation features', async () => {
  const calls = [];
  const nowSeconds = Math.round(Date.now() / 1000);
  const provider = createTrackerEfbMapContextProvider({
    hostedAviation: false,
    getCurrentAltitudeFt: () => 3200,
    fetchRemote: async (url) => {
      calls.push(url);
      if (url.includes('/api/openaip/snapshot')) {
        return jsonResponse({
          airspaces: [{
            _id: 'as-1',
            name: 'CTR TEST',
            type: 4,
            icaoClass: 3,
            lowerLimit: { value: 0, unit: 1, referenceDatum: 0 },
            upperLimit: { value: 2500, unit: 1, referenceDatum: 1 },
            frequencies: [{ name: 'TOWER', value: 118.8, unit: 2 }],
            geometry: {
              type: 'Polygon',
              coordinates: [[[8.7, 48.9], [9.0, 48.9], [9.0, 49.2], [8.7, 49.2], [8.7, 48.9]]]
            }
          }],
          airports: [{
            _id: 'apt-1',
            icaoCode: 'EDTX',
            country: 'DE',
            name: 'Testplatz',
            elevation: { value: 400, unit: 1 },
            frequencies: [{ name: 'INFO', value: 123.45, unit: 2 }],
            runways: [
              { designator: '09', dimension: { length: { value: 800, unit: 0 } } },
              { designator: '27', dimension: { length: { value: 800, unit: 0 } } }
            ],
            geometry: { type: 'Point', coordinates: [8.84, 49.014] }
          }, {
            _id: 'apt-far',
            icaoCode: 'FAR1',
            name: 'Nicht vor Ort',
            geometry: { type: 'Point', coordinates: [10, 50] }
          }],
          navaids: [],
          reportingPoints: []
        });
      }
      if (url.includes('/v1/elevation')) return jsonResponse({ elevation: [120] });
      if (url.includes('/v1/forecast')) {
        return jsonResponse({
          hourly: {
            time: [nowSeconds],
            cloud_cover: [72], cloud_cover_low: [65], cloud_cover_mid: [20], cloud_cover_high: [5],
            precipitation: [0.2], rain: [0.2], snowfall: [0],
            wind_speed_10m: [12], wind_direction_10m: [240],
            temperature_2m: [18], dew_point_2m: [12], relative_humidity_2m: [68],
            visibility: [18000], pressure_msl: [1017], weather_code: [61]
          }
        });
      }
      return jsonResponse({ error: 'unexpected' }, 404);
    }
  });

  const request = { lat: 49.01303, lon: 8.8385, radiusNm: 3 };
  const first = await provider.get(request);
  assert.equal(first.schema, MAP_CONTEXT_SCHEMA);
  assert.equal(first.cache, 'miss');
  assert.equal(first.terrainFt, 394);
  assert.equal(first.currentAltitudeFt, 3200);
  assert.equal(first.airspaces.length, 1);
  assert.equal(first.airspaces[0].name, 'CTR D · TEST');
  assert.equal(first.airspaces[0].lowerFt, 394);
  assert.equal(first.airspaces[0].frequencies[0].label, 'TWR');
  assert.equal(first.feature.icao, 'EDTX');
  assert.equal(first.feature.country, 'DE');
  assert.equal(first.feature.runways[0].designator, '09/27');
  assert.equal(first.weather.wdir, 240);
  assert.equal(first.weather.pressureMslHpa, 1017);
  assert.equal(first.cloud.type, 'BKN');
  assert.deepEqual(first.errors, []);
  assert.equal(first.sources.aviation.mode, 'region-cache');
  assert.equal(Number.isFinite(first.sources.aviation.durationMs), true);
  assert.equal(calls.length, 3);

  const second = await provider.get(request);
  assert.equal(second.cache, 'hit');
  assert.equal(calls.length, 3);
});

test('map-context provider returns useful partial data when an upstream is unavailable', async () => {
  const nowSeconds = Math.round(Date.now() / 1000);
  const provider = createTrackerEfbMapContextProvider({
    hostedAviation: false,
    fetchRemote: async (url) => {
      if (url.includes('/api/openaip/snapshot')) throw new Error('offline');
      if (url.includes('/v1/elevation')) return jsonResponse({ elevation: [50] });
      return jsonResponse({ hourly: { time: [nowSeconds], wind_speed_10m: [4], wind_direction_10m: [90] } });
    }
  });
  const result = await provider.get({ lat: 48, lon: 9, radiusNm: 2 });
  assert.equal(result.available, true);
  assert.equal(result.terrainFt, 164);
  assert.equal(result.feature, null);
  assert.deepEqual(result.airspaces, []);
  assert.equal(result.sources.aviation.available, false);
  assert.equal(result.sources.weather.available, true);
  assert.equal(result.errors.length, 1);
});

test('map-context uses the hosted GA Aviation DB before the regional proxy', async () => {
  const calls = [];
  const nowSeconds = Math.round(Date.now() / 1000);
  const provider = createTrackerEfbMapContextProvider({
    fetchRemote: async (url) => {
      calls.push(url);
      if (url.endsWith('/latest.json')) return jsonResponse({
        datasetVersion: 'snapshot-2026-08-01',
        manifest: 'cycles/snapshot-2026-08-01/manifest.json'
      });
      if (url.endsWith('/manifest.json')) return jsonResponse({
        datasetVersion: 'snapshot-2026-08-01',
        source: { name: 'OpenAIP' },
        collections: {
          airspaces: { packs: [] }, airports: { packs: [] },
          navaids: { packs: [] }, reportingPoints: { packs: [] }
        }
      });
      if (url.includes('/v1/elevation')) return jsonResponse({ elevation: [100] });
      if (url.includes('/v1/forecast')) return jsonResponse({
        hourly: { time: [nowSeconds], wind_speed_10m: [5], wind_direction_10m: [180] }
      });
      return jsonResponse({ error: 'unexpected' }, 404);
    }
  });
  const result = await provider.get({ lat: 48.5, lon: 8.5, radiusNm: 2 });
  assert.equal(result.sources.aviation.name, 'GA Aviation DB');
  assert.equal(result.sources.aviation.mode, 'hosted');
  assert.equal(calls.some(url => url.includes('/api/openaip/snapshot')), false);
  assert.equal(calls.some(url => url.endsWith('/latest.json')), true);
});
