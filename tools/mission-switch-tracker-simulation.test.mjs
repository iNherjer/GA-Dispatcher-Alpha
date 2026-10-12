import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import execution from '../mission-execution-core.js';
import authority from '../ga-tracker-client/mission-authority-core.js';
import runtimeModule from '../ga-tracker-client/tracker-mission-execution-runtime.js';
import controlModule from '../ga-tracker-client/tracker-cockpit-control-core.js';
import { sandbox } from './mission-switch-diagnostic.mjs';

// Real authority, persisted replay, runtime, effect runner, simulator bridge,
// cockpit authentication and web functions. Only simulator/voice/network IO
// is replaced. Explicit gates select ordering; no probabilistic field timing.
function bundle(missionId) {
    const value = {
        version: 2, missionId, adapter: 'apt', descriptor: { primaryAdapter: 'apt' },
        missionState: { currentMissionData: { missionId, missionType: 'apt',
            start: 'EDTW', dest: 'EDTL', aptArrivalPlan: { lat: 48.3, lon: 8.5 } } },
        runtime: { missionId, startPhase: 'planned',
            lastLiveFlightData: { onGround: true, gsKts: 0, simPaused: false, inMenuOrMap: false },
            runtime: { missionId, phase: 'planned', active: false },
            cargoManifest: { version: 6, key: `manifest-${missionId}`, items: [{
                id: 'medical-box', itemType: 'cargo', required: true,
                status: 'pending', weightLbs: 42, deliverAtDestination: true,
            }] } },
        executionEffectPlan: { schema: 'ga.mission-apt-effect-plan.v1', recipe: 'apt', missionId,
            effects: {
                'scene.prepare': { command: { type: 'mission_scene_spawn', sceneId: `scene-${missionId}`,
                    items: [{ kind: 'person_boarder_1', objectTitle: 'Tarmac_Male' }] } },
                'scene.boarding': { command: { type: 'mission_scene_boarding', sceneId: `scene-${missionId}`,
                    path: [{ forwardM: 16, rightM: -8 }, { forwardM: 4.5, rightM: 8.5 }] } },
                'scene.deboarding': { command: { type: 'mission_scene_deboarding', sceneId: `scene-${missionId}`,
                    path: [{ forwardM: 4.5, rightM: 8.5 }, { forwardM: 16, rightM: -8 }] } },
            } },
    };
    value.executionReplay = execution.createExecutionBundle(value);
    value.execution = execution.createReplayShadowEnvelope(value.executionReplay, { sourceRevision: 1, legacyBundle: value });
    return value;
}
const completed = () => ({ ok: true, status: 'completed', sideEffect: false });
function gate() {
    let release;
    const promise = new Promise(resolve => { release = () => resolve(completed()); });
    return { promise, release };
}
async function until(predicate, label) {
    for (let i = 0; i < 400; i++) {
        if (predicate()) return;
        await new Promise(resolve => setTimeout(resolve, 5));
    }
    assert.fail(`Timed out: ${label}`);
}
function fixture(t, options = {}) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ga-mission-switch-'));
    const storageFile = path.join(directory, 'authority.json');
    let ids = 0, commands = 0, clock = Date.now();
    const managerOptions = { storageFile, executionAuthorityEnabled: true,
        now: () => ++clock, idFactory: () => `run-${++ids}` };
    const h = { manager: authority.createMissionAuthorityManager(managerOptions),
        commands: [], payloads: [], voices: [], changes: [], cleanup: [], snapshots: [],
        blockFarewell: null, blockPayload: null, pauseScenes: false, pauseDeboarding: false, failFinalization: false,
        failCleanup: false, blockCleanup: null };
    const attach = () => {
        h.bridge = h.runtime.attachSimulator({
            getLivePosition: () => ({ lat: 48.3, lon: 8.5, alt: 500, hdg: 90 }),
            dispatchCommand: command => {
                h.commands.push(structuredClone(command));
                return (h.pauseScenes && /mission_scene_(spawn|boarding)$/.test(command.type))
                    || (h.pauseDeboarding && command.type === 'mission_scene_deboarding')
                    ? { ok: true, status: 'pending', sideEffect: true } : completed();
            },
            syncPayloadBeforeStart: request => { h.payloads.push({ stage: 'before-start', runId: request.runId }); return completed(); },
            syncPayloadManifestState: request => {
                h.payloads.push({ stage: 'manifest', runId: request.runId,
                    statuses: request.manifest.items.map(x => x.status) });
                return h.blockPayload?.promise || completed();
            },
            cleanupMission: request => {
                h.cleanup.push(request);
                return h.failCleanup ? { ok: false, error: 'sim_cleanup_failed' }
                    : h.blockCleanup?.promise || completed();
            },
        });
    };
    h.createRuntime = () => {
        h.runtime = runtimeModule.createTrackerMissionExecutionRuntime({
            enabled: true, authorityManager: h.manager,
            prepareCompletionFollowups: () => { if (h.failFinalization) throw Error('injected outbox write failure'); },
            onAuthorityChanged: reason => { h.changes.push(reason); h.snapshots.push(h.manager.getPublicSnapshot()); },
            playBoardingVoice: request => { h.voices.push({ kind: 'boarding', runId: request.runId }); return completed(); },
            playFarewellVoice: request => { h.voices.push({ kind: 'farewell', runId: request.runId }); return h.blockFarewell?.promise || completed(); },
        });
        attach();
    };
    h.createRuntime();
    h.control = controlModule.createTrackerCockpitControl({
        getMissionRun: () => h.manager.getActiveRun(), getExecutionAuthority: () => h.manager.getActiveRun()?.executionAuthority || 'web',
        executionAuthority: 'tracker', executeIntent: request => h.runtime.executeIntent(request),
        canRebaseIntentRevision: request => h.manager.canRebaseIntentRevision(request),
    });
    const sessions = Object.fromEntries(['web', 'efb'].map(role => {
        const registered = h.control.register({ clientId: `test-${role}`, role,
            capabilities: ['mission.snapshot.v2', 'mission.intent.v1'] });
        assert.equal(registered.ok, true);
        return [role, { sessionId: registered.session.sessionId, sessionToken: registered.sessionToken }];
    }));
    h.sessions = sessions;
    h.request = (intent, payload = {}, role = 'web') => {
        const run = h.manager.getActiveRun();
        assert.ok(run);
        return { ...sessions[role], commandId: `command-${++commands}`, intent, payload,
            missionId: run.missionId, runId: run.runId, expectedRevision: run.revision };
    };
    h.intent = async (intent, payload = {}, role = 'web') => {
        const result = await h.control.submitIntent(h.request(intent, payload, role));
        assert.equal(result.ok, true, JSON.stringify({ intent, result }));
        return result;
    };
    h.acquire = (missionId, resumeBundle = bundle(missionId)) => {
        const acquired = h.manager.acquire({ missionId, clientId: 'web-client',
            stateHash: `state-${missionId}`, resumeBundle });
        assert.equal(acquired.ok, true, JSON.stringify(acquired));
        return acquired;
    };
    h.commit = (missionId, resumeBundle) => {
        h.acquire(missionId, resumeBundle);
        const run = h.manager.getActiveRun();
        const prepared = h.manager.prepareExecutionAuthority({ missionId, runId: run.runId,
            clientId: 'web-client', expectedRevision: run.revision,
            expectedStateHash: run.stateHash, expectedExecutionStateHash: run.executionStateHash });
        assert.equal(prepared.ok, true, JSON.stringify(prepared));
        const committed = h.manager.commitExecutionAuthority({ missionId, runId: run.runId,
            clientId: 'web-client', expectedRevision: prepared.activeRun.revision,
            expectedExecutionStateHash: prepared.activeRun.executionStateHash, handoffId: prepared.handoff.handoffId });
        assert.equal(committed.ok, true, JSON.stringify(committed));
    };
    h.begin = async () => {
        await h.intent('prepare_mission');
        await until(() => h.manager.getPublicSnapshot().execution.allowedActions.includes('start_boarding'), 'scene prepare');
        await h.intent('start_boarding');
        await h.intent('set_manifest_item', { itemId: 'medical-box', action: 'load' });
        await until(() => h.runtime.publicState().effects.pendingEffects.length === 0, 'boarding and cargo effects');
        await h.intent('sign_manifest');
        await h.intent('confirm_load');
        await until(() => h.manager.getExecutionSnapshot().state.phase === 'boarded', 'boarded');
        await h.intent('start_mission');
    };
    h.arrive = async () => {
        // Ground handling requires samples no more than five seconds old and
        // never from the future. Replay the flight ending one second ago.
        const base = Date.now() - 8000;
        for (const [offset, lat, lon, onGround, gsKts] of [
            [0, 48.1, 8.2, false, 60], [2000, 48.1, 8.2, false, 65],
            [3000, 48.3, 8.5, true, 20], [4000, 48.3, 8.5, true, 0], [7000, 48.3, 8.5, true, 0],
        ]) h.runtime.observeTelemetry({ observedAt: base + offset, lat, lon, onGround, gsKts });
        await h.intent('set_manifest_item', { itemId: 'medical-box', action: 'unload' }, 'efb');
        await h.intent('sign_manifest', {}, 'efb');
    };
    h.close = async () => {
        await h.intent('confirm_unload', {}, 'efb');
        await until(() => h.manager.getActiveRun() === null, 'terminal authority release');
        await until(() => h.runtime.publicState().effects.pendingEffects.length === 0, 'all effects settled');
        assert.equal(h.bridge.pendingCount(), 0);
        const snapshot = h.manager.getPublicSnapshot();
        assert.equal(snapshot.lastRun.state, 'completed');
        assert.equal(snapshot.lastExecution.phase, 'closed');
        assert.equal(snapshot.execution, null);
        assert.ok(snapshot.lastExecution.flags.unloadConfirmed);
        assert.ok(h.changes.some(x => x.startsWith('finalized:')));
        return snapshot;
    };
    h.restart = () => {
        h.runtime.detachSimulator();
        h.manager = authority.createMissionAuthorityManager(managerOptions);
        h.createRuntime();
    };
    t.after(() => { h.runtime.detachSimulator(); fs.rmSync(directory, { recursive: true, force: true }); });
    h.commit('old', options.initialBundle);
    return h;
}

