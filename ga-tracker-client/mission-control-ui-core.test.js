'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const core = require('./mission-control-ui-core');

function sampleView() {
  return {
    schema: 'ga.efb-mission-view.v1',
    capturedAt: 1787300000000,
    title: 'Versorgungsflug <APT>',
    story: 'Eine ausreichend lange Missionsbeschreibung, die auf App und EFB mit demselben Renderer ein- und ausgeklappt wird. '.repeat(2),
    status: 'Mission aktiv',
    detail: 'Am Ziel entladen und quittieren.',
    currentTask: 'Zum Ziel fliegen',
    taskTone: 'active',
    phase: { current: 1, stages: [{ label: 'Planung' }, { label: 'Hinflug' }, { label: 'Abschluss' }] },
    target: { name: 'EDTW', distanceNm: 4.25, bearingDeg: 7 },
    flight: { trackerLive: true, mslFt: 2100, aglFt: 850 },
    progress: [{ label: 'Hinflug', detail: '42%', percent: 42, tone: 'active' }],
    requirements: [{ label: 'Ladung', value: 'vollständig', state: 'good' }],
    feedback: [{ text: 'Alles im grünen Bereich.', tone: 'good' }],
    comfort: { score: 91, tone: 'good', state: 'ruhig', detail: '0 Pilot · 0 Wetter' },
    cargo: { conditionPct: 100, tone: 'good', state: 'gesichert', detail: '180/180 lbs erfasst' }
  };
}

test('one mission-control renderer produces the shared App/EFB markup and dual action intents', () => {
  const options = {
    storyExpanded: false,
    control: {
      executionAuthority: 'tracker',
      allowedActions: ['start_mission', 'abort_mission']
    },
    intentPending: false,
    intentStatus: 'Stand synchron.',
    intentTone: 'good'
  };
  const appMarkup = core.render(sampleView(), options);
  const efbMarkup = core.render(sampleView(), options);
  assert.equal(appMarkup, efbMarkup);
  assert.match(appMarkup, /data-mission-control-schema="ga\.efb-mission-view\.v1"/);
  assert.match(appMarkup, /data-action="mission-control-intent" data-efb-drawer-action="mission-intent" data-mission-intent="start_mission"/);
  assert.match(appMarkup, /data-action="mission-control-open-cargo" data-efb-drawer-action="open-cargo"/);
  assert.match(appMarkup, /data-action="toggle-mission-story" data-efb-drawer-action="toggle-mission-story"/);
  assert.match(appMarkup, /Versorgungsflug &lt;APT&gt;/);
  assert.match(appMarkup, /4\.3 NM · 007°/);
  assert.match(appMarkup, /mission-control-intent-status is-good/);
});

test('intent results use the same user-facing wording without exposing tracker error codes', () => {
  assert.deepEqual(core.formatIntentResult({ pending: true }), {
    tone: 'info',
    text: 'Tracker verarbeitet die Aktion ...'
  });
  assert.match(core.formatIntentResult({ ok: true }).text, /allen Ansichten aktualisiert/);
  assert.match(core.formatIntentResult({ ok: false, error: 'mission_revision_conflict' }).text, /andere Ansicht/);
  const blocked = core.formatIntentResult({ ok: false, error: 'mission_manifest_unload_not_allowed' });
  assert.equal(blocked.tone, 'warn');
  assert.doesNotMatch(blocked.text, /mission_manifest/);
});

test('read-only projections do not render tracker action controls', () => {
  const markup = core.render(sampleView(), { control: { executionAuthority: 'web', allowedActions: ['start_mission'] } });
  assert.doesNotMatch(markup, /mission-control-operations/);
  assert.match(core.renderEmpty(), /Keine aktive Mission/);
});

test('one tracker toolbar projection drives primary action, cargo reopen and confirmed reset affordances', () => {
  const control = {
    missionId: 'mission-toolbar',
    runId: 'run-toolbar',
    executionAuthority: 'tracker',
    phase: 'end_ready',
    allowedActions: ['request_close', 'abort_mission']
  };
  const model = core.missionToolbarModel(control, {
    banner: {
      kind: 'intent',
      intent: 'request_close',
      button: 'Mission beenden',
      text: 'Alle Abschlussbedingungen sind erfüllt.'
    }
  });
  assert.equal(model.schema, 'ga.mission-toolbar.v1');
  assert.deepEqual(model.primary, {
    kind: 'intent',
    intent: 'request_close',
    cargoMode: 'unload',
    label: 'Mission beenden',
    title: 'Alle Abschlussbedingungen sind erfüllt.',
    disabled: false
  });
  assert.equal(model.cargo.visible, true);
  assert.equal(model.cargo.mode, 'unload');
  assert.equal(model.reset.visible, true);
  assert.equal(model.reset.intent, 'abort_mission');
});

