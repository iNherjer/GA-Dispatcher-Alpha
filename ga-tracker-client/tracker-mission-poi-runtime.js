'use strict';

const taskCore = require('../mission-poi-task-core.js');
const { canonicalStringify } = require('../mission-execution-core.js');
const chainTask = require('./tracker-mission-poi-chain-task.js');
const chainVoice = require('./tracker-mission-poi-chain-voice.js');
const surveyTask = require('./tracker-mission-survey-task.js');
const surveyVoice = require('./tracker-mission-survey-voice.js');
const voiceCore = require('../mission-poi-voice-core.js');
const lifecycleCore = require('../mission-poi-lifecycle-core.js');
const boardingCore = require('../mission-boarding-voice-core.js');
const { commandTemplateFor } = require('./tracker-mission-simulator-effects.js');
const { prepareCue } = require('./tracker-mission-poi-voice.js');

const RECIPE_SCHEMA = 'ga.mission-poi-execution-recipe.v1';
const RUNTIME_SCHEMA = 'ga.tracker-poi-runtime.v1';
// Explicitly bounded standard POI family. A transport adapter named "poi"
// is insufficient: specialized tasks need their own execution/voice contracts.
const DOMAINS = Object.freeze(['media_photo', 'inspection_infra', 'news_coverage', 'science_bio', 'science_geo', 'science_general', 'sightseeing_tour', 'poi_learning_guide', 'mapping_survey', 'infra_chain_recon']);
const clone = value => JSON.parse(JSON.stringify(value));
const finite = value => typeof value === 'number' && Number.isFinite(value);
function point(value) {
    return value && finite(value.lat) && finite(value.lon)
        && Math.abs(value.lat) <= 90 && Math.abs(value.lon) <= 180;
}

function validateRecipe(recipe) {
    if (!recipe || recipe.schema !== RECIPE_SCHEMA || recipe.version !== 1) return 'poi_recipe_schema_invalid';
    if (!recipe.missionId || typeof recipe.missionId !== 'string') return 'poi_recipe_mission_required';
    if (!DOMAINS.includes(recipe.taskDomain)) return 'poi_recipe_domain_not_migrated';
    if (!point(recipe.target) || !point(recipe.home)) return 'poi_recipe_location_invalid';
    if (typeof recipe.strict !== 'boolean') return 'poi_recipe_difficulty_required';
    if (typeof recipe.trackingActive !== 'boolean') return 'poi_recipe_tracking_context_required';
    const pax = recipe.passenger;
    if (!pax || !finite(pax.targetRadiusNm) || pax.targetRadiusNm <= 0
        || !finite(pax.targetAltFt) || pax.targetAltFt < 0
        || !finite(pax.targetDwellMin) || pax.targetDwellMin < 0) return 'poi_recipe_task_parameters_invalid';
    if (recipe.voiceContext) {
        const voiceError = voiceCore.validateContext(recipe.voiceContext, recipe.missionId);
        if (voiceError) return voiceError;
        if (recipe.voiceContext.taskDomain !== recipe.taskDomain || recipe.voiceContext.strict !== recipe.strict
            || ['targetRadiusNm', 'targetAltFt', 'targetDwellMin'].some(key => recipe.voiceContext.passenger[key] !== pax[key]))
            return 'poi_voice_task_context_mismatch';
    }
    if (recipe.lifecycle && (recipe.lifecycle.schema !== lifecycleCore.SCHEMA || !recipe.voiceContext))
        return 'poi_lifecycle_context_invalid';
    if (recipe.taskDomain === 'mapping_survey') {
        const error = surveyTask.validateSpec(recipe.surveyPattern);
        if (error) return error;
        if (!recipe.voiceContext?.surveySpec || canonicalStringify(recipe.voiceContext.surveySpec) !== canonicalStringify(recipe.surveyPattern)) return 'survey_voice_spec_mismatch';
    } else if (recipe.surveyPattern || pax.surveyPattern) return 'poi_recipe_specialized_task_not_migrated';
    if (recipe.taskDomain === 'infra_chain_recon') {
        const error = chainTask.validateSpec(recipe.poiChain);
        if (error) return error;
        const cues = { point_complete: 'photo', chain_corridor_entered: 'scan_start', chain_corridor_complete: 'handoff', chain_complete: 'handoff', ...recipe.voiceContext?.chainAudioCueIds };
        if (Object.values(cues).some(id => id !== 'none' && !recipe.voiceContext?.chainAudioDefinitions?.[id])) return 'poi_chain_audio_definition_missing';
        if (!recipe.voiceContext?.chainSpec || canonicalStringify(recipe.voiceContext.chainSpec) !== canonicalStringify(recipe.poiChain)) return 'poi_chain_voice_spec_mismatch';
    } else if (recipe.poiChain || pax.poiChain || recipe.missionSubType === 'poi_chain') return 'poi_recipe_specialized_task_not_migrated';
    if ([recipe, pax].some(source => source.trainingProcedure || source.sarHeli || source.bush
        )) return 'poi_recipe_specialized_task_not_migrated';
    return null;
}

