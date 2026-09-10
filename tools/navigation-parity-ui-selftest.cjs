const {app,BrowserWindow,session}=require('electron');
const fs=require('node:fs'),http=require('node:http'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),efb=require('../ga-tracker-client/tracker-efb-web-client'),{createCockpitTools}=require('../ga-tracker-client/tracker-cockpit-tools');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
app.whenReady().then(async()=>{
 const tools=createCockpitTools({getRun:()=>null,getFlight:()=>null,isSimulatorConnected:()=>false});
 await tools.execute({intent:'navigation_adopt',expectedRevision:0,payload:{routeId:'',departureIcao:'EDTL',destinationIcao:'EDTO',points:[{lat:48.36,lng:7.83,name:'EDTL'},{lat:48.45,lng:7.92,name:'EDTO'}]}});
 let remoteApp=null;
 const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://localhost'),pn=url.pathname;
  res.setHeader('Content-Type','application/json');
  if(pn==='/test-tool') {let raw='';for await(const b of req)raw+=b;await pause(80);const input=JSON.parse(raw);const result=await tools.execute(input);if(result.ok&&result.navigation&&input.intent!=='navigation_get'&&remoteApp)remoteApp.webContents.executeJavaScript('_handleTrackerAck('+JSON.stringify({type:'navigation_route_changed',navigation:result.navigation})+');true;').catch(console.error);res.end(JSON.stringify(result));return;}
  if(pn==='/api/v1/map'){res.end(JSON.stringify({message:{payload:{available:true,...tools.snapshot()}}}));return;}
  if(pn==='/api/v1/profile-data'){let raw='';for await(const b of req)raw+=b;const q=JSON.parse(raw);res.end(JSON.stringify(q.kind==='terrain'?q.points.map(p=>({...p,elevFt:500})):q.kind==='resource'?{}:q.kind==='navpoints'?[{lat:48.415,lng:7.875,name:'RPP Süd',type:'RPP',rppAirportIcao:'EDTL'}]:[]));return;}
  if(pn.startsWith('/api/')){res.end(JSON.stringify({available:false,ok:true}));return;}
  if(pn==='/efb' || pn==='/toolbar') {res.setHeader('Content-Type','text/html');res.end(efb.createTrackerEfbWebClientPage().replace('<head>','<head><script>window.__errors=[];addEventListener("error",e=>__errors.push(String(e.error||e.message)));addEventListener("unhandledrejection",e=>__errors.push(String(e.reason)));</script>'));return;}
  const asset=efb.getTrackerEfbWebClientAsset(pn);
  if(asset){res.setHeader('Content-Type',asset.contentType);let body=asset.body;
   if(pn.endsWith('/host.js'))body=body.toString().replace(/\}\)\(\);\s*$/,`window.__navTest={map:()=>map,layer:()=>routeLayer,refresh:value=>renderMapPayload(value),client:navigationClient};})();`);
   res.end(body);return;}
  const file=path.resolve(root,'.'+(pn==='/'?'/index.html':pn));
  if(!file.startsWith(root+'/')){res.statusCode=404;res.end();return;}
  try{let body=fs.readFileSync(file);res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json'})[path.extname(file)]||'application/octet-stream');res.end(body);}catch(_){res.statusCode=404;res.end();}
 });await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
 session.defaultSession.webRequest.onBeforeRequest((d,cb)=>cb({cancel:!d.url.startsWith(url)&&!d.url.startsWith('data:')&&!d.url.startsWith('blob:')}));
 const windows=[];const open=async suffix=>{const w=new BrowserWindow({show:false,width:600,height:850,webPreferences:{contextIsolation:true,nodeIntegration:false,backgroundThrottling:false}});windows.push(w);w.webContents.on('console-message',(_e,level,message)=>{if(level>=2)console.log('RENDER',suffix,message);});console.log('OPEN',suffix);await w.loadURL(url+suffix);await pause(1100);return w;};
 const a=await open('/efb'),b=await open('/toolbar'),web=await open('/');
 for(const w of [a,b])await w.webContents.executeJavaScript(`window.gaCockpitSessionClient={...window.gaCockpitSessionClient,submitTool:request=>new Promise((resolve,reject)=>{const x=new XMLHttpRequest();x.open('POST','/test-tool');x.onload=()=>resolve(JSON.parse(x.responseText));x.onerror=reject;x.send(JSON.stringify(request));})};window.alert=m=>console.error('ALERT',m);true;`);
 console.log('SETUP APP');
 const setup=await web.webContents.executeJavaScript(`(async()=>{
  initMapBase();document.getElementById('mapTableOverlay').classList.add('active');currentMissionData=null;routeWaypoints=[];
  window.alert=m=>console.error('APP ALERT',m);window.liveTrackerConnected=true;window.liveTrackerCapabilities=['navigation.route.v1'];window.simModeActive=false;
  window.sendTrackerCommand=command=>{fetch('/test-tool',{method:'POST',body:JSON.stringify(command)}).then(r=>r.json()).then(result=>_handleTrackerAck({...result,type:'navigation_route_ack',commandId:command.commandId}));return command.commandId;};
  await gaNavigationRefresh();return routeWaypoints.length;
 })()`);assert.equal(setup,2);remoteApp=web;
 const click=`(()=>{let line=__navTest.layer().getLayers().find(x=>x instanceof L.Polyline&&x.options.weight===44);if(!line)throw Error('hitbox missing '+JSON.stringify({draw:mapDrawState.enabled,measure:measureMode,nav:__navTest.client.snapshot(),errors:window.__errors,body:document.body.innerText.slice(0,1800),layers:__navTest.layer().getLayers().map(x=>({type:x.constructor.name,weight:x.options.weight}))}));line.fire('click',{latlng:L.latLng(48.40,7.88)});return __navTest.client.pending();})()`;
 console.log('INSERT EFB');
 assert.equal(await a.webContents.executeJavaScript(click),true);await pause(350);assert.equal(tools.navigation().points.length,3);
 await b.webContents.executeJavaScript(`__navTest.refresh(${JSON.stringify({available:true,...tools.snapshot()})});true;`);
 assert.equal(await b.webContents.executeJavaScript(`__navTest.client.snapshot().points.length`),3);
 assert.equal(await web.webContents.executeJavaScript('routeWaypoints.length'),3,'App receives the pushed change without polling');
 console.log('DRAG APP');
 await web.webContents.executeJavaScript(`(()=>{const marker=routeMarkers[1];marker.fire('dragstart');marker.setLatLng([48.41,7.87]);marker.fire('dragend');return routeWaypoints[1].lat;})()`);await pause(350);assert.equal(tools.navigation().points[1].lat,48.41);
 await b.webContents.executeJavaScript(`__navTest.refresh(${JSON.stringify({available:true,...tools.snapshot()})});true;`);
 assert.equal(await b.webContents.executeJavaScript(`__navTest.client.snapshot().points[1].lat`),48.41);
 const blocked=await web.webContents.executeJavaScript(`(()=>{window.liveTrackerConnected=false;const m=routeMarkers[1];m.fire('dragstart');m.setLatLng([48.8,8.1]);m.fire('dragend');const lat=routeMarkers[1].getLatLng().lat;window.liveTrackerConnected=true;return lat;})()`);assert.equal(blocked,48.41,'offline drag restores the confirmed marker');
 console.log('SNAPPING EFB AND APP');
 await a.webContents.executeJavaScript(`__navTest.refresh(${JSON.stringify({available:true,...tools.snapshot()})});__navTest.map().setView([48.415,7.875],14);true;`);await pause(1000);
 const dragNear=`(()=>{const m=__navTest.map(),marker=__navTest.layer().getLayers().find(x=>x instanceof L.Marker&&x.options.draggable),pixel=m.latLngToLayerPoint([48.415,7.875]);const pos=m.layerPointToLatLng(pixel.add([10,0]));marker.fire('dragstart');marker.setLatLng(pos);marker.fire('drag',{latlng:pos});const lines=__navTest.layer().getLayers().filter(x=>x instanceof L.Polyline);if(!lines.every(x=>x.getLatLngs()[1].equals(marker.getLatLng())))throw Error('route hitbox did not follow drag');marker.fire('dragend');return marker.getLatLng().lat;})()`;
 assert.equal(await a.webContents.executeJavaScript(dragNear),48.415);await pause(350);
 assert.equal(tools.navigation().points[1].name,'RPP Süd');assert.equal(tools.navigation().points[1].rppAirportIcao,'EDTL');
 assert.equal(await web.webContents.executeJavaScript('routeWaypoints[1].name'),'RPP Süd');
 await a.webContents.executeJavaScript('toggleSnapMode();true;');await a.webContents.executeJavaScript(dragNear);await pause(350);
 assert.notEqual(tools.navigation().points[1].lng,7.875,'disabled snapping permits a free drag');
 await web.webContents.executeJavaScript(`(()=>{cachedNavData=[{lat:48.415,lng:7.875,name:'RPP Süd',rppAirportIcao:'EDTL'}];snapMode=true;map.setView([48.415,7.875],14);const marker=routeMarkers[1],pos=map.layerPointToLatLng(map.latLngToLayerPoint([48.415,7.875]).add([10,0]));marker.fire('dragstart');marker.setLatLng(pos);marker.fire('drag',{latlng:pos});marker.fire('dragend');return true;})()`);await pause(350);
 assert.equal(tools.navigation().points[1].name,'RPP Süd');assert.equal(tools.navigation().points[1].lng,7.875);
 await b.webContents.executeJavaScript(`__navTest.refresh(${JSON.stringify({available:true,...tools.snapshot()})});true;`);
 const protectedView=JSON.parse(JSON.stringify({available:true,...tools.snapshot()}));protectedView.route.waypoints[1].isPoiChainEndpoint=true;
 await b.webContents.executeJavaScript(`__navTest.refresh(${JSON.stringify(protectedView)});true;`);
 assert.equal(await b.webContents.executeJavaScript('__navTest.layer().getLayers().filter(x=>x instanceof L.Marker&&x.options.draggable).length'),0,'same-position protection update rebuilds marker interaction');
 await b.webContents.executeJavaScript(`__navTest.refresh(${JSON.stringify({available:true,...tools.snapshot()})});true;`);
 await b.webContents.executeJavaScript('removeRouteWaypoint(1)');await pause(350);assert.equal(tools.navigation().points.length,2);
 assert.equal(await web.webContents.executeJavaScript('routeWaypoints.length'),2,'Toolbar removal is pushed to App');
 const direct=await web.webContents.executeJavaScript(`applyAirportDirectTo({icao:'EDTW',name:'Winzeln',lat:48.28,lon:8.43},{forceGpsStart:false})`);assert.equal(direct,true);assert.equal(tools.navigation().context.destinationIcao,'EDTW');
 await pause(1300);assert.equal(await b.webContents.executeJavaScript('__navTest.client.snapshot().context.destinationIcao'),'EDTW');
 for(const w of [a,b])assert.deepEqual(await w.webContents.executeJavaScript('__errors'),[]);
 fs.mkdirSync('/tmp/ga-navigation-check',{recursive:true});fs.writeFileSync('/tmp/ga-navigation-check/efb.png',(await a.webContents.capturePage()).toPNG());
 console.log('PASS EFB insert -> Toolbar/App, App drag -> Tracker/Toolbar, Toolbar delete -> App, App Direct To -> Toolbar; pushed changes, original 44px hitbox, EFB/App snapping with RPP metadata, free drag when disabled and pending feedback.');
 windows.forEach(w=>w.destroy());server.close();app.quit();
}).catch(e=>{console.error(e);app.exit(1);});
