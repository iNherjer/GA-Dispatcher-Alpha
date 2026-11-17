// Auth guard: PIN attempt limiter. One Durable Object per pilot (name = NFKC-lower-cased pilot ID).
// It counts DISTINCT wrong PINs, never attempts: a stale client repeating the same wrong PIN
// never locks anyone out. Only a short hash of each wrong PIN is stored, never the PIN.
//   per pilot + IP:   5 distinct wrong PINs within 15 min -> this IP locked for 15 min
//   per pilot:        30 distinct wrong PINs within 24 h -> global lock 1 h, doubling per
//                     further trigger up to 24 h, back to 1 h after 7 quiet days.
//                     IPs with a successful login in the last 30 days are exempt (own IP lock still applies).
// Internal route (worker only): POST https://auth-guard/check { ip, hash, ok } -> { ok, locked, retryAfterSeconds }

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const IP_WINDOW_MS = 15 * MINUTE;
const IP_MAX_DISTINCT = 5;
const IP_LOCK_MS = 15 * MINUTE;
const GLOBAL_WINDOW_MS = DAY;
const GLOBAL_MAX_DISTINCT = 30;
const GLOBAL_LOCK_BASE_MS = HOUR;
const GLOBAL_LOCK_MAX_MS = DAY;
const GLOBAL_DECAY_MS = 7 * DAY;
const KNOWN_GOOD_MS = 30 * DAY;
const KNOWN_GOOD_REFRESH_MS = DAY;
const MAX_IPS = 256;
const MAX_GLOBAL_HASHES = 200;
const MAX_KNOWN_GOOD = 64;

const reply = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
const cleanIp = value => String(value || 'unknown').slice(0, 64);
const cleanHash = value => String(value || '').replace(/[^0-9a-f]/g, '').slice(0, 32);

function emptyState() {
    return { ips: {}, wrong: [], globalLockUntil: 0, globalLevel: 0, lastTriggerAt: 0, good: {} };
}

function newestEntries(object, max, age) {
    const entries = Object.entries(object);
    if (entries.length <= max) return object;
    return Object.fromEntries(entries.sort((a, b) => age(b[1]) - age(a[1])).slice(0, max));
}
const ipActivity = entry => Math.max(Number(entry?.lockUntil) || 0, ...(entry?.wrong || []).map(item => item.at));

export class AuthGuard {
    constructor(ctx) {
        this.storage = ctx.storage;
        this.now = () => Date.now();
    }

    prune(state, now) {
        let changed = false;
        for (const [ip, entry] of Object.entries(state.ips)) {
            const wrong = (entry.wrong || []).filter(item => now - item.at < IP_WINDOW_MS);
            if (wrong.length !== (entry.wrong || []).length) changed = true;
            if (!wrong.length && !(entry.lockUntil > now)) { delete state.ips[ip]; changed = true; continue; }
            entry.wrong = wrong;
        }
        const wrong = state.wrong.filter(item => now - item.at < GLOBAL_WINDOW_MS);
        if (wrong.length !== state.wrong.length) { state.wrong = wrong; changed = true; }
        for (const [ip, at] of Object.entries(state.good)) {
            if (now - at >= KNOWN_GOOD_MS) { delete state.good[ip]; changed = true; }
        }
        if (state.lastTriggerAt && now - state.lastTriggerAt > GLOBAL_DECAY_MS && state.globalLevel) {
            state.globalLevel = 0;
            changed = true;
        }
        return changed;
    }

    async check(body) {
        const now = this.now();
        const ip = cleanIp(body?.ip);
        const hash = cleanHash(body?.hash);
        const state = { ...emptyState(), ...((await this.storage.get('state')) || {}) };
        let changed = this.prune(state, now);
        const save = async () => {
            state.ips = newestEntries(state.ips, MAX_IPS, ipActivity);
            state.good = newestEntries(state.good, MAX_KNOWN_GOOD, Number);
            if (state.wrong.length > MAX_GLOBAL_HASHES) state.wrong = state.wrong.slice(-MAX_GLOBAL_HASHES);
            await this.storage.put('state', state);
        };

        const ipEntry = state.ips[ip];
        const knownGood = Number(state.good[ip]) > 0 && now - state.good[ip] < KNOWN_GOOD_MS;
        const ipLockUntil = ipEntry?.lockUntil > now ? ipEntry.lockUntil : 0;
        const globalLockUntil = !knownGood && state.globalLockUntil > now ? state.globalLockUntil : 0;
        const lockUntil = Math.max(ipLockUntil, globalLockUntil);
        if (lockUntil) {
            if (changed) await save();
            return { ok: false, locked: true, retryAfterSeconds: Math.ceil((lockUntil - now) / 1000) };
        }

        if (body?.ok === true) {
            // Remember the IP as known-good only when it is not already known recently (no write per login).
            if (!knownGood || now - state.good[ip] >= KNOWN_GOOD_REFRESH_MS) { state.good[ip] = now; changed = true; }
            if (ipEntry?.wrong?.length) { delete state.ips[ip]; changed = true; }
            if (changed) await save();
            return { ok: true, locked: false };
        }
        if (!hash) {
            if (changed) await save();
            return { ok: false, locked: false };
        }

        const entry = state.ips[ip] || (state.ips[ip] = { wrong: [], lockUntil: 0 });
        let ipLocked = false;
        let globalLocked = false;
        if (!entry.wrong.some(item => item.h === hash)) {
            entry.wrong.push({ h: hash, at: now });
            changed = true;
            if (entry.wrong.length >= IP_MAX_DISTINCT) {
                entry.lockUntil = now + IP_LOCK_MS;
                entry.wrong = [];
                ipLocked = true;
            }
        }
        if (!state.wrong.some(item => item.h === hash)) {
            state.wrong.push({ h: hash, at: now });
            changed = true;
            if (state.wrong.length >= GLOBAL_MAX_DISTINCT) {
                state.globalLevel = state.lastTriggerAt && now - state.lastTriggerAt <= GLOBAL_DECAY_MS
                    ? Math.min(state.globalLevel + 1, 10) : 0;
                state.globalLockUntil = now + Math.min(GLOBAL_LOCK_BASE_MS * 2 ** state.globalLevel, GLOBAL_LOCK_MAX_MS);
                state.lastTriggerAt = now;
                state.wrong = [];
                globalLocked = !knownGood;
            }
        }
        if (changed) await save();
        const until = Math.max(ipLocked ? entry.lockUntil : 0, globalLocked ? state.globalLockUntil : 0);
        return until
            ? { ok: false, locked: true, retryAfterSeconds: Math.ceil((until - now) / 1000) }
            : { ok: false, locked: false };
    }

