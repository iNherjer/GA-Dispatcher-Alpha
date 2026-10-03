import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import knowledge from '../mission-knowledge-briefing-core.js';
import photo from '../mission-poi-briefing-core.js';
import geo from '../mission-geo-briefing-core.js';
import mapping from '../mission-mapping-briefing-core.js';
import narrative from '../mission-poi-followup-narrative-core.js';
import bio from '../mission-bio-briefing-core.js';
import infra from '../mission-infra-briefing-core.js';
import news from '../mission-news-briefing-core.js';
import voice from '../mission-poi-voice-core.js';
import {extractOriginalFunction} from './extract-original-function.mjs';
const source=fs.readFileSync('passenger-voice.js','utf8');
function fixture(domain){
 const isPhoto=domain==='media_photo',isNews=domain==='news_coverage',isBio=domain==='science_bio',isGeo=domain==='science_geo',isMapping=domain==='mapping_survey';
 const idea={commission:'Der Verband benötigt eine neue Aufnahme.',purpose:'Flächige Ansichten für die Bauakte',captureFocus:'Systematische Abdeckung',studyFocus:'Stichproben in Vegetationsmustern planen',outputUse:'Die nächste Feldkampagne vorbereiten',aerialObservation:{visibleCue:'Großflächige Muster',usefulObservation:'Zusammenhänge erkennen',followup:'Arten am Boden bestimmen'},outlet:'Lokaljournal',headline:'Eine überraschende Aktion',angle:'Wie wirkt die Aktion im Ortsbild?',airValue:'Übersicht der Aktion',deliverable:'Ein augenzwinkernder Lokalbeitrag',taskDomain:domain,targetName:'Staudamm',person:{name:'Ada',role:isPhoto?'Fotografin':'Prüferin',relationshipToPilot:'beauftragte Fachperson'},situation:'Die ganze Vorgeschichte bleibt erhalten. '.repeat(12),intent:'Ein Geschenkbild für die Familie.',client:{name:'Wasserverband'},inspectionFocus:'Betroffene Abschnitte der Dammkrone eingrenzen.',scenarioDetails:['Eine verschobene Abdeckung wurde gemeldet.'],aerialAssessment:{visibleCue:'Größere Verschiebung',usefulConclusion:'Betroffene Abschnitte',followup:'Sofortige Nachprüfung vor Ort'},decisionNeeded:'Dringlichkeit der Nachprüfung.'};
 const briefing={schema:isPhoto?photo.VERSION:isNews?news.VERSION:isBio?bio.VERSION:isGeo?geo.VERSION:isMapping?mapping.VERSION:infra.VERSION,idea,capture:{deliverable:'target_photos_or_video'}};
 const md={poiName:'Staudamm',mission:'Blick auf den Staudamm',missionContract:{},[isPhoto?'poiBriefing':isNews?'newsBriefing':isBio?'bioBriefing':isGeo?'geoBriefing':isMapping?'mappingBriefing':'infraBriefing']:briefing};
 const passenger={name:'Ada',role:idea.person.role,taskDomain:domain,narrativeSchema:briefing.schema,urgencyPriority:'niedrig',targetAltFt:3000,targetRadiusNm:2,targetDwellMin:2};
 const env={window:{activePassenger:passenger,MissionPoiBriefingCore:photo,MissionInfraBriefingCore:infra,MissionNewsBriefingCore:news,MissionBioBriefingCore:bio,MissionGeoBriefingCore:geo,MissionMappingBriefingCore:mapping,MissionPoiFollowupNarrativeCore:narrative},currentMissionData:md,localStorage:{getItem:()=>null},document:{getElementById:()=>({innerText:''})},_getMissionStory:()=>idea.situation,_sanitizePaxSoftPoiStory:x=>x,_activeTaskDomain:()=>domain,_isPOIMission:()=>true,_normUrgencyPriority:()=> 'niedrig',_missionHasPax:()=>true,_personaNarrativeSeedAllowed:()=>true};
 for(const name of ['_activeBushPickupPassengerContract','_roleStyleHint','_personaPersonalityLabel','_personaSpeechSignature','_activeAptTrainingPlan','_aptArrivalContextLine','_poiSightseeingKnowledgeContextLine','_paxTargetProminenceLine','_paxVisualLandmarksLine','_activeMissionStoryFrame','_bushVoiceToneLine','_bushPickupPassengerPerspectiveLine'])env[name]=()=>null;
 vm.createContext(env);for(const name of ['_baseContext','_inspectionMissionMeta','_inspectionEntryHint','_domainDriftGuard'])vm.runInContext(extractOriginalFunction(source,name),env);
 const context={schema:voice.CONTEXT_SCHEMA,version:1,missionId:'narrative-test',taskDomain:domain,strict:false,audioEnabled:false,baseContext:env._baseContext(),toneHint:'',passenger,missionData:{poiName:'Staudamm'},inspectionMeta:env._inspectionMissionMeta(),targetFacts:[],wikiText:''};
 return {env,context,idea};
}
for(const domain of ['media_photo','inspection_infra'])test(domain+' carries the selected idea through tracker prompts and restored speech memory',()=>{
 const {context,idea}=fixture(domain);assert.ok(context.baseContext.includes(domain==='media_photo'?idea.intent:idea.inspectionFocus));
 const restored=JSON.parse(JSON.stringify(context));let memory={};
 for(const [prompt,args] of [['_poiInSightPrompt',[{mslFt:3000},2,2,'12 Uhr']],['_poiEntryPrompt',[{mslFt:3000}]],['_poiSatisfiedPrompt',[{mslFt:3000}]]]){
  const result=voice.render(restored,{prompt,args,detector:{dwellSec:120}},memory);
  assert.ok(result.prompt.includes(domain==='media_photo'?idea.intent:idea.inspectionFocus));
  if(prompt==='_poiSatisfiedPrompt')assert.match(result.prompt,/bereits|GESAGT|Erinnerung|ZUVOR/i);
  memory=voice.captureMemory(result.memory,'Zielgebiet','Die markierte Stelle haben wir bereits besprochen.',domain);
  memory=JSON.parse(JSON.stringify(memory));
 }
});
test('photo at a dam never acquires inspection metadata and keeps personal purpose',()=>{const {env,context}=fixture('media_photo');assert.equal(env._inspectionMissionMeta(),null);assert.equal(env._inspectionEntryHint(),'');assert.match(context.baseContext,/Geschenkbild für die Familie/);assert.doesNotMatch(env._domainDriftGuard('entry'),/Keine persoenliche Ausflugserzaehlung/);});
test('infra preserves chosen question and does not silence narrative urgency',()=>{const {env,context}=fixture('inspection_infra');assert.match(env._inspectionEntryHint(),/Dammkrone/);assert.doesNotMatch(context.baseContext,/keine Eile-Kommunikation/);assert.match(context.baseContext,/Nachprüfung vor Ort/);const result=voice.render({...context,infraOutcome:{outcome:'monitor',resultPrompt:'VERBINDLICHER BEFUND: nur Beobachtungsbedarf'}},{prompt:'_poiSatisfiedPrompt',args:[{mslFt:3000}],detector:{dwellSec:120}});assert.match(result.prompt,/VERBINDLICHER BEFUND/);});

