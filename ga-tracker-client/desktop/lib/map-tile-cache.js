'use strict';

// Local map tile cache of the tracker (EFB/Toolbar maps), shared by the Stable
// and Alpha runtimes: %LOCALAPPDATA%\VFR Multitool\Map Tile Cache.
const fs = require('node:fs');
const path = require('node:path');

const MAP_TILE_CACHE_DIRNAME = 'Map Tile Cache';

function mapTileCacheDirectory(applicationRoot) {
  return path.join(String(applicationRoot || '.'), MAP_TILE_CACHE_DIRNAME);
}

// Size on disk (only the tile images are counted, not their metadata files).
async function mapTileCacheStats(directory) {
  let bytes = 0;
  let files = 0;
  async function walk(dir, depth) {
    let entries = [];
    try { entries = await fs.promises.readdir(dir, { withFileTypes: true }); } catch (_) { return; }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory() && depth < 3) await walk(full, depth + 1);
      else if (entry.isFile() && entry.name.endsWith('.tile')) {
        try { bytes += (await fs.promises.stat(full)).size; files += 1; } catch (_) {}
      }
    }
  }
  await walk(directory, 0);
  return { directory, bytes, files };
}

// A running tracker clears through its own endpoint (memory and disk); without
// one, or when an older tracker does not know the endpoint, the folder is removed.
async function clearMapTileCache({ directory, trackerProcess }) {
  const before = await mapTileCacheStats(directory);
  let via = 'disk';
  if (trackerProcess && typeof trackerProcess.clearMapTileCache === 'function' && trackerProcess.child) {
    const result = await trackerProcess.clearMapTileCache().catch(() => null);
    if (result && result.ok === true) via = 'tracker';
  }
  if (via === 'disk') await fs.promises.rm(directory, { recursive: true, force: true });
  const after = await mapTileCacheStats(directory);
  return { ok: after.files === 0, via, removedBytes: before.bytes, removedFiles: before.files, directory };
}

function formatCacheSize(bytes) {
  const value = Number(bytes) || 0;
  if (value >= 1024 * 1024 * 1024) return (value / (1024 * 1024 * 1024)).toFixed(1).replace('.', ',') + ' GB';
  if (value >= 1024 * 1024) return Math.round(value / (1024 * 1024)) + ' MB';
  if (value >= 1024) return Math.round(value / 1024) + ' KB';
  return value + ' B';
}

module.exports = { MAP_TILE_CACHE_DIRNAME, clearMapTileCache, formatCacheSize, mapTileCacheDirectory, mapTileCacheStats };
