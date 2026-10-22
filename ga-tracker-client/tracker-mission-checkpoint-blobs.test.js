'use strict';
// Aufgeteilter Missionsstand: grosse, unveraenderte Teile liegen als eigene
// Dateien neben mission-authority-v1.json. Diese Tests decken Absturzluecken,
// fehlende/beschaedigte Teile, Schreibfehler, Aufraeumen, nachtraegliche
// Aenderungen und den Rueckfall-Schalter ab.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createMissionAuthorityManager, resumeBundleBytes } = require('./mission-authority-core.js');
const { blobDirectory, STORAGE_FORMAT } = require('./tracker-mission-checkpoint-blobs.js');

function setup(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ga-checkpoint-blobs-'));
  const storageFile = path.join(directory, 'mission-authority-v1.json');
  const managers = [];
  const logs = [];
  let runs = 0;
  const create = (extra = {}) => {
    const manager = createMissionAuthorityManager({ storageFile, periodicCheckpoint: true, checkpointIntervalMs: 600000,
      checkpointMinBlobBytes: 1024, idFactory: () => `run-${++runs}`, log: line => logs.push(line), ...extra });
    managers.push(manager);
    return manager;
  };
  t.after(() => { for (const manager of managers) manager.stopPersistence(); fs.rmSync(directory, { recursive: true, force: true }); });
  return { directory, storageFile, create, logs, blobs: () => {
    try { return fs.readdirSync(blobDirectory(storageFile)).sort(); } catch (_) { return []; }
  }, main: () => JSON.parse(fs.readFileSync(storageFile, 'utf8')) };
}
const bigBundle = (missionId, filler = 'a') => ({
  version: 2, missionId, adapter: 'apt', descriptor: { primaryAdapter: 'apt' },
  missionState: { currentMissionData: { missionId, story: filler.repeat(20000), umlaut: 'Flugplatz Donaueschingen – Ö' } },
  executionEffectPlan: { schema: 'plan', effects: { voice: { text: filler.repeat(5000) } } },
  runtime: { phase: 'planned' }
});
async function acquire(manager, missionId, filler) {
  const result = manager.acquire({ missionId, clientId: 'app', stateHash: 'h', resumeBundle: bigBundle(missionId, filler) });
  assert.equal(result.ok, true, JSON.stringify(result));
  return result.activeRun;
}
const bundleOf = manager => manager.requestSnapshot({}).resumeBundle;

test('erster Checkpoint bleibt altes v1-Format, ab dem zweiten werden stabile Teile ausgelagert', async t => {
  const x = setup(t);
  const manager = x.create();
  await acquire(manager, 'mission-a');
  assert.equal(await manager.flushPersistence(), true);
  assert.equal(x.main().version, 1, 'ohne Verweise exakt das alte Format');
  assert.equal(typeof x.main().activeRun.resumeBundle.missionState, 'object');
  assert.deepEqual(x.blobs(), []);
  manager.recordCommand({ type: 'mission_scene_boarding', missionId: 'mission-a', runId: 'run-1', clientId: 'app', commandId: 'c1' });
  assert.equal(await manager.flushPersistence(), true);
  const main = x.main();
  assert.equal(main.version, 2);
  assert.equal(main.storageFormat, STORAGE_FORMAT);
  assert.match(main.activeRun.resumeBundle.missionState.$missionBlob, /^[0-9a-f]{64}$/);
  assert.equal(main.activeRun.resumeBundle.runtime.phase, 'planned', 'kleine Teile bleiben inline');
  assert.equal(x.blobs().length, 2);
  const reloaded = x.create();
  assert.deepEqual(bundleOf(reloaded), bigBundle('mission-a'));
  assert.ok(x.logs.some(line => /MISSION_AUTHORITY_LOADED .*format=blob-refs blobParts=2/.test(line)));
});

