import assert from "node:assert/strict";
import worker from "./worker-merged-full.js";

function makeKv(seed = {}) {
  const store = new Map(Object.entries(seed));
  return {
    store,
    async get(key) {
      return store.has(key) ? store.get(key) : null;
    },
    async put(key, value) {
      store.set(key, value);
    },
    async list({ prefix = "", limit = 1000, cursor = "" } = {}) {
      const all = [...store.keys()].filter(key => key.startsWith(prefix)).sort();
      const start = cursor ? Number(cursor) : 0;
      const page = all.slice(start, start + limit);
      const next = start + page.length;
      return {
        keys: page.map(name => ({ name })),
        list_complete: next >= all.length,
        cursor: next < all.length ? String(next) : ""
      };
    }
  };
}

async function call(env, path, options = {}) {
  const response = await worker.fetch(new Request(`https://example.test${path}`, options), env, {});
  const text = await response.text();
  return { response, body: text ? JSON.parse(text) : null };
}

const kv = makeKv({
  SALUD: JSON.stringify({ pin: "1138", syncId: "SALUD", flights: [] }),
  PlayedByDemon: JSON.stringify({ pin: "2468", syncId: "PlayedByDemon", flights: [] }),
  GROUP_TEST: JSON.stringify({ members: [] }),
  "homebase:SALUD": JSON.stringify({ baseRevision: 1 })
});
const env = { GA_SYNC_KV: kv };

const verified = await call(env, "/api/auth/verify", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ pilotId: "salud", pin: "1138" })
});
assert.equal(verified.response.status, 200);
assert.deepEqual(verified.body, { ok: true, pilotId: "SALUD" });
assert.equal(verified.response.headers.get("X-Pilot-ID"), "SALUD");

const mixedCase = await call(env, "/api/auth/verify", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ pilotId: "PLAYEDBYDEMON", pin: "2468" })
});
assert.equal(mixedCase.response.status, 200);
assert.equal(mixedCase.body.pilotId, "PlayedByDemon");

const wrongPin = await call(env, "/api/auth/verify", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ pilotId: "SaLuD", pin: "0000" })
});
assert.equal(wrongPin.response.status, 401);
assert.equal(wrongPin.body.code, "pin_invalid");

const missing = await call(env, "/api/auth/verify", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ pilotId: "unknown", pin: "1138" })
});
assert.equal(missing.response.status, 404);
assert.equal(missing.body.code, "pilot_not_found");

const syncGet = await call(env, "/api/sync/sAlUd?pin=1138");
assert.equal(syncGet.response.status, 200);
assert.equal(syncGet.response.headers.get("X-Pilot-ID"), "SALUD");
assert.equal(syncGet.body.syncId, "SALUD");

const syncUpdate = await call(env, "/api/sync/SaLuD", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ pin: "1138", flights: ["updated"] })
});
assert.equal(syncUpdate.response.status, 200);
assert.equal(syncUpdate.body.pilotId, "SALUD");
assert.equal(kv.store.has("SaLuD"), false);
assert.deepEqual(JSON.parse(kv.store.get("SALUD")).flights, ["updated"]);

const register = await call(env, "/api/sync/NewPilot", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ pin: "9999", flights: [] })
});
assert.equal(register.response.status, 200);
assert.equal(register.body.pilotId, "NEWPILOT");
assert.equal(kv.store.has("NEWPILOT"), true);
assert.equal(kv.store.has("NewPilot"), false);

const collisionKv = makeKv({
  Pilot: JSON.stringify({ pin: "1111" }),
  PILOT: JSON.stringify({ pin: "2222" })
});
const collision = await call({ GA_SYNC_KV: collisionKv }, "/api/auth/verify", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ pilotId: "pilot", pin: "1111" })
});
assert.equal(collision.response.status, 409);
assert.equal(collision.body.code, "pilot_id_collision");

console.log("pilot auth tests ok");
