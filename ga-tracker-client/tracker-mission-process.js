'use strict';
const { projectStartReadiness } = require('./tracker-mission-start-readiness');
const { fork } = require('node:child_process');
const { createInterface } = require('node:readline');
const { createMissionIpc, applyDifference, missionRequestTimeout } = require('./tracker-mission-ipc.js');

async function createTrackerMissionProcess(options) {
  const log = options.log || (() => {});
  // pkg sets PKG_EXECPATH for child processes and expects an explicit script
  // entrypoint. Passing only --mission-worker makes it resolve that flag as a
  // filename. fork supplies tracker.js in both packaged and source execution.
  const child = fork(require.resolve('./tracker.js'), ['--mission-worker'], {
    stdio: ['ignore', 'inherit', 'pipe', 'ipc'], execArgv: [], windowsHide: true
  });
  const stderr = createInterface({ input: child.stderr });
  stderr.on('line', line => log(`MISSION_PROCESS_STDERR ${line.slice(0, 2000)}`));
  let state = {}, simulator = null, activeBridge = null, disconnected = false, simulatorGeneration = 0, closing = null;
  let pendingSample = null, pendingMotion = [], telemetrySending = false, coalesced = 0, motionOverflow = 0;
  let pendingReadiness, readinessSending = false;
  const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));
  // Read-only view for frequent readers (EFB mission poll every 300-550 ms,
  // map snapshot, shadow observer). Large parts are copied and frozen once per
  // change instead of on every call; getActiveRun keeps detached copies.
  const viewParts = new Map();
  const deepFreeze = value => {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
      Object.freeze(value);
      for (const child of Object.values(value)) deepFreeze(child);
    }
    return value;
  };
  const viewPart = (key, value) => {
    if (value == null) return value;
    if (!viewParts.has(key)) viewParts.set(key, deepFreeze(clone(value)));
    return viewParts.get(key);
  };
  const invalidateView = changes => {
    for (const { path } of changes) {
      if (path.length === 0 || (path[0] === 'active' && path.length === 1)) { viewParts.clear(); return; }
      if (path[0] !== 'active') continue;
      if (path[1] === 'resumeBundle') {
        viewParts.delete('bundle');
        if (path.length === 2) for (const key of [...viewParts.keys()]) { if (key.startsWith('bundle:')) viewParts.delete(key); }
        else viewParts.delete(`bundle:${path[2]}`);
      } else if (path[1] === 'navigationRoute' || path[1] === 'effects') viewParts.delete(path[1]);
    }
  };
  const bundleView = bundle => {
    if (!bundle || typeof bundle !== 'object') return clone(bundle);
    if (!viewParts.has('bundle')) {
      viewParts.set('bundle', Object.freeze(Object.fromEntries(Object.entries(bundle)
        .map(([key, value]) => [key, viewPart(`bundle:${key}`, value)]))));
    }
    return viewParts.get('bundle');
  };
  const context = () => ({ audioSettings: options.getAudioSettings?.() || null, livePosition: simulator?.getLivePosition?.() || null });
  const ipc = createMissionIpc(child, {
    callback(name, args, generation) {
      const target = ['playBoardingVoice', 'prepareBoardingVoice', 'playFarewellVoice', 'playComplianceVoice', 'recordAuthoritySanction'].includes(name) ? options : simulator;
      if (target !== options && generation !== simulatorGeneration) throw Error('mission_simulator_connection_changed');
      if (!target || typeof target[name] !== 'function') throw Error('mission_simulator_not_connected');
      return target[name](...args);
    }
  }, {
    timeoutForRequest: missionRequestTimeout,
    onEvent(name, value) {
      if (name === 'state') { invalidateView(value); state = applyDifference(state, value); }
      else if (name === 'log') log(value);
      else if (name === 'authorityChanged') options.onAuthorityChanged?.(value.reason, { state: { phase: value.phase } });
    }
  });
  child.once('exit', (code, signal) => {
    disconnected = true; ipc.close();
    log(`MISSION_PROCESS_EXIT pid=${child.pid} code=${code} signal=${signal || ''}`);
  });
  const initialized = await ipc.request('initialize', {
    authority: options.authority, enabled: options.enabled, pilotId: options.pilotId, requireCockpitReady: options.requireCockpitReady === true,
    independentStartReadiness: options.independentStartReadiness === true,
    flightLogDirectory: options.flightLogDirectory
  }).catch(error => { log(`MISSION_PROCESS_START_ERROR error=${error.message}`); child.kill(); throw error; });
  const authorityManager = {};
  for (const name of initialized.methods) authorityManager[name] = (...args) => ipc.request('authority', name, args);
  Object.assign(authorityManager, {
    getActiveRun: (settings = {}) => {
      if (!state.active) return null;
      const { resumeBundle, effects, navigationRoute, ...summary } = state.active;
      return clone({ ...summary, ...(settings.includeBundle ? { resumeBundle, navigationRoute } : {}), ...(settings.includeEffects ? { effects } : {}) });
    },
    getActiveRunView: (settings = {}) => {
      if (!state.active) return null;
      const { resumeBundle, effects, navigationRoute, ...summary } = state.active;
      const run = clone(summary);
      if (settings.includeBundle) {
        if (resumeBundle !== undefined) run.resumeBundle = bundleView(resumeBundle);
        if (navigationRoute !== undefined) run.navigationRoute = viewPart('navigationRoute', navigationRoute);
      }
      if (settings.includeEffects && effects !== undefined) run.effects = viewPart('effects', effects);
      return run;
    },
    recordGeneratedText: (request, text) => ipc.request('recordGeneratedText', request, text),
    getPublicSnapshot: () => {
      const snapshot = clone(state.public);
      if (snapshot?.execution && state.runtime?.startReadiness) snapshot.execution = projectStartReadiness(snapshot.execution, state.runtime.startReadiness);
      return snapshot;
    },
    getExecutionSnapshot: () => clone(state.execution),
    getExecutionTrainingRecipe: () => clone(state.active?.resumeBundle?.executionTrainingRecipe || null),
    getExecutionRuntimeContext: request => request?.runId === state.active?.runId ? clone(state.context) : null,
    supportsExecutionRecipe: recipe => recipe === 'apt' || (recipe === 'poi' && state.supportsPoi)
  });
  const background = promise => promise.catch(error => log(`MISSION_PROCESS_ERROR error=${error.message}`));
  const sendTelemetry = () => {
    if (telemetrySending || disconnected || (!pendingSample && !pendingMotion.length)) return;
    const sample = pendingSample, motion = pendingMotion;
    pendingSample = null; pendingMotion = []; telemetrySending = true;
    background(ipc.request('telemetry', sample, motion, context()).finally(() => {
      telemetrySending = false; sendTelemetry();
    }));
  };
  const sendReadiness = () => {
    if (readinessSending || disconnected || pendingReadiness === undefined) return;
    const sample = pendingReadiness; pendingReadiness = undefined; readinessSending = true;
    background(ipc.request('readiness', sample, simulatorGeneration).finally(() => {
      readinessSending = false; sendReadiness();
    }));
  };
  const runtime = {
    enabled: options.enabled, executionAuthority: options.enabled ? 'tracker' : 'web',
    publicState: () => ({ ...clone(state.runtime), ...(state.runtime?.startReadiness ? { startReadiness: projectStartReadiness({}, state.runtime.startReadiness).startReadiness } : {}), simulatorAttached: !disconnected && Boolean(simulator) && state.runtime?.simulatorAttached === true, processId: initialized.pid, processAvailable: !disconnected, telemetry: { inFlight: Number(telemetrySending), pending: Number(Boolean(pendingSample)), motionPending: pendingMotion.length, coalesced, motionOverflow } }),
    async executeIntent(request) {
      const started = Date.now();
      try { return await ipc.request('intent', request, context()); }
      finally { log(`MISSION_PROCESS_INTENT intent=${request.intent || ''} commandId=${request.commandId || ''} roundTripMs=${Date.now() - started}`); }
    },
    observeTelemetry(sample) { if (pendingSample) coalesced++; pendingSample = sample; sendTelemetry(); return null; },
    observeStartReadiness(sample) { pendingReadiness = sample; sendReadiness(); },
    observeMotionTelemetry(sample) {
      pendingMotion.push(sample);
      if (pendingMotion.length > 512) { pendingMotion.shift(); motionOverflow++; }
      sendTelemetry();
    },
    attachSimulator(value) {
      simulator = value;
      const generation = ++simulatorGeneration;
      background(ipc.request('attach', value.getLivePosition?.() || null, generation));
      activeBridge = { handleAck: ack => background(ipc.request('ack', ack, generation)) };
      return activeBridge;
    },
    detachSimulator(bridge = null) {
      if (bridge && bridge !== activeBridge) return false;
      background(Promise.resolve(simulator?.cancelPayloadSync?.('simulator-detached')));
      simulator = null; activeBridge = null; simulatorGeneration++;
      pendingSample = null; pendingMotion = [];
      pendingReadiness = undefined;
      background(ipc.request('detach')); return true;
    },
    diagnostics: () => ipc.request('diagnostics'),
    flush: () => ipc.request('flush')
  };
  log(`MISSION_PROCESS_READY pid=${initialized.pid} parentPid=${process.pid} telemetry=latest`);
  return { authorityManager, runtime, flightLog: { publicState: () => clone(state.flightLog) }, close() {
    if (closing) return closing;
    closing = (async () => {
      if (disconnected) return;
      const exited = new Promise(resolve => child.once('exit', resolve));
      const deadline = setTimeout(() => child.kill(), 5000);
      try {
        await runtime.flush();
      } finally {
        if (child.connected) child.disconnect();
        await exited;
        clearTimeout(deadline);
      }
    })();
    return closing;
  } };
}
module.exports = { createTrackerMissionProcess };
