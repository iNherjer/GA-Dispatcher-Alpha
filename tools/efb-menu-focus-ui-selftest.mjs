import {createRequire} from 'node:module';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.GA_PLAYWRIGHT_MODULE || 'playwright');
const efb=require('../ga-tracker-client/tracker-efb-web-client');
const browser=await chromium.launch({headless:true,...(process.env.GA_CHROME_EXECUTABLE ? {executablePath:process.env.GA_CHROME_EXECUTABLE} : {})});
const results=[];
const baseline = process.env.GA_MENU_BASELINE_REF;
const before = baseline ? Object.fromEntries([
 ['/efb/v1/assets/map-profile-controls.js','ga-tracker-client/efb-web-assets/map-profile-controls.js'],
 ['/efb/v1/assets/floating-layout.js','ga-tracker-client/tracker-efb-floating-layout.js']
].map(([url,file])=>[url,execFileSync('git',['show',baseline+':'+file])])) : {};

try {
for(const surface of ['physical','popout','toolbar']) {
 const page=await browser.newPage({viewport:{width:838,height:883}});
 const errors=[]; page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',async route=>{
 const p=new URL(route.request().url()).pathname;
 if(p==='/')return route.fulfill({contentType:'text/html',body:efb.createTrackerEfbWebClientPage()});
 const asset=efb.getTrackerEfbWebClientAsset(p);
 if(asset){let body=before[p] || asset.body;
 if(p.endsWith('/host.js'))body=body.toString().replace(/\}\)\(\);\s*$/,`pollingClosed=true;window.__probe={mode:setDisplayMode,flight:renderFlight,scale:setEfbFontScale};})();`);
 return route.fulfill({contentType:asset.contentType,body});}
 if(p==='/api/v1/audio/settings')return route.fulfill({contentType:'application/json',body:JSON.stringify({audio:{schema:'ga.audio-control.v1',revision:1,updatedAt:1,target:{mode:'pc',deviceId:'pc',name:'PC'},settings:{enabled:true,audioStyle:'intercom_noise',voicePack:'',volume:1}}})});
 return route.fulfill({contentType:'application/json',body:'{"available":false,"items":[],"ok":true}'});
 });
 await page.goto('http://127.0.0.1/');await page.waitForFunction(()=>window.__probe&&document.getElementById('gaAudioOutputSelect'));
 await page.evaluate(surface=>{__probe.mode(surface!=='physical',surface);__probe.scale(1);},surface);
 await page.waitForTimeout(250);
 for (const vr of [false,true]) {
 await page.evaluate(({surface,vr})=>__probe.mode(vr,surface),{surface,vr});
 await page.waitForTimeout(120);
 for (const menuId of ['mapVoiceMenu','mapHintsMenu','vpSettingsMenu']) {
 const result=await page.evaluate(async menuId=>{
 const frame=()=>new Promise(r=>requestAnimationFrame(r));
 _closeFloatingMenus();
 window.gaTrackerAudioClient.apply({schema:'ga.audio-control.v1',revision:1,updatedAt:1,target:{mode:'pc',deviceId:'pc',name:'PC'},settings:{enabled:true,audioStyle:'intercom_noise',voicePack:'',volume:1}});
 const ids={mapVoiceMenu:'mapVoiceBtn',mapHintsMenu:'mapHintsBtn',vpSettingsMenu:'btnVpSettings'};
 const menu=document.getElementById(menuId);
 _openFloatingMenuInViewport(menu,document.getElementById(ids[menuId]),menuId==='vpSettingsMenu');
 await frame();await frame();
 const control=menuId==='mapVoiceMenu' ? document.getElementById('gaAudioOutputSelect') :
 Array.from(menu.querySelectorAll('input,select,button')).find(el=>!el.disabled&&el.getClientRects().length);
 if(!control)throw Error('No visible input in '+menuId);
 document.querySelectorAll('[data-ga-focus-probe]').forEach(el=>el.removeAttribute('data-ga-focus-probe'));
 control.setAttribute('data-ga-focus-probe','true');
 window.__menuProbeClicks=0;control.addEventListener('click',()=>window.__menuProbeClicks++,{once:true});
 control.focus();let removals=0,adds=0,styles=0,blur=0;
 control.addEventListener('blur',()=>blur++);
 const watcher=new MutationObserver(records=>{for(const r of records){if(r.type==='attributes'&&r.target===menu)styles++;
 for(const n of r.removedNodes)if(n===menu)removals++;
 for(const n of r.addedNodes)if(n===menu)adds++;}});
 watcher.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['style']});
 const before=document.activeElement===control;
 for(let i=0;i<10;i++){__probe.flight({available:true,lat:48.36,lon:7.83,alt:4500,hdg:90,capturedAt:Date.now(),flight:{gsKts:0,aglFt:2700}});await frame();await frame();}
 watcher.disconnect();
 return {before,after:document.activeElement===control,removals,adds,styles,blur};
 },menuId);
 if(!baseline || surface==='physical') {
 assert.equal(result.before,true);assert.equal(result.after,true,JSON.stringify({surface,vr,menuId,result}));
 assert.equal(result.removals,0);assert.equal(result.adds,0);assert.equal(result.styles,0);assert.equal(result.blur,0);
 } else {assert.ok(result.removals>=10);assert.equal(result.after,false);}
 if(!baseline) {
 const input=page.locator('[data-ga-focus-probe]');
 const rect=await input.boundingBox();assert.ok(rect);
 await page.mouse.move(rect.x+rect.width/2,rect.y+rect.height/2);
 await page.mouse.down();
 await page.evaluate(async()=>{__probe.flight({available:true,lat:48.36,lon:7.83,alt:4500,hdg:90,capturedAt:Date.now(),flight:{gsKts:0,aglFt:2700}});await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});
 await page.mouse.up();
 result.clicks=await page.evaluate(()=>window.__menuProbeClicks);
 assert.equal(result.clicks,1,JSON.stringify({surface,vr,menuId,result}));
 await page.keyboard.press('Escape');
 }
 results.push({surface,vr,menuId,...result});
 }
 }
 assert.deepEqual(errors,[]);await page.close();

}
fs.writeFileSync(path.join(process.env.GA_EFB_SCREENSHOT_DIR || os.tmpdir(),'ga-efb-menu-focus-results.json'),JSON.stringify(results,null,2));console.log('PASS stable menu DOM, styles, focus and click handlers across '+results.length+' physical/popout/toolbar 2D/VR cases'+(baseline?' (baseline reproduction)':''));
}finally{await browser.close();}