test('nach Neustart werden geladene Teile sofort wieder referenziert und nicht neu geschrieben', async t => {
  const x = setup(t);
  const first = x.create();
  await acquire(first, 'mission-a');
  await first.flushPersistence();
  first.recordCommand({ type: 'mission_scene_boarding', missionId: 'mission-a', runId: 'run-1', clientId: 'app', commandId: 'c1' });
  await first.flushPersistence();
  const before = x.blobs().map(name => fs.statSync(path.join(blobDirectory(x.storageFile), name)).mtimeMs);
  const second = x.create();
  second.recordCommand({ type: 'mission_scene_boarding', missionId: 'mission-a', runId: 'run-1', clientId: 'app', commandId: 'c2' });
  assert.equal(await second.flushPersistence(), true);
  assert.equal(x.main().version, 2);
  const metrics = second.getPersistenceMetrics();
  assert.equal(metrics.blobs.blobWrites, 0);
  assert.equal(metrics.blobs.blobReuses, 2);
  assert.ok(metrics.bytes < 4000, `Hauptdatei klein: ${metrics.bytes}`);
  assert.deepEqual(x.blobs().map(name => fs.statSync(path.join(blobDirectory(x.storageFile), name)).mtimeMs), before);
});

async function twoCheckpoints(manager, missionId = 'mission-a', runId = 'run-1') {
  await manager.flushPersistence();
  manager.recordCommand({ type: 'mission_scene_boarding', missionId, runId, clientId: 'app', commandId: `c-${Math.random()}` });
  assert.equal(await manager.flushPersistence(), true);
}

test('fehlende Teil-Datei: Lauf wird nicht halb geladen, sondern verworfen und protokolliert', async t => {
  const x = setup(t);
  const manager = x.create();
  await acquire(manager, 'mission-a');
  await twoCheckpoints(manager);
  fs.rmSync(blobDirectory(x.storageFile), { recursive: true, force: true });
  const reloaded = x.create();
  assert.equal(reloaded.getActiveRun(), null);
  assert.ok(x.logs.some(line => /MISSION_AUTHORITY_BLOB_MISSING run=activeRun mission=mission-a .*error=ENOENT/.test(line)));
});

test('beschaedigte Teil-Datei wird am Hash erkannt', async t => {
  const x = setup(t);
  const manager = x.create();
  await acquire(manager, 'mission-a');
  await twoCheckpoints(manager);
  const [name] = x.blobs();
  const file = path.join(blobDirectory(x.storageFile), name);
  fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('a', 'b'));
  const reloaded = x.create();
  assert.equal(reloaded.getActiveRun(), null);
  assert.ok(x.logs.some(line => /MISSION_AUTHORITY_BLOB_MISSING .*error=mission_checkpoint_blob_corrupt/.test(line)));
});

test('nur der betroffene Lauf faellt weg: aktiver Lauf bleibt, wenn nur der alte Lauf beschaedigt ist', async t => {
  const x = setup(t);
  const manager = x.create();
  const run = await acquire(manager, 'mission-a', 'a');
  assert.equal(manager.release({ missionId: 'mission-a', runId: run.runId, clientId: 'app', outcome: 'completed' }).ok, true);
  await acquire(manager, 'mission-b', 'b');
  await twoCheckpoints(manager, 'mission-b', 'run-2');
  const main = x.main();
  const oldHash = main.lastRun.resumeBundle.missionState.$missionBlob;
  assert.notEqual(oldHash, main.activeRun.resumeBundle.missionState.$missionBlob);
  fs.rmSync(path.join(blobDirectory(x.storageFile), `${oldHash}.json`));
  const reloaded = x.create();
  assert.equal(reloaded.getActiveRun().missionId, 'mission-b');
  assert.deepEqual(bundleOf(reloaded), bigBundle('mission-b', 'b'));
  assert.ok(x.logs.some(line => /MISSION_AUTHORITY_BLOB_MISSING run=lastRun mission=mission-a/.test(line)));
});

