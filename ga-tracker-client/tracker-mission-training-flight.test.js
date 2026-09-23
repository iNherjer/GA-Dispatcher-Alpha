'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const flight = require('../mission-training-flight-core.js');

const source = fs.readFileSync(path.join(__dirname, '../passenger-voice.js'), 'utf8');
function original(name) {
    const start = source.indexOf(`function ${name}(`);
    assert.ok(start >= 0, name);
    let end = source.indexOf('\n}', start);
    while (end >= 0) {
        const candidate = source.slice(start, end + 2);
        try { new vm.Script(candidate); return candidate; } catch (error) {
            if (!(error instanceof SyntaxError)) throw error;
        }
        end = source.indexOf('\n}', end + 2);
    }
    throw new Error(name);
}
const originalFunctions = [
    '_trainingEvalBegin', '_toBoolStall', '_trainingEvalTick', '_trainingEvalSummary',
    '_trainingProcedureDebriefLine', '_poiTrainingPreZonePrompt', '_trainingLandingPrepPrompt',
    '_weatherContext', '_haversineNm', '_trainingPoiCenterFromRoute'
].map(original).join('\n');
const branchStart = source.indexOf('        if (isPoiMission) {', source.indexOf('window.checkPaxPoiProximity ='));
const branchEnd = source.indexOf('        } else {\n            // APT-Training:', branchStart);
const originalBranch = source.slice(branchStart, branchEnd) + '\n        }';
const originalEvalStart = source.indexOf('    if (trainingPlan && (_aptTrainingBriefDone || _poiTrainingZoneStartDone)) {', branchEnd);
const originalEvalEnd = source.indexOf('    const trainingTaskDomainActive', originalEvalStart);
const originalEvalTick = source.slice(originalEvalStart, originalEvalEnd);

// Run the actual App source in an isolated browser-shaped VM. The wrappers only
// inject coordinates, clock, state and speech capture; thresholds stay original.
function legacy(context, saved, sample, progress, now, operation = 'observe') {
    const state = flight.createState(saved);
    const cues = [];
    const box = {
        _poiTrainingPreBriefDone: state.preBriefDone,
        _poiTrainingZoneStartDone: state.zoneStartDone,
        _poiTrainingLandingBriefDone: state.landingBriefDone,
        _paxLandingPhaseAnnounced: state.landingPhaseAnnounced,
        _poiTrainingLastDistToDestNm: state.lastDistToDestNm,
        _trainingEval: { ...state.eval,
            minAltFt: state.eval.minAltFt == null ? Infinity : state.eval.minAltFt,
            maxAltFt: state.eval.maxAltFt == null ? -Infinity : state.eval.maxAltFt },
        Date: { now: () => now },
        window: { activePassenger: context.passenger, missionTrainingProcedure: { snapshot: () => progress } },
        _activeAptTrainingPlan: () => context.trainingPlan,
        _baseContext: () => context.baseContext,
        _toneHint: () => context.toneHint,
        _trainingProcedureSnapshot: () => progress,
        _getDestCoords: () => context.target,
        _paxLog: () => {},
        _speakAndShow: (prompt, label) => cues.push({ prompt, label }),
        _paxMissionTimeout: (cb, delay) => { const offset = cues.length; cb(); for (let i=offset;i<cues.length;i++) cues[i].notBefore=now+delay; }
    };
    vm.createContext(box);
    vm.runInContext(originalFunctions, box);
    if (operation === 'summary') return JSON.parse(JSON.stringify(vm.runInContext('_trainingEvalSummary()', box)));
    if (operation === 'debrief') return vm.runInContext('_trainingProcedureDebriefLine()', box);
    box.sample = sample;
    box.context = context;
    vm.runInContext(`(function () {
      const flightData = sample;
      const lat = Number(sample.lat), lon = Number(sample.lon);
      const trainingPlan = _activeAptTrainingPlan();
      const wps = context.routeWaypoints;
      if (trainingPlan && wps && wps.length >= 2) {
        const last = wps[wps.length - 1];
        const distNm = _haversineNm(lat, lon, last.lat, last.lng ?? last.lon);
        const isPoiMission = true;
${originalBranch}
      }
      const _aptTrainingBriefDone = false;
${originalEvalTick}
    })()`, box);
    state.preBriefDone = box._poiTrainingPreBriefDone;
    state.zoneStartDone = box._poiTrainingZoneStartDone;
    state.landingBriefDone = box._poiTrainingLandingBriefDone;
    state.landingPhaseAnnounced = box._paxLandingPhaseAnnounced;
    state.lastDistToDestNm = box._poiTrainingLastDistToDestNm;
    state.eval = { ...box._trainingEval,
        minAltFt: Number.isFinite(box._trainingEval.minAltFt) ? box._trainingEval.minAltFt : null,
        maxAltFt: Number.isFinite(box._trainingEval.maxAltFt) ? box._trainingEval.maxAltFt : null };
    return { state: JSON.parse(JSON.stringify(state)), cues: JSON.parse(JSON.stringify(cues)) };
}

