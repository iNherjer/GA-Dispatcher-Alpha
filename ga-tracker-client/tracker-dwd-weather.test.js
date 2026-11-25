'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { createTrackerDwdWeather } = require('./tracker-dwd-weather');

test('DWD answers carry the published hour range for the EFB hour pickers', async () => {
  const hour = Math.floor(Date.now() / 3600000) * 3600000;
  const terms = [-3, 0, 7].map((offset) => {
    const validAt = hour + offset * 3600000;
    const stamp = (time) => new Date(time).toISOString().slice(0, 13).replace(/[-T]/g, '');
    return { validAt, runAt: hour - 6 * 3600000, key: `${stamp(validAt)}-${stamp(hour - 6 * 3600000)}` };
  });
  const manifest = Buffer.from(JSON.stringify({
    version: 1, source: 'dwd-icon-eu', bounds: [45, 3, 57, 18], tileDegrees: 3, samplesPerDegree: 8,
    levels: [1000], encoding: {}, fields: { map: [['clcl', null]], profile: [['clcl', null]] }, terms
  }));
  const fetchRemote = async () => ({
    ok: true, status: 200,
    body: new Blob([manifest]).stream()
  });
  const query = createTrackerDwdWeather(fetchRemote);
  const probe = await query({ points: [{ lat: 0, lon: 0 }], probe: true });
  assert.equal(probe.available, true);
  assert.equal(probe.firstValidAt, hour - 3 * 3600000);
  assert.equal(probe.lastValidAt, hour + 7 * 3600000);
});
