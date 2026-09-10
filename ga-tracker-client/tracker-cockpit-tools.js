'use strict';
const fs = require('node:fs');
const { randomUUID } = require('node:crypto');
const routeEdit = require('../map-route-edit-core');
const { buildRoute, selectStart } = require('../map-direct-to-core');
const { getAipPopupUrl } = require('../airport-aip');
const { projectTrackerNavigationSnapshot, projectTrackerMapSnapshot } = require('./tracker-efb-map-snapshot-core');

// Navigation-only state: never enters mission authority, manifest or scene execution.
function createCockpitTools(options) {
  let route = null, pendingPayload = null;
  let navigationState = {}, navigationIdentity = null;
  const now = options.now || Date.now;
  const validPoint = p => p && Number.isFinite(p.lat) && Math.abs(p.lat) <= 90
    && Number.isFinite(p.lon) && Math.abs(p.lon) <= 180;
  if (options.filename) {
    try {
      const saved = JSON.parse(fs.readFileSync(options.filename, 'utf8'));
      if (saved.schema === 'ga.navigation-route.v1' && saved.points?.length >= 2 && saved.points.length <= 128 && saved.points.every(validPoint)) route = saved;
    } catch (_) {}
  }
  function navigation(run = options.getRun(), projectedMap = null) {
    if (run) {
      const map = projectedMap || projectTrackerMapSnapshot(run, options.getFlight());
      const compliance = options.getCompliance?.();
      return { id: run.runId, revision: Number(run.navigationRevision || 0), missionId: run.missionId, runId: run.runId,
        editable: run.executionAuthority === 'tracker' && run.executionRecipe === 'apt'
          && !(compliance?.selected && !['released', 'not_selected'].includes(compliance.phase)),
        points: map?.route?.waypoints || [], resetPoints: projectTrackerMapSnapshot({ ...run, navigationRoute: null })?.route?.waypoints || [], context: map?.context || {} };
    }
    return { id: route?.id || '', revision: Number(route?.revision || 0), missionId: '', runId: '', editable: true,
      points: route?.points || [], resetPoints: route?.resetPoints || route?.points || [], context: { departureIcao: route?.departureIcao || '', destinationIcao: route?.destinationIcao || '' } };
  }
  function version() {
    const run = options.getRunSummary ? options.getRunSummary() : options.getRun();
    return { id: run?.runId || route?.id || '', revision: run ? Number(run.navigationRevision || 0) : Number(route?.revision || 0) };
  }
  function snapshot() {
    const run = options.getRun();
    const identity = run?.runId || route?.id || '';
    if (identity !== navigationIdentity) { navigationIdentity = identity; navigationState = {}; }
    const map = run ? projectTrackerMapSnapshot(run, options.getFlight(), {navigationState}) : projectTrackerNavigationSnapshot(route, options.getFlight(), {navigationState});
    const nav = navigation(run, map);
    return map && { ...map, routeEdit: { id: nav.id, revision: nav.revision, editable: nav.editable, resetPoints: nav.resetPoints } };
  }
  function commit(next) {
    if (options.filename) {
      fs.writeFileSync(options.filename + '.tmp', JSON.stringify(next), 'utf8');
      fs.renameSync(options.filename + '.tmp', options.filename);
    }
    route = next;
  }
  async function execute(request) {
    const data = request.payload || {};
    if (request.intent === 'navigation_get') return { ok: true, status: 'ok', navigation: navigation(), map: snapshot() };
    if (request.intent === 'navigation_edit' || request.intent === 'navigation_adopt') {
      const current = navigation();
      const fail = error => ({ ok: false, status: 'conflict', error, navigation: navigation(), map: snapshot() });
      if (!current.editable) return fail('navigation_mission_locked');
      if (data.routeId !== current.id || request.expectedRevision !== current.revision) return fail('navigation_revision_conflict');
      if (options.getRun()) {
        if (request.intent !== 'navigation_edit') return fail('mission_authority_conflict');
        const result = options.editMissionRoute({ routeId: current.id, expectedRevision: current.revision, edit: data.edit });
        return { ...result, navigation: navigation(), map: snapshot() };
      }
      try {
        const points = request.intent === 'navigation_adopt' ? routeEdit.normalize(data.points) : routeEdit.apply(current.points, data.edit, current.resetPoints);
        commit({ schema: 'ga.navigation-route.v1', id: current.id || randomUUID(), revision: current.revision + 1,
          resetPoints: request.intent === 'navigation_adopt' ? points : current.resetPoints,
          updatedAt: now(), departureIcao: String(data.departureIcao || route?.departureIcao || points[0].icao || '').slice(0, 12),
          destinationIcao: String(data.destinationIcao || route?.destinationIcao || points[points.length - 1].icao || '').slice(0, 12), points });
        return { ok: true, status: 'ok', navigation: navigation(), map: snapshot() };
      } catch (error) { return fail(error.message); }
    }
    if (request.intent === 'read_payload') {
      if (!options.isSimulatorConnected()) return { ok: false, error: 'simulator_not_connected' };
      // Repeated reads from different windows share one SimConnect request.
      if (!pendingPayload) pendingPayload = Promise.resolve().then(() => options.readPayload(12))
        .finally(() => { pendingPayload = null; });
      return { ok: true, status: 'ok', snapshot: await pendingPayload };
    }
    if (request.intent === 'open_airport_aip' || request.intent === 'open_airport_weather') {
      const icao = String(data.icao || '').trim().toUpperCase();
      if (!/^[A-Z0-9]{4}$/.test(icao)) return { ok: false, error: 'invalid_airport' };
      const url = request.intent === 'open_airport_weather' ? `https://metar-taf.com/de/${icao}` : getAipPopupUrl(icao, String(data.country || ''));
      if (!url) return { ok: false, error: 'aip_unavailable' };
      await options.openExternal(url);
      return { ok: true, status: 'ok' };
    }
    if (request.intent !== 'airport_direct_to') return { ok: false, error: 'cockpit_tool_not_allowed' };
    // Identical authority boundary to App: abort is a separate, explicit action.
    if (options.getRun()) return { ok: false, status: 'conflict', error: 'mission_authority_conflict' };
    const airport = data.airport || {};
    const icao = String(airport.icao || '').trim().toUpperCase();
    if (!/^[A-Z0-9]{4}$/.test(icao) || !validPoint(airport)) return { ok: false, error: 'invalid_airport' };
    if (Number(request.expectedRevision) !== Number(route?.revision || 0)) return { ok: false, status: 'conflict', error: 'navigation_revision_conflict' };
    const flight = options.getFlight();
    const live = options.isSimulatorConnected() && validPoint(flight) && now() - Number(flight.capturedAt || 0) < 30000;
    const start = selectStart({ route: route?.points, forceGpsStart: data.forceGpsStart === true,
      gpsLive: live, position: flight });
    if (!start) return { ok: false, error: 'live_position_required' };
    const startIcao = start.existing ? route.departureIcao : 'GPS';
    const startName = start.existing ? route.points[0].name : 'Live GPS Position';
    const destination = { ...airport, icao, name: String(airport.name || icao).slice(0, 100) };
    const next = { schema: 'ga.navigation-route.v1', id: randomUUID(), revision: Number(route?.revision || 0) + 1,
      updatedAt: now(), departureIcao: startIcao, destinationIcao: icao,
      points: buildRoute(start, destination, startName, startIcao) };
    commit(next);
    return { ok: true, status: 'ok', map: snapshot(), navigation: navigation() };
  }

  function clear() {
    if (!route) return;
    if (options.filename) fs.rmSync(options.filename, { force: true });
    route = null;
  }
  return { execute, snapshot, navigation, version, clear };
}
function createNavigationRelay(cockpitTools, broadcastNavigation = () => {}) {
  const navigationRequests = new Map();
  const executeNavigationRelay = command => {
    const key = String(command.clientId || '') + ':' + String(command.commandId || '');
    const fingerprint = JSON.stringify([command.intent, command.expectedRevision, command.payload]);
    const previous = navigationRequests.get(key);
    if (previous) return previous.fingerprint === fingerprint ? previous.promise : Promise.resolve({ ok: false, error: 'command_id_conflict' });
    if (!command.clientId || !command.commandId || !['navigation_get', 'navigation_edit', 'navigation_adopt', 'airport_direct_to'].includes(command.intent))
      return Promise.resolve({ ok: false, error: 'navigation_command_invalid' });
    const promise = cockpitTools.execute(command).then(result => {
      if (result.ok && command.intent !== 'navigation_get') broadcastNavigation();
      const { map, ...compact } = result;
      return compact;
    }).catch(error => ({ ok: false, status: 'error', error: error.message }));
    navigationRequests.set(key, { fingerprint, promise });
    if (navigationRequests.size > 256) navigationRequests.delete(navigationRequests.keys().next().value);
    return promise;
  };
  return executeNavigationRelay;
}
module.exports = { createCockpitTools, createNavigationRelay };
