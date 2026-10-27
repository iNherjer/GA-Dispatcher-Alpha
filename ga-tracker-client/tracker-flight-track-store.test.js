const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createFlightTrackStore } = require('./tracker-flight-track-store.js');
const trackCodec = require('../flight-track-codec-core.js');

function samples(n, t0 = 1790000000000) {
  return Array.from({ length: n }, (_, i) => ({ observedAt: t0 + i * 500, lat: 48 + i * 0.0003, lon: 9 + Math.sin(i / 40) * 0.01,
    altFt: 2000 + i, aglFt: 1500, onGround: i < 5 || i > n - 5, gsKts: 90 }));
}

test('tracks are stored per run and pruned to the newest per kind', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tracks-'));
  const store = createFlightTrackStore({ directory: dir, keepPerKind: 3 });
  const track = trackCodec.encodeTrack(samples(200));
  for (let i = 0; i < 5; i += 1) store.putTrack({ kind: 'free', runId: `free-${i}`, endTs: 1000 + i, track });
  store.putTrack({ kind: 'mission', runId: 'run-a', missionId: 'mission-a', endTs: 1, track });
  const list = store.listTracks();
  assert.deepEqual(list.filter(t => t.kind === 'free').map(t => t.runId), ['free-4', 'free-3', 'free-2']);
  assert.equal(list.filter(t => t.kind === 'mission').length, 1);
  assert.equal(store.getTrack('run-a').track.enc, track.enc);
  assert.equal(store.getTrack('free-0'), null);
});

test('mission raw logs are backfilled once', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tracks-'));
  const lines = [{ type: 'run_started', missionId: 'mission-x', runId: 'run-x' },
    ...samples(400).map(sample => ({ type: 'telemetry', phase: 'enroute', sample })),
    { type: 'run_completed', summary: { endedAt: 1790000300000 } }];
  fs.writeFileSync(path.join(dir, 'mission-x--run-x.jsonl'), lines.map(l => JSON.stringify(l)).join('\n'));
  fs.writeFileSync(path.join(dir, 'mission-y--run-y.jsonl'), JSON.stringify({ type: 'run_started', missionId: 'mission-y', runId: 'run-y' }));
  const store = createFlightTrackStore({ directory: dir });
  assert.equal(await store.backfillMissionTracks(), 1);
  const t = store.getTrack('run-x');
  assert.equal(t.kind, 'mission');
  assert.equal(t.missionId, 'mission-x');
  assert.equal(t.endTs, 1790000300000);
  assert.ok(trackCodec.decodeTrack(t.track).length > 1);
  assert.equal(await store.backfillMissionTracks(), 0);
});
