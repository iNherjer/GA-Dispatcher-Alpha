'use strict';
const fs = require('node:fs');
const path = require('node:path');

// A single writer snapshots the latest state on a fixed cadence. Mutations only
// mark it dirty; a slow disk never creates a queue of obsolete snapshots.
function createMissionCheckpoint(options) {
  const io = options.io || fs.promises;
  const intervalMs = options.intervalMs || 5000;
  let revision = 0, savedRevision = 0, writing = null;
  const costs = { attempts: 0, bytes: 0, serializeMs: 0, writeMs: 0, directoryMs: 0, errors: 0, lastSavedAt: null };
  async function flush() {
    if (writing) { await writing; return savedRevision === revision ? true : flush(); }
    if (savedRevision === revision) return true;
    const target = revision;
    writing = (async () => {
      costs.attempts++;
      try {
        // No await during capture: manifest, effects and authority share one
        // instant. Serialization happens once per checkpoint, never per click.
        let started = process.hrtime.bigint();
        const data = JSON.stringify(options.getState()) + '\n';
        costs.serializeMs += Number(process.hrtime.bigint() - started) / 1e6;
        started = process.hrtime.bigint();
        await io.mkdir(path.dirname(options.filename), { recursive: true });
        costs.directoryMs += Number(process.hrtime.bigint() - started) / 1e6;
        started = process.hrtime.bigint();
        await io.writeFile(options.filename + '.tmp', data, 'utf8');
        await io.rename(options.filename + '.tmp', options.filename);
        costs.writeMs += Number(process.hrtime.bigint() - started) / 1e6;
        costs.bytes += Buffer.byteLength(data);
        costs.lastSavedAt = Date.now();
        savedRevision = target;
        return true;
      } catch (error) {
        costs.errors++;
        options.log?.(`MISSION_CHECKPOINT_ERROR error=${error?.message || error}`);
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
    metrics: () => ({ ...costs, mode: 'periodic', intervalMs, dirty: revision !== savedRevision, writing: Boolean(writing), revision, savedRevision }),
    stop() { clearInterval(timer); }
  };
}
module.exports = { createMissionCheckpoint };
