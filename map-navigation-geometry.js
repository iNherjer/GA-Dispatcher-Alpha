/* Shared local navigation projection; no mission transitions. */
(function(root, factory) {
  if(typeof module === 'object' && module.exports) module.exports=factory();
  else root.GAMapNavigationGeometry=factory();
})(typeof window !== 'undefined' ? window : null, function() {
  const EARTH_RADIUS_NM = 3440.065;
  function finite(value) { const n=Number(value); return Number.isFinite(n)?n:null; }
function radians(value) {
  return value * Math.PI / 180;
}

function degrees(value) {
  return value * 180 / Math.PI;
}

function normalizeHeading(value) {
  const number = finite(value);
  return number === null ? null : ((number % 360) + 360) % 360;
}

function distanceNm(a, b) {
  const lat1 = radians(Number(a.lat));
  const lat2 = radians(Number(b.lat));
  const dLat = lat2 - lat1;
  const dLon = radians(Number(b.lon) - Number(a.lon));
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_NM * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
}

function bearingDeg(a, b) {
  const lat1 = radians(Number(a.lat));
  const lat2 = radians(Number(b.lat));
  const dLon = radians(Number(b.lon) - Number(a.lon));
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return normalizeHeading(degrees(Math.atan2(y, x))) || 0;
}

function buildLegs(waypoints) {
  const legs = [];
  let cumulativeNm = 0;
  for (let index = 0; index < waypoints.length - 1; index += 1) {
    const from = waypoints[index];
    const to = waypoints[index + 1];
    const legDistanceNm = distanceNm(from, to);
    const startDistanceNm = cumulativeNm;
    cumulativeNm += legDistanceNm;
    legs.push({
      index,
      fromId: from.id,
      toId: to.id,
      distanceNm: Math.round(legDistanceNm * 100) / 100,
      courseDeg: Math.round(bearingDeg(from, to)),
      startDistanceNm: Math.round(startDistanceNm * 100) / 100,
      endDistanceNm: Math.round(cumulativeNm * 100) / 100
    });
  }
  return legs;
}

function projectPointToLegNm(position, a, b) {
  const refLat = radians((Number(a.lat) + Number(b.lat) + Number(position.lat)) / 3);
  const scaleX = Math.max(0.01, Math.cos(refLat)) * 60;
  const ax = Number(a.lon) * scaleX;
  const ay = Number(a.lat) * 60;
  const bx = Number(b.lon) * scaleX;
  const by = Number(b.lat) * 60;
  const px = Number(position.lon) * scaleX;
  const py = Number(position.lat) * 60;
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;
  const fraction = lengthSquared > 0 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSquared)) : 0;
  const closestX = ax + dx * fraction;
  const closestY = ay + dy * fraction;
  return {
    fraction,
    distanceNm: Math.hypot(px - closestX, py - closestY)
  };
}

function calcNav(lat1, lon1, lat2, lon2) {
    const R = 3440, dLat = (lat2 - lat1) * Math.PI / 180, dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const dist = Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
    const y = Math.sin(dLon) * Math.cos(lat2 * Math.PI / 180), x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) - Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos(dLon);
    return { dist, brng: Math.round((Math.atan2(y, x) * 180 / Math.PI + 360) % 360) };
}

