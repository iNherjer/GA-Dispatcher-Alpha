const {app,BrowserWindow,session}=require('electron');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const efb=require('../ga-tracker-client/tracker-efb-web-client');
const root=path.resolve(__dirname,'..'),output='/tmp/ga-sidebar-layer-check';fs.mkdirSync(output,{recursive:true});
app.whenReady().then(async()=>{
 let raw=false;const requests=[];
 const airports=[{icaoCode:'EDTL',name:'Lahr',geometry:{coordinates:[7.83,48.36]},runways:[{designator:'03',dimension:{length:{value:3000,unit:0}},surface:{name:'Asphalt'}},{designator:'21'}],frequencies:[{name:'TWR',value:'125.180'}]}, {icaoCode:'EDTO',name:'Offenburg',geometry:{coordinates:[7.92,48.45]},frequencies:[{name:'INFO',value:'128.950'}]}];
 const server=http.createServer(async(req,res)=>{
  const pathname=new URL(req.url,'http://localhost').pathname;
  if(pathname==='/'){res.setHeader('Content-Type','text/html');res.end(efb.createTrackerEfbWebClientPage().replace('<head>','<head><script>window.__errors=[];addEventListener("error",e=>__errors.push(e.error&&e.error.stack||e.message));addEventListener("unhandledrejection",e=>__errors.push(String(e.reason)));</script>'));return;}
  const asset=efb.getTrackerEfbWebClientAsset(pathname);
  if(asset){res.setHeader('Content-Type',asset.contentType);let body=asset.body;
   if(raw&&/\/(checklists|airport-radio|airport-details|airport-aip|map-direct-to-core|map-layer-controls|map-tool-focus)\.js$/.test(pathname))body=fs.readFileSync(path.join(root,path.basename(pathname)));
   if(pathname.endsWith('/host.js'))body=body.toString().replace(/\}\)\(\);\s*$/,`pollingClosed=true;window.__test={map:function(){return map;},layers:function(){return layerControl;},radar:function(){return overlayLayers.radar;},mission:function(value){missionSnapshot=value;window.gaTrackerExecutionControl=value.control;},library:function(value){trackerChecklistLibrary={checklists:value};}};})();`);
   res.end(body);return;
  }
  let data={available:false,items:[],ok:true};
  if(pathname==='/api/v1/profile-data'){
   let text='';for await(const bytes of req)text+=bytes;const input=JSON.parse(text);requests.push(input);
   if(input.kind==='resource'){
    if(input.url.includes('rainviewer'))data={radar:{past:[{path:'/v2/radar/123456'}]}};
    else if(input.url==='./airports.json')data={EDTL:{lat:48.36,lon:7.83,name:'Lahr'},EDTO:{lat:48.45,lon:7.92,name:'Offenburg'}};
    else if(input.url.includes('/api/airports'))data={items:airports};
    else data={items:[]};
   }else if(input.kind==='airports')data=[{airports}];
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
    const label=Array.from(lc.querySelectorAll('label')).find(x=>x.textContent.includes('Niederschlag'));if(!label)throw Error('Radar missing');label.querySelector('input').click();
    if(!__test.map().hasLayer(__test.radar())||localStorage.ga_radar_active!=='true')throw Error('Radar selection failed '+JSON.stringify({on:__test.map().hasLayer(__test.radar()),saved:localStorage.ga_radar_active,checked:label.querySelector('input').checked,html:label.outerHTML,disabled:label.querySelector('input').disabled,connected:label.isConnected,inputs:__test.layers()._layerControlInputs.map(x=>({checked:x.checked,id:x.layerId})),radarId:L.stamp(__test.radar()),handler:__test.layers()._onInputClick.toString()}));
    return {labels,color:getComputedStyle(label).color,rect:lc.getBoundingClientRect().toJSON(),errors:__errors};
  })()`);assert.deepEqual(layers.errors,[]);assert.equal(layers.color,'rgb(51, 51, 51)');assert.ok(layers.rect.left>=0&&layers.rect.right<=440,JSON.stringify(layers));
  await new Promise(r=>setTimeout(r,600));
  fs.writeFileSync(path.join(output,raw?'layers-original.png':'layers-compiled.png'),(await win.webContents.capturePage()).toPNG());
  for(const size of [[894,440],[440,894]]){win.setSize(...size);await new Promise(r=>setTimeout(r,150));const rect=await win.webContents.executeJavaScript(`document.querySelector('.leaflet-control-layers').getBoundingClientRect().toJSON()`);assert.ok(rect.bottom<=size[1]&&rect.left>=0,JSON.stringify(rect));}
  await win.webContents.executeJavaScript(`document.body.click();if(document.querySelector('.leaflet-control-layers-expanded'))throw Error('Layer outside close');`);
  results.push({start,checklist,radio,nearest,labels:layers.labels});
 }
 assert.deepEqual(results[0],results[1]);assert.ok(requests.some(x=>x.url&&x.url.includes('rainviewer')));
 // Simulate the missing paint-order capability with the exact shared fallback.
 await win.webContents.executeJavaScript(fs.readFileSync(path.join(root,'e6b/e6b-svg-compat.js'),'utf8'));
 const svg=await win.webContents.executeJavaScript(`(function(){const saved=CSS.supports;CSS.supports=()=>false;
  const result=gaE6BPrepareSvg('<svg xmlns="http://www.w3.org/2000/svg"><style>.trace-number{fill:#101418;stroke:rgba(229,233,236,.68);stroke-width:3px;paint-order:stroke}</style><text id="label" class="trace-number">Ö 120</text></svg>');CSS.supports=saved;
  const div=document.createElement('div');div.innerHTML=result;document.body.appendChild(div);const nodes=div.querySelectorAll('text');return {count:nodes.length,fill:getComputedStyle(nodes[1]).fill,stroke:getComputedStyle(nodes[1]).stroke,halo:getComputedStyle(nodes[0]).fill,idCount:div.querySelectorAll('#label').length};})()`);
 assert.deepEqual(svg,{count:2,fill:'rgb(16, 20, 24)',stroke:'none',halo:'none',idCount:1});
 console.log('PASS original/compiled sidebar, checklist input, radio/nearest transport, Direct To, payload, runway/AIP, map focus, radar selection, layer resize/close, E6B dark-label fallback.');
 win.destroy();server.close();app.quit();
}).catch(e=>{console.error(e);app.exit(1);});
