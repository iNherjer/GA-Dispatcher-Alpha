// Frozen App source before full Tracker POI integration; test oracle, do not regenerate.
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

function _farewellPrompt(record) {
    const ctx = _baseContext();
    const pax = window.activePassenger;
    if (!ctx || !pax) return null;

    const rec = (record && typeof record === 'object') ? record : {};
    const motionProtectionEnabled = _paxDebugMotionProtectionEnabled();
    const durationSec = Number.isFinite(Number(rec.durationSec)) ? Number(rec.durationSec) : null;
    const min = durationSec != null ? Math.max(1, Math.round(durationSec / 60)) : null;
    const distanceNm = Number.isFinite(Number(rec.distanceNm)) ? Number(rec.distanceNm) : null;
    const maxAltFt = Number.isFinite(Number(rec.maxAltFt)) ? Math.round(Number(rec.maxAltFt)) : null;
    const isSimRecord = !!rec.simulated || durationSec == null;
    const td = (!motionProtectionEnabled && !isSimRecord && rec.touchdownVsFpm != null) ? `${Math.abs(rec.touchdownVsFpm)} ft/min` : null;
    const bank = (Number(rec.maxBankDeg) || 0).toFixed(1);
    const maxG = (Number(rec.maxGForce) || 1.0).toFixed(2);
    const wx   = _weatherContext(window.lastLiveFlightData);

    let highlights = '';
    if (!motionProtectionEnabled && pax.gTolerance === 'niedrig' && (Number(rec.maxGForce) || 1) > 1.6) highlights += ' Etwas viel G für mich, aber okay.';
    if (!motionProtectionEnabled && pax.bankTolerance === 'niedrig' && (Number(rec.maxBankDeg) || 0) > 34) highlights += ' Die Kurven waren schon sportlich.';
    if (!motionProtectionEnabled && !isSimRecord && Number.isFinite(Number(rec.maxDescentFpm)) && Number(rec.maxDescentFpm) <= -1500) {
        highlights += ` Der Sinkflug mit ${Math.abs(Math.round(Number(rec.maxDescentFpm)))} ft/min ging etwas auf Ohren und Magen.`;
    }
    if (td && Math.abs(Number(rec.touchdownVsFpm)) < 200) highlights += ' Die Landung war richtig sanft — Kompliment!';
    if (td && Math.abs(Number(rec.touchdownVsFpm)) > 500) highlights += ` Die Landung mit ${Math.abs(Number(rec.touchdownVsFpm))} ft/min war etwas holprig.`;
    const cargoOutcome = rec?.missionCargoOutcome
        || ((typeof currentMissionData !== 'undefined' && currentMissionData) ? currentMissionData.cargoOutcome : null)
        || window.activeMissionContract?.cargoOutcome
        || (typeof window.missionCargoEvaluateOutcome === 'function' ? window.missionCargoEvaluateOutcome() : null);
    const poiProgress = (typeof window.paxVoiceGetPoiMissionProgress === 'function')
        ? window.paxVoiceGetPoiMissionProgress()
        : null;
    const missingRequired = Array.isArray(cargoOutcome?.missingRequired) ? cargoOutcome.missingRequired : [];
    const droppedRequired = Array.isArray(cargoOutcome?.droppedRequired) ? cargoOutcome.droppedRequired : [];
    const notDeliveredRequired = Array.isArray(cargoOutcome?.notDeliveredRequired) ? cargoOutcome.notDeliveredRequired : [];
    const damagedRequired = Array.isArray(cargoOutcome?.damagedRequired) ? cargoOutcome.damagedRequired : [];
    const failureReasons = [
        ...missingRequired,
        ...droppedRequired,
        ...notDeliveredRequired,
        ...damagedRequired
    ].filter(Boolean);
    const hasResolvedOutcome = !!(cargoOutcome && typeof cargoOutcome === 'object' && String(cargoOutcome.status || '').toLowerCase() !== 'none');
    const currentMissionFailed = ((typeof currentMissionData !== 'undefined' && currentMissionData)
        ? (currentMissionData.missionFailed || String(currentMissionData.missionResult || '').toLowerCase() === 'failed')
        : false);
    const poiSuccessOverride = !!(poiProgress?.satisfied || poiProgress?.manualConfirmed);
    const isMissionFailed = poiSuccessOverride
        ? false
        : hasResolvedOutcome
        ? !!(cargoOutcome?.failed || rec?.missionFailed || rec?.poiAborted)
        : !!(_poiAborted || rec?.missionFailed || currentMissionFailed);
    if (cargoOutcome?.failed) {
        const missing = failureReasons.slice(0, 3).join(', ');
        if (damagedRequired.length) {
            highlights += ` Wichtige Ausruestung wurde beschaedigt${missing ? `: ${missing}` : ''}.`;
        } else {
            highlights += ` Die Ladung ist nicht vollstaendig erledigt${missing ? `: ${missing}` : ''}.`;
        }
    }
    if (isSimRecord) highlights += ' Hinweis: Sim-Modus aktiv, Landebewertung nur eingeschränkt belastbar.';
    if (wx) highlights += ` ${wx}`;
    highlights += _consumeWeatherMismatchEasteregg(window.lastLiveFlightData || null);
    const profLandingHint = _professionalLandingToneHint();
    const trainingPlan = _activeAptTrainingPlan();
    const trn = trainingPlan ? _trainingEvalSummary() : null;
    const trnProcedureFacts = trainingPlan ? _trainingProcedureDebriefLine() : '';
    const trnFacts = trn
        ? `\nTrainingsdaten (Übungsabschnitt): Höhenvariation ${trn.altVar ?? 'n/a'} ft, max Bank ${trn.bank}°, max G ${trn.maxG}g, max Steigen ${trn.climb} ft/min, max Sinken ${Math.abs(trn.descent)} ft/min${trn.aoaMax != null ? `, max AOA ${trn.aoaMax}°` : ''}, Stall-Events ${trn.stallEvents}.${trnProcedureFacts}`
        : trnProcedureFacts;
    const trnTask = trn
        ? '\nDa du hier als Instruktor unterwegs bist: Gib ein kurzes, konkretes Trainingsfazit (was war gut, was sollte beim nächsten Flug sauberer werden).'
        : '';
    const isPOI = _isPOIMission();
    const poiNeedsRideHome = !!rec?.poiNeedsRideHome;
    const primaryFailureReason = damagedRequired.length
        ? `beschaedigte Ausruestung (${damagedRequired.slice(0, 2).join(', ')})`
        : missingRequired.length
            ? `fehlende Ausruestung (${missingRequired.slice(0, 2).join(', ')})`
            : droppedRequired.length
                ? `verlorene Ausruestung (${droppedRequired.slice(0, 2).join(', ')})`
                : notDeliveredRequired.length
                    ? notDeliveredRequired[0]
                    : 'der Auftrag konnte nicht sauber abgeschlossen werden';
    const missionFailureTask = isMissionFailed
        ? `\nDer Auftrag ist heute nicht abgeschlossen. Sag klar, dass die Aufgabe am Ziel nicht erledigt werden konnte. Hauptgrund: ${primaryFailureReason}. Formuliere am Ende eine kurze Retry-Frage (z.B. ob wir es mit kompletter Ausruestung nochmal versuchen sollen). HARTE VERBOTE: Sage NICHT "voller Erfolg", "erfolgreich", "abgeschlossen", "erledigt", "alles im Kasten", "sauber erledigt" oder aehnliche Erfolgsformeln.`
        : '';
    const poiRideHomeTask = (isPOI && poiNeedsRideHome)
        ? '\nWir sind nicht am Startflugplatz gelandet. Frag am Ende locker, ob wir dich von hier noch nach Hause fliegen.'
        : '';
    const aptFarewellHint = (!isPOI && !trainingPlan) ? _aptArrivalFarewellHint() : '';
    const bushContinuityHint = _bushPickupNarrativeHint('farewell');
    const bushReconOutcomeHint = isMissionFailed ? '' : _bushReconOutcomeHintLine('farewell');
    const followUpDeboardingHint = isMissionFailed ? '' : _followUpDeboardingHintLine();
    const taskDomain = _activeTaskDomain();
    const farewellDriftGuard = _domainDriftGuard('result');
    const sarHeliFarewellTask = (typeof window.missionIsSarHeliMission === 'function' && window.missionIsSarHeliMission((typeof currentMissionData !== 'undefined' ? currentMissionData : null)))
        ? `Verabschiede dich als ${pax.role} nach einer SAR-Heli-Bergung. Sage klar, dass der Patient am medizinischen Ziel ${_sarHeliHospitalName()} uebergeben ist, danke fuer die ruhige Bergung und den Weiterflug, und schliesse professionell ab.`
        : '';
    const scienceFarewellTask = taskDomain === 'science_bio'
        ? `Verabschiede dich kurz beim Piloten und gib ein biologisches Abschlussfazit: welcher Habitat-, Arten-, Vegetations-, Ufer- oder Stoerfaktor fuer die Auswertung haengen bleibt und was mit Fotos/Notizen als naechstes passiert. Danke fuer den Flug ist okay, aber kein Sightseeing-Fazit und keine Formulierung wie "schoener Blick", "Blickmoment" oder "den Ort mitnehmen".`
        : (taskDomain === 'science_geo'
            ? `Verabschiede dich kurz beim Piloten und gib ein geologisches Abschlussfazit: welche Relief-, Erosions-, Sediment-, Ufer- oder Hangbeobachtung fuer die Auswertung haengen bleibt und was mit Fotos/Notizen als naechstes passiert. Danke fuer den Flug ist okay, aber kein Sightseeing-Fazit und keine Formulierung wie "schoener Blick", "Blickmoment" oder "den Ort mitnehmen".`
            : '');
    const farewellTask = isMissionFailed
        ? `Verabschiede dich persönlich beim Piloten aus deiner Sicht als ${pax.role}. Danke dem Piloten explizit für den Flug (bevorzuge alltagsnah: "danke fürs Mitnehmen" statt "danke für das Mitnehmen"). Bleib freundlich, aber nenne den Fehlschlag klar und ohne ihn schönzureden.${missionFailureTask}`
        : (sarHeliFarewellTask || scienceFarewellTask || `Verabschiede dich persönlich beim Piloten und gib dein Fazit zum Flug — aus deiner Sicht als ${pax.role}. Danke dem Piloten explizit für den Flug (bevorzuge alltagsnah: "danke fürs Mitnehmen" statt "danke für das Mitnehmen"). Auch wenn etwas nicht perfekt war, schließ positiv ab.${trnTask}`);
    const facts = motionProtectionEnabled
        ? 'Bewegungs-, Komfort- und Landebewertung deaktiviert (Debug-Slew-Schutz).'
        : (min != null && distanceNm != null && maxAltFt != null)
            ? `${min} min, ${distanceNm.toFixed(1)} NM, max ${maxAltFt} ft, max Bank ${bank}°, max G ${maxG}g.`
            : `Flugdaten teilweise unvollständig (z. B. Slew/Teleport). Max Bank ${bank}°, max G ${maxG}g.`;

    return `${ctx}

Moment: ${aptFarewellHint || 'Wir sind gelandet, Flug beendet.'}
ABLAUF: Die Flugzeugtür ist geöffnet; du sitzt noch an Bord und verabschiedest dich unmittelbar vor dem Aussteigen. Behaupte nicht, bereits ausgestiegen, am Fahrzeug oder abgeholt zu sein.
Fakten: ${facts}${highlights ? '\n' + highlights : ''}${trnFacts}
${farewellTask}${poiRideHomeTask}${bushContinuityHint}${bushReconOutcomeHint}${followUpDeboardingHint}${profLandingHint}${farewellDriftGuard} Max 3 Sätze.${_toneHint()}`;
}

