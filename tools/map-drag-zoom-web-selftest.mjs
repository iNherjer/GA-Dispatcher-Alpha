import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.GA_PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,...(process.env.GA_CHROME_EXECUTABLE?{executablePath:process.env.GA_CHROME_EXECUTABLE}:{})});
try{
 const page=await browser.newPage({viewport:{width:600,height:800}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',route=>route.fulfill({contentType:'text/html',body:'<style>#map{height:700px}</style><div id="map"></div><button id="autoFollowBtn"></button>'}));
 await page.goto('http://zoom.test/');
 await page.addStyleTag({content:fs.readFileSync('vendor/leaflet/leaflet.css','utf8')});
 await page.addStyleTag({content:fs.readFileSync('styles.css','utf8')});
 await page.addScriptTag({content:fs.readFileSync('vendor/leaflet/leaflet.js','utf8')});
 await page.addScriptTag({content:'var map=L.map("map").setView([48,8],8);var isAutoFollow=false;var lastAutoFollowPanAt=0,lastAutoFollowPanPos=null;window.mapHints={zoomControl:true,autoZoom:false};window.isMapHintEnabled=k=>mapHints[k];window.toggleMapHint=k=>mapHints[k]=!mapHints[k];document.body.classList.add("map-drag-zoom-enabled");'});
 await page.addScriptTag({content:fs.readFileSync('map-autozoom.js','utf8')});
 await page.addScriptTag({content:fs.readFileSync('map-zoom-control.js','utf8')});
 const result=await page.evaluate(async()=>{
  // No live position: isolate camera rounding from intentional live autozoom.
  applyAutoFollowViewNow=()=>false;
  installMapDragZoomControl(map);
  const button=document.querySelector('.map-drag-zoom'),wait=ms=>new Promise(r=>setTimeout(r,ms));
  const check=(v,m)=>{if(!v)throw Error(m)};
  const rect=button.getBoundingClientRect(),x=rect.left+20,y=rect.top+30;
  const event=(name,dy=0)=>new MouseEvent(name,{bubbles:true,cancelable:true,clientX:x,clientY:y+dy,button:0,buttons:name==='mouseup'?0:1});
  button.dispatchEvent(event('mousedown'));window.dispatchEvent(event('mousemove',-90));await wait(160);window.dispatchEvent(event('mouseup',-90));
  const fractional=map.getZoom();check(fractional!==Math.round(fractional),'Fixture is not fractional');
  button.dispatchEvent(event('mousedown'));check(map.getZoom()===fractional,'Touchdown rounds zoom');
  window.dispatchEvent(event('mouseup'));check(map.getZoom()===fractional,'Tap rounds zoom');
  check(button.classList.contains('is-following')&&button.getAttribute('aria-pressed')==='true','Follow indicator missing');
  check(getComputedStyle(button.querySelector('.map-drag-zoom-magnifier')).display==='none','Magnifier still shown');
  check(getComputedStyle(button.querySelector('.map-drag-zoom-location')).display!=='none','Location pointer hidden');
  toggleAutoFollow(false);check(!button.classList.contains('is-following')&&button.getAttribute('aria-pressed')==='false','External follow off does not update');
  check(getComputedStyle(button.querySelector('.map-drag-zoom-magnifier')).display!=='none','Magnifier not restored');
  toggleAutoFollow(true);check(button.classList.contains('is-following'),'External follow on does not update');
  window.toggleMapHint('autoZoom'); // Turn the tap-enabled autozoom off, then on for this case.
  window.toggleMapHint('autoZoom');
  let pendingRan=false;mapAutoZoomSmoothTimer=setTimeout(()=>{pendingRan=true},300);
  button.dispatchEvent(event('mousedown'));window.dispatchEvent(event('mousemove',-15));await wait(30);
  check(isMapAutoZoomEnabled(),'Deadzone disables autozoom');
  window.dispatchEvent(event('mousemove',-90));await wait(100);window.dispatchEvent(event('mouseup',-90));
  check(!isMapAutoZoomEnabled()&&isAutoFollow,'Manual zoom must disable autozoom and retain follow');
  const manual=map.getZoom();
  check(maybeApplyMapAutoZoom(48,8,5000,120,0,Date.now(),false,{force:true})===false,'Autozoom still applies');
  map.panTo([48.001,8],{animate:false});check(map.getZoom()===manual,'Follow pan rounds manual zoom');
  await wait(350);check(!pendingRan&&map.getZoom()===manual,'Pending autozoom resumes');

  return {fractional,afterTap:map.getZoom(),followIndicator:true};
 });
 assert.deepEqual(errors,[]);console.log(JSON.stringify({ok:true,...result}));
}finally{await browser.close();}
