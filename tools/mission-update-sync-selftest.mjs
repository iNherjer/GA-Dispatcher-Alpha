#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const appSource = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const syncSource = fs.readFileSync(new URL('../sync.js', import.meta.url), 'utf8');

function sourceBetween(source, startToken, endToken) {
    const start = source.indexOf(startToken);
    assert.ok(start >= 0, `missing ${startToken}`);
    const end = source.indexOf(endToken, start + startToken.length);
    assert.ok(end > start, `missing ${endToken}`);
    return source.slice(start, end);
}

function storageHarness(initial = {}) {
    const values = new Map(Object.entries(initial).map(([key, value]) => [key, String(value)]));
    return {
        values,
        api: {
            getItem(key) { return values.has(key) ? values.get(key) : null; },
            setItem(key, value) { values.set(key, String(value)); },
            removeItem(key) { values.delete(key); }
        }
    };
}

const expiryStorage = storageHarness();
const expiryContext = {
    window: {},
    localStorage: expiryStorage.api,
    console: { debug() {} },
    buildInitialBushMissionProgress: spec => ({
        status: spec?.targetMode === 'strip_then_return' ? 'outbound_empty' : 'enroute',
        targetReached: false,
        areaQualified: false,
        pickupCompleted: false
    }),
    missionSarHeliInitialProgress: () => ({
        schema: 'sarHeliProgress.v1',
        status: 'enroute_search',
        targetConfirmed: false,
        patientLoaded: false
    }),
    Date,
    JSON,
    Number,
    String,
    Array,
    Object,
    Math
};
vm.createContext(expiryContext);
vm.runInContext(sourceBetween(
    appSource,
    'function missionRestoreNormalizeValue(value)',
    'function stampActiveMissionStateForStorage(state = {})'
), expiryContext, { filename: 'mission-expiry-policy-test.js' });
vm.runInContext(sourceBetween(
    appSource,
    'function clearActiveMissionRuntimeMarkersFromState(state = {})',
    'function clearExpiredActiveMissionPersistence(reason = '
), expiryContext, { filename: 'mission-reset-to-planned-test.js' });

const now = Date.now();
const missionId = 'mission-update-sync-test';
const unstartedOldMission = {
    activeMissionCreatedAt: now - (48 * 60 * 60 * 1000),
    currentMissionData: { missionId, sceneAccepted: true, sceneCompositionStatus: 'accepted' }
};
const unstartedExpiry = vm.runInContext('activeMissionRestoreExpiryInfo', expiryContext)(unstartedOldMission, { now });
assert.equal(unstartedExpiry.expired, false, 'an old planned or accepted mission must not expire');
assert.equal(unstartedExpiry.started, false, 'an accepted mission without runtime markers must remain unstarted');
assert.equal(unstartedExpiry.ttlMs, 12 * 60 * 60 * 1000);

const startedMission = hours => ({
    activeMissionRuntimeMissionId: missionId,
    activeMissionRuntimeStartedAt: now - (hours * 60 * 60 * 1000),
    activeMissionRuntimeSavedAt: now - 1000,
    activeMissionRuntimePhase: 'active',
    currentMissionData: { missionId, sceneAccepted: true, sceneCompositionStatus: 'accepted' }
});
assert.equal(
    vm.runInContext('isActiveMissionStateExpired', expiryContext)(startedMission(11), { now }),
    false,
    'a started mission younger than twelve hours must survive reload'
);
assert.equal(
    vm.runInContext('isActiveMissionStateExpired', expiryContext)(startedMission(13), { now }),
    true,
    'a started mission older than twelve hours must expire as a runtime'
);

const completedMission = startedMission(24);
completedMission.currentMissionData.missionCompletionState = 'completed_awaiting_cleanup';
completedMission.currentMissionData.missionCompletionRecord = { completionId: 'done-1' };
assert.equal(
    vm.runInContext('isActiveMissionStateExpired', expiryContext)(completedMission, { now }),
    false,
    'a completed mission awaiting its debrief must not fall back to planned'
);

