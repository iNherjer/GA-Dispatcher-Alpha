const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../passenger-voice.js'),'utf8');
const gate=source.slice(source.indexOf('function _paxCanGenerateVoice()'),source.indexOf('window.paxVoiceSetGenerationEnabled'));
const request=source.slice(source.indexOf('async function _requestTTSAudio(text,'),source.indexOf('function _prepareTextAsTTS('));
for(const central of [true,false])test('standalone speech gate blocks all requests: '+(central?'central setting':'local preference'),async()=>{
 const context={window:central?{gaPaxVoiceGenerationEnabled:()=>false}:{},localStorage:{getItem:()=> '0'},fetch:()=>assert.fail('No provider request allowed')};
 vm.createContext(context);vm.runInContext(gate+request,context);
 assert.equal(await vm.runInContext('_requestTTSAudio("Kein neues Audio")',context),null);
});
test('missing saved generation preference defaults on',()=>{
 const context={window:{},localStorage:{getItem:()=>null}};vm.createContext(context);vm.runInContext(gate,context);
 assert.equal(vm.runInContext('_paxCanGenerateVoice()',context),true);
});
