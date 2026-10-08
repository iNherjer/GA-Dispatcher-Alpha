'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const repo = process.env.GA_CLOUD_TEST_REPO || path.resolve(__dirname, '..');
const { validateCloudMissionActivation } = require(path.join(repo, 'ga-tracker-client/tracker-mission-cloud.js'));
const source = fs.readFileSync(path.join(repo, 'ga-tracker-client/tracker.js'), 'utf8');
const activationSource = source.slice(source.indexOf('  let _cloudMissionReplacementCleanupInProgress'), source.indexOf('  cloudMissionReconciler = createCloudMissionReconciler({'));
function fixture({ authority = 'tracker', cleanupOk = true, active = true, seedChanged = false, sim = true } = {}) {
  let run = active ? { missionId: 'active', runId: 'old-run', revision: 4, acquiredAt: 100, ownerClientId: 'old-browser', executionAuthority: authority } : null;
  const candidate = { missionId: 'new-mission', updatedAt: 200, bundle: { execution: { stateHash: 'seed-hash' } } };
  const calls = [];
  const context = {
    TRACKER_APT_EXECUTION_ENABLED: true, CLOUD_MISSION_PENDING_RUN_ID: 'cloud-pending',
    cloudMissionReconciler: null, trackerVoiceService: { cancel: () => ({ cancelled: true }) },
    _cloudMissionActivationInProgress: false, _cloudMissionCandidate: candidate,
    _cloudMissionLastSuccessAt: 200, _cloudMissionLastAttemptAt: 200, _cloudMissionLastStatus: 'ready',
    validateCloudMissionActivation,
    refreshCloudMissionCandidate: async () => { calls.push('fetch'); if(seedChanged) context._cloudMissionCandidate = {...candidate,updatedAt:300}; },
    missionAuthorityManager: {
      getActiveRun: () => run,
      acquire: request => { calls.push('acquire');run={missionId:request.missionId,runId:'new-run',revision:1,resumeBundle:request.resumeBundle};return {ok:true}; },
      prepareExecutionAuthority: () => { calls.push('handoff-prepare');return {ok:true,handoff:{handoffId:'handoff',executionStateHash:'seed-hash'}}; },
      commitExecutionAuthority: () => { calls.push('handoff-commit');run.executionAuthority='tracker';return {ok:true}; },
      release: () => { calls.push('release');run=null;return {ok:true}; }
    },
    missionExecutionRuntime: { enabled:true, publicState:()=>({simulatorAttached:sim}),
      executeIntent:async request=>{
        calls.push(request.intent);
        if(request.intent==='abort_mission') {if(cleanupOk)run=null;return {ok:cleanupOk,error:cleanupOk?'':'cleanup_failed'};}
        return {ok:true,status:'ok',sideEffect:true};
      }
    },
    cleanupLegacyCloudRun:async request=>{calls.push('legacy-cleanup');assert.equal(request.allowLegacyCloudReplacement,true);return {ok:cleanupOk,error:cleanupOk?'':'cleanup_failed'};},
    trackerMissionShadow:{clear:()=>calls.push('shadow-clear'),observe:()=>calls.push('observe')},
    debugLog:()=>{}
  };
  vm.runInNewContext(activationSource+'\nthis.activate = activateCloudMission; this.activateInternal = activateCloudMissionInternal;',context);
  const request={commandId:'load-new',missionId:'new-mission',runId:'cloud-pending',expectedRevision:0,
    payload:{cloudUpdatedAt:200,...(active?{replaceRun:{confirmed:true,missionId:'active',runId:'old-run',revision:4}}:{})}};
  return {context,calls,request,run:()=>run};
}
for(const authority of ['tracker','web']) {
  test(`${authority} replacement cleans up before acquiring the new seed`,async()=>{
    const f=fixture({authority});const result=await f.context.activate(f.request);
    assert.equal(result.ok,true);assert.equal(f.run().missionId,'new-mission');
    assert.ok(f.calls.indexOf(authority==='tracker'?'abort_mission':'legacy-cleanup')<f.calls.indexOf('acquire'));
    assert.equal(f.calls.at(-1),'observe');
    assert.ok(!f.calls.includes('prepare_mission'));
    assert.equal(result.sideEffect,false);
  });
  test(`${authority} cleanup failure preserves the old run`,async()=>{
    const f=fixture({authority,cleanupOk:false});const result=await f.context.activate(f.request);
    assert.equal(result.ok,false);assert.equal(f.run().runId,'old-run');assert.ok(!f.calls.includes('acquire'));
  });
}
test('a changed cloud seed cannot release the confirmed run',async()=>{
  const f=fixture({seedChanged:true});const result=await f.context.activate(f.request);
  assert.equal(result.error,'cloud_mission_revision_conflict');assert.deepEqual(f.calls,['fetch']);
});
test('no connected simulator performs no cloud or cleanup operation',async()=>{
  const f=fixture({sim:false});assert.equal((await f.context.activate(f.request)).error,'mission_simulator_not_connected');assert.deepEqual(f.calls,[]);
});
test('idle cloud loading requires no browser owner and serializes duplicate activation',async()=>{
  const f=fixture({active:false});const first=f.context.activate(f.request);const second=await f.context.activate(f.request);
  assert.equal(second.error,'cloud_mission_activation_pending');assert.equal((await first).ok,true);
  assert.equal(f.calls.filter(value=>value==='acquire').length,1);
  assert.ok(!f.calls.includes('prepare_mission'));
});

