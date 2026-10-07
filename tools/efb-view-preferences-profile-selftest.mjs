import {createRequire} from 'node:module';import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),{chromium}=require(process.env.GA_PLAYWRIGHT_MODULE||'playwright');
const efb=require('../ga-tracker-client/tracker-efb-web-client');const {createDisplaySettingsControl}=require('../ga-tracker-client/tracker-efb-display-settings');
let config={},control;const restart=()=>control=createDisplaySettingsControl({readConfig:()=>structuredClone(config),writeConfig:c=>(config=c,true)});restart();
const browser=await chromium.launch({headless:true,...(process.env.GA_CHROME_EXECUTABLE?{executablePath:process.env.GA_CHROME_EXECUTABLE}:{})});
const mapFixture={context:{tasKts:120,profileCruiseFt:4500},route:{waypoints:[{lat:48.36,lon:7.83},{lat:48.45,lon:7.92}],totalDistanceNm:6},navigation:{activeLegIndex:0}};
let cases=0;
async function create(surface){const context=await browser.newContext({viewport:{width:838,height:883}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(()=>{window.ResizeObserver=undefined;window.__profilePaints=0;const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(...a){const c=get.apply(this,a);if(c&&this.id.startsWith('mapProfile')&&!c.__probe){const clear=c.clearRect;c.clearRect=function(...args){window.__profilePaints++;return clear.apply(this,args)};c.__probe=true;}return c;};window.prompt=()=>{throw Error('Native prompt is unsupported in the EFB fixture');};});
await page.route('**/*',async route=>{const p=new URL(route.request().url()).pathname;
if(p==='/')return route.fulfill({contentType:'text/html',body:efb.createTrackerEfbWebClientPage()});
if(p==='/api/v1/display/settings'){const command=route.request().postDataJSON();return route.fulfill({contentType:'application/json',body:JSON.stringify(command?control.update(command):{display:control.snapshot()})});}
if(p==='/api/v1/profile-data'){const d=route.request().postDataJSON();let value=[];if(d.kind==='terrain')value=d.points.map(p=>({...p,elevFt:600}));if(d.kind==='resource'&&d.url?.includes('airports.json'))value={};return route.fulfill({contentType:'application/json',body:JSON.stringify(value)});}
const a=efb.getTrackerEfbWebClientAsset(p);if(a){let body=a.body;if(p.endsWith('/host.js'))body=body.toString().replace(/\}\)\(\);\s*$/,`pollingClosed=true;window.__prefs={mode:setDisplayMode,scale:setEfbFontScale,flight:renderFlight,receive:applyUiPreferences,ready:function(){return !uiLoading&&!uiSaving&&!Object.keys(uiPending).length&&displaySettingsReady;},map:function(v){mapSnapshot=v;renderRoute(v);refreshLocalNavigation();renderProgress();renderProfile();}};})();`);return route.fulfill({contentType:a.contentType,body});}
return route.fulfill({contentType:'application/json',body:'{"available":false,"ok":true,"items":[]}'});});
await page.goto('http://127.0.0.1/');await page.waitForFunction(()=>window.__prefs?.ready());await page.evaluate(({surface,mapFixture})=>{__prefs.mode(false,surface);__prefs.map(mapFixture);__prefs.flight({available:true,lat:48.36,lon:7.83,alt:4500,hdg:90,capturedAt:Date.now(),flight:{gsKts:90,aglFt:3000}});},{surface,mapFixture});await page.waitForFunction(()=>vpElevationData?.length>1);return{page,context,errors};}
try {
let f=await create('physical');const first=f.page;
assert.equal(await first.evaluate(()=>vpMode),'HDG','known live speed activates HDG on the first snapshot');
await first.locator('#btnToggleVpMode').click();await first.waitForFunction(()=>__prefs.ready());assert.equal(control.snapshot().ui.profileMode,'ROUTE');
for(const key of ['telemetry','currentInfo','nextLeg','routeProgress','compass'])await first.evaluate(key=>toggleMapHint(key),key);
await first.waitForFunction(()=>__prefs.ready());assert.equal(control.snapshot().ui.telemetry,false);assert.equal(control.snapshot().ui.currentInfo,false);
await first.locator('#vpToggleBtn').click();await first.waitForFunction(()=>__prefs.ready());
await first.evaluate(m=>__prefs.map({...m,route:{...m.route,waypoints:[m.route.waypoints[0],{lat:48.46,lon:7.94}]}}),mapFixture);
await first.waitForTimeout(120);assert.equal(await first.locator('#mapProfileStrip').evaluate(n=>getComputedStyle(n).display),'none');assert.equal(await first.evaluate(()=>vpMapProfileVisible),false);
assert.ok((await first.locator('#vpToggleBtn').textContent()).includes('Aus'));
await f.context.close();restart();
for(const surface of ['physical','toolbar','popout']){
f=await create(surface);const p=f.page;assert.equal(await p.evaluate(()=>localStorage.getItem('ga_map_hint_telemetry')),'false');assert.equal(await p.evaluate(()=>isMapHintEnabled('telemetry')),false);assert.equal(await p.evaluate(()=>vpMode),'ROUTE');
for(const id of ['liveTelemetryBox','liveCurrentBox','liveNextWpBox'])assert.equal(await p.locator('#'+id).evaluate(n=>getComputedStyle(n).display),'none');
assert.equal(await p.locator('#mapProfileStrip').evaluate(n=>getComputedStyle(n).display),'none');await p.locator('#vpToggleBtn').click();await p.waitForFunction(()=>__prefs.ready());
// Buttons must invalidate without another flight poll, including the Y-axis and zoom.
for(const action of ['vpChangeAlt(500)','vpChangeRate(100)','vpChangeYAxis(1000)','vpZoom(-10)']){const before=await p.evaluate(()=>__profilePaints);await p.locator(`[onclick="${action}"]`).click();await p.waitForFunction(before=>__profilePaints>before,before);cases++;}
await p.locator('#altMapInput').click();await p.locator('#gaEfbProfileNumberInput').fill('5500');await p.locator('#gaEfbProfileNumber button[type=submit]').click();assert.equal(await p.locator('#altMapInput').textContent(),'5500');
await p.locator('#rateMapInput').click();await p.locator('#gaEfbProfileNumber button[type=button]').click();assert.equal(Number(await p.locator('#rateMapInput').textContent()),control.snapshot().ui.profileRateFpm);
// A stale status response cannot resurrect a disabled window after an ACK.
const before=control.snapshot();await p.evaluate(()=>toggleMapHint('telemetry'));await p.waitForFunction(()=>__prefs.ready());await p.evaluate(s=>__prefs.receive(s),before);assert.equal(await p.evaluate(()=>isMapHintEnabled('telemetry')),true);await p.evaluate(()=>toggleMapHint('telemetry'));await p.waitForFunction(()=>__prefs.ready());
for(const vr of [false,true])for(const scale of [.9,1.5,3]){await p.evaluate(({vr,scale})=>{__prefs.mode(vr);__prefs.scale(scale);},{vr,scale});await p.waitForTimeout(100);const state=await p.evaluate(()=>GAEfbUiScale.state());assert.equal(state.surface,surface);assert.equal(state.effective,scale*(vr&&surface!=='physical'?1.5:1));assert.equal(await p.evaluate(()=>isMapHintEnabled('telemetry')),false);cases++;}
await p.evaluate(()=>__prefs.mode(false));await p.evaluate(()=>__prefs.scale(1));await p.waitForTimeout(100);
await p.locator('#btnToggleVpMode').click();await p.waitForFunction(()=>__prefs.ready());assert.equal(await p.evaluate(()=>vpMode),'HDG');
await p.evaluate(()=>{__prefs.map({context:{},route:{waypoints:[]}});vpMaxAltOverride=0;});await p.waitForFunction(()=>vpHdgElevData?.length>1);
await p.locator('[onclick="vpChangeYAxis(1000)"]').click();assert.ok(await p.evaluate(()=>vpMaxAltOverride>0));cases++;
await p.locator('#btnToggleVpMode').click();await p.waitForFunction(()=>__prefs.ready());assert.equal(await p.evaluate(()=>vpMode),'ROUTE');
await p.locator('#vpToggleBtn').click();await p.waitForFunction(()=>__prefs.ready());assert.deepEqual(f.errors,[]);await f.context.close();}
console.log(`PASS ${cases} profile/scale button cases, native-prompt-free entry, disabled windows across fresh storage and tracker-control restart, mode parity and stale-status protection`);
} finally {await browser.close()}
