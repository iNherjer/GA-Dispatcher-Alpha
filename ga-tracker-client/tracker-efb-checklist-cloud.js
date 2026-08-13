'use strict';

const https = require('node:https');
const {
  MAX_CHECKLISTS,
  normalizeChecklistLibrary
} = require('./tracker-efb-checklist-library.js');

const DEFAULT_SYNC_BASE_URL = 'https://ga-proxy.einherjer.workers.dev/api/sync/';
const DEFAULT_TIMEOUT_MS = 10000;
const MAX_RESPONSE_BYTES = 128 * 1024;
const FETCH_CONCURRENCY = 4;

function encodedSyncId(value) {
  return encodeURIComponent(String(value || '').trim()).replace(/%/g, '_');
}

function safeChecklistId(value) {
  return String(value || '').trim().replace(/[^\w:-]/g, '').slice(0, 96);
}

function checklistIndexKey(syncId) {
  return `CHKIDX_${encodedSyncId(syncId)}`;
}

function checklistItemKey(syncId, checklistId) {
  return `CHK_${encodedSyncId(syncId)}_${safeChecklistId(checklistId)}`;
}

function syncUrl(baseUrl, key, pin) {
  const root = `${String(baseUrl || DEFAULT_SYNC_BASE_URL).replace(/\/+$/, '')}/`;
  return `${root}${encodeURIComponent(key)}?pin=${encodeURIComponent(pin)}`;
}

function getJson(url, options = {}) {
  const timeoutMs = Math.max(1000, Number(options.timeoutMs) || DEFAULT_TIMEOUT_MS);
  const maxBytes = Math.max(1024, Number(options.maxBytes) || MAX_RESPONSE_BYTES);
  const pin = String(options.pin || '');
  const transport = options.https || https;
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const request = transport.request({
      protocol: target.protocol,
      hostname: target.hostname,
      port: target.port || 443,
      path: `${target.pathname}${target.search}`,
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'X-Pilot-PIN': pin
      },
      timeout: timeoutMs
    }, (response) => {
      const chunks = [];
      let size = 0;
      let tooLarge = false;
      response.on('data', (chunk) => {
        size += chunk.length;
        if (size > maxBytes) {
          tooLarge = true;
          response.destroy(new Error(`checklist_cloud_response_too_large:${size}`));
          return;
        }
        chunks.push(chunk);
      });
      response.on('end', () => {
        if (tooLarge) return;
        const text = Buffer.concat(chunks).toString('utf8');
        let data = null;
        try { data = text ? JSON.parse(text) : null; } catch (_) {}
        resolve({ status: Number(response.statusCode) || 0, data });
      });
      response.on('error', reject);
    });
    request.on('timeout', () => request.destroy(new Error('checklist_cloud_timeout')));
    request.on('error', reject);
    request.end();
  });
}

async function mapConcurrent(values, limit, mapper) {
  const source = Array.isArray(values) ? values : [];
  const results = new Array(source.length);
  let cursor = 0;
  async function worker() {
    while (cursor < source.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await mapper(source[index], index);
    }
  }
  const workers = [];
  const count = Math.min(Math.max(1, Number(limit) || 1), source.length);
  for (let index = 0; index < count; index += 1) workers.push(worker());
  await Promise.all(workers);
  return results;
}

async function fetchTrackerEfbChecklistLibrary(syncId, pin, options = {}) {
  const pilotId = String(syncId || '').trim();
  const pilotPin = String(pin || '').trim();
  if (!pilotId || !pilotPin) {
    return { ok: false, code: 'credentials_missing', message: 'Pilot-ID oder PIN fehlt.' };
  }
  const request = typeof options.request === 'function' ? options.request : getJson;
  const baseUrl = options.baseUrl || DEFAULT_SYNC_BASE_URL;
  const requestOptions = { pin: pilotPin, timeoutMs: options.timeoutMs || DEFAULT_TIMEOUT_MS };
  let indexResponse;
  try {
    indexResponse = await request(syncUrl(baseUrl, checklistIndexKey(pilotId), pilotPin), requestOptions);
  } catch (error) {
    return { ok: false, code: 'sync_unavailable', message: error?.message || String(error) };
  }
  if (indexResponse?.status === 404) {
    return {
      ok: true,
      status: 'empty',
      library: normalizeChecklistLibrary({ revision: 0, updatedAt: Date.now(), checklists: [] })
    };
  }
  if (indexResponse?.status === 401 || indexResponse?.status === 403) {
    return { ok: false, code: 'sync_unauthorized', message: 'Checklisten-Sync wurde abgelehnt.' };
  }
  if (indexResponse?.status !== 200 || !Array.isArray(indexResponse?.data?.entries)) {
    return { ok: false, code: 'index_invalid', message: `Checklisten-Index ungueltig (HTTP ${indexResponse?.status || 0}).` };
  }

  const entries = indexResponse.data.entries
    .filter((entry) => safeChecklistId(entry?.id))
    .slice(0, MAX_CHECKLISTS);
  let itemFailure = null;
  let payloads;
  try {
    payloads = await mapConcurrent(entries, options.concurrency || FETCH_CONCURRENCY, async (entry) => {
      const response = await request(
        syncUrl(baseUrl, checklistItemKey(pilotId, entry.id), pilotPin),
        requestOptions
      );
      if (response?.status === 404) return null;
      if (response?.status !== 200 || !response?.data) {
        itemFailure = itemFailure || `HTTP ${response?.status || 0} fuer ${safeChecklistId(entry.id)}`;
        return null;
      }
      return response.data.checklist || response.data;
    });
  } catch (error) {
    return { ok: false, code: 'item_unavailable', message: error?.message || String(error) };
  }
  if (itemFailure) return { ok: false, code: 'item_invalid', message: itemFailure };

  const updatedAt = Math.max(0, Number(indexResponse.data.lastModified) || Date.now());
  const library = normalizeChecklistLibrary({
    revision: updatedAt,
    updatedAt,
    checklists: payloads.filter(Boolean)
  });
  return { ok: true, status: library.checklists.length ? 'ok' : 'empty', library };
}

module.exports = {
  DEFAULT_SYNC_BASE_URL,
  checklistIndexKey,
  checklistItemKey,
  encodedSyncId,
  fetchTrackerEfbChecklistLibrary,
  getJson,
  safeChecklistId,
  syncUrl
};
