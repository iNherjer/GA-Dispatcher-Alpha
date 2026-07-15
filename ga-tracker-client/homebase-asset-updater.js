'use strict';

const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const https = require('https');
const path = require('path');
const zlib = require('zlib');

const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const HASH_PATTERN = /^[a-f0-9]{64}$/;
const DEFAULT_MAX_JSON_BYTES = 2 * 1024 * 1024;
const DEFAULT_MAX_ARCHIVE_BYTES = 256 * 1024 * 1024;
const DEFAULT_MAX_EXTRACTED_BYTES = 1024 * 1024 * 1024;
const WINDOWS_RESERVED_SEGMENT = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i;

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let value = n;
    for (let bit = 0; bit < 8; bit += 1) value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
    table[n] = value >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function sha256Buffer(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function sha256File(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function contentHashRecords(files) {
  return crypto.createHash('sha256').update(files.map((file) => `${file.path}:${file.size}:${file.sha256}`).join('\n')).digest('hex');
}

function parseVersion(value) {
  const text = String(value || '').trim();
  if (!VERSION_PATTERN.test(text)) return null;
  const [core, prerelease = ''] = text.split('-', 2);
  return { text, parts: core.split('.').map(Number), prerelease };
}

function compareVersions(left, right) {
  const a = parseVersion(left);
  const b = parseVersion(right);
  if (!a || !b) return String(left || '').localeCompare(String(right || ''));
  for (let index = 0; index < 3; index += 1) {
    if (a.parts[index] !== b.parts[index]) return a.parts[index] > b.parts[index] ? 1 : -1;
  }
  if (a.prerelease === b.prerelease) return 0;
  if (!a.prerelease) return 1;
  if (!b.prerelease) return -1;
  return a.prerelease.localeCompare(b.prerelease, undefined, { numeric: true });
}

function safeRelativePath(value) {
  const text = String(value || '').replaceAll('\\', '/');
  if (!text || text.includes('\0') || text.startsWith('/') || /^[A-Za-z]:/.test(text)) throw new Error(`Unsicherer Archivpfad: ${value}`);
  const directory = text.endsWith('/');
  const parts = text.split('/').filter((part, index, all) => !(directory && index === all.length - 1));
  if (!parts.length || parts.some((part) => (
    !part
    || part === '.'
    || part === '..'
    || /[:\u0000-\u001f]/.test(part)
    || /[. ]$/.test(part)
    || WINDOWS_RESERVED_SEGMENT.test(part)
  ))) throw new Error(`Unsicherer Archivpfad: ${value}`);
  return { path: parts.join('/'), directory };
}

function ensureInside(root, relative) {
  const target = path.resolve(root, ...relative.split('/'));
  const prefix = `${path.resolve(root)}${path.sep}`;
  if (!target.startsWith(prefix)) throw new Error(`Archivpfad verlässt den Zielordner: ${relative}`);
  return target;
}

function findEndOfCentralDirectory(buffer) {
  const minimum = Math.max(0, buffer.length - 65557);
  for (let offset = buffer.length - 22; offset >= minimum; offset -= 1) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) return offset;
  }
  return -1;
}

