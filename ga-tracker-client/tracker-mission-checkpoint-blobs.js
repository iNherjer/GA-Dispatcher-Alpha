'use strict';
// Missionsstand auf der Platte aufteilen: grosse Teile des Resume-Pakets, die
// sich seit dem letzten Checkpoint nicht geaendert haben (Missionsdaten,
// Effektplan, abgeschlossene Laeufe), liegen einmalig als eigene Datei
// <storageFile>.blobs/<sha256>.json. Die Hauptdatei verweist nur noch darauf.
//
// Sicherheitsregeln:
// - Teile des Resume-Pakets werden nach dem Erzeugen nie veraendert (siehe
//   copyPublicationPart in mission-authority-core.js). Vor dem Schreiben wird
//   der Hash trotzdem geprueft; weicht er ab, faellt der Checkpoint auf das
//   alte Inline-Format zurueck.
// - Reihenfolge: erst alle Teil-Dateien (mit fsync), dann die Hauptdatei, erst
//   danach werden nicht mehr benoetigte Teil-Dateien geloescht.
// - Beim Laden wird jede Teil-Datei per Hash geprueft. Fehlt eine oder ist sie
//   beschaedigt, wird dieser Lauf nicht halb geladen.
const crypto = require('node:crypto');
const path = require('node:path');

const STORAGE_FORMAT = 'ga.mission-authority.blob-refs.v1';
const STORAGE_VERSION = 2;
const BLOB_REF_KEY = '$missionBlob';
const DEFAULT_MIN_BLOB_BYTES = 64 * 1024;
const HASH_PATTERN = /^[0-9a-f]{64}$/;
const RUN_KEYS = ['activeRun', 'lastRun'];

const sha256 = text => crypto.createHash('sha256').update(text, 'utf8').digest('hex');
const blobDirectory = filename => `${filename}.blobs`;
const blobFile = (filename, hash) => path.join(blobDirectory(filename), `${hash}.json`);
const isPlainObject = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const isBlobRef = value => isPlainObject(value) && typeof value[BLOB_REF_KEY] === 'string';

function createBlobCheckpointFormat(options) {
  const filename = options.filename;
  const io = options.io;
  const log = options.log || (() => {});
  const minBytes = Number.isFinite(options.minBlobBytes) ? options.minBlobBytes : DEFAULT_MIN_BLOB_BYTES;
  // A referenced part is re-hashed at most once per audit interval, one part
  // per checkpoint, to detect an in-place edit that would leave a stale blob.
  const auditMs = Number.isFinite(options.auditIntervalMs) ? options.auditIntervalMs : 60000;
  const now = typeof options.now === 'function' ? options.now : Date.now;
  // object -> { hash, bytes } once it is referenced as a blob
  const known = new WeakMap();
  // parts present at the previous capture: only stable parts become blobs
  let previous = new WeakSet();
  let lastRefs = null;
  const metrics = { blobWrites: 0, blobBytes: 0, blobReuses: 0, blobRemoved: 0, blobFallbacks: 0, blobAudits: 0, blobDrift: 0 };

  function registerLoaded(value, hash, bytes = null) {
    if (!isPlainObject(value) && !Array.isArray(value)) return;
    known.set(value, { hash, bytes, verifiedAt: now() });
  }
  const driftError = hash => Object.assign(new Error(`mission_checkpoint_blob_hash_mismatch:${hash.slice(0, 12)}`),
    { code: 'mission_checkpoint_blob_hash_mismatch' });

  // Synchronous: the whole checkpoint describes one instant.
  function capture(state) {
    const seen = new WeakSet();
    const refs = new Map();
    const captureRun = run => {
      if (!isPlainObject(run) || !isPlainObject(run.resumeBundle)) return run;
      const bundle = {};
      for (const [key, value] of Object.entries(run.resumeBundle)) {
        if (!value || typeof value !== 'object') { bundle[key] = value; continue; }
        seen.add(value);
        let info = known.get(value);
        if (!info && previous.has(value)) {
          const text = JSON.stringify(value);
          const bytes = Buffer.byteLength(text, 'utf8');
          if (bytes >= minBytes) {
            info = { hash: sha256(text), bytes, text, verifiedAt: now() };
            known.set(value, info);
          }
        }
        if (!info) { bundle[key] = value; continue; }
        refs.set(info.hash, { value, info });
        bundle[key] = { [BLOB_REF_KEY]: info.hash, bytes: info.bytes };
      }
      return { ...run, resumeBundle: bundle };
    };
    const stored = { ...state, version: STORAGE_VERSION, storageFormat: STORAGE_FORMAT };
    for (const key of RUN_KEYS) stored[key] = captureRun(state[key]);
    previous = seen;
    // Nothing to reference: write the unchanged version-1 file, readable by
    // every older tracker.
    return { text: `${JSON.stringify(refs.size ? stored : state)}\n`, refs };
  }

  async function writeAtomic(target, text) {
    const temporary = `${target}.tmp`;
    if (typeof io.open === 'function') {
      const handle = await io.open(temporary, 'w');
      try { await handle.writeFile(text, 'utf8'); await handle.sync(); }
      finally { await handle.close(); }
    } else {
      await io.writeFile(temporary, text, 'utf8');
    }
    await io.rename(temporary, target);
  }

  // Writes every referenced part that is not on disk yet. Throws on any
  // problem; the caller then falls back to the inline format.
  async function writeBlobs(captured) {
    if (!captured.refs.size) return 0;
    await io.mkdir(blobDirectory(filename), { recursive: true });
    let bytes = 0, audited = false;
    for (const [hash, { value, info }] of captured.refs) {
      const target = blobFile(filename, hash);
      let present = false;
      try { present = (await io.stat(target)).isFile(); } catch (error) { if (error?.code !== 'ENOENT') throw error; }
      if (present) {
        info.text = null;
        metrics.blobReuses++;
        if (!audited && now() - Number(info.verifiedAt || 0) >= auditMs) {
          audited = true;
          metrics.blobAudits++;
          if (sha256(JSON.stringify(value)) !== hash) {
            metrics.blobDrift++;
            known.delete(value);
            throw driftError(hash);
          }
          info.verifiedAt = now();
        }
        continue;
      }
      const text = info.text || JSON.stringify(value);
      if (sha256(text) !== hash) {
        metrics.blobDrift++;
        known.delete(value);
        throw driftError(hash);
      }
      info.verifiedAt = now();
      await writeAtomic(target, text);
      info.text = null;
      bytes += Buffer.byteLength(text, 'utf8');
      metrics.blobWrites++;
    }
    metrics.blobBytes += bytes;
    return bytes;
  }

  // Only after the main file references exactly captured.refs.
  async function collectGarbage(captured) {
    const refs = new Set(captured.refs.keys());
    if (lastRefs && lastRefs.size === refs.size && [...refs].every(hash => lastRefs.has(hash))) return;
    let entries = [];
    try { entries = await io.readdir(blobDirectory(filename)); }
    catch (error) { if (error?.code !== 'ENOENT') log(`MISSION_CHECKPOINT_BLOB_GC_ERROR error=${error?.message || error}`); lastRefs = refs; return; }
    let complete = true;
    for (const entry of entries) {
      const match = /^([0-9a-f]{64})\.json(\.tmp)?$/.exec(entry);
      if (!match || (refs.has(match[1]) && !match[2])) continue;
      try { await io.unlink(path.join(blobDirectory(filename), entry)); metrics.blobRemoved++; }
      catch (error) {
        if (error?.code === 'ENOENT') continue;
        // Windows: a scanner or sync client may hold the file. Retry next time.
        complete = false;
        log(`MISSION_CHECKPOINT_BLOB_GC_ERROR file=${entry} error=${error?.code || error?.message || error}`);
      }
    }
    lastRefs = complete ? refs : null;
  }

  function forgetDiskState() { lastRefs = null; }
  function noteFallback() { metrics.blobFallbacks++; }

  return { capture, writeBlobs, collectGarbage, registerLoaded, forgetDiskState, noteFallback, metrics: () => ({ ...metrics }) };
}