test('derselbe Missionsinhalt in aktivem und altem Lauf liegt nur einmal auf der Platte', async t => {
  const x = setup(t);
  const manager = x.create();
  const run = await acquire(manager, 'mission-a');
  manager.release({ missionId: 'mission-a', runId: run.runId, clientId: 'app', outcome: 'ended' });
  await acquire(manager, 'mission-a');
  await twoCheckpoints(manager, 'mission-a', 'run-2');
  const main = x.main();
  assert.equal(main.lastRun.resumeBundle.missionState.$missionBlob, main.activeRun.resumeBundle.missionState.$missionBlob);
  assert.equal(x.blobs().length, 2);
});

test('Absturz zwischen Teil-Dateien und Hauptdatei: alte Hauptdatei bleibt gueltig, Waisen werden spaeter entfernt', async t => {
  const x = setup(t);
  const manager = x.create();
  await acquire(manager, 'mission-a');
  await manager.flushPersistence();
  const v1 = fs.readFileSync(x.storageFile, 'utf8');
  // Teil-Dateien geschrieben, Hauptdatei-Umbenennung schlaegt fehl.
  const failingIo = Object.create(fs.promises);
  failingIo.rename = async (from, to) => { if (to === x.storageFile) throw Object.assign(new Error('power loss'), { code: 'EIO' }); return fs.promises.rename(from, to); };
  const crashing = x.create({ checkpointIo: failingIo });
  crashing.recordCommand({ type: 'mission_scene_boarding', missionId: 'mission-a', runId: 'run-1', clientId: 'app', commandId: 'x1' });
  await crashing.flushPersistence();
  crashing.recordCommand({ type: 'mission_scene_boarding', missionId: 'mission-a', runId: 'run-1', clientId: 'app', commandId: 'x2' });
  assert.equal(await crashing.flushPersistence(), false);
  assert.equal(fs.readFileSync(x.storageFile, 'utf8'), v1, 'Hauptdatei unveraendert');
  assert.equal(x.blobs().length, 2, 'verwaiste Teil-Dateien liegen herum');
  fs.writeFileSync(path.join(blobDirectory(x.storageFile), `${'f'.repeat(64)}.json.tmp`), 'halb');
  const reloaded = x.create();
  assert.deepEqual(bundleOf(reloaded), bigBundle('mission-a'));
  assert.equal(reloaded.release({ missionId: 'mission-a', runId: 'run-1', clientId: 'app', outcome: 'ended' }).ok, true);
  assert.equal(reloaded.clearMissionRecoveryState({ reason: 'test' }).ok, true);
  assert.equal(await reloaded.flushPersistence(), true);
  assert.deepEqual(x.blobs(), [], 'nach leerem Stand ist alles aufgeraeumt, auch .tmp-Reste');
});

test('Schreibfehler bei Teil-Dateien: Checkpoint faellt auf das vollstaendige Inline-Format zurueck', async t => {
  const x = setup(t);
  const failingIo = Object.create(fs.promises);
  failingIo.open = async () => { throw Object.assign(new Error('disk full'), { code: 'ENOSPC' }); };
  const manager = x.create({ checkpointIo: failingIo });
  await acquire(manager, 'mission-a');
  await twoCheckpoints(manager);
  assert.equal(x.main().version, 1);
  assert.equal(x.main().activeRun.resumeBundle.missionState.currentMissionData.missionId, 'mission-a');
  assert.equal(manager.getPersistenceMetrics().blobs.blobFallbacks, 1);
  assert.ok(x.logs.some(line => /MISSION_CHECKPOINT_BLOB_FALLBACK error=ENOSPC/.test(line)));
  assert.deepEqual(bundleOf(x.create()), bigBundle('mission-a'));
});

