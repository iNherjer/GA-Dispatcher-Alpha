import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.GA_PLAYWRIGHT_MODULE||'/Users/jofaist/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {createMediaServer}=require('../ga-tracker-client/desktop/lib/media-server');
const {createMediaBridge}=require('../ga-tracker-client/tracker-media-bridge');
const {createMediaRelay}=require('../ga-tracker-client/tracker-media-core');
const root=path.resolve(import.meta.dirname,'..');
const nativeCommands=[],requests=[];
const mediaState={ok:true,source:'Spotify.exe',title:'Halcyon and On and On',artist:'Orbital',players:[{source:'Spotify.exe',name:'Spotify'},{source:'vlc.exe',name:'VLC'}],playing:true,positionSeconds:98,durationSeconds:567,volume:0.65,volumeAvailable:true,duckEnabled:true,duckFactor:0.2,controls:{play:true,pause:true,next:true,previous:true}};
const privateServer=createMediaServer({request:async command=>{
 nativeCommands.push(command);
 if(command.action==='select')mediaState.source=command.source;
 if(command.action==='pause')mediaState.playing=false;
 if(command.action==='play')mediaState.playing=true;
 if(command.action==='volume')mediaState.volume=command.volume;
 if(command.action==='settings'){mediaState.duckEnabled=command.enabled;mediaState.duckFactor=command.factor;}
 if(command.action==='duck')return {ok:true};
 return structuredClone(mediaState);
}});
const endpoint=await privateServer.start();
const bridge=createMediaBridge({VFR_MULTITOOL_MEDIA_PORT:endpoint.port,VFR_MULTITOOL_MEDIA_TOKEN:endpoint.token});
const execute=createMediaRelay(payload=>bridge.request(payload));
const server=http.createServer(async(req,res)=>{
 const address=new URL(req.url,'http://localhost');
 if(address.pathname==='/relay'){
  let body='';for await(const chunk of req)body+=chunk;
  const command=JSON.parse(body);requests.push(command);
  const result=command.pin==='1234'?await execute(command):{ok:false,error:'pin_required'};
  res.setHeader('Content-Type','application/json');res.end(JSON.stringify(result));return;
 }
 if(address.pathname==='/'){
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  res.setHeader('Content-Type','text/html; charset=utf-8');
  res.end('<!doctype html><link rel="stylesheet" href="/media-player.css"><style>body{margin:0;background:#303743;color:white;font:14px Arial}#mapTableOverlay{position:fixed;inset:0}#mapVoiceMenu{position:absolute;left:20px;top:20px;display:block;width:260px;background:#121212;padding:10px;z-index:140000}</style><div id="mapTableOverlay"><script>document.write(new DOMParser().parseFromString('+JSON.stringify(html).replaceAll('</script','<\\/script')+',"text/html").getElementById("mapVoiceMenu").outerHTML);document.getElementById("mapVoiceMenu").style.cssText="display:block;position:absolute;left:20px;top:20px;width:260px;max-height:80vh;overflow:auto;background:#121212;padding:10px;z-index:140000";</script></div><script>window.liveTrackerCapabilities=["media.control.v1"];var seq=0;window.gaMediaRequest=function(payload){return fetch("/relay",{method:"POST",body:JSON.stringify({pin:"1234",clientId:"browser-test",commandId:"cmd-"+(++seq),payload:payload})}).then(function(r){return r.json()});};</script><script src="/media-player-ui.js"></script><script src="/media-player-client.js"></script>');return;
 }
 const file=address.pathname.slice(1);
 if(!['media-player.css','media-player-ui.js','media-player-client.js'].includes(file)){res.writeHead(404);res.end();return;}
 res.setHeader('Content-Type',file.endsWith('.css')?'text/css':'text/javascript');res.end(fs.readFileSync(path.join(root,file)));
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({executablePath:process.env.GA_CHROME_EXECUTABLE||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1100,height:750}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:'+server.address().port);
 await page.locator('#mapVoiceMenu').evaluate(el=>el.style.left='800px');
 await page.locator('.ga-media-enable').check();
 assert.equal(requests.length,0,'collapsed player sends no status requests');
 await page.getByRole('button',{name:'Mediensteuerung öffnen'}).click();
 await page.waitForFunction(()=>document.querySelector('.ga-media-title').textContent.includes('Orbital'));
 await page.getByRole('button',{name:'Pause',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('.ga-media-status').textContent==='PAUSE');
 await page.selectOption('.ga-media-select','vlc.exe');
 await page.waitForFunction(()=>document.querySelector('.ga-media-source').textContent==='VLC');
 await page.locator('.ga-media-volume').fill('40');await page.locator('.ga-media-volume').dispatchEvent('change');
 await page.waitForFunction(()=>document.querySelector('.ga-media-volume-text').textContent==='40%');
 await page.evaluate(()=>{window.dispatchEvent(new CustomEvent('ga:media-audible',{detail:{active:true,effectId:'warning',stage:'warning:0'}}));});
 await page.waitForTimeout(100);
 assert.ok(nativeCommands.some(c=>c.action==='duck'&&c.active));
 await page.evaluate(()=>{window.dispatchEvent(new CustomEvent('ga:media-audible',{detail:{active:false,effectId:'warning',stage:'warning:0'}}));});
 await page.waitForTimeout(100);
 assert.ok(nativeCommands.some(c=>c.action==='duck'&&!c.active));
 await page.getByRole('button',{name:'Mediensteuerung schließen'}).click();
 const count=requests.length;
 await page.waitForTimeout(1200);
 assert.equal(requests.length,count,'closing player stops further relay status queries');
 await page.getByRole('button',{name:'Mediensteuerung öffnen'}).click();
 await page.locator('#mapVoiceMenu').evaluate(el=>el.style.display='none');
 await page.locator('.ga-media-device').screenshot({path:'/tmp/ga-web-media-connected.png'});
 assert.deepEqual(errors,[]);
 assert.ok(requests.filter(c=>c.payload.action==='watch').length<8,'watch requests must not form a rapid polling loop');
 console.log('WEB_MEDIA_INTEGRATION_OK: real UI → validated relay → authenticated private bridge → simulated Windows player; controls, selection, duck signals, no closed polling');
}finally{await browser.close();await privateServer.close();await new Promise(resolve=>server.close(resolve));}
