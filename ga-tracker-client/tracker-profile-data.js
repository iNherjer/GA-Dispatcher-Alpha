'use strict';
const { validatePng } = require('./tracker-navigation-data');
const { gunzipSync } = require('node:zlib');
const ROOT = 'https://inherjer.github.io/GA-Dispatcher-Alpha/';
// The local profile transport accepts only the standalone's public datasets.
// Neither relay commands nor arbitrary network/filesystem destinations enter here.
function resourceUrl(input, body) {
  let url = new URL(String(input), ROOT);
  if (url.origin === 'https://ga-proxy.einherjer.workers.dev' && url.pathname === '/api/metar') url = new URL(url.searchParams.get('src'));
  else if (url.origin === 'https://api.codetabs.com' && url.pathname === '/v1/proxy/') url = new URL(url.searchParams.get('quest'));
  if (url.username || url.password || url.hash) throw new Error('invalid_profile_resource');
  const hosted = url.origin === new URL(ROOT).origin && (
    /^\/GA-Dispatcher-Alpha\/(cities|airports)\.json$/.test(url.pathname) ||
    /^\/GA-Dispatcher-Alpha\/obstacles\/(core-tiles|tiles)\/\d+\/\d+\.json(?:\.gz)?$/.test(url.pathname));
  const weather = url.origin === 'https://api.open-meteo.com' && ['/v1/forecast', '/v1/elevation'].includes(url.pathname);
  const metar = url.origin === 'https://aviationweather.gov' && url.pathname === '/api/data/metar';
  const hostedProxy = url.origin === 'https://ga-proxy.einherjer.workers.dev' && url.pathname === '/api/obstacles/tile';
  const radar = url.origin === 'https://api.rainviewer.com' && url.pathname === '/public/weather-maps.json';
  const airportData = url.origin === 'https://ga-proxy.einherjer.workers.dev' && ['/api/airports', '/api/navaids'].includes(url.pathname);
  const overpass = ['https://overpass-api.de', 'https://lz4.overpass-api.de', 'https://z.overpass-api.de'].includes(url.origin) && url.pathname === '/api/interpreter';
  if (!hosted && !hostedProxy && !weather && !metar && !overpass && !radar && !airportData) throw new Error('invalid_profile_resource');
  if (overpass) {
    // Same read-only query as standalone; GET makes it cacheable by the common
    // local cache. The endpoint is fixed and cannot address other destinations.
    const query = new URLSearchParams(body || '').get('data') || url.searchParams.get('data');
    if (!query || query.length > 16000 || !query.startsWith('[out:json]') || /(?:make|convert|local|foreach|retro|timeline|diff|adiff)\s*[(;:]/i.test(query)) throw new Error('invalid_profile_query');
    url.searchParams.set('data', query);
  }
  for (const key of ['t', 'v', '_']) url.searchParams.delete(key);
  url.searchParams.sort();
  return { url: url.href, ttlMs: hosted || hostedProxy || airportData ? 3600000 : overpass ? 86400000 : metar ? 300000 : url.pathname.endsWith('elevation') ? 15552000000 : 300000 };
}
function profilePoints(value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 2048) throw new Error('invalid_profile_points');
  return value.map(p => {
    if (!p || !Number.isFinite(p.lat) || !Number.isFinite(p.lon) || Math.abs(p.lat) > 85.051128 || Math.abs(p.lon) > 180 || !Number.isFinite(p.distNM)) throw new Error('invalid_profile_points');
    return { lat: p.lat, lon: p.lon, distNM: p.distNM };
  });
}
function createProfileData(data) {
  let terrainTail = Promise.resolve();
  return {
    async terrainTile(z, x, y) {
      if (![z, x, y].every(Number.isInteger) || z < 0 || z > 13 || x < 0 || y < 0 || x >= 2 ** z || y >= 2 ** z) throw new Error('invalid_terrain_tile_coordinates');
      return data.cache.get(`https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`, {
        ttlMs: 86400000, limit: 1024 * 1024, validate: validatePng
      });
    },
    async resource(input, options = {}) {
      const request = resourceUrl(input, options.body);
      const decode = bytes => JSON.parse((bytes[0] === 31 && bytes[1] === 139 ? gunzipSync(bytes, { maxOutputLength: 32 * 1024 ** 2 }) : bytes).toString('utf8'));
      return decode(await data.cache.get(request.url, { ttlMs: request.ttlMs, limit: 32 * 1024 ** 2, validate: decode }));
    },
    async terrain(input, options = {}) {
      const points = profilePoints(input);
      // Same Terrarium samples as standalone; shared pending tile reads and the
      // disk cache keep this off the telemetry/mission command path.
      const run = terrainTail.catch(() => {}).then(async () => {
        const result = new Array(points.length);
        let next = 0, failure = null;
        const worker = async () => {
          while (next < points.length && !failure) {
            if (options.signal?.aborted) throw new Error('profile_request_aborted');
            const index = next++, point = points[index];
            try {
              const elevation = await data.terrain(point);
              if (!Number.isFinite(elevation)) throw new Error('profile_terrain_unavailable');
              result[index] = { ...point, elevFt: Math.max(0, elevation) };
            } catch (error) { failure = error; throw error; }
          }
        };
        const results = await Promise.allSettled([worker(), worker()]);
        const rejected = results.find(result => result.status === 'rejected');
        if (rejected) throw rejected.reason;
        return result;
      });
      // At most two profile samples can occupy cache download slots. Warning
      // lookahead keeps capacity, even while route and HDG reload together.
      terrainTail = run.catch(() => {});
      return run;
    },
    async aviation(input) {
      const points = profilePoints(input);
      if (points.length !== 2) throw new Error('invalid_profile_airport_bounds');
      const [sw, ne] = points;
      if (sw.lat >= ne.lat || sw.lon >= ne.lon || ne.lat - sw.lat > 2 || ne.lon - sw.lon > 4) throw new Error('invalid_profile_airport_bounds');
      return data.aviation.getPopupSnapshot({ lat: (sw.lat + ne.lat) / 2, lon: (sw.lon + ne.lon) / 2,
        radiusNm: 30, bounds: { west: sw.lon, south: sw.lat, east: ne.lon, north: ne.lat } });
    },
    async airports(input) {
      const points = profilePoints(input);
      if (points.length !== 2) throw new Error('invalid_profile_airport_bounds');
      const [sw, ne] = points;
      if (sw.lat >= ne.lat || sw.lon >= ne.lon || ne.lat - sw.lat > 2 || ne.lon - sw.lon > 4) throw new Error('invalid_profile_airport_bounds');
      return data.aviation.getAirportSnapshots({ lat: (sw.lat + ne.lat) / 2, lon: (sw.lon + ne.lon) / 2,
        radiusNm: 30, bounds: { west: sw.lon, south: sw.lat, east: ne.lon, north: ne.lat } });
    },
    async navpoints(input) {
      const points = profilePoints(input);
      if (points.length !== 2) throw new Error('invalid_profile_airport_bounds');
      const [sw, ne] = points;
      if (sw.lat >= ne.lat || sw.lon >= ne.lon || ne.lat - sw.lat > 170 || ne.lon - sw.lon > 360) throw new Error('invalid_profile_airport_bounds');
      return data.navpoints({ lat: (sw.lat + ne.lat) / 2, lon: (sw.lon + ne.lon) / 2,
        radiusNm: 30, bounds: { west: sw.lon, south: sw.lat, east: ne.lon, north: ne.lat } });
    },
    async airspaces(input) { return data.airspaces(profilePoints(input)); }
  };
}
module.exports = { createProfileData, resourceUrl, profilePoints };
