'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const core = require('../mission-precipitation-core.js');
const farewell = require('../mission-farewell-voice-core.js');
const pickup = require('../mission-bush-pickup-voice-core.js');
const comfort = require('../mission-comfort-core.js');
const query = require('../mission-pax-query-core.js');
const flight = require('../ga-tracker-client/tracker-flight-voice-core.js');
const logs = require('../ga-tracker-client/tracker-flight-log-store.js');

test('SDK bitmask distinguishes none, rain, snow and mixed precipitation even with conflicting legacy flags', () => {
  for (const [state, active, label] of [[2,false,'kein Niederschlag'],[4,true,'Regen'],[8,true,'Schnee'],[12,true,'Regen und Schnee']]) {
    const result = core.observe({precipState:state,precipActive:!active,precipRateMmH:500});
    assert.equal(result.precipState,state); assert.equal(result.precipActive,active); assert.equal(result.precipLabel,label);
    assert.equal(result.precipRateMmH,null);
  }
});
test('missing and invalid data do not claim dry weather or quantified intensity', () => {
  for (const input of [null,{}, {precipRateMmH:20}, {precipState:0}, {precipState:6,precipActive:true}, {precipState:16}, {precipState:'4'}, {precipState:NaN}]) {
    assert.equal(core.observe(input).precipActive,null); assert.equal(core.observe(input).precipLabel,null);
    assert.equal(farewell.weatherContext(input),''); assert.equal(pickup.weatherContext(input),'');
  }
  assert.equal(core.observe({precipActive:true}).precipLabel,'Niederschlag');
});
test('raw simulator RATE remains diagnostic without an invented hourly rate', () => {
  const normalized = logs.telemetrySample({precipState:8,precipRateRaw:17,precipRateMmH:400});
  assert.equal(normalized.precipRateRaw,17); assert.equal(normalized.precipRateMmH,null);
  assert.equal(normalized.precipRateUnit,'millimeters of water; timebase unknown');
  assert.equal(normalized.precipActive,true); assert.equal(normalized.precipState,8);
  assert.equal(farewell.weatherContext(normalized),'Wetter: Schnee.');
});
test('canonical, extracted Bush, POI and training weather helpers and Farewell agree on qualitative precipitation', async () => {
  const fs = require('node:fs');
  const {extractOriginalFunction} = await import('./extract-original-function.mjs');
  const sources = ['passenger-voice.js','mission-poi-voice-core.js','mission-training-flight-core.js'];
  for (const name of sources) {
    const source = fs.readFileSync(require.resolve('../'+name),'utf8');
    const context = {};
    vm.runInNewContext(['_precipitationObservation','_weatherContext'].map(n=>extractOriginalFunction(source,n)).join('\n'),context);
    for (const precipState of [2,4,8,12,0,6]) {
      const fd={precipState,precipRateMmH:20};
      assert.equal(context._weatherContext(fd),farewell.weatherContext(fd),name);
      assert.equal(pickup.weatherContext(fd),farewell.weatherContext(fd));
    }
  }
});
test('raw rate alone cannot create a comfort penalty, severe precipitation event or weather query', () => {
  const ctx={hasPassenger:true,paxText:'1 PAX',cargoText:'',isPoi:false,missionData:{},baseContext:'Beobachter an Bord'};
  for (const fd of [{precipRateMmH:500},{precipState:2,precipActive:true,precipRateRaw:500}]) {
    const result=comfort.evaluate(null,fd,ctx,1000);
    assert.equal(result.state.weatherEvents,0); assert.equal(result.state.weatherSevere,0);
    assert.equal(result.summary.maxPrecipRate,null);
    assert(!query.available(ctx,fd).includes('pax_weather'));
  }
  const rain=comfort.evaluate(null,{precipState:4,precipRateRaw:500},ctx,1000);
  assert.equal(rain.state.weatherEvents,1); assert.equal(rain.state.weatherSevere,0);
  const spoken=query.render('pax_weather',ctx,{flightData:{precipState:8,precipRateRaw:500}});
  assert.match(spoken.prompt,/Schnee/); assert.doesNotMatch(spoken.prompt,/mm\/h|500|Niederschlag stark/);
});
test('Tracker comfort confirms qualitative rain only after dwell and ignores dry/unknown raw rates', () => {
  const ctx={supported:true,mode:'passenger',baseContext:'Passenger reference',passenger:{},start:'EDTW'};
  const simulate=fd=>{
    let state={},effects=[];
    for(let now=100000;now<=103000;now+=250){
      const result=flight.observeFlightVoice(ctx,state,{now,active:true,greetingDone:true,departureDistanceNm:5,flightData:{onGround:false,gForce:1,bankDeg:0,vsFpm:0,...fd}});
      state=result.state; effects.push(...result.effects);
    }
    return effects;
  };
  assert.equal(simulate({precipRateMmH:500}).length,0);
  assert.equal(simulate({precipState:2,precipActive:true,precipRateRaw:500}).length,0);
  const effects=simulate({precipState:4,precipRateRaw:500});
  assert.equal(effects.length,1); assert.match(effects[0].prompt,/Regen/);
  assert.doesNotMatch(effects[0].prompt,/Wetter für mich .*unruhig/);
  assert.match(effects[0].prompt,/Intensität ist nicht bestätigt/);
  assert.doesNotMatch(effects[0].prompt,/mm\/h|500/); assert.match(effects[0].debugDetail,/Regen/);
});
