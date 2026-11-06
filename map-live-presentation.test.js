const test = require('node:test');
const assert = require('node:assert/strict');
const presentation = require('./map-live-presentation');

function documentFixture() {
    const ids = new Map();
    function element(tag) {
        return {
            tag, attributes: {}, style: { getPropertyValue(key) { return this[key] || ''; },
                getPropertyPriority() { return ''; }, setProperty(key, value) { this[key] = value; } }, children: [], textContent: '',
            getAttribute(key) { return this.attributes[key] ?? null; },
            setAttribute(key, value) { this.attributes[key] = value; if (key === 'id') ids.set(value, this); },
            appendChild(child) { this.children.push(child); return child; },
            get childElementCount() { return this.children.length; }
        };
    }
    for (const id of ['compassSvg', 'compassCdiSvg', 'compassDisc']) {
        const node = element('svg'); node.setAttribute('id', id);
    }
    return { getElementById(id) { return ids.get(id); }, createElementNS(ns, tag) { return element(tag); } };
}

test('shared compass keeps all standalone cardinal labels and is built only once', () => {
    const document = documentFixture(), compass = presentation.createCompass(document);
    compass.buildRose(); compass.buildFixed();
    const rose = document.getElementById('compassSvg');
    const count = rose.childElementCount;
    compass.buildRose(); compass.buildFixed();
    assert.equal(rose.childElementCount, count);
    assert.deepEqual(rose.children.filter(node => node.tag === 'text').map(node => node.textContent),
        ['N', '3', '6', 'E', '12', '15', 'S', '21', '24', 'W', '30', '33']);
    assert.equal(document.getElementById('compassHdgReadout').textContent, '---°');
});

test('heading wraps via the short arc and CDI points back toward the planned track', () => {
    const document = documentFixture(), compass = presentation.createCompass(document);
    compass.buildRose(); compass.buildFixed();
    compass.updateHeading(359);
    assert.equal(document.getElementById('compassDisc').style.transform, 'rotate(1deg)');
    compass.updateHeading(1);
    assert.equal(document.getElementById('compassDisc').style.transform, 'rotate(-1deg)');
    assert.equal(document.getElementById('compassHdgReadout').textContent, '001°');
    compass.updateHeading(null);
    assert.equal(document.getElementById('compassDisc').style.transform, 'rotate(-1deg)');
    compass.updateInstruments(35, 30, 1);
    assert.equal(document.getElementById('compassCdiBarFixed').attributes.x1, '-22.0');
    compass.updateInstruments(35, 30, -3);
    assert.equal(document.getElementById('compassCdiBarFixed').attributes.x1, '44.0');
    assert.equal(document.getElementById('compassBugGroup').attributes.transform, 'rotate(35,150,150)');
});

test('aircraft keeps the original geographic pivot and configurable size/color', () => {
    const html = presentation.aircraftHtml();
    assert.match(html, /viewBox="0 0 447.74 339.91"/);
    assert.match(html, /transform: translate\(-50%, -37%\)/);
    assert.match(html, /transform-origin: 50% 37%/);
    assert.match(html, /fill="var\(--plane-color\)"/);
    assert.match(html, /width: var\(--plane-size\)/);
    assert.doesNotMatch(html, /<img/);
});

test('both profiles exclude ownship but retain nearby vertically separated traffic', () => {
    const own = {lat:48,lon:7,alt:3000};
    const traffic = [
        {id:'own',lat:48.0001,lon:7.0001,alt:3000},
        {id:'near',lat:48.04,lon:7.04,alt:12000},
        {id:'far-high',lat:48.2,lon:7.2,alt:12000},
        {id:'far-level',lat:48.2,lon:7.2,alt:4000}
    ];
    assert.deepEqual(presentation.filterTraffic(traffic,own).map(p=>p.id),['near','far-level']);
});

