// Frozen actual standalone functions before POI extraction, 2026-09-15. Test oracle only.
function _surveyPatternOuterRadiusNm(spec = null, fallbackRadiusNm = 1.5) {
    if (!spec || typeof spec !== 'object') return Math.max(0.5, Number(fallbackRadiusNm || 0) || 1.5);
    const center = spec.center || {};
    const centerLat = Number(center.lat);
    const centerLon = Number(center.lon);
    if (String(spec.type || '').toLowerCase() === 'orbit') {
        return Math.max(
            Number(fallbackRadiusNm || 0) || 0,
            Number(spec.orbit?.radiusNm || 0) + Number(spec.orbit?.radialToleranceNm || 0) + 0.25
        );
    }
    let maxNm = 0;
    if (Number.isFinite(centerLat) && Number.isFinite(centerLon) && Array.isArray(spec.scan?.lines)) {
        for (const line of spec.scan.lines) {
            for (const point of [line?.start, line?.end]) {
                const lat = Number(point?.lat);
                const lon = Number(point?.lon);
                if (Number.isFinite(lat) && Number.isFinite(lon)) {
                    maxNm = Math.max(maxNm, _haversineNm(centerLat, centerLon, lat, lon));
                }
            }
        }
    }
    return Math.max(Number(fallbackRadiusNm || 0) || 0, maxNm + 0.25, 0.5);
}

function _poiInSightGate({ taskDomain = '', distNm = 0, etaMin = 0, radiusNm = 1.5, effectiveGs = 95, surveyTickResult = null, poiChainTickResult = null } = {}) {
    const td = String(taskDomain || '').toLowerCase();
    const dist = Number(distNm);
    if (!Number.isFinite(dist)) return { ready: false, announcedEtaMin: 2, logEtaMin: etaMin };
    if (td === 'infra_chain_recon' && poiChainTickResult?.progress?.startedAt) {
        return { ready: false, announcedEtaMin: 2, logEtaMin: 0 };
    }
    if (td !== 'mapping_survey') {
        return {
            ready: Number(etaMin) <= 3.2 && dist <= Math.max(2.2, Number(radiusNm || 0) + 1.2),
            announcedEtaMin: 2,
            logEtaMin: etaMin
        };
    }
    if (surveyTickResult?.progress?.startedAt) {
        return { ready: false, announcedEtaMin: 2, logEtaMin: 0 };
    }
    const spec = _surveyPatternActiveSpec();
    const surveyRadius = _surveyPatternOuterRadiusNm(spec, radiusNm);
    const gs = Math.max(45, Number(effectiveGs || 0) || 95);
    const etaToSurveyAreaMin = Math.max(0, ((dist - surveyRadius) / gs) * 60);
    const stillOutsideSurvey = dist > surveyRadius + 0.25;
    return {
        ready: stillOutsideSurvey
            && etaToSurveyAreaMin <= 3.6
            && dist <= surveyRadius + 6.5,
        announcedEtaMin: Math.max(2, Math.round(etaToSurveyAreaMin)),
        logEtaMin: etaToSurveyAreaMin,
        surveyRadiusNm: surveyRadius
    };
}

function _haversineNm(lat1, lon1, lat2, lon2) {
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2
            + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 3440.065;
}

function _bearingDeg(lat1, lon1, lat2, lon2) {
    const phi1 = lat1 * Math.PI / 180;
    const phi2 = lat2 * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const y = Math.sin(dLon) * Math.cos(phi2);
    const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLon);
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

function _relativeClockPos(targetBearingDeg, headingDeg) {
    if (!Number.isFinite(targetBearingDeg) || !Number.isFinite(headingDeg)) return '12 Uhr';
    const rel = (targetBearingDeg - headingDeg + 360) % 360;
    const hour = Math.round(rel / 30) || 12;
    return `${hour > 12 ? hour - 12 : hour} Uhr`;
}

