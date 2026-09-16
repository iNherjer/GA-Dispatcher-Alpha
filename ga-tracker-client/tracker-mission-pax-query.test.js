'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const core=require('../mission-pax-query-core.js');
const comfort=require('../mission-comfort-core.js');
const pax={hasPassenger:true,taskDomain:'private_return',baseContext:'Gemeinsame Heimreise',paxText:'1 PAX'};
test('manual query availability preserves standalone APT, cargo, POI and significant-weather rules',()=>{
 assert.deepEqual(core.available(pax,{}),['pax_wellbeing']);
 assert.deepEqual(core.available({...pax,isPoi:true},{}),[]);
 assert.deepEqual(core.available({...pax,isPoi:true},{precipActive:true}),['pax_weather']);
 const cargo={...pax,taskDomain:'cargo_fragile',cargoText:'Kühlbox (12 lbs)',paxText:'0'};
 assert.deepEqual(core.available(cargo,{}),['pax_cargo']);
 assert.equal(core.render('pax_cargo',pax,{}),null);
 assert.equal(core.render('pax_weather',pax,{flightData:{windKts:23}}),null);
 assert.match(core.render('pax_weather',pax,{flightData:{windKts:24}}).prompt,/Wind 24 kt/);
 const missing=core.render('pax_cargo',cargo,{missingRequired:['Kühlbox']});
 assert.match(missing.prompt,/Fehlende Pflichtladung: Kühlbox/);
 assert.match(missing.fallbackText,/umkehren/);
});
test('queries use measured comfort history and original weather attribution',()=>{
 let score=comfort.evaluate(null,{onGround:false,gForce:2.5,bankDeg:70,vsFpm:-2200},pax,1000);
 const result=core.render('pax_wellbeing',pax,{comfortState:score.state,flightData:{precipActive:true}});
 assert.match(result.prompt,new RegExp(`Score ${score.summary.comfortScore}/100`));
 assert.match(result.prompt,/Pilot-Events/);
 assert.match(result.prompt,/nicht dem Piloten/);
 assert.match(result.prompt,/Niederschlag/);
});
