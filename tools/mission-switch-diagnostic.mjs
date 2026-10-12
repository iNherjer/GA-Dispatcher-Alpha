import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { pathToFileURL } from 'node:url';

// Original Web functions with simulated browser/transport boundaries. The
// initial bug reproduction now asserts recovery after the missionswitch fix.
const source = fs.readFileSync(new URL('../sync.js', import.meta.url), 'utf8');
const results = [];
function originalFunction(name) {
    const prefix = source.includes(`async function ${name}(`) ? 'async ' : '';
    const start = source.indexOf(`${prefix}function ${name}(`);
    assert.ok(start >= 0);
    for (let end = source.indexOf('\n}', start); end >= 0; end = source.indexOf('\n}', end + 2)) {
        const text = source.slice(start, end + 2);
        try { new vm.Script(text); return text; } catch (error) {
            if (!(error instanceof SyntaxError)) throw error;
        }
    }
    throw new Error(`Missing function boundary: ${name}`);
}
export function sandbox(options = {}) {
    const trace = [];
    const c = {
        console, Date, Math, JSON, Map, Set,
        currentMissionData: { missionId: 'old' }, missionRuntime: {},
        missionExecutionIntentPromise: null, missionExecutionHandoffPromise: null,
        missionStartActionPromise: null,
        missionExecutionHandoffFailure: null, missionExecutionProjectionSignature: '',
        missionAuthorityLateBindPending: false, missionSmokeCommandSeq: 0,
        missionAuthorityAdoptPromise: null,
        missionRuntimeResumeConflictLastSig: '', missionTrackerObserverPromise: null,
        missionTrackerObserverRetryAt: 0,
        TRACKER_ACK_SUCCESS: new Set(['ok', 'noop']),
        document: { getElementById: () => null },
        localStorage: { removeItem() {} }, MISSION_DEBRIEF_PENDING_KEY: 'debrief',
        _normalizeMissionRuntimeId: value => String(value || ''),
        _activeMissionRuntimeId: () => c.currentMissionData?.missionId || '',
        _readMissionAuthorityState: () => c.localAuthority,
        _clearMissionAuthorityState: () => { c.localAuthority = null; },
        _writeMissionAuthorityState: value => { c.localAuthority = value; },
        _missionAuthorityClientId: () => 'web-client',
        _applyTrackerExecutionAbortLocally: () => false,
        _applyTrackerDebriefClosed: () => false,
        // A delayed old run cannot be resumed: the server has already closed it.
        resumeTrackerMissionOnThisDevice: async () => {
            trace.push({ kind: 'observer-recovery', available: false });
            return false;
        },
        _missionPhaseDebugPush: (kind, data) => trace.push({ kind, ...data }),
        _publishMissionControlIntentStatus: () => {},
        _missionCargoFinalizeMissionOutcome: () => ({ status: 'completed' }),
        _buildMissionCompletionRecord: () => ({ missionId: 'old', runId: 'old-run' }),
        _persistMissionCompletion() {}, _showMissionCompletionDebrief() {},
        _clearMissionRuntimeSnapshot() {}, _clearActiveMissionRuntimeMarker() {},
        _updateMissionRuntimeUi() {}, triggerCloudSave() {},
        _completionText: value => value,
        _resetMissionRuntime: () => { c.missionRuntime = { phase: 'planned', active: false }; },
        _applyTrackerPayloadControl() {}, _missionStartPhase: () => 'planned',
        _trackerSupportsMissionIntents: () => true, _missionSceneIsPoiMission: () => false,
        _missionSceneIsBushMission: () => false,
        _missionIsFreeflightOnly: () => false,
        _syncMissionRestoreBlocked: () => false, _syncTrackerRestoreBlocked: () => false,
        _offerTrackerCloudMission: () => {}, _missionRequiresSarSearchAuthority: () => false,
        _missionEndDeboardingBusy: () => false, _missionStartUsesTrackerExecution: () => true,
        _trackerExecutionUsesRelayController: () => false,
        alert: text => trace.push({ kind: 'alert', text }),
    };
    c.window = c;
    c.clearAppMissionState = () => { c.currentMissionData = null; return true; };
    const terminal = {
        executionAuthority: 'tracker', missionId: 'old', runId: 'old-run',
        phase: 'closed', flags: { closed: true }, allowedActions: [],
    };
    c.server = { activeRun: null, lastExecution: terminal };
    c.gaCockpitSessionClient = {
        start: async () => ({ clientId: 'web-client' }),
        missionSnapshot: async () => ({ authoritySnapshot: structuredClone(c.server),
            control: c.server.activeRun ? { ...c.server.activeRun, flags: {}, allowedActions: ['prepare_mission'] } : null,
            lastControl: terminal }),
        submitIntent: async request => {
            trace.push({ kind: 'sent-intent', missionId: request.missionId, runId: request.runId });
            return c.server.activeRun?.runId === request.runId
                ? { ok: true, status: 'ok' }
                : { ok: false, status: 'conflict', error: 'mission_run_conflict' };
        },
    };
    // Acquisition and protocol responses are fakes. The actual handoff and
    // intent functions decide whether to invoke them and which run to address.
    c._ensureMissionAuthorityForStart = async () => {
        trace.push({ kind: 'acquire', missionId: c.currentMissionData.missionId });
        c.server.activeRun = { missionId: c.currentMissionData.missionId,
            runId: 'new-run', executionAuthority: 'web', revision: 1,
            stateHash: 'state', executionStateHash: 'execution' };
        c.lastTrackerMissionAuthority = structuredClone(c.server);
        c.lastTrackerMissionStatus = structuredClone(c.server.activeRun);
        return true;
    };
    c._pushMissionAuthoritySnapshotForExecutionHandoff = async () => ({ status: 'ok', authoritativeRun: c.server.activeRun });
    c._sendMissionAuthorityRequest = async request => {
        trace.push({ kind: 'handoff', type: request.type });
        if (request.type.endsWith('_prepare')) return { status: 'ok',
            authoritativeRun: c.server.activeRun, handoff: { handoffId: 'h' } };
        c.server.activeRun.executionAuthority = 'tracker';
        return { status: 'ok', authoritativeRun: c.server.activeRun };
    };
    vm.createContext(c);
    for (const name of [
        '_missionExecutionControlSnapshot', '_missionExecutionAuthorityIsTracker',
        '_missionAuthorityIncomingRunRelation', '_applyTrackerExecutionControl',
        '_finalizeTrackerExecutionProjection', '_completeMissionCloseCleanupLocal',
        '_handleTrackerMissionAuthoritySnapshot', '_refreshTrackerExecutionControl',
        '_handleTrackerMissionStatus',
        '_ensureTrackerExecutionAuthority', '_submitTrackerExecutionIntent',
        '_missionAuthorityRuntimeNeedsLateBind',
    ]) {
        vm.runInContext(originalFunction(name), c);
    }
    const clickStart = source.indexOf('window.handleMissionStartBannerAction = async function()');
    const clickEnd = source.indexOf('\nfunction _missionMapTableIsOpen(', clickStart);
    assert.ok(clickStart >= 0 && clickEnd > clickStart);
    vm.runInContext(source.slice(clickStart, clickEnd), c);
    c.gaTrackerExecutionSubmitIntent = (intent, payload, options) => c._submitTrackerExecutionIntent(intent, payload, options);
    if (options.skipBootstrap) return { c, trace, terminal };
    c._handleTrackerMissionAuthoritySnapshot(structuredClone(c.server), 'old-completed');
    assert.equal(c.gaTrackerExecutionFinalizedRunId, 'old-run');
    assert.equal(c._completeMissionCloseCleanupLocal({ missionId: 'old', runId: 'old-run' }), true);
    c.currentMissionData = { missionId: 'new' };
    c._resetMissionRuntime();
    return { c, trace, terminal };
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
{
    const { c, trace } = sandbox();
    const response = await c.handleMissionStartBannerAction();
    assert.equal(response, true);
    assert.equal(trace.find(x => x.kind === 'sent-intent').missionId, 'new');
    results.push({ scenario: 'ordered completion, cleanup, new mission, start', starts: true });
}
{
    const { c, trace } = sandbox();
    // A delayed pre-completion packet arrives after local cleanup/generation.
    c._handleTrackerMissionAuthoritySnapshot({ activeRun: {
        missionId: 'old', runId: 'old-run', executionAuthority: 'tracker',
        ownerClientId: 'other-controller', revision: 10, phase: 'active',
    } }, 'delayed-old-packet');
    assert.equal(c._missionExecutionAuthorityIsTracker(), false);
    assert.equal(c.gaTrackerExecutionControl, null, 'foreign execution projection is rejected');
    const first = await c.handleMissionStartBannerAction();
    assert.equal(first, true);
    assert.equal(c.lastTrackerMissionStatus.runId, 'new-run');
    assert.equal(trace.some(x => x.kind === 'acquire'), true);
    const sent = trace.filter(x => x.kind === 'sent-intent').map(x => x.missionId);
    assert.deepEqual(sent, ['new']);
    results.push({ scenario: 'delayed old run is ignored before new mission start',
        starts: true, addressedMissions: sent });
}
{
    const { c } = sandbox();
    c.lastTrackerMissionStatus = { missionId: 'old', runId: 'old-run', executionAuthority: 'tracker' };
    assert.equal(await c.handleMissionStartBannerAction(), false);
    assert.equal(c.lastTrackerMissionStatus, null, 'fresh HTTP snapshot retires old fallback');
    assert.equal(await c.handleMissionStartBannerAction(), true);
    results.push({ scenario: 'legacy stale run fallback recovers after HTTP snapshot without reload',
        before: false, after: true });
}
{
    const { c } = sandbox();
    c.missionAuthorityLateBindPending = true;
    assert.equal(c._missionAuthorityRuntimeNeedsLateBind(), true);
    assert.equal(c.missionAuthorityLateBindPending, true);
    // Emulate the relevant effect of reload: the finalized run marker is RAM.
    c.gaTrackerExecutionFinalizedRunId = null;
    c.missionAuthorityLateBindPending = true;
    assert.equal(c._missionAuthorityRuntimeNeedsLateBind(), true);
    results.push({ scenario: 'new mission needs late bind after previous completion',
        suppressedByOldFinalizedRun: false });
}
{
    const { c } = sandbox();
    c._handleTrackerMissionAuthoritySnapshot(structuredClone(c.server), 'repeated-old-terminal-snapshot');
    assert.equal(c.currentMissionData.missionId, 'new');
    assert.equal(await c.handleMissionStartBannerAction(), true);
    results.push({ scenario: 'new mission followed by old terminal snapshot', starts: true });
}
console.log(JSON.stringify({ mode: 'original functions with simulated browser/transport', results }, null, 2));
}
