(function(root) {
    'use strict';

    const host = root || (typeof globalThis !== 'undefined' ? globalThis : {});
    const NM_TO_M = 1852;
    const EARTH_RADIUS_NM = 3440.065;

    const DEFAULTS = {
        altitudeToleranceFt: 300,
        scan: {
            lineCount: 4,
            lineLengthNm: 1.6,
            lineSpacingNm: 0.35,
            crossTrackToleranceNm: 0.10,
            headingToleranceDeg: 35,
            minCoverage: 0.82,
            bins: 24,
            startEndTolerance: 0.18,
            resetGraceSec: 5,
            minGroundSpeedKts: 45
        },
        orbit: {
            radiusNm: 0.55,
            radialToleranceNm: 0.12,
            requiredTurns: 3,
            sectorsPerTurn: 36,
            minTurnCoverage: 0.86,
            resetGraceSec: 5,
            minGroundSpeedKts: 45,
            minTurnSec: 45
        }
    };

    let activeState = null;
    let activeSpecKey = '';
    let overlayLayer = null;

    function activeMissionDataFromHost() {
        try {
            if (typeof currentMissionData !== 'undefined' && currentMissionData && typeof currentMissionData === 'object') {
                return currentMissionData;
            }
        } catch (_) {}
        return host.currentMissionData && typeof host.currentMissionData === 'object' ? host.currentMissionData : null;
    }

    function clamp(value, min, max) {
        const n = Number(value);
        if (!Number.isFinite(n)) return min;
        return Math.max(min, Math.min(max, n));
    }

    function roundNumber(value, digits = 6) {
        const n = Number(value);
        if (!Number.isFinite(n)) return null;
        const p = 10 ** digits;
        return Math.round(n * p) / p;
    }

    function toRad(value) {
        return Number(value) * Math.PI / 180;
    }

    function toDeg(value) {
        return Number(value) * 180 / Math.PI;
    }

    function haversineNm(lat1, lon1, lat2, lon2) {
        const dLat = toRad(lat2 - lat1);
        const dLon = toRad(lon2 - lon1);
        const p1 = toRad(lat1);
        const p2 = toRad(lat2);
        const a = Math.sin(dLat / 2) ** 2
            + Math.cos(p1) * Math.cos(p2) * Math.sin(dLon / 2) ** 2;
        return 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * EARTH_RADIUS_NM;
    }

    function bearingDeg(lat1, lon1, lat2, lon2) {
        const p1 = toRad(lat1);
        const p2 = toRad(lat2);
        const dLon = toRad(lon2 - lon1);
        const y = Math.sin(dLon) * Math.cos(p2);
        const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dLon);
        return (toDeg(Math.atan2(y, x)) + 360) % 360;
    }

    function destinationPoint(lat, lon, distNm, bearing) {
        const lat1 = toRad(lat);
        const lon1 = toRad(lon);
        const brng = toRad(bearing);
        const d = Number(distNm) / EARTH_RADIUS_NM;
        const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(brng));
        const lon2 = lon1 + Math.atan2(
            Math.sin(brng) * Math.sin(d) * Math.cos(lat1),
            Math.cos(d) - Math.sin(lat1) * Math.sin(lat2)
        );
        return { lat: toDeg(lat2), lon: toDeg(lon2) };
    }

    function angleDiffAbs(a, b) {
        return Math.abs((((Number(a) - Number(b)) % 360) + 540) % 360 - 180);
    }

    function signedAngleDelta(fromDeg, toDeg) {
        return (((Number(toDeg) - Number(fromDeg)) % 360) + 540) % 360 - 180;
    }

    function interpolateLine(line, tRaw) {
        const t = clamp(tRaw, 0, 1);
        return {
            lat: Number(line.start.lat) + (Number(line.end.lat) - Number(line.start.lat)) * t,
            lon: Number(line.start.lon) + (Number(line.end.lon) - Number(line.start.lon)) * t
        };
    }

    function localPointNm(lat, lon, originLat, originLon) {
        const avgLat = toRad((Number(lat) + Number(originLat)) / 2);
        return {
            x: (Number(lon) - Number(originLon)) * Math.cos(avgLat) * 60,
            y: (Number(lat) - Number(originLat)) * 60
        };
    }

    function localPointToLatLonNm(point, origin) {
        const originLat = Number(origin?.lat);
        const originLon = Number(origin?.lon);
        if (!Number.isFinite(originLat) || !Number.isFinite(originLon)) return null;
        const lat = originLat + (Number(point?.y || 0) / 60);
        const lonScale = Math.max(0.01, Math.cos(toRad(originLat)) * 60);
        const lon = originLon + (Number(point?.x || 0) / lonScale);
        return { lat, lon };
    }

    function projectPointToLineNm(lat, lon, line) {
        const start = line?.start || {};
        const end = line?.end || {};
        const sx = 0;
        const sy = 0;
        const e = localPointNm(end.lat, end.lon, start.lat, start.lon);
        const p = localPointNm(lat, lon, start.lat, start.lon);
        const vx = e.x - sx;
        const vy = e.y - sy;
        const lenSq = vx * vx + vy * vy;
        const lenNm = Math.sqrt(lenSq);
        if (!(lenSq > 0)) return null;
        const t = ((p.x - sx) * vx + (p.y - sy) * vy) / lenSq;
        const cx = sx + t * vx;
        const cy = sy + t * vy;
        const crossTrackNm = Math.sqrt((p.x - cx) ** 2 + (p.y - cy) ** 2);
        return {
            t,
            crossTrackNm,
            alongNm: clamp(t, 0, 1) * lenNm,
            lengthNm: lenNm,
            bearingDeg: bearingDeg(start.lat, start.lon, end.lat, end.lon)
        };
    }

    function buildScanLines(center, scan = {}) {
        const lineCount = Math.max(1, Math.min(8, Math.round(Number(scan.lineCount || DEFAULTS.scan.lineCount))));
        const lineLengthNm = Math.max(0.4, Math.min(5, Number(scan.lineLengthNm || DEFAULTS.scan.lineLengthNm)));
        const lineSpacingNm = Math.max(0.12, Math.min(1.2, Number(scan.lineSpacingNm || DEFAULTS.scan.lineSpacingNm)));
        const halfLen = lineLengthNm / 2;
        const mid = (lineCount - 1) / 2;
        const lines = [];
        for (let i = 0; i < lineCount; i++) {
            const offsetNm = (i - mid) * lineSpacingNm;
            const base = Math.abs(offsetNm) > 0.0001
                ? destinationPoint(center.lat, center.lon, Math.abs(offsetNm), offsetNm >= 0 ? 90 : 270)
                : { ...center };
            const north = destinationPoint(base.lat, base.lon, halfLen, 0);
            const south = destinationPoint(base.lat, base.lon, halfLen, 180);
            lines.push({
                id: `S${i + 1}`,
                label: `Survey-Linie ${i + 1}`,
                start: { lat: roundNumber(north.lat), lon: roundNumber(north.lon) },
                end: { lat: roundNumber(south.lat), lon: roundNumber(south.lon) }
            });
        }
        return lines;
    }

    function normalizeType(value) {
        const s = String(value || '').toLowerCase();
        if (s === 'orbit' || s === 'circle' || s === 'turns') return 'orbit';
        return 'north_south_scan';
    }

    function normalizeSpec(raw = null) {
        if (!raw || typeof raw !== 'object') return null;
        if (raw.enabled === false) return null;
        const taskDomain = String(raw.taskDomain || raw.domain || '').toLowerCase();
        if (taskDomain && taskDomain !== 'mapping_survey') return null;
        const centerSrc = raw.center || raw.target || raw.anchor || {};
        const lat = Number(centerSrc.lat ?? raw.targetLat);
        const lon = Number(centerSrc.lon ?? centerSrc.lng ?? raw.targetLon);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
        const type = normalizeType(raw.type || raw.patternType);
        const center = { lat: roundNumber(lat), lon: roundNumber(lon) };
        const scan = {
            ...DEFAULTS.scan,
            ...(raw.scan && typeof raw.scan === 'object' ? raw.scan : {})
        };
        const orbit = {
            ...DEFAULTS.orbit,
            ...(raw.orbit && typeof raw.orbit === 'object' ? raw.orbit : {})
        };
        scan.lineCount = Math.max(1, Math.min(8, Math.round(Number(scan.lineCount || DEFAULTS.scan.lineCount))));
        scan.lineLengthNm = Math.max(0.4, Math.min(5, Number(scan.lineLengthNm || DEFAULTS.scan.lineLengthNm)));
        scan.lineSpacingNm = Math.max(0.12, Math.min(1.2, Number(scan.lineSpacingNm || DEFAULTS.scan.lineSpacingNm)));
        scan.crossTrackToleranceNm = Math.max(0.03, Math.min(0.5, Number(scan.crossTrackToleranceNm || DEFAULTS.scan.crossTrackToleranceNm)));
        scan.headingToleranceDeg = Math.max(5, Math.min(90, Number(scan.headingToleranceDeg || DEFAULTS.scan.headingToleranceDeg)));
        scan.minCoverage = Math.max(0.35, Math.min(1, Number(scan.minCoverage || DEFAULTS.scan.minCoverage)));
        scan.bins = Math.max(8, Math.min(80, Math.round(Number(scan.bins || DEFAULTS.scan.bins))));
        scan.startEndTolerance = Math.max(0.05, Math.min(0.4, Number(scan.startEndTolerance || DEFAULTS.scan.startEndTolerance)));
        scan.resetGraceSec = Math.max(1, Math.min(20, Number(scan.resetGraceSec || DEFAULTS.scan.resetGraceSec)));
        scan.minGroundSpeedKts = Math.max(0, Math.min(120, Number(scan.minGroundSpeedKts || DEFAULTS.scan.minGroundSpeedKts)));
        orbit.radiusNm = Math.max(0.2, Math.min(2.5, Number(orbit.radiusNm || DEFAULTS.orbit.radiusNm)));
        orbit.radialToleranceNm = Math.max(0.04, Math.min(0.5, Number(orbit.radialToleranceNm || DEFAULTS.orbit.radialToleranceNm)));
        orbit.requiredTurns = Math.max(1, Math.min(6, Math.round(Number(orbit.requiredTurns || DEFAULTS.orbit.requiredTurns))));
        orbit.sectorsPerTurn = Math.max(12, Math.min(90, Math.round(Number(orbit.sectorsPerTurn || DEFAULTS.orbit.sectorsPerTurn))));
        orbit.minTurnCoverage = Math.max(0.45, Math.min(1, Number(orbit.minTurnCoverage || DEFAULTS.orbit.minTurnCoverage)));
        orbit.resetGraceSec = Math.max(1, Math.min(20, Number(orbit.resetGraceSec || DEFAULTS.orbit.resetGraceSec)));
        orbit.minGroundSpeedKts = Math.max(0, Math.min(120, Number(orbit.minGroundSpeedKts || DEFAULTS.orbit.minGroundSpeedKts)));
        orbit.minTurnSec = Math.max(0, Math.min(240, Number(orbit.minTurnSec || DEFAULTS.orbit.minTurnSec)));
        if (!Array.isArray(scan.lines) || scan.lines.length !== scan.lineCount) {
            scan.lines = buildScanLines(center, scan);
        } else {
            scan.lines = scan.lines.map((line, idx) => ({
                id: String(line.id || `S${idx + 1}`),
                label: String(line.label || `Survey-Linie ${idx + 1}`),
                start: { lat: roundNumber(line.start?.lat), lon: roundNumber(line.start?.lon) },
                end: { lat: roundNumber(line.end?.lat), lon: roundNumber(line.end?.lon) }
            })).filter(line => Number.isFinite(line.start.lat) && Number.isFinite(line.start.lon) && Number.isFinite(line.end.lat) && Number.isFinite(line.end.lon));
            scan.lineCount = scan.lines.length || scan.lineCount;
        }
        const targetAltFt = Math.max(0, Math.round(Number(raw.targetAltFt || 0)));
        const altitudeToleranceFt = Math.max(100, Math.min(1000, Math.round(Number(raw.altitudeToleranceFt || DEFAULTS.altitudeToleranceFt))));
        const key = String(raw.key || [
            'survey',
            type,
            roundNumber(center.lat, 5),
            roundNumber(center.lon, 5),
            targetAltFt,
            type === 'orbit' ? orbit.radiusNm : `${scan.lineCount}x${scan.lineLengthNm}x${scan.lineSpacingNm}`
        ].join(':'));
        return {
            schema: 'ga.surveyPattern.v1',
            enabled: true,
            key,
            taskDomain: 'mapping_survey',
            type,
            label: String(raw.label || (type === 'orbit' ? 'Survey-Orbit' : 'Nord-Sued-Scan')),
            targetLabel: String(raw.targetLabel || raw.targetName || 'Zielgebiet'),
            center,
            targetAltFt,
            altitudeToleranceFt,
            scan,
            orbit
        };
    }

    function setFromArray(value) {
        return new Set(Array.isArray(value) ? value.map(String).filter(Boolean) : []);
    }

    function createInitialState(spec) {
        const normalized = normalizeSpec(spec);
        if (!normalized) return null;
        return {
            schema: 'ga.surveyPatternProgress.v1',
            specKey: normalized.key,
            type: normalized.type,
            startedAt: 0,
            updatedAt: 0,
            satisfied: false,
            events: [],
            scan: {
                completedLineIds: new Set(),
                active: null,
                lastResetReason: '',
                totalLines: normalized.scan.lines.length
            },
            orbit: {
                completedTurns: 0,
                active: null,
                lastResetReason: '',
                requiredTurns: normalized.orbit.requiredTurns
            }
        };
    }

    function hydrateState(spec, saved = null) {
        const normalized = normalizeSpec(spec);
        if (!normalized) return null;
        const state = createInitialState(normalized);
        if (!saved || typeof saved !== 'object') return state;
        state.startedAt = Number(saved.startedAt || 0);
        state.updatedAt = Number(saved.updatedAt ?? 0);
        state.satisfied = !!saved.satisfied;
        if (saved.scan && typeof saved.scan === 'object') {
            state.scan.completedLineIds = setFromArray(saved.scan.completedLineIds);
            state.scan.lastResetReason = String(saved.scan.lastResetReason || '');
            state.scan.totalLines = normalized.scan.lines.length;
        }
        if (saved.orbit && typeof saved.orbit === 'object') {
            state.orbit.completedTurns = Math.max(0, Math.round(Number(saved.orbit.completedTurns || 0)));
            state.orbit.lastResetReason = String(saved.orbit.lastResetReason || '');
            state.orbit.requiredTurns = normalized.orbit.requiredTurns;
        }
        return state;
    }

    function snapshotState(state = activeState) {
        if (!state || typeof state !== 'object') return null;
        const scanCompleted = Array.from(state.scan?.completedLineIds || []);
        const activeScan = state.scan?.active || null;
        const activeOrbit = state.orbit?.active || null;
        return {
            schema: 'ga.surveyPatternProgress.v1',
            specKey: String(state.specKey || ''),
            type: String(state.type || ''),
            startedAt: Number(state.startedAt || 0),
            updatedAt: Number(state.updatedAt ?? 0),
            satisfied: !!state.satisfied,
            scan: state.scan ? {
                completedLineIds: scanCompleted,
                completedCount: scanCompleted.length,
                totalLines: Math.max(0, Number(state.scan.totalLines || 0)),
                activeLineId: activeScan?.lineId || '',
                activeCoverage: activeScan?.bins instanceof Set
                    ? Math.round((activeScan.bins.size / Math.max(1, Number(activeScan.totalBins || 1))) * 100) / 100
                    : 0,
                lastResetReason: String(state.scan.lastResetReason || '')
            } : null,
            orbit: state.orbit ? {
                completedTurns: Math.max(0, Number(state.orbit.completedTurns || 0)),
                requiredTurns: Math.max(0, Number(state.orbit.requiredTurns || 0)),
                activeCoverage: activeOrbit?.sectors instanceof Set
                    ? Math.round((activeOrbit.sectors.size / Math.max(1, Number(activeOrbit.totalSectors || 1))) * 100) / 100
                    : 0,
                lastResetReason: String(state.orbit.lastResetReason || '')
            } : null
        };
    }

    function sampleAltitudeOk(spec, sample) {
        const target = Number(spec.targetAltFt || 0);
        const alt = Number(sample.altFt);
        if (!(target > 0) || !Number.isFinite(alt)) return true;
        return Math.abs(alt - target) <= Number(spec.altitudeToleranceFt || DEFAULTS.altitudeToleranceFt);
    }

    function sampleSpeedOk(minGroundSpeedKts, sample) {
        const gs = Number(sample.gsKts);
        if (!Number.isFinite(gs) || gs <= 0) return true;
        return gs >= Number(minGroundSpeedKts || 0);
    }

    function headingMatchesLine(spec, projection, sample) {
        const hdg = Number(sample.headingDeg);
        if (!Number.isFinite(hdg)) return true;
        const tol = Number(spec.scan.headingToleranceDeg || DEFAULTS.scan.headingToleranceDeg);
        const b = Number(projection.bearingDeg || 180);
        return Math.min(angleDiffAbs(hdg, b), angleDiffAbs(hdg, (b + 180) % 360)) <= tol;
    }

    function sampleFromInput(input = {}) {
        const flightData = input.flightData || {};
        const gps = host.lastLiveGpsPos || {};
        return {
            lat: Number(input.lat),
            lon: Number(input.lon),
            altFt: Number(
                input.altFt
                ?? flightData.mslFt
                ?? flightData.altFt
                ?? flightData.altitudeFt
                ?? gps.mslFt
                ?? gps.altFt
            ),
            headingDeg: Number(
                input.headingDeg
                ?? flightData.hdg
                ?? flightData.heading
                ?? flightData.trackDeg
                ?? flightData.trkDeg
                ?? gps.hdg
            ),
            gsKts: Number(
                input.gsKts
                ?? flightData.gs
                ?? flightData.gsKts
                ?? flightData.groundSpeed
                ?? gps.gs
            ),
            nowMs: Number(input.nowMs ?? Date.now())
        };
    }

    function findLineCandidate(spec, state, sample) {
        const completed = state.scan.completedLineIds || new Set();
        let best = null;
        for (const line of spec.scan.lines) {
            if (!line || completed.has(String(line.id))) continue;
            const projection = projectPointToLineNm(sample.lat, sample.lon, line);
            if (!projection) continue;
            const withinSegment = projection.t >= -0.08 && projection.t <= 1.08;
            if (!withinSegment) continue;
            const cross = Number(projection.crossTrackNm);
            if (!Number.isFinite(cross)) continue;
            if (!best || cross < best.projection.crossTrackNm) {
                best = { line, projection };
            }
        }
        return best;
    }

    function makeScanResetEvent(reason, lineId) {
        return {
            type: reason === 'altitude' ? 'line_reset_altitude' : 'line_reset_offtrack',
            lineId: String(lineId || ''),
            reason
        };
    }

    function sampleInsideScanArea(spec, sample) {
        if (!spec?.scan || !Number.isFinite(Number(sample?.lat)) || !Number.isFinite(Number(sample?.lon))) return false;
        const p = localPointNm(sample.lat, sample.lon, spec.center.lat, spec.center.lon);
        const halfLength = (Number(spec.scan.lineLengthNm || DEFAULTS.scan.lineLengthNm) / 2) + 0.25;
        const halfWidth = ((Math.max(1, Number(spec.scan.lineCount || 1)) - 1) * Number(spec.scan.lineSpacingNm || DEFAULTS.scan.lineSpacingNm) / 2) + 0.25;
        return Math.abs(p.y) <= halfLength && Math.abs(p.x) <= halfWidth;
    }

    function tickScanState(spec, state, sample, events) {
        const now = Number(sample.nowMs ?? Date.now());
        if (!Number.isFinite(sample.lat) || !Number.isFinite(sample.lon)) return;
        if (!state.startedAt && sampleInsideScanArea(spec, sample)) {
            state.startedAt = now;
            events.push({ type: 'survey_area_entered', mode: 'scan' });
        }
        const altOk = sampleAltitudeOk(spec, sample);
        const speedOk = sampleSpeedOk(spec.scan.minGroundSpeedKts, sample);
        const candidate = findLineCandidate(spec, state, sample);
        const validCandidate = !!(
            candidate
            && candidate.projection.crossTrackNm <= spec.scan.crossTrackToleranceNm
            && altOk
            && speedOk
            && headingMatchesLine(spec, candidate.projection, sample)
        );
        let active = state.scan.active;

        if (!active && validCandidate) {
            const t = clamp(candidate.projection.t, 0, 1);
            const edge = Number(spec.scan.startEndTolerance || DEFAULTS.scan.startEndTolerance);
            if (t <= edge || t >= 1 - edge) {
                active = {
                    lineId: String(candidate.line.id),
                    direction: t <= 0.5 ? 'forward' : 'reverse',
                    bins: new Set(),
                    totalBins: spec.scan.bins,
                    startedAt: now,
                    lastGoodAt: now,
                    badSince: 0,
                    lastT: t,
                    endCap: false
                };
                state.scan.active = active;
                if (!state.startedAt) state.startedAt = now;
                events.push({ type: 'line_started', lineId: active.lineId });
            }
        }

        active = state.scan.active;
        if (!active) return;

        const sameLine = validCandidate && String(candidate.line.id) === String(active.lineId);
        const badReason = !altOk ? 'altitude' : (!speedOk || !sameLine ? 'offtrack' : '');
        if (!sameLine || !altOk || !speedOk) {
            if (!active.badSince) active.badSince = now;
            const graceMs = Number(spec.scan.resetGraceSec || DEFAULTS.scan.resetGraceSec) * 1000;
            if ((now - active.badSince) >= graceMs) {
                const resetReason = badReason || 'offtrack';
                state.scan.lastResetReason = resetReason;
                events.push(makeScanResetEvent(resetReason, active.lineId));
                state.scan.active = null;
            }
            return;
        }

        const t = clamp(candidate.projection.t, 0, 1);
        const movedBack = active.direction === 'forward'
            ? t < Number(active.lastT || 0) - 0.22
            : t > Number(active.lastT || 1) + 0.22;
        if (movedBack) {
            state.scan.lastResetReason = 'offtrack';
            events.push(makeScanResetEvent('offtrack', active.lineId));
            state.scan.active = null;
            return;
        }
        active.badSince = 0;
        active.lastGoodAt = now;
        active.lastT = t;
        const bin = Math.min(spec.scan.bins - 1, Math.max(0, Math.floor(clamp(t, 0, 0.999) * spec.scan.bins)));
        active.bins.add(bin);
        if ((active.direction === 'forward' && t >= 1 - spec.scan.startEndTolerance)
            || (active.direction === 'reverse' && t <= spec.scan.startEndTolerance)) {
            active.endCap = true;
        }
        const coverage = active.bins.size / Math.max(1, Number(active.totalBins || spec.scan.bins));
        if (active.endCap && coverage >= spec.scan.minCoverage) {
            state.scan.completedLineIds.add(String(active.lineId));
            events.push({
                type: 'line_complete',
                lineId: active.lineId,
                completedCount: state.scan.completedLineIds.size,
                totalLines: spec.scan.lines.length
            });
            state.scan.active = null;
            if (state.scan.completedLineIds.size >= spec.scan.lines.length) {
                state.satisfied = true;
                events.push({ type: 'survey_complete', mode: 'scan' });
            }
        }
    }

    function makeOrbitResetEvent(reason) {
        return { type: reason === 'altitude' ? 'orbit_reset_altitude' : 'orbit_reset_offtrack', reason };
    }

    function tickOrbitState(spec, state, sample, events) {
        const now = Number(sample.nowMs ?? Date.now());
        if (!Number.isFinite(sample.lat) || !Number.isFinite(sample.lon)) return;
        const altOk = sampleAltitudeOk(spec, sample);
        const speedOk = sampleSpeedOk(spec.orbit.minGroundSpeedKts, sample);
        const distNm = haversineNm(spec.center.lat, spec.center.lon, sample.lat, sample.lon);
        const radialOk = Math.abs(distNm - spec.orbit.radiusNm) <= spec.orbit.radialToleranceNm;
        if (!state.startedAt && distNm <= spec.orbit.radiusNm + spec.orbit.radialToleranceNm) {
            state.startedAt = now;
            events.push({ type: 'survey_area_entered', mode: 'orbit' });
        }
        const valid = altOk && speedOk && radialOk;
        let active = state.orbit.active;
        if (!active && valid) {
            active = {
                sectors: new Set(),
                totalSectors: spec.orbit.sectorsPerTurn,
                startedAt: now,
                lastGoodAt: now,
                badSince: 0,
                lastAngle: bearingDeg(spec.center.lat, spec.center.lon, sample.lat, sample.lon),
                direction: 0
            };
            state.orbit.active = active;
            if (!state.startedAt) state.startedAt = now;
            events.push({ type: 'orbit_started' });
        }
        active = state.orbit.active;
        if (!active) return;
        if (!valid) {
            if (!active.badSince) active.badSince = now;
            const graceMs = Number(spec.orbit.resetGraceSec || DEFAULTS.orbit.resetGraceSec) * 1000;
            if ((now - active.badSince) >= graceMs) {
                const reason = !altOk ? 'altitude' : 'offtrack';
                state.orbit.lastResetReason = reason;
                events.push(makeOrbitResetEvent(reason));
                state.orbit.active = null;
            }
            return;
        }
        active.badSince = 0;
        active.lastGoodAt = now;
        const angle = bearingDeg(spec.center.lat, spec.center.lon, sample.lat, sample.lon);
        const delta = signedAngleDelta(active.lastAngle, angle);
        if (!active.direction && Math.abs(delta) > 2) active.direction = delta > 0 ? 1 : -1;
        if (active.direction && delta * active.direction < -18) {
            state.orbit.lastResetReason = 'offtrack';
            events.push(makeOrbitResetEvent('offtrack'));
            state.orbit.active = null;
            return;
        }
        active.lastAngle = angle;
        const sector = Math.min(spec.orbit.sectorsPerTurn - 1, Math.max(0, Math.floor((angle / 360) * spec.orbit.sectorsPerTurn)));
        active.sectors.add(sector);
        const coverage = active.sectors.size / Math.max(1, Number(active.totalSectors || spec.orbit.sectorsPerTurn));
        const elapsedSec = (now - Number(active.startedAt ?? now)) / 1000;
        if (coverage >= spec.orbit.minTurnCoverage && elapsedSec >= spec.orbit.minTurnSec) {
            state.orbit.completedTurns += 1;
            events.push({
                type: 'orbit_turn_complete',
                completedTurns: state.orbit.completedTurns,
                requiredTurns: spec.orbit.requiredTurns
            });
            state.orbit.active = null;
            if (state.orbit.completedTurns >= spec.orbit.requiredTurns) {
                state.satisfied = true;
                events.push({ type: 'survey_complete', mode: 'orbit' });
            }
        }
    }

    function tickState(specRaw, stateRaw, sampleRaw) {
        const spec = normalizeSpec(specRaw);
        if (!spec) return { handled: false, state: stateRaw || null, events: [], satisfied: false, progress: null };
        const state = stateRaw || createInitialState(spec);
        if (state.specKey !== spec.key) {
            return tickState(spec, createInitialState(spec), sampleRaw);
        }
        if (state.satisfied) {
            return { handled: true, state, events: [], satisfied: true, progress: snapshotState(state) };
        }
        const sample = sampleRaw?.flightData ? sampleFromInput(sampleRaw) : sampleRaw;
        const events = [];
        if (spec.type === 'orbit') tickOrbitState(spec, state, sample, events);
        else tickScanState(spec, state, sample, events);
        state.updatedAt = Number(sample?.nowMs ?? Date.now());
        state.events = events;
        return { handled: true, state, events, satisfied: !!state.satisfied, progress: snapshotState(state) };
    }

    function getMissionSpec(missionData = null, passenger = null) {
        const md = missionData || activeMissionDataFromHost();
        const contract = md?.missionContract || host.activeMissionContract || null;
        let raw = md?.surveyPattern || contract?.surveyPattern || passenger?.surveyPattern || null;
        if (!raw && typeof host.attachMissionSurveyPattern === 'function' && md) {
            try {
                host.attachMissionSurveyPattern(md, contract, passenger || md?.passenger || host.activePassenger || null);
                raw = md?.surveyPattern || contract?.surveyPattern || passenger?.surveyPattern || null;
            } catch (_) {}
        }
        return normalizeSpec(raw);
    }

    function getMapInstance() {
        try {
            if (typeof map !== 'undefined' && map) return map;
        } catch (_) {}
        return host.map || null;
    }

    function ensureOverlayLayer() {
        const mapInstance = getMapInstance();
        if (!mapInstance || typeof L === 'undefined') return null;
        if (!overlayLayer) overlayLayer = L.layerGroup();
        if (!mapInstance.hasLayer(overlayLayer)) overlayLayer.addTo(mapInstance);
        return overlayLayer;
    }

    function clearOverlay() {
        const mapInstance = getMapInstance();
        if (overlayLayer && mapInstance) {
            try { mapInstance.removeLayer(overlayLayer); } catch (_) {}
        }
        overlayLayer = null;
    }

    function lineStyleFor(lineId, state) {
        const completed = state?.scan?.completedLineIds instanceof Set && state.scan.completedLineIds.has(String(lineId));
        const active = String(state?.scan?.active?.lineId || '') === String(lineId);
        if (completed) return { color: '#2fd46f', weight: 7, opacity: 0.96, dashArray: null };
        if (active) return { color: '#f2c94c', weight: 7, opacity: 0.96, dashArray: null };
        return { color: '#ff4d4d', weight: 6, opacity: 0.9, dashArray: null };
    }

    function connectorStyleFor() {
        return {
            color: '#ff6b57',
            weight: 5,
            opacity: 0.72,
            dashArray: null,
            interactive: false
        };
    }

    function scanConnectorArc(lineA, lineB, center, end = 'south') {
        const aPt = end === 'north' ? lineA.start : lineA.end;
        const bPt = end === 'north' ? lineB.start : lineB.end;
        if (!aPt || !bPt) return [];
        const a = localPointNm(aPt.lat, aPt.lon, center.lat, center.lon);
        const b = localPointNm(bPt.lat, bPt.lon, center.lat, center.lon);
        const cx = (a.x + b.x) / 2;
        const cy = (a.y + b.y) / 2;
        const rx = Math.abs(b.x - a.x) / 2;
        if (!(rx > 0.01)) return [[aPt.lat, aPt.lon], [bPt.lat, bPt.lon]];
        const bulgeSign = end === 'north' ? 1 : -1;
        const leftToRight = a.x <= b.x;
        const points = [];
        const steps = 14;
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const x = leftToRight
                ? a.x + (b.x - a.x) * t
                : a.x - (a.x - b.x) * t;
            const yOffset = Math.sqrt(Math.max(0, rx * rx - (x - cx) * (x - cx))) * bulgeSign;
            const ll = localPointToLatLonNm({ x, y: cy + yOffset }, center);
            if (ll) points.push([ll.lat, ll.lon]);
        }
        return points;
    }

    function drawScanConnectors(layer, spec) {
        const lines = Array.isArray(spec?.scan?.lines) ? spec.scan.lines : [];
        if (!layer || typeof L === 'undefined' || lines.length < 2) return;
        for (let i = 0; i < lines.length - 1; i++) {
            const end = i % 2 === 0 ? 'south' : 'north';
            const points = scanConnectorArc(lines[i], lines[i + 1], spec.center, end);
            if (points.length >= 2) L.polyline(points, connectorStyleFor()).addTo(layer);
        }
    }

    function drawOverlay(specRaw = null, progressState = activeState) {
        const spec = normalizeSpec(specRaw);
        if (!spec) {
            clearOverlay();
            return false;
        }
        const layer = ensureOverlayLayer();
        if (!layer || typeof L === 'undefined') return false;
        layer.clearLayers();
        const label = spec.targetAltFt > 0
            ? `${spec.label} · ${spec.targetAltFt} ft`
            : spec.label;
        if (spec.type === 'orbit') {
            const done = progressState?.orbit?.completedTurns >= spec.orbit.requiredTurns;
            L.circle([spec.center.lat, spec.center.lon], {
                radius: spec.orbit.radiusNm * NM_TO_M,
                color: done ? '#2fd46f' : '#ff4d4d',
                weight: 5,
                opacity: 0.9,
                fillColor: '#2d8cff',
                fillOpacity: 0.04,
                dashArray: done ? null : '14,9'
            }).bindTooltip(`${label} · ${spec.orbit.requiredTurns} Kreise`, { permanent: false }).addTo(layer);
        } else {
            drawScanConnectors(layer, spec);
            for (const line of spec.scan.lines) {
                const style = lineStyleFor(line.id, progressState);
                L.polyline([[line.start.lat, line.start.lon], [line.end.lat, line.end.lon]], style)
                    .bindTooltip(`${line.label} · ${label}`, { permanent: false })
                    .addTo(layer);
            }
        }
        if (spec.targetAltFt > 0) {
            L.marker([spec.center.lat, spec.center.lon], {
                icon: L.divIcon({
                    className: '',
                    html: `<div style="background:rgba(12,18,28,0.82);color:#fff;font-size:11px;padding:3px 7px;border-radius:4px;border:1px solid rgba(255,255,255,.35);white-space:nowrap;">Survey · ${spec.targetAltFt} ft</div>`,
                    iconAnchor: [42, 4]
                }),
                interactive: false
            }).addTo(layer);
        }
        return true;
    }

    function tick(input = {}) {
        const spec = getMissionSpec(input.missionData || null, input.passenger || null);
        if (!spec) {
            if (activeSpecKey) reset('no-active-survey');
            return { handled: false, events: [], satisfied: false, progress: null };
        }
        if (!activeState || activeSpecKey !== spec.key || activeState.specKey !== spec.key) {
            activeState = createInitialState(spec);
            activeSpecKey = spec.key;
        }
        const result = tickState(spec, activeState, sampleFromInput(input));
        activeState = result.state;
        drawOverlay(spec, activeState);
        return { ...result, spec, progress: snapshotState(activeState) };
    }

    function restoreProgress(progress = null, missionData = null, passenger = null) {
        const spec = getMissionSpec(missionData, passenger);
        if (!spec || !progress) return false;
        activeState = hydrateState(spec, progress);
        activeSpecKey = spec.key;
        drawOverlay(spec, activeState);
        return true;
    }

    function reset() {
        activeState = null;
        activeSpecKey = '';
        clearOverlay();
    }

    function refreshOverlay(missionData = null, passenger = null) {
        const spec = getMissionSpec(missionData, passenger);
        if (!spec) {
            clearOverlay();
            return false;
        }
        if (!activeState || activeSpecKey !== spec.key) {
            activeState = createInitialState(spec);
            activeSpecKey = spec.key;
        }
        return drawOverlay(spec, activeState);
    }

    function refreshActiveMissionOverlay() {
        const md = activeMissionDataFromHost();
        if (!md) return false;
        try {
            return refreshOverlay(md, host.activePassenger || md?.passenger || null);
        } catch (_) {
            return false;
        }
    }

    function scheduleInitialOverlayRefresh() {
        if (typeof setTimeout !== 'function') return;
        [0, 150, 750, 2000].forEach(delay => {
            setTimeout(refreshActiveMissionOverlay, delay);
        });
    }

    const api = {
        defaults: DEFAULTS,
        getActiveSpec: getMissionSpec,
        normalizeSpec,
        tick,
        restoreProgress,
        reset,
        refreshOverlay,
        refreshActiveMissionOverlay,
        snapshot: () => snapshotState(activeState),
        _test: {
            normalizeSpec,
            createInitialState,
            hydrateState,
            snapshotState,
            tickState,
            buildScanLines,
            destinationPoint,
            haversineNm,
            bearingDeg,
            interpolateLine,
            projectPointToLineNm
        }
    };

    host.missionSurveyPattern = api;
    if (typeof document !== 'undefined') {
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scheduleInitialOverlayRefresh, { once: true });
        else scheduleInitialOverlayRefresh();
    }
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