function selectWaypoint(position, routeWaypoints, state = {}, advance = true) {
  if (!position || !Number.isFinite(position.lat) || !Number.isFinite(position.lon) || routeWaypoints.length < 2) return null;
  const lat = position.lat, lon = position.lon;
  let liveNextRouteKey = state.routeKey || '', liveNextLegIndex = state.legIndex || 0;
  let liveActiveWpIndex = state.selectedIndex == null ? null : state.selectedIndex;
  function clampLiveWpIndex(index) { return Math.max(0, Math.min(Number(index) || 0, routeWaypoints.length - 1)); }
  function routeKeyForLiveNav() {
      if (typeof routeWaypoints === 'undefined' || !Array.isArray(routeWaypoints) || routeWaypoints.length < 2) return '';
      return routeWaypoints.map((wp, i) => `${i}:${(wp.lat || 0).toFixed(4)},${((wp.lng || wp.lon) || 0).toFixed(4)}`).join('|');
  }
  function legDistanceToSegmentNm(lat, lon, a, b) {
      const refLat = (a.lat + b.lat + lat) / 3;
      const cosRef = Math.cos(refLat * Math.PI / 180);

      const ax = (a.lng || a.lon) * cosRef * 60;
      const ay = a.lat * 60;
      const bx = (b.lng || b.lon) * cosRef * 60;
      const by = b.lat * 60;
      const px = lon * cosRef * 60;
      const py = lat * 60;

      const abx = bx - ax, aby = by - ay;
      const apx = px - ax, apy = py - ay;
      const denom = abx * abx + aby * aby;
      const t = denom > 0 ? Math.max(0, Math.min(1, (apx * abx + apy * aby) / denom)) : 0;
      const cx = ax + t * abx, cy = ay + t * aby;
      return Math.hypot(px - cx, py - cy);
  }
  function nearestLegIndexBySegment(lat, lon) {
      if (typeof routeWaypoints === 'undefined' || !Array.isArray(routeWaypoints) || routeWaypoints.length < 2) return 0;
      let bestIdx = 0;
      let bestDist = Infinity;
      for (let i = 0; i < routeWaypoints.length - 1; i++) {
          const d = legDistanceToSegmentNm(lat, lon, routeWaypoints[i], routeWaypoints[i + 1]);
          if (d < bestDist) {
              bestDist = d;
              bestIdx = i;
          }
      }
      return bestIdx;
  }
  const key = routeKeyForLiveNav();
  const routeChanged = key !== liveNextRouteKey;
  if (routeChanged) { liveNextLegIndex = nearestLegIndexBySegment(lat, lon); liveActiveWpIndex = null; }
  const maxLeg = routeWaypoints.length - 2, maxWp = routeWaypoints.length - 1;
  let legIdx = Math.max(0, Math.min(liveNextLegIndex, maxLeg));
  let wpIdx = liveActiveWpIndex == null ? Math.min(legIdx + 1, maxWp) : clampLiveWpIndex(liveActiveWpIndex);
  const target = routeWaypoints[wpIdx];
  const navToTarget = calcNav(lat, lon, target.lat, target.lng || target.lon);
  let inboundBrng = navToTarget.brng;
  if (wpIdx > 0) {
    const prev = routeWaypoints[wpIdx - 1];
    inboundBrng = calcNav(prev.lat, prev.lng || prev.lon, target.lat, target.lng || target.lon).brng;
  }
  const angleDiffRad = ((navToTarget.brng - inboundBrng + 540) % 360 - 180) * Math.PI / 180;
  const alongTrack = navToTarget.dist * Math.cos(angleDiffRad);
  const crossTrack = Math.abs(navToTarget.dist * Math.sin(angleDiffRad));
  let advanced = false, automaticAdvance = false;
  if ((advance || routeChanged) && alongTrack <= 0.5 && alongTrack >= -0.5 && crossTrack <= 2.5 && wpIdx < maxWp) {
    advanced = true; automaticAdvance = liveActiveWpIndex == null;
    wpIdx += 1;
    if (liveActiveWpIndex == null) legIdx = Math.max(0, wpIdx - 1);
    else liveActiveWpIndex = wpIdx;
  }
  const wp = routeWaypoints[wpIdx];
  const nav = calcNav(lat, lon, wp.lat, wp.lng ?? wp.lon);
  let xteNm = 0;
  if (wpIdx > 0) {
    const prevWp = routeWaypoints[wpIdx - 1];
    const fromPrev = calcNav(prevWp.lat, prevWp.lng || prevWp.lon, lat, lon);
    const R = 3440.065;
    const diffRad = (fromPrev.brng - inboundBrng) * Math.PI / 180;
    xteNm = Math.asin(Math.sin(fromPrev.dist / R) * Math.sin(diffRad)) * R;
  }
  return { routeKey:key, routeChanged, legIndex:legIdx, selectedIndex:liveActiveWpIndex,
    wpIdx, inboundBrng, brng:nav.brng, dist:nav.dist, xteNm, advanced, automaticAdvance };
}

function buildNavigation(position, waypoints, legs, state = {}) {
  const lat = finite(position?.lat);
  const lon = finite(position?.lon);
  if (lat === null || lon === null || !legs.length) return null;
  const aircraft = { lat, lon };
  const now = Number(position.capturedAt) || Date.now();
  const advance = !state.lastAdvanceAt || now - state.lastAdvanceAt > 1000;
  const selection = selectWaypoint(aircraft, waypoints, state, advance);
  if (!selection) return null;
  if (advance || selection.routeChanged) state.lastAdvanceAt = now;
  Object.assign(state, selection);
  const leg = legs[selection.legIndex];
  const best = {leg, projection:projectPointToLegNm(aircraft, waypoints[leg.index], waypoints[leg.index + 1])};
  const routeDistanceNm = best.leg.startDistanceNm + best.leg.distanceNm * best.projection.fraction;
  const totalDistanceNm = legs[legs.length - 1].endDistanceNm;
  const target = waypoints[selection.wpIdx];
  let remainingDistanceNm = selection.dist;
  for (let index = selection.wpIdx; index < waypoints.length - 1; index += 1) {
    remainingDistanceNm += calcNav(waypoints[index].lat, waypoints[index].lon, waypoints[index + 1].lat, waypoints[index + 1].lon).dist;
  }
  return {
    activeLegIndex: best.leg.index,
    nextWaypointId: target.id,
    nextWaypointName: target.name,
    bearingToNextDeg: selection.brng,
    selectedWaypointIndex: selection.wpIdx,
    manualWaypointIndex: selection.selectedIndex,
    inboundBearingDeg: selection.inboundBrng,
    distanceToNextNm: selection.dist,
    crossTrackNm: selection.xteNm,
    routeDistanceNm: Math.round(routeDistanceNm * 100) / 100,
    remainingDistanceNm: Math.round(remainingDistanceNm * 100) / 100,
    progress: totalDistanceNm > 0 ? Math.round(Math.max(0, Math.min(1, routeDistanceNm / totalDistanceNm)) * 10000) / 10000 : 0
  };
}

return {distanceNm, bearingDeg, calcNav, selectWaypoint, buildLegs, buildNavigation};
});
