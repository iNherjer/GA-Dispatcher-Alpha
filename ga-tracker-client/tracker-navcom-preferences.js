'use strict';
const https = require('node:https');
const cloudSync = require('../cloud-sync-client');
const preferences = require('../navcom-preferences-core');

// Bounded JSON transport, including POST bodies. Credentials stay in headers.
function requestJson(url, init = {}) {
  return new Promise((resolve, reject) => {
    const request = https.request(url, { method: init.method || 'GET', headers: init.headers, timeout: 15000 }, response => {
      const chunks = []; let bytes = 0;
      response.on('data', chunk => {
        bytes += chunk.length;
        if (bytes > 8 * 1024 * 1024) response.destroy(new Error('navcom_response_too_large'));
        else chunks.push(chunk);
      });
      response.on('error', reject);
      response.on('end', () => {
        try {
          const data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
          resolve({ ok: response.statusCode >= 200 && response.statusCode < 300, status: response.statusCode, json: async () => data });
        } catch (_) { reject(new Error('navcom_response_invalid')); }
      });
    });
    request.on('timeout', () => request.destroy(new Error('navcom_request_timeout')));
    request.on('error', reject);
    request.end(init.body);
  });
}

function createNavcomPreferences({ pilotId, pin, readConfig, writeConfig, request = requestJson, baseUrl = 'https://ga-proxy.einherjer.workers.dev/api/sync-v2/' }) {
  const client = cloudSync.create({ pilotId, pin, request, baseUrl });
  const cloud = preferences.createCloud({ client, readLegacy: async () => {
    const response = await request(baseUrl.replace(/\/sync-v2\/?$/, '/sync/') + encodeURIComponent(pilotId), { headers: { 'X-Pilot-PIN': pin } });
    if (!response.ok) throw new Error('navcom_profile_unavailable');
    return response.json();
  } });
  const key = String(pilotId).toUpperCase();
  let busy = null, lastRead = 0;
  function state() {
    const value = readConfig().navcomPreferences?.[key] || {};
    return { mode: preferences.validMode(value.mode) ? value.mode : null, pending: value.pending === true };
  }
  function store(value) {
    const config = readConfig();
    if (!writeConfig({ ...config, navcomPreferences: { ...config.navcomPreferences, [key]: value } })) throw new Error('navcom_settings_write_failed');
  }
  async function refresh() {
    if (busy) return busy;
    if (!state().pending && Date.now() - lastRead < 15000) return state();
    busy = (async () => {
      try {
        const before = state();
        if (before.pending) {
          await cloud.write(before.mode);
          const current = state();
          if (current.mode === before.mode) store({ mode: current.mode, pending: false });
        } else {
          const mode = await cloud.read();
          // A click during the request owns the local pending choice.
          if (!state().pending && mode !== null) store({ mode, pending: false });
        }
        lastRead = Date.now();
      } catch (_) { /* Keep a failed upload persistently pending for retry. */ }
      return state();
    })().finally(() => { busy = null; });
    return busy;
  }
  function update(mode) {
    if (!preferences.validMode(mode)) return { ok: false, error: 'invalid_navcom_mode' };
    try { store({ mode, pending: true }); } catch (_) { return { ok: false, error: 'navcom_settings_write_failed' }; }
    void refresh();
    return { ok: true, ...state() };
  }
  return { state, refresh, update };
}
module.exports = { createNavcomPreferences };
