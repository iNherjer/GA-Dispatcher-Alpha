const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
require('../mission-private-context-core.js');
const v5=require('../mission-private-outing-core.js');
const v6=require('../mission-private-episode-v6.js');
const storage=()=>{const m=new Map();return {getItem:k=>m.get(k),setItem:(k,v)=>m.set(k,v)}};
const contract=()=>({target:{name:'Testplatz'},route:{targetName:'Testplatz'},missionPlan:{plan:{}}});
const idea=()=>({targetName:'Testplatz',occasion:'Du und Ada wollt gemeinsam fliegen.',personalReason:'Ihr habt heute beide frei.',destinationConnection:'Ein kleiner Platz für die gemeinsame Pause.',firstStep:'Ihr bleibt noch am Platz.',pilotIntent:'Gemeinsam fliegen',companionIntent:'Zeit miteinander',episode:{situation:'Beide haben frei',sharedIntent:'Gemeinsame Zeit',flightRole:'Selbst das Erlebnis'},storyIdentity:{activity:'Fliegen',motivation:'gemeinsame Zeit',interaction:'beiläufig erzählen'},noveltyReason:'Kein Vorprogramm',factIds:[],groundPlan:{factId:null,intent:'Am Platz bleiben',transferPlan:'Zu Fuß am Platz'},eventVisit:null,creativeBasis:{realAnchor:'Zielflugplatz',fictionalPart:'Ada und gemeinsame Freizeit'},companion:{name:'Ada',relationship:'Freundin',personality:'fragt direkt',gender:'female'},luggage:{label:'Tagesrucksack',weightLbs:5}});
const memory=()=>({schema:'episode-memory.v1',summary:'Zwei freie Menschen teilen ihre Flugfreude.',activity:'Fliegen',motivation:'freie gemeinsame Zeit',flightRole:'Erlebnis',relationshipDynamic:'direkte Vertrautheit',opening:'Dialog über gemeinsame Zeit',rhythm:'kurz dann länger',ending:'offene Frage',distinctivePhrase:'„Und jetzt?“'});
const prose=()=>({title:'Ein freier Vormittag',story:'„Und jetzt?“ Ada klappt ihren Kalender zu. Ihr habt den ganzen Vormittag zum Fliegen.',greeting:{speaker:'companion',addressee:'pilot',text:'Endlich haben wir beide frei.'},memory:memory()});
function context(responses,store=storage()) {
 const prompts=[];const c={window:{MissionPrivateOutingCore:v5,MissionPrivateEpisodeV6:v6},localStorage:store,getSelectedAiApiKey:()=> 'test',getSelectedAiProvider:()=> 'gemini',fetchGeminiJsonWithFallback:async p=>{prompts.push(p);return {parsed:responses.shift(),source:'stub'}}};
 vm.createContext(c);const src=fs.readFileSync(require.resolve('../app.js'),'utf8');
 for(const name of ['fetchPrivateOutingStory','compactMissionObjectForQuotaStorage','_sanitizePrivateOutingNarrative']){const start=src.indexOf((name==='fetchPrivateOutingStory'?'async ':'')+'function '+name+'(');vm.runInContext(src.slice(start,src.indexOf('\n}',start)+2),c)}
 return {c,prompts,store};
}
test('V6 carries episode and AI memory through actual two-call production path, sanitizer and compact save',async()=>{
 const {c,prompts,store}=context([idea(),prose()]);const m=await c.fetchPrivateOutingStory({missionContractV4:contract()});
 assert.equal(prompts.length,2);assert.match(prompts[0],/^PRIVATE EPISODE V6/);assert.ok(!prompts[1].includes('narrativePlan'));
 assert.equal(m.privateOuting.writerVersion,'private-v6');assert.equal(m.privateOuting.narrativePlan,undefined);
 assert.deepEqual(m.privateOuting.writerMemory,memory());assert.equal(m.s,prose().story);
 assert.equal(c._sanitizePrivateOutingNarrative(m).s,m.s);
 assert.deepEqual(c.compactMissionObjectForQuotaStorage(m).privateOuting.writerMemory,memory());
 // Storage uses only the supplied summary; the actual story getter must never be read.
 assert.ok(v6.remember(store,{...m,missionId:'one',get missionStory(){throw Error('prose reconstruction')}}));
 assert.equal(v6.history(store)[0].memory.summary,memory().summary);
 assert.equal(v6.history(store)[0].name,'Ada');
 assert.match(v6.ideaPrompt(v6.frame(contract(),v6.recent(store))),/freie gemeinsame Zeit/);
});
test('V6.2.2 passes the current shared intent and individual wishes through the production writer handoff',async()=>{
 for(const sharedIntent of ['Gemeinsam einen freien Nachmittag am Platz verbringen','Zusammen einen alten Bekannten besuchen']){
  const raw={...idea(),episode:{...idea().episode,sharedIntent,situation:'PLANNER_SCENE_ONLY'}};
  const {c,prompts}=context([raw,prose()]);
  const m=await c.fetchPrivateOutingStory({missionContractV4:contract()});
  const outing=JSON.parse(prompts[1].split('\nIDEE: ')[1].split('\n')[0]);
  assert.equal(outing.sharedIntent,sharedIntent);
  assert.equal(outing.pilotIntent,raw.pilotIntent);
  assert.equal(outing.companionIntent,raw.companionIntent);
  assert.equal(outing.personalReason,raw.personalReason);
  assert.ok(!prompts[1].includes('PLANNER_SCENE_ONLY'));
  assert.equal(outing.episode,undefined);
  assert.equal(m.privateOuting.episode.sharedIntent,sharedIntent);
  assert.equal(c.compactMissionObjectForQuotaStorage(m).privateOuting.episode.sharedIntent,sharedIntent);
  assert.equal(m._missionWriterV4Debug.promptRevision,v6.PROMPT_REVISION);
  assert.equal(m.s,prose().story);
 }
});
test('missing or invalid memory preserves valid story; rejected prose cannot contribute its memory',async()=>{
 for(const raw of [{...prose(),memory:null},{...prose(),memory:{...memory(),motivation:null}}]){
  const {c,store}=context([idea(),raw]);const m=await c.fetchPrivateOutingStory({missionContractV4:contract()});
  assert.equal(m.s,prose().story);assert.equal(m.privateOuting.writerMemory,null);assert.equal(v6.remember(store,{...m,missionId:'x'}),false);
 }
 const {c}=context([idea(),{...prose(),story:'{"bad":"visible"}'}]);const m=await c.fetchPrivateOutingStory({missionContractV4:contract()});
 assert.equal(m.s,idea().occasion+' '+idea().personalReason);assert.equal(m.privateOuting.writerMemory,null);
});
test('bounded history survives reload and deduplicates without growing with full missions',()=>{
 const store=storage();const core=v6.validateIdea(idea(),v6.frame(contract()));
 for(let i=0;i<30;i++)assert.ok(v6.remember(store,{missionId:String(i),privateOuting:{...core,writerMemory:memory()}}));
 assert.equal(v6.history(store).length,12);assert.equal(v6.history(store)[0].id,'18');
 v6.remember(store,{missionId:'29',privateOuting:{...core,writerMemory:memory()}});assert.equal(v6.history(store).length,12);
 assert.equal(v6.memory({...memory(),summary:'x'.repeat(300)}).summary.length,240);
 const escaped=Object.fromEntries(Object.entries(memory()).map(([k,v])=>[k,k==='schema'?v:'\u0000'.repeat(80)]));
 for(let i=30;i<60;i++)v6.remember(store,{missionId:String(i),privateOuting:{...core,writerMemory:escaped}});
 assert.ok(store.getItem(v6.HISTORY_KEY).length*2<=v6.HISTORY_MAX_BYTES);assert.equal(v6.history(store).at(-1).id,'59');
 store.setItem(v6.HISTORY_KEY,'{"wrong":[]}');assert.deepEqual(v6.history(store),[]);
});
test('V5 remains selectable with original prompts and its own memory; legacy plan data is read without parsing prose',async()=>{
 const store=storage();store.setItem(v6.MODE_KEY,'v5');const raw={...idea(),narrativePlan:{entryPoint:'frei',tone:'ruhig',shape:'offen'}};
 const {c,prompts}=context([raw,prose()],store);const m=await c.fetchPrivateOutingStory({missionContractV4:contract()});
 assert.equal(m.privateOuting.writerVersion,undefined);assert.match(prompts[0],/^Entwickle eine originelle/);
 assert.ok(v5.remember(store,{...m,missionId:'old'}));const before=store.getItem(v5.HISTORY_KEY);
 assert.equal(v6.recent(store)[0].source,'legacy-plan');assert.equal(v6.recent(store)[0].activity,'Fliegen');
 assert.equal(store.getItem(v5.HISTORY_KEY),before);assert.equal(store.getItem(v6.HISTORY_KEY),undefined);
 store.setItem(v6.MODE_KEY,'v6');assert.equal(v6.mode(store),'v6');
});
test('V6 requires episode content, keeps geographical constraints and rejects invalid radius',()=>{
 const frame=v6.frame(contract());assert.equal(v6.validateIdea({...idea(),episode:null},frame),null);
 assert.equal(v6.validateIdea({...idea(),targetName:'Other'},frame),null);
 const grounded={...idea(),factIds:['f1'],groundPlan:{factId:'f1',intent:'Besuch',transferPlan:'weiterreisen'}};
 for(const radiusKm of [NaN,-1,Infinity])assert.equal(v6.validateIdea(grounded,{...frame,facts:[{id:'f1',value:{kind:'place',name:'Ort',lat:48,lon:8}}],region:{airport:{lat:48,lon:8},radiusKm}}),null);
});

