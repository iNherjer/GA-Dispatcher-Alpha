const {chromium}=require('playwright');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),efb=require(path.join(root,'ga-tracker-client/tracker-efb-web-client'));
(async()=>{
 let raw=false;const requests=[];
 const airports=[{icaoCode:'EDTL',name:'Lahr',geometry:{coordinates:[7.83,48.36]},runways:[{designator:'03',dimension:{length:{value:3000,unit:0}},surface:{name:'Asphalt'}},{designator:'21'},{designator:'09L'},{designator:'27R'}],frequencies:[{name:'TWR',value:'125.180'},{name:'INFO',type:15,value:'126.130'}]}, {icaoCode:'EDTO',name:'Offenburg',geometry:{coordinates:[7.92,48.45]},frequencies:[{name:'INFO',value:'128.950'}]}];
 const radioAirspaces=[{id:'hx-altdorf',name:'CTR SEKTOR ALTDORF (HX)',type:0,icaoClass:3,frequencies:[{name:'LAHR TWR',value:'125.180 MHz'},{name:'ALTDORF RADIO',value:'127.155 MHz'}],geometry:{type:'Polygon',coordinates:[[[7.8,48.3],[7.9,48.3],[7.9,48.4],[7.8,48.4],[7.8,48.3]]]}},{id:'hx-offenburg',name:'CTR SEKTOR OFFENBURG (HX)',type:0,icaoClass:3,frequencies:[{name:'OFFENBURG SEGELFLUG',value:'123.355 MHz'},{name:'OFFENBURG RADIO',value:'132.040 MHz'}],geometry:{type:'Polygon',coordinates:[[[7.9,48.4],[8,48.4],[8,48.5],[7.9,48.5],[7.9,48.4]]]}}];
 radioAirspaces.unshift({id:'off-route',name:'CTR OFF ROUTE',type:4,icaoClass:3,frequencies:[{name:'WRONG',value:'129.000'}],geometry:{type:'Polygon',coordinates:[[[8.1,48.3],[8.2,48.3],[8.2,48.4],[8.1,48.4],[8.1,48.3]]]}});
 const radioNavaids=[{name:'SULZ TEST',identifier:'SUL',type:3,frequency:{value:'113.000'},geometry:{coordinates:[8.3,48.36]}}];
 const compiledAtisRefresh=fs.readFileSync(path.join(root,'ga-tracker-client/efb-web-assets/checklists.js'),'utf8').includes('function radioAirportNeedsFrequencyLoad');
 const compiledRadioRoute=fs.readFileSync(path.join(root,'ga-tracker-client/efb-web-assets/checklists.js'),'utf8').includes('function radioAirspaceRouteOrder');
 const servedRadioAirspaces=()=>radioAirspaces.filter(as=>as.id!=='off-route'||raw||compiledRadioRoute);
 const server=http.createServer(async(req,res)=>{
  const pathname=new URL(req.url,'http://localhost').pathname;
  if(pathname==='/'){res.setHeader('Content-Type','text/html');res.end(efb.createTrackerEfbWebClientPage().replace('<head>','<head><script>window.__errors=[];addEventListener("error",e=>__errors.push(e.error&&e.error.stack||e.message));addEventListener("unhandledrejection",e=>__errors.push(String(e.reason)));</script>'));return;}
  const asset=efb.getTrackerEfbWebClientAsset(pathname);
  if(asset){res.setHeader('Content-Type',asset.contentType);let body=asset.body;
   if(raw&&pathname.endsWith('/app-styles.css'))body=fs.readFileSync(path.join(root,'styles.css'));
   if(raw&&/\/(checklists|airport-radio|airport-details|airport-aip|map-direct-to-core|map-layer-controls|map-tool-focus)\.js$/.test(pathname))body=fs.readFileSync(path.join(root,path.basename(pathname)));
   if(pathname.endsWith('/host.js'))body=body.toString().replace(/\}\)\(\);\s*$/,`pollingClosed=true;window.__test={map:function(){return map;},layers:function(){return layerControl;},radar:function(){return overlayLayers.radar;},mission:function(value){missionSnapshot=value;window.gaTrackerExecutionControl=value.control;},library:function(value){trackerChecklistLibrary={checklists:value};},progress:function(value,index){mapSnapshot=value;previewWaypointIndex=index==null?null:index;renderProgress();},live:function(value){flight=value;refreshLocalNavigation();renderProgress();}};})();`);
   res.end(body);return;
  }
  let data={available:false,items:[],ok:true};
  if(pathname==='/api/v1/profile-data'){
   let text='';for await(const bytes of req)text+=bytes;const input=JSON.parse(text);requests.push(input);
   if(input.kind==='resource'){
    if(input.url.includes('rainviewer'))data={radar:{past:[{path:'/v2/radar/123456'}]}};
    else if(input.url==='./airports.json')data={EDTL:{lat:48.36,lon:7.83,name:'Lahr'},EDTO:{lat:48.45,lon:7.92,name:'Offenburg'}};
    else if(input.url.includes('/api/airports'))data={items:airports};
    else if(input.url.includes('/api/airspaces'))data={items:servedRadioAirspaces()};
    else data={items:[]};
   }else if(input.kind==='aviation')data={airspaces:servedRadioAirspaces(),airports:[],navaids:radioNavaids,reportingPoints:[]};
   else if(input.kind==='airports')data=[{airports}];
   else if(input.kind==='airspaces')data=[];
   else if(input.kind==='terrain')data=input.points.map(p=>({...p,elevFt:500}));
  }
  res.setHeader('Content-Type','application/json');res.end(JSON.stringify(data));
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const address='http://127.0.0.1:'+server.address().port;

 const browser=await chromium.launch({...(process.env.CHROME_PATH ? {executablePath:process.env.CHROME_PATH} : {}),headless:true});
 const context=await browser.newContext({viewport:{width:894,height:700}});
 const tilePng=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a1S8AAAAASUVORK5CYII=','base64');
 await context.route('**/*',r=>{
  if(r.request().url().startsWith(address))return r.continue();
  if(/tile\.opentopomap\.org|nwy-tiles-api\.prod\.newaydata\.com|server\.arcgisonline\.com/.test(r.request().url()))return r.fulfill({status:200,contentType:'image/png',body:tilePng});
  return r.abort();
 });
 await context.addInitScript(()=>{
  String.prototype.padStart = undefined; // Coherent does not provide this newer built-in.
  const originalSet=window.setTimeout, originalClear=window.clearTimeout;
  let time=0,id=10000000;const timers=new Map();
  window.setTimeout=(fn,ms,...args)=>{if(ms!==45000)return originalSet(fn,ms,...args);const key=++id;timers.set(key,{fn:()=>fn(...args),at:time+ms});return key;};
  window.clearTimeout=key=>{timers.delete(key);originalClear(key);};
  window.__advance=ms=>{time+=ms;for(const [key,t] of [...timers])if(t.at<=time){timers.delete(key);t.fn();}};
 });
 const page=await context.newPage();
 const checks=[];
 for(raw of (process.env.GA_RADIO_WEB_ONLY ? [true] : [false,true])){
  await page.goto(address);await page.waitForFunction(()=>window.__test);
  await page.evaluate(()=>{
    window.map=__test.map();routeWaypoints=[{lat:48.36,lon:7.83,name:'EDTL'},{lat:48.45,lon:7.92,name:'EDTO'}];currentStartICAO='EDTL';currentDestICAO='EDTO';
    lastLiveGpsPos={lat:48.36,lon:7.83,t:Date.now(),gs:0};gaChecklistOpen('nearest');
  });
  await page.waitForSelector('.route-tool-nearest-details');
  const nearest=await page.locator('.route-tool-nearest').first().innerText();assert.match(nearest,/03\/21/);assert.match(nearest,/125.180/);assert.match(nearest,/09L\/27R/);
  assert.equal(await page.locator('.route-tool-nearest-runway svg line').count(),2);
  assert.equal(await page.locator('.route-tool-nearest-runway svg text').count(),0);
  assert.match(await page.locator('.route-tool-nearest').nth(1).innerText(),/Pisten: keine Angaben/);
  const geometry=await page.locator('.route-tool-nearest-runway svg line').first().evaluate(el=>({x1:+el.getAttribute('x1'),x2:+el.getAttribute('x2'),y1:+el.getAttribute('y1'),y2:+el.getAttribute('y2')}));
  assert.ok(geometry.x2>geometry.x1&&geometry.y2<geometry.y1);
  await page.evaluate(()=>{activeAirspaces=[];freqCache.EDTL=[{label:'TWR',value:'125.180'},{label:'Information',value:'126.130'}];window.pickAirportForAirspaceFallback=()=>({icao:'EDTL'});gaChecklistOpen('radio');});
  await page.waitForSelector('.route-tool-radio-page .ga-radio-value[data-radio-value="132.040"]');
  assert.equal(await page.locator('.route-tool-radio-page [data-action="refresh-tool"]').count(),0);
  assert.match(await page.locator('.route-tool-radio-page').innerText(),/ALTDORF.*OFFENBURG/s);
  // Web-only previews intentionally retain the previous packed Tracker assets.
  if(raw||compiledRadioRoute)assert.doesNotMatch(await page.locator('.route-tool-radio-page').innerText(),/CTR OFF ROUTE|MHz/);
  assert.equal(await page.evaluate(()=>activeAirspaces.length),0);
  const radioValues=page.locator('.route-tool-radio-page .ga-radio-value');
  assert.equal(await radioValues.count(),raw||compiledAtisRefresh?9:7); // four HX, start/destination, ATIS additions after legacy cache refresh.
  if(raw||compiledAtisRefresh){
   assert.equal(await page.locator('.route-tool-radio-page .route-tool-row:has-text("CTR SEKTOR ALTDORF") .ga-radio-value[data-radio-value="126.130"]').count(),1);
   assert.doesNotMatch(await page.locator('.route-tool-radio-page .route-tool-section').first().innerText(),/Information/);
   assert.equal(await page.locator('[data-action="locate-radio-airspace"] svg circle').count(),2);
  }
  const magnifier=page.locator('[data-action="locate-radio-airspace"]').first();
  const hit=await magnifier.boundingBox();assert.ok(hit.width>=48&&hit.height>=48);
  assert.equal(await magnifier.locator('.route-tool-locate-icon').count(),1);
  if(raw||compiledAtisRefresh){
   const heading=await page.locator('.radio-airspace-heading').first().boundingBox();
   const frequency=await page.locator('.route-tool-radio-airspace .route-tool-freq').first().boundingBox();
   assert.ok(heading&&frequency&&frequency.y>=heading.y+heading.height);
   assert.ok(frequency.width>=heading.width-2);
   assert.ok(hit.x+hit.width>=heading.x+heading.width-2);
  }
  await magnifier.click();assert.match(await page.locator('#checklistDrawerStatus').innerText(),/markiert/);
  await page.evaluate(()=>{window.__hxCalls=[];gaRadioTune=async p=>{__hxCalls.push(p);return {ok:true,confirmed:true,target:GARadioTuningCore.normalize(p)};};for(let i=0;i<3&&document.body.dataset.navcomMode!=='direct';i++)gaCycleNavcomMode();});
  await page.locator('.route-tool-radio-page .ga-radio-value[data-radio-value="125.180"]').first().click();
  await page.waitForFunction(()=>__hxCalls.length===1);
  assert.equal(await page.evaluate(()=>__hxCalls[0].value),'125.180');
  await page.setViewportSize({width:440,height:894});
  await page.screenshot({path:'/tmp/ga-radio-hx-'+(raw?'source':'compiled')+'.png'});
  await page.setViewportSize({width:894,height:700});
  if(raw||compiledAtisRefresh){
   const hasNavigation=await page.locator('.radio-target-nav').count();
   assert.ok(hasNavigation>=2);
   if(hasNavigation){
    await page.evaluate(()=>{window.__navNode=document.querySelector('.radio-target-nav');window.lastLiveGpsPos={lat:48.36,lon:8.1,t:Date.now()};});
    await page.waitForFunction(()=>document.querySelector('.radio-target-nav .radio-target-distance').textContent!=='0.0 NM'&&document.querySelector('.radio-target-nav .radio-target-distance').textContent!=='– NM');
    assert.equal(await page.evaluate(()=>__navNode===document.querySelector('.radio-target-nav')),true);
    assert.match(await page.locator('.radio-target-nav').first().getAttribute('title'),/Norden oben/);
    await page.evaluate(()=>{window.lastLiveGpsPos=null;});
    await page.waitForFunction(()=>document.querySelector('.radio-target-nav .radio-target-distance').textContent==='– NM');
    assert.equal(await page.locator('.radio-target-nav svg').first().isVisible(),false);
    await page.evaluate(()=>{window.lastLiveGpsPos={lat:48.36,lon:7.83,t:Date.now()};});
   }
   // Keep Radio open while moving a long leg over the navaid, then away again.
   await page.evaluate(()=>{routeWaypoints=[{lat:48.36,lon:7.83,name:'EDTL'},{lat:48.36,lon:8.6,name:'NEW'}];});
   await page.waitForFunction(()=>document.querySelector('.route-tool-radio-page')?.textContent.includes('SULZ TEST'));
   assert.equal(await page.locator('.route-tool-radio-page [data-radio-value="113.000"]').count(),1);
   await page.evaluate(()=>{routeWaypoints=[{lat:48.36,lon:7.83,name:'EDTL'},{lat:48.45,lon:7.92,name:'EDTO'}];});
   await page.waitForFunction(()=>!document.querySelector('.route-tool-radio-page')?.textContent.includes('SULZ TEST')
    &&document.querySelector('.route-tool-radio-page')?.textContent.includes('CTR SEKTOR OFFENBURG'));
  }
  await page.evaluate(()=>gaChecklistOpen('nearest'));
  // Exercise the actual host telemetry renderer at the destination and away
  // from it, including unchanged polls and late responses after selection changes.
  await page.evaluate(()=>{
    freqCache.EDTL=[{label:'TWR',value:'125.180'}];runwayCache.EDTL='03/21 – 3000m';
    freqCache.EDTO=[{label:'INFO',value:'128.950'},{label:'TWR',value:'123.450'}];
    runwayCache.EDTO='09/27 – 800m\n18/36 – 600m';
    window.__nextSnapshot={route:{waypoints:routeWaypoints},navigation:{selectedWaypointIndex:1,activeLegIndex:0,distanceToNextNm:3,bearingToNextDeg:90}};
    __test.progress(__nextSnapshot);
  });
  assert.equal(await page.locator('#nextWpAirportDetails').isVisible(),true);
  assert.match(await page.locator('#nextWpAirportDetails').innerText(),/09\/27/);
  assert.match(await page.locator('#nextWpAirportDetails').innerText(),/128.950/);
  assert.equal(await page.locator('#nextWpAirportDetails .ga-radio-value[data-radio-kind="COM"]').count(),2);
  await page.evaluate(()=>{
    window.__navcomCalls=[];
    window.gaRadioTune=async payload=>{__navcomCalls.push(payload);return {ok:true,confirmed:true,target:GARadioTuningCore.normalize(payload)};};
    for(let i=0;i<3&&document.body.dataset.navcomMode!=='direct';i++)gaCycleNavcomMode();
  });
  await page.evaluate(()=>gaChecklistCloseDrawer());
  await page.waitForTimeout(550); // The open drawer intentionally overlays the telemetry widget.
  await page.locator('#nextWpAirportDetails .ga-radio-value').first().click();
  await page.waitForFunction(()=>__navcomCalls.length===1);
  assert.deepEqual(await page.evaluate(()=>__navcomCalls[0]),{kind:'COM',value:'128.950',index:1,slot:'active'});
  await page.evaluate(()=>gaChecklistOpen('nearest'));
  assert.equal(await page.locator('#nextWpAirportDetails svg line').count(),2);
  assert.equal(await page.locator('#nextWpAirportDetails svg text').count(),0);
  for(const size of [{width:440,height:894},{width:894,height:440}]){
    await page.setViewportSize(size);
    await page.waitForTimeout(100); // Root layout and floating positions update on resize/RAF.
    const box=await page.locator('#liveNextWpBox').boundingBox();
    assert.ok(box.x>=0 && box.x+box.width<=size.width+1,JSON.stringify({size,box}));
  }
  await page.setViewportSize({width:894,height:700});
  await page.evaluate(()=>gaChecklistCloseDrawer());
  if(process.env.NEXT_WPT_SCREENSHOT)await page.locator('#liveNextWpBox').screenshot({path:process.env.NEXT_WPT_SCREENSHOT.replace('.png',raw?'-source.png':'-compiled.png')});

  await page.evaluate(()=>{window.__nextNode=document.querySelector('#nextWpAirportDetails svg');for(let i=0;i<20;i++)__test.progress(__nextSnapshot);});
  assert.equal(await page.evaluate(()=>__nextNode===document.querySelector('#nextWpAirportDetails svg')),true);
  // Use the real arrow buttons with live position at the departure.
  await page.evaluate(()=>__test.live({lat:48.36,lon:7.83,capturedAt:Date.now(),gsKts:0}));
  await page.locator('#nextLegPrevBtn').click();
  assert.equal(await page.locator('#nextWpName').innerText(),'EDTL');
  assert.equal(await page.locator('#nextLegPrevBtn').isDisabled(),true);
  assert.match(await page.locator('#nextWpAirportDetails').innerText(),/03\/21/);
  await page.locator('#nextWpAirportDetails .ga-radio-value').first().click();
  assert.equal(await page.evaluate(()=>__navcomCalls.at(-1).value),'125.180');
  assert.equal(await page.evaluate(()=>__navcomCalls.at(-1).kind),'COM');
  await page.evaluate(()=>__test.live({lat:48.36,lon:7.83,capturedAt:Date.now()+2000,gsKts:0}));
  assert.equal(await page.locator('#nextWpName').innerText(),'EDTL');
  if(process.env.START_WPT_SCREENSHOT)await page.locator('#liveNextWpBox').screenshot({path:process.env.START_WPT_SCREENSHOT.replace('.png',raw?'-source.png':'-compiled.png')});
  await page.locator('#nextLegNextBtn').click();
  assert.equal(await page.locator('#nextWpName').innerText(),'EDTO');
  await page.evaluate(()=>{currentStartICAO='POI';__nextSnapshot.navigation.selectedWaypointIndex=0;__test.progress(__nextSnapshot,0);});
  assert.equal(await page.locator('#nextWpAirportDetails').isVisible(),false);
  assert.equal(await page.locator('#liveNextWpBox').evaluate(el=>el.classList.contains('has-airport-details')),false);
  await page.evaluate(()=>{
    currentDestICAO='POI';__nextSnapshot.navigation.selectedWaypointIndex=1;__test.progress(__nextSnapshot);
  });
  assert.equal(await page.locator('#nextWpAirportDetails').isVisible(),false);
  await page.evaluate(async()=>{
    currentDestICAO='EDTO';freqCache.EDTO=[];runwayCache.EDTO='';
    const original=fetchAirportFreq;window.__resolveNextFrequency=null;
    fetchAirportFreq=()=>new Promise(resolve=>{__resolveNextFrequency=()=>{freqCache.EDTO=[{label:'LATE',value:'130.000'}];resolve();};});
    __test.progress(__nextSnapshot);await Promise.resolve();
    __nextSnapshot.navigation.selectedWaypointIndex=0;__test.progress(__nextSnapshot,0);
    __resolveNextFrequency();await Promise.resolve();await Promise.resolve();
    fetchAirportFreq=original;
  });
  assert.equal(await page.locator('#nextWpAirportDetails').isVisible(),false);
  await page.evaluate(()=>{__nextSnapshot.navigation.selectedWaypointIndex=1;__test.progress(__nextSnapshot);});
  assert.match(await page.locator('#nextWpAirportDetails').innerText(),/130.000/);
  await page.evaluate(()=>{currentStartICAO='EDTL';gaChecklistOpen('place');});await page.waitForSelector('.route-tool-mini-map .leaflet-pane',{state:'attached'});await page.waitForTimeout(1000);
  await page.evaluate(()=>{window.__mapNode=document.querySelector('.route-tool-mini-map');window.__leafletId=__mapNode._leaflet_id;freqCache.EDTL=[{label:'TWR',value:'126.000'}];gaChecklistRefresh();});
  assert.equal(await page.evaluate(()=>__mapNode===document.querySelector('.route-tool-mini-map')&&__leafletId===__mapNode._leaflet_id),true);
  assert.match(await page.locator('[data-place-details]').first().innerText(),/126.000/);
  // The main map already disables Leaflet's plus-lighter compositor. Preview
  // and expanded place maps need the same rule, including the generated CSS.
  const previewTile=page.locator('.route-tool-mini-map img.leaflet-tile').first();
  await page.waitForFunction(()=>document.querySelector('.route-tool-mini-map img.leaflet-tile-loaded'));
  assert.equal(await previewTile.evaluate(el=>getComputedStyle(el).mixBlendMode),'normal');
  assert.equal(await previewTile.evaluate(el=>el.complete && el.naturalWidth>0),true);
  await page.evaluate(()=>{
    window.__previewTiles=Array.from(__mapNode.querySelectorAll('img.leaflet-tile'));
    for(let i=0;i<12;i++)gaChecklistRefresh();
  });
  assert.equal(await page.evaluate(()=>__previewTiles.every(el=>el.isConnected && __mapNode.contains(el))),true);

  assert.deepEqual(await page.locator('.route-tool-place-card').first().locator('.route-tool-place-block-title').allTextContents(),['Frequenzen','Pisten','Wetter']);
  for(const size of [{width:440,height:894},{width:894,height:440},{width:1024,height:768}]){
    await page.setViewportSize(size);await page.waitForTimeout(100);
    const rect=await page.locator('.map-side-drawer-close').boundingBox();assert.ok(rect.width>=88&&rect.height>=42);assert.ok(rect.x>=0&&rect.x+rect.width<=size.width);
    await page.locator('[data-action="place-map-expand"]').first().click();
    assert.equal(await page.locator('.route-tool-expanded-map img.leaflet-tile').first().evaluate(el=>getComputedStyle(el).mixBlendMode),'normal');
    await page.locator('.route-tool-map-close').click();
  }
  await page.screenshot({path:path.join(process.env.TMPDIR || '/tmp', 'efb-vr-place-')+(raw?'source':'compiled')+'.png'});
  for (const scale of [1,1.5,2,3]) {
    await page.setViewportSize({width:1024,height:768});
    await page.evaluate(value=>{GAEfbUiScale.apply(value,'physical',false);gaChecklistOpen('home');},scale);
    await page.waitForTimeout(100);
    const box=await page.locator('.map-side-drawer-close').boundingBox();
    assert.ok(box.x>=0 && box.x+box.width<=1025, JSON.stringify({scale,box}));
    await page.locator('#mapSideDrawerPin').click();await page.locator('.map-side-drawer-close').click();
  }
  await page.evaluate(()=>{GAEfbUiScale.apply(1,'physical',false);gaChecklistCloseDrawer();gaChecklistOpen('nearest');__advance(44999);});assert.equal(await page.locator('#mapSideDrawer').evaluate(el=>el.classList.contains('is-open')),true);
  await page.evaluate(()=>__advance(1));assert.equal(await page.locator('#mapSideDrawer').evaluate(el=>el.classList.contains('is-open')),false);
  await page.evaluate(()=>gaChecklistOpen('nearest'));await page.locator('#mapSideDrawerPin').click();
  await page.evaluate(()=>__advance(90000));assert.equal(await page.locator('#mapSideDrawer').evaluate(el=>el.classList.contains('is-open')),true);
  assert.equal(await page.locator('#mapSideDrawerPin').getAttribute('aria-pressed'),'true');
  await page.locator('#mapSideDrawerPin').click();await page.evaluate(()=>__advance(30000));
  await page.locator('#checklistDrawerBody').dispatchEvent('scroll');await page.evaluate(()=>__advance(30000));
  assert.equal(await page.locator('#mapSideDrawer').evaluate(el=>el.classList.contains('is-open')),true);
  await page.evaluate(()=>__advance(15000));assert.equal(await page.locator('#mapSideDrawer').evaluate(el=>el.classList.contains('is-open')),false);
  await page.evaluate(()=>gaChecklistOpen('nearest'));
  await page.evaluate(()=>{
    const input=document.createElement('input');input.id='idle-test-input';document.getElementById('checklistDrawerBody').appendChild(input);input.focus();__advance(45000);
  });
  assert.equal(await page.locator('#mapSideDrawer').evaluate(el=>el.classList.contains('is-open')),true);
  await page.evaluate(()=>{document.getElementById('idle-test-input').remove();__advance(45000);gaChecklistOpen('nearest');});
  assert.equal(await page.locator('#mapSideDrawerPin').getAttribute('aria-pressed'),'false');
  await page.screenshot({path:path.join(process.env.TMPDIR || '/tmp', 'efb-vr-nearest-')+(raw?'source':'compiled')+'.png'});
  assert.deepEqual(await page.evaluate(()=>__errors),[]);
  checks.push({raw,nearest,geometry,viewports:3});
 }
 console.log(JSON.stringify({pass:true,checks},null,2));await browser.close();server.close();
})().catch(e=>{console.error(e);process.exit(1)});
