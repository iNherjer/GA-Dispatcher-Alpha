import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createRequire} from 'node:module';
import {createHmac} from 'node:crypto';
import worker from './worker-merged-full.js';
import {ProfileSync} from './profile-sync.mjs';
import {createAccountRenamer} from '../user-admin/account-rename.mjs';
const require=createRequire(import.meta.url),{create}=require('../../cloud-sync-client.js');
const version=raw=>createHmac('sha256','test').update(raw).digest('hex');
function fixture(namespace='') {
  const store=new Map(), objects=new Map(), backups=[];
  store.set('OLD',JSON.stringify({pin:'4321',syncId:'OLD',...(namespace?{profileSyncNamespace:namespace}:{}),registeredAt:'2026-01-01',lastAppSeen:123,lastModified:234}));
  store.set('OTHER',JSON.stringify({pin:'other-pin'}));
  store.set('homebase:OLD',JSON.stringify({revision:'base-1',crewShareEnabled:true,plan:{spawn:{lat:48,lon:8},hangar:{},objects:[]}}));
  store.set('AUDIO_SETTINGS_OLD',JSON.stringify({schema:'ga.audio-control.v1',revision:7,settings:{enabled:true}}));
  store.set('GROUP_TEST',JSON.stringify({members:[{syncId:'OLD',nick:'Original',lastSeen:Date.now(),isAdmin:true},{syncId:'OTHER',nick:'Other',lastSeen:Date.now()}],kicked:[],notes:[{author:'Original',text:'OLD is a historical description, keep it'}]}));
  store.set('checklist:community:owned',JSON.stringify({id:'owned',ownerId:'OLD',title:'Original',chapters:[{id:'one',title:'Chapter',items:[{id:'a',text:'Check'}]}],version:1}));
  const kv={get:async key=>store.get(key)||null,put:async(key,raw)=>{store.set(key,raw);},delete:async key=>{store.delete(key);},list:async({prefix='',limit=1000,cursor=''}={})=>{const keys=[...store.keys()].filter(key=>key.startsWith(prefix)).sort(),start=Number(cursor)||0,end=start+limit;return {keys:keys.slice(start,end).map(name=>({name})),list_complete:end>=keys.length,cursor:end<keys.length?String(end):''};}};
  function coordinator(identity) {
    if(objects.has(identity))return objects.get(identity);
    const records=new Map();let alarm=null;
    const storage={get:async key=>Array.isArray(key)?new Map(key.filter(k=>records.has(k)).map(k=>[k,structuredClone(records.get(k))])):structuredClone(records.get(key)),put:async(key,value)=>{if(typeof key==='object')Object.entries(key).forEach(([k,v])=>records.set(k,structuredClone(v)));else records.set(key,structuredClone(value));},list:async({prefix})=>new Map([...records].filter(([k])=>k.startsWith(prefix))),delete:async keys=>(Array.isArray(keys)?keys:[keys]).forEach(key=>records.delete(key)),getAlarm:async()=>alarm,setAlarm:async at=>{alarm=at;}};
    const object=new ProfileSync({storage,blockConcurrencyWhile:fn=>fn()});objects.set(identity,object);return object;
  }
  const env={GA_SYNC_KV:kv,GA_PROFILE_SYNC:{idFromName:name=>name,get:coordinator}};
  const call=async(path,options={})=>{const response=await worker.fetch(new Request('https://test'+path,options),env,{});return {status:response.status,body:await response.json()};};
  const headers=id=>({'Content-Type':'application/json','X-Pilot-ID':id,'X-Pilot-PIN':'4321'});
  const client=id=>create({pilotId:id,pin:'4321',baseUrl:'https://test/api/sync-v2/',request:(url,options)=>worker.fetch(new Request(url,options),env,{})});
  const rename=createAccountRenamer({list:async()=>[...store.keys()].map(name=>({name})),get:kv.get,put:kv.put,remove:kv.delete,backup:async data=>{backups.push(data);return 'fixture-backup';},version,capability:async()=>(await call('/api/admin/capabilities')).body.accountRename===1});
  const change=async(id,newId)=>{const plan=await rename({id,newId,expectedVersion:version(store.get(id))});return rename({dryRun:false,token:plan.token,confirmOffline:true});};
  return {store,objects,env,call,headers,client,change};
}

