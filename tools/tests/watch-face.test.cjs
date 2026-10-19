const test=require('node:test'),assert=require('node:assert/strict');
const face=require('../../media-player-watch-face'),sun=require('../../vendor/suncalc/suncalc');
const context=(date,lat,lon,offsetSeconds)=>({instantMs:Date.parse(date),flight:{lat,lon},offsetSeconds});
test('day ring uses regional sunrise/sunset and handles midnight offsets',()=>{
 const c=context('2026-10-19T10:00:00Z',48.77,9.18,7200),v=face.solar(c,sun),times=sun.getTimes(new Date(c.instantMs),c.flight.lat,c.flight.lon);
 assert.ok(v.rise>6*3600&&v.rise<9*3600);assert.ok(v.set>17*3600&&v.set<20*3600);
 assert.equal(v.rise,((+times.sunrise/1000+7200)%86400+86400)%86400);
 assert.ok(face.arc(v.rise,v.set).includes('A101,101'));assert.ok(face.arc(20*3600,4*3600).includes(' 0 0 1 '));
});
test('polar day/night and missing flight position do not invent rise/set times',()=>{
 assert.equal(face.solar(context('2026-06-21T12:00:00Z',78.2,15.6,7200),sun).polar,'day');
 assert.equal(face.solar(context('2026-12-21T12:00:00Z',78.2,15.6,3600),sun).polar,'night');
 assert.equal(face.solar({instantMs:Date.now(),flight:{lat:null,lon:0}},sun),null);
});
test('clock context exposes simulator date/region, then discards stale weather position',()=>{
 const clock=require('../../display-clock');const now=Date.now,instant=Date.parse('2026-10-19T23:30:00Z');Date.now=()=>instant;
 try{
 const win={localStorage:{getItem:()=>null,setItem:()=>{}},document:{readyState:'loading',getElementById:()=>null,addEventListener:()=>{}},addEventListener:()=>{},setInterval:()=>1};
 clock.install(win);win.GADisplayClock.observe({lat:48.77,lon:9.18,simRunning:1,simAbsoluteTimeSeconds:(instant+62135596800000)/1000,simLocalTimeSeconds:5400},instant);
 const c=win.GADisplayClock.context();assert.equal(c.instantMs,instant);assert.equal(c.offsetSeconds,7200);assert.equal(c.time.seconds,5400);
 Date.now=()=>instant+10000;assert.equal(win.GADisplayClock.context().flight,null);assert.equal(win.GADisplayClock.context().time.source,'device');
 }finally{Date.now=now;}
});
