'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs/promises'), os = require('node:os'), path = require('node:path');
const {createNavigationData} = require('./tracker-navigation-data');
const {createNavigationCache} = require('./tracker-navigation-cache');
const {createProfileData} = require('./tracker-profile-data');
async function folder(t) { const d=await fs.mkdtemp(path.join(os.tmpdir(),'ga-navpoints-'));t.after(()=>fs.rm(d,{recursive:true,force:true}));return d; }
const bounds={south:48.3,north:48.6,west:7.7,east:8};
const points=[{lat:48.3,lon:7.7,distNM:0},{lat:48.6,lon:8,distNM:0}];
function source() {
  let version='one', offline=false; const calls=[];
  const fetchRemote=async (url,init)=>{
    calls.push({url,headers:init.headers});if(offline)throw Error('offline');
    let value;
    if(url.endsWith('latest.json'))value={datasetVersion:version,manifest:`cycles/${version}/manifest.json`};
    else if(url.endsWith('manifest.json'))value={datasetVersion:version,source:{name:'OpenAIP'},collections:Object.fromEntries(['airports','navaids','reportingPoints'].map(collection=>[collection,{packs:[{url:collection+'.json',bbox:[7,48,9,49]}]}]))};
    else if(url.includes('/cycles/')){
      const collection=path.basename(url,'.json');
      value={collection,items:collection==='airports'?[{icao:'EDTL',name:'Lahr '+version,lat:48.4,lon:7.8,frequencies:[{value:'125.180'}]}]:collection==='navaids'?[{id:'vor',identifier:'LHR',name:'Funkfeuer '+version,lat:48.41,lon:7.81}]:[{name:'Süd',lat:48.42,lon:7.82,airport:{icao:'EDTL'}}]};
    } else if(url.endsWith('/airports.json'))value={EDTL:{icao:'EDTL',name:'fallback',lat:48.4,lon:7.8},EDTO:{icao:'EDTO',name:'Offenburg',lat:48.45,lon:7.92}};
    else if(url.endsWith('openaip-navaids.json'))value={navaids:[{id:'vor',name:'static',frequency:{value:'110.50'},lat:48.41,lon:7.81}]};
    else if(url.endsWith('openaip-reporting-points.json'))value={points:[{name:'Fallback Süd',airportIcao:'EDTL',lat:48.42,lon:7.82}]};
    else throw Error('unexpected '+url);
    return new Response(JSON.stringify(value),{headers:{ETag:'"'+version+'"'}});
  };
  return {fetchRemote,calls,version:v=>version=v,offline:()=>offline=true};
}
test('navpoints share hosted + original fallback databases, refresh changed cycles and survive offline restart',async t=>{
  const directory=await folder(t), upstream=source();let clock=Date.now();
  const options={directory,fetchRemote:upstream.fetchRemote,now:()=>clock};
  const data=createNavigationData(options), profile=createProfileData(data);
  const first=await profile.navpoints(points);
  assert.equal(first.filter(p=>p.airportIcao==='EDTL').length,1,'hosted airport takes precedence');
  assert.equal(first.find(p=>p.type==='NAVAID').name,'Funkfeuer one [LHR] (110.50)');
  assert.equal(first.find(p=>p.type==='RPP').rppAirportIcao,'EDTL');
  assert.equal(first.find(p=>p.airportIcao==='EDTO').name,'APT EDTO');
  const requests=upstream.calls.length;await profile.navpoints(points);assert.equal(upstream.calls.length,requests);
  clock+=3600001;upstream.version('two');
  const second=await profile.navpoints(points);assert.match(second.find(p=>p.type==='NAVAID').name,/two/);
  assert.ok(upstream.calls.some(c=>c.url.includes('/cycles/two/navaids.json')));
  upstream.offline();clock+=3600001;
  const restored=createProfileData(createNavigationData(options));
  assert.deepEqual(await restored.navpoints(points),second);
  await assert.rejects(profile.navpoints([{lat:99,lon:7,distNM:0},points[1]]),/invalid/);
});
test('conditional validation saves bandwidth, adopts changed data and rejects corrupt replacements',async t=>{
  const directory=await folder(t);let clock=Date.now(),mode=0,calls=0;
  const options={directory,now:()=>clock,fetchRemote:async(url,init)=>{
    calls++;if(mode===0)return new Response('{"v":1}',{headers:{ETag:'"v1"'}});
    assert.equal(init.headers['If-None-Match'],mode<3?'"v1"':'"v2"');
    if(mode===1)return new Response(null,{status:304});
    return new Response(mode===2?'{"v":2}':'corrupt',{headers:{ETag:'"v2"'}});
  }};
  let cache=createNavigationCache(options);const read=()=>cache.get('https://example.test/database',{ttlMs:1000,validate:b=>JSON.parse(b)});
  assert.equal((await read()).toString(),'{"v":1}');clock+=2000;mode=1;cache=createNavigationCache(options);
  assert.equal((await read()).toString(),'{"v":1}');await read();assert.equal(calls,2);assert.equal(cache.snapshot().revalidated,1);
  clock+=2000;mode=2;assert.equal((await read()).toString(),'{"v":2}');
  clock+=2000;mode=3;assert.equal((await read()).toString(),'{"v":2}');assert.equal(cache.snapshot().stale,1);
});
test('unavailable collections use original static fallback; broad view avoids oversized pack download',async t=>{
 const directory=await folder(t), upstream=source();const cache=createNavigationCache({directory,fetchRemote:upstream.fetchRemote});
 const {createNavpoints}=require('./tracker-navpoints');let calls=0;
 const read=createNavpoints({cache,aviation:{getNavpointSnapshot:async()=>{calls++;return {navaids:[],reportingPoints:[],airports:[],meta:{collections:{navaids:{errorStatus:503},reportingPoints:{errorStatus:429}}}};}}});
 const result=await read({bounds});assert.equal(result.find(p=>p.type==='RPP').name,'RPP Fallback Süd');assert.equal(result.find(p=>p.type==='NAVAID').name,'static (110.50)');
 await read({bounds:{south:45,north:50,west:5,east:10}});assert.equal(calls,1);
});

test('a parseable but invalid published catalog cannot poison the offline cache',async t=>{
  const directory=await folder(t),upstream=source();let clock=Date.now(),invalid=false;
  const options={directory,now:()=>clock,fetchRemote:(url,init)=>invalid&&url.endsWith('latest.json')?Promise.resolve(new Response('{"error":"temporary failure"}')):upstream.fetchRemote(url,init)};
  const first=await createNavigationData(options).navpoints({bounds});
  clock+=3600001;invalid=true;
  const second=await createNavigationData(options).navpoints({bounds});
  assert.deepEqual(second,first,'valid cached cycle survives an HTTP 200 error document');
  upstream.offline();invalid=false;clock+=3600001;
  assert.deepEqual(await createNavigationData(options).navpoints({bounds}),first);
});
