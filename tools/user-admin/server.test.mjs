import assert from 'node:assert/strict';
import { test } from 'node:test';
import { request as httpRequest } from 'node:http';
import { createAdminServer, enrichUser, listUsers, projectUser, purgeBugReports, updateUser, tailscaleAddresses } from './server.mjs';

const oldDate = Date.parse('2026-09-16T09:00:00Z');
const nowDate = Date.parse('2026-10-26T12:00:00Z');
const profile = { pin:'never-return-this', lastModified:oldDate, lastAppSeen:nowDate, profile:{ name:'Testpilot' } };

test('V2 commit replaces frozen legacy time without modifying app activity', async () => {
  const user = projectUser('TEST',profile);
  let called = 0;
  await enrichUser(user,profile,async (url, options) => {
    called++;
    assert.equal(url,'https://ga-proxy.einherjer.workers.dev/api/sync-v2/head?inlineMetadata=1');
    assert.equal(options.headers['X-Pilot-PIN'],profile.pin);
    assert.equal(options.method,undefined);
    return Response.json({revision:42, committedAt:nowDate});
  });
  assert.equal(called,1);
  assert.equal(user.modifiedSource,'v2');
  assert.equal(user.lastModified,new Date(nowDate).toISOString());
  assert.equal(user.lastAppSeen,new Date(nowDate).toISOString());
  assert.equal(profile.lastModified,oldDate);
  assert.ok(!JSON.stringify(user).includes(profile.pin));
});

test('unmigrated profiles retain explicit legacy date; errors never become legacy success', async () => {
  const user = projectUser('TEST',profile);
  await enrichUser(user,profile,async () => Response.json({revision:0,manifest:null}));
  assert.equal(user.modifiedSource,'legacy');
  assert.equal(user.lastModified,new Date(oldDate).toISOString());
  for (const response of [Response.json({revision:1}),Response.json({error:'denied'},{status:401}),Response.json({oops:true})]) {
    await assert.rejects(() => enrichUser(projectUser('TEST',profile),profile,async () => response));
  }
});

test('list reports progress, skips infrastructure, marks unavailable V2 metadata and sorts by recent activity', async () => {
  const events = [];
  const result = await listUsers(new URL('http://localhost/?limit=10'), event => events.push(event), {
    kvList:async () => ['homebase:TEST','AUDIO_SETTINGS_TEST','GROUP_TEST','OLD','TEST','BROKEN'].map(name => ({name})),
    kvGet:async id => id === 'BROKEN' ? '{' : JSON.stringify(id === 'OLD' ? {pin:'old', lastModified:oldDate} : profile),
    enrichUser:async user => { if (user.id === 'TEST') throw new Error('sensitive output'); return user; }
  });
  assert.equal(result.count,2);
  assert.equal(result.scanned,3);
  assert.equal(result.skipped,1);
  assert.equal(result.metadataErrors,1);
  assert.equal(result.items[0].id,'TEST');
  assert.equal(result.items[0].lastModified,'');
  assert.equal(result.items[0].modifiedSource,'unavailable');
  assert.ok(events.some(event => /Cloud-Speicherstand/.test(event.message)));
  assert.ok(!JSON.stringify(result).includes(profile.pin));
  assert.ok(!JSON.stringify(result).includes('sensitive'));
});

test('purge preview is read-only and zero days is respected', async () => {
  let deleted = 0;
  const deps = { kvList:async prefix => prefix === 'bug:report:' ? [{name:'bug:report:old'}] : [], kvGet:async () => JSON.stringify({id:'old',createdAt:Date.now()-1000}), kvDelete:async () => { deleted++; } };
  const preview = await purgeBugReports({olderThanDays:0}, () => {},deps);
  assert.equal(preview.olderThanDays,0);
  assert.equal(preview.matchedKeys,1);
  assert.equal(deleted,0);
  const result = await purgeBugReports({olderThanDays:0,dryRun:false}, () => {},deps);
  assert.equal(result.deleted,1);
  assert.equal(deleted,1);
});

test('only Tailscale IPv4 addresses are exposed', () => {
  assert.deepEqual(tailscaleAddresses({test:[{family:'IPv4',address:'192.168.1.2'},{family:'IPv4',address:'100.77.253.89'},{family:'IPv4',address:'100.128.0.1'},{family:'IPv6',address:'::1'}]}),['100.77.253.89']);
});

