'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function fixture(filename = __dirname + '/tracker-audio-client.js') {
  let writes = [];
  const nodes = {};
  function node(id) {
    const values = { value: '', checked: false, textContent: '' };
    const item = { style: new Proxy({}, { set(target, key, value) {
      writes.push(id + '.style.' + key); target[key] = value; return true;
    } }) };
    for (const key of Object.keys(values)) Object.defineProperty(item, key, {
      get: () => values[key], set(value) { writes.push(id + '.' + key); values[key] = value; }
    });
    return nodes[id] = item;
  }
  ['gaTrackerAudioOutput','gaAudioOutputSelect','gaAudioMasterEnabled','gaAudioOutputStatus',
    'awmPaxAudioStyleSelect','gaWarningVoiceSelect','awmPaxVoiceCheck','awmAudioEffectsCheck',
    'awmReadFreqCheck','awmTerrainWarnCheck','awmAirspaceWarnCheck','awmWpAlertCheck',
    'awmVolumeSlider','awmVolumeLabel'].forEach(node);
  const root = { document: { activeElement: null, getElementById: id => nodes[id], querySelectorAll: () => [] },
    localStorage: { getItem: () => 'efb' }, gaCockpitSessionClient: { role: 'efb', clientId: 'test', baseUrl: '/api/v1' },
    addEventListener() {}, fetch: async () => { throw Error('offline'); },
    GATrackerCockpitSessionClient: { requestJson: async () => { throw Error('offline'); } },
    GATrackerAudioPlayer: { createPlayer: () => ({ update() {}, stop() {} }) } };
  // Use the complete client/polling code; substitute only DOM construction.
  const source = fs.readFileSync(filename, 'utf8').replace(
    /  function installMenu\(\) \{[\s\S]*?(?=  var bindings =)/,
    "  function installMenu() { menu = root.document.getElementById('gaTrackerAudioOutput'); }\n");
  vm.runInNewContext(source, { window: root, setTimeout: () => 1, clearTimeout() {} });
  const state = { schema: 'ga.audio-control.v1', revision: 1, updatedAt: 1,
    target: { mode: 'pc', deviceId: 'pc', name: 'PC' }, settings: { enabled: true, audioStyle: 'intercom_noise',
      voicePack: '', paxEnabled: true, effectsEnabled: true, readFreq: true, terrain: true, airspace: true,
      waypoint: true, volume: 1 } };
  function apply(value = state) { root.gaTrackerAudioClient.apply(value); }
  return { nodes, node, root, state, apply, reset() { writes = []; }, writes: () => writes };
}

test('identical audio polls preserve controls, status text and menu styles', () => {
  const f = fixture(); f.apply(); f.reset();
  for (let i = 0; i < 20; i++) f.apply({ ...f.state, revision: i + 2, updatedAt: i + 2 });
  assert.deepEqual(f.writes(), [], 'poll metadata must not repaint unchanged native controls');
});

test('partial warning health keeps its final status without alternating text writes', () => {
  const f = fixture();
  const state = { ...f.state, warnings: { active: true, status: 'partial', health: 'Terrain fehlt', session: 'test', revision: 1, events: [] } };
  f.apply(state); f.reset();
  for (let i = 0; i < 5; i++) f.apply(state);
  assert.deepEqual(f.writes(), []);
  assert.equal(f.nodes.gaAudioOutputStatus.textContent, 'Ausgabe: PC · Terrain fehlt');
});

test('changed settings, replacement nodes and external edits still update', () => {
  const f = fixture(); f.apply(); f.reset();
  f.apply({ ...f.state, settings: { ...f.state.settings, volume: .35, terrain: false, voicePack: 'liam' } });
  assert.equal(f.nodes.awmVolumeSlider.value, '35');
  assert.equal(f.nodes.awmVolumeLabel.textContent, '35%');
  assert.equal(f.nodes.awmTerrainWarnCheck.checked, false);
  assert.equal(f.nodes.gaWarningVoiceSelect.value, 'liam');
  f.node('gaAudioOutputSelect');
  f.nodes.awmVolumeSlider.value = '12'; f.apply();
  assert.equal(f.nodes.gaAudioOutputSelect.value, 'pc');
  assert.equal(f.nodes.awmVolumeSlider.value, '100');
});

test('polls do not overwrite a focused select or slider; blur resumes sync', () => {
  for (const id of ['gaAudioOutputSelect','gaWarningVoiceSelect','awmPaxAudioStyleSelect','awmVolumeSlider']) {
    const f = fixture(); f.apply();
    const control = f.nodes[id]; f.root.document.activeElement = control;
    control.value = 'user-in-progress'; f.reset();
    f.apply();
    assert.equal(control.value, 'user-in-progress', id);
    assert.equal(f.writes().includes(id + '.value'), false, id);
    f.root.document.activeElement = null; f.apply();
    assert.notEqual(control.value, 'user-in-progress', id);
  }
});

if (process.env.GA_AUDIO_MENU_BASELINE) test('baseline demonstrates redundant native control writes', () => {
  const f = fixture(process.env.GA_AUDIO_MENU_BASELINE); f.apply(); f.reset();
  for (let i = 0; i < 20; i++) f.apply();
  assert.ok(f.writes().length > 100);
  assert.ok(f.writes().includes('gaAudioOutputSelect.value'));
  console.log('Baseline audio-menu writes over 20 identical polls:', f.writes().length);
});
