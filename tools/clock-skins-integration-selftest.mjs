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
const {createDisplaySettingsControl}=require('../ga-tracker-client/tracker-efb-display-settings');
let config={};const displayControl=createDisplaySettingsControl({readConfig:()=>config,writeConfig:value=>{config=value;return true;}});
const server=createTrackerEfbHttpServer({displayControl,port:49880,hello:createTrackerEfbHttpHello({trackerVersion:'v533',trackerVersionCode:533,extraCapabilities:['media.control.v1']}),cockpitControl:createTrackerCockpitControl(),
 mediaControl:command=>{local.push(command);return execute(command);}});
await server.start();
const browser=await chromium.launch({executablePath:process.env.GA_CHROME_EXECUTABLE||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
try {
 for(const role of ['efb','toolbar']){
 config={};const context=await browser.newContext({viewport:{width:1000,height:800}}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
 await page.goto('http://127.0.0.1:49880/efb/v1/?host='+role);await page.waitForFunction(()=>window.gaMediaPlayerClient&&window.GAClockSkins&&window.gaCockpitSessionClient.session);
 assert.equal(await page.evaluate(()=>GAClockSkins.selected()),'stopwatch');
 await page.evaluate(()=>activateMapDrawTool('stopwatch'));assert.ok(await page.locator('#mapStopwatchDevice').isVisible());await page.evaluate(()=>activateMapDrawTool('stopwatch'));assert.ok(await page.locator('#mapStopwatchDevice').isHidden());
 await page.evaluate(()=>{toggleMapHintsMenu();toggleMapHintSubmenu('clockMenu');});
 await page.getByRole('group',{name:'Uhrenskin',exact:true}).getByRole('button',{name:'A Watch',exact:true}).click();
 await page.waitForFunction(()=>GAClockSkins.selected()==='watch');
 await page.waitForTimeout(300);assert.equal(displayControl.snapshot().ui.clockSkin,'watch');
 await page.evaluate(()=>toggleMapHintsMenu());
 const before=local.filter(c=>['watch','snapshot'].includes(c.payload.action)).length;
 await page.evaluate(()=>activateMapDrawTool('stopwatch'));await page.getByRole('region',{name:'Watch Mediensteuerung'}).waitFor({state:'visible'});
 assert.ok(await page.locator('.ga-watch-face').isVisible());assert.ok(await page.locator('#mapStopwatchDevice').isHidden());assert.equal(await page.locator('.ga-media-enable').isChecked(),false);assert.equal(await page.locator('.ga-media-skin').inputValue(),'winamp');
 await page.waitForTimeout(1200);assert.equal(local.filter(c=>['watch','snapshot'].includes(c.payload.action)).length,before,'clock-only view needs no media status requests');
 await page.getByRole('button',{name:'Stoppuhr und Timer',exact:true}).click();await page.getByRole('button',{name:'Zeitmessung starten oder stoppen',exact:true}).click();await page.waitForTimeout(300);assert.ok(await page.evaluate(()=>GAUtilityTime.snapshot().elapsedMs>200));
 await page.getByRole('button',{name:'Zur Uhr',exact:true}).click();await page.getByRole('button',{name:'Zur Musiksteuerung',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.ga-watch-source').textContent==='Spotify');
 // The stopwatch button goes directly back to the clock when the same Watch is on music.
 await page.evaluate(()=>activateMapDrawTool('stopwatch'));assert.ok(await page.locator('.ga-watch-face').isVisible());assert.equal(await page.locator('.ga-media-watch').count(),1);
 await page.getByRole('button',{name:'Zur Musiksteuerung',exact:true}).click();
 await page.evaluate(()=>{window.heldWatchBack=document.querySelector('.ga-watch-back');const r=heldWatchBack.getBoundingClientRect(),p={clientX:r.x+5,clientY:r.y+5},e=new Event('touchstart',{bubbles:true,cancelable:true});Object.defineProperty(e,'touches',{value:[p]});heldWatchBack.dispatchEvent(e);});await page.waitForTimeout(800);
 await page.evaluate(()=>{window.dispatchEvent(new Event('touchend',{bubbles:true}));heldWatchBack.click();});await page.waitForTimeout(200);
assert.ok(await page.locator('.ga-media-watch').count()===0);assert.equal(await page.locator('.ga-media-enable').isChecked(),false);assert.equal(await page.locator('.ga-media-skin').inputValue(),'winamp');
 await page.reload();await page.waitForFunction(()=>window.GAClockSkins&&GAClockSkins.selected()==='watch');await page.evaluate(()=>activateMapDrawTool('stopwatch'));assert.ok(await page.locator('.ga-watch-face').isVisible());
 await page.evaluate(()=>GAClockSkins.select('stopwatch'));await page.waitForTimeout(200);assert.ok(await page.locator('#mapStopwatchDevice').isVisible());assert.equal(await page.locator('.ga-media-watch').count(),0);
 assert.equal(displayControl.snapshot().ui.clockSkin,'stopwatch');
 // New skins use the same public registry without replacing timekeeping.
 await page.evaluate(()=>{let open=false;GAClockSkins.register('test-clock',{label:'Test',open:()=>{open=true;},close:()=>{open=false;},isOpen:()=>open});GAClockSkins.select('test-clock',false);});assert.equal(await page.evaluate(()=>isMapUtilityToolOpen('stopwatch')),true);await page.evaluate(()=>toggleMapUtilityTool('stopwatch'));assert.equal(await page.evaluate(()=>isMapUtilityToolOpen('stopwatch')),false);
 await context.close();state.source='Spotify.exe';
 }
 assert.deepEqual(errors,[]);console.log('CLOCK_SKINS_OK: classic/Watch routing via actual tool, tracker persistence/reload, one Watch, media prefs unchanged, no clock polling, shared timing, music/clock switching, registry extension');
}finally{await browser.close();await desktop.close();await server.stop();}
