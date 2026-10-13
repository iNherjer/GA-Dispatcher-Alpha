const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.GA_PLAYWRIGHT_MODULE||'/Users/jofaist/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'..');
test('real browser: generated paragraphs/source links restore, no HTML injection and no stale return target',async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.GA_BROWSER_CHANNEL?{channel:process.env.GA_BROWSER_CHANNEL}:{})});try{const page=await browser.newPage({viewport:{width:440,height:894}}),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 const briefing=html.match(/<section id="airportFlightBriefing"[\s\S]*?<\/section>/)[0],dest=html.match(/<span id="wikiDestDescText"[^>]*>[\s\S]*?<\/span>/)[0];
 await page.setContent(briefing+dest+html.match(/<span id="wikiDepDescText"[^>]*>[\s\S]*?<\/span>/)[0]+'<small id="airportDestinationInfoSources"></small><small id="airportDepartureInfoSources"></small>');
 for(const f of ['mission-airport-information-core.js','mission-airport-information-browser.js'])await page.addScriptTag({content:fs.readFileSync(path.join(root,f),'utf8')});
 await page.evaluate(()=>{const c=MissionAirportInformationCore.context({icao:'U60',name:'Big Creek Airport',lat:45.1332,lon:-115.322,elevation:5743},{wiki:{id:'wikipedia',kind:'wikipedia',title:'Big Creek Airport (Idaho)',url:'https://en.wikipedia.org/wiki/Big_Creek_Airport_(Idaho)'}});const info={flightBriefing:'Eine Grasbahn mit hohen Bergen in der Umgebung.\n\nAktuelle Platzhinweise berücksichtigen.',destinationInfo:'<img src=x onerror="window.injected=true">\n\nDeine Abholung findet am Platz statt.',sourceIds:['wikipedia'],generated:true};window.fixture={missionType:'bush',targetLat:45.1332,targetLon:-115.322,airportInfoContext:c,airportInformation:info};MissionAirportInformationBrowser.render(fixture);});
 assert.equal(await page.locator('#airportFlightBriefing').isVisible(),true);assert.equal(await page.locator('#wikiDestDescText img').count(),0);assert.equal(await page.locator('#airportDestinationInfoSources a').count(),1);assert.equal(await page.evaluate(()=>window.injected),undefined);
 await page.evaluate(()=>{const saved=JSON.parse(JSON.stringify(fixture));MissionAirportInformationBrowser.clear();MissionAirportInformationBrowser.render(saved);});assert.equal(await page.locator('#airportFlightBriefing').isVisible(),true);
 await page.evaluate(()=>{fixture.aptArrivalPlan={icao:'U60',airportLat:45.1332,airportLon:-115.322,expectedBy:'Freundin',items:[{kind:'arrival_vehicle',label:'Abholfahrzeug'}],snapStatus:{status:'resolved'},osmPlacement:{name:'Hangar Nord'}};MissionAirportInformationBrowser.render(fixture);});
 const airportText=await page.locator('#wikiDestDescText').textContent();assert.match(airportText,/Empfang durch Freundin/);assert.match(airportText,/Treffpunkt bei Hangar Nord/);assert.doesNotMatch(airportText,/weiß/);
 await page.evaluate(()=>{fixture.aptArrivalPlan.osmPlacement.name='<img src=x onerror="window.injected=true"> Hangar Süd';MissionAirportInformationBrowser.render(JSON.parse(JSON.stringify(fixture)));});
 assert.equal(await page.locator('#wikiDestDescText img').count(),0);assert.equal(await page.evaluate(()=>window.injected),undefined);assert.doesNotMatch(await page.locator('#wikiDestDescText').textContent(),/Hangar Nord/);
 await page.evaluate(()=>{fixture.aptArrivalPlan=null;MissionAirportInformationBrowser.render(fixture);});assert.equal(await page.locator('#wikiDestDescText').textContent(),await page.evaluate(()=>fixture.airportInformation.destinationInfo));
 await page.evaluate(()=>MissionAirportInformationBrowser.render(fixture,{lat:44.8897,lon:-116.101}));assert.equal(await page.locator('#airportFlightBriefing').isVisible(),false);assert.equal(await page.locator('#airportDestinationInfoSources a').count(),0);
 await page.evaluate(()=>{fixture.departureAirportInfoContext=MissionAirportInformationCore.context({icao:'KMYL',name:'McCall',lat:44.8897,lon:-116.101},{wiki:{id:'wikipedia',kind:'wikipedia',title:'McCall Municipal Airport',url:'https://en.wikipedia.org/wiki/McCall_Municipal_Airport'}});fixture.departureAirportInformation={departureInfo:'McCall: Startleistung planen.\n\n<img src=x onerror="window.injected=true">',sourceIds:['wikipedia'],generated:true};MissionAirportInformationBrowser.render(fixture);MissionAirportInformationBrowser.renderDeparture(fixture,{lat:44.8897,lon:-116.101});});
 assert.equal(await page.locator('#wikiDepDescText img').count(),0);assert.match(await page.locator('#airportDepartureInfoSources a').getAttribute('href'),/McCall/);assert.equal(await page.locator('#airportDestinationInfoSources a').count(),1);assert.equal(await page.locator('#wikiDepDescText').evaluate(e=>getComputedStyle(e).whiteSpace),'pre-line');
 await page.evaluate(()=>{const saved=JSON.parse(JSON.stringify(fixture));MissionAirportInformationBrowser.clear();MissionAirportInformationBrowser.renderDeparture(saved,{lat:44.8897,lon:-116.101});MissionAirportInformationBrowser.render(saved);});
 assert.equal(await page.locator('#airportDepartureInfoSources a').count(),1);assert.equal(await page.locator('#airportDestinationInfoSources a').count(),1);
 assert.equal(await page.evaluate(()=>MissionAirportInformationBrowser.renderDeparture(fixture,{lat:45.1332,lon:-115.322})),false);assert.equal(await page.locator('#airportDepartureInfoSources a').count(),0);assert.equal(await page.locator('#airportDestinationInfoSources a').count(),1);
 }finally{await browser.close();}
});

