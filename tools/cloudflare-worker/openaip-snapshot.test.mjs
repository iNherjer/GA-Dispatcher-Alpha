import assert from 'node:assert/strict';
import worker from './worker-merged-full.js';
const TEST_ENV = { OPENAIP_API_KEY: 'test-openaip-key' };

// OpenAIP API v1.1 no longer offers bbox queries (17.11.2026). The region
// snapshot and bbox catch-all requests answer 410 without touching OpenAIP;
// country/search/page requests (monthly GA Aviation DB build, frequency
// search) still go out with the key.
const savedFetch = globalThis.fetch;
const upstreamCalls = [];
globalThis.fetch = async (url) => {
  upstreamCalls.push(String(url));
  return new Response('{"items":[]}', { status: 200, headers: { 'Content-Type': 'application/json' } });
};

try {
  for (const path of [
    '/api/openaip/snapshot?bbox=7.000,47.000,10.000,50.000',
    '/api/openaip/snapshot?bbox=0,0,6,2',
    '/api/airports?bbox=7,47,10,50&limit=250',
    '/api/airspaces?bbox=7,47,8,48&limit=250&page=1',
    '/v1/navaids?bbox=7,47,8,48'
  ]) {
    const res = await worker.fetch(new Request('https://ga-proxy.test' + path), TEST_ENV, {});
    assert.equal(res.status, 410, path);
    assert.equal((await res.json()).error, 'openaip_bbox_retired', path);
    assert.ok(res.headers.get('Access-Control-Allow-Origin'), path + ' keeps CORS');
  }
  assert.equal(upstreamCalls.length, 0, 'bbox requests never reach OpenAIP');

  // Catch-all allow-list: only the OpenAIP lists the apps read go out with the key.
  for (const path of ['/api/users', '/', '/api/airports/../users', '/v1/anything']) {
    const res = await worker.fetch(new Request('https://ga-proxy.test' + path), TEST_ENV, {});
    assert.equal(res.status, 404, path);
  }
  const post = await worker.fetch(new Request('https://ga-proxy.test/api/airports', { method: 'POST', body: '{}' }), TEST_ENV, {});
  assert.equal(post.status, 404);
  assert.equal(upstreamCalls.length, 0, 'nothing left the worker with the key');

  const build = await worker.fetch(new Request(
    'https://ga-proxy.test/api/airspaces?limit=1000&page=2&fields=_id,name&country=DE'
  ), TEST_ENV, {});
  assert.equal(build.status, 200);
  const buildUrl = new URL(upstreamCalls[0]);
  assert.equal(buildUrl.hostname, 'api.core.openaip.net');
  assert.equal(buildUrl.pathname, '/api/airspaces');
  assert.equal(buildUrl.searchParams.get('country'), 'DE');
  assert.equal(buildUrl.searchParams.get('apiKey'), 'test-openaip-key');

  const search = await worker.fetch(new Request('https://ga-proxy.test/v1/airports?search=EDDF&limit=25'), TEST_ENV, {});
  assert.equal(search.status, 200);
  assert.match(upstreamCalls[1], /api\.core\.openaip\.net\/api\/airports\?search=EDDF/);

  const unconfigured = await worker.fetch(new Request('https://ga-proxy.test/api/airspaces?country=DE'), {}, {});
  assert.equal(unconfigured.status, 503);
} finally {
  globalThis.fetch = savedFetch;
}
console.log('All OpenAIP proxy tests passed.');
