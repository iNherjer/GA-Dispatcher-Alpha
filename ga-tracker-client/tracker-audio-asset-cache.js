'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

// Only versioned repository audio can enter this cache, never arbitrary URLs.
const DEFAULT_BASE_URL = 'https://inherjer.github.io/GA-Dispatcher-Alpha/';
function audioAssetPath(value) {
  const asset = String(value || '');
  if (!/^(audio-cues|audio-warnings|audio-pax)\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_.-]+\.(mp3|m4a|wav)$/.test(asset)
      || asset.includes('..')) throw new Error('invalid_audio_asset');
  return asset;
}
function createAudioAssetCache({ directory, version, baseUrl = DEFAULT_BASE_URL, fetchRemote = fetch,
  maxBytes = 16 * 1024 * 1024, timeoutMs = 20000 } = {}) {
  if (!directory || !version) throw new Error('audio_cache_configuration_required');
  const pending = new Map();
  function descriptor(asset) {
    asset = audioAssetPath(asset);
    return { path: asset, version: String(version), url: new URL(asset, baseUrl).href + '?v=' + encodeURIComponent(version) };
  }
  async function read(asset) {
    const item = descriptor(asset);
    const key = crypto.createHash('sha256').update(item.url).digest('hex');
    const filename = path.join(directory, key + path.extname(asset));
    try { const bytes = await fs.readFile(filename); if (bytes.length && bytes.length <= maxBytes) return { ...item, filename, bytes, cached: true }; } catch (_) {}
    if (pending.has(key)) return pending.get(key);
    const download = (async () => {
      const response = await fetchRemote(item.url, { signal: AbortSignal.timeout(timeoutMs), redirect: 'error' });
      if (!response.ok) throw new Error(`audio_asset_http_${response.status}`);
      const contentType = String(response.headers.get('content-type') || '');
      if (!/^(audio\/|application\/octet-stream)/i.test(contentType)) throw new Error('invalid_audio_content_type');
      if (Number(response.headers.get('content-length')) > maxBytes) throw new Error('audio_asset_too_large');
      const chunks = []; let size = 0;
      for await (const chunk of response.body) {
        size += chunk.length;
        if (size > maxBytes) throw new Error('audio_asset_too_large');
        chunks.push(Buffer.from(chunk));
      }
      if (!size) throw new Error('audio_asset_empty');
      const bytes = Buffer.concat(chunks);
      await fs.mkdir(directory, { recursive: true });
      const temporary = filename + '.' + crypto.randomUUID() + '.tmp';
      try { await fs.writeFile(temporary, bytes); await fs.rename(temporary, filename); }
      finally { await fs.rm(temporary, { force: true }).catch(() => {}); }
      return { ...item, filename, bytes, cached: false };
    })();
    pending.set(key, download);
    try { return await download; } finally { pending.delete(key); }
  }
  return { descriptor, read };
}
module.exports = { createAudioAssetCache, audioAssetPath, DEFAULT_BASE_URL };
