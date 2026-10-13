const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('checklists.js','utf8');
const start=source.indexOf('    function radioCtrAirport(as)');
const end=source.indexOf('    function getProblemAirspaces()',start);
function rows(activeAirspaces){
 const context={activeAirspaces,pickAirportForAirspaceFallback:()=>({icao:'EDDS'}),getFreqLines:()=>[{label:'ATIS',value:'126.130'}]};
 vm.createContext(context);vm.runInContext(source.slice(start,end)+';result=airspaceFreqRows();',context);
 return JSON.parse(JSON.stringify(context.result));
}
test('same C/D sectors combine while CTR, FIS and different frequencies stay separate',()=>{
 const f=value=>[{name:'LANGEN INFORMATION',value}];
 const result=rows([
  {name:'STUTTGART',type:7,icaoClass:2,frequencies:f('128.950')},
  {name:'STUTTGART',type:7,icaoClass:3,frequencies:f('128.950')},
  {name:'STUTTGART',type:7,icaoClass:3,frequencies:f('128.950')},
  {name:'CTR STUTTGART',type:4,icaoClass:3,frequencies:[{name:'TOWER',value:'119.055'}]},
  {name:'STUTTGART',type:7,icaoClass:3,frequencies:f('125.000')},
  {name:'OTHER',type:7,icaoClass:3,frequencies:f('128.950')},
  {name:'FIS',type:33,frequencies:f('128.950')}
 ]);
 assert.equal(result.length,5);assert.match(result[0].meta,/C\/D · 3/);
 assert.equal(result[1].idx,3);assert.match(result[1].values,/TOWER 119.055 · ATIS 126.130/);
});
test('grouping happens before display limit and preserves all frequencies',()=>{
 const items=Array.from({length:25},()=>({name:'STUTTGART',type:7,icaoClass:3,frequencies:[{name:'INFO',value:'128.950'}]}));
 items.push({name:'CTR STUTTGART',type:4,icaoClass:3,frequencies:[1,2,3,4].map(i=>({name:'TOWER',value:`119.${i}00`}))});
 const before=JSON.stringify(items);const result=rows(items);
 assert.equal(result.length,2);assert.match(result[1].values,/119.400.*ATIS/);assert.equal(JSON.stringify(items),before);
});
test('ATIS from airport data is labeled and rendered as a tunable COM value',async()=>{
 const core=require('../radio-tuning-core');
 const context={window:{fetch:()=>{},gaGetAviationCollectionForBounds:async()=>[{icaoCode:'EDDS',frequencies:[{name:'TWR',value:'119.055'},{name:'Weather broadcast',type:15,value:'126.130'}]}]},document:{getElementById:()=>null},globalAirports:{EDDS:{lat:48.69,lon:9.22}},freqCache:{},GARadioTuningCore:core};
 vm.createContext(context);vm.runInContext(fs.readFileSync('airport-radio.js','utf8'),context);
 await context.fetchAirportFreq('EDDS',null,null);
 assert.equal(context.freqCache.EDDS[1].label,'ATIS');assert.match(core.html(context.freqCache.EDDS[1].value,'COM'),/data-radio-kind="COM"/);
});
