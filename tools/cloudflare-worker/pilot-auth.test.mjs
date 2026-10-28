import assert from "node:assert/strict";
import worker from "./worker-merged-full.js";

function makeKv(seed = {}) {
  const store = new Map(Object.entries(seed));
  const putCalls = [];
  return {
    store,
    putCalls,
    async get(key) {
      return store.has(key) ? store.get(key) : null;
    },
    async put(key, value) {
      putCalls.push(key);
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
const saludAfterFirstLogin = JSON.parse(kv.store.get("SALUD"));
assert.equal(saludAfterFirstLogin.lastAppSeenDay, new Date().toISOString().slice(0, 10));
assert.ok(Number.isFinite(saludAfterFirstLogin.lastAppSeen));
const saludWritesAfterFirstLogin = kv.putCalls.filter(key => key === "SALUD").length;

const verifiedAgain = await call(env, "/api/auth/verify", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ pilotId: "SALUD", pin: "1138" })
});
assert.equal(verifiedAgain.response.status, 200);
assert.equal(kv.putCalls.filter(key => key === "SALUD").length, saludWritesAfterFirstLogin);

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

// A missing checklist key must not trigger the case-insensitive KV list search.
{
  const chkKv = makeKv({ SALUD: JSON.stringify({ pin: "1138", syncId: "SALUD" }) });
  let listCalls = 0;
  const originalList = chkKv.list.bind(chkKv);
  chkKv.list = async (...args) => { listCalls++; return originalList(...args); };
  const missingIndex = await call({ GA_SYNC_KV: chkKv }, "/api/sync/CHKIDX_SALUD?pin=1138");
  assert.equal(missingIndex.response.status, 404);
  const missingItem = await call({ GA_SYNC_KV: chkKv }, "/api/sync/CHK_SALUD_custom_1?pin=1138");
  assert.equal(missingItem.response.status, 404);
  assert.equal(listCalls, 0);
  const missingPilot = await call({ GA_SYNC_KV: chkKv }, "/api/sync/salud?pin=1138");
  assert.equal(missingPilot.response.status, 200);
  assert.equal(listCalls, 1);
}

// Other casing: the first lookup lists once and writes the index; later lookups read the index.
{
  const idxKv = makeKv({ MixedCase: JSON.stringify({ pin: "777", syncId: "MixedCase" }) });
  let listCalls = 0;
  const originalList = idxKv.list.bind(idxKv);
  idxKv.list = async (...args) => { listCalls++; return originalList(...args); };
  const idxEnv = { GA_SYNC_KV: idxKv };
  const first = await call(idxEnv, "/api/sync/MIXEDCASE?pin=777");
  assert.equal(first.response.status, 200);
  assert.equal(idxKv.store.get("pilotidx:mixedcase"), "MixedCase");
  const listsAfterFirst = listCalls;
  assert.ok(listsAfterFirst <= 1);
  const second = await call(idxEnv, "/api/sync/mixedcase?pin=777");
  assert.equal(second.response.status, 200);
  assert.equal(listCalls, listsAfterFirst);
  // Unknown IDs reuse the cached key list instead of listing again.
  for (const id of ["nobody-1", "nobody-2", "nobody-3"]) {
    assert.equal((await call(idxEnv, `/api/sync/${id}?pin=1`)).response.status, 404);
  }
  assert.ok(listCalls <= 1);
  // The index key itself is not readable through the sync route.
  assert.equal((await call(idxEnv, "/api/sync/pilotidx:mixedcase?pin=777")).response.status, 400);
}
