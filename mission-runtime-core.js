// Mission Runtime Core
// Extrahierte Runtime-/Bush-/Ground-Action-Helfer aus sync.js.
// Ziel: Strukturgewinn ohne Verhaltensaenderung.

function _missionBushAreaRef() {
    const bush = _activeBushMissionSpec();
    const area = bush?.areaRef;
    if (!area || typeof area !== 'object') return null;
    const lat = Number(area.lat);
    const lon = Number(area.lon);
    const radiusNm = Math.max(0.5, Number(area.radiusNm) || 3);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return { ...area, lat, lon, radiusNm };
}

function _missionBushAreaDistanceNm(lat, lon) {
    const area = _missionBushAreaRef();
    if (!area || !Number.isFinite(Number(lat)) || !Number.isFinite(Number(lon))) return null;
    return _haversineNmLocal(Number(lat), Number(lon), area.lat, area.lon);
}

function _missionBushIsPickupMission() {
    const bush = _activeBushMissionSpec();
    return !!(bush && bush.targetMode === 'strip_then_return' && ['passenger', 'cargo'].includes(String(bush.pickupKind || '').toLowerCase()));
}

function _missionBushIsPickupPassengerMission() {
    const bush = _activeBushMissionSpec();
    return !!(bush && bush.targetMode === 'strip_then_return' && String(bush.pickupKind || '').toLowerCase() === 'passenger');
}

function _missionBushIsPickupCargoMission() {
    const bush = _activeBushMissionSpec();
    return !!(bush && bush.targetMode === 'strip_then_return' && String(bush.pickupKind || '').toLowerCase() === 'cargo');
}

function _missionBushUsesPoiTaskRecipe() {
    if (!_missionSceneIsBushMission()) return false;
    const bush = _activeBushMissionSpec();
    if (!bush || typeof bush !== 'object') return false;
    if (typeof _bushRecipeIdFromSpec === 'function') {
        return _bushRecipeIdFromSpec(bush) === 'poi_on_task_return';
    }
    const targetMode = String(bush.targetMode || '').toLowerCase();
    const completionMode = String(bush.completionMode || '').toLowerCase();
    return !!(targetMode === 'area_then_return' && completionMode === 'return_home');
}
window.missionBushUsesPoiTaskRecipe = _missionBushUsesPoiTaskRecipe;

function _missionPoiTaskProgressState() {
    if (typeof window.paxVoiceGetPoiMissionProgress !== 'function') return null;
    try {
        const progress = window.paxVoiceGetPoiMissionProgress();
        return progress && typeof progress === 'object' ? progress : null;
    } catch (_) {
        return null;
    }
}

function _missionRuntimeViewMissionData() {
    try {
        return (typeof currentMissionData !== 'undefined' && currentMissionData && typeof currentMissionData === 'object')
            ? currentMissionData
            : null;
    } catch (_) {
        return null;
    }
}

function _missionRuntimeViewPassenger(md = _missionRuntimeViewMissionData()) {
    if (window.activePassenger && typeof window.activePassenger === 'object') return window.activePassenger;
    if (md?.passenger && typeof md.passenger === 'object') return md.passenger;
    if (md?.missionContract?.passenger && typeof md.missionContract.passenger === 'object') return md.missionContract.passenger;
    return null;
}

function _missionRuntimeViewRouteReturnsHome() {
    const points = typeof _missionRuntimeRouteWaypoints === 'function'
        ? _missionRuntimeRouteWaypoints()
        : null;
    if (!Array.isArray(points) || points.length < 3) return false;
    const first = points[0];
    const last = points[points.length - 1];
    const firstLat = Number(first?.lat);
    const firstLon = Number(first?.lng ?? first?.lon);
    const lastLat = Number(last?.lat);
    const lastLon = Number(last?.lng ?? last?.lon);
    if (![firstLat, firstLon, lastLat, lastLon].every(Number.isFinite)) return false;
    return _haversineNmLocal(firstLat, firstLon, lastLat, lastLon) <= 0.5;
}

function _missionRuntimeViewSurveySpec(md, passenger) {
    if (typeof window.missionSurveyPattern?.getActiveSpec === 'function') {
        try {
            const spec = window.missionSurveyPattern.getActiveSpec(md, passenger);
            if (spec && typeof spec === 'object') return spec;
        } catch (_) {}
    }
    return md?.surveyPattern || md?.missionContract?.surveyPattern || null;
}

function _missionRuntimeViewPoiChainSpec(md, passenger) {
    if (typeof window.missionPoiChainRuntime?.getActiveSpec === 'function') {
        try {
            const spec = window.missionPoiChainRuntime.getActiveSpec(md, passenger);
            if (spec && typeof spec === 'object') return spec;
        } catch (_) {}
    }
    return md?.poiChain || md?.missionContract?.poiChain || null;
}

function _missionRuntimeViewWorkProgress({ md, passenger, poiProgress, bush, bushProgress }) {
    const metrics = [];
    const strict = !!window.paxVoiceGetDebugState?.().strictMode;
    const surveySpec = _missionRuntimeViewSurveySpec(md, passenger);
    const survey = poiProgress?.surveyPattern || null;
    if (survey && surveySpec) {
        if (String(surveySpec.type || '').toLowerCase() === 'orbit') {
            const total = Math.max(1, Math.round(Number(surveySpec.orbit?.requiredTurns || survey.orbit?.requiredTurns || 3)));
            const completed = Math.max(0, Math.min(total, Math.round(Number(survey.orbit?.completedTurns || 0))));
            const activeFraction = Math.max(0, Math.min(1, Number(survey.orbit?.activeCoverage || 0)));
            metrics.push({
                id: 'survey_orbits',
                kind: 'count',
                label: 'Survey-Kreise',
                completed,
                total,
                activePct: Math.round(activeFraction * 100),
                percent: Math.min(100, ((completed + activeFraction) / total) * 100),
                satisfied: !!survey.satisfied
            });
        } else {
            const total = Array.isArray(surveySpec.scan?.lines)
                ? Math.max(1, surveySpec.scan.lines.length)
                : Math.max(1, Math.round(Number(surveySpec.scan?.lineCount || survey.scan?.totalLines || 1)));
            const completed = Array.isArray(survey.scan?.completedLineIds)
                ? survey.scan.completedLineIds.length
                : Math.max(0, Math.round(Number(survey.scan?.completedCount || 0)));
            const activeFraction = Math.max(0, Math.min(1, Number(survey.scan?.activeCoverage || 0)));
            metrics.push({
                id: 'survey_sectors',
                kind: 'count',
                label: 'Mapping-Sektoren',
                completed: Math.min(total, completed),
                total,
                activePct: Math.round(activeFraction * 100),
                percent: Math.min(100, ((Math.min(total, completed) + activeFraction) / total) * 100),
                satisfied: !!survey.satisfied
            });
        }
    }

    const chainSpec = _missionRuntimeViewPoiChainSpec(md, passenger);
    const chain = poiProgress?.poiChain || null;
    if (chain && chainSpec) {
        const requiredPoints = Array.isArray(chainSpec.points)
            ? chainSpec.points.filter(point => point?.required !== false)
            : [];
        const total = Math.max(1, requiredPoints.length || Number(chain.totalPoints || 0) || 1);
        const completed = Array.isArray(chain.completedPointIds)
            ? chain.completedPointIds.length
            : Math.max(0, Number(chain.completedCount || 0));
        metrics.push({
            id: 'poi_chain_points',
            kind: 'count',
            label: 'Inspektionspunkte',
            completed: Math.min(total, completed),
            total,
            activePct: 0,
            percent: Math.min(100, (completed / total) * 100),
            satisfied: !!chain.satisfied
        });
    }

    const training = poiProgress?.trainingProcedure || null;
    if (training) {
        const total = Math.max(1, Math.round(Number(training.requiredCount || training.totalExercises || 1)));
        const completed = Math.max(0, Math.min(total, Math.round(Number(training.completedCount || 0))));
        metrics.push({
            id: 'training_exercises',
            kind: 'count',
            label: 'Pflichtübungen',
            completed,
            total,
            activePct: 0,
            percent: Math.min(100, (completed / total) * 100),
            satisfied: !!(training.requiredComplete || training.satisfied)
        });
    }

    const hasSpecialWorkCounter = metrics.some(metric => [
        'survey_orbits',
        'survey_sectors',
        'poi_chain_points',
        'training_exercises'
    ].includes(metric.id));
    const briefDwellSec = Math.max(0, Number(passenger?.targetDwellMin || 0) * 60);
    if (!hasSpecialWorkCounter && briefDwellSec > 0) {
        const requiredSec = briefDwellSec * (strict ? 1 : 0.5);
        const completedSec = Math.max(0, Number(poiProgress?.dwellSec || 0));
        metrics.push({
            id: 'poi_work_time',
            kind: 'duration',
            label: 'Zeit im Arbeitsbereich',
            completedSec,
            requiredSec,
            briefRequiredSec: briefDwellSec,
            percent: requiredSec > 0 ? Math.min(100, (completedSec / requiredSec) * 100) : 100,
            satisfied: !!poiProgress?.satisfied,
            strict
        });
    }

    const minAreaTimeSec = Math.max(0, Number(bush?.success?.minAreaTimeSec || 0));
    if (bushProgress && minAreaTimeSec > 0 && !metrics.some(metric => metric.id === 'poi_work_time')) {
        const completedSec = Math.max(0, Number(bushProgress.areaDwellSec || 0));
        metrics.push({
            id: 'bush_area_time',
            kind: 'duration',
            label: 'Zeit im Arbeitsbereich',
            completedSec,
            requiredSec: minAreaTimeSec,
            briefRequiredSec: minAreaTimeSec,
            percent: Math.min(100, (completedSec / minAreaTimeSec) * 100),
            satisfied: !!bushProgress.areaQualified
        });
    }

    const minAreaTrackNm = Math.max(0, Number(bush?.success?.minAreaTrackNm || 0));
    if (bushProgress && minAreaTrackNm > 0) {
        const completedNm = Math.max(0, Number(bushProgress.areaTrackNm || 0));
        metrics.push({
            id: 'bush_area_track',
            kind: 'distance',
            label: 'Strecke im Arbeitsbereich',
            completedNm,
            requiredNm: minAreaTrackNm,
            percent: Math.min(100, (completedNm / minAreaTrackNm) * 100),
            satisfied: !!bushProgress.areaQualified
        });
    }
    return metrics;
}