function _failedMissionFarewellFallback(record = null) {
    const pax = window.activePassenger || {};
    const rec = (record && typeof record === 'object') ? record : {};
    const poiProgress = (typeof window.paxVoiceGetPoiMissionProgress === 'function')
        ? window.paxVoiceGetPoiMissionProgress()
        : null;
    if (poiProgress?.satisfied || poiProgress?.manualConfirmed) {
        const role = String(pax.role || 'Passagier').trim();
        const frame = _activeMissionStoryFrame();
        const subject = String(frame?.focusSubject || 'den Auftrag').trim();
        return `Danke fuers Mitnehmen. Aus Sicht als ${role} haben wir ${subject} heute sauber bestaetigt und ich gebe den Fund so an die Einsatzleitung weiter. Der Rueckflug passt, damit koennen die Bodenkraefte ihren naechsten Schritt gezielt ansetzen.`;
    }
    const cargoOutcome = rec?.missionCargoOutcome || null;
    const damagedRequired = Array.isArray(cargoOutcome?.damagedRequired) ? cargoOutcome.damagedRequired : [];
    const missingRequired = Array.isArray(cargoOutcome?.missingRequired) ? cargoOutcome.missingRequired : [];
    const droppedRequired = Array.isArray(cargoOutcome?.droppedRequired) ? cargoOutcome.droppedRequired : [];
    const notDeliveredRequired = Array.isArray(cargoOutcome?.notDeliveredRequired) ? cargoOutcome.notDeliveredRequired : [];
    const primaryFailureReason = damagedRequired.length
        ? `Leider ist ein Teil der Ladung beschaedigt: ${damagedRequired.slice(0, 2).join(', ')}`
        : missingRequired.length
            ? `Leider hat fuer den Auftrag etwas gefehlt: ${missingRequired.slice(0, 2).join(', ')}`
            : droppedRequired.length
                ? `Leider ist unterwegs etwas verloren gegangen: ${droppedRequired.slice(0, 2).join(', ')}`
                : notDeliveredRequired.length
                    ? `Die Uebergabe dieser Ladung ist noch offen: ${notDeliveredRequired.slice(0, 2).join(', ')}`
                    : 'Leider konnten wir den Auftrag am Ziel noch nicht abschliessen';
    return `Danke fuers Mitnehmen. ${primaryFailureReason}.`;
}

