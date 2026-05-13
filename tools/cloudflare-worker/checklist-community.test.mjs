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
    async list({ prefix = "", limit = 1000 } = {}) {
      const keys = [...store.keys()]
        .filter(key => key.startsWith(prefix))
        .sort()
        .slice(0, limit)
        .map(name => ({ name }));
      return { keys };
    }
  };
}

function makeChecklist(title = "Runup Flow") {
  return {
    id: "community-runup-flow",
    title,
    chapters: [
      {
        id: "before-taxi",
        title: "Before Taxi",
        items: [
          { id: "brakes", text: "Brakes checked" },
          { id: "instruments", text: "Instruments set" }
        ]
      }
    ]
  };
}

async function call(env, path, options = {}) {
  const response = await worker.fetch(new Request(`https://example.test${path}`, options), env, {});
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  return { response, body };
}

const kv = makeKv({
  pilotA: JSON.stringify({ pin: "1111", profile: { name: "A" } }),
  pilotB: JSON.stringify({ pin: "2222", profile: { name: "B" } })
});
const env = { GA_SYNC_KV: kv };

const publish = await call(env, "/api/checklists/community", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-Pilot-ID": "pilotA",
    "X-Pilot-PIN": "1111"
  },
  body: JSON.stringify({ action: "publish", checklist: makeChecklist() })
});
assert.equal(publish.response.status, 200);
assert.equal(publish.body.ok, true);

const list = await call(env, "/api/checklists/community");
assert.equal(list.response.status, 200);
assert.equal(list.body.items.length, 1);
assert.equal(list.body.items[0].id, "community-runup-flow");
assert.equal("pin" in list.body.items[0], false);

const detail = await call(env, "/api/checklists/community/community-runup-flow");
assert.equal(detail.response.status, 200);
assert.equal(detail.body.checklist.chapters[0].items.length, 2);
assert.equal("pin" in detail.body.checklist, false);
assert.equal(JSON.stringify([...kv.store.values()]).includes("1111"), true, "profile seed contains the PIN");
const communityValues = [...kv.store.entries()]
  .filter(([key]) => key.startsWith("checklist:community:"))
  .map(([, value]) => value)
  .join("\n");
assert.equal(communityValues.includes("1111"), false);

const wrongPin = await call(env, "/api/checklists/community", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-Pilot-ID": "pilotA",
    "X-Pilot-PIN": "9999"
  },
  body: JSON.stringify({ action: "publish", checklist: makeChecklist("Changed") })
});
assert.equal(wrongPin.response.status, 401);

const wrongOwner = await call(env, "/api/checklists/community", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-Pilot-ID": "pilotB",
    "X-Pilot-PIN": "2222"
  },
  body: JSON.stringify({ action: "publish", checklist: makeChecklist("Hijack") })
});
assert.equal(wrongOwner.response.status, 403);

const update = await call(env, "/api/checklists/community", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-Pilot-ID": "pilotA",
    "X-Pilot-PIN": "1111"
  },
  body: JSON.stringify({ action: "publish", checklist: makeChecklist("Runup Flow Updated") })
});
assert.equal(update.response.status, 200);
assert.equal(update.body.version, 2);

const unpublishWrongOwner = await call(env, "/api/checklists/community", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-Pilot-ID": "pilotB",
    "X-Pilot-PIN": "2222"
  },
  body: JSON.stringify({ action: "unpublish", id: "community-runup-flow" })
});
assert.equal(unpublishWrongOwner.response.status, 403);

const unpublish = await call(env, "/api/checklists/community", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-Pilot-ID": "pilotA",
    "X-Pilot-PIN": "1111"
  },
  body: JSON.stringify({ action: "unpublish", id: "community-runup-flow" })
});
assert.equal(unpublish.response.status, 200);
assert.equal(unpublish.body.unpublished, true);

const goneDetail = await call(env, "/api/checklists/community/community-runup-flow");
assert.equal(goneDetail.response.status, 404);

const emptyList = await call(env, "/api/checklists/community");
assert.equal(emptyList.body.items.length, 0);

console.log("checklist community worker tests passed");
