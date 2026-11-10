const test = require('node:test');
const assert = require('node:assert/strict');

function fakeLeaflet() {
    const live = new Set();
    const L = {
        divIcon: (o) => ({ html: o.html }),
        marker(latlng, o) {
            const m = { latlng, icon: o.icon, z: o.zIndexOffset, iconSets: 0,
                addTo() { live.add(m); return m; }, remove() { live.delete(m); },
                setLatLng(p) { m.latlng = p; }, setIcon(i) { m.icon = i; m.iconSets++; },
                setZIndexOffset(z) { m.z = z; }, getElement() { return null; } };
            return m;
        }
    };
    return { L, live };
}

global.window = {};
window.GAMapLivePresentation = require('./map-live-presentation');
require('./traffic-map-layer');
const { createTrafficMapLayer } = window.GATrafficMapLayer;

const own = { lat: 48, lon: 7, alt: 3000, hdg: 0, gs: 100, vs: 0, onGround: false, groundFt: 1000 };

test('one marker per contact id, no stacking over many updates, empty list clears', () => {
    const { L, live } = fakeLeaflet();
    const layer = createTrafficMapLayer({ map: {}, L, getOwn: () => own });
    for (let i = 0; i < 20; i++) {
        layer.update([
            { id: 'o1', lat: 48.05 + i * 0.001, lon: 7, alt: 3500, hdg: 0, gs: 100, k: 'jet' },
            { id: 'o2', lat: 47.95, lon: 7.02 + i * 0.001, alt: 1000, gs: 0, gnd: 1 }
        ]);
    }
    assert.equal(live.size, 2);
    assert.equal(layer.count(), 2);
    layer.update([]);
    assert.equal(live.size, 0);
});

test('contacts from an old tracker without id follow the nearest marker', () => {
    const { L, live } = fakeLeaflet();
    const layer = createTrafficMapLayer({ map: {}, L, getOwn: () => own });
    for (let i = 0; i < 10; i++) layer.update([{ lat: 48.1 + i * 0.002, lon: 7, alt: 3500, hdg: 0, gs: 120 }]);
    assert.equal(live.size, 1);
});

test('warning level and shadow show up in the marker; level change redraws the icon', () => {
    const { L, live } = fakeLeaflet();
    const layer = createTrafficMapLayer({ map: {}, L, getOwn: () => own });
    layer.update([{ id: 'w', lat: 48 + 5 / 60, lon: 7, alt: 3000, hdg: 0, gs: 100, agl: 2000 }]);
    const m = [...live][0];
    assert.match(m.icon.html, /trf-other|trf-proximate/);
    assert.match(m.icon.html, /drop-shadow/, 'airborne contact casts a shadow');
    assert.match(m.icon.html, /class="trf-alt" style="position:relative;z-index:1/, 'labels above the shadow');
    layer.update([{ id: 'w', lat: 48 + 0.5 / 60, lon: 7, alt: 3000, hdg: 0, gs: 100, agl: 2000 }]);
    assert.match(m.icon.html, /trf-alert/);
    assert.equal(m.iconSets, 1);
    assert.equal(m.z, 6000);
});

test('ground traffic: grey, no shadow', () => {
    const { L, live } = fakeLeaflet();
    const layer = createTrafficMapLayer({ map: {}, L, getOwn: () => own });
    layer.update([{ id: 'g', lat: 48.01, lon: 7, alt: 1000, gs: 0, gnd: 1 }]);
    const html = [...live][0].icon.html;
    assert.match(html, /trf-ground/);
    assert.doesNotMatch(html, /drop-shadow\(/);
});

function fakeMap(zoom) {
    const handlers = {};
    return { zoom, getZoom() { return this.zoom; }, on(ev, fn) { handlers[ev] = fn; },
        fire(ev) { handlers[ev] && handlers[ev](); },
        // ~ 1 px per 0.001 deg at zoom 13, halving per zoom step
        latLngToLayerPoint([lat, lon]) { const f = Math.pow(2, this.zoom - 13) * 1000; return { x: lon * f, y: -lat * f }; } };
}

test('zoomed out: overlapping contacts merge, warnings stay single, ground traffic hidden, symbols shrink', () => {
    const { L, live } = fakeLeaflet();
    const map = fakeMap(8);
    const layer = createTrafficMapLayer({ map, L, getOwn: () => own });
    const list = [
        { id: 'a', lat: 48.30, lon: 7.30, alt: 6000, hdg: 0, gs: 100, k: 'single' },
        { id: 'b', lat: 48.301, lon: 7.301, alt: 6500, hdg: 0, gs: 100, k: 'twin' },
        { id: 'c', lat: 48.302, lon: 7.30, alt: 7000, hdg: 0, gs: 100, k: 'jet' },
        { id: 'w', lat: 48 + 0.5 / 60, lon: 7, alt: 3000, hdg: 0, gs: 100 },          // warning
        { id: 'g', lat: 47.90, lon: 7.10, alt: 1000, gs: 0, gnd: 1 }                   // ground
    ];
    layer.update(list);
    const htmls = [...live].map(m => m.icon.html);
    assert.equal(htmls.filter(h => h.includes('trf-cluster')).length, 1, 'three nearby contacts merged');
    assert.match(htmls.find(h => h.includes('trf-cluster')), />3</);
    assert.equal(htmls.filter(h => h.includes('trf-alert')).length, 1, 'warning stays a single symbol');
    assert.ok(!htmls.some(h => h.includes('trf-ground')), 'ground traffic hidden');
    assert.match(htmls.find(h => h.includes('trf-alert')), /D-|trf-alt/, 'warning keeps labels');

    // zooming in splits the cluster again and shows ground traffic
    map.zoom = 13; map.fire('zoomend');
    const after = [...live].map(m => m.icon.html);
    assert.equal(after.filter(h => h.includes('trf-cluster')).length, 0);
    assert.equal(live.size, 5);
});

test('symbols shrink between zoom 11 and 9, warnings keep full size', () => {
    const { zoomScale } = window.GATrafficMapLayer;
    assert.equal(zoomScale(12), 1);
    assert.equal(zoomScale(10), 0.8);
    assert.equal(zoomScale(7), 0.6);
});

test('crew aircraft are green with a white edge and their call sign; a warning adds a coloured ring', () => {
    const layer = global.window.GATrafficMapLayer;
    const plain = layer.iconHtml(90, 'other', { alt: '+200', cs: 'D-HGSR · Bob' }, 'heli', '', 1, true, true);
    assert.match(plain, /fill="#30d158"/);
    assert.match(plain, /stroke="#ffffff"/);
    assert.match(plain, /D-HGSR · Bob/);
    assert.doesNotMatch(plain, /box-shadow:0 0 0 3px/);
    const warned = layer.iconHtml(90, 'alert', { alt: '+0', cs: 'D-HGSR' }, 'heli', '', 1, true, true);
    assert.match(warned, /fill="#30d158"/, 'stays green');
    assert.match(warned, /box-shadow:0 0 0 3px #ffb000/, 'orange ring on a warning');
    const zoomedOut = layer.iconHtml(0, 'other', { alt: '+200', cs: 'D-HGSR' }, 'single', '', 0.6, false, true);
    assert.match(zoomedOut, /D-HGSR/, 'call sign stays when zoomed out');
    const ai = layer.iconHtml(0, 'other', { alt: '', cs: 'DLH1' }, 'jet', '', 1, true, false);
    assert.doesNotMatch(ai, /#30d158/);
});
