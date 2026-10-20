'use strict';
const crypto = require('node:crypto');

function resumeStart(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const lat = Number(raw.lat), lon = Number(raw.lon);
  if (raw.lat == null || raw.lon == null || !Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    throw new Error('flightplan_resume_point_invalid');
  }
  // Optional air start altitude; always rounded up to the next 100 ft.
  const altFt = Number(raw.altFt);
  return { lat, lon, altFt: raw.altFt != null && Number.isFinite(altFt) && altFt > 0 && altFt <= 45000 ? Math.ceil(altFt / 100) * 100 : null };
}

// World Map air start (field test 20.10.2026): MSFS spawns in the air at the
// last waypoint before the destination, whatever comes before it. The air start
// plan therefore holds only the save point and the destination; the complete
// mission plan follows in the cockpit via the avionics (no remaining-route
// guess, which is ambiguous for out-and-back routes).
function airStartPlan(points, start) {
  return [{ lat: start.lat, lon: start.lon, name: 'SPEICHERPUNKT', icao: '' }, points[points.length - 1]];
}

function missionRouteSource(run) {
  const bundle = run?.resumeBundle || {}, state = bundle.missionState || {};
  const mission = state.currentMissionData || state.activeMissionContract || state;
  const contract = mission.missionContract || state.activeMissionContract || {};
  return [run?.navigationRoute?.points, mission.routeWaypoints, mission.missionRouteWaypoints,
    state.routeWaypoints, state.missionRouteWaypoints, contract.routeWaypoints, contract.missionRouteWaypoints]
    .find(value => Array.isArray(value) && value.length >= 2) || null;
}

// Departure and destination airport of the mission route (first/last point).
function missionRouteEnds(run) {
  const raw = missionRouteSource(run);
  if (!raw) return null;
  const point = (value, fallbackIcao) => {
    const lat = Number(value?.lat ?? value?.latitude), lon = Number(value?.lon ?? value?.lng ?? value?.longitude);
    if (value?.lat == null && value?.latitude == null) return null;
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
    const icao = String(value.icao || value.airportIdent || fallbackIcao || '').trim().toUpperCase().slice(0, 12);
    return { lat, lon, label: icao || String(value.name || value.label || '').trim().slice(0, 60) };
  };
  const state = run?.resumeBundle?.missionState || {};
  return { departure: point(raw[0], state.currentStartICAO), destination: point(raw[raw.length - 1], state.currentDestICAO) };
}

// Read the private, complete route. Never export the bounded map projection.
function createFlightPlanExport(run, request = {}) {
  if (!run || run.missionId !== request.missionId || run.runId !== request.runId) throw new Error('flightplan_run_changed');
  const navigationRevision = Number(run.navigationRoute?.revision || 0);
  if (request.navigationRevision != null && request.navigationRevision !== navigationRevision) throw new Error('flightplan_route_changed');
  const bundle = run.resumeBundle || {}, state = bundle.missionState || {};
  const mission = state.currentMissionData || state.activeMissionContract || state;
  const contract = mission.missionContract || state.activeMissionContract || {};
  const raw = missionRouteSource(run);
  if (!raw || raw.length > 512) throw new Error('flightplan_route_invalid');
  let points = raw.map((point, index) => {
    const latValue = point.lat ?? point.latitude, lonValue = point.lon ?? point.lng ?? point.longitude;
    const lat = Number(latValue), lon = Number(lonValue);
    if (latValue == null || lonValue == null || latValue === '' || lonValue === ''
      || !Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) throw new Error('flightplan_point_invalid');
    return { lat, lon, name: String(point.name || point.label || point.icao || `WP${index + 1}`).slice(0, 100),
      icao: String(point.icao || point.airportIdent || '').trim().toUpperCase().slice(0, 12) };
  });
  // Only the World Map air start uses the save point; everything else gets the
  // complete mission plan.
  const savePoint = resumeStart(request.startAt);
  const resume = request.airStart === true ? savePoint : null;
  if (resume) points = airStartPlan(points, resume);
  const context = bundle.mapProfile?.context || {};
  // The air start plan carries the save point altitude as its cruise altitude
  // (MSFS appears to spawn there); the avionics plan keeps the mission cruise.
  const altitude = resume?.altFt || [context.profileCruiseFt, mission.cruiseAltitudeFt, mission.cruiseAltFt, mission.cruiseAltitude,
    contract.cruiseAltitudeFt, contract.cruiseAltFt, state.cruiseAltitudeFt, state.cruiseAltFt, state.altMapInput]
    .find(value => value != null && value !== '' && Number.isFinite(Number(value)) && Number(value) > 0);
  const plan = { schema: 'ga.flightplan-export.v1', missionId: run.missionId, runId: run.runId, navigationRevision,
    // An air start plan starts at the save point, not at an airport.
    departureIcao: resume ? '' : String(context.departureIcao || state.currentStartICAO || state.mDepICAO || points[0].icao || '').toUpperCase(),
    destinationIcao: String(context.destinationIcao || state.currentDestICAO || state.mDestICAO || points[points.length - 1].icao || '').toUpperCase(),
    cruiseAltitudeFt: altitude == null ? null : Number(altitude), isVfr: true, points,
    ...(resume ? { resumeFrom: { lat: resume.lat, lon: resume.lon }, airStart: 'spawn-only' } : {}) };
  return { ...plan, routeHash: crypto.createHash('sha256').update(JSON.stringify(plan)).digest('hex') };
}
module.exports = { createFlightPlanExport, missionRouteEnds };
