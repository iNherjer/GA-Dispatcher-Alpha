const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const bush=require('../mission-bush-narrative-core.js'),shared=require('../mission-poi-briefing-shared-core.js'),airport=require('../mission-airport-information-core.js');
const context=()=>({id:'mast-test',target:{name:'Testmast',lat:48,lon:8},radiusM:5556,facts:[],targetFacts:[{id:'mast-purpose',fact:'Der Testmast dient dem Rundfunk.',source:'fixture'}],coverage:[{status:'partial'}],supplements:[],terrain:{status:'missing'}});
test('Recon information uses shared source guidance, distinguishes suspicion and avoids landing instructions',()=>{
 const c=context(),prompt=bush.reconWriterPrompt(c,shared,airport);assert.ok(prompt.includes(shared.navigationInstructions));assert.ok(prompt.includes(c.targetFacts[0].fact));assert.match(prompt,/Vermutung/);assert.match(prompt,/statt Landung/);assert.match(prompt,/kein Tiefflug wird verlangt/);assert.equal(bush.reconWriterPrompt(null,shared,airport),'');
 const prose='Ein vollständiger Beobachtungstext mit eigener Einordnung. '.repeat(45);const m=bush.attachRecon({s:'Unveränderte Story'}, {targetInfo:prose,reconReport:{orientationIds:['unknown']}},c,shared);
 assert.equal(m.s,'Unveränderte Story');assert.ok(m.targetInfo.startsWith(prose.trim()));assert.ok(m.targetInfo.length>2000);assert.match(m.targetInfo,/Hindernisse/);assert.equal(m.bushReconInfo.reportStatus,'source-selection-fallback');assert.deepEqual(m.bushReconInfo.evidence.target,c.target);assert.equal(m.airportInformation,undefined);
});
test('missing recon prose uses supplied facts while missing coverage proves no obstacle clearance',()=>{
 const m=bush.attachRecon({}, {},context(),shared);assert.match(m.targetInfo,/Rundfunk/);assert.equal(m.bushReconInfo.generated,false);assert.match(m.targetInfo,/bedeutet nicht, dass die Umgebung hindernisfrei ist/);assert.equal(bush.attachRecon({}, {},null,shared).bushReconInfo,undefined);
});
test('production POI restore helper returns complete Recon information before legacy truncation',async()=>{
 const {declaration}=await import('./gemini-migration-harness.mjs');const source=fs.readFileSync(require.resolve('../app.js'),'utf8');const c=vm.createContext({missionUsesPoiPresentation:()=>true});vm.runInContext(declaration(source,'buildPoiTargetInfoFromMission'),c);
 const original=bush.attachRecon({}, {targetInfo:'Vollständige Beschreibung. '.repeat(100)},context(),shared);const restored=JSON.parse(JSON.stringify(original));assert.equal(c.buildPoiTargetInfoFromMission(restored),original.targetInfo);
});
test('weather basis is passed to production planning and writing without turning normal values into triggers',()=>{
 const prompt=bush.sourcePrompt({environmentContext:{target:{status:'available',current:{values:{temperature_2m:14,wind_speed_10m:8}}}},bushReconContext:context()});assert.ok(prompt.includes(bush.weatherIdeaInstructions));assert.match(prompt,/belegten markanten Wetterereignis/);assert.match(prompt,/Gewöhnliche Wetterwerte/);assert.match(prompt,/längerfristigen zeitlichen Anker/);assert.match(prompt,/ohne Zeitdruck/);assert.match(prompt,/konkret belegtes bevorstehendes Ereignis/);assert.ok(prompt.includes('Testmast'));assert.ok(prompt.includes('Rundfunk'));
});

test('local quota save and cloud compact projection retain Recon text and source snapshot',async()=>{
 const {declaration}=await import('./gemini-migration-harness.mjs');const c=vm.createContext({window:{}});
 for(const [file,name] of [['app.js','compactMissionObjectForQuotaStorage'],['sync.js','_syncCompactMissionObjectCore']])vm.runInContext(declaration(fs.readFileSync(require.resolve('../'+file),'utf8'),name),c);
 const m=bush.attachRecon({missionType:'bush',profileId:'bush_recon_return'}, {targetInfo:'Vollständiger Satz. '.repeat(100)},context(),shared);
 for(const name of ['compactMissionObjectForQuotaStorage','_syncCompactMissionObjectCore']){const projected=c[name](m);assert.equal(projected.bushReconInfo.text,m.bushReconInfo.text);assert.deepEqual(projected.bushReconInfo.evidence,m.bushReconInfo.evidence);assert.equal(projected.targetInfo,m.targetInfo);}
});

