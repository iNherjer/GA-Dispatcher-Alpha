import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),root=path.resolve(import.meta.dirname,'..');
const {chromium}=require(process.env.GA_PLAYWRIGHT_MODULE||'/Users/jofaist/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const efb=require('../ga-tracker-client/tracker-efb-web-client');
const parser=require('../ga-tracker-client/node_modules/@babel/parser');
const appSource=fs.readFileSync(path.join(root,'app.js'),'utf8');
const names=['setSettingsPanelOpen','closeWin95SettingsWindow','minimizeWin95SettingsWindow'];
const settingsFunctions=parser.parse(appSource,{sourceType:'script'}).program.body.filter(n=>n.type==='FunctionDeclaration'&&names.includes(n.id.name)).map(n=>appSource.slice(n.start,n.end)).join('\n');
const sources=['media-player-ipod.js','vendor/suncalc/suncalc.js','media-player-watch-face.js','media-player-watch.js','media-player-ui.js','display-clock.js','map-utility-tools.js'];
const evidence=path.join(root,'analysis/win95-ui-2026-10-19');fs.mkdirSync(evidence,{recursive:true});
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost'),p=decodeURIComponent(url.pathname);
 if(p==='/web'){
  res.setHeader('Content-Type','text/html; charset=utf-8');
  const stripped=html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');
  res.end(stripped.replace('</body>',sources.map(p=>'<script src="/'+p+'"></script>').join('')+'<script>function isWin95DesktopMode(){return document.body.classList.contains("theme-win95");}function setWin95DesktopTaskActive(){};'+settingsFunctions+'</script></body>'));return;
 }
 if(p==='/efb'||p==='/toolbar'){res.setHeader('Content-Type','text/html; charset=utf-8');res.end(efb.createTrackerEfbWebClientPage().replace('data-role="auto"','data-role="'+p.slice(1)+'"'));return;}
 const asset=efb.getTrackerEfbWebClientAsset(p);if(asset){res.setHeader('Content-Type',asset.contentType);res.end(asset.body);return;}
 if(p.startsWith('/api/')){res.setHeader('Content-Type','application/json');res.end('{"ok":true,"available":false,"items":[]}');return;}
 const file=p.slice(1);
 if(!sources.includes(file)&&!['styles.css','settings-toolroll.css','media-player.css'].includes(file)&&!/^assets\/ui\/settings\/[\w.-]+\.png$/.test(file)){res.writeHead(404);res.end();return;}
 res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'image/png');res.end(fs.readFileSync(path.join(root,file)));
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,executablePath:process.env.GA_CHROME_EXECUTABLE||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const report=[];
try{
 for(const mode of ['web','efb','toolbar'])for(const width of [1000,440]){
  const page=await browser.newPage({viewport:{width,height:850}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',r=>r.request().url().startsWith(base)||r.request().url().startsWith('data:')?r.continue():r.abort());
  await page.goto(base+'/'+mode);await page.waitForFunction(()=>window.GAMediaWatchFace&&window.GAMediaPlayerUI&&window.GAUtilityTime);
  await page.evaluate(()=>{document.getElementById('bootSplash')?.remove();document.body.classList.remove('theme-retro','theme-navcom','theme-ops1940');document.body.classList.add('theme-win95');if(document.querySelector('.settings-shell'))document.documentElement.classList.add('theme-win95-root');});
  if(mode==='web'){
   await page.evaluate(()=>setSettingsPanelOpen(true,false));
   const geometry=await page.evaluate(()=>{const shell=document.querySelector('.settings-shell'),panel=document.getElementById('settingsPanel'),head=document.getElementById('settingsToggleBtn'),label=head.querySelector('.settings-toggle-label'),image=head.querySelector('img');return {shell:shell.getBoundingClientRect().toJSON(),panel:panel.getBoundingClientRect().toJSON(),head:head.getBoundingClientRect().toJSON(),image:getComputedStyle(image).display,label:{text:label.textContent,width:label.getBoundingClientRect().width,height:label.getBoundingClientRect().height,clip:getComputedStyle(label).clipPath},inner:getComputedStyle(panel.querySelector('.settings-panel-inner')).transform,overflow:getComputedStyle(panel).overflowY};});
   assert.equal(geometry.image,'none');assert.equal(geometry.label.text,'Einstellungen');assert.ok(geometry.label.width>70&&geometry.label.height>10,'visible window title');assert.ok(geometry.head.height<=30,'classic title bar');assert.equal(geometry.inner,'none');assert.equal(geometry.overflow,'auto');assert.ok(geometry.panel.bottom<=850,'settings panel stays in viewport');
   await page.locator('.settings-shell').screenshot({path:path.join(evidence,mode+'-'+width+'-settings.png')});
   await page.evaluate(()=>{const p=document.getElementById('settingsPanel');p.scrollTop=p.scrollHeight;});assert.ok(await page.locator('#settingsPanel').evaluate(n=>n.scrollTop>100),'whole settings content scrolls');
   await page.locator('#win95SettingsMinimizeBtn').click();assert.equal(await page.locator('#settingsPanel').getAttribute('aria-hidden'),'true');
   await page.evaluate(()=>setSettingsPanelOpen(true,false));await page.locator('#win95SettingsCloseBtn').click();assert.equal(await page.locator('#settingsPanel').getAttribute('aria-hidden'),'true');
  }
  // Menus are detached to body in production: test the palette in that location.
  for(const id of ['mapHintsMenu','mapVoiceMenu']){
   await page.evaluate(id=>{const m=document.getElementById(id);document.body.appendChild(m);m.style.cssText+=';display:block;position:fixed;top:20px;left:10px;right:auto;max-height:800px;overflow:auto;z-index:999999';if(id==='mapHintsMenu')document.getElementById('clockMenuBlock').style.display='block';},id);
   const style=await page.locator('#'+id).evaluate(n=>({color:getComputedStyle(n).color,bg:getComputedStyle(n).backgroundColor}));assert.equal(style.bg,'rgb(192, 192, 192)');
   await page.locator('#'+id).screenshot({path:path.join(evidence,mode+'-'+width+'-'+id+'.png')});
   await page.locator('#'+id).evaluate(n=>n.style.display='none');
  }
  for(const skin of ['winamp','ipod','watch']){
   await page.evaluate(skin=>{
    if(window.testPlayer)testPlayer.destroy();document.body.classList.remove('theme-win95');
    let host=document.getElementById('win95-skin-test');if(!host){host=document.createElement('div');host.id='win95-skin-test';host.style.cssText='position:fixed;left:0;top:0;width:100vw;height:100vh;z-index:999998;pointer-events:none';document.body.appendChild(host);}
    window.testPlayer=GAMediaPlayerUI.create({host,skin,x:12,y:12,state:window.testMediaState={connected:true,volumeAvailable:true,playing:true,volume:.6,title:'Grüße – Weißer Flügel',artist:'Björk · Sigur Rós',player:'Apple Music',source:'music',players:[{source:'music',name:'Apple Music'}],positionSeconds:98,durationSeconds:567,controls:{seek:true}},getClock:()=>({seconds:36540}),getEnvironment:()=>({time:{seconds:36540},instantMs:Date.UTC(2026,9,19,8,9),offsetSeconds:7200,flight:{lat:48.77,lon:9.18}}),getWeather:()=>({temp2mC:18,mslPressureHpa:1016})});testPlayer.element.parentNode.id='win95-test-layer';testPlayer.open();
   },skin);
   const controls=skin==='winamp'?'.ga-media-key,.ga-media-app-key,.ga-media-close,.ga-media-volume,.ga-media-label':skin==='ipod'?'.ga-ipod-button':'.ga-watch-button';
   const getStyles=()=>page.locator('#win95-test-layer '+controls.split(',').join(',#win95-test-layer ')).evaluateAll(ns=>ns.filter(n=>n.getClientRects().length).map(n=>{const s=getComputedStyle(n);return {tag:n.tagName,cls:n.className,color:s.color,bg:s.backgroundImage+'/'+s.backgroundColor,border:s.border,radius:s.borderRadius,font:s.fontFamily,padding:s.padding};}));
   const before=await getStyles();assert.ok(before.length>0,'rendered skin controls');await page.evaluate(()=>document.body.classList.add('theme-win95'));const after=await getStyles();assert.deepEqual(after,before,'Win95 must preserve '+skin+' controls');
   if(skin==='ipod')await page.evaluate(()=>{
    const canvas=document.querySelector('#win95-test-layer canvas');
    function pixels(title){testPlayer.update(Object.assign({},testMediaState,{title}));return String(canvas.getContext('2d').getImageData(10,56,220,16).data);}
    const missing=pixels('?');for(const char of ['ä','ö','ü','Ä','Ö','Ü','ß','·'])if(pixels(char)===missing)throw Error('missing pixel glyph '+char);
    if(pixels('ä')===pixels('a'))throw Error('umlaut dots missing');if(pixels('a\u0308')!==pixels('ä'))throw Error('decomposed umlaut differs');testPlayer.update(testMediaState);
   });
   await page.locator('#win95-test-layer .ga-media-device').screenshot({path:path.join(evidence,mode+'-'+width+'-'+skin+'.png')});
   if(skin==='ipod'){await page.locator('#win95-test-layer [data-ipod-action=menu]').click();assert.ok(await page.locator('#win95-test-layer .ga-ipod-menu-row').evaluateAll(ns=>ns.every(n=>n.classList.contains('ga-skin-control'))));}
   if(skin==='watch'){await page.locator('#win95-test-layer [data-watch=face]').click();await page.locator('#win95-test-layer .ga-media-device').screenshot({path:path.join(evidence,mode+'-'+width+'-watch-clock.png')});await page.locator('#win95-test-layer [data-watch=timing]').click();await page.locator('#win95-test-layer [data-watch=clock-timer]').click();await page.locator('#win95-test-layer .ga-media-device').screenshot({path:path.join(evidence,mode+'-'+width+'-watch-timer.png')});}
   await page.evaluate(()=>testPlayer.close());assert.equal(await page.locator('#win95-test-layer .ga-media-launcher').evaluate(n=>getComputedStyle(n).borderRadius),'50%','round launcher');
  }
  await page.evaluate(()=>{testPlayer.destroy();document.body.classList.remove('theme-win95');document.getElementById('win95-skin-test').remove();document.getElementById('mapTableOverlay').classList.add('active');openMapUtilityTool('stopwatch');});
  const timerStyle=()=>page.locator('#mapStopwatchStartStop').evaluate(n=>{const s=getComputedStyle(n);return {bg:s.backgroundImage,color:s.color,border:s.border,radius:s.borderRadius};});
  const original=await timerStyle();await page.evaluate(()=>document.body.classList.add('theme-win95'));assert.deepEqual(await timerStyle(),original,'classic stopwatch crown retains its design');
  await page.locator('#mapStopwatchDevice').screenshot({path:path.join(evidence,mode+'-'+width+'-stopwatch.png')});
  assert.deepEqual(errors,[]);report.push({mode,width});await page.close();
 }
 console.log('WIN95_UI_OK',JSON.stringify(report));
}finally{await browser.close();await new Promise(r=>server.close(r));}
