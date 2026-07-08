'use strict';

const assert = require('assert');
const e6b = require('../e6b/e6b-core.js');

function near(actual, expected, tolerance, label) {
    assert.ok(
        Math.abs(actual - expected) <= tolerance,
        `${label}: expected ${expected}, got ${actual}`
    );
}

function angularNear(actual, expected, tolerance, label) {
    const delta = Math.abs(e6b.normalize180(actual - expected));
    assert.ok(delta <= tolerance, `${label}: expected ${expected}, got ${actual}`);
}

{
    const result = e6b.solveHeadingForCourse({
        courseDeg: 90,
        trueAirspeedKt: 100,
        windFromDeg: 360,
        windSpeedKt: 20
    });
    near(result.windCorrectionDeg, -11.536, 0.01, 'left crosswind WCA');
    angularNear(result.headingDeg, 78.464, 0.01, 'left crosswind heading');
    near(result.groundSpeedKt, 97.98, 0.02, 'left crosswind GS');
}

{
    const result = e6b.solveHeadingForCourse({
        courseDeg: 0,
        trueAirspeedKt: 100,
        windFromDeg: 90,
        windSpeedKt: 20
    });
    near(result.windCorrectionDeg, 11.536, 0.01, 'right crosswind WCA');
    angularNear(result.headingDeg, 11.536, 0.01, 'right crosswind heading');
    near(result.groundSpeedKt, 97.98, 0.02, 'right crosswind GS');
}

{
    const headwind = e6b.solveHeadingForCourse({
        courseDeg: 270,
        trueAirspeedKt: 120,
        windFromDeg: 270,
        windSpeedKt: 30
    });
    near(headwind.windCorrectionDeg, 0, 0.001, 'headwind WCA');
    angularNear(headwind.headingDeg, 270, 0.001, 'headwind heading');
    near(headwind.groundSpeedKt, 90, 0.001, 'headwind GS');

    const tailwind = e6b.solveHeadingForCourse({
        courseDeg: 270,
        trueAirspeedKt: 120,
        windFromDeg: 90,
        windSpeedKt: 30
    });
    near(tailwind.groundSpeedKt, 150, 0.001, 'tailwind GS');
}

{
    const result = e6b.solveTrackForHeading({
        headingDeg: 90,
        trueAirspeedKt: 100,
        windFromDeg: 360,
        windSpeedKt: 20
    });
    angularNear(result.trackDeg, 101.31, 0.02, 'track for uncorrected heading');
    near(result.groundSpeedKt, 101.98, 0.02, 'GS for uncorrected heading');
}

{
    const wind = e6b.solveWindFromCourseHeading({
        courseDeg: 90,
        headingDeg: 78.463,
        trueAirspeedKt: 100,
        groundSpeedKt: 97.98
    });
    angularNear(wind.windFromDeg, 360, 0.1, 'derived wind direction');
    near(wind.windSpeedKt, 20, 0.1, 'derived wind speed');
}

{
    const result = e6b.solveTimeDistanceSpeed({ speedKt: 120, timeMinutes: 10 });
    near(result.distanceNm, 20, 0.0001, 'time distance');
    near(e6b.solveTimeDistanceSpeed({ distanceNm: 84, speedKt: 120 }).timeMinutes, 42, 0.0001, 'time from distance');
}

{
    const result = e6b.solveFuel({ fuelRateGph: 9.5, timeMinutes: 45 });
    near(result.fuelGallons, 7.125, 0.0001, 'fuel burn');
}

{
    const rotation = e6b.rotationForAlignment(120, 60);
    const mantissa = e6b.outerMantissaAtInnerValue(10, rotation);
    near(mantissa, 20, 0.001, 'log scale 120 kt over 60, 10 minutes reads 20');
}

{
    near(e6b.pressureAltitudeFt({ elevationFt: 1500, altimeterHpa: 1003.25 }), 1800, 0.001, 'pressure altitude');
    near(e6b.isaTemperatureC(5000), 5, 0.001, 'ISA temp');
    near(e6b.densityAltitudeFt({ pressureAltitudeFt: 5000, oatC: 25 }), 7400, 0.001, 'density altitude');
    near(e6b.trueAirspeedFromCas({ calibratedAirspeedKt: 100, pressureAltitudeFt: 5000 }), 110, 0.001, 'rough TAS');
}

console.log('e6b-core tests passed');