function _missionRuntimeViewStageSet(missionType, requiresReturnHome, bush = null) {
    if (missionType === 'sar_heli') {
        return [
            { id: 'preparation', label: 'Vorbereitung' },
            { id: 'outbound', label: 'Anflug' },
            { id: 'search', label: 'Suche' },
            { id: 'recovery', label: 'Bergung' },
            { id: 'medical_leg', label: 'Medizinflug' },
            { id: 'handoff', label: 'Übergabe' },
            { id: 'complete', label: 'Abschluss' }
        ];
    }
    if (missionType === 'bush_pickup') {
        return [
            { id: 'preparation', label: 'Vorbereitung' },
            { id: 'outbound', label: 'Leerflug' },
            { id: 'pickup', label: 'Pickup' },
            { id: 'return_leg', label: 'Rückflug' },
            { id: 'handoff', label: 'Übergabe' },
            { id: 'complete', label: 'Abschluss' }
        ];
    }
    if (missionType === 'bush_target') {
        const completionMode = String(bush?.completionMode || '').toLowerCase();
        const targetLabel = completionMode === 'unload_at_target'
            ? 'Entladen'
            : (completionMode === 'passenger_dropoff' ? 'Aussteigen' : 'Zielstrip');
        return [
            { id: 'preparation', label: 'Vorbereitung' },
            { id: 'outbound', label: 'Hinflug' },
            { id: 'target', label: targetLabel },
            { id: 'complete', label: 'Abschluss' }
        ];
    }
    if (missionType === 'apt') {
        return [
            { id: 'preparation', label: 'Vorbereitung' },
            { id: 'enroute', label: 'Reiseflug' },
            { id: 'arrival', label: 'Ankunft' },
            { id: 'complete', label: 'Abschluss' }
        ];
    }
    const workLabel = missionType === 'survey'
        ? 'Mapping'
        : (missionType === 'poi_chain'
            ? 'Inspektion'
            : (missionType === 'training' ? 'Training' : 'Arbeitsbereich'));
    return [
        { id: 'preparation', label: 'Vorbereitung' },
        { id: 'outbound', label: 'Anflug' },
        { id: 'work', label: workLabel },
        ...(requiresReturnHome ? [{ id: 'return_leg', label: 'Rückflug' }] : []),
        { id: 'landing', label: 'Landung' },
        { id: 'complete', label: 'Abschluss' }
    ];
}

function _missionRuntimeViewType({ isPoi, isBush, bush, poiProgress, taskDomain }) {
    if (typeof window.missionSceneIsSarHeliMission === 'function' && window.missionSceneIsSarHeliMission()) return 'sar_heli';
    if (isBush && _missionBushIsPickupMission()) return 'bush_pickup';
    if (isBush && !_missionBushUsesPoiTaskRecipe()) return 'bush_target';
    if (taskDomain === 'mapping_survey' || poiProgress?.surveyPattern) return 'survey';
    if (poiProgress?.poiChain) return 'poi_chain';
    if (/^(training|club_training_basic|club_training_advanced)$/.test(taskDomain) || poiProgress?.trainingProcedure) return 'training';
    if (isPoi || (isBush && _missionBushUsesPoiTaskRecipe())) return 'poi';
    return 'apt';
}

function _missionRuntimeViewCurrentPhase(context) {
    const {
        runtimePhase,
        missionType,
        meaningfulFlight,
        endReady,
        runtimeGroundEndReady,
        poiProgress,
        bushProgress,
        workEntered,
        taskResolved,
        requiresReturnHome,
        dTargetNm
    } = context;
    if (runtimePhase === 'closing') return 'complete';
    if (!context.active) return 'preparation';

    if (missionType === 'apt') {
        if (!meaningfulFlight) return 'preparation';
        const arrivalApproach = runtimeGroundEndReady
            || runtimePhase === 'end_ready'
            || (Number.isFinite(dTargetNm) && dTargetNm <= 4.5);
        return arrivalApproach ? 'arrival' : 'enroute';
    }

    if (missionType === 'bush_pickup') {
        const status = String(bushProgress?.status || '').toLowerCase();
        if (runtimeGroundEndReady || runtimePhase === 'end_ready' || ['home_unloading', 'ready_to_close'].includes(status)) return 'handoff';
        if (status === 'return_leg' || bushProgress?.pickupConfirmed) return 'return_leg';
        if (['pickup_ready', 'pickup_loading', 'pickup_complete'].includes(status) || bushProgress?.pickupReady || bushProgress?.pickupCompleted) return 'pickup';
        return meaningfulFlight ? 'outbound' : 'preparation';
    }

    if (missionType === 'bush_target') {
        if (runtimeGroundEndReady || runtimePhase === 'end_ready' || endReady?.atTarget) return 'target';
        return meaningfulFlight ? 'outbound' : 'preparation';
    }

    if (missionType === 'sar_heli') {
        const sar = poiProgress?.sarHeli || null;
        if (runtimeGroundEndReady || runtimePhase === 'end_ready' || sar?.readyToClose) return 'handoff';
        if (sar?.patientLoaded) return 'medical_leg';
        if (sar?.targetConfirmed) return 'recovery';
        if (sar?.targetAreaEnteredAt || workEntered) return 'search';
        return meaningfulFlight ? 'outbound' : 'preparation';
    }

    if (runtimeGroundEndReady || runtimePhase === 'end_ready') return 'landing';
    if (taskResolved) return requiresReturnHome ? 'return_leg' : 'landing';
    if (workEntered) return 'work';
    return meaningfulFlight ? 'outbound' : 'preparation';
}

