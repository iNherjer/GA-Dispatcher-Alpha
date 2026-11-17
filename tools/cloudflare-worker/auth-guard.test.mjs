import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import worker from "./worker-merged-full.js";
import { AuthGuard, resetAuthGuardMemory, setAuthGuardClock } from "./auth-guard.mjs";

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

function makeKv(seed = {}) {
  const store = new Map(Object.entries(seed).map(([key, value]) => [key, JSON.stringify(value)]));
  return {
    store,
    async get(key) { return store.has(key) ? store.get(key) : null; },
    async put(key, value) { store.set(key, value); },
    async delete(key) { store.delete(key); },
    async list({ prefix = "" } = {}) {
      return { keys: [...store.keys()].filter(key => key.startsWith(prefix)).map(name => ({ name })), list_complete: true, cursor: "" };
    }
  };
}

function storage() {
  const records = new Map();
  const counts = { put: 0 };
  return {
    records,
    counts,
    async get(key) { return records.has(key) ? structuredClone(records.get(key)) : undefined; },
    async put(key, value) { counts.put++; records.set(key, structuredClone(value)); }
  };
}

let time = Date.UTC(2026, 10, 17, 12);
function fixture() {
  const guards = new Map();
  const calls = { fetch: 0, get: 0 };
  const namespace = {
    idFromName: name => name,
    get(name) {
      calls.get++;
      if (!guards.has(name)) {
        const guard = new AuthGuard({ storage: storage() });
        guard.now = () => time;
        guards.set(name, guard);
      }
      return { fetch: request => { calls.fetch++; return guards.get(name).fetch(request); } };
    }
  };
  const kv = makeKv({ ALICE: { pin: "1111" }, BOB: { pin: "2222" }, CHKIDX_ALICE: { entries: [], pin: "1111" } });
  return { guards, calls, kv, env: { GA_SYNC_KV: kv, GA_AUTH_GUARD: namespace } };
}

async function login(env, pin, ip, pilotId = "ALICE") {
  const headers = { "Content-Type": "application/json" };
  if (ip) headers["CF-Connecting-IP"] = ip;
  const response = await worker.fetch(new Request("https://example.test/api/auth/verify", { method: "POST", headers, body: JSON.stringify({ pilotId, pin }) }), env, {});
  return { status: response.status, body: await response.json(), retryAfter: response.headers.get("Retry-After") };
}
const fetchAs = (env, path, ip, init = {}) => worker.fetch(new Request(`https://example.test${path}`, { ...init, headers: { "CF-Connecting-IP": ip, ...(init.headers || {}) } }), env, {});

beforeEach(() => {
  time += 30 * DAY; // every test starts after all windows of the previous one
  setAuthGuardClock(() => time);
  resetAuthGuardMemory();
});

test("the same wrong PIN repeated 50 times never locks, even across isolates", async () => {
  const f = fixture();
  for (let i = 0; i < 50; i++) {
    if (i % 10 === 0) resetAuthGuardMemory(); // other isolate: the Durable Object still sees one distinct PIN
    const res = await login(f.env, "0000", "10.0.0.1");
    assert.equal(res.status, 401);
    assert.equal(res.body.code, "pin_invalid");
  }
  assert.ok(f.calls.fetch <= 6, `memory cache saves Durable Object calls (${f.calls.fetch})`);
  assert.equal((await login(f.env, "1111", "10.0.0.1")).status, 200);
});

test("5 distinct wrong PINs lock that IP for this pilot (correct PIN too); other IPs and pilots stay usable", async () => {
  const f = fixture();
  const statuses = [];
  for (const pin of ["0001", "0002", "0003", "0004", "0005"]) statuses.push((await login(f.env, pin, "10.0.0.2")).status);
  assert.deepEqual(statuses, [401, 401, 401, 401, 429]);
  for (const pin of ["1111", "0006", "0001"]) {
    const locked = await login(f.env, pin, "10.0.0.2");
    assert.equal(locked.status, 429, pin);
    assert.equal(locked.body.ok, false);
    assert.equal(locked.body.code, "too_many_attempts");
    assert.match(locked.body.error, /Zu viele falsche PIN-Versuche.*15 Minuten/);
    assert.equal(locked.body.retryAfterSeconds, 15 * 60);
    assert.equal(locked.retryAfter, String(15 * 60));
  }
  resetAuthGuardMemory(); // the lock lives in the Durable Object, not only in this isolate
  assert.equal((await login(f.env, "1111", "10.0.0.2")).status, 429);
  assert.equal((await login(f.env, "1111", "10.0.0.3")).status, 200);
  assert.equal((await login(f.env, "2222", "10.0.0.2", "BOB")).status, 200);
  // Every place that compares a pilot PIN honours the lock.
  const legacyGet = await fetchAs(f.env, "/api/sync/ALICE?pin=1111", "10.0.0.2");
  assert.equal(legacyGet.status, 429);
  const legacyPost = await fetchAs(f.env, "/api/sync/ALICE", "10.0.0.2", { method: "POST", body: JSON.stringify({ pin: "1111" }) });
  assert.equal(legacyPost.status, 429);
  const homebase = await fetchAs(f.env, "/api/homebase/ALICE", "10.0.0.2", { headers: { "X-Pilot-ID": "ALICE", "X-Pilot-PIN": "1111" } });
  assert.equal(homebase.status, 429);
  const group = await fetchAs(f.env, "/api/sync/GROUP_X", "10.0.0.2", { headers: { "X-Pilot-ID": "alice", "X-Pilot-PIN": "1111" } });
  assert.equal(group.status, 429);
  const checklist = await fetchAs(f.env, "/api/sync/CHKIDX_ALICE?pin=1111", "10.0.0.2", { headers: { "X-Pilot-PIN": "1111" } });
  assert.equal(checklist.status, 429);
  const community = await fetchAs(f.env, "/api/checklists/community", "10.0.0.2", { method: "POST", headers: { "X-Pilot-ID": "ALICE", "X-Pilot-PIN": "1111" }, body: JSON.stringify({ action: "unpublish", id: "x" }) });
  assert.equal(community.status, 429);
  // Expiry with the injected clock.
  time += 15 * MINUTE + 1000;
  assert.equal((await login(f.env, "1111", "10.0.0.2")).status, 200);
});

