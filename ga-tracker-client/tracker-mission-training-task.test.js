'use strict';
const assert = require('node:assert/strict');
const original = require('../mission-training-procedure.js');
const { createAdapter } = require('./tracker-mission-training-task.js');
assert.equal(Object.prototype.hasOwnProperty.call(globalThis, 'GAMissionTrainingCore'), false);
const generated = require('../mission-training-core.js');
assert.equal(Object.prototype.hasOwnProperty.call(globalThis, 'GAMissionTrainingCore'), false);

const adapter = createAdapter({ clock: { now: () => 1000 } });
const specA = {
    missionData: {
        passenger: {
            taskDomain: 'training',
            trainingPlan: { focus: ['turn'], requiredCount: 1, readyMinAglFt: 1200 },
            trainingRecipe: { key: 'mission-a', requiredCount: 1, minDepartureDistanceNm: 5, exercises: [
                { id: 'turn-a', type: 'constant_bank_360', targetBankDeg: 30 }
            ] }
        },
        destName: 'Area A'
    }
};
const specB = {
    missionData: {
        passenger: {
            taskDomain: 'training',
            trainingRecipe: { key: 'mission-b', requiredCount: 1, minDepartureDistanceNm: 5, exercises: [
                { id: 'turn-b', type: 'turn_180', targetBankDeg: 25 }
            ] }
        },
        destName: 'Area B'
    }
};
const flight = (headingDeg, extra = {}) => ({
    lat: 47, lon: 8, departureDistanceNm: 6, nowMs: 10000,
    flightData: { mslFt: 5000, aglFt: 3000, hdg: headingDeg, bankDeg: 0, vsFpm: 0, onGround: false, ...extra }
});

// Two states remain isolated even though the source implementation normally
// stores one active state in its module closure.
let a = adapter.createState(specA);
let b = adapter.createState(specB);
const aFirst = adapter.observe(specA, a, flight(90));
a = aFirst.state;
assert.equal(aFirst.events[0]?.type, 'exercise_instruction');
assert.equal(a.recipeKey, 'mission-a');
assert.equal(b.recipeKey, 'mission-b');
assert.equal(b.procedureState.activeState.startedAt, 0);

// Full import/export retains a real in-progress turn across resume.
function createMidTurnCore() {
    const core = generated.create({}, { now: () => 13200 });
    core.initialize(specA.missionData, specA.missionData.passenger);
    const tick = (nowMs, flightData) => core.tick({
        missionData: specA.missionData, passenger: specA.missionData.passenger,
        lat: 47, lon: 8, departureDistanceNm: 6, flightData, nowMs
    });
    tick(10000, { mslFt: 5000, aglFt: 3000, hdg: 90, bankDeg: 0, vsFpm: 0, onGround: false });
    tick(13100, { mslFt: 5000, aglFt: 3000, hdg: 90, bankDeg: 0, vsFpm: 0, onGround: false });
    assert.equal(core.signalReady(specA.missionData, specA.missionData.passenger).ok, true);
    tick(13201, { mslFt: 5000, aglFt: 3000, hdg: 90, bankDeg: 0, vsFpm: 0, onGround: false });
    tick(13301, { mslFt: 5000, aglFt: 3000, hdg: 95, bankDeg: 25, vsFpm: 0, onGround: false });
    return core;
}
const midTurnCore = createMidTurnCore();
const recipeA = midTurnCore.getActiveRecipe(specA.missionData, specA.missionData.passenger);
const raw = midTurnCore.exportFullState();
assert.equal(raw.activeState.active.phase, 'turning');
assert.ok(raw.activeState.lastSample);
const exported = JSON.parse(JSON.stringify(raw));
const uninterruptedCore = generated.create({}, { now: () => 13401 });
uninterruptedCore.importFullState(exported);
const resumedCore = generated.create({}, { now: () => 13401 });
resumedCore.importFullState(exported);
const resumeInput = {
    missionData: specA.missionData, passenger: specA.missionData.passenger,
    lat: 47, lon: 8, departureDistanceNm: 6,
    flightData: { mslFt: 5000, aglFt: 3000, hdg: 100, bankDeg: 28, vsFpm: 0, gForce: 1.4 },
    nowMs: 13401
};
const normalizedResumeSample = {
    lat: 47, lon: 8, altFt: 5000, aglFt: 3000, headingDeg: 100,
    bankDeg: 28, vsFpm: 0, gForce: 1.4, onGround: false, nowMs: 13401
};
const originalResume = original._test.tickState(recipeA, JSON.parse(JSON.stringify(raw.activeState)), normalizedResumeSample);
const generatedResume = generated.create({}, { now: () => 13401 })._test.tickState(
    recipeA, JSON.parse(JSON.stringify(raw.activeState)), normalizedResumeSample
);
assert.deepEqual(generatedResume.events, originalResume.events);
assert.deepEqual(generatedResume.progress, originalResume.progress);
const uninterrupted = uninterruptedCore.tick(resumeInput);
const resumed = resumedCore.tick(resumeInput);
assert.deepEqual(resumed.events, uninterrupted.events);
assert.deepEqual(resumed.progress, uninterrupted.progress);