window.triggerPaxCargoEvent = async function(event = {}) {
    const ctx = _baseContext();
    const pax = window.activePassenger;
    if (!ctx || !pax || !_missionHasPax()) return false;
    const item = event.item || {};
    const name = item.storyName || item.label || 'ein wichtiges Teil';
    const required = item.required === true;
    const reason = event.type === 'dropped_required'
        ? `${name} wurde im Flug abgeworfen.`
        : `${name} wurde an der Ladung geaendert.`;
    const prompt = `${ctx}

Moment: ${reason}
Sprich als ${pax.role} sofort und kurz auf die Ladung an. ${required ? 'Das Teil ist missionsrelevant, also deutlich verärgert oder besorgt reagieren.' : 'Nur knapp und praktisch reagieren.'} Max 2 Sätze.${_toneHint()}`;
    _paxLog(`Cargo-Ereignis: ${reason}`, required ? 'warn' : 'event');
    await _speakAndShow(prompt, 'Ladung');
    return true;
}

function _farewellPreparedContext(record = null) {
    let rec = (record && typeof record === 'object') ? { ...record } : {};
    if (!rec.missionCargoOutcome && typeof _missionCargoEvaluateFarewellOutcome === 'function') {
        try {
            const outcome = _missionCargoEvaluateFarewellOutcome();
            if (outcome && typeof outcome === 'object' && outcome.status !== 'none') {
                rec.missionCargoOutcome = outcome;
                rec.missionFailed = !!outcome.failed;
            }
        } catch (_) {}
    }
    const cargoOutcome = rec?.missionCargoOutcome || null;
    const forceFailureFallback = !!(
        rec?.missionFailed
        || rec?.poiAborted
        || cargoOutcome?.failed
    );
    if (!window.activePassenger || !_missionHasPax()) {
        const prompt = _cargoOnlyFarewellPrompt(rec);
        if (!prompt) return null;
        return {
            key: _paxMissionAudioKey('farewell-cargo'),
            prompt,
            speaker: _cargoMissionSpeaker('farewell'),
            eventLabel: 'Verabschiedung',
            logLabel: 'CargoFarewell'
        };
    }
    const speaker = _speakerSnapshotForActivePax();
    if (forceFailureFallback) {
        return {
            key: _paxMissionAudioKey('farewell-failed'),
            text: _failedMissionFarewellFallback(rec),
            speaker,
            eventLabel: 'Verabschiedung',
            logLabel: 'Farewell'
        };
    }
    const prompt = _farewellPrompt(rec);
    if (!prompt) return null;
    return {
        key: _paxMissionAudioKey('farewell'),
        prompt,
        speaker,
        eventLabel: 'Verabschiedung',
        logLabel: 'Farewell'
    };
}

