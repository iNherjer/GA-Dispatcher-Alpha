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
      missionId: 'mission-render',
      runId: 'run-render',
      executionAuthority: 'tracker',
      phase: 'boarding',
      flags: { groundStill: true },
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

test('tracker cargo controls disappear in flight and return for ground handling', () => {
  const airborne = {
    missionId: 'mission-flight',
    runId: 'run-flight',
    executionAuthority: 'tracker',
    phase: 'enroute',
    flags: { onGround: false, groundStill: false },
    allowedActions: ['set_manifest_item', 'abort_mission']
  };
  assert.equal(core.missionToolbarModel(airborne).cargo.visible, false);
  assert.doesNotMatch(core.render(sampleView(), { control: airborne }), /mission-control-open-cargo/);

  const arrived = {
    ...airborne,
    phase: 'end_unloading',
    flags: { onGround: true, groundStill: true },
    allowedActions: ['set_manifest_item', 'abort_mission']
  };
  assert.equal(core.missionToolbarModel(arrived).cargo.visible, true);
  assert.match(core.render(sampleView(), { control: arrived }), /mission-control-open-cargo/);
});

test('cargo stays closed in the MSFS main menu and World Map, open in the loaded aircraft', () => {
  const planned = {
    missionId: 'mission-world', runId: 'run-world', executionAuthority: 'tracker', phase: 'planned',
    allowedActions: ['set_manifest_item', 'abort_mission']
  };
  const withReadiness = readiness => ({ ...planned, startReadiness: { observedAt: Date.now(), ...readiness } });
  assert.equal(core.missionToolbarModel(planned).cargo.visible, true, 'no readiness data keeps the previous behavior');
  assert.equal(core.missionToolbarModel(withReadiness({ worldReady: false, reason: 'cockpit_not_loaded', cameraState: 12 })).cargo.visible, false, 'World Map');
  assert.equal(core.missionToolbarModel(withReadiness({ worldReady: false, reason: 'simulator_not_ready', cameraState: 32 })).cargo.visible, false, 'main menu');
  assert.equal(core.missionToolbarModel(withReadiness({ worldReady: false, reason: 'telemetry_stale', cameraState: null })).cargo.visible, false, 'no live view yet');
  assert.equal(core.missionToolbarModel(withReadiness({ worldReady: false, reason: 'telemetry_stale', cameraState: 2 })).cargo.visible, true, 'brief stale sample in cockpit');
  assert.equal(core.missionToolbarModel(withReadiness({ worldReady: true, reason: 'ground_stabilizing', cameraState: 2 })).cargo.visible, true, 'loaded aircraft');
  assert.doesNotMatch(core.render(sampleView(), { control: withReadiness({ worldReady: false, reason: 'cockpit_not_loaded', cameraState: 12 }) }), /mission-control-open-cargo/);
});