function validateBundle(bundle) {
    const error = validateRecipe(bundle?.executionPoiRecipe);
    if (error) return error;
    if (bundle.executionPoiRecipe.missionId !== bundle.missionId) return 'poi_recipe_mission_mismatch';
    if (!bundle.executionPoiRecipe.lifecycle) return null; // internal task-only fixtures
    const plan = bundle.executionEffectPlan;
    if (plan?.schema !== 'ga.mission-poi-effect-plan.v1' || plan.recipe !== 'poi'
        || plan.missionId !== bundle.missionId) return 'poi_effect_plan_invalid';
    if (plan.effects?.['voice.farewell']?.poiContextRef !== true
        || plan.effects?.['voice.approach']?.context?.supported !== true
        || !boardingCore.normalizeRecipe(plan.effects?.['voice.boarding']?.recipe)
        || plan.effects['voice.boarding'].recipe.missionId !== bundle.missionId
        || plan.effects['voice.approach'].context.missionId !== bundle.missionId) return 'poi_lifecycle_voice_plan_invalid';
    for (const type of ['scene.prepare', 'scene.boarding', 'scene.deboarding', 'scene.target']) {
        if (!plan.effects?.[type]?.command && plan.effects?.[type]?.none !== true) return 'poi_lifecycle_scene_plan_missing';
        const entry = plan.effects[type];
        if (entry.command && (entry.none === true || !commandTemplateFor(plan, type))) return 'poi_lifecycle_scene_plan_invalid';
        if (type === 'scene.target' && entry.command && (!point(entry.command)
            || !finite(entry.command.altFt) || !finite(entry.command.hdg))) return 'poi_lifecycle_target_position_invalid';
    }
    return null;
}

function createState(recipe, previous = null) {
    const error = validateRecipe(recipe);
    if (error) throw new TypeError(error);
    if (previous && (previous.schema !== RUNTIME_SCHEMA || previous.missionId !== recipe.missionId)) {
        throw new TypeError('poi_runtime_identity_mismatch');
    }
    if (previous && (!Number.isSafeInteger(previous.sequence) || previous.sequence < 0
        || (previous.observedAt !== null && (!finite(previous.observedAt) || previous.observedAt < 0))
        || (previous.suspendedAt !== null && (!finite(previous.suspendedAt) || previous.suspendedAt < 0
            || previous.observedAt === null || previous.suspendedAt > previous.observedAt))
        || !taskCore.isState(previous.detector))) throw new TypeError('poi_runtime_state_invalid');
    return {
        schema: RUNTIME_SCHEMA,
        missionId: recipe.missionId,
        sequence: Math.max(0, Number(previous?.sequence) || 0),
        observedAt: previous?.observedAt ?? null,
        suspendedAt: previous?.suspendedAt ?? null,
        detector: taskCore.createState(previous?.detector),
        ...(recipe.taskDomain === 'infra_chain_recon' ? { chainState: chainTask.createState(recipe.poiChain, previous?.chainState) } : {}),
        ...(recipe.taskDomain === 'mapping_survey' ? { surveyState: surveyTask.createState(recipe.surveyPattern, previous?.surveyState) } : {})
    };
}

