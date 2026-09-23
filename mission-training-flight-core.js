// Generated from original passenger-voice.js by tools/generate-training-flight-core.mjs. Do not edit.
'use strict';
function createState(saved = {}) {
    const e = saved.eval || {};
    return {
        preBriefDone: !!saved.preBriefDone,
        zoneStartDone: !!saved.zoneStartDone,
        landingBriefDone: !!saved.landingBriefDone,
        landingPhaseAnnounced: !!saved.landingPhaseAnnounced,
        lastDistToDestNm: saved.lastDistToDestNm == null ? null : Number(saved.lastDistToDestNm),
        eval: {
            active: !!e.active, startedAt: Number(e.startedAt || 0), samples: Number(e.samples || 0),
            minAltFt: e.minAltFt == null ? null : Number(e.minAltFt),
            maxAltFt: e.maxAltFt == null ? null : Number(e.maxAltFt),
            maxAbsBankDeg: Number(e.maxAbsBankDeg || 0), maxGForce: Number(e.maxGForce ?? 1),
            maxClimbFpm: Number(e.maxClimbFpm || 0), maxDescentFpm: Number(e.maxDescentFpm || 0),
            aoaSamples: Number(e.aoaSamples || 0), maxAoaDeg: Number(e.maxAoaDeg || 0),
            stallEvents: Number(e.stallEvents || 0), _stallPrev: !!e._stallPrev
        }
    };
}

