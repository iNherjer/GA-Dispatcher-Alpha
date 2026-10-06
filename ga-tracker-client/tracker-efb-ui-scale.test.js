const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const surface = require('./toolbar-panel/PackageSources/html_ui/InGamePanels/VfrMultitool/HostSurface');
const { createDisplaySettingsControl } = require('./tracker-efb-display-settings');

test('surface uses SDK boolean, subscription and lifecycle cleanup; unknown stays unknown', () => {
  let value = false, notify, tick, destroyed = false, cleared = false;
  const runtime = { PanelInfo: { is2D: { get: () => value, sub(fn) { notify = fn; return { destroy() { destroyed = true; } }; } } },
    setInterval(fn) { tick = fn; return 1; }, clearInterval() { cleared = true; } };
  const changes = [], watcher = surface.watch(runtime, next => changes.push(next));
  value = true; notify(); tick(); value = null; tick();
  assert.deepEqual(changes, ['physical', 'popout', 'unknown']);
  watcher.stop(); value = false; notify(); tick();
  assert.equal(changes.length, 3); assert.equal(destroyed && cleared, true);
  assert.equal(surface.read({}), 'unknown');
});

test('legacy config migrates exactly once without multiplying or overwriting saved profiles', () => {
  let writes = 0, config = { private: 'retained', efbDisplay: { fontScale2d: 1.3, fontScaleVr: 2 } };
  const control = createDisplaySettingsControl({ readConfig: () => config, writeConfig(next) { writes++; config = next; return true; } });
  assert.equal(control.snapshot().uiScaleVersion, 0);
  for (let i = 0; i < 4; i++) control.update({ initialize: { fontScale2d: 1, fontScaleVr: 1 } });
  assert.equal(writes, 1); assert.equal(config.private, 'retained');
  assert.deepEqual(control.snapshot(), { configured: true, uiScaleVersion: 1, fontScale2d: 1.3, fontScaleVr: 2 });
});

test('root layout and input conversions across surfaces, VR, reset and resize preserve geographic map state', () => {
  const styles = {}, attributes = {}; let resize, invalidations = 0;
  const window = { innerWidth: 1200, innerHeight: 900, document: { body: {
    style: { setProperty(key, value) { styles[key] = value; } }, setAttribute(key, value) { attributes[key] = value; } } },
    addEventListener(name, fn) { assert.equal(name, 'resize'); resize = fn; },
    map: { invalidateSize(options) { assert.equal(options.pan, false); invalidations++; }, setZoom() { assert.fail('geographic zoom changed'); }, panTo() { assert.fail('center changed'); } } };
  vm.runInNewContext(fs.readFileSync(require.resolve('./tracker-efb-ui-scale'), 'utf8'), { window });
  const api = window.GAEfbUiScale;
  for (const host of ['physical', 'popout', 'toolbar', 'unknown']) for (const vr of [false, true]) for (const user of [0.9, 1, 2, 3]) {
    const expected = user * (vr && ['popout', 'toolbar'].includes(host) ? 1.5 : 1);
    assert.equal(api.apply(user, host, vr), expected);
    assert.ok(Math.abs(api.delta(30 * expected) - 30) < 1e-9);
    assert.equal(parseFloat(styles.width), 1200 / expected);
    assert.equal(parseFloat(styles.height), 900 / expected);
    assert.equal(attributes['data-ga-efb-surface'], host);
    const detached = host === 'popout' || host === 'toolbar';
    assert.equal(attributes['data-ga-efb-layout'], detached ? 'floating' : 'physical');
    assert.equal(styles['--ga-efb-dvh'], detached ? (900 / expected / 100) + 'px' : '1dvh');
    assert.equal(styles['--ga-efb-dvw'], detached ? (1200 / expected / 100) + 'px' : '1dvw');
    assert.equal(styles['--ga-efb-native-inset'], (28 / expected) + 'px');
  }
  api.apply(1, 'popout', true); window.innerWidth = 600; resize();
  assert.equal(styles.width, '400px'); assert.equal(api.state().effective, 1.5);
  api.apply(1, 'physical', true); assert.equal(api.state().effective, 1);
  assert.ok(invalidations > 0);
});