const context = {
    trainingPlan: { mode: 'airwork', focus: ['Kurs', 'Höhe'] },
    target: { lat: 0, lon: 0 }, routeWaypoints: [{ lat: 0, lon: 0.15 }, { lat: 0, lon: 0 }, { lat: 0, lon: 0.15 }],
    passenger: { targetRadiusNm: 1.5 }, baseContext: 'Trainingskontext', toneHint: '\nKnapp sprechen.'
};
function same(a, b) { assert.deepEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b))); }

test('generator stays aligned with passenger voice source', () => {
    execFileSync(process.execPath, ['tools/generate-training-flight-core.mjs', '--check'], { cwd: path.join(__dirname, '..') });
});
test('POI approach, zone, return and restart match original triggers and prompts', () => {
    for (const mode of ['airwork', 'pattern']) {
        const c = { ...context, trainingPlan: { ...context.trainingPlan, mode } };
        let modern = flight.createState(), old = flight.createState();
        const samples = [
            [0.09, null], [0.066, null], [0.0655, null], [0.0662, null],
            [0.062, { startedAt: 10 }], [0.024, { startedAt: 10 }], [0.018, { startedAt: 10 }],
            [0.025, { startedAt: 10 }], [0.07, { startedAt: 10 }], [0.09, { startedAt: 10 }],
            [0.10, { startedAt: 10 }], [0.11, { startedAt: 10 }],
            [0.12, { startedAt: 10 }], [0.13, { startedAt: 10 }]
        ];
        for (const [index, [lon, progress]] of samples.entries()) {
            const sample = { lat: 0, lon, mslFt: 2400 + index * 10, bankDeg: index, gForce: 1.1,
                vsFpm: index % 2 ? 250 : -180, aoaDeg: index / 2, stallState: index === 6,
                windKts: 14, windDeg: 180, visKm: 12 };
            const now = index * 1000;
            const a = flight.observe(c, modern, sample, progress, now);
            const b = legacy(c, old, sample, progress, now);
            same(a, b);
            modern = JSON.parse(JSON.stringify(a.state));
            old = JSON.parse(JSON.stringify(b.state));
        }
        same(flight.summary(modern), legacy(c, modern, {}, null, 0, 'summary'));
        assert.equal(modern.preBriefDone, true);
        assert.equal(modern.zoneStartDone, true);
        assert.equal(modern.landingBriefDone, true);
        assert.equal(modern.eval.samples, 9);
        assert.ok(flight.summary(modern));
    }
});
test('briefing is suppressed after procedure start and zone radius keeps 1.2 NM floor', () => {
    const c = { ...context, passenger: { targetRadiusNm: 0.3 } };
    const sample = { lat: 0, lon: 0.019, mslFt: 2200 };
    const progress = { startedAt: 123 };
    const a = flight.observe(c, flight.createState(), sample, progress, 1000);
    same(a, legacy(c, flight.createState(), sample, progress, 1000));
    assert.equal(a.state.preBriefDone, false);
    assert.equal(a.state.zoneStartDone, true);
    assert.equal(a.cues.length, 0);
});
test('procedure debrief preserves original summary wording', () => {
    for (const progress of [null, { exercises: [{ id: 'x', label: 'Kurve', status: 'active' }], activeExercise: { label: 'Kurve' } },
        { exercises: [{ id: 'x', label: 'Kurve', type: 'turn_180', status: 'complete', summary: { maxAltitudeDeviationFt: 41, rolloutHeadingErrorDeg: 2.5 } }] }]) {
        assert.equal(flight.debrief(progress), legacy(context, {}, {}, progress, 0, 'debrief'));
    }
});
