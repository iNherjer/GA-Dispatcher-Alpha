import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ui from '../mission-apt-ui-core.js';
import controlUi from '../ga-tracker-client/mission-control-ui-core.js';
const sync = fs.readFileSync(new URL('../sync.js', import.meta.url), 'utf8');
const cargo = fs.readFileSync(new URL('../mission-cargo-core.js', import.meta.url), 'utf8');
const between = (text, start, end) => {
  const a = text.indexOf(start), b = text.indexOf(end, a + start.length);
  assert.ok(a >= 0 && b > a, start);
  return text.slice(a, b);
};
// Execute the real App wrapper, including its historical fallback.
const bannerContext = { window: { GAMissionAptUiCore: ui }, Date };
vm.createContext(bannerContext);
vm.runInContext(between(sync, 'function _trackerMissionBannerModel(', 'function _renderTrackerMissionBanner('), bannerContext);
assert.equal(bannerContext._trackerMissionBannerModel({ executionAuthority: 'tracker', missionId: 'm', phase: 'enroute',
  flags: { active: true, onGround: false }, allowedActions: ['set_manifest_item'] }), null);

// A projected signature must repaint when its timer ends even without another snapshot.
let clock = 100000, redraws = 0, timer;
const signatureContext = {
  Date: { now: () => clock }, clearTimeout() {},
  document: { getElementById: () => ({ style: { display: 'flex' } }) },
  _missionCargoActionDialogMode: options => options.mode,
  _missionCargoRenderDialog: () => { redraws++; },
  window: { missionCargoStatus: { lastMode: 'load' }, setTimeout: callback => { timer = callback; return 1; } }
};
vm.createContext(signatureContext);
vm.runInContext(between(cargo, 'function _missionCargoClearSignatureAnimation(', 'window.missionCargoSignDispatchList ='), signatureContext);
assert.equal(signatureContext.window.missionCargoAdoptTrackerSignatureAnimation({ scope: 'departure', at: clock }), true);
clock += 1640; timer();
assert.equal(redraws, 1);
assert.equal(signatureContext.window.missionCargoStatus.signatureAnimationEndsAt, 0);
assert.doesNotMatch(between(sync, 'function _applyTrackerExecutionControl(', 'function _finalizeTrackerExecutionProjection('), /AdoptTrackerSignatureAnimation[^\n]*render: false/);

// Ordered item commands survive rapid clicks; duplicate clicks join, failures do not poison the queue.
let release, revision = 1;
const calls = [];
const queue = controlUi.createIntentQueue();
const first = queue.enqueue('run|item-a|load', 'a', async () => { calls.push(revision); await new Promise(r => { release = r; }); revision++; return true; });
assert.equal(queue.enqueue('run|item-a|load', 'a', () => { throw new Error('duplicate'); }), first);
const second = queue.enqueue('run|item-b|load', 'b', () => { calls.push(revision); throw new Error('rejected'); });
const caught = second.catch(e => e.message);
const third = queue.enqueue('run|item-c|load', 'c', () => { calls.push(revision); return true; });
await Promise.resolve();
assert.deepEqual(queue.pendingItemIds(), ['a', 'b', 'c']);
release();
assert.equal(await first, true);
assert.equal(await caught, 'rejected');
assert.equal(await third, true);
assert.deepEqual(calls, [1, 2, 2]);
assert.equal(queue.size(), 0);

