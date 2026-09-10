'use strict';

const MAP_SNAPSHOT_SCHEMA = 'ga.map-snapshot.v1';
const MAP_SNAPSHOT_VERSION = 1;
const MAX_ROUTE_WAYPOINTS = 128;
const MAX_CHAIN_POINTS = 96;
const MAX_PROFILE_POINTS = 128;
const MAX_PROFILE_OBSTACLES = 64;
const MAX_PROFILE_AIRSPACES = 48;
const { distanceNm, bearingDeg, buildLegs, buildNavigation } = require('../map-navigation-geometry.js');

function object(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function cleanText(value, maxLength = 100) {
  return String(value || '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, maxLength);
}

function waypointElevationFt(value) {
  const source = object(value);
  return finite(source.elevationFt ?? source.elevFt ?? source.altitudeFt ?? source.altFt ?? source.elevation);
}

function normalizeWaypoint(value, index) {
  const source = object(value);
  const lat = finite(source.lat ?? source.latitude);
  const lon = finite(source.lon ?? source.lng ?? source.longitude);
  if (lat === null || lon === null || lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  return {
    id: cleanText(source.id || source.ref || `wp-${index + 1}`, 80),
    name: cleanText(source.name || source.label || source.icao || source.ident || `WP ${index + 1}`, 100),
    lat,
    lon,
    elevationFt: waypointElevationFt(source),
    kind: cleanText(source.kind || source.type || (source.isPOI ? 'poi' : 'waypoint'), 40).toLowerCase(),
    ...(typeof source.icao === 'string' ? { icao: source.icao.slice(0, 12) } : {}),
    ...(typeof source.rppAirportIcao === 'string' ? { rppAirportIcao: source.rppAirportIcao.slice(0, 12) } : {}),
    ...(source.isPOI === true ? { isPOI: true } : {}),
    ...(source.isPoiChainEndpoint === true ? { isPoiChainEndpoint: true } : {}),
    ...(source.isPoiChainReturnHome === true ? { isPoiChainReturnHome: true } : {}),
    required: source.required !== false
  };
}

function missionDataFromRun(activeRun) {
  const bundle = object(activeRun?.resumeBundle);
  const state = object(bundle.missionState);
  const mission = object(state.currentMissionData || state.activeMissionContract || state);
  const contract = object(mission.missionContract || state.activeMissionContract);
  return { bundle, state, mission, contract, navigationRoute: activeRun.navigationRoute };
}

function routeCandidates(parts) {
  const { state, mission, contract } = parts;
  return [
    parts.navigationRoute?.points,
    mission.routeWaypoints,
    mission.missionRouteWaypoints,
    state.routeWaypoints,
    state.missionRouteWaypoints,
    contract.routeWaypoints,
    contract.missionRouteWaypoints
  ];
}

function normalizeRoute(parts) {
  const raw = routeCandidates(parts).find(value => Array.isArray(value) && value.length >= 2) || [];
  const result = [];
  for (const value of raw.slice(0, MAX_ROUTE_WAYPOINTS)) {
    const point = normalizeWaypoint(value, result.length);
    if (!point) continue;
    const previous = result[result.length - 1];
    if (previous && distanceNm(previous, point) < 0.002) continue;
    result.push(point);
  }
  return result;
}

function plannedCruiseAltitudeFt(parts, flight) {
  const { state, mission, contract } = parts;
  const candidates = [
    mission.cruiseAltitudeFt, mission.cruiseAltFt, mission.cruiseAltitude, mission.altitude,
    contract.cruiseAltitudeFt, contract.cruiseAltFt, contract.altitude,
    state.cruiseAltitudeFt, state.cruiseAltFt, state.altMapInput
  ];
  const selected = candidates.map(finite).find(value => value !== null && value > 0);
  const liveAltitude = finite(flight?.alt ?? flight?.altFt);
  return Math.round(selected || liveAltitude || 3500);
}

function normalizeTerrainProfile(parts, routeTotalDistanceNm) {
  const source = object(parts.navigationRoute ? null : parts.bundle.mapProfile);
  const rawPoints = Array.isArray(source.points) ? source.points.slice(0, MAX_PROFILE_POINTS) : [];
  const points = [];
  let cumulativeNm = 0;
  for (const rawPoint of rawPoints) {
    const point = object(rawPoint);
    const lat = finite(point.lat ?? point.latitude);
    const lon = finite(point.lon ?? point.lng ?? point.longitude);
    const terrainFt = finite(point.elevFt ?? point.terrainFt ?? point.elevationFt);
    if (lat === null || lon === null || terrainFt === null || lat < -90 || lat > 90 || lon < -180 || lon > 180) continue;
    const previous = points[points.length - 1];
    const explicitDistance = finite(point.distNM ?? point.distanceNm);
    if (previous) cumulativeNm += distanceNm(previous, { lat, lon });
    let distanceAlongNm = explicitDistance === null ? cumulativeNm : Math.max(0, explicitDistance);
    if (previous && distanceAlongNm < previous.distanceNm) distanceAlongNm = previous.distanceNm;
    points.push({ lat, lon, terrainFt: Math.round(terrainFt), distanceNm: distanceAlongNm });
  }
  if (points.length < 2) return [];
  const sourceTotal = finite(source.totalDistanceNm) || points[points.length - 1].distanceNm;
  const targetTotal = routeTotalDistanceNm > 0 ? routeTotalDistanceNm : sourceTotal;
  const scale = sourceTotal > 0 && targetTotal > 0 ? targetTotal / sourceTotal : 1;
  return points.map(point => ({
    lat: point.lat,
    lon: point.lon,
    terrainFt: point.terrainFt,
    distanceNm: Math.round(point.distanceNm * scale * 100) / 100
  }));
}

function normalizeProfileObstacles(parts, routeTotalDistanceNm) {
  const source = object(parts.navigationRoute ? null : parts.bundle.mapProfile);
  const result = [];
  for (const value of (Array.isArray(source.obstacles) ? source.obstacles : []).slice(0, MAX_PROFILE_OBSTACLES)) {
    const item = object(value);
    const distanceAlongNm = finite(item.distanceNm ?? item.distNM);
    const heightFt = finite(item.heightFt ?? item.hFt);
    if (distanceAlongNm === null || heightFt === null || heightFt <= 0) continue;
    result.push({
      distanceNm: Math.round(Math.max(0, Math.min(routeTotalDistanceNm, distanceAlongNm)) * 100) / 100,
      heightFt: Math.round(Math.min(10000, heightFt)),
      type: cleanText(item.type || 'obstacle', 24).toLowerCase() || 'obstacle'
    });
  }
  return result;
}

function normalizeProfileAirspaces(parts, routeTotalDistanceNm) {
  const source = object(parts.navigationRoute ? null : parts.bundle.mapProfile);
  const result = [];
  for (const value of (Array.isArray(source.airspaces) ? source.airspaces : []).slice(0, MAX_PROFILE_AIRSPACES)) {
    const item = object(value);
    const startDistanceNm = finite(item.startDistanceNm ?? item.asMinDist);
    const endDistanceNm = finite(item.endDistanceNm ?? item.asMaxDist);
    const lowerFt = finite(item.lowerFt);
    const upperFt = finite(item.upperFt);
    if (startDistanceNm === null || endDistanceNm === null || lowerFt === null || upperFt === null || endDistanceNm <= startDistanceNm) continue;
    const color = /^#[0-9a-f]{3,8}$/i.test(String(item.color || '')) ? String(item.color) : '#4da6ff';
    result.push({
      name: cleanText(item.name || 'Luftraum', 80),
      type: finite(item.type),
      startDistanceNm: Math.round(Math.max(0, Math.min(routeTotalDistanceNm, startDistanceNm)) * 100) / 100,
      endDistanceNm: Math.round(Math.max(0, Math.min(routeTotalDistanceNm, endDistanceNm)) * 100) / 100,
      lowerFt: Math.round(Math.max(0, lowerFt)),
      upperFt: Math.round(Math.max(lowerFt, upperFt)),
      lowerAgl: item.lowerAgl === true,
      upperAgl: item.upperAgl === true,
      color,
      frequencies: (Array.isArray(item.frequencies) ? item.frequencies : []).map(entry => cleanText(entry, 20)).filter(Boolean).slice(0, 3)
    });
  }
  return result.filter(item => item.endDistanceNm > item.startDistanceNm);
}

function normalizeMapContext(parts) {
  const source = object(object(parts.bundle.mapProfile).context);
  return {
    theme: ['classic', 'retro', 'navcom', 'ops1940', 'win95'].includes(source.theme) ? source.theme : null,
    departureIcao: cleanText(source.departureIcao || parts.state.currentStartICAO || parts.state.mDepICAO, 20),
    destinationIcao: cleanText(source.destinationIcao || parts.state.currentDestICAO || parts.state.mDestICAO, 20),
    tasKts: finite(source.tasKts),
    profileCruiseFt: finite(source.profileCruiseFt),
    profileClimbFpm: finite(source.profileClimbFpm),
    profileDescentFpm: finite(source.profileDescentFpm),
    position: cleanText(source.position, 60),
    currentPosition: cleanText(source.currentPosition, 100),
    waypointLabels: (Array.isArray(source.waypointLabels) ? source.waypointLabels : []).slice(0, 128)
      .filter(item => item && Number.isFinite(item.lat) && Number.isFinite(item.lon))
      .map(item => ({ lat: item.lat, lon: item.lon, name: cleanText(item.name, 100), frequency: cleanText(item.frequency, 100) })),
    frequency: cleanText(source.frequency, 40),
    frequencySource: cleanText(source.frequencySource, 80)
  };
}

function plannedAltitudeAtDistance(distanceNm, totalDistanceNm, cruiseAltitudeFt, waypoints) {
  const progress = totalDistanceNm > 0 ? Math.max(0, Math.min(1, distanceNm / totalDistanceNm)) : 0;
  const startElevation = waypoints[0].elevationFt ?? cruiseAltitudeFt;
  const endElevation = waypoints[waypoints.length - 1].elevationFt ?? cruiseAltitudeFt;
  if (progress < 0.18) return startElevation + (cruiseAltitudeFt - startElevation) * (progress / 0.18);
  if (progress > 0.78) return cruiseAltitudeFt + (endElevation - cruiseAltitudeFt) * ((progress - 0.78) / 0.22);
  return cruiseAltitudeFt;
}

function buildProfile(parts, waypoints, legs, flight) {
  if (!waypoints.length || !legs.length) return null;
  const totalDistanceNm = legs[legs.length - 1].endDistanceNm;
  const cruiseAltitudeFt = plannedCruiseAltitudeFt(parts, flight);
  const obstacles = normalizeProfileObstacles(parts, totalDistanceNm);
  const airspaces = normalizeProfileAirspaces(parts, totalDistanceNm);
  const terrainProfile = normalizeTerrainProfile(parts, totalDistanceNm);
  if (terrainProfile.length >= 2) {
    const profilePoints = terrainProfile.map(point => ({
      waypointId: '',
      name: '',
      lat: point.lat,
      lon: point.lon,
      distanceNm: point.distanceNm,
      terrainFt: point.terrainFt,
      plannedAltFt: Math.max(0, Math.round(plannedAltitudeAtDistance(
        point.distanceNm,
        totalDistanceNm,
        cruiseAltitudeFt,
        waypoints
      )))
    }));
    waypoints.forEach((waypoint, index) => {
      const waypointDistanceNm = index === 0 ? 0 : legs[index - 1].endDistanceNm;
      let nearestIndex = 0;
      let nearestDelta = Infinity;
      profilePoints.forEach((point, pointIndex) => {
        const delta = Math.abs(point.distanceNm - waypointDistanceNm);
        if (delta < nearestDelta) {
          nearestIndex = pointIndex;
          nearestDelta = delta;
        }
      });
      profilePoints[nearestIndex].waypointId = waypoint.id;
      profilePoints[nearestIndex].name = waypoint.name;
    });
    return {
      mode: 'tracker-terrain',
      terrainAvailable: true,
      totalDistanceNm,
      cruiseAltitudeFt,
      obstacles,
      airspaces,
      points: profilePoints
    };
  }
  const profilePoints = waypoints.map((waypoint, index) => {
    const distanceAlongNm = index === 0 ? 0 : legs[index - 1].endDistanceNm;
    const progress = totalDistanceNm > 0 ? distanceAlongNm / totalDistanceNm : 0;
    const endpointAltitude = waypoint.elevationFt;
    let plannedAltFt = cruiseAltitudeFt;
    if (index === 0 && endpointAltitude !== null) plannedAltFt = endpointAltitude;
    else if (index === waypoints.length - 1 && endpointAltitude !== null) plannedAltFt = endpointAltitude;
    else if (progress < 0.18) {
      const start = waypoints[0].elevationFt ?? Math.min(cruiseAltitudeFt, finite(flight?.alt) || cruiseAltitudeFt);
      plannedAltFt = start + (cruiseAltitudeFt - start) * (progress / 0.18);
    } else if (progress > 0.78) {
      const end = waypoints[waypoints.length - 1].elevationFt ?? cruiseAltitudeFt;
      plannedAltFt = cruiseAltitudeFt + (end - cruiseAltitudeFt) * ((progress - 0.78) / 0.22);
    }
    return {
      waypointId: waypoint.id,
      name: waypoint.name,
      lat: waypoint.lat,
      lon: waypoint.lon,
      distanceNm: Math.round(distanceAlongNm * 100) / 100,
      terrainFt: endpointAltitude === null ? null : Math.round(endpointAltitude),
      plannedAltFt: Math.max(0, Math.round(plannedAltFt))
    };
  });
  return {
    mode: profilePoints.some(point => point.terrainFt !== null) ? 'planned-with-endpoint-elevation' : 'planned-only',
    terrainAvailable: false,
    totalDistanceNm,
    cruiseAltitudeFt,
    obstacles,
    airspaces,
    points: profilePoints
  };
}

function normalizePoiChain(parts) {
  const source = object(parts.mission.poiChain || parts.contract.poiChain);
  const points = (Array.isArray(source.points) ? source.points : [])
    .slice(0, MAX_CHAIN_POINTS)
    .map((value, index) => normalizeWaypoint(value, index))
    .filter(Boolean);
  return points.length ? points : [];
}

function normalizeTarget(parts) {
  const mission = parts.mission;
  const lat = finite(mission.targetLat ?? mission.poiLat ?? mission.target?.lat);
  const lon = finite(mission.targetLon ?? mission.poiLon ?? mission.target?.lon ?? mission.target?.lng);
  if (lat === null || lon === null || lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  return {
    id: 'mission-target',
    name: cleanText(mission.targetName || mission.poiName || mission.target?.name || 'Missionsziel', 100),
    lat,
    lon,
    kind: cleanText(mission.category || mission.taskDomain || 'mission-target', 40).toLowerCase()
  };
}

function projectTrackerMapSnapshot(activeRun, flightSnapshot = null, options = {}) {
  if (!activeRun?.missionId || !activeRun?.runId || !activeRun?.resumeBundle) return null;
  const parts = missionDataFromRun(activeRun);
  return projectRouteParts(parts, activeRun, flightSnapshot, options);
}

function projectTrackerNavigationSnapshot(route, flightSnapshot, options = {}) {
  if (!route) return null;
  const state = { routeWaypoints: route.points, currentStartICAO: route.departureIcao, currentDestICAO: route.destinationIcao };
  const parts = { state, bundle: {}, mission: {}, contract: {} };
  const result = projectRouteParts(parts, route, flightSnapshot, options);
  return result && { ...result, routeId: route.id, navigationOnly: true };
}

function projectRouteParts(parts, activeRun, flightSnapshot, options = {}) {
  const waypoints = normalizeRoute(parts);
  if (waypoints.length < 2) return null;
  const legs = buildLegs(waypoints);
  const flight = object(flightSnapshot);
  const navigation = buildNavigation(flight, waypoints, legs, options.navigationState);
  return {
    schema: MAP_SNAPSHOT_SCHEMA,
    version: MAP_SNAPSHOT_VERSION,
    missionId: cleanText(activeRun.missionId, 180),
    runId: cleanText(activeRun.runId, 220),
    revision: Math.max(1, Math.round(Number(activeRun.revision) || 1)),
    updatedAt: Number(activeRun.updatedAt || options.now || Date.now()),
    route: {
      totalDistanceNm: legs.length ? legs[legs.length - 1].endDistanceNm : 0,
      waypoints,
      legs
    },
    navigation,
    context: normalizeMapContext(parts),
    profile: buildProfile(parts, waypoints, legs, flight),
    missionGeometry: {
      target: normalizeTarget(parts),
      poiChain: normalizePoiChain(parts)
    }
  };
}

module.exports = {
  MAP_SNAPSHOT_SCHEMA,
  MAP_SNAPSHOT_VERSION,
  bearingDeg,
  buildLegs,
  buildNavigation,
  distanceNm,
  normalizeRoute,
  projectTrackerMapSnapshot,
  projectTrackerNavigationSnapshot
};
