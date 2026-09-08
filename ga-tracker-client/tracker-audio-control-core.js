'use strict';
const fs = require('node:fs');
const path = require('node:path');

const BOOLEAN_SETTINGS = ['enabled', 'paxEnabled', 'effectsEnabled', 'readFreq', 'terrain', 'airspace', 'waypoint'];
const DEFAULT_SETTINGS = Object.freeze({ enabled: true, volume: 1, voicePack: '', paxEnabled: true,
  effectsEnabled: true, readFreq: true, terrain: true, airspace: true, waypoint: true });
function normalizeSettings(value = {}) {
  const result = { ...DEFAULT_SETTINGS };
  for (const key of BOOLEAN_SETTINGS) if (typeof value[key] === 'boolean') result[key] = value[key];
  if (Number.isFinite(value.volume)) result.volume = Math.min(1, Math.max(0, value.volume));
  result.voicePack = /^[a-z0-9-]{0,48}$/.test(value.voicePack || '') ? value.voicePack || '' : '';
  return result;
}
function normalizeRecord(value = {}) {
  const target = value.target || {};
  return { schema: 'ga.audio-control.v1', revision: Number.isSafeInteger(value.revision) && value.revision >= 0 ? value.revision : 0,
    updatedAt: Math.max(0, Number(value.updatedAt) || 0),
    target: target.mode === 'app' && String(target.deviceId || '').trim()
      ? { mode: 'app', deviceId: String(target.deviceId).trim().slice(0, 160), name: String(target.name || 'App').slice(0, 80) }
      : { mode: 'pc', deviceId: 'pc', name: 'PC' },
    settings: normalizeSettings(value.settings) };
}
function createAudioControl({ storageFile, cloud, now = Date.now, onChange = () => {}, log = () => {} } = {}) {
  let record = normalizeRecord(), cloudState = 'local', uploading = Promise.resolve();
  let retryTimer = null, retryDelay = 5000, stopped = false;
  let uploadedRevision = -1;
  function scheduleRetry() {
    if (stopped || retryTimer) return;
    retryTimer = setTimeout(() => { retryTimer = null; saveCloud(); }, retryDelay);
    if (retryTimer.unref) retryTimer.unref();
    retryDelay = Math.min(60000, retryDelay * 2);
  }
  try { record = normalizeRecord(JSON.parse(fs.readFileSync(storageFile, 'utf8'))); } catch (_) {}
  function persist() {
    if (!storageFile) return;
    fs.mkdirSync(path.dirname(storageFile), { recursive: true });
    const temporary = storageFile + '.tmp';
    fs.writeFileSync(temporary, JSON.stringify(record)); fs.renameSync(temporary, storageFile);
  }
  const snapshot = () => ({ ...JSON.parse(JSON.stringify(record)), cloudState });
  function publish() { onChange(snapshot()); }
  function saveCloud() {
    if (!cloud || stopped) return;
    cloudState = 'pending';
    uploading = uploading.catch(() => {}).then(async () => {
      const sent = snapshot();
      // Coalesce queued slider changes instead of uploading the same revision repeatedly.
      if (sent.revision === uploadedRevision) { cloudState = 'synced'; publish(); return; }
      try {
        await cloud.save(sent);
        uploadedRevision = sent.revision;
        cloudState = record.revision === sent.revision ? 'synced' : 'pending';
        retryDelay = 5000;
        if (retryTimer) clearTimeout(retryTimer);
        retryTimer = null;
      } catch (error) {
        cloudState = 'pending'; log(`AUDIO_CLOUD_SAVE_FAILED ${error.code || error.message}`); scheduleRetry();
      }
      publish();
    });
  }
  async function restore() {
    if (!cloud) return snapshot();
    const originalRevision = record.revision;
    try {
      const remote = await cloud.load();
      if (remote && record.revision === originalRevision && Number(remote.updatedAt) > record.updatedAt) {
        record = normalizeRecord(remote); persist();
      }
      if (!remote || record.updatedAt > Number(remote.updatedAt)) saveCloud(); else cloudState = 'synced';
    } catch (error) {
      cloudState = 'pending'; log(`AUDIO_CLOUD_LOAD_FAILED ${error.code || error.message}`);
      if (!stopped && !retryTimer) {
        retryTimer = setTimeout(() => { retryTimer = null; restore(); }, retryDelay);
        if (retryTimer.unref) retryTimer.unref();
        retryDelay = Math.min(60000, retryDelay * 2);
      }
    }
    publish(); return snapshot();
  }
  function update(request = {}) {
    if (!Number.isSafeInteger(request.expectedRevision) || request.expectedRevision !== record.revision) return { ok: false, error: 'audio_revision_conflict', audio: snapshot() };
    const before = record;
    record = normalizeRecord({ ...record, target: request.target || record.target,
      settings: { ...record.settings, ...(request.settings || {}) }, revision: record.revision + 1, updatedAt: now() });
    try { persist(); } catch (_) { record = before; return { ok: false, error: 'audio_persist_failed', audio: snapshot() }; }
    saveCloud(); publish();
    return { ok: true, audio: snapshot() };
  }
  function canPlay(deviceId, kind) {
    const settings = record.settings;
    return settings.enabled && record.target.deviceId === deviceId
      && (kind === 'cargo' ? settings.effectsEnabled
        : ['boarding', 'farewell'].includes(kind) ? (settings.paxEnabled || settings.effectsEnabled)
        : ['terrain', 'airspace', 'waypoint', 'readFreq'].includes(kind) ? settings[kind] : settings.paxEnabled);
  }
  return { snapshot, update, restore, canPlay, flush: () => uploading,
    close() { stopped = true; if (retryTimer) clearTimeout(retryTimer); retryTimer = null; },
    // Provider slot reserved for a future local TTS implementation. No local engine enabled.
    ttsProviders: ['gemini', 'openai'] };
}
function createAudioCloud({ pilotId, pin, fetchRemote = fetch }) {
  const url = `https://ga-proxy.einherjer.workers.dev/api/audio-settings/${encodeURIComponent(pilotId)}`;
  const headers = { 'X-Pilot-ID': pilotId, 'X-Pilot-PIN': pin, 'Content-Type': 'application/json' };
  return {
    async load() { const response = await fetchRemote(url, { headers, signal: AbortSignal.timeout(10000) });
      if (response.status === 404) return null;
      if (!response.ok) throw new Error(`audio_cloud_${response.status}`);
      return (await response.json()).record; },
    async save(record) { const response = await fetchRemote(url, { method: 'POST', headers,
      body: JSON.stringify(record), signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error(`audio_cloud_${response.status}`); }
  };
}
module.exports = { DEFAULT_SETTINGS, normalizeSettings, normalizeRecord, createAudioControl, createAudioCloud };