test('traffic levels: ground never warns, close or converging traffic alerts', () => {
    const own = { lat: 48, lon: 7, alt: 3000, hdg: 90, gs: 100 };
    const level = (ac, o = own) => presentation.classifyTraffic(ac, o).level;
    // on the ground right next to us: shown, but no warning
    assert.equal(level({ lat: 48.005, lon: 7.005, alt: 3000, gnd: 1 }), 'ground');
    // 0.6 NM away at the same altitude
    assert.equal(level({ lat: 48.01, lon: 7, alt: 3200, hdg: 90, gs: 100 }), 'alert');
    // same distance but 2000 ft above
    assert.equal(level({ lat: 48.01, lon: 7, alt: 5000, hdg: 90, gs: 100 }), 'other');
    // head-on 1.5 NM ahead, closing at 200 kt -> CPA in ~27 s
    assert.equal(level({ lat: 48, lon: 7 + 1.5 / (60 * Math.cos(48 * Math.PI / 180)), alt: 3300, hdg: 270, gs: 100 }), 'alert');
    // same spot but flying away from us
    assert.equal(level({ lat: 48, lon: 7 + 1.5 / (60 * Math.cos(48 * Math.PI / 180)), alt: 3300, hdg: 90, gs: 150 }), 'proximate');
    // 10 NM away, same altitude
    assert.equal(level({ lat: 48 + 10 / 60, lon: 7, alt: 3000, hdg: 0, gs: 100 }), 'other');
    // own aircraft on the ground: nothing warns
    assert.equal(level({ lat: 48.01, lon: 7, alt: 3000 }, { ...own, onGround: true }), 'other');
});

test('breadcrumb sampling is immediate above 20m and trims only after 12000 points', () => {
  const { appendTrailPoint } = require('./map-live-presentation');
  const points = [[48,7]], distance = (a,b) => (b[0]-a[0])*100;
  assert.equal(appendTrailPoint(points,48.1,7,distance),null);
  assert.equal(appendTrailPoint(points,NaN,7,distance),null);
  assert.equal(appendTrailPoint(points,48.3,7,distance),points);
  const full=Array.from({length:12000},(_,i)=>[i/1000,7]);
  const next=appendTrailPoint(full,20,7,()=>21);
  assert.equal(next.length,8000);assert.deepEqual(next.at(-1),[20,7]);
});

test('restored breadcrumb is scoped to one tracker lifetime and validates stored coordinates', () => {
  const {restoreTrail}=require('./map-live-presentation');
  const saved={sessionId:'first',points:[[48,7],[48.1,7.1]]};
  assert.deepEqual(restoreTrail(saved,'first'),saved.points);
  assert.notEqual(restoreTrail(saved,'first')[0],saved.points[0]);
  assert.deepEqual(restoreTrail(saved,'second'),[]);
  assert.deepEqual(restoreTrail(saved,''),[]);
  for(const points of [[[null,7]],[[91,7]],[[48,181]],[[48,'7']],[[48,7,2]],Array(12001).fill([48,7])]) {
    assert.deepEqual(restoreTrail({sessionId:'first',points},'first'),[]);
  }
});

test('repeated instruments preserve their nodes and perform no output writes; changes still render', () => {
    const document = documentFixture(), compass = presentation.createCompass(document);
    compass.buildRose(); compass.buildFixed();
    const ids = ['compassBugGroup', 'compassCdiBarFixed', 'compassCdiSvg', 'compassCdiGroup', 'compassDisc', 'compassHdgReadout'];
    let writes = 0;
    for (const id of ids) {
        const node = document.getElementById(id), attribute = node.setAttribute.bind(node);
        node.setAttribute = (...args) => { writes++; attribute(...args); };
        const style = node.style.setProperty.bind(node.style);
        node.style.setProperty = (...args) => { writes++; style(...args); };
        let text = node.textContent;
        Object.defineProperty(node, 'textContent', { get: () => text, set(value) { writes++; text = value; } });
    }
    compass.updateHeading(359); compass.updateInstruments(40, 40, .1); writes = 0;
    for (let i = 0; i < 100; i++) { compass.updateHeading(359); compass.updateInstruments(40, 40, .1); }
    assert.equal(writes, 0);
    compass.updateHeading(0); compass.updateInstruments(41, 40, -.2);
    assert.ok(writes > 0);
    assert.equal(document.getElementById('compassHdgReadout').textContent, '000°');
    assert.equal(document.getElementById('compassDisc').style.transform, 'rotate(0deg)');
    assert.equal(document.getElementById('compassCdiBarFixed').getAttribute('x1'), '4.4');
    compass.updateHeading(359);
    assert.equal(document.getElementById('compassDisc').style.transform, 'rotate(1deg)');
});

