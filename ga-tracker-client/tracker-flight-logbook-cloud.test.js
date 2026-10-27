const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createFlightLogbookCloud } = require('./tracker-flight-logbook-cloud.js');
const { createFlightTrackStore } = require('./tracker-flight-track-store.js');
const codec = require('../flight-track-codec-core.js');

const track = codec.encodeTrack(Array.from({ length: 100 }, (_, i) => ({ observedAt: 1e12 + i * 1000, lat: 48 + i * 0.001, lon: 9 + Math.sin(i / 7) * 0.01, altFt: 2000 + i, aglFt: 1000, onGround: false })));
function setup() {
  const store = createFlightTrackStore({ directory: fs.mkdtempSync(path.join(os.tmpdir(), 'fl-cloud-')) });
  store.putTrack({ kind: 'mission', runId: 'run-m', missionId: 'mission-m', startTs: 1, endTs: 2, track });
  store.putTrack({ kind: 'free', runId: 'free-1', completionId: 'free-1', startTs: 3, endTs: 4, track, entry: { kind: 'free', runId: 'free-1', durationSec: 600, distanceNm: 9 } });
  return store;
}

test('uploads free flights first with their record, then mission tracks; marks them done', async () => {
  const store = setup(); const calls = []; const acked = [];
  const cloud = createFlightLogbookCloud({ store, pilotId: 'P', pin: '1', onUploaded: f => acked.push(f.runId),
    transport: async (url, init) => { calls.push({ url, body: JSON.parse(init.body), headers: init.headers }); return { ok: true, status: 200, data: {} }; } });
  assert.equal((await cloud.flush()).uploaded, 2);
  assert.deepEqual(calls.map(c => c.body.entry.runId), ['free-1', 'run-m']);
  assert.equal(calls[0].body.entry.distanceNm, 9);
  assert.equal(calls[1].body.entry.missionId, 'mission-m');
  assert.equal(calls[0].headers['X-Pilot-ID'], 'P');
  assert.equal(calls[0].body.track.enc, track.enc);
  assert.deepEqual(acked, ['free-1', 'run-m']);
  assert.equal(store.pendingUploads().length, 0);
  assert.equal((await cloud.flush()).status, 'empty');
});

test('network errors back off and retry later; refused data is not retried', async () => {
  const store = setup(); let t = 0; let mode = 'down';
  const cloud = createFlightLogbookCloud({ store, pilotId: 'P', pin: '1', now: () => t,
    transport: async (url, init) => { if (mode === 'down') throw Error('offline'); return JSON.parse(init.body).entry.kind === 'free' ? { ok: false, status: 413, data: { error: 'track_too_large' } } : { ok: true, status: 200 }; } });
  assert.equal((await cloud.flush()).status, 'pending');
  assert.equal((await cloud.flush()).status, 'deferred');
  t = 60000; mode = 'up';
  assert.equal((await cloud.flush()).uploaded, 1);
  assert.equal(store.pendingUploads().length, 0);
  assert.equal(store.getTrack('free-1').uploadStatus, 'rejected-413');
});

test('re-saving an unchanged track keeps it uploaded; a changed one goes up again', async () => {
  const store = setup();
  store.markUploaded('run-m');
  store.putTrack({ kind: 'mission', runId: 'run-m', missionId: 'mission-m', startTs: 1, endTs: 2, track });
  assert.ok(store.getTrack('run-m').uploadedAt);
  store.putTrack({ kind: 'mission', runId: 'run-m', missionId: 'mission-m', startTs: 1, endTs: 2, track: { ...track, t0: 5 , enc: track.enc + '?' } });
  assert.equal(store.getTrack('run-m').uploadedAt, null);
});

test('farewell words travel with the mission track, also when they arrive after the upload', async () => {
  const store = setup(); const bodies = [];
  const cloud = createFlightLogbookCloud({ store, pilotId: 'P', pin: '1',
    transport: async (url, init) => { bodies.push(JSON.parse(init.body)); return { ok: true, status: 200 }; } });
  await cloud.flush();
  assert.equal(bodies.find(b => b.entry.runId === 'run-m').entry.farewellText, undefined);
  assert.equal(store.putNote('run-m', { farewellText: 'Danke, das war ein ruhiger Flug.', farewellSpeaker: 'Anna', farewellRole: 'Fotografin' }), true);
  assert.equal(store.pendingUploads().map(t => t.runId).join(), 'run-m');
  bodies.length = 0;
  await cloud.flush();
  assert.equal(bodies.length, 1);
  assert.equal(bodies[0].entry.farewellText, 'Danke, das war ein ruhiger Flug.');
  assert.equal(bodies[0].entry.farewellSpeaker, 'Anna');
  assert.equal(store.putNote('run-x', { farewellText: '' }), false);
});

test('a note recorded before the track exists is sent with the first upload', async () => {
  const store = createFlightTrackStore({ directory: fs.mkdtempSync(path.join(os.tmpdir(), 'fl-note-')) });
  store.putNote('run-late', { farewellText: 'Bis zum nächsten Mal!' });
  assert.equal(store.listTracks().length, 0, 'note files are not tracks');
  store.putTrack({ kind: 'mission', runId: 'run-late', missionId: 'mission-late', startTs: 1, endTs: 2, track });
  const bodies = [];
  await createFlightLogbookCloud({ store, pilotId: 'P', pin: '1', transport: async (url, init) => { bodies.push(JSON.parse(init.body)); return { ok: true, status: 200 }; } }).flush();
  assert.equal(bodies[0].entry.farewellText, 'Bis zum nächsten Mal!');
});
