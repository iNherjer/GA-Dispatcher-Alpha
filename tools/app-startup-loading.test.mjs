import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

function workerHarness() {
    const listeners = {}, requests = [], entries = new Map();
    const origin = 'https://inherjer.github.io';
    const base = `${origin}/GA-Dispatcher-alpha/sw.js`;
    const response = () => ({ status: 200, clone: response });
    const cache = {
        match: async key => entries.get(String(key)),
        put: async (key, value) => entries.set(String(key), value)
    };
    const context = {
        URL, Set, Promise,
        self: { location: { origin, href: base }, addEventListener: (name, fn) => listeners[name] = fn },
        caches: { open: async () => cache, match: async request => entries.get(request.url) },
        fetch: async request => { requests.push(request.url); return response(); }
    };
    vm.runInNewContext(fs.readFileSync('sw.js', 'utf8'), context);
    return { entries, requests, async request(path) {
        let result;
        const url = new URL(path, base).href;
        listeners.fetch({ request: { url, method: 'GET' }, respondWith: promise => result = promise });
        return { intercepted: !!result, response: result ? await result : null };
    } };
}

test('GitHub Pages app files use the installed cache including script query suffixes', async () => {
    const h = workerHarness(), cached = { cached: true };
    h.entries.set('https://inherjer.github.io/GA-Dispatcher-alpha/app.js', cached);
    assert.equal((await h.request('./app.js?v=current')).response, cached);
    assert.equal(h.requests.length, 0);
    await h.request('./taws.js?v=current');
    await h.request('./taws.js?v=current');
    assert.equal(h.requests.length, 1, 'cache misses still load, then reuse the file');
});

test('live APIs and map tiles retain their network path; current datasets remain network first', async () => {
    const h = workerHarness();
    assert.equal((await h.request('https://ga-proxy.einherjer.workers.dev/api/metar')).intercepted, false);
    assert.equal((await h.request('https://inherjer.github.io/GA-Dispatcher-Aviation-Data/live.json')).intercepted, false);
    assert.equal((await h.request('https://tile.openstreetmap.org/1/1/1.png')).intercepted, false);
    await h.request('./data/gafor-sector-dataset-de.json');
    await h.request('./data/gafor-sector-dataset-de.json');
    assert.equal(h.requests.length, 2);
});

function audioHarness() {
    const listeners = {}, timers = [];
    let loads = 0;
    const ctx = {
        state: 'suspended', destination: {}, resume() { this.state = 'running'; return Promise.resolve(); },
        createGain: () => ({ gain: {}, connect() {} })
    };
    const context = {
        console, Map, Set, Date, Math, Promise,
        localStorage: { getItem: () => null, setItem() {} },
        document: { readyState: 'loading', createElement: () => ({ getContext: () => ({}) }),
            addEventListener() {}, getElementById: () => null },
        AudioContext: function() { return ctx; },
        addEventListener: (name, fn) => listeners[name] = fn,
        setTimeout: (fn, delay) => { timers.push({ fn, delay }); return timers.length; }, clearTimeout() {},
        recordLoad: () => loads++
    };
    context.window = context;
    vm.createContext(context);
    for (const file of ['navigation-warning-audio.js', 'navigation-warning-core.js', 'taws.js']) {
        vm.runInContext(fs.readFileSync(file, 'utf8'), context);
    }
    vm.runInContext('_awLoadClips = () => { _awLoading = true; recordLoad(); };', context);
    return { context, ctx, listeners, timers, loads: () => loads };
}

test('iOS audio unlock stays immediate while warmup waits until after page load', () => {
    const h = audioHarness();
    h.context.awmEnsureAudioUnlocked();
    h.context.awmEnsureAudioUnlocked();
    assert.equal(h.ctx.state, 'running');
    assert.equal(h.loads(), 0);
    h.listeners.load();
    assert.equal(h.timers.length, 1, 'repeated unlocks do not schedule duplicate loads');
    assert.equal(h.timers[0].delay, 1500);
    h.timers[0].fn();
    assert.equal(h.loads(), 1);
});

test('early warnings load immediately and remain queued; muted devices skip warmup', () => {
    const h = audioHarness();
    vm.runInContext("_awEnqueue(['aw-wp-erreicht']);", h.context);
    assert.equal(h.loads(), 1);
    assert.equal(h.context.awmGetAudioQueueDebugState().queueDepth, 1);
    h.listeners.load();
    h.timers[0].fn();
    assert.equal(h.loads(), 1, 'warmup does not duplicate an on-demand load');
    const muted = audioHarness();
    muted.context.awmEnsureAudioUnlocked();
    muted.context.awmSetPlayOnThisDevice(false);
    muted.listeners.load();
    muted.timers[0].fn();
    assert.equal(muted.loads(), 0);
});
