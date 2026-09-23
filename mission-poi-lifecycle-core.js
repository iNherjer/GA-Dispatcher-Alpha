// Generated from the original App lifecycle functions. Do not edit by hand.
(function(root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./mission-location-core.js') : root.GAMissionLocationCore);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.GAMissionPoiLifecycleCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function(locationCore) {
'use strict';
const SCHEMA = 'ga.mission-poi-lifecycle.v1';
function evaluate(recipe, progress = {}, recorder = {}, sample = {}, outcome = null) {
  const currentMissionData = { missionContract: { taskDomain: recipe.taskDomain }, ...(recipe.poiChain ? { poiChain: recipe.poiChain, missionSubType: 'poi_chain' } : {}) };
  const flightRecorder = recorder;
  const window = { lastLiveFlightData: sample, lastLiveGpsPos: sample,
    missionTrainingProcedure: { getActiveRecipe: () => recipe.trainingRecipe || null },
    missionPoiChainRuntime: { getActiveSpec: () => recipe.poiChain || null },
    GAMissionLocationCore: locationCore, activePassenger: { ...recipe.passenger, taskDomain: recipe.taskDomain },
    missionPoiRecipeId: () => recipe.trainingRecipe ? 'poi_training' : recipe.taskDomain === 'fire_watch' ? 'poi_fire_watch' : recipe.passenger.targetDwellMin === 0 ? 'poi_flyover' : 'poi_on_task' };
  const _missionSceneIsPoiMission = () => true;
  const _missionSceneIsBushMission = () => false;
  const _missionSceneIsSarHeliMission = () => false;
  const _missionPoiProgressState = () => ({ hasSignal: true, trackingActive: recipe.trackingActive, ...progress });
  const _aptArrivalPointForRuntime = () => null;
  const _missionBushReturnHomeRuntimePoint = () => null;
  const _targetPointForMission = () => recipe.target;
  const _distanceToMissionHomeNm = (lat, lon) => locationCore.haversineNm(lat, lon, recipe.home.lat, recipe.home.lon);
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
        const missionTarget = _missionBushReturnHomeRuntimePoint() || _targetPointForMission();
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
        agl,
        onGround,
        parkingBrakeSet
    };
}

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

function _missionPoiEndedAtHome(endReady = null) {
    if (!_missionSceneIsPoiMission()) return false;
    const pos = window.lastLiveGpsPos || {};
    const ready = endReady && typeof endReady === 'object' ? endReady : _missionEndReadiness();
    const curLat = Number(pos.lat);
    const curLon = Number(pos.lon);
    if (!ready?.groundStill || !Number.isFinite(curLat) || !Number.isFinite(curLon)) return false;
    return _isAtMissionHome(curLat, curLon);
}

function _missionHasReachedEndEligibleFlightPhase() {
    if (window.simModeActive && window.simHadMeaningfulAirbornePhase === true) return true;
    const poiProgress = _missionPoiProgressState();
    const poiProgressEvidence = !!(
        _missionSceneIsPoiMission()
        && poiProgress?.trackingActive
        && poiProgress?.hasSignal
        && (poiProgress.satisfied || poiProgress.aborted || poiProgress.atTargetDone)
    );
    return !!(
        flightRecorder?.hadAirbornePhase
        || Number(flightRecorder?.airborneEvidenceSec || 0) >= 10
        || Number(flightRecorder?.maxAglFt || 0) >= 200
        || poiProgressEvidence
    );
}

function _isAtMissionHome(lat, lon, thresholdNm = 0.35) {
    const dNm = _distanceToMissionHomeNm(lat, lon);
    return Number.isFinite(dNm) ? dNm <= thresholdNm : false;
}

function _missionOutcomeApplyPoiProgress(outcome = null, options = {}) {
    const usePoiStyleTask = _missionSceneIsPoiMission()
        || (typeof window.missionBushUsesPoiTaskRecipe === 'function' && window.missionBushUsesPoiTaskRecipe());
    if (!usePoiStyleTask) return outcome;
    const progress = options?.progress && typeof options.progress === 'object'
        ? options.progress
        : _missionPoiProgressState();
    if (!progress?.hasSignal || !progress?.trackingActive) return outcome;
    const base = (outcome && typeof outcome === 'object')
        ? { ...outcome }
        : {
            status: 'completed',
            failed: false,
            requiredTotal: 0,
            requiredLoaded: 0,
            missingRequired: [],
            droppedRequired: [],
            notDeliveredRequired: [],
            damagedRequired: [],
            loadedWeightLbs: 0,
            totalWeightLbs: 0
        };
    const notDelivered = Array.isArray(base.notDeliveredRequired) ? base.notDeliveredRequired.slice() : [];
    const taskLabel = (typeof window.missionBushUsesPoiTaskRecipe === 'function' && window.missionBushUsesPoiTaskRecipe())
        ? 'Auftrag im Zielgebiet'
        : 'POI-Auftrag';
    const poiFailureMessages = new Set([
        `${taskLabel} wurde nicht abgeschlossen.`,
        `${taskLabel} wurde im Zielgebiet abgebrochen.`
    ]);
    const poiResolved = !!(progress.satisfied || progress.manualConfirmed);
    if (poiResolved) {
        base.notDeliveredRequired = notDelivered.filter(entry => !poiFailureMessages.has(String(entry || '').trim()));
        if (!base.missingRequired?.length && !base.droppedRequired?.length && !base.damagedRequired?.length && !(base.notDeliveredRequired || []).length) {
            base.failed = false;
            base.status = 'completed';
        }
    } else
    if (progress.aborted) {
        const abortMsg = `${taskLabel} wurde im Zielgebiet abgebrochen.`;
        if (!notDelivered.includes(abortMsg)) {
            notDelivered.push(abortMsg);
        }
    } else if (!progress.satisfied) {
        const incompleteMsg = `${taskLabel} wurde nicht abgeschlossen.`;
        if (!notDelivered.includes(incompleteMsg)) {
            notDelivered.push(incompleteMsg);
        }
    }
    if (!poiResolved) base.notDeliveredRequired = notDelivered;
    if ((base.notDeliveredRequired || []).length > 0) {
        base.failed = true;
        base.status = 'failed';
    }
    try {
        if (typeof currentMissionData !== 'undefined' && currentMissionData) {
            currentMissionData.poiEndedAtHome = options?.endedAtHome === true;
            currentMissionData.poiNeedsRideHome = options?.needsRideHome === true;
            currentMissionData.missionResult = base.failed ? 'failed' : 'completed';
            currentMissionData.missionFailed = !!base.failed;
            currentMissionData.missionOutcome = base;
        }
        if (typeof saveMissionState === 'function') saveMissionState();
    } catch (_) {}
    return base;
}

function _missionPoiRuntimeStatus(endReady = null) {
    if (!_missionSceneIsPoiMission()) return null;
    const ready = endReady && typeof endReady === 'object' ? endReady : _missionEndReadiness();
    const progress = _missionPoiProgressState();
    const endedAtHome = _missionPoiEndedAtHome(ready);
    const canEndHere = _missionPoiGroundEndReady(ready);
    const poiRecipeId = (typeof window.missionPoiRecipeId === 'function')
        ? String(window.missionPoiRecipeId((typeof currentMissionData !== 'undefined' && currentMissionData) ? currentMissionData : null) || '').trim().toLowerCase()
        : '';
    if (poiRecipeId === 'poi_sar_heli' || _missionSceneIsSarHeliMission()) {
        const sar = _activeSarHeliProgress();
        const spec = _activeSarHeliSpec();
        const hospitalName = String(spec?.hospitalRef?.name || 'Krankenhaus-Helipad').trim();
        if (!sar?.targetConfirmed) {
            return {
                stage: 'sar_heli_search',
                detail: 'SAR-Heli: Fundstelle noch nicht bestaetigt.',
                nextStep: 'Nächster Schritt: Zielgebiet anfliegen, Fund melden oder nach 60s automatisch markieren lassen'
            };
        }
        if (!sar?.patientLoaded) {
            return {
                stage: 'sar_heli_recovery',
                detail: `SAR-Heli: Bergung offen. Aufnahmephase läuft.`,
                nextStep: 'Nächster Schritt: landen oder langsam und stabil über der Fundstelle halten'
            };
        }
        if (canEndHere || sar?.readyToClose) {
            return {
                stage: 'sar_heli_ready',
                detail: `SAR-Heli: Patient am medizinischen Ziel ${hospitalName} uebergeben.`,
                nextStep: 'Nächster Schritt: Mission beenden'
            };
        }
        return {
            stage: 'sar_heli_hospital_leg',
            detail: `SAR-Heli: Patient aufgenommen. Medizinisches Ziel: ${hospitalName}.`,
            nextStep: 'Nächster Schritt: Krankenhaus-Helipad/Fallback-Ziel anfliegen, landen und stoppen'
        };
    }
    const taskDomain = String(window.activePassenger?.taskDomain || currentMissionData?.missionContract?.taskDomain || '').toLowerCase();
    if (/^(training|club_training_basic|club_training_advanced)$/.test(taskDomain) || progress?.trainingProcedure) {
        const training = progress?.trainingProcedure || null;
        let recipe = null;
        try {
            recipe = typeof window.missionTrainingProcedure?.getActiveRecipe === 'function'
                ? window.missionTrainingProcedure.getActiveRecipe(currentMissionData, window.activePassenger || null)
                : null;
        } catch (_) {
            recipe = null;
        }
        const total = Math.max(1, Number(training?.totalExercises || recipe?.exercises?.length || 0) || 1);
        const required = Math.max(1, Math.min(total, Number(training?.requiredCount || recipe?.requiredCount || 2) || 2));
        const done = Math.max(0, Number(training?.completedCount || 0));
        const ready = !!training?.ready;
        const readyPrompted = !!training?.readyPrompted;
        const activeLabel = String(training?.activeExercise?.label || recipe?.exercises?.[Math.max(0, Number(training?.activeIndex || 0) || 0)]?.label || '').trim();
        const optionalLeft = Math.max(0, total - Math.max(required, done));
        let detail = '';
        let nextStep = '';
        if (training?.requiredComplete) {
            detail = `Training Pflichtteil abgeschlossen. Pflichtuebungen: ${Math.min(done, required)}/${required}${optionalLeft ? `, optionale Uebungen offen: ${optionalLeft}` : ''}.`;
            nextStep = optionalLeft
                ? 'Nächster Schritt: Rückkehr fortsetzen oder per Pax-Fenster eine Zusatzuebung anfragen'
                : 'Nächster Schritt: Landung/Heimflug fortsetzen und Debriefing nach der Landung abholen';
        } else if (!ready) {
            detail = readyPrompted
                ? `Trainingshoehe erreicht. Pflichtuebungen offen: ${Math.min(done, required)}/${required}.`
                : `Training wartet auf passende Trainingshoehe. Pflichtuebungen offen: ${Math.min(done, required)}/${required}.`;
            nextStep = readyPrompted
                ? 'Nächster Schritt: im Pax-Fenster "Bereit für Übung" drücken, wenn die Maschine stabil ist'
                : 'Nächster Schritt: zur Trainingshoehe steigen und Instruktor-Freigabe abwarten';
        } else {
            detail = `Training offen. Pflichtuebungen abgeschlossen: ${Math.min(done, required)}/${required}${activeLabel ? `, aktuell: ${activeLabel}` : ''}.`;
            nextStep = activeLabel
                ? `Nächster Schritt: Trainingsuebung fliegen: ${activeLabel}`
                : 'Nächster Schritt: auf die Instruktor-Ansage warten und Uebung stabil beginnen';
        }
        return {
            stage: training?.requiredComplete ? 'training_complete' : (ready ? 'training_working' : 'training_ready_waiting'),
            detail,
            nextStep
        };
    }
    if (progress?.poiChain || currentMissionData?.missionSubType === 'poi_chain' || currentMissionData?.poiChain) {
        const chain = progress?.poiChain || null;
        let spec = null;
        try {
            spec = typeof window.missionPoiChainRuntime?.getActiveSpec === 'function'
                ? window.missionPoiChainRuntime.getActiveSpec(currentMissionData, window.activePassenger || null)
                : null;
        } catch (_) {
            spec = null;
        }
        const total = Array.isArray(spec?.points) ? spec.points.filter(point => point?.required !== false).length : Math.max(1, Number(currentMissionData?.poiChain?.points?.length || 0) || 1);
        const done = Array.isArray(chain?.completedPointIds) ? chain.completedPointIds.length : 0;
        const nextPoint = Array.isArray(spec?.points) ? spec.points[Math.max(0, Number(chain?.currentIndex || 0) || 0)] : null;
        const detail = chain?.satisfied
            ? `Infrastruktur-Kette erfüllt. Alle ${total} Punkte sind abgeschlossen.`
            : `Infrastruktur-Kette offen. Punkte abgeschlossen: ${done}/${total}.`;
        return {
            stage: chain?.satisfied ? 'poi_chain_complete' : 'poi_chain_working',
            detail,
            nextStep: chain?.satisfied
                ? 'Nächster Schritt: Rueckflug zum Heimatplatz, landen und Mission beenden'
                : (nextPoint?.name
                    ? `Nächster Schritt: nächsten markierten Punkt anfliegen: ${nextPoint.name}`
                    : 'Nächster Schritt: nächsten markierten Kettenpunkt anfliegen')
        };
    }
    if (taskDomain === 'mapping_survey') {
        const survey = progress?.surveyPattern || null;
        let spec = null;
        try {
            spec = typeof window.missionSurveyPattern?.getActiveSpec === 'function'
                ? window.missionSurveyPattern.getActiveSpec(currentMissionData, window.activePassenger || null)
                : null;
        } catch (_) {
            spec = null;
        }
        const scanTotal = Array.isArray(spec?.scan?.lines) ? spec.scan.lines.length : Math.max(1, Number(spec?.scan?.lineCount || 0) || 1);
        const scanDone = Array.isArray(survey?.scan?.completedLineIds) ? survey.scan.completedLineIds.length : 0;
        const orbitTotal = Math.max(1, Number(spec?.orbit?.requiredTurns || 3));
        const orbitDone = Math.max(0, Number(survey?.orbit?.completedTurns || 0));
        const isOrbit = String(spec?.type || '').toLowerCase() === 'orbit';
        const detail = survey?.satisfied
            ? 'Mapping/Survey erfüllt. Alle geforderten Pattern-Segmente sind abgeschlossen.'
            : (isOrbit
                ? `Mapping/Survey offen. Kreise abgeschlossen: ${orbitDone}/${orbitTotal}.`
                : `Mapping/Survey offen. Linien abgeschlossen: ${scanDone}/${scanTotal}.`);
        return {
            stage: survey?.satisfied ? 'survey_complete' : 'survey_working',
            detail,
            nextStep: survey?.satisfied
                ? 'Nächster Schritt: Rueckflug zum Heimatplatz, landen und Mission beenden'
                : (survey?.startedAt
                    ? 'Nächster Schritt: offene rote Linie sauber abfliegen, grüne Linien gelten als erledigt'
                    : 'Nächster Schritt: markiertes Survey-Pattern anfliegen und an einem Linienende beginnen')
        };
    }
    const taskLabel = poiRecipeId === 'poi_on_task_return'
        ? 'Recon-/Arbeitsauftrag im Zielgebiet'
        : (poiRecipeId === 'poi_fire_watch'
            ? 'Feuerbeobachtung'
            : (poiRecipeId === 'poi_search_and_rescue'
                ? 'Suchauftrag'
                : (poiRecipeId === 'poi_training'
                    ? 'Trainingsaufgabe'
                    : (poiRecipeId === 'poi_flyover'
                        ? 'Flyover-Auftrag'
                        : 'POI-Auftrag'))));
    if (!progress?.hasSignal || !progress?.trackingActive) {
        return {
            stage: 'unknown',
            detail: `${taskLabel}-Status noch nicht sicher verfügbar.`,
            nextStep: canEndHere
                ? (endedAtHome ? 'Nächster Schritt: Mission beenden' : 'Nächster Schritt: Mission hier beenden oder Heimflug fortsetzen')
                : `Nächster Schritt: Zielgebiet anfliegen und ${taskLabel.toLowerCase()} erfuellen`
        };
    }
    if (progress.aborted) {
        return {
            stage: 'failed',
            detail: `${taskLabel} fehlgeschlagen.`,
            nextStep: canEndHere
                ? 'Nächster Schritt: Mission beenden'
                : 'Nächster Schritt: Landen und Mission abschliessen'
        };
    }
    if (progress.satisfied) {
        if (canEndHere) {
            return {
                stage: endedAtHome ? 'home_ready' : 'away_ready',
                detail: endedAtHome
                    ? `${taskLabel} erfüllt. Du bist zurück am Startplatz.`
                    : `${taskLabel} erfüllt. Ausweichlandung erkannt.`,
                nextStep: endedAtHome
                    ? 'Nächster Schritt: Mission regulär beenden'
                    : 'Nächster Schritt: Mission hier beenden oder Pax später heimfliegen'
            };
        }
        return {
            stage: 'return_leg',
            detail: endedAtHome
                ? `${taskLabel} erfüllt. Startplatz erreicht, aber noch nicht im End-Gate.`
                : `${taskLabel} erfüllt. Rueckflugphase oder freie Landung zum Missionsende.`,
            nextStep: 'Nächster Schritt: Landen, stoppen und Mission beenden'
        };
    }
    const dwellSec = Number.isFinite(Number(progress.dwellSec)) ? Number(progress.dwellSec) : 0;
    const attempts = Number.isFinite(Number(progress.attempts)) ? Number(progress.attempts) : 0;
    const workingDetail = poiRecipeId === 'poi_flyover'
        ? 'Flyover noch offen. Zielgebiet sauber anfliegen und den Ueberflug bestaetigen.'
        : `${taskLabel} noch offen. Arbeitszeit im Zielgebiet: ${Math.round(dwellSec)}s${attempts > 0 ? ` · Hinweise: ${attempts}` : ''}.`;
    return {
        stage: 'working',
        detail: workingDetail,
        nextStep: canEndHere
            ? 'Nächster Schritt: Mission beenden'
            : `Nächster Schritt: ${taskLabel} sauber erfuellen und danach landen`
    };
}
  const readiness = _missionEndReadiness();
  const canEndHere = _missionPoiGroundEndReady(readiness);
  const endedAtHome = _missionPoiEndedAtHome(readiness);
  const needsRideHome = canEndHere && !endedAtHome;
  return { readiness, flightEligible: _missionHasReachedEndEligibleFlightPhase(), canEndHere: readiness.ready || canEndHere, endedAtHome, needsRideHome,
    status: _missionPoiRuntimeStatus(readiness),
    outcome: _missionOutcomeApplyPoiProgress(outcome, { endedAtHome, needsRideHome }) };
}
function applyStress(manifest, recorder = {}, sample = {}, record = null, motionProtectionEnabled = false) {
  const copy = JSON.parse(JSON.stringify(manifest));
  const flightRecorder = recorder;
  const window = { lastLiveFlightData: sample };
  const _missionDebugMotionProtectionEnabled = () => motionProtectionEnabled;
  const _missionCargoEnsureManifest = () => copy;
  const _missionCargoPersistManifest = () => {};
function _missionCargoStressDamage(record = null) {
    if (_missionDebugMotionProtectionEnabled()) return 0;
    const fd = window.lastLiveFlightData || {};
    const maxG = Math.max(Number(record?.maxGForce || 1), Number(flightRecorder?.maxGForce || 1), Number(fd.gForce || 1));
    const maxBank = Math.max(Math.abs(Number(record?.maxBankDeg || 0)), Math.abs(Number(flightRecorder?.maxBankDeg || 0)), Math.abs(Number(fd.bankDeg || 0)));
    const maxDescent = Math.max(Math.abs(Math.min(0, Number(record?.maxDescentFpm || 0))), Math.abs(Math.min(0, Number(flightRecorder?.maxDescentFpm || 0))), Math.abs(Math.min(0, Number(fd.vsFpm ?? fd.vs ?? 0))));
    const touchdown = Math.abs(Number(record?.touchdownVsFpm || flightRecorder?.touchdownVsFpm || fd.touchdownFpm || 0));
    let damage = 0;
    if (Number.isFinite(maxG) && maxG > 1.45) damage += (maxG - 1.45) * 22;
    if (Number.isFinite(maxBank) && maxBank > 45) damage += (maxBank - 45) * 0.45;
    if (Number.isFinite(maxDescent) && maxDescent > 1300) damage += (maxDescent - 1300) * 0.008;
    if (Number.isFinite(touchdown) && touchdown > 450) damage += (touchdown - 450) * 0.045;
    return Math.max(0, Math.min(85, Math.round(damage)));
}

function _missionCargoApplyStressSnapshot(record = null) {
    const manifest = _missionCargoEnsureManifest();
    const damage = _missionCargoStressDamage(record);
    const prev = Number(manifest.maxStressDamagePct || 0);
    if (!Number.isFinite(damage) || damage <= prev) return manifest;
    manifest.maxStressDamagePct = damage;
    (manifest.items || []).forEach(item => {
        if (item.status === 'loaded') {
            item.healthPct = Math.max(0, Math.min(Number(item.healthPct ?? 100), 100 - damage));
        }
    });
    _missionCargoPersistManifest(manifest);
    return manifest;
}
  return _missionCargoApplyStressSnapshot(record);
}
return Object.freeze({ SCHEMA, evaluate, applyStress });
});
