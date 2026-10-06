import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.GA_PLAYWRIGHT_MODULE || 'playwright');
const efb = require('../ga-tracker-client/tracker-efb-web-client');
const out = process.env.GA_EFB_SCREENSHOT_DIR || path.join(os.tmpdir(), 'ga-popout-layout-check');
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true,
  ...(process.env.GA_CHROME_EXECUTABLE ? { executablePath: process.env.GA_CHROME_EXECUTABLE } : {}) });
const fixture = { available:true,missionId:'layout-check',runId:'layout-check',state:'active',phase:'flight',
  control:{ missionId:'layout-check',runId:'layout-check',phase:'flight',executionAuthority:'tracker',allowedActions:['abort_mission'] },
  view:{title:'Übergabe am Vereinsflugplatz',story:'Größe, Höhe und Schließen bleiben lesbar.',active:true,currentTask:'Zum Ziel fliegen',progress:[],requirements:[],feedback:[],flight:{mslFt:4500,aglFt:2700}} };
try {
 const page = await browser.newPage({viewport:{width:838,height:883}}), errors=[];
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
   __layoutTest.flight({available:true,lat:48.36,lon:7.83,alt:4500,hdg:293,capturedAt:Date.now(),flight:{gsKts:90,aglFt:2700}});
 },fixture);
 const geometry=()=>page.evaluate(()=>{
   const r=id=>{const e=document.getElementById(id);const b=e.getBoundingClientRect();return {x:b.x,y:b.y,right:b.right,bottom:b.bottom,width:b.width,height:b.height};};
   return {overlay:r('mapTableOverlay'),gear:r('btnVpSettings'),mode:r('btnToggleVpMode'),scale:GAEfbUiScale.state(),width:innerWidth,height:innerHeight,profile:r('mapProfileStrip'),map:r('mapArea'),drawerWidth:getComputedStyle(document.getElementById('mapSideDrawer')).getPropertyValue('--checklist-panel-width')};
 });
 await page.evaluate(()=>{__layoutTest.mode(false,'physical');__layoutTest.scale(1);});
 await page.waitForTimeout(180);
 const physical=await geometry();
 await page.locator('.map-profile-controls').evaluate(e=>window.__originalProfileNodes=[...e.childNodes]);
 const samples=[];
 for(const size of (process.env.GA_EFB_NO_RESIZE_OBSERVER ? [{width:838,height:883}] : [{width:838,height:883},{width:600,height:800},{width:1024,height:768}])){
   await page.setViewportSize(size);
   for(const surface of ['popout','toolbar'])for(const vr of [false,true])for(const scale of [.9,1,1.5,2,3]){
     await page.evaluate(({surface,vr,scale})=>{gaChecklistToggleDrawer(false);toggleMapHintsMenu(false);__layoutTest.mode(vr,surface);__layoutTest.scale(scale);},{surface,vr,scale});
     await page.waitForTimeout(120);
     const g=await geometry();
     assert.ok(Math.abs(g.overlay.width-size.width)<1 && Math.abs(g.overlay.height-size.height)<1,JSON.stringify({surface,vr,scale,g}));
     for(const key of ['gear','mode'])assert.ok(g[key].x>=-.5&&g[key].right<=size.width+.5&&g[key].y>=-.5&&g[key].bottom<=size.height+.5,JSON.stringify({key,surface,vr,scale,g}));
     for(const id of ['btnVpSettings','btnToggleVpMode']){
       const b=await page.locator('#'+id).boundingBox();
       assert.ok(b.width>0 && b.height>0,'Profile action is displayed');
       assert.equal(await page.evaluate(({x,y})=>document.elementFromPoint(x,y)?.closest('button')?.id,{x:b.x+b.width/2,y:b.y+b.height/2}),id,JSON.stringify({id,surface,vr,scale}));
     }
     await page.evaluate(()=>gaChecklistOpen('mission'));
     await page.waitForFunction(()=>{const r=document.querySelector('.map-side-drawer-panel').getBoundingClientRect();return r.left>=-.5&&r.right<=innerWidth+.5&&r.bottom<=innerHeight+.5;},{},{timeout:2500});
     const panel=await page.locator('.map-side-drawer-panel').boundingBox();
     assert.ok(panel.x>=-.5 && panel.x+panel.width<=size.width+.5 && panel.y+panel.height<=size.height+.5,JSON.stringify({surface,vr,scale,panel}));
     await page.evaluate(()=>{gaChecklistToggleDrawer(false);toggleMapHintsMenu(true);});
     const menu=await page.locator('#mapHintsMenu').boundingBox();
     assert.ok(menu.x>=-.5 && menu.x+menu.width<=size.width+.5 && menu.y>=-.5&&menu.y+menu.height<=size.height+.5,JSON.stringify({surface,vr,scale,menu}));
     await page.waitForTimeout(520);
     if(size.width===838&&surface==='popout'&&vr&&[1,3].includes(scale))await page.screenshot({path:path.join(out,`popout-vr-${scale*100}-menu.png`)});
     samples.push({surface,vr,scale,size,...g});
   }
 }
 await page.setViewportSize({width:838,height:883});
 await page.evaluate(()=>{gaChecklistToggleDrawer(false);toggleMapHintsMenu(false);__layoutTest.mode(false,'physical');__layoutTest.scale(1);});
 await page.waitForTimeout(450);
 assert.deepEqual(await geometry(),physical,'Returning to physical restores the original geometry');
 assert.equal(await page.locator('.map-profile-controls').evaluate(e=>e.childNodes.length===__originalProfileNodes.length && [...e.childNodes].every((node,i)=>node===__originalProfileNodes[i])),true,'Returning to physical restores the same control nodes in their original order');
 await page.evaluate(()=>{__layoutTest.mode(false,'popout');__layoutTest.scale(1);__layoutTest.mode(true,'popout');__layoutTest.scale(1);toggleMapHintsMenu(true);document.body.classList.add('ga-efb-embedded');});
 const stable=[];
 for(let cycle=0;cycle<4;cycle++)for(const vr of [false,true]){
   await page.evaluate(vr=>__layoutTest.mode(vr,'popout'),vr);await page.waitForTimeout(160);
   const menu=await page.locator('#mapHintsMenu').boundingBox();
   assert.ok(menu.x>=-.5 && menu.x+menu.width<=838.5 && menu.y>=-.5&&menu.y+menu.height<=883.5,'Open menu follows VR transition');
   assert.equal(await page.locator('#gaEfbFontReset').textContent(),'100 %');
   assert.ok(Math.abs(await page.locator('#mapTableOverlay').evaluate(e=>parseFloat(getComputedStyle(e).paddingTop)*GAEfbUiScale.state().effective)-28)<.1,'Native header inset stays 28 actual pixels');
   stable.push({vr,...await geometry()});
 }
 for(const vr of [false,true]){
   const list=stable.filter(x=>x.vr===vr);for(const item of list)assert.deepEqual(item.gear,list[0].gear);for(const item of list)assert.deepEqual(item.mode,list[0].mode);
 }
 await page.evaluate(()=>{toggleMapHintsMenu(false);gaChecklistToggleDrawer(false);document.body.classList.remove('ga-efb-embedded');__layoutTest.mode(true,'popout');__layoutTest.scale(1);});
 await page.waitForTimeout(750);
 const boxes=await page.evaluate(()=>['liveTelemetryBox','liveNextWpBox','liveCurrentBox'].map(id=>{const e=document.getElementById(id),r=e.getBoundingClientRect();return {id,visible:getComputedStyle(e).display!=='none',x:r.x,y:r.y,right:r.right,bottom:r.bottom};}));
 assert.equal(boxes.filter(b=>b.visible).length,3,'All telemetry fixtures are visible');
 for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){
   const a=boxes[i],b=boxes[j];assert.ok(a.right<=b.x+.5||b.right<=a.x+.5||a.bottom<=b.y+.5||b.bottom<=a.y+.5,JSON.stringify({a,b}));
 }
 for(const id of ['btnVpSettings','btnToggleVpMode']){
   const b=await page.locator('#'+id).boundingBox();
   const hit=await page.evaluate(({x,y})=>document.elementFromPoint(x,y)?.closest('button')?.id,{x:b.x+b.width/2,y:b.y+b.height/2});
   assert.equal(hit,id,'Profile action is visible and clickable');
 }
 const rail=await page.locator('#mapDrawFloatingBtn').boundingBox();
 const hit=await page.evaluate(({x,y})=>document.elementFromPoint(x,y)?.closest('button')?.id,{x:rail.x+rail.width/2,y:rail.y+rail.height/2});
 assert.equal(hit,'mapDrawFloatingBtn','Drawing button stays reachable above profile strip');
 await page.screenshot({path:path.join(out,'popout-vr-100-layout.png')});
 await page.locator('#btnVpSettings').click();
 assert.equal(await page.locator('#vpSettingsMenu').evaluate(e=>e.style.display),'block','Gear opens profile settings');
 await page.locator('#btnVpSettings').click();
 assert.equal(await page.locator('#vpSettingsMenu').evaluate(e=>e.style.display),'none','Gear closes profile settings');
 assert.deepEqual(errors,[]);
 fs.writeFileSync(path.join(out,'measurements.json'),JSON.stringify({samples,stable,physical},null,2));
 console.log(`PASS: ${samples.length} Popout/Toolbar cases; physical DOM/layout restoration; open-menu VR transitions; fixed native inset; nonoverlapping telemetry; drawing-button hit test. ResizeObserver: ${!process.env.GA_EFB_NO_RESIZE_OBSERVER}`);
}finally{await browser.close();}
