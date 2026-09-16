// Generated from passenger-voice.js by tools/generate-mission-comfort-core.mjs.
// Original scoring and event-edge rules; no independent Tracker approximation.
'use strict';
function evaluate(previous, sample, context = {}, now = 0) {
 const Date = {now: () => now};
 let _missionComfortScore = previous ? JSON.parse(JSON.stringify(previous)) : null;
 const _activeMissionData = () => context.missionData || {};
 const _activeTaskDomain = () => context.taskDomain || '';
 const _activeCargoText = () => String(context.cargoText || '');
 const _activePaxText = () => String(context.paxText || '');
 const _paxDebugMotionProtectionEnabled = () => context.motionProtectionEnabled === true;
 function _createMissionComfortScore() {
    return {
        startedAt: Date.now(),
        samples: 0,
        pilotEvents: 0,
        pilotSevere: 0,
        weatherEvents: 0,
        weatherSevere: 0,
        cargoRiskEvents: 0,
        gEvents: 0,
        bankEvents: 0,
        descentEvents: 0,
        maxG: 1.0,
        maxBankDeg: 0,
        maxDescentFpm: 0,
        maxWindKts: 0,
        maxGustSpreadKts: 0,
        maxTurbulencePct: 0,
        maxPrecipRate: 0,
        flags: {}
    };
}
function _missionComfortScoreState() {
    if (!_missionComfortScore) _missionComfortScore = _createMissionComfortScore();
    return _missionComfortScore;
}
function _cargoMissionFocus() {
    const md = _activeMissionData();
    if (md?.clubIdea?.schema === 'club-idea.v1') return !!md.clubIdea.delivery;
    const task = _activeTaskDomain();
    const cargo = _activeCargoText().toLowerCase();
    const paxText = _activePaxText();
    const noPax = /^\s*0\s*PAX\b/i.test(paxText);
    const cat = String(md.cat || md.missionContract?.category || '').toLowerCase();
    return noPax
        || task === 'cargo_fragile'
        || cat === 'cargo'
        || /(fracht|ladung|cargo|box|kiste|sensor|scanner|kamera|gimbal|medizin|probe|equipment|ausruest|ausrüst|werkzeug|material)/i.test(cargo);
}
function _missionScoreRegisterEvent(key, active, severe = false, bucket = 'pilot') {
    const score = _missionComfortScoreState();
    const flags = score.flags || (score.flags = {});
    if (active && !flags[key]) {
        if (bucket === 'weather') {
            score.weatherEvents += 1;
            if (severe) score.weatherSevere += 1;
        } else {
            score.pilotEvents += 1;
            if (severe) score.pilotSevere += 1;
            if (key === 'g') score.gEvents += 1;
            if (key === 'bank') score.bankEvents += 1;
            if (key === 'descent') score.descentEvents += 1;
            if (_cargoMissionFocus()) score.cargoRiskEvents += severe ? 2 : 1;
        }
    }
    flags[key] = !!active;
}
function _recordMissionComfortSample(flightData) {
    if (!flightData || _paxDebugMotionProtectionEnabled()) return;
    const score = _missionComfortScoreState();
    score.samples += 1;
    const g = Number(flightData.gForce || 1.0);
    const bank = Math.abs(Number(flightData.bankDeg || 0));
    const wind = Number(flightData.windKts || 0);
    const gust = Number(flightData.windGustKts || 0);
    const gustSpread = (Number.isFinite(gust) && Number.isFinite(wind)) ? Math.max(0, gust - wind) : 0;
    const turb = Number(flightData.turbulencePct || 0);
    const precip = Number(flightData.precipRateMmH || 0);
    const vs = Number.isFinite(flightData.vsFpm) ? Number(flightData.vsFpm) : Number(flightData.vs || 0);

    if (Number.isFinite(g)) score.maxG = Math.max(score.maxG || 1.0, g);
    if (Number.isFinite(bank)) score.maxBankDeg = Math.max(score.maxBankDeg || 0, bank);
    if (Number.isFinite(vs)) score.maxDescentFpm = Math.min(score.maxDescentFpm || 0, vs);
    if (Number.isFinite(wind)) score.maxWindKts = Math.max(score.maxWindKts || 0, wind);
    if (Number.isFinite(gustSpread)) score.maxGustSpreadKts = Math.max(score.maxGustSpreadKts || 0, gustSpread);
    if (Number.isFinite(turb)) score.maxTurbulencePct = Math.max(score.maxTurbulencePct || 0, turb);
    if (Number.isFinite(precip)) score.maxPrecipRate = Math.max(score.maxPrecipRate || 0, precip);

    _missionScoreRegisterEvent('g', g >= 1.6, g >= 1.85, 'pilot');
    _missionScoreRegisterEvent('bank', bank >= 34, bank >= 45, 'pilot');
    _missionScoreRegisterEvent('descent', vs <= -1600, vs <= -2400, 'pilot');
    _missionScoreRegisterEvent('wind', wind >= 24, wind >= 34, 'weather');
    _missionScoreRegisterEvent('gust', gustSpread >= 16, gustSpread >= 24, 'weather');
    _missionScoreRegisterEvent('turb', turb >= 55, turb >= 75, 'weather');
    _missionScoreRegisterEvent('precip', precip >= 1.5 || flightData.precipActive === true, precip >= 4.0, 'weather');
}
function _missionComfortSummary() {
    const score = _missionComfortScoreState();
    if (_paxDebugMotionProtectionEnabled()) {
        return {
            ...score,
            samples: 0,
            pilotEvents: 0,
            pilotSevere: 0,
            weatherEvents: 0,
            weatherSevere: 0,
            cargoRiskEvents: 0,
            gEvents: 0,
            bankEvents: 0,
            descentEvents: 0,
            comfortScore: 100,
            mood: 'nicht bewertet (Debug-Slew-Schutz)',
            maxG: '1.00',
            maxBankDeg: 0,
            maxDescentFpm: 0,
            maxWindKts: 0,
            maxGustSpreadKts: 0,
            maxTurbulencePct: 0,
            maxPrecipRate: '0.0',
            debugMotionProtection: true
        };
    }
    const pilotPenalty = score.pilotEvents * 9 + score.pilotSevere * 10;
    const weatherPenalty = score.weatherEvents * 3 + score.weatherSevere * 5;
    const cargoPenalty = (_cargoMissionFocus() ? score.cargoRiskEvents * 8 : 0);
    const comfortScore = Math.max(0, Math.min(100, 100 - pilotPenalty - weatherPenalty - cargoPenalty));
    const mood = comfortScore >= 88 ? 'sehr zufrieden'
        : comfortScore >= 72 ? 'zufrieden'
        : comfortScore >= 55 ? 'etwas angespannt'
        : comfortScore >= 35 ? 'unzufrieden'
        : 'ziemlich durchgeschuettelt';
    return {
        ...score,
        comfortScore,
        mood,
        maxG: Number(score.maxG || 1).toFixed(2),
        maxBankDeg: Math.round(score.maxBankDeg || 0),
        maxDescentFpm: Math.round(score.maxDescentFpm || 0),
        maxWindKts: Math.round(score.maxWindKts || 0),
        maxGustSpreadKts: Math.round(score.maxGustSpreadKts || 0),
        maxTurbulencePct: Math.round(score.maxTurbulencePct || 0),
        maxPrecipRate: Number(score.maxPrecipRate || 0).toFixed(1)
    };
}
 if (sample) _recordMissionComfortSample(sample);
 return {state: _missionComfortScoreState(), summary: _missionComfortSummary(), cargoFocus: _cargoMissionFocus()};
}
module.exports = {evaluate};
