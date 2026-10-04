import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ui from '../ga-tracker-client/mission-control-ui-core.js';

const source = fs.readFileSync(new URL('../sync.js', import.meta.url), 'utf8');
const block = (start, end) => {
    const a = source.indexOf(start), b = source.indexOf(end, a + start.length);
    assert.ok(a >= 0 && b > a);
    return source.slice(a, b);
};
const handoffSource = block('async function _ensureTrackerExecutionAuthority(', '\nfunction _publishMissionControlIntentStatus(');
const resumeSource = block('async function _restoreResumedMissionAuthority(', '\nasync function _ensureMissionAuthorityForStart(');

function handoff() {
    const commands = [], logs = [];
    const run = { missionId: 'm', runId: 'r', revision: 2, stateHash: 'state', executionStateHash: 'execution' };
    const ctx = {
        window: { simModeActive: false, liveTrackerCapabilities: ['mission.poi.v1'] }, Date,
        missionExecutionHandoffPromise: null, missionExecutionHandoffFailure: null,
        _missionExecutionAuthorityIsTracker: () => false, _trackerSupportsMissionIntents: () => true,
        _missionStartPhase: () => 'planned', _missionSceneIsPoiMission: () => true, _missionSceneIsBushMission: () => false, _missionRequiresSarSearchAuthority: () => false,
        _missionPoiTrackerRecipeSupported: () => true, _missionAuthorityClientId: () => 'client',
        _ensureMissionAuthorityForStart: async () => true, _trackerExecutionUsesRelayController: () => true,
        _pushMissionAuthoritySnapshotForExecutionHandoff: async () => ({ status: 'ok', authoritativeRun: run }),
        _refreshTrackerExecutionControl: async () => {},
        _missionPhaseDebugPush: (kind, data) => logs.push({ kind, data }),
        _sendMissionAuthorityRequest: async cmd => {
            commands.push(cmd);
            return cmd.type.endsWith('_prepare')
                ? { status: 'ok', authoritativeRun: run, handoff: { handoffId: 'h' } }
                : { status: 'ok', authoritativeRun: { ...run, executionAuthority: 'tracker' } };
        }
    };
    vm.createContext(ctx); vm.runInContext(handoffSource, ctx);
    return { ctx, commands, logs, run };
}

let h = handoff();
assert.equal(await h.ctx._ensureTrackerExecutionAuthority(), true);
assert.deepEqual(h.commands.map(c => c.type), ['mission_execution_authority_prepare', 'mission_execution_authority_commit']);
assert.equal(h.ctx.missionExecutionHandoffPromise, null);
h = handoff(); h.run.executionStateHash = null;
h.ctx._sendMissionAuthorityRequest = async cmd => {
    h.commands.push(cmd);
    return { status: 'blocked', error: 'mission_execution_legacy_drift', driftFields: ['manifest'] };
};
assert.equal(await h.ctx._ensureTrackerExecutionAuthority(), false);
assert.equal(h.commands.length, 1, 'invalid seed reaches validation, never commit');
assert.equal(h.commands[0].expectedExecutionStateHash, '');
assert.equal(h.ctx.missionExecutionHandoffFailure.error, 'mission_execution_legacy_drift');
assert.equal(h.logs.at(-1).data.stage, 'prepare');
assert.match(ui.formatIntentResult(h.ctx.missionExecutionHandoffFailure).text, /nicht abgleichen/);
// A failure releases the lock and remains retryable.
assert.equal(await h.ctx._ensureTrackerExecutionAuthority(), false);
assert.equal(h.commands.length, 2);
h = handoff(); h.ctx._pushMissionAuthoritySnapshotForExecutionHandoff = async () => { throw Error('seed builder unavailable'); };
assert.equal(await h.ctx._ensureTrackerExecutionAuthority(), false);
assert.equal(h.ctx.missionExecutionHandoffFailure.stage, 'exception');
assert.equal(h.ctx.missionExecutionHandoffPromise, null);
h = handoff(); h.ctx.window.liveTrackerCapabilities = [];
assert.equal(await h.ctx._ensureTrackerExecutionAuthority(), false);
assert.equal(h.commands.length, 0);
assert.equal(h.ctx.missionExecutionHandoffFailure.error, 'mission_execution_recipe_not_enabled');
h = handoff();
h.ctx._ensureMissionAuthorityForStart = async () => {
    h.ctx._missionExecutionAuthorityIsTracker = () => true;
    return true;
};
h.ctx._pushMissionAuthoritySnapshotForExecutionHandoff = () => { throw Error('resumed run must not be overwritten'); };
assert.equal(await h.ctx._ensureTrackerExecutionAuthority(), true);
assert.equal(h.commands.length, 0);
h = handoff();
h.ctx._ensureMissionAuthorityForStart = async () => { h.ctx._missionStartPhase = () => 'boarded'; return true; };
h.ctx._pushMissionAuthoritySnapshotForExecutionHandoff = () => { throw Error('started Web run must not be overwritten'); };
assert.equal(await h.ctx._ensureTrackerExecutionAuthority(), false);
assert.equal(h.ctx.missionExecutionHandoffFailure.stage, 'resume');

