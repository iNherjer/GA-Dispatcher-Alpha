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
 for(const [role,width,scale] of [['efb',1000,1],['efb',440,1],['toolbar',1000,1.5],['toolbar',440,1.5]]){
 const context=await browser.newContext({viewport:{width,height:850}}),page=await context.newPage();
 page.on('pageerror',e=>errors.push(e.message));let relays=0;page.on('websocket',()=>relays++);
 await page.addInitScript(()=>{Element.prototype.setPointerCapture=function(){throw Error('test: capture unavailable');};});
 await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
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
 await page.getByRole('button',{name:'Mediensteuerung schließen',exact:true}).click();assert.ok(await device.isVisible(),'back closes size sheet');
 await page.getByRole('button',{name:'Musik-App auswählen',exact:true}).click();await page.locator('.ga-watch-sheet-row').filter({hasText:'Browser'}).click();
 await page.waitForFunction(()=>document.querySelector('.ga-watch-source').textContent==='Browser');
 const beforeX=await device.evaluate(e=>parseFloat(e.style.left));await page.getByRole('button',{name:'Nächster Titel',exact:true}).click();assert.equal(await device.evaluate(e=>parseFloat(e.style.left)),beforeX,'transport button does not drag');
 const clock=await page.locator('.ga-watch-clock').textContent();assert.match(clock,/^\d{2}:\d{2}$/,'missing sim uses device time');
 await page.screenshot({path:'/tmp/ga-watch-coherent-'+role+'-'+width+'.png'});
 assert.equal(relays,0);await context.close();state.source='Spotify.exe';state.volume=.4;
 }
 assert.deepEqual(errors,[]);console.log('WATCH_COHERENT_FALLBACK_OK: EFB/toolbar, 440/1000px, 100/150%, legacy mouse/touch drag and crown without capture, zoom, sources, transport isolation, device clock, no relay');
}finally{await browser.close();await desktop.close();await server.stop();}
