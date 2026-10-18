import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.GA_PLAYWRIGHT_MODULE || 'playwright');
const efb = require('../ga-tracker-client/tracker-efb-web-client');
const { createDisplaySettingsControl } = require('../ga-tracker-client/tracker-efb-display-settings');
let config = {};
const settings = createDisplaySettingsControl({readConfig:()=>config,writeConfig:value=>{config=value;return true;}});
const browser = await chromium.launch({headless:true,...(process.env.GA_CHROME_EXECUTABLE?{executablePath:process.env.GA_CHROME_EXECUTABLE}:{})});
const results=[];
try {
 for (const scale of [1,1.5,3]) {
  const page=await browser.newPage({viewport:{width:1200,height:1000}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',async route=>{
   const pathname=new URL(route.request().url()).pathname;
   if(pathname==='/')return route.fulfill({contentType:'text/html',body:efb.createTrackerEfbWebClientPage()});
   if(pathname==='/api/v1/display/settings'){
    const body=route.request().method()==='POST'?settings.update(route.request().postDataJSON()):{display:settings.snapshot()};
    return route.fulfill({contentType:'application/json',body:JSON.stringify(body)});
   }
   const asset=efb.getTrackerEfbWebClientAsset(pathname);
   if(asset){let body=asset.body;
    if(pathname.endsWith('/host.js'))body=body.toString().replace(/\}\)\(\);\s*$/,`pollingClosed=true;window.__zoomTest={map:function(){return map;},scale:setEfbFontScale};})();`);
    return route.fulfill({contentType:asset.contentType,body});}
   if(route.request().resourceType()==='image')return route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#77916a"/></svg>'});
   return route.fulfill({contentType:'application/json',body:'{"available":false,"items":[],"ok":true}'});
  });
  await page.goto('http://127.0.0.1/');
  await page.waitForFunction(()=>window.__zoomTest);
  const result=await page.evaluate(async scale=>{
   const check=(v,m)=>{if(!v)throw Error(m)},wait=ms=>new Promise(r=>setTimeout(r,ms));
   const map=__zoomTest.map();__zoomTest.scale(scale);toggleAutoFollow(false);
   if(!mapHints.zoomControl)toggleMapHint('zoomControl');
   await wait(100);
   const button=document.querySelector('.map-drag-zoom');
   check(button&&getComputedStyle(button).display!=='none','New control missing');
   check(getComputedStyle(document.querySelector('#map .leaflet-control-zoom')).display==='none','Old zoom visible');
   check(getComputedStyle(document.getElementById('autoFollowBtn')).display==='none','Old follow visible');
   const rect=button.getBoundingClientRect(),factor=rect.height/button.offsetHeight;
   const x=rect.left+rect.width/2,y=rect.top+rect.height/2;
   let endCount=0;map.on('zoomend',()=>endCount++);
   const send=(kind,action,dy=0)=>{
    const name=kind==='touch'?({down:'touchstart',move:'touchmove',up:'touchend',cancel:'touchcancel'}[action]):kind==='pointer'?({down:'pointerdown',move:'pointermove',up:'pointerup',cancel:'pointercancel'}[action]):({down:'mousedown',move:'mousemove',up:'mouseup'}[action]);
    let event;
    if(kind==='touch'){
     event=new Event(name,{bubbles:true,cancelable:true});const point={identifier:5,clientX:x,clientY:y+dy*factor};
     Object.defineProperties(event,{touches:{value:action==='up'||action==='cancel'?[]:[point]},changedTouches:{value:[point]}});
    }else event=kind==='pointer'?new PointerEvent(name,{bubbles:true,cancelable:true,pointerId:7,isPrimary:true,button:0,buttons:action==='up'?0:1,clientX:x,clientY:y+dy*factor}):new MouseEvent(name,{bubbles:true,cancelable:true,button:0,buttons:action==='up'?0:1,clientX:x,clientY:y+dy*factor});
    (action==='down'?button:window).dispatchEvent(event);
   };
   for(const kind of ['mouse','pointer','touch']){
    await wait(950);map.setView([48.4,7.8],8,{animate:false});await wait(150);
    const initial=map.getZoom(),center=map.getCenter();const tile=document.querySelector('#map .leaflet-tile-loaded');check(tile,'No loaded tile before zoom');
    send(kind,'down');send(kind,'move',-15);await wait(80);check(map.getZoom()===initial,'Deadzone zooms');
    send(kind,'move',-65);await wait(120);const slow=map.getZoom()-initial;check(slow>0,'Up drag does not zoom in '+kind);
    check(tile.isConnected,'Loaded tile removed during zoom '+kind);
    send(kind,'move',-130);const z=map.getZoom();await wait(120);check(map.getZoom()-z>slow,'Speed does not increase');
    send(kind,'move',100);const beforeOut=map.getZoom();await wait(120);check(map.getZoom()<beforeOut,'Down drag does not zoom out');
    const beforeEnd=endCount;send(kind,'up',100);const stopped=map.getZoom();await wait(100);check(map.getZoom()===stopped,'Zoom continues after release');check(endCount===beforeEnd+1,'Missing/surplus zoomend');map.eachLayer(layer=>{if(layer instanceof L.GridLayer)check(!layer._noPrune,'Tile retention not released');});
    check(map.dragging.enabled(),'Dragging not restored');check(map.getCenter().distanceTo(center)<1,'Zoom pans map');check(!isAutoFollow,'Drag toggles follow');
    send(kind,'down');check(map.getZoom()===stopped,'Touchdown rounds fractional zoom');send(kind,'up');check(isAutoFollow&&isMapAutoZoomEnabled(),'Tap does not enable follow/autozoom');
    check(button.classList.contains('is-following')&&button.getAttribute('aria-pressed')==='true','Follow indicator missing');
    if(kind!=='mouse'){send('mouse','down');send('mouse','up');check(isAutoFollow,'Compatibility mouse toggles twice');}
    send(kind,'down');send(kind,'move',-15);await wait(30);check(isMapAutoZoomEnabled(),'Deadzone disables autozoom');
    send(kind,'move',-100);await wait(100);send(kind,'up',-100);
    check(isAutoFollow&&!isMapAutoZoomEnabled(),'Manual zoom does not take over autozoom');
    const manual=map.getZoom();map.panTo([48.4001,7.8],{animate:false});
    check(map.getZoom()===manual,'Follow rounds zoom');
    check(maybeApplyMapAutoZoom(48.4,7.8,5000,120,0,Date.now(),false,{force:true})===false,'Autozoom overrides manual choice');
    toggleAutoFollow(false);
    check(!button.classList.contains('is-following')&&button.getAttribute('aria-pressed')==='false','Follow indicator remains');
   }
   for(const reason of ['pointercancel','touchcancel','blur','pagehide','lostcapture']) {
    await wait(950);const kind=reason==='touchcancel'?'touch':'pointer';
    send(kind,'down');send(kind,'move',-100);await wait(80);
    if(reason==='pointercancel'||reason==='touchcancel')send(kind,'cancel');
    else if(reason==='lostcapture')button.dispatchEvent(new PointerEvent('lostpointercapture',{pointerId:7}));
    else window.dispatchEvent(new Event(reason));
    const stopped=map.getZoom();await wait(60);check(map.getZoom()===stopped&&map.dragging.enabled(),'Abort failed '+reason);
   }
   await wait(950);send('mouse','down');send('mouse','move',-100);await wait(80);toggleMapHint('zoomControl');const stopped=map.getZoom();await wait(80);check(map.getZoom()===stopped&&map.dragging.enabled(),'Disable does not stop drag');
   check(getComputedStyle(button).display==='none','Control remains visible');check(getComputedStyle(document.querySelector('#map .leaflet-control-zoom')).display!=='none','Old zoom not restored');check(getComputedStyle(document.getElementById('autoFollowBtn')).display!=='none','Old follow not restored');
   return {scale,factor,endCount,saved:localStorage.ga_map_hint_zoomControl};
  },scale);
  assert.deepEqual(errors,[]);assert.equal(result.saved,'false');
  await page.reload();await page.waitForFunction(()=>window.__zoomTest);
  assert.equal(await page.evaluate(()=>mapHints.zoomControl),false);
  results.push(result);await page.close();
 }
 console.log(JSON.stringify({ok:true,results}));
} finally {await browser.close();}
