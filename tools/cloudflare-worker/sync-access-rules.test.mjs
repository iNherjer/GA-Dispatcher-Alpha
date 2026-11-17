// Access rules of the legacy /api/sync/ route: reserved keys in other letter case,
// checklist keys (CHK_/CHKIDX_) and crew group write transitions.
import { test } from "node:test";
import assert from "node:assert/strict";
import worker from "./worker-merged-full.js";

const DAY = 24 * 60 * 60 * 1000;

function makeKv(seed = {}) {
  const store = new Map(Object.entries(seed).map(([key, value]) => [key, typeof value === "string" ? value : JSON.stringify(value)]));
  const counts = { list: 0 };
  return {
    store,
    counts,
    async get(key) { return store.has(key) ? store.get(key) : null; },
    async put(key, value) { store.set(key, value); },
    async delete(key) { store.delete(key); },
    async list({ prefix = "", limit = 1000 } = {}) {
      counts.list++;
      const keys = [...store.keys()].filter(key => key.startsWith(prefix)).sort().slice(0, limit);
      return { keys: keys.map(name => ({ name })), list_complete: true, cursor: "" };
    }
  };
}

async function call(env, path, options = {}) {
  const response = await worker.fetch(new Request(`https://example.test${path}`, options), env, {});
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { status: response.status, body, response };
}

const read = (kv, key) => JSON.parse(kv.store.get(key));