test('output comparisons preserve glyph children, CSS priority, normalized colors and external corrections', () => {
    const glyph = {}, node = { textContent: '▲', children: [glyph] };
    presentation.setText(node, '▲'); assert.equal(node.children[0], glyph);
    presentation.setText(node, 0); assert.equal(node.textContent, '0');
    presentation.setText(node, null); assert.equal(node.textContent, '');
    const values = {}, priorities = {}; let writes = 0;
    const style = { getPropertyValue: key => values[key] || '', getPropertyPriority: key => priorities[key] || '',
        setProperty(key, value, priority) { writes++; values[key] = value === '#ffffff' ? 'rgb(255, 255, 255)' : value; priorities[key] = priority; } };
    const element = { style };
    presentation.setStyle(element, 'color', '#ffffff');
    presentation.setStyle(element, 'color', '#ffffff'); assert.equal(writes, 1);
    presentation.setStyle(element, 'color', '#ffffff', 'important'); assert.equal(writes, 2);
    values.color = 'red';
    presentation.setStyle(element, 'color', '#ffffff', 'important'); assert.equal(writes, 3);
    priorities.color = '';
    presentation.setStyle(element, 'color', '#ffffff', 'important'); assert.equal(writes, 4);
    presentation.setStyle(element, 'color', ''); assert.equal(values.color, '');
    const document = documentFixture();
    const oldNode = document.createElementNS('', 'g'), newNode = document.createElementNS('', 'g');
    presentation.setAttribute(oldNode, 'transform', 'rotate(10)');
    presentation.setAttribute(newNode, 'transform', 'rotate(10)');
    assert.equal(newNode.getAttribute('transform'), 'rotate(10)');
});

test('EFB SVG output keeps Leaflet geometry processing and other renderers untouched', () => {
    let writes = 0;
    const native = { _setPath(layer, path) { writes++; layer._path.setAttribute('d', path); } };
    const L = { svg: options => Object.assign(Object.create(native), { options }) };
    const regular = L.svg({}), renderer = presentation.createEfbSvgRenderer(L, { pane: 'gaPreviewPane' });
    const document = documentFixture(), layer = { _path: document.createElementNS('', 'path') };
    renderer._setPath(layer, 'M0 0L1 1'); renderer._setPath(layer, 'M0 0L1 1'); assert.equal(writes, 1);
    renderer._setPath(layer, 'M0 0L1.001 1'); assert.equal(writes, 2, 'no position quantization');
    layer._path = document.createElementNS('', 'path');
    renderer._setPath(layer, 'M0 0L1.001 1'); assert.equal(writes, 3, 'replacement path gets its output');
    layer._path.setAttribute('d', 'external');
    renderer._setPath(layer, 'M0 0L1.001 1'); assert.equal(writes, 4);
    regular._setPath(layer, 'M0 0L1.001 1'); assert.equal(writes, 5);
    assert.equal(native._setPath, regular._setPath, 'Leaflet prototype is unchanged');
});

test('traffic symbols: known kinds get their own shape, unknown falls back to single', () => {
    assert.equal(presentation.trafficSymbolKind({ k: 'heli' }), 'heli');
    assert.equal(presentation.trafficSymbolKind({ k: 'twin' }), 'twin');
    assert.equal(presentation.trafficSymbolKind({}), 'single');
    assert.equal(presentation.trafficSymbolKind({ k: 'boat' }), 'single');
    const heli = presentation.trafficSymbolSvg('heli', '#00ccff', 22);
    assert.match(heli, /<circle/);
    assert.ok(presentation.trafficSymbolSvg('heavy', '#00ccff', 20).includes('width="25"'));
});

