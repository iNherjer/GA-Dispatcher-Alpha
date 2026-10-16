'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createCloudMissionReconciler}=require('./tracker-cloud-mission-reconcile');
function result(revision=1,status='active',missionId='new',epoch='server-a') {
 const missionControl={schema:'ga.cloud-mission-control.v1',version:1,epoch,revision,status,missionId:status==='deleted'?null:missionId,updatedAt:1000+revision,missionHash:'a'.repeat(64)};
 return {ok:true,status:status==='deleted'?'cleared':'ready',missionControl,candidate:status==='deleted'?null:{missionId,missionControl,resumeBundle:{cloudMissionControl:missionControl}}};
}
function fixture(t) {
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ga-cloud-control-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const state={run:{missionId:'old',runId:'old-run',executionAuthority:'tracker'},latest:result(),calls:[],checkpointFail:false};
 const opts={filename:path.join(dir,'ack.json'),pilotId:'pilot',getRun:()=>state.run,readLatest:async()=>{state.calls.push('read');return state.latest;},abort:async()=>{state.calls.push('abort');state.run=null;return{ok:true};},clear:async()=>{state.calls.push('clear');return{ok:true};},load:async candidate=>{state.calls.push('load');state.run={missionId:candidate.missionId,executionAuthority:'tracker',state:'planned',resumeBundle:candidate.resumeBundle};return{ok:true};},checkpoint:async()=>{state.calls.push('checkpoint');if(state.checkpointFail)throw Error('disk');}};
 return{state,opts,agent:createCloudMissionReconciler(opts)};
}
test('new activation cleans old run and persists only a planned replacement',async t=>{const f=fixture(t);assert.equal((await f.agent.reconcile(f.state.latest)).status,'loaded');assert.equal(f.state.run.state,'planned');assert.deepEqual(f.state.calls,['read','abort','read','clear','load','checkpoint']);assert.equal(JSON.parse(fs.readFileSync(f.opts.filename)).control.revision,1);});
test('explicit deletion clears run and recovery without loading',async t=>{const f=fixture(t);f.state.latest=result(2,'deleted');assert.equal((await f.agent.reconcile(f.state.latest)).status,'cleared');assert.equal(f.state.run,null);assert.ok(!f.state.calls.includes('load'));});
test('profile progress or stale revisions never restart acknowledged mission',async t=>{const f=fixture(t);f.state.latest=result(3);await f.agent.reconcile(f.state.latest);f.state.calls=[];for(const r of [result(3),result(2)])assert.equal((await f.agent.reconcile(r)).status,'unchanged');assert.deepEqual(f.state.calls,[]);});
test('restart remembers consumed activation and does not resurrect manually aborted mission',async t=>{const f=fixture(t);await f.agent.reconcile(f.state.latest);f.state.run=null;f.state.calls=[];const restart=createCloudMissionReconciler(f.opts);assert.equal((await restart.reconcile(f.state.latest)).status,'unchanged');assert.equal(f.state.run,null);assert.deepEqual(f.state.calls,[]);});
test('missing, legacy, partial and malformed responses never abort',async t=>{const f=fixture(t);for(const r of [null,{ok:false},{ok:true,status:'empty'}, {...result(),candidate:null},{...result(),missionControl:{...result().missionControl,missionHash:'bad'}},{...result(1,'deleted'),status:'ready'}]){assert.equal((await f.agent.reconcile(r)).ok,false);}assert.deepEqual(f.state.calls,[]);assert.equal(f.state.run.missionId,'old');});
test('network failure retains old authority',async t=>{const f=fixture(t);f.opts.readLatest=async()=>{throw Error('offline');};f.agent=createCloudMissionReconciler(f.opts);assert.equal((await f.agent.reconcile(result())).status,'retry');assert.equal(f.state.run.missionId,'old');assert.equal(f.agent.applied(),null);});
test('changed cloud before cleanup keeps old mission',async t=>{const f=fixture(t);f.state.latest=result(2);assert.equal((await f.agent.reconcile(result(1))).status,'cloud_changed');assert.equal(f.state.run.missionId,'old');assert.ok(!f.state.calls.includes('abort'));});
test('cloud change during cleanup prevents stale loading',async t=>{const f=fixture(t);f.opts.abort=async()=>{f.state.run=null;f.state.latest=result(2);return{ok:true};};f.agent=createCloudMissionReconciler(f.opts);assert.equal((await f.agent.reconcile(result(1))).status,'cloud_changed');assert.ok(!f.state.calls.includes('load'));assert.equal(f.agent.applied(),null);assert.equal((await f.agent.reconcile(result(2))).status,'loaded');});
test('unacknowledged simulator cleanup cannot delete or replace old mission',async t=>{const f=fixture(t);f.opts.abort=async()=>({ok:false,error:'sim-unavailable'});f.agent=createCloudMissionReconciler(f.opts);assert.equal((await f.agent.reconcile(result())).status,'cleanup_pending');assert.equal(f.state.run.missionId,'old');assert.equal(f.agent.applied(),null);});
test('a concurrently acquired run blocks replacement',async t=>{const f=fixture(t);f.opts.abort=async()=>{f.state.run={missionId:'concurrent'};return{ok:true};};f.agent=createCloudMissionReconciler(f.opts);assert.equal((await f.agent.reconcile(result())).status,'run_changed');assert.ok(!f.state.calls.includes('load'));});
test('failed checkpoint retries recovery without repeating abort or load',async t=>{const f=fixture(t);f.state.checkpointFail=true;assert.equal((await f.agent.reconcile(result())).status,'retry');assert.equal(f.agent.applied(),null);f.state.checkpointFail=false;f.state.calls=[];assert.equal((await f.agent.reconcile(result())).status,'recovered');assert.deepEqual(f.state.calls,['checkpoint']);});
test('parallel polls cannot execute two transitions',async t=>{const f=fixture(t);let release;f.opts.readLatest=()=>new Promise(r=>{release=r;});f.agent=createCloudMissionReconciler(f.opts);const first=f.agent.reconcile(result());assert.equal((await f.agent.reconcile(result())).status,'pending');release(result(2));assert.equal((await first).status,'cloud_changed');assert.equal(f.agent.busy(),false);});
test('pilot mismatch never consumes another pilot acknowledgement',async t=>{const f=fixture(t);await f.agent.reconcile(result());const other=createCloudMissionReconciler({...f.opts,pilotId:'other'});assert.equal(other.applied(),null);});
test('a new server epoch may replace even a numerically lower revision',async t=>{const f=fixture(t);f.state.latest=result(9);await f.agent.reconcile(f.state.latest);f.state.latest=result(1,'deleted',null,'server-b');assert.equal((await f.agent.reconcile(f.state.latest)).status,'cleared');assert.equal(f.agent.applied().epoch,'server-b');});

