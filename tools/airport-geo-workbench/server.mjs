// Platz-Workbench: lokaler Server fuer den gemeinsamen Flugplatz-Geometrie-Vorrat
// (Worker /api/airport-geo-v1, tools/cloudflare-worker/airport-geo.mjs).
// - liefert die Oberflaeche (index.html) und den App-Kern mission-arrival-core.js aus dem Repo;
// - liefert Flugplaetze aus der App-Datenbank (data/airport-search) fuer die Karte;
// - reicht Admin-Aufrufe mit dem Admin-Schluessel an den Worker weiter. Der Schluessel liegt nur
//   hier (~/.config/ga-dispatcher/airport-geo-admin-token) und als Worker-Secret, nie im Browser.
// Lauscht nur auf 127.0.0.1.
import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const WORKER_DIR = path.join(ROOT, 'tools', 'cloudflare-worker');
const WORKER_URL = 'https://ga-proxy.einherjer.workers.dev/api/airport-geo-v1';
const TOKEN_FILE = path.join(os.homedir(), '.config', 'ga-dispatcher', 'airport-geo-admin-token');
const KEY_RE = /^(airport|strip)_-?\d{1,2}\.\d{4}_-?\d{1,3}\.\d{4}$/;
const MAX_BODY = 2 * 1024 * 1024;

