const test = require('node:test');
const assert = require('node:assert/strict');
const presentation = require('./map-live-presentation');

function documentFixture() {
    const ids = new Map();
    function element(tag) {
        return {
            tag, attributes: {}, style: {}, children: [], textContent: '',
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