const run = { missionId: 'm', runId: 'r', ownerClientId: 'client', phase: 'planned', executionAuthority: 'web' };
const active = { missionId: 'm', startPhase: 'boarded', runtime: { active: true } };
const planned = { missionId: 'm', startPhase: 'planned', runtime: { active: false } };
let reply, local, restored, recovered = 0, observer = 0;
const ctx = {
    window: { resumeTrackerMissionOnThisDevice: async () => { observer++; return true; } }, Date,
    _sendMissionAuthorityRequest: async () => reply, _missionAuthorityClientId: () => 'client',
    _missionPhaseDebugPush() {}, alert() {}, _readMissionRuntimeSnapshot: () => local,
    _snapshotMatchesActiveMission: snap => snap.missionId === 'm',
    _missionRuntimePhaseCountsAsStarted: phase => ['prepare', 'boarding', 'boarded', 'active', 'closing'].includes(phase),
    _missionAuthorityRecoverExecutionShadow: () => recovered++,
    _restoreMissionRuntimeFromSnapshot: (snap, options) => {
        assert.equal(options.authorityConfirmed, true); restored = snap; return true;
    }
};
vm.createContext(ctx); vm.runInContext(resumeSource, ctx);
reply = { status: 'ok', authoritativeRun: run, resumeBundle: { runtime: active } };
assert.equal(await ctx._restoreResumedMissionAuthority(run), true);
assert.equal(restored, active); assert.equal(recovered, 1);
local = active; restored = null;
reply.resumeBundle.runtime = planned;
assert.equal(await ctx._restoreResumedMissionAuthority(run), true);
assert.equal(restored, active, 'older planned Tracker snapshot cannot erase local progress');
assert.equal(recovered, 1, 'old planned journal does not replace local progress');
ctx.missionRuntime = { active: true };
restored = null; reply.resumeBundle.runtime = active;
assert.equal(await ctx._restoreResumedMissionAuthority(run), true);
assert.equal(restored, null, 'late authority bind cannot rewind a live App runtime');
delete ctx.missionRuntime;
local = null; restored = null;
reply = { status: 'error', error: 'authority_timeout' };
assert.equal(await ctx._restoreResumedMissionAuthority(run), false);
assert.equal(restored, null);
reply = { status: 'ok', authoritativeRun: { ...run, runId: 'replacement' }, resumeBundle: { runtime: active } };
assert.equal(await ctx._restoreResumedMissionAuthority(run), false);
reply = { status: 'ok', authoritativeRun: { ...run, phase: 'boarding' }, resumeBundle: { runtime: planned } };
assert.equal(await ctx._restoreResumedMissionAuthority(run), false, 'missing progress is a blocker, never a reset');
reply = { status: 'ok', authoritativeRun: { ...run, executionAuthority: 'tracker' } };
assert.equal(await ctx._restoreResumedMissionAuthority(run), true);
assert.equal(observer, 1); assert.equal(restored, null);