test('SimConnect relay ACK receives its snapshot reader explicitly and preserves cloud offers', () => {
  const start = source.indexOf('      const sendMissionIntentAck =');
  const end = source.indexOf('      const homebaseManager =', start);
  const packets = [];
  const snapshot = { activeRun: { missionId: 'active', runId: 'old-run' }, pendingCloudMission: { missionId: 'training-cloud' } };
  const context = { getWs: () => ({ readyState: 1, send: value => packets.push(JSON.parse(value)) }),
    WebSocket: { OPEN: 1 }, syncId: 'test', pin: 'test', TRACKER_VERSION: 'v462', TRACKER_VERSION_CODE: 462,
    getCloudAuthoritySnapshot: () => snapshot, debugLog: () => {} };
  vm.runInNewContext(source.slice(start, end) + '\nthis.ack = sendMissionIntentAck;', context);
  assert.equal(context.ack({ commandId: 'activation', intent: 'activate_cloud_mission' }, { ok: false, error: 'cleanup_failed' }), true);
  assert.equal(packets[0].trackerAck.commandId, 'activation');
  assert.equal(packets[0].trackerAck.error, 'cleanup_failed');
  assert.deepEqual(packets[0].trackerMissionAuthority, snapshot);
  context.getCloudAuthoritySnapshot = null;
  context.missionAuthorityManager = { getPublicSnapshot: () => snapshot };
  assert.equal(context.ack({ commandId: 'legacy-client' }, { ok: true }), true);
});

const syncSource = fs.readFileSync(path.join(repo, 'sync.js'), 'utf8');
test('App failed cloud load never reopens confirmation on telemetry or a newer timestamp for the same mission', async () => {
  const start = syncSource.indexOf("let trackerCloudMissionOfferKey = '';");
  const end = syncSource.indexOf('function _handleTrackerMissionAuthoritySnapshot', start);
  const scheduled = [];
  let prompts = 0, submissions = 0;
  const context = { window: {}, _syncMissionRestoreBlocked: () => false, _syncActiveMissionPayload: () => null,
    _syncSetLocalMissionChoice: () => {},
    setTimeout: callback => scheduled.push(callback), confirm: () => { prompts++; return true; },
    _submitTrackerExecutionIntent: async () => { submissions++; return { ok: false, error: 'authority_timeout' }; } };
  vm.runInNewContext(syncSource.slice(start, end) + '\nthis.offer = _offerTrackerCloudMission;', context);
  const snapshot = { activeRun: { missionId: 'active', runId: 'legacy', revision: 4 },
    pendingCloudMission: { missionId: 'training', updatedAt: 200, control: { runId: 'cloud-pending' } } };
  context.offer(snapshot); await scheduled.shift()();
  context.offer(snapshot); context.offer({ ...snapshot, pendingCloudMission: { ...snapshot.pendingCloudMission, updatedAt: 300 } });
  assert.equal(prompts, 1); assert.equal(submissions, 1); assert.equal(scheduled.length, 0);
  vm.runInNewContext("trackerCloudMissionOfferKey = '';", context);
  context.offer(snapshot); await scheduled.shift()();
  assert.equal(prompts, 2, 'explicit banner retry remains available');
});