function _missionRuntimePhaseViewSnapshot() {
    const md = _missionRuntimeViewMissionData();
    const passenger = _missionRuntimeViewPassenger(md);
    const poiProgress = _missionPoiTaskProgressState();
    const bush = typeof _activeBushMissionSpec === 'function' ? _activeBushMissionSpec() : null;
    const bushProgress = typeof _activeBushMissionProgress === 'function' ? _activeBushMissionProgress() : null;
    const isBush = typeof _missionSceneIsBushMission === 'function' && _missionSceneIsBushMission();
    const isPoi = typeof _missionSceneIsPoiMission === 'function' && _missionSceneIsPoiMission();
    const taskDomain = String(
        passenger?.taskDomain
        || md?.missionContract?.taskDomain
        || md?.taskDomain
        || ''
    ).trim().toLowerCase();
    const poiRecipeId = typeof window.missionPoiRecipeId === 'function'
        ? String(window.missionPoiRecipeId(md) || '').trim().toLowerCase()
        : '';
    const bushRecipeId = bush && typeof _bushRecipeIdFromSpec === 'function'
        ? String(_bushRecipeIdFromSpec(bush) || '').trim().toLowerCase()
        : '';
    const routeReturnsHome = _missionRuntimeViewRouteReturnsHome();
    const requiresReturnHome = !!(
        bush?.requiresReturnHome
        || bushRecipeId === 'pickup_return'
        || bushRecipeId === 'poi_on_task_return'
        || poiRecipeId === 'poi_on_task_return'
        || ((isPoi || _missionBushUsesPoiTaskRecipe()) && routeReturnsHome)
    );
    const missionType = _missionRuntimeViewType({ isPoi, isBush, bush, poiProgress, taskDomain });
    const runtimePhase = typeof _missionRuntimePhaseSnapshot === 'function'
        ? String(_missionRuntimePhaseSnapshot() || 'idle')
        : (missionRuntime?.active ? 'active' : 'idle');
    const active = !!missionRuntime?.active;
    const meaningfulFlight = active && typeof _missionHasReachedEndEligibleFlightPhase === 'function'
        ? !!_missionHasReachedEndEligibleFlightPhase()
        : false;
    const pos = window.lastLiveGpsPos || {};
    const lat = Number(pos.lat);
    const lon = Number(pos.lon);
    const hasPosition = Number.isFinite(lat) && Number.isFinite(lon);
    const endReady = hasPosition && typeof _missionEndReadiness === 'function'
        ? _missionEndReadiness(lat, lon)
        : null;
    const runtimeGroundEndReady = active && typeof _missionRuntimeGroundEndReady === 'function'
        ? !!_missionRuntimeGroundEndReady(endReady)
        : runtimePhase === 'end_ready';
    const dTargetNm = hasPosition && typeof _distanceToMissionTargetNm === 'function'
        ? Number(_distanceToMissionTargetNm(lat, lon))
        : NaN;
    const dHomeNm = hasPosition && typeof _distanceToMissionHomeNm === 'function'
        ? Number(_distanceToMissionHomeNm(lat, lon))
        : NaN;
    const targetRadiusNm = Math.max(
        0,
        Number(passenger?.targetRadiusNm || bush?.areaRef?.radiusNm || 0)
    );
    const surveyStarted = !!poiProgress?.surveyPattern?.startedAt;
    const chainStarted = !!poiProgress?.poiChain?.startedAt;
    const trainingStarted = !!(
        poiProgress?.trainingProcedure?.startedAt
        || poiProgress?.trainingProcedure?.ready
        || poiProgress?.trainingProcedure?.activeExercise
    );
    const bushOnTask = String(bushProgress?.status || '').toLowerCase() === 'on_task';
    const workEntered = !!(
        surveyStarted
        || chainStarted
        || trainingStarted
        || bushOnTask
        || poiProgress?.sarHeli?.targetAreaEnteredAt
        || (meaningfulFlight && targetRadiusNm > 0 && Number.isFinite(dTargetNm) && dTargetNm <= targetRadiusNm)
    );
    const taskSatisfied = !!(
        poiProgress?.satisfied
        || bushProgress?.areaQualified
        || bushProgress?.pickupCompleted
    );
    const taskAborted = !!poiProgress?.aborted;
    const taskResolved = taskSatisfied || taskAborted;
    const stages = _missionRuntimeViewStageSet(missionType, requiresReturnHome, bush);
    const currentPhase = _missionRuntimeViewCurrentPhase({
        active,
        runtimePhase,
        missionType,
        meaningfulFlight,
        endReady,
        runtimeGroundEndReady,
        poiProgress,
        bushProgress,
        workEntered,
        taskResolved,
        requiresReturnHome,
        dTargetNm
    });
    const currentIndex = Math.max(0, stages.findIndex(stage => stage.id === currentPhase));
    const poiStatus = active && isPoi && typeof _missionPoiRuntimeStatus === 'function'
        ? _missionPoiRuntimeStatus(endReady)
        : null;
    return {
        schema: 'ga.missionPhaseView.v1',
        source: 'mission-runtime-core',
        missionId: typeof _activeMissionRuntimeId === 'function' ? _activeMissionRuntimeId('') : '',
        runtimePhase,
        domainPhase: String(
            bushProgress?.status
            || poiStatus?.stage
            || currentPhase
        ),
        missionType,
        taskDomain,
        recipeId: bushRecipeId || poiRecipeId || (missionType === 'apt' ? 'apt_arrival' : 'poi_on_task'),
        active,
        requiresReturnHome,
        routeReturnsHome,
        currentPhase,
        currentIndex,
        stages,
        nextStep: String(poiStatus?.nextStep || '').replace(/^Nächster Schritt:\s*/i, ''),
        flags: {
            meaningfulFlight,
            workEntered,
            taskSatisfied,
            taskAborted,
            taskResolved,
            atTarget: !!endReady?.atTarget,
            atHome: Number.isFinite(dHomeNm) && dHomeNm <= 0.35,
            groundStill: !!endReady?.groundStill,
            endReady: runtimeGroundEndReady || runtimePhase === 'end_ready'
        },
        distances: {
            targetNm: Number.isFinite(dTargetNm) ? dTargetNm : null,
            homeNm: Number.isFinite(dHomeNm) ? dHomeNm : null,
            arrivalNm: Number.isFinite(Number(endReady?.dArrivalNm)) ? Number(endReady.dArrivalNm) : null
        },
        workProgress: _missionRuntimeViewWorkProgress({ md, passenger, poiProgress, bush, bushProgress })
    };
}
window.missionRuntimeGetPhaseSnapshot = _missionRuntimePhaseViewSnapshot;

function _missionBushPickupItems(manifest = _missionCargoEnsureManifest()) {
    const items = Array.isArray(manifest?.items) ? manifest.items : [];
    return items.filter(item => item && item.pickupLocation === 'target');
}

function _missionBushPickupLoadState(manifest = _missionCargoEnsureManifest()) {
    const pickupItems = _missionBushPickupItems(manifest);
    const requiredItems = pickupItems.filter(item => item.required === true);
    const blockingItems = requiredItems.length ? requiredItems : pickupItems;
    const pickedItems = blockingItems.filter(item => item.status === 'loaded' || item.status === 'unloaded');
    const unloadedItems = blockingItems.filter(item => item.status === 'unloaded');
    return {
        pickupItems,
        requiredItems: blockingItems,
        hasItems: blockingItems.length > 0,
        pickedCount: pickedItems.length,
        complete: blockingItems.length > 0 && pickedItems.length === blockingItems.length,
        unloaded: blockingItems.length > 0 && unloadedItems.length === blockingItems.length,
        hasPassenger: blockingItems.some(item => _missionCargoIsPassengerItem(item)),
        hasCargo: blockingItems.some(item => !_missionCargoIsPassengerItem(item))
    };
}

function _missionBushPickupAtTargetNow(lat = null, lon = null) {
    const pos = window.lastLiveGpsPos || {};
    const curLat = Number(lat ?? pos.lat);
    const curLon = Number(lon ?? pos.lon);
    if (!Number.isFinite(curLat) || !Number.isFinite(curLon)) return false;
    const ready = _missionEndReadiness(curLat, curLon);
    if (!ready?.groundStill) return false;
    if (
        ready?.atTarget
        && (ready.reason === 'apt_arrival_point' || ready.reason === 'apt_airport_fallback')
    ) return true;
    const bush = _activeBushMissionSpec();
    const targetLat = Number(bush?.targetRef?.lat);
    const targetLon = Number(bush?.targetRef?.lon);
    if (Number.isFinite(targetLat) && Number.isFinite(targetLon)) {
        const atArrivalPoint = _isAtAptArrivalPoint(curLat, curLon, 0.16);
        const dTargetNm = _haversineNmLocal(curLat, curLon, targetLat, targetLon);
        return !!(atArrivalPoint || (Number.isFinite(dTargetNm) && dTargetNm <= 0.35));
    }
    if (!ready?.atTarget) return false;
    if (ready.hasAptArrival) return _isAtAptArrivalPoint(curLat, curLon, 0.12);
    return true;
}

function _missionBushPickupReadyForAction() {
    if (!_missionBushIsPickupMission()) return false;
    const progress = _activeBushMissionProgress();
    if (!progress) return false;
    const pickupState = _missionBushPickupLoadState();
    if (pickupState.complete && !progress?.pickupConfirmed) {
        return !!_missionEndReadiness()?.groundStill;
    }
    if (!_missionBushPickupAtTargetNow()) return false;
    if (!pickupState.hasItems || pickupState.complete) return false;
    if (progress?.pickupReady && !progress?.pickupCompleted) return true;
    _persistBushMissionProgress({
        ...progress,
        targetReached: true,
        pickupReady: true,
        pickupCompleted: false,
        pickupConfirmed: false,
        status: pickupState.pickedCount > 0 ? 'pickup_loading' : 'pickup_ready'
    });
    return true;
}