for(const namespace of ['', 'registration-namespace'])test(`renaming keeps the exact V2 object, mission control, homebase, audio and crew roles (${namespace||'legacy namespace'})`,async()=>{
  const f=fixture(namespace),source={activeMission:{missionId:'keep-mission',missionTruth:{text:'OLD remains historical text'}},activeMissionTrackerSeed:{missionId:'keep-mission',private:'original-seed'},pinboard:[{text:'do not rewrite OLD'}],logbook:[{id:'log-1'}],lastModified:Date.now()};
  await f.client('OLD').write(source,{missionChange:{action:'activate',operationId:'activate-original'}});
  const before=await f.client('OLD').read();
  const headBefore=(await f.call('/api/sync-v2/head?inlineMetadata=1',{headers:f.headers('OLD')})).body;
  await f.change('OLD','NEW');
  const registered=JSON.parse(f.store.get('NEW'));assert.equal(registered.registeredAt,'2026-01-01');assert.equal(registered.lastAppSeen,123);assert.equal(registered.profileSyncNamespace,namespace||undefined);
  for(const id of ['OLD','old']){
    assert.equal((await f.call('/api/auth/verify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pilotId:id,pin:'4321'})})).status,409);
    assert.equal((await f.call('/api/sync/'+id,{method:'POST',headers:f.headers(id),body:JSON.stringify({pin:'4321'})})).status,409);
    assert.equal((await f.call('/api/sync-v2/head?inlineMetadata=1',{headers:f.headers(id)})).status,409);
  }
  const login=await f.call('/api/auth/verify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pilotId:'new',pin:'4321'})});assert.equal(login.status,200);assert.equal(login.body.pilotId,'NEW');
  const after=await f.client('NEW').read();assert.deepEqual(after,before);
  assert.deepEqual((await f.call('/api/sync-v2/head?inlineMetadata=1',{headers:f.headers('NEW')})).body,headBefore);
  assert.equal(f.objects.size,1);
  assert.equal((await f.call('/api/homebase/NEW',{headers:f.headers('NEW')})).body.record.revision,'base-1');
  assert.equal((await f.call('/api/audio-settings/NEW',{headers:f.headers('NEW')})).body.record.revision,7);
  const group=await f.call('/api/sync/GROUP_TEST?syncId=NEW&pin=4321',{headers:f.headers('NEW')});assert.equal(group.status,200);assert.equal(group.body.members.find(member=>member.syncId==='NEW').isAdmin,true);assert.equal(group.body.notes[0].text,'OLD is a historical description, keep it');
  assert.equal((await f.call('/api/homebase-group/TEST',{headers:f.headers('NEW')})).status,200);
  const published=await f.call('/api/checklists/community',{method:'POST',headers:f.headers('NEW'),body:JSON.stringify({action:'publish',checklist:{id:'owned',title:'Updated',chapters:[{title:'Chapter',items:[{text:'Still mine'}]}]}})});assert.equal(published.status,200);
  assert.equal(JSON.parse(f.store.get('checklist:community:owned')).ownerId,'OLD');
  await f.change('NEW','FINAL');
  assert.equal(JSON.parse(f.store.get('OLD')).renamedTo,'FINAL');assert.equal(JSON.parse(f.store.get('NEW')).renamedTo,'FINAL');
  assert.deepEqual((await f.client('FINAL').read()).profile,before.profile);
  assert.equal((await f.call('/api/homebase/FINAL',{headers:f.headers('FINAL')})).status,200);
  assert.equal((await f.call('/api/homebase-group/TEST',{headers:f.headers('FINAL')})).status,200);
  assert.equal(f.objects.size,1);
  // Expiry/re-registration of the last visible ID must not inherit old links.
  f.store.set('FINAL',JSON.stringify({pin:'4321',profileSyncNamespace:'new-registration'}));
  assert.equal((await f.call('/api/homebase/FINAL',{headers:f.headers('FINAL')})).status,404);
  assert.equal((await f.call('/api/homebase-group/TEST',{headers:f.headers('FINAL')})).status,403);
  const denied=await f.call('/api/checklists/community',{method:'POST',headers:f.headers('FINAL'),body:JSON.stringify({action:'unpublish',id:'owned'})});assert.equal(denied.status,403);
  assert.equal((await f.client('FINAL').read()).migrated,false);
});

test('public registration cannot set an anchor, and an unconfirmed forged existing anchor cannot access storage',async()=>{
  const f=fixture();
  const registered=await f.call('/api/sync/ATTACKER',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pin:'4321',accountStorageId:'OLD',accountUid:'fake',accountStatus:'renaming',accountPreviousIds:['OLD']})});
  assert.equal(registered.status,200);
  const record=JSON.parse(f.store.get('ATTACKER'));for(const key of ['accountStorageId','accountUid','accountStatus','accountPreviousIds'])assert.equal(record[key],undefined);
  f.store.set('FORGED',JSON.stringify({pin:'4321',accountStorageId:'OLD',accountUid:'fake'}));
  assert.equal((await f.call('/api/homebase/FORGED',{headers:f.headers('FORGED')})).status,409);
  assert.equal((await f.call('/api/sync-v2/head?inlineMetadata=1',{headers:f.headers('FORGED')})).status,409);
  assert.equal(f.objects.size,0);
});

test('legacy writes preserve admin-owned identity and maintenance state rejects all authenticated access',async()=>{
  const f=fixture();delete f.env.GA_PROFILE_SYNC;
  await f.change('OLD','NEW');
  const old=JSON.parse(f.store.get('NEW'));
  const write=await f.call('/api/sync/NEW',{method:'POST',headers:f.headers('NEW'),body:JSON.stringify({pin:'4321',pinboard:[],accountStorageId:'OTHER',accountUid:'fake'})});
  assert.equal(write.status,200);assert.equal(JSON.parse(f.store.get('NEW')).accountStorageId,'OLD');assert.equal(JSON.parse(f.store.get('NEW')).accountUid,old.accountUid);
  f.store.set('NEW',JSON.stringify({...old,accountStatus:'renaming'}));
  assert.equal((await f.call('/api/homebase/NEW',{headers:f.headers('NEW')})).status,409);
  assert.equal((await f.call('/api/auth/verify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pilotId:'NEW',pin:'4321'})})).status,409);
});

test('crew saves persist the current ID/generation, and kicks follow a renamed account',async()=>{
  const f=fixture();await f.change('OLD','NEW');
  const group=(await f.call('/api/sync/GROUP_TEST?syncId=NEW&pin=4321',{headers:f.headers('NEW')})).body;
  const saved=await f.call('/api/sync/GROUP_TEST',{method:'POST',headers:f.headers('NEW'),body:JSON.stringify({...group,members:group.members.map(member=>member.syncId==='NEW'?{syncId:'NEW',nick:member.nick,isAdmin:true,lastSeen:Date.now()}:member)})});
  assert.equal(saved.status,200);
  const stored=JSON.parse(f.store.get('GROUP_TEST'));assert.equal(stored.members.find(member=>member.syncId==='NEW').accountUid,JSON.parse(f.store.get('NEW')).accountUid);
  f.store.set('GROUP_TEST',JSON.stringify({...stored,kicked:['OLD']}));
  const kicked=await f.call('/api/sync/GROUP_TEST?syncId=NEW&pin=4321',{headers:f.headers('NEW')});assert.deepEqual(kicked.body.kicked,['NEW']);
  assert.equal((await f.call('/api/homebase-group/TEST',{headers:f.headers('NEW')})).status,403);
  f.store.set('NEW',JSON.stringify({pin:'4321',profileSyncNamespace:'replacement'}));
  const after=await f.call('/api/sync/GROUP_TEST?syncId=NEW&pin=4321',{headers:f.headers('NEW')});assert.equal(after.body.members.some(member=>member.syncId==='NEW'),false);
});
