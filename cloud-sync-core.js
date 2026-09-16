/* Lossless profile transport. Shared by web, Tracker and Worker. No credentials in packages. */
(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    root.GACloudSyncCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';
    const CHUNK_BYTES = 48 * 1024;
    const MAX_BYTES = 8 * 1024 * 1024;
    const MAX_CHUNKS = 256;
    const encoder = new TextEncoder();
    const decoder = new TextDecoder('utf-8', { fatal: true });
    const hashPattern = /^[a-f0-9]{64}$/;
    function canonical(value) {
        if (Array.isArray(value)) return value.map(canonical);
        if (value && typeof value === 'object') {
            const out = Object.create(null);
            for (const key of Object.keys(value).sort()) out[key] = canonical(value[key]);
            return out;
        }
        return value;
    }
    function stringify(value) { return JSON.stringify(canonical(value)); }
    async function hash(bytes) {
        const cryptoApi = typeof require === 'function' ? require('node:crypto').webcrypto : globalThis.crypto;
        return Array.from(new Uint8Array(await cryptoApi.subtle.digest('SHA-256', bytes)), n => n.toString(16).padStart(2, '0')).join('');
    }
    function base64(bytes) {
        if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64');
        let text = ''; for (const byte of bytes) text += String.fromCharCode(byte);
        return btoa(text);
    }
    function unbase64(text) {
        if (typeof text !== 'string' || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(text)) throw new Error('invalid_base64');
        return typeof Buffer !== 'undefined' ? new Uint8Array(Buffer.from(text, 'base64')) : Uint8Array.from(atob(text), c => c.charCodeAt(0));
    }
    async function transform(bytes, decompress) {
        if (typeof require === 'function') {
            const zlib = require('node:zlib');
            return new Uint8Array(decompress ? zlib.gunzipSync(bytes, { maxOutputLength: MAX_BYTES }) : zlib.gzipSync(bytes));
        }
        const stream = new Blob([bytes]).stream().pipeThrough(decompress ? new DecompressionStream('gzip') : new CompressionStream('gzip'));
        const reader = stream.getReader(), parts = []; let size = 0;
        try {
            for (;;) {
                const { value, done } = await reader.read(); if (done) break;
                size += value.length; if (size > MAX_BYTES + (decompress ? 0 : 65536)) throw new Error('profile_too_large');
                parts.push(value);
            }
        } catch (e) { await reader.cancel().catch(() => {}); throw e; }
        const out = new Uint8Array(size); let offset = 0;
        for (const part of parts) { out.set(part, offset); offset += part.length; }
        return out;
    }
    async function pack(profile) {
        const source = JSON.parse(JSON.stringify(profile));
        delete source.pin; delete source.syncId;
        const sections = Object.create(null), chunks = Object.create(null); let total = 0;
        // Mission and start seed must always travel and become visible together.
        const groups = { mission: { activeMission: source.activeMission ?? null, activeMissionTrackerSeed: source.activeMissionTrackerSeed ?? null } };
        delete source.activeMission; delete source.activeMissionTrackerSeed;
        for (const key of Object.keys(source)) groups['field:' + key] = source[key];
        for (const [name, value] of Object.entries(groups)) {
            const raw = encoder.encode(stringify(value)); total += raw.length;
            if (total > MAX_BYTES) throw new Error('profile_too_large');
            let bytes = raw, encoding = 'json';
            if (typeof require === 'function' || typeof CompressionStream === 'function') {
                const compressed = await transform(raw, false);
                if (compressed.length < raw.length) { bytes = compressed; encoding = 'gzip'; }
            }
            const ids = [];
            for (let offset = 0; offset < bytes.length; offset += CHUNK_BYTES) {
                const part = bytes.slice(offset, offset + CHUNK_BYTES), id = await hash(part);
                ids.push(id); chunks[id] = base64(part);
            }
            sections[name] = { encoding, bytes: raw.length, hash: await hash(raw), chunks: ids };
        }
        const manifest = { version: 2, sections };
        validate(manifest);
        return { manifest, chunks, bytes: total };
    }
    function validate(manifest) {
        if (manifest?.version !== 2 || !manifest.sections || typeof manifest.sections !== 'object' || Array.isArray(manifest.sections)) throw new Error('manifest_invalid');
        const entries = Object.entries(manifest.sections);
        if (!entries.length || entries.length > 64 || !manifest.sections.mission) throw new Error('manifest_invalid');
        let total = 0, count = 0;
        for (const [name, section] of entries) {
            if (!(name === 'mission' || /^field:[A-Za-z][A-Za-z0-9_]{0,79}$/.test(name)) || ['field:pin', 'field:syncId', 'field:activeMission', 'field:activeMissionTrackerSeed', 'field:__proto__'].includes(name)) throw new Error('section_invalid');
            if (!section || !['json', 'gzip'].includes(section.encoding) || !hashPattern.test(section.hash) || !Number.isSafeInteger(section.bytes) || section.bytes < 1 || !Array.isArray(section.chunks) || !section.chunks.length || section.chunks.some(id => !hashPattern.test(id))) throw new Error('section_invalid');
            total += section.bytes; count += section.chunks.length;
        }
        if (total > MAX_BYTES || count > MAX_CHUNKS) throw new Error('profile_too_large');
        return true;
    }
    async function unpack(manifest, getChunk, names = null) {
        validate(manifest); const out = Object.create(null);
        for (const [name, section] of Object.entries(manifest.sections)) {
            if (names && !names.includes(name)) continue;
            const parts = []; let size = 0;
            for (const id of section.chunks) {
                const part = unbase64(await getChunk(id));
                if (part.length > CHUNK_BYTES || await hash(part) !== id) throw new Error('chunk_integrity');
                parts.push(part); size += part.length;
            }
            let raw = new Uint8Array(size); let offset = 0;
            for (const part of parts) { raw.set(part, offset); offset += part.length; }
            if (section.encoding === 'gzip') raw = await transform(raw, true);
            if (raw.length !== section.bytes || await hash(raw) !== section.hash) throw new Error('section_integrity');
            const value = JSON.parse(decoder.decode(raw));
            if (name === 'mission') {
                if (!value || !Object.hasOwn(value, 'activeMission') || !Object.hasOwn(value, 'activeMissionTrackerSeed')) throw new Error('mission_section_invalid');
                out.activeMission = value.activeMission; out.activeMissionTrackerSeed = value.activeMissionTrackerSeed;
            } else out[name.slice(6)] = value;
        }
        return out;
    }
    return { CHUNK_BYTES, MAX_BYTES, MAX_CHUNKS, hashPattern, hash, pack, unpack, validate, stringify, unbase64 };
});
