/* Shared Web/EFB preference sync. Radio tuning itself remains explicit. */
(function() {
    'use strict';
    const nativeEfb = document.body.classList.contains('ga-efb-tracker-host');
    let identity = '', cloud = null, pendingKey = '', busy = false, generation = 0, nativePending = null;
    function visible() { return document.visibilityState !== 'hidden'; }
    async function request(url, init) {
        // Coherent (MSFS EFB) may lack AbortController; without this guard every
        // request threw and the EFB choice never reached the Tracker.
        const controller = typeof AbortController === 'function' ? new AbortController() : null;
        let timeout = null;
        const deadline = new Promise((_, reject) => {
            timeout = setTimeout(() => { if (controller) controller.abort(); reject(new Error('navcom_request_timeout')); }, 15000);
        });
        try {
            return await Promise.race([deadline, (async () => {
                const response = await fetch(url, { ...init, ...(controller ? { signal: controller.signal } : {}), cache: 'no-store' });
                const data = JSON.parse(await response.text());
                return { ok: response.ok, status: response.status, json: async () => data };
            })()]);
        } finally { clearTimeout(timeout); }
    }
    function connect() {
        if (nativeEfb) return true;
        const id = typeof getSyncId === 'function' ? getSyncId() : '';
        const pin = typeof getSyncPin === 'function' ? getSyncPin() : '';
        const next = JSON.stringify([id, pin]);
        if (next !== identity) {
            identity = next; generation++;
            pendingKey = 'ga_navcom_pending_v1:' + id.toUpperCase(); cloud = null;
            if (id && pin && window.GACloudSyncClient && window.GANavcomPreferencesCore) {
                const baseUrl = (typeof SYNC_URL === 'string' ? SYNC_URL : 'https://ga-proxy.einherjer.workers.dev/api/sync/');
                const client = window.GACloudSyncClient.create({ request, pilotId: id, pin, baseUrl: baseUrl.replace(/\/sync\/?$/, '/sync-v2/') });
                cloud = window.GANavcomPreferencesCore.createCloud({ client, readLegacy: async () => {
                    const response = await request(baseUrl + encodeURIComponent(id), { headers: { 'X-Pilot-PIN': pin } });
                    if (!response.ok) throw new Error('navcom_profile_unavailable');
                    return response.json();
                } });
            }
        }
        return !!cloud;
    }
    function readPending() {
        try { return JSON.parse(localStorage.getItem(pendingKey) || 'null'); } catch (_) { return null; }
    }
    async function sync() {
        if (!visible() || busy || !connect() || typeof window.gaSetNavcomMode !== 'function') return;
        busy = true;
        const epoch = generation, key = pendingKey, adapter = cloud;
        try {
            let mode;
            if (nativeEfb) {
                const pending = nativePending;
                if (pending !== null) {
                    const saved = await request('/api/v1/navcom/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: pending }) });
                    const result = await saved.json();
                    if (!saved.ok || !result.ok) throw new Error('navcom_settings_write_failed');
                    if (nativePending === pending) nativePending = null;
                }
                const response = await request('/api/v1/navcom/settings');
                if (!response.ok) throw new Error('navcom_settings_unavailable');
                mode = (await response.json()).mode;
            } else {
                const pending = readPending();
                if (pending) {
                    await adapter.write(pending.mode);
                    if (localStorage.getItem(key) === JSON.stringify(pending)) localStorage.removeItem(key);
                    mode = pending.mode;
                } else mode = await adapter.read();
            }
            connect();
            if (epoch === generation && (nativeEfb ? nativePending === null : !readPending())) window.gaSetNavcomMode(mode, false);
        } catch (_) { /* Retain the local choice/pending write while offline. */ }
        finally { busy = false; }
    }
    window.gaPersistNavcomMode = function(mode) {
        connect(); generation++;
        if (nativeEfb) {
            nativePending = mode;
            void sync();
        } else if (cloud) {
            try { localStorage.setItem(pendingKey, JSON.stringify({ mode, at: Date.now() })); } catch (_) {}
            void sync();
        }
    };
    function install() {
        void sync();
        setInterval(sync, 15000);
        document.addEventListener('visibilitychange', () => { if (visible()) void sync(); });
        window.addEventListener('pageshow', sync);
        window.addEventListener('online', sync);
        window.addEventListener('storage', () => { connect(); void sync(); });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install); else install();
})();