function _missionResolveGroundAction(options = {}) {
    const active = options?.active ?? missionRuntime.active;
    const deboardingBusy = options?.deboardingBusy ?? _missionEndDeboardingBusy();
    const endReady = options?.endReady ?? (active ? _missionEndReadiness() : null);
    const runtimeGroundEndReady = active ? _missionRuntimeGroundEndReady(endReady) : false;
    const bushProgress = _missionSceneIsBushMission() ? _activeBushMissionProgress() : null;
    const poiRuntime = _missionSceneIsPoiMission();
    const pickupActionReady = active && _missionBushPickupReadyForAction();
    const pickupConfirmOnly = !!(pickupActionReady && bushProgress?.pickupCompleted && !bushProgress?.pickupConfirmed);
    const cargoNeedsUnload = active && _missionCargoNeedsUnload();
    const arrivalWorkflowOpen = active
        && typeof _missionCargoNeedsArrivalWorkflow === 'function'
        && _missionCargoNeedsArrivalWorkflow({ ignorePassenger: true });
    const unloadActionReady = active
        && _missionCargoGroundHandlingAllowed()
        && (
            (runtimeGroundEndReady && arrivalWorkflowOpen)
            || (!runtimeGroundEndReady && !poiRuntime && cargoNeedsUnload)
        );

    let resolved = null;
    if (missionRuntime.closingPending) {
        resolved = { phase: 'closing', action: 'close', endReady: false, pickupConfirmOnly: false };
    } else if (!active) {
        resolved = { phase: _missionRuntimePhaseSnapshot(), action: 'none', endReady: false, pickupConfirmOnly: false };
    } else if (deboardingBusy) {
        resolved = { phase: 'deboarding', action: 'none', endReady: false, pickupConfirmOnly: false };
    } else if (pickupActionReady) {
        resolved = {
            phase: pickupConfirmOnly ? 'pickup_complete' : 'pickup_ready',
            action: 'pickup',
            endReady: false,
            pickupConfirmOnly
        };
    } else if (runtimeGroundEndReady) {
        if (unloadActionReady) {
            resolved = {
                phase: String(bushProgress?.status || '') === 'home_unloading' ? 'home_unloading' : 'end_unloading',
                action: 'unload',
                endReady: true,
                pickupConfirmOnly: false
            };
        } else {
            resolved = {
                phase: String(bushProgress?.status || '') === 'ready_to_close' ? 'ready_to_close' : 'end_ready',
                action: 'end',
                endReady: true,
                pickupConfirmOnly: false
            };
        }
    } else if (unloadActionReady) {
        resolved = {
            phase: String(bushProgress?.status || '') || 'ground_unloading',
            action: 'unload',
            endReady: false,
            pickupConfirmOnly: false
        };
    } else {
        resolved = {
            phase: String(bushProgress?.status || '') || 'active',
            action: 'end',
            endReady: false,
            pickupConfirmOnly: false
        };
    }
    const dbg = _missionPhaseDebugState();
    const sig = JSON.stringify([
        resolved.action,
        resolved.phase,
        resolved.endReady ? 1 : 0,
        resolved.pickupConfirmOnly ? 1 : 0,
        endReady?.reason || '',
        endReady?.groundStill ? 1 : 0,
        endReady?.atTarget ? 1 : 0,
        String(bushProgress?.status || '')
    ]);
    if (dbg.lastGroundActionSig !== sig) {
        dbg.lastGroundActionSig = sig;
        _missionPhaseDebugPush('ground_action', _missionPhaseDebugSummarizeGroundAction(resolved, {
            trigger: options?.trigger || 'resolve-ground-action',
            endReady,
            bushStatus: String(bushProgress?.status || '')
        }));
    }
    return resolved;
}
window.missionResolveGroundAction = _missionResolveGroundAction;

function _missionBushUpdateProgress(lat = null, lon = null, now = Date.now()) {
    if (!_missionSceneIsBushMission()) return null;
    const bush = _activeBushMissionSpec();
    const progress = _activeBushMissionProgress();
    if (!bush || !progress) return null;
    const next = { ...progress };
    const curLat = Number(lat ?? window.lastLiveGpsPos?.lat);
    const curLon = Number(lon ?? window.lastLiveGpsPos?.lon);
    const endReady = _missionEndReadiness(curLat, curLon);
    if (endReady?.atTarget) next.targetReached = true;
    if (_missionBushIsPickupMission()) {
        const pickupState = _missionBushPickupLoadState();
        const pickupLoaded = pickupState.complete;
        const pickupUnloadedHome = pickupState.unloaded && _isAtMissionHome(curLat, curLon);
        const atPickup = _missionBushPickupAtTargetNow(curLat, curLon);
        next.pickupReady = !!(atPickup && pickupState.hasItems && !pickupLoaded);
        next.pickupCompleted = !!pickupLoaded;
        if (!pickupLoaded) next.pickupConfirmed = false;
        if (next.pickupReady && !pickupLoaded) {
            next.status = pickupState.pickedCount > 0 ? 'pickup_loading' : 'pickup_ready';
        }
        if (pickupLoaded && !next.pickupConfirmed) next.status = 'pickup_complete';
        if (pickupLoaded && next.pickupConfirmed && bush.requiresReturnHome && !pickupUnloadedHome) next.status = 'return_leg';
        if (pickupLoaded && endReady?.groundStill && _isAtMissionHome(curLat, curLon)) {
            next.returnHomeQualified = true;
            next.status = pickupUnloadedHome ? 'ready_to_close' : 'home_unloading';
            next.groundStopQualified = !!pickupUnloadedHome;
        }
        if (pickupUnloadedHome) {
            if (pickupState.hasPassenger) next.passengerDropped = true;
            if (pickupState.hasCargo) next.cargoDelivered = true;
            next.returnHomeQualified = true;
            next.groundStopQualified = true;
            next.status = 'ready_to_close';
        }
        const prevJson = JSON.stringify(progress);
        const nextJson = JSON.stringify(next);
        if (prevJson !== nextJson) _persistBushMissionProgress(next);
        return next;
    }
    const mode = _missionBushEffectiveCompletionMode();
    if (mode === 'return_home') {
        if (_missionBushUsesPoiTaskRecipe()) {
            const poiProgress = _missionPoiTaskProgressState();
            const taskResolved = !!(poiProgress?.trackingActive && (poiProgress?.satisfied || poiProgress?.aborted));
            if (endReady?.atTarget) {
                next.targetReached = true;
                if (!taskResolved) next.status = 'on_task';
            }
            next.areaDwellSec = Math.max(0, Number(poiProgress?.dwellSec || next.areaDwellSec || 0));
            next.areaTrackNm = Math.max(0, Number(poiProgress?.trackNm || next.areaTrackNm || 0));
            if (taskResolved) {
                next.areaQualified = true;
                next.status = bush.requiresReturnHome ? 'return_leg' : 'ready_to_close';
            }
            if (next.areaQualified && endReady?.groundStill && _isAtMissionHome(curLat, curLon)) {
                next.returnHomeQualified = true;
                next.groundStopQualified = true;
                next.status = 'ready_to_close';
            } else if (next.areaQualified && bush.requiresReturnHome) {
                next.status = 'return_leg';
            }
            const prevJson = JSON.stringify(progress);
            const nextJson = JSON.stringify(next);
            if (prevJson !== nextJson) _persistBushMissionProgress(next);
            return next;
        }
        const area = _missionBushAreaRef();
        const canSampleArea = !endReady?.groundStill;
        const insideArea = canSampleArea && area && Number.isFinite(curLat) && Number.isFinite(curLon)
            ? (_missionBushAreaDistanceNm(curLat, curLon) <= area.radiusNm)
            : false;
        if (insideArea) {
            if (!next.areaEnteredAt) next.areaEnteredAt = now;
            if (Number.isFinite(next.lastAreaSampleTs) && next.lastAreaSampleTs > 0) {
                const dtSec = Math.max(0, Math.min(10, (now - next.lastAreaSampleTs) / 1000));
                next.areaDwellSec = Math.max(0, Number(next.areaDwellSec || 0) + dtSec);
            }
            if (Number.isFinite(next.lastAreaSampleLat) && Number.isFinite(next.lastAreaSampleLon)) {
                const legNm = _haversineNmLocal(next.lastAreaSampleLat, next.lastAreaSampleLon, curLat, curLon);
                if (Number.isFinite(legNm) && legNm > 0 && legNm <= 2.5) {
                    next.areaTrackNm = Math.max(0, Number(next.areaTrackNm || 0) + legNm);
                }
            }
            next.lastAreaSampleLat = curLat;
            next.lastAreaSampleLon = curLon;
            next.lastAreaSampleTs = now;
            next.targetReached = true;
            if (!next.areaQualified) next.status = 'on_task';
        } else {
            next.lastAreaSampleLat = NaN;
            next.lastAreaSampleLon = NaN;
            next.lastAreaSampleTs = 0;
        }
        const minAreaTimeSec = Math.max(0, Number(bush?.success?.minAreaTimeSec) || 0);
        const minAreaTrackNm = Math.max(0, Number(bush?.success?.minAreaTrackNm) || 0);
        if (!next.areaQualified && next.areaDwellSec >= minAreaTimeSec && next.areaTrackNm >= minAreaTrackNm) {
            next.areaQualified = true;
            next.status = bush.requiresReturnHome ? 'return_leg' : 'ready_to_close';
        }
        if (next.areaQualified && endReady?.groundStill && _isAtMissionHome(curLat, curLon)) {
            next.returnHomeQualified = true;
            next.groundStopQualified = true;
            next.status = 'ready_to_close';
        } else if (next.areaQualified && bush.requiresReturnHome) {
            next.status = 'return_leg';
        }
    } else if (endReady?.groundStill && endReady?.atTarget) {
        next.groundStopQualified = true;
        next.status = 'ready_to_close';
    }
    const prevJson = JSON.stringify(progress);
    const nextJson = JSON.stringify(next);
    if (prevJson !== nextJson) _persistBushMissionProgress(next);
    return next;
}
window.missionBushUpdateProgress = _missionBushUpdateProgress;

