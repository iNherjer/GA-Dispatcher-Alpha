/* Crew fleet over the MSFS 2024 mod "Where I Left It" (Yetty).
 * Shared by the tracker desktop app (reads and writes the mod's backup.txt) and
 * the worker (crew-fleet.mjs, merges per aircraft).
 *
 * backup.txt (mod v2.0.0, format 1), all fields URL-encoded:
 *   WHEREILEFTIT-BACKUP|1|<modVersion>|<exportMs>
 *   pos|<key>|<JSON position>   key = "tail:<TAIL>|<sim title>"
 *   log|<key>|<JSON logbook>
 *
 * Merge rules follow the mod's own import (tested 02.11.2026):
 *   pos: the whole record with the newer savedAt wins.
 *   log: flights are united without duplicates and sorted by start; the totals
 *        come from the record with the newer lastFlown; local notes stay.
 *
 * Use of an aircraft (lock), held by one pilot at a time:
 *   reserved - by hand on the crew board, 12 h
 *   busy     - the tracker reports a live flight with this aircraft (still on the ground), 12 h
 *   flying   - the tracker saw this aircraft take off, 12 h
 *   landed   - parked after the flight, 12 h
 * busy, flying and landed end when the tracker reports that the pilot left the aircraft
 * (sim closed, main menu / world map, another aircraft, tracker stopped): until then he
 * could fly on.
 * Every state blocks the aircraft for the others; "free" when it ran out or was released.
 * See docs/Crew Fleet Where I Left It.md. */
