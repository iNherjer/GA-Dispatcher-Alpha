const test = require('node:test');
const assert = require('node:assert/strict');
const { createTrackerEfbHttpServer, createTrackerEfbHttpHello } = require('./tracker-efb-http-server');
const { createTrackerCockpitControl } = require('./tracker-cockpit-control-core');
const { createMediaRelay } = require('./tracker-media-core');
const { getTrackerEfbWebClientAsset, createTrackerEfbWebClientPage } = require('./tracker-efb-web-client');

test('local media requires an EFB/toolbar session, rejects external origins and deduplicates commands', async () => {
  const calls = [], control = createTrackerCockpitControl();
  const server = createTrackerEfbHttpServer({ port: 0, hello: createTrackerEfbHttpHello({ trackerVersion: 'v533', trackerVersionCode: 533 }), cockpitControl: control,
    mediaControl: createMediaRelay(async payload => { calls.push(payload); return { ok: true, source: 'Spotify.exe' }; }) });
  const address = await server.start(), url = `http://127.0.0.1:${address.port}/api/v1/media/control`;
  async function send(auth = {}, origin, command = { action: 'next' }, id = 'switch-1') {
    const result = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(origin ? { Origin: origin } : {}) }, body: JSON.stringify({ ...auth, commandId: id, clientId: 'spoofed', payload: command }) });
    return { status: result.status, body: await result.json() };
  }
  function register(role) { const result = control.register({ clientId: role + '-view', role }); return { sessionId: result.session.sessionId, sessionToken: result.sessionToken }; }
  try {
    assert.equal((await send()).status, 401);
    const auth = register('efb');
    assert.equal((await send(auth, 'https://inherjer.github.io')).status, 403);
    assert.equal((await send({ ...auth, sessionToken: 'invalid' })).status, 401);
    assert.equal((await send(register('web'))).status, 401);
    assert.equal(calls.length, 0);
    const a = await send(auth, 'http://127.0.0.1:49880');
    const b = await send(auth);
    assert.equal(a.body.ok, true); assert.equal(b.body.ok, true); assert.equal(calls.length, 1);
    assert.equal(calls[0].clientId, 'local:' + auth.sessionId);
    assert.equal((await send(auth, undefined, { action: 'pause' })).body.error, 'command_id_conflict');
    assert.equal((await send(auth, undefined, { action: 'volume', volume: 2 }, 'invalid')).body.error, 'media_volume_invalid');
    const toolbar = register('toolbar');
    assert.equal((await send(toolbar, undefined, { action: 'duck', active: true }, 'duck')).body.ok, true);
    assert.notEqual(calls[0].clientId, calls[1].clientId);
    control.release(toolbar);
    assert.equal((await send(toolbar)).status, 401);
  } finally { await server.stop(); }
});

test('EFB packages the shared media UI and a local transport without a relay dependency', () => {
  const html = createTrackerEfbWebClientPage();
  for (const asset of ['media-player.css', 'media-player-ui.js', 'media-player-client.js', 'media-local-client.js']) {
    assert.ok(html.includes('/efb/v1/assets/' + asset));
    assert.ok(getTrackerEfbWebClientAsset('/efb/v1/assets/' + asset).body.length > 0);
  }
  const local = getTrackerEfbWebClientAsset('/efb/v1/assets/media-local-client.js').body.toString();
  assert.match(local, /\/media\/control/); assert.match(local, /authEnvelope/); assert.doesNotMatch(local, /WebSocket|gaTrackerVoiceRelay|wss:/);
});