function extractZipBuffer(buffer, targetRoot, options = {}) {
  if (!Buffer.isBuffer(buffer)) throw new Error('ZIP-Inhalt ist kein Buffer.');
  const maxEntries = Number(options.maxEntries || 20000);
  const maxExtractedBytes = Number(options.maxExtractedBytes || DEFAULT_MAX_EXTRACTED_BYTES);
  const eocd = findEndOfCentralDirectory(buffer);
  if (eocd < 0) throw new Error('ZIP-Endverzeichnis wurde nicht gefunden.');
  const disk = buffer.readUInt16LE(eocd + 4);
  const centralDisk = buffer.readUInt16LE(eocd + 6);
  const entriesOnDisk = buffer.readUInt16LE(eocd + 8);
  const entryCount = buffer.readUInt16LE(eocd + 10);
  const centralSize = buffer.readUInt32LE(eocd + 12);
  const centralOffset = buffer.readUInt32LE(eocd + 16);
  if (disk !== 0 || centralDisk !== 0 || entriesOnDisk !== entryCount) throw new Error('Mehrteilige ZIP-Archive werden nicht unterstützt.');
  if (entryCount <= 0 || entryCount > maxEntries || entryCount === 0xffff) throw new Error(`Ungültige ZIP-Dateianzahl: ${entryCount}`);
  if (centralOffset + centralSize > eocd) throw new Error('ZIP-Endverzeichnis liegt außerhalb des Archivs.');

  fs.mkdirSync(targetRoot, { recursive: true });
  const names = [];
  const seen = new Set();
  let totalExtracted = 0;
  let cursor = centralOffset;
  for (let index = 0; index < entryCount; index += 1) {
    if (cursor + 46 > buffer.length || buffer.readUInt32LE(cursor) !== 0x02014b50) throw new Error(`Ungültiger ZIP-Zentraleintrag ${index + 1}.`);
    const flags = buffer.readUInt16LE(cursor + 8);
    const method = buffer.readUInt16LE(cursor + 10);
    const checksum = buffer.readUInt32LE(cursor + 16);
    const compressedSize = buffer.readUInt32LE(cursor + 20);
    const uncompressedSize = buffer.readUInt32LE(cursor + 24);
    const nameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const localOffset = buffer.readUInt32LE(cursor + 42);
    const next = cursor + 46 + nameLength + extraLength + commentLength;
    if (next > buffer.length) throw new Error('ZIP-Zentraleintrag ist abgeschnitten.');
    if (flags & 0x0001) throw new Error('Verschlüsselte ZIP-Einträge werden nicht unterstützt.');
    if (![0, 8].includes(method)) throw new Error(`Nicht unterstützte ZIP-Kompression: ${method}`);
    if ([compressedSize, uncompressedSize, localOffset].includes(0xffffffff)) throw new Error('ZIP64-Archive werden nicht unterstützt.');
    const rawName = buffer.subarray(cursor + 46, cursor + 46 + nameLength).toString((flags & 0x0800) ? 'utf8' : 'utf8');
    const safe = safeRelativePath(rawName);
    const collisionKey = safe.path.toLowerCase();
    if (seen.has(collisionKey)) throw new Error(`Doppelter oder kollidierender ZIP-Pfad: ${safe.path}`);
    seen.add(collisionKey);
    names.push(safe.path);
    cursor = next;

    const target = ensureInside(targetRoot, safe.path);
    if (safe.directory) {
      fs.mkdirSync(target, { recursive: true });
      continue;
    }
    if (localOffset + 30 > buffer.length || buffer.readUInt32LE(localOffset) !== 0x04034b50) throw new Error(`Lokaler ZIP-Eintrag fehlt: ${safe.path}`);
    const localFlags = buffer.readUInt16LE(localOffset + 6);
    const localMethod = buffer.readUInt16LE(localOffset + 8);
    const localNameLength = buffer.readUInt16LE(localOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localOffset + 28);
    const localNameStart = localOffset + 30;
    const localNameEnd = localNameStart + localNameLength;
    const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
    if (localNameEnd > buffer.length) throw new Error(`Lokaler ZIP-Dateiname ist abgeschnitten: ${safe.path}`);
    const localName = buffer.subarray(localNameStart, localNameEnd).toString((localFlags & 0x0800) ? 'utf8' : 'utf8');
    if (localName !== rawName || localMethod !== method || (localFlags & 0x0001)) throw new Error(`Lokaler ZIP-Eintrag stimmt nicht mit dem Endverzeichnis überein: ${safe.path}`);
    if (dataOffset + compressedSize > centralOffset) throw new Error(`ZIP-Datei ist abgeschnitten oder überlappt das Endverzeichnis: ${safe.path}`);
    if (uncompressedSize > maxExtractedBytes - totalExtracted) throw new Error('Entpacktes Assetpaket überschreitet das Sicherheitslimit.');
    const compressed = buffer.subarray(dataOffset, dataOffset + compressedSize);
    const data = method === 0 ? Buffer.from(compressed) : zlib.inflateRawSync(compressed, { maxOutputLength: uncompressedSize + 1 });
    if (data.length !== uncompressedSize) throw new Error(`ZIP-Größe stimmt nicht: ${safe.path}`);
    if (crc32(data) !== checksum) throw new Error(`ZIP-Prüfsumme stimmt nicht: ${safe.path}`);
    totalExtracted += data.length;
    if (totalExtracted > maxExtractedBytes) throw new Error('Entpacktes Assetpaket überschreitet das Sicherheitslimit.');
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, data);
  }
  if (cursor !== centralOffset + centralSize) throw new Error('ZIP-Endverzeichnis enthält unerwartete Daten.');
  return { entryCount, totalExtracted, names };
}

