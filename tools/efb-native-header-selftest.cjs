'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.GA_PLAYWRIGHT_MODULE || 'playwright');
const repo = path.resolve(__dirname, '..');
const sim = process.env.GA_SIM_UI_ROOT || 'G:/SteamLibrary/steamapps/common/MSFS2024/Packages/fs-base-ui/html_ui';
const panelDir = path.join(repo, 'ga-tracker-client/toolbar-panel/PackageSources/html_ui/InGamePanels/VfrMultitool');
const read = p => fs.readFileSync(p, 'utf8');
function method(source, name) {
  const start = source.indexOf('    ' + name + '(');
  assert(start >= 0, name);
  const brace = source.indexOf('{', start);
  let depth = 1, i = brace + 1;
  while (depth && i < source.length) { if (source[i] === '{') depth++; if (source[i] === '}') depth--; i++; }
  return source.slice(start, i);
}
(async () => {
 const browser = await chromium.launch({executablePath:process.env.GA_CHROME_EXECUTABLE || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true});
 try {
  const page = await browser.newPage({viewport:{width:1200,height:800}});
  page.on('pageerror', e => console.error('PAGE_ERROR', e.message));
  const headerTemplate = read(path.join(sim,'Templates/ingameUiHeader/ingameUiHeader.html')).match(/<script type="text\/html"[^>]*>([\s\S]*?)<\/script>/)[1];
  const nativePanel = read(path.join(sim,'Templates/ingameUi/ingameUi.js'));
  // Real installed header template, header handlers and panel action methods.
  // Framework/navigation/toolbar transport are browser substitutes, not Coherent.
  await page.setContent(`<style>:root{--screenHeight:1080px;--baseMargin:4px;--fontSizeDefault:16px}body{margin:0;transform-origin:0 0}ingame-ui{display:flex;flex-direction:column;position:absolute;left:80px;top:80px;width:900px;height:600px;background:#182c3a}ingame-ui-header{height:60px!important;min-height:60px!important;max-height:60px!important}.hide{display:none}icon-button{display:flex;background:#37586d;color:white;align-items:center;justify-content:center}icon-button.Reduce:before{content:'−'}icon-button.Maximize:before{content:'□'}icon-button.Close:before{content:'×'}icon-button{font-size:24px}</style><ingame-ui id="VfrMultitoolPanel" panel-id="PANEL_VFR_MULTITOOL"><ingame-ui-header title="VFR Multitool">${headerTemplate}</ingame-ui-header><div class="vfr-shell"><div id="vfr-statusbar"><span id="vfr-status"></span><button id="vfr-retry">Retry</button><button id="vfr-close">Close</button></div><div id="vfr-offline">Offline test fixture</div><div id="vfr-frame-container"></div></div></ingame-ui>`);
  await page.addStyleTag({content:read(path.join(sim,'Templates/ingameUiHeader/ingameUiHeader.css'))});
  await page.addStyleTag({content:read(path.join(panelDir,'Panel.css'))});
  await page.evaluate(() => {
   window.checkAutoload = () => {};
   window.Coherent = {translate:s=>s};
   window.TemplateElement = class extends HTMLElement {
    static get observedAttributes(){return [];}
    static call(el,fn){fn();}
    connectedCallback(){}
    attributeChangedCallback(){}
    setVisible(show){this.m_visible=show;this.classList.toggle('hide',!show);}
   };
   customElements.define('icon-button', class extends TemplateElement {
    constructor(){super();this.onClick=e=>{e.stopPropagation();this.dispatchEvent(new Event('OnValidate'));};}
    connectedCallback(){this.addEventListener('click',this.onClick);}
    disconnectedCallback(){this.removeEventListener('click',this.onClick);}
   });
   customElements.define('ui-button',class extends TemplateElement {});
   const panel=document.querySelector('ingame-ui');
   panel.active=true; panel.visible=true; panel.attached=true; panel.classList.add('attached');
   Object.defineProperty(panel,'minimized',{get(){return this.classList.contains('minimized');}});
   panel.headerElement=panel.querySelector('ingame-ui-header');
   window.calls=[];
   panel.m_toolbar_listener={setMinimized:(id,value)=>calls.push({op:'minimize',id,value}),setButtonChildActive:(id,value)=>{calls.push({op:'active',id,value});panel.active=value;panel.classList.add('inactive');panel.dispatchEvent(new Event('panelInactive'));},pushLocalPanelVisibility:(id,value)=>calls.push({op:'visible',id,value})};
   panel.panelID='PANEL_VFR_MULTITOOL'; panel.sendRect=()=>{};panel.sendUpdatePanelSize=()=>{};panel.handleByGame=false;
   panel.animations={animateOpen:()=>({play(){},addTimelineEventListener(){}}),animateMinimize:()=>({play(){},addTimelineEventListener(){}})};
   window.XMLHttpRequest=class{open(){}send(){}abort(){}};
  });
  await page.addScriptTag({content:read(path.join(sim,'Templates/ingameUiHeader/ingameUiHeader.js'))});
  await page.addScriptTag({content:`Object.assign(document.querySelector('ingame-ui'), {${['closePanel','ToggleMinimized','setMinimizedClassState'].map(n=>method(nativePanel,n)).join(',')}});`});
  await page.evaluate(() => {
   const h=document.querySelector('ingame-ui-header');h.setStates(false,true,true,false,false,true);h.setCloseable(true);
  });
  await page.addScriptTag({content:read(path.join(panelDir,'Panel.js'))});
  const matrix=[];
  for(const scale of [.25,.5,1,2]) {
   await page.evaluate(scale=>{document.body.style.transform=`scale(${scale})`;document.body.style.width=1200/scale+'px';document.body.style.height=800/scale+'px';const p=document.querySelector('ingame-ui');p.style.left=20/scale+'px';p.style.top=60/scale+'px';p.style.width=900/scale+'px';const h=p.querySelector('ingame-ui-header');h.style.setProperty('height',60/scale+'px','important');h.style.setProperty('min-height',60/scale+'px','important');h.style.setProperty('max-height',60/scale+'px','important');},scale);
   await page.waitForFunction(() => Math.abs(document.querySelector('icon-button.Close').getBoundingClientRect().height - 48) < 1);
   const row=await page.evaluate(()=>{
    const p=document.querySelector('ingame-ui'),h=p.querySelector('ingame-ui-header'),b=h.querySelector('.Close'),r=b.getBoundingClientRect(),hr=h.getBoundingClientRect();
    const target=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);
    return{headerRight:hr.right,right:r.right,top:r.top,width:r.width,height:r.height,hit:target===b||b.contains(target),hitTarget:target&&target.outerHTML.slice(0,150),inHeader:h.contains(b),nativeVisible:b.m_visible,overlay:!!document.querySelector('#vfr-window-controls')};
   });
   assert(Math.abs(row.headerRight-row.right)<1,JSON.stringify(row));assert(Math.abs(row.height-48)<1,JSON.stringify(row));assert(Math.abs(row.width-54)<1,JSON.stringify(row));assert(row.hit&&row.inHeader&&row.nativeVisible&&!row.overlay,JSON.stringify(row));
   await page.waitForTimeout(500);
   await page.locator('icon-button.Reduce').click();await page.waitForTimeout(70);
   assert(await page.evaluate(()=>document.querySelector('ingame-ui').minimized),JSON.stringify(await page.evaluate(()=>window.calls)));
   await page.waitForTimeout(500);
   await page.locator('icon-button.Maximize').click();await page.waitForTimeout(70);
   assert(!(await page.evaluate(()=>document.querySelector('ingame-ui').minimized)));
   matrix.push({scale,...row});
  }
  if(process.env.GA_EFB_SCREENSHOT_DIR) await page.screenshot({path:path.join(process.env.GA_EFB_SCREENSHOT_DIR,'native-header-browser.png')});
  await page.locator('icon-button.Close').click();
  const calls=await page.evaluate(()=>window.calls);
  assert.equal(calls.filter(c=>c.op==='minimize').length,8);assert(calls.every(c=>c.id==='PANEL_VFR_MULTITOOL'));assert(calls.some(c=>c.op==='visible'&&c.value===false));
  console.log(JSON.stringify({status:'NATIVE_HEADER_BROWSER_PASS',scope:'Installed simulator header/methods with stub framework and toolbar transport; real Coherent/VR unverified',matrix,calls},null,2));
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
