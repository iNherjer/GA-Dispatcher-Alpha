'use strict';
const { validatePng } = require('./tracker-navigation-data');
const { gunzipSync } = require('node:zlib');
const { createTrackerDwdWeather } = require('./tracker-dwd-weather');
const ROOT = 'https://inherjer.github.io/GA-Dispatcher-Alpha/';
const EUMET_VIEW = 'https://view.eumetsat.int';
const SATELLITE_PRODUCTS = { clouds: ['msg_fes', 'clm'], infrared: ['mtg_fd', 'ir105_hrfi'] };
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
  const satellite = url.origin === EUMET_VIEW && Object.values(SATELLITE_PRODUCTS)
    .find(([workspace]) => url.pathname === '/geoserver/' + workspace + '/wms');
  if (satellite) {
    if (url.searchParams.get('request') !== 'GetCapabilities') throw new Error('invalid_profile_resource');
    const [workspace, layer] = satellite;
    return { url: EUMET_VIEW + '/geoserver/' + workspace + '/wms?service=WMS&version=1.3.0&request=GetCapabilities',
      ttlMs: 300000, satelliteLayer: layer };
  }
  const staticDwd = url.origin === new URL(ROOT).origin && url.pathname === '/api/v1/dwd-icon-eu';
  if (staticDwd || (url.origin === 'http://127.0.0.1:54582' && url.pathname === '/api/dwd-icon-eu')) {
    const points = (url.searchParams.get('points') || '').split(';');
    if (!points.length || points.length > 96 || points.some(point =>
      !/^-?\d{1,2}(?:\.\d{1,5})?,-?\d{1,3}(?:\.\d{1,5})?$/.test(point))
      || [...url.searchParams.keys()].some(key => !['points', 'profile', 'valid', 'prefetch'].includes(key))) {
      throw new Error('invalid_profile_resource');
    }
    if (staticDwd) {
      const coordinates = points.map(point => {
        const [lat, lon] = point.split(',').map(Number);
        if (Math.abs(lat) > 90 || Math.abs(lon) > 180) throw new Error('invalid_profile_resource');
        return { lat, lon };
      });
      const hour = Math.floor(Date.now() / 3600000) * 3600000;
      const validAt = url.searchParams.has('valid') ? Number(url.searchParams.get('valid')) * 1000 : null;
      if (validAt !== null && (!Number.isSafeInteger(validAt) || validAt % 3600000 || validAt < hour - 3 * 3600000 || validAt > hour + 12 * 3600000)) {
        throw new Error('invalid_profile_resource');
      }
      return { staticDwd: { points: coordinates, profile: url.searchParams.get('profile') === '1', validAt,
        probe: points.length === 1 && points[0] === '0,0' && Array.from(url.searchParams).length === 1 } };
    }
    return { url: url.href, localDwd: true };
  }
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
  let dwdWeather;
  return {
    async terrainTile(z, x, y) {
      if (![z, x, y].every(Number.isInteger) || z < 0 || z > 13 || x < 0 || y < 0 || x >= 2 ** z || y >= 2 ** z) throw new Error('invalid_terrain_tile_coordinates');
      return data.cache.get(`https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`, {
        ttlMs: 86400000, limit: 1024 * 1024, validate: validatePng
      });
    },
    async resource(input, options = {}) {
      const request = resourceUrl(input, options.body);
      if (request.staticDwd) {
        dwdWeather ??= createTrackerDwdWeather();
        return dwdWeather(request.staticDwd, options.signal);
      }
      if (request.localDwd) {
        const response = await fetch(request.url, { redirect: 'error', signal: options.signal });
        if (!response.ok) throw new Error('http_' + response.status);
        return response.status === 204 ? { source: 'dwd-icon-eu', samples: [] } : response.json();
      }
      if (request.satelliteLayer) {
        const decode = (bytes) => {
          const xml = bytes.toString('utf8');
          const name = new RegExp('<Name>(?:[a-z_]+:)?' + request.satelliteLayer + '</Name>').exec(xml);
          const layer = name && xml.slice(name.index).split('</Layer>', 1)[0];
          const match = layer && /<Dimension\b[^>]*\bname="time"[^>]*\bdefault="([^"]+)"/.exec(layer);
          if (!match || !Number.isFinite(Date.parse(match[1]))) throw new Error('satellite_time_unavailable');
          return { time: match[1] };
        };
        return decode(await data.cache.get(request.url, { ttlMs: request.ttlMs, limit: 512 * 1024, validate: decode }));
      }
      const decode = bytes => JSON.parse((bytes[0] === 31 && bytes[1] === 139 ? gunzipSync(bytes, { maxOutputLength: 32 * 1024 ** 2 }) : bytes).toString('utf8'));
      return decode(await data.cache.get(request.url, { ttlMs: request.ttlMs, limit: 32 * 1024 ** 2, validate: decode }));
    },
    async satelliteTile(mode, time, z, x, y) {
      const product = Object.hasOwn(SATELLITE_PRODUCTS, mode) && SATELLITE_PRODUCTS[mode];
      if (!product || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(time || '')
        || !Number.isFinite(Date.parse(time)) || ![z, x, y].every(Number.isInteger)
        || z < 0 || z > (mode === 'clouds' ? 6 : 7) || x < 0 || y < 0 || x >= 2 ** z || y >= 2 ** z) {
        throw new Error('invalid_profile_satellite_tile');
      }
      const edge = Math.PI * 6378137;
      const side = 2 * edge / 2 ** z;
      const bbox = [-edge + x * side, edge - (y + 1) * side, -edge + (x + 1) * side, edge - y * side];
      const params = new URLSearchParams({
        service: 'WMS', request: 'GetMap', version: '1.3.0', layers: product.join(':'), styles: '',
        crs: 'EPSG:3857', bbox: bbox.join(','), width: '256', height: '256', format: 'image/png',
        transparent: 'true', time
      });
      return data.cache.get(EUMET_VIEW + '/geoserver/wms?' + params, {
        ttlMs: 3600000, limit: 1024 * 1024, validate: validatePng
      });
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
