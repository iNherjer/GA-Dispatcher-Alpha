const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  resolveDocumentsDirectory,
  resolveTrackerDataDirectory,
  prepareTrackerStorage
} = require('./tracker-storage.js');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vfr-tracker-storage-'));
try {
  const documents = path.join(root, 'Documents');
  const legacy = path.join(root, 'Desktop', 'Tracker');
  const data = path.join(documents, 'VFR Multitool', 'Tracker');
  fs.mkdirSync(path.join(legacy, 'homebase-generated', 'vfr-multitool-homebase'), { recursive: true });
  fs.mkdirSync(path.join(legacy, 'homebase-asset-cache'), { recursive: true });
  fs.writeFileSync(path.join(legacy, 'tracker-config.json'), '{"syncId":"TEST"}\n');
  fs.writeFileSync(path.join(legacy, 'ga-tracker-debug.txt'), 'legacy log\n');
  fs.writeFileSync(path.join(legacy, 'homebase-generated', 'installed-homebase-state.json'), '{"ok":true}\n');
  fs.writeFileSync(path.join(legacy, 'homebase-generated', 'vfr-multitool-homebase', 'last-build.log'), 'build\n');
  fs.writeFileSync(path.join(legacy, 'homebase-asset-cache', 'active-package-index.json'), '{"packageVersion":"1.0.0"}\n');

  const resolvedDocuments = resolveDocumentsDirectory({
    environment: { VFR_MULTITOOL_DOCUMENTS_DIR: documents },
    homeDirectory: root,
    platform: 'win32'
  });
  assert(resolvedDocuments === path.resolve(documents), 'Explicit Documents directory was not used.');
  assert(resolveTrackerDataDirectory({ environment: { VFR_MULTITOOL_DOCUMENTS_DIR: documents }, homeDirectory: root, platform: 'win32' }) === data,
    'Tracker data directory is not below Documents/VFR Multitool/Tracker.');

  const result = prepareTrackerStorage({ legacyDirectory: legacy, dataDirectory: data });
  assert(result.dataDirectory === data, 'Prepared storage did not use the requested data directory.');
  assert(result.migrated.length === 4, `Expected four migrated entries, got ${result.migrated.length}.`);
  assert(!fs.existsSync(path.join(legacy, 'homebase-generated')), 'Legacy generated directory was not removed.');
  assert(!fs.existsSync(path.join(legacy, 'homebase-asset-cache')), 'Legacy asset cache was not removed.');
  assert(JSON.parse(fs.readFileSync(path.join(data, 'tracker-config.json'), 'utf8')).syncId === 'TEST', 'Tracker config was not migrated.');
  assert(fs.existsSync(path.join(data, 'homebase-generated', 'installed-homebase-state.json')), 'Installed state was not migrated.');
  assert(fs.existsSync(path.join(data, 'homebase-generated', 'vfr-multitool-homebase', 'last-build.log')), 'Build diagnostics were not migrated.');
  assert(fs.existsSync(path.join(data, 'homebase-asset-cache', 'active-package-index.json')), 'Active asset index was not migrated.');

  console.log('Tracker storage self-test passed.');
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
