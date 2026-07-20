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
    async delete(key) {
      store.delete(key);
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
  const body = text ? JSON.parse(text) : null;
  return { response, body };
}

const kv = makeKv({
  pilotA: JSON.stringify({
    pin: "1111",
    profile: { name: "Anna" },
    registeredAt: "2026-06-01T10:00:00.000Z",
    lastModified: Date.parse("2026-06-02T10:00:00.000Z")
  }),
  pilotB: JSON.stringify({
    pin: "2222",
    lastModified: Date.parse("2026-06-03T10:00:00.000Z")
  }),
  GROUP_EDTK: JSON.stringify({ pin: "1111", members: [] }),
  "checklist:community:x": JSON.stringify({ id: "x" }),
  "bug:report:old": JSON.stringify({
    id: "old",
    createdAt: "2000-01-01T00:00:00.000Z",
    status: "open",
    openKey: "bug:open:9999999999998:old"
  }),
  "bug:open:9999999999998:old": JSON.stringify({ id: "old" }),
  "bug:report:new": JSON.stringify({
    id: "new",
    createdAt: "2999-01-01T00:00:00.000Z",
    status: "open",
    openKey: "bug:open:0000000000001:new"
  }),
  "bug:open:0000000000001:new": JSON.stringify({ id: "new" })
});

const securedEnv = { GA_SYNC_KV: kv, BUG_TRACKER_ADMIN_TOKEN: "secret" };

const unauthorized = await call(securedEnv, "/api/admin/users");
assert.equal(unauthorized.response.status, 401);

const users = await call(securedEnv, "/api/admin/users?limit=20", {
  headers: { "x-bug-admin-token": "secret" }
});
assert.equal(users.response.status, 200);
assert.equal(users.body.ok, true);
assert.equal(users.body.count, 2);
assert.deepEqual(users.body.items.map(item => item.name).sort(), ["Anna", "pilotB"]);
assert.equal(JSON.stringify(users.body).includes("1111"), false);
assert.equal(users.body.items.find(item => item.id === "pilotA").registrationKnown, true);
assert.equal(users.body.items.find(item => item.id === "pilotB").registrationKnown, false);

const dryRun = await call(securedEnv, "/api/problem-reports/purge", {
  method: "POST",
  headers: { "Content-Type": "application/json", "x-bug-admin-token": "secret" },
  body: JSON.stringify({ olderThanDays: 30, dryRun: true })
});
assert.equal(dryRun.response.status, 200);
assert.equal(dryRun.body.ok, true);
assert.equal(dryRun.body.dryRun, true);
assert.equal(dryRun.body.matchedKeys, 2);
assert.equal(kv.store.has("bug:report:old"), true);

const purge = await call(securedEnv, "/api/problem-reports/purge", {
  method: "POST",
  headers: { "Content-Type": "application/json", "x-bug-admin-token": "secret" },
  body: JSON.stringify({ olderThanDays: 30, dryRun: false })
});
assert.equal(purge.response.status, 200);
assert.equal(purge.body.ok, true);
assert.equal(purge.body.deleted, 2);
assert.equal(kv.store.has("bug:report:old"), false);
assert.equal(kv.store.has("bug:open:9999999999998:old"), false);
assert.equal(kv.store.has("bug:report:new"), true);

const registerKv = makeKv({});
const registerEnv = { GA_SYNC_KV: registerKv };
const register = await call(registerEnv, "/api/sync/newPilot", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ pin: "3333", flights: [], lastModified: Date.now() })
});
assert.equal(register.response.status, 200);
const registeredProfile = JSON.parse(registerKv.store.get("NEWPILOT"));
assert.equal(registeredProfile.syncId, "NEWPILOT");
assert.ok(registeredProfile.registeredAt);
assert.ok(registeredProfile.registeredAtMs);

const update = await call(registerEnv, "/api/sync/newPilot", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ pin: "3333", pinboard: [], lastModified: Date.now() + 1000 })
});
assert.equal(update.response.status, 200);
const updatedProfile = JSON.parse(registerKv.store.get("NEWPILOT"));
assert.equal(updatedProfile.registeredAt, registeredProfile.registeredAt);
assert.equal(updatedProfile.registeredAtMs, registeredProfile.registeredAtMs);

console.log("admin-tools tests ok");
