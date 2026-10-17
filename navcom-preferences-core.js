/* Presentation preference shared by browser and Tracker. No radio commands. */
(function(root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.GANavcomPreferencesCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
    'use strict';
    function validMode(mode) { return ['off', 'direct', 'select'].includes(mode); }
    function createCloud({ client, readLegacy }) {
        async function ensureProfile() {
            let result = await client.read(['field:navcomMode']);
            if (!result.migrated) {
                const legacy = await readLegacy();
                if (!legacy || typeof legacy !== 'object' || Array.isArray(legacy)) throw new Error('navcom_profile_unavailable');
                await client.write(legacy, { expectedRevision: 0, legacyTime: legacy.lastModified || 0 });
                result = await client.read(['field:navcomMode']);
            }
            return result.profile;
        }
        return {
            async read() {
                const profile = await ensureProfile();
                return validMode(profile.navcomMode) ? profile.navcomMode : null;
            },
            async write(mode) {
                if (!validMode(mode)) throw new Error('invalid_navcom_mode');
                await ensureProfile();
                await client.patchFields({ navcomMode: mode });
                return mode;
            }
        };
    }
    return { validMode, createCloud };
});