test('App and EFB wire the shared renderer while the legacy App path stays gated', () => {
  const projectRoot = path.resolve(__dirname, '..');
  const appSource = fs.readFileSync(path.join(projectRoot, 'checklists.js'), 'utf8');
  const efbSource = fs.readFileSync(path.join(__dirname, 'tracker-efb-kartentisch-host.js'), 'utf8');
  assert.match(appSource, /gaTrackerExecutionControl\?\.executionAuthority === 'tracker'[\s\S]*?GAMissionControlUiCore\?\.render/);
  assert.match(efbSource, /missionView: function\(\) \{ return missionSnapshot/);
  assert.match(appSource, /gaChecklistHost\?\.missionView[\s\S]*?GAMissionControlUiCore\.render\(view/);
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
  assert.match(appSource, /mission_revision_conflict[\s\S]*?mission_intent_not_allowed_in_state[\s\S]*?mission_run_conflict/);
  assert.match(appSource, /authoritativeRunRebind[\s\S]*?retryRun\?\.executionAuthority === 'tracker'/);
  assert.match(appSource, /trackerFinishedThisMission/);
  assert.match(appSource, /authority_acquire_suppressed/);
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
  assert.match(restoreSource, /restoreMissionState\((note\.)?flightData, \{ source: 'pinboard' \}\)/);
  assert.match(restoreSource, /queueActiveMissionCloudSave\('pinboard-mission-restored', \{ delayMs: 0 \}\)/);
});

test('first cargo click leads immediately, followers batch;  signature and run changes remain ordered barriers', async () => {
  const queue = core.createIntentQueue();
  const calls = [];
  let revision = 1;
  const batch = (group, id) => ({ group, value: { itemId: id, action: 'load' }, execute: async items => {
    calls.push({ items: items.map(item => item.itemId), revision: revision++ });
    return 'accepted';
  } });
  const a = queue.enqueue('a', 'a', () => { throw new Error('should batch'); }, batch('run1', 'a'));
  assert.equal(queue.enqueue('a', 'a', () => {}), a);
  const b = queue.enqueue('b', 'b', () => { throw new Error('should batch'); }, batch('run1', 'b'));
  const sign = queue.enqueue('sign', '', () => { calls.push({ sign: true, revision: revision++ }); });
  const c = queue.enqueue('c', 'c', () => { calls.push({ single: 'c', revision: revision++ }); }, batch('run1', 'c'));
  const d = queue.enqueue('d', 'd', () => { calls.push({ single: 'd', revision: revision++ }); }, batch('run2', 'd'));
  assert.deepEqual(queue.pendingItemIds(), ['a', 'b', 'c', 'd']);
  assert.deepEqual(await Promise.all([a, b]), ['accepted', 'accepted']);
  await Promise.all([sign, c, d]);
  assert.deepEqual(calls, [{ items: ['a'], revision: 1 }, { items: ['b'], revision: 2 }, { sign: true, revision: 3 },
    { items: ['c'], revision: 4 }, { items: ['d'], revision: 5 }]);
  assert.equal(queue.size(), 0);
});

test('a rejected batch releases every item and subsequent intents still execute', async () => {
  const queue = core.createIntentQueue();
  const batch = id => ({ group: 'r', value: id, execute: () => { throw new Error('conflict'); } });
  const results = Promise.allSettled([
    queue.enqueue('a', 'a', () => {}, batch('a')),
    queue.enqueue('b', 'b', () => {}, batch('b')),
    queue.enqueue('sign', '', () => 'next')
  ]);
  assert.deepEqual((await results).map(result => result.status), ['rejected', 'rejected', 'fulfilled']);
  assert.equal(queue.size(), 0);
});

test('waiting cargo batches dispatch immediately after ACK without transport timers', async () => {
  const vm = require('node:vm');
  const context = { module: { exports: {} }, setTimeout: () => { throw new Error('unexpected queue delay'); } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'mission-control-ui-core.js'), 'utf8'), context);
  const queue = context.module.exports.createIntentQueue();
  const calls = [];
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const enqueue = id => queue.enqueue(id, id, () => {}, { group: 'run', value: id,
    execute: async items => { calls.push(Array.from(items)); if (items[0] === 'a') await gate; return 'ok'; } });
  const a = enqueue('a');
  await Promise.resolve();
  const b = enqueue('b'), c = enqueue('c');
  assert.deepEqual(calls, [['a']]);
  release();
  await Promise.all([a, b, c]);
  assert.deepEqual(calls, [['a'], ['b', 'c']]);
  assert.equal(queue.size(), 0);
});

test('load unload load preserves the final correction while adjacent duplicates join', async () => {
  const queue = core.createIntentQueue();
  const calls = [];
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const submit = action => queue.enqueue('item:' + action, 'item', async () => {
    calls.push(action);
    if (calls.length === 1) await gate;
    return action;
  });
  const first = submit('load');
  assert.equal(submit('load'), first);
  await Promise.resolve();
  const opposite = submit('unload');
  const correction = submit('load');
  assert.notEqual(correction, first);
  release();
  assert.deepEqual(await Promise.all([first, opposite, correction]), ['load', 'unload', 'load']);
  assert.deepEqual(calls, ['load', 'unload', 'load']);
});

