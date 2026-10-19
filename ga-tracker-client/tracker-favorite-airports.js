'use strict';
const cloudSync = require('../cloud-sync-client');
const favorites = require('../map-favorite-airports');
const { requestJson } = require('./tracker-navcom-preferences');

// Read-only bridge for the EFB map stars. The Web app owns edits (airport fields);
// the Tracker only reads the personal profile field `favoriteAirports`.
function createFavoriteAirports({ pilotId, pin, request = requestJson, baseUrl = 'https://ga-proxy.einherjer.workers.dev/api/sync-v2/', refreshMs = 30000, now = Date.now }) {
  const client = pilotId && pin ? cloudSync.create({ pilotId, pin, request, baseUrl }) : null;
  let airports = [], lastRead = -Infinity, busy = null, available = false;
  async function readLegacy() {
    const response = await request(baseUrl.replace(/\/sync-v2\/?$/, '/sync/') + encodeURIComponent(pilotId), { headers: { 'X-Pilot-PIN': pin } });
    if (!response.ok) throw new Error('favorite_airports_profile_unavailable');
    return response.json();
  }
  function refresh() {
    if (!client) return Promise.resolve(state());
    if (busy) return busy;
    if (now() - lastRead < refreshMs) return Promise.resolve(state());
    busy = (async () => {
      try {
        const result = await client.read(['field:favoriteAirports']);
        const profile = result.migrated ? result.profile : await readLegacy();
        // A profile without the field (older app) keeps the last known list.
        if (profile && Array.isArray(profile.favoriteAirports)) airports = favorites.normalizeList(profile.favoriteAirports);
        available = true;
        lastRead = now();
      } catch (_) { /* Offline: keep the last known stars. */ }
      return state();
    })().finally(() => { busy = null; });
    return busy;
  }
  function state() {
    return { airports: airports.map(item => ({ code: item.code, displayCode: item.displayCode, name: item.name, lat: item.lat, lon: item.lon })), available };
  }
  return { state, refresh };
}

module.exports = { createFavoriteAirports };
