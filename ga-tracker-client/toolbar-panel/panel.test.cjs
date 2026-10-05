const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, 'PackageSources/html_ui/InGamePanels/VfrMultitool/Panel.js'), 'utf8');
function fixture() {
  const events = {}, timers = new Map(), requests = [], minimizeCalls = [];
  const intervals = new Map(), modeMessages = [];
  let vr = 0;
  let clock = 1000, next = 0, observer;
  const panel = { active: false, visible: true, _minimized: false, get minimized() { return this._minimized; }, ToggleMinimized(value) { minimizeCalls.push(value); this._minimized = value != null ? value : !this.minimized; observer(); }, rect: { top: 20, right: 900 }, header: null, querySelector() { return this.header; }, getBoundingClientRect() { return this.rect; }, addEventListener(n, fn) { events[n] = fn; }, closePanel() { this.active = false; events.panelInactive(); } };
  const container = { children: [], appendChild(f) { this.children.push(f); }, removeChild(f) { this.children.splice(this.children.indexOf(f), 1); } };
  const elements = { VfrMultitoolPanel: panel, 'vfr-frame-container': container, 'vfr-status': {}, 'vfr-statusbar': { style: {} }, 'vfr-offline': { style: {} }, 'vfr-retry': {}, 'vfr-close': {}, 'vfr-window-controls': { style: {} }, 'vfr-window-close': { style: {} }, 'vfr-minimize': { style: {}, attributes: {}, setAttribute(name, value) { this.attributes[name] = value; } } };
  const document = { hidden: false, getElementById: id => elements[id], createElement: () => ({ contentWindow: { postMessage(data, origin) { modeMessages.push({ data, origin }); } } }), addEventListener(n, fn) { events[n] = fn; } };
  const animationFrames = new Map();
  vm.runInNewContext(source, { document, window: { GAVrMode: require('./PackageSources/html_ui/InGamePanels/VfrMultitool/VrMode'), SimVar: { GetSimVarValue() { return vr; } }, Coherent: { on(name, callback) { events.vr = callback; return { clear() { delete events.vr; } }; } }, setInterval(fn) { const id = ++next; intervals.set(id, fn); return id; }, clearInterval(id) { intervals.delete(id); }, innerWidth: 1000, requestAnimationFrame(fn) { const id = ++next; animationFrames.set(id, fn); return id; }, cancelAnimationFrame(id) { animationFrames.delete(id); }, addEventListener(n, fn) { events[n] = fn; } }, console: { log() {} }, Date: { now: () => clock }, Math,
    MutationObserver: function (fn) { observer = fn; this.observe = () => {}; },
    setTimeout(fn) { const id = ++next; timers.set(id, fn); return id; }, clearTimeout(id) { timers.delete(id); },
    XMLHttpRequest: function () { this.open = (method, url) => { this.method = method; this.url = url; }; this.send = () => requests.push(this); this.abort = () => { this.aborted = true; }; }
  });
  return { panel, container, elements, events, requests, timers, document, animationFrames, minimizeCalls, modeMessages, intervals,
    setVr(value) { vr = value ? 1 : 0; if (events.vr) events.vr(!!value); },
    animationFrame() { const pending = [...animationFrames.values()]; animationFrames.clear(); pending.forEach(fn => fn()); },
    open() { panel.active = true; events.panelActive(); },
    tick(ms = 4000) { clock += ms; const pending = [...timers.values()]; timers.clear(); pending.forEach(fn => fn()); },
    reply(ok = true) { const xhr = requests[requests.length - 1]; xhr.status = ok ? 200 : 503; xhr.onload(); },
    minimize(value) { panel.ToggleMinimized(value); },
    message(data, origin = 'http://127.0.0.1:49880', sender = container.children[0]?.contentWindow) { events.message({ data: { channel: new URL(container.children[0].src).searchParams.get('channel'), ...data }, origin, source: sender }); }
  };
}
test('only visible panel performs GETs; close aborts and stale response cannot recreate frame', () => {
  const f = fixture(); assert.equal(f.requests.length, 0); f.open();
  assert.equal(f.requests[0].method, 'GET'); f.elements['vfr-close'].onclick();
  assert.equal(f.requests[0].aborted, true); f.reply();
  assert.equal(f.container.children.length, 0); assert.equal(f.timers.size, 0);
});
test('shared cockpit URL and strict sender/origin/channel validation', () => {
  const f = fixture(); f.open(); f.reply();
  assert.equal(new URL(f.container.children[0].src).pathname, '/efb/v1/');
  assert.equal(new URL(f.container.children[0].src).searchParams.get('host'), 'toolbar');
  f.message({ type: 'ga-efb-kartentisch', state: 'ready' }, 'http://evil.invalid');
  assert.notEqual(f.elements['vfr-offline'].style.display, 'none');
  f.message({ type: 'ga-efb-kartentisch', state: 'ready' }, undefined, {});
  assert.notEqual(f.elements['vfr-offline'].style.display, 'none');
  f.message({ type: 'ga-efb-kartentisch', state: 'ready', channel: 'old-channel' });
  assert.notEqual(f.elements['vfr-offline'].style.display, 'none');
  f.message({ type: 'ga-efb-kartentisch', state: 'ready' });
  assert.equal(f.elements['vfr-offline'].style.display, 'none');
});
test('trusted UI-close also works before ready; missing Coherent source requires channel and origin', () => {
  const f = fixture(); f.open(); f.reply();
  f.message({ type: 'ga-efb-kartentisch', state: 'close', channel: 'foreign' }, undefined, null);
  assert.equal(f.panel.active, true);
  f.message({ type: 'ga-efb-kartentisch', state: 'close' }, undefined, null);
  assert.equal(f.panel.active, false); assert.equal(f.container.children.length, 0);
});
test('ready before initial load stays valid; later navigation must become ready again', () => {
  const f = fixture(); f.open(); f.reply(); const frame = f.container.children[0];
  f.message({ type: 'ga-efb-kartentisch', state: 'ready' }); frame.onload();
  f.tick(21000); f.reply(); assert.equal(f.timers.size, 1);
  frame.onload(); f.tick(21000);
  assert.equal(f.timers.size, 0); assert.match(f.elements['vfr-status'].textContent, /antwortet nicht/);
});
test('short outage preserves frame; minimize unloads and restore uses fresh frame', () => {
  const f = fixture(); f.open(); f.reply(); const old = f.container.children[0];
  f.tick(); f.reply(false); assert.equal(f.container.children[0], old);
  f.minimize(true); assert.equal(f.container.children.length, 0); assert.equal(f.timers.size, 0);
  f.minimize(false); f.reply(); assert.notEqual(f.container.children[0], old);
  assert.notEqual(f.container.children[0].src, old.src);
});
test('offline start retries; missing probe readiness stops automatic boot attempts', () => {
  const f = fixture(); f.open(); f.reply(false); assert.equal(f.container.children.length, 0);
  f.tick(); f.reply(); assert.equal(f.container.children.length, 1);
  f.tick(21000); assert.equal(f.timers.size, 0);
  assert.match(f.elements['vfr-status'].textContent, /antwortet nicht/);
  f.elements['vfr-retry'].onclick(); f.reply(); assert.equal(f.container.children.length, 1);
});
test('window buttons remain available after ready and minimize suspends requests until restore', () => {
  const f = fixture();
  assert.equal(f.elements['vfr-window-controls'].hidden, true);
  f.open(); f.reply();
  f.message({ type: 'ga-efb-kartentisch', state: 'ready' });
  assert.equal(f.elements['vfr-statusbar'].style.display, 'none');
  assert.equal(f.elements['vfr-window-controls'].hidden, false);
  const button = f.elements['vfr-minimize'];
  button.onclick();
  assert.deepEqual(f.minimizeCalls, [undefined]);
  assert.equal(Object.getOwnPropertyDescriptor(f.panel, 'minimized').set, undefined);
  assert.equal(f.panel.minimized, true);
  assert.equal(f.container.children.length, 0);
  assert.equal(f.timers.size, 0);
  assert.equal(f.elements['vfr-window-controls'].hidden, false);
  assert.equal(button.attributes['aria-label'], 'Wiederherstellen');
  button.onclick(); f.reply();
  assert.deepEqual(f.minimizeCalls, [undefined, undefined]);
  assert.equal(f.panel.minimized, false);
  assert.equal(f.container.children.length, 1);
  assert.equal(button.attributes['aria-expanded'], 'true');
  f.elements['vfr-window-close'].onclick();
  assert.equal(f.panel.active, false);
  assert.equal(f.elements['vfr-window-controls'].hidden, true);
  assert.equal(f.container.children.length, 0);
  assert.equal(f.animationFrames.size, 0);
});
test('window buttons follow the native panel when dragged and stop tracking when hidden', () => {
  const f = fixture(); f.open();
  assert.equal(f.elements['vfr-window-controls'].style.top, '24px');
  assert.equal(f.elements['vfr-window-controls'].style.right, '108px');
  f.panel.rect = { top: 80, right: 700 }; f.animationFrame();
  assert.equal(f.elements['vfr-window-controls'].style.top, '84px');
  assert.equal(f.elements['vfr-window-controls'].style.right, '308px');
  f.document.hidden = true; f.events.visibilitychange();
  assert.equal(f.elements['vfr-window-controls'].hidden, true);
  assert.equal(f.animationFrames.size, 0);
});

