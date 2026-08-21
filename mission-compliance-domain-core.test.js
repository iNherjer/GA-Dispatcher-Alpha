'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const core = require('./mission-compliance-domain-core.js');

const testNow = new Date(2026, 7, 21, 12, 0, 0, 0).getTime();

function manifest(overrides = {}) {
  const base = {
    aircraftSlot: 'D-EINA',
    items: [
      {
        id: 'bordbuch',
        storyName: 'Bordbuch',
        status: 'loaded',
        log: { flightId: 'apt-1|100', startAt: 100, landingAt: 200 }
      },
      {
        id: 'fire-extinguisher',
        storyName: 'Feuerloescher',
        status: 'loaded',
        expiresAt: '2026-08-25',
        serialId: 'FIRE-1'
      },
      {
        id: 'first-aid',
        storyName: 'Verbandzeug',
        status: 'loaded',
        expiresAt: '2026-08-21',
        serialId: 'FIRST-1'
      }
    ]
  };
  const result = { ...base, ...overrides };
  if (overrides.items) result.items = overrides.items;
  return result;
}

function selectedState(overrides = {}) {
  return core.normalizeState({
    missionKey: 'apt-1',
    flightId: 'apt-1|100',
    selected: true,
    phase: 'evidence_open',
    farewellComplete: true,
    ...overrides
  });
}

function snapshotAndUnload(sourceManifest = manifest(), state = selectedState()) {
  const snapshot = core.createSnapshot(state, sourceManifest, { now: testNow });
  const unloaded = JSON.parse(JSON.stringify(sourceManifest));
  unloaded.items.forEach(item => { item.status = 'unloaded'; });
  return { state: { ...state, snapshot }, manifest: unloaded };
}

test('normalization retains the complete App compliance state contract', () => {
  const state = core.normalizeState({
    selected: true,
    phase: 'inspectors_waiting',
    forced: true,
    roll: 0.2,
    decisionAt: 10,
    phaseAt: 11,
    revision: 4,
    commandId: 'command',
    sceneId: 'scene',
    sceneFallback: true,
    farewellComplete: true,
    requestText: 'Text',
    requestSpokenAt: 12,
    remediation: { required: true, missingFields: ['start', 'invalid', 'landing'] },
    resultText: 'Ergebnis',
    resultSpokenAt: 13,
    releasedAt: 0
  }, { missionKey: 'mission', flightId: 'flight' });
  assert.equal(state.missionKey, 'mission');
  assert.equal(state.flightId, 'flight');
  assert.equal(state.inspectorsWaiting, true);
  assert.deepEqual(state.remediation, { required: true, missingFields: ['start', 'landing'] });
  assert.equal(state.commandId, 'command');
  assert.equal(state.resultText, 'Ergebnis');
});

test('inspection probability remains disabled while the App debug force still selects', () => {
  assert.equal(core.PROBABILITY, 0);
  assert.equal(core.shouldInspect(0, false), false);
  assert.equal(core.shouldInspect(0.999, false), false);
  const regular = core.decide(selectedState({ selected: null, phase: 'none' }), {
    roll: 0,
    now: testNow,
    flightId: 'apt-1|100'
  });
  assert.equal(regular.selected, false);
  assert.equal(regular.phase, 'not_selected');
  const forced = core.decide(selectedState({ selected: null, phase: 'none' }), {
    roll: 0.9,
    force: true,
    now: testNow,
    flightId: 'apt-1|100'
  });
  assert.equal(forced.selected, true);
  assert.equal(forced.phase, 'selected');
  assert.equal(forced.decisionAt, testNow);
});

test('snapshot freezes carried state, expiry and serials exactly at the final decision', () => {
  const snapshot = core.createSnapshot(selectedState(), manifest(), { now: testNow });
  assert.equal(snapshot.at, testNow);
  assert.equal(snapshot.flightId, 'apt-1|100');
  assert.equal(snapshot.aircraftSlot, 'D-EINA');
  assert.deepEqual(snapshot.items.map(item => [item.id, item.label, item.status]), [
    ['bordbuch', 'Bordbuch', 'loaded'],
    ['fire-extinguisher', 'Feuerloescher', 'loaded'],
    ['first-aid', 'Verbandzeug', 'loaded']
  ]);
  assert.equal(snapshot.items[1].expiresAt, '2026-08-25');
  assert.equal(snapshot.items[1].serialId, 'FIRE-1');
});

test('boardbook remediation is offered only after unloading and for the controlled flight', () => {
  const loaded = manifest();
  loaded.items[0].log = {};
  assert.deepEqual(core.remediationState(selectedState(), loaded), {
    required: false,
    missingFields: []
  });
  loaded.items[0].status = 'unloaded';
  assert.deepEqual(core.remediationState(selectedState(), loaded), {
    required: true,
    missingFields: ['start', 'landing']
  });
  loaded.items[0].log = { flightId: 'other-flight', startAt: 100, landingAt: 200 };
  assert.deepEqual(core.remediationState(selectedState(), loaded).missingFields, ['start', 'landing']);
  loaded.items[0].log = { flightId: 'apt-1|100', startAt: 100, landingAt: 200 };
  assert.deepEqual(core.remediationState(selectedState(), loaded), {
    required: false,
    missingFields: []
  });
});