test('real cargo flight closes, frees authority and starts another full mission', async t => {
    const h = fixture(t);
    await h.begin(); await h.arrive();
    const ended = await h.close();
    assert.equal(ended.lastRun.missionId, 'old');
    const before = h.commands.length;
    h.commit('new'); await h.begin();
    assert.equal(h.manager.getActiveRun().missionId, 'new');
    assert.equal(h.manager.getExecutionSnapshot().state.phase, 'active');
    assert.ok(h.commands.slice(before).some(x => x.sceneId === 'scene-new'));
    assert.equal(h.voices.filter(x => x.kind === 'farewell' && x.runId === ended.lastRun.runId).length, 1);
});

test('held payload result prevents release; explicit ACK allows close then new start', async t => {
    const h = fixture(t); await h.begin();
    h.blockPayload = gate(); await h.arrive();
    await h.intent('confirm_unload', {}, 'efb');
    assert.ok(h.manager.getActiveRun());
    assert.ok(h.runtime.publicState().effects.pendingEffects.length > 0);
    assert.equal(h.manager.acquire({ missionId: 'new', clientId: 'web-client', resumeBundle: bundle('new') }).ok, false);
    h.blockPayload.release(); h.blockPayload = null;
    await until(() => h.manager.getActiveRun() === null, 'payload release and completion');
    assert.equal(h.bridge.pendingCount(), 0);
    h.commit('new'); await h.begin();
    assert.equal(h.manager.getExecutionSnapshot().state.phase, 'active');
});

