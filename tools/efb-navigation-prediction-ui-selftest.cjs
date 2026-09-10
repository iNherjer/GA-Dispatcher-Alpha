const { app, BrowserWindow, session } = require('electron');
const http = require('node:http'), fs = require('node:fs'), path = require('node:path'), assert=require('node:assert/strict');
// Run with the desktop Electron binary; all external requests are blocked.
const repo = path.resolve(__dirname, '..');
const output = '/tmp/ga-navigation-prediction-check';
fs.mkdirSync(output, { recursive: true });
app.setPath('userData', path.join(output, 'browser-'+process.pid));
const efb = require(path.join(repo, 'ga-tracker-client/tracker-efb-web-client.js'));
app.whenReady().then(async () => {
 let predictionCase=false, predictionDelay=0, predictionRequests=0;
 const server = http.createServer(async (req,res) => {
  const url = new URL(req.url,'http://localhost');
  if(url.pathname === '/embedded') { res.setHeader('Content-Type','text/html');res.end('<iframe src="/" style="position:fixed;inset:0;width:100%;height:100%;border:0"></iframe>');return; }
  if(url.pathname === '/') { res.setHeader('Content-Type','text/html');res.end(efb.createTrackerEfbWebClientPage().replace('<head>', '<head><script>window.AbortController=undefined;window.__errors=[];addEventListener("error",function(e){__errors.push(e.message)});addEventListener("unhandledrejection",function(e){__errors.push(String(e.reason))});</script>'));return; }
  if(url.pathname === '/api/v1/profile-data') {
    let raw='';for await(const chunk of req) raw+=chunk;const data=JSON.parse(raw);
    let value=[];
    if(data.kind==='terrain')value=data.points.map(p=>({...p,elevFt:500+Math.round((p.lat-48.36)*18000)}));
    if(data.kind==='terrain' && data.points[0] && data.points[0].min && predictionCase) {predictionRequests++;value=data.points.map((p,i)=>({...p,elevFt:i===3?null:p.alt-[100,700,1500,1500][i]}));if(predictionDelay)await new Promise(r=>setTimeout(r,predictionDelay));}
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
   if(process.env.GA_UI_USE_STANDALONE_PROFILE==='1' && ['/profile.js','/map-profile-controls.js','/navigation-warning-core.js','/map-navigation-geometry.js','/map-prediction.js'].some(name=>url.pathname.endsWith(name))) body=fs.readFileSync(path.join(repo,path.basename(url.pathname)));

   if(url.pathname.endsWith('/host.js')) body=body.toString().replace(/\}\)\(\);\s*$/, `pollingClosed=true;window.__test={setMap:renderMapPayload,snapshot:function(){return mapSnapshot;},map:function(){return map;},line:function(){return previewLine;},flight:renderFlight,trail:function(){return liveTrailPoints;},marker:function(){return planeMarker;}};})();`);
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

 const js=async code=>{try{return await win.webContents.executeJavaScript('Promise.resolve().then(()=>eval('+JSON.stringify(code)+')).catch(e=>{console.error(e.stack);throw e;})');}catch(e){console.error('AT',code.slice(0,200));throw e;}}, wait=ms=>new Promise(r=>setTimeout(r,ms));
 await js(`(function(){
   window.__clock=Date.now();Date.now=()=>__clock;
   window.__tick=(lat=48.36,lon=7.83,alt=4000,gs=120)=>{
     __clock+=1100;__test.flight({available:true,viewSessionId:'test',lat,lon,alt,hdg:40,capturedAt:__clock,flight:{gsKts:gs,aglFt:3000,onGround:false}});
   };
   window.__route={schema:'ga.map-snapshot.v1',version:1,available:true,missionId:'m',runId:'r',context:{theme:'retro',tasKts:120},routeEdit:{id:'r',revision:1,editable:true},route:{waypoints:[{id:'A',name:'A',lat:48.3,lon:7.83},{id:'B',name:'B',lat:48.5,lon:7.83},{id:'C',name:'C',lat:48.5,lon:8.1}]}};
   __test.setMap(__route);__tick();
 })()`);await wait(1800);
 await js(`__tick();void 0;`);await wait(300);
 const initial=await js(`(function(){
   const points=vpPredictionData;
   if(points.length!==4)throw Error('Prediction points missing');
   const labels=[...document.querySelectorAll('.prediction-tooltip')].map(n=>n.textContent);
   if(JSON.stringify(labels)!==JSON.stringify(['1m','2m','5m','10m']))throw Error('Time markers missing '+labels);
   const line=__test.line();if(!line||line.options.color!=='#ff3fd9'||line.getLatLngs()[1].lat!==48.5||line.getLatLngs()[1].lng!==7.83)throw Error('Magenta line does not target B');
   stepLiveNextLegPreview(1);const selected=__test.line().getLatLngs()[1];
   if(selected.lng!==8.1)throw Error('Magenta line ignores manual target C');
   if(__test.snapshot().navigation.selectedWaypointIndex!==2)throw Error('Compass/navigation did not select C');
   let force=0;const original=renderMapProfile;renderMapProfile=function(){force++;return original();};
   window.vpBgNeedsUpdate=false;
   for(let i=0;i<20;i++){__clock+=50;__test.flight({available:true,viewSessionId:'test',lat:48.36+i*.00001,lon:7.83,alt:4000,hdg:40,capturedAt:__clock,flight:{gsKts:120,aglFt:3000,onGround:false}});}
   renderMapProfile=original;
   if(force!==0||window.vpBgNeedsUpdate)throw Error('Telemetry dirties static profile '+force);
   return {horizons:points.map(p=>p.min),distances:points.map(p=>p.distNMAhead),profileForcedRedraws:force,labels};
 })()`);
 predictionCase=true;
 await js(`activeAirspaces=[{name:'CTR',type:4,icaoClass:3,lowerLimit:{value:0,unit:1,referenceDatum:1},upperLimit:{value:10000,unit:1,referenceDatum:1},geometry:{type:'Polygon',coordinates:[[[7,47],[10,47],[10,51],[7,51],[7,47]]]}}];__tick();void 0;`);await wait(200);
 await js(`(function(){
   const points=vpPredictionData;
   if(points.map(p=>p.threat).join(',')!=='red,amber,green,unknown')throw Error('Terrain classifications differ');
   if(!points[2].asColor||points[0].asColor)throw Error('Airspace/terrain color priority differs');
   const lines=[];__test.map().eachLayer(layer=>{if(layer.options.dashArray==='8, 6')lines.push(layer);});
   if(lines.length!==1||lines[0].options.color!=='#ff2222'||lines[0].options.weight!==2)throw Error('Prediction line color/style differs');
   const markers=[];__test.map().eachLayer(layer=>{if(layer instanceof L.CircleMarker && layer.getTooltip() && layer.getTooltip().options.className==='prediction-tooltip')markers.push(layer);});
   if(markers.length!==4||markers[0].options.fillColor!=='#ff2222'||markers[1].options.fillColor!=='#ffaa00'||markers[2].options.fillColor!==points[2].asColor)throw Error('Prediction marker colors differ');
   if(points[3].asColor!==null || markers[3].options.fillColor!==(_getAirspaceColorForPredPoint(points[3])||'#ffffff'))throw Error('Map/profile handling of unknown terrain differs from Standalone');
   __tick();
   if(lines[0].options.color!=='#ff2222'||markers[0].options.fillColor!=='#ff2222')throw Error('Terrain colors flash white before the next lookup');
 })()`);await wait(200);
 // Inspect the actual original profile canvas, in both route and HDG modes.
 for(const mode of ['HDG','ROUTE']){
  await js(`if(vpMode!==${JSON.stringify(mode)})vpToggleMode();__tick();void 0;`);await wait(1300);
  const labels=await js(`(function(){
    const canvas=document.getElementById('mapProfileCanvas'),ctx=canvas.getContext('2d'),labels=[],original=ctx.fillText;
    ctx.fillText=function(text,...args){if(/^[125]m$|^10m$/.test(text))labels.push(text);return original.call(this,text,...args);};
    window.vpBgNeedsUpdate=true;renderMapProfileFrames(performance.now()+2000);ctx.fillText=original;
    if(!labels.length)throw Error('No predictions drawn in ${mode} profile');return labels;
  })()`);
  console.log(mode+' profile labels: '+labels.join(','));
 }
 fs.writeFileSync(path.join(output,process.env.GA_UI_USE_STANDALONE_PROFILE==='1'?'original.png':'compiled.png'),(await win.webContents.capturePage()).toPNG());
 await js(`(function(){
   const original=vpFetchElevationFromTerrarium;
   vpZoomLevel=50;
   vpFetchElevationFromTerrarium=points=>new Promise(resolve=>{window.__releaseElevation=()=>resolve(points.map(p=>({...p,elevFt:500})));});
   window.__elevationTask=fetchHighResElevation();vpFetchElevationFromTerrarium=original;
   vpHighResData=[{lat:48,lon:8,elevFt:500},{lat:49,lon:9,elevFt:900}];vpAltWaypoints=[{distNM:1,altFt:4000}];
   __test.setMap({available:false});
   if(vpHighResData||vpAltWaypoints.length)throw Error('Old zoom/profile survived route clear');
   if(__test.snapshot()||__test.line())throw Error('Old route survived clear');
   if(document.getElementById('routeProgressBar').style.display!=='none')throw Error('Old progress survived clear');
   // Predictions describe current flight and must survive clearing only the route.
   if(document.querySelectorAll('.prediction-tooltip').length!==4)throw Error('Clearing route deleted flight prediction');
   gaEfbProfile.disconnected();
   if(vpPredictionData.length||document.querySelector('.prediction-tooltip'))throw Error('Prediction survives disconnect');
   __test.flight({available:false,viewSessionId:'test'});
   if(__test.marker())throw Error('Aircraft survives disconnect');
 })()`);
 await js(`__releaseElevation();__elevationTask.then(()=>{if(vpHighResData)throw Error('Late high-resolution response resurrected route');vpZoomLevel=100;});`);
 predictionDelay=250;
 const requestsBefore=predictionRequests;
 await js(`__tick();__tick();void 0;`);await wait(60);
 assert.ok(predictionRequests>requestsBefore,'Delayed prediction request must actually be in flight');
 await js(`__test.flight({available:false,viewSessionId:'test'});void 0;`);await wait(300);
 await js(`if(vpPredictionData.length||document.querySelector('.prediction-tooltip'))throw Error('Late terrain response resurrected prediction');__tick(48.36,7.83,4000,20);__tick(48.36,7.83,4000,20);if(vpPredictionData.length||document.querySelector('.prediction-tooltip'))throw Error('Prediction at low speed');void 0;`);
 await js(`__test.setMap(__route);__tick();if(!__test.line())throw Error('Missing route target before disconnect');__test.flight({available:false,viewSessionId:'test'});if(__test.line()||document.getElementById('compassCdiSvg').style.display!=='none')throw Error('Navigation indicators survive disconnect');void 0;`);
 assert.deepEqual(await js('__errors'),[]);assert.deepEqual(errors,[]);
 console.log('PASS navigation/prediction parity '+JSON.stringify(initial));
 win.destroy();server.close();app.quit();
}).catch(e=>{console.error(e);app.exit(1);});
