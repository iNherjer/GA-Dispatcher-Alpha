'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const repo = process.env.GA_CLOUD_TEST_REPO || path.resolve(__dirname, '..');
const { validateCloudMissionActivation } = require(path.join(repo, 'ga-tracker-client/tracker-mission-cloud.js'));
const source = fs.readFileSync(path.join(repo, 'ga-tracker-client/tracker.js'), 'utf8');
const activationSource = source.slice(source.indexOf('  let _cloudMissionReplacementCleanupInProgress'), source.indexOf('  let readCockpitPayload = null;'));
function fixture({ authority = 'tracker', cleanupOk = true, active = true, seedChanged = false, sim = true } = {}) {
  let run = active ? { missionId: 'active', runId: 'old-run', revision: 4, acquiredAt: 100, ownerClientId: 'old-browser', executionAuthority: authority } : null;
  const candidate = { missionId: 'new-mission', updatedAt: 200, bundle: { execution: { stateHash: 'seed-hash' } } };
  const calls = [];
  const context = {
    TRACKER_APT_EXECUTION_ENABLED: true, CLOUD_MISSION_PENDING_RUN_ID: 'cloud-pending',
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
    missionSmokeController:{cleanupExecutionRun:async request=>{calls.push('legacy-cleanup');assert.equal(request.allowLegacyCloudReplacement,true);return {ok:cleanupOk,error:cleanupOk?'':'cleanup_failed'};}},
    trackerMissionShadow:{clear:()=>calls.push('shadow-clear'),observe:()=>calls.push('observe')},
    debugLog:()=>{}
  };
  vm.runInNewContext(activationSource+'\nthis.activate = activateCloudMission;',context);
  const request={commandId:'load-new',missionId:'new-mission',runId:'cloud-pending',expectedRevision:0,
    payload:{cloudUpdatedAt:200,...(active?{replaceRun:{confirmed:true,missionId:'active',runId:'old-run',revision:4}}:{})}};
  return {context,calls,request,run:()=>run};
}
for(const authority of ['tracker','web']) {
  test(`${authority} replacement cleans up before acquiring the new seed`,async()=>{
    const f=fixture({authority});const result=await f.context.activate(f.request);
    assert.equal(result.ok,true);assert.equal(f.run().missionId,'new-mission');
    assert.ok(f.calls.indexOf(authority==='tracker'?'abort_mission':'legacy-cleanup')<f.calls.indexOf('acquire'));
    assert.equal(f.calls.at(-1),'prepare_mission');
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
});
