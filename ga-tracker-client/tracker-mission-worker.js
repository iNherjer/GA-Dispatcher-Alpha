'use strict';
const { createMissionIpc, difference, missionRequestTimeout } = require('./tracker-mission-ipc.js');
const { recordGeneratedText } = require('./tracker-mission-poi-voice.js');
const { createMissionAuthorityManager } = require('./mission-authority-core.js');
const { createTrackerMissionExecutionRuntime } = require('./tracker-mission-execution-runtime.js');
const { createTrackerFlightLogStore } = require('./tracker-flight-log-store.js');

function runMissionWorker() {
  let authority, runtime, bridge, flightLog, published = null, publishScheduled = false;
  let cachedAuthority = null, cachedVersion = -1, readPublication;
  const publishMetrics = { calls: 0, builds: 0, buildMs: 0, diffMs: 0, sends: 0 };
  let livePosition = null, audioSettings = null, simulatorGeneration = 0;
  let motionDiagnostics = { samples:0, paused:0, menu:0, gSamples:0, bankSamples:0, maxG:null, maxBank:null, minVs:null };
  function recordMotionDiagnostic(sample) {
    if (!sample) return;
    const d = motionDiagnostics; d.samples++;
    if (sample.simPaused) d.paused++; if (sample.inMenuOrMap) d.menu++;
    if (typeof sample.gForce === 'number' && Number.isFinite(sample.gForce)) { d.gSamples++; d.maxG = Math.max(d.maxG ?? sample.gForce, sample.gForce); }
    if (typeof sample.bankDeg === 'number' && Number.isFinite(sample.bankDeg)) { d.bankSamples++; d.maxBank = Math.max(d.maxBank ?? 0, Math.abs(sample.bankDeg)); }
    if (typeof sample.vsFpm === 'number' && Number.isFinite(sample.vsFpm)) d.minVs = Math.min(d.minVs ?? sample.vsFpm, sample.vsFpm);
  }
  const log = line => ipc.event('log', line);
  const publish = () => {
    if (!authority) return;
    publishScheduled = false;
    publishMetrics.calls++;
    const version = authority.getPublicationVersion();
    if (version !== cachedVersion) {
      const started = process.hrtime.bigint();
      cachedAuthority = readPublication();
      cachedVersion = version;
      publishMetrics.builds++;
      publishMetrics.buildMs += Number(process.hrtime.bigint() - started) / 1e6;
    }
    const next = { ...cachedAuthority, flightLog: flightLog?.publicState(), runtime: runtime?.publicState() || null };
    const started = process.hrtime.bigint();
    const changes = difference(published, next);
    publishMetrics.diffMs += Number(process.hrtime.bigint() - started) / 1e6;
    if (changes.length) { publishMetrics.sends++; ipc.event('state', changes); }
    published = next;
  };
  const schedulePublish = () => {
    if (publishScheduled) return;
    publishScheduled = true;
    setImmediate(() => { if (publishScheduled) publish(); });
  };
  const invokeParent = (name, ...args) => { publish(); return ipc.request('callback', name, args); };
  const handlers = {
    initialize(options) {
      if (authority) throw Error('mission_process_already_initialized');
      const manager = createMissionAuthorityManager({ ...options.authority, periodicCheckpoint: true, log, onPublicationReader: reader => { readPublication = reader; } });
      authority = {};
      for (const [name, method] of Object.entries(manager)) {
        authority[name] = typeof method === 'function' ? (...args) => {
          const result = method(...args);
          if (!/^(get|supports|can)/.test(name)) schedulePublish();
          return result;
        } : method;
      }
      flightLog = createTrackerFlightLogStore({ directory: options.flightLogDirectory, log });
      runtime = createTrackerMissionExecutionRuntime({
        authorityManager: authority, enabled: options.enabled, syncInitialPayload: true, allowIntentRevisionRebase: true, recoverCargoCheckpoint: true, fairEffectScheduling: true,
        getPilotId: () => options.pilotId, getAudioSettings: () => audioSettings,
        flightLog,
        playBoardingVoice: request => invokeParent('playBoardingVoice', request),
        prepareBoardingVoice: request => invokeParent('prepareBoardingVoice', request),
        playFarewellVoice: request => invokeParent('playFarewellVoice', request),
        playComplianceVoice: request => invokeParent('playComplianceVoice', request),
        onAuthorityChanged(reason, snapshot) {
          publish(); ipc.event('authorityChanged', { reason, phase: snapshot?.state?.phase });
        }, log
      });
      publish();
      return { pid: process.pid, methods: Object.keys(manager).filter(key => typeof manager[key] === 'function') };
    },
    async authority(name, args) {
      if (!authority || !Object.hasOwn(authority, name) || typeof authority[name] !== 'function') throw Error('mission_authority_method_unknown');
      const result = await authority[name](...args);
      publish(); return result;
    },
    recordGeneratedText(request, text) {
      // Read revisions and commit on the authority's loop, never against the
      // possibly older presentation snapshot held by the voice process.
      const result = recordGeneratedText(authority, request, text);
      publish(); return result;
    },
    async intent(request, context) {
      const started = Date.now();
      audioSettings = context?.audioSettings || null;
      const result = await runtime.executeIntent(request);
      publish();
      log(`MISSION_PROCESS_WORK intent=${request.intent || ''} commandId=${request.commandId || ''} durationMs=${Date.now() - started}`);
      return result;
    },
    telemetry(sample, motion, context) {
      livePosition = context?.livePosition || sample || livePosition;
      audioSettings = context?.audioSettings || null;
      for (const point of motion || []) { recordMotionDiagnostic(point); runtime.observeMotionTelemetry?.(point); }
      recordMotionDiagnostic(sample);
      const result = sample ? runtime.observeTelemetry(sample) : null;
      if (result?.acceptedEvent) log(`MISSION_EXECUTION_TELEMETRY event=${result.acceptedEvent.type || ''} sequence=${result.acceptedEvent.sequence || 0} phase=${result.activeRun?.phase || ''}`);
      if (sample) publish(); return result;
    },
    attach(position, generation) {
      simulatorGeneration = generation;
      livePosition = position;
      const simulatorCall = (name, ...args) => { publish(); return ipc.request('callback', name, args, generation); };
      bridge = runtime.attachSimulator({
        getLivePosition: () => livePosition,
        dispatchCommand: request => simulatorCall('dispatchCommand', request),
        syncPayloadBeforeStart: request => simulatorCall('syncPayloadBeforeStart', request),
        syncPayloadManifestState: request => simulatorCall('syncPayloadManifestState', request),
        // The parent cancels its adapter before retiring the connection. Calling
        // back from detach would target an already invalid generation.
        cancelPayloadSync: () => true,
        cleanupMission: request => simulatorCall('cleanupMission', request)
      });
      publish(); return true;
    },
    async ack(ack, generation) { if (generation !== simulatorGeneration) return false; const result = await bridge?.handleAck(ack); publish(); return result; },
    detach() { simulatorGeneration++; const result = runtime.detachSimulator(bridge); bridge = null; publish(); return result; },
    diagnostics() { return { publication: { ...publishMetrics }, persistence: authority.getPersistenceMetrics() }; },
    async flush() {
      const result = await runtime.flush();
      const saved = await authority.flushPersistence();
      publish();
      if (!saved) throw Error('mission_checkpoint_failed');
      return result;
    }
  };
  const ipc = createMissionIpc(process, handlers, { timeoutForRequest: missionRequestTimeout });
  let lastLoopAt = Date.now(), lastLoopLog = 0;
  const loopTimer = setInterval(() => {
    const now = Date.now(), lagMs = Math.max(0, now - lastLoopAt - 1000);
    lastLoopAt = now;
    if (lagMs >= 500 && now - lastLoopLog >= 10000) {
      lastLoopLog = now; log(`MISSION_PROCESS_LOOP lagMs=${lagMs}`);
    }
  }, 1000);
  loopTimer.unref();
  const metricsTimer = setInterval(() => {
    if (authority && motionDiagnostics.samples) log(`MISSION_MOTION_DIAGNOSTIC data=${JSON.stringify({ scope: 'process-total', ...motionDiagnostics, runId: authority.getActiveRun()?.runId || null, motionProtectionEnabled: authority.getExecutionComfortContext()?.motionProtectionEnabled === true })}`);
    if (authority) log(`MISSION_PROCESS_COST totals=${JSON.stringify({ publication: publishMetrics, persistence: authority.getPersistenceMetrics() })}`);
  }, 10000);
  metricsTimer.unref();
  process.once('disconnect', async () => {
    const deadline = setTimeout(() => process.exit(1), 4000);
    try { await runtime?.flush(); await authority?.flushPersistence(); }
    finally { clearTimeout(deadline); authority?.stopPersistence(); process.exit(0); }
  });
}
module.exports = { runMissionWorker };
if (require.main === module) runMissionWorker();
