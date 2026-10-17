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
    for (const fraction of [.1,.9]) assert.equal(await page.evaluate(({rect,fraction})=>document.elementFromPoint(rect.x+rect.width/2,rect.y+rect.height*fraction)?.closest('button')?.id,{rect,fraction}),'mapToolbarToggle','whole handle stays in front of the map');
    await tab.click();await page.waitForTimeout(320);
    assert.equal(await page.evaluate(()=>document.body.classList.contains('toolbar-collapsed')),false);
    await page.evaluate(()=>{mapDrawState.panelOpen=false;syncMapDrawUi();const area=document.getElementById('mapArea'),rail=document.getElementById('mapDrawRail');clampMapDrawFloatingButtonPosition({left:6,top:area.clientHeight-rail.offsetHeight-6});});
    const pen=page.locator('#mapDrawFloatingBtn');
    const before=await pen.boundingBox();
    await pen.click();await page.waitForTimeout(100);
    const after=await pen.boundingBox();assert.ok(Math.abs(before.y-after.y)<1,'opening tools never pushes the pen away from the edge');
    await page.evaluate(()=>{mapDrawState.panelOpen=false;syncMapDrawUi();});
    const area=await page.locator('#mapArea').boundingBox(),button=await pen.boundingBox();
    await page.mouse.move(button.x+button.width/2,button.y+button.height/2);await page.mouse.down();
    await page.mouse.move(area.x+button.width/2,area.y+button.height/2,{steps:8});await page.mouse.up();
    const dragged=await pen.boundingBox();assert.ok(dragged.x-area.x<=6*scale+1&&dragged.y-area.y<=6*scale+1,'pen can be dragged to the top/left edge');
    await page.evaluate(()=>{const a=document.getElementById('mapArea'),r=document.getElementById('mapDrawRail');clampMapDrawFloatingButtonPosition({left:6,top:a.clientHeight-r.offsetHeight-6});});
    await page.evaluate(scale=>__overlayTest.scale(scale),scale===3?1:3);await page.waitForTimeout(120);
    const resizedArea=await page.locator('#mapArea').boundingBox(),resizedPen=await pen.boundingBox();
    const factor=await page.evaluate(()=>GAEfbUiScale.state().effective);
    assert.ok(Math.abs(resizedArea.y+resizedArea.height-resizedPen.y-resizedPen.height-6*factor)<2,'bottom position survives scale changes');
    await page.evaluate(scale=>__overlayTest.scale(scale),scale);await page.waitForTimeout(100);
  }
  await page.evaluate(()=>{__overlayTest.mode(false,'physical');__overlayTest.scale(1);gaSetNavcomMode('select');});
  for(const selector of ['.telemetry-box','.map-draw-menu','#vpSettingsMenu','#mapVoiceMenu']) {
    const backgrounds=await page.locator(selector).evaluateAll(nodes=>nodes.map(e=>getComputedStyle(e).backgroundColor));
    assert.ok(backgrounds.length);for(const background of backgrounds)assert.equal(background,'rgb(23, 33, 43)','Modern panels use opaque EFB surfaces');
  }
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
  console.log(`PASS ${cases} menu/follow cycles; 9 full-handle, pen drag/open/scale cases; opaque Modern panels; collapsed restart and NAVCOM across fresh storage`);
} finally {await browser.close();}