// A tracker observer ignores browser ownership; Web-Authority still detects it.
let projected = 0, restores = 0;
const statusContext = {
  Date, _normalizeMissionRuntimeId: value => value, _activeMissionRuntimeId: () => 'm',
  _readMissionAuthorityState: () => ({ runId: 'old-run' }), _missionAuthorityClientId: () => 'phone',
  _missionExecutionControlSnapshot: () => ({ runId: 'run' }), _applyTrackerExecutionControl: () => projected++,
  _missionPhaseDebugPush() {}, _updateMissionRuntimeUi() {},
  missionRuntimeResumeConflictLastSig: '', missionRuntimeResumeConflictLastLogAt: 0,
  missionTrackerObserverPromise: null, missionTrackerObserverRetryAt: 0,
  window: { resumeTrackerMissionOnThisDevice: async () => { restores++; return true; } }
};
vm.createContext(statusContext);
vm.runInContext(between(sync, 'function _handleTrackerMissionStatus(', 'function _handleTrackerMissionAuthoritySnapshot('), statusContext);
const status = { missionId: 'm', runId: 'run', ownerClientId: 'other-device', active: true, state: 'active', executionAuthority: 'tracker' };
assert.equal(statusContext._handleTrackerMissionStatus(status), true);
assert.equal(statusContext.window.missionRuntimeResumeConflict, null);
assert.equal(projected, 1);
assert.equal(statusContext._handleTrackerMissionStatus({ ...status, executionAuthority: 'web' }), false);
assert.equal(statusContext.window.missionRuntimeResumeConflict.trackerActive, true);
statusContext._activeMissionRuntimeId = () => 'different-cloud-copy';
assert.equal(statusContext._handleTrackerMissionStatus(status), true);
assert.equal(statusContext._handleTrackerMissionStatus(status), true);
assert.equal(restores, 1, 'only one observer restore may run at a time');
await Promise.resolve(); await Promise.resolve();
console.log('PASS tracker interface regressions: airborne banner, signature timer, ordered item queue, observer vs legacy owner');

// An authoritative boarding transition opens the EFB dialog once, including
// boarding started from another interface; repeated polling preserves a close.
const host = fs.readFileSync(new URL('../ga-tracker-client/tracker-efb-kartentisch-host.js', import.meta.url), 'utf8');
let opened = 0;
const efb = { missionSnapshot: null, missionIntentPending: false, missionIntentStatus: '', missionIntentTone: '',
  cargoManagerOpen: false, missionPresentationSignature: '', missionSignature: '',
  missionRenderSignature: value => JSON.stringify(value), openCargoManager: () => opened++,
  renderMissionActionBanner() {}, renderMissionToolbar() {}, renderCargoManager() {}, byId: () => null,
  document: { querySelector: () => null }, report() {} };
vm.createContext(efb);
vm.runInContext(between(host, '  function renderMissionPayload(', '  function renderChecklistPayload('), efb);
const boarding = { available: true, missionId: 'm', control: { missionId: 'm', runId: 'r', executionAuthority: 'tracker', phase: 'boarding' } };
efb.renderMissionPayload(boarding);
efb.renderMissionPayload(boarding);
assert.equal(opened, 1);
efb.renderMissionPayload({ ...boarding, control: { ...boarding.control, runId: 'next-run' } });
assert.equal(opened, 2);
let closed = 0;
efb.closeCargoManager = fromTracker => { assert.equal(fromTracker, true); closed++; };
const closedBoarding = { ...boarding, control: { ...boarding.control, cargoWindowCloseId: 'close-from-app' } };
efb.renderMissionPayload(closedBoarding);
efb.renderMissionPayload(closedBoarding);
assert.equal(closed, 1);
assert.equal(opened, 2);
efb.missionSnapshot = null;
efb.renderMissionPayload(closedBoarding);
assert.equal(opened, 2, 'new device must not reopen a centrally closed boarding window');
console.log('PASS EFB boarding dialog opens once per phase/run transition.');

// EFB metadata buttons must retain item ID and field, just like manifest rows.
const listeners = {};
const metadataCalls = [];
const metadata = {
  byId: () => null,
  document: { createElement: () => ({ setAttribute() {}, addEventListener: (type, callback) => { listeners[type] = callback; } }), body: { appendChild() {} } },
  requestMissionIntent: (intent, payload) => { metadataCalls.push({ intent, payload }); return Promise.resolve(true); },
  window: {}
};
vm.createContext(metadata);
vm.runInContext(between(host, '  function ensureCargoManager()', '  function renderCargoManager()'), metadata);
metadata.ensureCargoManager();
for (const [intent, itemId, action] of [['set_boardbook_time', 'aircraft-bordbuch', 'landing'], ['replace_equipment', 'first-aid', 'replace'], ['request_pax_interaction', 'pax', 'load'], ['request_pax_interaction', 'pax', 'unload']]) {
  const attrs = { 'data-efb-cargo-action': 'item', 'data-mission-intent': intent, 'data-mission-item-id': itemId, 'data-mission-item-action': action };
  listeners.click({ target: { closest: () => ({ getAttribute: name => attrs[name] || '' }) }, preventDefault() {}, stopPropagation() {} });
  assert.equal(metadataCalls.at(-1).payload.itemId, itemId);
  assert.equal(metadataCalls.at(-1).payload.action, action);
}
console.log('PASS EFB board-book field and equipment item reach the tracker unchanged.');