test('gesperrte alte Teil-Datei (Virenscanner/OneDrive) wird beim naechsten Checkpoint erneut geloescht', async t => {
  const x = setup(t);
  let locked = true;
  const lockingIo = Object.create(fs.promises);
  lockingIo.unlink = async file => { if (locked) throw Object.assign(new Error('busy'), { code: 'EBUSY' }); return fs.promises.unlink(file); };
  const manager = x.create({ checkpointIo: lockingIo });
  const run = await acquire(manager, 'mission-a', 'a');
  await twoCheckpoints(manager);
  manager.release({ missionId: 'mission-a', runId: run.runId, clientId: 'app', outcome: 'ended' });
  manager.clearMissionRecoveryState({ reason: 'test' });
  assert.equal(await manager.flushPersistence(), true);
  assert.equal(x.blobs().length, 2, 'Loeschen war gesperrt');
  assert.ok(x.logs.some(line => /MISSION_CHECKPOINT_BLOB_GC_ERROR .*error=EBUSY/.test(line)));
  locked = false;
  manager.recordCommand({ type: 'noop' });
  await acquire(manager, 'mission-b', 'b');
  await manager.flushPersistence();
  assert.ok(!x.blobs().some(name => fs.readFileSync(path.join(blobDirectory(x.storageFile), name), 'utf8').includes('"missionId":"mission-a"')));
});

test('extern geloeschte Teil-Datei wird beim naechsten Checkpoint neu geschrieben', async t => {
  const x = setup(t);
  const manager = x.create();
  await acquire(manager, 'mission-a');
  await twoCheckpoints(manager);
  fs.rmSync(blobDirectory(x.storageFile), { recursive: true, force: true });
  manager.recordCommand({ type: 'mission_scene_boarding', missionId: 'mission-a', runId: 'run-1', clientId: 'app', commandId: 'again' });
  assert.equal(await manager.flushPersistence(), true);
  assert.equal(x.blobs().length, 2);
  assert.deepEqual(bundleOf(x.create()), bigBundle('mission-a'));
});

test('nachtraeglich veraendertes Teil wird per Stichprobe erkannt und mit aktuellem Inhalt gespeichert', async t => {
  const x = setup(t);
  const { createBlobCheckpointFormat } = require('./tracker-mission-checkpoint-blobs.js');
  const format = createBlobCheckpointFormat({ filename: x.storageFile, io: fs.promises, minBlobBytes: 10, auditIntervalMs: 0 });
  const part = { text: 'original'.repeat(10) };
  const state = { schema: 'ga.mission-authority.v1', version: 1, activeRun: { missionId: 'm', runId: 'r', resumeBundle: { part } } };
  format.capture(state);
  const captured = format.capture(state);
  await format.writeBlobs(captured);
  const firstHash = JSON.parse(captured.text).activeRun.resumeBundle.part.$missionBlob;
  // Regelverstoss simulieren: ein ausgelagertes Teil wird an Ort und Stelle geaendert.
  part.text = 'geaendert';
  await assert.rejects(format.writeBlobs(format.capture(state)), /mission_checkpoint_blob_hash_mismatch/);
  assert.equal(format.metrics().blobDrift, 1);
  const recovered = format.capture(state);
  await format.writeBlobs(recovered);
  const secondHash = JSON.parse(recovered.text).activeRun.resumeBundle.part.$missionBlob;
  assert.notEqual(secondHash, firstHash, 'neuer Inhalt bekommt eine neue Teil-Datei');
  assert.equal(JSON.parse(fs.readFileSync(path.join(blobDirectory(x.storageFile), `${secondHash}.json`), 'utf8')).text, 'geaendert');
});

test('Rueckfall-Schalter: checkpointBlobs=false schreibt immer das alte Format, liest aber beide', async t => {
  const x = setup(t);
  const withBlobs = x.create();
  await acquire(withBlobs, 'mission-a');
  await twoCheckpoints(withBlobs);
  assert.equal(x.main().version, 2);
  const inline = x.create({ checkpointBlobs: false });
  assert.deepEqual(bundleOf(inline), bigBundle('mission-a'));
  await twoCheckpoints(inline);
  assert.equal(x.main().version, 1);
  assert.equal(inline.getPersistenceMetrics().format, 'inline');
  assert.deepEqual(bundleOf(x.create({ checkpointBlobs: false })), bigBundle('mission-a'));
});

