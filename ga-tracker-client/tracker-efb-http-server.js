'use strict';

const crypto = require('node:crypto');
const http = require('node:http');
const {
  CAPABILITIES,
  createHello,
  createMessage,
  decodeMessage
} = require('./tracker-efb-protocol-core');
const {
  EFB_WEB_CLIENT_PATH,
  EFB_WEB_CLIENT_PROBE_PATH,
  createTrackerEfbProbePage,
  createTrackerEfbWebClientPage,
  getTrackerEfbWebClientAsset
} = require('./tracker-efb-web-client');
const {
  createTrackerEfbTileProxy,
  parseTrackerEfbTilePath
} = require('./tracker-efb-tile-proxy');
const {
  createTrackerEfbMapContextProvider,
  parseTrackerEfbMapContextQuery
} = require('./tracker-efb-map-context');

const DEFAULT_EFB_HTTP_HOST = '127.0.0.1';
const DEFAULT_EFB_HTTP_PORT = 49880;
const EFB_CLIENT_LOG_PATH = '/api/v1/client-log';
const EFB_VOICE_JOB_PATH = '/api/v1/voice/jobs';
const EFB_VOICE_PLAYBACK_CLAIM_PATH = '/api/v1/voice/playback/claim';
const EFB_VOICE_PLAYBACK_RELEASE_PATH = '/api/v1/voice/playback/release';
const EFB_VOICE_PLAYBACK_NEXT_PATH = '/api/v1/voice/playback/next';
const EFB_COCKPIT_SESSION_PATH = '/api/v1/cockpit/sessions';
const EFB_COCKPIT_SESSION_HEARTBEAT_PATH = '/api/v1/cockpit/sessions/heartbeat';
const EFB_COCKPIT_SESSION_RELEASE_PATH = '/api/v1/cockpit/sessions/release';
const EFB_MISSION_INTENT_PATH = '/api/v1/mission/intents';
const TRACKER_MISSION_HARD_RESET_PATH = '/api/v1/tracker/mission/hard-reset';
const MAX_EFB_CLIENT_LOG_BYTES = 8192;
const MAX_EFB_VOICE_REQUEST_BYTES = 16384;
const MAX_EFB_COCKPIT_REQUEST_BYTES = 16384;
const MAX_TRACKER_CONTROL_REQUEST_BYTES = 1024;
const MAX_EFB_CLIENT_LOGS_PER_MINUTE = 120;
const TRACKER_EFB_HTTP_CAPABILITIES = Object.freeze([
  CAPABILITIES.FLIGHT_SNAPSHOT,
  CAPABILITIES.MAP_CONTEXT,
  CAPABILITIES.MAP_SNAPSHOT,
  CAPABILITIES.MISSION_SNAPSHOT,
  CAPABILITIES.MISSION_SNAPSHOT_V2,
  CAPABILITIES.MISSION_VIEW,
  CAPABILITIES.CHECKLIST_LIBRARY,
  CAPABILITIES.TRACKER_STATUS,
  CAPABILITIES.EFB_WEB_CLIENT,
  CAPABILITIES.EFB_CLIENT_DIAGNOSTICS,
  CAPABILITIES.COCKPIT_SESSION,
  CAPABILITIES.VOICE_PLAYBACK
].sort());

function safeObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function isLoopbackAddress(value) {
  const address = String(value || '').toLowerCase();
  return address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1';
}

function hasDesktopControlToken(request, expectedToken) {
  const expected = String(expectedToken || '').trim();
  const provided = String(request?.headers?.['x-ga-tracker-desktop-control'] || '').trim();
  if (!expected || !provided) return false;
  const expectedBuffer = Buffer.from(expected, 'utf8');
  const providedBuffer = Buffer.from(provided, 'utf8');
  return expectedBuffer.length === providedBuffer.length
    && crypto.timingSafeEqual(expectedBuffer, providedBuffer);
}