test('held farewell prevents release and completes once before second mission', async t => {
    const h = fixture(t); await h.begin(); await h.arrive();
    h.blockFarewell = gate(); await h.intent('confirm_unload', {}, 'efb');
    await until(() => h.voices.some(x => x.kind === 'farewell'), 'farewell requested');
    assert.ok(h.manager.getActiveRun());
    h.blockFarewell.release(); h.blockFarewell = null;
    await until(() => h.manager.getActiveRun() === null, 'farewell release and completion');
    h.commit('new'); await h.begin();
    assert.equal(h.voices.filter(x => x.kind === 'farewell').length, 1);
});

test('restored passenger arrival waits for deboarding stage, voice and final scene ACK before new mission', async t => {
    const value = bundle('old');
    value.runtime.cargoManifest = { version: 6, key: 'passenger-manifest',
        dispatchSignature: { scope: 'arrival' }, items: [{ id: 'pax', itemType: 'passenger',
            required: true, status: 'loaded', passengerCount: 1, deliverAtDestination: true }] };
    value.executionReplay = execution.createExecutionBundle(value);
    value.execution = execution.createReplayShadowEnvelope(value.executionReplay, { sourceRevision: 1, legacyBundle: value });
    const h = fixture(t, { initialBundle: value });
    h.pauseDeboarding = true; h.blockFarewell = gate();
    const importedBundle = structuredClone(value);
    importedBundle.runtime.startPhase = 'end_ready';
    importedBundle.runtime.runtime = { missionId: 'old', phase: 'end_ready', active: true, startedAt: Date.now() - 60000 };
    importedBundle.runtime.flightRecorder = { hadAirbornePhase: true };
    const snap = h.manager.getExecutionSnapshot();
    const imported = h.manager.applyExecutionEvent({ missionId: snap.missionId, runId: snap.runId,
        expectedRevision: snap.authorityRevision, expectedExecutionRevision: snap.executionRevision,
        expectedExecutionStateHash: snap.executionStateHash, commandId: 'restore-passenger',
        event: { eventId: 'restore-passenger', type: 'AUTHORITATIVE_SNAPSHOT_IMPORTED',
            sequence: snap.executionRevision + 1, occurredAt: Date.now(), payload: { resumeBundle: importedBundle } } });
    assert.equal(imported.ok, true, JSON.stringify(imported));
    // The imported arrival has the durable unload confirmation, so attach
    // recovery resumes it without submitting a second user confirmation.
    await until(() => h.commands.some(x => x.type === 'mission_scene_deboarding'), 'deboarding command');
    const command = h.commands.find(x => x.type === 'mission_scene_deboarding');
    assert.equal(h.bridge.pendingCount(), 1);
    assert.ok(h.manager.getActiveRun());
    assert.equal(h.bridge.handleAck({ type: 'mission_scene_deboarding_stage', commandId: command.commandId, stage: 'cue', status: 'ok' }), true);
    await until(() => h.voices.some(x => x.kind === 'farewell'), 'passenger farewell');
    assert.equal(h.manager.getExecutionSnapshot().state.manifest.items[0].status, 'loaded');
    h.blockFarewell.release(); h.blockFarewell = null;
    await until(() => h.commands.some(x => x.type === 'mission_scene_deboarding_continue'), 'farewell continuation');
    assert.ok(h.manager.getActiveRun(), 'continuation alone must not release run');
    assert.equal(h.bridge.handleAck({ type: 'mission_scene_deboarding_ack', commandId: command.commandId, status: 'ok' }), true);
    await until(() => h.manager.getActiveRun() === null, 'passenger completion');
    assert.equal(h.bridge.pendingCount(), 0);
    assert.equal(h.manager.getPublicSnapshot().lastExecution.manifest.items[0].status, 'unloaded');
    h.commit('new'); await h.begin();
    assert.equal(h.manager.getActiveRun().missionId, 'new');
    assert.equal(h.bridge.handleAck({ type: 'mission_scene_deboarding_ack', commandId: command.commandId, status: 'ok' }), false);
});

