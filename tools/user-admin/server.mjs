import { execFile } from "node:child_process";
import { createServer } from "node:http";
import { readFile, writeFile, mkdir, mkdtemp, rm } from "node:fs/promises";
import { randomBytes, createHmac } from "node:crypto";
import path from "node:path";
import { networkInterfaces, homedir, tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { sortUsers, usageSummary } from "./user-list-core.mjs";
import { createAccountRenamer, RenameError } from "./account-rename.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const workerDir = path.join(repoRoot, "tools/cloudflare-worker");
const namespaceId = "359fbc81dd0548bbba7e27eba4e513c5";
const maxBodyBytes = 64 * 1024;
const ttlSeconds = 180 * 24 * 60 * 60;
const editSecret = randomBytes(32);
const editVersion = raw => createHmac("sha256", editSecret).update(raw).digest("hex");
const backupDir = path.join(homedir(), "Library/Application Support/GA User Admin/backups");
class AdminError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

async function backupUser(id, raw, expiration) {
  await mkdir(backupDir, { recursive: true, mode: 0o700 });
  const backupId = `${Date.now()}-${randomBytes(8).toString("hex")}`;
  await writeFile(path.join(backupDir, `${backupId}.json`), JSON.stringify({ id, savedAt:new Date().toISOString(), expiration:expiration || null, raw }), { mode:0o600, flag:"wx" });
  return backupId;
}

async function kvPut(key, raw, expiration) {
  const dir = await mkdtemp(path.join(tmpdir(), "ga-user-admin-"));
  try {
    const file = path.join(dir, "record.json");
    await writeFile(file, raw, { mode:0o600 });
    const args = ["kv", "key", "put", key, "--path", file, "--namespace-id", namespaceId, "--remote"];
    if (Number.isFinite(expiration) && expiration > 0) args.push("--expiration", String(expiration));
    await runWrangler(args);
  } finally { await rm(dir, { recursive:true, force:true }); }
}

function runWrangler(args) {
  return new Promise((resolve, reject) => {
    execFile("npx", ["wrangler", ...args], {
      cwd: workerDir,
      encoding: "utf8",
      timeout: 60000,
      maxBuffer: 10 * 1024 * 1024
    }, (error, stdout, stderr) => {
      if (error) {
        error.stderr = stderr;
        reject(error);
        return;
      }
      resolve(stdout);
    });
  });
}

async function kvList(prefix = "") {
  const args = ["kv", "key", "list", "--namespace-id", namespaceId, "--remote"];
  if (prefix) args.push("--prefix", prefix);
  const raw = await runWrangler(args);
  return JSON.parse(raw || "[]");
}

async function kvGet(key) {
  return runWrangler(["kv", "key", "get", key, "--namespace-id", namespaceId, "--remote"]);
}

async function kvDelete(key) {
  return runWrangler(["kv", "key", "delete", key, "--namespace-id", namespaceId, "--remote"]);
}

function parseDateMs(value) {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return value < 10000000000 ? value * 1000 : value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Date.parse(value.trim());
    if (Number.isFinite(parsed)) return parsed;
    const numeric = Number(value);
    if (Number.isFinite(numeric) && numeric > 0) return numeric < 10000000000 ? numeric * 1000 : numeric;
  }
  return 0;
}

function isoFromMs(ms) {
  return Number.isFinite(ms) && ms > 0 ? new Date(ms).toISOString() : "";
}

function pickString(...values) {
  for (const value of values) {
    const str = String(value ?? "").replace(/\s+/g, " ").trim();
    if (str) return str.slice(0, 240);
  }
  return "";
}

function isReservedKey(name) {
  return !name
    || name.startsWith("GROUP_")
    || name.startsWith("AUDIO_SETTINGS_")
    || name.startsWith("homebase:")
    || name.startsWith("bug:")
    || name.startsWith("checklist:")
    || name.startsWith("CHK");
}

function isUserRecord(data) {
  return !!(data && typeof data === "object" && !Array.isArray(data) && data.pin !== undefined && data.accountStatus !== "renaming" && data.schema !== "ga.account-retired.v1");
}

