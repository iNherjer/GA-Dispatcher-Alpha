const test = require('node:test');
const assert = require('node:assert/strict');
const { createCrewPresence } = require('./tracker-crew-presence.js');

function setup({ profile = { groupName: 'edtw' }, status = 200 } = {}) {
  let t = 1_000_000_000_000;
  const posts = [];
  let route = null;
  const presence = createCrewPresence({
    pilotId: 'ALICE', pin: '1234',
    now: () => t,
    readProfile: async () => profile,
    getRoute: () => route,
    request: async (url, init) => {
      posts.push({ url, body: JSON.parse(init.body) });
      return { ok: status === 200, status, json: async () => ({ ok: true }) };
    },
    setInterval: () => null, clearInterval: () => {}
  });
  return {
    presence, posts,
    advance(ms) { t += ms; },
    now: () => t,
    setRoute(next) { route = next; },
    sample(extra) { presence.observe({ lat: 49.0, lon: 8.0, onGround: true, gsKts: 0, vsFpm: 0, ...extra }); }
  };
}
const mission = { kind: 'mission', id: 'run-1', title: 'Charter nach Speyer', dep: 'EDTW', dest: 'EDRY',
  startedAt: 999_999_000_000, waypoints: [{ lat: 49, lon: 8, name: 'EDTW' }, { lat: 49, lon: 9, name: 'EDRY' }],
  missionState: { mTitle: 'Charter', activeMissionRuntimePhase: 'cruise', currentMissionData: { mission: 'Charter nach Speyer' } } };

test('beats while running, crew comes from the profile', async () => {
  const s = setup();
  s.sample();
  await s.presence.tick();
  assert.equal(s.posts.length, 1);
  assert.match(s.posts[0].url, /crew-presence-v1\/EDTW$/);
  assert.equal(s.posts[0].body.source, 'tracker');
  assert.equal(s.posts[0].body.flight, null);
  s.advance(15000); await s.presence.tick();
  assert.equal(s.posts.length, 1, 'no beat before the interval');
  s.advance(5 * 60 * 1000); await s.presence.tick();
  assert.equal(s.posts.length, 2);
});

test('no crew in the profile: nothing is sent', async () => {
  const s = setup({ profile: {} });
  await s.presence.tick();
  assert.equal(s.posts.length, 0);
});

test('mission flight: takeoff, progress, landing and end are reported, never more than once a minute', async () => {
  const s = setup();
  s.setRoute({ ...mission, missionState: null });
  s.sample();
  await s.presence.tick();
  assert.equal(s.posts.at(-1).body.flight.phase, 'ground');
  s.advance(20000);
  s.sample({ onGround: false, gsKts: 90, vsFpm: 700, lon: 8.1 });
  await s.presence.tick();
  assert.equal(s.posts.length, 1, 'takeoff waits for the minimum gap');
  s.advance(45000);
  await s.presence.tick();
  const climb = s.posts.at(-1).body.flight;
  assert.equal(climb.phase, 'climb');
  assert.ok(climb.takeoffAt > 0);
  assert.ok(climb.progress > 0.05 && climb.progress < 0.15);
  s.advance(5 * 60 * 1000);
  s.sample({ onGround: false, gsKts: 110, vsFpm: 0, lon: 8.6 });
  await s.presence.tick();
  s.advance(65000);
  await s.presence.tick();
  assert.equal(s.posts.at(-1).body.flight.phase, 'cruise');
  assert.ok(s.posts.at(-1).body.flight.progress > 0.55);
  s.advance(5 * 60 * 1000);
  s.sample({ onGround: true, gsKts: 0, lon: 9.0 });
  await s.presence.tick();
  assert.equal(s.posts.at(-1).body.flight.phase, 'landed');
  s.setRoute(null);
  s.advance(70000);
  await s.presence.tick();
  const ended = s.posts.at(-1).body.flight;
  assert.ok(ended.endedAt > 0);
  assert.equal(ended.progress, 1);
  s.advance(31 * 60 * 1000);
  await s.presence.tick();
  assert.equal(s.posts.at(-1).body.flight, null, 'landed flight is dropped after 30 minutes');
});

test('mission is uploaded once per flight without runtime fields; beats carry position and route', async () => {
  const s = setup();
  s.setRoute(mission);
  s.sample({ altFt: 1200, hdg: 90 });
  await s.presence.tick();
  s.advance(6 * 60 * 1000);
  s.sample({ onGround: false, gsKts: 100, vsFpm: 0, lon: 8.5, altFt: 3500, hdg: 92 });
  await s.presence.tick();
  const missionPosts = s.posts.filter(p => p.url.endsWith('/mission'));
  assert.equal(missionPosts.length, 1);
  assert.equal(missionPosts[0].body.flightId, 'run-1');
  assert.equal(missionPosts[0].body.encoding, 'gzip-base64');
  const state = JSON.parse(require('node:zlib').gunzipSync(Buffer.from(missionPosts[0].body.data, 'base64')).toString());
  assert.equal(state.mTitle, 'Charter');
  assert.equal(state.activeMissionRuntimePhase, undefined);
  const beat = s.posts.filter(p => !p.url.endsWith('/mission')).at(-1).body.flight;
  assert.equal(beat.pos.altFt, 3500);
  assert.equal(beat.pos.hdg, 92);
  assert.equal(beat.route.length, 2);
  assert.equal(beat.route[1].name, 'EDRY');
});

