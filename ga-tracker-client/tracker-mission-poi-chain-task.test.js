'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const core = require('../mission-poi-chain-core.js');
const task = require('./tracker-mission-poi-chain-task.js');

function legacyApi() {
    const code = fs.readFileSync(path.join(__dirname, '..', 'tools', 'fixtures', 'poi-chain-legacy-20260922.js'), 'utf8');
    const context = { window: {}, console, Date, Math, Set, Map, Number, String, Array, Object, JSON };
    vm.createContext(context);
    vm.runInContext(code, context, { filename: 'poi-chain-legacy-20260922.js' });
    return context.window.missionPoiChainRuntime._test;
}
const legacy = legacyApi();

const raw = {
    schema: 'ga.poiChain.v1', key: 'chain-worker-test', label: 'Leitungskontrolle',
    overlay: { widthNm: 0.6, widthVersion: 2, trace: [{ lat: 48, lon: 8 }, { lat: 48.03, lon: 8 }] },
    corridor: { targetSegmentLengthNm: 2.5, minCoverage: 0.6, bins: 12, resetGraceSec: 2, minGroundSpeedKts: 35 },
    points: [
        { id: 'p1', lat: 48, lon: 8, triggerRadiusNm: 0.12 },
        { id: 'p2', lat: 48.015, lon: 8, triggerRadiusNm: 0.12 },
        { id: 'p3', lat: 48.03, lon: 8, triggerRadiusNm: 0.12 }
    ]
};
const samples = Array.from({ length: 31 }, (_, index) => ({ lat: 48 + index * 0.001, lon: 8,
    headingDeg: 0, gsKts: 85, observedAt: (index + 1) * 1000 }));

// The extracted core is step-for-step identical to the frozen original,
// including point reveal event order and corridor bins.
{
    const oldSpec = legacy.normalizeSpec(raw), spec = core.normalizeSpec(raw);
    let oldState = legacy.createInitialState(oldSpec), newState = core.createInitialState(spec);
    for (const sample of samples) {
        const oldTick = legacy.tickState(oldSpec, oldState, { ...sample, nowMs: sample.observedAt });
        const newTick = core.tickState(spec, newState, { ...sample, nowMs: sample.observedAt });
        oldState = oldTick.state; newState = newTick.state;
        assert.deepEqual(JSON.parse(JSON.stringify(newTick.events)), JSON.parse(JSON.stringify(oldTick.events)));
        assert.deepEqual(core.snapshotState(newState), JSON.parse(JSON.stringify(legacy.snapshotState(oldState))));
    }
}

// Sparse plausible worker samples are filled only between nearby, believable
// endpoints and retain the same completed points and corridor result.
{
    let state = null;
    for (const index of [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30]) state = task.observe(raw, state, samples[index], { active: true, trackingActive: true }).state;
    assert.equal(state.progress.satisfied, true);
    assert.deepEqual(state.progress.completedPointIds, ['p1', 'p2', 'p3']);
    assert.equal(state.progress.corridor.completedCount, core.normalizeSpec(core.normalizeSpec(raw)).corridor.segments.length);
}

// Pause, ground, slew, a bad GPS sample, teleport, and a long gap sever an
// unfinished corridor while keeping durable completions intact.
{
    let state = task.observe(raw, null, samples[0], { active: true, trackingActive: true }).state;
    state = task.observe(raw, state, samples[3], { active: true, trackingActive: true }).state;
    let out = task.observe(raw, state, { observedAt: 4500, simPaused: true }, { active: true, trackingActive: true });
    assert.equal(out.state.previousSample, null);
    assert.ok(out.events.some(event => event.type === 'corridor_segment_reset_discontinuity'));
    out = task.observe(raw, out.state, { ...samples[4], observedAt: 5500, slewActive: true }, { active: true, trackingActive: true });
    assert.equal(out.progress.corridor.completedCount, 0);
    state = task.observe(raw, null, samples[0], { active: true, trackingActive: true }).state;
    state = task.observe(raw, state, samples[3], { active: true, trackingActive: true }).state;
    out = task.observe(raw, state, { ...samples[20], observedAt: 4500 }, { active: true, trackingActive: true });
    assert.ok(out.events.some(event => event.reason === 'teleport'));
    out = task.observe(raw, out.state, { ...samples[21], observedAt: 12000 }, { active: true, trackingActive: true });
    assert.ok(out.events.some(event => event.reason === 'long_gap') || out.progress.corridor.activeSegmentId === '');
    out = task.observe(raw, out.state, { observedAt: 13000, lat: null, lon: null }, { active: true, trackingActive: true });
    assert.equal(out.reason, 'poi_chain_telemetry_invalid');
}

