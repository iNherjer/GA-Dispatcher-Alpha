const {app,BrowserWindow,session}=require('electron');
const http=require('node:http'),fs=require('node:fs'),assert=require('node:assert/strict');
const efb=require('../ga-tracker-client/tracker-efb-web-client');
app.whenReady().then(async()=>{
 const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname==='/'){res.setHeader('Content-Type','text/html');res.end(efb.createTrackerEfbWebClientPage());return;}
  const asset=efb.getTrackerEfbWebClientAsset(url.pathname);
  if(asset){res.setHeader('Content-Type',asset.contentType);let body=asset.body;
   if(url.pathname.endsWith('/host.js'))body=body.toString().replace(/\}\)\(\);\s*$/,'pollingClosed=true;window.__manualTest=function(){missionSnapshot={available:true,control:{missionId:"m",runId:"r",phase:"active"},view:{title:"Testmission",taskText:"Testauftrag",phase:"active"}};mapSnapshot={missionId:"m",routeEdit:{revision:3}};flightPlanBridgeReadyUntil=Date.now()+12000;};})();');
   res.end(body);return;}
  res.setHeader('Content-Type','application/json');res.end(JSON.stringify({available:false,ok:true}));
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 session.defaultSession.webRequest.onBeforeRequest((details,cb)=>cb({cancel:!details.url.startsWith(base)}));
 const win=new BrowserWindow({width:440,height:800,show:false,webPreferences:{nodeIntegration:false,contextIsolation:true}});
 await win.loadURL(base);
 const result=await win.webContents.executeJavaScript(`(async()=>{
  window.__manualTest();let request;window.__missionIntents=0;
  window.gaCockpitSessionClient={submitTool:async data=>{request=data;return {ok:true,plan:{routeHash:'hash',navigationRevision:3}};},submitIntent:()=>{__missionIntents++;}};
  window.__gaEfbChannel='test';gaChecklistOpen('mission');
  const buttons=Array.from(document.querySelectorAll('[data-action="mission-flightplan-transfer"]'));
  if(buttons.length!==2)throw Error('Missing manual buttons');
  buttons[1].click();await new Promise(r=>setTimeout(r,300));
  if(!request||request.intent!=='flightplan_export'||request.payload.navigationRevision!==3||__missionIntents)throw Error('Incorrect intent or revision');
  document.getElementById('checklistDrawerBody').scrollTop=9999;
  const rects=Array.from(document.querySelectorAll('[data-action="mission-flightplan-transfer"]')).map(b=>{const r=b.getBoundingClientRect();return {width:r.width,height:r.height,left:r.left,right:r.right};});
  if(rects.some(r=>r.width<=0||r.height<40||r.height>80||r.right>innerWidth+1))throw Error('Button overflow '+JSON.stringify(rects));
  return {ok:true,rects,request};
 })()`);
 console.log(JSON.stringify(result));fs.mkdirSync('/tmp/ga-manual-flightplan-ui',{recursive:true});
 fs.writeFileSync('/tmp/ga-manual-flightplan-ui/mission-440.png',(await win.webContents.capturePage()).toPNG());
 win.destroy();await new Promise(r=>server.close(r));app.quit();
}).catch(e=>{console.error(e);app.exit(1);});