// ---------------------------------------------------------------- reserved keys
test("reserved keys in another letter case are never pilot IDs and never creatable", async () => {
  const group = { members: [{ syncId: "ALICE", nick: "Alice", isAdmin: true, lastSeen: Date.now() }], notes: [{ id: 1, text: "keep" }], kicked: [] };
  const kv = makeKv({
    ALICE: { pin: "1111" },
    GROUP_EDTK: group,
    AUDIO_SETTINGS_ALICE: { schema: "ga.audio-control.v1", revision: 3 }
  });
  const env = { GA_SYNC_KV: kv };
  const before = new Map(kv.store);
  for (const id of ["group_edtk", "Group_EDTK", "gRoUp_EDTK", "ＧＲＯＵＰ_EDTK", "audio_settings_alice", "Audio_Settings_ALICE",
    "chk_alice_x", "Chkidx_ALICE", "BUG:report:1", "HOMEBASE:ALICE", "PILOTIDX:alice", "Checklist:Community:x"]) {
    const post = await call(env, `/api/sync/${encodeURIComponent(id)}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pin: "0000", members: [] })
    });
    assert.equal(post.status, 400, id);
    assert.equal(post.body.code, "invalid_pilot_id", id);
    const get = await call(env, `/api/sync/${encodeURIComponent(id)}?pin=0000`);
    assert.equal(get.status, 400, id);
    const login = await call(env, "/api/auth/verify", { method: "POST", body: JSON.stringify({ pilotId: id, pin: "0000" }) });
    assert.equal(login.status, 400, id);
  }
  assert.deepEqual(new Map(kv.store), before, "nothing written, no pilotidx: entry");
  // The exact group key still uses the group path.
  const member = await call(env, "/api/sync/GROUP_EDTK", { headers: { "X-Pilot-ID": "ALICE", "X-Pilot-PIN": "1111" } });
  assert.equal(member.status, 200);
  assert.equal(member.body.notes[0].text, "keep");
  // Normal registration keeps working.
  const register = await call(env, "/api/sync/NewPilot", { method: "POST", body: JSON.stringify({ pin: "9999", flights: [] }) });
  assert.equal(register.status, 200);
  assert.equal(register.body.pilotId, "NEWPILOT");
});

test("a pilotidx: entry can never resolve to a reserved key", async () => {
  const kv = makeKv({
    GROUP_EDTK: { members: [], notes: [{ id: 1, text: "secret" }], pin: "1234" },
    AUDIO_SETTINGS_ALICE: { pin: "1234" },
    // Entries an earlier bypass may have written.
    "pilotidx:group_edtk": "GROUP_EDTK",
    "pilotidx:evil": "GROUP_EDTK",
    "pilotidx:evil2": "AUDIO_SETTINGS_ALICE"
  });
  const env = { GA_SYNC_KV: kv };
  assert.equal((await call(env, "/api/sync/group_edtk?pin=1234")).status, 400);
  for (const id of ["evil", "EVIL", "evil2"]) {
    const get = await call(env, `/api/sync/${id}?pin=1234`);
    assert.equal(get.status, 404, id);
    const login = await call(env, "/api/auth/verify", { method: "POST", body: JSON.stringify({ pilotId: id, pin: "1234" }) });
    assert.equal(login.status, 404, id);
  }
  const head = await call(env, "/api/homebase/evil", { headers: { "X-Pilot-ID": "evil", "X-Pilot-PIN": "1234" } });
  assert.equal(head.status, 401);
});

// ---------------------------------------------------------------- checklist keys
function checklistFixture() {
  const kv = makeKv({
    ALICE: { pin: "1111" },
    BOB: { pin: "2222" },
    JOHN: { pin: "3333" },
    JOHN_D: { pin: "4444" },
    "PILOT 7": { pin: "5555" },
    "pilotidx:pilot 7": "PILOT 7",
    CHKIDX_ALICE: { kind: "checklist-index-v1", syncId: "ALICE", entries: [{ id: "custom_1" }], pin: "1111" },
    CHK_ALICE_custom_1: { kind: "checklist-v1", checklist: { id: "custom_1", title: "Alice" }, pin: "1111" },
    CHK_JOHN_custom_x: { kind: "checklist-v1", checklist: { id: "custom_x", title: "John" }, pin: "3333" },
    CHK_JOHN_D_custom_y: { kind: "checklist-v1", checklist: { id: "custom_y", title: "John D" }, pin: "4444" },
    CHKIDX_PILOT_207: { kind: "checklist-index-v1", syncId: "PILOT 7", entries: [], pin: "5555" },
    CHK_ALICE_nopin: { kind: "checklist-v1", checklist: { id: "nopin", title: "stored without pin" } }
  });
  return { kv, env: { GA_SYNC_KV: kv } };
}
// Request shapes of checklists.js (kvFetch/kvPut) and tracker-efb-checklist-cloud.js (getJson).
const webGet = (env, key, pin) => call(env, `/api/sync/${encodeURIComponent(key)}?pin=${encodeURIComponent(pin)}`, { headers: { "X-Pilot-PIN": pin } });
const webPut = (env, key, payload, pin) => call(env, `/api/sync/${encodeURIComponent(key)}?pin=${encodeURIComponent(pin)}`, {
  method: "POST", headers: { "Content-Type": "application/json", "X-Pilot-PIN": pin }, body: JSON.stringify({ ...payload, pin })
});
const trackerGet = (env, key, pin) => call(env, `/api/sync/${encodeURIComponent(key)}?pin=${encodeURIComponent(pin)}`, { headers: { Accept: "application/json", "X-Pilot-PIN": pin } });

test("checklist keys: existing web and tracker request shapes pass with the owner's PIN", async () => {
  const { kv, env } = checklistFixture();
  const index = await webGet(env, "CHKIDX_ALICE", "1111");
  assert.equal(index.status, 200);
  assert.equal(index.body.entries[0].id, "custom_1");
  assert.equal((await trackerGet(env, "CHK_ALICE_custom_1", "1111")).body.checklist.title, "Alice");
  assert.equal((await trackerGet(env, "CHKIDX_ALICE", "1111")).status, 200);
  // Missing keys stay 404 for the owner, without a KV list.
  assert.equal((await trackerGet(env, "CHK_ALICE_custom_missing", "1111")).status, 404);
  assert.equal((await webGet(env, "CHKIDX_BOB", "2222")).status, 404);
  const saved = await webPut(env, "CHKIDX_ALICE", { kind: "checklist-index-v1", syncId: "ALICE", entries: [{ id: "custom_1" }, { id: "custom_2" }], lastModified: 1 }, "1111");
  assert.equal(saved.status, 200);
  assert.deepEqual(saved.body, { success: true, pilotId: "CHKIDX_ALICE" });
  assert.equal(read(kv, "CHKIDX_ALICE").entries.length, 2);
  // Encoded IDs (encodeURIComponent, "%" -> "_") resolve to the account.
  assert.equal((await trackerGet(env, "CHKIDX_PILOT_207", "5555")).status, 200);
  assert.equal(kv.counts.list, 0);
});

test("checklist keys: no PIN, a wrong PIN or another pilot's PIN never reads or writes", async () => {
  const { kv, env } = checklistFixture();
  const before = kv.store.get("CHK_ALICE_custom_1");
  assert.equal((await call(env, "/api/sync/CHK_ALICE_custom_1")).status, 401);
  assert.equal((await call(env, "/api/sync/CHK_ALICE_nopin")).status, 401, "a record without stored pin is no longer open");
  assert.equal((await webGet(env, "CHK_ALICE_custom_1", "0000")).status, 401);
  assert.equal((await webGet(env, "CHK_ALICE_custom_1", "2222")).status, 401, "BOB's own PIN");
  for (const headers of [{}, { "X-Pilot-PIN": "2222" }, { "X-Pilot-ID": "BOB", "X-Pilot-PIN": "2222" }]) {
    const write = await call(env, "/api/sync/CHK_ALICE_custom_1", { method: "POST", headers, body: JSON.stringify({ kind: "checklist-v1", checklist: { id: "custom_1", title: "owned" } }) });
    assert.equal(write.status, 401);
  }
  assert.equal((await call(env, "/api/sync/CHK_ALICE_new?pin=2222", { method: "POST", body: JSON.stringify({ pin: "2222" }) })).status, 401, "cannot create keys of another pilot");
  assert.equal(kv.store.get("CHK_ALICE_custom_1"), before);
  assert.equal(kv.store.has("CHK_ALICE_NEW"), false);
  // Unknown owner.
  assert.equal((await webGet(env, "CHK_NOBODY_custom_1", "1111")).status, 401);
});

test("checklist keys: a new checklist is stored under the exact key and reads back", async () => {
  const { kv, env } = checklistFixture();
  const listed = kv.counts.list;
  const saved = await webPut(env, "CHK_ALICE_custom_new", { kind: "checklist-v1", checklist: { id: "custom_new", title: "Neu" }, lastModified: 5 }, "1111");
  assert.equal(saved.status, 200);
  assert.deepEqual(saved.body, { success: true, pilotId: "CHK_ALICE_custom_new" });
  assert.equal(kv.store.has("CHK_ALICE_CUSTOM_NEW"), false, "no upper-cased account-style copy");
  const stored = read(kv, "CHK_ALICE_custom_new");
  assert.deepEqual(stored, { kind: "checklist-v1", checklist: { id: "custom_new", title: "Neu" }, lastModified: 5 }, "no PIN, no account fields");
  const back = await trackerGet(env, "CHK_ALICE_custom_new", "1111");
  assert.equal(back.status, 200);
  assert.equal(back.body.checklist.title, "Neu");
  // Overwrite keeps the exact key.
  await webPut(env, "CHK_ALICE_custom_new", { kind: "checklist-v1", checklist: { id: "custom_new", title: "Neu 2" } }, "1111");
  assert.equal((await webGet(env, "CHK_ALICE_custom_new", "1111")).body.checklist.title, "Neu 2");
  assert.equal(kv.counts.list, listed);
});

test("checklist keys: copies stored upper-cased before 17.11.2026 are still found, PIN never returned", async () => {
  const { kv, env } = checklistFixture();
  kv.store.set("CHK_ALICE_CUSTOM_OLD", JSON.stringify({ kind: "checklist-v1", checklist: { id: "custom_old", title: "Alt" }, pin: "1111", syncId: "CHK_ALICE_CUSTOM_OLD" }));
  const legacy = await webGet(env, "CHK_ALICE_custom_old", "1111");
  assert.equal(legacy.status, 200);
  assert.equal(legacy.body.checklist.title, "Alt");
  assert.equal(Object.hasOwn(legacy.body, "pin"), false);
  assert.equal(Object.hasOwn((await webGet(env, "CHK_ALICE_custom_1", "1111")).body, "pin"), false);
  // The fallback is behind the same owner check.
  assert.equal((await webGet(env, "CHK_ALICE_custom_old", "2222")).status, 401);
  assert.equal((await call(env, "/api/sync/CHK_ALICE_custom_old")).status, 401);
});

test("checklist keys: the owner is found safely when pilot IDs contain underscores", async () => {
  const { kv, env } = checklistFixture();
  assert.equal((await webGet(env, "CHK_JOHN_custom_x", "3333")).status, 200);
  assert.equal((await webGet(env, "CHK_JOHN_D_custom_y", "4444")).status, 200);
  assert.equal((await webGet(env, "CHK_JOHN_D_custom_y", "3333")).status, 401, "JOHN cannot read JOHN_D's checklist");
  // A later account "JOHN_CUSTOM" (registration is always upper case) cannot claim JOHN's key.
  assert.equal((await call(env, "/api/sync/john_custom", { method: "POST", body: JSON.stringify({ pin: "6666" }) })).body.pilotId, "JOHN_CUSTOM");
  assert.equal((await webGet(env, "CHK_JOHN_custom_x", "6666")).status, 401);
  assert.equal((await webGet(env, "CHK_JOHN_custom_x", "3333")).status, 200);
  // The owner can overwrite a record someone else created with another stored pin.
  kv.store.set("CHK_ALICE_poisoned", JSON.stringify({ kind: "checklist-v1", pin: "9999" }));
  assert.equal((await webPut(env, "CHK_ALICE_poisoned", { kind: "checklist-v1", checklist: { id: "poisoned" } }, "1111")).status, 200);
});

// ---------------------------------------------------------------- crew groups
const now = Date.now();
function crewFixture(extraMembers = []) {
  const members = [
    { syncId: "ADMIN", nick: "Chef", isAdmin: true, lastSeen: now - 5 * DAY },
    { syncId: "BOB", nick: "Bob", isAdmin: false, lastSeen: now - 2 * DAY },
    { syncId: "CARL", nick: "Carl", isAdmin: false, lastSeen: now - 1 * DAY },
    ...extraMembers
  ];
  const seed = {
    GROUP_EDTK: { members, notes: [{ id: 1, author: "Chef", text: "Briefing 10 Uhr" }, { id: 2, author: "Bob", text: "Bobs Zettel" }], kicked: ["EVE"], lastModified: now - DAY, pin: "1000", syncId: "ADMIN" }
  };
  const pins = { ADMIN: "1000", BOB: "2000", CARL: "3000", DAVE: "4000", EVE: "5000" };
  for (const member of extraMembers) pins[member.syncId] = "7777";
  for (const [id, pin] of Object.entries(pins)) seed[id] = { pin };
  const kv = makeKv(seed);
  return { kv, env: { GA_SYNC_KV: kv }, pins };
}
const auth = (fixture, id) => ({ "Content-Type": "application/json", "X-Pilot-ID": id, "X-Pilot-PIN": fixture.pins[id] });
const getGroup = (fixture, id, name = "EDTK") => call(fixture.env, `/api/sync/GROUP_${name}?pin=${fixture.pins[id]}&syncId=${id}`, { headers: auth(fixture, id) });
const postGroup = (fixture, id, data, name = "EDTK") => call(fixture.env, `/api/sync/GROUP_${name}`, { method: "POST", headers: auth(fixture, id), body: JSON.stringify(data) });

// sync.js triggerGroupSave, step for step.
async function webGroupSave(fixture, syncId, nick, localNotes = [], name = "EDTK") {
  const res = await getGroup(fixture, syncId, name);
  let latestData = { members: [], notes: [] };
  if (res.status === 200) latestData = res.body;
  let members = (latestData.members || []).filter(m => {
    const timeoutMs = m.isAdmin ? (365 * DAY) : (90 * DAY);
    return (Date.now() - m.lastSeen) < timeoutMs && m.syncId !== syncId;
  });
  let amIAdmin = false;
  const existingMe = (latestData.members || []).find(m => m.syncId === syncId);
  if (existingMe && existingMe.isAdmin) amIAdmin = true;
  if (members.length === 0) amIAdmin = true;
  members.push({ nick, syncId, lastSeen: Date.now(), isAdmin: amIAdmin });
  if (members.length > 10) {
    members.sort((a, b) => b.lastSeen - a.lastSeen);
    members = members.slice(0, 10);
  }
  const cloudNotes = latestData.notes || [];
  const mergedNotes = [...localNotes.filter(n => n.author === nick), ...cloudNotes.filter(n => n.author !== nick)];
  const payload = { members, notes: mergedNotes, kicked: latestData.kicked || [], lastModified: Date.now(), pin: fixture.pins[syncId], syncId };
  return postGroup(fixture, syncId, payload, name);
}
// board.js removeSelfFromGroup.
async function webLeave(fixture, syncId) {
  const data = (await getGroup(fixture, syncId)).body;
  const me = data.members.find(m => m.syncId === syncId);
  data.members = data.members.filter(m => m.syncId !== syncId);
  if (me && me.isAdmin && data.members.length > 0) {
    data.members.sort((a, b) => a.lastSeen - b.lastSeen);
    data.members[0].isAdmin = true;
  }
  data.lastModified = Date.now();
  return postGroup(fixture, syncId, data);
}
// board.js kickGroupUser.
async function webKick(fixture, syncId, target) {
  const data = (await getGroup(fixture, syncId)).body;
  data.members = (data.members || []).filter(m => m.syncId !== target);
  data.kicked = data.kicked || [];
  data.kicked.push(target);
  data.lastModified = Date.now();
  return postGroup(fixture, syncId, data);
}

test("crew: a stranger can read with the group code and join, but cannot take over", async () => {
  const fixture = crewFixture();
  const read1 = await getGroup(fixture, "DAVE");
  assert.equal(read1.status, 200);
  assert.equal(read1.body.members.length, 3, "full record for non-members (join by code)");
  assert.equal(read1.body.pin, undefined, "the last writer's PIN is never returned");
  const before = fixture.kv.store.get("GROUP_EDTK");
  const attacks = [
    { ...read1.body, members: [{ syncId: "DAVE", nick: "Dave", isAdmin: true, lastSeen: now }] },
    { ...read1.body, members: [...read1.body.members, { syncId: "DAVE", nick: "Dave", isAdmin: true, lastSeen: now }] },
    { ...read1.body, members: [...read1.body.members.map(m => ({ ...m, isAdmin: false })), { syncId: "DAVE", nick: "Dave", lastSeen: now }] },
    { ...read1.body, members: [...read1.body.members, { syncId: "DAVE", nick: "Dave", lastSeen: now }], kicked: [] },
    { ...read1.body, members: [...read1.body.members, { syncId: "DAVE", nick: "Dave", lastSeen: now }], notes: [] },
    { ...read1.body, members: [...read1.body.members.filter(m => m.syncId !== "CARL"), { syncId: "DAVE", nick: "Dave", lastSeen: now }] },
    { ...read1.body, members: [...read1.body.members, { syncId: "DAVE", nick: "Dave", lastSeen: now }, { syncId: "ZED", nick: "Zed", lastSeen: now }] },
    { ...read1.body, notes: [] },
    { members: [], notes: [], kicked: [] }
  ];
  for (const attack of attacks) {
    const res = await postGroup(fixture, "DAVE", attack);
    assert.equal(res.status, 403, JSON.stringify(attack).slice(0, 120));
    assert.equal(res.body.code, "crew_forbidden");
    assert.match(res.body.error, /Crew|Mitglied|Admin|Sperrliste|Pinnwand|eintragen/);
  }
  assert.equal(fixture.kv.store.get("GROUP_EDTK"), before);

  const join = await webGroupSave(fixture, "DAVE", "Dave", [{ id: 99, author: "Dave", text: "Hallo Crew" }]);
  assert.equal(join.status, 200);
  assert.deepEqual(join.body, { success: true, pilotId: "GROUP_EDTK" });
  const stored = read(fixture.kv, "GROUP_EDTK");
  assert.equal(stored.pin, undefined, "PIN is not stored");
  assert.equal(stored.members.find(m => m.syncId === "DAVE").isAdmin, false);
  assert.equal(stored.members.find(m => m.syncId === "ADMIN").isAdmin, true);
  assert.deepEqual(stored.notes.map(n => n.id).sort(), [1, 2, 99]);
});

test("crew: creating a new group, and reviving one without active members", async () => {
  const fixture = crewFixture();
  const created = await webGroupSave(fixture, "DAVE", "Dave", [], "NEWCREW");
  assert.equal(created.status, 200);
  assert.equal(read(fixture.kv, "GROUP_NEWCREW").members[0].isAdmin, true);
  fixture.kv.store.set("GROUP_OLD", JSON.stringify({ members: [{ syncId: "BOB", nick: "Bob", lastSeen: now - 120 * DAY }], notes: [], kicked: [] }));
  const revived = await webGroupSave(fixture, "DAVE", "Dave", [], "OLD");
  assert.equal(revived.status, 200);
  assert.deepEqual(read(fixture.kv, "GROUP_OLD").members.map(m => [m.syncId, m.isAdmin]), [["DAVE", true]]);
});

test("crew: non-admin members cannot kick or promote, but edit the board and prune inactive members", async () => {
  const fixture = crewFixture([{ syncId: "OLDIE", nick: "Oldie", lastSeen: now - 100 * DAY }]);
  assert.equal((await webKick(fixture, "BOB", "CARL")).status, 403);
  const data = (await getGroup(fixture, "BOB")).body;
  assert.equal((await postGroup(fixture, "BOB", { ...data, members: data.members.map(m => m.syncId === "BOB" ? { ...m, isAdmin: true } : m) })).status, 403);
  assert.equal((await postGroup(fixture, "BOB", { ...data, members: data.members.map(m => m.syncId === "CARL" ? { ...m, isAdmin: true } : m) })).status, 403);
  assert.equal((await postGroup(fixture, "BOB", { ...data, members: data.members.map(m => m.syncId === "ADMIN" ? { ...m, isAdmin: false } : m) })).status, 403);
  assert.equal((await postGroup(fixture, "BOB", { ...data, kicked: [] })).status, 403);
  assert.equal((await postGroup(fixture, "BOB", { ...data, members: data.members.filter(m => m.syncId !== "CARL") })).status, 403);

  // forceGroupSync-style save with changed notes: own note edited, Bob's old note removed, inactive member pruned.
  const res = await webGroupSave(fixture, "BOB", "Bob", [{ id: 3, author: "Bob", text: "Neuer Zettel" }]);
  assert.equal(res.status, 200);
  const stored = read(fixture.kv, "GROUP_EDTK");
  assert.deepEqual(stored.members.map(m => m.syncId).sort(), ["ADMIN", "BOB", "CARL"]);
  assert.deepEqual(stored.notes.map(n => n.id).sort(), [1, 3]);
  assert.deepEqual(stored.kicked, ["EVE"]);
  // A member may also edit or delete other notes on the shared board, as before.
  const after = (await getGroup(fixture, "CARL")).body;
  assert.equal((await postGroup(fixture, "CARL", { ...after, notes: [] })).status, 200);
  // Leaving as a non-admin.
  assert.equal((await webLeave(fixture, "CARL")).status, 200);
  assert.equal(read(fixture.kv, "GROUP_EDTK").members.some(m => m.syncId === "CARL"), false);
});

test("crew: a member left alone after all others went inactive becomes admin, as the web client does", async () => {
  const fixture = crewFixture();
  const group = read(fixture.kv, "GROUP_EDTK");
  group.members = group.members.map(m => m.syncId === "BOB" ? m : { ...m, lastSeen: now - 400 * DAY });
  fixture.kv.store.set("GROUP_EDTK", JSON.stringify(group));
  assert.equal((await webGroupSave(fixture, "BOB", "Bob")).status, 200);
  assert.deepEqual(read(fixture.kv, "GROUP_EDTK").members.map(m => [m.syncId, m.isAdmin]), [["BOB", true]]);
});

test("crew: a full crew drops the least recently seen member on join, nobody else", async () => {
  const extra = Array.from({ length: 7 }, (_, i) => ({ syncId: `P${i}`, nick: `P${i}`, lastSeen: now - (10 + i) * DAY }));
  const fixture = crewFixture(extra);
  const data = (await getGroup(fixture, "DAVE")).body;
  assert.equal(data.members.length, 10);
  // Dropping someone else than the least recently seen is refused.
  const wrongDrop = { ...data, members: [...data.members.filter(m => m.syncId !== "CARL"), { syncId: "DAVE", nick: "Dave", lastSeen: now }] };
  assert.equal((await postGroup(fixture, "DAVE", wrongDrop)).status, 403);
  const join = await webGroupSave(fixture, "DAVE", "Dave");
  assert.equal(join.status, 200);
  const ids = read(fixture.kv, "GROUP_EDTK").members.map(m => m.syncId);
  assert.equal(ids.length, 10);
  assert.equal(ids.includes("P6"), false);
  assert.equal(ids.includes("DAVE"), true);
});

test("crew: admins kick and hand over admin on leave; kicked pilots are blocked", async () => {
  const fixture = crewFixture();
  assert.equal((await webKick(fixture, "ADMIN", "CARL")).status, 200);
  let stored = read(fixture.kv, "GROUP_EDTK");
  assert.deepEqual(stored.kicked.sort(), ["CARL", "EVE"]);
  // Kicked pilots get only the kick notice the clients evaluate, and cannot write.
  for (const id of ["CARL", "EVE"]) {
    const res = await getGroup(fixture, id);
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.members, []);
    assert.deepEqual(res.body.notes, []);
    assert.deepEqual(res.body.kicked, [id]);
    assert.ok(res.body.lastModified > 0);
    assert.equal((await webGroupSave(fixture, id, id)).status, 403);
    assert.equal((await postGroup(fixture, id, { members: [{ syncId: id, nick: id, isAdmin: true, lastSeen: now }], notes: [], kicked: [] })).status, 403);
  }
  assert.equal((await webLeave(fixture, "ADMIN")).status, 200);
  stored = read(fixture.kv, "GROUP_EDTK");
  assert.deepEqual(stored.members.map(m => [m.syncId, m.isAdmin]), [["BOB", true]]);
  // The new admin may now kick and change roles.
  assert.equal((await webGroupSave(fixture, "DAVE", "Dave")).status, 200);
  const data = (await getGroup(fixture, "BOB")).body;
  assert.equal((await postGroup(fixture, "BOB", { ...data, members: data.members.map(m => ({ ...m, isAdmin: true })) })).status, 200);
});

test("crew: case-insensitive caller IDs and other clients' volatile fields never cause a rejection", async () => {
  const fixture = crewFixture();
  const group = read(fixture.kv, "GROUP_EDTK");
  group.members = group.members.map(m => m.syncId === "BOB" ? { ...m, syncId: "bob" } : m);
  fixture.kv.store.set("GROUP_EDTK", JSON.stringify(group));
  const data = (await getGroup(fixture, "BOB")).body;
  const res = await postGroup(fixture, "BOB", { ...data, lastModified: Date.now(), members: data.members.map(m => ({ ...m, lastSeen: Date.now() })), syncId: "BOB", pin: "2000" });
  assert.equal(res.status, 200);
});