const cargoManifest = {
    key: missionId,
    dispatchSignature: { signedAt: now - 1000 },
    maxStressDamagePct: 12,
    items: [{ id: 'box', status: 'loaded', loadedAt: now - 5000, healthPct: 82, log: { loaded: true } }]
};
const expiredStartedMission = startedMission(13);
expiredStartedMission.routeWaypoints = [{ lat: 48, lng: 9 }, { lat: 49, lng: 10 }];
expiredStartedMission.activePassenger = { name: 'Tester', poiChainProgress: { currentIndex: 2 } };
Object.assign(expiredStartedMission.currentMissionData, {
    missionTitle: 'Bleibt erhalten',
    missionOutcome: { status: 'failed' },
    cargoOutcome: { status: 'in_progress' },
    bush: { targetMode: 'strip_then_return' },
    bushProgress: { status: 'return_leg', targetReached: true, pickupCompleted: true },
    sarHeli: { enabled: true },
    sarHeliProgress: { status: 'hospital_leg', patientLoaded: true },
    cargoManifest
});
expiredStartedMission.activeMissionContract = {
    missionId,
    taskDomain: 'bush',
    cargoManifest
};
const plannedMission = vm.runInContext('resetExpiredActiveMissionStateToPlanned', expiryContext)(expiredStartedMission);
assert.equal(plannedMission.currentMissionData.missionTitle, 'Bleibt erhalten', 'the original mission must be retained');
assert.equal(plannedMission.routeWaypoints.length, 2, 'the planned route must be retained');
assert.equal(plannedMission.activePassenger.name, 'Tester', 'the passenger assignment must be retained');
assert.equal(plannedMission.activePassenger.poiChainProgress, undefined, 'passenger task progress must be cleared');
assert.equal(plannedMission.activeMissionRuntimeStartedAt, undefined, 'runtime start markers must be cleared');
assert.equal(plannedMission.currentMissionData.bushProgress.status, 'outbound_empty', 'bush progress must return to its initial state');
assert.equal(plannedMission.currentMissionData.sarHeliProgress.status, 'enroute_search', 'SAR progress must return to its initial state');
assert.equal(plannedMission.currentMissionData.cargoManifest.items[0].status, 'pending', 'mission cargo must return to pending');
assert.equal(plannedMission.currentMissionData.cargoManifest.dispatchSignature, null, 'the old dispatch signature must be cleared');
assert.equal(plannedMission.currentMissionData.missionOutcome, null, 'the old mission outcome must be cleared');

const draftState = {
    currentMissionData: {
        missionId: 'draft-1',
        sceneAccepted: false,
        sceneCompositionStatus: 'draft'
    }
};
const payloadStorage = storageHarness({ ga_active_mission: JSON.stringify(draftState) });
let expiredResetCount = 0;
const payloadContext = {
    window: {},
    localStorage: payloadStorage.api,
    JSON,
    _missionIsFreeflightOnly: () => false,
    _syncActiveMissionIsExpired: () => false,
    _syncResetExpiredActiveMissionToPlanned: (_reason, state) => {
        expiredResetCount += 1;
        delete state.activeMissionRuntimeStartedAt;
        return state;
    }
};
vm.createContext(payloadContext);
vm.runInContext(sourceBetween(
    syncSource,
    'function _syncActiveMissionPayload()',
    'function _syncShouldPreserveLocalMissionWithoutCloud(state = null)'
), payloadContext, { filename: 'mission-cloud-payload-test.js' });
assert.equal(
    vm.runInContext('_syncActiveMissionPayload()', payloadContext).currentMissionData.missionId,
    'draft-1',
    'a fresh draft must be included in the cloud payload'
);
assert.equal(expiredResetCount, 0);

payloadStorage.api.setItem('ga_active_mission', JSON.stringify(startedMission(13)));
payloadContext._syncActiveMissionIsExpired = () => true;
const expiredUploadPayload = vm.runInContext('_syncActiveMissionPayload()', payloadContext);
assert.equal(expiredUploadPayload.currentMissionData.missionId, missionId, 'an expired runtime must keep its mission in the upload');
assert.equal(expiredUploadPayload.activeMissionRuntimeStartedAt, undefined, 'the uploaded mission must be planned, not running');
assert.equal(expiredResetCount, 1, 'an expired upload payload must be reset instead of deleted');

const cloudStorage = storageHarness();
let restoreOptions = null;
let resumeCheckCalled = false;
let resetCloudUploadQueued = 0;
const cloudContext = {
    window: {
        storeActiveMissionStateSafely(state) {
            cloudStorage.api.setItem('ga_active_mission', JSON.stringify(state));
            return true;
        },
        activeMissionContract: null,
        activePassenger: null,
        queueActiveMissionCloudSave() { resetCloudUploadQueued += 1; }
    },
    localStorage: cloudStorage.api,
    document: { getElementById: () => ({ style: { display: 'block' } }) },
    console: { warn() {} },
    JSON,
    _syncMissionStateIsDraft: state => state?.currentMissionData?.sceneAccepted === false,
    _missionIsFreeflightOnly: () => false,
    _syncActiveMissionIsExpired: () => false,
    _syncConfirmReplaceRunningLocalMission: () => true,
    _syncShouldCloudRestoreResumeRuntime: () => {
        resumeCheckCalled = true;
        return true;
    },
    restoreMissionState: async (_state, options) => {
        restoreOptions = options;
        return true;
    }
};
vm.createContext(cloudContext);
vm.runInContext(sourceBetween(
    syncSource,
    'async function _syncApplyActiveMissionFromCloud(activeMission = null)',
    'function setLastSyncedPayload()'
), cloudContext, { filename: 'mission-cloud-draft-restore-test.js' });
assert.equal(await vm.runInContext('_syncApplyActiveMissionFromCloud', cloudContext)(draftState), true);
assert.equal(restoreOptions?.allowDraft, true, 'cloud drafts must restore as drafts on another device');
assert.equal(restoreOptions?.resumeRuntime, false, 'a draft must never resume a mission runtime');
assert.equal(resumeCheckCalled, false, 'draft restore must not inspect runtime resume state');