test('real browser: APT and POI pages restore independently and stale target text is rejected',async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.GA_BROWSER_CHANNEL?{channel:process.env.GA_BROWSER_CHANNEL}:{})});
 try{
  const page=await browser.newPage({viewport:{width:440,height:894}});
  await page.setContent('<section id="airportFlightBriefing"><h3 id="airportFlightBriefingHeading"></h3><p id="airportFlightBriefingText"></p><small id="airportFlightBriefingSources"></small></section><h2>Start-Info</h2><span id="wikiDepDescText" style="white-space:pre-line"></span><small id="airportDepartureInfoSources"></small><h2>Ziel-Info</h2><span id="wikiDestDescText" style="white-space:pre-line"></span><small id="airportDestinationInfoSources"></small>');
  for(const f of ['mission-airport-information-core.js','mission-airport-information-browser.js'])await page.addScriptTag({content:fs.readFileSync(path.join(root,f),'utf8')});
  await page.evaluate(()=>{
   const core=MissionAirportInformationCore,start={icao:'EDAA',name:'Startplatz',lat:48,lon:8},target={icao:'EDBB',name:'Zielplatz',lat:49,lon:8};
   const contract={airportInfoContext:core.context(target,{wiki:{id:'wikipedia',kind:'wikipedia',title:'Zielplatz',url:'https://example.org/airport',extract:'Der Platz besitzt einen Hangar.'}}),departureAirportInfoContext:core.context(start)};
   core.attach(contract,{airportInformation:{flightBriefing:'Landung am Zielplatz planen.',destinationInfo:'Zielplatz mit belegtem Hangar.',sourceIds:['wikipedia']},departureAirportInformation:{departureInfo:'Startplatz.\n\nStartleistung planen.',sourceIds:[]}},contract.airportInfoContext,contract.departureAirportInfoContext);
   window.apt=JSON.parse(JSON.stringify({missionType:'apt',...contract,initialTargetLat:49,initialTargetLon:8}));
   MissionAirportInformationBrowser.render(apt);MissionAirportInformationBrowser.renderDeparture(apt,start);
  });
  assert.equal(await page.locator('#airportFlightBriefing').isVisible(),true);
  assert.match(await page.locator('#wikiDestDescText').textContent(),/Hangar/);
  assert.match(await page.locator('#wikiDepDescText').textContent(),/Startleistung/);
  await page.evaluate(()=>{
   const poi=JSON.parse(JSON.stringify({...apt,missionType:'poi',poiInformation:{schema:'poi-target-information.v1',target:{name:'Zielobjekt',lat:49,lon:8},text:'Zielobjekt.\n\n<img src=x onerror="window.injected=true"> Überflug für die bestehende Fotoaufgabe planen.'}}));
   MissionAirportInformationBrowser.render(poi);
   window.staleAccepted=MissionAirportInformationBrowser.render(poi,{lat:48,lon:8});
   MissionAirportInformationBrowser.renderDeparture(poi,{lat:48,lon:8});
  });
  assert.equal(await page.locator('#airportFlightBriefing').isVisible(),false);
  assert.equal(await page.locator('#wikiDestDescText img').count(),0);
  assert.equal(await page.evaluate(()=>window.injected),undefined);
  assert.equal(await page.evaluate(()=>window.staleAccepted),false);
  assert.match(await page.locator('#wikiDepDescText').textContent(),/Startleistung/);
 }finally{await browser.close();}
});

