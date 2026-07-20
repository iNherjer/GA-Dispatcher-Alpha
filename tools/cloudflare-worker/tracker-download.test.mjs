import assert from "node:assert/strict";
import worker from "./worker-merged-full.js";

const originalFetch = globalThis.fetch;
const channel = {
  schemaVersion: 1,
  publishedAt: "2026-07-20T06:53:00.000Z",
  version: "v299",
  versionCode: 299,
  releaseTag: "v299",
  asset: {
    name: "VFR-Multitool-Tracker.exe",
    url: "https://github.com/iNherjer/GA-Dispatcher-Alpha/releases/download/v299/VFR-Multitool-Tracker.exe",
    size: 48318843,
    sha256: "31c7bf5cd680810a4efbc2534ffd0d7048e8c25194645f0cebebc64c2dc5dca3"
  }
};

try {
  globalThis.fetch = async () => new Response(JSON.stringify(channel), { status: 200, headers: { "content-type": "application/json" } });
  const redirect = await worker.fetch(new Request("https://ga-proxy.example/api/tracker/download"), {}, {});
  assert.equal(redirect.status, 302);
  assert.equal(redirect.headers.get("location"), channel.asset.url);
  assert.equal(redirect.headers.get("x-tracker-version"), "v299");

  const metadata = await worker.fetch(new Request("https://ga-proxy.example/api/tracker/download?format=json"), {}, {});
  assert.equal(metadata.status, 200);
  assert.equal((await metadata.json()).asset.sha256, channel.asset.sha256);

  globalThis.fetch = async () => new Response(JSON.stringify({ ...channel, releaseTag: "homebase-assets-v0.6.5" }), { status: 200 });
  const rejected = await worker.fetch(new Request("https://ga-proxy.example/api/tracker/download"), {}, {});
  assert.equal(rejected.status, 502);
  console.log("Tracker download tests passed.");
} finally {
  globalThis.fetch = originalFetch;
}