function walkFiles(root) {
  const files = [];
  const walk = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(absolute);
      else if (entry.isFile()) files.push(path.relative(root, absolute).split(path.sep).join('/'));
    }
  };
  if (fs.existsSync(root)) walk(root);
  return files;
}

function validateUrl(value, allowHttpForTests = false) {
  let url;
  try { url = new URL(String(value || '')); } catch (_) { throw new Error(`Ungültige Asset-URL: ${value}`); }
  if (url.protocol !== 'https:' && !(allowHttpForTests && url.protocol === 'http:')) throw new Error(`Asset-URL muss HTTPS verwenden: ${url}`);
  if (url.username || url.password) throw new Error('Asset-URL darf keine Zugangsdaten enthalten.');
  return url.toString();
}

function defaultRequestBuffer(rawUrl, options = {}, redirects = 0) {
  const url = new URL(rawUrl);
  const transport = url.protocol === 'https:' ? https : http;
  const maxBytes = Number(options.maxBytes || DEFAULT_MAX_ARCHIVE_BYTES);
  const timeoutMs = Number(options.timeoutMs || 15000);
  return new Promise((resolve, reject) => {
    const request = transport.get(url, {
      headers: {
        'User-Agent': 'VFR-Multitool-Homebase-Tracker',
        Accept: options.accept || '*/*',
        'Accept-Encoding': 'identity'
      }
    }, (response) => {
      const status = Number(response.statusCode || 0);
      if ([301, 302, 303, 307, 308].includes(status) && response.headers.location) {
        response.resume();
        if (redirects >= 5) return reject(new Error('Zu viele Weiterleitungen beim Assetdownload.'));
        const targetUrl = new URL(response.headers.location, url);
        if (targetUrl.username || targetUrl.password) return reject(new Error('Asset-Weiterleitung darf keine Zugangsdaten enthalten.'));
        if (url.protocol === 'https:' && targetUrl.protocol !== 'https:') return reject(new Error('Unsichere HTTPS-Weiterleitung beim Assetdownload.'));
        if (!['https:', 'http:'].includes(targetUrl.protocol)) return reject(new Error(`Nicht unterstützte Asset-Weiterleitung: ${targetUrl.protocol}`));
        return defaultRequestBuffer(targetUrl.toString(), options, redirects + 1).then(resolve, reject);
      }
      if (status !== 200) {
        response.resume();
        return reject(new Error(`Assetserver antwortete mit HTTP ${status} für ${url}`));
      }
      const declared = Number(response.headers['content-length'] || 0);
      if (declared > maxBytes) {
        response.destroy();
        return reject(new Error(`Assetdownload ist größer als erlaubt: ${declared} Bytes.`));
      }
      const chunks = [];
      let size = 0;
      response.on('data', (chunk) => {
        size += chunk.length;
        if (size > maxBytes) {
          response.destroy(new Error(`Assetdownload überschreitet ${maxBytes} Bytes.`));
          return;
        }
        chunks.push(chunk);
      });
      response.on('end', () => resolve(Buffer.concat(chunks)));
      response.on('error', reject);
    });
    request.setTimeout(timeoutMs, () => request.destroy(new Error(`Zeitüberschreitung beim Assetdownload: ${url}`)));
    request.on('error', reject);
  });
}