// The outer scheduler owns fresh telemetry and persistence; this adapter owns
// only per-run POI observations. No timers, global singleton, UI, audio or I/O.
function observe(recipe, previous, sample, facts = {}) {
    const state = createState(recipe, previous);
    const unchanged = reason => ({ state, effects: [], changed: false, reason });
    if (!finite(sample?.observedAt) || sample.observedAt < 0) return unchanged('poi_telemetry_invalid');
    if (state.observedAt !== null && sample.observedAt <= state.observedAt) return unchanged('poi_telemetry_stale');
    if (facts.active !== true || facts.trackingActive !== true || facts.ending === true) return unchanged('poi_task_inactive');
    if (state.detector.satisfied || state.detector.aborted) return unchanged('poi_task_terminal');

    const suspended = sample.simPaused === true || sample.inMenuOrMap === true || facts.suspended === true
        || (['mapping_survey', 'infra_chain_recon'].includes(recipe.taskDomain) && (sample.onGround === true || sample.slewActive === true || sample.slewMode === true || sample.isSlewActive === true));
    // A pause/menu status is useful even when the simulator omits position.
    // Only a valid running sample may release the persisted suspension.
    if (!suspended && (!point(sample) || !finite(sample.altFt)
        || !finite(sample.gsKts))) {
        if (state.chainState) {
            state.chainState = chainTask.suspend(recipe.poiChain, state.chainState, 'invalid').state;
            state.observedAt = sample.observedAt; state.sequence++; state.suspendedAt = sample.observedAt;
            return { state, effects: [], changed: true, reason: 'poi_chain_telemetry_invalid' };
        }
        if (recipe.taskDomain !== 'mapping_survey') return unchanged('poi_telemetry_invalid');
        state.surveyState = surveyTask.suspend(recipe.surveyPattern, state.surveyState, 'invalid').state;
        state.observedAt = sample.observedAt; state.sequence++; state.suspendedAt = sample.observedAt;
        return { state, effects: [], changed: true, reason: 'survey_telemetry_invalid' };
    }

    let chainResult = null;
    if (state.chainState) {
        chainResult = chainTask.observe(recipe.poiChain, state.chainState, sample, facts);
        state.chainState = chainResult.state;
        const progress = chainResult.progress;
        // Original _tickPoiChainTask runs before the common cargo/task checks.
        if (progress?.updatedAt) {
            if (progress.startedAt) state.detector.dwellSec = Math.max(state.detector.dwellSec, (progress.updatedAt - progress.startedAt) / 1000);
            state.detector.inRadius = true; state.detector.entryDone = true;
            if (!state.detector.enteredAt) state.detector.enteredAt = progress.startedAt || progress.updatedAt;
            state.detector.lastTickTime = sample.observedAt;
        }
        if (chainResult.satisfied) {
            Object.assign(state.detector, { satisfied: true, atTargetDone: true, inRadius: true, entryDone: true });
            if (!chainResult.events.some(event => event.type === 'chain_complete')) {
                const completed = [{ type: 'chain_complete' }];
                chainResult.events.push(...completed);
                if (chainResult.eventBatches) chainResult.eventBatches.push(completed);
            }
        }
    }
    let surveyResult = null;
    if (recipe.taskDomain === 'mapping_survey') {
        surveyResult = surveyTask.observe(recipe.surveyPattern, state.surveyState, sample, facts);
        state.surveyState = surveyResult.state;
        const progress = surveyResult.progress || state.surveyState.progress;
        if (progress?.startedAt && progress?.updatedAt) {
            state.detector.dwellSec = Math.max(state.detector.dwellSec, (progress.updatedAt - progress.startedAt) / 1000);
            state.detector.inRadius = true;
            state.detector.entryDone = true;
            if (!state.detector.enteredAt) state.detector.enteredAt = progress.startedAt;
            state.detector.lastTickTime = sample.observedAt;
        }
        if (surveyResult.satisfied) Object.assign(state.detector, { satisfied: true, atTargetDone: true, inRadius: true, entryDone: true });
    }
    state.observedAt = sample.observedAt;
    state.sequence++;
    if (suspended) {
        if (state.suspendedAt === null) state.suspendedAt = sample.observedAt;
        return { state, effects: [], changed: true, reason: 'poi_task_suspended' };
    }
    if (state.suspendedAt !== null) {
        // Pause detector clocks rather than accumulating offline work or
        // immediately exhausting the original complaint/grace intervals.
        const elapsed = Math.max(0, sample.observedAt - state.suspendedAt);
        for (const key of ['enteredAt', 'lastTickTime', 'lastComplaintAt']) {
            if (state.detector[key] !== null) state.detector[key] += elapsed;
        }
        state.suspendedAt = null;
    }
    const distNm = taskCore.distanceNm(sample.lat, sample.lon, recipe.target.lat, recipe.target.lon);
    const effectiveGs = sample.gsKts > 25 ? sample.gsKts : 95;
    const bearing = taskCore.bearingDeg(sample.lat, sample.lon, recipe.target.lat, recipe.target.lon);
    const flightData = { ...sample, mslFt: Math.max(0, Math.round(sample.altFt)), gs: sample.gsKts };
    const result = taskCore.observe(state.detector, {
        pax: recipe.passenger,
        taskDomain: recipe.taskDomain,
        surveyTickResult: surveyResult ? { ...surveyResult, handled: true, progress: surveyResult.progress || state.surveyState.progress } : null,
        surveySpec: recipe.surveyPattern || null,
        poiChainTickResult: chainResult ? { ...chainResult, handled: true } : null,
        strict: recipe.strict,
        now: sample.observedAt,
        distNm,
        effectiveGs,
        etaMin: distNm / effectiveGs * 60,
        clockPos: taskCore.relativeClockPos(bearing, sample.hdg || bearing),
        flightData,
        taskItemState: facts.taskItemState || { blockingItems: [], reason: 'missing' }
    });
    state.detector = result.state;
    if (chainResult?.events?.length) result.effects.unshift(...(chainResult.eventBatches || [chainResult.events]).filter(events => events.length).map(events => ({ type: 'chain', events })));
    if (surveyResult?.events?.length) result.effects.unshift({ type: 'survey', events: surveyResult.events });
    return { state, effects: result.effects, changed: true, reason: 'poi_task_observed', distNm };
}

