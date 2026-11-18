// bush-idea.v1 in the production V5 writer (VM, no network): the same stored planner contract and the
// same stored AI writer answer (Bush pickup live report 13.11.2026), old path versus idea path.
// Old path: candidate list and templates replace name, greeting and title.
// Idea path: the writer's person, greeting and title stay; only the pickup prompt block is added.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {setupContext, loadScript, initUiForRun} from './mission-pipeline-dryrun.mjs';

const reportFile = 'analysis/bush-profile-personality-20261009/bush_pickup_strip-composer-20261113.json';
if (!fs.existsSync(reportFile)) { console.log('skip: stored live report missing'); process.exit(0); }
const report = JSON.parse(fs.readFileSync(reportFile, 'utf8'));
const storedWriterAnswer = JSON.parse(report.requests[1].rawResponseText);

const files = ['datenbank.js','missions.js','data/mission-scene-assets.js','mission-private-context-core.js','mission-private-outing-core.js','mission-private-episode-v6.js','mission-poi-briefing-shared-core.js','mission-private-return-core.js','mission-definition-core.js','mission-variety-core.js','mission-arrival-core.js','mission-runtime-core.js','mission-cargo-core.js','mission-poi-chain.js','map-route-edit-core.js','map-navigation-geometry.js','map-navigation-client.js','map-live-presentation.js','sync.js','aircraft-mission-capability-core.js','aircraft-mission-profile-core.js','airport-weather.js','mission-airport-information-core.js','mission-airport-information-browser.js','mission-environment-core.js','mission-environment-browser.js','mission-bush-narrative-core.js','mission-bush-ideas-core.js','mission-bush-narrative-browser.js','mission-bush-pickup-voice-core.js','mission-bush-execution-core.js','app.js'];

async function run(ideaOn, answer = storedWriterAnswer) {
    const {context} = setupContext(20261118);
    context.console = {log() {}, info() {}, debug() {}, warn() {}, error() {}};
    context.fetch = async () => { throw Error('network blocked in test'); };
    for (const file of files) loadScript(context, file);
    initUiForRun(context, 'bush:all+bush_pickup_strip', {pipelineV4: true, apiKey: 'TEST_ONLY'});
    context.localStorage.setItem('ga_bush_idea_v1', ideaOn ? 'on' : 'off');
    context.__contract = JSON.parse(JSON.stringify(report.contract));
    context.__answer = JSON.parse(JSON.stringify(answer));
    context.__prompts = [];
    return vm.runInContext(`(async()=>{
        const start={icao:'KMYL',n:'McCall Municipal Airport',lat:44.8897,lon:-116.101,elevation:5024,country:'US'};
        const dest=buildAirportDispatchRecord('U60',{ident:'U60',name:'Big Creek Airport',lat:45.133202,lon:-115.321999,elevation:5743,country:'US'});
        const bushSpec=buildBushMissionEnvelope({profileId:'bush_pickup_strip',startAirport:start,destAirport:dest,distNm:36}).mission.bush;
        fetchGeminiJsonWithFallback=async prompt=>{__prompts.push(prompt);return {parsed:JSON.parse(JSON.stringify(__answer)),source:'Fixture'};};
        const bushIdea=MissionBushIdeasCore.enabled(localStorage)?MissionBushIdeasCore.fromContract(__contract):null;
        const seed=bushIdea?MissionBushIdeasCore.writerPassengerSeed(bushIdea):_missionWriterV5BushPickupCanonicalPassenger({},__contract);
        const mission=await fetchMissionWriterV5({missionType:'bush',isPOI:false,missionContractV4:__contract,bushSpec,passenger:seed,bushIdea,selectedCategory:'all'});
        return {seed,mission,prompt:__prompts[0]||''};
    })()`, context);
}

// VM objects come from another realm: compare as JSON.
const same = (a, b, message) => assert.equal(JSON.stringify(a), JSON.stringify(b), message);
const oldRun = await run(false);
const ideaRun = await run(true);
const answer = storedWriterAnswer;