function asBuffer(value) {
  if (Buffer.isBuffer(value)) return value;
  if (Buffer.isBuffer(value?.buffer)) return value.buffer;
  if (typeof value === 'string') return Buffer.from(value, 'utf8');
  throw new Error('Downloadfunktion lieferte keinen Buffer.');
}

function parseJsonBuffer(buffer, label) {
  try { return JSON.parse(buffer.toString('utf8')); } catch (error) { throw new Error(`${label} ist kein gültiges JSON: ${error.message}`); }
}

function validateArchiveDescriptor(value, allowHttpForTests) {
  const archive = value && typeof value === 'object' ? value : {};
  const name = String(archive.name || '').trim();
  const size = Number(archive.size);
  const sha256 = String(archive.sha256 || '').toLowerCase();
  if (!name || name.includes('/') || name.includes('\\') || !name.toLowerCase().endsWith('.zip')) throw new Error('Vollarchiv hat keinen sicheren ZIP-Namen.');
  if (!Number.isSafeInteger(size) || size <= 0 || size > DEFAULT_MAX_ARCHIVE_BYTES) throw new Error(`Ungültige Vollarchivgröße: ${archive.size}`);
  if (!HASH_PATTERN.test(sha256)) throw new Error('Vollarchiv enthält keine gültige SHA-256-Prüfsumme.');
  return { name, size, sha256, url: validateUrl(archive.url, allowHttpForTests) };
}

function validateStable(value, expectedPackageName, allowHttpForTests) {
  const stable = value && typeof value === 'object' ? value : {};
  const packageName = String(stable.packageName || '');
  const packageVersion = String(stable.packageVersion || '');
  const releaseTag = String(stable.releaseTag || '');
  if (Number(stable.schemaVersion) !== 1) throw new Error('Nicht unterstützte Stable-Kanalversion.');
  if (packageName !== expectedPackageName) throw new Error(`Stable-Kanal verweist auf das falsche Paket: ${packageName}`);
  if (!parseVersion(packageVersion)) throw new Error(`Ungültige Remote-Paketversion: ${packageVersion}`);
  if (releaseTag !== `homebase-assets-v${packageVersion}`) throw new Error(`Release-Tag passt nicht zur Paketversion: ${releaseTag}`);
  const contentHash = String(stable.contentHash || '').toLowerCase();
  if (!HASH_PATTERN.test(contentHash)) throw new Error('Stable-Kanal enthält keinen gültigen Pakethash.');
  return {
    schemaVersion: 1,
    packageName,
    packageVersion,
    releaseTag,
    publishedAt: String(stable.publishedAt || ''),
    indexUrl: validateUrl(stable.indexUrl, allowHttpForTests),
    contentHash,
    fullArchive: validateArchiveDescriptor(stable.fullArchive, allowHttpForTests),
    changedAssets: Array.isArray(stable.changedAssets) ? stable.changedAssets.map(String) : [],
    removedAssets: Array.isArray(stable.removedAssets) ? stable.removedAssets.map(String) : []
  };
}

