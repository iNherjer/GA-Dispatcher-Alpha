'use strict';

const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_MAX_BYTES = 8 * 1024 * 1024;
const DEFAULT_RETAINED_TAIL_BYTES = 512 * 1024;
const DEFAULT_MAX_LINE_BYTES = 32 * 1024;
const DEFAULT_DEDUPE_WINDOW_MS = 1500;

function positiveInteger(value, fallback) {
  const number = Math.floor(Number(value));
  return Number.isSafeInteger(number) && number > 0 ? number : fallback;
}

function existingSize(filename) {
  try { return fs.statSync(filename).size; } catch (_) { return 0; }
}

function readTail(filename, maxBytes) {
  const size = existingSize(filename);
  if (!size || !maxBytes) return Buffer.alloc(0);
  const length = Math.min(size, maxBytes);
  const buffer = Buffer.alloc(length);
  let handle = null;
  try {
    handle = fs.openSync(filename, 'r');
    fs.readSync(handle, buffer, 0, length, size - length);
  } finally {
    if (handle !== null) fs.closeSync(handle);
  }
  if (length === size) return buffer;
  const newline = buffer.indexOf(0x0a);
  return newline >= 0 && newline + 1 < buffer.length ? buffer.subarray(newline + 1) : buffer;
}

function rotateLog(filename, maxBytes, retainedTailBytes) {
  const previousBytes = existingSize(filename);
  if (!previousBytes) return null;
  const firstArchive = `${filename}.1`;
  const secondArchive = `${filename}.2`;
  if (existingSize(firstArchive)) fs.writeFileSync(secondArchive, readTail(firstArchive, retainedTailBytes));
  const tail = readTail(filename, retainedTailBytes);
  fs.writeFileSync(firstArchive, tail);
  fs.truncateSync(filename, 0);
  return { previousBytes, retainedBytes: tail.length, maxBytes };
}

function truncateUtf8Line(value, maxBytes) {
  const text = String(value == null ? '' : value).replace(/[\r\n]+/g, ' ');
  const buffer = Buffer.from(text, 'utf8');
  if (buffer.length <= maxBytes) return text;
  return `${buffer.subarray(0, Math.max(0, maxBytes - 18)).toString('utf8')} [truncated]`;
}

function createRotatingDebugLog(options = {}) {
  const filename = path.resolve(String(options.filename || '').trim());
  if (!String(options.filename || '').trim()) throw new Error('Debug-Log benoetigt einen Dateinamen.');
  const maxBytes = positiveInteger(options.maxBytes, DEFAULT_MAX_BYTES);
  const retainedTailBytes = Math.min(
    maxBytes,
    positiveInteger(options.retainedTailBytes, DEFAULT_RETAINED_TAIL_BYTES)
  );
  const maxLineBytes = Math.min(maxBytes, positiveInteger(options.maxLineBytes, DEFAULT_MAX_LINE_BYTES));
  const dedupeWindowMs = positiveInteger(options.dedupeWindowMs, DEFAULT_DEDUPE_WINDOW_MS);
  const now = typeof options.now === 'function' ? options.now : () => Date.now();
  let previousLine = '';
  let previousLineAt = 0;

  return function debugLog(line) {
    try {
      const cleanLine = truncateUtf8Line(line, maxLineBytes);
      const currentAt = Math.max(0, Number(now()) || 0);
      if (cleanLine === previousLine && currentAt - previousLineAt >= 0 && currentAt - previousLineAt <= dedupeWindowMs) {
        return false;
      }
      previousLine = cleanLine;
      previousLineAt = currentAt;
      fs.mkdirSync(path.dirname(filename), { recursive: true });
      const timestamp = new Date(currentAt || Date.now()).toISOString();
      const entry = `[${timestamp}] ${cleanLine}\n`;
      const entryBytes = Buffer.byteLength(entry);
      const currentBytes = existingSize(filename);
      if (currentBytes + entryBytes > maxBytes) {
        const rotated = rotateLog(filename, maxBytes, retainedTailBytes);
        if (rotated) {
          fs.appendFileSync(
            filename,
            `[${timestamp}] LOG_ROTATED previousBytes=${rotated.previousBytes} retainedBytes=${rotated.retainedBytes} maxBytes=${maxBytes} pid=${process.pid}\n`,
            'utf8'
          );
        }
      }
      fs.appendFileSync(filename, entry, 'utf8');
      return true;
    } catch (_) {
      return false;
    }
  };
}

module.exports = {
  DEFAULT_DEDUPE_WINDOW_MS,
  DEFAULT_MAX_BYTES,
  DEFAULT_MAX_LINE_BYTES,
  DEFAULT_RETAINED_TAIL_BYTES,
  createRotatingDebugLog,
  readTail,
  rotateLog,
  truncateUtf8Line
};
