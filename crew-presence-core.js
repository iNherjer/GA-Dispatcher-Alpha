/* Crew presence: online status and the current flight of crew members.
 * Shared by the tracker (sends status beats), the web app (shows the crew
 * board, sends beats only when no tracker is connected) and the worker tests.
 *
 * Load budget: one beat every BEAT_INTERVAL_MS while running, plus one beat
 * on a flight event (start, phase change, landing, end), never closer than
 * MIN_EVENT_GAP_MS. The worker stores a beat only when something changed or
 * the stored one is older than STORE_REFRESH_MS. */
(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    root.GACrewPresenceCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    const BEAT_INTERVAL_MS = 5 * 60 * 1000;
    const MIN_EVENT_GAP_MS = 60 * 1000;
    const ONLINE_WINDOW_MS = 12 * 60 * 1000;
    const LANDED_VISIBLE_MS = 30 * 60 * 1000;
    const STORE_REFRESH_MS = 4 * 60 * 1000;
    const PROGRESS_STEP = 0.05;
    const PHASES = ['ground', 'taxi', 'climb', 'cruise', 'descent', 'landed'];
    const PHASE_LABEL = {
        ground: 'Am Boden', taxi: 'Rollt', climb: 'Steigflug',
        cruise: 'Reiseflug', descent: 'Sinkflug', landed: 'Gelandet'
    };
    const KINDS = ['mission', 'free'];

    function text(value, max) {
        return String(value == null ? '' : value).replace(/\s+/g, ' ').trim().slice(0, max);
    }
    function finite(value) {
        if (value === null || value === undefined || value === '') return null;
        const n = Number(value);
        return Number.isFinite(n) ? n : null;
    }

    // Sharing switches live in the profile as crewShare { online, flight, at }; both default on.
    // `at` is when the pilot last changed them, so the newest choice wins between devices.
    function normalizeShare(value) {
        const src = value && typeof value === 'object' ? value : {};
        const at = Math.max(0, Math.round(finite(src.at) || 0));
        return { online: src.online !== false, flight: src.flight !== false, at };
    }

    // Server side: combine an incoming beat with the stored record.
    // A web beat never replaces the flight of a tracker that is still reporting.
    function mergeBeat(stored, beat, now) {
        const t = Number(now) || Date.now();
        const incoming = normalizeShare(beat?.share);
        const kept = stored ? normalizeShare(stored.share) : null;
        const share = kept && kept.at > incoming.at ? kept : incoming;
        const trackerLive = stored?.source === 'tracker' && t - Number(stored.seenAt || 0) <= ONLINE_WINDOW_MS;
        if (beat?.source === 'web' && trackerLive) {
            return { ...stored, nick: beat.nick, share };
        }
        return { pilotId: beat.pilotId, nick: beat.nick, source: beat.source, share, flight: beat.flight || null };
    }

    function point(value) {
        const lat = finite(value?.lat);
        const lon = finite(value?.lon ?? value?.lng);
        return lat === null || lon === null ? null : { lat, lon };
    }

    function distanceNm(a, b) {
        const toRad = Math.PI / 180;
        const dLat = (b.lat - a.lat) * toRad;
        const dLon = (b.lon - a.lon) * toRad;
        const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * toRad) * Math.cos(b.lat * toRad) * Math.sin(dLon / 2) ** 2;
        return 3440.065 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
    }

    // Progress along the route (0..1). Local flat projection per leg is precise enough
    // for a progress bar. `fromLeg` keeps loops (POI chains, return home) from jumping back.
    function routeProgress(waypoints, position, fromLeg = 0) {
        const pts = (Array.isArray(waypoints) ? waypoints : []).map(point).filter(Boolean);
        const pos = point(position);
        if (pts.length < 2 || !pos) return null;
        const legs = [];
        let total = 0;
        for (let i = 0; i < pts.length - 1; i++) {
            const len = distanceNm(pts[i], pts[i + 1]);
            legs.push({ a: pts[i], b: pts[i + 1], len, start: total });
            total += len;
        }
        if (total < 0.1) return null;
        const first = Math.max(0, Math.min(legs.length - 1, Math.floor(Number(fromLeg) || 0)));
        const last = Math.min(legs.length - 1, first + 2);
        let best = null;
        for (let i = first; i <= last; i++) {
            const leg = legs[i];
            const k = Math.cos(leg.a.lat * Math.PI / 180);
            const bx = (leg.b.lon - leg.a.lon) * k, by = leg.b.lat - leg.a.lat;
            const px = (pos.lon - leg.a.lon) * k, py = pos.lat - leg.a.lat;
            const lenSq = bx * bx + by * by;
            const t = lenSq > 0 ? Math.max(0, Math.min(1, (px * bx + py * by) / lenSq)) : 0;
            const off = (px - t * bx) ** 2 + (py - t * by) ** 2;
            if (!best || off < best.off) best = { off, leg: i, along: leg.start + t * leg.len };
        }
        // offNm: distance from the route; a far-away aircraft is not flying this route.
        return { progress: Math.max(0, Math.min(1, best.along / total)), leg: best.leg, totalNm: Math.round(total * 10) / 10, offNm: Math.round(Math.sqrt(best.off) * 60 * 10) / 10 };
    }

    // Phase from telemetry. `airborneBefore` turns "on ground" after a flight into "landed".
    function flightPhase(sample, airborneBefore = false) {
        if (!sample || typeof sample !== 'object') return null;
        const gs = finite(sample.gsKts ?? sample.gs) ?? 0;
        const vs = finite(sample.vsFpm) ?? 0;
        if (sample.onGround) {
            if (airborneBefore) return 'landed';
            return gs >= 3 ? 'taxi' : 'ground';
        }
        if (vs > 400) return 'climb';
        if (vs < -400) return 'descent';
        return 'cruise';
    }

    // Bounded flight snapshot: the only flight data that leaves the pilot's PC.
    function cleanFlight(flight) {
        if (!flight || typeof flight !== 'object') return null;
        const kind = KINDS.includes(flight.kind) ? flight.kind : null;
        const id = text(flight.id, 120);
        if (!kind || !id) return null;
        const phase = PHASES.includes(flight.phase) ? flight.phase : 'ground';
        const progress = finite(flight.progress);
        const out = {
            kind, id, phase,
            title: text(flight.title, 120),
            dep: text(flight.dep, 12), depName: text(flight.depName, 60),
            dest: text(flight.dest, 12), destName: text(flight.destName, 60),
            startedAt: Math.max(0, Math.round(finite(flight.startedAt) || 0)),
            takeoffAt: Math.max(0, Math.round(finite(flight.takeoffAt) || 0)),
            endedAt: Math.max(0, Math.round(finite(flight.endedAt) || 0)),
            progress: progress === null ? null : Math.round(Math.max(0, Math.min(1, progress)) * 100) / 100
        };
        const aircraft = text(flight.aircraft, 40);
        if (aircraft) out.aircraft = aircraft;
        const pos = cleanPosition(flight.pos);
        if (pos) out.pos = pos;
        const route = cleanRoute(flight.route);
        if (route.length >= 2) out.route = route;
        return out;
    }

    const round = (value, digits) => Math.round(value * 10 ** digits) / 10 ** digits;

    // Position at the time of the beat (detail map on the crew board).
    function cleanPosition(value) {
        const p = point(value);
        if (!p || Math.abs(p.lat) > 90 || Math.abs(p.lon) > 180) return null;
        const out = { lat: round(p.lat, 4), lon: round(p.lon, 4), at: Math.max(0, Math.round(finite(value.at) || 0)) };
        const altFt = finite(value.altFt), hdg = finite(value.hdg), gsKts = finite(value.gsKts);
        if (altFt !== null) out.altFt = Math.round(Math.max(-2000, Math.min(60000, altFt)));
        if (hdg !== null) out.hdg = Math.round(((hdg % 360) + 360) % 360);
        if (gsKts !== null) out.gsKts = Math.round(Math.max(0, Math.min(1000, gsKts)));
        return out;
    }

    // Route for the detail map: at most ROUTE_MAX_POINTS, first and last always kept.
    const ROUTE_MAX_POINTS = 40;
    function cleanRoute(value) {
        let pts = (Array.isArray(value) ? value : []).map(raw => {
            const p = point(raw);
            if (!p || Math.abs(p.lat) > 90 || Math.abs(p.lon) > 180) return null;
            const name = text(raw.name || raw.icao, 24);
            return name ? { lat: round(p.lat, 4), lon: round(p.lon, 4), name } : { lat: round(p.lat, 4), lon: round(p.lon, 4) };
        }).filter(Boolean);
        if (pts.length > ROUTE_MAX_POINTS) {
            const step = (pts.length - 1) / (ROUTE_MAX_POINTS - 1);
            pts = Array.from({ length: ROUTE_MAX_POINTS }, (_, i) => pts[Math.round(i * step)]);
        }
        return pts;
    }

    // Runtime fields of a mission state that must not travel to another pilot's planner.
    const RUNTIME_KEYS = ['activeMissionRuntimeStartedAt', 'activeMissionRuntimeSavedAt', 'activeMissionRuntimePhase', 'activeMissionRuntimeMissionId'];
    function plannedMissionState(state) {
        if (!state || typeof state !== 'object') return null;
        const copy = JSON.parse(JSON.stringify(state));
        const strip = obj => { if (obj && typeof obj === 'object') RUNTIME_KEYS.forEach(key => { delete obj[key]; }); };
        strip(copy);
        strip(copy.currentMissionData);
        strip(copy.activeMissionContract);
        strip(copy.currentMissionData?.missionContract);
        return copy;
    }

    // Mission for crew sharing: planned state, the arrival plan (placement geometry, often
    // 60 KB) kept once instead of twice. restoreSharedMissionState undoes the dedupe.
    function sharedMissionState(state) {
        const copy = plannedMissionState(state);
        if (!copy) return null;
        const md = copy.currentMissionData, contract = copy.activeMissionContract;
        if (md?.aptArrivalPlan && contract?.aptArrivalPlan
            && JSON.stringify(md.aptArrivalPlan) === JSON.stringify(contract.aptArrivalPlan)) {
            delete contract.aptArrivalPlan;
            contract.crewArrivalPlanFromMission = true;
        }
        return copy;
    }
    function restoreSharedMissionState(state) {
        const copy = plannedMissionState(state);
        const contract = copy?.activeMissionContract;
        if (contract?.crewArrivalPlanFromMission) {
            delete contract.crewArrivalPlanFromMission;
            if (copy.currentMissionData?.aptArrivalPlan) contract.aptArrivalPlan = JSON.parse(JSON.stringify(copy.currentMissionData.aptArrivalPlan));
        }
        return copy;
    }

    // Placeholder codes that are no airport identifier for people.
    function placeLabel(code, name, fallback = '—') {
        const c = text(code, 24), n = text(name, 60);
        if (!c || /^(GPS|POI|HOMEBASE|FREI|START|ZIEL)$/i.test(c) || /^OUR-/i.test(c)) return n || (/^HOMEBASE$/i.test(c) ? 'Homebase' : fallback);
        return c;
    }

    // Did the flight change enough to tell the crew now (rather than at the next heartbeat)?
    function flightEvent(prev, next) {
        if (!prev && !next) return false;
        if (!prev || !next) return true;
        if (prev.id !== next.id || prev.phase !== next.phase) return true;
        if (!!prev.endedAt !== !!next.endedAt || !!prev.takeoffAt !== !!next.takeoffAt) return true;
        if (prev.dest !== next.dest || prev.title !== next.title) return true;
        return false;
    }

    // Client side: send now? `last` is { at, flight } of the last successful beat.
    function shouldBeat(last, flight, now) {
        const t = Number(now) || Date.now();
        if (!last || !Number(last.at)) return true;
        const since = t - Number(last.at);
        if (since >= BEAT_INTERVAL_MS) return true;
        if (since < MIN_EVENT_GAP_MS) return false;
        if (flightEvent(last.flight || null, flight || null)) return true;
        const a = finite(last.flight?.progress), b = finite(flight?.progress);
        return a !== null && b !== null && Math.abs(b - a) >= PROGRESS_STEP && since >= 2 * MIN_EVENT_GAP_MS;
    }

    // Server side: persist this beat? Spammed beats with no change are not stored.
    function shouldStore(stored, beat, now) {
        if (!stored) return true;
        if (Number(now) - Number(stored.seenAt || 0) >= STORE_REFRESH_MS) return true;
        if (stored.nick !== beat.nick || stored.source !== beat.source) return true;
        if (JSON.stringify(stored.share) !== JSON.stringify(beat.share)) return true;
        if (flightEvent(stored.flight || null, beat.flight || null)) return true;
        const a = finite(stored.flight?.progress), b = finite(beat.flight?.progress);
        return a !== null && b !== null && Math.abs(b - a) >= PROGRESS_STEP;
    }

    // What a crew member may see of a stored record.
    function publicView(record, now) {
        const t = Number(now) || Date.now();
        if (!record || typeof record !== 'object') return null;
        const share = normalizeShare(record.share);
        const fresh = t - Number(record.seenAt || 0) <= ONLINE_WINDOW_MS;
        const view = { pilotId: text(record.pilotId, 160), nick: text(record.nick, 64), online: share.online && fresh, seenAt: share.online ? Number(record.seenAt || 0) : 0 };
        const flight = share.flight ? cleanFlight(record.flight) : null;
        if (flight) {
            const ended = flight.endedAt > 0;
            const visible = ended ? t - flight.endedAt <= LANDED_VISIBLE_MS : fresh;
            if (visible) view.flight = flight;
        }
        return view;
    }

    function phaseLabel(phase) {
        return PHASE_LABEL[phase] || '';
    }

    return {
        BEAT_INTERVAL_MS, MIN_EVENT_GAP_MS, ONLINE_WINDOW_MS, LANDED_VISIBLE_MS, STORE_REFRESH_MS,
        PHASES, KINDS,
        normalizeShare, routeProgress, flightPhase, cleanFlight, flightEvent,
        shouldBeat, shouldStore, mergeBeat, publicView, phaseLabel, distanceNm,
        cleanPosition, cleanRoute, plannedMissionState, sharedMissionState, restoreSharedMissionState, placeLabel, ROUTE_MAX_POINTS
    };
});
