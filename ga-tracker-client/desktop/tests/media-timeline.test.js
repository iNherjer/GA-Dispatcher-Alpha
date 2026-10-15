'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createMediaTimeline}=require('../lib/media-timeline');
function fixture(){let at=0;return {tick(ms){at+=ms;},update:createMediaTimeline(()=>at)};}
const sample=(extra={})=>({ok:true,source:'chrome.exe',players:[{source:'chrome.exe'}],title:'Song',artist:'Artist',playing:true,positionSeconds:null,durationSeconds:null,...extra});
test('missing native timeline counts only observed playback, never invents duration',()=>{
 const f=fixture();assert.equal(f.update(sample()).positionSeconds,0);f.tick(5000);
 const s=f.update(sample());assert.equal(s.positionSeconds,5);assert.equal(s.durationSeconds,null);assert.equal(s.positionKind,'estimated');
 f.update(sample({playing:false}));f.tick(8000);assert.equal(f.update(sample({playing:false})).positionSeconds,5);
 f.update(sample());f.tick(2000);assert.equal(f.update(sample()).positionSeconds,7);
});
test('native position is independent of duration and later synchronizes the estimate',()=>{
 const f=fixture();f.update(sample());f.tick(5000);
 let s=f.update(sample({positionSeconds:120}));assert.equal(s.positionSeconds,120);assert.equal(s.positionKind,'native');assert.equal(s.durationSeconds,null);
 f.tick(2000);s=f.update(sample());assert.equal(s.positionSeconds,122);assert.equal(s.positionKind,'estimated');
});
test('new track rejects unchanged stale timeline and old duration until native update',()=>{
 const f=fixture(),timeline={position:90,end:200,updated:100};
 f.update(sample({positionSeconds:90,durationSeconds:200,timeline}));f.tick(1000);
 let s=f.update(sample({title:'Next',positionSeconds:90,durationSeconds:200,timeline}));assert.equal(s.positionSeconds,0);assert.equal(s.durationSeconds,null);
 f.tick(1000);s=f.update(sample({title:'Next',positionSeconds:90,durationSeconds:200,timeline}));assert.equal(s.positionSeconds,1);assert.equal(s.durationSeconds,null);
 s=f.update(sample({title:'Next',positionSeconds:3,durationSeconds:250,timeline:{position:3,end:250,updated:102}}));assert.equal(s.positionSeconds,3);assert.equal(s.durationSeconds,250);
});
test('source switch, disappearing session and helper failure reset observation',()=>{
 const f=fixture();f.update(sample());f.tick(8000);assert.equal(f.update(sample()).positionSeconds,8);
 assert.equal(f.update(sample({source:'other',players:[{source:'other'}]})).positionSeconds,0);
 f.update(sample({players:[]}));assert.equal(f.update(sample()).positionSeconds,0);
 f.tick(8000);f.update({ok:false});assert.equal(f.update(sample()).positionSeconds,0);
});
test('same-track next/repeat command resets; native repeat/seek synchronizes; metadata enrichment preserves clock',()=>{
 const f=fixture();f.update(sample());f.tick(8000);assert.equal(f.update(sample({album:'Album'})).positionSeconds,8);
 assert.equal(f.update(sample(),'next').positionSeconds,0);
 f.update(sample({positionSeconds:120,timeline:{position:120}}));assert.equal(f.update(sample({positionSeconds:0,timeline:{position:0}})).positionSeconds,0);
});
test('private raw timeline/album stay local and duration-only does not manufacture native position',()=>{
 const f=fixture();const s=f.update(sample({durationSeconds:300,timeline:{end:300},album:'Private'}));
 assert.equal(s.positionKind,'estimated');assert.equal(s.durationSeconds,300);assert.ok(!('timeline' in s));assert.ok(!('album' in s));
});
test('a changed EndTime cannot attach a previous song anchor to a new title',()=>{
 let at=0;const update=createMediaTimeline(()=>at,()=>100000+at);
 const old={position:330,end:500,updatedAtMs:99000};
 update(sample({positionSeconds:330,durationSeconds:500,timeline:old}));at=5000;
 let s=update(sample({title:'New song',positionSeconds:335,durationSeconds:510,timeline:{...old,end:510}}));
 assert.equal(s.positionSeconds,0);assert.equal(s.durationSeconds,null);assert.equal(s.positionKind,'estimated');
 at=20000;s=update(sample({title:'New song',positionSeconds:350,durationSeconds:525,timeline:{...old,end:525}}));assert.equal(s.positionSeconds,15);assert.equal(s.durationSeconds,null);
 s=update(sample({title:'New song',positionSeconds:17,durationSeconds:240,timeline:{position:17,end:240,updatedAtMs:120000}}));assert.equal(s.positionSeconds,17);assert.equal(s.positionKind,'native');
});
