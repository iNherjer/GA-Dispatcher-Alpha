const {test}=require('node:test'),assert=require('node:assert/strict');
const g=require('../mission-grounded-events-core.js');
const period={from:'2026-11-16',through:'2026-11-30'};
test('support must overlap the event line; domains carried; multi-line support only covers its lines',()=>{
 const l1='EVENT | a | Konzert A | Halle | 48 | 7.8 | 2026-11-20 | 2026-11-20 | kultur | https://www.halle.de/a | Tickets';
 const l2='EVENT | b | Markt B | Platz | 48.1 | 7.9 | 2026-11-21 | 2026-11-22 | genuss | https://markt.example/b | frei';
 const text=l1+'\n'+l2;
 const body={candidates:[{content:{parts:[{text}]},groundingMetadata:{groundingChunks:[{web:{uri:'https://vertexaisearch.cloud.google.com/grounding-api-redirect/1',title:'halle.de'}}],groundingSupports:[{segment:{text:'Konzert A | Halle | 48'},groundingChunkIndices:[0]}]}}]};
 const out=g.parse(body,period,{kinds:['kultur','genuss']});
 assert.equal(out.length,1);assert.equal(out[0].id,'a');assert.equal(out[0].sourceMatch,true);assert.equal(out[0].sourceUrl,'https://www.halle.de/a');
 assert.equal(g.parse({candidates:[{content:{parts:[{text:'KEINE'}]}}]},period).length,0);
 assert.ok(g.sameDomain('www.messe-stuttgart.de','messe-stuttgart.de'));assert.ok(!g.sameDomain('evil-halle.de','halle.de'));
});
