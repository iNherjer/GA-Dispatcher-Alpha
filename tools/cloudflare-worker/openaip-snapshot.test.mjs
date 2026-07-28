import assert from 'node:assert/strict';
import worker from './worker-merged-full.js';

const originalFetch = globalThis.fetch;
const originalCaches = globalThis.caches;
const cacheStore = new Map();
let upstreamCalls = 0;

function makeCollectionItem(pathname) {
  if (pathname === '/api/airports') {
    return {
      _id: 'apt-1',
      name: 'Test Airport',
      icaoCode: 'EDTT',
      geometry: { type: 'Point', coordinates: [8.5, 48.5] },
      frequencies: [{ name: 'TWR', value: '123.450' }],
      runways: [{
        designator: '09',
        trueHeading: 90,
        surface: { mainComposite: 2 },
        dimension: { length: { value: 650, unit: 0 } }
      }]
    };
  }
  if (pathname === '/api/airspaces') {
    return {
      _id: 'asp-1',
      name: 'Test CTR',
      type: 3,
      frequencies: [{ name: 'TWR', value: '123.450' }],
      geometry: {
        type: 'Polygon',
        coordinates: [[[8.4, 48.4], [8.6, 48.4], [8.6, 48.6], [8.4, 48.4]]]
      }
    };
  }
  if (pathname === '/api/navaids') {
    return {
      _id: 'nav-1',
      name: 'Test VOR',
      identifier: 'TST',
      type: 4,
      country: 'DE',
      frequency: { value: '113.500', unit: 2 },
      channel: '82X',
      range: { value: '60', unit: 2 },
      geometry: { type: 'Point', coordinates: [8.45, 48.45] }
    };
  }
  return {
    _id: 'rpp-1',
    name: 'NOVEMBER',
    geometry: { type: 'Point', coordinates: [8.55, 48.55] }
  };
}

globalThis.caches = {
  default: {
    async match(request) {
      const stored = cacheStore.get(request.url);
      return stored ? stored.clone() : undefined;
    },
    async put(request, response) {
      cacheStore.set(request.url, response.clone());
    }
  }
};

