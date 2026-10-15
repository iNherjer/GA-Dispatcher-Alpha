'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
function fixture(file='media-player-client.js',active=false){
 let at=0,interval,display;
 const elements={};const element=()=>({checked:false,value:'',hidden:false,options:[],get firstChild(){return null;},add(option){this.options.push(option);}});
 const host={getBoundingClientRect:()=>({width:800,height:600})},menu={insertBefore(){},firstChild:null};
 const container={querySelector(key){return elements[key]||(elements[key]=element());}};
 const root={gaMediaRequest:()=>new Promise(()=>{}),addEventListener(){},getComputedStyle:()=>({visibility:'visible'}),GAMediaPlayerUI:{create:options=>({update(value){display=value;},setEnabled(){if(active)options.onVisibilityChange(true);}})}};
 const context={window:root,document:{readyState:'complete',getElementById:id=>id==='mapTableOverlay'?host:menu,createElement:()=>container,hidden:false},localStorage:{getItem:()=>active?'\u007b"enabled":true\u007d':null},Date:{now:()=>at},setInterval(fn){interval=fn;},clearInterval(){},setTimeout(){},clearTimeout(){},Option:function(name,value){this.name=name;this.value=value;}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../../..',file),'utf8'),context);
 return {receive:root.gaMediaPlayerClient.receive,tick(ms){at+=ms;interval();},get display(){return display;}};
}
const sample=extra=>({ok:true,serverId:'server',revision:1,source:'chrome.exe',players:[{source:'chrome.exe',name:'Chrome'}],playing:true,positionSeconds:null,durationSeconds:null,controls:{play:true,pause:true},...extra});
for(const playing of [true,false])test('unchanged successful watches keep controls connected beyond 45 seconds, playing='+playing,()=>{
 const f=fixture();f.receive(sample({playing}));
 for(let n=0;n<8;n++){f.tick(15000);f.receive({ok:true,changed:false,revision:1});assert.equal(f.display.connected,true);assert.equal(f.display.playing,playing);}
 f.tick(46000);assert.equal(f.display.connected,false,'actual silence must still disconnect');
 f.receive({ok:true,changed:false,revision:1});assert.equal(f.display.connected,true);
});
test('heartbeats do not reset playback anchor and missing duration does not stop extrapolation',()=>{
 const f=fixture();f.receive(sample({positionSeconds:100,positionKind:'native'}));f.tick(10000);f.receive({ok:true,changed:false});
 assert.equal(f.display.positionSeconds,110);assert.equal(f.display.durationSeconds,null);
 f.tick(5000);f.receive({ok:true,changed:false});assert.equal(f.display.positionSeconds,115);
 f.receive(sample({revision:2,playing:false,positionSeconds:115}));f.tick(15000);f.receive({ok:true,changed:false});assert.equal(f.display.positionSeconds,115);
 f.receive(sample({revision:3,positionSeconds:200,durationSeconds:250}));assert.equal(f.display.positionSeconds,200);
});
for(const file of ['media-player-client.js','ga-tracker-client/efb-web-assets/media-player-client.js'])test('actual client recovers transport and mixer after failed request plus unchanged heartbeat: '+file,()=>{
 const f=fixture(file);f.receive(sample({volumeAvailable:true,positionSeconds:10}));f.receive({ok:false,error:'temporary'});
 assert.equal(f.display.connected,false);assert.equal(f.display.volumeAvailable,false);
 f.tick(10000);f.receive({ok:true,changed:false});assert.equal(f.display.connected,true);assert.equal(f.display.playing,true);assert.equal(f.display.volumeAvailable,true);assert.equal(f.display.positionSeconds,20);
});
for(const file of ['media-player-client.js','ga-tracker-client/efb-web-assets/media-player-client.js'])test('visible clock ticks each second between 15-second synchronization anchors: '+file,()=>{
 const f=fixture(file,true);f.receive(sample({positionSeconds:90,durationSeconds:null}));
 for(let second=1;second<=15;second++){f.tick(1000);assert.equal(f.display.positionSeconds,90+second);}
 f.receive(sample({revision:2,positionSeconds:104}));f.tick(1000);assert.equal(f.display.positionSeconds,105);
});