export function projectUser(id, data) {
  const profile = data.profile && typeof data.profile === "object" ? data.profile : {};
  const registeredMs = parseDateMs(data.registeredAt)
    || parseDateMs(data.registeredAtMs)
    || parseDateMs(data.createdAt)
    || parseDateMs(data.createdAtMs)
    || parseDateMs(data.firstSeenAt)
    || parseDateMs(data.firstSeenAtMs);
  const lastModifiedMs = parseDateMs(data.lastModified)
    || parseDateMs(data.updatedAt)
    || parseDateMs(data.savedAt);
  const name = pickString(
    profile.name,
    profile.displayName,
    data.pilotName,
    data.displayName,
    data.name,
    data.groupNick,
    data.syncId,
    id
  );
  return {
    id,
    editVersion: data.__adminVersion || "",
    name: name || id,
    registeredAt: isoFromMs(registeredMs),
    registrationKnown: !!registeredMs,
    lastAppSeen: isoFromMs(parseDateMs(data.lastAppSeen)),
    lastModified: isoFromMs(lastModifiedMs),
    modifiedSource: "legacy",
    hasPinboard: Array.isArray(data.pinboard) && data.pinboard.length > 0,
    hasLogbook: Array.isArray(data.logbook) && data.logbook.length > 0,
    hasActiveMission: !!data.activeMission
  };
}

const workerBase = "https://ga-proxy.einherjer.workers.dev";

