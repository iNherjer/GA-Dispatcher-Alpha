// Actual shared menus and EFB host, offline HTTP fixtures, source + Coherent build.
const {app,BrowserWindow,session}=require('electron');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const efb=require('../ga-tracker-client/tracker-efb-web-client');
const root=path.resolve(__dirname,'..'),output='/tmp/ga-display-clock-proof';fs.mkdirSync(output,{recursive:true});
let mode='efb-compiled';
app.whenReady().then(async()=>{
 const server=http.createServer(async(req,res)=>{
  const pathname=new URL(req.url,'http://localhost').pathname;
  if(pathname==='/'){
   res.setHeader('Content-Type','text/html');
   if(mode==='web'){
    const source=fs.readFileSync(path.join(root,'sync.js'),'utf8');
    const eta=source.slice(source.indexOf('function formatRouteProgressEta('),source.indexOf('\nfunction getRouteProgressMinutes(',source.indexOf('function formatRouteProgressEta(')));
    res.end('<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="/efb/v1/assets/app-styles.css"></head><body>'+efb.extractKartentischMarkup()+'<script>window.__errors=[];addEventListener("error",e=>__errors.push((e.error&&e.error.stack||e.message)+" "+e.filename+":"+e.lineno));</script><script src="/source/display-clock.js"></script><script src="/source/map-display-controls.js"></script><script>'+eta+';document.getElementById("mapTableOverlay").classList.add("active");</script></body></html>');return;
   }
   res.end(efb.createTrackerEfbWebClientPage().replace('<head>','<head><script>window.__errors=[];addEventListener("error",e=>__errors.push((e.error&&e.error.stack||e.message)+" "+e.filename+":"+e.lineno));addEventListener("unhandledrejection",e=>__errors.push(String(e.reason)));</script>'));return;
  }
  if(pathname.startsWith('/source/')){res.setHeader('Content-Type','text/javascript');res.end(fs.readFileSync(path.join(root,path.basename(pathname))));return;}
  const asset=efb.getTrackerEfbWebClientAsset(pathname);
  if(asset){res.setHeader('Content-Type',asset.contentType);let body=asset.body;
   if(mode==='efb-source'&&/\/(display-clock|map-display-controls)\.js$/.test(pathname))body=fs.readFileSync(path.join(root,path.basename(pathname)));
   if(pathname.endsWith('/host.js'))body=body.toString().replace(/\}\)\(\);\s*$/,`pollingClosed=true;window.__clockTest={flight:renderFlight,apply:applyUiPreferences,seed:function(){flight=null;mapSnapshot={context:{},route:{waypoints:[{lat:48,lon:8,name:'A'},{lat:48.1,lon:8.1,name:'B'}]}};}};})();`);
   res.end(body);return;
  }
  res.setHeader('Content-Type','application/json');res.end(JSON.stringify({payload:{available:false},items:[],ok:true}));
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 session.defaultSession.webRequest.onBeforeRequest((d,cb)=>cb({cancel:!d.url.startsWith(base)&&!d.url.startsWith('data:')}));
 const win=new BrowserWindow({width:440,height:894,show:false,webPreferences:{nodeIntegration:false,contextIsolation:true}});
 const results=[];
 for(mode of ['web','efb-source','efb-compiled']){
  await session.defaultSession.clearStorageData();await win.loadURL(base);await new Promise(r=>setTimeout(r,300));
  console.log('Testing '+mode);
  const result=await win.webContents.executeJavaScript(`(async function(){
   const el=id=>document.getElementById(id),check=(ok,msg)=>{if(!ok)throw Error(msg)},clock=GADisplayClock;
   check(clock.settings().source==='simulator'&&clock.settings().zone==='utc','Defaults');
   check(clock.current().fallback&&el('mapClockStatus').textContent.includes('Fallback'),'Missing sample fallback');
   check(el('infoWindowsMenuBlock').contains(el('hintToggleTelemetry'))&&el('infoWindowsMenuBlock').contains(el('hintToggleNextLeg')),'Info hierarchy');
   el('btnToggleInfoWindowsMenu').click();check(el('infoWindowsMenuBlock').style.display==='block','Info click');
   check(el('btnToggleInfoWindowsMenu').getAttribute('aria-expanded')==='true','Accessible info state');
   el('btnToggleClockMenu').click();check(el('clockMenuBlock').style.display==='block','Clock submenu click');
   check(el('btnToggleClockMenu').textContent==='▾'&&el('btnToggleInfoWindowsMenu').textContent==='▸','Weather-style arrow state');
   const abs=63900000000-63900000000%86400;
   const tick=(utc,local,extra={})=>{
    const fd={simAbsoluteTimeSeconds:abs+utc,simLocalTimeSeconds:local,gsKts:90,...extra};
    if(window.__clockTest){__clockTest.seed();__clockTest.flight({available:true,lat:48,lon:8,alt:1500,hdg:45,capturedAt:Date.now(),flight:fd});}
    else clock.observe(fd);
   };
   tick(86340,3540);
   check(clock.eta(2)==='00:01','UTC midnight ETA');
   check(el('routeProgressTimeBasis').textContent==='SIM UTC','ETA basis');
   if(window.formatRouteProgressEta){check(formatRouteProgressEta(2)==='00:01','Web ETA wiring');check(formatRouteProgressEta(null)==='--:--','Unknown duration');}
   if(window.__clockTest){check(el('routeProgressEta').textContent===clock.eta(GAMapNavigationGeometry.buildNavigation({lat:48,lon:8},[{lat:48,lon:8},{lat:48.1,lon:8.1}],GAMapNavigationGeometry.buildLegs([{lat:48,lon:8},{lat:48.1,lon:8.1}]),{}).distanceToNextNm/90*60),'EFB ETA wiring');}
   el('mapClockZone').value='local';el('mapClockZone').dispatchEvent(new Event('change',{bubbles:true}));
   check(clock.eta(2)==='01:01'&&clock.settings().zone==='local','Local select');
   check(el('mapStopwatchUtc').textContent==='23:59:00'&&el('mapStopwatchLocal').textContent==='00:59:00','Dual clock source');
   tick(1800,5400,{simPaused:true,simulationRate:4});
   await new Promise(r=>setTimeout(r,1100));check(clock.eta(0)==='01:30','Pause extrapolation');
   tick(7200,10800);check(clock.eta(0)==='03:00','Time jump');
   clock.observe({simAbsoluteTimeSeconds:abs+7200,simLocalTimeSeconds:10800},Date.now()-7000);
   await new Promise(r=>setTimeout(r,2500));
   check(clock.current().source==='device'&&clock.current().zone==='utc'&&clock.current().fallback,'Stale local fallback to UTC');
   check(el('mapStopwatchLocalLabel').textContent==='UTC (Fallback)'&&el('routeProgressTimeBasis').textContent.includes('GER UTC'),'Fallback labels');
   tick(7200,10800);check(clock.current().source==='simulator'&&clock.current().zone==='local','Automatic recovery');
   if(window.__clockTest){__clockTest.flight({available:false});check(clock.current().fallback,'EFB disconnect retains sample');}
   else{clock.clear();check(clock.current().fallback,'Web disconnect retains sample');}
   el('mapClockSource').value='device';el('mapClockSource').dispatchEvent(new Event('change',{bubbles:true}));
   const d=new Date();check(!clock.current().fallback&&clock.eta(0)===String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0'),'Device local');
   const stored=JSON.parse(localStorage.getItem('ga_display_clock_v1'));check(stored.source==='device'&&stored.zone==='local','Persistence');
   if(window.__clockTest){__clockTest.apply({ui:{clockSource:'simulator',clockZone:'utc'},uiRevision:10});/* pending user choices take precedence */}
   clock.set({source:'simulator',zone:'utc'},false);tick(7200,10800);
   toggleMapHintsMenu(true);
   setMapHintSubmenuOpen('clockMenu',true);
   setMapHintSubmenuOpen('infoWindowsMenu',false);
   el('mapClockSource').scrollIntoView({block:'center'});
   clock.refresh();check(__errors.length===0,'Browser errors: '+__errors.join(' | '));
   return {basis:el('routeProgressTimeBasis').textContent,status:el('mapClockStatus').textContent,infoOpen:el('infoWindowsMenuBlock').style.display};
  })()`);
  results.push({mode,...result});
  await new Promise(r=>setTimeout(r,250));
  fs.writeFileSync(path.join(output,mode+'.png'),(await win.webContents.capturePage()).toPNG());
  await win.webContents.executeJavaScript(`GADisplayClock.set({source:'device',zone:'local'},false)`);
  await win.loadURL(base);await new Promise(r=>setTimeout(r,250));
  assert.deepEqual(await win.webContents.executeJavaScript(`GADisplayClock.settings()`),{source:'device',zone:'local'});
 }
 console.log('DISPLAY_CLOCK_UI_OK '+JSON.stringify(results));win.destroy();server.close();app.quit();
}).catch(e=>{console.error(e);app.exit(1);});
