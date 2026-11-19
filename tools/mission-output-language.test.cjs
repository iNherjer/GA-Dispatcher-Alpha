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
