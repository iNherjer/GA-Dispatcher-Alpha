'use strict';
const { fork, spawn } = require('node:child_process');
const { createMissionIpc, applyDifference } = require('./tracker-mission-ipc.js');

async function createTrackerMissionProcess(options) {
  const child = process.pkg
    ? spawn(process.execPath, ['--mission-worker'], { stdio: ['ignore', 'inherit', 'inherit', 'ipc'], windowsHide: true })
    : fork(require.resolve('./tracker.js'), ['--mission-worker'], { stdio: ['ignore', 'inherit', 'inherit', 'ipc'], execArgv: [] });
  let state = {}, simulator = null, activeBridge = null, disconnected = false, simulatorGeneration = 0, closing = null;
  let pendingSample = null, pendingMotion = [], telemetrySending = false, coalesced = 0, motionOverflow = 0;
  const log = options.log || (() => {});
  const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));
  const context = () => ({ audioSettings: options.getAudioSettings?.() || null, livePosition: simulator?.getLivePosition?.() || null });
  const ipc = createMissionIpc(child, {
    callback(name, args, generation) {
      const target = ['playBoardingVoice', 'prepareBoardingVoice', 'playFarewellVoice', 'playComplianceVoice'].includes(name) ? options : simulator;
      if (target !== options && generation !== simulatorGeneration) throw Error('mission_simulator_connection_changed');
      if (!target || typeof target[name] !== 'function') throw Error('mission_simulator_not_connected');
      return target[name](...args);
    }
  }, {
    onEvent(name, value) {
      if (name === 'state') state = applyDifference(state, value);
      else if (name === 'log') log(value);
      else if (name === 'authorityChanged') options.onAuthorityChanged?.(value.reason, { state: { phase: value.phase } });
    }
  });
  child.once('exit', (code, signal) => {
    disconnected = true; ipc.close();
    log(`MISSION_PROCESS_EXIT pid=${child.pid} code=${code} signal=${signal || ''}`);
  });
  const initialized = await ipc.request('initialize', {
    authority: options.authority, enabled: options.enabled, pilotId: options.pilotId,
    flightLogDirectory: options.flightLogDirectory
  }).catch(error => { child.kill(); throw error; });
  const authorityManager = {};
  for (const name of initialized.methods) authorityManager[name] = (...args) => ipc.request('authority', name, args);
  Object.assign(authorityManager, {
    getActiveRun: (settings = {}) => {
      if (!state.active) return null;
      const { resumeBundle, effects, navigationRoute, ...summary } = state.active;
      return clone({ ...summary, ...(settings.includeBundle ? { resumeBundle, navigationRoute } : {}), ...(settings.includeEffects ? { effects } : {}) });
    },
    getPublicSnapshot: () => clone(state.public),
    getExecutionSnapshot: () => clone(state.execution),
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
  const runtime = {
    enabled: options.enabled, executionAuthority: options.enabled ? 'tracker' : 'web',
    publicState: () => ({ ...clone(state.runtime), processId: initialized.pid, processAvailable: !disconnected, telemetry: { inFlight: Number(telemetrySending), pending: Number(Boolean(pendingSample)), motionPending: pendingMotion.length, coalesced, motionOverflow } }),
    async executeIntent(request) {
      const started = Date.now();
      try { return await ipc.request('intent', request, context()); }
      finally { log(`MISSION_PROCESS_INTENT intent=${request.intent || ''} commandId=${request.commandId || ''} roundTripMs=${Date.now() - started}`); }
    },
    observeTelemetry(sample) { if (pendingSample) coalesced++; pendingSample = sample; sendTelemetry(); return null; },
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
      background(ipc.request('detach')); return true;
    },
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
