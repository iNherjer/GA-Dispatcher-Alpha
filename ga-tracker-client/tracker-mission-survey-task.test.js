'use strict';

const assert = require('node:assert/strict');
const core = require('../mission-survey-core.js');
const task = require('./tracker-mission-survey-task.js');
const standalone = require('../tools/fixtures/survey-legacy-20260922.js');

const scanRaw = {
    taskDomain: 'mapping_survey', type: 'north_south_scan', center: { lat: 48.1, lon: 8.2 }, targetAltFt: 3500,
    scan: { lineCount: 1, lineLengthNm: 0.8, lineSpacingNm: 0.2, crossTrackToleranceNm: 0.08,
        minCoverage: 0.7, resetGraceSec: 2, bins: 24 }
};
const orbitRaw = {
    taskDomain: 'mapping_survey', type: 'orbit', center: { lat: 48.1, lon: 8.2 }, targetAltFt: 3500,
    orbit: { radiusNm: 0.45, radialToleranceNm: 0.08, requiredTurns: 1, sectorsPerTurn: 36,
        minTurnCoverage: 0.8, minTurnSec: 0, resetGraceSec: 2 }
};

function scanSamples(spec, intervalMs = 1000) {
    const line = spec.scan.lines[0];
    return Array.from({ length: 25 }, (_, index) => ({
        ...core.interpolateLine(line, index / 24), altFt: 3500, gsKts: 95, headingDeg: 180,
        observedAt: index * intervalMs
    }));
}
function runStandalone(spec, samples) {
    let state = standalone.createInitialState(spec);
    for (const sample of samples) state = standalone.tickState(spec, state, { ...sample, nowMs: sample.observedAt }).state;
    return standalone.snapshotState(state);
}
function orbitSamples(spec, intervalMs = 500) {
    return Array.from({ length: 181 }, (_, index) => ({
        ...core.destinationPoint(spec.center.lat, spec.center.lon, spec.orbit.radiusNm, (index * 2) % 360),
        altFt: 3500, gsKts: 95, headingDeg: (index * 2 + 90) % 360, observedAt: index * intervalMs
    }));
}

// Generated functions must reproduce the standalone snapshot for the frozen
// trace; this catches an extraction boundary changing underneath the adapter.
{
    const legacySpec = standalone.normalizeSpec(scanRaw);
    const spec = core.normalizeSpec(scanRaw);
    const samples = scanSamples(spec);
    let original = standalone.createInitialState(legacySpec);
    let generated = core.createInitialState(spec);
    for (const sample of samples) {
        const legacyTick = standalone.tickState(legacySpec, original, { ...sample, nowMs: sample.observedAt });
        const generatedTick = core.tickState(spec, generated, { ...sample, nowMs: sample.observedAt });
        original = legacyTick.state;
        generated = generatedTick.state;
        assert.deepEqual(generatedTick.events, legacyTick.events);
        assert.deepEqual(core.snapshotState(generated), standalone.snapshotState(original));
    }
}
{
    const legacySpec = standalone.normalizeSpec(orbitRaw);
    const spec = core.normalizeSpec(orbitRaw);
    const samples = orbitSamples(spec);
    assert.deepEqual(core.snapshotState(samples.reduce((state, sample) => core.tickState(spec, state,
        { ...sample, nowMs: sample.observedAt }).state, core.createInitialState(spec))), runStandalone(legacySpec, samples));
}

// The same bounded interpolation preserves sector continuity for an orbit.
{
    const spec = core.normalizeSpec(orbitRaw);
    const dense = orbitSamples(spec);
    const expected = runStandalone(spec, dense);
    let state = null;
    for (let index = 0; index < dense.length; index += 8) {
        state = task.observe(spec, state, dense[index], { active: true, trackingActive: true }).state;
    }
    if ((dense.length - 1) % 8) state = task.observe(spec, state, dense.at(-1), { active: true, trackingActive: true }).state;
    assert.equal(state.progress.satisfied, expected.satisfied);
    assert.equal(state.progress.orbit.completedTurns, 1);
}

// A five-second plausible breadcrumb segment carries the same scan bins as
// dense observations, including the line end cap.
{
    const spec = core.normalizeSpec(scanRaw);
    const dense = scanSamples(spec);
    const expected = runStandalone(spec, dense);
    let state = null;
    for (const index of [0, 5, 10, 15, 20, 24]) {
        const result = task.observe(spec, state, dense[index], { active: true, trackingActive: true });
        state = result.state;
    }
    assert.equal(state.progress.satisfied, expected.satisfied);
    assert.equal(state.progress.scan.completedCount, 1);
}

