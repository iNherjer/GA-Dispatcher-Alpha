#!/usr/bin/env node

import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../passenger-voice.js', import.meta.url), 'utf8');
const start = source.indexOf('const _PAX_COMFORT_MOTION_WINDOW_MS');
const end = source.indexOf('function _comfortBreachPrompt', start);
if (start < 0 || end < 0) throw new Error('Passenger comfort motion helpers not found');

const helpers = source.slice(start, end);
const testSource = `
let _paxComfortMotionSamples = [];
let _paxComfortLastMotionAnalysis = null;
let _paxComfortBreachState = Object.create(null);
${helpers}

function makeSeries(build, count = 36, stepMs = 100) {
    return Array.from({ length: count }, (_, i) => ({ t: i * stepMs, ...build(i) }));
}
function assert(condition, message) {
    if (!condition) throw new Error(message);
}
function _normLevel3(value) {
    const level = String(value || '').toLowerCase();
    return ['hoch', 'mittel', 'niedrig'].includes(level) ? level : 'mittel';
}
function _comfortFeedbackPolicy() {
    return {
        metricLevels: { g: 'hoch', bank: 'hoch', wind: 'hoch', gust: 'hoch', turb: 'hoch', precip: 'hoch', descent: 'hoch' },
        metricModes: { g: 'proactive', bank: 'proactive', wind: 'proactive', gust: 'proactive', turb: 'proactive', precip: 'proactive', descent: 'proactive' }
    };
}

const smooth = makeSeries(i => ({
    g: 1 + Math.sin(i / 8) * 0.01,
    vs: 120,
    bank: 2,
    pitch: 2
}));
const steadyTurn = makeSeries(i => ({
    g: 1.35,
    vs: -150,
    bank: Math.min(45, i * 2),
    pitch: 3
}));
const oneAxisOnly = makeSeries(i => ({
    g: 1 + (i % 2 ? 0.22 : -0.22),
    vs: 0,
    bank: 0,
    pitch: 0
}));
const deliberateCorrections = makeSeries(i => {
    const direction = Math.floor(i / 6) % 2 ? 1 : -1;
    return {
        g: 1 + direction * 0.12,
        vs: direction * 180,
        bank: direction * 3,
        pitch: direction * 1.3
    };
});
const moderateTurbulence = makeSeries(i => ({
    g: 1 + (i % 2 ? 0.12 : -0.12),
    vs: i % 2 ? 180 : -180,
    bank: i % 2 ? 3 : -3,
    pitch: i % 2 ? 1.3 : -1.3
}));
const strongTurbulence = makeSeries(i => ({
    g: 1 + (i % 2 ? 0.22 : -0.22),
    vs: i % 2 ? 320 : -320,
    bank: i % 2 ? 5 : -5,
    pitch: i % 2 ? 2.5 : -2.5
}));
const singleSpike = makeSeries(i => ({
    g: i === 18 ? 2.6 : 1,
    vs: i === 18 ? -3200 : 0,
    bank: i === 18 ? 95 : 0,
    pitch: i === 18 ? 30 : 0
}));
const roll = makeSeries(i => {
    if (i < 10 || i > 22) return { g: 1, vs: 0, bank: 0, pitch: 0 };
    const progress = (i - 10) / 12;
    const angle = progress * 360;
    const bank = angle <= 180 ? angle : angle - 360;
    return {
        g: 1 + Math.sin(progress * Math.PI * 4) * 0.16,
        vs: Math.sin(progress * Math.PI * 4) * 260,
        bank,
        pitch: Math.sin(progress * Math.PI * 4) * 7
    };
});

const smoothResult = _analyzePaxComfortMotion(smooth, 3500);
const turnResult = _analyzePaxComfortMotion(steadyTurn, 3500);
const oneAxisResult = _analyzePaxComfortMotion(oneAxisOnly, 3500);
const correctionResult = _analyzePaxComfortMotion(deliberateCorrections, 3500);
const moderateResult = _analyzePaxComfortMotion(moderateTurbulence, 3500);
const strongResult = _analyzePaxComfortMotion(strongTurbulence, 3500);
const spikeResult = _analyzePaxComfortMotion(singleSpike, 3500);
const rollResult = _analyzePaxComfortMotion(roll, 3500);

assert(!smoothResult.detected, 'smooth flight must not be turbulence');
assert(!turnResult.detected, 'steady bank entry must remain a pilot maneuver');
assert(!oneAxisResult.detected, 'one oscillating metric is insufficient');
assert(!correctionResult.detected, 'a few deliberate pilot corrections must not be turbulence');
assert(moderateResult.detected && moderateResult.severity === 'warn', 'multi-axis moderate motion must be detected');
assert(strongResult.detected && strongResult.severity === 'hard', 'multi-axis strong motion must be hard turbulence');
assert(!spikeResult.detected && !spikeResult.maneuverLike, 'single telemetry spike must be ignored');
assert(!rollResult.detected && rollResult.maneuverLike, 'roll must be classified as a pilot maneuver, not turbulence');

const pax = {};
const neutralFlightData = {
    gForce: 1, bankDeg: 0, vsFpm: 0, windKts: 0, windGustKts: 0,
    turbulencePct: 0, precipRateMmH: 0
};
const spikeBreach = _evaluateComfortBreach(neutralFlightData, pax, spikeResult);
assert(!spikeBreach, 'single telemetry spike must not trigger a comfort breach');
const unsupportedDirectTurbulence = _evaluateComfortBreach(
    { ...neutralFlightData, turbulencePct: 100 },
    pax,
    smoothResult
);
assert(!unsupportedDirectTurbulence, 'raw Sim turbulence without matching motion must not trigger');
const rollBreach = _evaluateComfortBreach(neutralFlightData, pax, rollResult);
assert(rollBreach?.bLevel === 'hard', 'robust bank peak from a roll must trigger flight-style evaluation');
assert(!rollBreach?.tLevel, 'roll must not create a derived turbulence breach');
_paxComfortBreachState = Object.create(null);
assert(!_confirmComfortBreach(rollBreach, 5000), 'roll still needs temporal multi-sample confirmation');
const confirmedRoll = _confirmComfortBreach(rollBreach, 5400);
assert(confirmedRoll?.confirmed?.bank, 'confirmed roll must survive the spike filter as flight style');
assert(_comfortBreachDebugDetail(confirmedRoll).includes('Bank-Spitze'), 'roll debug detail must expose the robust bank peak');

_paxComfortBreachState = Object.create(null);
const breach = {
    gLevel: null, bLevel: null, wLevel: null, gsLevel: null, tLevel: 'warn', pLevel: null, dLevel: null,
    severity: 'warn', turbulence: 60, directTurbulence: 0,
    motionTurbulence: moderateResult,
    preconfirmedMs: { turbulence: moderateResult.windowMs },
    thresholds: { turbulence: { warn: 55, hard: 75 } }
};
const confirmed = _confirmComfortBreach(breach, 5000);
assert(confirmed?.confirmed?.turbulence, 'motion window must satisfy temporal confirmation');
assert(_comfortBreachDebugDetail(confirmed).includes('Unruhe-Muster'), 'debug detail must expose motion trigger');

({ smoothResult, turnResult, oneAxisResult, correctionResult, moderateResult, strongResult, spikeResult, rollResult,
   rollDebugDetail: _comfortBreachDebugDetail(confirmedRoll),
   turbulenceDebugDetail: _comfortBreachDebugDetail(confirmed) });
`;

const result = vm.runInNewContext(testSource, { console });
console.log(JSON.stringify(result, null, 2));
