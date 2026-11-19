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

