const {test}=require('node:test');
const assert=require('node:assert/strict');
const core=require('../mission-private-context-core.js');
const story=require('../mission-private-outing-core.js');
const target={name:'Testflugplatz',lat:48,lon:8};
const point=(name,lat=48.05,lon=8.05,type='tourism=museum')=>({name,lat,lon,type,source:'osm-poi-tile:test',description:type,quality:1});
test('radius uses coordinates rather than municipality names; invalid and distant points are rejected',()=>{
 assert.equal(core.distanceKm(target,target),0);
 assert.equal(core.distanceKm(target,{lat:null,lon:8}),Infinity);
 const chosen=core.selectPlaces(target,[point('Anderer Ort'),point('Gleicher Ortsname',49,8),point('Fehler',100,8)]);
 assert.equal(chosen.length,1);assert.equal(chosen[0].name,'Anderer Ort');
 assert.ok(chosen[0].distanceKm>0 && chosen[0].distanceKm<25);
});
test('bounded tile coverage includes points near each edge; date-line wrapping stays valid',()=>{
 for(const center of [target,{lat:48.02,lon:7.83},{lat:48.28,lon:8.43},{lat:0,lon:179.9}]){
  const keys=core.tileKeys(center);assert.ok(keys.length<=core.MAX_TILES);
  assert.equal(new Set(keys).size,keys.length);
  for(const [dy,dx] of [[0,0],[0.1,0],[-0.1,0],[0,0.1],[0,-0.1]]){
   const lon=((center.lon+dx+540)%360)-180;
   const key=`${Math.floor((center.lat+dy+90)/(25/60))}|${Math.floor((lon+180)/(25/60))}`;
   assert.ok(keys.includes(key),`${key} covered`);
  }
 }
});
test('selection bounds prompt size, collapses duplicate names, and balances repeated types and locations',()=>{
 const many=Array.from({length:60},(_,i)=>point(`Ort ${i}`,48+i*0.0001,8));
 many.push({...point('Region',48.3,8.3,'place=town'),quality:2});
 many.push({...point('Ort 0',48,8),quality:3});
 const chosen=core.selectPlaces(target,many);
 assert.equal(chosen.length,8);assert.equal(chosen.filter(p=>p.name==='Ort 0').length,1);
 assert.ok(chosen.some(p=>p.name==='Region'));
 const knowledge=core.knowledge({places:chosen});assert.equal(knowledge.facts.length,8);
 assert.ok(JSON.stringify(knowledge).length<8000);
});
test('discovery uses a coordinate-only search, validates wiki coordinates, and reuses compact cached results',async()=>{
 let requests=0;const cache=new Map();
 const adapters={cacheGet:k=>cache.get(k),cachePut:(k,v)=>cache.set(k,v),
  readTile:async()=>({poi:[]}),fetchJson:async url=>{
   requests++;const query=new URL(url).searchParams.get('gsrsearch');
   assert.equal(query,'nearcoord:50km,48,8');
   return {query:{pages:{1:{pageid:1,title:'Regionaler Ort',description:'Ortsbeschreibung',coordinates:[{lat:48.1,lon:8.1}]},2:{pageid:2,title:'Fern',coordinates:[{lat:55,lon:8}]}}}};
  }};
 const first=await core.resolve(target,adapters);assert.equal(first.places.length,1);
 assert.equal(first.stats.tileRequests,core.tileKeys(target).length);
 const again=await core.resolve(target,adapters);assert.equal(requests,1);assert.equal(again.stats.cacheHit,true);
 assert.equal(again.places[0].name,'Regionaler Ort');
 assert.ok(!JSON.stringify(cache.values().next().value).includes('Fern'));
});
test('missing sources produce partial context without retry loops or caching failure as a good week-long result',async()=>{
 let requests=0,stored=0;
 const result=await core.resolve(target,{readTile:async()=>({poi:[point('Lokaler Ort')]}),fetchJson:async()=>{requests++;throw Error('offline');},cachePut:()=>stored++});
 assert.equal(requests,1);assert.equal(stored,0);
 assert.equal(result.stats.wikiSuccess,false);
 // Source schema differs from normalized candidates; a tag is needed to become a place.
 assert.ok(result.stats.errors.includes('wikipedia'));
});
test('ground plan pins the selected location and rechecks radius without inspecting prose',()=>{
 const input=story.frame({target:{name:'Testflugplatz'},privateRegionContext:{airport:target,radiusKm:50},knowledgeContext:{status:'accept',facts:[{...point('Nachbarort'),kind:'place'}]}});
 const raw={targetName:'Testflugplatz',occasion:'Ihr wollt zusammen hinaus.',personalReason:'Ihr habt Zeit füreinander.',destinationConnection:'Gemeinsamer Ausflug',firstStep:'Ankommen',pilotIntent:'Zeit zusammen',companionIntent:'Mitkommen',factIds:['f1'],eventVisit:null,groundPlan:{factId:'f1',intent:'Gemeinsam besuchen',transferPlan:'Weiterreise organisieren'},creativeBasis:{realAnchor:'Nachbarort',fictionalPart:'Freundschaft'},storyIdentity:{activity:'Besuch',motivation:'Zeit zusammen',interaction:'Plaudern'},narrativePlan:{entryPoint:'Anlass',tone:'locker',shape:'kurz'},noveltyReason:'Erster Fall',companion:{name:'Kim',relationship:'Freund',personality:'neugierig',gender:'male'},luggage:{label:'Tasche',weightLbs:5}};
 const chosen=story.validateIdea(raw,input);assert.equal(chosen.groundPlan.place.name,'Nachbarort');
 assert.equal(story.validateIdea({...raw,groundPlan:{...raw.groundPlan,factId:'invented'}},input),null);
 input.facts[0].value.lat=51;assert.equal(story.validateIdea(raw,input),null);
 // Personal flight reason stays valid without selecting any attraction.
 assert.ok(story.validateIdea({...raw,factIds:[],groundPlan:{...raw.groundPlan,factId:null}},input));
});
test('browser loader handles gzip bodies and caches compact context independently of localStorage',async()=>{
 const {gzipSync}=require('node:zlib');
 const savedFetch=globalThis.fetch,savedCaches=globalThis.caches;
 const entries=new Map();let calls=0;
 const center={name:'Browser-Test',lat:46.1,lon:9.1};
 globalThis.caches={open:async()=>({match:async k=>entries.get(typeof k==='string'?k:k.url)?.clone(),delete:async k=>entries.delete(typeof k==='string'?k:k.url),put:async(k,v)=>entries.set(k,v.clone()),keys:async()=>[...entries.keys()].map(url=>({url}))})};
 globalThis.fetch=async url=>{
  calls++;
  if(String(url).includes('wikipedia'))return new Response(JSON.stringify({query:{pages:{1:{pageid:1,title:'Browser-Ort',coordinates:[{lat:46.11,lon:9.11}],description:'Gemeinde'}}}}));
  return new Response(gzipSync(JSON.stringify({poi:[{name:'Ufer',lat:46.12,lon:9.12,natural:'water'}]})));
 };
 try{
  const first=await core.resolveBrowser(center);assert.equal(first.stats.wikiSuccess,true);assert.ok(first.stats.tileSuccesses>0);
  assert.equal(entries.size,1);const before=calls;
  const again=await core.resolveBrowser(center);assert.equal(again.stats.cacheHit,true);assert.equal(calls,before);
  const cached=await [...entries.values()][0].clone().json();assert.equal(cached.schema,core.VERSION);assert.ok(cached.places.length<=8);
 }finally{globalThis.fetch=savedFetch;if(savedCaches===undefined)delete globalThis.caches;else globalThis.caches=savedCaches;}
});
