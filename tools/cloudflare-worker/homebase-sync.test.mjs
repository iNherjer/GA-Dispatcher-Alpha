import assert from "node:assert/strict";
import worker from "./worker-merged-full.js";

function makeKv(seed = {}) {
  const store = new Map(Object.entries(seed));
  return {
    store,
    async get(key) { return store.has(key) ? store.get(key) : null; },
    async put(key, value) { store.set(key, value); }
  };
}

async function call(env, path, options = {}) {
  const response = await worker.fetch(new Request(`https://example.test${path}`, options), env, {});
  const text = await response.text();
  return { response, body: text ? JSON.parse(text) : null };
}

const kv = makeKv({
  pilotA: JSON.stringify({ pin: "0815" }),
  pilotB: JSON.stringify({ pin: "4711" }),
  pilotC: JSON.stringify({ pin: "9999" }),
  GROUP_TEST: JSON.stringify({
    members: [
      { syncId: "pilotA", nick: "Alpha", lastSeen: Date.now(), isAdmin: true },
      { syncId: "pilotB", nick: "Bravo", lastSeen: Date.now(), isAdmin: false }
    ],
    kicked: []
  })
});
const env = { GA_SYNC_KV: kv };
const headers = { "Content-Type": "application/json", "X-Pilot-ID": "pilotA", "X-Pilot-PIN": "0815" };
const plan = {
  doorAutomationEnabled: false,
  spawn: { lat: 48.1, lon: 8.2, altFt: 1234, heading: 361 },
  hangar: { northM: 2, eastM: -3, heading: -1, heightFt: 1, widthM: 18, depthM: 22, objectTitle: "VFR Multitool Homebase Hangar" },
  objects: [{ id: "box-1", title: "VFR Multitool Homebase Box", label: "Karton", northM: 1, eastM: 2, heading: 90, heightFt: 0, scale: 1 }],
  people: [{
    id: "person-1", title: "Tarmac_Male_Summer_Asian", label: "Mitarbeiter 1",
    startNorthM: 12, startEastM: 3, speedKts: 2.6,
    randomTargets: true, randomWaitMinS: 11, randomWaitMaxS: 44,
    stops: [
      { id: "waypoint-1", targetType: "waypoint", northM: 24.5, eastM: -2, waitMinS: 5, waitMaxS: 30 },
      { id: "waypoint-2", targetType: "waypoint", northM: -8, eastM: 16.25, waitMinS: 2, waitMaxS: 9 }
    ]
  }]
};

const missing = await call(env, "/api/homebase/pilotA", { headers });
assert.equal(missing.response.status, 404);

const unauthorized = await call(env, "/api/homebase/pilotA", { headers: { ...headers, "X-Pilot-PIN": "wrong" } });
assert.equal(unauthorized.response.status, 401);

const created = await call(env, "/api/homebase/pilotA", {
  method: "POST",
  headers,
  body: JSON.stringify({ baseRevision: "", clientUpdatedAt: Date.now(), deviceId: "test-device", plan })
});
assert.equal(created.response.status, 200);
assert.equal(created.body.record.schemaVersion, 2);
assert.equal(created.body.record.plan.spawn.heading, 1);
assert.equal(created.body.record.plan.hangar.heading, 359);
assert.equal(created.body.record.plan.objects.length, 1);
assert.equal(created.body.record.plan.people.length, 1);
assert.equal(created.body.record.plan.people[0].title, "Tarmac_Male_Summer_Asian");
assert.equal(created.body.record.plan.people[0].randomTargets, true);
assert.equal(created.body.record.plan.people[0].randomWaitMinS, 11);
assert.equal(created.body.record.plan.people[0].randomWaitMaxS, 44);
assert.equal(created.body.record.plan.people[0].stops.length, 2);
assert.equal(created.body.record.plan.people[0].stops[0].northM, 24.5);
assert.equal(created.body.record.plan.people[0].stops[1].eastM, 16.25);
assert.equal(created.body.record.plan.doorAutomationEnabled, false);
assert.equal(JSON.stringify(created.body).includes("0815"), false);

const conflict = await call(env, "/api/homebase/pilotA", {
  method: "POST",
  headers,
  body: JSON.stringify({ baseRevision: "stale", clientUpdatedAt: Date.now(), deviceId: "other-device", plan })
});
assert.equal(conflict.response.status, 409);
assert.equal(conflict.body.record.revision, created.body.record.revision);