test('equipment load failures explain distance and replacement restrictions without a generic phase error', () => {
  assert.match(core.formatIntentResult({ ok: false, error: 'manifest_reload_too_far' }).text, /200 m/);
  assert.match(core.formatIntentResult({ ok: false, error: 'manifest_lost_item_replacement_required' }).text, /vor Missionsbeginn/);
  assert.match(core.formatIntentResult({ ok: false, error: 'manifest_ground_handling_required' }).text, /Stillstand/);
});

test('disconnected simulator explains the interrupted mission instead of a generic tracker error', () => {
  const presentation = core.formatIntentResult({ ok: false, status: 'blocked', error: 'simulator_disconnected' });
  assert.equal(presentation.tone, 'warn');
  assert.match(presentation.text, /Simulator ist nicht verbunden/);
  assert.match(presentation.text, /Zurücksetzen und Abbrechen/);
});

test('interrupted run hides cargo and start actions but keeps reset and abort', () => {
  const control = {
    missionId: 'mission-interrupted',
    runId: 'run-interrupted',
    executionAuthority: 'tracker',
    phase: 'boarding',
    allowedActions: ['abort_mission', 'start_mission', 'set_manifest_item', 'clear_manifest_signature']
  };
  const banner = { kind: 'cargo', cargoMode: 'load', button: 'Verladung öffnen' };
  const normal = core.missionToolbarModel(control, { banner });
  assert.equal(normal.primary.kind, 'cargo');
  const interrupted = core.missionToolbarModel(control, { banner, interrupted: true });
  assert.equal(interrupted.primary, null);
  assert.equal(interrupted.cargo.visible, false);
  assert.equal(interrupted.reset.visible, true);
  assert.equal(interrupted.reset.intent, 'abort_mission');
  const markup = core.render(sampleView(), { control, interrupted: true });
  assert.match(markup, /Mission ist unterbrochen/);
  assert.match(markup, /data-mission-intent="abort_mission"/);
  assert.doesNotMatch(markup, /data-mission-intent="start_mission"/);
  assert.doesNotMatch(markup, /mission-control-open-cargo/);
  const normalMarkup = core.render(sampleView(), { control });
  assert.match(normalMarkup, /data-mission-intent="start_mission"/);
  assert.doesNotMatch(normalMarkup, /Mission ist unterbrochen/);
});