function isTrustedVoiceOrigin(request) {
  const origin = String(request?.headers?.origin || '').trim();
  if (!origin) return true;
  try {
    const parsed = new URL(origin);
    if (parsed.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(parsed.hostname.toLowerCase())) return true;
    return parsed.protocol === 'https:' && parsed.hostname.toLowerCase() === 'inherjer.github.io';
  } catch (_) {
    return false;
  }
}

const isTrustedCockpitOrigin = isTrustedVoiceOrigin;

function createTrackerEfbHttpHello(options = {}) {
  const trackerVersion = String(options.trackerVersion || '').trim();
  const trackerVersionCode = Number(options.trackerVersionCode);
  if (!/^v[1-9][0-9]*$/.test(trackerVersion)) throw new Error('Ungueltige Tracker-Version fuer den lokalen EFB-Handshake.');
  if (!Number.isSafeInteger(trackerVersionCode) || trackerVersion !== `v${trackerVersionCode}`) {
    throw new Error('Tracker-Version und Versionscode passen beim lokalen EFB-Handshake nicht zusammen.');
  }
  const hello = createHello({
    role: 'tracker',
    clientId: String(options.clientId || 'ga-tracker-local').trim(),
    appVersion: trackerVersion,
    capabilities: TRACKER_EFB_HTTP_CAPABILITIES.concat(Array.isArray(options.extraCapabilities) ? options.extraCapabilities : []),
    id: options.id,
    timestamp: options.timestamp
  });
  hello.payload = {
    ...hello.payload,
    trackerVersionCode,
    runtimeChannel: String(options.runtimeChannel || '').trim().toLowerCase() === 'alpha' ? 'alpha' : 'stable',
    transport: 'http-loopback'
  };
  return hello;
}

function jsonResponse(response, statusCode, value) {
  const body = Buffer.from(`${JSON.stringify(value)}\n`, 'utf8');
  response.writeHead(statusCode, {
    'Access-Control-Allow-Headers': 'Accept, Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-store',
    'Content-Length': body.length,
    'Content-Type': 'application/json; charset=utf-8',
    'X-Content-Type-Options': 'nosniff'
  });
  response.end(body);
}

function emptyResponse(response, statusCode = 204) {
  response.writeHead(statusCode, {
    'Access-Control-Allow-Headers': 'Accept, Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Private-Network': 'true',
    'Cache-Control': 'no-store',
    'Content-Length': 0,
    'X-Content-Type-Options': 'nosniff'
  });
  response.end();
}

function sanitizeLogField(value, limit = 240) {
  let text = '';
  if (typeof value === 'string') text = value;
  else if (value != null) {
    try { text = typeof value === 'object' ? JSON.stringify(value) : String(value); } catch (_) { text = String(value); }
  }
  return text.replace(/[\r\n\t]+/g, ' ').replace(/[\x00-\x1f\x7f]/g, '').slice(0, limit);
}

function readJsonBody(request, maxBytes = MAX_EFB_CLIENT_LOG_BYTES) {
  return new Promise((resolve, reject) => {
    const declaredLength = Number(request.headers['content-length']);
    if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
      request.resume();
      reject(Object.assign(new Error('payload_too_large'), { statusCode: 413 }));
      return;
    }
    const chunks = [];
    let length = 0;
    request.on('data', (chunk) => {
      length += chunk.length;
      if (length <= maxBytes) chunks.push(chunk);
    });
    request.on('end', () => {
      if (length > maxBytes) {
        reject(Object.assign(new Error('payload_too_large'), { statusCode: 413 }));
        return;
      }
      try {
        const value = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
        if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid_payload');
        resolve(value);
      } catch (error) {
        reject(Object.assign(error, { statusCode: 400 }));
      }
    });
    request.on('aborted', () => reject(Object.assign(new Error('request_aborted'), { statusCode: 400 })));
    request.on('error', (error) => reject(Object.assign(error, { statusCode: 400 })));
  });
}

function htmlResponse(response, statusCode, value) {
  const body = Buffer.from(String(value || ''), 'utf8');
  response.writeHead(statusCode, {
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-store',
    'Content-Length': body.length,
    'Content-Type': 'text/html; charset=utf-8',
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff'
  });
  response.end(body);
}

