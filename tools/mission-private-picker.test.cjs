const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const geo=require('../mission-private-context-core.js');
const v5=require('../mission-private-outing-core.js');
const core=require('../mission-private-episode-v6.js');
const clone=x=>JSON.parse(JSON.stringify(x));
const airports=[1,2,3].map(i=>({icao:`TEST${i}`,n:`Platz ${i}`,lat:48+i/10,lon:8}));
const start={n:'Startplatz',lat:48,lon:7};
function rawIdea(name){return {targetName:name,occasion:`Ihr wollt zusammen bei ${name} spazieren gehen.`,personalReason:'Du hast die gemeinsame Pause vorgeschlagen.',destinationConnection:'Der Platz ist euer Ausgangspunkt.',firstStep:'Gemeinsam losgehen.',pilotIntent:'Zeit mit der Begleitung verbringen.',companionIntent:'Gemeinsam spazieren gehen.',episode:{situation:'Beide haben frei.',sharedIntent:'Gemeinsam spazieren.',flightRole:'Anreise'},storyIdentity:{activity:'Spaziergang',motivation:'gemeinsame Zeit',interaction:'gemeinsam frei'},noveltyReason:'Einfache gemeinsame Pause',factIds:['f1'],groundPlan:{factId:'f1',intent:'Spaziergang',transferPlan:'Zu Fuß'},eventVisit:null,creativeBasis:{realAnchor:'Wald',fictionalPart:'Die Verabredung'},companion:{name:'Ada',relationship:'Freundin',personality:'direkt',gender:'female'},luggage:{label:'Rucksack',weightLbs:5}};}
function rawWriter(){return {title:'Ein freier Tag',story:'Ihr erkundet gemeinsam den Wald.',flightBriefing:'Die Strecke misst [[route.distance]].',greeting:{speaker:'companion',addressee:'pilot',text:'Ich freue mich auf unseren Spaziergang.'},memory:{schema:'episode-memory.v1',summary:'Gemeinsam im Wald spazieren.',activity:'Spaziergang',motivation:'Gemeinsame Zeit',flightRole:'Anreise',relationshipDynamic:'Pilot schlägt gemeinsame Pause vor.',opening:'Gemeinsam erkunden',rhythm:'Ein Satz',ending:'Wald',distinctivePhrase:'gemeinsam den Wald'}};}
function sandbox(){
 const data=new Map(),requests=[],regions=[];
 const localStorage={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)};
 const c={window:{MissionPrivateEpisodeV6:core,MissionPrivateOutingCore:v5,MissionPrivateContextCore:{...geo,resolveBrowser:async target=>{
  regions.push(target);return {airport:target,radiusKm:50,places:[{name:'Wald '+target.name,lat:target.lat,lon:target.lon,source:'fixture',type:'natural=wood',description:'Wald',distanceKm:0}],stats:{fixture:true}};
 }}},localStorage,currentStartICAO:'START',getSelectedAiApiKey:()=> 'test',getSelectedAiProvider:()=> 'gemini',
 normalizeAirportIdent:x=>x,normalizeMissionText:x=>String(x).toLowerCase(),
 missionProposalCompactTarget:t=>({...t}),missionProposalAirportLocationLabel:t=>t.n,
 missionProposalFormatRoute:()=>({label:'32 NM',nav:{dist:32}}),getMissionTaskProfile:()=>({}),
 collectMissionProposalAirportCandidates:async()=>airports,
 missionProposalPickCargoItems:()=>{throw Error('Old cargo catalogue reached');},missionProposalAptScenarios:()=>{throw Error('Old scenario catalogue reached');},
 fetchGeminiJsonWithFallback:async(prompt,key,options)=>{
  requests.push({prompt,options});
  if(prompt.includes('AUSWAHLMODUS:')){
   const frames=JSON.parse(prompt.match(/^RAHMEN: (.*)$/m)[1]);
   return {source:'stub',parsed:{proposals:frames.map(frame=>({candidateId:frame.candidateId,title:'Ausflug '+frame.targetName,idea:rawIdea(frame.targetName)}))}};
  }
  return {source:'stub',parsed:rawWriter()};
 }};
 vm.createContext(c);const src=fs.readFileSync(require.resolve('../app.js'),'utf8');
 for(const name of ['normalizeMissionProposalChoice','compactMissionProposalChoice','missionProposalAptProfileConfig','buildPrivateMissionProposalChoices','buildMissionProposalAptChoices','applyMissionProposalChoiceToMissionContractV4','fetchPrivateOutingStory','classifyAptMissionCategory','personalizeAptCharterMission']){
  const at=src.indexOf('function '+name+'(');assert.ok(at>=0,name);
  const begin=src.slice(at-6,at)==='async '?at-6:at;
  vm.runInContext(src.slice(begin,src.indexOf('\n}',at)+2),c);
 }
 return {c,requests,regions,localStorage,data};
}
function currentContract(choice){return {status:'ready',profile:{id:'private_outing',taskDomain:'private_outing'},target:{name:choice.target.n,lat:choice.target.lat,lon:choice.target.lon},route:{startIcao:'START',startName:'Startplatz',targetName:choice.target.n,distanceNm:42},missionPlan:{plan:{}},weather:{dest:{raw:{windKts:7}}}};}
async function choicesFor(c){return c.buildMissionProposalAptChoices({start,dispatchProfileId:'private_outing',selectedAptCategory:'private',aiModeEnabled:true,searchMin:10,searchMax:50});}

