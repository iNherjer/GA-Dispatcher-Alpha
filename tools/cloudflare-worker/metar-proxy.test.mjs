import assert from 'node:assert/strict';
import { test } from 'node:test';
import worker from './worker-merged-full.js';

test('METAR proxy supports older clients, empty stations and upstream recovery', async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  let status = 200;
  globalThis.fetch = async url => {
    const parsed = new URL(url);
    calls.push(parsed);
    assert.equal(parsed.hostname, 'aviationweather.gov');
    assert.equal(parsed.searchParams.has('t'), false);
    assert.equal(parsed.searchParams.get('format'), 'json');
    return new Response(status === 204 ? null : status === 200
      ? '[{"icaoId":"EDDS","wspd":5}]' : '{"error":"temporary"}', { status });
  };
  const request = query => worker.fetch(new Request('https://ga-proxy.test/api/metar?' + query), {}, {});
  try {
    for (const selection of ['ids=EDDS', 'bbox=47.4,7.6,49.4,9.6']) {
      const response = await request('src=' + encodeURIComponent(
        'https://aviationweather.gov/api/data/metar?' + selection + '&format=raw&hours=2&t=1789388301402'));
      assert.equal(response.status, 200);
      assert.equal((await response.json())[0].icaoId, 'EDDS');
      assert.equal(calls.at(-1).searchParams.get('hours'), '2');
      assert.equal(response.headers.get('access-control-allow-origin'), '*');
    }
    assert.equal((await request('ids=EDDS')).status, 200);
    assert.equal(calls.at(-1).searchParams.get('ids'), 'EDDS');
    status = 204;
    const empty = await request('ids=EDTW');
    assert.equal(empty.status, 204);
    assert.equal(await empty.text(), '');
    status = 503;
    const failed = await request('ids=EDDS');
    assert.equal(failed.status, 503);
    assert.equal(failed.headers.get('cache-control'), 'no-store');
    assert.equal((await failed.json()).error, 'temporary');
    status = 200;
    assert.equal((await request('ids=EDDS')).status, 200);
    const before = calls.length;
    for (const src of ['https://example.org/api/data/metar?ids=EDDS', 'http://aviationweather.gov/api/data/metar?ids=EDDS']) {
      assert.equal((await request('src=' + encodeURIComponent(src))).status, 400);
    }
    assert.equal(calls.length, before);
    globalThis.fetch = async () => { throw new Error('offline'); };
    assert.equal((await request('ids=EDDS')).status, 502);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