test('news passes full editorial purpose to existing tracker phases without inspection metadata',()=>{const {env,context,idea}=fixture('news_coverage');assert.equal(env._inspectionMissionMeta(),null);assert.match(context.baseContext,/REPORTAGEAUFTRAG/);for(const prompt of ['_poiEntryPrompt','_poiSatisfiedPrompt']){const result=voice.render(JSON.parse(JSON.stringify(context)),{prompt,args:[{mslFt:3000}],detector:{dwellSec:120}});assert.ok(result.prompt.includes(idea.deliverable));assert.match(result.prompt,/Humor/);assert.doesNotMatch(result.prompt,/Fokus Inspektion/);}});

test('bio research question reaches existing tracker prompts after restoration without inspection metadata',()=>{const {env,context,idea}=fixture('science_bio');assert.equal(env._inspectionMissionMeta(),null);assert.match(context.baseContext,/BIOLOGISCHE STUDIE/);for(const prompt of ['_poiInSightPrompt','_poiEntryPrompt','_poiSatisfiedPrompt']){const args=prompt==='_poiInSightPrompt'?[{mslFt:3000},2,2,'12 Uhr']:[{mslFt:3000}];const result=voice.render(JSON.parse(JSON.stringify(context)),{prompt,args,detector:{dwellSec:120}});assert.ok(result.prompt.includes(idea.studyFocus));assert.ok(result.prompt.includes(idea.outputUse));}});

