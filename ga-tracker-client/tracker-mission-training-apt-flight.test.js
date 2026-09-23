'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const flight = require('../mission-training-flight-core.js');

const source = fs.readFileSync(path.join(__dirname, '../passenger-voice.js'), 'utf8');
const appSource = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8');
function original(sourceText, name) {
    const start = sourceText.indexOf(`function ${name}(`);
    assert.ok(start >= 0, name);
    let end = sourceText.indexOf('\n}', start);
    while (end >= 0) {
        const candidate = sourceText.slice(start, end + 2);
        try { new vm.Script(candidate); return candidate; } catch (error) {
            if (!(error instanceof SyntaxError)) throw error;
        }
        end = sourceText.indexOf('\n}', end + 2);
    }
    throw new Error(name);
}
const originalFunctions = [
    '_trainingEvalBegin', '_toBoolStall', '_trainingEvalTick', '_trainingEvalSummary',
    '_aptTrainingPrompt', '_trainingLandingPrepPrompt', '_weatherContext', '_haversineNm',
    '_trainingPoiCenterFromRoute'
].map(name => original(source, name)).concat(original(appSource, '_isPatternFocusItem')).join('\n');
const triggerStart = source.indexOf('        if (isPoiMission) {', source.indexOf('window.checkPaxPoiProximity ='));
const aptStart = source.indexOf('        } else {\n            // APT-Training:', triggerStart);
const evalStart = source.indexOf('    if (trainingPlan && (_aptTrainingBriefDone || _poiTrainingZoneStartDone)) {', aptStart);
const evalEnd = source.indexOf('    const trainingTaskDomainActive', evalStart);
assert.ok(triggerStart >= 0 && aptStart >= 0 && evalStart >= 0 && evalEnd >= 0, 'original APT boundaries');
const originalTriggers = source.slice(triggerStart, evalStart);
const originalEvalTick = source.slice(evalStart, evalEnd);

function legacy(context, saved, sample, progress, now) {
    const state = flight.createState(saved);
    const cues = [];
    const box = {
        _aptTrainingBriefDone: state.aptBriefDone,
        _aptTrainingLandingBriefDone: state.aptLandingBriefDone,
        _poiTrainingPreBriefDone: state.preBriefDone,
        _poiTrainingZoneStartDone: state.zoneStartDone,
        _poiTrainingLandingBriefDone: state.landingBriefDone,
        _paxLandingPhaseAnnounced: state.landingPhaseAnnounced,
        _poiTrainingLastDistToDestNm: state.lastDistToDestNm,
        _trainingEval: { ...state.eval,
            minAltFt: state.eval.minAltFt == null ? Infinity : state.eval.minAltFt,
            maxAltFt: state.eval.maxAltFt == null ? -Infinity : state.eval.maxAltFt },
        Date: { now: () => now }, currentMissionData: context.missionData || {},
        window: { activePassenger: context.passenger, missionTrainingProcedure: { snapshot: () => progress } },
        _activeAptTrainingPlan: () => context.trainingPlan,
        _baseContext: () => context.baseContext, _toneHint: () => context.toneHint,
        _trainingProcedureSnapshot: () => progress,
        _getDestCoords: () => context.target,
        _paxLog: () => {},
        _speakAndShow: (prompt, label) => cues.push({ prompt, label }),
        _paxMissionTimeout: (cb, delay) => { const offset = cues.length; cb(); for (let i = offset; i < cues.length; i++) cues[i].notBefore = now + delay; }
    };
    vm.createContext(box);
    vm.runInContext(originalFunctions, box);
    box.sample = sample;
    box.context = context;
    vm.runInContext(`(function () {
      const flightData = sample;
      const lat = Number(sample.lat), lon = Number(sample.lon);
      const trainingPlan = _activeAptTrainingPlan();
      const wps = context.routeWaypoints;
      if (trainingPlan && wps && wps.length >= 2) {
        const first = wps[0];
        const last = wps[wps.length - 1];
        const distNm = _haversineNm(lat, lon, last.lat, last.lng ?? last.lon);
        const isPoiMission = false;
${originalTriggers}
${originalEvalTick}
    })()`, box);
    state.aptBriefDone = box._aptTrainingBriefDone;
    state.aptLandingBriefDone = box._aptTrainingLandingBriefDone;
    state.preBriefDone = box._poiTrainingPreBriefDone;
    state.zoneStartDone = box._poiTrainingZoneStartDone;
    state.landingBriefDone = box._poiTrainingLandingBriefDone;
    state.landingPhaseAnnounced = box._paxLandingPhaseAnnounced;
    state.lastDistToDestNm = box._poiTrainingLastDistToDestNm;
    state.eval = { ...box._trainingEval,
        minAltFt: Number.isFinite(box._trainingEval.minAltFt) ? box._trainingEval.minAltFt : null,
        maxAltFt: Number.isFinite(box._trainingEval.maxAltFt) ? box._trainingEval.maxAltFt : null };
    return JSON.parse(JSON.stringify({ state, cues }));
}