// Synchronous loader for tracker start. Version 1 (inline) passes unchanged.
// A run whose parts cannot be restored exactly is dropped, never half loaded.
function resolveStoredState(parsed, options) {
  if (!isPlainObject(parsed) || Number(parsed.version) !== STORAGE_VERSION) return { state: parsed, droppedRuns: [], loadedParts: [] };
  if (parsed.storageFormat !== STORAGE_FORMAT) {
    const error = new Error(`mission_checkpoint_storage_format_unknown:${parsed.storageFormat || ''}`);
    error.code = 'mission_checkpoint_storage_format_unknown';
    throw error;
  }
  const cache = new Map();
  const readPart = hash => {
    if (!HASH_PATTERN.test(hash)) throw Object.assign(new Error('mission_checkpoint_blob_ref_invalid'), { code: 'mission_checkpoint_blob_ref_invalid' });
    if (cache.has(hash)) return cache.get(hash);
    const text = options.readFileSync(blobFile(options.filename, hash), 'utf8');
    if (sha256(text) !== hash) throw Object.assign(new Error('mission_checkpoint_blob_corrupt'), { code: 'mission_checkpoint_blob_corrupt' });
    const value = JSON.parse(text);
    cache.set(hash, value);
    return value;
  };
  const droppedRuns = [];
  const loadedParts = [];
  const state = { ...parsed };
  delete state.storageFormat;
  for (const key of RUN_KEYS) {
    const run = parsed[key];
    if (!isPlainObject(run) || !isPlainObject(run.resumeBundle)) continue;
    try {
      const bundle = {};
      for (const [part, value] of Object.entries(run.resumeBundle)) {
        if (!isBlobRef(value)) { bundle[part] = value; continue; }
        const hash = value[BLOB_REF_KEY];
        // Each run gets its own copy so the identity rules stay per run.
        bundle[part] = JSON.parse(JSON.stringify(readPart(hash)));
        loadedParts.push({ run: key, part, hash, bytes: Number(value.bytes) || null });
      }
      state[key] = { ...run, resumeBundle: bundle };
    } catch (error) {
      for (let index = loadedParts.length - 1; index >= 0; index--) if (loadedParts[index].run === key) loadedParts.splice(index, 1);
      droppedRuns.push({ run: key, missionId: run.missionId || '', runId: run.runId || '', error: error?.code || error?.message || String(error) });
      state[key] = null;
    }
  }
  return { state, droppedRuns, loadedParts };
}

module.exports = {
  BLOB_REF_KEY,
  DEFAULT_MIN_BLOB_BYTES,
  STORAGE_FORMAT,
  STORAGE_VERSION,
  blobDirectory,
  createBlobCheckpointFormat,
  resolveStoredState
};
