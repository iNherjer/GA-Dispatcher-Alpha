(function(root) {
    'use strict';

    const host = root || (typeof globalThis !== 'undefined' ? globalThis : {});

    const DEFAULTS = {
        minDepartureDistanceNm: 5,
        minAglFt: 1200,
        stallMinAglFt: 2500,
        requiredExerciseCount: 2,
        headingToleranceDeg: 5,
        altitudeToleranceFt: 50,
        bankToleranceDeg: 6,
        violationGraceSec: 3,
        stableSec: 4,
        exercises: {
            constant_bank_360: {
                targetBankDeg: 30,
                minEntryBankDeg: 22,
                rolloutBankDeg: 12,
                rolloutHeadingToleranceDeg: 6,
                maxAltitudeDeltaFt: 50,
                maxG: 2.2,
                maxOvershootDeg: 32
            },
            turn_180: {
                targetBankDeg: 30,
                minEntryBankDeg: 20,
                rolloutBankDeg: 10,
                rolloutHeadingToleranceDeg: 5,
                maxAltitudeDeltaFt: 50,
                maxG: 2.0,
                maxOvershootDeg: 24
            },
            altitude_step_hold: {
                holdSec: 60,
                altitudeStepFt: 500,
                maxAltitudeDeltaFt: 50,
                maxHeadingDeltaDeg: 5,
                maxBankDeg: 8,
                targetVsFpm: 500,
                maxVsFpm: 900,
                speedToleranceKts: 7
            },
            stall_recovery: {
                targetAoaDeg: 12,
                preBreakAltitudeToleranceFt: 100,
                maxBankBeforeBreakDeg: 15,
                maxHeadingDriftDeg: 15,
                maxRecoveryBankDeg: 12,
                recoveryStableSec: 4,
                setupStableSec: 5
            }
        }
    };

    let activeRecipeKey = '';
    let activeState = null;

    function activeMissionDataFromHost() {
        try {
            if (typeof currentMissionData !== 'undefined' && currentMissionData && typeof currentMissionData === 'object') return currentMissionData;
        } catch (_) {}
        return host.currentMissionData && typeof host.currentMissionData === 'object' ? host.currentMissionData : null;
    }

    function finiteNumber(value, fallback = null) {
        const n = Number(value);
        return Number.isFinite(n) ? n : fallback;
    }

    function clamp(value, min, max) {
        const n = finiteNumber(value, min);
        return Math.max(min, Math.min(max, n));
    }

    function normalizeHeading(value) {
        const n = finiteNumber(value, 0);
        return ((n % 360) + 360) % 360;
    }

    function angleDiffAbs(a, b) {
        return Math.abs((((Number(a) - Number(b)) % 360) + 540) % 360 - 180);
    }

    function signedAngleDelta(fromDeg, toDeg) {
        return (((Number(toDeg) - Number(fromDeg)) % 360) + 540) % 360 - 180;
    }

    function roundNumber(value, digits = 2) {
        const n = Number(value);
        if (!Number.isFinite(n)) return null;
        const p = 10 ** digits;
        return Math.round(n * p) / p;
    }

    function slug(value = '') {
        return String(value || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '')
            .slice(0, 80) || 'training';
    }

    function taskDomainIsTraining(passenger = null, missionData = null) {
        const td = String(
            passenger?.taskDomain
            || missionData?.passenger?.taskDomain
            || missionData?.missionContract?.taskDomain
            || missionData?.missionContractV4?.taskDomain
            || ''
        ).toLowerCase();
        return /^(training|club_training_basic|club_training_advanced)$/.test(td);
    }

    function focusTextFromPlan(plan = null) {
        return Array.isArray(plan?.focus) ? plan.focus.map(x => String(x || '').toLowerCase()).join(' ') : '';
    }

    function defaultExercisesForPlan(plan = null) {
        const focus = focusTextFromPlan(plan);
        const out = [];
        const add = (exercise) => out.push(exercise);
        const wantsStall = !focus || /stall|slow|langsam|abriss/.test(focus);
        const wantsTurn = !focus || /steep|vollkreis|kreis|haengekurv|kurve/.test(focus);
        const wantsStep = !focus || /steig|sink|hoehe|trim|speed|geschwindigkeit|leistungswechsel/.test(focus);
        const wants180 = !focus || /180|wende|kurs|navigation|kurskorrektur/.test(focus);

        if (wantsTurn) {
            add({
                id: 'constant_bank_360_30',
                type: 'constant_bank_360',
                label: 'Vollkreis 30 Grad',
                targetBankDeg: 30,
                direction: 'either'
            });
            add({
                id: 'constant_bank_360_45',
                type: 'constant_bank_360',
                label: 'Vollkreis 45 Grad',
                targetBankDeg: 45,
                direction: 'either',
                maxG: 2.4
            });
        }
        if (wantsStep) {
            add({
                id: 'altitude_step_hold',
                type: 'altitude_step_hold',
                label: 'Geradeausflug mit 500-ft-Hoehenwechsel',
                altitudeStepFt: 500,
                direction: 'climb'
            });
        }
        if (wants180) {
            add({
                id: 'turn_180',
                type: 'turn_180',
                label: '180-Grad-Wende',
                targetBankDeg: 30,
                direction: 'either'
            });
        }
        if (wantsStall) {
            add({
                id: 'stall_recovery',
                type: 'stall_recovery',
                label: 'Stall bis zum Break und Recovery'
            });
        }
        return out.length ? out : [
            { id: 'constant_bank_360_30', type: 'constant_bank_360', label: 'Vollkreis 30 Grad', targetBankDeg: 30 },
            { id: 'altitude_step_hold', type: 'altitude_step_hold', label: 'Geradeausflug mit 500-ft-Hoehenwechsel' },
            { id: 'turn_180', type: 'turn_180', label: '180-Grad-Wende', targetBankDeg: 30 },
            { id: 'stall_recovery', type: 'stall_recovery', label: 'Stall bis zum Break und Recovery' }
        ];
    }

    function normalizeExercise(raw = null, index = 0) {
        if (!raw || typeof raw !== 'object') return null;
        const type = String(raw.type || raw.kind || '').trim().toLowerCase();
        if (!/^(constant_bank_360|turn_180|altitude_step_hold|stall_recovery)$/.test(type)) return null;
        const base = DEFAULTS.exercises[type] || {};
        const id = String(raw.id || `${type}_${index + 1}`).trim() || `${type}_${index + 1}`;
        const label = String(raw.label || raw.title || id.replace(/_/g, ' ')).trim();
        const directionRaw = String(raw.direction || 'either').toLowerCase();
        const direction = /^(left|right|climb|descent|either)$/.test(directionRaw) ? directionRaw : 'either';
        const normalized = {
            ...base,
            ...raw,
            id,
            type,
            label,
            direction,
            maxAttempts: Math.max(1, Math.min(8, Math.round(finiteNumber(raw.maxAttempts, 4)))),
            violationGraceSec: clamp(raw.violationGraceSec ?? DEFAULTS.violationGraceSec, 1, 12),
            stableSec: clamp(raw.stableSec ?? DEFAULTS.stableSec, 1, 12)
        };
        if (type === 'constant_bank_360' || type === 'turn_180') {
            normalized.targetBankDeg = clamp(raw.targetBankDeg ?? base.targetBankDeg, 15, 55);
            normalized.minEntryBankDeg = clamp(raw.minEntryBankDeg ?? Math.max(12, normalized.targetBankDeg - 8), 8, 52);
            normalized.maxAltitudeDeltaFt = clamp(raw.maxAltitudeDeltaFt ?? base.maxAltitudeDeltaFt, 20, 250);
            normalized.rolloutBankDeg = clamp(raw.rolloutBankDeg ?? base.rolloutBankDeg, 5, 20);
            normalized.rolloutHeadingToleranceDeg = clamp(raw.rolloutHeadingToleranceDeg ?? base.rolloutHeadingToleranceDeg, 2, 15);
            normalized.maxG = clamp(raw.maxG ?? base.maxG, 1.2, 3.5);
            normalized.maxOvershootDeg = clamp(raw.maxOvershootDeg ?? base.maxOvershootDeg, 8, 60);
        } else if (type === 'altitude_step_hold') {
            normalized.holdSec = clamp(raw.holdSec ?? base.holdSec, 5, 180);
            normalized.altitudeStepFt = clamp(raw.altitudeStepFt ?? base.altitudeStepFt, 200, 2000);
            normalized.maxAltitudeDeltaFt = clamp(raw.maxAltitudeDeltaFt ?? base.maxAltitudeDeltaFt, 20, 250);
            normalized.maxHeadingDeltaDeg = clamp(raw.maxHeadingDeltaDeg ?? base.maxHeadingDeltaDeg, 2, 20);
            normalized.maxBankDeg = clamp(raw.maxBankDeg ?? base.maxBankDeg, 3, 20);
            normalized.maxVsFpm = clamp(raw.maxVsFpm ?? base.maxVsFpm, 300, 2000);
            normalized.speedToleranceKts = clamp(raw.speedToleranceKts ?? base.speedToleranceKts, 3, 25);
        } else if (type === 'stall_recovery') {
            normalized.targetAoaDeg = clamp(raw.targetAoaDeg ?? base.targetAoaDeg, 6, 24);
            normalized.preBreakAltitudeToleranceFt = clamp(raw.preBreakAltitudeToleranceFt ?? base.preBreakAltitudeToleranceFt, 50, 300);
            normalized.maxBankBeforeBreakDeg = clamp(raw.maxBankBeforeBreakDeg ?? base.maxBankBeforeBreakDeg, 8, 35);
            normalized.maxHeadingDriftDeg = clamp(raw.maxHeadingDriftDeg ?? base.maxHeadingDriftDeg, 8, 45);
            normalized.maxRecoveryBankDeg = clamp(raw.maxRecoveryBankDeg ?? base.maxRecoveryBankDeg, 6, 25);
            normalized.recoveryStableSec = clamp(raw.recoveryStableSec ?? base.recoveryStableSec, 2, 12);
            normalized.setupStableSec = clamp(raw.setupStableSec ?? base.setupStableSec, 2, 20);
        }
        return normalized;
    }

    function normalizeRecipe(raw = null, missionData = null, passenger = null) {
        const md = missionData || activeMissionDataFromHost();
        const pax = passenger || md?.passenger || host.activePassenger || null;
        if (!taskDomainIsTraining(pax, md) && !pax?.trainingPlan && !pax?.trainingRecipe && !raw) return null;
        const plan = pax?.trainingPlan || md?.passenger?.trainingPlan || null;
        const source = raw && typeof raw === 'object' ? raw : (
            pax?.trainingRecipe || md?.trainingRecipe || md?.missionContract?.trainingRecipe || md?.missionContractV4?.trainingRecipe || null
        );
        const sourceExercises = Array.isArray(source?.exercises) ? source.exercises : defaultExercisesForPlan(plan);
        const exercises = sourceExercises.map(normalizeExercise).filter(Boolean).slice(0, 8);
        if (!exercises.length) return null;
        const mode = String(source?.mode || plan?.mode || 'airwork').toLowerCase() === 'pattern' ? 'pattern' : 'airwork';
        const targetLabel = String(source?.targetLabel || md?.destName || md?.targetName || md?.dest || 'Trainingsflug').trim();
        const requiredCount = Math.max(1, Math.min(
            exercises.length,
            Math.round(finiteNumber(source?.requiredCount ?? plan?.requiredCount, DEFAULTS.requiredExerciseCount))
        ));
        const requiredMinAglFt = exercises.slice(0, requiredCount).reduce((max, ex) => {
            const exMin = ex.type === 'stall_recovery'
                ? Number(source?.stallMinAglFt || DEFAULTS.stallMinAglFt)
                : Number(source?.minAglFt || DEFAULTS.minAglFt);
            return Math.max(max, exMin);
        }, 0);
        const key = String(source?.key || [
            'training',
            mode,
            targetLabel,
            `req${requiredCount}`,
            exercises.map(ex => `${ex.id}:${ex.type}:${ex.targetBankDeg || ex.altitudeStepFt || ''}`).join('|')
        ].join(':'));
        return {
            schema: 'ga.trainingRecipe.v1',
            key,
            family: String(source?.family || 'airwork_basic'),
            mode,
            targetLabel,
            minAglFt: clamp(source?.minAglFt ?? DEFAULTS.minAglFt, 500, 8000),
            stallMinAglFt: clamp(source?.stallMinAglFt ?? DEFAULTS.stallMinAglFt, 1000, 10000),
            requiredCount,
            readyMinAglFt: clamp(source?.readyMinAglFt ?? plan?.readyMinAglFt ?? requiredMinAglFt, 500, 10000),
            minDepartureDistanceNm: clamp(source?.minDepartureDistanceNm ?? DEFAULTS.minDepartureDistanceNm, 0, 50),
            exercises
        };
    }

    function createInitialState(recipe) {
        return {
            schema: 'ga.trainingProcedureProgress.v1',
            recipeKey: String(recipe?.key || ''),
            startedAt: 0,
            updatedAt: 0,
            satisfied: false,
            requiredComplete: false,
            departureGatePassed: false,
            ready: false,
            readyPrompted: false,
            startAvailable: false,
            preStartStableSince: 0,
            nextInstructionAt: 0,
            optionalRequested: false,
            optionalActive: false,
            lastGateEventAt: {},
            activeIndex: 0,
            active: null,
            exercises: (recipe?.exercises || []).map(ex => ({
                id: ex.id,
                type: ex.type,
                label: ex.label,
                status: 'pending',
                attempts: 0,
                summary: null
            })),
            lastSample: null,
            events: []
        };
    }

    function hydrateState(recipe, saved = null) {
        const state = createInitialState(recipe);
        if (!saved || typeof saved !== 'object') return state;
        state.startedAt = Number(saved.startedAt || 0);
        state.updatedAt = Number(saved.updatedAt || 0);
        state.satisfied = !!saved.satisfied;
        state.requiredComplete = !!(saved.requiredComplete || saved.satisfied);
        state.departureGatePassed = !!(saved.departureGatePassed || saved.startedAt || saved.active);
        state.ready = !!saved.ready;
        state.readyPrompted = !!saved.readyPrompted;
        state.startAvailable = !!saved.startAvailable;
        state.preStartStableSince = Number(saved.preStartStableSince || 0);
        state.nextInstructionAt = Number(saved.nextInstructionAt || 0);
        state.optionalRequested = !!saved.optionalRequested;
        state.optionalActive = !!saved.optionalActive;
        state.lastGateEventAt = saved.lastGateEventAt && typeof saved.lastGateEventAt === 'object' ? { ...saved.lastGateEventAt } : {};
        state.activeIndex = Math.max(0, Math.min(state.exercises.length - 1, Math.round(Number(saved.activeIndex || 0))));
        state.active = saved.active && typeof saved.active === 'object' ? { ...saved.active } : null;
        if (Array.isArray(saved.exercises)) {
            state.exercises = state.exercises.map((base, idx) => {
                const rec = saved.exercises.find(item => String(item?.id || '') === base.id) || saved.exercises[idx] || null;
                return rec ? {
                    ...base,
                    status: ['pending', 'active', 'complete', 'repeat'].includes(String(rec.status || '')) ? String(rec.status) : base.status,
                    attempts: Math.max(0, Math.round(Number(rec.attempts || 0))),
                    summary: rec.summary && typeof rec.summary === 'object' ? { ...rec.summary } : null
                } : base;
            });
        }
        return state;
    }

    function snapshotState(state = activeState) {
        if (!state || typeof state !== 'object') return null;
        const activeExercise = state.exercises?.[state.activeIndex] || null;
        return {
            schema: 'ga.trainingProcedureProgress.v1',
            recipeKey: String(state.recipeKey || ''),
            startedAt: Number(state.startedAt || 0),
            updatedAt: Number(state.updatedAt || 0),
            satisfied: !!(state.satisfied || state.requiredComplete),
            requiredComplete: !!state.requiredComplete,
            departureGatePassed: !!state.departureGatePassed,
            ready: !!state.ready,
            readyPrompted: !!state.readyPrompted,
            startAvailable: !!state.startAvailable,
            optionalRequested: !!state.optionalRequested,
            optionalAvailable: !!(state.requiredComplete && Number(state.activeIndex || 0) < Number((state.exercises || []).length || 0)),
            activeIndex: Math.max(0, Number(state.activeIndex || 0)),
            completedCount: Array.isArray(state.exercises) ? state.exercises.filter(ex => ex.status === 'complete').length : 0,
            totalExercises: Array.isArray(state.exercises) ? state.exercises.length : 0,
            requiredCount: Math.max(1, Math.min(
                Array.isArray(state.exercises) ? state.exercises.length : 1,
                Math.round(Number((state.recipe && state.recipe.requiredCount) || state.requiredCount || 2))
            )),
            activeExercise: activeExercise ? {
                id: activeExercise.id,
                type: activeExercise.type,
                label: activeExercise.label,
                status: activeExercise.status,
                attempts: activeExercise.attempts,
                phase: String(state.active?.phase || '')
            } : null,
            exercises: Array.isArray(state.exercises) ? state.exercises.map(ex => ({
                id: ex.id,
                type: ex.type,
                label: ex.label,
                status: ex.status,
                attempts: ex.attempts,
                summary: ex.summary
            })) : [],
            active: state.active ? {
                exerciseId: state.active.exerciseId,
                phase: state.active.phase,
                startedAt: Number(state.active.startedAt || 0),
                phaseStartedAt: Number(state.active.phaseStartedAt || 0),
                progressDeg: roundNumber(state.active.progressDeg || 0, 1),
                targetHeadingDeg: roundNumber(state.active.targetHeadingDeg, 1),
                targetAltFt: Number.isFinite(Number(state.active.targetAltFt)) ? Math.round(Number(state.active.targetAltFt)) : null,
                maxAltDevFt: Math.round(Number(state.active.maxAltDevFt || 0)),
                maxHeadingDevDeg: roundNumber(state.active.maxHeadingDevDeg || 0, 1),
                maxBankDevDeg: roundNumber(state.active.maxBankDevDeg || 0, 1),
                heightLossFt: Math.round(Number(state.active.heightLossFt || 0))
            } : null
        };
    }

    function sampleFromInput(input = {}) {
        const flightData = input.flightData || {};
        const gps = host.lastLiveGpsPos || {};
        const headingDeg = finiteNumber(input.headingDeg ?? flightData.hdg ?? flightData.heading ?? flightData.trackDeg ?? flightData.trkDeg ?? gps.hdg, null);
        return {
            lat: finiteNumber(input.lat ?? gps.lat, null),
            lon: finiteNumber(input.lon ?? gps.lon, null),
            altFt: finiteNumber(input.altFt ?? flightData.mslFt ?? flightData.altFt ?? flightData.altitudeFt ?? gps.mslFt ?? gps.altFt, null),
            aglFt: finiteNumber(flightData.aglFt ?? input.aglFt, null),
            headingDeg: headingDeg == null ? null : normalizeHeading(headingDeg),
            bankDeg: finiteNumber(flightData.bankDeg ?? input.bankDeg, 0),
            pitchDeg: finiteNumber(flightData.pitchDeg ?? flightData.pitch ?? input.pitchDeg, null),
            iasKts: finiteNumber(flightData.iasKts ?? flightData.ias ?? flightData.indicatedAirspeedKts ?? input.iasKts, null),
            gsKts: finiteNumber(flightData.gsKts ?? flightData.gs ?? flightData.groundSpeed ?? input.gsKts, null),
            vsFpm: finiteNumber(flightData.vsFpm ?? flightData.vs ?? input.vsFpm, 0),
            gForce: finiteNumber(flightData.gForce ?? input.gForce, 1),
            aoaDeg: finiteNumber(flightData.aoaDeg ?? input.aoaDeg, null),
            stallState: toBool(flightData.stallState ?? input.stallState),
            onGround: flightData.onGround === true || input.onGround === true,
            departureDistanceNm: finiteNumber(input.departureDistanceNm, null),
            nowMs: finiteNumber(input.nowMs ?? Date.now(), Date.now())
        };
    }

    function toBool(value) {
        if (typeof value === 'boolean') return value;
        if (typeof value === 'number') return value > 0.5;
        const s = String(value || '').trim().toLowerCase();
        return s === '1' || s === 'true' || s === 'yes' || s === 'stall';
    }

    function withTurnRate(state, sample) {
        const prev = state.lastSample || null;
        let turnRateDegSec = null;
        if (prev && Number.isFinite(prev.headingDeg) && Number.isFinite(sample.headingDeg)) {
            const dt = Math.max(0.05, (Number(sample.nowMs) - Number(prev.nowMs || sample.nowMs)) / 1000);
            turnRateDegSec = signedAngleDelta(prev.headingDeg, sample.headingDeg) / dt;
        }
        const next = { ...sample, turnRateDegSec };
        state.lastSample = {
            nowMs: sample.nowMs,
            headingDeg: sample.headingDeg,
            altFt: sample.altFt,
            pitchDeg: sample.pitchDeg
        };
        return next;
    }

    function ensureActiveExercise(recipe, state, sample, events) {
        if (state.satisfied && !state.optionalActive) return null;
        const ex = recipe.exercises[state.activeIndex] || null;
        if (!ex) {
            state.satisfied = true;
            events.push({ type: 'training_complete' });
            return null;
        }
        if (!state.startedAt) {
            state.startedAt = sample.nowMs;
            events.push({ type: 'training_started' });
        }
        if (!state.active || state.active.exerciseId !== ex.id) {
            state.exercises[state.activeIndex].status = 'active';
            state.active = {
                exerciseId: ex.id,
                exerciseType: ex.type,
                label: ex.label,
                phase: 'setup',
                startedAt: sample.nowMs,
                phaseStartedAt: sample.nowMs,
                badSince: 0,
                stableSince: 0,
                cautionAt: {},
                repeats: Math.max(0, Number(state.exercises[state.activeIndex].attempts || 0)),
                startAltFt: Number.isFinite(sample.altFt) ? sample.altFt : 0,
                startHeadingDeg: Number.isFinite(sample.headingDeg) ? sample.headingDeg : 0,
                prevHeadingDeg: Number.isFinite(sample.headingDeg) ? sample.headingDeg : 0,
                maxAltDevFt: 0,
                maxHeadingDevDeg: 0,
                maxBankDevDeg: 0,
                maxG: Number(sample.gForce || 1),
                turnRates: []
            };
            state.exercises[state.activeIndex].attempts += 1;
            events.push({
                type: 'exercise_started',
                exerciseId: ex.id,
                exerciseType: ex.type,
                label: ex.label,
                index: state.activeIndex + 1,
                total: recipe.exercises.length
            });
        }
        return ex;
    }

    function setPhase(active, phase, now, events, extra = {}) {
        if (!active || active.phase === phase) return;
        active.phase = phase;
        active.phaseStartedAt = now;
        active.badSince = 0;
        active.stableSince = 0;
        active.valuesCorrect = null;
        active.valueFeedbackStarted = false;
        active.lastValueDeviationAt = 0;
        events.push({
            type: 'phase_started',
            phase,
            exerciseId: active.exerciseId,
            exerciseType: active.exerciseType,
            label: active.label,
            ...extra
        });
    }

    function badFor(active, bad, now, graceSec) {
        if (!bad) {
            active.badSince = 0;
            return false;
        }
        if (!active.badSince) active.badSince = now;
        return (now - active.badSince) >= Math.max(1, Number(graceSec || DEFAULTS.violationGraceSec)) * 1000;
    }

    function stableFor(active, good, now, stableSec) {
        if (!good) {
            active.stableSince = 0;
            return false;
        }
        if (!active.stableSince) active.stableSince = now;
        return (now - active.stableSince) >= Math.max(1, Number(stableSec || DEFAULTS.stableSec)) * 1000;
    }

    function pushCaution(active, events, kind, now, extra = {}) {
        if (!active || !kind) return;
        if (!active.cautionAt || typeof active.cautionAt !== 'object') active.cautionAt = {};
        const key = String(kind);
        const last = Number(active.cautionAt[key] || 0);
        const minMs = Number(extra.minIntervalMs || 10000);
        if (last && (now - last) < minMs) return;
        active.cautionAt[key] = now;
        events.push({
            type: 'training_caution',
            caution: key,
            exerciseId: active.exerciseId,
            exerciseType: active.exerciseType,
            label: active.label,
            ...extra
        });
    }

    function updateValueFeedback(active, events, good, now, extra = {}) {
        if (!active) return;
        if (good) {
            if (active.valuesCorrect !== true) {
                active.valuesCorrect = true;
                active.valueFeedbackStarted = true;
                events.push({
                    type: 'training_values_correct',
                    exerciseId: active.exerciseId,
                    exerciseType: active.exerciseType,
                    label: active.label,
                    ...extra
                });
            }
            return;
        }
        const last = Number(active.lastValueDeviationAt || 0);
        const firstDue = !active.valueFeedbackStarted
            && (now - Number(active.phaseStartedAt || active.startedAt || now)) >= 10000;
        const leftGoodBand = active.valuesCorrect === true;
        const repeatDue = !!active.valueFeedbackStarted && (!last || (now - last) >= 10000);
        if (!leftGoodBand && !firstDue && !repeatDue) return;
        active.valuesCorrect = false;
        active.valueFeedbackStarted = true;
        active.lastValueDeviationAt = now;
        events.push({
            type: 'training_values_deviation',
            exerciseId: active.exerciseId,
            exerciseType: active.exerciseType,
            label: active.label,
            ...extra
        });
    }

    function resetExerciseStartGate(state, now = 0, instructionDelayMs = 0) {
        state.ready = false;
        state.readyPrompted = false;
        state.startAvailable = false;
        state.preStartStableSince = 0;
        state.nextInstructionAt = Number(now || 0) + Math.max(0, Number(instructionDelayMs || 0));
    }

    function pushGateEvent(state, events, kind, sample, extra = {}) {
        if (!state || !kind) return;
        if (!state.lastGateEventAt || typeof state.lastGateEventAt !== 'object') state.lastGateEventAt = {};
        const now = Number(sample?.nowMs || Date.now());
        const minMs = Number(extra.minIntervalMs || 30000);
        const last = Number(state.lastGateEventAt[kind] || 0);
        if (last && (now - last) < minMs) return;
        state.lastGateEventAt[kind] = now;
        events.push({ type: kind, ...extra });
    }

    function repeatExercise(state, ex, sample, events, reason) {
        const rec = state.exercises[state.activeIndex];
        if (rec) rec.status = 'repeat';
        const active = state.active || {};
        events.push({
            type: 'exercise_repeat_required',
            exerciseId: ex.id,
            exerciseType: ex.type,
            label: ex.label,
            reason: String(reason || 'criteria'),
            attempts: rec?.attempts || 1,
            maxAltDevFt: Math.round(Number(active.maxAltDevFt || 0)),
            maxHeadingDevDeg: roundNumber(active.maxHeadingDevDeg || 0, 1)
        });
        const retryOptional = !!state.optionalActive;
        state.active = null;
        state.lastSample = null;
        state.optionalActive = false;
        if (retryOptional) state.optionalRequested = true;
        resetExerciseStartGate(state, sample.nowMs, 8000);
    }

    function completeExercise(recipe, state, ex, sample, events, summary = {}) {
        const rec = state.exercises[state.activeIndex];
        if (rec) {
            rec.status = 'complete';
            rec.summary = {
                ...summary,
                completedAt: sample.nowMs
            };
        }
        events.push({
            type: 'exercise_pass_clean',
            exerciseId: ex.id,
            exerciseType: ex.type,
            label: ex.label,
            index: state.activeIndex + 1,
            total: recipe.exercises.length,
            summary
        });
        state.activeIndex += 1;
        state.active = null;
        state.lastSample = null;
        state.optionalActive = false;
        const requiredCount = Math.max(1, Math.min(recipe.exercises.length, Math.round(Number(recipe.requiredCount || DEFAULTS.requiredExerciseCount))));
        if (!state.requiredComplete && state.activeIndex >= requiredCount) {
            state.requiredComplete = true;
            state.satisfied = true;
            events.push({
                type: 'training_required_complete',
                completedCount: state.exercises.filter(item => item.status === 'complete').length,
                requiredCount,
                remainingOptional: Math.max(0, recipe.exercises.length - state.activeIndex)
            });
            return;
        }
        if (state.activeIndex < recipe.exercises.length) {
            resetExerciseStartGate(state, sample.nowMs);
        }
        if (state.activeIndex >= recipe.exercises.length) {
            state.satisfied = true;
            events.push({ type: 'training_complete' });
        }
    }

    function updateCommonMetrics(active, sample) {
        if (!active) return;
        if (Number.isFinite(sample.altFt)) {
            active.maxAltDevFt = Math.max(Number(active.maxAltDevFt || 0), Math.abs(sample.altFt - Number(active.startAltFt || sample.altFt)));
            if (Number.isFinite(Number(active.targetAltFt))) {
                active.maxTargetAltDevFt = Math.max(Number(active.maxTargetAltDevFt || 0), Math.abs(sample.altFt - Number(active.targetAltFt)));
            }
        }
        if (Number.isFinite(sample.headingDeg)) {
            const ref = Number.isFinite(Number(active.targetHeadingDeg)) ? Number(active.targetHeadingDeg) : Number(active.startHeadingDeg || sample.headingDeg);
            active.maxHeadingDevDeg = Math.max(Number(active.maxHeadingDevDeg || 0), angleDiffAbs(sample.headingDeg, ref));
        }
        if (Number.isFinite(sample.gForce)) active.maxG = Math.max(Number(active.maxG || 1), sample.gForce);
    }

    function tickAltitudeStep(recipe, state, ex, sample, events) {
        const active = state.active;
        const now = sample.nowMs;
        updateCommonMetrics(active, sample);
        if (active.phase === 'setup') {
            active.startAltFt = Math.round(Number(sample.altFt || 0));
            active.startHeadingDeg = normalizeHeading(sample.headingDeg || 0);
            active.refIasKts = Number.isFinite(sample.iasKts) ? sample.iasKts : null;
            const dir = ex.direction === 'descent' ? -1 : 1;
            active.targetAltFt = active.startAltFt + dir * Number(ex.altitudeStepFt || 500);
            setPhase(active, 'hold_initial', now, events, { targetAltFt: active.startAltFt });
            return;
        }
        const headingDev = angleDiffAbs(sample.headingDeg, active.startHeadingDeg);
        const bank = Math.abs(Number(sample.bankDeg || 0));
        const altTarget = active.phase === 'hold_final' ? active.targetAltFt : active.startAltFt;
        const altDev = Math.abs(Number(sample.altFt || 0) - Number(altTarget || 0));
        const speedBad = Number.isFinite(active.refIasKts) && Number.isFinite(sample.iasKts)
            && Math.abs(sample.iasKts - active.refIasKts) > Number(ex.speedToleranceKts || 7);
        const courseBad = headingDev > Number(ex.maxHeadingDeltaDeg || 5) || bank > Number(ex.maxBankDeg || 8);
        if (active.phase === 'hold_initial' || active.phase === 'hold_final') {
            const bad = altDev > Number(ex.maxAltitudeDeltaFt || 50) || courseBad || speedBad;
            const reason = altDev > Number(ex.maxAltitudeDeltaFt || 50) ? 'altitude' : (headingDev > Number(ex.maxHeadingDeltaDeg || 5) ? 'heading' : (speedBad ? 'speed' : 'bank'));
            updateValueFeedback(active, events, !bad, now, {
                altDevFt: Math.round(altDev),
                headingDevDeg: roundNumber(headingDev, 1),
                bankDeg: roundNumber(bank, 1)
            });
            const severe = altDev > Math.max(200, Number(ex.maxAltitudeDeltaFt || 50) * 4)
                || headingDev > Math.max(30, Number(ex.maxHeadingDeltaDeg || 5) * 5)
                || bank > 35;
            if (badFor(active, severe, now, Math.max(10, Number(ex.violationGraceSec || 0)))) {
                repeatExercise(state, ex, sample, events, reason);
                return;
            }
            if ((now - Number(active.phaseStartedAt || now)) >= Number(ex.holdSec || 60) * 1000) {
                if (active.phase === 'hold_initial') {
                    setPhase(active, 'altitude_change', now, events, { targetAltFt: active.targetAltFt });
                } else {
                    completeExercise(recipe, state, ex, sample, events, {
                        maxAltitudeDeviationFt: Math.round(Number(active.maxTargetAltDevFt || active.maxAltDevFt || 0)),
                        maxHeadingDeviationDeg: roundNumber(active.maxHeadingDevDeg || 0, 1),
                        speedReferenceKts: Number.isFinite(active.refIasKts) ? roundNumber(active.refIasKts, 1) : null
                    });
                }
            }
            return;
        }
        if (active.phase === 'altitude_change') {
            const vs = Math.abs(Number(sample.vsFpm || 0));
            const targetDev = Math.abs(Number(sample.altFt || 0) - Number(active.targetAltFt || 0));
            const bad = courseBad || speedBad || vs > Number(ex.maxVsFpm || 900) + 250;
            const reason = headingDev > Number(ex.maxHeadingDeltaDeg || 5) ? 'heading' : (speedBad ? 'speed' : 'vertical_speed');
            if (targetDev <= Math.max(90, Number(ex.maxAltitudeDeltaFt || 50) * 2.2) && vs > 350) pushCaution(active, events, 'leveloff', now, { targetDevFt: Math.round(targetDev), minIntervalMs: 20000 });
            updateValueFeedback(active, events, !bad, now, {
                targetAltDevFt: Math.round(targetDev),
                headingDevDeg: roundNumber(headingDev, 1),
                vsFpm: Math.round(vs)
            });
            const severe = headingDev > Math.max(30, Number(ex.maxHeadingDeltaDeg || 5) * 5)
                || Math.abs(Number(sample.altFt || 0) - Number(active.startAltFt || 0)) > Math.max(1800, Number(ex.altitudeStepFt || 500) * 3)
                || vs > Number(ex.maxVsFpm || 900) + 900;
            if (badFor(active, severe, now, Math.max(10, Number(ex.violationGraceSec || 0)))) {
                repeatExercise(state, ex, sample, events, reason);
                return;
            }
            if (targetDev <= Number(ex.maxAltitudeDeltaFt || 50) && vs <= 350) {
                if (stableFor(active, true, now, ex.stableSec)) {
                    active.maxTargetAltDevFt = 0;
                    setPhase(active, 'hold_final', now, events, { targetAltFt: active.targetAltFt });
                }
            } else {
                stableFor(active, false, now, ex.stableSec);
            }
        }
    }

    function tickConstantTurn(recipe, state, ex, sample, events, targetDeg) {
        const active = state.active;
        const now = sample.nowMs;
        updateCommonMetrics(active, sample);
        const absBank = Math.abs(Number(sample.bankDeg || 0));
        const sign = Number(sample.bankDeg || 0) >= 0 ? 1 : -1;
        const wantedDirection = ex.direction === 'left' ? -1 : (ex.direction === 'right' ? 1 : 0);
        if (active.phase === 'setup') {
            active.startAltFt = Math.round(Number(sample.altFt || 0));
            active.startHeadingDeg = normalizeHeading(sample.headingDeg || 0);
            active.targetHeadingDeg = normalizeHeading(active.startHeadingDeg + targetDeg);
            active.progressDeg = 0;
            active.maxBankDevDeg = 0;
            setPhase(active, 'entry', now, events, { targetBankDeg: ex.targetBankDeg, targetHeadingDeg: active.targetHeadingDeg });
            return;
        }
        if (active.phase === 'entry') {
            const entryOk = absBank >= Number(ex.minEntryBankDeg || 20) && (!wantedDirection || wantedDirection === sign);
            if (!entryOk && (now - Number(active.phaseStartedAt || now)) > 8000) {
                pushCaution(active, events, 'bank', now, { targetBankDeg: Number(ex.targetBankDeg || 30) });
            }
            if (entryOk) {
                active.direction = wantedDirection || sign;
                active.prevHeadingDeg = sample.headingDeg;
                const initialDelta = signedAngleDelta(active.startHeadingDeg, sample.headingDeg) * Number(active.direction || 1);
                if (initialDelta > 0) active.progressDeg = Math.max(Number(active.progressDeg || 0), initialDelta);
                setPhase(active, 'turning', now, events, { direction: active.direction > 0 ? 'right' : 'left' });
            }
            return;
        }
        if (active.phase === 'turning') {
            const delta = signedAngleDelta(active.prevHeadingDeg, sample.headingDeg);
            active.prevHeadingDeg = sample.headingDeg;
            const directedDelta = delta * Number(active.direction || 1);
            if (directedDelta > 0) active.progressDeg = Math.max(0, Number(active.progressDeg || 0) + directedDelta);
            if (Number.isFinite(sample.turnRateDegSec) && Math.abs(sample.turnRateDegSec) >= 0.1) active.turnRates.push(Math.abs(sample.turnRateDegSec));
            const altDev = Math.abs(Number(sample.altFt || 0) - Number(active.startAltFt || 0));
            const bankDev = Math.abs(absBank - Number(ex.targetBankDeg || 30));
            active.maxAltDevFt = Math.max(Number(active.maxAltDevFt || 0), altDev);
            active.maxBankDevDeg = Math.max(Number(active.maxBankDevDeg || 0), bankDev);
            const opposite = directedDelta < -8;
            const bad = opposite
                || altDev > Math.max(200, Number(ex.maxAltitudeDeltaFt || 50) * 4)
                || absBank > Number(ex.targetBankDeg || 30) + 25
                || Number(sample.gForce || 1) > Number(ex.maxG || 2.2);
            const reason = opposite ? 'wrong_direction'
                : (altDev > Number(ex.maxAltitudeDeltaFt || 50) ? 'altitude'
                    : (Number(sample.gForce || 1) > Number(ex.maxG || 2.2) ? 'g_load' : 'bank'));
            const valuesGood = altDev <= Number(ex.maxAltitudeDeltaFt || 50)
                && bankDev <= Number(ex.bankToleranceDeg || DEFAULTS.bankToleranceDeg)
                && Number(sample.gForce || 1) <= Number(ex.maxG || 2.2);
            updateValueFeedback(active, events, valuesGood, now, {
                altDevFt: Math.round(altDev),
                bankDevDeg: roundNumber(bankDev, 1),
                targetBankDeg: Number(ex.targetBankDeg || 30)
            });
            if (active.progressDeg >= targetDeg - 35 && active.progressDeg < targetDeg - 5) pushCaution(active, events, 'rollout_soon', now, { targetHeadingDeg: active.targetHeadingDeg, minIntervalMs: 30000 });
            if (badFor(active, bad, now, Math.max(10, Number(ex.violationGraceSec || 0)))) {
                repeatExercise(state, ex, sample, events, reason);
                return;
            }
            if (active.progressDeg >= targetDeg - 5) {
                setPhase(active, 'rollout', now, events, { targetHeadingDeg: active.targetHeadingDeg });
            } else if (active.progressDeg > targetDeg + Number(ex.maxOvershootDeg || 30)) {
                repeatExercise(state, ex, sample, events, 'overshoot');
            }
            return;
        }
        if (active.phase === 'rollout') {
            const headingDev = angleDiffAbs(sample.headingDeg, active.targetHeadingDeg);
            const rolloutOk = absBank <= Number(ex.rolloutBankDeg || 12) && headingDev <= Number(ex.rolloutHeadingToleranceDeg || 6);
            if (!rolloutOk) pushCaution(active, events, 'rollout', now, { headingDevDeg: roundNumber(headingDev, 1), bankDeg: roundNumber(absBank, 1) });
            if (stableFor(active, rolloutOk, now, ex.stableSec)) {
                const rates = active.turnRates || [];
                const avg = rates.length ? rates.reduce((a, b) => a + b, 0) / rates.length : null;
                const variance = avg ? rates.reduce((sum, v) => sum + ((v - avg) ** 2), 0) / rates.length : null;
                const std = variance != null ? Math.sqrt(variance) : null;
                completeExercise(recipe, state, ex, sample, events, {
                    targetBankDeg: Number(ex.targetBankDeg || 30),
                    maxAltitudeDeviationFt: Math.round(Number(active.maxAltDevFt || 0)),
                    maxBankDeviationDeg: roundNumber(active.maxBankDevDeg || 0, 1),
                    rolloutHeadingErrorDeg: roundNumber(headingDev, 1),
                    turnRateAvgDegSec: avg == null ? null : roundNumber(avg, 2),
                    turnRateStdDevDegSec: std == null ? null : roundNumber(std, 2)
                });
            } else {
                const rolloutSevere = headingDev > 35 || absBank > 35;
                if (badFor(active, rolloutSevere, now, 10)) repeatExercise(state, ex, sample, events, 'rollout');
            }
        }
    }

    function tickStallRecovery(recipe, state, ex, sample, events) {
        const active = state.active;
        const now = sample.nowMs;
        updateCommonMetrics(active, sample);
        if (active.phase === 'setup') {
            active.startAltFt = Math.round(Number(sample.altFt || 0));
            active.startHeadingDeg = normalizeHeading(sample.headingDeg || 0);
            active.refIasKts = Number.isFinite(sample.iasKts) ? sample.iasKts : null;
            active.aoaPeak = Number.isFinite(sample.aoaDeg) ? sample.aoaDeg : null;
            active.pitchBeforeBreakDeg = Number.isFinite(sample.pitchDeg) ? sample.pitchDeg : null;
            setPhase(active, 'stabilize', now, events);
            return;
        }
        const altDev = Math.abs(Number(sample.altFt || 0) - Number(active.startAltFt || 0));
        const headingDev = angleDiffAbs(sample.headingDeg, active.startHeadingDeg);
        const absBank = Math.abs(Number(sample.bankDeg || 0));
        if (Number.isFinite(sample.aoaDeg)) active.aoaPeak = Math.max(Number(active.aoaPeak || sample.aoaDeg), sample.aoaDeg);
        if (active.phase === 'stabilize') {
            const stable = altDev <= 60 && headingDev <= 8 && absBank <= 8;
            if (!stable) pushCaution(active, events, 'stall_setup', now, { altDevFt: Math.round(altDev), headingDevDeg: roundNumber(headingDev, 1), bankDeg: roundNumber(absBank, 1) });
            if (stableFor(active, stable, now, ex.setupStableSec)) {
                setPhase(active, 'approach', now, events);
            } else {
                return;
            }
        }
        if (active.phase === 'approach') {
            const iasDrop = Number.isFinite(active.refIasKts) && Number.isFinite(sample.iasKts)
                ? active.refIasKts - sample.iasKts
                : 0;
            const nearStall = sample.stallState || (Number.isFinite(sample.aoaDeg) && sample.aoaDeg >= Number(ex.targetAoaDeg || 12) - 1) || iasDrop >= 15;
            const bad = altDev > Number(ex.preBreakAltitudeToleranceFt || 100) || headingDev > Number(ex.maxHeadingDriftDeg || 15) || absBank > Number(ex.maxBankBeforeBreakDeg || 15);
            const reason = altDev > Number(ex.preBreakAltitudeToleranceFt || 100) ? 'pre_break_altitude' : (headingDev > Number(ex.maxHeadingDriftDeg || 15) ? 'heading' : 'bank');
            if (altDev > Number(ex.preBreakAltitudeToleranceFt || 100) * 0.6) pushCaution(active, events, 'stall_hold_altitude', now, { altDevFt: Math.round(altDev) });
            if (absBank > Math.max(8, Number(ex.maxBankBeforeBreakDeg || 15) * 0.75)) pushCaution(active, events, 'stall_wings_level', now, { bankDeg: roundNumber(absBank, 1) });
            if (badFor(active, bad, now, ex.violationGraceSec)) {
                repeatExercise(state, ex, sample, events, reason);
                return;
            }
            if (nearStall) {
                active.stallEntryAltFt = Number(sample.altFt || active.startAltFt || 0);
                active.stallEntryPitchDeg = Number.isFinite(sample.pitchDeg) ? sample.pitchDeg : null;
                setPhase(active, 'hold_to_break', now, events);
            }
            return;
        }
        if (active.phase === 'hold_to_break') {
            const bad = altDev > Number(ex.preBreakAltitudeToleranceFt || 100) || headingDev > Number(ex.maxHeadingDriftDeg || 15) || absBank > Number(ex.maxBankBeforeBreakDeg || 15) + 12;
            const reason = altDev > Number(ex.preBreakAltitudeToleranceFt || 100) ? 'pre_break_altitude' : (headingDev > Number(ex.maxHeadingDriftDeg || 15) ? 'heading' : 'bank');
            if (altDev > Number(ex.preBreakAltitudeToleranceFt || 100) * 0.6) pushCaution(active, events, 'stall_hold_altitude', now, { altDevFt: Math.round(altDev) });
            if (absBank > Math.max(10, Number(ex.maxBankBeforeBreakDeg || 15) * 0.75)) pushCaution(active, events, 'stall_wings_level', now, { bankDeg: roundNumber(absBank, 1) });
            if (badFor(active, bad, now, ex.violationGraceSec)) {
                repeatExercise(state, ex, sample, events, reason);
                return;
            }
            const pitchDrop = Number.isFinite(active.stallEntryPitchDeg) && Number.isFinite(sample.pitchDeg)
                ? active.stallEntryPitchDeg - sample.pitchDeg
                : 0;
            const altDrop = Number(active.stallEntryAltFt || active.startAltFt || sample.altFt || 0) - Number(sample.altFt || 0);
            const cues = [
                sample.stallState || (Number.isFinite(sample.aoaDeg) && sample.aoaDeg >= Number(ex.targetAoaDeg || 12)),
                Number(sample.vsFpm || 0) <= -650,
                pitchDrop >= 4,
                absBank >= 18,
                altDrop >= 40
            ].filter(Boolean).length;
            if (cues >= 2) {
                active.breakAltFt = Number(sample.altFt || active.stallEntryAltFt || active.startAltFt || 0);
                active.minAltAfterBreakFt = active.breakAltFt;
                active.breakAt = now;
                events.push({
                    type: 'stall_break_detected',
                    exerciseId: ex.id,
                    exerciseType: ex.type,
                    label: ex.label
                });
                setPhase(active, 'recovery', now, events);
            }
            return;
        }
        if (active.phase === 'recovery') {
            if (Number.isFinite(sample.altFt)) {
                active.minAltAfterBreakFt = Math.min(Number(active.minAltAfterBreakFt || sample.altFt), sample.altFt);
                active.heightLossFt = Math.max(0, Number(active.breakAltFt || sample.altFt) - active.minAltAfterBreakFt);
            }
            const aoaOk = !Number.isFinite(sample.aoaDeg) || sample.aoaDeg <= Number(ex.targetAoaDeg || 12) - 2;
            const recovered = !sample.stallState
                && aoaOk
                && absBank <= Number(ex.maxRecoveryBankDeg || 12)
                && Number(sample.vsFpm || 0) > -250;
            if (sample.stallState || !aoaOk) pushCaution(active, events, 'stall_secondary', now, { aoaDeg: roundNumber(sample.aoaDeg, 1) });
            if (absBank > Number(ex.maxRecoveryBankDeg || 12)) pushCaution(active, events, 'stall_wings_level', now, { bankDeg: roundNumber(absBank, 1) });
            if (Number(sample.vsFpm || 0) <= -450) pushCaution(active, events, 'stall_stop_sink', now, { vsFpm: Math.round(Number(sample.vsFpm || 0)) });
            if (!recovered) pushCaution(active, events, 'stall_recovery', now);
            if (stableFor(active, recovered, now, ex.recoveryStableSec)) {
                completeExercise(recipe, state, ex, sample, events, {
                    heightLossFt: Math.round(Number(active.heightLossFt || 0)),
                    aoaPeakDeg: Number.isFinite(active.aoaPeak) ? roundNumber(active.aoaPeak, 1) : null,
                    maxBankDeg: roundNumber(Math.max(absBank, Number(active.maxBankDevDeg || 0)), 1),
                    referenceIasKts: Number.isFinite(active.refIasKts) ? roundNumber(active.refIasKts, 1) : null
                });
            }
        }
    }

    function tickState(recipeRaw, stateRaw, sampleRaw) {
        const recipe = normalizeRecipe(recipeRaw);
        if (!recipe) return { handled: false, state: stateRaw || null, events: [], satisfied: false, progress: null };
        const state = stateRaw || createInitialState(recipe);
        state.recipe = recipe;
        state.requiredCount = Number(recipe.requiredCount || DEFAULTS.requiredExerciseCount);
        if (state.recipeKey !== recipe.key) return tickState(recipe, createInitialState(recipe), sampleRaw);
        const sample = withTurnRate(state, sampleRaw?.flightData ? sampleFromInput(sampleRaw) : sampleRaw);
        const events = [];
        if (sample.onGround || !Number.isFinite(sample.altFt) || !Number.isFinite(sample.headingDeg)) {
            state.updatedAt = Number(sample.nowMs || Date.now());
            return { handled: true, state, events, satisfied: !!state.requiredComplete, progress: snapshotState(state), recipe };
        }
        if (!state.departureGatePassed) {
            const minDepartureDistanceNm = Number(recipe.minDepartureDistanceNm || 0);
            if (minDepartureDistanceNm <= 0 || (Number.isFinite(sample.departureDistanceNm) && sample.departureDistanceNm >= minDepartureDistanceNm)) {
                state.departureGatePassed = true;
            } else {
                state.updatedAt = Number(sample.nowMs || Date.now());
                return { handled: true, state, events, satisfied: false, progress: snapshotState(state), recipe };
            }
        }
        if (state.requiredComplete && !state.optionalRequested && !state.active) {
            state.updatedAt = Number(sample.nowMs || Date.now());
            return { handled: true, state, events, satisfied: true, progress: snapshotState(state), recipe };
        }
        const nextEx = recipe.exercises[state.activeIndex] || null;
        if (!nextEx) {
            state.satisfied = true;
            state.requiredComplete = true;
            events.push({ type: 'training_complete' });
            state.updatedAt = Number(sample.nowMs || Date.now());
            return { handled: true, state, events, satisfied: true, progress: snapshotState(state), recipe };
        }
        const agl = Number(sample.aglFt);
        const minAgl = !state.ready && !state.requiredComplete
            ? Number(recipe.readyMinAglFt || DEFAULTS.minAglFt)
            : (nextEx.type === 'stall_recovery' ? Number(recipe.stallMinAglFt || DEFAULTS.stallMinAglFt) : Number(recipe.minAglFt || DEFAULTS.minAglFt));
        if (Number.isFinite(agl) && agl < minAgl) {
            pushGateEvent(state, events, 'training_wait_altitude', sample, {
                exerciseId: nextEx.id,
                exerciseType: nextEx.type,
                label: nextEx.label,
                minAglFt: minAgl
            });
            state.updatedAt = Number(sample.nowMs || Date.now());
            state.events = events;
            return { handled: true, state, events, satisfied: !!state.requiredComplete, progress: snapshotState(state), recipe };
        }
        const waitingForExerciseStart = !state.ready && (!state.requiredComplete || state.optionalRequested);
        if (waitingForExerciseStart) {
            if (!state.readyPrompted) {
                if (sample.nowMs < Number(state.nextInstructionAt || 0)) {
                    state.updatedAt = Number(sample.nowMs || Date.now());
                    return { handled: true, state, events, satisfied: !!state.requiredComplete, progress: snapshotState(state), recipe };
                }
                events.push({
                    type: 'exercise_instruction',
                    exerciseId: nextEx.id,
                    exerciseType: nextEx.type,
                    label: nextEx.label,
                    targetBankDeg: Number.isFinite(Number(nextEx.targetBankDeg)) ? Number(nextEx.targetBankDeg) : null,
                    altitudeStepFt: Number.isFinite(Number(nextEx.altitudeStepFt)) ? Number(nextEx.altitudeStepFt) : null,
                    retry: Number(state.exercises?.[state.activeIndex]?.attempts || 0) > 0,
                    index: state.activeIndex + 1,
                    total: recipe.exercises.length
                });
                state.readyPrompted = true;
            }
            const stable = Math.abs(Number(sample.bankDeg || 0)) <= 8
                && Math.abs(Number(sample.vsFpm || 0)) <= 350;
            if (stable) {
                if (!state.preStartStableSince) state.preStartStableSince = sample.nowMs;
                if (!state.startAvailable && (sample.nowMs - state.preStartStableSince) >= 3000) {
                    state.startAvailable = true;
                    events.push({ type: 'training_start_available', exerciseId: nextEx.id, exerciseType: nextEx.type, label: nextEx.label });
                }
            } else {
                state.preStartStableSince = 0;
                state.startAvailable = false;
            }
            state.updatedAt = Number(sample.nowMs || Date.now());
            state.events = events;
            return { handled: true, state, events, satisfied: false, progress: snapshotState(state), recipe };
        }
        if (state.requiredComplete && state.optionalRequested && state.ready && !state.active) {
            state.optionalRequested = false;
            state.optionalActive = true;
            events.push({
                type: 'training_optional_started',
                exerciseId: nextEx.id,
                exerciseType: nextEx.type,
                label: nextEx.label
            });
        }
        const ex = ensureActiveExercise(recipe, state, sample, events);
        if (!ex) {
            state.updatedAt = Number(sample.nowMs || Date.now());
            return { handled: true, state, events, satisfied: !!state.requiredComplete, progress: snapshotState(state), recipe };
        }
        if (ex.type === 'altitude_step_hold') tickAltitudeStep(recipe, state, ex, sample, events);
        else if (ex.type === 'constant_bank_360') tickConstantTurn(recipe, state, ex, sample, events, 360);
        else if (ex.type === 'turn_180') tickConstantTurn(recipe, state, ex, sample, events, 180);
        else if (ex.type === 'stall_recovery') tickStallRecovery(recipe, state, ex, sample, events);
        state.updatedAt = Number(sample.nowMs || Date.now());
        state.events = events;
        return { handled: true, state, events, satisfied: !!state.requiredComplete, progress: snapshotState(state), recipe };
    }

    function getMissionRecipe(missionData = null, passenger = null) {
        const md = missionData || activeMissionDataFromHost();
        const pax = passenger || md?.passenger || host.activePassenger || null;
        return normalizeRecipe(null, md, pax);
    }

    function tick(input = {}) {
        const recipe = getMissionRecipe(input.missionData || null, input.passenger || null);
        if (!recipe) {
            if (activeRecipeKey) reset('no-active-training');
            return { handled: false, events: [], satisfied: false, progress: null };
        }
        if (!activeState || activeRecipeKey !== recipe.key || activeState.recipeKey !== recipe.key) {
            activeState = createInitialState(recipe);
            activeRecipeKey = recipe.key;
        }
        const result = tickState(recipe, activeState, sampleFromInput(input));
        activeState = result.state;
        return { ...result, recipe, progress: snapshotState(activeState) };
    }

    function restoreProgress(progress = null, missionData = null, passenger = null) {
        const recipe = getMissionRecipe(missionData, passenger);
        if (!recipe || !progress) return false;
        activeState = hydrateState(recipe, progress);
        activeRecipeKey = recipe.key;
        return true;
    }

    function reset() {
        activeRecipeKey = '';
        activeState = null;
    }

    function ensureStateForControl(missionData = null, passenger = null) {
        const recipe = getMissionRecipe(missionData, passenger);
        if (!recipe) return null;
        if (!activeState || activeRecipeKey !== recipe.key || activeState.recipeKey !== recipe.key) {
            activeState = createInitialState(recipe);
            activeRecipeKey = recipe.key;
        }
        activeState.recipe = recipe;
        activeState.requiredCount = Number(recipe.requiredCount || DEFAULTS.requiredExerciseCount);
        return { recipe, state: activeState };
    }

    function signalReady(missionData = null, passenger = null) {
        const ctx = ensureStateForControl(missionData, passenger);
        if (!ctx) return { ok: false, reason: 'no_training' };
        if (ctx.state.requiredComplete && !ctx.state.optionalRequested) return { ok: false, reason: 'required_complete', state: snapshotState(ctx.state), recipe: ctx.recipe };
        if (!ctx.state.departureGatePassed) return { ok: false, reason: 'departure_distance', state: snapshotState(ctx.state), recipe: ctx.recipe };
        if (!ctx.state.readyPrompted) return { ok: false, reason: 'not_briefed', state: snapshotState(ctx.state), recipe: ctx.recipe };
        if (!ctx.state.startAvailable) return { ok: false, reason: 'not_stable', state: snapshotState(ctx.state), recipe: ctx.recipe };
        ctx.state.ready = true;
        ctx.state.readyPrompted = true;
        ctx.state.startAvailable = false;
        ctx.state.updatedAt = Date.now();
        return { ok: true, state: snapshotState(ctx.state), recipe: ctx.recipe };
    }

    function requestOptionalExercise(missionData = null, passenger = null) {
        const ctx = ensureStateForControl(missionData, passenger);
        if (!ctx) return { ok: false, reason: 'no_training' };
        if (!ctx.state.requiredComplete) return { ok: false, reason: 'required_open', state: snapshotState(ctx.state), recipe: ctx.recipe };
        if (ctx.state.active) return { ok: false, reason: 'active', state: snapshotState(ctx.state), recipe: ctx.recipe };
        if (Number(ctx.state.activeIndex || 0) >= ctx.recipe.exercises.length) {
            return { ok: false, reason: 'no_optional_left', state: snapshotState(ctx.state), recipe: ctx.recipe };
        }
        ctx.state.optionalRequested = true;
        ctx.state.optionalActive = false;
        resetExerciseStartGate(ctx.state);
        ctx.state.updatedAt = Date.now();
        return { ok: true, state: snapshotState(ctx.state), recipe: ctx.recipe };
    }

    function abortExercise(missionData = null, passenger = null) {
        const ctx = ensureStateForControl(missionData, passenger);
        if (!ctx) return { ok: false, reason: 'no_training' };
        if (!ctx.state.active) return { ok: false, reason: 'no_active', state: snapshotState(ctx.state), recipe: ctx.recipe };
        const rec = ctx.state.exercises?.[ctx.state.activeIndex] || null;
        if (rec) rec.status = 'repeat';
        const wasOptional = !!ctx.state.optionalActive;
        ctx.state.active = null;
        ctx.state.lastSample = null;
        ctx.state.optionalActive = false;
        if (wasOptional) ctx.state.optionalRequested = true;
        resetExerciseStartGate(ctx.state, Date.now(), 5000);
        ctx.state.updatedAt = Date.now();
        return { ok: true, state: snapshotState(ctx.state), recipe: ctx.recipe };
    }

    const api = {
        defaults: DEFAULTS,
        getActiveRecipe: getMissionRecipe,
        normalizeRecipe,
        normalizeExercise,
        defaultExercisesForPlan,
        createInitialState,
        hydrateState,
        snapshot: () => snapshotState(activeState),
        tick,
        restoreProgress,
        reset,
        signalReady,
        abortExercise,
        requestOptionalExercise,
        _test: {
            angleDiffAbs,
            signedAngleDelta,
            sampleFromInput,
            tickState,
            snapshotState,
            createInitialState,
            hydrateState
        }
    };

    host.missionTrainingProcedure = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