test('known companion name resolves structurally without discarding prose; unknown speaker remains invalid',async()=>{
 const raw={...prose(),greeting:{...prose().greeting,speaker:'Ada'}};
 const {c}=context([idea(),raw]);const m=await c.fetchPrivateOutingStory({missionContractV4:contract()});
 assert.equal(m.s,raw.story);assert.equal(m.passenger.greetingText,raw.greeting.text);
 assert.deepEqual(m.privateOuting.writerMemory,memory());
 assert.equal(v6.prose({...raw,greeting:{...raw.greeting,speaker:'Someone else'}},idea()),null);
});
test('V6.1 separates idea history from prose and gives writer the outing instead of self-praising planner labels',()=>{
 const row={id:'old',name:'Ada',relationship:'Freundin',target:'Testplatz',memory:{...memory(),summary:'SUMMARY_MARKER',distinctivePhrase:'PHRASE_MARKER',opening:'OPENING_MARKER'}};
 const input=v6.frame(contract(),[row]);
 const p=v6.ideaPrompt(input);assert.ok(p.includes('freie gemeinsame Zeit'));assert.ok(!p.includes('OPENING_MARKER'));assert.ok(!p.includes('PHRASE_MARKER'));assert.ok(!p.includes('SUMMARY_MARKER'));
 const raw={...idea(),noveltyReason:'ORIGINALITY_MARKER',episode:{...idea().episode,situation:'SCENE_MARKER'}};
 const w=v6.writerPrompt(v6.validateIdea(raw,input),input);assert.ok(w.includes('OPENING_MARKER'));assert.ok(w.includes('PHRASE_MARKER'));assert.ok(!w.includes('ORIGINALITY_MARKER'));assert.ok(!w.includes('SCENE_MARKER'));
 assert.ok(w.includes(raw.personalReason));assert.ok(w.includes(raw.groundPlan.intent));
});

