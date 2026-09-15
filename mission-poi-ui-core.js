// POI presentation composes the shared cargo/signature/action UI with the
// original POI lifecycle status, confirmed by the tracker authority.
(function(root, factory) {
    const api = factory(typeof module === 'object' && module.exports
        ? require('./mission-apt-ui-core.js') : root.GAMissionAptUiCore);
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.GAMissionPoiUiCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function(shared) {
    'use strict';
    function bannerModel(source = {}) {
        const control = source.control || source;
        const model = shared.bannerModel(source);
        const status = control.poiStatus;
        if (model && control.recipe === 'poi') {
            if (model.intent === 'request_close') model.text = status?.detail || 'Du stehst am Boden. Die Mission kann hier beendet werden.';
            if (model.kind === 'debrief') model.text = control.poiOutcome?.failed
                ? 'Mission mit Fehlschlag abgeschlossen.' : 'Mission abgeschlossen.';
            // An airborne POI task is not a ground pickup action.
            if (control.phase === 'on_task' && !control.flags?.groundStill) return null;
        }
        return model;
    }
    function project(source) {
        return { ...shared.project(source), schema: 'ga.mission-poi-ui.v1', banner: bannerModel(source) };
    }
    return Object.freeze({ ...shared, UI_SCHEMA: 'ga.mission-poi-ui.v1', bannerModel, project });
});