function _tickPoiDwell(lat, lon, flightData) {
    // POI-Training nutzt ein virtuelles Uebungsgebiet ohne echtes Objekt.
    // Daher keine Objekt-/Dwell-/In-Sight-Trigger aus dem POI-Inspektionspfad.
    if (_activeAptTrainingPlan()) return;

    const pax  = window.activePassenger;
    const dest = _getDestCoords();
    if (!dest) return;

    const distNm   = _haversineNm(lat, lon, dest.lat, dest.lon);
    const radius   = pax.targetRadiusNm || 1.5;
    const inRadius = distNm <= radius;
    const now      = Date.now();
    const gsKts = Number(flightData?.gs || flightData?.gsKts || flightData?.groundSpeed || window.lastLiveGpsPos?.gs || 0);
    const effectiveGs = gsKts > 25 ? gsKts : 95;
    const etaMin = (distNm / effectiveGs) * 60;
    const targetBearing = _bearingDeg(lat, lon, dest.lat, dest.lon);
    const hdg = Number(flightData?.hdg || flightData?.heading || flightData?.trackDeg || flightData?.trkDeg || window.lastLiveGpsPos?.hdg || targetBearing);
    const clockPos = _relativeClockPos(targetBearing, hdg);

    const strict               = _paxStrictMode;
    const taskDomain = _activeTaskDomain();
    if (taskDomain === 'fire_watch' && _tickFireMissionSearch(flightData, distNm)) {
        return;
    }
    const sarHeli = !!(typeof window.missionIsSarHeliMission === 'function' && window.missionIsSarHeliMission((typeof currentMissionData !== 'undefined' ? currentMissionData : null)));
    if (sarHeli) {
        if (typeof window.missionSarHeliHandlePoiTick === 'function') {
            window.missionSarHeliHandlePoiTick({
                lat,
                lon,
                flightData,
                distNm,
                inRadius,
                radius,
                now
            });
        }
        if (inRadius && !_poiInRadius) {
            _poiInRadius = true;
            _poiLastTickTime = now;
            if (!_poiEnteredAt) _poiEnteredAt = now;
        } else if (!inRadius) {
            _poiInRadius = false;
            _poiLastTickTime = null;
        }
        return;
    }
    const tightAltitudeBand = /^(fire_watch|search_and_rescue|inspection_infra|infra_chain_recon|mapping_survey)$/.test(taskDomain);
    const altTolerance         = strict ? 200  : (tightAltitudeBand ? 300 : 600);
    const dwellRequired        = pax.targetDwellMin > 0 ? pax.targetDwellMin * 60 * (strict ? 1.0 : 0.5) : 0;
    const maxAttempts          = strict ? 2 : 3;
    const graceSec             = strict ? 15  : 25;
    const complaintIntervalSec = strict ? 30 : 45;
    const taskItemState = _poiRequiredTaskItemState();
    const missingTaskItems = taskItemState.blockingItems;
    const poiChainTickResult = _tickPoiChainTask(lat, lon, flightData);
    const surveyTickResult = taskDomain === 'mapping_survey'
        ? _tickSurveyPatternTask(lat, lon, flightData)
        : null;

    const inSightGate = _poiInSightGate({
        taskDomain,
        distNm,
        etaMin,
        radiusNm: radius,
        effectiveGs,
        surveyTickResult,
        poiChainTickResult
    });

    // Frühe POI-Meldung: technisch hilfreiche "Objekt in Sicht"-Ansage.
    // Mapping-Survey nutzt die ETA bis zum Pattern-Rand, weil das Arbeitsgebiet groesser als der POI-Radius sein kann.
    if (!_poiSightCallDone && !inRadius && inSightGate.ready) {
        _poiSightCallDone = true;
        const surveyPart = Number.isFinite(Number(inSightGate.surveyRadiusNm)) ? ` | surveyR: ${Number(inSightGate.surveyRadiusNm).toFixed(2)} NM` : '';
        _paxLog(`POI pre-call | dist: ${distNm.toFixed(2)} NM | eta: ${etaMin.toFixed(1)} min | etaGate: ${Number(inSightGate.logEtaMin || etaMin).toFixed(1)} min | pos: ${clockPos}${surveyPart}`, 'event');
        const p = _poiInSightPrompt(flightData, distNm, etaMin, clockPos, { announcedEtaMin: inSightGate.announcedEtaMin });
        if (p) _paxMissionTimeout(() => _speakAndShow(p, 'Objekt in Sicht'), 300);
    }

    if (!inRadius) {
        if (!surveyTickResult?.progress?.startedAt && !poiChainTickResult?.progress?.startedAt) {
            _poiInRadius     = false;
            _poiLastTickTime = null;
        }
        return;
    }

    if (!_poiInRadius) {
        _poiInRadius     = true;
        _poiLastTickTime = now;
        if (!_poiEnteredAt) _poiEnteredAt = now;
        _paxLog(`POI-Radius betreten | dist: ${distNm.toFixed(2)} NM | dwell: ${dwellRequired.toFixed(0)}s | altReq: ${pax.targetAltFt || 'keins'}`, 'state');

        if (missingTaskItems.length) {
            _poiAborted = true;
            _paxAtTargetDone = true;
            _poiEntryDone = true;
            if (typeof window.missionPersistRuntimeSnapshot === 'function') window.missionPersistRuntimeSnapshot('poi-aborted-missing-cargo', { immediate: true });
            _paxLog(`POI-Abbruch wichtiger Gegenstand ${taskItemState.reason === 'damaged' ? 'beschaedigt' : 'fehlt'} | items: ${missingTaskItems.join(', ')}`, 'warn');
            const pMissing = _poiMissingCargoAbortPrompt(flightData, taskItemState);
            if (pMissing) _paxMissionTimeout(() => _speakAndShow(pMissing, 'Abbruch'), 600);
            return;
        }

        // Entry comment — spontane erste Reaktion beim Einflug
        if (!_poiEntryDone) {
            _poiEntryDone = true;
            const p = _poiEntryPrompt(flightData);
            if (p) _paxMissionTimeout(() => _speakAndShow(p, 'Zielgebiet'), 800);
        }

        // Flyover (targetDwellMin=0): Entry genügt → satisfied nach kurzem Delay
        if (dwellRequired === 0 && taskDomain !== 'mapping_survey') {
            _poiSatisfied    = true;
            _paxAtTargetDone = true;
            if (typeof window.missionPersistRuntimeSnapshot === 'function') window.missionPersistRuntimeSnapshot('poi-flyover-satisfied', { immediate: true });
            _paxLog('Flyover-Mission — Überflug genügt, satisfied', 'event');
            return;
        }
    }

    if (missingTaskItems.length) {
        _poiAborted = true;
        _paxAtTargetDone = true;
        if (typeof window.missionPersistRuntimeSnapshot === 'function') window.missionPersistRuntimeSnapshot('poi-aborted-missing-cargo', { immediate: true });
        _paxLog(`POI-Abbruch waehrend Verweilzeit: wichtiger Gegenstand ${taskItemState.reason === 'damaged' ? 'beschaedigt' : 'fehlt'} | items: ${missingTaskItems.join(', ')}`, 'warn');
        const pMissing = _poiMissingCargoAbortPrompt(flightData, taskItemState);
        if (pMissing) _paxMissionTimeout(() => _speakAndShow(pMissing, 'Abbruch'), 600);
        return;
    }

    if (taskDomain === 'mapping_survey' && surveyTickResult?.handled) {
        return;
    }
    if (poiChainTickResult?.handled) {
        return;
    }

    const dt = Math.min((now - _poiLastTickTime) / 1000, 5);
    _poiLastTickTime = now;

    const altFt     = flightData?.mslFt || 0;
    const targetAlt = pax.targetAltFt || 0;
    const altOk     = targetAlt === 0 || Math.abs(altFt - targetAlt) <= altTolerance;
    const inRadiusForSec   = (now - (_poiEnteredAt || now)) / 1000;
    const lastComplaintSec = _poiLastComplaintAt ? (now - _poiLastComplaintAt) / 1000 : Infinity;

    if (altOk) {
        // Proximity boost: 2× at centre, 1× at edge (linear)
        const proximityFactor = 1 + Math.max(0, 1 - distNm / radius);
        _poiDwellSec += dt * proximityFactor;

        if (_poiAltWasOk === false) {
            _paxLog('Höhe korrigiert → Bestätigung', 'event');
            const p = _poiAltCorrectedPrompt(flightData);
            if (p) _paxMissionTimeout(() => _speakAndShow(p, 'Höhe ok'), 500);
        }
        _poiAltWasOk = true;

        if (_poiDwellSec >= dwellRequired) {
            _paxLog(`Verweilzeit erfüllt (${_poiDwellSec.toFixed(0)}s) → zufrieden`, 'event');
            _poiSatisfied    = true;
            _paxAtTargetDone = true;
            if (typeof window.missionPersistRuntimeSnapshot === 'function') window.missionPersistRuntimeSnapshot('poi-dwell-satisfied', { immediate: true });
            const p = _poiSatisfiedPrompt(flightData);
            if (p) _paxMissionTimeout(() => _speakAndShow(p, 'Ziel erfüllt'), 500);
        }
    } else {
        _poiAltWasOk = false;

        const canComplain = inRadiusForSec >= graceSec && lastComplaintSec >= complaintIntervalSec;
        if (canComplain) {
            if (_poiAttempts < maxAttempts) {
                _poiAttempts++;
                _poiLastComplaintAt = now;
                _paxLog(`Höhen-Reklamation #${_poiAttempts} | ${altFt} ft statt ${targetAlt} ft`, 'event');
                const p = _poiAltComplaintPrompt(flightData, altFt, targetAlt, _poiAttempts);
                if (p) _paxMissionTimeout(() => _speakAndShow(p, `Höhe (${_poiAttempts}/${maxAttempts})`), 500);
            } else {
                _paxLog('Max. Versuche erreicht → Abbruch', 'event');
                _poiAborted      = true;
                _paxAtTargetDone = true;
                if (typeof window.missionPersistRuntimeSnapshot === 'function') window.missionPersistRuntimeSnapshot('poi-alt-aborted', { immediate: true });
                const p = _poiAbortPrompt(flightData);
                if (p) _paxMissionTimeout(() => _speakAndShow(p, 'Abbruch'), 1000);
            }
        }
    }
}