function suspend(recipe, previous) {
    const state = createState(recipe, previous);
    if (state.chainState) state.chainState = chainTask.suspend(recipe.poiChain, state.chainState).state;
    if (state.surveyState) state.surveyState = surveyTask.suspend(recipe.surveyPattern, state.surveyState).state;
    if (state.suspendedAt === null && state.observedAt !== null) state.suspendedAt = state.observedAt;
    return state;
}

function project(state) {
    if (!state) return null;
    const detector = state.detector;
    return clone({
        schema: taskCore.SCHEMA, missionId: state.missionId, sequence: state.sequence,
        ...(state.chainState ? { poiChain: state.chainState.progress } : {}),
        ...(state.surveyState ? { surveyPattern: {
            ...state.surveyState.progress,
            // Original PAX status reads `active`; the detector snapshot exposes
            // activeLineId/coverage. Supply presentation aliases, not a second state.
            scan: { ...state.surveyState.progress.scan, active: state.surveyState.progress.scan?.activeLineId
                ? { lineId: state.surveyState.progress.scan.activeLineId } : null },
            orbit: { ...state.surveyState.progress.orbit, active: !!state.surveyState.detector?.orbit?.active }
        } } : {}),
        entryDone: detector.entryDone, sightCallDone: detector.sightCallDone, altWasOk: detector.altWasOk,
        satisfied: detector.satisfied, aborted: detector.aborted, manualConfirmed: detector.manualConfirmed,
        atTargetDone: detector.atTargetDone, inRadius: detector.inRadius,
        dwellSec: detector.dwellSec, attempts: detector.attempts,
        stage: detector.aborted ? 'aborted' : detector.satisfied ? 'satisfied' : detector.inRadius ? 'working' : 'enroute'
    });
}

