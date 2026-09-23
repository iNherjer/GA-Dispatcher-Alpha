'use strict';

const assert = require('node:assert/strict');
const ui = require('./mission-training-guidance-ui');

const view = ui.buildViewModel({
  visible: true,
  title: 'Anflugtraining',
  phaseLabel: 'Übung 2',
  instruction: 'Leite die Kurve mit gleichmäßigem Druck ein. Wiederhole die Ansage, wenn nötig.',
  attempt: 3,
  canRepeat: true,
  rows: [
    { id: 'prepare', label: 'Vorbereitung', status: 'complete', progress: 1 },
    { id: 'turn', label: 'Kurve einleiten', status: 'active', progress: 0.42 },
    { id: 'recover', label: 'Abfangen', status: 'error', progress: 1.4 }
  ],
  history: [
    { at: '10:02', text: 'Vorbereitung abgeschlossen' },
    { at: '10:03', text: 'Kurve zu steil' }
  ]
});

assert.equal(view.visible, true);
assert.equal(view.title, 'Anflugtraining');
assert.equal(view.introduction, 'Leite die Kurve mit gleichmäßigem Druck ein.');
assert.deepEqual(view.rows.map((row) => [row.number, row.id, row.status]), [
  [1, 'prepare', 'complete'],
  [2, 'turn', 'active'],
  [3, 'recover', 'error']
]);
assert.equal(view.rows[1].progress, 0.42);
assert.equal(view.rows[2].progress, 1, 'progress is capped at 100%');
assert.deepEqual(view.history.map((entry) => entry.text), ['Vorbereitung abgeschlossen', 'Kurve zu steil']);
const epochHistory = ui.buildViewModel({ history: [{ at: 1700000000000, text: 'Zeitstempel' }] }).history[0].at;
assert.match(epochHistory, /^\d{2}\.\d{2}\.2023 \d{2}:\d{2}:\d{2}$/);
assert.equal(ui.buildViewModel({ rows: [{ progress: -1 }] }).rows[0].progress, 0);
assert.equal(ui.buildViewModel({ rows: [{ status: 'unknown' }] }).rows[0].status, 'pending');

process.stdout.write('MISSION_TRAINING_GUIDANCE_UI_TESTS_OK\n');

// The EFB must redraw even if only an angle/hold counter changed, with no phase or voice event.
const hostSource = require('node:fs').readFileSync(require('node:path').join(__dirname, 'ga-tracker-client/tracker-efb-kartentisch-host.js'), 'utf8');
const signatureCode = hostSource.slice(hostSource.indexOf('  function missionRenderSignature('), hostSource.indexOf('  function missionActionBannerModel('));
const signature = new Function(signatureCode + '; return missionRenderSignature;')();
const payload = {control:{poiTask:{trainingGuidance:{rows:[{progress:0.2}]}}}};
const initialSignature = signature(payload);
payload.control.poiTask.trainingGuidance.rows[0].progress=0.3;
assert.notEqual(signature(payload), initialSignature, 'angle-only updates must reach the banner');
assert.equal(signature(null), 'none');