function _poiRequiredTaskItemState() {
    if (typeof window.missionCargoEvaluateOutcome !== 'function') {
        return { missing: [], dropped: [], damaged: [], blockingItems: [], reason: 'missing' };
    }
    try {
        const outcome = window.missionCargoEvaluateOutcome();
        const normalize = (list) => [...new Set((Array.isArray(list) ? list : []).map(v => String(v || '').trim()).filter(Boolean))];
        const missing = normalize(outcome?.missingRequired);
        const dropped = normalize(outcome?.droppedRequired);
        const damaged = normalize(outcome?.damagedRequired);
        const blockingItems = [...new Set([...missing, ...dropped, ...damaged])];
        let reason = 'missing';
        if (damaged.length) reason = 'damaged';
        else if (dropped.length) reason = 'dropped';
        return { missing, dropped, damaged, blockingItems, reason };
    } catch (_) {
        return { missing: [], dropped: [], damaged: [], blockingItems: [], reason: 'missing' };
    }
}


function _tickPoiChainTask(lat, lon, flightData) {
    const md = (typeof currentMissionData !== 'undefined' ? currentMissionData : null);
    const isChainMission = !!(md?.poiChain || md?.missionSubType === 'poi_chain' || window.activePassenger?.poiChain);
    if (!isChainMission) return null;
    if (typeof window.missionPoiChainRuntime?.tick !== 'function') return null;
    let result = null;
    try {
        result = window.missionPoiChainRuntime.tick({
            lat,
            lon,
            flightData,
            missionData: md,
            passenger: window.activePassenger || null
        });
    } catch (err) {
        _paxLog(`POI-Chain Tick Fehler: ${err?.message || err}`, 'warn');
        return null;
    }
    if (!result?.handled) return result;
    _handlePoiChainEvents(result.events || [], result.spec || _poiChainActiveSpec());
    const progress = result.progress || null;
    if (progress?.updatedAt) {
        if (progress.startedAt) _poiDwellSec = Math.max(_poiDwellSec, (Number(progress.updatedAt) - Number(progress.startedAt)) / 1000);
        _poiInRadius = true;
        _poiEntryDone = true;
        if (!_poiEnteredAt) _poiEnteredAt = Number(progress.startedAt || progress.updatedAt) || Date.now();
        _poiLastTickTime = Date.now();
    }
    if (result.satisfied && !_poiSatisfied) {
        _poiSatisfied = true;
        _paxAtTargetDone = true;
        _poiInRadius = true;
        _poiEntryDone = true;
        if (typeof window.missionPersistRuntimeSnapshot === 'function') {
            window.missionPersistRuntimeSnapshot('poi-chain-satisfied', { immediate: true });
        }
        if (!Array.isArray(result.events) || !result.events.some(ev => String(ev?.type || '') === 'chain_complete')) {
            _handlePoiChainEvents([{ type: 'chain_complete' }], result.spec || _poiChainActiveSpec());
        }
        _refreshPaxWidgetVisibility();
    }
    return result;
}