test('phase changes must hold 30 s; a stale Direct To route far away is ignored', async () => {
  const s = setup();
  s.setRoute({ kind: 'free', title: 'Direct To EDDS', dest: 'EDDS', waypoints: [{ lat: 48.0, lon: 11.0 }, { lat: 48.69, lon: 9.22 }] });
  s.sample();
  await s.presence.tick();
  s.advance(70000);
  s.sample({ onGround: false, gsKts: 100, vsFpm: 0 });
  await s.presence.tick();
  let flight = s.posts.at(-1).body.flight;
  assert.equal(flight.dest, '', 'route 100 NM away is not this flight');
  assert.equal(flight.progress, null);
  s.advance(70000);
  s.sample({ onGround: false, gsKts: 100, vsFpm: 600 });
  await s.presence.tick();
  s.advance(10000);
  s.sample({ onGround: false, gsKts: 100, vsFpm: 0 });
  await s.presence.tick();
  s.advance(70000);
  await s.presence.tick();
  assert.ok(s.posts.every(p => p.body.flight?.phase !== 'climb'), 'a 10 s climb blip is not reported');
});

test('free flight starts at takeoff, survives a touch-and-go and ends after standing still', async () => {
  const s = setup();
  s.sample();
  await s.presence.tick();
  s.advance(70000);
  s.sample({ onGround: false, gsKts: 90, vsFpm: 600 });
  await s.presence.tick();
  const id = s.posts.at(-1).body.flight.id;
  assert.match(id, /^free-/);
  s.advance(70000);
  s.sample({ onGround: true, gsKts: 50 });
  s.sample({ onGround: false, gsKts: 70, vsFpm: 500 });
  await s.presence.tick();
  assert.equal(s.posts.at(-1).body.flight.id, id, 'touch-and-go keeps the flight');
  s.advance(70000);
  s.sample({ onGround: true, gsKts: 0 });
  await s.presence.tick();
  s.advance(70000);
  await s.presence.tick();
  const ended = s.posts.at(-1).body.flight;
  assert.equal(ended.id, id);
  assert.ok(ended.endedAt > 0);
  assert.equal(ended.phase, 'landed');
});

test('sharing off sends one offline beat; refused crew backs off', async () => {
  const off = setup({ profile: { groupName: 'EDTW', crewShare: { online: false, flight: false, at: 5 } } });
  await off.presence.tick();
  off.advance(6 * 60 * 1000); await off.presence.tick();
  assert.equal(off.posts.length, 1);
  assert.deepEqual(off.posts[0].body, { offline: true });

  const refused = setup({ status: 403 });
  await refused.presence.tick();
  refused.advance(6 * 60 * 1000); await refused.presence.tick();
  assert.equal(refused.posts.length, 1, 'no retry before the back-off');
});

test('shutdown reports offline', async () => {
  const s = setup();
  await s.presence.tick();
  await s.presence.stop();
  assert.deepEqual(s.posts.at(-1).body, { offline: true });
});

test('menu placeholder position (in the air, no speed) never starts a flight', async () => {
  const s = setup();
  s.presence.observe({ inMenu: true });
  s.presence.observe({ inMenu: true, lat: 0.5, lon: 0.5, onGround: false, gsKts: 0, altFt: 221 });
  await s.presence.tick();
  assert.equal(s.posts.at(-1).body.flight, null);
  s.advance(5 * 60 * 1000); await s.presence.tick();
  assert.equal(s.posts.at(-1).body.flight, null, 'still no flight from the menu');
});

test('a held switch between menu and sim reports at once, a short one does not', async () => {
  const s = setup();
  s.presence.observe({ inMenu: true });
  await s.presence.tick();
  assert.equal(s.posts.length, 1);
  s.advance(20000);
  s.sample();                       // sim loaded: camera left the menu
  s.advance(5000); await s.presence.tick();
  assert.equal(s.posts.length, 1, 'switch must hold 10 s first');
  s.advance(6000); await s.presence.tick();
  assert.equal(s.posts.length, 2, 'beat right after the switch held');
  s.advance(15000); await s.presence.tick();
  assert.equal(s.posts.length, 2, 'only once per switch');
  s.presence.observe({ inMenu: true }); // back to the menu
  s.advance(3000);
  s.sample();                       // short loading flicker
  s.advance(15000); await s.presence.tick();
  assert.equal(s.posts.length, 2, 'a flicker shorter than 10 s sends nothing');
});

