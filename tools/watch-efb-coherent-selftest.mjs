import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdirSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.GA_PLAYWRIGHT_MODULE||'/Users/jofaist/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {createTrackerEfbHttpServer,createTrackerEfbHttpHello}=require('../ga-tracker-client/tracker-efb-http-server');
const {createTrackerCockpitControl}=require('../ga-tracker-client/tracker-cockpit-control-core');
const {createMediaServer}=require('../ga-tracker-client/desktop/lib/media-server');
const {createMediaBridge}=require('../ga-tracker-client/tracker-media-bridge');
const {createMediaRelay}=require('../ga-tracker-client/tracker-media-core');
const native=[],local=[],errors=[];
const evidence=new URL('../analysis/watch-efb-2026-10-19/',import.meta.url);mkdirSync(evidence,{recursive:true});
const state={ok:true,source:'Spotify.exe',title:'Local playback',artist:'EFB test',players:[{source:'Spotify.exe',name:'Spotify'},{source:'Browser.exe',name:'Browser'}],playing:true,positionSeconds:98,durationSeconds:400,volume:.6,volumeAvailable:true,duckEnabled:true,duckFactor:.2,controls:{seek:true,play:true,pause:true,next:true,previous:true}};
const desktop=createMediaServer({request:async command=>{
 native.push(command);
 if(command.action==='select')state.source=command.source;
 if(command.action==='pause')state.playing=false;
 if(command.action==='play')state.playing=true;
 if(command.action==='seek')state.positionSeconds=command.positionSeconds;
 if(command.action==='volume')state.volume=command.volume;
 if(command.action==='duck')return {ok:true};
 return structuredClone(state);
}});
const endpoint=await desktop.start();
const bridge=createMediaBridge({VFR_MULTITOOL_MEDIA_PORT:endpoint.port,VFR_MULTITOOL_MEDIA_TOKEN:endpoint.token});
const execute=createMediaRelay(payload=>bridge.request(payload));
const server=createTrackerEfbHttpServer({port:49880,hello:createTrackerEfbHttpHello({trackerVersion:'v533',trackerVersionCode:533,extraCapabilities:['media.control.v1']}),cockpitControl:createTrackerCockpitControl(),
 mediaControl:command=>{local.push(command);return execute(command);}});