function execute(context = {}, saved = {}, sample = {}, progress = null, now = 0, operation = 'observe') {
    const state = createState(saved);
    const cues = [];
    let _poiTrainingPreBriefDone = state.preBriefDone;
    let _poiTrainingZoneStartDone = state.zoneStartDone;
    let _poiTrainingLandingBriefDone = state.landingBriefDone;
    let _paxLandingPhaseAnnounced = state.landingPhaseAnnounced;
    let _poiTrainingLastDistToDestNm = state.lastDistToDestNm;
    let _trainingEval = { ...state.eval,
        minAltFt: state.eval.minAltFt == null ? Number.POSITIVE_INFINITY : state.eval.minAltFt,
        maxAltFt: state.eval.maxAltFt == null ? Number.NEGATIVE_INFINITY : state.eval.maxAltFt };
    const Date = { now: () => Number(now) };
    const window = { activePassenger: context.passenger || null,
        missionTrainingProcedure: { snapshot: () => progress } };
    const _activeAptTrainingPlan = () => context.trainingPlan || null;
    const _baseContext = () => context.baseContext || null;
    const _toneHint = () => context.toneHint || '';
    const _trainingProcedureSnapshot = () => progress;
    const _getDestCoords = () => context.target ? {
        lat: context.target.lat, lon: context.target.lon ?? context.target.lng
    } : null;
    const _paxLog = () => {};
    const _paxMissionTimeout = (callback, delay) => {
        const before = cues.length;
        callback();
        for (let i = before; i < cues.length; i++) cues[i].notBefore = Number(now) + delay;
    };
    const _speakAndShow = (prompt, label) => cues.push({ prompt, label });
function _trainingEvalBegin() {
    if (!_trainingEval) return;
    if (_trainingEval.active) return;
    _trainingEval.active = true;
    _trainingEval.startedAt = Date.now();
}

function _toBoolStall(v) {
    if (typeof v === 'boolean') return v;
    if (typeof v === 'number') return v > 0.5;
    const s = String(v || '').trim().toLowerCase();
    return s === '1' || s === 'true' || s === 'yes' || s === 'stall';
}

function _trainingEvalTick(flightData) {
    if (!_trainingEval || !_trainingEval.active || !flightData) return;
    const alt = Number(flightData.mslFt);
    const bank = Math.abs(Number(flightData.bankDeg || 0));
    const g = Number(flightData.gForce || 1.0);
    const vs = Number.isFinite(flightData.vsFpm) ? Number(flightData.vsFpm) : Number(flightData.vs || 0);
    if (Number.isFinite(alt)) {
        _trainingEval.minAltFt = Math.min(_trainingEval.minAltFt, alt);
        _trainingEval.maxAltFt = Math.max(_trainingEval.maxAltFt, alt);
    }
    if (Number.isFinite(bank)) _trainingEval.maxAbsBankDeg = Math.max(_trainingEval.maxAbsBankDeg, bank);
    if (Number.isFinite(g) && g > 0.1) _trainingEval.maxGForce = Math.max(_trainingEval.maxGForce, g);
    if (Number.isFinite(vs)) {
        if (vs > 0) _trainingEval.maxClimbFpm = Math.max(_trainingEval.maxClimbFpm, vs);
        if (vs < 0) _trainingEval.maxDescentFpm = Math.min(_trainingEval.maxDescentFpm, vs);
    }

    const aoa = Number(flightData.aoaDeg);
    if (Number.isFinite(aoa)) {
        _trainingEval.aoaSamples += 1;
        _trainingEval.maxAoaDeg = Math.max(_trainingEval.maxAoaDeg, Math.abs(aoa));
    }
    const stallNow = _toBoolStall(flightData.stallState);
    if (stallNow && !_trainingEval._stallPrev) _trainingEval.stallEvents += 1;
    _trainingEval._stallPrev = stallNow;
    _trainingEval.samples += 1;
}

function _trainingEvalSummary() {
    if (!_trainingEval || _trainingEval.samples < 8) return null;
    const minAlt = Number.isFinite(_trainingEval.minAltFt) ? _trainingEval.minAltFt : null;
    const maxAlt = Number.isFinite(_trainingEval.maxAltFt) ? _trainingEval.maxAltFt : null;
    const altVar = (minAlt != null && maxAlt != null) ? Math.max(0, Math.round(maxAlt - minAlt)) : null;
    const bank = Math.round(_trainingEval.maxAbsBankDeg || 0);
    const maxG = Number((_trainingEval.maxGForce || 1.0).toFixed(2));
    const climb = Math.round(_trainingEval.maxClimbFpm || 0);
    const descent = Math.round(_trainingEval.maxDescentFpm || 0);
    const aoaMax = _trainingEval.aoaSamples > 0 ? Number((_trainingEval.maxAoaDeg || 0).toFixed(1)) : null;
    const stallEvents = _trainingEval.stallEvents || 0;
    return { altVar, bank, maxG, climb, descent, aoaMax, stallEvents, samples: _trainingEval.samples };
}

function _trainingProcedureDebriefLine() {
    const snap = (typeof window.missionTrainingProcedure?.snapshot === 'function')
        ? window.missionTrainingProcedure.snapshot()
        : null;
    if (!snap || !Array.isArray(snap.exercises) || !snap.exercises.length) return '';
    const completed = snap.exercises.filter(ex => ex && ex.status === 'complete');
    if (!completed.length) {
        const active = snap.activeExercise?.label ? ` Aktive Uebung: ${snap.activeExercise.label}.` : '';
        return `\nTrainingsprozedur: noch kein sauber abgeschlossener Durchlauf.${active}`;
    }
    const bits = completed.slice(0, 6).map(ex => {
        const s = ex.summary || {};
        const label = String(ex.label || ex.id || 'Uebung').trim();
        if (ex.type === 'stall_recovery') {
            return `${label}: Hoehenverlust ab Break ${Math.round(Number(s.heightLossFt || 0))} ft`;
        }
        if (ex.type === 'constant_bank_360' || ex.type === 'turn_180') {
            const alt = Number.isFinite(Number(s.maxAltitudeDeviationFt)) ? `${Math.round(Number(s.maxAltitudeDeviationFt))} ft Hoehenabweichung` : 'Hoehe n/a';
            const hdg = Number.isFinite(Number(s.rolloutHeadingErrorDeg)) ? `Rollout ${Number(s.rolloutHeadingErrorDeg).toFixed(1)} Grad` : '';
            return `${label}: ${[alt, hdg].filter(Boolean).join(', ')}`;
        }
        if (ex.type === 'altitude_step_hold') {
            const alt = Number.isFinite(Number(s.maxAltitudeDeviationFt)) ? `${Math.round(Number(s.maxAltitudeDeviationFt))} ft Hoehenabweichung` : 'Hoehe n/a';
            const hdg = Number.isFinite(Number(s.maxHeadingDeviationDeg)) ? `Kurs max ${Number(s.maxHeadingDeviationDeg).toFixed(1)} Grad` : '';
            return `${label}: ${[alt, hdg].filter(Boolean).join(', ')}`;
        }
        return `${label}: sauber`;
    });
    return `\nTrainingsprozedur: ${completed.length}/${snap.exercises.length} Uebungen sauber abgeschlossen. ${bits.join(' | ')}.`;
}

function _poiTrainingPreZonePrompt(flightData, distNm) {
    const ctx = _baseContext();
    const plan = _activeAptTrainingPlan();
    if (!ctx || !plan) return null;
    const wx = _weatherContext(flightData);
    const focus = plan.focus.length ? plan.focus.join(', ') : 'saubere Kurs-/Höhenführung, Luftraum-Scan und stabile Fluglage';
    const distTxt = Math.max(0.2, Number(distNm || 0)).toFixed(1);
    return `${ctx}

Moment: Wir sind noch ca. ${distTxt} NM vor dem Übungsgebiet.${wx ? ' ' + wx : ''}
Der Prüfer soll jetzt sagen, dass wir gleich im Übungsgebiet sind und der Pilot seine Bereitschaft über „Übung starten“ melden soll, sobald Fluglage und Vertikalgeschwindigkeit stabil sind. Der geplante Fokus ist: ${focus}.
Keine Objektbeschreibung, kein "in Sicht", noch keine Startanweisung für ein Manöver. Max 2 Sätze.${_toneHint()}`;
}

function _trainingLandingPrepPrompt(flightData, distNm, mode, placeLabel = 'Zielflugplatz') {
    const ctx = _baseContext();
    const plan = _activeAptTrainingPlan();
    if (!ctx || !plan) return null;
    const wx = _weatherContext(flightData);
    const d = Math.max(0.2, Number(distNm || 0)).toFixed(1);
    const pattern = mode === 'pattern';
    const body = pattern
        ? `Wir sind etwa ${d} NM vor der Landung. Jetzt die Platzübung sauber anweisen und danach normal landen lassen.`
        : `Wir sind etwa ${d} NM vor der Landung. Jetzt kurze, klare Landevorbereitung geben.`;
    return `${ctx}

    Moment: Rückanflug zum ${placeLabel}.${wx ? ' ' + wx : ''}
${body} Nenne Wind/Wetter knapp und gib genau einen konkreten Tipp für den Anflug bzw. die Landung.
Ton: sachlich, instruktiv, kein Offtopic. Max 2 Sätze.${_toneHint()}`;
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

function _haversineNm(lat1, lon1, lat2, lon2) {
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2
            + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 3440.065;
}

function _trainingPoiCenterFromRoute(wps) {
    if (!Array.isArray(wps) || wps.length < 3) return null;
    const mid = wps[Math.floor((wps.length - 1) / 2)];
    const lat = Number(mid?.lat);
    const lon = Number(mid?.lng ?? mid?.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return { lat, lon };
}
    if (operation === 'debrief') return _trainingProcedureDebriefLine();
    if (operation === 'summary') return _trainingEvalSummary();
    function tick() {
      const flightData = sample || {};
      const lat = Number(flightData.lat);
      const lon = Number(flightData.lon);
      const trainingPlan = _activeAptTrainingPlan();
      const wps = context.routeWaypoints || null;
      if (trainingPlan && wps && wps.length >= 2) {
        const last = wps[wps.length - 1];
        const distNm = _haversineNm(lat, lon, last.lat, last.lng ?? last.lon);
        const isPoiMission = true;
        if (isPoiMission) {
            const dest = _getDestCoords() || _trainingPoiCenterFromRoute(wps);
            if (!dest) {
                _paxLog('POI-Training: kein gueltiger POI-Mittelpunkt fuer Trigger vorhanden', 'warn');
                return;
            }
            const distToDestNm = _haversineNm(lat, lon, dest.lat, dest.lon);
            const approaching = (_poiTrainingLastDistToDestNm == null)
                ? true
                : (distToDestNm <= (_poiTrainingLastDistToDestNm + 0.02));
            _poiTrainingLastDistToDestNm = distToDestNm;

            // 1) 4 NM vor Trainingsgebiet: Übungsbeschreibung/Einweisung
            const trainingSnapshot = _trainingProcedureSnapshot();
            const trainingNotStarted = !trainingSnapshot?.startedAt
                && !trainingSnapshot?.ready
                && !trainingSnapshot?.active;
            if (!_poiTrainingPreBriefDone && trainingNotStarted && approaching && distToDestNm <= 4.0) {
                _poiTrainingPreBriefDone = true;
                _paxLog(`Training-Trigger poi_prebrief_4nm | distDest ${distToDestNm.toFixed(2)} NM`, 'event');
                const p = _poiTrainingPreZonePrompt(flightData, distToDestNm);
                if (p) _paxMissionTimeout(() => _speakAndShow(p, 'Prüfer'), 300);
            }

            // 2) Beim Einflug in die Zone nur den Gebietsstatus setzen. Die eigentliche
            // Uebung startet ausschliesslich per Pilot-Button und kommentiert den POI nicht.
            const zoneNm = Math.max(1.2, Number(window.activePassenger?.targetRadiusNm || 0) || 0);
            if (!_poiTrainingZoneStartDone && distToDestNm <= zoneNm) {
                _poiTrainingZoneStartDone = true;
                _trainingEvalBegin();
                _paxLog(`Training-Trigger poi_zone_entry | distDest ${distToDestNm.toFixed(2)} NM`, 'event');
            }

            // 3) Rückanflug: entweder 5 NM (Pattern) oder 4 NM (normale Landung)
            if (_poiTrainingZoneStartDone && !_poiTrainingLandingBriefDone) {
                if (trainingPlan.mode === 'pattern' && distNm <= 5.0) {
                    _poiTrainingLandingBriefDone = true;
                    _paxLandingPhaseAnnounced = true;
                    _paxLog(`Training-Trigger poi_landing_pattern_5nm | distHome ${distNm.toFixed(2)} NM`, 'event');
                    const p = _trainingLandingPrepPrompt(flightData, distNm, 'pattern', 'Startflugplatz');
                    if (p) _paxMissionTimeout(() => _speakAndShow(p, 'Instruktor'), 300);
                } else if (trainingPlan.mode !== 'pattern' && distNm <= 4.0) {
                    _poiTrainingLandingBriefDone = true;
                    _paxLandingPhaseAnnounced = true;
                    _paxLog(`Training-Trigger poi_landing_4nm | distHome ${distNm.toFixed(2)} NM`, 'event');
                    const p = _trainingLandingPrepPrompt(flightData, distNm, 'landing', 'Startflugplatz');
                    if (p) _paxMissionTimeout(() => _speakAndShow(p, 'Instruktor'), 300);
                }
            }

        }
      }
      const _aptTrainingBriefDone = false;
    if (trainingPlan && (_aptTrainingBriefDone || _poiTrainingZoneStartDone)) {
        _trainingEvalBegin();
        _trainingEvalTick(flightData || window.lastLiveFlightData || {});
    }

    }
    tick();
    state.preBriefDone = _poiTrainingPreBriefDone;
    state.zoneStartDone = _poiTrainingZoneStartDone;
    state.landingBriefDone = _poiTrainingLandingBriefDone;
    state.landingPhaseAnnounced = _paxLandingPhaseAnnounced;
    state.lastDistToDestNm = _poiTrainingLastDistToDestNm;
    state.eval = { ..._trainingEval,
        minAltFt: Number.isFinite(_trainingEval.minAltFt) ? _trainingEval.minAltFt : null,
        maxAltFt: Number.isFinite(_trainingEval.maxAltFt) ? _trainingEval.maxAltFt : null };
    return { state, cues };
}
function observe(context, state, sample, progress, now) { return execute(context, state, sample, progress, now); }
function summary(state) { return execute({}, state, {}, null, 0, 'summary'); }
function debrief(progress) { return execute({}, {}, {}, progress, 0, 'debrief'); }
module.exports = { createState, observe, summary, debrief };