test('actual private picker makes one batch call, no catalogue/history writes; selection makes only the writer call',async()=>{
 const {c,requests,regions,localStorage,data}=sandbox();
 const choices=await choicesFor(c);
 assert.equal(choices.length,3);assert.equal(requests.length,1);assert.equal(regions.length,3);assert.equal(data.size,0);
 const choice=clone(c.normalizeMissionProposalChoice(choices[1])); // survives UI normalization/JSON transport
 assert.equal(choice.description,choice.privateProposal.idea.occasion);
 assert.equal(c.compactMissionProposalChoice(choice).privateProposal,undefined);
 const contract=c.applyMissionProposalChoiceToMissionContractV4(currentContract(choice),choice);
 // New context can reorder facts. The selected evidence must retain its meaning and original IDs.
 contract.knowledgeContext={status:'accept',facts:[{kind:'place',name:'OTHER PLACE',lat:48,lon:8}]};
 const mission=await c.fetchPrivateOutingStory({missionContractV4:contract});
 assert.equal(requests.length,2);assert.equal(mission._missionWriterV4Debug.ideaSource,'private-picker');
 assert.equal(mission.privateOuting.occasion,choice.privateProposal.idea.occasion);
 assert.deepEqual(clone(mission.privateOuting.companion),choice.privateProposal.idea.companion);
 assert.equal(mission.cargo,choice.cargoText);assert.equal(mission.privateOuting.groundPlan.place.name,'Wald Platz 2');
 assert.equal(mission.privateOuting.flightBriefing,'Die Strecke misst 42 NM.');
 assert.ok(requests[1].prompt.includes('"windKts":7'));
 assert.ok(!requests[1].prompt.includes('OTHER PLACE'));
 assert.equal(contract.privateProposal,undefined);assert.equal(data.size,0);
 assert.equal(c.classifyAptMissionCategory(mission),'private');
 assert.strictEqual(c.personalizeAptCharterMission(mission),mission);
 assert.equal(mission.passenger.taskDomain,'private_outing');
 assert.ok(core.remember(localStorage,{...mission,missionId:'selected'}));
 assert.equal(core.history(localStorage).length,1);assert.equal(core.history(localStorage)[0].target,'Platz 2');
 assert.ok(!JSON.stringify(core.history(localStorage)).includes('Platz 1'));
});