test('explicit reset reloads the same acknowledged cloud mission once', async t => {
 const f=fixture(t); await f.agent.reconcile(f.state.latest);
 f.state.run=null; f.state.calls=[];
 await f.agent.requestReload();
 assert.equal(f.agent.applied(),null);
 assert.equal((await f.agent.reconcile(f.state.latest)).status,'loaded');
 assert.equal(f.state.run.state,'planned');
 assert.equal(f.state.calls.filter(call=>call==='load').length,1);
 assert.equal((await f.agent.reconcile(f.state.latest)).status,'unchanged');
});
test('offline reset survives restart and loads the current cloud slot', async t => {
 const f=fixture(t); await f.agent.reconcile(f.state.latest); f.state.run=null;
 await f.agent.requestReload();
 const restarted=createCloudMissionReconciler(f.opts);
 assert.equal((await restarted.reconcile({ok:false})).ok,false);
 f.state.latest=result(2,'active','replacement');
 assert.equal((await restarted.reconcile(f.state.latest)).status,'loaded');
 assert.equal(f.state.run.missionId,'replacement');
});
test('reset followed by cloud deletion never resurrects the former mission', async t => {
 const f=fixture(t); await f.agent.reconcile(f.state.latest); f.state.run=null;
 await f.agent.requestReload(); f.state.calls=[]; f.state.latest=result(2,'deleted');
 assert.equal((await f.agent.reconcile(f.state.latest)).status,'cleared');
 assert.equal(f.state.run,null); assert.ok(!f.state.calls.includes('load'));
});
test('failed reset checkpoint preserves the consumed activation', async t => {
 const f=fixture(t); await f.agent.reconcile(f.state.latest); f.state.run=null;
 f.state.checkpointFail=true;
 await assert.rejects(f.agent.requestReload(),/disk/);
 assert.equal(f.agent.applied().revision,1);
 assert.equal(createCloudMissionReconciler(f.opts).applied().revision,1);
});
test('acknowledged cloud selection replaces a different active local run',async t=>{
 const f=fixture(t);await f.agent.reconcile(f.state.latest);f.state.run={missionId:'stale-local',runId:'stale',executionAuthority:'tracker'};f.state.calls=[];
 assert.equal((await f.agent.reconcile(f.state.latest)).status,'loaded');assert.equal(f.state.run.missionId,'new');assert.ok(f.state.calls.includes('abort'));
});
test('acknowledged cloud deletion still cleans up an unexpected active local run',async t=>{
 const f=fixture(t);f.state.latest=result(3,'deleted');await f.agent.reconcile(f.state.latest);f.state.run={missionId:'old',runId:'old'};
 assert.equal((await f.agent.reconcile(f.state.latest)).status,'cleared');assert.equal(f.state.run,null);
});
function legacyResult(id='legacy') {return {ok:true,status:'ready',candidate:{missionId:id,updatedAt:1234,bundle:{execution:{stateHash:'hash'},executionReplay:{missionId:id}},resumeBundle:{}}};}
test('legacy cloud profile replaces older local run, persists consumption, and respects later cloud selection',async t=>{
 const f=fixture(t);f.state.latest=legacyResult();assert.equal((await f.agent.reconcileLegacy(f.state.latest)).status,'loaded');
 assert.equal(f.state.run.missionId,'legacy');f.state.run=null;
 const restarted=createCloudMissionReconciler(f.opts);assert.equal((await restarted.reconcileLegacy(f.state.latest)).status,'unchanged');
 f.state.latest=legacyResult('replacement');assert.equal((await restarted.reconcileLegacy(f.state.latest)).status,'loaded');assert.equal(f.state.run.missionId,'replacement');
});
test('legacy cloud rereads protect against replacement during simulator cleanup',async t=>{
 const f=fixture(t);f.state.latest=legacyResult();f.opts.abort=async()=>{f.state.run=null;f.state.latest=legacyResult('newer');return{ok:true};};f.agent=createCloudMissionReconciler(f.opts);
 assert.equal((await f.agent.reconcileLegacy(legacyResult())).status,'cloud_changed');assert.ok(!f.state.calls.includes('load'));
});
test('legacy profile cannot downgrade a server-controlled slot or infer deletion',async t=>{
 const f=fixture(t);await f.agent.reconcile(f.state.latest);f.state.calls=[];
 assert.equal((await f.agent.reconcileLegacy(legacyResult())).status,'unversioned');
 assert.equal((await f.agent.reconcileLegacy({ok:true,status:'empty',candidate:null})).status,'unversioned');assert.deepEqual(f.state.calls,[]);
});
test('incomplete legacy candidate never throws or cleans up an active run',async t=>{
 const f=fixture(t);const r=legacyResult();delete r.candidate.bundle.executionReplay;
 assert.equal((await f.agent.reconcileLegacy(r)).status,'unversioned');assert.deepEqual(f.state.calls,[]);
});
test('legacy same-mission scene-plan change during cleanup invalidates the selection',async t=>{
 const f=fixture(t);f.state.latest=legacyResult();f.state.latest.candidate.bundle.executionEffectPlan={scene:'first'};
 const first=structuredClone(f.state.latest);
 f.opts.abort=async()=>{f.state.run=null;f.state.latest.candidate.bundle.executionEffectPlan={scene:'changed'};return{ok:true};};
 f.agent=createCloudMissionReconciler(f.opts);
 assert.equal((await f.agent.reconcileLegacy(first)).status,'cloud_changed');assert.ok(!f.state.calls.includes('load'));
});