test('Bush Recon fallback no longer injects a storm; ordinary infrastructure defaults stay unchanged',async()=>{
 const {declaration}=await import('./gemini-migration-harness.mjs');const c=vm.createContext({normalizeMissionType:x=>x,normalizeMissionText:x=>String(x).toLowerCase(),_missionPipelineV4PickOne:x=>x[0]});
 vm.runInContext(declaration(fs.readFileSync(require.resolve('../app.js'),'utf8'),'_missionPipelineV4NarrativeDefaults'),c);
 const semantics={focusLock:{taskDomain:'inspection_infra',primarySubjectLabel:'Testmast',targetCategory:'telecom'}};
 const recon=c._missionPipelineV4NarrativeDefaults({},semantics,{}, {missionType:'bush'});assert.match(recon.trigger,/Sichtprüfung/);assert.equal(recon.incidentContext,'');assert.ok(!/sturm|wetter|dringend/i.test(JSON.stringify(recon)));
 const ordinary=c._missionPipelineV4NarrativeDefaults({},semantics,{}, {missionType:'poi'});assert.match(ordinary.trigger,/Stoerungs-, Sturm- oder Schadensmeldung/);
});

test('production Bush V5 writer receives a bounded 45-second timeout for both providers, other families unchanged',async()=>{
 const {declaration}=await import('./gemini-migration-harness.mjs');let captured,provider='gemini';
 const c=vm.createContext({window:{},document:{getElementById:()=>({checked:true})},getSelectedAiApiKey:()=> 'fixture-key',getSelectedAiProvider:()=>provider,buildMissionWriterV5Prompt:()=> 'fixture',fetchGeminiJsonWithFallback:async(p,k,o)=>{captured=o;return {parsed:{story:'A complete fictional story.'}};},_missionWriterRequestDiagnostics:()=>({}),sanitizeMissionWriterV5Payload:()=>({})});
 vm.runInContext(declaration(fs.readFileSync(require.resolve('../app.js'),'utf8'),'fetchMissionWriterV5'),c);
 const base={missionContractV4:{status:'ready',profile:{id:'bush_pickup_strip',taskDomain:'bush_pickup_return'}}};
 await c.fetchMissionWriterV5({...base,missionType:'bush'});assert.equal(captured.timeoutMs,45000);
 await c.fetchMissionWriterV5({...base,missionType:'apt'});assert.equal(captured.timeoutMs,16000);provider='openai';await c.fetchMissionWriterV5({...base,missionType:'bush'});assert.equal(captured.timeoutMs,45000);
});
test('Recon briefing keeps complete prose, handbook sources and restore rendering separate from landing guidance',()=>{
 const c=context();c.handbookContext=airport.context({name:'Testmast',lat:48,lon:8,elevation:1200});
 const prose='Beobachtungsgebiet und allgemeiner Planungshinweis. '.repeat(60);
 const m=bush.attachRecon({missionType:'bush'}, {targetInfo:'Zielbeschreibung',reconFlightBriefing:prose},c,shared);
 assert.equal(m.bushReconInfo.flightBriefing,prose.trim());assert.ok(bush.reconWriterPrompt(c,shared,airport).includes('Handbüchern'));
 const els={};for(const id of ['airportFlightBriefing','airportFlightBriefingText','airportFlightBriefingHeading','wikiDestDescText'])els[id]={hidden:true,textContent:'',replaceChildren(){}};
 const sandbox={window:{document:{getElementById:id=>els[id]},MissionAirportInformationCore:airport}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../mission-airport-information-browser.js'),'utf8'),sandbox);
 assert.equal(sandbox.window.MissionAirportInformationBrowser.render(JSON.parse(JSON.stringify(m))),true);
 assert.equal(els.airportFlightBriefing.hidden,false);assert.equal(els.airportFlightBriefingText.textContent,prose.trim());assert.match(els.airportFlightBriefingHeading.textContent,/Zielgebiet/);assert.equal(els.wikiDestDescText.textContent,'Zielbeschreibung\n\n'+shared.formatReport(shared.buildReport(undefined,c).report));
 const fallback=bush.attachRecon({missionType:'bush'}, {},c,shared);assert.match(fallback.bushReconInfo.flightBriefing,/Landung.*nicht vorgesehen/);
});