test('crew fleet: one takeoff and one parked event per flight, with the aircraft and its parking spot', async () => {
  const s = setup();
  s.presence.setAircraft({ title: 'A2A Piper PA-24-250 Comanche', tail: 'DEINA' });
  s.sample({ lat: 48.2769, lon: 8.4309 });
  await s.presence.tick();
  s.advance(20000);
  s.sample({ onGround: false, gsKts: 90, vsFpm: 600, lat: 48.3 });
  s.advance(1000);
  s.sample({ onGround: false, gsKts: 95, vsFpm: 0, lat: 48.31 });
  await s.presence.tick();
  await new Promise(resolve => setImmediate(resolve));
  const all = () => s.posts.filter(post => /crew-fleet-v1\/EDTW\/event$/.test(post.url)).map(post => post.body);
  const fleet = () => all().filter(body => body.event !== 'claim');
  assert.equal(fleet().length, 1);
  assert.deepEqual(fleet()[0], { event: 'takeoff', title: 'A2A Piper PA-24-250 Comanche', tail: 'DEINA', lat: 48.2769, lon: 8.4309 });
  assert.equal(all().filter(body => body.event === 'claim').length, 1, 'the free flight claims the aircraft once it exists');
  // Landing, rolling out, standing still 60 s: parked once.
  s.advance(30 * 60 * 1000);
  s.sample({ onGround: true, gsKts: 40, lat: 49.3, lon: 8.45 });
  s.advance(10000);
  s.sample({ onGround: true, gsKts: 0, lat: 49.3, lon: 8.45 });
  s.advance(61000);
  s.sample({ onGround: true, gsKts: 0, lat: 49.3, lon: 8.45 });
  s.advance(1000);
  s.sample({ onGround: true, gsKts: 0, lat: 49.3, lon: 8.45 });
  s.advance(15000);
  await s.presence.tick();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(fleet().length, 2);
  assert.equal(fleet()[1].event, 'parked');
  assert.equal(fleet()[1].lat, 49.3);
  const beat = s.posts.filter(post => /crew-presence-v1\/EDTW$/.test(post.url)).at(-1).body;
  assert.equal(beat.flight.aircraft, 'DEINA · A2A Piper PA-24-250 Comanche');
});

test('crew fleet hidden on the crew board or unknown aircraft: no fleet events', async () => {
  const s = setup({ profile: { groupName: 'edtw', crewShare: { fleet: false, at: 1 } } });
  s.presence.setAircraft({ title: 'A2A Piper PA-24-250 Comanche', tail: 'DEINA' });
  s.sample();
  await s.presence.tick();
  s.sample({ onGround: false, gsKts: 90 });
  s.advance(15000);
  await s.presence.tick();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(s.posts.filter(post => post.url.includes('crew-fleet')).length, 0);
  const t = setup();
  t.sample();
  t.sample({ onGround: false, gsKts: 90 });
  await t.presence.tick();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(t.posts.filter(post => post.url.includes('crew-fleet')).length, 0, 'no aircraft identity yet');
});

test('crew fleet: a mission flight claims the aircraft on the ground; it stays claimed until the pilot leaves it', async () => {
  const s = setup();
  s.presence.setAircraft({ title: 'A2A Piper PA-24-250 Comanche', tail: 'DEINA' });
  s.setRoute({ ...mission, missionState: null });
  s.sample({ lat: 48.2769, lon: 8.4309 });
  await s.presence.tick();
  await new Promise(resolve => setImmediate(resolve));
  const events = () => s.posts.filter(post => post.url.includes('crew-fleet')).map(post => post.body.event);
  assert.deepEqual(events(), ['claim']);
  assert.equal(s.posts.find(post => post.url.includes('crew-fleet')).body.lat, 48.2769, 'claimed at the parking spot');
  // Mission aborted, pilot still sits in the aircraft: still claimed.
  s.setRoute(null);
  s.advance(15000);
  await s.presence.tick();
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(events(), ['claim']);
  // Main menu for a minute: left.
  s.presence.observe({ inMenu: true });
  s.advance(30000);
  await s.presence.tick();
  assert.deepEqual(events(), ['claim'], 'a short menu visit does not count');
  s.advance(31000);
  await s.presence.tick();
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(events(), ['claim', 'left']);
  const left = s.posts.filter(post => post.url.includes('crew-fleet')).at(-1).body;
  assert.equal(left.tail, 'DEINA');
});

test('crew fleet: another aircraft, a closed sim or a stopped tracker leave the used aircraft', async () => {
  const s = setup();
  const events = () => s.posts.filter(post => post.url.includes('crew-fleet')).map(post => `${post.body.event}:${post.body.tail}`);
  s.presence.setAircraft({ title: 'A2A Piper PA-24-250 Comanche', tail: 'DEINA' });
  s.setRoute({ ...mission, missionState: null });
  s.sample();
  await s.presence.tick();
  s.presence.setAircraft({ title: 'Cessna 172', tail: 'D-EXYZ' });
  s.advance(15000);
  await s.presence.tick();
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(events().slice(0, 2), ['claim:DEINA', 'left:DEINA']);
  const t = setup();
  t.presence.setAircraft({ title: 'A2A Piper PA-24-250 Comanche', tail: 'DEINA' });
  t.setRoute({ ...mission, missionState: null });
  t.sample();
  await t.presence.tick();
  await new Promise(resolve => setImmediate(resolve));
  await t.presence.stop();
  assert.deepEqual(t.posts.filter(post => post.url.includes('crew-fleet')).map(post => post.body.event), ['claim', 'left']);
});
