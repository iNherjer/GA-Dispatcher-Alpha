import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.GA_PLAYWRIGHT_MODULE||'/Users/jofaist/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {createTrackerEfbHttpServer,createTrackerEfbHttpHello}=require('../ga-tracker-client/tracker-efb-http-server');
const {createTrackerCockpitControl}=require('../ga-tracker-client/tracker-cockpit-control-core');
const {createMediaServer}=require('../ga-tracker-client/desktop/lib/media-server');
const {createMediaBridge}=require('../ga-tracker-client/tracker-media-bridge');
const {createMediaRelay}=require('../ga-tracker-client/tracker-media-core');
const native=[],local=[],errors=[];
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
 for(const role of ['efb','toolbar']) {
 const context=await browser.newContext({viewport:{width:1000,height:750}}), page=await context.newPage();
 page.on('pageerror',e=>errors.push(e.message));
 let relays=0;
 page.on('websocket',()=>relays++);
 await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
 await page.goto('http://127.0.0.1:49880/efb/v1/?host='+role);
 await page.waitForFunction(()=>window.gaMediaPlayerClient&&window.gaCockpitSessionClient&&window.gaCockpitSessionClient.session);
 assert.equal(await page.evaluate(()=>gaCockpitSessionClient.role),role);
 await page.evaluate(()=>toggleMapVoiceMenu());
 await page.locator('.ga-media-enable').check();
 const before=local.length;
 await page.waitForTimeout(150);
 assert.equal(local.length,before,'collapsed media sends no requests');
 assert.equal(await page.locator('.ga-media-skin').inputValue(),'winamp');
 await page.getByRole('button',{name:'Mediensteuerung öffnen',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('.ga-media-source').textContent==='Spotify');
 await page.getByRole('button',{name:'Nächste Musik-App',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('.ga-media-source').textContent==='Browser');
 await page.getByRole('button',{name:'Pause',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('.ga-media-status').textContent==='PAUSE');
 await page.getByRole('slider',{name:'Wiedergabeposition',exact:true}).fill('500');await page.getByRole('slider',{name:'Wiedergabeposition',exact:true}).dispatchEvent('change');
 await page.waitForFunction(()=>document.querySelector('.ga-media-seek-row').getAttribute('aria-valuenow')==='50');
 assert.equal(state.positionSeconds,state.durationSeconds/2);
 await page.locator('.ga-media-volume').fill('40');await page.locator('.ga-media-volume').dispatchEvent('change');
 await page.waitForFunction(()=>document.querySelector('.ga-media-volume-text').textContent==='40%');
 await page.evaluate(()=>dispatchEvent(new CustomEvent('ga:media-audible',{detail:{active:true,effectId:'local-warning',stage:'warning'}})));
 await page.waitForTimeout(1200);
 assert.ok(local.filter(c=>c.payload.action==='duck'&&c.payload.active).length>=2,'audible lease is renewed locally');
 await page.evaluate(()=>dispatchEvent(new CustomEvent('ga:media-audible',{detail:{active:false,effectId:'local-warning',stage:'warning'}})));
 await page.waitForTimeout(100);
 assert.ok(local.some(c=>c.payload.action==='duck'&&!c.payload.active));
 // Simulate a scaled Coherent root and verify physical dragging uses logical deltas.
 await page.evaluate(()=>{window.testOriginalUiScale=window.GAEfbUiScale;window.GAEfbUiScale=Object.assign({},window.GAEfbUiScale,{delta:v=>v/1.5});document.body.style.transformOrigin='top left';document.body.style.transform='scale(1.5)';});
 const device=page.locator('.ga-media-device'),brand=await page.locator('.ga-media-brand').boundingBox();
 const x=await device.evaluate(e=>parseFloat(e.style.left));
 await page.mouse.move(brand.x+5,brand.y+5);await page.mouse.down();await page.mouse.move(brand.x+65,brand.y+5,{steps:5});await page.mouse.up();
 assert.ok(Math.abs((await device.evaluate(e=>parseFloat(e.style.left)))-x-40)<2,'scaled dragging advances 40 logical pixels');
 await page.evaluate(()=>{document.body.style.transform='';window.GAEfbUiScale=window.testOriginalUiScale;});
 await page.evaluate(()=>toggleMapVoiceMenu());
 await page.selectOption('.ga-media-skin','ipod');
 await page.getByRole('region',{name:'iPod Mediensteuerung'}).waitFor({state:'visible'});
 await page.evaluate(()=>toggleMapVoiceMenu());
 await page.getByRole('button',{name:'Gerätemenü',exact:true}).click();await page.getByRole('button',{name:'Bibliothek',exact:true}).click();await page.getByRole('button',{name:'Musik-App: Spotify',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('.ga-media-select').value==='Spotify.exe');
 await page.getByRole('button',{name:'Im Titel spulen',exact:true}).click();await page.getByRole('slider',{name:'Musiklautstärke per Clickwheel'}).focus();await page.keyboard.press('ArrowRight');
 await page.waitForFunction(()=>(document.querySelector('.ga-ipod-lcd canvas').getAttribute('aria-label')||'').includes('Spulen'));
 await page.getByRole('button',{name:'Lautstärke regeln',exact:true}).click();

 const gameCommands=local.filter(c=>!['watch','snapshot'].includes(c.payload.action)).length;
 await page.getByRole('button',{name:'Gerätemenü',exact:true}).click();await page.getByRole('button',{name:'Extras',exact:true}).click();await page.getByRole('button',{name:'Breakout',exact:true}).click();
 await page.getByRole('button',{name:'Ball starten',exact:true}).click();
 const paddle=page.getByRole('slider',{name:'Breakout-Paddle',exact:true});await paddle.focus();await paddle.press('ArrowRight');await paddle.press('Enter');
 assert.match(await page.locator('.ga-ipod-lcd canvas').getAttribute('aria-label'),/Breakout: paused/);
 await paddle.press('Escape');await page.getByRole('button',{name:'Gerätemenü',exact:true}).click();await page.getByRole('button',{name:'Musik',exact:true}).click();
 assert.equal(local.filter(c=>!['watch','snapshot'].includes(c.payload.action)).length,gameCommands,'compiled game does not issue media commands');
 for(const theme of ['theme-retro','theme-win95','theme-ops1940']){
  await page.evaluate(t=>document.body.className='map-is-fullscreen ga-efb-tracker-host '+t,theme);
  const box=await page.locator('.ga-ipod-center').boundingBox();assert.ok(box.width>30&&box.width<100,'theme must not resize clickwheel center');
 }
 await page.evaluate(()=>toggleMapVoiceMenu());
 await page.selectOption('.ga-media-skin','winamp');
 await page.getByRole('button',{name:'Mediensteuerung schließen',exact:true}).click();
 const count=local.length;await page.waitForTimeout(1200);assert.equal(local.length,count,'closed player stops local watches');
 assert.equal(relays,0,'no websocket or relay needed');
 assert.ok(local.every(c=>c.clientId.startsWith('local:')));
 await page.screenshot({path:'/tmp/ga-'+role+'-media-local.png'});
 await context.close();
 state.source='Spotify.exe';state.playing=true;
 }
 assert.deepEqual(errors,[]);
 console.log('EFB_MEDIA_LOCAL_OK: actual EFB/toolbar pages → authenticated loopback → private Desktop bridge; app switch, pause, volume, duck lease, scaled drag, no relay');
}finally{await browser.close();await desktop.close();await server.stop();}
