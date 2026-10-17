import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(process.env.GA_PLAYWRIGHT_MODULE||'playwright');
const efb=require('../ga-tracker-client/tracker-efb-web-client');
const browser=await chromium.launch({headless:true,...(process.env.GA_CHROME_EXECUTABLE?{executablePath:process.env.GA_CHROME_EXECUTABLE}:{})});
const airport={icaoCode:'EDTL',name:'Lahr – Süd',country:'DE',elevation:{value:512,unit:1},geometry:{type:'Point',coordinates:[7.83,48.36]},runways:[],frequencies:[{name:'TWR',value:'125.180',unit:2}]};
try {
 const page=await browser.newPage({viewport:{width:838,height:883}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{Element.prototype.setPointerCapture=function(){throw Error('capture unsupported')};});
 await page.route('**/*',async r=>{
  const path=new URL(r.request().url()).pathname;
  if(path==='/')return r.fulfill({contentType:'text/html',body:efb.createTrackerEfbWebClientPage()});
  const asset=efb.getTrackerEfbWebClientAsset(path);
  if(asset){let body=asset.body;if(path.endsWith('/host.js'))body=body.toString().replace(/\}\)\(\);\s*$/,`pollingClosed=true;window.__photoTest={map:function(){return map;},mode:setDisplayMode,scale:setEfbFontScale};})();`);
   // The affected host does not reliably implement grid. Exercise the fallback.
   if(path.endsWith('app-styles.css'))body=body.toString().replace(/display:\s*grid\s*;/g,'display:block;');
   return r.fulfill({contentType:asset.contentType,body});}
  let data={ok:true,available:false,items:[]};
  if(path==='/api/v1/profile-data'){
   const input=r.request().postDataJSON();
   if(input.kind==='aviation')data={airports:[airport],airspaces:[],navaids:[],reportingPoints:[]};
   if(input.kind==='terrain')data=input.points.map(p=>({...p,elevFt:512}));
   if(input.kind==='resource')data=input.url==='./airports.json'?{EDTL:{lat:48.36,lon:7.83,name:'Lahr',country:'DE',elevation:512}}:[];
  }
  return r.fulfill({contentType:'application/json',body:JSON.stringify(data)});
 });
 await page.goto('http://127.0.0.1/');await page.waitForFunction(()=>__photoTest.map());
 let cases=0;
 for(const width of [838,440])for(const scale of [1,1.5]){
  await page.setViewportSize({width,height:883});await page.evaluate(scale=>{__photoTest.mode(false,'physical');__photoTest.scale(scale);map=__photoTest.map();map.setView([48.36,7.83],14);},scale);await page.waitForTimeout(120);
  const area=await page.locator('#mapArea').boundingBox(),follow=await page.locator('#autoFollowBtn').boundingBox();
  assert.ok(Math.abs(area.x+area.width-follow.x-follow.width-6*scale)<1);assert.ok(Math.abs(area.y+area.height-follow.y-follow.height-6*scale)<1);
  for(const kind of ['mouse','touch']){
   const movement=await page.evaluate(kind=>{
    const area=document.getElementById('mapArea'),rail=document.getElementById('mapDrawRail'),button=document.getElementById('mapDrawFloatingBtn');
    mapDrawState.panelOpen=true;syncMapDrawUi();clampMapDrawFloatingButtonPosition({left:area.clientWidth/2-23,top:area.clientHeight/2-23});
    const before=rail.getBoundingClientRect(),point={clientX:before.left+23,clientY:before.top+23,identifier:7};
    function send(target,type,p,changed){const e=kind==='mouse'?new MouseEvent(type,{bubbles:true,cancelable:true,button:0,clientX:p.clientX,clientY:p.clientY}):new Event(type,{bubbles:true,cancelable:true});if(kind==='touch'){Object.defineProperty(e,'touches',{value:changed?[]:[p]});Object.defineProperty(e,'changedTouches',{value:[p]});}target.dispatchEvent(e);}
    send(button,kind==='mouse'?'mousedown':'touchstart',point,false);
    const next={...point,clientX:point.clientX-55,clientY:point.clientY+40};send(document,kind==='mouse'?'mousemove':'touchmove',next,false);send(document,kind==='mouse'?'mouseup':'touchend',next,true);
    const after=rail.getBoundingClientRect();return {dx:after.x-before.x,dy:after.y-before.y,saved:!!localStorage.getItem('ga_map_draw_button_pos'),busy:!!mapDrawState.buttonDrag};
   },kind);
   assert.ok(movement.dx<-20&&movement.dy>20,JSON.stringify(movement));assert.equal(movement.saved,true);assert.equal(movement.busy,false);
  }
  await page.waitForTimeout(400);
  await page.evaluate(cases=>{mapDrawState.panelOpen=false;syncMapDrawUi();gaOpenMapContextInfo(L.latLng(48.36+cases*.001,7.83),'test');},cases);await page.waitForTimeout(1000);
  if(!await page.locator('.ga-map-context-body').count())throw Error(JSON.stringify({errors,debug:await page.evaluate(()=>({popup:document.querySelector('.ga-map-context-popup')?.outerHTML,state:!!mapContextInfoState}))}));
  const geometry=await page.evaluate(()=>{const body=document.querySelector('.ga-map-context-body'),band=document.querySelector('.ga-map-context-height-band'),details=document.querySelector('.ga-map-context-details');return {body:body.getBoundingClientRect().toJSON(),band:band.getBoundingClientRect().toJSON(),details:details.getBoundingClientRect().toJSON(),display:getComputedStyle(body).display};});
  const compactColors=await page.locator('.ga-map-context-airport-full .ga-airport-popup > div').evaluateAll(nodes=>nodes.slice(0,2).map(n=>getComputedStyle(n).color));for(const color of compactColors)assert.equal(color,'rgb(238, 245, 255)');
  assert.equal(geometry.display,'flex');assert.ok(geometry.details.width>70,JSON.stringify(geometry));assert.ok(geometry.details.x>=geometry.band.right-1);assert.ok(Math.abs(geometry.details.y-geometry.band.y)<1);assert.ok(geometry.body.height<883);assert.ok(geometry.band.width<geometry.body.width*.4);
  if(width===838&&scale===1)await page.screenshot({path:'/tmp/ga-efb-context-fixed.png'});
  await page.evaluate(()=>{map.closePopup();runwayCache.EDTL='14/32 - 704m';freqCache.EDTL=[{label:'TWR',value:'125.180'}];L.popup().setLatLng([48.36,7.83]).setContent(_buildAptPopup('DEP','Lahr',512,'EDTL',{countryCode:'DE'})).openOn(map);});
  const colors=await page.evaluate(()=>{const root=document.querySelector('.ga-airport-popup'),link=root.querySelector('[data-ga-airport-aip]');return {text:getComputedStyle(root).color,link:getComputedStyle(link).color,background:getComputedStyle(root).backgroundColor};});
  function luminance(css){const rgb=css.match(/[\d.]+/g).slice(0,3).map(v=>{const c=Number(v)/255;return c<=.04045?c/12.92:((c+.055)/1.055)**2.4;});return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2];}
  for(const color of [colors.text,colors.link])assert.ok((luminance(color)+.05)/(luminance(colors.background)+.05)>=4.5,JSON.stringify(colors));
  if(width===838&&scale===1)await page.screenshot({path:'/tmp/ga-efb-airport-fixed.png'});
  await page.evaluate(()=>map.closePopup());cases++;
 }
 assert.deepEqual(errors,[]);console.log(`PASS ${cases} photo-layout cases: corner follow, mouse/touch drag without pointer capture, no-grid context columns, airport text/link contrast`);
}finally{await browser.close();}