const staleCloudMission = startedMission(13);
cloudContext._syncActiveMissionIsExpired = state => state === staleCloudMission;
cloudContext._syncLocalMissionRuntimeStatus = () => ({ started: false, expired: false });
cloudContext._syncMissionStatesShareIdentity = () => false;
cloudContext._syncResetExpiredActiveMissionToPlanned = (_reason, state) => {
    delete state.activeMissionRuntimeStartedAt;
    delete state.activeMissionRuntimeSavedAt;
    delete state.activeMissionRuntimePhase;
    delete state.activeMissionRuntimeMissionId;
    return state;
};
assert.equal(await vm.runInContext('_syncApplyActiveMissionFromCloud', cloudContext)(staleCloudMission), true);
assert.equal(restoreOptions?.resumeRuntime, false, 'a stale cloud runtime must restore as planned');
assert.equal(restoreOptions?.runtimeResetToPlanned, true, 'cloud restore must expose the reset-to-planned state');
assert.equal(resetCloudUploadQueued, 1, 'the planned replacement must be queued back to the cloud');

const uploadStorage = storageHarness({
    ga_sync_time: '100',
    ga_pinboard: '[]',
    ga_active_mission: JSON.stringify(draftState)
});
let fetchShouldFail = true;
const uploadContext = {
    window: {},
    localStorage: uploadStorage.api,
    document: { getElementById: id => id === 'syncToggle' ? { checked: true } : null },
    console: { error() {}, info() {} },
    JSON,
    Date,
    Promise,
    SYNC_URL: 'https://example.invalid/api/sync/',
    SYNC_MAX_UPLOAD_BYTES: 95000,
    localSyncTime: 100,
    lastSyncedPayloadStr: '',
    getSyncId: () => 'PILOT',
    getSyncPin: () => '1234',
    confirm: () => true,
    setNavComLed() {},
    updateSyncStatus() {},
    flashSyncIndicator() {},
    _syncHomebasePush: async () => ({ ok: true, skipped: true }),
    _missionLogbookForSync: () => [],
    _syncActiveMissionPayload: () => draftState,
    getGroupName: () => '',
    getGroupNick: () => '',
    getAircraftPresetsForSync: () => ({}),
    _syncOnboardEquipmentPayload: () => null,
    _syncFollowupPayload: () => [],
    _syncBuildUploadPayload: (payload, lastModified, pin) => ({
        compacted: false,
        bodyStr: JSON.stringify({ ...payload, lastModified, pin })
    }),
    _syncReadPendingUpload: () => {
        const raw = uploadStorage.api.getItem('ga_sync_pending_upload_v1');
        return raw ? JSON.parse(raw) : null;
    },
    _syncMarkPendingUpload: reason => uploadStorage.api.setItem('ga_sync_pending_upload_v1', JSON.stringify({ reason })),
    _syncClearPendingUpload: () => uploadStorage.api.removeItem('ga_sync_pending_upload_v1'),
    fetch: async () => {
        if (fetchShouldFail) throw new Error('offline');
        return { ok: true, status: 200 };
    }
};
vm.createContext(uploadContext);
vm.runInContext(sourceBetween(
    syncSource,
    'async function triggerCloudSave(immediate = false, options = {})',
    'async function forceSyncLoad()'
), uploadContext, { filename: 'mission-upload-confirmation-test.js' });

const failedUpload = await vm.runInContext('triggerCloudSave', uploadContext)(true, { force: true, skipHomebase: true });
assert.equal(failedUpload.ok, false);
assert.equal(uploadStorage.api.getItem('ga_sync_time'), '100', 'failed upload must not advance the sync timestamp');
assert.ok(uploadStorage.api.getItem('ga_sync_pending_upload_v1'), 'failed upload must remain pending');

fetchShouldFail = false;
const successfulUpload = await vm.runInContext('triggerCloudSave', uploadContext)(true, { force: true, skipHomebase: true });
assert.equal(successfulUpload.ok, true);
assert.ok(Number(uploadStorage.api.getItem('ga_sync_time')) > 100, 'successful upload must commit the sync timestamp');
assert.equal(uploadStorage.api.getItem('ga_sync_pending_upload_v1'), null, 'successful upload must clear the pending marker');

const updateBlock = sourceBetween(appSource, 'window.forceAppUpdate = async function()', '// === AUTO-RESIZE');
assert.ok(
    updateBlock.indexOf('saveMissionState();') < updateBlock.indexOf('flushActiveMissionCloudSaveForUpdate'),
    'forced update must persist the current in-memory mission before the cloud flush'
);
assert.ok(
    updateBlock.indexOf('flushActiveMissionCloudSaveForUpdate') < updateBlock.indexOf('navigator.serviceWorker.getRegistrations'),
    'forced update must flush the mission before unregistering the service worker'
);

console.log('[ok] mission update sync selftest');
