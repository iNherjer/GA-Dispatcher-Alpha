#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const outputPath = path.join(repoRoot, "data", "openaip-reporting-points.json");
const endpoint = "https://ga-proxy.einherjer.workers.dev/api/reporting-points";
const pageLimit = 250;
const requestDelayMs = 350;
const requestedFields = [
  "_id",
  "name",
  "geometry",
  "airport",
  "aerodrome",
  "relatedAirport",
  "location",
  "parent",
  "airports",
  "description",
  "note",
  "remarks",
  "updatedAt"
].join(",");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function asFiniteNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function cleanText(value, maxLength = 300) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text ? text.slice(0, maxLength) : "";
}

function extractAirportIcao(value, seen = new Set()) {
  if (value == null || seen.has(value)) return "";
  if (typeof value === "string") {
    const direct = value.trim().toUpperCase();
    if (/^[A-Z0-9]{4}$/.test(direct)) return direct;
    const match = direct.match(/\b[A-Z][A-Z0-9]{3}\b/);
    return match ? match[0] : "";
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const result = extractAirportIcao(item, seen);
      if (result) return result;
    }
    return "";
  }
  if (typeof value !== "object") return "";
  seen.add(value);
  for (const key of ["icaoCode", "icao", "ident", "identifier", "designator", "code", "name"]) {
    const result = extractAirportIcao(value[key], seen);
    if (result) return result;
  }
  return "";
}

function normalizeReportingPoint(item) {
  const coordinates = item?.geometry?.coordinates;
  const lon = asFiniteNumber(Array.isArray(coordinates) ? coordinates[0] : item?.lon ?? item?.lng);
  const lat = asFiniteNumber(Array.isArray(coordinates) ? coordinates[1] : item?.lat);
  const id = cleanText(item?._id || item?.id, 100);
  const name = cleanText(item?.name || item?.identifier || item?.designator, 160);
  if (!id || !name || lat == null || lon == null || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return null;
  }

  const airportIcao = extractAirportIcao([
    item?.airport,
    item?.aerodrome,
    item?.relatedAirport,
    item?.location,
    item?.parent,
    item?.airports
  ]);
  const description = cleanText(item?.description || item?.note || item?.remarks, 300);
  const updatedAt = cleanText(item?.updatedAt, 50);

  return {
    id,
    name,
    lat,
    lon,
    ...(airportIcao ? { airportIcao } : {}),
    ...(description ? { description } : {}),
    ...(updatedAt ? { updatedAt } : {})
  };
}

async function fetchPage(page, attempt = 1) {
  const url = new URL(endpoint);
  url.searchParams.set("limit", String(pageLimit));
  url.searchParams.set("page", String(page));
  url.searchParams.set("fields", requestedFields);

  const response = await fetch(url, {
    headers: {
      accept: "application/json"
    }
  });
  if (response.ok) return response.json();

  if ((response.status === 429 || response.status >= 500) && attempt < 6) {
    const retryAfter = Number(response.headers.get("retry-after"));
    const waitMs = Number.isFinite(retryAfter) && retryAfter > 0
      ? retryAfter * 1000
      : Math.min(12000, 800 * (2 ** (attempt - 1)));
    console.warn(`Reporting-Points Seite ${page}: HTTP ${response.status}, neuer Versuch in ${waitMs} ms`);
    await sleep(waitMs);
    return fetchPage(page, attempt + 1);
  }

  throw new Error(`Reporting-Points Seite ${page}: HTTP ${response.status}`);
}

async function main() {
  const first = await fetchPage(1);
  const totalCount = Number(first?.totalCount ?? first?.total ?? 0);
  const totalPages = Math.max(1, Math.ceil(totalCount / pageLimit));
  const rawItems = Array.isArray(first?.items) ? [...first.items] : [];
  console.log(`OpenAIP Reporting Points: ${totalCount} Datensätze, ${totalPages} Seiten`);

  for (let page = 2; page <= totalPages; page += 1) {
    await sleep(requestDelayMs);
    const payload = await fetchPage(page);
    if (Array.isArray(payload?.items)) rawItems.push(...payload.items);
    console.log(`Seite ${page}/${totalPages}: ${rawItems.length} Rohdatensätze`);
  }

  const byId = new Map();
  for (const rawItem of rawItems) {
    const item = normalizeReportingPoint(rawItem);
    if (item) byId.set(item.id, item);
  }
  const points = [...byId.values()].sort((a, b) =>
    a.lat - b.lat || a.lon - b.lon || a.name.localeCompare(b.name)
  );
  const output = {
    schema: 1,
    generatedAt: new Date().toISOString(),
    source: "OpenAIP via GA Dispatcher Worker",
    sourceUrl: "https://www.openaip.net/",
    license: "CC BY-NC 4.0",
    sourceCount: totalCount,
    count: points.length,
    points
  };

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(output)}\n`, "utf8");
  const stat = await fs.stat(outputPath);
  console.log(`Geschrieben: ${path.relative(repoRoot, outputPath)} (${points.length} Punkte, ${stat.size} Bytes)`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
