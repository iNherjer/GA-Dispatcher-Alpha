#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const cargoSource = fs.readFileSync(new URL('../mission-cargo-core.js', import.meta.url), 'utf8');
const paxSource = fs.readFileSync(new URL('../passenger-voice.js', import.meta.url), 'utf8');
const profileSource = fs.readFileSync(new URL('../profile.js', import.meta.url), 'utf8');
const indexSource = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

function functionSource(source, name) {
    const start = source.indexOf(`function ${name}(`);
    assert.ok(start >= 0, `missing function ${name}`);
    const open = source.indexOf('{', start);
    assert.ok(open > start, `missing function body ${name}`);
    let depth = 0;
    for (let i = open; i < source.length; i += 1) {
        if (source[i] === '{') depth += 1;
        if (source[i] === '}') depth -= 1;
        if (depth === 0) return source.slice(start, i + 1);
    }
    throw new Error(`unterminated function ${name}`);
}

assert.match(indexSource, /id="btnDebugMotionProtection"[\s\S]*missionDebugToggleMotionProtection/);
assert.ok(indexSource.includes('Slew-Schutz Aus'), 'debug button lacks an explicit off state');
assert.ok(cargoSource.includes("const MISSION_DEBUG_MOTION_PROTECTION_STORAGE_KEY = 'ga_debug_motion_protection_v1'"));
assert.ok(cargoSource.includes('window.missionDebugUpdateMotionProtectionButtonUi'));
assert.ok(cargoSource.includes('motionProtectionEnabled: _missionDebugMotionProtectionEnabled()'));
assert.ok(profileSource.includes('Debug-Slew-Schutz:'));
assert.ok(profileSource.includes('window.missionDebugUpdateMotionProtectionButtonUi'));

const cargoContext = {
    window: {
        lastLiveFlightData: {
            gForce: 3.2,
            bankDeg: 120,
            vsFpm: -5000,
            touchdownFpm: -1800
        }
    },
    flightRecorder: {
        maxGForce: 3.2,
        maxBankDeg: 120,
        maxDescentFpm: -5000,
        touchdownVsFpm: -1800
    },
    protectionEnabled: false
};
vm.runInNewContext(`
function _missionDebugMotionProtectionEnabled() { return protectionEnabled; }
${functionSource(cargoSource, '_missionCargoStressDamage')}
`, cargoContext);
const damagingRecord = {
    maxGForce: 3.2,
    maxBankDeg: 120,
    maxDescentFpm: -5000,
    touchdownVsFpm: -1800
};
assert.ok(cargoContext._missionCargoStressDamage(damagingRecord) > 0, 'normal stress must damage cargo');
cargoContext.protectionEnabled = true;
assert.equal(cargoContext._missionCargoStressDamage(damagingRecord), 0, 'Slew protection must suppress cargo stress damage');

const paxContext = {
    window: {},
    localStorage: { getItem: () => null },
    Date,
    Math,
    Number,
    Object,
    String,
    protectionEnabled: false,
    _missionComfortScore: null
};
vm.runInNewContext(`
function _paxDebugMotionProtectionEnabled() { return protectionEnabled; }
function _cargoMissionFocus() { return true; }
${functionSource(paxSource, '_createMissionComfortScore')}
${functionSource(paxSource, '_missionComfortScoreState')}
${functionSource(paxSource, '_missionScoreRegisterEvent')}
${functionSource(paxSource, '_recordMissionComfortSample')}
${functionSource(paxSource, '_missionComfortSummary')}
`, paxContext);
const harshMotion = {
    gForce: 2.2,
    bankDeg: 65,
    vsFpm: -2800,
    windKts: 10,
    windGustKts: 12,
    turbulencePct: 0,
    precipRateMmH: 0
};
paxContext._recordMissionComfortSample(harshMotion);
assert.ok(paxContext._missionComfortSummary().comfortScore < 100, 'normal comfort scoring must react to harsh motion');
paxContext.protectionEnabled = true;
const samplesBefore = paxContext._missionComfortScoreState().samples;
paxContext._recordMissionComfortSample(harshMotion);
const protectedSummary = paxContext._missionComfortSummary();
assert.equal(paxContext._missionComfortScoreState().samples, samplesBefore, 'Slew protection must pause comfort sampling');
assert.equal(protectedSummary.comfortScore, 100, 'Slew protection must neutralize comfort scoring');
assert.equal(protectedSummary.debugMotionProtection, true);

assert.ok(paxSource.includes('if (_paxDebugMotionProtectionEnabled()) { resetDetection(); return; }'), 'comfort voice feedback is not guarded');
assert.ok(paxSource.includes('Bewegungs-, Komfort- und Landebewertung deaktiviert (Debug-Slew-Schutz).'), 'farewell prompt still exposes Slew motion values');
assert.ok(paxSource.includes('Landebewertung deaktiviert (Debug-Slew-Schutz). Keine Aussage zur Landungsqualität machen.'), 'landing feedback is not protected');

console.log('Debug motion protection selftest passed.');
