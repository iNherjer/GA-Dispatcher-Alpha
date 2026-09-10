const { app, BrowserWindow, session } = require('electron');
const http = require('node:http'), fs = require('node:fs'), path = require('node:path'), assert=require('node:assert/strict');
// Run with the desktop Electron binary; all external requests are blocked.
const repo = path.resolve(__dirname, '..');
const output = process.env.GA_UI_CHECK_OUTPUT || '/tmp/ga-profile-ui-check';
fs.mkdirSync(output, { recursive: true });
const efb = require(path.join(repo, 'ga-tracker-client/tracker-efb-web-client.js'));
app.whenReady().then(async () => {
 const server = http.createServer(async (req,res) => {
  const url = new URL(req.url,'http://localhost');
  if(url.pathname === '/embedded') { res.setHeader('Content-Type','text/html');res.end('<iframe src="/" style="position:fixed;inset:0;width:100%;height:100%;border:0"></iframe>');return; }
  if(url.pathname === '/') { res.setHeader('Content-Type','text/html');res.end(efb.createTrackerEfbWebClientPage().replace('<head>', '<head><script>window.AbortController=undefined;window.__errors=[];addEventListener("error",function(e){__errors.push(e.message)});addEventListener("unhandledrejection",function(e){__errors.push(String(e.reason))});</script>'));return; }
  if(url.pathname === '/api/v1/profile-data') {
    let raw='';for await(const chunk of req) raw+=chunk;const data=JSON.parse(raw);
    let value=[];
    if(data.kind==='terrain')value=data.points.map(p=>({...p,elevFt:500+Math.round((p.lat-48.36)*18000)}));
    if(data.kind==='airspaces')value=[{name:'LAHR CTR',type:4,icaoClass:3,lowerLimit:{value:0,unit:1,referenceDatum:0},upperLimit:{value:2500,unit:1,referenceDatum:1},geometry:{type:'Polygon',coordinates:[[[7.7,48.3],[8,48.3],[8,48.6],[7.7,48.6],[7.7,48.3]]]}}];
    if(data.kind==='resource') {
      if(data.url.includes('cities.json'))value=[{name:'Lahr',lat:48.36,lon:7.83,pop:40000}];
      else if(data.url.includes('airports.json'))value={EDTL:{icao:'EDTL',lat:48.36,lon:7.83},EDTO:{icao:'EDTO',lat:48.45,lon:7.92}};
      else if(data.url.includes('obstacles'))value={obs:[{lat:48.40,lon:7.87,hFt:300,type:'wind'}],lin:[]};
      else value=[{icaoId:'EDTL',lat:48.36,lon:7.83,elev:150,temp:15,dewp:10,wdir:220,wspd:6,altim:1013,obsTime:Date.now()/1000,rawOb:'EDTL 100900Z 22006KT 9999 BKN020 15/10 Q1013',clouds:[{cover:'BKN',base:2000}]}];
    }
    res.setHeader('Content-Type','application/json');res.end(JSON.stringify(value));return;
  }
  const asset=efb.getTrackerEfbWebClientAsset(url.pathname);
  if(asset) {
   res.setHeader('Content-Type',asset.contentType);
   let body=asset.body;
   if(process.env.GA_UI_USE_STANDALONE_PROFILE==='1' && ['/profile.js','/map-profile-controls.js','/navigation-warning-core.js'].some(name=>url.pathname.endsWith(name))) body=fs.readFileSync(path.join(repo,path.basename(url.pathname)));

   if(url.pathname.endsWith('/host.js')) body=body.toString().replace(/\}\)\(\);\s*$/, `pollingClosed=true;window.__test={setMap:function(value){mapSnapshot=value;applyTheme();renderProgress();},flight:renderFlight,trail:function(){return liveTrailPoints;},marker:function(){return planeMarker;}};})();`);
   res.end(body);return;
  }
  res.setHeader('Content-Type','application/json');res.end(JSON.stringify({available:false,items:[],ok:true}));
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const address='http://127.0.0.1:'+server.address().port;
 session.defaultSession.webRequest.onBeforeRequest((details,cb)=>cb({cancel:!details.url.startsWith(address)&&!details.url.startsWith('data:')}));
 const win = new BrowserWindow({width:600,height:790,show:false,webPreferences:{contextIsolation:true,nodeIntegration:false}});
 const errors=[];win.webContents.on('console-message',(_e,_level,message)=>{if(/ReferenceError|TypeError|not defined/.test(message))errors.push(message);});
 await win.loadURL(address);await new Promise(r=>setTimeout(r,500));
 const setup=await win.webContents.executeJavaScript(`(function(){
 if(!window.__test)throw Error('Host not ready');
 __test.setMap({context:{theme:"retro",tasKts:132,profileCruiseFt:4100,profileClimbFpm:600,profileDescentFpm:700},route:{waypoints:[{lat:48.36,lon:7.83},{lat:48.45,lon:7.92}],totalDistanceNm:6},navigation:{activeLegIndex:0,distanceToNextNm:6,bearingToNextDeg:40,remainingDistanceNm:6,crossTrackNm:1}});
 __test.flight({available:true,lat:48.36,lon:7.83,alt:750,hdg:359,capturedAt:Date.now()+1000,flight:{gsKts:90}});
 const svg=__test.marker().getElement().querySelector('svg');
 __test.flight({available:true,lat:48.361,lon:7.83,alt:750,hdg:1,capturedAt:Date.now()+2500,flight:{gsKts:90}});
 if(svg!==__test.marker().getElement().querySelector('svg'))throw Error('Plane DOM replaced');
 if(__test.trail().length!==2)throw Error('Trail not sampled');
 if(!document.getElementById('compassSvg').textContent.includes('S'))throw Error('South missing');
 if(document.getElementById('compassCdiBarFixed').getAttribute('x1')!=='1.2')throw Error('CDI sign wrong');
 const b=document.getElementById('missionStartBanner');b.style.display='flex';
 document.getElementById('missionStartBannerText').textContent='Missionsstart freigegeben. Mit dem nächsten Klick beginnt Boarding und Verladen.';
 document.getElementById('missionStartBannerBtn').textContent='Boarding und Verladen beginnen';
 function rect(id){return document.getElementById(id).getBoundingClientRect().toJSON()}
 window.__rect=rect;
 return {header:document.querySelector('.pinboard-header').getBoundingClientRect().toJSON(),handle:rect('mapToolbarToggleRow'),progress:rect('routeProgressBar'),banner:rect('missionStartBanner'),map:rect('mapArea'),heading:document.getElementById('compassDisc').style.transform};})()`);

 await new Promise(r=>setTimeout(r,2200));
 const profile=await win.webContents.executeJavaScript(`(function(){
   if(!vpHdgElevData || vpHdgElevData.length!==81)throw Error('HDG terrain missing: '+JSON.stringify(vpHdgElevData));
   if(vpMode!=='HDG')throw Error('Auto HDG missing');
   if(vpGetProfileTas()!==132)throw Error('TAS differs from App seed');
   if(!document.body.classList.contains('theme-retro'))throw Error('App theme not applied');
   if(!document.getElementById('btnVpSettings').textContent.includes('⚙'))throw Error('Original gear stripped');
   if(window.__errors.length)throw Error(window.__errors.join('\\n'));
   if(getComputedStyle(document.getElementById('btnToggleVpMode')).display==='none')throw Error('HDG hidden');
   if(getComputedStyle(document.getElementById('btnVpSettings')).display==='none')throw Error('Settings hidden');
   if(getComputedStyle(document.getElementById('vpZoomDisplay')).display!=='none')throw Error('Narrow controls differ');
   toggleVpSettingsMenu();
   var r=document.getElementById('vpSettingsMenu').getBoundingClientRect();
   if(r.left<0||r.right>innerWidth||r.top<0||r.bottom>innerHeight)throw Error('Settings outside viewport');
   toggleVpSettingsMenu();
   var cloud=vpShowClouds;vpToggleClouds();if(vpShowClouds===cloud)throw Error('Cloud toggle');vpToggleClouds();
   var initial=vpZoomLevel;vpZoom(-10);if(vpZoomLevel!==initial-10)throw Error('Zoom direction');vpZoom(10);
   document.getElementById('altMapInput').textContent='13500';vpChangeAlt(500);if(document.getElementById('altMapInput').textContent!=='13500')throw Error('ALT limit');
   document.getElementById('rateMapInput').textContent='200';vpChangeRate(-100);if(document.getElementById('rateMapInput').textContent!=='200')throw Error('VS limit');
   document.getElementById('altMapInput').textContent='4100';vpChangeRate(300);
   renderMapProfileFrames(performance.now());
   return {hdgPoints:vpHdgElevData.length,range:vpHdgElevData[80].distNM,weather:vpWeatherData,airspaces:activeAirspaces.length};
 })()`);
 assert.equal(profile.range,17);assert.ok(profile.airspaces>0);assert.ok(profile.weather && profile.weather.length, 'Weather missing');assert.ok(!errors.length,errors.join('\n'));
 fs.writeFileSync(path.join(output,'profile.json'),JSON.stringify(profile,null,2));
 fs.writeFileSync(path.join(output, 'expanded.png'),(await win.webContents.capturePage()).toPNG());
 await win.webContents.executeJavaScript('toggleMapToolbar()');await new Promise(r=>setTimeout(r,700));
 const collapsed=await win.webContents.executeJavaScript(`({header:document.querySelector('.pinboard-header').getBoundingClientRect().toJSON(),handle:__rect('mapToolbarToggleRow'),progress:__rect('routeProgressBar'),map:__rect('mapArea'),expanded:document.getElementById('mapToolbarToggle').getAttribute('aria-expanded')})`);
 assert.equal(collapsed.expanded,'false');assert.ok(collapsed.header.height<2,JSON.stringify(collapsed));
 assert.ok(Math.abs(collapsed.handle.top-collapsed.progress.bottom)<=2,JSON.stringify(collapsed));
 assert.ok(Math.abs(setup.handle.top-setup.progress.bottom)<=2,JSON.stringify(setup));
 assert.ok(setup.banner.width>500,JSON.stringify(setup));
 fs.writeFileSync(path.join(output, 'collapsed.png'),(await win.webContents.capturePage()).toPNG());
 await win.webContents.executeJavaScript('toggleMapToolbar()');win.setSize(440,894);await new Promise(r=>setTimeout(r,500));
 const phone=await win.webContents.executeJavaScript(`({header:document.querySelector('.pinboard-header').getBoundingClientRect().toJSON(),handle:__rect('mapToolbarToggleRow'),progress:__rect('routeProgressBar'),banner:__rect('missionStartBanner'),map:__rect('mapArea')})`);
 fs.writeFileSync(path.join(output, 'phone.png'),(await win.webContents.capturePage()).toPNG());
 assert.ok(Math.abs(phone.handle.top-phone.progress.bottom)<=2,JSON.stringify(phone));
 assert.ok(phone.banner.left>=0&&phone.banner.right<=440,JSON.stringify(phone));
 await win.webContents.executeJavaScript(`(async function(){
   vpToggleMode();if(vpMode!=='ROUTE')throw Error('RTE return failed');
   var flight={lat:48.361,lon:7.83,altFt:750,headingDeg:1,gsKts:90,capturedAt:Date.now()};
   gaEfbProfile.update(null,flight,map);if(vpMode!=='ROUTE')throw Error('Explicit RTE overwritten');
   gaEfbProfile.disconnected();vpToggleMode();if(vpMode!=='ROUTE')throw Error('HDG without GPS');
   gaEfbProfile.update(null,flight,map);if(vpMode!=='ROUTE')throw Error('HDG before motion sample');
   flight.capturedAt+=1100;gaEfbProfile.update(null,flight,map);if(vpMode!=='HDG')throw Error('HDG did not resume after reconnect');
   var controller=gaProfileDataProvider.createAbortController();controller.abort();
   try{await gaProfileDataProvider.terrain([{lat:48,lon:7,distNM:0}],controller.signal);throw Error('Abort ignored');}
   catch(e){if(e.name!=='AbortError')throw e;}
   if(window.__errors.length)throw Error(window.__errors.join('\\n'));
 })()`);
 // Rotation and the native simulator status row must not overlap the toolbar.
 win.setSize(894,440);await new Promise(r=>setTimeout(r,300));
 win.setSize(440,894);await new Promise(r=>setTimeout(r,300));
 const restored=await win.webContents.executeJavaScript(`({handle:__rect('mapToolbarToggleRow'),progress:__rect('routeProgressBar')})`);
 assert.ok(Math.abs(restored.handle.top-restored.progress.bottom)<=2);
 await win.loadURL(address+'/embedded');await new Promise(r=>setTimeout(r,500));
 const embedded=await win.webContents.executeJavaScript(`(function(){const w=document.querySelector('iframe').contentWindow;return {embedded:w.document.body.classList.contains('ga-efb-embedded'),top:w.document.querySelector('.pinboard-header').getBoundingClientRect().top}})()`);
 assert.equal(embedded.embedded,true);assert.equal(embedded.top,28);
 console.log('PASS shared profile HDG/RTE, terrain, weather, airspaces, controls and EFB toolbar collapse/resize, native header inset, banner width, shared compass, stable marker and breadcrumb.');
 fs.writeFileSync(path.join(output,'measurements.json'),JSON.stringify({setup,collapsed,phone,restored,embedded},null,2));
 win.destroy();server.close();app.quit();
}).catch(e=>{console.error(e);app.exit(1);});