test('changed start/target or broken selected idea fails before any replacement model call',async()=>{
 const {c,requests}=sandbox();const choices=await choicesFor(c);const selected=choices[0];
 for(const alter of [c=>c.target.lat+=0.1,c=>c.target.name='Other',c=>c.route.startIcao='OTHER',c=>c.privateProposal.idea.factIds=['bad']]){
  const contract=c.applyMissionProposalChoiceToMissionContractV4(currentContract(selected),clone(selected));alter(contract);
  await assert.rejects(()=>c.fetchPrivateOutingStory({missionContractV4:contract}),/passt nicht mehr/);
 }
 assert.equal(requests.length,1);
 c.localStorage.setItem(core.MODE_KEY,'v5');
 await assert.rejects(()=>c.fetchPrivateOutingStory({missionContractV4:c.applyMissionProposalChoiceToMissionContractV4(currentContract(selected),selected)}),/benötigt Privat-Writer V6/);
 assert.equal(requests.length,1);
});

test('batch rejects missing/duplicate candidates, cross-target ideas and invalid local evidence as a whole',async()=>{
 const {c,requests}=sandbox();await choicesFor(c);
 const inputs=JSON.parse(requests[0].prompt.match(/^RAHMEN: (.*)$/m)[1]);
 const candidates=inputs.map(input=>({id:input.candidateId,input}));
 const good={proposals:inputs.map(input=>({candidateId:input.candidateId,title:'Ausflug',idea:rawIdea(input.targetName)}))};
 assert.equal(core.proposals(good,candidates).length,3);
 for(const alter of [r=>r.proposals.pop(),r=>r.proposals[1].candidateId=r.proposals[0].candidateId,r=>r.proposals[0].idea.targetName='Other',r=>r.proposals[0].idea.factIds=['f999']]){
  const bad=clone(good);alter(bad);assert.equal(core.proposals(bad,candidates),null);
 }
 c.fetchGeminiJsonWithFallback=async()=>({parsed:{proposals:[]}});
 await assert.rejects(()=>choicesFor(c),/nicht vollständig/);
 assert.equal(core.history(c.localStorage).length,0);
});

test('picker compares existing draft history without storing previews or sending prose examples',async()=>{
 const {c,requests,localStorage,data}=sandbox();
 const previous={id:'earlier',name:'HISTORY_NAME',relationship:'Freund',target:'Alter Platz',memory:{...rawWriter().memory,
  relationshipDynamic:'HISTORY_INTERACTION',summary:'SUMMARY_NOT_A_PROMPT_EXAMPLE',distinctivePhrase:'PHRASE_NOT_A_PROMPT_EXAMPLE'}};
 localStorage.setItem(core.HISTORY_KEY,JSON.stringify([previous]));
 const before=data.get(core.HISTORY_KEY);
 const choices=await choicesFor(c);
 assert.equal(data.get(core.HISTORY_KEY),before);
 const prompt=requests[0].prompt;
 assert.ok(prompt.includes('HISTORY_NAME'));assert.ok(prompt.includes('HISTORY_INTERACTION'));
 assert.ok(!prompt.includes('SUMMARY_NOT_A_PROMPT_EXAMPLE'));assert.ok(!prompt.includes('PHRASE_NOT_A_PROMPT_EXAMPLE'));
 assert.ok(!JSON.stringify(choices).includes('HISTORY_NAME'));
});

test('legacy classification remains unchanged while the structured private contract wins over prose keywords',()=>{
 const {c}=sandbox();
 for(const story of ['Ihr erkundet die Alb.','Ihr wollt die Aussicht genießen.','Ihr redet über den Transport.']){
  assert.equal(c.classifyAptMissionCategory({s:story,privateOuting:{schema:'private-outing.v1',taskDomain:'private_outing'}}),'private');
 }
 assert.equal(c.classifyAptMissionCategory({s:'Ihr erkundet die Alb.'}),'charter'); // documents the legacy substring cause
 assert.equal(c.classifyAptMissionCategory({s:'Business charter'}),'charter');
 assert.equal(c.classifyAptMissionCategory({s:'Fracht abliefern'}),'cargo');
});