// A signature from another device uses its committed timestamp, even if polls stop.
let signatureNow = 100000, signatureTimer, signatureDelay, signatureRenders = 0;
const efbSignature = {
  Date: { now: () => signatureNow },
  cargoSignatureAnimationEndsAt: 0, cargoSignatureAnimationScope: '', cargoSignatureAnimationTimer: 0,
  missionIntentPending: false, missionIntentQueue: null, missionIntentTone: '', missionIntentStatus: '',
  drawerEscape: value => String(value || ''), cargoDateLabel: () => 'date',
  renderCargoManager: () => { signatureRenders++; },
  window: { clearTimeout() {}, setTimeout(callback, delay) { signatureTimer = callback; signatureDelay = delay; return 1; } }
};
vm.createContext(efbSignature);
vm.runInContext(between(host, '  function projectedCargoModel(', '  function cargoPayloadStatusMarkup('), efbSignature);
const signatureProjection = ui.project({ missionId: 'm', now: signatureNow, control: {
  executionAuthority: 'tracker', missionId: 'm',
  phase: 'boarding', flags: { groundStill: true },
  allowedActions: ['clear_manifest_signature', 'confirm_load'], cargo: { summary: { departureMissing: 0 } }
}, manifest: { items: [], dispatchSignature: { scope: 'departure', at: signatureNow - 600, by: 'Pilot' } } });
const signatureMission = { ui: signatureProjection };
let signatureModel = efbSignature.projectedCargoModel(signatureMission);
assert.match(efbSignature.appCargoManagerMarkup(signatureMission, signatureModel), /is-animating/);
assert.equal(signatureDelay, 1000, 'remote display must only animate the remaining time');
signatureNow += 500;
efbSignature.appCargoManagerMarkup(signatureMission, signatureModel);
assert.equal(signatureDelay, 1000, 'polls must not restart the timer');
signatureNow += 500;
signatureTimer();
assert.equal(signatureRenders, 1);
signatureModel = efbSignature.projectedCargoModel(signatureMission);
const settledMarkup = efbSignature.appCargoManagerMarkup(signatureMission, signatureModel);
assert.doesNotMatch(settledMarkup, /is-animating|Unterschrift wird eingetragen/);
assert.equal(signatureModel.actions.primary.intent, 'confirm_load');
assert.equal(signatureModel.signature.clickable, true);
console.log('PASS remote EFB signature uses remaining time and releases actions without another poll.');

// Tracker observers never reacquire the runtime on heartbeat/capability updates.
const lateBind = { missionAuthorityLateBindPending: true, _missionExecutionAuthorityIsTracker: () => true };
vm.createContext(lateBind);
vm.runInContext(between(sync, 'function _missionAuthorityRuntimeNeedsLateBind()', 'function _trackerSupportsTelemetryWake()'), lateBind);
assert.equal(lateBind._missionAuthorityRuntimeNeedsLateBind(), false);
assert.equal(lateBind.missionAuthorityLateBindPending, false);

// Closing presentation is immediate; the shared close is best effort.
const cargoOverlay = { style: { display: 'flex' } }, closeIntents = [];
const closeContext = { document: { getElementById: () => cargoOverlay }, window: {
  gaTrackerExecutionHandlesMission: () => true, liveTrackerConnected: true,
  gaTrackerExecutionSubmitIntent: (...args) => closeIntents.push(args)
} };
vm.createContext(closeContext);
vm.runInContext(between(cargo, 'window.closeMissionCargoDialog =', 'function _missionCargoActionDialogMode('), closeContext);
closeContext.window.closeMissionCargoDialog();
assert.equal(closeIntents[0][0], 'close_cargo_window');
assert.equal(cargoOverlay.style.display, 'none');
closeContext.window.closeMissionCargoDialog({ trackerProjection: true });
assert.equal(cargoOverlay.style.display, 'none');
assert.equal(closeIntents.length, 1);
closeContext.window.gaTrackerExecutionHandlesMission = () => false;
cargoOverlay.style.display = 'flex';
closeContext.window.closeMissionCargoDialog();
assert.equal(cargoOverlay.style.display, 'none');
console.log('PASS observer does not reacquire; close hides immediately and synchronizes when connected.');

