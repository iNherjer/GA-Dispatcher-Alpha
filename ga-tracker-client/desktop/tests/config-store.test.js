const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { TrackerConfigStore, normalizeUpdatePolicy } = require('../lib/config-store');

const secureStorage = {
  isEncryptionAvailable: () => true,
  encryptString: (value) => Buffer.from(`protected:${value}`, 'utf8'),
  decryptString: (value) => String(value).replace(/^protected:/, '')
};

function createStore() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vfr-tracker-desktop-'));
  return new TrackerConfigStore({
    documentsDirectory: path.join(root, 'Documents'),
    applicationDataDirectory: path.join(root, 'LocalAppData', 'VFR Multitool', 'Desktop'),
    secureStorage
  });
}

test('update policy defaults to ask and accepts automatic', () => {
  assert.equal(normalizeUpdatePolicy(''), 'ask');
  assert.equal(normalizeUpdatePolicy('invalid'), 'ask');
  assert.equal(normalizeUpdatePolicy('automatic'), 'automatic');
});

test('credentials are encrypted in app data while personal tracker config is preserved', () => {
  const store = createStore();
  store.write({ homebaseFallback: { schemaVersion: 1 }, consoleMode: 'status', pin: '9999' });
  store.saveCredentials('Foxtrot-Mike-764', '1234');
  store.setRuntimeChannel('alpha');
  store.setUpdatePolicy('automatic');
  store.setModuleUpdatePolicy('homebase', 'automatic');
  store.setModuleUpdatePolicy('efb', 'automatic');
  store.setModuleUpdatePolicy('bridge', 'automatic');
  store.setStartupPreferences({
    autoStartTracker: false,
    startMinimized: true,
    autoStartBridge: true,
    stopBridgeWithTracker: false
  });

  const trackerConfig = store.read();
  const desktopConfig = store.readDesktop();
  assert.equal(trackerConfig.syncId, 'Foxtrot-Mike-764');
  assert.equal(trackerConfig.pin, undefined);
  assert.equal(trackerConfig.consoleMode, 'status');
  assert.deepEqual(trackerConfig.homebaseFallback, { schemaVersion: 1 });
  assert.equal(desktopConfig.encryptedPin, Buffer.from('protected:1234').toString('base64'));
  assert.deepEqual(store.credentials(), { pilotId: 'Foxtrot-Mike-764', pin: '1234' });
  assert.deepEqual(store.publicSettings(), {
    pilotId: 'Foxtrot-Mike-764',
    hasPin: true,
    runtimeChannel: 'alpha',
    updatePolicy: 'automatic',
    homebaseUpdatePolicy: 'automatic',
    efbUpdatePolicy: 'automatic',
    bridgeUpdatePolicy: 'automatic',
    autoStartTracker: false,
    startMinimized: true,
    autoStartBridge: true,
    stopBridgeWithTracker: false
  });
});

test('legacy plaintext credentials are removed only after successful verification', async () => {
  const store = createStore();
  store.write({
    syncId: 'legacy-id',
    pin: '1234',
    trackerDesktop: { updatePolicy: 'automatic', autoStartTracker: true, startMinimized: true },
    homebaseFallback: { keep: true }
  });

  const failed = await store.migrateLegacyCredentials(async () => ({ ok: false, message: 'offline' }));
  assert.equal(failed.verificationFailed, true);
  assert.equal(store.read().pin, '1234');

  const migrated = await store.migrateLegacyCredentials(async (pilotId, pin) => {
    assert.equal(pilotId, 'legacy-id');
    assert.equal(pin, '1234');
    return { ok: true, pilotId: 'Legacy-ID' };
  });
  assert.equal(migrated.migrated, true);
  assert.equal(store.read().pin, undefined);
  assert.deepEqual(store.read().homebaseFallback, { keep: true });
  assert.deepEqual(store.credentials(), { pilotId: 'Legacy-ID', pin: '1234' });
  assert.equal(store.publicSettings().startMinimized, true);
});

test('startup preferences default to automatic tracker start and visible window', () => {
  const store = createStore();
  assert.deepEqual(store.publicSettings(), {
    pilotId: '',
    hasPin: false,
    runtimeChannel: 'stable',
    updatePolicy: 'ask',
    homebaseUpdatePolicy: 'ask',
    efbUpdatePolicy: 'ask',
    bridgeUpdatePolicy: 'ask',
    autoStartTracker: true,
    startMinimized: false,
    autoStartBridge: false,
    stopBridgeWithTracker: true
  });
});

test('module update policies reject unknown modules', () => {
  const store = createStore();
  assert.throws(() => store.setModuleUpdatePolicy('unknown', 'automatic'), /Unbekanntes Update-Modul/);
});

test('PIN validation and unavailable OS encryption are rejected', () => {
  const store = createStore();
  assert.throws(() => store.saveCredentials('Pilot', '12ab'), /vier Ziffern/);
  const unavailable = new TrackerConfigStore({
    documentsDirectory: path.join(os.tmpdir(), 'documents'),
    applicationDataDirectory: path.join(os.tmpdir(), 'appdata'),
    secureStorage: { isEncryptionAvailable: () => false }
  });
  assert.throws(() => unavailable.saveCredentials('Pilot', '1234'), /Windows-Schutz/);
});
