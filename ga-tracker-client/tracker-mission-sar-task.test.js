'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const sar = require('./tracker-mission-sar-task.js');
const taskCore = require('../mission-poi-task-core.js');

const recipe = () => ({
    schema: 'ga.mission-poi-execution-recipe.v1', version: 1, missionId: 'sar-fixed-wing',
    taskDomain: 'search_and_rescue', strict: true,
    target: { lat: 49, lon: 9 }, home: { lat: 48, lon: 8 }, trackingActive: true,
    passenger: { targetRadiusNm: 1.5, targetAltFt: 3000, targetDwellMin: 6 },
    sarReport: { schema: 'ga.sar-report.v1', confirmCoords: { lat: 48, lon: 8, name: 'Incidentanker' }, confirmRangeNm: 0.8 },
    voiceContext: { schema: 'ga.mission-poi-voice-context.v1', version: 1, missionId: 'sar-fixed-wing',
        taskDomain: 'search_and_rescue', strict: true, baseContext: 'SAR-Passagier', audioEnabled: false,
        passenger: { targetRadiusNm: 1.5, targetAltFt: 3000, targetDwellMin: 6 }, speaker: { name: 'Mia' },
        storyFrame: { focusSubject: 'vermisste Person', subjectDetail: 'die vermisste Person' },
        sarReport: { schema: 'ga.sar-report.v1', confirmCoords: { lat: 48, lon: 8, name: 'Incidentanker' }, confirmRangeNm: 0.8 } }
});
const previous = () => ({ schema: 'ga.tracker-poi-runtime.v1', missionId: 'sar-fixed-wing', sequence: 4,
    observedAt: 100000, suspendedAt: null,
    detector: { inRadius: false, enteredAt: null, lastTickTime: null, dwellSec: 30, attempts: 1,
        lastComplaintAt: null, altWasOk: null, satisfied: false, aborted: false, manualConfirmed: false,
        entryDone: false, sightCallDone: false, atTargetDone: false } });
const sample = (observedAt, patch = {}) => ({ observedAt, lat: 48, lon: 8, altFt: 1000,
    gsKts: 90, onGround: false, ...patch });

test('validates fixed-wing SAR confirmation contract and matching voice context', () => {
    assert.equal(sar.validateRecipe(recipe()), null);
    assert.equal(sar.validateRecipe({ ...recipe(), sarReport: { ...recipe().sarReport, confirmRangeNm: 0.81 } }), 'sar_report_recipe_invalid');
    assert.equal(sar.validateRecipe({ ...recipe(), sarReport: { ...recipe().sarReport, confirmRangeNm: 0.7 } }), 'sar_report_range_mismatch');
    assert.equal(sar.validateRecipe({ ...recipe(), voiceContext: { ...recipe().voiceContext, taskDomain: 'media_photo' } }), 'sar_voice_context_mismatch');
    assert.equal(sar.validateRecipe({ ...recipe(), voiceContext: { ...recipe().voiceContext, sarReport: { ...recipe().voiceContext.sarReport, confirmCoords: { lat: 49, lon: 9, name: 'Elsewhere' } } } }), 'sar_voice_report_context_mismatch');
    assert.equal(sar.validateRecipe({ ...recipe(), sarHeli: true }), 'sar_recipe_specialized_task_invalid');
});

test('manual report uses explicit incident anchor, boundary is inclusive, and full configured dwell is satisfied', () => {
    const r = recipe();
    const before = previous();
    const atBoundary = sample(100001, { lat: 48.013 });
    r.sarReport.confirmRangeNm = taskCore.distanceNm(48, 8, atBoundary.lat, atBoundary.lon);
    const boundaryRadius = r.sarReport.confirmRangeNm / 0.7;
    r.passenger.targetRadiusNm = boundaryRadius;
    r.voiceContext.passenger.targetRadiusNm = boundaryRadius;
    r.voiceContext.sarReport.confirmRangeNm = r.sarReport.confirmRangeNm;
    const result = sar.action(r, before, atBoundary, 100002);
    assert.equal(result.action, 'poi_report_found');
    assert.equal(result.poiTask.detector.satisfied, true);
    assert.equal(result.poiTask.detector.manualConfirmed, true);
    assert.equal(result.poiTask.detector.atTargetDone, true);
    assert.equal(result.poiTask.detector.dwellSec, 360);
    assert.equal(result.poiTask.sequence, 5);
    assert.equal(result.poiTask.observedAt, 100002);
    assert.match(result.voiceEffects[0].resolvedRecipe.prompt, /Missionsanker: Incidentanker/);
    assert.equal(before.detector.satisfied, false, 'action clones the checkpoint');
});

test('far manual report emits continue-search feedback without changing detector state', () => {
    const r = recipe();
    const before = previous();
    const result = sar.action(r, before, sample(100001, { lat: 48.02 }), 100002);
    assert.deepEqual(result.poiTask.detector, before.detector);
    assert.equal(result.poiTask.sequence, 5);
    assert.equal(result.voiceEffects[0].label, 'Weiter suchen');
    assert.match(result.voiceEffects[0].resolvedRecipe.fallbackText, /weiter suchen/);
});

test('rejects stale, paused, grounded, invalid, and already terminal reports', () => {
    for (const [s, now] of [[sample(94000), 100000], [sample(100001, { simPaused: true }), 100002],
        [sample(100001, { onGround: true }), 100002], [sample(100001, { lat: 91 }), 100002]]) {
        assert.throws(() => sar.action(recipe(), previous(), s, now), /sar_report_position_unavailable/);
    }
    const terminal = previous(); terminal.detector.satisfied = true;
    assert.throws(() => sar.action(recipe(), terminal, sample(100001), 100002), /sar_report_task_terminal/);
    const suspended = previous(); suspended.suspendedAt = 100000;
    assert.throws(() => sar.action(recipe(), suspended, sample(100001), 100002), /sar_report_position_unavailable/);
    assert.throws(() => sar.action(recipe(), previous(), sample(99999), 100002), /sar_report_position_unavailable/);
});

test('JSON restored detector and SAR result memory remain usable', () => {
    const r = recipe();
    const restored = JSON.parse(JSON.stringify(previous()));
    restored.detector.dwellSec = 400;
    const result = sar.action(r, restored, sample(100001), 100002, { sarSearchOutcome: 'not_found' });
    assert.equal(result.poiTask.detector.dwellSec, 400);
    assert.equal(result.voiceEffects[0].sarSearchOutcome, 'found');
    assert.equal(result.voiceEffects[0].memory.sarSearchOutcome, 'found');
});
