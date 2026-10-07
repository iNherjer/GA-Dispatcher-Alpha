import {createRequire} from 'node:module';import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),{chromium}=require(process.env.GA_PLAYWRIGHT_MODULE||'playwright');
const efb=require('../ga-tracker-client/tracker-efb-web-client');
const browser=await chromium.launch({headless:true,...(process.env.GA_CHROME_EXECUTABLE?{executablePath:process.env.GA_CHROME_EXECUTABLE}:{})});
let cases=0;
try{for(const surface of ['physical','popout','toolbar'])for(const noObserver of [false,true]){
const page=await browser.newPage({viewport:{width:838,height:883}}),errors=[];page.on('pageerror',e=>errors.push(e.message));if(noObserver)await page.addInitScript(()=>{window.ResizeObserver=undefined});
await page.addInitScript(()=>{window.__invalidE6BBases=0;window.addEventListener('message',e=>{if(e.data?.type==='ga-e6b-set-base-size'&&(e.data.frontWidth<=1||e.data.windWidth<=1))window.__invalidE6BBases++;});});
await page.route('**/*',async r=>{const p=new URL(r.request().url()).pathname;if(p==='/')return r.fulfill({contentType:'text/html',body:efb.createTrackerEfbWebClientPage()});const a=efb.getTrackerEfbWebClientAsset(p);if(a){let body=a.body;if(p.endsWith('/host.js'))body=body.toString().replace(/\}\)\(\);\s*$/,`pollingClosed=true;window.__lifecycle={mode:setDisplayMode,scale:setEfbFontScale,flight:renderFlight,disconnect:disconnectFlight};})();`);return r.fulfill({contentType:a.contentType,body});}return r.fulfill({contentType:'application/json',body:'{"available":false,"ok":true,"items":[]}'});});
await page.goto('http://127.0.0.1/');await page.waitForFunction(()=>window.__lifecycle);
// Exercise hidden bootstrap as well as the normal lazy-load-on-open path.
await page.locator("#mapE6BFrame").evaluate(f=>f.loading="eager");
await page.waitForFunction(()=>Array.from(document.querySelectorAll('iframe')).some(f=>f.contentDocument?.body?.classList.contains('e6b-workbench-front-active')));
for(const scale of [1,1.5,3,1]){
await page.evaluate(({surface,scale})=>{__lifecycle.mode(false,surface);__lifecycle.scale(scale);if(!document.getElementById('mapDrawToolStack').classList.contains('open'))toggleMapToolRail();for(const t of ['e6b','stopwatch','calculator'])openMapUtilityTool(t);},{surface,scale});await page.waitForTimeout(180);
const geometry=await page.evaluate(()=>{const rect=id=>{const r=document.getElementById(id).getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height,b:r.bottom,right:r.right}};return {rail:rect('mapDrawRail'),stack:rect('mapDrawToolStack'),height:innerHeight,width:innerWidth,display:getComputedStyle(document.getElementById('mapDrawToolStack')).display};});
assert.equal(geometry.display,'flex');assert.ok(geometry.rail.b<=geometry.height+2,JSON.stringify({surface,scale,geometry}));assert.ok(geometry.stack.y>=-2,JSON.stringify({surface,scale,geometry}));
const e6b=page.frames().find(f=>f.url().includes('e6b-flight-computer'));const size=await e6b.evaluate(()=>{const r=document.getElementById('e6bFrontStack').getBoundingClientRect();return {w:r.width,h:r.height,art:document.getElementById('e6bWorkbenchFrontFixed').childElementCount,invalidBases:window.__invalidE6BBases}});assert.ok(size.w>40&&size.h>40&&size.art>0,JSON.stringify({surface,scale,size}));assert.equal(size.invalidBases,0);
await page.evaluate(()=>{const sample={available:true,lat:48.36,lon:7.83,alt:4500,hdg:90,capturedAt:Date.now(),flight:{gsKts:90,aglFt:2700}};__lifecycle.flight(sample);__lifecycle.disconnect(true);});
assert.equal(await page.locator('#liveTelemetryBox').evaluate(n=>getComputedStyle(n).display),'block');assert.equal(await page.locator('#liveTelemetryBox').evaluate(n=>n.classList.contains('ga-telemetry-stale')),true);
await page.evaluate(()=>__lifecycle.flight({available:true,lat:48.36,lon:7.83,alt:4600,hdg:90,capturedAt:Date.now(),flight:{gsKts:90,aglFt:2700}}));assert.equal(await page.locator('#liveTelemetryBox').evaluate(n=>n.classList.contains('ga-telemetry-stale')),false);
await page.locator('#mapCalculatorClose').click();await page.locator('#mapStopwatchClose').click();
if(await page.locator('#mapE6BClose').isVisible())await page.locator('#mapE6BClose').click();else await e6b.locator('[data-e6b-control=close]').click();
for(const id of ['mapE6BDevice','mapStopwatchDevice','mapCalculatorDevice'])assert.equal(await page.locator('#'+id).evaluate(n=>getComputedStyle(n).display),'none');
await page.evaluate(()=>{__lifecycle.disconnect();toggleMapToolRail();});assert.equal(await page.locator('#mapDrawToolStack').evaluate(n=>getComputedStyle(n).display),'none');assert.equal(await page.locator('#liveTelemetryBox').evaluate(n=>getComputedStyle(n).display),'none');cases++;
}
assert.deepEqual(errors,[]);await page.close();}
console.log(`PASS ${cases} layout lifecycle cases: physical/popout/toolbar, scales 1/1.5/3/1, with/without ResizeObserver; drawing, E6B, utility tools, stale telemetry and recovery`);
}finally{await browser.close()}
