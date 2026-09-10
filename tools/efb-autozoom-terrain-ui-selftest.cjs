// Real Leaflet/canvas integration, with identical scenarios for source and the
// Chrome-49 build. All network access stays inside this fixture server.
const {app,BrowserWindow,session}=require('electron');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {PNG}=require('../ga-tracker-client/node_modules/pngjs');
const efb=require('../ga-tracker-client/tracker-efb-web-client'),repo=path.resolve(__dirname,'..');
const png=new PNG({width:256,height:256});for(let i=0;i<png.data.length;i+=4)png.data.set([128,100,0,255],i);
const bytes=PNG.sync.write(png),output='/tmp/ga-autozoom-terrain-check';fs.mkdirSync(output,{recursive:true});
app.whenReady().then(async()=>{
 let raw=false;const requests=[];
 const server=http.createServer((req,res)=>{
  const pathname=new URL(req.url,'http://localhost').pathname;
  if(pathname==='/'){res.setHeader('Content-Type','text/html');res.end(efb.createTrackerEfbWebClientPage().replace('<head>','<head><script>window.__errors=[];addEventListener("error",e=>__errors.push(e.message));addEventListener("unhandledrejection",e=>__errors.push(String(e.reason)));</script>'));return;}
  if(pathname.startsWith('/api/v1/terrain-tiles/')){requests.push(pathname);res.setHeader('Content-Type','image/png');res.end(bytes);return;}
  const asset=efb.getTrackerEfbWebClientAsset(pathname);
  if(asset){res.setHeader('Content-Type',asset.contentType);let body=asset.body.toString();
   if(raw&&/\/(map-autozoom|map-terrain-avoid)\.js$/.test(pathname))body=fs.readFileSync(path.join(repo,path.basename(pathname)),'utf8');
   if(pathname.endsWith('/host.js'))body=body.replace(/\}\)\(\);\s*$/,`pollingClosed=true;window.__test={flight:renderFlight,map:function(){return map;},seed:function(){document.body.classList.add('profile-hidden');mapSnapshot={context:{tasKts:120,profileCruiseFt:4500},route:{waypoints:[{lat:48.36,lon:7.83},{lat:48.55,lon:8.15}],totalDistanceNm:17},navigation:{activeLegIndex:0}};renderProfile();}};})();`);
   res.end(body);return;}
  res.setHeader('Content-Type','application/json');res.end(JSON.stringify({available:false,items:[],ok:true}));
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const address='http://127.0.0.1:'+server.address().port;
 session.defaultSession.webRequest.onBeforeRequest((d,cb)=>cb({cancel:!d.url.startsWith(address)&&!d.url.startsWith('data:')}));
 const win=new BrowserWindow({width:900,height:900,show:false,webPreferences:{nodeIntegration:false,contextIsolation:true}}),results=[];
 for(raw of [false,true]){
  await session.defaultSession.clearStorageData();await win.loadURL(address);await new Promise(r=>setTimeout(r,250));requests.length=0;
  const result=await win.webContents.executeJavaScript(`(async function(){
   const check=(ok,msg)=>{if(!ok)throw Error(msg)},el=id=>document.getElementById(id),wait=ms=>new Promise(r=>setTimeout(r,ms));
   __test.seed();const m=__test.map();m.setView([48.36,7.83],13,{animate:false});
   check(!el('hintToggleAutoZoom').disabled&&!el('hintToggleTerrainAvoid').disabled,'Controls disabled');
   check(el('hintToggleWeather').disabled&&el('hintToggleTraffic').disabled,'Deferred controls enabled');
   check(terrainAvoidWarnFt===500&&terrainAvoidSafeFt===1000,'Default terrain margins');
   let sampleTime=Date.now();
   const tick=(lat,lon,alt,gs,agl,onGround)=>__test.flight({available:true,viewSessionId:'A',lat,lon,alt,hdg:40,capturedAt:++sampleTime,flight:{gsKts:gs,aglFt:agl,onGround}});
   toggleMapHint('autoZoom');tick(48.36,7.83,510,0,3,true);toggleAutoFollow(true);
   check(m.getZoom()>=14,'Ground focus');
   check(window.lastLiveFlightData.onGround===true&&window.lastLiveFlightData.aglFt===3,'Flight state bridge');
   const scenarios=[[48.36,7.83,510,0,3,true],[48.38,7.86,1600,85,1100,false],[48.44,7.99,4500,120,4000,false],[48.54,8.13,1200,85,700,false]];
   const samples=scenarios.map(v=>{window.lastLiveFlightData={aglFt:v[4],onGround:v[5]};return computeMapAutoZoomTargetZoom(v[0],v[1],v[3],v[2],40);});
   check(samples.every(v=>Number.isFinite(v.targetZoom)&&v.targetZoom>=8&&v.targetZoom<=18),'Invalid targets');
   check(new Set(samples.map(v=>v.targetZoom)).size>2,'No phase response');
   tick(48.44,7.99,4500,120,4000,false);toggleAutoFollow(true);clearMapAutoZoomSmoothTimer();m.stop();
   const expected=computeMapAutoZoomTargetZoom(48.44,7.99,120,4500,40).targetZoom;
   check(Math.abs(m.getZoom()-expected)<.02,'Host ignores original target');
   markMapAutoZoomUserZoomIntent();m.setZoom(14,{animate:false});
   tick(48.44,7.99,4500,120,4000,false);clearMapAutoZoomSmoothTimer();
   check(Math.abs(m.getZoom()-14)<.02,'Manual zoom overwritten');
   m.fire('dragstart');check(isAutoFollow===false&&el('autoFollowBtn').textContent==='📍','Drag follow off');
   const before=m.getCenter();tick(48.5,8.1,1200,85,700,false);
   check(m.distance(before,m.getCenter())<1,'Follow-off still moves');
   toggleAutoFollow(true);check(isAutoFollow&&el('autoFollowBtn').textContent==='🎯','Follow restore');
   toggleAutoFollow(false);setMapAutoZoomLookaheadMinutes(12);check(localStorage.ga_map_autozoom_lookahead_min==='12','Lookahead persistence');
   window.liveActiveWpIndex=0;check(_mapAutoZoomRouteTarget(48.4,7.9).idx===0,'Manual target missing');window.liveActiveWpIndex=null;
   m.setView([48.36,7.83],13,{animate:false});tick(48.36,7.83,1000,90,672,false);
   const tiles=await Promise.all([terrainAvoidLoadTileImageData(0,0,0),terrainAvoidLoadTileImageData(0,0,0)]);
   check(tiles[0]===tiles[1],'In-flight tile not reused');
   const pixels=[];
   for(const altitude of [100,328,600,1800]){
    const canvas=document.createElement('canvas');canvas.width=canvas.height=256;
    await new Promise(r=>terrainAvoidPaintTileCanvas(canvas,{z:0,x:0,y:0},altitude,r));
    const pixel=Array.from(canvas.getContext('2d').getImageData(20,20,1,1).data);pixels.push(pixel);
    const expected=getTerrainAvoidRgbaBytes(altitude-328);
    check(pixel.every((v,i)=>Math.abs(v-expected[i])<=1),'Terrain pixel mismatch '+pixel+' vs '+expected);
   }
   const parent=terrainAvoidResolveSourceTile({z:16,x:34568,y:22800});check(parent.srcZ===13&&parent.scale===8,'Overzoom parent');
   check(terrainAvoidResolveSourceTile({z:3,x:1,y:-1})===null,'Invalid polar tile');
   toggleMapHint('terrainAvoid');await wait(250);
   check(m.hasLayer(terrainAvoidOverlayLayer)&&document.querySelector('.leaflet-tile canvas,canvas.leaflet-tile'),'Terrain layer absent');
   check(getTerrainAvoidAircraftAltFt()===1000,'Not using live altitude');
   tick(48.36,7.83,510,0,3,true);check(!m.hasLayer(terrainAvoidOverlayLayer)&&terrainAvoidPausedReason==='landed','Landing pause');
   tick(48.36,7.83,1000,90,672,false);check(m.hasLayer(terrainAvoidOverlayLayer),'Airborne resume');
   toggleMapHintsMenu(true);toggleMapHintSubmenu('terrainAvoidMenu');await wait(100);
   setTerrainAvoidThreshold('warn',0);setTerrainAvoidThreshold('safe',0);loadTerrainAvoidSettings();check(terrainAvoidWarnFt===0&&terrainAvoidSafeFt===0,'Explicit zero lost');resetTerrainAvoidThresholds();
   __test.flight({available:false,viewSessionId:'A'});check(!window.lastLiveGpsPos&&!window.liveTrackerConnected,'Stale flight survived disconnect');
   check(getTerrainAvoidAircraftAltFt()===4500,'Planning fallback');
   tick(48.36,7.83,1000,90,672,false);await wait(150);
   return {samples,pixels,errors:__errors};
  })()`);
  assert.deepEqual(result.errors,[]);assert.equal(requests.filter(p=>p==='/api/v1/terrain-tiles/0/0/0.png').length,1);results.push(result);
  fs.writeFileSync(path.join(output,raw?'source.png':'compiled.png'),(await win.webContents.capturePage()).toPNG());
  await win.reload();await new Promise(r=>setTimeout(r,350));
  assert.deepEqual(await win.webContents.executeJavaScript('[getMapAutoZoomLookaheadMinutes(),terrainAvoidWarnFt,terrainAvoidSafeFt,!!mapHints.terrainAvoid]'),[12,500,1000,true]);
 }
 assert.deepEqual(results[0],results[1]);fs.writeFileSync(path.join(output,'results.json'),JSON.stringify(results,null,2));
 console.log('PASS original/compiled autozoom phases, manual zoom, follow, target, terrain pixels, cache, lifecycle and persistence.');
 win.destroy();server.close();app.quit();
}).catch(e=>{console.error(e);app.exit(1);});