test('HTTP stream, safe static routes, origin guard, duplicate-operation guard and sanitized errors', async () => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const server = createAdminServer({port:0,deps:{kvList:async () => {await gate;return [{name:'TEST'}];},kvGet:async () => JSON.stringify(profile),enrichUser:async user => user}});
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    assert.equal((await fetch(base+'/server.mjs')).status,404);
    assert.equal((await fetch(base+'/',{headers:{'Sec-Fetch-Site':'cross-site'}})).status,200);
    assert.equal((await fetch(base+'/api/admin/info',{headers:{'Sec-Fetch-Site':'cross-site'}})).status,403);
    assert.equal((await fetch(base+'/api/admin/users',{headers:{Origin:'https://evil.test'}})).status,403);
    const forgedHostStatus = await new Promise((resolve,reject) => { const req = httpRequest(base+'/api/admin/info',{headers:{Host:'evil.test'}},res => {res.resume();resolve(res.statusCode);});req.on('error',reject);req.end(); });
    assert.equal(forgedHostStatus,403);
    assert.equal((await fetch(base+'/api/problem-reports/purge',{method:'POST',body:'{}'})).status,415);
    const stream = await fetch(base+'/api/admin/users?stream=1');
    assert.match(stream.headers.get('content-type'),/ndjson/);
    assert.equal((await fetch(base+'/api/admin/users')).status,409);
    release();
    const events = (await stream.text()).trim().split('\n').map(JSON.parse);
    assert.ok(events.some(event => event.type === 'progress'));
    assert.equal(events.at(-1).type,'result');
    assert.equal(events.at(-1).data.count,1);
    assert.ok(!JSON.stringify(events).includes(profile.pin));
    assert.equal((await fetch(base+'/api/admin/users')).status,200);
  } finally { release(); await new Promise(resolve => server.close(resolve)); }
  const failed = createAdminServer({port:0,deps:{kvList:async () => {throw new Error(profile.pin);}}});
  await new Promise(resolve => failed.listen(0,'127.0.0.1',resolve));
  try {
    const res = await fetch(`http://127.0.0.1:${failed.address().port}/api/admin/users?stream=1`);
    const body = await res.text();
    assert.ok(body.includes('"type":"error"'));
    assert.ok(!body.includes(profile.pin));
  } finally { await new Promise(resolve => failed.close(resolve)); }
});


test('usage summary scans all accounts even when the displayed list is limited', async () => {
  const result = await listUsers(new URL('http://localhost/?limit=1'), () => {}, {
    kvList:async () => ['A','B','C'].map(name => ({name})),
    kvGet:async () => JSON.stringify({pin:'test',lastAppSeen:Date.now()-1000}),
    enrichUser:async user => user
  });
  assert.equal(result.items.length,1);
  assert.equal(result.summary.total,3);
  assert.equal(result.summary.active24h,3);
  assert.equal(result.summary.active7d,3);
  assert.equal(result.summary.complete,true);
  assert.equal(result.truncated,true);
});

test('PIN update preserves profile identity, expiry, mission and activity, backs up first and never returns credentials', async () => {
  const source = {...profile,profileSyncNamespace:'immutable',registeredAt:'2026-01-01',activeMission:{id:'keep-me'}};
  let raw = JSON.stringify(source);
  const events = [];
  const deps = {
    kvList:async () => [{name:'TEST',expiration:1800000000}],
    kvGet:async () => raw,
    enrichUser:async user => user,
    backupUser:async (id,original,expiration) => { events.push('backup'); assert.equal(original,JSON.stringify(source)); assert.equal(expiration,1800000000); return 'backup-test'; },
    kvPut:async (id,next,expiration) => { events.push('put'); assert.equal(expiration,1800000000); raw=next; }
  };
  const listed = await listUsers(new URL('http://localhost'), () => {},deps);
  const result = await updateUser({id:'TEST',pin:'new-private-pin',expectedVersion:listed.items[0].editVersion}, () => {},deps);
  assert.deepEqual(events,['backup','put']);
  assert.deepEqual(JSON.parse(raw),{...source,pin:'new-private-pin'});
  assert.equal(result.changed,true);
  assert.equal(result.backupId,'backup-test');
  assert.ok(!JSON.stringify(result).includes('new-private-pin'));
  assert.ok(!JSON.stringify(result).includes(profile.pin));
  await assert.rejects(() => updateUser({id:'TEST',pin:'another-pin',expectedVersion:listed.items[0].editVersion}, () => {},deps),/seit dem Laden geändert/);
  assert.deepEqual(events,['backup','put']);
});

test('invalid, reserved, missing and concurrently changed accounts are never written', async () => {
  let writes=0, reads=0;
  const raw=JSON.stringify(profile);
  const deps={kvList:async () => [{name:'TEST'}],kvGet:async () => { reads++; return reads>2 ? raw+' ' : raw; },enrichUser:async user=>user,backupUser:async () => 'saved',kvPut:async () => {writes++;}};
  await assert.rejects(() => updateUser({id:'GROUP_TEST',pin:'1234'},()=>{},deps),/Pilot-ID/);
  await assert.rejects(() => updateUser({id:'TEST',pin:'x'},()=>{},deps),/4 bis 160/);
  await assert.rejects(() => updateUser({id:'MISSING',pin:'1234'},()=>{},deps),/nicht gefunden/);
  const listed=await listUsers(new URL('http://localhost'),()=>{},deps);
  await assert.rejects(() => updateUser({id:'TEST',pin:'1234',expectedVersion:listed.items[0].editVersion},()=>{},deps),/während der Vorbereitung geändert/);
  assert.equal(writes,0);
});

test('rename HTTP route requires JSON, streams preview/result and respects the origin guard',async()=>{
  const calls=[];
  const server=createAdminServer({port:0,deps:{renameAccount:async(payload,progress)=>{calls.push(payload);progress({message:'Preview in progress'});return {ok:true,dryRun:true,newId:'NEW',token:'fixture-token'};}}});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}`;
  try {
    const path=base+'/api/admin/users/rename?stream=1';
    assert.equal((await fetch(path,{method:'POST',body:'{}'})).status,415);
    assert.equal((await fetch(path,{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://other.test'},body:'{}'})).status,403);
    const response=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:'OLD',newId:'NEW',dryRun:true})});
    const events=(await response.text()).trim().split('\n').map(JSON.parse);
    assert.equal(events[0].type,'progress');assert.equal(events.at(-1).type,'result');assert.equal(events.at(-1).data.newId,'NEW');assert.equal(calls.length,1);
  }finally{await new Promise(resolve=>server.close(resolve));}
});
