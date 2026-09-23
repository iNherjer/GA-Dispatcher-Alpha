// Freeflight is navigation and briefing only; never an execution recipe.
(function(root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./map-route-edit-core') : root.GAMapRouteEditCore);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.GAFreeflightNavigationCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function(routes) {
  'use strict';
  const SCHEMA = 'ga.freeflight-navigation.v1';
  function normalize(value) {
    if (!value || value.schema !== SCHEMA || value.version !== 1) throw new Error('freeflight_schema_invalid');
    const points = routes.normalize(value.points);
    const result = { schema: SCHEMA, version: 1, planId: String(value.planId || ''), points,
      departureIcao: String(value.departureIcao || ''), destinationIcao: String(value.destinationIcao || ''),
      briefing: { title: String(value.briefing?.title || 'Freiflug'), story: String(value.briefing?.story || '') } };
    if (result.planId.length > 180 || result.departureIcao.length > 12 || result.destinationIcao.length > 12
        || result.briefing.title.length > 1024 || result.briefing.story.length > 32768
        || encodeURIComponent(JSON.stringify(result)).replace(/%[A-F0-9]{2}/g, 'x').length > 65536)
      throw new Error('freeflight_size_limit');
    return result;
  }
  function build(state) {
    if (!state || typeof state !== 'object') return null;
    const md = state.currentMissionData || state;
    if (!(md.freeflightOnly === true || md.routeOnly === true || md.noMissionRuntime === true
      || md._appliedProfile === 'freeflight_planning' || md._requestedProfile === 'freeflight_planning')) return null;
    return normalize({ schema: SCHEMA, version: 1, planId: md.freeflightPlanId || md.missionId || md.id || '', points: state.routeWaypoints || md.routeWaypoints,
      departureIcao: state.currentStartICAO || md.start, destinationIcao: state.currentDestICAO || md.dest,
      briefing: { title: md.mission || md.title || 'Freiflug', story: state.mStory || md.missionStory || md.s || '' } });
  }
  function toState(value) {
    const nav = normalize(value);
    const escape = text => text.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    return { currentMissionData: { freeflightPlanId: nav.planId, mission: nav.briefing.title, s: nav.briefing.story,
        freeflightOnly: true, routeOnly: true, noMissionRuntime: true, directToEfbOnly: false,
        taskDomain: 'freeflight_planning', _appliedProfile: 'freeflight_planning',
        start: nav.departureIcao, dest: nav.destinationIcao, routeWaypoints: nav.points },
      routeWaypoints: nav.points, missionRouteWaypoints: nav.points,
      currentStartICAO: nav.departureIcao, currentDestICAO: nav.destinationIcao,
      currentSName: nav.points[0].name || nav.departureIcao, currentDName: nav.points.at(-1).name || nav.destinationIcao,
      mTitle: escape(nav.briefing.title), mStory: nav.briefing.story, mPay: '-', mWeight: '-',
      isPOI: nav.points.some(p => p.isPOI), destIcon: nav.points.some(p => p.isPOI) ? '📍' : '✈',
      mDepName: nav.points[0].name || nav.departureIcao, mDestName: nav.points.at(-1).name || nav.destinationIcao,
      mDepCoords: nav.points[0].lat + ', ' + nav.points[0].lon,
      mDestCoords: nav.points.at(-1).lat + ', ' + nav.points.at(-1).lon,
      mDistNote: '', mHeadingNote: '', mETENote: '',
      mDepICAO: nav.departureIcao, mDestICAO: nav.destinationIcao, activePassenger: null, activeMissionContract: null };
  }
  return { SCHEMA, normalize, build, toState };
});
