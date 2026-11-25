#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const toolDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(toolDir, '..');
const mapSource = fs.readFileSync(path.join(rootDir, 'map.js'), 'utf8');

function extractFunctionDeclaration(source, name) {
    const marker = `function ${name}(`;
    const start = source.indexOf(marker);
    assert.ok(start >= 0, `${name} fehlt`);
    const signatureEnd = source.indexOf(') {', start);
    assert.ok(signatureEnd >= 0, `${name}: Signatur nicht abgeschlossen`);
    const bodyStart = signatureEnd + 2;
    let depth = 0;
    for (let index = bodyStart; index < source.length; index += 1) {
        const char = source[index];
        if (char === '{') depth += 1;
        if (char === '}') {
            depth -= 1;
            if (depth === 0) return source.slice(start, index + 1);
        }
    }
    throw new Error(`${name}: Funktionskörper nicht abgeschlossen`);
}

let primaryMode = 'error';
let backupMode = 'ok';
class FakeImage {
    constructor() {
        this.alt = '';
        this.dataset = {};
        this.onload = null;
        this.onerror = null;
    }

    setAttribute() {}

    set src(value) {
        this._src = String(value);
        if (this._src.includes('primary') && primaryMode === 'error') {
            queueMicrotask(() => this.onerror?.(new Error('primary failed')));
        } else if (this._src.includes('primary') && primaryMode === 'slow') {
            // Arrives after the primary timeout, but before the backup.
            setTimeout(() => this.onload?.(), 15);
        } else if (this._src.includes('primary') && primaryMode === 'ok') {
            queueMicrotask(() => this.onload?.());
        } else if (this._src.includes('backup') && backupMode === 'error') {
            queueMicrotask(() => this.onerror?.(new Error('backup failed')));
        } else if (this._src.includes('backup') && backupMode === 'slow') {
            setTimeout(() => this.onload?.(), 25);
        } else if (this._src.includes('backup')) {
            queueMicrotask(() => this.onload?.());
        }
    }

    get src() {
        return this._src;
    }
}

class FakeTileLayer {
    constructor(url, options = {}) {
        this._url = url;
        this.options = options;
    }

    static extend(methods) {
        class ExtendedTileLayer extends FakeTileLayer {}
        Object.assign(ExtendedTileLayer.prototype, methods);
        return ExtendedTileLayer;
    }

    _getZoomForUrl() {
        return 9;
    }

    getTileUrl(coords) {
        return this._url
            .replace('{s}', 'a')
            .replace('{z}', String(coords.z))
            .replace('{x}', String(coords.x))
            .replace('{y}', String(coords.y));
    }
}

const state = {
    primaryLoaded: 0,
    primaryErrors: 0,
    primaryTimeouts: 0,
    fallbackRequests: 0,
    fallbackLoaded: 0,
    fallbackErrors: 0
};
const context = vm.createContext({
    document: { createElement: () => new FakeImage() },
    Image: FakeImage,
    window: {},
    L: {
        TileLayer: FakeTileLayer,
        Util: {
            template: (template, values) => template
                .replace('{z}', String(values.z))
                .replace('{x}', String(values.x))
                .replace('{y}', String(values.y))
        }
    },
    OPEN_TOPO_PRIMARY_TILE_URL: 'https://primary/{z}/{x}/{y}.png',
    OPEN_TOPO_BACKUP_TILE_URL: 'https://backup/{z}/{x}/{y}.png',
    OPEN_TOPO_PRIMARY_TIMEOUT_MS: 10,
    OPEN_TOPO_BACKUP_TIMEOUT_MS: 30,
    OPEN_TOPO_TILE_DEADLINE_MS: 200,
    openTopoTileState: state,
    setTimeout,
    clearTimeout,
    Error
});
vm.runInContext(extractFunctionDeclaration(mapSource, 'createResilientOpenTopoLayer'), context);

async function loadFixture(mode, backup = 'ok') {
    primaryMode = mode;
    backupMode = backup;
    const layer = context.createResilientOpenTopoLayer();
    return new Promise((resolve, reject) => {
        const tile = layer.createTile({ z: 9, x: 270, y: 170 }, (error) => {
            if (error) reject(error);
            else resolve(tile);
        });
    });
}

const errorFallbackTile = await loadFixture('error');
assert.equal(errorFallbackTile.dataset.gaTopoSource, 'backup');
assert.match(errorFallbackTile.src, /^https:\/\/backup\//);
assert.equal(state.primaryErrors, 1);
assert.equal(state.fallbackRequests, 1);
assert.equal(state.fallbackLoaded, 1);

const timeoutFallbackTile = await loadFixture('timeout');
assert.equal(timeoutFallbackTile.dataset.gaTopoSource, 'backup');
assert.equal(state.primaryTimeouts, 1);
assert.equal(state.fallbackRequests, 2);
assert.equal(state.fallbackLoaded, 2);
assert.equal(state.fallbackErrors, 0);

// A slow primary is not cut off: when it arrives before the backup it is shown.
const slowPrimaryTile = await loadFixture('slow', 'slow');
assert.equal(slowPrimaryTile.dataset.gaTopoSource, 'primary');
assert.match(slowPrimaryTile.src, /^https:\/\/primary\//);
assert.equal(state.primaryTimeouts, 2);
assert.equal(state.primaryLoaded, 1);

// Both sources fail: the tile reports an error once, and _gaRetryLoad loads it again.
primaryMode = 'error';
backupMode = 'error';
const failedLayer = context.createResilientOpenTopoLayer();
const results = [];
let failedTile = null;
await new Promise((resolve) => {
    failedTile = failedLayer.createTile({ z: 9, x: 271, y: 170 }, (error) => {
        results.push(error ? 'error' : 'ok');
        resolve();
    });
});
assert.deepEqual(results, ['error']);
assert.equal(typeof failedTile._gaRetryLoad, 'function');
primaryMode = 'ok';
backupMode = 'ok';
await new Promise((resolve) => {
    const check = () => (results.length >= 2 ? resolve() : setTimeout(check, 5));
    failedTile._gaRetryLoad();
    check();
});
assert.deepEqual(results, ['error', 'ok']);
assert.equal(failedTile.dataset.gaTopoSource, 'primary');

console.log('OpenTopoMap tile fallback ok: error/timeout recover through backup, slow primary kept, failed tile reloads');