test('late old scene ACK, old intent and cached duplicate cannot alter new run', async t => {
    const h = fixture(t); h.pauseScenes = true;
    await h.intent('prepare_mission');
    const oldSpawn = h.commands.find(x => x.type === 'mission_scene_spawn');
    assert.ok(oldSpawn);
    assert.equal(h.bridge.pendingCount(), 1);
    assert.equal(h.bridge.handleAck({ type: 'mission_scene_spawn_ack', commandId: oldSpawn.commandId, status: 'ok' }), true);
    await until(() => h.manager.getPublicSnapshot().execution.allowedActions.includes('start_boarding'), 'old spawn ACK');
    h.pauseScenes = false;
    await h.intent('start_boarding'); await h.intent('set_manifest_item', { itemId: 'medical-box', action: 'load' });
    await until(() => h.runtime.publicState().effects.pendingEffects.length === 0, 'old boarding settled');
    await h.intent('sign_manifest'); await h.intent('confirm_load');
    await until(() => h.manager.getExecutionSnapshot().state.phase === 'boarded', 'old load settled');
    const oldStart = h.request('start_mission');
    assert.equal((await h.control.submitIntent(oldStart)).ok, true);
    await h.arrive(); await h.close(); h.commit('new'); await h.begin();
    const before = JSON.stringify(h.manager.getPublicSnapshot());
    assert.equal(h.bridge.handleAck({ type: 'mission_scene_spawn_ack', commandId: oldSpawn.commandId, status: 'ok' }), false);
    const stale = await h.control.submitIntent({ ...oldStart, commandId: 'late-old-command' });
    assert.equal(stale.ok, false);
    const duplicate = await h.control.submitIntent(oldStart);
    assert.equal(duplicate.duplicate, true);
    assert.equal(JSON.stringify(h.manager.getPublicSnapshot()), before);
});