test("a wrong PIN on another endpoint counts for the same pilot", async () => {
  const f = fixture();
  await fetchAs(f.env, "/api/sync/ALICE?pin=0001", "10.0.0.4");
  await fetchAs(f.env, "/api/sync/CHKIDX_ALICE?pin=0002", "10.0.0.4");
  await fetchAs(f.env, "/api/homebase/ALICE", "10.0.0.4", { headers: { "X-Pilot-ID": "ALICE", "X-Pilot-PIN": "0003" } });
  await fetchAs(f.env, "/api/sync/ALICE", "10.0.0.4", { method: "POST", body: JSON.stringify({ pin: "0004" }) });
  assert.equal((await login(f.env, "0005", "10.0.0.4")).status, 429);
  assert.equal((await login(f.env, "1111", "10.0.0.4")).status, 429);
});

test("global lock after 30 distinct wrong PINs; known-good IPs keep working; doubling and decay", async () => {
  const f = fixture();
  assert.equal((await login(f.env, "1111", "192.168.1.1")).status, 200); // the real user, known-good
  const distributed = async (offset) => {
    let last = null;
    for (let i = 0; i < 30; i++) last = await login(f.env, String(2000 + offset + i), `172.16.${offset}.${Math.floor(i / 3)}`);
    return last;
  };
  const trigger = await distributed(0);
  assert.equal(trigger.status, 429);
  assert.equal(trigger.body.retryAfterSeconds, 3600);
  const fresh = await login(f.env, "1111", "203.0.113.9");
  assert.equal(fresh.status, 429, "unknown IP is locked even with the correct PIN");
  assert.match(fresh.body.error, /60 Minuten/);
  assert.equal((await login(f.env, "1111", "192.168.1.1")).status, 200, "known-good IP is exempt");
  assert.equal((await login(f.env, "2222", "203.0.113.9", "BOB")).status, 200, "other pilots unaffected");
  time += HOUR + 1000;
  resetAuthGuardMemory();
  assert.equal((await login(f.env, "1111", "203.0.113.9")).status, 200);
  time += HOUR;
  assert.equal((await distributed(100)).body.retryAfterSeconds, 2 * 3600, "second trigger doubles");
  time += 2 * HOUR + 1000;
  assert.equal((await distributed(150)).body.retryAfterSeconds, 4 * 3600);
  time += 8 * DAY;
  assert.equal((await distributed(200)).body.retryAfterSeconds, 3600, "back to 1 h after 7 quiet days");
});

test("the guard stores only short hashes and does not write on every successful login", async () => {
  const f = fixture();
  await login(f.env, "4321", "10.0.0.5");
  await login(f.env, "1111", "10.0.0.5");
  const guard = f.guards.get("alice");
  const state = await guard.storage.get("state");
  const text = JSON.stringify(state);
  assert.equal(text.includes("4321"), false);
  assert.equal(text.includes("1111"), false);
  const writes = guard.storage.counts.put;
  for (let i = 0; i < 20; i++) {
    resetAuthGuardMemory();
    assert.equal((await login(f.env, "1111", "10.0.0.5")).status, 200);
  }
  assert.equal(guard.storage.counts.put, writes, "known-good IP within a day: no storage write");
  const fetches = f.calls.fetch;
  for (let i = 0; i < 20; i++) await login(f.env, "1111", "10.0.0.5");
  assert.equal(f.calls.fetch, fetches, "remembered success skips the Durable Object");
});

test("unknown pilot IDs create no guard object and keep their status", async () => {
  const f = fixture();
  for (let i = 0; i < 10; i++) assert.equal((await login(f.env, String(i), "10.0.0.6", `NOBODY${i}`)).status, 404);
  const head = await fetchAs(f.env, "/api/homebase/NOBODY", "10.0.0.6", { headers: { "X-Pilot-ID": "NOBODY", "X-Pilot-PIN": "1" } });
  assert.equal(head.status, 401);
  assert.equal(f.calls.get, 0);
});

test("fail open: without binding or with a failing guard the plain PIN check decides", async () => {
  const kv = makeKv({ ALICE: { pin: "1111" } });
  const plain = { GA_SYNC_KV: kv };
  for (let i = 0; i < 40; i++) assert.equal((await login(plain, String(5000 + i), "10.0.0.7")).status, 401);
  assert.equal((await login(plain, "1111", "10.0.0.7")).status, 200);
  const broken = { GA_SYNC_KV: kv, GA_AUTH_GUARD: { idFromName: name => name, get: () => ({ fetch: async () => { throw new Error("down"); } }) } };
  for (let i = 0; i < 10; i++) assert.equal((await login(broken, String(6000 + i), "10.0.0.7")).status, 401);
  assert.equal((await login(broken, "1111", "10.0.0.7")).status, 200);
  const failing = { GA_SYNC_KV: kv, GA_AUTH_GUARD: { idFromName: name => name, get: () => ({ fetch: async () => new Response("x", { status: 500 }) }) } };
  assert.equal((await login(failing, "1111", "10.0.0.7")).status, 200);
  assert.equal((await login(failing, "0000", "10.0.0.7")).status, 401);
});
