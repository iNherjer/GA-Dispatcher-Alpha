'use strict';
const crypto = require('node:crypto');

// Read the private, complete route. Never export the bounded map projection.
function createFlightPlanExport(run, request = {}) {
  if (!run || run.missionId !== request.missionId || run.runId !== request.runId) throw new Error('flightplan_run_changed');
  const navigationRevision = Number(run.navigationRoute?.revision || 0);
  if (request.navigationRevision != null && request.navigationRevision !== navigationRevision) throw new Error('flightplan_route_changed');
  const bundle = run.resumeBundle || {}, state = bundle.missionState || {};
  const mission = state.currentMissionData || state.activeMissionContract || state;
  const contract = mission.missionContract || state.activeMissionContract || {};
  const raw = [run.navigationRoute?.points, mission.routeWaypoints, mission.missionRouteWaypoints,
    state.routeWaypoints, state.missionRouteWaypoints, contract.routeWaypoints, contract.missionRouteWaypoints]
    .find(value => Array.isArray(value) && value.length >= 2);
  if (!raw || raw.length > 512) throw new Error('flightplan_route_invalid');
  const points = raw.map((point, index) => {
    const latValue = point.lat ?? point.latitude, lonValue = point.lon ?? point.lng ?? point.longitude;
    const lat = Number(latValue), lon = Number(lonValue);
    if (latValue == null || lonValue == null || latValue === '' || lonValue === ''
      || !Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) throw new Error('flightplan_point_invalid');
    return { lat, lon, name: String(point.name || point.label || point.icao || `WP${index + 1}`).slice(0, 100),
      icao: String(point.icao || point.airportIdent || '').trim().toUpperCase().slice(0, 12) };
  });
  const context = bundle.mapProfile?.context || {};
  const altitude = [context.profileCruiseFt, mission.cruiseAltitudeFt, mission.cruiseAltFt, mission.cruiseAltitude,
    contract.cruiseAltitudeFt, contract.cruiseAltFt, state.cruiseAltitudeFt, state.cruiseAltFt, state.altMapInput]
    .find(value => value != null && value !== '' && Number.isFinite(Number(value)) && Number(value) > 0);
  const plan = { schema: 'ga.flightplan-export.v1', missionId: run.missionId, runId: run.runId, navigationRevision,
    departureIcao: String(context.departureIcao || state.currentStartICAO || state.mDepICAO || points[0].icao || '').toUpperCase(),
    destinationIcao: String(context.destinationIcao || state.currentDestICAO || state.mDestICAO || points[points.length - 1].icao || '').toUpperCase(),
    cruiseAltitudeFt: altitude == null ? null : Number(altitude), isVfr: true, points };
  return { ...plan, routeHash: crypto.createHash('sha256').update(JSON.stringify(plan)).digest('hex') };
}
module.exports = { createFlightPlanExport };
