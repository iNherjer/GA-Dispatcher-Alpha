import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const syncSource = fs.readFileSync(new URL('../sync.js', import.meta.url), 'utf8');
const appSource = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

function functionSource(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} missing`);
  const paramsStart = source.indexOf('(', start);
  let paramsDepth = 0;
  let bodyStart = -1;
  for (let index = paramsStart; index < source.length; index += 1) {
    if (source[index] === '(') paramsDepth += 1;
    if (source[index] === ')') {
      paramsDepth -= 1;
      if (paramsDepth === 0) {
        bodyStart = source.indexOf('{', index);
        break;
      }
    }
  }
  assert.notEqual(bodyStart, -1, `${name} body missing`);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`${name} incomplete`);
}

const restoreGuardContext = {
  _normalizeMissionRuntimeId: value => String(value || '').trim().toLowerCase(),
  missionRuntimeResumeSuppressedFor: 'mission-a',
  missionRuntime: { active: false, closingPending: false }
};
vm.runInNewContext(
  functionSource(syncSource, '_missionAuthorityShouldSuppressFreshStartRestore'),
  restoreGuardContext
);
assert.equal(
  restoreGuardContext._missionAuthorityShouldSuppressFreshStartRestore('mission-a', {}),
  true,
  'ordinary local restore must remain blocked after an explicit fresh start'
);
assert.equal(
  restoreGuardContext._missionAuthorityShouldSuppressFreshStartRestore('mission-a', { authorityConfirmed: true }),
  false,
  'tracker-confirmed handoff must override the local fresh-start guard'
);
restoreGuardContext.missionRuntime.active = true;
assert.equal(
  restoreGuardContext._missionAuthorityShouldSuppressFreshStartRestore('mission-a', {}),
  false,
  'an already active runtime must not be suppressed'
);

const runtimeLogs = [];
const runtimeRestoreContext = {
  console,
  setTimeout,
  Date,
  _normalizeMissionRuntimeId: value => String(value || '').trim().toLowerCase(),
  _readMissionRuntimeSnapshot: () => null,
  _snapshotMatchesActiveMission: () => true,
  _missionRuntimeSnapshotMissionId: snapshot => snapshot.missionId,
  _missionPhaseDebugPush: (kind, payload) => runtimeLogs.push({ kind, payload }),
  _readPendingMissionDebrief: () => null,
  _restoreCargoManifestFromRuntimeSnapshot: () => false,
  _restoreFlightRecorderFromRuntimeSnapshot: () => false,
  _safeCloneJson: value => JSON.parse(JSON.stringify(value)),
  _missionCargoLoadedPassengerItems: () => [{ id: 'mission-passenger' }],
  _missionScenePaxCount: () => 1,
  _missionSceneId: () => 'scene-mission-a',
  _missionRuntimePhaseSnapshot: () => runtimeRestoreContext.currentStartPhase || 'planned',
  _setMissionStartPhase: (phase, options) => {
    assert.equal(options?.persist, false, 'handoff restore must not publish a partially restored runtime');
    runtimeRestoreContext.currentStartPhase = phase;
  },
  _persistMissionRuntimeSnapshot: () => true,
  _updateMissionRuntimeUi: () => {},
  _showMissionCompletionDebrief: () => {},
  missionRuntimeResumeSuppressedFor: 'mission-a',
  missionRuntimeResumeAppliedFor: '',
  missionInterruptedDeboardingRecovery: null,
  currentStartPhase: 'prepare',
  missionRuntime: {
    phase: 'prepare', active: false, armed: false, manual: false, closingPending: false,
    startedAt: 0, closingReason: '', waitingFarewellDeboarding: false,
    deboardingAfterFarewellStarted: false
  },
  window: {
    missionSceneStatus: {},
    liveTrackerConnected: true,
    missionComplianceResume: () => {}
  }
};
vm.runInNewContext(
  `${functionSource(syncSource, '_missionAuthorityShouldSuppressFreshStartRestore')}\n${functionSource(syncSource, '_restoreMissionRuntimeFromSnapshot')}`,
  runtimeRestoreContext
);
const trackerActiveSnapshot = {
  missionId: 'mission-a',
  savedAt: Date.now(),
  startedAt: Date.now() - 60000,
  startPhase: 'boarded',
  runtime: { missionId: 'mission-a', phase: 'active', active: true, startedAt: Date.now() - 60000 },
  sceneStatus: { boardingComplete: true, personBoarded: true }
};
assert.equal(
  runtimeRestoreContext._restoreMissionRuntimeFromSnapshot(trackerActiveSnapshot, {
    reason: 'tracker-authority-handoff', authorityConfirmed: true, trackerConfirmed: true, trackerActive: true
  }),
  true,
  'tracker-confirmed runtime snapshot must be applied'
);
assert.equal(runtimeRestoreContext.currentStartPhase, 'boarded');
assert.equal(runtimeRestoreContext.missionRuntime.phase, 'active');
assert.equal(runtimeRestoreContext.missionRuntime.active, true);
assert.equal(runtimeRestoreContext.missionRuntimeResumeSuppressedFor, '');
assert.equal(runtimeRestoreContext.window.missionSceneStatus.boardingComplete, true);
assert.equal(runtimeRestoreContext.window.missionSceneStatus.personBoarded, true);
assert.ok(runtimeLogs.some(entry => entry.kind === 'resume_fresh_start_guard_overridden'));
assert.ok(runtimeLogs.some(entry => entry.kind === 'resume_restore'));

const relationContext = {};
vm.runInNewContext(
  functionSource(syncSource, '_missionAuthorityIncomingRunRelation'),
  relationContext
);
const localRun = { missionId: 'mission-a', runId: 'run-a', revision: 7 };
assert.equal(
  relationContext._missionAuthorityIncomingRunRelation(null, {
    missionId: 'mission-a', runId: 'run-a', ownerClientId: 'legacy-client', revision: 2
  }, 'device-a'),
  'foreign',
  'a tracker run must remain readable before this browser has local authority state'
);
assert.equal(
  relationContext._missionAuthorityIncomingRunRelation(localRun, {
    missionId: 'mission-a', runId: 'run-a', ownerClientId: 'device-b', revision: 8
  }, 'device-a'),
  'demote'
);
assert.equal(
  relationContext._missionAuthorityIncomingRunRelation(localRun, {
    missionId: 'mission-a', runId: 'run-a', ownerClientId: 'device-b', revision: 6
  }, 'device-a'),
  'stale'
);
assert.equal(
  relationContext._missionAuthorityIncomingRunRelation(localRun, {
    missionId: 'mission-a', runId: 'run-a', ownerClientId: 'device-a', revision: 8
  }, 'device-a'),
  'owner'
);
assert.equal(
  relationContext._missionAuthorityIncomingRunRelation(localRun, {
    missionId: 'mission-a', runId: 'run-a', ownerClientId: 'device-a', revision: 6
  }, 'device-a'),
  'stale',
  'a delayed tracker projection must not roll the local acknowledged revision back'
);

const ackContext = { missionAuthorityLocalCommandIds: new Map([['local-command', { sentAt: Date.now() }]]) };
vm.runInNewContext(
  functionSource(syncSource, '_missionAuthorityAckWasSentLocally'),
  ackContext
);
assert.equal(ackContext._missionAuthorityAckWasSentLocally({ commandId: 'local-command' }), true);
assert.equal(ackContext._missionAuthorityAckWasSentLocally({ commandId: 'foreign-command' }), false);

const capabilityListeners = new Set();
let capabilityHeartbeatFresh = false;
const capabilityWaitContext = {
  Promise,
  setTimeout,
  clearTimeout,
  MISSION_AUTHORITY_CAPABILITY: 'mission.authority.v1',
  missionAuthorityCapabilityWaitPromise: null,
  _trackerHeartbeatIsFresh: () => capabilityHeartbeatFresh,
  window: {
    liveTrackerConnected: true,
    liveTrackerCapabilities: [],
    addEventListener: (type, listener) => {
      if (type === 'gatrackercapabilitieschange') capabilityListeners.add(listener);
    },
    removeEventListener: (type, listener) => {
      if (type === 'gatrackercapabilitieschange') capabilityListeners.delete(listener);
    }
  }
};
vm.runInNewContext(
  `${functionSource(syncSource, '_trackerSupportsMissionAuthority')}\n${functionSource(syncSource, '_waitForMissionAuthorityCapability')}`,
  capabilityWaitContext
);
const capabilityWait = capabilityWaitContext._waitForMissionAuthorityCapability(500);
capabilityWaitContext.window.liveTrackerCapabilities = ['mission.authority.v1'];
capabilityHeartbeatFresh = true;
for (const listener of [...capabilityListeners]) listener();
assert.equal(await capabilityWait, true, 'the pending start must continue when the capability heartbeat arrives');
assert.equal(capabilityListeners.size, 0, 'the temporary capability listener must be removed');
capabilityWaitContext.window.liveTrackerCapabilities = [];
assert.equal(
  await capabilityWaitContext._waitForMissionAuthorityCapability(500),
  false,
  'a fresh legacy heartbeat without mission authority must not be delayed'
);

const profileRefreshCalls = [];
const profileRefreshContext = {
  clearTimeout: () => {},
  setTimeout: callback => { callback(); return 1; },
  _buildMissionAuthorityMapProfile: () => null,
  _queueMissionAuthoritySnapshot: () => profileRefreshCalls.push('push'),
  window: {
    vpHardReloadRouteProfile: reason => {
      profileRefreshCalls.push(reason);
      return profileRefreshCalls.length >= 2;
    }
  }
};
vm.runInNewContext(
  `let missionAuthorityProfileRefreshTimer = null;\n${functionSource(syncSource, '_scheduleMissionAuthorityProfileRefresh')}`,
  profileRefreshContext
);
assert.equal(profileRefreshContext._scheduleMissionAuthorityProfileRefresh('handoff-test'), true);
assert.deepEqual(
  profileRefreshCalls,
  ['handoff-test', 'handoff-test'],
  'handoff profile refresh must retry until the restored route can start its terrain fetch'
);

const recoveryMission = { currentMissionData: { missionId: 'mission-a', mission: 'Testmission' } };
const persistedRecoveryRuntime = {
  version: 1,
  missionId: 'mission-a',
  startPhase: 'boarded',
  runtime: { missionId: 'mission-a', phase: 'active', active: true }
};
const recoveryContext = {
  Date,
  _normalizeMissionRuntimeId: value => String(value || '').trim().toLowerCase(),
  _missionAuthorityClientId: () => 'device-a',
  _syncActiveMissionPayload: () => recoveryMission,
  _syncMissionIdentityValues: state => [state?.currentMissionData?.missionId].filter(Boolean),
  _syncReadRuntimeSnapshot: () => persistedRecoveryRuntime,
  _buildMissionRuntimeSnapshot: () => ({
    version: 1,
    missionId: 'mission-a',
    startPhase: 'planned',
    runtime: { missionId: 'mission-a', phase: 'planned', active: false }
  }),
  _missionRuntimeSnapshotMissionId: snapshot => snapshot?.missionId || snapshot?.runtime?.missionId || '',
  _syncRuntimeSnapshotStarted: snapshot => !!snapshot?.runtime?.active,
  _syncCompactActiveMission: state => JSON.parse(JSON.stringify(state)),
  _missionAuthorityInjectLiveRoute: state => state,
  _missionAuthorityAdapter: () => 'apt',
  _missionAuthorityAttachExecutionShadow: bundle => bundle,
  _buildMissionAptExecutionEffectPlan: () => ({
    schema: 'ga.mission-execution-effect-plan.v1',
    recipe: 'apt',
    missionId: 'mission-a',
    effects: {}
  }),
  _buildMissionAuthorityMapProfile: () => null,
  _validateMissionAuthorityResumeBundle: bundle => ({
    ok: !!(bundle?.missionId && bundle?.missionState && bundle?.runtime)
  }),
  _syncMissionTitleForPrompt: () => 'Testmission',
  window: {
    GAMissionResumeAdapters: {
      createDescriptor: runtime => ({
        schema: 'ga.mission-resume.v2',
        version: 2,
        missionId: runtime.missionId,
        primaryAdapter: 'apt',
        facets: []
      })
    }
  }
};
vm.runInNewContext(
  functionSource(syncSource, '_buildMissionAuthorityLocalRecovery'),
  recoveryContext
);
const recoverableLegacy = recoveryContext._buildMissionAuthorityLocalRecovery({
  missionId: 'mission-a', runId: 'run-a', ownerClientId: 'legacy-client'
});
assert.equal(recoverableLegacy.ok, true);
assert.equal(recoverableLegacy.runtimeSource, 'persisted');
assert.equal(recoverableLegacy.bundle.runtime.startPhase, 'boarded');
assert.equal(recoverableLegacy.bundle.missionId, 'mission-a');
assert.equal(recoveryContext._buildMissionAuthorityLocalRecovery({
  missionId: 'mission-b', runId: 'run-b', ownerClientId: 'legacy-client'
}).error, 'local_mission_mismatch');
assert.equal(recoveryContext._buildMissionAuthorityLocalRecovery({
  missionId: 'mission-a', runId: 'run-a', ownerClientId: 'device-b'
}).error, 'tracker_owner_not_recoverable');

assert.match(
  appSource,
  /missionRuntimeRestoreFromSnapshot\(null,\s*\{[\s\S]*?authorityConfirmed,[\s\S]*?trackerConfirmed:/,
  'restoreMissionState must forward tracker authority to the runtime restore'
);
assert.match(
  syncSource,
  /foreign_tracker_ack_ignored/,
  'foreign mission ACKs must be ignored and diagnosed'
);
assert.match(
  syncSource,
  /authority_demoted_to_observer/,
  'the previous owner must be demoted to observer mode'
);
assert.match(
  syncSource,
  /catch \(authorityError\)[\s\S]*?Telemetrie laeuft weiter/,
  'authority projection failures must not discard otherwise valid GPS telemetry'
);
assert.match(
  syncSource,
  /_persistMissionRuntimeSnapshot\(\s*options\.reason \|\| 'set-runtime-phase',[\s\S]*?prev !== next \? \{ immediate: true \} : \{\}/,
  'semantic runtime phase changes must reach the tracker immediately'
);
assert.match(
  syncSource,
  /legacy-device-handoff-recovery-seed[\s\S]*?resumeBundle: bundle/,
  'an explicitly recovered legacy run must be seeded with a complete resume bundle'
);
assert.match(
  syncSource,
  /function _waitForMissionAuthorityCapability\([\s\S]*?addEventListener\('gatrackercapabilitieschange', handleCapabilities\)/,
  'mission start must wait briefly for the tracker capability heartbeat'
);
assert.match(
  syncSource,
  /window\.addEventListener\('gatrackercapabilitieschange',[\s\S]*?_attemptMissionAuthorityLateBind\('tracker-capability-late-bind'\)/,
  'a mission that started during the relay handshake must bind authority once capabilities arrive'
);
assert.match(
  syncSource,
  /_queueMissionAuthoritySnapshot\('tracker-authority-acquired-seed', \{ immediate: true \}\)/,
  'a resumed implicit run must immediately receive the complete replay bundle'
);
assert.match(
  syncSource,
  /\(_trackerSupportsMissionAuthority\(\) \|\| missionAuthorityLateBindPending\)[\s\S]*?trackerCommand\.clientId/,
  'commands sent while capability negotiation is pending must keep the browser owner identity'
);
assert.match(
  syncSource,
  /setTimeout\(async \(\) => \{[\s\S]*?_ensureMissionAuthorityForStart\('websocket-open-resume'\)[\s\S]*?_sendMissionLifecycleToTracker\(state, 'websocket-open-resume'\)/,
  'reconnect lifecycle must not create a legacy run before authority negotiation finishes'
);

console.log('mission-authority handoff selftest: ok');
