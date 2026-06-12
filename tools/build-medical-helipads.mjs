#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

const OURAIRPORTS_AIRPORTS_URL = 'https://davidmegginson.github.io/ourairports-data/airports.csv';
const OPENAIP_PROXY_URL = 'https://ga-proxy.einherjer.workers.dev/api/airports';
const OUT_PATH = path.join(root, 'medical-helipads.json');
const OVERRIDES_PATH = path.join(__dirname, 'medical-helipads.overrides.json');

const DEFAULT_OPENAIP_BBOXES = [
    // DACH default: Germany, Austria, Switzerland.
    [5.5, 47.0, 15.5, 55.2],
    [9.3, 46.2, 17.3, 49.2],
    [5.8, 45.7, 10.7, 47.9]
];

const MEDICAL_RE = /\b(hospital|hospitals|medical|med(?:ical)?\s*center|clinic|clinique|klinikum|krankenhaus|klinik|kliniken|helios|krhs|kh|lkh|uniklinik|universitaetsklinikum|universitatsklinikum|universitaetsklinik|universitatsklinik|notaufnahme|trauma|spital|hopital|charite|mhh|bgu|drk|asklepios|sana|malteser|johanniter)\b/i;
const HELI_RE = /\b(heliport|helipad|helistop|helicopter|heli|hubschrauber|landeplatz)\b/i;

function parseCsv(text) {
    const rows = [];
    let row = [];
    let cell = '';
    let quoted = false;
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (quoted) {
            if (ch === '"') {
                if (text[i + 1] === '"') {
                    cell += '"';
                    i++;
                } else {
                    quoted = false;
                }
            } else {
                cell += ch;
            }
        } else if (ch === '"') {
            quoted = true;
        } else if (ch === ',') {
            row.push(cell);
            cell = '';
        } else if (ch === '\n') {
            row.push(cell);
            rows.push(row);
            row = [];
            cell = '';
        } else if (ch !== '\r') {
            cell += ch;
        }
    }
    if (cell.length || row.length) {
        row.push(cell);
        rows.push(row);
    }
    return rows;
}

function toRecords(csvText) {
    const rows = parseCsv(csvText);
    const header = rows.shift() || [];
    return rows
        .filter(row => row.length && row.some(Boolean))
        .map(row => Object.fromEntries(header.map((key, idx) => [key, row[idx] ?? ''])));
}

function numberOrNull(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}

function stableId(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 90);
}

function medicalScoreFromText(text = '') {
    const t = String(text || '');
    let score = 0;
    if (MEDICAL_RE.test(t)) score += 95;
    if (/\b(helios|klinikum|krankenhaus|krhs|lkh|uniklinik|hospital|clinic|spital|bgu|mhh|charite)\b/i.test(t)) score += 45;
    if (/\b(helios|notaufnahme|trauma|uniklinik|universitaetsklinikum|universitatsklinikum|klinikum|charite|bgu)\b/i.test(t)) score += 30;
    if (/\b(krhs|lkh|kh|spital|asklepios|sana|malteser|johanniter)\b/i.test(t)) score += 15;
    if (HELI_RE.test(t)) score += 25;
    return score;
}

function normalizeItem(raw, source) {
    const lat = numberOrNull(raw.lat ?? raw.latitude_deg);
    const lon = numberOrNull(raw.lon ?? raw.longitude_deg);
    if (lat === null || lon === null) return null;
    const ident = String(raw.ident || raw.icao || raw.local_code || '').trim().toUpperCase();
    const id = stableId(raw.id || ident || `${source}-${raw.name}-${lat}-${lon}`);
    if (!id) return null;
    const name = String(raw.name || ident || 'Medical Helipad').trim();
    const country = String(raw.country || raw.iso_country || '').trim().toUpperCase();
    const region = String(raw.region || raw.iso_region || '').trim().toUpperCase();
    const city = String(raw.city || raw.municipality || '').trim();
    const kind = String(raw.kind || 'hospital_helipad').trim();
    const confidence = Number.isFinite(Number(raw.confidence)) ? Number(raw.confidence) : 0.72;
    return {
        id,
        ident: ident || '',
        name,
        lat,
        lon,
        elevation: numberOrNull(raw.elevation ?? raw.elevation_ft),
        country,
        region,
        city,
        kind,
        source,
        sourceUrl: raw.sourceUrl || raw.home_link || raw.wikipedia_link || '',
        confidence: Math.max(0.1, Math.min(1, Math.round(confidence * 100) / 100)),
        tags: raw.tags && typeof raw.tags === 'object' ? raw.tags : null,
        notes: raw.notes || ''
    };
}

function scoreOurAirports(row) {
    const text = [
        row.name,
        row.municipality,
        row.keywords,
        row.home_link,
        row.wikipedia_link,
        row.ident,
        row.local_code
    ].filter(Boolean).join(' ');
    let score = medicalScoreFromText(text);
    if (/hospital|krankenhaus|klinikum|klinik/i.test(row.name || '')) score += 45;
    if (/closed/i.test(row.type || '')) score -= 120;
    return score;
}