// Read only the V2 head. This endpoint does not touch the login heartbeat.
// Credentials stay in this process and are never included in a response or error.
export async function enrichUser(user, data, fetchHead = fetch) {
  const response = await fetchHead(`${workerBase}/api/sync-v2/head?inlineMetadata=1`, {
    headers: { "X-Pilot-ID": user.id, "X-Pilot-PIN": String(data.pin) },
    redirect: "error",
    signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) throw new Error(`Cloud-Metadaten HTTP ${response.status}`);
  const head = await response.json();
  if (!Number.isSafeInteger(head.revision) || head.revision < 0) throw new Error("Ungültige Cloud-Metadaten");
  if (head.revision > 0) {
    const committedMs = parseDateMs(head.committedAt);
    if (!committedMs) throw new Error("Cloud-Speicherzeit fehlt");
    user.lastModified = isoFromMs(committedMs);
    user.modifiedSource = "v2";
    user.revision = head.revision;
  }
  return user;
}

export async function listUsers(url, progress = () => {}, deps = {}) {
  const list = deps.kvList || kvList;
  const get = deps.kvGet || kvGet;
  const enrich = deps.enrichUser || enrichUser;
  const limit = Math.min(Math.max(Number.parseInt(url.searchParams.get("limit") || "1000", 10) || 1000, 1), 5000);
  progress({ message: "Nutzerschlüssel aus Cloudflare laden …", scanned: 0, count: 0 });
  const keys = (await list("")).filter(key => !isReservedKey(String(key.name || "")));
  const items = [];
  let scanned = 0;
  let skipped = 0;
  let metadataErrors = 0;
  const allUsers = [];
  for (const key of keys) {
    const id = String(key.name || "");
    progress({ message: `Profil ${id} lesen …`, scanned, total: keys.length, count: items.length });
    let data;
    try {
      const raw = await get(id);
      data = JSON.parse(raw.trim());
      if (isUserRecord(data)) data = { ...data, __adminVersion: editVersion(raw) };
    } catch {
      skipped++;
      scanned++;
      continue;
    }
    scanned++;
    if (!isUserRecord(data)) continue;
    const user = projectUser(id, data);
    allUsers.push(user);
    if (items.length >= limit) continue;
    progress({ message: `Aktuellen Cloud-Speicherstand für ${id} prüfen …`, scanned, total: keys.length, count: items.length });
    try {
      await enrich(user, data);
    } catch {
      metadataErrors++;
      // Never present a frozen legacy date as the current V2 modification time.
      user.lastModified = "";
      user.modifiedSource = "unavailable";
    }
    items.push(user);
    progress({ message: `${items.length} Nutzer geladen · ${scanned} von ${keys.length} Einträgen geprüft`, scanned, total: keys.length, count: items.length });
  }
  const summary = { ...usageSummary(allUsers), complete: skipped === 0 };
  return { ok: true, count: items.length, scanned, skipped, metadataErrors, summary, truncated: allUsers.length > items.length, items: sortUsers(items) };
}

export async function updateUser(payload, progress = () => {}, deps = {}) {
  const get = deps.kvGet || kvGet, list = deps.kvList || kvList;
  const put = deps.kvPut || kvPut, backup = deps.backupUser || backupUser;
  const id = typeof payload?.id === "string" ? payload.id : "";
  if (!id || id.length > 160 || isReservedKey(id)) throw new AdminError("Ungültige Pilot-ID.");
  const pin = typeof payload.pin === "string" ? payload.pin.trim() : "";
  if (pin.length < 4 || pin.length > 160 || /[\r\n\u0000]/.test(pin)) throw new AdminError("Die neue PIN muss 4 bis 160 Zeichen lang sein.");
  progress({ message:`Konto ${id} auf Änderungen prüfen …` });
  const keys = await list("");
  const key = keys.find(entry => entry.name === id);
  if (!key) throw new AdminError("Das Konto wurde nicht gefunden. Liste aktualisieren.",404);
  const raw = await get(id);
  let record;
  try { record = JSON.parse(raw); } catch { throw new AdminError("Kontodaten sind nicht lesbar. Es wurde nichts geändert.",409); }
  if (!isUserRecord(record)) throw new AdminError("Kein gültiges Nutzerkonto.",409);
  if (payload.expectedVersion !== editVersion(raw)) throw new AdminError("Das Konto hat sich seit dem Laden geändert. Liste aktualisieren und erneut versuchen.",409);
  if (String(record.pin) === pin) return { ok:true, changed:false, id };
  const updated = { ...record, pin };
  progress({ message:`Sicherung für ${id} erstellen …` });
  const backupId = await backup(id, raw, key.expiration);
  // KV has no atomic compare-and-swap. Recheck immediately before the write;
  // the account's apps should be closed during this short maintenance action.
  if (await get(id) !== raw) throw new AdminError("Das Konto wurde während der Vorbereitung geändert. Es wurde nichts gespeichert; Liste aktualisieren.",409);
  progress({ message:`Neue PIN für ${id} speichern …` });
  try { await put(id, JSON.stringify(updated), key.expiration); }
  catch { throw new AdminError(`Speicherung nicht bestätigt. Eine Sicherung liegt lokal vor (${backupId}). Vor einem erneuten Versuch Liste aktualisieren.`,502); }
  return { ok:true, changed:true, id, backupId, requiresLogin:true };
}

async function backupRename(data) {
  await mkdir(backupDir,{recursive:true,mode:0o700});
  const backupId=`${Date.now()}-${randomBytes(8).toString("hex")}`;
  await writeFile(path.join(backupDir,`${backupId}.json`),JSON.stringify({...data,savedAt:new Date().toISOString()}),{mode:0o600,flag:"wx"});
  return backupId;
}

async function renameCapability() {
  const response=await fetch(`${workerBase}/api/admin/capabilities`,{signal:AbortSignal.timeout(10000),redirect:"error"});
  if (!response.ok) return false;
  return (await response.json()).accountRename===1;
}

const renameAccount=createAccountRenamer({list:kvList,get:kvGet,put:kvPut,remove:kvDelete,backup:backupRename,version:editVersion,capability:renameCapability});

function createdMsFromOpenKey(name) {
  const reversed = Number(String(name || "").slice("bug:open:".length).split(":")[0]);
  if (!Number.isFinite(reversed)) return 0;
  const createdMs = 9999999999999 - reversed;
  return Number.isFinite(createdMs) && createdMs > 0 ? createdMs : 0;
}

export async function purgeBugReports(payload = {}, progress = () => {}, deps = {}) {
  const list = deps.kvList || kvList;
  const get = deps.kvGet || kvGet;
  const remove = deps.kvDelete || kvDelete;
  progress({ message: "Bugreport-Schlüssel laden …" });
  const requestedDays = Number(payload.olderThanDays ?? 30);
  const olderThanDays = Math.min(Math.max(Number.isFinite(requestedDays) ? requestedDays : 30, 0), 3650);
  const dryRun = payload.dryRun !== false;
  const limit = Math.min(Math.max(Number(payload.limit ?? 5000) || 5000, 1), 5000);
  const includeUnknown = !!payload.includeUnknown;
  const cutoffMs = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;
  const reportKeys = (await list("bug:report:")).slice(0, limit);
  const openKeys = (await list("bug:open:")).slice(0, limit);
  const keysToDelete = new Set();
  const reportIdsToDelete = new Set();
  let unknownDateReports = 0;

  let checkedReports = 0;
  for (const key of reportKeys) {
    progress({ message: `Bugreports prüfen: ${++checkedReports} von ${reportKeys.length}`, scanned: checkedReports, total: reportKeys.length });
    const keyName = String(key.name || "");
    let report = null;
    try {
      report = JSON.parse((await get(keyName)).trim());
    } catch {
      report = null;
    }
    const id = pickString(report?.id, keyName.slice("bug:report:".length));
    const createdMs = parseDateMs(report?.createdAt)
      || (Number.isFinite(Number(key.expiration)) ? (Number(key.expiration) - ttlSeconds) * 1000 : 0);
    if (!createdMs) unknownDateReports++;
    if ((createdMs && createdMs < cutoffMs) || (!createdMs && includeUnknown)) {
      keysToDelete.add(keyName);
      if (id) reportIdsToDelete.add(id);
      if (report?.openKey) keysToDelete.add(String(report.openKey));
    }
  }

  for (const key of openKeys) {
    const keyName = String(key.name || "");
    const id = keyName.split(":").pop();
    const createdMs = createdMsFromOpenKey(keyName)
      || (Number.isFinite(Number(key.expiration)) ? (Number(key.expiration) - ttlSeconds) * 1000 : 0);
    if ((id && reportIdsToDelete.has(id)) || (createdMs && createdMs < cutoffMs)) keysToDelete.add(keyName);
  }

  let deleted = 0;
  if (!dryRun) {
    for (const keyName of keysToDelete) {
      progress({ message: `KV-Einträge löschen: ${deleted} von ${keysToDelete.size}`, scanned: deleted, total: keysToDelete.size });
      await remove(keyName);
      deleted++;
    }
  }

  return {
    ok: true,
    dryRun,
    olderThanDays,
    cutoff: isoFromMs(cutoffMs),
    scannedReports: reportKeys.length,
    scannedOpenKeys: openKeys.length,
    unknownDateReports,
    matchedKeys: keysToDelete.size,
    deleted,
    truncated: reportKeys.length >= limit || openKeys.length >= limit,
    sampleKeys: Array.from(keysToDelete).slice(0, 80)
  };
}

async function readRequestJson(req) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > maxBodyBytes) throw new Error("Request body too large");
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  return raw ? JSON.parse(raw) : {};
}

