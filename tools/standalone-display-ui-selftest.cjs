const {app,BrowserWindow,session}=require('electron');
const fs=require('node:fs'),http=require('node:http'),path=require('node:path'),assert=require('node:assert/strict');
// Exercise the actual standalone entry page; external requests are blocked.
const repo=path.resolve(__dirname,'..');
app.whenReady().then(async()=>{
 const server=http.createServer((req,res)=>{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const file=path.resolve(repo,'.'+(pathname==='/'?'/index.html':pathname));
  if(!file.startsWith(repo+'/')){res.statusCode=404;res.end();return;}
  try {let data=fs.readFileSync(file);const ext=path.extname(file);
   res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json'})[ext]||'application/octet-stream');
   if(ext==='.html')data=data.toString().replace('<head>','<head><script>window.__scriptErrors=[];addEventListener("error",e=>{if(e.error)__scriptErrors.push(String(e.error));});</script>');
   res.end(data);
  }catch(e){res.statusCode=404;res.end();}
 });await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const address='http://127.0.0.1:'+server.address().port;
 session.defaultSession.webRequest.onBeforeRequest((d,cb)=>cb({cancel:!d.url.startsWith(address)&&!d.url.startsWith('data:')&&!d.url.startsWith('blob:')}));
 const win=new BrowserWindow({width:600,height:800,show:false,webPreferences:{nodeIntegration:false,contextIsolation:true}});
 await win.loadURL(address);await new Promise(r=>setTimeout(r,1200));
 const result=await win.webContents.executeJavaScript(`(function(){
  if(window.gaMapDisplayAdapter)throw Error('EFB adapter leaked into standalone');
  initMapBase();document.getElementById('mapTableOverlay').classList.add('active');
  routeWaypoints=[{lat:48.36,lon:7.83},{lat:48.45,lon:7.92}];renderMainRoute();
  toggleMapHintsMenu(true);
  const before=mapHints.telemetry;toggleMapHint('telemetry');
  if(mapHints.telemetry===before)throw Error('Standalone toggle failed');
  if(!document.getElementById('liveTelemetryBox').classList.contains('tele-hint-off'))throw Error('Original visibility effect missing');
  cycleRouteLegLabelMode();
  if(!document.querySelector('.route-leg-detail').textContent.includes('min'))throw Error('Original leg renderer failed');
  applyPlaneIconSettings({size:58,color:'#44bb22',persist:true});
  if(document.getElementById('vpPlaneSizeValue').textContent!=='58 px')throw Error('Original plane UI failed');
  gaChecklistOpen('home');if(document.querySelectorAll('.checklist-tool-tile').length!==8)throw Error('Standalone sidebar changed');gaChecklistCloseDrawer();
  document.querySelector('.leaflet-control-layers-toggle').click();
  const layers=document.querySelector('.leaflet-control-layers');if(!layers.classList.contains('ga-layer-menu-open')||layers.parentElement.id!=='mapArea')throw Error('Layer portal not attached to map frame');
  document.body.click();
  return {errors:__scriptErrors,labels:document.querySelector('.route-leg-detail').textContent,menu:document.getElementById('mapHintsMenu').style.display};
 })()`);
 assert.deepEqual(result.errors,[]);assert.equal(result.menu,'none');console.log('PASS complete standalone page startup, original menu effects, leg labels and aircraft settings.',result);
 win.destroy();server.close();app.quit();
}).catch(e=>{console.error(e);app.exit(1);});
