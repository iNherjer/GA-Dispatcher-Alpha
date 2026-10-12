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
    return { route: route, warnings: warnings };
  }
  function matches(expected, actual) {
    if (!actual || actual.__Type !== 'JS_FlightPlanRoute' || actual.isVfr !== expected.isVfr) return false;
    function sameIcao(a, b) { return a && b && ['type', 'region', 'airport', 'ident'].every(function(key) { return a[key] === b[key]; }); }
    if (!sameIcao(actual.departureAirport, expected.departureAirport)
      || !sameIcao(actual.destinationAirport, expected.destinationAirport)) return false;
    if (!Array.isArray(actual.enroute) || actual.enroute.length !== expected.enroute.length) return false;
    return expected.enroute.every(function(leg, index) { var other = actual.enroute[index];
      return other && other.hasLatLon === true && Math.abs(other.lat - leg.lat) < 0.00001 && Math.abs(other.lon - leg.lon) < 0.00001;
    }) && (expected.cruiseAltitude === null || actual.cruiseAltitude && actual.cruiseAltitude.isFlightLevel === false
      && Math.abs(actual.cruiseAltitude.altitude - expected.cruiseAltitude.altitude) < 1);
  }
  function create(options) {
    var jobs = new Map(), busy = false;
    var timeoutMs = options.timeoutMs || 8000;
    function log(stage, data) { try { if (options.log) options.log(stage, data); } catch (_) {} }
    function execute(job) {
      if (!job || !job.jobId || !['msfs', 'avionics'].includes(job.target)) return Promise.resolve({ ok: false, error: 'flightplan_request_invalid' });
      var fingerprint = JSON.stringify(job);
      var previous = jobs.get(job.jobId);
      if (previous) return previous.fingerprint === fingerprint ? previous.promise : Promise.resolve({ ok: false, error: 'flightplan_job_conflict' });
      if (busy) return Promise.resolve({ ok: false, error: 'flightplan_busy' });
      busy = true;
      var cancelled = false;
      var result = { jobId: job.jobId, routeHash: job.plan && job.plan.routeHash, msfs: 'pending', avionics: job.target === 'avionics' ? 'pending' : 'not_requested' };
      function step(stage, operation) {
        if (cancelled || options.isActive && !options.isActive() || options.isCurrent && !options.isCurrent(job)) throw new Error('flightplan_host_closed');
        result.stage = stage;
        var started = Date.now(); log(stage + ':start', result);
        return deadline(operation, timeoutMs).then(function(value) { log(stage + ':done', Object.assign({}, result, { durationMs: Date.now() - started })); return value; });
      }
      var promise = Promise.resolve().then(async function() {
        log('begin', { jobId: job.jobId, target: job.target, missionId: job.plan && job.plan.missionId, runId: job.plan && job.plan.runId, routeHash: result.routeHash });
        var built = await step('convert', function() { return buildRoute(job.plan, options.resolveAirport); });
        result.warnings = built.warnings;
        var manager = await step('manager', options.getManager);
        await step('save_efb', function() { return manager.saveEfbRoute(built.route); }); result.msfs = 'saved';
        await step('send_efb', function() { return manager.sendRouteToEfb(built.route); }); result.msfs = 'sent';
        var readback = await step('read_efb', function() { return manager.getEfbRoute(); });
        if (!matches(built.route, readback)) throw new Error('flightplan_readback_mismatch');
        result.msfs = 'confirmed';
        if (job.target === 'avionics') {
          await step('send_avionics', function() { return manager.sendRouteToAvionics(built.route); }); result.avionics = 'sent';
        }
        return Object.assign(result, { ok: true });
      }).catch(function(error) {
        cancelled = true; result.error = String(error && error.message || error).slice(0, 180);
        if (result.msfs === 'pending') result.msfs = result.error === 'flightplan_timeout' && result.stage === 'save_efb' ? 'unconfirmed' : 'failed';
        if (result.avionics === 'pending') result.avionics = result.error === 'flightplan_timeout' && result.stage === 'send_avionics' ? 'unconfirmed' : 'not_sent';
        return Object.assign(result, { ok: false });
      }).then(function(value) { busy = value.error === 'flightplan_timeout'; log('result', value); return value; });
      jobs.set(job.jobId, { fingerprint: fingerprint, promise: promise, cancel: function() { cancelled = true; } });
      if (jobs.size > 128) jobs.delete(jobs.keys().next().value);
      return promise;
    }
    return { execute: execute, cancel: function(jobId) { var job = jobs.get(jobId); if (job) job.cancel(); } };
  }
  return { create: create, buildRoute: buildRoute, matches: matches, deadline: deadline };
});
