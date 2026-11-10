'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createAircraftIcons, normalizePresets } = require('./tracker-aircraft-icons');

test('presets keep name and icon, selected only when it exists, invalid icon values become null', () => {
  const field = {
    'PA-24': { name: 'Comanche', icon: { custom: true, kind: 'single', color: '#FFAA00', size: 34 } },
    heli: { name: 'R44', icon: { custom: true, kind: 'heli<script>', color: 'red', size: 999 } },
    _library: { version: 2, order: ['PA-24', 'heli'], quick: ['PA-24'], selected: 'heli' }
  };
  const out = normalizePresets(field);
  assert.deepEqual(out.presets['PA-24'].icon, { custom: true, kind: 'single', color: '#ffaa00', size: 34 });
  assert.deepEqual(out.presets.heli.icon, { custom: true, kind: null, color: null, size: null });
  assert.equal(out.selected, 'heli');
  assert.equal(out.presets._library, undefined);
  assert.equal(normalizePresets({ ...field, _library: { selected: 'GONE' } }).selected, '');
});

// Minimal Sync-v2 head/chunk responder backed by a packed profile (as in the favorites test).
async function fakeCloud(profile) {
  const core = require('../cloud-sync-core');
  const packed = await core.pack(profile);
  let reads = 0, fail = false;
  const request = async url => {
    reads++;
    if (fail) throw new Error('offline');
    if (url.includes('/head')) return { ok: true, status: 200, json: async () => ({ revision: 3, manifest: packed.manifest }) };
    const chunk = url.match(/chunk\/([a-f0-9]{64})/);
    if (chunk) return { ok: true, status: 200, json: async () => ({ data: packed.chunks[chunk[1]] }) };
    return { ok: false, status: 404, json: async () => ({}) };
  };
  return { request, reads: () => reads, setFail: value => { fail = value; } };
}

test('reads the profile field once per interval and keeps the last icons when offline', async () => {
  const cloud = await fakeCloud({ activeMission: null, activeMissionTrackerSeed: null,
    aircraftPresets: { C172: { name: 'Skyhawk', icon: { custom: true, kind: 'single' } }, _library: { selected: 'C172' } } });
  let t = 1000;
  const icons = createAircraftIcons({ pilotId: 'P', pin: '1', request: cloud.request, now: () => t, refreshMs: 1000 });
  const first = await icons.refresh();
  assert.equal(first.available, true);
  assert.equal(first.selected, 'C172');
  assert.equal(first.presets.C172.name, 'Skyhawk');
  const before = cloud.reads();
  t += 500;
  await icons.refresh();
  assert.equal(cloud.reads(), before, 'no second read inside the interval');
  cloud.setFail(true); t += 5000;
  const offline = await icons.refresh();
  assert.equal(offline.selected, 'C172', 'offline keeps the last icons');
});
