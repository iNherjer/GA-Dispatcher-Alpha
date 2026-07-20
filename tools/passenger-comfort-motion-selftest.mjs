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

const smoothResult = _analyzePaxComfortMotion(smooth, 3500);
const turnResult = _analyzePaxComfortMotion(steadyTurn, 3500);
const oneAxisResult = _analyzePaxComfortMotion(oneAxisOnly, 3500);
const moderateResult = _analyzePaxComfortMotion(moderateTurbulence, 3500);
const strongResult = _analyzePaxComfortMotion(strongTurbulence, 3500);

assert(!smoothResult.detected, 'smooth flight must not be turbulence');
assert(!turnResult.detected, 'steady bank entry must remain a pilot maneuver');
assert(!oneAxisResult.detected, 'one oscillating metric is insufficient');
assert(moderateResult.detected && moderateResult.severity === 'warn', 'multi-axis moderate motion must be detected');
assert(strongResult.detected && strongResult.severity === 'hard', 'multi-axis strong motion must be hard turbulence');

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

({ smoothResult, turnResult, oneAxisResult, moderateResult, strongResult,
   debugDetail: _comfortBreachDebugDetail(confirmed) });
`;

const result = vm.runInNewContext(testSource, { console });
console.log(JSON.stringify(result, null, 2));
