const {app,BrowserWindow,session}=require('electron');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const efb=require('../ga-tracker-client/tracker-efb-web-client');
const output='/tmp/ga-efb-utility-check';fs.mkdirSync(output,{recursive:true});
app.whenReady().then(async()=>{
 const server=http.createServer((req,res)=>{
  const pathname=new URL(req.url,'http://localhost').pathname;
  if(pathname==='/'){res.setHeader('Content-Type','text/html');res.end(efb.createTrackerEfbWebClientPage());return;}
  const asset=efb.getTrackerEfbWebClientAsset(pathname);
  if(asset){res.setHeader('Content-Type',asset.contentType);res.end(asset.body);return;}
  res.setHeader('Content-Type','application/json');res.end('{"available":false,"items":[],"ok":true}');
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 session.defaultSession.webRequest.onBeforeRequest((d,cb)=>cb({cancel:!d.url.startsWith(base)&&!d.url.startsWith('data:')}));
 const win=new BrowserWindow({width:1300,height:1200,show:false,webPreferences:{contextIsolation:true,nodeIntegration:false}});
 const run=s=>win.webContents.executeJavaScript(s);
 await win.loadURL(base);await new Promise(r=>setTimeout(r,500));
 const utility=await run(`(function(){
   function mouse(node,type,x,y){node.dispatchEvent(new MouseEvent(type,{bubbles:true,cancelable:true,button:0,clientX:x,clientY:y}));}
   toggleMapUtilityTool('stopwatch');toggleMapUtilityTool('calculator');
   var clock=document.getElementById('mapStopwatchDevice'),calc=document.getElementById('mapCalculatorDevice');
   clock.style.left='20px';clock.style.top='20px';calc.style.left='500px';calc.style.top='20px';
   var dial=clock.querySelector('.stopwatch-dial'),r=dial.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+25;
   mouse(dial,'mousedown',x,y);mouse(window,'mouseup',x,y);
   var started=document.getElementById('mapStopwatchStartStop').textContent;
   mouse(dial,'mousedown',x,y);mouse(window,'mouseup',x,y);
   var stopped=document.getElementById('mapStopwatchStartStop').textContent;
   y=r.bottom-25;mouse(dial,'mousedown',x,y);mouse(window,'mouseup',x,y);
   var timer=document.getElementById('mapStopwatchTimerLabel').textContent;

   var oldLeft=parseFloat(clock.style.left);y=r.top+25;
   mouse(dial,'mousedown',x,y);mouse(window,'mousemove',x+90,y+50);mouse(window,'mouseup',x+90,y+50);
   var moved=parseFloat(clock.style.left)-oldLeft,afterDrag=document.getElementById('mapStopwatchStartStop').textContent;
   var title=calc.querySelector('.map-utility-device-title'),cr=title.getBoundingClientRect();
   mouse(title,'mousedown',cr.x+5,cr.y+5);mouse(window,'mousemove',cr.x+55,cr.y+85);mouse(window,'mouseup',cr.x+55,cr.y+85);
   var calcMoved=parseFloat(calc.style.left)-500;
   var sizes=[];for(var pair of [[clock,'mapStopwatchScale'],[calc,'mapCalculatorScale']]){
    var before=pair[0].getBoundingClientRect().width;document.getElementById(pair[1]).click();sizes.push({before,transform:pair[0].style.transform});
   }
   r=dial.getBoundingClientRect();x=r.left+r.width/2;y=r.top+25;
   function pointer(type){dial.dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,button:0,pointerId:99,pointerType:'mouse',clientX:x,clientY:y}));}
   pointer('pointerdown');pointer('pointercancel');
   var canceled=document.getElementById('mapStopwatchStartStop').textContent;
   pointer('pointerdown');pointer('pointerup');mouse(dial,'mousedown',x,y);mouse(window,'mouseup',x,y);
   var once=document.getElementById('mapStopwatchStartStop').textContent;
   return {started,stopped,timer,moved,afterDrag,calcMoved,sizes,canceled,once};
 })()`);
 assert.equal(utility.started,'STOP');assert.equal(utility.stopped,'START');assert.equal(utility.timer,'RUN');
 assert.equal(utility.moved,90);assert.equal(utility.afterDrag,'START');assert.equal(utility.calcMoved,50);
 assert.ok(utility.sizes.every(x=>x.transform==='scale(1.5)'));
 assert.equal(utility.canceled,'START');assert.equal(utility.once,'STOP');
 await new Promise(r=>setTimeout(r,300));fs.writeFileSync(path.join(output,'utilities.png'),(await win.webContents.capturePage()).toPNG());
 // The parent EFB surface must pan at the same outer ring as the standalone.
 await run("toggleMapUtilityTool('e6b')");
 await new Promise(r=>setTimeout(r,900));
 const pan=await run(`(function(){
  var frame=document.getElementById('mapE6BFrame'),surface=document.querySelector('.ga-efb-e6b-input-surface');
  var sent=[],original=frame.contentWindow.postMessage;
  frame.contentWindow.postMessage=function(data){sent.push(data);};
  function mouse(type,x,y){surface.dispatchEvent(new MouseEvent(type,{bubbles:true,cancelable:true,button:0,clientX:x,clientY:y}));}
  var rect=surface.getBoundingClientRect(),x=rect.left+rect.width*.1,y=rect.top+rect.height/2;
  mouse('mousedown',x,y);mouse('mousemove',x+25,y+15);mouse('mouseup',x+25,y+15);
  frame.contentWindow.postMessage=original;
  return sent;
 })()`);
 assert.ok(pan.some(x=>x.type==='ga-e6b-pan-view'&&x.dx===25&&x.dy===15),JSON.stringify(pan));
 assert.ok(!pan.some(x=>x.type==='ga-e6b-rotate-delta'));
 await win.loadURL(base+'/efb/v1/e6b/e6b-flight-computer.html?embedded=1&coherent=1');
 await new Promise(r=>setTimeout(r,1000));
 const zoom=await run(`(function(){
  function send(data){window.dispatchEvent(new MessageEvent('message',{data:data}));}
  send({type:'ga-e6b-set-base-size',frontWidth:300,windWidth:300});
  var out=[];for(var side of ['front','wind']){
   send({type:'ga-e6b-set-side',side:side});
   var stack=document.getElementById(side==='front'?'e6bFrontStack':'e6bWindStack'),rows=[];
   for(var scale of [0.55,0.9,1,1.01,1.16,1.5,2,2.5,3.4]){
    send({type:'ga-e6b-set-view',scale:scale,x:0,y:0});
    rows.push({scale:scale,width:stack.getBoundingClientRect().width});
   }out.push({side:side,rows:rows});
  }
  return out;
 })()`);
 for(const side of zoom)for(const row of side.rows)assert.ok(Math.abs(row.width-300*row.scale)<1,JSON.stringify({side:side.side,...row}));
 const ink=await run(`(function(){var ink=document.querySelector('svg text.trace-number:not([aria-hidden])');return {count:document.querySelectorAll('svg text.trace-number[aria-hidden=true]').length,fill:getComputedStyle(ink).fill,stroke:getComputedStyle(ink).stroke};})()`);
 assert.ok(ink.count>0);assert.equal(ink.fill,'rgb(16, 20, 24)');assert.equal(ink.stroke,'none');
 fs.writeFileSync(path.join(output,'result.json'),JSON.stringify({utility,pan,zoom,ink},null,2));
 console.log('EFB_UTILITY_INPUT_UI_OK '+output);win.destroy();server.close();app.exit(0);
}).catch(e=>{console.error(e.stack);app.exit(1)});
