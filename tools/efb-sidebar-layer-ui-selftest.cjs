const {app,BrowserWindow,session}=require('electron');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const efb=require('../ga-tracker-client/tracker-efb-web-client');
const root=path.resolve(__dirname,'..'),output='/tmp/ga-sidebar-layer-check';fs.mkdirSync(output,{recursive:true});
app.whenReady().then(async()=>{
 let raw=false, desktopVector=false;const requests=[];
 const airports=[{icaoCode:'EDTL',name:'Lahr',geometry:{coordinates:[7.83,48.36]},runways:[{designator:'03',dimension:{length:{value:3000,unit:0}},surface:{name:'Asphalt'}},{designator:'21'}],frequencies:[{name:'TWR',value:'125.180'}]}, {icaoCode:'EDTO',name:'Offenburg',geometry:{coordinates:[7.92,48.45]},frequencies:[{name:'INFO',value:'128.950'}]}];
 const server=http.createServer(async(req,res)=>{
  const pathname=new URL(req.url,'http://localhost').pathname;
  if(pathname==='/'){res.setHeader('Content-Type','text/html');res.end(efb.createTrackerEfbWebClientPage().replace('<head>','<head><script>window.__errors=[];addEventListener("error",e=>__errors.push(e.error&&e.error.stack||e.message));addEventListener("unhandledrejection",e=>__errors.push(String(e.reason)));</script>'));return;}
  const asset=efb.getTrackerEfbWebClientAsset(pathname);
  if(asset){res.setHeader('Content-Type',asset.contentType);let body=asset.body;
   if(raw&&/\/(checklists|airport-radio|airport-details|airport-aip|map-direct-to-core|map-layer-controls|map-tool-focus)\.js$/.test(pathname))body=fs.readFileSync(path.join(root,path.basename(pathname)));
   if(pathname.endsWith('/host.js'))body=body.toString().replace(/\}\)\(\);\s*$/,`pollingClosed=true;window.__test={map:function(){return map;},layers:function(){return layerControl;},radar:function(){return overlayLayers.radar;},openaip:function(){return overlayLayers.openaip;},aero:function(){return overlayLayers.aero;},handoff:function(){return openAipHandoffTiles;},mission:function(value){missionSnapshot=value;window.gaTrackerExecutionControl=value.control;},library:function(value){trackerChecklistLibrary={checklists:value};}};})();`);
   res.end(body);return;
  }
  let data={available:false,items:[],ok:true};
  if(pathname==='/api/v1/map-render/status'){
   data={message:{payload:{vfrVector:desktopVector}}};
  }else if(pathname==='/api/v1/profile-data'){
   let text='';for await(const bytes of req)text+=bytes;const input=JSON.parse(text);requests.push(input);
   if(input.kind==='resource'){
    if(input.url.includes('rainviewer'))data={radar:{past:[{path:'/v2/radar/123456'}]}};
    else if(input.url.startsWith('/api/v1/dwd-icon-eu?')){
     const query=new URL(input.url,'http://localhost').searchParams;
     const points=query.get('points').split(';');
     const validAt=Number(query.get('valid'))*1000||Math.floor(Date.now()/3600000)*3600000;
     data={source:'dwd-icon-eu',available:true,runAt:validAt-3600000,validAt,
       samples:points.map(()=>({temp2mC:query.has('valid')?7:3,wspd:5,wdir:40,cloudTotalPct:20,visibilityM:15000}))};
    }
    else if(input.url==='./airports.json')data={EDTL:{lat:48.36,lon:7.83,name:'Lahr'},EDTO:{lat:48.45,lon:7.92,name:'Offenburg'}};
    else if(input.url.includes('/api/airports'))data={items:airports};
    else data={items:[]};
   }else if(input.kind==='mapAviation')data={airspaces:[{
    _id:'test-ctr',type:4,name:'CTR LAHR',
    lowerLimit:{value:0,unit:1,referenceDatum:0},upperLimit:{value:3500,unit:1,referenceDatum:1},
    geometry:{type:'Polygon',coordinates:[[[7.67,48.24],[8.02,48.24],[8.02,48.48],[7.67,48.48],[7.67,48.24]]]}
   }],airports,navaids:[{_id:'test-navaid',identifier:'LHR',name:'Lahr VOR',frequency:{value:117.6,unit:2},geometry:{type:'Point',coordinates:[7.84,48.35]}}],
   reportingPoints:[{_id:'test-vrp',name:'BROWSER TEST VRP',geometry:{type:'Point',coordinates:[7.9,48.4]}}]};
   else if(input.kind==='airports')data=[{airports}];
   else if(input.kind==='airspaces')data=[];
   else if(input.kind==='terrain')data=input.points.map(p=>({...p,elevFt:500}));
  }
  res.setHeader('Content-Type','application/json');res.end(JSON.stringify(data));
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const address='http://127.0.0.1:'+server.address().port;
 session.defaultSession.webRequest.onBeforeRequest((d,cb)=>cb({cancel:!d.url.startsWith(address)&&!d.url.startsWith('data:')}));
 const win=new BrowserWindow({width:440,height:894,show:false,webPreferences:{contextIsolation:true,nodeIntegration:false}}),results=[];
 win.webContents.on('console-message',(_event,level,message)=>{if(level===3)console.log('RENDER',message);});
 for(raw of [false,true]){
  await session.defaultSession.clearStorageData();await win.loadURL(address);await new Promise(r=>setTimeout(r,400));
  const start=await win.webContents.executeJavaScript(`(function(){
   if(!window.__test)throw Error('Host missing '+JSON.stringify(__errors));
   map=__test.map();routeWaypoints=[{lat:48.36,lon:7.83,name:'EDTL'},{lat:48.45,lon:7.92,name:'EDTO'}];currentStartICAO='EDTL';currentDestICAO='EDTO';
   lastLiveGpsPos={lat:48.36,lon:7.83,t:Date.now(),gs:0};
   gaChecklistOpen('home');
   const body=document.getElementById('checklistDrawerBody'),titles=Array.from(body.querySelectorAll('.checklist-tool-name')).map(x=>x.textContent);
   if(titles.length!==8)throw Error('Missing home tiles '+titles);
   document.querySelector('[data-action="open-list"]').click();document.querySelector('[data-action="open-checklist"]').click();
   return {titles};
  })()`);
  await new Promise(r=>setTimeout(r,100));
  const checklist=await win.webContents.executeJavaScript(`(function(){
    const body=document.getElementById('checklistDrawerBody');
    const row=body.querySelector('[data-action="toggle-item"]');if(!row)throw Error('No original checklist row '+body.textContent.slice(0,200));row.click();
    const state=localStorage.getItem('ga_checklist_progress_v1');if(!state||!state.includes('true'))throw Error('Checklist progress not persisted');
    gaChecklistOpen('home');return {state,html:body.innerHTML};
  })()`);
  await new Promise(r=>setTimeout(r,600));
  fs.writeFileSync(path.join(output,raw?'home-original.png':'home-compiled.png'),(await win.webContents.capturePage()).toPNG());
  await win.webContents.executeJavaScript(`gaCheckDwdWeather().then(() => {
    document.querySelector('[data-tool="weather"]').click();
    document.querySelector('#mapSideDrawerFav').click();
    gaEfbRefreshDrawerLayout();
  })`);
  await win.webContents.executeJavaScript(`new Promise((resolve,reject) => {
    const body=document.getElementById('checklistDrawerBody');
    const finish=() => {
      if(!body.textContent.includes('3 °C'))return false;
      observer.disconnect();clearTimeout(timeout);resolve();return true;
    };
    const observer=new MutationObserver(finish);
    const timeout=setTimeout(() => {observer.disconnect();reject(Error(body.textContent));},3000);
    observer.observe(body,{subtree:true,childList:true});
    finish();
  })`);
  const weatherTabs=await win.webContents.executeJavaScript(`(() => {
    const menu=document.getElementById('mapSideDrawerHandle');
    const favorite=document.querySelector('[data-fav-tool="weather"]');
    const menuRect=menu.getBoundingClientRect(), favoriteRect=favorite.getBoundingClientRect();
    const mapRect=document.getElementById('map').getBoundingClientRect();
    const card=document.querySelector('.route-weather-card');
    return {sameContainer:menu.parentNode===favorite.parentNode, gap:favoriteRect.top-menuRect.bottom,
      weatherBackground:getComputedStyle(card).backgroundColor,
      inMap:menuRect.top>=mapRect.top&&favoriteRect.bottom<=mapRect.bottom, inlineTop:menu.style.top};
  })()`);
  assert.ok(weatherTabs.sameContainer && weatherTabs.inMap && Math.abs(weatherTabs.gap-6)<1,JSON.stringify(weatherTabs));
  assert.equal(weatherTabs.inlineTop,'');
  assert.equal(weatherTabs.weatherBackground,'rgb(225, 226, 227)');
  await win.webContents.executeJavaScript(`document.querySelector('#checklistDrawerBody [data-aw-step="1"]').click()`);
  await win.webContents.executeJavaScript(`new Promise((resolve,reject) => {
    const body=document.getElementById('checklistDrawerBody');
    const observer=new MutationObserver(() => {
      if(body.textContent.includes('7 °C')){observer.disconnect();clearTimeout(timeout);resolve();}
    });
    const timeout=setTimeout(() => {observer.disconnect();reject(Error(body.textContent));},3000);
    observer.observe(body,{subtree:true,childList:true});
  })`);
  await win.webContents.executeJavaScript(`gaChecklistOpen('radio')`);await new Promise(r=>setTimeout(r,1500));
  const radio=await win.webContents.executeJavaScript(`document.getElementById('checklistDrawerBody').textContent`);
  assert.match(radio,/125.180/);assert.match(radio,/128.950/);
  await win.webContents.executeJavaScript(`gaChecklistOpen('nearest')`);await new Promise(r=>setTimeout(r,200));
  const nearest=await win.webContents.executeJavaScript(`document.getElementById('checklistDrawerBody').textContent`);assert.match(nearest,/Lahr/);
  await win.webContents.executeJavaScript(`(function(){
    window.__tools=[];window.gaCockpitSessionClient={submitTool:function(request){__tools.push(request);return Promise.resolve({ok:true,snapshot:{totalWeightLbs:2300,payloadWeightLbs:240,stations:[{index:1,weightLbs:180}]}});}};
    gaChecklistOpen('place');
  })()`);await new Promise(r=>setTimeout(r,1000));
  const place=await win.webContents.executeJavaScript(`document.getElementById('checklistDrawerBody').textContent`);
  assert.match(place,/03\/21/);assert.match(place,/3000m/);
  await win.webContents.executeJavaScript(`(function(){const b=document.querySelector('[data-action="airport-aip"]');if(!b)throw Error('AIP link missing');b.click();})()`);await new Promise(r=>setTimeout(r,30));
  assert.equal(await win.webContents.executeJavaScript(`__tools[0].intent`),'open_airport_aip');
  await win.webContents.executeJavaScript(`window.liveTrackerConnected=true;window.lastLiveFlightData={simRunning:1};__test.mission({available:true,manifest:{items:[{id:'box',label:'Kühlbox',status:'loaded',weightLbs:20}]},control:null});gaChecklistOpen('cargo')`);await new Promise(r=>setTimeout(r,50));
  await win.webContents.executeJavaScript(`(function(){const b=document.querySelector('[data-action="cargo-refresh-payload"]');if(!b)throw Error('Payload button missing: '+document.getElementById('checklistDrawerBody').textContent);b.click();})()`);await new Promise(r=>setTimeout(r,50));
  assert.equal(await win.webContents.executeJavaScript(`aircraftPayloadStatus.snapshot.payloadWeightLbs`),240);
  const payloadText=await win.webContents.executeJavaScript(`document.getElementById('checklistDrawerBody').textContent`);assert.match(payloadText,/S1:180lbs/);
  // Invoke the actual sidebar Direct To click; response is rejected so the old route is retained.
  await win.webContents.executeJavaScript(`window.alert=function(){};window.gaCockpitSessionClient.submitTool=function(request){__tools.push(request);return Promise.resolve({ok:false,error:'navigation_revision_conflict'});};gaChecklistOpen('nearest')`);
  await new Promise(r=>setTimeout(r,50));
  await win.webContents.executeJavaScript(`(function(){const b=document.querySelector('[data-action="nearest-menu"]');if(!b)throw Error('Nearest list missing: '+document.getElementById('checklistDrawerBody').textContent);b.click();const d=document.querySelector('[data-action="nearest-direct"]');if(!d)throw Error('Direct To button missing');d.click();})()`);await new Promise(r=>setTimeout(r,50));
  const direct=await win.webContents.executeJavaScript(`__tools[__tools.length-1]`);assert.equal(direct.intent,'airport_direct_to');assert.equal(direct.payload.forceGpsStart,true);assert.equal(direct.payload.airport.icao,'EDTL');
  const acceptedRoute=require('../ga-tracker-client/tracker-efb-map-snapshot-core').projectTrackerNavigationSnapshot({id:'private-route',revision:1,updatedAt:Date.now(),departureIcao:'GPS',destinationIcao:'EDTO',points:[{lat:48.36,lon:7.83,name:'Live GPS Position'},{lat:48.45,lon:7.92,name:'Offenburg'}]},null);
  await win.webContents.executeJavaScript(`window.gaCockpitSessionClient.submitTool=function(){return Promise.resolve({ok:true,map:${JSON.stringify(acceptedRoute)}})};document.querySelector('[data-action="nearest-direct"]').click()`);
  await new Promise(r=>setTimeout(r,250));
  assert.equal(await win.webContents.executeJavaScript(`currentDestICAO`),'EDTO');
  await win.webContents.executeJavaScript(`(function(){
   __test.library([{id:'custom-med',title:'Ärztliche Übergabe',sections:[{id:'chapter',title:'Prüfung',items:[{id:'check',text:'Kühlbox vollständig?'}]}]}]);
   gaChecklistOpen('checklists');const button=Array.from(document.querySelectorAll('[data-action="open-checklist"]')).find(x=>x.dataset.id==='custom-med');if(!button)throw Error('Tracker checklist missing');button.click();
   if(!document.getElementById('checklistDrawerBody').textContent.includes('Kühlbox vollständig?'))throw Error('Tracker checklist content lost');
   const control={executionAuthority:'tracker',missionId:'m',runId:'r',allowedActions:['set_manifest_item','set_boardbook_time'],flightEvents:{flightId:'f'}};
   __test.mission({missionId:'m',control,manifest:{items:[{id:'box',label:'Kühlbox',status:'loaded',weightLbs:20},{id:'bordbuch',label:'Bordbuch',status:'unloaded'}]},ui:{schema:'ga.mission-apt-ui.v1',cargo:{presentation:'app-cargo-dialog-v1',items:[{id:'box',action:{intent:'set_manifest_item',action:'unload',itemId:'box'}}]}}});
   gaChecklistOpen('cargo');document.querySelector('[data-action="cargo-toggle-detail"][data-item-id="box"]').click();
   const unload=document.querySelector('[data-action="cargo-unload"]');if(!unload)throw Error('Allowed unload absent');
   window.__cargoCalls=[];gaChecklistHost.cargoAction=function(action,id){__cargoCalls.push([action,id]);return new Promise(resolve=>window.__cargoAck=resolve);};unload.click();
   if(!unload.disabled||missionCargoGetManifestSnapshot().items[0].status!=='loaded'||__cargoCalls.length!==1)throw Error('Cargo acknowledgement gate');__cargoAck(true);
   if(!missionComplianceBoardBookWriteAllowed('start')||missionComplianceBoardBookWriteAllowed('landing'))throw Error('Boardbook field gate');
  })()`);
  await new Promise(r=>setTimeout(r,50));
  const focus=await win.webContents.executeJavaScript(`gaFocusAirportOnMap({lat:48.45,lon:7.92,icao:'EDTO',name:'Offenburg'});({color:routeToolFocusLayer.options.fillColor,radius:routeToolFocusLayer.options.radius})`);assert.deepEqual(focus,{color:'#ff334f',radius:13});
  await win.webContents.executeJavaScript("gaChecklistCloseDrawer();document.querySelector('.leaflet-control-layers-toggle').click()");await new Promise(r=>setTimeout(r,80));
  const layers=await win.webContents.executeJavaScript(`(function(){

    const lc=document.querySelector('.leaflet-control-layers');
    const labels=Array.from(lc.querySelectorAll('label')).map(x=>x.textContent.trim());
    const button=Array.from(lc.querySelectorAll('.ga-map-weather-tiles button')).find(x=>x.textContent.trim()==='Radar');
    if(!button)throw Error('Radar tile missing');
    button.click();
    if(!__test.map().hasLayer(__test.radar())||localStorage.ga_radar_active!=='true'||button.getAttribute('aria-pressed')!=='true')throw Error('Radar selection failed');
    return {labels,rect:lc.getBoundingClientRect().toJSON(),errors:__errors};
  })()`);assert.deepEqual(layers.errors,[]);assert.ok(layers.rect.left>=0&&layers.rect.right<=440,JSON.stringify(layers));
  await new Promise(r=>setTimeout(r,600));
  fs.writeFileSync(path.join(output,raw?'layers-original.png':'layers-compiled.png'),(await win.webContents.capturePage()).toPNG());
  for(const size of [[894,440],[440,894]]){win.setSize(...size);await new Promise(r=>setTimeout(r,150));const rect=await win.webContents.executeJavaScript(`document.querySelector('.leaflet-control-layers').getBoundingClientRect().toJSON()`);assert.ok(rect.bottom<=size[1]&&rect.left>=0,JSON.stringify(rect));}
  await win.webContents.executeJavaScript(`document.body.click();if(document.querySelector('.leaflet-control-layers-expanded'))throw Error('Layer outside close');`);
  results.push({start,checklist,radio,nearest,labels:layers.labels});
 }
 assert.deepEqual(results[0],results[1]);assert.ok(requests.some(x=>x.url&&x.url.includes('rainviewer')));
 assert.ok(results.every(result=>!result.labels.some(label=>label.includes('VFR Vektor'))));
 // Simulate the missing paint-order capability with the exact shared fallback.
 await win.webContents.executeJavaScript(fs.readFileSync(path.join(root,'e6b/e6b-svg-compat.js'),'utf8'));
 const svg=await win.webContents.executeJavaScript(`(function(){const saved=CSS.supports;CSS.supports=()=>false;
  const result=gaE6BPrepareSvg('<svg xmlns="http://www.w3.org/2000/svg"><style>.trace-number{fill:#101418;stroke:rgba(229,233,236,.68);stroke-width:3px;paint-order:stroke}</style><text id="label" class="trace-number">Ö 120</text></svg>');CSS.supports=saved;
  const div=document.createElement('div');div.innerHTML=result;document.body.appendChild(div);const nodes=div.querySelectorAll('text');return {count:nodes.length,fill:getComputedStyle(nodes[1]).fill,stroke:getComputedStyle(nodes[1]).stroke,halo:getComputedStyle(nodes[0]).fill,idCount:div.querySelectorAll('#label').length};})()`);
 assert.deepEqual(svg,{count:2,fill:'rgb(16, 20, 24)',stroke:'none',halo:'none',idCount:1});
 desktopVector=true;
 raw=false;
 await win.loadURL(address);
 await new Promise(r=>setTimeout(r,400));
 const vectorLabel=await win.webContents.executeJavaScript(`Array.from(document.querySelectorAll('.leaflet-control-layers label')).map(x=>x.textContent.trim()).find(x=>x.includes('VFR Vektor'))`);
 assert.match(vectorLabel,/VFR Vektor.*Desktop-App/);
 await win.webContents.executeJavaScript(`(() => {
   __test.map().setView([48.36,7.83],10);
   document.querySelector('.leaflet-control-layers-toggle').click();
 })()`);
 await win.webContents.executeJavaScript(`new Promise(resolve => setTimeout(resolve, 0))`);
 await win.webContents.executeJavaScript(`(() => {
   const label=Array.from(document.querySelectorAll('.leaflet-control-layers label')).find(x=>x.textContent.includes('OpenAIP-Lufträume'));
   label.querySelector('input').click();
   if(!__test.map().hasLayer(__test.openaip()))throw Error('OpenAIP layer was not enabled');
 })()`);
 await win.webContents.executeJavaScript(`new Promise((resolve,reject) => {
   const pane=__test.map().getPane('gaOpenAipPane');
   const finish=() => {
     if(!pane.querySelector('path[stroke]'))return;
     observer.disconnect();clearTimeout(timeout);resolve();
   };
   const observer=new MutationObserver(finish);
   const timeout=setTimeout(() => {observer.disconnect();reject(Error('OpenAIP path missing: '+JSON.stringify({
     status:document.querySelector('.ga-openaip-style .ga-base-dim-hint').textContent,
     visibility:document.visibilityState, board:document.getElementById('mapTableOverlay').className,
     active:__test.map().hasLayer(__test.openaip()), count:__test.openaip().getLayers().length,
     zoom:__test.map().getZoom(), pane:pane.outerHTML.slice(0,300), errors:__errors
   })));},4000);
   observer.observe(pane,{subtree:true,childList:true});
   finish();
 })`);
 const viewportFetches=requests.filter(request=>request.kind==='mapAviation').length;
 const airspaceStyle=await win.webContents.executeJavaScript(`(() => {
   const pane=__test.map().getPane('gaOpenAipPane');
   const panel=document.querySelector('.ga-openaip-style');
   const open=panel.querySelector('.ga-vfr-style-toggle');
   open.click();
   const card=panel.querySelector('.ga-vfr-style-panel');
   const first=pane.querySelector('path[stroke]').getAttribute('stroke');
   const band=!!pane.querySelector('path[clip-path]');
   const swatch=panel.querySelector('.ga-openaip-color-step[aria-label="CTR"]');
   swatch.click();
   const next=pane.querySelector('path[stroke]').getAttribute('stroke');
   panel.querySelector('input[aria-label="CTR anzeigen"]').click();
   const hidden=!pane.querySelector('path[stroke="'+next+'"]');
   return {open:!card.hidden,first,next,hidden,band,airport:!!pane.querySelector('.ga-airport-symbol'),
     navaid:!!pane.querySelector('path[stroke="#67e8f9"]'),persisted:gaOpenAipOverlayStyle.settings().airspaces.ctr.color};
 })()`);
 assert.ok(airspaceStyle.open&&airspaceStyle.hidden&&airspaceStyle.band&&airspaceStyle.airport&&airspaceStyle.navaid,JSON.stringify(airspaceStyle));
 assert.equal(airspaceStyle.first,'#3b82f6');
 assert.notEqual(airspaceStyle.next,airspaceStyle.first);
 assert.equal(airspaceStyle.next,airspaceStyle.persisted);
 assert.equal(viewportFetches,1);
 assert.equal(requests.filter(request=>request.kind==='mapAviation').length,viewportFetches);
 await win.webContents.executeJavaScript(`new Promise((resolve,reject) => {
   const pane=__test.map().getPane('gaOpenAipPane');
   const finish=() => {
     if(!pane.querySelector('.ga-vrp-symbol'))return;
     observer.disconnect();clearTimeout(timeout);resolve();
   };
   const observer=new MutationObserver(finish);
   const timeout=setTimeout(() => {observer.disconnect();reject(Error('OpenAIP reporting point missing'));},4000);
   observer.observe(pane,{subtree:true,childList:true});
   finish();
 })`);
 const handoff=await win.webContents.executeJavaScript(`(() => {
   const map=__test.map(), pane=map.getPane('gaOpenAipPane');
   const option=document.querySelector('[aria-label="Beim Reinzoomen auf VFR-Overlay umschalten"]');
   const chooseZoom=z=>map.setView([48.36,7.83],z,{animate:false});
   const vectorActive=()=>__test.openaip().getLayers().length===1;
   chooseZoom(12);
   const manualOnly=map.hasLayer(__test.aero())&&!map.hasLayer(__test.handoff())&&!vectorActive();
   map.removeLayer(__test.aero());
   const substitute=map.hasLayer(__test.handoff())&&!map.hasLayer(__test.aero())&&map.hasLayer(__test.openaip());
   const preferences=JSON.parse(localStorage.getItem('ga_efb_tracker_kartentisch_v1'));
   const storedWithoutAero=preferences.overlays.includes('openaip')&&!preferences.overlays.includes('aero');
   option.click();
   const disabled=vectorActive()&&!map.hasLayer(__test.handoff());
   option.click();
   const enabled=!vectorActive()&&map.hasLayer(__test.handoff());
   document.querySelector('[aria-label="Ab Zoomstufe"] button:last-child').click();
   const raisedAt12=vectorActive()&&!map.hasLayer(__test.handoff());
   chooseZoom(13);
   const raisedAt13=!vectorActive()&&map.hasLayer(__test.handoff());
   chooseZoom(15);
   const restored=vectorActive()&&!map.hasLayer(__test.handoff())&&!map.hasLayer(__test.aero());
   return {manualOnly,substitute,storedWithoutAero,disabled,enabled,raisedAt12,raisedAt13,restored};
 })()`);
 assert.ok(Object.values(handoff).every(Boolean),JSON.stringify(handoff));
 console.log('PASS original/compiled sidebar, light weather cards, forecast and favorite stack, checklist input, radio/nearest transport, Direct To, payload, runway/AIP, map focus, radar, desktop vector availability, OpenAIP rendering, symbols, restyling and VFR handoff, layer resize/close, E6B dark-label fallback.');
 win.destroy();server.close();app.quit();
}).catch(e=>{console.error(e);app.exit(1);});
