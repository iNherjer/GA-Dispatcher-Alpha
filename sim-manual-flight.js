// GA Dispatcher Manual Sim Mode
// Debug tool: injects synthetic telemetry through the same path as Live GPS.

(function () {
    'use strict';

    const TICK_MS = 250;
    const STORE_KEY = 'ga_manual_sim_panel_pos_v1';
    const NM_TO_M = 1852;
    const EARTH_RADIUS_M = 6371000;

    let manualActive = false;
    let manualInterval = null;
    let manualStartTs = 0;
    let manualLastTick = 0;
    let manualLastAltFt = 0;
    let manualTrack = [];
    let manualLastTrackPt = null;
    let manualMaxAltFt = 0;
    let manualMaxGs = 0;
    let manualDistanceNm = 0;
    let manualHoldReason = '';

    const manual = {
        lat: null,
        lon: null,
        hdg: 0,
        gsKts: 0,
        mslFt: 2500,
        aglFt: 1000,
        vsFpm: 0,
        onGround: false
    };

    window.startManualSimMode = function (event) {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }
        if (manualActive) return true;

        const lastGps = window.lastLiveGpsPos;
        if (!window.simModeActive && window.liveTrackerConnected && lastGps && (Date.now() - lastGps.t < 8000)) {
            alert('Live-GPS ist aktiv - bitte erst den Tracker stoppen.');
            return false;
        }

        const autoHandoffSnapshot = window.simModeActive && !window.simManualModeActive
            ? _captureTelemetrySnapshot()
            : null;

        if (window.simModeActive && !window.simManualModeActive && typeof window.stopSimMode === 'function') {
            try { window.stopSimMode({ preserveMissionRuntime: true }); } catch (_) {}
        }

        const init = _initialPosition(autoHandoffSnapshot);
        if (!init) {
            alert('Manual Sim braucht eine Karte, Route oder letzte Position als Startpunkt.');
            return false;
        }

        manual.lat = init.lat;
        manual.lon = init.lon;
        manual.hdg = _normHdg(init.hdg ?? manual.hdg ?? 0);
        manual.mslFt = Math.max(0, Math.round(init.altFt ?? manual.mslFt ?? 2500));
        manual.gsKts = _clamp(Number(init.gsKts ?? manual.gsKts ?? 0), 0, 300);
        manual.onGround = !!init.onGround;
        manual.aglFt = manual.onGround ? 0 : _computeAglFt(manual.mslFt);
        manual.vsFpm = 0;
        manualStartTs = Date.now();
        manualLastTick = manualStartTs;
        manualLastAltFt = manual.mslFt;
        manualTrack = [];
        manualLastTrackPt = null;
        manualMaxAltFt = manual.mslFt;
        manualMaxGs = manual.gsKts;
        manualDistanceNm = 0;
        manualHoldReason = '';

        manualActive = true;
        window.simModeActive = true;
        window.simManualModeActive = true;
        window.simHadMeaningfulAirbornePhase = !manual.onGround;

        _setPanelVisible(true);
        _setManualButtonActive(true);
        _injectManualTick(true);
        if (typeof window.refreshMissionRuntimeUi === 'function') window.refreshMissionRuntimeUi();
        manualInterval = setInterval(_tickManual, TICK_MS);
        return true;
    };

    window.stopManualSimMode = function (options = {}) {
        if (!manualActive && !window.simManualModeActive) return false;
        const shouldFallbackToAuto = !!(
            options?.fallbackToAuto !== false
            && options?.keepSimMode !== true
            && options?.keepPlane !== true
            && typeof window.startSimMode === 'function'
        );
        manualActive = false;
        window.simManualModeActive = false;
        clearInterval(manualInterval);
        manualInterval = null;
        manualHoldReason = '';
        _setPanelVisible(false);
        _setManualButtonActive(false);
        if (typeof window.refreshMissionRuntimeUi === 'function') window.refreshMissionRuntimeUi();
        if (shouldFallbackToAuto) {
            const resumed = window.startSimMode({
                resumeFromCurrentPosition: true,
                allowSimGps: true,
                preserveMissionState: true
            });
            if (resumed) {
                if (!options.silent) console.log('[ManualSim] returned to auto sim');
                return true;
            }
        }
        if (!options.keepSimMode) {
            window.simModeActive = false;
            window.simHadMeaningfulAirbornePhase = false;
        }
        if (!options.keepPlane && typeof window.hideLivePlane === 'function') {
            try { window.hideLivePlane({ preserveMissionRuntime: options?.preserveMissionRuntime === true }); } catch (_) {}
        }
        if (!options.silent) console.log('[ManualSim] stopped');
        return true;
    };

    window.toggleManualSimMode = function (event) {
        if (manualActive || window.simManualModeActive) return window.stopManualSimMode();
        return window.startManualSimMode(event);
    };

    window.manualSimAdjust = function (kind, delta) {
        if (!manualActive) window.startManualSimMode();
        if (!manualActive) return false;
        const d = Number(delta) || 0;
        if (kind === 'hdg') manual.hdg = _normHdg(manual.hdg + d);
        if (kind === 'gs') manual.gsKts = _clamp(Math.round((manual.gsKts + d) / 10) * 10, 0, 300);
        if (kind === 'alt') {
            manual.mslFt = Math.max(0, Math.round((manual.mslFt + d) / 100) * 100);
            if (d > 0 && manual.onGround && manual.mslFt > _terrainFt() + 40) manual.onGround = false;
        }
        manual.aglFt = manual.onGround ? 0 : _computeAglFt(manual.mslFt);
        _injectManualTick(true);
        return true;
    };

    window.manualSimSetGround = function () {
        if (!manualActive) window.startManualSimMode();
        if (!manualActive) return false;
        manual.gsKts = 0;
        manual.onGround = true;
        manual.aglFt = 0;
        const terrain = _knownTerrainFt();
        if (Number.isFinite(terrain) && terrain >= 0) manual.mslFt = Math.max(0, Math.round(terrain));
        _injectManualTick(true);
        return true;
    };

    window.manualSimSetAirborne = function () {
        if (!manualActive) window.startManualSimMode();
        if (!manualActive) return false;
        manual.onGround = false;
        manual.aglFt = _computeAglFt(manual.mslFt);
        if (manual.aglFt < 80) {
            const terrain = _terrainFt();
            manual.mslFt = Math.max(manual.mslFt, Math.round(terrain + 500));
            manual.aglFt = _computeAglFt(manual.mslFt);
        }
        _injectManualTick(true);
        return true;
    };

    window.manualSimTriggerMissionAction = async function () {
        if (!manualActive) window.startManualSimMode();
        if (typeof window.handleMissionStartBannerAction === 'function') {
            return window.handleMissionStartBannerAction();
        }
        if (typeof window.toggleManualMissionRuntime === 'function') {
            return window.toggleManualMissionRuntime();
        }
        return false;
    };

    window.manualSimTriggerAtTarget = function () {
        if (!manualActive) window.startManualSimMode();
        if (typeof window.triggerPaxAtTarget === 'function') {
            return window.triggerPaxAtTarget(window.lastLiveFlightData || _flightDataSnapshot());
        }
        return false;
    };

    window.manualSimTriggerLandingRoll = function () {
        if (!manualActive) window.startManualSimMode();
        if (typeof window.triggerPaxLandingRoll === 'function') {
            return window.triggerPaxLandingRoll(window.manualSimBuildFlightRecord());
        }
        return false;
    };

    window.manualSimStartAuto = function () {
        if (!manualActive && !window.simManualModeActive) return false;
        if (typeof window.startSimMode !== 'function') return false;
        return window.startSimMode({
            resumeFromCurrentPosition: true,
            allowSimGps: true,
            preserveMissionState: true
        });
    };

    window.manualSimBuildFlightRecord = function () {
        if (!manualTrack.length) return null;
        const durationSec = Math.max(1, Math.round((Date.now() - manualStartTs) / 1000));
        const depLabel = (typeof currentStartICAO !== 'undefined' && currentStartICAO) ? currentStartICAO : 'MAN START';
        const md = (typeof currentMissionData !== 'undefined' && currentMissionData) ? currentMissionData : null;
        const poiLike = !!(md?.poiName || md?.poiPresentation || (typeof currentDestICAO !== 'undefined' && currentDestICAO === 'POI'));
        const arrLabel = poiLike
            ? ((typeof currentStartICAO !== 'undefined' && currentStartICAO) ? currentStartICAO : 'MAN HOME')
            : ((typeof currentDestICAO !== 'undefined' && currentDestICAO && currentDestICAO !== 'POI') ? currentDestICAO : 'MAN LANDING');
        return {
            id: Date.now(),
            simulated: true,
            manualSim: true,
            createdAt: Date.now(),
            dateLabel: new Date().toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }),
            depLabel,
            arrLabel,
            durationSec,
            distanceNm: Number(manualDistanceNm.toFixed(1)),
            avgGs: Number(_averageManualGs().toFixed(1)),
            maxGs: Number(manualMaxGs.toFixed(1)),
            maxAltFt: Math.round(manualMaxAltFt || manual.mslFt || 0),
            touchdownVsFpm: Math.round(manual.vsFpm || 0),
            maxClimbFpm: Math.max(0, Math.round(_maxTrackVs())),
            maxDescentFpm: Math.min(0, Math.round(_minTrackVs())),
            track: _compactTrack(manualTrack, 220)
        };
    };

    function _tickManual() {
        if (!manualActive) return;
        const now = Date.now();
        const dtSec = Math.max(0.05, Math.min(2, (now - manualLastTick) / 1000));
        manualLastTick = now;

        manualHoldReason = _forcedZeroReason();
        const effectiveGs = manualHoldReason ? 0 : manual.gsKts;
        if (effectiveGs > 0) {
            const next = _destinationPoint(manual.lat, manual.lon, manual.hdg, effectiveGs * dtSec / 3600);
            manual.lat = next.lat;
            manual.lon = next.lon;
        }
        manual.vsFpm = ((manual.mslFt - manualLastAltFt) / dtSec) * 60;
        manualLastAltFt = manual.mslFt;
        manual.aglFt = manual.onGround ? 0 : _computeAglFt(manual.mslFt);
        if (!manual.onGround && (manual.aglFt > 120 || effectiveGs > 35)) window.simHadMeaningfulAirbornePhase = true;
        _injectManualTick(false, effectiveGs);
    }

    function _injectManualTick(force, effectiveGsOverride = null) {
        if (!manualActive && !force) return;
        if (!Number.isFinite(manual.lat) || !Number.isFinite(manual.lon)) return;
        const gs = effectiveGsOverride !== null && Number.isFinite(Number(effectiveGsOverride))
            ? Number(effectiveGsOverride)
            : (manualHoldReason ? 0 : manual.gsKts);
        manualMaxAltFt = Math.max(manualMaxAltFt, manual.mslFt || 0);
        manualMaxGs = Math.max(manualMaxGs, gs || 0);

        try {
            smoothedGS = gs;
            smoothedVS = manual.vsFpm || 0;
        } catch (_) {}

        window.lastLiveFlightData = _flightDataSnapshot(gs);
        if (typeof updateLivePlanePosition === 'function') {
            updateLivePlanePosition(manual.lat, manual.lon, Math.round(manual.mslFt), Math.round(manual.hdg));
        }
        _recordManualTrack(manual.lat, manual.lon, manual.mslFt, gs, force);
        _updateLiveTelemetryBox(gs);
        _updatePanel();
    }

    function _flightDataSnapshot(gsOverride = null) {
        const gs = Number.isFinite(Number(gsOverride)) ? Number(gsOverride) : (manualHoldReason ? 0 : manual.gsKts);
        return {
            mslFt: Math.round(manual.mslFt || 0),
            aglFt: Math.max(0, Math.round(manual.aglFt || 0)),
            gsKts: Math.max(0, Math.round(gs * 10) / 10),
            gs: Math.max(0, Math.round(gs * 10) / 10),
            bankDeg: 0,
            gForce: 1.0,
            vsFpm: Math.round(manual.vsFpm || 0),
            aoaDeg: manual.onGround ? 0 : 4.0,
            stallState: false,
            windKts: null,
            windDeg: null,
            onGround: !!manual.onGround,
            parkingBrake: !!manual.onGround && gs <= 1
        };
    }

    function _captureTelemetrySnapshot() {
        const fd = window.lastLiveFlightData;
        const pos = window.lastLiveGpsPos;
        return {
            fd: fd && typeof fd === 'object' ? { ...fd } : null,
            pos: pos && typeof pos === 'object' ? { ...pos } : null
        };
    }

    function _initialPosition(snapshot = null) {
        const fd = snapshot?.fd || window.lastLiveFlightData || {};
        const pos = snapshot?.pos || window.lastLiveGpsPos || {};
        const lat = Number(pos.lat);
        const lon = Number(pos.lon);
        if (Number.isFinite(lat) && Number.isFinite(lon)) {
            const fdGs = Number.isFinite(Number(fd.gsKts)) ? Number(fd.gsKts)
                : (Number.isFinite(Number(fd.gs)) ? Number(fd.gs) : null);
            const posGs = Number.isFinite(Number(pos.gsKts)) ? Number(pos.gsKts)
                : (Number.isFinite(Number(pos.gs)) ? Number(pos.gs) : 0);
            return {
                lat,
                lon,
                hdg: Number.isFinite(Number(pos.hdg)) ? Number(pos.hdg) : 0,
                altFt: Number.isFinite(Number(fd.mslFt)) ? Number(fd.mslFt) : Number(pos.alt || 2500),
                gsKts: fdGs !== null ? fdGs : posGs,
                onGround: !!fd.onGround
            };
        }
        const wps = (typeof routeWaypoints !== 'undefined' && Array.isArray(routeWaypoints)) ? routeWaypoints : [];
        const first = wps[0] || null;
        if (first && Number.isFinite(Number(first.lat)) && Number.isFinite(Number(first.lng ?? first.lon))) {
            const next = wps[1] || null;
            let hdg = 0;
            if (next && typeof calcNav === 'function') {
                try { hdg = calcNav(Number(first.lat), Number(first.lng ?? first.lon), Number(next.lat), Number(next.lng ?? next.lon))?.brng || 0; } catch (_) {}
            }
            return {
                lat: Number(first.lat),
                lon: Number(first.lng ?? first.lon),
                hdg,
                altFt: Number(first.altFt ?? first.elevationFt ?? first.elevation ?? 2500),
                gsKts: 0,
                onGround: true
            };
        }
        if (typeof map !== 'undefined' && map && typeof map.getCenter === 'function') {
            const c = map.getCenter();
            if (c && Number.isFinite(Number(c.lat)) && Number.isFinite(Number(c.lng))) {
                return { lat: Number(c.lat), lon: Number(c.lng), hdg: 0, altFt: 2500, gsKts: 0, onGround: false };
            }
        }
        return null;
    }

    function _terrainFt() {
        const known = _knownTerrainFt();
        return Number.isFinite(known) ? known : 0;
    }

    function _knownTerrainFt() {
        const t = Number(window.lastLiveTerrainFt);
        if (Number.isFinite(t) && t >= 0) return t;
        const md = (typeof currentMissionData !== 'undefined' && currentMissionData) ? currentMissionData : null;
        const fallback = Number(md?.poiTerrainFt ?? md?.targetAltFt);
        return Number.isFinite(fallback) && fallback >= 0 ? fallback : null;
    }

    function _computeAglFt(mslFt) {
        const agl = Number(mslFt) - _terrainFt();
        return Math.max(0, Math.round(Number.isFinite(agl) ? agl : Number(mslFt || 0)));
    }

    function _forcedZeroReason() {
        const overlay = document.getElementById('missionCargoOverlay');
        if (overlay && getComputedStyle(overlay).display !== 'none' && overlay.getClientRects().length > 0) return 'Load/Pickup';
        const st = window.missionSceneStatus || {};
        if (st.boardingRequested || st.boardingActive) return 'Boarding';
        if (st.deboardingRequested || st.deboardingActive) return 'Deboarding';
        return '';
    }

    function _recordManualTrack(lat, lon, alt, gs, force) {
        const now = Date.now();
        if (!force && manualLastTrackPt) {
            const dNm = _distanceNm(manualLastTrackPt[0], manualLastTrackPt[1], lat, lon);
            if (dNm < 0.04 && manualTrack.length) {
                const prev = manualTrack[manualTrack.length - 1];
                if (prev) {
                    prev[2] = Math.round(alt || 0);
                    prev[4] = Math.round(gs || 0);
                }
                return;
            }
            manualDistanceNm += dNm;
        }
        const sec = Math.max(0, Math.round((now - manualStartTs) / 1000));
        manualTrack.push([Number(lat.toFixed(5)), Number(lon.toFixed(5)), Math.round(alt || 0), sec, Math.round(gs || 0), Math.round(manual.vsFpm || 0)]);
        manualLastTrackPt = [lat, lon];
        if (manualTrack.length > 1200) {
            const compact = [];
            for (let i = 0; i < manualTrack.length; i += 2) compact.push(manualTrack[i]);
            manualTrack = compact;
        }
    }

    function _averageManualGs() {
        if (!manualTrack.length) return manual.gsKts || 0;
        const sum = manualTrack.reduce((acc, p) => acc + (Number(p?.[4]) || 0), 0);
        return sum / manualTrack.length;
    }

    function _maxTrackVs() {
        return manualTrack.reduce((max, p) => Math.max(max, Number(p?.[5]) || 0), 0);
    }

    function _minTrackVs() {
        return manualTrack.reduce((min, p) => Math.min(min, Number(p?.[5]) || 0), 0);
    }

    function _compactTrack(track, maxPoints = 220) {
        const src = Array.isArray(track) ? track : [];
        if (src.length <= maxPoints) return src.map(_compactPoint);
        const step = Math.ceil(src.length / maxPoints);
        const out = [];
        for (let i = 0; i < src.length; i += step) out.push(_compactPoint(src[i]));
        const last = src[src.length - 1];
        if (out.length && last && out[out.length - 1][3] !== last[3]) out.push(_compactPoint(last));
        return out;
    }

    function _compactPoint(p) {
        return [
            Number(Number(p?.[0] || 0).toFixed(4)),
            Number(Number(p?.[1] || 0).toFixed(4)),
            Math.round(Number(p?.[2] || 0) / 10) * 10,
            Math.round(Number(p?.[3] || 0))
        ];
    }

    function _updateLiveTelemetryBox(gs) {
        const box = document.getElementById('liveTelemetryBox');
        if (box) box.style.display = 'block';
        const gsEl = document.getElementById('teleGS');
        const vsEl = document.getElementById('teleVS');
        if (gsEl) gsEl.textContent = String(Math.round(gs || 0));
        if (vsEl) {
            const vs = Math.round(manual.vsFpm || 0);
            vsEl.textContent = (vs >= 0 ? '+' : '') + vs;
            vsEl.style.color = vs > 100 ? 'var(--green)' : vs < -100 ? 'var(--red)' : '#fff';
        }
    }

    function _updatePanel() {
        _setText('manualSimHdgValue', `${Math.round(manual.hdg).toString().padStart(3, '0')} deg`);
        _setText('manualSimGsValue', `${Math.round(manualHoldReason ? 0 : manual.gsKts)} kt`);
        _setText('manualSimAltValue', `${Math.round(manual.mslFt)} ft`);
        _setText('manualSimAglValue', `${Math.round(manual.aglFt)} ft AGL`);
        _setText('manualSimModeValue', manual.onGround ? 'GROUND' : 'AIR');
        _setText('manualSimHoldValue', manualHoldReason ? `0 kt: ${manualHoldReason}` : 'frei');
    }

    function _setPanelVisible(visible) {
        const panel = document.getElementById('manualSimPanel');
        if (!panel) return;
        panel.style.display = visible ? 'block' : 'none';
        panel.setAttribute('aria-hidden', visible ? 'false' : 'true');
        if (visible) {
            _restorePanelPosition(panel);
            _updatePanel();
        }
    }

    function _setManualButtonActive(active) {
        document.querySelectorAll('.manual-sim-toggle').forEach((btn) => {
            btn.classList.toggle('active', !!active);
            btn.title = active ? 'Manuellen Sim stoppen' : 'Manueller Sim';
        });
    }

    function _setText(id, text) {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    }

    function _bindUi() {
        const panel = document.getElementById('manualSimPanel');
        if (!panel) return;
        const header = document.getElementById('manualSimPanelHeader');
        if (header) _bindPanelDrag(panel, header);
        _updatePanel();
    }

    function _bindPanelDrag(panel, handle) {
        let drag = null;
        handle.addEventListener('pointerdown', (ev) => {
            if (ev.target && ev.target.closest('button')) return;
            const rect = panel.getBoundingClientRect();
            drag = {
                dx: ev.clientX - rect.left,
                dy: ev.clientY - rect.top
            };
            panel.classList.add('manual-sim-dragging');
            panel.style.right = 'auto';
            panel.style.left = `${Math.round(rect.left)}px`;
            panel.style.top = `${Math.round(rect.top)}px`;
            try { handle.setPointerCapture(ev.pointerId); } catch (_) {}
            ev.preventDefault();
            ev.stopPropagation();
        }, { passive: false });
        handle.addEventListener('pointermove', (ev) => {
            if (!drag) return;
            const maxLeft = Math.max(0, window.innerWidth - panel.offsetWidth - 8);
            const maxTop = Math.max(0, window.innerHeight - panel.offsetHeight - 8);
            const minLeft = Math.min(8, maxLeft);
            const minTop = Math.min(8, maxTop);
            const left = _clamp(ev.clientX - drag.dx, minLeft, maxLeft);
            const top = _clamp(ev.clientY - drag.dy, minTop, maxTop);
            panel.style.left = `${Math.round(left)}px`;
            panel.style.top = `${Math.round(top)}px`;
            ev.preventDefault();
            ev.stopPropagation();
        }, { passive: false });
        const finish = (ev) => {
            if (!drag) return;
            drag = null;
            panel.classList.remove('manual-sim-dragging');
            try {
                localStorage.setItem(STORE_KEY, JSON.stringify({
                    left: parseInt(panel.style.left, 10) || 0,
                    top: parseInt(panel.style.top, 10) || 0
                }));
            } catch (_) {}
            if (ev) ev.stopPropagation();
        };
        handle.addEventListener('pointerup', finish);
        handle.addEventListener('pointercancel', finish);
        window.addEventListener('resize', () => _restorePanelPosition(panel, true));
    }

    function _restorePanelPosition(panel, clampOnly = false) {
        let pos = null;
        try { pos = JSON.parse(localStorage.getItem(STORE_KEY) || 'null'); } catch (_) {}
        if (!clampOnly && pos && Number.isFinite(Number(pos.left)) && Number.isFinite(Number(pos.top))) {
            panel.style.right = 'auto';
            panel.style.left = `${Math.round(Number(pos.left))}px`;
            panel.style.top = `${Math.round(Number(pos.top))}px`;
        }
        if (!panel.style.left || panel.style.right) return;
        const maxLeft = Math.max(0, window.innerWidth - panel.offsetWidth - 8);
        const maxTop = Math.max(0, window.innerHeight - panel.offsetHeight - 8);
        const minLeft = Math.min(8, maxLeft);
        const minTop = Math.min(8, maxTop);
        panel.style.left = `${Math.round(_clamp(parseInt(panel.style.left, 10) || minLeft, minLeft, maxLeft))}px`;
        panel.style.top = `${Math.round(_clamp(parseInt(panel.style.top, 10) || minTop, minTop, maxTop))}px`;
    }

    function _destinationPoint(lat, lon, hdgDeg, distNm) {
        const brng = _degToRad(hdgDeg);
        const d = (Number(distNm) || 0) * NM_TO_M / EARTH_RADIUS_M;
        const lat1 = _degToRad(lat);
        const lon1 = _degToRad(lon);
        const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(brng));
        const lon2 = lon1 + Math.atan2(
            Math.sin(brng) * Math.sin(d) * Math.cos(lat1),
            Math.cos(d) - Math.sin(lat1) * Math.sin(lat2)
        );
        return {
            lat: _radToDeg(lat2),
            lon: ((_radToDeg(lon2) + 540) % 360) - 180
        };
    }

    function _distanceNm(lat1, lon1, lat2, lon2) {
        const aLat = _degToRad(lat1);
        const bLat = _degToRad(lat2);
        const dLat = _degToRad(lat2 - lat1);
        const dLon = _degToRad(lon2 - lon1);
        const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat) * Math.cos(bLat) * Math.sin(dLon / 2) ** 2;
        return (2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)) * EARTH_RADIUS_M) / NM_TO_M;
    }

    function _normHdg(value) {
        const n = Number(value) || 0;
        return ((n % 360) + 360) % 360;
    }

    function _clamp(value, min, max) {
        const n = Number(value);
        if (!Number.isFinite(n)) return min;
        return Math.max(min, Math.min(max, n));
    }

    function _degToRad(deg) { return Number(deg || 0) * Math.PI / 180; }
    function _radToDeg(rad) { return Number(rad || 0) * 180 / Math.PI; }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', _bindUi);
    else _bindUi();
})();
