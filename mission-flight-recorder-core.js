(function (root, factory) {
    'use strict';
    var api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root && typeof root === 'object') root.GAMissionFlightRecorderCore = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    var STATE_SCHEMA = 'ga.mission-flight-recorder.v1';
    var STATE_VERSION = 1;

    function object(value) {
        return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    }

    function finite(value, fallback) {
        var number = Number(value);
        return Number.isFinite(number) ? number : fallback;
    }

    function nullable(value) {
        return value == null || value === '' ? null : finite(value, null);
    }

    function clone(value, fallback) {
        try { return JSON.parse(JSON.stringify(value)); } catch (_) { return fallback; }
    }

    function point(value) {
        var source = object(value);
        var lat = finite(source.lat, null);
        var lon = finite(source.lon, null);
        return lat == null || lon == null ? null : { lat: lat, lon: lon };
    }

    function createState(raw) {
        var source = object(raw);
        return {
            schema: STATE_SCHEMA,
            version: STATE_VERSION,
            active: source.active === true,
            startCandidateSince: Math.max(0, Math.round(finite(source.startCandidateSince, 0))),
            lastUpdateTs: Math.max(0, Math.round(finite(source.lastUpdateTs, 0))),
            pauseActive: source.pauseActive === true,
            airborneEvidenceSec: Math.max(0, finite(source.airborneEvidenceSec, 0)),
            hadAirbornePhase: source.hadAirbornePhase === true,
            startTs: Math.max(0, Math.round(finite(source.startTs, 0))),
            endTs: Math.max(0, Math.round(finite(source.endTs, 0))),
            wasOnGround: source.wasOnGround === true,
            touchdownVsFpm: nullable(source.touchdownVsFpm),
            maxGs: Math.max(0, finite(source.maxGs, 0)),
            maxAltFt: Math.max(0, finite(source.maxAltFt, 0)),
            sumGs: Math.max(0, finite(source.sumGs, 0)),
            gsSamples: Math.max(0, Math.round(finite(source.gsSamples, 0))),
            distNm: Math.max(0, finite(source.distNm, 0)),
            lastPosition: point(source.lastPosition),
            maxBankDeg: Math.max(0, finite(source.maxBankDeg, 0)),
            bankSamples: Math.max(0, Math.round(finite(source.bankSamples, 0))),
            maxGForce: Math.max(0, finite(source.maxGForce, 1)),
            sumGForce: Math.max(0, finite(source.sumGForce, 0)),
            gForceSamples: Math.max(0, Math.round(finite(source.gForceSamples, 0))),
            maxAglFt: Math.max(0, finite(source.maxAglFt, 0)),
            maxClimbFpm: Math.max(0, finite(source.maxClimbFpm, 0)),
            maxDescentFpm: Math.min(0, finite(source.maxDescentFpm, 0)),
            minEnrouteAglFt: nullable(source.minEnrouteAglFt),
            enrouteSamples: Math.max(0, Math.round(finite(source.enrouteSamples, 0))),
            aglSamples: Math.max(0, Math.round(finite(source.aglSamples, 0))),
            levelAltSamples: Math.max(0, Math.round(finite(source.levelAltSamples, 0))),
            levelAltMeanFt: finite(source.levelAltMeanFt, 0),
            levelAltM2: Math.max(0, finite(source.levelAltM2, 0)),
            levelAltMinFt: nullable(source.levelAltMinFt),
            levelAltMaxFt: nullable(source.levelAltMaxFt),
            levelAltDurationSec: Math.max(0, finite(source.levelAltDurationSec, 0))
        };
    }

    function haversineNm(lat1, lon1, lat2, lon2) {
        var values = [lat1, lon1, lat2, lon2].map(Number);
        if (!values.every(Number.isFinite)) return null;
        var toRad = Math.PI / 180;
        var dLat = (values[2] - values[0]) * toRad;
        var dLon = (values[3] - values[1]) * toRad;
        var a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
            + Math.cos(values[0] * toRad) * Math.cos(values[2] * toRad)
            * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        return 3440.065 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
    }

    function observe(rawState, rawSample) {
        var state = createState(rawState);
        var sample = object(rawSample);
        var now = Math.max(0, Math.round(finite(sample.observedAt, 0)));
        var lat = finite(sample.lat, null);
        var lon = finite(sample.lon != null ? sample.lon : sample.lng, null);
        var alt = Math.max(0, finite(sample.altFt != null ? sample.altFt : sample.mslFt, 0));
        var agl = Math.max(0, finite(sample.aglFt, 0));
        var gs = Math.max(0, finite(sample.gsKts != null ? sample.gsKts : sample.gs, 0));
        var onGround = sample.onGround === true;
        var dtSec = state.lastUpdateTs ? Math.max(0, (now - state.lastUpdateTs) / 1000) : 0;
        state.lastUpdateTs = now;

        if (sample.simPaused === true || sample.inMenuOrMap === true) {
            state.pauseActive = true;
            state.wasOnGround = onGround;
            return { state: createState(state), status: 'paused', changed: true };
        }
        if (state.pauseActive) {
            state.pauseActive = false;
            // The App preserves an active mission recorder after a pause or
            // reconnect and suppresses the accumulated dt jump.
            state.lastUpdateTs = now;
            dtSec = 0;
        }

        if (!state.active) {
            var taxiStartCandidate = onGround && gs > 6;
            var airborneStartCandidate = !onGround && (gs > 20 || agl > 120);
            var startCandidate = taxiStartCandidate || airborneStartCandidate;
            if (startCandidate) {
                if (!state.startCandidateSince) state.startCandidateSince = now;
            } else {
                state.startCandidateSince = 0;
            }
            var stableMs = taxiStartCandidate ? 1800 : 3000;
            if (state.startCandidateSince && now - state.startCandidateSince >= stableMs) {
                state.active = true;
                state.startCandidateSince = 0;
                state.startTs = now;
                state.maxGs = gs;
                state.maxAltFt = alt;
                state.maxAglFt = agl;
                state.sumGs = gs;
                state.gsSamples = 1;
                state.lastPosition = lat == null || lon == null ? null : { lat: lat, lon: lon };
                state.wasOnGround = onGround;
                return { state: createState(state), status: 'started', changed: true };
            }
            return { state: createState(state), status: 'arming', changed: true };
        }

        if (state.lastPosition && lat != null && lon != null) {
            var distanceNm = haversineNm(state.lastPosition.lat, state.lastPosition.lon, lat, lon);
            if (distanceNm != null && distanceNm > 5 && gs < 40 && (onGround || agl < 200)) {
                var reset = createState();
                reset.lastUpdateTs = now;
                reset.wasOnGround = onGround;
                return { state: reset, status: 'reposition_reset', changed: true };
            }
            if (distanceNm != null && distanceNm > 0) state.distNm += distanceNm;
        }
        if (lat != null && lon != null) state.lastPosition = { lat: lat, lon: lon };

        state.maxGs = Math.max(state.maxGs, gs);
        state.maxAltFt = Math.max(state.maxAltFt, alt);
        state.maxAglFt = Math.max(state.maxAglFt, agl);
        state.sumGs += gs;
        state.gsSamples += 1;
        var airborneNow = !onGround;
        if (airborneNow && dtSec > 0) state.airborneEvidenceSec += dtSec;
        if (!airborneNow && state.airborneEvidenceSec > 0) {
            state.airborneEvidenceSec = Math.max(0, state.airborneEvidenceSec - dtSec * 0.5);
        }
        if (!state.hadAirbornePhase && (state.airborneEvidenceSec >= 8 || state.maxAglFt >= 500)) {
            state.hadAirbornePhase = true;
        }

        var bank = finite(sample.bankDeg, null);
        if (bank != null) {
            state.maxBankDeg = Math.max(state.maxBankDeg, Math.abs(bank));
            state.bankSamples += 1;
        }
        var gForce = finite(sample.gForce, null);
        if (gForce != null && gForce > 0.1) {
            state.maxGForce = Math.max(state.maxGForce, gForce);
            state.sumGForce += gForce;
            state.gForceSamples += 1;
        }
        var vsFpm = finite(sample.vsFpm != null ? sample.vsFpm : sample.vs, null);
        if (vsFpm != null) {
            if (vsFpm > 0) state.maxClimbFpm = Math.max(state.maxClimbFpm, vsFpm);
            if (vsFpm < 0) state.maxDescentFpm = Math.min(state.maxDescentFpm, vsFpm);
        }

        var distanceToTargetNm = finite(sample.distanceToTargetNm, null);
        var enrouteSample = airborneNow
            && state.airborneEvidenceSec >= 30
            && state.distNm >= 2
            && gs >= 35
            && (distanceToTargetNm == null || distanceToTargetNm > 2);
        if (enrouteSample) state.enrouteSamples += 1;
        if (enrouteSample && sample.aglFt != null && Number.isFinite(Number(sample.aglFt))) {
            var directAgl = Math.max(0, Number(sample.aglFt));
            state.minEnrouteAglFt = state.minEnrouteAglFt == null
                ? directAgl
                : Math.min(state.minEnrouteAglFt, directAgl);
            state.aglSamples += 1;
        }
        if (enrouteSample && Number.isFinite(alt) && vsFpm != null && Math.abs(vsFpm) <= 350) {
            state.levelAltSamples += 1;
            var delta = alt - state.levelAltMeanFt;
            state.levelAltMeanFt += delta / state.levelAltSamples;
            state.levelAltM2 += delta * (alt - state.levelAltMeanFt);
            state.levelAltMinFt = state.levelAltMinFt == null ? alt : Math.min(state.levelAltMinFt, alt);
            state.levelAltMaxFt = state.levelAltMaxFt == null ? alt : Math.max(state.levelAltMaxFt, alt);
            state.levelAltDurationSec += Math.min(2, Math.max(0, dtSec));
        }

        if (state.hadAirbornePhase && onGround && !state.wasOnGround) {
            state.touchdownVsFpm = nullable(sample.touchdownFpm);
            if (state.touchdownVsFpm == null) state.touchdownVsFpm = vsFpm;
        }
        state.wasOnGround = onGround;
        return { state: createState(state), status: 'recording', changed: true };
    }

    function buildRecord(rawState, options) {
        var state = createState(rawState);
        var config = object(options);
        var endTs = Math.max(0, Math.round(finite(config.now, state.endTs || 0)));
        var durationSec = Math.max(1, Math.round((endTs - state.startTs) / 1000));
        var telemetrySampleCount = Math.max(state.gsSamples, state.bankSamples, state.gForceSamples);
        var hasFlightEvidence = state.hadAirbornePhase
            || state.airborneEvidenceSec >= 8
            || state.maxAglFt >= 500;
        if (!hasFlightEvidence || durationSec < 15 || telemetrySampleCount < 2) return null;
        var avgGs = state.gsSamples > 0 ? state.sumGs / state.gsSamples : 0;
        var measuredDistanceNm = state.distNm >= 0.05 ? Number(state.distNm.toFixed(1)) : null;
        return {
            depLabel: String(config.depLabel || 'START'),
            arrLabel: String(config.arrLabel || 'LANDUNG'),
            durationSec: durationSec,
            distanceNm: measuredDistanceNm,
            distanceSource: measuredDistanceNm == null ? 'unavailable' : 'gps',
            avgGs: Number(avgGs.toFixed(1)),
            maxGs: Number(state.maxGs.toFixed(1)),
            maxAltFt: Math.round(state.maxAltFt),
            touchdownVsFpm: state.touchdownVsFpm == null ? null : Math.round(state.touchdownVsFpm),
            maxBankDeg: state.bankSamples > 0 ? Number(state.maxBankDeg.toFixed(1)) : null,
            maxGForce: state.gForceSamples > 0 ? Number(state.maxGForce.toFixed(2)) : null,
            avgGForce: state.gForceSamples > 0 ? Number((state.sumGForce / state.gForceSamples).toFixed(2)) : null,
            maxClimbFpm: Math.round(state.maxClimbFpm),
            maxDescentFpm: Math.round(state.maxDescentFpm),
            minEnrouteAglFt: state.minEnrouteAglFt == null ? null : Math.round(state.minEnrouteAglFt),
            cruiseAltitudeMeanFt: state.levelAltSamples >= 10 ? Math.round(state.levelAltMeanFt) : null,
            cruiseAltitudeStdDevFt: state.levelAltSamples >= 10
                ? Math.round(Math.sqrt(state.levelAltM2 / Math.max(1, state.levelAltSamples - 1)))
                : null,
            cruiseAltitudeRangeFt: state.levelAltSamples >= 10
                && state.levelAltMinFt != null && state.levelAltMaxFt != null
                ? Math.round(state.levelAltMaxFt - state.levelAltMinFt)
                : null,
            telemetrySampleCount: Math.round(telemetrySampleCount),
            bankSampleCount: Math.round(state.bankSamples),
            gForceSampleCount: Math.round(state.gForceSamples),
            enrouteSampleCount: Math.round(state.enrouteSamples),
            aglSampleCount: Math.round(state.aglSamples),
            cruiseSampleCount: Math.round(state.levelAltSamples),
            cruiseDurationSec: Math.round(state.levelAltDurationSec),
            telemetryStatus: state.bankSamples > 0 && state.gForceSamples > 0
                ? 'complete'
                : (telemetrySampleCount > 0 ? 'partial' : 'unavailable')
        };
    }

    function recordNumber(record, key) {
        var value = Number(object(record)[key]);
        return Number.isFinite(value) ? value : null;
    }

    function mergeRecords(rawRecords, options) {
        var records = (Array.isArray(rawRecords) ? rawRecords : [])
            .filter(function (record) { return record && typeof record === 'object'; });
        if (!records.length) return null;
        if (records.length === 1) return clone(records[0], null);
        var config = object(options);
        var first = records[0];
        var last = records[records.length - 1];
        var sum = function (key) {
            return records.reduce(function (total, record) {
                return total + Math.max(0, recordNumber(record, key) || 0);
            }, 0);
        };
        var maximum = function (key, fallback) {
            var values = records.map(function (record) { return recordNumber(record, key); }).filter(function (value) { return value != null; });
            return values.length ? Math.max.apply(Math, values) : fallback;
        };
        var minimum = function (key, fallback) {
            var values = records.map(function (record) { return recordNumber(record, key); }).filter(function (value) { return value != null; });
            return values.length ? Math.min.apply(Math, values) : fallback;
        };
        var weighted = function (valueKey, countKey, digits) {
            var total = 0;
            var count = 0;
            records.forEach(function (record) {
                var value = recordNumber(record, valueKey);
                var weight = Math.max(0, recordNumber(record, countKey) || recordNumber(record, 'telemetrySampleCount') || 0);
                if (value == null || weight <= 0) return;
                total += value * weight;
                count += weight;
            });
            return count > 0 ? Number((total / count).toFixed(digits)) : null;
        };
        var distances = records.map(function (record) { return recordNumber(record, 'distanceNm'); }).filter(function (value) { return value != null; });
        var cruiseParts = records.map(function (record) {
            var count = Math.max(0, recordNumber(record, 'cruiseSampleCount') || 0);
            var mean = recordNumber(record, 'cruiseAltitudeMeanFt');
            var deviation = recordNumber(record, 'cruiseAltitudeStdDevFt');
            return count > 0 && mean != null ? { count: count, mean: mean, deviation: Math.max(0, deviation || 0) } : null;
        }).filter(Boolean);
        var cruiseCount = cruiseParts.reduce(function (total, part) { return total + part.count; }, 0);
        var cruiseMean = cruiseCount > 0
            ? cruiseParts.reduce(function (total, part) { return total + part.mean * part.count; }, 0) / cruiseCount
            : null;
        var cruiseM2 = cruiseMean == null ? 0 : cruiseParts.reduce(function (total, part) {
            var ownM2 = part.count > 1 ? part.deviation * part.deviation * (part.count - 1) : 0;
            return total + ownM2 + part.count * Math.pow(part.mean - cruiseMean, 2);
        }, 0);
        var statuses = records.map(function (record) { return String(record.telemetryStatus || 'unavailable'); });
        var segmentCount = records.reduce(function (total, record) {
            return total + Math.max(1, Math.round(recordNumber(record, 'segmentCount') || 1));
        }, 0);
        var startTs = recordNumber(first, 'startTs');
        var endTs = recordNumber(last, 'endTs') || recordNumber(last, 'createdAt');
        return {
            depLabel: String(config.depLabel || first.depLabel || 'START'),
            arrLabel: String(config.arrLabel || last.arrLabel || 'LANDUNG'),
            startTs: startTs,
            endTs: endTs,
            createdAt: endTs,
            durationSec: Math.max(1, Math.round(sum('durationSec'))),
            distanceNm: distances.length ? Number(distances.reduce(function (total, value) { return total + value; }, 0).toFixed(1)) : null,
            distanceSource: distances.length === records.length ? 'gps' : (distances.length ? 'partial_gps' : 'unavailable'),
            avgGs: weighted('avgGs', 'telemetrySampleCount', 1),
            maxGs: maximum('maxGs', 0),
            maxAltFt: Math.round(maximum('maxAltFt', 0)),
            touchdownVsFpm: recordNumber(last, 'touchdownVsFpm'),
            maxBankDeg: maximum('maxBankDeg', null),
            maxGForce: maximum('maxGForce', null),
            avgGForce: weighted('avgGForce', 'gForceSampleCount', 2),
            maxClimbFpm: Math.round(maximum('maxClimbFpm', 0)),
            maxDescentFpm: Math.round(minimum('maxDescentFpm', 0)),
            minEnrouteAglFt: minimum('minEnrouteAglFt', null),
            cruiseAltitudeMeanFt: cruiseMean == null ? null : Math.round(cruiseMean),
            cruiseAltitudeStdDevFt: cruiseCount >= 2 ? Math.round(Math.sqrt(cruiseM2 / (cruiseCount - 1))) : null,
            cruiseAltitudeRangeFt: maximum('cruiseAltitudeRangeFt', null),
            telemetrySampleCount: Math.round(sum('telemetrySampleCount')),
            bankSampleCount: Math.round(sum('bankSampleCount')),
            gForceSampleCount: Math.round(sum('gForceSampleCount')),
            enrouteSampleCount: Math.round(sum('enrouteSampleCount')),
            aglSampleCount: Math.round(sum('aglSampleCount')),
            cruiseSampleCount: Math.round(sum('cruiseSampleCount')),
            cruiseDurationSec: Math.round(sum('cruiseDurationSec')),
            telemetryStatus: statuses.every(function (status) { return status === 'complete'; })
                ? 'complete'
                : (statuses.some(function (status) { return status !== 'unavailable'; }) ? 'partial' : 'unavailable'),
            segmentCount: segmentCount
        };
    }

    function stressDamage(record, options) {
        if (object(options).motionProtectionEnabled === true) return 0;
        var source = object(record);
        var maxG = Math.max(1, finite(source.maxGForce, 1));
        var maxBank = Math.abs(finite(source.maxBankDeg, 0));
        var maxDescent = Math.abs(Math.min(0, finite(source.maxDescentFpm, 0)));
        var touchdown = Math.abs(finite(source.touchdownVsFpm, 0));
        var damage = 0;
        if (maxG > 1.45) damage += (maxG - 1.45) * 22;
        if (maxBank > 45) damage += (maxBank - 45) * 0.45;
        if (maxDescent > 1300) damage += (maxDescent - 1300) * 0.008;
        if (touchdown > 450) damage += (touchdown - 450) * 0.045;
        return Math.max(0, Math.min(85, Math.round(damage)));
    }

    function applyStress(rawManifest, record, options) {
        var manifest = clone(object(rawManifest), {});
        manifest.items = Array.isArray(manifest.items) ? manifest.items : [];
        var damage = stressDamage(record, options);
        var previous = Math.max(0, finite(manifest.maxStressDamagePct, 0));
        if (damage <= previous) return manifest;
        manifest.maxStressDamagePct = damage;
        manifest.items.forEach(function (item) {
            if (item && item.status === 'loaded') {
                item.healthPct = Math.max(0, Math.min(finite(item.healthPct, 100), 100 - damage));
            }
        });
        return manifest;
    }

    function isPassenger(item) {
        return String(object(item).itemType || '').toLowerCase() === 'passenger';
    }

    function evaluateFarewellOutcome(rawManifest, record, options) {
        var manifest = applyStress(rawManifest, record, options);
        var projected = clone(manifest, { items: [] });
        var passenger = projected.items.find(function (item) {
            return isPassenger(item) && item.status === 'loaded';
        });
        if (passenger) passenger.status = 'unloaded';
        var items = projected.items;
        var required = items.filter(function (item) { return item && item.required === true; });
        var missing = required.filter(function (item) {
            return item.status !== 'loaded' && item.status !== 'unloaded' && item.status !== 'dropped';
        });
        var dropped = required.filter(function (item) { return item.status === 'dropped'; });
        var notDelivered = required.filter(function (item) {
            return item.deliverAtDestination !== false && item.status === 'loaded';
        });
        var damaged = required.filter(function (item) { return finite(item.healthPct, 100) <= 35; });
        var failed = missing.length > 0 || dropped.length > 0 || notDelivered.length > 0 || damaged.length > 0;
        var loadedWeightLbs = items.reduce(function (sum, item) {
            return sum + (item && (item.status === 'loaded' || item.status === 'unloaded') ? finite(item.weightLbs, 0) : 0);
        }, 0);
        var healthValues = items.filter(function (item) {
            return item && !isPassenger(item)
                && (item.status === 'loaded' || item.status === 'unloaded' || item.status === 'dropped');
        }).map(function (item) {
            return Math.max(0, Math.min(100, finite(item.healthPct, 100)));
        });
        var minHealthPct = healthValues.length ? Math.min.apply(Math, healthValues) : 100;
        var stressDamagePct = Math.max(0, Math.min(100, finite(projected.maxStressDamagePct, 0)));
        function names(list) {
            return list.map(function (item) { return item.storyName || item.label; });
        }
        return {
            status: failed ? 'failed' : 'completed',
            failed: failed,
            requiredTotal: required.length,
            requiredLoaded: required.filter(function (item) {
                return item.status === 'loaded' || item.status === 'unloaded';
            }).length,
            missingRequired: names(missing),
            droppedRequired: names(dropped),
            notDeliveredRequired: names(notDelivered),
            damagedRequired: names(damaged),
            loadedWeightLbs: Math.round(loadedWeightLbs),
            totalWeightLbs: Math.round(items.reduce(function (sum, item) {
                return sum + finite(object(item).weightLbs, 0);
            }, 0)),
            stressDamagePct: Math.round(stressDamagePct),
            minHealthPct: Math.round(minHealthPct),
            conditionPct: Math.round(Math.min(minHealthPct, 100 - stressDamagePct))
        };
    }

    return Object.freeze({
        STATE_SCHEMA: STATE_SCHEMA,
        STATE_VERSION: STATE_VERSION,
        applyStress: applyStress,
        buildRecord: buildRecord,
        createState: createState,
        evaluateFarewellOutcome: evaluateFarewellOutcome,
        haversineNm: haversineNm,
        mergeRecords: mergeRecords,
        observe: observe,
        stressDamage: stressDamage
    });
}));
