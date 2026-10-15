import assert from 'node:assert/strict';import fs from 'node:fs';import http from 'node:http';import path from 'node:path';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require('/Users/jofaist/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
assert.ok(fs.readFileSync('index.html','utf8').includes('defer src="media-player-ipod.js"'),'real webapp loads iPod implementation');
const server=http.createServer((req,res)=>{const url=new URL(req.url,'http://localhost');const file=url.pathname==='/'?'tools/previews/media-player.html':url.pathname.replace(/^\//,'');if(!['tools/previews/media-player.html','media-player.css','media-player-ui.js','media-player-ipod.js'].includes(file)){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(file));});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const folder='analysis/ipod-skin-2026-10-15';fs.mkdirSync(folder,{recursive:true});
try{
 const page=await browser.newPage({viewport:{width:900,height:740}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:'+server.address().port+'/?skin=ipod');
 const device=page.getByRole('region',{name:'iPod Mediensteuerung'}),wheel=page.getByRole('slider',{name:'Musiklautstärke per Clickwheel'});
 assert.ok(await device.isVisible());assert.match(await page.locator('canvas').getAttribute('aria-label'),/Halcyon/);
 await page.getByRole('button',{name:'Im Titel spulen',exact:true}).click();assert.match(await page.locator('canvas').getAttribute('aria-label'),/Spulen/);
 await page.getByRole('button',{name:'Lautstärke regeln',exact:true}).click();
 await page.getByRole('button',{name:'Abspielen oder pausieren'}).click();assert.equal(await page.evaluate(()=>sample.playing),false);
 await page.getByRole('button',{name:'Abspielen oder pausieren'}).click();assert.equal(await page.evaluate(()=>sample.playing),true);
 for(const [label,command] of [['Vorheriger Titel','previous'],['Nächster Titel','next']]){await page.getByRole('button',{name:label,exact:true}).click();assert.equal(await page.evaluate(()=>commands.at(-1).action),command);}
 async function turn(start,end,target=wheel){const r=await target.boundingBox(),cx=r.x+r.width/2,cy=r.y+r.height/2,rad=r.width*.36;await page.mouse.move(cx+Math.cos(start)*rad,cy+Math.sin(start)*rad);await page.mouse.down();const count=await page.evaluate(()=>commands.length);assert.equal(await page.evaluate(()=>commands.length),count);for(let n=1;n<=20;n++){const a=start+(end-start)*n/20;await page.mouse.move(cx+Math.cos(a)*rad,cy+Math.sin(a)*rad);}await page.mouse.up();await page.waitForTimeout(180);}
 // Menu rotation moves selection without volume or transport commands; center confirms.
 await page.getByRole('button',{name:'Gerätemenü',exact:true}).click();await device.screenshot({path:folder+'/ipod-main-menu.png'});await page.getByRole('button',{name:'Bibliothek',exact:true}).click();
 const menuVolume=await page.evaluate(()=>sample.volume),menuCommands=await page.evaluate(()=>commands.length);
 await turn(0,Math.PI/6);assert.match(await page.locator('canvas').getAttribute('aria-label'),/Musik-App: SPOTIFY/i);
 await turn(0,Math.PI/3.5);assert.match(await page.locator('canvas').getAttribute('aria-label'),/Musik-App: CHROME/i);
 assert.equal(await page.evaluate(()=>sample.volume),menuVolume);assert.equal(await page.evaluate(()=>commands.length),menuCommands);
 await turn(0,-Math.PI/3.5);assert.match(await page.locator('canvas').getAttribute('aria-label'),/Musik-App: SPOTIFY/i);
 await page.getByRole('button',{name:'Menüauswahl bestätigen'}).click();assert.equal(await page.evaluate(()=>commands.at(-1).source),'Spotify.exe');
 assert.ok(await page.getByRole('group',{name:'Musik-App auswählen'}).isHidden());
 await page.getByRole('button',{name:'Im Titel spulen',exact:true}).click();
 const seekCount=await page.evaluate(()=>commands.filter(c=>c.action==='seek').length),seekStart=await page.evaluate(()=>sample.positionSeconds),seekVolume=await page.evaluate(()=>sample.volume);
 await turn(0,Math.PI/2);assert.equal(await page.evaluate(()=>commands.filter(c=>c.action==='seek').length),seekCount+1);assert.ok(Math.abs((await page.evaluate(()=>sample.positionSeconds))-seekStart-567/4)<.1);assert.equal(await page.evaluate(()=>sample.volume),seekVolume);
 await page.getByRole('button',{name:'Lautstärke regeln',exact:true}).click();
 const initial=await page.evaluate(()=>sample.volume);await turn(0,Math.PI/2);assert.ok(Math.abs((await page.evaluate(()=>sample.volume))-initial-.25)<.015,'clockwise quarter-turn adds 25%, independent of start position');assert.match(await page.locator('canvas').getAttribute('aria-label'),/Lautstärke 90/);
 await turn(-Math.PI*.95,-Math.PI*1.15);assert.ok(Math.abs((await page.evaluate(()=>sample.volume))-.8)<.02,'negative rotation across angular seam decreases volume');
 await wheel.focus();await wheel.press('ArrowLeft');assert.ok(Math.abs((await page.evaluate(()=>sample.volume))-.78)<.02);
 const before=await device.boundingBox();await page.getByRole('button',{name:'Gerät vergrößern'}).click();assert.ok((await device.boundingBox()).width>before.width);assert.match(await page.locator('.ga-ipod-zoom-value').textContent(),/110/);
 await page.getByRole('button',{name:'Gerät verkleinern'}).click();
 const handle=await page.locator('.ga-ipod-drag').boundingBox();await page.mouse.move(handle.x+60,handle.y+18);await page.mouse.down();await page.mouse.move(handle.x+140,handle.y+48,{steps:8});await page.mouse.up();assert.ok((await device.boundingBox()).x>before.x+60);
 await page.waitForTimeout(1400);await page.evaluate(()=>{sample.title="L'Enfant sauvage";sample.artist='Gojira';sample.player='Apple Music';sample.source='AppleMusic.exe';sample.players=[{source:'AppleMusic.exe',name:'Apple Music'},{source:'Chrome.exe',name:'Chrome'}];sample.positionSeconds=173;sample.durationSeconds=257;player.update(sample);});await device.screenshot({path:folder+'/ipod-device.png'});await page.screenshot({path:folder+'/ipod-preview.png'});
 await page.getByRole('button',{name:'Gerätemenü',exact:true}).click();assert.ok(await page.getByRole('group',{name:'Musik-App auswählen'}).isVisible());await page.getByRole('button',{name:'Bibliothek',exact:true}).click();await page.getByRole('button',{name:'Musik-App: Chrome',exact:true}).click();assert.equal(await page.evaluate(()=>commands.at(-1).source),'Chrome.exe');assert.ok(await page.getByRole('group',{name:'Musik-App auswählen'}).isHidden());await page.getByRole('button',{name:'Gerätemenü',exact:true}).click();await page.getByRole('button',{name:'Gerätemenü',exact:true}).click();assert.ok(await page.getByRole('group',{name:'Musik-App auswählen'}).isHidden());await page.getByRole('button',{name:'Gerätemenü',exact:true}).click();await page.getByRole('button',{name:'Mediensteuerung schließen'}).click();assert.ok(await device.isHidden());await page.getByRole('button',{name:'Mediensteuerung öffnen'}).click();assert.ok(await device.isVisible());
 await page.evaluate(()=>{sample.connected=false;sample.volumeAvailable=false;player.update(sample);});assert.equal(await wheel.getAttribute('aria-readonly'),'true');assert.ok(await page.getByRole('button',{name:'Im Titel spulen',exact:true}).isDisabled());
 await page.evaluate(()=>{sample.connected=true;sample.volumeAvailable=true;sample.durationSeconds=null;sample.positionKind='estimated';player.update(sample);});assert.match(await page.locator('canvas').getAttribute('aria-label'),/geschätzt/);assert.ok(await page.getByRole('button',{name:'Im Titel spulen',exact:true}).isDisabled());
 await page.setViewportSize({width:280,height:400});await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));const small=await device.boundingBox();assert.ok(small.x+small.width<=281);assert.ok(small.y+small.height<=401);
 // Real touch pointers follow the same relative angle path without tapping transport.
 await page.setViewportSize({width:900,height:740});const r=await wheel.boundingBox(),cx=r.x+r.width/2,cy=r.y+r.height/2,rad=r.width*.36;
 const session=await page.context().newCDPSession(page);const startVolume=await page.evaluate(()=>sample.volume);
 await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:cx+rad,y:cy}]});
 for(let n=1;n<=8;n++){const a=n/8*Math.PI/4;await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:cx+rad*Math.cos(a),y:cy+rad*Math.sin(a)}]});}
 await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(200);assert.ok((await page.evaluate(()=>sample.volume))>startVolume+.1,'touch rotation changes volume relatively');
 await page.getByRole('button',{name:'Gerätemenü',exact:true}).click();await page.getByRole('button',{name:'Bibliothek',exact:true}).click();
 const touchMenuCommands=await page.evaluate(()=>commands.length);
 await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:cx+rad,y:cy}]});
 for(let n=1;n<=8;n++){const a=n/8*Math.PI/3.5;await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:cx+rad*Math.cos(a),y:cy+rad*Math.sin(a)}]});}
 await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 assert.match(await page.locator('canvas').getAttribute('aria-label'),/Musik-App: Chrome/);assert.equal(await page.evaluate(()=>commands.length),touchMenuCommands);
 await device.screenshot({path:folder+'/ipod-menu.png'});
 await wheel.focus();await wheel.press('ArrowDown');assert.match(await page.locator('canvas').getAttribute('aria-label'),/Zurück/);await wheel.press('Enter');await page.getByRole('button',{name:'Mediensteuerung schließen'}).click();assert.ok(await device.isHidden());
 await page.getByRole('button',{name:'Mediensteuerung öffnen'}).press('Enter');
 await page.evaluate(()=>{sample.players=[{source:'A',name:'A'},{source:'B',name:'B'},{source:'C',name:'C'},{source:'D',name:'D'}];sample.connected=false;sample.volumeAvailable=false;player.update(sample);});
 await page.getByRole('button',{name:'Gerätemenü',exact:true}).click();await page.getByRole('button',{name:'Bibliothek',exact:true}).click();await wheel.focus();await wheel.press('Enter');assert.ok(await page.getByRole('button',{name:'Musik-App: D',exact:true}).isVisible());assert.ok(await page.getByRole('button',{name:'Musik-App: D',exact:true}).isDisabled());
 await page.getByRole('button',{name:'Gerätemenü',exact:true}).click();
 await page.evaluate(()=>{sample.connected=true;player.update(sample);});
 await page.getByRole('button',{name:'Einstellungen',exact:true}).click();await device.screenshot({path:folder+'/ipod-settings.png'});
 await page.getByRole('button',{name:'Absenkung ausschalten',exact:true}).click();assert.equal(await page.evaluate(()=>sample.duckEnabled),false);
 await page.getByRole('button',{name:'Restlautstärke: 20 Prozent',exact:true}).click();await page.getByRole('button',{name:'35 Prozent',exact:true}).click();assert.equal(await page.evaluate(()=>sample.duckFactor),.35);assert.equal(await page.evaluate(()=>sample.duckEnabled),false);
 await page.getByRole('button',{name:'Absenkung einschalten',exact:true}).click();assert.deepEqual(await page.evaluate(()=>commands.at(-1)),{action:'settings',enabled:true,factor:.35});
 await page.getByRole('button',{name:'Gerätemenü',exact:true}).click();await page.getByRole('button',{name:'Musik',exact:true}).click();assert.ok(await page.getByRole('group',{name:'Musik-App auswählen'}).isHidden());
 // Breakout remains local, including when the Windows media player is unavailable.
 await page.evaluate(()=>{sample.connected=false;sample.volumeAvailable=false;player.update(sample);});
 const beforeGame=await page.evaluate(()=>commands.length);
 await page.getByRole('button',{name:'Gerätemenü',exact:true}).click();await page.getByRole('button',{name:'Extras',exact:true}).click();await page.getByRole('button',{name:'Breakout',exact:true}).click();
 const paddle=page.getByRole('slider',{name:'Breakout-Paddle',exact:true});
 assert.match(await page.locator('canvas').getAttribute('aria-label'),/Breakout: ready/);assert.ok(await page.getByRole('button',{name:'Ball starten',exact:true}).isEnabled());
 const startPaddle=Number(await paddle.getAttribute('aria-valuenow'));await turn(0,Math.PI/2,paddle);assert.ok(Number(await paddle.getAttribute('aria-valuenow'))>startPaddle+25);
 await turn(0,-Math.PI/2,paddle);assert.ok(Math.abs(Number(await paddle.getAttribute('aria-valuenow'))-startPaddle)<3);
 await page.getByRole('button',{name:'Ball starten',exact:true}).click();await page.waitForTimeout(100);assert.match(await page.locator('canvas').getAttribute('aria-label'),/Breakout: playing/);
 await page.getByRole('button',{name:'Spiel pausieren',exact:true}).click();const pausedFrame=await page.locator('canvas').evaluate(c=>c.toDataURL());await page.waitForTimeout(180);assert.equal(await page.locator('canvas').evaluate(c=>c.toDataURL()),pausedFrame,'paused physics does not move');
 const pr=await paddle.boundingBox(),pcx=pr.x+pr.width/2,pcy=pr.y+pr.height/2,prad=pr.width*.36;
 const beforeTouch=Number(await paddle.getAttribute('aria-valuenow'));await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:pcx+prad,y:pcy}]});
 for(let n=1;n<=8;n++){const a=n/8*Math.PI/3;await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:pcx+prad*Math.cos(a),y:pcy+prad*Math.sin(a)}]});}await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});assert.ok(Number(await paddle.getAttribute('aria-valuenow'))>beforeTouch+15);
 await paddle.focus();await paddle.press('Enter');assert.match(await page.locator('canvas').getAttribute('aria-label'),/playing/);await paddle.press('Escape');assert.ok(await page.getByRole('button',{name:'Breakout',exact:true}).isVisible());
 await page.getByRole('button',{name:'Breakout',exact:true}).click();assert.ok(await page.getByRole('button',{name:'Spiel fortsetzen',exact:true}).isVisible());
 await page.getByRole('button',{name:'Spiel fortsetzen',exact:true}).click();await page.evaluate(()=>document.body.style.visibility='hidden');await page.waitForTimeout(100);await page.evaluate(()=>document.body.style.visibility='visible');assert.match(await page.locator('canvas').getAttribute('aria-label'),/Breakout: paused/);assert.ok(await page.getByRole('button',{name:'Spiel fortsetzen',exact:true}).isVisible());
 await page.getByRole('button',{name:'Spiel fortsetzen',exact:true}).click();await page.evaluate(()=>player.setEnabled(false));await page.waitForTimeout(60);await page.evaluate(()=>player.setEnabled(true));assert.match(await page.locator('canvas').getAttribute('aria-label'),/Breakout: paused/);

 await page.getByRole('button',{name:'Gerätemenü',exact:true}).click();await page.getByRole('button',{name:'Gerätemenü',exact:true}).click();await page.getByRole('button',{name:'Musik',exact:true}).click();
 assert.equal(await page.evaluate(()=>commands.length),beforeGame,'game input must never change music, volume, seek or relay commands');
 await page.evaluate(()=>{sample.connected=true;sample.volumeAvailable=true;player.update(sample);});assert.ok(await page.getByRole('button',{name:'Vorheriger Titel',exact:true}).isEnabled());
 // Full-size visual proof on a fresh device; game is paused for a deterministic image.
 await page.goto('http://127.0.0.1:'+server.address().port+'/?skin=ipod');await page.getByRole('button',{name:'Gerätemenü',exact:true}).click();await page.getByRole('button',{name:'Extras',exact:true}).click();await page.getByRole('button',{name:'Breakout',exact:true}).click();await device.screenshot({path:folder+'/ipod-breakout.png'});
 assert.deepEqual(errors,[]);console.log('IPOD_UI_OK: bitmap display, relative mouse/touch wheel, seam, keyboard, source cycle, menu rotation/confirmation/touch/offline/pagination, transport, zoom, drag, collapse, missing duration, offline, bounds, Breakout mouse/touch/pause/offline/command-isolation');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