// Apply a newly received close before either the unchanged-snapshot fast path
// or the normal manifest projection can replace the previous control.
const projectionPrefix = between(sync, 'function _applyTrackerExecutionControl(', '    const projectionSignature =');
let projectedCloses = 0;
const appProjection = { _normalizeMissionRuntimeId: value => value, _activeMissionRuntimeId: () => 'm',
  window: { gaTrackerExecutionControl: { missionId: 'm', runId: 'r', phase: 'boarding' },
    closeMissionCargoDialog: options => { assert.equal(options.trackerProjection, true); projectedCloses++; } } };
vm.createContext(appProjection);
vm.runInContext(projectionPrefix + '\nreturn openBoardingDialog;\n}', appProjection);
const closedControl = { missionId: 'm', runId: 'r', phase: 'boarding', executionAuthority: 'tracker', cargoWindowCloseId: 'new-close' };
assert.equal(appProjection._applyTrackerExecutionControl(closedControl), false);
assert.equal(projectedCloses, 1);
appProjection.window.gaTrackerExecutionControl = closedControl;
appProjection._applyTrackerExecutionControl(closedControl);
assert.equal(projectedCloses, 1);
console.log('PASS App applies the central close on the first new snapshot, exactly once.');

// Empty tracker heartbeats and alternating run projections must not reopen boarding.
appProjection.window.gaTrackerExecutionControl = null;
const openControl = { missionId: 'm', runId: 'new-run', phase: 'boarding', executionAuthority: 'tracker' };
assert.equal(appProjection._applyTrackerExecutionControl(openControl), true);
appProjection.window.gaTrackerExecutionControl = null;
assert.equal(appProjection._applyTrackerExecutionControl(openControl), false);
assert.equal(appProjection._applyTrackerExecutionControl({ ...openControl, runId: 'other-run' }), true);
assert.equal(appProjection._applyTrackerExecutionControl(openControl), false);
closeContext.window.liveTrackerConnected = false;
closeContext.window.gaTrackerExecutionHandlesMission = () => true;
cargoOverlay.style.display = 'flex';
closeContext.window.closeMissionCargoDialog();
assert.equal(cargoOverlay.style.display, 'none');
assert.equal(closeIntents.length, 1, 'offline close does not wait for a tracker');
const repaint = { window: { gaTrackerExecutionHandlesMission: () => true }, document: { getElementById: () => cargoOverlay } };
vm.createContext(repaint);
vm.runInContext(between(cargo, 'function _missionCargoRenderDialog(', '    const manifest = _missionCargoEnsureManifest();') + "return 'rendered';\n}", repaint);
assert.equal(repaint._missionCargoRenderDialog(), undefined);
assert.equal(repaint._missionCargoRenderDialog('load', { explicitOpen: true }), 'rendered');
repaint.window.gaTrackerExecutionHandlesMission = () => false;
assert.equal(repaint._missionCargoRenderDialog(), 'rendered', 'standalone rendering remains unchanged');
console.log('PASS offline close, late repaint, repeated/alternating boarding snapshots, explicit reopen and standalone.');

repaint.window.gaTrackerCargoDialogDismissed = true;
assert.equal(repaint._missionCargoRenderDialog(), undefined, 'an empty tracker snapshot cannot undo local dismissal');
assert.equal(repaint._missionCargoRenderDialog('load', { explicitOpen: true }), 'rendered');

// Reconnect cannot clear a tracker-owned run before its authority snapshot arrives.
let reconnectClears = 0;
const reconnect = { missionSceneReconnectResyncPending: true, missionRuntime: { active: false },
  _missionExecutionAuthorityIsTracker: () => false,
  window: { liveTrackerCapabilities: ['mission.authority.v1'], clearMissionSceneObjects: () => reconnectClears++ } };
