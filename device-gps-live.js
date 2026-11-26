/* Hidden device-GPS live mode (web only).
 * Hold the "?" button in the map toolbar for 5 s to switch it on or off.
 * The state lives in memory only, so a restart of the app always switches it off.
 * Position and altitude of the device are fed into the same path the tracker
 * uses (updateLivePlanePosition). The tracker and the sim mode always win:
 * while either is live, device fixes are ignored. Mission triggers stay off
 * (see _runLiveMissionTriggerTick in sync.js). */
(function () {
    'use strict';
    const HOLD_MS = 5000;
    const M_TO_FT = 3.28084;
    const MS_TO_KT = 1.943844;
    const MIN_MOVE_FOR_HEADING_M = 8;

    let active = false;
    let watchId = null;
    let wakeLock = null;
    let lastFix = null;      // { lat, lon, altFt, hdg }
    let holdTimer = null;
    let holdReached = false;
    let suppressClickUntil = 0;

    function toast(text) {
        if (typeof window.showMapToast === 'function') window.showMapToast(text);
        else console.info('[DEVICE GPS]', text);
    }

    function trackerOrSimLive() {
        if (window.simModeActive) return true;
        return document.getElementById('liveGpsIndicator')?.dataset?.trackerState === 'live';
    }

    function bearing(a, b) {
        const r = Math.PI / 180;
        const y = Math.sin((b.lon - a.lon) * r) * Math.cos(b.lat * r);
        const x = Math.cos(a.lat * r) * Math.sin(b.lat * r)
            - Math.sin(a.lat * r) * Math.cos(b.lat * r) * Math.cos((b.lon - a.lon) * r);
        return (Math.atan2(y, x) / r + 360) % 360;
    }

    function distanceM(a, b) {
        const r = Math.PI / 180;
        const dLat = (b.lat - a.lat) * r, dLon = (b.lon - a.lon) * r;
        const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2;
        return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
    }

    function onFix(pos) {
        if (!active || trackerOrSimLive()) return;
        const c = pos.coords || {};
        const lat = Number(c.latitude), lon = Number(c.longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
        const altFt = Number.isFinite(c.altitude) && c.altitude !== null
            ? Math.round(c.altitude * M_TO_FT)
            : (lastFix ? lastFix.altFt : 0);
        let hdg = lastFix ? lastFix.hdg : 0;
        if (Number.isFinite(c.heading) && c.heading !== null && Number(c.speed) > 0.5) {
            hdg = c.heading;
        } else if (lastFix && distanceM(lastFix, { lat, lon }) >= MIN_MOVE_FOR_HEADING_M) {
            hdg = bearing(lastFix, { lat, lon });
        }
        const flight = { source: 'device-gps', mslFt: altFt };
        if (Number.isFinite(c.speed) && c.speed !== null) {
            flight.gsKts = Math.max(0, c.speed * MS_TO_KT);
            flight.gs = flight.gsKts;
        }
        window.lastLiveFlightData = flight;
        if (!lastFix || distanceM(lastFix, { lat, lon }) >= MIN_MOVE_FOR_HEADING_M || hdg !== lastFix.hdg) {
            lastFix = { lat, lon, altFt, hdg };
        } else {
            lastFix.altFt = altFt;
        }
        if (typeof window.updateLivePlanePosition === 'function') {
            window.updateLivePlanePosition(lat, lon, altFt, Math.round(hdg));
        } else if (typeof updateLivePlanePosition === 'function') {
            updateLivePlanePosition(lat, lon, altFt, Math.round(hdg)); // eslint-disable-line no-undef
        }
    }

    function onError(err) {
        if (!active) return;
        if (err && err.code === 1) {
            toast('📱 Geräte-GPS: Standortzugriff verweigert');
            stop(true);
        } else {
            console.warn('[DEVICE GPS] Fehler', err && err.message);
        }
    }

    async function requestWakeLock() {
        try {
            if (navigator.wakeLock && document.visibilityState === 'visible') {
                wakeLock = await navigator.wakeLock.request('screen');
            }
        } catch (_) { wakeLock = null; }
    }

    function start() {
        if (!('geolocation' in navigator)) { toast('📱 Geräte-GPS: auf diesem Gerät nicht verfügbar'); return; }
        active = true;
        lastFix = null;
        watchId = navigator.geolocation.watchPosition(onFix, onError, {
            enableHighAccuracy: true, maximumAge: 0, timeout: 20000
        });
        requestWakeLock();
        document.body.classList.add('device-gps-live');
        toast(trackerOrSimLive()
            ? '📱 Geräte-GPS AN (Tracker/Sim hat Vorrang)'
            : '📱 Geräte-GPS AN');
    }

    function stop(silent) {
        const wasFeeding = !!lastFix;
        active = false;
        if (watchId !== null) { try { navigator.geolocation.clearWatch(watchId); } catch (_) {} }
        watchId = null;
        lastFix = null;
        if (wakeLock) { try { wakeLock.release(); } catch (_) {} wakeLock = null; }
        document.body.classList.remove('device-gps-live');
        if (wasFeeding && !trackerOrSimLive() && typeof window.hideLivePlane === 'function') {
            window.hideLivePlane({ preserveMissionRuntime: true });
        }
        if (!silent) toast('📱 Geräte-GPS AUS');
    }

    function toggle() { if (active) stop(false); else start(); }

    window.gaDeviceGpsLiveActive = function () { return active && !!lastFix && !trackerOrSimLive(); };

    document.addEventListener('visibilitychange', () => {
        if (active && !wakeLock && document.visibilityState === 'visible') requestWakeLock();
    });

    // --- 5-s long press on the map toolbar "?" -------------------------------
    function helpButtonFrom(target) {
        return target && target.closest ? target.closest('.map-toolbar-help-btn') : null;
    }
    function cancelHold() {
        if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
    }
    document.addEventListener('pointerdown', (ev) => {
        const btn = helpButtonFrom(ev.target);
        if (!btn) return;
        cancelHold();
        holdReached = false;
        holdTimer = setTimeout(() => {
            holdTimer = null;
            holdReached = true;
            try { navigator.vibrate && navigator.vibrate(60); } catch (_) {}
            btn.classList.add('device-gps-hold-ready');
        }, HOLD_MS);
    }, true);
    ['pointercancel', 'pointerleave'].forEach((type) => {
        document.addEventListener(type, (ev) => {
            const btn = helpButtonFrom(ev.target);
            if (!btn) return;
            cancelHold();
            if (type === 'pointercancel' && holdReached) {
                holdReached = false;
                btn.classList.remove('device-gps-hold-ready');
            }
        }, true);
    });
    document.addEventListener('pointerup', (ev) => {
        const btn = helpButtonFrom(ev.target);
        cancelHold();
        if (!holdReached) return;
        holdReached = false;
        document.querySelectorAll('.device-gps-hold-ready').forEach((el) => el.classList.remove('device-gps-hold-ready'));
        if (!btn) return;
        // Toggle on release, inside the user gesture (permission prompt on iOS).
        suppressClickUntil = Date.now() + 800;
        toggle();
    }, true);
    // The long press must not also open the help.
    document.addEventListener('click', (ev) => {
        if (Date.now() > suppressClickUntil || !helpButtonFrom(ev.target)) return;
        suppressClickUntil = 0;
        ev.preventDefault();
        ev.stopImmediatePropagation();
    }, true);
    document.addEventListener('contextmenu', (ev) => {
        if (helpButtonFrom(ev.target)) ev.preventDefault();
    }, true);
})();
