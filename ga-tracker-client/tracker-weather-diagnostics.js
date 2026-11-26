'use strict';
// Weather diagnostics for the tracker log: what the simulator really reports, next to
// the nearest real METAR, so wrong passenger remarks can be traced (26.11.2026: Orti
// flew in fog, the simulator reported AMBIENT VISIBILITY 138.6 km, the passenger praised
// the long view). Diagnostics only: nothing here feeds voice, missions or the UI.
//
// SIM_WEATHER         every 60 s while a mission runs or the aircraft is airborne, and at
//                     once (at most every 10 s) when visibility band, cloud or precipitation
//                     changes. voiceHint is the weather line the passenger prompts build.
// SIM_WEATHER_METAR   nearest METAR every 10 min (aviationweather.gov, bbox around the
//                     aircraft), with temperature/dew point spread as a fog hint.

const INTERVAL_MS = 60 * 1000;
const CHANGE_MIN_MS = 10 * 1000;
const METAR_INTERVAL_MS = 10 * 60 * 1000;
const METAR_URL = 'https://aviationweather.gov/api/data/metar?format=json&bbox=';
const VIS_BANDS_KM = [1, 3, 5, 8, 20, 50];

function finite(value) { return typeof value === 'number' && Number.isFinite(value) ? value : null; }
function round(value, digits = 1) {
  const n = finite(value);
  if (n === null) return null;
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}
function visBand(visKm) {
  if (visKm === null) return -1;
  const index = VIS_BANDS_KM.findIndex(limit => visKm < limit);
  return index === -1 ? VIS_BANDS_KM.length : index;
}
function quote(text, max = 160) {
  return `"${String(text || '').replace(/\s+/g, ' ').replace(/"/g, "'").trim().slice(0, max)}"`;
}

// Same wording as _weatherContext in passenger-voice.js / mission-poi-voice-core.js.
function voiceVisibilityHint(visKm) {
  if (visKm === null) return '';
  const desc = visKm < 3 ? ' (sehr schlecht)' : visKm < 8 ? ' (eingeschränkt)' : visKm > 20 ? ' (ausgezeichnet)' : '';
  return `Sicht ${visKm} km${desc}`;
}