function sendJson(res, data, status = 200) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  });
  res.end(JSON.stringify(data));
}

function contentType(filePath) {
  if (filePath.endsWith(".html")) return "text/html; charset=utf-8";
  if (filePath.endsWith(".css")) return "text/css; charset=utf-8";
  if (filePath.endsWith(".js") || filePath.endsWith(".mjs")) return "text/javascript; charset=utf-8";
  return "application/octet-stream";
}

async function serveStatic(req, res, url) {
  // Only the UI is public; never serve server source or local files.
  if (!["/", "/index.html", "/user-list-core.mjs"].includes(url.pathname)) {
    res.writeHead(404);
    res.end("Not found");
    return;
  }
  const filePath = path.join(__dirname, url.pathname === "/user-list-core.mjs" ? "user-list-core.mjs" : "index.html");
  try {
    const body = await readFile(filePath);
    res.writeHead(200, { "Content-Type": contentType(filePath), "Cache-Control": "no-store" });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
}

export function tailscaleAddresses(interfaces = networkInterfaces()) {
  return Object.values(interfaces).flat().filter(entry => entry.family === "IPv4" && /^100\.(?:6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(entry.address)).map(entry => entry.address);
}

const operationState = { busy: false };

export function createAdminServer({ port = 8900, hosts = ["127.0.0.1"], deps = {}, operations = operationState } = {}) {
  const rename = deps.renameAccount || renameAccount;
  return createServer(async (req, res) => {
    // Prevent other websites from driving this authenticated local proxy.
    const allowedHosts = hosts.flatMap(host => [host, ...(host === "127.0.0.1" ? ["localhost"] : [])]);
    let url;
    try {
      url = new URL(req.url || "/", `http://${req.headers.host}`);
      if (!allowedHosts.includes(url.hostname) || (port && url.port !== String(port))) throw new Error();
      if (req.headers.origin && req.headers.origin !== url.origin) throw new Error();
      if (url.pathname.startsWith("/api/") && req.headers["sec-fetch-site"] === "cross-site") throw new Error();
    } catch {
      sendJson(res, { ok: false, error: "Zugriff nur über die Tool-Adresse erlaubt." }, 403);
      return;
    }
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("Content-Security-Policy", "frame-ancestors 'none'");
    let streaming = false;
    const emit = (type, data) => {
      if (!res.destroyed) res.write(JSON.stringify({ type, ...data }) + "\n");
    };
    try {
      if (req.method === "GET" && url.pathname === "/api/admin/info") {
        sendJson(res, { ok: true, networkUrls: hosts.filter(host => host !== "127.0.0.1").map(host => `http://${host}:${port}/`) });
        return;
      }
      const users = req.method === "GET" && url.pathname === "/api/admin/users";
      const purge = req.method === "POST" && url.pathname === "/api/problem-reports/purge";
      const update = req.method === "POST" && url.pathname === "/api/admin/users/update";
      const renameUser = req.method === "POST" && url.pathname === "/api/admin/users/rename";
      if (users || purge || update || renameUser) {
        if ((purge || update || renameUser) && !String(req.headers["content-type"] || "").startsWith("application/json")) {
          sendJson(res, { ok: false, error: "JSON-Anfrage erforderlich." }, 415);
          return;
        }
        if (operations.busy) {
          sendJson(res, { ok: false, error: "Auf diesem Server läuft bereits eine Abfrage. Bitte deren Abschluss abwarten." }, 409);
          return;
        }
        operations.busy = true;
        try {
          const payload = purge || update || renameUser ? await readRequestJson(req) : null;
          streaming = url.searchParams.get("stream") === "1";
          if (streaming) {
            res.writeHead(200, { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" });
            res.flushHeaders();
          }
          const progress = streaming ? data => emit("progress", data) : () => {};
          const data = users ? await listUsers(url, progress, deps) : update ? await updateUser(payload, progress, deps) : renameUser ? await rename(payload,progress) : await purgeBugReports(payload, progress, deps);
          if (streaming) { emit("result", { data }); res.end(); }
          else sendJson(res, data);
        } finally { operations.busy = false; }
        return;
      }
      if (req.method !== "GET") { sendJson(res, { ok: false, error: "Methode nicht erlaubt" }, 405); return; }
      await serveStatic(req, res, url);
    } catch (failure) {
      // execFile errors may contain raw output. Never send credentials or records.
      const error = failure instanceof AdminError || failure instanceof RenameError ? failure.message : "Cloud-Abfrage fehlgeschlagen. Cloudflare-Anmeldung und Netzwerk prüfen; anschließend erneut versuchen.";
      if (streaming) { emit("error", { error }); res.end(); }
      else sendJson(res, { ok: false, error }, failure instanceof AdminError || failure instanceof RenameError ? failure.status : 500);
    }
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || process.argv[2] || 8900);
  const hosts = ["127.0.0.1", ...tailscaleAddresses()];
  for (const host of hosts) {
    const server = createAdminServer({ port, hosts });
    server.on("error", error => {
      console.error(`[Nutzer Admin] ${host}:${port}: ${error.code || "Start fehlgeschlagen"}`);
      if (host === "127.0.0.1") process.exit(1);
    });
    server.listen(port, host, () => console.log(`[Nutzer Admin] ${host === "127.0.0.1" ? "Lokal" : "Smartphone via Tailscale"}: http://${host}:${port}/`));
  }
  if (hosts.length === 1) console.log("[Nutzer Admin] Keine Tailscale-Adresse gefunden. Tailscale verbinden und Tool neu starten.");
}
