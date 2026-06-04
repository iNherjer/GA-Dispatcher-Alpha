// VFR Multitool – Route Simulation Mode
// Lässt das Flugzeug autonom auf der geplanten Route fliegen.
// Injiziert Positionen in dieselben Funktionen wie das Live-GPS (updateLivePlanePosition).

(function () {
    'use strict';

    let simActive        = false;
    let simDistNM        = 0;       // aktuelle Position entlang der Route in NM
    let simSpeedFactor   = 1;       // Time-Warp-Multiplikator
    let simInterval      = null;
    let simLastTick      = null;
    let simRouteCache    = null;    // { segs, totalDist }
    let simRouteHash     = '';      // Änderungs-Erkennung
    let simPhase         = 'flight'; // start_hold | flight | end_hold
    let simHoldRemainSec = 0;
    let simStartTs       = 0;
    let simElapsedSec    = 0;
    let simMaxAltFt      = 0;
    let simTouchdownVs   = null;
    let simTrack         = [];
    let simLastTrackPt   = null;
    let simAptAtTargetTriggered = false; // pax voice: verhindert Doppel-Trigger beim Airport
    let simLandingRollTriggered = false; // pax voice: verhindert Doppel-Trigger bei Landung/Taxi
    let simWaitedForMissionStart = false;
    let simMissionEndPending = false;
    let simMissionEndRecord = null;

    const TICK_MS = 200;            // 5 Hz – flüssig genug, CPU-schonend
    const SIM_HOLD_SEC = 5;         // Boden-Standzeit vor Start / nach Landung

    // ── Public API ────────────────────────────────────────────────────────────

    window.startSimMode = function () {
        // Kein Sim-Modus wenn aktiv GPS-Daten vom Tracker ankommen (letzte 8 Sekunden)
        const lastGps = window.lastLiveGpsPos;
        if (lastGps && (Date.now() - lastGps.t < 8000)) {
            alert('Live-GPS ist aktiv – bitte erst den Tracker stoppen.');
            return;
        }
        if (simActive) { _stop(); return; }

        simRouteCache = _buildRoute();
        if (!simRouteCache || simRouteCache.totalDist < 0.5) {
            alert('Bitte zuerst eine Route mit mindestens 2 Wegpunkten planen.');
            return;
        }

        simRouteHash    = _routeHash();
        simDistNM       = 0;
        simActive       = true;
        simPhase        = 'start_hold';
        simHoldRemainSec = SIM_HOLD_SEC;
        simStartTs      = Date.now();
        simElapsedSec   = 0;
        simMaxAltFt     = 0;
        simTouchdownVs  = null;
        simTrack        = [];
        simLastTrackPt  = null;
        simAptAtTargetTriggered = false;
        simLandingRollTriggered = false;
        simWaitedForMissionStart = false;
        simMissionEndPending = false;
        simMissionEndRecord = null;
        window.simModeActive = true;
        if (typeof window.scheduleTerrainAvoidOverlayUpdate === 'function') window.scheduleTerrainAvoidOverlayUpdate(true);
        if (typeof window.terrainAvoidHandleFlightState === 'function') window.terrainAvoidHandleFlightState();
        if (typeof window.paxVoiceResetMission === 'function') window.paxVoiceResetMission();
        if (typeof window.resetMissionStartFlow === 'function') window.resetMissionStartFlow();
        console.log('[SimPax] Sim gestartet — paxVoiceEnabled:', localStorage.getItem('awm_pax_voice'), '| activePassenger:', !!window.activePassenger);
        simLastTick     = Date.now();

        _injectHold(false);                         // sofort Startposition mit 0 kn zeigen
        if (typeof window.refreshMissionRuntimeUi === 'function') window.refreshMissionRuntimeUi();
        simInterval = setInterval(_tick, TICK_MS);
        _ui(true);
    };

    window.stopSimMode = function () { _stop(); };

    window.setSimSpeed = function (x) {
        simSpeedFactor = x;
        document.querySelectorAll('.sim-spd').forEach(b => {
            b.classList.toggle('active', +b.dataset.s === x);
        });
    };

    // ── Tick ──────────────────────────────────────────────────────────────────

    function _tick() {
        const now  = Date.now();
        const dtSec = (now - simLastTick) / 1000 * simSpeedFactor;
        simLastTick = now;

        if (simPhase === 'start_hold') {
            if (_waitForManualMissionStart()) {
                simWaitedForMissionStart = true;
                simHoldRemainSec = SIM_HOLD_SEC;
                _injectHold(false);
                return;
            }
            if (simWaitedForMissionStart && simHoldRemainSec > 0.5) {
                simHoldRemainSec = 0.5;
                simWaitedForMissionStart = false;
            }
            simHoldRemainSec -= dtSec;
            _injectHold(false);
            if (simHoldRemainSec <= 0) {
                simPhase = 'flight';
                console.log('[SimPax] start_hold abgelaufen → flight. Greeting trigger...');
                if (typeof window.triggerPaxGreeting === 'function') setTimeout(window.triggerPaxGreeting, 500);
            }
            return;
        }

        if (simPhase === 'end_hold') {
            simHoldRemainSec -= dtSec;
            _injectHold(true);
            _triggerSimLandingRoll();
            if (simHoldRemainSec <= 0) {
                const rec = _buildSimRecord();
                simMissionEndPending = true;
                simMissionEndRecord = rec;
                simPhase = 'mission_end_pending';
                console.log('[SimPax] end_hold abgelaufen → Sim-Mission wartet auf explizites Missionsende.');
                if (typeof window.openMissionCargoDialog === 'function') {
                    if (typeof window.missionBushUpdateProgress === 'function') {
                        try { window.missionBushUpdateProgress(window.lastLiveGpsPos?.lat, window.lastLiveGpsPos?.lon, Date.now()); } catch (_) {}
                    }
                    const groundAction = typeof window.missionResolveGroundAction === 'function'
                        ? window.missionResolveGroundAction({ active: true, trigger: 'sim:end_hold' })
                        : null;
                    if (groundAction?.action === 'pickup') {
                        if (typeof window.gaMissionPhaseDebugRecord === 'function') {
                            try { window.gaMissionPhaseDebugRecord('dialog', { mode: 'pickup', trigger: 'sim:end_hold', phase: groundAction.phase }); } catch (_) {}
                        }
                        window.openMissionCargoDialog('pickup');
                        return;
                    }
                    if (groundAction?.action === 'unload') {
                        if (typeof window.gaMissionPhaseDebugRecord === 'function') {
                            try { window.gaMissionPhaseDebugRecord('dialog', { mode: 'unload', trigger: 'sim:end_hold', phase: groundAction.phase }); } catch (_) {}
                        }
                        window.openMissionCargoDialog('unload');
                        return;
                    }
                    if (typeof window.gaMissionPhaseDebugRecord === 'function') {
                        try {
                            window.gaMissionPhaseDebugRecord('trigger', {
                                name: 'sim:end_hold:await-explicit-end',
                                action: groundAction?.action || 'end',
                                phase: groundAction?.phase || 'mission_end_pending'
                            });
                        } catch (_) {}
                    }
                }
                return;
            }
            return;
        }

        if (simPhase === 'mission_end_pending') {
            _injectHold(true);
            return;
        }

        simDistNM += _gs() * dtSec / 3600;
        simElapsedSec += dtSec;

        // Route-Änderung erkennen (Waypoint verschoben / hinzugefügt)
        const h = _routeHash();
        if (h !== simRouteHash) {
            simRouteHash = h;
            const newCache = _buildRoute();
            if (!newCache || newCache.totalDist < 0.5) { _stop(); return; }

            // Nächsten Punkt auf der neuen Route suchen (max ~15 NM)
            const cur = _pos(simRouteCache, simDistNM);
            if (cur) {
                const nd = _nearestDist(newCache, cur.lat, cur.lon);
                simDistNM = nd !== null ? nd : 0;   // sonst: zurück zum Start
            } else {
                simDistNM = 0;
            }
            simRouteCache = newCache;
        }

        if (!simRouteCache) {
            _stop();
            return;
        }

        // Pax voice: Airport 4,0 NM vor Ziel (Anflug, nicht Landung)
        if (!_isPoiSimMission() && !simAptAtTargetTriggered && simRouteCache.totalDist > 0 &&
            simDistNM >= simRouteCache.totalDist - 4.0) {
            simAptAtTargetTriggered = true;
            const curAlt = Math.round(_alt(simDistNM, simRouteCache));
            console.log('[SimPax] Airport-Anflug 4.0 NM vor Ziel → At-Target, alt:', curAlt, 'ft');
            if (typeof window.triggerPaxAtTarget === 'function')
                window.triggerPaxAtTarget({ mslFt: curAlt, aglFt: 0, bankDeg: 0, gForce: 1.0, vsFpm: simTouchdownVs || 0 });
        }

        if (simDistNM >= simRouteCache.totalDist) {
            simDistNM = simRouteCache.totalDist;
            simPhase = 'end_hold';
            simHoldRemainSec = SIM_HOLD_SEC;
            _injectHold(true);
            _triggerSimLandingRoll();
            return;
        }

        _inject(false);
    }

    // ── Position & Daten injizieren ───────────────────────────────────────────

    function _isPoiSimMission() {
        try {
            if (typeof currentMissionData !== 'undefined' && currentMissionData && currentMissionData.poiName) return true;
            if (typeof currentDestICAO !== 'undefined' && currentDestICAO === 'POI') return true;
            const destRwy = document.getElementById('destRwyContainer');
            if (destRwy && destRwy.style.display === 'none') return true;
        } catch (_) {}
        return false;
    }

    function _triggerSimLandingRoll() {
        if (simLandingRollTriggered || _isPoiSimMission()) return;
        simLandingRollTriggered = true;
        const rec = _buildSimRecord();
        console.log('[SimPax] Sim-Landung erreicht → LandingRoll trigger. Record:', rec?.distanceNm, 'NM');
        if (typeof window.triggerPaxLandingRoll === 'function') window.triggerPaxLandingRoll(rec);
    }

    function _inject(first) {
        if (!simRouteCache) return;

        const gs  = _gs();
        const pos = _pos(simRouteCache, simDistNM);
        if (!pos) return;

        const alt = _alt(simDistNM, simRouteCache);
        simMaxAltFt = Math.max(simMaxAltFt, alt || 0);

        // VS aus Höhendifferenz über die nächsten 0.15 NM
        const fwd    = Math.min(simDistNM + 0.15, simRouteCache.totalDist - 0.01);
        const altFwd = _alt(fwd, simRouteCache);
        const vs     = (altFwd - alt) / Math.max(0.15 / gs * 60, 0.001); // ft/min
        simTouchdownVs = vs;

        // Globale EMA-Vars (aus sync.js – gleiches Script-Scope) für Profil-Icon
        smoothedGS = gs;
        smoothedVS = vs;

        // Telemetrie-Box
        const box = document.getElementById('liveTelemetryBox');
        if (box) box.style.display = 'block';
        const gsEl = document.getElementById('teleGS');
        const vsEl = document.getElementById('teleVS');
        if (gsEl) gsEl.textContent = gs.toFixed(0);
        if (vsEl) {
            vsEl.textContent = (vs >= 0 ? '+' : '') + Math.round(vs);
            vsEl.style.color = vs > 100 ? 'var(--green)' : vs < -100 ? 'var(--red)' : '#fff';
        }

        // Sim-FlightData für Passenger-Logik spiegeln (inkl. VS).
        window.lastLiveFlightData = {
            mslFt: Math.round(alt || 0),
            aglFt: 0,
            bankDeg: 0,
            gForce: 1.0,
            vsFpm: Math.round(vs || 0),
            aoaDeg: 4.0,
            stallState: false,
            windKts: null,
            windDeg: null,
            onGround: false
        };

        // Positions-Injektion → gleiche Funktion wie Live-GPS
        updateLivePlanePosition(pos.lat, pos.lon, Math.round(alt), pos.hdg);
        _recordSimTrack(pos.lat, pos.lon, alt);
    }

    function _injectHold(atEnd) {
        if (!simRouteCache) return;
        const d = atEnd ? simRouteCache.totalDist : 0;
        const pos = _pos(simRouteCache, d);
        if (!pos) return;
        const alt = _alt(d, simRouteCache);

        smoothedGS = 0;
        smoothedVS = 0;

        const box = document.getElementById('liveTelemetryBox');
        if (box) box.style.display = 'block';
        const gsEl = document.getElementById('teleGS');
        const vsEl = document.getElementById('teleVS');
        if (gsEl) gsEl.textContent = '0';
        if (vsEl) {
            vsEl.textContent = '+0';
            vsEl.style.color = '#fff';
        }

        window.lastLiveFlightData = {
            mslFt: Math.round(alt || 0),
            aglFt: 0,
            gsKts: 0,
            gs: 0,
            bankDeg: 0,
            gForce: 1.0,
            vsFpm: 0,
            aoaDeg: 3.5,
            stallState: false,
            windKts: null,
            windDeg: null,
            onGround: true
        };

        updateLivePlanePosition(pos.lat, pos.lon, Math.round(alt), pos.hdg);
        _recordSimTrack(pos.lat, pos.lon, alt, true);
    }

    // ── Stop ──────────────────────────────────────────────────────────────────

    function _stop(options = {}) {
        simActive = false;
        window.simModeActive = false;
        simMissionEndPending = false;
        simMissionEndRecord = null;
        if (typeof window.terrainAvoidPauseForSimEnd === 'function') window.terrainAvoidPauseForSimEnd();
        if (typeof window.scheduleTerrainAvoidOverlayUpdate === 'function') window.scheduleTerrainAvoidOverlayUpdate(true);
        clearInterval(simInterval);
        simInterval = null;
        simRouteCache = null;

        smoothedGS = 0;
        smoothedVS = 0;
        _fpCache = null; _fpCacheKey = '';

        if (typeof window.hideLivePlane === 'function') window.hideLivePlane({ preserveMissionRuntime: options?.preserveMissionRuntime === true });

        const box = document.getElementById('liveTelemetryBox');
        if (box) box.style.display = 'none';
        if (typeof window.hideCompassRose === 'function') window.hideCompassRose();

        // Wenn die Simulation endet, HDG-Modus sauber zurück auf ROUTE setzen.
        if (typeof window.vpEnsureRouteMode === 'function') {
            window.vpEnsureRouteMode();
        }

        _ui(false);
    }

    function _recordSimTrack(lat, lon, alt, force) {
        const now = Date.now();
        if (!force && simLastTrackPt && typeof map !== 'undefined' && map && typeof map.distance === 'function') {
            const dM = map.distance(simLastTrackPt, [lat, lon]);
            if (dM < 140) return;
        }
        if (!force && simTrack.length) {
            const prevSec = Number(simTrack[simTrack.length - 1][3] || 0);
            const curSec = Math.max(0, Math.round((now - simStartTs) / 1000));
            if (curSec <= prevSec) return; // max 1 Punkt/s
        }
        const relSec = Math.max(0, Math.round((now - simStartTs) / 1000));
        simTrack.push([Number(lat.toFixed(5)), Number(lon.toFixed(5)), Math.round(alt || 0), relSec]);
        simLastTrackPt = [lat, lon];
        if (simTrack.length > 900) {
            const compact = [];
            for (let i = 0; i < simTrack.length; i += 2) compact.push(simTrack[i]);
            simTrack = compact;
        }
    }

    function _compactSimTrack(track, maxPoints = 220) {
        const src = Array.isArray(track) ? track : [];
        if (src.length < 2) return src.slice();
        const bySec = [];
        let lastSec = null;
        for (const p of src) {
            if (!Array.isArray(p) || p.length < 4) continue;
            const sec = Number.isFinite(p[3]) ? Math.round(p[3]) : null;
            if (sec == null || sec === lastSec) continue;
            lastSec = sec;
            bySec.push([
                Number(Number(p[0]).toFixed(4)),
                Number(Number(p[1]).toFixed(4)),
                Math.round(Number(p[2]) / 10) * 10,
                sec
            ]);
        }
        if (bySec.length <= maxPoints) return bySec;
        const step = Math.ceil(bySec.length / maxPoints);
        const out = [];
        for (let i = 0; i < bySec.length; i += step) out.push(bySec[i]);
        const last = bySec[bySec.length - 1];
        if (out.length && out[out.length - 1][3] !== last[3]) out.push(last);
        return out;
    }

    function _buildSimRecord() {
        if (!simRouteCache || !simTrack.length) return null;
        const first = simTrack[0];
        const last = simTrack[simTrack.length - 1];
        const depLabel = (typeof currentStartICAO !== 'undefined' && currentStartICAO) ? currentStartICAO : 'SIM START';
        const arrLabel = (typeof currentDestICAO !== 'undefined' && currentDestICAO && currentDestICAO !== 'POI') ? currentDestICAO : 'SIM LANDING';
        const gs = _gs();
        const dist = Number(simRouteCache.totalDist || 0);
        const durSec = Math.max(1, Math.round(simElapsedSec + (SIM_HOLD_SEC * 2)));
        return {
            id: Date.now(),
            simulated: true,
            createdAt: Date.now(),
            dateLabel: new Date().toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }),
            depLabel,
            arrLabel,
            durationSec: durSec,
            distanceNm: Number(dist.toFixed(1)),
            avgGs: Number(gs.toFixed(1)),
            maxGs: Number(gs.toFixed(1)),
            maxAltFt: Math.round(simMaxAltFt || 0),
            touchdownVsFpm: Number.isFinite(simTouchdownVs) ? Math.round(simTouchdownVs) : null,
            maxClimbFpm: 0,
            maxDescentFpm: Number.isFinite(simTouchdownVs) ? Math.round(Math.min(simTouchdownVs, 0)) : 0,
            track: _compactSimTrack(simTrack, 220)
        };
    }

    function _finalizeSimMissionEnd(record) {
        const rec = record || simMissionEndRecord || _buildSimRecord();
        if (!rec) return false;
        simMissionEndPending = false;
        simMissionEndRecord = rec;
        if (typeof window.gaMissionPhaseDebugRecord === 'function') {
            try { window.gaMissionPhaseDebugRecord('trigger', { name: 'completeSimMissionEnd', distanceNm: rec?.distanceNm ?? null }); } catch (_) {}
        }
        console.log('[SimPax] Sim-Missionsende erreicht → expliziter Abschluss mit Farewell/Close-Pfad. Record:', rec?.distanceNm, 'NM');
        if (typeof _triggerPaxFarewellAndWaitForDeboard === 'function') {
            const started = _triggerPaxFarewellAndWaitForDeboard(rec, 'sim-mission-end-farewell');
            _stop({ preserveMissionRuntime: started });
            if (started) return true;
        }
        if (typeof window.missionCargoFinalizeMissionOutcome === 'function') {
            try {
                const outcome = window.missionCargoFinalizeMissionOutcome({ source: 'sim-mission-end', record: rec });
                if (outcome && typeof outcome === 'object') rec.missionCargoOutcome = outcome;
            } catch (e) {
                console.warn('[SimPax] Cargo-Finalisierung fehlgeschlagen:', e?.message || e);
            }
        }
        if (typeof window.triggerPaxFarewell === 'function') window.triggerPaxFarewell(rec);
        _stop();
        return true;
    }

    window.completeSimMissionEnd = function () {
        if (!simMissionEndPending) {
            const groundAction = typeof window.missionResolveGroundAction === 'function'
                ? window.missionResolveGroundAction({ active: true, trigger: 'completeSimMissionEnd:force-check' })
                : null;
            const phase = String(groundAction?.phase || '').trim().toLowerCase();
            const canForceArm = !!(
                simActive
                && (
                    phase === 'ready_to_close'
                    || phase === 'end_ready'
                    || (groundAction?.action === 'end' && !!phase)
                )
            );
            if (!canForceArm) return false;
            simMissionEndPending = true;
            simMissionEndRecord = simMissionEndRecord || _buildSimRecord();
            if (typeof window.gaMissionPhaseDebugRecord === 'function') {
                try {
                    window.gaMissionPhaseDebugRecord('trigger', {
                        name: 'completeSimMissionEnd:force-arm',
                        action: groundAction?.action || 'end',
                        phase: phase || 'unknown'
                    });
                } catch (_) {}
            }
        }
        return _finalizeSimMissionEnd(simMissionEndRecord || _buildSimRecord());
    };

    window.resumeSimMissionAfterPickup = function () {
        if (!simActive || !simMissionEndPending) return false;
        simMissionEndPending = false;
        simMissionEndRecord = null;
        simPhase = 'flight';
        simHoldRemainSec = 0;
        simRouteHash = _routeHash();
        simRouteCache = _buildRoute();
        if (!simRouteCache || simRouteCache.totalDist < 0.5) {
            _stop();
            return false;
        }
        if (typeof window.gaMissionPhaseDebugRecord === 'function') {
            try { window.gaMissionPhaseDebugRecord('trigger', { name: 'resumeSimMissionAfterPickup', phase: 'flight' }); } catch (_) {}
        }
        return true;
    };

    // ── Route-Helfer ──────────────────────────────────────────────────────────

    function _buildRoute() {
        if (typeof routeWaypoints === 'undefined' || !routeWaypoints ||
            routeWaypoints.length < 2) return null;

        const segs = [];
        let cum = 0;

        for (let i = 0; i < routeWaypoints.length - 1; i++) {
            const a = routeWaypoints[i];
            const b = routeWaypoints[i + 1];
            const aLon = a.lng ?? a.lon;
            const bLon = b.lng ?? b.lon;
            const nav  = calcNav(a.lat, aLon, b.lat, bLon);

            segs.push({
                fLat: a.lat, fLon: aLon,
                tLat: b.lat, tLon: bLon,
                hdg:  nav.brng,
                dist: nav.dist,
                cum               // kumulative Distanz bis zum Beginn dieses Segments
            });
            cum += nav.dist;
        }

        return { segs, totalDist: cum };
    }

    /** Interpolierte lat/lon/hdg an Distanz d entlang der Route */
    function _pos(cache, d) {
        d = Math.max(0, Math.min(d, cache.totalDist));
        for (let i = 0; i < cache.segs.length; i++) {
            const s   = cache.segs[i];
            const end = s.cum + s.dist;
            if (d <= end || i === cache.segs.length - 1) {
                const t = s.dist > 0 ? Math.min((d - s.cum) / s.dist, 1) : 0;
                return {
                    lat: s.fLat + (s.tLat - s.fLat) * t,
                    lon: s.fLon + (s.tLon - s.fLon) * t,
                    hdg: s.hdg
                };
            }
        }
        return null;
    }

    /** Nächste Distanz entlang der neuen Route zur aktuellen Position */
    function _nearestDist(cache, lat, lon) {
        let best = Infinity, bestD = null;
        for (const s of cache.segs) {
            for (let t = 0; t <= 1; t += 0.05) {
                const sLat = s.fLat + (s.tLat - s.fLat) * t;
                const sLon = s.fLon + (s.tLon - s.fLon) * t;
                const d    = Math.hypot(sLat - lat, sLon - lon);
                if (d < best) { best = d; bestD = s.cum + t * s.dist; }
            }
        }
        return best < 0.25 ? bestD : null;  // ~15 NM Schwelle, sonst zurück zum Start
    }

    function _routeHash() {
        if (typeof routeWaypoints === 'undefined' || !routeWaypoints) return '';
        return routeWaypoints
            .map(w => `${w.lat?.toFixed(4)},${(w.lng ?? w.lon)?.toFixed(4)}`)
            .join('|');
    }

    // ── Höhenberechnung ───────────────────────────────────────────────────────

    // Gecachetes Flugprofil – wird bei Routenänderung invalidiert
    let _fpCache = null;
    let _fpCacheKey = '';

    function _getFlightProfile(cruiseAlt, rate, gs) {
        const elevData = typeof vpElevationData !== 'undefined' ? vpElevationData : null;
        if (!elevData || elevData.length < 2) return null;
        // Cache-Key: Route + CRZ + V/S + GS + Segment-Alts (verschobene Segmente)
        const segKey = (typeof vpSegmentAlts !== 'undefined' && vpSegmentAlts.length > 0)
            ? vpSegmentAlts.join(',') : '';
        const wpKey = (typeof vpAltWaypoints !== 'undefined' && vpAltWaypoints.length > 0)
            ? vpAltWaypoints.map(w => `${w.distNM.toFixed(1)}:${w.altFt}`).join(',') : '';
        const key = `${_routeHash()}_${cruiseAlt}_${rate}_${Math.round(gs / 10)}_${wpKey}_${segKey}`;
        if (_fpCache && _fpCacheKey === key) return _fpCache;
        if (typeof computeFlightProfile !== 'function') return null;
        _fpCache = computeFlightProfile(elevData, cruiseAlt, rate, rate, gs);
        _fpCacheKey = key;
        return _fpCache;
    }

    function _alt(distNM, cache) {
        const cruiseAlt = parseInt(
            document.getElementById('altMapInput')?.textContent ||
            document.getElementById('altSlider')?.value || 4500
        );
        const rate = (typeof vpClimbRate !== 'undefined' && vpClimbRate > 0 ? vpClimbRate : null) ||
                     parseInt(document.getElementById('rateMapInput')?.textContent || 500);
        const gs = _gs();

        // Priorität 1: computeFlightProfile – exakt gleiche Berechnung wie das visuelle Profil
        // Berücksichtigt Flugplatz-Elevation am Start/Ziel, TOC, TOD
        const fp = _getFlightProfile(cruiseAlt, rate, gs);
        if (fp && typeof getExactAltAtDist === 'function') {
            // computeFlightProfile berücksichtigt bereits vpAltWaypoints + vpSegmentAlts —
            // getExactAltAtDist liest exakt das was die rote Linie zeichnet
            return getExactAltAtDist(distNM, fp, cruiseAlt);
        }

        // Priorität 2: Fallback ohne Terrain-Daten – Flugplatzhöhe aus elevData wenn vorhanden
        const elevData = typeof vpElevationData !== 'undefined' ? vpElevationData : null;
        const depElevFt  = elevData?.length > 0 ? (elevData[0].elevFt  ?? 0) : 0;
        const destElevFt = elevData?.length > 0 ? (elevData[elevData.length - 1].elevFt ?? 0) : 0;
        const total  = cache.totalDist;
        const climbFt = Math.max(0, cruiseAlt - depElevFt);
        const descFt  = Math.max(0, cruiseAlt - destElevFt);
        const climbNM = (climbFt / rate) * (gs / 60);
        const descNM  = (descFt  / rate) * (gs / 60);

        if (distNM <= climbNM)
            return depElevFt + (distNM / Math.max(climbNM, 0.01)) * climbFt;
        if (distNM >= total - descNM)
            return destElevFt + ((total - distNM) / Math.max(descNM, 0.01)) * descFt;
        return cruiseAlt;
    }

    function _gs() {
        return parseInt(document.getElementById('tasSlider')?.value || 115);
    }

    function _waitForManualMissionStart() {
        const md = (typeof currentMissionData !== 'undefined' && currentMissionData) ? currentMissionData : null;
        const wps = (typeof routeWaypoints !== 'undefined' && Array.isArray(routeWaypoints)) ? routeWaypoints : [];
        if (!md || wps.length < 2 || typeof window.missionRuntimeIsActive !== 'function') return false;
        return !window.missionRuntimeIsActive();
    }

    // ── UI ────────────────────────────────────────────────────────────────────

    function _ui(active) {
        const btn = document.getElementById('btnSimMode');
        if (btn) {
            btn.classList.toggle('active', active);
            btn.innerHTML = active ? '⏹&thinsp;SIM' : '▶&thinsp;SIM';
            btn.title = active ? 'Simulation stoppen' : 'Route simulieren';
            btn.onclick = function (e) {
                if (e) { e.preventDefault(); e.stopPropagation(); }
                if (active) {
                    if (typeof window.stopSimMode === 'function') window.stopSimMode();
                } else {
                    if (typeof window.startSimMode === 'function') window.startSimMode();
                }
            };
        }
        const strip = document.getElementById('simSpeedStrip');
        if (strip) strip.style.display = active ? 'flex' : 'none';
    }

})();