globalThis.fetch = async (url) => {
  upstreamCalls += 1;
  const parsed = new URL(url);
  assert.equal(parsed.hostname, 'api.core.openaip.net');
  assert.ok(parsed.searchParams.get('apiKey'));
  assert.ok(parsed.searchParams.get('fields'));
  if (parsed.pathname === '/api/airports') {
    assert.match(parsed.searchParams.get('fields'), /(?:^|,)runways(?:,|$)/);
  }
  if (parsed.pathname === '/api/airspaces') {
    assert.match(parsed.searchParams.get('fields'), /(?:^|,)frequencies(?:,|$)/);
  }
  if (parsed.pathname === '/api/navaids') {
    assert.match(parsed.searchParams.get('fields'), /(?:^|,)type(?:,|$)/);
    assert.match(parsed.searchParams.get('fields'), /(?:^|,)frequency(?:,|$)/);
    assert.match(parsed.searchParams.get('fields'), /(?:^|,)channel(?:,|$)/);
    assert.match(parsed.searchParams.get('fields'), /(?:^|,)range(?:,|$)/);
  }
  assert.equal(parsed.searchParams.get('limit'), '250');
  return new Response(JSON.stringify({
    limit: 250,
    page: 1,
    items: [makeCollectionItem(parsed.pathname)]
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};

try {
  const snapshotUrl = 'https://ga-proxy.test/api/openaip/snapshot?bbox=7.000,47.000,10.000,50.000';
  const first = await worker.fetch(new Request(snapshotUrl), {}, {});
  assert.equal(first.status, 200);
  assert.equal(first.headers.get('X-GA-OpenAIP-Cache'), 'MISS');
  const firstPayload = await first.json();
  assert.equal(firstPayload.schemaVersion, 2);
  assert.equal(firstPayload.airports.length, 1);
  assert.equal(firstPayload.airspaces.length, 1);
  assert.equal(firstPayload.airspaces[0].frequencies[0].value, '123.450');
  assert.equal(firstPayload.navaids.length, 1);
  assert.equal(firstPayload.navaids[0].type, 4);
  assert.equal(firstPayload.navaids[0].frequency.value, '113.500');
  assert.equal(firstPayload.navaids[0].channel, '82X');
  assert.equal(firstPayload.reportingPoints.length, 1);
  assert.equal(firstPayload.airports[0].runways[0].designator, '09');
  assert.equal(upstreamCalls, 4);

  const second = await worker.fetch(new Request(
    'https://ga-proxy.test/api/openaip/snapshot?bbox=7,47,10,50'
  ), {}, {});
  assert.equal(second.status, 200);
  assert.equal(second.headers.get('X-GA-OpenAIP-Cache'), 'HIT');
  assert.equal(upstreamCalls, 4);

  const coalescedUrl = 'https://ga-proxy.test/api/openaip/snapshot?bbox=10,45,12,47';
  const callsBeforeCoalescing = upstreamCalls;
  const [coalescedA, coalescedB] = await Promise.all([
    worker.fetch(new Request(coalescedUrl), {}, {}),
    worker.fetch(new Request(coalescedUrl), {}, {})
  ]);
  assert.equal(coalescedA.status, 200);
  assert.equal(coalescedB.status, 200);
  assert.equal(upstreamCalls - callsBeforeCoalescing, 4);

  const invalid = await worker.fetch(new Request(
    'https://ga-proxy.test/api/openaip/snapshot?bbox=0,0,6,2'
  ), {}, {});
  assert.equal(invalid.status, 400);

  const snapshotFetchMock = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const parsed = new URL(url);
    assert.equal(parsed.hostname, 'api.core.openaip.net');
    assert.equal(parsed.pathname, '/api/airports');
    assert.equal(parsed.searchParams.get('bbox'), '7,47,10,50');
    assert.equal(parsed.searchParams.get('limit'), '250');
    assert.ok(parsed.searchParams.get('apiKey'));
    return new Response(JSON.stringify({
      limit: 250,
      page: 1,
      items: [makeCollectionItem('/api/airports')]
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  };
  const legacy = await worker.fetch(new Request(
    'https://ga-proxy.test/api/airports?bbox=7,47,10,50&limit=250'
  ), {}, {});
  assert.equal(legacy.status, 200);
  const legacyPayload = await legacy.json();
  assert.equal(legacyPayload.items[0].icaoCode, 'EDTT');
  globalThis.fetch = snapshotFetchMock;

  let partialCalls = 0;
  globalThis.fetch = async (url) => {
    partialCalls += 1;
    const parsed = new URL(url);
    if (parsed.pathname === '/api/airspaces') {
      return new Response(JSON.stringify({ error: 'rate limit' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    return new Response(JSON.stringify({
      limit: 250,
      page: 1,
      items: [makeCollectionItem(parsed.pathname)]
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  };
  const partialUrl = 'https://ga-proxy.test/api/openaip/snapshot?bbox=12,45,14,47';
  const partial = await worker.fetch(new Request(partialUrl), {}, {});
  assert.equal(partial.status, 200);
  assert.equal(partial.headers.get('X-GA-OpenAIP-Cache'), 'PARTIAL');
  const partialPayload = await partial.json();
  assert.equal(partialPayload.meta.partial, true);
  assert.equal(partialPayload.airports.length, 1);
  assert.equal(partialPayload.airspaces.length, 0);
  assert.equal(partialPayload.navaids.length, 1);
  assert.equal(partialPayload.reportingPoints.length, 1);
  assert.equal(partialPayload.meta.collections.airspaces.errorStatus, 429);
  assert.equal(partialCalls, 4);

  const partialCached = await worker.fetch(new Request(partialUrl), {}, {});
  assert.equal(partialCached.status, 200);
  assert.equal(partialCached.headers.get('X-GA-OpenAIP-Cache'), 'HIT-PARTIAL');
  assert.equal(partialCalls, 4);

  const partialCacheKey = [...cacheStore.keys()].find(key => key.includes(encodeURIComponent('12.000,45.000,14.000,47.000')));
  const expiredPartialPayload = await cacheStore.get(partialCacheKey).clone().json();
  expiredPartialPayload.meta.fetchedAtMs = Date.now() - (61 * 1000);
  expiredPartialPayload.meta.fetchedAt = new Date(expiredPartialPayload.meta.fetchedAtMs).toISOString();
  cacheStore.set(partialCacheKey, new Response(JSON.stringify(expiredPartialPayload), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=300'
    }
  }));
  let partialRetryCalls = 0;
  globalThis.fetch = async (url) => {
    partialRetryCalls += 1;
    const parsed = new URL(url);
    assert.equal(parsed.pathname, '/api/airspaces');
    return new Response(JSON.stringify({
      limit: 250,
      page: 1,
      items: [makeCollectionItem(parsed.pathname)]
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  };
  const completedPartial = await worker.fetch(new Request(partialUrl), {}, {});
  assert.equal(completedPartial.status, 200);
  assert.equal(completedPartial.headers.get('X-GA-OpenAIP-Cache'), 'REFRESH');
  const completedPartialPayload = await completedPartial.json();
  assert.equal(completedPartialPayload.meta.partial, false);
  assert.equal(completedPartialPayload.airspaces.length, 1);
  assert.equal(completedPartialPayload.airports.length, 1);
  assert.equal(completedPartialPayload.meta.collections.airports.reused, true);
  assert.equal(partialRetryCalls, 1);
  globalThis.fetch = snapshotFetchMock;

  const cacheKey = [...cacheStore.keys()][0];
  const cachedPayload = await cacheStore.get(cacheKey).clone().json();
  cachedPayload.meta.fetchedAtMs = Date.now() - (10 * 60 * 1000);
  cachedPayload.meta.fetchedAt = new Date(cachedPayload.meta.fetchedAtMs).toISOString();
  cacheStore.set(cacheKey, new Response(JSON.stringify(cachedPayload), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=86400'
    }
  }));
  globalThis.fetch = async () => {
    upstreamCalls += 1;
    return new Response(JSON.stringify({ error: 'rate limit' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' }
    });
  };

  const stale = await worker.fetch(new Request(snapshotUrl), {}, {});
  assert.equal(stale.status, 200);
  assert.equal(stale.headers.get('X-GA-OpenAIP-Cache'), 'STALE');
  const stalePayload = await stale.json();
  assert.equal(stalePayload.meta.stale, true);
  assert.equal(stalePayload.airports.length, 1);

  console.log('All OpenAIP snapshot tests passed.');
} finally {
  globalThis.fetch = originalFetch;
  if (originalCaches === undefined) delete globalThis.caches;
  else globalThis.caches = originalCaches;
}