// Execute Acquire + private snapshot recovery together. Only a fully restored
// runtime may be published back, never the initial planned browser state.
const events = [];
const acquire = {
    ...ctx, window: {}, missionRuntime: { active: false, closingPending: false },
    missionAuthorityAcquirePromise: null, missionAuthorityLateBindPending: false,
    missionAuthorityResumeReadPending: false,
    _missionExecutionAuthorityIsTracker: () => false, _activeMissionRuntimeId: () => 'm',
    _trackerSupportsMissionAuthority: () => true, _readMissionAuthorityState: () => ({ missionId: 'm', runId: 'r' }),
    _buildMissionAuthorityResumeBundle: () => ({ runtime: planned }),
    _writeMissionAuthorityState() {}, _normalizeMissionRuntimeId: value => value,
    _missionStartPhase: () => acquire.missionRuntime.active ? 'boarded' : 'planned',
    _scheduleMissionAuthorityProfileRefresh() {}, _readMissionRuntimeSnapshot: () => null,
    _persistMissionRuntimeSnapshot: () => assert.equal(acquire.missionAuthorityResumeReadPending, false),
    _restoreMissionRuntimeFromSnapshot: snapshot => {
        events.push('restore'); acquire.missionRuntime.active = snapshot.runtime.active; return true;
    },
    _queueMissionAuthoritySnapshot: () => {
        assert.equal(acquire.missionRuntime.active, true); events.push('publish');
    },
    _sendMissionAuthorityRequest: async command => {
        assert.equal(acquire.missionAuthorityResumeReadPending, true);
        events.push(command.type);
        return command.type === 'mission_authority_acquire'
            ? { status: 'ok', resumed: true, authoritativeRun: run }
            : { status: 'ok', authoritativeRun: run, resumeBundle: { runtime: active } };
    }
};
vm.createContext(acquire);
vm.runInContext(resumeSource + '\n' + block('async function _ensureMissionAuthorityForStart(', '\nfunction _attemptMissionAuthorityLateBind('), acquire);
assert.equal(await acquire._ensureMissionAuthorityForStart(), true);
assert.deepEqual(events, ['mission_authority_acquire', 'mission_snapshot_request', 'restore', 'publish']);
events.length = 0; acquire.missionRuntime.active = false;
acquire._sendMissionAuthorityRequest = async command => command.type === 'mission_authority_acquire'
    ? { status: 'ok', resumed: true, authoritativeRun: run } : { status: 'error', error: 'authority_timeout' };
assert.equal(await acquire._ensureMissionAuthorityForStart(), false);
assert.equal(events.length, 0, 'unconfirmed recovery must not publish a replacement planned snapshot');
assert.equal(acquire.missionAuthorityAcquirePromise, null);
assert.equal(acquire.missionAuthorityResumeReadPending, false);
const beforeStatus = { ...active, savedAt: 100 };
acquire._readMissionRuntimeSnapshot = () => beforeStatus;
acquire._sendMissionAuthorityRequest = async command => {
    if (command.type === 'mission_authority_acquire') {
        acquire._readMissionRuntimeSnapshot = () => planned;
        return { status: 'ok', resumed: true, authoritativeRun: run };
    }
    return { status: 'ok', authoritativeRun: run, resumeBundle: { runtime: planned } };
};
assert.equal(await acquire._ensureMissionAuthorityForStart(), true);
assert.equal(acquire.missionRuntime.active, true, 'pre-Acquire local progress survives incoming planned status persistence');

// Early handoff errors must be visible through the actual submit wrapper.
const alerts = [];
const submit = {
    window: { GAMissionControlUiCore: ui }, missionExecutionIntentPromise: null,
    missionExecutionHandoffFailure: { ok: false, status: 'blocked', error: 'mission_execution_legacy_drift', stage: 'prepare' },
    _missionExecutionAuthorityIsTracker: () => false, _ensureTrackerExecutionAuthority: async () => false,
    _publishMissionControlIntentStatus() {}, alert: message => alerts.push(message)
};
vm.createContext(submit);
vm.runInContext(block('async function _submitTrackerExecutionIntent(', '\nwindow.gaTrackerExecutionSubmitIntent ='), submit);
assert.equal((await submit._submitTrackerExecutionIntent('prepare_mission')).ok, false);
assert.equal(alerts.length, 1);
assert.match(alerts[0], /nicht abgleichen/);
assert.equal(submit.missionExecutionIntentPromise, null);
assert.equal(submit.window.gaMissionControlIntentPending, false);
// Both newly requested persistence and an already scheduled callback remain
// silent while recovery reads the authoritative bundle.
let timer, writes = 0;
const persistence = {
    window: {},
    missionAuthorityResumeReadPending: true, _missionExecutionAuthorityIsTracker: () => false,
    missionRuntimeSnapshotTimer: null, missionRuntimePendingSnapshotReason: '', missionRuntimeLastPersistAt: 0,
    Date: { now: () => 1000 }, Math, setTimeout: callback => { timer = callback; return 1; }, clearTimeout() {},
    _buildMissionRuntimeSnapshot: () => { writes++; throw Error('must not overwrite recovery data'); }
};
vm.createContext(persistence);
vm.runInContext(block('function _persistMissionRuntimeSnapshot(', '\nfunction _snapshotMatchesActiveMission('), persistence);
assert.equal(persistence._persistMissionRuntimeSnapshot('resume', { immediate: true }), false);
persistence.missionAuthorityResumeReadPending = false;
assert.equal(persistence._persistMissionRuntimeSnapshot('before-resume', { minIntervalMs: 5000 }), true);
persistence.missionAuthorityResumeReadPending = true;
assert.equal(timer(), false); assert.equal(writes, 0);
console.log('PASS mission start/resume: valid handoff, drift blocker, retry, recipe gate, existing authority, Web progress, stale snapshot, timeout, run replacement, observer and visible error.');