export function loadAirports(root = ROOT) {
    const manifest = JSON.parse(fs.readFileSync(path.join(root, 'data', 'airport-search', 'manifest.json'), 'utf8'));
    const dir = path.join(root, 'data', 'airport-search', manifest.packVersion);
    const byCode = new Map();
    for (const file of fs.readdirSync(dir).filter(name => name.endsWith('.json'))) {
        const bundle = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
        for (const list of Object.values(bundle.p || {})) {
            for (const r of list) {
                const lat = Number(r[6]), lon = Number(r[7]);
                if (!r[0] || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;
                if (!byCode.has(r[0])) byCode.set(r[0], { code: r[0], name: r[1] || '', city: r[2] || '', country: r[4] || '', type: String(r[5] ?? ''), lat, lon });
            }
        }
    }
    return [...byCode.values()];
}

// Gleicher Schluessel wie die App (mission-arrival-core.js aptArrivalCloudGeoKey).
export const cloudKey = (lat, lon, strip = false) => `${strip ? 'strip' : 'airport'}_${Number(lat).toFixed(4)}_${Number(lon).toFixed(4)}`;

export function airportsInBox(airports, bbox, limit = 1500) {
    const [w, s, e, n] = bbox;
    const out = [];
    for (const a of airports) {
        if (a.lat < s || a.lat > n || a.lon < w || a.lon > e) continue;
        out.push(a);
        if (out.length >= limit) break;
    }
    return out;
}

export function searchAirports(airports, query, limit = 20) {
    const q = String(query || '').trim().toLowerCase();
    if (q.length < 2) return [];
    const exact = [], starts = [], contains = [];
    for (const a of airports) {
        const code = a.code.toLowerCase(), name = a.name.toLowerCase(), city = a.city.toLowerCase();
        if (code === q) exact.push(a);
        else if (code.startsWith(q) || name.startsWith(q)) starts.push(a);
        else if (name.includes(q) || city.includes(q)) contains.push(a);
        if (exact.length + starts.length >= limit) break;
    }
    return exact.concat(starts, contains).slice(0, limit);
}

function run(cmd, args, { cwd, input } = {}) {
    return new Promise((resolve, reject) => {
        const child = execFile(cmd, args, { cwd, maxBuffer: 4 * 1024 * 1024, timeout: 180000 }, (error, stdout, stderr) => {
            if (error) reject(new Error(String(stderr || error.message).slice(-600)));
            else resolve(String(stdout));
        });
        if (input !== undefined) { child.stdin.write(input); child.stdin.end(); }
    });
}

// Beim ersten Start: Schluessel erzeugen, per Wrangler als Worker-Secret setzen, dann lokal ablegen.
export async function ensureAdminToken({ log = console.log } = {}) {
    try {
        const token = fs.readFileSync(TOKEN_FILE, 'utf8').trim();
        if (token.length >= 24) return token;
    } catch (_) {}
    const token = randomBytes(32).toString('hex');
    log('[Platz-Workbench] Lege Admin-Schlüssel an und setze ihn als Worker-Secret (npx wrangler secret put AIRPORT_GEO_ADMIN_TOKEN) …');
    await run('npx', ['--no-install', 'wrangler', 'secret', 'put', 'AIRPORT_GEO_ADMIN_TOKEN'], { cwd: WORKER_DIR, input: token + '\n' });
    fs.mkdirSync(path.dirname(TOKEN_FILE), { recursive: true, mode: 0o700 });
    fs.writeFileSync(TOKEN_FILE, token + '\n', { mode: 0o600 });
    log('[Platz-Workbench] Admin-Schlüssel gesetzt.');
    return token;
}

const send = (res, status, body, type = 'application/json; charset=utf-8') => {
    res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
};

function readBody(req) {
    return new Promise((resolve, reject) => {
        let size = 0; const chunks = [];
        req.on('data', chunk => { size += chunk.length; if (size > MAX_BODY) { reject(new Error('too_large')); req.destroy(); } else chunks.push(chunk); });
        req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
        req.on('error', reject);
    });
}

export function createWorkbenchServer({ port = 8910, airports = [], token = '', fetchImpl = fetch } = {}) {
    const allowed = new Set([`127.0.0.1:${port}`, `localhost:${port}`]);
    const files = {
        '/': ['index.html', 'text/html; charset=utf-8', HERE],
        '/index.html': ['index.html', 'text/html; charset=utf-8', HERE],
        '/core/mission-arrival-core.js': ['mission-arrival-core.js', 'text/javascript; charset=utf-8', ROOT]
    };
    const worker = async (url, init = {}) => {
        const res = await fetchImpl(url, { ...init, headers: { ...(init.headers || {}), 'X-Admin-Token': token, 'Content-Type': 'application/json' } });
        return { status: res.status, text: await res.text() };
    };
    return createServer(async (req, res) => {
        try {
            if (!allowed.has(String(req.headers.host || ''))) return send(res, 403, { error: 'host' });
            const origin = req.headers.origin;
            if (origin && !allowed.has(origin.replace(/^https?:\/\//, ''))) return send(res, 403, { error: 'origin' });
            const url = new URL(req.url, `http://${req.headers.host}`);
            if (req.method === 'GET' && files[url.pathname]) {
                const [name, type, dir] = files[url.pathname];
                return send(res, 200, fs.readFileSync(path.join(dir, name)), type);
            }
            if (url.pathname === '/api/airports') {
                const q = url.searchParams.get('q');
                if (q) return send(res, 200, { airports: searchAirports(airports, q) });
                const bbox = String(url.searchParams.get('bbox') || '').split(',').map(Number);
                if (bbox.length !== 4 || bbox.some(v => !Number.isFinite(v))) return send(res, 400, { error: 'bbox' });
                return send(res, 200, { airports: airportsInBox(airports, bbox) });
            }
            if (url.pathname === '/api/cloud/index') {
                const r = await worker(`${WORKER_URL}/index`);
                return send(res, r.status, r.text);
            }
            const m = url.pathname.match(/^\/api\/cloud\/([^/]+)(\/admin)?$/);
            if (m && KEY_RE.test(m[1])) {
                if (!m[2]) {
                    // Sicht der App (gefiltert, mit manuellen Plaetzen). Achtung: vergibt bei faelligen Eintraegen
                    // einen Erneuerungsauftrag; die Oberflaeche nutzt deshalb die Admin-Sicht.
                    const r = await worker(`${WORKER_URL}/${m[1]}`);
                    return send(res, r.status, r.text);
                }
                if (req.method === 'GET') {
                    const r = await worker(`${WORKER_URL}/${m[1]}/admin`);
                    return send(res, r.status, r.text);
                }
                if (req.method === 'POST') {
                    const body = await readBody(req);
                    const r = await worker(`${WORKER_URL}/${m[1]}/admin`, { method: 'POST', body });
                    return send(res, r.status, r.text);
                }
            }
            return send(res, 404, { error: 'not_found' });
        } catch (error) {
            return send(res, 500, { error: String(error?.message || error).slice(0, 300) });
        }
    });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
    const port = Number(process.argv[2] || 8910);
    const airports = loadAirports();
    console.log(`[Platz-Workbench] ${airports.length} Flugplätze aus der App-Datenbank geladen.`);
    const token = await ensureAdminToken();
    createWorkbenchServer({ port, airports, token }).listen(port, '127.0.0.1', () => {
        console.log(`[Platz-Workbench] Läuft: http://127.0.0.1:${port}/  (Beenden: Ctrl+C oder Fenster schließen)`);
    });
}
