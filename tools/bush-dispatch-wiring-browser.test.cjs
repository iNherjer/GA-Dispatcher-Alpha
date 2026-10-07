const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require(process.env.GA_PLAYWRIGHT_MODULE||'/Users/jofaist/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'..');
test('real App functions: restored U60 → planner → V5 writer → Bush chapters → briefing/destination display',async()=>{
 const server=http.createServer((req,res)=>{const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname),file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));if(!file.startsWith(root+path.sep)||pathname.includes('/.')){res.writeHead(404).end();return;}try{const data=fs.readFileSync(file);res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.html')?'text/html':file.endsWith('.css')?'text/css':'application/json');res.end(data);}catch{res.writeHead(404).end();}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const browser=await chromium.launch({channel:process.env.GA_BROWSER_CHANNEL||'chrome',headless:true});
 try{const page=await browser.newPage({viewport:{width:440,height:894}});
  await page.route('**/*',async route=>{const url=new URL(route.request().url());if(url.hostname==='127.0.0.1'||/unpkg.com|cdnjs.cloudflare.com|cdn.jsdelivr.net/.test(url.hostname)){await route.continue();return;}await route.fulfill({status:200,contentType:'application/json',body:'{}'});});
  await page.addInitScript(()=>localStorage.setItem('ga_onboarding_seen_v1','1'));
  await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>typeof window.fetchMissionWriterV5==='function'&&!!window.MissionAirportInformationBrowser);
  const result=await page.evaluate(async()=>{
   const start={icao:'KMYL',n:'McCall Municipal Airport',lat:44.8897,lon:-116.101,elevation:5024,country:'US'};
   // The saved destination has its short ident but no separate FAA alias.
   const dest=buildAirportDispatchRecord('U60',{ident:'U60',name:'Big Creek Airport',lat:45.133202,lon:-115.321999,elevation:5743,country:'US'});
   const enabled=MissionAirportInformationBrowser.enabled({missionType:'bush',aiModeEnabled:true,isPOI:false,profileId:'bush_charter_strip',target:dest});
   if(!enabled)return {enabled};
   const airportInfoContext=await MissionAirportInformationBrowser.load(dest,{persistent:false,snapshots:async()=>[{airports:[{...dest,runways:[{designator:'01/19',length:1082,width:34,surface:'Gras'}]}]}],fetch:async()=>new Response('{}')});
   const environmentContext=MissionEnvironmentCore.context(start,dest,[],new Date('2026-10-07T18:00Z'));
   const plannerContext={start,dest,isPOI:false,missionType:'bush',dispatchProfileId:'bush_charter_strip',missionPicker:{baseType:'bush',profile:'bush_charter_strip'},dist:36,selectedCategory:'charter',requestedCategory:'charter',passengerCount:1,paxText:'1 PAX',cargoText:'Karten und Markierungsband (25 lbs)',airportInfoContext,environmentContext};
   const draft=buildMissionPlannerV2Draft(plannerContext);
   const plannerPrompts=[false,true].map(compact=>_missionPipelineV4Prompt(draft,{airportInfoContext,environmentContext},{compact}));
   const plan={status:'ready',needs:[],plan:{missionType:'bush',taskDomain:'charter',roleProfile:'charter_professional_neutral_v1',targetCategory:'charter',targetLabel:dest.n,sceneKind:'none',primaryObjective:'Sarah zum Trail-Team bringen',storyFrame:{subjectDetail:'USFS-Koordinatorin mit Karten',incidentContext:'Markierungen prüfen',whyNow:'Team wartet',soughtOutcome:'Absetzen am Zielstrip'},localFacts:[],weatherHooks:[],mustMention:[],mustAvoid:[],operationalDetails:[],objectFamilies:[],confidence:1},resolvedNeeds:{}};
   const contract=buildMissionContractV4({plannerContext,plannerResult:plan});
   const greeting='Hi, ich bin Sarah. Mein Kollege hat die Wegmarkierung für wasserdicht gehalten. Die Fotos in meinem Rucksack erzählen eine andere Geschichte.';
   const raw={title:'Sarahs verschwundene Wegmarkierungen',story:'Sarah Miller will zum Trail-Team am Big Creek Airport. Ihr Kollege hat letzte Woche die neuen Wegmarkierungen stolz fotografiert. Auf den Bildern sieht alles perfekt aus, doch die erste Wandergruppe stand kurz darauf am falschen Abzweig. Sarah hat die Karten und frisches Markierungsband dabei. Sie kennt den Kollegen seit Jahren und möchte ihm diesmal persönlich beim Abgleich über die Schulter sehen. Du setzt sie am Zielstrip ab, wo ihre Arbeit am Boden beginnt.',pax:'1 PAX',cargo:plannerContext.cargoText,passenger:{name:'Sarah Miller',role:'USFS-Koordinatorin',gender:'female',personality:'herzlich, trocken, aufmerksam',greetingText:greeting},sceneIntent:{summary:'A-B-Flug ohne Zielszene',visibleIdeas:[],densityHint:'none'},airportInformation:{flightBriefing:'Big Creek liegt auf 5743 ft MSL. Die Grasbahn 01/19 ist 1082 m lang und 34 m breit. Die Platzhöhe gehört in die Leistungsplanung; die tatsächliche Dichtehöhe ist nicht berechnet.',destinationInfo:'Big Creek Airport (U60) liegt in Idaho. Die Grasbahn 01/19 ist 1082 m lang und 34 m breit. Die Platzhöhe beträgt 5743 ft MSL.',sourceIds:[]}};
   const oldRequest=fetchGeminiJsonWithFallback,oldKey=getSelectedAiApiKey;let writerPrompt='';getSelectedAiApiKey=()=> 'fictional-test-key';document.getElementById('aiToggle').checked=true;
   fetchGeminiJsonWithFallback=async prompt=>{writerPrompt=prompt;return {parsed:raw,source:'Fixture'};};
   let mission;try{mission=await fetchMissionWriterV5({missionType:'bush',isPOI:false,missionContractV4:contract,bushSpec:buildBushMissionSpec({profileId:'bush_charter_strip',startAirport:start,destAirport:dest,distNm:36}),cargoText:plannerContext.cargoText});}finally{fetchGeminiJsonWithFallback=oldRequest;getSelectedAiApiKey=oldKey;}
   let chapterCalls=0;const chapters=mission.bush?await MissionBushNarrativeBrowser.generate({bush:mission.bush,passenger:mission.passenger,start,target:dest,story:mission.s,airportInfoContext,environmentContext},{tileKey:()=> 'fixture',tileFeatures:async()=>[],request:async()=>{chapterCalls++;return {parsed:{persona:'herzlich',memory:'Sarah prüft die Markierungen ihres Kollegen.',events:[{id:'a',kind:'fixed',atAirborneSeconds:90,text:'Das erste Foto sah großartig aus. Man musste nur die Karte auf den Kopf drehen.'},{id:'b',kind:'fixed',atAirborneSeconds:240,text:'Ich bin gespannt, wie mein Kollege den falschen Abzweig erklären wird.'}]}};}}):null;
   currentMissionData={...mission,airportInfoContext,environmentContext,initialTargetLat:dest.lat,initialTargetLon:dest.lon};window.currentMissionData=currentMissionData;
   await fetchAreaDescription(dest.lat,dest.lon,'wikiDestDescText');
   const preservedGreeting=mission.passenger.greetingText===greeting;
   const recipes=[];
   for (const profileId of ['bush_supply_strip','bush_charter_strip','bush_scenic_hopper','bush_recon_return','bush_pickup_strip','bush_pickup_cargo']) {
    const spec=buildBushMissionSpec({profileId,startAirport:start,destAirport:dest,distNm:36});
    const profile=getMissionTaskProfile(profileId,'bush');
    const cargoOnly=['bush_supply_strip','bush_pickup_cargo'].includes(profileId);
    const recipeContract={...contract,profile,plannedPassengerCount:cargoOnly?0:1,passengerCount:cargoOnly?0:1,missionPlan:{...contract.missionPlan,plan:{...contract.missionPlan.plan,taskDomain:profile.taskDomain,roleProfile:profile.roleProfile}},storyFrame:{...contract.storyFrame}};
    const output=sanitizeMissionWriterV5Payload(raw,{missionType:'bush',missionContractV4:recipeContract,bushSpec:spec,cargoText:plannerContext.cargoText});
    recipes.push({profileId,recipe:output.bush?.profileId,targetMode:output.bush?.targetMode,expectedMode:spec.targetMode,noPassenger:cargoOnly?!output.passenger:true});
   }

   // The old shared fallback remains in effect for an ordinary APT charter.
   const aptGreeting=_missionPipelineV4FinalizeGreeting({name:'Sarah',greetingText:''},{mode:'apt',profile:{id:'apt_charter',taskDomain:'charter'},target:{name:'Airport'},storyFrame:{}},'').greetingText;
   return {recipes,enabled,display:airportDisplayIdent(dest),plannerPersonal:plannerPrompts.map(p=>p.includes(MissionBushNarrativeCore.personalityInstructions)),writerPersonal:writerPrompt.includes(MissionBushNarrativeCore.writerInstructions),writerAirport:writerPrompt.includes('BUSH-PLATZREDAKTION'),contractContext:!!contract.airportInfoContext,recipe:mission.bush?.profileId,chapterCalls,chapterStatus:chapters?.status,chapterCount:chapters?.plan?.events.length,preservedGreeting,aptGreeting,briefingVisible:!document.getElementById('airportFlightBriefing').hidden,briefing:document.getElementById('airportFlightBriefingText').textContent,destination:document.getElementById('wikiDestDescText').textContent,storyAccepted:mission._missionWriterV4Debug.writerAccepted};
  });
  for(const row of result.recipes){assert.equal(row.recipe,row.profileId);assert.equal(row.targetMode,row.expectedMode);assert.equal(row.noPassenger,true);}
  assert.equal(result.enabled,true);assert.equal(result.display,'OHNE ICAO');assert.deepEqual(result.plannerPersonal,[true,true]);assert.equal(result.writerPersonal,true);assert.equal(result.writerAirport,true);assert.equal(result.contractContext,true);assert.equal(result.recipe,'bush_charter_strip');assert.equal(result.chapterCalls,1);assert.equal(result.chapterStatus,'ready');assert.equal(result.chapterCount,2);assert.equal(result.preservedGreeting,true);assert.match(result.aptGreeting,/heute geht es wegen/);assert.equal(result.briefingVisible,true);assert.match(result.briefing,/Dichtehöhe/);assert.match(result.destination,/1082 m/);assert.equal(result.storyAccepted,true);
  const typography=await page.evaluate(()=>{
   const properties=['fontFamily','fontSize','fontWeight','fontStyle','lineHeight','color','letterSpacing'];
   const read=id=>Object.fromEntries(properties.map(key=>[key,getComputedStyle(document.getElementById(id))[key]]));
   const original=document.body.className,rows=[];
   for(const theme of ['', 'theme-retro','theme-navcom','theme-ops1940','theme-win95']){
    document.body.className=theme;
    rows.push({theme,story:read('mStory'),flight:read('airportFlightBriefingText')});
   }
   document.body.className=original;
   return rows;
  });
  for(const row of typography)assert.deepEqual(row.flight,row.story,`Flight information must match briefing typography in ${row.theme||'default'}`);
  if(process.env.GA_BRIEFING_SCREENSHOT){
   await page.locator('#dispatchApiKeyClose').click();
   await page.evaluate(()=>{
    document.body.className='theme-retro';
    document.getElementById('briefingBox').style.display='block';
    document.getElementById('mTitle').textContent='Sarahs verschwundene Wegmarkierungen';
    document.getElementById('mStory').textContent=currentMissionData.s;
   });
   await page.locator('#notePage1').screenshot({path:process.env.GA_BRIEFING_SCREENSHOT});
  }
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
});
