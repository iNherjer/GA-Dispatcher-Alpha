(function initTrackerVoiceClient(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.GATrackerVoiceClient = api;
})(typeof window !== 'undefined' ? window : null, function createTrackerVoiceClientModule() {
  'use strict';

  const DEFAULT_BASE_URL = 'http://127.0.0.1:49880/api/v1';
  const DEFAULT_POLL_INTERVAL_MS = 250;
  const DEFAULT_TIMEOUT_MS = 45000;

  function trimBaseUrl(value) {
    return String(value || DEFAULT_BASE_URL).trim().replace(/\/+$/, '');
  }

  function randomClientId() {
    const cryptoApi = typeof globalThis !== 'undefined' ? globalThis.crypto : null;
    if (typeof cryptoApi?.randomUUID === 'function') return `web-${cryptoApi.randomUUID()}`;
    return `web-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  }

  function arrayBufferToBase64(buffer) {
    if (typeof Buffer !== 'undefined') return Buffer.from(buffer || new ArrayBuffer(0)).toString('base64');
    const bytes = new Uint8Array(buffer || new ArrayBuffer(0));
    let binary = '';
    const chunkSize = 0x8000;
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
    }
    return btoa(binary);
  }

  function responsePayload(value) {
    return value?.message?.payload && typeof value.message.payload === 'object' ? value.message.payload : null;
  }

  function createTrackerVoiceClient(options = {}) {
    const baseUrl = trimBaseUrl(options.baseUrl);
    const fetchRemote = typeof options.fetchRemote === 'function' ? options.fetchRemote : globalThis.fetch;
    const clientId = String(options.clientId || randomClientId()).trim().slice(0, 160);
    const pollIntervalMs = Math.max(25, Number(options.pollIntervalMs) || DEFAULT_POLL_INTERVAL_MS);
    const timeoutMs = Math.max(1000, Number(options.timeoutMs) || DEFAULT_TIMEOUT_MS);
    const delay = typeof options.delay === 'function'
      ? options.delay
      : (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    let unavailableUntil = 0;

    async function jsonRequest(pathname, init = {}) {
      const response = await fetchRemote(`${baseUrl}${pathname}`, init);
      let body = null;
      try { body = await response.json(); } catch (_) {}
      return { response, body };
    }

    async function requestAudio(value = {}) {
      if (typeof fetchRemote !== 'function' || Date.now() < unavailableUntil) return null;
      const effectId = String(value.effectId || '').trim();
      const text = String(value.text || '').trim();
      if (!effectId || !text) return null;
      try {
        const created = await jsonRequest('/voice/jobs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ effectId, text, speaker: value.speaker || {}, voiceName: value.voiceName || '' })
        });
        if (created.response.status === 503 || created.response.status === 403) {
          unavailableUntil = Date.now() + 30000;
          return null;
        }
        if (!created.response.ok) return null;
        let job = responsePayload(created.body);
        const deadline = Date.now() + timeoutMs;
        while (job?.status === 'pending' && Date.now() < deadline) {
          await delay(pollIntervalMs);
          const polled = await jsonRequest(`/voice/jobs/${encodeURIComponent(effectId)}`);
          if (!polled.response.ok) return null;
          job = responsePayload(polled.body);
        }
        if (job?.status !== 'ready' || job?.audioAvailable !== true) return null;
        const audioResponse = await fetchRemote(`${baseUrl}/voice/jobs/${encodeURIComponent(effectId)}/audio`, { cache: 'no-store' });
        if (!audioResponse.ok) return null;
        const audioBuffer = await audioResponse.arrayBuffer();
        return {
          trackerEffectId: effectId,
          b64: arrayBufferToBase64(audioBuffer),
          mimeType: String(audioResponse.headers?.get?.('content-type') || job.contentType || 'application/octet-stream'),
          model: String(job.model || ''),
          voiceName: String(job.voiceName || ''),
          provider: String(job.provider || ''),
          sourceLabel: 'Tracker TTS'
        };
      } catch (_) {
        unavailableUntil = Date.now() + 30000;
        return null;
      }
    }

    async function claimPlayback(effectId, leaseMs = 30000) {
      try {
        const result = await jsonRequest('/voice/playback/claim', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ effectId, clientId, leaseMs })
        });
        return result.response.ok ? responsePayload(result.body) : null;
      } catch (_) {
        return null;
      }
    }

    async function releasePlayback(effectId, completed) {
      try {
        const result = await jsonRequest('/voice/playback/release', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ effectId, clientId, completed: completed === true })
        });
        return result.response.ok ? responsePayload(result.body) : null;
      } catch (_) {
        return null;
      }
    }

    return Object.freeze({
      baseUrl,
      claimPlayback,
      clientId,
      releasePlayback,
      requestAudio
    });
  }

  return Object.freeze({
    DEFAULT_BASE_URL,
    createTrackerVoiceClient
  });
});
