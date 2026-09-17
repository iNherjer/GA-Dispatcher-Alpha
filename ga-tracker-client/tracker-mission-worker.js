'use strict';
const { createMissionIpc, difference, missionRequestTimeout } = require('./tracker-mission-ipc.js');
const { recordGeneratedText } = require('./tracker-mission-poi-voice.js');
const { createMissionAuthorityManager } = require('./mission-authority-core.js');
const { createTrackerMissionExecutionRuntime } = require('./tracker-mission-execution-runtime.js');
const { createTrackerFlightLogStore } = require('./tracker-flight-log-store.js');

function runMissionWorker() {
  let authority, runtime, bridge, flightLog, published = null, publishScheduled = false;
  let cachedAuthority = null, cachedVersion = -1;
  const publishMetrics = { calls: 0, builds: 0, buildMs: 0, diffMs: 0, sends: 0 };
  let livePosition = null, audioSettings = null, simulatorGeneration = 0;
  const log = line => ipc.event('log', line);
  const publish = () => {
    if (!authority) return;
    publishScheduled = false;
    publishMetrics.calls++;
    const version = authority.getPublicationVersion();
    if (version !== cachedVersion) {
      const started = process.hrtime.bigint();
      const active = authority.getActiveRun({ includeBundle: true, includeEffects: true });
      cachedAuthority = {
        active, public: authority.getPublicSnapshot(), execution: authority.getExecutionSnapshot(),
        context: active ? { latestTelemetry: authority.getExecutionRuntimeContext({ missionId: active.missionId, runId: active.runId })?.latestTelemetry } : null,
        supportsPoi: authority.supportsExecutionRecipe('poi')
      };
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
      const manager = createMissionAuthorityManager({ ...options.authority, log });
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
        authorityManager: authority, enabled: options.enabled, syncInitialPayload: true, allowIntentRevisionRebase: true,
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
      for (const point of motion || []) runtime.observeMotionTelemetry?.(point);
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
    flush() { const result = runtime.flush(); publish(); return result; }
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
    if (authority) log(`MISSION_PROCESS_COST totals=${JSON.stringify({ publication: publishMetrics, persistence: authority.getPersistenceMetrics() })}`);
  }, 10000);
  metricsTimer.unref();
  process.once('disconnect', () => { try { runtime?.flush(); } finally { process.exit(0); } });
}
module.exports = { runMissionWorker };
if (require.main === module) runMissionWorker();
