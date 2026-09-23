'use strict';

const generated = require('../mission-training-core.js');

function cloneJson(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

function missionContext(spec = {}) {
    const missionData = spec.missionData && typeof spec.missionData === 'object' ? spec.missionData : null;
    const passenger = spec.passenger && typeof spec.passenger === 'object'
        ? spec.passenger
        : (missionData?.passenger || null);
    return { missionData, passenger };
}

function timestampMs(value) {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

function normalizedFlightData(sample = {}) {
    const source = sample.flightData && typeof sample.flightData === 'object' ? sample.flightData : sample;
    const pick = (...keys) => {
        for (const key of keys) if (source[key] != null) return source[key];
        return undefined;
    };
    return {
        ...cloneJson(source),
        mslFt: pick('mslFt', 'altFt', 'altitudeFt'),
        aglFt: pick('aglFt'),
        hdg: pick('hdg', 'headingDeg', 'heading', 'trackDeg', 'trkDeg'),
        bankDeg: pick('bankDeg'),
        pitchDeg: pick('pitchDeg', 'pitch'),
        iasKts: pick('iasKts', 'ias', 'indicatedAirspeedKts'),
        gsKts: pick('gsKts', 'gs', 'groundSpeed'),
        vsFpm: pick('vsFpm', 'vs'),
        gForce: pick('gForce'),
        aoaDeg: pick('aoaDeg'),
        stallState: pick('stallState'),
        onGround: source.onGround === true
    };
}

function stateEnvelope(core, initialized) {
    const procedureState = core.exportFullState();
    return {
        schema: 'ga.trackerTrainingTaskState.v1',
        recipeKey: String(procedureState.activeRecipeKey || initialized?.activeRecipeKey || ''),
        procedureState
    };
}

function importState(core, state, expectedRecipeKey) {
    if (!state || typeof state !== 'object'
        || state.schema !== 'ga.trackerTrainingTaskState.v1'
        || !state.procedureState || typeof state.procedureState !== 'object') {
        throw new Error('invalid_training_state');
    }
    if (!state.procedureState.activeState || typeof state.procedureState.activeState !== 'object') {
        throw new Error('invalid_training_state');
    }
    if (String(state.recipeKey || '') !== String(expectedRecipeKey || '')
        || String(state.procedureState.activeRecipeKey || '') !== String(expectedRecipeKey || '')
        || String(state.procedureState.activeState.recipeKey || '') !== String(expectedRecipeKey || '')) {
        throw new Error('training_recipe_key_mismatch');
    }
    core.importFullState(state.procedureState);
}

function createAdapter(options = {}) {
    const factory = options.createCore || generated?.create;
    if (typeof factory !== 'function') throw new Error('training_core_unavailable');
    const clock = options.clock || { now: () => Date.now() };

    function newCore() {
        return factory({}, clock);
    }

    function createState(spec = {}, saved = null) {
        const { missionData, passenger } = missionContext(spec);
        const core = newCore();
        const initialized = core.initialize(missionData, passenger);
        if (!initialized?.activeRecipeKey) throw new Error('training_recipe_unavailable');
        if (saved != null) importState(core, saved, initialized.activeRecipeKey);
        return stateEnvelope(core, initialized);
    }

    function observe(spec = {}, state = null, sample = {}) {
        const { missionData, passenger } = missionContext(spec);
        const core = newCore();
        const initialized = core.initialize(missionData, passenger);
        if (!initialized?.activeRecipeKey) throw new Error('training_recipe_unavailable');
        if (state != null) importState(core, state, initialized.activeRecipeKey);
        const observedAt = timestampMs(sample.observedAt);
        const suppliedNow = sample.nowMs != null ? timestampMs(sample.nowMs) : null;
        const nowMs = suppliedNow ?? observedAt ?? Number(clock.now());
        const flightData = normalizedFlightData(sample);
        const headingDeg = sample.headingDeg ?? sample.hdg ?? flightData.hdg;
        const input = {
            missionData,
            passenger,
            lat: sample.lat,
            lon: sample.lon,
            headingDeg,
            altFt: sample.altFt ?? sample.mslFt,
            aglFt: sample.aglFt,
            departureDistanceNm: sample.departureDistanceNm,
            flightData,
            nowMs
        };
        const result = core.tick(input);
        return {
            handled: !!result?.handled,
            satisfied: !!result?.satisfied,
            progress: cloneJson(result?.progress || null),
            events: cloneJson(result?.events || []),
            recipe: cloneJson(result?.recipe || null),
            state: stateEnvelope(core, initialized)
        };
    }

    function action(spec = {}, state = null, intent = {}, now = null) {
        const { missionData, passenger } = missionContext(spec);
        const core = factory({}, { now: () => now != null && Number.isFinite(Number(now)) ? Number(now) : Number(clock.now()) });
        const initialized = core.initialize(missionData, passenger);
        if (!initialized?.activeRecipeKey) throw new Error('training_recipe_unavailable');
        if (state != null) importState(core, state, initialized.activeRecipeKey);
        const type = String(intent?.type || intent?.kind || '').toLowerCase();
        let result;
        if (type === 'ready' || type === 'signal_ready') result = core.signalReady(missionData, passenger);
        else if (type === 'abort' || type === 'abort_exercise') result = core.abortExercise(missionData, passenger);
        else if (type === 'optional' || type === 'request_optional' || type === 'request_optional_exercise') {
            result = core.requestOptionalExercise(missionData, passenger);
        } else return { ok: false, reason: 'unknown_intent', state: state || createState(spec) };
        return { ...cloneJson(result), state: stateEnvelope(core, initialized) };
    }

    return { createState, observe, action };
}

module.exports = { createAdapter };
