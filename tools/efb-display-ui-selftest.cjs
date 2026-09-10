const {app,BrowserWindow,session}=require('electron');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const repo=path.resolve(__dirname,'..'),efb=require('../ga-tracker-client/tracker-efb-web-client');
const output='/tmp/ga-display-ui-check';fs.mkdirSync(output,{recursive:true});
app.whenReady().then(async()=>{
 let raw=false;
 const server=http.createServer((req,res)=>{
  const pathname=new URL(req.url,'http://localhost').pathname;
  if(pathname==='/'){res.setHeader('Content-Type','text/html');res.end(efb.createTrackerEfbWebClientPage().replace('<head>','<head><script>window.__errors=[];addEventListener("error",e=>__errors.push(e.message));addEventListener("unhandledrejection",e=>__errors.push(String(e.reason)));</script>'));return;}
  const asset=efb.getTrackerEfbWebClientAsset(pathname);
  if(asset){res.setHeader('Content-Type',asset.contentType);let body=asset.body.toString();
   if(raw&&pathname.endsWith('/map-display-controls.js'))body=fs.readFileSync(path.join(repo,'map-display-controls.js'),'utf8');
   if(pathname.endsWith('/host.js'))body=body.replace(/\}\)\(\);\s*$/,`pollingClosed=true;window.__test={flight:renderFlight,trail:function(){return liveTrailPoints;},save:saveLiveTrail,line:function(){return previewLine;},map:function(){return map;},seed:function(){mapSnapshot={context:{tasKts:120},route:{waypoints:[{lat:48.36,lon:7.83},{lat:48.45,lon:7.92}],totalDistanceNm:6},navigation:{activeLegIndex:0,distanceToNextNm:6,bearingToNextDeg:40,remainingDistanceNm:6,crossTrackNm:1}};renderProfile();}};})();`);
   res.end(body);return;}
  res.setHeader('Content-Type','application/json');res.end(JSON.stringify({available:false,items:[],ok:true}));
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const address='http://127.0.0.1:'+server.address().port;
 session.defaultSession.webRequest.onBeforeRequest((d,cb)=>cb({cancel:!d.url.startsWith(address)&&!d.url.startsWith('data:')}));
 const win=new BrowserWindow({width:440,height:894,show:false,webPreferences:{nodeIntegration:false,contextIsolation:true}});
 const results=[];
 for(raw of [false,true]){
  await session.defaultSession.clearStorageData();await win.loadURL(address);await new Promise(r=>setTimeout(r,350));
  const result=await win.webContents.executeJavaScript(`(function(){
    const el=id=>document.getElementById(id),click=id=>el(id).click();
    if(!window.__test)throw Error('Host unavailable');__test.seed();
    __test.flight({available:true,viewSessionId:'A',lat:48.36,lon:7.83,alt:750,hdg:208,capturedAt:Date.now()+1000,flight:{gsKts:90}});
    __test.flight({available:true,viewSessionId:'A',lat:48.361,lon:7.83,alt:750,hdg:208,capturedAt:Date.now()+1500,flight:{gsKts:90}});
    if(__test.trail().length!==2)throw Error('Trail sampling');
    if(!__test.line()||__test.line().options.color!=='#ff3fd9')throw Error('Automatic direct line');
    if(document.querySelector('.ga-efb-host-menu'))throw Error('Invented dropdown');
    click('mapHintsBtn');if(el('mapHintsBtn').getAttribute('aria-expanded')!=='true')throw Error('Menu closed');
    const labels=['hintToggleTelemetry','hintToggleCurrentInfo','hintToggleNextLeg','hintToggleRouteProgress','hintToggleCompass','hintToggleLowFps'].map(id=>el(id).textContent);
    click('hintToggleTelemetry');__test.flight({available:true,viewSessionId:'A',lat:48.361,lon:7.83,alt:750,hdg:208,capturedAt:Date.now()+2000,flight:{gsKts:90}});
    if(getComputedStyle(el('liveTelemetryBox')).display!=='none'||localStorage.ga_map_hint_telemetry!=='false')throw Error('Telemetry returns after snapshot');
    click('hintToggleMagentaLine');if(__test.line())throw Error('Direct line remains');click('hintToggleMagentaLine');if(!__test.line())throw Error('Direct line missing');
    click('hintToggleCompass');if(getComputedStyle(el('compassRoseWrap')).display!=='none')throw Error('Compass visibility');click('hintToggleCompass');
    click('hintToggleRouteProgress');if(getComputedStyle(el('routeProgressBar')).display!=='none')throw Error('Progress visibility');click('hintToggleRouteProgress');
    click('hintToggleLowFps');if(!document.querySelector('.low-fps-plane'))throw Error('Plane performance class');click('hintToggleLowFps');
    click('routeLegLabelModeBtn');if(!el('routeLegLabelModeBtn').textContent.includes('Dauer')||!document.querySelector('.route-leg-detail').textContent.includes('min'))throw Error('Leg duration');
    click('routeLegLabelModeBtn');if(!document.querySelector('.route-leg-detail').textContent.includes('NM /'))throw Error('Combined leg labels');
    click('btnTogglePlaneIconMenu');el('vpPlaneSizeSlider').value='65';el('vpPlaneSizeSlider').dispatchEvent(new Event('input'));
    el('vpPlaneColorPicker').value='#22cc44';el('vpPlaneColorPicker').dispatchEvent(new Event('input'));
    if(getComputedStyle(document.documentElement).getPropertyValue('--plane-size').trim()!=='65px')throw Error('Plane size');
    if(localStorage.ga_plane_color!=='#22cc44')throw Error('Plane color persistence');
    if(!el('hintToggleWeather').disabled||el('hintToggleAutoZoom').disabled||el('hintToggleTerrainAvoid').disabled)throw Error('Unmigrated controls pretend to work');
    positionMapHintsMenuInViewport();const rect=el('mapHintsMenu').getBoundingClientRect().toJSON();
    if(rect.left<0||rect.right>innerWidth||rect.top<0||rect.bottom>innerHeight)throw Error('Menu outside viewport '+JSON.stringify(rect));
    const labelWidth=el('mapHintsMenu').offsetWidth;
    document.body.click();if(el('mapHintsMenu').style.display!=='none'||el('vpPlaneIconMenu').style.display!=='none')throw Error('Outside close');
    __test.save();return {labels,labelWidth,errors:__errors};
  })()`);
  assert.deepEqual(result.errors,[]);results.push(result);
  await win.webContents.executeJavaScript('toggleMapHintsMenu(true);toggleVpPlaneIconMenu()');
  await new Promise(r=>setTimeout(r,300));
  fs.writeFileSync(path.join(output,raw?'standalone-source.png':'efb-compiled.png'),(await win.webContents.capturePage()).toPNG());
  await win.loadURL(address);await new Promise(r=>setTimeout(r,250));
  await win.webContents.executeJavaScript(`(function(){
    __test.seed();__test.flight({available:true,viewSessionId:'A',lat:48.361,lon:7.83,alt:750,hdg:208,capturedAt:Date.now()+2500,flight:{gsKts:90}});
    if(__test.trail().length!==2)throw Error('Same-session trail not restored');
    if(localStorage.ga_map_hint_telemetry!=='false'||getComputedStyle(document.getElementById('liveTelemetryBox')).display!=='none')throw Error('Visibility lost on reload');
    if(getComputedStyle(document.documentElement).getPropertyValue('--plane-size').trim()!=='65px')throw Error('Plane preference lost');
    __test.flight({available:true,viewSessionId:'B',lat:48.361,lon:7.83,alt:750,hdg:208,capturedAt:Date.now()+3000,flight:{gsKts:90}});
    if(__test.trail().length!==1)throw Error('Previous tracker trail leaked');
    __test.flight({available:false,viewSessionId:'B'});if(__test.trail().length!==0)throw Error('Stopped telemetry retained trail');
  })()`);
  for(const size of [[894,440],[440,894]]){
    win.setSize(...size);await new Promise(r=>setTimeout(r,100));
    const r=await win.webContents.executeJavaScript(`toggleMapHintsMenu(true);document.getElementById('mapHintsMenu').getBoundingClientRect().toJSON()`);
    assert.ok(r.left>=0&&r.right<=size[0]&&r.top>=0&&r.bottom<=size[1],JSON.stringify(r));
  }
 }
 assert.deepEqual(results[0],results[1]);
 fs.writeFileSync(path.join(output,'results.json'),JSON.stringify(results,null,2));
 console.log('PASS original/compiled display menu, controls, leg labels, plane settings, resize and session breadcrumb restore.');
 win.destroy();server.close();app.quit();
}).catch(e=>{console.error(e);app.exit(1);});
