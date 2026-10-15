import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.GA_PLAYWRIGHT_MODULE||'/Users/jofaist/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.GA_CHROME_EXECUTABLE||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
let cases=0;
try {
 for(const mode of [1,0.7,1.5,'efb']) {
  const efb=mode==='efb';
  const page=await browser.newPage({viewport:{width:390,height:844}});
  await page.route('**/*',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><body></body>'}));
  await page.goto('http://floating.test/');
  await page.addStyleTag({content:fs.readFileSync('styles.css','utf8')});
  await page.addStyleTag({content:'html,body{margin:0!important;padding:0!important;min-height:0!important;width:390px;height:844px;overflow:hidden!important;scrollbar-gutter:auto!important}'});
  await page.evaluate(html=>{const doc=new DOMParser().parseFromString(html,'text/html');const board=document.createElement('div');board.id='mapTableOverlay';board.className='active';board.style.cssText='width:220px;height:300px;left:60px;top:180px;overflow:hidden;transform:translate3d(0,0,0)';const area=document.createElement('div');area.style.cssText='height:100%;overflow:hidden';board.appendChild(area);document.body.appendChild(board);for(const id of ['mapStopwatchDevice','mapCalculatorDevice'])area.appendChild(doc.getElementById(id));},fs.readFileSync('index.html','utf8'));
  if(!efb)await page.evaluate(zoom=>{document.body.style.zoom=String(zoom);document.body.style.width=(390/zoom)+'px';document.body.style.height=(844/zoom)+'px';},mode);
  if(efb)await page.evaluate(()=>{document.body.style.width=(390/1.5)+'px';document.body.style.height=(844/1.5)+'px';document.body.style.transform='scale(1.5)';document.body.style.transformOrigin='0 0';window.GAEfbUiScale={delta:v=>v/1.5,viewport:()=>({width:innerWidth/1.5,height:innerHeight/1.5})};});
  await page.addScriptTag({content:fs.readFileSync('display-clock.js','utf8')});
  await page.addScriptTag({content:fs.readFileSync(efb?'ga-tracker-client/efb-web-assets/map-utility-tools.js':'map-utility-tools.js','utf8')});
  for(const tool of ['stopwatch','calculator']) {
   await page.evaluate(t=>openMapUtilityTool(t),tool);
   const prefix=tool==='stopwatch'?'mapStopwatch':'mapCalculator';
   assert.equal(await page.locator('#'+prefix+'Device').evaluate(n=>n.parentNode===document.body||n.parentNode.id==='mapUtilityViewport'),true,'device escapes clipped map container');
   await page.evaluate(()=>document.getElementById('mapTableOverlay').classList.remove('active'));
   await page.waitForTimeout(20);
   assert.equal(await page.locator('#'+prefix+'Device').evaluate(n=>getComputedStyle(n).visibility),'hidden');
   await page.evaluate(()=>document.getElementById('mapTableOverlay').classList.add('active'));
   await page.waitForTimeout(20);
   assert.equal(await page.locator('#'+prefix+'Device').evaluate(n=>getComputedStyle(n).visibility),'visible');
   const oldCentre=await page.locator('#'+prefix+'Device').evaluate(n=>{const r=n.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};});
   await page.evaluate(id=>{document.getElementById(id+'Scale').click();document.getElementById(id+'Scale').click();},prefix);
   await page.waitForTimeout(200);
   assert.equal(await page.locator('#'+prefix+'Device').evaluate(n=>n.style.transform),'scale(2)');
   const newCentre=await page.locator('#'+prefix+'Device').evaluate(n=>{const r=n.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};});
   assert.ok(Math.abs(oldCentre.x-newCentre.x)<1&&Math.abs(oldCentre.y-newCentre.y)<1,'zoom keeps centre');
   // Real mouse gestures from all four sides of the clock's bezel at maximum zoom.
   if(tool==='stopwatch')for(const edge of ['left','right','top','bottom']) {
    const point=await page.locator('#'+prefix+'Device').evaluate((n,edge)=>{
     const delta=mtEfbDelta;
     const r=n.getBoundingClientRect();n.style.left=delta((innerWidth-r.width)/2)+'px';n.style.top=delta((innerHeight-r.height)/2)+'px';
     const b=n.querySelector('.stopwatch-bezel').getBoundingClientRect(),x=(b.left+b.right)/2,y=(b.top+b.bottom)/2;
     return {x:edge==='left'?b.left+8:edge==='right'?b.right-8:x,y:edge==='top'?b.top+28:edge==='bottom'?b.bottom-8:y,left:n.getBoundingClientRect().left};
    },edge);
    // A real pointer can reach only the rim points currently inside the phone viewport.
    if(point.x>=0&&point.x<390&&point.y>=0&&point.y<844){await page.mouse.move(point.x,point.y);await page.mouse.down();await page.mouse.move(point.x+25,point.y+15,{steps:4});await page.mouse.up();const moved=await page.locator('#'+prefix+'Device').evaluate(n=>n.getBoundingClientRect().left);assert.ok(Math.abs(moved-point.left-25)<1,JSON.stringify({edge,point,moved}));cases++;}
   }
   for(const [dx,dy] of [[-10000,0],[10000,0],[0,-10000],[0,10000],[-10000,-10000],[10000,-10000],[-10000,10000],[10000,10000]]) {
    const result=await page.locator('#'+prefix+'Device').evaluate((panel,{dx,dy})=>{
     const handle=panel.querySelector('.map-utility-drag-handle'),r=handle.getBoundingClientRect();
     // Start on a free housing edge; the entire device receives the captured gesture.
     handle.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0,pointerId:17,clientX:r.left+2,clientY:r.top+r.height/2}));
     panel.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,pointerId:17,clientX:r.left+2+dx,clientY:r.top+r.height/2+dy}));
     panel.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerId:17}));
     const b=panel.getBoundingClientRect();const bezel=panel.id==='mapStopwatchDevice'?panel.querySelector('.stopwatch-bezel').getBoundingClientRect():null;return {cx:(b.left+b.right)/2,cy:(b.top+b.bottom)/2,dw:b.width,dh:b.height,w:innerWidth,h:innerHeight,bezel:bezel?{x:bezel.left+bezel.width/2,y:bezel.top+bezel.height/2,r:bezel.width/2}:null};
    },{dx,dy});
    assert.ok(result.cx>=-.3*result.dw-1&&result.cx<=result.w+.3*result.dw+1&&result.cy>=-.3*result.dh-1&&result.cy<=result.h+.3*result.dh+1,JSON.stringify({mode,tool,dx,dy,...result}));
    if(tool==='calculator') {
     if(dx)assert.ok(Math.abs(result.cx-(dx<0?-.3*result.dw:result.w+.3*result.dw))<1);
     if(dy)assert.ok(Math.abs(result.cy-(dy<0?-.3*result.dh:result.h+.3*result.dh))<1);
    }
    if(result.bezel){const c=result.bezel;const outside=Math.hypot(c.x-Math.max(0,Math.min(result.w,c.x)),c.y-Math.max(0,Math.min(result.h,c.y)));assert.ok(outside<=c.r*.9+1,'clock rim must remain reachable in corners');}
    if(!efb) {
    const scroll=await page.locator('#'+prefix+'Device').evaluate(n=>{n.querySelector('button').focus();return {root:document.documentElement.scrollLeft,body:document.body.scrollLeft,map:document.getElementById('mapTableOverlay').scrollLeft,host:document.getElementById('mapUtilityViewport')?.scrollLeft||0};});
    assert.deepEqual(scroll,{root:0,body:0,map:0,host:0},'focus must not displace map layout');
    }
    cases++;
   }
   const recovery=await page.locator('#'+prefix+'Device').evaluate(n=>{const delta=mtEfbDelta,r=n.getBoundingClientRect();n.style.left=delta(-r.width*.8)+'px';n.style.top=delta((innerHeight-r.height)/2)+'px';const h=n.querySelector('.map-utility-drag-handle').getBoundingClientRect();return {x:h.right-4,y:Math.max(5,Math.min(innerHeight-5,h.top+h.height/2)),left:n.getBoundingClientRect().left};});
   await page.mouse.move(recovery.x,recovery.y);await page.mouse.down();await page.mouse.move(recovery.x+80,recovery.y,{steps:6});await page.mouse.up();
   assert.ok(Math.abs(await page.locator('#'+prefix+'Device').evaluate(n=>n.getBoundingClientRect().left)-recovery.left-80)<1,'device is recoverable from its 20% strip');cases++;
   // A lower clock field is draggable too; controls must not initiate a drag.
   const before=await page.locator('#'+prefix+'Device').evaluate(n=>n.style.left);
   await page.locator('#'+prefix+'Scale').evaluate(n=>{n.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0,pointerId:18}));n.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,pointerId:18,clientX:100}));n.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerId:18}));});
   assert.equal(await page.locator('#'+prefix+'Device').evaluate(n=>n.style.left),before);
   await page.evaluate(t=>closeMapUtilityTool(t),tool);
  }
  if(mode===1||efb)for(const skin of ['ui','ipod']) {
   await page.addStyleTag({content:fs.readFileSync('media-player.css','utf8')});
   await page.addScriptTag({content:fs.readFileSync('media-player-'+skin+'.js','utf8')});
   await page.evaluate(s=>{window.__media=(s==='ipod'?GAMediaIPodUI:GAMediaPlayerUI).create({host:document.body});__media.open();},skin);
   for(const [dx,dy] of [[-10000,0],[10000,0],[0,-10000],[0,10000]]) {
    const result=await page.evaluate(({dx,dy})=>{const n=__media.element,r=n.getBoundingClientRect();for(const [type,x,y] of [['pointerdown',r.left+2,r.bottom-4],['pointermove',r.left+2+dx,r.bottom-4+dy],['pointerup',0,0]])n.dispatchEvent(new PointerEvent(type,{bubbles:true,button:0,pointerId:20,clientX:x,clientY:y}));const b=n.getBoundingClientRect();return {cx:(b.left+b.right)/2,cy:(b.top+b.bottom)/2,dw:b.width,dh:b.height,skin:n.className,rect:b.toJSON(),layer:n.parentNode.getBoundingClientRect().toJSON(),width:n.parentNode.clientWidth,height:n.parentNode.clientHeight};},{dx,dy});
    assert.ok(result.cx>=-.3*result.dw-1&&result.cx<=390+.3*result.dw+1&&result.cy>=-.3*result.dh-1&&result.cy<=844+.3*result.dh+1,JSON.stringify(result));cases++;
   }
   await page.evaluate(()=>__media.destroy());
  }
  await page.close();
 }
 for(const efb of [false,true]) {
  const page=await browser.newPage({viewport:{width:390,height:844}});
  await page.route('**/*',r=>{const pathname=new URL(r.request().url()).pathname;const file=(efb?'ga-tracker-client/efb-web-assets':'')+pathname;const source=efb?file:pathname.slice(1);if(!pathname.startsWith('/e6b/')||pathname.includes('..')||!fs.existsSync(source))return r.fulfill({status:404,body:''});r.fulfill({contentType:source.endsWith('.js')?'text/javascript':source.endsWith('.css')?'text/css':source.endsWith('.json')?'application/json':source.endsWith('.svg')?'image/svg+xml':'text/html',body:fs.readFileSync(source)});});
  await page.goto('http://floating.test/e6b/e6b-flight-computer.html?embedded=1'+(efb?'&coherent=1':''));
  await page.waitForTimeout(200);
  for(const side of ['front','wind']) {
   await page.evaluate(side=>{document.querySelector('[data-side="'+side+'"]').click();window.postMessage({type:'ga-e6b-set-base-size',frontWidth:330,windWidth:300},'*');},side);
   await page.waitForTimeout(80);
   for(const [dx,dy] of [[-10000,0],[10000,0],[0,-10000],[0,10000]]) {
    await page.evaluate(({dx,dy})=>window.postMessage({type:'ga-e6b-pan-view',dx,dy},'*'),{dx,dy});
    await page.waitForTimeout(30);
    const result=await page.evaluate(side=>{const b=document.querySelector(side==='wind'?'.wind-stack':'.front-stack').getBoundingClientRect();return {cx:(b.left+b.right)/2,cy:(b.top+b.bottom)/2,dw:b.width,dh:b.height};},side);
    assert.ok(result.cx>=-.3*result.dw-1&&result.cx<=390+.3*result.dw+1&&result.cy>=-.3*result.dh-1&&result.cy<=844+.3*result.dh+1,JSON.stringify({efb,side,...result}));cases++;
   }
  }
  await page.close();
 }
 console.log('PASS '+cases+' floating-device edge cases at phone size, standalone and scaled EFB; utility zoom and control exclusions');
}finally{await browser.close();}
