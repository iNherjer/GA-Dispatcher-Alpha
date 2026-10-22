'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { createBlobCheckpointFormat } = require('./tracker-mission-checkpoint-blobs.js');

// A single writer snapshots the latest state on a fixed cadence. Mutations only
// mark it dirty; a slow disk never creates a queue of obsolete snapshots.
// With blobs enabled, large unchanged parts of the resume bundle are written
// once as separate files and the main file only references them.
function createMissionCheckpoint(options) {
  const io = options.io || fs.promises;
  const intervalMs = options.intervalMs || 5000;
  const log = options.log || (() => {});
  const blobs = options.blobs === true
    ? createBlobCheckpointFormat({ filename: options.filename, io, log, minBlobBytes: options.minBlobBytes,
      auditIntervalMs: options.blobAuditIntervalMs, now: options.now })
    : null;
  let revision = 0, savedRevision = 0, writing = null;
  const costs = { attempts: 0, bytes: 0, serializeMs: 0, writeMs: 0, directoryMs: 0, errors: 0, lastSavedAt: null };
  const elapsedMs = started => Number(process.hrtime.bigint() - started) / 1e6;
  async function writeMain(data) {
    let started = process.hrtime.bigint();
    await io.mkdir(path.dirname(options.filename), { recursive: true });
    costs.directoryMs += elapsedMs(started);
    started = process.hrtime.bigint();
    await io.writeFile(options.filename + '.tmp', data, 'utf8');
    await io.rename(options.filename + '.tmp', options.filename);
    costs.writeMs += elapsedMs(started);
    costs.bytes += Buffer.byteLength(data);
  }
  function captureInline() {
    const started = process.hrtime.bigint();
    const data = JSON.stringify(options.getState()) + '\n';
    costs.serializeMs += elapsedMs(started);
    return data;
  }
  async function flush() {
    if (writing) { await writing; return savedRevision === revision ? true : flush(); }
    if (savedRevision === revision) return true;
    let target = revision;
    writing = (async () => {
      costs.attempts++;
      try {
        // No await during capture: manifest, effects and authority share one
        // instant. Serialization happens once per checkpoint, never per click.
        if (blobs) {
          let started = process.hrtime.bigint();
          const captured = blobs.capture(options.getState());
          costs.serializeMs += elapsedMs(started);
          let blobsWritten = false;
          try {
            started = process.hrtime.bigint();
            costs.bytes += await blobs.writeBlobs(captured);
            costs.writeMs += elapsedMs(started);
            blobsWritten = true;
          } catch (error) {
            // Any problem with the separate files: save this checkpoint in the
            // proven inline format. A fresh capture is again one instant.
            blobs.noteFallback();
            blobs.forgetDiskState();
            log(`MISSION_CHECKPOINT_BLOB_FALLBACK error=${error?.code || error?.message || error}`);
          }
          if (blobsWritten) {
            await writeMain(captured.text);
            await blobs.collectGarbage(captured);
          } else {
            target = revision;
            await writeMain(captureInline());
          }
        } else {
          await writeMain(captureInline());
        }
        costs.lastSavedAt = Date.now();
        savedRevision = target;
        return true;
      } catch (error) {
        costs.errors++;
        blobs?.forgetDiskState();
        log(`MISSION_CHECKPOINT_ERROR error=${error?.message || error}`);
        return false;
      }
    })();
    try { return await writing; } finally { writing = null; }
  }
  const timer = setInterval(() => { if (!writing) void flush(); }, intervalMs);
  timer.unref?.();
  return {
    markDirty() { revision++; return true; },
    flush,
    registerLoadedPart(value, hash, bytes) { blobs?.registerLoaded(value, hash, bytes); },
    metrics: () => ({ ...costs, mode: 'periodic', intervalMs, dirty: revision !== savedRevision, writing: Boolean(writing), revision, savedRevision,
      format: blobs ? 'blob-refs' : 'inline', ...(blobs ? { blobs: blobs.metrics() } : {}) }),
    stop() { clearInterval(timer); }
  };
}
module.exports = { createMissionCheckpoint };
