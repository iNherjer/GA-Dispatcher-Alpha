(function(root) {
    'use strict';

    const host = root || (typeof globalThis !== 'undefined' ? globalThis : {});
    const EARTH_RADIUS_NM = 3440.065;

    const DEFAULTS = {
        guideMaxCrossTrackNm: 5,
        candidateMaxCrossTrackNm: 2.5,
        clusterRadiusNm: 0.18,
        minSpacingNm: 1.2,
        triggerRadiusNm: 0.45,
        minGuidePoints: 8,
        minPoints: 3,
        maxPoints: 8,
        minScore: 2,
        projectionSlack: 0.06
    };

    const THEME_DEFAULTS = {
        river_bridge_inspection: {
            guideTypes: ['waterway', 'river'],
            candidateMode: 'bridge',
            candidateMaxCrossTrackNm: 0.28,
            clusterRadiusNm: 0.16,
            minSpacingNm: 1.0,
            minScore: 8,
            minPoints: 3,
            maxPoints: 8,
            overlayWidthNm: 0.5,
            overlayLabel: 'Korridor-Brueckenpruefung'
        },
        road_bridge_inspection: {
            guideTypes: ['highway', 'road'],
            candidateMode: 'road_bridge',
            candidateMaxCrossTrackNm: 0.25,
            clusterRadiusNm: 0.16,
            minSpacingNm: 1.0,
            minScore: 8,
            minPoints: 3,
            maxPoints: 8,
            overlayWidthNm: 0.5,
            overlayLabel: 'Strassenbauwerk-Kette'
        },
        road_junction_survey: {
            guideTypes: ['highway', 'road'],
            candidateMode: 'road_junction',
            candidateMaxCrossTrackNm: 1.8,
            clusterRadiusNm: 0.22,
            minSpacingNm: 1.6,
            minScore: 6,
            minPoints: 3,
            maxPoints: 8,
            includePoiLayer: true,
            overlayWidthNm: 0.6,
            overlayLabel: 'Verkehrskorridor'
        },
        rail_chain_inspection: {
            guideTypes: ['railway', 'rail'],
            candidateMode: 'rail',
            guideMaxCrossTrackNm: 1.6,
            candidateMaxCrossTrackNm: 0.28,
            clusterRadiusNm: 0.22,
            minSpacingNm: 1.0,
            minScore: 4,
            minPoints: 3,
            maxPoints: 8,
            includePoiLayer: true,
            overlayWidthNm: 0.5,
            overlayLabel: 'Bahnkorridor'
        },
        power_grid_inspection: {
            guideTypes: ['power', 'powerline', 'line', 'minor_line'],
            candidateMode: 'power',
            guideMaxCrossTrackNm: 3.2,
            candidateMaxCrossTrackNm: 0.65,
            clusterRadiusNm: 0.28,
            minSpacingNm: 1.4,
            minScore: 4,
            minPoints: 2,
            maxPoints: 6,
            overlayWidthNm: 0.7,
            overlayLabel: 'Stromtrassen-Kette'
        },
        generic_poi_chain: {
            guideTypes: [],
            candidateMode: 'generic',
            minScore: 1,
            minPoints: 3,
            maxPoints: 8,
            overlayLabel: 'POI-Kette'
        }
    };

    const ROAD_RANKS = {
        motorway: 9,
        trunk: 8,
        primary: 7,
        secondary: 6,
        tertiary: 5,
        unclassified: 3,
        residential: 2,
        service: 1,
        track: 1
    };

    function cleanText(value, maxLen = 160) {
        const s = String(value || '').replace(/\s+/g, ' ').trim();
        return maxLen > 0 && s.length > maxLen ? s.slice(0, maxLen).trim() : s;
    }

    function asNumber(value, fallback = null) {
        const n = Number(value);
        return Number.isFinite(n) ? n : fallback;
    }

    function roundNumber(value, digits = 6) {
        const n = Number(value);
        if (!Number.isFinite(n)) return null;
        const p = 10 ** digits;
        return Math.round(n * p) / p;
    }

    function stableHash(value) {
        const s = String(value || '');
        let h = 2166136261;
        for (let i = 0; i < s.length; i++) {
            h ^= s.charCodeAt(i);
            h = Math.imul(h, 16777619);
        }
        return h >>> 0;
    }

    function clamp(value, min, max) {
        const n = asNumber(value, min);
        return Math.max(min, Math.min(max, n));
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

    function normalizePattern(pattern) {
        if (!pattern) return null;
        if (pattern instanceof RegExp) return pattern;
        const s = String(pattern || '').trim();
        if (!s) return null;
        try {
            return new RegExp(s, 'i');
        } catch (_) {
            return new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        }
    }

    function localPointNm(lat, lon, originLat, originLon) {
        const avgLat = toRad((Number(lat) + Number(originLat)) / 2);
        return {
            x: (Number(lon) - Number(originLon)) * Math.cos(avgLat) * 60,
            y: (Number(lat) - Number(originLat)) * 60
        };
    }

    function projectPointToSegmentNm(lat, lon, start, end) {
        const e = localPointNm(end.lat, end.lon, start.lat, start.lon);
        const p = localPointNm(lat, lon, start.lat, start.lon);
        const lenSq = e.x * e.x + e.y * e.y;
        const lenNm = Math.sqrt(lenSq);
        if (!(lenSq > 0)) return null;
        const t = (p.x * e.x + p.y * e.y) / lenSq;
        const cx = t * e.x;
        const cy = t * e.y;
        return {
            t,
            tClamped: clamp(t, 0, 1),
            crossTrackNm: Math.sqrt((p.x - cx) ** 2 + (p.y - cy) ** 2),
            alongNm: clamp(t, 0, 1) * lenNm,
            lengthNm: lenNm
        };
    }

    function projectPointToSegmentClampedNm(lat, lon, start, end) {
        const e = localPointNm(end.lat, end.lon, start.lat, start.lon);
        const p = localPointNm(lat, lon, start.lat, start.lon);
        const lenSq = e.x * e.x + e.y * e.y;
        const lenNm = Math.sqrt(lenSq);
        if (!(lenSq > 0)) return null;
        const t = (p.x * e.x + p.y * e.y) / lenSq;
        const tClamped = clamp(t, 0, 1);
        const cx = tClamped * e.x;
        const cy = tClamped * e.y;
        return {
            t,
            tClamped,
            crossTrackNm: Math.sqrt((p.x - cx) ** 2 + (p.y - cy) ** 2),
            alongNm: tClamped * lenNm,
            lengthNm: lenNm
        };
    }

    function guideTraceStepLimitNm(cfg = {}) {
        const theme = String(cfg.theme || '').toLowerCase();
        if (theme === 'river_bridge_inspection') return 0.42;
        if (theme === 'rail_chain_inspection') return 0.55;
        if (theme === 'road_bridge_inspection' || theme === 'road_junction_survey') return 0.65;
        if (theme === 'power_grid_inspection') return 1.4;
        return 0.75;
    }

    function dedupeGuidePoints(points = []) {
        const seen = new Set();
        const out = [];
        for (const point of points || []) {
            const lat = Number(point?.lat);
            const lon = Number(point?.lon);
            if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
            const key = `${Math.round(lat * 1e5)}|${Math.round(lon * 1e5)}`;
            if (seen.has(key)) continue;
            seen.add(key);
            out.push(point);
        }
        return out;
    }

    function nearestGuideIndex(points = [], target = null) {
        if (!Array.isArray(points) || !points.length || !target) return -1;
        let bestIdx = -1;
        let bestDist = Infinity;
        for (let idx = 0; idx < points.length; idx++) {
            const point = points[idx];
            const dist = haversineNm(target.lat, target.lon, point.lat, point.lon);
            if (dist < bestDist) {
                bestDist = dist;
                bestIdx = idx;
            }
        }
        return bestIdx;
    }

    function buildGuideNeighborLookup(points = [], maxStepNm = 0.75) {
        const avgLat = points.reduce((sum, p) => sum + Number(p.lat || 0), 0) / Math.max(1, points.length);
        const cellLat = Math.max(0.002, maxStepNm / 60);
        const cellLon = Math.max(0.002, maxStepNm / (60 * Math.max(0.25, Math.cos(toRad(avgLat)))));
        const buckets = new Map();
        const cellKey = (x, y) => `${x}|${y}`;
        const cellFor = point => ({
            x: Math.floor(Number(point.lat) / cellLat),
            y: Math.floor(Number(point.lon) / cellLon)
        });
        points.forEach((point, idx) => {
            const cell = cellFor(point);
            const key = cellKey(cell.x, cell.y);
            if (!buckets.has(key)) buckets.set(key, []);
            buckets.get(key).push(idx);
        });
        return idx => {
            const point = points[idx];
            const cell = cellFor(point);
            const out = [];
            for (let dx = -1; dx <= 1; dx++) {
                for (let dy = -1; dy <= 1; dy++) {
                    const bucket = buckets.get(cellKey(cell.x + dx, cell.y + dy));
                    if (!bucket) continue;
                    for (const otherIdx of bucket) {
                        if (otherIdx === idx) continue;
                        const other = points[otherIdx];
                        const dist = haversineNm(point.lat, point.lon, other.lat, other.lon);
                        if (dist <= maxStepNm) out.push({ idx: otherIdx, dist });
                    }
                }
            }
            return out;
        };
    }

    function shortestGuidePathIndices(points = [], startIdx = -1, endIdx = -1, maxStepNm = 0.75) {
        const n = Array.isArray(points) ? points.length : 0;
        if (n < 2 || startIdx < 0 || endIdx < 0) return [];
        if (startIdx === endIdx) return [startIdx];
        const neighborsFor = buildGuideNeighborLookup(points, maxStepNm);
        const dist = new Array(n).fill(Infinity);
        const prev = new Array(n).fill(-1);
        const used = new Array(n).fill(false);
        dist[startIdx] = 0;
        for (let step = 0; step < n; step++) {
            let current = -1;
            let best = Infinity;
            for (let idx = 0; idx < n; idx++) {
                if (!used[idx] && dist[idx] < best) {
                    best = dist[idx];
                    current = idx;
                }
            }
            if (current < 0 || current === endIdx) break;
            used[current] = true;
            for (const next of neighborsFor(current)) {
                if (used[next.idx]) continue;
                const cand = dist[current] + next.dist;
                if (cand < dist[next.idx]) {
                    dist[next.idx] = cand;
                    prev[next.idx] = current;
                }
            }
        }
        if (!Number.isFinite(dist[endIdx])) return [];
        const path = [];
        for (let idx = endIdx; idx >= 0; idx = prev[idx]) {
            path.push(idx);
            if (idx === startIdx) break;
        }
        path.reverse();
        return path[0] === startIdx ? path : [];
    }

    function assignGuideTraceProjection(points = [], segment = null) {
        if (!Array.isArray(points) || !points.length) return [];
        let total = 0;
        const distances = [0];
        for (let idx = 1; idx < points.length; idx++) {
            total += haversineNm(points[idx - 1].lat, points[idx - 1].lon, points[idx].lat, points[idx].lon);
            distances[idx] = total;
        }
        return points.map((point, idx) => {
            const fallback = segment ? projectPointToSegmentNm(point.lat, point.lon, segment.start, segment.end) : null;
            const alongNm = distances[idx] || 0;
            const t = total > 0 ? alongNm / total : (points.length > 1 ? idx / (points.length - 1) : 0);
            return {
                ...point,
                _traceOrder: idx,
                _projection: {
                    ...(fallback || point._projection || {}),
                    t,
                    tClamped: clamp(t, 0, 1),
                    alongNm,
                    lengthNm: total
                }
            };
        });
    }

    function segmentProjectionOrder(point = null, segment = null) {
        if (!point || !segment) return Number(point?._projection?.t || 0);
        const proj = projectPointToSegmentNm(point.lat, point.lon, segment.start, segment.end);
        return Number.isFinite(Number(proj?.t)) ? Number(proj.t) : Number(point?._projection?.t || 0);
    }

    function orderGuidePointsBySegmentProjection(points = [], segment = null) {
        const ordered = (Array.isArray(points) ? points : [])
            .slice()
            .sort((a, b) => {
                const at = segmentProjectionOrder(a, segment);
                const bt = segmentProjectionOrder(b, segment);
                if (at !== bt) return at - bt;
                const ad = segment?.start ? haversineNm(segment.start.lat, segment.start.lon, a.lat, a.lon) : 0;
                const bd = segment?.start ? haversineNm(segment.start.lat, segment.start.lon, b.lat, b.lon) : 0;
                return ad - bd;
            });
        return assignGuideTraceProjection(ordered, segment);
    }

    function guidePathZigzagMetrics(points = [], segment = null) {
        const list = Array.isArray(points) ? points : [];
        let sharpTurns = 0;
        let turnSpikes = 0;
        let projectionBacktracks = 0;
        let prevT = null;
        for (let idx = 0; idx < list.length; idx++) {
            const point = list[idx];
            const t = segmentProjectionOrder(point, segment);
            if (prevT !== null && Number.isFinite(t) && t + 0.015 < prevT) projectionBacktracks += 1;
            if (Number.isFinite(t)) prevT = prevT === null ? t : Math.max(prevT, t);
            if (idx <= 0 || idx >= list.length - 1) continue;
            const prev = list[idx - 1];
            const next = list[idx + 1];
            const legIn = haversineNm(prev.lat, prev.lon, point.lat, point.lon);
            const legOut = haversineNm(point.lat, point.lon, next.lat, next.lon);
            const shortcut = haversineNm(prev.lat, prev.lon, next.lat, next.lon);
            if (legIn < 0.04 || legOut < 0.04) continue;
            const b1 = bearingDeg(prev.lat, prev.lon, point.lat, point.lon);
            const b2 = bearingDeg(point.lat, point.lon, next.lat, next.lon);
            const turn = Math.abs((((b2 - b1 + 540) % 360) - 180));
            if (turn > 110) sharpTurns += 1;
            if (turn > 115 && (legIn + legOut) > Math.max(0.2, shortcut * 1.65)) turnSpikes += 1;
        }
        return { sharpTurns, turnSpikes, projectionBacktracks };
    }

    function guidePathNeedsProjectionOrder(points = [], cfg = {}, segment = null) {
        if (!segment || !Array.isArray(points) || points.length < 4) return false;
        const metrics = guidePathZigzagMetrics(points, segment);
        const theme = String(cfg.theme || '').toLowerCase();
        const maxSharpTurns = theme === 'river_bridge_inspection'
            ? Math.max(2, Math.floor(points.length / 7))
            : Math.max(3, Math.floor(points.length / 6));
        const maxTurns = theme === 'river_bridge_inspection'
            ? Math.max(1, Math.floor(points.length / 10))
            : Math.max(2, Math.floor(points.length / 8));
        const maxBacktracks = theme === 'river_bridge_inspection'
            ? Math.max(1, Math.floor(points.length / 14))
            : Math.max(2, Math.floor(points.length / 10));
        return metrics.sharpTurns > maxSharpTurns
            || metrics.turnSpikes > maxTurns
            || metrics.projectionBacktracks > maxBacktracks;
    }

    function orderGuidePointsAlongTrace(points = [], cfg = {}, segment = null) {
        const base = dedupeGuidePoints(points);
        if (base.length < 2) return base;
        const startIdx = nearestGuideIndex(base, cfg.start || segment?.start);
        const endIdx = nearestGuideIndex(base, cfg.end || segment?.end);
        const baseLimit = guideTraceStepLimitNm(cfg);
        const limits = Array.from(new Set([
            baseLimit,
            baseLimit * 1.6,
            baseLimit * 2.4,
            Math.max(baseLimit * 2.4, Number(cfg.guideMaxCrossTrackNm || 0))
        ].map(v => Math.round(Math.max(0.2, Math.min(4, v)) * 100) / 100)));
        for (const limit of limits) {
            const path = shortestGuidePathIndices(base, startIdx, endIdx, limit);
            if (path.length >= Math.min(base.length, Math.max(2, Number(cfg.minGuidePoints || 2)))) {
                const ordered = assignGuideTraceProjection(path.map(idx => base[idx]), segment);
                if (guidePathNeedsProjectionOrder(ordered, cfg, segment)) {
                    return orderGuidePointsBySegmentProjection(ordered, segment);
                }
                return ordered;
            }
        }
        return orderGuidePointsBySegmentProjection(base, segment);
    }

    function valueText(feature, keys) {
        for (const key of keys) {
            const value = feature?.[key];
            if (value !== undefined && value !== null && String(value).trim()) return String(value).trim();
            const tagValue = feature?.tags?.[key];
            if (tagValue !== undefined && tagValue !== null && String(tagValue).trim()) return String(tagValue).trim();
        }
        return '';
    }

    function featureName(feature) {
        return cleanText(valueText(feature, ['name', 'ref', 'operator', 'cluster_sample_names', 'osm_id']), 120);
    }

    function featureTokens(feature) {
        return [
            feature?.name,
            feature?.ref,
            feature?.operator,
            feature?.type,
            feature?.infra_type,
            feature?.cluster_type,
            feature?.waterway,
            feature?.highway,
            feature?.railway,
            feature?.power,
            feature?.man_made,
            feature?.route,
            feature?.line,
            feature?.osm_id
        ].filter(v => v !== undefined && v !== null && String(v).trim()).join(' ');
    }

    function fieldValue(feature, key, fallback = '') {
        const value = feature?.[key];
        if (value !== undefined && value !== null && String(value).trim()) return value;
        const tagValue = feature?.tags?.[key];
        if (tagValue !== undefined && tagValue !== null && String(tagValue).trim()) return tagValue;
        return fallback;
    }

    function hasMeaningfulName(feature) {
        const name = cleanText(feature?.name || '');
        if (!name) return false;
        if (/^(yes|no|bridge|road|track|rail|line|minor_line|station|halt)$/i.test(name)) return false;
        if (/^(baustellenbereich|infrastrukturpunkt)$/i.test(name)) return false;
        return true;
    }

    function isBroadPowerIdentity(value = '') {
        const key = normalizeKey(value);
        if (!key) return true;
        if (/^(power|powerline|power_line|line|minor_line|cable|yes|stromtrasse|stromleitung|freileitung|leitungsabschnitt)$/.test(key)) return true;
        if (/^(110kv|220kv|380kv|110_?000|220_?000|380_?000|10kv|20kv|30kv)$/.test(key)) return true;
        if (/^(enbw|transnetbw|transnetbw_gmbh|db_energie|db_energie_gmbh|badenova|badenovanetz_gmbh|ueberlandwerk_mittelbaden|uberlandwerk_mittelbaden|netze_bw|amprion|tennet|50hertz)$/.test(key)) return true;
        if (/^(energie|netz|strom|stadtwerke|gemeindewerke|ueberlandwerk|uberlandwerk)(_[a-z0-9]+)*$/.test(key)) return true;
        return false;
    }

    function powerGuideIdentity(feature = {}) {
        const name = cleanText(feature.tags?.name || feature.rawName || feature.name || '', 120);
        const ref = cleanText(feature.ref || feature.tags?.ref || '', 80);
        const operator = cleanText(feature.operator || feature.tags?.operator || '', 120);
        const voltage = cleanText(feature.voltage || feature.tags?.voltage || '', 80);
        const osmId = cleanText(feature.osm_id || feature.id || feature.tags?.osm_id || feature.rawId || '', 80);
        if (ref && !isBroadPowerIdentity(ref)) return ref;
        if (name && !isBroadPowerIdentity(name)) return name;
        if (osmId && !isBroadPowerIdentity(osmId)) return `osm:${osmId}`;
        if (operator && voltage && !isBroadPowerIdentity(operator) && !isBroadPowerIdentity(voltage)) return `${operator} ${voltage}`;
        return '';
    }

    function normalizeFeature(raw, sourceLayer = 'unknown', sourceTile = '') {
        if (!raw || typeof raw !== 'object') return null;
        const lat = asNumber(raw.lat ?? raw.latitude);
        const lon = asNumber(raw.lon ?? raw.lng ?? raw.longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
        const tags = (raw.tags && typeof raw.tags === 'object') ? raw.tags : {};
        const sourceKind = String(raw.sourceKind || '').toLowerCase();
        const inferredSourceLayer = sourceLayer && sourceLayer !== 'unknown'
            ? sourceLayer
            : (sourceKind === 'lin'
                ? 'core.lin'
                : (sourceKind === 'infra'
                    ? (tags.infra_cluster ? 'infra.clusters' : 'infra.poi')
                    : (sourceKind === 'poi' ? 'poi.poi' : sourceLayer || 'unknown')));
        const normalized = {
            ...raw,
            lat,
            lon,
            name: cleanText(raw.name || tags.name || raw.ref || tags.ref || raw.operator || tags.operator || raw.cluster_sample_names || tags.cluster_sample_names || ''),
            ref: cleanText(raw.ref || tags.ref || '', 80),
            operator: cleanText(raw.operator || tags.operator || '', 120),
            type: cleanText(raw.type || raw.rawType || tags.layer || tags.obstacle_type || '', 80).toLowerCase(),
            infra_type: cleanText(raw.infra_type || tags.infra_type || '', 80).toLowerCase(),
            cluster_type: cleanText(raw.cluster_type || tags.cluster_type || '', 80).toLowerCase(),
            waterway: cleanText(raw.waterway || tags.waterway || '', 80).toLowerCase(),
            water: cleanText(raw.water || tags.water || '', 80).toLowerCase(),
            highway: cleanText(raw.highway || tags.highway || '', 80).toLowerCase(),
            railway: cleanText(raw.railway || tags.railway || '', 80).toLowerCase(),
            power: cleanText(raw.power || tags.power || '', 80).toLowerCase(),
            man_made: cleanText(raw.man_made || tags.man_made || '', 80).toLowerCase(),
            route: cleanText(raw.route || tags.route || '', 80).toLowerCase(),
            line: cleanText(raw.line || tags.line || '', 80).toLowerCase(),
            bridge: cleanText(raw.bridge || tags.bridge || '', 80).toLowerCase(),
            substation: cleanText(raw.substation || tags.substation || '', 80).toLowerCase(),
            voltage: cleanText(raw.voltage || tags.voltage || '', 80),
            sample_count: Number(raw.sample_count || tags.sample_count || tags.cluster_count || raw.cluster_count || 0),
            cluster_count: Number(raw.cluster_count || tags.cluster_count || 0),
            cluster_sample_names: cleanText(raw.cluster_sample_names || tags.cluster_sample_names || '', 180),
            sourceLayer: inferredSourceLayer,
            sourceTile: cleanText(sourceTile || raw.sourceTile || raw.tile || '', 40)
        };
        normalized._tokens = featureTokens(normalized).toLowerCase();
        normalized._name = featureName(normalized);
        normalized._id = cleanText([
            inferredSourceLayer,
            sourceTile || raw.sourceTile || raw.tile || '',
            raw.osm_kind || '',
            raw.osm_id || '',
            normalized.infra_type || normalized.cluster_type || normalized.type || '',
            roundNumber(lat, 5),
            roundNumber(lon, 5)
        ].join(':').replace(/:+/g, ':'), 220);
        return normalized;
    }

    function inferSourceLayer(item, fallback = 'unknown') {
        const sourceLayer = String(item?.sourceLayer || '').toLowerCase();
        if (sourceLayer === 'core.lin' || sourceLayer === 'core.poi' || sourceLayer === 'core.obs' || sourceLayer === 'infra.poi' || sourceLayer === 'infra.clusters' || sourceLayer === 'poi.poi') return sourceLayer;
        const sourceKind = String(item?.sourceKind || '').toLowerCase();
        const tags = item?.tags && typeof item.tags === 'object' ? item.tags : {};
        if (sourceKind === 'lin') return 'core.lin';
        if (sourceKind === 'infra') return tags.infra_cluster ? 'infra.clusters' : 'infra.poi';
        if (sourceKind === 'poi') return 'poi.poi';
        if (sourceKind === 'obs') return 'core.obs';
        return fallback || 'unknown';
    }

    function pushPayloadFeatures(out, payload, layerName) {
        if (!payload) return;
        if (Array.isArray(payload)) {
            for (const item of payload) {
                const f = normalizeFeature(item, inferSourceLayer(item, layerName || 'unknown'), item?.sourceTile || item?.tile || '');
                if (f) out.push(f);
            }
            return;
        }
        if (typeof payload !== 'object') return;
        const tile = String(payload.tile || payload.meta?.tile || '');
        const pushList = (list, sourceLayer) => {
            if (!Array.isArray(list)) return;
            for (const item of list) {
                const f = normalizeFeature(item, sourceLayer, tile);
                if (f) out.push(f);
            }
        };
        if (layerName === 'core' || !layerName) {
            pushList(payload.core?.lin, 'core.lin');
            pushList(payload.core?.poi, 'core.poi');
        }
        if (layerName === 'infra' || !layerName) {
            pushList(payload.infra?.poi, 'infra.poi');
            pushList(payload.infra?.clusters, 'infra.clusters');
        }
        if (layerName === 'poi' || !layerName) {
            pushList(payload.poi?.poi, 'poi.poi');
        }
    }

    function collectFeatures(tileBundle = {}) {
        const core = [];
        const infra = [];
        const poi = [];
        const asList = value => Array.isArray(value) ? value : [];
        const pushFlat = list => {
            for (const item of asList(list)) {
                const sourceLayer = inferSourceLayer(item);
                const bucket = sourceLayer.startsWith('infra.') ? infra : (sourceLayer.startsWith('poi.') ? poi : core);
                const f = normalizeFeature(item, sourceLayer, item?.sourceTile || item?.tile || '');
                if (f) bucket.push(f);
            }
        };
        pushFlat(tileBundle.features);
        pushFlat(tileBundle.allFeatures);
        pushFlat(tileBundle.flatFeatures);
        for (const payload of asList(tileBundle.coreTiles || tileBundle.core || tileBundle.tiles)) pushPayloadFeatures(core, payload, 'core');
        for (const payload of asList(tileBundle.infraTiles || tileBundle.infra)) pushPayloadFeatures(infra, payload, 'infra');
        for (const payload of asList(tileBundle.poiTiles || tileBundle.poi)) pushPayloadFeatures(poi, payload, 'poi');
        if (Array.isArray(tileBundle.allTiles)) {
            for (const payload of tileBundle.allTiles) pushPayloadFeatures(core, payload, 'core');
            for (const payload of tileBundle.allTiles) pushPayloadFeatures(infra, payload, 'infra');
            for (const payload of tileBundle.allTiles) pushPayloadFeatures(poi, payload, 'poi');
        }
        return { core, infra, poi };
    }

    function normalizeConfig(input = {}) {
        const themeId = String(input.theme || input.kind || 'generic_poi_chain').toLowerCase();
        const themeDefaults = THEME_DEFAULTS[themeId] || THEME_DEFAULTS.generic_poi_chain;
        const cfg = {
            ...DEFAULTS,
            ...themeDefaults,
            ...input,
            theme: themeId
        };
        cfg.guideNamePattern = normalizePattern(input.guideNamePattern || input.guidePattern || input.guideName || input.namePattern);
        cfg.candidateNamePattern = normalizePattern(input.candidateNamePattern || input.candidatePattern);
        cfg.guideFeatureIds = Array.isArray(input.guideFeatureIds)
            ? input.guideFeatureIds.map(value => String(value || '').trim()).filter(Boolean)
            : [];
        cfg.guideTypes = Array.isArray(input.guideTypes) && input.guideTypes.length
            ? input.guideTypes.map(v => String(v).toLowerCase())
            : (themeDefaults.guideTypes || []).map(v => String(v).toLowerCase());
        cfg.start = normalizePoint(input.start || input.from || input.begin);
        cfg.end = normalizePoint(input.end || input.to || input.finish);
        cfg.minGuidePoints = Math.max(2, Math.round(Number(cfg.minGuidePoints || DEFAULTS.minGuidePoints)));
        cfg.minPoints = Math.max(1, Math.round(Number(cfg.minPoints || DEFAULTS.minPoints)));
        cfg.maxPoints = Math.max(cfg.minPoints, Math.round(Number(cfg.maxPoints || DEFAULTS.maxPoints)));
        cfg.guideMaxCrossTrackNm = Math.max(0.2, Number(cfg.guideMaxCrossTrackNm || DEFAULTS.guideMaxCrossTrackNm));
        cfg.candidateMaxCrossTrackNm = Math.max(0.1, Number(cfg.candidateMaxCrossTrackNm || DEFAULTS.candidateMaxCrossTrackNm));
        cfg.overlayWidthNm = Math.max(0.3, Math.min(8, Number(cfg.overlayWidthNm || Math.max(0.5, cfg.candidateMaxCrossTrackNm * 1.2))));
        cfg.clusterRadiusNm = Math.max(0.03, Number(cfg.clusterRadiusNm || DEFAULTS.clusterRadiusNm));
        cfg.minSpacingNm = Math.max(0.05, Number(cfg.minSpacingNm || DEFAULTS.minSpacingNm));
        cfg.minScore = Number.isFinite(Number(cfg.minScore)) ? Number(cfg.minScore) : DEFAULTS.minScore;
        cfg.projectionSlack = Math.max(0, Math.min(0.3, Number(cfg.projectionSlack || DEFAULTS.projectionSlack)));
        cfg.triggerRadiusNm = Math.max(0.1, Number(cfg.triggerRadiusNm || DEFAULTS.triggerRadiusNm));
        cfg.sequenceRequired = cfg.sequenceRequired !== false;
        return cfg;
    }

    function normalizePoint(point) {
        if (!point || typeof point !== 'object') return null;
        const lat = asNumber(point.lat);
        const lon = asNumber(point.lon ?? point.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
        return { lat, lon, label: cleanText(point.label || point.name || '') };
    }

    function typeMatches(feature, types) {
        if (!types || !types.length) return true;
        const values = [
            feature.type,
            feature.infra_type,
            feature.cluster_type,
            feature.waterway,
            feature.highway,
            feature.railway,
            feature.power,
            feature.route,
            feature.man_made
        ].map(v => String(v || '').toLowerCase()).filter(Boolean);
        return types.some(type => values.includes(type) || values.some(v => v.indexOf(type) >= 0));
    }

    function guideMatches(feature, cfg, segment) {
        if (!feature || !segment) return false;
        if (!typeMatches(feature, cfg.guideTypes)) return false;
        if (cfg.guideNamePattern && !cfg.guideNamePattern.test(featureTokens(feature))) return false;
        const proj = projectPointToSegmentNm(feature.lat, feature.lon, segment.start, segment.end);
        if (!proj) return false;
        if (proj.t < -cfg.projectionSlack || proj.t > 1 + cfg.projectionSlack) return false;
        if (proj.crossTrackNm > cfg.guideMaxCrossTrackNm) return false;
        feature._projection = proj;
        return true;
    }

    function isBridge(feature) {
        const infraType = String(feature.infra_type || feature.cluster_type || '').toLowerCase();
        const bridge = String(feature.bridge || '').toLowerCase();
        const manMade = String(feature.man_made || '').toLowerCase();
        return infraType === 'bridge' || bridge === 'yes' || bridge === 'viaduct' || manMade === 'bridge';
    }

    function isRoadBridge(feature) {
        if (!isBridge(feature)) return false;
        const highway = String(feature.highway || '').toLowerCase();
        return Boolean(highway && highway !== 'path' && highway !== 'footway' && highway !== 'cycleway') || !String(feature.railway || '').trim();
    }

    function isRoadJunction(feature) {
        const highway = String(feature.highway || '').toLowerCase();
        const infraType = String(feature.infra_type || feature.cluster_type || '').toLowerCase();
        return highway === 'motorway_junction'
            || highway === 'trunk_junction'
            || infraType === 'road_junction'
            || /\b(motorway_junction|anschlussstelle|kreuz|dreieck)\b/i.test(featureTokens(feature));
    }

    function isRailPoint(feature) {
        const railway = String(feature.railway || '').toLowerCase();
        const infraType = String(feature.infra_type || feature.cluster_type || '').toLowerCase();
        return infraType === 'rail'
            || infraType === 'railway'
            || ['station', 'halt', 'signal_box', 'switch', 'level_crossing', 'crossing', 'junction', 'buffer_stop', 'yard'].includes(railway);
    }

    function isPowerPoint(feature) {
        const power = String(feature.power || '').toLowerCase();
        const infraType = String(feature.infra_type || feature.cluster_type || '').toLowerCase();
        const manMade = String(feature.man_made || '').toLowerCase();
        return infraType === 'power'
            || infraType === 'power_grid'
            || infraType === 'power_station'
            || ['substation', 'switchgear', 'tower', 'pole', 'line', 'minor_line', 'plant', 'generator'].includes(power)
            || manMade === 'power_tower';
    }

    function candidateMatchesMode(feature, mode) {
        const m = String(mode || 'generic').toLowerCase();
        if (m === 'bridge') return isBridge(feature);
        if (m === 'road_bridge') return isRoadBridge(feature);
        if (m === 'road_junction') return isRoadJunction(feature);
        if (m === 'rail') return isRailPoint(feature);
        if (m === 'power') return isPowerPoint(feature);
        return true;
    }

    function scoreBridge(feature) {
        let score = 0;
        const highway = String(feature.highway || '').toLowerCase();
        const railway = String(feature.railway || '').toLowerCase();
        if (highway) score += ROAD_RANKS[highway] || 2;
        if (railway === 'rail') score += 6;
        if (railway && railway !== 'rail') score += 3;
        if (String(feature.ref || '').trim()) score += 2;
        if (hasMeaningfulName(feature)) score += 2;
        if (Number(feature.sample_count) >= 4) score += 1;
        if (String(feature.service || '').toLowerCase() === 'yard') score -= 2;
        return score;
    }

    function scoreRoadJunction(feature) {
        let score = 0;
        const highway = String(feature.highway || '').toLowerCase();
        if (highway === 'motorway_junction') score += 8;
        if (highway === 'trunk_junction') score += 7;
        if (/^(kreuz|dreieck)\b/i.test(feature.name || '')) score += 3;
        if (String(feature.ref || '').trim()) score += 2;
        if (hasMeaningfulName(feature)) score += 2;
        return score;
    }

    function scoreRail(feature) {
        let score = 0;
        const railway = String(feature.railway || '').toLowerCase();
        const infraType = String(feature.infra_type || '').toLowerCase();
        if (railway === 'station') score += 8;
        else if (railway === 'halt') score += 6;
        else if (railway === 'signal_box') score += 5;
        else if (railway === 'switch') score += 4;
        else if (railway === 'level_crossing' || railway === 'crossing') score += 3;
        else if (railway === 'junction') score += 4;
        else if (railway === 'rail') score += 1;
        if (infraType === 'bridge') score += 2;
        if (hasMeaningfulName(feature)) score += 2;
        if (String(feature.operator || '').trim()) score += 1;
        if (/^(db infrago|db netz)$/i.test(feature.name || '')) score -= 2;
        return score;
    }

    function scorePower(feature) {
        let score = 0;
        const power = String(feature.power || '').toLowerCase();
        const infraType = String(feature.infra_type || feature.cluster_type || '').toLowerCase();
        if (power === 'substation' || String(feature.substation || '').trim()) score += 8;
        else if (power === 'switchgear') score += 7;
        else if (power === 'plant') score += 6;
        else if (power === 'line') score += 5;
        else if (power === 'tower') score += 4;
        else if (power === 'minor_line') score += 1;
        else if (power === 'pole') score += 1;
        if (infraType === 'power_grid' || infraType === 'power_station') score += 3;
        if (hasMeaningfulName(feature)) score += 2;
        if (String(feature.operator || '').trim()) score += 1;
        if (String(feature.voltage || '').trim()) score += 1;
        return score;
    }

    function scoreGeneric(feature) {
        let score = 1;
        if (hasMeaningfulName(feature)) score += 2;
        if (String(feature.ref || '').trim()) score += 1;
        if (String(feature.operator || '').trim()) score += 1;
        return score;
    }

    function scoreCandidate(feature, cfg) {
        const mode = String(cfg.candidateMode || 'generic').toLowerCase();
        let score = 0;
        if (mode === 'bridge' || mode === 'road_bridge') score = scoreBridge(feature);
        else if (mode === 'road_junction') score = scoreRoadJunction(feature);
        else if (mode === 'rail') score = scoreRail(feature);
        else if (mode === 'power') score = scorePower(feature);
        else score = scoreGeneric(feature);
        if (cfg.candidateNamePattern && cfg.candidateNamePattern.test(featureTokens(feature))) score += 3;
        return score;
    }

    function collectCandidatePool(features, cfg) {
        const pool = [];
        pool.push(...features.infra);
        if (cfg.includePoiLayer !== false) pool.push(...features.poi);
        if (cfg.includeCorePoiLayer) pool.push(...features.core.filter(f => f.sourceLayer === 'core.poi'));
        return pool;
    }

    function findGuidePoints(features, cfg, segment) {
        const scopedGuideIds = new Set(Array.isArray(cfg.guideFeatureIds) ? cfg.guideFeatureIds : []);
        if (scopedGuideIds.size) {
            const matched = features.core
                .filter(f => f.sourceLayer === 'core.lin')
                .filter(f => scopedGuideIds.has(f._id))
                .filter(f => typeMatches(f, cfg.guideTypes));
            return orderGuidePointsAlongTrace(matched, cfg, segment);
        }
        const matched = features.core
            .filter(f => f.sourceLayer === 'core.lin')
            .filter(f => guideMatches(f, cfg, segment));
        return orderGuidePointsAlongTrace(matched, cfg, segment);
    }

    function turnDeltaDeg(a = null, b = null, c = null) {
        if (!a || !b || !c) return 0;
        const b1 = bearingDeg(a.lat, a.lon, b.lat, b.lon);
        const b2 = bearingDeg(b.lat, b.lon, c.lat, c.lon);
        return Math.abs((((b2 - b1 + 540) % 360) - 180));
    }

    function smoothGuideTracePoints(points = [], cfg = {}) {
        let out = Array.isArray(points) ? points.slice() : [];
        if (out.length < 5) return out;
        const theme = String(cfg.theme || '').toLowerCase();
        const turnLimit = theme === 'river_bridge_inspection' ? 105 : 120;
        const minKeep = Math.max(3, Math.ceil(out.length * (theme === 'river_bridge_inspection' ? 0.6 : 0.72)));
        for (let pass = 0; pass < 4 && out.length > minKeep; pass++) {
            let changed = false;
            const next = [out[0]];
            for (let idx = 1; idx < out.length - 1; idx++) {
                const prev = next[next.length - 1];
                const point = out[idx];
                const after = out[idx + 1];
                const legIn = haversineNm(prev.lat, prev.lon, point.lat, point.lon);
                const legOut = haversineNm(point.lat, point.lon, after.lat, after.lon);
                const shortcut = haversineNm(prev.lat, prev.lon, after.lat, after.lon);
                const turn = turnDeltaDeg(prev, point, after);
                const canDrop = turn > turnLimit
                    && legIn > 0.04
                    && legOut > 0.04
                    && (legIn + legOut) > Math.max(0.12, shortcut * 1.08)
                    && (next.length + (out.length - idx - 1)) >= minKeep;
                if (canDrop) {
                    changed = true;
                    continue;
                }
                next.push(point);
            }
            next.push(out[out.length - 1]);
            out = next;
            if (!changed) break;
        }
        return out;
    }

    function buildGuideTrace(guidePoints = [], maxPoints = 48, cfg = {}) {
        const points = smoothGuideTracePoints((Array.isArray(guidePoints) ? guidePoints : [])
            .filter(point => Number.isFinite(Number(point.lat)) && Number.isFinite(Number(point.lon)))
            .sort((a, b) => {
                const ao = Number.isFinite(Number(a._traceOrder)) ? Number(a._traceOrder) : Number(a._projection?.t || 0);
                const bo = Number.isFinite(Number(b._traceOrder)) ? Number(b._traceOrder) : Number(b._projection?.t || 0);
                return ao - bo;
            }), cfg);
        if (points.length < 2) return [];
        const limit = Math.max(2, Math.min(80, Math.round(Number(maxPoints || 48))));
        const step = Math.max(1, Math.ceil(points.length / limit));
        const sampled = [];
        for (let idx = 0; idx < points.length; idx += step) sampled.push(points[idx]);
        if (sampled[sampled.length - 1] !== points[points.length - 1]) sampled.push(points[points.length - 1]);
        const out = [];
        for (const point of sampled) {
            const tracePoint = {
                lat: roundNumber(point.lat),
                lon: roundNumber(point.lon)
            };
            const last = out[out.length - 1] || null;
            if (last && haversineNm(last.lat, last.lon, tracePoint.lat, tracePoint.lon) < 0.04) continue;
            out.push(tracePoint);
        }
        return out.length >= 2 ? out : [];
    }

    function nearestGuideProjection(feature, guidePoints) {
        if (!Array.isArray(guidePoints) || !guidePoints.length) return null;
        if (guidePoints.length >= 2) {
            let bestSegment = null;
            for (let idx = 1; idx < guidePoints.length; idx++) {
                const start = guidePoints[idx - 1];
                const end = guidePoints[idx];
                const seg = projectPointToSegmentClampedNm(feature.lat, feature.lon, start, end);
                if (!seg) continue;
                const startAlong = Number(start._projection?.alongNm || 0);
                const segmentLen = haversineNm(start.lat, start.lon, end.lat, end.lon);
                const traceLength = Number(end._projection?.lengthNm || start._projection?.lengthNm || seg.lengthNm || 0);
                const alongNm = startAlong + (seg.tClamped * segmentLen);
                const t = traceLength > 0 ? alongNm / traceLength : Number(start._projection?.t || 0);
                const candidate = {
                    t,
                    tClamped: clamp(t, 0, 1),
                    crossTrackNm: seg.crossTrackNm,
                    alongNm,
                    lengthNm: traceLength || seg.lengthNm,
                    guideSegmentIndex: idx - 1
                };
                if (!bestSegment || candidate.crossTrackNm < bestSegment.crossTrackNm) bestSegment = candidate;
            }
            if (bestSegment) return bestSegment;
        }
        let best = null;
        for (const guide of guidePoints) {
            const distNm = haversineNm(feature.lat, feature.lon, guide.lat, guide.lon);
            if (!best || distNm < best.crossTrackNm) {
                best = {
                    t: guide._projection?.t ?? 0,
                    tClamped: guide._projection?.tClamped ?? clamp(guide._projection?.t ?? 0, 0, 1),
                    crossTrackNm: distNm,
                    alongNm: guide._projection?.alongNm ?? 0,
                    lengthNm: guide._projection?.lengthNm ?? 0
                };
            }
        }
        return best;
    }

    function guideProximityScore(projection, cfg = {}) {
        const theme = String(cfg.theme || '').toLowerCase();
        const x = Number(projection?.crossTrackNm);
        if (!Number.isFinite(x)) return 0;
        if (theme === 'river_bridge_inspection') {
            if (x <= 0.08) return 5;
            if (x <= 0.16) return 3;
            if (x <= 0.24) return 1;
            if (x > 0.3) return -3;
        }
        if (theme === 'rail_chain_inspection') {
            if (x <= 0.06) return 5;
            if (x <= 0.14) return 3;
            if (x <= 0.22) return 1;
            if (x > 0.25) return -2;
        }
        if (theme === 'power_grid_inspection') {
            if (x <= 0.12) return 5;
            if (x <= 0.28) return 3;
            if (x <= 0.45) return 1;
            if (x > 0.55) return -2;
        }
        return 0;
    }

    function findCandidates(features, cfg, segment, guidePoints) {
        const raw = collectCandidatePool(features, cfg);
        const candidates = [];
        for (const feature of raw) {
            if (!candidateMatchesMode(feature, cfg.candidateMode)) continue;
            if (cfg.candidateNamePattern && !cfg.candidateNamePattern.test(featureTokens(feature)) && String(cfg.candidateMode) === 'generic') continue;
            const proj = projectPointToSegmentNm(feature.lat, feature.lon, segment.start, segment.end);
            if (!proj) continue;
            if (proj.t < -cfg.projectionSlack || proj.t > 1 + cfg.projectionSlack) continue;
            const guideProj = nearestGuideProjection(feature, guidePoints);
            const effectiveProj = guideProj || proj;
            if (effectiveProj.crossTrackNm > cfg.candidateMaxCrossTrackNm) continue;
            const baseScore = scoreCandidate(feature, cfg);
            const proximityScore = guideProximityScore(effectiveProj, cfg);
            const score = baseScore + proximityScore;
            if (score < cfg.minScore) continue;
            candidates.push({
                ...feature,
                _projection: effectiveProj,
                _segmentProjection: proj,
                _baseScore: baseScore,
                _proximityScore: proximityScore,
                _guideCrossTrackNm: effectiveProj.crossTrackNm,
                _score: score
            });
        }
        return candidates.sort((a, b) => a._projection.t - b._projection.t || b._score - a._score);
    }

    function chooseBetterCandidate(a, b) {
        if (!a) return b;
        if (!b) return a;
        if (b._score !== a._score) return b._score > a._score ? b : a;
        if (hasMeaningfulName(b) !== hasMeaningfulName(a)) return hasMeaningfulName(b) ? b : a;
        const bSamples = Number(b.sample_count || b.cluster_count || 0);
        const aSamples = Number(a.sample_count || a.cluster_count || 0);
        if (bSamples !== aSamples) return bSamples > aSamples ? b : a;
        return a;
    }

    function clusterCandidates(candidates, radiusNm) {
        const clusters = [];
        for (const candidate of candidates) {
            let cluster = null;
            for (const existing of clusters) {
                if (haversineNm(candidate.lat, candidate.lon, existing.lat, existing.lon) <= radiusNm) {
                    cluster = existing;
                    break;
                }
            }
            if (!cluster) {
                clusters.push({
                    lat: candidate.lat,
                    lon: candidate.lon,
                    members: [candidate],
                    representative: candidate
                });
            } else {
                cluster.members.push(candidate);
                cluster.representative = chooseBetterCandidate(cluster.representative, candidate);
                cluster.lat = cluster.members.reduce((sum, f) => sum + f.lat, 0) / cluster.members.length;
                cluster.lon = cluster.members.reduce((sum, f) => sum + f.lon, 0) / cluster.members.length;
            }
        }
        return clusters.map(cluster => {
            const rep = cluster.representative;
            return {
                ...rep,
                lat: rep.lat,
                lon: rep.lon,
                _clusterCount: cluster.members.length,
                _clusterMembers: cluster.members.map(f => f._id).slice(0, 8)
            };
        }).sort((a, b) => a._projection.t - b._projection.t || b._score - a._score);
    }

    function selectSpacedCandidates(clustered, cfg) {
        const selected = [];
        for (const candidate of clustered) {
            const nearIdx = selected.findIndex(existing => haversineNm(existing.lat, existing.lon, candidate.lat, candidate.lon) < cfg.minSpacingNm);
            if (nearIdx >= 0) {
                selected[nearIdx] = chooseBetterCandidate(selected[nearIdx], candidate);
                selected.sort((a, b) => a._projection.t - b._projection.t || b._score - a._score);
                continue;
            }
            selected.push(candidate);
            selected.sort((a, b) => a._projection.t - b._projection.t || b._score - a._score);
        }
        if (selected.length <= cfg.maxPoints) return selected;
        const keep = [];
        const step = (selected.length - 1) / Math.max(1, cfg.maxPoints - 1);
        const used = new Set();
        for (let i = 0; i < cfg.maxPoints; i++) {
            const idx = Math.round(i * step);
            let bestIdx = idx;
            for (let delta = 0; delta < selected.length; delta++) {
                const left = idx - delta;
                const right = idx + delta;
                if (left >= 0 && !used.has(left)) { bestIdx = left; break; }
                if (right < selected.length && !used.has(right)) { bestIdx = right; break; }
            }
            used.add(bestIdx);
            keep.push(selected[bestIdx]);
        }
        return keep.sort((a, b) => a._projection.t - b._projection.t || b._score - a._score);
    }

    function categoryFor(feature, mode) {
        const m = String(mode || '').toLowerCase();
        if (m === 'road_bridge') return 'road_bridge';
        if (m === 'road_junction') return 'road_junction';
        if (m === 'bridge') {
            if (String(feature.railway || '').toLowerCase()) return 'rail_bridge';
            if (String(feature.highway || '').toLowerCase()) return 'road_bridge';
            return 'bridge';
        }
        if (m === 'rail') {
            const railway = String(feature.railway || '').toLowerCase();
            return railway ? `rail_${railway}` : 'rail_point';
        }
        if (m === 'power') {
            const power = String(feature.power || feature.substation || '').toLowerCase();
            if (power === 'substation') return 'power_substation';
            if (power === 'line' || power === 'minor_line') return 'power_line';
            if (power === 'tower' || power === 'pole') return 'power_support';
            return 'power_grid';
        }
        return cleanText(feature.infra_type || feature.highway || feature.railway || feature.power || 'poi', 60);
    }

    function pointDisplayName(feature, mode, index) {
        const name = featureName(feature);
        const normalizedName = cleanText(name, 80).toLowerCase().replace(/[_-]+/g, ' ');
        const railway = String(feature.railway || '').toLowerCase();
        if ((String(mode || '').toLowerCase() === 'rail' || railway) && (isBroadRailOperator(name) || /\brail\s+switch\b/i.test(normalizedName) || /^switch\s*\d+$/i.test(normalizedName) || (/^\d{1,3}[a-z]?$/i.test(normalizedName) && railway === 'switch'))) {
            if (railway === 'switch') return `Weiche ${index + 1}`;
            if (railway === 'level_crossing' || railway === 'crossing') return `Bahnuebergang ${index + 1}`;
            if (railway === 'signal_box') return `Stellwerk ${index + 1}`;
            if (railway === 'junction') return `Bahnknoten ${index + 1}`;
            return `Bahninfrastruktur ${index + 1}`;
        }
        if (String(mode || '').toLowerCase() === 'power') {
            const power = String(feature.power || feature.substation || '').toLowerCase();
            const looksLikeRawId = /^\d{6,}$/.test(normalizedName);
            const broad = !name || looksLikeRawId || isBroadPowerIdentity(name);
            if (!broad) return name;
            if (power === 'substation' || String(feature.substation || '').trim()) return `Umspannpunkt ${index + 1}`;
            if (power === 'line' || power === 'minor_line') return `Leitungsabschnitt ${index + 1}`;
            if (power === 'tower' || power === 'pole') return `Maststandort ${index + 1}`;
            return `Netzpunkt ${index + 1}`;
        }
        if (name) return name;
        const cat = categoryFor(feature, mode).replace(/_/g, ' ');
        return `${cat} ${index + 1}`;
    }

    function buildPoint(feature, cfg, index, prev) {
        const distPrev = prev ? haversineNm(prev.lat, prev.lon, feature.lat, feature.lon) : 0;
        const bearingPrev = prev ? bearingDeg(prev.lat, prev.lon, feature.lat, feature.lon) : null;
        const category = categoryFor(feature, cfg.candidateMode);
        let displayName = pointDisplayName(feature, cfg.candidateMode, index);
        if (category === 'rail_switch' && /\b(rail\s+switch|switch)\b|^\d{1,3}[a-z]?$/i.test(cleanText(displayName, 80).toLowerCase())) {
            displayName = `Weiche ${index + 1}`;
        }
        return {
            id: cleanText(`chain-${cfg.theme}-${index + 1}-${feature._id || `${feature.lat},${feature.lon}`}`, 180),
            index,
            name: displayName,
            lat: roundNumber(feature.lat),
            lon: roundNumber(feature.lon),
            category,
            triggerRadiusNm: roundNumber(cfg.triggerRadiusNm, 2),
            revealState: index === 0 ? 'visible' : 'hidden',
            required: true,
            sourceLayer: feature.sourceLayer || 'unknown',
            sourceTile: feature.sourceTile || '',
            score: roundNumber(feature._score, 2),
            orderT: roundNumber(feature._projection?.t, 4),
            distCorridorNm: roundNumber(feature._projection?.crossTrackNm, 3),
            distanceFromPrevNm: roundNumber(distPrev, 2),
            bearingFromPrevDeg: bearingPrev === null ? null : Math.round(bearingPrev),
            clusterCount: Math.max(1, Number(feature._clusterCount || feature.cluster_count || 1)),
            tags: {
                ref: cleanText(feature.ref || '', 80),
                highway: cleanText(feature.highway || '', 80),
                railway: cleanText(feature.railway || '', 80),
                power: cleanText(feature.power || '', 80),
                waterway: cleanText(feature.waterway || '', 80),
                infraType: cleanText(feature.infra_type || feature.cluster_type || '', 80),
                operator: cleanText(feature.operator || '', 120),
                guideCrossTrackNm: roundNumber(feature._guideCrossTrackNm, 3),
                baseScore: roundNumber(feature._baseScore, 2),
                proximityScore: roundNumber(feature._proximityScore, 2)
            }
        };
    }

    function chainOutcomeEligiblePoints(points = []) {
        return (Array.isArray(points) ? points : [])
            .filter(point => point && Number(point.index) > 0 && Number(point.index) < points.length - 1);
    }

    function themeFindingTemplate(theme = '') {
        const t = String(theme || '').toLowerCase();
        if (t === 'rail_chain_inspection') {
            return {
                findingKind: 'observation',
                findingHint: 'Auffälligkeit im Bereich von Trasse, Weiche, Signal oder Böschung; die Luftbilder sollen gezielt ausgewertet werden.',
                paxFindingText: 'Hier markiere ich einen möglichen Nachprüfpunkt an der Trasse. Ich will die Bilder später genauer mit Plan und Streckenlage abgleichen, bevor daraus ein gezielter Folgeflug wird.'
            };
        }
        if (t === 'power_grid_inspection') {
            return {
                findingKind: 'observation',
                findingHint: 'Auffälligkeit an Leitung, Mastumfeld oder Schneise; die Bildserie soll gezielt nachbewertet werden.',
                paxFindingText: 'Diesen Abschnitt nehme ich als möglichen Nachprüfpunkt mit. Bei Leitungen zählt der Verlauf im Zusammenhang, deshalb entscheiden wir nach der Bildauswertung über den nächsten Schritt.'
            };
        }
        if (t === 'road_junction_survey') {
            return {
                findingKind: 'observation',
                findingHint: 'Unklare Veränderung im Knoten- oder Anschlussbereich; die Aufnahmen sollen vor einer Bodenrunde geprüft werden.',
                paxFindingText: 'Hier setze ich eine Markierung für die spätere Auswertung. Der Knoten wirkt nicht akut, aber die Bilder sollten vor einer Bodenrunde sauber verglichen werden.'
            };
        }
        return {
            findingKind: 'observation',
            findingHint: 'Auffälligkeit an Bauwerk, Anschluss oder Umfeld; die Luftbilder sollen vor einer Einzelprüfung genauer ausgewertet werden.',
            paxFindingText: 'Bei diesem Punkt nehme ich einen möglichen Anschlussbedarf mit. Die Fotos sollten später genauer ausgewertet werden, bevor daraus eine Einzelprüfung wird.'
        };
    }

    function buildSilentChainOutcome(points = [], cfg = {}) {
        const eligible = chainOutcomeEligiblePoints(points);
        const seed = [
            cfg.theme,
            cfg.label,
            cfg.start?.lat,
            cfg.start?.lon,
            cfg.end?.lat,
            cfg.end?.lon,
            points.map(point => point.id || point.name || '').join('|')
        ].join('|');
        const roll = stableHash(`${seed}|chain-outcome`) % 100;
        if (!eligible.length || roll >= 34) {
            return {
                schema: 'ga.poiChainOutcome.v1',
                outcome: 'clear',
                followUpKind: 'none',
                hiddenFromWriter: true,
                revealAfter: 'point_complete',
                createdAt: 0
            };
        }
        const point = eligible[stableHash(`${seed}|finding-point`) % eligible.length];
        const template = themeFindingTemplate(cfg.theme);
        return {
            schema: 'ga.poiChainOutcome.v1',
            outcome: 'monitor',
            followUpKind: 'infra_recheck',
            followUpProfileId: 'inspection_infra',
            followUpCategory: point.category || 'infrastructure',
            pointId: point.id,
            pointIndex: point.index,
            pointName: point.name,
            findingKind: template.findingKind,
            findingHint: template.findingHint,
            paxFindingText: template.paxFindingText,
            hiddenFromWriter: true,
            revealAfter: 'point_complete',
            createdAt: 0
        };
    }

    function applySilentChainOutcome(points = [], outcome = null) {
        if (!outcome || outcome.outcome === 'clear' || !outcome.pointId) return points;
        return points.map(point => {
            if (String(point.id || '') !== String(outcome.pointId || '')) return point;
            const tags = point.tags && typeof point.tags === 'object' ? point.tags : {};
            return {
                ...point,
                tags: {
                    ...tags,
                    finding: outcome.findingKind || 'observation',
                    findingHint: outcome.findingHint || '',
                    paxFindingText: outcome.paxFindingText || '',
                    followUpType: outcome.followUpKind || 'infra_recheck',
                    followUpKind: outcome.followUpKind || 'infra_recheck',
                    hiddenFromWriter: true,
                    revealAfter: 'point_complete'
                }
            };
        });
    }

    function validateChainQuality(points = [], cfg = {}) {
        const theme = String(cfg.theme || '').toLowerCase();
        if (theme === 'road_bridge_inspection') {
            const allowedCrossTrack = Math.max(0.08, Number(cfg.overlayWidthNm || 0.5) / 2);
            const outliers = (Array.isArray(points) ? points : [])
                .map(point => Number(point?.distCorridorNm || 0))
                .filter(value => Number.isFinite(value) && value > allowedCrossTrack + 0.01);
            const metrics = {
                maxPointCrossTrackNm: roundNumber(Math.max(0, ...((Array.isArray(points) ? points : [])
                    .map(point => Number(point?.distCorridorNm || 0))
                    .filter(value => Number.isFinite(value)))), 3),
                allowedCrossTrackNm: roundNumber(allowedCrossTrack, 3),
                outlierCount: outliers.length
            };
            if (outliers.length) {
                return {
                    ok: false,
                    status: 'weak_road_bridge_chain',
                    reason: `road bridge chain has points outside the visible corridor (max ${metrics.maxPointCrossTrackNm}NM)`,
                    metrics
                };
            }
            return { ok: true, metrics };
        }
        if (theme !== 'power_grid_inspection') return { ok: true };
        const gaps = (Array.isArray(points) ? points : [])
            .map(point => Number(point?.distanceFromPrevNm || 0))
            .filter(value => Number.isFinite(value) && value > 0);
        if (!gaps.length) return { ok: true };
        const maxGap = Math.max(...gaps);
        const avgGap = gaps.reduce((sum, value) => sum + value, 0) / gaps.length;
        const longGaps = gaps.filter(value => value > 5.4).length;
        const veryLongGaps = gaps.filter(value => value > 7.0).length;
        const metrics = {
            maxPointGapNm: roundNumber(maxGap, 2),
            avgPointGapNm: roundNumber(avgGap, 2),
            longPointGaps: longGaps,
            veryLongPointGaps: veryLongGaps
        };
        if (veryLongGaps > 0) {
            return {
                ok: false,
                status: 'weak_power_chain',
                reason: `power chain point gap too large (${roundNumber(maxGap, 2)}NM)`,
                metrics
            };
        }
        if (longGaps >= 2 || (longGaps >= 1 && avgGap > 4.6)) {
            return {
                ok: false,
                status: 'weak_power_chain',
                reason: `power chain has multiple long point gaps (max ${roundNumber(maxGap, 2)}NM)`,
                metrics
            };
        }
        return { ok: true, metrics };
    }

    function statusResult(status, reason, cfg, diagnostics, extra = {}) {
        return {
            ok: false,
            status,
            reason,
            chain: null,
            diagnostics: {
                theme: cfg.theme,
                candidateMode: cfg.candidateMode,
                ...diagnostics
            },
            ...extra
        };
    }

    function buildPoiChain(config = {}, tileBundle = {}) {
        const cfg = normalizeConfig(config);
        const diagnostics = {
            ordering: 'guide_trace_projection',
            guideScope: cfg.guideFeatureIds?.length ? 'selected_component' : 'pattern_or_segment',
            featureCounts: null,
            guidePoints: 0,
            rawCandidates: 0,
            clusteredCandidates: 0,
            selectedPoints: 0
        };
        if (!cfg.start || !cfg.end) {
            return statusResult('invalid_config', 'start and end points are required', cfg, diagnostics);
        }
        const segment = { start: cfg.start, end: cfg.end };
        const features = collectFeatures(tileBundle);
        diagnostics.featureCounts = {
            core: features.core.length,
            infra: features.infra.length,
            poi: features.poi.length
        };
        const guidePoints = findGuidePoints(features, cfg, segment);
        diagnostics.guidePoints = guidePoints.length;
        diagnostics.guideNames = summarizeNames(guidePoints, 8);
        if (guidePoints.length < cfg.minGuidePoints) {
            return statusResult('insufficient_corridor', `only ${guidePoints.length} guide points matched`, cfg, diagnostics);
        }
        const rawCandidates = findCandidates(features, cfg, segment, guidePoints);
        diagnostics.rawCandidates = rawCandidates.length;
        diagnostics.candidateNames = summarizeNames(rawCandidates, 10);
        if (!rawCandidates.length) {
            return statusResult('insufficient_candidates', 'no matching candidates near guide corridor', cfg, diagnostics);
        }
        const clustered = clusterCandidates(rawCandidates, cfg.clusterRadiusNm);
        diagnostics.clusteredCandidates = clustered.length;
        const selected = selectSpacedCandidates(clustered, cfg);
        diagnostics.selectedPoints = selected.length;
        diagnostics.selectedNames = summarizeNames(selected, 12);
        if (selected.length < cfg.minPoints) {
            return statusResult('insufficient_chain', `only ${selected.length} selected points after clustering/spacing`, cfg, diagnostics);
        }
        const points = [];
        for (const feature of selected) {
            points.push(buildPoint(feature, cfg, points.length, points[points.length - 1] || null));
        }
        const quality = validateChainQuality(points, cfg);
        diagnostics.quality = quality.metrics || null;
        if (!quality.ok) {
            return statusResult(quality.status || 'weak_chain', quality.reason || 'chain quality rejected', cfg, diagnostics);
        }
        const hiddenOutcome = buildSilentChainOutcome(points, cfg);
        const runtimePoints = applySilentChainOutcome(points, hiddenOutcome);
        const trace = buildGuideTrace(guidePoints, 48, cfg);
        const chain = {
            schema: 'ga.poiChain.v1',
            kind: 'poi_chain',
            mode: 'progressive_reveal',
            theme: cfg.theme,
            label: cleanText(cfg.label || cfg.title || cfg.overlayLabel || 'POI-Kette', 120),
            guide: {
                type: cfg.guideTypes[0] || '',
                namePattern: String(config.guideNamePattern || config.guidePattern || config.guideName || ''),
                start: {
                    lat: roundNumber(cfg.start.lat),
                    lon: roundNumber(cfg.start.lon),
                    label: cfg.start.label || ''
                },
                end: {
                    lat: roundNumber(cfg.end.lat),
                    lon: roundNumber(cfg.end.lon),
                    label: cfg.end.label || ''
                },
                guidePointCount: guidePoints.length
            },
            overlay: {
                type: 'corridor_hint',
                label: cleanText(cfg.overlayLabel || cfg.label || 'Korridor', 120),
                start: { lat: roundNumber(cfg.start.lat), lon: roundNumber(cfg.start.lon) },
                end: { lat: roundNumber(cfg.end.lat), lon: roundNumber(cfg.end.lon) },
                radiusNm: roundNumber(cfg.candidateMaxCrossTrackNm, 2),
                widthNm: roundNumber(cfg.overlayWidthNm, 2),
                trace
            },
            points: runtimePoints,
            hiddenOutcome,
            sequenceRequired: cfg.sequenceRequired,
            completionMode: 'all_required',
            fallbackAllowed: true,
            debug: {
                ordering: diagnostics.ordering,
                minSpacingNm: roundNumber(cfg.minSpacingNm, 2),
                clusterRadiusNm: roundNumber(cfg.clusterRadiusNm, 2),
                candidateMaxCrossTrackNm: roundNumber(cfg.candidateMaxCrossTrackNm, 2)
            }
        };
        return {
            ok: true,
            status: 'ready',
            reason: '',
            chain,
            diagnostics: {
                theme: cfg.theme,
                candidateMode: cfg.candidateMode,
                ...diagnostics
            }
        };
    }

    function summarizeNames(features, maxCount) {
        const out = [];
        const seen = new Set();
        for (const feature of features || []) {
            const label = featureName(feature) || cleanText(feature.infra_type || feature.highway || feature.railway || feature.power || feature.type || '', 80);
            if (!label) continue;
            const key = label.toLowerCase();
            if (seen.has(key)) continue;
            seen.add(key);
            out.push(label);
            if (out.length >= maxCount) break;
        }
        return out;
    }

    function guideKindForFeature(feature) {
        if (!feature || feature.sourceLayer !== 'core.lin') return '';
        const waterway = String(fieldValue(feature, 'waterway') || '').toLowerCase();
        const water = String(fieldValue(feature, 'water') || '').toLowerCase();
        const natural = String(fieldValue(feature, 'natural') || '').toLowerCase();
        const highway = String(fieldValue(feature, 'highway') || '').toLowerCase();
        const railway = String(fieldValue(feature, 'railway') || '').toLowerCase();
        const power = String(fieldValue(feature, 'power') || '').toLowerCase();
        const layer = String(fieldValue(feature, 'layer') || '').toLowerCase();
        const type = String(feature.type || feature.rawType || '').toLowerCase();
        const hydroTypes = ['river', 'stream', 'canal', 'ditch', 'drain', 'water', 'lake', 'reservoir', 'dam', 'weir'];
        const roadTypes = ['highway', 'motorway', 'motorway_link', 'trunk', 'trunk_link', 'primary', 'primary_link', 'secondary', 'secondary_link', 'tertiary', 'tertiary_link', 'residential', 'service', 'road'];
        const railTypes = ['railway', 'rail', 'tram', 'light_rail', 'subway', 'narrow_gauge'];
        const powerTypes = ['power', 'powerline', 'power_line', 'line', 'minor_line', 'cable'];
        if (['river', 'stream', 'canal', 'ditch', 'drain'].includes(waterway) || water === 'river' || natural === 'water' || layer === 'hydro' || hydroTypes.includes(type)) return 'waterway';
        if (highway || layer === 'road' || roadTypes.includes(type)) return 'road';
        if (railway || layer === 'rail' || railTypes.includes(type)) return 'rail';
        if (['line', 'minor_line', 'cable', 'powerline', 'power_line'].includes(power) || layer === 'power' || powerTypes.includes(type)) return 'power';
        return '';
    }

    function guideGroupKey(feature, kind = '') {
        const k = String(kind || guideKindForFeature(feature) || '').toLowerCase();
        const rawName = cleanText(feature.tags?.name || feature.rawName || '', 120);
        const name = cleanText(feature.name || '', 120);
        const ref = cleanText(feature.ref || '', 80);
        const operator = cleanText(feature.operator || '', 120);
        const voltage = cleanText(feature.voltage || '', 80);
        const railway = cleanText(feature.railway || '', 80);
        const highway = cleanText(feature.highway || '', 80);
        const waterway = cleanText(feature.waterway || '', 80);
        let identity = '';
        if (k === 'waterway') {
            // Unnamed river/stream/canal tags merge unrelated hydro fragments into
            // broad "Gewässerkorridor" chains that are not visually legible in flight.
            identity = name || ref;
        }
        else if (k === 'road') identity = ref || name || highway;
        else if (k === 'rail') {
            const lineName = railLineIdentityName({ ...feature, name: rawName || name });
            identity = ref || lineName || 'rail';
        }
        else if (k === 'power') identity = powerGuideIdentity(feature);
        else identity = name || ref || operator || feature.type || 'line';
        if (!identity) return '';
        return `${k}:${normalizeKey(identity)}`;
    }

    function normalizeKey(value) {
        return String(value || '')
            .toLowerCase()
            .normalize('NFKD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, ' ')
            .trim()
            .replace(/\s+/g, '_');
    }

    function guideGroupLabel(feature, kind = '') {
        const k = String(kind || guideKindForFeature(feature) || '').toLowerCase();
        if (k === 'road') return cleanText(feature.ref || feature.name || feature.highway || 'Straßenkorridor', 120);
        if (k === 'rail') return cleanText(feature.ref || railLineIdentityName(feature) || 'Bahnkorridor', 120);
        if (k === 'power') {
            const ref = cleanText(feature.ref || '', 80);
            const name = cleanText(feature.name || '', 120);
            const operator = cleanText(feature.operator || '', 120);
            if (ref && !isBroadPowerIdentity(ref)) return ref;
            if (name && !isBroadPowerIdentity(name)) return name;
            if (operator && !isBroadPowerIdentity(operator)) return operator;
            return 'Stromtrasse';
        }
        if (k === 'waterway') return cleanText(feature.name || feature.ref || 'Gewässerkorridor', 120);
        return cleanText(feature.name || feature.ref || 'Korridor', 120);
    }

    function isBroadRailOperator(value = '') {
        return /^(db\s*(netz|infrago|energie)?|deutsche\s+bahn|db|bahn|railway|rail|disused|yes)$/i.test(cleanText(value, 80));
    }

    function railLineIdentityName(feature = null) {
        if (!feature) return '';
        const rawName = cleanText(feature.tags?.name || feature.rawName || '', 120);
        const name = cleanText(rawName || feature.name || '', 120);
        const operator = cleanText(feature.operator || feature.tags?.operator || '', 120);
        if (!name || isBroadRailOperator(name)) return '';
        if (operator && normalizeKey(name) === normalizeKey(operator) && isBroadRailOperator(operator)) return '';
        return name;
    }

    function groupGuideFeatures(features) {
        const groups = new Map();
        for (const feature of features?.core || []) {
            const kind = guideKindForFeature(feature);
            if (!kind) continue;
            const key = guideGroupKey(feature, kind);
            if (!key) continue;
            const existing = groups.get(key) || {
                key,
                kind,
                label: guideGroupLabel(feature, kind),
                features: []
            };
            existing.features.push(feature);
            if (!existing.label || existing.label === 'Korridor') existing.label = guideGroupLabel(feature, kind);
            groups.set(key, existing);
        }
        return Array.from(groups.values()).filter(group => group.features.length >= 3);
    }

    function spatialComponentLabel(group, features) {
        const base = cleanText(group?.label || '', 120);
        const kind = String(group?.kind || '').toLowerCase();
        const genericByKind = {
            rail: /^bahn(korridor)?$/i,
            waterway: /^gew[aä]sser(korridor)?$/i,
            road: /^stra(?:ss|ß)en?korridor$/i,
            power: /^stromtrasse$/i
        };
        const genericPattern = genericByKind[kind] || /^korridor$/i;
        if (base && !genericPattern.test(base)) return base;
        const named = (Array.isArray(features) ? features : [])
            .map(feature => {
                if (kind === 'rail') return cleanText(feature.ref || railLineIdentityName(feature) || '', 80);
                if (kind === 'waterway') return cleanText(feature.name || feature.ref || '', 80);
                if (kind === 'road') return cleanText(feature.ref || feature.name || '', 80);
                if (kind === 'power') return cleanText(feature.name || feature.ref || feature.operator || '', 80);
                return cleanText(feature.name || feature.ref || '', 80);
            })
            .filter(Boolean);
        const unique = Array.from(new Set(named));
        if (unique.length) return unique.slice(0, 2).join(' - ');
        if (kind === 'waterway') return 'Gewässerkorridor';
        if (kind === 'road') return 'Straßenkorridor';
        if (kind === 'power') return 'Stromtrasse';
        return 'Bahnkorridor';
    }

    function splitGuideGroupSpatialComponents(group, { maxGapNm = 1.8, minFeatures = 3 } = {}) {
        const features = Array.isArray(group?.features) ? group.features : [];
        if (features.length < minFeatures) return [];
        const avgLat = features.reduce((sum, f) => sum + Number(f.lat || 0), 0) / Math.max(1, features.length);
        const cellLat = Math.max(0.005, maxGapNm / 60);
        const cellLon = Math.max(0.005, maxGapNm / (60 * Math.max(0.25, Math.cos(toRad(avgLat)))));
        const parent = features.map((_, idx) => idx);
        const find = idx => {
            while (parent[idx] !== idx) {
                parent[idx] = parent[parent[idx]];
                idx = parent[idx];
            }
            return idx;
        };
        const union = (a, b) => {
            const ra = find(a);
            const rb = find(b);
            if (ra !== rb) parent[rb] = ra;
        };
        const cells = new Map();
        const cellKey = (x, y) => `${x}|${y}`;
        features.forEach((feature, idx) => {
            const x = Math.floor(Number(feature.lat) / cellLat);
            const y = Math.floor(Number(feature.lon) / cellLon);
            for (let dx = -1; dx <= 1; dx++) {
                for (let dy = -1; dy <= 1; dy++) {
                    const bucket = cells.get(cellKey(x + dx, y + dy));
                    if (!bucket) continue;
                    for (const otherIdx of bucket) {
                        const other = features[otherIdx];
                        if (haversineNm(feature.lat, feature.lon, other.lat, other.lon) <= maxGapNm) {
                            union(idx, otherIdx);
                        }
                    }
                }
            }
            const key = cellKey(x, y);
            if (!cells.has(key)) cells.set(key, []);
            cells.get(key).push(idx);
        });
        const buckets = new Map();
        features.forEach((feature, idx) => {
            const root = find(idx);
            if (!buckets.has(root)) buckets.set(root, []);
            buckets.get(root).push(feature);
        });
        return Array.from(buckets.values())
            .filter(list => list.length >= minFeatures)
            .sort((a, b) => b.length - a.length)
            .map((list, idx) => ({
                ...group,
                key: `${group.key}:component_${idx + 1}`,
                label: spatialComponentLabel(group, list),
                features: list,
                componentIndex: idx,
                parentKey: group.key,
                parentLabel: group.label,
                componentCount: buckets.size
            }));
    }

    function themeGuideKind(theme = '') {
        const t = String(theme || '').toLowerCase();
        if (t === 'river_bridge_inspection') return 'waterway';
        if (t === 'road_bridge_inspection' || t === 'road_junction_survey') return 'road';
        if (t === 'rail_chain_inspection') return 'rail';
        if (t === 'power_grid_inspection') return 'power';
        return '';
    }

    function themesForProspectOptions(options = {}) {
        const forced = String(options.forceTheme || options.theme || '').toLowerCase();
        if (forced && forced !== 'auto' && THEME_DEFAULTS[forced]) return [forced];
        const cat = String(options.category || options.selectedCategory || 'all').toLowerCase();
        if (cat === 'bridge') return ['river_bridge_inspection', 'road_bridge_inspection'];
        if (cat === 'road') return ['road_bridge_inspection', 'road_junction_survey'];
        if (cat === 'rail') return ['rail_chain_inspection'];
        if (cat === 'infrastructure' || cat === 'industry' || cat === 'all' || cat === 'chain') {
            return ['river_bridge_inspection', 'road_bridge_inspection', 'road_junction_survey', 'rail_chain_inspection', 'power_grid_inspection'];
        }
        // Debug/forced chain dispatch can be requested while the picker still
        // carries a concrete POI category such as dam or telecom. Treat those
        // as a broad infrastructure-chain search instead of disabling the
        // prospector after the expensive tile load.
        return ['river_bridge_inspection', 'road_bridge_inspection', 'road_junction_survey', 'rail_chain_inspection', 'power_grid_inspection'];
    }

    function farthestGuidePair(group, maxSample = 80) {
        const points = Array.isArray(group?.features) ? group.features : [];
        if (points.length < 2) return null;
        const step = Math.max(1, Math.ceil(points.length / maxSample));
        const sampled = points.filter((_, idx) => idx % step === 0);
        if (sampled[sampled.length - 1] !== points[points.length - 1]) sampled.push(points[points.length - 1]);
        let best = null;
        for (let i = 0; i < sampled.length; i++) {
            for (let j = i + 1; j < sampled.length; j++) {
                const a = sampled[i];
                const b = sampled[j];
                const dist = haversineNm(a.lat, a.lon, b.lat, b.lon);
                if (!best || dist > best.distNm) best = { a, b, distNm: dist };
            }
        }
        return best;
    }

    function directionMatchesBearing(bearing, dirPref = 'any') {
        const pref = String(dirPref || 'any').toLowerCase();
        if (!pref || pref === 'any' || pref === 'all') return true;
        const b = ((Number(bearing) % 360) + 360) % 360;
        const sectors = {
            n: [315, 45],
            ne: [0, 90],
            e: [45, 135],
            se: [90, 180],
            s: [135, 225],
            sw: [180, 270],
            w: [225, 315],
            nw: [270, 360]
        };
        const sector = sectors[pref];
        if (!sector) return true;
        const [start, end] = sector;
        return start <= end ? (b >= start && b <= end) : (b >= start || b <= end);
    }

    function buildProspectLabel(theme, groupLabel, chain) {
        const label = cleanText(groupLabel || '', 80);
        if (theme === 'river_bridge_inspection') {
            const generic = !label || /^gew[aä]sser(korridor)?$/i.test(label);
            if (generic && Array.isArray(chain?.points) && chain.points.length >= 2) {
                const first = cleanText(chain.points[0]?.name || '', 42);
                const last = cleanText(chain.points[chain.points.length - 1]?.name || '', 42);
                if (first && last && normalizeKey(first) !== normalizeKey(last)) return `Brückenkette ${first} - ${last}`;
            }
            if (generic) return 'Brückenkette im Gewässerkorridor';
            return `Brückenkette ${label}`;
        }
        if (theme === 'road_bridge_inspection') return label ? `Bauwerkskette ${label}` : 'Straßenbauwerkskette';
        if (theme === 'road_junction_survey') return label ? `Verkehrskorridor ${label}` : 'Verkehrskorridor';
        if (theme === 'rail_chain_inspection') {
            const generic = !label || /^bahn(korridor)?$/i.test(label) || isBroadRailOperator(label);
            if (generic && Array.isArray(chain?.points) && chain.points.length >= 2) {
                const first = cleanText(chain.points[0]?.name || '', 42);
                const last = cleanText(chain.points[chain.points.length - 1]?.name || '', 42);
                if (first && last && normalizeKey(first) !== normalizeKey(last)) return `Bahnkorridor ${first} - ${last}`;
            }
            return label ? `Bahnkorridor ${label}` : 'Bahnkorridor';
        }
        if (theme === 'power_grid_inspection') {
            const generic = !label || isBroadPowerIdentity(label) || /^stromtrasse$/i.test(label);
            if (generic && Array.isArray(chain?.points) && chain.points.length >= 2) {
                const useful = chain.points
                    .map(point => cleanText(point?.name || '', 42))
                    .filter(name => name && !isBroadPowerIdentity(name) && !/^\d{6,}$/.test(name) && !/^(power|strom|leitungs?)\s*(line|grid|support)?\s*\d*$/i.test(name));
                const first = useful[0] || '';
                const last = useful[useful.length - 1] || '';
                if (first && last && normalizeKey(first) !== normalizeKey(last)) return `Stromtrasse ${first} - ${last}`;
                if (first) return `Stromtrasse ${first}`;
            }
            if (generic) return 'Stromtrassenabschnitt';
            return `Stromtrasse ${label.replace(/^stromtrasse\s+/i, '').trim() || label}`;
        }
        return chain?.label || 'POI-Kette';
    }

    function scoreProspect(result, group, navFirst, theme) {
        const points = Number(result?.chain?.points?.length || 0);
        const guidePoints = Number(result?.diagnostics?.guidePoints || 0);
        const dist = Number(navFirst?.dist || 0);
        const themeBonus = {
            river_bridge_inspection: 12,
            road_bridge_inspection: 9,
            road_junction_survey: 8,
            rail_chain_inspection: 7,
            power_grid_inspection: 5
        }[theme] || 0;
        return (points * 24) + Math.min(guidePoints, 80) * 0.25 + Math.min(Number(group?.features?.length || 0), 80) * 0.15 + themeBonus - Math.abs(dist - 22) * 0.35;
    }

    function componentGapNmForTheme(theme = '') {
        const t = String(theme || '').toLowerCase();
        if (t === 'rail_chain_inspection') return 1.8;
        if (t === 'river_bridge_inspection') return 1.6;
        if (t === 'power_grid_inspection') return 1.4;
        return 2.4;
    }

    function buildPoiChainProspects(options = {}, tileBundle = {}) {
        const features = collectFeatures(tileBundle);
        const dispatchStart = normalizePoint({
            lat: options.dispatchStartLat ?? options.startLat ?? options.lat,
            lon: options.dispatchStartLon ?? options.startLon ?? options.lon
        });
        const minNM = Math.max(0, Number(options.minNM || 0));
        const maxNM = Math.max(minNM + 0.1, Number(options.maxNM || 9999));
        const dirPref = String(options.dirPref || 'any').toLowerCase();
        const themes = themesForProspectOptions(options);
        const groupPattern = normalizePattern(options.guideNamePattern || options.guidePattern || options.guideName || '');
        const maxGroupsPerTheme = Math.max(2, Math.min(16, Math.round(Number(options.maxGroupsPerTheme || 6))));
        const stopAfterProspects = Math.max(0, Math.min(16, Math.round(Number(options.stopAfterProspects || 0))));
        const diagnostics = {
            featureCounts: {
                core: features.core.length,
                infra: features.infra.length,
                poi: features.poi.length
            },
            themes,
            groups: 0,
            components: 0,
            tested: 0,
            rejected: []
        };
        if (!dispatchStart || !themes.length) {
            return { ok: false, status: 'disabled', prospects: [], diagnostics };
        }
        const groups = groupGuideFeatures(features);
        diagnostics.groups = groups.length;
        const prospects = [];
        for (const theme of themes) {
            const guideKind = themeGuideKind(theme);
            const matchingBaseGroups = groups
                .filter(group => !guideKind || group.kind === guideKind)
                .filter(group => !groupPattern || groupPattern.test(`${group.label} ${group.key}`));
            const matchingGroups = matchingBaseGroups.flatMap(group => splitGuideGroupSpatialComponents(group, {
                maxGapNm: componentGapNmForTheme(theme),
                minFeatures: theme === 'rail_chain_inspection' ? 5 : 3
            }));
            diagnostics.components += matchingGroups.length;
            const preparedGroups = [];
            for (const group of matchingGroups) {
                const pair = farthestGuidePair(group);
                if (!pair || pair.distNm < 3) continue;
                const distA = haversineNm(dispatchStart.lat, dispatchStart.lon, pair.a.lat, pair.a.lon);
                const distB = haversineNm(dispatchStart.lat, dispatchStart.lon, pair.b.lat, pair.b.lon);
                const start = distA <= distB ? pair.a : pair.b;
                const end = distA <= distB ? pair.b : pair.a;
                const firstDist = Math.min(distA, distB);
                const firstBearing = bearingDeg(dispatchStart.lat, dispatchStart.lon, start.lat, start.lon);
                if (firstDist > maxNM + 18 || firstDist < Math.max(0, minNM - 18)) continue;
                if (!directionMatchesBearing(firstBearing, dirPref) && firstDist > minNM) continue;
                preparedGroups.push({
                    group,
                    pair,
                    start,
                    end,
                    firstDist,
                    firstBearing,
                    preScore: pair.distNm + Math.min(group.features.length, 80) * 0.12 - Math.abs(firstDist - Math.max(10, minNM)) * 0.12
                });
            }
            preparedGroups.sort((a, b) => b.preScore - a.preScore);
            diagnostics[`${theme}_groupsTestable`] = preparedGroups.length;
            let acceptedForTheme = 0;
            for (const prepared of preparedGroups.slice(0, maxGroupsPerTheme)) {
                const { group, pair, start, end } = prepared;
                const cfg = {
                    theme,
                    label: buildProspectLabel(theme, group.label),
                    start: { lat: start.lat, lon: start.lon, label: group.label },
                    end: { lat: end.lat, lon: end.lon, label: group.label },
                    minPoints: options.minPoints,
                    maxPoints: options.maxPoints,
                    minGuidePoints: options.minGuidePoints,
                    projectionSlack: options.projectionSlack,
                    triggerRadiusNm: options.triggerRadiusNm,
                    guideFeatureIds: group.features.map(feature => feature._id).filter(Boolean)
                };
                diagnostics.tested += 1;
                const result = buildPoiChain(cfg, { features: features.core.concat(features.infra, features.poi) });
                if (!result.ok || !result.chain?.points?.length) {
                    diagnostics.rejected.push({ theme, group: group.label, status: result.status, reason: result.reason });
                    continue;
                }
                result.chain.label = buildProspectLabel(theme, group.label, result.chain);
                result.chain.guide.name = group.label;
                result.chain.guide.groupKey = group.key;
                result.chain.dispatch = {
                    firstPointDistanceNm: null,
                    firstPointBearingDeg: null,
                    selectedBy: 'poi-chain-prospector'
                };
                const first = result.chain.points[0];
                const navFirst = first
                    ? {
                        dist: haversineNm(dispatchStart.lat, dispatchStart.lon, first.lat, first.lon),
                        brng: bearingDeg(dispatchStart.lat, dispatchStart.lon, first.lat, first.lon)
                    }
                    : null;
                if (!navFirst || navFirst.dist < minNM || navFirst.dist > maxNM || !directionMatchesBearing(navFirst.brng, dirPref)) {
                    diagnostics.rejected.push({
                        theme,
                        group: group.label,
                        status: 'dispatch_filter',
                        distNm: navFirst ? roundNumber(navFirst.dist, 2) : null,
                        bearingDeg: navFirst ? Math.round(navFirst.brng) : null
                    });
                    continue;
                }
                result.chain.dispatch.firstPointDistanceNm = roundNumber(navFirst.dist, 2);
                result.chain.dispatch.firstPointBearingDeg = Math.round(navFirst.brng);
                prospects.push({
                    ok: true,
                    status: 'ready',
                    theme,
                    group: {
                        key: group.key,
                        kind: group.kind,
                        label: group.label,
                        featureCount: group.features.length,
                        parentKey: group.parentKey || null,
                        componentIndex: Number.isFinite(Number(group.componentIndex)) ? Number(group.componentIndex) : null,
                        componentCount: Number.isFinite(Number(group.componentCount)) ? Number(group.componentCount) : null
                    },
                    score: roundNumber(scoreProspect(result, group, navFirst, theme), 2),
                    chain: result.chain,
                    diagnostics: result.diagnostics
                });
                acceptedForTheme += 1;
                if (stopAfterProspects && acceptedForTheme >= stopAfterProspects) {
                    break;
                }
            }
        }
        prospects.sort((a, b) => b.score - a.score);
        return {
            ok: prospects.length > 0,
            status: prospects.length > 0 ? 'ready' : 'no_chain',
            prospects,
            diagnostics: {
                ...diagnostics,
                rejected: diagnostics.rejected.slice(0, 16)
            }
        };
    }

    function compactPoiChain(chain = null, maxPoints = 8) {
        if (!chain || typeof chain !== 'object') return null;
        const points = Array.isArray(chain.points) ? chain.points.slice(0, maxPoints) : [];
        return {
            schema: chain.schema || 'ga.poiChain.v1',
            kind: chain.kind || 'poi_chain',
            mode: chain.mode || 'progressive_reveal',
            theme: String(chain.theme || ''),
            label: cleanText(chain.label || '', 120),
            guide: chain.guide ? {
                type: cleanText(chain.guide.type || '', 80),
                name: cleanText(chain.guide.name || chain.guide.namePattern || '', 120),
                start: chain.guide.start || null,
                end: chain.guide.end || null,
                guidePointCount: Number(chain.guide.guidePointCount || 0)
            } : null,
            overlay: chain.overlay || null,
            hiddenOutcome: chain.hiddenOutcome && typeof chain.hiddenOutcome === 'object'
                ? {
                    schema: chain.hiddenOutcome.schema || 'ga.poiChainOutcome.v1',
                    outcome: cleanText(chain.hiddenOutcome.outcome || '', 40),
                    followUpKind: cleanText(chain.hiddenOutcome.followUpKind || '', 80),
                    followUpProfileId: cleanText(chain.hiddenOutcome.followUpProfileId || '', 80),
                    followUpCategory: cleanText(chain.hiddenOutcome.followUpCategory || '', 80),
                    pointId: cleanText(chain.hiddenOutcome.pointId || '', 180),
                    pointIndex: Number.isFinite(Number(chain.hiddenOutcome.pointIndex)) ? Number(chain.hiddenOutcome.pointIndex) : null,
                    pointName: cleanText(chain.hiddenOutcome.pointName || '', 120),
                    findingKind: cleanText(chain.hiddenOutcome.findingKind || '', 80),
                    findingHint: cleanText(chain.hiddenOutcome.findingHint || '', 240),
                    paxFindingText: cleanText(chain.hiddenOutcome.paxFindingText || '', 260),
                    hiddenFromWriter: chain.hiddenOutcome.hiddenFromWriter !== false,
                    revealAfter: cleanText(chain.hiddenOutcome.revealAfter || 'point_complete', 80),
                    createdAt: Number(chain.hiddenOutcome.createdAt || 0)
                }
                : null,
            points: points.map((point, idx) => ({
                id: cleanText(point.id || `chain-point-${idx + 1}`, 180),
                index: Number.isFinite(Number(point.index)) ? Number(point.index) : idx,
                name: cleanText(point.name || '', 120),
                lat: roundNumber(point.lat),
                lon: roundNumber(point.lon),
                category: cleanText(point.category || '', 80),
                triggerRadiusNm: roundNumber(point.triggerRadiusNm || 0.45, 2),
                revealState: idx === 0 ? 'visible' : (point.revealState || 'hidden'),
                required: point.required !== false,
                sourceLayer: cleanText(point.sourceLayer || '', 80),
                sourceTile: cleanText(point.sourceTile || '', 40),
                score: roundNumber(point.score, 2),
                orderT: roundNumber(point.orderT, 4),
                distCorridorNm: roundNumber(point.distCorridorNm, 3),
                distanceFromPrevNm: roundNumber(point.distanceFromPrevNm || 0, 2),
                bearingFromPrevDeg: point.bearingFromPrevDeg === null ? null : Math.round(Number(point.bearingFromPrevDeg || 0)),
                clusterCount: Math.max(1, Number(point.clusterCount || 1)),
                tags: point.tags || {}
            })),
            sequenceRequired: chain.sequenceRequired !== false,
            completionMode: chain.completionMode || 'all_required',
            fallbackAllowed: chain.fallbackAllowed !== false,
            dispatch: chain.dispatch || null
        };
    }

    const api = {
        defaults: DEFAULTS,
        themeDefaults: THEME_DEFAULTS,
        buildPoiChain,
        buildPoiChainProspects,
        compactPoiChain,
        normalizeConfig,
        collectFeatures,
        _test: {
            cleanText,
            haversineNm,
            bearingDeg,
            projectPointToSegmentNm,
            projectPointToSegmentClampedNm,
            normalizeFeature,
            scoreCandidate,
            clusterCandidates,
            selectSpacedCandidates,
            candidateMatchesMode,
            isBridge,
            isRoadBridge,
            isRoadJunction,
            isRailPoint,
            isPowerPoint,
            guideKindForFeature,
            guideGroupKey,
            groupGuideFeatures,
            themesForProspectOptions,
            directionMatchesBearing
        }
    };

    host.missionPoiChain = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