test('restart preserves terminal archive and payload baseline without reviving old run', async t => {
    const h = fixture(t); await h.begin();
    const credentials = { missionId: 'old', runId: h.manager.getActiveRun().runId };
    const baseline = { payloadAdapter: 'msfs_payload_stations', payloadStationCount: 2,
        sampledStationCount: 2, stations: [{ index: 1, weightLbs: 170 }, { index: 2, weightLbs: 0 }] };
    assert.equal(h.manager.recordExecutionPayloadRecovery({ ...credentials, action: 'capture', baseline }).ok, true);
    const capturedBaseline = h.manager.getExecutionPayloadRecovery(credentials).baseline;
    assert.equal(h.manager.recordExecutionPayloadRecovery({ ...credentials, action: 'write_attempted' }).ok, true);
    await h.arrive(); const ended = await h.close(); h.restart();
    assert.equal(h.manager.getActiveRun(), null);
    assert.equal(h.manager.getPublicSnapshot().lastRun.runId, ended.lastRun.runId);
    h.commit('new');
    assert.deepEqual(h.manager.getLastExecutionPayloadRecovery(h.manager.getActiveRun()).recovery.baseline, capturedBaseline);
    await h.begin();
    assert.equal(h.manager.getExecutionSnapshot().state.phase, 'active');
});

test('failed durable finalization retains closed run; retry frees it without repeating farewell', async t => {
    const h = fixture(t); await h.begin(); await h.arrive();
    h.failFinalization = true; await h.intent('confirm_unload', {}, 'efb');
    await until(() => h.manager.getExecutionSnapshot()?.state.phase === 'closed', 'closed before outbox retry');
    assert.ok(h.manager.getActiveRun());
    assert.equal(h.manager.acquire({ missionId: 'new', clientId: 'web-client', resumeBundle: bundle('new') }).ok, false);
    h.failFinalization = false;
    h.runtime.observeTelemetry({ observedAt: Date.now() + 30000, lat: 48.3, lon: 8.5, onGround: true, gsKts: 0 });
    await until(() => h.manager.getActiveRun() === null, 'outbox retry');
    assert.equal(h.voices.filter(x => x.kind === 'farewell').length, 1);
    h.commit('new'); await h.begin();
    assert.equal(h.manager.getActiveRun().missionId, 'new');
});

