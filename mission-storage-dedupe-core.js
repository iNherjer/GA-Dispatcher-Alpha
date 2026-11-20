/* Storage-only deduplication of mission states (ga_active_mission, local mission draft).
 *
 * A mission state carries the same large objects several times (activeMissionContract next to
 * currentMissionData.missionContract, missionPlanV4 next to missionContractV4, contract fields next
 * to the same fields in currentMissionData). The program keeps working with these separate copies;
 * only the stored text replaces later identical objects by a reference to the first one:
 *
 *   {"__gaDedupe":1,"data":<state with {"$gaRef":[path]} in place of repeated objects>}
 *
 * Reading restores separate copies, and the restored text is byte-identical to what was written:
 * packText() unpacks its own result and stores the plain text whenever that check fails.
 * Plain (older) texts pass through unchanged.
 */
(function(root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    root.GAMissionStorageDedupe = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
    'use strict';
    const MARKER = '{"__gaDedupe":1,';
    const REF = '$gaRef';
    const MIN_CHARS = 512;   // smaller repeats are not worth a reference
    const MAX_DEPTH = 7;     // state.currentMissionData.missionContract.missionContractV4... is depth 4

    function isContainer(value) { return value !== null && typeof value === 'object'; }
    function isRef(value) {
        if (!isContainer(value) || Array.isArray(value)) return false;
        const keys = Object.keys(value);
        return keys.length === 1 && keys[0] === REF && Array.isArray(value[REF]);
    }

    // Pre-order walk: the first occurrence of an object stays, later identical ones become references.
    // A canonical node is never inside a replaced subtree, so every path resolves in the packed tree.
    function pack(state) {
        const seen = new Map();
        let refs = 0;
        function walk(node, path, depth) {
            if (!isContainer(node) || depth > MAX_DEPTH) return node;
            if (depth > 0) {
                const text = JSON.stringify(node);
                if (text.length >= MIN_CHARS) {
                    const first = seen.get(text);
                    if (first) { refs++; return { [REF]: first.slice() }; }
                    seen.set(text, path.slice());
                }
            }
            if (Array.isArray(node)) return node.map((child, i) => walk(child, path.concat(i), depth + 1));
            const out = {};
            for (const key of Object.keys(node)) out[key] = walk(node[key], path.concat(key), depth + 1);
            return out;
        }
        const data = walk(state, [], 0);
        return { data, refs };
    }

    function unpack(data) {
        const memo = new Map();
        function at(path) {
            let node = data;
            for (const step of path) {
                if (!isContainer(node) || !(step in node)) throw new Error('dedupe_path_missing');
                node = node[step];
            }
            return node;
        }
        function resolve(path) {
            const key = JSON.stringify(path);
            if (memo.has(key)) return memo.get(key);
            memo.set(key, undefined); // cycle guard
            const value = materialize(at(path));
            memo.set(key, value);
            return value;
        }
        function materialize(node) {
            if (isRef(node)) {
                const target = resolve(node[REF]);
                if (target === undefined) throw new Error('dedupe_cycle');
                return JSON.parse(JSON.stringify(target));
            }
            if (!isContainer(node)) return node;
            if (Array.isArray(node)) return node.map(materialize);
            const out = {};
            for (const key of Object.keys(node)) out[key] = materialize(node[key]);
            return out;
        }
        return materialize(data);
    }

    function isPackedText(text) { return typeof text === 'string' && text.indexOf(MARKER) === 0; }

    // Text to store. Falls back to the plain text when nothing repeats, on any error, or when
    // unpacking does not reproduce the exact input.
    function packText(text) {
        if (typeof text !== 'string' || text.length < MIN_CHARS * 2 || isPackedText(text)) return text;
        try {
            const parsed = JSON.parse(text);
            if (!isContainer(parsed)) return text;
            const packed = pack(parsed);
            if (!packed.refs) return text;
            const out = JSON.stringify({ __gaDedupe: 1, data: packed.data });
            if (out.length >= text.length || unpackText(out) !== text) return text;
            return out;
        } catch (_) {
            return text;
        }
    }

    // Stored text back to the original JSON text (plain texts unchanged).
    function unpackText(text) {
        if (!isPackedText(text)) return text;
        const parsed = JSON.parse(text);
        return JSON.stringify(unpack(parsed.data));
    }

    // Storage wrapper for one key (draft store): same interface as localStorage.
    function wrapStorage(storage, key) {
        return {
            getItem(k) {
                const raw = storage.getItem(k);
                return k === key ? unpackText(raw) : raw;
            },
            setItem(k, v) { storage.setItem(k, k === key ? packText(String(v)) : v); },
            removeItem(k) { storage.removeItem(k); }
        };
    }

    return { pack, unpack, packText, unpackText, isPackedText, wrapStorage, MARKER, MIN_CHARS };
});

// Browser: the accepted mission (ga_active_mission) is read and written only through these two
// functions, so every caller keeps seeing the full plain JSON text. Callers guard with typeof,
// test harnesses without this file fall back to localStorage directly.
var GA_ACTIVE_MISSION_STORAGE_KEY = 'ga_active_mission';
var gaActiveMissionReadMemo = { raw: null, text: null };
function gaActiveMissionRead() {
    const raw = localStorage.getItem(GA_ACTIVE_MISSION_STORAGE_KEY);
    if (raw === null || !GAMissionStorageDedupe.isPackedText(raw)) return raw;
    if (gaActiveMissionReadMemo.raw === raw) return gaActiveMissionReadMemo.text;
    try {
        const text = GAMissionStorageDedupe.unpackText(raw);
        gaActiveMissionReadMemo = { raw, text };
        return text;
    } catch (error) {
        try { console.warn('[MISSION STORAGE] Gespeicherter Missionsstand nicht lesbar:', error && error.message); } catch (_) {}
        return null;
    }
}
// Throws like localStorage.setItem (quota), so the callers' fallbacks keep working.
function gaActiveMissionWrite(text) {
    const value = GAMissionStorageDedupe.packText(String(text));
    localStorage.setItem(GA_ACTIVE_MISSION_STORAGE_KEY, value);
    gaActiveMissionReadMemo = value === text ? { raw: null, text: null } : { raw: value, text: String(text) };
}
