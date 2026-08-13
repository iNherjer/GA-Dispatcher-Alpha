(function initRelayFailoverCore(root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.gaRelayFailover = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createRelayFailoverCore() {
    'use strict';

    const PRIMARY_RELAY_KEY = 'cloudflare';
    const FALLBACK_RELAY_KEY = 'render';
    const ENDPOINTS = Object.freeze({
        cloudflare: Object.freeze({
            key: 'cloudflare',
            code: 'C',
            label: 'Cloudflare',
            url: 'wss://ga-relay.einherjer.workers.dev/'
        }),
        render: Object.freeze({
            key: 'render',
            code: 'R',
            label: 'Render',
            url: 'wss://websocketrelais.onrender.com/',
            wakeUrl: 'https://websocketrelais.onrender.com/'
        })
    });

    function normalizeRelayKey(value, fallback = PRIMARY_RELAY_KEY) {
        const key = String(value || '').trim().toLowerCase();
        return ENDPOINTS[key] ? key : fallback;
    }

    function endpoint(value) {
        return ENDPOINTS[normalizeRelayKey(value)];
    }

    function alternateRelayKey(value) {
        return normalizeRelayKey(value) === PRIMARY_RELAY_KEY
            ? FALLBACK_RELAY_KEY
            : PRIMARY_RELAY_KEY;
    }

    function normalizeSyncId(value) {
        return String(value || '').trim().toUpperCase();
    }

    async function sha256Hex(value) {
        const subtle = globalThis?.crypto?.subtle;
        if (!subtle) throw new Error('SHA-256 ist in diesem Browser nicht verfügbar.');
        const bytes = new TextEncoder().encode(String(value || ''));
        const digest = await subtle.digest('SHA-256', bytes);
        return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
    }

    async function roomKeyForSyncId(syncId) {
        const normalized = normalizeSyncId(syncId);
        if (!normalized) throw new Error('Eine Pilot-ID wird für die Relay-Verbindung benötigt.');
        return sha256Hex(normalized);
    }

    async function websocketUrl(relayKey, syncId) {
        const target = endpoint(relayKey);
        if (target.key !== PRIMARY_RELAY_KEY) return target.url;
        const url = new URL(target.url);
        url.searchParams.set('room', await roomKeyForSyncId(syncId));
        return url.toString();
    }

    function indicatorCode(relayKey) {
        return endpoint(relayKey).code;
    }

    function indicatorLabel(relayKey) {
        return endpoint(relayKey).label;
    }

    function indicatorConnectionLabel(versionLabel, relayKey) {
        return [String(versionLabel || '').trim(), indicatorCode(relayKey)].filter(Boolean).join(' ');
    }

    function relayAfterDisconnect(relayKey, fatal = false) {
        const current = normalizeRelayKey(relayKey);
        return current === PRIMARY_RELAY_KEY && fatal !== true ? FALLBACK_RELAY_KEY : current;
    }

    return Object.freeze({
        PRIMARY_RELAY_KEY,
        FALLBACK_RELAY_KEY,
        ENDPOINTS,
        alternateRelayKey,
        endpoint,
        indicatorCode,
        indicatorConnectionLabel,
        indicatorLabel,
        normalizeRelayKey,
        normalizeSyncId,
        roomKeyForSyncId,
        relayAfterDisconnect,
        websocketUrl
    });
});
