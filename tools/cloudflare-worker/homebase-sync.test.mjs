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

const kv = makeKv({ pilotA: JSON.stringify({ pin: "0815" }) });
const env = { GA_SYNC_KV: kv };
const headers = { "Content-Type": "application/json", "X-Pilot-ID": "pilotA", "X-Pilot-PIN": "0815" };
const plan = {
  spawn: { lat: 48.1, lon: 8.2, altFt: 1234, heading: 361 },
  hangar: { northM: 2, eastM: -3, heading: -1, heightFt: 1, widthM: 18, depthM: 22, objectTitle: "VFR Multitool Homebase Test Hangar" },
  objects: [{ id: "box-1", title: "VFR Multitool Homebase Box", label: "Karton", northM: 1, eastM: 2, heading: 90, heightFt: 0, scale: 1 }]
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
assert.equal(created.body.record.plan.spawn.heading, 1);
assert.equal(created.body.record.plan.hangar.heading, 359);
assert.equal(created.body.record.plan.objects.length, 1);
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

console.log("homebase-sync tests ok");
