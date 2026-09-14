const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
require('../mission-private-context-core.js');
const core = require('../mission-private-outing-core.js');
const source = fs.readFileSync(require.resolve('../app.js'), 'utf8');
const store = () => { const data = new Map(); return { getItem: k => data.get(k), setItem: (k,v) => data.set(k,v) }; };
const contract = () => ({ status: 'ready', profile: { id: 'private_outing', taskDomain: 'private_outing' }, target: { name: 'Backnang-Heiningen' }, route: { startName: 'Schramberg', targetName: 'Backnang-Heiningen' }, knowledgeContext: { status: 'accept', facts: ['Belegter Ortskontext'] }, missionPlan: { plan: { localFacts: ['Altes Wanderequipment (92 lbs)'] } } });
const idea = () => ({ groundPlan:{factId:null,intent:'Foto nachstellen',transferPlan:'Gemeinsam das Motiv suchen'}, eventVisit: null, targetName: 'Backnang-Heiningen', occasion: 'Du und Tarek wollt ein altes Familienfoto nachstellen.', personalReason: 'Tarek hat das Bild im Nachlass seines Onkels gefunden.', destinationConnection: 'Eine private Erinnerung verbindet ihn mit dem Ort.', firstStep: 'Ihr nehmt die Kamera mit in den Ort.', creativeBasis: {realAnchor:'Keine belegten Ortsmerkmale', fictionalPart:'Familienfoto und gemeinsame Vorgeschichte'}, pilotIntent: 'Hilft beim Finden der Perspektive', companionIntent: 'Will das Familienfoto nachstellen', factIds: [], storyIdentity: { activity: 'Foto nachstellen', motivation: 'Familienerinnerung', interaction: 'gemeinsam Perspektive finden' }, narrativePlan: { entryPoint: 'altes Foto', tone: 'neugierig', shape: 'Fund und Vorhaben' }, noveltyReason: 'Erster Entwurf', companion: { name: 'Tarek Mertens', relationship: 'alter Freund', personality: 'neugierig, trocken, herzlich', gender: 'male' }, luggage: { label: 'Kameratasche mit altem Foto', weightLbs: 9 } });
const written = { title: 'Dasselbe Bild, dreißig Jahre später', story: 'Tarek will mit dir ein altes Familienfoto nachstellen. Die Kamera liegt bereit, und nach dem Flug über die Alb sucht ihr das Motiv. Für den Rest des Tages habt ihr noch Zeit für einen Spaziergang.', greeting: {speaker:'companion',addressee:'pilot',text:'Das alte Bild habe ich eingepackt. Mal sehen, ob wir die Perspektive wiederfinden.'} };
function context(responses) {
  const prompts = [];
  const c = { window: { MissionPrivateOutingCore: core }, localStorage: store(), getSelectedAiApiKey: () => 'test', getSelectedAiProvider: () => 'gemini', fetchGeminiJsonWithFallback: async p => { prompts.push(p); return { parsed: responses.shift(), source: 'Gemini Test' }; }, console };
  vm.createContext(c);
  for (const name of ['fetchPrivateOutingStory','_sanitizePrivateOutingNarrative','applyMissionTaskProfileToMission','missionMatchesTaskProfile','compactMissionObjectForQuotaStorage']) {
    const start = source.indexOf((name === 'fetchPrivateOutingStory' ? 'async ' : '') + 'function ' + name + '(');
    vm.runInContext(source.slice(start, source.indexOf('\n}', start)+2), c);
  }
  return { c, prompts };
}
test('untrusted or unavailable geography is not provided as evidence; fact references are checked', () => {
  const input = core.frame(contract());
  assert.equal(core.frame({ ...contract(), knowledgeContext: { status: 'review', facts: ['unsicher'] } }).facts.length,0);
  assert.equal(core.validateIdea({ ...idea(), factIds: ['invented'] }, input),null);
  assert.equal(core.validateIdea({ ...idea(), targetName: 'Other' }, input),null);
  assert.equal(core.validateIdea({ ...idea(), luggage: {label:'Kamera',weightLbs:Infinity} }, input),null);
  assert.ok(core.validateIdea(idea(), input));
});
test('history survives reload, is bounded, deduplicated and contains motives, names and openings', () => {
  const storage = store(); const privateOuting = core.validateIdea(idea(),core.frame(contract()));
  for(let i=0;i<15;i++) core.remember(storage,{missionId:String(i),privateOuting,missionStory:written.story});
  assert.equal(core.history(storage).length,12);
  assert.equal(core.history(storage)[0].id,'3');
  core.remember(storage,{missionId:'14',privateOuting,missionStory:written.story});
  assert.equal(core.history(storage).length,12);
  assert.equal(core.history(storage).at(-1).name,'Tarek Mertens');
  assert.ok(core.ideaPrompt(core.frame(contract(),core.history(storage))).includes('Familienfoto'));
  assert.equal(core.remember({getItem(){throw Error();},setItem(){throw Error();}},{privateOuting}),false);
});
test('API idea stays authoritative through writer, profile, sanitizer and compact save', async () => {
  const {c,prompts} = context([idea(),written]); const cfg = contract();
  const m = await c.fetchPrivateOutingStory({missionContractV4:cfg});
  assert.equal(m.s,written.story); // Original regression words must not erase the story.
  assert.equal(m.t,written.title);
  assert.equal(m.passenger.greetingText,written.greeting.text);
  assert.equal(m.passenger.name,'Tarek Mertens');
  assert.equal(m.cargo,'Kameratasche mit altem Foto (9 lbs)');
  assert.equal(cfg.storyFrame.trigger,idea().occasion);
  assert.deepEqual(cfg.missionPlan.plan.localFacts,[]);
  assert.equal(c._sanitizePrivateOutingNarrative(m).s,written.story);
  assert.equal(c.applyMissionTaskProfileToMission(m,false,'private_outing','old','old').mission.s,written.story);
  assert.equal(c.missionMatchesTaskProfile(m,'private_outing',false),true);
  assert.equal(c.compactMissionObjectForQuotaStorage(m).privateOuting.schema,core.VERSION);
  assert.equal(prompts.length,2);
  assert.ok(prompts[1].includes('Tarek Mertens'));
});
test('prose outage preserves chosen idea; invalid idea stops instead of drawing a stock mission', async () => {
  const {c} = context([idea(),null]); const m = await c.fetchPrivateOutingStory({missionContractV4:contract()});
  assert.equal(m.s,idea().occasion+' '+idea().personalReason);
  assert.equal(m._missionWriterV4Debug.writerAccepted,false);
  const failed = context([{}]);
  await assert.rejects(failed.c.fetchPrivateOutingStory({missionContractV4:contract()}));
  assert.equal(failed.prompts.length,1);
});
test('writer formatting rejects visible structured output, not ordinary phrasing', () => {
  assert.ok(core.prose(written));
  assert.equal(core.prose({...written,story:'{"mission":"story"}'}),null);
});
test('voice continues the structured idea instead of inventing a pickup or another leisure activity', () => {
  const privateOuting = core.validateIdea(idea(),core.frame(contract()));
  const c = {window:{currentMissionData:{privateOuting}},}; vm.createContext(c);
  const src=fs.readFileSync(require.resolve('../passenger-voice.js'),'utf8');
  for(const name of ['_privateReturnVoiceContext','_privateReturnNarrativeHint','_privateOutingStoryContext','_aptArrivalContextLine','_aptArrivalApproachHint','_aptArrivalAfterLandingHint','_aptArrivalFarewellHint']) {
    const start=src.indexOf('function '+name+'(');vm.runInContext(src.slice(start,src.indexOf('\n}',start)+2),c);
  }
  assert.ok(c._aptArrivalContextLine().includes(privateOuting.personalReason));
  for(const name of ['_aptArrivalApproachHint','_aptArrivalAfterLandingHint','_aptArrivalFarewellHint']) {
    const hint=c[name]();assert.ok(hint.includes(privateOuting.firstStep));assert.ok(!hint.includes('Abholfahrzeug'));
  }
});
test('legacy history upgrades without losing recent ideas and strict byte bound includes JSON escaping', () => {
  let raw=JSON.stringify([{id:'old',occasion:'Familienfoto',name:'Tarek',unrelated:'discard'}]);
  const storage={getItem:()=>raw,setItem:(_,value)=>raw=value};
  assert.equal(core.history(storage)[0].occasion,'Familienfoto');
  assert.equal(core.history(storage)[0].activity,'');
  assert.equal(core.history(storage)[0].unrelated,undefined);
  const sample=core.validateIdea(idea(),core.frame(contract()));
  for(let i=0;i<30;i++) core.remember(storage,{missionId:String(i),privateOuting:{...sample,occasion:'\u0000'.repeat(3000),personalReason:'\u0000'.repeat(3000)},missionStory:'\u0000'.repeat(3000)});
  assert.ok(raw.length*2<=core.HISTORY_MAX_BYTES);
  assert.ok(core.history(storage).length<=12);
  assert.equal(core.history(storage).at(-1).id,'29');
});
test('semantic memory describes motivation and structure; weather is not an idea seed', () => {
  const input=core.frame({...contract(),weather:{summary:'TEST_WEATHER'}});
  assert.ok(!core.ideaPrompt(input).includes('TEST_WEATHER'));
  assert.ok(core.writerPrompt(core.validateIdea(idea(),input),input).includes('TEST_WEATHER'));
  assert.equal(core.validateIdea({...idea(),storyIdentity:undefined},input),null);
  assert.equal(core.prose({...written,greeting:{speaker:'dispatcher',addressee:'companion',text:'Viel Erfolg, Tarek'}}),null);
  const storage=store();const privateOuting=core.validateIdea(idea(),input);
  core.remember(storage,{missionId:'one',privateOuting,missionStory:written.story});
  assert.equal(core.history(storage)[0].motivation,'Familienerinnerung');
  assert.equal(core.history(storage)[0].shape,'Fund und Vorhaben');
  assert.ok(core.history(storage)[0].ending.includes('Spaziergang'));
});
test('deliberately fictional local occasion survives the full story handoff without prose classification', async () => {
  const fictional = { ...idea(), occasion: 'Du und Tarek nehmt an einem erfundenen kleinen Fotowettbewerb teil.',
    creativeBasis: {realAnchor:'Zielort aus dem Flugrahmen', fictionalPart:'Der Fotowettbewerb und sein Sonderpreis sind erfunden.'} };
  const {c,prompts} = context([fictional,written]);
  const m = await c.fetchPrivateOutingStory({missionContractV4:contract()});
  assert.equal(m.privateOuting.creativeBasis.fictionalPart, fictional.creativeBasis.fictionalPart);
  assert.equal(m.passenger.privateOuting.occasion,fictional.occasion);
  assert.ok(prompts[1].includes(fictional.creativeBasis.fictionalPart));
  assert.equal(c.compactMissionObjectForQuotaStorage(m).privateOuting.creativeBasis.realAnchor,fictional.creativeBasis.realAnchor);
  assert.equal(core.validateIdea({...fictional,creativeBasis:undefined},core.frame(contract())),null);
});
test('explicit event date and source remain context data; absence does not assume today', () => {
  const input=core.frame({...contract(),missionDate:'2026-09-15',knowledgeContext:{status:'accept',facts:[{text:'Konzert',source:'https://example.org/event',eventDate:'2026-09-15'}]}});
  assert.equal(input.missionDate,'2026-09-15');
  assert.equal(input.facts[0].value.source,'https://example.org/event');
  assert.equal(core.frame(contract()).missionDate,null);
  const chosen=core.validateIdea({...idea(),factIds:['f1']},input);
  assert.ok(core.writerPrompt(chosen,input).includes('2026-09-15'));
});
test('sourced weekly event can follow arrival, retaining its date and overnight plan', () => {
  const c={...contract(),missionDate:'2026-09-14',knowledgeContext:{status:'accept',facts:[{kind:'event',text:'Konzert am Samstag',source:'https://example.org/event',eventDate:'2026-09-19'}]}};
  const input=core.frame(c);
  assert.deepEqual(input.eventWindow,{arrivalDate:'2026-09-14',throughDate:'2026-09-20'});
  const raw={...idea(),factIds:['f1'],eventVisit:{factId:'f1',eventDate:'2026-09-19',stayPlan:'Ihr bleibt mehrere Nächte bis zum Konzert am Samstag.'}};
  const chosen=core.validateIdea(raw,input);
  assert.equal(chosen.eventVisit.arrivalDate,'2026-09-14');
  assert.equal(chosen.eventVisit.eventDate,'2026-09-19');
  assert.ok(core.writerPrompt(chosen,input).includes(raw.eventVisit.stayPlan));
  for(const eventDate of ['2026-09-13','2026-09-21','2026-02-30']) {
    const changed=core.frame({...c,knowledgeContext:{status:'accept',facts:[{...c.knowledgeContext.facts[0],eventDate}]}});
    assert.equal(core.validateIdea({...raw,eventVisit:{...raw.eventVisit,eventDate}},changed),null);
  }
  assert.equal(core.validateIdea({...raw,eventVisit:{...raw.eventVisit,eventDate:'2026-09-14'}},input),null);
  assert.equal(core.validateIdea({...raw,eventVisit:{...raw.eventVisit,stayPlan:''}},input),null);
  assert.equal(core.validateIdea(raw,core.frame({...c,missionDate:undefined})),null);
  assert.deepEqual(core.eventWindowFor('2026-09-20'),{arrivalDate:'2026-09-20',throughDate:'2026-09-20'});
  assert.deepEqual(core.eventWindowFor('2026-12-31'),{arrivalDate:'2026-12-31',throughDate:'2027-01-03'});
  assert.equal(core.eventWindowFor('2026-09-14invalid'),null);
});
