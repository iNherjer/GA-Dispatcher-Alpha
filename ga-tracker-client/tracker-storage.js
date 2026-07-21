const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const DATA_FOLDER_PARTS = Object.freeze(['VFR Multitool', 'Tracker']);
const LEGACY_ENTRIES = Object.freeze([
  'tracker-config.json',
  'ga-tracker-debug.txt',
  'homebase-generated',
  'homebase-asset-cache'
]);

function expandWindowsEnvironment(value, environment = process.env) {
  return String(value || '').replace(/%([^%]+)%/g, (_match, name) => {
    const key = Object.keys(environment).find((candidate) => candidate.toLowerCase() === String(name).toLowerCase());
    return key ? String(environment[key] || '') : _match;
  });
}

function registryDocumentsDirectory(environment = process.env, run = execFileSync) {
  try {
    const output = run('reg.exe', [
      'query',
      'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\User Shell Folders',
      '/v',
      'Personal'
    ], { encoding: 'utf8', windowsHide: true, timeout: 3000 });
    const match = String(output || '').match(/\bPersonal\s+REG_(?:EXPAND_)?SZ\s+(.+)$/im);
    return match ? path.resolve(expandWindowsEnvironment(match[1].trim(), environment)) : '';
  } catch (_) {
    return '';
  }
}

function resolveDocumentsDirectory(options = {}) {
  const environment = options.environment || process.env;
  const explicit = String(environment.VFR_MULTITOOL_DOCUMENTS_DIR || '').trim();
  if (explicit) return path.resolve(expandWindowsEnvironment(explicit, environment));

  const platform = options.platform || process.platform;
  const homeDirectory = options.homeDirectory || os.homedir();
  if (platform === 'win32') {
    const fromRegistry = registryDocumentsDirectory(environment, options.execFileSync || execFileSync);
    if (fromRegistry) return fromRegistry;
    for (const oneDriveKey of ['OneDriveConsumer', 'OneDriveCommercial', 'OneDrive']) {
      const oneDriveRoot = String(environment[oneDriveKey] || '').trim();
      if (!oneDriveRoot) continue;
      const candidate = path.join(oneDriveRoot, 'Documents');
      if ((options.existsSync || fs.existsSync)(candidate)) return path.resolve(candidate);
    }
  }
  return path.resolve(homeDirectory, 'Documents');
}

function resolveTrackerDataDirectory(options = {}) {
  const environment = options.environment || process.env;
  const explicit = String(environment.VFR_MULTITOOL_TRACKER_DATA_DIR || '').trim();
  if (explicit) return path.resolve(expandWindowsEnvironment(explicit, environment));
  return path.join(resolveDocumentsDirectory(options), ...DATA_FOLDER_PARTS);
}

function copyNewestFile(source, target) {
  const sourceStat = fs.statSync(source);
  const targetExists = fs.existsSync(target);
  const targetStat = targetExists ? fs.statSync(target) : null;
  if (!targetExists || sourceStat.mtimeMs > targetStat.mtimeMs) {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(source, target);
    fs.utimesSync(target, sourceStat.atime, sourceStat.mtime);
  }
  fs.rmSync(source, { force: true });
}

function mergeLegacyEntry(source, target) {
  if (!fs.existsSync(source)) return;
  const sourceStat = fs.statSync(source);
  if (!sourceStat.isDirectory()) {
    copyNewestFile(source, target);
    return;
  }
  if (!fs.existsSync(target)) {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    try {
      fs.renameSync(source, target);
      return;
    } catch (_) {
      fs.cpSync(source, target, { recursive: true, force: false, errorOnExist: false });
      fs.rmSync(source, { recursive: true, force: true });
      return;
    }
  }
  fs.mkdirSync(target, { recursive: true });
  for (const name of fs.readdirSync(source)) {
    mergeLegacyEntry(path.join(source, name), path.join(target, name));
  }
  fs.rmSync(source, { recursive: true, force: true });
}

function prepareTrackerStorage(options = {}) {
  const legacyDirectory = path.resolve(options.legacyDirectory || process.cwd());
  const preferredDirectory = path.resolve(options.dataDirectory || resolveTrackerDataDirectory(options));
  const events = [];
  try {
    fs.mkdirSync(preferredDirectory, { recursive: true });
  } catch (error) {
    return {
      dataDirectory: legacyDirectory,
      preferredDirectory,
      migrated: [],
      events: [`STORAGE_FALLBACK preferred="${preferredDirectory}" error="${error?.message || error}"`]
    };
  }

  const migrated = [];
  if (legacyDirectory !== preferredDirectory) {
    for (const name of LEGACY_ENTRIES) {
      const source = path.join(legacyDirectory, name);
      if (!fs.existsSync(source)) continue;
      try {
        mergeLegacyEntry(source, path.join(preferredDirectory, name));
        migrated.push(name);
      } catch (error) {
        events.push(`STORAGE_MIGRATION_ERROR entry="${name}" error="${error?.message || error}"`);
      }
    }
  }
  if (migrated.length) events.push(`STORAGE_MIGRATED entries="${migrated.join(',')}" from="${legacyDirectory}"`);
  return { dataDirectory: preferredDirectory, preferredDirectory, migrated, events };
}

module.exports = {
  DATA_FOLDER_PARTS,
  LEGACY_ENTRIES,
  expandWindowsEnvironment,
  resolveDocumentsDirectory,
  resolveTrackerDataDirectory,
  prepareTrackerStorage
};
