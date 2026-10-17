import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../sync.js', import.meta.url), 'utf8');
const section = (a, b) => source.slice(source.indexOf(a), source.indexOf(b, source.indexOf(a)));
function fixture() {
    let revision = 718;
    const run = { missionId: 'same-mission', runId: 'same-run', executionAuthority: 'tracker' };
    const ctx = { window: { gaTrackerExecutionControl: { runId: run.runId } }, Number, Date, JSON,
        console: { info() {}, warn() {} }, localSyncTime: 0,
        document: { getElementById: () => null },
        localStorage: { getItem: key => key.startsWith('ga_sync_revision_v2:') ? String(revision) : 'null' },
        getSyncId: () => 'PILOT', _syncProfileClient: () => ({ acknowledge: value => { revision = value; } }),
        _syncMissionRestoreBlocked: () => false, _syncActiveTrackerRunForCloudPull: () => run,
        _syncMissionStatesShareIdentity: () => true, _activeMissionRuntimeId: () => run.missionId };
    vm.createContext(ctx);
    vm.runInContext(section('function _syncProfileIsNewer(data)', 'function _syncPayloadComponentChars'), ctx);
    vm.runInContext(section('function _syncRecordCloudMissionPullOutcome(', 'function setLastSyncedPayload('), ctx);
    return {ctx, revision: () => revision};
}
test('successful same-Tracker load acknowledges this revision once, while later revisions remain new', async () => {
    const f = fixture();
    assert.equal(await vm.runInContext('_syncApplyActiveMissionFromCloud({missionId:"same-mission"},{source:"idle-cloud-pull",allowTrackerHandoff:true})', f.ctx), true);
    assert.equal(f.ctx.window.gaLastCloudMissionPullOutcome.cloudMatchesTracker, true);
    vm.runInContext('_syncAcknowledgeProfile({_syncRevision:719})', f.ctx);
    assert.equal(f.revision(), 719);
    assert.equal(vm.runInContext('_syncProfileIsNewer({_syncRevision:719})', f.ctx), false);
    assert.equal(vm.runInContext('_syncProfileIsNewer({_syncRevision:720})', f.ctx), true);
});
test('partial restores, rejected missions and missing identity proof still cannot acknowledge a profile', async () => {
    const f = fixture();
    await vm.runInContext('_syncApplyActiveMissionFromCloud({missionId:"same-mission"})', f.ctx);
    f.ctx.window.gaCloudRestoreIncomplete = true;
    vm.runInContext('_syncAcknowledgeProfile({_syncRevision:719})', f.ctx);
    assert.equal(f.revision(), 718);
    f.ctx.window.gaCloudRestoreIncomplete = false;
    for (const outcome of [{status:'cloud-mission-rejected'}, {status:'tracker-observer-current'}]) {
        f.ctx.window.gaLastCloudMissionPullOutcome = outcome;
        vm.runInContext('_syncAcknowledgeProfile({_syncRevision:719})', f.ctx);
        assert.equal(f.revision(), 718);
    }
});
test('idle-check early returns release the single-flight guard after the cooldown', async () => {
    const timers = [];
    const ctx = {window:{},document:{hidden:false},getSyncId:()=> 'PILOT',_syncMissionRestoreBlocked:()=>false,
        _syncActiveMissionPayload:()=>null,updateSyncStatus(){},alert(){},
        _syncReadProfileResponse:async()=>({status:401}),setTimeout:fn=>timers.push(fn)};
    vm.createContext(ctx);
    vm.runInContext('let idleCheckInProgress=false;'+section('async function checkCloudAfterIdle()', 'let lastTrustedAppWakeAt'),ctx);
    await vm.runInContext('checkCloudAfterIdle()',ctx);
    assert.equal(vm.runInContext('idleCheckInProgress',ctx),true);
    assert.equal(timers.length,1);timers[0]();
    assert.equal(vm.runInContext('idleCheckInProgress',ctx),false);
    await vm.runInContext('checkCloudAfterIdle()',ctx);
    assert.equal(timers.length,2);
});