function validateIndex(value, stable, requiredAssets, allowHttpForTests) {
  const index = value && typeof value === 'object' ? value : {};
  if (Number(index.schemaVersion) !== 1) throw new Error('Nicht unterstützte Paketindex-Version.');
  if (index.packageName !== stable.packageName || index.packageVersion !== stable.packageVersion || index.releaseTag !== stable.releaseTag) {
    throw new Error('Paketindex passt nicht zum Stable-Kanal.');
  }
  if (String(index.contentHash || '').toLowerCase() !== stable.contentHash) throw new Error('Pakethash von Stable-Kanal und Paketindex unterscheidet sich.');
  const indexArchive = validateArchiveDescriptor({
    ...(index.fullArchive || {}),
    url: index.fullArchive?.url || stable.fullArchive.url
  }, allowHttpForTests);
  if (indexArchive.name !== stable.fullArchive.name || indexArchive.size !== stable.fullArchive.size || indexArchive.sha256 !== stable.fullArchive.sha256) {
    throw new Error('Vollarchiv von Stable-Kanal und Paketindex unterscheidet sich.');
  }
  const files = Array.isArray(index.files) ? index.files : [];
  if (!files.length || files.length > 100000) throw new Error('Paketindex enthält keine plausible Dateiliste.');
  const seenFiles = new Set();
  const normalizedFiles = files.map((entry) => {
    const relative = safeRelativePath(entry?.path).path;
    const key = relative.toLowerCase();
    if (seenFiles.has(key)) throw new Error(`Doppelter Paketindexpfad: ${relative}`);
    seenFiles.add(key);
    const size = Number(entry?.size);
    const sha256 = String(entry?.sha256 || '').toLowerCase();
    if (!Number.isSafeInteger(size) || size < 0 || !HASH_PATTERN.test(sha256)) throw new Error(`Ungültiger Paketindexeintrag: ${relative}`);
    return { path: relative, size, sha256 };
  });
  if (contentHashRecords(normalizedFiles) !== stable.contentHash) throw new Error('Dateiliste ergibt nicht den veröffentlichten Pakethash.');
  const assets = Array.isArray(index.assets) ? index.assets : [];
  if (!assets.length) throw new Error('Paketindex enthält keinen Assetkatalog.');
  const remoteFolders = new Set(assets.map((asset) => String(asset?.folder || '').toLowerCase()).filter(Boolean));
  for (const asset of requiredAssets || []) {
    if (!remoteFolders.has(String(asset.folder || '').toLowerCase())) throw new Error(`Remote-Paket entfernt ein vom Tracker benötigtes Asset: ${asset.folder}`);
  }
  return { ...index, files: normalizedFiles, assets, fullArchive: indexArchive };
}

function validateExtractedPackage(packageRoot, stable, index, requiredAssets) {
  const actualFiles = walkFiles(packageRoot);
  const actualByLower = new Map(actualFiles.map((relative) => [relative.toLowerCase(), relative]));
  if (actualFiles.length !== index.files.length) throw new Error(`Dateianzahl des entpackten Pakets stimmt nicht: ${actualFiles.length} statt ${index.files.length}.`);
  for (const expected of index.files) {
    const actualRelative = actualByLower.get(expected.path.toLowerCase());
    if (!actualRelative) throw new Error(`Remote-Paketdatei fehlt: ${expected.path}`);
    const absolute = ensureInside(packageRoot, actualRelative);
    if (fs.statSync(absolute).size !== expected.size) throw new Error(`Remote-Paketgröße stimmt nicht: ${expected.path}`);
    if (sha256File(absolute) !== expected.sha256) throw new Error(`Remote-Pakethash stimmt nicht: ${expected.path}`);
  }
  const manifestPath = path.join(packageRoot, 'manifest.json');
  const layoutPath = path.join(packageRoot, 'layout.json');
  const manifest = parseJsonBuffer(fs.readFileSync(manifestPath), 'manifest.json');
  const layout = parseJsonBuffer(fs.readFileSync(layoutPath), 'layout.json');
  if (String(manifest.package_version || '') !== stable.packageVersion) throw new Error('manifest.json enthält nicht die erwartete Remote-Version.');
  if (!Array.isArray(layout.content)) throw new Error('layout.json enthält keine Dateiliste.');
  for (const entry of layout.content) {
    const actualRelative = actualByLower.get(String(entry?.path || '').toLowerCase());
    if (!actualRelative) throw new Error(`Layout-Datei fehlt im Remote-Paket: ${entry?.path}`);
    if (fs.statSync(ensureInside(packageRoot, actualRelative)).size !== Number(entry?.size)) throw new Error(`Layout-Größe stimmt nicht: ${entry?.path}`);
  }
  for (const asset of requiredAssets || []) {
    const expected = `simobjects/misc/${String(asset.folder || '').toLowerCase()}/sim.cfg`;
    if (!actualByLower.has(expected)) throw new Error(`Benötigte Assetdefinition fehlt im Remote-Paket: ${asset.folder}`);
  }
  return { manifest, layout, fileCount: actualFiles.length };
}