test('interruption model presents decision, waiting and zone states for every view', () => {
  const now = 2_000_000;
  const control = (interruption, allowedActions) => ({ executionAuthority: 'tracker', missionId: 'm', runId: 'r',
    phase: 'enroute', allowedActions, interruption });
  const zone = { lat: 48.1, lon: 8.1, radiusNm: 5, airborne: true };
  assert.equal(core.interruptionModel(control(null, ['abort_mission'])), null);
  assert.equal(core.interruptionModel({ executionAuthority: 'web', interruption: { status: 'awaiting_decision' } }), null);

  const fresh = core.interruptionModel(control({ status: 'awaiting_decision', since: now - 3000, zone }, ['abort_mission', 'resume_mission']),
    { now, simulatorConnected: false });
  assert.equal(fresh.visible, false, 'short gaps do not flash the banner');
  assert.equal(fresh.recheckInMs, 12000);
  const decision = core.interruptionModel(control({ status: 'awaiting_decision', since: now - 20000, zone }, ['abort_mission', 'resume_mission']),
    { now, simulatorConnected: false });
  assert.equal(decision.visible, true);
  assert.match(decision.text, /MSFS starten und einen Flug laden/);
  assert.equal(decision.kicker, 'Mission wieder aufnehmen');
  assert.equal(decision.primary, null, 'continuing is the default; no continue button');
  assert.equal(decision.resetAvailable, true);
  const restarted = core.interruptionModel(control({ status: 'awaiting_decision', since: now - 20000, zone }, ['abort_mission', 'resume_mission']),
    { now, simulatorConnected: true });
  assert.equal(restarted.text, 'Die laufende Mission wurde gespeichert. Zum Fortfahren den Flug im Simulator starten.');
  const efb = core.interruptionModel(control({ status: 'awaiting_decision', since: now - 20000, zone }, ['abort_mission', 'resume_mission']),
    { now, simulatorConnected: true, canLoadSave: true });
  assert.equal(efb.text, 'Die laufende Mission wurde gespeichert. Möchtest du fortfahren?');

  const waiting = core.interruptionModel(control({ status: 'resuming', since: now - 60000, zone }, ['abort_mission']), { now, simulatorConnected: true });
  assert.equal(waiting.primary, null);
  assert.equal(waiting.kicker, 'Mission wieder aufnehmen');

  const air = core.interruptionModel(control({ status: 'awaiting_zone', since: now - 90000, zone }, ['abort_mission', 'resume_teleport']),
    { now, livePosition: { lat: 49.1, lon: 8.1 } });
  assert.deepEqual(air.primary, { intent: 'resume_teleport', label: 'An Speicherpunkt versetzen' });
  assert.match(air.text, /Zum Fortsetzen an den Speicherpunkt fliegen \(5,0 NM Zone\)/);
  assert.match(air.text, /Noch 60,\d NM, Kurs 180°/);
  assert.ok(Math.abs(air.distanceNm - 60) < 0.5);

  const groundZone = { lat: 48.1, lon: 8.1, radiusNm: 1.5, airborne: false, kind: 'departure', label: 'EDTF' };
  const ground = core.interruptionModel(control({ status: 'awaiting_zone', since: now - 90000, zone: groundZone }, ['abort_mission']),
    { now, livePosition: { lat: 48.3, lon: 8.1 } });
  assert.equal(ground.primary, null);
  assert.match(ground.text, /am Startplatz EDTF abstellen/);
  // Already on the field (inside 1.5 NM): no "go back" instruction.
  const atField = core.interruptionModel(control({ status: 'awaiting_zone', since: now - 90000, zone: groundZone }, ['abort_mission']),
    { now, livePosition: { lat: 48.11, lon: 8.1 } });
  assert.equal(atField.kicker, 'Speicherstand wird geladen');
  assert.doesNotMatch(atField.text, /abstellen/);

  // Toolbar and Mission Control show no cargo and no continue button.
  const toolbar = core.missionToolbarModel(control({ status: 'awaiting_decision', since: now - 20000, zone }, ['abort_mission', 'resume_mission']),
    { interruption: decision });
  assert.equal(toolbar.primary, null);
  assert.equal(toolbar.cargo.visible, false);
  assert.equal(toolbar.reset.visible, true);
  const markup = core.render(sampleView(), { control: control({ status: 'awaiting_decision', since: now - 20000, zone }, ['abort_mission', 'resume_mission']), interruption: decision });
  assert.doesNotMatch(markup, /data-mission-intent="resume_mission"/);
  assert.match(markup, /data-mission-intent="abort_mission"/);
  assert.match(markup, /Mission wieder aufnehmen: Die laufende Mission wurde gespeichert/);
  assert.match(core.RESUMED_NOTICE_TEXT, /Speicherstand erfolgreich geladen/);
});

test('ground interruptions name the departure or destination airport', () => {
  const now = 3_000_000;
  const control = zone => ({ executionAuthority: 'tracker', missionId: 'm', runId: 'r', phase: 'boarding', allowedActions: ['abort_mission'],
    interruption: { status: 'awaiting_zone', since: now - 60000, zone } });
  const departure = core.interruptionModel(control({ lat: 48, lon: 7.8, radiusNm: 1.5, airborne: false, kind: 'departure', label: 'EDTF' }), { now });
  assert.equal(departure.kicker, 'Zurück zum Startplatz');
  assert.match(departure.text, /am Startplatz EDTF abstellen \(innerhalb 1,5 NM\)/);
  const destination = core.interruptionModel(control({ lat: 48, lon: 8.4, radiusNm: 1.5, airborne: false, kind: 'destination', label: 'EDTW' }), { now });
  assert.equal(destination.kicker, 'Zurück zum Zielplatz');
  assert.match(destination.text, /am Zielplatz EDTW/);
});