test('scaled header reserves title space and keeps custom controls clear of native actions', () => {
  const f = fixture();
  const title = { style: {} };
  const actions = { getBoundingClientRect() { return { left: 800, width: 100 }; } };
  f.panel.header = { getBoundingClientRect() { return { top: 20, height: 28 }; }, querySelector(selector) { return selector === '.wrap' ? title : actions; } };
  f.open();
  assert.equal(f.elements['vfr-window-controls'].style.top, '24px');
  assert.equal(f.elements['vfr-window-controls'].style.right, '204px');
  assert.equal(f.elements['vfr-minimize'].style.height, '20px');
  assert.equal(f.elements['vfr-window-close'].style.width, '22.5px');
  assert.equal(title.style.paddingRight, '57px');
  f.panel.header.getBoundingClientRect = () => ({ top: 80, height: 84 });
  f.animationFrame();
  assert.equal(f.elements['vfr-window-controls'].style.top, '106px');
  assert.equal(f.elements['vfr-minimize'].style.height, '32px');
  assert.equal(title.style.paddingRight, '84px');
});

test('toolbar forwards initial VR and live changes with the current channel, pauses and restores watcher', () => {
  const f = fixture(); f.setVr(true); f.open(); f.reply();
  const frame = f.container.children[0];
  assert.equal(new URL(frame.src).searchParams.get('vr'), '1');
  f.message({ type: 'ga-efb-kartentisch', state: 'ready' });
  assert.equal(f.modeMessages.at(-1).data.vr, true);
  assert.equal(f.modeMessages.at(-1).data.channel, new URL(frame.src).searchParams.get('channel'));
  assert.equal(f.modeMessages.at(-1).origin, 'http://127.0.0.1:49880');
  f.setVr(false); assert.equal(f.modeMessages.at(-1).data.vr, false);
  f.minimize(true); assert.equal(f.intervals.size, 0);
  const messages = f.modeMessages.length; f.setVr(true);
  assert.equal(f.modeMessages.length, messages);
  f.minimize(false); f.reply();
  assert.equal(new URL(f.container.children[0].src).searchParams.get('vr'), '1');
});