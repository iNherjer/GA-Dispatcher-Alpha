'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { setTimeout: delay } = require('node:timers/promises');
const execution = require('../mission-execution-core.js');
const poi = require('./tracker-mission-poi-runtime.js');
const { createMissionAuthorityManager } = require('./mission-authority-core.js');
const { createTrackerMissionExecutionRuntime } = require('./tracker-mission-execution-runtime.js');
const { createTrackerMissionProcess } = require('./tracker-mission-process.js');
const { buildCloudMissionCandidate } = require('./tracker-mission-cloud.js');
const {missionId,bundle} = require('./tracker-mission-sar-fixture.js');

const tick = () => new Promise(resolve => setImmediate(resolve));
const completed = () => ({ ok: true, status: 'completed', sideEffect: false });

async function harness(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'training-integration-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const b = bundle();
  const manager = createMissionAuthorityManager({ storageFile: path.join(directory, 'authority.json'), executionAuthorityEnabled: true,
    poiExecutionEnabled: true, poiLifecycleRequired: true, idFactory: () => 'training-run' });
  const acquired = manager.acquire({ missionId, clientId: 'app', stateHash: 'app', resumeBundle: b });
  const prepared = manager.prepareExecutionAuthority({ missionId, runId: acquired.activeRun.runId, clientId: 'app',
    expectedRevision: acquired.activeRun.revision, expectedStateHash: acquired.activeRun.stateHash,
    expectedExecutionStateHash: execution.replay(b.executionReplay).stateHash });
  assert.equal(prepared.ok, true, JSON.stringify(prepared));
  assert.equal(manager.commitExecutionAuthority({ missionId, runId: prepared.activeRun.runId, clientId: 'app',
    expectedRevision: prepared.activeRun.revision, expectedExecutionStateHash: prepared.activeRun.executionStateHash,
    handoffId: prepared.handoff.handoffId }).ok, true);
  const commands = [];
  const runtime = createTrackerMissionExecutionRuntime({ enabled: true, authorityManager: manager,
    payloadSyncBeforeStart: completed, playBoardingVoice: completed, playFarewellVoice: completed });
  runtime.attachSimulator({ getLivePosition: () => ({ lat: 48.3, lon: 8.5, altFt: 940, hdg: 0 }),
    dispatchCommand: command => { commands.push(command); return completed(); }, syncPayloadManifestState: completed, cleanupMission: completed });
  await tick();
  let serial = 0;
  async function intent(name, payload = {}, fixedCommandId = '', options = {}) {
    const run = manager.getActiveRun();
    const result = await runtime.executeIntent({ intent: name, payload, commandId: fixedCommandId || `training-${++serial}`,
      missionId: run.missionId, runId: run.runId, expectedRevision: options.expectedRevision ?? run.revision });
    for (let i = 0; i < 8; i++) await tick();
    return result;
  }
  async function sample(patch = {}) {
    const result = runtime.observeTelemetry({ observedAt: Date.now(), lat: 48.3, lon: 8.5, altFt: 3000, aglFt: 3000,
      gsKts: 85, hdg: 0, onGround: false, ...patch });
    assert.equal(result.ok, true, JSON.stringify(result));
    for (let i = 0; i < 5; i++) await tick();
    await runtime.flush();
  }
  return { b, manager, runtime, commands, intent, sample, directory };
}

async function start(h) {
  assert.equal((await h.intent('prepare_mission')).ok, true);
  assert.equal((await h.intent('start_boarding')).ok, true);
  assert.equal((await h.intent('start_mission')).ok, false, 'real cargo gate remains active');
  assert.equal((await h.intent('set_manifest_item', { itemId: 'camera', action: 'load' })).ok, true);
  assert.equal((await h.intent('sign_manifest')).ok, true);
  assert.equal((await h.intent('confirm_load')).ok, true);
  assert.equal((await h.intent('start_mission')).ok, true);
}


test('SAR fixed-wing cloud gate opens only with original report geometry; heli stays closed',()=>{
 const b=bundle();assert.equal(poi.validateBundle(b),null);
 const profile={activeMission:b.missionState,activeMissionTrackerSeed:{schema:'ga.tracker-cloud-mission-seed.v1',version:1,missionId,adapter:'poi',executionPoiRecipe:b.executionPoiRecipe,executionEffectPlan:b.executionEffectPlan}};
 assert.equal(buildCloudMissionCandidate(profile,{poiExecutionEnabled:true}).status,'ready');
 const heli=structuredClone(b);heli.executionPoiRecipe.sarHeli={};assert.ok(poi.validateBundle(heli));
 delete b.executionPoiRecipe.sarReport;assert.ok(poi.validateBundle(b));
});

