import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createHmac} from 'node:crypto';
import {createAccountRenamer,retiredSchema} from './account-rename.mjs';
const version=raw=>createHmac('sha256','test-secret').update(raw).digest('hex');
const original=JSON.stringify({pin:'private-pin',syncId:'OLD',registeredAt:'2026-01-01',profileSyncNamespace:'keep-namespace',lastAppSeen:123,activeMission:{id:'keep-mission'}});
function fixture(options={}) {
  const store=new Map([['OLD',original]]), writes=[], backups=[];
  let now=1000000, calls=0;
  const list=async()=>[...store.keys()].map(name=>({name,...(name==='OLD'||name==='NEW'?{expiration:1800000000}:{})}));
  const rename=createAccountRenamer({list,get:async id=>store.get(id)||null,
    put:async(id,raw)=>{calls++;writes.push(id);if(options.failAt===calls)throw Error('private-error');store.set(id,raw);},
    remove:async id=>store.delete(id),backup:async data=>{backups.push(structuredClone(data));return 'backup-id';},
    version,capability:async()=>options.capability!==false,now:()=>now});
  const preview=(newId='NEW')=>rename({id:'OLD',newId,expectedVersion:version(store.get('OLD'))});
  return {store,writes,backups,rename,preview,advance:()=>{now+=300001;}};
}

test('preview is read-only; apply preserves all payload and identity fields and reserves the retired ID permanently',async()=>{
  const f=fixture(),plan=await f.preview('new');
  assert.equal(plan.newId,'NEW');assert.equal(plan.pinUnchanged,true);
  assert.equal(f.writes.length,0);assert.equal(f.backups.length,0);
  assert.ok(!JSON.stringify(plan).includes('private-pin'));
  const result=await f.rename({dryRun:false,token:plan.token,confirmOffline:true});
  const active=JSON.parse(f.store.get('NEW')),retired=JSON.parse(f.store.get('OLD'));
  for(const [key,value] of Object.entries(JSON.parse(original)))assert.deepEqual(active[key],key==='syncId'?'NEW':value);
  assert.equal(active.accountStorageId,'OLD');assert.equal(active.accountUid,retired.accountUid);
  assert.equal(retired.schema,retiredSchema);assert.equal(retired.pin,undefined);
  assert.equal(result.backupId,'backup-id');assert.ok(!JSON.stringify(result).includes('private-pin'));
  assert.equal(f.backups[0].originals[0].raw,original);assert.equal(f.backups[0].originals[0].expiration,1800000000);
  await assert.rejects(()=>f.rename({dryRun:false,token:plan.token,confirmOffline:true}),/abgelaufen/);
});

test('invalid IDs, case-insensitive collisions, unavailable worker, stale previews and missing maintenance confirmation never write',async()=>{
  const f=fixture();
  for(const id of ['a','GROUP_TEAM','CHKTEST','homebase:x','a b','OLD'])await assert.rejects(()=>f.preview(id));
  f.store.set('nEw','occupied');await assert.rejects(()=>f.preview(),/belegt/);f.store.delete('nEw');
  const blocked=fixture({capability:false});await assert.rejects(()=>blocked.preview(),/Cloud-Worker/);assert.equal(blocked.writes.length,0);
  const plan=await f.preview();await assert.rejects(()=>f.rename({dryRun:false,token:plan.token}),/geschlossen/);
  f.store.set('OLD',original+' ');await assert.rejects(()=>f.rename({dryRun:false,token:plan.token,confirmOffline:true}),/geändert/);
  f.store.set('OLD',original);f.advance();await assert.rejects(()=>f.rename({dryRun:false,token:plan.token,confirmOffline:true}),/abgelaufen/);
  assert.equal(f.writes.length,0);
});

test('failures at every write step restore the original account and release the temporary target',async()=>{
  for(const failAt of [1,2,3,4]){
    const f=fixture({failAt}),plan=await f.preview();
    await assert.rejects(()=>f.rename({dryRun:false,token:plan.token,confirmOffline:true}),/Sicherung: backup-id/);
    assert.equal(f.store.get('OLD'),original);assert.equal(f.store.has('NEW'),false);assert.equal(f.backups.length,1);
  }
});

test('target claimed after preview is not overwritten and changed historical tombstones are protected',async()=>{
  const f=fixture(),plan=await f.preview();f.store.set('New','another-account');
  await assert.rejects(()=>f.rename({dryRun:false,token:plan.token,confirmOffline:true}),/belegt/);
  assert.equal(f.writes.length,0);assert.equal(f.store.get('New'),'another-account');
  const f2=fixture();f2.store.set('OLD',JSON.stringify({...JSON.parse(original),accountUid:'u',accountStorageId:'FIRST',accountPreviousIds:['FIRST']}));f2.store.set('FIRST',JSON.stringify({schema:retiredSchema,accountUid:'other',renamedTo:'OLD'}));
  await assert.rejects(()=>f2.preview(),/gehört nicht mehr/);assert.equal(f2.writes.length,0);
});
