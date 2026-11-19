'use strict';
// Phase 4 of the English translation: writers on the idea path write in the UI language.
// German UI (or no i18n) must send every prompt unchanged.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');

function load(language) {
  const context = { console };
  context.globalThis = context;
  context.window = context;
  if (language) context.GAI18n = { getLanguage: () => language };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(root, 'mission-output-language.js'), 'utf8'), context);
  return context.MissionOutputLanguage;
}

const prompt = 'Schreibe ein Briefing. Antworte als JSON {"title","story"}.';
assert.equal(load(null).wrap(prompt), prompt, 'no i18n: unchanged');
assert.equal(load('de').wrap(prompt), prompt, 'German: unchanged');
assert.equal(load('de').directive(), '');
const english = load('en');
assert.equal(english.language(), 'en');
assert.equal(english.wrap(prompt), prompt + english.DIRECTIVE, 'English: directive appended');
assert.match(english.DIRECTIVE, /OUTPUT LANGUAGE: English/);
assert.match(english.DIRECTIVE, /niedrig\|mittel\|hoch/, 'fixed German choice values stay');

// Every idea/briefing browser sends its prompts through the wrapper (ground composer excluded:
// it plans scene objects, no pilot-facing text).
const browsers = fs.readdirSync(root).filter(name => /^mission-.*-browser\.js$/.test(name) && name !== 'mission-ground-composer-browser.js');
let wrapped = 0;
for (const name of browsers) {
  const source = fs.readFileSync(path.join(root, name), 'utf8');
  if (!/fetchGeminiJsonWithFallback\(/.test(source)) continue;
  assert.ok(!/fetchGeminiJsonWithFallback\(prompt,/.test(source), name + ' sends an unwrapped writer prompt');
  wrapped++;
}
assert.ok(wrapped >= 18, 'all idea/briefing browsers checked: ' + wrapped);

// app.js: training writer and Bush V5 writer use the wrapping fetch; the English-leak check is off in English.
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const training = app.slice(app.indexOf('async function fetchTrainingCoaching('), app.indexOf('async function fetchMissionWriterV4('));
assert.equal((training.match(/fetchGeminiJsonWithFallback\(/g) || []).length, (training.match(/fetchGeminiJsonWithFallback\(_missionOutputPrompt\(/g) || []).length, 'every training writer call is wrapped');
assert.match(app, /const writerLanguage = context\.missionType === 'bush' \? _missionOutputPrompt : \(text => text\);/);
assert.match(app, /function _missionPipelineV4LooksEnglish\(text = ''\) \{\n {4}\/\/ With English output[^\n]*\n {4}if \(window\.MissionOutputLanguage\?\.language\?\.\(\) === 'en'\) return false;/);

console.log('mission output language: ok (' + wrapped + ' browsers)');

// Step 3: fixed building blocks follow the output language; German stays as before.
function appFunctions(language) {
  const context = { console, globalThis: null };
  context.globalThis = context; context.window = context;
  if (language) context.GAI18n = { getLanguage: () => language };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(root, 'mission-output-language.js'), 'utf8'), context);
  const take = name => { const a = app.indexOf('function ' + name + '('); const b = app.indexOf('\nfunction ', a + 1); return app.slice(a, b); };
  const constBlock = name => { const a = app.indexOf('const ' + name + ' = '); const b = app.indexOf('\n];', a); return app.slice(a, b + 3); };
  vm.runInContext(['_missionPipelineV4PolishGermanVisibleText', '_missionBriefingText', '_missionBriefingEnglish', '_missionBriefingArrivalHint',
    '_missionBriefingCleanRouteLabel', '_missionBriefingPublicIcao', '_missionBriefingRoutePointLabel', '_missionBriefingFormatDistanceNm',
    '_missionBriefingRouteWaypointLabels', 'buildMissionBriefingRouteInfoLine'].map(take).join('\n'), context);
  return context;
}
const routeData = { start: 'EDTF', dest: 'LOIJ', dist: 120.4 };
assert.equal(appFunctions('de').buildMissionBriefingRouteInfoLine(routeData), 'Strecke: EDTF -> LOIJ, ca. 120 NM.');
assert.equal(appFunctions(null).buildMissionBriefingRouteInfoLine(routeData), 'Strecke: EDTF -> LOIJ, ca. 120 NM.');
assert.equal(appFunctions('en').buildMissionBriefingRouteInfoLine(routeData), 'Route: EDTF -> LOIJ, approx. 120 NM.');
const hint = 'Am Ziel wartet die Frachtuebergabe an einem sicheren Vorfeld- oder Parkingbereich.';
assert.equal(appFunctions('en')._missionBriefingArrivalHint(hint), 'The cargo handover waits at a safe apron or parking area at the destination.');
assert.equal(appFunctions('en')._missionBriefingArrivalHint('The hangar team takes over.'), 'The hangar team takes over.');
assert.equal(appFunctions('de')._missionBriefingArrivalHint(hint), appFunctions(null)._missionPipelineV4PolishGermanVisibleText(hint));

// Weather paragraph and idea-core building blocks.
const v6Path = path.join(root, 'mission-private-episode-v6.js');
const flight = { startName: 'EDTF', targetName: 'LOIJ', distanceNm: 120.5, weather: [{ scope: 'departure', station: 'EDTF', stationDistanceNm: 0.4,
  observedAt: '2026-11-19T09:20:00Z', freshness: 'recent', windKts: 8, windDeg: 240, gustKts: 15, visibilityKm: 9.5, ceilingFtAgl: 2800 }] };
delete require.cache[v6Path]; delete globalThis.GAI18n;
const germanWeather = require(v6Path).weatherFallback(flight, {});
assert.match(germanWeather, /^Start – EDTF, 0,4 NM vom Bezugspunkt \(Meldung vom 19\.11\.2026, 09:20 UTC\): Wind 8 kt aus 240°/);
assert.equal(require(v6Path).flightBindings(flight)['start.ceiling'], '2800 Fuß über Grund');
globalThis.GAI18n = { getLanguage: () => 'en' };
assert.match(require(v6Path).weatherFallback(flight, {}), /^Departure – EDTF, 0\.4 NM from the reference point \(report of 19 Nov 2026, 09:20 UTC\): wind 8 kt from 240°/);
assert.equal(require(v6Path).flightBindings(flight)['start.ceiling'], '2800 ft AGL');
delete globalThis.GAI18n;

console.log('mission output language step 3: ok');


// Generation errors are shown right away, so they follow the UI language; German stays word for word.
function errorFunctions(language) {
  const context = appFunctions(language);
  context.getAircraftPresetData = () => ({ name: 'C172' });
  const take = name => { const a = app.indexOf('function ' + name + '('); const b = app.indexOf('\nfunction ', a + 1); return app.slice(a, b); };
  vm.runInContext(['formatAiJsonFailure', 'createAiJsonFailure', 'aircraftAutoMissionProfileError', 'missionPassengerCapacityError'].map(take).join('\n'), context);
  return context;
}
const quota = { attempts: [{ status: 'http_429', quotaPeriod: 'day', quotaKind: 'tokens' }] };
const germanQuota = 'Der Frachtauftrag konnte nicht erstellt werden. Dein Tokenlimit für heute ist erreicht. Bitte versuche es morgen erneut oder wechsle auf einen bezahlten API-Plan beim KI-Anbieter. [HTTP 429]';
assert.equal(errorFunctions('de').formatAiJsonFailure(quota, 'Der Frachtauftrag'), germanQuota);
assert.equal(errorFunctions(null).formatAiJsonFailure(quota, 'Der Frachtauftrag'), germanQuota);
assert.equal(errorFunctions('en').formatAiJsonFailure(quota, 'Der Frachtauftrag'), 'The cargo mission could not be created. Your token limit for today has been reached. Please try again tomorrow or switch to a paid API plan with the AI provider. [HTTP 429]');
assert.equal(errorFunctions('en').formatAiJsonFailure({}, 'Unbekannt'), 'The mission could not be created. The AI returned no usable answer. Please try again.');
const seatsArgs = { capability: { name: 'Cub', totalSeats: 1 }, category: 'cargo' };
assert.equal(errorFunctions('de').missionPassengerCapacityError(seatsArgs).message, 'Cub hat mit 1 Sitz keinen freien Passagierplatz. Kategorie „cargo“ benötigt mindestens eine Person an Bord. Wähle eine 0-PAX-Mission oder ein Preset mit mindestens zwei Sitzen.');
assert.equal(errorFunctions('en').missionPassengerCapacityError(seatsArgs).message, 'Cub has 1 seat and no free passenger seat. Category "cargo" needs at least one person on board. Pick a 0-PAX mission or a preset with at least two seats.');
assert.equal(errorFunctions('de').aircraftAutoMissionProfileError({ baseType: 'bush', preset: { name: 'Cub' } }).message, 'Im Preset „Cub“ ist kein passendes Einsatzprofil aktiviert. Aktiviere für Bush-Auto Bush / STOL, Cargo oder Utility / Arbeit oder wähle im Mission Picker ein konkretes Profil.');
assert.equal(errorFunctions('en').aircraftAutoMissionProfileError({ baseType: 'bush', preset: { name: 'Cub' } }).message, 'No matching mission profile is enabled in the preset "Cub". Enable Bush / STOL, Cargo or Utility / Work for Bush auto, or pick a specific profile in the Mission Picker.');
// Every label a browser passes has an English name.
const labels = new Set();
for (const name of fs.readdirSync(root).filter(n => n.endsWith('.js'))) for (const m of fs.readFileSync(path.join(root, name), 'utf8').matchAll(/(?:create|format)AiJsonFailure\([^,()]+, *'([^']+)'/g)) labels.add(m[1]);
const enLabels = errorFunctions('en');
for (const label of labels) assert.doesNotMatch(enLabels.formatAiJsonFailure({}, label), /^The mission could not/, 'label without English name: ' + label);
console.log('mission output language errors: ok (' + labels.size + ' labels)');

// Dispatch status line: every generation phase label has an English phrase (translated on display).
const i18n = { console }; i18n.globalThis = i18n; i18n.window = i18n; vm.createContext(i18n);
for (const f of ['i18n-core.js', 'i18n/de.js', 'i18n/en.js', 'i18n/en-phrases.js']) vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), i18n);
i18n.GAI18n.setLanguage('en');
const phaseBlock = app.slice(app.indexOf('const MISSION_GENERATION_PROGRESS_PHASES = ['), app.indexOf('function getMissionGenerationPhaseMeta('));
const phaseLabels = [...phaseBlock.matchAll(/(?:label|doneLabel): '([^']+)'/g)].map(m => m[1]);
assert.ok(phaseLabels.length > 60);
for (const label of phaseLabels) assert.notEqual(i18n.GAI18n.phrase(label), label, 'phase label without English phrase: ' + label);
assert.match(app, /function _installAppStatusLineTranslation\(\)/);
console.log('mission output language status line: ok (' + phaseLabels.length + ' phase labels)');

// Language hint: missions are not translated afterwards; the briefing says so when languages differ.
assert.match(app, /outputLanguage: aiModeEnabled && window\.MissionOutputLanguage\?\.language\?\.\(\) === 'en' \? 'en' : 'de',/);
assert.match(fs.readFileSync(path.join(root, 'sync.js'), 'utf8'), /'savedAt', 'outputLanguage',/, 'cloud compaction keeps the language');
assert.match(fs.readFileSync(path.join(root, 'index.html'), 'utf8'), /<p id="mLanguageHint" class="mission-language-hint" hidden><\/p>/);
{
  const take = name => { const a = app.indexOf('function ' + name + '('); const b = app.indexOf('\n}\n', a); return app.slice(a, b + 2); };
  const c = {}; vm.createContext(c);
  vm.runInContext('const _MISSION_LANGUAGE_FIELD_SINCE = 1795084000000;\n' + take('_missionTextLanguage') + '\nthis.f=_missionTextLanguage;', c);
  assert.equal(c.f({ outputLanguage: 'en' }), 'en');
  assert.equal(c.f({ generatedAt: 1790000000000 }), 'de', 'older missions are German');
  assert.equal(c.f({ generatedAt: 1796000000000 }), '', 'newer without field: unknown, no hint');
}
console.log('mission output language hint: ok');