test('geo study and open questions survive serialized tracker voice context',()=>{const {env,context,idea}=fixture('science_geo');assert.equal(env._inspectionMissionMeta(),null);assert.match(context.baseContext,/GEOLOGISCHE STUDIE/);for(const prompt of ['_poiInSightPrompt','_poiEntryPrompt','_poiSatisfiedPrompt']){const args=prompt==='_poiInSightPrompt'?[{mslFt:3000},2,2,'12 Uhr']:[{mslFt:3000}];const result=voice.render(JSON.parse(JSON.stringify(context)),{prompt,args,detector:{dwellSec:120}});assert.ok(result.prompt.includes(idea.studyFocus));assert.ok(result.prompt.includes(idea.outputUse));assert.match(result.prompt,/keine.*Sicherheitsfreigabe/i);}});

test('mapping commissioning story reaches restored tracker voice context without a new task machine',()=>{const {context,idea}=fixture('mapping_survey');assert.match(context.baseContext,/MAPPING-AUFTRAG/);for(const prompt of ['_poiInSightPrompt','_poiEntryPrompt','_poiSatisfiedPrompt']){const args=prompt==='_poiInSightPrompt'?[{mslFt:3000},2,2,'12 Uhr']:[{mslFt:3000}];const result=voice.render(JSON.parse(JSON.stringify(context)),{prompt,args,detector:{dwellSec:120}});assert.ok(result.prompt.includes(idea.purpose));assert.match(result.prompt,/keine Messgenauigkeit/);}});

for(const [profileId,domain] of [['historian_guided_tour','historian_guided_tour'],['tour_guide_knowledge','poi_learning_guide'],['sightseeing_tour','sightseeing_tour']])test(profileId+' source-backed viewpoint reaches real base context and tracker prompts',()=>{
 const {env,context}=fixture('science_geo');const briefing={schema:knowledge.VERSION,idea:{profileId,focus:'Belegter Blickwinkel',person:{name:'Ada',role:'Freund'}},knowledgeFacts:[{id:'knowledge-0',fact:'Ein verifizierter Fakt',source:'https://example.org/target'}]};
 env._poiKnowledgeQueueContextLine=()=>'';env.window.MissionKnowledgeBriefingCore=knowledge;env.currentMissionData={poiName:'Staudamm',knowledgeBriefing:briefing};env._activeTaskDomain=()=>domain;env.window.activePassenger.taskDomain=domain;
 context.taskDomain=domain;context.passenger.taskDomain=domain;context.baseContext=env._baseContext();assert.match(context.baseContext,/Belegter Blickwinkel/);
 const restored=JSON.parse(JSON.stringify(context));for(const prompt of ['_poiInSightPrompt','_poiEntryPrompt','_poiSatisfiedPrompt']){const result=voice.render(restored,{prompt,args:prompt==='_poiInSightPrompt'?[{mslFt:3000},2,2,'12 Uhr']:[{mslFt:3000}],detector:{dwellSec:120}});assert.match(result.prompt,/Ein verifizierter Fakt/);assert.match(result.prompt,/Belegter Blickwinkel/);}
 });
