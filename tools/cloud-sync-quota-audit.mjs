// Reproducible request/key-operation accounting; synthetic data, no live account calls.
import { createRequire } from 'node:module';
import worker from './cloudflare-worker/worker-merged-full.js';
import { ProfileSync } from './cloudflare-worker/profile-sync.mjs';
const require = createRequire(import.meta.url);
const { create } = require('../cloud-sync-client.js');
let counters;
const reset = () => { counters = { http: 0, kvReads: 0, kvWrites: 0, kvLists: 0, doRequests: 0, storageKeysRead: 0, storageKeysWritten: 0, alarmReads: 0, alarmWrites: 0, requestBodyBytes: 0, responseBodyBytes: 0 }; };
reset();
const values = new Map(); let alarm = null;
const storage = {
  get: async key => { counters.storageKeysRead += Array.isArray(key) ? key.length : 1; return Array.isArray(key) ? new Map(key.filter(k => values.has(k)).map(k => [k, values.get(k)])) : values.get(key); },
  put: async (key, value) => { const pairs = typeof key === 'object' ? Object.entries(key) : [[key, value]]; counters.storageKeysWritten += pairs.length; for (const [k,v] of pairs) values.set(k, structuredClone(v)); },
  getAlarm: async () => { counters.alarmReads++; return alarm; }, setAlarm: async time => { counters.alarmWrites++; alarm = time; }
};
const coordinator = new ProfileSync({ storage, blockConcurrencyWhile: fn => fn() });
const kv = new Map([['AUDIT', JSON.stringify({ pin: 'synthetic-test-only', lastModified: 1 })]]);
const env = {
  GA_SYNC_KV: {
    get: async key => { counters.kvReads++; return kv.get(key) || null; },
    put: async (key, value) => { counters.kvWrites++; kv.set(key, value); },
    list: async () => { counters.kvLists++; return { keys: [...kv.keys()].map(name => ({ name })), list_complete: true }; }
  },
  GA_PROFILE_SYNC: { idFromName: id => id, get: () => ({ fetch: (request, init) => { counters.doRequests++; return coordinator.fetch(request instanceof Request ? request : new Request(request, init)); } }) }
};
const request = async (url, init = {}) => {
  counters.http++; counters.requestBodyBytes += Buffer.byteLength(init.body || '');
  const response = await worker.fetch(new Request(url, init), env, {});
  counters.responseBodyBytes += Buffer.byteLength(await response.clone().text());
  return response;
};
let revision = null;
const client = create({ request, baseUrl: 'https://audit/api/sync-v2/', pilotId: 'AUDIT', pin: 'synthetic-test-only', getRevision: () => revision, setRevision: value => { revision = value; } });
const profile = {
  activeMission: { missionId: 'poi-audit', missionTruth: { facts: Array.from({ length: 600 }, (_, i) => ({ id: i, text: 'Vollständiger Missionskontext mit Ziel, Route, Ausstattung und geprüften Fakten. '.repeat(6) })) } },
  activeMissionTrackerSeed: { missionId: 'poi-audit', voice: { briefing: 'Originale Sprachbasis. '.repeat(1500) } },
  pinboard: [{ id: 'note', text: 'Notiz' }], logbook: [{ completionId: 'flight', health: 90 }],
  groupName: 'Gruppe', groupNick: 'Pilot', knownNotes: ['known'], newBadges: ['new'],
  aircraftPresets: { preset: 1 }, onboardEquipment: { item: 'camera' }, followUpRequests: [{ id: 'followup' }], lastModified: 10
};
const results = [];
async function measure(name, fn) { reset(); const detail = await fn(); results.push({ name, ...counters, ...(detail?.uploadedChunks !== undefined ? { chunks: detail.uploadedChunks, reused: detail.reusedChunks, rawBytes: detail.rawBytes } : {}) }); }
await measure('first upload', () => client.write(profile));
const reader = create({ request, baseUrl: 'https://audit/api/sync-v2/', pilotId: 'AUDIT', pin: 'synthetic-test-only' });
await measure('first Tracker mission read', () => reader.read(['mission', 'field:lastModified']));
await measure('unchanged Tracker poll', () => reader.read(['mission', 'field:lastModified']));
await measure('mission update', () => client.write({ ...profile, activeMission: { ...profile.activeMission, progress: 'updated' }, lastModified: 20 }));
await measure('Tracker read after update', () => reader.read(['mission', 'field:lastModified']));
await measure('unchanged save attempt', () => client.write({ ...profile, activeMission: { ...profile.activeMission, progress: 'updated' }, lastModified: 30 }));
console.log(JSON.stringify({ note: 'Synthetic example. No TLS/headers/CORS preflight, retries, other endpoints or Cloudflare internal SQL/index billing included. Key calls are not exact billed SQL rows.', results }, null, 2));
