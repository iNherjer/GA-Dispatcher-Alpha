'use strict';
// Langsamer Sim: ohne SimConnect-Exception wird auf den Originaltitel gewartet
// statt Ersatzobjekte (Karton, Kaffeebecher) zusaetzlich zu spawnen.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const tracker = fs.readFileSync(path.join(__dirname, 'tracker.js'), 'utf8');
const slice = (from, to) => {
  const begin = tracker.indexOf(from);
  const end = tracker.indexOf(to, begin);
  assert.ok(begin >= 0 && end > begin, `Abschnitt ${from.trim()} nicht gefunden`);
  return tracker.slice(begin, end);
};
const waitCode = slice('  const rememberLateAssignableRequest = ', '  const usesAltitudeSensitiveVfx = ');
const planCode = slice('  const spawnSceneObjectFromPlan = async', '  const defaultSceneItems = ');

function fixture(extra = {}) {
  const timers = new Map();
  let nextTimer = 1;
  const logs = [];
  const context = {
    Date, Promise, Math, Number, String, Error, JSON,
    pendingAssign: new Map(), lateAssignedRequests: new Map(), lastExceptions: [],
    LATE_ASSIGNED_RETENTION_MS: 30000, SCENE_SPAWN_SILENT_GRACE_MS: 17000,
    setTimeout: (fn, ms) => { const id = nextTimer++; timers.set(id, { fn, ms }); return id; },
    clearTimeout: id => timers.delete(id),
    debugLog: line => logs.push(line), trackerLog() {}, trackerWarn() {},
    ...extra
  };
  vm.runInNewContext(`${waitCode}\n${planCode}\nthis.wait = waitForAssignedObject; this.spawnFromPlan = spawnSceneObjectFromPlan;`, context);
  const fire = ms => {
    const entry = [...timers.entries()].find(([, timer]) => timer.ms === ms);
    assert.ok(entry, `kein Timer mit ${ms} ms`);
    timers.delete(entry[0]);
    entry[1].fn();
  };
  return { context, logs, fire, timers };
}

test('stiller Sim verlaengert das Warten und nimmt die spaete ID als Erfolg an', async () => {
  const { context, logs, fire } = fixture();
  const promise = context.wait(7, 3000, { title: 'Fire Extinguisher', silentGraceMs: 17000 });
  fire(3000);
  assert.equal(context.pendingAssign.has(7), true, 'Anfrage muss nach dem ersten Timeout weiterlaufen');
  assert.match(logs.join('\n'), /SCENE_SPAWN_WAIT_EXTENDED requestId=7 .*waitedMs=3000 graceMs=17000/);
  const pending = context.pendingAssign.get(7);
  context.pendingAssign.delete(7);
  context.clearTimeout(pending.timer);
  pending.resolve(4711);
  assert.equal(await promise, 4711);
});

test('nach Ablauf der Gnadenfrist: Fehler sim_no_response und Anfrage bleibt spaet zuordenbar', async () => {
  const { context, fire } = fixture();
  const promise = context.wait(8, 3000, { title: 'Fire Extinguisher', silentGraceMs: 17000 });
  fire(3000);
  fire(17000);
  const error = await promise.then(() => null, err => err);
  assert.equal(error.code, 'sim_no_response');
  assert.equal(context.pendingAssign.has(8), false);
  assert.equal(context.lateAssignedRequests.get(8)?.reason, 'timeout');
});

test('SimConnect-Exception verlaengert nicht und markiert keinen stillen Sim', async () => {
  const { context, fire } = fixture();
  const promise = context.wait(9, 3000, { title: 'Unknown', silentGraceMs: 17000 });
  context.pendingAssign.get(9).lastException = 'UNRECOGNIZED_ID';
  context.lastExceptions.push('UNRECOGNIZED_ID');
  fire(3000);
  const error = await promise.then(() => null, err => err);
  assert.equal(error.message, 'UNRECOGNIZED_ID');
  assert.equal(error.code, undefined);
});

test('ohne Gnadenfrist bleibt das alte Timeout-Verhalten', async () => {
  const { context, fire, logs } = fixture();
  const promise = context.wait(10, 5000, { title: 'Payload' });
  fire(5000);
  const error = await promise.then(() => null, err => err);
  assert.equal(error.message, 'keine Antwort vom Sim');
  assert.equal(error.code, 'sim_no_response');
  assert.doesNotMatch(logs.join('\n'), /WAIT_EXTENDED/);
});

const candidates = ['VFR Multitool Homebase Fire Extinguisher', 'VFR_Multitool_Homebase_Fire_Extinguisher', 'Cardboard', 'CoffeeCup'];
const plan = { kind: 'unloaded_cargo.fire_extinguisher', title: candidates[0], titleCandidates: candidates, index: 1 };

function planFixture(failure) {
  const tried = [];
  const { context, logs } = fixture({
    spawnObject: async (title, _plan, _timeout, meta) => {
      tried.push({ title, graceMs: meta.silentGraceMs });
      if (title === 'Cardboard') return 99;
      throw failure();
    },
    stabilizeSceneGroundObject: async () => {},
    trackObjectId: id => id
  });
  return { context, logs, tried };
}

test('stiller Sim: keine Ersatzobjekte wie Karton oder Kaffeebecher', async () => {
  const { context, logs, tried } = planFixture(() => Object.assign(new Error('keine Antwort vom Sim'), { code: 'sim_no_response' }));
  const result = await context.spawnFromPlan('scene-cargo', plan, 3000);
  assert.equal(result, null);
  assert.deepEqual(tried.map(row => row.title), [candidates[0]]);
  assert.equal(tried[0].graceMs, 17000);
  assert.match(logs.join('\n'), /SCENE_SPAWN_FALLBACK_SKIPPED .*reason=sim_no_response lateAssign=1/);
});

test('echter Titel-Fehler probiert weiter die Ersatztitel', async () => {
  const { context, tried } = planFixture(() => new Error('UNRECOGNIZED_ID'));
  const result = await context.spawnFromPlan('scene-cargo', plan, 3000);
  assert.equal(result.objectId, 99);
  assert.equal(result.title, 'Cardboard');
  assert.deepEqual(tried.map(row => row.title), candidates.slice(0, 3));
});

test('volle Szenen nutzen dieselbe Wartelogik', () => {
  const sceneLoop = slice('  const spawnMissionScene = async', '    const lateObjects = consumeLateAssignedSceneObjects(sceneId);');
  assert.match(sceneLoop, /silentGraceMs: SCENE_SPAWN_SILENT_GRACE_MS/);
  assert.match(sceneLoop, /err\?\.code === 'sim_no_response'[\s\S]*?break;/);
});