await server.start();
const browser=await chromium.launch({executablePath:process.env.GA_CHROME_EXECUTABLE||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
try {
 for(const [role,width,scale] of [['efb',1000,1],['efb',440,1],['toolbar',1000,1.5],['toolbar',440,1.5]]){
 if(process.env.GA_WATCH_CASE&&process.env.GA_WATCH_CASE!==role+'-'+width)continue;
 const context=await browser.newContext({viewport:{width,height:850}}),page=await context.newPage();
 page.on('pageerror',e=>errors.push(e.message));let relays=0;page.on('websocket',()=>relays++);
 await page.addInitScript(()=>{
  Element.prototype.setPointerCapture=function(){throw Error('test: capture unavailable');};
  CanvasRenderingContext2D.prototype.getImageData=function(){throw Error('test: pixel readback unavailable');};
 });
 await page.route('**/*',async route=>{
  if(new URL(route.request().url()).hostname!=='127.0.0.1')return route.abort();
  if(/\.css(?:\?|$)/.test(route.request().url())){
   const response=await route.fetch();const body=(await response.text()).replace(/\b(?:inset|gap|grid-template-columns)\s*:[^;}]+;?/g,'').replace(/display\s*:\s*grid\s*;?/g,'').replace(/background\s*:\s*color-mix\([^;{}]+;/g,'');
   return route.fulfill({response,body});
  }
  return route.continue();
 });
 await page.goto('http://127.0.0.1:49880/efb/v1/?host='+role);
 await page.waitForFunction(()=>window.gaMediaPlayerClient&&window.gaCockpitSessionClient&&window.gaCockpitSessionClient.session);
 await page.evaluate(()=>toggleMapVoiceMenu());
 await page.locator('label').filter({has:page.locator('#gaMediaEnabledCheck')}).click();
 await page.getByRole('group',{name:'Medien-Skin',exact:true}).getByRole('button',{name:'Watch',exact:true}).click();
 await page.evaluate(()=>toggleMapVoiceMenu());
 await page.getByRole('button',{name:'Mediensteuerung öffnen',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('.ga-watch-source').textContent==='Spotify');
 await page.evaluate(s=>{window.GAEfbUiScale=Object.assign({},window.GAEfbUiScale,{delta:v=>v/s,viewport:()=>({width:innerWidth/s,height:innerHeight/s})});document.body.style.transformOrigin='top left';document.body.style.transform='scale('+s+')';dispatchEvent(new Event('resize'));},scale);
 const device=page.getByRole('region',{name:'Watch Mediensteuerung'});
 const theme=role==='efb'?(width===440?'theme-retro':'theme-modern'):(width===440?'theme-ops1940':'theme-win95');
 await page.evaluate(theme=>{document.body.classList.remove('theme-modern','theme-retro','theme-win95','theme-ops1940');document.body.classList.add(theme);},theme);
 const capture=async view=>{
 await page.waitForTimeout(300);
 await device.screenshot({path:fileURLToPath(new URL(role+'-'+width+'-'+view+'.png',evidence))});
 const geometry=await page.evaluate(()=>['.ga-watch-screen','.ga-watch-header','.ga-watch-clock','.ga-watch-source','.ga-watch-title','.ga-watch-title span','.ga-watch-artist'].map(selector=>{const n=document.querySelector(selector),s=getComputedStyle(n);return {selector,text:n.textContent,rect:n.getBoundingClientRect().toJSON(),color:s.color,font:s.font,display:s.display,visibility:s.visibility,transform:s.transform};}));
 writeFileSync(new URL(role+'-'+width+'-'+view+'.json',evidence),JSON.stringify(geometry,null,2));
 };
 const transportStyle=await page.locator('.ga-watch-toggle').evaluate(n=>{const s=getComputedStyle(n);return {background:s.backgroundColor,border:s.borderTopWidth,color:s.color};});
 assert.deepEqual(transportStyle,{background:'rgba(0, 0, 0, 0)',border:'0px',color:'rgb(255, 255, 255)'},'app theme cannot reskin Watch controls');
 await capture('music');
 // Pure legacy mouse/touch gestures, no PointerEvent or capture dependency.
 for(const kind of ['mouse','touch']){
 await page.waitForTimeout(650);
 const movement=await page.evaluate(({kind,scale})=>{
 const device=document.querySelector('.ga-media-watch'),target=document.querySelector('.ga-watch-title span'),r=target.getBoundingClientRect(),before={x:parseFloat(device.style.left),y:parseFloat(device.style.top)};
 function send(target,type,x,y,end){const point={clientX:x,clientY:y},e=kind==='mouse'?new MouseEvent(type,{bubbles:true,cancelable:true,button:0,...point}):new Event(type,{bubbles:true,cancelable:true});if(kind==='touch'){Object.defineProperty(e,'touches',{value:end?[]:[point]});Object.defineProperty(e,'changedTouches',{value:[point]});}target.dispatchEvent(e);}
 const x=r.x+r.width/2,y=r.y+r.height/2;send(target,kind==='mouse'?'mousedown':'touchstart',x,y,false);send(window,kind==='mouse'?'mousemove':'touchmove',x+20*scale,y+10*scale,false);send(window,kind==='mouse'?'mouseup':'touchend',x+20*scale,y+10*scale,true);
 return {dx:parseFloat(device.style.left)-before.x,dy:parseFloat(device.style.top)-before.y};
 },{kind,scale});assert.ok(Math.abs(movement.dx-20)<2&&Math.abs(movement.dy-10)<2,JSON.stringify({kind,width,scale,movement}));
 const beforeVolume=state.volume;
 await page.evaluate(({kind,scale})=>{
 const target=document.querySelector('.ga-watch-crown'),r=target.getBoundingClientRect(),point={clientX:r.x+r.width/2,clientY:r.y+r.height/2};
 function send(target,type,p,end){const e=kind==='mouse'?new MouseEvent(type,{bubbles:true,cancelable:true,button:0,...p}):new Event(type,{bubbles:true,cancelable:true});if(kind==='touch'){Object.defineProperty(e,'touches',{value:end?[]:[p]});Object.defineProperty(e,'changedTouches',{value:[p]});}target.dispatchEvent(e);}
 send(target,kind==='mouse'?'mousedown':'touchstart',point,false);const next={...point,clientY:point.clientY-14*r.height/56};send(window,kind==='mouse'?'mousemove':'touchmove',next,false);send(window,kind==='mouse'?'mouseup':'touchend',next,true);
 },{kind,scale});await page.waitForTimeout(300);assert.ok(Math.abs(state.volume-beforeVolume-.1)<.02,JSON.stringify({message:'legacy crown changes volume relatively',kind,width,scale,beforeVolume,afterVolume:state.volume,native:native.slice(-3)}));
 }
 await page.getByRole('button',{name:'Gerätegröße einstellen',exact:true}).click();
 for(let i=0;i<6;i++)await page.getByRole('button',{name:'− Verkleinern',exact:true}).click();
 for(const name of ['− Verkleinern','+ Vergrößern']){const hit=await page.getByRole('button',{name,exact:true}).boundingBox();assert.ok(hit.width>90&&hit.height>45,'large zoom hitbox');}
 await page.getByRole('button',{name:'+ Vergrößern',exact:true}).click();
 await page.getByRole('button',{name:'Zurück',exact:true}).click();assert.ok(await device.isVisible(),'back closes size sheet');
 await page.getByRole('button',{name:'Musik-App auswählen',exact:true}).click();await page.locator('.ga-watch-sheet-row').filter({hasText:'Browser'}).click();
 await page.waitForFunction(()=>document.querySelector('.ga-watch-source').textContent==='Browser');
 const beforeX=await device.evaluate(e=>parseFloat(e.style.left));await page.getByRole('button',{name:'Nächster Titel',exact:true}).click();assert.equal(await device.evaluate(e=>parseFloat(e.style.left)),beforeX,'transport button does not drag');
 await page.evaluate(()=>{const instant=Date.UTC(2026,9,19,8,9);window.vpFetchOpenMeteoPoint=async()=>({temp2mC:18,mslPressureHpa:1016});GADisplayClock.observe({simRunning:1,simAbsoluteTimeSeconds:(instant+62135596800000)/1000,simLocalTimeSeconds:36540,lat:48.77,lon:9.18});});
 await page.getByRole('button',{name:'Uhr anzeigen',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('.ga-watch-qnh strong').textContent==='1016');
 assert.match(await page.locator('.ga-watch-sun-label').textContent(),/SR \d{2}:\d{2} · SS \d{2}:\d{2}/);
 await capture('clock');
 await page.getByRole('button',{name:'Stoppuhr und Timer',exact:true}).click();
 await page.getByRole('button',{name:'Zeitmessung starten oder stoppen',exact:true}).click();
 const ticks=await page.evaluate(()=>new Promise(resolve=>{const values=new Set(),observer=new MutationObserver(()=>values.add(document.querySelector('.ga-watch-elapsed').textContent));observer.observe(document.querySelector('.ga-watch-elapsed'),{childList:true,subtree:true});setTimeout(()=>{observer.disconnect();resolve(values.size);},1050);}));
 assert.ok(ticks>=8,'smooth shared stopwatch: '+ticks+' distinct tenths');
 assert.ok(await page.evaluate(()=>GAUtilityTime.snapshot().elapsedMs>250));assert.notEqual(await page.locator('#mapStopwatchElapsed').textContent(),'00:00.0');
 await page.evaluate(()=>document.getElementById('mapStopwatchStartStop').click());await page.waitForTimeout(300);assert.equal(await page.getByRole('button',{name:'Zeitmessung starten oder stoppen',exact:true}).textContent(),'Start');
 await page.getByRole('button',{name:'Zeitmessung zurücksetzen',exact:true}).click();assert.equal(await page.locator('#mapStopwatchElapsed').textContent(),'00:00.0');
 await page.getByRole('button',{name:'Timer',exact:true}).click();assert.ok(await page.locator('.ga-watch-qnh').isHidden());await page.waitForTimeout(300);
 const timerControl=page.getByRole('slider',{name:'Timerdauer in Sekunden per Krone',exact:true});await timerControl.press('ArrowUp');assert.equal(await page.evaluate(()=>GAUtilityTime.snapshot().durationMs),301000);assert.equal(await page.locator('#mapStopwatchTimerValue').textContent(),'05:01');
 await page.waitForTimeout(650);
 await page.evaluate(()=>{const crown=document.querySelector('.ga-watch-crown'),r=crown.getBoundingClientRect(),p={clientX:r.x+r.width/2,clientY:r.y+r.height/2};function send(target,type,point,end){const e=new Event(type,{bubbles:true,cancelable:true});Object.defineProperty(e,'touches',{value:end?[]:[point]});Object.defineProperty(e,'changedTouches',{value:[point]});target.dispatchEvent(e);}send(crown,'touchstart',p,false);const next={...p,clientY:p.clientY-16*r.height/56};send(window,'touchmove',next,false);send(window,'touchend',next,true);});
 assert.equal(await page.evaluate(()=>GAUtilityTime.snapshot().durationMs),303000);assert.equal(await page.locator('#mapStopwatchTimerValue').textContent(),'05:03');
 await capture('timer');
 const timingGeometry=await page.evaluate(()=>{
  const panel=document.querySelector('.ga-watch-timing'),r=panel.getBoundingClientRect();
  return [...panel.querySelectorAll('button,output')].filter(n=>n.getClientRects().length).map(n=>{const b=n.getBoundingClientRect();return {label:n.textContent,inside:b.left>=r.left-1&&b.right<=r.right+1&&b.top>=r.top-1&&b.bottom<=r.bottom+1};});
 });assert.ok(timingGeometry.every(n=>n.inside),JSON.stringify({role,width,timingGeometry}));

 await page.evaluate(()=>GAUtilityTime.setDuration(1000));await page.getByRole('button',{name:'Zeitmessung starten oder stoppen',exact:true}).click();await page.getByRole('button',{name:'Zur Uhr',exact:true}).click();await page.getByRole('button',{name:'Zur Musiksteuerung',exact:true}).click();await page.waitForTimeout(1300);assert.equal(await page.evaluate(()=>GAUtilityTime.snapshot().alarm),true);assert.equal(await page.locator('#mapStopwatchTimerLabel').textContent(),'DONE');
 await page.evaluate(()=>GAUtilityTime.resetTimer());
 const clock=await page.locator('.ga-watch-clock').textContent();assert.match(clock,/^\d{2}:\d{2}$/,'missing sim uses device time');
 await page.screenshot({path:'/tmp/ga-watch-coherent-'+role+'-'+width+'.png'});
 // Hold close in all back-navigation contexts using legacy input only.
 for(const view of ['music','sources','size','clock','timer']){
  if(view!=='music'){await page.waitForTimeout(950);await page.getByRole('button',{name:'Mediensteuerung öffnen',exact:true}).click();if(await page.getByRole('button',{name:'Zur Musiksteuerung',exact:true}).isVisible())await page.getByRole('button',{name:'Zur Musiksteuerung',exact:true}).click();}
  let target=page.getByRole('button',{name:'Uhr anzeigen',exact:true});
  if(view==='sources'){await page.getByRole('button',{name:'Musik-App auswählen',exact:true}).click();target=page.locator('[data-watch-back]');}
  if(view==='size'){await page.getByRole('button',{name:'Gerätegröße einstellen',exact:true}).click();target=page.getByRole('button',{name:'Zurück',exact:true});}
  if(view==='clock'||view==='timer'){await page.getByRole('button',{name:'Uhr anzeigen',exact:true}).click();target=page.getByRole('button',{name:'Zur Musiksteuerung',exact:true});}
  if(view==='timer'){await page.getByRole('button',{name:'Stoppuhr und Timer',exact:true}).click();target=page.getByRole('button',{name:'Zur Uhr',exact:true});}
  await target.evaluate((el,touch)=>{const r=el.getBoundingClientRect(),p={clientX:r.x+r.width/2,clientY:r.y+r.height/2};window.__holdTarget=el;window.__holdPoint=p;const e=touch?new Event('touchstart',{bubbles:true,cancelable:true}):new MouseEvent('mousedown',{bubbles:true,cancelable:true,button:0,...p});if(touch){Object.defineProperty(e,'touches',{value:[p]});Object.defineProperty(e,'changedTouches',{value:[p]});}el.dispatchEvent(e);},width===440);
  await page.waitForTimeout(800);assert.ok(await device.isHidden(),'hold closes '+view);
  await page.evaluate(touch=>{const e=touch?new Event('touchend',{bubbles:true,cancelable:true}):new MouseEvent('mouseup',{bubbles:true,cancelable:true,button:0,...__holdPoint});if(touch){Object.defineProperty(e,'touches',{value:[]});Object.defineProperty(e,'changedTouches',{value:[__holdPoint]});}__holdTarget.dispatchEvent(e);__holdTarget.click();},width===440);
  assert.ok(await device.isHidden(),'release does not reopen '+view);
 }
 assert.equal(relays,0);await context.close();state.source='Spotify.exe';state.volume=.4;
 }
 assert.deepEqual(errors,[]);console.log('WATCH_COHERENT_FALLBACK_OK: EFB/toolbar, 440/1000px, 100/150%, legacy mouse/touch drag and crown without capture, zoom, sources, transport isolation, device clock, shared smooth stopwatch, fullscreen timer, all back-hold paths, no grid/inset/gap/color-mix/pixel readback, four themes, no relay');
}finally{await browser.close();await desktop.close();await server.stop();}
