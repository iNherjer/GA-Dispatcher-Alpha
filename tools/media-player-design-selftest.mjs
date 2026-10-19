import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.GA_PLAYWRIGHT_MODULE||'/Users/jofaist/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(import.meta.dirname,'..');
const output=path.join(root,'analysis/media-player-design-2026-10-14');
fs.mkdirSync(output,{recursive:true});
const files={'/':'tools/previews/media-player.html','/media-player.css':'media-player.css','/media-player-ui.js':'media-player-ui.js','/media-player-ipod.js':'media-player-ipod.js','/media-player-watch.js':'media-player-watch.js','/media-player-watch-face.js':'media-player-watch-face.js','/vendor/suncalc/suncalc.js':'vendor/suncalc/suncalc.js','/map-utility-tools.js':'map-utility-tools.js'};
const server=http.createServer((request,response)=>{
  const file=files[new URL(request.url,'http://localhost').pathname];
  if(!file){response.writeHead(404);response.end();return;}
  response.setHeader('Content-Type',file.endsWith('.css')?'text/css':file.endsWith('.js')?'text/javascript':'text/html; charset=utf-8');
  response.end(fs.readFileSync(path.join(root,file)));
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({executablePath:process.env.GA_CHROME_EXECUTABLE||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
try {
 const page=await browser.newPage({viewport:{width:1000,height:540},deviceScaleFactor:2});
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto(`http://127.0.0.1:${server.address().port}`);
 const device=page.locator('.ga-media-device'),launcher=page.locator('.ga-media-launcher');
 assert.ok(await device.isVisible());assert.ok(await launcher.isHidden());
 assert.equal(await page.locator('.ga-media-digits').getAttribute('aria-label'),'1:38');
 const touchGuard=await device.evaluate(el=>{const event=new Event('contextmenu',{bubbles:true,cancelable:true});el.dispatchEvent(event);return {blocked:event.defaultPrevented,select:getComputedStyle(el.querySelector('.ga-media-brand')).webkitUserSelect};});assert.equal(touchGuard.blocked,true);assert.equal(touchGuard.select,'none');

 const seek=page.getByRole('slider',{name:'Wiedergabeposition',exact:true});
 await seek.evaluate(el=>{el.value='750';el.dispatchEvent(new Event('input',{bubbles:true}));});assert.equal(await page.evaluate(()=>commands.filter(c=>c.action==='seek').length),0,'drag preview must stay local');
 await seek.dispatchEvent('change');assert.equal(await page.evaluate(()=>commands.at(-1).positionSeconds),567*.75);
 await page.evaluate(()=>{sample.controls.seek=false;player.update(sample);});assert.ok(await seek.isDisabled());
 await page.evaluate(()=>{sample.controls.seek=true;sample.positionSeconds=98;player.update(sample);});

 await page.getByRole('button',{name:'Pause',exact:true}).click();
 assert.equal(await page.locator('.ga-media-status').textContent(),'PAUSE');
 await page.getByRole('button',{name:'Abspielen',exact:true}).click();
 await page.getByRole('button',{name:'Nächster Titel',exact:true}).click();
 await page.getByRole('button',{name:'Vorheriger Titel',exact:true}).click();
 await page.locator('.ga-media-volume').fill('42');await page.locator('.ga-media-volume').dispatchEvent('change');
 assert.equal(await page.evaluate(()=>commands.at(-1).volume),0.42);
 const before=await device.boundingBox();
 await page.getByRole('button',{name:'Gerät vergrößern'}).click();
 assert.ok((await device.boundingBox()).width>before.width);
 await page.getByRole('button',{name:'Gerät verkleinern'}).click();
 const header=await page.locator('.ga-media-brand').boundingBox();
 await page.mouse.move(header.x+20,header.y+8);await page.mouse.down();await page.mouse.move(header.x+100,header.y+48,{steps:10});await page.mouse.up();
 const moved=await device.boundingBox();assert.ok(moved.x>before.x+60);assert.ok(moved.y>before.y+30);
 await page.getByRole('button',{name:'Mediensteuerung schließen'}).click();
 assert.ok(await device.isHidden());assert.ok(await launcher.isVisible());
 const collapsed=await launcher.boundingBox();assert.equal(Math.round(collapsed.x),Math.round(moved.x));assert.equal(Math.round(collapsed.y),Math.round(moved.y));
 await page.mouse.move(collapsed.x+25,collapsed.y+25);await page.mouse.down();await page.mouse.move(850,440,{steps:10});await page.mouse.up();
 assert.ok(await device.isHidden(),'drag must not open the player');
 await page.waitForTimeout(260);await launcher.click();assert.ok(await device.isVisible());assert.ok(await launcher.isHidden());
 const reopened=await device.boundingBox();assert.ok(reopened.x+reopened.width*.2<=1001);assert.ok(reopened.y+reopened.height*.2<=541);
 await page.getByRole('button',{name:'Audio',exact:true}).click();await page.locator('#mediaEnabled').uncheck();
 assert.ok(await device.isHidden());assert.ok(await launcher.isHidden());
 await page.locator('#mediaEnabled').check();assert.ok(await device.isVisible());
 await page.getByRole('button',{name:'Audio',exact:true}).click();
 await page.evaluate(()=>{sample.positionSeconds=undefined;sample.durationSeconds=undefined;player.update(sample);});
 assert.equal(await page.locator('.ga-media-digits').getAttribute('aria-label'),'Abspielzeit nicht verfügbar');
 assert.ok(await page.locator('.ga-media-position').isHidden());
 await page.setViewportSize({width:380,height:500});
 const small=await device.boundingBox();assert.ok(small.x+small.width*.2<=381);assert.ok(small.y+small.height*.2<=501);
 await page.setViewportSize({width:1000,height:540});
 await page.evaluate(()=>{player.destroy();sample.positionSeconds=98;sample.durationSeconds=567;sample.volume=0.65;player=GAMediaPlayerUI.create({x:160,y:130,state:sample});player.open();});
 // The real app themes must not reposition the transparent seek input.
 await page.addStyleTag({path:path.join(root,'styles.css')});
 for(const theme of ['', 'theme-retro', 'theme-win95', 'theme-ops1940']){
  await page.evaluate(t=>{document.body.className=t;document.body.style.transformOrigin='top left';document.body.style.transform='scale(.85)';},theme);
  const hit=await seek.boundingBox(),track=await page.locator('.ga-media-seek-row').boundingBox();
  assert.ok(Math.abs(hit.y-track.y)<3,JSON.stringify({theme,hit,track,style:await seek.evaluate(e=>({position:getComputedStyle(e).position,top:getComputedStyle(e).top,margin:getComputedStyle(e).margin,padding:getComputedStyle(e).padding,height:getComputedStyle(e).height}))}));assert.ok(hit.height>=track.height-4&&hit.height<=track.height,theme+': hit area must match track height');
  assert.equal(await seek.evaluate(el=>getComputedStyle(el).position),'absolute');
  await page.mouse.click(hit.x+hit.width/2,hit.y+hit.height/2);assert.ok(Math.abs(Number(await seek.inputValue())-500)<15,theme+': clicking visible center seeks to midpoint');
 }
 await page.evaluate(()=>{document.body.className='';document.body.style.transform='';});
 await page.emulateMedia({reducedMotion:'reduce'});
 await device.screenshot({path:path.join(output,'winamp-device.png')});
 await page.screenshot({path:path.join(output,'winamp-preview.png')});
 await page.getByRole('button',{name:'Mediensteuerung schließen'}).click();
 await page.screenshot({path:path.join(output,'winamp-collapsed.png')});
 assert.deepEqual(errors,[]);
 console.log('MEDIA_PLAYER_DESIGN_OK: transport, volume, zoom, drag, launcher swap, bounds, missing time, narrow panel');
} finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
