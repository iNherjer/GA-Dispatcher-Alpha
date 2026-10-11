'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createComplianceSanctions } = require('./tracker-compliance-sanctions.js');
const copy = value => JSON.parse(JSON.stringify(value));
const at = Date.now();

function effect(flightId = 'flight-1') {
  return { commandId: 'effect-' + flightId, effect: { payload: { record: {
    id: 'sanction-' + flightId, type: 'authority_sanction', flightId,
    createdAt: at, expiresAt: at + 7 * 86400000, immutableUntil: at + 7 * 86400000,
    offences: [{ code: 'overdue_first-aid', severity: 'entry' }], text: 'BEHOERDENEINTRAG'
  } } } };
}
async function fixture(t) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ga-sanctions-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  let clock = at, revision = 1, profile = { pinboard: [{ id: 'normal', text: 'Keep me' }], settings: { keep: true } };
  let writes = 0, reads = 0;
  const client = {
    async read() { reads++; return { migrated: true, revision, profile: copy(profile) }; },
    async write(value, options) {
      if (options.expectedRevision !== revision) throw Object.assign(Error('conflict'), { status: 409 });
      writes++; profile = copy(value); revision++;
    }
  };
  const options = { storageFile: path.join(dir, 'outbox.json'), pilotId: 'PILOT', pin: 'not-a-real-pin', client, now: () => clock };
  return { options, client, service: createComplianceSanctions(options),
    advance: ms => { clock += ms; }, profile: () => copy(profile), writes: () => writes, reads: () => reads,
    update: change => { change(profile); revision++; } };
}

test('offline effect ACK is durable and survives restart, duplicate dispatch and mission replacement', async t => {
  const f = await fixture(t);
  f.client.read = async () => { throw Error('offline'); };
  assert.equal((await f.service.record(effect())).ok, true);
  const stored = JSON.parse(await fs.readFile(f.options.storageFile, 'utf8'));
  assert.equal(stored.entries[0].savedAt, null);
  assert.equal((await f.service.flush()).status, 'pending');
  const restarted = createComplianceSanctions({ ...f.options, client: {
    read: async () => ({ migrated: true, revision: 1, profile: f.profile() }), write: async value => {
      assert.equal(value.pinboard.length, 2); assert.equal(value.pinboard[1].flightId, 'flight-1');
    }
  } });
  assert.equal((await restarted.record(effect())).sideEffect, false);
  assert.equal((await restarted.flush()).status, 'saved');
  assert.equal((await restarted.flush()).status, 'empty');
  assert.equal((await restarted.record(effect())).sideEffect, false);
  assert.equal((await restarted.flush()).status, 'empty');
});

test('cloud merge retains unrelated profile fields and existing board positions, without extending seven days', async t => {
  const f = await fixture(t);
  f.update(profile => profile.pinboard.push({ ...effect().effect.payload.record, id: 'app-id', x: 12, y: 34, rot: 5 }));
  await f.service.record(effect()); f.advance(60000);
  assert.equal((await f.service.flush()).status, 'saved');
  assert.equal(f.writes(), 0, 'identical App entry needs no upload');
  const record = f.profile().pinboard[1];
  assert.equal(record.id, 'app-id'); assert.equal(record.x, 12);
  assert.equal(record.expiresAt, at + 7 * 86400000);
  assert.deepEqual(f.profile().settings, { keep: true });
});

test('409 retry re-reads and retains concurrent board edits, and concurrent records are not falsely acknowledged', async t => {
  const f = await fixture(t); const write = f.client.write;
  let first = true;
  f.client.write = async (...args) => {
    if (first) {
      first = false; f.update(profile => profile.pinboard.push({ id: 'concurrent', text: 'New note' }));
      await f.service.record(effect('flight-2'));
      throw Object.assign(Error('conflict'), { status: 409 });
    }
    return write(...args);
  };
  await f.service.record(effect());
  assert.equal((await f.service.flush()).status, 'saved');
  assert.ok(f.profile().pinboard.some(note => note.id === 'concurrent'));
  const disk = JSON.parse(await fs.readFile(f.options.storageFile, 'utf8'));
  assert.equal(disk.entries.find(row => row.record.flightId === 'flight-2').savedAt, null);
  assert.equal((await f.service.flush()).status, 'saved');
  assert.equal(f.profile().pinboard.filter(note => note.type === 'authority_sanction').length, 2);
});

test('failed local save never ACKs; failed cloud-ACK save safely retries without duplicating the cloud entry', async t => {
  const f = await fixture(t); let fail = true;
  const disk = { ...fs, rename: async (...args) => { if (fail) throw Error('disk unavailable'); return fs.rename(...args); } };
  const service = createComplianceSanctions({ ...f.options, fs: disk });
  await assert.rejects(service.record(effect()), /disk unavailable/);
  fail = false; await service.record(effect());
  fail = true; assert.equal((await service.flush()).status, 'pending');
  assert.equal(f.writes(), 1);
  fail = false; f.advance(6000);
  assert.equal((await service.flush()).status, 'saved');
  assert.equal(f.writes(), 1);
  assert.equal(f.profile().pinboard.filter(note => note.type === 'authority_sanction').length, 1);
});

test('account changes do not upload another pilot outbox; expired entries do not reappear', async t => {
  const f = await fixture(t); await f.service.record(effect());
  const other = createComplianceSanctions({ ...f.options, pilotId: 'OTHER' });
  assert.equal((await other.flush()).status, 'empty'); assert.equal(f.reads(), 0);
  f.advance(8 * 86400000);
  assert.equal((await f.service.flush()).status, 'saved'); assert.equal(f.reads(), 0);
  assert.equal(f.profile().pinboard.length, 1);
});

test('corrupt outbox and invalid pinboard remain pending rather than overwrite stored data', async t => {
  const f = await fixture(t); await fs.writeFile(f.options.storageFile, '{bad');
  assert.equal((await f.service.flush()).status, 'pending');
  assert.equal(await fs.readFile(f.options.storageFile, 'utf8'), '{bad');
  await fs.unlink(f.options.storageFile);
  const service = createComplianceSanctions(f.options); await service.record(effect());
  f.update(profile => { profile.pinboard = 'invalid'; });
  assert.equal((await service.flush()).status, 'pending'); assert.equal(f.writes(), 0);
});

test('an uncertain successful cloud upload is retried idempotently after restart', async t => {
  const f = await fixture(t); const write = f.client.write;
  f.client.write = async (...args) => { await write(...args); throw Error('response lost'); };
  await f.service.record(effect());
  assert.equal((await f.service.flush()).status, 'pending');
  assert.equal(f.profile().pinboard.filter(note => note.type === 'authority_sanction').length, 1);
  f.client.write = write;
  const restarted = createComplianceSanctions(f.options);
  assert.equal((await restarted.flush()).status, 'saved');
  assert.equal(f.writes(), 1);
});
