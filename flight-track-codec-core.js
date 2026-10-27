/* Compact flight track for logbook entries. Shared by Tracker (encode) and web app (decode).
 * Concept: docs/Flugbuch Kruemelweg Konzept.md */
(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    root.GAFlightTrackCodecCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    const VERSION = 1;
    const DEFAULTS = Object.freeze({ lateralM: 15, verticalFt: 30, maxPoints: 600, gapSec: 60, jumpKts: 400 });
    const EARTH_M = 6371008.8;
    const FT_PER_M = 3.28084;
    const FLAG_GROUND = 1;
    const FLAG_SEGMENT_START = 2;
    const FLAG_NO_TERRAIN = 4;

    function finite(value) {
        if (value === null || value === undefined || value === '') return null;
        const n = Number(value);
        return Number.isFinite(n) ? n : null;
    }

    function distanceM(a, b) {
        const rad = Math.PI / 180;
        const dLat = (b.lat - a.lat) * rad;
        const dLon = (b.lon - a.lon) * rad;
        const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
        return 2 * EARTH_M * Math.asin(Math.min(1, Math.sqrt(h)));
    }

    // Raw telemetry samples (tracker flight log) -> clean, time-ordered points.
    function pointsFromSamples(samples) {
        const out = [];
        for (const raw of Array.isArray(samples) ? samples : []) {
            const s = raw && raw.sample && typeof raw.sample === 'object' ? raw.sample : raw;
            if (!s || s.simPaused === true || s.inMenuOrMap === true) continue;
            const t = finite(s.observedAt);
            const lat = finite(s.lat);
            const lon = finite(s.lon);
            const altFt = finite(s.altFt);
            if (t === null || lat === null || lon === null || altFt === null) continue;
            if (Math.abs(lat) > 90 || Math.abs(lon) > 180 || (lat === 0 && lon === 0)) continue;
            const aglFt = finite(s.aglFt);
            const prev = out[out.length - 1];
            if (prev && t <= prev.t) continue;
            out.push({
                t,
                lat,
                lon,
                altFt,
                gndFt: aglFt === null ? null : altFt - aglFt,
                onGround: s.onGround === true
            });
        }
        return out;
    }

    // Segment starts: first point, long gaps (pause, sim restart) and teleports (slew, reposition).
    function segmentStarts(points, options) {
        const starts = new Set([0]);
        for (let i = 1; i < points.length; i += 1) {
            const dtSec = (points[i].t - points[i - 1].t) / 1000;
            if (dtSec > options.gapSec) { starts.add(i); continue; }
            const kts = (distanceM(points[i - 1], points[i]) / 1852) / Math.max(dtSec, 0.5) * 3600;
            if (kts > options.jumpKts && distanceM(points[i - 1], points[i]) > 500) starts.add(i);
        }
        return starts;
    }

    function mandatoryIndices(points, starts) {
        const keep = new Set([0, points.length - 1]);
        let maxIdx = 0;
        for (let i = 0; i < points.length; i += 1) {
            if (points[i].altFt > points[maxIdx].altFt) maxIdx = i;
            if (starts.has(i)) { keep.add(i); if (i > 0) keep.add(i - 1); }
            if (i > 0 && points[i].onGround !== points[i - 1].onGround) { keep.add(i - 1); keep.add(i); }
        }
        keep.add(maxIdx);
        return keep;
    }

    // Lateral distance (m) of p to segment a-b, plus altitude deviation (ft) against time interpolation.
    function deviation(a, b, p) {
        const rad = Math.PI / 180;
        const kx = Math.cos(a.lat * rad) * EARTH_M * rad;
        const ky = EARTH_M * rad;
        const bx = (b.lon - a.lon) * kx, by = (b.lat - a.lat) * ky;
        const px = (p.lon - a.lon) * kx, py = (p.lat - a.lat) * ky;
        const len2 = bx * bx + by * by;
        const u = len2 > 0 ? Math.max(0, Math.min(1, (px * bx + py * by) / len2)) : 0;
        const lateralM = Math.hypot(px - u * bx, py - u * by);
        const span = b.t - a.t;
        const f = span > 0 ? (p.t - a.t) / span : 0;
        const verticalFt = Math.abs(p.altFt - (a.altFt + (b.altFt - a.altFt) * f));
        return { lateralM, verticalFt };
    }

    // Douglas-Peucker on lateral and vertical error together, iterative.
    function simplifyIndices(points, mandatory, lateralM, verticalFt) {
        const keep = new Uint8Array(points.length);
        const anchors = Array.from(mandatory).sort((a, b) => a - b);
        for (const i of anchors) keep[i] = 1;
        const stack = [];
        for (let k = 1; k < anchors.length; k += 1) stack.push([anchors[k - 1], anchors[k]]);
        while (stack.length) {
            const [from, to] = stack.pop();
            if (to - from < 2) continue;
            let worst = -1, worstScore = 1;
            for (let i = from + 1; i < to; i += 1) {
                const d = deviation(points[from], points[to], points[i]);
                const score = Math.max(d.lateralM / lateralM, d.verticalFt / verticalFt);
                if (score > worstScore) { worstScore = score; worst = i; }
            }
            if (worst < 0) continue;
            keep[worst] = 1;
            stack.push([from, worst], [worst, to]);
        }
        const out = [];
        for (let i = 0; i < keep.length; i += 1) if (keep[i]) out.push(i);
        return out;
    }

    // Zigzag varint in the printable polyline alphabet (chars 63..126).
    function pushUnsigned(out, value) {
        let v = value;
        while (v >= 0x20) {
            out.push(String.fromCharCode((0x20 | (v & 0x1f)) + 63));
            v = Math.floor(v / 32);
        }
        out.push(String.fromCharCode(v + 63));
    }
    function pushSigned(out, value) {
        pushUnsigned(out, value < 0 ? -value * 2 - 1 : value * 2);
    }
    function readUnsigned(text, state) {
        let result = 0, factor = 1, c;
        do {
            if (state.i >= text.length) throw new Error('track_truncated');
            c = text.charCodeAt(state.i++) - 63;
            if (c < 0 || c > 63) throw new Error('track_invalid_char');
            result += (c & 0x1f) * factor;
            factor *= 32;
        } while (c >= 0x20);
        return result;
    }
    function readSigned(text, state) {
        const v = readUnsigned(text, state);
        return v % 2 ? -(v + 1) / 2 : v / 2;
    }

    function quantize(p, t0, segStart) {
        const gnd = p.gndFt === null ? null : Math.round(p.gndFt / 10);
        return {
            lat: Math.round(p.lat * 1e5),
            lon: Math.round(p.lon * 1e5),
            alt: Math.round(p.altFt / 10),
            gnd,
            t: Math.round((p.t - t0) / 1000),
            flags: (p.onGround ? FLAG_GROUND : 0) | (segStart ? FLAG_SEGMENT_START : 0) | (gnd === null ? FLAG_NO_TERRAIN : 0)
        };
    }

    function encodePoints(qs) {
        const out = [];
        let prev = { lat: 0, lon: 0, alt: 0, gnd: 0, t: 0 };
        for (const q of qs) {
            const gnd = q.gnd === null ? prev.gnd : q.gnd;
            pushSigned(out, q.lat - prev.lat);
            pushSigned(out, q.lon - prev.lon);
            pushSigned(out, q.alt - prev.alt);
            pushSigned(out, gnd - prev.gnd);
            pushSigned(out, q.t - prev.t);
            pushUnsigned(out, q.flags);
            prev = { lat: q.lat, lon: q.lon, alt: q.alt, gnd, t: q.t };
        }
        return out.join('');
    }

    // samples: tracker telemetry samples (or flight-log lines). Returns null when there is no usable flight.
    function encodeTrack(samples, options = {}) {
        const opts = { ...DEFAULTS, ...options };
        const points = pointsFromSamples(samples);
        if (points.length < 2) return null;
        const starts = segmentStarts(points, opts);
        const mandatory = mandatoryIndices(points, starts);
        let lateralM = opts.lateralM, verticalFt = opts.verticalFt, kept;
        for (let pass = 0; pass < 12; pass += 1) {
            kept = simplifyIndices(points, mandatory, lateralM, verticalFt);
            if (kept.length <= opts.maxPoints) break;
            lateralM *= 1.5; verticalFt *= 1.5;
        }
        const t0 = points[0].t;
        const qs = kept.map(i => quantize(points[i], t0, starts.has(i)));
        let maxAltIdx = 0, takeoff = -1;
        const touchdowns = [];
        for (let k = 0; k < qs.length; k += 1) {
            if (qs[k].alt > qs[maxAltIdx].alt) maxAltIdx = k;
            if (k > 0 && !(qs[k].flags & FLAG_SEGMENT_START)) {
                const wasGround = qs[k - 1].flags & FLAG_GROUND, isGround = qs[k].flags & FLAG_GROUND;
                if (wasGround && !isGround && takeoff < 0) takeoff = k - 1;
                if (!wasGround && isGround) touchdowns.push(k);
            }
        }
        return {
            v: VERSION,
            tol: [Math.round(lateralM), Math.round(verticalFt)],
            n: qs.length,
            t0,
            enc: encodePoints(qs),
            marks: { takeoff: takeoff >= 0 ? takeoff : null, touchdowns, maxAlt: maxAltIdx }
        };
    }

    function decodeTrack(track) {
        if (!track || track.v !== VERSION || typeof track.enc !== 'string') throw new Error('track_unsupported');
        const out = [];
        const state = { i: 0 };
        let lat = 0, lon = 0, alt = 0, gnd = 0, t = 0;
        const t0 = finite(track.t0) || 0;
        while (state.i < track.enc.length) {
            lat += readSigned(track.enc, state);
            lon += readSigned(track.enc, state);
            alt += readSigned(track.enc, state);
            gnd += readSigned(track.enc, state);
            t += readSigned(track.enc, state);
            const flags = readUnsigned(track.enc, state);
            out.push({
                lat: lat / 1e5,
                lon: lon / 1e5,
                altFt: alt * 10,
                gndFt: flags & FLAG_NO_TERRAIN ? null : gnd * 10,
                sec: t,
                time: t0 + t * 1000,
                onGround: !!(flags & FLAG_GROUND),
                segmentStart: !!(flags & FLAG_SEGMENT_START)
            });
        }
        if (Number.isFinite(track.n) && out.length !== track.n) throw new Error('track_count_mismatch');
        return out;
    }

    // Cumulative along-track distance (NM) for the height profile x-axis; resets nothing across segments.
    function alongTrackNm(decoded) {
        const out = [];
        let sum = 0;
        for (let i = 0; i < decoded.length; i += 1) {
            if (i > 0 && !decoded[i].segmentStart) sum += distanceM(decoded[i - 1], decoded[i]) / 1852;
            out.push(sum);
        }
        return out;
    }

    return { VERSION, DEFAULTS, FT_PER_M, pointsFromSamples, encodeTrack, decodeTrack, alongTrackNm, distanceM, deviation };
});
