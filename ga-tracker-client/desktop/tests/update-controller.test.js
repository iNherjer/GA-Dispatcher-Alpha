const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const test = require('node:test');
const { UpdateController, normalizeChoice } = require('../lib/update-controller');

test('update choice accepts the three UI actions', () => {
  assert.equal(normalizeChoice('once'), 'once');
  assert.equal(normalizeChoice('automatic'), 'automatic');
  assert.equal(normalizeChoice('later'), 'later');
  assert.equal(normalizeChoice('unknown'), 'later');
});

class FakeUpdater extends EventEmitter {
  constructor(eventName = 'update-not-available') {
    super();
    this.eventName = eventName;
    this.downloadCount = 0;
  }

  checkForUpdates() {
    queueMicrotask(() => this.emit(this.eventName, { version: '1.1.0' }));
    return Promise.resolve();
  }

  downloadUpdate() {
    this.downloadCount += 1;
    return Promise.resolve();
  }

  quitAndInstall() {}
}

test('startup continues when no update is available', async () => {
  const updater = new FakeUpdater('update-not-available');
  const controller = new UpdateController({
    autoUpdater: updater,
    isPackaged: true,
    platform: 'win32',
    getPolicy: () => 'ask',
    savePolicy: () => {}
  });
  assert.equal(await controller.checkAtStartup(), 'continue');
  assert.equal(controller.publicState().phase, 'current');
});

test('first update waits for one-time, automatic or later choice', async () => {
  const updater = new FakeUpdater('update-available');
  let savedPolicy = 'ask';
  const controller = new UpdateController({
    autoUpdater: updater,
    isPackaged: true,
    platform: 'win32',
    getPolicy: () => savedPolicy,
    savePolicy: (policy) => { savedPolicy = policy; }
  });
  const startup = controller.checkAtStartup();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(controller.publicState().phase, 'choice-required');
  assert.deepEqual(controller.handleChoice('automatic'), { ok: true, action: 'download' });
  assert.equal(savedPolicy, 'automatic');
  assert.equal(updater.downloadCount, 1);
  controller.resolveStartup('test-complete');
  assert.equal(await startup, 'test-complete');
});