test('SAR manual report commits success, narrative and return leg atomically; stale/duplicate actions cannot overwrite it',async t=>{
 const h=await harness(t);await start(h);
 await h.sample();
 let snap=h.manager.getExecutionSnapshot();
 assert.ok(snap.view.allowedActions.includes('poi_report_found'));
 const revision=h.manager.getActiveRun().revision;
 const result=await h.intent('poi_report_found');assert.equal(result.ok,true,JSON.stringify(result));
 snap=h.manager.getExecutionSnapshot();
 assert.equal(snap.state.poiTask.detector.manualConfirmed,true);
 assert.equal(snap.state.poiTask.detector.dwellSec,120);
 assert.equal(snap.state.phase,'return_leg');assert.equal(snap.state.voice.poiMemory.sarSearchOutcome,'found');
 assert.ok(snap.state.effects.some(e=>e.payload.action==='poi_report_found'));
 assert.equal((await h.intent('poi_report_found',{},'stale',{expectedRevision:revision})).error,'mission_revision_conflict');
 assert.equal((await h.intent('poi_report_found')).ok,false);
 assert.deepEqual(execution.normalizeState(JSON.parse(JSON.stringify(snap.state))).voice.poiMemory,snap.state.voice.poiMemory);
});

test('SAR far report gives feedback without success, and paused telemetry cannot confirm',async t=>{
 const h=await harness(t);await start(h);
 await h.sample({lat:48.31,lon:8.52});
 const before=h.manager.getExecutionSnapshot().state.poiTask.detector;
 const result=await h.intent('poi_report_found');assert.equal(result.ok,true,JSON.stringify(result));
 let snap=h.manager.getExecutionSnapshot();assert.deepEqual(snap.state.poiTask.detector,before);
 assert.ok(snap.state.effects.some(e=>e.payload.action==='poi_report_found' && e.payload.label==='Weiter suchen'));
 await h.sample({simPaused:true});
 assert.equal((await h.intent('poi_report_found')).ok,false);
});

test('SAR automatic search retains shared strict altitude, dwell and missing cargo decisions',()=>{
 const recipe=bundle().executionPoiRecipe;
 const sample=(at,alt=3000)=>({observedAt:at,lat:48.3,lon:8.5,altFt:alt,hdg:0,gsKts:90,onGround:false});
 let result=poi.observe(recipe,null,sample(1000),{active:true,trackingActive:true});
 assert.equal(result.state.detector.satisfied,false);
 for(let at=6000;at<=66000;at+=5000) result=poi.observe(recipe,result.state,sample(at),{active:true,trackingActive:true});
 assert.equal(result.state.detector.satisfied,true);
 const missing=poi.observe(recipe,null,sample(1000),{active:true,trackingActive:true,taskItemState:{blockingItems:['Kamera'],reason:'missing'}});
 assert.equal(missing.state.detector.aborted,true);
 const high=poi.observe(recipe,null,sample(1000,3400),{active:true,trackingActive:true});
 assert.equal(high.state.detector.dwellSec,0);
});

async function until(predicate) {
  for (let index = 0; index < 300; index++) { if (predicate()) return; await delay(10); }
  assert.fail('condition did not become true');
}

