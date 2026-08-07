'use strict';

const http = require('node:http');
const {
  CAPABILITIES,
  createHello,
  createMessage,
  decodeMessage
} = require('./tracker-efb-protocol-core');

const DEFAULT_EFB_HTTP_HOST = '127.0.0.1';
const DEFAULT_EFB_HTTP_PORT = 49880;
const TRACKER_EFB_HTTP_CAPABILITIES = Object.freeze([
  CAPABILITIES.FLIGHT_SNAPSHOT,
  CAPABILITIES.MISSION_SNAPSHOT,
  CAPABILITIES.TRACKER_STATUS
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
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-store',
    'Content-Length': body.length,
    'Content-Type': 'application/json; charset=utf-8',
    'X-Content-Type-Options': 'nosniff'
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
  const getMissionSnapshot = typeof options.getMissionSnapshot === 'function' ? options.getMissionSnapshot : () => null;
  const log = typeof options.log === 'function' ? options.log : () => {};
  let server = null;

  const handler = (request, response) => {
    if (!isLoopbackAddress(request.socket?.remoteAddress)) {
      jsonResponse(response, 403, { error: 'loopback_only' });
      return;
    }
    if (request.method === 'OPTIONS') {
      response.writeHead(204, {
        'Access-Control-Allow-Headers': 'Accept, Content-Type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store'
      });
      response.end();
      return;
    }
    if (request.method !== 'GET') {
      jsonResponse(response, 405, { error: 'method_not_allowed' });
      return;
    }
    let pathname = '';
    try { pathname = new URL(request.url || '/', `http://${host}`).pathname; } catch (_) {}
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
      server = http.createServer(handler);
      server.on('clientError', (_error, socket) => {
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
  TRACKER_EFB_HTTP_CAPABILITIES,
  createTrackerEfbHttpHello,
  createTrackerEfbHttpServer,
  isLoopbackAddress
};
