(function (root, factory) {
    'use strict';
    var api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root && typeof root === 'object') root.GAMissionLocationCore = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    var APT_ARRIVAL_RADIUS_NM = 0.16;
    var APT_AIRPORT_FALLBACK_RADIUS_NM = 0.35;
    var MISSION_TARGET_RADIUS_NM = 1.2;
    var APT_POLICY_SCHEMA = 'ga.mission-location-policy.apt.v1';
    var APT_POLICY_LIMITS = Object.freeze({
        arrivalRadiusNm: Object.freeze({ min: 0.05, max: 0.5 }),
        airportFallbackRadiusNm: Object.freeze({ min: 0.1, max: 1 }),
        missionTargetRadiusNm: Object.freeze({ min: 0.25, max: 3 })
    });

    function object(value) {
        return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    }

    function finite(value, fallback) {
        var number = Number(value);
        return Number.isFinite(number) ? number : fallback;
    }

    function normalizePoint(raw) {
        var source = object(raw);
        var lat = finite(source.lat != null ? source.lat : source.latitude, null);
        var lon = finite(
            source.lon != null ? source.lon : (source.lng != null ? source.lng : source.longitude),
            null
        );
        if (lat == null || lon == null || lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
        return {
            lat: Math.round(lat * 1000000) / 1000000,
            lon: Math.round(lon * 1000000) / 1000000
        };
    }

    function defaultAptPolicy() {
        return {
            schema: APT_POLICY_SCHEMA,
            source: 'default',
            arrivalRadiusNm: APT_ARRIVAL_RADIUS_NM,
            airportFallbackRadiusNm: APT_AIRPORT_FALLBACK_RADIUS_NM,
            missionTargetRadiusNm: MISSION_TARGET_RADIUS_NM
        };
    }

    function normalizeAptPolicy(raw) {
        var source = object(raw);
        if (source.schema !== APT_POLICY_SCHEMA) return defaultAptPolicy();
        var arrivalRadiusNm = finite(source.arrivalRadiusNm, null);
        var airportFallbackRadiusNm = finite(source.airportFallbackRadiusNm, null);
        var missionTargetRadiusNm = finite(source.missionTargetRadiusNm, null);
        var valid = arrivalRadiusNm != null
            && airportFallbackRadiusNm != null
            && missionTargetRadiusNm != null
            && arrivalRadiusNm >= APT_POLICY_LIMITS.arrivalRadiusNm.min
            && arrivalRadiusNm <= APT_POLICY_LIMITS.arrivalRadiusNm.max
            && airportFallbackRadiusNm >= APT_POLICY_LIMITS.airportFallbackRadiusNm.min
            && airportFallbackRadiusNm <= APT_POLICY_LIMITS.airportFallbackRadiusNm.max
            && missionTargetRadiusNm >= APT_POLICY_LIMITS.missionTargetRadiusNm.min
            && missionTargetRadiusNm <= APT_POLICY_LIMITS.missionTargetRadiusNm.max
            && airportFallbackRadiusNm >= arrivalRadiusNm;
        if (!valid) return defaultAptPolicy();
        return {
            schema: APT_POLICY_SCHEMA,
            source: 'mission',
            arrivalRadiusNm: Math.round(arrivalRadiusNm * 1000) / 1000,
            airportFallbackRadiusNm: Math.round(airportFallbackRadiusNm * 1000) / 1000,
            missionTargetRadiusNm: Math.round(missionTargetRadiusNm * 1000) / 1000
        };
    }

    function haversineNm(leftLat, leftLon, rightLat, rightLon) {
        var left = normalizePoint({ lat: leftLat, lon: leftLon });
        var right = normalizePoint({ lat: rightLat, lon: rightLon });
        if (!left || !right) return null;
        var dLat = (right.lat - left.lat) * Math.PI / 180;
        var dLon = (right.lon - left.lon) * Math.PI / 180;
        var a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
            + Math.cos(left.lat * Math.PI / 180) * Math.cos(right.lat * Math.PI / 180)
            * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        return 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a))) * 3440.065;
    }

    function normalizeAptLocation(raw) {
        var source = object(raw);
        return {
            schema: 'ga.mission-location.apt.v1',
            arrivalPoint: normalizePoint(source.arrivalPoint),
            missionTarget: normalizePoint(source.missionTarget),
            policy: normalizeAptPolicy(source.policy)
        };
    }

    function resolveAptDestination(rawLocation, rawPosition) {
        var location = normalizeAptLocation(rawLocation);
        var policy = location.policy;
        var position = normalizePoint(rawPosition);
        if (!position) {
            return {
                available: false,
                atDestination: false,
                reason: 'no_position',
                hasAptArrival: !!location.arrivalPoint,
                dArrivalNm: null,
                dMissionNm: null,
                policy: policy
            };
        }
        var dArrivalNm = location.arrivalPoint
            ? haversineNm(position.lat, position.lon, location.arrivalPoint.lat, location.arrivalPoint.lon)
            : null;
        var dMissionNm = location.missionTarget
            ? haversineNm(position.lat, position.lon, location.missionTarget.lat, location.missionTarget.lon)
            : null;
        var hasAptArrival = !!location.arrivalPoint;
        var atArrivalPoint = hasAptArrival && Number.isFinite(dArrivalNm)
            && dArrivalNm <= policy.arrivalRadiusNm;
        var atAirportFallback = hasAptArrival && Number.isFinite(dMissionNm)
            && dMissionNm <= policy.airportFallbackRadiusNm;
        var atMissionTarget = !hasAptArrival && Number.isFinite(dMissionNm)
            && dMissionNm <= policy.missionTargetRadiusNm;
        var atDestination = atArrivalPoint || atAirportFallback || atMissionTarget;
        var available = !!(location.arrivalPoint || location.missionTarget);
        var reason = !available
            ? 'no_target'
            : (atArrivalPoint
                ? 'apt_arrival_point'
                : (atAirportFallback
                    ? 'apt_airport_fallback'
                    : (atMissionTarget ? 'mission_target' : 'not_at_target')));
        return {
            available: available,
            atDestination: atDestination,
            reason: reason,
            hasAptArrival: hasAptArrival,
            dArrivalNm: Number.isFinite(dArrivalNm) ? dArrivalNm : null,
            dMissionNm: Number.isFinite(dMissionNm) ? dMissionNm : null,
            policy: policy
        };
    }

    return Object.freeze({
        APT_ARRIVAL_RADIUS_NM: APT_ARRIVAL_RADIUS_NM,
        APT_AIRPORT_FALLBACK_RADIUS_NM: APT_AIRPORT_FALLBACK_RADIUS_NM,
        MISSION_TARGET_RADIUS_NM: MISSION_TARGET_RADIUS_NM,
        APT_POLICY_SCHEMA: APT_POLICY_SCHEMA,
        APT_POLICY_LIMITS: APT_POLICY_LIMITS,
        defaultAptPolicy: defaultAptPolicy,
        normalizeAptPolicy: normalizeAptPolicy,
        haversineNm: haversineNm,
        normalizePoint: normalizePoint,
        normalizeAptLocation: normalizeAptLocation,
        resolveAptDestination: resolveAptDestination
    });
}));
