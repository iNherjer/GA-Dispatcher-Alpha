const {test}=require('node:test'),assert=require('node:assert/strict'),core=require('../mission-poi-briefing-core.js');
const target={name:'Waldsee Bergstadt',lat:48,lon:8};
const ring=(x=8,y=48,d=.001)=>[{lon:x-d,lat:y-d},{lon:x+d,lat:y-d},{lon:x+d,lat:y+d},{lon:x-d,lat:y+d},{lon:x-d,lat:y-d}];
const way=(id,tags,geometry=ring())=>({id,type:'way',tags,geometry});
test('names never establish land cover; explicit tags and a complete ring are required',()=>{
 assert.deepEqual(core.environmentFacts(target,{elements:[way(1,{name:'Waldsee'})]}),[]);
 assert.deepEqual(core.environmentFacts(target,{elements:[way(1,{natural:'wood'},ring().slice(0,-1))]}),[]);
 const facts=core.environmentFacts(target,{elements:[way(1,{natural:'wood',name:'Stadtsee'})]});
 assert.equal(facts[0].kind,'Wald');assert.equal(facts[0].containsTarget,true);assert.match(facts[0].source,/way\/1$/);
});
test('inner holes and incomplete multipolygons cannot turn a clearing into forest',()=>{
 const relation={id:2,type:'relation',tags:{type:'multipolygon',landuse:'forest'},members:[{type:'way',ref:1,role:'outer',geometry:ring(8,48,.01)},{type:'way',ref:3,role:'inner',geometry:ring()}]};
 const facts=core.environmentFacts(target,{elements:[way(1,{landuse:'forest'},ring(8,48,.01)),relation]});
 assert.equal(facts.length,1);assert.equal(facts[0].containsTarget,false);
 relation.members[1].geometry=ring().slice(0,-1);
 assert.deepEqual(core.environmentFacts(target,{elements:[way(1,{landuse:'forest'}),relation]}),[]);
});
test('distance uses polygon boundary, rejects distant features and server partial errors',()=>{
 const row=way(5,{landuse:'residential'},ring(8,48.01,.003));
 const facts=core.environmentFacts(target,{elements:[row,way(6,{natural:'wood'},ring(9,49))]});
 assert.equal(facts.length,1);assert.ok(facts[0].distanceM>750&&facts[0].distanceM<800);assert.match(facts[0].fact,/Nördlich/);
 assert.deepEqual(core.environmentFacts(target,{remark:'timeout',elements:[row]}),[]);
});
test('query is coordinate based, not derived from names',()=>{
 assert.equal(core.environmentQuery(target),core.environmentQuery({...target,name:'Beliebig'}));
 assert.match(core.environmentQuery(target),/around:1852,48,8/);
 assert.throws(()=>core.environmentQuery({...target,lat:null}));
});
test('OSM node/way JSON and inline geometry produce the same evidence',()=>{
 const geometry=ring(),nodes=geometry.slice(0,-1).map((p,i)=>({...p,id:i+10,type:'node'}));
 const a=core.environmentFacts(target,{elements:[way(9,{natural:'wood'})]});
 const b=core.environmentFacts(target,{elements:[...nodes,{type:'way',id:9,tags:{natural:'wood'},nodes:[10,11,12,13,10]}]});
 assert.deepEqual(b,a);
});
test('real OSM map excerpts give repeatable facts independent of all feature names',()=>{
 const evidence=require('./fixtures/poi-environment-map-evidence.json');
 for(const c of evidence.cases){
  assert.deepEqual(core.environmentFacts(c.target,c.payload),c.expected);
  const renamed=structuredClone(c.payload);for(const e of renamed.elements)e.tags.name='Waldstadt Bergsee';
  assert.deepEqual(core.environmentFacts({...c.target,name:'Seeberg'},renamed),c.expected);
 }
});
test('coherent environment paragraph groups bearings without inventing between, hills or portals',()=>{
 const cases=require('./fixtures/poi-environment-map-evidence.json').cases;
 const tunnel=core.environmentProse(cases[0].expected),memorial=core.environmentProse(cases[1].expected);
 assert.match(tunnel,/Südwestlich des Ziels liegt Wohnbebauung/);
 assert.match(tunnel,/an der Oberfläche eine Wiesenfläche/);
 assert.equal((memorial.match(/südöstlich/gi)||[]).length,1);
 for(const text of [tunnel,memorial])assert.doesNotMatch(text,/zwischen|Hang|Berg|Portal/);
 assert.equal(core.environmentProse([]),'');
});
