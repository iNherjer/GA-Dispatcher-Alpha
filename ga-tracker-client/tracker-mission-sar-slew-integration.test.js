'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const execution=require('../mission-execution-core.js');
const {createMissionAuthorityManager}=require('./mission-authority-core.js');
const {createTrackerMissionExecutionRuntime}=require('./tracker-mission-execution-runtime.js');
const {missionId,bundle}=require('./tracker-mission-sar-fixture.js');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const completed=()=>({ok:true,status:'completed',sideEffect:false});

test('Tracker SAR normalizes all Slew aliases without blocking a live manual report',async t=>{
    for(const flags of [{slewActive:true},{slewMode:true},{isSlewActive:true},
        {slewActive:true,slewMode:true,isSlewActive:true,slewTelemetryStatus:'error'}]) {
        const directory=fs.mkdtempSync(path.join(os.tmpdir(),'sar-slew-'));
        t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
        const b=bundle();
        const manager=createMissionAuthorityManager({storageFile:path.join(directory,'authority.json'),
            executionAuthorityEnabled:true,poiExecutionEnabled:true,poiLifecycleRequired:true});
        const acquired=manager.acquire({missionId,clientId:'app',stateHash:'app',resumeBundle:b});
        const prepared=manager.prepareExecutionAuthority({missionId,runId:acquired.activeRun.runId,clientId:'app',
            expectedRevision:acquired.activeRun.revision,expectedStateHash:acquired.activeRun.stateHash,
            expectedExecutionStateHash:execution.replay(b.executionReplay).stateHash});
        assert.equal(prepared.ok,true,JSON.stringify(prepared));
        assert.equal(manager.commitExecutionAuthority({missionId,runId:prepared.activeRun.runId,clientId:'app',
            expectedRevision:prepared.activeRun.revision,expectedExecutionStateHash:prepared.activeRun.executionStateHash,
            handoffId:prepared.handoff.handoffId}).ok,true);
        const runtime=createTrackerMissionExecutionRuntime({enabled:true,authorityManager:manager,
            payloadSyncBeforeStart:completed,playBoardingVoice:completed,playFarewellVoice:completed});
        runtime.attachSimulator({getLivePosition:()=>({lat:48.3,lon:8.5,altFt:940,hdg:0}),
            dispatchCommand:completed,syncPayloadManifestState:completed,cleanupMission:completed});
        for(let n=0;n<8;n++)await tick();
        let serial=0;
        const intent=async(name,payload={})=>{
            const run=manager.getActiveRun();
            const result=await runtime.executeIntent({intent:name,payload,commandId:`sar-slew-${++serial}`,
                missionId,runId:run.runId,expectedRevision:run.revision});
            for(let n=0;n<12;n++)await tick();
            assert.equal(result.ok,true,JSON.stringify(result));
        };
        for(const [name,payload] of [['prepare_mission',{}],['start_boarding',{}],
            ['set_manifest_item',{itemId:'camera',action:'load'}],['sign_manifest',{}],['confirm_load',{}],['start_mission',{}]]) await intent(name,payload);
        const observed=runtime.observeTelemetry({observedAt:Date.now(),lat:48.3,lon:8.5,altFt:3000,aglFt:3000,
            gsKts:85,hdg:0,onGround:false,...flags});
        assert.equal(observed.ok,true,JSON.stringify(observed));
        for(let n=0;n<8;n++)await tick();
        assert.equal(runtime.flush().ok,true);
        assert.ok(manager.getExecutionSnapshot().view.allowedActions.includes('poi_report_found'));
        await intent('poi_report_found');
        const snapshot=manager.getExecutionSnapshot();
        assert.equal(snapshot.state.poiTask.detector.manualConfirmed,true,JSON.stringify(flags));
        assert.equal(snapshot.state.phase,'return_leg');
        assert.equal(snapshot.state.voice.poiMemory.sarSearchOutcome,'found');
    }
});