function _missionPoiGroundEndReady(endReady = null) {
    if (!_missionSceneIsPoiMission()) return false;
    if (_missionSceneIsBushMission()) return false;
    if (typeof window.missionSceneIsSarHeliMission === 'function' && window.missionSceneIsSarHeliMission()) {
        return typeof window.missionSarHeliGroundEndReady === 'function'
            ? !!window.missionSarHeliGroundEndReady(endReady)
            : false;
    }
    const ready = endReady && typeof endReady === 'object' ? endReady : _missionEndReadiness();
    return !!(ready?.groundStill && _missionHasReachedEndEligibleFlightPhase());
}

function _missionBushEffectiveCompletionMode() {
    const bush = _activeBushMissionSpec();
    const profileId = String(bush?.profileId || '').toLowerCase();
    const completionMode = String(bush?.completionMode || '').toLowerCase();
    if (completionMode) return completionMode;
    if (profileId === 'bush_supply_strip') return 'unload_at_target';
    if (profileId === 'bush_charter_strip') return 'passenger_dropoff';
    if (profileId === 'bush_scenic_hopper') return 'land_at_target';
    return '';
}

function _missionBushRequiresReturnHome() {
    return _missionSceneIsBushMission() && _missionBushEffectiveCompletionMode() === 'return_home';
}

window.missionArmPickupDepartureVoice = function(kind = 'passenger') {
    window.missionPickupDepartureVoicePending = {
        kind: String(kind || 'passenger').toLowerCase() === 'cargo' ? 'cargo' : 'passenger',
        armedAt: Date.now()
    };
    return true;
};

window.missionMaybeTriggerPickupDepartureVoice = function(flightData = {}) {
    const pending = window.missionPickupDepartureVoicePending;
    if (!pending || typeof pending !== 'object') return false;
    const fd = flightData && typeof flightData === 'object' ? flightData : {};
    const gs = Number(fd.gsKts ?? fd.gs ?? window.lastLiveGpsPos?.gs);
    const agl = Number(fd.aglFt);
    if ((Date.now() - Number(pending.armedAt || 0)) < 1500) return false;
    const explicitAirborne = fd.onGround === false && (
        (Number.isFinite(agl) && agl > 12)
        || (Number.isFinite(gs) && gs >= 25)
    );
    const airborne = explicitAirborne || (Number.isFinite(agl) && agl > 45);
    const inferredAirborne = typeof fd.onGround !== 'boolean' && !Number.isFinite(agl) && Number.isFinite(gs) && gs >= 45;
    if (!airborne && !inferredAirborne) return false;
    window.missionPickupDepartureVoicePending = null;
    try {
        if (pending.kind === 'cargo') window.triggerPaxCargoPickupDeparture?.();
        else if (window.activePassenger) window.triggerPaxPickupDeparture?.();
    } catch (_) {}
    return true;
};

function _missionBushEndReadyText() {
    if (_missionBushIsPickupMission()) {
        return _missionBushIsPickupCargoMission()
            ? 'Bush-Cargo-Pickup abgeschlossen. Rueckkehr und Ausladen am Heimatplatz bestaetigt.'
            : 'Bush-Pickup abgeschlossen. Rueckkehr und Ausstieg am Heimatplatz bestaetigt.';
    }
    const mode = _missionBushEffectiveCompletionMode();
    if (mode === 'unload_at_target') {
        return _missionCargoNeedsUnload()
            ? 'Bush-Zielstrip erreicht. Pflichtladung jetzt entladen.'
            : 'Bush-Zielstrip erreicht. Versorgung kann abgeschlossen werden.';
    }
    if (mode === 'passenger_dropoff') {
        return 'Bush-Zielstrip erreicht. Passagier-Dropoff kann jetzt abgeschlossen werden.';
    }
    if (mode === 'land_at_target') {
        return 'Bush-Zielstrip erreicht. Adventure-Leg kann jetzt abgeschlossen werden.';
    }
    if (mode === 'return_home') {
        return 'Bush-Recon abgeschlossen. Mission kann jetzt am Heimatplatz beendet werden.';
    }
    return 'Bush-Zielstrip erreicht. Mission kann abgeschlossen werden.';
}

function _missionBushRuntimeDetailText() {
    if (_missionBushIsPickupMission()) {
        const p = _activeBushMissionProgress();
        const pickupNoun = _missionBushIsPickupCargoMission() ? 'Fracht' : 'Gast';
        const pickupVerb = _missionBushIsPickupCargoMission() ? 'ausladen' : 'aussteigen lassen';
        const pickupLoadedLabel = _missionBushIsPickupCargoMission() ? 'Pickup-Fracht' : 'Pickup';
        if (p?.groundStopQualified && (p?.passengerDropped || p?.cargoDelivered)) return _missionBushIsPickupCargoMission()
            ? 'Pickup-Rueckflug abgeschlossen. Die Rueckholfracht ist am Heimatplatz ausgeladen.'
            : 'Pickup-Rueckflug abgeschlossen. Der Gast ist am Heimatplatz ausgestiegen.';
        if (p?.returnHomeQualified) return `Heimatplatz erreicht. ${pickupNoun} jetzt ${pickupVerb}.`;
        if (String(p?.status || '') === 'pickup_loading') return _missionBushIsPickupCargoMission()
            ? 'Pickup-Ladung wird jetzt am Treffpunkt aufgenommen.'
            : 'Pickup-Boarding laeuft. Der Gast bewegt sich jetzt zum Flugzeug.';
        if (p?.pickupCompleted && p?.pickupConfirmed) return 'Pickup bestaetigt. Rueckflug zum Heimatplatz laeuft.';
        if (p?.pickupCompleted) return `${pickupLoadedLabel} geladen. Rueckflug nach kurzer Bestaetigung freigeben.`;
        if (p?.pickupReady) return _missionBushIsPickupCargoMission()
            ? 'Zielstrip erreicht. Zum Treffpunkt rollen und die Rueckholfracht aufnehmen.'
            : 'Zielstrip erreicht. Zum Treffpunkt rollen und den Pickup starten.';
        return 'Leerflug zum Zielstrip laeuft. Pickup wird erst nach Landung am Treffpunkt freigegeben.';
    }
    const mode = _missionBushEffectiveCompletionMode();
    if (mode === 'unload_at_target') {
        return _missionCargoNeedsUnload()
            ? 'Bush-Zielstrip erreicht. Pflichtladung wartet auf Entladung.'
            : 'Bush-Zielstrip erreicht. Versorgung kann regulaer abgeschlossen werden.';
    }
    if (mode === 'passenger_dropoff') {
        return 'Bush-Zielstrip erreicht. Passagier wartet auf Farewell und Deboarding.';
    }
    if (mode === 'land_at_target') {
        return 'Bush-Zielstrip erreicht. Adventure-Leg ist sauber beendet.';
    }
    if (mode === 'return_home') {
        const p = _activeBushMissionProgress();
        if (p?.returnHomeQualified) return 'Bush-Recon abgeschlossen. Rueckkehr und Stillstand am Heimatplatz bestaetigt.';
        if (p?.areaQualified) return 'Recon im Zielgebiet abgeschlossen. Rueckflug zum Heimatplatz laeuft.';
        if (_missionBushUsesPoiTaskRecipe()) {
            const poiProgress = _missionPoiTaskProgressState();
            const dwellSec = Math.round(Number(poiProgress?.dwellSec || 0));
            const attempts = Math.max(0, Number(poiProgress?.attempts || 0));
            return `Recon noch offen. Im Zielgebiet in der Luft bleiben: bisher ${dwellSec}s${attempts > 0 ? ` · Hinweise ${attempts}` : ''}.`;
        }
        return `Recon noch offen. Fuer den Auftrag im Zielgebiet in der Luft bleiben: bisher ${Math.round(Number(p?.areaDwellSec || 0))}s · ${Number(p?.areaTrackNm || 0).toFixed(1)} NM im Arbeitsbereich.`;
    }
    return 'Bush-Zielstrip erreicht. Auftrag kann regulaer abgeschlossen werden.';
}