function distanceNm(a, b) {
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(b.lat - a.lat), dLon = toRad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 3440.065 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

function nearestMetar(rows, pos) {
  let best = null;
  for (const row of Array.isArray(rows) ? rows : []) {
    const lat = finite(row?.lat), lon = finite(row?.lon);
    if (lat === null || lon === null) continue;
    const dist = distanceNm(pos, { lat, lon });
    if (!best || dist < best.dist) best = { row, dist };
  }
  return best;
}

function metarLine(best) {
  const row = best.row;
  const temp = finite(row.temp), dewp = finite(row.dewp);
  const spread = temp !== null && dewp !== null ? round(temp - dewp, 1) : null;
  return `SIM_WEATHER_METAR station=${String(row.icaoId || '?').slice(0, 8)} distNm=${round(best.dist, 1)}`
    + ` visib=${String(row.visib ?? '?').slice(0, 8)}sm wx=${String(row.wxString || '-').slice(0, 24)}`
    + ` cat=${String(row.fltCat || '?').slice(0, 6)} temp=${temp ?? '?'} dewp=${dewp ?? '?'} spread=${spread ?? '?'}`
    + ` raw=${quote(row.rawOb, 200)}`;
}

function createWeatherDiagnostics(options = {}) {
  const log = typeof options.log === 'function' ? options.log : () => {};
  const now = typeof options.now === 'function' ? options.now : Date.now;
  const fetchImpl = options.fetch || (typeof fetch === 'function' ? fetch : null);
  const intervalMs = Number(options.intervalMs) || INTERVAL_MS;
  const metarIntervalMs = Number(options.metarIntervalMs) || METAR_INTERVAL_MS;
  let lastLogAt = -Infinity, lastChangeLogAt = -Infinity, lastMetarAt = -Infinity;
  let lastSignature = '', metarInFlight = false;

  async function fetchMetar(pos) {
    if (!fetchImpl || metarInFlight) return;
    metarInFlight = true;
    try {
      const bbox = [pos.lat - 0.6, pos.lon - 0.9, pos.lat + 0.6, pos.lon + 0.9].map(v => v.toFixed(2)).join(',');
      const response = await fetchImpl(METAR_URL + bbox, { headers: { 'User-Agent': 'VFR-Multitool-Tracker' } });
      if (!response?.ok) { log(`SIM_WEATHER_METAR status=${response?.status ?? '?'}`); return; }
      const best = nearestMetar(await response.json(), pos);
      log(best ? metarLine(best) : 'SIM_WEATHER_METAR station=none');
    } catch (error) {
      log(`SIM_WEATHER_METAR error=${String(error?.message || error).slice(0, 80)}`);
    } finally {
      metarInFlight = false;
    }
  }

  // sample: raw telemetry fields (lat, lon, altFt, aglFt, onGround, visMeters, inCloud,
  // precipState, precipLabel, precipRateRaw, tempC, windKts, windDeg, windGustKts,
  // turbulencePct, weatherPreset, hasMission, inMenu).
  function observe(sample = {}) {
    if (!sample || sample.inMenu === true) return;
    const lat = finite(sample.lat), lon = finite(sample.lon);
    if (lat === null || lon === null || (lat === 0 && lon === 0)) return;
    if (!(sample.hasMission === true || sample.onGround === false)) return;
    const t = now();
    const visMeters = finite(sample.visMeters);
    const visKm = visMeters === null ? null : Math.round(visMeters / 100) / 10;
    const cloud = sample.inCloud === true || sample.inCloud === 1 ? 1 : (sample.inCloud === false || sample.inCloud === 0 ? 0 : '?');
    const signature = `${visBand(visKm)}|${cloud}|${sample.precipState ?? '?'}`;
    const changed = lastSignature !== '' && signature !== lastSignature;
    const due = t - lastLogAt >= intervalMs;
    if (!due && !(changed && t - lastChangeLogAt >= CHANGE_MIN_MS)) return;
    const reason = due && !changed ? 'interval' : `change:${lastSignature || '-'}>${signature}`;
    lastSignature = signature;
    lastLogAt = t;
    if (changed) lastChangeLogAt = t;
    const preset = sample.weatherPreset && Number.isSafeInteger(sample.weatherPreset.index)
      ? `${sample.weatherPreset.index}:${quote(sample.weatherPreset.name, 40)}` : 'unknown';
    log(`SIM_WEATHER reason=${reason} visM=${visMeters === null ? '?' : Math.round(visMeters)} visKm=${visKm ?? '?'}`
      + ` cloud=${cloud} precip=${sample.precipState ?? '?'}(${sample.precipLabel || '?'}) rate=${round(sample.precipRateRaw, 2) ?? '?'}`
      + ` temp=${round(sample.tempC) ?? '?'} wind=${round(sample.windKts, 0) ?? '?'}/${round(sample.windDeg, 0) ?? '?'}`
      + ` gust=${round(sample.windGustKts, 0) ?? '?'} turb=${round(sample.turbulencePct, 0) ?? '?'}`
      + ` altFt=${round(sample.altFt, 0) ?? '?'} aglFt=${round(sample.aglFt, 0) ?? '?'} gnd=${sample.onGround ? 1 : 0}`
      + ` pos=${lat.toFixed(2)},${lon.toFixed(2)} preset=${preset} mission=${sample.hasMission ? 1 : 0}`
      + ` voiceHint=${quote(voiceVisibilityHint(visKm), 60)}`);
    if (t - lastMetarAt >= metarIntervalMs) {
      lastMetarAt = t;
      void fetchMetar({ lat, lon });
    }
  }

  return { observe };
}

module.exports = { createWeatherDiagnostics, voiceVisibilityHint, nearestMetar, visBand, INTERVAL_MS, METAR_INTERVAL_MS };
