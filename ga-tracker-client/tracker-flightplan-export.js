'use strict';
const crypto = require('node:crypto');

function resumeStart(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const lat = Number(raw.lat), lon = Number(raw.lon);
  if (raw.lat == null || raw.lon == null || !Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    throw new Error('flightplan_resume_point_invalid');
  }
  return { lat, lon };
}

// Distance (NM, local equirectangular) from a point to a route segment.
function segmentDistanceNm(point, a, b) {
  const scale = Math.cos(point.lat * Math.PI / 180);
  const ax = (a.lon - point.lon) * scale, ay = a.lat - point.lat;
  const bx = (b.lon - point.lon) * scale, by = b.lat - point.lat;
  const dx = bx - ax, dy = by - ay;
  const length = dx * dx + dy * dy;
  const t = length > 0 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / length)) : 0;
  return Math.hypot(ax + t * dx, ay + t * dy) * 60;
}

// Remaining route after a simulator interruption: the interruption point, then
// every waypoint after the route segment closest to it.
function remainingRoute(points, start) {
  let best = 0;
  let bestDistance = Infinity;
  for (let index = 0; index < points.length - 1; index++) {
    const distance = segmentDistanceNm(start, points[index], points[index + 1]);
    if (distance < bestDistance) { bestDistance = distance; best = index; }
  }
  return [{ lat: start.lat, lon: start.lon, name: 'UNTERBRECHUNG', icao: '' }, ...points.slice(best + 1)];
}

// MSFS places a World Map air start at the second point of a plan without a
// departure airport. A lead-in point behind the interruption point (on the
// reverse of the next leg) makes the interruption point that second point.
const AIR_START_LEAD_IN_NM = 3;
function withAirStartLeadIn(points) {
  const [start, next] = points;
  if (!start || !next) return points;
  const scale = Math.cos(start.lat * Math.PI / 180) || 1;
  const dx = (next.lon - start.lon) * scale, dy = next.lat - start.lat;
  const length = Math.hypot(dx, dy);
  if (!(length > 0)) return points;
  const factor = AIR_START_LEAD_IN_NM / 60 / length;
  const lead = { lat: start.lat - dy * factor, lon: start.lon - dx * factor / scale, name: 'VORLAUF', icao: '' };
  return [lead, ...points];
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
  const resume = resumeStart(request.startAt);
  if (resume) points = remainingRoute(points, resume);
  if (resume && request.airStart === true) points = withAirStartLeadIn(points);
  const context = bundle.mapProfile?.context || {};
  const altitude = [context.profileCruiseFt, mission.cruiseAltitudeFt, mission.cruiseAltFt, mission.cruiseAltitude,
    contract.cruiseAltitudeFt, contract.cruiseAltFt, state.cruiseAltitudeFt, state.cruiseAltFt, state.altMapInput]
    .find(value => value != null && value !== '' && Number.isFinite(Number(value)) && Number(value) > 0);
  const plan = { schema: 'ga.flightplan-export.v1', missionId: run.missionId, runId: run.runId, navigationRevision,
    // A resume route starts in the air at the interruption point, not at an airport.
    departureIcao: resume ? '' : String(context.departureIcao || state.currentStartICAO || state.mDepICAO || points[0].icao || '').toUpperCase(),
    destinationIcao: String(context.destinationIcao || state.currentDestICAO || state.mDestICAO || points[points.length - 1].icao || '').toUpperCase(),
    cruiseAltitudeFt: altitude == null ? null : Number(altitude), isVfr: true, points,
    ...(resume ? { resumeFrom: { lat: resume.lat, lon: resume.lon } } : {}),
    ...(resume && request.airStart === true ? { airStartLeadInNm: AIR_START_LEAD_IN_NM } : {}) };
  return { ...plan, routeHash: crypto.createHash('sha256').update(JSON.stringify(plan)).digest('hex') };
}
module.exports = { createFlightPlanExport, remainingRoute, missionRouteEnds, withAirStartLeadIn };
