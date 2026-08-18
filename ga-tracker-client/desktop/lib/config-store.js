const fs = require('node:fs');
const path = require('node:path');
const { normalizeRuntimeChannel } = require('./runtime-channel');
const {
  PILOT_PIN_REQUIREMENT,
  isValidPilotPin,
  normalizePilotPin
} = require('./pilot-pin-policy');

const UPDATE_POLICIES = new Set(['ask', 'automatic']);
const VOICE_PROVIDERS = new Set(['gemini', 'openai']);
const MODULE_UPDATE_POLICY_KEYS = Object.freeze({
  desktop: 'desktopUpdatePolicy',
  homebase: 'homebaseUpdatePolicy',
  efb: 'efbUpdatePolicy',
  bridge: 'bridgeUpdatePolicy'
});

function normalizeUpdatePolicy(value) {
  return UPDATE_POLICIES.has(String(value || '').trim()) ? String(value).trim() : 'ask';
}

function normalizeBoolean(value, fallback) {
  return typeof value === 'boolean' ? value : fallback;
}

function normalizeVoiceProvider(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return VOICE_PROVIDERS.has(normalized) ? normalized : 'gemini';
}

function resolveTrackerDataDirectory(documentsDirectory) {
  return path.join(path.resolve(documentsDirectory), 'VFR Multitool', 'Tracker');
}

function safeObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

class TrackerConfigStore {
  constructor({ documentsDirectory, applicationDataDirectory, secureStorage, fsModule = fs } = {}) {
    if (!documentsDirectory) throw new Error('documentsDirectory fehlt.');
    if (!applicationDataDirectory) throw new Error('applicationDataDirectory fehlt.');
    if (!secureStorage) throw new Error('secureStorage fehlt.');
    this.fs = fsModule;
    this.secureStorage = secureStorage;
    this.dataDirectory = resolveTrackerDataDirectory(documentsDirectory);
    this.applicationDataDirectory = path.resolve(applicationDataDirectory);
    this.configPath = path.join(this.dataDirectory, 'tracker-config.json');
    this.desktopSettingsPath = path.join(this.applicationDataDirectory, 'desktop-settings.json');
  }

  ensureDataDirectory() {
    this.fs.mkdirSync(this.dataDirectory, { recursive: true });
    this.fs.mkdirSync(this.applicationDataDirectory, { recursive: true });
    return this.dataDirectory;
  }

  readJson(file) {
    try {
      if (!this.fs.existsSync(file)) return {};
      return safeObject(JSON.parse(this.fs.readFileSync(file, 'utf8')));
    } catch (_) {
      return {};
    }
  }