test('real terminal tracker snapshot rejects late old web packet and starts new mission without reload', async t => {
    const h = fixture(t); await h.begin();
    const delayed = structuredClone(h.manager.getPublicSnapshot());
    await h.arrive(); const terminal = await h.close();
    const { c, trace } = sandbox({ skipBootstrap: true });
    const snapshot = () => ({ authoritySnapshot: h.manager.getPublicSnapshot(),
        control: h.manager.getPublicSnapshot().execution, lastControl: h.manager.getPublicSnapshot().lastExecution });
    c.gaCockpitSessionClient.missionSnapshot = async () => snapshot();
    c.gaCockpitSessionClient.submitIntent = request => {
        trace.push({ kind: 'sent-intent', missionId: request.missionId, runId: request.runId });
        return h.control.submitTrustedIntent(request, { clientId: 'web-client', role: 'web' });
    };
    c._ensureMissionAuthorityForStart = async () => {
        h.acquire(c.currentMissionData.missionId);
        c.lastTrackerMissionAuthority = h.manager.getPublicSnapshot();
        c.lastTrackerMissionStatus = h.manager.getActiveRun();
        return true;
    };
    c._pushMissionAuthoritySnapshotForExecutionHandoff = async () => ({ status: 'ok', authoritativeRun: h.manager.getActiveRun() });
    c._sendMissionAuthorityRequest = async request => {
        const result = request.type.endsWith('_prepare')
            ? h.manager.prepareExecutionAuthority(request) : h.manager.commitExecutionAuthority(request);
        return { ...result, authoritativeRun: result.activeRun };
    };
    c._handleTrackerMissionAuthoritySnapshot(terminal, 'actual-terminal');
    assert.equal(c._completeMissionCloseCleanupLocal({ missionId: 'old', runId: terminal.lastRun.runId }), true);
    c.currentMissionData = { missionId: 'new' }; c._resetMissionRuntime();
    assert.equal(c._handleTrackerMissionAuthoritySnapshot(delayed, 'delayed-old-active'), false);
    // Also exercise HTTP repair of a legacy stale fallback, independently
    // of rejecting the late relay packet above.
    c.lastTrackerMissionStatus = delayed.activeRun;
    await c._refreshTrackerExecutionControl('legacy-fallback-repair');
    assert.equal(c.lastTrackerMissionStatus, null);
    assert.equal(c.gaTrackerExecutionControl, null);
    assert.equal(await c.handleMissionStartBannerAction(), true);
    assert.deepEqual(trace.filter(x => x.kind === 'sent-intent').map(x => x.missionId), ['new']);
    const reset = await h.control.submitIntent({ ...h.sessions.efb, commandId: 'efb-reset-stale-run',
        intent: 'abort_mission', missionId: 'old', runId: terminal.lastRun.runId,
        expectedRevision: delayed.activeRun.revision, payload: { reason: 'efb-toolbar-reset' } });
    assert.equal(reset.ok, false);
    assert.equal(reset.error, 'mission_run_conflict');
    assert.equal(h.manager.getActiveRun().missionId, 'new');
    assert.equal(h.manager.getExecutionSnapshot().state.phase, 'prepare');
    t.diagnostic('Late terminal run ignored; fresh HTTP snapshot clears stale web RAM; start prepares new run without reload; late EFB abort cannot abort new run.');
});

test('unfinished mission replacement waits for cleanup and abort ACK before starting new mission', async t => {
    const h = fixture(t); await h.begin();
    const oldRun = h.manager.getActiveRun();
    const delayed = h.manager.getPublicSnapshot();
    h.blockCleanup = gate();
    const abort = h.control.submitIntent(h.request('abort_mission', { reason: 'new-mission-replacement' }));
    await until(() => h.cleanup.length === 1, 'abort cleanup started');
    assert.equal(h.manager.getActiveRun().runId, oldRun.runId);
    assert.equal(h.manager.acquire({ missionId: 'new', clientId: 'web-client', resumeBundle: bundle('new') }).ok, false);
    h.blockCleanup.release(); h.blockCleanup = null;
    const result = await abort;
    assert.equal(result.ok, true);
    assert.equal(h.manager.getActiveRun(), null);
    assert.equal(h.manager.getPublicSnapshot().lastRun.state, 'aborted');
    assert.equal(h.cleanup[0].runId, oldRun.runId);
    h.commit('new'); await h.begin();
    const { c } = sandbox({ skipBootstrap: true });
    c.currentMissionData = { missionId: 'new' };
    c.gaTrackerExecutionAbortedRunId = oldRun.runId;
    c.lastTrackerMissionAuthority = h.manager.getPublicSnapshot();
    c.lastTrackerMissionStatus = h.manager.getActiveRun();
    assert.equal(c._handleTrackerMissionAuthoritySnapshot(delayed, 'late-aborted-run'), false);
    assert.equal(c.lastTrackerMissionStatus.missionId, 'new');
    assert.equal(h.manager.getExecutionSnapshot().state.phase, 'active');
});

test('failed unfinished mission cleanup prevents replacement and retains original run', async t => {
    const h = fixture(t); await h.begin();
    const old = h.manager.getActiveRun(); h.failCleanup = true;
    const result = await h.control.submitIntent(h.request('abort_mission', { reason: 'new-mission-replacement' }));
    assert.equal(result.ok, false); assert.equal(result.error, 'sim_cleanup_failed');
    assert.equal(h.manager.getActiveRun().runId, old.runId);
    assert.equal(h.manager.acquire({ missionId: 'new', clientId: 'web-client', resumeBundle: bundle('new') }).ok, false);
    h.failCleanup = false; await h.intent('abort_mission', { reason: 'new-mission-replacement' });
    h.commit('new'); await h.begin();
    assert.equal(h.manager.getActiveRun().missionId, 'new');
});