function _professionalLandingToneHint() {
    const meta = _professionalRoleMeta();
    if (!meta) return '';
    return ' Ton bei Landung: sachlich, knapp und dankend. Kein Show-/Sightseeing-Ton.';
}

function _domainDriftGuard(mode = 'generic') {
    const td = _activeTaskDomain();
    const m = String(mode || 'generic').toLowerCase();
    if (td === 'science_bio') {
        if (m === 'result') return ' Drift-Guard (Bio): Abschluss nur als biologisches/ökologisches Fazit (Arten, Vegetation, Habitat, Stoerfaktoren). Keine Geologie-, Inspektions- oder Einsatzsprache.';
        if (m === 'progress') return ' Drift-Guard (Bio): Bleib bei biologischer Beobachtung und Datenguete. Keine Technikpruefung, keine SAR-/Feuerlage.';
        return ' Drift-Guard (Bio): Nur Bio/Umwelt-Inhalte (Flora/Fauna/Habitat/Ufervegetation). Keine Risse/Statik/Schadenssuche, keine Geologie, kein SAR-/Feuer-Ton.';
    }
    if (td === 'science_geo') {
        if (m === 'result') return ' Drift-Guard (Geo): Abschluss nur als geologisches/geomorphologisches Fazit (Relief, Erosion, Hangstabilitaet, Sedimente). Keine Bio- oder Einsatzsprache.';
        if (m === 'progress') return ' Drift-Guard (Geo): Bleib bei Relief/Erosion/Hangbeobachtung und Datenguete. Keine Arten-/Vegetationsanalyse, kein Medien-/Einsatz-Ton.';
        return ' Drift-Guard (Geo): Nur geologische/geomorphologische Einordnung. Keine Arten-/Uferbiologie, keine Technikinspektion, kein SAR-/Feuer-Ton.';
    }
    if (td === 'mapping_survey') {
        if (m === 'result') return ' Drift-Guard (Survey): Abschluss mit Datenguete, Abdeckung und naechstem Auswertungsschritt. Keine Schadensdiagnose, keine Story-, Historiker- oder Sightseeing-Formulierungen.';
        if (m === 'progress') return ' Drift-Guard (Survey): Nur Survey-Logik, Linien/Orbit, Hoehenstabilitaet, Ueberlappung, Abdeckung und Datenqualitaet. Keine Ortsanekdoten, keine Risse/Schaeden.';
        return ' Drift-Guard (Survey): Technisch-praezise Vermessungs-/Dokumentationssprache. Keine Begeisterungs- oder Tourismusformeln, keine SAR-/Inspektionsdramatik. Arbeitsmuster nur als geplante Linie oder Orbit nennen, nicht als bereits gepruefte Pattern-Wertung.';
    }
    if (td === 'poi_learning_guide') {
        if (m === 'result') return ' Drift-Guard (Lern-Guide): Abschluss mit 1-2 klaren Fakten/Einordnung und einem ruhigen Weiterflug-Hinweis. Du erklaerst dem Piloten die Gegend; nicht sagen, dass du selbst fuer spaetere Touren lernst. Keine Arbeitsanweisung, keine Einsatz-/Inspektionssprache. Keine unbestaetigten Spezial-Landmarken als roten Faden weiterfuehren.';
        if (m === 'progress') return ' Drift-Guard (Lern-Guide): Nur Fakten, Kontext und Orientierung zum Ziel. Du bist Guide fuer den Piloten, kein angehender Guide im Trainingsflug. Keine Checklisten, keine Mess-/Schadenssprache. Keine unbestaetigten Spezial-Landmarken als roten Faden weiterfuehren.';
        return ' Drift-Guard (Lern-Guide): Bildungsorientiert und anschaulich. Du erklaerst Ziel und Umgebung fuer den Piloten. Keine Formulierungen wie "ich lerne fuer spaetere Touren" oder "Gelaende abspeichern". Keine Instruktoranweisungen, keine feste Arbeitshoehe verlangen, kein SAR-/Fire-/Inspektions-Ton. Keine Strommasten, Windraeder oder andere Spezial-Landmarken nennen, ausser sie sind das Ziel oder sicher bestaetigt.';
    }
    if (td === 'sightseeing_tour') {
        if (!_isPOIMission()) {
            if (m === 'result') return ' Drift-Guard (APT-Sightseeing): Abschluss als Ankommen am Zielplatz mit Vorfreude auf Zielort, Altstadt, Aussichtspunkt, Spaziergang, Fotos oder Cafe nach der Landung. Kein Rueckkehr-, Rundflug-, Auftrag-, Befund-, Daten- oder Inspektionston.';
            if (m === 'progress') return ' Drift-Guard (APT-Sightseeing): Privater Hinflug zur Zielregion; nenne Vorfreude, Zielort, Landschaft, Fotos oder Plaene nach der Landung. Keine Arbeits-, Einsatz-, Vermessungs-, Instruktor-, Rueckflug- oder Rundflug-Sprache.';
            return ' Drift-Guard (APT-Sightseeing): Persoenlicher A-B-Ausflug zur Zielregion. Keine Arbeitsanweisung, keine feste Arbeitshoehe verlangen, keine Erfassung/Dokumentation/Lagebild/Inspektion. Zielplatz als Gateway zum privaten Plan nach der Landung erzaehlen, nicht als POI-Rundflug.';
        }
        if (m === 'result') return ' Drift-Guard (Sightseeing): Abschluss als warmer Blickmoment mit entspannter Rueckkehr. Keine Woerter wie fertig, abgearbeitet, Befund, Daten, Dokumentation, Erfassung, Inspektion oder Lagebild.';
        if (m === 'progress') return ' Drift-Guard (Sightseeing): Nur Aussicht, Orientierung, Erinnerungsfotos und ruhige Beobachtung. Keine Arbeits-, Einsatz-, Vermessungs- oder Instruktor-Sprache.';
        return ' Drift-Guard (Sightseeing): Persoenlicher Rundflugston. Keine Arbeitsanweisung, keine feste Arbeitshoehe verlangen, keine Erfassung/Dokumentation/Lagebild/Inspektion. Zielbereich nur als Blickmoment aus der Luft erzaehlen, nicht als Bodenaktionsort.';
    }
    if (td === 'news_coverage') {
        if (m === 'result') return ' Drift-Guard (News): Abschluss als kurze sachliche Lagezusammenfassung. Kein Einsatzabschluss wie SAR, kein Touri-Ton.';
        if (m === 'progress') return ' Drift-Guard (News): Nenne nur beobachtbare Fakten/Lagepunkte. Keine technische Schadensbewertung.';
        return ' Drift-Guard (News): Nuechtern und beobachtend, faktenbasiert. Keine Sightseeing-Sprache, keine Fachinspektion, keine Rollenmischung mit SAR/Fire.';
    }
    if (td === 'media_photo') {
        if (m === 'result') return ' Drift-Guard (Foto/Film): Abschluss ueber verwertbares Bildmaterial, Motive und Weitergabe an Redaktion/Gemeinde/Auftraggeber. Kein Sightseeing-Fazit, keine technische Befundsprache.';
        if (m === 'progress') return ' Drift-Guard (Foto/Film): Nur Bildserie, Motiv, Perspektive, Licht, Ortsbezug und Wiedererkennungswert. Keine Aussicht-geniessen-Sprache, keine Inspektion.';
        return ' Drift-Guard (Foto/Film): Bildredaktionell und zweckbezogen. Keine persoenliche Ausflugserzaehlung, keine Einsatz- oder Inspektionssprache.';
    }
    if (td === 'historian_guided_tour') {
        if (m === 'result') return ' Drift-Guard (Historiker): Abschluss als historische Ortslesart mit kurzem Takeaway und Rueckflughinweis. Kein Sightseeing-Fazit, keine technische Befundsprache.';
        if (m === 'progress') return ' Drift-Guard (Historiker): Nur historische Einordnung, Ortsbild, alte Wege, Lagebezug oder fruehere Nutzung. Keine Foto-, Einsatz- oder Inspektionssprache.';
        return ' Drift-Guard (Historiker): Historisch-bildend und anschaulich. Keine Sightseeing-Formel, keine Arbeitsanweisung, keine technische Bewertung.';
    }
    return '';
}