vm.createContext(reconnect);
vm.runInContext(between(sync, 'function _reconcileMissionSceneOnTrackerReconnect(', 'function _markTrackerHeartbeat('), reconnect);
reconnect._reconcileMissionSceneOnTrackerReconnect({});
assert.equal(reconnect.missionSceneReconnectResyncPending, true);
reconnect._reconcileMissionSceneOnTrackerReconnect({ trackerMissionAuthority: { activeRun: { executionAuthority: 'tracker' } } });
assert.equal(reconnectClears, 0);
assert.equal(reconnect.missionSceneReconnectResyncPending, false);
reconnect.missionSceneReconnectResyncPending = true;
reconnect._reconcileMissionSceneOnTrackerReconnect({ trackerMissionAuthority: { activeRun: null } });
assert.equal(reconnectClears, 1, 'standalone cleanup still runs after authority is known');
console.log('PASS reconnect waits for authority; tracker scenes remain intact, standalone cleanup remains available.');

// Missing capabilities during reconnect must not select the legacy start path.
const startMode = {window:{simModeActive:false}, missionExecutionRequestedMissionId:null,
  _activeMissionRuntimeId:()=> 'm', _trackerSupportsMissionIntents:()=>true};
vm.createContext(startMode);
vm.runInContext(between(sync, 'function _missionStartUsesTrackerExecution(', 'async function _ensureTrackerExecutionAuthority('), startMode);
assert.equal(startMode._missionStartUsesTrackerExecution(),true);
startMode._trackerSupportsMissionIntents=()=>false;
assert.equal(startMode._missionStartUsesTrackerExecution(),true);
startMode._activeMissionRuntimeId=()=> 'other';
assert.equal(startMode._missionStartUsesTrackerExecution(),false);
startMode.window.simModeActive=true;
assert.equal(startMode._missionStartUsesTrackerExecution(),false);
console.log('PASS tracker start retains execution mode across a capability gap.');

// Background/previously scheduled snapshots cannot invalidate an in-flight handoff.
let snapshotTimer, snapshotBuilds = 0;
const snapshotContext = {
  window:{liveTrackerConnected:true,lastTrackerMissionAuthority:{activeRun:{runId:'r'}}},
  missionExecutionHandoffPromise:null, missionAuthoritySnapshotPushTimer:null,
  missionAuthorityLastSnapshotPushAt:0, Date, Math,
  _missionExecutionAuthorityIsTracker:()=>false,
  _trackerSupportsMissionAuthority:()=>true,
  _readMissionAuthorityState:()=>({missionId:'m',runId:'r',clientId:'c'}),
  _activeMissionRuntimeId:()=> 'm', _missionAuthorityClientId:()=> 'c',
  _missionAuthorityIncomingRunRelation:()=> 'same',
  _buildMissionAuthorityResumeBundle:()=>{snapshotBuilds++;return null;},
  setTimeout:fn=>{snapshotTimer=fn;return 1;},clearTimeout(){}
};
vm.createContext(snapshotContext);
vm.runInContext(between(sync,'function _queueMissionAuthoritySnapshot(', 'window.gaPushMissionAuthorityProfile ='),snapshotContext);
assert.equal(snapshotContext._queueMissionAuthoritySnapshot(),true);
snapshotContext.missionExecutionHandoffPromise=Promise.resolve();
snapshotTimer();assert.equal(snapshotBuilds,0);
assert.equal(snapshotContext._queueMissionAuthoritySnapshot('immediate',{immediate:true}),false);
snapshotContext.missionExecutionHandoffPromise=null;
snapshotContext._queueMissionAuthoritySnapshot('normal',{immediate:true});
assert.equal(snapshotBuilds,1,'normal standalone snapshots remain enabled outside handoff');
console.log('PASS handoff suppresses new and previously scheduled background snapshots.');

