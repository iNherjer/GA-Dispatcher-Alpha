'use strict';

const crypto = require('node:crypto');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');

const CONTROL_PROTOCOL_VERSION = 1;
const MAX_RESPONSE_BYTES = 128 * 1024;

function bridgeControlPath({ platform = process.platform, temporaryDirectory = os.tmpdir(), uid = typeof process.getuid === 'function' ? process.getuid() : 0 } = {}) {
  if (platform === 'win32') return '\\\\.\\pipe\\vfr-multitool-accusim-drsm-router-v1';
  return path.join(temporaryDirectory, `vfr-multitool-accusim-drsm-router-${uid}-v1.sock`);
}

function sendBridgeCommand(command, payload, {
  socketPath = bridgeControlPath(),
  timeoutMs = 900,
  netModule = net
} = {}) {
  const normalizedCommand = String(command || '').trim();
  if (!normalizedCommand) return Promise.reject(new Error('Bridge-Kommando fehlt.'));
  return new Promise((resolve, reject) => {
    const id = crypto.randomUUID();
    const socket = netModule.createConnection(socketPath);
    let settled = false;
    let buffer = '';
    const timer = setTimeout(() => finish(new Error('Bridge-Steuerung antwortet nicht.')), timeoutMs);

    function finish(error, result) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.destroy();
      if (error) reject(error);
      else resolve(result);
    }

    socket.setEncoding('utf8');
    socket.once('connect', () => {
      socket.write(`${JSON.stringify({ id, command: normalizedCommand, payload })}\n`);
    });
    socket.on('data', (chunk) => {
      buffer += String(chunk || '');
      if (Buffer.byteLength(buffer, 'utf8') > MAX_RESPONSE_BYTES) {
        finish(new Error('Bridge-Antwort ist zu groß.'));
        return;
      }
      const newline = buffer.indexOf('\n');
      if (newline < 0) return;
      try {
        const response = JSON.parse(buffer.slice(0, newline));
        if (response.id !== id) throw new Error('Bridge-Antwort gehört zu einer anderen Anfrage.');
        if (response.ok !== true) throw new Error(String(response.error || 'Bridge-Kommando fehlgeschlagen.'));
        finish(null, response.result);
      } catch (error) {
        finish(error);
      }
    });
    socket.once('error', (error) => finish(error));
    socket.once('end', () => {
      if (!settled) finish(new Error('Bridge hat die Verbindung ohne Antwort beendet.'));
    });
  });
}

module.exports = {
  CONTROL_PROTOCOL_VERSION,
  MAX_RESPONSE_BYTES,
  bridgeControlPath,
  sendBridgeCommand
};
