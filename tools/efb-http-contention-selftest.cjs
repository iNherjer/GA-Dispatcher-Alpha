// Run with Electron. Uses production profile XHR and snapshot request code.
// Local servers deliberately hold profile responses to reproduce HTTP socket
// contention; no external network or user data is accessed.
const {app,BrowserWindow}=require('electron');
const http=require('node:http'),fs=require('node:fs'),assert=require('node:assert/strict');
const root=require('node:path').resolve(__dirname,'../ga-tracker-client');
const client=fs.readFileSync(root+'/tracker-cockpit-session-client.js','utf8');
const bridge=fs.readFileSync(root+'/tracker-efb-profile-bridge.js','utf8');
let active=0, maxActive=0, seenSnapshot=0, holds=[];
const server=http.createServer((req,res)=>{
 res.setHeader('Access-Control-Allow-Origin','*');
 if(req.url==='/')return res.end('<html><body></body></html>');
 if(req.url==='/api/v1/profile-data'){
  active++;maxActive=Math.max(active,maxActive);req.resume();holds.push(res);
  res.on('close',()=>active--);return;
 }
 seenSnapshot++;res.setHeader('Content-Type','application/json');res.end('{"ok":true}');
});
const isolated=http.createServer((req,res)=>{res.setHeader('Access-Control-Allow-Origin','*');res.end('{"ok":true}');});
app.whenReady().then(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));await new Promise(r=>isolated.listen(0,'127.0.0.1',r));
 const base='http://127.0.0.1:'+server.address().port,other='http://127.0.0.1:'+isolated.address().port;
 const win=new BrowserWindow({show:false,webPreferences:{nodeIntegration:false,contextIsolation:true}});
 try{
 await win.loadURL(base);
 await win.webContents.executeJavaScript(client+";true");
 // Use the production profile XHR transport, with inert presentation dependencies.
 await win.webContents.executeJavaScript('window.GANavigationWarnings={};window.GANavigationWarningPresentation={};'+bridge+';true');
 const baseline=await win.webContents.executeJavaScript(`GATrackerCockpitSessionClient.requestJson(fetch,'/api/v1/snapshot',{},5000).then(()=>true)`);
 assert.equal(baseline,true);seenSnapshot=0;
 await win.webContents.executeJavaScript(`window.pendingBackground=Array.from({length:6},()=>gaProfileDataProvider.fetch('cities.json',{}).catch(()=>{}));true`);
 await new Promise(r=>setTimeout(r,150));
 const during=await win.webContents.executeJavaScript(`(async()=>{const start=performance.now();const error=await GATrackerCockpitSessionClient.requestJson(fetch,'/api/v1/snapshot',{},5000).then(()=>null,e=>e.message);const isolatedStart=performance.now();await GATrackerCockpitSessionClient.requestJson(fetch,'${other}/api/v1/snapshot',{},5000);return {error,elapsedMs:Math.round(isolatedStart-start),isolatedMs:Math.round(performance.now()-isolatedStart)};})()`);
 const beforeRelease={...during,backgroundRequestsAtServer:active,maxActive,snapshotRequestsAtServer:seenSnapshot};
 holds.forEach(r=>r.end('[]'));holds=[];
 await win.webContents.executeJavaScript(`Promise.all(window.pendingBackground).then(()=>true)`);
 const recovered=await win.webContents.executeJavaScript(`GATrackerCockpitSessionClient.requestJson(fetch,'/api/v1/snapshot',{},5000).then(()=>true)`);
 console.log(JSON.stringify({baseline,beforeRelease,recovered}));
 assert.equal(during.error,'tracker_request_timeout');assert.equal(beforeRelease.snapshotRequestsAtServer,0);assert.equal(recovered,true);
 }finally{holds.forEach(r=>r.destroy());win.destroy();server.close();isolated.close();app.quit();}
}).catch(e=>{console.error(e);app.exit(1)});
