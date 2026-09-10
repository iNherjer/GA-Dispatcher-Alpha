const {app,BrowserWindow,session}=require('electron');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const efb=require('../ga-tracker-client/tracker-efb-web-client');
const output='/tmp/ga-efb-font-audio-check';fs.mkdirSync(output,{recursive:true});
app.whenReady().then(async()=>{
 const fontRequests=new Set();
 const server=http.createServer((req,res)=>{
  const pathname=new URL(req.url,'http://localhost').pathname;
  if(pathname==='/'){res.setHeader('Content-Type','text/html');res.end(efb.createTrackerEfbWebClientPage());return;}
  const asset=efb.getTrackerEfbWebClientAsset(pathname);
  if(asset){if(pathname.includes('/fonts/'))fontRequests.add(pathname);res.setHeader('Content-Type',asset.contentType);res.end(asset.body);return;}
  res.setHeader('Content-Type','application/json');res.end('{"available":false,"items":[],"ok":true}');
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 session.defaultSession.webRequest.onBeforeRequest((d,cb)=>cb({cancel:!d.url.startsWith(base)&&!d.url.startsWith('data:')}));
 const win=new BrowserWindow({width:784,height:1250,show:false,webPreferences:{contextIsolation:true,nodeIntegration:false}});
 win.webContents.on('console-message',(_e,level,msg)=>{if(level===3)console.log('RENDER',msg)});
 await win.loadURL(base);await new Promise(r=>setTimeout(r,500));
 console.log('CHECK font loading');
 const result=await win.webContents.executeJavaScript(`(async function(){
  await Promise.all(['GA EFB Text','GA EFB Mono','GA EFB Emoji','GA EFB Symbols','GA EFB Math'].map(f=>document.fonts.load('16px "'+f+'"')));
  await Promise.all(['700 16px "DSEG7"','600 16px "Caveat"','400 16px "Oleo Script"','700 16px "Oleo Script"','400 16px "Share Tech Mono"'].map(f=>document.fonts.load(f)));
  toggleMapVoiceMenu();
  var menu=document.getElementById('mapVoiceMenu');
  var rows=Array.from(menu.querySelectorAll('input[type=checkbox]')).filter(x=>x.getClientRects().length).map(x=>{
   var r=x.getBoundingClientRect();return {id:x.id,width:r.width,height:r.height,minHeight:getComputedStyle(x).minHeight,font:getComputedStyle(x.parentNode).fontFamily};
  });
  window.__changed=null;window.awmSetReadFreq=function(value){__changed=value;};
  var freq=document.getElementById('awmReadFreqCheck'),before=freq.checked;freq.parentNode.click();
  var sample=document.createElement('div');sample.id='fontSample';sample.textContent='ÄÖÜ äöü ß · − × → ↻ ° ± 📻 🔊 🏔️ 🛡️ 📍 🧑‍✈️ 🔔 ⚙️ ✈️';
  sample.style.cssText='position:fixed;bottom:4px;left:8px;right:8px;padding:10px;background:#101820;color:#fff;z-index:999999;font:18px "GA EFB Text", "GA EFB Emoji", "GA EFB Symbols", "GA EFB Math"';document.body.appendChild(sample);
  return {rows,changed:__changed,expected:!before,loaded:Array.from(document.fonts).filter(f=>f.family.includes('GA EFB')).map(f=>({family:f.family,status:f.status}))};
 })()`);
 assert.equal(result.changed,result.expected,'Label still toggles checkbox and calls the original handler slot');
 for(const row of result.rows){assert.equal(row.width,14,row.id);assert.equal(row.height,14,row.id);assert.match(row.font,/GA EFB Emoji/);}
 assert.equal(result.loaded.length,5);assert.ok(result.loaded.every(f=>f.status==='loaded'));assert.equal(fontRequests.size,10);
 // Dynamic inline HTML and SVG overrides must not bypass explicit fallbacks.
 await win.webContents.executeJavaScript(`(function(){
   var container=document.createElement('div');container.id='dynamicFontTest';
   container.innerHTML='<span style="font:12px monospace">Ö − 🧑‍✈️</span><svg xmlns="http://www.w3.org/2000/svg"><text font-family="Arial" style="font-family:Arial">Ö − →</text></svg>';
   document.body.appendChild(container);
 })()`);
 await new Promise(r=>setTimeout(r,30));
 const dynamic=await win.webContents.executeJavaScript(`(function(){var box=document.getElementById('dynamicFontTest');return {html:box.querySelector('span').style.fontFamily,svg:box.querySelector('text').style.fontFamily,attr:box.querySelector('text').getAttribute('font-family')};})()`);
 assert.match(dynamic.html,/GA EFB Mono/);assert.match(dynamic.svg,/GA EFB Math/);assert.match(dynamic.attr,/GA EFB Math/);
 await win.webContents.executeJavaScript("document.getElementById('dynamicFontTest').remove()");
 console.log('CHECK emoji sequences');
 const sequences=await win.webContents.executeJavaScript(`(function(){
   var icon=document.querySelector('#awmPaxVoiceCheck').parentNode.querySelector('.ga-efb-symbol');
   var sample=document.getElementById('fontSample');
   return {text:icon.textContent,loaded:icon.querySelector('img').complete && icon.querySelector('img').naturalWidth>0,sample:sample.querySelectorAll('.ga-efb-symbol').length,nested:document.querySelectorAll('.ga-efb-symbol .ga-efb-symbol').length};
 })()`);
 assert.equal(sequences.text,'🧑‍✈️');assert.ok(sequences.loaded);assert.ok(sequences.sample>=14);assert.equal(sequences.nested,0);
 await new Promise(r=>setTimeout(r,150));fs.writeFileSync(path.join(output,'audio-784.png'),(await win.webContents.capturePage()).toPNG());
 win.setSize(440,894);await new Promise(r=>setTimeout(r,100));
 await win.webContents.executeJavaScript('_closeFloatingMenus();toggleMapVoiceMenu()');
 await new Promise(r=>setTimeout(r,100));
 const narrow=await win.webContents.executeJavaScript(`(function(){var m=document.getElementById('mapVoiceMenu'),r=m.getBoundingClientRect();return {left:r.left,right:r.right,viewport:innerWidth,width:m.clientWidth,scrollWidth:m.scrollWidth}})()`);
 assert.ok(narrow.width>0);assert.ok(narrow.left>=0&&narrow.right<=narrow.viewport+1);assert.ok(narrow.scrollWidth<=narrow.width+1);
 fs.writeFileSync(path.join(output,'audio-440.png'),(await win.webContents.capturePage()).toPNG());
 // Compare compiled EFB and the original standalone menu module directly.
 console.log('CHECK menus');
 const menuResults=[];
 for(const raw of [false,true]){
  if(raw)await win.webContents.executeJavaScript(fs.readFileSync(path.join(__dirname,'../map-profile-controls.js'),'utf8').replace(/^let /gm,'var '));
  menuResults.push(await win.webContents.executeJavaScript(`(function(){
   _closeFloatingMenus();var out=[];
   for(var pair of [['mapVoiceBtn','mapVoiceMenu'],['btnVpSettings','vpSettingsMenu'],['mapHintsBtn','mapHintsMenu']]){
    var button=document.getElementById(pair[0]),menu=document.getElementById(pair[1]);button.click();
    if(menu.style.display!=='block'||button.getAttribute('aria-expanded')!=='true')throw Error(pair[0]+' open');
    menu.click();if(menu.style.display!=='block')throw Error(pair[0]+' inside close');
    document.body.click();if(menu.style.display!=='none'||button.getAttribute('aria-expanded')!=='false')throw Error(pair[0]+' outside after inside');
    button.click();button.click();if(menu.style.display!=='none')throw Error(pair[0]+' toggle');
    button.click();window.dispatchEvent(new Event('orientationchange'));if(menu.style.display!=='none'||button.getAttribute('aria-expanded')!=='false')throw Error(pair[0]+' rotation');
    out.push(pair[0]);
   }return out;
  })()`));
 }
 assert.deepEqual(menuResults[0],menuResults[1]);
 // Isolated browser session: icons must survive blocked font requests.
 const noFonts=new BrowserWindow({width:590,height:900,show:false,webPreferences:{partition:'efb-no-fonts-'+Date.now(),contextIsolation:true,nodeIntegration:false}});
 noFonts.webContents.session.webRequest.onBeforeRequest((d,cb)=>cb({cancel:d.url.includes('/fonts/')||(!d.url.startsWith(base)&&!d.url.startsWith('data:'))}));
 await noFonts.loadURL(base);await new Promise(r=>setTimeout(r,400));
 const symbols=await noFonts.webContents.executeJavaScript(`(async function(){
  await document.fonts.load('16px "GA EFB Emoji"').catch(function(){});
  gaChecklistOpen('home');
  var original='Ärztliche Übergabe 🧑‍✈️ 📻 − →';
  var box=document.createElement('div');box.id='noFontSymbols';box.textContent=original;document.body.appendChild(box);
  await new Promise(r=>setTimeout(r,100));
  var imgs=Array.from(box.querySelectorAll('img'));
  var calls=[],ctx={font:'18px Arial',fillStyle:'#ff0000',textAlign:'center',textBaseline:'alphabetic',
    save(){calls.push('save')},restore(){calls.push('restore')},translate(){},scale(){},measureText(t){return {width:t.length*8}},
    drawImage(i){calls.push('image:'+i.naturalWidth)},fillText(t){calls.push('text:'+t)}};
  gaEfbCanvasFillText(ctx,'📻 EDTO',100,100);
  return {text:box.textContent,original,count:imgs.length,loaded:imgs.every(i=>i.complete&&i.naturalWidth>0),
    fontLoaded:Array.from(document.fonts).some(f=>f.family.includes('GA EFB Emoji')&&f.status==='loaded'),calls};
 })()`);
 assert.equal(symbols.text,symbols.original);assert.equal(symbols.count,4);assert.ok(symbols.loaded);assert.equal(symbols.fontLoaded,false);
 assert.ok(symbols.calls.some(x=>x.startsWith('image:')));assert.ok(symbols.calls.includes('text: EDTO'));assert.equal(symbols.calls.at(-1),'restore');
 for(const size of [[590,900],[440,894],[894,440]]){
  noFonts.setSize(...size);await new Promise(r=>setTimeout(r,100));
  const drawer=await noFonts.webContents.executeJavaScript(`(function(){
   gaChecklistOpen('home');var node=document.getElementById('mapSideDrawer'),panel=node.querySelector('.map-side-drawer-panel');
   var actual=panel.getBoundingClientRect().width;
   node.style.removeProperty('--checklist-panel-width');var standalone=panel.getBoundingClientRect().width;
   gaEfbRefreshDrawerLayout();return {actual,standalone,scroll:document.getElementById('checklistDrawerBody').scrollWidth,width:document.getElementById('checklistDrawerBody').clientWidth};
  })()`);
  assert.equal(drawer.actual,drawer.standalone,JSON.stringify({size,drawer}));assert.ok(drawer.scroll<=drawer.width+1);
 }
 noFonts.setSize(590,900);await new Promise(r=>setTimeout(r,200));
 fs.writeFileSync(path.join(output,'sidebar-no-fonts.png'),(await noFonts.webContents.capturePage()).toPNG());
 noFonts.destroy();
 // The E6B owns an iframe/document; test real, asynchronously inserted disc text.
 await win.loadURL(base+'/efb/v1/e6b/e6b-flight-computer.html?embedded=1&coherent=1');
 await new Promise(r=>setTimeout(r,1200));
 const disc=await win.webContents.executeJavaScript(`(function(){var nodes=Array.from(document.querySelectorAll('svg text[font-family]'));return {count:nodes.length,missing:nodes.filter(n=>!n.getAttribute('font-family').includes('GA EFB Math')||!getComputedStyle(n).fontFamily.includes('GA EFB Math')).map(n=>n.outerHTML)};})()`);
 assert.ok(disc.count>100,JSON.stringify(disc));assert.deepEqual(disc.missing,[]);
 fs.writeFileSync(path.join(output,'result.json'),JSON.stringify({result,narrow,fontRequests:[...fontRequests]},null,2));
 console.log('EFB_FONT_AUDIO_UI_OK '+output);win.destroy();server.close();app.exit(0);
}).catch(e=>{console.error(e.stack);app.exit(1)});
