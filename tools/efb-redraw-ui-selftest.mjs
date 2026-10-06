import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.GA_PLAYWRIGHT_MODULE || 'playwright');
const efb = require('../ga-tracker-client/tracker-efb-web-client');
const out = process.env.GA_EFB_SCREENSHOT_DIR || path.join(os.tmpdir(), 'ga-efb-redraw-check');
fs.mkdirSync(out, { recursive: true });
const baselineRef = process.env.GA_EFB_BASELINE_REF || '1bf9a8f9b62852a527cca237235d4832c4ee3c18';
const baselinePaths = {
 '/efb/v1/assets/host.js':'ga-tracker-client/tracker-efb-kartentisch-host.js',
 '/efb/v1/assets/profile.js':'ga-tracker-client/efb-web-assets/profile.js',
 '/efb/v1/assets/profile-bridge.js':'ga-tracker-client/tracker-efb-profile-bridge.js',
 '/efb/v1/assets/map-live-presentation.js':'map-live-presentation.js'
};
const baseline = Object.fromEntries(Object.entries(baselinePaths).map(([url,file]) => [url,execFileSync('git',['show',baselineRef+':'+file])]));
const browser = await chromium.launch({ headless: true,
 ...(process.env.GA_CHROME_EXECUTABLE ? {executablePath:process.env.GA_CHROME_EXECUTABLE} : {}) });
const fixture = {context:{theme:'classic',tasKts:120,profileCruiseFt:4500,waypointLabels:[{lat:48.45,lon:7.92,name:'Übergabe & Höhenprüfung',frequency:'128.350'}]},
 route:{waypoints:[{lat:48.36,lon:7.83,name:'EDTF',elev:500},{lat:48.45,lon:7.92,name:'Übergabe & Höhenprüfung',elev:600}],totalDistanceNm:6},
 navigation:{activeLegIndex:0,distanceToNextNm:6,bearingToNextDeg:40,remainingDistanceNm:6,crossTrackNm:.1}};