function assetResponse(response, statusCode, asset) {
  const body = Buffer.isBuffer(asset?.body) ? asset.body : Buffer.from(asset?.body || '');
  response.writeHead(statusCode, {
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-store',
    'Content-Length': body.length,
    'Content-Type': String(asset?.contentType || 'application/octet-stream'),
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff'
  });
  response.end(body);
}

function tileResponse(response, tile) {
  const body = Buffer.isBuffer(tile?.body) ? tile.body : Buffer.from(tile?.body || '');
  response.writeHead(200, {
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'public, max-age=86400',
    'Content-Length': body.length,
    'Content-Type': String(tile?.contentType || 'image/png'),
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
    'X-EFB-Tile-Cache': String(tile?.cache || 'miss')
  });
  response.end(body);
}

function audioResponse(response, audio) {
  const body = Buffer.isBuffer(audio?.body) ? audio.body : Buffer.from(audio?.body || '');
  response.writeHead(200, {
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-store',
    'Content-Length': body.length,
    'Content-Type': String(audio?.contentType || 'application/octet-stream'),
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
    'X-GA-Voice-Effect': String(audio?.effectId || '')
  });
  response.end(body);
}

function parseVoiceJobPath(pathname) {
  const match = String(pathname || '').match(/^\/api\/v1\/voice\/jobs\/([^/]+?)(\/(?:audio|cue))?$/);
  if (!match) return null;
  try {
    return {
      effectId: decodeURIComponent(match[1]),
      audio: match[2] === '/audio',
      cue: match[2] === '/cue'
    };
  } catch (_) {
    return null;
  }
}

