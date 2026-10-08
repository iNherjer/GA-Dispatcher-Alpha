import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.GA_PLAYWRIGHT_MODULE || 'playwright');
const efb = require('../ga-tracker-client/tracker-efb-web-client');
const browser = await chromium.launch({ headless: true,
  ...(process.env.GA_CHROME_EXECUTABLE ? { executablePath: process.env.GA_CHROME_EXECUTABLE } : {}) });
const fixture = { available:true,missionId:'layout-check',runId:'layout-check',state:'active',phase:'flight',
  control:{ missionId:'layout-check',runId:'layout-check',phase:'flight',executionAuthority:'tracker',allowedActions:['abort_mission'] },
  view:{title:'Übergabe am Vereinsflugplatz',story:'Größe, Höhe und Schließen bleiben lesbar.',active:true,currentTask:'Zum Ziel fliegen',progress:[],requirements:[],feedback:[],flight:{mslFt:4500,aglFt:2700}} };
try {
 const page = await browser.newPage({viewport:{width:665,height:756}}), errors=[];
 page.on('pageerror', e=>errors.push(e.message));
 if(process.env.GA_EFB_NO_RESIZE_OBSERVER)await page.addInitScript(()=>{window.ResizeObserver=undefined;});
 await page.route('**/*', async route=>{
   const pathname=new URL(route.request().url()).pathname;
   if(pathname==='/')return route.fulfill({contentType:'text/html',body:efb.createTrackerEfbWebClientPage()});
   const asset=efb.getTrackerEfbWebClientAsset(pathname);
   if(asset){let body=asset.body;
     if(pathname.endsWith('/host.js'))body=body.toString().replace(/\}\)\(\);\s*$/,`pollingClosed=true;window.__layoutTest={mode:setDisplayMode,scale:setEfbFontScale,mission:renderMissionPayload,flight:renderFlight,map:function(value){mapSnapshot=value;renderRoute(value);renderProgress();updateCompass();renderProfile();}};})();`);
     return route.fulfill({contentType:asset.contentType,body});}
   return route.fulfill({contentType:'application/json',body:'{"available":false,"items":[],"ok":true}'});
 });
 await page.goto('http://127.0.0.1/');
 await page.waitForFunction(()=>window.__layoutTest && window.gaChecklistHost?.missionView);
 await page.evaluate(fixture=>{
   __layoutTest.mission(fixture);
   __layoutTest.map({context:{},route:{waypoints:[{lat:48.36,lon:7.83,name:'EDTF'},{lat:48.45,lon:7.92,name:'Übergabeplatz – Höhenprüfung'}],totalDistanceNm:6},navigation:{activeLegIndex:0,distanceToNextNm:6,bearingToNextDeg:40,remainingDistanceNm:6,crossTrackNm:.1}});
   vpMode='ROUTE';vpElevationData=[{lat:48.36,lon:7.83,distNM:0,elevFt:600},{lat:48.45,lon:7.92,distNM:6,elevFt:1400}];window.vpBgNeedsUpdate=true;vpRequestMapProfileFrameNow();
   __layoutTest.flight({available:true,lat:48.36,lon:7.83,alt:4500,hdg:293,capturedAt:Date.now(),flight:{gsKts:90,aglFt:2700}});
 },fixture);


for(const surface of ['physical','popout','toolbar'])for(const scale of [.5,.7,.9,1,1.5]){
 await page.evaluate(({surface,scale})=>{__layoutTest.mode(false,surface);__layoutTest.scale(scale);},{surface,scale});
 await page.waitForTimeout(120);
 await page.evaluate(()=>{toggleMapHintsMenu(true);toggleMapHintSubmenu('terrainAvoidMenu');});
 await page.waitForTimeout(100);
 const menu=await page.evaluate(()=>{const m=document.getElementById('mapHintsMenu'),t=document.getElementById('hintToggleTelemetry');t.scrollIntoView({block:'nearest'});const r=t.getBoundingClientRect(),hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return {position:getComputedStyle(m).position,hit:hit===t||t.contains(hit),expanded:document.getElementById('terrainAvoidMenuBlock').style.display};});
 assert.equal(menu.position,'absolute');assert.equal(menu.hit,true);assert.equal(menu.expanded,'block');
 await page.evaluate(()=>{toggleMapHintSubmenu('terrainAvoidMenu');toggleMapHintsMenu(false);});
 const result=await page.evaluate(()=>{
 const ids=['vpZoomDisplay','yAxisDisplay'];
 const nodes=ids.map(id=>{const e=document.getElementById(id),minus=e.previousElementSibling,plus=e.nextElementSibling;return {id,visible:[minus,e,plus].every(n=>getComputedStyle(n).display!=='none'&&n.getBoundingClientRect().width>0)};});
 const before=vpZoomLevel;vpZoom(-10);const after=vpZoomLevel;vpZoom(10);
 return {nodes,before,after};});
 assert.ok(result.nodes.every(n=>n.visible),JSON.stringify({surface,scale,result}));
 assert.notEqual(result.before,result.after,'Original profile zoom handler must work');
}
assert.deepEqual(errors,[]);console.log('PASS menu absolute placement and scrolled option hit-test; profile zoom and axis controls retained in narrow EFB on all 3 surfaces, 50/70/90/100/150% UI scale; original zoom handler works.');
}finally{await browser.close();}
