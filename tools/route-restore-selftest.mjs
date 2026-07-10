import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const syncSource = fs.readFileSync(path.join(__dirname, '..', 'sync.js'), 'utf8');
const mapSource = fs.readFileSync(path.join(__dirname, '..', 'map.js'), 'utf8');

function sourceBetween(source, startToken, endToken) {
    const start = source.indexOf(startToken);
    assert.ok(start >= 0, `missing ${startToken}`);
    const end = source.indexOf(endToken, start + startToken.length);
    assert.ok(end > start, `missing ${endToken}`);
    return source.slice(start, end);
}

const preserveHelper = sourceBetween(
    syncSource,
    'function _syncShouldPreserveLocalMissionWithoutCloud(state = null)',
    'function _syncHasLocalDraftMission()'
);
const cloudApply = sourceBetween(
    syncSource,
    'async function _syncApplyActiveMissionFromCloud(activeMission = null)',
    'function setLastSyncedPayload()'
);

const storage = new Map();
const removals = [];
const context = {
    console,
    JSON,
    localStorage: {
        getItem(key) { return storage.has(key) ? storage.get(key) : null; },
        setItem(key, value) { storage.set(key, String(value)); },
        removeItem(key) { removals.push(key); storage.delete(key); }
    },
    document: {
        getElementById(id) {
            return id === 'briefingBox' ? context.briefing : null;
        }
    },
    briefing: { style: { display: 'block' } },
    window: {
        missionRuntimeReset() { context.runtimeResetCount += 1; },
        clearMissionDebugSnapshot() { context.debugClearCount += 1; },
        activeMissionContract: { id: 'contract' },
        activePassenger: { id: 'passenger' },
        _missionRouteWaypoints: [{ lat: 48, lng: 8 }, { lat: 49, lng: 9 }]
    },
    runtimeResetCount: 0,
    debugClearCount: 0,
    _syncMissionStateIsDraft(state) {
        return state?.currentMissionData?.sceneCompositionStatus === 'draft';
    },
    _missionIsFreeflightOnly(state) {
        return state?.currentMissionData?.freeflightOnly === true;
    },
    _syncConfirmReplaceRunningLocalMission() { return true; },
    currentMissionData: { freeflightOnly: true },
    routeWaypoints: [{ lat: 48, lng: 8 }, { lat: 49, lng: 9 }]
};

vm.createContext(context);
vm.runInContext(`${preserveHelper}\n${cloudApply}`, context, { filename: 'sync-route-restore-test.js' });

const freeflightState = { currentMissionData: { freeflightOnly: true } };
storage.set('ga_active_mission', JSON.stringify(freeflightState));
const preserved = await vm.runInContext('_syncApplyActiveMissionFromCloud(null)', context);
assert.equal(preserved, false, 'empty cloud slot should not apply over local freeflight route');
assert.equal(context.routeWaypoints.length, 2, 'freeflight route was cleared');
assert.equal(context.briefing.style.display, 'block', 'freeflight briefing was hidden');
assert.equal(context.runtimeResetCount, 0, 'freeflight runtime should not be reset');
assert.equal(removals.length, 0, 'freeflight persistence should remain intact');

const normalState = { currentMissionData: { missionId: 'normal-mission' } };
storage.set('ga_active_mission', JSON.stringify(normalState));
storage.set('ga_active_mission_contract', '{}');
storage.set('ga_active_passenger', '{}');
context.routeWaypoints = [{ lat: 48, lng: 8 }, { lat: 49, lng: 9 }];
context.currentMissionData = normalState.currentMissionData;
context.briefing.style.display = 'block';
const cleared = await vm.runInContext('_syncApplyActiveMissionFromCloud(null)', context);
assert.equal(cleared, false, 'empty cloud slot should finish without a restored mission');
assert.equal(context.routeWaypoints.length, 0, 'ordinary local mission should still be cleared');
assert.equal(context.briefing.style.display, 'none', 'ordinary local mission briefing should be hidden');
assert.equal(context.runtimeResetCount, 1, 'ordinary local mission runtime should still reset');

const dragEnd = sourceBetween(
    mapSource,
    "marker.on('dragend', function (e)",
    'routeMarkers.push(marker);'
);
assert.match(dragEnd, /const routeWaypoint = Array\.isArray\(routeWaypoints\) \? routeWaypoints\[index\] : null;/, 'stale marker guard missing');
assert.match(dragEnd, /if \(!routeWaypoint\)[\s\S]*?renderMainRoute\(\);[\s\S]*?return;/, 'stale marker should abort safely');
assert.doesNotMatch(dragEnd, /routeWaypoints\[index\]\.lat/, 'drag handler still dereferences a stale route index');

console.log('[ok] route restore selftest');