// Checkpoints resume bounded active bins and reject malformed state without
// letting arrays or unknown IDs grow the persisted detector.
{
    let state = null;
    for (const index of [0, 1, 2, 3]) state = task.observe(raw, state, samples[index], { active: true, trackingActive: true }).state;
    const resumed = task.createState(raw, state);
    assert.equal(resumed.detector.corridor.active.bins.length, state.detector.corridor.active.bins.length);
    const corrupt = task.createState(raw, { ...state, detector: { ...state.detector, completedPointIds: Array(99).fill('p1'),
        corridor: { ...state.detector.corridor, active: { ...state.detector.corridor.active, bins: Array(99).fill(0) } } } });
    assert.equal(corrupt.progress.completedCount, 0);
    assert.equal(corrupt.progress.corridor.activeSegmentId, '');
}

// A JSON checkpoint of the same mission preserves the effective (tick-time)
// corridor predicate and emits the original hidden outcome at its point after
// restart. It must not declare the chain complete after only its first segment.
{
    const outcomeRaw = { ...raw, key: 'chain-worker-outcome', hiddenOutcome: {
        pointId: 'p2', outcome: 'inspect_followup', findingKind: 'damage', findingHint: 'Leck gefunden',
        paxFindingText: 'Am zweiten Punkt ist ein Leck sichtbar.'
    } };
    let state = null;
    for (const index of [0, 2, 4, 6, 8]) state = task.observe(outcomeRaw, state, samples[index], { active: true, trackingActive: true }).state;
    assert.equal(state.progress.corridor.completedCount, 1);
    assert.equal(state.progress.satisfied, false);
    state = task.createState(outcomeRaw, JSON.parse(JSON.stringify(state)));
    assert.equal(state.progress.satisfied, false);
    const events = [];
    for (const index of [10, 12, 14, 16]) {
        const observed = task.observe(outcomeRaw, state, samples[index], { active: true, trackingActive: true });
        state = observed.state;
        events.push(...observed.events);
    }
    const pointEvent = events.find(event => event.type === 'point_complete' && event.point.id === 'p2');
    assert.equal(pointEvent.hiddenOutcome.outcome, 'inspect_followup');
    assert.equal(pointEvent.findingText, 'Am zweiten Punkt ist ein Leck sichtbar.');
}

// A plausible short gap can cross more than one close point. Keep its original
// tick event groups so the runtime can prepare each finding in order instead
// of flattening them into one voice decision.
{
    const closeRaw = { key: 'chain-worker-close-points', corridor: { enabled: false }, hiddenOutcome: {
        pointId: 'p2', outcome: 'monitor', findingKind: 'corrosion', findingHint: 'Korrosion', paxFindingText: 'Korrosion sichtbar.' },
        points: [{ id: 'p1', lat: 48, lon: 8, triggerRadiusNm: .15 }, { id: 'p2', lat: 48.001, lon: 8, triggerRadiusNm: .15 }, { id: 'p3', lat: 48.002, lon: 8, triggerRadiusNm: .15 }] };
    let state = task.observe(closeRaw, null, { observedAt: 1000, lat: 48, lon: 8, gsKts: 85, headingDeg: 0 }, { active: true, trackingActive: true }).state;
    const out = task.observe(closeRaw, state, { observedAt: 3000, lat: 48.002, lon: 8, gsKts: 85, headingDeg: 0 }, { active: true, trackingActive: true });
    const pointBatches = out.eventBatches.filter(batch => batch.some(event => event.type === 'point_complete'));
    assert.deepEqual(pointBatches.map(batch => batch.find(event => event.type === 'point_complete').point.id), ['p2', 'p3']);
    assert.equal(pointBatches[0].find(event => event.type === 'point_complete').findingText, 'Korrosion sichtbar.');
    assert.equal(pointBatches[1].find(event => event.type === 'point_complete').findingText, '');
    assert.deepEqual(out.events.filter(event => event.type === 'point_complete').map(event => event.point.id), ['p2', 'p3']);
}

assert.equal(task.validateSpec({ ...raw, points: raw.points.slice(0, 1) }), 'poi_chain_spec_points_invalid');
assert.equal(task.validateSpec({ ...raw, points: [{ ...raw.points[0], id: 'same' }, { ...raw.points[1], id: 'same' }] }), 'poi_chain_spec_points_invalid');
assert.equal(task.validateSpec({ ...raw, corridor: { ...raw.corridor, bins: 'NaN' } }), 'poi_chain_spec_corridor_invalid');
assert.equal(task.validateSpec({ ...raw, overlay: { trace: Array(81).fill({ lat: 48, lon: 8 }) } }), 'poi_chain_spec_trace_invalid');
assert.throws(() => task.createState(raw, { schema: task.RUNTIME_SCHEMA, specKey: 'other' }), /poi_chain_runtime_identity_mismatch/);

console.log('tracker mission poi-chain task tests ok');