test('V6.2 flight context preserves station scope, units and unknown values without inventing route scenery',()=>{
 const c={...contract(),route:{startIcao:'AAAA',startName:'Start',targetIcao:'BBBB',targetName:'Testplatz',distanceNm:32},
  weather:{dep:{raw:{station:'CCCC',windDeg:225,windKts:3,visKm:10,raw:'METAR CCCC 140700Z 22503KT 9999 FEW040'}},dest:{raw:{windDeg:null,windKts:'3',visKm:Infinity}}},
  routeLandscape:[{text:'Unbelegtes Tal'},{text:'Routenbeleg',source:'fixture'}]};
 const f=v6.frame(c).flightContext;
 assert.equal(f.distanceNm,32);assert.equal(f.weather[0].station,'CCCC');assert.equal(f.weather[0].airportIcao,'AAAA');
 assert.equal(f.weather[0].cloudAmountOktas,null);assert.equal(f.weather[1].windDeg,null);assert.equal(f.weather[1].windKts,null);
 assert.equal(f.weather[1].visibilityKm,null);assert.deepEqual(f.landscape,[{text:'Routenbeleg',source:'fixture'}]);
 const p=v6.writerPrompt(v6.validateIdea(idea(),v6.frame(c)),v6.frame(c));assert.ok(p.includes('FLUGDATEN:'));assert.ok(!v6.ideaPrompt(v6.frame(c)).includes('CCCC'));
});
test('V6.2 keeps flight paragraph through production/save separately from creative memory and voice story',async()=>{
 const flightBriefing='Die direkte Strecke misst 32 NM. Bei der Wetterstation CCCC wird ein leichter Wind gemeldet.';
 const {c,store}=context([idea(),{...prose(),flightBriefing:flightBriefing.replace('32 NM','[[route.distance]]')}]);const m=await c.fetchPrivateOutingStory({missionContractV4:{...contract(),route:{targetName:'Testplatz',distanceNm:32}}});
 assert.equal(m.s,prose().story+'\n\n'+flightBriefing);assert.equal(m.passenger.storyHint,prose().story);
 assert.equal(m.privateOuting.flightBriefing,flightBriefing);assert.equal(c._sanitizePrivateOutingNarrative(m).s,m.s);
 assert.equal(c.compactMissionObjectForQuotaStorage(m).privateOuting.flightBriefing,flightBriefing);
 assert.ok(v6.remember(store,{...m,missionId:'flight'}));assert.ok(!JSON.stringify(v6.history(store)).includes('CCCC'));
 for(const invalid of [undefined,null,{},'x'.repeat(851),'```json {}']){
  const accepted=v6.prose({...prose(),flightBriefing:invalid},idea(),v6.frame(contract()));
  assert.equal(accepted.story,prose().story);assert.equal(accepted.flightBriefing,'');assert.equal(accepted.flightBriefingStatus,'unavailable');
 }
 // Legacy calls without flight context must not publish invented extra output.
 assert.equal(v6.prose({...prose(),flightBriefing},idea()).flightBriefing,'');
});