function createTrackerEfbHttpServer(options = {}) {
  const host = String(options.host || DEFAULT_EFB_HTTP_HOST).trim();
  const port = Number(options.port ?? DEFAULT_EFB_HTTP_PORT);
  if (!['127.0.0.1', '::1'].includes(host)) throw new Error('Der EFB-HTTP-Server darf nur an Loopback gebunden werden.');
  if (!Number.isSafeInteger(port) || port < 0 || port > 65535) throw new Error('Ungueltiger lokaler EFB-HTTP-Port.');
  const hello = decodeMessage(options.hello);
  if (hello.type !== 'protocol.hello' || hello.payload?.role !== 'tracker') throw new Error('Der EFB-HTTP-Server benoetigt ein gueltiges Tracker-Hello.');
  const getStatus = typeof options.getStatus === 'function' ? options.getStatus : () => ({});
  const getSnapshot = typeof options.getSnapshot === 'function' ? options.getSnapshot : () => null;
  const getMapSnapshot = typeof options.getMapSnapshot === 'function' ? options.getMapSnapshot : () => null;
  const getMissionSnapshot = typeof options.getMissionSnapshot === 'function' ? options.getMissionSnapshot : () => null;
  const getChecklistSnapshot = typeof options.getChecklistSnapshot === 'function' ? options.getChecklistSnapshot : () => null;
  const voiceService = options.voiceService && typeof options.voiceService === 'object' ? options.voiceService : null;
  const cockpitControl = options.cockpitControl && typeof options.cockpitControl === 'object' ? options.cockpitControl : null;
  const desktopControlToken = String(options.desktopControlToken || '').trim();
  const hardResetMission = typeof options.hardResetMission === 'function' ? options.hardResetMission : null;
  const log = typeof options.log === 'function' ? options.log : () => {};
  let server = null;
  const loggedAssets = new Set();
  let clientLogWindowStartedAt = 0;
  let clientLogCount = 0;
  let clientLogRateLimitReported = false;
  const tileProxy = createTrackerEfbTileProxy({
    fetchRemote: options.fetchRemote,
    log
  });
  const mapContextProvider = options.mapContextProvider || createTrackerEfbMapContextProvider({
    fetchRemote: options.fetchRemote,
    getCurrentAltitudeFt: () => safeObject(getSnapshot()).alt,
    log
  });

  const handler = async (request, response) => {
    if (!isLoopbackAddress(request.socket?.remoteAddress)) {
      jsonResponse(response, 403, { error: 'loopback_only' });
      return;
    }
    if (request.method === 'OPTIONS') {
      emptyResponse(response);
      return;
    }
    let pathname = '';
    let requestUrl = null;
    try { requestUrl = new URL(request.url || '/', `http://${host}`); pathname = requestUrl.pathname; } catch (_) {}
    if (request.method === 'POST' && pathname === EFB_CLIENT_LOG_PATH) {
      const now = Date.now();
      if (!clientLogWindowStartedAt || now - clientLogWindowStartedAt >= 60000) {
        clientLogWindowStartedAt = now;
        clientLogCount = 0;
        clientLogRateLimitReported = false;
      }
      clientLogCount += 1;
      if (clientLogCount > MAX_EFB_CLIENT_LOGS_PER_MINUTE) {
        request.resume();
        if (!clientLogRateLimitReported) {
          log(`EFB_CLIENT_RATE_LIMIT limit=${MAX_EFB_CLIENT_LOGS_PER_MINUTE}`);
          clientLogRateLimitReported = true;
        }
        jsonResponse(response, 429, { error: 'rate_limited' });
        return;
      }
      try {
        const entry = await readJsonBody(request);
        const level = sanitizeLogField(entry.level || 'info', 12).toLowerCase();
        const event = sanitizeLogField(entry.event || 'client', 48);
        const stage = sanitizeLogField(entry.stage, 80);
        const sessionId = sanitizeLogField(entry.sessionId, 80);
        const channel = sanitizeLogField(entry.channel, 120);
        const message = sanitizeLogField(entry.message, 320).replace(/"/g, "'");
        const details = sanitizeLogField(entry.details, 800).replace(/"/g, "'");
        log(`EFB_CLIENT level=${level} event=${event} stage=${stage} session=${sessionId} channel=${channel} message="${message}" details="${details}"`);
        emptyResponse(response);
      } catch (error) {
        const statusCode = Number(error?.statusCode) === 413 ? 413 : 400;
        log(`EFB_CLIENT_REJECT status=${statusCode} error=${sanitizeLogField(error?.message || error, 120)}`);
        jsonResponse(response, statusCode, { error: statusCode === 413 ? 'payload_too_large' : 'invalid_payload' });
      }
      return;
    }
    if (request.method === 'POST' && pathname === TRACKER_MISSION_HARD_RESET_PATH) {
      if (!hardResetMission) {
        request.resume();
        jsonResponse(response, 503, { error: 'tracker_mission_reset_unavailable' });
        return;
      }
      if (!hasDesktopControlToken(request, desktopControlToken)) {
        request.resume();
        jsonResponse(response, 403, { error: 'tracker_desktop_control_rejected' });
        return;
      }
      try {
        const payload = await readJsonBody(request, MAX_TRACKER_CONTROL_REQUEST_BYTES);
        const result = await hardResetMission(payload);
        const statusCode = result?.status === 'conflict' ? 409
          : (result?.status === 'blocked' ? 423 : (result?.ok === false ? 400 : 200));
        jsonResponse(response, statusCode, {
          hello,
          message: createMessage('tracker.mission.hard-reset', result)
        });
      } catch (error) {
        const statusCode = Math.max(400, Math.min(599, Number(error?.statusCode) || 400));
        log(`TRACKER_MISSION_HARD_RESET_REJECT status=${statusCode} code=${sanitizeLogField(error?.code || 'invalid_request', 80)}`);
        jsonResponse(response, statusCode, { error: error?.code || 'invalid_request' });
      }
      return;
    }
    if (request.method === 'POST' && [
      EFB_COCKPIT_SESSION_PATH,
      EFB_COCKPIT_SESSION_HEARTBEAT_PATH,
      EFB_COCKPIT_SESSION_RELEASE_PATH,
      EFB_MISSION_INTENT_PATH
    ].includes(pathname)) {
      if (!cockpitControl || !isTrustedCockpitOrigin(request)) {
        request.resume();
        jsonResponse(response, cockpitControl ? 403 : 503, { error: cockpitControl ? 'cockpit_origin_rejected' : 'cockpit_sessions_unavailable' });
        return;
      }
      try {
        const payload = await readJsonBody(request, MAX_EFB_COCKPIT_REQUEST_BYTES);
        let result;
        let messageType = 'cockpit.session';
        if (pathname === EFB_COCKPIT_SESSION_PATH) result = cockpitControl.register(payload);
        else if (pathname === EFB_COCKPIT_SESSION_HEARTBEAT_PATH) result = cockpitControl.heartbeat(payload);
        else if (pathname === EFB_COCKPIT_SESSION_RELEASE_PATH) result = cockpitControl.release(payload);
        else {
          messageType = 'mission.intent.ack';
          result = await cockpitControl.submitIntent(payload);
        }
        let statusCode = 200;
        if (result?.status === 'conflict') statusCode = 409;
        else if (result?.status === 'blocked') statusCode = 423;
        else if (result?.status === 'rate_limited') statusCode = 429;
        else if (result?.ok === false) statusCode = ['cockpit_session_required', 'cockpit_session_invalid'].includes(result?.error) ? 401 : 400;
        jsonResponse(response, statusCode, { hello, message: createMessage(messageType, result) });
      } catch (error) {
        const statusCode = Math.max(400, Math.min(599, Number(error?.statusCode) || 400));
        log(`EFB_COCKPIT_REJECT path=${sanitizeLogField(pathname, 120)} status=${statusCode} code=${sanitizeLogField(error?.code || 'invalid_request', 80)}`);
        jsonResponse(response, statusCode, { error: error?.code || 'invalid_request' });
      }
      return;
    }
    if (request.method === 'POST' && [
      EFB_VOICE_JOB_PATH,
      EFB_VOICE_PLAYBACK_CLAIM_PATH,
      EFB_VOICE_PLAYBACK_RELEASE_PATH
    ].includes(pathname)) {
      if (!voiceService || !isTrustedVoiceOrigin(request)) {
        request.resume();
        jsonResponse(response, voiceService ? 403 : 503, { error: voiceService ? 'voice_origin_rejected' : 'voice_unavailable' });
        return;
      }
      try {
        const payload = await readJsonBody(request, MAX_EFB_VOICE_REQUEST_BYTES);
        let result;
        if (pathname === EFB_VOICE_JOB_PATH) result = voiceService.request(payload);
        else if (pathname === EFB_VOICE_PLAYBACK_CLAIM_PATH) result = voiceService.claimPlayback(payload);
        else result = voiceService.releasePlayback(payload);
        jsonResponse(response, pathname === EFB_VOICE_JOB_PATH && result?.status === 'pending' ? 202 : 200, {
          hello,
          message: createMessage(pathname === EFB_VOICE_JOB_PATH ? 'voice.job' : 'voice.playback', result)
        });
      } catch (error) {
        const statusCode = Math.max(400, Math.min(599, Number(error?.statusCode) || 400));
        log(`EFB_VOICE_REJECT path=${sanitizeLogField(pathname, 120)} status=${statusCode} code=${sanitizeLogField(error?.code || 'invalid_request', 80)}`);
        jsonResponse(response, statusCode, { error: error?.code || 'invalid_request' });
      }
      return;
    }
    if (request.method !== 'GET') {
      log(`EFB_HTTP_REJECT method=${sanitizeLogField(request.method, 12)} path=${sanitizeLogField(pathname, 160)}`);
      jsonResponse(response, 405, { error: 'method_not_allowed' });
      return;
    }
    if (pathname === '/api/v1/hello') {
      jsonResponse(response, 200, hello);
      return;
    }
    if (pathname === '/api/v1/status') {
      jsonResponse(response, 200, {
        hello,
        message: createMessage('tracker.status', {
          ...safeObject(getStatus()),
          cockpit: cockpitControl?.publicState?.() || { activeCount: 0, missionIntentsEnabled: false },
          voice: voiceService?.publicState?.() || { configured: false }
        })
      });
      return;
    }
    if (pathname === EFB_VOICE_PLAYBACK_NEXT_PATH) {
      if (!voiceService) {
        jsonResponse(response, 503, { error: 'voice_unavailable' });
        return;
      }
      const job = voiceService.getNextPlayback?.() || null;
      jsonResponse(response, 200, {
        hello,
        message: createMessage('voice.playback.next', {
          available: Boolean(job),
          job
        })
      });
      return;
    }
    if (pathname === EFB_COCKPIT_SESSION_PATH) {
      jsonResponse(response, 200, {
        hello,
        message: createMessage('cockpit.sessions', cockpitControl?.publicState?.() || {
          activeCount: 0,
          missionIntentsEnabled: false,
          sessions: []
        })
      });
      return;
    }
    const voiceJobRequest = parseVoiceJobPath(pathname);
    if (voiceJobRequest) {
      if (!voiceService) {
        jsonResponse(response, 503, { error: 'voice_unavailable' });
        return;
      }
      try {
        if (voiceJobRequest.audio || voiceJobRequest.cue) {
          const audio = voiceJobRequest.cue
            ? voiceService.getCueAudio?.(voiceJobRequest.effectId)
            : voiceService.getAudio(voiceJobRequest.effectId);
          if (!audio) jsonResponse(response, 404, { error: 'voice_audio_not_ready' });
          else audioResponse(response, audio);
        } else {
          const job = voiceService.get(voiceJobRequest.effectId);
          if (!job) jsonResponse(response, 404, { error: 'voice_job_not_found' });
          else jsonResponse(response, 200, { hello, message: createMessage('voice.job', job) });
        }
      } catch (error) {
        jsonResponse(response, Number(error?.statusCode) || 400, { error: error?.code || 'invalid_voice_job' });
      }
      return;
    }
    if (pathname === '/api/v1/snapshot') {
      const snapshot = getSnapshot();
      jsonResponse(response, 200, {
        hello,
        message: createMessage('flight.snapshot', snapshot && typeof snapshot === 'object'
          ? { ...snapshot, available: true }
          : { available: false })
      });
      return;
    }
    if (pathname === '/api/v1/mission') {
      const snapshot = getMissionSnapshot();
      jsonResponse(response, 200, {
        hello,
        message: createMessage('mission.snapshot', snapshot && typeof snapshot === 'object'
          ? { ...snapshot, available: snapshot.available !== false }
          : { available: false })
      });
      return;
    }
    if (pathname === '/api/v1/checklists') {
      const snapshot = getChecklistSnapshot();
      jsonResponse(response, 200, {
        hello,
        message: createMessage('checklist.library', snapshot && typeof snapshot === 'object'
          ? { ...snapshot, available: true }
          : { available: false })
      });
      return;
    }
    if (pathname === '/api/v1/map') {
      const snapshot = await getMapSnapshot();
      jsonResponse(response, 200, {
        hello,
        message: createMessage('map.snapshot', snapshot && typeof snapshot === 'object'
          ? { ...snapshot, available: true }
          : { available: false })
      });
      return;
    }
    if (pathname === '/api/v1/map-context') {
      const contextRequest = parseTrackerEfbMapContextQuery(requestUrl?.searchParams);
      if (!contextRequest) {
        jsonResponse(response, 400, { error: 'invalid_map_context_coordinates' });
        return;
      }
      const context = await mapContextProvider.get(contextRequest);
      jsonResponse(response, 200, {
        hello,
        message: createMessage('map.context', context && typeof context === 'object'
          ? { ...context, available: true }
          : { available: false })
      });
      return;
    }
    const tileRequest = parseTrackerEfbTilePath(pathname);
    if (tileRequest) {
      try {
        tileResponse(response, await tileProxy.get(tileRequest));
      } catch (error) {
        jsonResponse(response, 502, { error: 'tile_upstream_unavailable' });
      }
      return;
    }
    if (pathname === EFB_WEB_CLIENT_PATH) {
      log(`EFB_HTTP_PAGE path=${pathname} channel=${sanitizeLogField(requestUrl?.searchParams?.get('channel'), 120)}`);
      htmlResponse(response, 200, createTrackerEfbWebClientPage());
      return;
    }
    if (pathname === EFB_WEB_CLIENT_PROBE_PATH) {
      htmlResponse(response, 200, createTrackerEfbProbePage());
      return;
    }
    const asset = getTrackerEfbWebClientAsset(pathname);
    if (asset) {
      if (!loggedAssets.has(pathname)) {
        loggedAssets.add(pathname);
        log(`EFB_HTTP_ASSET path=${sanitizeLogField(pathname, 180)} bytes=${Buffer.isBuffer(asset.body) ? asset.body.length : Buffer.byteLength(String(asset.body || ''))}`);
      }
      assetResponse(response, 200, asset);
      return;
    }
    log(`EFB_HTTP_NOT_FOUND path=${sanitizeLogField(pathname, 180)}`);
    jsonResponse(response, 404, { error: 'not_found' });
  };

  return {
    get address() {
      const address = server?.address?.();
      return address && typeof address === 'object' ? { host: address.address, port: address.port } : null;
    },
    get hello() { return hello; },
    async start() {
      if (server) return this.address;
      server = http.createServer((request, response) => {
        handler(request, response).catch((error) => {
          log(`EFB_HTTP_ERROR method=${sanitizeLogField(request.method, 12)} path=${sanitizeLogField(request.url, 180)} error=${sanitizeLogField(error?.message || error, 240)}`);
          if (!response.headersSent) jsonResponse(response, 500, { error: 'internal_error' });
          else response.end();
        });
      });
      server.on('clientError', (error, socket) => {
        log(`EFB_HTTP_CLIENT_ERROR ${sanitizeLogField(error?.message || error, 240)}`);
        try { socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n'); } catch (_) {}
      });
      await new Promise((resolve, reject) => {
        const onError = (error) => {
          server?.off('listening', onListening);
          server = null;
          reject(error);
        };
        const onListening = () => {
          server?.off('error', onError);
          resolve();
        };
        server.once('error', onError);
        server.once('listening', onListening);
        server.listen(port, host);
      });
      log(`EFB_HTTP_LISTEN host=${this.address?.host || host} port=${this.address?.port || port}`);
      return this.address;
    },
    async stop() {
      const current = server;
      server = null;
      if (!current) return;
      await new Promise((resolve) => current.close(() => resolve()));
    }
  };
}

module.exports = {
  DEFAULT_EFB_HTTP_HOST,
  DEFAULT_EFB_HTTP_PORT,
  EFB_CLIENT_LOG_PATH,
  EFB_COCKPIT_SESSION_PATH,
  EFB_COCKPIT_SESSION_HEARTBEAT_PATH,
  EFB_COCKPIT_SESSION_RELEASE_PATH,
  EFB_MISSION_INTENT_PATH,
  TRACKER_MISSION_HARD_RESET_PATH,
  EFB_VOICE_JOB_PATH,
  EFB_VOICE_PLAYBACK_CLAIM_PATH,
  EFB_VOICE_PLAYBACK_NEXT_PATH,
  EFB_VOICE_PLAYBACK_RELEASE_PATH,
  MAX_EFB_CLIENT_LOG_BYTES,
  MAX_EFB_COCKPIT_REQUEST_BYTES,
  MAX_TRACKER_CONTROL_REQUEST_BYTES,
  MAX_EFB_VOICE_REQUEST_BYTES,
  TRACKER_EFB_HTTP_CAPABILITIES,
  createTrackerEfbHttpHello,
  createTrackerEfbHttpServer,
  hasDesktopControlToken,
  isLoopbackAddress,
  isTrustedCockpitOrigin,
  isTrustedVoiceOrigin,
  parseVoiceJobPath
};