function _missionBushGroundEndReady(endReady = null) {
    if (!_missionSceneIsBushMission()) return false;
    const ready = endReady && typeof endReady === 'object' ? endReady : _missionEndReadiness();
    const progress = _activeBushMissionProgress();
    if (_missionBushIsPickupMission()) {
        const pos = window.lastLiveGpsPos || {};
        const curLat = Number(pos.lat);
        const curLon = Number(pos.lon);
        if (progress?.status === 'ready_to_close' && ready?.groundStill && Number.isFinite(curLat) && Number.isFinite(curLon) && _isAtMissionHome(curLat, curLon)) {
            return true;
        }
        return !!(
            ready?.groundStill
            && Number.isFinite(curLat)
            && Number.isFinite(curLon)
            && _isAtMissionHome(curLat, curLon)
            && progress?.pickupCompleted
            && progress?.pickupConfirmed
            && _missionHasReachedEndEligibleFlightPhase()
        );
    }
    const completionMode = _missionBushEffectiveCompletionMode();
    const isSupportedBushCompletion = completionMode === 'unload_at_target'
        || completionMode === 'passenger_dropoff'
        || completionMode === 'land_at_target'
        || completionMode === 'return_home';
    if (!isSupportedBushCompletion) return false;
    if (progress?.status === 'ready_to_close' && ready?.groundStill) {
        if (completionMode === 'return_home') {
            const pos = window.lastLiveGpsPos || {};
            const curLat = Number(pos.lat);
            const curLon = Number(pos.lon);
            return !!(
                Number.isFinite(curLat)
                && Number.isFinite(curLon)
                && _isAtMissionHome(curLat, curLon)
            );
        }
        return !!ready?.atTarget;
    }
    if (completionMode === 'return_home') {
        const pos = window.lastLiveGpsPos || {};
        const curLat = Number(pos.lat);
        const curLon = Number(pos.lon);
        return !!(
            ready?.groundStill
            && Number.isFinite(curLat)
            && Number.isFinite(curLon)
            && _isAtMissionHome(curLat, curLon)
            && progress?.areaQualified
            && _missionHasReachedEndEligibleFlightPhase()
        );
    }
    return !!(ready?.groundStill && ready?.atTarget && _missionHasReachedEndEligibleFlightPhase());
}

function _missionRuntimeGroundEndReady(endReady = null) {
    const ready = endReady && typeof endReady === 'object' ? endReady : _missionEndReadiness();
    if (typeof window.missionSceneIsSarHeliMission === 'function' && window.missionSceneIsSarHeliMission()) {
        return typeof window.missionSarHeliGroundEndReady === 'function'
            ? !!window.missionSarHeliGroundEndReady(ready)
            : false;
    }
    if (_missionSceneIsBushMission()) return _missionBushGroundEndReady(ready);
    if (_missionSceneIsPoiMission()) return !!(ready?.ready || _missionPoiGroundEndReady(ready));
    return !!ready?.ready;
}

function _missionPoiEndedAtHome(endReady = null) {
    if (!_missionSceneIsPoiMission()) return false;
    const pos = window.lastLiveGpsPos || {};
    const ready = endReady && typeof endReady === 'object' ? endReady : _missionEndReadiness();
    const curLat = Number(pos.lat);
    const curLon = Number(pos.lon);
    if (!ready?.groundStill || !Number.isFinite(curLat) || !Number.isFinite(curLon)) return false;
    return _isAtMissionHome(curLat, curLon);
}

