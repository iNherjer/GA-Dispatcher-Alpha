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