test('alter Tracker (nur v1) ignoriert eine v2-Datei statt sie halb zu laden', async t => {
  const x = setup(t);
  const manager = x.create();
  await acquire(manager, 'mission-a');
  await twoCheckpoints(manager);
  const parsed = x.main();
  // Pruefung der alten Ladefunktion: schema gleich, version !== 1 -> verwerfen.
  assert.equal(parsed.schema, 'ga.mission-authority.v1');
  assert.notEqual(Number(parsed.version), 1);
});

test('inkrementelle Groessenpruefung entspricht exakt der vollstaendigen Messung', () => {
  const shared = { big: 'ü'.repeat(5000), list: [1, 'zwei', null, { drei: true }] };
  const cases = [
    { a: 1, b: 'text', c: null, d: shared, e: [shared, 2], f: undefined, g: () => 1, h: true, i: -0, j: 1e21, k: '"\\\n' },
    {}, { only: undefined }, { nested: { date: new Date(0) } }, { 'schlüssel mit "Zeichen"': shared }
  ];
  for (const value of cases) assert.equal(resumeBundleBytes(value), Buffer.byteLength(JSON.stringify(value)), JSON.stringify(value).slice(0, 60));
  const next = { ...cases[0], d: shared, extra: 'neu' };
  assert.equal(resumeBundleBytes(next), Buffer.byteLength(JSON.stringify(next)));
});

const realFile = process.env.GA_MISSION_AUTHORITY_SAMPLE;
test('echte Missionsdatei vom schwachen Rechner: laden, aufteilen, identisch wieder laden', { skip: !realFile && 'GA_MISSION_AUTHORITY_SAMPLE nicht gesetzt' }, async t => {
  const x = setup(t);
  fs.copyFileSync(realFile, x.storageFile);
  const original = x.create({ checkpointMinBlobBytes: undefined });
  const before = { active: original.getActiveRun({ includeBundle: true, includeEffects: true }), last: original.getPublicSnapshot().lastRun,
    snapshot: original.getExecutionSnapshot(), bundle: bundleOf(original) };
  const fullBytes = fs.statSync(x.storageFile).size;
  const touch = (manager, n) => assert.equal(manager.recordExecutionLastPosition({ missionId: before.active.missionId,
    runId: before.active.runId, position: { lat: 48.2769, lon: 8.4309 + n / 1e5, altFt: 2202, onGround: true } }).ok, true);
  touch(original, 1);
  assert.equal(await original.flushPersistence(), true);
  touch(original, 2);
  assert.equal(await original.flushPersistence(), true);
  before.snapshot = original.getExecutionSnapshot();
  before.last = original.getPublicSnapshot().lastRun;
  const splitBytes = fs.statSync(x.storageFile).size;
  const reloaded = x.create({ checkpointMinBlobBytes: undefined });
  assert.deepEqual(reloaded.getExecutionSnapshot(), before.snapshot);
  touch(reloaded, 3);
  assert.equal(await reloaded.flushPersistence(), true);
  const steadyBytes = reloaded.getPersistenceMetrics().bytes;
  t.diagnostic(`Datei vorher ${Math.round(fullBytes / 1024)} KB, Hauptdatei danach ${Math.round(splitBytes / 1024)} KB, Checkpoint nach Neustart ${Math.round(steadyBytes / 1024)} KB, Teil-Dateien ${x.blobs().length}`);
  assert.ok(splitBytes < fullBytes / 4, `Hauptdatei ${splitBytes} B`);
  assert.equal(reloaded.getPersistenceMetrics().blobs.blobWrites, 0);
  assert.deepEqual(bundleOf(reloaded), before.bundle);
  assert.deepEqual(reloaded.getPublicSnapshot().lastRun, before.last);
});