// Same regular checkpoint cadence as the APT runtime context. POI checkpoints
// retain the existing revision/hash/replay transaction; raw samples stay in RAM.
const CHECKPOINT_INTERVAL_MS = 5000;
const TRANSITION_FIELDS = Object.freeze(['inRadius', 'altWasOk', 'satisfied', 'aborted',
    'manualConfirmed', 'entryDone', 'sightCallDone', 'atTargetDone', 'attempts']);

function taskItemStateFromManifest(manifest) {
    // Exact required-item predicates from _missionCargoEvaluateOutcome, checked
    // against the actual App function. The task consumes these three lists;
    // delivery readiness and newly accumulated flight stress are separate work.
    const items = Array.isArray(manifest?.items) ? manifest.items : [];
    const required = items.filter(item => item.required);
    const missing = required.filter(item => item.status !== 'loaded' && item.status !== 'unloaded' && item.status !== 'dropped');
    const dropped = required.filter(item => item.status === 'dropped');
    const damaged = required.filter(item => Number(item.healthPct ?? 100) <= 35);
    return taskCore.taskItemState({
        missingRequired: missing.map(item => item.storyName || item.label),
        droppedRequired: dropped.map(item => item.storyName || item.label),
        damagedRequired: damaged.map(item => item.storyName || item.label)
    });
}