// Ready action preserves original gates and uses explicitly injected action time.
const readySpec = { ...specA, missionData: JSON.parse(JSON.stringify(specA.missionData)) };
let readyState = adapter.createState(readySpec);
let readyCore = generated.create({}, { now: () => 30000 });
readyCore.initialize(readySpec.missionData, readySpec.missionData.passenger);
let readyRaw = readyCore.exportFullState();
readyRaw.activeState.departureGatePassed = true;
readyRaw.activeState.readyPrompted = true;
readyRaw.activeState.startAvailable = true;
readyState = { ...readyState, procedureState: readyRaw };
const ready = adapter.action(readySpec, readyState, { type: 'ready' }, 30000);
assert.equal(ready.ok, true);
assert.equal(ready.state.procedureState.activeState.updatedAt, 30000);
assert.equal(ready.state.procedureState.activeState.ready, true);

// Abort and optional-extra actions invoke the source control semantics.
const abortSpec = { ...specA, missionData: JSON.parse(JSON.stringify(specA.missionData)) };
let abortCore = generated.create({}, { now: () => 40000 });
abortCore.initialize(abortSpec.missionData, abortSpec.missionData.passenger);
let abortRaw = abortCore.exportFullState();
abortRaw.activeState.departureGatePassed = true;
abortRaw.activeState.ready = true;
abortRaw.activeState.startedAt = 1;
abortRaw.activeState.active = { exerciseId: 'turn-a', phase: 'turning' };
abortRaw.activeState.exercises[0].status = 'active';
const wrappedAbortState = { schema: 'ga.trackerTrainingTaskState.v1', recipeKey: 'mission-a', procedureState: abortRaw };
const aborted = adapter.action(abortSpec, wrappedAbortState, { type: 'abort' }, 41000);
assert.equal(aborted.ok, true);
assert.equal(aborted.state.procedureState.activeState.exercises[0].status, 'repeat');
assert.equal(aborted.state.procedureState.activeState.nextInstructionAt, 46000);

const extraRaw = JSON.parse(JSON.stringify(abortRaw));
extraRaw.activeState.requiredComplete = true;
extraRaw.activeState.satisfied = true;
extraRaw.activeState.active = null;
extraRaw.activeState.activeIndex = 0;
extraRaw.activeState.exercises[0].status = 'pending';
const wrappedExtraState = { schema: 'ga.trackerTrainingTaskState.v1', recipeKey: 'mission-a', procedureState: extraRaw };
const extra = adapter.action(abortSpec, wrappedExtraState, { type: 'optional' }, 50000);
assert.equal(extra.ok, true);
assert.equal(extra.state.procedureState.activeState.optionalRequested, true);

// Original and generated evaluators agree on ordinary procedure samples.
original.reset();
const originalRecipe = original.getActiveRecipe(specA.missionData, specA.missionData.passenger);
original.restoreProgress(original.createInitialState(originalRecipe), specA.missionData, specA.missionData.passenger);
const originalTick = original.tick({ ...flight(90), missionData: specA.missionData, passenger: specA.missionData.passenger });
const generatedCore = generated.create({}, { now: () => 10000 });
generatedCore.initialize(specA.missionData, specA.missionData.passenger);
const generatedTick = generatedCore.tick({ ...flight(90), missionData: specA.missionData, passenger: specA.missionData.passenger });
assert.deepEqual(generatedTick.events, originalTick.events);
assert.deepEqual(generatedTick.progress, originalTick.progress);
const clockDriven = adapter.observe(specA, adapter.createState(specA), {
    lat: 47, lon: 8, departureDistanceNm: 6, observedAt: 123456,
    mslFt: 5000, aglFt: 3000, hdg: 90, onGround: false
});
assert.equal(clockDriven.state.procedureState.activeState.updatedAt, 123456);
assert.throws(() => adapter.createState(specA, b), /training_recipe_key_mismatch/);
assert.throws(() => adapter.createState(specA, { ...a, recipeKey: 'mission-b' }), /training_recipe_key_mismatch/);
const malformedState = JSON.parse(JSON.stringify(a));
malformedState.procedureState.activeState.recipeKey = 'mission-b';
assert.throws(() => adapter.createState(specA, malformedState), /training_recipe_key_mismatch/);
assert.equal(adapter.observe(specA, adapter.createState(specA), {
    observedAt: '123456', hdg: 90, altFt: 5000, aglFt: 3000, departureDistanceNm: 6,
    flightData: { onGround: false }
}).state.procedureState.activeState.updatedAt, 1000);
console.log('tracker mission training task tests passed');