const routeWaypoints = [{ lat: 0, lon: 0 }, { lat: 0, lon: 0.2 }];
const baseContext = {
    missionMode: 'APT', trainingPlan: { mode: 'airwork', focus: ['Steep Turns', 'Landung'], instructorLine: 'Erst Airwork, danach zurück zum Platz.' },
    missionData: { dest: 'EDTX' }, routeWaypoints, passenger: { targetRadiusNm: 1.2 },
    baseContext: 'Ausbildungsflug.', toneHint: '\nKurz.'
};
const sample = (lon, index = 0) => ({ lat: 0, lon, mslFt: 2400 + index * 40, bankDeg: index * 5,
    gForce: 1.1, vsFpm: index % 2 ? 220 : -180, aoaDeg: index / 2, stallState: index === 2,
    windKts: 12, windDeg: 170, visKm: 15 });
function same(a, b) { assert.deepEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b))); }

test('generator extracts APT trigger and prompt sources without drift', () => {
    execFileSync(process.execPath, ['tools/generate-training-flight-core.mjs', '--check'], { cwd: path.join(__dirname, '..') });
});

test('APT keeps the original half-route airwork briefing and starts original evaluation', () => {
    let modern = flight.createState();
    let old = flight.createState();
    for (const [index, lon] of [0.09, 0.101, 0.11].entries()) {
        const a = flight.observe(baseContext, modern, sample(lon, index), null, index * 1000);
        const b = legacy(baseContext, old, sample(lon, index), null, index * 1000);
        same(a, b);
        modern = a.state;
        old = b.state;
    }
    assert.equal(modern.aptBriefDone, true);
    assert.equal(modern.aptLandingBriefDone, false);
    assert.equal(modern.eval.active, true);
    assert.equal(modern.eval.samples, 2);
});

test('APT preserves the original pattern 5 NM and non-pattern 4 NM landing thresholds', () => {
    for (const [mode, beforeThresholdLon, atThresholdLon] of [
        ['pattern', 0.12, 0.13], // about 4.8 NM, then about 4.2 NM remaining
        ['airwork', 0.13, 0.14] // about 4.2 NM, then about 3.6 NM remaining
    ]) {
        const context = { ...baseContext, trainingPlan: { ...baseContext.trainingPlan, mode } };
        let modern = flight.createState();
        let old = flight.createState();
        for (const [index, lon] of [0.101, beforeThresholdLon, atThresholdLon].entries()) {
            const a = flight.observe(context, modern, sample(lon, index), null, index * 1000);
            const b = legacy(context, old, sample(lon, index), null, index * 1000);
            same(a, b);
            modern = a.state;
            old = b.state;
        }
        assert.equal(modern.aptBriefDone, true, mode);
        assert.equal(modern.aptLandingBriefDone, true, mode);
    }
});

test('without missionMode the established POI route remains the default', () => {
    const context = { ...baseContext, missionMode: undefined, target: { lat: 0, lon: 0.1 },
        routeWaypoints: [{ lat: 0, lon: 0.2 }, { lat: 0, lon: 0.1 }, { lat: 0, lon: 0.2 }] };
    const result = flight.observe(context, flight.createState(), sample(0.1), null, 0);
    assert.equal(result.state.aptBriefDone, false);
    assert.equal(result.state.zoneStartDone, true);
});
