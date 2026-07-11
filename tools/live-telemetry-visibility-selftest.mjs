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

const wakeLockHelpers = sourceBetween(
    'const LIVE_GPS_WAKE_LOCK_STALE_MS = 15000;',
    "window.addEventListener('ga-sleepchange'"
);
assert.match(wakeLockHelpers, /navigator\.wakeLock\.request\('screen'\)/, 'screen wake lock request missing');
assert.match(wakeLockHelpers, /_hasFreshLiveGpsTelemetry\(\)/, 'wake lock must require fresh tracker telemetry');
assert.match(wakeLockHelpers, /_releaseLiveGpsScreenWakeLock\('telemetry-stale'\)/, 'stale telemetry must release wake lock');
assert.match(wakeLockHelpers, /visibilitychange/, 'visibility recovery for wake lock missing');
assert.match(wakeLockHelpers, /_requestLiveGpsScreenWakeLock\('document-visible'\)/, 'wake lock must be reacquired when document becomes visible');

const liveSocketHandlers = sourceBetween(
    'liveGpsSocket.onmessage = (event) =>',
    'function _headingDiffDeg(a, b)'
);
assert.match(liveSocketHandlers, /updateLivePlanePosition\(data\.lat, data\.lon, data\.alt, data\.hdg\);\s*_handleLiveGpsTelemetryForWakeLock\(\);/, 'GPS telemetry must drive wake lock');
assert.match(liveSocketHandlers, /_releaseLiveGpsScreenWakeLock\('websocket-close'\)/, 'websocket close must release wake lock');
assert.match(liveSocketHandlers, /_releaseLiveGpsScreenWakeLock\('websocket-error'\)/, 'websocket error must release wake lock');

console.log('[ok] live telemetry visibility selftest');