function _tickSurveyPatternTask(lat, lon, flightData) {
    if (_activeTaskDomain() !== 'mapping_survey') return false;
    if (typeof window.missionSurveyPattern?.tick !== 'function') return false;
    const md = (typeof currentMissionData !== 'undefined' ? currentMissionData : null);
    let result = null;
    try {
        result = window.missionSurveyPattern.tick({
            lat,
            lon,
            flightData,
            missionData: md,
            passenger: window.activePassenger || null
        });
    } catch (err) {
        _paxLog(`Survey-Pattern Tick Fehler: ${err?.message || err}`, 'warn');
        return false;
    }
    if (!result?.handled) return false;
    _handleSurveyPatternEvents(result.events || [], result.spec || _surveyPatternActiveSpec());
    const progress = result.progress || null;
    if (progress?.startedAt && progress?.updatedAt) {
        _poiDwellSec = Math.max(_poiDwellSec, (Number(progress.updatedAt) - Number(progress.startedAt)) / 1000);
        _poiInRadius = true;
        _poiEntryDone = true;
        if (!_poiEnteredAt) _poiEnteredAt = Number(progress.startedAt) || Date.now();
        _poiLastTickTime = Date.now();
    }
    if (result.satisfied && !_poiSatisfied) {
        _poiSatisfied = true;
        _paxAtTargetDone = true;
        _poiInRadius = true;
        _poiEntryDone = true;
        if (typeof window.missionPersistRuntimeSnapshot === 'function') {
            window.missionPersistRuntimeSnapshot('survey-pattern-satisfied', { immediate: true });
        }
        if (!Array.isArray(result.events) || !result.events.some(ev => String(ev?.type || '') === 'survey_complete')) {
            _handleSurveyPatternEvents([{ type: 'survey_complete' }], result.spec || _surveyPatternActiveSpec());
        }
        _refreshPaxWidgetVisibility();
    }
    return result;
}
