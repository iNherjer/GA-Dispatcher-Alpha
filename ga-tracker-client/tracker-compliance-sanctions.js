'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const https = require('node:https');
const sync = require('../cloud-sync-client.js');

const copy = value => JSON.parse(JSON.stringify(value));

function request(url, init = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, { method: init.method || 'GET', headers: init.headers }, res => {
      const chunks = []; let size = 0;
      res.on('data', chunk => {
        size += chunk.length;
        if (size > 96 * 1024) { res.destroy(Error('sanction_response_too_large')); return; }
        chunks.push(chunk);
      });
      res.on('error', reject);
      res.on('end', () => {
        try {
          const data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
          resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, json: async () => data });
        } catch (error) { reject(error); }
      });
    });
    req.setTimeout(15000, () => req.destroy(Error('sanction_sync_timeout')));
    req.on('error', reject); req.end(init.body);
  });
}

function mergeSanction(notes, record) {
  if (!Array.isArray(notes)) throw Error('sanction_pinboard_invalid');
  const result = copy(notes);
  const index = result.findIndex(note => note?.type === 'authority_sanction'
    && String(note.flightId || '') === record.flightId);
  const existing = index >= 0 ? result[index] : null;
  const merged = {
    ...record,
    id: existing?.id || record.id,
    createdAt: existing?.createdAt || record.createdAt,
    immutableUntil: Math.max(Number(existing?.immutableUntil || 0), record.immutableUntil),
    expiresAt: Math.max(Number(existing?.expiresAt || 0), record.expiresAt),
    x: existing?.x ?? record.x ?? 68,
    y: existing?.y ?? record.y ?? 22,
    rot: existing?.rot ?? record.rot ?? -2
  };
  if (index >= 0) result[index] = merged;
  else result.push(merged);
  return result;
}

// The effect ACK means "durably queued", not "uploaded". A separate outbox
// survives closing/replacing a mission and does not depend on App/EFB presence.
function createComplianceSanctions(options) {
  const { storageFile, pilotId, pin, log = () => {}, now = Date.now } = options;
  if (!storageFile || !String(pilotId || '').trim()) throw Error('sanction_storage_identity_required');
  const owner = String(pilotId).trim();
  const disk = options.fs || fs;
  let rows = null, lane = Promise.resolve(), flushing = false, retryAt = 0, failures = 0, revision = null;
  const client = options.client || sync.create({
    request: options.transport || request,
    baseUrl: options.baseUrl || 'https://ga-proxy.einherjer.workers.dev/api/sync-v2/',
    pilotId: owner, pin,
    getRevision: () => revision, setRevision: value => { revision = value; }
  });
  const serialize = operation => {
    const result = lane.then(operation);
    lane = result.catch(() => {});
    return result;
  };
  async function load() {
    if (rows) return;
    try {
      const stored = JSON.parse(await disk.readFile(storageFile, 'utf8'));
      if (stored.schema !== 'ga.compliance-sanctions.v1' || !Array.isArray(stored.entries)) throw Error('sanction_outbox_invalid');
      rows = stored.entries;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      rows = [];
    }
  }
  async function save(next) {
    await disk.mkdir(path.dirname(storageFile), { recursive: true });
    await disk.writeFile(storageFile + '.tmp', JSON.stringify({ schema: 'ga.compliance-sanctions.v1', entries: next }));
    await disk.rename(storageFile + '.tmp', storageFile);
    rows = next;
  }
  async function record(effectRequest) {
    return serialize(async () => {
      await load();
      const record = copy(effectRequest?.effect?.payload?.record || {});
      if (record.type !== 'authority_sanction' || !String(record.id || '').trim()
          || !String(record.flightId || '').trim() || !Array.isArray(record.offences) || !record.offences.length
          || ![record.createdAt, record.expiresAt, record.immutableUntil].every(Number.isFinite)
          || record.expiresAt <= record.createdAt || record.immutableUntil <= record.createdAt) {
        throw Error('sanction_record_invalid');
      }
      const existing = rows.find(row => row.pilotId === owner && row.record.flightId === record.flightId);
      if (!existing) {
        await save([...rows, { pilotId: owner, record, queuedAt: now(), savedAt: null }]);
        log(`COMPLIANCE_SANCTION_QUEUED flight=${record.flightId}`);
      }
      return { ok: true, status: 'completed', sideEffect: !existing, commandId: effectRequest.commandId };
    });
  }
  async function flush() {
    if (flushing || now() < retryAt) return { status: 'deferred' };
    flushing = true;
    try {
      const entries = await serialize(async () => {
        await load(); return copy(rows.filter(row => row.pilotId === owner && row.savedAt == null));
      });
      if (!entries.length) return { status: 'empty' };
      const active = entries.filter(row => row.record.expiresAt > now());
      for (let attempt = 0; active.length && attempt < 3; attempt++) {
        const loaded = await client.read();
        if (!loaded.migrated) throw Error('sanction_requires_profile_v2');
        revision = loaded.revision;
        let notes = loaded.profile.pinboard ?? [];
        for (const entry of active) notes = mergeSanction(notes, entry.record);
        try {
          if (JSON.stringify(notes) !== JSON.stringify(loaded.profile.pinboard ?? [])) {
            await client.write({ ...loaded.profile, pinboard: notes, lastModified: now() }, { expectedRevision: loaded.revision });
          }
          break;
        } catch (error) {
          if (error.status === 409 && attempt < 2) continue;
          throw error;
        }
      }
      await serialize(async () => {
        const ids = new Set(entries.map(row => row.record.flightId));
        await save(rows.map(row => row.pilotId === owner && ids.has(row.record.flightId) && row.savedAt == null
          ? { ...row, savedAt: now() || 1 } : row));
      });
      failures = 0; retryAt = 0;
      log(`COMPLIANCE_SANCTION_SYNCED entries=${active.length}`);
      return { status: 'saved', count: active.length };
    } catch (error) {
      failures++; retryAt = now() + Math.min(300000, 5000 * 2 ** Math.min(failures - 1, 6));
      log(`COMPLIANCE_SANCTION_PENDING error=${error.code || 'storage_or_sync_failed'}`);
      return { status: 'pending', error: error.code || error.message };
    } finally { flushing = false; }
  }
  return { record, flush };
}

module.exports = { createComplianceSanctions, mergeSanction };
