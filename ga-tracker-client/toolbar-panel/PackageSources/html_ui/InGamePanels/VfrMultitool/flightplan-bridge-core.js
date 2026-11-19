(function(root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.GAFlightPlanBridgeCore = api;
})(typeof window !== 'undefined' ? window : null, function() {
  'use strict';
  function deadline(operation, ms) {
    var timer;
    var timeout = new Promise(function(resolve, reject) { timer = setTimeout(function() { reject(new Error('flightplan_timeout')); }, ms); });
    return Promise.race([Promise.resolve().then(operation), timeout]).then(function(value) { clearTimeout(timer); return value; }, function(error) { clearTimeout(timer); throw error; });
  }
  function emptyIcao() { return { __Type: 'JS_ICAO', type: '', region: '', airport: '', ident: '' }; }
  function runway() { return { __Type: 'JS_RunwayIdentifier', number: '', designator: '' }; }
  function pattern() { return { __Type: 'JS_VfrPatternProcedure', type: '', isLeftTraffic: true, distance: 0, altitude: 0 }; }
  function validPoint(point) { return point && typeof point.lat === 'number' && typeof point.lon === 'number'
    && isFinite(point.lat) && isFinite(point.lon) && Math.abs(point.lat) <= 90 && Math.abs(point.lon) <= 180; }
  async function buildRoute(plan, resolveAirport) {
    if (!plan || plan.schema !== 'ga.flightplan-export.v1' || !Array.isArray(plan.points) || plan.points.length < 2
      || plan.points.length > 512 || !plan.points.every(validPoint)) throw new Error('flightplan_route_invalid');
    var departure = null, destination = null, warnings = [];
    async function airport(ident, point) {
      if (!ident || ident === 'GPS') return null;
      if (typeof resolveAirport !== 'function') { warnings.push('airport_resolution_unavailable:' + ident); return null; }
      var found = await resolveAirport(ident, point);
      if (!found) warnings.push('airport_coordinate_fallback:' + ident);
      return found;
    }
    departure = await airport(plan.departureIcao, plan.points[0]);
    destination = await airport(plan.destinationIcao, plan.points[plan.points.length - 1]);
    var points = plan.points.slice(departure ? 1 : 0, destination ? -1 : undefined);
    var route = { __Type: 'JS_FlightPlanRoute', departureAirport: departure || emptyIcao(), destinationAirport: destination || emptyIcao(),
      departureRunway: runway(), destinationRunway: runway(), departure: '', departureTransition: '', departureVfrPattern: pattern(),
      arrival: '', arrivalTransition: '', approach: { __Type: 'JS_ApproachIdentifier', type: '', runway: runway(), suffix: '' },
      approachTransition: '', approachVfrPattern: pattern(), isVfr: true,
      cruiseAltitude: plan.cruiseAltitudeFt != null && isFinite(plan.cruiseAltitudeFt) && plan.cruiseAltitudeFt > 0
        ? { __Type: 'JS_FlightAltitude', altitude: plan.cruiseAltitudeFt, isFlightLevel: false } : null,
      enroute: points.map(function(point, index) { return { __Type: 'JS_EnrouteLeg', fixIcao: emptyIcao(), via: '', isPpos: false,
        hasLatLon: true, lat: point.lat, lon: point.lon, hasPointBearingDistance: false, referenceIcao: emptyIcao(),
        bearing: 0, distance: 0, altitude: null, name: String(point.name || 'WP' + (index + 1)).slice(0, 100) }; }) };
    return { route: route, warnings: warnings, points: points };
  }
  // ATC variant (since about 31.10.2026 the simulator ATC drops anonymous lat/lon legs and
  // returns only departure and destination): airports in the route as real airport fixes,
  // every other point as a user waypoint with a unique ident (WP01, WP02, ...).
  // The EFB planner and the avionics keep the plain route above, which they accept.
  function airportIdentOf(point) {
    var icao = String(point && point.icao || '').trim().toUpperCase();
    if (/^[A-Z]{2}[A-Z0-9]{2}$/.test(icao)) return icao;
    var match = /^APT\s+([A-Z]{2}[A-Z0-9]{2})\b/.exec(String(point && point.name || '').trim().toUpperCase());
    return match ? match[1] : '';
  }
  async function buildAtcRoute(built, resolveAirport) {
    var legs = [], number = 0;
    for (var index = 0; index < built.points.length; index++) {
      var point = built.points[index], leg = built.route.enroute[index];
      var ident = airportIdentOf(point), found = null;
      if (ident && typeof resolveAirport === 'function') { try { found = await resolveAirport(ident, point); } catch (_) { found = null; } }
      if (found) {
        legs.push(Object.assign({}, leg, { fixIcao: found, hasLatLon: false, lat: 0, lon: 0 }));
        continue;
      }
      number += 1;
      legs.push(Object.assign({}, leg, { fixIcao: { __Type: 'JS_ICAO', type: 'U', region: '', airport: '', ident: 'WP' + (number < 10 ? '0' : '') + number } }));
    }
    return Object.assign({}, built.route, { enroute: legs });
  }
  function matchesAtc(expected, actual) {
    if (!actual || actual.__Type !== 'JS_FlightPlanRoute' || actual.isVfr !== expected.isVfr) return false;
    if (!Array.isArray(actual.enroute) || actual.enroute.length !== expected.enroute.length) return false;
    return expected.enroute.every(function(leg, index) {
      var other = actual.enroute[index];
      if (!other) return false;
      if (leg.hasLatLon !== true) return !!(other.fixIcao && leg.fixIcao && other.fixIcao.ident === leg.fixIcao.ident);
      return other.hasLatLon === true ? Math.abs(other.lat - leg.lat) < POINT_TOLERANCE_DEG && Math.abs(other.lon - leg.lon) < POINT_TOLERANCE_DEG
        : !!(other.fixIcao && other.fixIcao.ident === leg.fixIcao.ident);
    });
  }
  var POINT_TOLERANCE_DEG = 0.0005;
  var ATC_READ_TIMEOUT_MS = 15000;
  var ATC_READ_ATTEMPTS = 20; // 250 ms apart: up to about 5 s for longer routes
  // Short description of a route the simulator returned, for the log on a mismatch.
  function describeRoute(route) {
    if (!route || route.__Type !== 'JS_FlightPlanRoute') return { type: route ? String(route.__Type || typeof route) : 'none' };
    function ident(icao) { return icao && icao.ident ? String(icao.ident) : ''; }
    var legs = Array.isArray(route.enroute) ? route.enroute : [];
    return { dep: ident(route.departureAirport), dest: ident(route.destinationAirport), isVfr: route.isVfr === true,
      count: legs.length, legs: legs.slice(0, 16).map(function(leg) {
        return [String(leg && leg.name || '').slice(0, 24), leg && leg.hasLatLon === true ? Math.round(leg.lat * 10000) / 10000 : null,
          leg && leg.hasLatLon === true ? Math.round(leg.lon * 10000) / 10000 : null, ident(leg && leg.fixIcao)];
      }) };
  }
  function matches(expected, actual) {
    if (!actual || actual.__Type !== 'JS_FlightPlanRoute' || actual.isVfr !== expected.isVfr) return false;
    function sameIcao(a, b) { return a && b && ['type', 'region', 'airport', 'ident'].every(function(key) { return a[key] === b[key]; }); }
    if (!sameIcao(actual.departureAirport, expected.departureAirport)
      || !sameIcao(actual.destinationAirport, expected.destinationAirport)) return false;
    if (!Array.isArray(actual.enroute) || actual.enroute.length !== expected.enroute.length) return false;
    return expected.enroute.every(function(leg, index) { var other = actual.enroute[index];
      // About 50 m: the simulator may round coordinates (ATC readback since 01.11.2026).
      return other && other.hasLatLon === true && Math.abs(other.lat - leg.lat) < POINT_TOLERANCE_DEG && Math.abs(other.lon - leg.lon) < POINT_TOLERANCE_DEG;
    }) && (expected.cruiseAltitude === null || actual.cruiseAltitude && actual.cruiseAltitude.isFlightLevel === false
      && Math.abs(actual.cruiseAltitude.altitude - expected.cruiseAltitude.altitude) < 1);
  }
  // ---- Reading a simulator route (EFB planner, ATC or avionics) ----
  var IMPORT_SOURCES = ['efb', 'atc', 'avionics'];
  var IMPORT_MAX_POINTS = 128; // limit of the navigation route
  var EARTH_RADIUS_NM = 3440.065;
  function identOf(icao) { return icao && icao.ident ? String(icao.ident).trim().toUpperCase() : ''; }
  // Point at a true bearing and distance (nm) from a reference (great circle).
  function destinationPoint(lat, lon, bearingDeg, distanceNm) {
    var rad = Math.PI / 180, d = distanceNm / EARTH_RADIUS_NM, b = bearingDeg * rad;
    var lat1 = lat * rad, lon1 = lon * rad;
    var lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(b));
    var lon2 = lon1 + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(lat2));
    return { lat: lat2 / rad, lon: ((lon2 / rad + 540) % 360) - 180 };
  }
  function validCoordinate(lat, lon) {
    return typeof lat === 'number' && typeof lon === 'number' && isFinite(lat) && isFinite(lon)
      && Math.abs(lat) <= 90 && Math.abs(lon) <= 180 && !(lat === 0 && lon === 0);
  }
  function routeIsEmpty(route) {
    return !identOf(route.departureAirport) && !identOf(route.destinationAirport)
      && !(Array.isArray(route.enroute) && route.enroute.length);
  }
  // Converts a JS_FlightPlanRoute into the navigation route format. Fixes without
  // coordinates are looked up in the simulator's facility database. Procedures
  // (SID/STAR/approach) and airways are not expanded: they become warnings and a
  // direct line to the next fix.
  async function parseRoute(route, resolveFacility, source) {
    if (!route || route.__Type !== 'JS_FlightPlanRoute' || routeIsEmpty(route)) throw new Error('flightplan_import_empty');
    var points = [], warnings = [];
    async function locate(icao) {
      if (!identOf(icao)) return null;
      if (typeof resolveFacility !== 'function') { if (warnings.indexOf('facility_lookup_unavailable') < 0) warnings.push('facility_lookup_unavailable'); return null; }
      try {
        var found = await resolveFacility(icao);
        return found && validCoordinate(found.lat, found.lon) ? found : null;
      } catch (_) { return null; }
    }
    function push(lat, lon, name, icao) {
      if (!validCoordinate(lat, lon)) return false;
      var last = points[points.length - 1];
      if (last && Math.abs(last.lat - lat) < 1e-6 && Math.abs(last.lon - lon) < 1e-6) return true;
      points.push({ lat: lat, lon: lon, name: String(name || 'WP' + (points.length + 1)).slice(0, 100), icao: icao || '' });
      return true;
    }
    async function airport(icao) {
      var ident = identOf(icao);
      if (!ident) return '';
      var found = await locate(icao);
      if (!found || !push(found.lat, found.lon, ident, ident)) warnings.push('airport_unresolved:' + ident);
      return ident;
    }
    var departureIcao = await airport(route.departureAirport);
    if (route.departure) warnings.push('procedure_skipped:SID ' + String(route.departure).slice(0, 12));
    var legs = Array.isArray(route.enroute) ? route.enroute : [];
    for (var index = 0; index < legs.length; index++) {
      var leg = legs[index] || {}, ident = identOf(leg.fixIcao);
      var name = String(leg.name || ident || 'WP' + (index + 1));
      if (leg.isPpos === true) { warnings.push('ppos_skipped'); continue; }
      if (leg.via) warnings.push('airway_direct:' + String(leg.via).slice(0, 8));
      if (leg.hasLatLon === true) {
        if (!push(leg.lat, leg.lon, name, '')) warnings.push('point_invalid:' + name.slice(0, 24));
        continue;
      }
      if (leg.hasPointBearingDistance === true) {
        var reference = await locate(leg.referenceIcao);
        var at = reference && destinationPoint(reference.lat, reference.lon, Number(leg.bearing) || 0, Number(leg.distance) || 0);
        if (!at || !push(at.lat, at.lon, name, '')) warnings.push('fix_unresolved:' + (identOf(leg.referenceIcao) || name).slice(0, 24));
        continue;
      }
      var fix = await locate(leg.fixIcao);
      var isAirport = leg.fixIcao && String(leg.fixIcao.type || '') === 'A';
      if (!fix || !push(fix.lat, fix.lon, ident || name, isAirport ? ident : '')) warnings.push('fix_unresolved:' + (ident || name).slice(0, 24));
    }
    if (route.arrival) warnings.push('procedure_skipped:STAR ' + String(route.arrival).slice(0, 12));
    if (route.approach && route.approach.type) warnings.push('procedure_skipped:APPROACH');
    var destinationIcao = await airport(route.destinationAirport);
    if (points.length < 2) throw new Error(warnings.length ? 'flightplan_import_unresolved' : 'flightplan_import_empty');
    if (points.length > IMPORT_MAX_POINTS) throw new Error('flightplan_import_too_long');
    var altitude = route.cruiseAltitude && typeof route.cruiseAltitude.altitude === 'number' && route.cruiseAltitude.altitude > 0
      ? Math.round(route.cruiseAltitude.altitude) : null;
    return { plan: { schema: 'ga.flightplan-import.v1', source: source, departureIcao: departureIcao, destinationIcao: destinationIcao,
      isVfr: route.isVfr === true, cruiseAltitudeFt: altitude, points: points }, warnings: warnings };
  }

  function create(options) {
    var jobs = new Map(), busy = false, fetching = false;
    var timeoutMs = options.timeoutMs || 8000;
    function log(stage, data) { try { if (options.log) options.log(stage, data); } catch (_) {} }
    function execute(job) {
      if (!job || !job.jobId || !['msfs', 'avionics', 'atc'].includes(job.target)) return Promise.resolve({ ok: false, error: 'flightplan_request_invalid' });
      var fingerprint = JSON.stringify(job);
      var previous = jobs.get(job.jobId);
      if (previous) return previous.fingerprint === fingerprint ? previous.promise : Promise.resolve({ ok: false, error: 'flightplan_job_conflict' });
      if (busy) return Promise.resolve({ ok: false, error: 'flightplan_busy' });
      busy = true;
      var cancelled = false;
      var result = { jobId: job.jobId, routeHash: job.plan && job.plan.routeHash, msfs: 'pending', atc: job.target === 'atc' ? 'pending' : 'not_requested', avionics: job.target === 'avionics' ? 'pending' : 'not_requested' };
      function step(stage, operation, stepTimeoutMs) {
        if (cancelled || options.isActive && !options.isActive() || options.isCurrent && !options.isCurrent(job)) throw new Error('flightplan_host_closed');
        result.stage = stage;
        var started = Date.now(); log(stage + ':start', result);
        return deadline(operation, stepTimeoutMs || timeoutMs).then(function(value) { log(stage + ':done', Object.assign({}, result, { durationMs: Date.now() - started })); return value; });
      }
      var promise = Promise.resolve().then(async function() {
        log('begin', { jobId: job.jobId, target: job.target, missionId: job.plan && job.plan.missionId, runId: job.plan && job.plan.runId, routeHash: result.routeHash });
        var built = await step('convert', function() { return buildRoute(job.plan, options.resolveAirport); });
        result.warnings = built.warnings;
        var manager = await step('manager', options.getManager);
        if (job.target === 'atc' && (typeof manager.fileRouteWithAtc !== 'function' || typeof manager.getAtcRoute !== 'function')) throw new Error('flightplan_atc_unavailable');
        await step('save_efb', function() { return manager.saveEfbRoute(built.route); }); result.msfs = 'saved';
        await step('send_efb', function() { return manager.sendRouteToEfb(built.route); }); result.msfs = 'sent';
        var readback = await step('read_efb', function() { return manager.getEfbRoute(); });
        if (!matches(built.route, readback)) throw new Error('flightplan_readback_mismatch');
        result.msfs = 'confirmed';
        if (job.target === 'atc') {
          var atcRoute = await step('convert_atc', function() { return buildAtcRoute(built, options.resolveAirport); });
          await step('file_atc', function() { return manager.fileRouteWithAtc(atcRoute); }); result.atc = 'sent';
          var lastAtcRoute = null;
          await step('read_atc', async function() {
            for (var attempt = 0; attempt < ATC_READ_ATTEMPTS; attempt++) {
              if (cancelled || options.isActive && !options.isActive() || options.isCurrent && !options.isCurrent(job)) throw new Error('flightplan_host_closed');
              lastAtcRoute = await manager.getAtcRoute();
              if (matchesAtc(atcRoute, lastAtcRoute)) return;
              if (attempt < ATC_READ_ATTEMPTS - 1) await new Promise(function(resolve) { setTimeout(resolve, 250); });
            }
            // What the simulator made of the route, so the next field report shows the change.
            result.atcReadback = { expectedCount: atcRoute.enroute.length, sent: describeRoute(atcRoute), got: describeRoute(lastAtcRoute) };
            throw new Error('flightplan_atc_readback_mismatch');
          }, ATC_READ_TIMEOUT_MS); result.atc = 'confirmed';
        }
        if (job.target === 'avionics') {
          await step('send_avionics', function() { return manager.sendRouteToAvionics(built.route); }); result.avionics = 'sent';
        }
        return Object.assign(result, { ok: true });
      }).catch(function(error) {
        cancelled = true; result.error = String(error && error.message || error).slice(0, 180);
        if (result.msfs === 'pending') result.msfs = result.error === 'flightplan_timeout' && result.stage === 'save_efb' ? 'unconfirmed' : 'failed';
        if (job.target === 'atc' && result.atc !== 'confirmed') result.atc = result.stage === 'file_atc' && result.error === 'flightplan_timeout' || result.stage === 'read_atc' ? 'unconfirmed' : result.atc === 'sent' ? 'unconfirmed' : 'not_sent';
        if (result.avionics === 'pending') result.avionics = result.error === 'flightplan_timeout' && result.stage === 'send_avionics' ? 'unconfirmed' : 'not_sent';
        return Object.assign(result, { ok: false });
      }).then(function(value) { busy = value.error === 'flightplan_timeout'; log('result', value); return value; });
      jobs.set(job.jobId, { fingerprint: fingerprint, promise: promise, cancel: function() { cancelled = true; } });
      if (jobs.size > 128) jobs.delete(jobs.keys().next().value);
      return promise;
    }
    // Reads one simulator route. Read-only: never writes to the simulator.
    function fetchRoute(job) {
      if (!job || !job.jobId || IMPORT_SOURCES.indexOf(job.source) < 0) return Promise.resolve({ ok: false, jobId: job && job.jobId, error: 'flightplan_request_invalid' });
      if (fetching) return Promise.resolve({ ok: false, jobId: job.jobId, source: job.source, error: 'flightplan_busy' });
      fetching = true;
      var result = { jobId: job.jobId, source: job.source };
      var started = Date.now();
      log('fetch:start', result);
      return Promise.resolve().then(async function() {
        var manager = await deadline(options.getManager, timeoutMs);
        var route;
        if (job.source === 'efb') route = await deadline(function() { return manager.getEfbRoute(); }, timeoutMs);
        else if (job.source === 'atc') {
          if (typeof manager.getAtcRoute !== 'function') throw new Error('flightplan_atc_unavailable');
          route = await deadline(function() { return manager.getAtcRoute(); }, timeoutMs);
        } else {
          if (typeof manager.readAvionicsRoute !== 'function') throw new Error('flightplan_avionics_unavailable');
          var avionics = await manager.readAvionicsRoute(options.avionicsTimeoutMs || 6000);
          route = avionics.route;
          if (avionics.via) result.via = avionics.via;
        }
        result.received = describeRoute(route);
        var parsed = await parseRoute(route, options.resolveFacility, job.source);
        return Object.assign(result, { ok: true, plan: parsed.plan, warnings: parsed.warnings });
      }).catch(function(error) {
        return Object.assign(result, { ok: false, error: String(error && error.message || error).slice(0, 180) });
      }).then(function(value) {
        fetching = false;
        log('fetch:result', Object.assign({}, value, { plan: value.plan ? { points: value.plan.points.length, departureIcao: value.plan.departureIcao, destinationIcao: value.plan.destinationIcao } : undefined, durationMs: Date.now() - started }));
        return value;
      });
    }
    return { execute: execute, fetchRoute: fetchRoute, cancel: function(jobId) { var job = jobs.get(jobId); if (job) job.cancel(); } };
  }
  return { create: create, buildRoute: buildRoute, buildAtcRoute: buildAtcRoute, matches: matches, matchesAtc: matchesAtc, deadline: deadline,
    parseRoute: parseRoute, destinationPoint: destinationPoint };
});