test('SAR telemetry and manual report run in the real mission child process', async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'training-process-'));
  const host = await createTrackerMissionProcess({ enabled: true, pilotId: 'test', flightLogDirectory: directory,
    authority: { storageFile: path.join(directory, 'authority.json'), executionAuthorityEnabled: true, poiExecutionEnabled: true },
    playBoardingVoice: completed, playFarewellVoice: completed });
  t.after(async () => { await host.close(); fs.rmSync(directory, { recursive: true, force: true }); });
  assert.notEqual(host.runtime.publicState().processId, process.pid);
  const value = bundle();
  const acquired = await host.authorityManager.acquire({ missionId, clientId: 'owner', stateHash: 'web', resumeBundle: value });
  let run = acquired.activeRun;
  const prepared = await host.authorityManager.prepareExecutionAuthority({ missionId, runId: run.runId, clientId: 'owner',
    expectedRevision: run.revision, expectedStateHash: run.stateHash, expectedExecutionStateHash: execution.replay(value.executionReplay).stateHash });
  assert.equal(prepared.ok, true, JSON.stringify(prepared));
  const committed = await host.authorityManager.commitExecutionAuthority({ missionId, runId: run.runId, clientId: 'owner',
    expectedRevision: prepared.activeRun.revision, expectedExecutionStateHash: prepared.activeRun.executionStateHash,
    handoffId: prepared.handoff.handoffId });
  assert.equal(committed.ok, true, JSON.stringify(committed));
  host.runtime.attachSimulator({ getLivePosition: () => ({ lat: 48.3, lon: 8.5, altFt: 3000, hdg: 0 }),
    dispatchCommand: () => completed(), syncPayloadBeforeStart: completed, syncPayloadManifestState: completed });
  await until(() => host.runtime.publicState().simulatorAttached);
  for (const [intent, payload] of [['prepare_mission', {}], ['start_boarding', {}], ['set_manifest_item', { itemId: 'camera', action: 'load' }],
    ['sign_manifest', {}], ['confirm_load', {}], ['start_mission', {}]]) {
    run = host.authorityManager.getActiveRun();
    const result = await host.runtime.executeIntent({ intent, payload, commandId: `training-process-${intent}`,
      missionId: run.missionId, runId: run.runId, expectedRevision: run.revision });
    assert.equal(result.ok, true, JSON.stringify(result));
    if (intent === 'set_manifest_item') {
      await until(() => host.authorityManager.getActiveRun()?.lastReason === 'effect:scene.cargo_item_transition:completed');
    }
    await until(() => host.runtime.publicState().effects.pendingEffects.length === 0);
  }
  await until(() => host.authorityManager.getExecutionSnapshot().state.flags.active);
  const telemetry = async observedAt => {
    host.runtime.observeTelemetry({ observedAt, lat: 48.3, lon: 8.5, altFt: 3000, aglFt: 3000, gsKts: 85, hdg: 0, bankDeg: 0,
      vsFpm: 0, onGround: false });
    await until(() => !host.runtime.publicState().telemetry.inFlight && !host.runtime.publicState().telemetry.pending);
    await host.runtime.flush();
  };
  const base = Date.now();
  await telemetry(base);
  let snapshot = host.authorityManager.getExecutionSnapshot();
  assert.ok(snapshot.view.allowedActions.includes('poi_report_found'));
  run = host.authorityManager.getActiveRun();
  const report = await host.runtime.executeIntent({intent:'poi_report_found',commandId:'sar-worker-report',
    missionId:run.missionId,runId:run.runId,expectedRevision:run.revision});
  assert.equal(report.ok,true,JSON.stringify(report));
  snapshot=host.authorityManager.getExecutionSnapshot();
  assert.equal(snapshot.state.poiTask.detector.manualConfirmed,true);
  assert.equal(snapshot.state.voice.poiMemory.sarSearchOutcome,'found');
  assert.equal(snapshot.state.phase,'return_leg');
});

test('App seed preserves original SAR confirm anchor/range and target scene without enabling helicopter',async()=>{
 const fs=require('node:fs'),vm=require('node:vm');
 const {extractOriginalFunction}=await import('../tools/extract-original-function.mjs');
 const source=fs.readFileSync(path.join(__dirname,'../passenger-voice.js'),'utf8');
 const seedFn=extractOriginalFunction(fs.readFileSync(path.join(__dirname,'../sync.js'),'utf8'),'_buildMissionPoiExecutionSeed');
 const r=bundle().executionPoiRecipe;
 const sandbox={currentMissionData:{missionTruth:{mainTarget:{lat:48.301,lon:8.501,name:'Fundanker'},sceneAnchor:{lat:49,lon:9}}},
 window:{activePassenger:r.passenger,paxVoiceBuildPoiAuthorityContext:()=>r.voiceContext,paxVoiceGetPoiMissionProgress:()=>({trackingActive:true})},
 _getDestCoords:()=>r.target,_activeMissionRuntimeId:()=>r.missionId,_targetPointForMission:()=>r.target,_missionHomePointForRuntime:()=>r.home,
 _safeCloneJson:value=>JSON.parse(JSON.stringify(value)),_buildMissionAptExecutionEffectPlan:()=>({effects:{}}),_missionTargetSceneKind:()=> 'sar_land',_missionTargetSceneItems:()=>[{id:'person',objectTitle:'Tarmac_Male'}],_missionTargetScenePoint:()=>({lat:48.301,lon:8.501,altFt:500,hdg:0}),_missionTargetSceneId:()=> 'sar-target'};
 vm.createContext(sandbox);
 vm.runInContext(extractOriginalFunction(source,'_activePoiConfirmCoords')+'\n'+extractOriginalFunction(source,'_poiManualConfirmRangeNm'),sandbox);
 r.voiceContext.sarReport={schema:'ga.sar-report.v1',confirmCoords:sandbox._activePoiConfirmCoords(),confirmRangeNm:sandbox._poiManualConfirmRangeNm()};
 vm.runInContext(seedFn,sandbox);const seed=sandbox._buildMissionPoiExecutionSeed();
 assert.equal(poi.validateRecipe(seed.executionPoiRecipe),null);
 assert.equal(seed.executionPoiRecipe.sarReport.confirmCoords.name,'Fundanker');
 assert.equal(seed.executionPoiRecipe.sarReport.confirmCoords.lat,48.301);
 assert.equal(seed.executionPoiRecipe.sarReport.confirmRangeNm,0.8);
 assert.equal(seed.executionEffectPlan.effects['scene.target'].command.targetSceneKind,'sar_land');
 assert.equal(seed.executionEffectPlan.effects['scene.target'].command.lat,48.301);
 sandbox.currentMissionData.sarHeli={};assert.equal(sandbox._buildMissionPoiExecutionSeed(),null);
});
