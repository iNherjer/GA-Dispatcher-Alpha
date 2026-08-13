import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { gzipSync } from 'node:zlib';

const require = createRequire(import.meta.url);
const compression = require('../relay-compression-core.js');

assert.equal(compression.supports(), true);
assert.deepEqual(compression.advertisedCapabilities(), [compression.CAPABILITY]);

const plain = { type: 'gps', lat: 48.123, lon: 9.456, flight: { gsKts: 100 } };
assert.deepEqual(await compression.decode(JSON.stringify(plain)), plain);

const payload = gzipSync(Buffer.from(JSON.stringify(plain), 'utf8')).toString('base64');
const envelope = {
    type: compression.MESSAGE_TYPE,
    encoding: compression.CAPABILITY,
    originalType: plain.type,
    payload
};
assert.deepEqual(await compression.decode(JSON.stringify(envelope)), plain);

await assert.rejects(
    compression.decode(JSON.stringify({ ...envelope, encoding: 'unknown' })),
    /relay_gzip_encoding_unsupported/
);
await assert.rejects(
    compression.decode(JSON.stringify({ ...envelope, originalType: 'traffic' })),
    /relay_gzip_type_mismatch/
);

console.log('relay-compression-selftest: ok');
