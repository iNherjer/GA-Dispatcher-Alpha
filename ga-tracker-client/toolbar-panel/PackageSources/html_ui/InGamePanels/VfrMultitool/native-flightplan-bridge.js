(function(root, factory) {
  var core = typeof module === 'object' && module.exports ? require('./flightplan-bridge-core') : root.GAFlightPlanBridgeCore;
  var api = factory(core);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.GANativeFlightPlanBridge = api;
})(typeof window !== 'undefined' ? window : null, function(Core) {
  'use strict';
  function create(options) {
    let managerPromise = null;
    let facilityLoader = null;
    let ready = false;
    let atcReady = false;
    let uncertain = false;
    const jobChannels = new Map();
    // Avionics route: no getter exists. REQUEST_AVIONICS_ROUTE returns a request ID,
    // the aircraft answers with 'AvionicsRouteRequestResponse' (route, requestId).
    // Avionics that do not answer may still have pushed 'AvionicsRouteSync'.
    let syncedAvionicsRoute = null;
    let avionicsEvents = false;
    const avionicsWaiters = new Map();
    const avionicsResponses = new Map();
    const getManager = () => {
      if (!managerPromise) managerPromise = new Promise((resolve, reject) => {
        try {
          const listener = options.registerViewListener('JS_LISTENER_PLANNEDROUTE', () => {
            if (typeof listener.on === 'function') {
              avionicsEvents = true;
              listener.on('AvionicsRouteSync', (route) => { syncedAvionicsRoute = route || null; });
              listener.on('AvionicsRouteRequestResponse', (route, requestId) => {
                const waiter = avionicsWaiters.get(requestId);
                if (waiter) { avionicsWaiters.delete(requestId); waiter(route); return; }
                avionicsResponses.set(requestId, route);
                if (avionicsResponses.size > 16) avionicsResponses.delete(avionicsResponses.keys().next().value);
              });
            }
            const readAvionicsRoute = (timeoutMs) => new Promise((resolveRoute, rejectRoute) => {
              let requestId = null;
              const timer = setTimeout(() => {
                if (requestId !== null) avionicsWaiters.delete(requestId);
                if (syncedAvionicsRoute) resolveRoute({ route: syncedAvionicsRoute, via: 'sync' });
                else rejectRoute(new Error('flightplan_avionics_no_reply'));
              }, timeoutMs);
              Promise.resolve(listener.call('REQUEST_AVIONICS_ROUTE')).then((id) => {
                requestId = id;
                const done = (route) => { clearTimeout(timer); resolveRoute({ route, via: 'request' }); };
                if (avionicsResponses.has(id)) { const early = avionicsResponses.get(id); avionicsResponses.delete(id); done(early); return; }
                avionicsWaiters.set(id, done);
              }).catch((error) => { clearTimeout(timer); rejectRoute(error); });
            });
            const manager = {
              readAvionicsRoute: avionicsEvents ? readAvionicsRoute : undefined,
              saveEfbRoute: (route) => listener.call('SAVE_EFB_ROUTE', route),
              sendRouteToEfb: (route) => listener.call('SEND_ROUTE_TO_EFB', route),
              sendRouteToAvionics: (route) => listener.call('SEND_ROUTE_TO_AVIONICS', route),
              getEfbRoute: () => listener.call('GET_EFB_ROUTE'),
              fileRouteWithAtc: (route) => listener.call('FILE_ROUTE_WITH_ATC', route),
              getAtcRoute: () => listener.call('GET_ATC_ROUTE')
            };
            resolve(manager);
          });
        } catch (error) { reject(error); }
      });
      return managerPromise;
    };
    const resolveAirport = async (ident, point) => {
      if (!facilityLoader) facilityLoader = new options.sdk.FacilityLoader(options.sdk.FacilityRepository.getRepository(new options.sdk.EventBus()));
      const facilities = await facilityLoader.findNearestFacilitiesByIdent(options.sdk.FacilitySearchType.Airport, ident, point.lat, point.lon, 10);
      const found = facilities.find((facility) => {
        const value = facility.icaoStruct || options.sdk.ICAO.stringV1ToValue(facility.icao);
        return value.ident === ident && Math.abs(facility.lat - point.lat) < 0.1 && Math.abs(facility.lon - point.lon) < 0.1;
      });
      return found ? (found.icaoStruct || options.sdk.ICAO.stringV1ToValue(found.icao)) : null;
    };
    const facilityTypeByLetter = { A: 'Airport', V: 'VOR', N: 'NDB', W: 'Intersection', U: 'USR', R: 'RWY', S: 'VIS' };
    // Coordinates of a fix (airport, VOR, NDB, intersection) from the simulator database.
    const resolveFacility = async (icao) => {
      const sdk = options.sdk;
      if (!facilityLoader) facilityLoader = new sdk.FacilityLoader(sdk.FacilityRepository.getRepository(new sdk.EventBus()));
      let type = null;
      if (sdk.ICAO && typeof sdk.ICAO.getFacilityTypeFromValue === 'function') {
        try { type = sdk.ICAO.getFacilityTypeFromValue(icao); } catch (_) { type = null; }
      }
      if (!type && sdk.FacilityType) type = sdk.FacilityType[facilityTypeByLetter[String(icao.type || '')] || ''] || null;
      if (!type) return null;
      const facility = await facilityLoader.getFacility(type, icao);
      return facility ? { lat: facility.lat, lon: facility.lon } : null;
    };
    const hasFacilities = !!(options.sdk && options.sdk.FacilityLoader && options.sdk.FacilityRepository && options.sdk.EventBus);
    const bridge = Core.create({ getManager, resolveAirport: options.sdk && options.sdk.FacilityLoader ? resolveAirport : undefined, isActive: options.isActive,
      resolveFacility: hasFacilities ? resolveFacility : undefined,
      avionicsTimeoutMs: options.avionicsTimeoutMs,
      isCurrent: (job) => jobChannels.get(job.jobId) === options.getChannel(),
      log: (stage, data) => options.log(stage, data) });
    // Reading routes (EFB 0.4.28+): old packages never send these flags.
    const fetchCaps = () => ({ fetch: true, avionicsFetch: avionicsEvents, facilities: hasFacilities });
    const send = (channel, message) => {
      const frame = options.getFrame();
      if (options.isActive() && options.getChannel() === channel && frame && frame.contentWindow) {
        frame.contentWindow.postMessage(Object.assign({}, message, {channel}), options.trackerOrigin);
      }
    };
    return { handle(event) {
      const data = event.data || {};
      if (!['ga-flightplan-probe', 'ga-flightplan-send', 'ga-flightplan-cancel', 'ga-flightplan-fetch'].includes(data.type)) return false;
      const channel = options.getChannel();
      const frameElement = options.getFrame();
      const frame = frameElement && frameElement.contentWindow;
      const trustedSource = event.source != null
        ? event.source === frame && (!event.origin || event.origin === options.trackerOrigin || event.origin === 'null')
        : event.origin === options.trackerOrigin;
      if (!channel || data.channel !== channel || !frame || !options.isActive()
        || !trustedSource) return true;
      if (data.type === 'ga-flightplan-cancel') { bridge.cancel(data.jobId); return true; }
      if (data.type === 'ga-flightplan-fetch') {
        const job = data.job || {};
        if (!ready || uncertain) {
          send(channel, {type:'ga-flightplan-fetched', result:{ok:false, jobId:job.jobId, source:job.source, error:'flightplan_host_unavailable'}});
          return true;
        }
        void bridge.fetchRoute(job).then((result) => send(channel, {type:'ga-flightplan-fetched', result}));
        return true;
      }
      if (data.type === 'ga-flightplan-probe') {
        if (uncertain) { send(channel, Object.assign({type:'ga-flightplan-capabilities', host:options.host, ready:false}, fetchCaps())); return true; }
        void Core.deadline(async () => { const manager = await getManager(); const route = await manager.getEfbRoute();
          return !!route && route.__Type === 'JS_FlightPlanRoute'; }, 5000).then((available) => {
          ready = available; send(channel, Object.assign({type:'ga-flightplan-capabilities', host:options.host, ready, atcReady:ready && atcReady}, fetchCaps()));
          if (ready) void Core.deadline(async () => { const manager = await getManager(); return manager.getAtcRoute(); }, 2000).then((route) => {
            atcReady = !!route && route.__Type === 'JS_FlightPlanRoute';
            send(channel, Object.assign({type:'ga-flightplan-capabilities', host:options.host, ready, atcReady}, fetchCaps()));
          }).catch(() => { atcReady = false; send(channel, Object.assign({type:'ga-flightplan-capabilities', host:options.host, ready, atcReady:false}, fetchCaps())); });
        }).catch((error) => {
          ready = false; atcReady = false; send(channel, Object.assign({type:'ga-flightplan-capabilities', host:options.host, ready:false}, fetchCaps()));
          options.log('probe-failed', String(error));
        });
        return true;
      }
      if (!ready || uncertain || data.job && data.job.target === 'atc' && !atcReady) {
        send(channel, {type:'ga-flightplan-result', result:{ok:false, jobId:data.job && data.job.jobId, routeHash:data.job && data.job.plan && data.job.plan.routeHash, error:'flightplan_host_unavailable'}});
        return true;
      }
      if (data.job && data.job.jobId && !jobChannels.has(data.job.jobId)) {
        jobChannels.set(data.job.jobId, channel);
        if (jobChannels.size > 128) jobChannels.delete(jobChannels.keys().next().value);
      }
      void bridge.execute(data.job).then((result) => {
        if (result.error === 'flightplan_timeout') { uncertain = true; ready = false; }
        send(channel, {type:'ga-flightplan-result', result});
      });
      return true;
    } };

  }
  return {create:create};
});
