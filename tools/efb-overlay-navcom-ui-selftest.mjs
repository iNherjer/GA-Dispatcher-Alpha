import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url), {chromium}=require(process.env.GA_PLAYWRIGHT_MODULE||'playwright');
const efb=require('../ga-tracker-client/tracker-efb-web-client');
let config={};
const display=require('../ga-tracker-client/tracker-efb-display-settings').createDisplaySettingsControl({readConfig:()=>config,writeConfig:value=>(config=value,true)});
async function displayRoute(route) {
  const command=route.request().method()==='POST'?route.request().postDataJSON():null;
  await route.fulfill({contentType:'application/json',body:JSON.stringify(command?display.update(command):{display:display.snapshot()})});
}
const browser=await chromium.launch({headless:true,...(process.env.GA_CHROME_EXECUTABLE?{executablePath:process.env.GA_CHROME_EXECUTABLE}:{})});
let mode='off', cases=0;
try {
  const context=await browser.newContext({viewport:{width:838,height:883}}), page=await context.newPage(), errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',async route=>{
    const p=new URL(route.request().url()).pathname;
    if(p==='/')return route.fulfill({contentType:'text/html',body:efb.createTrackerEfbWebClientPage()});
    if(p==='/api/v1/display/settings')return displayRoute(route);
    if(p==='/api/v1/navcom/settings') {
      if(route.request().method()==='POST')mode=route.request().postDataJSON().mode;
      return route.fulfill({contentType:'application/json',body:JSON.stringify({ok:true,mode,pending:false})});
    }
    const asset=efb.getTrackerEfbWebClientAsset(p);
    if(asset){let body=asset.body;if(p.endsWith('/host.js'))body=body.toString().replace(/\}\)\(\);\s*$/,`pollingClosed=true;window.__overlayTest={mode:setDisplayMode,scale:setEfbFontScale,layers:function(){return layerControl;},map:function(){return map;}};})();`);return route.fulfill({contentType:asset.contentType,body});}
    return route.fulfill({contentType:'application/json',body:'{"available":false,"ok":true,"items":[]}'});
  });
  await page.goto('http://127.0.0.1/');await page.waitForFunction(()=>window.__overlayTest?.layers());
  const control=page.locator('.leaflet-control-layers'), toggle=page.locator('.leaflet-control-layers-toggle');
  await control.evaluate(e=>window.__stableLayerParent=e.parentElement);
  for(const surface of ['physical','popout','toolbar'])for(const scale of [1,1.5,3]) {
    await page.evaluate(({surface,scale})=>{__overlayTest.mode(false,surface);__overlayTest.scale(scale);},{surface,scale});
    await page.waitForTimeout(100);
    for(let i=0;i<3;i++) {
      await toggle.click();
      assert.equal(await control.evaluate(e=>e.classList.contains('leaflet-control-layers-expanded')),true);
      assert.equal(await control.evaluate(e=>e.parentElement===__stableLayerParent),true);
      assert.equal(await page.locator('.leaflet-control-container').evaluate(e=>e.style.zIndex),'');
      const style=await control.evaluate(e=>({visibility:getComputedStyle(e).visibility,opacity:getComputedStyle(e).opacity,background:getComputedStyle(e).backgroundColor}));
      assert.equal(style.visibility,'visible');assert.equal(style.opacity,'1');assert.notEqual(style.background,'rgba(0, 0, 0, 0)');
      const menuRect=await control.boundingBox();assert.ok(menuRect.x>=0&&menuRect.x+menuRect.width<=838.5&&menuRect.y+menuRect.height<=883.5,JSON.stringify(menuRect));
      await page.evaluate(()=>__overlayTest.layers().collapse());
      assert.equal(await control.evaluate(e=>e.parentElement===__stableLayerParent),true);
      await toggle.click();await page.evaluate(()=>document.body.click());
      assert.equal(await control.evaluate(e=>e.classList.contains('leaflet-control-layers-expanded')),false);
      const follow=page.locator('#autoFollowBtn');await follow.click();
      assert.equal(await follow.evaluate(e=>getComputedStyle(e).visibility),'visible');
      assert.ok((await follow.textContent()).trim().length>0);
      cases++;
    }
    // This real pointer click proves the tab escaped its scrolling ancestor.
    await page.locator('#mapToolbarToggle').click();await page.waitForTimeout(320);
    assert.equal(await page.evaluate(()=>document.body.classList.contains('toolbar-collapsed')),true);
    const tab=page.locator('#mapToolbarToggle');const rect=await tab.boundingBox();
    assert.ok(rect&&rect.y>=0&&rect.y+rect.height<=883);
    await tab.click();await page.waitForTimeout(320);
    assert.equal(await page.evaluate(()=>document.body.classList.contains('toolbar-collapsed')),false);
  }
  await page.evaluate(()=>{__overlayTest.mode(false,'physical');__overlayTest.scale(1);gaSetNavcomMode('select');});
  await page.waitForFunction(()=>document.body.dataset.navcomMode==='select');
  await page.waitForTimeout(100);assert.equal(mode,'select');
  await page.locator('#mapToolbarToggle').click();
  await page.waitForFunction(()=>document.body.classList.contains('toolbar-collapsed'));
  await page.waitForTimeout(150);assert.equal(display.snapshot().ui.toolbarCollapsed,true);
  await context.close();
  const fresh=await browser.newContext(), second=await fresh.newPage();
  await second.route('**/*',async r=>{
    const p=new URL(r.request().url()).pathname;
    if(p==='/')return r.fulfill({contentType:'text/html',body:efb.createTrackerEfbWebClientPage()});
    if(p==='/api/v1/display/settings')return displayRoute(r);
    if(p==='/api/v1/navcom/settings')return r.fulfill({contentType:'application/json',body:JSON.stringify({mode,ok:true})});
    const a=efb.getTrackerEfbWebClientAsset(p);return a?r.fulfill({contentType:a.contentType,body:a.body}):r.fulfill({contentType:'application/json',body:'{"available":false,"ok":true,"items":[]}'});
  });
  await second.goto('http://127.0.0.1/');await second.waitForFunction(()=>document.body.dataset.navcomMode==='select');
  await second.waitForFunction(()=>document.body.classList.contains('toolbar-collapsed'));
  await second.locator('#mapToolbarToggle').click();
  await second.waitForFunction(()=>!document.body.classList.contains('toolbar-collapsed'));
  await second.locator('.leaflet-control-layers-toggle').click();
  await second.screenshot({path:'/tmp/ga-efb-overlay-navcom.png'});
  await fresh.close();assert.deepEqual(errors,[]);
  console.log(`PASS ${cases} menu/follow cycles, 9 collapse/reopen scale/surface cases and NAVCOM across fresh storage`);
} finally {await browser.close();}
