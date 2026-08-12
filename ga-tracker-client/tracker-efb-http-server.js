'use strict';

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

const DEFAULT_EFB_HTTP_HOST = '127.0.0.1';
const DEFAULT_EFB_HTTP_PORT = 49880;
const EFB_CLIENT_LOG_PATH = '/api/v1/client-log';
const MAX_EFB_CLIENT_LOG_BYTES = 8192;
const MAX_EFB_CLIENT_LOGS_PER_MINUTE = 120;
const TRACKER_EFB_HTTP_CAPABILITIES = Object.freeze([
  CAPABILITIES.FLIGHT_SNAPSHOT,
  CAPABILITIES.MAP_SNAPSHOT,
  CAPABILITIES.MISSION_SNAPSHOT,
  CAPABILITIES.MISSION_SNAPSHOT_V2,
  CAPABILITIES.TRACKER_STATUS,
  CAPABILITIES.EFB_WEB_CLIENT,
  CAPABILITIES.EFB_CLIENT_DIAGNOSTICS
].sort());

function safeObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function isLoopbackAddress(value) {
  const address = String(value || '').toLowerCase();
  return address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1';
}

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
    capabilities: TRACKER_EFB_HTTP_CAPABILITIES,
    id: options.id,
    timestamp: options.timestamp
  });
  hello.payload = {
    ...hello.payload,
    trackerVersionCode,
    runtimeChannel: String(options.runtimeChannel || '').trim().toLowerCase() === 'alpha' ? 'alpha' : 'stable',
    transport: 'http-loopback-readonly'
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
        message: createMessage('tracker.status', safeObject(getStatus()))
      });
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
  MAX_EFB_CLIENT_LOG_BYTES,
  TRACKER_EFB_HTTP_CAPABILITIES,
  createTrackerEfbHttpHello,
  createTrackerEfbHttpServer,
  isLoopbackAddress
};
