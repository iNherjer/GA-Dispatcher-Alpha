'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm');
const { requestJson } = require('./tracker-cockpit-session-client');
const source = fs.readFileSync(__dirname + '/tracker-efb-kartentisch-host.js', 'utf8');
const polling = source.slice(source.indexOf('  function fetchJson(url'), source.indexOf('  function pollMission()'));
const flush = () => new Promise(resolve => setImmediate(resolve));
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const response = value => ({ ok: true, json: async () => ({ message: { payload: value } }) });
function fixture(fetch) {
  const frames = [], timers = [], states = [], disconnected = [];
  const root = { GATrackerCockpitSessionClient: { requestJson: (fn, url, init) => requestJson(fn, url, init, 20) },
    gaEfbProfile: { disconnected: () => disconnected.push(true) },
    setTimeout: (fn, ms) => { timers.push({ fn, ms }); return timers.length; } };
  const sandbox = { window: root, fetch, pollingClosed: false, trackerOnline: false, auxiliaryPollTimers: {}, safePayload: x => x.message.payload,
    planeMarker:null, refreshLocalNavigation(){}, setInfoBoxAvailability(){}, updateCompass(){}, renderProgress(){},
    setTrackerState: (text, error) => states.push({ text, error }), renderFlight: value => frames.push(value), notifyParentState(){}, report(){} };
  vm.createContext(sandbox); vm.runInContext(polling, sandbox);
  return { sandbox, frames, timers, states, disconnected };
}
test('hanging map, status and checklist responses do not delay telemetry or its next poll', async () => {
  let frame = 0;
  const f = fixture(url => url.endsWith('/snapshot') ? Promise.resolve(response(++frame)) : new Promise(() => {}));
  for (const path of ['map', 'status', 'checklists']) f.sandbox.pollAuxiliary('/api/v1/' + path, () => {}, 10000);
  f.sandbox.poll(); await flush();
  assert.deepEqual(f.frames, [1]);
  f.timers.find(t => t.ms === 1000).fn(); await flush();
  assert.deepEqual(f.frames, [1,2]);
  await wait(30);
  assert.equal(f.timers.filter(t => t.ms === 10000).length, 3, 'each side request recovers independently');
});
test('telemetry timeout recovers automatically and ignores a late frame and unload callbacks', async () => {
  let calls = 0, finish;
  const f = fixture(() => ++calls === 1 ? new Promise(resolve => { finish = resolve; }) : Promise.resolve(response('fresh')));
  f.sandbox.poll(); await wait(30);
  assert.equal(f.states.at(-1).error, true);
  assert.equal(f.disconnected.length, 1);
  f.timers.find(t => t.ms === 1800).fn(); await flush();
  assert.deepEqual(f.frames, ['fresh']);
  assert.equal(f.states.at(-1).error, false, 'telemetry clears the offline notice even if the separate status request still hangs');
  finish(response('old')); await flush();
  assert.deepEqual(f.frames, ['fresh']);
  f.sandbox.pollingClosed = true;
  f.timers.find(t => t.ms === 1000).fn();
  assert.equal(calls, 2);
});
