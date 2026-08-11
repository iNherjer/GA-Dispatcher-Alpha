const assert = require('node:assert/strict');
const test = require('node:test');
const {
  EFB_WEB_CLIENT_PATH,
  createTrackerEfbWebClientPage
} = require('./tracker-efb-web-client');

test('tracker-hosted EFB probe is self-contained and its browser script parses', () => {
  const page = createTrackerEfbWebClientPage();
  assert.equal(EFB_WEB_CLIENT_PATH, '/efb/v1/');
  assert.match(page, /data-probe-version="1"/);
  assert.match(page, /fetch\('\/api\/v1\/snapshot'/);
  assert.doesNotMatch(page, /<script[^>]+src=/i);
  assert.doesNotMatch(page, /<link[^>]+href=/i);
  const script = page.match(/<script>([\s\S]*?)<\/script>/i)?.[1] || '';
  assert.ok(script.length > 100);
  assert.doesNotThrow(() => new Function(script));
});
