(function initRelayCompression(root, factory) {
    const api = factory(root);
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.gaRelayCompression = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createRelayCompression(defaultEnvironment) {
    'use strict';

    const CAPABILITY = 'gzip-base64-v1';
    const MESSAGE_TYPE = 'relay_compressed';
    const MAX_COMPRESSED_BASE64_CHARS = 1024 * 1024;
    const MAX_DECOMPRESSED_CHARS = 2 * 1024 * 1024;

    function supports(environment = defaultEnvironment) {
        try {
            if (
                typeof environment?.DecompressionStream !== 'function'
                || typeof environment?.Response !== 'function'
                || typeof environment?.atob !== 'function'
            ) return false;
            new environment.DecompressionStream('gzip');
            return true;
        } catch (_) {
            return false;
        }
    }

    function advertisedCapabilities(environment = defaultEnvironment) {
        return supports(environment) ? [CAPABILITY] : [];
    }

    function decodeBase64(payload, environment = defaultEnvironment) {
        const binary = environment.atob(payload);
        const bytes = new Uint8Array(binary.length);
        for (let index = 0; index < binary.length; index += 1) {
            bytes[index] = binary.charCodeAt(index);
        }
        return bytes;
    }

    async function gunzipText(payload, environment = defaultEnvironment) {
        if (!supports(environment)) throw new Error('relay_gzip_unsupported');
        if (typeof payload !== 'string' || !payload.length) throw new Error('relay_gzip_payload_missing');
        if (payload.length > MAX_COMPRESSED_BASE64_CHARS) throw new Error('relay_gzip_payload_too_large');

        const bytes = decodeBase64(payload, environment);
        const source = new environment.Response(bytes).body;
        if (!source || typeof source.pipeThrough !== 'function') throw new Error('relay_gzip_stream_unavailable');
        const stream = source.pipeThrough(new environment.DecompressionStream('gzip'));
        const text = await new environment.Response(stream).text();
        if (text.length > MAX_DECOMPRESSED_CHARS) throw new Error('relay_gzip_result_too_large');
        return text;
    }

    async function decode(raw, environment = defaultEnvironment) {
        const outer = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (!outer || typeof outer !== 'object' || outer.type !== MESSAGE_TYPE) return outer;
        if (outer.encoding !== CAPABILITY) throw new Error('relay_gzip_encoding_unsupported');

        const decoded = JSON.parse(await gunzipText(outer.payload, environment));
        if (!decoded || typeof decoded !== 'object') throw new Error('relay_gzip_result_invalid');
        if (outer.originalType && decoded.type !== outer.originalType) {
            throw new Error('relay_gzip_type_mismatch');
        }
        return decoded;
    }

    return {
        CAPABILITY,
        MESSAGE_TYPE,
        MAX_COMPRESSED_BASE64_CHARS,
        MAX_DECOMPRESSED_CHARS,
        advertisedCapabilities,
        decode,
        supports
    };
});