function createHomebaseAssetUpdater(options = {}) {
  const packageName = String(options.packageName || '');
  if (!packageName) throw new Error('Remote-Updater benötigt einen Paketnamen.');
  const channelUrl = validateUrl(options.channelUrl, options.allowHttpForTests === true);
  const cacheRoot = path.resolve(options.cacheRoot || path.join(process.cwd(), 'homebase-asset-cache'));
  const requestBuffer = typeof options.requestBuffer === 'function' ? options.requestBuffer : defaultRequestBuffer;
  const requiredAssets = Array.isArray(options.requiredAssets) ? options.requiredAssets : [];
  const allowHttpForTests = options.allowHttpForTests === true;
  const cacheTtlMs = Number(options.cacheTtlMs || 15 * 60 * 1000);
  const onProgress = typeof options.onProgress === 'function' ? options.onProgress : () => {};
  let cachedAt = 0;
  let cachedRelease = null;
  let lastStatus = null;

  const publicStatus = (installed = {}, release = cachedRelease, error = '') => {
    const installedVersion = String(installed.packageVersion || '');
    const installedComplete = installed.packageComplete === true;
    const remoteVersion = String(release?.stable?.packageVersion || '');
    const updateAvailable = Boolean(release && (!installedComplete || compareVersions(remoteVersion, installedVersion) > 0));
    return {
      checkedAt: new Date().toISOString(),
      remoteChecked: Boolean(lastStatus || release || error),
      channelUrl,
      remoteAvailable: Boolean(release),
      remoteVersion,
      remoteReleaseTag: release?.stable?.releaseTag || '',
      remotePublishedAt: release?.stable?.publishedAt || '',
      remoteArchiveSize: release?.stable?.fullArchive?.size || 0,
      remoteAssetCount: release?.index?.assets?.length || 0,
      remoteAssets: (Array.isArray(release?.index?.assets) ? release.index.assets : []).map((asset) => ({
        key: String(asset?.key || ''),
        folder: String(asset?.folder || ''),
        title: String(asset?.title || ''),
        label: String(asset?.label || ''),
        version: String(asset?.version || ''),
        kind: String(asset?.kind || ''),
        group: String(asset?.group || ''),
        workbenchVisible: asset?.workbenchVisible !== false && asset?.homebasePlaceable !== false,
        homebasePlaceable: asset?.homebasePlaceable !== false,
        missionSpawnable: asset?.missionSpawnable === true,
        missionTags: Array.isArray(asset?.missionTags) ? asset.missionTags.map(String).slice(0, 20) : [],
        missionRoles: Array.isArray(asset?.missionRoles) ? asset.missionRoles.map(String).slice(0, 20) : []
      })),
      changedAssets: release?.stable?.changedAssets || [],
      removedAssets: release?.stable?.removedAssets || [],
      updateAvailable,
      installedVersion,
      installedComplete,
      remoteError: error || ''
    };
  };

  const check = async (installed = {}, checkOptions = {}) => {
    const force = checkOptions.force === true;
    if (!force && cachedRelease && Date.now() - cachedAt < cacheTtlMs) {
      lastStatus = publicStatus(installed);
      return lastStatus;
    }
    try {
      onProgress({ phase: 'check', message: 'Asset-Releasekanal wird geprüft.' });
      const stableBuffer = asBuffer(await requestBuffer(channelUrl, { maxBytes: DEFAULT_MAX_JSON_BYTES, timeoutMs: 12000, accept: 'application/json' }));
      const stable = validateStable(parseJsonBuffer(stableBuffer, 'Stable-Kanal'), packageName, allowHttpForTests);
      const indexBuffer = asBuffer(await requestBuffer(stable.indexUrl, { maxBytes: DEFAULT_MAX_JSON_BYTES, timeoutMs: 15000, accept: 'application/json' }));
      const index = validateIndex(parseJsonBuffer(indexBuffer, 'Paketindex'), stable, requiredAssets, allowHttpForTests);
      cachedRelease = { stable, index };
      cachedAt = Date.now();
      lastStatus = publicStatus(installed);
      onProgress({ phase: 'checked', message: `Asset-Release ${stable.packageVersion} wurde geprüft.`, ...lastStatus });
      return lastStatus;
    } catch (error) {
      cachedRelease = null;
      cachedAt = 0;
      lastStatus = publicStatus(installed, null, error?.message || String(error));
      onProgress({ phase: 'check-error', message: lastStatus.remoteError, ...lastStatus });
      if (checkOptions.throwOnError) throw Object.assign(new Error(lastStatus.remoteError), { code: 'REMOTE_ASSET_CHECK_FAILED' });
      return lastStatus;
    }
  };

  const prepare = async (installed = {}) => {
    const status = await check(installed, { force: true, throwOnError: true });
    if (!cachedRelease) throw Object.assign(new Error('Kein geprüftes Remote-Assetrelease verfügbar.'), { code: 'REMOTE_ASSET_UNAVAILABLE' });
    if (!status.updateAvailable && installed.packageComplete) {
      return { unchanged: true, status, release: cachedRelease };
    }
    const { stable, index } = cachedRelease;
    onProgress({ phase: 'download', message: `Assetpaket ${stable.packageVersion} wird heruntergeladen.`, size: stable.fullArchive.size });
    const archive = asBuffer(await requestBuffer(stable.fullArchive.url, {
      maxBytes: Math.min(DEFAULT_MAX_ARCHIVE_BYTES, stable.fullArchive.size + 1),
      timeoutMs: 120000,
      accept: 'application/zip, application/octet-stream'
    }));
    if (archive.length !== stable.fullArchive.size) throw Object.assign(new Error(`Downloadgröße stimmt nicht: ${archive.length} statt ${stable.fullArchive.size}.`), { code: 'REMOTE_ASSET_SIZE_MISMATCH' });
    if (sha256Buffer(archive) !== stable.fullArchive.sha256) throw Object.assign(new Error('SHA-256 des heruntergeladenen Assetpakets stimmt nicht.'), { code: 'REMOTE_ASSET_HASH_MISMATCH' });
    fs.mkdirSync(cacheRoot, { recursive: true });
    const stagingRoot = path.join(cacheRoot, `release-${stable.packageVersion}-${crypto.randomUUID()}`);
    try {
      onProgress({ phase: 'extract', message: `Assetpaket ${stable.packageVersion} wird sicher entpackt.` });
      const extracted = extractZipBuffer(archive, stagingRoot);
      const prefix = `${packageName}/`.toLowerCase();
      if (extracted.names.some((name) => !`${name}/`.toLowerCase().startsWith(prefix))) throw new Error('Vollarchiv enthält Dateien außerhalb des erwarteten Paketordners.');
      const packageRoot = path.join(stagingRoot, packageName);
      if (!fs.existsSync(packageRoot) || !fs.statSync(packageRoot).isDirectory()) throw new Error(`Vollarchiv enthält den Paketordner ${packageName} nicht.`);
      onProgress({ phase: 'validate', message: `Assetpaket ${stable.packageVersion} wird gegen den Dateiindex geprüft.` });
      const validation = validateExtractedPackage(packageRoot, stable, index, requiredAssets);
      return {
        unchanged: false,
        status,
        release: cachedRelease,
        stagingRoot,
        packageRoot,
        validation,
        cleanup() { fs.rmSync(stagingRoot, { recursive: true, force: true }); }
      };
    } catch (error) {
      fs.rmSync(stagingRoot, { recursive: true, force: true });
      throw error;
    }
  };

  return {
    check,
    prepare,
    snapshot(installed = {}) {
      if (lastStatus) return { ...lastStatus, installedVersion: String(installed.packageVersion || ''), installedComplete: installed.packageComplete === true,
        updateAvailable: Boolean(cachedRelease && (!installed.packageComplete || compareVersions(cachedRelease.stable.packageVersion, installed.packageVersion) > 0)) };
      return publicStatus(installed, null, '');
    },
    invalidate() { cachedAt = 0; cachedRelease = null; lastStatus = null; },
    channelUrl
  };
}

module.exports = {
  compareVersions,
  createHomebaseAssetUpdater,
  defaultRequestBuffer,
  extractZipBuffer,
  sha256Buffer,
  validateExtractedPackage
};
