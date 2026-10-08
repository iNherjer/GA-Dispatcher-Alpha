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

 // Stress native viewport declarations as seen by engines that do not resolve
 // percentage/fixed geometry against the transformed body's logical bounds.
 await page.addStyleTag({content:'body.ga-efb-tracker-host #mapTableOverlay {height:100vh!important;width:100vw!important;}'});
 let cases=0;
 for(const size of [{width:838,height:883},{width:838,height:600},{width:600,height:400}]) {
 await page.setViewportSize(size);
 for(const surface of ['physical','popout','toolbar']) for(const vr of [false,true]) for(const scale of [.9,1,1.5,2,3]) {
 await page.evaluate(({surface,vr,scale})=>{
 document.body.classList.add('ga-efb-embedded');document.body.classList.remove('profile-hidden');
 __layoutTest.mode(vr,surface);__layoutTest.scale(scale);
 },{surface,vr,scale});
 await page.waitForTimeout(80);
 const g=await geometry();
 assert.ok(Math.abs(g.overlay.bottom-size.height)<1,JSON.stringify({surface,vr,scale,size,g}));
 assert.ok(g.profile.bottom<=size.height+1,JSON.stringify({surface,vr,scale,size,g}));
 assert.ok(g.profile.height>0,JSON.stringify({surface,vr,scale,size,g}));
 const plot=await page.locator('#mapProfileCanvas').boundingBox();
 if(plot && plot.width>0 && plot.height>0)assert.ok(plot.y+plot.height<=size.height+1,JSON.stringify({surface,vr,scale,size,plot}));
 if(scale<=1.5 && size.height>=600)assert.ok(plot && plot.width>0 && plot.height>0,'Profile plot must remain visible at normal/VR-default scale');
 cases++;
 }
 }
 assert.deepEqual(errors,[]);console.log('PASS '+cases+' complete profile bottom bounds across physical/popout/toolbar, native viewport override, VR and manual scaling');
}finally{await browser.close();}