function createAuthorityDriver({ authorityManager, applySystemEvent,
    getTaskItemState = snapshot => taskItemStateFromManifest(snapshot.state.manifest) }) {
    let runKey = null;
    let baseToken = null;
    let buffered = null;
    let mustCommit = false;
    let recovering = true;
    let disconnected = false;
    // Replay canonicalizes object keys, including nested Survey events. Key order
    // must not turn a committed checkpoint into an apparent foreign history.
    const token = (recipe, state) => state ? canonicalStringify(createState(recipe, state)) : 'null';
    const clear = () => { runKey = null; baseToken = null; buffered = null; mustCommit = false; recovering = true; };
    const context = () => {
        const snapshot = authorityManager.getExecutionSnapshot();
        if (!snapshot || snapshot.recipe !== 'poi' || snapshot.executionAuthority !== 'tracker'
            || !authorityManager.supportsExecutionRecipe?.('poi')) {
            clear();
            return { ok: true, status: 'ignored' };
        }
        const recipe = authorityManager.getExecutionPoiRecipe();
        const error = validateRecipe(recipe);
        if (error) return { ok: false, status: 'blocked', error };
        const key = JSON.stringify([snapshot.missionId, snapshot.runId]);
        const currentToken = token(recipe, snapshot.state.poiTask);
        // Ordinary cargo/voice revisions do not invalidate buffered task time.
        // A changed POI checkpoint or run does: it belongs to another history.
        if (key !== runKey || currentToken !== baseToken) {
            clear();
            runKey = key;
            baseToken = currentToken;
        }
        return { snapshot, recipe };
    };
    const commit = ({ snapshot, recipe }) => {
        if (!buffered) return { ok: true, status: 'noop', sideEffect: false, poiTask: project(snapshot.state.poiTask) };
        mustCommit = true;
        let applied;
        try {
            if (!buffered.voiceEffects) {
                let memory = snapshot.state.voice?.poiMemory || {};
                buffered.voiceEffects = buffered.effects.filter(effect => ['voice', 'survey', 'chain'].includes(effect.type)).flatMap(effect => {
                    if (effect.type === 'chain') return chainVoice.prepareEvents(recipe.voiceContext, effect.events, recipe.poiChain);
                    if (effect.type === 'survey') return surveyVoice.prepareEvent(recipe.voiceContext, effect.events, recipe.surveyPattern);
                    const cue = { ...effect.value, detector: effect.state };
                    if (!recipe.voiceContext) return cue;
                    const prepared = prepareCue(recipe.voiceContext, cue, memory);
                    memory = prepared.memory;
                    return prepared.cue;
                }).filter(Boolean);
            }
            applied = applySystemEvent({
                missionId: snapshot.missionId, runId: snapshot.runId,
                expectedRevision: snapshot.authorityRevision,
                type: 'POI_TASK_OBSERVED', eventId: `poi-sample:${buffered.state.sequence}:${buffered.state.observedAt}`,
                payload: {
                    poiTask: buffered.state,
                    voiceEffects: buffered.voiceEffects
                }
            });
        } catch (error) {
            applied = { ok: false, status: 'error', error: error?.message || 'poi_checkpoint_failed' };
        }
        const result = { ...applied, reason: buffered.reason,
            poiTask: project(applied.ok ? buffered.state : snapshot.state.poiTask) };
        if (applied.ok) {
            baseToken = token(recipe, buffered.state);
            buffered = null;
            mustCommit = false;
            recovering = false;
        }
        // A failed write keeps exactly this checkpoint/effect set as a barrier.
        // It must be accepted before consuming another telemetry sample.
        return result;
    };
    const flush = () => {
        const ctx = context();
        return ctx.snapshot ? commit(ctx) : ctx;
    };
    return Object.freeze({
        flush,
        disconnect() {
            const result = flush();
            disconnected = true;
            return result;
        },
        observeTelemetry(sample) {
            let ctx = context();
            if (!ctx.snapshot) return ctx;
            let priorCommit = null;
            if (mustCommit) {
                priorCommit = commit(ctx);
                if (!priorCommit.ok) return priorCommit;
                ctx = context();
                if (!ctx.snapshot) return ctx;
            }
            const { snapshot, recipe } = ctx;
            let previous = buffered?.state || snapshot.state.poiTask || null;
            const recoverySample = recovering || disconnected;
            if (previous && recoverySample) previous = suspend(recipe, previous);
            const result = observe(recipe, previous, sample, {
                active: snapshot.state.flags.active,
                trackingActive: recipe.trackingActive,
                ending: snapshot.state.flags.closingPending || snapshot.state.flags.farewellStarted,
                taskItemState: sample?.simPaused === true || sample?.inMenuOrMap === true
                    ? null : getTaskItemState(snapshot)
            });
            if (!result.changed) return priorCommit || {
                ok: true, status: 'noop', reason: result.reason, sideEffect: false,
                poiTask: project(snapshot.state.poiTask)
            };
            // sequence is the next accepted checkpoint number, not the count of
            // raw samples. The core's strict +1 replay guard stays unchanged.
            result.state.sequence = (snapshot.state.poiTask?.sequence || 0) + 1;
            buffered = result;
            const transition = !previous || previous.suspendedAt !== result.state.suspendedAt
                || TRANSITION_FIELDS.some(key => previous.detector[key] !== result.state.detector[key]);
            const due = !snapshot.state.poiTask
                || result.state.observedAt - snapshot.state.poiTask.observedAt >= CHECKPOINT_INTERVAL_MS;
            if (recoverySample || transition || result.effects.length || due) {
                const applied = commit(ctx);
                if (applied.ok) disconnected = false;
                return applied;
            }
            return { ...priorCommit, ok: true, status: 'buffered', reason: result.reason,
                sideEffect: false, poiTask: project(snapshot.state.poiTask) };
        }
    });
}

module.exports = { validateBundle, RECIPE_SCHEMA, RUNTIME_SCHEMA, DOMAINS, CHECKPOINT_INTERVAL_MS,
    hasLifecycle: recipe => recipe?.lifecycle?.schema === lifecycleCore.SCHEMA && !validateRecipe(recipe),
    validateRecipe, createState, observe, suspend, project, taskItemStateFromManifest, createAuthorityDriver };
