const {chromium}=require(process.env.GA_PLAYWRIGHT_MODULE || 'playwright');
const fs=require('fs');const assert=require('assert/strict');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.GA_CHROME_EXECUTABLE || 'C:/Program Files/Google/Chrome/Application/chrome.exe'});try{const page=await browser.newPage({viewport:{width:1000,height:600}});
const root=require('path').resolve(__dirname,'../ga-tracker-client/toolbar-panel/PackageSources/html_ui/InGamePanels/VfrMultitool') + '/';
await page.setContent(`<style>${fs.readFileSync(root+'Panel.css','utf8')}body{width:4000px;height:2400px;transform:scale(.25);transform-origin:top left}#VfrMultitoolPanel{position:absolute;top:80px;left:80px;width:3200px;height:1200px}ingame-ui-header{display:block;height:240px;width:3200px}.action-list{position:absolute;right:0;width:240px;height:240px}</style><div id="VfrMultitoolPanel"><ingame-ui-header><div class="wrap">TITLE</div><div class="action-list"></div></ingame-ui-header></div><div id="vfr-frame-container"></div><div id="vfr-status"></div><div id="vfr-offline"></div><div id="vfr-statusbar"></div><button id="vfr-retry"></button><button id="vfr-close"></button><div id="vfr-window-controls"><button id="vfr-minimize"><span class="vfr-minimize-icon"></span></button><button id="vfr-window-close"><span class="vfr-close-icon"></span></button></div>`);
await page.evaluate(()=>{window.XMLHttpRequest=function(){this.open=()=>{};this.send=()=>{};this.abort=()=>{}};const p=document.getElementById('VfrMultitoolPanel');p.active=true;p.visible=true;p.minimized=false;});
await page.addScriptTag({path:root+'Panel.js'});await page.waitForTimeout(300);
const v=await page.evaluate(()=>{const b=document.getElementById('vfr-minimize').getBoundingClientRect(),c=document.getElementById('vfr-window-controls').getBoundingClientRect(),h=document.querySelector('ingame-ui-header').getBoundingClientRect();return {width:b.width,height:b.height,top:c.top,right:c.right,headerTop:h.top,headerHeight:h.height}});assert(Math.abs(v.height-48)<1,JSON.stringify(v));assert(Math.abs(v.top-26)<1,JSON.stringify(v));assert(Math.abs(v.right-756)<1,JSON.stringify(v));const stroke=await page.evaluate(()=>parseFloat(getComputedStyle(document.querySelector('.vfr-minimize-icon')).borderBottomWidth)*0.25);assert.equal(stroke,2,'Visible icon stroke');await page.screenshot({path:require('path').join(process.env.GA_EFB_SCREENSHOT_DIR || require('os').tmpdir(),'ga-window-controls-transform025.png')});
const samples=[];
for(const scale of [.25,.5,1,2]) {
  await page.evaluate(scale=>{
    document.body.style.transform='scale('+scale+')';
    document.body.style.width=(1000/scale)+'px';
    document.body.style.height=(600/scale)+'px';
    const panel=document.getElementById('VfrMultitoolPanel');
    panel.style.left=(20/scale)+'px';panel.style.top=(80/scale)+'px';panel.style.width=(800/scale)+'px';
    const header=document.querySelector('ingame-ui-header');header.style.height=(60/scale)+'px';header.style.width='100%';
    document.querySelector('.action-list').style.width=(60/scale)+'px';
  },scale);
  await page.waitForTimeout(150);
  const geometry=await page.evaluate(scale=>{
    const button=document.getElementById('vfr-minimize'),icon=button.querySelector('span');
    const b=button.getBoundingClientRect(),c=document.getElementById('vfr-window-controls').getBoundingClientRect();
    const h=document.querySelector('ingame-ui-header').getBoundingClientRect(),a=document.querySelector('.action-list').getBoundingClientRect();
    return {scale,width:b.width,height:b.height,top:c.top,right:c.right,targetTop:h.top+6,targetRight:a.left-4,stroke:parseFloat(getComputedStyle(icon).borderBottomWidth)*scale};
  },scale);
  for(const [actual,expected] of [[geometry.width,54],[geometry.height,48],[geometry.top,geometry.targetTop],[geometry.right,geometry.targetRight],[geometry.stroke,2]])assert(Math.abs(actual-expected)<1,JSON.stringify(geometry));
  samples.push(geometry);
}
console.log('TRANSFORMED_HEADER_BROWSER_PASS',JSON.stringify({initial:v,scaleAndMove:samples}));}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