const hostSource = fs.readFileSync(path.join(repo, 'ga-tracker-client/tracker-efb-kartentisch-host.js'), 'utf8');
test('EFB keeps a cloud load banner even when the legacy run has no presentable mission', () => {
  const start = hostSource.indexOf('  function missionActionBannerModel(');
  const end = hostSource.indexOf('  function setupMissionActionBanner(', start);
  const context = {};
  vm.runInNewContext(hostSource.slice(start, end) + '\nthis.model = missionActionBannerModel;', context);
  const model = context.model({ available: false, authoritySnapshot: { pendingCloudMission: { missionId: 'training', title: 'POI Training' } } });
  assert.equal(model.kind, 'cloud-replacement');
  assert.equal(model.button, 'Neue Mission laden');
  assert.match(model.text, /POI Training/);
});

test('EFB failure keeps acknowledgement and permits only an explicit retry', async () => {
  const start = hostSource.indexOf("  var cloudMissionOfferKey = '';");
  const end = hostSource.indexOf('  function renderMissionPayload(', start);
  const scheduled = []; let prompts = 0;
  const context = { window: { setTimeout: callback => scheduled.push(callback), confirm: () => { prompts++; return true; },
    alert: () => {}, gaCockpitSessionClient: { submitIntent: async () => ({ ok: false }) } }, renderMissionActionBanner: () => {}, missionSnapshot: null };
  vm.runInNewContext(hostSource.slice(start, end) + '\nthis.offer = offerCloudMissionReplacement;', context);
  const snapshot = { authoritySnapshot: { activeRun: { runId: 'legacy', revision: 4 },
    pendingCloudMission: { missionId: 'training', updatedAt: 200, control: { runId: 'cloud-pending' } } } };
  context.offer(snapshot); scheduled.shift()();
  await new Promise(resolve => setImmediate(resolve));
  context.offer(snapshot); assert.equal(scheduled.length, 0); assert.equal(prompts, 1);
  context.offer(snapshot, true); scheduled.shift()(); await new Promise(resolve => setImmediate(resolve));
  assert.equal(prompts, 2);
});

test('idle cloud polling offers the mission without activating it', async () => {
  const start = source.indexOf('  let _cloudMissionSyncInProgress = false;');
  const end = source.indexOf('  let _cloudMissionReplacementCleanupInProgress', start);
  let activations = 0;
  const context = { TRACKER_APT_EXECUTION_ENABLED: true, TRACKER_POI_EXECUTION_ENABLED: true,
    syncId: 'test', pin: 'test', _cloudMissionCandidate: null, _cloudMissionActivationInProgress: false,
    fetchTrackerCloudMission: async () => ({ok:true,status:'ready',candidate:{missionId:'new',updatedAt:200}}),
    missionAuthorityManager: { getPublicSnapshot:()=>({}), getActiveRun:()=>null },
    missionExecutionRuntime: { publicState:()=>({simulatorAttached:true}) },
    activateCloudMission: async()=>{activations++;},
    broadcastMissionAuthorityUpdate:()=>{}, debugLog:()=>{} };
  vm.runInNewContext(source.slice(start,end)+'\nthis.refresh = refreshCloudMissionCandidate;',context);
  const offered = await context.refresh('interval');
  assert.equal(offered.missionId,'new');
  assert.equal(activations,0);
});


test('server-authorized automatic load commits planned authority while simulator is offline',async()=>{
  const f=fixture({active:false,sim:false});
  const candidate=f.context._cloudMissionCandidate;
  const result=await f.context.activateInternal(f.request,{candidate});
  assert.equal(result.ok,true);
  assert.equal(f.run().executionAuthority,'tracker');
  assert.deepEqual(f.calls,['acquire','handoff-prepare','handoff-commit','observe']);
  assert.ok(!f.calls.includes('prepare_mission'));
});
test('replacement cancels old queued Voice after confirmed runtime abort',async()=>{
  const f=fixture();f.run().effects=[{type:'voice.greeting',effectId:'greeting-old'},{type:'scene.prepare',effectId:'scene-old'}];
  const cancelled=[];f.context.trackerVoiceService.cancel=(id)=>cancelled.push(id);
  assert.equal((await f.context.activate(f.request)).ok,true);
  assert.deepEqual(cancelled,['greeting-old']);
});