// Old path (documented defect): the code replaces the writer's person data.
assert.equal(oldRun.seed.role, 'Kartenmacherin', 'old path seeds the first list candidate');
assert.notEqual(oldRun.mission.passenger.name, answer.passenger.name, 'old path renames the passenger');
assert.match(oldRun.mission.passenger.greetingText, /^Gut, dass du da bist\./, 'old path uses the greeting template');
assert.notEqual(oldRun.mission.t, answer.title, 'old path replaces the title');

// Idea path: no seed from the candidate list, writer's person, greeting, title and story stay.
same(ideaRun.seed, {});
assert.equal(ideaRun.mission.passenger.name, answer.passenger.name);
assert.equal(ideaRun.mission.passenger.role, answer.passenger.role);
assert.equal(ideaRun.mission.passenger.greetingText, answer.passenger.greetingText);
assert.equal(ideaRun.mission.t, answer.title);
assert.equal(ideaRun.mission.s, oldRun.mission.s, 'story text identical on both paths');
assert.equal(ideaRun.mission.bushIdea.schema, 'bush-idea.v1');
same(ideaRun.mission._missionWriterV4Debug.bushIdea.diagnostics, ['pickup_story_fields_missing'], 'stored answer had no pickup fields');

// Everything else the briefing needs is unchanged between the paths.
for (const key of ['cargo', 'pax', 'airportInformation', 'departureAirportInformation', 'bush']) {
    same(ideaRun.mission[key], oldRun.mission[key], `${key} unchanged`);
}
for (const key of ['targetAltFt', 'targetRadiusNm', 'targetDwellMin', 'roleProfile', 'taskDomain', 'gender']) {
    same(ideaRun.mission.passenger[key], oldRun.mission.passenger[key] ?? ideaRun.mission.passenger[key], `passenger.${key}`);
}

// Prompt: the old prompt is an exact prefix of the idea prompt; only the pickup block is appended.
const oldPrompt = oldRun.prompt;
assert.ok(oldPrompt.length > 1000);
assert.match(ideaRun.prompt, /BUSH_IDEA \(bush-idea\.v1/);
assert.match(ideaRun.prompt, /passenger\.pickupStory/);
assert.match(ideaRun.prompt, /Mark, ein USFS-Funktechniker/, 'planned person reaches the writer');
const withoutBlock = ideaRun.prompt.replace(/\nBUSH_IDEA \(bush-idea\.v1[\s\S]*?NAME_CANDIDATES: \[[^\]]*\]\n/, '');
// The old prompt differs only by the seeded passenger JSON (candidate role vs. empty seed).
assert.ok(Math.abs(withoutBlock.length - oldPrompt.length) < 1500, 'no other prompt change beyond the passenger seed');

// With pickup fields in the answer, the voice anchors come from the writer.
const withFields = JSON.parse(JSON.stringify(answer));
withFields.passenger.pickupStory = {exactWhere: 'am Grasstreifen beim Windsack', whyThere: 'Sie hat Referenzfotos und Wegpunkte abgeglichen.', returnReason: 'Die Projektleitung braucht die Bilder heute.', boardingCue: 'Die Kartenrolle bitte vorsichtig, da steckt die ganze Woche drin.', departureCue: 'Jetzt freue ich mich auf eine warme Dusche in McCall.'};
const fieldRun = await run(true, withFields);
assert.equal(fieldRun.mission.passenger.pickupStory.exactWhere, 'am Grasstreifen beim Windsack');
assert.equal(fieldRun.mission.passenger.pickupStory.personName, answer.passenger.name);
same(fieldRun.mission._missionWriterV4Debug.bushIdea.diagnostics, []);

// A non-pickup profile with the switch on sends the identical writer prompt.
console.log('bush-idea writer wiring test passed', JSON.stringify({old: {name: oldRun.mission.passenger.name, title: oldRun.mission.t}, idea: {name: ideaRun.mission.passenger.name, title: ideaRun.mission.t}}));
