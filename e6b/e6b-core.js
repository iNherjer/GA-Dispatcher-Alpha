(function(root, factory) {
    'use strict';
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.GAE6B = factory();
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
    'use strict';

    const DEG_TO_RAD = Math.PI / 180;
    const RAD_TO_DEG = 180 / Math.PI;

    function toFiniteNumber(value, fallback = 0) {
        const number = Number(value);
        return Number.isFinite(number) ? number : fallback;
    }

    function clamp(value, min, max) {
        const number = toFiniteNumber(value, min);
        return Math.min(max, Math.max(min, number));
    }

    function normalize360(degrees) {
        const value = toFiniteNumber(degrees, 0) % 360;
        return value < 0 ? value + 360 : value;
    }

    function normalize180(degrees) {
        const value = normalize360(degrees + 180) - 180;
        return value === -180 ? 180 : value;
    }

    function toRadians(degrees) {
        return toFiniteNumber(degrees, 0) * DEG_TO_RAD;
    }

    function toDegrees(radians) {
        return toFiniteNumber(radians, 0) * RAD_TO_DEG;
    }

    function sinDeg(degrees) {
        return Math.sin(toRadians(degrees));
    }

    function cosDeg(degrees) {
        return Math.cos(toRadians(degrees));
    }

    function atan2Deg(y, x) {
        return toDegrees(Math.atan2(y, x));
    }

    function round(value, digits = 1) {
        const factor = 10 ** digits;
        return Math.round((toFiniteNumber(value, 0) + Number.EPSILON) * factor) / factor;
    }

    function valueMantissa(value) {
        let mantissa = Math.abs(toFiniteNumber(value, 10));
        if (mantissa <= 0) return 10;
        while (mantissa < 10) mantissa *= 10;
        while (mantissa >= 100) mantissa /= 10;
        return mantissa;
    }

    function valueExponent(value) {
        const number = Math.abs(toFiniteNumber(value, 1));
        if (number <= 0) return 0;
        return Math.floor(Math.log10(number / valueMantissa(number)));
    }

    function logScaleAngle(value) {
        const mantissa = valueMantissa(value);
        return Math.log10(mantissa / 10) * 360;
    }

    function angleToMantissa(degrees) {
        const angle = normalize360(degrees);
        return 10 * (10 ** (angle / 360));
    }

    function nearestValueForMantissa(mantissa, reference) {
        const cleanMantissa = valueMantissa(mantissa);
        const target = Math.abs(toFiniteNumber(reference, cleanMantissa));
        let best = cleanMantissa;
        let bestDelta = Infinity;
        for (let exp = -4; exp <= 8; exp += 1) {
            const candidate = cleanMantissa * (10 ** exp);
            const delta = Math.abs(candidate - target);
            if (delta < bestDelta) {
                best = candidate;
                bestDelta = delta;
            }
        }
        return best;
    }

    function rotationForAlignment(outerValue, innerValue) {
        return normalize180(logScaleAngle(outerValue) - logScaleAngle(innerValue));
    }

    function outerMantissaAtInnerValue(innerValue, rotationDegrees) {
        return angleToMantissa(logScaleAngle(innerValue) + toFiniteNumber(rotationDegrees, 0));
    }

    function innerMantissaAtOuterValue(outerValue, rotationDegrees) {
        return angleToMantissa(logScaleAngle(outerValue) - toFiniteNumber(rotationDegrees, 0));
    }

    function solveTimeDistanceSpeed(input = {}) {
        const distance = toFiniteNumber(input.distanceNm, NaN);
        const speed = toFiniteNumber(input.speedKt, NaN);
        const timeMinutes = toFiniteNumber(input.timeMinutes, NaN);
        if (Number.isFinite(speed) && Number.isFinite(timeMinutes)) {
            return {
                distanceNm: speed * timeMinutes / 60,
                speedKt: speed,
                timeMinutes
            };
        }
        if (Number.isFinite(distance) && Number.isFinite(timeMinutes) && timeMinutes !== 0) {
            return {
                distanceNm: distance,
                speedKt: distance / (timeMinutes / 60),
                timeMinutes
            };
        }
        if (Number.isFinite(distance) && Number.isFinite(speed) && speed !== 0) {
            return {
                distanceNm: distance,
                speedKt: speed,
                timeMinutes: distance / speed * 60
            };
        }
        return null;
    }

    function solveFuel(input = {}) {
        const fuelRateGph = toFiniteNumber(input.fuelRateGph, NaN);
        const fuelGallons = toFiniteNumber(input.fuelGallons, NaN);
        const timeMinutes = toFiniteNumber(input.timeMinutes, NaN);
        if (Number.isFinite(fuelRateGph) && Number.isFinite(timeMinutes)) {
            return {
                fuelRateGph,
                fuelGallons: fuelRateGph * timeMinutes / 60,
                timeMinutes
            };
        }
        if (Number.isFinite(fuelGallons) && Number.isFinite(timeMinutes) && timeMinutes !== 0) {
            return {
                fuelRateGph: fuelGallons / (timeMinutes / 60),
                fuelGallons,
                timeMinutes
            };
        }
        if (Number.isFinite(fuelGallons) && Number.isFinite(fuelRateGph) && fuelRateGph !== 0) {
            return {
                fuelRateGph,
                fuelGallons,
                timeMinutes: fuelGallons / fuelRateGph * 60
            };
        }
        return null;
    }

    function solveHeadingForCourse(input = {}) {
        const courseDeg = normalize360(input.courseDeg);
        const tas = Math.max(0, toFiniteNumber(input.trueAirspeedKt, 0));
        const windFromDeg = normalize360(input.windFromDeg);
        const windSpeed = Math.max(0, toFiniteNumber(input.windSpeedKt, 0));
        const windAngle = normalize180(windFromDeg - courseDeg);
        const crosswind = windSpeed * sinDeg(windAngle);
        const headwind = windSpeed * cosDeg(windAngle);
        if (tas <= 0) {
            return {
                possible: false,
                courseDeg,
                trueAirspeedKt: tas,
                windFromDeg,
                windSpeedKt: windSpeed,
                windCorrectionDeg: 0,
                headingDeg: courseDeg,
                groundSpeedKt: 0,
                headwindKt: headwind,
                crosswindKt: crosswind
            };
        }
        const driftRatio = clamp(crosswind / tas, -1, 1);
        const possible = Math.abs(crosswind) <= tas;
        const windCorrectionDeg = toDegrees(Math.asin(driftRatio));
        const headingDeg = normalize360(courseDeg + windCorrectionDeg);
        const groundSpeedKt = tas * cosDeg(windCorrectionDeg) - headwind;
        return {
            possible,
            courseDeg,
            trueAirspeedKt: tas,
            windFromDeg,
            windSpeedKt: windSpeed,
            windCorrectionDeg,
            headingDeg,
            groundSpeedKt: Math.max(0, groundSpeedKt),
            headwindKt: headwind,
            crosswindKt: crosswind
        };
    }

    function solveTrackForHeading(input = {}) {
        const headingDeg = normalize360(input.headingDeg);
        const tas = Math.max(0, toFiniteNumber(input.trueAirspeedKt, 0));
        const windFromDeg = normalize360(input.windFromDeg);
        const windSpeed = Math.max(0, toFiniteNumber(input.windSpeedKt, 0));
        const windToDeg = normalize360(windFromDeg + 180);
        const airX = tas * sinDeg(headingDeg);
        const airY = tas * cosDeg(headingDeg);
        const windX = windSpeed * sinDeg(windToDeg);
        const windY = windSpeed * cosDeg(windToDeg);
        const groundX = airX + windX;
        const groundY = airY + windY;
        const groundSpeedKt = Math.hypot(groundX, groundY);
        return {
            headingDeg,
            trueAirspeedKt: tas,
            windFromDeg,
            windSpeedKt: windSpeed,
            trackDeg: normalize360(atan2Deg(groundX, groundY)),
            groundSpeedKt
        };
    }

    function solveWindFromCourseHeading(input = {}) {
        const courseDeg = normalize360(input.courseDeg);
        const headingDeg = normalize360(input.headingDeg);
        const tas = Math.max(0, toFiniteNumber(input.trueAirspeedKt, 0));
        const groundSpeed = Math.max(0, toFiniteNumber(input.groundSpeedKt, 0));
        const airX = tas * sinDeg(headingDeg);
        const airY = tas * cosDeg(headingDeg);
        const groundX = groundSpeed * sinDeg(courseDeg);
        const groundY = groundSpeed * cosDeg(courseDeg);
        const windToX = groundX - airX;
        const windToY = groundY - airY;
        const windSpeedKt = Math.hypot(windToX, windToY);
        const windToDeg = normalize360(atan2Deg(windToX, windToY));
        return {
            courseDeg,
            headingDeg,
            trueAirspeedKt: tas,
            groundSpeedKt: groundSpeed,
            windFromDeg: normalize360(windToDeg + 180),
            windSpeedKt
        };
    }

    function isaTemperatureC(altitudeFt) {
        return 15 - 2 * (toFiniteNumber(altitudeFt, 0) / 1000);
    }

    function pressureAltitudeFt(input = {}) {
        if (Number.isFinite(Number(input.pressureAltitudeFt))) return Number(input.pressureAltitudeFt);
        const elevationFt = toFiniteNumber(input.elevationFt, 0);
        const altimeterHpa = toFiniteNumber(input.altimeterHpa, 1013.25);
        return elevationFt + (1013.25 - altimeterHpa) * 30;
    }

    function densityAltitudeFt(input = {}) {
        const pressureAltitude = pressureAltitudeFt(input);
        const oatC = toFiniteNumber(input.oatC, isaTemperatureC(pressureAltitude));
        return pressureAltitude + 120 * (oatC - isaTemperatureC(pressureAltitude));
    }

    function trueAirspeedFromCas(input = {}) {
        const cas = Math.max(0, toFiniteNumber(input.calibratedAirspeedKt, 0));
        const pressureAltitude = pressureAltitudeFt(input);
        return cas * (1 + 0.02 * pressureAltitude / 1000);
    }

    const units = {
        nmToKm: value => toFiniteNumber(value, 0) * 1.852,
        kmToNm: value => toFiniteNumber(value, 0) / 1.852,
        ktToKmh: value => toFiniteNumber(value, 0) * 1.852,
        kmhToKt: value => toFiniteNumber(value, 0) / 1.852,
        ftToM: value => toFiniteNumber(value, 0) * 0.3048,
        mToFt: value => toFiniteNumber(value, 0) / 0.3048,
        galToL: value => toFiniteNumber(value, 0) * 3.785411784,
        lToGal: value => toFiniteNumber(value, 0) / 3.785411784,
        lbToKg: value => toFiniteNumber(value, 0) * 0.45359237,
        kgToLb: value => toFiniteNumber(value, 0) / 0.45359237,
        cToF: value => toFiniteNumber(value, 0) * 9 / 5 + 32,
        fToC: value => (toFiniteNumber(value, 32) - 32) * 5 / 9
    };

    return {
        clamp,
        normalize360,
        normalize180,
        round,
        valueMantissa,
        valueExponent,
        logScaleAngle,
        angleToMantissa,
        nearestValueForMantissa,
        rotationForAlignment,
        outerMantissaAtInnerValue,
        innerMantissaAtOuterValue,
        solveTimeDistanceSpeed,
        solveFuel,
        solveHeadingForCourse,
        solveTrackForHeading,
        solveWindFromCourseHeading,
        isaTemperatureC,
        pressureAltitudeFt,
        densityAltitudeFt,
        trueAirspeedFromCas,
        units
    };
});
