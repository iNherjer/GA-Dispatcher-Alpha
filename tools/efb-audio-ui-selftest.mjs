import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.GA_PLAYWRIGHT_MODULE || 'playwright');
const efb=require('../ga-tracker-client/tracker-efb-web-client');
const {createAudioControl}=require('../ga-tracker-client/tracker-audio-control-core');
const control=createAudioControl();
const browser=await chromium.launch({headless:true,...(process.env.GA_CHROME_EXECUTABLE?{executablePath:process.env.GA_CHROME_EXECUTABLE}:{})});
let hold=false, conflict=false, failNext=false, writes=0;
try {
 const contexts=await Promise.all([browser.newContext(),browser.newContext()]);
 const pages=await Promise.all(contexts.map(c=>c.newPage()));
 const errors=[];
 for(const page of pages){
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{window.testVoiceRuntime=false;window.paxVoiceSetEnabled=(on,options)=>{if(!options?.sync)throw Error('Remote state must not replay old speech');window.testVoiceRuntime=on;};});
 await page.route('**/*',async route=>{
 const path=new URL(route.request().url()).pathname;
 if(path==='/')return route.fulfill({contentType:'text/html',body:efb.createTrackerEfbWebClientPage().replace('data-role="auto"','data-role="efb"')});
 if(path.endsWith('/audio/settings'))return route.fulfill({contentType:'application/json',body:JSON.stringify({ok:true,audio:control.snapshot()})});
 if(path.endsWith('/audio/playback')){
 const payload=route.request().postDataJSON();
 if(payload.action==='settings_update'){
 writes++;
 if(failNext){failNext=false;return route.fulfill({contentType:'application/json',body:JSON.stringify({ok:false,error:'audio_persist_failed',audio:control.snapshot()})});}
 if(hold)await new Promise(r=>setTimeout(r,350));
 if(conflict){conflict=false;control.update({expectedRevision:control.snapshot().revision,settings:{volume:.55}});}
 return route.fulfill({contentType:'application/json',body:JSON.stringify(control.update(payload))});
 }
 return route.fulfill({contentType:'application/json',body:'{"ok":true}'});
 }
 const asset=efb.getTrackerEfbWebClientAsset(path);
 if(asset)return route.fulfill({contentType:asset.contentType,body:asset.body});
 return route.fulfill({contentType:'application/json',body:'{"available":false,"items":[],"ok":true}'});
 });
 await page.goto('http://127.0.0.1/');
 await page.waitForFunction(()=>document.getElementById('gaAudioMasterEnabledToggle'),{},{timeout:5000}).catch(async error=>{console.log(JSON.stringify({errors,state:await page.evaluate(()=>({client:!!window.gaTrackerAudioClient,cockpit:!!window.gaCockpitSessionClient,menu:document.getElementById('mapVoiceMenu')?.textContent,master:!!document.getElementById('gaAudioMasterEnabled')}))}));throw error;});
 await page.evaluate(()=>toggleMapVoiceMenu(true));
 }
 const check='gaAudioMasterEnabledToggle';
 for(const page of pages){
 assert.equal(await page.locator('#'+check).getAttribute('aria-checked'),'true');
 assert.equal(await page.locator('#'+check+' .ga-audio-checkmark').evaluate(e=>getComputedStyle(e).display),'block');
 assert.equal(await page.locator('#mapVoiceMenu').evaluate(e=>!!e.closest('#mapTableOverlay')),false,'Portaled menu must retain checkmark styling');
 assert.match(await page.locator('#gaTrackerAudioOutput').textContent(),/Multitool-Audio aktivieren/);
 assert.equal(await page.locator('#gaAudioMasterHelp').isVisible(),false);
 assert.match(await page.locator('#gaAudioMasterEnabledToggle').getAttribute('title'),/alle Multitool-Warnungen/);
 assert.match(await page.locator('#awmPaxVoiceCheckToggle').getAttribute('title'),/keine neuen TTS-Anfragen/);
 assert.match(await page.locator('#awmPaxVoiceCheckToggle').getAttribute('aria-label'),/Missions-\/Passagierstimmen/);
 }
 const old=control.snapshot();hold=true;conflict=true;
 await pages[0].locator('#'+check).click();
 await pages[0].evaluate(value=>gaTrackerAudioClient.apply(value),old);
 assert.equal(await pages[0].locator('#'+check).getAttribute('aria-checked'),'false','In-flight mute must survive an old poll');
 await pages[0].waitForFunction(()=>document.getElementById('gaAudioOutputStatus').textContent==='Ausgabe: PC' && document.getElementById('gaAudioMasterEnabledToggle').getAttribute('aria-checked')==='false');
 await pages[1].waitForFunction(()=>document.getElementById('gaAudioMasterEnabledToggle').getAttribute('aria-checked')==='false');
 assert.equal(control.snapshot().settings.enabled,false);assert.equal(control.snapshot().settings.volume,.55,'Concurrent volume change survives mute retry');
 assert.equal(writes,2,'Revision conflict is retried once');
 hold=false;
 await pages[1].locator('#'+check).click();
 await pages[0].waitForFunction(()=>document.getElementById('gaAudioMasterEnabledToggle').getAttribute('aria-checked')==='true');
 assert.equal(control.snapshot().settings.enabled,true);
 await pages[0].locator('#awmTerrainWarnCheckToggle').click();
 await pages[1].waitForFunction(()=>document.getElementById('awmTerrainWarnCheckToggle').getAttribute('aria-checked')==='false');
 assert.equal(control.snapshot().settings.terrain,false);
 assert.equal(control.snapshot().settings.enabled,true,'Individual warning switch leaves master enabled');
 failNext=true;await pages[0].locator('#'+check).click();
 await pages[0].waitForFunction(()=>document.getElementById('gaAudioOutputStatus').textContent.includes('nicht gespeichert'));
 assert.equal(await pages[0].locator('#'+check).getAttribute('aria-checked'),'true','Rejected write restores authoritative state');
 assert.equal(control.snapshot().settings.enabled,true);
 assert.equal(await pages[0].locator('#awmPaxVoiceCheckToggle').getAttribute('aria-checked'),'true');
 assert.equal(await pages[0].evaluate(()=>testVoiceRuntime),true,'Central initial value updates stale local runtime');
 assert.equal(await pages[0].locator('#awmPaxGenerationCheck').count(),0,'No competing generation checkbox');
 await pages[0].locator('#awmPaxVoiceCheckToggle').click();
 await pages[1].waitForFunction(()=>document.getElementById('awmPaxVoiceCheckToggle').getAttribute('aria-checked')==='false');
 assert.equal(control.snapshot().settings.paxEnabled,false);
 assert.equal(await pages[1].evaluate(()=>gaPaxVoiceEnabled()),false);
 assert.equal(await pages[1].evaluate(()=>testVoiceRuntime),false);
 await pages[1].locator('#awmPaxVoiceCheckToggle').click();
 await pages[0].waitForFunction(()=>document.getElementById('awmPaxVoiceCheckToggle').getAttribute('aria-checked')==='true' && testVoiceRuntime===true);
 assert.equal(await pages[0].evaluate(()=>gaPaxVoiceEnabled()),true);
 failNext=true;await pages[0].locator('#awmPaxVoiceCheckToggle').click();
 await pages[0].waitForFunction(()=>document.getElementById('gaAudioOutputStatus').textContent.includes('nicht gespeichert'));
 assert.equal(await pages[0].evaluate(()=>gaPaxVoiceEnabled() && testVoiceRuntime),true,'Failed save restores same effective voice state');
 assert.equal(control.snapshot().settings.enabled,true,'Voice switch leaves warnings master enabled');
 let sliderCases=0;
 for(const surface of ['physical','toolbar'])for(const scale of [1,1.5,3]){
 await pages[0].setViewportSize({width:402,height:580});
 await pages[0].waitForTimeout(80);
 await pages[0].evaluate(({surface,scale})=>{GAEfbUiScale.apply(scale,surface,true);if(document.getElementById('mapVoiceMenu').style.display!=='block')toggleMapVoiceMenu();},{surface,scale});
 await pages[0].waitForTimeout(80);
 for(const value of [0,25,100]){
 await pages[0].locator('#awmVolumeSlider').evaluate((e,value)=>{e.focus();e.value=String(value);e.dispatchEvent(new Event('input',{bubbles:true}));},value);
 await pages[0].locator('#awmVolumeSlider').evaluate(e=>e.scrollIntoView({block:'nearest'}));
 const bounds=await pages[0].evaluate(()=>{const rect=e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom};};return {wrapper:rect(document.querySelector('.ga-audio-volume')),thumb:rect(document.getElementById('gaAudioVolumeThumb')),left:document.getElementById('gaAudioVolumeThumb').style.left};});
 assert.ok(bounds.wrapper.right>bounds.wrapper.left && bounds.thumb.right>bounds.thumb.left,JSON.stringify({surface,scale,value,bounds}));
 assert.ok(bounds.thumb.left>=bounds.wrapper.left-.5 && bounds.thumb.right<=bounds.wrapper.right+.5 && bounds.thumb.top>=bounds.wrapper.top-.5 && bounds.thumb.bottom<=bounds.wrapper.bottom+.5,JSON.stringify({surface,scale,value,bounds}));
 assert.ok(Math.abs((bounds.thumb.top+bounds.thumb.bottom)-(bounds.wrapper.top+bounds.wrapper.bottom))<=1,JSON.stringify({surface,scale,value,bounds,reason:'Thumb must be vertically centered'}));
 assert.equal(bounds.left,value+'%');sliderCases++;
 }
 }
 await pages[0].locator('#awmVolumeSlider').press('Home');
 await pages[1].waitForFunction(()=>document.getElementById('awmVolumeLabel').textContent==='0%',{},{timeout:5000}).catch(async error=>{console.log(JSON.stringify({record:control.snapshot(),first:await pages[0].evaluate(()=>({value:document.getElementById('awmVolumeSlider').value,type:document.getElementById('awmVolumeSlider').type,active:document.activeElement.id,handler:window.awmSetVolume.toString(),label:document.getElementById('awmVolumeLabel').textContent})),errors}));throw error;});
 assert.equal(control.snapshot().settings.volume,0,'Native keyboard input still synchronizes volume');
 assert.deepEqual(errors,[]);
 console.log('PASS '+sliderCases+' volume thumb bounds; generation default and sync; audio checkmarks in portaled menu; pending click; revision retry; bidirectional two-device master/warning synchronization; rejected-write recovery');
}finally{await browser.close();control.close();}
