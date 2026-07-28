#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataPath = path.resolve(__dirname, "..", "data", "openaip-reporting-points.json");
const payload = JSON.parse(await fs.readFile(dataPath, "utf8"));

const failures = [];
if (payload?.schema !== 1) failures.push("schema ist nicht 1");
if (!Array.isArray(payload?.points)) failures.push("points fehlt");
if (payload?.count !== payload?.points?.length) failures.push("count passt nicht zu points.length");
if ((payload?.points?.length || 0) < 1000) failures.push("zu wenige Reporting Points");

const ids = new Set();
for (const point of payload?.points || []) {
  if (!point?.id || !point?.name) failures.push("Datensatz ohne id/name");
  if (!Number.isFinite(point?.lat) || !Number.isFinite(point?.lon)) failures.push(`ungueltige Koordinate: ${point?.id}`);
  if (Math.abs(point?.lat) > 90 || Math.abs(point?.lon) > 180) failures.push(`Koordinate ausserhalb Bereich: ${point?.id}`);
  if (ids.has(point?.id)) failures.push(`doppelte id: ${point?.id}`);
  ids.add(point?.id);
}

if (failures.length) {
  console.error(`OpenAIP Reporting-Points Selftest fehlgeschlagen (${failures.length}):`);
  for (const failure of failures.slice(0, 20)) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(JSON.stringify({
  ok: true,
  generatedAt: payload.generatedAt,
  sourceCount: payload.sourceCount,
  count: payload.count,
  withAirportIcao: payload.points.filter((point) => point.airportIcao).length,
  withDescription: payload.points.filter((point) => point.description).length
}, null, 2));
