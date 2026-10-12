'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),core=require('./radio-tuning-core');
test('COM channel designators retain all digits, while invalid channels/targets fail closed',()=>{
 for(const value of ['118.005','123.450','136.990']) assert.equal(core.normalize({kind:'COM',value}).encoded,Math.round(Number(value)*1e6));
 for(const value of ['118.020','118.045','118.070','118.095','117.950','137.000','123.456','123.45 MHz']) assert.throws(()=>core.normalize({kind:'COM',value}));
 for(const spec of [{kind:'COM',value:'123.450',index:3},{kind:'XPDR',value:'7000',slot:'standby'},{kind:'TACAN',value:'42'}]) assert.throws(()=>core.normalize(spec));
 assert.equal(core.event(core.normalize({kind:'COM',index:2,slot:'standby',value:'123.450'})),'COM2_STBY_RADIO_SET_HZ');
});
test('NAV/ADF event encoding and readback address the selected device/slot',()=>{
 assert.equal(core.event(core.normalize({kind:'NAV',index:2,slot:'standby',value:'110.50'})),'NAV2_STBY_SET_HZ');
 const adf=core.normalize({kind:'ADF',index:2,slot:'standby',value:'350.5'});
 assert.equal(adf.encoded,0x00350500);assert.equal(adf.expected,350500);
 assert.equal(core.event(adf),'ADF2_STBY_SET');assert.equal(core.variable(adf),'ADF STANDBY FREQUENCY:2');
 assert.throws(()=>core.normalize({kind:'NAV',value:'110.525'}));
 assert.equal(core.navaidKind('NDB'),'ADF');assert.equal(core.navaidKind('VORTAC'),'NAV');assert.equal(core.navaidKind('TACAN'),'');assert.equal(core.navaidKind('DME'),'');
});
test('squawk preserves leading zeros and rejects digits 8/9; only code event exists',()=>{
 const spec=core.normalize({kind:'XPDR',value:'0042'});
 assert.equal(spec.value,'0042');assert.equal(spec.encoded,0x42);assert.equal(spec.expected,0x42);assert.equal(spec.unit,'Bco16');assert.equal(core.event(spec),'XPNDR_SET');
 for(const value of ['42','7800','9999','7000 MHz']) assert.throws(()=>core.normalize({kind:'XPDR',value}));
});
test('explicit frequency fields escape labels and distinguish squawks; waypoint names only expose frequency suffix',()=>{
 assert.match(core.text('XPDR 7000 · INFO 123.450','COM'),/data-radio-kind="XPDR"/);
 assert.match(core.text('XPDR 7000 · INFO 123.450','COM'),/data-radio-kind="COM"/);
 assert.equal(core.html('42',''), '42');
 assert.match(core.html('123.450','COM','<img>'),/&lt;img&gt;/);
 assert.equal(core.waypoint('WP 123.450','COM'),'WP 123.450');
 assert.match(core.waypoint('APT TEST (123.450)','COM'),/data-radio-value="123.450"/);
 assert.match(core.waypoint('NDB TEST (350)','ADF'),/data-radio-kind="ADF"/);
});
test('snapped NDB/VOR type survives route normalization for App and EFB without name inference',()=>{
 const navpoints=require('./map-navpoint-core'),route=require('./map-route-edit-core');
 for(const [type,frequency,kind] of [[2,350,'ADF'],[3,110.5,'NAV'],[1,42,'']]){
  const point=navpoints.navaid({id:'test',type,name:'TEST',frequency:{value:frequency},geometry:{coordinates:[7.9,48.4]}},'static');
  assert.equal(point.radioKind,kind);
  const points=route.normalize([{lat:48,lng:7},point]);assert.equal(points[1].radioKind,kind);
 }
});
test('App transport gates old trackers and simulation mode, then sends an explicit radio intent with client identity',async()=>{
 const fs=require('node:fs'),vm=require('node:vm');
 const source=fs.readFileSync('sync.js','utf8');const start=source.indexOf('window.gaRadioTune = payload =>'),end=source.indexOf('window.gaNavigationAvailable =',start);
 const calls=[],window={liveTrackerConnected:true,liveTrackerCapabilities:[]};
 vm.runInNewContext(source.slice(start,end),{window,_missionAuthorityClientId:()=> 'client-test',_sendMissionAuthorityRequest:async command=>{calls.push(command);return {ok:true,confirmed:true};}});
 assert.equal((await window.gaRadioTune({kind:'XPDR',value:'7000'})).error,'radio_unavailable');
 window.liveTrackerCapabilities=['radio.tuning.v1'];window.simModeActive=true;
 assert.equal((await window.gaRadioTune({kind:'XPDR',value:'7000'})).error,'tracker_not_connected');assert.equal(calls.length,0);
 window.simModeActive=false;
 assert.equal((await window.gaRadioTune({kind:'XPDR',value:'0042'})).confirmed,true);
 assert.equal(calls[0].type,'radio_tuning_request');assert.equal(calls[0].clientId,'client-test');assert.equal(calls[0].payload.value,'0042');
});