const results=[];
async function open(variant,surface){
 const page = await browser.newPage({viewport:{width:838,height:883}}), errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',async route=>{
  const url=new URL(route.request().url()),pathname=url.pathname;
  if(pathname==='/')return route.fulfill({contentType:'text/html',body:efb.createTrackerEfbWebClientPage()});
  if(pathname==='/api/v1/profile-data'){
   const data=route.request().postDataJSON();let value=[];
   if(data.kind==='terrain')value=data.points.map(p=>({...p,elevFt:500+Math.round((p.lat-48.36)*18000)}));
   if(data.kind==='resource' && data.url.includes('airports.json'))value={EDTF:{lat:48.36,lon:7.83,elevation:500}};
   return route.fulfill({contentType:'application/json',body:JSON.stringify(value)});
  }
  const asset=efb.getTrackerEfbWebClientAsset(pathname);
  if(asset){let body=variant==='baseline' && baseline[pathname] || asset.body;
   if(pathname.endsWith('/host.js'))body=body.toString().replace(/\}\)\(\);\s*$/,`
    pollingClosed=true;
    window.__redraw={mode:setDisplayMode,scale:setEfbFontScale,flight:renderFlight,progress:renderProgress,compass:updateCompass,status:setTrackerState,mission:renderMissionPayload,
     map:function(value){mapSnapshot=value;renderRoute(value);renderProgress();updateCompass();renderProfile();},
     preferences:function(profile,follow){preferences.profileVisible=profile;preferences.follow=follow;isAutoFollow=follow;document.body.classList.toggle('profile-hidden',!profile);renderProfile();},
     state:function(){return {flight:flight,center:map.getCenter(),zoom:map.getZoom(),profile:preferences.profileVisible,follow:preferences.follow};},
     mapRef:function(){return map;}};
   })();`);
   return route.fulfill({contentType:asset.contentType,body});}
  return route.fulfill({contentType:'application/json',body:'{"available":false,"items":[],"ok":true}'});
 });
 await page.goto('http://127.0.0.1/');
 await page.waitForFunction(()=>window.__redraw && window.gaChecklistHost?.missionView);
 await page.evaluate(({fixture,surface})=>{
  __redraw.mode(surface!=='physical',surface);__redraw.scale(1);
  __redraw.preferences(false,false);__redraw.map(fixture);
  __redraw.flight({available:true,lat:48.36,lon:7.83,alt:4500,hdg:359,capturedAt:Date.now(),flight:{gsKts:0,aglFt:2700}});
 },{fixture,surface});
 await page.waitForTimeout(750);
 await page.evaluate(()=>{
  window.__clock=Date.now();Date.now=()=>window.__clock;
  window.__mutations=0;window.__byTarget={};
  window.__observer=new MutationObserver(records=>{for(const r of records){__mutations++;const key=r.target.id||r.target.className?.baseVal||r.target.className||r.target.nodeName;__byTarget[key]=(__byTarget[key]||0)+1;}});
  __observer.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true});
  window.__labelNode=document.getElementById('nextWpName').querySelector('div');
  window.__toggleSymbol=document.getElementById('mapToolbarToggle').querySelector('.ga-efb-symbol');
 });
 return {page,errors};
}
async function stationary(page,count){
 for(let i=0;i<count;i++){
  await page.evaluate(()=>{__clock+=200;__redraw.flight({available:true,lat:48.36,lon:7.83,alt:4500,hdg:359,capturedAt:Date.now(),flight:{gsKts:0,aglFt:2700}});__redraw.status('Tracker + Simulator verbunden',false);});
  await page.waitForTimeout(15);
 }
 return page.evaluate(()=>({samples:24,mutations:__mutations,byTarget:__byTarget,
  labelPreserved:__labelNode===document.getElementById('nextWpName').querySelector('div'),
  symbolPreserved:__toggleSymbol===document.getElementById('mapToolbarToggle').querySelector('.ga-efb-symbol'),
  flightAge:Date.now()-__redraw.state().flight.capturedAt}));
}
async function profileAndFollow(page) {
 await page.evaluate(()=>__redraw.preferences(true,true));
 await page.waitForTimeout(250);
 await page.evaluate(()=>{__observer.takeRecords();__mutations=0;__byTarget={};});
 return stationary(page,24);
}
try{
 const before=await open('baseline','physical');const baselineResult=await stationary(before.page,24);
 const baselineOn=await profileAndFollow(before.page);
 assert.equal(before.errors.length,0,before.errors.join('\n'));await before.page.close();
 results.push({variant:'v485',surface:'physical',stationary:baselineResult,stationaryWithProfileAndFollow:baselineOn});
 for(const surface of ['physical','popout','toolbar']){
  const {page,errors}=await open('candidate',surface), idle=await stationary(page,24);
  assert.ok(idle.mutations<baselineResult.mutations*.4,JSON.stringify({surface,idle,baselineResult}));
  assert.equal(idle.labelPreserved,true);assert.equal(idle.symbolPreserved,true);assert.equal(idle.flightAge,0);
  const idleOn=await profileAndFollow(page);
  if(surface==='physical')assert.ok(idleOn.mutations<baselineOn.mutations*.75,JSON.stringify({idleOn,baselineOn}));
  await page.evaluate(()=>__redraw.preferences(false,false));
  // Same route values after actual user actions must update states and accessibility.
  await page.evaluate(()=>toggleRouteProgressTarget());
  assert.ok((await page.locator('.route-progress-target').allTextContents()).every(x=>x==='RTE'));
  await page.evaluate(()=>toggleRouteProgressTarget());
  // Move outside the waypoint acceptance radius before testing the preview controls.
  await page.evaluate(()=>{__clock+=200;__redraw.flight({available:true,lat:48.35,lon:7.82,alt:4500,hdg:359,capturedAt:Date.now(),flight:{gsKts:0}});});
  await page.locator('#nextLegPrevBtn').click();assert.equal(await page.locator('#nextLegPrevBtn').isDisabled(),true);
  assert.equal(await page.locator('#nextLegNextBtn').isDisabled(),false);
  await page.locator('#nextLegNextBtn').click();assert.equal(await page.locator('#nextLegNextBtn').isDisabled(),true);
  assert.equal(await page.locator('#nextWpName').textContent(),'Übergabe & Höhenprüfung128.350');
  await page.evaluate(()=>toggleMapToolbar());assert.equal(await page.locator('#mapToolbarToggle').getAttribute('aria-expanded'),'false');
  await page.evaluate(()=>toggleMapToolbar());assert.equal(await page.locator('#mapToolbarToggle').getAttribute('aria-expanded'),'true');
  await page.waitForTimeout(350);
  // Replaced DOM and escaped frequency/name must not inherit stale output state.
  await page.evaluate(()=>{const old=document.getElementById('nextWpName');old.replaceWith(old.cloneNode(false));__redraw.progress();});
  assert.equal(await page.locator('#nextWpName').textContent(),'Übergabe & Höhenprüfung128.350');
  await page.evaluate(fixture=>{fixture.context.waypointLabels[0].frequency='129.125';__redraw.map(fixture);},fixture);
  assert.equal(await page.locator('#nextWpName div').textContent(),'129.125');
  await page.evaluate(fixture=>{fixture.context.waypointLabels[0].frequency='';__redraw.map(fixture);},fixture);
  assert.equal(await page.locator('#nextWpName').textContent(),'Übergabe & Höhenprüfung');
  // Exercise real Leaflet projection and new/replaced renderer paths at higher zoom.
  const vector=await page.evaluate(()=>{
   const map=__redraw.mapRef(),renderer=GAMapLivePresentation.createEfbSvgRenderer(L,{pane:'gaPreviewPane'});
   const line=L.polyline([[48.36,7.83],[48.45,7.92]],{renderer,pane:'gaPreviewPane'}).addTo(map);
   let writes=0;const write=line._path.setAttribute.bind(line._path);line._path.setAttribute=(name,value)=>{if(name==='d')writes++;write(name,value);};
   const initial=line._path.getAttribute('d');line.setLatLngs([[48.36,7.83],[48.45,7.92]]);if(writes!==0)throw Error('same SVG path was rewritten');
   map.setView([48.36,7.83],16,{animate:false});const zoomed=line._path.getAttribute('d');if(zoomed===initial)throw Error('zoom did not reproject');
   line.setLatLngs([[48.361,7.831],[48.45,7.92]]);const moved=line._path.getAttribute('d');if(moved===zoomed)throw Error('movement missing');
   map.panTo([48.37,7.84],{animate:false});const panned=line._path.getAttribute('d');if(panned===moved)throw Error('pan did not reproject');
   map.removeLayer(line);line.addTo(map);if(!line._path.getAttribute('d'))throw Error('new path missing');
   const result={writes,zoomed,moved,panned};map.removeLayer(line);return result;
  });
  await page.evaluate(()=>{__redraw.preferences(true,true);window._hdgAutoActivated=true;vpMode='ROUTE';});
  const framesBefore=await page.evaluate(()=>{window.__frames=0;const fn=renderMapProfileFrames;window.renderMapProfileFrames=function(){__frames++;return fn.apply(this,arguments);};return __frames;});
  for(let i=0;i<14;i++){
   await page.evaluate(i=>{__clock+=200;__redraw.flight({available:true,lat:48.36+i*.0002,lon:7.83+i*.0002,alt:4500+i*10,hdg:i===0?359:i===1?0:i*2,capturedAt:Date.now(),flight:{gsKts:90,aglFt:2700+i*10}});},i);
   await page.waitForTimeout(30);
  }
  await page.waitForTimeout(400);
  const moving=await page.evaluate(()=>({state:__redraw.state(),heading:document.getElementById('compassHdgReadout').textContent,
   altitude:document.getElementById('teleAGL').textContent,vs:document.getElementById('teleVS').textContent,
   frames:__frames,canvas:{width:mapProfileCanvas.width,height:mapProfileCanvas.height},
   terrain:window.lastLiveTerrainFt,gps:window.lastLiveGpsPos,predictions:window.vpPredictionData?.length||0}));
  assert.equal(moving.heading,'026°');assert.equal(moving.altitude,'4630');assert.ok(Number(moving.vs)>0);
  assert.equal(moving.state.flight.lat,48.3626);assert.equal(moving.gps.lat,48.3626);assert.ok(Number.isFinite(moving.terrain));
  assert.ok(Math.abs(moving.state.center.lat-48.3626)<.0001,JSON.stringify(moving.state));
  assert.ok(moving.frames>framesBefore && moving.canvas.width>0 && moving.canvas.height>0,JSON.stringify(moving));
  assert.ok(moving.predictions>0,'prediction updates must remain active');
  await page.screenshot({path:path.join(out,surface+'-moving.png')});
  assert.equal(errors.length,0,errors.join('\n'));
  results.push({variant:'candidate',surface,stationary:idle,stationaryWithProfileAndFollow:idleOn,vector,moving});await page.close();
 }
 fs.writeFileSync(path.join(out,'measurements.json'),JSON.stringify({baselineRef,results},null,2));
 console.log('PASS: repeated output, glyph/frequency-node preservation, changed values and DOM replacement, real Leaflet zoom/pan/new layers, movement with profile/follow/prediction on; three EFB surfaces.');
 console.log(JSON.stringify(results.map(r=>({variant:r.variant,surface:r.surface,mutations:r.stationary.mutations,withProfileAndFollow:r.stationaryWithProfileAndFollow.mutations,samples:r.stationary.samples})),null,2));
}finally{await browser.close();}
