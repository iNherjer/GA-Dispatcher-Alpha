'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const core = require('./navigation-warning-core');
const space = { id: 'c', name: 'Test C', type: 0, icaoClass: 2,
  lowerLimit: {value:5000, unit:1, referenceDatum:1}, upperLimit: {value:7000, unit:1, referenceDatum:1},
  geometry:{type:'Polygon', coordinates:[[[-1,-1],[1,-1],[1,1],[-1,1],[-1,-1]]]}};
function fixture() {
  const detector = core.createVerticalAirspaceDetector();
  return (gap, now = 0, overrides = {}) => detector.evaluate({airspaces:[space],
    gps:{lat:0,lon:0,alt:5000-gap}, terrainFt:0, now, ...overrides});
}
test('initial clearance rounds down and approach announces fixed 1000/500/100 steps', () => {
  const tick=fixture();
  const first=tick(1160)[0]; assert.equal(first.spokenFt,1100); assert.equal(first.level,1500);
  assert.deepEqual(first.clips,['aw-achtung','aw-charlie','aw-ein','aw-tausend','aw-ein','aw-hundert','aw-fuss','aw-oberhalb']);
  assert.equal(tick(1100,180000).length,0,'no timed repeats while staying');
  assert.equal(tick(1000,181000)[0].level,1000);
  assert.equal(tick(500,182000)[0].level,500);
  assert.equal(tick(100,183000)[0].level,100);
  assert.equal(tick(40,400000).length,0,'final warning stays latched');
});
test('150ft hysteresis and separate cooldown require a fresh eligible re-entry', () => {
  const tick=fixture(); tick(1000);
  assert.equal(tick(1140,1000).length,0);
  assert.equal(tick(1000,200000).length,0,'boundary noise cannot rearm');
  tick(1151,201000);
  assert.equal(tick(1000,202000)[0].level,1000);
  tick(1151,203000);
  assert.equal(tick(1000,204000).length,0,'cooldown');
  assert.equal(tick(1000,400000).length,0,'blocked re-entry is not replayed by a timer');
  tick(1151,401000); assert.equal(tick(1000,402000)[0].level,1000);
});
test('jumps emit only the closest level; above/below and multiple spaces are separate', () => {
  const tick=fixture(); assert.equal(tick(70)[0].level,100);
  assert.equal(tick(70)[0],undefined);
  const event=tick(0,1000,{gps:{lat:0,lon:0,alt:7500}})[0];
  assert.equal(event.direction,'below'); assert.equal(event.level,500);
  const detector=core.createVerticalAirspaceDetector();
  const nearer={...space,id:'near',lowerLimit:{...space.lowerLimit,value:4600}};
  assert.equal(detector.evaluate({airspaces:[space,nearer],gps:{lat:0,lon:0,alt:4000},now:0})[0].as.id,'near');
});
test('horizontal exit requires cooldown too, and inside the volume does not warn', () => {
  const tick=fixture(); tick(1400);
  tick(1400,1000,{gps:{lat:2,lon:0,alt:3600}});
  assert.equal(tick(1400,2000).length,0);
  assert.equal(tick(1400,200000).length,0);
  tick(1400,201000,{gps:{lat:2,lon:0,alt:3600}});
  assert.equal(tick(1400,202000).length,1);
  assert.equal(tick(-100,203000).length,0);
});
test('AGL requires terrain and flight levels require pressure altitude, independently of MSL', () => {
  const agl={...space,lowerLimit:{value:2000,unit:1,referenceDatum:0}};
  assert.equal(core.verticalAirspaceGap(agl,{lat:0,lon:0,alt:2500},null),null);
  assert.deepEqual(core.verticalAirspaceGap(agl,{lat:0,lon:0,alt:2500},1500),{direction:'above',distanceFt:1000});
  const fl={...space,lowerLimit:{value:60,unit:6,referenceDatum:2},upperLimit:{value:90,unit:6,referenceDatum:2}};
  assert.equal(core.verticalAirspaceGap(fl,{lat:0,lon:0,alt:5400},0),null);
  assert.deepEqual(core.verticalAirspaceGap(fl,{lat:0,lon:0,alt:5400,pressureAltitudeFt:5000},0),{direction:'above',distanceFt:1000});
});
test('below 100ft says less than 100, never zero; new clip paths are validated', () => {
  assert.deepEqual(core.verticalDistanceClips(80,'below'),['aw-weniger-als','aw-ein','aw-hundert','aw-fuss','aw-unterhalb']);
  for (const key of core.verticalDistanceClips(1200,'above')) assert.match(core.assetPath(key,'ava-en'),/^audio-warnings\/voices\/ava-en\//);
  assert.throws(()=>core.assetPath('aw-weniger-als/../../secret'),/invalid_warning_clip/);
});
test('missing height datum does not masquerade as departure and rearm a warning', () => {
  const detector=core.createVerticalAirspaceDetector(), fl={...space,lowerLimit:{value:60,unit:6,referenceDatum:2},upperLimit:{value:90,unit:6,referenceDatum:2}};
  const tick=(pressureAltitudeFt,now)=>detector.evaluate({airspaces:[fl],gps:{lat:0,lon:0,alt:5000,pressureAltitudeFt},terrainFt:0,now});
  assert.equal(tick(4800,0).length,1);
  assert.equal(tick(null,180000).length,0);
  assert.equal(tick(4800,181000).length,0);
});
