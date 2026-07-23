'use strict';

const HOMEBASE_FALLBACK_SCHEMA_VERSION = 1;

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function cloneJson(value, fallback) {
  try { return JSON.parse(JSON.stringify(value)); } catch (_) { return fallback; }
}

function normalizeControlStates(raw) {
  return (Array.isArray(raw) ? raw : []).slice(0, 200).flatMap((entry) => {
    const instanceId = String(entry?.instanceId || '').trim().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
    const title = String(entry?.title || '').trim().slice(0, 160);
    const controlId = String(entry?.controlId || '').trim().toLowerCase();
    const stateId = String(entry?.stateId ?? entry?.state ?? '').trim().toLowerCase();
    if (!instanceId || !title
      || !/^[a-z][a-z0-9_-]{0,31}$/.test(controlId)
      || !/^[a-z][a-z0-9_-]{0,31}$/.test(stateId)) return [];
    return [{ instanceId, title, controlId, stateId }];
  });
}

function normalizeHomebaseFallbackCache(raw, options = {}) {
  if (!raw || typeof raw !== 'object') throw new Error('Homebase-Fallback fehlt.');
  if (Number(raw.schemaVersion) !== HOMEBASE_FALLBACK_SCHEMA_VERSION) {
    throw new Error(`Homebase-Fallback-Schema ${raw.schemaVersion || 'unbekannt'} wird nicht unterstützt.`);
  }
  const lat = finite(raw?.base?.lat, NaN);
  const lon = finite(raw?.base?.lon, NaN);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    throw new Error('Homebase-Fallback enthält keinen gültigen Standort.');
  }
  const sceneSignature = String(raw.sceneSignature || '').trim().slice(0, 96);
  if (!sceneSignature) throw new Error('Homebase-Fallback enthält keine Szenensignatur.');
  const trackerVersionCode = Math.max(0, Math.trunc(finite(options.trackerVersionCode ?? raw.trackerVersionCode)));
  const pilotId = String(options.pilotId ?? raw.pilotId ?? '').trim().slice(0, 120);
  const enterRadiusNm = Math.max(0.1, Math.min(100, finite(raw?.base?.enterRadiusNm, 20)));
  const exitRadiusNm = Math.max(enterRadiusNm, Math.min(120, finite(raw?.base?.exitRadiusNm, 22)));
  return {
    schemaVersion: HOMEBASE_FALLBACK_SCHEMA_VERSION,
    trackerVersionCode,
    pilotId,
    savedAt: Math.max(0, Math.trunc(finite(options.savedAt ?? raw.savedAt, Date.now()))),
    sceneSignature,
    base: {
      lat,
      lon,
      enterRadiusNm,
      exitRadiusNm
    },
    doorAutomationEnabled: raw.doorAutomationEnabled !== false,
    objects: cloneJson(Array.isArray(raw.objects) ? raw.objects.slice(0, 100) : [], []),
    people: cloneJson(Array.isArray(raw.people) ? raw.people.slice(0, 3) : [], []),
    navigation: cloneJson(raw.navigation && typeof raw.navigation === 'object' ? raw.navigation : null, null),
    controlStates: normalizeControlStates(raw.controlStates)
  };
}

function compatibleHomebaseFallbackCache(raw, options = {}) {
  try {
    const cache = normalizeHomebaseFallbackCache(raw);
    const expectedPilotId = String(options.pilotId || '').trim();
    if (expectedPilotId && cache.pilotId !== expectedPilotId) return { ok: false, reason: 'pilot-mismatch', cache: null };
    return { ok: true, reason: '', cache };
  } catch (error) {
    return { ok: false, reason: error?.message || String(error), cache: null };
  }
}

function distanceNm(latA, lonA, latB, lonB) {
  const toRad = Math.PI / 180;
  const dLat = (finite(latB) - finite(latA)) * toRad;
  const dLon = (finite(lonB) - finite(lonA)) * toRad;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(finite(latA) * toRad) * Math.cos(finite(latB) * toRad) * Math.sin(dLon / 2) ** 2;
  return 3440.065 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
}

function fallbackShouldBeActive(cache, position, wasInside = false) {
  if (!cache?.base || !Number.isFinite(Number(position?.lat)) || !Number.isFinite(Number(position?.lon))) return false;
  const distance = distanceNm(position.lat, position.lon, cache.base.lat, cache.base.lon);
  return distance <= (wasInside ? cache.base.exitRadiusNm : cache.base.enterRadiusNm);
}

module.exports = {
  HOMEBASE_FALLBACK_SCHEMA_VERSION,
  normalizeHomebaseFallbackCache,
  compatibleHomebaseFallbackCache,
  distanceNm,
  fallbackShouldBeActive
};
