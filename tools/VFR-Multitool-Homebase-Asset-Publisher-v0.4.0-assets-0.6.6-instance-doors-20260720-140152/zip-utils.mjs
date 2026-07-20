import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let value = n;
    for (let bit = 0; bit < 8; bit += 1) value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
    table[n] = value >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function zipPath(value) {
  const normalized = String(value || '').replaceAll('\\', '/').replace(/^\/+/, '');
  if (!normalized || normalized.split('/').some((part) => !part || part === '.' || part === '..')) {
    throw new Error(`Unsicherer ZIP-Pfad: ${value}`);
  }
  return normalized;
}

function dosDateTime(date = new Date('2020-01-01T00:00:00Z')) {
  const year = Math.max(1980, date.getUTCFullYear());
  const time = (date.getUTCHours() << 11) | (date.getUTCMinutes() << 5) | Math.floor(date.getUTCSeconds() / 2);
  const day = (year - 1980) << 9 | (date.getUTCMonth() + 1) << 5 | date.getUTCDate();
  return { time, date: day };
}

function localHeader(entry, name, compressed, checksum, offset) {
  const { time, date } = dosDateTime();
  const header = Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(0x0800, 6);
  header.writeUInt16LE(8, 8);
  header.writeUInt16LE(time, 10);
  header.writeUInt16LE(date, 12);
  header.writeUInt32LE(checksum, 14);
  header.writeUInt32LE(compressed.length, 18);
  header.writeUInt32LE(entry.data.length, 22);
  header.writeUInt16LE(name.length, 26);
  header.writeUInt16LE(0, 28);
  return { header, offset, time, date };
}

function centralHeader(entry, name, compressed, checksum, local) {
  const header = Buffer.alloc(46);
  header.writeUInt32LE(0x02014b50, 0);
  header.writeUInt16LE(0x0314, 4);
  header.writeUInt16LE(20, 6);
  header.writeUInt16LE(0x0800, 8);
  header.writeUInt16LE(8, 10);
  header.writeUInt16LE(local.time, 12);
  header.writeUInt16LE(local.date, 14);
  header.writeUInt32LE(checksum, 16);
  header.writeUInt32LE(compressed.length, 20);
  header.writeUInt32LE(entry.data.length, 24);
  header.writeUInt16LE(name.length, 28);
  header.writeUInt16LE(0, 30);
  header.writeUInt16LE(0, 32);
  header.writeUInt16LE(0, 34);
  header.writeUInt16LE(0, 36);
  header.writeUInt32LE(0, 38);
  header.writeUInt32LE(local.offset, 42);
  return header;
}

export function createZip(entries, outputPath) {
  const normalized = entries.map((entry) => ({
    name: zipPath(entry.name),
    data: Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(entry.data)
  })).sort((a, b) => a.name.localeCompare(b.name));
  if (!normalized.length) throw new Error('Ein ZIP ohne Dateien wird nicht erzeugt.');

  const fileParts = [];
  const centralParts = [];
  let offset = 0;
  for (const entry of normalized) {
    const name = Buffer.from(entry.name, 'utf8');
    const compressed = zlib.deflateRawSync(entry.data, { level: 9 });
    const checksum = crc32(entry.data);
    const local = localHeader(entry, name, compressed, checksum, offset);
    fileParts.push(local.header, name, compressed);
    centralParts.push(centralHeader(entry, name, compressed, checksum, local), name);
    offset += local.header.length + name.length + compressed.length;
  }
  const central = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(normalized.length, 8);
  end.writeUInt16LE(normalized.length, 10);
  end.writeUInt32LE(central.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, Buffer.concat([...fileParts, central, end]));
  return { path: outputPath, entries: normalized.length, size: fs.statSync(outputPath).size };
}

export function entriesFromDirectory(root, prefix = '') {
  const entries = [];
  const walk = (directory) => {
    for (const item of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const absolute = path.join(directory, item.name);
      if (item.isDirectory()) walk(absolute);
      else if (item.isFile()) {
        const relative = path.relative(root, absolute).split(path.sep).join('/');
        entries.push({ name: prefix ? `${zipPath(prefix)}/${relative}` : relative, data: fs.readFileSync(absolute) });
      }
    }
  };
  walk(root);
  return entries;
}
