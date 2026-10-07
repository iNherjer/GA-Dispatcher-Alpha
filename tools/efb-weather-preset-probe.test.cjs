const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const ts=require(process.env.GA_TEST_TYPESCRIPT_PATH||'../ga-tracker-client/efb-app/PackageSources/VfrMultitool/node_modules/typescript');
function harness(withApi){
 let callback,now=100000;const intervals=new Map(),calls=[],messages=[];
 const listener={connected:true,on:(name,fn)=>{assert.equal(name,'UpdatePreset');callback=fn;},trigger:name=>calls.push(name),unregister:()=>calls.push('unregister')};
 const api={AppView:class {destroy(){}},App:class {},AppBootMode:{},AppSuspendMode:{},Efb:{use(){}}};
 const sdk={FSComponent:{createRef:()=>({getOrDefault:()=>null})}};
 const source=fs.readFileSync(require.resolve('../ga-tracker-client/efb-app/PackageSources/VfrMultitool/src/VfrMultitool.tsx'),'utf8');
 const built=ts.transpileModule(source+'\nexport { VfrMultitoolView };',{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2017,jsx:ts.JsxEmit.React}});
 const context={exports:{},require:name=>name==='@efb/efb-api'?api:name==='@microsoft/msfs-sdk'?sdk:name.includes('map-shell-core')?{default:require('../ga-tracker-client/efb-app/map-shell-core.js')}:{},window:{},console,Date:class extends Date {static now(){return now;}},
 EFB_APP_VERSION:'test',TRACKER_API_URL:'http://127.0.0.1:49880',setInterval:fn=>{intervals.set(1,fn);return 1;},clearInterval:id=>intervals.delete(id)};
 if(withApi)context.RegisterViewListener=(name)=>{assert.equal(name,'JS_LISTENER_WEATHER');return listener;};
 vm.runInNewContext(built.outputText,context);
 const view=new context.exports.VfrMultitoolView();view.serverFrameChannel='channel';view.serverFrameRef={getOrDefault:()=>({contentWindow:{postMessage:(msg,target)=>messages.push({msg,target})}})};
 view.reportServerFrameEvent=()=>{};view.deactivate=()=>{};
 return {view,calls,messages,intervals,reply:preset=>callback(preset),advance:ms=>{now+=ms;intervals.forEach(fn=>fn());}};
}
test('native EFB without simulator weather API is an inert optional probe',()=>{const h=harness(false);assert.doesNotThrow(()=>h.view.startWeatherPresetProbe());assert.equal(h.intervals.size,0);assert.equal(h.messages.length,0);});
test('native EFB asks only for current preset, publishes channel-bound observations, and invalidates missing replies',()=>{
 const h=harness(true);h.view.startWeatherPresetProbe();h.reply({index:0,sPresetName:'Live'});
 assert.equal(h.messages.at(-1).msg.preset.index,0);assert.equal(h.messages.at(-1).msg.channel,'channel');assert.equal(h.messages.at(-1).target,'http://127.0.0.1:49880');
 h.reply({index:7,sPresetName:'Storm'});assert.equal(h.messages.at(-1).msg.preset.index,7);assert.equal(h.messages.at(-1).msg.preset.name,'Storm');
 h.advance(13000);assert.equal(h.messages.at(-1).msg.preset,null);assert.ok(h.calls.every(name=>name==='ASK_UPDATE_PRESET'));
 h.view.onPause();assert.equal(h.intervals.size,1);h.view.destroy();assert.equal(h.intervals.size,0);assert.equal(h.calls.at(-1),'unregister');
});
