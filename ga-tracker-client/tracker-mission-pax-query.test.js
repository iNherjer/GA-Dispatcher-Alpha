'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const core=require('../mission-pax-query-core.js');
const comfort=require('../mission-comfort-core.js');
const pax={hasPassenger:true,taskDomain:'private_return',baseContext:'Gemeinsame Heimreise',paxText:'1 PAX'};
test('manual query availability: weather always, cargo with cargo, wellbeing with a passenger',()=>{
 assert.deepEqual(core.available(pax,{}),['pax_wellbeing','pax_weather']);
 assert.deepEqual(core.available({...pax,isPoi:true},{}),['pax_weather']);
 const cargo={...pax,taskDomain:'cargo_fragile',cargoText:'Kühlbox (12 lbs)',paxText:'0',hasPassenger:false};
 assert.deepEqual(core.available(cargo,{}),['pax_cargo','pax_weather']);
 const reporter={...pax,taskDomain:'news_coverage',cargoText:'Journalistisches Audio-Equipment (18 lbs)'};
 assert.deepEqual(core.available(reporter,{}),['pax_wellbeing','pax_cargo','pax_weather']);
 assert.equal(core.render('pax_cargo',pax,{}),null);
 const calm=core.render('pax_weather',pax,{flightData:{windKts:3}});
 assert.match(calm.prompt,/loben/);
 assert.match(core.render('pax_weather',pax,{flightData:{windKts:24}}).prompt,/Wind 24 kt/);
 const missing=core.render('pax_cargo',cargo,{missingRequired:['Kühlbox']});
 assert.match(missing.prompt,/Fehlende Pflichtladung: Kühlbox/);
 assert.match(missing.fallbackText,/umkehren/);
});
test('cargo query names damage in words and skips aircraft equipment',()=>{
 const reporter={...pax,taskDomain:'news_coverage',cargoText:'Audio-Equipment (18 lbs)'};
 const manifestItems=[
  {id:'mic',label:'Richtmikrofon',status:'loaded',required:true,healthPct:30},
  {id:'bag',label:'Rucksack',status:'loaded',healthPct:100},
  {id:'bordbuch',label:'Bordbuch',status:'loaded',persistentEquipment:true,healthPct:10},
  {id:'pax',itemType:'passenger',status:'loaded'}];
 const result=core.render('pax_cargo',reporter,{manifestItems});
 assert.match(result.prompt,/Richtmikrofon \(Pflicht\): schwer beschaedigt/);
 assert.match(result.prompt,/Rucksack: unversehrt/);
 assert.doesNotMatch(result.prompt,/Bordbuch/);
 assert.doesNotMatch(result.prompt,/Prozent:|\d+ ?%/);
 assert.match(result.fallbackText,/Richtmikrofon hat etwas abbekommen/);
});
test('queries use measured comfort history and original weather attribution',()=>{
 let score=comfort.evaluate(null,{onGround:false,gForce:2.5,bankDeg:70,vsFpm:-2200},pax,1000);
 const result=core.render('pax_wellbeing',pax,{comfortState:score.state,flightData:{precipActive:true}});
 assert.doesNotMatch(result.prompt,/Score \d|\/100/);
 assert.match(result.prompt,/Magen/);
 assert.doesNotMatch(result.fallbackText,/\d/);
 assert.match(result.prompt,/Pilot-Events/);
 assert.match(result.prompt,/nicht dem Piloten/);
 assert.match(result.prompt,/Niederschlag/);
});