const updatedPlan = structuredClone(plan);
updatedPlan.spawn.lat = 49.5;
const updated = await call(env, "/api/homebase/pilotA", {
  method: "POST",
  headers,
  body: JSON.stringify({ baseRevision: created.body.record.revision, clientUpdatedAt: Date.now(), deviceId: "test-device", plan: updatedPlan })
});
assert.equal(updated.response.status, 200);
assert.equal(updated.body.record.plan.spawn.lat, 49.5);

const loaded = await call(env, "/api/homebase/pilotA", { headers });
assert.equal(loaded.response.status, 200);
assert.equal(loaded.body.record.revision, updated.body.record.revision);
assert.equal(loaded.body.record.plan.people.length, 1);
assert.equal(loaded.body.record.plan.people[0].randomTargets, true);
assert.equal(loaded.body.record.plan.people[0].randomWaitMinS, 11);
assert.equal(loaded.body.record.plan.people[0].randomWaitMaxS, 44);
assert.equal(loaded.body.record.plan.people[0].stops[0].targetType, "waypoint");
assert.equal(loaded.body.record.plan.people[0].stops[1].targetType, "waypoint");

const deletedPeoplePlan = structuredClone(updatedPlan);
deletedPeoplePlan.people = [];
const deletedPeople = await call(env, "/api/homebase/pilotA", {
  method: "POST",
  headers,
  body: JSON.stringify({
    baseRevision: loaded.body.record.revision,
    clientUpdatedAt: Date.now(),
    deviceId: "second-device",
    plan: deletedPeoplePlan
  })
});
assert.equal(deletedPeople.response.status, 200);
assert.deepEqual(deletedPeople.body.record.plan.people, []);

const staleDeviceAfterDelete = await call(env, "/api/homebase/pilotA", {
  method: "POST",
  headers,
  body: JSON.stringify({
    baseRevision: loaded.body.record.revision,
    clientUpdatedAt: Date.now(),
    deviceId: "stale-device",
    plan: updatedPlan
  })
});
assert.equal(staleDeviceAfterDelete.response.status, 409);
assert.deepEqual(staleDeviceAfterDelete.body.record.plan.people, []);

const crewDisabled = await call(env, "/api/homebase-group/TEST", { headers });
assert.equal(crewDisabled.response.status, 200);
assert.equal(crewDisabled.body.bases.length, 0);
assert.equal(crewDisabled.body.directory.length, 2);
assert.equal(crewDisabled.body.directory.find((entry) => entry.pilotId === "pilotA")?.hasHomebase, false);
assert.equal(crewDisabled.body.directory.find((entry) => entry.pilotId === "pilotA")?.spawn, undefined);

const sharedPlan = structuredClone(plan);
sharedPlan.objects = Array.from({ length: 25 }, (_, index) => ({
  id: `box-${index + 1}`,
  title: "VFR Multitool Homebase Box",
  label: "Karton",
  northM: index,
  eastM: index,
  heading: 90,
  heightFt: 0,
  scale: 1
}));
const shared = await call(env, "/api/homebase/pilotB", {
  method: "POST",
  headers: { ...headers, "X-Pilot-ID": "pilotB", "X-Pilot-PIN": "4711" },
  body: JSON.stringify({ baseRevision: "", clientUpdatedAt: Date.now(), deviceId: "bravo-device", crewShareEnabled: true, plan: sharedPlan })
});
assert.equal(shared.response.status, 200);

const crew = await call(env, "/api/homebase-group/TEST", { headers });
assert.equal(crew.response.status, 200);
assert.equal(crew.body.bases.length, 1);
assert.equal(crew.body.bases[0].pilotId, "pilotB");
assert.equal(crew.body.bases[0].nick, "Bravo");
assert.equal(crew.body.bases[0].plan.objects.length, 20);
assert.equal(crew.body.directory.find((entry) => entry.pilotId === "pilotB")?.hasHomebase, true);
assert.equal(crew.body.directory.find((entry) => entry.pilotId === "pilotB")?.spawn.lat, 48.1);
assert.equal(JSON.stringify(crew.body.directory).includes("VFR Multitool Homebase Box"), false);
assert.equal(JSON.stringify(crew.body).includes("4711"), false);

const outsider = await call(env, "/api/homebase-group/TEST", { headers: { ...headers, "X-Pilot-ID": "pilotC", "X-Pilot-PIN": "9999" } });
assert.equal(outsider.response.status, 403);

console.log("homebase-sync tests ok");
