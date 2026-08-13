import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const failover = require('../relay-failover-core.js');

assert.equal(failover.normalizeRelayKey('CLOUDFLARE'), 'cloudflare');
assert.equal(failover.normalizeRelayKey('invalid'), 'cloudflare');
assert.equal(failover.alternateRelayKey('cloudflare'), 'render');
assert.equal(failover.alternateRelayKey('render'), 'cloudflare');
assert.equal(failover.indicatorCode('cloudflare'), 'C');
assert.equal(failover.indicatorCode('render'), 'R');
assert.equal(failover.indicatorConnectionLabel('v346', 'cloudflare'), 'v346 C');
assert.equal(failover.indicatorConnectionLabel('v346', 'render'), 'v346 R');
assert.equal(failover.relayAfterDisconnect('cloudflare', false), 'render');
assert.equal(failover.relayAfterDisconnect('cloudflare', true), 'cloudflare');
assert.equal(failover.relayAfterDisconnect('render', false), 'render');

const lower = await failover.roomKeyForSyncId('pilot-42');
const upper = await failover.roomKeyForSyncId(' PILOT-42 ');
assert.equal(lower, upper);
assert.match(lower, /^[a-f0-9]{64}$/);

const cloudflareUrl = new URL(await failover.websocketUrl('cloudflare', 'pilot-42'));
assert.equal(cloudflareUrl.hostname, 'ga-relay.einherjer.workers.dev');
assert.equal(cloudflareUrl.searchParams.get('room'), lower);
assert.equal(await failover.websocketUrl('render', 'pilot-42'), 'wss://websocketrelais.onrender.com/');

console.log('relay failover self-test passed');
