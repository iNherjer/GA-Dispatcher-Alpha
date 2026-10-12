'use strict';
const test=require('node:test'), assert=require('node:assert/strict'), fs=require('node:fs'), vm=require('node:vm');
const source=fs.readFileSync(__dirname+'/tracker-efb-kartentisch-host.js','utf8');
// Execute the actual banner/transfer handlers with a small DOM and controllable start ACK.
function harness() {
  const nodes={}, listeners={}, posted=[], logs=[], timers=new Map();let timer=0;
  function node(id) {return nodes[id] ||= {id,style:{},children:[],classList:{add(){},remove(){}},
    getAttribute(){return null;},setAttribute(){},querySelector(){return null;},appendChild(child){this.children.push(child);if(child.id)nodes[child.id]=child;}};}
  const banner=node('missionStartBanner');banner.parentNode={appendChild(child){nodes[child.id]=child;}};
  const parent={postMessage:value=>posted.push(value)};
  const context={Date,Math,Promise,Array,Object,JSON,String,Error,document:{createElement:()=>node('temporary-'+Math.random())},
    window:{parent,__gaEfbChannel:'channel',addEventListener:(name,handler)=>listeners[name]=handler},
    setInterval(){},setTimeout:fn=>{timers.set(++timer,fn);return timer;},clearTimeout:id=>timers.delete(id),
    byId:id=>nodes[id]||null,report:(...values)=>logs.push(values),
    renderMissionActionBanner(){},openCargoManager(){},submitMissionIntent(){},
    missionSnapshot:{control:{missionId:'m',runId:'r'}},mapSnapshot:{missionId:'m',routeEdit:{revision:0}},
    missionIntentPending:false,missionIntentStatus:'',missionIntentTone:'',missionBannerDismissedKey:'',
    missionActionBannerModel:()=>banner._gaMissionActionModel,
    setText:(id,text)=>{node(id).textContent=text;}};
  vm.createContext(context);
  const bridge=source.slice(source.indexOf('  var flightPlanBridgeReadyUntil'),source.indexOf('  var cargoManagerOpen'));
  const setup=source.slice(source.indexOf('  function setupMissionActionBanner()'),source.indexOf('  function missionToolbarProjection('));
  const render=source.slice(source.indexOf('  function renderMissionActionBanner(payload)'),source.indexOf('  function updateMissionLiveFields('));
  vm.runInContext(bridge+setup+render+'\nsetupMissionActionBanner();',context);
  banner._gaMissionActionModel={intent:'prepare_mission',kind:'intent',key:'m:planned',button:'Mission starten'};
  let resolveStart;
  const starts=[],exports=[];
  context.requestMissionIntent=intent=>{starts.push(intent);return new Promise(resolve=>{resolveStart=resolve;});};
  context.window.gaCockpitSessionClient={submitTool:async req=>{exports.push(req);return {ok:true,plan:{routeHash:'hash'}};}};
  function capability(data={}) {listeners.message({source:parent,data:{type:'ga-flightplan-capabilities',channel:'channel',host:'efb',ready:true,...data}});}
  return {context,banner,nodes,parent,listeners,posted,logs,starts,exports,capability,
    resolveStart:ok=>resolveStart(ok),flush:()=>new Promise(resolve=>setImmediate(resolve))};
}
test('extra buttons require a matching native parent/channel, expire and exist only on the first start banner',()=>{
  const h=harness();h.context.renderMissionActionBanner(h.context.missionSnapshot);
  assert.equal(h.nodes.gaFlightPlanStartActions.style.display,'none');
  h.listeners.message({source:{},data:{type:'ga-flightplan-capabilities',channel:'channel',host:'efb',ready:true}});
  assert.equal(h.nodes.gaFlightPlanStartActions.style.display,'none');
  h.capability({channel:'old'});assert.equal(h.nodes.gaFlightPlanStartActions.style.display,'none');
  h.listeners.message({source:null,origin:'https://evil.test',data:{type:'ga-flightplan-capabilities',channel:'channel',host:'efb',ready:true}});
  assert.equal(h.nodes.gaFlightPlanStartActions.style.display,'none');
  h.listeners.message({source:null,origin:'coui://html_ui',data:{type:'ga-flightplan-capabilities',channel:'channel',host:'toolbar',ready:true}});
  assert.equal(h.nodes.gaFlightPlanStartActions.style.display,'flex');
  h.capability();assert.equal(h.nodes.gaFlightPlanStartActions.style.display,'flex');
  h.banner._gaMissionActionModel.intent='start_mission';h.context.renderMissionActionBanner(h.context.missionSnapshot);
  assert.equal(h.nodes.gaFlightPlanStartActions.style.display,'none');
  h.banner._gaMissionActionModel.intent='prepare_mission';h.capability({ready:false});assert.equal(h.nodes.gaFlightPlanStartActions.style.display,'none');
});
test('plain start never exports; selected export waits for successful existing start without becoming a start gate',async()=>{
  const h=harness();h.capability();h.context.window.handleMissionStartBannerAction();
  assert.deepEqual(h.starts,['prepare_mission']);h.resolveStart(true);await h.flush();assert.equal(h.exports.length,0);
  h.context.window.handleMissionStartFlightPlanAction('avionics');assert.equal(h.exports.length,0);
  h.resolveStart(true);await h.flush();assert.equal(h.exports.length,1);
  assert.equal(h.exports[0].intent,'flightplan_export');assert.equal(h.posted[0].job.target,'avionics');
});
test('rejected start never exports and missing bridge after accepted start reports only an export error',async()=>{
  const h=harness();h.capability();h.context.window.handleMissionStartFlightPlanAction('msfs');h.resolveStart(false);await h.flush();assert.equal(h.exports.length,0);
  h.context.window.handleMissionStartFlightPlanAction('msfs');h.capability({ready:false});h.resolveStart(true);await h.flush();
  assert.equal(h.exports.length,0);assert.match(h.nodes.gaFlightPlanStatus.textContent,/unabhängig weiter/);
});
test('export failure is a status message and never replays start',async()=>{
  const h=harness();h.capability();h.context.window.gaCockpitSessionClient.submitTool=async()=>{throw new Error('offline');};
  h.context.window.handleMissionStartFlightPlanAction('msfs');h.resolveStart(true);await h.flush();
  assert.equal(h.starts.length,1);assert.match(h.nodes.gaFlightPlanStatus.textContent,/fehlgeschlagen/);
  assert.ok(h.logs.some(entry=>entry.includes('result')));
});
