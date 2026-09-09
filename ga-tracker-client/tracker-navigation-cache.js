'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

// Disk-heavy, RAM-light cache. No filesystem calls run in the telemetry callback.
function createNavigationCache({ directory, fetchRemote = fetch, maxBytes = 4 * 1024 ** 3,
  concurrency = 4, now = Date.now } = {}) {
  if (!directory) throw new Error('navigation_cache_directory_required');
  const index = new Map(), pending = new Map(), failures = new Map(), waiting = [];
  let running = 0, size = 0, trimming = null;
  const stats = { hits: 0, downloads: 0, stale: 0, errors: 0 };
  const ready = (async () => {
    await fs.mkdir(directory, { recursive: true });
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      if (!entry.isFile() || !/^[a-f0-9]{64}\.bin$/.test(entry.name)) continue;
      const stat = await fs.stat(path.join(directory, entry.name)).catch(() => null);
      if (stat) { index.set(entry.name, { size: stat.size, usedAt: stat.mtimeMs }); size += stat.size; }
    }
  })();
  ready.catch(() => {}); // A later read reports initialization failure as unavailable data.
  async function limited(operation) {
    if (running >= concurrency) await new Promise(resolve => waiting.push(resolve));
    else running++;
    try { return await operation(); }
    finally { const next = waiting.shift(); if (next) next(); else running--; }
  }
  async function trim() {
    if (trimming) return trimming;
    trimming = (async () => {
      for (const [name, entry] of [...index].sort((a, b) => a[1].usedAt - b[1].usedAt)) {
        if (size <= maxBytes) break;
        if (pending.has(name)) continue;
        await fs.unlink(path.join(directory, name)).catch(() => {});
        if (index.get(name) === entry) { index.delete(name); size -= entry.size; }
      }
    })().finally(() => { trimming = null; });
    return trimming;
  }
  async function get(url, { ttlMs = 86400000, limit = 16 * 1024 ** 2, validate = () => {}, stale = true } = {}) {
    // Callers supply fixed data endpoints, never a URL from a relay client.
    const name = crypto.createHash('sha256').update(url).digest('hex') + '.bin';
    if (pending.has(name)) return pending.get(name);
    const operation = (async () => {
      await ready;
      const filename = path.join(directory, name);
      let cached = null, modified = 0;
      try {
        const stat = await fs.stat(filename); modified = stat.mtimeMs;
        if (stat.size <= limit) { cached = await fs.readFile(filename); await validate(cached); }
      } catch (_) { cached = null; }
      if (cached && now() - modified < ttlMs) {
        stats.hits++; if (index.has(name)) index.get(name).usedAt = now();
        return cached;
      }
      try {
        if ((failures.get(name) || 0) > now()) throw new Error('navigation_data_cooldown');
        return await limited(async () => {
          const response = await fetchRemote(url, { signal: AbortSignal.timeout(12000), redirect: 'error' });
          if (!response.ok) throw new Error(`navigation_data_http_${response.status}`);
          if (Number(response.headers?.get?.('content-length')) > limit) throw new Error('navigation_data_too_large');
          const chunks = []; let length = 0;
          for await (const chunk of response.body) {
            length += chunk.length;
            if (length > limit) throw new Error('navigation_data_too_large');
            chunks.push(Buffer.from(chunk));
          }
          const bytes = Buffer.concat(chunks);
          if (!bytes.length) throw new Error('navigation_data_empty');
          await validate(bytes);
          const temp = filename + '.' + crypto.randomUUID() + '.tmp';
          try { await fs.writeFile(temp, bytes); await fs.rename(temp, filename); }
          finally { await fs.rm(temp, { force: true }).catch(() => {}); }
          size += bytes.length - (index.get(name)?.size || 0);
          index.set(name, { size: bytes.length, usedAt: now() });
          stats.downloads++;
          return bytes;
        });
      } catch (error) {
        stats.errors++; failures.set(name, now() + (error.message.includes('404') ? 1800000 : 30000));
        if (failures.size > 512) failures.delete(failures.keys().next().value);
        if (cached && stale) { stats.stale++; return cached; }
        throw error;
      }
    })();
    pending.set(name, operation);
    try { return await operation; }
    finally { pending.delete(name); if (size > maxBytes) trim().catch(() => {}); }
  }
  async function invalidate(url) {
    await ready;
    const name = crypto.createHash('sha256').update(url).digest('hex') + '.bin';
    await fs.rm(path.join(directory, name), { force: true });
    size -= index.get(name)?.size || 0; index.delete(name);
  }
  return { get, ready, trim, invalidate, snapshot: () => ({ ...stats, bytes: size, files: index.size, pending: pending.size, maxBytes, directory }) };
}
module.exports = { createNavigationCache };
