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

    const TICK_MS = 200;            // 5 Hz – flüssig genug, CPU-schonend

    // ── Public API ────────────────────────────────────────────────────────────

    window.startSimMode = function () {
        // Kein Sim-Modus wenn Live-GPS verbunden
        if (typeof liveGpsSocket !== 'undefined' && liveGpsSocket &&
            liveGpsSocket.readyState === 1 /* OPEN */) {
            alert('Live-GPS ist aktiv – bitte erst trennen, dann simulieren.');
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
        window.simModeActive = true;
        simLastTick     = Date.now();

        _inject(true);                              // sofort erste Position zeigen
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

        simDistNM += _gs() * dtSec / 3600;

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

        if (!simRouteCache || simDistNM >= simRouteCache.totalDist) {
            _stop();
            return;
        }

        _inject(false);
    }

    // ── Position & Daten injizieren ───────────────────────────────────────────

    function _inject(first) {
        if (!simRouteCache) return;

        const gs  = _gs();
        const pos = _pos(simRouteCache, simDistNM);
        if (!pos) return;

        const alt = _alt(simDistNM, simRouteCache);

        // VS aus Höhendifferenz über die nächsten 0.15 NM
        const fwd    = Math.min(simDistNM + 0.15, simRouteCache.totalDist - 0.01);
        const altFwd = _alt(fwd, simRouteCache);
        const vs     = (altFwd - alt) / Math.max(0.15 / gs * 60, 0.001); // ft/min

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

        // Positions-Injektion → gleiche Funktion wie Live-GPS
        updateLivePlanePosition(pos.lat, pos.lon, Math.round(alt), pos.hdg);
    }

    // ── Stop ──────────────────────────────────────────────────────────────────

    function _stop() {
        simActive = false;
        window.simModeActive = false;
        clearInterval(simInterval);
        simInterval = null;
        simRouteCache = null;

        smoothedGS = 0;
        smoothedVS = 0;

        if (typeof window.hideLivePlane === 'function') window.hideLivePlane();

        const box = document.getElementById('liveTelemetryBox');
        if (box) box.style.display = 'none';

        _ui(false);
    }

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

    function _alt(distNM, cache) {
        // Priorität 1: Nutzer hat Höhenwegpunkte im Profil gesetzt
        if (typeof vpAltWaypoints !== 'undefined' && vpAltWaypoints.length >= 2) {
            const wps = vpAltWaypoints;
            if (distNM <= wps[0].distNM) return wps[0].altFt;
            if (distNM >= wps[wps.length - 1].distNM) return wps[wps.length - 1].altFt;
            for (let i = 0; i < wps.length - 1; i++) {
                const a = wps[i], b = wps[i + 1];
                if (distNM >= a.distNM && distNM <= b.distNM) {
                    const t = (distNM - a.distNM) / (b.distNM - a.distNM);
                    return a.altFt + (b.altFt - a.altFt) * t;
                }
            }
        }

        // Priorität 2: Einfaches Climb / Cruise / Descend
        const cruiseAlt = parseInt(
            document.getElementById('altMapInput')?.textContent ||
            document.getElementById('altSlider')?.value || 4500
        );
        const rate = (typeof vpClimbRate !== 'undefined' ? vpClimbRate : null) ||
                     parseInt(document.getElementById('rateMapInput')?.textContent || 500);
        const gs    = _gs();
        const total = cache.totalDist;

        const climbNM = (cruiseAlt / rate) * (gs / 60);
        const descNM  = (cruiseAlt / rate) * (gs / 60);

        if (distNM <= climbNM)
            return Math.max(0, (distNM / Math.max(climbNM, 0.01)) * cruiseAlt);
        if (distNM >= total - descNM)
            return Math.max(0, ((total - distNM) / Math.max(descNM, 0.01)) * cruiseAlt);
        return cruiseAlt;
    }

    function _gs() {
        return parseInt(document.getElementById('tasSlider')?.value || 115);
    }

    // ── UI ────────────────────────────────────────────────────────────────────

    function _ui(active) {
        const btn = document.getElementById('btnSimMode');
        if (btn) {
            btn.classList.toggle('active', active);
            btn.innerHTML = active ? '⏹&thinsp;SIM' : '▶&thinsp;SIM';
            btn.title = active ? 'Simulation stoppen' : 'Route simulieren';
        }
        const strip = document.getElementById('simSpeedStrip');
        if (strip) strip.style.display = active ? 'flex' : 'none';
    }

})();
