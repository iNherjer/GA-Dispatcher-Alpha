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
test('event cadence per strand counts only events actually taken',()=>{
 assert.equal(g.eventDue([],3),true);
 assert.equal(g.eventDue([{eventId:'a'},{},{}],3),true,'Event liegt drei Flüge zurück');
 assert.equal(g.eventDue([{},{eventId:'a'},{}],3),false,'Event vor zwei Flügen sperrt bei Taktung 3');
 assert.equal(g.eventDue([{eventId:'a'}],2),false);assert.equal(g.eventDue([{eventId:'a'},{}],2),true);
 assert.equal(g.eventDue([{},{}],3),true,'Suchen ohne Treffer zählen nicht');
});
test('private event fact sits inside the private window and carries identity into eventVisit/history',()=>{
 const ev=require('../mission-charter-events-core.js');
 const dist=(a,b)=>Math.hypot(a.lat-b.lat,(a.lon-b.lon)*0.67)*111;
 const w={arrivalDate:'2026-11-18',throughDate:'2026-11-22'},apt={lat:48.02,lon:7.83};
 const e={id:'wm',title:'Weihnachtsmarkt',venue:'Rathausplatz',lat:48.0,lon:7.85,startsOn:'2026-11-12',endsOn:'2026-12-23',sourceUrl:'https://x.de',visitorInfo:'Stände',kind:'genuss',verification:'search'};
 const f=ev.privateFact(e,w,apt,dist);assert.equal(f.kind,'event');assert.equal(f.eventDate,'2026-11-18','mehrtägig: erster Tag im Fenster');assert.equal(f.eventId,'wm');
 assert.equal(ev.privateFact({...e,startsOn:'2026-11-25',endsOn:'2026-11-25'},w,apt,dist),null,'nach Sonntag');
 assert.equal(ev.pickKinds([{...e,kind:'beruf'}],apt,ev.PRIVATE_KINDS,dist),null,'Messen nicht privat');
 const soon={...e,id:'soon',startsOn:'2026-11-18',endsOn:'2026-11-18',verification:'search'},later={...e,id:'later',startsOn:'2026-11-21',endsOn:'2026-11-21',verification:'search'};assert.equal(ev.pickKinds([later,soon],apt,ev.PRIVATE_KINDS,dist).event.id,'soon','zeitlich nächste zuerst');
 assert.equal(ev.EVENT_EVERY.private,3);assert.equal(ev.EVENT_EVERY.charter,2);
});
test('search retried exactly once when Gemini answered without searching',async()=>{
 const calls=[];const reply=q=>({ok:true,json:async()=>({candidates:[{content:{parts:[{text:'KEINE'}]},groundingMetadata:{webSearchQueries:q}}]})});
 let n=0;const f=async(url,opt)=>{calls.push(JSON.parse(opt.body));n++;return reply(n===1?[]:['Veranstaltungen Hamburg']);};
 const body=await g.request({prompt:'x',apiKey:'k',fetchImpl:f});assert.equal(calls.length,2);assert.equal(body.searchRetry,true);assert.equal(calls[1].generationConfig.thinkingConfig.thinkingLevel,'medium');
 calls.length=0;n=1;await g.request({prompt:'x',apiKey:'k',fetchImpl:async(u,o)=>{calls.push(1);return reply(['q']);}});assert.equal(calls.length,1,'mit Suche kein zweiter Abruf');
});
test('ranking: short events before long-running ones, ongoing counts from today',()=>{
 const ev=require('../mission-charter-events-core.js');const now='2026-11-16';
 const mk=(id,s,e,v='search')=>({e:{id,startsOn:s,endsOn:e,verification:v},km:5});
 const list=[mk('ausstellung','2026-06-03','2026-11-30'),mk('volksfest','2026-11-06','2026-12-06'),mk('konzert-di','2026-11-17','2026-11-17'),mk('show-sa','2026-11-21','2026-11-21')];
 assert.deepEqual(list.sort((a,b)=>ev.rank(a,b,now)).map(x=>x.e.id),['konzert-di','show-sa','volksfest','ausstellung']);
 const sup=[mk('show-sa','2026-11-21','2026-11-21'),mk('markt','2026-11-19','2026-12-23','supported')];
 assert.equal(sup.sort((a,b)=>ev.rank(a,b,now))[0].e.id,'markt','belegt bleibt vorn');
});