function scoreOpenAip(item) {
    if (Number(item?.type) !== 7) return -100;
    const text = [
        item.name,
        item.icaoCode,
        item.country,
        item.contact,
        item.createdBy,
        item.updatedBy
    ].filter(Boolean).join(' ');
    return medicalScoreFromText(text);
}

function normalizeOpenAipItem(item, score) {
    const coords = item?.geometry?.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) return null;
    return normalizeItem({
        id: `openaip-${item._id || item.icaoCode || item.name}`,
        ident: item.icaoCode || item.designator || '',
        name: item.name || item.icaoCode || 'OpenAIP Heliport',
        lat: Number(coords[1]),
        lon: Number(coords[0]),
        elevation: item.elevation?.value,
        country: item.country || '',
        region: item.country ? `${String(item.country).toUpperCase()}-OPENAIP` : '',
        city: '',
        kind: score >= 95 ? 'hospital_helipad' : 'medical_heliport',
        confidence: Math.min(0.94, 0.65 + Math.max(0, score) / 400),
        sourceUrl: item._id ? `openaip:${item._id}` : '',
        tags: {
            openaipType: item.type,
            ppr: !!item.ppr,
            private: !!item.private,
            trafficType: Array.isArray(item.trafficType) ? item.trafficType.join(',') : ''
        }
    }, 'openaip');
}

async function fetchOpenAipBbox(bbox) {
    const [west, south, east, north] = bbox;
    const items = [];
    let page = 1;
    let totalPages = 1;
    do {
        const url = `${OPENAIP_PROXY_URL}?bbox=${encodeURIComponent(`${west},${south},${east},${north}`)}&limit=1000&page=${page}`;
        const res = await fetch(url, { headers: { Accept: 'application/json' } });
        if (!res.ok) throw new Error(`openaip_http_${res.status}`);
        const json = await res.json();
        if (Array.isArray(json?.items)) items.push(...json.items);
        totalPages = Math.max(1, Number(json?.totalPages || 1));
        page++;
    } while (page <= totalPages && page <= 8);
    return items;
}

async function fetchOpenAipMedicalHelipads() {
    const byId = new Map();
    for (const bbox of DEFAULT_OPENAIP_BBOXES) {
        const items = await fetchOpenAipBbox(bbox);
        for (const item of items) {
            const score = scoreOpenAip(item);
            if (score < 70) continue;
            const normalized = normalizeOpenAipItem(item, score);
            if (normalized) byId.set(normalized.id, normalized);
        }
    }
    return Array.from(byId.values());
}

async function loadOverrides() {
    try {
        const parsed = JSON.parse(await fs.readFile(OVERRIDES_PATH, 'utf8'));
        return Array.isArray(parsed.items) ? parsed.items : [];
    } catch (err) {
        if (err?.code === 'ENOENT') return [];
        throw err;
    }
}

async function main() {
    const fetchedAt = new Date().toISOString();
    const openAip = await fetchOpenAipMedicalHelipads();
    const res = await fetch(OURAIRPORTS_AIRPORTS_URL, { headers: { Accept: 'text/csv' } });
    if (!res.ok) throw new Error(`ourairports_http_${res.status}`);
    const rows = toRecords(await res.text());
    const ourAirports = rows
        .filter(row => String(row.type || '').toLowerCase() === 'heliport')
        .map(row => ({ row, score: scoreOurAirports(row) }))
        .filter(entry => entry.score >= 80)
        .map(entry => normalizeItem({
            ...entry.row,
            kind: 'hospital_helipad',
            confidence: Math.min(0.9, 0.55 + entry.score / 300),
            tags: {
                type: entry.row.type,
                gps_code: entry.row.gps_code || '',
                local_code: entry.row.local_code || '',
                keywords: entry.row.keywords || ''
            }
        }, 'ourairports'))
        .filter(Boolean);

    const overrides = (await loadOverrides())
        .map(item => normalizeItem(item, item.source || 'manual'))
        .filter(Boolean);

    const byId = new Map();
    for (const item of openAip) byId.set(item.id, item);
    for (const item of ourAirports) byId.set(item.id, item);
    for (const item of overrides) byId.set(item.id, item);

    const items = Array.from(byId.values())
        .sort((a, b) =>
            String(a.country).localeCompare(String(b.country))
            || String(a.region).localeCompare(String(b.region))
            || String(a.name).localeCompare(String(b.name))
        );

    const payload = {
        schema: 'ga.medicalHelipads.v1',
        generatedAt: fetchedAt,
        sources: [
            {
                id: 'openaip',
                url: OPENAIP_PROXY_URL,
                license: 'OpenAIP data via configured GA proxy; verify downstream use against OpenAIP terms before redistribution outside this project.',
                fetchedAt,
                scope: 'DACH bboxes, type 7 heliports with medical name signals'
            },
            {
                id: 'ourairports',
                url: OURAIRPORTS_AIRPORTS_URL,
                license: 'Public Domain',
                fetchedAt
            },
            {
                id: 'manual-overrides',
                path: 'tools/medical-helipads.overrides.json',
                license: 'per-item source metadata'
            }
        ],
        count: items.length,
        items
    };

    await fs.writeFile(OUT_PATH, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    console.log(`Wrote ${path.relative(root, OUT_PATH)} with ${items.length} items.`);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