    async fetch(request) {
        try {
            const url = new URL(request.url);
            if (request.method !== 'POST' || url.pathname !== '/check') return reply({ error: 'not_found' }, 404);
            return reply(await this.check(await request.json()));
        } catch (error) {
            return reply({ error: String(error?.message || error) }, 400);
        }
    }
}

// Per-isolate memory, so a normal login or a stale client costs no Durable Object request.
// Keys hold the lower-cased pilot ID, the client IP and a PIN hash, never the PIN.
const SUCCESS_CACHE_MS = 10 * MINUTE;
const WRONG_CACHE_MS = 5 * MINUTE;
const MEMORY_MAX = 2000;
const successMemory = new Map(); // pilot\nip -> { hash, expires }
const wrongMemory = new Map();   // pilot\nip\nhash -> expires
const lockMemory = new Map();    // pilot\nip -> lockUntil
let clock = () => Date.now();

export function setAuthGuardClock(fn) { clock = typeof fn === 'function' ? fn : () => Date.now(); }
export function resetAuthGuardMemory() { successMemory.clear(); wrongMemory.clear(); lockMemory.clear(); }

function remember(map, key, value) {
    map.delete(key);
    if (map.size >= MEMORY_MAX) map.delete(map.keys().next().value);
    map.set(key, value);
}

async function pinHash(pilotLower, pin) {
    const data = new TextEncoder().encode(`ga-auth-guard\n${pilotLower}\n${pin}`);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return [...new Uint8Array(digest)].slice(0, 8).map(b => b.toString(16).padStart(2, '0')).join('');
}

export function authGuardStub(env, pilotLower) {
    return env.GA_AUTH_GUARD.get(env.GA_AUTH_GUARD.idFromName(pilotLower));
}

// Returns { ok } or, while this pilot is locked for the caller, { ok:false, retryAfterSeconds }.
// `correct` is the caller's own PIN comparison; it never leaks while locked.
// Fail open: without binding or on any guard error the plain comparison decides.
export async function checkPinAttempt(env, request, pilotId, providedPin, correct) {
    const pin = String(providedPin ?? '');
    const pilotLower = String(pilotId || '').trim().normalize('NFKC').toLowerCase();
    if (!pin) return { ok: false };
    if (!env?.GA_AUTH_GUARD || !pilotLower) return { ok: !!correct };
    const ip = cleanIp(request?.headers?.get?.('CF-Connecting-IP'));
    const slot = `${pilotLower}\n${ip}`;
    const now = clock();
    const lockUntil = lockMemory.get(slot);
    if (lockUntil > now) return { ok: false, retryAfterSeconds: Math.ceil((lockUntil - now) / 1000) };
    try {
        const hash = await pinHash(pilotLower, pin);
        if (correct) {
            const known = successMemory.get(slot);
            if (known && known.hash === hash && known.expires > now) return { ok: true };
        } else if (wrongMemory.get(`${slot}\n${hash}`) > now) {
            return { ok: false };
        }
        const response = await authGuardStub(env, pilotLower).fetch(new Request('https://auth-guard/check', {
            method: 'POST',
            body: JSON.stringify({ ip, hash, ok: !!correct })
        }));
        if (!response.ok) throw new Error(`auth_guard_${response.status}`);
        const result = await response.json();
        if (result.locked) {
            const seconds = Math.max(1, Math.ceil(Number(result.retryAfterSeconds) || 60));
            successMemory.delete(slot);
            remember(lockMemory, slot, now + seconds * 1000);
            return { ok: false, retryAfterSeconds: seconds };
        }
        if (correct) {
            remember(successMemory, slot, { hash, expires: now + SUCCESS_CACHE_MS });
            return { ok: true };
        }
        successMemory.delete(slot);
        remember(wrongMemory, `${slot}\n${hash}`, now + WRONG_CACHE_MS);
        return { ok: false };
    } catch (error) {
        console.warn('Auth guard unavailable, plain PIN check:', String(error?.message || error));
        return { ok: !!correct };
    }
}
