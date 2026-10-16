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
    requestSideDrawerRefresh(){},renderMissionActionBanner(){},openCargoManager(){},submitMissionIntent(){},
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
  context.window.gaCockpitSessionClient={submitTool:async req=>{exports.push(req);return {ok:true,plan:{routeHash:'hash',navigationRevision:0}};}};
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
test('manual mission buttons use current route revision and never issue mission intents',async()=>{
  const h=harness();h.capability();h.context.mapSnapshot.routeEdit.revision=7;
  h.context.window.gaCockpitSessionClient.submitTool=async req=>{h.exports.push(req);return {ok:true,plan:{routeHash:'latest',navigationRevision:7}};};
  assert.match(h.context.flightPlanTransferMarkup(),/Flugplan an MSFS und Avionik senden/);
  await h.context.transferCurrentMissionFlightPlan('avionics');
  assert.equal(h.starts.length,0);assert.equal(h.exports[0].payload.navigationRevision,7);
  assert.equal(h.posted[0].job.plan.routeHash,'latest');assert.equal(h.posted[0].job.target,'avionics');
  assert.match(h.context.flightPlanTransferMarkup(),/disabled/);
  await h.context.transferCurrentMissionFlightPlan('msfs');assert.equal(h.exports.length,1);
});
test('manual actions disappear without a native bridge or active mission and closed missions cannot send',async()=>{
  const h=harness();assert.equal(h.context.flightPlanTransferMarkup(),'');
  h.capability();h.context.missionSnapshot.control.phase='closed';
  assert.equal(h.context.flightPlanTransferMarkup(),'');await h.context.transferCurrentMissionFlightPlan('msfs');assert.equal(h.exports.length,0);
  h.context.missionSnapshot.control.phase='active';h.context.missionSnapshot.cloudPending=true;
  assert.equal(h.context.flightPlanTransferMarkup(),'');
});
test('manual response for a changed route is rejected before simulator writes; failed export remains retryable',async()=>{
  const h=harness();h.capability();
  h.context.window.gaCockpitSessionClient.submitTool=async()=>{h.context.mapSnapshot.routeEdit.revision=1;return {ok:true,plan:{routeHash:'old',navigationRevision:0}};};
  assert.equal(await h.context.transferCurrentMissionFlightPlan('msfs'),false);assert.equal(h.posted.length,0);
  assert.match(h.nodes.gaFlightPlanStatus.textContent,/fehlgeschlagen/);assert.doesNotMatch(h.context.flightPlanTransferMarkup(),/disabled/);
  h.context.window.gaCockpitSessionClient.submitTool=async()=>{throw Error('offline');};
  assert.equal(await h.context.transferCurrentMissionFlightPlan('msfs'),false);assert.equal(h.starts.length,0);
});
function worldMapHarness() {
 const h=harness();h.context.missionSnapshot={missionId:'m',available:true,control:{executionAuthority:'tracker',missionId:'m',runId:'r',phase:'planned',startReadiness:{worldReady:false,ready:false,cameraState:12,observedAt:Date.now()}}};
 h.capability({atcReady:true});return h;
}
test('World Map menu offers pure ATC planning and never begins the mission',async()=>{
 const h=worldMapHarness();h.context.renderMissionActionBanner(h.context.missionSnapshot);
 assert.equal(h.banner._gaMissionActionModel.kind,'flightplan');assert.equal(h.nodes.gaFlightPlanStartActions.style.display,'none');
 await h.context.window.handleMissionStartBannerAction();assert.equal(h.starts.length,0);assert.equal(h.exports.length,1);assert.equal(h.posted[0].job.target,'atc');
});
test('planning action requires fresh menu state, verified ATC support, and the selected cloud mission',()=>{
 const h=worldMapHarness();assert.ok(h.context.preflightPlanningModel(h.context.missionSnapshot));
 h.capability({atcReady:false});assert.equal(h.context.preflightPlanningModel(h.context.missionSnapshot),null);h.capability({atcReady:true});
 for(const patch of [{worldReady:true},{cameraState:2},{observedAt:Date.now()-6000}]){
  const current=h.context.missionSnapshot.control.startReadiness;h.context.missionSnapshot.control.startReadiness={...current,...patch};
  assert.equal(h.context.preflightPlanningModel(h.context.missionSnapshot),null);h.context.missionSnapshot.control.startReadiness=current;
 }
 h.context.missionSnapshot.authoritySnapshot={cloudMissionControl:{status:'active',missionId:'other'}};
 assert.equal(h.context.preflightPlanningModel(h.context.missionSnapshot),null);
});
test('leaving World Map before export reply cannot submit ATC route',async()=>{
 const h=worldMapHarness();h.context.window.gaCockpitSessionClient.submitTool=async()=>{
  h.context.missionSnapshot.control.startReadiness={worldReady:true,ready:true,cameraState:2,observedAt:Date.now()};return{ok:true,plan:{routeHash:'hash',navigationRevision:0}};};
 assert.equal(await h.context.transferCurrentMissionFlightPlan('atc'),false);assert.equal(h.posted.length,0);assert.equal(h.starts.length,0);
});
test('ATC is never accepted as a combined mission-start/export action',()=>{
 const h=harness();h.capability({atcReady:true});h.context.window.handleMissionStartFlightPlanAction('atc');assert.equal(h.starts.length,0);assert.equal(h.exports.length,0);
});

test('planning banner stays disabled through stale telemetry and expired bridge leases without permitting writes',async()=>{
 const h=worldMapHarness();let at=Date.now();h.context.Date={now:()=>at};
 h.context.renderMissionActionBanner(h.context.missionSnapshot);assert.equal(h.banner.style.display,'flex');
 at+=6000;h.context.renderMissionActionBanner(h.context.missionSnapshot);
 assert.equal(h.banner.style.display,'flex');assert.equal(h.banner._gaMissionActionModel.kind,'wait');
 assert.equal(h.nodes.missionStartBannerBtn.disabled,true);
 assert.equal(await h.context.transferCurrentMissionFlightPlan('atc'),false);assert.equal(h.exports.length,0);
 h.capability({atcReady:false});h.context.renderMissionActionBanner(h.context.missionSnapshot);
 assert.equal(h.banner._gaMissionActionModel.kind,'wait');assert.equal(h.banner.style.display,'flex');
 h.context.missionSnapshot.control.startReadiness.observedAt=at;h.capability({atcReady:true});
 assert.equal(h.banner._gaMissionActionModel.kind,'flightplan');assert.equal(h.nodes.missionStartBannerBtn.disabled,false);
 h.context.missionSnapshot.authoritySnapshot={cloudMissionControl:{status:'active',missionId:'other'}};
 assert.equal(h.context.preflightPlanningModel(h.context.missionSnapshot,true),null);
 h.context.missionSnapshot.control.phase='closed';assert.equal(h.context.preflightPlanningModel(h.context.missionSnapshot,true),null);
});

test('an old start model becomes a disabled wait without retaining its intent',()=>{
 const h=harness();h.context.missionSnapshot.control.startReadiness={ready:true,observedAt:Date.now()-3000,cameraState:2};
 h.context.renderMissionActionBanner(h.context.missionSnapshot);
 assert.equal(h.banner.style.display,'flex');assert.equal(h.banner._gaMissionActionModel.kind,'wait');
 assert.equal(h.banner._gaMissionActionModel.intent,'');assert.equal(h.nodes.missionStartBannerBtn.disabled,true);
 h.context.window.handleMissionStartBannerAction();assert.equal(h.starts.length,0);
});