test('evidence blocks loaded requested items and then accepts the exact valid App path', () => {
  const source = manifest();
  const state = selectedState({ snapshot: core.createSnapshot(selectedState(), source, { now: testNow }) });
  const blocked = core.evaluateEvidence(state, source, { now: testNow });
  assert.deepEqual(blocked.blockingUnload, ['Bordbuch', 'Feuerloescher', 'Verbandzeug']);
  const ready = snapshotAndUnload(source, selectedState());
  const result = core.completeEvidenceResult(
    core.evaluateEvidence(ready.state, ready.manifest, { now: testNow }),
    testNow
  );
  assert.equal(result.ready, true);
  assert.equal(result.entryCount, 0);
  assert.equal(result.warningCount, 0);
  assert.equal(core.resultVoiceText(result), 'Danke. Der aktuelle Flug ist im Bordbuch vollstaendig eingetragen, Feuerloescher gueltig bis 2026-08-25 und Verbandzeug gueltig bis 2026-08-21. Die Kontrolle ist ohne Beanstandung abgeschlossen. Gute Weiterreise.');
  assert.equal(core.createSanctionRecord(ready.state, result, testNow), null);
});

test('snapshot prevents unloading after landing from hiding equipment missing in flight', () => {
  const source = manifest();
  source.items.find(item => item.id === 'first-aid').status = 'pending';
  const state = selectedState({ snapshot: core.createSnapshot(selectedState(), source, { now: testNow }) });
  source.items.forEach(item => { item.status = 'unloaded'; });
  const result = core.evaluateEvidence(state, source, { now: testNow });
  assert.equal(result.offences.find(item => item.itemId === 'first-aid').code, 'missing_first-aid');
  assert.equal(result.offences.find(item => item.itemId === 'first-aid').severity, 'entry');
});

test('missing boardbook times stop evaluation and expose only the App remediation fields', () => {
  const ready = snapshotAndUnload();
  ready.manifest.items[0].log = { flightId: 'apt-1|100', startAt: 100 };
  const result = core.evaluateEvidence(ready.state, ready.manifest, { now: testNow });
  assert.equal(result.ready, false);
  assert.deepEqual(result.missingLogFields, ['landing']);
});

test('expiry threshold creates the same warning and seven-day authority entry', () => {
  const source = manifest();
  source.items.find(item => item.id === 'fire-extinguisher').expiresAt = '2026-08-19';
  source.items.find(item => item.id === 'first-aid').expiresAt = '2026-08-17';
  const ready = snapshotAndUnload(source);
  const result = core.completeEvidenceResult(
    core.evaluateEvidence(ready.state, ready.manifest, { now: testNow }),
    testNow
  );
  assert.equal(result.warningCount, 1);
  assert.equal(result.entryCount, 1);
  assert.equal(result.offences[0].description, 'Feuerloescher war seit 2 Tagen abgelaufen.');
  assert.equal(result.offences[1].description, 'Verbandzeug war seit 4 Tagen abgelaufen.');
  assert.equal(core.resultVoiceText(result), 'Feuerloescher war seit 2 Tagen abgelaufen. Verbandzeug war seit 4 Tagen abgelaufen. Dafuer wird ein Behoerdeneintrag am Crewboard angelegt, der sieben Tage bestehen bleibt. Die Kontrolle ist damit abgeschlossen.');
  const sanction = core.createSanctionRecord(ready.state, result, testNow);
  assert.equal(sanction.type, 'authority_sanction');
  assert.equal(sanction.flightId, 'apt-1|100');
  assert.equal(sanction.aircraftSlot, 'D-EINA');
  assert.equal(sanction.immutableUntil, testNow + (7 * 86400000));
  assert.equal(sanction.expiresAt, testNow + (7 * 86400000));
  assert.match(sanction.text, /Nicht loeschbar fuer 7 Tage\.$/);
});

test('UI projection and mutation guards retain the exact App labels and phases', () => {
  assert.deepEqual(core.projectCargoUiState(null), {
    active: false,
    phase: 'none',
    replacementLocked: false,
    message: '',
    actionLabel: ''
  });
  assert.equal(
    core.projectCargoUiState(selectedState({ phase: 'approach_started', inspectorsWaiting: false })).message,
    'Das Behoerdenfahrzeug ist unterwegs. Ausladen ist bereits moeglich; Austauschen ist gesperrt.'
  );
  assert.equal(
    core.projectCargoUiState(selectedState({ phase: 'inspectors_waiting' })).message,
    'Die Kontrolleure warten am Flugzeug auf das Ende des Farewells.'
  );
  const evidence = core.projectCargoUiState(selectedState({
    remediation: { required: true, missingFields: ['landing'] }
  }));
  assert.equal(evidence.message, 'Der aktuelle Bordbucheintrag muss vor Abschluss der Kontrolle nachgetragen werden.');
  assert.equal(evidence.actionLabel, 'Der Kontrolle vorlegen');
  assert.equal(core.canMutateCargo(selectedState(), 'first-aid', 'replace'), false);
  assert.equal(core.canMutateCargo(selectedState({ phase: 'result_playing' }), 'first-aid', 'unload'), false);
  assert.equal(core.canMutateCargo(selectedState(), 'mission-crate', 'replace'), true);
  assert.equal(core.boardBookWriteAllowed(selectedState({ remediation: { required: true, missingFields: ['landing'] } }), 'landing'), true);
  assert.equal(core.boardBookWriteAllowed(selectedState({ remediation: { required: true, missingFields: ['landing'] } }), 'start'), false);
});

test('browser compliance orchestrator delegates all migrated domain decisions to the shared core', () => {
  const source = fs.readFileSync(require.resolve('./mission-compliance-core.js'), 'utf8');
  for (const method of [
    'normalizeState',
    'decide',
    'createSnapshot',
    'remediationState',
    'evaluateEvidence',
    'completeEvidenceResult',
    'resultVoiceText',
    'createSanctionRecord',
    'projectCargoUiState',
    'canMutateCargo',
    'boardBookWriteAllowed'
  ]) {
    assert.match(source, new RegExp(`MISSION_COMPLIANCE_DOMAIN_CORE\\?\\.${method}`), `App delegation missing: ${method}`);
  }
});
