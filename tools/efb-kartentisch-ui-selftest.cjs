const { app, BrowserWindow, session } = require('electron');
const http = require('node:http'), fs = require('node:fs'), path = require('node:path'), assert=require('node:assert/strict');
// Run with the desktop Electron binary; all external requests are blocked.
const repo = path.resolve(__dirname, '..');
const output = process.env.GA_UI_CHECK_OUTPUT || '/tmp/ga-kartentisch-ui-check';
fs.mkdirSync(output, { recursive: true });
const efb = require(path.join(repo, 'ga-tracker-client/tracker-efb-web-client.js'));
app.whenReady().then(async () => {
 const server = http.createServer((req,res) => {
  const url = new URL(req.url,'http://localhost');
  if(url.pathname === '/embedded') { res.setHeader('Content-Type','text/html');res.end('<iframe src="/" style="position:fixed;inset:0;width:100%;height:100%;border:0"></iframe>');return; }
  if(url.pathname === '/') { res.setHeader('Content-Type','text/html');res.end(efb.createTrackerEfbWebClientPage());return; }
  const asset=efb.getTrackerEfbWebClientAsset(url.pathname);
  if(asset) {
   res.setHeader('Content-Type',asset.contentType);
   let body=asset.body;
   if(url.pathname.endsWith('/host.js')) body=body.toString().replace(/\}\)\(\);\s*$/, `pollingClosed=true;window.__test={setMap:function(value){mapSnapshot=value;renderProgress();},flight:renderFlight,trail:function(){return liveTrailPoints;},marker:function(){return planeMarker;}};})();`);
   res.end(body);return;
  }
  res.setHeader('Content-Type','application/json');res.end(JSON.stringify({available:false,items:[],ok:true}));
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const address='http://127.0.0.1:'+server.address().port;
 session.defaultSession.webRequest.onBeforeRequest((details,cb)=>cb({cancel:!details.url.startsWith(address)&&!details.url.startsWith('data:')}));
 const win = new BrowserWindow({width:600,height:790,show:false,webPreferences:{contextIsolation:true,nodeIntegration:false}});
 await win.loadURL(address);await new Promise(r=>setTimeout(r,500));
 const setup=await win.webContents.executeJavaScript(`(function(){
 if(!window.__test)throw Error('Host not ready');
 __test.setMap({context:{},route:{waypoints:[{lat:48.36,lon:7.83},{lat:48.45,lon:7.92}],totalDistanceNm:6},navigation:{activeLegIndex:0,distanceToNextNm:6,bearingToNextDeg:40,remainingDistanceNm:6,crossTrackNm:1}});
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
 fs.writeFileSync(path.join(output, 'expanded.png'),(await win.webContents.capturePage()).toPNG());
 await win.webContents.executeJavaScript('toggleMapToolbar()');await new Promise(r=>setTimeout(r,700));
 const collapsed=await win.webContents.executeJavaScript(`({header:document.querySelector('.pinboard-header').getBoundingClientRect().toJSON(),handle:__rect('mapToolbarToggleRow'),progress:__rect('routeProgressBar'),map:__rect('mapArea'),expanded:document.getElementById('mapToolbarToggle').getAttribute('aria-expanded')})`);
 assert.equal(collapsed.expanded,'false');assert.ok(collapsed.header.height<2,JSON.stringify(collapsed));
 assert.ok(Math.abs(collapsed.handle.top-collapsed.progress.bottom)<2,JSON.stringify(collapsed));
 assert.ok(Math.abs(setup.handle.top-setup.progress.bottom)<2,JSON.stringify(setup));
 assert.ok(setup.banner.width>500,JSON.stringify(setup));
 fs.writeFileSync(path.join(output, 'collapsed.png'),(await win.webContents.capturePage()).toPNG());
 await win.webContents.executeJavaScript('toggleMapToolbar()');win.setSize(440,894);await new Promise(r=>setTimeout(r,500));
 const phone=await win.webContents.executeJavaScript(`({header:document.querySelector('.pinboard-header').getBoundingClientRect().toJSON(),handle:__rect('mapToolbarToggleRow'),progress:__rect('routeProgressBar'),banner:__rect('missionStartBanner'),map:__rect('mapArea')})`);
 fs.writeFileSync(path.join(output, 'phone.png'),(await win.webContents.capturePage()).toPNG());
 assert.ok(Math.abs(phone.handle.top-phone.progress.bottom)<2,JSON.stringify(phone));
 assert.ok(phone.banner.left>=0&&phone.banner.right<=440,JSON.stringify(phone));
 // Rotation and the native simulator status row must not overlap the toolbar.
 win.setSize(894,440);await new Promise(r=>setTimeout(r,300));
 win.setSize(440,894);await new Promise(r=>setTimeout(r,300));
 const restored=await win.webContents.executeJavaScript(`({handle:__rect('mapToolbarToggleRow'),progress:__rect('routeProgressBar')})`);
 assert.ok(Math.abs(restored.handle.top-restored.progress.bottom)<2);
 await win.loadURL(address+'/embedded');await new Promise(r=>setTimeout(r,500));
 const embedded=await win.webContents.executeJavaScript(`(function(){const w=document.querySelector('iframe').contentWindow;return {embedded:w.document.body.classList.contains('ga-efb-embedded'),top:w.document.querySelector('.pinboard-header').getBoundingClientRect().top}})()`);
 assert.equal(embedded.embedded,true);assert.equal(embedded.top,28);
 console.log('PASS EFB toolbar collapse/resize, native header inset, banner width, shared compass, stable marker and breadcrumb.');
 fs.writeFileSync(path.join(output,'measurements.json'),JSON.stringify({setup,collapsed,phone,restored,embedded},null,2));
 win.destroy();server.close();app.quit();
}).catch(e=>{console.error(e);app.exit(1);});
