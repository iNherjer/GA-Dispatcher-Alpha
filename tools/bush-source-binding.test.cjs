const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const core=require('../mission-bush-narrative-core.js');
const airportCore=require('../mission-airport-information-core.js');
const home={lat:44.8897,lon:-116.101},target={lat:45.133202,lon:-115.321999};
test('missing weather stays unavailable; story/history cannot populate real evidence',()=>{
 const basis=core.sourceBasis({story:'Heute Sonne, keine Infrastruktur, hohe Dichtehöhe.',history:['Sonnig'],environmentContext:{start:{status:'unavailable'},target:{status:'unavailable'}}});
 assert.equal(basis.weather.start.current,null);assert.equal(basis.weather.target.current,null);assert.equal(basis.airport,null);assert.deepEqual(basis.localSources,[]);assert.equal(basis.limits.narrativeIsEvidence,false);assert.ok(!JSON.stringify(basis).includes('Heute Sonne'));
});
test('partial weather retains measured zero, null, units, location and validity independently',()=>{
 const slot={status:'partial',source:'model fixture',location:target,units:{temperature_2m:'°C'},current:{validAt:'2026-10-08T08:00:00Z',values:{temperature_2m:0,cloud_cover:null}},forecastNext6Hours:{from:'2026-10-08T09:00:00Z',hours:[]}};
 const basis=core.sourceBasis({environmentContext:{target:slot}});
 assert.deepEqual(basis.weather.target.current,slot.current);assert.deepEqual(basis.weather.target.location,target);assert.equal(basis.weather.target.current.values.temperature_2m,0);assert.equal(basis.weather.target.current.values.cloud_cover,null);assert.deepEqual(basis.weather.target.units,slot.units);assert.deepEqual(basis.weather.target.forecastNext6Hours,slot.forecastNext6Hours);assert.equal(basis.weather.start.current,null);
});
test('local and general sources remain separate; a handbook cannot supply local facilities',()=>{
 const c=airportCore.context({ident:'U60',name:'Big Creek',...target,elevation:5743,runways:[{designator:'01/19',length:1082,surface:'Gras'}]},{wiki:{id:'wiki',kind:'wikipedia',extract:'Explicit supplied local source.'}});
 const b=core.sourceBasis({airportInfoContext:c});assert.equal(b.airport.elevationFt,5743);assert.equal(b.airport.runways[0].lengthM,1082);assert.deepEqual(b.localSources,[c.sources.find(s=>s.id==='wiki')]);assert.ok(b.localSources.every(s=>s.kind!=='pilot-handbook'));
});
test('chapter frame carries original evidence separately from poisoned narrative',()=>{
 const f=core.frame({bush:{homeRef:home,targetRef:target},passenger:{name:'Alex'},story:'Heute ist es sonnig; dort gibt es keine Einrichtungen.'});
 assert.equal(f.sourceBasis.weather.target.current,null);assert.equal(f.narrationBasis.liveObservationsAvailable,false);assert.equal(f.sourceBasis.limits.narrativeIsEvidence,false);assert.equal(f.sourceBasis.airport,null);
 assert.ok(core.prompt(f).includes(core.sourcePolicy));assert.ok(core.writerInstructions.includes(core.sourcePolicy));
});
test('production V4 planner applies Bush basis only to Bush; APT/POI prompt bytes remain identical',async()=>{
 const {setupContext,loadScript}=await import('./mission-pipeline-dryrun.mjs');
 const {declaration}=await import('./gemini-migration-harness.mjs');
 const {context}=setupContext(1);context.console={log(){},warn(){},error(){}};
 for(const f of ['datenbank.js','missions.js','data/mission-scene-assets.js','map-navigation-geometry.js','mission-bush-narrative-core.js','app.js'])loadScript(context,f);
 const old=require('node:child_process').execFileSync('git',['show','4d171afcd:app.js'],{maxBuffer:16*1024*1024}).toString();
 vm.runInContext(declaration(old,'_missionPipelineV4Prompt').replace('function _missionPipelineV4Prompt(','function beforePrompt('),context);
 for(const mode of ['apt','poi','bush']){
  for(const compact of [false,true]){
   context.__draft={mode};context.__bundle={};context.__options={compact};
   const before=vm.runInContext('beforePrompt(__draft,__bundle,__options)',context),after=vm.runInContext('_missionPipelineV4Prompt(__draft,__bundle,__options)',context);
   if(mode==='bush'){assert.notEqual(after,before);assert.ok(after.includes('BUSH_SOURCE_BASIS'));}else assert.equal(after,before);
  }
 }
});

test('own-data-only Bush airport description ignores invented AI facilities and runway suitability',()=>{
 const c=airportCore.context({ident:'U60',name:'Big Creek',...target,elevation:5743,runways:[{designator:'01/19',length:1082,width:34,surface:'Gras'}]});
 const m=airportCore.attach({s:'Persönliche Geschichte bleibt erhalten.'},{airportInformation:{flightBriefing:'Die Bahn ist ausreichend. Hohe Dichtehöhe.',destinationInfo:'Hier sind keine Einrichtungen; im National Forest.',sourceIds:['faa-mountain-tips']}},c);
 assert.equal(m.s,'Persönliche Geschichte bleibt erhalten.');assert.equal(m.airportInformation.generated,false);assert.equal(m.airportInformation.basis,'own-data-only');assert.equal(m.airportInformation.flightBriefing,airportCore.fallback(c).flightBriefing);assert.equal(m.airportInformation.destinationInfo,airportCore.fallback(c).destinationInfo);assert.ok(m.airportInformation.flightBriefing.includes('1082 m'));assert.ok(m.airportInformation.flightBriefing.includes('5743 ft'));
});
test('explicit local source still allows its existing sourced narrative path',()=>{
 const c=airportCore.context({ident:'U60',name:'Big Creek',...target},{wiki:{id:'wiki',kind:'wikipedia',extract:'There is a lodge.'}});
 const m=airportCore.attach({}, {airportInformation:{flightBriefing:'Big Creek Airport.',destinationInfo:'Die örtliche Quelle beschreibt eine Lodge.',sourceIds:['wiki']}},c);
 assert.equal(m.airportInformation.generated,true);assert.deepEqual(m.airportInformation.sourceIds,['wiki']);
});

test('empty FAA remarks are metadata, not local prose evidence; corrupt optional sources do not block voice prompts',()=>{
 const c=airportCore.context({ident:'U60',name:'Big Creek',...target},{faa:{ident:'U60',remarks:[]}});
 const m=airportCore.attach({}, {airportInformation:{flightBriefing:'Invented.',destinationInfo:'Invented.',sourceIds:['faa']}},c);assert.equal(m.airportInformation.basis,'own-data-only');
 assert.deepEqual(core.sourceBasis({airportInfoContext:{sources:{corrupt:true}}}).localSources,[]);assert.doesNotThrow(()=>core.sourcePrompt(null));
});