test('real browser: article fallback and accepted KI text both load the Wikipedia photograph',async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.GA_BROWSER_CHANNEL?{channel:process.env.GA_BROWSER_CHANNEL}:{})});
 try{
  const page=await browser.newPage();
  await page.setContent('<section id="airportFlightBriefing"><h3 id="airportFlightBriefingHeading"></h3><p id="airportFlightBriefingText"></p><small id="airportFlightBriefingSources"></small></section><span id="wikiDestDescText"></span><small id="airportDestinationInfoSources"></small><div id="wikiDestImageContainer" style="display:none;width:140px;height:100px"><div id="wikiDestImage" style="width:140px;height:100px"></div></div>');
  for(const f of ['mission-airport-information-core.js','mission-airport-information-browser.js'])await page.addScriptTag({content:fs.readFileSync(path.join(root,f),'utf8')});
  const code=fs.readFileSync(path.join(root,'app.js'),'utf8'),a=code.indexOf('async function fetchAreaDescription('),b=code.indexOf('\nconst wikiTitleCache',a);
  await page.addScriptTag({content:code.slice(a,b)});
  for(const generated of [false,true]){
   await page.evaluate(async generated=>{
    const core=MissionAirportInformationCore,c=core.context({icao:'EDTF',name:'Flugplatz Freiburg',lat:48.02278,lon:7.8325});
    window.currentMissionData={missionType:'apt',airportInfoContext:c,airportInformation:generated?{flightBriefing:'Anflugplanung.',destinationInfo:'KI-Platzüberblick in kurzen Absätzen.',sourceIds:[],generated:true}:core.fallback(c)};
    window._dispatchUiCommitAllowed=()=>true;window.buildAreaDescriptionPoiFallback=()=>'';window.getWikiTitleForAirport=async()=> 'Flugplatz Freiburg';
    window.fetch=async()=>({json:async()=>({query:{pages:{1:{extract:'Wikipedia: Geschichte und Nutzung des Freiburger Flugplatzes.',thumbnail:{source:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII='}}}}})});
    await fetchAreaDescription(48.02278,7.8325,'wikiDestDescText',null,'EDTF');
   },generated);
   assert.equal(await page.locator('#wikiDestImageContainer').isVisible(),true);
   assert.match(await page.locator('#wikiDestImage').evaluate(e=>getComputedStyle(e).backgroundImage),/data:image\/png/);
   assert.match(await page.locator('#wikiDestDescText').textContent(),generated?/KI-Platzüberblick/:/Geschichte und Nutzung/);
  }
 }finally{await browser.close();}
});
