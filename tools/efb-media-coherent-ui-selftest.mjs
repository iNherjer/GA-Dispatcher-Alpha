import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.GA_PLAYWRIGHT_MODULE||'/Users/jofaist/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const efb=require('../ga-tracker-client/tracker-efb-web-client');
const {createAudioControl}=require('../ga-tracker-client/tracker-audio-control-core');
const browser=await chromium.launch({headless:true,executablePath:process.env.GA_CHROME_EXECUTABLE||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
let cases=0;
try {
 for(const role of ['efb','toolbar'])for(const scale of [1,1.5]) {
  const control=createAudioControl(),page=await browser.newPage({viewport:{width:1100,height:950}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
   // Reproduce the missing CSS/input capabilities rather than only using modern Chrome defaults.
   window.PointerEvent=undefined;Element.prototype.setPointerCapture=undefined;
   ['pointerdown','pointermove','pointerup','pointercancel'].forEach(type=>addEventListener(type,e=>{if(e.isTrusted)e.stopImmediatePropagation();},true));
  });
  await page.route('**/*',async route=>{
   const p=new URL(route.request().url()).pathname;
   if(p==='/')return route.fulfill({contentType:'text/html',body:efb.createTrackerEfbWebClientPage().replace('data-role="auto"','data-role="'+role+'"')});
   if(p.endsWith('/audio/settings'))return route.fulfill({contentType:'application/json',body:JSON.stringify({ok:true,audio:control.snapshot()})});
   if(p.endsWith('/audio/playback')){const payload=route.request().postDataJSON();return route.fulfill({contentType:'application/json',body:JSON.stringify(payload.action==='settings_update'?control.update(payload):{ok:true,audio:control.snapshot()})});}
   const a=efb.getTrackerEfbWebClientAsset(p);
   if(a){const body=a.contentType.includes('css')?a.body.toString().replace(/\b(?:inset|gap|grid-template-columns)\s*:[^;}]+;?/g,'').replace(/display\s*:\s*grid\s*;?/g,''):a.body;return route.fulfill({contentType:a.contentType,body});}
   return route.fulfill({contentType:'application/json',body:'{"available":false,"items":[],"ok":true}'});
  });
  await page.goto('http://coherent.test/');
  await page.waitForFunction(()=>window.gaMediaPlayerClient&&document.getElementById('gaMediaEnabledCheckToggle'));
  await page.evaluate(scale=>{GAEfbUiScale.apply(scale,'physical',false);window.gaMediaRequest=()=>Promise.resolve({ok:true,players:[{source:'test',name:'Test'}],source:'test',title:'Coherent fixture',volume:.5,volumeAvailable:true,duckEnabled:true,duckFactor:.2,controls:{}});toggleMapVoiceMenu();},scale);
  assert.equal(await page.locator('.ga-efb-host-state').count(),0);
  const enabled=page.locator('#gaMediaEnabledCheckToggle');
  assert.equal(await enabled.getAttribute('aria-checked'),'false');await enabled.click();
  assert.equal(await enabled.getAttribute('aria-checked'),'true');
  assert.equal(await enabled.locator('svg path').count(),1);
  assert.equal(await enabled.locator('.ga-audio-checkmark').evaluate(n=>getComputedStyle(n).display),'block');
  const skin=page.locator('.ga-efb-media-choices[aria-label="Medien-Skin"]');
  await skin.getByRole('button',{name:'iPod',exact:true}).click();
  assert.equal(await skin.getByRole('button',{name:'iPod',exact:true}).getAttribute('aria-pressed'),'true');
  await page.evaluate(()=>toggleMapVoiceMenu());

  const launch=page.getByRole('button',{name:'Mediensteuerung öffnen',exact:true});
  let r=await launch.boundingBox(),header=await page.locator('#mapTableOverlay .pinboard-header').boundingBox();
  assert.ok(r.y>=header.y+header.height,JSON.stringify({role,scale,r,header}));
  // Only legacy mouse events reach the UI in this context.
  await page.mouse.move(r.x+r.width/2,r.y+r.height/2);await page.mouse.down();await page.mouse.move(r.x+r.width/2+70,r.y+r.height/2+35,{steps:5});await page.mouse.up();
  const moved=await launch.boundingBox();assert.ok(Math.abs(moved.x-r.x-70)<2,'legacy mouse drag must move launcher');
  await page.waitForTimeout(300);await launch.click();const device=page.getByRole('region',{name:'iPod Mediensteuerung'});await device.waitFor({state:'visible'});
  r=await device.boundingBox();assert.ok(r.width>=150*scale&&r.height>=250*scale,JSON.stringify(r));assert.ok(r.y>=header.y+header.height);
  // Switch back with the EFB button group, not a native select popup.
  await page.evaluate(()=>toggleMapVoiceMenu());await skin.locator('[data-value=winamp]').click();
  assert.ok(await page.getByRole('region',{name:'Winamp Mediensteuerung'}).isVisible());
  assert.equal(await page.locator('.ga-media-layer').evaluate(n=>n.clientWidth>500&&n.clientHeight>200),true);
  await page.evaluate(()=>toggleMapVoiceMenu());
  const winamp=page.getByRole('region',{name:'Winamp Mediensteuerung'});r=await winamp.boundingBox();
  const clock=await page.locator('.ga-media-clock').boundingBox(),now=await page.locator('.ga-media-now').boundingBox();assert.ok(clock.x+clock.width<=now.x,'Winamp columns must not stack without CSS Grid');
  await page.mouse.move(r.x+5,r.y+r.height/2);await page.mouse.down();await page.mouse.move(r.x+65,r.y+r.height/2,{steps:5});await page.mouse.up();
  assert.ok(Math.abs((await winamp.boundingBox()).x-r.x-60)<2,'legacy device edge drag');
  const touchBefore=(await winamp.boundingBox()).x;
  await winamp.evaluate(n=>{const r=n.getBoundingClientRect(),x=r.left+5,y=r.top+r.height/2;function fire(type,dx){const touch=new Touch({identifier:7,target:n,clientX:x+dx,clientY:y});n.dispatchEvent(new TouchEvent(type,{bubbles:true,cancelable:true,touches:type==='touchend'?[]:[touch],changedTouches:[touch]}));}fire('touchstart',0);fire('touchmove',30);fire('touchend',30);});
  assert.ok(Math.abs((await winamp.boundingBox()).x-touchBefore-30)<2,'legacy touch edge drag');
  await page.evaluate(()=>{const original=gaMediaRequest;window.__lastMediaVolume=null;window.gaMediaRequest=p=>{if(p.action==='volume')window.__lastMediaVolume=p.volume;return original(p);};});
  await page.evaluate(()=>{const d=document.querySelector('.ga-media-device');d.style.left='20px';});const volume=await page.locator('.ga-media-volume').boundingBox();await page.mouse.move(volume.x+8,volume.y+volume.height/2);await page.mouse.down();await page.mouse.move(volume.x+volume.width-8,volume.y+volume.height/2,{steps:8});await page.mouse.up();await page.waitForTimeout(50);
  assert.ok(await page.evaluate(()=>window.__lastMediaVolume>.8),'native volume drag must remain usable with legacy fallback: '+JSON.stringify(await page.evaluate(()=>({last:window.__lastMediaVolume,value:document.querySelector('.ga-media-volume').value,disabled:document.querySelector('.ga-media-volume').disabled}))) );
  assert.deepEqual(errors,[]);await page.screenshot({path:'/tmp/ga-coherent-media-'+role+'-'+scale+'.png'});cases++;await page.close();
 }
 console.log('PASS '+cases+' EFB/toolbar Coherent capability cases: no inset/Grid/gap, no pointer capture/events, painted checkbox, skin buttons, launcher and device drag, header bounds');
} finally {await browser.close();}