  writeJson(file, nextConfig) {
    const data = safeObject(nextConfig);
    this.fs.mkdirSync(path.dirname(file), { recursive: true });
    const temporaryPath = `${file}.${process.pid}.tmp`;
    this.fs.writeFileSync(temporaryPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
    try {
      this.fs.renameSync(temporaryPath, file);
    } catch (error) {
      try {
        this.fs.copyFileSync(temporaryPath, file);
        this.fs.rmSync(temporaryPath, { force: true });
      } catch (_) {
        try { this.fs.rmSync(temporaryPath, { force: true }); } catch (_) {}
        throw error;
      }
    }
    return data;
  }

  // Kompatibilitaet fuer die bestehenden Tracker-/Homebase-Daten in Dokumente.
  read() {
    return this.readJson(this.configPath);
  }

  write(nextConfig) {
    return this.writeJson(this.configPath, nextConfig);
  }

  readDesktop() {
    return this.readJson(this.desktopSettingsPath);
  }

  writeDesktop(nextConfig) {
    return this.writeJson(this.desktopSettingsPath, nextConfig);
  }

  encryptionAvailable() {
    try {
      return this.secureStorage.isEncryptionAvailable() === true;
    } catch (_) {
      return false;
    }
  }

  publicSettings() {
    const tracker = this.read();
    const desktop = this.readDesktop();
    const preferences = safeObject(desktop.preferences);
    return {
      pilotId: String(desktop.pilotId || tracker.syncId || '').trim(),
      hasPin: Boolean(String(desktop.encryptedPin || '').trim()) && this.encryptionAvailable(),
      voiceProvider: normalizeVoiceProvider(desktop.voice?.provider),
      hasVoiceApiKey: Boolean(String(desktop.voice?.encryptedApiKey || '').trim()) && this.encryptionAvailable(),
      runtimeChannel: normalizeRuntimeChannel(preferences.runtimeChannel),
      desktopUpdatePolicy: normalizeUpdatePolicy(preferences.desktopUpdatePolicy),
      updatePolicy: normalizeUpdatePolicy(preferences.updatePolicy),
      homebaseUpdatePolicy: normalizeUpdatePolicy(preferences.homebaseUpdatePolicy),
      efbUpdatePolicy: normalizeUpdatePolicy(preferences.efbUpdatePolicy),
      bridgeUpdatePolicy: normalizeUpdatePolicy(preferences.bridgeUpdatePolicy),
      aptMissionExecutionEnabled: normalizeBoolean(preferences.aptMissionExecutionEnabled, false),
      autoStartTracker: normalizeBoolean(preferences.autoStartTracker, true),
      startMinimized: normalizeBoolean(preferences.startMinimized, false),
      autoStartBridge: normalizeBoolean(preferences.autoStartBridge, false),
      stopBridgeWithTracker: normalizeBoolean(preferences.stopBridgeWithTracker, true)
    };
  }

  credentials() {
    const desktop = this.readDesktop();
    const pilotId = String(desktop.pilotId || '').trim();
    const encryptedPin = String(desktop.encryptedPin || '').trim();
    if (!pilotId || !encryptedPin || !this.encryptionAvailable()) return null;
    try {
      const pin = normalizePilotPin(this.secureStorage.decryptString(Buffer.from(encryptedPin, 'base64')));
      if (!isValidPilotPin(pin)) return null;
      return { pilotId, pin };
    } catch (_) {
      return null;
    }
  }

  hasCredentials() {
    return Boolean(this.credentials());
  }

  voiceCredentials() {
    const desktop = this.readDesktop();
    const voice = safeObject(desktop.voice);
    const encryptedApiKey = String(voice.encryptedApiKey || '').trim();
    if (!encryptedApiKey || !this.encryptionAvailable()) return null;
    try {
      const apiKey = String(this.secureStorage.decryptString(Buffer.from(encryptedApiKey, 'base64')) || '').trim();
      if (!apiKey || apiKey.length > 1024) return null;
      return {
        provider: normalizeVoiceProvider(voice.provider),
        apiKey
      };
    } catch (_) {
      return null;
    }
  }

  saveVoiceCredentials(provider, apiKey) {
    const normalizedProvider = normalizeVoiceProvider(provider);
    const normalizedApiKey = String(apiKey || '').trim();
    if (!normalizedApiKey || normalizedApiKey.length > 1024) throw new Error('API-Key fehlt oder ist zu lang.');
    if (!this.encryptionAvailable()) throw new Error('Der Windows-Schutz für Zugangsdaten ist derzeit nicht verfügbar.');

    const encryptedApiKey = this.secureStorage.encryptString(normalizedApiKey).toString('base64');
    const desktop = this.readDesktop();
    this.writeDesktop({
      ...desktop,
      schemaVersion: 2,
      voice: {
        ...safeObject(desktop.voice),
        provider: normalizedProvider,
        encryptedApiKey
      }
    });
    return { provider: normalizedProvider, hasVoiceApiKey: true };
  }

  clearVoiceCredentials() {
    const desktop = this.readDesktop();
    const voice = safeObject(desktop.voice);
    const nextVoice = {
      ...voice,
      provider: normalizeVoiceProvider(voice.provider)
    };
    delete nextVoice.encryptedApiKey;
    this.writeDesktop({
      ...desktop,
      schemaVersion: 2,
      voice: nextVoice
    });
    return { provider: nextVoice.provider, hasVoiceApiKey: false };
  }

  saveCredentials(pilotId, pin) {
    const normalizedPilotId = String(pilotId || '').trim();
    const normalizedPin = normalizePilotPin(pin);
    if (!normalizedPilotId || normalizedPilotId.length > 160) throw new Error('Pilot-ID fehlt oder ist zu lang.');
    if (!isValidPilotPin(normalizedPin)) throw new Error(PILOT_PIN_REQUIREMENT);
    if (!this.encryptionAvailable()) throw new Error('Der Windows-Schutz für Zugangsdaten ist derzeit nicht verfügbar.');

    const encryptedPin = this.secureStorage.encryptString(normalizedPin).toString('base64');
    const desktop = this.readDesktop();
    this.writeDesktop({
      ...desktop,
      schemaVersion: 1,
      pilotId: normalizedPilotId,
      encryptedPin
    });
    const tracker = this.read();
    const sanitizedTracker = { ...tracker, syncId: normalizedPilotId };
    delete sanitizedTracker.pin;
    this.write(sanitizedTracker);
    return { pilotId: normalizedPilotId };
  }

  setUpdatePolicy(policy) {
    const normalized = normalizeUpdatePolicy(policy);
    const desktop = this.readDesktop();
    return this.writeDesktop({
      ...desktop,
      preferences: {
        ...safeObject(desktop.preferences),
        updatePolicy: normalized
      }
    });
  }

  setModuleUpdatePolicy(module, policy) {
    const key = MODULE_UPDATE_POLICY_KEYS[String(module || '').trim().toLowerCase()];
    if (!key) throw new Error('Unbekanntes Update-Modul.');
    const normalized = normalizeUpdatePolicy(policy);
    const desktop = this.readDesktop();
    return this.writeDesktop({
      ...desktop,
      preferences: {
        ...safeObject(desktop.preferences),
        [key]: normalized
      }
    });
  }

  setRuntimeChannel(channel) {
    const normalized = normalizeRuntimeChannel(channel);
    const desktop = this.readDesktop();
    return this.writeDesktop({
      ...desktop,
      preferences: {
        ...safeObject(desktop.preferences),
        runtimeChannel: normalized
      }
    });
  }

  setAptMissionExecutionEnabled(enabled) {
    const desktop = this.readDesktop();
    return this.writeDesktop({
      ...desktop,
      preferences: {
        ...safeObject(desktop.preferences),
        aptMissionExecutionEnabled: enabled === true
      }
    });
  }

  setStartupPreferences(preferences = {}) {
    const desktop = this.readDesktop();
    const current = safeObject(desktop.preferences);
    return this.writeDesktop({
      ...desktop,
      preferences: {
        ...current,
        autoStartTracker: normalizeBoolean(preferences.autoStartTracker, normalizeBoolean(current.autoStartTracker, true)),
        startMinimized: normalizeBoolean(preferences.startMinimized, normalizeBoolean(current.startMinimized, false)),
        autoStartBridge: normalizeBoolean(preferences.autoStartBridge, normalizeBoolean(current.autoStartBridge, false)),
        stopBridgeWithTracker: normalizeBoolean(preferences.stopBridgeWithTracker, normalizeBoolean(current.stopBridgeWithTracker, true))
      }
    });
  }

  migrateLegacyPreferences() {
    const tracker = this.read();
    const legacy = safeObject(tracker.trackerDesktop);
    const desktop = this.readDesktop();
    if (!Object.keys(legacy).length || Object.keys(safeObject(desktop.preferences)).length) return false;
    this.writeDesktop({
      ...desktop,
      preferences: {
        runtimeChannel: normalizeRuntimeChannel(legacy.runtimeChannel),
        desktopUpdatePolicy: normalizeUpdatePolicy(legacy.desktopUpdatePolicy),
        updatePolicy: normalizeUpdatePolicy(legacy.updatePolicy),
        homebaseUpdatePolicy: normalizeUpdatePolicy(legacy.homebaseUpdatePolicy),
        efbUpdatePolicy: normalizeUpdatePolicy(legacy.efbUpdatePolicy),
        bridgeUpdatePolicy: normalizeUpdatePolicy(legacy.bridgeUpdatePolicy),
        aptMissionExecutionEnabled: normalizeBoolean(legacy.aptMissionExecutionEnabled, false),
        autoStartTracker: normalizeBoolean(legacy.autoStartTracker, true),
        startMinimized: normalizeBoolean(legacy.startMinimized, false),
        autoStartBridge: normalizeBoolean(legacy.autoStartBridge, false),
        stopBridgeWithTracker: normalizeBoolean(legacy.stopBridgeWithTracker, true)
      }
    });
    return true;
  }

  async migrateLegacyCredentials(verifier) {
    this.migrateLegacyPreferences();
    const tracker = this.read();
    const legacyPilotId = String(tracker.syncId || '').trim();
    const legacyPin = String(tracker.pin || '').trim();
    const existing = this.credentials();

    if (existing) {
      if (legacyPin) {
        const sanitized = { ...tracker, syncId: existing.pilotId };
        delete sanitized.pin;
        this.write(sanitized);
      }
      return { migrated: false, alreadySecure: true };
    }
    if (!legacyPilotId || !isValidPilotPin(legacyPin)) return { migrated: false };
    if (typeof verifier !== 'function') return { migrated: false, message: 'Konto-Prüfung fehlt.' };

    const verification = await verifier(legacyPilotId, legacyPin);
    if (!verification?.ok) {
      return { migrated: false, verificationFailed: true, message: verification?.message || 'Gespeicherte Zugangsdaten konnten nicht geprüft werden.' };
    }
    try {
      this.saveCredentials(verification.pilotId, legacyPin);
      return { migrated: true, pilotId: verification.pilotId };
    } catch (error) {
      return { migrated: false, verificationFailed: true, message: error?.message || String(error) };
    }
  }
}

module.exports = {
  MODULE_UPDATE_POLICY_KEYS,
  TrackerConfigStore,
  normalizeBoolean,
  normalizeUpdatePolicy,
  normalizeVoiceProvider,
  resolveTrackerDataDirectory
};
