'use strict';
// Uploads finished flight tracks (free flights with their record, mission tracks by runId)
// to the pilot's flight logbook in the Cloudflare worker (/api/flightlog-v1/).
const https = require('node:https');

const DEFAULT_BASE_URL = 'https://ga-proxy.einherjer.workers.dev/api/flightlog-v1/';

function request(url, init = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, { method: init.method || 'GET', headers: init.headers }, res => {
      const chunks = []; let size = 0;
      res.on('data', chunk => { size += chunk.length; if (size > 256 * 1024) { res.destroy(Error('flightlog_response_too_large')); return; } chunks.push(chunk); });
      res.on('error', reject);
      res.on('end', () => {
        let data = null;
        try { data = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch (_) {}
        resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, data });
      });
    });
    req.setTimeout(15000, () => req.destroy(Error('flightlog_timeout')));
    req.on('error', reject);
    req.end(init.body);
  });
}

function entryFor(file) {
  if (file.kind === 'free') return { ...(file.entry || {}), kind: 'free', runId: file.runId, completionId: file.completionId || file.runId, startTs: file.startTs, endTs: file.endTs };
  return { kind: 'mission', runId: file.runId, missionId: file.missionId || null, startTs: file.startTs, endTs: file.endTs };
}

function createFlightLogbookCloud({ store, pilotId, pin, onUploaded = () => {}, baseUrl = DEFAULT_BASE_URL, transport = request, now = Date.now, log = () => {} }) {
  let busy = false, retryAt = 0, failures = 0;
  const headers = { 'Content-Type': 'application/json', 'X-Pilot-ID': String(pilotId), 'X-Pilot-PIN': String(pin) };

  async function flush() {
    if (busy || now() < retryAt || !pilotId || !pin) return { status: 'deferred' };
    busy = true;
    try {
      const files = store.pendingUploads(5);
      if (!files.length) return { status: 'empty' };
      let uploaded = 0;
      for (const file of files) {
        const res = await transport(baseUrl + 'put', { method: 'POST', headers, body: JSON.stringify({ entry: entryFor(file), track: file.track }) });
        if (res.ok) {
          store.markUploaded(file.runId);
          uploaded += 1;
          try { onUploaded(file); } catch (_) {}
          continue;
        }
        if (res.status === 400 || res.status === 413) {
          // Never retry data the server refuses; keep it locally.
          store.markUploaded(file.runId, `rejected-${res.status}`);
          log(`FLIGHT_LOGBOOK_REJECTED run=${file.runId} status=${res.status} error=${res.data?.error || ''}`);
          continue;
        }
        throw Object.assign(Error(res.data?.error || `http_${res.status}`), { status: res.status });
      }
      failures = 0; retryAt = 0;
      log(`FLIGHT_LOGBOOK_SYNCED uploaded=${uploaded}`);
      return { status: 'saved', uploaded };
    } catch (error) {
      failures += 1;
      retryAt = now() + Math.min(600000, 10000 * 2 ** Math.min(failures - 1, 6));
      log(`FLIGHT_LOGBOOK_PENDING error=${error.message}`);
      return { status: 'pending', error: error.message };
    } finally { busy = false; }
  }
  return { flush };
}

module.exports = { createFlightLogbookCloud, entryFor, DEFAULT_BASE_URL };
