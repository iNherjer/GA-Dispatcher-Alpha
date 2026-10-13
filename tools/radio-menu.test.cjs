const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('checklists.js','utf8');
const start=source.indexOf('    function radioCtrAirport(as)');
const end=source.indexOf('    function getProblemAirspaces()',start);
const box=(west,east,south=-1,north=1)=>({type:'Polygon',coordinates:[[[west,south],[east,south],[east,north],[west,north],[west,south]]]});
const route=[{lat:0,lon:0},{lat:0,lon:10}];
function rows(items, testRoute=route){
 const activeAirspaces=items.map(as=>({...as,geometry:as.geometry || box(1,2)}));
 const context={activeAirspaces,getRoutePoints:()=>testRoute,pickAirportForAirspaceFallback:()=>({icao:'EDDS'}),getFreqLines:()=>[{label:'ATIS',value:'126.130'}]};
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

test('unit-bearing Radio fields create numeric intents, preserving labels and strict validation',()=>{
 const core=require('../radio-tuning-core');
 const start=source.indexOf('    function radioFrequencyHtml('),end=source.indexOf('    function renderFreqBlock(',start);
 const context={GARadioTuningCore:core,escapeHtml:core.escape};vm.createContext(context);vm.runInContext(source.slice(start,end),context);
 const cases=[['125.180 MHz','COM','125.180'],['127,155 MHz','COM','127.155'],['110.500 MHz','NAV','110.500'],['350.5 kHz','ADF','350.5'],['0042','XPDR','0042']];
 for(const [display,kind,value] of cases){const html=context.radioFrequencyHtml(display,kind);assert.ok(html.includes('data-radio-value="'+value+'"'));assert.ok(html.includes(core.escape(display.replace(/\s*(MHz|kHz)$/i,''))));assert.ok(!/>[^<]*(?:MHz|kHz)/i.test(html));}
 for(const [display,kind] of [['42X','COM'],['123.450 kHz','COM'],['350.5 MHz','ADF'],['0082','XPDR'],['136.995 MHz','COM']])assert.ok(!context.radioFrequencyHtml(display,kind).includes('data-radio-value'));
});
test('Radio can display its own HX snapshot without altering warning selection',()=>{
 const fixture=[{id:'hx-altdorf',name:'CTR SEKTOR ALTDORF (HX)',type:0,icaoClass:3,frequencies:[{name:'LAHR TWR',value:'125.180 MHz'}]},{id:'hx-offenburg',name:'CTR SEKTOR OFFENBURG (HX)',type:0,icaoClass:3,frequencies:[{name:'OFFENBURG RADIO',value:'132.040 MHz'}]}];
 const context={activeAirspaces:[],pickAirportForAirspaceFallback:()=>null,getFreqLines:()=>[]};vm.createContext(context);vm.runInContext(source.slice(start,end),context);
 fixture.forEach(as=>as.geometry=box(1,2));
 const before=JSON.stringify(fixture);const result=context.airspaceFreqRows(fixture,route);
 assert.equal(result.length,2);assert.equal(result[0].idx,0);assert.equal(result[1].idx,1);assert.equal(context.activeAirspaces.length,0);assert.equal(JSON.stringify(fixture),before);
});

test('only crossed polygons are listed, ordered by first route encounter rather than type',()=>{
 const freq=[{name:'INFO',value:'123.450'}];
 const result=rows([
  {name:'CTR LATE',type:4,frequencies:freq,geometry:box(8,9)},
  {name:'EARLY TMA',type:7,icaoClass:3,frequencies:freq,geometry:box(2,3)},
  {name:'OFF ROUTE',type:7,icaoClass:3,frequencies:freq,geometry:box(1,2,2,3)},
  {name:'CTR MIDDLE',type:4,frequencies:freq,geometry:box(5,6)},
  {name:'START FIS',type:33,frequencies:freq,geometry:box(-1,1)}
 ]);
 assert.deepEqual(result.map(r=>r.title),['START FIS','EARLY TMA','CTR MIDDLE','CTR LATE']);
 const reverse=rows([
  {name:'WEST',type:7,icaoClass:3,frequencies:freq,geometry:box(1,2)},
  {name:'EAST CTR',type:4,frequencies:freq,geometry:box(8,9)}
 ],[...route].reverse());assert.deepEqual(reverse.map(r=>r.title),['EAST CTR','WEST']);
});
test('grouped sectors use earliest encounter; units normalize but differing frequencies and CTR stay separate',()=>{
 const make=(name,type,value,west)=>({name,type,icaoClass:3,frequencies:[{name:'INFO',value}],geometry:box(west,west+0.2)});
 const result=rows([make('REGION',7,'128.950 MHz',8),make('CTR SAME',4,'123.450',5),make('REGION',7,'128.950',2),make('CTR SAME',4,'123.450',6),make('REGION',7,'125.000',4)]);
 assert.deepEqual(result.map(r=>r.title),['REGION','REGION','CTR SAME','CTR SAME']);assert.equal(result[0].count,2);assert.equal(result[0].routeOrder,0.2);assert.equal(result[0].idx,2);
});
test('thin crossings, holes, multipolygons and bent routes are handled without vertex sampling',()=>{
 const context={};vm.createContext(context);vm.runInContext(source.slice(start,end),context);
 const first=(geometry,points=route)=>context.radioAirspaceRouteOrder({geometry},points);
 assert.ok(Math.abs(first(box(4.01,4.02))-.401)<1e-9);
 const hole=box(-2,12);hole.coordinates.push(box(-1,11).coordinates[0]);assert.equal(first(hole),null);
 assert.equal(first({type:'MultiPolygon',coordinates:[box(20,21).coordinates,box(3,4).coordinates]}),.3);
 assert.equal(first(box(5,6),[{lat:0,lon:0},{lat:2,lon:0},{lat:2,lon:10}]),null);
 assert.equal(first(box(5,6,1,3),[{lat:0,lon:0},{lat:2,lon:0},{lat:2,lon:10}]),1.5);
 assert.equal(first(null),null);
});
test('the Radio list does not truncate later crossed areas after 18 rows',()=>{
 const result=rows(Array.from({length:22},(_,i)=>({name:'CTR '+i,type:4,frequencies:[{name:'TOWER',value:'123.450'}],geometry:box(i/3,i/3+.1)})));
 assert.equal(result.length,22);
});

test('legacy Information cache is refreshed from source, while confirmed INFO stays INFO',()=>{
 const core=require('../radio-tuning-core');
 const a=source.indexOf('    function getFreqLines('),b=source.indexOf('    function getRunwayText(',a);
 const context={freqCache:{EDDS:[{label:'Information',value:'126.130'}],TEST:[{label:'Information',value:'123.450',labelVersion:2}]}};
 vm.createContext(context);vm.runInContext(source.slice(a,b),context);
 assert.equal(context.radioAirportNeedsFrequencyLoad('EDDS'),true);assert.equal(context.radioAirportNeedsFrequencyLoad('TEST'),false);
 context.freqCache.EDDS=[{label:'ATIS',value:'126.130',type:15,labelVersion:2}];
 assert.equal(context.radioAirportNeedsFrequencyLoad('EDDS'),false);
});

test('Radio distance includes the flown leg, not just its endpoints',()=>{
 const a=source.indexOf('    function distancePointToRouteNm('),b=source.indexOf('    async function fetchRouteOpenAip(',a);
 const context={navBetween:(lat,lon,lat2,lon2)=>({dist:Math.hypot(lat-lat2,lon-lon2)*60})};vm.createContext(context);vm.runInContext(source.slice(a,b),context);
 assert.equal(context.distancePointToRouteNm(0,5,[{lat:0,lon:0},{lat:0,lon:10}]),0);
 assert.equal(context.distancePointToRouteNm(.1,5,[{lat:0,lon:0},{lat:0,lon:10}]),6);
 assert.equal(context.distancePointToRouteNm(0,11,[{lat:0,lon:0},{lat:0,lon:10}]),60);
});
test('late old-route result cannot overwrite the new Radio snapshot',async()=>{
 const a=source.indexOf('    async function ensureRadioTool('),b=source.indexOf('    function renderAirportContext(',a);
 let key='old',resolveOld;
 const entry={key:'',data:null,loading:false,controller:null};
 const nav=name=>[{name,type:3,frequency:{value:'113.000'},geometry:{coordinates:[.5,0]}}];
 const context={AbortController,toolState:{radio:entry},state:{view:'radio'},window:{gaChecklistHost:{},GANavigationWarnings:{prepareAirspaces:()=>[]}},
  getRouteKey:()=>key,isCacheFresh:()=>false,abortToolRequest:()=>entry.controller?.abort(),render:()=>{},
  getRoutePoints:()=>[{lat:0,lon:0},{lat:0,lon:1}],getCurrentAirport:()=>({icao:''}),getFreqLines:()=>[],fetchAirportFreq:async()=>{},
  radioAirportNeedsFrequencyLoad:()=>false,radioCtrAirport:()=>null,activeAirspaces:[],globalAirports:{},
  routeBounds:()=>({key}),fetchRouteOpenAip:(path,bounds)=>path==='navaids'?(bounds.key==='old'?new Promise(resolve=>{resolveOld=resolve;}):Promise.resolve(nav('NEW'))):Promise.resolve([]),
  normalizeToolAirport:a=>a,distancePointToRouteNm:()=>0,getOpenAipNavaidTypeLabel:()=> 'VOR',GARadioTuningCore:require('../radio-tuning-core')};
 vm.createContext(context);vm.runInContext(source.slice(a,b),context);
 const pending=context.ensureRadioTool();for(let i=0;i<8&&!resolveOld;i++)await Promise.resolve();assert.ok(resolveOld);
 key='new';await context.ensureRadioTool();assert.equal(entry.data.navaids[0].name,'NEW');
 resolveOld(nav('OLD'));await pending;assert.equal(entry.data.navaids[0].name,'NEW');assert.equal(entry.key,'new');assert.equal(entry.loading,false);
});

test('failed legacy label refresh preserves usable saved frequencies',async()=>{
 const a=source.indexOf('    function getFreqLines('),b=source.indexOf('    function getRunwayText(',a);
 const old=[{label:'TOWER',value:'119.055'},{label:'Information',value:'126.130'}];
 const context={freqCache:{EDDS:old},fetchAirportFreq:async()=>{context.freqCache.EDDS=[];}};
 vm.createContext(context);vm.runInContext(source.slice(a,b),context);
 await context.loadRadioAirportFrequencies('EDDS');assert.deepEqual(Array.from(context.freqCache.EDDS),old);
});
