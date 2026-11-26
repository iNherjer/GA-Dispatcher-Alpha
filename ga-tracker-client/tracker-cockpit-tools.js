'use strict';
const fs = require('node:fs');
const freeflight = require('../freeflight-navigation-core');
const { createHash } = require('node:crypto');
const { randomUUID } = require('node:crypto');
const routeEdit = require('../map-route-edit-core');
const { buildRoute, selectStart } = require('../map-direct-to-core');
const { getAipPopupUrl } = require('../airport-aip');
const { projectTrackerNavigationSnapshot, projectTrackerMapSnapshot } = require('./tracker-efb-map-snapshot-core');

// Navigation-only state: never enters mission authority, manifest or scene execution.
// A detour (Direct-To with the mission kept) is navigation-only as well: it sits
// next to the mission run, is flown and edited instead of the mission route and
// is dropped as soon as that run ends. The mission route stays untouched.
const DETOUR_SCHEMA = 'ga.navigation-detour.v1';
function createCockpitTools(options) {
  let route = null, pendingPayload = null, cloudSource = '', detour = null;
  let navigationState = {}, navigationIdentity = null;
  const now = options.now || Date.now;
  const validPoint = p => p && Number.isFinite(p.lat) && Math.abs(p.lat) <= 90
    && Number.isFinite(p.lon) && Math.abs(p.lon) <= 180;
  if (options.filename) {
    try {
      const saved = JSON.parse(fs.readFileSync(options.filename, 'utf8'));
      if (saved.schema === 'ga.navigation-route.v1') cloudSource = String(saved.cloudSource || '');
      if (saved.schema === 'ga.navigation-route.v1' && saved.points?.length >= 2 && saved.points.length <= 128 && saved.points.every(validPoint)) route = saved;
    } catch (_) {}
  }
  if (options.detourFilename) {
    try {
      const saved = JSON.parse(fs.readFileSync(options.detourFilename, 'utf8'));
      if (saved.schema === DETOUR_SCHEMA && saved.runId && saved.points?.length >= 2 && saved.points.length <= 128 && saved.points.every(validPoint)) detour = saved;
    } catch (_) {}
  }
  function commitDetour(next) {
    detour = next && next.points?.length >= 2 ? next : null;
    if (!options.detourFilename) return;
    if (!detour) { fs.rmSync(options.detourFilename, { force: true }); return; }
    fs.writeFileSync(options.detourFilename + '.tmp', JSON.stringify(detour), 'utf8');
    fs.renameSync(options.detourFilename + '.tmp', options.detourFilename);
  }
  // The detour belongs to exactly one run: a finished or replaced mission removes it.
  function activeDetour(run) {
    if (!detour) return null;
    const summary = options.getRunSummary ? options.getRunSummary() : run;
    const runId = run?.runId || summary?.runId || '';
    if (runId !== detour.runId) { commitDetour(null); return null; }
    return detour;
  }
  function missionLocked() {
    const compliance = options.getCompliance?.();
    return !!(compliance?.selected && !['released', 'not_selected'].includes(compliance.phase));
  }
  // A new Direct-To gets a new id; edits keep the id so pending client edits stay in order.
  function commitDetourPoints(run, points, departureIcao, destinationIcao, keepId = false) {
    commitDetour({ schema: DETOUR_SCHEMA, id: keepId && detour?.id ? detour.id : randomUUID(), revision: Number(detour?.revision || 0) + 1,
      runId: run.runId, missionId: run.missionId, updatedAt: now(), points,
      departureIcao: String(departureIcao || points[0].icao || '').slice(0, 12),
      destinationIcao: String(destinationIcao || points[points.length - 1].icao || '').slice(0, 12) });
  }
  function navigation(run = options.getRun(), projectedMap = null) {
    const runDetour = activeDetour(run);
    if (runDetour) {
      const missionMap = projectTrackerMapSnapshot(run, options.getFlight());
      const missionPoints = missionMap?.route?.waypoints || [];
      return { id: runDetour.id, revision: Number(runDetour.revision || 0), missionId: run.missionId, runId: run.runId,
        detour: true, editable: !missionLocked(), points: runDetour.points, resetPoints: missionPoints, missionPoints,
        missionRevision: Number(run.navigationRevision || 0),
        context: { departureIcao: runDetour.departureIcao || '', destinationIcao: runDetour.destinationIcao || '' } };
    }
    if (run) {
      const map = projectedMap || projectTrackerMapSnapshot(run, options.getFlight());
      const compliance = options.getCompliance?.();
      return { id: run.runId, revision: Number(run.navigationRevision || 0), missionId: run.missionId, runId: run.runId,
        editable: run.executionAuthority === 'tracker' && run.executionRecipe === 'apt'
          && !(compliance?.selected && !['released', 'not_selected'].includes(compliance.phase)),
        points: map?.route?.waypoints || [], resetPoints: projectTrackerMapSnapshot({ ...run, navigationRoute: null })?.route?.waypoints || [], context: map?.context || {} };
    }
    return { id: route?.id || '', revision: Number(route?.revision || 0), missionId: '', runId: '', editable: true,
      briefing: route?.briefing || null, points: route?.points || [], resetPoints: route?.resetPoints || route?.points || [], context: { departureIcao: route?.departureIcao || '', destinationIcao: route?.destinationIcao || '' } };
  }
  function version() {
    const run = options.getRunSummary ? options.getRunSummary() : options.getRun();
    const runDetour = activeDetour(run);
    if (runDetour) return { id: runDetour.id, revision: Number(runDetour.revision || 0) };
    return { id: run?.runId || route?.id || '', revision: run ? Number(run.navigationRevision || 0) : Number(route?.revision || 0) };
  }
  function snapshot() {
    const run = options.getRun();
    const runDetour = activeDetour(run);
    const identity = runDetour?.id || run?.runId || route?.id || '';
    if (identity !== navigationIdentity) { navigationIdentity = identity; navigationState = {}; }
    if (runDetour) {
      // Guidance, profile and warnings follow the detour; the mission route is only shown faded.
      const missionMap = projectTrackerMapSnapshot(run, options.getFlight());
      const detourMap = projectTrackerNavigationSnapshot({ ...runDetour, briefing: null }, options.getFlight(), {navigationState});
      if (!detourMap) return null;
      const nav = navigation(run);
      return { ...detourMap, missionId: run.missionId, runId: run.runId, navigationOnly: false, briefing: null, detour: true,
        missionRoute: missionMap?.route || null,
        missionGeometry: missionMap?.missionGeometry || detourMap.missionGeometry,
        routeEdit: { id: nav.id, revision: nav.revision, editable: nav.editable, resetPoints: nav.resetPoints, detour: true } };
    }
    const map = run ? projectTrackerMapSnapshot(run, options.getFlight(), {navigationState}) : projectTrackerNavigationSnapshot(route, options.getFlight(), {navigationState});
    const nav = navigation(run, map);
    return map && { ...map, routeEdit: { id: nav.id, revision: nav.revision, editable: nav.editable, resetPoints: nav.resetPoints } };
  }
  function commit(next) {
    next = { ...next, cloudSource: next.cloudSource ?? cloudSource };
    if (options.filename) {
      fs.writeFileSync(options.filename + '.tmp', JSON.stringify(next), 'utf8');
      fs.renameSync(options.filename + '.tmp', options.filename);
    }
    cloudSource = next.cloudSource;
    route = next.points?.length >= 2 ? next : null;
  }
  async function execute(request) {
    const data = request.payload || {};
    if (request.intent === 'radio_tune') {
      if (!options.isSimulatorConnected()) return {ok:false,error:'simulator_not_connected'};
      return options.tuneRadio ? options.tuneRadio(data) : {ok:false,error:'radio_unavailable'};
    }
    if (request.intent === 'flightplan_export') {
      const exporter = require('./tracker-flightplan-export');
      try {
        // Without a mission the free navigation route is sent (EFB/Toolbar).
        if (data.free === true) {
          if (options.getRun()) return { ok: false, status: 'conflict', error: 'mission_authority_conflict' };
          return { ok: true, status: 'ok', plan: exporter.createFreeFlightPlanExport(route, data) };
        }
        const run = options.getRun();
        return { ok: true, status: 'ok', plan: exporter.createFlightPlanExport(run, data, run && activeDetour(run)) };
      }
      catch (error) { return { ok: false, error: error.message }; }
    }
    if (request.intent === 'navigation_get') return { ok: true, status: 'ok', navigation: navigation(), map: snapshot() };
    if (request.intent === 'navigation_edit' || request.intent === 'navigation_adopt') {
      const current = navigation();
      const fail = error => ({ ok: false, status: 'conflict', error, navigation: navigation(), map: snapshot() });
      if (!current.editable) return fail('navigation_mission_locked');
      if (data.routeId !== current.id || request.expectedRevision !== current.revision) return fail('navigation_revision_conflict');
      if (current.detour) {
        if (request.intent !== 'navigation_edit') return fail('mission_authority_conflict');
        try {
          // Route Reset leaves the detour: the mission route is flown again.
          if (data.edit?.action === 'reset') commitDetour(null);
          else {
            const run = options.getRun();
            commitDetourPoints(run, routeEdit.apply(current.points, data.edit, current.resetPoints),
              detour.departureIcao, detour.destinationIcao, true);
          }
          return { ok: true, status: 'ok', navigation: navigation(), map: snapshot() };
        } catch (error) { return fail(error.message); }
      }
      if (options.getRun()) {
        if (request.intent !== 'navigation_edit') return fail('mission_authority_conflict');
        const result = await options.editMissionRoute({ routeId: current.id, expectedRevision: current.revision, edit: data.edit });
        return { ...result, navigation: navigation(), map: snapshot() };
      }
      try {
        const adopt = request.intent === 'navigation_adopt';
        const points = adopt ? routeEdit.normalize(data.points) : routeEdit.apply(current.points, data.edit, current.resetPoints);
        // The app sends its dispatch route along; edits made before adoption are not a reset target.
        let adoptResetPoints = points;
        if (adopt && Array.isArray(data.resetPoints) && data.resetPoints.length >= 2) {
          try { adoptResetPoints = routeEdit.normalize(data.resetPoints); } catch (_) {}
        }
        commit({ schema: 'ga.navigation-route.v1', id: current.id || randomUUID(), revision: current.revision + 1,
          planId: adopt ? '' : route?.planId || '',
          resetPoints: adopt ? adoptResetPoints : current.resetPoints,
          briefing: request.intent === 'navigation_adopt' ? null : route?.briefing || null,
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
    if (request.intent === 'navigation_detour_set') {
      // App map Direct-To (any map point) with the mission kept.
      const run = options.getRun();
      const current = navigation(run);
      const fail = error => ({ ok: false, status: 'conflict', error, navigation: navigation(), map: snapshot() });
      if (!run) return fail('navigation_detour_requires_mission');
      if (missionLocked()) return fail('navigation_mission_locked');
      if (data.routeId !== current.id || request.expectedRevision !== current.revision) return fail('navigation_revision_conflict');
      try {
        const points = routeEdit.normalize(data.points);
        if (points.length < 2 || points.length > 128) throw new Error('navigation_point_invalid');
        commitDetourPoints(run, points, data.departureIcao, data.destinationIcao);
        return { ok: true, status: 'ok', navigation: navigation(), map: snapshot() };
      } catch (error) { return fail(error.message); }
    }
    if (request.intent !== 'airport_direct_to') return { ok: false, error: 'cockpit_tool_not_allowed' };
    const flight = options.getFlight();
    const live = options.isSimulatorConnected() && validPoint(flight) && now() - Number(flight.capturedAt || 0) < 30000;
    const missionRun = options.getRun();
    if (missionRun) {
      // Identical authority boundary to App: abort is a separate, explicit action.
      // keepMission puts the Direct-To route next to the mission as a detour.
      if (data.keepMission !== true) return { ok: false, status: 'conflict', error: 'mission_authority_conflict' };
      if (missionLocked()) return { ok: false, status: 'conflict', error: 'navigation_mission_locked' };
      const airport = data.airport || {};
      const icao = String(airport.icao || '').trim().toUpperCase();
      if (!/^[A-Z0-9]{4}$/.test(icao) || !validPoint(airport)) return { ok: false, error: 'invalid_airport' };
      const current = navigation(missionRun);
      if (Number(request.expectedRevision) !== Number(current.revision || 0)) return { ok: false, status: 'conflict', error: 'navigation_revision_conflict' };
      const from = current.points?.[0];
      const start = live ? { lat: flight.lat, lng: flight.lon, existing: false }
        : (from && validPoint({ lat: Number(from.lat), lon: Number(from.lon ?? from.lng) })
          ? { lat: Number(from.lat), lng: Number(from.lon ?? from.lng), existing: true, elevationFt: from.elevationFt } : null);
      if (!start) return { ok: false, error: 'live_position_required' };
      const startIcao = start.existing ? String(from.icao || current.context?.departureIcao || '') : 'GPS';
      const startName = start.existing ? String(from.name || startIcao || 'Start') : 'Live GPS Position';
      const destination = { ...airport, icao, name: String(airport.name || icao).slice(0, 100) };
      commitDetourPoints(missionRun, routeEdit.normalize(buildRoute(start, destination, startName, startIcao)), startIcao, icao);
      return { ok: true, status: 'ok', map: snapshot(), navigation: navigation() };
    }
    const airport = data.airport || {};
    const icao = String(airport.icao || '').trim().toUpperCase();
    if (!/^[A-Z0-9]{4}$/.test(icao) || !validPoint(airport)) return { ok: false, error: 'invalid_airport' };
    if (Number(request.expectedRevision) !== Number(route?.revision || 0)) return { ok: false, status: 'conflict', error: 'navigation_revision_conflict' };
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

  function adoptCloud(value) {
    if (!value) return { ok: true, changed: false };
    if (options.getRun()) return { ok: false, error: 'mission_authority_conflict' };
    try {
      const nav = freeflight.normalize(value);
      const key = createHash('sha256').update(JSON.stringify(nav)).digest('hex');
      if (key === cloudSource) return { ok: true, changed: false };
      // Re-reading the same plan after edits keeps its dispatch route as reset target.
      const samePlan = !!(nav.planId && route?.planId === nav.planId && route.resetPoints?.length >= 2);
      const resetPoints = nav.resetPoints || (samePlan ? route.resetPoints : nav.points);
      commit({ schema: 'ga.navigation-route.v1', id: randomUUID(), revision: Number(route?.revision || 0) + 1,
        planId: nav.planId, updatedAt: now(), points: nav.points, resetPoints, departureIcao: nav.departureIcao,
        destinationIcao: nav.destinationIcao, briefing: nav.briefing, cloudSource: key });
      return { ok: true, changed: true };
    } catch (error) { return { ok: false, error: error.message }; }
  }
  function clear() {
    if (!route) return;
    // Keep the consumed cloud identity so an old plan cannot resurrect after a mission.
    if (cloudSource) commit({ schema: 'ga.navigation-route.v1', points: [], cloudSource });
    else { if (options.filename) fs.rmSync(options.filename, { force: true }); route = null; }
  }
  return { execute, snapshot, navigation, version, clear, adoptCloud };
}
function createNavigationRelay(cockpitTools, broadcastNavigation = () => {}) {
  const navigationRequests = new Map();
  const executeNavigationRelay = command => {
    const key = String(command.clientId || '') + ':' + String(command.commandId || '');
    const fingerprint = JSON.stringify([command.intent, command.expectedRevision, command.payload]);
    const previous = navigationRequests.get(key);
    if (previous) return previous.fingerprint === fingerprint ? previous.promise : Promise.resolve({ ok: false, error: 'command_id_conflict' });
    if (!command.clientId || !command.commandId || !['navigation_get', 'navigation_edit', 'navigation_adopt', 'navigation_detour_set', 'airport_direct_to'].includes(command.intent))
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
