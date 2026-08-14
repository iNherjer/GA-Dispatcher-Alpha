(function initHomebaseCapabilityRetry(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.GAHomebaseCapabilityRetry = api;
})(typeof window !== 'undefined' ? window : null, function createHomebaseCapabilityRetryApi() {
  'use strict';

  const DEFAULT_CAPABILITY = 'homebase-crew-scene';
  const DEFAULT_RETRY_MS = 15000;

  function createCapabilityRetryGate(options = {}) {
    const capability = String(options.capability || DEFAULT_CAPABILITY).trim().toLowerCase();
    const retryMs = Math.max(1000, Number(options.retryMs) || DEFAULT_RETRY_MS);
    const clock = typeof options.now === 'function' ? options.now : Date.now;
    let supported = false;
    let awaitingResponse = false;
    let lastRequestedAt = null;
    let lastResponseAt = null;
    let attempts = 0;

    function timestamp(value) {
      const number = Number(value);
      return Number.isFinite(number) ? number : Number(clock());
    }

    function shouldRequest(at = clock()) {
      if (supported) return false;
      const now = timestamp(at);
      return lastRequestedAt === null || now - lastRequestedAt >= retryMs;
    }

    function noteRequest(at = clock()) {
      lastRequestedAt = timestamp(at);
      awaitingResponse = true;
      attempts += 1;
    }

    function noteSendFailed(at = clock()) {
      if (lastRequestedAt === null) lastRequestedAt = timestamp(at);
      awaitingResponse = false;
    }

    function noteCapabilities(capabilities, at = clock()) {
      const values = Array.isArray(capabilities)
        ? capabilities.map((value) => String(value || '').trim().toLowerCase())
        : [];
      supported = values.includes(capability);
      awaitingResponse = false;
      lastResponseAt = timestamp(at);
      // Eine negative Antwort startet ebenfalls das Retry-Fenster. Vor allem darf
      // sie den letzten Versuch nicht loeschen und damit eine Sofortschleife bauen.
      if (!supported && lastRequestedAt === null) lastRequestedAt = lastResponseAt;
      return supported;
    }

    function reset() {
      supported = false;
      awaitingResponse = false;
      lastRequestedAt = null;
      lastResponseAt = null;
      attempts = 0;
    }

    function snapshot() {
      return Object.freeze({
        capability,
        retryMs,
        supported,
        awaitingResponse,
        lastRequestedAt,
        lastResponseAt,
        attempts
      });
    }

    return Object.freeze({
      shouldRequest,
      noteRequest,
      noteSendFailed,
      noteCapabilities,
      reset,
      isSupported: () => supported,
      snapshot
    });
  }

  return Object.freeze({
    DEFAULT_CAPABILITY,
    DEFAULT_RETRY_MS,
    createCapabilityRetryGate
  });
});
