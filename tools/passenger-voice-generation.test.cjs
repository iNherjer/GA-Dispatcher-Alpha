const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../passenger-voice.js'),'utf8');
const gate=source.slice(source.indexOf('function _paxCanGenerateVoice()'),source.indexOf('let _paxAudioEffectsEnabled'));
const request=source.slice(source.indexOf('async function _requestTTSAudio(text,'),source.indexOf('function _prepareTextAsTTS('));
for(const central of [true,false])test('standalone speech gate blocks all requests: '+(central?'central setting':'local preference'),async()=>{
 const context={window:central?{gaPaxVoiceEnabled:()=>false}:{},_paxVoiceEnabled:false,localStorage:{getItem:()=> '0'},fetch:()=>assert.fail('No provider request allowed')};
 vm.createContext(context);vm.runInContext(gate+request,context);
 assert.equal(await vm.runInContext('_requestTTSAudio("Kein neues Audio")',context),null);
});
test('missing saved generation preference defaults on',()=>{
 const context={window:{},_paxVoiceEnabled:true,localStorage:{getItem:()=>null}};vm.createContext(context);vm.runInContext(gate,context);
 assert.equal(vm.runInContext('_paxCanGenerateVoice()',context),true);
});

test('remote synchronization updates existing runtime flag without replaying old text',()=>{
 const setter=source.slice(source.indexOf('window.paxVoiceSetEnabled ='),source.indexOf('function _syncPaxAudioEffectsControl'));
 const saved=new Map([['awm_pax_voice','0']]);
 const context={window:{activePassenger:{}},_paxVoiceEnabled:false,_lastSpokenText:'Alte Nachricht',localStorage:{getItem:k=>saved.get(k),setItem:(k,v)=>saved.set(k,v)},setTimeout:()=>assert.fail('No replay during remote sync'),_missionHasPax:()=>true};
 vm.createContext(context);vm.runInContext(setter,context);
 context.window.paxVoiceSetEnabled(true,{sync:true});assert.equal(context._paxVoiceEnabled,true);assert.equal(saved.get('awm_pax_voice'),'1');
 context.window.paxVoiceSetEnabled(false,{sync:true});assert.equal(context._paxVoiceEnabled,false);assert.equal(saved.get('awm_pax_voice'),'0');
});
