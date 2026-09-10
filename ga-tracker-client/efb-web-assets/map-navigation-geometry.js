// Generated from map-navigation-geometry.js by sync-efb-web-assets.js. Do not edit.
/* Shared local navigation projection; no mission transitions. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();else root.GAMapNavigationGeometry = factory();
})(typeof window !== 'undefined' ? window : null, function () {
  var EARTH_RADIUS_NM = 3440.065;
  function finite(value) {
    var n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  function radians(value) {
    return value * Math.PI / 180;
  }
  function degrees(value) {
    return value * 180 / Math.PI;
  }
  function normalizeHeading(value) {
    var number = finite(value);
    return number === null ? null : (number % 360 + 360) % 360;
  }
  function distanceNm(a, b) {
    var lat1 = radians(Number(a.lat));
    var lat2 = radians(Number(b.lat));
    var dLat = lat2 - lat1;
    var dLon = radians(Number(b.lon) - Number(a.lon));
    var h = Math.pow(Math.sin(dLat / 2), 2) + Math.cos(lat1) * Math.cos(lat2) * Math.pow(Math.sin(dLon / 2), 2);
    return EARTH_RADIUS_NM * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
  }
  function bearingDeg(a, b) {
    var lat1 = radians(Number(a.lat));
    var lat2 = radians(Number(b.lat));
    var dLon = radians(Number(b.lon) - Number(a.lon));
    var y = Math.sin(dLon) * Math.cos(lat2);
    var x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
    return normalizeHeading(degrees(Math.atan2(y, x))) || 0;
  }
  function buildLegs(waypoints) {
    var legs = [];
    var cumulativeNm = 0;
    for (var index = 0; index < waypoints.length - 1; index += 1) {
      var from = waypoints[index];
      var to = waypoints[index + 1];
      var legDistanceNm = distanceNm(from, to);
      var startDistanceNm = cumulativeNm;
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
    var refLat = radians((Number(a.lat) + Number(b.lat) + Number(position.lat)) / 3);
    var scaleX = Math.max(0.01, Math.cos(refLat)) * 60;
    var ax = Number(a.lon) * scaleX;
    var ay = Number(a.lat) * 60;
    var bx = Number(b.lon) * scaleX;
    var by = Number(b.lat) * 60;
    var px = Number(position.lon) * scaleX;
    var py = Number(position.lat) * 60;
    var dx = bx - ax;
    var dy = by - ay;
    var lengthSquared = dx * dx + dy * dy;
    var fraction = lengthSquared > 0 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSquared)) : 0;
    var closestX = ax + dx * fraction;
    var closestY = ay + dy * fraction;
    return {
      fraction,
      distanceNm: Math.hypot(px - closestX, py - closestY)
    };
  }
  function calcNav(lat1, lon1, lat2, lon2) {
    var R = 3440,
      dLat = (lat2 - lat1) * Math.PI / 180,
      dLon = (lon2 - lon1) * Math.PI / 180;
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    var dist = Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
    var y = Math.sin(dLon) * Math.cos(lat2 * Math.PI / 180),
      x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) - Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos(dLon);
    return {
      dist,
      brng: Math.round((Math.atan2(y, x) * 180 / Math.PI + 360) % 360)
    };
  }
  function selectWaypoint(position, routeWaypoints) {
    var _wp$lng;
    var state = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
    var advance = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : true;
    if (!position || !Number.isFinite(position.lat) || !Number.isFinite(position.lon) || routeWaypoints.length < 2) return null;
    var lat = position.lat,
      lon = position.lon;
    var liveNextRouteKey = state.routeKey || '',
      liveNextLegIndex = state.legIndex || 0;
    var liveActiveWpIndex = state.selectedIndex == null ? null : state.selectedIndex;
    function clampLiveWpIndex(index) {
      return Math.max(0, Math.min(Number(index) || 0, routeWaypoints.length - 1));
    }
    function routeKeyForLiveNav() {
      if (typeof routeWaypoints === 'undefined' || !Array.isArray(routeWaypoints) || routeWaypoints.length < 2) return '';
      return routeWaypoints.map((wp, i) => `${i}:${(wp.lat || 0).toFixed(4)},${(wp.lng || wp.lon || 0).toFixed(4)}`).join('|');
    }
    function legDistanceToSegmentNm(lat, lon, a, b) {
      var refLat = (a.lat + b.lat + lat) / 3;
      var cosRef = Math.cos(refLat * Math.PI / 180);
      var ax = (a.lng || a.lon) * cosRef * 60;
      var ay = a.lat * 60;
      var bx = (b.lng || b.lon) * cosRef * 60;
      var by = b.lat * 60;
      var px = lon * cosRef * 60;
      var py = lat * 60;
      var abx = bx - ax,
        aby = by - ay;
      var apx = px - ax,
        apy = py - ay;
      var denom = abx * abx + aby * aby;
      var t = denom > 0 ? Math.max(0, Math.min(1, (apx * abx + apy * aby) / denom)) : 0;
      var cx = ax + t * abx,
        cy = ay + t * aby;
      return Math.hypot(px - cx, py - cy);
    }
    function nearestLegIndexBySegment(lat, lon) {
      if (typeof routeWaypoints === 'undefined' || !Array.isArray(routeWaypoints) || routeWaypoints.length < 2) return 0;
      var bestIdx = 0;
      var bestDist = Infinity;
      for (var i = 0; i < routeWaypoints.length - 1; i++) {
        var d = legDistanceToSegmentNm(lat, lon, routeWaypoints[i], routeWaypoints[i + 1]);
        if (d < bestDist) {
          bestDist = d;
          bestIdx = i;
        }
      }
      return bestIdx;
    }
    var key = routeKeyForLiveNav();
    var routeChanged = key !== liveNextRouteKey;
    if (routeChanged) {
      liveNextLegIndex = nearestLegIndexBySegment(lat, lon);
      liveActiveWpIndex = null;
    }
    var maxLeg = routeWaypoints.length - 2,
      maxWp = routeWaypoints.length - 1;
    var legIdx = Math.max(0, Math.min(liveNextLegIndex, maxLeg));
    var wpIdx = liveActiveWpIndex == null ? Math.min(legIdx + 1, maxWp) : clampLiveWpIndex(liveActiveWpIndex);
    var target = routeWaypoints[wpIdx];
    var navToTarget = calcNav(lat, lon, target.lat, target.lng || target.lon);
    var inboundBrng = navToTarget.brng;
    if (wpIdx > 0) {
      var prev = routeWaypoints[wpIdx - 1];
      inboundBrng = calcNav(prev.lat, prev.lng || prev.lon, target.lat, target.lng || target.lon).brng;
    }
    var angleDiffRad = ((navToTarget.brng - inboundBrng + 540) % 360 - 180) * Math.PI / 180;
    var alongTrack = navToTarget.dist * Math.cos(angleDiffRad);
    var crossTrack = Math.abs(navToTarget.dist * Math.sin(angleDiffRad));
    var advanced = false,
      automaticAdvance = false;
    if ((advance || routeChanged) && alongTrack <= 0.5 && alongTrack >= -0.5 && crossTrack <= 2.5 && wpIdx < maxWp) {
      advanced = true;
      automaticAdvance = liveActiveWpIndex == null;
      wpIdx += 1;
      if (liveActiveWpIndex == null) legIdx = Math.max(0, wpIdx - 1);else liveActiveWpIndex = wpIdx;
    }
    var wp = routeWaypoints[wpIdx];
    var nav = calcNav(lat, lon, wp.lat, (_wp$lng = wp.lng) !== null && _wp$lng !== void 0 ? _wp$lng : wp.lon);
    var xteNm = 0;
    if (wpIdx > 0) {
      var prevWp = routeWaypoints[wpIdx - 1];
      var fromPrev = calcNav(prevWp.lat, prevWp.lng || prevWp.lon, lat, lon);
      var R = 3440.065;
      var diffRad = (fromPrev.brng - inboundBrng) * Math.PI / 180;
      xteNm = Math.asin(Math.sin(fromPrev.dist / R) * Math.sin(diffRad)) * R;
    }
    return {
      routeKey: key,
      routeChanged,
      legIndex: legIdx,
      selectedIndex: liveActiveWpIndex,
      wpIdx,
      inboundBrng,
      brng: nav.brng,
      dist: nav.dist,
      xteNm,
      advanced,
      automaticAdvance
    };
  }
  function buildNavigation(position, waypoints, legs) {
    var state = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : {};
    var lat = finite(position === null || position === void 0 ? void 0 : position.lat);
    var lon = finite(position === null || position === void 0 ? void 0 : position.lon);
    if (lat === null || lon === null || !legs.length) return null;
    var aircraft = {
      lat,
      lon
    };
    var now = Number(position.capturedAt) || Date.now();
    var advance = !state.lastAdvanceAt || now - state.lastAdvanceAt > 1000;
    var selection = selectWaypoint(aircraft, waypoints, state, advance);
    if (!selection) return null;
    if (advance || selection.routeChanged) state.lastAdvanceAt = now;
    Object.assign(state, selection);
    var leg = legs[selection.legIndex];
    var best = {
      leg,
      projection: projectPointToLegNm(aircraft, waypoints[leg.index], waypoints[leg.index + 1])
    };
    var routeDistanceNm = best.leg.startDistanceNm + best.leg.distanceNm * best.projection.fraction;
    var totalDistanceNm = legs[legs.length - 1].endDistanceNm;
    var target = waypoints[selection.wpIdx];
    var remainingDistanceNm = selection.dist;
    for (var index = selection.wpIdx; index < waypoints.length - 1; index += 1) {
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
  return {
    distanceNm,
    bearingDeg,
    calcNav,
    selectWaypoint,
    buildLegs,
    buildNavigation
  };
});
