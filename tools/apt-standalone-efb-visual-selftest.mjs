#!/usr/bin/env node
// Optional browser regression. Set GA_PLAYWRIGHT_MODULE and GA_CHROME_EXECUTABLE
// when using an externally bundled Playwright/Chrome. No personal browser profile.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { renderStandaloneFixture } from './apt-legacy-cargo-ui-characterization-selftest.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.GA_PLAYWRIGHT_MODULE || 'playwright');
const now = Date.now();
const cargo = {id:'box',storyName:'Medizinische Ausrüstung',itemType:'cargo',required:true,status:'loaded',weightLbs:24,station:'auto',delivery:'destination'};
const pax = {id:'pax',storyName:'Dr. Test',itemType:'passenger',required:true,status:'loaded',weightLbs:180,station:'auto',delivery:'destination'};
const cases = [
 {name:'load-with-pax',mode:'load',phase:'boarding',flags:{boardingConfirmed:true,groundStill:true},summary:{departureMissing:0},items:[pax,cargo]},
 {name:'reload-pax',mode:'load',phase:'boarding',flags:{boardingConfirmed:true,groundStill:true},summary:{departureMissing:1},items:[{...pax,status:'unloaded'},cargo]},
 {name:'load',mode:'load',phase:'boarding',flags:{boardingConfirmed:true,groundStill:true},summary:{departureMissing:0},items:[cargo]},
 {name:'arrival-before-signature',mode:'unload',phase:'end_unloading',endReady:true,flags:{active:true,groundStill:true},summary:{destinationRemaining:0},items:[pax,{...cargo,status:'unloaded'}]},
 {name:'arrival-signed',mode:'unload',phase:'end_unloading',endReady:true,flags:{active:true,groundStill:true},summary:{destinationRemaining:0},signed:true,items:[pax,{...cargo,status:'unloaded'}]},
 {name:'long-list',mode:'load',phase:'boarding',flags:{boardingConfirmed:true,groundStill:true},summary:{departureMissing:0},items:Array.from({length:24},(_,i)=>({...cargo,id:'box-'+i,storyName:'Ausrüstung '+(i+1)}))}
];
const fixtures=cases.map(c=>{
 const scenario={...c,allowedActions:['request_pax_interaction','set_manifest_item','sign_manifest','clear_manifest_signature','confirm_unload','confirm_load'],
 manifest:{aircraftSlot:'PA-24',pilotId:'DEINA',createdAt:now,...(c.signed?{dispatchSignature:{scope:'arrival',by:'DEINA',at:now-10000,aircraft:'PA-24'}}:{}),items:c.items}};
 const f=renderStandaloneFixture(scenario);
 return {name:c.name,...f};
});
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.GA_CHROME_EXECUTABLE ? {executablePath:process.env.GA_CHROME_EXECUTABLE} : {})});
 try {
 const source=fs.readFileSync('ga-tracker-client/tracker-efb-kartentisch-host.js','utf8');
 const part=(a,b)=>source.slice(source.indexOf(a),source.indexOf(b,source.indexOf(a)));
 const functions=part('  function cargoActionAttributes(', '  function cargoPayloadStatusMarkup(')+part('  function ensureCargoManager()', '  function openCargoManager()');
 const styles=fs.readFileSync('styles.css','utf8'),hostStyles=fs.readFileSync('ga-tracker-client/tracker-efb-kartentisch-host.css','utf8');

 for(const size of [{width:1024,height:768},{width:800,height:480},{width:390,height:660}]) for(const f of fixtures){
  const pages=[];
  for(const efb of [false,true]){
   const page=await browser.newPage({viewport:size});pages.push(page);
   await page.setContent(`<body class="${efb?'ga-efb-tracker-host':''}"><div class="mission-cargo-overlay" style="display:flex">${efb?'':f.markup}</div></body>`);
   await page.addStyleTag({content:styles});
   if(efb){
    await page.addStyleTag({content:hostStyles});
    await page.evaluate(({functions,model})=>{
     window.model=model;
     (0,eval)(`var missionIntentPending=false, missionIntentQueue=null, missionIntentStatus='', missionIntentTone='', cargoSignatureAnimationEndsAt=0, cargoSignatureAnimationTimer=0, cargoSignatureAnimationScope='', cargoManagerOpen=true,cargoManagerSignature='';
      var missionSnapshot={ui:{cargo:window.model}};
      function byId(id){return document.getElementById(id)}
      function drawerEscape(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
      function cargoDateLabel(value){return new Date(Number(value)).toLocaleString('de-DE',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'})}
      function projectedCargoModel(){return window.model}
      function cargoManagerMarkup(){return appCargoManagerMarkup(missionSnapshot,window.model)}
      ${functions}
      ensureCargoManager().style.display='flex';renderCargoManager();`);
    },{functions,model:f.model});
    await page.locator('body > .mission-cargo-overlay:not(#gaEfbCargoManager)').evaluate(e=>e.remove());
   }
  }
  const measure=async page=>page.evaluate(()=>{
   const panel=document.querySelector('.mission-cargo-panel');
   const selectors=['.mission-cargo-panel','.mission-cargo-head','.mission-cargo-copy','.mission-cargo-clipboard','.mission-cargo-signature','.mission-cargo-actions'];
   return {text:panel.innerText.replace(/\s+/g,' ').trim(),boxes:selectors.map(s=>{const e=document.querySelector(s);if(!e)return null;const r=e.getBoundingClientRect();return [r.x,r.y,r.width,r.height].map(v=>Math.round(v*10)/10)}),scrollHeight:panel.scrollHeight};
  });
  await Promise.all(pages.map(page=>page.evaluate(()=>document.fonts.ready)));
  const [a,b]=await Promise.all(pages.map(measure));
  assert.equal(b.text,a.text,`${f.name} text`);
  assert.deepEqual(b.boxes,a.boxes,`${f.name} ${size.width} geometry`);
  if(f.name==='long-list')for(const page of pages){await page.locator('.mission-cargo-panel').hover();await page.mouse.wheel(0,10000);await page.waitForTimeout(120);const r=await page.locator('.mission-cargo-actions').boundingBox();assert(r.y>=0&&r.y+r.height<=size.height);}
  for(let i=0;i<pages.length;i++){await pages[i].screenshot({path:`/tmp/ga-cargo-${f.name}-${size.width}-${i?'efb':'standalone'}.png`});await pages[i].close();}
  console.log('PASS identical text, panel geometry and reachable actions',f.name,size.width);
 }
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
