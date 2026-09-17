'use strict';
const fs = require('node:fs');
const path = require('node:path');

// Diagnostic output is best effort, bounded and never part of the mission
// transaction. One writer owns rotation and append ordering for each logger.
function createAsyncDebugLog(options) {
  const filename = path.resolve(options.filename);
  const io = options.io || fs.promises;
  const maxBytes = Math.max(512, options.maxBytes || 8 * 1024 * 1024);
  const tailBytes = Math.min(options.retainedTailBytes || 512 * 1024, maxBytes);
  const maxLineBytes = Math.min(options.maxLineBytes || 32 * 1024, maxBytes - 256);
  const maxPendingBytes = options.maxPendingBytes || 1024 * 1024;
  const now = options.now || Date.now;
  const queue = [];
  const metrics = { accepted: 0, dropped: 0, errors: 0, batches: 0, bytes: 0, ioMs: 0, pendingBytes: 0 };
  let previous = '', previousAt = 0, timer = null, writing = null, size = null;
  const statSize = async file => { try { return (await io.stat(file)).size; } catch (error) { if (error.code === 'ENOENT') return 0; throw error; } };
  async function tail(file) {
    const bytes = await statSize(file);
    const handle = await io.open(file, 'r');
    try {
      const buffer = Buffer.alloc(Math.min(bytes, tailBytes));
      const result = await handle.read(buffer, 0, buffer.length, Math.max(0, bytes - buffer.length));
      const read = buffer.subarray(0, result.bytesRead);
      const newline = read.indexOf(10);
      return bytes > read.length && newline >= 0 ? read.subarray(newline + 1) : read;
    } finally { await handle.close(); }
  }
  async function rotate() {
    if (await statSize(filename + '.1')) await io.writeFile(filename + '.2', await tail(filename + '.1'));
    if (size) await io.writeFile(filename + '.1', await tail(filename));
    await io.writeFile(filename, '');
    size = 0;
  }
  async function flush() {
    if (timer) { clearTimeout(timer); timer = null; }
    if (writing) { await writing; if (queue.length) return flush(); return; }
    if (!queue.length) return;
    writing = (async () => {
      let inFlightLines = 0;
      try {
        const started = process.hrtime.bigint();
        try {
          if (size === null) {
            await io.mkdir(path.dirname(filename), { recursive: true });
            size = await statSize(filename);
          }
          while (queue.length) {
            const entries = []; let bytes = 0;
            while (queue.length && bytes + queue[0].bytes <= maxBytes) {
              const entry = queue.shift(); entries.push(entry.text); bytes += entry.bytes;
              metrics.pendingBytes -= entry.bytes;
            }
            inFlightLines = entries.length;
            if (size + bytes > maxBytes) await rotate();
            await io.appendFile(filename, entries.join(''), 'utf8');
            size += bytes; metrics.bytes += bytes; metrics.batches++; inFlightLines = 0;
          }
        } finally { metrics.ioMs += Number(process.hrtime.bigint() - started) / 1e6; }
      } catch (_) {
        metrics.errors++;
        metrics.dropped += queue.length + inFlightLines;
        queue.length = 0; metrics.pendingBytes = 0; size = null;
      }
    })();
    try { await writing; } finally { writing = null; }
    if (queue.length) await flush();
  }
  const log = line => {
    const clean = String(line == null ? '' : line).replace(/[\r\n]+/g, ' ');
    const at = now();
    if (clean === previous && at >= previousAt && at - previousAt <= (options.dedupeWindowMs || 1500)) return false;
    previous = clean; previousAt = at;
    const raw = Buffer.from(clean);
    const text = `[${new Date(at).toISOString()}] ${raw.length > maxLineBytes ? raw.subarray(0, maxLineBytes - 20).toString('utf8') + ' [truncated]' : clean}\n`;
    const bytes = Buffer.byteLength(text);
    if (metrics.pendingBytes + bytes > maxPendingBytes) { metrics.dropped++; return false; }
    queue.push({ text, bytes }); metrics.pendingBytes += bytes; metrics.accepted++;
    if (!timer && !writing) timer = setTimeout(() => { timer = null; void flush(); }, options.flushIntervalMs || 25);
    return true;
  };
  log.flush = flush;
  log.metrics = () => ({ ...metrics });
  return log;
}
module.exports = { createAsyncDebugLog };