// A teleport, pause, slew, and long gap sever unfinished tracks. They retain
// completed work but cannot create a line completion from stale active state.
{
    const spec = core.normalizeSpec(scanRaw);
    const samples = scanSamples(spec);
    let state = null;
    for (const index of [0, 5]) state = task.observe(spec, state, samples[index], { active: true, trackingActive: true }).state;
    const teleported = { ...samples[20], observedAt: 6000 };
    let result = task.observe(spec, state, teleported, { active: true, trackingActive: true });
    assert.equal(result.progress.scan.completedCount, 0);
    assert.ok(result.events.some(event => event.type === 'line_reset_discontinuity'));
    state = result.state;
    result = task.observe(spec, state, { observedAt: 7000, simPaused: true }, { active: true, trackingActive: true });
    assert.equal(result.state.previousSample, null);
    result = task.observe(spec, result.state, { ...samples[24], observedAt: 14000, slewActive: true }, { active: true, trackingActive: true });
    assert.equal(result.progress.satisfied, false);
}

// Off-altitude endpoints are real observations only: no interpolated bins are
// manufactured before the original detector receives its grace/reset input.
{
    const spec = core.normalizeSpec(scanRaw);
    const samples = scanSamples(spec);
    let result = task.observe(spec, null, samples[0], { active: true, trackingActive: true });
    result = task.observe(spec, result.state, { ...samples[20], observedAt: 4000, altFt: 5000 }, { active: true, trackingActive: true });
    assert.equal(result.reason, 'survey_task_observed');
    assert.equal(result.progress.scan.completedCount, 0);
    assert.ok(result.progress.scan.activeCoverage < 0.2);
}

// Null/unknown telemetry is never coerced to a valid zero. It severs the
// active segment without running the permissive standalone altitude fallback.
{
    const spec = core.normalizeSpec(scanRaw);
    const samples = scanSamples(spec);
    let state = task.observe(spec, null, samples[0], { active: true, trackingActive: true }).state;
    state = task.observe(spec, state, samples[4], { active: true, trackingActive: true }).state;
    const result = task.observe(spec, state, { ...samples[5], altFt: null, gsKts: null, headingDeg: null },
        { active: true, trackingActive: true });
    assert.equal(result.reason, 'survey_telemetry_invalid');
    assert.equal(result.progress.scan.activeLineId, '');
    assert.equal(result.progress.scan.completedCount, 0);
}

assert.equal(task.validateSpec({ ...scanRaw, center: { lat: 99, lon: 8.2 } }), 'survey_spec_location_invalid');
assert.equal(task.validateSpec({ ...scanRaw, scan: { ...scanRaw.scan, bins: 'NaN' } }), 'survey_spec_parameters_invalid');
assert.equal(task.validateSpec({ ...scanRaw, scan: { ...scanRaw.scan, lines: [{ id: 'same', start: { lat: 48.1, lon: 8.2 }, end: { lat: 48.1, lon: 8.2 } }] } }), 'survey_spec_lines_invalid');
assert.equal(task.validateSpec({ ...scanRaw, targetAltFt: Infinity }), 'survey_spec_parameters_invalid');

// Full runtime serialization resumes an in-progress line. The legacy hydrate
// intentionally drops it; worker checkpoints use hydrateRuntimeState instead.
{
    const spec = core.normalizeSpec(scanRaw);
    const samples = scanSamples(spec);
    let detector = core.createInitialState(spec);
    for (const sample of samples.slice(0, 10)) detector = core.tickState(spec, detector, { ...sample, nowMs: sample.observedAt }).state;
    const resumed = core.hydrateRuntimeState(spec, core.serializeState(detector));
    assert.equal(resumed.scan.active.lineId, detector.scan.active.lineId);
    for (const sample of samples.slice(10)) detector = core.tickState(spec, detector, { ...sample, nowMs: sample.observedAt }).state;
    let replay = resumed;
    for (const sample of samples.slice(10)) replay = core.tickState(spec, replay, { ...sample, nowMs: sample.observedAt }).state;
    assert.deepEqual(core.snapshotState(replay), core.snapshotState(detector));
}

// Corrupt checkpoint arrays cannot expand unbounded state or revive an invalid
// active segment; valid completed work is retained.
{
    const spec = core.normalizeSpec(scanRaw);
    const saved = task.createState(spec);
    saved.detector.scan.completedLineIds = [spec.scan.lines[0].id];
    saved.detector.scan.active = { lineId: spec.scan.lines[0].id, bins: Array(1000).fill(1), startedAt: NaN };
    const restored = task.createState(spec, saved);
    assert.equal(restored.progress.scan.completedCount, 1);
    assert.equal(restored.progress.scan.activeLineId, '');
}

console.log('tracker mission survey task tests ok');
