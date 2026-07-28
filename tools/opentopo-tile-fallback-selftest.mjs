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
    openTopoTileState: state,
    setTimeout,
    clearTimeout,
    Error
});
vm.runInContext(extractFunctionDeclaration(mapSource, 'createResilientOpenTopoLayer'), context);

async function loadFixture(mode) {
    primaryMode = mode;
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

console.log('OpenTopoMap tile fallback ok: primary error and timeout recover through backup');