// Closing a completed tracker debrief is local UI cleanup, not a new abort/reset.
const cleanupCalls = [];
const debriefClosedControl = { executionAuthority: 'tracker', missionId: 'finished', runId: 'finished-run', phase: 'closed', flags: { closed: true } };
const cleanupContext = {
  window: { gaTrackerExecutionControl: debriefClosedControl, gaTrackerExecutionFinalizedRunId: 'finished-run',
    lastTrackerMissionAuthority: { activeRun: null },
    clearAppMissionState: options => { cleanupCalls.push(['clear', options]); return true; },
    missionRuntimeReset: () => { cleanupCalls.push(['remote-reset']); return true; } },
  _missionExecutionAuthorityIsTracker: () => !!cleanupContext.window.gaTrackerExecutionControl,
  _activeMissionRuntimeId: () => 'finished', _completionText: value => value,
  _clearMissionAuthorityState: () => cleanupCalls.push(['authority-local']),
  _resetMissionRuntime: () => cleanupCalls.push(['runtime-local']),
  localStorage: { removeItem: key => cleanupCalls.push(['storage', key]) },
  triggerCloudSave() {}, MISSION_DEBRIEF_PENDING_KEY: 'pending'
};
vm.createContext(cleanupContext);
vm.runInContext(between(sync, 'window.completeMissionCloseCleanup =', 'window.toggleManualMissionRuntime ='), cleanupContext);
assert.equal(cleanupContext.window.completeMissionCloseCleanup({ missionId: 'finished', dest: 'EDTO' }), true);
assert.equal(cleanupCalls.some(call => call[0] === 'remote-reset'), false);
assert.equal(cleanupCalls.find(call => call[0] === 'clear')[1].skipRuntimeReset, true);
assert.equal(cleanupContext.window.gaTrackerExecutionControl, null);
cleanupCalls.length = 0;
cleanupContext.window.gaTrackerExecutionControl = debriefClosedControl;
cleanupContext.window.lastTrackerMissionAuthority.activeRun = { missionId: 'new', runId: 'new-run' };
assert.equal(cleanupContext.window.completeMissionCloseCleanup({ missionId: 'finished' }), false);
assert.equal(cleanupCalls.length, 0, 'old debrief leaves the new tracker mission untouched');
cleanupContext.window.gaTrackerExecutionControl = { executionAuthority: 'tracker', missionId: 'new', phase: 'active' };
assert.equal(cleanupContext.window.completeMissionCloseCleanup({ missionId: 'finished' }), false);
assert.equal(cleanupCalls.length, 0);
cleanupContext.window.gaTrackerExecutionControl = null;
cleanupContext.window.lastTrackerMissionAuthority.activeRun = null;
assert.equal(cleanupContext.window.completeMissionCloseCleanup({ missionId: 'standalone' }), true);
assert.equal(cleanupCalls.some(call => call[0] === 'remote-reset'), true, 'standalone retains its existing reset path');
console.log('PASS tracker debrief closes locally; new missions protected; standalone cleanup unchanged.');

// The App negotiates batching; an older tracker still receives single-item intents.
for (const supported of [false, true]) {
  const sent = [];
  const run = { missionId: 'batch-mission', runId: 'batch-run', phase: 'boarding', revision: 1 };
  const context = {
    Promise, Date, setTimeout,
    missionExecutionIntentQueue: null,
    _publishMissionControlIntentStatus() {},
    _submitTrackerExecutionIntent: async (intent, payload) => {
      sent.push({ intent, payload, revision: run.revision });
      run.revision++;
      return { ok: true };
    },
    window: { GAMissionControlUiCore: controlUi, lastTrackerMissionAuthority: { activeRun: run },
      liveTrackerCapabilities: supported ? ['mission.cargo-batch.v1'] : [] }
  };
  vm.createContext(context);
  vm.runInContext(between(sync, 'window.gaTrackerExecutionSubmitIntent = function(', 'function _trackerExecutionAbortedRun('), context);
  const a = context.window.gaTrackerExecutionSubmitIntent('set_manifest_item', { itemId: 'a', action: 'load' });
  const b = context.window.gaTrackerExecutionSubmitIntent('set_manifest_item', { itemId: 'b', action: 'unload' });
  assert.deepEqual(context.window.gaTrackerQueuedItemIds, ['a', 'b']);
  await Promise.all([a, b]);
  assert.equal(sent.length, supported ? 1 : 2);
  if (supported) assert.equal(sent[0].payload.items.length, 2);
  else assert.deepEqual(sent.map(entry => entry.revision), [1, 2]);
}
