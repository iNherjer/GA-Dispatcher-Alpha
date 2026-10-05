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
assert.equal(ui.buildViewModel({
  instruction: 'Vor der Einweisung müssen Entfernung und Sicherheitshöhe passen.'
}).introduction, 'Vor der Einweisung müssen Entfernung und Sicherheitshöhe passen.');

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

// Exercise controls must not submit destructive actions without confirmation.
(async function () {
  const source = require('node:fs').readFileSync(require('node:path').join(__dirname,'mission-training-guidance-ui.js'),'utf8');
  const code = source.slice(source.indexOf('  function bindControls('), source.indexOf('  function restorePosition('));
  let confirmed=false, submitted=0;
  const listeners={};
  const root={confirm:()=>confirmed,addEventListener:()=>{},console};
  const node={addEventListener:(name,fn)=>{listeners[name]=fn;},_trainingActions:{start:()=>{submitted++;},restart:()=>{submitted++;},abort:()=>{submitted++;}}};
  new Function('root',code+';return bindControls;')(root)(node);
  const click=(action,disabled=false)=>listeners.click({target:{disabled,getAttribute:()=>action}});
  click('abort'); click('restart');
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(submitted,0);
  confirmed=true;
  click('restart'); click('restart');
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(submitted,1,'double clicks submit only one intent');
  click('start',true);
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(submitted,1,'unavailable start cannot submit');
  click('start');
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(submitted,2);
  const preparing=ui.buildViewModel({preparing:true,canStart:false,canAbort:false});
  assert.equal(preparing.preparing,true);
  assert.equal(preparing.canStart,false);
  assert.equal(preparing.canAbort,false);
  process.stdout.write('TRAINING_BANNER_CONTROLS_TESTS_OK\n');
})().catch(error=>{console.error(error);process.exitCode=1;});

// Minimum height includes one complete row and the fixed controls; viewport limits growth.
{
  const source=require('node:fs').readFileSync(require('node:path').join(__dirname,'mission-training-guidance-ui.js'),'utf8');
  const code=source.slice(source.indexOf('  function resizeHeight('),source.indexOf('  function bindControls('));
  const elements={};
  for(const [name,height] of Object.entries({head:54,actions:100,resize:25,row:60,instruction:18,notice:0})) {
    elements['.training-guidance-'+name]={getBoundingClientRect:()=>({height}),setAttribute:()=>{}};
  }
  const node={style:{},querySelector:key=>elements[key]||null,getBoundingClientRect:()=>({top:12})};
  const resize=new Function('root',code+';return resizeHeight;')({innerHeight:894});
  assert.equal(resize(node,100),295);
  assert.equal(resize(node,2000),874);
  assert.equal(resize(node,500),500);
}

// The status must remain above the fullscreen Kartentisch, below modal dialogs.
const stylesheet = require('node:fs').readFileSync(require('node:path').join(__dirname, 'styles.css'), 'utf8');
const trainingLayer = Number(stylesheet.match(/\.training-guidance\s*\{[^}]*z-index:\s*(\d+)/)[1]);
const mapLayer = Number(stylesheet.match(/body\.map-is-fullscreen #mapTableOverlay\s*\{[^}]*z-index:\s*(\d+)/)[1]);
assert.ok(trainingLayer > mapLayer, 'training guidance must be above the fullscreen map');
assert.ok(trainingLayer < 130500, 'modal dialogs remain above training guidance');

// A persisted guidance projection must never offer actions the authority denies.
const offered = { visible: true, canRepeat: true, canStart: true, canAbort: true };
const blockedActions = ui.buildViewModel(offered, []);
assert.equal(blockedActions.canRepeat, false);
assert.equal(blockedActions.canStart, false);
assert.equal(blockedActions.canAbort, false);
const repeatOnly = ui.buildViewModel(offered, ['training_repeat_instruction']);
assert.equal(repeatOnly.canRepeat, true);
assert.equal(repeatOnly.canStart, false);
assert.equal(repeatOnly.canAbort, false);
assert.equal(ui.buildViewModel(offered).canRepeat, true, 'legacy callers retain guidance flags');
