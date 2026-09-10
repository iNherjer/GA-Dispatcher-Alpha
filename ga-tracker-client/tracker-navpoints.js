'use strict';
const core = require('../map-navpoint-core');
const ROOT = 'https://inherjer.github.io/GA-Dispatcher-Alpha/';
const HOUR = 3600000;
function createNavpoints({ cache, aviation, now = Date.now }) {
  let stored = null;
  function fallbacks() {
    if (stored && now() - stored.at < HOUR) return stored.value;
    const read = async (file, field) => {
      const parse = bytes => {
        const data = JSON.parse(bytes.toString('utf8'));
        if (field ? !Array.isArray(data[field]) : !data || typeof data !== 'object' || Array.isArray(data)) throw Error('invalid_navpoint_database');
        return field ? data[field] : data;
      };
      return parse(await cache.get(ROOT + file, { ttlMs: HOUR, limit: 32 * 1024 ** 2, validate: parse }));
    };
    const value = Promise.allSettled([read('airports.json'), read('data/openaip-navaids.json', 'navaids'), read('data/openaip-reporting-points.json', 'points')])
      .then(results => {
        // Retry a missing source sooner; an unavailable download must never erase
        // valid cached data, nor turn the entire snap pool into an empty result.
        if (results.some(r => r.status === 'rejected')) stored = null;
        return results.map((r, i) => r.status === 'fulfilled' ? r.value : i === 0 ? {} : []);
      });
    stored = { at: now(), value };
    return value;
  }
  return async request => {
    const [fallback, hosted] = await Promise.all([fallbacks(), (request.bounds.north - request.bounds.south <= 2 && request.bounds.east - request.bounds.west <= 4
      ? aviation.getNavpointSnapshot(request).catch(() => null) : Promise.resolve(null))]);
    const [airports, navaids, reportingPoints] = fallback;
    const byId = new Map(navaids.map(item => [String(item._id || item.id || ''), item]));
    const bounds = request.bounds;
    const inside = p => p && p.lat >= bounds.south && p.lat <= bounds.north && p.lng >= bounds.west && p.lng <= bounds.east;
    const available = key => Array.isArray(hosted?.[key]) && (!hosted?.meta?.collections?.[key] || Number(hosted.meta.collections[key].errorStatus) === 0);
    const source = hosted?.meta?.source === 'hosted' ? 'hosted' : 'live';
    const entries = (available('navaids') ? hosted.navaids : navaids).map(item => core.navaid(item, available('navaids') ? source : 'static', byId)).filter(inside)
      .concat((available('reportingPoints') ? hosted.reportingPoints : reportingPoints).map(item => core.reportingPoint(item, available('reportingPoints') ? source : 'static')).filter(inside))
      .concat((available('airports') ? hosted.airports : []).map(core.airport).filter(inside));
    const seen = new Set(entries.filter(item => item.type === 'APT').map(item => item.airportIcao));
    core.globalAirports(bounds, airports).forEach(item => {
      if (!seen.has(item.airportIcao)) { seen.add(item.airportIcao); entries.push(item); }
    });
    // Only coordinates and labels cross loopback; full source documents stay on PC.
    return entries.map(item => ({ lat: item.lat, lng: item.lng, name: item.name, type: item.type,
      rppAirportIcao: item.rppAirportIcao || '', airportIcao: item.airportIcao || '' }));
  };
}
module.exports = { createNavpoints };
