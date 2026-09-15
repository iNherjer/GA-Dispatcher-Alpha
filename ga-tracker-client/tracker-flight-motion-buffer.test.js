'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { createFlightMotionBuffer } = require('./tracker-flight-motion-buffer');
const { observeFlightVoice } = require('./tracker-flight-voice-core');
for (const domain of ['passenger_transfer', 'media_photo']) test(`${domain}: production 500-ms decisions consume local source motion without network/persistence work`, () => {
 const buffer = createFlightMotionBuffer();
 let state = {}, detected = false, maxSamples = 0;
 for (let at=100000; at<=110000; at+=100) {
  const wave=Math.sin((at-100000)/180);
  const sample={observedAt:at,gForce:1+wave*.25,bankDeg:wave*8,vsFpm:wave*500,pitchDeg:wave*3,onGround:false,gsKts:100};
  buffer.observe(sample,'run');
  if(at%500)continue;
  const result=observeFlightVoice({supported:true,taskDomain:domain,passenger:{},baseContext:'Original'},state,
   {now:at,active:true,greetingDone:true,departureDistanceNm:5,flightData:sample,motionSamples:buffer.read(at,'run')});
  state=result.state;detected ||= state.motionAnalysis?.detected===true;maxSamples=Math.max(maxSamples,state.motionAnalysis?.samples||0);
 }
 assert.equal(detected,true);assert.ok(maxSamples>=12);
 assert.ok(buffer.read(110000,'run').length<=48);
 buffer.observe({observedAt:110100,simPaused:true},'run');assert.deepEqual(buffer.read(110500,'run'),[]);
 buffer.observe({observedAt:110200,gForce:1,bankDeg:0,vsFpm:0},'run');
 assert.deepEqual(buffer.read(112000,'run'),[]);assert.deepEqual(buffer.read(110500,'replacement'),[]);
 buffer.clear();assert.deepEqual(buffer.read(110500,'run'),[]);
});

test('production entry delivers local motion before the unchanged relay throttle and retains the pitch input', () => {
 const source=fs.readFileSync(require.resolve('./tracker.js'),'utf8');
 assert.ok(source.indexOf('observeMotionTelemetry?.({ observedAt: now')<source.indexOf('if (now - lastSent < SEND_INTERVAL_MS) return;'));
 assert.match(source,/const SEND_INTERVAL_MS = 500/);
 assert.match(source,/gForce, bankDeg: bank, vsFpm, pitchDeg, simPaused/);
 assert.match(source,/!validPosition && missionExecutionRuntime\?\.enabled && \(simPaused \|\| missionTelemetryInMenu\)/);
});