test('cloud candidate toolbar does not expose cargo or reset before tracker authority exists', () => {
  const model = core.missionToolbarModel({
    missionId: 'mission-cloud',
    runId: 'cloud-pending',
    executionAuthority: 'tracker',
    phase: 'planned',
    allowedActions: ['activate_cloud_mission']
  }, {
    banner: { kind: 'intent', intent: 'activate_cloud_mission', button: 'Mission beginnen' }
  });
  assert.equal(model.primary.intent, 'activate_cloud_mission');
  assert.equal(model.cargo.visible, false);
  assert.equal(model.reset.visible, false);
  assert.equal(core.missionToolbarModel({ executionAuthority: 'web' }), null);
});

test('App and EFB wire the shared renderer while the legacy App path stays gated', () => {
  const projectRoot = path.resolve(__dirname, '..');
  const appSource = fs.readFileSync(path.join(projectRoot, 'checklists.js'), 'utf8');
  const efbSource = fs.readFileSync(path.join(__dirname, 'tracker-efb-kartentisch-host.js'), 'utf8');
  assert.match(appSource, /gaTrackerExecutionControl\?\.executionAuthority === 'tracker'[\s\S]*?GAMissionControlUiCore\?\.render/);
  assert.match(efbSource, /GAMissionControlUiCore\.render\(mission\.view/);
  assert.match(appSource, /data\.exists[\s\S]*?const runtimeSnapshot = missionRuntimePhaseSnapshot\(\)/);
});

test('App and EFB top toolbars share tracker actions and expose the guarded mission reset', () => {
  const projectRoot = path.resolve(__dirname, '..');
  const html = fs.readFileSync(path.join(projectRoot, 'index.html'), 'utf8');
  const appSource = fs.readFileSync(path.join(projectRoot, 'sync.js'), 'utf8');
  const efbSource = fs.readFileSync(path.join(__dirname, 'tracker-efb-kartentisch-host.js'), 'utf8');
  const efbCss = fs.readFileSync(path.join(__dirname, 'tracker-efb-kartentisch-host.css'), 'utf8');
  assert.match(html, /id="mapMissionResetBtn"[\s\S]*?requestMissionRuntimeReset/);
  assert.match(html, /id="mapGroundCargoBtn"[\s\S]*?openMissionToolbarCargo/);
  assert.match(appSource, /missionToolbarModel\?\.\(trackerControl/);
  assert.match(appSource, /window\.openMissionToolbarCargo = function/);
  assert.match(appSource, /preserveMission: true/);
  assert.match(appSource, /tracker-mission-reset-to-planned/);
  assert.match(appSource, /tracker_execution_intent_retry/);
  assert.match(appSource, /mission_revision_conflict[\s\S]*?mission_intent_not_allowed_in_state/);
  assert.match(efbSource, /function renderMissionToolbar\(payload\)/);
  assert.match(efbSource, /submitMissionIntent\('abort_mission'/);
  assert.match(efbSource, /Auftrag bleibt zum Neustart erhalten/);
  assert.doesNotMatch(efbCss, /#mapMissionToggleBtn,/);
  assert.doesNotMatch(efbCss, /#mapGroundCargoBtn,/);
});

test('pinboard mission restore publishes a fresh tracker seed immediately', () => {
  const boardSource = fs.readFileSync(path.resolve(__dirname, '..', 'board.js'), 'utf8');
  const restoreStart = boardSource.indexOf('async function loadPinnedFlight');
  const restoreEnd = boardSource.indexOf('\nfunction pinboardCreateElement', restoreStart);
  const restoreSource = boardSource.slice(restoreStart, restoreEnd);
  assert.match(restoreSource, /restoreMissionState\(note\.flightData, \{ source: 'pinboard' \}\)/);
  assert.match(restoreSource, /queueActiveMissionCloudSave\('pinboard-mission-restored', \{ delayMs: 0 \}\)/);
});
