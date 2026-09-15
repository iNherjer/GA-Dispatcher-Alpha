(function (root, factory) {
    'use strict';
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.GAMissionPoiTaskCore = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';
    // Extracted from standalone _tickPoiDwell; source-order effects include the
    // state visible at that exact point. No browser, audio, clock or storage owner.
    const SCHEMA = 'ga.mission-poi-task.v1';
    function createState(previous = {}) {
        return { inRadius: false, enteredAt: null, lastTickTime: null, dwellSec: 0,
            attempts: 0, lastComplaintAt: null, altWasOk: null, satisfied: false,
            aborted: false, manualConfirmed: false, entryDone: false,
            sightCallDone: false, atTargetDone: false, ...previous };
    }
    function isState(state) {
        if (!state || typeof state !== 'object' || Array.isArray(state)) return false;
        const finite = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;
        return ['inRadius', 'satisfied', 'aborted', 'manualConfirmed', 'entryDone', 'sightCallDone', 'atTargetDone']
            .every(key => typeof state[key] === 'boolean')
            && ['enteredAt', 'lastTickTime', 'lastComplaintAt'].every(key => state[key] === null || finite(state[key]))
            && (state.altWasOk === null || typeof state.altWasOk === 'boolean')
            && finite(state.dwellSec) && Number.isSafeInteger(state.attempts) && state.attempts >= 0;
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

    function inSight({ taskDomain = '', distNm = 0, etaMin = 0, radiusNm = 1.5, effectiveGs = 95, surveyTickResult = null, poiChainTickResult = null } = {}, surveySpec = null) {
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
        const surveyRadius = _surveyPatternOuterRadiusNm(surveySpec, radiusNm);
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
    function observe(previous, input) {
        const state = createState(previous);
        const effects = [];
        const emit = (type, value, level) => effects.push({ type, value, ...(level ? { level } : {}), state: { ...state } });
        const { pax, distNm, now, flightData, taskDomain, strict, etaMin, effectiveGs, clockPos,
            poiChainTickResult = null, surveyTickResult = null,
            taskItemState = { blockingItems: [], reason: 'missing' } } = input;
        const radius = pax.targetRadiusNm || 1.5;
        const inRadius = distNm <= radius;
        const missingTaskItems = taskItemState.blockingItems;
        function advance() {
            const tightAltitudeBand = /^(fire_watch|search_and_rescue|inspection_infra|infra_chain_recon|mapping_survey)$/.test(taskDomain);
            const altTolerance         = strict ? 200  : (tightAltitudeBand ? 300 : 600);
            const dwellRequired        = pax.targetDwellMin > 0 ? pax.targetDwellMin * 60 * (strict ? 1.0 : 0.5) : 0;
            const maxAttempts          = strict ? 2 : 3;
            const graceSec             = strict ? 15  : 25;
            const complaintIntervalSec = strict ? 30 : 45;

            const inSightGate = inSight({
                taskDomain,
                distNm,
                etaMin,
                radiusNm: radius,
                effectiveGs,
                surveyTickResult,
                poiChainTickResult
            }, input.surveySpec);

            // Frühe POI-Meldung: technisch hilfreiche "Objekt in Sicht"-Ansage.
            // Mapping-Survey nutzt die ETA bis zum Pattern-Rand, weil das Arbeitsgebiet groesser als der POI-Radius sein kann.
            if (!state.sightCallDone && !inRadius && inSightGate.ready) {
                state.sightCallDone = true;
                const surveyPart = Number.isFinite(Number(inSightGate.surveyRadiusNm)) ? ` | surveyR: ${Number(inSightGate.surveyRadiusNm).toFixed(2)} NM` : '';
                emit('log', `POI pre-call | dist: ${distNm.toFixed(2)} NM | eta: ${etaMin.toFixed(1)} min | etaGate: ${Number(inSightGate.logEtaMin || etaMin).toFixed(1)} min | pos: ${clockPos}${surveyPart}`, 'event');
                emit('voice', { prompt: '_poiInSightPrompt', args: [flightData, distNm, etaMin, clockPos, { announcedEtaMin: inSightGate.announcedEtaMin }], label: 'Objekt in Sicht', delayMs: 300 });
            }

            if (!inRadius) {
                if (!surveyTickResult?.progress?.startedAt && !poiChainTickResult?.progress?.startedAt) {
                    state.inRadius     = false;
                    state.lastTickTime = null;
                }
                return;
            }

            if (!state.inRadius) {
                state.inRadius     = true;
                state.lastTickTime = now;
                if (!state.enteredAt) state.enteredAt = now;
                emit('log', `POI-Radius betreten | dist: ${distNm.toFixed(2)} NM | dwell: ${dwellRequired.toFixed(0)}s | altReq: ${pax.targetAltFt || 'keins'}`, 'state');

                if (missingTaskItems.length) {
                    state.aborted = true;
                    state.atTargetDone = true;
                    state.entryDone = true;
                    emit('persist', 'poi-aborted-missing-cargo');
                    emit('log', `POI-Abbruch wichtiger Gegenstand ${taskItemState.reason === 'damaged' ? 'beschaedigt' : 'fehlt'} | items: ${missingTaskItems.join(', ')}`, 'warn');
                    emit('voice', { prompt: '_poiMissingCargoAbortPrompt', args: [flightData, taskItemState], label: 'Abbruch', delayMs: 600 });
                    return;
                }

                // Entry comment — spontane erste Reaktion beim Einflug
                if (!state.entryDone) {
                    state.entryDone = true;
                    emit('voice', { prompt: '_poiEntryPrompt', args: [flightData], label: 'Zielgebiet', delayMs: 800 });
                }

                // Flyover (targetDwellMin=0): Entry genügt → satisfied nach kurzem Delay
                if (dwellRequired === 0 && taskDomain !== 'mapping_survey') {
                    state.satisfied    = true;
                    state.atTargetDone = true;
                    emit('persist', 'poi-flyover-satisfied');
                    emit('log', 'Flyover-Mission — Überflug genügt, satisfied', 'event');
                    return;
                }
            }

            if (missingTaskItems.length) {
                state.aborted = true;
                state.atTargetDone = true;
                emit('persist', 'poi-aborted-missing-cargo');
                emit('log', `POI-Abbruch waehrend Verweilzeit: wichtiger Gegenstand ${taskItemState.reason === 'damaged' ? 'beschaedigt' : 'fehlt'} | items: ${missingTaskItems.join(', ')}`, 'warn');
                emit('voice', { prompt: '_poiMissingCargoAbortPrompt', args: [flightData, taskItemState], label: 'Abbruch', delayMs: 600 });
                return;
            }

            if (taskDomain === 'mapping_survey' && surveyTickResult?.handled) {
                return;
            }
            if (poiChainTickResult?.handled) {
                return;
            }

            const dt = Math.min((now - state.lastTickTime) / 1000, 5);
            state.lastTickTime = now;

            const altFt     = flightData?.mslFt || 0;
            const targetAlt = pax.targetAltFt || 0;
            const altOk     = targetAlt === 0 || Math.abs(altFt - targetAlt) <= altTolerance;
            const inRadiusForSec   = (now - (state.enteredAt || now)) / 1000;
            const lastComplaintSec = state.lastComplaintAt ? (now - state.lastComplaintAt) / 1000 : Infinity;

            if (altOk) {
                // Proximity boost: 2× at centre, 1× at edge (linear)
                const proximityFactor = 1 + Math.max(0, 1 - distNm / radius);
                state.dwellSec += dt * proximityFactor;

                if (state.altWasOk === false) {
                    emit('log', 'Höhe korrigiert → Bestätigung', 'event');
                    emit('voice', { prompt: '_poiAltCorrectedPrompt', args: [flightData], label: 'Höhe ok', delayMs: 500 });
                }
                state.altWasOk = true;

                if (state.dwellSec >= dwellRequired) {
                    emit('log', `Verweilzeit erfüllt (${state.dwellSec.toFixed(0)}s) → zufrieden`, 'event');
                    state.satisfied    = true;
                    state.atTargetDone = true;
                    emit('persist', 'poi-dwell-satisfied');
                    emit('voice', { prompt: '_poiSatisfiedPrompt', args: [flightData], label: 'Ziel erfüllt', delayMs: 500 });
                }
            } else {
                state.altWasOk = false;

                const canComplain = inRadiusForSec >= graceSec && lastComplaintSec >= complaintIntervalSec;
                if (canComplain) {
                    if (state.attempts < maxAttempts) {
                        state.attempts++;
                        state.lastComplaintAt = now;
                        emit('log', `Höhen-Reklamation #${state.attempts} | ${altFt} ft statt ${targetAlt} ft`, 'event');
                        emit('voice', { prompt: '_poiAltComplaintPrompt', args: [flightData, altFt, targetAlt, state.attempts], label: `Höhe (${state.attempts}/${maxAttempts})`, delayMs: 500 });
                    } else {
                        emit('log', 'Max. Versuche erreicht → Abbruch', 'event');
                        state.aborted      = true;
                        state.atTargetDone = true;
                        emit('persist', 'poi-alt-aborted');
                        emit('voice', { prompt: '_poiAbortPrompt', args: [flightData], label: 'Abbruch', delayMs: 1000 });
                    }
                }
            }
        }
        advance();
        return { state, effects };
    }
    function taskItemState(outcome) {
        const normalize = (list) => [...new Set((Array.isArray(list) ? list : []).map(v => String(v || '').trim()).filter(Boolean))];
        const missing = normalize(outcome?.missingRequired);
        const dropped = normalize(outcome?.droppedRequired);
        const damaged = normalize(outcome?.damagedRequired);
        const blockingItems = [...new Set([...missing, ...dropped, ...damaged])];
        let reason = 'missing';
        if (damaged.length) reason = 'damaged';
        else if (dropped.length) reason = 'dropped';
        return { missing, dropped, damaged, blockingItems, reason };
    }

    return Object.freeze({ taskItemState, SCHEMA, createState, isState, observe, inSight,
        distanceNm: _haversineNm, bearingDeg: _bearingDeg, relativeClockPos: _relativeClockPos });
}));
