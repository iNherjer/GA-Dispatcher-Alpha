import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const events = [];
const sources = [];
const storage = new Map();
const context = {
    console,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    Math,
    Date,
    Promise,
    Map,
    Set,
    Uint8ClampedArray,
    localStorage: {
        getItem: key => storage.get(key) ?? null,
        setItem: (key, value) => storage.set(key, String(value))
    },
    document: {
        createElement: () => ({
            width: 0,
            height: 0,
            getContext: () => ({})
        }),
        addEventListener: () => {},
        getElementById: () => null
    }
};
context.window = context;
vm.createContext(context);
vm.runInContext(fs.readFileSync('taws.js', 'utf8'), context, { filename: 'taws.js' });

class FakeSource {
    constructor() {
        this.buffer = null;
        this.onended = null;
    }
    connect() {}
    disconnect() {}
    start() {
        events.push(`start:${this.buffer.id}`);
        sources.push(this);
    }
    stop() {
        events.push(`stop:${this.buffer.id}`);
    }
}

const fakeCtx = {
    state: 'running',
    currentTime: 10,
    destination: {},
    createBufferSource: () => new FakeSource()
};
context.fakeCtx = fakeCtx;

vm.runInContext(`
    _tawsAudioCtx = fakeCtx;
    _awmMasterGain = fakeCtx.destination;
    _awLoaded = false;
    _awLoading = true;
    _awBuffers['aw-wp-erreicht'] = { id: 'aw-wp-erreicht' };
    _awBuffers['aw-neuer-kurs'] = { id: 'aw-neuer-kurs' };
    _awBuffers['aw-d0'] = { id: 'aw-d0' };
    _awBuffers['aw-d9'] = { id: 'aw-d9' };
    _awBuffers['aw-grad'] = { id: 'aw-grad' };
    _awBuffers['aw-fuer'] = { id: 'aw-fuer' };
    _awBuffers['aw-d5'] = { id: 'aw-d5' };
    _awBuffers['aw-meilen'] = { id: 'aw-meilen' };
    _awBuffers.a = { id: 'a' };
    _awBuffers.b = { id: 'b' };
`, context);
context.awmAnnounceWpAdvance(90, 5);

assert.equal(context.awmGetAudioQueueDebugState().queueDepth, 1, 'WP must remain queued while clips load');
assert.equal(context.awmGetAudioQueueDebugState().waypointEnqueuedCount, 1);
assert.deepEqual(events, [], 'nothing may start before clips are ready');

vm.runInContext(`
    _awLoaded = true;
    _awLoading = false;
    _awDrainQueue();
`, context);
assert.deepEqual(events, ['start:aw-wp-erreicht']);

vm.runInContext(`
    _awCurrentPlayback.interrupted = true;
    _awCurrentPlayback.currentSegment.onended = null;
    _awCurrentPlayback.currentSegment.stop();
    _awCurrentPlayback = null;
    _awQueue.length = 0;
    _awQueueBusy = false;
`, context);
events.length = 0;
sources.length = 0;
vm.runInContext(`
    _awCurrentPlayback = null;
    _awQueue.length = 0;
    _awQueueBusy = false;
    _awEnqueue(['a']);
`, context);
assert.deepEqual(events, ['start:a']);

const priorityToken = context.awmBeginPriorityAudio('pax-test');
assert.deepEqual(events, ['start:a', 'stop:a']);
vm.runInContext(`_awEnqueue(['b']);`, context);
assert.equal(context.awmGetAudioQueueDebugState().queueDepth, 2, 'system audio must wait behind Pax');

context.awmEndPriorityAudio(priorityToken);
assert.deepEqual(events, ['start:a', 'stop:a', 'start:a']);

sources.at(-1).onended();
await new Promise(resolve => setTimeout(resolve, 100));
assert.equal(events.at(-1), 'start:b');

sources.at(-1).onended();
await new Promise(resolve => setTimeout(resolve, 100));
assert.equal(context.awmGetAudioQueueDebugState().queueDepth, 0);
assert.equal(context.awmGetAudioQueueDebugState().queueBusy, false);

console.log('AWM audio queue self-test passed');
