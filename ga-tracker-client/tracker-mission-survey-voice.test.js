'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const voice = require('../mission-poi-voice-core.js');
const { prepareEvent } = require('./tracker-mission-survey-voice.js');
function context(extra = {}) { return { schema: voice.CONTEXT_SCHEMA, version: 1, missionId: 'survey-voice-test', taskDomain: 'mapping_survey', strict: true, audioEnabled: true, baseContext: 'Originale Mapping-Persona.', passenger: { surveyPattern: true, targetAltFt: 3200 }, speaker: { name: 'Mara', taskDomain: 'mapping_survey' }, textModels: { gemini: ['gemini-3-flash-preview'] }, ttsModels: ['gemini-3.1-flash-tts-preview'], surveySpec: { type: 'scan', scan: { lines: [{ id: 'L1' }, { id: 'L2' }] } }, ...extra }; }
test('Survey event keeps original priority, fixed text and clip key', () => {
  const prepared = prepareEvent(context(), [{ type: 'line_complete' }, { type: 'survey_area_entered' }], null, 1700000000000);
  assert.equal(prepared.kind, 'survey_area_entered'); assert.equal(prepared.label, 'Survey-Fortschritt'); assert.equal(prepared.notBefore, 1700000000000);
  assert.equal(prepared.resolvedRecipe.prompt, ''); assert.equal(prepared.resolvedRecipe.fallbackText, 'Wir sind im Surveybereich. Such dir ein Linienende und flieg die erste Bahn sauber durch.'); assert.equal(prepared.resolvedRecipe.staticClipKey, 'scan_survey_area_entered');
  assert.deepEqual(prepared.resolvedRecipe.cue, { id: 'scan_start', variantSeed: '|survey_area_entered|Wir sind im Surveybereich. Such dir ein Linienende und flieg die erste Bahn sauber durch.|cue', gain: .38 });
  const complete = prepareEvent(context({ surveySpec: { type: 'orbit' } }), [{ type: 'orbit_turn_complete' }, { type: 'survey_complete' }]);
  assert.equal(complete.kind, 'survey_complete'); assert.equal(complete.resolvedRecipe.fallbackText, 'Das waren alle Kreise, der Survey ist komplett. Auftrag erfüllt, wir gehen zurück zum Heimatplatz.'); assert.equal(complete.resolvedRecipe.staticClipKey, 'orbit_survey_complete');
  assert.equal(complete.resolvedRecipe.cue.id, 'handoff');
});
test('Survey manual direct status and orientation retain original text', () => {
  const detector = { surveyProgress: { startedAt: 1, scan: { completedLineIds: ['L1'], active: { lineId: 'L2' }, activeCoverage: .5 } } };
  const sample = { lat: 48, lon: 8, altFt: 3200, mslFt: 3200, hdg: 90 }, target = { lat: 48.1, lon: 8.1 };
  assert.equal(voice.renderAction(context(), 'poi_status', detector, sample, target).fallbackText, 'Distanz zum Ziel 7.2 NM, Richtung 034 Grad. Survey-Scan 1/2 Linien gruen, L2 aktiv bei 50%. Status: Datenaufnahme laeuft. Hoehe im Band: 3200 ft bei Ziel 3200 ft.');
  assert.equal(voice.renderAction(context(), 'poi_orientation', detector, sample, target).fallbackText, 'Steuerkurs 034 Grad, Entfernung 7 NM. Das rote Scanmuster liegt schon auf der Karte. Such dir ein offenes Linienende, flieg die Nord-Sued-Bahn gerade ab und nimm danach die naechste offene Linie; erledigt sind 1 von 2.');
});
