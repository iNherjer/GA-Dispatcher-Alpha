import { execFile } from "node:child_process";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const workerDir = path.join(repoRoot, "tools/cloudflare-worker");
const namespaceId = "359fbc81dd0548bbba7e27eba4e513c5";
const maxBodyBytes = 64 * 1024;
const ttlSeconds = 180 * 24 * 60 * 60;

function runWrangler(args) {
  return new Promise((resolve, reject) => {
    execFile("npx", ["wrangler", ...args], {
      cwd: workerDir,
      encoding: "utf8",
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
    || name.startsWith("bug:")
    || name.startsWith("checklist:")
    || name.startsWith("CHK");
}

function isUserRecord(data) {
  return !!(data && typeof data === "object" && !Array.isArray(data) && data.pin !== undefined);
}

function projectUser(id, data) {
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
    name: name || id,
    registeredAt: isoFromMs(registeredMs),
    registrationKnown: !!registeredMs,
    lastModified: isoFromMs(lastModifiedMs),
    hasPinboard: Array.isArray(data.pinboard) && data.pinboard.length > 0,
    hasLogbook: Array.isArray(data.logbook) && data.logbook.length > 0,
    hasActiveMission: !!data.activeMission
  };
}

async function listUsers(url) {
  const limit = Math.min(Math.max(Number.parseInt(url.searchParams.get("limit") || "1000", 10) || 1000, 1), 5000);
  const keys = await kvList("");
  const items = [];
  let scanned = 0;
  for (const key of keys) {
    const id = String(key.name || "");
    if (isReservedKey(id)) continue;
    scanned++;
    let data = null;
    try {
      data = JSON.parse((await kvGet(id)).trim());
    } catch {
      continue;
    }
    if (!isUserRecord(data)) continue;
    items.push(projectUser(id, data));
    if (items.length >= limit) break;
  }
  items.sort((a, b) => {
    const bDate = parseDateMs(b.registeredAt) || parseDateMs(b.lastModified) || 0;
    const aDate = parseDateMs(a.registeredAt) || parseDateMs(a.lastModified) || 0;
    if (bDate !== aDate) return bDate - aDate;
    return String(a.name || a.id).localeCompare(String(b.name || b.id), "de");
  });
  return { ok: true, count: items.length, scanned, truncated: items.length >= limit, items };
}

function createdMsFromOpenKey(name) {
  const reversed = Number(String(name || "").slice("bug:open:".length).split(":")[0]);
  if (!Number.isFinite(reversed)) return 0;
  const createdMs = 9999999999999 - reversed;
  return Number.isFinite(createdMs) && createdMs > 0 ? createdMs : 0;
}

async function purgeBugReports(payload = {}) {
  const olderThanDays = Math.min(Math.max(Number(payload.olderThanDays ?? 30) || 30, 0), 3650);
  const dryRun = payload.dryRun !== false;
  const limit = Math.min(Math.max(Number(payload.limit ?? 5000) || 5000, 1), 5000);
  const includeUnknown = !!payload.includeUnknown;
  const cutoffMs = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;
  const reportKeys = (await kvList("bug:report:")).slice(0, limit);
  const openKeys = (await kvList("bug:open:")).slice(0, limit);
  const keysToDelete = new Set();
  const reportIdsToDelete = new Set();
  let unknownDateReports = 0;

  for (const key of reportKeys) {
    const keyName = String(key.name || "");
    let report = null;
    try {
      report = JSON.parse((await kvGet(keyName)).trim());
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
      await kvDelete(keyName);
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
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
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
  const rawPath = url.pathname === "/" ? "/index.html" : url.pathname;
  const safePath = path.normalize(decodeURIComponent(rawPath)).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(__dirname, safePath);
  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  try {
    const body = await readFile(filePath);
    res.writeHead(200, { "Content-Type": contentType(filePath), "Cache-Control": "no-store" });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
}

const port = Number(process.env.PORT || process.argv[2] || 8900);
const host = "127.0.0.1";

const server = createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${host}:${port}`);
  try {
    if (req.method === "OPTIONS") {
      sendJson(res, { ok: true });
      return;
    }
    if (req.method === "GET" && url.pathname === "/api/admin/users") {
      sendJson(res, await listUsers(url));
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/problem-reports/purge") {
      sendJson(res, await purgeBugReports(await readRequestJson(req)));
      return;
    }
    await serveStatic(req, res, url);
  } catch (error) {
    sendJson(res, { ok: false, error: String(error?.message || error), detail: String(error?.stderr || "").slice(0, 800) }, 500);
  }
});

server.listen(port, host, () => {
  console.log(`[Nutzer Admin] Local KV proxy listening on http://${host}:${port}/index.html`);
});