test('own aircraft icon: classic by default, traffic classes on request, colour and size stay variable', () => {
    const classic = presentation.aircraftHtml();
    assert.match(classic, /viewBox="0 0 447\.74 339\.91"/);
    assert.equal(presentation.aircraftHtml('unknown'), classic);
    for (const kind of ['single', 'twin', 'jet', 'heavy', 'heli']) {
        const html = presentation.aircraftHtml(kind);
        assert.match(html, /fill="var\(--plane-color\)"/);
        assert.match(html, /width: var\(--plane-size\)/);
        assert.match(html, /transform-origin: 50% 50%/, 'rotates around its centre');
    }
    assert.match(presentation.aircraftHtml('heli'), /<circle/);
    assert.deepEqual(presentation.OWN_PLANE_ICON_KINDS, ['classic', 'single', 'twin', 'jet', 'heavy', 'heli']);
});

test('icon shadow: further, softer and lighter with height; none on the ground or when off', () => {
    const f = presentation.iconShadowFilter;
    assert.equal(f(0, {}), '');
    assert.equal(f(3000, { on: false }), '');
    assert.equal(f(3000, { dark: 0 }), '');
    const parse = (v) => v.match(/drop-shadow\(([\d.]+)px ([\d.]+)px ([\d.]+)px rgba\(0,0,0,([\d.]+)\)\)/).slice(1).map(Number);
    const low = parse(f(800, {})), high = parse(f(6000, {}));
    assert.ok(high[0] > low[0], 'offset grows with height');
    assert.ok(high[2] > low[2], 'softer higher up');
    assert.ok(high[3] < low[3], 'lighter higher up');
    assert.ok(parse(f(40000, { reach: 0.25 }))[0] <= 20 / Math.SQRT2 + 0.1, 'offset capped at 20 px at a quarter reach');
    assert.ok(parse(f(3000, { sharp: 1 }))[2] < parse(f(3000, { sharp: 0 }))[2], 'sharpness reduces blur');
    assert.match(presentation.aircraftHtml(), /var\(--plane-shadow/);
});

test('icon shadow: slider middle (0.5) is the calibrated default, with room both ways', () => {
    const parse = (v) => v.match(/drop-shadow\(([\d.]+)px ([\d.]+)px ([\d.]+)px rgba\(0,0,0,([\d.]+)\)\)/).slice(1).map(Number);
    const f = presentation.iconShadowFilter;
    // 1000 ft above ground: offset 1.5 + 8 px, darkness 0.45 * (1 - 0.45/8), blur factor 1.0
    const mid = parse(f(1000, {}));
    assert.ok(Math.abs(mid[0] - 9.5 * Math.SQRT1_2) < 0.1, 'offset 8 px per 1000 ft');
    assert.ok(Math.abs(mid[3] - 0.45 * (1 - 0.45 / 8)) < 0.01, 'darkness 45 % near the ground');
    assert.ok(Math.abs(mid[2] - 0.8) < 0.06, 'blur factor 1.0');
    assert.ok(parse(f(1000, { reach: 1 }))[0] > mid[0] && parse(f(1000, { reach: 0.2 }))[0] < mid[0]);
    assert.ok(parse(f(1000, { dark: 1 }))[3] > mid[3] && parse(f(1000, { dark: 0.2 }))[3] < mid[3]);
    assert.ok(parse(f(1000, { sharp: 1 }))[2] < mid[2] && parse(f(1000, { sharp: 0 }))[2] > mid[2]);
    assert.ok(parse(f(40000, {}))[0] <= 40 * Math.SQRT1_2 + 0.1, 'capped at 40 px by default');
});

test('display level: the tracker level wins over local classification; unknown ids fall back', () => {
    const own = { lat: 48, lon: 7, alt: 3000, hdg: 0, gs: 100 };
    const ac = { id: 'x', lat: 48 + 5 / 60, lon: 7, alt: 3000, hdg: 0, gs: 100 };
    const info = presentation.classifyTraffic(ac, own);
    assert.equal(presentation.trafficDisplayLevel(ac, info, null, null), 'proximate');
    assert.equal(presentation.trafficDisplayLevel(ac, info, null, { x: 'resolve' }), 'resolve');
    assert.equal(presentation.trafficDisplayLevel(ac, info, null, { y: 'alert' }), 'proximate');
    assert.equal(presentation.trafficDisplayLevel({ ...ac, gnd: 1 }, info, null, { x: 'alert' }), 'ground');
});
