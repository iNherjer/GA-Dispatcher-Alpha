import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import core from '../mission-poi-voice-core.js';
const frozen = fs.readFileSync(new URL('./fixtures/poi-voice-legacy-20260915.js', import.meta.url), 'utf8');
const knowledge = fs.readFileSync(new URL('./fixtures/poi-sightseeing-knowledge-legacy-20260916.js',import.meta.url),'utf8');
const app = fs.readFileSync(new URL('../passenger-voice.js', import.meta.url), 'utf8');
const modern = fs.readFileSync(new URL('../mission-poi-voice-core.js', import.meta.url), 'utf8');
const json = value => JSON.parse(JSON.stringify(value));
function original(context, cue, memory, randomValue) {
  const sandbox = {
    window: { activePassenger: context.passenger }, currentMissionData: context.missionData,
    document: { getElementById: () => ({ innerText: context.wikiText }) },
    Math: Object.assign(Object.create(Math), { random: () => randomValue }),
    _baseContext: () => context.baseContext, _toneHint: () => context.toneHint,
    _activeTaskDomain: () => context.taskDomain, _isPOIMission: () => true,
    _activeAptTrainingPlan: () => null, _activePoiKnowledgeContext: () => context.knowledgeContext || null,
    _activeBushReconOutcome: () => null, _bushReconOutcomeHintLine: () => '', _sarResultHint: () => '',
    _inspectionMissionMeta: () => context.inspectionMeta, _activeInfraInspectionOutcome: () => context.infraOutcome,
    _professionalRoleMeta: () => context.professionalMeta, _targetContextFactCandidates: () => context.targetFacts,
    _paxApproachLandmarkPolicy: () => context.landmarkPolicy,
    _paxConfirmedVisualLandmarks: () => context.visualLandmarks, _paxTargetGeoContext: () => context.targetGeoContext,
    _poiNarrativeMemory: json(memory), _poiInspectionOutcome: memory.inspectionOutcome,
    _poiKnowledgeSpokenMemory: memory.knowledgeSpoken || '', _poiKnowledgeContextKey:'', _poiKnowledgeManualFactIndices:new Set(), _paxStrictMode: context.strict, _poiDwellSec: cue.detector.dwellSec
  };
  vm.createContext(sandbox);
  vm.runInContext(frozen + knowledge, sandbox);
  const prompt = sandbox[cue.prompt](...cue.args);
  sandbox._capturePoiNarrativeMemory('Objekt in Sicht', 'Äh, dort liegt die Eisenbahn. Ein zweiter Satz.');
  return { prompt, memory: json({ ...sandbox._poiNarrativeMemory, inspectionOutcome: sandbox._poiInspectionOutcome, ...(sandbox._poiKnowledgeSpokenMemory ? {knowledgeSpoken:sandbox._poiKnowledgeSpokenMemory}: {}) }) };
}
let count = 0;
for (const domain of core.DOMAINS) for (const strict of [true, false]) {
  for (const random of [0, .3, .6, .9]) for (const previous of [false, true]) for (const landmark of [false, true]) {
    const context = { schema: core.CONTEXT_SCHEMA, version: 1, missionId: 'voice-parity', taskDomain: domain,
      strict, audioEnabled: false, baseContext: 'Originale Persona und Auftrag.', toneHint: ' Nur Deutsch.',
      passenger: { targetAltFt: 3000, targetRadiusNm: 1.5, targetDwellMin: 2 }, missionData: { poiName: 'Testobjekt' },
      ...(domain==='sightseeing_tour'?{knowledgeContext:{status:'accept',title:'Testobjekt',facts:[{topic:'history',text:'Das Testobjekt wurde im neunzehnten Jahrhundert als regionales Bauwerk errichtet.'},{topic:'structure',text:'Am Testobjekt sind mehrere markante Turmbauten aus der Umgebung deutlich erkennbar.'}]}}:{}),
      inspectionMeta: domain === 'inspection_infra' ? { objectName: 'Brücke' } : null,
      infraOutcome: null, professionalMeta: { entry: 'Einstieg.', result: 'Ergebnis.' },
      targetFacts: ['Die Bahntrasse verbindet mehrere historische Ortsteile.'],
      wikiText: 'Das Bauwerk wurde vor vielen Jahren errichtet. Die Vegetation zeigt besondere regionale Merkmale.',
      landmarkPolicy: { prefix: 'REFERENZ', maxDistM: 500, instruction: 'Als Orientierung nutzen.' },
      visualLandmarks: landmark ? [{ kind: 'railway', name: 'Eisenbahn', distM: 200, relFromTarget: 'östlich' }] : [],
      targetGeoContext: { anchors: { water: { present: true, distM: 300, bearingDeg: 45 } } }
    };
    const memory = { pre: previous ? 'Die Bahntrasse verbindet mehrere historische Ortsteile' : '',
      entry: previous ? 'Die Vegetation zeigt besondere regionale Merkmale' : '', done: '', inspectionOutcome: null };
    for (const name of core.PROMPTS) {
      const fd = { mslFt: 2850, windKts: 22, windDeg: 270, windGustKts: 30, visKm: 4, tempC: 12, inCloud: true };
      const args = name === '_poiInSightPrompt' ? [fd, 2.4, 1.6, '10 Uhr', { announcedEtaMin: 2 }]
        : name === '_poiAltComplaintPrompt' ? [fd, 2850, 3000, 2]
        : name === '_poiMissingCargoAbortPrompt' ? [fd, { blockingItems: ['Kamera'], reason: 'damaged' }] : [fd];
      const cue = { prompt: name, args, detector: { dwellSec: 125.37 } };
      const expected = original(context, cue, memory, random);
      const actual = core.render(context, cue, memory, random);
      assert.equal(actual.prompt, expected.prompt, `${domain}:${name}`);
      assert.deepEqual(core.captureMemory(actual.memory, 'Objekt in Sicht', 'Äh, dort liegt die Eisenbahn. Ein zweiter Satz.', domain), expected.memory);
      count++;
      if (domain === 'sightseeing_tour') {
        const withoutKnowledge = { ...context, knowledgeContext: null };
        const expectedWithout = original(withoutKnowledge, cue, memory, random);
        assert.equal(core.render(withoutKnowledge, cue, memory, random).prompt, expectedWithout.prompt, `optional knowledge:${name}`);
        for (const ignored of [{ facts: [] }, { status: 'reject', facts: context.knowledgeContext.facts }]) {
          assert.equal(core.render({ ...context, knowledgeContext: ignored }, cue, memory, random).prompt,
            expectedWithout.prompt, `ignored knowledge:${name}`);
        }
        count += 3;
      }
    }
  }
}
const browser = vm.createContext({}); vm.runInContext(modern, browser);
assert.deepEqual(json(browser.GAMissionPoiVoiceCore.captureMemory({}, 'Ziel erfüllt', 'Ergebnis. Weiter.')),
  core.captureMemory({}, 'Ziel erfüllt', 'Ergebnis. Weiter.'));
// Existing callers keep the original tone; prepared airborne POI voice can explicitly use greetingDone.
const toneStart = app.indexOf('function _toneHint('), toneEnd = app.indexOf('function _weatherContext(', toneStart);
const tone = vm.createContext({ window: { activePassenger: {} }, _UNIFIED_INSTRUCTOR_BASELINE: false,
  _paxUsesInstructorBaseline: () => false, _paxGreetingDone: false, _paxHumorLevel: 'subtle', _isBushVoiceMission: () => false });
vm.runInContext(app.slice(toneStart, toneEnd), tone);
assert.match(tone._toneHint(), /Begrüßung höchstens kurz/);
assert.match(tone._toneHint(true), /Keine neue Begrüßung/);
assert.equal(tone._paxGreetingDone, false);
console.log(`PASS: ${count} frozen-original/POI voice comparisons, narrative memory, browser export and tone isolation.`);