test('flight bindings retain supplied units and values; unresolved or handwritten numbers never replace the story',()=>{
 const f=v6.flightContext({route:{startName:'Start',targetName:'Ziel',distanceNm:28.4},weather:{dest:{raw:{windKts:12,gustKts:20,cloudAmountOktas:5,cloudBaseFtAgl:3000}}}});
 const template='Die direkte Strecke misst [[route.distance]]. Am Ziel weht Wind mit [[target.wind]], in Böen [[target.gust]], bei [[target.cloudAmount]] Bewölkung in [[target.cloudBase]].';
 assert.equal(v6.resolveFlightBriefing(template,f),'Die direkte Strecke misst 28,4 NM. Am Ziel weht Wind mit 12 Knoten, in Böen 20 Knoten, bei 5/8 Bewölkung in 3000 Fuß über Grund.');
 assert.equal(v6.resolveFlightBriefing('Bis [[route.target]] sind es [[route.distance]].',v6.flightContext({route:{targetName:'Platz 24',distanceNm:0}})),'Bis Platz 24 sind es 0 NM.');
 for(const broken of [template.replace('[[target.cloudAmount]]','50 %'),template.replace('[[target.gust]]','[[start.gust]]'),template.replace('[[route.distance]]','28 NM'),template.replace('[[target.gust]]','lebhaft')])assert.equal(v6.resolveFlightBriefing(broken,f),'');
 const result=v6.prose({...prose(),flightBriefing:template.replace('[[target.gust]]','[[unknown]]')},idea(),{flightContext:f});
 assert.equal(result.story,prose().story);assert.equal(result.flightBriefing,'');assert.deepEqual(result.memory,memory());
});

test('V6.3.1 keeps structured initiative in history and supplies actual phrases without clearing legacy memories',()=>{
 const raw={...idea(),origin:{initiative:'pilot',trigger:'Der Pilot hat einen freien Tag vorgeschlagen.'}};
 const validated=v6.validateIdea(raw,v6.frame(contract(),[]));assert.deepEqual(validated.origin,raw.origin);
 const data=new Map(),storage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)};
 assert.ok(v6.remember(storage,{missionId:'new',privateOuting:{...validated,writerMemory:memory()}}));
 const recent=v6.recent(storage),input=v6.frame(contract(),recent);
 assert.equal(recent[0].origin.initiative,'pilot');assert.equal(recent[0].personalReason,validated.personalReason);
 assert.equal(recent[0].pilotIntent,validated.pilotIntent);
 const planner=v6.ideaPrompt(input),writer=v6.writerPrompt(validated,input);
 assert.ok(planner.includes(raw.origin.trigger));assert.ok(writer.includes(raw.origin.trigger));
 assert.ok(writer.includes(memory().distinctivePhrase));
 assert.ok(v6.validateIdea(idea(),input),'existing selections without origin remain valid');
 assert.equal(v6.validateIdea({...raw,origin:{initiative:'random',trigger:'test'}},input),null);
 assert.equal(v6.history(storage).length,1);
});
