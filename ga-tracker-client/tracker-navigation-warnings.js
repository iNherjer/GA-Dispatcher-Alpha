'use strict';
const crypto = require('node:crypto');
const core = require('../navigation-warning-core');

function createNavigationWarnings({ data, voice, getSettings, getRoute = () => null, now = Date.now, log = () => {} }) {
  const airspace = core.createAirspaceDetector(), terrain = core.createTerrainDetector(), waypoint = core.createWaypointDetector();
  const session = crypto.randomUUID();
  let sequence = 0, revision = 0, lastTick = 0, busy = false, latest = null, gs = 0, vs = 0, epoch = 0;
  let spaceRetryAt = 0;
  let spaces = [], spaceAt = 0, spaceBounds = null, spacePending = null, obstacleAt = 0;
  let active = true;
  let status = 'waiting', health = '', events = [], lastGoodAt = 0;
  function emit(event) {
    const at = now(), as = event.as;
    const text = event.text || `${as.name || 'Luftraum'} in ${event.minutes} min`;
    const item = { id: `warning-${session}-${++sequence}`, kind: event.kind, text: text.slice(0, 240), at, expiresAt: at + 60000,
      ...(as ? { airspace: { id: as._id || as.id || '', name: String(as.name || '').slice(0, 120), type: as.type, icaoClass: as.icaoClass,
        lowerLimit: as.lowerLimit, upperLimit: as.upperLimit,
        frequencies: (as.frequencies || []).slice(0, 4).map(f => ({ name: String(f.name || '').slice(0, 50), value: String(f.value || '').slice(0, 30), primary: !!f.primary })) }, minutes: event.minutes, level: event.level } : {}) };
    events = [...events.filter(e => e.expiresAt > at), item].slice(-12); revision++;
    voice.enqueueWarning({ effectId: item.id, kind: item.kind, text: item.text, clips: event.clips, expiresAt: item.expiresAt });
    log(`NAV_WARNING kind=${item.kind} id=${item.id} text=${text}`);
  }
  function setStatus(value, error = '') {
    if (status !== value || health !== error) { status = value; health = error; revision++; }
  }
  function reset() {
    epoch++; latest = null; gs = 0; vs = 0; lastTick = 0;
    spaces = []; spaceAt = 0; spaceBounds = null; spaceRetryAt = 0; obstacleAt = 0;
    airspace.reset(); terrain.reset(); waypoint.reset();
    events.forEach(e => voice.cancel(e.id, 'navigation-reset')); events = []; revision++;
    setStatus('waiting');
  }
  function spacesCover(points, at) {
    return !!spaceBounds && at - spaceAt < 120000 && points.every(p => p.lon >= spaceBounds.west && p.lon <= spaceBounds.east
      && p.lat >= spaceBounds.south && p.lat <= spaceBounds.north);
  }
  async function evaluate(point, captured, token) {
    const settings = getSettings() || {}, moving = gs > 30, points = core.predictions(point, gs, vs), ahead = [point, ...points];
    if (!spacesCover(ahead, captured)) setStatus('partial', 'Luftraumdaten für die Flugbahn unvollständig');
    // Reuse cached geometry only while it covers the CURRENT standalone
    // prediction, including turns and changes of speed. Downloads stay async.
    if (!spacePending && captured >= spaceRetryAt && (!spacesCover(ahead, captured) || captured - spaceAt > 30000)) {
      const bounds = core.predictionBounds(ahead);
      spacePending = data.airspaces(ahead).then(value => {
        if (token === epoch) { spaces = value; spaceAt = now(); spaceBounds = bounds; spaceRetryAt = 0; }
      }).catch(() => { if (token === epoch) spaceRetryAt = now() + 10000; }).finally(() => { spacePending = null; });
    }
    // Obstacle access is prewarmed independently; it never delays terrain/audio or telemetry.
    if (captured - obstacleAt > 60000) {
      obstacleAt = captured;
      data.obstacles(ahead).catch(() => {});
    }
    const sampled = await Promise.all(points.map(async p => {
      try { return { ...p, terrainFt: await data.terrain(p) }; }
      catch (_) { return { ...p, terrainFt: null }; }
    }));
    if (token !== epoch || now() - captured > 3000 || !latest || latest.paused) return;
    // A response captured before a turn must not announce the old flight path.
    if (Math.abs((latest.hdg - point.hdg + 540) % 360 - 180) > 5) return;
    const currentTerrain = Number.isFinite(point.agl) ? point.alt - point.agl : null;
    const missingTerrain = sampled.some(p => p.terrainFt === null);
    const covered = spacesCover(ahead, captured);
    setStatus(missingTerrain || !covered ? 'partial' : 'ready',
      [missingTerrain ? 'Geländedaten unvollständig' : '', !covered ? 'Luftraumdaten für die Flugbahn unvollständig' : ''].filter(Boolean).join(' · '));
    lastGoodAt = captured;
    // Ground preparation fills the same caches, without producing flight alerts.
    if (!moving) return;
    if (settings.airspace !== false && covered) {
      // Match the standalone fallback to the terrain beneath the aircraft for missing prediction samples.
      const awmPoints = sampled.filter(p => p.min !== 0.25).map(p => ({ ...p, terrainFt: p.terrainFt ?? currentTerrain }));
      for (const event of airspace.evaluate({ airspaces: spaces, points: awmPoints, gps: point,
        lastTerrainFt: currentTerrain, now: captured, readFreq: settings.readFreq !== false })) emit(event);
    }
    if (settings.terrain !== false) for (const event of terrain.evaluate(sampled, point.gs, captured)) emit(event);
  }
  function observe(point) {
    if (!active || !point || ![point.lat, point.lon, point.alt, point.gs, point.vs, point.hdg].every(Number.isFinite)) return;
    if (latest && (now() - latest.at > 15000 || core.calcNav(point.lat, point.lon, latest.lat, latest.lon).dist > 10)) reset();
    latest = { ...point, at: now() };
    if (point.paused) { setStatus('paused'); return; }
    gs = gs === 0 ? point.gs : gs * 0.7 + point.gs * 0.3;
    vs = vs === 0 ? point.vs : vs * 0.7 + point.vs * 0.3;
    const settings = getSettings() || {}, route = getRoute();
    if (settings.waypoint !== false && route?.points) {
      for (const event of waypoint.evaluate(point, route.points, route.id)) emit(event);
    }
    if (busy || now() - lastTick <= (gs > 30 ? 1000 : 5000)) return;
    lastTick = now(); busy = true;
    const generation = epoch;
    evaluate(latest, lastTick, generation).catch(error => { if (generation === epoch) setStatus('partial', error.message); })
      .finally(() => { busy = false; });
  }
  return { observe, reset, setEnabled(enabled) {
    if (active === enabled) return;
    reset(); active = enabled; setStatus(enabled ? 'waiting' : 'standalone');
  }, snapshot() {
    return { schema: 'ga.navigation-warnings.v1', active, session, revision, status: latest && now() - latest.at > 10000 ? 'stale' : status,
      health, lastGoodAt, events: events.filter(e => e.expiresAt > now()),
      cache: { bytes: data.cache.snapshot().bytes, files: data.cache.snapshot().files, maxBytes: data.cache.snapshot().maxBytes } };
  } };
}
module.exports = { createNavigationWarnings };
