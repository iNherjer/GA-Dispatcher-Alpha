#!/usr/bin/env node
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { render } from './apt-legacy-ui-characterization-selftest.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.GA_PLAYWRIGHT_MODULE || 'playwright');
const html = fs.readFileSync('index.html', 'utf8');
const source = fs.readFileSync('ga-tracker-client/tracker-efb-kartentisch-host.js', 'utf8');
const slice = (a,b) => source.slice(source.indexOf(a),source.indexOf(b,source.indexOf(a)));
const functions = slice('  var telemetryPrevious = null;', '  function renderProgress()')
  + slice('  function fontScaleElements()', '  function setEfbFontScale(value)')
  + slice('  function renderMissionActionBanner(payload)', '  function updateMissionLiveFields(view)');
const styles = fs.readFileSync('styles.css','utf8');
const hostStyles = fs.readFileSync('ga-tracker-client/tracker-efb-kartentisch-host.css','utf8');
const fixtures = [render(), render({ state: { phase: 'prepare' } }),
 render({ state: { phase: 'boarding' }, scene: { boardingPreparing: true } }),
 render({ state: { phase: 'boarding' }, scene: { boardingComplete: true, boardingVoiceComplete: true } }),
 render({ state: { phase: 'boarded' } })];
const browser = await chromium.launch({ headless:true, ...(process.env.GA_CHROME_EXECUTABLE ? { executablePath:process.env.GA_CHROME_EXECUTABLE } : {}) });
try {
 for (const width of [1024,800,390]) for (const [index,model] of fixtures.entries()) {
  const results=[];
  for (const efb of [false,true]) {
   const page=await browser.newPage({viewport:{width,height:768}});
   // DOMParser does not execute scripts or fetch the reference page's assets.
   await page.setContent('<body><div id="fixture" style="position:relative;width:100vw;height:768px;overflow:hidden"></div></body>');
   await page.evaluate(({html,efb})=>{
    const doc=new DOMParser().parseFromString(html,'text/html');
    document.body.className=efb?'ga-efb-tracker-host':'';
    for(const id of ['missionStartBanner','liveTelemetryBox','liveCurrentBox','liveNextWpBox']) {
     const node=doc.getElementById(id);document.getElementById('fixture').appendChild(document.importNode(node,true));
     document.getElementById(id).style.display='block';
    }
   },{html,efb});
   await page.addStyleTag({content:styles});if(efb)await page.addStyleTag({content:hostStyles});
   await page.addStyleTag({content:'html,body{margin:0!important;padding:0!important;overflow:hidden!important}'});
   await page.evaluate(({functions,model,efb})=>{
    const byId=id=>document.getElementById(id);
    byId('currentPosRef').textContent='0.2 NM SE EDTW';
    byId('currentFreqValue').textContent='FIS 128.950';
    byId('currentFreqSource').textContent='Offenes Gebiet';
    byId('nextWpName').textContent='EDTL';
    if(efb){
     window.model={...model,key:'test',missionId:'test'};
     (0,eval)(`var missionIntentPending=false,missionBannerDismissedKey='',preferences={fontScale:1};
      function clamp(n,a,b){return Math.max(a,Math.min(b,n))}
      function nodeInsideSvg(n){return !!n.closest('svg')}
      function isFiniteNumber(n){return typeof n==='number'&&isFinite(n)}
      function byId(id){return document.getElementById(id)}
      function setText(id,value){var n=byId(id);if(n)n.textContent=value}
      function setupMissionActionBanner(){return byId('missionStartBanner')}
      function missionActionBannerModel(){return window.model}
      ${functions}
      renderMissionActionBanner({});applyEfbFontScale();
      updateStandaloneTelemetry({capturedAt:1000,altFt:2000,gsKts:72.6});
      updateStandaloneTelemetry({capturedAt:3000,altFt:2010,gsKts:72.6});`);
    } else {
     const b=byId('missionStartBanner');b.style.display='flex';
     for(const [name,flag] of [['is-begin-action',model.begin],['is-end-ready',model.endReady],['is-final-action',model.final]])b.classList.toggle(name,flag);
     byId('missionStartBannerKicker').textContent=model.kicker;
     byId('missionStartBannerText').textContent=model.text;
     byId('missionStartBannerBtn').textContent=model.button;
     byId('missionStartBannerBtn').disabled=model.disabled;
     byId('teleAGL').textContent=2010;byId('teleAGL').style.color='#ffcc44';
     byId('teleGS').textContent=(72.6).toFixed(1);
     byId('teleVS').textContent=Math.round((2010-2000)/2*60);
     byId('teleVS').style.color='var(--green)';
    }
   },{functions,model,efb});
   await page.evaluate(()=>document.fonts.ready);
   results.push(await page.evaluate(()=>['missionStartBanner','liveTelemetryBox','liveCurrentBox','liveNextWpBox'].map(id=>{
    const n=document.getElementById(id),r=n.getBoundingClientRect(),c=getComputedStyle(n);
    return {id,text:n.innerText,box:[r.x,r.y,r.width,r.height].map(v=>Math.round(v*10)/10),padding:c.padding,background:c.backgroundColor};
   })));
   await page.screenshot({path:`/tmp/ga-map-${width}-${index}-${efb?'efb':'standalone'}.png`});
   await page.close();
  }
  assert.deepEqual(results[1],results[0],`map geometry and text: ${width} scenario ${index}`);
  console.log(`PASS map banner + three telemetry boxes: ${width}, scenario ${index}`);
 }
} finally { await browser.close(); }
