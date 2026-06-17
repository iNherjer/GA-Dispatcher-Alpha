import fs from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const modulePath = path.join(__dirname, '..', 'mission-survey-pattern.js');
const code = fs.readFileSync(modulePath, 'utf8');
const context = {
    window: {},
    console,
    Date,
    Math,
    Set,
    Map,
    Number,
    String,
    Array,
    Object,
    JSON
};
vm.createContext(context);
vm.runInContext(code, context, { filename: modulePath });

const api = context.window.missionSurveyPattern?._test;
if (!api) throw new Error('missionSurveyPattern test API unavailable');

function assertOk(condition, message) {
    if (!condition) throw new Error(message);
}

function runScanCompletion() {
    const spec = api.normalizeSpec({
        taskDomain: 'mapping_survey',
        type: 'north_south_scan',
        targetLabel: 'Testgebiet',
        center: { lat: 48.1, lon: 8.2 },
        targetAltFt: 3500,
        scan: {
            lineCount: 3,
            lineLengthNm: 0.8,
            lineSpacingNm: 0.2,
            crossTrackToleranceNm: 0.08,
            minCoverage: 0.70,
            resetGraceSec: 2
        }
    });
    let state = api.createInitialState(spec);
    let nowMs = 0;
    for (const line of spec.scan.lines) {
        for (let i = 0; i <= 24; i++) {
            const point = api.interpolateLine(line, i / 24);
            const result = api.tickState(spec, state, {
                ...point,
                altFt: 3500,
                headingDeg: 180,
                gsKts: 95,
                nowMs
            });
            state = result.state;
            nowMs += 1000;
        }
    }
    const snap = api.snapshotState(state);
    assertOk(snap.satisfied, 'scan pattern should be satisfied');
    assertOk(snap.scan.completedCount === 3, `expected 3 completed scan lines, got ${snap.scan.completedCount}`);
}

function runScanReset() {
    const spec = api.normalizeSpec({
        taskDomain: 'mapping_survey',
        type: 'north_south_scan',
        center: { lat: 48.1, lon: 8.2 },
        targetAltFt: 3500,
        scan: {
            lineCount: 1,
            lineLengthNm: 0.8,
            lineSpacingNm: 0.2,
            crossTrackToleranceNm: 0.05,
            minCoverage: 0.70,
            resetGraceSec: 2
        }
    });
    let state = api.createInitialState(spec);
    const line = spec.scan.lines[0];
    let result = api.tickState(spec, state, {
        ...api.interpolateLine(line, 0.02),
        altFt: 3500,
        headingDeg: 180,
        gsKts: 95,
        nowMs: 0
    });
    state = result.state;
    const off = api.destinationPoint(spec.center.lat, spec.center.lon, 0.5, 90);
    for (let t = 1; t <= 4; t++) {
        result = api.tickState(spec, state, {
            ...off,
            altFt: 3500,
            headingDeg: 90,
            gsKts: 95,
            nowMs: t * 1000
        });
        state = result.state;
    }
    const snap = api.snapshotState(state);
    assertOk(!snap.satisfied, 'scan reset test should not satisfy pattern');
    assertOk(snap.scan.completedCount === 0, 'offtrack line should not complete');
    assertOk(snap.scan.lastResetReason === 'offtrack', `expected offtrack reset, got ${snap.scan.lastResetReason}`);
}

function runOrbitCompletion() {
    const spec = api.normalizeSpec({
        taskDomain: 'mapping_survey',
        type: 'orbit',
        center: { lat: 48.1, lon: 8.2 },
        targetAltFt: 3500,
        orbit: {
            radiusNm: 0.45,
            radialToleranceNm: 0.08,
            requiredTurns: 3,
            sectorsPerTurn: 36,
            minTurnCoverage: 0.80,
            minTurnSec: 0,
            resetGraceSec: 2
        }
    });
    let state = api.createInitialState(spec);
    let nowMs = 0;
    for (let lap = 0; lap < 3; lap++) {
        for (let deg = 0; deg <= 360; deg += 5) {
            const point = api.destinationPoint(spec.center.lat, spec.center.lon, spec.orbit.radiusNm, deg % 360);
            const result = api.tickState(spec, state, {
                ...point,
                altFt: 3500,
                headingDeg: (deg + 90) % 360,
                gsKts: 95,
                nowMs
            });
            state = result.state;
            nowMs += 1000;
        }
    }
    const snap = api.snapshotState(state);
    assertOk(snap.satisfied, 'orbit pattern should be satisfied');
    assertOk(snap.orbit.completedTurns === 3, `expected 3 completed turns, got ${snap.orbit.completedTurns}`);
}

runScanCompletion();
runScanReset();
runOrbitCompletion();

console.log('survey-pattern selftest ok');