function _weatherContext(fd) {
    if (!fd) return '';
    const parts = [];
    if (fd.windKts != null) {
        const desc = fd.windKts > 20 ? ' (kräftig)' : fd.windKts > 10 ? ' (mäßig)' : ' (schwach)';
        parts.push(`Wind ${fd.windKts} kts aus ${fd.windDeg ?? '?'}°${desc}`);
    }
    if (fd.windGustKts != null && fd.windKts != null) {
        const spread = Math.max(0, Number(fd.windGustKts) - Number(fd.windKts));
        if (spread >= 4) parts.push(`Böen bis ${fd.windGustKts} kts`);
    } else if (fd.windGustKts != null) {
        parts.push(`Böen bis ${fd.windGustKts} kts`);
    }
    if (fd.tempC   != null) parts.push(`${fd.tempC}°C`);
    if (fd.visKm   != null) {
        const desc = fd.visKm < 3 ? ' (sehr schlecht)' : fd.visKm < 8 ? ' (eingeschränkt)' : fd.visKm > 20 ? ' (ausgezeichnet)' : '';
        parts.push(`Sicht ${fd.visKm} km${desc}`);
    }
    if (fd.precipRateMmH != null) {
        const p = Number(fd.precipRateMmH);
        const state = p >= 4 ? 'stark' : p >= 1.5 ? 'mäßig' : p > 0.05 ? 'leicht' : '';
        if (state) parts.push(`Niederschlag ${state}`);
    } else if (fd.precipActive === true) {
        parts.push('Niederschlag');
    }
    if (fd.inCloud === true) parts.push('in Wolken');
    if (fd.turbulencePct != null) {
        const t = Number(fd.turbulencePct);
        if (t >= 60) parts.push('Turbulenz stark');
        else if (t >= 35) parts.push('Turbulenz spürbar');
    }
    return parts.length ? `Wetter: ${parts.join(', ')}.` : '';
}
// Frozen cargo stress functions from the pre-migration App backup.
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
