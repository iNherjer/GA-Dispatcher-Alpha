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
    const getManager = () => {
      if (!managerPromise) managerPromise = new Promise((resolve, reject) => {
        try {
          const listener = options.registerViewListener('JS_LISTENER_PLANNEDROUTE', () => {
            const manager = {
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
    const bridge = Core.create({ getManager, resolveAirport: options.sdk && options.sdk.FacilityLoader ? resolveAirport : undefined, isActive: options.isActive,
      isCurrent: (job) => jobChannels.get(job.jobId) === options.getChannel(),
      log: (stage, data) => options.log(stage, data) });
    const send = (channel, message) => {
      const frame = options.getFrame();
      if (options.isActive() && options.getChannel() === channel && frame && frame.contentWindow) {
        frame.contentWindow.postMessage(Object.assign({}, message, {channel}), options.trackerOrigin);
      }
    };
    return { handle(event) {
      const data = event.data || {};
      if (!['ga-flightplan-probe', 'ga-flightplan-send', 'ga-flightplan-cancel'].includes(data.type)) return false;
      const channel = options.getChannel();
      const frameElement = options.getFrame();
      const frame = frameElement && frameElement.contentWindow;
      const trustedSource = event.source != null
        ? event.source === frame && (!event.origin || event.origin === options.trackerOrigin || event.origin === 'null')
        : event.origin === options.trackerOrigin;
      if (!channel || data.channel !== channel || !frame || !options.isActive()
        || !trustedSource) return true;
      if (data.type === 'ga-flightplan-cancel') { bridge.cancel(data.jobId); return true; }
      if (data.type === 'ga-flightplan-probe') {
        if (uncertain) { send(channel, {type:'ga-flightplan-capabilities', host:options.host, ready:false}); return true; }
        void Core.deadline(async () => { const manager = await getManager(); const route = await manager.getEfbRoute();
          return !!route && route.__Type === 'JS_FlightPlanRoute'; }, 5000).then((available) => {
          ready = available; send(channel, {type:'ga-flightplan-capabilities', host:options.host, ready, atcReady:ready && atcReady});
          if (ready) void Core.deadline(async () => { const manager = await getManager(); return manager.getAtcRoute(); }, 2000).then((route) => {
            atcReady = !!route && route.__Type === 'JS_FlightPlanRoute';
            send(channel, {type:'ga-flightplan-capabilities', host:options.host, ready, atcReady});
          }).catch(() => { atcReady = false; send(channel, {type:'ga-flightplan-capabilities', host:options.host, ready, atcReady:false}); });
        }).catch((error) => {
          ready = false; atcReady = false; send(channel, {type:'ga-flightplan-capabilities', host:options.host, ready:false});
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
