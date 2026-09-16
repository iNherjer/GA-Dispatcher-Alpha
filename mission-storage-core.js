/* Local cache budgets and full mission fallback. No mission semantics are changed. */
(function(root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    root.GAMissionStorageCore = api;
})(globalThis, function() {
    'use strict';
    const PREFIX = 'ga_target_geo_context_v4_';
    const TTL = 12 * 60 * 60 * 1000;
    const MAX_BYTES = 512 * 1024, MAX_ENTRIES = 32;
    function prune(store, { now = Date.now(), reserveBytes = 0, reserveEntries = 0, all = false } = {}) {
        const entries = []; let removed = 0, freedBytes = 0, total = 0;
        const drop = entry => { store.removeItem(entry.key); removed++; freedBytes += entry.bytes; };
        for (let i = store.length - 1; i >= 0; i--) {
            const key = store.key(i); if (!key?.startsWith(PREFIX)) continue;
            const raw = store.getItem(key) || '', bytes = (key.length + raw.length) * 2;
            let at = 0; try { at = Number(JSON.parse(raw).fetchedAt); } catch (_) {}
            const entry = { key, bytes, at };
            if (all || !Number.isFinite(at) || at <= 0 || at > now || now - at >= TTL) drop(entry);
            else { entries.push(entry); total += bytes; }
        }
        entries.sort((a,b) => a.at - b.at || a.key.localeCompare(b.key));
        while (entries.length && (total + reserveBytes > MAX_BYTES || entries.length + reserveEntries > MAX_ENTRIES)) {
            const entry = entries.shift(); drop(entry); total -= entry.bytes;
        }
        return { removed, freedBytes, bytes: total, entries: entries.length };
    }
    function writeGeo(store, key, value) {
        if (!key.startsWith(PREFIX)) throw new Error('geo_cache_key_invalid');
        const raw = JSON.stringify(value), bytes = (key.length + raw.length) * 2;
        store.removeItem(key);
        prune(store, { reserveBytes: Math.min(bytes, MAX_BYTES), reserveEntries: 1 });
        if (bytes > MAX_BYTES) return false; // Cache only: caller retains the original value.
        try { store.setItem(key, raw); return true; }
        catch (_) { prune(store, { all: true }); try { store.setItem(key, raw); return true; } catch (_) { return false; } }
    }
    function createVault(indexedDB) {
        let opening, queue = Promise.resolve();
        function open() {
            if (!indexedDB) return Promise.reject(new Error('IndexedDB nicht verfuegbar'));
            if (!opening) opening = new Promise((resolve, reject) => {
                const request = indexedDB.open('ga-full-mission-v1', 1);
                request.onupgradeneeded = () => request.result.createObjectStore('snapshots');
                request.onerror = () => reject(request.error);
                request.onblocked = () => reject(new Error('Missionsspeicher blockiert'));
                request.onsuccess = () => { request.result.onversionchange = () => { request.result.close(); opening = null; }; resolve(request.result); };
            }).catch(error => { opening = null; throw error; });
            return opening;
        }
        function schedule(fn) { const result = queue.then(fn); queue = result.catch(() => {}); return result; }
        function save(state) {
            const token = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}-${Math.random()}`;
            const snapshot = JSON.parse(JSON.stringify(state));
            const ready = schedule(async () => {
                const db = await open();
                await new Promise((resolve, reject) => {
                    const tx = db.transaction('snapshots', 'readwrite'), store = tx.objectStore('snapshots');
                    const old = store.get('current');
                    old.onsuccess = () => {
                        if (old.result) store.put(old.result, 'previous');
                        store.put({ token, state: snapshot }, 'current');
                    };
                    tx.oncomplete = resolve; tx.onerror = tx.onabort = () => reject(tx.error || new Error('Missionsspeicherung abgebrochen'));
                });
            });
            return { token, ready };
        }
        function load(token) {
            return schedule(async () => {
                const db = await open();
                return new Promise((resolve, reject) => {
                    const tx = db.transaction('snapshots', 'readonly'), store = tx.objectStore('snapshots'); let match;
                    for (const key of ['current', 'previous']) { const req = store.get(key); req.onsuccess = () => { if (req.result?.token === token) match = req.result.state; }; }
                    tx.oncomplete = () => match ? resolve(match) : reject(new Error('Vollstaendiger Missionsstand fehlt; bitte Cloud-Stand laden.'));
                    tx.onerror = tx.onabort = () => reject(tx.error || new Error('Missionsspeicher nicht lesbar'));
                });
            });
        }
        return { save, load };
    }
    return { PREFIX, TTL, MAX_BYTES, MAX_ENTRIES, prune, writeGeo, createVault };
});