(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    root.GAWiliFleetCore = api;
})(globalThis, function () {
    'use strict';

    const HEADER = 'WHEREILEFTIT-BACKUP';
    const FORMAT = '1';
    const MAX_KEY = 300;
    const MAX_TEXT = 200;
    const MAX_NOTES = 2000;
    const MAX_FLIGHTS = 200;
    const MAX_ARRAY = 40;
    const MAX_RECORDS = 400;
    const LOCK_MS = 12 * 60 * 60 * 1000;
    const LOCK_STATES = ['reserved', 'busy', 'flying', 'landed'];
    const LOCK_LABEL = { free: 'Frei', reserved: 'Reserviert', busy: 'Belegt', flying: 'In der Luft', landed: 'Gelandet' };
    const NOTE_LABEL = { reserved: 'reserviert', busy: 'belegt', flying: 'in der Luft', landed: 'gelandet' };

    const finite = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback);
    const text = (value, max = MAX_TEXT) => String(value ?? '').replace(/[\u0000-\u001f]/g, ' ').slice(0, max);
    const plain = value => value && typeof value === 'object' && !Array.isArray(value);

    function validKey(key) {
        const value = String(key || '');
        return value.length > 0 && value.length <= MAX_KEY && !/[\r\n]/.test(value);
    }

    // Keeps known fields with checked types; unknown fields from newer mod versions pass
    // through as plain numbers, booleans or short strings, so nothing the mod needs is lost.
    function cleanPos(input) {
        if (!plain(input)) return null;
        const lat = finite(input.lat, NaN), lon = finite(input.lon, NaN);
        if (!(Math.abs(lat) <= 90) || !(Math.abs(lon) <= 180)) return null;
        const pos = {};
        for (const [name, value] of Object.entries(input)) {
            if (Object.keys(pos).length >= 60 || !/^[A-Za-z][A-Za-z0-9_]{0,40}$/.test(name)) continue;
            if (typeof value === 'number' && Number.isFinite(value)) pos[name] = value;
            else if (typeof value === 'boolean') pos[name] = value;
            else if (typeof value === 'string') pos[name] = text(value);
        }
        pos.title = text(input.title || input.name);
        if (!pos.title) return null;
        pos.lat = lat; pos.lon = lon;
        pos.savedAt = Math.max(0, Math.round(finite(input.savedAt)));
        if (Array.isArray(input.fuel)) {
            pos.fuel = input.fuel.slice(0, MAX_ARRAY)
                .filter(entry => Array.isArray(entry) && entry.length >= 2)
                .map(entry => [text(entry[0], 60), finite(entry[1])]);
        }
        if (Array.isArray(input.payload)) pos.payload = input.payload.slice(0, MAX_ARRAY).map(value => finite(value));
        return pos;
    }

    function cleanFlight(input) {
        if (!plain(input)) return null;
        const start = Math.round(finite(input.start, NaN));
        if (!Number.isFinite(start) || start <= 0) return null;
        return {
            start,
            end: Math.round(finite(input.end)),
            from: text(input.from, 12), fromLat: finite(input.fromLat), fromLon: finite(input.fromLon),
            to: text(input.to, 12), toLat: finite(input.toLat), toLon: finite(input.toLon),
            secs: finite(input.secs), nm: finite(input.nm), landings: Math.round(finite(input.landings)),
            open: input.open === true
        };
    }

    function cleanLog(input) {
        if (!plain(input)) return null;
        const flights = (Array.isArray(input.flights) ? input.flights : []).map(cleanFlight).filter(Boolean);
        return {
            flightSecs: finite(input.flightSecs), engineSecs: finite(input.engineSecs),
            landings: Math.round(finite(input.landings)), lastFlown: Math.round(finite(input.lastFlown)),
            distanceNm: finite(input.distanceNm), notes: text(input.notes, MAX_NOTES),
            flights: uniteFlights([], flights), flightsOffset: Math.round(finite(input.flightsOffset))
        };
    }

    function uniteFlights(a, b) {
        const byStart = new Map();
        for (const flight of [...(a || []), ...(b || [])]) {
            if (!flight) continue;
            const known = byStart.get(flight.start);
            // An open flight that was closed later replaces its open copy.
            if (!known || (known.open && !flight.open) || (flight.end > known.end && known.open === flight.open)) byStart.set(flight.start, flight);
        }
        return [...byStart.values()].sort((x, y) => x.start - y.start).slice(-MAX_FLIGHTS);
    }

    // Stable JSON for change detection: sorted keys, so field order never counts as a change.
    function canonical(value) {
        if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
        if (plain(value)) return '{' + Object.keys(value).sort().map(name => JSON.stringify(name) + ':' + canonical(value[name])).join(',') + '}';
        return JSON.stringify(value ?? null);
    }

    const recordSignature = record => canonical({ pos: record?.pos || null, log: record?.log || null });

    function mergePos(local, incoming) {
        if (!incoming) return local || null;
        if (!local) return incoming;
        return finite(incoming.savedAt) > finite(local.savedAt) ? incoming : local;
    }

    function mergeLog(local, incoming) {
        if (!incoming) return local || null;
        if (!local) return incoming;
        const newer = finite(incoming.lastFlown) > finite(local.lastFlown) ? incoming : local;
        return {
            ...newer,
            notes: local.notes || incoming.notes || '',
            flights: uniteFlights(local.flights, incoming.flights)
        };
    }

    function mergeRecord(local, incoming) {
        return {
            key: incoming?.key || local?.key,
            pos: mergePos(local?.pos || null, incoming?.pos || null),
            log: mergeLog(local?.log || null, incoming?.log || null)
        };
    }

    function decode(value) {
        try { return decodeURIComponent(value); } catch (_) { return null; }
    }

    // Parses backup.txt. Returns { header, records: Map<key, {key,pos,log}>, problems }.
    function parseBackup(content) {
        const lines = String(content || '').replace(/^﻿/, '').split(/\r?\n/).filter(line => line.trim());
        const result = { header: null, records: new Map(), problems: [] };
        if (!lines.length) return result;
        const head = lines[0].split('|');
        if (head[0] !== HEADER) { result.problems.push('header_missing'); return result; }
        result.header = { format: head[1] || '', modVersion: head[2] || '', exportedAt: finite(head[3]) };
        if (result.header.format !== FORMAT) { result.problems.push('format_unknown'); return result; }
        for (const line of lines.slice(1)) {
            const first = line.indexOf('|'), second = line.indexOf('|', first + 1);
            if (first < 0 || second < 0) { result.problems.push('line_invalid'); continue; }
            const type = line.slice(0, first);
            const key = decode(line.slice(first + 1, second));
            const json = decode(line.slice(second + 1));
            if (!key || !validKey(key) || json == null || (type !== 'pos' && type !== 'log')) { result.problems.push('line_invalid'); continue; }
            let data;
            try { data = JSON.parse(json); } catch (_) { result.problems.push('json_invalid'); continue; }
            const record = result.records.get(key) || { key, pos: null, log: null };
            if (type === 'pos') record.pos = data;
            else record.log = data;
            result.records.set(key, record);
        }
        return result;
    }

    // Writes records in the mod's order: all pos lines, then all log lines.
    function serializeBackup(records, { modVersion = '2.0.0', exportedAt = Date.now() } = {}) {
        const list = [...records];
        const lines = [`${HEADER}|${FORMAT}|${modVersion}|${Math.round(exportedAt)}`];
        for (const record of list) if (record.pos) lines.push(`pos|${encodeURIComponent(record.key)}|${encodeURIComponent(JSON.stringify(record.pos))}`);
        for (const record of list) if (record.log) lines.push(`log|${encodeURIComponent(record.key)}|${encodeURIComponent(JSON.stringify(record.log))}`);
        return lines.join('\n') + '\n';
    }

    // state.txt: "rec|<key>|title|livery|tail|lat|lon|..." - only used to see whether a
    // written import has reached the mod.
    function parseStatePositions(content) {
        const positions = new Map();
        for (const line of String(content || '').split(/\r?\n/)) {
            const parts = line.split('|');
            if (parts[0] !== 'rec' || parts.length < 7) continue;
            const key = decode(parts[1]);
            if (key) positions.set(key, { lat: finite(parts[5], NaN), lon: finite(parts[6], NaN), hidden: parts[13] === '1' });
        }
        return positions;
    }

    // Full aircraft lines of state.txt (mod 2.0.0):
    // rec|<key>|title|livery|tail|lat|lon|altFt|aglFt|hdgTrue|pitch|bank|onGround|hidden
    // Returns null when the file does not look like that (other mod version): then it is ignored.
    function parseStateRecords(content) {
        const lines = String(content || '').split(/\r?\n/).filter(line => line.trim());
        if (!lines.length || !lines[0].startsWith('settings|')) return null;
        const records = new Map();
        for (const line of lines.slice(1)) {
            const parts = line.split('|');
            if (parts[0] !== 'rec') continue;
            if (parts.length < 14) return null;
            const key = decode(parts[1]);
            const values = parts.slice(5, 12).map(Number);
            if (!key || !validKey(key) || values.some(value => !Number.isFinite(value)) || Math.abs(values[0]) > 90 || Math.abs(values[1]) > 180) return null;
            const [lat, lon, altFt, aglFt, hdgTrue, pitch, bank] = values;
            records.set(key, { key, title: parts[2], livery: parts[3], tail: parts[4], lat, lon, altFt, aglFt, hdgTrue, pitch, bank, onGround: parts[12] === '1', hidden: parts[13] === '1' });
        }
        return records;
    }

    function samePlace(a, b) {
        return Boolean(a && b) && Math.abs(a.lat - b.lat) < 2e-6 && Math.abs(a.lon - b.lon) < 2e-6
            && (a.hidden === undefined || b.hidden === undefined || Boolean(a.hidden) === Boolean(b.hidden));
    }

    function titleFromKey(key) {
        const value = String(key || '');
        const bar = value.indexOf('|');
        return bar >= 0 ? value.slice(bar + 1) : value;
    }

    const lower = value => String(value || '').trim().toLowerCase();

    // The lock as it counts now: null when free (never set, released or run out).
    function activeLock(lock, now = Date.now()) {
        if (!plain(lock) || !LOCK_STATES.includes(lock.state) || !lock.pilotId) return null;
        const start = lock.state === 'landed' ? finite(lock.landedAt, finite(lock.since)) : finite(lock.since);
        const until = start + LOCK_MS;
        return now < until ? { ...lock, until } : null;
    }

    const lockHolder = (lock, now) => lower(activeLock(lock, now)?.pilotId);
    const blockedFor = (lock, pilotId, now) => { const holder = lockHolder(lock, now); return Boolean(holder) && holder !== lower(pilotId); };

    // Applies a lock action for one pilot. Returns { lock, changed, refused, holder }.
    // Actions: reserve, release (by hand), claim, unclaim, takeoff, parked, left (tracker).
    // "uploaded" (mod export) no longer ends the use; it is kept as a no-op for older callers.
    function applyLock(lock, action, pilot, now = Date.now()) {
        const current = activeLock(lock, now);
        const mine = current && lower(current.pilotId) === lower(pilot.pilotId);
        const refuse = () => ({ lock: current, changed: false, refused: true, holder: current });
        const set = state => ({ lock: { state, pilotId: pilot.pilotId, nick: pilot.nick || '', since: mine && state === current.state ? current.since : now, ...(state === 'landed' ? { landedAt: now } : {}) }, changed: true, refused: false });
        const free = () => ({ lock: null, changed: Boolean(current) || Boolean(lock), refused: false });
        if (action === 'reserve') return current && !mine ? refuse() : (mine && current.state !== 'reserved' ? { lock: current, changed: false, refused: false } : set('reserved'));
        if (action === 'release') return current && !mine ? refuse() : free();
        // Live flight with this aircraft: in use from the ground on; a running flight stays as it is.
        if (action === 'claim') return current && !mine ? refuse() : (mine && ['flying', 'landed'].includes(current.state) ? { lock: current, changed: false, refused: false } : (mine && current.state === 'busy' ? { lock: current, changed: false, refused: false } : set('busy')));
        // Live flight ended without a takeoff (aborted): free again.
        if (action === 'unclaim') return mine && current.state === 'busy' ? free() : { lock: current, changed: false, refused: false };
        if (action === 'takeoff') return current && !mine ? refuse() : set('flying');
        if (action === 'parked') return current && !mine ? refuse() : (mine && current.state === 'flying' ? set('landed') : { lock: current, changed: false, refused: false });
        // The pilot left the aircraft: free again (a manual reservation stays).
        if (action === 'left') return mine && ['busy', 'flying', 'landed'].includes(current.state) ? free() : { lock: current, changed: false, refused: false };
        return { lock: current, changed: false, refused: false };
    }

    function lockLabel(lock, now = Date.now()) {
        const current = activeLock(lock, now);
        return current ? LOCK_LABEL[current.state] : LOCK_LABEL.free;
    }

    // Finds the fleet aircraft the tracker flies. The mod keys by tail and sim title, but the
    // sim may report another title (livery suffix) or the livery's registration as ATC ID.
    // The title must always fit: one pilot may use the same registration on several types
    // (test 02.11.2026: Comanche and Dakota both "DEINA"). Order: tail + similar title, then a
    // similar title near the parking spot (sim reports the livery registration).
    const plainTitle = value => lower(value).replace(/[^a-z0-9]+/g, '');
    function similarTitle(a, b) {
        const x = plainTitle(a), y = plainTitle(b);
        return Boolean(x && y) && (x === y || (Math.min(x.length, y.length) >= 6 && (x.includes(y) || y.includes(x))));
    }
    function matchAircraft(records, { title = '', tail = '', lat, lon } = {}) {
        const list = [...records];
        const r = lower(tail);
        const titleOf = record => record.pos?.title || titleFromKey(record.key);
        const tails = record => [record.pos?.tail, record.pos?.livery, record.pos?.liveryName, String(record.key).replace(/^tail:/, '').split('|')[0]].map(lower).filter(Boolean);
        const byTail = r ? list.filter(record => tails(record).includes(r)) : [];
        const exact = byTail.filter(record => similarTitle(titleOf(record), title));
        if (exact.length === 1) return exact[0].key;
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
        const placed = list.filter(record => Number.isFinite(record.pos?.lat) && Number.isFinite(record.pos?.lon));
        const near = placed.filter(record => similarTitle(titleOf(record), title) && distanceKm(record.pos, { lat, lon }) < 1);
        if (near.length === 1) return near[0].key;
        // Same type several times: the one parked right where the flight started.
        const here = near.filter(record => distanceKm(record.pos, { lat, lon }) < 0.15);
        return here.length === 1 ? here[0].key : null;
    }

    function distanceKm(a, b) {
        const rad = Math.PI / 180;
        const dLat = (b.lat - a.lat) * rad, dLon = (b.lon - a.lon) * rad;
        const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
        return 12742 * Math.asin(Math.min(1, Math.sqrt(h)));
    }

    // Removed by its owner: the record stays as a marker (removed: true) for 30 days, so every
    // client learns it; it is never uploaded again - unless a pilot takes it out of his mod
    // hangar and adds it again ("re-added"): then it is back, with him as owner.
    const REMOVED_KEEP_MS = 30 * 24 * 60 * 60 * 1000;
    const isRemoved = record => record?.removed === true;

    // What other pilots changed between two states of the crew fleet, as short lines for a
    // notice ("DEINA in der Luft (Tester)"). Own changes are never reported.
    function changeNotes(previous, changed, me, now = Date.now()) {
        const notes = [];
        const mine = id => lower(id) && lower(id) === lower(me);
        for (const record of changed || []) {
            const old = previous.get(record.key);
            const tail = record.pos?.tail || String(record.key).replace(/^tail:/, '').split('|')[0] || titleFromKey(record.key);
            if (isRemoved(record)) {
                if (old && !isRemoved(old) && !mine(record.removedBy)) notes.push(`${tail} aus der Flotte entfernt${record.removedNick ? ` (${record.removedNick})` : ''}`);
                continue;
            }
            if (isRemoved(old)) {
                if (!mine(record.ownerPilotId)) notes.push(`${tail} wieder in der Flotte${record.ownerNick ? ` (${record.ownerNick})` : ''}`);
                continue;
            }
            if (!old) {
                if (!mine(record.lastPilotId)) notes.push(`${tail} neu in der Flotte${record.lastNick ? ` (${record.lastNick})` : ''}`);
                continue;
            }
            const lockNow = activeLock(record.lock, now), lockOld = activeLock(old.lock, now);
            const lockChanged = (lockNow?.state || 'free') !== (lockOld?.state || 'free') || lower(lockNow?.pilotId) !== lower(lockOld?.pilotId);
            if (record.conflict?.at && record.conflict.at !== old.conflict?.at && !mine(record.conflict.pilotId)) {
                notes.push(`${tail} auch von ${record.conflict.nick || 'Crew'} ${record.conflict.event === 'takeoff' ? 'geflogen' : 'genutzt'}`);
            } else if (lockChanged) {
                const actor = lockNow || lockOld;
                if (!mine(actor.pilotId)) notes.push(lockNow ? `${tail} ${NOTE_LABEL[lockNow.state]} (${lockNow.nick || 'Crew'})` : `${tail} wieder frei`);
            } else if (record.pos && old.pos && !samePlace(old.pos, record.pos) && !mine(record.lastPilotId)) {
                notes.push(`${tail} neuer Standort${record.lastNick ? ` (${record.lastNick})` : ''}`);
            }
        }
        return notes;
    }

    function noticeText(notes) {
        if (!notes.length) return '';
        const shown = notes.slice(0, 3).join(' · ');
        return `Vereinsflotte geändert: ${shown}${notes.length > 3 ? ` · +${notes.length - 3} weitere` : ''}. Bitte aktualisieren.`;
    }

    return {
        HEADER, FORMAT, MAX_RECORDS, MAX_FLIGHTS, LOCK_MS, LOCK_LABEL, REMOVED_KEEP_MS, isRemoved, changeNotes, noticeText,
        activeLock, lockHolder, blockedFor, applyLock, lockLabel, matchAircraft, distanceKm,
        validKey, cleanPos, cleanLog, canonical, recordSignature,
        mergePos, mergeLog, mergeRecord, uniteFlights,
        parseBackup, serializeBackup, parseStatePositions, parseStateRecords, samePlace, titleFromKey
    };
});
