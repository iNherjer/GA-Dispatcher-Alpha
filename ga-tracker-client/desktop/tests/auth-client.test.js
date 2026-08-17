const assert = require('node:assert/strict');
const test = require('node:test');
const { verifyCredentials } = require('../lib/auth-client');

test('credential verification forwards a six-digit PIN to the auth service', async () => {
  let requestPayload = null;
  const result = await verifyCredentials('Pilot-6', '123456', {
    request: async (_url, payload) => {
      requestPayload = payload;
      return { status: 200, data: { ok: true, pilotId: 'PILOT-6' } };
    }
  });

  assert.deepEqual(requestPayload, { pilotId: 'Pilot-6', pin: '123456' });
  assert.deepEqual(result, { ok: true, pilotId: 'PILOT-6' });
});

test('credential verification rejects PINs outside the 4-to-8-digit contract locally', async () => {
  let requests = 0;
  const request = async () => {
    requests += 1;
    return { status: 200, data: { ok: true, pilotId: 'PILOT' } };
  };

  for (const pin of ['123', '123456789', '12ab56']) {
    const result = await verifyCredentials('Pilot', pin, { request });
    assert.equal(result.ok, false);
    assert.match(result.message, /4 bis 8 Ziffern/);
  }
  assert.equal(requests, 0);
});
