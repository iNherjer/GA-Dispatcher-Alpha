'use strict';
const cloudSync = require('../cloud-sync-client');
const { requestJson } = require('./tracker-navcom-preferences');

// Read-only bridge for the own aircraft icon in the EFB. The Web app owns the
// aircraft presets (profile field `aircraftPresets`, icon {custom, kind, color, size});
// `_library.selected` is the preset chosen in the main menu (free flight).
const ICON_KINDS = /^[a-z0-9_-]{1,24}$/;
const COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

function normalizeIcon(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const size = Math.round(Number(raw.size));
  return {
    custom: raw.custom === true,
    // Invalid values stay null: the EFB then keeps its global icon setting for them.
    kind: typeof raw.kind === 'string' && ICON_KINDS.test(raw.kind) ? raw.kind : null,
    color: typeof raw.color === 'string' && COLOR.test(raw.color) ? raw.color.toLowerCase() : null,
    size: Number.isFinite(size) && size >= 8 && size <= 120 ? size : null
  };
}

function normalizePresets(field) {
  const presets = {};
  let selected = '';
  if (!field || typeof field !== 'object') return { presets, selected };
  Object.keys(field).slice(0, 40).forEach(id => {
    if (id === '_library' || !/^[A-Za-z0-9_.-]{1,40}$/.test(id)) return;
    const preset = field[id];
    if (!preset || typeof preset !== 'object') return;
    presets[id] = { name: String(preset.name || id).slice(0, 60), icon: normalizeIcon(preset.icon) };
  });
  const library = field._library && typeof field._library === 'object' ? field._library : {};
  if (typeof library.selected === 'string' && presets[library.selected]) selected = library.selected;
  return { presets, selected };
}

function createAircraftIcons({ pilotId, pin, request = requestJson, baseUrl = 'https://ga-proxy.einherjer.workers.dev/api/sync-v2/', refreshMs = 60000, now = Date.now }) {
  const client = pilotId && pin ? cloudSync.create({ pilotId, pin, request, baseUrl }) : null;
  let data = { presets: {}, selected: '' }, lastRead = -Infinity, busy = null, available = false;
  async function readLegacy() {
    const response = await request(baseUrl.replace(/\/sync-v2\/?$/, '/sync/') + encodeURIComponent(pilotId), { headers: { 'X-Pilot-PIN': pin } });
    if (!response.ok) throw new Error('aircraft_icons_profile_unavailable');
    return response.json();
  }
  function refresh() {
    if (!client) return Promise.resolve(state());
    if (busy) return busy;
    if (now() - lastRead < refreshMs) return Promise.resolve(state());
    busy = (async () => {
      try {
        const result = await client.read(['field:aircraftPresets']);
        const profile = result.migrated ? result.profile : await readLegacy();
        // A profile without the field keeps the last known icons.
        if (profile && profile.aircraftPresets && typeof profile.aircraftPresets === 'object') data = normalizePresets(profile.aircraftPresets);
        available = true;
        lastRead = now();
      } catch (_) { /* Offline: keep the last known icons. */ }
      return state();
    })().finally(() => { busy = null; });
    return busy;
  }
  function state() {
    return { presets: JSON.parse(JSON.stringify(data.presets)), selected: data.selected, available };
  }
  return { state, refresh };
}

module.exports = { createAircraftIcons, normalizePresets };