function _aptArrivalPointForRuntime() {
    if (_missionSceneIsPoiMission()) return null;
    const md = (typeof currentMissionData !== 'undefined' && currentMissionData) ? currentMissionData : null;
    if (md?.poiName || (typeof currentDestICAO !== 'undefined' && currentDestICAO === 'POI')) return null;
    const contract = md?.missionContract || window.activeMissionContract || {};
    const truth = md?.missionTruth || contract?.missionTruth || null;
    const plan = md?.aptArrivalPlan || contract?.aptArrivalPlan || truth?.arrivalScene || null;
    const lat = Number(plan?.lat);
    const lon = Number(plan?.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return { lat, lon, plan };
}

function _distanceToAptArrivalNm(lat, lon) {
    const p = _aptArrivalPointForRuntime();
    if (!p) return null;
    return _haversineNmLocal(Number(lat), Number(lon), p.lat, p.lon);
}

function _hasAptArrivalRuntimePoint() {
    return !!_aptArrivalPointForRuntime();
}

function _isAtAptArrivalPoint(lat, lon, thresholdNm = 0.08) {
    const dNm = _distanceToAptArrivalNm(lat, lon);
    return Number.isFinite(dNm) ? dNm <= thresholdNm : false;
}

function _isAtMissionTarget(lat, lon, thresholdNm = 1.2) {
    const dNm = _distanceToMissionTargetNm(lat, lon);
    return Number.isFinite(dNm) ? dNm <= thresholdNm : false;
}

function _missionEndReadiness(lat = null, lon = null) {
    const fd = window.lastLiveFlightData || {};
    const pos = window.lastLiveGpsPos || {};
    const curLat = Number(lat ?? pos.lat);
    const curLon = Number(lon ?? pos.lon);
    if (!Number.isFinite(curLat) || !Number.isFinite(curLon)) {
        return { ready: false, reason: 'no_position', atTarget: false, groundStill: false, hasAptArrival: false };
    }
    const gs = Number.isFinite(Number(fd.gsKts)) ? Number(fd.gsKts)
        : (Number.isFinite(Number(fd.gs)) ? Number(fd.gs)
            : (Number.isFinite(Number(pos.gs)) ? Number(pos.gs) : null));
    const agl = Number.isFinite(Number(fd.aglFt)) ? Math.max(0, Number(fd.aglFt)) : null;
    const onGround = typeof fd.onGround === 'boolean' ? !!fd.onGround : (Number.isFinite(agl) ? agl <= 40 : false);
    const parkingBrakeSet = fd.parkingBrake === true || fd.parkingBrake === 1;
    const groundStill = onGround && ((Number.isFinite(gs) && gs <= 2.0) || parkingBrakeSet);
    let sharedDestination = null;
    if (typeof window.GAMissionLocationCore?.resolveAptDestination === 'function') {
        const arrivalPoint = _aptArrivalPointForRuntime();
        const missionTarget = _targetPointForMission();
        const missionData = (typeof currentMissionData !== 'undefined' && currentMissionData) ? currentMissionData : null;
        const missionContract = missionData?.missionContract || window.activeMissionContract || null;
        const policy = missionData?.executionLocationPolicy || missionContract?.executionLocationPolicy || null;
        sharedDestination = window.GAMissionLocationCore.resolveAptDestination(
            { arrivalPoint, missionTarget, policy },
            { lat: curLat, lon: curLon }
        );
    }
    const hasAptArrival = sharedDestination ? sharedDestination.hasAptArrival : _hasAptArrivalRuntimePoint();
    const dArrivalNm = sharedDestination
        ? sharedDestination.dArrivalNm
        : (hasAptArrival ? _distanceToAptArrivalNm(curLat, curLon) : null);
    const dMissionNm = sharedDestination ? sharedDestination.dMissionNm : _distanceToMissionTargetNm(curLat, curLon);
    const atArrivalPoint = sharedDestination
        ? sharedDestination.reason === 'apt_arrival_point'
        : (hasAptArrival && Number.isFinite(dArrivalNm) && dArrivalNm <= 0.16);
    const atAirportFallback = sharedDestination
        ? sharedDestination.reason === 'apt_airport_fallback'
        : (hasAptArrival && Number.isFinite(dMissionNm) && dMissionNm <= 0.35);
    const atMissionTarget = sharedDestination
        ? sharedDestination.reason === 'mission_target'
        : (!hasAptArrival && Number.isFinite(dMissionNm) && dMissionNm <= 1.2);
    const atTarget = sharedDestination
        ? sharedDestination.atDestination === true
        : (atArrivalPoint || atAirportFallback || atMissionTarget);
    const reason = !groundStill ? 'not_stopped'
        : (!atTarget ? 'not_at_target'
            : (atArrivalPoint ? 'apt_arrival_point'
                : (atAirportFallback ? 'apt_airport_fallback' : 'mission_target')));
    return {
        ready: groundStill && atTarget,
        reason,
        atTarget,
        groundStill,
        hasAptArrival,
        dArrivalNm,
        dMissionNm,
        gs,
        onGround,
        parkingBrakeSet
    };
}

function _missionRuntimeHasPassengerForDeboarding() {
    try {
        const manifest = typeof _missionCargoGetManifest === 'function' ? _missionCargoGetManifest() : null;
        if (Array.isArray(manifest?.items) && manifest.items.length > 0) {
            const passengerItems = manifest.items.filter(item => _missionCargoIsPassengerItem(item));
            if (!passengerItems.length) return false;
            return passengerItems.some(item => (
                item.status === 'loaded'
                && item.handoffComplete !== true
                && !(Number(item.handedOffAt || 0) > 0)
            ));
        }
    } catch (_) {}
    try {
        if (typeof _missionCargoLoadedPassengerItems === 'function' && _missionCargoLoadedPassengerItems().length > 0) return true;
    } catch (_) {}
    if (window.missionSceneStatus?.personBoarded) return true;
    try {
        return !!(window.activePassenger && typeof _missionScenePaxCount === 'function' && _missionScenePaxCount() > 0);
    } catch (_) {
        return false;
    }
}

function _missionRuntimePassengerHandoffComplete() {
    try {
        const manifest = typeof _missionCargoGetManifest === 'function' ? _missionCargoGetManifest() : null;
        const passengerItems = Array.isArray(manifest?.items)
            ? manifest.items.filter(item => _missionCargoIsPassengerItem(item))
            : [];
        return passengerItems.length > 0
            && passengerItems.some(item => item.handoffComplete === true || Number(item.handedOffAt || 0) > 0)
            && !passengerItems.some(item => item.status === 'loaded');
    } catch (_) {
        return false;
    }
}

function _missionSceneFinishRuntimeAfterDeboard(reason = 'mission-end-after-farewell', options = {}) {
    if (missionRuntime.closingPending) return true;
    _missionPhaseDebugPush('trigger', {
        name: '_missionSceneFinishRuntimeAfterDeboard',
        reason,
        skipEndScene: !!options?.skipEndScene,
        endSceneCompleted: !!options?.endSceneCompleted
    });
    const endSceneStarted = options?.skipEndScene
        ? !!options?.endSceneCompleted
        : _tryStartMissionEndScene(reason, { force: true });
    if (typeof window.missionCargoCompletePassengerHandoff === 'function') {
        window.missionCargoCompletePassengerHandoff({
            reason: `${reason}-passenger-handoff`,
            commandId: missionRuntime.endDeboardingCommandId || ''
        });
    } else {
        _missionCargoMarkPassengerUnloaded({
            reason: `${reason}-passenger-sync`,
            playAudioCue: false,
            spawnUnloadedObject: false
        });
    }
    if (_missionSceneIsBushMission() && typeof _missionBushUpdateProgress === 'function') {
        try { _missionBushUpdateProgress(window.lastLiveGpsPos?.lat, window.lastLiveGpsPos?.lon, Date.now()); } catch (_) {}
    }
    let cargoOutcome = typeof _missionCargoFinalizeMissionOutcome === 'function'
        ? _missionCargoFinalizeMissionOutcome({ source: reason })
        : null;
    cargoOutcome = _missionOutcomeApplyPoiProgress(cargoOutcome, {
        endedAtHome: _missionPoiEndedAtHome(),
        needsRideHome: _missionPoiGroundEndReady() && !_missionPoiEndedAtHome()
    });
    _missionPhaseDebugPush('trigger', {
        name: '_missionSceneFinishRuntimeAfterDeboard:outcome',
        reason,
        failed: !!cargoOutcome?.failed,
        missingRequired: (cargoOutcome?.missingRequired || []).join(','),
        notDeliveredRequired: (cargoOutcome?.notDeliveredRequired || []).join(','),
        droppedRequired: (cargoOutcome?.droppedRequired || []).join(','),
        damagedRequired: (cargoOutcome?.damagedRequired || []).join(',')
    });
    _setMissionClosePending({ reason, outcome: cargoOutcome });
    return endSceneStarted || cargoOutcome || true;
}

function _missionFarewellRecordWithCargoOutcome(record) {
    const baseRecord = (record && typeof record === 'object') ? { ...record } : {};
    if (typeof _missionCargoEvaluateFarewellOutcome === 'function') {
        try {
            const outcome = _missionCargoEvaluateFarewellOutcome();
            if (outcome && typeof outcome === 'object' && outcome.status !== 'none') {
                baseRecord.missionCargoOutcome = outcome;
                baseRecord.missionFailed = !!outcome.failed;
            }
        } catch (_) {}
    }
    if (typeof _missionPoiProgressState === 'function') {
        try {
            const poiProgress = _missionPoiProgressState();
            if (poiProgress && typeof poiProgress === 'object' && typeof poiProgress.aborted === 'boolean') {
                baseRecord.poiAborted = !!poiProgress.aborted;
            }
        } catch (_) {}
    }
    return Object.keys(baseRecord).length ? baseRecord : null;
}

function _missionRuntimeStartFarewellSpeech(reason = 'pax-farewell') {
    if (!missionRuntime.waitingFarewellDeboarding) return false;
    if (missionRuntime.farewellSpeechStarted) return true;
    missionRuntime.farewellSpeechStarted = true;
    try {
        const speech = window.triggerPaxFarewell(missionRuntime.pendingFarewellRecord || null);
        if (speech && typeof speech.catch === 'function') {
            speech.catch((err) => {
                if (!missionRuntime.waitingFarewellDeboarding || missionRuntime.farewellSpeechComplete) return;
                _missionPhaseDebugPush('trigger', {
                    name: '_missionRuntimeStartFarewellSpeech:async-error',
                    reason,
                    error: err?.message || String(err)
                });
                window.missionSceneStartDeboardingAfterFarewell?.(`${reason}-voice-error`);
            });
        }
        setTimeout(() => {
            if (!missionRuntime.waitingFarewellDeboarding || missionRuntime.farewellSpeechComplete) return;
            _missionPhaseDebugPush('trigger', {
                name: '_missionRuntimeStartFarewellSpeech:voice-timeout',
                reason
            });
            window.missionSceneStartDeboardingAfterFarewell?.(`${reason}-voice-timeout`);
        }, 75000);
        _missionPhaseDebugPush('trigger', { name: '_missionRuntimeStartFarewellSpeech', reason });
        return true;
    } catch (err) {
        missionRuntime.farewellSpeechComplete = true;
        missionRuntime.endDeboardingAnimationExpected = false;
        _missionPhaseDebugPush('trigger', {
            name: '_missionRuntimeStartFarewellSpeech:error',
            reason,
            error: err?.message || String(err)
        });
        console.warn('[MissionRuntime] Farewell trigger failed:', err);
        return _missionSceneFinishRuntimeAfterDeboard(`${reason}-fallback`, { skipEndScene: true });
    }
}

function _missionRuntimeCommitPassengerHandoff(ack = {}, reason = 'passenger-handoff') {
    if (window.missionSceneStatus && typeof window.missionSceneStatus === 'object') {
        window.missionSceneStatus.personBoarded = false;
    }
    const result = typeof window.missionCargoCompletePassengerHandoff === 'function'
        ? window.missionCargoCompletePassengerHandoff({
            reason,
            commandId: ack?.commandId || missionRuntime.endDeboardingCommandId || '',
            handedOffAt: Number(ack?.at || 0) || Date.now()
        })
        : false;
    _missionPhaseDebugPush('trigger', {
        name: '_missionRuntimeCommitPassengerHandoff',
        reason,
        commandId: ack?.commandId || missionRuntime.endDeboardingCommandId || null,
        stage: ack?.stage || null,
        cargoIds: Array.isArray(result?.cargoIds) ? result.cargoIds.join(',') : '',
        changed: result?.changed === true
    });
    if (typeof _persistMissionRuntimeSnapshot === 'function') {
        _persistMissionRuntimeSnapshot(`${reason}-snapshot`, { immediate: true });
    }
    return result || true;
}

function _missionRuntimeHandleDeboardingStage(ack = {}) {
    if (!missionRuntime.waitingFarewellDeboarding) return false;
    const pendingCommandId = String(missionRuntime.endDeboardingCommandId || '');
    if (pendingCommandId && String(ack?.commandId || '') !== pendingCommandId) return false;
    const stage = String(ack?.stage || '').toLowerCase();
    if (stage === 'door_open') {
        missionRuntime.farewellDoorReady = true;
        _missionRuntimeStartFarewellSpeech('deboarding-door-open');
    }
    if (stage === 'passenger_vehicle_boarded' || stage === 'passenger_handoff_complete') {
        _missionRuntimeCommitPassengerHandoff(ack, `deboarding-${stage}`);
    }
    return stage === 'cue'
        || stage === 'door_open'
        || stage === 'passenger_vehicle_boarded'
        || stage === 'passenger_handoff_complete';
}
window.missionRuntimeHandleDeboardingStage = _missionRuntimeHandleDeboardingStage;

function _missionRuntimeHandleDeboardingAck(ack = {}) {
    if (!missionRuntime.waitingFarewellDeboarding) return false;
    const pendingCommandId = String(missionRuntime.endDeboardingCommandId || '');
    if (pendingCommandId && String(ack?.commandId || '') !== pendingCommandId) return false;
    missionRuntime.endDeboardingAnimationExpected = false;
    missionRuntime.endDeboardingCompleted = ack?.status === 'ok';
    if (missionRuntime.endDeboardingCompleted) {
        _missionRuntimeCommitPassengerHandoff(ack, 'deboarding-ack-fallback');
    }
    if (!missionRuntime.farewellSpeechStarted) {
        _missionRuntimeStartFarewellSpeech('deboarding-ended-before-farewell');
    }
    if (missionRuntime.farewellSpeechComplete) {
        return _missionSceneFinishRuntimeAfterDeboard('mission-end-deboarding-ack', {
            skipEndScene: true,
            endSceneCompleted: missionRuntime.endDeboardingCompleted
        });
    }
    if (typeof _updateMissionRuntimeUi === 'function') {
        try { _updateMissionRuntimeUi(); } catch (_) {}
    }
    return true;
}
window.missionRuntimeHandleDeboardingAck = _missionRuntimeHandleDeboardingAck;

function _missionRuntimeHandleDeboardingTimeout(reason = 'deboarding-timeout') {
    if (!missionRuntime.waitingFarewellDeboarding) return false;
    missionRuntime.endDeboardingAnimationExpected = false;
    missionRuntime.endDeboardingCompleted = false;
    try { window.missionSceneCancelDeboarding?.(reason); } catch (_) {}
    if (!missionRuntime.farewellSpeechStarted) _missionRuntimeStartFarewellSpeech(reason);
    if (missionRuntime.farewellSpeechComplete) {
        return _missionSceneFinishRuntimeAfterDeboard(reason, { skipEndScene: true, endSceneCompleted: false });
    }
    return true;
}
window.missionRuntimeHandleDeboardingTimeout = _missionRuntimeHandleDeboardingTimeout;

function _triggerPaxFarewellAndWaitForDeboard(record, reason = 'pax-farewell') {
    _missionPhaseDebugPush('trigger', { name: '_triggerPaxFarewellAndWaitForDeboard', reason });
    if (typeof window.triggerPaxFarewell !== 'function') return false;
    if (typeof _missionCargoNeedsArrivalWorkflow === 'function'
        && _missionCargoNeedsArrivalWorkflow({ ignorePassenger: true })) {
        _missionPhaseDebugPush('trigger', { name: '_triggerPaxFarewellAndWaitForDeboard:blocked-unload', reason });
        return false;
    }
    if (_missionRuntimePassengerHandoffComplete()) {
        _missionPhaseDebugPush('trigger', {
            name: '_triggerPaxFarewellAndWaitForDeboard:handoff-already-complete',
            reason
        });
        return _missionSceneFinishRuntimeAfterDeboard(`${reason}-handoff-already-complete`, {
            skipEndScene: true,
            endSceneCompleted: true
        });
    }
    const farewellRecord = _missionFarewellRecordWithCargoOutcome(record);
    missionRuntime.waitingFarewellDeboarding = true;
    missionRuntime.deboardingAfterFarewellStarted = false;
    missionRuntime.farewellSpeechStarted = false;
    missionRuntime.farewellSpeechComplete = false;
    missionRuntime.farewellDoorReady = false;
    missionRuntime.pendingFarewellRecord = farewellRecord;
    missionRuntime.pendingFarewellReason = reason;
    missionRuntime.endDeboardingAnimationExpected = false;
    missionRuntime.endDeboardingCompleted = false;
    missionRuntime.endDeboardingCommandId = '';
    if (typeof _persistMissionRuntimeSnapshot === 'function') {
        _persistMissionRuntimeSnapshot(`${reason}-deboarding-start`, { immediate: true });
    }
    if (typeof _updateMissionRuntimeUi === 'function') {
        try { _updateMissionRuntimeUi(); } catch (_) {}
    }
    const endReady = _missionEndReadiness();
    const canAnimatePassenger = !!(
        _missionRuntimeHasPassengerForDeboarding()
        && !window.simModeActive
        && window.liveTrackerConnected
        && endReady?.groundStill
        && typeof window.missionSceneDeboarding === 'function'
    );
    if (canAnimatePassenger) {
        const commandId = window.missionSceneDeboarding(reason, { coordinateFarewell: true });
        if (commandId) {
            missionRuntime.endDeboardingAnimationExpected = true;
            missionRuntime.endDeboardingCommandId = String(commandId);
            if (typeof _persistMissionRuntimeSnapshot === 'function') {
                _persistMissionRuntimeSnapshot(`${reason}-deboarding-command`, { immediate: true });
            }
            _missionPhaseDebugPush('trigger', {
                name: '_triggerPaxFarewellAndWaitForDeboard:deboarding-prepared',
                reason,
                commandId: String(commandId)
            });
            return true;
        }
    }
    _missionRuntimeStartFarewellSpeech(`${reason}-no-scene`);
    setTimeout(() => {
        if (missionRuntime.waitingFarewellDeboarding && !missionRuntime.farewellSpeechStarted) {
            _missionRuntimeHandleDeboardingTimeout(`${reason}-door-timeout`);
        }
    }, 90000);
    return true;
}

window.missionSceneStartDeboardingAfterFarewell = function(reason = 'pax-farewell-complete') {
    _missionPhaseDebugPush('trigger', {
        name: 'missionSceneStartDeboardingAfterFarewell',
        reason,
        waitingFarewellDeboarding: !!missionRuntime.waitingFarewellDeboarding,
        deboardingAfterFarewellStarted: !!missionRuntime.deboardingAfterFarewellStarted
    });
    if (!missionRuntime.waitingFarewellDeboarding) return false;
    missionRuntime.farewellSpeechComplete = true;
    try {
        window.missionComplianceNotifyFarewellComplete?.({
            reason,
            record: missionRuntime.pendingFarewellRecord || missionRuntime.arrivalFlightRecord || null
        });
    } catch (_) {}
    if (missionRuntime.endDeboardingAnimationExpected) {
        if (missionRuntime.deboardingAfterFarewellStarted) return false;
        const continued = !!window.missionSceneContinueDeboarding?.(
            missionRuntime.endDeboardingCommandId,
            reason
        );
        if (!continued) {
            return _missionRuntimeHandleDeboardingTimeout(`${reason}-continue-failed`);
        }
        missionRuntime.deboardingAfterFarewellStarted = true;
        if (typeof _updateMissionRuntimeUi === 'function') {
            try { _updateMissionRuntimeUi(); } catch (_) {}
        }
        return true;
    }
    missionRuntime.deboardingAfterFarewellStarted = true;
    if (typeof _updateMissionRuntimeUi === 'function') {
        try { _updateMissionRuntimeUi(); } catch (_) {}
    }
    return _missionSceneFinishRuntimeAfterDeboard(reason, { skipEndScene: true, endSceneCompleted: false });
};
