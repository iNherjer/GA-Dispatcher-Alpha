 'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createEnvironmentDiagnostics}=require('./tracker-environment-diagnostics');
test('logs received presets without a mission, only transitions and expiry',()=>{const rows=[],d=createEnvironmentDiagnostics(x=>rows.push(x));d.observe({observedAt:1000});for(let i=0;i<1000;i++)d.observe({observedAt:2000+i,weatherPreset:{index:1,name:'Clear',receivedAt:2000}});assert.equal(rows.length,2);d.observe({observedAt:4000,weatherPreset:{index:2,name:'Storm',receivedAt:4000}});assert.match(rows[2],/changed/);assert.match(rows[2],/no_active_mission/);d.observe({observedAt:20000,weatherPreset:{index:2,name:'Storm',receivedAt:4000}});assert.match(rows.filter(x=>x.startsWith('SIM_ENV_PRESET')).at(-1),/unavailable/);});
test('time jumps subtract normal rate, retain menu baseline, do not flood or treat midnight as a jump',()=>{const rows=[],d=createEnvironmentDiagnostics(x=>rows.push(x));const tick=(t,s,l,extra={})=>d.observe({observedAt:t,simAbsoluteTimeSeconds:s,simLocalTimeSeconds:l,simulationRate:2,...extra});tick(1000,100000,86399);tick(2000,100002,1);tick(3000,100004,3);assert.equal(rows.length,2);tick(4000,110000,10000,{inMenuOrMap:true});tick(5000,110002,10002);assert.equal(rows.length,3);assert.match(rows[2],/jump/);tick(6000,110004,10004);assert.equal(rows.length,3);tick(7000,100006,6);assert.match(rows[3],/shiftSeconds":-10000/);});
test('missing time, long interruptions and exactly sixty minutes never create a jump',()=>{const rows=[],d=createEnvironmentDiagnostics(x=>rows.push(x));d.observe({observedAt:1000,simAbsoluteTimeSeconds:10000});d.observe({observedAt:2000,simAbsoluteTimeSeconds:13601});assert.equal(rows.filter(x=>x.includes('jump')).length,0);d.observe({observedAt:200000,simAbsoluteTimeSeconds:20000});d.observe({observedAt:201000,simAbsoluteTimeSeconds:null});assert.match(rows.at(-1),/unavailable/);});

test('weather values survive unavailable preset gaps and bounded windows explain thresholds without voice requests',()=>{
 const rows=[],d=createEnvironmentDiagnostics(x=>rows.push(x));
 const tick=(at,index,wind)=>d.observe({observedAt:at,weatherPreset:index===null?null:{index,receivedAt:at},lat:48,lon:8,mslFt:1000,tempC:20,windKts:wind,visKm:10,precipState:2});
 tick(1000,1,2);tick(2000,null,2);tick(3000,0,20);
 for(let at=3100;at<=44000;at+=100)tick(at,0,20);
 const reports=rows.filter(x=>x.startsWith('SIM_ENV_WEATHER')).map(x=>JSON.parse(x.split('data=')[1]));
 assert.equal(reports.length,4);assert.equal(reports[0].before.windKts,2);assert.equal(reports[0].after.windKts,20);
 assert.equal(reports[0].measurement,'threshold_met');assert.equal(reports.at(-1).status,'window_complete');
 assert.ok(!rows.some(x=>x.includes('requested')));
});
test('same-weather preset change reports below threshold rather than a hypothetical comment',()=>{
 const rows=[],d=createEnvironmentDiagnostics(x=>rows.push(x));
 for(const [at,index] of [[1000,1],[2000,2]])d.observe({observedAt:at,weatherPreset:{index,receivedAt:at},tempC:20,windKts:2,visKm:10});
 assert.match(rows.find(x=>x.startsWith('SIM_ENV_WEATHER')),/below_threshold/);
});

test('actual mission test log accepts every environment diagnostic event',()=>{
 const {SYSTEM_LINE_PATTERN}=require('./tracker-apt-mission-test-log');
 for(const event of ['PRESET','TIME','VOICE','WEATHER','CLOCK_SOURCE'])assert.ok(SYSTEM_LINE_PATTERN.test('SIM_ENV_'+event+' data={}'));
});
