import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(path.join(__dirname, '..', 'sync.js'), 'utf8');

function sourceBetween(startToken, endToken) {
    const start = source.indexOf(startToken);
    assert.ok(start >= 0, `missing ${startToken}`);
    const end = source.indexOf(endToken, start + startToken.length);
    assert.ok(end > start, `missing ${endToken}`);
    return source.slice(start, end);
}

const triggerHelper = sourceBetween(
    'function _runLiveMissionTriggerTick(lat, lon, alt)',
    'function _flushPendingLiveTrafficMapRender()'
);
assert.match(triggerHelper, /updateFlightRecorder\(lat, lon, alt\)/, 'flight recorder missing from trigger tick');
assert.match(triggerHelper, /missionSmokeEnsureSpawned/, 'smoke scene trigger missing');
assert.match(triggerHelper, /missionTargetSceneEnsureSpawned/, 'target scene trigger missing');
assert.match(triggerHelper, /missionAptArrivalEnsureSpawned/, 'arrival scene trigger missing');
assert.match(triggerHelper, /checkPaxPoiProximity/, 'PAX, training and POI trigger missing');
assert.doesNotMatch(triggerHelper, /_canRunLiveMapVisualWork/, 'mission trigger helper must not depend on map visibility');

const liveUpdate = sourceBetween(
    'function updateLivePlanePosition(lat, lon, alt, hdg)',
    'function resetFlightRecorder()'
);
const noMapBranch = liveUpdate.match(/if \(typeof map === 'undefined'[\s\S]*?\n    \}/)?.[0] || '';
assert.match(noMapBranch, /_runLiveMissionTriggerTick\(lat, lon, alt\)/, 'triggers must run even before map initialization');
assert.match(liveUpdate, /const liveMapVisualActive = _canRunLiveMapVisualWork\(\)/, 'visual visibility gate missing');
assert.match(liveUpdate, /if \(liveMapVisualActive\) forceLiveMapVisualRefresh = false;\s*_runLiveMissionTriggerTick\(lat, lon, alt\);/, 'visible-map path must finish with trigger tick');

console.log('[ok] live telemetry visibility selftest');
