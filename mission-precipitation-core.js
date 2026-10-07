// Generated from passenger-voice.js by tools/generate-mission-precipitation-core.mjs. Do not edit.
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.GAMissionPrecipitationCore=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
function _precipitationObservation(fd) {
    fd = fd && typeof fd === 'object' ? fd : {};
    // AMBIENT PRECIP STATE: 2 = none, 4 = rain, 8 = snow. RATE has no documented hourly timebase.
    const state = fd.precipState;
    const valid = typeof state === 'number' && Number.isSafeInteger(state) && state > 0
        && (state & ~14) === 0 && !((state & 2) && (state & 12));
    const active = valid ? Boolean(state & 12)
        : (state == null && typeof fd.precipActive === 'boolean' ? fd.precipActive : null);
    const label = valid ? (state === 2 ? 'kein Niederschlag' : state === 4 ? 'Regen'
        : state === 8 ? 'Schnee' : 'Regen und Schnee') : (active === true ? 'Niederschlag' : active === false ? 'kein Niederschlag' : null);
    return {
        precipState: valid ? state : null,
        precipActive: active,
        precipLabel: label,
        precipRateRaw: typeof fd.precipRateRaw === 'number' && Number.isFinite(fd.precipRateRaw) && fd.precipRateRaw >= 0 ? fd.precipRateRaw : null,
        precipRateUnit: 'millimeters of water; timebase unknown',
        precipRateMmH: null
    };
}
return Object.freeze({observe:_precipitationObservation});
});
