const assert = require('assert');
const { verifyTrackerCredentials } = require('./tracker-auth.js');

(async () => {
  const ok = await verifyTrackerCredentials('salud', '1138', {
    request: async () => ({ status: 200, data: { ok: true, pilotId: 'SALUD' } })
  });
  assert.deepStrictEqual(ok, { ok: true, pilotId: 'SALUD' });

  const missing = await verifyTrackerCredentials('unknown', '1138', {
    request: async () => ({ status: 404, data: { code: 'pilot_not_found' } })
  });
  assert.strictEqual(missing.ok, false);
  assert.strictEqual(missing.code, 'pilot_not_found');

  const wrongPin = await verifyTrackerCredentials('SALUD', '0000', {
    request: async () => ({ status: 401, data: { code: 'pin_invalid' } })
  });
  assert.strictEqual(wrongPin.ok, false);
  assert.strictEqual(wrongPin.code, 'pin_invalid');

  const unavailable = await verifyTrackerCredentials('SALUD', '1138', {
    request: async () => { throw new Error('offline'); }
  });
  assert.strictEqual(unavailable.ok, false);
  assert.strictEqual(unavailable.code, 'auth_unavailable');

  console.log('tracker auth tests ok');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
