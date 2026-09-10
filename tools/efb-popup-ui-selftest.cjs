// Real Leaflet popups: same original module sources vs their Coherent build.
const {app,BrowserWindow,session}=require('electron');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const efb=require('../ga-tracker-client/tracker-efb-web-client');
const root=path.resolve(__dirname,'..'),output='/tmp/ga-popup-check';fs.mkdirSync(output,{recursive:true});
app.whenReady().then(async()=>{
 let raw=false,delay=0;const requests=[];
 const airport={icaoCode:'EDTL',name:'Lahr – Süd',country:'DE',elevation:{value:512,unit:1},geometry:{type:'Point',coordinates:[7.83,48.36]},runways:[{designator:'03/21',dimension:{length:{value:3000,unit:0}},surface:{name:'Asphalt'}}],frequencies:[{name:'TWR',value:'125.180',unit:2}]};
 const spaces=[{_id:'ctr',name:'LAHR',type:4,icaoClass:3,lowerLimit:{value:0,unit:1,referenceDatum:0},upperLimit:{value:2500,unit:1,referenceDatum:1},frequencies:[{name:'TOWER',value:'125.180',unit:2}],geometry:{type:'Polygon',coordinates:[[[7.7,48.2],[8,48.2],[8,48.6],[7.7,48.6],[7.7,48.2]]]}}];
 const aviation={airports:[airport],airspaces:spaces,navaids:[{_id:'nav',identifier:'LHR',name:'Lahr Funkfeuer',type:4,geometry:{type:'Point',coordinates:[7.84,48.36]},frequency:{value:'115.0',unit:2}}],reportingPoints:[{_id:'vrp',name:'Süd',airportIcao:'EDTL',geometry:{type:'Point',coordinates:[7.85,48.36]}}]};
 const server=http.createServer(async(req,res)=>{
  const pathname=new URL(req.url,'http://localhost').pathname;
  if(pathname==='/'){res.setHeader('Content-Type','text/html');res.end(efb.createTrackerEfbWebClientPage().replace('<head>','<head><script>window.__errors=[];addEventListener("error",e=>__errors.push(e.error&&e.error.stack||e.message));addEventListener("unhandledrejection",e=>__errors.push(String(e.reason)));</script>'));return;}
  const asset=efb.getTrackerEfbWebClientAsset(pathname);
  if(asset){res.setHeader('Content-Type',asset.contentType);let body=asset.body;
   if(raw&&/\/(airport-weather|map-airport-popup|map-context-popup|map-drawing|map-single-click)\.js$/.test(pathname))body=fs.readFileSync(path.join(root,path.basename(pathname)));
   if(pathname.endsWith('/host.js'))body=body.toString().replace(/\}\)\(\);\s*$/,`pollingClosed=true;window.__test={map:()=>map,route:()=>routeLayer,renderRoute:renderRoute,renderFlight:renderFlight};})();`);
   res.end(body);return;
  }
  let data={available:false,items:[],ok:true};
  if(pathname==='/api/v1/profile-data'){
   let text='';for await(const bytes of req)text+=bytes;const input=JSON.parse(text);requests.push(input);
   if(input.kind==='aviation')data=aviation;
   else if(input.kind==='airports')data=[aviation];
   else if(input.kind==='airspaces')data=spaces;
   else if(input.kind==='navpoints')data=[{type:'NAVAID',name:'LHR',lat:48.36,lng:7.84,navaidData:aviation.navaids[0]},{type:'RPP',name:'RPP Süd',lat:48.36,lng:7.85,rppData:aviation.reportingPoints[0],rppAirportIcao:'EDTL'}];
   else if(input.kind==='terrain')data=input.points.map(p=>({...p,elevFt:512}));
   else if(input.kind==='resource'){
    if(input.url==='./airports.json')data={EDTL:{lat:48.36,lon:7.83,elevation:512,name:'Lahr – Süd',country:'DE'}};
    else if(input.url.includes('metar'))data=[{icaoId:'EDTL',lat:48.36,lon:7.83,rawOb:'EDTL 101200Z 03010KT 9999 FEW030 20/10 Q1015',temp:20,dewp:10,wdir:30,wspd:10,visib:10,fltCat:'VFR',cover:'FEW'}];
    else data={items:[]};
   }
   if(delay)await new Promise(r=>setTimeout(r,delay));
  }
  res.setHeader('Content-Type','application/json');res.end(JSON.stringify(data));
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const address='http://127.0.0.1:'+server.address().port;
 session.defaultSession.webRequest.onBeforeRequest((d,cb)=>cb({cancel:!d.url.startsWith(address)&&!d.url.startsWith('data:')}));
 const win=new BrowserWindow({width:440,height:894,show:false,webPreferences:{contextIsolation:true,nodeIntegration:false}}),results=[];
 win.webContents.on('console-message',(_event,level,message)=>{if(level===3)console.log('RENDER',message);});
 const js=async text=>{try{return await win.webContents.executeJavaScript('Promise.resolve().then(()=>eval('+JSON.stringify(text)+')).catch(e=>{console.error(e.stack);throw e;})')}catch(error){console.error('AT',text.slice(0,160));throw error}},wait=ms=>new Promise(r=>setTimeout(r,ms));
 for(raw of [false,true]){
  await session.defaultSession.clearStorageData();await win.loadURL(address);await wait(450);
  await js(`(async function(){
   if(!window.__test)throw Error('Host missing '+JSON.stringify(__errors));
   map=__test.map();map.setView([48.36,7.83],14,{animate:false});
   await loadGlobalAirports();
   window.fetchOpenMeteoWeatherPoints=async()=>[{wdir:30,wspd:10,cloudTotalPct:30,cloudLowPct:30,temp2mC:20,dewPoint2mC:10,pressureMslHpa:1015,visibilityM:10000}];
   window.lastLiveGpsPos={lat:48.36,lon:7.83,alt:1800,t:Date.now()};window.liveTrackerConnected=true;
   window.gaCockpitSessionClient={submitTool:async request=>{window.__externalCalls.push(request);if(window.__externalFail)throw Error('offline');return {ok:true};}};window.__externalCalls=[];
   gaOpenMapContextInfo(L.latLng(48.36,7.83),'test');
  })()`);await wait(1200);
  const result=await js(`(function(){
   const popup=document.querySelector('.ga-map-context-popup');if(!popup)throw Error('No popup '+JSON.stringify(__errors));
   const text=popup.textContent;if(!text.includes('Lahr – Süd')||!text.includes('125.180')||!text.includes('1015')||!text.includes('LAHR'))throw Error('Missing original content '+text);
   const airspace=popup.querySelector('[data-map-context-airspace-id]');if(!airspace)throw Error('Airspace action missing');airspace.click();
   if(!mapContextAirspaceHighlightLayer||mapContextInfoState.selectedAirspaceId!=='ctr')throw Error('No airspace map highlight');
   popup.querySelector('[data-map-context-feature-id]').click();if(!mapContextObjectHighlightLayer||mapContextAirspaceHighlightLayer)throw Error('Feature toggle failed');
   gaUpdateMapContextOwnAltitude(2100);if(mapContextInfoState.currentAltitudeFt!==2100)throw Error('Altitude update failed');
   return {text:popup.textContent,style:getComputedStyle(popup.querySelector('.ga-map-context-panel')).fontFamily,body:popup.querySelector('.ga-map-context-body').getBoundingClientRect().toJSON(),errors:__errors};
  })()`);assert.deepEqual(result.errors,[]);results.push({text:result.text,style:result.style});
  await js(`document.querySelector('[data-ga-airport-aip]').click()`);await wait(30);
  assert.deepEqual(await js('__externalCalls.map(x=>({intent:x.intent,payload:x.payload}))'),[{intent:'open_airport_aip',payload:{icao:'EDTL',country:'DE'}}]);
  await js(`__externalFail=true;document.querySelector('[data-ga-airport-aip]').click()`);await wait(30);assert.match(await js(`document.querySelector('[data-ga-airport-aip]').textContent`),/fehlgeschlagen/);
  await js(`__externalFail=false;document.querySelector('[data-ga-airport-aip]').click()`);await wait(30);
  // Narrow viewport scroll area, and rotation must remain usable without reopening.
  for(const size of [[894,440],[440,894]]){
   win.setSize(...size);await wait(150);
   await js(`mapContextInfoState.popupPositioned=false;renderMapContextInfoPopup(mapContextInfoState);`);await wait(100);
   const bounds=await js(`({popup:document.querySelector('.ga-map-context-popup').getBoundingClientRect().toJSON(),details:document.querySelector('.ga-map-context-details').getBoundingClientRect().toJSON(),scroll:getComputedStyle(document.querySelector('.ga-map-context-details')).overflowY})`);
   assert.ok(bounds.popup.width<=size[0]+1,JSON.stringify(bounds));assert.ok(bounds.details.height>40,JSON.stringify(bounds));assert.match(bounds.scroll,/auto|scroll/);
  }
  fs.writeFileSync(path.join(output,raw?'original.png':'compiled.png'),(await win.webContents.capturePage()).toPNG());
  await js(`map.closePopup();if(mapContextInfoState||mapContextObjectHighlightLayer)throw Error('Closed popup retained state');`);
  // Same original normalizers for navaid and reporting-point details.
  for(const [lon,expected] of [[7.84,'115.0'],[7.85,'Süd']]){
   await js(`map.setView([48.36,${lon}],16,{animate:false});gaOpenMapContextInfo(L.latLng(48.36,${lon}),'test');`);await wait(150);
   assert.ok((await js(`document.querySelector('.ga-map-context-popup').textContent`)).includes(expected));await js('map.closePopup();void 0');
  }
  // Closing during pending data must not resurrect a popup or consume a newer response.
  delay=200;await js(`gaOpenMapContextInfo(L.latLng(48.4,7.9),'test');map.closePopup();void 0;`);await wait(300);delay=0;
  assert.equal(await js('mapContextInfoState'),null);
  await js(`currentStartICAO='EDTL';currentDestICAO='EDTL';currentSName='Lahr';currentDName='Lahr';currentDepElev=currentDestElev=512;
    __test.renderRoute({route:{waypoints:[{lat:48.36,lon:7.83,name:'EDTL'},{lat:48.36,lon:7.83,name:'EDTL'},{lat:48.36,lon:7.83,name:'EDTL'}]},routeEdit:{editable:true}});
    window.__markers=__test.route().getLayers().filter(x=>x instanceof L.Marker);__markers[0].openPopup();void 0;`);await wait(150);
  assert.ok((await js(`map._popup.getContent()`)).includes('DEP: Lahr'));
  await js(`__markers[2].openPopup();void 0`);await wait(50);assert.ok((await js(`map._popup.getContent()`)).includes('DEST: Lahr'));
  await js(`__markers[1].openPopup();document.querySelector('[data-route-airport-info]').click()`);await wait(150);
  assert.ok((await js(`map._popup.getContent().textContent`)).includes('Lahr – Süd'));
  const callsBefore=await js('__externalCalls.length');
  await js(`map.closePopup();map.fire('contextmenu',{latlng:L.latLng(48.36,7.83)});document.querySelector('[data-ga-airport-aip]').click();void 0;`);await wait(30);
  assert.equal(await js('__externalCalls.length'),callsBefore+1,'popup link works during map ghost-click suppression');
  const seqBefore=await js('mapContextRequestSeq');
  await js(`document.querySelector('.ga-map-context-heading').dispatchEvent(new MouseEvent('mousedown',{bubbles:true,button:0,clientX:200,clientY:200}));`);await wait(700);
  assert.equal(await js('mapContextRequestSeq'),seqBefore,'long press inside popup must not start a new map request');
  await js('map.closePopup();void 0');
  await js(`window.__terrain=gaMapContextHost.terrain;gaMapContextHost.terrain=async()=>null;gaOpenMapContextInfo(L.latLng(48.55,7.99),'test');`);await wait(150);
  assert.ok((await js(`document.querySelector('.ga-map-context-popup').textContent`)).includes('Geländehöhe nicht verfügbar'));
  await js(`gaMapContextHost.terrain=__terrain;map.closePopup();void 0;`);
  // Shared drawing/ruler gestures and selection are exercised as raw App and
  // compiled EFB source, using real Leaflet layers rather than mocked outcomes.
  await js(`(function(){
    map.setView([48.36,7.83],15,{animate:false});
    clearMapDrawings({includeMeasure:true});
    activateMapDrawTool('line');
    const a=L.latLng(48.36,7.83),b=L.latLng(48.361,7.832),c=L.latLng(48.364,7.83),d=L.latLng(48.365,7.832);
    handleMapDrawMapClick({latlng:a});handleMapDrawMapClick({latlng:b});
    handleMapDrawMapClick({latlng:c});handleMapDrawMapClick({latlng:d});
    if(mapDrawState.drawings.length!==2)throw Error('Independent drawing lines missing');
    const first=mapDrawState.drawings[0],last=mapDrawState.drawings[1];
    if(!first._mapDrawLabel.getContent().includes('NM')||first._mapDrawEndpointMarkers.length!==2)throw Error('Original line label/endpoints missing');
    activateMapDrawTool('eraser');
    if(mapDrawState.drawings.length!==2)throw Error('Eraser still acts as Undo');
    handleMapDrawMapClick({latlng:a});
    if(mapDrawState.drawings.length!==1||mapDrawState.drawings[0]!==last)throw Error('Eraser removed wrong stroke');
    if(mapDrawState.layer.hasLayer(first))throw Error('Erased stroke still visible');
    activateMapDrawTool('measure');addMeasurePoint(a);addMeasurePoint(b);
    const text=measureTooltip.getContent();measureMarkers[1].setLatLng(d);measureMarkers[1].fire('drag');
    if(measureTooltip.getContent()===text)throw Error('Dragging ruler does not update distance/course');
    addMeasurePoint(c);if(measureMarkers.length!==1)throw Error('Ruler does not restart after two points');
    clearMapDrawings({includeMeasure:true});if(measureMode)toggleMeasureMode();
    if(mapDrawState.enabled)toggleMapDrawMode(false);
    if(airportElevation({elevationFt:null},'EDTL')!==512)throw Error('Airport elevation fallback failed');
    if(airportElevation({elevationFt:0},'EDTL')!==0)throw Error('Sea level treated as missing');
    if(airportElevation({elevationFt:null},'XXXX')!==null)throw Error('Unknown elevation invented');
    const point=GAMapShellCore.normalizeTrackerMapSnapshot({schema:'ga.map-snapshot.v1',version:1,available:true,route:{waypoints:[{lat:48,lon:8,elevationFt:null},{lat:49,lon:9}]}}).route.waypoints[0];
    if(point.elevationFt!==null)throw Error('Null elevation became zero');
  })()`);
  await js(`(async function(){
    await gaMapSingleClickHost.load(L.latLng(48.36,7.83));
    setMapSingleClickMode('tooltip');
    if(!resolveMapSingleClickAt(L.latLng(48.36,7.83)))throw Error('Airport tooltip failed');
    if(!document.querySelector('.ga-map-point-click-tooltip').textContent.includes('Lahr'))throw Error('Airport tooltip content missing');
    setMapSingleClickMode('panels');
    if(document.querySelector('.ga-map-point-click-tooltip'))throw Error('Mode change retained tooltip');
    if(!resolveMapSingleClickAt(L.latLng(48.36,7.84)))throw Error('Navaid panel failed');
  })()`);await wait(100);
  assert.ok((await js(`map._popup.getContent().textContent || map._popup.getContent()`)).includes('115.0'));
  // A mode change cancels automatic retries after delayed data loads.
  delay=200;await js(`map.closePopup();setMapSingleClickMode('panels');scheduleMapInfoTapResolution(L.latLng(48.36,7.85));setMapSingleClickMode('off');void 0;`);await wait(300);delay=0;
  assert.equal(await js('!!(map._popup && map.hasLayer(map._popup))'),false);
  await js(`gaOpenMapContextInfo(L.latLng(48.36,7.83),'test');`);await wait(150);
  await js(`gaUpdateMapContextOwnAltitude(2100);gaEfbProfile.disconnected();if(mapContextInfoState.currentAltitudeFt!==null)throw Error('Disconnect retained altitude');`);
  // Fixed METAR fallback link uses the same authenticated PC browser boundary.
  await js(`(function(){const link=document.createElement('a');link.href='https://metar-taf.com/de/EDTL';link.dataset.gaAirportWeather='EDTL';document.body.appendChild(link);link.click();link.remove();})()`);await wait(30);
  assert.equal((await js('__externalCalls[__externalCalls.length-1]')).intent,'open_airport_weather');
  await js(`map.closePopup();void 0;`);
  // Normal App host retains browser anchors and does not submit a PC command.
  assert.ok(await js(`(function(){const host=gaAirportPopupHost;window.gaAirportPopupHost=null;const html=_buildAptPopup('DEP','Lahr',512,'EDTL');window.gaAirportPopupHost=host;return html.includes('AIP VFR öffnen ↗')&&html.includes('target="_blank"');})()`));
  assert.deepEqual(await js('__errors'),[]);
 }
 assert.deepEqual(results[0],results[1]);assert.ok(requests.some(x=>x.kind==='aviation'));
 console.log('PASS original/compiled context and airport popups, airspace/object highlights, live altitude, weather, AIP PC browser, failures/retry, narrow/rotated layout, late response close, route endpoints and airport Info.');
 win.destroy();server.close();app.quit();
}).catch(e=>{console.error(e);app.exit(1);});
