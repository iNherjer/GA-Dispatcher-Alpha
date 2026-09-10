const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require.resolve('./tracker-efb-kartentisch-host.js'), 'utf8');

function fixture() {
  let nextTimer = 0;
  const timers = new Map(), requests = [], completions = [];
  const document = { createElement() { return {
    setAttribute() {},
    set src(value) { requests.push(value); },
    get src() { return requests[requests.length - 1]; }
  }; } };
  const L = {
    Browser: {}, Util: { emptyImageUrl: 'data:empty', template(url, data) { return url.replace(/\{(\w+)\}/g, (_, k) => data[k]); } },
    TileLayer: { extend(methods) {
      class Layer {
        constructor(url, options) { this.url = url; this.options = options; this.events = {}; this.zoom = 11; }
        _getZoomForUrl() { return this.zoom; }
        _getSubdomain() { return 'a'; }
        getTileUrl(coords) { return L.Util.template(this.url, { ...coords, s: 'a', z: 11 }); }
        on(name, fn) { this.events[name] = fn; }
      }
      Object.assign(Layer.prototype, methods); return Layer;
    } }
  };
  const context = vm.createContext({ document, L, tileHealthReported: {}, report() {}, window: {
    setTimeout(fn, ms) { const id = ++nextTimer; timers.set(id, { fn, ms }); return id; },
    clearTimeout(id) { timers.delete(id); }
  } });
  vm.runInContext(source.slice(source.indexOf('  function tileTemplateUrl('), source.indexOf('  function createTileLayer(')), context);
  const layer = context.createResilientTileLayer({ id: 'topo', url: 'https://primary/{z}/{x}/{y}', fallbackUrl: 'https://backup/{z}/{x}/{y}', localUrl: '/proxy/{z}/{x}/{y}' }, { referrerPolicy: 'no-referrer' });
  const tile = layer.createTile({ x: 12, y: 15, z: 18 }, (error, value) => completions.push({ error, value }));
  function advance() {
    const [id, timer] = timers.entries().next().value;
    timers.delete(id); timer.fn(); return timer.ms;
  }
  return { layer, tile, timers, requests, completions, advance };
}

test('tile fallback follows standalone timeout and native zoom; completion is once only', () => {
  const f = fixture();
  assert.equal(f.tile.referrerPolicy, 'no-referrer');
  assert.equal(f.requests[0], 'https://primary/11/12/15');
  f.layer.zoom = 15; // Existing tiles still retry their original native zoom.
  assert.equal(f.advance(), 4500);
  assert.equal(f.requests[1], 'https://backup/11/12/15');
  const oldError = f.tile.onerror;
  f.tile.onload();
  oldError();
  assert.equal(f.requests.length, 2);
  assert.equal(f.completions.length, 1);
  assert.equal(f.completions[0].error, null);
  assert.equal(f.timers.size, 0);
});

test('errors advance immediately to backup and proxy, with a bounded final failure', () => {
  const f = fixture();
  f.tile.onerror(); f.tile.onerror();
  assert.deepEqual(f.requests, ['https://primary/11/12/15', 'https://backup/11/12/15', '/proxy/11/12/15']);
  assert.equal(f.advance(), 7000);
  assert.equal(f.completions.length, 1);
  assert.match(f.completions[0].error.message, /timeout/);
  assert.equal(f.timers.size, 0);
});

test('panning away cancels stale tile work, even with a late error or timeout callback', () => {
  const f = fixture();
  const oldError = f.tile.onerror, oldTimeout = [...f.timers.values()][0].fn;
  f.layer.events.tileunload({ tile: f.tile });
  oldError(); oldTimeout();
  assert.deepEqual(f.requests, ['https://primary/11/12/15', 'data:empty']);
  assert.equal(f.timers.size, 0);
  assert.equal(f.completions.length, 0);
});
